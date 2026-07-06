import React from 'react';
import { Bell, ChevronLeft } from 'lucide-react';

interface MobileHeaderProps {
  title: string;
  studioName?: string;
  unreadCount: number;
  userInitial: string;
  onNotificationClick: () => void;
  onProfileClick?: () => void;
  showBackButton?: boolean;
  onBackClick?: () => void;
}

export default function MobileHeader({
  title,
  studioName = 'The Will',
  unreadCount,
  userInitial,
  onNotificationClick,
  onProfileClick,
  showBackButton,
  onBackClick
}: MobileHeaderProps) {
  return (
    <header className="h-14 bg-white border-b border-slate-100 px-4 flex justify-between items-center shrink-0 z-30 shadow-2xs sticky top-0">
      <div className="flex items-center gap-2 min-w-0">
        {showBackButton && (
          <button 
            onClick={onBackClick}
            className="p-1 -ml-1 rounded-lg hover:bg-slate-100 text-slate-500 active:scale-95 transition-transform cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-5 h-5 text-gold-600" />
          </button>
        )}
        <div className="flex flex-col min-w-0">
          <span className="font-display font-semibold tracking-widest text-gold-900 italic uppercase text-[12px] truncate max-w-[150px]">
            {studioName}
          </span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider -mt-0.5 truncate">
            {title}
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-3.5">
        <button
          onClick={onNotificationClick}
          className="p-1.5 rounded-full hover:bg-slate-50 text-slate-400 hover:text-slate-600 relative cursor-pointer transition-colors"
        >
          <Bell className="w-4.5 h-4.5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>
          )}
        </button>

        <div
          onClick={onProfileClick}
          className="w-7 h-7 rounded-full bg-gold-600 hover:bg-gold-700 text-white font-bold flex items-center justify-center text-[11px] font-mono select-none cursor-pointer transition-colors"
        >
          {userInitial}
        </div>
      </div>
    </header>
  );
}
