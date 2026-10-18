from __future__ import annotations

import logging
from urllib.parse import urlparse

from delta import configure_spark_with_delta_pip
from pyspark.sql import SparkSession

from lakehouse.core.constants import (
    AWS_JAVA_SDK_PACKAGE,
    HADOOP_AWS_PACKAGE,
    KAFKA_PACKAGE,
    StorageEnv,
)
from lakehouse.core.env import get_env, get_storage_env, is_local

logger = logging.getLogger(__name__)


def _get_s3a_configs() -> dict[str, str]:
    s3_endpoint = get_env("S3_ENDPOINT")
    minio_endpoint = get_env("MINIO_ENDPOINT", "localhost:9000")
    endpoint = s3_endpoint or minio_endpoint
    endpoint_url = urlparse(endpoint if "://" in endpoint else f"//{endpoint}")
    if (
        not endpoint_url.netloc
        or endpoint_url.path not in ("", "/")
        or (endpoint_url.scheme and endpoint_url.scheme not in ("http", "https"))
    ):
        raise ValueError("S3_ENDPOINT must be a host or an http(s) endpoint URL")

    access_key = get_env("S3_ACCESS_KEY")
    secret_key = get_env("S3_SECRET_KEY")
    if s3_endpoint and (not access_key or not secret_key):
        raise ValueError("S3_ACCESS_KEY and S3_SECRET_KEY are required when S3_ENDPOINT is set")

    secure_setting = get_env("S3_USE_SSL")
    if secure_setting is None:
        secure_setting = get_env("MINIO_SECURE", "false")
    if secure_setting.lower() not in ("true", "false"):
        raise ValueError("S3_USE_SSL must be 'true' or 'false'")
    use_ssl = secure_setting.lower() == "true"
    if s3_endpoint and endpoint.startswith("https://"):
        use_ssl = True
    elif s3_endpoint and endpoint.startswith("http://"):
        use_ssl = False

    region = get_env("S3_REGION")
    if not region:
        region = "auto" if s3_endpoint else "us-east-1"
    path_style = get_env("S3_PATH_STYLE_ACCESS", "true")
    if path_style.lower() not in ("true", "false"):
        raise ValueError("S3_PATH_STYLE_ACCESS must be 'true' or 'false'")
    return {
        "spark.hadoop.fs.s3a.endpoint": endpoint_url.netloc,
        "spark.hadoop.fs.s3a.endpoint.region": region,
        "spark.hadoop.fs.s3a.access.key": access_key or get_env("MINIO_ACCESS_KEY", "minioadmin"),
        "spark.hadoop.fs.s3a.secret.key": secret_key or get_env("MINIO_SECRET_KEY", "minioadmin"),
        "spark.hadoop.fs.s3a.path.style.access": path_style.lower(),
        "spark.hadoop.fs.s3a.connection.ssl.enabled": str(use_ssl).lower(),
        "spark.hadoop.fs.s3a.aws.credentials.provider": (
            "org.apache.hadoop.fs.s3a.SimpleAWSCredentialsProvider"
        ),
        "spark.hadoop.fs.s3a.impl": "org.apache.hadoop.fs.s3a.S3AFileSystem",
    }


def _get_delta_configs() -> dict[str, str]:
    return {
        "spark.sql.extensions": "io.delta.sql.DeltaSparkSessionExtension",
        "spark.sql.catalog.spark_catalog": "org.apache.spark.sql.delta.catalog.DeltaCatalog",
        "spark.databricks.delta.schema.autoMerge.enabled": "true",
    }


def build_spark_session(
    app_name: str,
    *,
    master: str | None = None,
    extra_configs: dict[str, str] | None = None,
    with_kafka: bool = False,
) -> SparkSession:
    master = master or get_env("SPARK_MASTER", "local[*]")
    logger.info(" Building SparkSession: %s | master=%s", app_name, master)
    # In the airflow webserver/scheduler containers we have a 2GB heap by
    # default and several local Spark jobs run inside a single BashOperator
    # process. We tune the driver down to 768m to avoid the JVM getting
    # OOM-killed on the second/third small write (the original 2g setting
    # caused "ConnectionRefusedError: [Errno 111]" when a second file was
    # processed right after a successful write).
    #
    # spark.driver.maxResultSize is set to 0 (unlimited) so we don't blow
    # the budget when collect() returns a large result.
    builder = (
        SparkSession.builder.appName(app_name)
        .master(master)
        .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
        .config(
            "spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog"
        )
        .config("spark.databricks.delta.schema.autoMerge.enabled", "true")
        .config("spark.driver.memory", get_env("SPARK_DRIVER_MEMORY", "768m"))
        .config("spark.executor.memory", get_env("SPARK_EXECUTOR_MEMORY", "768m"))
        .config("spark.driver.maxResultSize", "0")
    )
    s3_endpoint = get_env("S3_ENDPOINT")
    if is_local() or s3_endpoint:
        for k, v in _get_s3a_configs().items():
            builder = builder.config(k, v)
    if extra_configs:
        for k, v in extra_configs.items():
            builder = builder.config(k, v)
    extra_packages = [HADOOP_AWS_PACKAGE, AWS_JAVA_SDK_PACKAGE]
    if with_kafka:
        extra_packages.append(KAFKA_PACKAGE)
    return configure_spark_with_delta_pip(builder, extra_packages=extra_packages).getOrCreate()


_SPARK_SESSION: SparkSession | None = None


def get_spark_session(
    app_name: str = "LakehouseApp",
    *,
    master: str | None = None,
    extra_configs: dict[str, str] | None = None,
    with_kafka: bool = False,
    force_new: bool = False,
) -> SparkSession:
    global _SPARK_SESSION
    if force_new or _SPARK_SESSION is None:
        # When ENV=databricks, prefer the active session (already configured
        # with Delta, Unity Catalog, and Kafka by the cluster runtime).
        # Calling configure_spark_with_delta_pip on a notebook would either
        # fail (the deltaspark pip extra is not installed locally) or, worse,
        # spin up a second local SparkSession that can't see the catalog.
        if get_storage_env() == StorageEnv.DATABRICKS:
            active = SparkSession.getActiveSession()
            if active is not None:
                logger.info(" Using active Databricks session: %s", active.sparkContext.appName)
                _SPARK_SESSION = active
                return _SPARK_SESSION
            # Fallback: no active session (e.g. running on a serverless job
            # context that hasn't auto-attached a session). Try to attach
            # via Databricks Connect first; if that's not available, build a
            # local Delta-enabled session WITHOUT configure_spark_with_delta_pip
            # (use the user's pre-installed delta-spark jar via extra jars).
            logger.warning(
                " ENV=databricks but no active SparkSession found; building a "
                "local Delta-enabled session instead."
            )
        _SPARK_SESSION = build_spark_session(
            app_name=app_name, master=master, extra_configs=extra_configs, with_kafka=with_kafka
        )
    return _SPARK_SESSION


def stop_spark_session() -> None:
    global _SPARK_SESSION
    if _SPARK_SESSION is not None:
        _SPARK_SESSION.stop()
        _SPARK_SESSION = None


def shell() -> None:
    spark = get_spark_session("LakehouseShell", force_new=True)
    print("=" * 60)
    print("  Lakehouse Spark Shell")
    print(f"   App: {spark.sparkContext.appName}")
    print(f"   Master: {spark.sparkContext.master}")
    print("   Spark UI: http://localhost:4040")
    print("=" * 60)
    print("\nVí dụ:")
    print("  spark.read.format('delta').load('s3a://bronze/crm/customers/').show()")
    print()
    try:
        import IPython

        IPython.embed()
    except ImportError:
        import code

        code.interact(local={"spark": spark})
