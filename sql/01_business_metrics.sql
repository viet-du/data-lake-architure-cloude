-- =============================================================
-- 01 - Business Metrics
-- Top metrics cho BI dashboard
-- =============================================================

-- 1.1. Daily Revenue Trend
SELECT
  order_date,
  category,
  num_orders,
  total_revenue,
  total_profit,
  unique_customers,
  avg_order_value,
  RANK() OVER (PARTITION BY order_date ORDER BY total_revenue DESC) AS revenue_rank
FROM delta.`s3a://gold/daily_revenue/`
WHERE order_date >= date_sub(current_date(), 30)
ORDER BY order_date DESC, total_revenue DESC;


-- 1.2. Top 10 Customers by Lifetime Value
SELECT
  customer_id,
  full_name,
  city,
  segment,
  total_orders,
  lifetime_revenue,
  avg_order_value,
  customer_segment_value,
  last_order_date,
  DENSE_RANK() OVER (ORDER BY lifetime_revenue DESC) AS ltv_rank
FROM delta.`s3a://gold/dim_customers/`
ORDER BY lifetime_revenue DESC
LIMIT 10;


-- 1.3. Revenue by City
SELECT
  shipping_city AS city,
  COUNT(DISTINCT order_id) AS num_orders,
  COUNT(DISTINCT customer_id) AS unique_customers,
  SUM(revenue) AS total_revenue,
  AVG(revenue) AS avg_revenue_per_order
FROM delta.`s3a://gold/fact_orders/`
WHERE order_date >= date_sub(current_date(), 30)
GROUP BY shipping_city
ORDER BY total_revenue DESC
LIMIT 20;


-- 1.4. Top 10 Products by Revenue
SELECT
  product_id,
  product_name,
  category,
  subcategory,
  SUM(quantity) AS total_quantity,
  SUM(revenue) AS total_revenue,
  COUNT(DISTINCT order_id) AS num_orders,
  AVG(unit_price) AS avg_price
FROM delta.`s3a://gold/fact_orders/`
WHERE order_date >= date_sub(current_date(), 90)
GROUP BY product_id, product_name, category, subcategory
ORDER BY total_revenue DESC
LIMIT 10;
