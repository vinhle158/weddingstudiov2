import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxHeight?: string;
}

export default function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  maxHeight = '85vh'
}: BottomSheetProps) {
  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Sheet Content */}
      <div 
        className="relative bg-white rounded-t-3xl border-t border-slate-200/80 shadow-2xl flex flex-col overflow-hidden transition-all duration-300 animate-slide-up select-none"
        style={{ 
          maxHeight,
          paddingBottom: 'env(safe-area-inset-bottom, 16px)'
        }}
      >
        {/* Drag Indicator handle */}
        <div className="flex justify-center py-2.5 shrink-0">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full" onClick={onClose} />
        </div>

        {/* Header */}
        <div className="px-5 pb-3 flex justify-between items-center border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-slate-800 text-sm tracking-wide">{title}</h3>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 select-text">
          {children}
        </div>
      </div>
    </div>
  );
}
