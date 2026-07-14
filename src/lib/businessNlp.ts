import fs from 'fs';
import path from 'path';
import { prisma } from '../db_service';
import { formatVndFromThousands } from './money';

// Các interface tương ứng với phần 2 của đặc tả NLP.
export interface DictionaryEntry {
  id: string;
  phrase: string;
  concept_id: string;
  priority: number;
  is_negation: boolean;
}

export interface BusinessConcept {
  id: string;
  description: string;
  category: 'overview' | 'customers' | 'orders' | 'tasks' | 'leads' | 'staff' | 'alerts';
  requires_entity: boolean;
}

export interface RuleMapping {
  concept_id: string;
  sql_fragment: string;
  default_params: Record<string, any>;
}

export interface IntentPattern {
  pattern_keywords: string[];
  intent_type: 'COUNT' | 'LIST' | 'DETAIL' | 'TOP_N';
}

export interface NlpConfig {
  version: number;
  dictionary: DictionaryEntry[];
  concepts: BusinessConcept[];
  rules: RuleMapping[];
  intent_patterns: IntentPattern[];
}

export interface TraceObject {
  trace_id: string;
  raw_question: string;
  normalized: string;
  matched_phrases: { phrase: string; concept: string }[];
  extracted_entities: Record<string, any>;
  intent: 'COUNT' | 'LIST' | 'DETAIL' | 'TOP_N';
  resolved_concepts: string[];
  generated_sql: string;
  sql_params: any[];
  row_count: number;
}

// Hàm tiện ích dùng chung.
const configPath = path.join(process.cwd(), 'config', 'business_nlp_config.json');

export function loadNlpConfig(): NlpConfig {
  if (!fs.existsSync(configPath)) {
    throw new Error(`NLP configuration file not found at: ${configPath}`);
  }
  const raw = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(raw);
}

// Chuẩn hóa văn bản theo phần 2 của đặc tả.
export function normalizeVietnamese(text: string): string {
  let str = text.toLowerCase().trim();
  // Loại dấu tiếng Việt để so khớp ổn định.
  str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Đổi "đ" thành "d" sau bước bỏ dấu.
  str = str.replace(/đ/g, 'd');
  // Loại ký tự đặc biệt.
  str = str.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, ' ');
  // Gộp nhiều khoảng trắng liên tiếp.
  str = str.replace(/\s+/g, ' ').trim();
  return str;
}

// Tách token và tìm cụm từ khớp dài nhất theo phần 1 và 3.
export function lookupPhrases(normalizedText: string, config: NlpConfig): { matched: { phrase: string; concept: string }[]; remainingText: string } {
  const words = normalizedText.split(' ');
  const matched: { phrase: string; concept: string; priority: number }[] = [];
  
  // Ưu tiên cụm dài hơn, sau đó ưu tiên mục có priority cao hơn.
  const sortedDict = [...config.dictionary].sort((a, b) => {
    const aLen = a.phrase.split(' ').length;
    const bLen = b.phrase.split(' ').length;
    if (aLen !== bLen) return bLen - aLen;
    return b.priority - a.priority;
  });

  let remaining = normalizedText;

  for (const entry of sortedDict) {
    const entryPhrase = entry.phrase;
    // Chỉ nhận cụm từ khớp trọn ranh giới từ.
    const regex = new RegExp(`\\b${entryPhrase}\\b`, 'gi');
    if (regex.test(remaining)) {
      matched.push({
        phrase: entry.phrase,
        concept: entry.concept_id,
        priority: entry.priority
      });
      // Đánh dấu phần đã khớp để tránh nhận diện lồng nhau.
      remaining = remaining.replace(regex, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  // Loại kết quả trùng và xử lý độ ưu tiên.
  const resolved = matched.reduce((acc, current) => {
    const x = acc.find(item => item.concept === current.concept);
    if (!x) {
      return acc.concat([current]);
    } else if (current.priority > x.priority) {
      return acc.filter(item => item.concept !== current.concept).concat([current]);
    }
    return acc;
  }, [] as typeof matched);

  return {
    matched: resolved.map(r => ({ phrase: r.phrase, concept: r.concept })),
    remainingText: remaining
  };
}

// Trích xuất thực thể theo phần 3.1.
export function extractEntities(question: string): Record<string, any> {
  const entities: Record<string, any> = {};
  const normalized = normalizeVietnamese(question);

  // 1. Số điện thoại có ít nhất sáu chữ số.
  const phoneMatch = normalized.replace(/[^\d]/g, '').match(/\d{6,15}/);
  if (phoneMatch) {
    entities.phone = phoneMatch[0];
  }

  // 2. Mã đơn hàng như OD1001 hoặc ORD-1002.
  const orderCodeMatch = question.match(/(?:OD|ORD)[-\s]*\d+/i);
  if (orderCodeMatch) {
    entities.order_code = orderCodeMatch[0].toUpperCase().replace(/\s+/g, '');
  }

  // 3. Trích xuất ngày theo dạng DD/MM/YYYY hoặc DD-MM.
  const dateMatch = question.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1]);
    const month = parseInt(dateMatch[2]);
    const year = dateMatch[3] ? parseInt(dateMatch[3]) : new Date().getFullYear();
    const formatted = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    entities.start_date = formatted;
    entities.end_date = formatted;
  }

  // 4. Trích xuất khoảng thời gian tương đối.
  if (normalized.includes('ngay mai') || normalized.includes('ngay mai')) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    entities.start_date = tomorrowStr;
    entities.end_date = tomorrowStr;
  } else if (normalized.includes('tuan nay') || normalized.includes('tuan nay')) {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 is Sun, 1 is Mon
    const start = new Date(today);
    start.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    entities.start_date = start.toISOString().split('T')[0];
    entities.end_date = end.toISOString().split('T')[0];
  } else if (normalized.includes('tuan sau') || normalized.includes('tuan sau')) {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    entities.start_date = start.toISOString().split('T')[0];
    entities.end_date = end.toISOString().split('T')[0];
  } else if (normalized.includes('hom nay') || normalized.includes('hom nay')) {
    const todayStr = new Date().toISOString().split('T')[0];
    entities.start_date = todayStr;
    entities.end_date = todayStr;
  }

  // 5. Trích xuất số lượng giới hạn, ví dụ 5 người hoặc top 10.
  const limitMatch = normalized.match(/top\s*(\d+)/i) || normalized.match(/limit\s*(\d+)/i) || normalized.match(/(\d+)\s*(khach|don|lead|task|nguoi)/i);
  if (limitMatch) {
    entities.limit = parseInt(limitMatch[1]);
  } else {
    entities.limit = 5;
  }

  return entities;
}

// Phân loại intent theo phần 3.2.
export function classifyIntent(normalizedText: string, config: NlpConfig): 'COUNT' | 'LIST' | 'DETAIL' | 'TOP_N' {
  // Kiểm tra mẫu từ khóa TOP_N.
  if (/\btop\s*\d+\b/i.test(normalizedText) || normalizedText.includes('gan nhat') || normalizedText.includes('moi nhat')) {
    return 'TOP_N';
  }

  // Kiểm tra các mẫu intent trong cấu hình.
  for (const pattern of config.intent_patterns) {
    for (const keyword of pattern.pattern_keywords) {
      if (normalizedText.includes(keyword)) {
        return pattern.intent_type;
      }
    }
  }

  // Dùng intent LIST khi không có mẫu cụ thể hơn.
  return 'LIST';
}

// Bảng dịch mã trạng thái sang nội dung hiển thị.
export const statusTranslationMap: Record<string, string> = {
  new: 'Đơn mới',
  confirmed: 'Đã xác nhận',
  shooting: 'Đang chụp',
  editing: 'Đang hậu kỳ',
  ready: 'Sẵn sàng',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
  pending: 'Chờ thực hiện',
  in_progress: 'Đang làm',
  done: 'Đã xong',
  consulting: 'Đang tư vấn',
  won: 'Thành công',
  lost: 'Thất bại',
  low: 'Thấp',
  normal: 'Trung bình',
  high: 'Cao'
};

export function translateStatus(status: string): string {
  if (!status) return 'N/A';
  return statusTranslationMap[status.toLowerCase()] || status;
}

// Bộ sinh câu trả lời theo phần 1 và 11.
export function generateNaturalResponse(intent: string, resolvedConcepts: string[], rows: any[], traceId: string, extractedEntities: Record<string, any>): string {
  let reply = '';

  const concept = resolvedConcepts[0];
  
  if (concept === 'BUSINESS_OVERVIEW') {
    // Truy vấn tổng quan trả về một object dữ liệu.
    const stats = rows[0] || {};
    reply += `Chào bạn! Dưới đây là thông tin hoạt động tổng quan của studio:\n\n`;
    reply += `• **Khách hàng:** Tổng số **${stats.customers || 0}** khách hàng đã đăng ký.\n`;
    reply += `• **Đơn hàng:** Có **${stats.orders || 0}** đơn hàng (trong đó đang xử lý **${stats.active_orders || 0}** đơn).\n`;
    reply += `• **Doanh thu:** Tổng doanh thu đạt **${formatVndFromThousands(stats.total_order_value)}**.\n`;
    reply += `• **Công việc:** Có **${stats.pending_tasks || 0}** việc cần làm (trong đó **${stats.overdue_tasks || 0}** việc đã quá hạn).\n`;
    reply += `• **Lead tư vấn:** Hiện có **${stats.active_leads || 0}** khách hàng tiềm năng đang được chăm sóc.`;
  }
  else if (concept === 'CUSTOMER_LIST' || resolvedConcepts.includes('CUSTOMER_LIST')) {
    if (rows.length === 0) return `Không tìm thấy khách hàng nào khớp với yêu cầu.`;
    reply += `Tìm thấy thông tin khách hàng phù hợp:\n\n`;
    rows.forEach((c: any) => {
      reply += `• KH: **${c.full_name}** - SĐT: **${c.phone || 'N/A'}** - Email: **${c.email || 'N/A'}**\n`;
    });
  }
  else if (concept === 'LEAD_LIST') {
    if (rows.length === 0) return `Không có lead tiềm năng nào đang tư vấn trong CRM.`;
    reply += `Dưới đây là danh sách khách hàng tiềm năng (Lead) đang tư vấn:\n\n`;
    rows.forEach((l: any) => {
      reply += `• KH: **${l.customer_name}** - SĐT: **${l.phone || 'N/A'}** - Nguồn: **${l.source}**\n`;
      reply += `  - Bước bán hàng: **${l.sales_step}/6** - Trạng thái: **${translateStatus(l.status)}** (Người phụ trách: **${l.assigned_sale_name || 'N/A'}**)\n`;
      if (l.notes) {
        reply += `  - Ghi chú: *${l.notes}*\n`;
      }
    });
  }
  else if (concept === 'ORDER_LIST' || resolvedConcepts.includes('ORDER_LIST')) {
    if (rows.length === 0) return `Không tìm thấy đơn hàng/hợp đồng nào phù hợp.`;
    reply += `Tìm thấy các đơn hàng/hợp đồng phù hợp:\n\n`;
    rows.forEach((o: any) => {
      reply += `• Hợp đồng **[${o.order_code}]** - KH: **${o.customer_name}** - Trạng thái: **${translateStatus(o.status)}** - Gói: **"${o.package_name}"** - Ngày chụp: **${o.shoot_date}**\n`;
    });
  }
  else if (concept === 'SCHEDULE_RANGE') {
    if (rows.length === 0) return `Không có lịch chụp nào trong khoảng thời gian từ ${extractedEntities.start_date || ''} đến ${extractedEntities.end_date || ''}.`;
    reply += `Dưới đây là danh sách lịch chụp từ ngày ${extractedEntities.start_date} đến ${extractedEntities.end_date}:\n\n`;
    rows.forEach((s: any) => {
      reply += `• **[${s.order_code}]** KH: **${s.customer_name}** - Gói: **"${s.package_name}"** lúc **${s.shoot_time || '08:30'}** ngày **${s.shoot_date}** (Trạng thái: **${translateStatus(s.status)}**)\n`;
    });
  }
  else if (concept === 'TASK_LIST' || concept === 'OVERDUE_TASKS') {
    if (rows.length === 0) return `Không tìm thấy công việc nào phù hợp.`;
    reply += `Tìm thấy các công việc phù hợp với yêu cầu của bạn:\n\n`;
    rows.forEach((t: any) => {
      reply += `• [**${translateStatus(t.status)}**] **"${t.title}"** (Độ ưu tiên: **${translateStatus(t.priority)}**, Hạn: **${t.due_date || 'Không giới hạn'}**, Giao cho: **${t.assigned_to_name || 'N/A'}**)\n`;
    });
  }
  else if (concept === 'STAFF_WORKLOAD') {
    if (rows.length === 0) return `Không tìm thấy dữ liệu khối lượng công việc nhân viên.`;
    reply += `Dưới đây là thống kê khối lượng công việc hiện tại của đội ngũ nhân sự:\n\n`;
    rows.forEach((w: any) => {
      reply += `• **${w.full_name}**: Đang phụ trách **${w.pending_tasks || 0}** việc chưa hoàn thành (quá hạn: **${w.overdue_tasks || 0}**)\n`;
    });
  }
  else if (concept === 'OPERATIONAL_ALERTS') {
    const overdue = rows.filter(r => r.alert_type === 'overdue_task');
    const missingAssignments = rows.filter(r => r.alert_type === 'missing_assignment');
    const missingDeposits = rows.filter(r => r.alert_type === 'missing_deposit');

    if (rows.length === 0) {
      return 'Tôi đã kiểm tra hệ thống và hiện tại không có cảnh báo vận hành nào bất thường.';
    }

    reply += 'Dưới đây là một số điểm cần lưu ý về mặt vận hành:\n\n';
    if (overdue.length > 0) {
      reply += `⚠️ **Công việc quá hạn:**\n`;
      overdue.forEach((t: any) => {
        reply += `  - **"${t.title}"** (Hạn: **${t.due_date}**, Người làm: **${t.assigned_to_name}**)\n`;
      });
    }
    if (missingAssignments.length > 0) {
      reply += `\n⚠️ **Đơn sắp chụp chưa phân công công việc:**\n`;
      missingAssignments.forEach((o: any) => {
        reply += `  - Đơn **[${o.order_code}]** KH: **${o.customer_name}** chụp lúc **${o.shoot_date} ${o.shoot_time || ''}**\n`;
      });
    }
    if (missingDeposits.length > 0) {
      reply += `\n⚠️ **Hợp đồng chưa đặt cọc:**\n`;
      missingDeposits.forEach((o: any) => {
        reply += `  - Đơn **[${o.order_code}]** KH: **${o.customer_name}** (Tổng: **${formatVndFromThousands(o.total_amount)}**)\n`;
      });
    }
  }
  else if (concept === 'OKR_LIST') {
    if (rows.length === 0) return 'Hiện tại studio chưa thiết lập mục tiêu OKR nào.';
    const objectivesMap = new Map<string, { title: string; description: string; status: string; krs: any[] }>();
    rows.forEach((row: any) => {
      if (!objectivesMap.has(row.obj_id)) {
        objectivesMap.set(row.obj_id, {
          title: row.obj_title,
          description: row.obj_description,
          status: row.obj_status,
          krs: []
        });
      }
      if (row.kr_id) {
        objectivesMap.get(row.obj_id)!.krs.push({
          title: row.kr_title,
          department: row.kr_dept,
          progress: row.kr_progress
        });
      }
    });

    reply += `Dưới đây là danh sách mục tiêu OKR hiện tại của studio:\n\n`;
    objectivesMap.forEach((obj) => {
      const avgProgress = obj.krs.length > 0 ? Math.round(obj.krs.reduce((sum, k) => sum + k.progress, 0) / obj.krs.length) : 0;
      reply += `🎯 **Objective:** "${obj.title}" (Tiến độ: **${avgProgress}%**, Trạng thái: **${translateStatus(obj.status)}**)\n`;
      if (obj.description) {
        reply += `   - Mô tả: *${obj.description}*\n`;
      }
      if (obj.krs.length > 0) {
        obj.krs.forEach(k => {
          reply += `   - KR: **${k.title}** (Bộ phận: **${k.department}**, Hoàn thành: **${k.progress}%**)\n`;
        });
      }
      reply += `\n`;
    });
  }
  else if (concept === 'LEAD_SUCCESS_REASONS') {
    if (rows.length === 0) return 'Chưa ghi nhận lý do chốt đơn thành công nào.';
    const reasonsMap: Record<string, number> = {};
    const descriptionMap: Record<string, string> = {
      'K1': 'Nhu cầu rõ',
      'K3': 'Tin tưởng thương hiệu',
      'S1': 'Sale chốt đúng thời điểm'
    };
    rows.forEach((r: any) => {
      reasonsMap[r.success_reason] = (reasonsMap[r.success_reason] || 0) + 1;
    });

    reply += `Thống kê các lý do chốt đơn thành công (Won):\n\n`;
    Object.entries(reasonsMap).forEach(([r, count]) => {
      const desc = descriptionMap[r] || 'Lý do khác';
      reply += `• Mã **${r}** (${desc}): **${count}** khách hàng\n`;
    });
  }
  else if (concept === 'LEAD_FAILURE_REASONS') {
    if (rows.length === 0) return 'Chưa ghi nhận lý do chốt đơn thất bại nào.';
    const reasonsMap: Record<string, number> = {};
    const descriptionMap: Record<string, string> = {
      'K02': 'Khách so sánh giá nơi khác',
      'S02': 'Sale tư vấn lan man',
      'P01': 'Giá cả chưa phù hợp'
    };
    rows.forEach((r: any) => {
      reasonsMap[r.failure_reason] = (reasonsMap[r.failure_reason] || 0) + 1;
    });

    reply += `Thống kê các nguyên nhân chốt đơn thất bại (Lost):\n\n`;
    Object.entries(reasonsMap).forEach(([r, count]) => {
      const desc = descriptionMap[r] || 'Nguyên nhân khác';
      reply += `• Mã **${r}** (${desc}): **${count}** khách hàng\n`;
    });
  }
  else if (concept === 'LEAD_SUPPORT_REQUESTS') {
    if (rows.length === 0) return 'Hiện tại không có yêu cầu hỗ trợ nào cần xử lý.';
    reply += `Danh sách khách hàng (Lead) đang cần Admin/Manager hỗ trợ tư vấn:\n\n`;
    rows.forEach((l: any) => {
      reply += `• KH: **${l.customer_name}** - SĐT: **${l.phone || 'N/A'}**\n`;
      reply += `  - Yêu cầu hỗ trợ: *"${l.support_needed}"*\n`;
      if (l.admin_feedbacks) {
        try {
          const feedbacks = typeof l.admin_feedbacks === 'string' ? JSON.parse(l.admin_feedbacks) : l.admin_feedbacks;
          if (Array.isArray(feedbacks) && feedbacks.length > 0) {
            reply += `  - Feedback chỉ đạo của Admin:\n`;
            feedbacks.forEach((f: any) => {
              reply += `    > *[${f.created_at || ''}]* ${f.author || 'Admin'}: ${f.content}\n`;
            });
          }
        } catch (e) {
          // Bỏ qua trường không thể định dạng thành tiền tệ.
        }
      }
    });
  }
  else if (concept === 'STAFF_LIST') {
    if (rows.length === 0) return 'Không tìm thấy thông tin tài khoản nhân viên nào.';
    reply += `Dưới đây là danh sách nhân sự trong studio:\n\n`;
    rows.forEach((u: any) => {
      reply += `• **${u.full_name}** - Email: **${u.email}** (Trạng thái: **${u.is_active ? 'Hoạt động' : 'Đã khóa'}**)\n`;
    });
  } else {
    // Phản hồi mặc định khi không có template phù hợp.
    reply += `Đã kiểm tra hệ thống. Kết quả:\n\n`;
    rows.slice(0, 5).forEach((r: any, idx: number) => {
      reply += `${idx + 1}. ${JSON.stringify(r)}\n`;
    });
  }

  reply += `\n\n*(Trace ID: ${traceId})*`;
  return reply;
}

// Luồng xử lý NLP nghiệp vụ hoàn chỉnh theo phần 1.
export async function processNlpQuery(rawQuestion: string): Promise<{ answer: string; trace: TraceObject }> {
  const traceId = `trace-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const config = loadNlpConfig();
  const normalized = normalizeVietnamese(rawQuestion);
  const entities = extractEntities(rawQuestion);
  
  // Tra từ điển và nhận diện intent theo phần 1 và 3.
  const { matched, remainingText } = lookupPhrases(normalized, config);
  const intent = classifyIntent(normalized, config);

  // Kiểm tra câu hỏi mơ hồ và phương án dự phòng theo phần 3.5.
  if (matched.length === 0) {
    const normalizedWords = normalized.split(/\s+/);
    const suggestedConcepts = new Set<string>();

    config.dictionary.forEach(dictEntry => {
      const phraseWords = dictEntry.phrase.split(/\s+/);
      const isPartialMatch = phraseWords.some(pw => normalizedWords.includes(pw));
      if (isPartialMatch) {
        suggestedConcepts.add(dictEntry.concept_id);
      }
    });

    let suggestionText = '';
    if (suggestedConcepts.size > 0) {
      suggestionText = 'Tôi chưa hiểu rõ ý bạn. Có phải bạn đang muốn tra cứu về:\n\n';
      const conceptList = Array.from(suggestedConcepts)
        .map(cid => config.concepts.find(c => c.id === cid))
        .filter(Boolean);

      conceptList.slice(0, 3).forEach((c: any) => {
        let exampleQuery = '';
        if (c.id === 'BUSINESS_OVERVIEW') exampleQuery = 'Tổng quan hoạt động';
        else if (c.id === 'CUSTOMER_LIST') exampleQuery = 'Danh sách khách hàng';
        else if (c.id === 'LEAD_LIST') exampleQuery = 'Lead cần chăm sóc';
        else if (c.id === 'ORDER_LIST') exampleQuery = 'Danh sách hợp đồng';
        else if (c.id === 'SCHEDULE_RANGE') exampleQuery = 'Lịch chụp hôm nay';
        else if (c.id === 'TASK_LIST') exampleQuery = 'Danh sách công việc';
        else if (c.id === 'OKR_LIST') exampleQuery = 'Danh sách mục tiêu OKR';
        else if (c.id === 'STAFF_LIST') exampleQuery = 'Danh sách nhân viên';
        else if (c.id === 'STAFF_WORKLOAD') exampleQuery = 'Khối lượng công việc nhân viên';
        else if (c.id === 'OPERATIONAL_ALERTS') exampleQuery = 'Cảnh báo vận hành';
        else if (c.id === 'LEAD_SUCCESS_REASONS') exampleQuery = 'Lý do chốt đơn thành công';
        else if (c.id === 'LEAD_FAILURE_REASONS') exampleQuery = 'Tại sao khách hàng từ chối';
        else if (c.id === 'LEAD_SUPPORT_REQUESTS') exampleQuery = 'Khách hàng nào cần hỗ trợ';

        suggestionText += `👉 **${c.description}** (Gợi ý gõ: *"${exampleQuery}"*)\n`;
      });
      suggestionText += '\nBạn hãy chọn hoặc gõ câu hỏi chi tiết hơn nhé!';
    } else {
      suggestionText = 'Tôi chưa hiểu yêu cầu này, bạn có thể diễn đạt cụ thể hơn không?\n\n💡 *Gợi ý các chủ đề có thể hỏi:* Tổng quan hôm nay, Lịch chụp sắp tới, Lead cần chăm sóc, Tiến độ OKR, Khối lượng công việc nhân sự.';
    }

    return {
      answer: suggestionText,
      trace: {
        trace_id: traceId,
        raw_question: rawQuestion,
        normalized,
        matched_phrases: [],
        extracted_entities: entities,
        intent,
        resolved_concepts: [],
        generated_sql: '',
        sql_params: [],
        row_count: 0
      }
    };
  }

  // Xác định khái niệm nghiệp vụ theo phần 3.4.
  const resolvedConcepts = matched.map(m => m.concept);

  // Loại stop word, từ đệm và trợ từ nghi vấn khỏi nội dung tìm kiếm.
  const stopWords = new Set([
    'nao', 'can', 'ai', 'tim', 'danh', 'sach', 'liet', 'ke', 'hien',
    'thi', 'show', 'co', 'may', 'bao', 'nhieu', 'la', 'gi', 'cung',
    'cua', 'trong', 'ngay', 'thang', 'nam', 'cho', 'vao', 'de', 'nhung',
    'cac', 'voi', 've', 'hoi', 'dum', 'xem', 'toi', 'ta', 'minh',
    'phai', 'lam', 'on', 'giup', 'chut'
  ]);
  const cleanedQuery = remainingText.trim().split(/\s+/).filter(word => !stopWords.has(word)).join(' ');

  // Chuẩn bị tham số mặc định.
  const todayStr = new Date().toISOString().split('T')[0];
  const finalParams: Record<string, any> = {
    today: todayStr,
    start_date: entities.start_date || todayStr,
    end_date: entities.end_date || todayStr,
    limit: entities.limit || 5,
    query: entities.phone || entities.order_code || cleanedQuery
  };

  // Ánh xạ quy tắc và dựng truy vấn theo phần 3.6, 8 và 9.
  let sql = '';
  const pgParams: any[] = [];
  const concept = resolvedConcepts[0]; // primary concept drives the table selection

  const conceptMetadata = config.concepts.find(c => c.id === concept);
  const ruleMeta = config.rules.find(r => r.concept_id === concept);
  
  const category = conceptMetadata?.category || 'overview';
  
  // Ghi đè giá trị mặc định bằng các thực thể đã trích xuất.
  if (ruleMeta) {
    Object.assign(finalParams, ruleMeta.default_params);
  }

  // Gắn từ khóa tìm kiếm khi câu hỏi đã cung cấp rõ nội dung cần tra.
  if (entities.phone) finalParams.query = entities.phone;
  else if (entities.order_code) finalParams.query = entities.order_code;

  if (concept === 'BUSINESS_OVERVIEW') {
    // Tổng quan nghiệp vụ có thể chạy trên bộ nhớ đệm hoặc truy vấn trực tiếp.
    sql = `
      SELECT 
        (SELECT COUNT(*) FROM "Customer") as customers,
        (SELECT COUNT(*) FROM "Order") as orders,
        (SELECT COUNT(*) FROM "Order" WHERE status != 'cancelled' AND status != 'delivered') as active_orders,
        (SELECT COALESCE(SUM(total_amount), 0) FROM "Order") as total_order_value,
        (SELECT COUNT(*) FROM "Task" WHERE status != 'done' AND status != 'cancelled') as pending_tasks,
        (SELECT COUNT(*) FROM "Task" WHERE status != 'done' AND status != 'cancelled' AND due_date < $1) as overdue_tasks,
        (SELECT COUNT(*) FROM "Lead" WHERE status = 'consulting') as active_leads
    `;
    pgParams.push(todayStr);
  } 
  else if (concept === 'STAFF_WORKLOAD') {
    sql = `
      SELECT 
        u.id, 
        u.full_name,
        (SELECT COUNT(*) FROM "Task" t WHERE t.assigned_to = u.id AND t.status != 'done' AND t.status != 'cancelled') as pending_tasks,
        (SELECT COUNT(*) FROM "Task" t WHERE t.assigned_to = u.id AND t.status != 'done' AND t.status != 'cancelled' AND t.due_date < $1) as overdue_tasks
      FROM "User" u
      WHERE u.is_active = true
      ORDER BY pending_tasks DESC
      LIMIT $2
    `;
    pgParams.push(todayStr, finalParams.limit);
  }
  else if (concept === 'OPERATIONAL_ALERTS') {
    // SQL tổng hợp nhiều nhóm cảnh báo vận hành.
    sql = `
      SELECT 'overdue_task' as alert_type, t.title, t.due_date, u.full_name as assigned_to_name, null as order_code, 0::float as total_amount, null as shoot_date, null as shoot_time, null as customer_name
      FROM "Task" t
      LEFT JOIN "User" u ON t.assigned_to = u.id
      WHERE t.status != 'done' AND t.status != 'cancelled' AND t.due_date < $1
      
      UNION ALL
      
      SELECT 'missing_assignment' as alert_type, null as title, null as due_date, null as assigned_to_name, o.order_code, 0::float as total_amount, o.shoot_date, o.shoot_time, c.full_name as customer_name
      FROM "Order" o
      LEFT JOIN "Customer" c ON o.customer_id = c.id
      WHERE o.status != 'cancelled' AND o.status != 'delivered'
        AND NOT EXISTS (SELECT 1 FROM "Task" t WHERE t.order_id = o.id)
      
      UNION ALL
      
      SELECT 'missing_deposit' as alert_type, null as title, null as due_date, null as assigned_to_name, o.order_code, o.total_amount, null as shoot_date, null as shoot_time, c.full_name as customer_name
      FROM "Order" o
      LEFT JOIN "Customer" c ON o.customer_id = c.id
      WHERE o.status != 'cancelled' AND o.status != 'delivered' AND o.deposit_amount <= 0 AND o.total_amount > 0
      
      LIMIT $2
    `;
    pgParams.push(todayStr, finalParams.limit);
  }
  else if (concept === 'OKR_LIST') {
    sql = `
      SELECT 
        o.id as obj_id, 
        o.title as obj_title, 
        o.description as obj_description, 
        o.status as obj_status, 
        kr.id as kr_id, 
        kr.title as kr_title, 
        kr.assigned_department as kr_dept, 
        kr.progress as kr_progress 
      FROM "Objective" o 
      LEFT JOIN "ObjectiveKeyResult" kr ON kr.objective_id = o.id 
      ORDER BY o.created_at DESC
    `;
  }
  else if (concept === 'LEAD_SUCCESS_REASONS') {
    sql = `SELECT success_reason FROM "Lead" WHERE status = 'won' AND success_reason IS NOT NULL`;
  }
  else if (concept === 'LEAD_FAILURE_REASONS') {
    sql = `SELECT failure_reason FROM "Lead" WHERE status = 'lost' AND failure_reason IS NOT NULL`;
  }
  else if (concept === 'LEAD_SUPPORT_REQUESTS') {
    sql = `SELECT customer_name, phone, support_needed, admin_feedbacks FROM "Lead" WHERE support_needed IS NOT NULL AND support_needed != ''`;
  }
  else if (concept === 'STAFF_LIST') {
    sql = `SELECT id, full_name, email, is_active FROM "User" ORDER BY full_name ASC`;
  }
  else {
    // Dựng truy vấn bảng tiêu chuẩn.
    let tableName = 'Customer';
    let selectColumns = '*';
    if (category === 'leads') {
      tableName = 'Lead';
    } else if (category === 'orders') {
      tableName = 'Order';
    } else if (category === 'tasks') {
      tableName = 'Task';
    } else if (category === 'customers') {
      tableName = 'Customer';
    } else if (category === 'staff') {
      tableName = 'User';
    }

    if (intent === 'COUNT') {
      selectColumns = 'COUNT(*) as count';
    }

    let whereClause = ruleMeta?.sql_fragment || '1=1';

    // Thêm điều kiện lọc từ khóa khi người dùng cung cấp nội dung tìm kiếm.
    if (finalParams.query && finalParams.query.length > 0) {
      const q = `%${finalParams.query}%`;
      if (tableName === 'Customer') {
        whereClause = `(${whereClause}) AND (full_name ILIKE :q_text OR phone ILIKE :q_text OR email ILIKE :q_text)`;
        finalParams.q_text = q;
      } else if (tableName === 'Lead') {
        whereClause = `(${whereClause}) AND (customer_name ILIKE :q_text OR phone ILIKE :q_text OR source ILIKE :q_text)`;
        finalParams.q_text = q;
      } else if (tableName === 'Order') {
        whereClause = `(${whereClause}) AND (order_code ILIKE :q_text OR package_name ILIKE :q_text)`;
        finalParams.q_text = q;
      } else if (tableName === 'Task') {
        whereClause = `(${whereClause}) AND (title ILIKE :q_text OR description ILIKE :q_text)`;
        finalParams.q_text = q;
      }
    }

    sql = `SELECT ${selectColumns} FROM "${tableName}" WHERE ${whereClause}`;

    // Thêm sắp xếp và giới hạn cho intent LIST hoặc TOP_N.
    if (intent === 'TOP_N') {
      if (tableName === 'Order') sql += ` ORDER BY shoot_date ASC, shoot_time ASC`;
      else if (tableName === 'Task') sql += ` ORDER BY due_date ASC`;
      else sql += ` ORDER BY created_at DESC`;
      sql += ` LIMIT :limit`;
    } else if (intent === 'LIST') {
      if (tableName === 'Order') sql += ` ORDER BY shoot_date ASC, shoot_time ASC`;
      else if (tableName === 'Task') sql += ` ORDER BY due_date ASC`;
      sql += ` LIMIT :limit`;
    }

    // Chuyển tham số có tên sang tham số vị trí của PostgreSQL ($1, $2, $3...).
    const paramRegex = /:([a-zA-Z0-9_]+)/g;
    sql = sql.replace(paramRegex, (match, paramName) => {
      const val = finalParams[paramName];
      pgParams.push(val === undefined ? null : val);
      return `$${pgParams.length}`;
    });
  }

  // Thực thi SQL trên PostgreSQL theo phần 10.
  let rows: any[] = [];
  try {
    rows = await prisma.$queryRawUnsafe(sql, ...pgParams);
    
    // Bổ sung tên quan hệ cho danh sách lead hoặc đơn hàng khi cần.
    if (concept === 'LEAD_LIST' && rows.length > 0) {
      const users = await prisma.user.findMany();
      rows = rows.map(r => ({
        ...r,
        assigned_sale_name: users.find(u => u.id === r.assigned_sale_id)?.full_name || 'N/A'
      }));
    }
    else if (concept === 'SCHEDULE_RANGE' && rows.length > 0) {
      const customers = await prisma.customer.findMany();
      rows = rows.map(r => ({
        ...r,
        customer_name: customers.find(c => c.id === r.customer_id)?.full_name || 'Unknown'
      }));
    }
    else if (concept === 'ORDER_LIST' && rows.length > 0) {
      const customers = await prisma.customer.findMany();
      rows = rows.map(r => ({
        ...r,
        customer_name: customers.find(c => c.id === r.customer_id)?.full_name || 'Unknown'
      }));
    }
    else if (concept === 'TASK_LIST' && rows.length > 0) {
      const users = await prisma.user.findMany();
      rows = rows.map(r => ({
        ...r,
        assigned_to_name: users.find(u => u.id === r.assigned_to)?.full_name || 'N/A'
      }));
    }
  } catch (err) {
    console.error('SQL Execution failed:', err);
    throw new Error('Không thể truy vấn cơ sở dữ liệu. Vui lòng kiểm tra lại cấu trúc câu hỏi.');
  }

  // Sinh phản hồi ngôn ngữ tự nhiên theo phần 11.
  const answer = generateNaturalResponse(intent, resolvedConcepts, rows, traceId, finalParams);

  // Trả thông tin truy vết cùng câu trả lời cuối.
  return {
    answer,
    trace: {
      trace_id: traceId,
      raw_question: rawQuestion,
      normalized,
      matched_phrases: matched,
      extracted_entities: entities,
      intent,
      resolved_concepts: resolvedConcepts,
      generated_sql: sql,
      sql_params: pgParams,
      row_count: rows.length
    }
  };
}
