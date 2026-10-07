# Entities (`apps/web/src/types/entities`)

Plain TypeScript types — no logic, no React. Mirrors the Pydantic models on the backend.

| Domain | File | Key Types |
| --- | --- | --- |
| Catalog | `catalog/catalog.entity.ts` | `CatalogDatabase`, `CatalogTable`, `CatalogColumn`, `CatalogSearchResult` |
| Bronze | `bronze/bronze.entity.ts` | `IngestJob`, `IngestRun`, `IngestItem`, `BronzeTable`, `BronzePartition`, `BronzeStats` |
| Silver | `silver/silver.entity.ts` | `SilverTable`, `SilverRun`, `SilverStats` |
| Gold | `gold/gold.entity.ts` | `GoldDataset`, `GoldKPI`, `GoldDashboard`, `GoldStats` |
| Crawler | `crawler/crawler.entity.ts` | `CrawlerJob`, `CrawlerConfig`, `CrawlerRun`, `CrawlerRunItem`, `CrawlerKafkaTopic`, `CrawlerStats` |
| Kafka | `kafka/kafka.entity.ts` | `KafkaTopic`, `KafkaMessage`, `KafkaProducePayload`, `KafkaProduceResult`, `KafkaConsumerGroup`, `KafkaConsumerGroupLag`, `KafkaCluster`, `KafkaStats` |
| Airflow | `airflow/airflow.entity.ts` | `AirflowDAG`, `AirflowDAGRun`, `AirflowTaskInstance`, `AirflowGanttEntry`, `AirflowTriggerResult`, `AirflowStats`, `AirflowTaskLogs` |
| DQ | `dq/dq.entity.ts` | `DQRule`, `DQRuleCreatePayload`, `DQRuleUpdatePayload`, `DQRun`, `DQPreset`, `DQSummary` |
| Commons | `commons/index.ts` | `EHealthStatus`, `ApiResponse<T>`, `Pagination<T>`, `ApiError` |

## Type Discipline

- All collections are `ReadonlyArray<T>`.
- All field maps are `Readonly<Record<string, string>>`.
- All enums are exported as `type` unions (not `enum`).
- All timestamps are ISO-8601 strings.
- All IDs are opaque strings (no branded types for now).
