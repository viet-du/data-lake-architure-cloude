import sys
import os
from pathlib import Path
from datetime import datetime
from pyspark.sql import SparkSession
from delta import configure_spark_with_delta_pip
DATA_SAMPLES_DIR = Path(__file__).parent.parent / 'data-samples'
BRONZE_BUCKET = 's3a://bronze/'

def create_spark():
    builder = SparkSession.builder.appName('01_IngestToBronze').config('spark.sql.extensions', 'io.delta.sql.DeltaSparkSessionExtension').config('spark.sql.catalog.spark_catalog', 'org.apache.spark.sql.delta.catalog.DeltaCatalog').config('spark.databricks.delta.schema.autoMerge.enabled', 'true').config('spark.hadoop.fs.s3a.endpoint', 'http://localhost:9000').config('spark.hadoop.fs.s3a.access.key', 'minioadmin').config('spark.hadoop.fs.s3a.secret.key', 'minioadmin').config('spark.hadoop.fs.s3a.path.style.access', 'true').config('spark.hadoop.fs.s3a.impl', 'org.apache.hadoop.fs.s3a.S3AFileSystem')
    return configure_spark_with_delta_pip(builder).getOrCreate()

def ingest_csv(spark, csv_path: Path, bronze_path: str, source_name: str):
    if not csv_path.exists():
        print(f'  {csv_path} not found, skipping')
        return 0
    print(f'\n Ingesting {csv_path.name} → {bronze_path}')
    df = spark.read.csv(str(csv_path), header=True, inferSchema=True)
    df = df.withColumn('_ingestion_timestamp', F_current_timestamp()).withColumn('_ingestion_date', F_date_format(F_current_timestamp(), 'yyyy-MM-dd')).withColumn('_source_file', F_lit(csv_path.name)).withColumn('_source_system', F_lit(source_name))
    from pyspark.sql.functions import lit, current_timestamp, date_format
    df = df.withColumn('_ingestion_timestamp', current_timestamp()).withColumn('_ingestion_date', date_format(current_timestamp(), 'yyyy-MM-dd')).withColumn('_source_file', lit(csv_path.name)).withColumn('_source_system', lit(source_name))
    row_count = df.count()
    df.write.format('delta').mode('append').partitionBy('_ingestion_date').save(bronze_path)
    print(f' {row_count} rows → {bronze_path}')
    return row_count

def ingest_json(spark, json_path: Path, bronze_path: str, source_name: str):
    if not json_path.exists():
        print(f'  {json_path} not found, skipping')
        return 0
    print(f'\n Ingesting {json_path.name} → {bronze_path}')
    df = spark.read.json(str(json_path))
    from pyspark.sql.functions import lit, current_timestamp, date_format
    df = df.withColumn('_ingestion_timestamp', current_timestamp()).withColumn('_ingestion_date', date_format(current_timestamp(), 'yyyy-MM-dd')).withColumn('_source_file', lit(json_path.name)).withColumn('_source_system', lit(source_name))
    row_count = df.count()
    df.write.format('delta').mode('append').partitionBy('_ingestion_date').save(bronze_path)
    print(f' {row_count} rows → {bronze_path}')
    return row_count

def main():
    spark = create_spark()
    spark.sparkContext.setLogLevel('WARN')
    print('=' * 60)
    print(' BRONZE INGEST - CSV/JSON → Delta Lake')
    print('=' * 60)
    total = 0
    total += ingest_csv(spark, DATA_SAMPLES_DIR / 'customers.csv', f'{BRONZE_BUCKET}crm/customers/', 'crm_db')
    total += ingest_csv(spark, DATA_SAMPLES_DIR / 'products.csv', f'{BRONZE_BUCKET}erp/products/', 'erp_db')
    total += ingest_json(spark, DATA_SAMPLES_DIR / 'orders.json', f'{BRONZE_BUCKET}erp/orders/', 'erp_db')
    print(f"\n{'=' * 60}")
    print(f' Total ingested: {total} rows')
    print(f"{'=' * 60}")
    spark.stop()
if __name__ == '__main__':
    main()