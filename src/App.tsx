import React, { useState, useEffect } from 'react';
import { apiRequest } from './lib/api';
import Dashboard from './components/Dashboard';
import Customers from './components/Customers';
import Orders from './components/Orders';
import Tasks from './components/Tasks';
import Objectives from './components/Objectives';
import Chat from './components/Chat';
import Notifications from './components/Notifications';
import Staff from './components/Staff';
import Settings from './components/Settings';
import Leads from './components/Leads';
import ChatWidget from './components/ChatWidget';
import MobileApp from './components/mobile/MobileApp';
import { useIsMobile } from './hooks/useIsMobile';
import { ProductDemoPlayer } from './components/ProductDemoPlayer';
import { 
  Briefcase, 
  Users, 
  CheckSquare, 
  Target,
  MessageSquare,
  Bell,
  BarChart2, 
  ShieldAlert, 
  LogOut, 
  User as UserIcon, 
  Menu, 
  X,
  AlertCircle,
  Clock,
  Sparkles,
  Settings as SettingsIcon,
  Smartphone,
  Laptop,
  ChevronLeft,
  LayoutGrid,
  Activity
} from 'lucide-react';

export default function App() {
  const isMobile = useIsMobile();
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Login form states
  const [email, setEmail] = useState(() => localStorage.getItem('remembered_email') || '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('remembered_email'));
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);


  // Navigation states
  const [activeTab, setActiveTab] = useState('dashboard');
  const [navigationArg, setNavigationArg] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [studioSettings, setStudioSettings] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'pc' | 'mobile'>('pc');
  const [isDemoActive, setIsDemoActive] = useState(() => window.location.search.includes('demo=true') || (window as any).isDemoMode === true);

  const fetchStudioSettings = async () => {
    try {
      const settings = await apiRequest('/api/studio/settings');
      if (settings && settings.name) {
        setStudioSettings(settings);
      }
    } catch (err) {
      console.error('Failed to fetch studio settings in App:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchStudioSettings();
    }
  }, [isAuthenticated]);

  // Check current session on load
  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem('studio_token');
      if (!token) {
        setAuthLoading(false);
        return;
      }

      try {
        const data = await apiRequest('/api/auth/me');
        setUser(data.user);
        setRole(data.role);
        setIsAuthenticated(true);
      } catch (err) {
        console.error('Session restoration failed:', err);
        localStorage.removeItem('studio_token');
      } finally {
        setAuthLoading(false);
      }
    };

    checkSession();
  }, []);

  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState<{ id: string; title: string; content: string; type: string } | null>(null);
  const [previewNotification, setPreviewNotification] = useState<{ id: string; title: string; content: string; type: string } | null>(null);
  const [knownNotifIds, setKnownNotifIds] = useState<Set<string>>(new Set());
  const [isFirstNotifLoad, setIsFirstNotifLoad] = useState(true);

  // Poll for unread notifications and show toast alert
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchNotifications = async () => {
      try {
        const notifs = await apiRequest('/api/notifications');
        const count = notifs.filter((n: any) => !n.is_read).length;
        setUnreadCount(count);

        const currentIds = notifs.map((n: any) => n.id);
        
        if (isFirstNotifLoad) {
          setKnownNotifIds(new Set(currentIds));
          setIsFirstNotifLoad(false);
        } else {
          // Tìm những thông báo mới chưa từng biết và chưa đọc
          const newUnread = notifs.find((n: any) => !n.is_read && !knownNotifIds.has(n.id));
          if (newUnread) {
            setToast({
              id: newUnread.id,
              title: newUnread.title,
              content: newUnread.content,
              type: newUnread.type
            });

            // Phát tiếng bip nhẹ
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const oscillator = audioCtx.createOscillator();
              const gainNode = audioCtx.createGain();
              oscillator.connect(gainNode);
              gainNode.connect(audioCtx.destination);
              oscillator.type = 'sine';
              oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
              gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
              oscillator.start();
              gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.5);
              oscillator.stop(audioCtx.currentTime + 0.5);
            } catch (e) {
              console.log('Audio notification bypass:', e);
            }

            // Thêm vào danh sách đã biết
            setKnownNotifIds(prev => {
              const next = new Set(prev);
              next.add(newUnread.id);
              return next;
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000); // Polling mỗi 10 giây
    return () => clearInterval(interval);
  }, [isAuthenticated, isFirstNotifLoad, knownNotifIds]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const data = await apiRequest('/api/auth/login', 'POST', { email, password });
      localStorage.setItem('studio_token', data.token);
      
      if (rememberMe) {
        localStorage.setItem('remembered_email', email);
      } else {
        localStorage.removeItem('remembered_email');
      }
      localStorage.removeItem('remembered_password');

      setUser(data.user);
      setRole(data.role);
      setIsAuthenticated(true);
    } catch (err: any) {
      setLoginError(err.message || 'Sai thông tin đăng nhập, vui lòng kiểm tra lại');
    } finally {
      setLoginLoading(false);
    }
  };


  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', 'POST');
    } catch (e) {
      // ignore
    }
    localStorage.removeItem('studio_token');
    setUser(null);
    setRole(null);
    setIsAuthenticated(false);
    setActiveTab('dashboard');
    setNavigationArg(null);
  };

  const handleQuickLogin = (quickEmail: string, quickPass: string) => {
    setEmail(quickEmail);
    setPassword(quickPass);
  };

  const handleNavigate = (tab: string, arg?: any) => {
    setActiveTab(tab);
    setNavigationArg(arg);
    setMobileMenuOpen(false);
  };

  const handleOpenNotificationDetail = (notificationId: string) => {
    setPreviewNotification(null);
    setToast(null);
    handleNavigate('notifications', { selectNotificationId: notificationId });
  };

  // Clear navigation args on subsequent tab switches (to avoid repeating modal openings)
  useEffect(() => {
    const timer = setTimeout(() => {
      setNavigationArg(null);
    }, 500);
    return () => clearTimeout(timer);
  }, [activeTab]);

  const hasPermission = (permission: string) => {
    if (!role) return false;
    return role.permissions.includes(permission) || role.id === 'role-admin';
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#faf9f6] flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-gold-500"></div>
          <p className="mt-4 text-slate-500 text-xs font-semibold uppercase tracking-widest">The Will Studio...</p>
        </div>
      </div>
    );
  }

  // LOGIN SCREEN
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#faf9f6] flex items-center justify-center p-4 overflow-hidden">
        <div id="demo-camera-viewport" className="w-full flex items-center justify-center origin-center">
          <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col">
            
            {/* Header Banner */}
            <div className="bg-gradient-to-br from-gold-50 to-gold-100/50 p-8 text-center text-slate-800 relative border-b border-gold-200/40">
              <div className="absolute top-4 right-4 bg-gold-200/30 text-gold-800 border border-gold-300/40 px-2.5 py-0.5 rounded-full text-[9px] font-bold flex items-center tracking-wider">
                <Sparkles className="w-2.5 h-2.5 mr-1 text-gold-600 animate-pulse" /> CLOUD LOCAL
              </div>
              <h1 className="text-3xl font-semibold tracking-widest font-display text-gold-900 italic">The Will</h1>
              <p className="text-gold-700/80 mt-1.5 text-[10px] uppercase tracking-widest font-medium">Hệ thống quản lý Studio cao cấp</p>
            </div>

            <div className="p-6 space-y-5">
              {/* Normal login Form */}
              <form onSubmit={handleLogin} className="space-y-4">
                {loginError && (
                  <div className="bg-rose-50 border border-rose-100 text-rose-600 p-2.5 rounded-xl text-xs flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1.5 shrink-0" />
                    {loginError}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email đăng nhập</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@studio.com"
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl py-2 px-3.5 text-xs focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/20 transition-all"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mật khẩu</label>
                  </div>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl py-2 px-3.5 text-xs focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/20 transition-all"
                    required
                  />
                </div>

                <div className="flex items-center space-x-2 py-0.5">
                  <input 
                    type="checkbox" 
                    id="remember_chk"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-gold-600 focus:ring-gold-400/30"
                  />
                  <label htmlFor="remember_chk" className="text-[11px] font-semibold text-slate-500 select-none cursor-pointer">
                    Lưu mật khẩu cho lần sau
                  </label>
                </div>

                <button 
                  type="submit"
                  disabled={loginLoading}
                  className="w-full bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-white py-2.5 rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all duration-150 disabled:opacity-50 mt-1 cursor-pointer"
                >
                  {loginLoading ? 'Đang xác thực...' : 'Đăng nhập hệ thống'}
                </button>
              </form>
            </div>

          </div>
        </div>
        {isDemoActive && (
          <ProductDemoPlayer
            onClose={() => {
              setIsDemoActive(false);
              const url = new URL(window.location.href);
              url.searchParams.delete('demo');
              window.history.replaceState(null, '', url.toString());
            }}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isAuthenticated={isAuthenticated}
            handleQuickLogin={handleQuickLogin}
            handleLogout={handleLogout}
            setViewMode={setViewMode}
          />
        )}
      </div>
    );
  }

  if (isMobile && !isDemoActive) {
    return (
      <MobileApp
        user={user}
        role={role}
        onLogout={handleLogout}
        studioSettings={studioSettings}
      />
    );
  }

  // MAIN LAYOUT
  const isManager = role?.id === 'role-admin' || role?.id === 'role-manager';

  const menuItems = [
    { id: 'dashboard', label: 'Tổng Quan', icon: BarChart2, permission: 'tasks.view_own' },
    { id: 'leads', label: 'Quản lý Tư vấn (CRM)', icon: Activity, permission: 'leads.manage' },
    { id: 'orders', label: 'Hợp đồng & Đơn hàng', icon: Briefcase, permission: 'orders.view' },
    { id: 'customers', label: 'Quản lý Khách hàng', icon: Users, permission: 'customers.view' },
    { id: 'tasks', label: 'Phân công công việc', icon: CheckSquare, permission: 'tasks.view_own' },
    { id: 'objectives', label: 'Mục tiêu & Tiến độ', icon: Target, permission: 'tasks.view_all' },
    { id: 'chat', label: 'Trò chuyện nội bộ', icon: MessageSquare, permission: 'tasks.view_own' },
    { id: 'notifications', label: 'Thông báo', icon: Bell, permission: 'tasks.view_own' },
    { id: 'staff', label: 'Quản lý Nhân sự', icon: ShieldAlert, permission: 'users.manage' },
    { id: 'settings', label: 'Cài đặt & Hệ thống', icon: SettingsIcon, permission: 'users.manage' },
  ];

  const filteredMenuItems = menuItems.filter(item => hasPermission(item.permission));

  const renderMainContent = () => {
    return (
      <>
        {activeTab === 'dashboard' && (
          <Dashboard 
            userRole={role?.name} 
            userId={user?.id}
            onNavigate={handleNavigate} 
            studioSettings={studioSettings}
            isMobile={viewMode === 'mobile'}
          />
        )}

        {activeTab === 'leads' && (
          <Leads 
            userRole={role?.name} 
            onNavigate={handleNavigate}
          />
        )}
        
        {activeTab === 'orders' && (
          <Orders 
            userRole={role?.name} 
            onNavigate={handleNavigate}
            initialSelectedOrderId={navigationArg?.selectOrderId}
            initialOpenCreateForCustomerId={navigationArg?.openCreateForCustomerId}
            initialCreateCustomerDraft={navigationArg?.createCustomerDraft}
            initialCreatePrefill={navigationArg?.createOrderPrefill}
            isMobile={viewMode === 'mobile'}
          />
        )}

        {activeTab === 'customers' && (
          <Customers 
            userRole={role?.name} 
            onNavigate={handleNavigate}
            initialSelectedCustomerId={navigationArg?.selectCustomerId}
            isMobile={viewMode === 'mobile'}
          />
        )}

        {activeTab === 'tasks' && (
          <Tasks 
            userRole={role?.name} 
            userId={user?.id}
            onNavigate={handleNavigate}
            initialSelectedTaskId={navigationArg?.selectTaskId}
            initialOpenCreateWithTemplate={navigationArg?.createTaskTemplate}
            isMobile={viewMode === 'mobile'}
          />
        )}

        {activeTab === 'objectives' && (
          <Objectives 
            userRole={role?.name} 
          />
        )}

        {activeTab === 'chat' && (
          <Chat 
            userId={user?.id}
            userRole={role?.name}
          />
        )}

        {activeTab === 'notifications' && (
          <Notifications 
            userId={user?.id}
            userRole={role?.name}
            onNavigate={handleNavigate}
            initialSelectedNotificationId={navigationArg?.selectNotificationId}
          />
        )}

        {activeTab === 'staff' && (
          <Staff 
            userRole={role?.name} 
          />
        )}

        {activeTab === 'settings' && (
          <Settings onSettingsSaved={fetchStudioSettings} />
        )}
      </>
    );
  };

  // 1. MOBILE VIEWPORT SIMULATION RENDER (iPhone Frame on desktop, normal full bleed on mobile)
  if (viewMode === 'mobile') {
    return (
      <div className="min-h-screen bg-[#faf9f6] flex flex-col font-sans">


        {/* Central Device Container */}
        <div className="flex-1 flex items-center justify-center p-0 md:p-6 bg-slate-100">
          {/* On Desktop/Tablet, show Simulated iPhone. On Mobile, show Full Bleed Mobile Content */}
          <div className="w-full h-full md:w-[390px] md:h-[820px] md:border-[10px] md:border-slate-900 md:bg-white md:rounded-[44px] md:shadow-2xl overflow-hidden flex flex-col md:ring-4 md:ring-slate-800/10 relative">
            
            {/* iOS Dynamic Island/Notch - Only visible on simulated desktop */}
            <div className="hidden md:flex absolute top-2 left-1/2 transform -translate-x-1/2 w-24 h-5 bg-slate-950 rounded-full z-50 items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-slate-900/40 border border-slate-800/10 ml-auto mr-3"></div>
            </div>

            {/* Speaker Grill */}
            <div className="hidden md:block absolute top-1 left-1/2 transform -translate-x-1/2 w-10 h-0.5 bg-slate-900/20 rounded-full z-50"></div>

            {/* iOS Status Bar - Only visible on simulated desktop */}
            <div className="hidden md:flex h-9 bg-white text-slate-800 pt-2.5 px-6 justify-between items-center text-[10px] font-bold z-40 select-none shrink-0">
              <span className="font-mono">09:41</span>
              <div className="flex items-center space-x-1.5">
                <svg className="w-3 h-3 text-slate-800" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19.4a1 1 0 001.38 1.44l1.83-1.4A8.955 8.955 0 0012 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm0 15c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/></svg>
                <span className="text-[8px]">5G</span>
                <div className="w-4 h-2 border border-slate-800 rounded-xs p-0.5 flex items-center">
                  <div className="h-full w-2.5 bg-slate-800 rounded-3xs"></div>
                </div>
              </div>
            </div>

            {/* Mobile App Viewport */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[#faf9f6] relative">
              {/* Mobile Header */}
              <div className="h-12 bg-white border-b border-slate-100 px-4 flex justify-between items-center shrink-0 z-30 shadow-2xs">
                {['customers', 'objectives', 'notifications', 'staff', 'settings'].includes(activeTab) ? (
                  <button 
                    onClick={() => setActiveTab('mobile-menu')}
                    className="text-slate-600 hover:text-slate-900 flex items-center font-bold text-xs gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4 text-gold-600" />
                    <span>Hệ thống</span>
                  </button>
                ) : (
                  <span className="font-display font-semibold tracking-widest text-gold-900 italic uppercase text-[12px] truncate max-w-[200px]">
                    {studioSettings?.name || 'The Will'}
                  </span>
                )}
                
                <div className="flex items-center space-x-3">
                  <button 
                    onClick={() => setActiveTab('notifications')}
                    className="p-1 text-slate-400 hover:text-slate-600 relative cursor-pointer"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
                    )}
                  </button>
                  <div className="w-6 h-6 rounded-full bg-gold-600 text-white font-bold flex items-center justify-center text-[10px] font-mono select-none">
                    {user?.full_name?.charAt(0).toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Mobile Main Body Area */}
              <div className="flex-1 overflow-y-auto p-4 pb-20 scrollbar-none bg-[#faf9f6]" id="mobile-viewport-scroller">
                {activeTab === 'mobile-menu' ? (
                  /* Mobile system launcher menu */
                  <div className="space-y-5 animate-fade-in">
                    <div className="bg-gradient-to-r from-gold-500/10 to-gold-600/15 p-4 rounded-2xl border border-gold-200/20 text-slate-800">
	                      <p className="text-[9px] uppercase font-bold text-gold-800 tracking-widest mb-1 font-mono">Bảng điều phối</p>
	                      <h3 className="text-sm font-bold text-slate-900 leading-tight">Xin chào, {user?.full_name}</h3>
	                      <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">Mở nhanh hồ sơ, công việc và thông báo cần xử lý.</p>
	                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => handleNavigate('customers')}
                        className="bg-white hover:bg-slate-50/50 p-4 rounded-xl border border-slate-200/50 text-left flex flex-col justify-between h-24 transition-all cursor-pointer shadow-2xs"
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
                        className="bg-white hover:bg-slate-50/50 p-4 rounded-xl border border-slate-200/50 text-left flex flex-col justify-between h-24 transition-all cursor-pointer shadow-2xs"
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
                        className="bg-white hover:bg-slate-50/50 p-4 rounded-xl border border-slate-200/50 text-left flex flex-col justify-between h-24 transition-all cursor-pointer shadow-2xs"
                      >
                        <div className="p-2 bg-rose-50 text-rose-600 rounded-lg w-fit relative">
                          <Bell className="w-4 h-4" />
                          {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-mono text-[8px] px-1.5 py-0.5 rounded-full font-bold scale-75">{unreadCount}</span>
                          )}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-800">Thông báo</h4>
                          <p className="text-[9px] text-slate-400 mt-0.5">Yêu cầu bàn giao</p>
                        </div>
                      </button>

                      {hasPermission('users.manage') && (
                        <button 
                          onClick={() => handleNavigate('staff')}
                          className="bg-white hover:bg-slate-50/50 p-4 rounded-xl border border-slate-200/50 text-left flex flex-col justify-between h-24 transition-all cursor-pointer shadow-2xs"
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
                          className="bg-white hover:bg-slate-50/50 p-4 rounded-xl border border-slate-200/50 text-left flex flex-col justify-between h-24 transition-all cursor-pointer shadow-2xs"
                        >
                          <div className="p-2 bg-slate-100 text-slate-600 rounded-lg w-fit">
                            <SettingsIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-800">Cài đặt</h4>
                            <p className="text-[9px] text-slate-400 mt-0.5">Hồ sơ Studio</p>
                          </div>
                        </button>
                      )}

                      <button 
                        onClick={handleLogout}
                        className="bg-rose-50/50 hover:bg-rose-50 p-4 rounded-xl border border-rose-100 text-left flex flex-col justify-between h-24 transition-all cursor-pointer"
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
                ) : (
                  renderMainContent()
                )}
              </div>

              {/* iOS Bottom Navigation Bar */}
              <div className="absolute bottom-0 inset-x-0 h-16 bg-white border-t border-slate-150 flex justify-around items-center px-1 z-40 shadow-md shrink-0">
                <button 
                  onClick={() => setActiveTab('dashboard')}
                  className={`flex flex-col items-center justify-center space-y-1 py-1.5 flex-1 transition-all cursor-pointer ${
                    activeTab === 'dashboard' ? 'text-gold-600 font-bold scale-105' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <BarChart2 className="w-4.5 h-4.5" />
                  <span className="text-[8.5px] tracking-wide font-semibold">Tổng quan</span>
                </button>

                <button 
                  onClick={() => setActiveTab('orders')}
                  className={`flex flex-col items-center justify-center space-y-1 py-1.5 flex-1 transition-all cursor-pointer ${
                    activeTab === 'orders' ? 'text-gold-600 font-bold scale-105' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Briefcase className="w-4.5 h-4.5" />
                  <span className="text-[8.5px] tracking-wide font-semibold">Hợp đồng</span>
                </button>

                <button 
                  onClick={() => setActiveTab('tasks')}
                  className={`flex flex-col items-center justify-center space-y-1 py-1.5 flex-1 transition-all cursor-pointer ${
                    activeTab === 'tasks' ? 'text-gold-600 font-bold scale-105' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <CheckSquare className="w-4.5 h-4.5" />
                  <span className="text-[8.5px] tracking-wide font-semibold">Công việc</span>
                </button>

                <button 
                  onClick={() => setActiveTab('chat')}
                  className={`flex flex-col items-center justify-center space-y-1 py-1.5 flex-1 transition-all cursor-pointer ${
                    activeTab === 'chat' ? 'text-gold-600 font-bold scale-105' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <MessageSquare className="w-4.5 h-4.5" />
                  <span className="text-[8.5px] tracking-wide font-semibold">Nhắn tin</span>
                </button>

                <button 
                  onClick={() => setActiveTab('mobile-menu')}
                  className={`flex flex-col items-center justify-center space-y-1 py-1.5 flex-1 transition-all cursor-pointer ${
                    ['customers', 'objectives', 'notifications', 'staff', 'settings', 'mobile-menu'].includes(activeTab) 
                      ? 'text-gold-600 font-bold scale-105' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <LayoutGrid className="w-4.5 h-4.5" />
                  <span className="text-[8.5px] tracking-wide font-semibold">Hệ thống</span>
                </button>
              </div>

              {user?.email === 'viet@studio.com' && (
                <ChatWidget userName={user?.full_name} userEmail={user?.email} placement="mobile" />
              )}

            </div>

            {/* iOS Home Indicator - Only visible on simulated desktop */}
            <div className="hidden md:flex h-5 bg-white items-center justify-center pb-1 z-40 select-none shrink-0">
              <div className="w-28 h-1 bg-slate-900 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. PC VIEWPORT RENDER
  return (
    <div className="min-h-screen bg-[#faf9f6] flex flex-col font-sans overflow-hidden">
      <div id="demo-camera-viewport" className="flex-1 flex flex-col md:flex-row min-h-0 w-full h-full origin-center">
        {/* Mobile Header (When browser actually resized small) */}
        <header className="md:hidden bg-white text-slate-800 px-4 py-3 flex justify-between items-center z-20 shadow-xs border-b border-slate-200/60 shrink-0">
          <h1 className="text-base font-semibold tracking-widest font-display text-gold-900 italic uppercase truncate max-w-[200px]">
            {studioSettings?.name || 'The Will'}
          </h1>
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-slate-500 hover:text-slate-800 p-1"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>

        {/* Navigation Sidebar (Desktop & Mobile drawer) */}
        <aside className={`bg-white text-slate-700 w-full md:w-56 shrink-0 p-4 flex flex-col justify-between z-10 md:sticky md:top-[40px] md:h-[calc(100vh-40px)] border-r border-slate-200/80 transition-all duration-300 ${
          mobileMenuOpen ? 'fixed inset-x-0 top-[88px] bottom-0 bg-white' : 'hidden md:flex'
        }`}>
          <div className="space-y-6 flex-1 flex flex-col">
            {/* Logo */}
            <div className="hidden md:block pb-3 border-b border-slate-100">
              <h1 className="text-lg font-semibold tracking-widest font-display text-gold-900 italic uppercase leading-tight line-clamp-2">
                {studioSettings?.name || 'The Will'}
              </h1>
              <p className="text-[8px] text-slate-400 uppercase tracking-widest mt-1 font-medium truncate" title={studioSettings?.notes || 'Luxury Wedding Studio'}>
                {studioSettings?.notes || 'Luxury Wedding Studio'}
              </p>
            </div>

            {/* User profile capsule */}
            <div className="bg-gold-50/60 border border-gold-200/40 rounded-xl p-3 flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-full bg-gold-500 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs font-mono">
                {user?.full_name?.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-xs text-slate-800 truncate leading-tight">{user?.full_name}</p>
                <span className="text-[8px] bg-gold-100 text-gold-700 border border-gold-200/50 rounded px-1.5 py-0.5 mt-1 inline-block uppercase font-bold tracking-wider">
                  {role?.display_name || 'Nhân viên'}
                </span>
              </div>
            </div>

            {/* Nav Items */}
            <nav className="space-y-1 flex-1 overflow-y-auto">
              {filteredMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    data-demo-tab={item.id}
                    className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                      isActive 
                        ? 'bg-gold-100/80 text-gold-900 font-bold border border-gold-200/40 shadow-2xs' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-gold-700' : 'text-slate-400'}`} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.id === 'notifications' && unreadCount > 0 && (
                      <span className="bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center scale-90">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Footer / Logout */}
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất</span>
            </button>
            <p className="text-[8px] text-slate-400 text-center uppercase tracking-widest font-medium">© 2026 The Will Studio</p>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {renderMainContent()}
        </main>
      </div>
      {user?.email === 'viet@studio.com' && <ChatWidget userName={user?.full_name} userEmail={user?.email} />}
      {isDemoActive && (
        <ProductDemoPlayer
          onClose={() => {
            setIsDemoActive(false);
            const url = new URL(window.location.href);
            url.searchParams.delete('demo');
            window.history.replaceState(null, '', url.toString());
          }}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isAuthenticated={isAuthenticated}
          handleQuickLogin={handleQuickLogin}
          handleLogout={handleLogout}
          setViewMode={setViewMode}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full bg-white rounded-2xl border border-amber-200 shadow-xl p-4 flex gap-3 animate-slide-in cursor-pointer hover:border-gold-500 transition-colors"
          onClick={() => {
            setPreviewNotification(toast);
            setToast(null);
          }}
        >
          <div className="w-10 h-10 rounded-full bg-amber-50 shrink-0 flex items-center justify-center text-amber-500">
            <Bell className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-slate-900 truncate">{toast.title}</h4>
            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{toast.content}</p>
          </div>
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setToast(null);
            }}
            className="text-gray-400 hover:text-gray-600 self-start p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {previewNotification && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-slate-950/25 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl animate-slide-in">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <Bell className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Thông báo mới</p>
                <h4 className="mt-1 text-sm font-extrabold text-slate-900 leading-snug">{previewNotification.title}</h4>
              </div>
              <button
                type="button"
                onClick={() => setPreviewNotification(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 whitespace-pre-line">
              {previewNotification.content.length > 220
                ? `${previewNotification.content.slice(0, 220).trim()}...`
                : previewNotification.content}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPreviewNotification(null)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Đóng
              </button>
              {previewNotification.content.length > 220 && (
                <button
                  type="button"
                  onClick={() => handleOpenNotificationDetail(previewNotification.id)}
                  className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700"
                >
                  Xem chi tiết
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
