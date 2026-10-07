from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, IntegerType, TimestampType
KAFKA_BROKER = 'redpanda:9092'
TOPIC = 'clickstream-events'
BRONZE_PATH = 's3a://bronze/clickstream/events/'
CHECKPOINT_PATH = 's3a://bronze/checkpoints/clickstream/'
TRIGGER_INTERVAL = '10 seconds'
print(' Creating Spark session...')
spark = SparkSession.builder.appName('Redpanda-to-Delta-Lake').config('spark.sql.extensions', 'io.delta.sql.DeltaSparkSessionExtension').config('spark.sql.catalog.spark_catalog', 'org.apache.spark.sql.delta.catalog.DeltaCatalog').config('spark.hadoop.fs.s3a.endpoint', 'http://minio:9000').config('spark.hadoop.fs.s3a.access.key', 'minioadmin').config('spark.hadoop.fs.s3a.secret.key', 'minioadmin').config('spark.hadoop.fs.s3a.path.style.access', 'true').config('spark.hadoop.fs.s3a.impl', 'org.apache.hadoop.fs.s3a.S3AFileSystem').getOrCreate()
spark.sparkContext.setLogLevel('WARN')
print(f' Spark version: {spark.version}')
event_schema = StructType([StructField('event_id', StringType(), True), StructField('user_id', StringType(), True), StructField('session_id', StringType(), True), StructField('event_type', StringType(), True), StructField('page', StringType(), True), StructField('category', StringType(), True), StructField('product_id', StringType(), True), StructField('amount', DoubleType(), True), StructField('timestamp', StringType(), True), StructField('ip_address', StringType(), True), StructField('user_agent', StringType(), True)])
print(f"\n Reading from Redpanda topic '{TOPIC}'...")
raw_stream = spark.readStream.format('kafka').option('kafka.bootstrap.servers', KAFKA_BROKER).option('subscribe', TOPIC).option('startingOffsets', 'latest').option('failOnDataLoss', 'false').option('maxOffsetsPerTrigger', 1000).load()
print(f' Stream schema:')
raw_stream.printSchema()
print(f'\n Parsing JSON...')
parsed_stream = raw_stream.select(F.col('key').cast('string').alias('kafka_key'), F.from_json(F.col('value').cast('string'), event_schema).alias('data'), F.col('topic'), F.col('partition'), F.col('offset'), F.col('timestamp').alias('kafka_timestamp')).select('kafka_key', 'data.*', 'topic', 'partition', 'offset', 'kafka_timestamp')
print(f'\n Adding Bronze layer metadata...')
bronze_stream = parsed_stream.withColumn('_ingestion_timestamp', F.current_timestamp()).withColumn('_ingestion_date', F.date_format(F.current_timestamp(), 'yyyy-MM-dd')).withColumn('_kafka_offset', F.col('offset')).withColumn('_kafka_partition', F.col('partition'))
print(f'\n Writing to MinIO: {BRONZE_PATH}')
print(f' Checkpoint: {CHECKPOINT_PATH}')
print(f'⏱  Trigger: every {TRIGGER_INTERVAL}')
print(f"\n{'=' * 60}")
print(' Listening... (Press Ctrl+C to stop)')
print(f"{'=' * 60}\n")
query = bronze_stream.writeStream.format('delta').outputMode('append').option('checkpointLocation', CHECKPOINT_PATH).partitionBy('_ingestion_date').trigger(processingTime=TRIGGER_INTERVAL).start(BRONZE_PATH)
try:
    query.awaitTermination()
except KeyboardInterrupt:
    print(f'\n⏹  Stopping...')
    query.stop()
    print(f' Stream stopped')
    print(f' Query data at:')
    print(f'   - MinIO Console: http://localhost:9001 (bucket: bronze)')
    print(f'   - Spark Master: http://localhost:8080')
    print(f'   - Metabase: http://localhost:3000')