# Cloudflare R2 Lifecycle Policies

This directory contains the R2 bucket lifecycle policies applied to each medallion tier.

## Files

| File | Applied to | Rule summary |
| --- | --- | --- |
| `lifecycle-bronze.json` | `bronze` bucket | Move to Infrequent Access after 30 days; delta-checkpoint files after 90 days |
| `lifecycle-silver.json` | `silver` bucket | Move to Infrequent Access after 90 days |
| `lifecycle-gold.json` | `gold` bucket | Move to Infrequent Access after 365 days (gold is hot, read often) |

## Why no "delete" rules?

R2 lifecycle supports a `delete` transition but we deliberately do NOT use it. The cost of storing data is so low ($0.01-0.015/GB/mo) that deleting bronze after 1 year would save <$1/mo at our scale, while losing the ability to audit, time-travel, or rebuild a deleted Gold table from Bronze.

If a future project requirement demands retention limits, add a `delete` transition with a clear age (e.g. 730 days for bronze).

## Why the delta-log prefix has a different age?

Delta Lake stores its transaction log in a `_delta_log/` subdirectory. The log is write-heavy (every commit appends a JSON file) and rarely read after the table is settled. Moving it to IA earlier (90 days) saves more than moving the data files (30 days).

## Applying the policies

```bash
# From the repo root
export CF_ACCOUNT_ID="<your-32-char-hex-account-id>"

wrangler r2 bucket lifecycle set bronze  --policy infra/r2/lifecycle-bronze.json  --remote
wrangler r2 bucket lifecycle set silver  --policy infra/r2/lifecycle-silver.json  --remote
wrangler r2 bucket lifecycle set gold    --policy infra/r2/lifecycle-gold.json    --remote

# Verify
wrangler r2 bucket lifecycle get bronze
```

## Verifying after apply

```bash
# List all rules
wrangler r2 bucket lifecycle list bronze

# Expected output: 2 rules for bronze (tier-down + checkpoint), 1 each for silver and gold
```

## Cost impact (per §8 of CLOUD_R2_RENDER.md)

| Bucket | Without lifecycle | With lifecycle (after settle) |
| --- | --- | --- |
| bronze (50GB) | $0.75/mo | $0.50/mo |
| silver (20GB) | $0.30/mo | $0.20/mo |
| gold (10GB) | $0.15/mo | $0.10/mo |
| **Total** | **$1.20/mo** | **$0.80/mo** |

Savings: ~$0.40/mo. Small, but free and reduces storage bloat over time.
