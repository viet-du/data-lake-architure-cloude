# Khởi động lại Docker, R2 và kết nối UI từ xa

Runbook cho máy Mac đang chạy Lakehouse API local, dùng Cloudflare R2 làm storage và Cloudflare Quick Tunnel để UI trên Pages truy cập API. Không đưa access key, secret, JWT secret hoặc mật khẩu vào tài liệu này.

> R2 lưu dữ liệu; Cloudflare Tunnel chỉ chuyển tiếp request tới API. Cần giữ máy Mac thức, có Internet, Docker và tunnel đang chạy để người ở xa truy cập API.

## 1. Mở Terminal tại thư mục dự án

```bash
cd /Users/mac/Documents/data-lake-architecture
```

## 2. Kiểm tra cấu hình riêng tư

Xác nhận `.env` có cấu hình R2 theo `docs/operations/R2_SETUP.md` và `apps/api/.env.local` có cấu hình API/auth cần thiết. Không dán nội dung hai file này vào chat, tài liệu hoặc git.

Các giá trị R2 cần được khai báo trong `.env` (hoặc môi trường Docker tương ứng): `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, cùng region/bucket phù hợp. File phải còn trên máy và được git-ignore.

## 3. Bật Docker và khởi động stack

Mở Docker Desktop, chờ trạng thái Engine chạy rồi thực hiện:

```bash
docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.dev-api.yml up -d
```

Lệnh này khởi động core services cùng API/Web. Các container có restart policy, nhưng Docker Desktop vẫn phải được mở sau khi máy khởi động lại.

Kiểm tra container và API:

```bash
docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.dev-api.yml ps
curl -fsS http://127.0.0.1:3001/api/health
```

Nếu API chưa sẵn sàng, xem log:

```bash
docker logs --tail 100 lake-api
```

## 4. Xác nhận kết nối R2

Nếu script có sẵn và `.env` đã cấu hình đúng, chạy:

```bash
./scripts/test_r2_connection.sh
```

Script kiểm tra đọc/ghi R2. Nếu script báo lỗi, kiểm tra `S3_ENDPOINT`, quyền token, bucket và kết nối mạng theo `docs/operations/R2_SETUP.md`. Không gửi output có thể chứa credential.

## 5. Khởi động Cloudflare Quick Tunnel

Trong một Terminal riêng, chạy:

```bash
cloudflared tunnel --url http://127.0.0.1:3001
```

Để nguyên cửa sổ Terminal này mở. Sao chép URL `https://<ten-ngau-nhien>.trycloudflare.com` mà cloudflared in ra. Xác nhận tunnel/API từ máy này bằng:

```bash
curl -fsS https://<ten-ngau-nhien>.trycloudflare.com/api/health
```

Mỗi lần tạo Quick Tunnel mới, hostname thường thay đổi. Nếu URL thay đổi, bản UI Cloudflare Pages hiện tại vẫn trỏ tới URL cũ cho đến khi build lại với `VITE_API_BASE_URL` mới và deploy lại. Không thay URL trong `.env` rồi kỳ vọng UI đã deploy tự cập nhật.

## 6. Kiểm tra từ xa

Mở UI Pages đã deploy, đăng nhập bằng tài khoản được cấp và kiểm tra một màn hình cần dữ liệu API. Đừng chia sẻ mật khẩu trong cùng tin nhắn công khai với link. Nếu UI mở được nhưng không tải dữ liệu, kiểm tra API, tunnel, URL API đã nhúng trong frontend build và danh sách CORS trong `apps/api/.env.local`.

## Dừng dịch vụ

Dừng Quick Tunnel bằng `Ctrl+C` tại Terminal đang chạy cloudflared. Dừng Docker stack (không xóa volumes) bằng:

```bash
docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.dev-api.yml down
```

Không dùng `down -v` trừ khi chủ ý xóa dữ liệu Docker volumes.
