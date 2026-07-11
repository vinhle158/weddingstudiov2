import React, { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import { MONEY_INPUT_HINT, formatVndFromThousands } from '../lib/money';
import { 
  Plus, 
  Calendar, 
  Clock, 
  Tag, 
  DollarSign, 
  FileText, 
  User, 
  Shirt, 
  CheckSquare, 
  History, 
  AlertCircle, 
  X, 
  ChevronRight, 
  RefreshCw,
  Phone,
  Briefcase,
  Search,
  Edit
} from 'lucide-react';

interface OrdersProps {
  userRole: string;
  onNavigate: (tab: string, arg?: any) => void;
  initialSelectedOrderId?: string;
  initialOpenCreateForCustomerId?: string;
  initialCreateCustomerDraft?: {
    full_name?: string;
    phone?: string | null;
    notes?: string | null;
  };
  initialCreatePrefill?: {
    package_name?: string;
    package_price?: number;
    total_amount?: number;
    notes?: string | null;
  };
  isMobile?: boolean;
}

export default function Orders({ 
  userRole, 
  onNavigate, 
  initialSelectedOrderId,
  initialOpenCreateForCustomerId,
  initialCreateCustomerDraft,
  initialCreatePrefill,
  isMobile
}: OrdersProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterStaff, setFilterStaff] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Order details
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);

  // Dropdowns for form
  const [customers, setCustomers] = useState<any[]>([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [staffUsers, setStaffUsers] = useState<any[]>([]);
  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  // Order status transition form state
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [statusError, setStatusError] = useState<string | null>(null);

  // New Order form state (including inline customer)
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [formCustomerId, setFormCustomerId] = useState('');
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custBirthday, setCustBirthday] = useState('');
  const [custWeddingDate, setCustWeddingDate] = useState('');
  const [custFacebookUrl, setCustFacebookUrl] = useState('');
  const [pendingCreateCustomerId, setPendingCreateCustomerId] = useState<string | null>(null);
  const [pendingCreateCustomerDraft, setPendingCreateCustomerDraft] = useState<OrdersProps['initialCreateCustomerDraft'] | null>(null);
  const [pendingCreatePrefill, setPendingCreatePrefill] = useState<OrdersProps['initialCreatePrefill'] | null>(null);
  const [shootDate, setShootDate] = useState('');
  const [shootTime, setShootTime] = useState('');
  const [packageName, setPackageName] = useState('');
  const [packagePrice, setPackagePrice] = useState(0);
  const [depositAmount, setDepositAmount] = useState(0);
  const [orderNotes, setOrderNotes] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Searchable customer select state
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustDropdownOpen, setIsCustDropdownOpen] = useState(false);

  // Internal Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskAssignedTo, setTaskAssignedTo] = useState('');
  const [taskPriority, setTaskPriority] = useState('normal');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskError, setTaskError] = useState<string | null>(null);

  // Edit Order modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editOrderId, setEditOrderId] = useState('');
  const [editShootDate, setEditShootDate] = useState('');
  const [editShootTime, setEditShootTime] = useState('');
  const [editPackageName, setEditPackageName] = useState('');
  const [editPackagePrice, setEditPackagePrice] = useState(0);
  const [editDepositAmount, setEditDepositAmount] = useState(0);
  const [editOrderNotes, setEditOrderNotes] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      let query = '';
      const params = [];
      if (filterStatus) params.push(`status=${filterStatus}`);
      if (filterDate) params.push(`date=${filterDate}`);
      if (filterStaff) params.push(`assigned_staff=${filterStaff}`);
      if (params.length > 0) query = '?' + params.join('&');

      const data = await apiRequest(`/api/orders${query}`);
      setOrders(data);

      if (initialSelectedOrderId) {
        const found = data.find((o: any) => o.id === initialSelectedOrderId);
        if (found) {
          fetchOrderDetail(found.id);
          handleOpenEditModal(found);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách đơn hàng');
    } finally {
      setLoading(false);
    }
  };

  const normalizeFacebookUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    return `https://${trimmed}`;
  };

  const applyCustomerToForm = (cust: any) => {
    setCustName(cust?.full_name || '');
    setCustPhone(cust?.phone || '');
    setCustEmail(cust?.email || '');
    setCustAddress(cust?.address || '');
    setCustBirthday(cust?.birthday || '');
    setCustWeddingDate(cust?.wedding_date || '');
    setCustFacebookUrl(cust?.facebook_url || '');
  };

  const applyOrderPrefill = (prefill?: OrdersProps['initialCreatePrefill'] | null) => {
    if (!prefill) return;
    if (prefill.package_name) setPackageName(prefill.package_name);
    if (prefill.package_price !== undefined) {
      setPackagePrice(prefill.package_price || 0);
      setDepositAmount(0);
    }
    if (prefill.notes !== undefined) setOrderNotes(prefill.notes || '');
  };

  const fetchDropdowns = async () => {
    try {
      setCustomersLoaded(false);
      const custs = await apiRequest('/api/customers');
      setCustomers(custs);
    } catch (e) {
      console.error('Error fetching customers:', e);
    } finally {
      setCustomersLoaded(true);
    }

    try {
      const users = await apiRequest('/api/users');
      setStaffUsers(users.filter((u: any) => u.is_active));
    } catch (e) {
      setStaffUsers([]);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchDropdowns();
  }, [filterStatus, filterDate, filterStaff]);

  useEffect(() => {
    if (initialOpenCreateForCustomerId) {
      setPendingCreateCustomerId(initialOpenCreateForCustomerId);
      setPendingCreatePrefill(initialCreatePrefill || null);
    } else if (initialCreateCustomerDraft) {
      setPendingCreateCustomerDraft(initialCreateCustomerDraft);
      setPendingCreatePrefill(initialCreatePrefill || null);
    }
  }, [initialOpenCreateForCustomerId, initialCreateCustomerDraft, initialCreatePrefill]);

  useEffect(() => {
    if (pendingCreateCustomerId && customers.length > 0) {
      setIsNewCustomer(false);
      setFormCustomerId(pendingCreateCustomerId);
      const matched = customers.find(c => c.id === pendingCreateCustomerId);
      if (matched) {
        setCustomerSearch(`${matched.full_name} (${matched.phone})`);
        applyCustomerToForm(matched);
      }
      applyOrderPrefill(pendingCreatePrefill);
      setIsCreateModalOpen(true);
      setPendingCreateCustomerId(null);
      setPendingCreatePrefill(null);
    }
  }, [pendingCreateCustomerId, pendingCreatePrefill, customers]);

  useEffect(() => {
    if (pendingCreateCustomerDraft) {
      if (!customersLoaded) return;
      const draftPhone = pendingCreateCustomerDraft.phone || '';
      const matchedCustomer = draftPhone
        ? customers.find(c => (c.phone || '') === draftPhone)
        : null;

      setCreateError(null);
      if (matchedCustomer) {
        setIsNewCustomer(false);
        setFormCustomerId(matchedCustomer.id);
        setCustomerSearch(`${matchedCustomer.full_name} (${matchedCustomer.phone})`);
        applyCustomerToForm(matchedCustomer);
        setOrderNotes(pendingCreateCustomerDraft.notes || '');
      } else {
        setIsNewCustomer(true);
        setFormCustomerId('');
        setCustomerSearch('');
        setCustName(pendingCreateCustomerDraft.full_name || '');
        setCustPhone(pendingCreateCustomerDraft.phone || '');
        setCustEmail('');
        setCustAddress('');
        setCustBirthday('');
        setCustWeddingDate('');
        setCustFacebookUrl('');
        setOrderNotes(pendingCreateCustomerDraft.notes || '');
      }
      applyOrderPrefill(pendingCreatePrefill);
      setIsCreateModalOpen(true);
      setPendingCreateCustomerDraft(null);
      setPendingCreatePrefill(null);
    }
  }, [pendingCreateCustomerDraft, pendingCreatePrefill, customers, customersLoaded]);

  const fetchOrderDetail = async (orderId: string) => {
    try {
      setOrderDetailLoading(true);
      const detail = await apiRequest(`/api/orders/${orderId}`);
      setSelectedOrder(detail);
    } catch (err) {
      console.error(err);
    } finally {
      setOrderDetailLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setCreateError(null);
    setIsNewCustomer(false);
    setFormCustomerId('');
    setCustName('');
    setCustPhone('');
    setCustEmail('');
    setCustAddress('');
    setCustBirthday('');
    setCustWeddingDate('');
    setCustFacebookUrl('');
    setShootDate('');
    setShootTime('');
    setPackageName('');
    setPackagePrice(0);
    setDepositAmount(0);
    setOrderNotes('');
    setCustomerSearch('');
    setIsCustDropdownOpen(false);
    setIsCreateModalOpen(true);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    try {
      let finalCustomerId = formCustomerId;
      const formattedFacebookUrl = normalizeFacebookUrl(custFacebookUrl);

      // Create inline customer if requested
      if (isNewCustomer) {
        if (!custName || !custPhone) {
          setCreateError('Họ tên và SĐT của khách hàng mới là bắt buộc');
          return;
        }
        const newCust = await apiRequest('/api/customers', 'POST', {
          full_name: custName,
          phone: custPhone,
          email: custEmail || null,
          address: custAddress || null,
          birthday: custBirthday || null,
          wedding_date: custWeddingDate || null,
          facebook_url: formattedFacebookUrl
        });
        finalCustomerId = newCust.id;
      }

      if (!finalCustomerId) {
        setCreateError('Vui lòng chọn hoặc tạo mới một khách hàng');
        return;
      }

      if (!shootDate || !packageName) {
        setCreateError('Vui lòng nhập ngày chụp và tên gói dịch vụ');
        return;
      }

      if (!isNewCustomer) {
        const selectedCustomer = customers.find(c => c.id === finalCustomerId);
        await apiRequest(`/api/customers/${finalCustomerId}`, 'PUT', {
          full_name: selectedCustomer?.full_name || custName,
          phone: selectedCustomer?.phone || custPhone,
          email: custEmail || null,
          address: custAddress || null,
          birthday: custBirthday || null,
          wedding_date: custWeddingDate || null,
          facebook_url: formattedFacebookUrl
        });
      }

      const createdOrder = await apiRequest('/api/orders', 'POST', {
        customer_id: finalCustomerId,
        shoot_date: shootDate,
        shoot_time: shootTime || null,
        package_name: packageName,
        package_price: packagePrice || 0,
        deposit_amount: depositAmount || 0,
        total_amount: packagePrice || 0,
        notes: orderNotes || null
      });

      setIsCreateModalOpen(false);
      fetchOrders();
      fetchOrderDetail(createdOrder.id);
    } catch (err: any) {
      setCreateError(err.message || 'Lỗi khi lưu đơn hàng mới');
    }
  };

  const handleOpenEditModal = (order: any) => {
    if (!order) return;
    setEditOrderId(order.id);
    setEditShootDate(order.shoot_date);
    setEditShootTime(order.shoot_time || '');
    setEditPackageName(order.package_name || '');
    setEditPackagePrice(order.package_price || 0);
    setEditDepositAmount(order.deposit_amount || 0);
    setEditOrderNotes(order.notes || '');
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleUpdateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editShootDate || !editPackageName) {
      setEditError('Ngày chụp và tên gói dịch vụ là bắt buộc');
      return;
    }

    try {
      setEditError(null);
      const updated = await apiRequest(`/api/orders/${editOrderId}`, 'PUT', {
        shoot_date: editShootDate,
        shoot_time: editShootTime || null,
        package_name: editPackageName,
        package_price: editPackagePrice || 0,
        deposit_amount: editDepositAmount || 0,
        total_amount: editPackagePrice || 0,
        notes: editOrderNotes || null
      });

      setIsEditModalOpen(false);
      fetchOrders();
      fetchOrderDetail(updated.id);
    } catch (err: any) {
      setEditError(err.message || 'Lỗi khi cập nhật đơn hàng');
    }
  };

  // Status transition form handling
  const handleOpenStatusModal = () => {
    if (!selectedOrder) return;
    setNewStatus(selectedOrder.status);
    setStatusNote('');
    setStatusError(null);
    setIsStatusModalOpen(true);
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusError(null);
    if (newStatus === selectedOrder.status) {
      setIsStatusModalOpen(false);
      return;
    }

    try {
      await apiRequest(`/api/orders/${selectedOrder.id}/status`, 'POST', {
        status: newStatus,
        note: statusNote || undefined
      });
      setIsStatusModalOpen(false);
      fetchOrders();
      fetchOrderDetail(selectedOrder.id);
    } catch (err: any) {
      setStatusError(err.message || 'Lỗi khi thay đổi trạng thái');
    }
  };

  // Internal Task assignment form handling
  const handleOpenTaskModal = () => {
    if (!selectedOrder) return;
    setTaskError(null);
    setTaskTitle('');
    setTaskDesc('');
    setTaskAssignedTo('');
    setTaskPriority('normal');
    setTaskDueDate('');
    setIsTaskModalOpen(true);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskError(null);

    if (!taskTitle || !taskAssignedTo) {
      setTaskError('Tiêu đề công việc và nhân viên chịu trách nhiệm là bắt buộc');
      return;
    }

    try {
      await apiRequest('/api/tasks', 'POST', {
        title: taskTitle,
        description: taskDesc || null,
        order_id: selectedOrder.id,
        assigned_to: taskAssignedTo,
        priority: taskPriority,
        due_date: taskDueDate || null
      });

      setIsTaskModalOpen(false);
      fetchOrderDetail(selectedOrder.id);
    } catch (err: any) {
      setTaskError(err.message || 'Lỗi khi giao công việc');
    }
  };



  const statusMap: Record<string, { label: string, color: string }> = {
    new: { label: 'Đơn mới', color: 'bg-gray-100 text-gray-700 border-gray-200' },
    confirmed: { label: 'Đã xác nhận', color: 'bg-sky-50 text-sky-700 border-sky-100' },
    shooting: { label: 'Đang chụp', color: 'bg-amber-50 text-amber-700 border-amber-100' },
    editing: { label: 'Đang hậu kỳ', color: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
    ready: { label: 'Ảnh đã xong', color: 'bg-purple-50 text-purple-700 border-purple-100' },
    delivered: { label: 'Hoàn tất', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    cancelled: { label: 'Đã hủy', color: 'bg-rose-50 text-rose-700 border-rose-100' },
  };

  const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'sales';
  const canAssignTasks = userRole === 'admin' || userRole === 'manager';

  const filteredOrders = orders.filter(order => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      order.order_code?.toLowerCase().includes(q) ||
      order.customer_name?.toLowerCase().includes(q) ||
      order.package_name?.toLowerCase().includes(q) ||
      (order.notes && order.notes.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 animate-fade-in" id="orders-section-container">
      {/* Top action & filter bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-gray-900 text-base md:text-lg flex items-center gap-2 leading-tight">
              <Briefcase className="w-5 h-5 text-gold-600 shrink-0" />
              <span>{isMobile ? "Danh sách hợp đồng" : "Quản lý Hợp đồng & Đơn hàng (Dạng bảng)"}</span>
            </h3>
            {!isMobile && (
              <p className="text-xs text-slate-500 mt-1">
                Theo dõi danh sách hợp đồng quay chụp, trạng thái thanh toán, tiến trình xử lý hình ảnh và phân công công việc.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input 
                type="text" 
                placeholder="Tìm mã đơn, tên khách hàng, gói dịch vụ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-gold-500 transition-colors"
              />
            </div>

            {canEdit && (
              <button 
                onClick={handleOpenCreateModal}
                className="bg-gold-600 hover:bg-gold-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Ký hợp đồng mới
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Filters Bar */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-50 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">Trạng thái:</span>
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg py-1 px-2.5 text-xs text-slate-700 focus:outline-none focus:border-gold-500 cursor-pointer"
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(statusMap).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">Ngày chụp:</span>
            <input 
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg py-0.5 px-2 text-xs text-slate-700 focus:outline-none focus:border-gold-500 cursor-pointer font-mono"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">Nhân viên liên quan:</span>
            <select 
              value={filterStaff}
              onChange={(e) => setFilterStaff(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg py-1 px-2.5 text-xs text-slate-700 focus:outline-none focus:border-gold-500 cursor-pointer"
            >
              <option value="">Tất cả nhân sự</option>
              {staffUsers.map(u => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid Table - Dạng bảng/cột như file Excel */}
      {!isMobile && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex justify-between items-center text-xs text-slate-500 select-none">
          <span className="font-medium">
            Danh sách đơn hàng và hợp đồng chụp ảnh ({filteredOrders.length} đơn hàng)
          </span>
          <span className="text-[10px] bg-gold-50 text-gold-800 px-2 py-0.5 rounded font-mono font-bold border border-gold-200/30">
            CONTRACT GRID
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
            <thead>
              <tr className="bg-slate-100 text-xs font-bold text-slate-700 border-b border-slate-200">
                <th className="w-16 py-2 px-3 text-center border-r border-slate-200 font-mono text-[11px] select-none text-slate-400 bg-slate-50/50">STT</th>
                <th className="w-32 px-4 py-2 border-r border-slate-200">Mã Đơn</th>
                <th className="w-56 px-4 py-2 border-r border-slate-200">Khách Hàng</th>
                <th className="w-64 px-4 py-2 border-r border-slate-200">Gói Dịch Vụ</th>
                <th className="w-44 px-4 py-2 border-r border-slate-200 text-center">Ngày Chụp</th>
                <th className="w-28 px-4 py-2 border-r border-slate-200 text-center">Giờ Chụp</th>
                <th className="w-40 px-4 py-2 border-r border-slate-200 text-center">Trạng Thái</th>
                <th className="w-28 px-4 py-2 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400 italic">
                    Đang tải danh sách đơn hàng...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="py-6 px-4">
                    <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 mr-1.5" />
                      {error}
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400 italic">
                    Không tìm thấy đơn hàng nào phù hợp bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order, idx) => {
                  const isSelected = selectedOrder?.id === order.id;
                  const rowNum = idx + 1;
                  const badge = statusMap[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-700 border-gray-200' };
                  return (
                    <tr 
                      key={order.id}
                      onClick={() => fetchOrderDetail(order.id)}
                      className={`hover:bg-slate-50/60 transition-all cursor-pointer border-b border-slate-200 ${
                        isSelected ? 'bg-gold-50/40 text-gold-950 font-semibold' : ''
                      }`}
                    >
                      {/* STT Column */}
                      <td className="py-2.5 px-3 text-center border-r border-slate-200 font-mono text-[11px] select-none text-slate-400 bg-slate-50/30">
                        {rowNum}
                      </td>

                      {/* Mã Đơn */}
                      <td className="px-4 py-2.5 border-r border-slate-200 font-mono font-bold text-slate-900">
                        {order.order_code}
                      </td>

                      {/* Khách Hàng */}
                      <td className={`px-4 py-2.5 border-r border-slate-200 truncate ${
                        isSelected ? 'text-gold-900 font-bold' : 'text-slate-850 font-semibold'
                      }`}>
                        {order.customer_name}
                      </td>

                      {/* Gói Dịch Vụ */}
                      <td className="px-4 py-2.5 border-r border-slate-200 truncate font-semibold text-slate-700">
                        {order.package_name}
                      </td>

                      {/* Ngày Chụp */}
                      <td className="px-4 py-2.5 border-r border-slate-200 text-center text-slate-500 font-mono">
                        {new Date(order.shoot_date).toLocaleDateString('vi-VN')}
                      </td>

                      {/* Giờ Chụp */}
                      <td className="px-4 py-2.5 border-r border-slate-200 text-center text-slate-500 font-mono">
                        {order.shoot_time || <span className="text-slate-300 italic">--:--</span>}
                      </td>

                      {/* Trạng Thái */}
                      <td className="px-4 py-2 border-r border-slate-200 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>

                      {/* Thao tác */}
                      <td className="px-4 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => fetchOrderDetail(order.id)}
                          className={`px-3 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-gold-100 text-gold-800' 
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Hồ sơ đơn
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    )}

      {/* Mobile Cards List */}
      {isMobile && (
        <div className="space-y-3" id="orders-mobile-list">
          <div className="text-xs font-bold text-slate-500 px-1 mb-2 flex justify-between items-center">
            <span>Danh sách hợp đồng ({filteredOrders.length})</span>
            <span className="text-[10px] bg-gold-50 text-gold-800 px-2 py-0.5 rounded font-mono font-bold border border-gold-200/30">
              MOBILE CARDS
            </span>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400 italic border border-slate-150">
              Đang tải danh sách đơn hàng...
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs flex items-center justify-center">
              <AlertCircle className="w-4 h-4 mr-1.5" />
              {error}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400 italic border border-slate-150">
              Không tìm thấy đơn hàng nào phù hợp bộ lọc.
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isSelected = selectedOrder?.id === order.id;
              const badge = statusMap[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-700 border-gray-200' };
              
              return (
                <div 
                  key={order.id}
                  onClick={() => {
                    fetchOrderDetail(order.id);
                    setTimeout(() => {
                      document.getElementById('order-details-section')?.scrollIntoView({ behavior: 'smooth' });
                    }, 150);
                  }}
                  className={`bg-white rounded-2xl border ${isSelected ? 'border-gold-500 ring-2 ring-gold-500/10' : 'border-slate-150'} p-4 transition-all shadow-2xs space-y-3 relative cursor-pointer hover:border-gold-300`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {order.order_code}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      <h4 className={`text-sm font-bold text-slate-850 leading-snug ${isSelected ? 'text-gold-900 font-extrabold' : ''}`}>
                        {order.customer_name}
                      </h4>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600">
                    <span className="text-slate-400">Gói dịch vụ: </span>
                    <strong className="text-slate-700">{order.package_name}</strong>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
                    <div>
                      <span className="block text-slate-400 font-medium">Ngày chụp:</span>
                      <span className="font-semibold font-mono text-slate-700">
                        {order.shoot_date ? new Date(order.shoot_date).toLocaleDateString('vi-VN') : 'Chưa xếp lịch'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-400 font-medium">Giờ chụp:</span>
                      <span className="font-semibold font-mono text-slate-700">
                        {order.shoot_time || 'Chưa xếp giờ'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Selected Order Details & Connected Internal Tasks Section (Opens below when row selected) */}
      <div className="mt-6 animate-fade-in" id="order-details-section">
        {orderDetailLoading ? (
          <div className="bg-white rounded-2xl border border-gray-150 p-12 text-center text-slate-400 shadow-xs h-64 flex flex-col items-center justify-center">
            <RefreshCw className="w-8 h-8 animate-spin text-gold-500 mb-2" />
            <span className="text-xs font-semibold">Đang truy xuất hồ sơ chi tiết hợp đồng...</span>
          </div>
        ) : selectedOrder ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Contract Core Information Card */}
            <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-100 p-6 shadow-xs space-y-5">
              <div className="flex justify-between items-start gap-4 pb-3 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-base font-bold text-gray-900">{selectedOrder.order_code}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${statusMap[selectedOrder.status]?.color}`}>
                      {statusMap[selectedOrder.status]?.label}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mt-2 leading-snug">{selectedOrder.package_name}</h3>
                </div>

                {/* Status action */}
                {canEdit && (
                  <div className="shrink-0 flex items-center gap-2">
                    <button 
                      onClick={() => handleOpenEditModal(selectedOrder)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center transition-all cursor-pointer shadow-2xs border border-slate-200"
                    >
                      <Edit className="w-3.5 h-3.5 mr-1 text-slate-500" /> Sửa
                    </button>
                    <button 
                      onClick={handleOpenStatusModal}
                      className="bg-gold-600 hover:bg-gold-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center transition-all cursor-pointer shadow-2xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1" /> Trạng thái
                    </button>
                  </div>
                )}
              </div>

              {/* Core Info */}
              <div className="space-y-3.5 text-xs text-gray-600">
                <div className="border-b border-slate-50 pb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Hồ sơ khách hàng
                  </span>
                  <div className="space-y-1.5 pl-1">
                    <p className="text-gray-950 font-bold text-sm">{selectedOrder.customer?.full_name}</p>
                    <p className="flex items-center text-slate-600 font-medium">
                      <Phone className="w-3.5 h-3.5 mr-2 text-slate-400 shrink-0" /> {selectedOrder.customer?.phone}
                    </p>
                    {selectedOrder.customer?.email && (
                      <p className="flex items-center text-slate-600">
                        <User className="w-3.5 h-3.5 mr-2 text-slate-400 shrink-0" /> {selectedOrder.customer?.email}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Thông tin lịch chụp
                  </span>
                  <div className="space-y-1.5 pl-1 text-slate-700">
                    <p className="flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-2 text-slate-400 shrink-0" />
                      <strong className="w-20 shrink-0">Ngày chụp:</strong>
                      <span className="text-slate-900 font-semibold">{new Date(selectedOrder.shoot_date).toLocaleDateString('vi-VN')}</span>
                    </p>
                    <p className="flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-2 text-slate-400 shrink-0" />
                      <strong className="w-20 shrink-0">Giờ chụp:</strong>
                      <span className="text-slate-900">{selectedOrder.shoot_time || 'Chưa định giờ'}</span>
                    </p>
                  </div>
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center mb-1.5">
                    <FileText className="w-3.5 h-3.5 mr-1 text-slate-500" /> Ghi chú buổi chụp
                  </p>
                  <p className="text-xs text-slate-600 italic leading-relaxed whitespace-pre-line">
                    {selectedOrder.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Right Column (Colspan 2): Tasks & Logs split layout */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Internal tasks list */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wide flex items-center">
                    <CheckSquare className="w-4 h-4 text-gold-600 mr-2" /> Việc nội bộ liên quan hợp đồng
                  </h4>
                  {canAssignTasks && (
                    <button 
                      onClick={handleOpenTaskModal}
                      className="text-gold-600 hover:text-gold-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Giao việc nội bộ
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[180px] overflow-y-auto pr-1">
                  {selectedOrder.tasks?.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center col-span-2 italic">Chưa phân công công việc nội bộ nào liên quan.</p>
                  ) : (
                    selectedOrder.tasks?.map((tsk: any) => (
                      <div 
                        key={tsk.id} 
                        onClick={() => onNavigate('tasks', { selectTaskId: tsk.id })}
                        className="p-3 bg-slate-50/50 rounded-xl border border-slate-200/50 text-xs space-y-1.5 hover:border-gold-300 cursor-pointer transition-all hover:bg-slate-50"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-bold text-slate-900 truncate">{tsk.title}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase select-none ${
                            tsk.status === 'done' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                          }`}>
                            {tsk.status === 'done' ? 'Xong' : 'Đang làm'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">Phụ trách: <strong className="text-slate-700">{tsk.assigned_to_name}</strong></p>
                        {tsk.due_date && (
                          <p className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3 text-slate-300" /> Hạn: {new Date(tsk.due_date).toLocaleDateString('vi-VN')}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Status history logs timeline */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs space-y-4">
                <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wide flex items-center pb-2 border-b border-slate-100">
                  <History className="w-4 h-4 text-gold-600 mr-2" /> Nhật ký lịch sử tiến độ & trạng thái
                </h4>
                
                <div className="relative border-l border-slate-200 ml-4 space-y-5 pt-2 max-h-[180px] overflow-y-auto pr-2">
                  {selectedOrder.history?.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 pl-4 italic">Chưa có bản ghi hoạt động nào.</p>
                  ) : (
                    selectedOrder.history?.map((hist: any, i: number) => (
                      <div key={hist.id || i} className="relative pl-6 animate-fade-in">
                        <span className="absolute -left-[5px] top-1.5 bg-gold-500 rounded-full w-2.5 h-2.5 ring-4 ring-white"></span>
                        
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[10px] text-slate-400">
                            {new Date(hist.changed_at).toLocaleString('vi-VN')} • Thực hiện: <strong className="text-slate-700 font-bold">{hist.changed_by_name}</strong>
                          </p>
                          <div className="flex items-center gap-1.5 font-mono select-none">
                            {hist.from_status && (
                              <span className="text-[9px] text-slate-300 line-through uppercase">{hist.from_status}</span>
                            )}
                            <span className="bg-gold-50 text-gold-950 border border-gold-200/50 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">
                              → {hist.to_status}
                            </span>
                          </div>
                        </div>

                        {hist.note && (
                          <p className="text-xs text-slate-600 italic mt-1.5 bg-slate-50/40 p-2.5 rounded-xl border border-slate-100 inline-block leading-relaxed">
                            {hist.note}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

          </div>
        ) : (
	          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 shadow-xs flex flex-col items-center justify-center h-48">
	            <Briefcase className="w-10 h-10 opacity-30 mb-2" />
	            <h4 className="text-xs font-semibold text-gray-600">Chọn một dòng trên danh sách hợp đồng để xem hồ sơ & theo dõi tiến độ công việc</h4>
	            <p className="text-[11px] text-gray-400 mt-0.5 font-normal">Xem lịch chụp, công nợ, ghi chú và đầu việc liên quan đến hợp đồng.</p>
	          </div>
        )}
      </div>

      {/* Contract/Order creation modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl overflow-hidden border border-gray-100 animate-scale-in my-8">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-base">Hợp đồng chụp ảnh cưới mới</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {createError && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-xs flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1.5 shrink-0" />
                  {createError}
                </div>
              )}

              {/* Customer Selector Type */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Khách hàng</label>
                  <div className="flex space-x-2">
                    <button 
                      type="button" 
                      onClick={() => setIsNewCustomer(false)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                        !isNewCustomer ? 'bg-white border-gold-500 text-gold-800' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      Chọn từ danh sách
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setIsNewCustomer(true)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                        isNewCustomer ? 'bg-white border-gold-500 text-gold-800' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      + Tạo khách mới
                    </button>
                  </div>
                </div>

                {!isNewCustomer ? (
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="Nhập tên hoặc số điện thoại để tìm kiếm..."
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setIsCustDropdownOpen(true);
                        if (!e.target.value) {
                          setFormCustomerId('');
                        }
                      }}
                      onFocus={() => setIsCustDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setIsCustDropdownOpen(false), 250)}
                      className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-gold-500 font-medium"
                    />
                    {isCustDropdownOpen && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                        {customers.filter(c => 
                          (c.full_name || '').toLowerCase().includes(customerSearch.toLowerCase()) ||
                          (c.phone || '').includes(customerSearch)
                        ).length === 0 ? (
                          <div className="p-2.5 text-xs text-gray-400 italic text-center">Không tìm thấy khách hàng nào</div>
                        ) : (
                          customers.filter(c => 
                            (c.full_name || '').toLowerCase().includes(customerSearch.toLowerCase()) ||
                            (c.phone || '').includes(customerSearch)
                          ).map(c => (
	                            <div 
	                              key={c.id}
	                              onMouseDown={() => {
	                                setFormCustomerId(c.id);
	                                setCustomerSearch(`${c.full_name} (${c.phone})`);
                                  applyCustomerToForm(c);
	                                setIsCustDropdownOpen(false);
	                              }}
                              className={`p-2.5 text-xs cursor-pointer hover:bg-gold-50 transition-colors flex justify-between items-center ${
                                formCustomerId === c.id ? 'bg-gold-50/50 font-bold text-gold-900' : 'text-gray-700'
                              }`}
                            >
                              <span>{c.full_name}</span>
                              <span className="text-gray-400 font-mono text-[10px]">{c.phone}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <input 
                      type="text" 
                      placeholder="Họ tên *" 
                      value={custName}
                      onChange={(e) => setCustName(e.target.value)}
                      className="bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-none"
                    />
                    <input 
                      type="text" 
                      placeholder="Số điện thoại *" 
                      value={custPhone}
                      onChange={(e) => setCustPhone(e.target.value)}
                      className="bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-none"
                    />
                    <input 
                      type="email" 
                      placeholder="Email (tùy chọn)" 
                      value={custEmail}
                      onChange={(e) => setCustEmail(e.target.value)}
                      className="bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-none col-span-2"
                    />
	                    <input 
	                      type="text" 
	                      placeholder="Địa chỉ (tùy chọn)" 
	                      value={custAddress}
	                      onChange={(e) => setCustAddress(e.target.value)}
	                      className="bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-none col-span-2"
	                    />
	                  </div>
	                )}

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                    <div className="space-y-1 col-span-2">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Link Facebook cá nhân (nếu có)</label>
                      <input
                        type="text"
                        placeholder="Có thể để trống nếu khách đến trực tiếp, gọi điện hoặc được giới thiệu"
                        value={custFacebookUrl}
                        onChange={(e) => setCustFacebookUrl(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:border-gold-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Sinh nhật / thôi nôi</label>
                      <input
                        type="date"
                        value={custBirthday}
                        onChange={(e) => setCustBirthday(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:border-gold-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Kỷ niệm ngày cưới</label>
                      <input
                        type="date"
                        value={custWeddingDate}
                        onChange={(e) => setCustWeddingDate(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:border-gold-500"
                      />
                    </div>
                  </div>
	              </div>

              {/* Service details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Ngày chụp *</label>
                  <input 
                    type="date"
                    value={shootDate}
                    onChange={(e) => setShootDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Giờ chụp (nếu có)</label>
                  <input 
                    type="time"
                    value={shootTime}
                    onChange={(e) => setShootTime(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none"
                  />
                </div>
              </div>

	              <div className="space-y-1">
	                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Tên gói dịch vụ *</label>
                <input 
                  type="text"
                  placeholder="Ví dụ: Gói Album Studio Cao Cấp"
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none"
                  required
	                />
	              </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Doanh thu / Giá gói</label>
                    <input
                      type="number"
                      placeholder="Ví dụ: 1200"
                      value={packagePrice}
                      onChange={(e) => setPackagePrice(parseFloat(e.target.value) || 0)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none"
                    />
                    <p className="text-[10px] font-semibold text-slate-400">{MONEY_INPUT_HINT}</p>
                    <p className="text-[10px] font-bold text-emerald-700">= {formatVndFromThousands(packagePrice)}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Tiền cọc đã trả</label>
                    <input
                      type="number"
                      placeholder="Ví dụ: 500"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none"
                    />
                    <p className="text-[10px] font-semibold text-slate-400">Nhập theo nghìn đồng.</p>
                    <p className="text-[10px] font-bold text-emerald-700">= {formatVndFromThousands(depositAmount)}</p>
                  </div>
                </div>

	              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Ghi chú, yêu cầu thêm</label>
                <textarea 
                  rows={2}
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Yêu cầu chụp ngoại cảnh, phụ kiện thuê kèm..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none resize-none"
                />
              </div>

              <div className="flex space-x-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="w-1/2 border border-gray-200 hover:bg-gray-50 text-gray-700 py-2.5 rounded-xl text-xs font-semibold transition-colors"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit"
                  className="w-1/2 bg-gold-500 hover:bg-gold-600 text-white py-2.5 rounded-xl text-xs font-semibold shadow-xs transition-colors"
                >
                  Ký & Lưu hợp đồng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status change transition modal */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden border border-gray-100 animate-scale-in">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-base">Cập nhật tiến độ đơn hàng</h3>
              <button onClick={() => setIsStatusModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} className="p-6 space-y-4">
              {statusError && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-xs flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1.5 shrink-0" />
                  {statusError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Trạng thái mới</label>
                <select 
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none"
                >
                  {Object.entries(statusMap).map(([k, v]) => (
                    <option key={k} value={k}>{v.label} ({k.toUpperCase()})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Ghi chú lý do / Tiến độ</label>
                <textarea 
                  rows={3}
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Ví dụ: Khách đã thanh toán nốt tiền cọc, chuyển sang thợ làm ảnh chỉnh sửa..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none resize-none"
                />
              </div>

              <div className="flex space-x-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsStatusModalOpen(false)}
                  className="w-1/2 border border-gray-200 hover:bg-gray-50 text-gray-700 py-2 rounded-xl text-xs font-semibold"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit"
                  className="w-1/2 bg-gold-500 hover:bg-gold-600 text-white py-2 rounded-xl text-xs font-semibold shadow-xs"
                >
                  Xác nhận lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Internal Task Delegation Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden border border-gray-100 animate-scale-in">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-base">Giao công việc mới</h3>
              <button onClick={() => setIsTaskModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-6 space-y-4">
              {taskError && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-xs flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1.5 shrink-0" />
                  {taskError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Tiêu đề công việc *</label>
                <input 
                  type="text"
                  placeholder="Ví dụ: Chụp hình studio Hàn Quốc / Hậu kỳ album"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Nhân viên chịu trách nhiệm *</label>
                <select 
                  value={taskAssignedTo}
                  onChange={(e) => setTaskAssignedTo(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none"
                  required
                >
                  <option value="">-- Chọn nhân viên --</option>
                  {staffUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Mức độ ưu tiên</label>
                  <select 
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none"
                  >
                    <option value="low">Thấp</option>
                    <option value="normal">Bình thường</option>
                    <option value="high">Khẩn cấp</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Hạn chót hoàn thành</label>
                  <input 
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Mô tả công việc chi tiết</label>
                <textarea 
                  rows={2}
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Yêu cầu cụ thể, concept chụp, số lượng ảnh photoshop..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none resize-none"
                />
              </div>

              <div className="flex space-x-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsTaskModalOpen(false)}
                  className="w-1/2 border border-gray-200 hover:bg-gray-50 text-gray-700 py-2 rounded-xl text-xs font-semibold"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit"
                  className="w-1/2 bg-gold-500 hover:bg-gold-600 text-white py-2 rounded-xl text-xs font-semibold shadow-xs"
                >
                  Xác nhận giao việc
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl overflow-hidden border border-gray-100 animate-scale-in my-8">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-base">Cập nhật chi tiết Hợp đồng / Đơn hàng</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateOrder} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {editError && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-xs flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1.5 shrink-0" />
                  {editError}
                </div>
              )}

              {/* Service details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Ngày chụp *</label>
                  <input 
                    type="date"
                    value={editShootDate}
                    onChange={(e) => setEditShootDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Giờ chụp (nếu có)</label>
                  <input 
                    type="time"
                    value={editShootTime}
                    onChange={(e) => setEditShootTime(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Tên gói dịch vụ *</label>
                <input 
                  type="text"
                  placeholder="Ví dụ: Gói Album Studio Cao Cấp"
                  value={editPackageName}
                  onChange={(e) => setEditPackageName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Doanh thu / Giá gói</label>
                  <input 
                    type="number"
                    placeholder="Ví dụ: 1200"
                    value={editPackagePrice}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setEditPackagePrice(val);
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none"
                  />
                  <p className="text-[10px] font-semibold text-slate-400">{MONEY_INPUT_HINT}</p>
                  <p className="text-[10px] font-bold text-emerald-700">= {formatVndFromThousands(editPackagePrice)}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Tiền cọc đã trả</label>
                  <input 
                    type="number"
                    placeholder="Ví dụ: 500"
                    value={editDepositAmount}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setEditDepositAmount(val);
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none"
                  />
                  <p className="text-[10px] font-semibold text-slate-400">Nhập theo nghìn đồng.</p>
                  <p className="text-[10px] font-bold text-emerald-700">= {formatVndFromThousands(editDepositAmount)}</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Ghi chú, yêu cầu thêm</label>
                <textarea 
                  rows={3}
                  value={editOrderNotes}
                  onChange={(e) => setEditOrderNotes(e.target.value)}
                  placeholder="Yêu cầu chụp ngoại cảnh, concept chụp, số lượng ảnh photoshop..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none resize-none"
                />
              </div>

              <div className="flex space-x-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)}
                  className="w-1/2 border border-gray-200 hover:bg-gray-50 text-gray-700 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit"
                  className="w-1/2 bg-gold-500 hover:bg-gold-600 text-white py-2.5 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
