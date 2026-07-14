import Fuse from 'fuse.js';
import { prisma, Customer } from '../../db_service';

let cachedCustomers: Customer[] = [];
let lastFetched = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache TTL

async function getCustomers(): Promise<Customer[]> {
  const now = Date.now();
  if (cachedCustomers.length === 0 || now - lastFetched > CACHE_TTL) {
    try {
      cachedCustomers = await prisma.customer.findMany();
      lastFetched = now;
    } catch (err) {
      console.error('Failed to fetch customers for fuzzy matching:', err);
      // Khi API lỗi, dùng danh sách khách hàng đã cache nếu có.
    }
  }
  return cachedCustomers;
}

export interface ResolveCustomerResult {
  customer?: Customer;
  needsClarification?: boolean;
  clarificationQuestion?: string;
  options?: Customer[];
}

export async function resolveCustomer(rawCustomerName: string): Promise<ResolveCustomerResult> {
  const customers = await getCustomers();
  if (customers.length === 0) {
    return {
      needsClarification: true,
      clarificationQuestion: `Không có khách hàng nào trong hệ thống để tìm kiếm.`
    };
  }

  // Cấu hình Fuse.js cho tìm kiếm gần đúng.
  const fuse = new Fuse(customers, {
    keys: ['full_name'],
    threshold: 0.4,
    includeScore: true
  });

  const results = fuse.search(rawCustomerName);

  if (results.length === 0) {
    return {
      needsClarification: true,
      clarificationQuestion: `Tôi không tìm thấy khách hàng nào tên gần giống "${rawCustomerName}". Bạn kiểm tra lại giúp tôi nhé.`
    };
  }

  // Trả ngay khi chỉ có một kết quả với độ tin cậy cao.
  const bestMatch = results[0];
  
  if (results.length === 1) {
    return { customer: bestMatch.item };
  }

  // Khi có nhiều kết quả, so sánh mức chênh lệch điểm.
  const secondMatch = results[1];
  const bestScore = bestMatch.score ?? 1;
  const secondScore = secondMatch.score ?? 1;

  // Chọn kết quả đầu nếu tốt hơn rõ rệt so với kết quả thứ hai.
  if (secondScore - bestScore > 0.15) {
    return { customer: bestMatch.item };
  }

  // Nếu vẫn mơ hồ, yêu cầu làm rõ với tối đa bốn lựa chọn.
  const options = results.slice(0, 4).map(r => r.item);
  let optionsText = options.map((c, i) => `${i + 1}. ${c.full_name} (${c.phone})`).join('\n');
  
  return {
    needsClarification: true,
    clarificationQuestion: `Tôi tìm thấy một số khách hàng có tên gần giống "${rawCustomerName}":\n${optionsText}\n\nBạn vui lòng nhập số thứ tự (1, 2...) hoặc gõ tên đầy đủ để tôi tra cứu chính xác nhé.`,
    options
  };
}
