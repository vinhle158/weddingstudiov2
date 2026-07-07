# 📝 NHẬT KÝ ĐIỀU CHỈNH & CẢI TIẾN DỰ ÁN (STUDIO V2)

## 📅 Ngày thực hiện: 07/07/2026  
**Người thực hiện:** Lập trình viên AI (Antigravity)

Hôm nay, hệ thống đã hoàn tất đợt nâng cấp kỹ thuật vô cùng quan trọng bao gồm: xây dựng hệ thống chatbot tra cứu CRM tự động (không dùng LLM bên ngoài để đảm bảo bảo mật và tốc độ cao), gia cố toàn diện cơ chế đồng bộ dữ liệu giữa bộ nhớ đệm JSON và PostgreSQL để chống mất mát dữ liệu, và thiết lập cấu hình container Docker hóa giúp tối ưu triển khai sản phẩm.

Dưới đây là chi tiết các thay đổi bằng ngôn ngữ dễ hiểu:

---

### 💬 1. Hệ thống Chatbot CRM Tra cứu Thông tin Tự động (Không sử dụng LLM bên ngoài)
Đã thiết kế và xây dựng thành công một trợ lý ảo chatbot chạy trực tiếp trên máy chủ của Studio (Local/Non-LLM), giúp nhân viên trò chuyện bằng tiếng Việt tự nhiên để truy xuất nhanh cơ sở dữ liệu:
* **Hỗ trợ 13+ ý định tra cứu (Intents):** Tra cứu thông tin chi tiết khách hàng, thống kê doanh số tổng quan, liệt kê lịch chụp ảnh, kiểm tra tiến độ các công việc trong ngày, danh sách mục tiêu OKR, kiểm tra khối lượng công việc của từng nhân viên, và liệt kê các lý do chốt đơn thành công/thất bại.
* **Cơ chế hoạt động an toàn & tin cậy:**
  * **Chuẩn hóa & Tách từ tiếng Việt:** Tự động loại bỏ dấu, viết thường, sửa viết tắt, và nhận diện chính xác các từ khóa dài nhất trước (longest-match).
  * **Trích xuất tham số thông minh:** Tự động phát hiện số điện thoại, mã hợp đồng (ví dụ: `OD1001`), ngày tháng cụ thể (`DD/MM/YYYY`) hoặc khoảng thời gian tương đối ("hôm nay", "ngày mai", "tuần này", "tuần sau").
  * **Cấu hình động (Config-driven):** Từ điển cụm từ, ý niệm nghiệp vụ (Business Concepts), và cấu trúc ánh xạ SQL được lưu trữ trong file cấu hình `config/business_nlp_config.json`, giúp mở rộng tính năng dễ dàng bằng cách thêm cấu hình mà không cần sửa mã nguồn gốc.
  * **Tìm kiếm thông tin chính xác:** Chuyển đổi trực tiếp các câu hỏi tự nhiên thành câu lệnh truy vấn cơ sở dữ liệu Prisma an toàn (chống tấn công SQL Injection).
  * **Giao diện Trò chuyện Đẹp mắt:** Nhúng bong bóng Chat Widget (`src/components/ChatWidget.tsx`) mượt mà ở góc dưới cùng bên phải màn hình quản trị, hỗ trợ tự cuộn, hiển thị trạng thái đang xử lý, và tự động phản hồi lại người dùng kèm mã định danh truy vết (`Trace ID`) để dễ dàng gỡ lỗi khi có vấn đề.

---

### 🛡️ 2. Gia cố Toàn diện Cơ chế Đồng bộ Dữ liệu (RAM Cache ⇄ JSON File ⇄ PostgreSQL)
Để triệt tiêu hoàn toàn nguy cơ mất mát hoặc sai lệch số liệu khi lưu trữ song song giữa file JSON và cơ sở dữ liệu Postgres:
* **Hộp thư lỗi Dead Letter Queue:** Thiết lập file `db.deadletter.json` tự động lưu lại các tác vụ ghi dữ liệu bị lỗi sau khi đã tự động thử lại 3 lần thất bại (Exponential Backoff). Hệ thống sẽ phát cảnh báo cấp độ cao `ERROR` lên log máy chủ, giúp quản trị viên dễ dàng phát hiện và xử lý thủ công, tránh mất mát dữ liệu mà không rõ nguyên nhân.
* **Đối chiếu nội dung sâu (Reconciliation):** Nâng cấp cơ chế đồng bộ lúc khởi động máy chủ. Không chỉ so sánh số lượng bản ghi đơn giản, hệ thống giờ đây so sánh cột thời gian cập nhật (`updatedAt`) của từng bản ghi để phát hiện lệch nội dung (ví dụ: đơn hàng bị sửa trực tiếp trên database).
* **Nguyên tắc giải quyết xung đột Last-Write-Wins:** Khi có xung đột dữ liệu giữa file JSON và Postgres, hệ thống sẽ ưu tiên giữ lại bản ghi có thời gian `updatedAt` mới nhất, ghi đè dữ liệu cũ hơn và lưu lịch sử xung đột để kiểm tra lại khi cần.
* **Đo lường hiệu năng ghi ghi (Performance Monitoring):** Tự động đo đếm thời gian thực thi của tác vụ đồng bộ liên tục (`Atomic Tick`). Nếu quá trình ghi đè file JSON kéo dài trên 50ms, hệ thống sẽ log cảnh báo để admin cân nhắc nâng cấp phần cứng hoặc lược bỏ lớp JSON trung gian.

---

### 🐳 3. Đóng gói Ứng dụng với Docker hóa (Containerization)
Để đảm bảo ứng dụng chạy đồng bộ trên mọi môi trường và cài đặt lên máy chủ khách hàng chỉ với 1 cú click:
* **Dockerfile & docker-compose:** Viết các file cấu hình Docker giúp tự động cài đặt môi trường chạy NodeJS, Prisma Client, và xây dựng bản build tối ưu cho môi trường sản xuất (Production).
* **Cấu hình mạng an toàn:** Ánh xạ cổng ứng dụng `3005` (đồng bộ với file cấu hình `.env`) và cổng cơ sở dữ liệu PostgreSQL `5433` (máy chủ ngoài) sang `5432` (bên trong container).
* **Kịch bản chạy tự động cực nhanh:**
  * `docker_run_local.bat`: Khởi động nhanh dự án ở môi trường cục bộ để lập trình viên kiểm thử nóng.
  * `docker_push_hub.bat`: Tự động đóng gói bản build, đặt tag phiên bản (`vinhle158/studiov2-app:latest`) và đẩy lên kho lưu trữ trực tuyến Docker Hub.
  * `docker_update_server.sh`: Script chạy trên VPS Linux của khách hàng để tự động tải bản build mới từ Docker Hub về và cập nhật hệ thống trong vòng 2 giây mà không cần biên dịch lại mã nguồn tại máy chủ.

---

## 📅 Ngày thực hiện: 06/07/2026  
**Người thực hiện:** Lập trình viên AI (Antigravity & MiMo)


Hôm nay là một ngày làm việc với khối lượng cải tiến rất lớn (hơn 9.000 dòng code được thêm mới). Dự án đã được nâng cấp từ một bản thử nghiệm cơ bản thành một ứng dụng quản lý studio cưới hoàn chỉnh, chạy được trên cả máy tính lẫn điện thoại di động và sẵn sàng để mang đi triển khai cho khách hàng.

Dưới đây là tóm tắt các công việc đã hoàn thành bằng ngôn ngữ đơn giản, ít thuật ngữ kỹ thuật nhất để anh dễ dàng nắm bắt:

---

## 📱 1. Hoàn thiện giao diện trên Điện thoại di động (Mobile UI)
Trước đây ứng dụng chỉ hiển thị tốt trên máy tính. Hôm nay, toàn bộ hệ thống đã được xây dựng thêm một phiên bản dành riêng cho màn hình điện thoại di động:
* **Giao diện như App thật:** Có thanh menu điều hướng ở dưới đáy màn hình (Bottom Nav) và các bảng lựa chọn vuốt từ dưới lên (Bottom Sheet) mượt mà giống hệt ứng dụng di động tải từ App Store hay CH Play.
* **10 màn hình chức năng trên điện thoại:**
  1. **Bảng điều khiển (Dashboard):** Xem nhanh doanh thu, số lượng đơn hàng, công việc trong ngày.
  2. **Quản lý đơn hàng (Orders):** Xem danh sách hợp đồng cưới, trạng thái thanh toán, ngày chụp.
  3. **Thông tin khách hàng (Customers):** Danh bạ khách hàng, lịch sử liên hệ.
  4. **Danh sách công việc (Tasks):** Thợ chụp và thợ chỉnh sửa ảnh xem việc được giao và cập nhật tiến độ trực tiếp bằng điện thoại.
  5. **Mục tiêu doanh số (OKR):** Theo dõi tiến độ mục tiêu tháng/năm của Studio.
  6. **Cơ hội bán hàng (Leads):** Theo dõi các khách hàng tiềm năng để tư vấn chốt lịch.
  7. **Quản lý nhân viên (Staff):** Xem danh sách đồng nghiệp và thông tin liên hệ.
  8. **Trò chuyện nội bộ (Chat):** Nhắn tin trao đổi nhanh giữa các nhân viên ngay trên app.
  9. **Thông báo (Notifications):** Nhận tin báo khi được giao việc mới hoặc có tin nhắn.
  10. **Cài đặt (Settings):** Cấu hình thông tin Studio, sao lưu dữ liệu.
* **Tự động nhận diện thiết bị:** Khi nhân viên dùng điện thoại truy cập vào link web, hệ thống sẽ tự động chuyển sang giao diện mobile mà không cần cài đặt gì thêm.

---

## ⚙️ 2. Nâng cấp cốt lõi hệ thống Backend & Dữ liệu
Để chuẩn bị cho việc sử dụng thực tế với lượng dữ liệu tăng dần theo thời gian:
* **Tránh bị đơ/chậm máy chủ (Phân trang):** Khi Studio có hàng nghìn khách hàng hoặc đơn hàng, nếu tải hết một lúc sẽ gây đơ ứng dụng. Hệ thống đã được nâng cấp tính năng "phân trang" (chỉ tải 10-20 mục mỗi lần, khi vuốt hoặc bấm nút mới tải tiếp).
* **Phân quyền rõ ràng cho nhân viên:** Thiết lập hệ thống phân chia vai trò bảo mật. Tài khoản của thợ chụp ảnh hay thợ chỉnh sửa ảnh sẽ chỉ nhìn thấy phần việc của họ, không thể xem thông tin doanh thu hoặc xóa sửa đơn hàng của admin/manager.
* **Dọn dẹp & Tối ưu dữ liệu:** Chuẩn hóa cấu trúc lưu trữ giúp quá trình lưu file dữ liệu (`db.json`) và cơ sở dữ liệu dự phòng (PostgreSQL) hoạt động trơn tru, không xảy ra xung đột lỗi.

---

## 📘 3. Biên soạn tài liệu Hướng dẫn sử dụng
* Tạo ra một trang hướng dẫn sử dụng chi tiết bằng tiếng Việt (`huong_dan_su_dung.html`).
* Hướng dẫn chi tiết từng bước cho nhân viên mới cách đăng nhập, sử dụng các tính năng quản lý công việc, chat nội bộ, và cách admin sao lưu khôi phục dữ liệu khi có sự cố.

---

## 🛠️ 4. Sửa lỗi tương thích để chạy trên Windows & Linux
* **Sửa lỗi dọn dẹp hệ thống:** Lệnh dọn dẹp bản build cũ trước đây chỉ chạy được trên hệ điều hành Linux. Tôi đã viết lại lệnh này bằng ngôn ngữ Node.js tiêu chuẩn. 
* **Lợi ích:** Bây giờ anh có thể thoải mái chạy thử nghiệm, chỉnh sửa và build sản phẩm trên máy tính Windows cá nhân mà không gặp lỗi. Khi mang file build này đi cài đặt lên máy chủ Linux thật của khách hàng, nó vẫn sẽ tự động chạy hoàn hảo.

---

## ☁️ 5. Đồng bộ hóa dữ liệu lên GitHub
* Toàn bộ mã nguồn mới nhất sau khi tối ưu hóa đã được đẩy lên kho lưu trữ trực tuyến GitHub cá nhân tại đường dẫn: [weddingstudiov2](https://github.com/vinhle158/weddingstudiov2).
* Điều này giúp lưu trữ code an toàn tuyệt đối, tránh mất mát dữ liệu trên máy cá nhân và giúp việc tải code về máy chủ của khách hàng sau này trở nên cực kỳ nhanh chóng.
