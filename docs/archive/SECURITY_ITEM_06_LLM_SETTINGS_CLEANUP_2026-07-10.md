# STUDIO V2 - Mục 6: Dọn dấu vết cấu hình LLM cũ trong Studio Settings

Ngày: 2026-07-10  
Repo bắt buộc: `/Users/mac/Documents/STUDIO_V2_GITHUB_MAIN`

## Bối cảnh

Phần chatbot đã được quyết định loại bỏ hoàn toàn việc dùng mô hình LLM. Vì vậy các cấu hình liên quan MiMo/Gemini không còn là tính năng cần duy trì.

Tuy nhiên trong code hiện vẫn có dấu vết cấu hình cũ như:

```text
mimo_api_key
mimo_api_base_url
mimo_model
gemini_api_key
gemini_api_base_url
gemini_model
MIMO_API_KEY
GEMINI_API_KEY
```

Đây là rủi ro bảo mật vì secret cũ có thể vẫn bị lưu, trả về frontend, export ra backup, hoặc gây hiểu nhầm rằng hệ thống còn phụ thuộc LLM.

## Mục tiêu của agent bảo mật

Agent không được tiếp tục phát triển luồng MiMo/Gemini. Nhiệm vụ là rà soát và dọn sạch dấu vết LLM cũ, hoặc tối thiểu chặn mọi đường rò secret nếu còn cần giữ tương thích dữ liệu cũ.

## File cần rà soát

Ưu tiên kiểm tra các file sau:

```text
server.ts
src/db_service.ts
src/components/Settings.tsx
src/components/mobile/screens/MobileSettings.tsx
src/lib/chatbot/*
src/lib/businessNlp.ts
src/lib/api.ts
.env.example
README.md
package.json
```

Có thể dùng:

```bash
rg -n "mimo|gemini|MIMO|GEMINI|api_key|apiBase|model" .
```

## Việc phải làm

### 1. Xác nhận không còn luồng LLM runtime

Rà soát các hàm gọi provider cũ trong `server.ts`, đặc biệt các đoạn đọc:

```ts
process.env.MIMO_API_KEY
process.env.GEMINI_API_KEY
db.studio_settings?.mimo_api_key
db.studio_settings?.gemini_api_key
```

Nếu chatbot đã không dùng LLM nữa, xóa hoặc vô hiệu hóa hoàn toàn các nhánh gọi MiMo/Gemini.

Không để lại fallback âm thầm sang LLM.

### 2. Dọn schema/interface settings

Trong `src/db_service.ts`, rà soát `StudioSettings`.

Nếu không còn dùng LLM:

- Xóa các field:
  - `mimo_api_key`
  - `mimo_api_base_url`
  - `mimo_model`
  - `gemini_api_key`
  - `gemini_api_base_url`
  - `gemini_model`
- Đảm bảo code compile sau khi xóa.

Nếu cần giữ tương thích dữ liệu cũ trong database/cache:

- Không expose các field đó qua API.
- Có thể bỏ qua field khi đọc settings.
- Có thể strip khi save/export/backup.

### 3. Sửa API Studio Settings

Route cần kiểm tra:

```text
GET /api/studio/settings
PUT /api/studio/settings
```

Yêu cầu:

- `GET /api/studio/settings` không được trả raw key cũ ra frontend.
- `PUT /api/studio/settings` không nên nhận hoặc lưu các field MiMo/Gemini nữa.
- Nếu request body còn gửi field cũ, server nên bỏ qua hoặc reject rõ ràng.
- Không làm UI tưởng rằng vẫn cấu hình được LLM.

### 4. Sửa Settings UI

Nếu `Settings.tsx` hoặc mobile settings còn input cho MiMo/Gemini/API key:

- Xóa các input đó.
- Xóa copy mô tả cấu hình AI model.
- Không hiển thị masked key như một tính năng còn sống.

Nếu cần thông báo nội bộ, chỉ ghi ở tài liệu/dev note, không đưa vào UI người dùng.

### 5. Sửa `.env.example`

Xóa các dòng cấu hình cũ nếu không còn dùng:

```env
MIMO_API_BASE_URL=
MIMO_MODEL=
MIMO_API_KEY=
GEMINI_API_BASE_URL=
GEMINI_MODEL=
GEMINI_API_KEY=
```

Chỉ giữ `GEMINI_API_KEY` nếu repo còn thật sự cần cho tính năng khác ngoài chatbot. Nếu không chắc, agent phải chứng minh bằng `rg` trước khi giữ.

### 6. Sửa export/backup/import

Các route database management không được làm rò secret cũ:

```text
GET  /api/database/export
POST /api/database/import
POST /api/database/backups/create
POST /api/database/backups/restore/:id
```

Yêu cầu:

- Export không chứa raw `mimo_api_key` hoặc `gemini_api_key`.
- Backup mới không nên ghi raw key cũ.
- Import/restore nên strip các field LLM cũ khỏi `studio_settings`.
- Nếu dữ liệu cũ có các field này, sau save không được còn raw key trong cache/output.

### 7. Sửa tài liệu

Rà soát README và tài liệu liên quan.

Xóa hoặc sửa mọi nội dung nói rằng:

- chatbot dùng MiMo;
- chatbot dùng Gemini;
- cần cấu hình API key cho chatbot;
- Settings có phần cấu hình model LLM.

Không thay bằng hướng dẫn cấu hình model mới.

## Test bắt buộc

Thêm hoặc cập nhật test để chứng minh:

1. `GET /api/studio/settings` không trả `mimo_api_key`.
2. `GET /api/studio/settings` không trả `gemini_api_key`.
3. `GET /api/database/export` không chứa `mimo_api_key` hoặc `gemini_api_key`.
4. Backup mới không chứa raw key cũ trong `studio_settings`.
5. Import/restore dữ liệu cũ có `mimo_api_key`/`gemini_api_key` sẽ strip hoặc reject.
6. `npm run lint` pass.
7. `npm run build` pass.

Nếu repo chưa có test runner, thêm script tối thiểu:

```json
"test": "node --test --import tsx tests/*.test.ts"
```

## Lệnh kiểm tra

Chạy trước khi bàn giao:

```bash
cd /Users/mac/Documents/STUDIO_V2_GITHUB_MAIN
rg -n "mimo|gemini|MIMO|GEMINI" server.ts src .env.example README.md package.json
npm run lint
npm run build
npm test
```

Sau khi sửa, nếu vẫn còn kết quả `rg`, agent phải giải thích rõ từng kết quả còn lại vì sao hợp lệ.

## Không được làm

- Không khôi phục chatbot LLM.
- Không thêm provider LLM mới.
- Không giữ input API key trong UI nếu không còn dùng.
- Không trả raw key ra frontend dưới bất kỳ dạng nào.
- Không commit secret thật.
- Không sửa source trực tiếp trên server.
- Không chuyển database chính về `db.json`.

## Tiêu chí hoàn thành

Hoàn thành khi:

- Không còn luồng runtime gọi MiMo/Gemini cho chatbot.
- Settings UI không còn cấu hình LLM.
- `.env.example` không còn yêu cầu key LLM cũ nếu không dùng.
- Settings/export/backup/import không rò raw key cũ.
- Lint/build/test pass.
- Báo cáo cuối liệt kê rõ còn dấu vết `mimo/gemini` nào không, nếu có.
