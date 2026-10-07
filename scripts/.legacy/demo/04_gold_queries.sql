# ============================================================
# SQL Queries cho Gold Layer
# ============================================================
"""
Query Gold layer bằng SQL để Metabase visualize.

Chạy:
  docker exec -it lake-spark-master spark-sql \
    -f /scripts/demo/04_gold_queries.sql
"""

-- ============================================================
-- Setup: Spark với Delta Lake + MinIO
-- ============================================================
SET spark.sql.extensions=io.delta.sql.DeltaSparkSessionExtension;
SET spark.sql.catalog.spark_catalog=org.apache.spark.sql.delta.catalog.DeltaCatalog;
SET spark.hadoop.fs.s3a.endpoint=http://minio:9000;
SET spark.hadoop.fs.s3a.access.key=minioadmin;
SET spark.hadoop.fs.s3a.secret.key=minioadmin;
SET spark.hadoop.fs.s3a.path.style.access=true;

-- ============================================================
-- 1. Revenue by category (doanh thu theo danh mục)
-- ============================================================
SELECT
    category,
    num_purchases,
    ROUND(total_revenue, 2) AS total_revenue,
    ROUND(avg_order_value, 2) AS avg_order_value,
    unique_buyers,
    ROUND(total_revenue / NULLIF(unique_buyers, 0), 2) AS revenue_per_buyer
FROM delta.`s3a://gold/clickstream/revenue_by_category/`
ORDER BY total_revenue DESC
LIMIT 20;

-- ============================================================
-- 2. Active users theo giờ
-- ============================================================
SELECT
    event_date,
    event_hour,
    active_users,
    active_sessions,
    total_events,
    ROUND(total_events * 1.0 / NULLIF(active_sessions, 0), 2) AS events_per_session
FROM delta.`s3a://gold/clickstream/active_users/`
ORDER BY event_date DESC, event_hour DESC
LIMIT 48;

-- ============================================================
-- 3. Top products theo conversion rate
-- ============================================================
SELECT
    product_id,
    category,
    total_events,
    add_to_carts,
    purchases,
    conversion_rate
FROM delta.`s3a://gold/clickstream/top_products/`
WHERE total_events >= 5
ORDER BY purchases DESC, conversion_rate DESC
LIMIT 20;

-- ============================================================
-- 4. Real-time KPI dashboard
-- ============================================================
SELECT
    'Total Events' AS metric,
    COUNT(*) AS value
FROM delta.`s3a://silver/clickstream/events/`
UNION ALL
SELECT
    'Unique Users' AS metric,
    COUNT(DISTINCT user_id) AS value
FROM delta.`s3a://silver/clickstream/events/`
UNION ALL
SELECT
    'Total Revenue' AS metric,
    ROUND(SUM(amount), 2) AS value
FROM delta.`s3a://silver/clickstream/events/`
WHERE event_type = 'purchase';

-- ============================================================
-- 5. Funnel analysis (page_view → add_to_cart → purchase)
-- ============================================================
WITH funnel AS (
    SELECT
        event_type,
        COUNT(DISTINCT user_id) AS users
    FROM delta.`s3a://silver/clickstream/events/`
    GROUP BY event_type
)
SELECT
    event_type,
    users,
    ROUND(users * 100.0 / MAX(users) OVER (), 2) AS percentage
FROM funnel
ORDER BY users DESC;