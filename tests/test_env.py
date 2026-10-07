import os
from lakehouse.core.env import get_env, get_storage_env, is_local
from lakehouse.core.constants import StorageEnv

class TestEnv:

    def setup_method(self) -> None:
        from lakehouse.core.env import get_env
        get_env.cache_clear()

    def test_get_env_with_default(self) -> None:
        os.environ['TEST_VAR'] = 'value123'
        assert get_env('TEST_VAR') == 'value123'
        del os.environ['TEST_VAR']

    def test_get_env_default(self) -> None:
        os.environ.pop('NON_EXISTENT_VAR', None)
        assert get_env('NON_EXISTENT_VAR', 'default') == 'default'

    def test_is_local(self) -> None:
        os.environ['ENV'] = 'local'
        from lakehouse.core.env import get_env
        get_env.cache_clear()
        assert is_local() is True

    def test_get_storage_env(self) -> None:
        os.environ['ENV'] = 'gcp'
        from lakehouse.core.env import get_env
        get_env.cache_clear()
        assert get_storage_env() == StorageEnv.GCP