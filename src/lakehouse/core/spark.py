from __future__ import annotations

import logging
import os
from pathlib import Path
from urllib.parse import urlparse

from pyspark.sql import SparkSession

from lakehouse.core.constants import (
    AWS_JAVA_SDK_PACKAGE,
    DELTA_PACKAGE,
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


def _local_jars_dirs() -> list[Path]:
    """Return every directory that already holds Spark JARs.

    Two locations matter:

    - ``pyspark/jars`` inside the installed package — the Airflow image
      pre-bundles Delta / hadoop-aws / aws-sdk there;
    - ``$SPARK_HOME/jars`` — the Bitnami Spark image ships its JAR set
      there, and ``spark-submit`` puts that directory on the classpath.

    Both are searched because the runtime image and the Airflow image stage
    the very same artifacts under different roots.
    """
    dirs: list[Path] = []
    try:
        import pyspark

        dirs.append(Path(pyspark.__file__).resolve().parent / "jars")
    except Exception:  # pragma: no cover - pyspark is a hard dependency
        pass

    spark_home = os.environ.get("SPARK_HOME")
    if spark_home:
        dirs.append(Path(spark_home) / "jars")

    return [d for d in dirs if d.is_dir()]


def _has_local_jar(jars_dirs: list[Path], artifact: str) -> bool:
    """True when a JAR for ``artifact`` is present in one of the JAR dirs.

    ``artifact`` is a Maven artifact id such as ``delta-spark_2.12`` or
    ``hadoop-aws``. The match is intentionally loose on the version so a
    slightly different patch release still counts as "already bundled"
    (the Airflow image ships ``aws-java-sdk-bundle-1.12.367`` while the
    pinned coordinate is ``1.12.262``).
    """
    prefix = f"{artifact.lower()}-"
    for jars_dir in jars_dirs:
        try:
            for entry in jars_dir.iterdir():
                name = entry.name.lower()
                if name.endswith(".jar") and name.startswith(prefix):
                    return True
        except OSError:  # pragma: no cover - defensive
            continue
    return False


def _resolve_package_artifacts(jars_dirs: list[Path]) -> list[str]:
    """Return the Maven coordinates that still need to be downloaded.

    Every artifact this project uses is pre-bundled into the runtime images
    (see ``Dockerfile.airflow`` and ``Dockerfile.spark-runtime``). Checking
    first keeps Spark from setting ``spark.jars.packages`` at all, because
    that setting makes the JVM resolve the coordinates through Ivy — which
    fails inside the compose network (the download of the *descriptor* fails
    with "impossible to move part file to definitive one") and kills the
    Spark gateway with ``[JAVA_GATEWAY_EXITED]``.
    """
    requested = [DELTA_PACKAGE, HADOOP_AWS_PACKAGE, AWS_JAVA_SDK_PACKAGE]
    if not jars_dirs:
        return requested
    missing: list[str] = []
    for coordinate in requested:
        parts = coordinate.split(":")
        artifact = parts[-2] if len(parts) >= 2 else parts[-1]
        if not _has_local_jar(jars_dirs, artifact):
            missing.append(coordinate)
    return missing


def _kafka_jar_available(jars_dirs: list[Path]) -> bool:
    """True when the Spark Kafka connector is already bundled."""
    return _has_local_jar(jars_dirs, "spark-sql-kafka")


def _resolve_master(explicit: str | None) -> str | None:
    """Resolve the Spark master, or ``None`` to keep the launcher's choice.

    Under ``spark-submit`` the launcher has already resolved the master
    (the ``--master`` flag) and the JVM is bootstrapped by the launcher.
    Overriding it here silently redirects the driver to a *different*
    cluster:

    - the retail DAG passes ``--master local[1]`` on purpose, so the batch
      job stays inside the ``lake-spark-master`` container;
    - but the Bitnami image exports ``SPARK_MASTER=spark://spark-master:7077``,
      and ``build_spark_session`` used that value as an explicit master, so
      the job was scheduled on the shared 2-core worker instead;
    - that worker runs its executors with ``-Xmx2048M`` while two jobs
      overlap, and the kernel OOM-killed the executor ("Command exited with
      code 137").

    ``PYSPARK_GATEWAY_PORT`` is set by the launcher in the driver process,
    so it is the reliable signal that a master was already chosen.
    """
    if explicit:
        return explicit
    if os.environ.get("PYSPARK_GATEWAY_PORT"):
        return None
    return get_env("SPARK_MASTER", "local[*]")


def build_spark_session(
    app_name: str,
    *,
    master: str | None = None,
    extra_configs: dict[str, str] | None = None,
    with_kafka: bool = False,
) -> SparkSession:
    master = _resolve_master(master)
    logger.info(" Building SparkSession: %s | master=%s", app_name, master or "<launcher>")
    # In the airflow webserver/scheduler containers we have a 2GB heap by
    # default and several local Spark jobs run inside a single BashOperator
    # process. We tune the driver down to 768m to avoid the JVM getting
    # OOM-killed on the second/third small write (the original 2g setting
    # caused "ConnectionRefusedError: [Errno 111]" when a second file was
    # processed right after a successful write).
    #
    # spark.driver.maxResultSize is set to 0 (unlimited) so we don't blow
    # the budget when collect() returns a large result.
    builder = SparkSession.builder.appName(app_name)
    if master:
        builder = builder.master(master)
    builder = (
        builder.config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
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

    jars_dirs = _local_jars_dirs()
    missing = _resolve_package_artifacts(jars_dirs)
    if with_kafka and not _kafka_jar_available(jars_dirs):
        missing.append(KAFKA_PACKAGE)

    if missing:
        # Only fall back to Ivy/Maven when a JAR is genuinely absent. The
        # coordinate list keeps the exact same artifacts as before, so a
        # machine without the pre-bundled JARs still resolves them.
        logger.info(" Resolving missing Spark packages via Ivy: %s", missing)
        try:
            from delta import configure_spark_with_delta_pip

            builder = configure_spark_with_delta_pip(builder, extra_packages=missing)
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning(" Could not configure Delta via pip helper: %s", exc)
            builder = builder.config("spark.jars.packages", ",".join(missing))
    else:
        logger.info(" All Spark packages are pre-bundled; skipping Ivy resolution")

    return builder.getOrCreate()


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
                # NOTE: avoid .sparkContext and .appName here — serverless
                # compute raises JVM_ATTRIBUTE_NOT_SUPPORTED (sparkContext) or
                # AttributeError (appName not exposed). We just log the id.
                logger.info(" Using active Databricks session (id=%s)", id(active))
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
