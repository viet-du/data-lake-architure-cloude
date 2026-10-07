# Implementation Plan — Phase 2: Web UI (React 19 + Vite + 3D + Liquid Glass)

> **Ngày:** 2026-10-06
> **Phase:** P2 (sau P1-BE)
> **Tasks:** 11 (T1 → T11)
> **Mục tiêu cuối P2:** UI Control Plane hoàn chỉnh cho Lakehouse với glassmorphism + 3D liquid blob, 10 màn hình (Home + 9 module), dark/light + i18n (vi/en), wire đầy đủ với 108 endpoints BE.

---

## 1. Task Objective

Scaffold và xây dựng UI cho Lakehouse Control Plane theo stack:

- **React 19** + **Vite 6** + **TypeScript 5.7** (strict mode)
- **Tailwind CSS 3.4** (utility-first)
- **Three.js 0.171** + **@react-three/fiber 9** + **@react-three/drei 10** (3D liquid blob, pipeline schematic)
- **Framer Motion 11** (animation, page transitions)
- **@react-spring/web 9** (3D spring physics, parallax tilt)
- **TanStack React Query 5** (data fetching + cache)
- **Zustand 5** (auth, theme, i18n state)
- **i18next 24** + **react-i18next 15** + **i18next-browser-languagedetector 8**
- **Axios 1.7** (HTTP client)
- **Zod 3.24** (API response validation)
- **date-fns 4** (format dates)
- **Lenis 1** (smooth scroll)
- **react-router-dom 7** (routing)
- **oxlint** (linting - nhanh hơn ESLint)

**Style design:**
- Glassmorphism (frosted glass trên background image)
- 3D depth (cards nổi lên khỏi background, parallax tilt on hover)
- Liquid blob animation ở Home + Pipeline Schematic
- macOS 4K vibe (backdrop-blur, subtle shadows, smooth transitions)
- Dark mode default + Light mode switch
- i18n vi/en (instant switch, no reload)

**Theo working_rule.md:**
- Chương 11 (Architecture & Coding Style): 4-layer FE = Screen → Page → Component → Hook/Service
- Chương 13 (Naming Convention): Component/Screen file `kebab-case` + suffix (vd: `glass-card.component.tsx`, `home.screen.tsx`); Service/Helper file `kebab-case` (vd: `catalog.service.ts`); Component name `PascalCase` (vd: `GlassCard`); Enum `EPascalCase` với value UPPERCASE
- Chương 28.1: KHÔNG thêm comment (kể cả JSDoc) trừ khi giải thích logic phức tạp
- Chương 28.2: KHÔNG thêm icon ngoài design system (đã có 15 icon PNG từ sếp)
- Chương 28.3: Tuân thủ kiến trúc đã chốt (Screen → Page → Component)

**Quyết định đã chốt với sếp:**
- Path: `apps/web/` (monorepo pnpm workspace)
- Stack: React 19 + Vite 6 + Tailwind 3 + R3F 9 (Three.js 0.171)
- Style: 3D + Liquid + Glassmorphism (full)
- Icons: rename + re-export với PascalCase (`ICONS.Home`, `ICONS.Bronze`, ...)
- Screens: full 10 màn (Home + catalog + bronze + silver + gold + kafka + airflow + crawler + dq + health)

---

## 2. Files Impacted

### 2.1. P2-T1 — Assets setup (rename + barrel) ✅ DONE

| File | Trạng thái |
|------|-----------|
| `apps/web/src/assets/icon/airflow.png` ... `apache-spark.png` (15 files) | Renamed từ `Airflow.png`, `Sliver.png` (sai chính tả), `apache_spark.png` |
| `apps/web/src/assets/icon/index.ts` | Re-export `ICONS: Readonly<Record<EIconName, string>>` |
| `apps/web/src/assets/icon/icon.types.ts` | Type `EIconName` (15 giá trị) + `IconComponentProps` |
| `apps/web/src/assets/images/background/background-dark.png` | Renamed từ `backgroun_dark_mode.png` |
| `apps/web/src/assets/images/background/background-light.png` | Renamed từ `background_light_mode.png` |
| `apps/web/src/assets/images/background/index.ts` | Re-export `BACKGROUNDS: Readonly<Record<EBackgroundVariant, string>>` |
| `apps/web/src/assets/images/goal/UI_goal.png` | Reference design (KHÔNG re-export) |
| `apps/web/src/assets/images/index.ts` | Re-export `IMAGES: Readonly<Record<EImageName, string>>` (chỉ `Goal`) |
| `apps/web/src/assets/index.ts` | Top-level barrel |

**Kết quả verify:** tsc --noEmit pass ✓

### 2.2. P2-T2 — Install 3D + animation + i18n deps ✅ DONE

```
+ @react-spring/web ^9.7.5
+ @react-three/drei ^10.7.9
+ @react-three/fiber ^9.8.1
+ @types/three ^0.171.0
+ @use-gesture/react ^10.3.1
+ date-fns ^4.1.0
+ framer-motion ^11.15.0
+ i18next ^24.1.0
+ i18next-browser-languagedetector ^8.0.0
+ lenis ^1.1.20
+ react-i18next ^15.1.3
+ three ^0.171.0
+ zod ^3.24.1
```

**Kết quả verify:** `pnpm install` pass (warning peer React 18 cho @react-spring - work trên React 19 OK) ✓

### 2.3. P2-T3 — i18n setup ✅ DONE

| File | Mục đích |
|------|----------|
| `apps/web/src/i18n/types.ts` | `ELanguage`, `SUPPORTED_LANGUAGES`, `DEFAULT_LANGUAGE`, `LANGUAGE_LABELS`, `LANGUAGE_NAMES` |
| `apps/web/src/i18n/config.ts` | i18next instance + init (LanguageDetector + localStorage cache) |
| `apps/web/src/i18n/index.ts` | Barrel export |
| `apps/web/src/i18n/locales/en.json` | English translations (moved từ `assets/languages/`) |
| `apps/web/src/i18n/locales/vi.json` | Vietnamese translations |
| `apps/web/src/store/i18n.store.ts` | Zustand store cho language state + sync với i18next |
| `apps/web/src/store/index.ts` | Updated: export `useI18nStore` |
| `apps/web/src/main.tsx` | Import `./i18n` để init |

### 2.4. P2-T4 — Foundation components

> **Mục tiêu:** 13 component nền tảng, mỗi component 1 file, theo rule `kebab-case.component.tsx` + `PascalCase` + barrel.

| File (path) | Component name | Mục đích |
|-------------|---------------|----------|
| `components/glass/glass-card.component.tsx` | `GlassCard` | Card nền frosted glass, dùng `<div className="backdrop-blur-xl bg-white/5 dark:bg-black/20 border border-white/10 shadow-glass">` |
| `components/glass/background-layer.component.tsx` | `BackgroundLayer` | Full-screen background image (light/dark từ `@/assets`), glass overlay |
| `components/glass/liquid-blob.component.tsx` | `LiquidBlob` | 3D liquid blob bằng R3F + Three.js (sphere với noise displacement, custom shader) |
| `components/common/tooltip.component.tsx` | `Tooltip` | Hover tooltip (Radix-style), portal-based, smooth fade |
| `components/common/tilt-3d-card.component.tsx` | `Tilt3DCard` | Wrapper dùng `useTilt3D` hook, perspective + rotateX/Y, spring physics |
| `components/common/button.component.tsx` | `Button` | Primary/secondary/ghost/danger variants, loading state, icon support |
| `components/common/input.component.tsx` | `Input` | Text input, search input variant, focus ring glow |
| `components/common/select.component.tsx` | `Select` | Dropdown với glassmorphism panel, search support |
| `components/common/table.component.tsx` | `Table` | Generic table (head/body/row/cell) với sorting + pagination, glass rows |
| `components/common/tag.component.tsx` | `Tag` | Status tag (success/warning/error/info) với dot indicator |
| `components/common/skeleton.component.tsx` | `Skeleton` | Loading placeholder (shimmer animation) |
| `components/common/empty-state.component.tsx` | `EmptyState` | Empty state với icon + title + description + CTA |
| `components/common/error-boundary.component.tsx` | `ErrorBoundary` | React error boundary với glass error card |

**Quy tắc component:**
- 1 file = 1 component (KHÔNG multi-export)
- Props interface inline hoặc re-export từ `*.types.ts` (cùng folder)
- Mỗi component dùng `cn()` từ `@/theme` cho className merge
- Animation: dùng `framer-motion` cho enter/exit, `useTilt3D` cho 3D tilt
- KHÔNG comment trong source code

### 2.5. P2-T5 — Layout (Header + NavRail + Layout shell)

| File | Mục đích |
|------|----------|
| `navigation/header/header-bar.component.tsx` | `HeaderBar` - top header: title + subtitle + search + lang/theme toggle |
| `navigation/header/language-toggle.component.tsx` | `LanguageToggle` - pill switch VI/EN, dùng `useI18nStore` |
| `navigation/header/theme-toggle.component.tsx` | `ThemeToggle` - icon button light/dark, dùng `useThemeStore` |
| `navigation/header/search-box.component.tsx` | `SearchBox` - search bar với glass background, icon, debounced |
| `navigation/header/storage-meter.component.tsx` | `StorageMeter` - thanh progress storage usage (optional) |
| `navigation/rail/nav-rail.component.tsx` | `NavRail` - left vertical rail với 10 icons (Home, Catalog, Bronze, Silver, Gold, Kafka, Airflow, Crawler, DQ, Health) |
| `navigation/rail/rail-item.component.tsx` | `RailItem` - 1 item trong rail (icon + label visible on hover/active) |
| `navigation/rail/nav-rail.types.ts` | `NavRailItem` type (`{ key, path, iconName, labelKey }`) |
| `navigation/layout/layout.component.tsx` | `Layout` - shell: `BackgroundLayer` + `NavRail` + `HeaderBar` + `<Outlet />` (React Router) |
| `navigation/index.ts` | Updated: re-export Layout + Header + Rail components |

**Layout structure:**
```
<div className="relative h-screen w-screen overflow-hidden">
  <BackgroundLayer />              // full-screen
  <div className="relative z-10 flex h-full">
    <NavRail />                      // left 80px, vertical icons
    <div className="flex-1 flex flex-col">
      <HeaderBar />                  // top 80px, centered title + search + toggles
      <main className="flex-1 overflow-y-auto">
        <Outlet />                   // current screen
      </main>
    </div>
  </div>
</div>
```

### 2.6. P2-T6 — Wire React Query + 9 services + types từ BE

> **Mục tiêu:** Kết nối FE ↔ BE qua 108 endpoints hiện có. Validate response bằng Zod.

| File | Mục đích |
|------|----------|
| `services/api/client.ts` | Axios instance + interceptors (auth header, 401 → signOut) |
| `services/api/endpoints.ts` | Constants cho 108 endpoint paths (auto-derive từ BE) |
| `services/api/schemas.ts` | Zod schemas cho response types (1 schema per module) |
| `services/catalog/catalog.service.ts` | `listDatabases`, `getDatabase`, `listTables`, `getTable`, `getTableStats`, ... |
| `services/catalog/queries.ts` | React Query hooks: `useDatabasesQuery`, `useTablesQuery`, `useTableQuery` |
| `services/bronze/bronze.service.ts` | `listTables`, `getTable`, `getStats`, `getIngestion`, `triggerIngest` |
| `services/bronze/queries.ts` | `useBronzeTablesQuery`, `useBronzeTableQuery`, `useIngestMutation` |
| `services/silver/silver.service.ts` | `listTables`, `transform`, `timeTravel`, `jobs` |
| `services/silver/queries.ts` | `useSilverTablesQuery`, `useTransformMutation`, `useTimeTravelQuery` |
| `services/gold/gold.service.ts` | `listAggregates`, `getAggregate`, `goldQueries` |
| `services/gold/queries.ts` | `useGoldAggregatesQuery`, `useGoldQueryQuery` |
| `services/kafka/kafka.service.ts` | `listTopics`, `getTopic`, `produce`, `consumerGroups` |
| `services/kafka/queries.ts` | `useKafkaTopicsQuery`, `useProduceMutation` |
| `services/airflow/airflow.service.ts` | `listDAGs`, `getDAG`, `trigger`, `pause`, `unpause`, `logs` |
| `services/airflow/queries.ts` | `useDAGsQuery`, `useTriggerMutation` |
| `services/crawler/crawler.service.ts` | `listJobs`, `getJob`, `start`, `stop`, `progress` |
| `services/crawler/queries.ts` | `useCrawlerJobsQuery`, `useStartMutation` |
| `services/dq/dq.service.ts` | `listChecks`, `getCheck`, `runCheck`, `report` |
| `services/dq/queries.ts` | `useDQChecksQuery`, `useRunCheckMutation` |
| `services/health/health.service.ts` | `getStatus`, `getServices`, `getMetrics` |
| `services/health/queries.ts` | `useHealthStatusQuery`, `useServicesQuery` |
| `services/index.ts` | Updated: re-export all services + queries |
| `types/entities/*.ts` | Per-module types (Database, Table, BronzeTable, SilverTable, GoldAggregate, KafkaTopic, DAG, CrawlerJob, DQCheck) |
| `types/entities/index.ts` | Barrel export |

**Conventions:**
- 1 service file = 1 module (KHÔNG gộp)
- `*.service.ts` chỉ chứa function calls axios (no React)
- `*.queries.ts` chứa React Query hooks (use prefix)
- Types từ `types/entities/` match với BE response (validated bằng Zod)

### 2.7. P2-T7 — Home Screen (Bento grid)

| File | Mục đích |
|------|----------|
| `components/home/hero-card.component.tsx` | `HeroCard` - title "Lakehouse Control Plane" + subtitle + LiquidBlob background + 3D tilt |
| `components/home/metric-card.component.tsx` | `MetricCard` - small card với icon + value + delta + sparkline |
| `components/home/pipeline-status-card.component.tsx` | `PipelineStatusCard` - list 5 recent pipelines với status tag |
| `components/home/lake-overview-card.component.tsx` | `LakeOverviewCard` - donut chart Bronze/Silver/Gold counts |
| `components/home/recent-activity-card.component.tsx` | `RecentActivityCard` - list 10 recent events (crawler, ingest, transform) |
| `components/home/system-health-card.component.tsx` | `SystemHealthCard` - services status (MinIO, Kafka, Mongo, Redis, Spark) |
| `screens/home.screen.tsx` | Updated: Bento grid layout (12 cols × 8 rows) |
| `screens/index.ts` | Updated: export `HomeScreen` |

**Bento grid layout:**
```
[        Hero (8×4)         ] [LakeOverview (4×4)]
[Metric 1 (2×2)] [Metric 2 (2×2)] [Metric 3 (2×2)] [Metric 4 (2×2)]
[        PipelineStatus (8×4)        ] [Health (4×4)]
[        RecentActivity (12×2)                          ]
```

### 2.8. P2-T8 — 9 Module screens

Mỗi module screen có cấu trúc giống nhau:

| File pattern | Mục đích |
|--------------|----------|
| `screens/<module>.screen.tsx` | Container - fetch data + render Page |
| `components/<area>/<module>-view.component.tsx` | Page component - render content |
| `components/<area>/<module>-table.component.tsx` | Table view (list rows) |
| `components/<area>/<module>-detail.component.tsx` | Detail panel (slide-in) |
| `components/<area>/<module>-actions.component.tsx` | Action buttons (start, stop, refresh) |

**9 modules (theo BE):**

| Module | Path prefix | Icon | Key features |
|--------|-------------|------|--------------|
| Catalog | `/api/catalog` | `HiveMetastore` | Database list, table list, table schema, sample data, stats |
| Bronze | `/api/bronze` | `Bronze` | Table list, ingest trigger, raw data preview, ingestion jobs |
| Silver | `/api/silver` | `Silver` | Table list, transform trigger, time travel, jobs history |
| Gold | `/api/gold` | `Gold` | Aggregate list, query runner, materialized views |
| Kafka | `/api/kafka` | `Kafka` | Topic list, produce message, consumer groups, lag |
| Airflow | `/api/airflow` | `Airflow` | DAG list, trigger, pause/unpause, logs, Gantt |
| Crawler | `/api/crawler` | `Pipeline` | Job list, start/stop, progress, rate chart |
| DQ | `/api/dq` | `Analyst` | Check list, run check, report, severity chart |
| Health | `/api/health` | `Cloud` | Service status, latency, uptime, version |

### 2.9. P2-T9 — 3D Pipeline Schematic (Liquid blob + Data flow)

| File | Mục đích |
|------|----------|
| `components/schematic/pipeline-flow-3d.component.tsx` | `PipelineFlow3D` - 3D scene với nodes (Crawler → Bronze → Silver → Gold) |
| `components/schematic/liquid-blob-3d.component.tsx` | `LiquidBlob3D` - shader-based liquid blob cho mỗi node active |
| `components/schematic/data-particle-3d.component.tsx` | `DataParticle3D` - particles chảy giữa các nodes (animated) |
| `components/schematic/storage-inspector.component.tsx` | `StorageInspector` - hover 1 node → show stats popup |
| `components/schematic/index.ts` | Barrel |
| `screens/schematic.screen.tsx` (optional) | Full-screen 3D pipeline view (Phase 3) |

**3D scene:**
- `<Canvas>` (R3F) full-screen
- 4-6 nodes (sphere/box) đại diện cho layer (Crawler, Bronze, Silver, Gold, Storage, Catalog)
- Liquid blob shader: vertex displacement với noise, fragment color theo layer
- Particles: chảy từ node → node, màu theo data type
- Camera control: OrbitControls (drei), auto-rotate
- Lighting: ambient + 2 point lights (warm + cool)
- Click 1 node → highlight + show storage inspector panel

### 2.10. P2-T10 — Polish

| Task | Mục đích |
|------|----------|
| Dark/light transition animation | Fade-in 200ms khi switch theme |
| i18n instant switch | 0 reload, chỉ re-render components dùng `t()` |
| Responsive | Breakpoints: mobile (<768), tablet (768-1024), desktop (>1024) |
| Loading states | Skeleton cho mỗi màn khi data fetching |
| Error states | ErrorBoundary + per-query error card với retry button |
| Empty states | EmptyState component với icon + CTA |
| Toast notifications | useToast hook + ToastContainer (success/error/warning/info) |
| Accessibility | aria-labels, keyboard nav, focus ring, color contrast WCAG AA |
| SEO/meta | `<title>`, `<meta>` per route (nếu cần) |
| Performance | React.lazy cho màn nặng, code splitting theo route, memo cho heavy components |

### 2.11. P2-T11 — Verify

| Verify | Command | Pass criteria |
|--------|---------|---------------|
| Typecheck | `pnpm -r typecheck` | 0 errors |
| Lint | `pnpm -r lint` | 0 errors |
| Build | `pnpm -r build` | 0 errors, bundle < 1MB gzipped |
| Dev server | `pnpm web:dev` | Vite serve ở port 5173, page render OK |
| Manual QA | Mở browser, click 10 màn | Mỗi màn render + load data (mock hoặc thật) |
| Lighthouse | Chrome DevTools | Performance > 80, Accessibility > 90, Best Practices > 90 |
| Visual QA | So với `assets/images/goal/UI_goal.png` | Match 80%+ layout |

---

## 3. Architecture Layers

```
┌────────────────────────────────────────────────────────────┐
│  Screen (src/screens/*.screen.tsx)                          │
│  - 1 file / màn (catalog, bronze, ...)                      │
│  - Gọi từ Layout, render Page <ViewComponent/>              │
│  - Có thể fetch data qua React Query (useXxxQuery)         │
└──────────────────────────────┬─────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────┐
│  Page View (src/components/<area>/<x>-view.component.tsx) │
│  - 1 file = 1 page component                                │
│  - Gọi từ Screen                                           │
│  - Nhận props + render sub-components + actions            │
└──────────────────────────────┬─────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────┐
│  Sub-component (src/components/common/, charts/, glass/)   │
│  - 1 file = 1 component (StatCard, GlassCard, ...)         │
│  - Reusable, dùng ở nhiều page                              │
│  - Có thể dùng 3D (R3F) cho component nặng                 │
└──────────────────────────────┬─────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────┐
│  Service + Hook (src/services/, src/hooks/)                │
│  - Service: axios + Zod validation                          │
│  - Query: React Query useQuery/useMutation                  │
│  - Store: Zustand (auth, theme, i18n)                       │
└──────────────────────────────┬─────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────┐
│  Backend (apps/api - đã có)                                 │
│  Next.js 15 + 108 endpoints                                 │
└────────────────────────────────────────────────────────────┘
```

## 4. Naming Convention (mirror BE)

| Element | Convention | Example |
|---------|-----------|---------|
| Component file | `kebab-case.component.tsx` | `glass-card.component.tsx` |
| Screen file | `kebab-case.screen.tsx` | `home.screen.tsx` |
| Service file | `kebab-case.service.ts` | `catalog.service.ts` |
| Query file | `kebab-case.queries.ts` | `catalog.queries.ts` |
| Hook file | `use-kebab-case.ts` | `use-translation.ts` |
| Store file | `kebab-case.store.ts` | `theme.store.ts` |
| Types file | `kebab-case.types.ts` | `icon.types.ts` |
| Component name | `PascalCase` | `GlassCard` |
| Hook name | `useCamelCase` | `useTilt3D` |
| Store name | `useXxxStore` | `useThemeStore` |
| Type | `PascalCase` | `GlassCardProps` |
| Enum | `EPascalCase` | `EThemeMode` |
| Enum value | `UPPERCASE_SNAKE` | `'LIGHT'`, `'DARK'`, `'SYSTEM'` |
| Constant | `UPPER_SNAKE_CASE` | `MAX_PAGE_SIZE` |
| Variable | `camelCase` | `tableName` |
| Function | `camelCase` | `getTable` |
| Boolean | prefix `is/has/can` | `isLoading`, `hasError` |
| Folder | `kebab-case` | `nav-rail`, `glass-card` |

## 5. Tech Stack Details

| Layer | Library | Version | Mục đích |
|-------|---------|---------|----------|
| Framework | React | 19.0 | UI rendering |
| Bundler | Vite | 6.4 | Dev server + build |
| Language | TypeScript | 5.7 | Type safety |
| Styling | Tailwind CSS | 3.4 | Utility CSS |
| 3D | three | 0.171 | WebGL 3D |
| 3D React | @react-three/fiber | 9.8 | React renderer cho Three.js |
| 3D Helpers | @react-three/drei | 10.7 | Helpers (OrbitControls, MeshDistort, ...) |
| Animation | framer-motion | 11.15 | Page transitions, micro-interactions |
| Spring | @react-spring/web | 9.7 | Physics-based animations (3D) |
| Gesture | @use-gesture/react | 10.3 | Drag/pinch/hover |
| Smooth scroll | lenis | 1.1 | Smooth scrolling |
| Data | @tanstack/react-query | 5.59 | Server state cache |
| HTTP | axios | 1.7 | HTTP client |
| Validation | zod | 3.24 | Runtime type check |
| State | zustand | 5.0 | Client state |
| i18n | i18next | 24.1 | Translations |
| i18n React | react-i18next | 15.1 | React binding |
| i18n Detect | i18next-browser-languagedetector | 8.0 | Auto-detect language |
| Routing | react-router-dom | 7.1 | SPA routing |
| Date | date-fns | 4.1 | Format dates |
| Lint | oxlint | 0.9 | Fast linter |

## 6. Asset Map (15 icons + 2 backgrounds)

| Module | Icon | Background |
|--------|------|-----------|
| Home | `Home` | `dark` / `light` |
| Catalog | `HiveMetastore` | (inherit) |
| Bronze | `Bronze` | (inherit) |
| Silver | `Silver` | (inherit) |
| Gold | `Gold` | (inherit) |
| Kafka | `Kafka` | (inherit) |
| Airflow | `Airflow` | (inherit) |
| Crawler | `Pipeline` (no dedicated icon) | (inherit) |
| DQ | `Analyst` | (inherit) |
| Health | `Cloud` | (inherit) |
| Common | `Storage`, `Terraform`, `PostgreSQL`, `ApacheSpark`, `Background` | — |

## 7. Progress Tracker

| Task | Trạng thái | Ghi chú |
|------|-----------|---------|
| P2-T1: Assets setup | ✅ DONE | 15 icons + 2 backgrounds renamed + re-exported |
| P2-T2: Install deps | ✅ DONE | 13 packages installed (3D + i18n + zod + date-fns) |
| P2-T3: i18n setup | ✅ DONE | i18next + Zustand store + locales moved |
| P2-T4: Foundation components | ⏳ TODO | 13 components (GlassCard, BackgroundLayer, LiquidBlob, Tooltip, Tilt3DCard, Button, Input, Select, Table, Tag, Skeleton, EmptyState, ErrorBoundary) |
| P2-T5: Layout | ⏳ TODO | HeaderBar + NavRail + Layout shell |
| P2-T6: Services + Queries | ⏳ TODO | 9 services + React Query hooks + Zod schemas |
| P2-T7: Home Screen | ⏳ TODO | Bento grid (Hero + 4 metric + pipeline + health + recent) |
| P2-T8: 9 module screens | ⏳ TODO | Catalog, Bronze, Silver, Gold, Kafka, Airflow, Crawler, DQ, Health |
| P2-T9: 3D Pipeline Schematic | ⏳ TODO | R3F scene với liquid blob + data particles |
| P2-T10: Polish | ⏳ TODO | Dark/light transition, i18n switch, responsive, loading, error, a11y |
| P2-T11: Verify | ⏳ TODO | Typecheck + build + manual QA + Lighthouse |

**3/11 tasks done (27%)** — Foundation phase complete, ready cho P2-T4 (foundation components).

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Bundle size lớn do R3F + Three.js | Dynamic import LiquidBlob3D + PipelineFlow3D (lazy load) |
| React 19 + R3F 9 incompatibility | Đã verify R3F 9.8 hỗ trợ React 19.0-19.2 ✓ |
| TypeScript strict mode + R3F types | Dùng `any` cho R3F intrinsics (đã có pattern trong drei) |
| i18n switch gây re-render toàn app | i18next đã handle; chỉ components dùng `t()` re-render |
| 3D scene gây perf issue trên low-end | Detect GPU, fallback to 2D LiquidBlob nếu không support WebGL 2 |
| BE chưa có 1 số endpoint (vd: crawler service) | Mock data + comment "TODO: wire when BE ready" |
| Lighthouse < 80 | Code splitting, lazy load 3D, optimize images (WebP), defer non-critical CSS |

## 9. Reference

- UI goal: `apps/web/src/assets/images/goal/UI_goal.png`
- BE plan: `docs/plan/plan_overview/22-p1-implementation-plan.md`
- BE architecture: `docs/plan/plan_before_process/example_BE_architecture.md`
- Working rule: `working_rule.md`
- Naming convention: `.agents/rules/NAMING_CONVENTION.md`
