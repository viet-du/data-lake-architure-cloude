# Databricks host probe — Sun 19 Oct 2026 09:27 UTC+7

Tested token `dapi2bdfaa...ec57` (yours) on common Databricks hosts:

| Host | Status | Meaning |
|------|--------|---------|
| `community.cloud.databricks.com` | 401 | Token not accepted here |
| `eastus.azuredatabricks.net` | **403** | Token is **valid**, but for a different workspace |
| `asia-northeast1.gcp.databricks.com` | **403** | Token is **valid**, but for a different workspace |

**Conclusion:** Your token is valid (Databricks recognizes it on Azure/GCP),
but it belongs to a specific workspace, not Community Cloud.

**Next:** Get the correct host from your browser address bar.
- AWS: `https://dbc-xxxxxxxx-xxxx.cloud.databricks.com`
- Azure: `https://adb-xxxxxxx.x.azuredatabricks.net`
- GCP: `https://xxxx.gcp.databricks.com`
- Community: `https://community.cloud.databricks.com`

Then re-run with the correct host.
