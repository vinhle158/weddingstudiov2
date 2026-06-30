import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { 
  User, 
  Phone, 
  Share2, 
  DollarSign, 
  CheckCircle, 
  XCircle, 
  Plus, 
  MessageSquare, 
  Calendar, 
  ChevronRight, 
  ChevronLeft, 
  Filter, 
  BarChart2, 
  Kanban as KanbanIcon, 
  List, 
  Sparkles, 
  AlertCircle, 
  Send, 
  TrendingUp, 
  Users, 
  Camera,
  Activity,
  Heart,
  Briefcase,
  Edit
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';

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

interface LeadsProps {
  userRole: string;
}

export default function Leads({ userRole }: LeadsProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // View states
  const [viewMode, setViewMode] = useState<'kanban' | 'table' | 'analytics'>('kanban');
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedPackage, setSelectedPackage] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  
  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  
  // Form states (Create Lead)
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
  const [newSupport, setNewSupport] = useState('');
  
  // Form states (Edit Lead Detail)
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editPackages, setEditPackages] = useState({
    beauty: false,
    family: false,
    wedding: false,
    combo: false,
    couple: false
  });
  const [editStep, setEditStep] = useState(1);
  const [editFollowUps, setEditFollowUps] = useState({
    follow_1: false,
    follow_2: false,
    follow_3: false
  });
  const [editStatus, setEditStatus] = useState<'consulting' | 'won' | 'lost'>('consulting');
  const [editRevenue, setEditRevenue] = useState('');
  const [editSuccessReason, setEditSuccessReason] = useState('');
  const [editFailureReason, setEditFailureReason] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editSupport, setEditSupport] = useState('');
  
  // Feedback state
  const [feedbackContent, setFeedbackContent] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Analytics state
  const [analytics, setAnalytics] = useState<any>(null);

  const isAdmin = userRole === 'admin' || userRole === 'manager';
  const isReadOnly = isAdmin;

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/api/leads');
      setLeads(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách khách hàng tư vấn');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    if (!isAdmin) return;
    try {
      const data = await apiRequest('/api/leads/analytics');
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    }
  };

  useEffect(() => {
    fetchLeads();
    if (isAdmin) {
      fetchAnalytics();
    }
  }, [userRole]);

  // Handle Create Lead
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
        notes: newNotes || null,
        support_needed: newSupport || null
      };

      await apiRequest('/api/leads', 'POST', payload);
      setIsCreateModalOpen(false);
      
      // Reset form
      setNewName('');
      setNewPhone('');
      setNewSource('PAGE THE WILL');
      setNewPackages({
        beauty: false,
        family: false,
        wedding: true,
        combo: false,
        couple: false
      });
      setNewNotes('');
      setNewSupport('');

      fetchLeads();
      if (isAdmin) fetchAnalytics();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi tạo thông tin tư vấn');
    }
  };

  // Open Edit/Detail Modal
  const openDetailModal = (lead: Lead) => {
    setSelectedLead(lead);
    setEditName(lead.customer_name);
    setEditPhone(lead.phone || '');
    setEditSource(lead.source);
    setEditPackages({ ...lead.interested_packages });
    setEditStep(lead.sales_step);
    setEditFollowUps({ ...lead.follow_up_status });
    setEditStatus(lead.status);
    setEditRevenue(lead.revenue !== null ? String(lead.revenue) : '');
    setEditSuccessReason(lead.success_reason || '');
    setEditFailureReason(lead.failure_reason || '');
    setEditNotes(lead.notes || '');
    setEditSupport(lead.support_needed || '');
    setFeedbackContent('');
  };

  // Update Lead
  const handleUpdateLead = async () => {
    if (!selectedLead) return;

    try {
      const payload: any = {
        customer_name: editName,
        phone: editPhone || null,
        source: editSource,
        interested_packages: editPackages,
        sales_step: editStep,
        follow_up_status: editFollowUps,
        status: editStatus,
        revenue: editRevenue !== '' ? parseFloat(editRevenue) : null,
        success_reason: editStatus === 'won' ? editSuccessReason : null,
        failure_reason: editStatus === 'lost' ? editFailureReason : null,
        notes: editNotes || null,
        support_needed: editSupport || null
      };

      // Check validation
      if (editStatus === 'won' && !editRevenue) {
        alert('Vui lòng nhập doanh số chốt được!');
        return;
      }

      const updated = await apiRequest(`/api/leads/${selectedLead.id}`, 'PUT', payload);
      setSelectedLead(updated);
      fetchLeads();
      if (isAdmin) fetchAnalytics();
      alert('Cập nhật thông tin thành công!');
    } catch (err: any) {
      alert(err.message || 'Lỗi khi cập nhật thông tin');
    }
  };

  // Submit Feedback (Admin only)
  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !feedbackContent.trim()) return;

    try {
      setSubmittingFeedback(true);
      const newFeedback = await apiRequest(`/api/leads/${selectedLead.id}/feedback`, 'POST', {
        content: feedbackContent
      });

      // Update local state for feedback list
      setSelectedLead({
        ...selectedLead,
        admin_feedbacks: [...selectedLead.admin_feedbacks, newFeedback]
      });
      setFeedbackContent('');
      fetchLeads(); // refresh leads
    } catch (err: any) {
      alert(err.message || 'Lỗi gửi phản hồi');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // Move Sales Step directly in Kanban
  const moveLeadStep = async (leadId: string, currentStep: number, direction: 'prev' | 'next') => {
    let nextStep = currentStep;
    if (direction === 'prev' && currentStep > 1) nextStep = currentStep - 1;
    if (direction === 'next' && currentStep < 6) nextStep = currentStep + 1;

    if (nextStep === currentStep) return;

    try {
      await apiRequest(`/api/leads/${leadId}`, 'PUT', { sales_step: nextStep });
      fetchLeads();
      if (isAdmin) fetchAnalytics();
    } catch (err: any) {
      alert(err.message || 'Lỗi di chuyển bước tư vấn');
    }
  };

  // Filtering Logic
  const getFilteredLeads = () => {
    return leads.filter(l => {
      // 1. Search term (Name, Phone, Notes)
      const matchesSearch = 
        l.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.phone && l.phone.includes(searchTerm)) ||
        (l.notes && l.notes.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // 2. Month filter (date format: YYYY-MM-DD)
      const matchesMonth = selectedMonth === 'all' || l.date.substring(5, 7) === selectedMonth;

      // 3. Source filter
      const matchesSource = selectedSource === 'all' || l.source === selectedSource;

      // 4. Package filter
      let matchesPackage = true;
      if (selectedPackage !== 'all') {
        const key = selectedPackage as keyof typeof l.interested_packages;
        matchesPackage = l.interested_packages[key] === true;
      }

      // 5. Status filter
      let matchesStatus = true;
      if (selectedStatus === 'all') {
        matchesStatus = true;
      } else if (selectedStatus === 'consulting') {
        matchesStatus = l.status === 'consulting';
      } else if (selectedStatus === 'won') {
        matchesStatus = l.status === 'won';
      } else if (selectedStatus === 'lost') {
        matchesStatus = l.status === 'lost';
      }

      return matchesSearch && matchesMonth && matchesSource && matchesPackage && matchesStatus;
    });
  };

  const filteredLeads = getFilteredLeads();

  // Helper values for selectors
  const allMonths = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const allSources = Array.from(new Set(leads.map(l => l.source)));

  // Define 6 Steps Names
  const stepNames = [
    { num: 1, label: 'Khai thác nhu cầu', desc: 'Hiểu khách cần chụp dịp gì, mong muốn và lo lắng lớn nhất' },
    { num: 2, label: 'Tư vấn theo nhu cầu', desc: 'Tập trung vào giải pháp cho mong muốn của khách, gửi ảnh minh họa' },
    { num: 3, label: 'Đề xuất phương án', desc: 'Đưa ra 1-2 gói chụp phù hợp nhất, giải thích ưu điểm' },
    { num: 4, label: 'Báo giá', desc: 'Báo giá minh bạch, rõ ràng quyền lợi trong gói' },
    { num: 5, label: 'Thương lượng giá', desc: 'Tăng thêm giá trị tặng kèm nếu khách do dự, hạn chế giảm giá' },
    { num: 6, label: 'Chốt đơn / Thỏa thuận', desc: 'Chủ động giữ lịch, cọc tiền cọc hoặc ký hợp đồng' }
  ];

  // Codes definitions for display
  const successCodes = [
    { code: 'K1', desc: 'Nhu cầu rõ (Biết rõ mong muốn, hỏi thẳng gói)' },
    { code: 'K2', desc: 'Đã tham khảo trước (Đã so sánh kỹ, sẵn sàng cọc)' },
    { code: 'K3', desc: 'Tin tưởng thương hiệu (Đã follow lâu / giới thiệu)' },
    { code: 'S1', desc: 'Sale bắt đúng nhu cầu (Hiểu nhanh, không lan man)' },
    { code: 'S2', desc: 'Sale đề xuất đúng gói (Đúng mục tiêu tài chính)' },
    { code: 'S3', desc: 'Sale tạo niềm tin tốt (Tư vấn kỹ quy trình & cam kết)' },
    { code: 'S4', desc: 'Sale chốt đúng thời điểm (Chủ động, không ép khách)' },
    { code: 'P1', desc: 'Sản phẩm hình ảnh đẹp thuyết phục' },
    { code: 'P2', desc: 'Giá cả hợp lý với ngân sách' },
    { code: 'P3', desc: 'Chương trình ưu đãi hấp dẫn' }
  ];

  const failureCodes = [
    { code: 'K01', desc: 'Khách chưa có nhu cầu rõ ràng' },
    { code: 'K02', desc: 'Khách so sánh giá nhiều nơi' },
    { code: 'K03', desc: 'Khách chưa tin tưởng Studio' },
    { code: 'S01', desc: 'Sale hỏi sai / thiếu khai thác thông tin' },
    { code: 'S02', desc: 'Sale tư vấn lan man, không đúng trọng tâm' },
    { code: 'S03', desc: 'Sale không tạo ra sự khác biệt cho Studio' },
    { code: 'S04', desc: 'Sale không follow chăm sóc lại sau chat' },
    { code: 'S05', desc: 'Sale chốt sai thời điểm (Quá vội hoặc quá trễ)' },
    { code: 'P01', desc: 'Giá cả chưa phù hợp với khách' },
    { code: 'P02', desc: 'Hình ảnh demo chưa đủ thuyết phục' },
    { code: 'P03', desc: 'Các gói chụp chưa đúng nhu cầu mong muốn' }
  ];

  // RENDER LOADING / ERROR
  if (loading && leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gold-500"></div>
        <p className="mt-4 text-xs text-slate-400 font-semibold uppercase tracking-wider">Đang tải dữ liệu CRM...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* 1. Header Section */}
      <div className="bg-white border border-slate-200/60 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-gold-50 text-gold-600 rounded-xl">
              <Activity className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                Quản lý Tư vấn & CRM
                <span className="bg-gold-500/10 text-gold-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-gold-200/30">
                  {leads.length} leads
                </span>
              </h2>
              <p className="text-slate-400 text-[11px] font-medium leading-relaxed">
                Quy trình bám sát & chuyển đổi khách hàng tiềm năng thành hợp đồng chính thức.
              </p>
            </div>
          </div>
        </div>

        {/* Buttons / Actions */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* View Modes */}
          <div className="bg-slate-100 p-0.5 rounded-xl border border-slate-200/30 flex text-xs font-semibold text-slate-500 shadow-2xs">
            <button 
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${viewMode === 'kanban' ? 'bg-white text-slate-800 shadow-2xs font-bold' : 'hover:text-slate-800'}`}
            >
              <KanbanIcon className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button 
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white text-slate-800 shadow-2xs font-bold' : 'hover:text-slate-800'}`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Bảng dữ liệu</span>
            </button>
            {isAdmin && (
              <button 
                onClick={() => { setViewMode('analytics'); fetchAnalytics(); }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${viewMode === 'analytics' ? 'bg-white text-slate-800 shadow-2xs font-bold' : 'hover:text-slate-800'}`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Báo cáo</span>
              </button>
            )}
          </div>

          {/* Add lead (Only Sales/Admin) */}
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs hover:shadow-md cursor-pointer ml-auto md:ml-0"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm khách mới</span>
          </button>
        </div>
      </div>

      {/* 2. Filter Bar (Not shown in Analytics view) */}
      {viewMode !== 'analytics' && (
        <div className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-2xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="relative md:col-span-1">
              <input 
                type="text"
                placeholder="Tìm tên, SĐT, ghi chú..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-3.5 pr-8 text-xs focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/10 transition-all font-medium placeholder-slate-400 text-slate-800"
              />
            </div>

            {/* Filter Month */}
            <div>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-gold-400 font-semibold text-slate-600"
              >
                <option value="all">📅 Tất cả các tháng</option>
                {allMonths.map(m => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>
            </div>

            {/* Filter Source */}
            <div>
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-gold-400 font-semibold text-slate-600"
              >
                <option value="all">📣 Tất cả các nguồn</option>
                {allSources.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Filter Package */}
            <div>
              <select
                value={selectedPackage}
                onChange={(e) => setSelectedPackage(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-gold-400 font-semibold text-slate-600"
              >
                <option value="all">📸 Tất cả gói quan tâm</option>
                <option value="wedding">💍 Gói Wedding (Cưới)</option>
                <option value="family">👨‍👩‍👧‍👦 Gói Family (Gia đình)</option>
                <option value="beauty">👸 Gói Beauty (Chân dung)</option>
                <option value="combo">🎁 Gói Combo (Trọn gói)</option>
                <option value="couple">👩‍❤️‍👨 Gói Couple (Cặp đôi)</option>
              </select>
            </div>

            {/* Filter Status */}
            <div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-gold-400 font-semibold text-slate-600"
              >
                <option value="all">📈 Tất cả trạng thái</option>
                <option value="consulting">💬 Đang tư vấn</option>
                <option value="won">🎉 Chốt Thành Công</option>
                <option value="lost">❌ Thất bại</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Views Rendering */}

      {/* KANBAN BOARD */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 overflow-x-auto pb-4 select-none">
          {stepNames.map(step => {
            const leadsInStep = filteredLeads.filter(l => l.sales_step === step.num && l.status === 'consulting');
            
            return (
              <div 
                key={step.num}
                className="flex flex-col bg-slate-50 border border-slate-200/50 rounded-2xl p-3 min-w-[240px] max-h-[600px] shrink-0"
              >
                {/* Column Header */}
                <div className="mb-3 shrink-0">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 truncate max-w-[80%]">
                      <span className="w-5 h-5 flex items-center justify-center bg-gold-100 text-gold-800 rounded-md font-mono text-[10px] font-bold shrink-0">
                        {step.num}
                      </span>
                      <span className="truncate">{step.label}</span>
                    </h3>
                    <span className="bg-slate-200/80 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                      {leadsInStep.length}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium leading-normal line-clamp-2">
                    {step.desc}
                  </p>
                </div>

                {/* Column Content */}
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
                  {leadsInStep.length === 0 ? (
                    <div className="h-20 border border-dashed border-slate-200 rounded-xl flex items-center justify-center text-center p-3">
                      <p className="text-[10px] text-slate-400 font-medium italic">Không có khách hàng</p>
                    </div>
                  ) : (
                    leadsInStep.map(lead => {
                      const hasAdminFeedback = lead.admin_feedbacks.length > 0;
                      const hasSupportRequest = lead.support_needed !== null;

                      return (
                        <div
                          key={lead.id}
                          onClick={() => openDetailModal(lead)}
                          className="bg-white border border-slate-200/70 hover:border-gold-300 p-3 rounded-xl shadow-3xs hover:shadow-2xs transition-all cursor-pointer group space-y-2"
                        >
                          {/* Name & Source */}
                          <div className="flex justify-between items-start gap-1.5">
                            <h4 className="text-[12px] font-bold text-slate-800 group-hover:text-gold-700 truncate">
                              {lead.customer_name}
                            </h4>
                            <span className="bg-slate-100 text-slate-600 text-[8px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0 font-mono border border-slate-200/40">
                              {lead.source.replace('PAGE ', '')}
                            </span>
                          </div>

                          {/* Interested Packages Tags */}
                          <div className="flex flex-wrap gap-1">
                            {lead.interested_packages.wedding && (
                              <span className="bg-rose-50 text-rose-600 text-[8px] font-bold px-1.5 py-0.5 rounded-sm">💍 Wedding</span>
                            )}
                            {lead.interested_packages.family && (
                              <span className="bg-indigo-50 text-indigo-600 text-[8px] font-bold px-1.5 py-0.5 rounded-sm">👨‍👩‍👦 Family</span>
                            )}
                            {lead.interested_packages.beauty && (
                              <span className="bg-teal-50 text-teal-600 text-[8px] font-bold px-1.5 py-0.5 rounded-sm">👸 Beauty</span>
                            )}
                          </div>

                          {/* Follow-up State & Date */}
                          <div className="flex justify-between items-center text-[9px] text-slate-400 font-semibold border-t border-slate-100 pt-2 font-mono">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-300" />
                              {lead.date.substring(5)}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className={`w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-bold ${lead.follow_up_status.follow_1 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>1</span>
                              <span className={`w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-bold ${lead.follow_up_status.follow_2 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>2</span>
                              <span className={`w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-bold ${lead.follow_up_status.follow_3 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>3</span>
                            </div>
                          </div>

                          {/* Alerts/Status badges */}
                          {(hasAdminFeedback || hasSupportRequest) && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {hasSupportRequest && (
                                <span className="bg-amber-50 text-amber-700 text-[8px] font-bold px-1.5 py-0.5 rounded-sm border border-amber-200/40 flex items-center gap-0.5 shrink-0">
                                  <AlertCircle className="w-2.5 h-2.5 text-amber-600" /> Cần Hỗ Trợ
                                </span>
                              )}
                              {hasAdminFeedback && (
                                <span className="bg-blue-50 text-blue-700 text-[8px] font-bold px-1.5 py-0.5 rounded-sm border border-blue-200/40 flex items-center gap-0.5 shrink-0">
                                  <MessageSquare className="w-2.5 h-2.5 text-blue-600" /> Phản Hồi
                                </span>
                              )}
                            </div>
                          )}

                          {/* Quick navigation arrows (Kanban move) */}
                          <div 
                            className="flex justify-end gap-1.5 pt-1.5 opacity-0 group-hover:opacity-100 transition-opacity border-t border-slate-100"
                            onClick={(e) => e.stopPropagation()} // prevent opening detail modal
                          >
                            <button
                              disabled={step.num === 1}
                              onClick={() => moveLeadStep(lead.id, step.num, 'prev')}
                              className="p-1 hover:bg-slate-100 rounded-md disabled:opacity-30 cursor-pointer"
                            >
                              <ChevronLeft className="w-3 h-3 text-slate-500" />
                            </button>
                            <button
                              disabled={step.num === 6}
                              onClick={() => moveLeadStep(lead.id, step.num, 'next')}
                              className="p-1 hover:bg-slate-100 rounded-md disabled:opacity-30 cursor-pointer"
                            >
                              <ChevronRight className="w-3 h-3 text-slate-500" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}

          {/* Column for CLOSED (Won / Lost) */}
          <div className="flex flex-col bg-gold-50/20 border border-gold-200/30 rounded-2xl p-3 min-w-[240px] max-h-[600px] shrink-0">
            <div className="mb-3 shrink-0">
              <h3 className="text-xs font-bold text-gold-900 flex items-center gap-1.5">
                <span className="p-1 bg-gold-100 text-gold-700 rounded-md">
                  <CheckCircle className="w-3.5 h-3.5" />
                </span>
                <span>Đã Kết Thúc (Won / Lost)</span>
              </h3>
              <p className="text-[10px] text-gold-600/70 font-medium leading-normal mt-1">
                Các hợp đồng đã chốt thành công hoặc đã đánh dấu thất bại.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
              {filteredLeads.filter(l => l.status !== 'consulting').length === 0 ? (
                <div className="h-20 border border-dashed border-gold-200/40 rounded-xl flex items-center justify-center text-center p-3">
                  <p className="text-[10px] text-gold-600/60 font-medium italic">Không có dữ liệu</p>
                </div>
              ) : (
                filteredLeads.filter(l => l.status !== 'consulting').map(lead => (
                  <div
                    key={lead.id}
                    onClick={() => openDetailModal(lead)}
                    className={`border p-3 rounded-xl shadow-3xs transition-all cursor-pointer space-y-2 ${lead.status === 'won' ? 'bg-emerald-50/30 border-emerald-200/60 hover:border-emerald-400' : 'bg-rose-50/20 border-rose-200/40 hover:border-rose-400'}`}
                  >
                    <div className="flex justify-between items-start gap-1">
                      <h4 className="text-[12px] font-bold text-slate-800 truncate">
                        {lead.customer_name}
                      </h4>
                      <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded-md uppercase ${lead.status === 'won' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {lead.status === 'won' ? 'Chốt' : 'Thất bại'}
                      </span>
                    </div>

                    {lead.status === 'won' && lead.revenue && (
                      <div className="flex items-center gap-0.5 text-xs font-bold text-emerald-700">
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>{(lead.revenue).toLocaleString()}kđ</span>
                      </div>
                    )}

                    {lead.status === 'lost' && lead.failure_reason && (
                      <p className="text-[9px] font-bold text-rose-600 line-clamp-2">
                        Lý do: {lead.failure_reason}
                      </p>
                    )}

                    <div className="flex justify-between items-center text-[9px] text-slate-400 font-semibold border-t border-slate-100/50 pt-2 font-mono">
                      <span>Nguồn: {lead.source.replace('PAGE ', '')}</span>
                      <span>{lead.date.substring(5)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/60 text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">
                  <th className="py-3 px-4">Ngày tạo</th>
                  <th className="py-3 px-4">Tên khách hàng</th>
                  <th className="py-3 px-4">Số điện thoại</th>
                  <th className="py-3 px-4">Nguồn Page</th>
                  <th className="py-3 px-4">Dịch vụ quan tâm</th>
                  <th className="py-3 px-4 text-center">Bước tư vấn</th>
                  <th className="py-3 px-4 text-center">Chăm sóc</th>
                  <th className="py-3 px-4">Doanh số</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4">Phản hồi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400 font-semibold italic">
                      Không tìm thấy dữ liệu phù hợp với bộ lọc
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map(lead => (
                    <tr 
                      key={lead.id}
                      onClick={() => openDetailModal(lead)}
                      className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-medium text-slate-400">{lead.date}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{lead.customer_name}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">{lead.phone || '—'}</td>
                      <td className="py-3 px-4">
                        <span className="bg-slate-100 text-slate-700 text-[9px] font-bold px-2 py-0.5 rounded-md border border-slate-200/30">
                          {lead.source}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {lead.interested_packages.wedding && <span className="bg-rose-50 text-rose-600 text-[8px] font-bold px-1.5 py-0.5 rounded-sm">Wedding</span>}
                          {lead.interested_packages.family && <span className="bg-indigo-50 text-indigo-600 text-[8px] font-bold px-1.5 py-0.5 rounded-sm">Family</span>}
                          {lead.interested_packages.beauty && <span className="bg-teal-50 text-teal-600 text-[8px] font-bold px-1.5 py-0.5 rounded-sm">Beauty</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {lead.status === 'consulting' ? (
                          <span className="bg-gold-50 text-gold-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-gold-200/30">
                            B/{lead.sales_step}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-bold">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex gap-1">
                          <span className={`w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-bold ${lead.follow_up_status.follow_1 ? 'bg-emerald-100 text-emerald-700 font-extrabold' : 'bg-slate-100 text-slate-400'}`}>1</span>
                          <span className={`w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-bold ${lead.follow_up_status.follow_2 ? 'bg-emerald-100 text-emerald-700 font-extrabold' : 'bg-slate-100 text-slate-400'}`}>2</span>
                          <span className={`w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-bold ${lead.follow_up_status.follow_3 ? 'bg-emerald-100 text-emerald-700 font-extrabold' : 'bg-slate-100 text-slate-400'}`}>3</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700">
                        {lead.revenue ? `${(lead.revenue).toLocaleString()}kđ` : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${
                          lead.status === 'won' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' :
                          lead.status === 'lost' ? 'bg-rose-50 text-rose-700 border-rose-200/40' :
                          'bg-amber-50 text-amber-700 border-amber-200/40'
                        }`}>
                          {lead.status === 'won' ? 'Thành công' : lead.status === 'lost' ? 'Thất bại' : 'Đang tư vấn'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {lead.admin_feedbacks.length > 0 ? (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-600">
                            <MessageSquare className="w-3.5 h-3.5" />
                            {lead.admin_feedbacks.length}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ANALYTICS VIEW */}
      {viewMode === 'analytics' && analytics && (
        <div className="space-y-6">
          
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-2xs flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng số Lead tháng</p>
                <h3 className="text-xl font-extrabold text-slate-800 mt-0.5">{analytics.summary.totalLeads}</h3>
                <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1 font-semibold">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                  <span>Đang tư vấn: {analytics.summary.activeLeads}</span>
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-2xs flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Số Lead Chốt được</p>
                <h3 className="text-xl font-extrabold text-slate-800 mt-0.5">{analytics.summary.wonLeads}</h3>
                <p className="text-[10px] text-rose-500 mt-1 flex items-center gap-1 font-semibold">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Thất bại: {analytics.summary.lostLeads}</span>
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-2xs flex items-center gap-4">
              <div className="p-3 bg-gold-50 text-gold-600 rounded-xl shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tỷ lệ Chốt thành công</p>
                <h3 className="text-xl font-extrabold text-slate-800 mt-0.5">
                  {analytics.summary.conversionRate.toFixed(1)}%
                </h3>
                <div className="w-full bg-slate-100 rounded-full h-1 mt-1.5 overflow-hidden">
                  <div className="bg-gold-500 h-full rounded-full" style={{ width: `${analytics.summary.conversionRate}%` }}></div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-2xs flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng Doanh số Chốt</p>
                <h3 className="text-xl font-extrabold text-slate-800 mt-0.5">
                  {(analytics.summary.totalRevenue * 1000).toLocaleString()}đ
                </h3>
                <p className="text-[10px] text-slate-500 mt-1 font-semibold font-mono">
                  Ghi nhận từ các hợp đồng won
                </p>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Chart 1: Source Distribution */}
            <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-2xs space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">
                Nguồn Khách hàng tiếp cận
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={Object.entries(analytics.sources).map(([key, val]) => ({ name: key, value: val as number }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {[
                        '#d97706', // gold
                        '#4f46e5', // indigo
                        '#059669', // emerald
                        '#dc2626', // red
                        '#0891b2', // cyan
                        '#7c3aed'  // violet
                      ].map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} leads`, 'Số lượng']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Package Distribution */}
            <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-2xs space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">
                Gói dịch vụ quan tâm
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: '💍 Wedding', value: analytics.packages.wedding },
                        { name: '👨‍👩‍👧‍👦 Family', value: analytics.packages.family },
                        { name: '👸 Beauty', value: analytics.packages.beauty },
                        { name: '🎁 Combo', value: analytics.packages.combo },
                        { name: '👩‍❤️‍👨 Couple', value: analytics.packages.couple }
                      ].filter(item => item.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {[
                        '#e11d48', // rose
                        '#3b82f6', // blue
                        '#14b8a6', // teal
                        '#f59e0b', // amber
                        '#a855f7'  // purple
                      ].map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} quan tâm`, 'Số lượng']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Fail Reasons */}
            <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-2xs space-y-4 md:col-span-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">
                Thống kê nguyên nhân thất bại / Do dự khách hàng
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={Object.entries(analytics.failureReasons).map(([key, val]) => {
                      const desc = failureCodes.find(c => c.code === key)?.desc || key;
                      return { code: key, "Số lượng": val, desc };
                    }).sort((a: any, b: any) => (b["Số lượng"] as number) - (a["Số lượng"] as number))}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="code" />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={(value, name, props) => [`${value} lượt`, props.payload.desc]} />
                    <Bar dataKey="Số lượng" fill="#e11d48">
                      {Object.entries(analytics.failureReasons).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill="#f43f5e" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODALS */}

      {/* CREATE LEAD MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200/80 w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-gold-50 to-gold-100/50 p-4 border-b border-gold-200/30 flex justify-between items-center select-none">
              <h3 className="text-xs font-bold text-gold-900 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-gold-700" />
                <span>Thêm khách hàng tư vấn mới</span>
              </h3>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateLead} className="p-6 space-y-4">
              {/* Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Họ tên khách hàng *</label>
                <input 
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Thị Lan"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3.5 text-xs focus:outline-none focus:border-gold-400 transition-all font-medium text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Phone */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Số điện thoại</label>
                  <input 
                    type="text"
                    placeholder="Ví dụ: 0987654321"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3.5 text-xs focus:outline-none focus:border-gold-400 transition-all font-medium text-slate-800"
                  />
                </div>

                {/* Source */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nguồn tiếp cận *</label>
                  <select
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-gold-400 font-semibold text-slate-700"
                  >
                    <option value="PAGE THE WILL">PAGE THE WILL</option>
                    <option value="PAGE FAMILY">PAGE FAMILY</option>
                    <option value="PAGE GARDEN">PAGE GARDEN</option>
                    <option value="KHÁCH CŨ">KHÁCH CŨ</option>
                    <option value="VÃNG LAI">VÃNG LAI</option>
                    <option value="ĐƯỢC GIỚI THIỆU">ĐƯỢC GIỚI THIỆU</option>
                  </select>
                </div>
              </div>

              {/* Package Select */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nhu cầu / Gói chụp quan tâm</label>
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex items-center gap-1.5 p-2 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200/50 cursor-pointer select-none text-[11px] font-semibold text-slate-700">
                    <input 
                      type="checkbox"
                      checked={newPackages.wedding}
                      onChange={(e) => setNewPackages({ ...newPackages, wedding: e.target.checked })}
                      className="rounded-sm border-slate-300 text-gold-600 focus:ring-gold-500"
                    />
                    <span>💍 Wedding</span>
                  </label>
                  <label className="flex items-center gap-1.5 p-2 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200/50 cursor-pointer select-none text-[11px] font-semibold text-slate-700">
                    <input 
                      type="checkbox"
                      checked={newPackages.family}
                      onChange={(e) => setNewPackages({ ...newPackages, family: e.target.checked })}
                      className="rounded-sm border-slate-300 text-gold-600 focus:ring-gold-500"
                    />
                    <span>👨‍👩‍👦 Family</span>
                  </label>
                  <label className="flex items-center gap-1.5 p-2 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200/50 cursor-pointer select-none text-[11px] font-semibold text-slate-700">
                    <input 
                      type="checkbox"
                      checked={newPackages.beauty}
                      onChange={(e) => setNewPackages({ ...newPackages, beauty: e.target.checked })}
                      className="rounded-sm border-slate-300 text-gold-600 focus:ring-gold-500"
                    />
                    <span>👸 Beauty</span>
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ghi chú đàm phán ban đầu</label>
                <textarea 
                  placeholder="Khách muốn chụp phong cách nhẹ nhàng, dự kiến cưới tháng 12..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3.5 text-xs focus:outline-none focus:border-gold-400 transition-all font-medium text-slate-800"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Tạo khách hàng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL & EDIT MODAL (CRM WORKSPACE) */}
      {selectedLead && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200/80 w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden animate-scale-up flex flex-col">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-gold-50 to-gold-100/50 p-4 border-b border-gold-200/30 flex justify-between items-center select-none shrink-0">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  editStatus === 'won' ? 'bg-emerald-500' :
                  editStatus === 'lost' ? 'bg-rose-500' : 'bg-amber-500 animate-pulse'
                }`}></span>
                <h3 className="text-xs font-bold text-gold-900 uppercase tracking-wider">
                  Hồ sơ tư vấn chi tiết: {editName}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedLead(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Grid Body */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-5 gap-6">
              
              {/* LEFT SIDE: Admin = Visual Progress Tracker | Sales = Edit Form */}
              <div className="md:col-span-3 space-y-4">
                {isReadOnly ? (
                  /* ─── ADMIN VIEW: Visual Progress Tracker ─── */
                  <>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5 select-none">
                      <Activity className="w-4 h-4 text-blue-500" />
                      Bảng theo dõi tiến trình tư vấn
                    </h4>

                    {/* Customer Summary Row */}
                    <div className="flex items-start gap-4 p-3.5 bg-gradient-to-r from-slate-50 to-slate-100/60 rounded-2xl border border-slate-200/50">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">
                        {editName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-sm truncate">{editName}</p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{editPhone || 'Chưa có SĐT'}</p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gold-100 text-gold-700 border border-gold-200">
                          {editSource}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          editStatus === 'won'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : editStatus === 'lost'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {editStatus === 'won' ? '✓ Đã chốt' : editStatus === 'lost' ? '✕ Thất bại' : '● Đang tư vấn'}
                        </span>
                      </div>
                    </div>

                    {/* Step Progress Timeline */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tiến trình tư vấn 6 bước</p>
                      <div className="relative">
                        {/* Progress Track */}
                        <div className="flex items-center gap-0">
                          {stepNames.map((step, idx) => {
                            const isCompleted = step.num < editStep || editStatus === 'won';
                            const isCurrent = step.num === editStep && editStatus === 'consulting';
                            const isPast = step.num < editStep;
                            return (
                              <div key={step.num} className="flex-1 flex flex-col items-center">
                                {/* Connector line before */}
                                <div className="w-full flex items-center">
                                  {idx > 0 && (
                                    <div className={`flex-1 h-0.5 ${isPast || editStatus === 'won' ? 'bg-gold-400' : 'bg-slate-200'}`} />
                                  )}
                                  {/* Circle */}
                                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 shrink-0 transition-all ${
                                    editStatus === 'won'
                                      ? 'bg-emerald-500 border-emerald-500 text-white'
                                      : isCompleted
                                      ? 'bg-gold-500 border-gold-500 text-white'
                                      : isCurrent
                                      ? 'bg-white border-gold-500 text-gold-700 ring-2 ring-gold-300 ring-offset-1'
                                      : 'bg-white border-slate-200 text-slate-400'
                                  }`}>
                                    {(isCompleted || editStatus === 'won') ? '✓' : step.num}
                                  </div>
                                  {idx < stepNames.length - 1 && (
                                    <div className={`flex-1 h-0.5 ${(isPast && step.num < editStep - 1) || editStatus === 'won' ? 'bg-gold-400' : 'bg-slate-200'}`} />
                                  )}
                                </div>
                                {/* Label */}
                                <p className={`text-[9px] font-semibold mt-1.5 text-center leading-tight max-w-[50px] ${
                                  isCurrent ? 'text-gold-700' : isCompleted || editStatus === 'won' ? 'text-slate-600' : 'text-slate-400'
                                }`}>
                                  {step.label}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      {editStatus === 'consulting' && (
                        <p className="text-[10px] text-center text-gold-700 font-semibold mt-1">
                          Đang ở bước {editStep}/6 — {stepNames.find(s => s.num === editStep)?.label}
                        </p>
                      )}
                    </div>

                    {/* Packages & Follow-up row */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Packages */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gói quan tâm</p>
                        <div className="flex flex-wrap gap-1.5">
                          {editPackages.wedding && <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-full">💍 Wedding</span>}
                          {editPackages.family  && <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-full">👨‍👩‍👧 Family</span>}
                          {editPackages.beauty  && <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-50 text-purple-600 border border-purple-200 rounded-full">👸 Beauty</span>}
                          {editPackages.combo   && <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-full">🎁 Combo</span>}
                          {editPackages.couple  && <span className="text-[10px] font-bold px-2 py-0.5 bg-pink-50 text-pink-600 border border-pink-200 rounded-full">💑 Couple</span>}
                          {!editPackages.wedding && !editPackages.family && !editPackages.beauty && !editPackages.combo && !editPackages.couple && (
                            <span className="text-[10px] text-slate-400 italic">Chưa xác định</span>
                          )}
                        </div>
                      </div>

                      {/* Follow-up */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bám sát (Follow-up)</p>
                        <div className="space-y-1">
                          {[
                            { key: 'follow_1', label: 'Follow 1 (6-12h)' },
                            { key: 'follow_2', label: 'Follow 2 (1-2 ngày)' },
                            { key: 'follow_3', label: 'Follow 3 (2-4 ngày)' },
                          ].map(f => {
                            const done = editFollowUps[f.key as keyof typeof editFollowUps];
                            return (
                              <div key={f.key} className={`flex items-center gap-1.5 text-[10px] font-semibold ${done ? 'text-emerald-700' : 'text-slate-400'}`}>
                                <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] shrink-0 ${done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white'}`}>
                                  {done ? '✓' : ''}
                                </span>
                                {f.label}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Won/Lost details */}
                    {editStatus === 'won' && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-emerald-800">Đã chốt thành công!</p>
                          <p className="text-[11px] text-emerald-700 mt-0.5">
                            Doanh số: <span className="font-bold">{editRevenue ? `${Number(editRevenue).toLocaleString()} kđ` : 'Chưa cập nhật'}</span>
                            {editSuccessReason && <span className="ml-2">· Lý do: {editSuccessReason}</span>}
                          </p>
                        </div>
                      </div>
                    )}
                    {editStatus === 'lost' && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3">
                        <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-rose-800">Thất bại / Không chốt được</p>
                          {editFailureReason && (
                            <p className="text-[11px] text-rose-700 mt-0.5">
                              Nguyên nhân: <span className="font-bold">{editFailureReason}</span>
                              {' — '}{failureCodes.find(c => c.code === editFailureReason)?.desc}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {editNotes && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nhật ký đàm phán của Sale</p>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                          {editNotes}
                        </div>
                      </div>
                    )}

                    {/* Support Request */}
                    {editSupport && (
                      <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex gap-2.5">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-0.5">Sale nhờ tư vấn thêm</p>
                          <p className="text-xs text-amber-900 leading-relaxed">{editSupport}</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* ─── SALE VIEW: Edit Form ─── */
                  <>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5 select-none">
                      <Edit className="w-4 h-4 text-gold-600" />
                      Cập nhật tiến trình tư vấn
                    </h4>

                {/* Name & Phone */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tên khách hàng</label>
                    <input 
                      type="text"
                      value={editName}
                      disabled={isReadOnly}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-gold-400 font-semibold text-slate-800 disabled:opacity-75 disabled:bg-slate-100/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Số điện thoại</label>
                    <input 
                      type="text"
                      placeholder="Trống"
                      value={editPhone}
                      disabled={isReadOnly}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-gold-400 font-mono text-slate-800 disabled:opacity-75 disabled:bg-slate-100/50"
                    />
                  </div>
                </div>

                {/* Source & Step */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nguồn tiếp cận</label>
                    <select
                      value={editSource}
                      disabled={isReadOnly}
                      onChange={(e) => setEditSource(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-gold-400 font-semibold text-slate-700 disabled:opacity-75 disabled:bg-slate-100/50"
                    >
                      <option value="PAGE THE WILL">PAGE THE WILL</option>
                      <option value="PAGE FAMILY">PAGE FAMILY</option>
                      <option value="PAGE GARDEN">PAGE GARDEN</option>
                      <option value="KHÁCH CŨ">KHÁCH CŨ</option>
                      <option value="VÃNG LAI">VÃNG LAI</option>
                      <option value="ĐƯỢC GIỚI THIỆU">ĐƯỢC GIỚI THIỆU</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bước tư vấn hiện tại</label>
                    <select
                      value={editStep}
                      disabled={editStatus !== 'consulting' || isReadOnly}
                      onChange={(e) => setEditStep(parseInt(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-gold-400 font-semibold text-slate-700 disabled:opacity-50 disabled:bg-slate-100/50"
                    >
                      {stepNames.map(step => (
                        <option key={step.num} value={step.num}>B/{step.num} - {step.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Packages checklist */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">Nhu cầu / Gói chụp quan tâm</label>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="flex items-center gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200/50 cursor-pointer select-none text-[11px] font-semibold text-slate-700">
                      <input 
                        type="checkbox"
                        disabled={isReadOnly}
                        checked={editPackages.wedding}
                        onChange={(e) => setEditPackages({ ...editPackages, wedding: e.target.checked })}
                        className="rounded-sm border-slate-300 text-gold-600 focus:ring-gold-500 disabled:opacity-60"
                      />
                      <span>Wedding</span>
                    </label>
                    <label className="flex items-center gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200/50 cursor-pointer select-none text-[11px] font-semibold text-slate-700">
                      <input 
                        type="checkbox"
                        disabled={isReadOnly}
                        checked={editPackages.family}
                        onChange={(e) => setEditPackages({ ...editPackages, family: e.target.checked })}
                        className="rounded-sm border-slate-300 text-gold-600 focus:ring-gold-500 disabled:opacity-60"
                      />
                      <span>Family</span>
                    </label>
                    <label className="flex items-center gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200/50 cursor-pointer select-none text-[11px] font-semibold text-slate-700">
                      <input 
                        type="checkbox"
                        disabled={isReadOnly}
                        checked={editPackages.beauty}
                        onChange={(e) => setEditPackages({ ...editPackages, beauty: e.target.checked })}
                        className="rounded-sm border-slate-300 text-gold-600 focus:ring-gold-500 disabled:opacity-60"
                      />
                      <span>Beauty</span>
                    </label>
                  </div>
                </div>

                {/* Follow-up checklist */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">Nhật ký Bám sát (Follow-up)</label>
                  <div className="grid grid-cols-3 gap-2 text-[10px] font-bold">
                    <label className="flex items-center gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200/50 cursor-pointer select-none text-slate-700">
                      <input 
                        type="checkbox"
                        disabled={isReadOnly}
                        checked={editFollowUps.follow_1}
                        onChange={(e) => setEditFollowUps({ ...editFollowUps, follow_1: e.target.checked })}
                        className="rounded-sm border-slate-300 text-gold-600 focus:ring-gold-500 disabled:opacity-60"
                      />
                      <span>Follow 1 (6-12h)</span>
                    </label>
                    <label className="flex items-center gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200/50 cursor-pointer select-none text-slate-700">
                      <input 
                        type="checkbox"
                        disabled={isReadOnly}
                        checked={editFollowUps.follow_2}
                        onChange={(e) => setEditFollowUps({ ...editFollowUps, follow_2: e.target.checked })}
                        className="rounded-sm border-slate-300 text-gold-600 focus:ring-gold-500 disabled:opacity-60"
                      />
                      <span>Follow 2 (1-2 ngày)</span>
                    </label>
                    <label className="flex items-center gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200/50 cursor-pointer select-none text-slate-700">
                      <input 
                        type="checkbox"
                        disabled={isReadOnly}
                        checked={editFollowUps.follow_3}
                        onChange={(e) => setEditFollowUps({ ...editFollowUps, follow_3: e.target.checked })}
                        className="rounded-sm border-slate-300 text-gold-600 focus:ring-gold-500 disabled:opacity-60"
                      />
                      <span>Follow 3 (2-4 ngày)</span>
                    </label>
                  </div>
                </div>

                {/* Status Toggle & Details */}
                <div className="bg-slate-50 border border-slate-200/50 p-4 rounded-2xl space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">Trạng thái chung</label>
                    <div className="grid grid-cols-3 gap-2 bg-slate-200/50 p-0.5 rounded-xl text-xs font-bold text-slate-500">
                      <button
                        type="button"
                        disabled={isReadOnly}
                        onClick={() => setEditStatus('consulting')}
                        className={`py-1.5 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed ${editStatus === 'consulting' ? 'bg-white text-amber-800 shadow-3xs' : 'hover:text-slate-800'}`}
                      >
                        Đang tư vấn
                      </button>
                      <button
                        type="button"
                        disabled={isReadOnly}
                        onClick={() => setEditStatus('won')}
                        className={`py-1.5 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed ${editStatus === 'won' ? 'bg-emerald-600 text-white shadow-3xs' : 'hover:text-slate-800'}`}
                      >
                        Chốt Thành Công
                      </button>
                      <button
                        type="button"
                        disabled={isReadOnly}
                        onClick={() => setEditStatus('lost')}
                        className={`py-1.5 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed ${editStatus === 'lost' ? 'bg-rose-600 text-white shadow-3xs' : 'hover:text-slate-800'}`}
                      >
                        Thất bại
                      </button>
                    </div>
                  </div>

                  {/* If WON: Show Revenue and Success Reason */}
                  {editStatus === 'won' && (
                    <div className="grid grid-cols-2 gap-4 animate-fade-in">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Doanh số chốt (kđ) *</label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                          <input 
                            type="number"
                            required
                            disabled={isReadOnly}
                            placeholder="Ví dụ: 4300 (4.3 triệu)"
                            value={editRevenue}
                            onChange={(e) => setEditRevenue(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-8 pr-3 text-xs focus:outline-none focus:border-gold-400 font-bold text-emerald-700 disabled:opacity-75 disabled:bg-slate-100/50"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lý do chốt thành công</label>
                        <select
                          value={editSuccessReason}
                          disabled={isReadOnly}
                          onChange={(e) => setEditSuccessReason(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-gold-400 font-semibold text-slate-600 disabled:opacity-75 disabled:bg-slate-100/50"
                        >
                          <option value="">-- Chọn lý do chính --</option>
                          {successCodes.map(c => (
                            <option key={c.code} value={c.code}>{c.code} - {c.desc}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* If LOST: Show Failure Reason */}
                  {editStatus === 'lost' && (
                    <div className="space-y-1 animate-fade-in">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nguyên nhân thất bại *</label>
                      <select
                        value={editFailureReason}
                        disabled={isReadOnly}
                        onChange={(e) => setEditFailureReason(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-gold-400 font-semibold text-slate-600 disabled:opacity-75 disabled:bg-slate-100/50"
                      >
                        <option value="">-- Chọn nguyên nhân chính --</option>
                        {failureCodes.map(c => (
                          <option key={c.code} value={c.code}>{c.code} - {c.desc}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Negotiation Notes */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nhật ký đàm phán (Notes)</label>
                  <textarea 
                    value={editNotes}
                    disabled={isReadOnly}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={2}
                    placeholder="Ghi nhận phản hồi mới nhất của khách ở đây..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-gold-400 font-medium text-slate-800 disabled:opacity-75 disabled:bg-slate-100/50"
                  />
                </div>

                {/* Support Request */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nhờ hỗ trợ từ Quản lý (nếu cần thêm tư vấn)</label>
                  <textarea 
                    value={editSupport}
                    disabled={isReadOnly}
                    onChange={(e) => setEditSupport(e.target.value)}
                    rows={1}
                    placeholder="Ví dụ: Nhờ Quản lý tư vấn thêm về giá hoặc ưu đãi cho khách..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-gold-400 font-medium text-slate-800 disabled:opacity-75 disabled:bg-slate-100/50"
                  />
                </div>

                {/* Update Submit */}
                    {!isReadOnly && (
                      <div className="pt-2 border-t border-slate-100 flex justify-end">
                        <button
                          type="button"
                          onClick={handleUpdateLead}
                          className="px-6 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                        >
                          Lưu thay đổi hồ sơ
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* RIGHT SIDE: Admin Feedback Timeline (2/5 Columns) */}
              <div className="md:col-span-2 flex flex-col bg-slate-50 border border-slate-200/50 rounded-2xl p-4 min-h-[350px] max-h-[600px] overflow-hidden shadow-3xs">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center gap-1.5 select-none shrink-0">
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                  Ghi chú & Phản hồi từ Quản lý
                </h4>

                {/* Comments Scrollable Area */}
                <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1 scrollbar-thin">
                  {selectedLead.admin_feedbacks.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 select-none">
                      <MessageSquare className="w-8 h-8 text-slate-300 mb-2" />
                      <p className="text-[10px] text-slate-400 font-semibold italic">Chưa có ghi chú phản hồi nào từ Quản lý trên hồ sơ này.</p>
                    </div>
                  ) : (
                    selectedLead.admin_feedbacks.map(fb => (
                      <div 
                        key={fb.id}
                        className="bg-white border border-slate-200/60 rounded-xl p-3 space-y-1 shadow-3xs animate-fade-in"
                      >
                        <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 select-none">
                          <span className="text-blue-600 font-extrabold">{fb.user_name}</span>
                          <span className="font-mono">{fb.created_at.substring(5, 16).replace('T', ' ')}</span>
                        </div>
                        <p className="text-[11px] font-medium text-slate-700 leading-relaxed">
                          {fb.content}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Admin Feedback Box (Visible to Admins/Managers only) */}
                {isAdmin ? (
                  <form onSubmit={handleSendFeedback} className="mt-3 pt-3 border-t border-slate-200 shrink-0 space-y-2">
                    <div className="relative">
                      <textarea
                        required
                        rows={2}
                        placeholder="Nhập phản hồi hoặc hướng dẫn cho Sale..."
                        value={feedbackContent}
                        onChange={(e) => setFeedbackContent(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-3.5 pr-10 text-xs focus:outline-none focus:border-blue-400 font-medium text-slate-800"
                      />
                      <button
                        type="submit"
                        disabled={submittingFeedback}
                        className="absolute right-2.5 bottom-2.5 p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="mt-3 pt-3 border-t border-slate-200 shrink-0 text-center select-none">
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                      🔒 Chỉ Quản lý mới có thể gửi phản hồi
                    </p>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
