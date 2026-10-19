"""Pre-fetch Delta + Kafka JARs into a local file:// cache so Spark's Ivy
resolver does NOT have to hit Maven Central at runtime.

Why this script exists
----------------------
The macOS application sandbox blocks ``java.net.Inet4AddressImpl
.lookupAllHostAddr``, which Apache Ivy (Spark's dependency resolver)
calls from ``SparkSubmit.prepareSubmitEnvironment``. The first time
``build_local_spark()`` runs, the JVM crashes with::

    Caused by: java.net.SocketException: Operation not permitted
        at java.base/java.net.Inet4AddressImpl.lookupAllHostAddr

We work around this by:

  1. Downloading the JARs once with ``curl`` (which is NOT blocked).
  2. Pointing ``spark.jars`` (NOT ``spark.jars.packages``) at the
     local files via ``file://`` URIs.

This is a one-time bootstrap. After this script succeeds once, the
JVM can be started offline.

Usage::

    python3 experiments/fetch_jars.py
"""

from __future__ import annotations

import hashlib
import subprocess
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Where to put the JARs. We use _experiments_workspace/.jars so the files
# live inside the repo (and are easy to .gitignore together later).
# ---------------------------------------------------------------------------

JARS_DIR = Path("_experiments_workspace/.jars").resolve()
JARS_DIR.mkdir(parents=True, exist_ok=True)

# Pinned versions — keep in sync with src/lakehouse/core/constants.py
DELTA_VERSION = "3.3.3"
SCALA_VERSION = "2.12"
KAFKA_VERSION = "3.4.0"

MAVEN = "https://maven-central.storage-download.googleapis.com/maven2"


def _jar_for(maven_path: str) -> Path:
    """Return the on-disk filename for a Maven ``group/artifact/version/...`` path."""
    name = Path(maven_path).name
    target = JARS_DIR / name
    return target


def _download(url: str, target: Path) -> bool:
    """Download ``url`` to ``target`` with curl. Returns True on success."""
    if target.exists() and target.stat().st_size > 1024:
        return True
    res = subprocess.run(  # noqa: S603
        ["curl", "-sSL", "--fail", "-o", str(target), url],
        capture_output=True,
        text=True,
    )
    if res.returncode != 0:
        # remove partial file
        if target.exists():
            target.unlink()
        print(f"  ✗ {url}: {res.stderr.strip()[:120]}")
        return False
    return True


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


# The 6 jars the experiments actually need. Listing them explicitly is
# more reproducible than walking a Maven tree.
ARTIFACTS: list[tuple[str, str]] = [
    (f"io/delta/delta-spark_{SCALA_VERSION}/{DELTA_VERSION}/delta-spark_{SCALA_VERSION}-{DELTA_VERSION}.jar", "delta-spark"),
    (f"io/delta/delta-storage/{DELTA_VERSION}/delta-storage-{DELTA_VERSION}.jar", "delta-storage"),
    # Kafka connector (used by streaming experiments, but cheap to include)
    (f"org/apache/spark/spark-sql-kafka-0-10_{SCALA_VERSION}/{KAFKA_VERSION}/spark-sql-kafka-0-10_{SCALA_VERSION}-{KAFKA_VERSION}.jar", "kafka-010"),
    (f"org/apache/spark/spark-token-provider-kafka-0-10_{SCALA_VERSION}/{KAFKA_VERSION}/spark-token-provider-kafka-0-10_{SCALA_VERSION}-{KAFKA_VERSION}.jar", "kafka-token"),
    # spark-sql-kafka depends on these
    (f"org/apache/kafka/kafka-clients/{KAFKA_VERSION}/kafka-clients-{KAFKA_VERSION}.jar", "kafka-clients"),
    ("org/lz4/lz4-java/1.8.0/lz4-java-1.8.0.jar", "lz4"),
    ("org/xerial/snappy/snappy-java/1.1.10.5/snappy-java-1.1.10.5.jar", "snappy"),
    ("org/apache/commons/commons-pool2/2.11.1/commons-pool2-2.11.1.jar", "commons-pool2"),
]


def main() -> int:
    print(f"Fetching JARs into {JARS_DIR}")
    failed: list[str] = []
    for path, label in ARTIFACTS:
        url = f"{MAVEN}/{path}"
        target = _jar_for(path)
        if _download(url, target):
            print(f"  ✓ {label:18s}  {target.name}  ({target.stat().st_size:>10,} B)")
        else:
            failed.append(label)

    if failed:
        print(f"\n✗ {len(failed)} JAR(s) failed: {', '.join(failed)}")
        print("  Likely cause: macOS sandbox blocking curl to repo1.maven.org")
        print("  Try running this script outside the sandbox, or pre-populate the cache.")
        return 1

    print("\n  All JARs ready. Run `make demo` to start Spark.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
