# STUDIO V2 — Hệ thống quản lý nội bộ The Will Studio

STUDIO V2 là ứng dụng quản lý vận hành dành riêng cho The Will Studio. Hệ thống hỗ trợ CRM, khách hàng, hợp đồng, công việc, mục tiêu, nhân sự, thông báo và trò chuyện nội bộ trên cả desktop lẫn mobile web.

## Trạng thái dự án

- Production: `https://thewill.io.vn`
- Production host: `will@192.168.1.34`
- Nhánh release đang chạy: `release-candidate/studio-v2-hardening-crm-2026-07-11`
- Source release: `96048be106b0f0afc497d88a5c42c485d69a7313`
- Image production được khóa theo immutable digest, không dùng tag `latest`.
- PostgreSQL là nguồn dữ liệu chính; không còn dùng `db.json` làm database runtime.

Agent hoặc lập trình viên tiếp quản production phải đọc tài liệu sau trước:

```text
docs/handoffs/production/00_READ_FIRST_STUDIO_V2_FULL_HANDOFF_2026-07-14.md
```

## Tính năng chính

| Phân hệ | Khả năng |
| --- | --- |
| CRM và khách hàng | Quản lý khách hàng tiềm năng, hồ sơ khách hàng, ngày sinh, ngày cưới và lịch sử chăm sóc. |
| Hợp đồng và đơn hàng | Theo dõi gói dịch vụ, trạng thái thực hiện và lịch sử chuyển trạng thái. |
| Công việc | Phân công, cập nhật tiến độ, ưu tiên, thời hạn và thông báo giao việc. |
| Mục tiêu | Theo dõi mục tiêu, kết quả then chốt và tiến độ vận hành. |
| Nhân sự và phân quyền | Quản lý tài khoản theo vai trò và permission. |
| Chat Native | Kênh chung, tin nhắn riêng, realtime Socket.IO, unread/read state, tag nhân viên, ảnh và tham chiếu task/khách hàng. |
| Thông báo | Thông báo trong ứng dụng, browser notification và service worker. |
| Nhắc ngày kỷ niệm | Nhắc sinh nhật, ngày cưới, chống trùng và hỗ trợ mốc 29/02. |
| Backup production | Mã hóa PostgreSQL và `chat_uploads`, kiểm tra SHA-256 và đồng bộ Google Drive. |

Thông báo khi trình duyệt đóng hoàn toàn cần Web Push/VAPID và chưa nằm trong release hiện tại.

## Công nghệ

- Frontend: React 19, Vite, Tailwind CSS, Motion, Recharts và Lucide React.
- Backend: Node.js, Express, TypeScript và Socket.IO.
- Database: PostgreSQL 15, Prisma ORM và PostgreSQL Active Cache.
- Xác thực: JWT, `session_version`, bcryptjs và RBAC.
- Production: Docker Compose, Nginx, Cloudflare Tunnel và systemd backup timer.

## Cấu trúc thư mục

```text
.
├── src/                         # Giao diện React và thư viện phía client
├── tests/                       # Regression test API, bảo mật, NLP và anniversary
├── prisma/
│   ├── schema.prisma            # Prisma schema
│   └── migrations/              # Migration có version
├── deploy/                      # Script backup và hướng dẫn restore
├── docs/
│   ├── handoffs/production/     # Handoff production đang dùng
│   └── archive/                 # Tài liệu lịch sử, không dùng làm nguồn sự thật hiện tại
├── public/                      # Static asset và service worker
├── server.ts                    # Express API, Socket.IO và scheduler
├── Dockerfile                   # Image production
├── docker-compose.yml           # PostgreSQL phục vụ local
└── docker-compose.prod.yml      # Compose production khóa theo image digest
```

## Khởi chạy local

### 1. Yêu cầu

- Node.js 20 hoặc phiên bản tương thích.
- Docker Desktop hoặc PostgreSQL 15.
- Git.

### 2. Chuẩn bị biến môi trường

```bash
cp .env.example .env
```

Điền các giá trị riêng cho local. Không commit `.env`, mật khẩu, JWT secret hoặc API key.

### 3. Khởi động PostgreSQL

```bash
docker compose up -d postgres
```

### 4. Cài dependency và chạy migration

```bash
npm ci
npx prisma migrate deploy
```

Không dùng `prisma db push` cho production. Mọi thay đổi schema phải có migration được review.

### 5. Chạy ứng dụng

```bash
npm run dev
```

Port thực tế lấy từ `.env`. Kiểm tra health tại:

```text
http://127.0.0.1:<PORT>/healthz
```

## Kiểm tra chất lượng

Trước khi commit hoặc tạo release:

```bash
git diff --check
npm run lint
npm test
npm run build
npm audit --omit=dev
```

Release gần nhất đã đạt 39/39 test, build thành công và audit 0 vulnerability.

## Nguyên tắc triển khai production

1. Không build source trực tiếp trên server.
2. Không dùng tag `latest`.
3. Build image `linux/amd64`, ghi commit SHA và lấy immutable digest.
4. Backup production và restore rehearsal trước cutover.
5. Chạy `prisma migrate deploy` bằng one-shot container trước khi start app mới.
6. `chat_uploads` phải có persistent mount và phải nằm trong backup.
7. Chỉ bind app/PostgreSQL về localhost; public traffic đi qua proxy đã cấu hình.
8. Giữ database/image rollback cho đến khi người dùng duyệt xóa.
9. Sau smoke test phải xóa toàn bộ dữ liệu QA.

Không tự chạy `docker compose up`, migration, restore hoặc thao tác database trên production khi người dùng mới chỉ yêu cầu kiểm tra.

## Backup và rollback

Tài liệu restore hiện hành:

```text
deploy/RESTORE_PRODUCTION.md
```

Script backup nguồn:

```text
deploy/studio-v2-production-backup
```

Database rollback của cutover Chat Native hiện được giữ dưới tên:

```text
studio_db_pre_chat_20260714
```

Không xóa database hoặc backup rollback trước khi Gate 3 được duyệt riêng.

## Quy ước GitHub

- `main`: nguồn sự thật ổn định sau khi release được review và hợp nhất.
- `release-candidate/*`: nhánh chuẩn bị release/cutover.
- `codex/*`: nhánh thay đổi do Codex thực hiện để review trước khi hợp nhất.
- Commit message viết bằng tiếng Việt có dấu và theo Conventional Commits khi phù hợp.
- Chú thích mới trong source viết bằng tiếng Việt có dấu, ngắn gọn và giải thích lý do thay vì nhắc lại code.
- Không đưa log, backup runtime, model sinh tự động hoặc secret lên Git.

## Tài liệu

- Bản tổng quan dễ đọc: `docs/handoffs/production/BEAUTIFUL_STUDIO_V2_FULL_HANDOFF_2026-07-14.md`
- Toàn cảnh production: `docs/handoffs/production/00_READ_FIRST_STUDIO_V2_FULL_HANDOFF_2026-07-14.md`
- Handoff Chat Native: `docs/handoffs/production/HANDOFF_CHAT_NATIVE_LOCAL_2026-07-13.md`
- Kế hoạch cutover: `docs/handoffs/production/PLAN_PRODUCTION_CHAT_CUTOVER_2026-07-14.md`
- Tài liệu cũ: `docs/archive/`
