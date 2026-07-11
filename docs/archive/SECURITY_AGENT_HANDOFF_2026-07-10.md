# STUDIO V2 - Security Coding Handoff

Ngày: 2026-07-10  
Repo bắt buộc: `/Users/mac/Documents/STUDIO_V2_GITHUB_MAIN`  
Remote: `git@github.com:vinhle158/weddingstudiov2.git`  
Base commit đã xác minh: `5c47e6927774cfef5ffbc706b76bfb9fd3dcb469`  
Branch hiện tại: `main`

## Mục tiêu

Agent tiếp quản phần bảo mật phải harden STUDIO V2 theo hướng thực tế, tối thiểu nhưng chắc:

1. Không rò `password_hash`, JWT secret, AI API key, hoặc dữ liệu backup nhạy cảm.
2. Không dùng secret fallback nguy hiểm ở production.
3. Siết quyền các API nhạy cảm bằng `requirePermission`.
4. Thêm regression tests để chứng minh các lỗi bảo mật không quay lại.
5. Không sửa source trực tiếp trên server.

## Trạng thái hiện tại cần nhớ

Repo chuẩn mới là:

```bash
cd /Users/mac/Documents/STUDIO_V2_GITHUB_MAIN
```

Không dùng workspace cũ:

```text
/Users/mac/Documents/STUDIO V2
/Users/mac/Desktop/weddingstudiov2-main
```

Server production đang chạy bản PostgreSQL Active Cache tương ứng GitHub `main`.
Server chỉ dùng để kiểm tra read-only nếu cần, không chỉnh code trực tiếp trên server.

Local hiện có một số thay đổi chưa commit từ phiên trước:

```text
M README.md
M seed_all_mock_data.ts
M server.ts
?? HANDOFF_NEW_THREAD_2026-07-10.md
```

Các thay đổi đó đã được kiểm tra:

```bash
npm run lint
npm run build
```

Đều pass. File `HANDOFF_NEW_THREAD_2026-07-10.md` là untracked handoff, không tự đưa vào commit nếu không được yêu cầu.

## Điểm bảo mật đã có sẵn

Trong `server.ts`:

- Có `helmet`, nhưng `contentSecurityPolicy` đang tắt.
- Có `cors`, origin lấy từ `CORS_ORIGIN` hoặc fallback `http://localhost:5173`.
- Có `express-rate-limit` cho login.
- Có `bcrypt.compare` khi login.
- Có `bcrypt.hash` khi tạo/sửa user.
- Có JWT auth middleware.
- Nhiều route đã dùng `authenticate` và một số route dùng `requirePermission`.
- Export database đã loại `password_hash` trong `/api/database/export`.

Trong frontend:

- Token đang lưu ở `localStorage` với key `studio_token`.
- API helper tự gắn `Authorization: Bearer <token>`.

## Rủi ro chính cần xử lý

### 1. JWT secret fallback nguy hiểm

Hiện tại `server.ts` có:

```ts
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-change-this-in-production';
```

Yêu cầu:

- Production phải fail fast nếu thiếu `JWT_SECRET`.
- Development có thể dùng fallback rõ ràng, nhưng phải log warning.
- `.env.example` phải bổ sung `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`, `PORT`, `HOST`, `DATABASE_URL`.
- Không hardcode secret thật.

Gợi ý implementation:

- Tạo helper nhỏ gần đầu `server.ts`, ví dụ `getJwtSecret()`.
- Nếu `NODE_ENV === 'production'` và thiếu `JWT_SECRET`, throw error trước khi server listen.
- Dùng `process.env.JWT_EXPIRES_IN || '24h'` thay vì hardcode trong `jwt.sign`.

### 2. API `/api/users` đang có nguy cơ trả `password_hash`

Hiện tại route `GET /api/users` map user với spread:

```ts
return {
  ...u,
  role_name: r ? r.display_name : 'No role'
};
```

Route `POST /api/users` và `PUT /api/users/:id` cũng đang trả object user gốc sau khi save. Những response này có thể chứa `password_hash`.

Yêu cầu:

- Tạo helper `sanitizeUser(user)` để bỏ `password_hash`.
- Mọi response có user phải dùng helper này:
  - `GET /api/users`
  - `POST /api/users`
  - `PUT /api/users/:id`
  - `GET /api/auth/me`
  - `POST /api/auth/login`
  - Bất kỳ response nào khác có `User`.
- Không trả `password_hash` cho frontend trong mọi trường hợp.

### 3. Route user list thiếu permission

Hiện tại:

```ts
app.get('/api/users', authenticate, ...)
```

Yêu cầu:

- Thêm `requirePermission('users.manage')` cho `GET /api/users`.
- Lý do: danh sách nhân sự/user là dữ liệu admin, không nên chỉ cần login là xem được.

### 4. Logout hiện chỉ xóa token phía client

Hiện tại:

```ts
app.post('/api/auth/logout', (req, res) => ...)
```

Không có server-side invalidation. Nếu token bị lộ, logout không vô hiệu hóa token.

Yêu cầu tối thiểu:

- Đổi logout route thành cần `authenticate`.
- Thêm `tokenVersion` hoặc `session_invalidated_at` nếu muốn bền vững, nhưng chỉ làm nếu phù hợp với schema/cache hiện tại.
- Nếu chưa làm full revocation được trong scope này, phải ghi rõ trong TODO/security note và thêm test xác nhận logout hiện tại chỉ là client-side.

Ưu tiên tốt hơn:

- Thêm `session_version` vào user object/cache nếu dễ làm.
- JWT payload có `sessionVersion`.
- Khi logout hoặc đổi password, tăng `session_version`.
- Middleware reject token có version cũ.

Không làm nửa vời nếu không có test.

### 5. Token đang lưu trong `localStorage`

Hiện tại:

```ts
localStorage.setItem('studio_token', data.token);
```

Đây là rủi ro XSS. Tuy nhiên chuyển sang httpOnly cookie sẽ ảnh hưởng nhiều frontend/API/CORS.

Yêu cầu cho agent:

- Không chuyển sang cookie nếu không đủ thời gian test browser.
- Nếu giữ `localStorage`, phải:
  - Không lưu password.
  - Đảm bảo `remembered_password` bị remove như hiện tại.
  - Siết CSP nếu có thể mà không làm vỡ Vite/dev/prod.
  - Ghi rõ residual risk trong security note.

### 6. Dấu vết cấu hình LLM cũ trong Studio settings

Route:

```ts
GET /api/studio/settings
PUT /api/studio/settings
```

Code hiện vẫn còn dấu vết cấu hình LLM cũ:

```text
mimo_api_key
gemini_api_key
```

Theo quyết định sản phẩm hiện tại, chatbot đã loại bỏ hoàn toàn việc dùng mô hình LLM. Vì vậy đây không phải là tính năng cần giữ, mà là bề mặt cấu hình/secret cũ cần được xử lý.

Yêu cầu:

- Rà soát toàn bộ repo để xác nhận các field/env sau còn được dùng ở đâu:
  - `mimo_api_key`
  - `mimo_api_base_url`
  - `mimo_model`
  - `gemini_api_key`
  - `gemini_api_base_url`
  - `gemini_model`
  - `MIMO_API_KEY`
  - `GEMINI_API_KEY`
- Nếu đúng là LLM đã bị loại bỏ khỏi chatbot, hãy xóa các field này khỏi:
  - `src/db_service.ts`
  - `server.ts`
  - `.env.example`
  - Settings UI nếu còn input hiển thị cấu hình AI
  - README/tài liệu nếu còn nhắc cấu hình MiMo/Gemini cho chatbot
- `GET /api/studio/settings` không được trả raw API key cũ ra frontend.
- Nếu vì lý do tương thích dữ liệu cũ chưa thể xóa ngay, chỉ được giữ dạng migration/backward-compatible cleanup và phải mask hoàn toàn trong response. Không xem đây là luồng sản phẩm cần duy trì.
- Test phải chứng minh response settings không còn raw `mimo_api_key` hoặc `gemini_api_key`.

### 7. Backup/import/restore quá rộng

Các route nhạy cảm:

```text
GET  /api/database/export
POST /api/database/import
POST /api/database/backups/create
POST /api/database/backups/restore/:id
DELETE /api/database/backups/:id
```

Hiện dùng `users.manage`, nhưng cần thêm validation và tránh rò secret.

Yêu cầu:

- Export phải loại:
  - `password_hash`
  - AI API keys trong `studio_settings`
  - các secret/env-like field nếu có
- Backup file tạo trên disk không nên chứa raw API keys nếu backup có thể tải/xem từ admin UI.
- Import phải validate schema tối thiểu hơn hiện tại:
  - `users` array
  - `roles` array
  - user không được thiếu `id/email/role_id/is_active`
  - không accept user có plaintext password thay cho bcrypt hash
  - không accept role permissions không phải array
- Restore backup phải validate giống import trước khi `LocalDatabase.save`.

### 8. Demo cleanup route quá mở

Hiện tại:

```ts
app.post('/api/demo/cleanup', authenticate, ...)
```

Yêu cầu:

- Production không nên expose route này cho mọi user đã login.
- Chọn một trong hai:
  - Chỉ enable khi `NODE_ENV !== 'production'`, hoặc
  - Thêm `requirePermission('users.manage')`.
- Tốt nhất: cả hai, nếu route chỉ phục vụ demo/dev.

### 9. Scope dữ liệu CRM cần test lại

Các route lead hiện đã có logic phân quyền ở `GET /api/leads`:

- Admin/view_all xem tất cả.
- Sales chỉ xem lead của mình.

Nhưng `PUT /api/leads/:id` đang dùng `requirePermission('leads.manage')` và không kiểm tra lead đó có thuộc user đang thao tác không.

Yêu cầu:

- Nếu sales có `leads.manage`, họ chỉ được sửa lead `assigned_sale_id === req.user.id` trừ khi có `leads.view_all` hoặc admin.
- `POST /api/leads/:id/feedback` chỉ manager/admin hoặc `leads.view_all`.
- `GET /api/leads/analytics` giữ `leads.view_all`.

### 10. Input validation tối thiểu

Không cần đưa thêm framework lớn nếu không cần. Nhưng các route ghi dữ liệu nên có guard rõ:

- Email phải có format tối thiểu.
- Password tạo user/sửa user phải có min length, ví dụ 8.
- `sales_step` chỉ 1-6.
- `lead.status` chỉ `consulting | won | lost`.
- `Task.status` chỉ `pending | in_progress | done | cancelled`.
- `ObjectiveKeyResult.status` chỉ `active | completed | failed`.
- Numeric fields parse xong phải finite, không NaN/Infinity.

Nếu thêm helper validation, để trong `server.ts` trước route hoặc tách file nhỏ `src/lib/security.ts` / `src/lib/validation.ts` nếu code bắt đầu dài.

## Test bắt buộc

Hiện repo chưa có script test rõ trong `package.json`. Agent nên thêm test tối thiểu bằng Node built-in test runner hoặc framework nhẹ có sẵn. Ưu tiên không kéo dependency lớn.

Đề xuất:

```bash
mkdir -p tests
```

Thêm script:

```json
"test": "node --test --import tsx tests/*.test.ts"
```

Các test security tối thiểu:

1. `sanitizeUser` không bao giờ trả `password_hash`.
2. `GET /api/users` không cho role thường truy cập.
3. Login response không có `password_hash`.
4. `/api/database/export` không có `password_hash`, `mimo_api_key`, `gemini_api_key`.
5. Import reject user có plaintext password.
6. Missing `JWT_SECRET` trong production làm server/config fail fast.
7. Sales user không sửa được lead không thuộc mình.
8. `/api/demo/cleanup` bị chặn trong production hoặc cần admin permission.

Nếu test integration khó vì `startServer()` đang tự listen, agent được phép refactor nhẹ:

- Export `createApp()` hoặc `startServer()` từ `server.ts`.
- Chỉ gọi `startServer()` khi chạy trực tiếp.
- Giữ behavior production/dev không đổi.

Không refactor quá rộng.

## Lệnh kiểm tra phải chạy trước khi bàn giao

```bash
cd /Users/mac/Documents/STUDIO_V2_GITHUB_MAIN
git status --short --branch
npm run lint
npm run build
npm test
```

Nếu thêm dependency hoặc đổi lockfile:

```bash
npm audit
```

Không chạy `npm audit fix --force` nếu không có yêu cầu riêng, vì có thể gây breaking change.

## Browser QA nếu đụng frontend settings/login

Nếu agent sửa `src/App.tsx`, `src/lib/api.ts`, hoặc Settings UI:

1. Start local dev/prod server.
2. Login bằng tài khoản seed.
3. Vào Settings.
4. Kiểm tra API key không hiện raw secret.
5. Logout/login lại.
6. Mở devtools/network hoặc API response nếu có thể để xác nhận không trả `password_hash` hoặc raw API keys.

## Không được làm

- Không sửa trực tiếp source trên server.
- Không dùng `/Users/mac/Documents/STUDIO V2` cũ.
- Không tự revert các thay đổi local hiện có ở `README.md`, `seed_all_mock_data.ts`, `server.ts`.
- Không commit file handoff untracked nếu không được yêu cầu.
- Không hardcode secret thật vào repo.
- Không đổi database chính về `db.json`.
- Không xóa PostgreSQL Active Cache.
- Không làm refactor lớn toàn bộ `server.ts` nếu chưa cần để test.

## Tiêu chí hoàn thành

Agent chỉ báo hoàn thành khi:

- Lint pass.
- Build pass.
- Test security pass.
- Diff không chứa secret thật.
- Response user/API không còn rò `password_hash`.
- Settings/export/backup không rò raw AI API keys hoặc đã loại bỏ hoàn toàn field LLM cũ.
- Các route admin/user/database/demo được siết quyền rõ ràng.
- Có ghi rõ residual risk nếu vẫn giữ JWT trong `localStorage`.

## Báo cáo cuối cần có

Báo cáo ngắn bằng tiếng Việt, gồm:

```text
- Local commit SHA:
- GitHub/origin SHA:
- Server/container có đụng không: Không / Có, đã làm gì
- Files changed:
- Security fixes:
- Tests run:
- Residual risks:
```
