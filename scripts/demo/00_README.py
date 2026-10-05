# ============================================================
# Demo End-to-End Pipeline
# Redpanda → Spark Streaming → MinIO (Delta Lake) → Metabase
# ============================================================

"""
Luồng:
1. Python producer gửi clickstream events vào Redpanda topic
2. Spark Streaming đọc real-time từ Redpanda
3. Parse JSON → clean → validate
4. Ghi vào Bronze layer (Delta Lake trên MinIO)
5. Transform → Silver layer
7. Metabase visualize

Chạy:
  - Producer:    python3 01_producer.py
  - Spark Job:   spark-submit 02_spark_streaming.py
"""

import os
import sys

print("=" * 60)
print("🎯 END-TO-END DEMO: Redpanda → Spark → MinIO → Metabase")
print("=" * 60)
print()
print("Prerequisites:")
print("  ✅ Docker Desktop đang chạy")
print("  ✅ Redpanda + Console running (docker compose up -d redpanda)")
print("  ✅ MinIO + Spark running (docker compose up -d)")
print()
print("Steps:")
print("  1️⃣  Terminal 1: python3 scripts/demo/01_producer.py")
print("  2️⃣  Terminal 2: docker exec -it lake-spark-master spark-submit \\")
print("                       /scripts/demo/02_spark_streaming.py")
print("  3️⃣  Browser:    http://localhost:8081  (Redpanda Console)")
print("  4️⃣  Browser:    http://localhost:9001  (MinIO Console)")
print("  5️⃣  Browser:    http://localhost:3000  (Metabase)")
print()
print("=" * 60)