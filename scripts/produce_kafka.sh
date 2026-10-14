#!/usr/bin/env bash
# ============================================================================
# scripts/produce_kafka.sh
# ----------------------------------------------------------------------------
# Produce a burst of mock events to a Kafka topic for end-to-end streaming demo.
#
# Usage:
#   bash scripts/produce_kafka.sh clickstream 100    # 100 events, default rate
#   bash scripts/produce_kafka.sh ecommerce-products 50 5   # 50 events, rate=5/s
#
# Topics: see src/lakehouse/core/constants.py::KafkaTopics
# ============================================================================

set -euo pipefail

TOPIC="${1:-clickstream-events}"
COUNT="${2:-100}"
RATE="${3:-10}"

echo "═══════════════════════════════════════════════════════════════"
echo "  Producing $COUNT events to topic '$TOPIC' (rate=$RATE msg/s)"
echo "═══════════════════════════════════════════════════════════════"

# Check container running
if ! docker ps --format '{{.Names}}' | grep -q '^lake-kafka$'; then
    echo "❌ lake-kafka container not running. Start with: make up" >&2
    exit 1
fi

# Use lake-kafka container's kafka-console-producer (avoids needing pika locally)
docker exec lake-kafka bash -c "
    apt-get install -y python3 2>/dev/null || true
"

# We use the host .venv Python with kafka-python to produce
.venv/bin/python -c "
import json
import time
import sys
from kafka import KafkaProducer

producer = KafkaProducer(
    bootstrap_servers='localhost:9092',
    value_serializer=lambda v: json.dumps(v).encode('utf-8'),
)

topic = '$TOPIC'
count = $COUNT
rate = $RATE

print(f'Sending {count} messages to {topic} at {rate}/s...')
interval = 1.0 / rate if rate > 0 else 0

for i in range(count):
    if 'clickstream' in topic:
        msg = {
            'event_id': f'e_{int(time.time()*1000)}_{i}',
            'user_id': f'u_{i % 50}',
            'event_type': ['page_view', 'click', 'scroll'][i % 3],
            'url': f'/products/item-{i % 100}',
            'referrer': 'https://google.com',
            'user_agent': 'Mozilla/5.0',
            'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'session_id': f's_{i // 10}',
        }
    else:
        msg = {
            'product_id': f'P{i % 1000:04d}',
            'name': f'Product {i}',
            'category': ['smartphone', 'laptop', 'fashion'][i % 3],
            'price': 99.99 + (i % 100),
            'stock': 100 - (i % 50),
            'source': 'mock',
            'crawled_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        }

    future = producer.send(topic, msg)
    future.get(timeout=5)

    if (i + 1) % 10 == 0:
        print(f'  Sent {i+1}/{count}', file=sys.stderr)
    if interval > 0:
        time.sleep(interval)

producer.flush()
producer.close()
print(f'✅ {count} messages sent to {topic}')
" 2>&1

echo "═══════════════════════════════════════════════════════════════"
echo "  Verify: docker exec lake-kafka kafka-run-class kafka.tools.GetOffsetShell \\"
echo "           --broker-list kafka:29092 --topic $TOPIC"
echo "  UI:     http://localhost:8081  (Confluent Kafka UI)"
echo "═══════════════════════════════════════════════════════════════"
