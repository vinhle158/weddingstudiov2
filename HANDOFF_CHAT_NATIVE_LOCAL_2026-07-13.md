# HANDOFF — Nâng cấp Chat Native STUDIO V2 (Local)

Ngày bàn giao: **2026-07-13**
Trạng thái: **Hoàn tất bản local để đánh giá; chưa commit, push hoặc deploy production**

## 1. Repo và mốc nguồn

- Repo chuẩn: `/Users/mac/Documents/STUDIO_V2_GITHUB_MAIN`
- Branch: `release-candidate/studio-v2-hardening-crm-2026-07-11`
- Commit nền trước thay đổi chat: `2e2e71a25b9463ad6d34feefb6647def1b9e36d6`
- Không sử dụng `/Users/mac/Documents/STUDIO V2` làm source triển khai.
- Worktree hiện có toàn bộ thay đổi chat ở trạng thái chưa commit.

## 2. Quyết định sản phẩm

Sau khi đánh giá Mattermost, Zulip, Rocket.Chat và Matrix/Element, quyết định là:

> Giữ hệ thống chat native của STUDIO V2 và nâng cấp dần. Không nhúng hệ thống chat độc lập, không thêm lớp đồng bộ tài khoản/token phức tạp.

Mục tiêu là duy trì một hệ thống đăng nhập, một backend, một PostgreSQL và một quy trình vận hành dễ chẩn đoán khi có lỗi.

## 3. Phần đã triển khai

### Realtime và độ tin cậy

- Thêm Socket.IO cho chat realtime.
- Socket xác thực bằng JWT/session hiện tại của STUDIO V2.
- Có fallback REST polling 30 giây khi realtime mất kết nối.
- Trạng thái `Đang gửi`, gửi thất bại và `Gửi lại`.
- Ngăn hiển thị tin trùng khi REST response và socket event về gần nhau.
- Hiển thị trạng thái mất kết nối và tự kết nối lại.

### Unread và quyền truy cập

- Thêm model PostgreSQL `ChatReadState`.
- Unread riêng cho kênh chung và từng hội thoại riêng.
- Đánh dấu đã đọc theo người dùng và conversation key.
- Thêm `/api/chat/contacts` thay cho việc Chat gọi `/api/users` vốn chỉ dành cho quản trị viên.
- Backend kiểm tra quyền đọc/gửi private message; không chỉ dựa vào filter frontend.
- Có endpoint mentionable users chỉ trả các trường an toàn.

### Tiện ích chat

- Đính kèm ảnh PNG/JPEG/WebP, tối đa 5 MB.
- Chụp màn hình bằng Screen Capture API; người dùng phải tự chọn tab/cửa sổ và cấp quyền.
- Ảnh lưu ngoài database tại `chat_uploads/`; database chỉ giữ metadata.
- Ảnh được tải qua API có xác thực và kiểm tra người dùng có thuộc cuộc hội thoại hay không.
- Tag `@nhân viên` bằng autocomplete; lưu ID người được tag.
- Tìm và gắn tham chiếu công việc theo ID, tên hoặc mã hợp đồng.
- Tìm và gắn hồ sơ khách hàng theo ID, tên hoặc số điện thoại.
- Backend kiểm tra quyền xem task/customer trước khi cho phép gắn.
- Bấm thẻ tham chiếu trong tin nhắn để mở đúng màn hình công việc hoặc khách hàng.

### Layout desktop và mobile

- Desktop: bố cục hai cột rộng hơn, header/composer/bubble thống nhất.
- Mobile: danh sách hội thoại và hội thoại là hai màn hình riêng.
- Khi vào Chat mobile, ẩn MobileHeader và BottomNav chung để Chat chiếm toàn màn hình.
- Dùng `100dvh`, `viewport-fit=cover` và `interactive-widget=resizes-content`.
- Composer nằm trong flex layout và bám đáy; vùng message tự co khi viewport/bàn phím thay đổi.
- Input mobile dùng font 16px để tránh iOS tự zoom.
- Popover tag và chọn hồ sơ nổi phía trên composer, không đẩy lệch layout.
- Desktop và mobile dùng chung `src/components/Chat.tsx`; `MobileChat.tsx` chỉ là wrapper để tránh hai implementation lệch nhau.

### Thông báo trên Tổng quan mobile

- Thêm thẻ `Thông báo đẩy` trên Mobile Dashboard.
- Người dùng chủ động bấm bật/tắt và cấp quyền trình duyệt.
- Service worker: `public/notification-sw.js`.
- Đẩy thông báo nghiệp vụ mới từ polling `/api/notifications`.
- Đẩy tin chat mới qua Socket.IO khi người dùng đang ở màn hình khác.
- Khi bấm notification, ưu tiên focus cửa sổ STUDIO V2 đang mở.

Giới hạn đã chủ động giữ: notification hiện hoạt động khi web còn mở hoặc chạy nền. Nhận push khi trình duyệt đã đóng hoàn toàn cần Web Push/VAPID và bảng lưu subscription; phần đó **chưa triển khai** để tránh mở rộng hạ tầng khi chưa có quyết định.

## 4. Schema và storage mới

`ChatMessage` có thêm các trường:

- `attachment_filename`
- `attachment_name`
- `attachment_mime`
- `reference_type`
- `reference_id`
- `reference_label`
- `mentioned_user_ids`

Model mới:

- `ChatReadState`

Local PostgreSQL đã chạy `npx prisma db push` thành công.

Ảnh chat được lưu tại:

```text
chat_uploads/
```

Thư mục này đã được thêm vào `.gitignore`.

## 5. Các file chính đã thay đổi

- `.gitignore`
- `index.html`
- `package.json`
- `package-lock.json`
- `prisma/schema.prisma`
- `server.ts`
- `src/App.tsx`
- `src/components/Chat.tsx`
- `src/components/mobile/MobileApp.tsx`
- `src/components/mobile/MobileLayout.tsx`
- `src/components/mobile/screens/MobileChat.tsx`
- `src/components/mobile/screens/MobileDashboard.tsx`
- `src/db_service.ts`
- `src/lib/api.ts`
- `src/lib/browserNotifications.ts`
- `public/notification-sw.js`
- `tests/anniversary.test.ts`
- `tests/security.test.ts`

Dependency mới:

- `socket.io`
- `socket.io-client`

## 6. Kết quả xác minh

Các lệnh đã chạy thành công:

```bash
npm run lint
npm test
npm run build
git diff --check
```

Kết quả test cuối:

- **18/18 tests đạt**.
- Bao gồm test xác thực socket, realtime message, unread/read state, quyền private chat, attachment bảo vệ bằng auth, mention và task reference.

Browser QA đã kiểm tra:

- Desktop Chat không tràn ngang.
- Mobile Chat chiếm đúng toàn viewport.
- Composer chạm đáy, message pane cuộn độc lập.
- Input mobile focus với font 16px.
- Danh sách mobile không còn header/bottom-nav chồng nhau.
- Autocomplete tag hoạt động.
- Tìm task theo mã hợp đồng hoạt động.
- Service worker được serve thành công.
- Tổng quan mobile hiển thị thẻ bật thông báo và unread badge.
- Không có console error mới trong lượt QA cuối.

Build vẫn có warning chunk JavaScript lớn hơn 500 kB; đây là warning đã có tính chất kiến trúc/bundle, không làm build fail.

`npm audit --omit=dev` còn 3 cảnh báo high từ chuỗi dependency cũ `node-nlp -> xlsx`. Không chạy `npm audit fix --force` vì công cụ đề xuất downgrade/breaking change cho `node-nlp`.

## 7. Tài khoản local phục vụ kiểm tra

```text
Email: local.review@studio.test
Mật khẩu: không ghi vào repo; dùng credential local đã bàn giao trực tiếp trong phiên kiểm tra
```

Tài khoản này chỉ nằm trong PostgreSQL local, không tồn tại trên production.

## 8. Trước khi deploy production

Không deploy thẳng nếu chưa hoàn thành checklist sau:

1. Review toàn bộ diff và chốt UX với người dùng.
2. Tạo migration Prisma thực tế hoặc chạy `npx prisma db push` có kiểm soát trước khi start app mới.
3. Backup PostgreSQL production.
4. Tạo Docker volume/persistent mount cho `chat_uploads/`; nếu không ảnh sẽ mất khi recreate container.
5. Bảo đảm user chạy Node có quyền đọc/ghi volume ảnh.
6. Reverse proxy phải hỗ trợ WebSocket upgrade cho Socket.IO tại `/socket.io`.
7. Kiểm tra HTTPS, CSP và service-worker scope trên domain production.
8. Giữ REST fallback trong lần deploy đầu.
9. Smoke test bằng tối thiểu hai tài khoản thật: general chat, DM, unread, ảnh, tag, task/customer reference và mobile keyboard.
10. Chuẩn bị rollback cả source lẫn schema; không xóa chat cũ hoặc lịch sử cũ.

## 9. Điểm tiếp tục cho phiên mới

Phiên mới nên bắt đầu bằng:

```bash
cd /Users/mac/Documents/STUDIO_V2_GITHUB_MAIN
git status --short --branch
git diff --check
npm run lint
npm test
npm run build
```

Sau đó hỏi người dùng chọn task mới. Không tự commit/push/deploy nếu chưa được yêu cầu rõ ràng.

Nếu task mới tiếp tục phần chat, các chủ đề chưa làm gồm:

- Push khi trình duyệt đóng hoàn toàn bằng Web Push/VAPID.
- Quản lý/xóa file mồ côi trong `chat_uploads`.
- Reply tin nhắn, group channel tùy chỉnh, reaction, tìm kiếm lịch sử.
- Tách phần chat trong `server.ts` thành module riêng nếu phạm vi tiếp tục lớn lên.

## 10. Đối chiếu production chỉ đọc ngày 2026-07-14

Production đã được xác nhận tại `will@192.168.1.34`. Không có thay đổi nào được thực hiện trên server trong lượt kiểm tra.

- Host, Docker và Nginx đang hoạt động; `studiov2_app` và `studiov2_postgres_prod` đều healthy.
- `https://thewill.io.vn/` và `/healthz` trả HTTP 200.
- App đang chạy từ `/home/will/studio-v2`, detached HEAD tại commit nền `2e2e71a25b9463ad6d34feefb6647def1b9e36d6`.
- Source production có hai thay đổi trực tiếp chưa commit: fix `TRUST_PROXY` trong `server.ts` và regression test tương ứng trong `tests/security.test.ts`.
- Fix `TRUST_PROXY` này chưa tồn tại trong source local hiện tại; phải port về local trước khi build release để không gây regression production.
- PostgreSQL production khoảng 8,2 MB; backup timer đang enabled/active.
- Schema production chỉ có `ChatMessage` cũ gồm `id`, `sender_id`, `receiver_id`, `content`, `created_at`; chưa có `ChatReadState` hoặc các cột attachment/reference/mention.
- Nginx đã có `proxy_http_version 1.1` và các header WebSocket Upgrade phù hợp cho Socket.IO.
- App container chưa có `/app/chat_uploads` và không có persistent mount cho ảnh chat. Phải thêm volume/bind mount và backup path trước khi bật attachment trên production.
- Image production là image build cục bộ `studio-v2-app`, không phải một release tag bất biến; cần chốt quy trình version/tag/rollback trước khi cập nhật.
- Kiểm tra số lượng bản ghi ngày 2026-07-14 xác nhận dữ liệu nghiệp vụ chưa được sử dụng: `Customer`, `Lead`, `Order`, `Task`, `Objective`, `DressInventory` và `DressRental` đều bằng 0. Dữ liệu nền/test còn lại gồm 4 user, 4 role, 19 tin chat, 1 notification, 1 bản ghi StudioSettings và 8 metadata backup.
- Người dùng đã chốt chỉ bảo toàn tài khoản quản trị `viet@studio.com` qua cutover. Kiểm tra chỉ đọc xác nhận tài khoản này đang active, có `role_id=role-admin`, role `admin`, tên hiển thị `Quản trị hệ thống`. Có thể loại bỏ các user khác, chat thử, notification, metadata backup và dữ liệu test khi thực hiện reset; không được ghi password hash ra log hoặc thay bằng mật khẩu mặc định.

Kết luận: chưa deploy bản chat local ngay. Vì chưa có dữ liệu khách hàng thật, có thể chọn triển khai schema sạch sau một bản backup cuối thay vì xây migration dữ liệu phức tạp; vẫn phải hợp nhất fix `TRUST_PROXY`, xác định rõ dữ liệu test nào được bỏ hoặc giữ, thêm persistent storage cho `chat_uploads`, và đóng gói một release có version rõ ràng.

Kế hoạch cutover thận trọng đã được tách thành `PLAN_PRODUCTION_CHAT_CUTOVER_2026-07-14.md`. Kế hoạch dùng database xanh–lam, rehearsal trước trên database/container riêng và ba cổng phê duyệt độc lập; việc lập kế hoạch không cấp quyền thực thi production.

Ngày 2026-07-14 đã rà lại chức năng nhắc sinh nhật/thôi nôi và kỷ niệm cưới. Production đã có schema và scheduler, nhưng test hiện chỉ bao phủ lưu ngày và setting. Kế hoạch cutover đã bổ sung đây là tiêu chí bắt buộc, gồm test sinh notification, chống trùng, chuyển năm, 29/02, luồng tạo task chăm sóc và cleanup dữ liệu QA.

## 11. Hoàn thiện kỹ thuật local ngày 2026-07-14

Đã xử lý tại source local, chưa commit/push/deploy:

- Scheduler anniversary dùng lịch `Asia/Ho_Chi_Minh`, xử lý đúng sự kiện đầu năm sau khi đang ở cuối năm hiện tại.
- Quy ước sinh nhật 29/02 được nhắc vào 28/02 trong năm không nhuận.
- Chống tạo notification trùng theo khách hàng, loại sự kiện, số năm và năm xảy ra sự kiện.
- API khách hàng từ chối ngày lịch không hợp lệ.
- API settings chỉ nhận `anniversary_reminder_days` là số nguyên 1–30.
- Tách scheduler thành hàm kiểm thử được; thêm test tạo nhắc sinh nhật/cưới, chống trùng, ngoài cửa sổ, chuyển năm và 29/02.
- Gỡ `node-nlp` và chuỗi dependency `xlsx`; thay bằng bộ phân loại 15 intent tiếng Việt xác định, có regression test riêng.
- `npm audit --omit=dev` hiện báo 0 vulnerability.
- Tách frontend thành các chunk React/vendor/chart/animation/icon/mobile; main bundle giảm từ khoảng 1,4 MB xuống 388 KB và build không còn warning chunk trên 500 KB.
- Kết quả cuối: lint đạt, 38/38 tests đạt, production build đạt, `git diff --check` đạt.
- Runtime local build mới: `/`, `/healthz` và toàn bộ asset chunks trả HTTP 200; login đạt; API thật từ chối đúng setting 31 ngày và ngày `2027-02-29`.

Giới hạn xác minh: kênh điều khiển in-app browser không khả dụng trong lượt này nên visual browser QA không được tự động thao tác lại. UI form không bị sửa cấu trúc; visual QA vẫn là checkpoint bắt buộc trước cutover production.

## 12. Trạng thái release và rehearsal ngày 2026-07-14

Đã hoàn thành phần chuẩn bị release và rehearsal không ảnh hưởng production:

- Release source: commit `96048be106b0f0afc497d88a5c42c485d69a7313`.
- Compose production được khóa theo image digest, bind app/PostgreSQL về localhost và thêm database healthcheck tại commit `b05f361`.
- Image Linux AMD64: `vinhle158/studiov2-app@sha256:a1bf06d9de933937e739cd63f0570e54fbec84c11ee4203b0e6da5114bfe8bf5`.
- Local gate đạt: lint, 39/39 tests, build không có chunk warning, audit 0, `git diff --check`, migration deploy/status/diff trên schema tạm.
- Backup thủ công production ngày 2026-07-14 hoàn tất với service exit 0; checksum, giải mã, `pg_restore` và so sánh row count trên database phụ đều đạt.
- Migration chạy thành công trên `studio_db_chat_rehearsal`; schema Prisma up to date.
- Rehearsal có đúng 4 role và duy nhất `viet@studio.com`.
- Login, `/api/auth/me`, database status, Socket.IO, chat, ảnh bảo vệ bằng auth và persistent upload qua restart đều đạt.
- Scheduler sinh nhật tạo đúng một notification và không tạo trùng sau hai lần restart/scan.
- Production cũ vẫn running và `/healthz` trả `OK`; chưa đổi database, container, compose hoặc traffic production.

Điểm dừng bắt buộc trước cutover:

- Mật khẩu hiện tại của `viet@studio.com` trùng với credential hạ tầng đã được chia sẻ trong quá trình vận hành và từng xuất hiện trong tài liệu/test cũ. Current tree đã được làm sạch chuỗi credential, nhưng Git history không thể coi credential đó còn bí mật.
- Vì vậy không được tiếp tục giữ nguyên password hash khi cutover. Cần người dùng chọn mật khẩu quản trị ứng dụng mới hoặc cho phép tạo tự động và bàn giao qua file local mode `0600`.
- Việc đổi mật khẩu ứng dụng không đồng nghĩa được phép đổi mật khẩu SSH; đây là hai thao tác tách biệt.
