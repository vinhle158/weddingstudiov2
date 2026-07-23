export const ORDER_STATUS_DEFINITIONS = [
  {
    id: 'new',
    label: 'Đơn mới',
    badgeColor: 'bg-gray-100 text-gray-700 border-gray-200',
    dashboardColor: 'bg-blue-50 border-blue-200 text-blue-700',
    dotColor: 'bg-blue-500',
  },
  {
    id: 'raw_sent',
    label: 'Đã gởi file gốc',
    badgeColor: 'bg-sky-50 text-sky-700 border-sky-100',
    dashboardColor: 'bg-sky-50 border-sky-200 text-sky-700',
    dotColor: 'bg-sky-500',
  },
  {
    id: 'selected',
    label: 'Đã lọc',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-100',
    dashboardColor: 'bg-amber-50 border-amber-200 text-amber-800',
    dotColor: 'bg-amber-500',
  },
  {
    id: 'demo_sent',
    label: 'Đã gởi file demo',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    dashboardColor: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    dotColor: 'bg-indigo-500',
  },
  {
    id: 'revision',
    label: 'Đang chỉnh sửa lại',
    badgeColor: 'bg-orange-50 text-orange-700 border-orange-100',
    dashboardColor: 'bg-orange-50 border-orange-200 text-orange-700',
    dotColor: 'bg-orange-500',
  },
  {
    id: 'print_approved',
    label: 'Duyệt in',
    badgeColor: 'bg-violet-50 text-violet-700 border-violet-100',
    dashboardColor: 'bg-violet-50 border-violet-200 text-violet-700',
    dotColor: 'bg-violet-500',
  },
  {
    id: 'photos_ready',
    label: 'Có hình',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    dashboardColor: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    dotColor: 'bg-emerald-500',
  },
  {
    id: 'completed',
    label: 'Hoàn tất',
    badgeColor: 'bg-slate-50 text-slate-700 border-slate-200',
    dashboardColor: 'bg-slate-50 border-slate-200 text-slate-700',
    dotColor: 'bg-slate-500',
  },
  {
    id: 'cancelled',
    label: 'Đã hủy',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-100',
    dashboardColor: 'bg-rose-50 border-rose-200 text-rose-700',
    dotColor: 'bg-rose-500',
  },
] as const;

export type OrderStatus = typeof ORDER_STATUS_DEFINITIONS[number]['id'];

export const ORDER_STATUS_IDS = ORDER_STATUS_DEFINITIONS.map(item => item.id) as OrderStatus[];
export const ACTIVE_ORDER_STATUS_IDS = ORDER_STATUS_IDS.filter(
  status => status !== 'completed' && status !== 'cancelled',
);

const orderStatusById = new Map(ORDER_STATUS_DEFINITIONS.map(item => [item.id, item]));

export const LEGACY_ORDER_STATUS_MAP: Record<string, OrderStatus> = {
  new: 'new',
  confirmed: 'new',
  shooting: 'raw_sent',
  editing: 'revision',
  ready: 'photos_ready',
  delivered: 'completed',
  cancelled: 'cancelled',
};

export function normalizeOrderStatus(status: unknown): OrderStatus | null {
  if (typeof status !== 'string') return null;
  if (orderStatusById.has(status as OrderStatus)) return status as OrderStatus;
  return LEGACY_ORDER_STATUS_MAP[status] || null;
}

export function getOrderStatusDefinition(status: unknown) {
  const normalized = normalizeOrderStatus(status);
  return normalized ? orderStatusById.get(normalized) : undefined;
}

export function getOrderStatusLabel(status: unknown): string {
  if (typeof status !== 'string' || !status) return 'Không rõ';
  return getOrderStatusDefinition(status)?.label || status;
}

export function isActiveOrderStatus(status: unknown): boolean {
  const normalized = normalizeOrderStatus(status);
  return normalized !== null && normalized !== 'completed' && normalized !== 'cancelled';
}

export function canTransitionOrderStatus(
  currentStatus: unknown,
  nextStatus: unknown,
  canMoveBackward = false,
): boolean {
  const current = normalizeOrderStatus(currentStatus);
  const next = normalizeOrderStatus(nextStatus);
  if (!current || !next) return false;
  if (current === next || next === 'cancelled' || canMoveBackward) return true;

  // Khách có thể yêu cầu chỉnh sửa và nhận lại demo nhiều lần.
  if (
    (current === 'demo_sent' && next === 'revision')
    || (current === 'revision' && next === 'demo_sent')
  ) {
    return true;
  }

  const workflow: OrderStatus[] = ORDER_STATUS_IDS.filter(status => status !== 'cancelled');
  return workflow.indexOf(next) > workflow.indexOf(current);
}
