"""Transform crawler records and load curated ETL outputs to MinIO."""
from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from io import BytesIO
from typing import Any

from minio import Minio


class MinioCrawlerEtlSink:
    """Normalize crawler records before loading Silver and Gold JSONL objects.

    This is the MinIO ETL branch. Crawled objects are normalized and assigned
    stable IDs before the curated records and source metrics are written.
    """

    def __init__(self) -> None:
        endpoint = os.environ.get("MINIO_ENDPOINT", "minio:9000")
        endpoint = endpoint.removeprefix("http://").removeprefix("https://").rstrip("/")
        secure = os.environ.get("MINIO_SECURE", "false").lower() == "true"
        self.client = Minio(
            endpoint,
            access_key=os.environ.get("MINIO_ACCESS_KEY", "minioadmin"),
            secret_key=os.environ.get("MINIO_SECRET_KEY", "minioadmin"),
            secure=secure,
        )
        self.silver_bucket = os.environ.get("MINIO_SILVER_BUCKET", "silver")
        self.gold_bucket = os.environ.get("MINIO_GOLD_BUCKET", "gold")

    @staticmethod
    def _stable_record_id(item: dict[str, Any]) -> str:
        for key in ("id", "product_id", "coin_id", "story_id", "repository_id"):
            value = item.get(key)
            if value is not None and str(value).strip():
                return str(value)
        canonical = json.dumps(item, sort_keys=True, ensure_ascii=False, default=str)
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    @staticmethod
    def _normalize(item: dict[str, Any], *, source: str, run_id: str) -> dict[str, Any]:
        payload = json.dumps(item, ensure_ascii=False, sort_keys=True, default=str)
        crawled_at = item.get("_crawl_timestamp") or datetime.now(timezone.utc).isoformat()
        return {
            "run_id": run_id,
            "source": str(item.get("_source") or source),
            "event_type": str(item.get("_event_type") or "crawl"),
            "record_id": MinioCrawlerEtlSink._stable_record_id(item),
            "crawled_at": str(crawled_at),
            "payload": payload,
        }

    def transform_and_load(
        self,
        records: list[dict[str, Any]],
        *,
        source: str,
        run_id: str,
    ) -> dict[str, Any]:
        if not records:
            return {"source": source, "rows": 0, "silver_object": None, "gold_object": None}

        normalized = [self._normalize(item, source=source, run_id=run_id) for item in records]
        normalized.sort(key=lambda row: (row["record_id"], row["crawled_at"]))
        safe_run = "".join(c if c.isalnum() or c in "-_" else "_" for c in run_id)[-100:]
        safe_source = "".join(c if c.isalnum() or c in "-_" else "_" for c in source)[:80]
        silver_object = f"crawler_records/{safe_run}/{safe_source}.jsonl"
        body = ("\n".join(json.dumps(row, ensure_ascii=False) for row in normalized) + "\n").encode("utf-8")
        self.client.put_object(
            self.silver_bucket,
            silver_object,
            BytesIO(body),
            length=len(body),
            content_type="application/x-ndjson",
        )

        timestamps = [row["crawled_at"] for row in normalized]
        metric = {
            "run_id": run_id,
            "source": source,
            "event_type": "crawl",
            "record_count": len(normalized),
            "distinct_records": len({row["record_id"] for row in normalized}),
            "earliest_crawl": min(timestamps),
            "latest_crawl": max(timestamps),
            "processed_at": datetime.now(timezone.utc).isoformat(),
        }
        gold_object = f"crawler_source_metrics/{safe_run}/{safe_source}.json"
        metric_body = json.dumps(metric, ensure_ascii=False, indent=2).encode("utf-8")
        self.client.put_object(
            self.gold_bucket,
            gold_object,
            BytesIO(metric_body),
            length=len(metric_body),
            content_type="application/json",
        )
        return {
            "source": source,
            "rows": len(normalized),
            "silver_object": f"s3://{self.silver_bucket}/{silver_object}",
            "gold_object": f"s3://{self.gold_bucket}/{gold_object}",
        }

    def verify_run(self, run_id: str, sources: list[str]) -> dict[str, Any]:
        """Read back the ETL objects and verify their stored row counts."""
        safe_run = "".join(c if c.isalnum() or c in "-_" else "_" for c in run_id)[-100:]
        verified: dict[str, int] = {}
        for source in sources:
            safe_source = "".join(c if c.isalnum() or c in "-_" else "_" for c in source)[:80]
            object_name = f"crawler_records/{safe_run}/{safe_source}.jsonl"
            response = self.client.get_object(self.silver_bucket, object_name)
            try:
                lines = [line for line in response.read().decode("utf-8").splitlines() if line]
            finally:
                response.close()
                response.release_conn()
            if not lines:
                raise RuntimeError(f"MinIO ETL output is empty for source {source!r}")
            rows = [json.loads(line) for line in lines]
            gold_name = f"crawler_source_metrics/{safe_run}/{safe_source}.json"
            response = self.client.get_object(self.gold_bucket, gold_name)
            try:
                metric = json.loads(response.read().decode("utf-8"))
            finally:
                response.close()
                response.release_conn()
            distinct_ids = len({row["record_id"] for row in rows})
            if metric.get("record_count") != len(rows) or metric.get("distinct_records") != distinct_ids:
                raise RuntimeError(f"MinIO ETL Gold metrics do not match Silver for source {source!r}")
            verified[source] = len(lines)
        return {"run_id": run_id, "silver_rows": sum(verified.values()), "by_source": verified}
