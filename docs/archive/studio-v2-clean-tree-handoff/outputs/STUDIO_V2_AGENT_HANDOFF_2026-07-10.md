# STUDIO V2 Agent Handoff - 2026-07-10

## Repo chính xác

Tiếp tục làm việc duy nhất trong repo:

`/Users/mac/Documents/STUDIO_V2_GITHUB_MAIN`

GitHub remote:

`git@github.com:vinhle158/weddingstudiov2.git`

Branch local hiện tại:

`main`

Không dùng các workspace cũ:

- `/Users/mac/Documents/STUDIO V2`
- `/Users/mac/Desktop/weddingstudiov2-main`

## Ràng buộc quan trọng

- Không sửa source trực tiếp trên server.
- Không tự commit, push hoặc deploy nếu người dùng chưa yêu cầu rõ.
- Không revert working tree hiện tại. Repo đang có nhiều thay đổi local có chủ đích.
- Không đổi database chính về `db.json`.
- Không khôi phục MiMo/Gemini/LLM runtime.
- Không đưa secret thật vào repo.
- Nếu deploy production, cần xử lý Prisma schema có `User.session_version`: chạy `npx prisma db push` hoặc migration tương ứng theo quy trình deploy.

## Base commit trước chuỗi hardening

`5c47e6927774cfef5ffbc706b76bfb9fd3dcb469`

Tất cả thay đổi hiện vẫn là local working tree, chưa commit/push/deploy.

## Các thay đổi chính đã có trong working tree

1. Bỏ runtime LLM/MiMo/Gemini khỏi chatbot/settings/schema/env/docker.
2. Settings/export/import/backup strip legacy LLM keys.
3. Không trả `password_hash` qua auth/user APIs.
4. `/api/users` cần quyền `users.manage`.
5. Logout/password change/deactivate dùng `session_version` để invalidate JWT.
6. Thêm `User.session_version` vào Prisma schema.
7. Tests không cần `DATABASE_URL`, không khởi tạo Vite middleware trong test, tự thoát sạch.
8. Seed passwords không còn hardcode trong source chính; dùng `SEED_ADMIN_PASSWORD` / `SEED_SALES_PASSWORD`, dev thiếu env thì sinh random ephemeral.
9. `docker-compose.prod.yml` dùng `${POSTGRES_PASSWORD}` và `${JWT_SECRET}`, không còn `production_password` hoặc env LLM cũ.
10. JWT dev fallback dùng ephemeral random key.
11. CSP bật cho production.
12. `/api/system/status` cần `users.manage`, production response giảm thông tin.
13. Backup restore/delete validate path traversal.
14. Thêm `/healthz` public hẹp và Docker healthcheck.
15. Dọn password mẫu trong tracked backup/mockup files.
16. Dọn cây thư mục: markdown/html phụ đã gom vào `docs/archive/`.

## File markdown/html đã gom vào

`/Users/mac/Documents/STUDIO_V2_GITHUB_MAIN/docs/archive/`

Giữ lại không di chuyển:

- `README.md`
- `index.html`
- `demo.html` vì `vite.config.ts` dùng làm build entry
- `design/*`
- `dist/*`

## Trạng thái kiểm tra mới nhất trong phiên này

Đã chạy tại:

`/Users/mac/Documents/STUDIO_V2_GITHUB_MAIN`

### `git status --short --branch`

Kết quả tóm tắt:

- Branch: `## main...origin/main`
- Có nhiều file modified/deleted/new đúng với chuỗi hardening và gom tài liệu.
- Có `?? docs/` và `?? tests/`.
- Không được tự revert các thay đổi này.

Các nhóm thay đổi nổi bật:

- Modified: `.env.example`, `Dockerfile`, `README.md`, `backups/backup_1783303185069_bak-pi8loge.json`, `docker-compose.prod.yml`, `package.json`, `prisma/schema.prisma`, `seed_all_mock_data.ts`, `server.ts`, `src/components/Settings.tsx`, `src/db_service.ts`
- Deleted ở root/public do gom archive: nhiều file `.md`/`.html` cũ như `AGENT_CODING_GUIDE.md`, `BAO_CAO.md`, `BUG_REPORT.md`, `public/fullapp_mockup.html`, v.v.
- New: `docs/`, `tests/`

### Markdown/HTML còn ở tầng ngoài

Lệnh:

`find . -maxdepth 2 -type f \( -name '*.md' -o -name '*.html' \) | sort`

Kết quả:

```text
./README.md
./demo.html
./design/wizard-mockup-v2.html
./design/wizard-mockup.html
./dist/demo.html
./dist/index.html
./index.html
```

### Verify commands

`npm run lint`: pass

`npm run build`: pass

Ghi chú build: Vite có warning chunk lớn hơn 500 kB, nhưng build thành công.

`npm test`: pass

Kết quả test:

```text
tests 11
pass 11
fail 0
```

Ghi chú test: vẫn in stack log cho case path traversal cố ý trong backup restore/delete, nhưng test pass. Đây là behavior đã biết từ phiên trước.

## Việc nên làm tiếp theo

Hỏi người dùng muốn bước nào:

1. Review diff trước khi commit.
2. Commit local changes.
3. Push lên GitHub.
4. Chuẩn bị deploy.

Nếu người dùng yêu cầu review diff, bắt đầu bằng:

```bash
cd /Users/mac/Documents/STUDIO_V2_GITHUB_MAIN
git diff --stat
git diff -- . ':!dist'
```

Nếu người dùng yêu cầu commit/push, trước tiên nên chạy lại:

```bash
cd /Users/mac/Documents/STUDIO_V2_GITHUB_MAIN
npm run lint
npm run build
npm test
git status --short --branch
```

Sau đó tạo commit có nội dung tập trung vào security hardening, cleanup legacy LLM runtime, backup path validation, and production config hygiene.

## Cấm làm ngoài yêu cầu

- Không deploy production khi chưa có lệnh rõ.
- Không chạy command phá hủy working tree như `git reset --hard`, `git checkout --`, `git clean`.
- Không tự sửa thêm scope lớn nếu người dùng chỉ yêu cầu context/review.
- Không tạo secret, password thật, token thật trong file tracked.
