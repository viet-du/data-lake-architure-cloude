"""MinIO → Cloudflare R2 sync.

Mirrors newly-written MinIO objects to R2 (the durable cold tier).
Spark writes batch output to R2 directly (via S3A); this sync handles
the streaming checkpoint + any in-cluster MinIO state that needs to
survive a local container restart.

Usage:
    # One-shot sync
    python -m lakehouse.sync.r2_replicate

    # Continuous (every 5 minutes)
    python -m lakehouse.sync.r2_replicate --daemon --interval 300

    # Only one bucket
    python -m lakehouse.sync.r2_replicate --bucket bronze
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
import time
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from lakehouse.core.env import get_env

logger = logging.getLogger(__name__)

# Buckets we replicate. Keep in sync with infra/r2/lifecycle-*.json
REPLICATE_BUCKETS = ("bronze", "silver", "gold", "scripts")

# State file: last sync time per bucket. Persists across restarts.
STATE_DIR = Path("/tmp/lakehouse-r2-sync")
STATE_FILE = STATE_DIR / "last_sync.json"


@dataclass
class SyncStats:
    """Stats for one sync run. Reported at the end."""

    bucket: str
    objects_scanned: int = 0
    objects_copied: int = 0
    objects_skipped: int = 0
    bytes_copied: int = 0
    errors: int = 0
    started_at: datetime | None = None
    finished_at: datetime | None = None

    def duration_s(self) -> float:
        if not self.started_at or not self.finished_at:
            return 0.0
        return (self.finished_at - self.started_at).total_seconds()


def _build_s3_client(*, endpoint: str, key: str, secret: str, region: str = "us-east-1") -> boto3.client:  # type: ignore[name-defined]
    """Build an S3 client. Works for both MinIO and R2."""
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=key,
        aws_secret_access_key=secret,
        config=Config(
            signature_version="s3v4",
            retries={"max_attempts": 5, "mode": "adaptive"},
            connect_timeout=10,
            read_timeout=60,
        ),
        region_name=region,
    )


def _load_state() -> dict[str, float]:
    """Load last-sync time per bucket. Returns epoch seconds, or 0 if never synced."""
    if not STATE_FILE.exists():
        return dict.fromkeys(REPLICATE_BUCKETS, 0.0)
    import json
    return json.loads(STATE_FILE.read_text())


def _save_state(state: dict[str, float]) -> None:
    """Persist last-sync time per bucket."""
    import json
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2))


def _list_objects_newer_than(
    client, bucket: str, since_epoch: float
) -> Iterator[dict]:
    """Yield objects modified after `since_epoch` (paginated)."""
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket):
        for obj in page.get("Contents", []):
            if obj["LastModified"].timestamp() > since_epoch:
                yield obj


def _copy_object(src_client, src_bucket: str, key: str, dst_client, dst_bucket: str) -> int:
    """Copy one object from src to dst. Returns bytes copied."""
    copy_source = {"Bucket": src_bucket, "Key": key}
    dst_client.copy(copy_source, dst_bucket, key)
    # Head to get size (cheaper than re-listing)
    head = dst_client.head_object(Bucket=dst_bucket, Key=key)
    return head["ContentLength"]


def sync_bucket(
    src_client, src_bucket: str, dst_client, dst_bucket: str, since_epoch: float
) -> SyncStats:
    """Sync all new objects in one bucket."""
    stats = SyncStats(bucket=src_bucket, started_at=datetime.now(timezone.utc))

    for obj in _list_objects_newer_than(src_client, src_bucket, since_epoch):
        stats.objects_scanned += 1
        try:
            # Skip if same size and modtime (cheap "already there" check)
            try:
                dst_head = dst_client.head_object(Bucket=dst_bucket, Key=obj["Key"])
                if (
                    dst_head["ContentLength"] == obj["Size"]
                    and abs(
                        dst_head["LastModified"].timestamp() - obj["LastModified"].timestamp()
                    )
                    < 1
                ):
                    stats.objects_skipped += 1
                    continue
            except ClientError as e:
                if e.response["Error"]["Code"] != "404":
                    raise
                # 404 = object doesn't exist in dst yet, proceed to copy

            bytes_copied = _copy_object(src_client, src_bucket, obj["Key"], dst_client, dst_bucket)
            stats.objects_copied += 1
            stats.bytes_copied += bytes_copied
            logger.info("Copied %s/%s → %s/%s (%d bytes)", src_bucket, obj["Key"], dst_bucket, obj["Key"], bytes_copied)
        except Exception as e:  # noqa: BLE001
            stats.errors += 1
            logger.exception("Failed to copy %s/%s: %s", src_bucket, obj["Key"], e)

    stats.finished_at = datetime.now(timezone.utc)
    return stats


def run_once() -> dict[str, SyncStats]:
    """One full sync pass across all configured buckets.

    Returns a dict of bucket → stats for the run.
    """
    # MinIO (in-cluster)
    minio_endpoint = get_env("MINIO_ENDPOINT", "http://lake-minio:9000")
    minio_access = get_env_required_fallback("MINIO_ACCESS_KEY", "minioadmin")
    minio_secret = get_env_required_fallback("MINIO_SECRET_KEY", "minioadmin")
    minio_client = _build_s3_client(
        endpoint=minio_endpoint,
        key=minio_access,
        secret=minio_secret,
        region="us-east-1",
    )

    # R2 (durable cold tier)
    r2_account = get_env_required("R2_ACCOUNT_ID")
    r2_access = get_env_required("R2_ACCESS_KEY")
    r2_secret = get_env_required("R2_SECRET_KEY")
    r2_endpoint = f"https://{r2_account}.r2.cloudflarestorage.com"
    r2_client = _build_s3_client(
        endpoint=r2_endpoint,
        key=r2_access,
        secret=r2_secret,
        region="auto",  # R2 ignores region
    )

    state = _load_state()
    results: dict[str, SyncStats] = {}

    for bucket in REPLICATE_BUCKETS:
        last_sync = state.get(bucket, 0.0)
        logger.info("Syncing bucket=%s since_epoch=%s", bucket, last_sync)
        try:
            stats = sync_bucket(minio_client, bucket, r2_client, bucket, last_sync)
            state[bucket] = time.time()
            results[bucket] = stats
            logger.info(
                "Bucket %s: scanned=%d copied=%d skipped=%d errors=%d bytes=%d duration=%.1fs",
                bucket,
                stats.objects_scanned,
                stats.objects_copied,
                stats.objects_skipped,
                stats.errors,
                stats.bytes_copied,
                stats.duration_s(),
            )
        except Exception as e:  # noqa: BLE001
            logger.exception("Bucket %s sync failed: %s", bucket, e)
            results[bucket] = SyncStats(bucket=bucket, errors=1)

    _save_state(state)
    return results


def get_env_required(key: str) -> str:
    """Get a required env var or raise a clear error."""
    val = os.getenv(key)
    if not val:
        raise RuntimeError(
            f"Required env var {key!r} is not set. "
            "Set it in the local git-ignored `.env` file (see docs/cloud/r2/SETUP.md §5)."
        )
    return val


def get_env_required_fallback(key: str, fallback: str) -> str:
    """Get a required env var, but fall back to a default if unset (for local dev)."""
    return os.getenv(key) or fallback


def main(argv: list[str] | None = None) -> int:
    """CLI entry point. Supports one-shot and daemon modes."""
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "info").upper(),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    parser = argparse.ArgumentParser(description="MinIO → R2 sync")
    parser.add_argument("--daemon", action="store_true", help="Run continuously")
    parser.add_argument("--interval", type=int, default=300, help="Sync interval in seconds (default: 300)")
    parser.add_argument("--bucket", choices=REPLICATE_BUCKETS, help="Sync only this bucket (default: all)")
    args = parser.parse_args(argv)

    if args.daemon:
        logger.info("Starting R2 sync daemon (interval=%ds)", args.interval)
        while True:
            try:
                results = run_once()
                total_copied = sum(s.objects_copied for s in results.values())
                total_errors = sum(s.errors for s in results.values())
                if total_errors:
                    logger.warning("Daemon sync had %d errors", total_errors)
                if total_copied:
                    logger.info("Daemon synced %d objects", total_copied)
            except Exception as e:  # noqa: BLE001
                logger.exception("Daemon sync iteration failed: %s", e)
            time.sleep(args.interval)
    else:
        results = run_once()
        total_copied = sum(s.objects_copied for s in results.values())
        total_errors = sum(s.errors for s in results.values())
        print(
            f"Sync complete: copied {total_copied} objects, {total_errors} errors",
            file=sys.stderr,
        )
        return 1 if total_errors else 0


if __name__ == "__main__":
    sys.exit(main())
