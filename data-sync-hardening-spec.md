# Đặc tả kỹ thuật: Hoàn thiện cơ chế đồng bộ dữ liệu (RAM Cache → JSON → PostgreSQL)

> Tài liệu này bổ sung cho 4 giải pháp đã triển khai (Atomic Write, Retry + Backoff,
> Reconcile khi Startup, Atomic Tick). Mục tiêu: vá 3 lỗ hổng còn sót lại đã được
> xác định trong quá trình review.

---

## 1. Xử lý khi Retry thất bại hoàn toàn (Dead Letter Queue)

### Vấn đề hiện tại
Sau khi retry tối đa 3 lần (Exponential Backoff) mà vẫn lỗi, chưa rõ dữ liệu đó
đi về đâu — có khả năng bị **âm thầm bỏ qua**, dẫn đến mất dữ liệu vĩnh viễn mà
không ai biết.

### Yêu cầu cần thực thi
1. Tạo một file `db.deadletter.json` (hoặc bảng riêng) để lưu các thao tác ghi
   thất bại sau khi hết số lần retry.
2. Mỗi bản ghi trong dead-letter cần có: `operation` (create/update/delete),
   `table`, `payload`, `error_message`, `failed_at`, `retry_count`.
3. Viết một endpoint hoặc script (`/api/admin/sync-status` hoặc CLI) để:
   - Liệt kê các bản ghi đang ở trạng thái dead-letter.
   - Cho phép **thử lại thủ công** sau khi khắc phục nguyên nhân lỗi.
4. Ghi log cảnh báo mức độ **ERROR** (không phải WARN) mỗi khi có bản ghi rơi
   vào dead-letter, để dễ phát hiện qua hệ thống giám sát log.

### Tiêu chí hoàn thành
- Không có trường hợp nào dữ liệu bị mất mà không để lại dấu vết truy xuất được.
- Có thể trả lời được câu hỏi: "tại một thời điểm bất kỳ, có bao nhiêu bản ghi
  đang chưa đồng bộ thành công với Postgres?"

---

## 2. Reconcile theo nội dung, không chỉ theo số lượng

### Vấn đề hiện tại
Cơ chế đối chiếu (reconcile) lúc khởi động hiện chỉ so sánh **số lượng bản ghi
hoặc cấu trúc**. Điều này không phát hiện được trường hợp số lượng bản ghi
trùng khớp nhưng **nội dung một bản ghi cụ thể bị lệch** (ví dụ: giá đơn hàng
khác nhau giữa JSON và Postgres).

### Yêu cầu cần thực thi
1. Đảm bảo mọi model chính (Order, Customer, Task, ...) đều có trường
   `updatedAt` (timestamp) được cập nhật ở **mọi** thao tác ghi, không ngoại lệ.
2. Khi `initialize()` chạy đối chiếu, với mỗi bản ghi trùng `id` giữa JSON và
   Postgres:
   - So sánh `updatedAt` của hai bên.
   - Nếu khác nhau, xử lý theo quy tắc ở mục 3 (không tự ý ghi đè ngẫu nhiên).
3. Với các bản ghi chỉ tồn tại ở một bên (có ở JSON nhưng không có ở Postgres,
   hoặc ngược lại), cần liệt kê ra và xử lý riêng — không được coi là "khớp"
   chỉ vì tổng số lượng bằng nhau.
4. Ghi log chi tiết kết quả đối chiếu mỗi lần khởi động: số bản ghi khớp, số
   bản ghi lệch nội dung, số bản ghi chỉ có ở một bên.

### Tiêu chí hoàn thành
- Đối chiếu phát hiện được cả trường hợp "lệch nội dung nhưng bằng số lượng".
- Có log rõ ràng, xem lại được sau mỗi lần server khởi động.

---

## 3. Quy tắc xử lý xung đột (Conflict Resolution Rule)

### Vấn đề hiện tại
Chưa có quy tắc rõ ràng khi `db.json` và PostgreSQL **cùng có thay đổi độc
lập** trong lúc mất đồng bộ (ví dụ: server tắt, hoặc có người sửa trực tiếp
trên Postgres bằng công cụ khác). Nếu đối chiếu sai chiều, có thể vô tình ghi
đè mất dữ liệu mới hơn.

### Yêu cầu cần thực thi
1. Áp dụng quy tắc **Last-Write-Wins theo `updatedAt`**:
   - Bên nào có `updatedAt` mới hơn thì được giữ lại làm dữ liệu chuẩn.
   - Bên còn lại được ghi đè theo bên thắng.
2. Trường hợp `updatedAt` bằng nhau hoặc không xác định được (dữ liệu cũ thiếu
   trường này) → **không tự động ghi đè**. Đưa vào danh sách "cần xử lý thủ
   công" và ghi log cảnh báo, thay vì đoán bừa.
3. Ghi lại lịch sử xung đột đã xảy ra (bảng `sync_conflict_log` hoặc file
   tương tự) gồm: `record_id`, `table`, `json_updated_at`, `postgres_updated_at`,
   `resolution` (bên nào thắng), `resolved_at`. Việc này giúp truy vết về sau
   nếu phát hiện dữ liệu bất thường.

### Tiêu chí hoàn thành
- Không còn tình huống hệ thống "đoán" bên nào đúng khi không đủ thông tin.
- Mọi lần xảy ra xung đột đều có thể tra cứu lại được: xảy ra khi nào, xử lý
  ra sao.

---

## 4. Giám sát đánh đổi hiệu năng của Atomic Tick

### Vấn đề hiện tại
Khối lệnh đồng bộ liên tục (không nhường CPU) giúp tránh race condition, nhưng
đổi lại có thể gây nghẽn khi tải cao. Hiện chưa có cách đo lường ảnh hưởng này.

### Yêu cầu cần thực thi
1. Thêm đo thời gian thực thi (`console.time` hoặc middleware đo latency) cho
   mỗi lần chạy khối đồng bộ (đọc → sửa → ghi file).
2. Nếu thời gian thực thi vượt ngưỡng (ví dụ 50ms), ghi log cảnh báo để biết
   khi nào hệ thống bắt đầu chịu áp lực do lượng dữ liệu hoặc tải truy cập
   tăng lên.
3. Cân nhắc thêm giới hạn kích thước file JSON hoặc cảnh báo khi số bản ghi
   trong `LocalDatabase` vượt một ngưỡng nhất định, vì đọc/ghi toàn bộ file
   JSON mỗi lần sẽ càng chậm khi dữ liệu càng lớn.

### Tiêu chí hoàn thành
- Có số liệu thực tế (log) để biết cơ chế này còn chịu tải tốt hay đã đến lúc
  cần đổi giải pháp lưu trữ (ví dụ chuyển hẳn sang ghi trực tiếp Postgres với
  transaction, bỏ lớp JSON trung gian).

---

## Ghi chú khi thực thi

- Ưu tiên thực hiện theo thứ tự: **Mục 2 → Mục 3 → Mục 1 → Mục 4**, vì việc đối
  chiếu đúng nội dung (2) là nền tảng để quy tắc xung đột (3) hoạt động chính
  xác; dead-letter queue (1) là lưới an toàn cuối cùng; giám sát hiệu năng (4)
  có thể làm sau khi các phần an toàn dữ liệu đã ổn định.
- Sau khi triển khai, nên yêu cầu Agent cập nhật lại sơ đồ kiến trúc (phần
  "Cơ chế Đồng bộ") để phản ánh đúng luồng xử lý mới, tránh sơ đồ bị lệch so
  với code thực tế.
