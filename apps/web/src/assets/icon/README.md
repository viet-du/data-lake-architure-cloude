# Icon Assets

Thư mục chứa các icon SVG dùng trong web app.

## Hướng dẫn bổ sung

- **Định dạng**: SVG (scale vô hạn, recolor được) — KHÔNG dùng PNG.
- **Convention đặt tên**: `kebab-case` (vd: `home.svg`, `arrow-left.svg`, `database.svg`).
- **Kích thước viewBox**: `0 0 24 24` là chuẩn (vd: hero icon có thể `0 0 32 32`).
- **Stroke-based** (lucide-style) thay vì fill — dễ recolor bằng Tailwind `text-*`.
- **Re-export qua barrel**: import qua `@/assets` thay vì import trực tiếp từ `assets/icon/home.svg`.

## Pattern re-export

```ts
// assets/icon/index.ts
export { default as HomeIcon } from './home.svg?react';
export { default as ArrowLeftIcon } from './arrow-left.svg?react';
```

```tsx
import { HomeIcon } from '@/assets';
<HomeIcon className="h-6 w-6 text-primary-500" />
```

## Cần bổ sung các icon sau (ưu tiên)

- **App**: `app-logo.svg`, `app-logo-dark.svg`
- **Navigation (NavRail)**: `home.svg`, `catalog.svg`, `bronze.svg`, `silver.svg`, `gold.svg`, `crawler.svg`, `kafka.svg`, `airflow.svg`, `dq.svg`, `health.svg`
- **Action**: `play.svg`, `pause.svg`, `stop.svg`, `refresh.svg`, `search.svg`, `filter.svg`, `download.svg`, `upload.svg`
- **Status**: `success.svg`, `error.svg`, `warning.svg`, `info.svg`, `loading.svg`
- **UI control**: `arrow-left.svg`, `arrow-right.svg`, `chevron-down.svg`, `chevron-up.svg`, `close.svg`, `menu.svg`, `settings.svg`, `user.svg`, `theme.svg`, `language.svg`
- **Lakehouse-specific**: `delta.svg`, `spark.svg`, `minio.svg`, `duckdb.svg`, `mongo.svg`, `redis.svg`
