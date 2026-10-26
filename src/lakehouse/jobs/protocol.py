"""Typed job protocol for the control-plane worker bridge.

The TypeScript control plane (BullMQ workers) must not run Spark inside an
HTTP request, and it must not be able to execute arbitrary shell commands.
MASTER PLAN §10.2 asks for a "Typed worker CLI/JSON job protocol
(whitelisted operations), not shell injection".

This module defines that protocol:

* The **request** is a JSON document with an ``operation`` from a fixed
  allowlist plus typed parameters.
* The **response** is a JSON document with a deterministic shape, so the
  TypeScript side can decode it with a Zod schema and can never be handed
  untrusted extra fields.

Only ``succeeded``/``failed`` are valid terminal states. There is no
"partially succeeded" that hides a write failure — a failed write is always
reported as ``failed`` with the error message attached.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

#: Whitelisted operations. The runner refuses anything outside this set.
OP_BRONZE_INGEST_CSV = "bronze.ingest_csv"
OP_BRONZE_INGEST_JSON = "bronze.ingest_json"
OP_BRONZE_INGEST_STREAM = "bronze.ingest_stream"
OP_SILVER_TRANSFORM = "silver.transform"
OP_GOLD_AGGREGATE = "gold.aggregate"

ALLOWED_OPERATIONS: frozenset[str] = frozenset(
    {
        OP_BRONZE_INGEST_CSV,
        OP_BRONZE_INGEST_JSON,
        OP_BRONZE_INGEST_STREAM,
        OP_SILVER_TRANSFORM,
        OP_GOLD_AGGREGATE,
    }
)

STATUS_SUCCEEDED = "succeeded"
STATUS_FAILED = "failed"


class JobProtocolError(ValueError):
    """Raised when the incoming job document is not a valid typed request."""


@dataclass(frozen=True)
class DatasetInfo:
    """Identity + physical location of the dataset a job produced."""

    provider: str
    layer: str
    database: str
    table: str
    path: str
    delta_version: int | None = None
    row_count: int | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "layer": self.layer,
            "database": self.database,
            "table": self.table,
            "path": self.path,
            "deltaVersion": self.delta_version,
            "rowCount": self.row_count,
        }


@dataclass(frozen=True)
class JobRequest:
    """A validated job request."""

    operation: str
    params: dict[str, Any] = field(default_factory=dict)
    job_id: str = ""

    @classmethod
    def parse(cls, raw: str) -> "JobRequest":
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise JobProtocolError(f"Job payload is not valid JSON: {exc}") from exc
        if not isinstance(payload, dict):
            raise JobProtocolError("Job payload must be a JSON object")
        operation = payload.get("operation")
        if not isinstance(operation, str) or operation not in ALLOWED_OPERATIONS:
            raise JobProtocolError(
                f"Unsupported operation: {operation!r} "
                f"(allowed: {sorted(ALLOWED_OPERATIONS)})"
            )
        params = payload.get("params", {})
        if not isinstance(params, dict):
            raise JobProtocolError("Job params must be a JSON object")
        job_id = payload.get("jobId", "")
        if not isinstance(job_id, str):
            raise JobProtocolError("jobId must be a string")
        return cls(operation=operation, params=params, job_id=job_id)

    # -- typed parameter accessors -----------------------------------
    def require_str(self, key: str) -> str:
        value = self.params.get(key)
        if not isinstance(value, str) or not value.strip():
            raise JobProtocolError(f"Parameter {key!r} is required and must be a non-empty string")
        return value

    def optional_str(self, key: str) -> str | None:
        value = self.params.get(key)
        if value is None:
            return None
        if not isinstance(value, str):
            raise JobProtocolError(f"Parameter {key!r} must be a string")
        return value

    def optional_int(self, key: str, default: int) -> int:
        value = self.params.get(key, default)
        if value is None:
            return default
        if isinstance(value, bool) or not isinstance(value, int):
            raise JobProtocolError(f"Parameter {key!r} must be an integer")
        if value < 0:
            raise JobProtocolError(f"Parameter {key!r} must not be negative")
        return value

    def optional_bool(self, key: str, default: bool) -> bool:
        value = self.params.get(key, default)
        if not isinstance(value, bool):
            raise JobProtocolError(f"Parameter {key!r} must be a boolean")
        return value


@dataclass(frozen=True)
class JobResponse:
    """The deterministic result document returned to the control plane."""

    status: str
    operation: str
    job_id: str
    rows: int = 0
    bytes: int = 0
    dataset: DatasetInfo | None = None
    metrics: dict[str, Any] = field(default_factory=dict)
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "operation": self.operation,
            "jobId": self.job_id,
            "rows": self.rows,
            "bytes": self.bytes,
            "dataset": self.dataset.to_dict() if self.dataset else None,
            "metrics": self.metrics,
            "error": self.error,
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), separators=(",", ":"), default=str)
