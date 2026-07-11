# Handoff cho phiên Codex mới - STUDIO V2

**Ngày:** 2026-07-10  
**Repo chuẩn để làm tiếp:** `/Users/mac/Documents/STUDIO_V2_GITHUB_MAIN`  
**GitHub repo:** `git@github.com:vinhle158/weddingstudiov2.git`  
**Branch:** `main`  
**Commit chuẩn hiện tại:** `5c47e6927774cfef5ffbc706b76bfb9fd3dcb469`  
**Commit message:** `feat: migrate database layer to 100% PostgreSQL Active Cache, discard db.json`

## 1. Vì sao tạo phiên mới

Phiên trước bị nhiễu vì có nhiều workspace giống nhau:

- `/Users/mac/Documents/STUDIO V2`: workspace cũ, từng bị stale so với GitHub và có file untracked.
- `/Users/mac/Desktop/weddingstudiov2-main`: checkout cũ dùng trong lần làm AI assistant.
- `/Users/mac/Documents/STUDIO_V2_GITHUB_MAIN`: bản clone sạch mới tạo từ GitHub `main`, dùng làm source chuẩn từ giờ.

Không sửa tiếp trong `/Users/mac/Documents/STUDIO V2` nếu mục tiêu là phát triển code sạch theo GitHub.

## 2. Trạng thái đã xác minh

Đã clone sạch từ GitHub về:

```bash
/Users/mac/Documents/STUDIO_V2_GITHUB_MAIN
```

Kết quả xác minh:

```bash
git status --short --branch
# ## main...origin/main

git rev-parse HEAD
# 5c47e6927774cfef5ffbc706b76bfb9fd3dcb469
```

`db.json` không còn trong bản clone.

`src/db_service.ts` có marker:

```text
Connecting to PostgreSQL database (PostgreSQL-only Active Cache mode)...
```

## 3. Trạng thái server

Server đang chạy tại:

- LAN: `192.168.1.100`
- SSH user: `vinh`
- Hostname: `dell`
- Public site: `https://thewill.io.vn`
- Container app: `studiov2_app`
- Container DB: `studiov2_postgres_prod`

Đã kiểm tra server qua SSH:

```bash
ssh vinh@192.168.1.100 'docker ps'
```

Kết quả chính:

- `studiov2_app` đang chạy image `studio-v2-app`
- port `3005:3005`
- `studiov2_postgres_prod` đang chạy PostgreSQL 15

Trong container app:

- Không thấy `/app/db.json`
- `/app/dist/server.cjs` có chuỗi `PostgreSQL-only Active Cache mode`
- Log có:
  - `PostgreSQL Active Cache successfully initialized.`
  - `Server running on port 3005`

Kết luận: server đang chạy bản tương ứng GitHub `main` mới, bản PostgreSQL Active Cache.

## 4. Điểm cần nhớ về dữ liệu

Quyết định hiện tại:

- Production dùng PostgreSQL.
- Không quay lại luồng `db.json` làm database chính.
- Nếu thấy tài liệu nào còn nói `Primary DB: db.json`, đó là tài liệu cũ/chưa cập nhật.

Lưu ý: `README.md` trên GitHub vẫn còn đoạn mô tả cũ về `db.json`, dù code đã chuyển PostgreSQL Active Cache. Có thể cần sửa README sau.

## 5. Kiểm tra TypeScript hiện tại

Trong workspace cũ sau khi pull commit mới, `npm run lint` lộ lỗi type có sẵn trong source GitHub:

- `seed_all_mock_data.ts`: `ObjectiveKeyResult.status` đang dùng `in_progress`, trong khi type mới là `active | completed | failed`.
- `server.ts`: vẫn tạo/cập nhật key result bằng `pending` / `in_progress`.
- `server.ts`: `LeadFeedback` yêu cầu `author` nhưng object feedback được tạo thiếu field này.

Chưa sửa các lỗi đó trong phiên cũ để giữ nguyên trạng thái chuẩn GitHub trước khi bàn giao.

Phiên mới nên bắt đầu bằng:

```bash
cd /Users/mac/Documents/STUDIO_V2_GITHUB_MAIN
npm run lint
```

Sau đó sửa các lỗi type tối thiểu, chạy lại `npm run lint`, rồi mới phát triển tính năng mới.

## 6. Quy tắc làm tiếp

- Làm việc trong `/Users/mac/Documents/STUDIO_V2_GITHUB_MAIN`.
- Không sửa trực tiếp source trên server.
- Mọi thay đổi phải đi qua GitHub: sửa local -> commit -> push -> deploy.
- Server/container chỉ để kiểm tra runtime, log, version, không dùng làm nguồn sửa code.
- Trước mỗi báo cáo phải ghi rõ:
  - GitHub commit SHA
  - Local commit SHA
  - Server/container có khớp không
  - Lệnh kiểm tra đã chạy
  - Lỗi nào là lỗi mới, lỗi nào là lỗi có sẵn trong source

## 7. Việc nên làm ngay trong phiên mới

1. Xác nhận đang ở `/Users/mac/Documents/STUDIO_V2_GITHUB_MAIN`.
2. Chạy `git status --short --branch`.
3. Chạy `npm run lint`.
4. Sửa lỗi type hiện có:
   - Đồng bộ status của `ObjectiveKeyResult`.
   - Bổ sung `author` cho `LeadFeedback` hoặc chỉnh interface nếu field này không còn cần.
5. Chạy lại `npm run lint`.
6. Cập nhật README để bỏ mô tả `Primary DB: db.json`.
7. Sau khi sạch, mới bắt đầu tính năng mới.
