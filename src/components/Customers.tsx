import React, { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import { 
  Search, 
  Plus, 
  UserPlus, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  Edit, 
  History, 
  Calendar, 
  Tag, 
  ChevronRight,
  X,
  AlertCircle,
  Gift,
  Heart,
  Facebook
} from 'lucide-react';

interface CustomersProps {
  userRole: string;
  onNavigate: (tab: string, arg?: any) => void;
  initialSelectedCustomerId?: string;
  isMobile?: boolean;
}

export default function Customers({ userRole, onNavigate, initialSelectedCustomerId, isMobile }: CustomersProps) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formBirthday, setFormBirthday] = useState('');
  const [formWeddingDate, setFormWeddingDate] = useState('');
  const [formFacebookUrl, setFormFacebookUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest(`/api/customers?q=${encodeURIComponent(searchQuery)}`);
      setCustomers(data);

      if (initialSelectedCustomerId) {
        const found = data.find((c: any) => c.id === initialSelectedCustomerId);
        if (found) {
          handleSelectCustomer(found);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách khách hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [searchQuery]);

  const handleSelectCustomer = async (cust: any) => {
    setSelectedCustomer(cust);
    setOrdersLoading(true);
    try {
      const orders = await apiRequest(`/api/customers/${cust.id}/orders`);
      setCustomerOrders(orders);
    } catch (err) {
      console.error('Error fetching customer orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleOpenCreateForm = () => {
    setIsEditing(false);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormNotes('');
    setFormBirthday('');
    setFormWeddingDate('');
    setFormFacebookUrl('');
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (cust: any) => {
    setIsEditing(true);
    setFormName(cust.full_name);
    setFormPhone(cust.phone);
    setFormEmail(cust.email || '');
    setFormAddress(cust.address || '');
    setFormNotes(cust.notes || '');
    setFormBirthday(cust.birthday || '');
    setFormWeddingDate(cust.wedding_date || '');
    setFormFacebookUrl(cust.facebook_url || '');
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formPhone) {
      setFormError('Vui lòng điền đầy đủ họ tên và số điện thoại');
      return;
    }

    let formattedFbUrl = formFacebookUrl.trim();
    if (formattedFbUrl && !formattedFbUrl.startsWith('http://') && !formattedFbUrl.startsWith('https://')) {
      formattedFbUrl = 'https://' + formattedFbUrl;
    }

    try {
      if (isEditing && selectedCustomer) {
        const updated = await apiRequest(`/api/customers/${selectedCustomer.id}`, 'PUT', {
          full_name: formName,
          phone: formPhone,
          email: formEmail,
          address: formAddress,
          notes: formNotes,
          birthday: formBirthday || null,
          wedding_date: formWeddingDate || null,
          facebook_url: formattedFbUrl || null
        });
        setSelectedCustomer(updated);
        setIsFormOpen(false);
        fetchCustomers();
      } else {
        const created = await apiRequest('/api/customers', 'POST', {
          full_name: formName,
          phone: formPhone,
          email: formEmail,
          address: formAddress,
          notes: formNotes,
          birthday: formBirthday || null,
          wedding_date: formWeddingDate || null,
          facebook_url: formattedFbUrl || null
        });
        setIsFormOpen(false);
        fetchCustomers();
        handleSelectCustomer(created);
      }
    } catch (err: any) {
      setFormError(err.message || 'Lỗi lưu thông tin khách hàng');
    }
  };

  const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'sales';

  return (
    <div className="space-y-6 animate-fade-in" id="customers-section-container">
      {/* Top action bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-gray-900 text-base md:text-lg flex items-center gap-2 leading-tight">
            <Tag className="w-5 h-5 text-gold-600 shrink-0" />
            <span>{isMobile ? "Danh sách khách hàng" : "Hồ sơ & Danh sách khách hàng (Dạng bảng)"}</span>
          </h3>
	          {!isMobile && (
	            <p className="text-xs text-slate-500 mt-1">
	              Tra cứu thông tin liên hệ, lịch sử hợp đồng, ngày kỷ niệm và ghi chú chăm sóc.
	            </p>
	          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input 
              type="text" 
              placeholder="Tìm tên, SĐT, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-gold-500 transition-colors"
            />
          </div>

          {canEdit && (
            <button 
              onClick={handleOpenCreateForm}
              className="bg-gold-600 hover:bg-gold-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Thêm khách hàng
            </button>
          )}
        </div>
      </div>

      {/* Main Grid Table - Dạng bảng/cột như file Excel */}
      {!isMobile && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Header Row or Meta info */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex justify-between items-center text-xs text-slate-500 select-none">
          <span className="font-medium">
            Danh sách khách hàng ({customers.length} bản ghi)
          </span>
          <span className="text-[10px] bg-gold-50 text-gold-800 px-2 py-0.5 rounded font-mono font-bold border border-gold-200/30">
            GRID VIEW
          </span>
        </div>

        <div className="max-h-[520px] overflow-auto">
          <table className="w-full text-left border-collapse table-fixed min-w-[1160px]">
            <colgroup>
              <col className="w-[52px]" />
              <col className="w-[240px]" />
              <col className="w-[140px]" />
              <col className="w-[190px]" />
              <col className="w-[240px]" />
              <col className="w-[205px]" />
              <col className="w-[96px]" />
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-100 text-xs font-bold text-slate-700 border-b border-slate-200">
                <th className="py-2 px-3 text-center border-r border-slate-200 font-mono text-[11px] select-none text-slate-400 bg-slate-50">STT</th>
                <th className="px-4 py-2 border-r border-slate-200">Họ và Tên</th>
                <th className="px-4 py-2 border-r border-slate-200">Số Điện Thoại</th>
                <th className="px-4 py-2 border-r border-slate-200">Email</th>
                <th className="px-4 py-2 border-r border-slate-200">Địa Chỉ</th>
                <th className="px-4 py-2 border-r border-slate-200">Ghi Chú Nội Bộ</th>
                <th className="px-3 py-2 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400 italic">
                    Đang tải danh sách khách hàng...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="py-6 px-4">
                    <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 mr-1.5" />
                      {error}
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400 italic">
                    Không tìm thấy khách hàng nào.
                  </td>
                </tr>
              ) : (
                customers.map((cust, idx) => {
                  const isSelected = selectedCustomer?.id === cust.id;
                  const rowNum = idx + 1;
                  return (
                    <tr 
                      key={cust.id}
                      onClick={() => handleSelectCustomer(cust)}
                      className={`hover:bg-slate-50/60 transition-all cursor-pointer border-b border-slate-200 ${
                        isSelected ? 'bg-gold-50/40 text-gold-950 font-semibold' : ''
                      }`}
                    >
                      {/* STT Column */}
                      <td className="py-2.5 px-3 text-center border-r border-slate-200 font-mono text-[11px] select-none text-slate-400 bg-slate-50/30">
                        {rowNum}
                      </td>

                      {/* Họ và Tên */}
                      <td className={`px-4 py-2.5 border-r border-slate-200 truncate ${
                        isSelected ? 'text-gold-900 font-bold' : 'text-gray-900 font-semibold'
                      }`}>
                        {cust.full_name}
                      </td>

                      {/* Số Điện Thoại */}
                      <td className="px-4 py-2.5 border-r border-slate-200 truncate font-mono text-slate-600">
                        {cust.phone}
                      </td>

                      {/* Email */}
                      <td className="px-4 py-2.5 border-r border-slate-200 truncate text-slate-500 font-normal">
                        {cust.email || <span className="text-slate-300 italic">Chưa cập nhật</span>}
                      </td>

                      {/* Địa Chỉ */}
                      <td className="px-4 py-2.5 border-r border-slate-200 truncate text-slate-500 font-normal">
                        {cust.address || <span className="text-slate-300 italic">Chưa cập nhật</span>}
                      </td>

                      {/* Ghi Chú */}
                      <td className="px-4 py-2.5 border-r border-slate-200 truncate text-slate-500 font-normal">
                        {cust.notes || <span className="text-slate-300 italic">Không có</span>}
                      </td>

                      {/* Thao tác */}
                      <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center space-x-1.5">
                          {canEdit && (
                            <button 
                              onClick={() => handleOpenEditForm(cust)}
                              className="text-slate-500 hover:text-gold-600 hover:bg-slate-100 p-1 rounded transition-colors cursor-pointer"
                              title="Sửa"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button 
                            onClick={() => handleSelectCustomer(cust)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                              isSelected 
                                ? 'bg-gold-100 text-gold-800' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            Xem
                          </button>
                        </div>
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
        <div className="space-y-3" id="customers-mobile-list">
          <div className="text-xs font-bold text-slate-500 px-1 mb-2 flex justify-between items-center">
            <span>Danh sách khách hàng ({customers.length})</span>
            <span className="text-[10px] bg-gold-50 text-gold-800 px-2 py-0.5 rounded font-mono font-bold border border-gold-200/30">
              MOBILE CARDS
            </span>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400 italic border border-slate-150">
              Đang tải danh sách khách hàng...
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs flex items-center justify-center">
              <AlertCircle className="w-4 h-4 mr-1.5" />
              {error}
            </div>
          ) : customers.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400 italic border border-slate-150">
              Không tìm thấy khách hàng nào.
            </div>
          ) : (
            customers.map((cust) => {
              const isSelected = selectedCustomer?.id === cust.id;
              
              return (
                <div 
                  key={cust.id}
                  onClick={() => {
                    handleSelectCustomer(cust);
                    setTimeout(() => {
                      document.getElementById('customer-details-section')?.scrollIntoView({ behavior: 'smooth' });
                    }, 150);
                  }}
                  className={`bg-white rounded-2xl border ${isSelected ? 'border-gold-500 ring-2 ring-gold-500/10' : 'border-slate-150'} p-4 transition-all shadow-2xs space-y-3 relative cursor-pointer hover:border-gold-300`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <h4 className={`text-sm font-bold text-slate-850 leading-snug ${isSelected ? 'text-gold-900 font-extrabold' : ''}`}>
                        {cust.full_name}
                      </h4>
                    </div>
                    {canEdit && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditForm(cust);
                        }}
                        className="text-slate-400 hover:text-gold-600 p-1.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all shrink-0"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
                    <div>
                      <span className="block text-slate-400 font-medium">Số điện thoại:</span>
                      <span className="font-semibold font-mono text-slate-700">{cust.phone}</span>
                    </div>
                    <div>
                      <span className="block text-slate-400 font-medium">Email:</span>
                      <span className="font-semibold text-slate-700 truncate block max-w-[120px]">
                        {cust.email || 'Chưa cập nhật'}
                      </span>
                    </div>
                  </div>

                  {cust.address && (
                    <div className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100/50 truncate">
                      <span className="text-slate-400">Địa chỉ: </span>
                      {cust.address}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Selected Customer Profile & History Detail Section */}
      <div className="mt-6" id="customer-details-section">
        {selectedCustomer ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Detail Card */}
            <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-100 p-6 shadow-xs space-y-5">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-bold text-gray-900">{selectedCustomer.full_name}</h3>
                  <p className="text-[10px] text-gray-400 font-mono mt-1 uppercase">MÃ KH: {selectedCustomer.id}</p>
                </div>
                {canEdit && (
                  <button 
                    onClick={() => onNavigate('orders', { openCreateForCustomerId: selectedCustomer.id })}
                    className="bg-gold-600 hover:bg-gold-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Hợp đồng mới
                  </button>
                )}
              </div>

              <div className="space-y-3.5 border-t border-gray-100 pt-4">
                <div className="flex items-center text-xs text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400 mr-2.5 shrink-0" />
                  <strong className="w-20 shrink-0">Điện thoại:</strong>
                  <span className="text-gray-900 font-semibold">{selectedCustomer.phone}</span>
                </div>
                <div className="flex items-center text-xs text-gray-600">
                  <Mail className="w-4 h-4 text-gray-400 mr-2.5 shrink-0" />
                  <strong className="w-20 shrink-0">Email:</strong>
                  <span className="text-gray-900 truncate">{selectedCustomer.email || 'Chưa cập nhật'}</span>
                </div>
                <div className="flex items-start text-xs text-gray-600">
                  <MapPin className="w-4 h-4 text-gray-400 mr-2.5 mt-0.5 shrink-0" />
                  <strong className="w-20 shrink-0">Địa chỉ:</strong>
                  <span className="text-gray-900">{selectedCustomer.address || 'Chưa cập nhật'}</span>
                </div>
                <div className="flex items-center text-xs text-gray-600">
                  <Facebook className="w-4 h-4 text-blue-500 mr-2.5 shrink-0" />
                  <strong className="w-20 shrink-0">Facebook:</strong>
                  {selectedCustomer.facebook_url ? (
                    <a 
                      href={selectedCustomer.facebook_url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-600 hover:text-blue-800 font-semibold underline truncate"
                    >
                      Link trang cá nhân
                    </a>
                  ) : (
                    <span className="text-gray-400 italic">Chưa cập nhật</span>
                  )}
                </div>
                {selectedCustomer.birthday && (
                  <div className="flex items-center text-xs text-gray-600">
                    <Gift className="w-4 h-4 text-gray-400 mr-2.5 shrink-0" />
                    <strong className="w-20 shrink-0">Sinh nhật:</strong>
                    <span className="text-gray-900 font-semibold">{selectedCustomer.birthday}</span>
                  </div>
                )}
                {selectedCustomer.wedding_date && (
                  <div className="flex items-center text-xs text-gray-600">
                    <Heart className="w-4 h-4 text-gray-400 mr-2.5 shrink-0" />
                    <strong className="w-20 shrink-0">Ngày cưới:</strong>
                    <span className="text-gray-900 font-semibold">{selectedCustomer.wedding_date}</span>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center mb-1.5">
                  <FileText className="w-3.5 h-3.5 mr-1 text-slate-500" /> Ghi chú nội bộ
                </p>
                <p className="text-xs text-slate-600 italic whitespace-pre-line leading-relaxed">
                  {selectedCustomer.notes || 'Không có ghi chú nào được lưu cho khách hàng này.'}
                </p>
              </div>
            </div>

            {/* Right Orders History Card */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-xs">
              <h3 className="font-bold text-gray-900 text-sm flex items-center pb-3 border-b border-gray-100 uppercase tracking-wide">
                <History className="w-4 h-4 text-gold-600 mr-2" /> Lịch sử hợp đồng & Đơn chụp
              </h3>

              {ordersLoading ? (
                <div className="py-12 text-center text-gray-400 text-xs">Đang tải lịch sử...</div>
              ) : customerOrders.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs">
                  <Calendar className="w-8 h-8 mx-auto opacity-30 mb-2" />
                  Khách hàng chưa có lịch sử ký kết hợp đồng nào.
                </div>
              ) : (
                <div className="divide-y divide-gray-100 max-h-[250px] overflow-y-auto pr-1 mt-1">
                  {customerOrders.map((order) => (
                    <div 
                      key={order.id} 
                      onClick={() => onNavigate('orders', { selectOrderId: order.id })}
                      className="py-3 hover:bg-slate-50/50 cursor-pointer transition-colors flex items-center justify-between group px-2 rounded-lg"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-xs text-slate-500">{order.order_code}</span>
                          <span className="text-xs font-bold text-slate-800">{order.package_name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                            order.status === 'delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            order.status === 'cancelled' ? 'bg-rose-50 text-rose-700 border-rose-200' : 
                            'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {order.status === 'new' ? 'Mới' :
                             order.status === 'confirmed' ? 'Đã xác nhận' :
                             order.status === 'shooting' ? 'Đang chụp' :
                             order.status === 'editing' ? 'Hậu kỳ' :
                             order.status === 'ready' ? 'Xong ảnh' :
                             order.status === 'delivered' ? 'Đã giao' : 'Đã hủy'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 text-[11px] text-gray-400">
                          <span>Ngày chụp: {new Date(order.shoot_date).toLocaleDateString('vi-VN')}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gold-600 transition-colors" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
	          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 shadow-xs flex flex-col items-center justify-center h-48">
	            <UserPlus className="w-10 h-10 opacity-30 mb-2" />
	            <h4 className="text-xs font-semibold text-gray-600">Chọn một dòng trên danh sách để xem nhanh lịch sử & hồ sơ chi tiết</h4>
	            <p className="text-[11px] text-gray-400 mt-0.5">Theo dõi liên hệ, ngày kỷ niệm và lịch sử hợp đồng của khách hàng.</p>
	          </div>
        )}
      </div>

      {/* Customer Edit / Create Modal Form */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden border border-gray-100 animate-scale-in">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-base">
                {isEditing ? 'Cập nhật thông tin khách hàng' : 'Thêm khách hàng mới'}
              </h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-xs flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1.5 shrink-0" />
                  {formError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Họ và tên *</label>
                <input 
                  type="text" 
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-gold-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Số điện thoại *</label>
                <input 
                  type="text" 
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="Ví dụ: 0901234567"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-gold-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Email (nếu có)</label>
                <input 
                  type="email" 
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="Ví dụ: example@domain.com"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-gold-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Địa chỉ</label>
                <input 
                  type="text" 
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Ví dụ: 123 Đường ABC, Quận XYZ"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-gold-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Link Facebook cá nhân</label>
                <input 
                  type="text" 
                  value={formFacebookUrl}
                  onChange={(e) => setFormFacebookUrl(e.target.value)}
                  placeholder="Ví dụ: facebook.com/username hoặc https://facebook.com/username"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-gold-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Sinh nhật / Thôi nôi</label>
                  <input 
                    type="date" 
                    value={formBirthday}
                    onChange={(e) => setFormBirthday(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-gold-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Kỷ niệm cưới</label>
                  <input 
                    type="date" 
                    value={formWeddingDate}
                    onChange={(e) => setFormWeddingDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-gold-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Ghi chú thêm</label>
                <textarea 
                  rows={3}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Sở thích, yêu cầu đặc biệt của khách..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-gold-500 resize-none"
                />
              </div>

              <div className="flex space-x-3 pt-4 border-t border-gray-100">
                <button 
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="w-1/2 border border-gray-200 hover:bg-gray-50 text-gray-700 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit"
                  className="w-1/2 bg-gold-500 hover:bg-gold-600 text-white py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  Lưu hồ sơ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
