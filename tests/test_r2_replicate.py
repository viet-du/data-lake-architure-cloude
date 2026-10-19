"""Tests for the MinIO → Cloudflare R2 sync logic.

We don't hit real MinIO or R2 here. Instead we mock the boto3 S3 client
so the sync loop is exercised end-to-end with deterministic data.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from lakehouse.sync import r2_replicate
from lakehouse.sync.r2_replicate import (
    REPLICATE_BUCKETS,
    SyncStats,
    _build_s3_client,
    _load_state,
    _save_state,
    run_once,
    sync_bucket,
)

# ─── fixtures ─────────────────────────────────────────────────


@pytest.fixture
def tmp_state_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Redirect STATE_DIR/STATE_FILE to a tmp path for test isolation."""
    state = tmp_path / "state"
    state.mkdir()
    monkeypatch.setattr(r2_replicate, "STATE_DIR", state)
    monkeypatch.setattr(r2_replicate, "STATE_FILE", state / "last_sync.json")
    return state


def _make_obj(key: str, size: int, mtime_epoch: float) -> dict:
    """Build a fake S3 object summary as returned by list_objects_v2."""
    return {
        "Key": key,
        "Size": size,
        "LastModified": datetime.fromtimestamp(mtime_epoch, tz=timezone.utc),
    }


# ─── tests: state file round-trip ─────────────────────────────


def test_state_initially_empty(tmp_state_dir: Path) -> None:
    """On first run, every bucket is at epoch 0 (sync everything)."""
    state = _load_state()
    assert state == dict.fromkeys(REPLICATE_BUCKETS, 0.0)


def test_state_round_trip(tmp_state_dir: Path) -> None:
    """Save then load should preserve values."""
    _save_state({"bronze": 123.0, "silver": 456.0})
    state = _load_state()
    assert state == {"bronze": 123.0, "silver": 456.0}


def test_state_handles_missing_file(tmp_state_dir: Path) -> None:
    """If state file is deleted, next load returns fresh defaults."""
    _save_state({"bronze": 999.0})
    tmp_state_dir.joinpath("last_sync.json").unlink()
    state = _load_state()
    assert state["bronze"] == 0.0


# ─── tests: SyncStats dataclass ───────────────────────────────


def test_sync_stats_duration_zero_when_unfinished() -> None:
    """duration_s() should be 0 if started_at/finished_at are None."""
    s = SyncStats(bucket="bronze")
    assert s.duration_s() == 0.0


def test_sync_stats_duration_computed() -> None:
    """duration_s() returns the diff between started_at and finished_at."""
    s = SyncStats(
        bucket="bronze",
        started_at=datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
        finished_at=datetime(2026, 1, 1, 12, 0, 30, tzinfo=timezone.utc),
    )
    assert s.duration_s() == 30.0


# ─── tests: sync_bucket with mocked S3 client ─────────────────


def _mock_s3_with_objects(
    objects: list[dict],
    dst_has: dict[str, bool] | None = None,
    src_objects_for_size: list[dict] | None = None,
) -> MagicMock:
    """Build a mock S3 client with a paginated list_objects_v2 response.

    dst_has: keys that "exist" in the destination bucket (for skip-already-synced
    test). Once we call copy() to a key, we also mark it as existing in dst.
    src_objects_for_size: the source's object list, so we can look up the true
    size when a copy() lands. If None, defaults to ``objects`` (the dst mock
    usually represents the dst, but for tests that wire the same mock as both
    src and dst, this is the same list).
    """
    client = MagicMock()
    paginator = MagicMock()
    paginator.paginate.return_value = [{"Contents": objects}] if objects else [{}]
    client.get_paginator.return_value = paginator

    size_lookup = src_objects_for_size if src_objects_for_size is not None else objects

    # Track which keys have been "copied" to dst (stateful across calls)
    dst_state: dict[str, dict] = {}
    if dst_has:
        for k in dst_has:
            dst_state[k] = {"ContentLength": 100, "LastModified": datetime.now(timezone.utc)}

    # copy() always succeeds, and marks the key as existing in dst afterward
    def _copy(*args, **kwargs):  # noqa: ARG001
        # boto3 S3 client.copy() takes (CopySource, Bucket, Key) as positional
        copy_source = kwargs.get("CopySource")
        if copy_source is None and len(args) >= 1:
            copy_source = args[0]
        if isinstance(copy_source, dict):
            key = copy_source["Key"]
            size = next((o["Size"] for o in size_lookup if o["Key"] == key), 0)
            dst_state[key] = {"ContentLength": size, "LastModified": datetime.now(timezone.utc)}
        return {}

    client.copy.side_effect = _copy

    # head_object: 404 if not in dst, else return size + modtime
    def head_object(Bucket: str, Key: str) -> dict:  # noqa: ARG001, N803
        if Key in dst_state:
            return dst_state[Key]
        from botocore.exceptions import ClientError
        raise ClientError({"Error": {"Code": "404"}}, "HeadObject")

    client.head_object.side_effect = head_object
    return client


def test_sync_bucket_copies_new_objects(tmp_state_dir: Path) -> None:
    """Objects newer than last_sync get copied to dst."""
    src_objects = [
        _make_obj("a.parquet", 100, 1000.0),
        _make_obj("b.parquet", 200, 1500.0),
    ]
    src = _mock_s3_with_objects(src_objects)
    # dst needs to know src's sizes (so post-copy head_object returns real size)
    dst = _mock_s3_with_objects([], src_objects_for_size=src_objects)
    stats = sync_bucket(src, "bronze", dst, "bronze", since_epoch=500.0)

    assert stats.objects_scanned == 2
    assert stats.objects_copied == 2
    assert stats.objects_skipped == 0
    assert stats.errors == 0
    assert stats.bytes_copied == 300


def test_sync_bucket_skips_old_objects(tmp_state_dir: Path) -> None:
    """Objects older than last_sync are not scanned at all."""
    src = _mock_s3_with_objects(
        [
            _make_obj("old.parquet", 100, 100.0),  # before since_epoch=500
        ]
    )
    dst = _mock_s3_with_objects([])
    stats = sync_bucket(src, "bronze", dst, "bronze", since_epoch=500.0)

    assert stats.objects_scanned == 0
    assert stats.objects_copied == 0


def test_sync_bucket_skips_already_synced(tmp_state_dir: Path) -> None:
    """If dst has the same object with same size+modtime, skip the copy."""
    same_mtime = 2000.0
    src_objects = [_make_obj("c.parquet", 100, same_mtime)]
    src = _mock_s3_with_objects(src_objects)
    # dst already has 'c.parquet' with the same size + mtime → should be skipped
    dst = MagicMock()
    dst.get_paginator.return_value.paginate.return_value = [{}]
    existing = {"ContentLength": 100, "LastModified": datetime.fromtimestamp(same_mtime, tz=timezone.utc)}
    dst.head_object.return_value = existing
    dst.copy.return_value = {}

    stats = sync_bucket(src, "bronze", dst, "bronze", since_epoch=500.0)

    assert stats.objects_scanned == 1
    assert stats.objects_copied == 0
    assert stats.objects_skipped == 1
    assert dst.copy.call_count == 0


def test_sync_bucket_counts_errors(tmp_state_dir: Path) -> None:
    """A copy() failure increments errors, doesn't crash the run."""
    src = MagicMock()
    paginator = MagicMock()
    paginator.paginate.return_value = [
        {"Contents": [_make_obj("bad.parquet", 100, 2000.0)]}
    ]
    src.get_paginator.return_value = paginator

    # dst.copy raises the error (this is what _copy_object calls)
    dst = MagicMock()
    dst.get_paginator.return_value.paginate.return_value = [{}]
    dst.head_object.side_effect = RuntimeError("simulated R2 500")
    dst.copy.side_effect = RuntimeError("simulated R2 500")

    stats = sync_bucket(src, "bronze", dst, "bronze", since_epoch=500.0)

    assert stats.errors == 1
    assert stats.objects_copied == 0


# ─── tests: run_once end-to-end (mocked) ──────────────────────


def test_run_once_syncs_all_buckets(
    tmp_state_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """All 4 buckets in REPLICATE_BUCKETS get processed in one run."""
    # Stub env vars
    monkeypatch.setenv("R2_ACCOUNT_ID", "test-account-1234")
    monkeypatch.setenv("R2_ACCESS_KEY", "test-access")
    monkeypatch.setenv("R2_SECRET_KEY", "test-secret")
    monkeypatch.setenv("MINIO_ENDPOINT", "http://minio:9000")
    monkeypatch.setenv("MINIO_ACCESS_KEY", "minioadmin")
    monkeypatch.setenv("MINIO_SECRET_KEY", "minioadmin")

    # Mock the S3 client factory
    src_client = _mock_s3_with_objects([_make_obj("x.parquet", 50, 2000.0)])
    dst_client = _mock_s3_with_objects([])

    with patch.object(r2_replicate, "_build_s3_client", return_value=src_client) as factory:
        # The factory is called twice per bucket (src + dst). Return src_client
        # for src calls and dst_client for dst calls, by inspecting the endpoint.
        def side_effect(*, endpoint: str, **kwargs):  # noqa: ARG001
            return dst_client if "r2.cloudflarestorage.com" in endpoint else src_client

        factory.side_effect = side_effect

        results = run_once()

    # All 4 buckets processed
    assert set(results.keys()) == set(REPLICATE_BUCKETS)

    # State file was updated
    state = _load_state()
    assert all(state[b] > 0 for b in REPLICATE_BUCKETS)


# ─── tests: _build_s3_client ──────────────────────────────────


def test_build_s3_client_uses_supplied_credentials() -> None:
    """The factory passes through endpoint + keys to boto3."""
    with patch("lakehouse.sync.r2_replicate.boto3.client") as client:
        _build_s3_client(
            endpoint="http://minio:9000",
            key="my-key",
            secret="my-secret",
            region="us-east-1",
        )
        client.assert_called_once()
        kwargs = client.call_args.kwargs
        assert kwargs["endpoint_url"] == "http://minio:9000"
        assert kwargs["aws_access_key_id"] == "my-key"
        assert kwargs["aws_secret_access_key"] == "my-secret"
        assert kwargs["region_name"] == "us-east-1"
        # Signature v4 is required for R2
        assert kwargs["config"].signature_version == "s3v4"
        # Retries are configured (5 attempts)
        assert kwargs["config"].retries["max_attempts"] == 5


# ─── tests: CLI entry point ───────────────────────────────────


def test_cli_one_shot_exits_with_error_count(capsys: pytest.CaptureFixture) -> None:
    """The CLI returns 1 if any errors, 0 otherwise."""
    # Simulate by calling main with no daemon, with patched run_once returning errors
    with patch.object(
        r2_replicate,
        "run_once",
        return_value={
            "bronze": SyncStats(bucket="bronze", errors=1),
            "silver": SyncStats(bucket="silver"),
        },
    ):
        rc = r2_replicate.main([])  # one-shot mode
    assert rc == 1
    captured = capsys.readouterr()
    assert "1 errors" in captured.err


def test_cli_one_shot_clean_returns_zero(capsys: pytest.CaptureFixture) -> None:
    """No errors → exit code 0."""
    with patch.object(
        r2_replicate,
        "run_once",
        return_value={b: SyncStats(bucket=b) for b in REPLICATE_BUCKETS},
    ):
        rc = r2_replicate.main([])
    assert rc == 0
    captured = capsys.readouterr()
    assert "0 errors" in captured.err
