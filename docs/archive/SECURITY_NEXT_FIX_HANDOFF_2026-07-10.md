# STUDIO V2 - Security Next Fix Handoff

Ngày: 2026-07-10  
Repo bắt buộc: `/Users/mac/Documents/STUDIO_V2_GITHUB_MAIN`

## Mục tiêu

Tiếp tục xử lý các vấn đề bảo mật còn thực tế sau round hardening trước. Không mở rộng scope sang tối ưu tài nguyên chat vì hệ thống hiện chỉ có một người sử dụng chính.

## Không làm trong round này

Không xử lý:

- Rate limit riêng cho chat messages.
- TTL/limit cho `chatbotSessions`.
- Các tối ưu chống spam chat/resource exhaustion.

Lý do: hệ thống hiện chỉ dùng bởi một người, rủi ro tiêu tốn tài nguyên từ chat spam không đáng ưu tiên trong round này.

## Việc phải làm

### 1. Gỡ hardcoded seed passwords

File:

```text
src/db_service.ts
.env.example
README.md hoặc handoff deploy nếu cần
```

Hiện có password gốc hardcoded:

```ts
bcrypt.hashSync('123abc456', 10)
bcrypt.hashSync('staff123', 10)
```

Yêu cầu:

- Không để password gốc trong source code.
- Đọc seed password từ env:
  - `SEED_ADMIN_PASSWORD`
  - `SEED_SALES_PASSWORD`
- Nếu thiếu env trong production, không seed user mặc định với password đoán được.
- Development có thể dùng password random ephemeral, nhưng phải log rõ chỉ dùng dev và yêu cầu đổi mật khẩu.
- `.env.example` chỉ ghi placeholder, không ghi secret thật.

Gợi ý:

```ts
const getSeedPassword = (envName: string) => {
  const value = process.env[envName];
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${envName} is required for first-run production seed`);
  }
  return crypto.randomBytes(16).toString('hex');
};
```

Nếu việc throw ở module top-level gây khó test/build, chuyển seed user creation sang function để chỉ chạy khi `LocalDatabase.initialize()` cần seed.

### 2. Sửa `docker-compose.prod.yml` credentials

File:

```text
docker-compose.prod.yml
.env.example
```

Hiện production compose còn hardcode:

```yaml
production_password
```

Yêu cầu:

- Không hardcode DB password.
- Dùng biến môi trường:

```yaml
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
DATABASE_URL=postgresql://studio_user:${POSTGRES_PASSWORD}@postgres:5432/studio_db?schema=public
```

- Thêm `JWT_SECRET=${JWT_SECRET}` cho app service nếu chưa có.
- Bỏ hoàn toàn các biến LLM cũ:
  - `GEMINI_API_KEY`
  - `GEMINI_API_BASE_URL`
  - `GEMINI_MODEL`
  - `MIMO_API_KEY`
  - `MIMO_API_BASE_URL`
  - `MIMO_MODEL`
- `.env.example` có placeholder:

```env
POSTGRES_PASSWORD="change-me-strong-password"
JWT_SECRET="change-me-strong-random-secret"
```

Không commit `.env` thật.

### 3. Đổi JWT fallback dev sang ephemeral key

File:

```text
server.ts
```

Hiện dev fallback đang hardcode:

```ts
return 'fallback-secret-key-change-this-in-production';
```

Yêu cầu:

- Production vẫn fail fast nếu thiếu `JWT_SECRET`.
- Development/test không dùng secret cố định trong source.
- Dùng ephemeral random key, token sẽ mất hiệu lực sau restart.

Gợi ý:

```ts
const DEV_JWT_SECRET = crypto.randomBytes(32).toString('hex');

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable is missing in production!');
  }
  console.warn('WARNING: JWT_SECRET missing. Using ephemeral dev key; sessions reset on restart.');
  return DEV_JWT_SECRET;
}
```

Đảm bảo tests vẫn pass bằng cách set `JWT_SECRET` trong test.

### 4. Bật CSP cho production

File:

```text
server.ts
```

Hiện:

```ts
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
```

Yêu cầu:

- Development/test có thể tắt CSP để tránh vỡ Vite/test.
- Production phải bật CSP cơ bản.
- Không làm vỡ build/static assets.

Gợi ý:

```ts
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production'
    ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", "data:"],
          objectSrc: ["'none'"],
          frameSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"]
        }
      }
    : false,
  crossOriginEmbedderPolicy: false,
}));
```

Sau khi sửa, chạy build. Nếu production UI cần asset ngoài domain, phải thêm domain cụ thể, không dùng wildcard rộng.

### 5. Siết `/api/system/status`

File:

```text
server.ts
```

Hiện endpoint chỉ cần login:

```ts
app.get('/api/system/status', authenticate, ...)
```

Yêu cầu:

- Thêm `requirePermission('users.manage')`, hoặc
- Giữ endpoint cho user thường nhưng chỉ trả status rất hẹp.

Ưu tiên:

```ts
app.get('/api/system/status', authenticate, requirePermission('users.manage'), ...)
```

Trong production, không trả các thông tin reconnaissance nếu không cần:

- `platform`
- `node_version`
- `uptime`
- memory chi tiết

Có thể chỉ trả:

```json
{
  "backend": "online",
  "database": "connected"
}
```

### 6. Validate backup filename chống path traversal

File:

```text
server.ts
```

Các route:

```text
POST /api/database/backups/restore/:id
DELETE /api/database/backups/:id
```

Yêu cầu:

- Trước khi join path, validate `backup.filename`.
- Không cho `..`, `/`, `\`, hoặc ký tự lạ.
- Sau khi resolve path, đảm bảo path vẫn nằm trong `backupsDir`.

Gợi ý:

```ts
function resolveSafeBackupPath(backupsDir: string, filename: string) {
  if (!/^[a-zA-Z0-9._-]+$/.test(filename) || filename.includes('..')) {
    throw new Error('Tên file backup không hợp lệ');
  }
  const resolved = path.resolve(backupsDir, filename);
  const root = path.resolve(backupsDir);
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error('Đường dẫn backup không hợp lệ');
  }
  return resolved;
}
```

Áp dụng cho restore/delete. Không cần đổi format filename hiện tại.

## Tests cần cập nhật

File:

```text
tests/security.test.ts
```

Thêm hoặc cập nhật test cho:

1. `/api/system/status` user không có `users.manage` bị 403.
2. Backup restore/delete reject filename path traversal nếu có metadata độc hại trong `db.backups`.
3. Production missing `JWT_SECRET` vẫn fail fast nếu test được an toàn.
4. Login/auth tests vẫn pass với `JWT_SECRET` test env.

Không cần test rate limit chat.

## Lệnh kiểm tra bắt buộc

```bash
cd /Users/mac/Documents/STUDIO_V2_GITHUB_MAIN

rg -n "123abc456|staff123|production_password|MIMO_|GEMINI_|fallback-secret-key-change-this-in-production" .

npm run lint
npm run build
npm test
```

Tiêu chí:

- Không còn secret hardcoded trong source/compose.
- Không còn biến LLM cũ trong compose/env.
- `npm test` pass và tự thoát sạch.
- Không có secret thật trong diff.

## Không được làm

- Không thêm rate limit chat trong round này.
- Không thêm TTL/limit chatbot sessions trong round này.
- Không khôi phục MiMo/Gemini/LLM.
- Không sửa source trực tiếp trên server.
- Không đổi database chính về `db.json`.
- Không dùng `process.exit()` để làm test pass.

## Báo cáo cuối cần có

```text
Fixed:
- ...

Skipped by instruction:
- Chat message rate limit
- Chatbot session TTL/limit

Commands:
- npm run lint: pass
- npm run build: pass
- npm test: pass
- rg secret scan: pass

Deploy notes:
- Required env vars:
  - POSTGRES_PASSWORD
  - JWT_SECRET
  - SEED_ADMIN_PASSWORD / SEED_SALES_PASSWORD nếu seeding production lần đầu
```
