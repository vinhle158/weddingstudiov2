# BÁO CÁO TOÀN CẢNH & HANDOFF PRODUCTION (STUDIO V2)

> **ĐỌC FILE NÀY TRƯỚC KHI THAO TÁC TRÊN SERVER.**
>
> * **Cập nhật lần cuối:** 2026-07-14 (Múi giờ UTC+7)
> * **Nội dung:** Tổng hợp toàn bộ phiên nâng cấp Chat Native, hardening, rehearsal và cutover production.

---

## 1. Tóm tắt điều hành

Hệ thống **STUDIO V2** đã được nâng cấp thành công từ chat nội bộ cơ bản sang **Chat Native** tích hợp trực tiếp trong ứng dụng web quản trị. Phương án sử dụng ứng dụng chat độc lập (như Mattermost/Rocket.Chat) đã bị loại bỏ nhằm tránh việc nhân viên phải đăng nhập hai lần, giảm độ phức tạp vận hành và triệt tiêu nợ kỹ thuật không đáng có.

Hệ thống Production hiện tại đã hoàn thành cutover với các thông tin chi tiết sau:

| Thông số | Giá trị | Ghi chú |
| :--- | :--- | :--- |
| **Public URL** | `https://thewill.io.vn` | Domain chính thức của ứng dụng |
| **Production Host** | `will@192.168.1.34` | Địa chỉ IP máy chủ Production |
| **Trạng thái App (Health)** | `OK` | Đã kiểm tra qua endpoint `/healthz` |
| **App Container** | `studiov2_app` | Container chạy ứng dụng chính |
| **PostgreSQL Container** | `studiov2_postgres_prod` | Container cơ sở dữ liệu production |
| **Image Release (Pin Digest)** | `vinhle158/studiov2-app@sha256:a1bf06d9de933937e739cd63f0570e54fbec84c11ee4203b0e6da5114bfe8bf5` | Image bất biến (immutable) |
| **Production Database** | `studio_db` | Cơ sở dữ liệu đang hoạt động |
| **Rollback Database** | `studio_db_pre_chat_20260714` | Bản lưu trữ dự phòng trước nâng cấp |
| **Tài khoản mặc định** | Chỉ giữ lại duy nhất admin `viet@studio.com` | Các tài khoản kiểm thử khác đã bị xoá cứng |

> ⚠️ **CẢNH BÁO:** Mật khẩu ứng dụng đã được xoay (rotate) trong quá trình cutover. **Tuyệt đối không ghi mật khẩu** trong tài liệu này, trong Git hoặc trong thư mục release. Mật khẩu SSH của server không thay đổi trong phiên này.

---

## 2. Nguồn sự thật & Phạm vi Workspace

### Thư mục Git chuẩn (Duy nhất để đọc và chỉnh sửa)
* **Đường dẫn chuẩn:** `/Users/mac/Documents/STUDIO_V2_GITHUB_MAIN`
* **Lưu ý:** Không chỉnh sửa source code tại thư mục cũ `/Users/mac/Documents/STUDIO V2` (Thư mục có khoảng trắng chỉ dùng làm ngữ cảnh lịch sử).

### Trạng thái Git hiện tại
* **Remote Repository:** `git@github.com:vinhle158/weddingstudiov2.git`
* **Branch hoạt động:** `release-candidate/studio-v2-hardening-crm-2026-07-11`
* **Handoff Commit:** `7491d41d13c7f5112cd5d3078c119037f7abb8ba`
* **Release Source Commit:** `96048be106b0f0afc497d88a5c42c485d69a7313`
* **Compose Hardening Commit:** `b05f361`

> 📝 **LƯU Ý:** Tại thời điểm đóng phiên, worktree hoàn toàn sạch sẽ, local branch và remote branch trùng khớp commit. Chưa bật cơ chế GitHub branch protection từ xa để khóa cứng push nhầm, do đó **không được phép sửa trực tiếp source hoặc build nóng trên production**. Mọi thay đổi phải đi qua branch/release mới.

---

## 3. Quyết định kiến trúc hệ thống

### ❌ Hướng giải pháp đã loại bỏ
Không sử dụng Mattermost, Rocket.Chat hoặc các giải pháp chat độc lập bên ngoài vì:
1. **Trải nghiệm người dùng kém:** Nhân viên bắt buộc phải đăng nhập thêm một tài khoản/ứng dụng khác.
2. **Phức tạp về tích hợp:** Cần xây dựng SSO hoặc token bridge riêng.
3. **Phình to hạ tầng:** Tăng số lượng service, database, quy trình backup và gia tăng điểm lỗi (Single Point of Failure).
4. **Khó debug:** Khó truy vết luồng dữ liệu khi hệ thống gặp lỗi.
5. **Không cần thiết:** Nhu cầu hiện tại chỉ dừng lại ở việc nhân viên nội bộ trao đổi với nhau trực tiếp trên hệ thống quản trị CRM.

###  Hướng giải pháp đã lựa chọn
Giữ **Chat Native** trực tiếp trong core **STUDIO V2** và nâng cấp đồng bộ theo stack hiện tại:
* **REST API:** Làm fallback và tải lịch sử tin nhắn.
* **Socket.IO:** Phục vụ luồng truyền thông thời gian thực (realtime).
* **PostgreSQL:** Lưu trữ dữ liệu tin nhắn tập trung.
* **JWT/Session:** Sử dụng chung cơ chế xác thực hiện hành, không yêu cầu đăng nhập lại khi vào mục chat.
* **Persistent Bind Mount:** Dùng để lưu trữ hình ảnh tải lên, tránh mất mát khi container bị khởi động lại.

---

## 4. Chức năng Chat Native đã hoàn thành

Hệ thống Chat Native đã được triển khai đầy đủ các tính năng sau:

* [x] **Kênh chung:** Kênh chat toàn Studio dành cho tất cả nhân viên.
* [x] **Tin nhắn trực tiếp (DM):** Trò chuyện riêng tư dựa theo quyền truy cập được phân cấp.
* [x] **Realtime:** Tích hợp Socket.IO xác thực bằng JWT bảo mật.
* [x] **Read State:** Đánh dấu trạng thái đã đọc và đếm số tin nhắn chưa đọc (unread count) cho cả kênh chung và DM.
* [x] **Mention:** Hỗ trợ tag nhân viên bằng `@mention`.
* [x] **Đính kèm hình ảnh:** Cho phép gửi ảnh dạng PNG, JPEG, WebP với dung lượng tối đa 5 MB.
* [x] **Bảo mật file đính kèm:** Ảnh chỉ có thể tải xuống thông qua endpoint có xác thực và kiểm tra quyền hội thoại.
* [x] **Chụp màn hình:** Nút chức năng chụp và gửi ảnh nhanh màn hình làm việc.
* [x] **Tham chiếu nghiệp vụ:**
  * Liên kết tin nhắn trực tiếp tới các **Task (công việc)**.
  * Liên kết tin nhắn trực tiếp tới **Khách hàng (Customer)**.
  * Tìm kiếm nhanh task liên quan theo Tiêu đề, ID hoặc mã đơn hàng.
* [x] **Giao diện đa thiết bị:**
  * **Desktop:** Thiết kế layout 2 cột rõ ràng, trực quan.
  * **Mobile:** Thiết kế giao diện tách biệt màn hình danh sách hội thoại và màn hình chat chi tiết; composer (khung nhập liệu) bám sát đáy màn hình; độc lập vùng cuộn tin nhắn; cỡ chữ input đặt ở **16px** để tránh lỗi tự động phóng to (auto-zoom) trên iOS.
* [x] **Thông báo trình duyệt:**
  * Dashboard trên di động tích hợp thẻ bật thông báo trình duyệt và badge hiển thị số tin nhắn chưa đọc.
  * Đăng ký Service Worker `notification-sw.js` trên public domain.

> 📝 **LƯU Ý:** **Giới hạn hiện tại:** Việc gửi thông báo khi người dùng tắt hoàn toàn trình duyệt yêu cầu giải pháp Web Push/VAPID chuyên sâu. Hiện tại thông báo chỉ hoạt động khi trình duyệt hoặc tab ứng dụng đang mở.

---

## 5. Nhắc sinh nhật và Kỷ niệm (Anniversary Reminder)

Tính năng nhắc ngày kỷ niệm đã được rà soát tỉ mỉ và nâng cấp ổn định (hardening):
* Lưu trữ thông tin ngày sinh nhật (`birthday`), ngày cưới (`wedding_date`) và link Facebook (`facebook_url`) trên hồ sơ khách hàng.
* Cấu hình số ngày nhắc trước (`anniversary_reminder_days`) chỉ nhận số nguyên từ `1` đến `30` ngày (mặc định là `7` ngày).
* Scheduler tự khởi chạy ngay khi ứng dụng khởi động và lặp lại sau mỗi **12 giờ**.
* Luôn sử dụng múi giờ Việt Nam (UTC+7) để quét ngày kỷ niệm chính xác.
* **Chống trùng lặp:** Không tạo thông báo trùng lặp cho cùng một khách hàng trong cùng một năm.
* Xử lý chính xác sự kiện chuyển giao năm mới khi quét ngày ở thời điểm cuối năm.
* Hỗ trợ năm nhuận: Người sinh ngày **29/02** sẽ được nhắc vào ngày **28/02** ở những năm không nhuận.
* Các thông báo nhắc nhở đính kèm nút điều hướng nhanh tới luồng tạo công việc (task) chăm sóc khách hàng.

> 💡 **Mẹo:** Quá trình Rehearsal và Smoke Test trên Production đã xác nhận các thông báo được tạo chính xác một lần duy nhất và không bị lặp lại sau khi khởi động lại ứng dụng.

---

## 6. Hardening kỹ thuật đã hoàn thành

Các biện pháp tối ưu hóa bảo mật và độ ổn định hệ thống đã được triển khai:

1. **Sửa lỗi Proxy:** Cập nhật biến môi trường `TRUST_PROXY=loopback, linklocal, uniquelocal` và thêm kiểm thử regression test bảo vệ code.
2. **Loại bỏ Thư viện Thừa:** Gỡ hoàn toàn thư viện `node-nlp` và `xlsx` có cảnh báo bảo mật nghiêm trọng; thay bằng bộ intent classifier tiếng Việt tự viết hiệu quả.
3. **Quét lỗi bảo mật:** Lệnh `npm audit --omit=dev` trả về **0 lỗ hổng** tại release gate.
4. **Tối ưu Frontend:** Tách frontend bundle giúp triệt tiêu cảnh báo chunk vượt quá 500 kB.
5. **Chuẩn hóa Khởi động Docker:** Dockerfile không tự động chạy lệnh `prisma db push` khi start.
6. **Quản lý Migration:**
   * Tạo file di chuyển dữ liệu chuẩn ban đầu tại: `prisma/migrations/20260714000000_initial_production/`.
   * Lệnh migration được cấu hình chạy one-shot trước khi chạy ứng dụng chính.
7. **Đóng gói Image:** Docker Image được build chuẩn hoá cho kiến trúc `linux/amd64` và được định danh chính xác bằng mã digest không đổi.
8. **An toàn Production:** Docker Compose trên server cấu hình không build source tại chỗ, chỉ kéo image đã đóng gói sẵn; các cổng kết nối (Ports) của App và Postgres chỉ map về địa chỉ local (`127.0.0.1`), không mở trực tiếp ra internet.
9. **Kiểm tra trạng thái dịch vụ:** Cấu hình PostgreSQL Healthcheck trong docker-compose.
10. **Bảo mật thông tin:** Dọn sạch toàn bộ secret và thông tin tài khoản test cũ khỏi cây thư mục source code; thực hiện xoay vòng mật khẩu admin.

---

## 7. Kết quả Quality Gate

### 🟢 Local Release Gate (Đạt 100%)
* [x] `git diff --check`: Đạt (Không có khoảng trắng thừa cuối dòng).
* [x] `npm run lint`: Đạt (Không lỗi linter).
* [x] `npm test`: Đạt **39/39** test cases.
* [x] `npm run build`: Đạt (Build frontend & backend thành công).
* [x] `npm audit --omit=dev`: Đạt (0 lỗ hổng bảo mật).
* [x] Kiểm tra schema drift với DB tạm: Đạt.
* [x] Khởi tạo Docker Compose cục bộ: Đạt.

### 🟢 Rehearsal trên Production Host (Đạt 100%)
Quá trình diễn tập (rehearsal) được thực hiện độc lập trên host bằng database và container phụ nhằm không gây ảnh hưởng đến production hiện hữu:
* [x] Giải mã GPG và khôi phục thành công bản dump PostgreSQL vào DB diễn tập.
* [x] Chạy migration trên database sạch: Thành công.
* [x] Import dữ liệu phân quyền (4 role) và tài khoản admin duy nhất: Thành công.
* [x] Xác thực kết nối Socket.IO và gửi file đính kèm: Hoạt động trơn tru.
* [x] Khởi động lại container và kiểm tra tính toàn vẹn của dữ liệu file đính kèm: Đạt.
* [x] Quét reminder anniversary: Hoạt động đúng tần suất, không trùng lặp.
* [x] Dọn dẹp sạch sẽ môi trường diễn tập sau khi hoàn tất.

### 🟢 Smoke Test sau Cutover Production (Đạt 100%)
Sử dụng các tài khoản và dữ liệu kiểm thử tạm thời, sau đó xoá sạch:
* [x] Xác thực Login và kiểm tra API `/api/auth/me`.
* [x] Gửi tin nhắn kênh chung và DM.
* [x] Hiển thị danh bạ và tag tên người dùng.
* [x] Đếm số tin nhắn chưa đọc realtime.
* [x] Đính kèm link Task và Customer.
* [x] Lưu trữ file đính kèm bền vững qua các lần restart.
* [x] Truy cập WebSocket thông qua HTTPS đứng sau Nginx và Cloudflare.
* [x] Hiển thị responsive tốt trên Desktop & Mobile (Viewport 390×844).

> 📝 **LƯU Ý:** Trong quá trình test, trình duyệt có ghi nhận một lỗi console khi cố thử phục hồi token cũ trước khi xoay mật khẩu. Trình duyệt sau đó tự động chuyển hướng về trang login và đăng nhập bằng mật khẩu mới thành công. Đây là cơ chế bảo mật tự động vô hiệu hoá token cũ, không phải lỗi hệ thống.

---

## 8. Trạng thái Production hiện tại

### Hạ tầng Container & Mạng

```yaml
App Container: studiov2_app
Database Container: studiov2_postgres_prod
Docker Network: studio-v2_default
Port Binding: 127.0.0.1:3005 -> 3005/tcp
PostgreSQL Image: postgres:15-alpine
Restart Policy: always
```

### Thư mục dữ liệu bền vững (Persistent Uploads)
* **Đường dẫn trên Host:** `/home/will/studio-v2/data/chat_uploads`
* **Đường dẫn trong Container:** `/app/chat_uploads`

### Cơ sở dữ liệu hoạt động chính (`studio_db`)
* **Số lượng User:** 1 (Admin `viet@studio.com`)
* **Số lượng Role:** 4
* **Số lượng ChatMessage:** 0 (Đã dọn dẹp dữ liệu test)
* **Số lượng Customer:** 0
* **Trạng thái Prisma Migration:** Đã hoàn tất hoàn toàn.

> 📝 **LƯU Ý:** Bảng `ChatReadState` sẽ tự động tạo bản ghi khi admin truy cập kênh chat lần đầu để lưu trạng thái đọc tin nhắn. Đây là hành vi nghiệp vụ bình thường, không cần xoá bảng này khi ứng dụng đang chạy.

### Cơ sở dữ liệu lưu trữ dự phòng (`studio_db_pre_chat_20260714`)
* **Số lượng User:** 4
* **Số lượng ChatMessage:** 19
* **Số lượng Customer:** 0

> ❗ **QUAN TRỌNG:** **Tuyệt đối không xoá, đổi tên hoặc chạy migration trên database dự phòng này** trước khi được phê duyệt Gate 3.

---

## 9. Quy trình Backup & Restore

### Cơ chế tự động với Systemd
* **Systemd Service:** `studio-v2-postgres-backup.service`
* **Systemd Timer:** `studio-v2-postgres-backup.timer` (Đang hoạt động và lặp lại)
* **Script sao lưu:** `/usr/local/sbin/studio-v2-postgres-backup` (Bản sao chuẩn đặt tại `/usr/local/sbin/studio-v2-production-backup`)
* **Trạng thái kiểm tra cuối:** `Result=success`, `ExecMainStatus=0` (Hoạt động hoàn hảo).

### Thành phần bản sao lưu
Mỗi phiên bản backup bao gồm:
1. Bản dump cơ sở dữ liệu PostgreSQL (Mã hoá bằng GPG).
2. Tệp nén `.tar` lưu trữ toàn bộ file đính kèm `chat_uploads` (Mã hoá bằng GPG).
3. Tệp chữ ký số SHA-256 tương ứng để xác minh tính toàn vẹn.
4. Tự động đồng bộ lên Google Drive qua rclone (`gdrive:StudioV2-Backups/PostgreSQL`).

* **Thư mục lưu trữ local:** `/var/backups/studio-v2/production`
* **Thư mục lưu trữ rollback (không bị xoá tự động):** `/var/backups/studio-v2/rollback-pre-chat-20260714`

---

## 10. Rollback & Quy trình phê duyệt Gate 3

Để đảm bảo an toàn tối đa cho hệ thống, cơ sở dữ liệu cũ và Docker Image cũ vẫn được lưu trữ tại máy chủ Production phục vụ trường hợp khẩn cấp.

* **Docker Image Rollback:** `studiov2-app:rollback-pre-chat-20260714`

> ⚠️ **CẢNH BÁO VỀ QUY TẮC PHÊ DUYỆT GATE 3:**
> * Giữ nguyên database `studio_db_pre_chat_20260714` ít nhất đến hết ngày **2026-07-21**.
> * Giữ bản sao lưu rollback tạm trong cùng thời gian này.
> * Chỉ thực hiện xoá bỏ các tài nguyên rollback khi có sự phê duyệt trực tiếp bằng văn bản/chỉ thị của người dùng.
> * Việc yêu cầu chỉnh sửa/phát triển tính năng mới **không đồng nghĩa** với việc được phép xoá dữ liệu rollback.
> * Nếu cần thực hiện rollback, phải dừng mọi tiến trình và lập kế hoạch chi tiết trước khi chạy lệnh.

---

## 11. Danh mục các file quan trọng

### Trong Repository chuẩn (`STUDIO_V2_GITHUB_MAIN`)
* [HANDOFF_CHAT_NATIVE_LOCAL_2026-07-13.md](file:///Users/mac/Documents/STUDIO_V2_GITHUB_MAIN/HANDOFF_CHAT_NATIVE_LOCAL_2026-07-13.md)
* [PLAN_PRODUCTION_CHAT_CUTOVER_2026-07-14.md](file:///Users/mac/Documents/STUDIO_V2_GITHUB_MAIN/PLAN_PRODUCTION_CHAT_CUTOVER_2026-07-14.md)
* [00_READ_FIRST_STUDIO_V2_FULL_HANDOFF_2026-07-14.md](file:///Users/mac/Documents/STUDIO_V2_GITHUB_MAIN/00_READ_FIRST_STUDIO_V2_FULL_HANDOFF_2026-07-14.md)
* [Dockerfile](file:///Users/mac/Documents/STUDIO_V2_GITHUB_MAIN/Dockerfile)
* [docker-compose.prod.yml](file:///Users/mac/Documents/STUDIO_V2_GITHUB_MAIN/docker-compose.prod.yml)
* [deploy/studio-v2-production-backup](file:///Users/mac/Documents/STUDIO_V2_GITHUB_MAIN/deploy/studio-v2-production-backup)
* [deploy/RESTORE_PRODUCTION.md](file:///Users/mac/Documents/STUDIO_V2_GITHUB_MAIN/deploy/RESTORE_PRODUCTION.md)
* [prisma/migrations/20260714000000_initial_production/migration.sql](file:///Users/mac/Documents/STUDIO_V2_GITHUB_MAIN/prisma/migrations/20260714000000_initial_production/migration.sql)

### Trên máy chủ Production (`192.168.1.34`)
* `/home/will/studio-v2/docker-compose.prod.yml`
* `/home/will/studio-v2/data/chat_uploads`
* `/home/will/studio-v2/releases/96048be`
* `/home/will/studio-v2/agent-handoffs`

---

## 12. Checklist Read-only dành cho Phiên làm việc mới

Khi tiếp quản hệ thống ở phiên làm việc mới, Agent nên bắt đầu bằng các bước kiểm tra không làm thay đổi trạng thái hệ thống:

```bash
# 1. Truy cập máy chủ kiểm tra lịch sử handoff
ssh will@192.168.1.34
cd /home/will/studio-v2/agent-handoffs
sed -n '1,260p' 00_READ_FIRST_STUDIO_V2_FULL_HANDOFF_2026-07-14.md

# 2. Kiểm tra sức khỏe dịch vụ và trạng thái các container
curl -fsS https://thewill.io.vn/healthz
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
docker inspect studiov2_app --format '{{.Config.Image}}|{{.State.Status}}'
systemctl is-active studio-v2-postgres-backup.timer

# 3. Kiểm tra trạng thái mã nguồn local
cd /Users/mac/Documents/STUDIO_V2_GITHUB_MAIN
git status --short --branch
git rev-parse HEAD
git diff --check
```

> ⚠️ **CẤM TỰ Ý CHẠY CÁC LỆNH SAU KHI CHƯA CÓ YÊU CẦU CỤ THỂ:**
> * `docker compose up`, `docker rm`, `docker system prune` (Tránh gây gián đoạn dịch vụ).
> * `prisma db push` (Có thể làm hỏng cấu trúc DB production).
> * `DROP DATABASE`, `ALTER DATABASE`, `TRUNCATE` (Gây mất mát dữ liệu).
> * Khôi phục bản backup đè lên dữ liệu đang chạy.
> * Xóa bỏ bất kỳ database, image hoặc backup rollback nào.
> * Tự ý commit, push hoặc deploy lên production khi chỉ có yêu cầu thảo luận/kiểm tra.

---

## 13. Quy tắc bắt buộc cho các phiên tiếp theo

1. **Đọc tài liệu trước:** Luôn luôn đọc kỹ file handoff này trước khi thực hiện bất kỳ hành động nào.
2. **Xác thực IP máy chủ:** Đảm bảo địa chỉ IP production đang kết nối chính xác là `192.168.1.34`.
3. **Mặc định Read-only:** Luôn truy cập SSH ở chế độ chỉ đọc nếu không có yêu cầu cài đặt/cập nhật trực tiếp.
4. **Bảo mật thông tin nhạy cảm:** Tuyệt đối không in biến môi trường, JWT secret, mật khẩu hash, passphrase lên terminal hoặc lưu trong log handoff.
5. **Không build nóng:** Không thực hiện build mã nguồn trực tiếp trên máy chủ Production.
6. **Quy trình release chuẩn:** Mọi release mới bắt buộc phải có commit sạch, đã test local, build Docker image AMD64 và pin chính xác digest.
7. **Migration an sau:** Migration database phải được chạy độc lập, có sao lưu dữ liệu trước và được rehearsal kỹ càng.
8. **Bảo toàn dữ liệu chat:** Thư mục ảnh chat phải luôn được ánh xạ mount bền vững và được đưa vào lịch trình backup tự động.
9. **Dọn dẹp môi trường:** Dọn sạch toàn bộ dữ liệu QA ngay sau khi kết thúc quá trình test. Trạng thái read-state của admin là hợp lệ, không xoá.
10. **Không tự ý xoá rollback:** Tuyệt đối giữ nguyên dữ liệu phục hồi cho tới khi vượt qua mốc thời gian quy định tại Gate 3.

---

## 14. Danh sách các việc cần làm tiếp theo (Backlog)

Các hạng mục cải tiến hệ thống (không phải là lỗi chặn release hiện tại):
* [ ] Nghiên cứu và cấu hình **Web Push/VAPID** để phục vụ gửi thông báo realtime ngay cả khi người dùng tắt trình duyệt hoàn toàn.
* [ ] Thiết lập thẻ Git release tag chính thức và kích hoạt cấu hình **GitHub branch protection** để đóng băng nhánh code chính.
* [ ] Viết script quét và dọn dẹp các tệp tin mồ côi (orphan files) trong thư mục `chat_uploads` phát sinh khi người dùng tải ảnh lên nhưng không gửi tin nhắn.
* [ ] Mở rộng tính năng chat: Trả lời tin nhắn (reply), bày tỏ cảm xúc (reaction), tìm kiếm lịch sử chat, chat nhóm (group channels).
* [ ] Tách biệt cấu trúc: Tách module Chat ra khỏi file `server.ts` nếu quy mô chat phình to để dễ quản lý.
* [ ] Thực hiện đánh giá độ ổn định hệ thống sau ngày **2026-07-21** để xin phê duyệt đóng Gate 3.

---

## 15. Kết luận bàn giao

Hệ thống Production đang vận hành hoàn toàn ổn định. Mã nguồn đã được đóng băng vận hành an toàn. Dữ liệu khách hàng thực tế sạch sẽ, hệ thống backup hoạt động đúng lịch trình và các phương án rollback được bảo toàn nghiêm ngặt.

Agent ở phiên tiếp theo có thể bắt đầu làm việc ngay bằng cách xác minh trạng thái read-only và đối chiếu mã hash commit/image digest. Chỉ triển khai các tính năng mới khi có chỉ thị rõ ràng từ người dùng.
