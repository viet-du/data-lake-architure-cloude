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
    WHEN last_order_date >= current_date - INTERVAL 30 DAY THEN 'Active'
    WHEN last_order_date < current_date - INTERVAL 90 DAY THEN 'At Risk'
    ELSE 'Lost'
  END AS rfm_segment
FROM delta_scan('s3://lakehouse/gold/ecommerce/dim_customers')
ORDER BY lifetime_revenue DESC
LIMIT 100;
