# Databricks integration

- **Motivation/Background**: Web currently reads local Mongo/MinIO; user data resides in Databricks Unity Catalog.
- **Purpose**: Connect existing catalog and medallion screens to real remote metadata and rows through the API.
- **Overview Pipeline**: Read contracts → verify credentials/warehouse → server adapter → existing services → tests/browser.
- **Detailed Plan**: Configuration, read-only remote adapter, source selection, live evidence and limitations.
- **References**: [Previous audit](../../shared/AUDIT_FULL_STACK_RECOVERY.md), [Databricks SQL API](https://docs.databricks.com/api/statement-execution/v1/statement-execution), [Unity Catalog API](https://docs.databricks.com/api/uc-tables/v1/list-tables).
- **Created**: 2026-10-21T12:25:35+07:00
- **Last Updated**: 2026-10-21T17:32:59+07:00

[STATUS: COMPLETED]

## Confirmed inventory and design

[Catalog services](../../../apps/api/src/modules/catalog/services) use Mongo metadata; [layer services](../../../apps/api/src/modules/bronze/services/table.service.ts) use DuckDB local paths. Adding environment variables alone cannot display Databricks data. Preserve local mode and select Databricks explicitly with LAKEHOUSE_DATA_SOURCE.

Use backend-only Databricks PAT, HTTPS origin, workspace ID, warehouse ID/HTTP path, catalog and schema mappings. Both supplied credentials were checked. The original credential has SELECT access and is active; the later credential can browse metadata but lacks USE SCHEMA. No grants were changed. Store secrets only in ignored environment files; templates contain placeholders. No token in VITE variables, responses, logs, screenshots or reports.

Catalog should expose native catalog.schema.table identities, including non-medallion schemas. Layer pages map configured bronze/silver/gold schemas; other schemas remain catalog-only. Use Unity Catalog REST for metadata, bounded read-only SQL for sample/count/detail/history. Keep unsupported metrics null and do not import remote rows into Mongo/MinIO.

SQL warehouse may auto-start when reading rows; user requested a working data connection. Do not change warehouse sizing, create tables, produce events, run ETL, or mutate remote data. Preserve local jobs/Kafka/Airflow/DQ as separate systems rather than inventing Databricks execution metrics.

## Ordered implementation and verification

1. Verify remote warehouse and catalog via read-only APIs.
2. Validate configuration and implement bounded, paginated server adapter with safe identifiers, timeouts and redacted errors.
3. Route catalog/layer read services; preserve local mode and block local-only actions for remote tables.
4. Align UI nullable metrics/native schema identity, add Databricks connectivity/source visibility.
5. Run contract/security tests, typechecks/builds and live API/browser checks; document actual table/row counts and any permissions/warehouse limits.

## Implementation evidence

Implemented explicit local/Databricks provider selection, native catalog/schema identities, nullable metadata, bounded asynchronous SQL polling, read-only action guards, source banner, live table preview, and viewport-level Drawer/Modal portals. Home excludes information_schema from business table totals and does not present local job counters as Databricks processed-record totals.

[Live verification](../../../test-results/databricks-live.json) successfully counted and sampled all 13 business tables. Six schemas are visible; information_schema contributes 29 additional metadata objects. [Verification script](../../../scripts/verify-databricks.mjs) retains table names/counts without saving sample row content.

[Unit tests](../../../test-results/databricks-unit-tests.log): API 73 + web 89 = 162 PASS. Typechecks and production builds pass. Browser evidence and final scope are recorded in the [integration result](../../shared/DATABRICKS_INTEGRATION_RESULT.md).

Final browser regression: 36/36 PASS after async SQL polling and overlay fixes. All 13 business tables passed count/sample checks. See the [result report](../../shared/DATABRICKS_INTEGRATION_RESULT.md).
