-- =============================================================
-- 03 - Product Performance
-- Phân tích hiệu quả sản phẩm
-- =============================================================

-- 3.1. Product Performance by Category
SELECT
  category,
  subcategory,
  COUNT(DISTINCT product_id) AS num_products,
  SUM(quantity) AS total_quantity_sold,
  SUM(revenue) AS total_revenue,
  SUM(profit) AS total_profit,
  AVG(unit_price) AS avg_price,
  AVG(quantity) AS avg_quantity_per_order
FROM delta.`s3a://gold/fact_orders/`
WHERE order_date >= date_sub(current_date(), 90)
GROUP BY category, subcategory
ORDER BY total_revenue DESC;


-- 3.2. Best Sellers
SELECT
  product_id,
  product_name,
  category,
  subcategory,
  SUM(quantity) AS units_sold,
  SUM(revenue) AS revenue,
  COUNT(DISTINCT order_id) AS num_orders,
  AVG(unit_price) AS avg_price
FROM delta.`s3a://gold/fact_orders/`
WHERE order_date >= date_sub(current_date(), 30)
GROUP BY product_id, product_name, category, subcategory
ORDER BY units_sold DESC
LIMIT 20;


-- 3.3. Slow Movers (low sales, high stock)
SELECT
  p.product_id,
  p.product_name,
  p.category,
  p.price,
  p.stock_quantity,
  COALESCE(SUM(o.quantity), 0) AS qty_sold_last_90d
FROM delta.`s3a://silver/products/` p
LEFT JOIN delta.`s3a://gold/fact_orders/` o
  ON p.product_id = o.product_id
  AND o.order_date >= date_sub(current_date(), 90)
GROUP BY p.product_id, p.product_name, p.category, p.price, p.stock_quantity
HAVING qty_sold_last_90d < 5 AND p.stock_quantity > 50
ORDER BY p.stock_quantity DESC;


-- 3.4. Category Performance Month-over-Month
WITH monthly AS (
  SELECT
    DATE_TRUNC('month', order_date) AS month,
    category,
    SUM(revenue) AS revenue
  FROM delta.`s3a://gold/fact_orders/`
  GROUP BY DATE_TRUNC('month', order_date), category
)
SELECT
  month,
  category,
  revenue,
  LAG(revenue) OVER (PARTITION BY category ORDER BY month) AS prev_month_revenue,
  ROUND((revenue - LAG(revenue) OVER (PARTITION BY category ORDER BY month))
    / NULLIF(LAG(revenue) OVER (PARTITION BY category ORDER BY month), 0) * 100, 2) AS mom_growth_pct
FROM monthly
ORDER BY category, month;
