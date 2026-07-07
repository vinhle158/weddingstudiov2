import { QueryResult } from './queryBuilder';
import { Intent } from './types';

// Helper to format currency to VND format
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

// Helper to translate status codes to Vietnamese descriptions
export function translateStatus(status: string): string {
  const map: Record<string, string> = {
    // Order statuses
    new: 'Đơn hàng mới',
    confirmed: 'Đã xác nhận cọc',
    shooting: 'Đang thực hiện chụp',
    editing: 'Đang hậu kỳ',
    ready: 'Sẵn sàng bàn giao',
    delivered: 'Đã hoàn thành / Bàn giao',
    cancelled: 'Đã hủy',
    // Task statuses
    pending: 'Chờ thực hiện',
    in_progress: 'Đang làm',
    done: 'Hoàn tất',
    // Lead statuses
    consulting: 'Đang tư vấn',
    won: 'Thành công',
    lost: 'Thất bại',
    // Priorities
    low: 'THẤP',
    normal: 'THƯỜNG',
    high: 'KHẨN CẤP'
  };
  return map[status.toLowerCase()] || status;
}

export function renderResponse(intent: Intent, data: QueryResult): string {
  if (data.needsClarification) {
    return data.clarificationQuestion || 'Bạn vui lòng cung cấp thêm thông tin.';
  }

  switch (intent) {
    case 'BUSINESS_OVERVIEW':
      return renderBusinessOverview(data);
    case 'CUSTOMER_LIST':
      return renderCustomerList(data);
    case 'LEAD_LIST':
      return renderLeadList(data);
    case 'ORDER_LIST':
      return renderOrderList(data);
    case 'SCHEDULE_RANGE':
      return renderScheduleRange(data);
    case 'TASK_LIST':
      return renderTaskList(data);
    case 'OPERATIONAL_ALERTS':
      return renderOperationalAlerts(data);
    case 'STAFF_WORKLOAD':
      return renderStaffWorkload(data);
    case 'OKR_LIST':
      return renderOkrList(data);
    case 'LEAD_SUCCESS_REASONS':
      return renderLeadSuccessReasons(data);
    case 'LEAD_FAILURE_REASONS':
      return renderLeadFailureReasons(data);
    case 'LEAD_SUPPORT_REQUESTS':
      return renderLeadSupportRequests(data);
    case 'STAFF_LIST':
      return renderStaffList(data);
    case 'CONTRACT_STATUS':
      return renderContractStatus(data);
    case 'thong_ke_doanh_so':
      return renderDoanhSo(data);
    default:
      return 'Xin lỗi, tôi chưa hỗ trợ loại câu hỏi này. Bạn có thể hỏi về tổng quan studio, doanh số, khách hàng, hợp đồng, lịch chụp, công việc, OKR, hoặc cảnh báo vận hành.';
  }
}

function renderBusinessOverview(data: QueryResult): string {
  const { totalAmount = 0, orderCount = 0, month = 0, quarter = 0, year = 0, leads = [] } = data;
  const leadStats = leads[0] || {};
  const activeLeads = leadStats.active_leads || 0;
  const customersCount = leadStats.customers || 0;

  return `Chào bạn! Dưới đây là thông tin hoạt động tổng quan của studio:

• **Khách hàng:** Tổng số **${customersCount}** khách hàng đã đăng ký.
• **Đơn hàng:** Có **${orderCount}** đơn hàng (trong đó đang xử lý **${month}** đơn).
• **Doanh thu:** Tổng doanh thu đạt được là **${formatCurrency(totalAmount)}**.
• **Công việc:** Có **${quarter}** việc chưa xong (trong đó **${year}** việc đã quá hạn).
• **Lead tư vấn:** Hiện có **${activeLeads}** khách hàng tiềm năng đang được chăm sóc.`;
}

function renderCustomerList(data: QueryResult): string {
  const { customer, customers = [], leads = [], tasks = [] } = data;

  if (customer) {
    // P3-3: Detailed customer profile display contact info, address, leads & tasks (no orders detailed history to avoid overlap)
    let details = `Dưới đây là thông tin liên hệ và hồ sơ khách hàng **${customer.full_name}**:\n`;
    details += `• **Số điện thoại**: ${customer.phone}\n`;
    if (customer.email) details += `• **Email**: ${customer.email}\n`;
    if (customer.address) details += `• **Địa chỉ**: ${customer.address}\n`;
    if (customer.notes) details += `• **Ghi chú**: *${customer.notes}*\n`;

    if (leads.length > 0) {
      details += `\n**Lịch sử tư vấn CRM (${leads.length}):**\n`;
      leads.forEach(l => {
        let pkgs = 'Chưa rõ';
        try {
          if (typeof l.interested_packages === 'string') pkgs = JSON.parse(l.interested_packages).join(', ');
          else if (Array.isArray(l.interested_packages)) pkgs = l.interested_packages.join(', ');
        } catch (e) {}
        details += `- Ngày ${l.date}: Nguồn *${l.source}* - Gói quan tâm: *${pkgs}* - *${translateStatus(l.status)}*\n`;
      });
    }

    if (tasks.length > 0) {
      details += `\n**Đầu việc liên quan chưa hoàn thành (${tasks.length}):**\n`;
      tasks.forEach(t => {
        details += `- **${t.title}**: Hạn: ${t.due_date || 'N/A'} - Trạng thái: *${translateStatus(t.status)}*\n`;
      });
    }

    return details;
  }

  if (customers.length === 0) {
    return 'Không tìm thấy khách hàng nào trong hệ thống.';
  }

  let list = `Tìm thấy thông tin khách hàng phù hợp:\n\n`;
  customers.forEach(c => {
    list += `• KH: **${c.full_name}** - SĐT: **${c.phone || 'Chưa có'}** - Địa chỉ: **${c.address || 'Chưa có'}**\n`;
  });
  return list;
}

function renderLeadList(data: QueryResult): string {
  const { leads = [] } = data;
  if (leads.length === 0) {
    return 'Hiện tại không có lead tiềm năng nào đang tư vấn trong CRM.';
  }

  let reply = `Dưới đây là danh sách khách hàng tiềm năng (Lead) đang tư vấn:\n\n`;
  leads.forEach(l => {
    reply += `• KH: **${l.customer_name}** - SĐT: **${l.phone || 'Chưa có'}** - Nguồn: **${l.source}**\n`;
    reply += `  - Bước bán hàng: **${l.sales_step}/6** - Trạng thái: *${translateStatus(l.status)}* (Phụ trách: **${l.assigned_sale_name}**)\n`;
    if (l.notes) reply += `  - Ghi chú: *${l.notes}*\n`;
  });
  return reply;
}

function renderOrderList(data: QueryResult): string {
  const { orders = [] } = data;
  if (orders.length === 0) {
    return 'Không tìm thấy đơn hàng/hợp đồng nào phù hợp.';
  }

  let reply = `Tìm thấy các đơn hàng/hợp đồng cưới phù hợp:\n\n`;
  orders.forEach(o => {
    reply += `• Hợp đồng **[${o.order_code}]** - KH: **${o.customer_name}** - Trạng thái: *${translateStatus(o.status)}* - Gói: *"${o.package_name}"* (Ngày chụp: ${o.shoot_date})\n`;
  });
  return reply;
}

function renderScheduleRange(data: QueryResult): string {
  const { orders = [], dateFrom, dateTo } = data;
  if (orders.length === 0) {
    return `Không có lịch chụp nào trong khoảng thời gian từ ${dateFrom} đến ${dateTo}.`;
  }

  let reply = `Dưới đây là danh sách lịch chụp từ ngày **${dateFrom}** đến **${dateTo}**:\n\n`;
  orders.forEach(s => {
    reply += `• **[${s.order_code}]** KH: **${s.customer_name}** - Gói: *"${s.package_name}"* lúc **${s.shoot_time || '08:30'}** ngày **${s.shoot_date}** (Trạng thái: *${translateStatus(s.status)}*)\n`;
  });
  return reply;
}

function renderTaskList(data: QueryResult): string {
  const { tasks = [] } = data;
  if (tasks.length === 0) {
    return 'Không tìm thấy công việc nào phù hợp.';
  }

  const isUrgentSearch = tasks.every(t => t.priority?.toLowerCase() === 'high');
  let reply = isUrgentSearch
    ? `Tôi tìm thấy các công việc **KHẨN CẤP** chưa hoàn thành:\n\n`
    : `Tìm thấy các công việc phù hợp với yêu cầu:\n\n`;
    
  tasks.forEach(t => {
    reply += `• [**${translateStatus(t.status)}**] **"${t.title}"** (Độ ưu tiên: **${translateStatus(t.priority)}**, Hạn: **${t.due_date || 'Không có'}**, Giao cho: **${t.assigned_to_name}**)\n`;
  });
  return reply;
}

function renderOperationalAlerts(data: QueryResult): string {
  const { alerts } = data;
  if (!alerts || (alerts.overdueTasks.length === 0 && alerts.missingAssignments.length === 0 && alerts.missingDeposits.length === 0)) {
    return 'Tuyệt vời! Hệ thống đã được kiểm tra và không ghi nhận cảnh báo vận hành bất thường nào.';
  }

  let reply = 'Dưới đây là một số điểm cần lưu ý về mặt vận hành của studio:\n\n';

  if (alerts.overdueTasks.length > 0) {
    reply += `⚠️ **Công việc quá hạn chưa hoàn thành (${alerts.overdueTasks.length}):**\n`;
    alerts.overdueTasks.forEach(t => {
      reply += `  - **"${t.title}"** (Hạn: **${t.due_date}**, Người làm: **${t.assigned_to_name}**)\n`;
    });
  }

  if (alerts.missingAssignments.length > 0) {
    reply += `\n⚠️ **Đơn hàng sắp chụp chưa phân công việc cho Ekip (${alerts.missingAssignments.length}):**\n`;
    alerts.missingAssignments.forEach(o => {
      reply += `  - Đơn **[${o.order_code}]** KH: **${o.customer_name}** chụp ngày **${o.shoot_date} ${o.shoot_time || ''}**\n`;
    });
  }

  if (alerts.missingDeposits.length > 0) {
    reply += `\n⚠️ **Hợp đồng đang hoạt động nhưng chưa được đặt cọc (${alerts.missingDeposits.length}):**\n`;
    alerts.missingDeposits.forEach(o => {
      reply += `  - Đơn **[${o.order_code}]** KH: **${o.customer_name}** (Trị giá: **${formatCurrency(o.total_amount)}**)\n`;
    });
  }

  return reply;
}

function renderStaffWorkload(data: QueryResult): string {
  const { workload = [] } = data;
  if (workload.length === 0) {
    return 'Không tìm thấy dữ liệu khối lượng công việc nhân viên.';
  }

  let reply = `Dưới đây là thống kê khối lượng công việc hiện tại của đội ngũ nhân sự:\n\n`;
  workload.forEach(w => {
    reply += `• **${w.full_name}**: Đang phụ trách **${w.pending_tasks}** việc chưa hoàn thành (trong đó **${w.overdue_tasks}** việc đã quá hạn)\n`;
  });
  return reply;
}

function renderOkrList(data: QueryResult): string {
  const { objectives = [], keyResults = [] } = data;
  if (objectives.length === 0) {
    return 'Hiện tại studio chưa thiết lập mục tiêu OKR nào.';
  }

  let reply = `Dưới đây là danh sách mục tiêu OKR hiện tại của studio:\n\n`;
  objectives.forEach(obj => {
    const krs = keyResults.filter(kr => kr.objective_id === obj.id);
    const avgProgress = krs.length > 0 ? Math.round(krs.reduce((sum, kr) => sum + kr.progress, 0) / krs.length) : 0;
    
    reply += `🎯 **Mục tiêu:** "${obj.title}" (Tiến độ: **${avgProgress}%**, Trạng thái: **${translateStatus(obj.status)}**)\n`;
    if (obj.description) reply += `   - Mô tả: *${obj.description}*\n`;
    if (krs.length > 0) {
      krs.forEach(k => {
        reply += `   - Kết quả then chốt: **${k.title}** (Bộ phận: **${k.assigned_department}**, Đạt: **${k.progress}%**)\n`;
      });
    }
    reply += '\n';
  });
  return reply.trim();
}

function renderLeadSuccessReasons(data: QueryResult): string {
  const { leads = [] } = data; // leads is array of { success_reason, count }
  if (leads.length === 0) {
    return 'Chưa ghi nhận dữ liệu lý do chốt lead thành công nào.';
  }

  const descriptionMap: Record<string, string> = {
    'K1': 'Nhu cầu rõ ràng / Hợp gu',
    'K3': 'Tin tưởng thương hiệu lớn',
    'S1': 'Sales chăm sóc tốt & chốt đúng thời điểm'
  };

  let reply = `Thống kê các lý do chốt đơn thành công (Won):\n\n`;
  leads.forEach(l => {
    const desc = descriptionMap[l.success_reason] || 'Lý do khác';
    reply += `• Mã **${l.success_reason}** (${desc}): **${l.count}** khách hàng\n`;
  });
  return reply;
}

function renderLeadFailureReasons(data: QueryResult): string {
  const { leads = [] } = data; // leads is array of { failure_reason, count }
  if (leads.length === 0) {
    return 'Chưa ghi nhận dữ liệu lý do chốt lead thất bại nào.';
  }

  const descriptionMap: Record<string, string> = {
    'K02': 'Khách so sánh giá / Chọn studio rẻ hơn',
    'S02': 'Sales tư vấn lan man, phản hồi chậm',
    'P01': 'Mức giá gói dịch vụ chưa phù hợp với khách'
  };

  let reply = `Thống kê các nguyên nhân chốt đơn thất bại (Lost):\n\n`;
  leads.forEach(l => {
    const desc = descriptionMap[l.failure_reason] || 'Lý do khách quan khác';
    reply += `• Mã **${l.failure_reason}** (${desc}): **${l.count}** khách hàng từ chối\n`;
  });
  return reply;
}

function renderLeadSupportRequests(data: QueryResult): string {
  const { leads = [] } = data;
  if (leads.length === 0) {
    return 'Hiện tại không có yêu cầu hỗ trợ sales nào cần xử lý.';
  }

  let reply = `Danh sách khách hàng tiềm năng (Lead) đang cần Admin/Manager hỗ trợ tư vấn:\n\n`;
  leads.forEach(l => {
    reply += `• KH: **${l.customer_name}** - SĐT: **${l.phone || 'N/A'}**\n`;
    reply += `  - Yêu cầu hỗ trợ: *"${l.support_needed}"*\n`;
    if (l.admin_feedbacks) {
      try {
        const feedbacks = typeof l.admin_feedbacks === 'string' ? JSON.parse(l.admin_feedbacks) : l.admin_feedbacks;
        if (Array.isArray(feedbacks) && feedbacks.length > 0) {
          reply += `  - Chỉ đạo từ Admin:\n`;
          feedbacks.forEach((f: any) => {
            reply += `    > *[${f.created_at || ''}]* ${f.author || 'Admin'}: ${f.content}\n`;
          });
        }
      } catch (e) {}
    }
  });
  return reply;
}

function renderStaffList(data: QueryResult): string {
  const { users = [] } = data;
  if (users.length === 0) {
    return 'Không tìm thấy thông tin tài khoản nhân viên nào.';
  }

  let reply = `Dưới đây là danh sách nhân sự hoạt động trong studio:\n\n`;
  users.forEach(u => {
    reply += `• **${u.full_name}** - Email: **${u.email}** (Trạng thái: **${u.is_active ? 'Hoạt động' : 'Đã khóa'}**)\n`;
  });
  return reply;
}

function renderContractStatus(data: QueryResult): string {
  const { customer, orders = [] } = data;
  if (!customer) {
    return 'Không tìm thấy thông tin khách hàng để kiểm tra hợp đồng.';
  }

  if (orders.length === 0) {
    return `Khách hàng **${customer.full_name}** hiện tại chưa ký kết hợp đồng hay có đơn hàng nào trong hệ thống.`;
  }

  let responseText = `Tìm thấy **${orders.length}** đơn hàng/hợp đồng của khách hàng **${customer.full_name}**:\n\n`;
  orders.forEach((o, i) => {
    const depositPercent = o.total_amount > 0 ? Math.round((o.deposit_amount / o.total_amount) * 100) : 0;
    responseText += `${i + 1}. **Hợp đồng ${o.order_code}**:
   • **Gói dịch vụ**: *${o.package_name}*
   • **Giá trị**: ${formatCurrency(o.total_amount)} (Đã cọc: ${formatCurrency(o.deposit_amount)} - ${depositPercent}%)
   • **Trạng thái**: **${translateStatus(o.status)}**
   • **Lịch chụp**: ${o.shoot_date} ${o.shoot_time ? `lúc ${o.shoot_time}` : ''}
   ${o.notes ? `• **Ghi chú**: *${o.notes}*` : ''}\n\n`;
  });

  return responseText.trim();
}

function renderDoanhSo(data: QueryResult): string {
  const { totalAmount = 0, orderCount = 0, month, quarter, year } = data;
  const formattedAmount = formatCurrency(totalAmount);

  if (month) {
    return `Trong tháng **${month}/${year}**, tổng doanh số studio đạt được là **${formattedAmount}** với **${orderCount}** đơn hàng/hợp đồng đã ký.`;
  }
  if (quarter) {
    return `Trong **Quý ${quarter}/${year}**, studio đã chốt **${orderCount}** hợp đồng, mang về doanh thu **${formattedAmount}**.`;
  }
  return `Tổng kết **năm ${year}**: studio ghi nhận **${orderCount}** hợp đồng cưới, đạt tổng doanh số là **${formattedAmount}**.`;
}
