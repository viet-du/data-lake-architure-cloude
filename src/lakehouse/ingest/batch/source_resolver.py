"""Materialize an ingestion source into a local file Spark can read.

MASTER PLAN §05.2 requires Bronze ingestion to work from a real source and
§12.3 (test data rules) requires deterministic fixtures. The UI may submit a
source as a local path, an ``s3://`` object, or an HTTP(S) URL. Spark's
``read.csv``/``read.json`` cannot open all of those consistently (S3A needs
the Hadoop credential provider, HTTP needs an external connector), so the
ingestors materialize the source first.

Design constraints:

* The download is bounded (``LAKEHOUSE_MAX_INGEST_BYTES``) so a hostile or
  mistaken source cannot exhaust the worker disk.
* The temporary copy lives in a private temp directory that is removed when
  the context manager exits — source fixtures are never modified.
* Credentials are read from the environment; they are never logged.
"""

from __future__ import annotations

import logging
import os
import shutil
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator
from urllib.parse import unquote, urlparse
from urllib.request import urlopen

from lakehouse.core.env import get_env

logger = logging.getLogger(__name__)

#: Maximum size of a materialized source (default 256 MiB).
MAX_INGEST_BYTES = int(get_env("LAKEHOUSE_MAX_INGEST_BYTES", str(256 * 1024 * 1024)) or 0)

#: Repository root — used to resolve relative fixture paths.
_REPO_ROOT = Path(__file__).resolve().parents[4]


class SourceResolutionError(ValueError):
    """Raised when the submitted source cannot be located or materialized."""


def _storage_endpoint() -> tuple[str | None, str | None, str | None, bool]:
    """Return ``(endpoint, access_key, secret_key, use_ssl)`` for S3 access."""
    endpoint = get_env("S3_ENDPOINT") or get_env("MINIO_ENDPOINT")
    access_key = get_env("S3_ACCESS_KEY") or get_env("MINIO_ACCESS_KEY")
    secret_key = get_env("S3_SECRET_KEY") or get_env("MINIO_SECRET_KEY")
    use_ssl_raw = get_env("S3_USE_SSL") or get_env("MINIO_SECURE") or "false"
    use_ssl = use_ssl_raw.strip().lower() == "true"
    if endpoint and "://" in endpoint:
        parsed = urlparse(endpoint)
        if parsed.scheme == "https":
            use_ssl = True
        endpoint = parsed.netloc or endpoint
    return endpoint, access_key, secret_key, use_ssl


def _download_s3(bucket: str, key: str, dest: Path) -> Path:
    try:
        import boto3
        from botocore.config import Config
    except ImportError as exc:  # pragma: no cover - dependency guard
        raise SourceResolutionError("boto3 is required to ingest from s3:// sources") from exc

    endpoint, access_key, secret_key, use_ssl = _storage_endpoint()
    if not endpoint:
        raise SourceResolutionError("S3 source requested but no S3/MINIO endpoint is configured")

    client = boto3.client(
        "s3",
        endpoint_url=f"{'https' if use_ssl else 'http'}://{endpoint}",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=get_env("S3_REGION") or "us-east-1",
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )
    try:
        head = client.head_object(Bucket=bucket, Key=key)
        length = int(head.get("ContentLength") or 0)
        if MAX_INGEST_BYTES and length > MAX_INGEST_BYTES:
            raise SourceResolutionError(
                f"Source object is {length} bytes which exceeds the ingest limit of {MAX_INGEST_BYTES}"
            )
        client.download_file(bucket, key, str(dest))
    except SourceResolutionError:
        raise
    except Exception as exc:  # pragma: no cover - network/credential errors
        raise SourceResolutionError(f"Could not read s3://{bucket}/{key}: {type(exc).__name__}: {exc}") from exc
    return dest


def _download_http(url: str, dest: Path) -> Path:
    try:
        with urlopen(url, timeout=60) as response:  # noqa: S310 - scheme checked by caller
            length = int(response.headers.get("Content-Length") or 0)
            if MAX_INGEST_BYTES and length > MAX_INGEST_BYTES:
                raise SourceResolutionError(
                    f"Source is {length} bytes which exceeds the ingest limit of {MAX_INGEST_BYTES}"
                )
            with dest.open("wb") as handle:
                shutil.copyfileobj(response, handle, length=1024 * 1024)
    except SourceResolutionError:
        raise
    except Exception as exc:  # pragma: no cover - network errors
        raise SourceResolutionError(f"Could not read {url}: {type(exc).__name__}: {exc}") from exc
    return dest


def _local_candidates(source: str) -> list[Path]:
    candidates: list[Path] = []
    raw = Path(source).expanduser()
    if raw.is_absolute():
        candidates.append(raw)
    else:
        candidates.append(Path.cwd() / raw)
        candidates.append(_REPO_ROOT / raw)
        samples_dir = get_env("DATA_SAMPLES_DIR")
        if samples_dir:
            candidates.append(Path(samples_dir) / raw)
    return candidates


@contextmanager
def materialize_source(source: str) -> Iterator[Path]:
    """Yield a local path for ``source`` and clean up any temporary copy.

    Accepts ``s3://bucket/key``, ``s3a://bucket/key``, ``http(s)://…``,
    ``file://…`` and local filesystem paths.
    """
    if not source or not source.strip():
        raise SourceResolutionError("An ingestion source is required")
    raw = source.strip()
    parsed = urlparse(raw)

    if parsed.scheme in ("s3", "s3a"):
        bucket = parsed.netloc
        key = unquote(parsed.path.lstrip("/"))
        if not bucket or not key:
            raise SourceResolutionError(f"Invalid S3 source: {source}")
        tmp_dir = Path(tempfile.mkdtemp(prefix="lakehouse-ingest-"))
        try:
            suffix = Path(key).suffix or ".csv"
            dest = tmp_dir / f"source{suffix}"
            yield _download_s3(bucket, key, dest)
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        return

    if parsed.scheme in ("http", "https"):
        tmp_dir = Path(tempfile.mkdtemp(prefix="lakehouse-ingest-"))
        try:
            suffix = Path(parsed.path).suffix or ".csv"
            dest = tmp_dir / f"source{suffix}"
            yield _download_http(raw, dest)
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        return

    if parsed.scheme == "file":
        candidate = Path(unquote(parsed.path))
    else:
        candidate = None
        for option in _local_candidates(raw):
            if option.exists() and option.is_file():
                candidate = option
                break
        if candidate is None:
            raise SourceResolutionError(
                f"Ingestion source not found: {raw}. Provide an s3://, http(s):// or local file path."
            )

    if not candidate.exists() or not candidate.is_file():
        raise SourceResolutionError(f"Ingestion source is not a readable file: {candidate}")

    size = candidate.stat().st_size
    if MAX_INGEST_BYTES and size > MAX_INGEST_BYTES:
        raise SourceResolutionError(
            f"Source file is {size} bytes which exceeds the ingest limit of {MAX_INGEST_BYTES}"
        )
    yield candidate


def source_display_name(source: str) -> str:
    """Return a log-safe display name for a source (never a local temp path)."""
    parsed = urlparse(source)
    if parsed.scheme in ("s3", "s3a"):
        return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    return os.path.basename(parsed.path or source) or source
