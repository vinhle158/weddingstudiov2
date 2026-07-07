export type Intent =
  | 'BUSINESS_OVERVIEW'
  | 'CUSTOMER_LIST'
  | 'LEAD_LIST'
  | 'ORDER_LIST'
  | 'SCHEDULE_RANGE'
  | 'TASK_LIST'
  | 'OPERATIONAL_ALERTS'
  | 'STAFF_WORKLOAD'
  | 'OKR_LIST'
  | 'LEAD_SUCCESS_REASONS'
  | 'LEAD_FAILURE_REASONS'
  | 'LEAD_SUPPORT_REQUESTS'
  | 'STAFF_LIST'
  | 'CONTRACT_STATUS'
  | 'thong_ke_doanh_so'
  | 'unknown';

export interface ExtractedEntities {
  customerName?: string;
  month?: number;
  year?: number;
  quarter?: number;
  orderCode?: string;
  dateFrom?: string; // Stored as ISO string
  dateTo?: string;   // Stored as ISO string
  limit?: number;
  priority?: string;
}

export interface ChatbotResponse {
  reply: string;
  intent: Intent;
  data?: any;
  needsClarification?: boolean;
  clarificationQuestion?: string;
  sessionId?: string;
}
