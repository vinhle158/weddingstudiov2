import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/api';
import BottomSheet from '../shared/BottomSheet';
import { 
  Search, 
  ChevronRight, 
  Phone, 
  Mail, 
  MapPin, 
  Plus, 
  UserPlus, 
  FileText,
  Briefcase
} from 'lucide-react';

interface MobileCustomersProps {
  userRole: string;
  onNavigate: (tab: string, arg?: any) => void;
}

export default function MobileCustomers({ userRole, onNavigate }: MobileCustomersProps) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Selected Customer details
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Form modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const data = await apiRequest(`/api/customers?q=${encodeURIComponent(searchQuery)}`);
      setCustomers(data || []);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [searchQuery]);

  const handleSelectCustomer = async (cust: any) => {
    setSelectedCustomer(cust);
    setIsDetailOpen(true);
    setOrdersLoading(true);
    try {
      const orders = await apiRequest(`/api/customers/${cust.id}/orders`);
      setCustomerOrders(orders || []);
    } catch (err) {
      console.error('Failed to fetch customer orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) return;

    try {
      const payload = {
        full_name: formName,
        phone: formPhone,
        email: formEmail || null,
        address: formAddress || null,
        notes: formNotes || null
      };

      if (isEditing && selectedCustomer) {
        await apiRequest(`/api/customers/${selectedCustomer.id}`, 'PUT', payload);
        alert('Cập nhật khách hàng thành công!');
      } else {
        await apiRequest('/api/customers', 'POST', payload);
        alert('Thêm khách hàng thành công!');
      }

      setIsFormOpen(false);
      fetchCustomers();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu khách hàng');
    }
  };

  const openCreateForm = () => {
    setIsEditing(false);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormNotes('');
    setIsFormOpen(true);
  };

  const openEditForm = () => {
    if (!selectedCustomer) return;
    setIsEditing(true);
    setFormName(selectedCustomer.full_name);
    setFormPhone(selectedCustomer.phone);
    setFormEmail(selectedCustomer.email || '');
    setFormAddress(selectedCustomer.address || '');
    setFormNotes(selectedCustomer.notes || '');
    setIsDetailOpen(false);
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Search & Actions */}
      <div className="flex justify-between items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input 
            type="text" 
            placeholder="Tìm theo tên, số điện thoại..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-gold-400"
          />
        </div>

        <button 
          onClick={openCreateForm}
          className="bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded-xl p-2.5 shadow-2xs cursor-pointer flex items-center justify-center"
        >
          <Plus className="w-4.5 h-4.5" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-gold-500"></div>
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-white p-6 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs py-10">
          Chưa tìm thấy khách hàng nào phù hợp
        </div>
      ) : (
        <div className="space-y-3">
          {customers.map(cust => (
            <div 
              key={cust.id}
              onClick={() => handleSelectCustomer(cust)}
              className="bg-white p-4 rounded-xl border border-slate-200/50 shadow-3xs hover:bg-slate-50 active:bg-slate-100 transition-colors flex justify-between items-center cursor-pointer"
            >
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-800">{cust.full_name}</span>
                <p className="text-[10px] text-slate-400 font-semibold">{cust.phone} {cust.address ? `· ${cust.address}` : ''}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          ))}
        </div>
      )}

      {/* DETAIL BOTTOM SHEET */}
      <BottomSheet
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title="Hồ sơ khách hàng"
      >
        {selectedCustomer && (
          <div className="space-y-5">
            {/* Customer Header */}
            <div className="flex justify-between items-start pb-4 border-b border-slate-100">
              <div>
                <h4 className="text-sm font-bold text-slate-800">{selectedCustomer.full_name}</h4>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Lịch sử The Will</p>
              </div>
              <button 
                onClick={openEditForm}
                className="text-xs font-bold text-gold-700 bg-gold-50 px-3 py-1.5 rounded-lg border border-gold-200/40 cursor-pointer"
              >
                Chỉnh sửa
              </button>
            </div>

            {/* Profile fields */}
            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-2.5 text-slate-600">
                <Phone className="w-4 h-4 text-gold-600 shrink-0" />
                <span className="font-semibold">{selectedCustomer.phone}</span>
              </div>

              {selectedCustomer.email && (
                <div className="flex items-center gap-2.5 text-slate-600">
                  <Mail className="w-4 h-4 text-gold-600 shrink-0" />
                  <span className="font-semibold">{selectedCustomer.email}</span>
                </div>
              )}

              {selectedCustomer.address && (
                <div className="flex items-center gap-2.5 text-slate-600">
                  <MapPin className="w-4 h-4 text-gold-600 shrink-0" />
                  <span className="font-semibold">{selectedCustomer.address}</span>
                </div>
              )}

              {selectedCustomer.notes && (
                <div className="flex items-start gap-2.5 text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 mt-2">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed text-slate-500 font-medium">{selectedCustomer.notes}</p>
                </div>
              )}
            </div>

            {/* Customer Orders list */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Hợp đồng liên kết ({customerOrders.length})</h4>
                <button
                  onClick={() => {
                    setIsDetailOpen(false);
                    onNavigate('orders', { openCreateForCustomerId: selectedCustomer.id });
                  }}
                  className="text-[10px] font-bold text-gold-700 hover:text-gold-800 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tạo hợp đồng</span>
                </button>
              </div>

              {ordersLoading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-gold-500"></div>
                </div>
              ) : customerOrders.length === 0 ? (
                <p className="text-[10px] text-slate-400 text-center py-4">Chưa có lịch sử hợp đồng</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {customerOrders.map(order => (
                    <div 
                      key={order.id} 
                      onClick={() => {
                        setIsDetailOpen(false);
                        onNavigate('orders', { selectOrderId: order.id });
                      }}
                      className="bg-slate-50 p-3 rounded-lg border border-slate-200/50 flex justify-between items-center cursor-pointer hover:bg-slate-100/50"
                    >
                      <div>
                        <p className="text-[10.5px] font-bold text-slate-700">{order.package_name}</p>
                        <span className="text-[8.5px] text-slate-400 font-bold uppercase">{order.shoot_date}</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </BottomSheet>

      {/* FORM BOTTOM SHEET */}
      <BottomSheet
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={isEditing ? 'Sửa thông tin khách hàng' : 'Thêm khách hàng mới'}
      >
        <form onSubmit={handleSaveCustomer} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Họ và tên</label>
            <input 
              type="text" 
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="VD: Nguyễn Văn A"
              className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-xs focus:outline-none"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Số điện thoại</label>
            <input 
              type="tel" 
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              placeholder="VD: 0912345678"
              className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-xs focus:outline-none"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email</label>
            <input 
              type="email" 
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="name@gmail.com"
              className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-xs focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Địa chỉ liên hệ</label>
            <input 
              type="text" 
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
              placeholder="Quận/Huyện, Tỉnh/Thành phố"
              className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-xs focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ghi chú đặc trưng</label>
            <textarea 
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={3}
              placeholder="Phong cách chụp thích khách thích, lưu ý về trang điểm..."
              className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-xs focus:outline-none"
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-gradient-to-r from-gold-500 to-gold-600 text-white font-bold py-2.5 rounded-xl text-xs shadow-md"
          >
            {isEditing ? 'Lưu thay đổi' : 'Tạo hồ sơ khách hàng'}
          </button>
        </form>
      </BottomSheet>
    </div>
  );
}
