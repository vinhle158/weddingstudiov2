# Khôi phục backup production của Studio V2

Mỗi backup hợp lệ gồm ba file có cùng timestamp:

- `studio_db_<timestamp>.dump.gpg`
- `chat_uploads_<timestamp>.tar.gpg`
- `studio_v2_<timestamp>.sha256`

## Guard trước khi restore

1. Dừng app, giữ PostgreSQL chạy.
2. Sao chép bộ backup vào thư mục tạm mode `0700`.
3. Chạy `sha256sum --check` trước khi giải mã.
4. Giải mã bằng passphrase file production; không nhập key vào command history.
5. Kiểm tra `pg_restore --list` và `tar -tf` trước khi thay dữ liệu.

## Thứ tự restore

1. Restore database vào database rehearsal mới trước.
2. Xác minh số bảng, migration, user quản trị và row count.
3. Giải nén ảnh vào thư mục rehearsal trống, không ghi đè production ngay.
4. Chạy app rehearsal và kiểm tra login, health, attachment.
5. Chỉ sau khi rehearsal đạt mới đổi database/thư mục production theo kế hoạch rollback đã duyệt.

Không xóa database hoặc thư mục ảnh cũ trong cùng lượt restore.
