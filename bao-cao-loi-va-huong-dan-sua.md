# Báo cáo rà soát logic Chatbot CRM & Hướng dẫn khắc phục

> Tài liệu này tổng hợp các lỗi logic phát hiện được khi rà soát bản mô tả pipeline/intent do agent triển khai (dự án "Aura Bridal"), dựa trên nội dung mã nguồn/query/template được tài liệu hóa trong sơ đồ. Đưa file này cho agent để xử lý theo đúng thứ tự ưu tiên bên dưới.

---

## Cách sử dụng tài liệu này

Agent xử lý theo thứ tự: **P0 → P1 → P2 → P3**. Sau khi sửa xong mỗi mục, viết lại test case tương ứng (input mẫu + kết quả mong đợi) để xác nhận đã sửa đúng, không chỉ sửa qua loa.

---

## P0 — Lỗi có thể gây crash hoặc sai dữ liệu nghiêm trọng (sửa ngay)

### P0-1. `CUSTOMER_LIST` không kiểm tra `null` trước khi truy cập `.id`

**Vị trí lỗi:**
```js
const customer = await prisma.customer.findFirst({ where: { full_name: { contains: name } } });
const orders = await prisma.order.findMany({ where: { customer_id: customer.id } });
```

**Vấn đề:** Nếu không tìm thấy khách hàng khớp tên, `customer` là `null`. Gọi `customer.id` sẽ throw `TypeError`, làm hỏng cả request thay vì trả lời người dùng.

**Yêu cầu sửa:**
```js
const customer = await prisma.customer.findFirst({ where: { full_name: { contains: name } } });

if (!customer) {
  return {
    reply: `Tôi không tìm thấy khách hàng nào tên "${name}". Bạn kiểm tra lại giúp mình nhé.`,
    needsClarification: false,
  };
}

const orders = await prisma.order.findMany({ where: { customer_id: customer.id } });
```

Áp dụng pattern này cho **mọi query dùng kết quả `findFirst`/`findUnique` của khách hàng** trước khi dùng `.id`, bao gồm cả intent `trang_thai_hop_dong` (dùng `resolveCustomer(name)` — cũng cần guard tương tự nếu hàm này có thể trả về `undefined`/`null`).

---

### P0-2. `BUSINESS_OVERVIEW` gọi sai kiểu dữ liệu khi format tiền

**Vị trí lỗi:**
```js
const totalSales = await prisma.order.aggregate({ _sum: { total_amount: true } });
// template: Doanh thu: ${totalSales.toLocaleString('vi-VN')} đ
```

**Vấn đề:** `totalSales` là object dạng `{ _sum: { total_amount: number } }`, không phải số. Gọi `.toLocaleString()` trực tiếp trên object này sai hoàn toàn.

**Yêu cầu sửa:**
```js
const totalSalesAgg = await prisma.order.aggregate({
  where: { status: { not: 'cancelled' } }, // xem thêm P1-1
  _sum: { total_amount: true },
});
const totalSalesAmount = totalSalesAgg._sum.total_amount ?? 0;

// Trong template:
`Doanh thu: ${totalSalesAmount.toLocaleString('vi-VN')} đ`
```

Rà soát toàn bộ các intent khác có dùng `.aggregate()` (nếu có) để đảm bảo không mắc lỗi tương tự.

---

### P0-3. `OPERATIONAL_ALERTS` dùng sai tập dữ liệu để tính "đơn thiếu ekip"

**Vị trí lỗi:**
```js
const overdueTasks = await prisma.task.findMany({
  where: { status: { notIn: ['done', 'cancelled'] }, due_date: { lt: today } }
});
const activeOrders = await prisma.order.findMany({ where: { status: { notIn: ['cancelled', 'delivered'] } } });
const missingEkip = activeOrders.filter(o => !tasks.some(t => t.order_id === o.id));
```

**Vấn đề:** biến dùng để so khớp là `tasks` — nhưng `tasks` không được định nghĩa ở scope này, chỉ có `overdueTasks`. Nếu thực tế code đang dùng nhầm `overdueTasks` (tập con — chỉ chứa việc **quá hạn**) để suy ra "đơn thiếu ekip", thì mọi đơn hàng có công việc **chưa tới hạn** vẫn bị báo sai là "chưa phân công" → cảnh báo giả (false positive) gây hoang mang không cần thiết.

**Yêu cầu sửa:** Phải dùng tập **toàn bộ task đang active** (không giới hạn theo hạn), tách riêng biến cho từng mục đích:
```js
const allActiveTasks = await prisma.task.findMany({
  where: { status: { notIn: ['done', 'cancelled'] } },
});

const overdueTasks = allActiveTasks.filter(t => t.due_date < today);

const activeOrders = await prisma.order.findMany({
  where: { status: { notIn: ['cancelled', 'delivered'] } },
});

const missingEkip = activeOrders.filter(
  o => !allActiveTasks.some(t => t.order_id === o.id)
);
```

---

## P1 — Lỗ hổng logic nghiệp vụ (sai số liệu âm thầm, không crash nhưng dữ liệu sai)

### P1-1. Doanh thu tổng quan không loại trừ đơn đã hủy

**Vấn đề:** `BUSINESS_OVERVIEW` tính `totalSales` trên toàn bộ đơn hàng, không lọc `status != 'cancelled'`. Nếu có đơn bị hủy, số liệu doanh thu báo cáo sẽ cao hơn thực tế.

**Yêu cầu sửa:** Thêm điều kiện `where: { status: { not: 'cancelled' } }` vào mọi query tính tổng doanh thu (xem code sửa mẫu ở P0-2).

---

### P1-2. `LEAD_SUCCESS_REASONS` / `LEAD_FAILURE_REASONS`: thiếu bước gộp nhóm (group by)

**Vấn đề:** Query hiện tại chỉ lấy danh sách lead thô:
```js
const leads = await prisma.lead.findMany({ where: { status: 'won', success_reason: { not: null } } });
```
Nhưng template lại yêu cầu hiển thị **số liệu đã đếm theo từng mã lý do**:
```
• Mã K1 (Nhu cầu rõ ràng / Hợp gu): 5 khách hàng
• Mã K3 (Tin tưởng thương hiệu lớn): 3 khách hàng
```
Bước tính đếm/gộp nhóm theo `success_reason` chưa tồn tại ở đâu trong pipeline — nếu chạy đúng như tài liệu, tính năng này sẽ không cho ra kết quả như template mô tả.

**Yêu cầu sửa:** Thêm bước xử lý sau khi query:
```js
const leads = await prisma.lead.findMany({
  where: { status: 'won', success_reason: { not: null } },
  select: { success_reason: true },
});

const grouped = leads.reduce((acc, lead) => {
  acc[lead.success_reason] = (acc[lead.success_reason] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

// grouped dùng để render template, ví dụ:
// Object.entries(grouped).map(([reason, count]) => `• ${reason}: ${count} khách hàng`)
```

Áp dụng tương tự cho `LEAD_FAILURE_REASONS`.

---

### P1-3. `LEAD_SUPPORT_REQUESTS` giả định sai kiểu dữ liệu rỗng

**Vị trí lỗi:**
```js
where: { support_needed: { not: '' } }
```

**Vấn đề:** Nếu cột `support_needed` trong schema thực tế cho phép `null` (rất phổ biến với field optional), điều kiện `not: ''` sẽ **không lọc được gì**, âm thầm trả về 0 kết quả dù thực tế có lead cần hỗ trợ. Đây là loại lỗi nguy hiểm vì không có thông báo lỗi nào cả — chỉ đơn giản là sai một cách im lặng.

**Yêu cầu sửa:**
1. Kiểm tra `schema.prisma` thật xem field `support_needed` là kiểu `String?` hay `String` với default `''`.
2. Viết điều kiện lọc theo đúng kiểu dữ liệu thật, ví dụ nếu cho phép null:
```js
where: { AND: [{ support_needed: { not: null } }, { support_needed: { not: '' } }] }
```

---

## P2 — Thiết kế không nhất quán (rủi ro về lâu dài, cần refactor)

### P2-1. Hai cách tìm khách hàng khác nhau cho cùng một loại nhu cầu

**Vấn đề:**
- `CUSTOMER_LIST` dùng `prisma.customer.findFirst({ contains: name })` — không fuzzy match, không xử lý trùng tên
- `trang_thai_hop_dong` dùng `resolveCustomer(name)` — có fuzzy-match theo đúng thiết kế ban đầu (xem mục Fuzzy Matching trong spec gốc)

→ Cùng một câu hỏi có tên khách hàng, độ chính xác/khả năng chịu lỗi chính tả sẽ khác nhau tùy vào việc rơi vào intent nào — đây là lỗi thiết kế, không phải chi tiết vặt.

**Yêu cầu sửa:** Gộp về **một hàm `resolveCustomer(name)` duy nhất** (dùng fuzzy matching qua `fuse.js` như đã đặc tả ở spec gốc), dùng chung cho **mọi intent** cần tra tên khách hàng: `CUSTOMER_LIST`, `trang_thai_hop_dong`, `ORDER_LIST`, v.v. Không được để mỗi intent tự viết logic tìm kiếm riêng.

**Xử lý trường hợp nhiều kết quả khớp:** nếu `resolveCustomer()` trả về nhiều hơn 1 kết quả với độ khớp gần bằng nhau, trả lời dạng hỏi lại để xác nhận, ví dụ:
> "Tôi tìm thấy 2 khách hàng tên gần giống 'Hà': Lê Thu Hà và Nguyễn Thị Hà. Bạn muốn hỏi về ai?"

---

### P2-2. Bộ phân loại Intent (NLU) yếu với câu hỏi chỉ chứa tên riêng

**Vấn đề:** Câu hỏi chỉ gõ đúng tên khách hàng (ví dụ: "lê thu hà", không kèm động từ) bị phân loại sai thành intent thống kê tổng quan, phải xử lý bằng cách "override" thủ công. Nguyên nhân gốc: toàn bộ câu mẫu huấn luyện (training utterances) cho `CUSTOMER_LIST` đều có khung câu đi kèm ("tìm khách hàng %customerName%", "hồ sơ %customerName%"...) — không có mẫu nào chỉ là tên trần trụi. Trong thực tế nhân viên CRM thường gõ/dán thẳng tên khách hàng không kèm động từ.

Vá bằng override từng trường hợp cụ thể là **chữa triệu chứng, không chữa gốc** — sẽ tiếp tục sai với các tên khách hàng khác không nằm trong danh sách override.

**Yêu cầu sửa (chọn 1 trong 2, ưu tiên cách A):**

**Cách A — Sửa tại tầng resolve, không sửa tại tầng NLU (khuyến nghị):**
Thêm một bước kiểm tra **trước khi tin vào intent do NLP.js trả về**: nếu toàn bộ nội dung tin nhắn (sau khi chuẩn hóa) khớp gần đúng với một tên khách hàng có thật trong DB (qua fuzzy match), và độ tin cậy (`score`) của intent được NLP.js trả về không cao hơn hẳn (ví dụ chênh lệch < 0.15), thì **ưu tiên intent `CUSTOMER_LIST`** bất kể NLP.js phân loại là gì.

```js
// Giả lập logic trong entityExtractor.ts hoặc route.ts
const nluResult = await classifyIntent(message);
const possibleCustomer = await fuzzyMatchCustomerName(message.trim());

if (possibleCustomer && possibleCustomer.score > 0.7 && nluResult.score < possibleCustomer.score + 0.15) {
  finalIntent = 'CUSTOMER_LIST';
} else {
  finalIntent = nluResult.intent;
}
```

**Cách B — Bổ sung training data (chỉ nên làm thêm, không thay thế Cách A):**
Thêm các câu mẫu huấn luyện chỉ gồm tên trần trụi cho `CUSTOMER_LIST`, nhưng cách này không mở rộng được cho tên khách hàng chưa từng huấn luyện, nên không đủ để giải quyết gốc vấn đề.

---

## P3 — Thiếu tính năng so với yêu cầu MVP ban đầu

### P3-1. Mất chức năng thống kê doanh số theo thời gian cụ thể

**Vấn đề:** Trong đặc tả MVP ban đầu, intent `thong_ke_doanh_so` được thiết kế để lọc doanh số theo **tháng/quý/năm cụ thể** (ví dụ: "doanh số tháng 6 là bao nhiêu"). Trong bộ 14 intent hiện tại, chức năng này đã bị thay bằng `BUSINESS_OVERVIEW` — nhưng `BUSINESS_OVERVIEW` chỉ tính tổng toàn thời gian, **không nhận tham số thời gian nào cả**.

→ Câu hỏi "doanh số tháng 6 là bao nhiêu" — một trong 3 yêu cầu MVP gốc — hiện **không có intent nào xử lý được**.

**Yêu cầu xử lý:** Agent cần xác nhận đây là **cố ý bỏ** (do đổi hướng sản phẩm) hay **bị rớt mất** trong lúc mở rộng sang 14 intent. Nếu vẫn cần tính năng này, bổ sung lại entity `month`/`year`/`quarter` cho `BUSINESS_OVERVIEW`, hoặc tách riêng thành intent `REVENUE_BY_PERIOD` với query có điều kiện lọc thời gian như bản spec gốc mục 9 (Phase 5 — Query Builder).

---

### P3-2. Không nhất quán tên intent

**Vấn đề:** 13/14 intent dùng `UPPER_SNAKE_CASE` (`BUSINESS_OVERVIEW`, `CUSTOMER_LIST`, `TASK_LIST`...), riêng `trang_thai_hop_dong` còn dùng kiểu đặt tên cũ (`lower_snake_case`) từ bản MVP ban đầu — chưa được refactor đồng bộ.

**Yêu cầu sửa:** Đổi thành `CONTRACT_STATUS` (hoặc tên tương đương theo convention chung), đồng thời xử lý luôn mục P3-3 bên dưới trong lúc đổi tên.

---

### P3-3. Chồng chéo chức năng giữa 3 intent liên quan đến hợp đồng

**Vấn đề:** `CUSTOMER_LIST` (trả cả danh sách hợp đồng + trạng thái khi tra khách hàng), `ORDER_LIST` (trả hợp đồng), và `trang_thai_hop_dong` (tra trạng thái hợp đồng theo khách hàng) có phạm vi chồng lấn đáng kể. Rủi ro: câu hỏi kiểu "hợp đồng của chị Hà tới đâu rồi" có thể bị phân loại vào bất kỳ 1 trong 3 intent này tùy ngẫu nhiên theo training data.

**Yêu cầu sửa:** Chọn 1 trong 2 hướng, thống nhất với agent trước khi code:
- **Gộp:** xóa `trang_thai_hop_dong`, để `CUSTOMER_LIST` xử lý luôn câu hỏi về trạng thái hợp đồng khi có tên khách hàng
- **Tách rõ ranh giới:** `CUSTOMER_LIST` chỉ trả thông tin liên hệ + tổng quan (không kèm chi tiết hợp đồng), `trang_thai_hop_dong`/`CONTRACT_STATUS` xử lý riêng phần hợp đồng chi tiết theo tên khách hàng

Sau khi chọn hướng, cập nhật lại bộ training utterances để 2 intent không còn overlap về mặt câu mẫu.

---

## Checklist bàn giao lại (Definition of Done cho vòng sửa lỗi này)

- [ ] P0-1, P0-2, P0-3: có unit test hoặc test case thủ công chứng minh không còn crash/sai số liệu
- [ ] P1-1, P1-2, P1-3: chạy thử với dữ liệu mẫu có ít nhất 1 đơn hủy, 1 lead có `support_needed = null`, xác nhận số liệu đúng
- [ ] P2-1: mọi intent liên quan khách hàng đều gọi qua cùng 1 hàm `resolveCustomer()`
- [ ] P2-2: thử ít nhất 5 tên khách hàng khác nhau (không có trong danh sách override cũ) chỉ gõ tên trần trụi, xác nhận nhận đúng intent `CUSTOMER_LIST`
- [ ] P3-1: xác nhận với người yêu cầu (bạn) về việc giữ/bỏ tính năng lọc doanh số theo thời gian
- [ ] P3-2, P3-3: intent naming đồng bộ, không còn 2 intent chồng chéo phạm vi

Agent nên báo cáo lại theo từng mục P0/P1/P2/P3 đã xử lý, kèm ví dụ input/output cụ thể để bạn xác minh — không chỉ báo "đã sửa xong" chung chung.
