from __future__ import annotations

from lakehouse.core.env import get_env
from lakehouse.core.spark import _get_s3a_configs


def _clear_s3_environment(monkeypatch) -> None:
    for name in (
        "S3_ENDPOINT",
        "S3_ACCESS_KEY",
        "S3_SECRET_KEY",
        "S3_REGION",
        "S3_USE_SSL",
        "S3_PATH_STYLE_ACCESS",
        "MINIO_ENDPOINT",
        "MINIO_ACCESS_KEY",
        "MINIO_SECRET_KEY",
        "MINIO_SECURE",
    ):
        monkeypatch.delenv(name, raising=False)
    get_env.cache_clear()


def test_s3a_config_keeps_local_minio_defaults(monkeypatch) -> None:
    _clear_s3_environment(monkeypatch)
    try:
        config = _get_s3a_configs()
    finally:
        get_env.cache_clear()

    assert config["spark.hadoop.fs.s3a.endpoint"] == "localhost:9000"
    assert config["spark.hadoop.fs.s3a.access.key"] == "minioadmin"
    assert config["spark.hadoop.fs.s3a.secret.key"] == "minioadmin"
    assert config["spark.hadoop.fs.s3a.connection.ssl.enabled"] == "false"
    assert config["spark.hadoop.fs.s3a.endpoint.region"] == "us-east-1"


def test_s3a_config_supports_cloudflare_r2(monkeypatch) -> None:
    _clear_s3_environment(monkeypatch)
    monkeypatch.setenv(
        "S3_ENDPOINT",
        "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com",
    )
    monkeypatch.setenv("S3_ACCESS_KEY", "r2-access-key")
    monkeypatch.setenv("S3_SECRET_KEY", "r2-secret-key")
    get_env.cache_clear()
    try:
        config = _get_s3a_configs()
    finally:
        get_env.cache_clear()

    assert (
        config["spark.hadoop.fs.s3a.endpoint"]
        == "0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com"
    )
    assert config["spark.hadoop.fs.s3a.endpoint.region"] == "auto"
    assert config["spark.hadoop.fs.s3a.connection.ssl.enabled"] == "true"
    assert config["spark.hadoop.fs.s3a.path.style.access"] == "true"
    assert config["spark.hadoop.fs.s3a.access.key"] == "r2-access-key"
    assert config["spark.hadoop.fs.s3a.secret.key"] == "r2-secret-key"


def test_s3a_config_rejects_non_endpoint_paths(monkeypatch) -> None:
    _clear_s3_environment(monkeypatch)
    monkeypatch.setenv("S3_ENDPOINT", "https://storage.example.com/path")
    get_env.cache_clear()
    try:
        try:
            _get_s3a_configs()
        except ValueError as error:
            assert "S3_ENDPOINT" in str(error)
        else:
            raise AssertionError("Expected invalid S3 endpoint to be rejected")
    finally:
        get_env.cache_clear()


def test_s3a_config_requires_r2_credentials(monkeypatch) -> None:
    _clear_s3_environment(monkeypatch)
    monkeypatch.setenv("S3_ENDPOINT", "https://storage.example.com")
    get_env.cache_clear()
    try:
        try:
            _get_s3a_configs()
        except ValueError as error:
            assert "S3_ACCESS_KEY and S3_SECRET_KEY" in str(error)
        else:
            raise AssertionError("Expected missing R2 credentials to be rejected")
    finally:
        get_env.cache_clear()
