import { prisma, Customer } from '../../db_service';
import { ExtractedEntities, Intent } from './types';
import { resolveCustomer } from './fuzzyMatch';

export interface QueryResult {
  intent: Intent;
  customer?: Customer;
  customers?: any[];
  orders?: any[];
  leads?: any[];
  tasks?: any[];
  users?: any[];
  objectives?: any[];
  keyResults?: any[];
  workload?: any[];
  alerts?: {
    overdueTasks: any[];
    missingAssignments: any[];
    missingDeposits: any[];
  };
  totalAmount?: number;
  orderCount?: number;
  month?: number;
  quarter?: number;
  year?: number;
  needsClarification?: boolean;
  clarificationQuestion?: string;
  options?: Customer[];
  dateFrom?: string;
  dateTo?: string;
}

export async function buildAndExecuteQuery(intent: Intent, entities: ExtractedEntities): Promise<QueryResult> {
  const todayStr = new Date().toISOString().split('T')[0];

  switch (intent) {
    case 'BUSINESS_OVERVIEW':
      return await queryBusinessOverview(todayStr);

    case 'CUSTOMER_LIST':
      return await queryCustomerList(entities);

    case 'LEAD_LIST':
      return await queryLeadList(entities);

    case 'ORDER_LIST':
      return await queryOrderList(entities);

    case 'SCHEDULE_RANGE':
      return await queryScheduleRange(entities, todayStr);

    case 'TASK_LIST':
      return await queryTaskList(entities);

    case 'OPERATIONAL_ALERTS':
      return await queryOperationalAlerts(todayStr, entities);

    case 'STAFF_WORKLOAD':
      return await queryStaffWorkload(todayStr);

    case 'OKR_LIST':
      return await queryOkrList();

    case 'LEAD_SUCCESS_REASONS':
      return await queryLeadSuccessReasons();

    case 'LEAD_FAILURE_REASONS':
      return await queryLeadFailureReasons();

    case 'LEAD_SUPPORT_REQUESTS':
      return await queryLeadSupportRequests();

    case 'STAFF_LIST':
      return await queryStaffList();

    case 'CONTRACT_STATUS':
      return await queryContractStatus(entities);

    case 'thong_ke_doanh_so':
      return await queryDoanhSo(entities);

    default:
      return { intent: 'unknown' };
  }
}

async function queryBusinessOverview(todayStr: string): Promise<QueryResult> {
  const customers = await prisma.customer.count();
  const orders = await prisma.order.count();
  const active_orders = await prisma.order.count({
    where: { status: { notIn: ['cancelled', 'delivered'] } }
  });
  
  // P1-1: Doanh thu tổng quan loại trừ đơn đã hủy
  const sumRes = await prisma.order.aggregate({
    where: { status: { not: 'cancelled' } },
    _sum: { total_amount: true }
  });
  const total_order_value = sumRes._sum.total_amount || 0;

  const pending_tasks = await prisma.task.count({
    where: { status: { notIn: ['done', 'cancelled'] } }
  });
  const overdue_tasks = await prisma.task.count({
    where: {
      status: { notIn: ['done', 'cancelled'] },
      due_date: { lt: todayStr }
    }
  });

  const active_leads = await prisma.lead.count({
    where: { status: 'consulting' }
  });

  return {
    intent: 'BUSINESS_OVERVIEW',
    totalAmount: total_order_value,
    orderCount: orders,
    month: active_orders, 
    quarter: pending_tasks,
    year: overdue_tasks,
    leads: [{ active_leads, customers }] 
  };
}

async function queryCustomerList(entities: ExtractedEntities): Promise<QueryResult> {
  // If specific name is requested, query details
  if (entities.customerName) {
    const resolveRes = await resolveCustomer(entities.customerName);
    if (resolveRes.needsClarification) {
      return {
        intent: 'CUSTOMER_LIST',
        needsClarification: true,
        clarificationQuestion: resolveRes.clarificationQuestion,
        options: resolveRes.options
      };
    }

    const customer = resolveRes.customer;
    // P0-1: Guard check before accessing customer properties
    if (!customer) {
      return {
        intent: 'CUSTOMER_LIST',
        needsClarification: true,
        clarificationQuestion: `Tôi không tìm thấy khách hàng nào tên "${entities.customerName}". Bạn kiểm tra lại giúp tôi nhé.`
      };
    }

    const leads = await prisma.lead.findMany({
      where: {
        OR: [
          { phone: customer.phone },
          { customer_name: { contains: customer.full_name, mode: 'insensitive' } }
        ]
      }
    }) as any[];

    // Fetch related active tasks
    // P3-3: Customer profile only queries contact info, leads & tasks (no detailed contracts overlap)
    const orders = await prisma.order.findMany({
      where: { customer_id: customer.id }
    });
    const orderIds = orders.map(o => o.id);
    const tasks = await prisma.task.findMany({
      where: { order_id: { in: orderIds }, status: { not: 'done' } }
    }) as any[];

    return {
      intent: 'CUSTOMER_LIST',
      customer,
      leads,
      tasks
    };
  }

  // General list of customers
  const customers = await prisma.customer.findMany({
    take: entities.limit || 5,
    orderBy: { created_at: 'desc' }
  });
  return {
    intent: 'CUSTOMER_LIST',
    customers
  };
}

async function queryLeadList(entities: ExtractedEntities): Promise<QueryResult> {
  const leads = await prisma.lead.findMany({
    where: { status: 'consulting' },
    take: entities.limit || 5,
    orderBy: { created_at: 'desc' }
  }) as any[];

  const users = await prisma.user.findMany();
  leads.forEach(l => {
    l.assigned_sale_name = users.find(u => u.id === l.assigned_sale_id)?.full_name || 'N/A';
  });

  return {
    intent: 'LEAD_LIST',
    leads
  };
}

async function queryOrderList(entities: ExtractedEntities): Promise<QueryResult> {
  const orders = await prisma.order.findMany({
    where: { status: { notIn: ['cancelled', 'delivered'] } },
    take: entities.limit || 5,
    orderBy: { created_at: 'desc' }
  }) as any[];

  const customers = await prisma.customer.findMany();
  orders.forEach(o => {
    o.customer_name = customers.find(c => c.id === o.customer_id)?.full_name || 'Unknown';
  });

  return {
    intent: 'ORDER_LIST',
    orders
  };
}

async function queryScheduleRange(entities: ExtractedEntities, todayStr: string): Promise<QueryResult> {
  const start = entities.dateFrom || `${todayStr}T00:00:00.000Z`;
  const end = entities.dateTo || `${todayStr}T23:59:59.999Z`;

  const start_date = start.split('T')[0];
  const end_date = end.split('T')[0];

  const orders = await prisma.order.findMany({
    where: {
      shoot_date: {
        gte: start_date,
        lte: end_date
      }
    },
    orderBy: { shoot_date: 'asc' }
  }) as any[];

  const customers = await prisma.customer.findMany();
  orders.forEach(o => {
    o.customer_name = customers.find(c => c.id === o.customer_id)?.full_name || 'Unknown';
  });

  return {
    intent: 'SCHEDULE_RANGE',
    orders,
    dateFrom: start_date,
    dateTo: end_date
  };
}

async function queryTaskList(entities: ExtractedEntities): Promise<QueryResult> {
  const whereClause: any = {
    status: { notIn: ['done', 'cancelled'] }
  };

  if (entities.priority) {
    whereClause.priority = entities.priority;
  }

  const tasks = await prisma.task.findMany({
    where: whereClause,
    take: entities.limit || 5,
    orderBy: { due_date: 'asc' }
  }) as any[];

  const users = await prisma.user.findMany();
  tasks.forEach(t => {
    t.assigned_to_name = users.find(u => u.id === t.assigned_to)?.full_name || 'N/A';
  });

  return {
    intent: 'TASK_LIST',
    tasks
  };
}

async function queryOperationalAlerts(todayStr: string, entities: ExtractedEntities): Promise<QueryResult> {
  const limit = entities.limit || 5;

  // P0-3: Dùng đúng tập tasks active để tính overdueTasks và missingAssignments độc lập
  const allActiveTasks = await prisma.task.findMany({
    where: { status: { notIn: ['done', 'cancelled'] } }
  }) as any[];

  const overdueTasks = allActiveTasks.filter(t => t.due_date && t.due_date < todayStr);
  const users = await prisma.user.findMany();
  overdueTasks.forEach(t => {
    t.assigned_to_name = users.find(u => u.id === t.assigned_to)?.full_name || 'N/A';
  });

  // active orders
  const activeOrders = await prisma.order.findMany({
    where: { status: { notIn: ['cancelled', 'delivered'] } }
  }) as any[];

  // P0-3: Đơn thiếu ekip là đơn chưa có bất kỳ một task nào được giao (ngoại trừ các task đã hủy)
  const allTasks = await prisma.task.findMany({
    where: { order_id: { not: null }, status: { not: 'cancelled' } }
  });
  const orderIdsWithTasks = new Set(allTasks.map(t => t.order_id));
  const missingAssignments = activeOrders.filter(o => !orderIdsWithTasks.has(o.id));
  
  const customers = await prisma.customer.findMany();
  missingAssignments.forEach(o => {
    o.customer_name = customers.find(c => c.id === o.customer_id)?.full_name || 'Unknown';
  });

  // Missing deposits
  const missingDeposits = await prisma.order.findMany({
    where: {
      status: { notIn: ['cancelled', 'delivered'] },
      deposit_amount: { lte: 0 },
      total_amount: { gt: 0 }
    },
    take: limit
  }) as any[];
  missingDeposits.forEach(o => {
    o.customer_name = customers.find(c => c.id === o.customer_id)?.full_name || 'Unknown';
  });

  return {
    intent: 'OPERATIONAL_ALERTS',
    alerts: {
      overdueTasks: overdueTasks.slice(0, limit),
      missingAssignments: missingAssignments.slice(0, limit),
      missingDeposits
    }
  };
}

async function queryStaffWorkload(todayStr: string): Promise<QueryResult> {
  const users = await prisma.user.findMany({ where: { is_active: true } });
  const tasks = await prisma.task.findMany({
    where: { status: { notIn: ['done', 'cancelled'] } }
  });

  const workload = users.map(u => {
    const userTasks = tasks.filter(t => t.assigned_to === u.id);
    const pending_tasks = userTasks.length;
    const overdue_tasks = userTasks.filter(t => t.due_date && t.due_date < todayStr).length;
    return {
      id: u.id,
      full_name: u.full_name,
      pending_tasks,
      overdue_tasks
    };
  });

  workload.sort((a, b) => b.pending_tasks - a.pending_tasks);

  return {
    intent: 'STAFF_WORKLOAD',
    workload
  };
}

async function queryOkrList(): Promise<QueryResult> {
  const objectives = await prisma.objective.findMany({
    orderBy: { created_at: 'desc' }
  });
  const keyResults = await prisma.objectiveKeyResult.findMany();

  return {
    intent: 'OKR_LIST',
    objectives,
    keyResults
  };
}

async function queryLeadSuccessReasons(): Promise<QueryResult> {
  // P1-2: Nhóm lý do thành công (group by) bằng reduce
  const leads = await prisma.lead.findMany({
    where: { status: 'won', success_reason: { not: null } },
    select: { success_reason: true }
  }) as any[];

  const grouped = leads.reduce((acc, l) => {
    if (l.success_reason) {
      acc[l.success_reason] = (acc[l.success_reason] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return {
    intent: 'LEAD_SUCCESS_REASONS',
    leads: Object.entries(grouped).map(([reason, count]) => ({
      success_reason: reason,
      count
    }))
  };
}

async function queryLeadFailureReasons(): Promise<QueryResult> {
  // P1-2: Nhóm lý do thất bại (group by) bằng reduce
  const leads = await prisma.lead.findMany({
    where: { status: 'lost', failure_reason: { not: null } },
    select: { failure_reason: true }
  }) as any[];

  const grouped = leads.reduce((acc, l) => {
    if (l.failure_reason) {
      acc[l.failure_reason] = (acc[l.failure_reason] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return {
    intent: 'LEAD_FAILURE_REASONS',
    leads: Object.entries(grouped).map(([reason, count]) => ({
      failure_reason: reason,
      count
    }))
  };
}

async function queryLeadSupportRequests(): Promise<QueryResult> {
  // P1-3: Kiểm tra null cột support_needed trước khi lọc khác rỗng
  const leads = await prisma.lead.findMany({
    where: {
      AND: [
        { support_needed: { not: null } },
        { support_needed: { not: '' } }
      ]
    },
    orderBy: { created_at: 'desc' }
  }) as any[];
  return {
    intent: 'LEAD_SUPPORT_REQUESTS',
    leads
  };
}

async function queryStaffList(): Promise<QueryResult> {
  const users = await prisma.user.findMany({
    orderBy: { full_name: 'asc' }
  });
  return {
    intent: 'STAFF_LIST',
    users
  };
}

async function queryContractStatus(entities: ExtractedEntities): Promise<QueryResult> {
  if (!entities.customerName) {
    return {
      intent: 'CONTRACT_STATUS',
      needsClarification: true,
      clarificationQuestion: 'Bạn muốn kiểm tra trạng thái hợp đồng của khách hàng nào ạ?'
    };
  }

  const resolveRes = await resolveCustomer(entities.customerName);
  if (resolveRes.needsClarification) {
    return {
      intent: 'CONTRACT_STATUS',
      needsClarification: true,
      clarificationQuestion: resolveRes.clarificationQuestion,
      options: resolveRes.options
    };
  }

  const customer = resolveRes.customer;
  // P0-1: Guard check before accessing customer properties
  if (!customer) {
    return {
      intent: 'CONTRACT_STATUS',
      needsClarification: true,
      clarificationQuestion: `Tôi không tìm thấy hợp đồng nào cho khách hàng "${entities.customerName}". Bạn kiểm tra lại giúp tôi nhé.`
    };
  }

  const orders = await prisma.order.findMany({
    where: { customer_id: customer.id }
  }) as any[];

  return {
    intent: 'CONTRACT_STATUS',
    customer,
    orders
  };
}

async function queryDoanhSo(entities: ExtractedEntities): Promise<QueryResult> {
  const { month, quarter, year } = entities;
  
  if (!year) {
    return {
      intent: 'thong_ke_doanh_so',
      needsClarification: true,
      clarificationQuestion: 'Bạn muốn thống kê doanh số cho năm nào ạ?'
    };
  }

  let dateFrom = '';
  let dateTo = '';
  const pad = (n: number) => String(n).padStart(2, '0');

  if (month) {
    dateFrom = `${year}-${pad(month)}-01T00:00:00.000Z`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    dateTo = `${nextYear}-${pad(nextMonth)}-01T00:00:00.000Z`;
  } else if (quarter) {
    const qStartMonth = (quarter - 1) * 3 + 1;
    const qEndMonth = quarter * 3 + 1;
    
    dateFrom = `${year}-${pad(qStartMonth)}-01T00:00:00.000Z`;
    if (qEndMonth > 12) {
      dateTo = `${year + 1}-01-01T00:00:00.000Z`;
    } else {
      dateTo = `${year}-${pad(qEndMonth)}-01T00:00:00.000Z`;
    }
  } else {
    dateFrom = `${year}-01-01T00:00:00.000Z`;
    dateTo = `${year + 1}-01-01T00:00:00.000Z`;
  }

  // P1-1: Doanh thu theo thời gian loại trừ các đơn đã bị hủy
  const orders = await prisma.order.findMany({
    where: {
      created_at: {
        gte: dateFrom,
        lt: dateTo
      },
      status: { not: 'cancelled' }
    }
  }) as any[];

  const totalAmount = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const orderCount = orders.length;

  return {
    intent: 'thong_ke_doanh_so',
    orders,
    totalAmount,
    orderCount,
    month,
    quarter,
    year
  };
}
