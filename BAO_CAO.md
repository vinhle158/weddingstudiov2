# BÁO CÁO TOÀN DIỆN VỀ MÃ NGUỒN — STUDIO V2

> **Dự án:** Hệ thống quản lý Studio "The Will Studio" (Aura Bridal Studio)  
> **Ngày cập nhật:** 30/06/2026  
> **Công nghệ áp dụng:** React 19 + Express.js + TypeScript + Tailwind CSS  
> **Cơ sở dữ liệu:** File JSON (`db.json`)  
> **Tổng số vấn đề phát hiện:** 37 vấn đề (phân loại theo mức độ nghiêm trọng)

---

## MỤC LỤC

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Vấn đề Bảo mật (Cực kỳ nghiêm trọng)](#2-vấn-đề-bảo-mật-cực-kỳ-nghiêm-trọng)
3. [Lỗi Logic xử lý & Nghiệp vụ](#3-lỗi-logic-xử-lý--nghiệp-vụ)
4. [Vấn đề về Hiệu năng & Kiến trúc](#4-vấn-đề-về-hiệu-năng--kiến-trúc)
5. [Code thừa & Chất lượng mã nguồn](#5-code-thừa--chất-lượng-mã-nguồn)
6. [Lộ trình đề xuất sửa chữa khi về nhà](#6-lộ-trình-đề-xuất-sửa-chữa-khi-về-nhà)

---

## 1. TỔNG QUAN HỆ THỐNG

Dự án **Studio V2** là ứng dụng web quản lý các hoạt động của studio chụp ảnh cưới, bao gồm:
*   Quản lý thông tin khách hàng và đơn hàng/hợp đồng.
*   Phân công công việc nội bộ và theo dõi tiến độ.
*   Chat nhóm nội bộ và nhận thông báo thời gian thực.
*   Thiết lập và quản lý mục tiêu (OKR).
*   Sao lưu/phục hồi dữ liệu hệ thống thông qua giao diện Quản trị.

Sau khi rà soát toàn bộ khoảng hơn 7.000 dòng mã nguồn, chúng tôi đã hệ thống hóa và phân loại toàn bộ các vấn đề cần cải thiện để bạn dễ dàng theo dõi và xử lý khi làm việc ở nhà.

---

## 2. VẤN ĐỀ BẢO MẬT (CỰC KỲ NGHIÊM TRỌNG)

Dưới đây là 12 lỗ hổng bảo mật có thể khiến hệ thống dễ dàng bị tấn công hoặc rò rỉ dữ liệu khách hàng.

### 2.1. Mật khẩu lưu trữ dưới dạng văn bản thô (Plain Text)
*   **Vị trí:** `db.json`, `server.ts` (dòng 62), `src/db_service.ts` (dòng 213)
*   **Chi tiết:** Các tài khoản mặc định như `admin`, `manager`, `staff` đều có mật khẩu lưu trực tiếp trong cơ sở dữ liệu (`admin123`, `manager123`, `staff123`). Trường dữ liệu tên là `password_hash` nhưng thực chất không hề được băm (hash).
*   **Mối nguy hại:** Bất kỳ ai có quyền đọc file `db.json` (thông qua lỗi server hoặc backup) đều lấy được mật khẩu của toàn bộ nhân viên.
*   **Cách khắc phục:** Sử dụng thư viện `bcrypt` hoặc `argon2` để hash mật khẩu trước khi lưu.

### 2.2. Đăng nhập so sánh chuỗi trực tiếp
*   **Vị trí:** `server.ts` (dòng 62)
*   **Chi tiết:** Server kiểm tra thông tin bằng cách đối chiếu trực tiếp chuỗi mật khẩu nhận từ client với chuỗi lưu trong database:
    ```typescript
    if (!user || user.password_hash !== password) { ... }
    ```
*   **Mối nguy hại:** Không sử dụng thuật toán so sánh an toàn chống tấn công timing attack, mật khẩu truyền đi dễ bị lộ.
*   **Cách khắc phục:** Dùng `bcrypt.compare(password, user.password_hash)` để so sánh an toàn.

### 2.3. Token xác thực chỉ là ID người dùng
*   **Vị trí:** `App.tsx` (dòng 124), `server.ts` (dòng 25)
*   **Chi tiết:** Sau khi đăng nhập thành công, token được lưu ở `localStorage` và gửi lên qua header chỉ là chuỗi ID dạng `user-admin` hoặc `user-staff`.
*   **Mối nguy hại:** Kẻ tấn công chỉ cần biết hoặc đoán được ID của tài khoản quản trị là có thể giả mạo token để truy cập toàn bộ hệ thống mà không cần mật khẩu.
*   **Cách khắc phục:** Sử dụng **JSON Web Token (JWT)** có chữ ký số bí mật (`JWT_SECRET`) và thời hạn hết hạn cụ thể.

### 2.4. Hardcode thông tin đăng nhập nhanh trên giao diện
*   **Vị trí:** `App.tsx` (dòng 205-227)
*   **Chi tiết:** Phần giao diện đăng nhập có các nút "Quick Login" (Đăng nhập nhanh) chứa sẵn email và mật khẩu của các tài khoản thật dưới dạng text.
*   **Mối nguy hại:** Người dùng thông thường chỉ cần F12 (Inspect) hoặc đọc file JS bundle là thấy ngay mật khẩu hệ thống.
*   **Cách khắc phục:** Loại bỏ hoàn toàn các nút này trên môi trường Production. Chỉ bật ở môi trường Development bằng biến môi trường `process.env.NODE_ENV === 'development'`.

### 2.5. API xuất dữ liệu (`export`) trả về mật khẩu người dùng
*   **Vị trí:** `server.ts` (dòng 1405-1409)
*   **Chi tiết:** Endpoint `/api/database/export` trả về toàn bộ dữ liệu file `db.json` thô bao gồm cả mảng `users` chứa mật khẩu thô.
*   **Mối nguy hại:** Quản trị viên tải file sao lưu về máy cá nhân có thể làm lộ mật khẩu của nhân viên khác.
*   **Cách khắc phục:** Trước khi trả về dữ liệu, duyệt qua danh sách người dùng và xóa trường `password_hash` (hoặc loại bỏ hoàn toàn mảng `users` khỏi file backup nếu không cần thiết).

### 2.6. Tiết lộ thông tin tài khoản qua thứ tự kiểm tra đăng nhập
*   **Vị trí:** `server.ts` (dòng 62-68)
*   **Chi tiết:** Hệ thống kiểm tra mật khẩu trước, sau đó mới kiểm tra tài khoản có bị khóa (`is_active`) hay không, và trả về thông báo lỗi chi tiết cho từng trường hợp.
*   **Mối nguy hại:** Kẻ tấn công có thể dò tìm xem email nào tồn tại trên hệ thống và trạng thái hoạt động của tài khoản đó.
*   **Cách khắc phục:** Kiểm tra sự tồn tại của user và mật khẩu cùng lúc, trả về thông báo chung: *"Email hoặc mật khẩu không chính xác"*.

### 2.7. Thiếu cơ chế giới hạn số lần đăng nhập sai (Rate Limiting)
*   **Vị trí:** `server.ts` (Endpoint `/api/auth/login`)
*   **Chi tiết:** Hệ thống không giới hạn số lần gọi API đăng nhập.
*   **Mối nguy hại:** Dễ bị tấn công vét cạn (Brute-force) để dò mật khẩu.
*   **Cách khắc phục:** Áp dụng middleware `express-rate-limit` giới hạn tối đa 5 lần đăng nhập sai trong vòng 15 phút trên mỗi IP.

### 2.8. Server lắng nghe trên tất cả các cổng mạng (0.0.0.0)
*   **Vị trí:** `server.ts` (dòng 1561)
*   **Chi tiết:** `app.listen(PORT, '0.0.0.0')` cấu hình server mở cho tất cả các card mạng.
*   **Mối nguy hại:** Nếu máy chủ nằm trong mạng LAN công cộng hoặc không có tường lửa bảo vệ, bất kỳ ai cùng mạng đều có thể truy cập trực tiếp vào port API.
*   **Cách khắc phục:** Thay đổi thành `127.0.0.1` để chỉ cho phép truy cập nội bộ (localhost), sử dụng Nginx làm Reverse Proxy nếu chạy thật.

### 2.9. Chưa cấu hình CORS (Cross-Origin Resource Sharing)
*   **Vị trí:** `server.ts`
*   **Chi tiết:** Không có cấu hình giới hạn nguồn gốc yêu cầu gửi đến API.
*   **Mối nguy hại:** Một trang web độc hại khác chạy trên trình duyệt của người dùng có thể gửi request nặc danh đến API của bạn.
*   **Cách khắc phục:** Cài đặt gói `cors` và cấu hình chỉ cho phép domain của frontend truy cập:
    ```typescript
    app.use(cors({ origin: process.env.FRONTEND_URL }));
    ```

### 2.10. Thiếu cơ chế phòng chống CSRF (Cross-Site Request Forgery)
*   **Vị trí:** Toàn bộ các API dạng POST/PUT/DELETE thay đổi dữ liệu.
*   **Chi tiết:** Hệ thống hoàn toàn dựa vào Bearer Token lấy từ Header để xác thực, không có CSRF token đi kèm.
*   **Cách khắc phục:** Chuyển sang lưu trữ token trong HttpOnly Cookie với cấu hình `SameSite=Strict` hoặc thiết lập CSRF token bảo vệ.

### 2.11. API nhập dữ liệu (`import`) không kiểm tra cấu trúc dữ liệu đầu vào
*   **Vị trí:** `server.ts` (dòng 1413-1428)
*   **Chi tiết:** Endpoint `/api/database/import` chỉ kiểm tra xem dữ liệu tải lên có phải là đối tượng chứa mảng `users` và `roles` hay không, chứ không kiểm tra tính hợp lệ của từng trường bên trong.
*   **Mối nguy hại:** Có thể khiến ứng dụng bị sập hoặc lỗi logic nghiêm trọng nếu người dùng tải lên file JSON có cấu trúc sai lệch.
*   **Cách khắc phục:** Sử dụng thư viện validation như `zod` hoặc `joi` để kiểm tra chi tiết cấu trúc dữ liệu đầu vào trước khi ghi đè vào file `db.json`.

### 2.12. Tin nhắn chat không được lọc mã độc hại (XSS Vulnerability)
*   **Vị trí:** `server.ts` (dòng 1343-1371) và giao diện hiển thị tin nhắn.
*   **Chi tiết:** Nội dung tin nhắn chat lưu thẳng vào database và render trực tiếp ra giao diện mà không có bộ lọc ký tự đặc biệt.
*   **Mối nguy hại:** Nếu kẻ xấu gửi tin nhắn chứa thẻ `<script>`, họ có thể thực thi mã độc trên trình duyệt của các nhân viên khác khi họ mở tab Chat.
*   **Cách khắc phục:** Escape ký tự HTML ở frontend hoặc dùng thư viện `DOMPurify` trước khi hiển thị tin nhắn.

---

## 3. LỖI LOGIC XỬ LÝ & NGHIỆP VỤ

Mã nguồn hiện tại có 10 lỗi logic xử lý nghiệp vụ có thể gây sai lệch số liệu hoặc xung đột dữ liệu.

### 3.1. Cập nhật trạng thái công việc (Task) ở hai nơi khác nhau
*   **Vị trí:** `server.ts` dòng 627 (`PUT /api/tasks/:id`) và dòng 696 (`POST /api/tasks/:id/updates`)
*   **Chi tiết:** Cả hai endpoint này đều có code thay đổi thuộc tính `status` của Task. Việc này dễ dẫn đến không thống nhất lịch sử cập nhật (`TaskUpdate`) hoặc bắn thông báo trùng lặp.
*   **Cách khắc phục:** Quy định rõ endpoint `PUT /api/tasks/:id` dùng để chỉnh sửa thông tin chung (tên, mô tả, phân công), còn việc chuyển trạng thái tiến độ phải thông qua endpoint ghi nhận lịch sử updates.

### 3.2. Sai sót trong thứ tự ưu tiên toán tử kiểm tra quyền (Operator Precedence)
*   **Vị trí:** `server.ts` (dòng 513)
*   **Chi tiết:** Điều kiện kiểm tra quyền xem công việc viết như sau:
    ```typescript
    if (req.role?.id === 'role-staff' || ... || req.role?.permissions.includes('tasks.view_own') && !req.role?.permissions.includes('tasks.view_all'))
    ```
*   Toán tử `&&` có độ ưu tiên cao hơn `||`. Do đó biểu thức trên sẽ hiểu sai logic mong muốn.
*   **Cách khắc phục:** Thêm dấu ngoặc đơn rõ ràng để gom nhóm logic kiểm tra quyền riêng:
    ```typescript
    if (req.role?.id === 'role-staff' || ... || (req.role?.permissions.includes('tasks.view_own') && !req.role?.permissions.includes('tasks.view_all')))
    ```

### 3.3. Lỗi xử lý khi truyền trạng thái đơn hàng không hợp lệ
*   **Vị trí:** `server.ts` (dòng 447-455)
*   **Chi tiết:** Khi client gửi một trạng thái không tồn tại (ví dụ: `xyz`), hàm `indexOf` trả về `-1`. Phép so sánh `newIdx < oldIdx` (tức `-1 < -1`) trả về `false`, vượt qua bộ lọc kiểm tra đi lùi trạng thái và ghi đè trạng thái sai vào database.
*   **Cách khắc phục:** Kiểm tra trạng thái mới gửi lên có nằm trong danh sách các trạng thái hợp lệ của đơn hàng hay không trước khi xử lý tiếp.

### 3.4. State cục bộ trong `Orders.tsx` không được gửi lên API
*   **Vị trí:** `Orders.tsx` (dòng 75-76)
*   **Chi tiết:** Giao diện khai báo hai state `packagePrice` và `depositAmount` để người dùng nhập giá gói dịch vụ và tiền cọc, nhưng khi gọi API tạo đơn hàng mới, hai giá trị này lại bị bỏ quên không đính kèm vào request body.
*   **Cách khắc phục:** Bổ sung các tham số tương ứng vào payload gửi lên API của backend.

### 3.5. Biểu đồ Gantt bị tính sai vị trí hiển thị ở chế độ "Tuần"
*   **Vị trí:** `Dashboard.tsx` (dòng 435-436)
*   **Chi tiết:** Biểu đồ Gantt tự động tính toán phần trăm chiều rộng và lề trái dựa vào hằng số chia cho `30` (ngày):
    ```typescript
    const leftPercent = (startIdx / 30) * 100;
    const widthPercent = ((endIdx - startIdx + 1) / 30) * 100;
    ```
*   Khi người dùng chuyển sang xem theo **Tuần** (chỉ có 7 ngày hiển thị), công thức vẫn chia cho 30 khiến thanh tiến độ bị co nhỏ lại và lệch vị trí nghiêm trọng.
*   **Cách khắc phục:** Thay số `30` bằng độ dài thực tế của danh sách ngày hiển thị: `dateRange.length`.

### 3.6. Dữ liệu trong `db.json` bị lỗi mã hóa font chữ (Encoding)
*   **Vị trí:** `db.json` (dòng 413-414)
*   **Chi tiết:** Tên gói dịch vụ mẫu hiển thị ký tự lạ: `"package_name": "Gi Th? Nghi?m T?i Gi?n"`.
*   **Cách khắc phục:** Sửa lại nội dung thành `"Gói Thử Nghiệm Tối Giản"` và đảm bảo trình soạn thảo lưu file ở định dạng UTF-8.

### 3.7. Tham số điều hướng (`navigationArg`) bị reset quá sớm
*   **Vị trí:** `App.tsx` (dòng 161-163)
*   **Chi tiết:** Khi chuyển tab, `useEffect` lập tức reset `navigationArg` về `null`. Điều này khiến trang đích không kịp nhận diện được tham số điều hướng (ví dụ như ID đơn hàng cần mở chi tiết).
*   **Cách khắc phục:** Chỉ thực hiện reset tham số sau khi component con đã nhận diện và xử lý xong dữ liệu đầu vào đó.

### 3.8. Cho phép chỉnh sửa đơn hàng đã hoàn thành (`delivered`)
*   **Vị trí:** `server.ts` (dòng 410-428)
*   **Chi tiết:** Đơn hàng đã bàn giao hoàn tất vẫn có thể sửa đổi tùy ý các thông tin nhạy cảm.
*   **Cách khắc phục:** Chặn mọi thao tác chỉnh sửa đối với các đơn hàng có trạng thái `delivered` hoặc `cancelled`, trừ phi người thực hiện có quyền Quản trị viên (Admin).

### 3.9. Trạng thái đơn hàng "cancelled" bị ghi đè lặp đi lặp lại
*   **Vị trí:** `server.ts` (dòng 430-475)
*   **Chi tiết:** Một đơn hàng đã bị hủy vẫn tiếp tục cho phép gửi yêu cầu hủy nhiều lần, tạo ra hàng loạt các dòng lịch sử trùng lặp vô nghĩa.
*   **Cách khắc phục:** Thêm kiểm tra nếu đơn hàng hiện tại có trạng thái là `cancelled` thì từ chối tiếp nhận các yêu cầu thay đổi trạng thái khác.

### 3.10. Thông báo chung không tự động đánh dấu đã đọc
*   **Vị trí:** `server.ts` (dòng 1200-1211)
*   **Chi tiết:** Các thông báo hệ thống chung (gửi tới mọi nhân viên, có `receiver_id = null`) không tự động lưu vết xem của từng cá nhân vào danh sách `is_read_by`. Kết quả là các thông báo này luôn hiển thị trạng thái "Mới" (chưa đọc) trên màn hình của nhân viên.
*   **Cách khắc phục:** Bổ sung API cập nhật mảng `is_read_by` chứa ID người dùng khi họ mở xem thông báo.

---

## 4. VẤN ĐỀ VỀ HIỆU NĂNG & KIẾN TRÚC

### 4.1. Polling API với tần suất quá cao gây nghẽn mạng
*   **Vị trí:** `App.tsx` (mỗi 10s), `Chat.tsx` (mỗi 3s), `Notifications.tsx` (mỗi 10s).
*   **Chi tiết:** Ứng dụng liên tục gửi request dạng kéo (polling) để cập nhật thông tin mới. Nếu có 10 nhân viên cùng mở trình duyệt, server phải xử lý hàng chục request mỗi giây một cách vô ích.
*   **Cách khắc phục:** Thay thế cơ chế polling bằng **WebSocket** (sử dụng thư viện `socket.io`) hoặc giảm tần suất polling của Chat lên 10-15 giây.

### 4.2. Không phân trang dữ liệu (No Pagination)
*   **Chi tiết:** Toàn bộ dữ liệu khách hàng, đơn hàng, tác vụ đều được API trả về 100% trong một lần gọi. Khi hệ thống chạy lâu dài, lượng dữ liệu lên tới hàng ngàn bản ghi sẽ khiến ứng dụng load cực kỳ chậm và tốn tài nguyên trình duyệt.
*   **Cách khắc phục:** Bổ sung tham số `page` và `limit` vào các API lấy danh sách.

### 4.3. Cơ sở dữ liệu file JSON (`db.json`) dễ bị ghi đè dữ liệu (Race Condition)
*   **Chi tiết:** Express đọc/ghi trực tiếp vào file JSON. Nếu hai nhân viên cùng thực hiện lưu thông tin tại một thời điểm rất gần nhau, dữ liệu của người ghi trước sẽ bị đè mất.
*   **Cách khắc phục:** Chuyển sang sử dụng các hệ quản trị cơ sở dữ liệu thực thụ như **SQLite** (cho gọn nhẹ) hoặc **PostgreSQL** để hỗ trợ truy cập đồng thời an toàn.

### 4.4. Tải lại toàn bộ dữ liệu ở Frontend khi đổi bộ lọc
*   **Chi tiết:** Mỗi lần người dùng chọn bộ lọc (Filter) khác nhau trên giao diện, frontend lại thực hiện gọi lại toàn bộ các API lấy danh sách thay vì lọc trực tiếp trên dữ liệu đã được lưu ở local cache.
*   **Cách khắc phục:** Lọc dữ liệu ngay tại client nếu danh sách nhỏ, hoặc tối ưu hóa cơ chế cache dữ liệu (ví dụ sử dụng `React Query` / `TanStack Query`).

---

## 5. CODE THỪA & CHẤT LƯỢNG MÃ NGUỒN

### 5.1. Trùng lặp dữ liệu mẫu (Seed Data)
*   **Vị trí:** `src/db_service.ts` chứa hơn 350 dòng code để định nghĩa dữ liệu ban đầu trùng khít với nội dung trong file `db.json`.
*   **Giải pháp:** Chỉ nên giữ dữ liệu mẫu này trong một file seed riêng biệt, không nên nhúng trực tiếp trong code service chạy hàng ngày.

### 5.2. Các file rác không được sử dụng
*   **Tên file:** `data_mi.xlsx` (File Excel gốc ở thư mục dự án), `metadata.json` (Chứa cấu hình cũ của Google AI Studio).
*   **Giải pháp:** Xóa bỏ để tránh làm nặng mã nguồn khi đẩy lên Git.

### 5.3. Import các thư viện/icon không dùng
*   **Chi tiết:** Nhiều file như `Dashboard.tsx`, `Orders.tsx`, `Tasks.tsx` import các icon từ `lucide-react` (như `Shirt`, `Sparkles`) nhưng không sử dụng ở phần hiển thị.
*   **Giải pháp:** Sử dụng ESLint hoặc chức năng dọn dẹp import của VS Code để xóa bỏ.

### 5.4. Các file component giao diện quá lớn
*   **Chi tiết:** `Dashboard.tsx`, `Objectives.tsx`, `Orders.tsx` đều có kích thước lớn hơn 1000 dòng code. Điều này gây khó khăn cho việc bảo trì và đọc hiểu logic.
*   **Giải pháp:** Chia nhỏ các component lớn này thành các sub-components (ví dụ: `DashboardStats`, `GanttChart`, `OrderForm`).

### 5.5. Cấu hình trùng lặp CSS
*   **Chi tiết:** Dự án sử dụng Tailwind CSS v4 thông qua `@tailwindcss/vite` nhưng trong file `package.json` vẫn cài đặt thêm `autoprefixer` và cấu hình bổ sung không cần thiết ở file cấu hình cũ.

---

## 6. LỘ TRÌNH ĐỀ XUẤT SỬA CHỮA KHI VỀ NHÀ

Để bạn tranh thủ thời gian tự làm ở nhà, chúng tôi đề xuất lộ trình sửa lỗi theo thứ tự ưu tiên sau:

### Bước 1: Khắc phục các lỗi bảo mật cấp bách (1 - 2 tiếng)
1.  Cài đặt thư viện mã hóa: `npm install bcryptjs` và cài đặt types `@types/bcryptjs -D`.
2.  Sửa code trong `server.ts` để hash mật khẩu khi đăng ký/tạo user và sử dụng hàm compare khi đăng nhập.
3.  Xóa hoàn toàn danh sách các nút đăng nhập nhanh (Quick Login) trong `App.tsx`.
4.  Cập nhật API `/api/database/export` để ẩn đi trường `password_hash`.

### Bước 2: Sửa các lỗi logic hiển thị & nghiệp vụ (1 tiếng)
1.  Mở `Dashboard.tsx`, tìm công thức tính của biểu đồ Gantt và thay hằng số `30` bằng `dateRange.length`.
2.  Cập nhật API thay đổi trạng thái đơn hàng để loại bỏ lỗi xử lý đi lùi trạng thái bằng cách thêm kiểm tra `status` gửi lên có hợp lệ hay không.
3.  Sửa lỗi độ ưu tiên toán tử kiểm tra quyền của nhân viên staff trong `server.ts` bằng dấu ngoặc đơn `()`.

### Bước 3: Dọn dẹp mã nguồn (30 phút)
1.  Xóa các file dư thừa không dùng như `metadata.json`.
2.  Tối ưu hóa các gói phụ thuộc (Dependencies) trong `package.json` (xóa `@google/genai` nếu không dùng).

---
*Chúc bạn hoàn thành tốt dự án khi về nhà! Nếu có khó khăn gì, hãy mở lại phiên làm việc tiếp theo.*
