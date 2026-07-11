import React, { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import { 
  CheckSquare, 
  Clock, 
  AlertCircle, 
  User, 
  Plus, 
  X, 
  History, 
  MessageSquare, 
  ChevronRight, 
  Tag, 
  Briefcase,
  Play,
  CheckCircle,
  XCircle,
  FileText,
  RefreshCw,
  Search,
  Calendar,
  Facebook,
  Phone
} from 'lucide-react';

const parseContactFromDesc = (desc: string) => {
  if (!desc) return { phone: null, facebook: null };
  const phoneMatch = desc.match(/SĐT liên hệ: (.*?)(?:\n|$)/);
  const fbMatch = desc.match(/Link Facebook: (.*?)(?:\n|$)/);
  return {
    phone: phoneMatch ? phoneMatch[1].trim() : null,
    facebook: fbMatch && fbMatch[1].includes('http') ? fbMatch[1].trim() : null
  };
};

interface TasksProps {
  userRole: string;
  userId: string;
  onNavigate: (tab: string, arg?: any) => void;
  initialSelectedTaskId?: string;
  initialOpenCreateWithTemplate?: {
    title: string;
    description: string;
    orderId?: string;
  };
  isMobile?: boolean;
}

export default function Tasks({ 
  userRole, 
  userId, 
  onNavigate, 
  initialSelectedTaskId,
  initialOpenCreateWithTemplate,
  isMobile
}: TasksProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStaff, setFilterStaff] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Task details
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Form states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [staffUsers, setStaffUsers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  // Task creation state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskOrderId, setTaskOrderId] = useState('');
  const [taskAssignedTo, setTaskAssignedTo] = useState('');
  const [taskPriority, setTaskPriority] = useState('normal');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Searchable order linking state
  const [orderSearch, setOrderSearch] = useState('');
  const [isOrderDropdownOpen, setIsOrderDropdownOpen] = useState(false);

  // Add Comment/Update log state
  const [commentText, setCommentText] = useState('');
  const [commentStatusChange, setCommentStatusChange] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      let query = '';
      const params = [];
      if (filterStatus) params.push(`status=${filterStatus}`);
      if (filterPriority) params.push(`priority=${filterPriority}`);
      if (filterStaff) params.push(`assigned_to=${filterStaff}`);
      if (params.length > 0) query = '?' + params.join('&');

      const data = await apiRequest(`/api/tasks${query}`);
      setTasks(data);

      if (initialSelectedTaskId) {
        const found = data.find((t: any) => t.id === initialSelectedTaskId);
        if (found) {
          fetchTaskDetail(found.id);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách công việc');
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdowns = async () => {
    try {
      const [users, ords] = await Promise.all([
        apiRequest('/api/users'),
        apiRequest('/api/orders')
      ]);
      setStaffUsers(users.filter((u: any) => u.is_active));
      setOrders(ords);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchDropdowns();
  }, [filterStatus, filterPriority, filterStaff]);

  useEffect(() => {
    if (initialOpenCreateWithTemplate) {
      setTaskTitle(initialOpenCreateWithTemplate.title);
      setTaskDesc(initialOpenCreateWithTemplate.description || '');
      setTaskOrderId(initialOpenCreateWithTemplate.orderId || '');
      setTaskAssignedTo('');
      setTaskPriority('normal');
      // Set default due date to 7 days from now, or let user set it. In this case, we can leave it empty or pre-populate.
      setTaskDueDate('');
      setOrderSearch('');
      setIsCreateOpen(true);
    }
  }, [initialOpenCreateWithTemplate]);

  const fetchTaskDetail = async (taskId: string) => {
    try {
      setDetailLoading(true);
      const detail = await apiRequest(`/api/tasks/${taskId}`);
      setSelectedTask(detail);
      setCommentStatusChange(detail.status);
    } catch (err: any) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setCreateError(null);
    setTaskTitle('');
    setTaskDesc('');
    setTaskOrderId('');
    setTaskAssignedTo('');
    setTaskPriority('normal');
    setTaskDueDate('');
    setOrderSearch('');
    setIsOrderDropdownOpen(false);
    setIsCreateOpen(true);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!taskTitle || !taskAssignedTo) {
      setCreateError('Tiêu đề công việc và nhân viên chịu trách nhiệm là bắt buộc');
      return;
    }

    try {
      const created = await apiRequest('/api/tasks', 'POST', {
        title: taskTitle,
        description: taskDesc || null,
        order_id: taskOrderId || null,
        assigned_to: taskAssignedTo,
        priority: taskPriority,
        due_date: taskDueDate || null
      });

      setIsCreateOpen(false);
      fetchTasks();
      fetchTaskDetail(created.id);
    } catch (err: any) {
      setCreateError(err.message || 'Không thể tạo công việc');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    setCommentError(null);

    const isAssignee = selectedTask?.assigned_to === userId;
    const isManagerOrAdmin = userRole === 'admin' || userRole === 'manager';
    const isUrgeMode = selectedTask && isManagerOrAdmin && !isAssignee;

    if (!commentText) {
      setCommentError(isUrgeMode ? 'Vui lòng điền nội dung yêu cầu hoặc đôn đốc' : 'Vui lòng điền nội dung báo cáo tiến độ');
      return;
    }

    try {
      await apiRequest(`/api/tasks/${selectedTask.id}/updates`, 'POST', {
        comment: commentText,
        status_changed_to: isUrgeMode ? undefined : (commentStatusChange || undefined)
      });

      setCommentText('');
      fetchTaskDetail(selectedTask.id);
      fetchTasks(); // Refresh left sidebar list to update status pill
    } catch (err: any) {
      setCommentError(err.message || 'Lỗi lưu bình luận');
    }
  };

  const handleQuickStatusChange = async (targetStatus: string) => {
    try {
      await apiRequest(`/api/tasks/${selectedTask.id}/updates`, 'POST', {
        comment: `Đã thay đổi trạng thái công việc sang: ${targetStatus.toUpperCase()}`,
        status_changed_to: targetStatus
      });
      fetchTaskDetail(selectedTask.id);
      fetchTasks();
    } catch (err: any) {
      alert(err.message || 'Không thể đổi nhanh trạng thái');
    }
  };

  const isStaff = userRole === 'staff' || userRole === 'photographer' || userRole === 'editor';
  const canAssign = userRole === 'admin' || userRole === 'manager';

  const statusMap: Record<string, { label: string, color: string }> = {
    pending: { label: 'Chờ nhận việc', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    in_progress: { label: 'Đang làm', color: 'bg-gold-50 text-gold-800 border-gold-200/50' },
    done: { label: 'Đã hoàn thành', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    cancelled: { label: 'Đã hủy', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  };

  const priorityMap: Record<string, { label: string, color: string }> = {
    low: { label: 'Thấp', color: 'bg-gray-100 text-gray-600' },
    normal: { label: 'Thường', color: 'bg-gold-50/50 text-gold-800 font-medium' },
    high: { label: 'KHẨN CẤP', color: 'bg-red-50 text-red-700 font-bold animate-pulse' },
  };

  const filteredTasks = tasks.filter(task => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      task.title?.toLowerCase().includes(q) ||
      (task.description && task.description.toLowerCase().includes(q)) ||
      task.assigned_to_name?.toLowerCase().includes(q) ||
      (task.order_code && task.order_code.toLowerCase().includes(q)) ||
      (task.customer_name && task.customer_name.toLowerCase().includes(q))
    );
  });

  const isAssignee = selectedTask?.assigned_to === userId;
  const isManagerOrAdmin = userRole === 'admin' || userRole === 'manager';
  const isUrgeMode = selectedTask && isManagerOrAdmin && !isAssignee;

  return (
    <div className="space-y-6 animate-fade-in" id="tasks-section-container">
      {/* Top action & filter bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-gray-900 text-base md:text-lg flex items-center gap-2 leading-tight">
              <CheckSquare className="w-5 h-5 text-gold-600 shrink-0" />
              <span>{isMobile ? "Công việc của tôi" : "Phân công & Tiến độ Công việc (Dạng bảng)"}</span>
            </h3>
	            {!isMobile && (
	              <p className="text-xs text-slate-500 mt-1">
	                Theo dõi đầu việc bàn giao, người phụ trách, hạn xử lý và hợp đồng liên quan.
	              </p>
	            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input 
                type="text" 
                placeholder="Tìm tên việc, người làm, mã đơn..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-gold-500 transition-colors"
              />
            </div>

            {canAssign && (
              <button 
                onClick={handleOpenCreateModal}
                className="bg-gold-600 hover:bg-gold-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Giao việc mới
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
              <option value="">Tất cả</option>
              {Object.entries(statusMap).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">Độ ưu tiên:</span>
            <select 
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg py-1 px-2.5 text-xs text-slate-700 focus:outline-none focus:border-gold-500 cursor-pointer"
            >
              <option value="">Tất cả</option>
              {Object.entries(priorityMap).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          {!isStaff && (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-500">Nhân viên:</span>
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
          )}
        </div>
      </div>

      {/* Main Grid Table or Mobile Cards List */}
      {isMobile ? (
        <div className="space-y-3" id="tasks-mobile-list">
          <div className="text-xs font-bold text-slate-500 px-1 mb-2 flex justify-between items-center">
            <span>Danh sách công việc ({filteredTasks.length})</span>
            <span className="text-[10px] bg-gold-50 text-gold-800 px-2 py-0.5 rounded font-mono font-bold border border-gold-200/30">
              MOBILE CARDS
            </span>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400 italic border border-slate-150">
              Đang tải danh sách công việc...
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs flex items-center justify-center">
              <AlertCircle className="w-4 h-4 mr-1.5" />
              {error}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400 italic border border-slate-150">
              Không tìm thấy công việc nào phù hợp bộ lọc.
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isSelected = selectedTask?.id === task.id;
              const badge = statusMap[task.status] || { label: task.status, color: 'bg-gray-100 text-gray-800' };
              const prio = priorityMap[task.priority] || { label: task.priority, color: 'bg-gray-100' };
              const isOverdue = task.due_date && task.due_date < new Date().toISOString().split('T')[0] && task.status !== 'done';
              
              return (
                <div 
                  key={task.id}
                  onClick={() => {
                    fetchTaskDetail(task.id);
                    setTimeout(() => {
                      document.getElementById('task-details-section')?.scrollIntoView({ behavior: 'smooth' });
                    }, 150);
                  }}
                  className={`bg-white rounded-2xl border ${isSelected ? 'border-gold-500 ring-2 ring-gold-500/10' : 'border-slate-150'} p-4 transition-all shadow-2xs space-y-3 relative cursor-pointer hover:border-gold-300`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${prio.color}`}>
                          {prio.label}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      <h4 className={`text-xs font-bold text-slate-800 leading-snug ${isSelected ? 'text-gold-900 font-extrabold' : ''}`}>
                        {task.title}
                      </h4>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
                    <div>
                      <span className="block text-slate-400 font-medium">Phụ trách:</span>
                      <span className="font-semibold text-slate-700">{task.assigned_to_name}</span>
                    </div>
                    <div>
                      <span className="block text-slate-400 font-medium">Hạn hoàn thành:</span>
                      <span className={`font-mono font-bold ${isOverdue ? 'text-rose-600' : 'text-slate-750'}`}>
                        {task.due_date ? new Date(task.due_date).toLocaleDateString('vi-VN') : 'Không giới hạn'}
                      </span>
                    </div>
                  </div>

                  {task.order_code && (
                    <div className="bg-slate-50 p-2 rounded-xl flex items-center justify-between text-[9px] border border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono bg-white text-slate-700 px-1.5 py-0.5 rounded font-bold border border-slate-200">
                          {task.order_code}
                        </span>
                        <span className="text-slate-500 truncate max-w-[120px]">{task.customer_name}</span>
                      </div>
                      <span className="text-gold-600 font-bold">Xem đơn</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Main Grid Table - Dạng bảng/cột như file Excel */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex justify-between items-center text-xs text-slate-500 select-none">
            <span className="font-medium">
              Danh sách đầu việc phân công ({filteredTasks.length} nhiệm vụ)
            </span>
            <span className="text-[10px] bg-gold-50 text-gold-800 px-2 py-0.5 rounded font-mono font-bold border border-gold-200/30">
              WORK GRID
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
              <thead>
                <tr className="bg-slate-100 text-xs font-bold text-slate-700 border-b border-slate-200">
                  <th className="w-16 py-2 px-3 text-center border-r border-slate-200 font-mono text-[11px] select-none text-slate-400 bg-slate-50/50">STT</th>
                  <th className="w-72 px-4 py-2 border-r border-slate-200">Nội Dung Công Việc</th>
                  <th className="w-48 px-4 py-2 border-r border-slate-200">Người Phụ Trách</th>
                  <th className="w-32 px-4 py-2 border-r border-slate-200 text-center">Độ Ưu Tiên</th>
                  <th className="w-40 px-4 py-2 border-r border-slate-200">Hạn Hoàn Thành</th>
                  <th className="w-56 px-4 py-2 border-r border-slate-200">Đơn hàng / Hợp đồng</th>
                  <th className="w-40 px-4 py-2 border-r border-slate-200 text-center">Trạng Thái</th>
                  <th className="w-28 px-4 py-2 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs font-medium text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400 italic">
                      Đang tải danh sách công việc...
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
                ) : filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400 italic">
                      Không tìm thấy công việc nào phù hợp bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task, idx) => {
                    const isSelected = selectedTask?.id === task.id;
                    const rowNum = idx + 1;
                    const badge = statusMap[task.status] || { label: task.status, color: 'bg-gray-100' };
                    const prio = priorityMap[task.priority] || { label: task.priority, color: 'bg-gray-100' };
                    return (
                      <tr 
                        key={task.id}
                        onClick={() => fetchTaskDetail(task.id)}
                        className={`hover:bg-slate-50/60 transition-all cursor-pointer border-b border-slate-200 ${
                          isSelected ? 'bg-gold-50/40 text-gold-950 font-semibold' : ''
                        }`}
                      >
                        {/* STT Column */}
                        <td className="py-2.5 px-3 text-center border-r border-slate-200 font-mono text-[11px] select-none text-slate-400 bg-slate-50/30">
                          {rowNum}
                        </td>

                        {/* Nội Dung Công Việc */}
                        <td className={`px-4 py-2.5 border-r border-slate-200 truncate ${
                          isSelected ? 'text-gold-900 font-bold' : 'text-gray-900 font-semibold'
                        }`}>
                          {task.title}
                        </td>

                        {/* Người Phụ Trách */}
                        <td className="px-4 py-2.5 border-r border-slate-200 truncate font-semibold text-slate-850">
                          {task.assigned_to_name}
                        </td>

                        {/* Độ Ưu Tiên */}
                        <td className="px-4 py-2 border-r border-slate-200 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${prio.color}`}>
                            {prio.label}
                          </span>
                        </td>

                        {/* Hạn Hoàn Thành */}
                        <td className="px-4 py-2.5 border-r border-slate-200 truncate text-slate-500 font-mono">
                          {task.due_date ? new Date(task.due_date).toLocaleDateString('vi-VN') : <span className="text-slate-300 italic">Không giới hạn</span>}
                        </td>

                        {/* Đơn hàng liên quan */}
                        <td className="px-4 py-2.5 border-r border-slate-200 truncate font-normal">
                          {task.order_code ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold border border-slate-200/50">
                                {task.order_code}
                              </span>
                              <span className="text-slate-500 truncate">{task.customer_name}</span>
                            </div>
                          ) : (
                            <span className="text-slate-300 italic">Không liên kết</span>
                          )}
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
                            onClick={() => fetchTaskDetail(task.id)}
                            className={`px-3 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                              isSelected 
                                ? 'bg-gold-100 text-gold-800' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            Xem chi tiết
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

      {/* Selected Task Details & Updates Log Section (Opens below when row selected) */}
      <div className="mt-6 animate-fade-in" id="task-details-section">
        {detailLoading ? (
          <div className="bg-white rounded-2xl border border-gray-150 p-12 text-center text-slate-400 shadow-xs h-64 flex flex-col items-center justify-center">
            <RefreshCw className="w-8 h-8 animate-spin text-gold-500 mb-2" />
            <span className="text-xs font-semibold">Đang truy xuất dữ liệu tiến độ chi tiết...</span>
          </div>
        ) : selectedTask ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Task Core Information Card */}
            <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-100 p-6 shadow-xs space-y-5">
              <div className="flex justify-between items-start gap-4 pb-3 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${statusMap[selectedTask.status]?.color}`}>
                      {statusMap[selectedTask.status]?.label}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${priorityMap[selectedTask.priority]?.color}`}>
                      {priorityMap[selectedTask.priority]?.label}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mt-2.5 leading-snug">{selectedTask.title}</h3>
                </div>

                {/* Quick actions for current user to take / complete task */}
                <div className="shrink-0">
                  {selectedTask.assigned_to === userId && selectedTask.status === 'pending' && (
                    <button 
                      onClick={() => handleQuickStatusChange('in_progress')}
                      className="bg-gold-600 hover:bg-gold-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center transition-all cursor-pointer shadow-2xs"
                    >
                      <Play className="w-3.5 h-3.5 mr-1" /> Nhận việc
                    </button>
                  )}
                  {selectedTask.assigned_to === userId && selectedTask.status === 'in_progress' && (
                    <button 
                      onClick={() => handleQuickStatusChange('done')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center transition-all cursor-pointer shadow-2xs"
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Xong việc
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-1 text-xs text-gray-600">
                <div className="flex items-center">
                  <User className="w-4 h-4 text-gray-400 mr-2.5 shrink-0" />
                  <strong className="w-24 shrink-0">Người thực hiện:</strong>
                  <span className="text-gray-900 font-semibold">{selectedTask.assigned_to_name}</span>
                </div>
                <div className="flex items-center">
                  <User className="w-4 h-4 text-gray-400 mr-2.5 shrink-0" />
                  <strong className="w-24 shrink-0">Người giao việc:</strong>
                  <span className="text-gray-900">{selectedTask.assigned_by_name}</span>
                </div>
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 text-gray-400 mr-2.5 shrink-0" />
                  <strong className="w-24 shrink-0">Hạn chót hoàn thành:</strong>
                  <span className={`font-semibold ${selectedTask.due_date && selectedTask.due_date < new Date().toISOString().split('T')[0] && selectedTask.status !== 'done' ? 'text-rose-600 font-bold' : 'text-gray-900'}`}>
                    {selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString('vi-VN') : 'Không giới hạn'}
                  </span>
                </div>
              </div>

              {selectedTask.order && (
                <div className="bg-gold-50/20 p-4 rounded-xl border border-gold-200/30 space-y-2">
                  <h4 className="text-[10px] font-bold text-gold-800 uppercase tracking-wider flex items-center">
                    <Briefcase className="w-3.5 h-3.5 mr-1.5 text-gold-600" /> Hợp đồng liên quan
                  </h4>
                  <p className="text-xs">
                    Mã đơn: <strong 
                      onClick={() => onNavigate('orders', { selectOrderId: selectedTask.order.id })}
                      className="text-gold-600 hover:underline cursor-pointer font-mono font-bold"
                    >
                      {selectedTask.order.order_code}
                    </strong>
                  </p>
                  <p className="text-xs text-gray-600">Khách hàng: <strong>{selectedTask.customer?.full_name}</strong></p>
                  <p className="text-[11px] text-gray-400 italic">Gói: {selectedTask.order.package_name}</p>
                </div>
              )}

              {selectedTask.description && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center mb-1.5">
                    <FileText className="w-3.5 h-3.5 mr-1 text-slate-500" /> Chỉ dẫn chi tiết
                  </p>
                  <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                    {selectedTask.description}
                  </p>
                </div>
              )}

              {(() => {
                const contacts = parseContactFromDesc(selectedTask.description || '');
                if (contacts.phone || contacts.facebook) {
                  return (
                    <div className="bg-amber-50/40 p-4 rounded-xl border border-amber-200/50 space-y-2.5">
                      <h4 className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center">
                        ⚡ Thao tác chăm sóc nhanh
                      </h4>
                      <div className="space-y-2">
                        {contacts.phone && (
                          <div className="flex items-center text-xs text-slate-600 gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200/60">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <strong>SĐT liên hệ:</strong>
                            <span className="text-slate-800 font-mono font-bold select-all">{contacts.phone}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(contacts.phone || '');
                                alert('Đã sao chép số điện thoại!');
                              }}
                              className="text-[10px] text-gold-600 hover:text-gold-700 font-bold ml-auto cursor-pointer"
                            >
                              Sao chép
                            </button>
                          </div>
                        )}
                        <div className="flex gap-2 pt-1">
                          {contacts.facebook && (
                            <a
                              href={contacts.facebook}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                            >
                              <Facebook className="w-3.5 h-3.5" /> Nhắn Facebook
                            </a>
                          )}
                          {contacts.phone && (
                            <a
                              href={`https://zalo.me/${contacts.phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                            >
                              💬 Nhắn Zalo
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* Right Column (Colspan 2): Timeline & Progress Updates Reporting Box */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-xs space-y-6">
              <h3 className="font-bold text-gray-900 text-sm flex items-center pb-3 border-b border-gray-100 uppercase tracking-wide">
                <MessageSquare className="w-4 h-4 text-gold-600 mr-2" /> {isUrgeMode ? "Yêu cầu báo cáo & Đôn đốc tiến độ" : "Báo cáo tiến độ & Nhật ký hoạt động"}
              </h3>

              {/* Progress Update reporting form */}
              <form onSubmit={handleAddComment} className="bg-slate-50 p-4 rounded-xl border border-slate-250/60 space-y-3.5">
                {commentError && (
                  <div className="bg-red-50 text-red-600 p-2.5 rounded-xl text-xs flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1.5" />
                    {commentError}
                  </div>
                )}
                
                <div className="flex gap-4 flex-col sm:flex-row">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      {isUrgeMode ? "Nội dung yêu cầu / Chỉ thị chi tiết *" : "Nội dung báo cáo cập nhật tiến độ chi tiết *"}
                    </label>
                    <textarea 
                      rows={2}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder={isUrgeMode 
                        ? "Nhập yêu cầu báo cáo hoặc đôn đốc nhân viên (Ví dụ: Thúc giục chỉnh sửa nhanh hoặc yêu cầu báo cáo tiến độ in album...)" 
                        : "Nhập tiến trình cụ thể (Ví dụ: Đã xử lý xong màu sắc da cho album tiệc cưới...)"}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-gold-500 resize-none leading-relaxed"
                      required
                    />
                  </div>

                  {!isUrgeMode && (
                    <div className="w-full sm:w-48 shrink-0">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Cập nhật trạng thái mới</label>
                      <select 
                        value={commentStatusChange}
                        onChange={(e) => setCommentStatusChange(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none text-slate-700 cursor-pointer"
                      >
                        <option value="">-- Giữ nguyên hiện trạng --</option>
                        {Object.entries(statusMap).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-1">
                  <button 
                    type="submit"
                    className="bg-gold-600 hover:bg-gold-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-2xs cursor-pointer"
                  >
                    {isUrgeMode ? "Gửi yêu cầu / Đôn đốc" : "Gửi báo cáo tiến độ"}
                  </button>
                </div>
              </form>

              {/* Chronological logs listing */}
              <div className="relative border-l border-slate-200 ml-4 space-y-5 pt-2 max-h-[250px] overflow-y-auto pr-2">
                {selectedTask.updates?.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 pl-4 italic">Chưa ghi nhận báo cáo cập nhật nào từ các nhân sự.</p>
                ) : (
                  selectedTask.updates?.map((up: any) => (
                    <div key={up.id} className="relative pl-6 animate-fade-in">
                      <span className="absolute -left-[5px] top-1.5 bg-gold-500 rounded-full w-2.5 h-2.5 ring-4 ring-white"></span>
                      
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[10px] text-slate-400">
                          {new Date(up.created_at).toLocaleString('vi-VN')} • Báo cáo bởi: <strong className="text-slate-700 font-bold">{up.updated_by_name}</strong>
                        </p>
                        
                        {up.status_changed_to && (
                          <span className="bg-gold-50 text-gold-950 border border-gold-200/50 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase select-none">
                            → {up.status_changed_to}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-700 mt-2 bg-slate-50/50 p-3 rounded-xl border border-slate-100 leading-relaxed whitespace-pre-line">
                        {up.comment}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        ) : (
	          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 shadow-xs flex flex-col items-center justify-center h-48">
	            <CheckSquare className="w-10 h-10 opacity-30 mb-2" />
	            <h4 className="text-xs font-semibold text-gray-600">Chọn một dòng trên danh sách công việc để xem chi tiết & cập nhật nhật ký</h4>
	            <p className="text-[11px] text-gray-400 mt-0.5 font-normal">Kiểm tra nội dung bàn giao, deadline và lịch sử cập nhật công việc.</p>
	          </div>
        )}
      </div>

      {/* Task Creation Modal Form (Manager/Admin Only) */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden border border-gray-100 animate-scale-in">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-base">Giao công việc nội bộ</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-6 space-y-4">
              {createError && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-xs flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1.5 shrink-0" />
                  {createError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Tiêu đề công việc *</label>
                <input 
                  type="text"
                  placeholder="Ví dụ: Chụp ảnh Album tiệc cưới"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-gold-500"
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

              {!initialOpenCreateWithTemplate && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Liên kết Đơn hàng / Hợp đồng (nếu có)</label>
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="Nhập mã đơn, tên khách hoặc gói dịch vụ để tìm..."
                      value={orderSearch}
                      onChange={(e) => {
                        setOrderSearch(e.target.value);
                        setIsOrderDropdownOpen(true);
                        if (!e.target.value) {
                          setTaskOrderId('');
                        }
                      }}
                      onFocus={() => setIsOrderDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setIsOrderDropdownOpen(false), 250)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-gold-500 font-medium text-slate-700"
                    />
                    {isOrderDropdownOpen && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                        {orderSearch && (
                          <div 
                            onMouseDown={() => {
                              setTaskOrderId('');
                              setOrderSearch('');
                              setIsOrderDropdownOpen(false);
                            }}
                            className="p-2 text-xs text-rose-600 hover:bg-rose-50 cursor-pointer font-bold transition-colors"
                          >
                            -- Bỏ liên kết đơn hàng --
                          </div>
                        )}
                        {orders.filter(o => 
                          (o.order_code || '').toLowerCase().includes(orderSearch.toLowerCase()) ||
                          (o.customer_name || '').toLowerCase().includes(orderSearch.toLowerCase()) ||
                          (o.package_name || '').toLowerCase().includes(orderSearch.toLowerCase())
                        ).length === 0 ? (
                          <div className="p-2.5 text-xs text-gray-400 italic text-center">Không tìm thấy đơn hàng nào</div>
                        ) : (
                          orders.filter(o => 
                            (o.order_code || '').toLowerCase().includes(orderSearch.toLowerCase()) ||
                            (o.customer_name || '').toLowerCase().includes(orderSearch.toLowerCase()) ||
                            (o.package_name || '').toLowerCase().includes(orderSearch.toLowerCase())
                          ).map(o => (
                            <div 
                              key={o.id}
                              onMouseDown={() => {
                                setTaskOrderId(o.id);
                                setOrderSearch(`[${o.order_code}] - ${o.customer_name}`);
                                setIsOrderDropdownOpen(false);
                              }}
                              className={`p-2.5 text-xs cursor-pointer hover:bg-gold-50 transition-colors ${
                                taskOrderId === o.id ? 'bg-gold-50/50 font-bold text-gold-900' : 'text-gray-750'
                              }`}
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-mono font-bold text-slate-900">{o.order_code}</span>
                                <span className="text-slate-500">{o.customer_name}</span>
                              </div>
                              <div className="text-[10px] text-gray-400 mt-0.5 truncate">{o.package_name}</div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Mô tả công việc</label>
                <textarea 
                  rows={2}
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Lưu ý cụ thể, file concept..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none resize-none"
                />
              </div>

              <div className="flex space-x-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsCreateOpen(false)}
                  className="w-1/2 border border-gray-200 hover:bg-gray-50 text-gray-700 py-2 rounded-xl text-xs font-semibold"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit"
                  className="w-1/2 bg-gold-500 hover:bg-gold-600 text-white py-2 rounded-xl text-xs font-semibold shadow-xs"
                >
                  Giao công việc
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
