from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType
from delta import configure_spark_with_delta_pip
KAFKA_BOOTSTRAP = 'kafka:29092'
TOPIC = 'clickstream-events'
BRONZE_PATH = 's3a://bronze/clickstream/events/'
CHECKPOINT = 's3a://bronze/clickstream/_checkpoints/'
schema = StructType([StructField('event_id', StringType(), False), StructField('user_id', StringType(), False), StructField('session_id', StringType(), False), StructField('event_type', StringType(), False), StructField('page_url', StringType(), True), StructField('timestamp', StringType(), False), StructField('metadata', StringType(), True)])

def main():
    spark = configure_spark_with_delta_pip(SparkSession.builder.appName('KafkaToBronze').config('spark.sql.extensions', 'io.delta.sql.DeltaSparkSessionExtension').config('spark.sql.catalog.spark_catalog', 'org.apache.spark.sql.delta.catalog.DeltaCatalog').config('spark.hadoop.fs.s3a.endpoint', 'http://minio:9000').config('spark.hadoop.fs.s3a.access.key', 'minioadmin').config('spark.hadoop.fs.s3a.secret.key', 'minioadmin').config('spark.hadoop.fs.s3a.path.style.access', 'true')).getOrCreate()
    spark.sparkContext.setLogLevel('WARN')
    print(' Kafka → Bronze Streaming')
    df = spark.readStream.format('kafka').option('kafka.bootstrap.servers', KAFKA_BOOTSTRAP).option('subscribe', TOPIC).option('startingOffsets', 'latest').option('maxOffsetsPerTrigger', 1000).load().select(F.col('offset').alias('kafka_offset'), F.from_json(F.col('value').cast('string'), schema).alias('data')).select('kafka_offset', 'data.*').withColumn('processing_ts', F.current_timestamp()).withColumn('ingestion_date', F.date_format(F.current_timestamp(), 'yyyy-MM-dd'))
    query = df.writeStream.format('delta').outputMode('append').partitionBy('ingestion_date').option('checkpointLocation', CHECKPOINT).option('path', BRONZE_PATH).trigger(availableNow=True).start()
    print(f' Started: {query.id}')
    query.awaitTermination()
if __name__ == '__main__':
    main()