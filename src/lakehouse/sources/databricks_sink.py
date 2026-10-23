"""Stage crawler output in a Unity Catalog Volume and append it to Bronze."""
from __future__ import annotations

import json
import hashlib
import logging
import os
import re
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


class DatabricksCrawlerSink:
    """Small REST client for Airflow's crawler-to-Databricks path.

    Raw JSONL files are kept in the configured Unity Catalog Volume. A SQL
    Warehouse then loads the files into a Delta Bronze table.
    """

    def __init__(self) -> None:
        self.host = os.environ.get("DATABRICKS_HOST", "").rstrip("/")
        self.token = os.environ.get("DATABRICKS_TOKEN", "")
        self.warehouse_id = os.environ.get("DATABRICKS_WAREHOUSE_ID", "")
        self.catalog = os.environ.get("DATABRICKS_CATALOG", "workspace")
        self.bronze_schema = os.environ.get("DATABRICKS_BRONZE_SCHEMA", "bronze")
        self.bronze_volume = os.environ.get("DATABRICKS_BRONZE_VOLUME", "bronze_data")
        self.table_name = os.environ.get("DATABRICKS_CRAWLER_BRONZE_TABLE", "crawler_raw")
        if not all((self.host, self.token, self.warehouse_id)):
            raise RuntimeError(
                "DATABRICKS_HOST, DATABRICKS_TOKEN, and DATABRICKS_WAREHOUSE_ID are required"
            )
        for identifier in (self.catalog, self.bronze_schema, self.bronze_volume, self.table_name):
            if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", identifier):
                raise ValueError(f"Invalid Databricks identifier: {identifier!r}")

    @property
    def table(self) -> str:
        return f"`{self.catalog}`.`{self.bronze_schema}`.`{self.table_name}`"

    @property
    def volume(self) -> str:
        return f"/Volumes/{self.catalog}/{self.bronze_schema}/{self.bronze_volume}"

    def _request(
        self,
        method: str,
        path: str,
        *,
        body: bytes | None = None,
        content_type: str = "application/json",
        timeout: int = 120,
    ) -> dict[str, Any]:
        req = urllib.request.Request(
            f"{self.host}{path}",
            data=body,
            method=method,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": content_type,
            },
        )
        try:
            tls_context = ssl.create_default_context()
            if os.environ.get("LAKEHOUSE_INSECURE") == "1":
                tls_context.check_hostname = False
                tls_context.verify_mode = ssl.CERT_NONE
            with urllib.request.urlopen(req, timeout=timeout, context=tls_context) as response:
                content = response.read()
        except urllib.error.HTTPError as exc:
            # Do not include request headers or credentials in task logs.
            detail = exc.read().decode("utf-8", errors="replace")[:1000]
            raise RuntimeError(f"Databricks API returned HTTP {exc.code}: {detail}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Could not reach Databricks API: {exc.reason}") from exc
        if not content:
            return {}
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            return {}

    def execute_sql(self, statement: str, *, timeout_seconds: int = 600) -> dict[str, Any]:
        result = self._request(
            "POST",
            "/api/2.0/sql/statements/",
            body=json.dumps(
                {
                    "warehouse_id": self.warehouse_id,
                    "statement": statement,
                    "wait_timeout": "50s",
                    "on_wait_timeout": "CONTINUE",
                    "catalog": self.catalog,
                    "schema": self.bronze_schema,
                }
            ).encode("utf-8"),
            timeout=70,
        )
        statement_id = result.get("statement_id")
        state = result.get("status", {}).get("state")
        deadline = time.monotonic() + timeout_seconds
        while state in ("PENDING", "RUNNING") and statement_id:
            if time.monotonic() >= deadline:
                raise TimeoutError(f"Databricks SQL statement {statement_id} timed out")
            time.sleep(3)
            result = self._request(
                "GET",
                f"/api/2.0/sql/statements/{urllib.parse.quote(statement_id, safe='')}",
                timeout=30,
            )
            state = result.get("status", {}).get("state")
        if state != "SUCCEEDED":
            error = result.get("status", {}).get("error", {})
            raise RuntimeError(f"Databricks SQL failed ({state}): {error}")
        return result

    def ensure_lakehouse_tables(self) -> None:
        self.execute_sql(f"CREATE SCHEMA IF NOT EXISTS `{self.catalog}`.`{self.bronze_schema}`")
        self.execute_sql(
            f"""CREATE TABLE IF NOT EXISTS {self.table} (
                run_id STRING NOT NULL,
                source STRING,
                event_type STRING,
                record_id STRING,
                crawled_at TIMESTAMP,
                payload STRING,
                source_file STRING,
                ingested_at TIMESTAMP
            ) USING DELTA"""
        )
        self.execute_sql(f"CREATE SCHEMA IF NOT EXISTS `{self.catalog}`.`silver`")
        self.execute_sql(
            f"""CREATE TABLE IF NOT EXISTS {self.silver_table} (
                run_id STRING NOT NULL,
                source STRING,
                event_type STRING,
                record_id STRING,
                crawled_at TIMESTAMP,
                payload STRING,
                source_file STRING,
                ingested_at TIMESTAMP,
                record_hash STRING
            ) USING DELTA"""
        )
        self.execute_sql(f"CREATE SCHEMA IF NOT EXISTS `{self.catalog}`.`gold`")
        self.execute_sql(
            f"""CREATE TABLE IF NOT EXISTS {self.gold_table} (
                run_id STRING NOT NULL,
                source STRING,
                event_type STRING,
                crawl_date DATE,
                record_count BIGINT,
                distinct_records BIGINT,
                earliest_crawl TIMESTAMP,
                latest_crawl TIMESTAMP,
                ingested_at TIMESTAMP
            ) USING DELTA"""
        )

    @property
    def silver_table(self) -> str:
        return f"`{self.catalog}`.`silver`.`crawler_records`"

    @property
    def gold_table(self) -> str:
        return f"`{self.catalog}`.`gold`.`crawler_source_metrics`"

    def stage_and_load(
        self,
        records: list[dict[str, Any]],
        *,
        source: str,
        run_id: str,
    ) -> dict[str, Any]:
        if not records:
            return {"source": source, "rows": 0, "file": None}

        safe_run_id = re.sub(r"[^A-Za-z0-9_-]+", "_", run_id).strip("_")[-80:]
        safe_source = re.sub(r"[^A-Za-z0-9_-]+", "_", source).strip("_")[:80]
        filename = f"crawler_{safe_run_id}_{safe_source}.jsonl"
        file_path = f"{self.volume}/{filename}"
        now = datetime.now(timezone.utc).isoformat()
        lines = []
        for item in records:
            payload = json.dumps(item, ensure_ascii=False, default=str)
            record_id = next(
                (
                    str(item[key])
                    for key in ("id", "product_id", "coin_id", "story_id", "repository_id")
                    if item.get(key) is not None and str(item[key]).strip()
                ),
                hashlib.sha256(payload.encode("utf-8")).hexdigest(),
            )
            lines.append(
                json.dumps(
                    {
                        "run_id": run_id,
                        "source": str(item.get("_source") or source),
                        "event_type": str(item.get("_event_type") or "crawl"),
                        "record_id": record_id,
                        "crawled_at": str(item.get("_crawl_timestamp") or now),
                        "payload": payload,
                    },
                    ensure_ascii=False,
                )
            )
        content = ("\n".join(lines) + "\n").encode("utf-8")
        encoded_path = urllib.parse.quote(file_path, safe="/")
        self._request(
            "PUT",
            f"/api/2.0/fs/files{encoded_path}?overwrite=true",
            body=content,
            content_type="application/octet-stream",
            timeout=180,
        )
        logger.info("Staged %d %s records at %s", len(records), source, file_path)

        sql_file_path = file_path.replace("'", "''")
        self.execute_sql(
            f"""INSERT INTO {self.table}
            SELECT
                run_id,
                source,
                event_type,
                record_id,
                CAST(crawled_at AS TIMESTAMP),
                payload,
                '{sql_file_path}',
                current_timestamp()
            FROM read_files('{sql_file_path}', format => 'json')
            WHERE NOT EXISTS (
                SELECT 1 FROM {self.table} AS existing
                WHERE existing.source_file = '{sql_file_path}'
            )"""
        )
        return {"source": source, "rows": len(records), "file": file_path}

    def transform_run(self, run_id: str) -> dict[str, int]:
        """Deduplicate this run into Silver and aggregate source metrics in Gold."""
        escaped_run_id = run_id.replace("'", "''")
        self.execute_sql(
            f"""MERGE INTO {self.silver_table} AS target
            USING (
                SELECT run_id, source, event_type, record_id, crawled_at,
                       payload, source_file, ingested_at, record_hash
                FROM (
                    SELECT run_id, source, event_type, record_id, crawled_at,
                           payload, source_file, ingested_at,
                           sha2(concat_ws('||', source, coalesce(record_id, ''), payload), 256)
                               AS record_hash,
                           ROW_NUMBER() OVER (
                               PARTITION BY sha2(
                                   concat_ws('||', source, coalesce(record_id, ''), payload), 256
                               ) ORDER BY ingested_at DESC
                           ) AS row_num
                    FROM {self.table}
                    WHERE run_id = '{escaped_run_id}'
                ) AS ranked
                WHERE row_num = 1
            ) AS incoming
            ON target.run_id = incoming.run_id
               AND target.record_hash = incoming.record_hash
            WHEN NOT MATCHED THEN INSERT (
                run_id, source, event_type, record_id, crawled_at, payload,
                source_file, ingested_at, record_hash
            ) VALUES (
                incoming.run_id, incoming.source, incoming.event_type,
                incoming.record_id, incoming.crawled_at, incoming.payload,
                incoming.source_file, incoming.ingested_at, incoming.record_hash
            )"""
        )
        self.execute_sql(
            f"""MERGE INTO {self.gold_table} AS target
            USING (
                SELECT run_id, source, event_type, CAST(crawled_at AS DATE) AS crawl_date,
                       COUNT(*) AS record_count,
                       COUNT(DISTINCT record_hash) AS distinct_records,
                       MIN(crawled_at) AS earliest_crawl,
                       MAX(crawled_at) AS latest_crawl,
                       current_timestamp() AS ingested_at
                FROM {self.silver_table}
                WHERE run_id = '{escaped_run_id}'
                GROUP BY run_id, source, event_type, CAST(crawled_at AS DATE)
            ) AS incoming
            ON target.run_id = incoming.run_id
               AND target.source = incoming.source
               AND target.event_type = incoming.event_type
               AND target.crawl_date = incoming.crawl_date
            WHEN MATCHED THEN UPDATE SET
                target.record_count = incoming.record_count,
                target.distinct_records = incoming.distinct_records,
                target.earliest_crawl = incoming.earliest_crawl,
                target.latest_crawl = incoming.latest_crawl,
                target.ingested_at = incoming.ingested_at
            WHEN NOT MATCHED THEN INSERT (
                run_id, source, event_type, crawl_date, record_count,
                distinct_records, earliest_crawl, latest_crawl, ingested_at
            ) VALUES (
                incoming.run_id, incoming.source, incoming.event_type,
                incoming.crawl_date, incoming.record_count, incoming.distinct_records,
                incoming.earliest_crawl, incoming.latest_crawl, incoming.ingested_at
            )"""
        )
        return self.verify_run(run_id)

    def verify_run(self, run_id: str) -> dict[str, Any]:
        escaped_run_id = run_id.replace("'", "''")
        result = self.execute_sql(
            f"""SELECT source, COUNT(*) AS rows
            FROM {self.table}
            WHERE run_id = '{escaped_run_id}'
            GROUP BY source ORDER BY source"""
        )
        rows = result.get("result", {}).get("data_array", [])
        bronze_rows = sum(int(row[1]) for row in rows)
        if bronze_rows <= 0:
            raise RuntimeError(f"No Bronze rows found for Airflow run {run_id!r}")
        summary = {str(row[0]): int(row[1]) for row in rows}
        counts: dict[str, int] = {}
        for layer, table in (
            ("silver", self.silver_table),
            ("gold", self.gold_table),
        ):
            result = self.execute_sql(
                f"SELECT COUNT(*) AS rows FROM {table} WHERE run_id = '{escaped_run_id}'"
            )
            count_rows = result.get("result", {}).get("data_array", [])
            counts[f"{layer}_rows"] = int(count_rows[0][0]) if count_rows else 0
        if counts["silver_rows"] <= 0 or counts["gold_rows"] <= 0:
            raise RuntimeError(
                f"Bronze data was found, but this run has no rows in Silver or Gold: {counts}"
            )
        logger.info(
            "Verified Databricks crawler Lakehouse layers: Bronze=%d, Silver=%d, Gold=%d; %s",
            bronze_rows, counts["silver_rows"], counts["gold_rows"], summary,
        )
        return {
            "run_id": run_id,
            "bronze_rows": bronze_rows,
            **counts,
            "by_source": summary,
        }
