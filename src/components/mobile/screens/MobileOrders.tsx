import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/api';
import { formatVndFromThousands } from '../../../lib/money';
import BottomSheet from '../shared/BottomSheet';
import { 
  Search, 
  ChevronRight, 
  Clock, 
  DollarSign, 
  Calendar, 
  User, 
  Tag, 
  CheckCircle,
  FileText,
  AlertCircle
} from 'lucide-react';

interface MobileOrdersProps {
  userRole: string;
  initialSelectedOrderId?: string;
  onNavigate: (tab: string, arg?: any) => void;
}

export default function MobileOrders({ userRole, initialSelectedOrderId, onNavigate }: MobileOrdersProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [activeFilter, setActiveFilter] = useState<'all' | 'shooting' | 'editing' | 'ready' | 'delivered'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Order Detail
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  // Status transition state
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [submittingStatus, setSubmittingStatus] = useState(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/api/orders');
      setOrders(data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải danh sách đơn hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Handle deep link (when clicking from dashboard)
  useEffect(() => {
    if (initialSelectedOrderId && orders.length > 0) {
      const ord = orders.find(o => o.id === initialSelectedOrderId);
      if (ord) {
        openOrderDetail(ord.id);
      }
    }
  }, [initialSelectedOrderId, orders]);

  const openOrderDetail = async (orderId: string) => {
    try {
      setIsDetailOpen(true);
      setSelectedOrder(null);
      const detail = await apiRequest(`/api/orders/${orderId}`);
      setSelectedOrder(detail);
      setNewStatus(detail.status);
      setStatusNote('');
    } catch (err: any) {
      alert('Không thể tải chi tiết hợp đồng: ' + err.message);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedOrder || !newStatus) return;

    try {
      setSubmittingStatus(true);
      await apiRequest(`/api/orders/${selectedOrder.id}/status`, 'POST', {
        status: newStatus,
        note: statusNote
      });

      alert('Cập nhật trạng thái đơn hàng thành công!');
      setIsDetailOpen(false);
      fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi cập nhật trạng thái');
    } finally {
      setSubmittingStatus(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new': return { label: 'Mới nhận', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'confirmed': return { label: 'Xác nhận', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'shooting': return { label: 'Đang chụp', color: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'editing': return { label: 'Hậu kỳ', color: 'bg-violet-50 text-violet-700 border-violet-200' };
      case 'ready': return { label: 'Sẵn sàng', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'delivered': return { label: 'Bàn giao', color: 'bg-slate-50 text-slate-700 border-slate-200' };
      default: return { label: 'Không rõ', color: 'bg-slate-100 text-slate-600' };
    }
  };

  const getFilteredOrders = () => {
    return orders.filter(o => {
      const name = o.customer_name || '';
      const id = o.id || '';
      const pkg = o.package_name || '';
      const query = searchQuery.toLowerCase();

      const matchesSearch = name.toLowerCase().includes(query) || 
        id.toLowerCase().includes(query) ||
        pkg.toLowerCase().includes(query);
      const matchesTab = activeFilter === 'all' || o.status === activeFilter;
      return matchesSearch && matchesTab;
    });
  };

  const filteredOrders = getFilteredOrders();

  return (
    <div className="space-y-4 pb-6">
      {/* Search & Tabs */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
        <input 
          type="text" 
          placeholder="Tìm tên khách, mã đơn, gói chụp..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-gold-400"
        />
      </div>

      <div className="flex bg-slate-100 p-1 rounded-xl text-[10px] font-bold overflow-x-auto scrollbar-none whitespace-nowrap">
        {[
          { id: 'all', label: 'Tất cả' },
          { id: 'shooting', label: 'Đang chụp' },
          { id: 'editing', label: 'Hậu kỳ' },
          { id: 'ready', label: 'Sẵn sàng' },
          { id: 'delivered', label: 'Đã giao' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveFilter(tab.id as any)}
            className={`flex-1 py-1.5 px-3 rounded-lg transition-all ${activeFilter === tab.id ? 'bg-white text-gold-900 shadow-2xs font-bold' : 'text-slate-500'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-gold-500"></div>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white p-6 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs py-10">
          Không có hợp đồng nào phù hợp
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => {
            const badge = getStatusBadge(order.status);
            const price = order.package_price || 0;
            const remaining = price - (order.deposit_amount || 0);

            return (
              <div 
                key={order.id}
                onClick={() => openOrderDetail(order.id)}
                className="bg-white p-4 rounded-xl border border-slate-200/50 shadow-3xs hover:bg-slate-50 active:bg-slate-100 transition-colors flex justify-between items-center cursor-pointer"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">{order.customer_name}</span>
                    <span className={`text-[8.5px] px-1.5 py-0.2 rounded font-bold uppercase ${badge.color} border`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold">{order.package_name} · {order.shoot_date}</p>
                  <div className="flex gap-2 text-[9px] font-bold text-slate-500">
                    <span className="text-gold-700">Giá: {formatVndFromThousands(price)}</span>
                    {remaining > 0 && <span className="text-rose-600">Còn lại: {formatVndFromThousands(remaining)}</span>}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            );
          })}
        </div>
      )}

      {/* DETAIL SHEET */}
      <BottomSheet
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title="Thông tin chi tiết hợp đồng"
        maxHeight="90vh"
      >
        {!selectedOrder ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-gold-500"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header info */}
            <div className="space-y-2 pb-4 border-b border-slate-100">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">{selectedOrder.customer_name}</h4>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Mã đơn: {selectedOrder.id}</p>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${getStatusBadge(selectedOrder.status).color} border`}>
                  {getStatusBadge(selectedOrder.status).label}
                </span>
              </div>
            </div>

            {/* Shoot details */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-gold-600" /> Ngày chụp
                </span>
                <p className="font-bold text-slate-700">{selectedOrder.shoot_date}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3 text-gold-600" /> Giờ chụp
                </span>
                <p className="font-bold text-slate-700">{selectedOrder.shoot_time || 'Chưa hẹn'}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Tag className="w-3 h-3 text-gold-600" /> Gói dịch vụ
                </span>
                <p className="font-bold text-slate-700">{selectedOrder.package_name}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-emerald-600" /> Giá gói
                </span>
                <p className="font-bold text-emerald-600">{formatVndFromThousands(selectedOrder.package_price)}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-gold-600" /> Đã cọc
                </span>
                <p className="font-bold text-slate-700">{formatVndFromThousands(selectedOrder.deposit_amount || 0)}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-rose-500" /> Còn lại
                </span>
                <p className="font-bold text-rose-600">{formatVndFromThousands(selectedOrder.package_price - (selectedOrder.deposit_amount || 0))}</p>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <FileText className="w-3 h-3 text-slate-500" /> Yêu cầu đặc biệt
              </span>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-[11px] text-slate-600 leading-normal">
                {selectedOrder.notes || 'Không có ghi chú đặc biệt.'}
              </div>
            </div>

            {/* Status Update Form */}
            <div className="border-t border-slate-100 pt-4 space-y-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Cập nhật tiến trình</h4>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Trạng thái mới</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-xs focus:outline-none"
                  >
                    <option value="new">Mới nhận</option>
                    <option value="confirmed">Đã xác nhận</option>
                    <option value="shooting">Đang chụp</option>
                    <option value="editing">Hậu kỳ</option>
                    <option value="ready">Sẵn sàng bàn giao</option>
                    <option value="delivered">Đã bàn giao xong</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Ghi chú sự kiện</label>
                  <input
                    type="text"
                    placeholder="VD: Đã hoàn tất file gốc"
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handleUpdateStatus}
                disabled={submittingStatus}
                className="w-full bg-gradient-to-r from-gold-500 to-gold-600 text-white font-bold py-2.5 rounded-xl text-xs shadow-md"
              >
                {submittingStatus ? 'Đang cập nhật...' : 'Cập nhật trạng thái'}
              </button>
            </div>

            {/* Status Log timeline */}
            {selectedOrder.status_logs && selectedOrder.status_logs.length > 0 && (
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Lịch sử sự kiện</h4>
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {selectedOrder.status_logs.map((log: any, idx: number) => (
                    <div key={idx} className="flex gap-2.5 items-start text-[10px]">
                      <div className="w-1.5 h-1.5 rounded-full bg-gold-500 mt-1 shrink-0"></div>
                      <div className="flex-1">
                        <span className="font-bold text-slate-700">{getStatusBadge(log.status).label}</span>
                        {log.note && <span className="text-slate-500"> — {log.note}</span>}
                        <p className="text-[8.5px] text-slate-400 font-semibold">{new Date(log.changed_at).toLocaleString('vi-VN')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
