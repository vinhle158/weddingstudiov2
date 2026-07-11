import React, { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import { 
  Target, 
  Plus, 
  Users, 
  CheckCircle, 
  Clock, 
  Edit3, 
  Award, 
  FileText, 
  CheckSquare, 
  FileCheck2, 
  User, 
  Calendar, 
  ChevronRight, 
  ChevronLeft,
  MessageSquare, 
  X,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  TrendingUp,
  Sliders,
  Sparkles,
  GitBranch,
  Network,
  ChevronDown,
  ChevronUp,
  Check,
  Eye,
  List,
  Flame,
  Send,
  Activity,
  PieChart,
  History
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  AreaChart, 
  Area 
} from 'recharts';

interface ObjectivesProps {
  userRole: string;
}

export default function Objectives({ userRole }: ObjectivesProps) {
  const [objectives, setObjectives] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection states
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Form Modals states
  const [isObjModalOpen, setIsObjModalOpen] = useState(false);
  const [isEditingObj, setIsEditingObj] = useState(false);
  const [objFormId, setObjFormId] = useState('');
  const [objFormTitle, setObjFormTitle] = useState('');
  const [objFormDesc, setObjFormDesc] = useState('');
  const [objFormStatus, setObjFormStatus] = useState<'active' | 'completed' | 'cancelled'>('active');

  const [isKrModalOpen, setIsKrModalOpen] = useState(false);
  const [krFormTitle, setKrFormTitle] = useState('');
  const [krFormDept, setKrFormDept] = useState('Marketing/Quảng cáo');
  const [krFormUserId, setKrFormUserId] = useState('');
  const [krFormNotes, setKrFormNotes] = useState('');

  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [selectedKr, setSelectedKr] = useState<any>(null);
  const [progressValue, setProgressValue] = useState(0);
  const [progressComment, setProgressComment] = useState('');
  const [progressHistory, setProgressHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Form errors
  const [formError, setFormError] = useState<string | null>(null);

  // Active Report Data for selected Objective (used for staff charts and history tracking)
  const [activeReportData, setActiveReportData] = useState<any>(null);
  const [activeReportLoading, setActiveReportLoading] = useState(false);

  // Pushing / Urging staff states
  const [pushingKrId, setPushingKrId] = useState<string | null>(null);
  const [pushActionType, setPushActionType] = useState<'urge' | 'request_update' | null>(null);
  const [pushComment, setPushComment] = useState('');
  const [pushSuccessMsg, setPushSuccessMsg] = useState<string | null>(null);
  const [pushLoading, setPushLoading] = useState(false);

  // View modes: 'list' (original tabular/list view), 'fishbone' (Ishikawa diagrams), 'mindmap' (visual mindmaps tree)
  const [viewMode, setViewMode] = useState<'list' | 'fishbone' | 'mindmap'>('list');
  const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>({});

  // Time filter states: 'all' (all objectives), 'week' (by week), 'month' (by month), 'year' (by year)
  const [timeFilter, setTimeFilter] = useState<'all' | 'week' | 'month' | 'year'>('all');
  const [currentDatePivot, setCurrentDatePivot] = useState<Date>(new Date());

  const isManagerOrAdmin = userRole === 'admin' || userRole === 'manager';

  const departments = [
    'Marketing/Quảng cáo',
    'Tư vấn & CSKH',
    'Nhiếp ảnh & Studio',
    'Hậu kỳ & Thiết kế',
    'Vận hành & Kho',
    'Quản lý chung'
  ];

  const fetchObjectives = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest('/api/objectives');
      setObjectives(data);
      if (data.length > 0 && !selectedObjectiveId) {
        setSelectedObjectiveId(data[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách mục tiêu.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await apiRequest('/api/users');
      setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  };

  useEffect(() => {
    fetchObjectives();
    fetchUsers();
  }, []);

  const handleOpenCreateObj = () => {
    setIsEditingObj(false);
    setObjFormTitle('');
    setObjFormDesc('');
    setObjFormStatus('active');
    setFormError(null);
    setIsObjModalOpen(true);
  };

  const handleOpenEditObj = (obj: any) => {
    setIsEditingObj(true);
    setObjFormId(obj.id);
    setObjFormTitle(obj.title);
    setObjFormDesc(obj.description || '');
    setObjFormStatus(obj.status);
    setFormError(null);
    setIsObjModalOpen(true);
  };

  const handleSaveObjective = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!objFormTitle.trim()) {
      setFormError('Vui lòng nhập tiêu đề mục tiêu');
      return;
    }

    try {
      if (isEditingObj) {
        await apiRequest(`/api/objectives/${objFormId}`, 'PUT', {
          title: objFormTitle,
          description: objFormDesc,
          status: objFormStatus
        });
      } else {
        const newObj = await apiRequest('/api/objectives', 'POST', {
          title: objFormTitle,
          description: objFormDesc
        });
        setSelectedObjectiveId(newObj.id);
      }
      setIsObjModalOpen(false);
      fetchObjectives();
    } catch (err: any) {
      setFormError(err.message || 'Có lỗi xảy ra khi lưu mục tiêu.');
    }
  };

  const handleOpenCreateKr = () => {
    setKrFormTitle('');
    setKrFormDept('Marketing/Quảng cáo');
    setKrFormUserId('');
    setKrFormNotes('');
    setFormError(null);
    setIsKrModalOpen(true);
  };

  const handleSaveKeyResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!krFormTitle.trim()) {
      setFormError('Vui lòng nhập tên đầu việc nhỏ');
      return;
    }

    try {
      await apiRequest(`/api/objectives/${selectedObjectiveId}/key-results`, 'POST', {
        title: krFormTitle,
        assigned_department: krFormDept,
        assigned_to_user_id: krFormUserId || null,
        notes: krFormNotes
      });
      setIsKrModalOpen(false);
      fetchObjectives();
    } catch (err: any) {
      setFormError(err.message || 'Có lỗi xảy ra khi thêm đầu việc.');
    }
  };

  const handleOpenProgressUpdate = async (kr: any) => {
    setSelectedKr(kr);
    setProgressValue(kr.progress);
    setProgressComment('');
    setFormError(null);
    setIsProgressModalOpen(true);
    
    // Fetch progress updates history
    try {
      setHistoryLoading(true);
      const updates = await apiRequest(`/api/key-results/${kr.id}/updates`);
      setProgressHistory(updates);
    } catch (err) {
      console.error('Failed to load progress history', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSaveProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest(`/api/key-results/${selectedKr.id}/progress`, 'POST', {
        progress: Number(progressValue),
        comment: progressComment
      });
      setIsProgressModalOpen(false);
      fetchObjectives();
    } catch (err: any) {
      setFormError(err.message || 'Có lỗi xảy ra khi cập nhật tiến độ.');
    }
  };

  // Auto-fetch report data for active objective
  useEffect(() => {
    if (selectedObjectiveId) {
      const fetchActiveReport = async () => {
        try {
          setActiveReportLoading(true);
          const data = await apiRequest(`/api/objectives/${selectedObjectiveId}/report`);
          setActiveReportData(data);
        } catch (err) {
          console.error('Failed to load active report', err);
        } finally {
          setActiveReportLoading(false);
        }
      };
      fetchActiveReport();
    } else {
      setActiveReportData(null);
    }
  }, [selectedObjectiveId, objectives]);

  const handleSendPush = async (krId: string, actionType: 'urge' | 'request_update', customComment?: string) => {
    try {
      setPushLoading(true);
      await apiRequest(`/api/key-results/${krId}/push`, 'POST', {
        action_type: actionType,
        comment: customComment || null
      });
      setPushSuccessMsg(actionType === 'request_update' ? 'Đã gửi yêu cầu báo cáo tiến độ!' : 'Đã gửi đôn đốc thúc đẩy công việc!');
      setTimeout(() => setPushSuccessMsg(null), 3000);
      
      // Refresh objectives list
      fetchObjectives();
    } catch (err: any) {
      alert(err.message || 'Lỗi gửi yêu cầu đôn đốc');
    } finally {
      setPushLoading(false);
      setPushingKrId(null);
      setPushActionType(null);
      setPushComment('');
    }
  };

  const handleViewReport = async (objId: string) => {
    setSelectedReportId(objId);
    setReportLoading(true);
    try {
      const data = await apiRequest(`/api/objectives/${objId}/report`);
      setReportData(data);
    } catch (err) {
      console.error('Failed to load report data', err);
    } finally {
      setReportLoading(false);
    }
  };

  // Helper to calculate ranges for time filtering
  const getWeekRange = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday to start on Monday
    const start = new Date(d.setDate(diff));
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  const getMonthRange = (date: Date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  const getYearRange = (date: Date) => {
    const start = new Date(date.getFullYear(), 0, 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date.getFullYear(), 11, 31);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  // Filtered objectives list based on timeFilter & currentDatePivot
  const getFilteredObjectives = () => {
    return objectives.filter((obj) => {
      if (timeFilter === 'all') return true;
      const objDate = new Date(obj.created_at);
      if (timeFilter === 'week') {
        const { start, end } = getWeekRange(currentDatePivot);
        return objDate >= start && objDate <= end;
      }
      if (timeFilter === 'month') {
        const { start, end } = getMonthRange(currentDatePivot);
        return objDate >= start && objDate <= end;
      }
      if (timeFilter === 'year') {
        const { start, end } = getYearRange(currentDatePivot);
        return objDate >= start && objDate <= end;
      }
      return true;
    });
  };

  const filteredObjectives = getFilteredObjectives();
  const selectedObjective = filteredObjectives.find(o => o.id === selectedObjectiveId) || filteredObjectives[0];

  // Group key results by department for fishbone & mindmap views
  const getTasksByDept = (obj: any) => {
    const krs = obj?.key_results || [];
    const map: Record<string, any[]> = {};
    krs.forEach((kr: any) => {
      const dept = kr.assigned_department || 'Quản lý chung';
      if (!map[dept]) map[dept] = [];
      map[dept].push(kr);
    });
    return map;
  };

  // Status mapping UI
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gold-50 text-gold-800 border border-gold-200">Đang thực hiện</span>;
      case 'completed':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Đã hoàn thành</span>;
      case 'cancelled':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-500 border border-gray-200">Đã hủy</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <Target className="w-5 h-5 text-gold-600 mr-2 shrink-0" />
            Hệ thống Mục tiêu & Tiến độ vận hành
          </h2>
          <p className="text-gray-500 text-xs mt-1">
            Thiết lập các mục tiêu lớn, phân rã thành đầu việc nhỏ giao cho các bộ phận và theo dõi báo cáo hoàn thành chi tiết.
          </p>
        </div>
        {isManagerOrAdmin && (
          <button 
            onClick={handleOpenCreateObj}
            className="bg-gold-600 hover:bg-gold-700 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center shadow-xs hover:shadow-sm transition-all shrink-0"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Tạo mục tiêu lớn
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gold-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 text-sm font-medium">{error}</p>
          <button 
            onClick={fetchObjectives}
            className="mt-3 bg-white border border-red-200 hover:bg-red-50 text-red-700 px-4 py-1.5 rounded-xl text-xs font-bold transition-all"
          >
            Thử lại
          </button>
        </div>
      ) : objectives.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <Target className="w-16 h-16 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-800">Chưa có mục tiêu nào được tạo</h3>
          <p className="text-gray-500 text-xs mt-1 max-w-sm mx-auto">
            Hệ thống mục tiêu giúp quản trị viên định hướng công việc và giao phó trách nhiệm cụ thể đến từng phòng ban.
          </p>
          {isManagerOrAdmin && (
            <button 
              onClick={handleOpenCreateObj}
              className="mt-4 bg-gold-600 hover:bg-gold-700 text-white font-bold py-2 px-5 rounded-xl text-xs transition-all shadow-xs"
            >
              Tạo mục tiêu đầu tiên
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">

          {/* TIME FILTER & NAVIGATION PANEL */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-3xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-gold-600" />
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Hiển thị theo mốc thời gian</span>
              </div>
              
              {/* Segments for All, Week, Month, Year */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0">
                <button
                  type="button"
                  onClick={() => setTimeFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    timeFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTimeFilter('week');
                    setCurrentDatePivot(new Date());
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    timeFilter === 'week'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Theo Tuần
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTimeFilter('month');
                    setCurrentDatePivot(new Date());
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    timeFilter === 'month'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Theo Tháng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTimeFilter('year');
                    setCurrentDatePivot(new Date());
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    timeFilter === 'year'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Theo Năm
                </button>
              </div>
            </div>

            {/* Pivot Date Navigation Controls */}
            {timeFilter !== 'all' && (
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200/50 animate-fade-in">
                <button
                  type="button"
                  onClick={() => {
                    const newPivot = new Date(currentDatePivot);
                    if (timeFilter === 'week') newPivot.setDate(newPivot.getDate() - 7);
                    if (timeFilter === 'month') newPivot.setMonth(newPivot.getMonth() - 1);
                    if (timeFilter === 'year') newPivot.setFullYear(newPivot.getFullYear() - 1);
                    setCurrentDatePivot(newPivot);
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-200 border border-slate-200 bg-white transition-colors flex items-center justify-center"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>

                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-800">
                    {timeFilter === 'week' && (() => {
                      const { start, end } = getWeekRange(currentDatePivot);
                      return `Tuần: ${start.toLocaleDateString('vi-VN')} - ${end.toLocaleDateString('vi-VN')}`;
                    })()}
                    {timeFilter === 'month' && `Tháng ${currentDatePivot.getMonth() + 1} / ${currentDatePivot.getFullYear()}`}
                    {timeFilter === 'year' && `Năm ${currentDatePivot.getFullYear()}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentDatePivot(new Date())}
                    className="text-[10px] bg-gold-50 hover:bg-gold-100 text-gold-700 font-bold px-2 py-1 rounded-md border border-gold-200 transition-colors"
                  >
                    Hiện tại
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const newPivot = new Date(currentDatePivot);
                    if (timeFilter === 'week') newPivot.setDate(newPivot.getDate() + 7);
                    if (timeFilter === 'month') newPivot.setMonth(newPivot.getMonth() + 1);
                    if (timeFilter === 'year') newPivot.setFullYear(newPivot.getFullYear() + 1);
                    setCurrentDatePivot(newPivot);
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-200 border border-slate-200 bg-white transition-colors flex items-center justify-center"
                >
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            )}
          </div>
          
          {/* VIEW SWITCHER & QUICK SELECTOR BAR */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/60 shadow-2xs">
            {/* Tab buttons */}
            <div className="flex items-center space-x-1.5 bg-slate-100 p-1.5 rounded-xl shrink-0 self-start md:self-auto">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center transition-all ${
                  viewMode === 'list' 
                    ? 'bg-white text-slate-900 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <List className="w-3.5 h-3.5 mr-1.5" />
                Danh sách chi tiết
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('fishbone');
                  if (!selectedObjectiveId && filteredObjectives.length > 0) {
                    setSelectedObjectiveId(filteredObjectives[0].id);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center transition-all ${
                  viewMode === 'fishbone' 
                    ? 'bg-white text-slate-900 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5 mr-1.5 rotate-90" />
                Sơ đồ Xương cá (Ishikawa)
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('mindmap');
                  if (!selectedObjectiveId && filteredObjectives.length > 0) {
                    setSelectedObjectiveId(filteredObjectives[0].id);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center transition-all ${
                  viewMode === 'mindmap' 
                    ? 'bg-white text-slate-900 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Network className="w-3.5 h-3.5 mr-1.5" />
                Sơ đồ Tư duy (Mindmap)
              </button>
            </div>

            {/* Objective Quick Selector for Diagram Views */}
            {viewMode !== 'list' && (
              <div className="flex items-center space-x-2 w-full md:w-auto">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 hidden sm:inline">Mục tiêu:</span>
                <select
                  value={selectedObjectiveId || ''}
                  onChange={(e) => {
                    setSelectedObjectiveId(e.target.value);
                    setSelectedReportId(null);
                  }}
                  className="w-full md:w-[350px] bg-slate-50 border border-slate-200 hover:border-gold-400 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-gold-500 transition-colors"
                >
                  {filteredObjectives.map((o) => (
                    <option key={o.id} value={o.id}>
                      [{o.progress}%] {o.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* MAIN RENDER ENGINE */}
          {viewMode === 'list' ? (
            /* ================= VIEW 1: TRADITIONAL LIST GRID ================= */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* LEFT COLUMN: List of big objectives */}
              <div className="lg:col-span-5 space-y-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">Danh sách mục tiêu</h3>
                <div className="space-y-3">
                  {filteredObjectives.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-500 text-xs animate-fade-in">
                      Không có mục tiêu nào được thiết lập trong khoảng thời gian này.
                    </div>
                  ) : (
                    filteredObjectives.map((obj) => {
                      const isSelected = obj.id === selectedObjectiveId;
                      return (
                        <div 
                          key={obj.id}
                          onClick={() => {
                            setSelectedObjectiveId(obj.id);
                            setSelectedReportId(null);
                          }}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                            isSelected 
                              ? 'bg-white border-gold-400 shadow-md ring-2 ring-gold-500/10' 
                              : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-xs'
                          }`}
                        >
                          {/* Completion Ribbon Glow */}
                          {obj.status === 'completed' && (
                          <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500"></div>
                        )}
                        
                        <div>
                          <div className="flex justify-between items-start gap-2 mb-2">
                            {getStatusBadge(obj.status)}
                            <span className="text-[10px] font-mono text-gray-400">
                              {new Date(obj.created_at).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                          
                          <h4 className="font-bold text-gray-900 text-sm line-clamp-2 hover:text-gold-600">
                            {obj.title}
                          </h4>
                          
                          {obj.description && (
                            <p className="text-gray-500 text-xs mt-1.5 line-clamp-2">
                              {obj.description}
                            </p>
                          )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                          {/* Progress representation */}
                          <div className="flex-1 mr-4">
                            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                              <span>Tiến độ chung:</span>
                              <span className="font-bold text-gray-800">{obj.progress}%</span>
                            </div>
                            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-500 ${
                                  obj.status === 'completed' 
                                    ? 'bg-emerald-500' 
                                    : obj.progress >= 75 
                                      ? 'bg-gold-500' 
                                      : obj.progress >= 30 
                                        ? 'bg-amber-500' 
                                        : 'bg-rose-500'
                                }`}
                                style={{ width: `${obj.progress}%` }}
                              ></div>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center space-x-2">
                            <span className="text-[10px] bg-slate-50 text-slate-600 py-1 px-2 rounded-md font-semibold border border-slate-200/50">
                              {obj.key_results?.length || 0} việc nhỏ
                            </span>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          </div>
                        </div>
                      </div>
                    );
                  })
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: Selected objective details or Report */}
              <div className="lg:col-span-7">
                {selectedReportId && reportData ? (
                  /* REPORT DETAIL VIEW */
                  <div className="bg-white rounded-2xl border border-gold-300 shadow-md overflow-hidden relative animate-fade-in">
                    {/* Gold Top Border & Ribbon */}
                    <div className="bg-[#1e293b] text-white p-6 relative">
                      <div className="absolute top-4 right-4 bg-emerald-500 text-white font-bold text-[10px] px-3 py-1 rounded-full flex items-center uppercase tracking-wider shadow-sm animate-pulse">
                        <Award className="w-3.5 h-3.5 mr-1" /> Đã nghiệm thu
                      </div>
                      
                      <span className="text-[10px] text-gold-400 font-extrabold uppercase tracking-widest block mb-1">Báo cáo hoàn thành mục tiêu</span>
                      <h3 className="text-lg font-bold font-display text-white pr-20">{reportData.objective.title}</h3>
                      <p className="text-slate-400 text-xs mt-2 italic">
                        {reportData.objective.description || 'Không có mô tả chi tiết.'}
                      </p>
                    </div>

                    <div className="p-6 space-y-6">
                      {/* Summary grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl text-center">
                          <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Thời gian triển khai</span>
                          <strong className="text-gray-800 text-xs block">
                            {new Date(reportData.objective.created_at).toLocaleDateString('vi-VN')}
                          </strong>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl text-center">
                          <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Ngày nghiệm thu</span>
                          <strong className="text-emerald-700 text-xs block">
                            {reportData.objective.completed_at ? new Date(reportData.objective.completed_at).toLocaleDateString('vi-VN') : 'Vừa xong'}
                          </strong>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl text-center">
                          <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Nhân sự tham gia đóng góp</span>
                          <strong className="text-gray-800 text-xs block">
                            {reportData.involved_users?.length || 0} nhân sự
                          </strong>
                        </div>
                      </div>

                      {/* Team Members */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center">
                          <Users className="w-3.5 h-3.5 mr-1.5 text-slate-500" /> Nhân sự thực hiện mục tiêu này:
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {reportData.involved_users.map((u: any) => (
                            <span key={u.id} className="inline-flex items-center bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-lg font-medium border border-gray-200">
                              <User className="w-3 h-3 mr-1 text-gray-400" /> {u.full_name}
                            </span>
                          ))}
                          {reportData.involved_users.length === 0 && (
                            <p className="text-xs text-gray-400 italic">Chưa ghi nhận nhân sự tham gia trực tiếp.</p>
                          )}
                        </div>
                      </div>

                      {/* Key results outcome */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center">
                          <CheckSquare className="w-3.5 h-3.5 mr-1.5 text-slate-500" /> Kết quả của từng đầu việc nhỏ:
                        </h4>
                        <div className="space-y-2.5">
                          {reportData.key_results.map((kr: any) => (
                            <div key={kr.id} className="bg-white border border-gray-200 p-3.5 rounded-xl flex items-center justify-between">
                              <div className="min-w-0 flex-1 pr-3">
                                <p className="font-semibold text-gray-900 text-xs flex items-center">
                                  <CheckCircle className="w-4 h-4 text-emerald-500 mr-2 shrink-0" />
                                  {kr.title}
                                </p>
                                <span className="text-[9px] uppercase tracking-wider font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md mt-1 inline-block">
                                  Bộ phận: {kr.assigned_department}
                                </span>
                              </div>
                              <div className="shrink-0 text-right">
                                <span className="text-xs font-bold text-emerald-600">Đã xong (100%)</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Updates logs Timeline */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center">
                          <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-500" /> Nhật ký cập nhật tiến độ (Timeline):
                        </h4>
                        <div className="relative pl-4 border-l border-slate-200 space-y-4">
                          {reportData.timeline.map((up: any) => (
                            <div key={up.id} className="relative">
                              {/* Dot */}
                              <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-400 border-2 border-white ring-4 ring-slate-100"></div>
                              
                              <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-200/50 text-xs">
                                <div className="flex justify-between items-center text-[10px] text-gray-400 mb-1">
                                  <strong className="text-gray-700 font-semibold">{up.updated_by_name}</strong>
                                  <span>{new Date(up.created_at).toLocaleString('vi-VN')}</span>
                                </div>
                                <p className="text-gray-900 font-medium">
                                  Cập nhật đầu việc "<span className="text-gold-600">{up.key_result_title}</span>": 
                                  Tiến độ tăng lên <strong className="text-gray-950 font-bold">{up.progress_to}%</strong>
                                </p>
                                {up.comment && (
                                  <p className="text-gray-500 mt-1 pl-2 border-l border-slate-300 italic">
                                    "{up.comment}"
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                          {reportData.timeline.length === 0 && (
                            <p className="text-xs text-gray-400 italic">Không có nhật ký tiến độ ghi nhận.</p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end pt-2 border-t border-gray-100">
                        <button 
                          type="button"
                          onClick={() => setSelectedReportId(null)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2 px-4 rounded-xl text-xs transition-all"
                        >
                          Đóng báo cáo
                        </button>
                      </div>
                    </div>
                  </div>
                ) : selectedObjective ? (
                  /* DETAILED OBJECTIVE VIEW */
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden space-y-6 p-6 animate-fade-in">
                    
                    {/* Title & Description block */}
                    <div className="pb-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                          {getStatusBadge(selectedObjective.status)}
                          <span className="text-[10px] bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full font-bold">
                            Người tạo: {selectedObjective.created_by_name}
                          </span>
                        </div>
                        <h3 className="text-base font-extrabold text-gray-950 tracking-tight leading-snug">
                          {selectedObjective.title}
                        </h3>
                        <p className="text-gray-500 text-xs whitespace-pre-line">
                          {selectedObjective.description || 'Không có mô tả bổ sung cho mục tiêu này.'}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="shrink-0 flex items-center space-x-2">
                        {selectedObjective.status === 'completed' && (
                          <button
                            type="button"
                            onClick={() => handleViewReport(selectedObjective.id)}
                            className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-extrabold text-xs px-3.5 py-2 rounded-xl flex items-center transition-all shadow-xs"
                          >
                            <FileText className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                            Xem báo cáo hoàn thành
                          </button>
                        )}
                        
                        {isManagerOrAdmin && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditObj(selectedObjective)}
                            className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs p-2 rounded-xl flex items-center transition-all"
                            title="Chỉnh sửa mục tiêu"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress Visualizer Banner */}
                    <div className="bg-gold-50/20 border border-gold-200/50 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-full bg-gold-500/10 border border-gold-200 flex items-center justify-center shrink-0">
                          <TrendingUp className="w-5 h-5 text-gold-600 animate-pulse" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 text-sm">Tiến độ tổng thể mục tiêu lớn</h4>
                          <p className="text-gray-500 text-[11px] mt-0.5">Tính trung bình cộng tiến trình từ tất cả {selectedObjective.key_results?.length || 0} đầu việc nhỏ.</p>
                        </div>
                      </div>
                      <div className="w-full sm:w-40 text-right">
                        <span className="font-extrabold text-2xl text-slate-900">{selectedObjective.progress}%</span>
                        <div className="w-full bg-slate-200/60 h-2 rounded-full overflow-hidden mt-1.5">
                          <div className="h-full bg-gold-500" style={{ width: `${selectedObjective.progress}%` }}></div>
                        </div>
                      </div>
                    </div>

                    {/* Subtasks/Key Results section */}
                    <div className="space-y-3.5">
                      {pushSuccessMsg && (
                        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 p-3.5 rounded-xl text-xs flex items-center animate-fade-in shadow-2xs">
                          <CheckCircle className="w-4 h-4 mr-2 text-emerald-500 shrink-0" />
                          <strong>{pushSuccessMsg}</strong>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center">
                          <CheckSquare className="w-4 h-4 text-gold-500 mr-1.5" />
                          Chi tiết các đầu việc nhỏ ({selectedObjective.key_results?.length || 0})
                        </h4>
                        {isManagerOrAdmin && selectedObjective.status === 'active' && (
                          <button
                            type="button"
                            onClick={handleOpenCreateKr}
                            className="text-gold-600 hover:text-gold-700 font-bold text-xs flex items-center"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Giao việc nhỏ
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        {selectedObjective.key_results && selectedObjective.key_results.length > 0 ? (
                          selectedObjective.key_results.map((kr: any) => {
                            const assignedUser = users.find(u => u.id === kr.assigned_to_user_id);
                            return (
                              <div 
                                key={kr.id}
                                className="bg-[#f8fafc]/50 hover:bg-[#f8fafc] border border-slate-200 p-4 rounded-2xl transition-colors space-y-3.5"
                              >
                                <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2.5">
                                  <div className="space-y-1">
                                    <h5 className="font-bold text-gray-950 text-xs flex items-center">
                                      {kr.progress === 100 ? (
                                        <CheckCircle className="w-4 h-4 text-emerald-500 mr-1.5 shrink-0" />
                                      ) : (
                                        <Clock className="w-4 h-4 text-slate-400 mr-1.5 shrink-0" />
                                      )}
                                      {kr.title}
                                    </h5>
                                    
                                    {kr.notes && (
                                      <p className="text-gray-500 text-[11px] pl-5 italic">
                                        "{kr.notes}"
                                      </p>
                                    )}
                                  </div>

                                  <div className="shrink-0 flex items-center space-x-1.5 flex-wrap gap-y-1">
                                    <span className="text-[10px] uppercase font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg border border-slate-200/50">
                                      {kr.assigned_department}
                                    </span>
                                    {assignedUser && (
                                      <span className="text-[10px] font-semibold bg-gold-50/50 text-gold-800 px-2 py-0.5 rounded-lg border border-gold-200/30 flex items-center">
                                        <User className="w-3 h-3 mr-0.5" />
                                        {assignedUser.full_name}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Slider range and update action */}
                                <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3 rounded-xl border border-gray-100">
                                  <div className="flex-1 w-full">
                                    <div className="flex justify-between text-[10px] text-gray-400 mb-1 pl-1">
                                      <span>Tiến độ hoàn thành:</span>
                                      <strong className="text-gray-800 font-semibold">{kr.progress}%</strong>
                                    </div>
                                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full transition-all duration-300 ${
                                          kr.progress === 100 
                                            ? 'bg-emerald-500' 
                                            : 'bg-gold-500'
                                        }`}
                                        style={{ width: `${kr.progress}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                  
                                  {selectedObjective.status === 'active' && (
                                    <div className="w-full sm:w-auto flex flex-wrap items-center gap-1.5 shrink-0">
                                      {isManagerOrAdmin && assignedUser && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setPushingKrId(kr.id);
                                              setPushActionType('urge');
                                              setPushComment(`[Thúc giục tiến độ] Nhờ ${assignedUser.full_name} đẩy nhanh tiến độ hoàn thành đầu việc "${kr.title}" giúp anh/chị nhé.`);
                                            }}
                                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] uppercase tracking-wider py-1.5 px-2.5 rounded-lg flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
                                            title="Đôn đốc nhân sự hoàn thành công việc"
                                          >
                                            <Flame className="w-3 h-3 mr-1 animate-pulse text-amber-200" />
                                            Đôn đốc
                                          </button>
                                          
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setPushingKrId(kr.id);
                                              setPushActionType('request_update');
                                              setPushComment(`[Yêu cầu cập nhật] Nhờ ${assignedUser.full_name} cập nhật báo cáo tiến độ chi tiết cho đầu việc "${kr.title}" giúp anh/chị.`);
                                            }}
                                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] uppercase tracking-wider py-1.5 px-2.5 rounded-lg flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
                                            title="Yêu cầu nhân sự báo cáo cập nhật tiến độ công việc"
                                          >
                                            <Send className="w-3 h-3 mr-1 text-blue-200" />
                                            Yêu cầu báo cáo
                                          </button>
                                        </>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() => handleOpenProgressUpdate(kr)}
                                        className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase tracking-wider py-1.5 px-3 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                                      >
                                        <Sliders className="w-3 h-3 mr-1 text-slate-400" />
                                        Cập nhật
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-6 text-center text-gray-500 text-xs">
                            Chưa có đầu việc nhỏ nào được tạo dưới mục tiêu lớn này.
                            {isManagerOrAdmin && (
                              <button 
                                type="button"
                                onClick={handleOpenCreateKr}
                                className="text-gold-600 font-bold underline hover:text-gold-700 ml-1.5"
                              >
                                Tạo và giao việc ngay
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* STAFF PROGRESS & HISTORY CHART CARD */}
                    {activeReportLoading ? (
                      <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col items-center justify-center space-y-3 py-10">
                        <div className="w-6 h-6 border-2 border-gold-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-xs text-gray-400">Đang tải biểu đồ phân tích và lịch sử làm việc...</p>
                      </div>
                    ) : activeReportData ? (
                      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5 shadow-xs">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                          <div>
                            <h4 className="font-bold text-gray-950 text-sm flex items-center">
                              <Activity className="w-4 h-4 text-gold-600 mr-2" />
                              Biểu đồ quá trình & Lịch sử làm việc của nhân sự
                            </h4>
                            <p className="text-gray-400 text-[10px] mt-0.5">Giám sát hiệu suất công việc, tăng trưởng tiến độ và nhật ký cập nhật của từng nhân viên.</p>
                          </div>
                        </div>

                        {/* Chart and statistics row */}
                        {activeReportData.involved_users?.length === 0 ? (
                          <p className="text-xs text-gray-400 italic py-6 text-center bg-slate-50 rounded-xl">Chưa có dữ liệu đóng góp của nhân sự.</p>
                        ) : (
                          <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                              {/* Left: Employee Average Progress Bar Chart */}
                              <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-xl flex flex-col">
                                <h5 className="font-semibold text-gray-800 text-xs mb-3 flex items-center">
                                  <PieChart className="w-3.5 h-3.5 text-gold-600 mr-1.5" />
                                  Hiệu suất hoàn thành theo nhân sự (%)
                                </h5>
                                <div className="h-44 w-full text-[10px] select-none">
                                  {(() => {
                                    const employeeProgress = activeReportData.involved_users.map((u: any) => {
                                      const userKrs = (selectedObjective?.key_results || []).filter((k: any) => k.assigned_to_user_id === u.id);
                                      const avgProgress = userKrs.length > 0 
                                        ? Math.round(userKrs.reduce((sum: number, k: any) => sum + k.progress, 0) / userKrs.length)
                                        : 0;
                                      return {
                                        name: u.full_name,
                                        'Tiến độ (%)': avgProgress,
                                        'Số việc': userKrs.length
                                      };
                                    });

                                    return (
                                      <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={employeeProgress} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                          <XAxis dataKey="name" stroke="#64748b" tickLine={false} />
                                          <YAxis stroke="#64748b" domain={[0, 100]} tickLine={false} />
                                          <Tooltip 
                                            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px' }}
                                            formatter={(value) => [`${value}%`, 'Tiến độ trung bình']}
                                          />
                                          <Bar dataKey="Tiến độ (%)" fill="#d4af37" radius={[4, 4, 0, 0]} barSize={22} />
                                        </BarChart>
                                      </ResponsiveContainer>
                                    );
                                  })()}
                                </div>
                              </div>

                              {/* Right: Objective Progress Timeline Area Chart */}
                              <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-xl flex flex-col">
                                <h5 className="font-semibold text-gray-800 text-xs mb-3 flex items-center">
                                  <TrendingUp className="w-3.5 h-3.5 text-gold-600 mr-1.5" />
                                  Biểu đồ tăng trưởng tiến độ của mục tiêu
                                </h5>
                                <div className="h-44 w-full text-[10px] select-none">
                                  {(() => {
                                    const timelineUpdates = [...(activeReportData.timeline || [])]
                                      .reverse()
                                      .map((t: any) => ({
                                        time: new Date(t.created_at).toLocaleDateString('vi-VN', { month: 'numeric', day: 'numeric' }),
                                        'Tiến độ': t.progress_to,
                                        'Nhân viên': t.updated_by_name,
                                      }));

                                    // If no updates yet, add starting state (0%)
                                    if (timelineUpdates.length === 0) {
                                      timelineUpdates.push({ time: 'Bắt đầu', 'Tiến độ': 0, 'Nhân viên': 'Hệ thống' });
                                    }

                                    return (
                                      <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={timelineUpdates} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                          <defs>
                                            <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                                              <stop offset="5%" stopColor="#d4af37" stopOpacity={0.2}/>
                                              <stop offset="95%" stopColor="#d4af37" stopOpacity={0}/>
                                            </linearGradient>
                                          </defs>
                                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                          <XAxis dataKey="time" stroke="#64748b" tickLine={false} />
                                          <YAxis stroke="#64748b" domain={[0, 100]} tickLine={false} />
                                          <Tooltip 
                                            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px' }}
                                            formatter={(value) => [`${value}%`, 'Tiến độ']}
                                          />
                                          <Area type="monotone" dataKey="Tiến độ" stroke="#d4af37" strokeWidth={2} fillOpacity={1} fill="url(#colorProgress)" />
                                        </AreaChart>
                                      </ResponsiveContainer>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>

                            {/* Recent contributions details logs list */}
                            <div className="space-y-2.5">
                              <h5 className="font-semibold text-gray-800 text-xs flex items-center">
                                <History className="w-3.5 h-3.5 text-gold-600 mr-1.5" />
                                Nhật ký công việc và đóng góp chi tiết
                              </h5>
                              <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 overflow-hidden max-h-52 overflow-y-auto bg-white">
                                {activeReportData.timeline?.length === 0 ? (
                                  <p className="text-xs text-gray-400 italic p-4 text-center">Chưa có hoạt động cập nhật nào cho các đầu việc này.</p>
                                ) : (
                                  activeReportData.timeline.map((log: any) => (
                                    <div key={log.id} className="p-3 hover:bg-slate-50/50 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs text-gray-800">
                                          <strong className="text-slate-900 font-bold">{log.updated_by_name}</strong>
                                          <span className="text-gray-400"> cập nhật đầu việc </span>
                                          <span className="font-semibold text-gold-700">"{log.key_result_title}"</span>
                                        </p>
                                        {log.comment && (
                                          <p className="text-slate-500 text-[11px] mt-1 italic pl-2 border-l border-slate-200">
                                            "{log.comment}"
                                          </p>
                                        )}
                                      </div>
                                      <div className="shrink-0 flex items-center space-x-2.5 sm:text-right">
                                        <span className="text-[10px] bg-gold-50 text-gold-800 px-1.5 py-0.5 rounded-md font-bold font-mono">
                                          {log.progress_from}% → {log.progress_to}%
                                        </span>
                                        <span className="text-[9px] text-gray-400">
                                          {new Date(log.created_at).toLocaleDateString('vi-VN')} {new Date(log.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {/* Flow guide footer */}
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-start space-x-2.5">
                      <Sparkles className="w-4 h-4 text-gold-500 shrink-0 mt-0.5" />
                      <div className="text-[11px] text-gray-500 leading-relaxed">
                        <span className="font-bold text-gray-800">Quy trình làm việc:</span> Quản trị viên/Quản lý tạo mục tiêu lớn và giao việc nhỏ cho bộ phận hay từng nhân viên liên quan. Các nhân viên thực hiện và cập nhật tiến độ (%). Khi toàn bộ đầu việc con đạt 100%, mục tiêu lớn sẽ chuyển sang trạng thái <strong>Đã hoàn thành</strong> và tự động xuất <strong>Báo cáo nghiệm thu chi tiết</strong>.
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400 text-sm">
                    Vui lòng chọn mục tiêu bên trái để theo dõi chi tiết.
                  </div>
                )}
              </div>

            </div>
          ) : viewMode === 'fishbone' && selectedObjective ? (
            /* ================= VIEW 2: FISHBONE (ISHIKAWA) DIAGRAM ================= */
            <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm space-y-6 overflow-hidden animate-fade-in">
              
              {/* Diagram Header / Summary */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 border-b border-slate-100 gap-4">
                <div className="space-y-1">
                  <span className="inline-flex items-center space-x-1.5 text-[10px] font-extrabold uppercase tracking-widest text-gold-600">
                    <Sparkles className="w-3.5 h-3.5" /> Biểu đồ Xương cá hoạt động
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 font-display">
                    Sơ đồ Ishikawa phân tích và theo dõi mục tiêu
                  </h3>
                  <p className="text-gray-500 text-xs">
                    Trực quan hóa xương cá giúp dễ dàng giám sát từng phòng ban, phân bố khối lượng công việc nhỏ và kiểm soát rủi ro.
                  </p>
                </div>

                {isManagerOrAdmin && selectedObjective.status === 'active' && (
                  <button
                    type="button"
                    onClick={handleOpenCreateKr}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-3.5 rounded-xl text-xs flex items-center shadow-3xs transition-colors shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Giao việc nhỏ
                  </button>
                )}
              </div>

              {/* Fishbone Playground (Horizontal Scrollable Board) */}
              {(() => {
                const deptMap = getTasksByDept(selectedObjective);
                const activeDepts = Object.keys(deptMap);

                if (activeDepts.length === 0) {
                  return (
                    <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-16 text-center">
                      <GitBranch className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <h4 className="text-sm font-bold text-slate-700">Chưa có đầu việc con nào dưới mục tiêu này</h4>
                      <p className="text-slate-400 text-xs max-w-sm mx-auto mt-1">
                        Hãy giao ít nhất một đầu việc nhỏ kèm bộ phận phụ trách để thiết lập sơ đồ xương cá tự động.
                      </p>
                      {isManagerOrAdmin && (
                        <button
                          type="button"
                          onClick={handleOpenCreateKr}
                          className="mt-4 bg-gold-600 hover:bg-gold-700 text-white font-bold py-2 px-4 rounded-xl text-xs shadow-xs"
                        >
                          Tạo việc nhỏ ngay
                        </button>
                      )}
                    </div>
                  );
                }

                // Coordinate spacing and ribs setup
                const numDepts = activeDepts.length;
                const ribs = activeDepts.map((deptName, i) => {
                  const isUp = i % 2 === 0;
                  const xBase = numDepts <= 1 
                    ? 490 
                    : 180 + (i * (600 / (numDepts - 1)));
                  const xTip = xBase - 100;
                  const yTip = isUp ? 50 : 530;
                  
                  return { deptName, isUp, xBase, xTip, yTip };
                });

                // Generate branch points for tasks on each rib
                const fishboneBranches = ribs.flatMap((rib) => {
                  const tasks = deptMap[rib.deptName] || [];
                  const numTasks = tasks.length;
                  
                  return tasks.map((kr, j) => {
                    const t = numTasks <= 1 
                      ? 0.5 
                      : 0.22 + (j * (0.64 / (numTasks - 1)));
                      
                    const xBranch = rib.xBase - t * (rib.xBase - rib.xTip);
                    const yBranch = rib.isUp 
                      ? (290 - t * (290 - rib.yTip)) 
                      : (290 + t * (rib.yTip - 290));
                      
                    return {
                      kr,
                      rib,
                      xLineStart: xBranch,
                      yLineStart: yBranch,
                      xLineEnd: xBranch - 45,
                      yLineEnd: yBranch
                    };
                  });
                });

                return (
                  <div className="overflow-x-auto pb-4 pt-2">
                    <div className="relative w-[1120px] h-[580px] mx-auto bg-slate-50/50 border border-slate-200/50 rounded-3xl shadow-inner select-none overflow-hidden">
                      
                      {/* Canvas Grid Watermark */}
                      <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-60"></div>

                      {/* SVG CONNECTOR LINES */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                        {/* Fish Tail fin */}
                        <path 
                          d="M 80 290 L 25 210 L 42 290 L 25 370 Z" 
                          fill="#f1f5f9" 
                          stroke="#cbd5e1" 
                          strokeWidth="3" 
                          strokeLinejoin="round"
                        />
                        <path 
                          d="M 80 290 L 45 250 M 80 290 L 52 290 M 80 290 L 45 330" 
                          stroke="#94a3b8" 
                          strokeWidth="1.5" 
                        />

                        {/* Gold Spine (Central axis) */}
                        <line 
                          x1={80} 
                          y1={290} 
                          x2={900} 
                          y2={290} 
                          stroke="#d4af37" 
                          strokeWidth="6" 
                          strokeLinecap="round" 
                          className="drop-shadow-[0_2px_4px_rgba(212,175,55,0.3)]"
                        />

                        {/* Rib lines (Angled bones) */}
                        {ribs.map((rib, idx) => (
                          <line
                            key={`rib-${idx}`}
                            x1={rib.xBase}
                            y1={290}
                            x2={rib.xTip}
                            y2={rib.yTip}
                            stroke={rib.isUp ? "#e2e8f0" : "#cbd5e1"}
                            strokeWidth="3.5"
                            strokeLinecap="round"
                          />
                        ))}

                        {/* Task branch lines (Horizontal dash bones) */}
                        {fishboneBranches.map((br, idx) => (
                          <line
                            key={`branch-line-${idx}`}
                            x1={br.xLineStart}
                            y1={br.yLineStart}
                            x2={br.xLineEnd}
                            y2={br.yLineEnd}
                            stroke="#d1d5db"
                            strokeWidth="2"
                            strokeDasharray="3 3"
                          />
                        ))}
                      </svg>

                      {/* ABSOLUTE HTML OVERLAYS (CARDS & PILLS) */}
                      
                      {/* 1. Fish Head Card (The Target Objective) */}
                      <div 
                        className="absolute z-10 w-[205px] bg-[#1e293b] border-2 border-gold-400 rounded-r-[45px] rounded-l-2xl text-white shadow-md p-4 flex flex-col justify-between"
                        style={{ left: '900px', top: '290px', transform: 'translateY(-50%)', height: '145px' }}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center space-x-1.5">
                            <Target className="w-3.5 h-3.5 text-gold-400" />
                            <span className="text-[9px] uppercase tracking-wider font-extrabold text-gold-400">MỤC TIÊU LỚN</span>
                          </div>
                          <h4 className="font-extrabold text-[11px] leading-tight line-clamp-2 text-slate-100" title={selectedObjective.title}>
                            {selectedObjective.title}
                          </h4>
                        </div>
                        
                        <div className="space-y-1 border-t border-slate-700/60 pt-2.5 text-[10px]">
                          <div className="flex justify-between font-bold text-slate-300">
                            <span>Tiến độ tổng:</span>
                            <span className="text-gold-400 font-extrabold">{selectedObjective.progress}%</span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div className="h-full bg-gold-400" style={{ width: `${selectedObjective.progress}%` }}></div>
                          </div>
                        </div>
                      </div>

                      {/* 2. Department Pill Labels at the Tips */}
                      {ribs.map((rib, idx) => (
                        <div
                          key={`dept-pill-${idx}`}
                          className="absolute z-10 px-3.5 py-1.5 bg-slate-900 text-white border border-slate-700 rounded-full font-bold text-[9px] tracking-wider uppercase text-center shadow-sm select-none max-w-[145px] truncate"
                          style={{ 
                            left: `${rib.xTip}px`, 
                            top: `${rib.yTip}px`, 
                            transform: `translate(-50%, ${rib.isUp ? '-100%' : '0%'})` 
                          }}
                          title={rib.deptName}
                        >
                          {rib.deptName}
                        </div>
                      ))}

                      {/* 3. Task Cards overlay */}
                      {fishboneBranches.map((br, idx) => {
                        const assignedUser = users.find(u => u.id === br.kr.assigned_to_user_id);
                        const isCompleted = br.kr.progress === 100;
                        
                        return (
                          <div 
                            key={`task-card-${idx}`}
                            onClick={() => handleOpenProgressUpdate(br.kr)}
                            className={`absolute z-10 w-[190px] p-2.5 rounded-xl border text-left shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all cursor-pointer ${
                              isCompleted 
                                ? 'bg-emerald-50/95 border-emerald-300 text-emerald-950' 
                                : 'bg-white border-slate-200/95 hover:border-gold-400 text-slate-800'
                            }`}
                            style={{ 
                              left: `${br.xLineEnd}px`, 
                              top: `${br.yLineEnd}px`, 
                              transform: 'translate(-100%, -50%)' 
                            }}
                          >
                            <div className="space-y-1.5">
                              <h5 className="font-bold text-[10px] leading-tight line-clamp-2">
                                {br.kr.title}
                              </h5>
                              
                              <div className="flex justify-between items-center text-[9px] text-slate-400 font-medium">
                                <span className="truncate max-w-[110px] text-slate-500">
                                  {assignedUser ? assignedUser.full_name : 'Chưa giao'}
                                </span>
                                <span className={`font-extrabold ${isCompleted ? 'text-emerald-700' : 'text-gold-600'}`}>
                                  {br.kr.progress}%
                                </span>
                              </div>
                              
                              {/* Micro progress bar */}
                              <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${isCompleted ? 'bg-emerald-500' : 'bg-gold-500'}`} 
                                  style={{ width: `${br.kr.progress}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                    </div>
                  </div>
                );
              })()}

              {/* Instructions footer */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-start space-x-2.5">
                <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div className="text-[11px] text-slate-500">
                  <span className="font-bold text-slate-700">Cách thao tác:</span> Nhấp trực tiếp vào bất kỳ <strong className="text-slate-800">Khung công việc nào trên xương cá</strong> để mở cửa sổ cập nhật tiến độ, ghi chép nhật ký công việc và đẩy nhanh tiến trình hoạt động của phòng ban.
                </div>
              </div>

            </div>
          ) : viewMode === 'mindmap' && selectedObjective ? (
            /* ================= VIEW 3: MINDMAP TREE VIEW ================= */
            <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm space-y-6 overflow-hidden animate-fade-in">
              
              {/* Mindmap Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 border-b border-slate-100 gap-4">
                <div className="space-y-1">
                  <span className="inline-flex items-center space-x-1.5 text-[10px] font-extrabold uppercase tracking-widest text-gold-600">
                    <Network className="w-3.5 h-3.5" /> Sơ đồ Tư duy hoạt động (Mindmap)
                  </span>
	                  <h3 className="text-base font-extrabold text-slate-900 font-display">
	                    Sơ đồ mục tiêu và đầu việc
	                  </h3>
	                  <p className="text-gray-500 text-xs">
	                    Theo dõi mục tiêu theo từng bộ phận, người phụ trách và nhóm việc liên quan.
	                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      // Expand All Departments
                      setCollapsedDepts({});
                    }}
                    className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold py-1.5 px-3 rounded-lg text-[10px] border border-slate-200 transition-colors"
                  >
                    Mở rộng tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Collapse All Departments
                      const deptMap = getTasksByDept(selectedObjective);
                      const activeDepts = Object.keys(deptMap);
                      const collapsed: Record<string, boolean> = {};
                      activeDepts.forEach(d => {
                        collapsed[d] = true;
                      });
                      setCollapsedDepts(collapsed);
                    }}
                    className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold py-1.5 px-3 rounded-lg text-[10px] border border-slate-200 transition-colors"
                  >
                    Thu gọn tất cả
                  </button>
                </div>
              </div>

              {/* Mindmap Diagram Board Tree Node Structure */}
              {(() => {
                const deptMap = getTasksByDept(selectedObjective);
                const activeDepts = Object.keys(deptMap);

                if (activeDepts.length === 0) {
                  return (
                    <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-16 text-center">
                      <Network className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <h4 className="text-sm font-bold text-slate-700">Chưa có đầu việc con nào dưới mục tiêu này</h4>
                      <p className="text-slate-400 text-xs max-w-sm mx-auto mt-1">
                        Hãy giao ít nhất một đầu việc nhỏ kèm bộ phận phụ trách để thiết lập sơ đồ tư duy tự động.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="flex flex-col lg:flex-row items-stretch space-y-8 lg:space-y-0 lg:space-x-12 p-8 bg-slate-50/40 rounded-2xl border border-slate-200/60 overflow-x-auto min-h-[500px]">
                    
                    {/* Node 1: Target Objective (Root node, left side) */}
                    <div className="flex-shrink-0 flex items-center justify-center">
                      <div className="relative bg-[#1e293b] border-2 border-gold-400 text-white p-5 rounded-2xl shadow-md w-[260px] space-y-4">
                        <div className="space-y-1">
                          <span className="text-[9px] font-extrabold text-gold-400 uppercase tracking-wider block">Mục tiêu trung tâm</span>
                          <h4 className="font-bold text-xs text-slate-100 leading-snug">
                            {selectedObjective.title}
                          </h4>
                          {selectedObjective.description && (
                            <p className="text-slate-400 text-[10px] line-clamp-2 pt-1">
                              {selectedObjective.description}
                            </p>
                          )}
                        </div>
                        
                        <div className="space-y-1.5 border-t border-slate-700/60 pt-3.5 text-[10px]">
                          <div className="flex justify-between font-bold text-slate-300">
                            <span>Tiến trình hoàn thành:</span>
                            <span className="text-gold-400 font-extrabold">{selectedObjective.progress}%</span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div className="h-full bg-gold-400" style={{ width: `${selectedObjective.progress}%` }}></div>
                          </div>
                        </div>

                        {/* Anchor horizontal indicator */}
                        <div className="absolute right-[-14px] top-1/2 w-[14px] h-0.5 bg-gold-400 hidden lg:block"></div>
                      </div>
                    </div>

                    {/* Nodes 2 & 3: Branches (Center departments column and right tasks) */}
                    <div className="flex-1 flex flex-col space-y-6 w-full min-w-[650px] relative">
                      
                      {/* Vertical connector line on the left side of branches column */}
                      <div className="absolute left-[-24px] top-8 bottom-8 w-0.5 bg-slate-200 hidden lg:block"></div>

                      {activeDepts.map((dept) => {
                        const deptTasks = deptMap[dept] || [];
                        const isCollapsed = !!collapsedDepts[dept];
                        const completedTasks = deptTasks.filter(t => t.progress === 100).length;
                        
                        return (
                          <div key={dept} className="flex items-start space-x-8 relative">
                            {/* Horizontal connector line from central vertical axis to department card */}
                            <div className="absolute left-[-24px] top-6 w-[24px] h-0.5 bg-slate-200 hidden lg:block"></div>
                            
                            {/* Department Node Card */}
                            <div className={`flex-shrink-0 w-[210px] p-3.5 rounded-xl border transition-all ${
                              isCollapsed 
                                ? 'bg-slate-100 border-slate-200 text-slate-400' 
                                : 'bg-white border-gold-200 text-slate-800 shadow-3xs hover:border-gold-300'
                            }`}>
                              <div className="flex justify-between items-center">
                                <span className="font-extrabold text-[10px] uppercase tracking-wider block truncate max-w-[135px]" title={dept}>
                                  {dept}
                                </span>
                                <button 
                                  type="button"
                                  onClick={() => setCollapsedDepts(prev => ({ ...prev, [dept]: !prev[dept] }))}
                                  className="p-1 hover:bg-gold-50 text-gold-600 rounded-lg transition-colors border border-gold-200/30 shrink-0"
                                  title={isCollapsed ? "Mở rộng" : "Thu gọn"}
                                >
                                  {isCollapsed ? <Plus className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 text-slate-400" />}
                                </button>
                              </div>
                              <div className="flex justify-between items-center mt-2.5 text-[10px]">
                                <span className="text-gray-400 font-medium">Việc nhỏ: <strong className="text-slate-700 font-bold">{deptTasks.length}</strong></span>
                                <span className="text-emerald-600 font-bold">Đã xong: {completedTasks}/{deptTasks.length}</span>
                              </div>
                            </div>

                            {/* Column of Tasks branching from the Department */}
                            {!isCollapsed && (
                              <div className="flex-1 flex flex-col space-y-2.5 relative pl-5 border-l border-dashed border-slate-300">
                                {deptTasks.map((kr) => {
                                  const assignedUser = users.find(u => u.id === kr.assigned_to_user_id);
                                  const isKrCompleted = kr.progress === 100;
                                  return (
                                    <div 
                                      key={kr.id}
                                      onClick={() => handleOpenProgressUpdate(kr)}
                                      className={`group relative hover:bg-slate-50 border p-3 rounded-xl shadow-3xs transition-all cursor-pointer flex justify-between items-center space-x-3 text-xs ${
                                        isKrCompleted 
                                          ? 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-300' 
                                          : 'bg-white border-slate-200 hover:border-gold-400'
                                      }`}
                                    >
                                      {/* Horizontal dash connector line on task card */}
                                      <div className="absolute left-[-20px] top-1/2 w-[20px] h-px border-t border-dashed border-slate-300"></div>

                                      <div className="min-w-0 flex-1">
                                        <h5 className="font-bold text-slate-900 text-[11px] leading-snug line-clamp-2 group-hover:text-gold-600 transition-colors">
                                          {kr.title}
                                        </h5>
                                        <div className="flex items-center space-x-2 mt-1.5 text-[10px] text-gray-400">
                                          {assignedUser && (
                                            <span className="flex items-center font-semibold text-slate-600">
                                              <User className="w-3 h-3 mr-0.5 text-gray-400" /> {assignedUser.full_name}
                                            </span>
                                          )}
                                          {kr.notes && (
                                            <span className="truncate italic max-w-[130px] text-[9px]">"{kr.notes}"</span>
                                          )}
                                        </div>
                                      </div>
                                      
                                      <div className="shrink-0 text-right space-y-1">
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                                          isKrCompleted 
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                            : 'bg-gold-50 text-gold-700 border border-gold-200'
                                        }`}>
                                          {kr.progress}%
                                        </span>
                                        <div className="w-12 bg-slate-100 h-1 rounded-full overflow-hidden">
                                          <div className={`h-full ${isKrCompleted ? 'bg-emerald-500' : 'bg-gold-500'}`} style={{ width: `${kr.progress}%` }}></div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                          </div>
                        );
                      })}

                    </div>

                  </div>
                );
              })()}

              {/* Instructions footer */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-start space-x-2.5">
	                <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
	                <div className="text-[11px] text-slate-500">
	                  <span className="font-bold text-slate-700">Theo dõi nhanh:</span> Mỗi phòng ban hiển thị các đầu việc chính, trạng thái và tiến độ để quản lý dễ nắm điểm nghẽn.
	                </div>
              </div>

            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400 text-sm animate-fade-in">
              Không tìm thấy mục tiêu hoặc chưa chọn mục tiêu lớn nào.
            </div>
          )}
          
        </div>
      )}

      {/* ================= MODAL: CREATE/EDIT OBJECTIVE ================= */}
      {isObjModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-40 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-slide-up">
            <div className="bg-[#1e293b] p-4 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center">
                <Target className="w-4 h-4 text-gold-500 mr-1.5" />
                {isEditingObj ? 'Chỉnh sửa mục tiêu lớn' : 'Thiết lập mục tiêu lớn'}
              </h3>
              <button onClick={() => setIsObjModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveObjective} className="p-5 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-2.5 rounded-xl text-xs flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1.5 shrink-0" />
                  {formError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tiêu đề mục tiêu *</label>
                <input 
                  type="text"
                  value={objFormTitle}
                  onChange={(e) => setObjFormTitle(e.target.value)}
                  placeholder="Ví dụ: Đạt doanh thu 100 triệu trong tháng 2"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-gold-500 transition-colors"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Mô tả chi tiết mục tiêu</label>
                <textarea 
                  value={objFormDesc}
                  onChange={(e) => setObjFormDesc(e.target.value)}
                  placeholder="Nhập ghi chú, chỉ tiêu chi tiết hoặc mô tả chiến dịch..."
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-gold-500 transition-colors"
                />
              </div>

              {isEditingObj && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Trạng thái mục tiêu</label>
                  <select
                    value={objFormStatus}
                    onChange={(e: any) => setObjFormStatus(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-gold-500 transition-colors"
                  >
                    <option value="active">Đang thực hiện (Active)</option>
                    <option value="completed">Đã hoàn thành (Completed)</option>
                    <option value="cancelled">Đã hủy (Cancelled)</option>
                  </select>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-3 border-t border-gray-100">
                <button 
                  type="button"
                  onClick={() => setIsObjModalOpen(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-1.5 px-3.5 rounded-xl text-xs transition-colors"
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  className="bg-gold-600 hover:bg-gold-700 text-white font-bold py-1.5 px-4 rounded-xl text-xs shadow-xs hover:shadow-sm transition-all"
                >
                  {isEditingObj ? 'Cập nhật mục tiêu' : 'Tạo mục tiêu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD KEY RESULT (GIAO VIỆC NHỎ) ================= */}
      {isKrModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-40 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-slide-up">
            <div className="bg-[#1e293b] p-4 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center">
                <CheckSquare className="w-4 h-4 text-gold-500 mr-1.5" />
                Giao việc nhỏ dưới mục tiêu
              </h3>
              <button onClick={() => setIsKrModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveKeyResult} className="p-5 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-2.5 rounded-xl text-xs flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1.5 shrink-0" />
                  {formError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tên công việc / mục tiêu nhỏ *</label>
                <input 
                  type="text"
                  value={krFormTitle}
                  onChange={(e) => setKrFormTitle(e.target.value)}
                  placeholder="Ví dụ: Chạy quảng cáo Facebook & Google, tư vấn chốt lịch chụp"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-gold-500 transition-colors"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Bộ phận thực hiện *</label>
                  <select
                    value={krFormDept}
                    onChange={(e) => setKrFormDept(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-gold-500 transition-colors"
                  >
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nhân viên phụ trách (Tùy chọn)</label>
                  <select
                    value={krFormUserId}
                    onChange={(e) => setKrFormUserId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-gold-500 transition-colors"
                  >
                    <option value="">-- Chọn nhân viên --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Ghi chú, yêu cầu chi tiết</label>
                <textarea 
                  value={krFormNotes}
                  onChange={(e) => setKrFormNotes(e.target.value)}
                  placeholder="Ví dụ: Tối ưu chi phí CPA dưới 40k, đạt tối thiểu 10 đơn trong 2 tuần..."
                  rows={2}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-gold-500 transition-colors"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-gray-100">
                <button 
                  type="button"
                  onClick={() => setIsKrModalOpen(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-1.5 px-3.5 rounded-xl text-xs transition-colors"
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  className="bg-gold-600 hover:bg-gold-700 text-white font-bold py-1.5 px-4 rounded-xl text-xs shadow-xs hover:shadow-sm transition-all"
                >
                  Giao việc con
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: UPDATE PROGRESS & VIEW LOGS (STAFF + ADMIN) ================= */}
      {isProgressModalOpen && selectedKr && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-40 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
            <div className="bg-[#1e293b] p-4 text-white flex justify-between items-center shrink-0">
              <h3 className="font-bold text-sm flex items-center">
                <Sliders className="w-4 h-4 text-gold-500 mr-1.5" />
                Cập nhật tiến độ đầu việc
              </h3>
              <button onClick={() => setIsProgressModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Header Task description */}
              <div className="bg-[#f8fafc] border border-slate-200 p-4 rounded-xl">
                <span className="text-[9px] uppercase tracking-wider font-extrabold text-gold-600">ĐẦU VIỆC CẦN THỰC HIỆN</span>
                <h4 className="font-bold text-slate-900 text-xs mt-1">{selectedKr.title}</h4>
                <div className="flex items-center space-x-3 text-[10px] text-gray-400 mt-2">
                  <span>Bộ phận: <strong>{selectedKr.assigned_department}</strong></span>
                  {selectedKr.notes && <span>• {selectedKr.notes}</span>}
                </div>
              </div>

              {/* Progress Update Form */}
              <form onSubmit={handleSaveProgress} className="space-y-4">
                {formError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 p-2.5 rounded-xl text-xs flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1.5 shrink-0" />
                    {formError}
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tiến độ thực tế (%)</label>
                    <strong className="text-gold-700 text-sm font-extrabold">{progressValue}%</strong>
                  </div>
                  
                  {/* Visual slider */}
                  <div className="flex items-center space-x-4">
                    <input 
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={progressValue}
                      onChange={(e) => setProgressValue(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gold-600 focus:outline-none"
                    />
                    <div className="flex gap-1.5">
                      <button 
                        type="button"
                        onClick={() => setProgressValue(100)}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold py-1 px-2.5 rounded-lg border border-emerald-200 transition-colors"
                      >
                        Xong (100%)
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Báo cáo tình hình, lý do cập nhật *</label>
                  <textarea 
                    value={progressComment}
                    onChange={(e) => setProgressComment(e.target.value)}
                    placeholder="Mô tả công việc đã làm được hoặc lý do tăng/giảm tiến độ..."
                    rows={2.5}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-gold-500 transition-colors"
                    required
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <button 
                    type="button"
                    onClick={() => setIsProgressModalOpen(false)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-1.5 px-3.5 rounded-xl text-xs transition-colors"
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit"
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-1.5 px-4 rounded-xl text-xs shadow-xs transition-all"
                  >
                    Cập nhật tiến độ
                  </button>
                </div>
              </form>

              {/* History logs of updates */}
              <div className="pt-4 border-t border-gray-100">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center">
                  <MessageSquare className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                  Nhật ký cập nhật tiến trình
                </h4>

                {historyLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gold-600"></div>
                  </div>
                ) : progressHistory.length === 0 ? (
                  <p className="text-gray-400 text-xs italic text-center py-2">Chưa có cập nhật nào được ghi nhận cho đầu việc này.</p>
                ) : (
                  <div className="space-y-3.5 max-h-[180px] overflow-y-auto pr-1">
                    {progressHistory.map((up) => (
                      <div key={up.id} className="bg-slate-50 border border-slate-100 p-3 rounded-xl text-xs space-y-1">
                        <div className="flex justify-between items-center text-[10px] text-gray-400">
                          <span className="font-semibold text-gray-700">{up.updated_by_name}</span>
                          <span>{new Date(up.created_at).toLocaleString('vi-VN')}</span>
                        </div>
                        <p className="text-gray-800 font-medium">
                          Tiến độ: <span className="text-gray-500 line-through font-normal">{up.progress_from}%</span> <span className="font-bold text-gold-600">→ {up.progress_to}%</span>
                        </p>
                        {up.comment && (
                          <p className="text-gray-500 italic pl-1 border-l-2 border-gray-300 mt-0.5">
                            "{up.comment}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PUSH & URGE MODAL FORM (Manager/Admin Only) */}
      {pushingKrId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden border border-gray-100 animate-scale-in">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-base flex items-center">
                {pushActionType === 'request_update' ? (
                  <>
                    <Send className="w-4 h-4 text-blue-600 mr-2" />
                    Yêu cầu báo cáo tiến độ
                  </>
                ) : (
                  <>
                    <Flame className="w-4 h-4 text-amber-600 mr-2 animate-bounce" />
                    Đôn đốc thúc đẩy công việc
                  </>
                )}
              </h3>
              <button 
                onClick={() => {
                  setPushingKrId(null);
                  setPushActionType(null);
                  setPushComment('');
                }} 
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-500 leading-relaxed">
                {pushActionType === 'request_update' 
                  ? 'Gửi yêu cầu chính thức yêu cầu nhân viên phụ trách báo cáo và cập nhật tiến độ phần trăm hoàn thành cho đầu việc này.'
                  : 'Gửi thông báo hối thúc nhân sự tập trung làm và hoàn thành sớm đầu việc này.'}
              </p>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nội dung đôn đốc / Lời nhắn gửi tới nhân viên</label>
                <textarea 
                  rows={3}
                  value={pushComment}
                  onChange={(e) => setPushComment(e.target.value)}
                  placeholder="Nhập lời dặn dò cụ thể..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-xs focus:outline-none focus:border-gold-500 resize-none"
                  required
                />
              </div>

              <div className="flex space-x-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => {
                    setPushingKrId(null);
                    setPushActionType(null);
                    setPushComment('');
                  }}
                  className="w-1/2 border border-gray-200 hover:bg-gray-50 text-gray-700 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="button"
                  onClick={() => handleSendPush(pushingKrId, pushActionType!, pushComment)}
                  disabled={pushLoading}
                  className={`w-1/2 text-white py-2 rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center cursor-pointer ${
                    pushActionType === 'request_update' 
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {pushLoading ? 'Đang gửi...' : 'Gửi yêu cầu'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
