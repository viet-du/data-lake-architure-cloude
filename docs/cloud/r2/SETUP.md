# Cloudflare R2 — Setup Guide

> **Companion to `docs/architecture/CLOUD_R2_RENDER.md`.** Read that first for the *why*; this is the *how*.
> **Time to complete:** ~30 minutes for one person.
> **Cost during setup:** $0 (free tier includes 10GB storage + 10M Class A ops + 10M Class B ops per month).

---

## 1. Prerequisites

- A Cloudflare account (free). Sign up at https://dash.cloudflare.com/sign-up.
- A payment method added to the account **only if** you expect to exceed 10GB total storage. R2 will not charge without sending an email warning first.
- `wrangler` CLI installed (Cloudflare's official CLI):
  ```bash
  npm install -g wrangler
  wrangler --version  # should be 3.x or later
  ```
- An `ACCOUNT_ID` from the Cloudflare dashboard (right sidebar on the home page — 32-char hex string).

---

## 2. Authenticate wrangler

```bash
wrangler login
# → opens browser, asks you to confirm
wrangler whoami  # verify
```

---

## 3. Create the 4 R2 buckets

The buckets mirror the medallion architecture (bronze / silver / gold) plus `scripts` for Airflow DAG files.

```bash
# Set your account ID once so you don't repeat it
export CF_ACCOUNT_ID="<your-32-char-hex-account-id>"

# Create buckets
wrangler r2 bucket create bronze
wrangler r2 bucket create silver
wrangler r2 bucket create gold
wrangler r2 bucket create scripts

# Verify
wrangler r2 bucket list
```

**Naming convention:** keep the names short. If you want to disambiguate environments, use `bronze-prod`, `bronze-staging`, etc. (each bucket name must be unique across all of Cloudflare).

---

## 4. Create the R2 API token (DO NOT use the global API key)

The R2 token is the credential that Spark, the API, and the MinIO sync job will use. It is **separate** from your Cloudflare account API key and can be scoped to specific buckets with specific permissions.

```bash
# Dashboard path (CLI does not support token creation yet):
# 1. Open https://dash.cloudflare.com/<ACCOUNT_ID>/r2/overview
# 2. Right sidebar: "Manage R2 API Tokens"
# 3. "Create API Token"
# 4. Name: "lakehouse-spark-prod"
# 5. Permissions: "Object Read & Write"
# 6. Bucket scope: select "bronze", "silver", "gold" (or all 4)
# 7. TTL: "Forever" (then rotate manually every 90 days)
# 8. Click "Create API Token"
# 9. COPY the Access Key ID and Secret Access Key NOW — they are shown only once
```

**Token naming convention:** include the bucket scope and the consumer in the name, e.g.:

- `lakehouse-spark-prod` — full R/W on bronze/silver/gold
- `lakehouse-api-prod` — read-only on gold only
- `lakehouse-airflow-prod` — read-only on scripts
- `lakehouse-minio-sync-prod` — full R/W on bronze/silver/gold

**This is the security model:** every service has a token with the **minimum permissions** it needs. A leaked API token compromises only one bucket, not all four.

---

## 5. Save the credentials in your password manager

You will need these in three places:

1. **Render dashboard env vars** (per-service, encrypted at rest)
2. **GitHub Actions secrets** (for cron crawlers)
3. **Local `.env`** for development

The values are:

```
R2_ACCOUNT_ID=<32-char-hex>
R2_ACCESS_KEY=<access-key-id>
R2_SECRET_KEY=<secret-access-key>
R2_BUCKET_BRONZE=bronze
R2_BUCKET_SILVER=silver
R2_BUCKET_GOLD=gold
R2_BUCKET_SCRIPTS=scripts
```

---

## 6. Apply lifecycle policies (auto-tier to Infrequent Access)

Bronze is written often but read rarely after 30 days. Silver is similar. Gold is read often. Scripts is rarely touched. Apply the lifecycle policies in `infra/r2/lifecycle-*.json` (already created in the repo):

```bash
# Bronze: move to IA after 30 days
wrangler r2 bucket lifecycle set bronze --policy infra/r2/lifecycle-bronze.json

# Silver: move to IA after 90 days
wrangler r2 bucket lifecycle set silver --policy infra/r2/lifecycle-silver.json

# Gold: keep on Standard (small volume, read often)
# (no lifecycle policy)

# Scripts: keep on Standard (small volume, rarely written)
# (no lifecycle policy)
```

The lifecycle JSON format (one per bucket):

```json
{
  "rules": [
    {
      "id": "tier-down-to-ia",
      "enabled": true,
      "conditions": { "prefix": "" },
      "transitions": [
        { "condition": { "age": 30 }, "destination": "infrequent_access" }
      ]
    }
  ]
}
```

> **Note:** Replace `age: 30` with `90` for silver, and remove the rule entirely for gold/scripts.

**Cost impact:** after lifecycle kicks in, bronze costs $0.01/GB/mo instead of $0.015/GB/mo. For 50GB of bronze over 6 months, that saves ~$0.75/mo — small but free.

---

## 7. Enable versioning (recovery from accidental delete)

Versioning is **off by default** in R2. Turn it on for the buckets that hold data you cannot afford to lose (bronze, silver, gold):

```bash
# Dashboard path:
# 1. https://dash.cloudflare.com/<ACCOUNT_ID>/r2/<bucket>/settings
# 2. "Bucket versioning" → "Enabled"
```

`wrangler` does not yet support versioning toggling via CLI as of 2026 Q4. The dashboard is the only path.

**Cost impact:** every old version is billed at the same rate as the current version. If you write 1GB/day and keep 30 days of versions, expect ~30GB of versioned storage. For bronze: $0.45/mo extra. For gold: negligible.

---

## 8. Public access prevention

By default, R2 buckets are private. To keep them private (the recommended default for data buckets):

```bash
# Dashboard path:
# 1. https://dash.cloudflare.com/<ACCOUNT_ID>/r2/<bucket>/settings
# 2. "Public access" → "Disallow public access" (default; verify)
```

For the `scripts` bucket (which Airflow reads but the world does not), private is correct.

**If you want a public bucket** (e.g. for static Web UI assets hosted on R2 instead of Cloudflare Pages — not the recommended path), enable public access and configure a custom domain. See [Cloudflare R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/).

---

## 9. Custom domain (optional, for previews)

If you want the Web UI to load gold-table previews directly from R2 (bypassing the API for faster page loads):

```bash
# Dashboard path:
# 1. https://dash.cloudflare.com/<ACCOUNT_ID>/r2/<bucket>/settings
# 2. "Custom Domains" → "Connect Domain"
# 3. Enter e.g. "data-preview.yourdomain.com"
# 4. Cloudflare auto-creates the CNAME
# 5. (Optional) Cloudflare Access policy: "Allow your-email@yourdomain.com only"
```

**Custom domain cost:** $0 (Cloudflare does not charge for R2 custom domains).

**When to use it:** when the Web UI previews are read often and you want to cache them at the Cloudflare edge. The 0$ egress means every read is free, but the network round-trip is still slower than reading from the in-cluster API.

**When NOT to use it:** if your previews contain PII, do not expose them publicly. The API + auth is the safer path.

---

## 10. Smoke test (verify everything works end-to-end)

After the buckets are created and the token is provisioned, run a quick round-trip:

```bash
# 1. Put a small object
echo "hello from R2 at $(date -u +%FT%TZ)" > /tmp/r2-test.txt
wrangler r2 object put bronze/r2-test.txt --file /tmp/r2-test.txt

# 2. List it
wrangler r2 object list bronze --prefix r2-test

# 3. Get it back
wrangler r2 object get bronze/r2-test.txt

# 4. (Optional) Read it via the S3 API from your laptop, using the R2 token
AWS_ACCESS_KEY_ID=$R2_ACCESS_KEY \
AWS_SECRET_ACCESS_KEY=$R2_SECRET_KEY \
aws --endpoint-url https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com \
    s3 cp s3://bronze/r2-test.txt -

# 5. Clean up
wrangler r2 object delete bronze/r2-test.txt
```

If all 5 steps work, R2 is ready for Render to use.

---

## 11. Cost guardrails (set these BEFORE you start writing data)

### 11.1 Cloudflare billing alert

```bash
# Dashboard path:
# 1. https://dash.cloudflare.com/<ACCOUNT_ID>/billing
# 2. "Add a budget alert"
# 3. Amount: $20/mo
# 4. Notification: your email
# 5. Action: "Notify only" (do NOT auto-pause; you want to know, not be cut off mid-job)
```

### 11.2 R2-specific usage check

```bash
# Dashboard path:
# 1. https://dash.cloudflare.com/<ACCOUNT_ID>/r2/overview
# 2. Right sidebar shows "Storage used" and "Operations this month"
# 3. Bookmark this page; check weekly during the first month
```

### 11.3 Hard limit (R2 has no built-in hard cap)

R2 has no "stop writing at 100GB" toggle. To enforce a hard cap, you need one of:

- A daily Cloudflare Worker that lists bucket sizes and emails you if >threshold
- A Render cron job that does the same check
- Trust + a budget alert + manual intervention

For a demo, trust + budget alert is fine.

---

## 12. Common gotchas

| Symptom | Cause | Fix |
| --- | --- | --- |
| `wrangler r2 bucket create` returns "Authentication error [code: 10000]" | wrangler not logged in, or logged into wrong account | `wrangler logout && wrangler login`; verify with `wrangler whoami` |
| `aws s3 cp` returns "SignatureDoesNotMatch" | Wrong region or wrong endpoint | Use `--endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com` and `--region auto` |
| Lifecycle policy JSON returns "Invalid request" | Missing `id` or `enabled` field | Add `"id": "rule-name", "enabled": true` to every rule |
| Spark `s3a://` write hangs forever | Missing `spark.delta.logStore.class` or wrong S3A impl | Set `spark.delta.logStore.class=org.apache.spark.sql.delta.storage.S3SingleDriverLogStore` |
| Token rotation breaks Spark mid-job | The new token has a different key ID | Spark must be restarted after every token rotation |
| Public bucket warning in dashboard | You enabled public access but did not configure a custom domain | Either disable public access, or add a custom domain to silence the warning |

---

## 13. Teardown (when you stop using R2)

```bash
# Empty the buckets first
wrangler r2 object list bronze | tail -n +2 | awk '{print $1}' | xargs -I {} wrangler r2 object delete bronze/{}
# (repeat for silver, gold, scripts)

# Delete the buckets
wrangler r2 bucket delete bronze
wrangler r2 bucket delete silver
wrangler r2 bucket delete gold
wrangler r2 bucket delete scripts

# Rotate the API tokens (delete them in the dashboard)
# https://dash.cloudflare.com/<ACCOUNT_ID>/r2/overview → "Manage R2 API Tokens" → delete each
```

After teardown, verify in the dashboard that "Storage used" reads 0 bytes across all buckets.

---

## 14. Reference links

- Cloudflare R2 docs: https://developers.cloudflare.com/r2/
- R2 pricing: https://developers.cloudflare.com/r2/pricing/
- S3 API compatibility: https://developers.cloudflare.com/r2/api/s3/api/
- wrangler CLI: https://developers.cloudflare.com/workers/wrangler/
- R2 lifecycle policies: https://developers.cloudflare.com/r2/buckets/object-lifecycles/
- R2 versioning: https://developers.cloudflare.com/r2/buckets/versioning/
- R2 custom domains: https://developers.cloudflare.com/r2/buckets/public-buckets/#custom-domains
