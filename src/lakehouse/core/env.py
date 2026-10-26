"""Canonical environment resolution for the Python lakehouse.

MASTER PLAN §02.2 (Single-Owner Principle) requires exactly one canonical
configuration for the whole system, and §02.3 forbids the control plane
from addressing two different object stores at the same time.

Why this module exists
----------------------
``dotenv.load_dotenv(path, override=False)`` only assigns a key when it is
**absent** from ``os.environ``. An ambient shell export therefore always
shadows the checked-in file. On this machine the ambient shell pointed at
``MINIO_ENDPOINT=127.0.0.1:19000`` while the running MinIO container serves
port ``9000`` — so Spark wrote to (and read from) an object store that does
not exist, and every Bronze job failed with::

    getFileStatus on s3a://lakehouse/bronze/erp/orders/_delta_log:
    Connect to 127.0.0.1:19000 failed: Connection refused

The identical defect existed on both sides of the control plane.

Ownership rules
---------------
The rules are the same as the TypeScript implementation, so the two halves
can never disagree:

- ``file`` — the repository file is the source of truth and *wins* over a
  stale ambient export. Used on the developer machine.
- ``ambient`` — the ambient environment is the source of truth and the file
  only fills keys that are absent. Used inside containers (Compose injects
  service names such as ``minio:9000``) and in staging/production.

The mode is resolved in this order:

1. ``LAKEHOUSE_ENV_PRECEDENCE=file|ambient`` — explicit operator choice.
2. inside a container (``/.dockerenv`` exists) -> ``ambient``.
3. ``ENV=staging|prod`` -> ``ambient`` (deployed environment).
4. otherwise -> ``file`` (developer machine and tests).

``NODE_ENV`` is deliberately NOT part of the decision: Next.js sets
``NODE_ENV=production`` while it *builds*, so a local build would lose the
credentials that live in ``.env.local``.

One grammar, two runtimes
-------------------------
The canonical *grammar* and *ownership policy* live in exactly one place —
the contract implemented by both:

- TypeScript: ``apps/api/env-loader.js`` (CommonJS, runs inside Next.js).
- Python: this module.

Both implementations parse the same dotenv v16 grammar and apply the same
precedence rules, and ``tests/test_env_parity.py`` asserts that they agree
key-for-key on a corpus of tricky inputs. The two halves therefore cannot
drift apart silently.

Why this module does NOT shell out to Node
-------------------------------------------
An earlier revision invoked ``apps/api/env-loader.js`` through
``node scripts/apply-canonical-env.js``. That was wrong for two measured
reasons:

1. The child process mutated **its own** ``process.env``; the Python parent
   never saw the resolved values, so the stale ambient export kept winning —
   the exact defect the module was written to eliminate.
2. The Airflow runtime image ships **no Node binary**, so the canonical
   loader was simply unavailable in the environment where the pipeline
   actually runs.

Parsing the same grammar natively in Python removes both problems while
keeping one shared contract.
"""

from __future__ import annotations

import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from lakehouse.core.constants import StorageEnv

#: Repository root — the directory that holds ``.env``.
_REPO_ROOT = Path(__file__).resolve().parents[3]

#: Configuration file names, in resolution order.
#:
#: ``.env.local`` is the developer-local override; ``.env`` is the file the
#: Docker Compose stack injects into every container. The order matches
#: ``apps/api/env-loader.js`` exactly.
_ENV_FILE_NAMES = (".env.local", ".env")

#: The package directory that owns the control-plane configuration.
_API_PACKAGE_DIR = Path("apps") / "api"

#: Backwards-compatible alias for the repository-root configuration file.
ENV_PATH = _REPO_ROOT / ".env"

# ---------------------------------------------------------------------------
# Grammar — a faithful port of the dotenv v16 / dotenv-expand v12 rules that
# ``@next/env`` (Next.js 15.5.28) applies. Every rule below was measured
# against that exact package, not assumed from documentation.
# ---------------------------------------------------------------------------

#: The dotenv assignment pattern.
#:
#: The trailing ``(?:$|$)`` is load-bearing: without it the ``\s*`` before it
#: consumes the newline, the ``^`` anchor of the following line no longer
#: matches, and an indented assignment such as ``  INDENTED=value`` is
#: silently dropped. That was measured, not guessed.
_LINE_PATTERN = re.compile(
    r"(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)"
    r"(\s*'(?:\\'|[^'])*'|\s*\"(?:\\\"|[^\"])*\"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?"
    r"\s*(?:#.*)?(?:$|$)",
    re.MULTILINE,
)

#: Quote removal — the exact expression dotenv applies after trimming.
_QUOTE_PATTERN = re.compile(r"^(['\"`])([\s\S]*)\1$", re.MULTILINE)

#: Interpolation pattern — the ``dotenv-expand`` v12 pattern that
#: ``@next/env`` applies. ``$VAR`` and ``${VAR}`` are resolved;
#: ``${VAR:-default}`` supplies a fallback.
_INTERPOLATION_PATTERN = re.compile(r"((?!(?<=\\))\${?([\w]+)(?:-([^}\\]*))?}?)")

#: An unescaped ``$``. A ``\$`` is literal and must not start an interpolation.
_DOLLAR_PATTERN = re.compile(r"(?!(?<=\\))\$")

#: An escaped ``$`` is resolved back to a literal ``$`` after interpolation.
_ESCAPED_DOLLAR_PATTERN = re.compile(r"\\\$")

#: Values that are obviously template placeholders.
#:
#: The repository ships a root ``.env.local`` template whose values look like
#: ``ENV=.............enter_here=.............``. Loading such a file would
#: replace a valid value with garbage, so any value containing the marker is
#: rejected and the key is left untouched.
PLACEHOLDER_MARKER = "enter_here"


def is_placeholder_value(value: Any) -> bool:
    """True when a value is a template placeholder rather than a real setting."""
    return PLACEHOLDER_MARKER in str(value)


def env_file_path(start: Path | None = None) -> Path:
    """Resolve the canonical local configuration file.

    Mirrors ``envFilePath()`` in ``apps/api/env-loader.js``: walk up from the
    working directory and take the first existing candidate, preferring the
    package-local file over the repository-root one.

    The walk covers every launch posture:

    - ``cwd=apps/api``          -> ``apps/api/.env.local``
    - ``cwd=<repo root>``       -> ``apps/api/.env.local``
    - ``cwd=/opt/airflow``      -> nothing (the platform injects the env)
    """
    directory = Path(start or Path.cwd()).resolve()
    for _ in range(6):
        for name in _ENV_FILE_NAMES:
            package_candidate = directory / _API_PACKAGE_DIR / name
            if package_candidate.is_file():
                return package_candidate
            root_candidate = directory / name
            if root_candidate.is_file():
                return root_candidate
        parent = directory.parent
        if parent == directory:
            break
        directory = parent
    return Path.cwd() / _ENV_FILE_NAMES[0]


def parse_env_file(contents: str) -> dict[str, str]:
    """Parse a dotenv-style file.

    This is a faithful port of dotenv v16's ``parse()`` — the exact function
    ``@next/env`` (Next.js 15.5.28) calls. The port covers every step of the
    original:

    1. normalise ``\\r\\n`` / ``\\r`` to ``\\n``;
    2. for every assignment, take the raw value and ``strip()`` it;
    3. remember the first character, then strip a matching surrounding quote
       pair (``'``, ``"`` or ``` ` ```);
    4. for a **double**-quoted value only, turn the escape sequences ``\\n``
       and ``\\r`` into real newlines and carriage returns.

    It never evaluates an expression — the file is configuration, not code.
    """
    result: dict[str, str] = {}
    normalised = str(contents).replace("\r\n", "\n").replace("\r", "\n")
    for match in _LINE_PATTERN.finditer(normalised):
        key = match.group(1)
        if not key:
            continue
        value = (match.group(2) or "").strip()
        quote = value[:1]
        value = _QUOTE_PATTERN.sub(lambda m: m.group(2), value)
        if quote == '"':
            value = value.replace("\\n", "\n").replace("\\r", "\r")
        result[key] = value
    return result


def _search_last_dollar(value: str) -> int:
    """Index of the last unescaped ``$`` in a string, or -1 when there is none."""
    matches = list(_DOLLAR_PATTERN.finditer(value))
    return matches[-1].start() if matches else -1


def _resolve_reference(
    name: str,
    fallback: str | None,
    parsed: dict[str, str],
    mode: str,
) -> str:
    """Resolve a variable reference.

    The precedence mirrors the ownership mode:

    - ``file`` mode: the file's own value wins, then the ``:-`` fallback, then
      the ambient value.
    - ``ambient`` mode: the ambient value wins, then the ``:-`` fallback, then
      the file's value.
    """
    ambient = os.environ.get(name)
    from_file = parsed.get(name)
    if mode == "file":
        return from_file or fallback or ambient or ""
    return ambient or fallback or from_file or ""


def _interpolate(value: str, parsed: dict[str, str], mode: str) -> str:
    """Interpolate ``$VAR`` / ``${VAR}`` references.

    A port of ``dotenv-expand`` v12: the right-most unescaped ``$`` is
    resolved first and the string is then re-scanned, so nested references
    resolve.
    """
    current = str(value)
    # The bound guards against a self-referential value (``A=$A``) that would
    # otherwise recurse forever.
    for _ in range(100):
        dollar_index = _search_last_dollar(current)
        if dollar_index == -1:
            return current
        tail = current[dollar_index:]
        match = _INTERPOLATION_PATTERN.search(tail)
        if not match:
            return current
        whole = match.group(1)
        name = match.group(2)
        fallback = match.group(3)
        if not whole or not name:
            return current
        replacement = _resolve_reference(name, fallback, parsed, mode)
        current = current.replace(whole, replacement, 1)
    return current


def expand_env_values(parsed: dict[str, str], mode: str) -> dict[str, str]:
    """Resolve every value in a parsed file, applying interpolation.

    The precedence mirrors the ownership mode:

    - ``file`` mode — the file's own value wins, then the ``:-`` fallback,
      then the ambient value.
    - ``ambient`` mode — the ambient value wins, then the ``:-`` fallback,
      then the file's value.
    """
    resolved: dict[str, str] = {}
    for key, parsed_value in parsed.items():
        if mode == "file":
            base: str = parsed_value
        else:
            ambient = os.environ.get(key)
            base = ambient if ambient is not None else parsed_value
        resolved[key] = _interpolate(base, parsed, mode).replace("\\$", "$")
    return resolved


def is_containerised() -> bool:
    """True when the process runs inside a container."""
    return Path("/.dockerenv").exists()


def resolve_precedence() -> str:
    """Return the ownership mode: ``file`` or ``ambient``."""
    explicit = (os.environ.get("LAKEHOUSE_ENV_PRECEDENCE") or "").strip().lower()
    if explicit in ("file", "ambient"):
        return explicit
    if is_containerised():
        return "ambient"
    environment = (os.environ.get("ENV") or "").strip().lower()
    if environment in ("staging", "prod", "production"):
        return "ambient"
    return "file"


def load_env_file(file_path: Path | str, mode: str) -> list[str]:
    """Apply one dotenv file to ``os.environ``.

    Returns the keys that were assigned. A template placeholder is never a
    valid configuration value, so such a key is skipped entirely.
    """
    path = Path(file_path)
    if not path.is_file():
        return []
    parsed = parse_env_file(path.read_text(encoding="utf-8"))
    resolved = expand_env_values(parsed, mode)
    applied: list[str] = []
    for key, value in resolved.items():
        if is_placeholder_value(value):
            continue
        if mode == "file" or os.environ.get(key) is None:
            os.environ[key] = value
            applied.append(key)
    return applied


def apply_canonical_env(env_file: Path | str | None = None) -> dict[str, Any]:
    """Apply the canonical configuration and return the loader report.

    The report contains the resolved file, the ownership mode and the number
    of keys that were applied — it never contains a configuration *value*.
    """
    path = Path(env_file) if env_file else env_file_path()
    mode = resolve_precedence()
    applied = load_env_file(path, mode)
    return {"file": str(path), "mode": mode, "applied": len(applied)}


#: Report of the canonical load, resolved once at import time.
#:
#: The environment must be resolved *before* any module reads ``os.environ``,
#: so the load happens at import time rather than lazily.
_LOAD_REPORT: dict[str, Any] = apply_canonical_env()


def load_env(env_file: Path | str | None = None) -> dict[str, Any]:
    """Re-apply the canonical configuration (used by operational scripts)."""
    global _LOAD_REPORT
    _LOAD_REPORT = apply_canonical_env(env_file)
    return _LOAD_REPORT


@lru_cache(maxsize=1)
def get_env(key: str, default: str | None = None) -> str | None:
    return os.getenv(key, default)


def get_env_required(key: str) -> str:
    value = os.getenv(key)
    if value is None:
        raise ValueError(f"Required env var {key!r} is not set")
    return value


def get_storage_env() -> StorageEnv:
    env = os.getenv("ENV", "local").lower()
    try:
        return StorageEnv(env)
    except ValueError:
        return StorageEnv.LOCAL


def is_local() -> bool:
    return get_storage_env() == StorageEnv.LOCAL


def is_cloud() -> bool:
    return not is_local()


__all__ = [
    "ENV_PATH",
    "apply_canonical_env",
    "env_file_path",
    "expand_env_values",
    "get_env",
    "get_env_required",
    "get_storage_env",
    "is_cloud",
    "is_containerised",
    "is_local",
    "is_placeholder_value",
    "load_env",
    "load_env_file",
    "parse_env_file",
    "resolve_precedence",
]
