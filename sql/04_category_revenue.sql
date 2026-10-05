-- =============================================================
-- 04 - Category Revenue Analytics
-- Phân tích doanh số theo danh mục real-time
-- Data source: s3a://gold/category_analytics/
-- =============================================================

-- 4.1. Top 10 Parent Categories theo doanh thu (5-min window mới nhất)
WITH latest_window AS (
  SELECT MAX(window_start) AS max_window
  FROM delta.`s3a://gold/category_analytics/parent_category_summary/`
)
SELECT
  p.parent_category,
  p.total_products,
  p.num_subcategories,
  p.total_units_sold,
  ROUND(p.total_revenue, 0) AS total_revenue_vnd,
  ROUND(p.avg_price, 0) AS avg_price,
  ROUND(p.avg_rating, 2) AS avg_rating,
  p.num_brands,
  ROUND(p.total_revenue / NULLIF(p.total_products, 0), 0) AS revenue_per_product
FROM delta.`s3a://gold/category_analytics/parent_category_summary/` p
JOIN latest_window w ON p.window_start = w.max_window
ORDER BY p.total_revenue DESC
LIMIT 10;


-- 4.2. Doanh thu theo từng Category (chi tiết)
WITH latest_window AS (
  SELECT MAX(window_start) AS max_window
  FROM delta.`s3a://gold/category_analytics/revenue_by_category/`
)
SELECT
  r.category_key,
  r.category_name,
  r.parent_category,
  r.product_count,
  r.unique_products,
  r.total_units_sold,
  ROUND(r.total_revenue_estimate, 0) AS estimated_revenue,
  ROUND(r.avg_price, 0) AS avg_price,
  ROUND(r.avg_rating, 2) AS avg_rating,
  ROUND(r.avg_discount_rate, 2) AS avg_discount_pct,
  ROUND(r.total_revenue_estimate / NULLIF(r.product_count, 0), 0) AS revenue_per_product
FROM delta.`s3a://gold/category_analytics/revenue_by_category/` r
JOIN latest_window w ON r.window_start = w.max_window
ORDER BY r.total_revenue_estimate DESC
LIMIT 20;


-- 4.3. So sánh doanh thu các category theo thời gian (time series)
SELECT
  window_start,
  category_name,
  parent_category,
  product_count,
  total_units_sold,
  ROUND(total_revenue_estimate, 0) AS revenue
FROM delta.`s3a://gold/category_analytics/revenue_by_category/`
WHERE window_start >= current_timestamp() - INTERVAL 1 HOUR
ORDER BY window_start DESC, total_revenue_estimate DESC
LIMIT 100;


-- 4.4. Top 10 Best Sellers per Category
SELECT
  category_name,
  top_10_products
FROM delta.`s3a://gold/category_analytics/top_products_by_category/`
ORDER BY window_start DESC
LIMIT 10;


-- 4.5. Phân tích Discount theo Category
WITH latest AS (
  SELECT MAX(window_start) AS w FROM delta.`s3a://gold/category_analytics/discount_analysis/`
)
SELECT
  d.category_key,
  d.discount_tier,
  d.product_count,
  ROUND(d.avg_price, 0) AS avg_price,
  ROUND(d.avg_original_price, 0) AS avg_original_price,
  ROUND(d.total_discount_value, 0) AS total_discount_vnd,
  ROUND(d.avg_units_sold, 1) AS avg_units_sold
FROM delta.`s3a://gold/category_analytics/discount_analysis/` d
JOIN latest l ON d.window_start = l.w
ORDER BY d.category_key, d.discount_tier;


-- 4.6. Market share (% doanh thu) theo parent category
WITH latest AS (
  SELECT MAX(window_start) AS w FROM delta.`s3a://gold/category_analytics/parent_category_summary/`
),
totals AS (
  SELECT SUM(total_revenue) AS grand_total
  FROM delta.`s3a://gold/category_analytics/parent_category_summary/`
  WHERE window_start = (SELECT w FROM latest)
)
SELECT
  p.parent_category,
  p.total_products,
  ROUND(p.total_revenue, 0) AS revenue,
  ROUND(p.total_revenue / t.grand_total * 100, 2) AS market_share_pct,
  p.num_subcategories,
  p.num_brands
FROM delta.`s3a://gold/category_analytics/parent_category_summary/` p
CROSS JOIN totals t
WHERE p.window_start = (SELECT w FROM latest)
ORDER BY market_share_pct DESC;


-- 4.7. Growth rate (doanh thu 5-min này vs 5-min trước)
WITH windows_ranked AS (
  SELECT
    category_name,
    parent_category,
    window_start,
    total_revenue_estimate,
    LAG(total_revenue_estimate) OVER (PARTITION BY category_key ORDER BY window_start) AS prev_revenue
  FROM delta.`s3a://gold/category_analytics/revenue_by_category/`
  WHERE window_start >= current_timestamp() - INTERVAL 30 MINUTES
)
SELECT
  category_name,
  parent_category,
  window_start,
  ROUND(total_revenue_estimate, 0) AS current_revenue,
  ROUND(prev_revenue, 0) AS prev_revenue,
  ROUND((total_revenue_estimate - prev_revenue) / NULLIF(prev_revenue, 0) * 100, 2) AS growth_pct
FROM windows_ranked
WHERE prev_revenue IS NOT NULL
ORDER BY growth_pct DESC
LIMIT 20;


-- 4.8. Categories có nhiều sản phẩm bestseller (>1000 đã bán)
SELECT
  category_key,
  category_name,
  parent_category,
  COUNT(*) AS bestseller_count
FROM delta.`s3a://silver/tiki/categories/`
WHERE order_count > 1000
  AND processing_date = current_date()
GROUP BY category_key, category_name, parent_category
ORDER BY bestseller_count DESC
LIMIT 15;
