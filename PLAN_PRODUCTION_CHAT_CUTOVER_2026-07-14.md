# KẾ HOẠCH CUTOVER CHAT NATIVE LÊN PRODUCTION

Ngày lập: **2026-07-14**
Production: **will@192.168.1.34**
Repo chuẩn: `/Users/mac/Documents/STUDIO_V2_GITHUB_MAIN`
Trạng thái tài liệu: **CHỈ LẬP KẾ HOẠCH — CHƯA ĐƯỢC PHÉP THỰC THI CUTOVER**

## 1. Mục tiêu bắt buộc

1. Hợp nhất fix `TRUST_PROXY` đang chạy trên production về source local và có regression test.
2. Tạo persistent storage và backup cho `chat_uploads` trước khi bật ảnh chat.
3. Đưa schema chat mới lên một database sạch, chỉ bảo toàn tài khoản `viet@studio.com`; role là cấu hình hệ thống và được tái tạo/giữ đủ để quản trị viên có thể tạo nhân viên sau này.
4. Bảo toàn và kiểm chứng end-to-end chức năng nhắc sinh nhật/thôi nôi và kỷ niệm cưới của khách hàng.

Ngoài ba mục trên, release phải có version bất biến và rollback đã diễn tập.

## 2. Hiện trạng đã xác minh

- Production app và PostgreSQL healthy; public `/` và `/healthz` trả HTTP 200.
- Production chạy commit nền `2e2e71a25b9463ad6d34feefb6647def1b9e36d6` nhưng có fix `TRUST_PROXY` và test chưa commit trực tiếp trên server.
- Source local chưa có fix `TRUST_PROXY` này.
- Nginx production đã có cấu hình WebSocket Upgrade phù hợp cho Socket.IO.
- PostgreSQL production khoảng 8,2 MB và backup timer đang enabled/active.
- Dữ liệu nghiệp vụ bằng 0. Dữ liệu test còn 4 user, 4 role, 19 chat, 1 notification, StudioSettings và metadata backup.
- `viet@studio.com` đang active, `role_id=role-admin`.
- Container app chưa có `/app/chat_uploads` và chưa mount storage cho ảnh.
- Dockerfile hiện tự chạy `prisma db push` mỗi lần container start; cách này không phù hợp cho production có kiểm soát.
- Nếu bảng User rỗng lúc app start, code hiện tại sẽ tự seed thêm tài khoản Sales. Vì vậy tuyệt đối không start app mới trước khi nhập tài khoản quản trị.
- Production hiện đã có các cột `Customer.birthday`, `Customer.wedding_date`, `Customer.facebook_url`, `StudioSettings.anniversary_reminder_days`; log xác nhận scheduler anniversary khởi chạy.
- Test anniversary hiện mới kiểm tra lưu dữ liệu khách hàng và setting, chưa kiểm tra scheduler tạo notification, chống trùng, chuyển năm hoặc ngày 29/02.

## 3. Nguyên tắc an toàn

- Không chỉnh source trực tiếp trên production.
- Không dùng image `latest`; release dùng tag gắn với commit SHA và lưu image ID.
- Không chạy migration lần đầu trên database production đang hoạt động.
- Không xóa database cũ trong ngày cutover.
- Không ghi password hash, mật khẩu, JWT secret hoặc backup key ra terminal log/handoff.
- Mỗi giai đoạn chỉ được tiếp tục khi checkpoint trước đó đạt.
- Nếu bất kỳ guard nào thất bại, dừng; không “sửa nóng” để đi tiếp.
- PostgreSQL, Nginx và Cloudflare Tunnel không được restart nếu không thật sự cần thiết.

## 4. Kiến trúc cutover được chọn

Sử dụng hướng **database xanh–lam** trên cùng PostgreSQL volume:

1. Dừng app để đóng mọi ghi dữ liệu.
2. Đổi tên database hiện tại từ `studio_db` thành `studio_db_pre_chat_20260714`.
3. Tạo database mới tên `studio_db` cùng owner.
4. Chạy Prisma migration đầy đủ trên database mới.
5. Nhập các role hệ thống và duy nhất user `viet@studio.com` từ file tạm quyền `0600`.
6. Xóa file tạm chứa dữ liệu tài khoản ngay sau khi xác minh import.
7. Khởi động release mới; compose và backup script vẫn trỏ tên chuẩn `studio_db`.

Ưu điểm: database cũ còn nguyên để rollback bằng thao tác đổi tên; không phải chờ restore dump khi sự cố xảy ra.

## 5. Giai đoạn A — Chuẩn bị release tại local

### A1. Hợp nhất TRUST_PROXY

- Port đúng phần `app.set('trust proxy', ...)` từ production về `server.ts` local.
- Port regression test xác nhận `loopback`, `linklocal`, `uniquelocal` được tin cậy và IP public không được tin cậy.
- Xác nhận production compose tiếp tục truyền `TRUST_PROXY=loopback, linklocal, uniquelocal`.
- Không sao chép ngược toàn bộ file từ server; chỉ áp diff đã review để không đè phần Chat Native.

### A2. Chuẩn hóa migration

- Tạo Prisma initial migration đầy đủ cho schema mới trong `prisma/migrations/`.
- Sửa Dockerfile: container chỉ start app; không tự chạy `prisma db push`.
- Migration production được chạy bằng one-shot command có log riêng trước khi start app.
- Tạo guard kiểm tra database đích rỗng trước migration và kiểm tra đúng một admin sau import.

### A3. Persistent storage ảnh

- Dùng bind mount dễ kiểm toán và backup:
  - Host: `/home/will/studio-v2/data/chat_uploads`
  - Container: `/app/chat_uploads`
- Thư mục được tạo trước với owner/quyền tối thiểu cần thiết; kiểm tra ghi/đọc bằng user runtime của container.
- Bổ sung mount vào `docker-compose.server.yml`; không đưa secret từ file production vào Git.
- Mở rộng backup hiện tại để tạo tar ảnh, mã hóa GPG, tạo SHA-256 và upload Google Drive cùng bộ backup database.
- Viết hướng dẫn restore theo cặp: database dump + archive `chat_uploads`.

### A4. Release bất biến

- Review toàn bộ diff và xác nhận chỉ đúng phạm vi Chat Native, TRUST_PROXY, migration, storage và deploy wiring.
- Tạo commit release trên branch hiện tại sau khi người dùng cho phép.
- Build image với tag chứa ngày và short SHA; ghi lại image digest.
- Không push, không deploy và không thay production ở giai đoạn A nếu chưa có lệnh riêng.

### A5. Hoàn thiện bảo vệ chức năng nhắc ngày sinh/kỷ niệm

- Giữ các trường `birthday`, `wedding_date`, `facebook_url` khi tạo/sửa khách hàng và khi tạo đơn hàng có khách hàng.
- Giữ setting `anniversary_reminder_days`, mặc định 7 ngày; backend phải validate trong khoảng 1–30 thay vì chỉ dựa vào giới hạn UI.
- Tách hoặc mở điểm gọi scheduler để test bằng ngày giờ cố định, không phụ thuộc clock thật.
- Bổ sung regression test cho:
  - Sinh nhật trong khoảng nhắc tạo đúng một notification.
  - Kỷ niệm cưới trong khoảng nhắc tạo đúng một notification và đúng số năm.
  - Chạy scheduler lặp lại không tạo notification trùng trong cùng năm.
  - Ngoài khoảng nhắc không tạo notification.
  - Mốc cuối năm vẫn nhắc được sự kiện đầu tháng 1 năm sau.
  - Sinh nhật 29/02 được quy ước nhắc ngày 28/02 trong năm không nhuận.
  - Notification có thể mở luồng tạo tác vụ chăm sóc và đánh dấu đã đọc.
- Browser QA cả desktop/mobile: nhập ngày, xem thông báo, mở chi tiết và tạo task chăm sóc.

### Checkpoint A

Phải đạt toàn bộ:

- `git diff --check`
- `npm run lint`
- `npm test`
- `npm run build`
- Test TRUST_PROXY đạt.
- Test schema mới trên database rỗng đạt.
- Toàn bộ regression test sinh nhật/kỷ niệm đạt, bao gồm chống trùng, chuyển năm và 29/02.
- Local browser QA: đăng nhập, general chat, DM, unread, ảnh, tag, task/customer reference, mobile keyboard.
- Local browser QA: tạo khách hàng có ngày sinh/kỷ niệm, nhận notification và mở form task chăm sóc.
- Không có secret trong diff hoặc image history.

## 6. Giai đoạn B — Diễn tập trên server, không ảnh hưởng production

1. Kích hoạt một backup production thủ công theo flow GPG hiện có.
2. Xác minh SHA-256, upload Google Drive và thử restore vào database rehearsal.
3. Tạo database rehearsal riêng; không đổi tên hoặc sửa `studio_db`.
4. Chạy migration mới trên rehearsal.
5. Import role hệ thống và chỉ `viet@studio.com`; không in password hash ra output.
6. Chạy container release tạm trên `127.0.0.1:3006`, dùng database và thư mục upload rehearsal riêng.
7. Kiểm tra login bằng mật khẩu hiện hữu, health, Socket.IO, gửi ảnh, unread và quyền truy cập.
8. Tạo khách hàng rehearsal có sinh nhật và ngày cưới nằm trong cửa sổ nhắc; xác nhận scheduler tạo notification đúng một lần và mở được luồng tạo task.
9. Recreate container rehearsal để chứng minh ảnh vẫn tồn tại qua vòng đời container và anniversary notification không bị tạo trùng sau restart.
10. Xác nhận database rehearsal cuối cùng có đúng một User và user đó là admin sau khi dọn dữ liệu QA.

### Checkpoint B

- Backup restore được.
- Migration không có cảnh báo mất dữ liệu ngoài dự kiến.
- Admin đăng nhập được bằng mật khẩu cũ.
- Upload tồn tại sau recreate container.
- Nhắc sinh nhật/kỷ niệm hoạt động đúng và không tạo trùng sau restart.
- App rehearsal không có lỗi Prisma, auth, rate-limit hoặc WebSocket.

Nếu Checkpoint B không đạt: xóa rehearsal sau khi thu log, sửa tại local và diễn tập lại; không chạm production.

## 7. Giai đoạn C — Cutover production có maintenance window

Thời gian dự kiến: **15–30 phút**, chỉ bắt đầu khi người dùng ra lệnh triển khai production rõ ràng.

1. Chụp baseline: container/image ID, compose checksum, schema, row count và health.
2. Tạm dừng backup timer để tránh chạy giữa cutover.
3. Chạy backup cuối; xác minh checksum, Google Drive và giữ thêm một bản rollback không nằm trong vòng retention tự động.
4. Lưu bản sao quyền hạn chế của compose, Nginx và cấu hình deploy; không sao chép secret vào handoff.
5. Tag image đang chạy thành rollback tag.
6. Dừng riêng `studiov2_app`; giữ PostgreSQL, Nginx và Cloudflare Tunnel.
7. Export role cấu hình và duy nhất `viet@studio.com` vào file tạm mode `0600`.
8. Kiểm tra guard: đúng một `viet@studio.com`, active, role-admin; nếu sai thì dừng.
9. Đổi tên database cũ; tạo `studio_db` mới.
10. Chạy migration one-shot trên database mới.
11. Import role hệ thống và duy nhất admin; kiểm tra user count bằng 1 trước khi start app.
12. Tạo/mount `chat_uploads`, kiểm tra write/read.
13. Start đúng image tag release; không build source trực tiếp giữa cutover.
14. Chờ Docker health healthy rồi mới mở bước xác minh.

## 8. Giai đoạn D — Xác minh sau cutover

- Localhost `/healthz` và public `/healthz` đều HTTP 200.
- Không có lỗi Prisma, Active Cache, `TRUST_PROXY`, Socket.IO hoặc permission volume trong log.
- `viet@studio.com` đăng nhập được bằng mật khẩu cũ và còn quyền admin.
- Database có đúng schema/migration mới và đúng một user quản trị trước QA.
- Kiểm tra Socket.IO qua domain HTTPS/Nginx.
- Dùng tài khoản QA tạm để kiểm tra hai người dùng: general, DM, unread, tag và ảnh.
- Tạo khách hàng QA có ngày sinh/kỷ niệm trong cửa sổ nhắc; xác nhận notification và luồng tạo task chăm sóc hoạt động qua domain production.
- Recreate app container một lần có kiểm soát; ảnh QA vẫn tải được.
- Dừng app, xóa tài khoản QA, khách hàng/task/notification anniversary QA, chat/read-state/file QA; start lại và xác nhận chỉ còn `viet@studio.com`, không còn dữ liệu QA.
- Kích hoạt lại backup timer, chạy một backup mới và kiểm tra cả database lẫn archive ảnh trên Google Drive.

Không bàn giao khách hàng nếu bất kỳ kiểm tra nào chưa đạt.

## 9. Rollback

### Trước khi đổi tên database

- Start lại image cũ; không có thay đổi dữ liệu cần phục hồi.

### Sau khi đã tạo database mới

1. Dừng app release mới.
2. Đổi tên database mới thành tên đánh dấu failed, không xóa ngay.
3. Đổi `studio_db_pre_chat_20260714` trở lại `studio_db`.
4. Khôi phục compose/image rollback.
5. Start app cũ và xác minh localhost/public health, login và log.
6. Kích hoạt lại backup timer khi production cũ ổn định.

Rollback không phụ thuộc vào việc restore dump; dump vẫn là lớp bảo vệ thứ hai.

## 10. Điều kiện bắt buộc phải dừng

- Backup không verify được hoặc restore rehearsal thất bại.
- Không tìm thấy đúng một `viet@studio.com` active/role-admin.
- Migration tạo SQL ngoài phạm vi schema dự kiến.
- Admin không đăng nhập được bằng mật khẩu hiện hữu.
- Volume ảnh không ghi/đọc được hoặc ảnh mất sau recreate container.
- WebSocket qua production proxy không kết nối được.
- Scheduler sinh nhật/kỷ niệm không tạo đúng notification, tạo trùng hoặc sai mốc ngày.
- Health không lên trong thời gian giới hạn hoặc log có lỗi Active Cache/Prisma.
- Không xác định chắc image rollback hoặc database cũ.

## 11. Các cổng phê duyệt

- **Gate 1:** người dùng duyệt kế hoạch này → mới được sửa local để chuẩn bị release.
- **Gate 2:** người dùng duyệt kết quả lint/test/build/browser QA và rehearsal → mới được cutover production.
- **Gate 3:** sau thời gian theo dõi tối thiểu 7 ngày, người dùng xác nhận riêng → mới được xóa database rollback và backup tạm.

Không suy diễn một gate đã được duyệt từ gate trước.

## 12. Nhật ký thực thi Gate A/B ngày 2026-07-14

Gate A đã đạt:

- `TRUST_PROXY`, Prisma initial migration, Docker startup không tự sửa schema, persistent upload và backup database + ảnh đã được triển khai trong source.
- Lint, 39/39 tests, build, audit 0, compose render và migration rehearsal local đều đạt.
- Release source là `96048be`; compose hardening là `b05f361`.
- Image release Linux AMD64 đã push theo digest `sha256:a1bf06d9de933937e739cd63f0570e54fbec84c11ee4203b0e6da5114bfe8bf5`.

Gate B đã đạt trên server, không ảnh hưởng production:

- Backup thủ công thành công và tạo thêm một bản mã hóa.
- Checksum, GPG decrypt, `pg_restore --list`, restore vào database phụ và row-count comparison đều đạt.
- Migration trên database rehearsal sạch thành công; Prisma báo up to date.
- Chỉ import 4 role và `viet@studio.com`; không ghi password hash ra log.
- Health, login, auth, database status, Socket.IO, chat, attachment, restart persistence và scheduler sinh nhật chống trùng đều đạt.
- Production vẫn running và health `OK` sau toàn bộ rehearsal.

Gate C đang dừng trước cutover vì phát hiện credential quản trị ứng dụng hiện tại không còn đủ điều kiện bảo mật. Cần quyết định riêng về mật khẩu ứng dụng mới. Không đổi mật khẩu SSH trong phạm vi này nếu chưa có lệnh rõ ràng.
