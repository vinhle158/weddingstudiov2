import path from 'path';
import fs from 'fs';
// @ts-ignore
import pkg from 'node-nlp';
const { NlpManager } = pkg;

const modelPath = path.join(process.cwd(), 'model.nlp');
const manager = new NlpManager({ languages: ['vi'], forceNER: true });

let isTrained = false;

export async function initNlp() {
  if (isTrained) return;

  if (fs.existsSync(modelPath)) {
    try {
      await manager.load(modelPath);
      isTrained = true;
      return;
    } catch (err) {
      console.error('Failed to load NLP model, retraining...', err);
    }
  }

  // 1. BUSINESS_OVERVIEW
  manager.addDocument('vi', 'tổng quan', 'BUSINESS_OVERVIEW');
  manager.addDocument('vi', 'tình hình', 'BUSINESS_OVERVIEW');
  manager.addDocument('vi', 'tổng quan studio', 'BUSINESS_OVERVIEW');
  manager.addDocument('vi', 'tổng quan hoạt động', 'BUSINESS_OVERVIEW');
  manager.addDocument('vi', 'tổng quan hôm nay', 'BUSINESS_OVERVIEW');
  manager.addDocument('vi', 'tình hình hôm nay', 'BUSINESS_OVERVIEW');
  manager.addDocument('vi', 'báo cáo tổng quan', 'BUSINESS_OVERVIEW');
  manager.addDocument('vi', 'tình hình hoạt động của studio', 'BUSINESS_OVERVIEW');

  // 2. CUSTOMER_LIST (General info & contact profile)
  manager.addDocument('vi', 'danh sách khách hàng', 'CUSTOMER_LIST');
  manager.addDocument('vi', 'khách hàng', 'CUSTOMER_LIST');
  manager.addDocument('vi', 'ds khách hàng', 'CUSTOMER_LIST');
  manager.addDocument('vi', 'd sách khách hàng', 'CUSTOMER_LIST');
  manager.addDocument('vi', 'tra cứu khách hàng', 'CUSTOMER_LIST');
  manager.addDocument('vi', 'tìm khách hàng %customerName%', 'CUSTOMER_LIST');
  manager.addDocument('vi', 'tra cứu thông tin khách hàng %customerName%', 'CUSTOMER_LIST');
  manager.addDocument('vi', 'khách hàng %customerName% là ai', 'CUSTOMER_LIST');
  manager.addDocument('vi', 'cho tôi thông tin của %customerName%', 'CUSTOMER_LIST');
  manager.addDocument('vi', 'thông tin khách hàng %customerName%', 'CUSTOMER_LIST');
  manager.addDocument('vi', 'hồ sơ khách hàng %customerName%', 'CUSTOMER_LIST');
  manager.addDocument('vi', 'xem hồ sơ của %customerName%', 'CUSTOMER_LIST');

  // 3. LEAD_LIST
  manager.addDocument('vi', 'lead', 'LEAD_LIST');
  manager.addDocument('vi', 'crm', 'LEAD_LIST');
  manager.addDocument('vi', 'tư vấn', 'LEAD_LIST');
  manager.addDocument('vi', 'chăm sóc', 'LEAD_LIST');
  manager.addDocument('vi', 'ds lead', 'LEAD_LIST');
  manager.addDocument('vi', 'khách hàng tiềm năng', 'LEAD_LIST');
  manager.addDocument('vi', 'danh sách lead', 'LEAD_LIST');
  manager.addDocument('vi', 'lead cần chăm sóc', 'LEAD_LIST');

  // 4. ORDER_LIST (General active contracts list)
  manager.addDocument('vi', 'danh sách đơn hàng', 'ORDER_LIST');
  manager.addDocument('vi', 'danh sách hợp đồng', 'ORDER_LIST');
  manager.addDocument('vi', 'đơn hàng đã ký', 'ORDER_LIST');
  manager.addDocument('vi', 'hợp đồng đã chốt', 'ORDER_LIST');
  manager.addDocument('vi', 'hợp đồng studio', 'ORDER_LIST');

  // 5. SCHEDULE_RANGE
  manager.addDocument('vi', 'lịch', 'SCHEDULE_RANGE');
  manager.addDocument('vi', 'lịch chụp', 'SCHEDULE_RANGE');
  manager.addDocument('vi', 'chụp', 'SCHEDULE_RANGE');
  manager.addDocument('vi', 'lịch chụp sắp tới', 'SCHEDULE_RANGE');
  manager.addDocument('vi', 'lịch chụp hôm nay', 'SCHEDULE_RANGE');
  manager.addDocument('vi', 'lịch chụp ngày mai', 'SCHEDULE_RANGE');
  manager.addDocument('vi', 'xem lịch chụp', 'SCHEDULE_RANGE');
  manager.addDocument('vi', 'kế hoạch chụp ảnh', 'SCHEDULE_RANGE');

  // 6. TASK_LIST
  manager.addDocument('vi', 'công việc', 'TASK_LIST');
  manager.addDocument('vi', 'task', 'TASK_LIST');
  manager.addDocument('vi', 'danh sách công việc', 'TASK_LIST');
  manager.addDocument('vi', 'công việc cần làm', 'TASK_LIST');
  manager.addDocument('vi', 'nhiệm vụ cần xử lý', 'TASK_LIST');
  manager.addDocument('vi', 'tiến độ công việc', 'TASK_LIST');

  // 7. OPERATIONAL_ALERTS
  manager.addDocument('vi', 'cảnh báo', 'OPERATIONAL_ALERTS');
  manager.addDocument('vi', 'cảnh báo vận hành', 'OPERATIONAL_ALERTS');
  manager.addDocument('vi', 'bất thường', 'OPERATIONAL_ALERTS');
  manager.addDocument('vi', 'cảnh báo o p', 'OPERATIONAL_ALERTS');
  manager.addDocument('vi', 'cảnh báo hệ thống', 'OPERATIONAL_ALERTS');
  manager.addDocument('vi', 'các vấn đề vận hành', 'OPERATIONAL_ALERTS');

  // 8. STAFF_WORKLOAD
  manager.addDocument('vi', 'nhân viên', 'STAFF_WORKLOAD');
  manager.addDocument('vi', 'khối lượng công việc', 'STAFF_WORKLOAD');
  manager.addDocument('vi', 'ai bận', 'STAFF_WORKLOAD');
  manager.addDocument('vi', 'ai rảnh', 'STAFF_WORKLOAD');
  manager.addDocument('vi', 'ai bận nhất', 'STAFF_WORKLOAD');
  manager.addDocument('vi', 'khối lượng công việc nhân sự', 'STAFF_WORKLOAD');
  manager.addDocument('vi', 'khối lượng công việc của nhân sự', 'STAFF_WORKLOAD');
  manager.addDocument('vi', 'ai bận nhất tuần này', 'STAFF_WORKLOAD');

  // 9. OKR_LIST
  manager.addDocument('vi', 'okr', 'OKR_LIST');
  manager.addDocument('vi', 'mục tiêu', 'OKR_LIST');
  manager.addDocument('vi', 'kết quả then chốt', 'OKR_LIST');
  manager.addDocument('vi', 'tiến độ okr', 'OKR_LIST');
  manager.addDocument('vi', 'tỉ lệ hoàn thành', 'OKR_LIST');
  manager.addDocument('vi', 'tiến độ mục tiêu', 'OKR_LIST');
  manager.addDocument('vi', 'kết quả okr của studio', 'OKR_LIST');

  // 10. LEAD_SUCCESS_REASONS
  manager.addDocument('vi', 'lý do thành công', 'LEAD_SUCCESS_REASONS');
  manager.addDocument('vi', 'chốt thành công', 'LEAD_SUCCESS_REASONS');
  manager.addDocument('vi', 'mã lý do thành công', 'LEAD_SUCCESS_REASONS');
  manager.addDocument('vi', 'lý do chốt đơn thành công', 'LEAD_SUCCESS_REASONS');

  // 11. LEAD_FAILURE_REASONS
  manager.addDocument('vi', 'lý do thất bại', 'LEAD_FAILURE_REASONS');
  manager.addDocument('vi', 'tại sao thất bại', 'LEAD_FAILURE_REASONS');
  manager.addDocument('vi', 'lý do khách từ chối', 'LEAD_FAILURE_REASONS');
  manager.addDocument('vi', 'tại sao khách hàng từ chối', 'LEAD_FAILURE_REASONS');
  manager.addDocument('vi', 'khách từ chối', 'LEAD_FAILURE_REASONS');
  manager.addDocument('vi', 'khách hàng từ chối', 'LEAD_FAILURE_REASONS');

  // 12. LEAD_SUPPORT_REQUESTS
  manager.addDocument('vi', 'lead cần hỗ trợ', 'LEAD_SUPPORT_REQUESTS');
  manager.addDocument('vi', 'yêu cầu trợ giúp', 'LEAD_SUPPORT_REQUESTS');
  manager.addDocument('vi', 'sales cần hỗ trợ', 'LEAD_SUPPORT_REQUESTS');
  manager.addDocument('vi', 'khách hàng nào cần hỗ trợ', 'LEAD_SUPPORT_REQUESTS');
  manager.addDocument('vi', 'khách hàng nào cần hỗ trợ tư vấn', 'LEAD_SUPPORT_REQUESTS');
  manager.addDocument('vi', 'cần hỗ trợ tư vấn', 'LEAD_SUPPORT_REQUESTS');
  manager.addDocument('vi', 'cần hỗ trợ', 'LEAD_SUPPORT_REQUESTS');

  // 13. STAFF_LIST
  manager.addDocument('vi', 'danh sách nhân viên', 'STAFF_LIST');
  manager.addDocument('vi', 'danh sách nhân sự', 'STAFF_LIST');
  manager.addDocument('vi', 'vai trò nhân sự', 'STAFF_LIST');
  manager.addDocument('vi', 'tài khoản nhân sự', 'STAFF_LIST');

  // 14. CONTRACT_STATUS (Detailed contract and status info by customer name)
  manager.addDocument('vi', 'hợp đồng của %customerName% trạng thái thế nào', 'CONTRACT_STATUS');
  manager.addDocument('vi', 'kiểm tra trạng thái hợp đồng %customerName%', 'CONTRACT_STATUS');
  manager.addDocument('vi', 'trạng thái hợp đồng của %customerName%', 'CONTRACT_STATUS');
  manager.addDocument('vi', 'hợp đồng %customerName%', 'CONTRACT_STATUS');
  manager.addDocument('vi', 'trạng thái đơn hàng %customerName%', 'CONTRACT_STATUS');
  manager.addDocument('vi', 'hợp đồng cưới của %customerName%', 'CONTRACT_STATUS');
  manager.addDocument('vi', 'đơn hàng của khách %customerName% thế nào', 'CONTRACT_STATUS');
  manager.addDocument('vi', 'kiểm tra hợp đồng của %customerName%', 'CONTRACT_STATUS');

  // 15. thong_ke_doanh_so (Periodic statistics)
  manager.addDocument('vi', 'doanh số', 'thong_ke_doanh_so');
  manager.addDocument('vi', 'doanh số tháng %month% năm %year%', 'thong_ke_doanh_so');
  manager.addDocument('vi', 'doanh số quý %quarter% năm %year%', 'thong_ke_doanh_so');
  manager.addDocument('vi', 'doanh số năm %year%', 'thong_ke_doanh_so');
  manager.addDocument('vi', 'doanh thu tháng %month% năm %year%', 'thong_ke_doanh_so');
  manager.addDocument('vi', 'doanh thu quý %quarter% năm %year%', 'thong_ke_doanh_so');
  manager.addDocument('vi', 'doanh thu năm %year%', 'thong_ke_doanh_so');
  manager.addDocument('vi', 'thống kê doanh thu tháng này', 'thong_ke_doanh_so');
  manager.addDocument('vi', 'doanh số tháng này', 'thong_ke_doanh_so');
  manager.addDocument('vi', 'doanh số tháng trước', 'thong_ke_doanh_so');
  manager.addDocument('vi', 'doanh số quý này', 'thong_ke_doanh_so');
  manager.addDocument('vi', 'doanh số năm nay', 'thong_ke_doanh_so');
  manager.addDocument('vi', 'doanh số năm ngoái', 'thong_ke_doanh_so');

  await manager.train();
  await manager.save(modelPath);
  isTrained = true;
}

export async function classifyIntent(message: string): Promise<{ intent: string; score: number }> {
  await initNlp();
  const response = await manager.process('vi', message);
  return {
    intent: response.intent || 'unknown',
    score: response.score || 0,
  };
}

export { manager };
