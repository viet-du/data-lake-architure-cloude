from __future__ import annotations
from lakehouse.core.constants import Layer, StorageEnv
from lakehouse.core.env import get_env, get_storage_env, is_local

class LakePaths:

    def __init__(self, env: StorageEnv | None=None) -> None:
        self.env = env or get_storage_env()
        self._set_protocols()

    def _set_protocols(self) -> None:
        if self.env == StorageEnv.LOCAL:
            self._protocol = 's3a'
            self._default_bucket_prefix = ''
        elif self.env == StorageEnv.AWS:
            self._protocol = 's3a'
            self._default_bucket_prefix = ''
        elif self.env == StorageEnv.GCP:
            self._protocol = 'gs'
            self._default_bucket_prefix = ''
        elif self.env == StorageEnv.AZURE:
            self._protocol = 'abfs'
            self._default_bucket_prefix = ''
        else:
            self._protocol = 's3a'
            self._default_bucket_prefix = ''

    def bronze(self, sub_path: str='') -> str:
        return self._layer_path(Layer.BRONZE, sub_path)

    def silver(self, sub_path: str='') -> str:
        return self._layer_path(Layer.SILVER, sub_path)

    def gold(self, sub_path: str='') -> str:
        return self._layer_path(Layer.GOLD, sub_path)

    def checkpoint(self, layer: Layer, sub_path: str) -> str:
        if layer == Layer.BRONZE:
            base = self.bronze('')
        elif layer == Layer.SILVER:
            base = self.silver('')
        else:
            base = self.gold('')
        return f'{base}{sub_path}/_checkpoints/'

    def _layer_path(self, layer: Layer, sub_path: str) -> str:
        bucket = layer.value
        sub = sub_path.strip('/') if sub_path else ''
        base = f'{self._protocol}://{bucket}/'
        return f'{base}{sub}/' if sub else base

    @property
    def protocol(self) -> str:
        return self._protocol

def get_default_paths() -> LakePaths:
    return LakePaths()