# STUDIO V2 — Báo cáo toàn cảnh và handoff production

> **ĐỌC FILE NÀY TRƯỚC KHI THAO TÁC TRÊN SERVER.**
>
> Cập nhật lần cuối: 2026-07-14, múi giờ UTC+7.
> Đây là bản handoff tổng hợp của toàn bộ phiên nâng cấp Chat Native, hardening, rehearsal và cutover production.

## 1. Tóm tắt điều hành

STUDIO V2 đã được nâng cấp từ chat nội bộ cơ bản sang Chat Native tích hợp trực tiếp trong web quản trị. Hướng dùng một ứng dụng chat độc lập đã được loại bỏ vì gây đăng nhập hai lần, tăng độ phức tạp vận hành và tạo nợ kỹ thuật khó xử lý khi có sự cố.

Production hiện đã cutover thành công sang release mới:

- Public URL: `https://thewill.io.vn`
- Production host: `will@192.168.1.34`
- App health: `OK`
- App container: `studiov2_app`
- PostgreSQL container: `studiov2_postgres_prod`
- Image release bất biến: `vinhle158/studiov2-app@sha256:a1bf06d9de933937e739cd63f0570e54fbec84c11ee4203b0e6da5114bfe8bf5`
- Production database hiện tại: `studio_db`
- Database rollback: `studio_db_pre_chat_20260714`
- Chỉ tài khoản quản trị `viet@studio.com` được giữ lại.
- Mật khẩu ứng dụng đã được xoay trong cutover. Không ghi mật khẩu trong file này, Git hoặc thư mục release.
- Mật khẩu SSH không được thay đổi trong phiên này.

## 2. Nguồn sự thật và phạm vi workspace

### Repo chuẩn duy nhất để đọc và chỉnh sửa

```text
/Users/mac/Documents/STUDIO_V2_GITHUB_MAIN
```

Không chỉnh source tại:

```text
/Users/mac/Documents/STUDIO V2
```

Thư mục có dấu cách phía trên là workspace/container cũ, chỉ dùng làm ngữ cảnh lịch sử.

### Git hiện tại

```text
Remote: git@github.com:vinhle158/weddingstudiov2.git
Branch: release-candidate/studio-v2-hardening-crm-2026-07-11
Handoff commit: 7491d41d13c7f5112cd5d3078c119037f7abb8ba
Release source commit: 96048be106b0f0afc497d88a5c42c485d69a7313
Compose hardening commit: b05f361
```

Tại thời điểm đóng phiên:

- Worktree sạch.
- Local branch và remote branch cùng commit.
- Không có release tag tại commit hiện tại.
- Chưa xác minh được GitHub branch protection từ máy local.
- Code được xem là đóng băng về mặt vận hành, nhưng chưa có cơ chế GitHub khóa cứng việc push nhầm.

Mọi thay đổi mới phải đi qua branch/release mới; không sửa trực tiếp source hoặc build nóng trên production.

## 3. Quyết định kiến trúc trong phiên

### Hướng đã loại bỏ

Không dùng Mattermost, Rocket.Chat hoặc một ứng dụng chat độc lập gọi API từ web quản trị cho giai đoạn này vì:

- Nhân viên phải đăng nhập thêm lần nữa.
- Cần SSO hoặc token bridge riêng.
- Tăng số service, database, backup và điểm lỗi.
- Khó truy vết khi hệ thống lỗi.
- Không phù hợp nhu cầu hiện tại: chỉ nhân viên nội bộ chat trong cùng hệ thống quản trị.

### Hướng đã chọn

Giữ Chat Native trong STUDIO V2 và nâng cấp theo stack hiện hữu:

- REST API làm fallback và tải lịch sử.
- Socket.IO cho realtime.
- PostgreSQL làm nguồn dữ liệu.
- JWT/session hiện tại dùng chung; không có bước login chat riêng.
- Ảnh chat lưu trên persistent bind mount, không nằm trong filesystem tạm của container.

## 4. Chức năng Chat Native đã hoàn thành

- Kênh chung toàn Studio.
- Tin nhắn riêng theo quyền truy cập.
- Realtime bằng Socket.IO có xác thực JWT.
- Unread count và read state cho general/DM.
- Tag nhân viên bằng mention.
- Đính kèm ảnh PNG/JPEG/WebP, giới hạn 5 MB.
- Ảnh chỉ tải qua endpoint có auth và kiểm tra quyền hội thoại.
- Nút chụp màn hình/phục vụ gửi ảnh nhanh.
- Gắn tham chiếu đến task/công việc.
- Gắn tham chiếu đến khách hàng.
- Tìm task theo tiêu đề, ID hoặc mã đơn liên quan.
- Layout desktop hai cột rõ ràng.
- Layout mobile theo kiểu ứng dụng nhắn tin: danh sách hội thoại và màn hình conversation tách riêng.
- Composer mobile bám đáy, vùng tin nhắn cuộn độc lập, input 16 px để tránh zoom/lệch layout.
- Dashboard mobile có unread badge và thẻ bật thông báo trình duyệt.
- Service worker `notification-sw.js` được serve trên public domain.

Giới hạn còn lại: thông báo khi trình duyệt đã đóng hoàn toàn cần triển khai Web Push/VAPID. Hiện tại browser notification/service worker phục vụ luồng khi ứng dụng đang hoạt động; không được mô tả là push nền hoàn chỉnh.

## 5. Nhắc sinh nhật và kỷ niệm

Chức năng anniversary đã được rà soát và hardening:

- Lưu `birthday`, `wedding_date`, `facebook_url` trên khách hàng.
- Setting `anniversary_reminder_days` chỉ nhận số nguyên 1–30, mặc định 7.
- Scheduler chạy lần đầu sau khi app start và lặp mỗi 12 giờ.
- Dùng lịch Việt Nam/UTC+7 khi xác định ngày.
- Không tạo notification trùng trong cùng năm.
- Xử lý đúng sự kiện đầu năm khi scan cuối năm.
- Sinh nhật 29/02 được nhắc ngày 28/02 ở năm không nhuận.
- Notification có thể dẫn sang luồng tạo task chăm sóc.

Rehearsal và smoke test production đã xác nhận notification được tạo đúng một lần và không bị nhân đôi sau restart.

## 6. Hardening kỹ thuật đã hoàn thành

- Port fix `TRUST_PROXY` về source chuẩn và thêm regression test.
- Production dùng `TRUST_PROXY=loopback, linklocal, uniquelocal`.
- Gỡ dependency `node-nlp`/`xlsx` có cảnh báo bảo mật; thay bằng intent classifier tiếng Việt xác định.
- `npm audit --omit=dev`: 0 vulnerability tại release gate.
- Tách frontend bundle; không còn warning chunk lớn hơn 500 kB.
- Dockerfile không tự chạy `prisma db push` khi start app.
- Có Prisma initial migration trong `prisma/migrations/20260714000000_initial_production/`.
- Migration được chạy one-shot trước khi start app.
- Docker image được build cho `linux/amd64` và pin theo digest.
- Compose production không build source trên server.
- App và PostgreSQL chỉ publish port về localhost.
- Compose có PostgreSQL healthcheck.
- Secret và mật khẩu test cũ đã được loại khỏi current tree.
- Mật khẩu ứng dụng quản trị đã được xoay; mật khẩu cũ bị từ chối.

## 7. Kết quả quality gate

### Local release gate

- `git diff --check`: đạt.
- `npm run lint`: đạt.
- `npm test`: 39/39 đạt.
- `npm run build`: đạt.
- `npm audit --omit=dev`: 0 vulnerability.
- Prisma migrate deploy/status/diff trên schema tạm: đạt, không có schema drift.
- Docker Compose render: đạt.
- Image architecture/CMD/content guard: đạt.

### Rehearsal trên production host

Rehearsal dùng database, app container, port và thư mục upload riêng; không thay production cũ.

- Restore backup mã hóa vào database phụ: đạt.
- SHA-256, GPG decrypt, `pg_restore --list`: đạt.
- Migration trên database sạch: đạt.
- Import 4 role + duy nhất admin: đạt.
- Login/auth/database status: đạt.
- Socket.IO: đạt.
- Chat và attachment: đạt.
- Ảnh còn sau recreate container: đạt.
- Anniversary tạo đúng một lần: đạt.
- Rehearsal đã được xóa sau khi hoàn tất.

### Smoke test sau cutover

Đã tạo QA user/customer/task/chat/file tạm, kiểm tra và xóa cứng sau khi đạt:

- Public login và `/api/auth/me`.
- General chat và DM.
- Contacts và mentionable users.
- General unread và direct unread.
- Customer reference và task reference.
- Attachment có auth và tồn tại sau restart.
- Public WebSocket qua HTTPS/Nginx/Cloudflare.
- Anniversary notification.
- Desktop dashboard/chat.
- Mobile dashboard/chat tại viewport 390×844.
- Mobile input font 16 px, không tràn ngang, composer bám đáy.

Browser từng ghi một console error khi thử khôi phục token cũ ngay sau password rotation. App tự đưa về màn hình login và đăng nhập mới hoạt động bình thường; đây là token cũ bị vô hiệu hóa, không phải lỗi runtime production đang tiếp diễn.

## 8. Trạng thái production hiện tại

### Containers và network

```text
App container: studiov2_app
Database container: studiov2_postgres_prod
Docker network: studio-v2_default
App port: 127.0.0.1:3005 -> 3005/tcp
PostgreSQL image: postgres:15-alpine
Restart policy app: always
```

### Persistent upload

```text
Host: /home/will/studio-v2/data/chat_uploads
Container: /app/chat_uploads
```

### Database mới

```text
Database: studio_db
User: 1
Role: 4
ChatMessage: 0
Customer: 0
Prisma migration hoàn tất: 1
```

`ChatReadState` có thể tự tạo lại một bản ghi cho admin khi admin mở kênh chung. Đây là trạng thái đọc hợp lệ, không phải dữ liệu QA hoặc tin nhắn. Không truncate bảng này khi app đang chạy chỉ để đạt số 0.

Các bảng nghiệp vụ/chat QA đã được làm sạch sau smoke test. `StudioSettings` nền được giữ lại.

### Database rollback

```text
Database: studio_db_pre_chat_20260714
User: 4
ChatMessage: 19
Customer: 0
```

Không xóa, đổi tên hoặc migrate database rollback trước Gate 3.

## 9. Backup và restore

### Systemd

```text
Service: studio-v2-postgres-backup.service
Timer: studio-v2-postgres-backup.timer
Backup script active path: /usr/local/sbin/studio-v2-postgres-backup
Canonical script copy: /usr/local/sbin/studio-v2-production-backup
```

Timer đang active. Lần chạy xác minh cuối có `Result=success`, `ExecMainStatus=0`.

### Backup hiện tại

Backup mới gồm:

- PostgreSQL custom dump, mã hóa GPG.
- Tar archive của `chat_uploads`, mã hóa GPG.
- SHA-256 cho cả hai file.
- Upload và `rclone check` lên Google Drive.

Thư mục local:

```text
/var/backups/studio-v2/production
```

Backup rollback tách khỏi retention tự động:

```text
/var/backups/studio-v2/rollback-pre-chat-20260714
```

Remote rclone:

```text
gdrive:StudioV2-Backups/PostgreSQL
```

Không đưa passphrase GPG hoặc rclone config vào handoff/Git.

## 10. Rollback và Gate 3

Database cũ và image cũ đã được giữ để rollback nhanh. Rollback không cần restore dump trong tình huống thông thường; encrypted dump là lớp bảo vệ thứ hai.

Image cũ trên server được gắn tag:

```text
studiov2-app:rollback-pre-chat-20260714
```

Gate 3 chưa được duyệt:

- Giữ `studio_db_pre_chat_20260714` tối thiểu đến sau ngày 2026-07-21.
- Giữ backup rollback tạm trong cùng thời gian.
- Chỉ xóa sau khi người dùng phê duyệt riêng.
- Không hiểu một yêu cầu sửa tính năng mới là quyền xóa rollback.

Nếu cần rollback, dừng và lập kế hoạch trước. Không tự chạy lệnh rename/drop database chỉ dựa trên file này.

## 11. Các file quan trọng

### Trong repo chuẩn

```text
HANDOFF_CHAT_NATIVE_LOCAL_2026-07-13.md
PLAN_PRODUCTION_CHAT_CUTOVER_2026-07-14.md
00_READ_FIRST_STUDIO_V2_FULL_HANDOFF_2026-07-14.md
Dockerfile
docker-compose.prod.yml
deploy/studio-v2-production-backup
deploy/RESTORE_PRODUCTION.md
prisma/migrations/20260714000000_initial_production/migration.sql
```

### Trên server

```text
/home/will/studio-v2/docker-compose.prod.yml
/home/will/studio-v2/data/chat_uploads
/home/will/studio-v2/releases/96048be
/home/will/studio-v2/agent-handoffs
```

## 12. Checklist đọc-only cho agent phiên mới

Agent mới nên bắt đầu bằng các kiểm tra không thay đổi trạng thái:

```bash
ssh will@192.168.1.34
cd /home/will/studio-v2/agent-handoffs
sed -n '1,260p' 00_READ_FIRST_STUDIO_V2_FULL_HANDOFF_2026-07-14.md

curl -fsS https://thewill.io.vn/healthz
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
docker inspect studiov2_app --format '{{.Config.Image}}|{{.State.Status}}'
systemctl is-active studio-v2-postgres-backup.timer
```

Để kiểm tra source:

```bash
cd /Users/mac/Documents/STUDIO_V2_GITHUB_MAIN
git status --short --branch
git rev-parse HEAD
git diff --check
```

Không chạy ngay:

- `docker compose up`, `docker rm`, `docker system prune`.
- `prisma db push`.
- `DROP DATABASE`, `ALTER DATABASE`, `TRUNCATE`.
- Restore backup đè lên production.
- Xóa database/image/backup rollback.
- Commit/push/deploy khi người dùng mới chỉ yêu cầu kiểm tra hoặc thảo luận.

## 13. Quy tắc cho các phiên tiếp theo

1. Luôn đọc file này và handoff gốc trước.
2. Xác nhận host production hiện tại vẫn là `192.168.1.34` trước mọi thao tác.
3. Mặc định SSH vào server ở chế độ read-only nếu người dùng chưa yêu cầu triển khai.
4. Không in env, JWT secret, password hash, passphrase hoặc password ra terminal/handoff.
5. Không build source trực tiếp trên production.
6. Release mới phải có commit, test, image AMD64 và immutable digest mới.
7. Migration phải chạy riêng, có backup và rehearsal.
8. Ảnh chat phải luôn có persistent mount và nằm trong backup.
9. Sau QA production phải xóa dữ liệu QA; read state hợp lệ của admin không được nhầm là dữ liệu test.
10. Không xóa rollback trước Gate 3.

## 14. Việc còn lại, không phải blocker hiện tại

- Triển khai Web Push/VAPID nếu cần notification khi trình duyệt đóng hoàn toàn.
- Tạo release tag chính thức và bật GitHub branch protection nếu muốn đóng băng code bằng cơ chế cưỡng chế.
- Quản lý/xóa orphan file trong `chat_uploads` khi attachment bị hủy trước khi gửi.
- Reply, reaction, tìm kiếm lịch sử và custom group channel nếu phạm vi sản phẩm mở rộng.
- Cân nhắc tách module Chat khỏi `server.ts` nếu tiếp tục phát triển lớn.
- Sau 2026-07-21, review ổn định rồi xin phê duyệt Gate 3 riêng.

## 15. Kết luận bàn giao

Production đang hoạt động, code release đã đóng băng về mặt vận hành, dữ liệu khách hàng vẫn trống, chỉ còn một admin, backup database + uploads đang chạy và rollback đã được giữ lại.

Agent phiên sau không cần nghiên cứu lại từ đầu. Hãy bắt đầu bằng xác minh read-only, đối chiếu commit/image/digest và chỉ mở phạm vi mới khi người dùng yêu cầu rõ ràng.
