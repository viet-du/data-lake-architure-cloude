from __future__ import annotations
import os
from functools import lru_cache
from pathlib import Path
from dotenv import load_dotenv
from lakehouse.core.constants import StorageEnv
_ENV_PATH = Path(__file__).resolve().parents[3] / '.env'
load_dotenv(_ENV_PATH, override=False)

def load_env(env_file: Path | None=None) -> None:
    path = env_file or _ENV_PATH
    if path.exists():
        load_dotenv(path, override=False)

@lru_cache(maxsize=1)
def get_env(key: str, default: str | None=None) -> str | None:
    return os.getenv(key, default)

def get_env_required(key: str) -> str:
    value = os.getenv(key)
    if value is None:
        raise ValueError(f'Required env var {key!r} is not set')
    return value

def get_storage_env() -> StorageEnv:
    env = os.getenv('ENV', 'local').lower()
    try:
        return StorageEnv(env)
    except ValueError:
        return StorageEnv.LOCAL

def is_local() -> bool:
    return get_storage_env() == StorageEnv.LOCAL

def is_cloud() -> bool:
    return not is_local()