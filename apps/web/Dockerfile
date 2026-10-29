FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/web/ ./apps/web/
ENV NODE_ENV=production
# Vite embeds client configuration at build time. Keep the default same-origin
# so the browser calls /api and nginx proxies it to the Compose `api` service.
# A public deployment can override this with `--build-arg`.
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN corepack enable && pnpm install --filter @lakehouse/web... --frozen-lockfile && pnpm --filter @lakehouse/web build

FROM nginx:1.27-alpine AS runner
WORKDIR /usr/share/nginx/html
COPY --from=builder /app/apps/web/dist ./
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 5173
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5173/ >/dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
