# Spark + Delta Lake + Cloudflare R2 — Configuration Guide

> **Why this doc exists:** Spark on R2 needs three things configured correctly or it hangs forever. This is the config that works, with the gotchas inline.

---

## 1. The 3 things you MUST configure

### 1.1 S3A endpoint

R2 is S3-compatible but uses a different endpoint than AWS S3:

```hocon
# Spark conf (spark-defaults.conf or --conf)
spark.hadoop.fs.s3a.endpoint              ${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
spark.hadoop.fs.s3a.path.style.access     true       # R2 uses path-style, not virtual-host
spark.hadoop.fs.s3a.connection.ssl.enabled true
```

**Gotcha:** the endpoint MUST be just `<account-id>.r2.cloudflarestorage.com`. Do NOT prepend `s3://` or `https://` or include a bucket name. The bucket goes in the path, e.g. `s3a://bronze/path/to/file`.

### 1.2 S3A credentials

R2 uses Cloudflare-issued API tokens, not AWS IAM:

```hocon
spark.hadoop.fs.s3a.access.key            ${R2_ACCESS_KEY}
spark.hadoop.fs.s3a.secret.key            ${R2_SECRET_KEY}
spark.hadoop.fs.s3a.aws.credentials.provider org.apache.hadoop.fs.s3a.SimpleAWSCredentialsProvider
```

**Gotcha:** `SimpleAWSCredentialsProvider` reads from the `fs.s3a.access.key` / `fs.s3a.secret.key` config keys (or env vars `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`). If you set both, env vars win.

### 1.3 Delta Lake log store

Delta Lake needs to know where to store the transaction log. For a single-driver setup (no concurrent writers), use the simple log store:

```hocon
spark.delta.logStore.class                org.apache.spark.sql.delta.storage.S3SingleDriverLogStore
```

**Gotcha:** if you try to use the default log store, you'll see errors like "S3A implementation class not found" or "Could not load log store". The `S3SingleDriverLogStore` is the right choice when only the Spark driver writes to the table (which is our case — workers compute, driver commits).

---

## 2. Full `spark-defaults.conf` for the local Docker Spark runtime

This file is baked into the Spark image and mounted by Docker Compose. R2 values, when enabled, are supplied through the local git-ignored `.env` file.

```hocon
# ─── S3A / R2 (storage layer) ───────────────────────────────────
spark.hadoop.fs.s3a.endpoint                       ${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
spark.hadoop.fs.s3a.path.style.access              true
spark.hadoop.fs.s3a.connection.ssl.enabled         true
spark.hadoop.fs.s3a.access.key                     ${R2_ACCESS_KEY}
spark.hadoop.fs.s3a.secret.key                     ${R2_SECRET_KEY}
spark.hadoop.fs.s3a.aws.credentials.provider       org.apache.hadoop.fs.s3a.SimpleAWSCredentialsProvider
spark.hadoop.fs.s3a.impl                           org.apache.hadoop.fs.s3a.S3AFileSystem
spark.hadoop.fs.s3a.committer.name                 directory
spark.hadoop.fs.s3a.committer.staging.conflict-mode replace
spark.hadoop.fs.s3a.connection.maximum             100
spark.hadoop.fs.s3a.threads.max                    50
spark.hadoop.fs.s3a.connection.establish.timeout   30000
spark.hadoop.fs.s3a.attempts.maximum               10
spark.hadoop.fs.s3a.retry.limit                    10
spark.hadoop.fs.s3a.retry.interval                 1000

# ─── Delta Lake (transactional layer) ───────────────────────────
spark.sql.extensions                               io.delta.sql.DeltaSparkSessionExtension
spark.sql.catalog.spark_catalog                    org.apache.spark.sql.delta.catalog.DeltaCatalog
spark.delta.logStore.class                         org.apache.spark.sql.delta.storage.S3SingleDriverLogStore
spark.delta.enableExperimentalStreamsS3Listing     true

# ─── Kafka (streaming layer) ────────────────────────────────────
spark.kafka.bootstrap.servers                      ${KAFKA_BOOTSTRAP:-lake-kafka:9092}
spark.sql.streaming.kafka.maxOffsetsPerTrigger     10000
spark.sql.streaming.minBatchesToRetain             2

# ─── Performance tuning (R2 is high-throughput, increase parallelism) ─
spark.sql.shuffle.partitions                       200       # default is 200 in Spark 3.5; keep
spark.sql.adaptive.enabled                         true
spark.sql.adaptive.coalescePartitions.enabled      true
spark.driver.memory                                2g
spark.executor.memory                              4g
spark.executor.cores                               2
spark.task.maxFailures                             8
spark.speculation                                  true

# ─── Stability (Cloud network ≠ Local network) ──────────────────
spark.network.timeout                              800s
spark.executor.heartbeatInterval                   60s
spark.sql.broadcastTimeout                         600
spark.rpc.askTimeout                               600s
spark.rpc.lookupTimeout                            600s

# ─── Lakehouse defaults (R2 bucket names) ───────────────────────
spark.lakehouse.s3a.bucket.bronze                  ${R2_BUCKET_BRONZE}
spark.lakehouse.s3a.bucket.silver                  ${R2_BUCKET_SILVER}
spark.lakehouse.s3a.bucket.gold                    ${R2_BUCKET_GOLD}
```

---

## 3. Reading and writing Delta tables on R2 from Python

Once the config above is loaded by Spark, the Python API is identical to local S3 usage:

```python
from pyspark.sql import SparkSession

spark = SparkSession.builder.getOrCreate()

# Read a Delta table from R2 (zero egress from API + Web UI)
df = spark.read.format("delta").load("s3a://gold/crm/fact_tiki")

# Write a Delta table to R2
df.write.format("delta").mode("overwrite").save("s3a://silver/crm/tiki_smartphone")

# Stream from Kafka, write to R2 Delta (structured streaming)
stream = (
    spark.readStream
    .format("kafka")
    .option("kafka.bootstrap.servers", "lake-kafka:9092")
    .option("subscribe", "clickstream-events")
    .load()
)
stream.writeStream \
    .format("delta") \
    .option("checkpointLocation", "s3a://bronze/_checkpoints/clickstream/") \
    .start("s3a://bronze/stream/clickstream/")
```

**The path `s3a://bronze/...` resolves to `https://<account-id>.r2.cloudflarestorage.com/bronze/...`** under the hood. The bucket name is the first path segment, not part of the hostname.

---

## 4. Time travel on R2

Delta Lake time travel works on R2 the same as on S3 — the `_delta_log/` subdirectory contains JSON files that record every commit.

```python
# Read a specific version
df_v3 = spark.read.format("delta").option("versionAsOf", 3).load("s3a://gold/crm/fact_tiki")

# Read as of a timestamp
df_yesterday = (
    spark.read.format("delta")
    .option("timestampAsOf", "2026-10-17T00:00:00Z")
    .load("s3a://gold/crm/fact_tiki")
)
```

**Gotcha:** R2 lifecycle policies move `_delta_log/` to IA storage after 90 days (for bronze). Time travel to a version > 90 days old will work but be slower. The data files also have the lifecycle policy, so reads of old versions may take 2-3x longer than current versions.

---

## 5. Vacuum and cleanup on R2

Delta Lake's `VACUUM` command removes files no longer referenced by the transaction log:

```python
from delta.tables import DeltaTable

dt = DeltaTable.forPath(spark, "s3a://silver/crm/tiki_smartphone")
dt.vacuum(retentionHours=168)  # keep 7 days for time travel
```

**Gotcha:** `VACUUM` issues many small DELETE requests to R2. R2 charges $0.36 per 1M Class A operations (DELETE counts). A vacuum of a 10GB table may issue 10,000+ DELETEs = $0.004. Negligible, but worth knowing.

---

## 6. OPTIMIZE and Z-ORDER on R2

```python
# Compact small files into larger ones (improves read performance)
spark.sql("OPTIMIZE delta.`s3a://silver/crm/tiki_smartphone`")

# Z-ORDER by a frequently-queried column (improves predicate pushdown)
spark.sql("OPTIMIZE delta.`s3a://gold/crm/fact_tiki` ZORDER BY (customer_id, order_date)")
```

**R2 + Z-ORDER gotcha:** Z-ORDER works on R2 but the read-time benefit depends on R2's range-read performance. In practice, we've seen 2-3x speedup on filtered queries. Not as good as local NVMe (5-10x) but still meaningful.

---

## 7. Concurrent writes (when you have multiple Spark jobs)

**R2 does NOT support strong consistency for concurrent writes** to the same key. Delta Lake needs to write the transaction log atomically. There are two patterns:

### 7.1 Single-writer pattern (recommended for this project)

Only the `lake-spark` service writes to Delta tables. All other services (Airflow, API) read only. This is the simplest and most reliable.

```hocon
# All writes go through lake-spark; the API and Web UI are read-only
spark.delta.logStore.class    org.apache.spark.sql.delta.storage.S3SingleDriverLogStore
```

### 7.2 Multi-writer pattern (NOT recommended for R2)

If you need multiple concurrent writers (e.g. parallel jobs in the same Spark cluster), use:

```hocon
spark.delta.logStore.class    org.apache.spark.sql.delta.storage.S3DynamoDBLogStore
# Then add DynamoDB config (NOT R2 — you'd need a separate DynamoDB instance)
```

This adds a hard dependency on DynamoDB, which R2 does not provide. For this project, **stick with the single-writer pattern**.

---

## 8. Common errors and fixes

| Error message | Cause | Fix |
| --- | --- | --- |
| `java.net.UnknownHostException: <bucket>.s3.amazonaws.com` | `fs.s3a.endpoint` not set; Spark defaulted to AWS S3 | Set `spark.hadoop.fs.s3a.endpoint=<account-id>.r2.cloudflarestorage.com` |
| `403 Forbidden` on every S3A read/write | Wrong credentials, or token expired | Rotate the R2 token; verify with `wrangler r2 object list` |
| `SignatureDoesNotMatch` | Wrong region, wrong endpoint protocol, or wrong secret key | Use `--endpoint-url https://...` and `--region auto`; verify the secret key in the R2 dashboard |
| `Could not load log store class` | Missing or wrong `spark.delta.logStore.class` | Set to `org.apache.spark.sql.delta.storage.S3SingleDriverLogStore` |
| `Connection pool shut down` | S3A connection pool exhausted | Increase `spark.hadoop.fs.s3a.connection.maximum` to 200+ |
| `Read timed out` on first read | Cold-start: R2 takes 2-5s on first request | Set `spark.hadoop.fs.s3a.connection.establish.timeout=30000` and `spark.hadoop.fs.s3a.attempts.maximum=10` |
| `java.lang.ClassNotFoundException: org.apache.hadoop.fs.s3a.S3AFileSystem` | Spark image missing hadoop-aws JAR | Add `--packages org.apache.hadoop:hadoop-aws:3.3.4` to spark-submit |

---

## 9. Reference links

- Delta Lake on S3: https://docs.delta.io/latest/delta-storage.html
- Hadoop S3A connector: https://hadoop.apache.org/docs/stable/hadoop-aws/tools/hadoop-aws/index.html
- R2 S3 API: https://developers.cloudflare.com/r2/api/s3/api/
- Spark + Delta + R2 community guide: https://developers.cloudflare.com/r2/data-catalog/
