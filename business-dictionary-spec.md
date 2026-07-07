# Đặc tả: Tầng Business Dictionary & Business Concept cho hệ thống truy vấn ngôn ngữ tự nhiên (Non-LLM)

## 0. Bối cảnh & ràng buộc bắt buộc

Hệ thống **KHÔNG dùng AI/LLM** để hiểu ngôn ngữ tự nhiên. Toàn bộ pipeline dựa trên:
`Dictionary → Concept → Rule Engine → SQL`, hoàn toàn rule-based, deterministic, có thể unit test 100%.

**Nguyên tắc bất biến (không được vi phạm khi code):**

1. Không bao giờ ánh xạ trực tiếp chuỗi trong câu hỏi sang giá trị cột/DB. Luôn đi qua Business Concept.
2. Business Concept độc lập hoàn toàn với schema DB. Đổi schema chỉ sửa Rule Mapping.
3. Business Dictionary, Business Concept, Rule đều phải là **dữ liệu cấu hình** (DB table hoặc file YAML/JSON có version), không hard-code trong logic parser.
4. Thêm từ đồng nghĩa / Concept / Rule mới không được sửa code Parser.
5. Mọi quyết định của hệ thống (từ nào khớp, concept nào được chọn, SQL nào được sinh) phải log lại để trace/debug được (explainability).

---

## 1. Kiến trúc pipeline đầy đủ (cập nhật, có bổ sung so với bản gốc)

```
User Question (raw text)
        │
        ▼
[1] Normalizer
        │  (lowercase, chuẩn hoá dấu, xoá ký tự thừa, chuẩn hoá số/ngày viết tắt)
        ▼
[2] Tokenizer / Segmenter
        │  (tách từ, ghép cụm từ nhiều tiếng theo Dictionary — longest-match trước)
        ▼
[3] Entity Extractor (mới — tách riêng khỏi Business Concept)
        │  (số lượng, khoảng thời gian, ngày tháng tương đối: "30 ngày qua", "tháng trước")
        ▼
[4] Business Dictionary Lookup
        │  (map cụm từ → Business Concept, có ưu tiên/độ dài khớp)
        ▼
[5] Intent Classifier (mới — tách riêng khỏi Business Concept)
        │  (COUNT / LIST / DETAIL / SORT_TOP_N / COMPARE...)
        ▼
[6] Business Concept Resolver
        │  (gộp nhiều concept nếu câu hỏi chứa nhiều cụm, xử lý AND/OR/NOT)
        ▼
[7] Ambiguity/Fallback Handler (mới)
        │  (nếu không khớp gì hoặc khớp mâu thuẫn → phản hồi hỏi lại, không đoán)
        ▼
[8] Rule Engine
        │  (concept + entity + intent → điều kiện SQL có tham số hoá)
        ▼
[9] Query Builder
        │  (build SQL an toàn, có parameter binding, chống injection)
        ▼
[10] SQL Execution
        ▼
[11] Natural Language Response Generator (Template Engine)
        │  (kèm trace_id để debug ngược lại bước nào sinh ra câu trả lời này)
        ▼
Response to User
```

---

## 2. Data Model (bắt buộc phải có bảng/cấu hình riêng, KHÔNG hard-code)

### 2.1 Bảng `business_dictionary`
| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | string | |
| phrase | string | cụm từ người dùng, đã normalize |
| concept_id | FK → business_concept | |
| priority | int | dùng khi nhiều phrase overlap |
| is_negation | bool | vd "chưa gọi" khác "đã gọi" |
| locale/tenant | string | nếu multi-tenant |
| version | int | |

### 2.2 Bảng `business_concept`
| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | string | vd `FOLLOW_UP_REQUIRED` |
| description | string | |
| category | string | vd `customer_status`, `order_urgency` |
| requires_entity | bool | concept này có cần entity đi kèm không (vd `INACTIVE_CUSTOMER` cần số ngày) |

### 2.3 Bảng `rule_mapping`
| Trường | Kiểu | Ghi chú |
|---|---|---|
| concept_id | FK | |
| sql_fragment | string (parameterized) | vd `last_order_date < NOW() - INTERVAL ':days days'` |
| default_params | JSON | vd `{ "days": 180 }` |
| schema_version | int | khi đổi tên cột chỉ sửa ở đây |

### 2.4 Bảng `intent_pattern` (mới)
| Trường | Kiểu | Ghi chú |
|---|---|---|
| pattern_keywords | array | vd ["bao nhiêu", "có mấy"] → COUNT |
| intent_type | enum | COUNT / LIST / DETAIL / TOP_N / TREND |

Toàn bộ 4 bảng trên nên có cơ chế **import/export YAML** để business user chỉnh sửa mà không cần dev.

Ví dụ file cấu hình đề xuất (`concepts/follow_up_required.yaml`):

```yaml
concept_id: FOLLOW_UP_REQUIRED
description: "Khách hàng cần được liên hệ/tư vấn"
category: customer_status
synonyms:
  - "cần tư vấn"
  - "chưa gọi"
  - "đợi gọi"
  - "follow up"
  - "chưa chăm sóc"
  - "gọi lại"
rule:
  sql_fragment: "status IN (:statuses) AND is_deleted = false"
  default_params:
    statuses: ["NEW", "WAITING_CALL"]
```

---

## 3. Xử lý các trường hợp khó (bắt buộc code phải cover)

### 3.1 Entity Extraction (tách khỏi Concept)
Concept trả lời "ai" (trạng thái cố định), Entity trả lời "bao nhiêu/khi nào" (tham số động).
Ví dụ: "khách lâu chưa mua trên 90 ngày" →
- Concept: `INACTIVE_CUSTOMER`
- Entity: `{ days: 90 }` → override `default_params.days` trong Rule.

Nếu không có entity trong câu → dùng `default_params`.

### 3.2 Intent Classification (tách khỏi Concept)
Concept + Intent là 2 trục độc lập:

| Câu hỏi | Concept | Intent |
|---|---|---|
| "Có bao nhiêu khách VIP?" | VIP_CUSTOMER | COUNT |
| "Liệt kê khách VIP" | VIP_CUSTOMER | LIST |
| "5 khách VIP gần nhất" | VIP_CUSTOMER | TOP_N (n=5, sort=created_at) |

Query Builder nhận cả 2 để build SQL khác nhau (COUNT(*) vs SELECT * LIMIT).

### 3.3 Phủ định (Negation)
Dictionary entry cần có cờ `is_negation`. Ví dụ:
- "đã gọi" → `status = CONTACTED`
- "chưa gọi" → `status != CONTACTED` (hoặc concept riêng `NOT_CONTACTED`)

Khuyến nghị: mỗi cặp phủ định nên là 2 Concept riêng biệt thay vì 1 Concept + cờ NOT, để Rule Engine không phải tự suy luận phủ định của một SQL fragment tuỳ ý (dễ sai với NULL).

### 3.4 Tổ hợp nhiều Concept trong 1 câu
"Khách VIP nhưng chưa mua trong 90 ngày" → 2 concept: `VIP_CUSTOMER` AND `INACTIVE_CUSTOMER(days=90)`.
Rule Engine phải hỗ trợ compose nhiều rule_fragment bằng AND (mặc định) hoặc OR (khi có từ nối "hoặc").

### 3.5 Ambiguity & Fallback (bắt buộc, không được bỏ qua)
- Nếu 0 concept khớp → trả lời "Tôi chưa hiểu yêu cầu này, bạn có thể diễn đạt cụ thể hơn không?" — **không** được đoán hay tự map gần đúng.
- Nếu ≥2 concept cùng category mâu thuẫn khớp (vd vừa "khách mới" vừa "khách cũ") → hỏi lại người dùng để làm rõ, hoặc log cảnh báo priority conflict.
- Mọi quyết định resolve phải log: `matched_phrases`, `chosen_concepts`, `rejected_concepts`, `reason`.

### 3.6 An toàn khi build SQL
Query Builder chỉ nhận rule_fragment đã parameter hoá sẵn (named params), **không** nối chuỗi trực tiếp từ input người dùng vào SQL. Toàn bộ giá trị entity phải qua parameter binding của driver DB.

---

## 4. Explainability / Tracing

Mỗi request cần trả về (log nội bộ, không nhất thiết hiện cho end-user) một `trace` object:

```json
{
  "trace_id": "...",
  "raw_question": "...",
  "normalized": "...",
  "matched_phrases": [{"phrase": "chưa gọi", "concept": "FOLLOW_UP_REQUIRED"}],
  "extracted_entities": {"days": 90},
  "intent": "LIST",
  "resolved_concepts": ["FOLLOW_UP_REQUIRED"],
  "generated_sql": "SELECT * FROM customers WHERE status IN (...) ...",
  "row_count": 25
}
```

Dùng để debug khi có kết quả sai và để business user hiểu tại sao hệ thống trả lời như vậy.

---

## 5. Testing (bắt buộc, agent phải viết trước khi coi task xong)

- Bộ **golden test set**: tối thiểu 30-50 cặp (câu hỏi → concept kỳ vọng → SQL kỳ vọng), bao gồm cả case phủ định, tổ hợp, entity động, và case fallback (không khớp gì).
- Unit test riêng cho từng tầng: Normalizer, Tokenizer, Entity Extractor, Dictionary Lookup, Intent Classifier, Rule Engine, Query Builder.
- Regression test: khi thêm 1 Concept/Rule mới, chạy lại toàn bộ golden set để đảm bảo không phá case cũ.

---

## 6. Khả năng mở rộng (plugin-based)

- Thêm synonym mới = thêm dòng trong `business_dictionary` hoặc file YAML, không đụng code.
- Thêm Concept mới = thêm entry `business_concept` + `rule_mapping`, không đụng Parser/Tokenizer.
- Thêm Intent mới = thêm pattern vào `intent_pattern`, Query Builder cần switch-case mở rộng được (dùng strategy pattern, không if-else dài).
- Multi-tenant (nếu cần sau này): mọi bảng nên có cột `tenant_id` ngay từ đầu để tránh migrate lại.

---

## 7. Checklist triển khai cho Agent

- [ ] Data model 4 bảng (Dictionary, Concept, Rule, Intent Pattern) + import/export YAML
- [ ] Normalizer (chuẩn hoá tiếng Việt: dấu, viết tắt, số, ngày tương đối)
- [ ] Tokenizer với longest-match phrase lookup + priority resolution
- [ ] Entity Extractor tách riêng (số, ngày, khoảng thời gian)
- [ ] Intent Classifier tách riêng (COUNT/LIST/DETAIL/TOP_N...)
- [ ] Business Concept Resolver hỗ trợ AND/OR/NOT giữa nhiều concept
- [ ] Ambiguity/Fallback handler (không đoán khi không chắc)
- [ ] Rule Engine với parameterized SQL fragment + default_params override bởi entity
- [ ] Query Builder dùng parameter binding, không nối chuỗi SQL thô
- [ ] Trace/log object đầy đủ cho mỗi request
- [ ] Template Engine sinh câu trả lời tự nhiên (không AI)
- [ ] Golden test set (30-50 case) + unit test từng tầng
- [ ] Tài liệu hướng dẫn thêm Concept/Rule/Synonym mới không cần sửa code core
