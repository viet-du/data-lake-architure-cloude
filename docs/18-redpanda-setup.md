# 🐼 Redpanda - Kafka-compatible Streaming Platform

> **Drop-in replacement cho Kafka** - Nhanh hơn 10x, không cần Zookeeper, đơn giản hơn nhiều!

---

## 📋 Tại sao chọn Redpanda thay vì Kafka?

| Feature | Apache Kafka | 🐼 Redpanda |
|---------|-------------|------------|
| **Zookeeper** | ❌ Cần | ✅ Không cần |
| **Tốc độ** | Baseline | **Nhanh hơn 10x** |
| **RAM tối thiểu** | 4GB+ | **1GB** |
| **Setup** | Phức tạp | **1 lệnh** |
| **Kafka API** | ✅ | ✅ **100% compatible** |
| **Latency** | 5-10ms | **<1ms** |
| **Single binary** | ❌ | ✅ |
| **License** | Open source | Open source |

---

## 🚀 Đã setup xong

### Containers

| Service | Port | Mô tả |
|---------|------|-------|
| **Redpanda** | 9092 | Kafka broker |
| **Redpanda Console** | 8081 | Web UI quản lý |
| **Kafka UI** | 8089 | Web UI thay thế |

### File đã tạo/sửa

```
✅ docker-compose.yml           (thêm 3 services)
✅ configs/redpanda-console.yaml (config cho Console UI)
```

---

## ▶️ Cách chạy

### 1. Mở Docker Desktop

Docker phải chạy trước.

### 2. Start Redpanda

```bash
cd /Users/mac/Documents/data-lake-architecture

# Start chỉ Redpanda
docker compose up -d redpanda

# Hoặc start cả 3 services
docker compose up -d redpanda redpanda-console kafka-ui

# Hoặc start tất cả
docker compose up -d
```

### 3. Verify

```bash
# Check containers
docker ps

# Health check
docker exec -it lake-redpanda rpk cluster health
```

Output mẫu:
```
CLUSTER STATUS: HEALTHY
  1 brokers
  0 partitions
```

---

## 🎯 Sử dụng với `rpk` (Redpanda CLI)

### 1. Tạo topic

```bash
# Vào container Redpanda
docker exec -it lake-redpanda bash

# Tạo topic
rpk topic create clickstream-events \
  --partitions 3 \
  --replicas 1

# List topics
rpk topic list
```

### 2. Produce messages

```bash
# Gửi message
echo "user_id:12345,event:click,page:home" | \
  rpk topic produce clickstream-events

# Hoặc produce nhiều messages
rpk topic produce clickstream-events <<EOF
{"user_id": 1, "event": "click", "page": "home"}
{"user_id": 2, "event": "purchase", "amount": 99.99}
EOF
```

### 3. Consume messages

```bash
# Đọc từ đầu
rpk topic consume clickstream-events --offset start

# Đọc real-time (streaming)
rpk topic consume clickstream-events --follow
```

---

## 🌐 Web UI - Redpanda Console

### Truy cập

👉 **http://localhost:8081**

### Tính năng:

✅ **Topics** - Tạo, xóa, list topics
✅ **Messages** - Xem messages real-time
✅ **Producers/Consumers** - Theo dõi
✅ **Schemas** - Quản lý schema (nếu bật)
✅ **Connectors** - Quản lý CDC connectors
✅ **Cluster** - Health, brokers, disk usage

### Hoặc dùng Kafka UI

👉 **http://localhost:8089**

---

## 🔌 Kết nối từ Spark

### Spark Structured Streaming

```python
# Read từ Redpanda (Kafka API)
df_stream = (
    spark.readStream
    .format("kafka")
    .option("kafka.bootstrap.servers", "redpanda:9092")
    .option("subscribe", "clickstream-events")
    .option("startingOffsets", "latest")
    .load()
)

# Parse JSON
from pyspark.sql.functions import from_json, col
from pyspark.sql.types import StructType, StringType, IntegerType

schema = StructType() \
    .add("user_id", IntegerType()) \
    .add("event", StringType()) \
    .add("page", StringType())

parsed = df_stream.select(
    from_json(col("value").cast("string"), schema).alias("data"),
    col("timestamp").alias("event_time")
).select("data.*", "event_time")

# Write ra MinIO (Bronze)
query = (
    parsed.writeStream
    .format("delta")
    .option("checkpointLocation", "s3a://bronze/checkpoints/clickstream/")
    .start("s3a://bronze/clickstream/events/")
)
```

---

## 🔌 Kết nối từ Python (rpk hoặc kafka-python)

### Cài thư viện

```bash
pip install kafka-python confluent-kafka
```

### Produce (gửi)

```python
from kafka import KafkaProducer
import json

producer = KafkaProducer(
    bootstrap_servers=['localhost:9092'],
    value_serializer=lambda x: json.dumps(x).encode('utf-8')
)

# Gửi message
for i in range(100):
    producer.send('clickstream-events', {
        'user_id': i,
        'event': 'click',
        'page': 'home',
        'timestamp': '2026-10-05T12:00:00'
    })

producer.flush()
print("✅ Sent 100 messages")
```

### Consume (đọc)

```python
from kafka import KafkaConsumer
import json

consumer = KafkaConsumer(
    'clickstream-events',
    bootstrap_servers=['localhost:9092'],
    auto_offset_reset='earliest',
    value_deserializer=lambda x: json.loads(x.decode('utf-8'))
)

for message in consumer:
    print(f"📩 {message.value}")
```

---

## 🔌 Kết nối từ Node.js

```bash
npm install kafkajs
```

```javascript
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'my-app',
  brokers: ['localhost:9092']
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'my-group' });

// Produce
await producer.connect();
await producer.send({
  topic: 'clickstream-events',
  messages: [
    { value: 'Hello Redpanda!' },
  ],
});

// Consume
await consumer.connect();
await consumer.subscribe({ topic: 'clickstream-events', fromBeginning: true });
await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    console.log({
      topic,
      partition,
      value: message.value.toString(),
    });
  },
});
```

---

## 📊 So sánh với Kafka

### Tốc độ

```
Kafka:   ~100,000 msg/second
Redpanda: ~1,000,000 msg/second (10x)
```

### RAM

```
Kafka + Zookeeper: 4GB minimum
Redpanda: 1GB minimum
```

### Setup time

```
Kafka:   30+ minutes (config ZK, brokers, partitions)
Redpanda: 5 minutes (1 lệnh docker-compose)
```

---

## 🧪 Test End-to-End

### Terminal 1: Start consumer

```bash
docker exec -it lake-redpanda rpk topic consume test-topic --follow
```

### Terminal 2: Produce messages

```bash
docker exec -it lake-redpanda rpk topic produce test-topic
> Hello
> World
> Redpanda
> (Ctrl+D)
```

### Kết quả

Terminal 1 sẽ hiển thị:
```
Hello
World
Redpanda
```

---

## 🛠️ Useful Commands

### Cluster

```bash
# Cluster info
rpk cluster info

# Cluster health
rpk cluster health

# List brokers
rpk cluster brokers list
```

### Topics

```bash
# List topics
rpk topic list

# Create topic
rpk topic create my-topic --partitions 3

# Describe topic
rpk topic describe my-topic

# Delete topic
rpk topic delete my-topic
```

### Consumer Groups

```bash
# List groups
rpk group list

# Describe group
rpk group describe my-group

# Reset offsets
rpk group seek my-group my-topic 0
```

---

## 🔄 Thay thế Kafka trong project

### Code changes

| Trước (Kafka) | Sau (Redpanda) |
|--------------|----------------|
| `localhost:9092` | `localhost:9092` (giữ nguyên!) |
| `localhost:2181` | (không cần Zookeeper) |
| `kafka-topics.sh` | `rpk topic create` |
| `kafka-console-producer.sh` | `rpk topic produce` |

### Nếu dùng Kafka client lib

✅ **Không cần thay đổi code!** Redpanda 100% compatible với Kafka API.

---

## 🎯 Use Cases cho project này

### 1. Clickstream tracking

```python
# Mỗi click user → Kafka topic
producer.send('clickstream-events', {
    'user_id': user.id,
    'event': 'click',
    'page': 'product_detail',
    'product_id': product.id
})

# Spark Streaming → Delta Lake → MinIO
```

### 2. CDC (Change Data Capture)

```python
# Track changes từ database
producer.send('db-changes', {
    'table': 'orders',
    'op': 'INSERT',
    'after': {'id': 123, 'amount': 99.99}
})
```

### 3. IoT sensors

```python
# Sensor data
producer.send('iot-sensors', {
    'sensor_id': 'temp-01',
    'value': 25.5,
    'unit': 'celsius'
})
```

---

## ❓ Troubleshooting

| Lỗi | Cách fix |
|------|---------|
| **Container không start** | Check Docker Desktop đang chạy |
| **Connection refused** | Đợi 30s cho Redpanda start |
| **Port 9092 in use** | Tắt Kafka khác, hoặc đổi port |
| **Out of memory** | Tăng memory trong docker-compose |
| **Topic not found** | Tạo topic trước khi produce |

---

## 📚 Tài liệu

- 🌐 **Redpanda docs**: https://docs.redpanda.com/
- 🐼 **Redpanda Console**: https://github.com/redpanda-data/console
- 📖 **rpk CLI**: https://docs.redpanda.com/docs/reference/rpk/

---

## 🎉 Kết luận

✅ **Redpanda** đã được thêm vào project của bạn
✅ **Web UI** ở http://localhost:8081
✅ **Kafka API** ở localhost:9092 (tương thích 100%)
✅ **Không cần Zookeeper**
✅ **Nhanh hơn Kafka 10x**

**Bắt đầu:**

```bash
# 1. Mở Docker Desktop
# 2. Chạy
docker compose up -d redpanda redpanda-console

# 3. Mở browser
open http://localhost:8081
```