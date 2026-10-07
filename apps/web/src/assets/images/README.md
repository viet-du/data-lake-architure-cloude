# Image Assets

Thư mục chứa hình ảnh raster (PNG / JPG / WebP) dùng trong web app.

## Hướng dẫn bổ sung

- **Định dạng**:
  - WebP (best compression) là lựa chọn ưu tiên.
  - PNG (transparency) cho ảnh có nền trong suốt.
  - JPG (photos) cho ảnh chụp.
- **Kích thước khuyến nghị**:
  - Hero / banner: 1920x1080 trở lên (Retina 2x: 3840x2160).
  - Card / list item: 640x360 hoặc 1280x720.
  - Thumbnail: 256x256 hoặc 512x512.
- **Convention đặt tên**: `kebab-case` (vd: `hero-banner.webp`, `empty-state.webp`).
- **Re-export qua barrel**: Mỗi image re-export trong `index.ts` để import qua `@/assets`.

## Pattern re-export (Vite)

```ts
// assets/images/index.ts
import heroUrl from './hero.webp';
export const heroImage = heroUrl;
```

```tsx
import { heroImage } from '@/assets';
<img src={heroImage} alt="Hero" />;
```

## Cần bổ sung (sau khi sếp cung cấp)

- `hero.webp` — ảnh hero cho trang chủ / landing
- `ui.webp`, `ui_ex.jpg` — ảnh UI mẫu sếp cung cấp (cho design reference)
- `logo.webp`, `logo-dark.webp` — logo app
- `empty-state/{module}.webp` — empty state cho từng màn (catalog, bronze, silver, gold, crawler, kafka, airflow, dq)
- `onboarding/01.webp`, `onboarding/02.webp`, ... — flow onboarding (optional)
