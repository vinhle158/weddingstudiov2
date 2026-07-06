import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/api';
import BottomSheet from '../shared/BottomSheet';
import { 
  Search, 
  ChevronRight, 
  CheckSquare, 
  Square, 
  Clock, 
  AlertCircle, 
  User, 
  Plus, 
  Tag, 
  MessageSquare,
  Briefcase,
  Send,
  Calendar
} from 'lucide-react';

interface MobileTasksProps {
  userRole: string;
  userId: string;
  onNavigate: (tab: string, arg?: any) => void;
  initialSelectedTaskId?: string;
}

export default function MobileTasks({ 
  userRole, 
  userId, 
  onNavigate, 
  initialSelectedTaskId 
}: MobileTasksProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in_progress' | 'done'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Detail Modal
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Add Update state
  const [commentText, setCommentText] = useState('');
  const [commentStatusChange, setCommentStatusChange] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/api/tasks');
      setTasks(data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải danh sách công việc');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    if (initialSelectedTaskId && tasks.length > 0) {
      const t = tasks.find(x => x.id === initialSelectedTaskId);
      if (t) {
        openTaskDetail(t.id);
      }
    }
  }, [initialSelectedTaskId, tasks]);

  const openTaskDetail = async (taskId: string) => {
    try {
      setIsDetailOpen(true);
      setSelectedTask(null);
      const detail = await apiRequest(`/api/tasks/${taskId}`);
      setSelectedTask(detail);
      setCommentStatusChange(detail.status);
      setCommentText('');
    } catch (err: any) {
      alert('Không thể tải chi tiết công việc: ' + err.message);
    }
  };

  const handleQuickToggle = async (task: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus = task.status === 'done' ? 'in_progress' : 'done';
    try {
      await apiRequest(`/api/tasks/${task.id}/updates`, 'POST', {
        status: nextStatus,
        content: `Cập nhật nhanh sang trạng thái ${nextStatus === 'done' ? 'Hoàn thành' : 'Đang làm'} từ Mobile`
      });
      fetchTasks();
    } catch (err: any) {
      alert('Lỗi cập nhật nhanh: ' + err.message);
    }
  };

  const handlePostUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    try {
      setSubmittingComment(true);
      await apiRequest(`/api/tasks/${selectedTask.id}/updates`, 'POST', {
        status: commentStatusChange || selectedTask.status,
        content: commentText || `Cập nhật trạng thái sang ${commentStatusChange}`
      });

      alert('Đăng cập nhật thành công!');
      setIsDetailOpen(false);
      fetchTasks();
    } catch (err: any) {
      alert('Lỗi gửi cập nhật: ' + err.message);
    } finally {
      setSubmittingComment(false);
    }
  };

  const getFilteredTasks = () => {
    // Show technical staff only their tasks
    const isStaff = userRole === 'role-photographer' || userRole === 'role-editor' || userRole === 'role-staff';
    
    return tasks.filter(t => {
      const belongs = !isStaff || t.assigned_to === userId;
      const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
      return belongs && matchesSearch && matchesStatus;
    });
  };

  const getPriorityColor = (prio: string) => {
    switch (prio) {
      case 'high': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'normal': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Chờ nhận';
      case 'in_progress': return 'Đang làm';
      case 'done': return 'Hoàn thành';
      default: return status;
    }
  };

  const filteredTasks = getFilteredTasks();

  return (
    <div className="space-y-4 pb-6">
      {/* Search & Tabs */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
        <input 
          type="text" 
          placeholder="Tìm tiêu đề công việc..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-gold-400"
        />
      </div>

      <div className="flex bg-slate-100 p-1 rounded-xl text-[10px] font-bold">
        {[
          { id: 'all', label: 'Tất cả' },
          { id: 'pending', label: 'Chờ nhận' },
          { id: 'in_progress', label: 'Đang làm' },
          { id: 'done', label: 'Đã xong' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setFilterStatus(tab.id as any)}
            className={`flex-1 py-1.5 rounded-lg transition-all ${filterStatus === tab.id ? 'bg-white text-gold-900 shadow-2xs font-bold' : 'text-slate-500'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-gold-500"></div>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white p-6 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs py-10">
          Không có công việc nào cần xử lý
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map(task => {
            const isDone = task.status === 'done';

            return (
              <div 
                key={task.id}
                onClick={() => openTaskDetail(task.id)}
                className={`bg-white p-4 rounded-xl border border-slate-200/50 shadow-3xs hover:bg-slate-50 active:bg-slate-100 transition-colors flex justify-between items-center cursor-pointer ${isDone ? 'opacity-65' : ''}`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <button 
                    onClick={(e) => handleQuickToggle(task, e)}
                    className="p-1 rounded-full text-gold-600 active:scale-95 transition-transform"
                  >
                    {isDone ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-slate-300" />}
                  </button>
                  <div className="space-y-1 flex-1 min-w-0">
                    <span className={`text-xs font-bold text-slate-800 truncate block ${isDone ? 'line-through text-slate-400' : ''}`}>
                      {task.title}
                    </span>
                    <p className="text-[10px] text-slate-400 font-semibold">{task.due_date ? `Đến hạn: ${task.due_date}` : 'Không thời hạn'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[8px] px-1.5 py-0.2 rounded font-bold uppercase border ${getPriorityColor(task.priority)}`}>
                        {task.priority === 'high' ? 'Gấp' : 'Thường'}
                      </span>
                      <span className="text-[9px] text-slate-400 bg-slate-50 px-1.5 py-0.2 rounded font-bold">
                        {getStatusLabel(task.status)}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </div>
            );
          })}
        </div>
      )}

      {/* DETAIL SHEET */}
      <BottomSheet
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title="Chi tiết công việc phân công"
      >
        {!selectedTask ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-gold-500"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div className="pb-4 border-b border-slate-100 flex justify-between items-start">
              <div>
                <h4 className="text-sm font-bold text-slate-800">{selectedTask.title}</h4>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Nhiệm vụ ID: {selectedTask.id}</p>
              </div>
              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase border ${getPriorityColor(selectedTask.priority)}`}>
                {selectedTask.priority === 'high' ? 'Gấp' : 'Bình thường'}
              </span>
            </div>

            {/* Fields */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-gold-600" /> Ngày đến hạn
                </span>
                <p className="font-bold text-slate-700">{selectedTask.due_date || 'Không có hạn'}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <User className="w-3 h-3 text-gold-600" /> Người thực hiện
                </span>
                <p className="font-bold text-slate-700">{selectedTask.assigned_to_name || 'Chưa phân công'}</p>
              </div>

              {selectedTask.order_id && (
                <div className="space-y-1 col-span-2">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Briefcase className="w-3 h-3 text-gold-600" /> Hợp đồng liên quan
                  </span>
                  <div 
                    onClick={() => {
                      setIsDetailOpen(false);
                      onNavigate('orders', { selectOrderId: selectedTask.order_id });
                    }}
                    className="p-2.5 bg-slate-50 border rounded-lg flex justify-between items-center cursor-pointer hover:bg-slate-100/50"
                  >
                    <span className="text-[10px] font-bold text-slate-700">Xem hợp đồng liên quan</span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              )}
            </div>

            {/* Desc */}
            <div className="space-y-1.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Mô tả công việc</span>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-[11px] text-slate-600 leading-relaxed font-medium">
                {selectedTask.description || 'Không có mô tả chi tiết.'}
              </div>
            </div>

            {/* Action Form */}
            <form onSubmit={handlePostUpdate} className="border-t border-slate-100 pt-4 space-y-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Cập nhật tiến độ nhiệm vụ</h4>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Trạng thái mới</label>
                  <select
                    value={commentStatusChange}
                    onChange={(e) => setCommentStatusChange(e.target.value)}
                    className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-xs focus:outline-none"
                  >
                    <option value="pending">Chờ nhận việc</option>
                    <option value="in_progress">Đang thực hiện</option>
                    <option value="done">Đã hoàn thành</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Báo cáo nhanh</label>
                  <input
                    type="text"
                    placeholder="VD: Đã làm xong file thiết kế"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingComment}
                className="w-full bg-gradient-to-r from-gold-500 to-gold-600 text-white font-bold py-2.5 rounded-xl text-xs shadow-md"
              >
                Gửi báo cáo tiến độ
              </button>
            </form>

            {/* Updates History */}
            {selectedTask.updates && selectedTask.updates.length > 0 && (
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-gold-600" />
                  <span>Lịch sử xử lý ({selectedTask.updates.length})</span>
                </h4>
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {selectedTask.updates.map((update: any) => (
                    <div key={update.id} className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[10px]">
                      <div className="flex justify-between items-center mb-1 text-[8px] text-slate-400 font-bold">
                        <span className="text-slate-600 font-extrabold">{update.user_name}</span>
                        <span>{new Date(update.created_at).toLocaleString('vi-VN')}</span>
                      </div>
                      <p className="text-slate-700 leading-normal">{update.content}</p>
                      <span className="inline-block bg-gold-100 text-gold-800 text-[8px] font-bold px-1 py-0.2 rounded mt-1">
                        Trạng thái: {getStatusLabel(update.status)}
                      </span>
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
