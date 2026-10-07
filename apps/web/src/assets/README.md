# Assets

Mọi asset static (icon, image, font, language) đều phải nằm trong folder này và re-export qua barrel `index.ts`.

## Quy tắc

- **KHÔNG import trực tiếp** từ `assets/icon/home.svg` → PHẢI import qua `@/assets` (tức `src/assets/index.ts`).
- **Mỗi folder con** có barrel riêng (`icon/index.ts`, `images/index.ts`, ...).
- **Thêm asset mới** = (1) bỏ file vào folder, (2) re-export trong `index.ts` của folder đó.
- **Placeholder**: nếu folder rỗng, file `index.ts` vẫn phải tồn tại và export 1 cờ placeholder = true`.

## Cấu trúc

```
src/assets/
├── icon/              → SVG icons (re-export qua index.ts)
├── images/            → ảnh raster (WebP/PNG/JPG)
│   └── background/    → background patterns, hero, splash
└── languages/         → i18n (en.json, vi.json, ...)
```

## Sếp cần bổ sung

Xem `icon/README.md`, `images/README.md`, `images/background/README.md` để biết danh sách asset cần bổ sung.
