## Mục tiêu

Mô tả ngắn gọn vấn đề và kết quả người dùng nhận được.

## Phạm vi thay đổi

- [ ] Giao diện
- [ ] API hoặc Socket.IO
- [ ] Database hoặc Prisma migration
- [ ] Docker hoặc cấu hình triển khai
- [ ] Tài liệu

## Kiểm tra đã chạy

- [ ] `git diff --check`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm audit --omit=dev`
- [ ] Đã kiểm tra desktop/mobile nếu thay đổi giao diện
- [ ] Đã rehearsal backup/migration nếu thay đổi production

## Rủi ro và rollback

Nêu rõ ảnh hưởng đến dữ liệu, secret, persistent storage, migration và cách rollback.

## Quy ước bắt buộc

- Không chứa `.env`, mật khẩu, token, password hash, backup runtime hoặc dữ liệu khách hàng.
- Không dùng `prisma db push` trên production.
- Không dùng image tag `latest` cho production.
- Chú thích mới viết bằng tiếng Việt có dấu, ngắn gọn và giải thích lý do cần thiết.
