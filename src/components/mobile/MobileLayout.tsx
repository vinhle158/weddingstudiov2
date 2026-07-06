import React from 'react';
import MobileHeader from './shared/MobileHeader';
import BottomNav from './shared/BottomNav';

interface MobileLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  studioSettings?: any;
  unreadNotifications: number;
  user: any;
  role: any;
  hasPermission: (permission: string) => boolean;
  title: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
  assistantSlot?: React.ReactNode;
}

export default function MobileLayout({
  children,
  activeTab,
  onTabChange,
  studioSettings,
  unreadNotifications,
  user,
  role,
  hasPermission,
  title,
  showBackButton,
  onBackClick,
  assistantSlot
}: MobileLayoutProps) {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#faf9f6] w-full max-w-md mx-auto relative border-x border-slate-100">
      {/* Header */}
      <MobileHeader
        title={title}
        studioName={studioSettings?.name}
        unreadCount={unreadNotifications}
        userInitial={user?.full_name?.charAt(0).toUpperCase() || 'U'}
        onNotificationClick={() => onTabChange('notifications')}
        onProfileClick={() => onTabChange('settings')}
        showBackButton={showBackButton}
        onBackClick={onBackClick}
      />

      {/* Main Content scrollable */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24 scroll-smooth">
        {children}
      </main>

      {assistantSlot}

      {/* Navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={onTabChange}
        unreadNotifications={unreadNotifications}
        hasPermission={hasPermission}
      />
    </div>
  );
}
