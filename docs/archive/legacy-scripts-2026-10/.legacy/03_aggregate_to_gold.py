from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from delta import configure_spark_with_delta_pip

def create_spark():
    builder = SparkSession.builder.appName('03_AggregateToGold').config('spark.sql.extensions', 'io.delta.sql.DeltaSparkSessionExtension').config('spark.sql.catalog.spark_catalog', 'org.apache.spark.sql.delta.catalog.DeltaCatalog').config('spark.hadoop.fs.s3a.endpoint', 'http://minio:9000').config('spark.hadoop.fs.s3a.access.key', 'minioadmin').config('spark.hadoop.fs.s3a.secret.key', 'minioadmin').config('spark.hadoop.fs.s3a.path.style.access', 'true').config('spark.hadoop.fs.s3a.impl', 'org.apache.hadoop.fs.s3a.S3AFileSystem')
    return configure_spark_with_delta_pip(builder).getOrCreate()

def build_fact_orders(spark):
    print('\n Build: fact_orders')
    orders = spark.read.format('delta').load('s3a://silver/orders/')
    customers = spark.read.format('delta').load('s3a://silver/customers/')
    products = spark.read.format('delta').load('s3a://silver/products/')
    fact = orders.join(customers.select('customer_id', 'full_name', 'city', 'segment'), 'customer_id', 'left').join(products.select('product_id', 'product_name', 'category', 'subcategory'), 'product_id', 'left').withColumn('revenue', F.col('line_total')).withColumn('cost', F.col('line_total') * 0.6).withColumn('profit', F.col('revenue') - F.col('cost')).select('order_id', 'order_date', 'customer_id', 'full_name', 'city', 'segment', 'product_id', 'product_name', 'category', 'subcategory', 'quantity', 'unit_price', 'line_total', 'total_amount', 'revenue', 'cost', 'profit', 'status', 'payment_method', 'shipping_city')
    fact.write.format('delta').mode('overwrite').partitionBy('order_date').save('s3a://gold/fact_orders/')
    print(f' {fact.count()} fact rows → s3a://gold/fact_orders/')

def build_dim_customers(spark):
    print('\n Build: dim_customers')
    customers = spark.read.format('delta').load('s3a://silver/customers/')
    orders = spark.read.format('delta').load('s3a://silver/orders/')
    customer_metrics = orders.groupBy('customer_id').agg(F.countDistinct('order_id').alias('total_orders'), F.sum('total_amount').alias('lifetime_revenue'), F.avg('total_amount').alias('avg_order_value'), F.max('order_date').alias('last_order_date'))
    dim = customers.join(customer_metrics, 'customer_id', 'left').withColumn('customer_segment_value', F.when(F.col('lifetime_revenue') > 5000, 'VIP').when(F.col('lifetime_revenue') > 1000, 'Gold').when(F.col('lifetime_revenue') > 100, 'Silver').otherwise('Bronze')).na.fill(0, ['total_orders', 'lifetime_revenue'])
    dim.write.format('delta').mode('overwrite').save('s3a://gold/dim_customers/')
    print(f' {dim.count()} dim rows → s3a://gold/dim_customers/')

def build_daily_revenue(spark):
    print('\n Build: daily_revenue')
    fact = spark.read.format('delta').load('s3a://gold/fact_orders/')
    daily = fact.groupBy('order_date', 'category').agg(F.countDistinct('order_id').alias('num_orders'), F.sum('revenue').alias('total_revenue'), F.sum('profit').alias('total_profit'), F.countDistinct('customer_id').alias('unique_customers'), F.sum('quantity').alias('total_quantity')).withColumn('avg_order_value', F.col('total_revenue') / F.col('num_orders'))
    daily.write.format('delta').mode('overwrite').partitionBy('order_date').save('s3a://gold/daily_revenue/')
    print(f' {daily.count()} daily rows → s3a://gold/daily_revenue/')

def main():
    spark = create_spark()
    spark.sparkContext.setLogLevel('WARN')
    print('=' * 60)
    print(' SILVER → GOLD AGGREGATE')
    print('=' * 60)
    build_fact_orders(spark)
    build_dim_customers(spark)
    build_daily_revenue(spark)
    print(f"\n{'=' * 60}")
    print(' Gold layer done!')
    print('=' * 60)
    spark.stop()
if __name__ == '__main__':
    main()