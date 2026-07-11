import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../lib/api';
import { 
  Bell, 
  Check, 
  Plus, 
  AlertCircle, 
  Calendar, 
  MessageSquare, 
  Clipboard, 
  Send, 
  User as UserIcon,
  Search,
  Sparkles,
  ArrowRight,
  Gift,
  Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NotificationItem {
  id: string;
  sender_id: string;
  sender_name: string;
  receiver_id: string | null;
  title: string;
  content: string;
  type: 'general' | 'task_assignment' | 'order_update' | 'system' | 'anniversary';
  related_id: string | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationsProps {
  userRole?: string;
  userId?: string;
  onNavigate?: (tab: string, arg?: any) => void;
  initialSelectedNotificationId?: string;
}

export default function Notifications({ userRole, userId, onNavigate, initialSelectedNotificationId }: NotificationsProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'notifications' | 'chat'>('notifications');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [pendingNotificationId, setPendingNotificationId] = useState<string | null>(initialSelectedNotificationId || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const notificationRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Announcement form states (Admin/Manager only)
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);

  // Quick reply state for internal chat messages
  const [quickReplyText, setQuickReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replySuccess, setReplySuccess] = useState<string | null>(null);

  const isManagerOrAdmin = userRole === 'admin' || userRole === 'manager';

  const fetchNotificationsAndMessages = async () => {
    try {
      const [notifsData, msgsData] = await Promise.all([
        apiRequest('/api/notifications').catch(() => []),
        apiRequest('/api/chat/dashboard-messages').catch(() => [])
      ]);
      setNotifications(notifsData || []);
      setChatMessages(msgsData || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching notifications or messages:', err);
      setError('Không thể tải danh sách thông báo hoặc tin nhắn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotificationsAndMessages();
    
    // Poll for updates every 20 seconds for a responsive feel
    const interval = setInterval(fetchNotificationsAndMessages, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (initialSelectedNotificationId) {
      setPendingNotificationId(initialSelectedNotificationId);
      setActiveTab('notifications');
    }
  }, [initialSelectedNotificationId]);

  useEffect(() => {
    if (!pendingNotificationId || notifications.length === 0) return;
    const target = notifications.find(n => n.id === pendingNotificationId);
    if (!target) return;

    setActiveTab('notifications');
    setSelectedItem(target);
    setTimeout(() => {
      notificationRefs.current[target.id]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }, 80);
    setPendingNotificationId(null);
  }, [pendingNotificationId, notifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await apiRequest(`/api/notifications/${id}/read`, 'POST');
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
      if (selectedItem && selectedItem.id === id) {
        setSelectedItem((prev: any) => ({ ...prev, is_read: true }));
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiRequest('/api/notifications/read-all', 'POST');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      if (selectedItem && activeTab === 'notifications') {
        setSelectedItem((prev: any) => ({ ...prev, is_read: true }));
      }
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      setSubmitting(true);
      setError(null);
      await apiRequest('/api/notifications', 'POST', { title, content });
      setTitle('');
      setContent('');
      setSuccessMsg('Đăng thông báo chung thành công!');
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchNotificationsAndMessages();
    } catch (err: any) {
      console.error('Error posting announcement:', err);
      setError(err.message || 'Lỗi khi đăng thông báo');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickReplyText.trim() || !selectedItem || sendingReply) return;

    try {
      setSendingReply(true);
      // If Global Chat, receiver_id is null. If Private Chat, reply to sender.
      const receiver_id = selectedItem.receiver_id === null ? null : selectedItem.sender_id;
      
      await apiRequest('/api/chat/messages', 'POST', {
        receiver_id,
        content: quickReplyText.trim()
      });
      setQuickReplyText('');
      setReplySuccess('Gửi phản hồi thành công!');
      setTimeout(() => setReplySuccess(null), 3000);
      
      // Update local state immediately
      const msgsData = await apiRequest('/api/chat/dashboard-messages').catch(() => []);
      setChatMessages(msgsData || []);
    } catch (err) {
      console.error('Error sending quick reply:', err);
    } finally {
      setSendingReply(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6" id="notifications-container">
      {/* Upper header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-wider font-display text-gold-950 italic flex items-center gap-2">
            <Bell className="w-6 h-6 text-gold-600" />
            Trung tâm Thông báo & Điều phối
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Cập nhật thông báo Studio, công việc được bàn giao và tin nhắn khẩn cấp nội bộ.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isManagerOrAdmin && (
            <button
              onClick={() => setShowAnnouncementForm(!showAnnouncementForm)}
              className="bg-gold-600 hover:bg-gold-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              id="btn-toggle-announcement"
            >
              <Plus className="w-4 h-4" />
              {showAnnouncementForm ? 'Đóng form nhập' : 'Tạo thông báo mới'}
            </button>
          )}

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="bg-white border border-gold-200/40 hover:border-gold-300 text-gold-900 hover:bg-gold-50 text-xs font-bold px-4 py-2.5 rounded-xl inline-flex items-center gap-2 transition-all shadow-2xs cursor-pointer"
              id="btn-mark-all-read"
            >
              <Check className="w-4 h-4 text-gold-600" />
              Đã đọc tất cả ({unreadCount})
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-lg text-rose-700 text-sm" id="error-message">
          {error}
        </div>
      )}

      {/* Admin Announcement Input Wizard Panel */}
      <AnimatePresence>
        {isManagerOrAdmin && showAnnouncementForm && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-2xl shadow-xs border border-gold-200/30 p-6 overflow-hidden space-y-4"
            id="announcement-form-box"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-gold-600" />
                <h3 className="font-bold text-gold-950 text-sm uppercase tracking-wide">Tạo thông báo & Bàn giao việc mới</h3>
              </div>
            </div>

            <form onSubmit={handlePostAnnouncement} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Tiêu đề thông báo / Nhiệm vụ
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Ví dụ: Cập nhật ca chụp, sửa ảnh..."
                    className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 outline-hidden transition-all bg-slate-50/40"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Nội dung mô tả chi tiết
                  </label>
                  <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Nhập nội dung chi tiết bàn giao cho các bộ phận..."
                    rows={1}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 outline-hidden transition-all bg-slate-50/40"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                {successMsg ? (
                  <div className="text-emerald-600 text-xs font-semibold flex items-center gap-1.5 animate-pulse">
                    <Check className="w-4 h-4" />
                    {successMsg}
                  </div>
                ) : <div />}

                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-gold-600 hover:bg-gold-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl inline-flex items-center gap-1.5 transition-all shadow-2xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  Đăng thông báo
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => {
            setActiveTab('notifications');
            setSelectedItem(null);
          }}
          className={`px-5 py-3 text-xs font-bold tracking-wider uppercase border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'notifications'
              ? 'border-gold-600 text-gold-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Bell className="w-4 h-4" />
          Thông báo ({notifications.length})
          {unreadCount > 0 && (
            <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold ml-1">
              {unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab('chat');
            setSelectedItem(null);
          }}
          className={`px-5 py-3 text-xs font-bold tracking-wider uppercase border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'chat'
              ? 'border-gold-600 text-gold-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Thảo luận Nội bộ ({chatMessages.length})
        </button>
      </div>

      {/* Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left List Pane */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs italic">Đang tải danh sách...</div>
          ) : activeTab === 'notifications' ? (
	            notifications.length === 0 ? (
	              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-400 text-xs italic">
	                Chưa có thông báo nào.
	              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {notifications.map((notif) => {
                  const isSelected = selectedItem?.id === notif.id;
                  return (
                    <div
                      key={notif.id}
                      ref={(el) => {
                        notificationRefs.current[notif.id] = el;
                      }}
                      onClick={() => setSelectedItem(notif)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex gap-4 ${
                        isSelected
                          ? 'bg-gold-50/40 border-gold-300 shadow-xs'
                          : 'bg-white border-slate-100 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className={`p-2 rounded-lg h-fit ${
                        notif.is_read
                          ? 'bg-slate-100 text-slate-400'
                          : notif.type === 'anniversary'
                            ? 'bg-amber-50 text-amber-700 animate-pulse'
                            : 'bg-gold-50 text-gold-700 animate-pulse'
                      }`}>
                        {notif.type === 'anniversary' ? (
                          <Gift className="w-4 h-4" />
                        ) : (
                          <Bell className="w-4 h-4" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Từ: {notif.sender_name}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">
                            {new Date(notif.created_at).toLocaleString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-slate-850 truncate">{notif.title}</h4>
                        <p className="text-slate-500 text-xs line-clamp-1">{notif.content}</p>
                      </div>

                      <div className="flex flex-col justify-between items-end">
                        {!notif.is_read ? (
                          <span className="bg-rose-50 text-rose-600 text-[9px] font-bold px-1.5 py-0.5 rounded border border-rose-100 uppercase tracking-wider">
                            Mới
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[9px]">Đã đọc</span>
                        )}
                        <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            chatMessages.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-400 text-xs italic">
                Chưa có trao đổi nào gần đây.
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {chatMessages.map((msg) => {
                  const isSelected = selectedItem?.id === msg.id;
                  return (
                    <div
                      key={msg.id}
                      onClick={() => setSelectedItem(msg)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex gap-4 ${
                        isSelected
                          ? 'bg-gold-50/40 border-gold-300 shadow-xs'
                          : 'bg-white border-slate-100 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 h-fit">
                        <MessageSquare className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase tracking-wider block">
                            {msg.sender_name} ({msg.sender_role_name === 'admin' ? 'QUẢN TRỊ' : msg.sender_role_name === 'manager' ? 'QUẢN LÝ' : 'NHÂN VIÊN'})
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">
                            {new Date(msg.created_at).toLocaleString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <p className="text-slate-700 text-xs font-semibold leading-relaxed line-clamp-1">{msg.content}</p>
                        <span className="text-[10px] text-slate-400 block">
                          Kênh: {msg.receiver_id === null ? 'Nhóm chung' : 'Tin nhắn mật'}
                        </span>
                      </div>
                      
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 self-center" />
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Right Detail Pane */}
        <div className="lg:col-span-1">
          {selectedItem ? (
            <div className="bg-white rounded-2xl border border-slate-150 p-6 shadow-sm space-y-5">
              <div className="border-b border-slate-100 pb-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chi tiết</span>
                <h3 className="font-bold text-sm text-slate-900 mt-1">
                  {activeTab === 'notifications' ? selectedItem.title : `Tin nhắn từ ${selectedItem.sender_name}`}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                  Thời gian: {new Date(selectedItem.created_at).toLocaleString('vi-VN')}
                </p>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                  {selectedItem.content}
                </div>

                {activeTab === 'notifications' && selectedItem.type === 'anniversary' && onNavigate && (userRole === 'admin' || userRole === 'manager') && (
                  <button
                    onClick={() => {
                      const matchWedding = selectedItem.related_id.includes('anniversary:wedding');
                      const titleTemplate = matchWedding 
                        ? `Chăm sóc khách hàng: Kỷ niệm ngày cưới` 
                        : `Chăm sóc khách hàng: Sinh nhật / Thôi nôi`;
                      
                      const customerNameMatch = selectedItem.content.match(/Khách hàng (.*?) \(SĐT:/);
                      const customerName = customerNameMatch ? customerNameMatch[1] : 'Khách hàng';

                      const phoneMatch = selectedItem.content.match(/SĐT: (.*?)(?: \| FB:|\))/);
                      const phoneStr = phoneMatch ? phoneMatch[1] : '';

                      const fbMatch = selectedItem.content.match(/FB: (.*?)\)/);
                      const fbStr = fbMatch ? fbMatch[1] : '';

                      const dateMatch = selectedItem.content.match(/vào ngày (.*?)\./);
                      const dateStr = dateMatch ? dateMatch[1] : '';

                      const finalTitle = `${titleTemplate} - ${customerName}`;
                      
                      let contactDetails = `📞 SĐT liên hệ: ${phoneStr}\n`;
                      if (fbStr) {
                        contactDetails += `🌐 Link Facebook: ${fbStr}\n`;
                      } else {
                        contactDetails += `🌐 Link Facebook: Chưa cập nhật\n`;
                      }

                      const finalDesc = `Gọi điện/nhắn tin chúc mừng khách hàng ${customerName}. Gửi lời tri ân và giới thiệu ưu đãi kỷ niệm cưới/sinh nhật của Studio.
\n📌 THÔNG TIN LIÊN HỆ:\n${contactDetails}\n📅 Ngày sự kiện: ${dateStr}.`;

                      onNavigate('tasks', {
                        createTaskTemplate: {
                          title: finalTitle,
                          description: finalDesc
                        }
                      });
                      
                      if (!selectedItem.is_read) {
                        handleMarkAsRead(selectedItem.id);
                      }
                    }}
                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-2xs hover:shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Gift className="w-4 h-4" />
                    Gán việc chăm sóc cho Sale
                  </button>
                )}

                {activeTab === 'notifications' && (
                  <button
                    onClick={() => handleMarkAsRead(selectedItem.id)}
                    disabled={selectedItem.is_read}
                    className="w-full border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold py-2.5 rounded-xl transition-all shadow-2xs disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    {selectedItem.is_read ? 'Đã đọc' : 'Xác nhận đã đọc'}
                  </button>
                )}

                {activeTab === 'chat' && (
                  <div className="space-y-2 border-t border-slate-100 pt-4">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Phản hồi thảo luận
                    </label>
                    <form onSubmit={handleQuickReply} className="space-y-2">
                      <textarea
                        value={quickReplyText}
                        onChange={e => setQuickReplyText(e.target.value)}
                        placeholder={
                          selectedItem.receiver_id === null 
                            ? "Phản hồi công khai gửi lên kênh chung..."
                            : `Phản hồi mật cho ${selectedItem.sender_name}...`
                        }
                        rows={3}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 outline-hidden bg-white resize-none"
                        required
                      />
                      <button
                        type="submit"
                        disabled={sendingReply || !quickReplyText.trim()}
                        className="w-full bg-gold-600 hover:bg-gold-700 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-40 transition-all cursor-pointer"
                      >
                        {sendingReply ? 'Đang gửi...' : 'Gửi câu trả lời'}
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>
                    {replySuccess && (
                      <p className="text-emerald-600 text-[10px] font-bold flex items-center gap-1 mt-1 animate-pulse">
                        ✓ {replySuccess}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400 text-xs italic h-48 flex flex-col items-center justify-center">
              <Sparkles className="w-8 h-8 text-slate-300 mb-2" />
              Chọn một thư/thông báo từ danh sách để xem chi tiết và phản hồi nhanh.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
