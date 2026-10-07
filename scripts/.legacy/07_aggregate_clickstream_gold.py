from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from delta import configure_spark_with_delta_pip
BRONZE_PATH = 's3a://bronze/clickstream/events/'
SILVER_PATH = 's3a://silver/clickstream/events/'
GOLD_PATH = 's3a://gold/clickstream/'

def main():
    spark = configure_spark_with_delta_pip(SparkSession.builder.appName('ClickstreamGold').config('spark.sql.extensions', 'io.delta.sql.DeltaSparkSessionExtension').config('spark.sql.catalog.spark_catalog', 'org.apache.spark.sql.delta.catalog.DeltaCatalog').config('spark.hadoop.fs.s3a.endpoint', 'http://minio:9000').config('spark.hadoop.fs.s3a.access.key', 'minioadmin').config('spark.hadoop.fs.s3a.secret.key', 'minioadmin').config('spark.hadoop.fs.s3a.path.style.access', 'true')).getOrCreate()
    spark.sparkContext.setLogLevel('WARN')
    bronze = spark.readStream.format('delta').option('ignoreChanges', 'true').load(BRONZE_PATH)
    silver = bronze.filter(F.col('event_id').isNotNull()).filter(F.col('user_id').isNotNull()).withColumn('event_type', F.lower(F.trim(F.col('event_type')))).dropDuplicates(['event_id']).withColumn('processing_date', F.date_format(F.current_timestamp(), 'yyyy-MM-dd'))
    silver_q = silver.writeStream.format('delta').outputMode('append').partitionBy('processing_date').option('checkpointLocation', f'{SILVER_PATH}_checkpoints/').option('path', SILVER_PATH).trigger(availableNow=True).start()
    silver_df = spark.readStream.format('delta').load(SILVER_PATH).withWatermark('processing_ts', '10 minutes')
    events_per_window = silver_df.groupBy(F.window(F.col('processing_ts'), '5 minutes', '1 minute'), F.col('event_type')).agg(F.count('*').alias('event_count'), F.countDistinct('user_id').alias('unique_users')).select(F.col('window.start').alias('window_start'), F.col('window.end').alias('window_end'), 'event_type', 'event_count', 'unique_users')
    gold_q = events_per_window.writeStream.format('delta').outputMode('append').option('checkpointLocation', f'{GOLD_PATH}events_per_window/_checkpoints/').option('path', f'{GOLD_PATH}events_per_window/').trigger(availableNow=True).start()
    print(f' Silver: {silver_q.id}, Gold: {gold_q.id}')
    spark.streams.awaitAnyTermination()
if __name__ == '__main__':
    main()