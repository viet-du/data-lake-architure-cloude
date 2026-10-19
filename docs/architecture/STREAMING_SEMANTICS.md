# Streaming semantics, recovery, and safe operations

> **Status:** This document describes the **actual** delivery guarantees of
> the streaming paths in this repository as of PHASE 4. It is intentionally
> conservative — it documents what the code does, not what we hope it does.

---

## 1. Delivery semantics — **at-least-once**, not exactly-once

The Spark Structured Streaming jobs in `src/lakehouse/pipelines/stream_*.py`
and `src/lakehouse/{ingest,transform,aggregate}/streaming/` provide
**at-least-once** delivery from Kafka to Delta Lake. They do **not** provide
end-to-end exactly-once, and the docs/code should never claim otherwise.

### Why it is at-least-once, not exactly-once

A pipeline would need to satisfy all three of these to be exactly-once
end-to-end. We satisfy (1) and (2), but not (3) for every micro-batch:

| Requirement | Where it lives in this repo | Status |
|---|---|---|
| 1. Idempotent Kafka source (offsets tracked) | `option("startingOffsets", "latest")` + `_checkpoints/offsets/` | ✅ |
| 2. Idempotent Delta sink | `write_delta_streaming` sets `txnVersion=1` + `txnAppId=<table>`. Delta renames output files with the txn id so a retry in the same epoch does not produce duplicate Parquet files. | ✅ |
| 3. Global, deterministic dedup of the *business* event | `dropDuplicates(["event_id"])` in `ClickstreamTransformer` | ❌ Per micro-batch only |

The third leg is the gap. Spark's `dropDuplicates` on a streaming DataFrame
deduplicates rows **within a single micro-batch**. The same `event_id` arriving
in a later micro-batch (because the Kafka consumer was reset, or because the
query was re-started from `earliest` for a replay) will be written again.
A globally-unique `event_id` from the producer (UUIDv4, snowflake, etc.) is
the only reliable way to dedup across batches, and even that requires a
downstream compaction step (`OPTIMIZE` + `ZORDER BY event_id`).

### What this means in practice

- ✅ **Tolerable**: re-running a query after a crash replays from the last
  committed Kafka offset, so we never *lose* events.
- ⚠️ **Duplicates possible**: if a query crashes *after* writing to Delta
  but *before* committing its checkpoint, the next start re-runs the
  micro-batch and Delta's txn id keeps file names unique, but the *content*
  (the same `event_id`) can still appear in a different Parquet file.
  Downstream consumers should dedup by `event_id` when reading Silver/Gold.
- ❌ **Do not** describe the system as "exactly-once" in any user-facing
  doc, dashboard, or contract. Use "at-least-once with per-task idempotent
  Delta writes".

### Where the dedup window is enforced

| Path | Dedup mechanism | Window |
|---|---|---|
| Bronze `clickstream/events` | None (raw append) | N/A |
| Silver `clickstream/events` | `dropDuplicates(["event_id"])` | Per micro-batch |
| Bronze/Silver `ecommerce/*` | None (raw append) | N/A |
| Gold `clickstream/page_views_5min` | None (append-only) | N/A — output is windowed aggregation, not a row-replay |
| Gold `category_analytics/revenue_by_category` | None (append-only) | N/A |

---

## 2. Checkpoint layout

Every streaming query writes its checkpoint to:

```
s3a://<layer>/<table>/_checkpoints/
```

For example:

```
s3a://bronze/clickstream/events/_checkpoints/    ← ClickstreamIngestor
s3a://silver/clickstream/events/_checkpoints/    ← ClickstreamTransformer
s3a://gold/clickstream/page_views_5min/_checkpoints/   ← ClickstreamMetricsAggregator
s3a://gold/clickstream/top_pages_5min/_checkpoints/     ← ClickstreamMetricsAggregator
s3a://bronze/ecommerce/products/_checkpoints/    ← EcommerceIngestor
s3a://silver/ecommerce/products/_checkpoints/    ← EcommerceTransformer
s3a://gold/ecommerce/category_metrics/_checkpoints/    ← EcommerceMetricsAggregator
s3a://gold/category_analytics/revenue_by_category/_checkpoints/   ← CategoryRevenueAggregator
```

### Why per-table, inside the same bucket

Storing checkpoints under the table's bucket keeps a `VACUUM` or `RESET` of
the data layer reversible: deleting the bucket also deletes the checkpoint
→ the next start of the query is equivalent to a clean replay. Conversely,
restoring from a backup of the bucket restores both data and offsets.

### What you must NEVER do to a checkpoint dir

| Forbidden action | Why |
|---|---|
| `mc rm -r .../_checkpoints/` | Wipes Kafka offsets. Next start replays from `latest` (current) or the topic's earliest offset (if `--from-beginning` is added). |
| Manually editing `offsets/...` JSON | Breaks the contract that the offset corresponds to a written micro-batch. |
| `docker volume rm kafka_data` while a streaming job is running | Job loses its `__consumer_offsets` mapping; on restart it will re-read from earliest and the dedup gap (see §1) widens. |
| `docker exec lake-spark spark-submit -- ... --conf spark.sql.shuffle.partitions=...` (with a different code path) | Not destructive but a new txnAppId would break the per-task idempotency described in §1. |

If you need to "replay" a topic from the beginning:

```bash
# 1. Stop the streaming job (Ctrl-C in `make stream-clickstream` OR
#    `docker exec lake-spark-master ps -ef | grep spark-submit` then kill)
# 2. Delete the checkpoint dir
docker exec lake-minio mc rm --recursive --force local/bronze/clickstream/events/_checkpoints/
# 3. Set startingOffsets to "earliest" TEMPORARILY in the ingestor,
#    OR pass --conf to spark-submit:
#       --conf spark.sql.streaming.startingOffsets=earliest
# 4. Restart the job. Switch startingOffsets back to "latest" afterwards.
```

> ⚠️ Always confirm with the project owner before deleting a checkpoint —
> this rewinds all downstream state.

---

## 3. Restart / recovery

### What happens on a `Ctrl-C` / `SIGTERM`

`lakehouse.pipelines.base.StreamingPipeline.run()` handles `KeyboardInterrupt`
by calling `query.stop()`. This:

1. Stops accepting new micro-batches from Kafka.
2. Waits for the in-flight micro-batch to finish writing to Delta.
3. Commits the offset for that batch to the checkpoint dir.
4. Returns cleanly.

The next start picks up from the committed offset. No data is lost, no
offsets are reset.

### What happens on a `kill -9` / OOM / power loss

The offset committed to the checkpoint dir may correspond to a micro-batch
that did not finish writing. On restart, the same offsets are re-consumed
and the same micro-batch is re-executed. Delta's `txnVersion=1`/`txnAppId`
keeps file names stable, so the worst case is a small amount of duplicate
data, not data loss.

### What happens if the checkpoint dir is missing

The query will refuse to start with a clear error:
`...AnalysisException: There is no Offset source ...`.
This is the intended behavior — re-running from a missing checkpoint is
an explicit operator decision, never an automatic one.

### What happens if the topic is missing

`failOnDataLoss=false` is set in all ingestors. If the topic is recreated
with a different `min.insync.replicas` or partition count, the query will
re-read from the new earliest offset, deduplicating within each micro-batch
and accepting the wider dup window described in §1.

---

## 4. Safe ways to stop and start a query

| Action | Safe? | How |
|---|---|---|
| Stop a query, start it again | ✅ | `Ctrl-C` on `make stream-clickstream`, then re-run. The checkpoint decides where to resume. |
| Stop one query, leave siblings running | ✅ | Each query has its own checkpoint dir; stopping one does not affect the others. |
| Restart the Spark cluster (`docker compose restart spark-master`) | ✅ | All checkpoints are on MinIO (S3), not on local disk. On restart, each query re-attaches to its checkpoint. |
| `docker compose down -v` (delete volumes) | ❌ | Deletes Kafka topics AND MinIO data AND checkpoint dirs. Use only on dev / with project-owner confirmation. |
| Delete a single Delta table but keep its checkpoint | ⚠️ | The query will restart but the next micro-batch will *recreate* the table with the same schema. The dedup gap applies. |
| Delete the checkpoint but keep the Delta table | ❌ | Next start replays from `latest` (current), missing any events that were produced while the query was down. |

---

## 5. Batch vs streaming contention

The streaming paths write to these Delta paths:

```
bronze/clickstream/events
bronze/ecommerce/{products,reviews,prices}
silver/clickstream/events
silver/ecommerce/{products,reviews}
gold/clickstream/{page_views_5min,top_pages_5min}
gold/clickstream/unique_metrics_5min (exact unique users/sessions; batch recompute)
gold/ecommerce/{category_metrics,price_tier_metrics,seller_metrics}
gold/category_analytics/revenue_by_category
```

The batch paths write to a disjoint set:

```
bronze/{crm/customers,erp/products,erp/orders}
silver/{crm/customers,erp/products,erp/orders}
gold/{fact_orders,dim_customers,dim_products,daily_revenue}
gold/clickstream/unique_metrics_5min
```

Spark Structured Streaming does not support exact `countDistinct` aggregations.
Realtime clickstream Gold therefore contains page-view counts and top pages;
exact unique-user/session counts are recomputed from Silver by running
`make aggregate-clickstream-unique`. This batch job overwrites only
`gold/clickstream/unique_metrics_5min` and is not continuously refreshed.

The intersection is empty as of PHASE 4. A streaming query reading
`silver/ecommerce/products` while the batch gold job reads
`silver/erp/orders` is safe because the Delta log uses snapshot isolation
on the table version, not on individual rows — concurrent reads from
different tables are always safe.

If a future change ever adds a batch writer to one of the streaming-owned
paths, please update this section and add a test in
`tests/test_streaming_correctness.py::TestBatchStreamContention`.

---

## 6. Topic, broker, and producer consistency

| Component | Topic source | Broker source |
|---|---|---|
| `ClickstreamProducer` | `KafkaTopics.CLICKSTREAM_EVENTS` | `KAFKA_BOOTSTRAP` env (default `localhost:9092`) |
| `ClickstreamIngestor` | `KafkaTopics.CLICKSTREAM_EVENTS` | `KAFKA_BOOTSTRAP` env |
| `EcommerceIngestor` | `KafkaTopics.{ECOMMERCE_PRODUCTS,REVIEWS,PRICES}` | `KAFKA_BOOTSTRAP` env |
| `CategoryRevenueAggregator` | `KafkaTopics.TIKI_CATEGORY` | `KAFKA_BOOTSTRAP` env |
| `scripts/produce_kafka.sh` | first CLI arg | `KAFKA_BOOTSTRAP` env (default `localhost:9092`) |
| Airflow DAGs `*_streaming_dag.py` | hard-coded in `stream_*.py` | `kafka:29092` (in-container, passed via `-e`) |

### In-container vs host

| Where it runs | Broker to use |
|---|---|
| Mac host terminal | `localhost:9092` |
| `lake-spark-master` container | `kafka:29092` |
| `lake-airflow-webserver` container, `docker exec` to spark | `kafka:29092` |

The Airflow DAGs already override the broker when invoking spark-submit
via `docker exec -e KAFKA_BOOTSTRAP=kafka:29092 ...`. If you run the
streaming job outside of Airflow, set the env in your shell:

```bash
export KAFKA_BOOTSTRAP=localhost:9092  # on Mac host
# or
export KAFKA_BOOTSTRAP=kafka:29092     # inside lake-spark-master container
```

---

## 7. Failure modes (what we observed vs what we guard against)

| Failure | Detection | Mitigation |
|---|---|---|
| Producer sends malformed JSON | `from_json(value, schema)` returns NULL for all fields → row is dropped by the `isNotNull` filter in the transformer | Add a quarantine path (see `quarantine_bad_records` in `delta_writer.py`) — *not wired into the streaming path today* |
| Duplicate `event_id` in same micro-batch | `dropDuplicates(["event_id"])` in `ClickstreamTransformer` | ✅ |
| Duplicate `event_id` across micro-batches | Not caught | Documented as a known gap in §1 |
| Timestamp in unexpected format | `to_timestamp(...)` with `coalesce(... 3 formats)` | ✅ for the 3 formats we know about |
| Watermark too tight (10 min) for late data | Window is closed before late data arrives → late data is silently dropped | Increase watermark to e.g. `30 minutes` if late data is expected |
| `failOnDataLoss=true` would block restart after topic deletion | `failOnDataLoss=false` is set | ✅ |
| Kafka broker unreachable | readStream blocks until reconnection; Spark keeps retrying | Wrap in Airflow health check (currently absent) |
| MinIO unreachable | writeStream blocks until reconnection; may OOM after `maxOffsetsPerTrigger * N` retries | Set `spark.hadoop.fs.s3a.attempts=2` and `connection.timeout=20s` (now in `delta_writer.py`) |

---

## 8. Throughput and latency

The repository does not yet have measured throughput/latency numbers for
the streaming paths. To produce them:

1. Start the stack (`make up`).
2. Start the producer with a known rate:
   ```bash
   bash scripts/produce_kafka.sh clickstream-events 10000 200   # 200 msg/s for 50s
   ```
3. Start the streaming job:
   ```bash
   make stream-clickstream
   ```
4. After 5 minutes, query MinIO:
   ```bash
   docker exec lake-minio mc du --recursive local/bronze/clickstream/
   ```
5. Compute `events/sec = (bronze_count) / (elapsed_seconds)` and
   `latency = (silver_event_timestamp_max - kafka_timestamp_max)`.

Paste the result into this file as `### Run YYYY-MM-DD`.

---

## 9. How to verify a restart actually resumes

```bash
# 1. Start the streaming job. Note the query ID from the log.
make stream-clickstream

# 2. Produce some events.
bash scripts/produce_kafka.sh clickstream-events 100 10

# 3. Note the row count in Bronze:
docker exec lake-minio mc cat local/bronze/clickstream/events/_delta_log/00000000000000000000.json | head -20
# or via Spark: SELECT count(*) FROM delta.`s3a://bronze/clickstream/events/`

# 4. Ctrl-C the job. Verify the checkpoint dir has an offsets/ subdir.
docker exec lake-minio mc ls --recursive local/bronze/clickstream/events/_checkpoints/offsets/

# 5. Start the job again.
make stream-clickstream

# 6. Produce 100 more events.
bash scripts/produce_kafka.sh clickstream-events 100 10

# 7. Verify Bronze now has 200 events (NOT 100, NOT 300).
#    If the count is 100, the checkpoint was wiped and the job replayed
#    from `latest` (i.e. missed the first batch).
#    If the count is 300, the checkpoint was missing and the job replayed
#    the first 100 + 100 new = 300.
```

A correct restart must show **exactly 200** events, with the second batch's
`kafka_offset` strictly greater than the first batch's `kafka_offset`.
