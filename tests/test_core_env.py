from __future__ import annotations

import os

from lakehouse.core.constants import StorageEnv
from lakehouse.core.env import get_env, get_env_required, get_storage_env, is_local


class TestGetEnv:
    def setup_method(self) -> None:
        get_env.cache_clear()

    def test_get_env_returns_value(self) -> None:
        os.environ["TEST_AUDIT_VAR"] = "hello"
        try:
            assert get_env("TEST_AUDIT_VAR") == "hello"
        finally:
            os.environ.pop("TEST_AUDIT_VAR", None)

    def test_get_env_with_default(self) -> None:
        assert get_env("NONEXISTENT_VAR", "default") == "default"

    def test_get_env_required_raises(self) -> None:
        os.environ.pop("REQUIRED_TEST_VAR", None)
        try:
            get_env.cache_clear()
            get_env_required("REQUIRED_TEST_VAR")
            raise AssertionError("Should have raised")
        except ValueError as e:
            assert "REQUIRED_TEST_VAR" in str(e)


class TestStorageEnv:
    def setup_method(self) -> None:
        get_env.cache_clear()
        os.environ.pop("ENV", None)

    def test_is_local_true(self) -> None:
        os.environ["ENV"] = "local"
        get_env.cache_clear()
        assert is_local() is True

    def test_is_local_false(self) -> None:
        os.environ["ENV"] = "aws"
        get_env.cache_clear()
        assert is_local() is False

    def test_get_storage_env_local(self) -> None:
        os.environ["ENV"] = "local"
        get_env.cache_clear()
        assert get_storage_env() == StorageEnv.LOCAL

    def test_get_storage_env_gcp(self) -> None:
        os.environ["ENV"] = "gcp"
        get_env.cache_clear()
        assert get_storage_env() == StorageEnv.GCP

    def test_get_storage_env_invalid_returns_local(self) -> None:
        os.environ["ENV"] = "unknown_env"
        get_env.cache_clear()
        assert get_storage_env() == StorageEnv.LOCAL
