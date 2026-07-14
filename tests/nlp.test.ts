import { describe, test } from 'node:test';
import assert from 'node:assert';
import { classifyIntent } from '../src/lib/chatbot/nlp';

describe('Deterministic Vietnamese chatbot intent classifier', () => {
  const cases = [
    ['Cho tôi xem tổng quan studio hôm nay', 'BUSINESS_OVERVIEW'],
    ['Tra cứu thông tin khách hàng Nguyễn Văn A', 'CUSTOMER_LIST'],
    ['Danh sách lead cần chăm sóc', 'LEAD_LIST'],
    ['Danh sách hợp đồng đã ký', 'ORDER_LIST'],
    ['Lịch chụp tuần này', 'SCHEDULE_RANGE'],
    ['Công việc cần làm hôm nay', 'TASK_LIST'],
    ['Có cảnh báo vận hành nào không?', 'OPERATIONAL_ALERTS'],
    ['Ai bận nhất tuần này?', 'STAFF_WORKLOAD'],
    ['Tiến độ OKR của studio', 'OKR_LIST'],
    ['Lý do chốt đơn thành công', 'LEAD_SUCCESS_REASONS'],
    ['Tại sao khách hàng từ chối?', 'LEAD_FAILURE_REASONS'],
    ['Lead nào cần hỗ trợ tư vấn?', 'LEAD_SUPPORT_REQUESTS'],
    ['Danh sách nhân sự', 'STAFF_LIST'],
    ['Hợp đồng của Nguyễn Văn A trạng thái thế nào?', 'CONTRACT_STATUS'],
    ['Thống kê doanh thu tháng này', 'thong_ke_doanh_so'],
  ] as const;

  for (const [message, expectedIntent] of cases) {
    test(`classifies ${expectedIntent}`, async () => {
      assert.deepStrictEqual(await classifyIntent(message), { intent: expectedIntent, score: 1 });
    });
  }

  test('returns unknown for unrelated text', async () => {
    assert.deepStrictEqual(await classifyIntent('abc xyz không có ngữ cảnh'), { intent: 'unknown', score: 0 });
  });
});
