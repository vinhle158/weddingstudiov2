# STUDIO V2 - Security Round 2 Fix Handoff

Ngày: 2026-07-10  
Repo bắt buộc: `/Users/mac/Documents/STUDIO_V2_GITHUB_MAIN`

## Mục tiêu round 2

Round 1 đã gỡ phần lớn MiMo/Gemini khỏi runtime chính, settings, `.env.example`, UI và schema. Round 2 chỉ tập trung sửa các blocker còn lại để có thể nhận hoàn thành:

1. `npm test` phải tự kết thúc với exit code 0, không cần Ctrl-C.
2. Test không được log lỗi PostgreSQL background sync do thiếu `DATABASE_URL`.
3. Server không được khởi tạo Vite middleware trong môi trường test.
4. Có kế hoạch/ghi chú deploy rõ cho thay đổi Prisma `session_version`.

Không mở rộng scope sang tính năng mới.

## Trạng thái kiểm tra gần nhất

Các lệnh đã chạy:

```bash
npm run lint
npm run build
npm test
```

Kết quả:

- `npm run lint`: pass.
- `npm run build`: pass.
- `npm test`: các test case báo pass nhưng process bị treo, phải Ctrl-C.

Log lỗi trong test:

```text
PostgreSQL background sync failed: PrismaClientInitializationError:
Environment variable not found: DATABASE_URL.
```

Nguyên nhân đã xác định:

- `tests/security.test.ts` gọi `LocalDatabase.save(...)`.
- `LocalDatabase.save()` trong `src/db_service.ts` luôn queue `syncToPostgres(data)`.
- Mock `LocalDatabase.initialize` trong test không chặn `LocalDatabase.save`.
- Server vẫn tạo Vite middleware khi `NODE_ENV=test` vì code đang dùng điều kiện `NODE_ENV !== 'production'`.

## File cần sửa

Ưu tiên các file:

```text
src/db_service.ts
server.ts
tests/security.test.ts
package.json
prisma/schema.prisma
README.md hoặc SECURITY_AGENT_HANDOFF_2026-07-10.md nếu cần ghi deploy note
```

## Việc phải làm

### 1. Tắt PostgreSQL background sync trong test

Hiện tại:

```ts
public static save(data: DatabaseSchema) {
  this.data = data;
  
  this.writeQueue = this.writeQueue
    .then(() => this.syncToPostgres(data))
    .catch(err => {
      console.error('Error in PostgreSQL sync queue:', err);
    });
}
```

Yêu cầu:

- Trong `NODE_ENV === 'test'`, `LocalDatabase.save()` chỉ cập nhật memory cache, không gọi `syncToPostgres`.
- Không được làm ảnh hưởng production.
- Không được cần `DATABASE_URL` khi chạy unit/integration test local.

Gợi ý sửa:

```ts
public static save(data: DatabaseSchema) {
  this.data = data;

  if (process.env.NODE_ENV === 'test') {
    return;
  }

  this.writeQueue = this.writeQueue
    .then(() => this.syncToPostgres(data))
    .catch(err => {
      console.error('Error in PostgreSQL sync queue:', err);
    });
}
```

Nếu muốn linh hoạt hơn, có thể dùng env riêng:

```ts
if (process.env.SKIP_POSTGRES_SYNC === '1') return;
```

Nhưng nếu dùng env riêng thì test phải set env đó trước khi import `src/db_service.ts`.

### 2. Không khởi tạo Vite middleware trong test

Hiện tại cuối `server.ts` có dạng:

```ts
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer(...)
  app.use(vite.middlewares)
} else {
  app.use(express.static(...))
}
```

Yêu cầu:

- Khi `NODE_ENV === 'test'`, không tạo Vite server.
- Test chỉ cần API routes, không cần frontend middleware.
- Server test phải đóng sạch khi `server.close()` trong `after()`.

Gợi ý:

```ts
if (process.env.NODE_ENV === 'test') {
  // API-only test mode: no Vite middleware and no static catch-all.
} else if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer(...)
  app.use(vite.middlewares)
} else {
  app.use(express.static(...))
}
```

Không thêm catch-all static trong test.

### 3. Đảm bảo test đóng server sạch

Trong `tests/security.test.ts`, hiện có:

```ts
after(() => {
  if (serverInstance) {
    serverInstance.close();
  }
});
```

Yêu cầu:

- `after` phải await server close.
- Nếu Prisma client có handle mở, disconnect trong after.
- Không dùng `process.exit(0)` để che lỗi handle. Test phải thoát tự nhiên.

Gợi ý:

```ts
after(async () => {
  if (serverInstance) {
    await new Promise<void>((resolve, reject) => {
      serverInstance.close((err?: Error) => err ? reject(err) : resolve());
    });
  }
});
```

Nếu cần disconnect Prisma:

```ts
import { prisma } from '../src/db_service';

after(async () => {
  ...
  await prisma.$disconnect();
});
```

Chỉ thêm `$disconnect()` nếu sau khi sửa sync/test mode mà process vẫn còn handle mở.

### 4. Sửa test setup để không sync DB trước khi set env

Hiện test đang import `LocalDatabase` rồi mới set env:

```ts
import { LocalDatabase } from '../src/db_service';
...
LocalDatabase.save(mockDb as any);
...
process.env.NODE_ENV = 'test';
```

Yêu cầu:

- Set `process.env.NODE_ENV = 'test'` trước mọi call `LocalDatabase.save`.
- Nếu dùng `SKIP_POSTGRES_SYNC`, set env đó trước khi import module hoặc trước khi gọi `save`.

Vì ESM import chạy trước code thân file, nếu cần env có hiệu lực trước import, hãy chuyển sang dynamic import:

```ts
process.env.NODE_ENV = 'test';
process.env.PORT = '3011';
process.env.JWT_SECRET = 'test-jwt-secret-key';

const { LocalDatabase, prisma } = await import('../src/db_service');
```

Hoặc giữ static import nhưng không gọi `LocalDatabase.save()` trước khi set env. Cách đơn giản nhất là chuyển block set env lên trước `LocalDatabase.save`, nhưng nhớ static import vẫn xảy ra trước.

### 5. Xác minh MiMo/Gemini vẫn chỉ còn ở test và strip legacy

Chạy:

```bash
rg -n "mimo|gemini|MIMO|GEMINI" server.ts src .env.example README.md package.json prisma tests
```

Kết quả hợp lệ chỉ nên nằm ở:

- `tests/security.test.ts`: dữ liệu legacy để test strip key cũ.
- `server.ts`: các dòng `delete cloned.studio_settings.*` để strip legacy field.

Không được còn:

- runtime provider gọi MiMo/Gemini;
- env key trong `.env.example`;
- Settings UI field/input;
- `StudioSettings` interface/schema field sống;
- README hướng dẫn cấu hình LLM.

### 6. Ghi rõ kế hoạch deploy cho `session_version`

Agent đã thêm:

```prisma
session_version Int @default(0)
```

Repo hiện không có thư mục migration Prisma, chỉ có `prisma/schema.prisma`.

Yêu cầu:

- Thêm deploy note ngắn vào markdown handoff hoặc README nội bộ.
- Ghi rõ production phải chạy:

```bash
npx prisma db push
```

hoặc tạo migration nếu team quyết định dùng migration.

Không được báo hoàn thành nếu không nói rõ bước cập nhật DB production. Code mới dùng `user.session_version`; DB thiếu cột sẽ lỗi khi sync/query.

## Lệnh kiểm tra bắt buộc

Chạy đúng thứ tự:

```bash
cd /Users/mac/Documents/STUDIO_V2_GITHUB_MAIN

rg -n "mimo|gemini|MIMO|GEMINI" server.ts src .env.example README.md package.json prisma tests

npm run lint
npm run build
npm test
```

Tiêu chí cho `npm test`:

- Exit code 0.
- Tự kết thúc trong thời gian hợp lý.
- Không cần Ctrl-C.
- Không log `PostgreSQL background sync failed`.
- Không log `DATABASE_URL` missing.

## Không được làm

- Không dùng `process.exit(0)` để ép test thoát.
- Không bỏ test security đã có.
- Không revert việc gỡ MiMo/Gemini.
- Không khôi phục API key LLM vào `.env.example`.
- Không sửa source trực tiếp trên server.
- Không đổi database chính về `db.json`.
- Không tự revert các file handoff untracked.

## Tiêu chí hoàn thành round 2

Chỉ báo hoàn thành khi:

- `npm run lint` pass.
- `npm run build` pass.
- `npm test` pass và tự thoát sạch.
- `rg mimo/gemini` chỉ còn match hợp lệ trong test legacy và strip legacy.
- Có ghi chú deploy cho `session_version`.
- Không có secret thật trong diff.

## Báo cáo cuối cần có

Agent báo lại ngắn:

```text
Round 2 fixed:
- ...

Commands:
- npm run lint: pass
- npm run build: pass
- npm test: pass, exited cleanly
- rg mimo/gemini: only legacy strip/test references remain

Deploy note:
- session_version requires ...

Remaining risk:
- ...
```
