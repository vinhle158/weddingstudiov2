import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../../lib/api';
import BottomSheet from '../shared/BottomSheet';
import { 
  Bell, 
  Check, 
  Plus, 
  AlertCircle, 
  Calendar, 
  Megaphone,
  User,
  Sparkles
} from 'lucide-react';

interface NotificationItem {
  id: string;
  sender_id: string;
  sender_name: string;
  receiver_id: string | null;
  title: string;
  content: string;
  type: 'general' | 'task_assignment' | 'order_update' | 'system';
  related_id: string | null;
  is_read: boolean;
  created_at: string;
}

interface MobileNotificationsProps {
  userId: string;
  userRole: string;
  onRefresh?: () => void;
}

export default function MobileNotifications({ userId, userRole, onRefresh }: MobileNotificationsProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotif, setSelectedNotif] = useState<NotificationItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAnnounceOpen, setIsAnnounceOpen] = useState(false);

  // Announcement Form
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [submittingAnn, setSubmittingAnn] = useState(false);

  const isAdmin = userRole === 'role-admin' || userRole === 'role-manager';

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/api/notifications');
      setNotifications(data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleSelectNotification = async (notif: NotificationItem) => {
    setSelectedNotif(notif);
    setIsDetailOpen(true);
    if (!notif.is_read) {
      try {
        await apiRequest(`/api/notifications/${notif.id}/read`, 'POST');
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
        if (onRefresh) onRefresh();
      } catch (err) {
        console.error('Error marking as read:', err);
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiRequest('/api/notifications/read-all', 'POST');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      if (onRefresh) onRefresh();
      alert('Đã đánh dấu đọc tất cả!');
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) return;

    try {
      setSubmittingAnn(true);
      await apiRequest('/api/notifications/announce', 'POST', {
        title: annTitle,
        content: annContent
      });

      alert('Đăng thông báo thành công!');
      setIsAnnounceOpen(false);
      setAnnTitle('');
      setAnnContent('');
      fetchNotifications();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err.message || 'Lỗi đăng thông báo');
    } finally {
      setSubmittingAnn(false);
    }
  };

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'task_assignment': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'order_update': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'system': return 'bg-rose-50 text-rose-700 border-rose-100';
      default: return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Top Actions */}
      <div className="flex justify-between items-center">
        <button
          onClick={handleMarkAllRead}
          className="text-xs font-bold text-gold-700 hover:text-gold-800 bg-gold-50/50 border border-gold-200/40 px-3 py-1.5 rounded-lg cursor-pointer"
        >
          Đọc tất cả
        </button>

        {isAdmin && (
          <button
            onClick={() => setIsAnnounceOpen(true)}
            className="bg-gradient-to-r from-gold-500 to-gold-600 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thông báo chung</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-gold-500"></div>
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white p-6 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs py-10">
          Hộp thư thông báo trống
        </div>
      ) : (
        <div className="space-y-2.5">
          {notifications.map(notif => (
            <div
              key={notif.id}
              onClick={() => handleSelectNotification(notif)}
              className={`bg-white p-4 rounded-xl border border-slate-200/50 shadow-3xs flex items-start gap-3 cursor-pointer active:bg-slate-50 ${!notif.is_read ? 'border-l-4 border-l-gold-500' : ''}`}
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[8.5px] px-1.5 py-0.2 rounded font-bold uppercase border ${getTypeStyle(notif.type)}`}>
                    {notif.type}
                  </span>
                  <span className="text-[9px] text-slate-400 font-bold">{new Date(notif.created_at).toLocaleDateString('vi-VN')}</span>
                </div>
                <h4 className="text-xs font-bold text-slate-800 truncate">{notif.title}</h4>
                <p className="text-[10px] text-slate-500 truncate">{notif.content}</p>
              </div>
              {!notif.is_read && (
                <span className="w-2.5 h-2.5 bg-gold-600 rounded-full shrink-0 mt-2"></span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* DETAIL BOTTOM SHEET */}
      <BottomSheet
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title="Nội dung thông báo"
      >
        {selectedNotif && (
          <div className="space-y-4">
            <div className="space-y-1 pb-3 border-b border-slate-100">
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase border ${getTypeStyle(selectedNotif.type)}`}>
                {selectedNotif.type}
              </span>
              <h4 className="text-sm font-bold text-slate-800 mt-2">{selectedNotif.title}</h4>
              <p className="text-[9px] text-slate-400 font-bold">Người gửi: {selectedNotif.sender_name} · {new Date(selectedNotif.created_at).toLocaleString('vi-VN')}</p>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-lg border text-xs text-slate-700 leading-relaxed font-semibold">
              {selectedNotif.content}
            </div>
          </div>
        )}
      </BottomSheet>

      {/* ANNOUNCEMENT BOTTOM SHEET */}
      <BottomSheet
        isOpen={isAnnounceOpen}
        onClose={() => setIsAnnounceOpen(false)}
        title="Đăng thông báo chung mới"
      >
        <form onSubmit={handlePostAnnouncement} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tiêu đề thông báo</label>
            <input
              type="text"
              placeholder="VD: Cập nhật quy trình bàn giao"
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-xs focus:outline-none"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nội dung chi tiết</label>
            <textarea
              placeholder="Nhập nội dung thông báo gửi đến toàn thể nhân sự..."
              value={annContent}
              onChange={(e) => setAnnContent(e.target.value)}
              rows={4}
              className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-xs focus:outline-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submittingAnn}
            className="w-full bg-gradient-to-r from-gold-500 to-gold-600 text-white font-bold py-2.5 rounded-xl text-xs shadow-md flex items-center justify-center gap-1.5"
          >
            <Megaphone className="w-4 h-4" />
            <span>Đăng thông báo</span>
          </button>
        </form>
      </BottomSheet>
    </div>
  );
}
