import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../../lib/api';
import { MONEY_INPUT_HINT, formatVndFromThousands } from '../../../lib/money';
import BottomSheet from '../shared/BottomSheet';
import { 
  Plus, 
  Search, 
  ChevronRight, 
  ChevronDown, 
  Activity, 
  Phone, 
  MessageSquare, 
  PlusCircle, 
  Send,
  PieChart as PieIcon, 
  List as ListIcon, 
  TrendingUp, 
  Heart,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

interface LeadFeedback {
  id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
}

interface Lead {
  id: string;
  date: string;
  customer_name: string;
  phone: string | null;
  source: string;
  interested_packages: {
    beauty: boolean;
    family: boolean;
    wedding: boolean;
    combo: boolean;
    couple: boolean;
  };
  sales_step: number;
  follow_up_status: {
    follow_1: boolean;
    follow_2: boolean;
    follow_3: boolean;
  };
  status: 'consulting' | 'won' | 'lost';
  revenue: number | null;
  success_reason: string | null;
  failure_reason: string | null;
  assigned_sale_id: string;
  support_needed: string | null;
  notes: string | null;
  admin_feedbacks: LeadFeedback[];
  created_at: string;
  updated_at: string;
}

interface MobileLeadsProps {
  userRole: string;
  userId: string;
}

export default function MobileLeads({ userRole, userId }: MobileLeadsProps) {
  const isAdmin = userRole === 'role-admin' || userRole === 'role-manager';

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs: kanban, list, analytics
  const [activeSubTab, setActiveSubTab] = useState<'kanban' | 'list' | 'analytics'>('kanban');

  // Search & filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSource, setSelectedSource] = useState('all');

  // Collapsed accordion state for Kanban steps (1-6)
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({
    1: true,
    2: false,
    3: false,
    4: false,
    5: false,
    6: false
  });

  // Modal / BottomSheet state
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form states
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newSource, setNewSource] = useState('PAGE THE WILL');
  const [newPackages, setNewPackages] = useState({
    beauty: false,
    family: false,
    wedding: true,
    combo: false,
    couple: false
  });
  const [newNotes, setNewNotes] = useState('');

  // Edit fields
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editStep, setEditStep] = useState(1);
  const [editStatus, setEditStatus] = useState<'consulting' | 'won' | 'lost'>('consulting');
  const [editRevenue, setEditRevenue] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [feedbackContent, setFeedbackContent] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const stepNames = [
    { num: 1, label: 'Khai thác nhu cầu' },
    { num: 2, label: 'Tư vấn giải pháp' },
    { num: 3, label: 'Đề xuất phương án' },
    { num: 4, label: 'Báo giá chi tiết' },
    { num: 5, label: 'Thương lượng chốt' },
    { num: 6, label: 'Chốt cọc thành công' }
  ];

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/api/leads');
      setLeads(data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải danh sách tư vấn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const payload = {
        customer_name: newName,
        phone: newPhone || null,
        source: newSource,
        interested_packages: newPackages,
        sales_step: 1,
        notes: newNotes || null
      };

      await apiRequest('/api/leads', 'POST', payload);
      setIsCreateOpen(false);
      // Reset
      setNewName('');
      setNewPhone('');
      setNewNotes('');
      fetchLeads();
    } catch (err: any) {
      alert(err.message || 'Không thể tạo mới');
    }
  };

  const openLeadDetail = (lead: Lead) => {
    setSelectedLead(lead);
    setEditName(lead.customer_name);
    setEditPhone(lead.phone || '');
    setEditSource(lead.source);
    setEditStep(lead.sales_step);
    setEditStatus(lead.status);
    setEditRevenue(lead.revenue !== null ? String(lead.revenue) : '');
    setEditNotes(lead.notes || '');
    setFeedbackContent('');
    setIsDetailOpen(true);
  };

  const handleUpdateLead = async () => {
    if (!selectedLead) return;

    try {
      const payload = {
        customer_name: editName,
        phone: editPhone || null,
        source: editSource,
        sales_step: editStep,
        status: editStatus,
        revenue: editRevenue !== '' ? parseFloat(editRevenue) : null,
        notes: editNotes || null
      };

      if (editStatus === 'won' && !editRevenue) {
        alert('Vui lòng nhập doanh thu chốt!');
        return;
      }

      const updated = await apiRequest(`/api/leads/${selectedLead.id}`, 'PUT', payload);
      setSelectedLead(updated);
      setIsDetailOpen(false);
      fetchLeads();
      alert('Cập nhật thông tin thành công!');
    } catch (err: any) {
      alert(err.message || 'Lỗi cập nhật');
    }
  };

  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !feedbackContent.trim()) return;

    try {
      setSubmittingFeedback(true);
      const newFeedback = await apiRequest(`/api/leads/${selectedLead.id}/feedback`, 'POST', {
        content: feedbackContent
      });

      setSelectedLead({
        ...selectedLead,
        admin_feedbacks: [...(selectedLead.admin_feedbacks || []), newFeedback]
      });
      setFeedbackContent('');
      fetchLeads();
    } catch (err: any) {
      alert(err.message || 'Lỗi gửi phản hồi');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const toggleStep = (step: number) => {
    setExpandedSteps(prev => ({ ...prev, [step]: !prev[step] }));
  };

  const getFilteredLeads = () => {
    return leads.filter(l => {
      const matchesSearch = l.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (l.phone && l.phone.includes(searchTerm));
      const matchesSource = selectedSource === 'all' || l.source === selectedSource;
      return matchesSearch && matchesSource;
    });
  };

  const filteredLeads = getFilteredLeads();

  // Helper values for analytics
  const sourcesCount = leads.reduce((acc: Record<string, number>, curr) => {
    acc[curr.source] = (acc[curr.source] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.keys(sourcesCount).map(key => ({
    name: key,
    value: sourcesCount[key]
  }));

  const COLORS = ['#c9a96e', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

  return (
    <div className="space-y-4 pb-6">
      {/* Sub Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
        <button 
          onClick={() => setActiveSubTab('kanban')}
          className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeSubTab === 'kanban' ? 'bg-white text-gold-900 shadow-2xs font-bold' : 'text-slate-500'}`}
        >
          <Activity className="w-4 h-4" />
          <span>Kanban</span>
        </button>
        <button 
          onClick={() => setActiveSubTab('list')}
          className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeSubTab === 'list' ? 'bg-white text-gold-900 shadow-2xs font-bold' : 'text-slate-500'}`}
        >
          <ListIcon className="w-4 h-4" />
          <span>Danh sách</span>
        </button>
        <button 
          onClick={() => setActiveSubTab('analytics')}
          className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeSubTab === 'analytics' ? 'bg-white text-gold-900 shadow-2xs font-bold' : 'text-slate-500'}`}
        >
          <PieIcon className="w-4 h-4" />
          <span>Báo cáo</span>
        </button>
      </div>

      {/* Floating Action Button (New Lead) */}
      <div className="flex justify-between items-center">
        <div className="relative flex-1 max-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input 
            type="text" 
            placeholder="Tìm kiếm..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:border-gold-400"
          />
        </div>

        <button 
          onClick={() => setIsCreateOpen(true)}
          className="bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Thêm Lead</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-gold-500"></div>
        </div>
      ) : activeSubTab === 'kanban' ? (
        /* Accordion Steps Kanban for Mobile */
        <div className="space-y-2">
          {stepNames.map(step => {
            const stepLeads = filteredLeads.filter(l => l.sales_step === step.num && l.status === 'consulting');
            const isOpen = expandedSteps[step.num];

            return (
              <div key={step.num} className="bg-white rounded-xl border border-slate-200/60 overflow-hidden shadow-3xs">
                <button 
                  onClick={() => toggleStep(step.num)}
                  className="w-full p-3.5 flex justify-between items-center bg-slate-50/50 active:bg-slate-100/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gold-100 text-gold-800 text-[10px] font-bold flex items-center justify-center font-mono">
                      {step.num}
                    </span>
                    <span className="text-xs font-bold text-slate-700">{step.label}</span>
                    <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded-full font-bold">
                      {stepLeads.length}
                    </span>
                  </div>
                  {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>

                {isOpen && (
                  <div className="p-3 bg-white divide-y divide-slate-100">
                    {stepLeads.length === 0 ? (
                      <p className="text-[10px] text-slate-400 py-3 text-center">Không có khách hàng ở bước này</p>
                    ) : (
                      stepLeads.map(lead => (
                        <div 
                          key={lead.id}
                          onClick={() => openLeadDetail(lead)}
                          className="py-3 first:pt-0 last:pb-0 cursor-pointer active:bg-slate-50 flex justify-between items-center"
                        >
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-slate-800">{lead.customer_name}</h4>
                            <div className="flex items-center gap-2 text-[9px] text-slate-400 font-semibold">
                              <span>Nguồn: {lead.source}</span>
                              {lead.phone && <span>· {lead.phone}</span>}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : activeSubTab === 'list' ? (
        /* Straight vertical scroll list */
        <div className="space-y-2">
          {filteredLeads.length === 0 ? (
            <div className="bg-white p-6 rounded-xl text-center text-slate-400 text-xs border">
              Không tìm thấy lead nào
            </div>
          ) : (
            filteredLeads.map(lead => (
              <div 
                key={lead.id}
                onClick={() => openLeadDetail(lead)}
                className="bg-white p-4 rounded-xl border border-slate-200/50 shadow-3xs flex justify-between items-center cursor-pointer active:bg-slate-50"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800">{lead.customer_name}</span>
                    <span className={`text-[8.5px] px-1.5 py-0.2 rounded font-bold uppercase ${
                      lead.status === 'won' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      lead.status === 'lost' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                      'bg-gold-50 text-gold-800 border border-gold-200'
                    }`}>
                      {lead.status === 'won' ? 'Thành công' : lead.status === 'lost' ? 'Thất bại' : 'Tư vấn'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold">
                    Bước: {lead.sales_step}/6 · Nguồn: {lead.source}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            ))
          )}
        </div>
      ) : (
        /* Analytics View */
        <div className="bg-white p-4 rounded-xl border border-slate-200/50 shadow-2xs space-y-6">
          <div>
            <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-gold-600" />
              Tỷ lệ nguồn Lead tư vấn
            </h4>
            {pieData.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Chưa có số liệu phân tích</p>
            ) : (
              <div className="h-48 flex justify-center items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE LEAD SHEET */}
      <BottomSheet 
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Thêm khách hàng tư vấn mới"
      >
        <form onSubmit={handleCreateLead} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tên khách hàng</label>
            <input 
              type="text" 
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nguyễn Văn A"
              className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-xs focus:outline-none"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Số điện thoại</label>
            <input 
              type="tel" 
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="0901234567"
              className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-xs focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nguồn khách hàng</label>
            <select
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-xs focus:outline-none"
            >
              <option value="PAGE THE WILL">PAGE THE WILL</option>
              <option value="TIKTOK THE WILL">TIKTOK THE WILL</option>
              <option value="HOTLINE">HOTLINE</option>
              <option value="GIỚI THIỆU">GIỚI THIỆU</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ghi chú yêu cầu</label>
            <textarea 
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              rows={3}
              placeholder="Nhập ghi chú ban đầu..."
              className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-xs focus:outline-none"
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-gradient-to-r from-gold-500 to-gold-600 text-white font-bold py-2.5 rounded-xl text-xs shadow-md"
          >
            Tạo thông tin tư vấn
          </button>
        </form>
      </BottomSheet>

      {/* DETAIL / EDIT SHEET */}
      <BottomSheet
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title="Chi tiết & Cập nhật Lead"
      >
        {selectedLead && (
          <div className="space-y-5">
            {/* Timeline of Steps */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/50">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                Tiến trình tư vấn ({selectedLead.status === 'won' ? 'Thành công' : selectedLead.status === 'lost' ? 'Thất bại' : `${editStep}/6`})
              </p>
              <div className="grid grid-cols-6 gap-1 relative">
                {[1, 2, 3, 4, 5, 6].map(num => {
                  const isCurrent = editStep === num && selectedLead.status === 'consulting';
                  const isPassed = editStep > num || selectedLead.status === 'won';
                  return (
                    <div 
                      key={num} 
                      onClick={() => selectedLead.status === 'consulting' && setEditStep(num)}
                      className={`h-2.5 rounded-full cursor-pointer transition-colors ${
                        isCurrent ? 'bg-gold-500' : isPassed ? 'bg-gold-300' : 'bg-slate-200'
                      }`}
                      title={stepNames[num - 1].label}
                    />
                  );
                })}
              </div>
              <p className="text-[10px] font-bold text-gold-700 mt-2 text-center">
                {selectedLead.status === 'consulting' 
                  ? `Đang ở: ${stepNames[editStep - 1].label}`
                  : selectedLead.status === 'won' ? 'Đã chốt thành công' : 'Đã thất bại'}
              </p>
            </div>

            {/* Editable Form Fields */}
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tên khách hàng</label>
                <input 
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Số điện thoại</label>
                <input 
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nguồn</label>
                  <input 
                    type="text"
                    value={editSource}
                    onChange={(e) => setEditSource(e.target.value)}
                    className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-xs focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trạng thái</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full bg-slate-50 border rounded-xl py-2.5 px-3 text-xs focus:outline-none"
                  >
                    <option value="consulting">Đang tư vấn</option>
                    <option value="won">Thành công (Won)</option>
                    <option value="lost">Thất bại (Lost)</option>
                  </select>
                </div>
              </div>

              {editStatus === 'won' && (
                <div className="space-y-1 animate-fade-in">
                  <label className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Doanh thu chốt</label>
                  <input 
                    type="number"
                    value={editRevenue}
                    onChange={(e) => setEditRevenue(e.target.value)}
                    placeholder="Ví dụ: 1200"
                    className="w-full bg-slate-50 border border-emerald-300 rounded-xl py-2 px-3 text-xs focus:outline-none"
                  />
                  <p className="text-[10px] font-semibold text-slate-400">{MONEY_INPUT_HINT}</p>
                  <p className="text-[10px] font-bold text-emerald-700">= {formatVndFromThousands(editRevenue)}</p>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ghi chú chăm sóc</label>
                <textarea 
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-xs focus:outline-none"
                />
              </div>

              <button 
                onClick={handleUpdateLead}
                className="w-full bg-gradient-to-r from-gold-500 to-gold-600 text-white font-bold py-2.5 rounded-xl text-xs shadow-md"
              >
                Cập nhật thông tin Lead
              </button>
            </div>

            {/* Feedbacks / Comments section (Internal tracking) */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-gold-600" />
                <span>Nhận xét nội bộ ({selectedLead.admin_feedbacks?.length || 0})</span>
              </h4>

              <div className="space-y-2 max-h-32 overflow-y-auto">
                {selectedLead.admin_feedbacks?.length === 0 ? (
                  <p className="text-[9px] text-slate-400 text-center py-2">Chưa có bình luận nội bộ</p>
                ) : (
                  selectedLead.admin_feedbacks?.map(f => (
                    <div key={f.id} className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <div className="flex justify-between items-center mb-1 text-[8.5px] text-slate-400 font-bold">
                        <span className="text-slate-600 font-extrabold">{f.user_name}</span>
                        <span>{new Date(f.created_at).toLocaleTimeString('vi-VN')}</span>
                      </div>
                      <p className="text-[10px] text-slate-700 leading-normal">{f.content}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleSendFeedback} className="flex gap-2">
                <input 
                  type="text"
                  placeholder="Gửi ý kiến, nhận xét..."
                  value={feedbackContent}
                  onChange={(e) => setFeedbackContent(e.target.value)}
                  className="flex-1 bg-slate-50 border rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={submittingFeedback}
                  className="bg-gold-500 hover:bg-gold-600 text-white rounded-xl px-3 flex items-center justify-center cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
