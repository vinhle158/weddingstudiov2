import type { Intent } from './types';

type ClassifiedIntent = { intent: Intent | 'unknown'; score: number };

function normalizeVietnamese(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const includesAny = (text: string, phrases: string[]) => phrases.some(phrase => text.includes(phrase));

const rules: Array<{ intent: Intent; phrases: string[] }> = [
  {
    intent: 'LEAD_SUCCESS_REASONS',
    phrases: ['ly do thanh cong', 'chot thanh cong', 'ma ly do thanh cong', 'ly do chot don thanh cong'],
  },
  {
    intent: 'LEAD_FAILURE_REASONS',
    phrases: ['ly do that bai', 'tai sao that bai', 'ly do khach tu choi', 'khach hang tu choi', 'khach tu choi'],
  },
  {
    intent: 'LEAD_SUPPORT_REQUESTS',
    phrases: ['lead can ho tro', 'yeu cau tro giup', 'sales can ho tro', 'can ho tro tu van', 'khach hang nao can ho tro', 'can ho tro'],
  },
  {
    intent: 'thong_ke_doanh_so',
    phrases: ['doanh so', 'doanh thu', 'thong ke', 'thu nhap', 'tong thu'],
  },
  {
    intent: 'STAFF_WORKLOAD',
    phrases: ['ai ban', 'ai ranh', 'khoi luong cong viec', 'workload'],
  },
  {
    intent: 'STAFF_LIST',
    phrases: ['danh sach nhan vien', 'danh sach nhan su', 'vai tro nhan su', 'tai khoan nhan su'],
  },
  {
    intent: 'OPERATIONAL_ALERTS',
    phrases: ['canh bao van hanh', 'canh bao he thong', 'cac van de van hanh', 'bat thuong', 'canh bao'],
  },
  {
    intent: 'OKR_LIST',
    phrases: ['ket qua then chot', 'tien do muc tieu', 'tien do okr', 'ket qua okr', 'ti le hoan thanh', 'okr', 'muc tieu'],
  },
  {
    intent: 'SCHEDULE_RANGE',
    phrases: ['lich chup', 'ke hoach chup anh', 'xem lich chup', 'lich'],
  },
  {
    intent: 'TASK_LIST',
    phrases: ['danh sach cong viec', 'cong viec can lam', 'nhiem vu can xu ly', 'tien do cong viec', 'cong viec', 'task'],
  },
  {
    intent: 'LEAD_LIST',
    phrases: ['khach hang tiem nang', 'danh sach lead', 'lead can cham soc', 'ds lead', 'lead', 'crm', 'tu van', 'cham soc'],
  },
  {
    intent: 'ORDER_LIST',
    phrases: ['danh sach don hang', 'danh sach hop dong', 'don hang da ky', 'hop dong da chot', 'hop dong studio'],
  },
  {
    intent: 'CONTRACT_STATUS',
    phrases: ['trang thai hop dong', 'kiem tra hop dong', 'hop dong cuoi cua', 'don hang cua khach', 'hop dong cua', 'hop dong'],
  },
  {
    intent: 'CUSTOMER_LIST',
    phrases: ['danh sach khach hang', 'ds khach hang', 'tra cuu khach hang', 'thong tin khach hang', 'ho so khach hang', 'xem ho so', 'tim khach hang', 'khach hang'],
  },
  {
    intent: 'BUSINESS_OVERVIEW',
    phrases: ['bao cao tong quan', 'tong quan hoat dong', 'tinh hinh hoat dong', 'tong quan studio', 'tong quan', 'tinh hinh'],
  },
];

export async function initNlp(): Promise<void> {
  // Giữ hàm này để tương thích API; bộ quy tắc xác định không cần train model hoặc file runtime.
}

export async function classifyIntent(message: string): Promise<ClassifiedIntent> {
  const normalized = normalizeVietnamese(message);
  if (!normalized) return { intent: 'unknown', score: 0 };

  const rule = rules.find(candidate => includesAny(normalized, candidate.phrases));
  return rule ? { intent: rule.intent, score: 1 } : { intent: 'unknown', score: 0 };
}
