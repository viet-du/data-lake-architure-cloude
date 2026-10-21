#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [[ "${VITE_API_BASE_URL:-}" != https://* ]]; then
  echo "Set VITE_API_BASE_URL to the public HTTPS API origin before deploying Pages." >&2
  exit 1
fi
export VITE_API_BASE_URL

cd "$PROJECT_DIR/apps/web"

echo "📦 Installing dependencies..."
pnpm install

echo "📦 Building web app..."
pnpm build

cd "$PROJECT_DIR"

echo "🚀 Deploying to Cloudflare Pages..."
npx wrangler pages deploy apps/web/dist --project-name=data-lake-architecture-cloude

echo "✅ Deploy complete!"
