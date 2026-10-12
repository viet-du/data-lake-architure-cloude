#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR/apps/web"

echo "📦 Installing dependencies..."
pnpm install

echo "📦 Building web app..."
pnpm build

cd "$PROJECT_DIR"

echo "🚀 Deploying to Cloudflare Pages..."
npx wrangler pages deploy apps/web/dist --project-name=data-lake-architecture-cloude

echo "✅ Deploy complete!"
