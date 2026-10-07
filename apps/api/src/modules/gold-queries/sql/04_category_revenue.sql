WITH latest_window AS (
  SELECT MAX(window_start) AS max_window
  FROM delta_scan('s3://lakehouse/gold/category_analytics/parent_category_summary')
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
FROM delta_scan('s3://lakehouse/gold/category_analytics/parent_category_summary') p
JOIN latest_window w ON p.window_start = w.max_window
ORDER BY p.total_revenue DESC
LIMIT 100;
