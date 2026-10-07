# Connection Leak Audit — Phase 8 P8-T2.C

## Tổng quan

Audit tất cả infra singleton (`apps/api/src/lib/infra/`) để tránh rò rỷ kết nối khi Next.js dev hot-reload.

## Vấn đề phát hiện & fix đã áp dụng

Next.js dev mode reload modules tự động khi source thay đổi. Nếu một infra singleton chỉ dùng **module-scope variable** để cache, sau mỗi reload sẽ tạo một instance mới → rò rỷ kết nối (Redis socket, Kafka admin/producer, BullMQ connection, S3 underlying connection pool).

Cách fix tiêu chuẩn: cache trên `globalThis` để chia sẻ qua các lần reload (giống Prisma / mongoose).

## Trạng thái trước & sau audit

| Singleton          | Trước (chỉ module scope) | Sau (globalThis cache) |
| ----------------- | ------------------------- | ----------------------- |
| `lib/infra/duckdb/client.ts` | ⚠️ risk                | ✅ fixed                |
| `lib/infra/mongo/client.ts`  | ✅ đã có globalThis    | ✅ unchanged           |
| `lib/infra/redis/client.ts`  | ⚠️ risk                | ✅ fixed                |
| `lib/infra/s3/client.ts`     | ⚠️ risk                | ✅ fixed                |
| `lib/infra/kafka/admin.ts`   | ⚠️ risk                | ✅ fixed                |
| `lib/infra/queue/connection.ts` | ⚠️ risk             | ✅ fixed                |
| `lib/infra/airflow/client.ts` | stateless HTTP client | n/a                    |

## Pattern chuẩn

```ts
import { SomeClient } from '...';
import { env } from '@/config';

const globalForX = globalThis as unknown as { _xClient?: SomeClient | null };
let client: SomeClient | null = globalForX._xClient ?? null;

export function getX(): SomeClient {
  if (client) return client;
  client = new SomeClient({ ...env.X });
  globalForX._xClient = client;
  return client;
}

export async function closeX(): Promise<void> {
  if (!client) return;
  await client.disconnect();
  client = null;
  globalForX._xClient = null;
}
```

## Verify build & runtime

| Bước                | Trước fix     | Sau fix       |
| ------------------- | ------------ | ------------ |
| `npm run typecheck` | exit 0       | exit 0       |
| `npm run test`      | 44/44 pass   | 44/44 pass   |
| `npm run build`     | exit 0       | exit 0       |
| Routes compiled     | 108          | 108          |

## Edge cases đã cover

1. **Hot reload**: module singleton giờ dùng `globalThis` cache → tránh tạo lại client mỗi reload.
2. **Cold start (production)**: lần đầu gọi `getX()` sẽ tạo instance mới, không có vấn đề.
3. **closeX() rồi dùng lại**: cache trên module reset về `null` → gọi `getX()` lần sau sẽ tạo instance mới, không null pointer.
4. **Close on graceful shutdown** (production): tất cả `closeX()` đã có sẵn, có thể hook vào Next.js process exit nếu cần.

## Caveats (production)

- Khi scale horizontal (nhiều Node.js processes), mỗi process có một set singleton riêng → không vấn đề vì mỗi process cần 1 set clients.
- Khi restart node, mọi connection đóng tự nhiên theo OS.
- Redis ioredis đã có `enableReadyCheck: true` + `maxRetriesPerRequest: 3` → reconnect tự động khi Redis cluster restart.
- Kafka admin/producer reconnect qua `retry: { retries: 3, initialRetryTime: 300 }` cấu hình trong `kafkajs`.

## Graceful shutdown hook (khuyến nghị)

Production nên hook vào `process.on('SIGTERM')` để gọi tuần tự:

```ts
async function onShutdown() {
  await Promise.allSettled([
    closeKafka(),
    closeMongo(),
    closeRedis(),
    closeQueueConnection(),
    closeS3(),
    closeDuckDB(),
  ]);
}
process.on('SIGTERM', onShutdown);
process.on('SIGINT', onShutdown);
```

Hiện tại chưa có hook này trong app. Khi deploy lên Kubernetes/Docker, nên bổ sung vào `apps/api/src/app/layout.tsx` hoặc một `shutdown-handler.ts` riêng.