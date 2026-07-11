# Hướng dẫn Code cho Agent — STUDIO V2

**Mục đích:** Tài liệu hướng dẫn các Agent AI khi fix bugs và cải tiến dự án STUDIO V2.
**Đọc kèm:** `BUG_REPORT.md` — danh sách các vấn đề cần fix.

---

## 1. Cấu trúc Dự án

```
STUDIO V2/
├── index.html                    # Vite SPA entry point
├── package.json                  # Dependencies & scripts
├── tsconfig.json                 # TypeScript config
├── vite.config.ts                # Vite build config
├── server.ts                     # Express backend (1907 dòng)
├── db.json                       # Runtime JSON database (backup)
├── prisma/schema.prisma          # PostgreSQL schema
├── .env                          # Environment variables
├── src/
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # Main app component
│   ├── index.css                 # Global styles (Tailwind)
│   ├── db_service.ts             # DB service + seed data (957 dòng)
│   ├── lib/
│   │   └── api.ts                # API client
│   ├── hooks/
│   │   └── useIsMobile.ts        # Mobile detection hook
│   └── components/
│       ├── Dashboard.tsx          # Dashboard desktop
│       ├── Orders.tsx             # Orders management
│       ├── Tasks.tsx              # Tasks management
│       ├── Objectives.tsx         # OKR/Objectives
│       ├── Customers.tsx          # Customer management
│       ├── Staff.tsx              # Staff management
│       ├── Settings.tsx           # App settings
│       ├── Chat.tsx               # Internal chat
│       ├── Leads.tsx              # Lead management
│       ├── Notifications.tsx      # Notifications
│       └── mobile/                # Mobile-specific components
│           ├── MobileApp.tsx
│           ├── MobileLayout.tsx
│           ├── shared/
│           │   ├── MobileHeader.tsx
│           │   ├── BottomNav.tsx
│           │   └── BottomSheet.tsx
│           └── screens/
│               ├── MobileDashboard.tsx
│               ├── MobileOrders.tsx
│               ├── MobileCustomers.tsx
│               ├── MobileTasks.tsx
│               ├── MobileObjectives.tsx
│               ├── MobileChat.tsx
│               ├── MobileNotifications.tsx
│               ├── MobileStaff.tsx
│               ├── MobileLeads.tsx
│               └── MobileSettings.tsx
```

---

## 2. Tech Stack

| Layer | Tech | Version |
|---|---|---|
| Language | TypeScript | ~5.8.2 |
| Frontend | React | 19.0.1 |
| Build | Vite | 6.2.3 |
| CSS | Tailwind CSS v4 | 4.1.14 |
| Animation | Motion (Framer Motion) | 12.23.24 |
| Charts | Recharts | 3.9.0 |
| Icons | Lucide React | 0.546.0 |
| Backend | Express.js | 4.21.2 |
| ORM | Prisma | 6.2.0 |
| Database | PostgreSQL + db.json backup | -- |

---

## 3. Setup và Chạy dự án

```bash
# Cài dependencies
npm install

# Chạy dev (frontend + backend song song)
npm run dev

# Build production
npm run build
```

**Lưu ý:** Server chạy trên port 3000 (hardcoded trong `server.ts`). Frontend Vite chạy trên port 5173.

---

## 4. Nguyên tắc Fix

### 4.1. Nguyên tắc chung

1. **Đọc kỹ file trước khi sửa** — Luôn đọc toàn bộ file hoặc ít nhất 100 dòng xung quanh khu vực cần fix
2. **Giữ nguyên coding style** — Cùng indentation (2 spaces), cùng naming convention, cùng pattern
3. **Không thêm feature mới** — Chỉ fix vấn đề được giao, không refactor thêm
4. **Test thủ công** — Sau khi fix, chạy `npm run dev` và kiểm tra功能 năng liên quan
5. **Commit message rõ ràng** — Format: `[FIX-C01] Mô tả ngắn gọn`

### 4.2. Quy tắc Import

```typescript
// Thư mục hiện tại
import { Something } from './local-file';
import { Something } from '../parent-dir/file';

// Thư viện bên ngoài
import React from 'react';
import { useParams } from 'react-router-dom';
import { SomeIcon } from 'lucide-react';
```

### 4.3. Quy tắc State Management

- Component state: `useState` với type rõ ràng (tránh `any`)
- Sharing state: Prop drilling hoặc Context (hiện tại không có Redux/Zustand)
- Data fetching: `useEffect` + `fetch` qua `api.ts`

### 4.4. Quy tắc API Calls

```typescript
// Luôn dùng api.ts helper
import { api } from '../lib/api';

// GET
const data = await api.get('/customers');

// POST
const result = await api.post('/orders', { body: orderData });

// PUT
const updated = await api.put(`/orders/${id}`, { body: updateData });

// DELETE
await api.delete(`/orders/${id}`);
```

---

## 5. Hướng dẫn Fix từng Vấn đề

### 5.1. CRITICAL — Bảo mật

#### C-01 + C-06: Bcrypt Password Hashing

**Files cần sửa:** `server.ts`, `src/db_service.ts`

**Bước 1: Cài thư viện**
```bash
npm install bcryptjs
npm install -D @types/bcryptjs
```

**Bước 2: Import trong `server.ts`**
```typescript
import bcrypt from 'bcryptjs';
```

**Bước 3: Hash password khi tạo user (`server.ts` ~dòng 155-163)**
```typescript
// TRƯỚC (sai)
const newUser = {
  ...req.body,
  password_hash: req.body.password,  // plaintext!
};

// SAU (đúng)
const hashedPassword = await bcrypt.hash(req.body.password, 10);
const newUser = {
  ...req.body,
  password_hash: hashedPassword,
};
```

**Bước 4: Hash password khi update user (`server.ts` ~dòng 189)**
```typescript
// TRƯỚC (sai)
const updatedUser = {
  ...existingUser,
  ...req.body,
  password_hash: req.body.password || existingUser.password_hash,
};

// SAU (đúng)
let hashedPassword = existingUser.password_hash;
if (req.body.password) {
  hashedPassword = await bcrypt.hash(req.body.password, 10);
}
const updatedUser = {
  ...existingUser,
  ...req.body,
  password_hash: hashedPassword,
};
```

**Bước 5: So sánh password khi login (`server.ts` ~dòng 68)**
```typescript
// TRƯỚC (sai)
if (user.password_hash !== password) {
  return res.status(401).json({ error: 'Invalid credentials' });
}

// SAU (đúng)
const isValidPassword = await bcrypt.compare(password, user.password_hash);
if (!isValidPassword) {
  return res.status(401).json({ error: 'Invalid credentials' });
}
```

**Bước 6: Fix seed data trong `db_service.ts`**
```typescript
// File: src/db_service.ts ~dòng 258-285
// Cần hash tất cả password trong defaultUsers array
// Dùng同步 hash vì seed data là static
const defaultUsers = [
  {
    id: 'user-admin',
    password_hash: await bcrypt.hash('admin123', 10),  // Thay plaintext
    // ... các field khác
  },
  // ... các users khác
];
```

**Lưu ý quan trọng:** Seed data cần async hash. Có thể dùng `bcrypt.hashSync()` cho seed data vì nó chạy 1 lần khi init.

#### C-02: JWT Authentication

**Files cần sửa:** `server.ts`, `src/App.tsx`

**Bước 1: Cài thư viện**
```bash
npm install jsonwebtoken
npm install -D @types/jsonwebtoken
```

**Bước 2: Thêm JWT_SECRET vào `.env`**
```
JWT_SECRET=your-super-secret-key-change-this-in-production
JWT_EXPIRES_IN=24h
```

**Bước 3: Import trong `server.ts`**
```typescript
import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-me';
```

**Bước 4: Tạo token khi login (`server.ts` ~dòng 68-86)**
```typescript
// TRƯỚC (sai)
res.json({ user: { id: user.id, ... } });

// SAU (đúng)
const token = jwt.sign(
  { userId: user.id, email: user.email },
  JWT_SECRET,
  { expiresIn: '24h' }
);
res.json({ user: { id: user.id, ... }, token });
```

**Bước 5: Middleware xác thực (`server.ts` — thêm mới)**
```typescript
// Thêm middleware function
function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = db.users.find(u => u.id === decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

// Áp dụng cho tất cả routes trừ login/register
app.use('/api', (req, res, next) => {
  if (req.path === '/auth/login' || req.path === '/auth/register') {
    return next();
  }
  authenticateToken(req, res, next);
});
```

**Bước 6: Fix Frontend (`src/App.tsx` ~dòng 131)**
```typescript
// TRƯỚC (sai)
localStorage.setItem('studio_token', data.user.id);

// SAU (đúng)
localStorage.setItem('studio_token', data.token);
// Hoặc dùng httpOnly cookie (an toàn hơn)
```

**Bước 7: Update API calls trong `src/lib/api.ts`**
```typescript
// Thêm Authorization header
const token = localStorage.getItem('studio_token');
if (token) {
  headers['Authorization'] = `Bearer ${token}`;
}
```

#### C-03: Xóa file credentials

**Thực hiện:**
1. Xóa file `New Text Document.txt`
2. Đổi mật khẩu cho `viet@studio.com` trong database
3. Thêm `New Text Document.txt` vào `.gitignore` (phòng ngừa)

#### C-05: Loại bỏ password khi export

**File cần sửa:** `server.ts` ~dòng 1467-1472

```typescript
// TRƯỚC (sai)
app.get('/api/database/export', (req, res) => {
  res.json(db);  // Toàn bộ db bao gồm password_hash
});

// SAU (đúng)
app.get('/api/database/export', (req, res) => {
  const exportData = {
    ...db,
    users: db.users.map(({ password_hash, ...user }) => user),  // Loại bỏ password
  };
  res.json(exportData);
});
```

---

### 5.2. HIGH — Bảo mật và Logic

#### H-01: Rate Limiting

**Bước 1: Cài thư viện**
```bash
npm install express-rate-limit
```

**Bước 2: Import và sử dụng (`server.ts`)**
```typescript
import rateLimit from 'express-rate-limit';

// Tạo limiter cho login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5, // 5 attempts
  message: { error: 'Too many login attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Áp dụng cho login route
app.use('/api/auth/login', loginLimiter);
```

#### H-02: CORS Configuration

**Bước 1: Cài thư viện**
```bash
npm install cors
npm install -D @types/cors
```

**Bước 2: Import và cấu hình (`server.ts`)**
```typescript
import cors from 'cors';

// Cấu hình CORS
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
```

**Thêm vào `.env`:**
```
CORS_ORIGIN=http://localhost:5173
```

#### H-03: Server bind localhost

**File:** `server.ts` ~dòng 1900

```typescript
// TRƯỚC (sai)
app.listen(PORT, '0.0.0.0', () => { ... });

// SAU (đúng)
app.listen(PORT, '127.0.0.1', () => { ... });
// Hoặc nếu cần truy cập từ thiết bị khác trong mạng:
// app.listen(PORT, '0.0.0.0', () => { ... });
```

#### H-06: Fix Operator Precedence Bug

**File:** `server.ts` ~dòng 575

```typescript
// TRƯỚC (sai) - logic sai vì && bind chặt hơn ||
if (req.role?.id === 'role-staff' || ... || req.role?.permissions.includes('tasks.view_own') && !req.role?.permissions.includes('tasks.view_all'))

// SAU (đúng) - thêm ngoặc rõ ràng
if (req.role?.id === 'role-staff' || ... || (req.role?.permissions.includes('tasks.view_own') && !req.role?.permissions.includes('tasks.view_all')))
```

#### H-07: Validate Order Status

**File:** `server.ts` ~dòng 492-537

```typescript
// Thêm validation ở đầu endpoint
const statusOrder = ['pending', 'confirmed', 'shooting', 'editing', 'delivered', 'completed'];

app.put('/api/orders/:id/status', (req, res) => {
  const { status } = req.body;

  // Thêm validation
  if (!status || !statusOrder.includes(status)) {
    return res.status(400).json({
      error: 'Invalid status value',
      allowedStatuses: statusOrder,
    });
  }

  // ... phần logic còn lại
});
```

#### H-08: Thêm Price Fields cho Order

**File:** `server.ts` ~dòng 395-437

```typescript
// Thêm các trường price vào interface và endpoint
app.post('/api/orders', (req, res) => {
  const newOrder = {
    id: `order-${Date.now()}`,
    ...req.body,
    // Thêm các trường mới
    package_price: req.body.package_price || 0,
    deposit_amount: req.body.deposit_amount || 0,
    total_amount: req.body.total_amount || req.body.package_price || 0,
    // ... các field khác
  };
  // ...
});
```

**Cập nhật TypeScript interface trong `db_service.ts`:**
```typescript
interface Order {
  id: string;
  // ... các field hiện có
  package_price: number;
  deposit_amount: number;
  total_amount: number;
}
```

#### H-10: Thêm Pagination

**File:** `server.ts` — tất cả list endpoints

**Pattern cho mỗi list endpoint:**
```typescript
// Ví dụ: GET /api/customers
app.get('/api/customers', (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const total = db.customers.length;
  const items = db.customers.slice(skip, skip + limit);

  res.json({
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});
```

---

### 5.3. MEDIUM — Chất lượng Code

#### M-07: Đọc Port từ Environment

**File:** `server.ts` ~dòng 20

```typescript
// TRƯỚC (sai)
const PORT = 3000;

// SAU (đúng)
const PORT = parseInt(process.env.PORT || '3000', 10);
```

#### M-13: Thêm Error Boundary

**File:** `src/main.tsx` hoặc `src/App.tsx`

```typescript
// Tạo file mới: src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-red-800 font-semibold">Đã xảy ra lỗi</h2>
          <p className="text-red-600 mt-2">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Thử lại
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

// Sử dụng trong App.tsx hoặc main.tsx
import ErrorBoundary from './components/ErrorBoundary';

// Wrap trong App
function App() {
  return (
    <ErrorBoundary>
      {/* Nội dung app hiện tại */}
    </ErrorBoundary>
  );
}
```

#### M-14: Thêm Security Headers

**Bước 1: Cài thư viện**
```bash
npm install helmet
```

**Bước 2: Import và sử dụng (`server.ts`)**
```typescript
import helmet from 'helmet';

// Thêm middleware
app.use(helmet());
```

#### M-06: Đổi Title Index.html

**File:** `index.html`

```html
<!-- TRƯỚC -->
<title>My Google AI Studio App</title>

<!-- SAU -->
<title>The Will Studio</title>
```

#### M-04 + M-05: Xóa File Thừa

```bash
# Xóa các file không cần thiết
rm data_mi.xlsx
rm metadata.json
rm "New Text Document.txt"
```

---

### 5.4. LOW — Code Quality

#### L-01: Đổi package.json name

**File:** `package.json`

```json
{
  "name": "studio-v2",
  // ...
}
```

#### L-05: Cải thiện UUID Generation

**File:** `src/db_service.ts` ~dòng 932

```typescript
// TRƯỚC (yếu)
function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

// SAU (tốt hơn)
function generateId() {
  return crypto.randomUUID();
}
```

**Lưu ý:** `crypto.randomUUID()` yêu cầu Node.js 19+ hoặc browser modern. Nếu cần compatibility:

```typescript
import { v4 as uuidv4 } from 'uuid';

function generateId() {
  return uuidv4();
}
```

#### L-07: Xóa Password Storage

**File:** `src/App.tsx` ~dòng 48, 131-138

```typescript
// TRƯỚC (sai) - lưu password
localStorage.setItem('remembered_password', password);

// SAU (đúng) - chỉ lưu username/email
localStorage.setItem('remembered_email', email);
// KHÔNG lưu password
```

---

## 6. Quy trình Test

### 6.1. Test Thủ công

```bash
# Chạy dev server
npm run dev

# Truy cập:
# Frontend: http://localhost:5173
# Backend: http://localhost:3000
```

### 6.2. Test Cases cho từng Fix

#### Test C-01/C-06 (Password Hashing)
1. Tạo user mới qua API
2. Kiểm tra trong db.json — password phải là bcrypt hash (bắt đầu bằng `$2a$` hoặc `$2b$`)
3. Login với password đúng — phải thành công
4. Login với password sai — phải thất bại

#### Test C-02 (JWT)
1. Login — response phải có `token`
2. Gọi API với header `Authorization: Bearer <token>` — phải thành công
3. Gọi API không có token — phải trả 401
4. Gọi API với token sai/hết hạn — phải trả 403

#### Test H-01 (Rate Limiting)
1. Gọi login 5 lần liên tiếp với password sai
2. Lần thứ 6 phải trả lỗi "Too many attempts"

#### Test H-06 (Operator Precedence)
1. Login với user có role `staff`
2. Kiểm tra user chỉ thấy tasks của mình (nếu có permission `tasks.view_own` nhưng không có `tasks.view_all`)

#### Test H-07 (Order Status Validation)
1. Gọi API với status không hợp lệ — phải trả 400
2. Gọi API với status hợp lệ — phải thành công

### 6.3. TypeScript Check

```bash
# Kiểm tra type errors
npx tsc --noEmit
```

### 6.4. Build Production

```bash
# Build để đảm bảo không có lỗi
npm run build
```

---

## 7. Checklist trước khi Merge

- [ ] Đã đọc kỹ BUG_REPORT.md
- [ ] Đã fix đúng vấn đề được giao
- [ ] Không引入 vấn đề mới
- [ ] Code chạy được (`npm run dev`)
- [ ] TypeScript không có lỗi (`npx tsc --noEmit`)
- [ ] Build thành công (`npm run build`)
- [ ] Test thủ công các chức năng liên quan
- [ ] Commit message đúng format: `[FIX-C01] Mô tả`
- [ ] Không có `console.log` thừa
- [ ] Không có file thừa

---

## 8. Liên hệ Hỗ trợ

Nếu gặp vấn đề không rõ, kiểm tra:
1. `README.md` — tài liệu dự án
2. `BAO_CAO.md` — báo cáo kiểm tra trước đó
3. `BUG_REPORT.md` — danh sách issues hiện tại

---

*Bản hướng dẫn này được tạo bởi MiMoCode Agent — 2026-07-06*
