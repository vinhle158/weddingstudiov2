import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import MobileLayout from './MobileLayout';

// Import screens
import MobileDashboard from './screens/MobileDashboard';
import MobileLeads from './screens/MobileLeads';
import MobileOrders from './screens/MobileOrders';
import MobileCustomers from './screens/MobileCustomers';
import MobileTasks from './screens/MobileTasks';
import MobileObjectives from './screens/MobileObjectives';
import MobileChat from './screens/MobileChat';
import MobileNotifications from './screens/MobileNotifications';
import MobileStaff from './screens/MobileStaff';
import MobileSettings from './screens/MobileSettings';
import ChatWidget from '../ChatWidget';

// Icons for launcher menu
import { Users, Target, Bell, ShieldAlert, Settings, MessageSquare, LogOut, Sparkles } from 'lucide-react';

interface MobileAppProps {
  user: any;
  role: any;
  onLogout: () => void;
  studioSettings: any;
}

export default function MobileApp({ user, role, onLogout, studioSettings }: MobileAppProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [navigationArg, setNavigationArg] = useState<any>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const hasPermission = (permission: string) => {
    if (!role) return false;
    return role.permissions.includes(permission) || role.id === 'role-admin';
  };

  // Poll for notifications
  const fetchUnreadCount = async () => {
    try {
      const notifs = await apiRequest('/api/notifications');
      const count = notifs.filter((n: any) => !n.is_read).length;
      setUnreadNotifications(count);
    } catch (err) {
      console.error('Failed to fetch unread notifications count:', err);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleNavigate = (tab: string, arg?: any) => {
    setActiveTab(tab);
    setNavigationArg(arg);
  };

  // Map tab IDs to screen titles
  const getScreenTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard': return 'Tổng quan Studio';
      case 'leads': return 'Quản lý Tư vấn';
      case 'orders': return 'Hợp đồng & Đơn hàng';
      case 'tasks': return 'Nhiệm vụ Phân công';
      case 'customers': return 'Hồ sơ Khách hàng';
      case 'objectives': return 'Mục tiêu & KPI';
      case 'chat': return 'Trò chuyện nội bộ';
      case 'notifications': return 'Thông báo mới';
      case 'staff': return 'Quản lý Nhân sự';
      case 'settings': return 'Cài đặt Studio';
      case 'menu': return 'Menu Hệ thống';
      default: return 'The Will';
    }
  };

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <MobileDashboard
            userRole={role?.id}
            userId={user?.id}
            onNavigate={handleNavigate}
          />
        );
      case 'leads':
        return (
          <MobileLeads
            userRole={role?.id}
            userId={user?.id}
          />
        );
      case 'orders':
        return (
          <MobileOrders
            userRole={role?.id}
            initialSelectedOrderId={navigationArg?.selectOrderId}
            onNavigate={handleNavigate}
          />
        );
      case 'customers':
        return (
          <MobileCustomers
            userRole={role?.id}
            onNavigate={handleNavigate}
          />
        );
      case 'tasks':
        return (
          <MobileTasks
            userRole={role?.id}
            userId={user?.id}
            onNavigate={handleNavigate}
          />
        );
      case 'objectives':
        return <MobileObjectives userRole={role?.id} />;
      case 'chat':
        return <MobileChat userId={user?.id} userRole={role?.id} />;
      case 'notifications':
        return (
          <MobileNotifications
            userId={user?.id}
            userRole={role?.id}
            onRefresh={fetchUnreadCount}
          />
        );
      case 'staff':
        return <MobileStaff userRole={role?.id} />;
      case 'settings':
        return (
          <MobileSettings
            user={user}
            role={role}
            onLogout={onLogout}
            studioSettings={studioSettings}
          />
        );
      case 'menu':
        return renderLauncherMenu();
      default:
        return (
          <MobileDashboard
            userRole={role?.id}
            userId={user?.id}
            onNavigate={handleNavigate}
          />
        );
    }
  };

  const renderLauncherMenu = () => {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="bg-gradient-to-r from-gold-500/10 to-gold-600/15 p-4 rounded-2xl border border-gold-200/20 text-slate-800">
          <p className="text-[9px] uppercase font-bold text-gold-800 tracking-widest mb-1 font-mono">Bảng điều phối</p>
	          <h3 className="text-sm font-bold text-slate-900 leading-tight">Xin chào, {user?.full_name}</h3>
	          <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
	            Mở nhanh hồ sơ, công việc và thông báo cần xử lý.
	          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => handleNavigate('customers')}
            className="bg-white active:bg-slate-50 p-4 rounded-xl border border-slate-200/50 text-left flex flex-col justify-between h-24 transition-all shadow-2xs"
          >
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg w-fit">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">Khách hàng</h4>
              <p className="text-[9px] text-slate-400 mt-0.5">Danh sách & Hồ sơ</p>
            </div>
          </button>

          <button 
            onClick={() => handleNavigate('objectives')}
            className="bg-white active:bg-slate-50 p-4 rounded-xl border border-slate-200/50 text-left flex flex-col justify-between h-24 transition-all shadow-2xs"
          >
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg w-fit">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">Mục tiêu</h4>
              <p className="text-[9px] text-slate-400 mt-0.5">KPI & Kế hoạch</p>
            </div>
          </button>

          <button 
            onClick={() => handleNavigate('notifications')}
            className="bg-white active:bg-slate-50 p-4 rounded-xl border border-slate-200/50 text-left flex flex-col justify-between h-24 transition-all shadow-2xs relative"
          >
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg w-fit">
              <Bell className="w-4 h-4" />
            </div>
            {unreadNotifications > 0 && (
              <span className="absolute top-4 right-4 bg-rose-500 text-white font-mono text-[8px] px-1.5 py-0.5 rounded-full font-bold scale-75">
                {unreadNotifications}
              </span>
            )}
            <div>
              <h4 className="text-xs font-bold text-slate-800">Thông báo</h4>
              <p className="text-[9px] text-slate-400 mt-0.5">Yêu cầu bàn giao</p>
            </div>
          </button>

          <button 
            onClick={() => handleNavigate('chat')}
            className="bg-white active:bg-slate-50 p-4 rounded-xl border border-slate-200/50 text-left flex flex-col justify-between h-24 transition-all shadow-2xs"
          >
            <div className="p-2 bg-teal-50 text-teal-600 rounded-lg w-fit">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">Trò chuyện</h4>
              <p className="text-[9px] text-slate-400 mt-0.5">Nội bộ Studio</p>
            </div>
          </button>

          {hasPermission('users.manage') && (
            <button 
              onClick={() => handleNavigate('staff')}
              className="bg-white active:bg-slate-50 p-4 rounded-xl border border-slate-200/50 text-left flex flex-col justify-between h-24 transition-all shadow-2xs"
            >
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg w-fit">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">Nhân sự</h4>
                <p className="text-[9px] text-slate-400 mt-0.5">Tài khoản & Vai trò</p>
              </div>
            </button>
          )}

          {hasPermission('users.manage') && (
            <button 
              onClick={() => handleNavigate('settings')}
              className="bg-white active:bg-slate-50 p-4 rounded-xl border border-slate-200/50 text-left flex flex-col justify-between h-24 transition-all shadow-2xs"
            >
              <div className="p-2 bg-slate-100 text-slate-600 rounded-lg w-fit">
                <Settings className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">Cài đặt</h4>
                <p className="text-[9px] text-slate-400 mt-0.5">Hồ sơ Studio</p>
              </div>
            </button>
          )}

          <button 
            onClick={onLogout}
            className="bg-rose-50/50 active:bg-rose-100 p-4 rounded-xl border border-rose-100 text-left flex flex-col justify-between h-24 transition-all"
          >
            <div className="p-2 bg-rose-100 text-rose-600 rounded-lg w-fit">
              <LogOut className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-rose-800">Đăng xuất</h4>
              <p className="text-[9px] text-rose-400 mt-0.5">Thoát tài khoản</p>
            </div>
          </button>
        </div>
      </div>
    );
  };

  const subTabs = ['customers', 'objectives', 'notifications', 'staff', 'settings', 'chat'];
  const showBackButton = subTabs.includes(activeTab);

  return (
    <MobileLayout
      activeTab={activeTab}
      onTabChange={handleNavigate}
      studioSettings={studioSettings}
      unreadNotifications={unreadNotifications}
      user={user}
      role={role}
      hasPermission={hasPermission}
      title={getScreenTitle(activeTab)}
      showBackButton={showBackButton}
      onBackClick={() => handleNavigate('menu')}
      assistantSlot={role?.id === 'role-admin' ? <ChatWidget userName={user?.full_name} placement="mobile" /> : null}
    >
      {renderActiveScreen()}
    </MobileLayout>
  );
}
