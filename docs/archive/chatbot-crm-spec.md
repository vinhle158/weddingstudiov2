# Đặc tả kỹ thuật: Chatbot tra cứu & tổng hợp dữ liệu CRM (Rule-based, Next.js + PostgreSQL)

> File này dùng để đưa cho AI coding agent (Claude Code, Cursor, v.v.) triển khai từng bước.
> Agent nên đọc toàn bộ file trước khi bắt đầu code, và thực hiện theo đúng thứ tự các Phase.

---

## 1. Mục tiêu

Xây dựng một chatbot **rule-based** (không dùng LLM) nhúng vào giao diện quản trị CRM hiện có (React + Next.js).
Chatbot cho phép nhân viên gõ câu hỏi bằng tiếng Việt tự nhiên để:
- Tra cứu thông tin khách hàng, đơn hàng, hợp đồng
- Tổng hợp/thống kê số liệu (doanh số, số lượng đơn, trạng thái...) theo thời gian

Chatbot phải trả lời bằng **câu văn tiếng Việt tự nhiên** được sinh từ **template**, không phải dữ liệu thô dạng bảng/JSON.

---

## 2. Stack công nghệ

| Thành phần | Công nghệ |
|---|---|
| Frontend | React (Next.js App Router) |
| Backend | Next.js API Routes (Node.js runtime) |
| Database | PostgreSQL |
| ORM | Prisma |
| Intent/NLU | `node-nlp` (NLP.js) — rule-based, hỗ trợ tiếng Việt |
| Fuzzy matching | `fuse.js` |
| Template rendering | Template string tự viết hoặc `Handlebars` |

Không dùng bất kỳ API LLM (OpenAI, Anthropic, Gemini...) nào trong luồng xử lý chính.

---

## 3. Kiến trúc thư mục

```
components/
  └── ChatWidget.tsx              # UI chat nhúng vào layout CRM

app/api/chatbot/
  └── route.ts                    # API endpoint xử lý tin nhắn

lib/chatbot/
  ├── nlp.ts                      # Khởi tạo & train NLP.js manager (intents + entities)
  ├── intents/
  │   ├── tra-cuu-khach-hang.ts
  │   ├── thong-ke-doanh-so.ts
  │   ├── trang-thai-hop-dong.ts
  │   └── index.ts                # Gom danh sách intent + đăng ký training data
  ├── entityExtractor.ts          # Trích xuất tham số: tên KH, thời gian, mã đơn...
  ├── fuzzyMatch.ts                # So khớp gần đúng tên KH/sản phẩm bằng fuse.js
  ├── queryBuilder.ts              # Map (intent, entities) -> Prisma query
  ├── responseTemplates.ts         # Các mẫu câu trả lời theo intent
  └── types.ts                     # Type definitions dùng chung

prisma/
  └── schema.prisma                # Schema hiện có của CRM (không sửa, chỉ đọc để biết field)
```

---

## 4. Luồng xử lý (Pipeline)

```
User nhập câu hỏi (ChatWidget)
        │
        ▼
POST /api/chatbot { message: string, sessionId?: string }
        │
        ▼
1. classifyIntent(message)        -> { intent, score }
        │
        ▼
2. extractEntities(message, intent) -> { customerName?, dateRange?, status?, ... }
        │
        ▼
3. resolveEntities(entities)      -> fuzzy match tên KH/sản phẩm với DB (fuse.js)
        │
        ▼
4. buildQuery(intent, entities)   -> Prisma query tương ứng
        │
        ▼
5. executeQuery()                 -> dữ liệu thô từ PostgreSQL
        │
        ▼
6. renderResponse(intent, data)   -> chọn template + điền biến
        │
        ▼
Trả về { reply: string, data?: object } cho ChatWidget hiển thị
```

**Quy tắc quan trọng:** Nếu intent không xác định được (`score < threshold`, gợi ý 0.6) hoặc entity bắt buộc bị thiếu, KHÔNG được đoán — trả về câu hỏi làm rõ (clarification), ví dụ:
> "Bạn muốn tra cứu doanh số theo tháng nào ạ?"

---

## 5. Phase 1 — Setup nền tảng

- [ ] Cài đặt dependencies: `node-nlp`, `fuse.js`, `prisma` (nếu chưa có)
- [ ] Tạo cấu trúc thư mục `lib/chatbot/` như mục 3
- [ ] Tạo `types.ts` với các type cơ bản:

```typescript
// lib/chatbot/types.ts
export type Intent =
  | 'tra_cuu_khach_hang'
  | 'thong_ke_doanh_so'
  | 'trang_thai_hop_dong'
  | 'unknown';

export interface ExtractedEntities {
  customerName?: string;
  month?: number;
  year?: number;
  quarter?: number;
  orderCode?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface ChatbotResponse {
  reply: string;
  intent: Intent;
  data?: Record<string, unknown>;
  needsClarification?: boolean;
}
```

---

## 6. Phase 2 — Intent Classification (NLP.js)

Tạo `lib/chatbot/nlp.ts`, khởi tạo `NlpManager` với locale `vi`.

Với **mỗi intent**, cần cung cấp tối thiểu 8-15 câu mẫu đa dạng cách diễn đạt. Ví dụ cho `tra_cuu_khach_hang`:

```typescript
manager.addDocument('vi', 'tìm khách hàng %customerName%', 'tra_cuu_khach_hang');
manager.addDocument('vi', 'tra cứu thông tin khách hàng %customerName%', 'tra_cuu_khach_hang');
manager.addDocument('vi', 'khách hàng %customerName% là ai', 'tra_cuu_khach_hang');
manager.addDocument('vi', 'cho tôi thông tin của %customerName%', 'tra_cuu_khach_hang');
// ... thêm ít nhất 6-8 biến thể nữa
```

Với `thong_ke_doanh_so`:
```typescript
manager.addDocument('vi', 'doanh số tháng này bao nhiêu', 'thong_ke_doanh_so');
manager.addDocument('vi', 'tổng doanh thu quý %quarter%', 'thong_ke_doanh_so');
manager.addDocument('vi', 'thống kê doanh số tháng %month% năm %year%', 'thong_ke_doanh_so');
// ...
```

Sau khi train (`await manager.train()`), lưu model ra file (`manager.save('./model.nlp')`) để tránh train lại mỗi lần server khởi động — chỉ train lại khi thêm intent mới.

**Ngưỡng tin cậy (confidence threshold):** đặt `0.6`. Dưới ngưỡng này → `intent = 'unknown'`.

---

## 7. Phase 3 — Entity Extraction

Tạo `lib/chatbot/entityExtractor.ts`. Kết hợp:

1. **NLP.js entities** (đã khai báo `%customerName%`, `%month%`, `%quarter%` khi training) — dùng cho các slot đơn giản
2. **Regex bổ sung** cho định dạng cố định:

```typescript
// Ví dụ regex cho khoảng thời gian
const monthYearRegex = /tháng\s*(\d{1,2})(?:\s*(?:năm|\/)\s*(\d{4}))?/i;
const orderCodeRegex = /(?:mã\s*đơn|đơn\s*hàng)\s*#?([A-Z0-9\-]+)/i;
const quarterRegex = /quý\s*([1-4])/i;
```

3. **Xử lý mặc định thời gian**: nếu người dùng nói "tháng này", "quý này" mà không có `%month%`/`%year%` rõ ràng → dùng `new Date()` hiện tại để suy ra.

Kết quả trả về đúng type `ExtractedEntities`.

---

## 8. Phase 4 — Fuzzy Matching tên khách hàng/sản phẩm

Tạo `lib/chatbot/fuzzyMatch.ts`.

- Load danh sách tên khách hàng (và tên sản phẩm nếu cần) từ PostgreSQL vào bộ nhớ (cache, refresh định kỳ — ví dụ mỗi 10 phút hoặc theo webhook khi có KH mới)
- Dùng `fuse.js` với `threshold: 0.4` để so khớp tên người dùng gõ (có thể sai dấu, viết tắt) với tên thật trong DB

```typescript
import Fuse from 'fuse.js';

const fuse = new Fuse(customerList, { keys: ['name'], threshold: 0.4 });
const results = fuse.search(rawCustomerName);
const bestMatch = results[0]?.item; // customer object hoặc undefined
```

- Nếu **không tìm thấy** kết quả nào đủ tốt (`results.length === 0`) → trả lời:
  > "Tôi không tìm thấy khách hàng nào tên gần giống '{tên}'. Bạn kiểm tra lại giúp tôi nhé."
- Nếu tìm thấy **nhiều kết quả cùng độ khớp cao** → hỏi lại người dùng để xác nhận chọn đúng khách hàng.

---

## 9. Phase 5 — Query Builder (Prisma)

Tạo `lib/chatbot/queryBuilder.ts`. Mỗi intent map với **một hàm riêng**, KHÔNG dựng câu SQL động từ chuỗi — luôn dùng Prisma query builder (an toàn, tránh injection):

```typescript
// Ví dụ minh họa — Agent cần đối chiếu field thật trong schema.prisma
export async function queryDoanhSo(entities: ExtractedEntities) {
  const { month, year } = resolveTimeRange(entities); // helper xử lý mặc định tháng/năm hiện tại

  const result = await prisma.order.aggregate({
    where: {
      createdAt: {
        gte: new Date(year, month - 1, 1),
        lt: new Date(year, month, 1),
      },
      status: 'completed',
    },
    _sum: { totalAmount: true },
    _count: true,
  });

  return {
    totalAmount: result._sum.totalAmount ?? 0,
    orderCount: result._count,
    month,
    year,
  };
}
```

> ⚠️ **Agent lưu ý:** Trước khi viết các hàm query thật, đọc `prisma/schema.prisma` hiện có để xác định đúng tên model/field (ví dụ `Order`, `Customer`, `Contract`...). Không tự tạo field giả định.

---

## 10. Phase 6 — Response Templates (NLG)

Tạo `lib/chatbot/responseTemplates.ts`. Mỗi intent có **2-3 biến thể template** (chọn ngẫu nhiên hoặc theo điều kiện dữ liệu) để câu trả lời tự nhiên hơn:

```typescript
export function renderDoanhSo(data: { totalAmount: number; orderCount: number; month: number; year: number }) {
  const templates = [
    `Trong tháng ${data.month}/${data.year}, tổng doanh số là ${formatCurrency(data.totalAmount)} với ${data.orderCount} đơn hàng.`,
    `Tháng ${data.month}/${data.year} ghi nhận ${data.orderCount} đơn hàng, tổng doanh thu ${formatCurrency(data.totalAmount)}.`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}
```

- Viết hàm `formatCurrency()` dùng `Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })`
- Với số liệu có thể so sánh (tăng/giảm so với kỳ trước), thêm logic điều kiện chọn từ "tăng"/"giảm"/"không đổi" thay vì hard-code

---

## 11. Phase 7 — API Route

Tạo `app/api/chatbot/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { classifyIntent } from '@/lib/chatbot/nlp';
import { extractEntities } from '@/lib/chatbot/entityExtractor';
import { resolveEntities } from '@/lib/chatbot/fuzzyMatch';
import { buildAndExecuteQuery } from '@/lib/chatbot/queryBuilder';
import { renderResponse } from '@/lib/chatbot/responseTemplates';

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ reply: 'Bạn vui lòng nhập câu hỏi.' }, { status: 400 });
    }

    const { intent, score } = await classifyIntent(message);

    if (intent === 'unknown' || score < 0.6) {
      return NextResponse.json({
        reply: 'Xin lỗi, tôi chưa hiểu rõ câu hỏi. Bạn có thể diễn đạt lại không?',
        intent: 'unknown',
      });
    }

    const rawEntities = await extractEntities(message, intent);
    const entities = await resolveEntities(rawEntities);

    if (entities.needsClarification) {
      return NextResponse.json({
        reply: entities.clarificationQuestion,
        intent,
        needsClarification: true,
      });
    }

    const data = await buildAndExecuteQuery(intent, entities);
    const reply = renderResponse(intent, data);

    return NextResponse.json({ reply, intent, data });
  } catch (error) {
    console.error('[chatbot] error:', error);
    return NextResponse.json(
      { reply: 'Đã có lỗi xảy ra, vui lòng thử lại sau.' },
      { status: 500 },
    );
  }
}
```

---

## 12. Phase 8 — ChatWidget (Frontend)

Tạo `components/ChatWidget.tsx`:

- UI dạng floating chat bubble (góc dưới phải), mở/đóng bằng nút toggle
- State: danh sách tin nhắn (`{ role: 'user' | 'bot', content: string }[]`)
- Gọi `POST /api/chatbot` khi người dùng gửi tin nhắn, hiển thị loading state trong lúc chờ
- Style dùng Tailwind (nếu CRM hiện tại đã dùng Tailwind) để đồng bộ giao diện

Yêu cầu UX:
- [ ] Hiển thị "đang trả lời..." trong lúc chờ API
- [ ] Nếu `needsClarification === true`, giữ ngữ cảnh (sessionId) để lần gửi tiếp theo biết đang trả lời câu hỏi làm rõ nào
- [ ] Auto-scroll xuống tin nhắn mới nhất
- [ ] Cho phép nhấn Enter để gửi

---

## 13. Danh sách Intent ban đầu (MVP)

| Intent | Mô tả | Entity cần thiết |
|---|---|---|
| `tra_cuu_khach_hang` | Tìm thông tin 1 khách hàng | `customerName` (bắt buộc) |
| `thong_ke_doanh_so` | Tổng doanh số theo tháng/quý/năm | `month`+`year` hoặc `quarter` (mặc định: kỳ hiện tại) |
| `trang_thai_hop_dong` | Tra trạng thái hợp đồng của 1 khách hàng | `customerName` (bắt buộc) |

> Agent triển khai xong 3 intent này trước, test kỹ, rồi mới mở rộng thêm intent khác theo yêu cầu thực tế của CRM.

---

## 14. Xử lý ngoại lệ bắt buộc

- [ ] Không tìm thấy khách hàng → thông báo rõ ràng, gợi ý kiểm tra lại tên
- [ ] Khoảng thời gian không hợp lệ (ví dụ "tháng 13") → thông báo lỗi, không crash
- [ ] Câu hỏi ngoài phạm vi 3 intent trên → trả lời "chưa hỗ trợ" kèm gợi ý các loại câu hỏi có thể hỏi
- [ ] Query DB lỗi (timeout, connection) → log lỗi server, trả về thông báo thân thiện cho người dùng, không lộ chi tiết lỗi kỹ thuật

---

## 15. Việc KHÔNG được làm

- Không gọi bất kỳ API LLM bên ngoài nào trong luồng xử lý chính
- Không dựng câu SQL bằng string concatenation — luôn qua Prisma
- Không đoán entity khi confidence thấp — phải hỏi lại người dùng
- Không tự ý thêm/sửa field trong `schema.prisma` — nếu thiếu field cần thiết, báo lại để người dùng bổ sung migration

---

## 16. Tiêu chí hoàn thành (Definition of Done)

- [ ] Cả 3 intent MVP hoạt động đúng với ít nhất 5 câu hỏi thử nghiệm khác cách diễn đạt mỗi intent
- [ ] Fuzzy matching xử lý được tên khách hàng gõ sai dấu/thiếu dấu tiếng Việt
- [ ] ChatWidget nhúng được vào layout CRM hiện tại, không vỡ giao diện
- [ ] Có test case cho: câu hỏi ngoài phạm vi, thiếu entity, khách hàng không tồn tại
- [ ] Code có comment rõ ràng, tách biệt từng layer theo đúng kiến trúc thư mục ở mục 3
