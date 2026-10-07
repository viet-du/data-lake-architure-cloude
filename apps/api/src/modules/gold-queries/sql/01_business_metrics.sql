SELECT
  order_date,
  category,
  num_orders,
  total_revenue,
  total_profit,
  unique_customers,
  avg_order_value,
  RANK() OVER (PARTITION BY order_date ORDER BY total_revenue DESC) AS revenue_rank
FROM delta_scan('s3://lakehouse/gold/ecommerce/daily_revenue')
WHERE order_date >= current_date - INTERVAL 30 DAY
ORDER BY order_date DESC, total_revenue DESC
LIMIT 100;
