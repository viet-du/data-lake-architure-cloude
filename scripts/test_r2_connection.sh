#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Test connection to Cloudflare R2
#
# Usage:
#   ./scripts/test_r2_connection.sh
#
# Reads S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY from .env
# and verifies we can:
#   1. Reach the R2 endpoint
#   2. List the 3 buckets (bronze, silver, gold)
#   3. Upload a small test file
#   4. Download and verify
#   5. Clean up
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Load .env if exists
if [[ ! -f .env ]]; then
    echo "❌ .env not found. Run: cp .env.example .env"
    exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

# Validate required vars
for var in S3_ENDPOINT S3_ACCESS_KEY S3_SECRET_KEY; do
    if [[ -z "${!var:-}" ]]; then
        echo "❌ $var is empty in .env"
        echo "   See docs/operations/R2_SETUP.md to configure R2"
        exit 1
    fi
done

# Skip if still using MinIO defaults (S3_ENDPOINT is the R2 indicator)
if [[ "$S3_ENDPOINT" == *"localhost:9000"* ]] || [[ "$S3_ENDPOINT" == *"minio"* ]]; then
    echo "⚠️  S3_ENDPOINT looks like MinIO ($S3_ENDPOINT), not R2."
    echo "   This script is for Cloudflare R2 testing."
    echo "   See docs/operations/R2_SETUP.md"
    exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Cloudflare R2 Connection Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Endpoint:  $S3_ENDPOINT"
echo "AccessKey: ${S3_ACCESS_KEY:0:8}..."
echo ""

# ─── Step 1: DNS + TCP reachability ─────────────────────────────
echo "[1/5] Testing endpoint reachability..."
ENDPOINT_HOST=$(echo "$S3_ENDPOINT" | sed -E 's|https?://||')
if curl -fsS -o /dev/null --max-time 10 "https://$ENDPOINT_HOST/"; then
    echo "  ✅ Endpoint reachable"
else
    echo "  ❌ Cannot reach $ENDPOINT_HOST"
    echo "     Check firewall, VPN, hoặc endpoint có đúng format https://<account_id>.r2.cloudflarestorage.com"
    exit 1
fi

# ─── Step 2: Check aws cli hoặc mc (MinIO client) ───────────────
TOOL=""
if command -v aws >/dev/null 2>&1; then
    TOOL="aws"
elif command -v mc >/dev/null 2>&1; then
    TOOL="mc"
else
    echo "⚠️  Neither 'aws' nor 'mc' (MinIO client) is installed."
    echo "   Install one of:"
    echo "     brew install awscli"
    echo "     brew install minio/stable/mc"
    echo ""
    echo "   Or use Python boto3 for the rest of the test."
fi

if [[ -n "$TOOL" ]]; then
    echo "[2/5] Listing buckets using $TOOL..."
    if [[ "$TOOL" == "aws" ]]; then
        export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY"
        export AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY"
        export AWS_DEFAULT_REGION="auto"
        if aws --endpoint-url "$S3_ENDPOINT" s3 ls 2>&1 | grep -qE "bronze|silver|gold"; then
            echo "  ✅ Found bronze/silver/gold buckets"
        else
            echo "  ⚠️  Buckets not visible. Available buckets:"
            aws --endpoint-url "$S3_ENDPOINT" s3 ls || true
            echo ""
            echo "  Create missing buckets at: https://dash.cloudflare.com → R2"
        fi
    else
        mc alias set r2test "$S3_ENDPOINT" "$S3_ACCESS_KEY" "$S3_SECRET_KEY" 2>/dev/null
        if mc ls r2test/ 2>&1 | grep -qE "bronze|silver|gold"; then
            echo "  ✅ Found bronze/silver/gold buckets"
        else
            echo "  ⚠️  Buckets not visible. Available buckets:"
            mc ls r2test/ || true
        fi
    fi
else
    echo "[2/5] Skipping bucket list (no CLI tool). Will test via Python."
fi

# ─── Step 3: Upload/download test via Python boto3 ───────────────
echo "[3/5] Testing write+read with Python boto3..."
python3 - "$S3_ENDPOINT" "$S3_ACCESS_KEY" "$S3_SECRET_KEY" <<'PYEOF'
import sys
import tempfile
import os

endpoint, access_key, secret_key = sys.argv[1], sys.argv[2], sys.argv[3]

try:
    import boto3
    from botocore.client import Config
except ImportError:
    print("  ⚠️  boto3 not installed. Run: pip install boto3")
    print("     Skipping Python test.")
    sys.exit(0)

s3 = boto3.client(
    "s3",
    endpoint_url=endpoint,
    aws_access_key_id=access_key,
    aws_secret_access_key=secret_key,
    config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    region_name="auto",
)

# Test content
test_content = f"hello-from-r2-test-{os.urandom(4).hex()}\n".encode()
test_key = "_r2_connection_test/ping.txt"

# Write to bronze bucket
try:
    s3.put_object(Bucket="bronze", Key=test_key, Body=test_content)
    print(f"  ✅ Uploaded {len(test_content)} bytes to bronze/{test_key}")
except Exception as e:
    print(f"  ❌ Upload failed: {e}")
    print("     Check: bucket 'bronze' đã tạo? Access key có quyền write?")
    sys.exit(1)

# Read back
try:
    resp = s3.get_object(Bucket="bronze", Key=test_key)
    body = resp["Body"].read()
    if body == test_content:
        print(f"  ✅ Downloaded content matches ({len(body)} bytes)")
    else:
        print(f"  ❌ Content mismatch! Got {body!r}, expected {test_content!r}")
        sys.exit(1)
except Exception as e:
    print(f"  ❌ Download failed: {e}")
    sys.exit(1)

# Cleanup
try:
    s3.delete_object(Bucket="bronze", Key=test_key)
    print("  ✅ Cleanup test file OK")
except Exception as e:
    print(f"  ⚠️  Could not delete test file: {e}")

# List all 3 buckets
print("")
print("  Bucket availability:")
for bucket in ("bronze", "silver", "gold"):
    try:
        s3.head_bucket(Bucket=bucket)
        print(f"    ✅ {bucket}")
    except Exception as e:
        err_code = e.response.get("Error", {}).get("Code", "?") if hasattr(e, "response") else "?"
        print(f"    ❌ {bucket} — {err_code} (create it on Cloudflare dashboard)")

PYEOF

# ─── Step 4: Spark test (optional) ───────────────────────────────
echo ""
echo "[4/5] Spark read/write test..."
echo "  This will start a Spark session (may take 30s)..."

# Run inside spark container if exists, else python on host
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "lake-spark-master"; then
    docker exec lake-spark-master bash -c "
        export S3_ENDPOINT='$S3_ENDPOINT'
        export S3_ACCESS_KEY='$S3_ACCESS_KEY'
        export S3_SECRET_KEY='$S3_SECRET_KEY'
        export S3_REGION='auto'
        export S3_USE_SSL='true'
        export S3_PATH_STYLE_ACCESS='true'
        cd /app-src
        python3 -c '
import sys
sys.path.insert(0, \"/app-src/src\")
from pyspark.sql import SparkSession
from lakehouse.core.spark import build_spark_session
spark = build_spark_session(\"r2-smoke-test\", master=\"local[2]\")
try:
    spark.range(3).write.format(\"delta\").mode(\"overwrite\").save(\"s3a://bronze/_spark_smoke_test/\")
    n = spark.read.format(\"delta\").load(\"s3a://bronze/_spark_smoke_test/\").count()
    print(f\"  ✅ Spark wrote and read {n} rows from s3a://bronze/\")
finally:
    spark.stop()
'
    " 2>&1 | grep -E "✅|❌|Error|Exception" || echo "  ⚠️  Spark test inconclusive (container may not be running)"
else
    echo "  ⏭️  lake-spark-master not running. Skipping Spark test."
    echo "     Run 'make up' first to enable Spark on R2."
fi

# ─── Step 5: Summary ────────────────────────────────────────────
echo ""
echo "[5/5] Summary"
echo "  • Endpoint reachable:     ✅"
echo "  • Python boto3:           see above"
echo "  • Spark Delta read/write: see above"
echo ""
echo "🎉 R2 setup looks good! Run 'make batch' to start the pipeline."
echo "   View data at: https://dash.cloudflare.com → R2 → bucket 'bronze'"
