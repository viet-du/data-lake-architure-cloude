from __future__ import annotations
import logging
from functools import lru_cache
from delta import configure_spark_with_delta_pip
from pyspark.sql import SparkSession
from lakehouse.core.constants import DELTA_PACKAGE, KAFKA_PACKAGE
from lakehouse.core.env import get_env, is_local
logger = logging.getLogger(__name__)

def _get_local_s3a_configs() -> dict[str, str]:
    return {'spark.hadoop.fs.s3a.endpoint': get_env('MINIO_ENDPOINT', 'localhost:9000'), 'spark.hadoop.fs.s3a.access.key': get_env('MINIO_ACCESS_KEY', 'minioadmin'), 'spark.hadoop.fs.s3a.secret.key': get_env('MINIO_SECRET_KEY', 'minioadmin'), 'spark.hadoop.fs.s3a.path.style.access': 'true', 'spark.hadoop.fs.s3a.impl': 'org.apache.hadoop.fs.s3a.S3AFileSystem', 'spark.hadoop.fs.s3a.connection.ssl.enabled': 'false'}

def _get_delta_configs() -> dict[str, str]:
    return {'spark.sql.extensions': 'io.delta.sql.DeltaSparkSessionExtension', 'spark.sql.catalog.spark_catalog': 'org.apache.spark.sql.delta.catalog.DeltaCatalog', 'spark.databricks.delta.schema.autoMerge.enabled': 'true'}

def _get_kafka_configs() -> dict[str, str]:
    return {'spark.jars.packages': f'{KAFKA_PACKAGE},{DELTA_PACKAGE}'}

def build_spark_session(app_name: str, *, master: str | None=None, extra_configs: dict[str, str] | None=None, with_kafka: bool=False) -> SparkSession:
    master = master or get_env('SPARK_MASTER', 'local[*]')
    logger.info(' Building SparkSession: %s | master=%s', app_name, master)
    builder = SparkSession.builder.appName(app_name).master(master).config('spark.sql.extensions', 'io.delta.sql.DeltaSparkSessionExtension').config('spark.sql.catalog.spark_catalog', 'org.apache.spark.sql.delta.catalog.DeltaCatalog').config('spark.databricks.delta.schema.autoMerge.enabled', 'true').config('spark.driver.memory', get_env('SPARK_DRIVER_MEMORY', '2g')).config('spark.executor.memory', get_env('SPARK_EXECUTOR_MEMORY', '2g'))
    if is_local():
        for (k, v) in _get_local_s3a_configs().items():
            builder = builder.config(k, v)
    if with_kafka:
        for (k, v) in _get_kafka_configs().items():
            builder = builder.config(k, v)
    if extra_configs:
        for (k, v) in extra_configs.items():
            builder = builder.config(k, v)
    return configure_spark_with_delta_pip(builder).getOrCreate()
_SPARK_SESSION: SparkSession | None = None

def get_spark_session(app_name: str='LakehouseApp', *, master: str | None=None, extra_configs: dict[str, str] | None=None, with_kafka: bool=False, force_new: bool=False) -> SparkSession:
    global _SPARK_SESSION
    if force_new or _SPARK_SESSION is None:
        _SPARK_SESSION = build_spark_session(app_name=app_name, master=master, extra_configs=extra_configs, with_kafka=with_kafka)
    return _SPARK_SESSION

def stop_spark_session() -> None:
    global _SPARK_SESSION
    if _SPARK_SESSION is not None:
        _SPARK_SESSION.stop()
        _SPARK_SESSION = None

def shell() -> None:
    spark = get_spark_session('LakehouseShell', force_new=True)
    print('=' * 60)
    print('  Lakehouse Spark Shell')
    print(f'   App: {spark.sparkContext.appName}')
    print(f'   Master: {spark.sparkContext.master}')
    print(f'   Spark UI: http://localhost:4040')
    print('=' * 60)
    print('\nVí dụ:')
    print("  spark.read.format('delta').load('s3a://bronze/crm/customers/').show()")
    print()
    try:
        import IPython
        IPython.embed()
    except ImportError:
        import code
        code.interact(local={'spark': spark})