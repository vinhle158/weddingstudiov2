import React from 'react';
import { BarChart2, Activity, Briefcase, CheckSquare, LayoutGrid } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  unreadNotifications?: number;
  hasPermission: (permission: string) => boolean;
}

export default function BottomNav({
  activeTab,
  onTabChange,
  unreadNotifications = 0,
  hasPermission
}: BottomNavProps) {
  const tabs = [
    { id: 'dashboard', label: 'Tổng quan', icon: BarChart2, permission: 'tasks.view_own' },
    { id: 'leads', label: 'Tư vấn', icon: Activity, permission: 'leads.manage' },
    { id: 'orders', label: 'Đơn hàng', icon: Briefcase, permission: 'orders.view' },
    { id: 'tasks', label: 'Công việc', icon: CheckSquare, permission: 'tasks.view_own' },
    { id: 'menu', label: 'Hệ thống', icon: LayoutGrid, permission: 'tasks.view_own' }
  ];

  const visibleTabs = tabs.filter(t => hasPermission(t.permission));

  return (
    <div className="bg-white border-t border-slate-150 flex justify-around items-center px-2 z-40 shadow-lg shrink-0 h-16 pb-safe">
      {visibleTabs.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id || (tab.id === 'menu' && ['customers', 'objectives', 'notifications', 'staff', 'settings'].includes(activeTab));

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center space-y-1.5 py-1.5 flex-1 transition-all duration-200 cursor-pointer relative ${
              isActive 
                ? 'text-gold-600 font-bold scale-105' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Icon className="w-5 h-5 transition-transform duration-200 active:scale-95" />
            <span className="text-[9px] tracking-wide font-medium">{tab.label}</span>

            {/* Notifications badge for Menu tab or custom badging */}
            {tab.id === 'menu' && unreadNotifications > 0 && (
              <span className="absolute top-1 right-4 bg-rose-500 text-white font-mono text-[8px] px-1 rounded-full font-bold scale-90 border border-white">
                {unreadNotifications}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
