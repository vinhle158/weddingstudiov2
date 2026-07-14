# STUDIO V2 — Báo cáo Kiểm tra Code Freeze

**Ngày:** 2026-07-06
**Dự án:** STUDIO V2 (The Will Studio / Aura Bridal Studio Management App)
**Thư mục gốc:** `C:\Users\ROYAL PALACE\Desktop\STUDIO V2`
**Tổng số file (không tính node_modules/dist/.git):** 53 files, ~1.6 MB

---

## Tổng quan

Dự án là ứng dụng quản lý studio cưới (The Will Studio / Aura Bridal Studio) với frontend React 19 + Vite + Tailwind CSS v4, backend Express.js + Prisma ORM + PostgreSQL. Ứng dụng hỗ trợ cả desktop và mobile.

**Kết luận: Dự án CHƯA sẵn sàng cho code freeze.** Có 6 vấn đề Critical (đặc biệt nghiêm trọng về bảo mật), 10 vấn đề High, 14 Medium, và 10 Low cần xử lý.

---

## Thống kê Tổng hợp

| Mức độ | Số lượng |
|---|---|
| **Critical** | 6 |
| **High** | 10 |
| **Medium** | 14 |
| **Low** | 10 |
| **Tổng cộng** | **40** |

| Danh mục | Số lượng |
|---|---|
| Bảo mật | 16 |
| Độ chính xác dữ liệu | 7 |
| Chất lượng code | 10 |
| Kiến trúc | 5 |
| Tài liệu / Cấu hình | 2 |

---

## CRITICAL — Phải sửa ngay (Chặn Code Freeze)

### C-01: Mật khẩu lưu dạng văn bản thuần (plaintext)

- **Files:** `server.ts:68,159,189` / `src/db_service.ts:258,267,276,285,772`
- **Mô tả:** Trường `password_hash` lưu mật khẩu dạng plaintext (`admin123`, `manager123`, `staff123`, `123456`). Đăng nhập tại `server.ts:68` so sánh trực tiếp `user.password_hash !== password` — không có bất kỳ mã hóa nào.
- **Hậu quả:** Bất kỳ ai đọc được file (tải backup, truy cập db.json, log lỗi) đều thấy toàn bộ thông tin đăng nhập.
- **Sửa:** Cài `bcryptjs`, hash mật khẩu khi tạo/cập nhật, so sánh bằng `bcrypt.compare()`.

### C-02: Token xác thực chỉ là user ID

- **Files:** `server.ts:31` / `src/App.tsx:131`
- **Mô tả:** Sau đăng nhập, `localStorage.setItem('studio_token', data.user.id)` lưu `user-admin` làm token. Server tại dòng 31 chỉ tìm user theo ID: `db.users.find(u => u.id === userId)`.
- **Hậu quả:** Bất kỳ ai biết/đoán được user ID đều có thể giả mạo người dùng đó. Không hết hạn, không ký, không có secret phía server.
- **Sửa:** Triển khai JWT với thư viện `jsonwebtoken`, tạo `JWT_SECRET`, và có thời hạn token.

### C-03: Thông tin đăng nhập hardcoded trong file văn bản

- **File:** `New Text Document.txt:1-2`
- **Mô tả:** Chứa `viet@studio.com` và một mật khẩu thật đã được redacted — thông tin đăng nhập nằm trong một file thừa.
- **Hậu quả:** Thông tin đăng nhập bị lộ trên ổ đĩa, có thể đã bị commit vào git.
- **Sửa:** Xóa file ngay lập tức. Đổi mật khẩu đã bị lộ.

### C-04: Thông tin database thật trong file .env

- **File:** `.env:3`
- **Mô tả:** `DATABASE_URL="postgresql://studio_user:production_password@127.0.0.1:5433/studio_db?schema=public"` — chứa `production_password`.
- **Hậu quả:** Mặc dù `.gitignore` bao phủ `.env*`, file tồn tại với thông tin đăng nhập production thật. Nếu thư mục dự án bị sao chép/chia sẻ, chúng sẽ bị lộ.
- **Sửa:** Đổi `production_password`. Sử dụng secret manager hoặc đảm bảo `.env` không bị phân phối.

### C-05: Export database lộ toàn bộ mật khẩu

- **File:** `server.ts:1467-1472`
- **Mô tả:** `/api/database/export` gửi toàn bộ object `db` bao gồm `users[].password_hash` dạng JSON.
- **Hậu quả:** Admin tải backup sẽ nhận được mật khẩu plaintext của tất cả người dùng.
- **Sửa:** Loại bỏ `password_hash` khỏi dữ liệu users trước khi gửi response export.

### C-06: Không mã hóa mật khẩu khi tạo/cập nhật user

- **Files:** `server.ts:155-163` (tạo user), `server.ts:189` (cập nhật user)
- **Mô tả:** Mật khẩu được lưu đúng như nhận từ client mà không mã hóa.
- **Hậu quả:** Tất cả mật khẩu đều ở dạng plaintext trong database.
- **Sửa:** Hash mật khẩu bằng bcrypt trước khi lưu.

---

## HIGH — Phải sửa trước Code Freeze

### H-01: Không có rate limiting trên endpoint đăng nhập

- **File:** `server.ts:59-86` (POST `/api/auth/login`)
- **Mô tả:** Không giới hạn số lần đăng nhập mỗi IP hoặc mỗi user. Tấn công brute-force có thể thực hiện dễ dàng.
- **Sửa:** Thêm middleware `express-rate-limit` (ví dụ: 5 lần mỗi 15 phút mỗi IP).

### H-02: Không có cấu hình CORS

- **File:** `server.ts` (toàn bộ file)
- **Mô tả:** Không cài đặt middleware `cors`. Bất kỳ origin nào cũng có thể gửi request đến API.
- **Hậu quả:** Tấn công cross-origin có thể thực hiện từ bất kỳ trang web nào.
- **Sửa:** Cài thư viện `cors` và cấu hình các origin được phép.

### H-03: Server lắng nghe trên 0.0.0.0

- **File:** `server.ts:1900`
- **Mô tả:** `app.listen(PORT, '0.0.0.0', ...)` bind trên tất cả network interface.
- **Hậu quả:** Trong môi trường có thể truy cập network, server bị lộ trên tất cả NIC mà không có firewall.
- **Sửa:** Đổi thành `127.0.0.1` cho local-only, hoặc sử dụng reverse proxy.

### H-04: SQL Injection qua Prisma raw query

- **File:** `server.ts:110`
- **Mô tả:** `await prisma.$queryRaw\`SELECT 1\`` — Mặc dù trường hợp cụ thể này an toàn (không có user input), việc sử dụng `$queryRaw` tạo tiền lệ nguy hiểm. Toàn bộ codebase thiếu input validation/sanitization.
- **Sửa:** Tránh sử dụng `$queryRaw`. Thêm thư viện validation (ví dụ: `zod`) cho tất cả API payloads.

### H-05: Không có input validation trên API endpoints

- **File:** `server.ts` (tất cả POST/PUT endpoints)
- **Mô tả:** User input được chấp nhận và sử dụng trực tiếp không có schema validation. Ví dụ: `server.ts:396` nhận `shoot_date`, `package_name` trực tiếp từ `req.body`.
- **Hậu quả:** Dữ liệu sai định dạng có thể làm hỏng database hoặc gây lỗi server.
- **Sửa:** Triển khai schema validation bằng `zod` hoặc `joi` cho tất cả endpoints.

### H-06: Lỗi ưu tiên toán tử trong kiểm tra quyền tasks

- **File:** `server.ts:575`
- **Mô tả:** Điều kiện trộn lẫn `||` và `&&` không có ngoặc:
  ```
  if (req.role?.id === 'role-staff' || ... || req.role?.permissions.includes('tasks.view_own') && !req.role?.permissions.includes('tasks.view_all'))
  ```
  Vì `&&` bind chặt hơn `||`, logic bị phân tích sai.
- **Hậu quả:** Users có thể thấy tasks mà họ không được quyền truy cập.
- **Sửa:** Thêm ngoặc rõ ràng xung quanh group kiểm tra permission.

### H-07: Trạng thái order không hợp lệ không được validate

- **File:** `server.ts:492-537` (POST `/api/orders/:id/status`)
- **Mô tả:** Nếu client gửi `status: "xyz"`, `statusOrder.indexOf("xyz")` trả về `-1`. So sánh `-1 < oldIdx` có thể pass sai, cho phép giá trị trạng thái không hợp lệ vào database.
- **Hậu quả:** Dữ liệu bị hỏng với giá trị trạng thái không hợp lệ.
- **Sửa:** Validate rằng `status` nằm trong danh sách cho phép trước khi xử lý.

### H-08: Tạo order thiếu các trường price/deposit

- **File:** `server.ts:395-437` (POST `/api/orders`)
- **Mô tả:** Order model trong schema có các trường `package_price`, `deposit_amount`, `total_amount`, nhưng endpoint tạo không nhận hoặc set các giá trị này. Interface tại `src/db_service.ts:38-50` cũng thiếu các trường này.
- **Hậu quả:** Orders không thể theo dõi thông tin giá qua API.
- **Sửa:** Thêm các trường này vào cả TypeScript interface và API endpoint.

### H-09: Tần suất polling gây vấn đề hiệu suất

- **Files:** `src/App.tsx:120` (10s), `src/components/Chat.tsx` (3s), `src/components/Notifications.tsx` (10s)
- **Mô tả:** Nhiều polling intervals chạy đồng thời. Chat polling mỗi 3 giây đặc biệt aggress.
- **Hậu quả:** Server bị quá tải khi có nhiều user đồng thời.
- **Sửa:** Tăng interval lên 15-30 giây hoặc triển khai WebSocket/SSE.

### H-10: Không có pagination trên list endpoints

- **Files:** `server.ts:132` (users), `server.ts:287` (customers), `server.ts:363` (orders), `server.ts:555` (tasks), `server.ts:1609` (leads)
- **Mô tả:** Tất cả list endpoints trả về toàn bộ dataset trong một response.
- **Hậu quả:** Hiệu suất giảm dần khi dữ liệu tăng. Có thể gây cạn kiệt bộ nhớ.
- **Sửa:** Thêm tham số query `page`, `limit` với giá trị mặc định hợp lý.

---

## MEDIUM — Nên sửa trước Code Freeze

### M-01: Sử dụng quá nhiều type `any` (247 lần)

- **Files:** Tất cả files `src/`
- **Mô tả:** Sử dụng `any` tràn lan trong tất cả components và types. Ví dụ: `useState<any>(null)` trong `App.tsx:41,42,56,58`.
- **Hậu quả:** Loại bỏ type safety của TypeScript. Runtime errors không bị phát hiện khi compile.
- **Sửa:** Định nghĩa interfaces đúng cho tất cả state và props.

### M-02: Dependency không sử dụng — @google/genai

- **File:** `package.json:14`
- **Mô tả:** `@google/genai` được liệt kê trong dependencies nhưng không bao giờ import trong bất kỳ source file nào.
- **Sửa:** Xóa khỏi `package.json` và cài lại.

### M-03: Vite trùng lặp trong dependencies và devDependencies

- **File:** `package.json:25` (dependencies) và `package.json:36` (devDependencies)
- **Mô tả:** `vite` được liệt kê trong cả hai section ở `^6.2.3`.
- **Sửa:** Xóa khỏi `dependencies` (nên chỉ nằm trong `devDependencies`).

### M-04: File thừa — data_mi.xlsx

- **File:** `data_mi.xlsx`
- **Mô tả:** File Excel ở root dự án không được tham chiếu trong codebase.
- **Sửa:** Xóa file.

### M-05: File thừa — metadata.json

- **File:** `metadata.json`
- **Mô tả:** File metadata Google AI Studio. Không được dùng trong application code.
- **Sửa:** Xóa hoặc chuyển sang thư mục `.ai-studio/` nếu cần.

### M-06: Title index.html ghi "My Google AI Studio App"

- **File:** `index.html:6`
- **Mô tả:** `<title>My Google AI Studio App</title>` — nên phản ánh tên ứng dụng thực tế.
- **Sửa:** Đổi thành "The Will Studio" hoặc "Studio Management System".

### M-07: Port hardcoded, không đọc từ .env

- **File:** `server.ts:20`
- **Mô tả:** `const PORT = 3000;` bị hardcoded. File `.env` có `PORT=3000` nhưng không bao giờ được đọc.
- **Sửa:** Sử dụng `process.env.PORT || 3000`.

### M-08: Race condition khi reset navigation arg

- **File:** `src/App.tsx:178-180`
- **Mô tả:** `useEffect(() => { setNavigationArg(null); }, [activeTab]);` reset navigation args ngay khi tab thay đổi, trước khi child component có thể consume chúng.
- **Hậu quả:** Navigation arguments (ví dụ: mở order detail cụ thể) bị mất.
- **Sửa:** Delay reset hoặc sử dụng ref pattern.

### M-09: Race condition khi ghi db.json (dual persistence)

- **Files:** `src/db_service.ts:828-841`
- **Mô tả:** `save()` ghi cả `db.json` (sync) và PostgreSQL (async qua queue). Nếu PostgreSQL sync fail, hai datastore sẽ bị lệch lặng lẽ.
- **Sửa:** Thêm error handling/alerting cho PostgreSQL sync failures.

### M-10: Chiến lược sync xóa tất cả rồi chèn lại

- **File:** `src/db_service.ts:845-927` (syncToPostgres)
- **Mô tả:** Mỗi save trigger `deleteMany()` trên tất cả 15 tables sau đó `createMany()`. Đây là operation O(n) full-replace mỗi lần thay đổi dữ liệu.
- **Hậu quả:** Hiệu suất giảm nghiêm trọng khi dữ liệu tăng; I/O database cao; phá vỡ foreign key constraints.
- **Sửa:** Triển khai logic upsert/update đúng thay vì full table replacement.

### M-11: Seed data bị trùng lặp

- **File:** `src/db_service.ts:220-603` (~380 dòng)
- **Mô tả:** Default data được định nghĩa inline trong service module và bị trùng lặp giữa `get()` và `initialize()`.
- **Sửa:** Di chuyển seed data sang file `seed.ts` riêng.

### M-12: Nhiều console.error/log còn trong production code

- **Files:** 47 lần xuất hiện trong `src/**/*.tsx` và `server.ts`
- **Mô tả:** Debug logging xuyên suốt codebase (ví dụ: `server.ts:113,1901,1906`; `src/App.tsx:68,93,115`).
- **Sửa:** Thay thế bằng logging library với log-level controls.

### M-13: Không có Error Boundary trong React components

- **Files:** `src/main.tsx`, `src/App.tsx`
- **Mô tả:** Không có component `ErrorBoundary` ở bất kỳ đâu. Lỗi crash trong bất kỳ component nào sẽ làm sập toàn bộ app.
- **Sửa:** Thêm `ErrorBoundary` wrapper quanh các vùng nội dung chính.

### M-14: Không có Content-Security-Policy hoặc security headers

- **File:** `server.ts`
- **Mô tả:** Không cấu hình helmet.js hoặc security headers tương đương (CSP, X-Frame-Options, X-Content-Type-Options, etc.).
- **Sửa:** Cài và cấu hình middleware `helmet`.

---

## LOW — Nice to Fix / Chất lượng Code

### L-01: package.json name là "react-example"

- **File:** `package.json:2`
- **Sửa:** Đổi thành `"studio-v2"` hoặc tương tự.

### L-02: File thừa trong project root

- **Files:** `New Text Document.txt`, `wizard-mockup.html`, `wizard-mockup-v2.html`, `data_mi.xlsx`
- **Sửa:** Di chuyển mockups sang thư mục `docs/` hoặc `design/`. Xóa file text và Excel.

### L-03: Import icon lucide-react không sử dụng

- **Files:** `Dashboard.tsx:7` (Shirt), `Orders.tsx:11` (Shirt), `Dashboard.tsx:24` (Flame), `Dashboard.tsx:25` (Shield), v.v.
- **Sửa:** Xóa các import không sử dụng để giảm bundle size.

### L-04: Components quá lớn (không phân tách)

- **Files:** `Objectives.tsx` (2116 dòng), `Dashboard.tsx` (1581 dòng), `Leads.tsx` (1681 dòng), `Orders.tsx` (1156 dòng)
- **Sửa:** Extract sub-components và custom hooks.

### L-05: Tạo UUID yếu

- **File:** `src/db_service.ts:932`
- **Mô tả:** `Math.random().toString(36).substring(2, 9)` chỉ tạo 7 ký tự random. Xác suất collision tăng khi dữ liệu nhiều.
- **Sửa:** Sử dụng `crypto.randomUUID()` hoặc thư viện `uuid`.

### L-06: Không bật TypeScript strict mode

- **File:** `tsconfig.json`
- **Mô tả:** Thiếu `"strict": true` và các flag liên quan (`strictNullChecks`, `noImplicitAny`). `skipLibCheck: true` cũng được bật.
- **Sửa:** Bật strict mode và sửa các type errors phát sinh.

### L-07: Mật khẩu lưu trong localStorage ("Remember Me")

- **File:** `src/App.tsx:48,131-138`
- **Mô tả:** Khi check "Remember Me", mật khẩu plaintext được lưu trong `localStorage.setItem('remembered_password', password)`.
- **Sửa:** Xóa việc lưu mật khẩu trong localStorage. Sử dụng secure session cookies thay thế.

### L-08: Prisma schema không có migration files

- **File:** `prisma/schema.prisma`
- **Mô tả:** Không tìm thấy thư mục `prisma/migrations/`. Schema tồn tại nhưng không có lịch sử migration versioned.
- **Sửa:** Chạy `prisma migrate dev` để tạo initial migration.

### L-09: Tài liệu chỉ có bằng tiếng Việt

- **Files:** `README.md`, `BAO_CAO.md`
- **Sửa:** Thêm bản dịch tiếng Anh hoặc tài liệu song ngữ.

### L-10: Không có file test nào trong dự án

- **Files:** Không tìm thấy
- **Mô tả:** Zero unit tests, integration tests, hay e2e tests. Không có test framework được cấu hình.
- **Sửa:** Thêm ít nhất basic API endpoint tests sử dụng Vitest.

---

## Quan sát Kiến trúc

### 1. Chiến lược Database lai (JSON + PostgreSQL)

Hệ thống sử dụng chiến lược dual-write: mỗi save ghi cả `db.json` (sync) rồi async sync toàn bộ dataset sang PostgreSQL qua full-table-delete-and-reinsert. Chiến lược này dễ hỏng, không idempotent, và tạo nguy cơ consistency nghiêm trọng. PostgreSQL nên là primary store, `db.json` chỉ nên dùng làm export/backup tùy chọn.

### 2. Không có Session Management

Xác thực sử dụng raw user IDs làm token, không có server-side session store, không token expiration, không mechanism revoke. Nếu user ID bị compromise, attacker có quyền truy cập vĩnh viễn.

### 3. Backend Monolithic

Toàn bộ backend API (30+ endpoints) nằm trong một file `server.ts` duy nhất (1907 dòng). Điều này khiến codebase khó maintain, test, và debug.

### 4. Thiếu Infrastructure

- Không có test suite
- Không có CI/CD configuration
- Không có Dockerfile / containerization
- Không có rate limiting middleware
- Không có request logging (morgan, pino, v.v.)
- Không có health check endpoint riêng

### 5. Báo cáo Kiểm tra trước đó

Dự án đã có `BAO_CAO.md` ghi lại 37 vấn đề từ lần review trước. Nhiều vấn đề (C-01 đến C-06, H-06, H-07, H-08) vẫn chưa được giải quyết.

---

## Hành động Khuyến nghị trước Code Freeze

**Bắt buộc phải sửa (Critical + High):**

| # | Vấn đề | Mức độ | File |
|---|---|---|---|
| 1 | Triển khai bcrypt password hashing | Critical | `server.ts`, `src/db_service.ts` |
| 2 | Triển khai JWT authentication | Critical | `server.ts`, `src/App.tsx` |
| 3 | Xóa `New Text Document.txt` và đổi mật khẩu | Critical | `New Text Document.txt` |
| 4 | Loại bỏ password_hash khi export database | Critical | `server.ts:1467-1472` |
| 5 | Hash mật khẩu khi tạo/cập nhật user | Critical | `server.ts:155-163,189` |
| 6 | Thêm rate limiting cho login | High | `server.ts:59-86` |
| 7 | Cấu hình CORS | High | `server.ts` |
| 8 | Fix lỗi ưu tiên toán tử | High | `server.ts:575` |
| 9 | Validate trạng thái order | High | `server.ts:492-537` |
| 10 | Thêm các trường price/deposit cho Order | High | `server.ts:395-437` |

**Nên sửa (Medium — ưu tiên theo impact):**

| # | Vấn đề | File |
|---|---|---|
| 11 | Đổi Port thành dynamic | `server.ts:20` |
| 12 | Đổi title index.html | `index.html:6` |
| 13 | Xóa file thừa | `data_mi.xlsx`, `metadata.json` |
| 14 | Thêm Error Boundary | `src/main.tsx` |
| 15 | Thêm security headers (helmet) | `server.ts` |
| 16 | Fix race condition navigation args | `src/App.tsx:178-180` |
| 17 | Triển khai pagination | `server.ts` (tất cả list endpoints) |
| 18 | Tăng polling intervals | `src/App.tsx`, `src/components/Chat.tsx` |

---

*Báo cáo này được tạo bởi MiMoCode Agent — 2026-07-06*
