"""Parity between the Python and TypeScript canonical environment loaders.

MASTER PLAN §02.2 (Single-Owner Principle) requires one canonical
configuration. That contract is implemented twice — once in Python
(:mod:`lakehouse.core.env`) and once in TypeScript
(``apps/api/env-loader.js``) — because the two runtimes cannot share a
process. A duplicated implementation is only safe if the two halves are
*provably* equivalent.

This module proves that equivalence by running the **actual TypeScript
loader** over a corpus of tricky dotenv inputs and comparing its output to
the Python parser, key-for-key and value-for-value.

The TypeScript side is executed through Node. When Node is unavailable the
comparison is skipped with an explicit reason rather than silently passing —
a skipped test is honest, a false pass is not.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

from lakehouse.core.env import (
    expand_env_values,
    is_placeholder_value,
    parse_env_file,
)

_REPO_ROOT = Path(__file__).resolve().parents[1]
_LOADER_JS = _REPO_ROOT / "apps" / "api" / "env-loader.js"

_NODE = shutil.which("node")

requires_node = pytest.mark.skipif(
    _NODE is None,
    reason="Node is unavailable; the TypeScript half of the parity contract cannot be executed.",
)


#: The shared corpus. Every case was chosen because it exercises a rule that
#: a naive line-splitter gets wrong.
CORPUS: dict[str, str] = {
    "plain": "PLAIN=value\n",
    "comment_line": "# a comment\nPLAIN=value\n",
    "blank_lines": "\n\nPLAIN=value\n\n",
    "exported": "export EXPORTED=exported-value\n",
    "double_quoted": 'QUOTED="quoted value"\n',
    "single_quoted": "SINGLE='single value'\n",
    "backtick_quoted": "TICK=`tick value`\n",
    "trailing_comment": "WITH_COMMENT=value # trailing comment\n",
    "hash_no_space": "HASH_NO_SPACE=value#nospace\n",
    "colon_separator": "COLON_SEP: colon value\n",
    "spaces_around_equals": "SPACED = spaced value\n",
    "url_value": "URL=a=b=c\n",
    "empty_value": "EMPTY=\n",
    "no_separator": "NO_EQUALS\n",
    "key_with_spaces": "NOT_A_KEY = 1\n",
    "key_with_dash": "HAS-DASH=dashvalue\n",
    "key_with_dot": "DOT.KEY=dotvalue\n",
    "indented": "  INDENTED=indented-value  \n",
    "crlf": "CRLF=crlf-value\r\nSECOND=second-value\r\n",
    "interpolation": "BASE=base-value\nREF=$BASE\nBRACED=${BASE}\n",
    "interpolation_default": "MISSING=${NOT_SET:-fallback}\n",
    "escaped_dollar": "ESCAPED=\\$BASE\n",
    "expression_looking": "DANGEROUS=$(rm -rf /)\n",
    "placeholder": "ENV=.............enter_here=.............\n",
    "multiline_value": 'MULTI="line1\nline2"\n',
    "duplicate_key": "DUP=first\nDUP=second\n",
    "numeric_value": "NUM=42\n",
    "quoted_hash": 'QUOTED_HASH="value # not a comment"\n',
}


def _run_node_loader(contents: str, mode: str) -> dict[str, str]:
    """Run the TypeScript loader over ``contents`` and return its resolution."""
    if _NODE is None:  # pragma: no cover - guarded by the skip marker
        raise RuntimeError("Node is unavailable")

    script = f"""
const loader = require({json.dumps(str(_LOADER_JS))});
const parsed = loader.parseEnvFile({json.dumps(contents)});
const resolved = loader.expandEnvValues(parsed, {json.dumps(mode)});
process.stdout.write(JSON.stringify(resolved));
"""
    completed = subprocess.run(
        [_NODE, "-e", script],
        cwd=str(_REPO_ROOT),
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(f"node failed: {completed.stderr.strip()}")
    return json.loads(completed.stdout)


class TestParserParity:
    """The two parsers must agree on what the file *contains*."""

    @requires_node
    @pytest.mark.parametrize("case_name", sorted(CORPUS))
    def test_parse_matches_typescript(self, case_name: str) -> None:
        contents = CORPUS[case_name]
        expected = _run_node_loader(contents, "file")
        # The TypeScript loader returns the *expanded* values; the raw parse
        # is what `parse_env_file` produces. Comparing the expansion is the
        # contract that actually matters, so both sides are expanded.
        actual = expand_env_values(parse_env_file(contents), "file")
        assert actual == expected, f"parity mismatch for case {case_name!r}"


class TestPlaceholderPolicy:
    """A placeholder is never a valid configuration value."""

    def test_placeholder_is_detected(self) -> None:
        assert is_placeholder_value(".............enter_here=.............") is True
        assert is_placeholder_value("real-value") is False

    def test_placeholder_is_never_applied(self, tmp_path: Path) -> None:
        from lakehouse.core.env import load_env_file

        target = tmp_path / ".env.local"
        target.write_text("PROBE_KEY=.............enter_here=.............\n", encoding="utf-8")
        os.environ.pop("PROBE_KEY", None)
        try:
            applied = load_env_file(target, "file")
            assert "PROBE_KEY" not in applied
            assert "PROBE_KEY" not in os.environ
        finally:
            os.environ.pop("PROBE_KEY", None)


class TestOwnershipRules:
    """The precedence policy must match the documented contract."""

    def test_file_mode_wins_over_stale_ambient(self, tmp_path: Path) -> None:
        from lakehouse.core.env import load_env_file

        target = tmp_path / ".env.local"
        target.write_text("PROBE_OWNER=file-value\n", encoding="utf-8")
        os.environ["PROBE_OWNER"] = "stale-ambient-value"
        try:
            applied = load_env_file(target, "file")
            assert "PROBE_OWNER" in applied
            assert os.environ["PROBE_OWNER"] == "file-value"
        finally:
            os.environ.pop("PROBE_OWNER", None)

    def test_ambient_mode_wins_over_file(self, tmp_path: Path) -> None:
        from lakehouse.core.env import load_env_file

        target = tmp_path / ".env.local"
        target.write_text("PROBE_OWNER=file-value\n", encoding="utf-8")
        os.environ["PROBE_OWNER"] = "ambient-value"
        try:
            load_env_file(target, "ambient")
            assert os.environ["PROBE_OWNER"] == "ambient-value"
        finally:
            os.environ.pop("PROBE_OWNER", None)

    def test_explicit_operator_switch_wins(self) -> None:
        from lakehouse.core.env import resolve_precedence

        original = os.environ.get("LAKEHOUSE_ENV_PRECEDENCE")
        try:
            os.environ["LAKEHOUSE_ENV_PRECEDENCE"] = "ambient"
            assert resolve_precedence() == "ambient"
            os.environ["LAKEHOUSE_ENV_PRECEDENCE"] = "file"
            assert resolve_precedence() == "file"
        finally:
            if original is None:
                os.environ.pop("LAKEHOUSE_ENV_PRECEDENCE", None)
            else:
                os.environ["LAKEHOUSE_ENV_PRECEDENCE"] = original

    def test_deployed_environment_is_ambient_owned(self) -> None:
        from lakehouse.core.env import resolve_precedence

        original_precedence = os.environ.get("LAKEHOUSE_ENV_PRECEDENCE")
        original_env = os.environ.get("ENV")
        try:
            os.environ.pop("LAKEHOUSE_ENV_PRECEDENCE", None)
            os.environ["ENV"] = "prod"
            assert resolve_precedence() == "ambient"
            os.environ["ENV"] = "staging"
            assert resolve_precedence() == "ambient"
        finally:
            if original_precedence is None:
                os.environ.pop("LAKEHOUSE_ENV_PRECEDENCE", None)
            else:
                os.environ["LAKEHOUSE_ENV_PRECEDENCE"] = original_precedence
            if original_env is None:
                os.environ.pop("ENV", None)
            else:
                os.environ["ENV"] = original_env

    def test_node_env_is_never_used_to_decide_ownership(self) -> None:
        """Next.js builds with ``NODE_ENV=production`` — that must not flip ownership."""
        from lakehouse.core.env import resolve_precedence

        original_precedence = os.environ.get("LAKEHOUSE_ENV_PRECEDENCE")
        original_env = os.environ.get("ENV")
        original_node_env = os.environ.get("NODE_ENV")
        try:
            os.environ.pop("LAKEHOUSE_ENV_PRECEDENCE", None)
            os.environ["ENV"] = "local"
            os.environ["NODE_ENV"] = "production"
            assert resolve_precedence() == "file"
        finally:
            for key, value in (
                ("LAKEHOUSE_ENV_PRECEDENCE", original_precedence),
                ("ENV", original_env),
                ("NODE_ENV", original_node_env),
            ):
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value


class TestCanonicalFileResolution:
    """The package-local file wins over the repository-root file."""

    def test_package_local_file_is_preferred(self) -> None:
        from lakehouse.core.env import env_file_path

        resolved = env_file_path(start=_REPO_ROOT)
        assert resolved.parent == _REPO_ROOT / "apps" / "api"

    def test_resolution_walks_up_from_a_nested_directory(self) -> None:
        from lakehouse.core.env import env_file_path

        nested = _REPO_ROOT / "apps" / "api" / "src" / "modules"
        resolved = env_file_path(start=nested)
        assert resolved.parent == _REPO_ROOT / "apps" / "api"
