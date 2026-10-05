-- =============================================================
-- 02 - Customer Analytics
-- Phân tích hành vi khách hàng
-- =============================================================

-- 2.1. Customer Segmentation (RFM-like)
SELECT
  customer_id,
  full_name,
  city,
  segment,
  customer_segment_value,
  total_orders,
  lifetime_revenue,
  avg_order_value,
  last_order_date,
  CASE
    WHEN total_orders >= 10 AND lifetime_revenue > 5000 THEN 'Champion'
    WHEN total_orders >= 5 AND lifetime_revenue > 2000 THEN 'Loyal'
    WHEN last_order_date >= date_sub(current_date(), 30) THEN 'Active'
    WHEN last_order_date < date_sub(current_date(), 90) THEN 'At Risk'
    ELSE 'Lost'
  END AS rfm_segment
FROM delta.`s3a://gold/dim_customers/`
ORDER BY lifetime_revenue DESC;


-- 2.2. Customer Cohort Analysis
WITH customer_cohort AS (
  SELECT
    customer_id,
    DATE_TRUNC('month', registration_date) AS cohort_month
  FROM delta.`s3a://silver/customers/`
),
customer_orders AS (
  SELECT
    customer_id,
    DATE_TRUNC('month', order_date) AS order_month,
    COUNT(DISTINCT order_id) AS orders
  FROM delta.`s3a://silver/orders/`
  GROUP BY customer_id, DATE_TRUNC('month', order_date)
)
SELECT
  c.cohort_month,
  o.order_month,
  COUNT(DISTINCT c.customer_id) AS customers,
  SUM(o.orders) AS total_orders
FROM customer_cohort c
JOIN customer_orders o ON c.customer_id = o.customer_id
GROUP BY c.cohort_month, o.order_month
ORDER BY c.cohort_month, o.order_month;


-- 2.3. Top 5 Customers per City
WITH ranked AS (
  SELECT
    city,
    full_name,
    customer_id,
    lifetime_revenue,
    ROW_NUMBER() OVER (PARTITION BY city ORDER BY lifetime_revenue DESC) AS rank
  FROM delta.`s3a://gold/dim_customers/`
)
SELECT * FROM ranked WHERE rank <= 5
ORDER BY city, rank;
