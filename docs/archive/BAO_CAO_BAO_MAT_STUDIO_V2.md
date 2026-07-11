# 🔒 BÁO CÁO BẢO MẬT — STUDIO V2

**Ngày:** 2026-07-10  
**Phiên bản:** v1.0  
**Phạm vi:** Toàn bộ codebase STUDIO V2 (backend Express + Docker + Chatbot NLP)  
**Phương pháp:** Manual code review + static analysis + dependency check

---

## Mục lục

1. [Tổng quan](#tổng-quan)
2. [Phân loại vấn đề](#phân-loại-vấn-đề)
3. [🔴 CRITICAL](#-critical--cần-khắc-phục-ngay)
4. [🟠 HIGH](#-high--cần-xử-lý-sớm)
5. [🟡 MEDIUM](#-medium--nên-cải-thiện)
6. [🟢 LOW](#-low--lưu-ý)
7. [Các điểm bảo mật đã có](#các-điểm-bảo-mật-đã-có)
8. [Ưu tiên khắc phục](#ưu-tiên-khắc-phục)
9. [Kết luận](#kết-luận)

---

## Tổng quan

Dự án **STUDIO V2** là ứng dụng quản lý studio cưới (CRM, đơn hàng, chatbot NLP, OKR) xây dựng bằng Express.js + Prisma + PostgreSQL. Codebase gồm ~3.200 dòng server-side, 8 module chatbot, và Docker deployment.

### Phạm vi review

| Thành phần | File chính |
|---|---|
| API Server | `server.ts` (3.262 dòng) |
| Database layer | `src/db_service.ts` (555 dòng) |
| Chatbot NLP | `src/lib/chatbot/*.ts` (6 files) |
| Docker | `Dockerfile`, `docker-compose.yml`, `docker-compose.prod.yml` |
| Config | `.env.example`, `.gitignore` |
| Tests | `tests/security.test.ts` |

---

## Phân loại vấn đề

| Phân loại | Số vấn đề | Mức độ |
|---|---|---|
| 🔴 CRITICAL | 3 | Cần khắc phục ngay — rủi ro lộ credentials hoặc chiếm quyền |
| 🟠 HIGH | 4 | Cần xử lý sớm — rủi ro XSS, DoS, reconnaissance |
| 🟡 MEDIUM | 4 | Nên cải thiện — giảm thiểu rủi ro lâu dài |
| 🟢 LOW | 3 | Lưu ý — best practice |

---

## 🔴 CRITICAL — Cần khắc phục ngay

### C01. Hardcoded seed passwords trong source code

**Vị trí:** `src/db_service.ts:273-293`

**Code hiện tại:**

```ts
const defaultUsers: User[] = [
  {
    id: 'user-admin',
    full_name: 'Viet Hoang',
    email: 'viet@studio.com',
    password_hash: bcrypt.hashSync('123abc456', 10),  // ← Hardcoded
    role_id: 'role-admin',
  },
  {
    id: 'user-sale',
    full_name: 'Nguyễn Thị Sales',
    email: 'sale@studio.com',
    password_hash: bcrypt.hashSync('staff123', 10),    // ← Hardcoded
    role_id: 'role-sales',
  }
];
```

**Vấn đề:**  
Mật khẩu admin (`123abc456`) và sales (`staff123`) bị hardcode trực tiếp trong source code. Bất kỳ ai có quyền đọc repo đều sở hữu credentials admin-level. Nếu repo bị leak (accidental push, contributor离开, fork public), toàn bộ hệ thống bị compromise.

**Tác hại:**
- Attacker login với quyền admin
- Truy cập toàn bộ dữ liệu khách hàng, đơn hàng, CRM
- Thay đổi role, tạo backdoor
- Đọc/ghi/xóa backup database

**Giải pháp:**

```ts
// Option 1: Đọc từ environment variable
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
if (adminPassword && userCount === 0) {
  // Seed only if env is set
}

// Option 2: Generate random password on first run, log to console
const adminPassword = crypto.randomBytes(16).toString('hex');
console.log(`[SEED] Admin password: ${adminPassword} — CHANGE AFTER FIRST LOGIN`);
```

---

### C02. Docker Compose Prod chứa hardcoded database password

**Vị trí:** `docker-compose.prod.yml:15, 30`

**Code hiện tại:**

```yaml
services:
  app:
    environment:
      - DATABASE_URL=postgresql://studio_user:production_password@postgres:5432/studio_db?schema=public

  postgres:
    environment:
      POSTGRES_PASSWORD: production_password
```

**Vấn đề:**  
Password database production (`production_password`) bị hardcode trong file `docker-compose.prod.yml`. File này thường được commit vào git repository, dẫn đến lộ credentials database.

**Tác hại:**
- Direct access vào PostgreSQL database từ bất kỳ đâu
- Đọc toàn bộ dữ liệu khách hàng, đơn hàng, leads
- Modify/delete dữ liệu mà không qua application logic
- Potential data exfiltration

**Giải pháp:**

```yaml
services:
  app:
    environment:
      - DATABASE_URL=postgresql://studio_user:${POSTGRES_PASSWORD}@postgres:5432/studio_db?schema=public

  postgres:
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```

Sử dụng `.env` file (đã có trong `.gitignore`) hoặc Docker Secrets:

```bash
# .env (production server)
POSTGRES_PASSWORD=<strong-random-password>
```

---

### C03. JWT Secret fallback hardcode trong source

**Vị trí:** `server.ts:20-30`

**Code hiện tại:**

```ts
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET environment variable is missing in production!');
    }
    console.warn('WARNING: JWT_SECRET is missing. Using default development fallback!');
    return 'fallback-secret-key-change-this-in-production';
  }
  return secret;
}
```

**Vấn đề:**  
Fallback secret `'fallback-secret-key-change-this-in-production'` được hardcode trong source code. Dù production check đã có (tốt), nhưng:
1. Secret này hiển thị rõ ràng trong repo — ai đọc cũng biết
2. Nếu developer chạy local mà quên set `.env`, token được ký bằng secret công khai
3. Token production có thể bị forge nếu developer vô tình dùng cùng secret

**Tác hại:**
- Forge JWT token với role admin
- Bypass authentication hoàn toàn
- Truy cập mọi API endpoint mà không cần login

**Giải pháp:**

```ts
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET environment variable is missing in production!');
    }
    // Generate ephemeral dev key — tokens won't persist across restarts
    const ephemeralKey = crypto.randomBytes(32).toString('hex');
    console.warn('WARNING: JWT_SECRET missing. Using ephemeral dev key (tokens won\'t persist).');
    return ephemeralKey;
  }
  return secret;
}
```

---

## 🟠 HIGH — Cần xử lý sớm

### H01. Helmet Content Security Policy bị tắt hoàn toàn

**Vị trí:** `server.ts:55-58`

**Code hiện tại:**

```ts
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
```

**Vấn đề:**  
Content Security Policy (CSP) là lớp bảo vệ quan trọng nhất chống XSS (Cross-Site Scripting). Việc tắt CSP hoàn toàn loại bỏ bảo vệ này. Dù lý do có thể là để Vite HMR hoạt động trong development, nhưng production cần CSP bật.

**Tác hại:**
- Không có bảo vệ chống inline script injection
- XSS attacks dễ dàng thực thi
- Combined với localStorage token (xem M01) → account takeover

**Giải pháp:**

```ts
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    }
  } : false,
  crossOriginEmbedderPolicy: false,
}));
```

---

### H02. System status endpoint leak thông tin hệ thống

**Vị trí:** `server.ts:1128-1153`

**Code hiện tại:**

```ts
app.get('/api/system/status', authenticate, async (req, res) => {
  res.json({
    platform: process.platform,      // 'linux', 'darwin'
    node_version: process.version,   // 'v20.x.x'
    uptime: Math.round(process.uptime()),
    memory: {
      free: Math.round(os.freemem() / (1024 * 1024)),
      total: Math.round(os.totalmem() / (1024 * 1024))
    }
  });
});
```

**Vấn đề:**  
Endpoint trả `platform`, `node_version`, `uptime`, `memory` — thông tin reconnaissance quan trọng cho attacker. Dù đã có `authenticate`, bất kỳ user nào đăng nhập (bao gồm staff với quyền tối thiểu) đều xem được.

**Tác hại:**
- Attacker xác định OS/Node version để tìm exploits known
- Uptime reveal server restart pattern
- Memory info giúp planning resource exhaustion attacks

**Giải pháp:**

```ts
app.get('/api/system/status', authenticate, requirePermission('users.manage'), async (req, res) => {
  // Chỉ admin mới xem được system details
  res.json({
    backend: 'online',
    database: dbStatus,
    db_latency_ms: dbLatency,
    // Only expose in production for debugging:
    ...(process.env.NODE_ENV !== 'production' && {
      platform: process.platform,
      node_version: process.version,
      uptime: Math.round(process.uptime()),
      memory: {
        free: Math.round(os.freemem() / (1024 * 1024)),
        total: Math.round(os.totalmem() / (1024 * 1024))
      }
    })
  });
});
```

---

### H03. Chat messages không có rate limiting

**Vị trí:** `server.ts:2546-2574`

**Vấn đề:**  
`POST /api/chat/messages` không có rate limiting. User có thể spam tin nhắn liên tục, gây memory growth (append-only) và potential DoS.

**Tác hại:**
- Memory exhaustion qua chat message spam
- Database bloat (chat_messages grows unbounded)
- Affect other users' response time

**Giải pháp:**

```ts
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,             // 30 messages per minute
  message: { error: 'Quá nhiều tin nhắn, vui lòng thử lại sau' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/api/chat/messages', authenticate, chatLimiter, (req, res) => {
  // ... existing code
});
```

---

### H04. CORS chỉ accept 1 origin duy nhất

**Vị trí:** `server.ts:59-62`

**Code hiện tại:**

```ts
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
```

**Vấn đề:**  
Chỉ accept 1 origin duy nhất. Nếu deploy cần staging + production cùng chạy, hoặc nhiều subdomain, CORS sẽ bị block. Không có dynamic validation.

**Giải pháp:**

```ts
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
```

---

## 🟡 MEDIUM — Nên cải thiện

### M01. JWT token lưu trong localStorage (XSS risk)

**Vị trí:** `src/lib/api.ts:6`

```ts
const token = localStorage.getItem('studio_token');
```

**Vấn đề:**  
JWT token trong `localStorage` dễ bị đánh cắp qua任何 XSS vulnerability. Kết hợp với CSP bị tắt (H01) → rủi ro rất cao.

**Giải pháp:**
- Ưu tiên: Bật CSP ở production (xem H01)
- Không lưu bất kỳ password nào ở client-side
- Ghi residual risk trong documentation
- Nếu có thể, chuyển sang httpOnly cookie trong tương lai (cần thay đổi CORS/CSRF)

---

### M02. In-memory chatbot sessions không có TTL và giới hạn

**Vị trí:** `server.ts:890`

```ts
const chatbotSessions = new Map<string, ChatbotSessionContext>();
```

**Vấn đề:**  
Map grows indefinitely. Attacker có thể tạo nhiều sessionId giả để gây memory leak.

**Giải pháp:**

```ts
const MAX_SESSIONS = 1000;
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

// Before setting session:
if (chatbotSessions.size > MAX_SESSIONS) {
  chatbotSessions.clear();
}

// Periodic cleanup (optional)
setInterval(() => {
  for (const [key, session] of chatbotSessions) {
    if (Date.now() - (session.createdAt || 0) > SESSION_TTL) {
      chatbotSessions.delete(key);
    }
  }
}, SESSION_TTL);
```

---

### M03. Backup filename không có validation chống path traversal

**Vị trí:** `server.ts:2762-2803`

**Vấn đề:**  
Backup filename dựa trên UUID nhưng không validate chống path traversal. Nếu `backup.filename` chứa `../`, có thể đọc file ngoài thư mục backups.

**Giải pháp:**

```ts
// Validate backup filename
const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '');
if (safeFilename !== filename || filename.includes('..')) {
  return res.status(400).json({ error: 'Tên file backup không hợp lệ' });
}
```

---

### M04. Docker compose_prod không có health check

**Vị trí:** `docker-compose.prod.yml`

**Vấn đề:**  
Không có `healthcheck` cho app container. Docker sẽ restart liên tục nếu app crash mà không có backoff strategy.

**Giải pháp:**

```yaml
services:
  app:
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--spider", "-q", "http://localhost:3005/api/system/status"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    restart: unless-stopped
```

---

## 🟢 LOW — Lưu ý

### L01. Không có HTTPS enforcement

**Vấn đề:** Server chạy HTTP plain. Production cần TLS termination.

**Giải pháp:** Sử dụng nginx/caddy làm TLS termination:
```nginx
server {
    listen 443 ssl;
    ssl_certificate /etc/ssl/certs/app.crt;
    ssl_certificate_key /etc/ssl/private/app.key;
    
    location / {
        proxy_pass http://localhost:3005;
    }
}
```

---

### L02. Express static serving không có cache control

**Vị trí:** `server.ts:3242-3246`

```ts
app.use(express.static(distPath));
```

**Giải pháp:**

```ts
app.use(express.static(distPath, {
  maxAge: '1y',
  etag: true,
  lastModified: true,
}));
```

---

### L03. User deletion không có audit log

**Vị trí:** `server.ts:1268-1281`

Soft delete không ghi lại ai đã deactivate user, khi nào, và lý do.

**Giải pháp:** Thêm audit trail cho sensitive operations (user delete, role change, password reset).

---

## Các điểm bảo mật đã có

Dưới đây là các cơ chế bảo mật **đã được triển khai đúng** trong codebase:

| Bảo vệ | Vị trí | Đánh giá |
|---|---|---|
| JWT authentication middleware | `server.ts:76-102` | ✅ Hoạt động tốt |
| Session version check (logout invalidation) | `server.ts:91-93` | ✅ Token bị revoke khi logout |
| Password hashing (bcrypt, cost=10) | `server.ts:1196, 1235` | ✅ Đúng tiêu chuẩn |
| Rate limiting cho login (5 req/15min) | `server.ts:66-72` | ✅ Chống brute-force |
| Helmet security headers | `server.ts:55-58` | ⚠️ Có nhưng CSP tắt |
| CORS configured | `server.ts:59-62` | ✅ Có origin restriction |
| Input validation (email, password length) | `server.ts:1187-1193` | ✅ Đúng tiêu chuẩn |
| Permission-based authorization | `server.ts:105-115` | ✅ requirePermission middleware |
| Export sanitize (password_hash removed) | `server.ts:2646-2663` | ✅ Không leak password |
| Import validation (bcrypt hash check) | `server.ts:2687-2696` | ✅ Reject plaintext passwords |
| Demo cleanup blocked in production | `server.ts:3209-3212` | ✅ 403 in production |
| LLM API keys stripped from settings/backup | `server.ts:2655-2661` | ✅ Legacy keys removed |
| Sales lead ownership check | `server.ts:2968-2971` | ✅ Sales chỉ sửa lead của mình |
| Staff task isolation | `server.ts:1692-1696` | ✅ Staff chỉ thấy task của mình |
| Security regression tests | `tests/security.test.ts` | ✅ 8 tests covering key scenarios |

---

## Ưu tiên khắc phục

| Ưu tiên | ID | Vấn đề | Effort | Impact |
|---|---|---|---|---|
| 🔴 P0 | C01 | Hardcoded seed passwords | 15 phút | Credential leak |
| 🔴 P0 | C02 | Docker hardcoded DB password | 10 phút | Database access |
| 🔴 P0 | C03 | JWT fallback hardcode | 10 phút | Auth bypass |
| 🟠 P1 | H01 | CSP bị tắt | 30 phút | XSS protection |
| 🟠 P1 | H02 | System status info leak | 15 phút | Reconnaissance |
| 🟠 P1 | H03 | Chat rate limiting | 15 phút | DoS prevention |
| 🟠 P1 | H04 | CORS multiple origins | 20 phút | Deployment flexibility |
| 🟡 P2 | M01 | localStorage token | — | Residual risk (document) |
| 🟡 P2 | M02 | Chat session memory leak | 15 phút | Memory exhaustion |
| 🟡 P2 | M03 | Backup path traversal | 10 phút | File access |
| 🟡 P2 | M04 | Docker healthcheck | 10 phút | Availability |
| 🟢 P3 | L01-L03 | Low priority items | 30 phút | Best practices |

---

## Kết luận

STUDIO V2 đã có nền tảng bảo mật khá tốt với authentication, authorization, rate limiting, và input validation. Tuy nhiên, có **3 vấn đề CRITICAL** liên quan đến hardcoded credentials cần được khắc phục ngay lập tức trước khi deploy lên production.

**Hành động tiếp theo:**
1. Khắc phục 3 vấn đề CRITICAL trong vòng 24 giờ
2. Xử lý 4 vấn đề HIGH trong vòng 1 tuần
3. Cải thiện 4 vấn đề MEDIUM trong vòng 2 tuần
4. Review lại sau khi deploy lên production

---

*Báo cáo được tạo bởi: MiMo Code Agent*  
*Ngày: 2026-07-10*
