# Studio Management App (Studio V2)

Đây là ứng dụng quản lý hoạt động Studio chụp ảnh cưới (**The Will Studio** / **Aura Bridal Studio**), phát triển trên nền tảng React, Express.js và TypeScript.

Dự án này được thiết kế để quản lý khách hàng, lịch trình chụp ảnh, quản lý tác vụ công việc của nhân viên, hệ thống trao đổi nội bộ (Chat) và theo dõi tiến độ mục tiêu (OKR).

---

## 📋 Tài liệu & Báo cáo Quan trọng

Trước khi tiến hành phát triển hoặc sửa đổi dự án này, vui lòng đọc kỹ tài liệu báo cáo kiểm tra mã nguồn sau:
👉 **[Báo cáo toàn diện về mã nguồn & các lỗi bảo mật (BAO_CAO.md)](file:///c:/Users/ROYAL%20PALACE/Desktop/STUDIO%20V2/BAO_CAO.md)**

*Tài liệu trên chứa danh sách chi tiết 37 lỗi bảo mật nghiêm trọng, lỗi logic nghiệp vụ, hiệu năng và code thừa cần được khắc phục trước khi ứng dụng hoạt động thực tế.*

---

## 🛠️ Hướng dẫn cài đặt & Chạy ứng dụng locally

### Yêu cầu hệ thống
*   **Node.js** (Phiên bản v18 trở lên)
*   **npm** hoặc **yarn**

### Các bước khởi chạy
1.  **Cài đặt các gói phụ thuộc (dependencies):**
    ```bash
    npm install
    ```

2.  **Cấu hình biến môi trường:**
    *   Tạo file `.env` hoặc `.env.local` ở thư mục gốc (xem mẫu tại `.env.example`).
    *   Cấu hình các tham số cần thiết như `GEMINI_API_KEY`, `PORT` (mặc định là `5000`), v.v.

3.  **Khởi động máy chủ phát triển (Development Server):**
    ```bash
    npm run dev
    ```
    *Lệnh này sẽ khởi chạy đồng thời server backend Express.js (thông qua `tsx`) và server frontend Vite.*

4.  **Truy cập ứng dụng:**
    Mở trình duyệt và truy cập: [http://localhost:5173](http://localhost:5173) (hoặc cổng được hiển thị ở terminal).

---

## 📦 Các Scripts chính trong `package.json`

*   `npm run dev`: Chạy ứng dụng ở chế độ phát triển (hot-reload).
*   `npm run build`: Tạo bản build production cho cả client (Vite) và server (Esbuild).
*   `npm run start`: Khởi động ứng dụng bằng bản build production.
*   `npm run clean`: Dọn dẹp thư mục build `dist`.
*   `npm run lint`: Kiểm tra lỗi TypeScript mà không phát sinh file build.
