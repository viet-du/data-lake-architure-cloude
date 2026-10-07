SELECT
  category,
  subcategory,
  COUNT(DISTINCT product_id) AS num_products,
  SUM(quantity) AS total_quantity_sold,
  SUM(revenue) AS total_revenue,
  SUM(profit) AS total_profit,
  AVG(unit_price) AS avg_price,
  AVG(quantity) AS avg_quantity_per_order
FROM delta_scan('s3://lakehouse/gold/ecommerce/fact_orders')
WHERE order_date >= current_date - INTERVAL 90 DAY
GROUP BY category, subcategory
ORDER BY total_revenue DESC
LIMIT 100;
