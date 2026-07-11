import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/api';
import { formatCompactVndFromThousands } from '../../../lib/money';
import { 
  Calendar, 
  Clock, 
  CheckSquare, 
  Target, 
  AlertCircle, 
  Sparkles,
  ChevronRight,
  TrendingUp
} from 'lucide-react';

interface MobileDashboardProps {
  userRole: string;
  userId: string;
  onNavigate: (tab: string, arg?: any) => void;
}

export default function MobileDashboard({ userRole, userId, onNavigate }: MobileDashboardProps) {
  const isStaff = userRole === 'role-photographer' || userRole === 'role-editor' || userRole === 'role-staff';
  
  const [summary, setSummary] = useState<any>(null);
  const [upcomingShoots, setUpcomingShoots] = useState<any[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<any[]>([]);
  const [objectives, setObjectives] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [sumData, shootsData, overdueTasksData, tasksData, objectivesData] = await Promise.all([
        apiRequest('/api/dashboard/summary').catch(() => null),
        apiRequest('/api/dashboard/upcoming-shoots').catch(() => []),
        apiRequest('/api/dashboard/overdue-tasks').catch(() => []),
        apiRequest('/api/tasks').catch(() => []),
        apiRequest('/api/objectives').catch(() => [])
      ]);

      setSummary(sumData);
      setUpcomingShoots(shootsData);
      setOverdueTasks(overdueTasksData);
      setTasks(tasksData);
      setObjectives(objectivesData || []);
    } catch (err: any) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Không thể tải dữ liệu tổng quan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [userId, userRole]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gold-500"></div>
        <p className="mt-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Đang tải dữ liệu...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-xl text-xs flex items-center justify-center gap-2">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  // Filter staff tasks locally if they are staff
  const staffTasks = isStaff ? tasks.filter(t => t.assigned_to === userId) : tasks;

  return (
    <div className="space-y-6 pb-6 animate-fade-in">
      {/* Welcome Card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-5 rounded-2xl text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10">
          <Sparkles className="w-32 h-32 text-gold-400" />
        </div>
        <span className="text-[9px] uppercase font-bold text-gold-400 tracking-widest font-mono">
          {isStaff ? 'Không gian kỹ thuật' : 'Bảng điều phối chung'}
        </span>
        <h2 className="text-base font-bold mt-1 text-slate-150">The Will Studio</h2>
        <div className="flex items-center gap-2 mt-4 text-[10px] text-slate-300 font-semibold bg-slate-700/50 p-2.5 rounded-xl border border-slate-700 w-fit">
          <Calendar className="w-3.5 h-3.5 text-gold-400" />
          <span>Hôm nay: {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' })}</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-3">
        {!isStaff && summary ? (
          <>
            <div className="bg-white p-4 rounded-xl border border-slate-200/50 shadow-2xs flex flex-col justify-between h-24">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Đơn hoạt động</span>
                <Clock className="w-4 h-4 text-gold-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  {summary.orders?.by_status?.shooting + summary.orders?.by_status?.editing + summary.orders?.by_status?.confirmed + summary.orders?.by_status?.new || 0} Đơn
                </h3>
                <p className="text-[8px] text-slate-400 font-medium mt-0.5">Đồng bộ thời gian thực</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/50 shadow-2xs flex flex-col justify-between h-24">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Doanh thu tháng</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  {formatCompactVndFromThousands(summary.revenue?.monthly || 0)}
                </h3>
                <p className="text-[8px] text-emerald-600 font-bold mt-0.5">Tăng trưởng ổn định</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/50 shadow-2xs flex flex-col justify-between h-24">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tiến độ công việc</span>
                <CheckSquare className="w-4 h-4 text-gold-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  {summary.tasks?.done}/{summary.tasks?.total || 0} việc
                </h3>
                <div className="w-full bg-slate-100 rounded-full h-1 mt-1.5">
                  <div 
                    className="bg-gold-500 h-1 rounded-full transition-all" 
                    style={{ width: `${summary.tasks?.total > 0 ? (summary.tasks.done / summary.tasks.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/50 shadow-2xs flex flex-col justify-between h-24">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Mục tiêu chiến dịch</span>
                <Target className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  {objectives.filter(o => o.status === 'active').length} Mục tiêu
                </h3>
                <p className="text-[8px] text-purple-600 font-bold mt-0.5">
                  {objectives.filter(o => o.status === 'completed').length} đã hoàn thành
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white p-4 rounded-xl border border-slate-200/50 shadow-2xs flex flex-col justify-between h-24">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Đang thực hiện</span>
                <Clock className="w-4 h-4 text-gold-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  {staffTasks.filter(t => t.status === 'in_progress').length} Việc
                </h3>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/50 shadow-2xs flex flex-col justify-between h-24">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Chờ nhận việc</span>
                <AlertCircle className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  {staffTasks.filter(t => t.status === 'pending').length} Việc
                </h3>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/50 shadow-2xs flex flex-col justify-between h-24 col-span-2">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tiến độ nhiệm vụ</span>
                <CheckSquare className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  {staffTasks.filter(t => t.status === 'done').length}/{staffTasks.length} Hoàn thành
                </h3>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                  <div 
                    className="bg-emerald-500 h-1.5 rounded-full transition-all" 
                    style={{ width: `${staffTasks.length > 0 ? (staffTasks.filter(t => t.status === 'done').length / staffTasks.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Today Shoots */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Lịch chụp hôm nay ({upcomingShoots.length})
          </h3>
        </div>

        {upcomingShoots.length === 0 ? (
          <div className="bg-white/60 p-4 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs py-6">
            Hôm nay không có lịch chụp nào
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingShoots.map(shoot => (
              <div 
                key={shoot.id}
                onClick={() => onNavigate('orders', { selectOrderId: shoot.id })}
                className="bg-white p-4 rounded-xl border border-slate-200/50 shadow-2xs hover:bg-slate-50 active:bg-slate-100 transition-colors flex justify-between items-center cursor-pointer"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800">{shoot.customer_name}</span>
                    <span className="text-[8px] bg-rose-50 border border-rose-200 text-rose-600 px-1 rounded font-bold uppercase">Lịch chụp</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold">{shoot.package_name} · {shoot.location}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Overdue Tasks */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Công việc trễ hạn ({overdueTasks.length})
        </h3>

        {overdueTasks.length === 0 ? (
          <div className="bg-white/60 p-4 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs py-6">
            Không có công việc trễ hạn nào
          </div>
        ) : (
          <div className="space-y-2">
            {overdueTasks.map(task => (
              <div 
                key={task.id}
                onClick={() => onNavigate('tasks', { selectTaskId: task.id })}
                className="bg-white p-4 rounded-xl border border-slate-200/50 shadow-2xs hover:bg-slate-50 active:bg-slate-100 transition-colors flex justify-between items-center cursor-pointer"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800 truncate max-w-[200px]">{task.title}</span>
                    <span className="text-[8px] bg-red-100 text-red-700 border border-red-200 px-1 rounded font-bold uppercase">Trễ hạn</span>
                  </div>
                  <p className="text-[10px] text-slate-400">Đến hạn: {new Date(task.due_date).toLocaleDateString('vi-VN')}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
