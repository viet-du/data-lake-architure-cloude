
 **Tất cả scripts trong thư mục này đã được refactor sang package `src/lakehouse/`.**


| Legacy file | New location | Mô tả |
|---|---|---|
| `01_ingest_to_bronze.py` | `src/lakehouse/ingest/batch/csv_ingestor.py` | CSV → Bronze |
| `02_transform_to_silver.py` | `src/lakehouse/transform/batch/{customers,products,orders}_transformer.py` | Silver layer (split thành 3 files) |
| `03_aggregate_to_gold.py` | `src/lakehouse/aggregate/batch/fact_orders_aggregator.py` | Gold fact |
| `04_elt_pipeline.py` | `src/lakehouse/pipelines/batch_retail.py` | E2E batch pipeline |
| `05_kafka_producer.py` | `src/lakehouse/sources/producers/clickstream_producer.py` | Clickstream producer |
| `06_kafka_to_bronze_streaming.py` | `src/lakehouse/ingest/streaming/clickstream_ingestor.py` | Clickstream ingest |
| `07_aggregate_clickstream_gold.py` | `src/lakehouse/aggregate/streaming/clickstream_metrics_aggregator.py` | Clickstream metrics |
| `08_mock_data_generator.py` | `src/lakehouse/sources/mock/retail_generator.py` | Mock data (gộp từ generate_sample_data.py) |
| `09_tiki_crawler.py` | `src/lakehouse/sources/crawlers/tiki_crawler.py` | Tiki crawler |
| `10_multi_source_crawler.py` | `src/lakehouse/sources/crawlers/{github,crypto,weather,hackernews}_crawler.py` | Split thành 4 files |
| `11_ecommerce_streaming.py` | `src/lakehouse/pipelines/stream_ecommerce.py` | E-commerce E2E |
| `12_multithread_category_crawler.py` | `src/lakehouse/sources/crawlers/tiki_crawler.py` | Tích hợp vào TikiCrawler |
| `13_category_revenue_streaming.py` | `src/lakehouse/aggregate/streaming/category_revenue_aggregator.py` | Category revenue metrics |
| `generate_sample_data.py` | `src/lakehouse/sources/mock/retail_generator.py` | Mock retail data |
| `utils/data_quality.py` | `src/lakehouse/quality/checks.py` | Data quality checks |
| `utils/minio_helper.py` | `src/lakehouse/storage/delta_writer.py` | Delta Lake writer |
| `demo/*` | Xóa - chuyển vào `docs/19-end-to-end-demo.md` | Demo cũ |


1. **Flat structure** - 16 file `.py` cùng cấp
2. **Tên file theo số** (`01_`, `02_`) - không thể hiện chức năng
3. **1 file - nhiều logic** (file `02_` chứa 4 transformers)
4. **SparkSession bị duplicate** ở 6+ file
5. **Hard-code paths/topics** - không có config tập trung
6. **Không có package chuẩn** - không có `pyproject.toml`


 **Có thể xóa an toàn** sau khi:
- Đã verify code mới chạy OK (`make pipeline-batch`)
- Đã chạy tests (`make test`)
- Đã update CI/CD (nếu có)

Giữ lại để rollback trong vòng 2 tuần đầu.
