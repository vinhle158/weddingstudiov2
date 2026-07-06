import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../../../lib/api';
import { MessageSquare, Send, Hash, ChevronLeft, Search, Sparkles } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role_id: string;
  receiver_id: string | null;
  content: string;
  created_at: string;
}

interface UserContact {
  id: string;
  full_name: string;
  email: string;
  role_id: string;
  role_name: string;
  role_display_name: string;
  is_active: boolean;
}

interface MobileChatProps {
  userId: string;
  userRole: string;
}

export default function MobileChat({ userId, userRole }: MobileChatProps) {
  const [contacts, setContacts] = useState<UserContact[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedReceiverId, setSelectedReceiverId] = useState<string | null>(null); // null is General Chat
  const [content, setContent] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [sending, setSending] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  
  // 'list' or 'chat' views
  const [activeView, setActiveView] = useState<'list' | 'chat'>('list');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isManagerOrAdmin = userRole === 'role-admin' || userRole === 'role-manager';

  const fetchContacts = async () => {
    try {
      setLoadingContacts(true);
      const allUsers = await apiRequest('/api/users');
      const filtered = allUsers.filter((u: any) => {
        if (u.id === userId) return false;
        if (isManagerOrAdmin) return true;
        return u.role_id === 'role-admin' || u.role_id === 'role-manager';
      });
      setContacts(filtered);
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
    } finally {
      setLoadingContacts(false);
    }
  };

  const fetchMessages = async (silent = false) => {
    try {
      if (!silent) setLoadingMessages(true);
      const url = `/api/chat/messages?receiver_id=${selectedReceiverId || 'null'}`;
      const res = await apiRequest(url);
      setMessages(res || []);
    } catch (err) {
      console.error('Error fetching chat messages:', err);
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [userId, userRole]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(() => {
      fetchMessages(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [selectedReceiverId]);

  useEffect(() => {
    if (activeView === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeView]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || sending) return;

    try {
      setSending(true);
      const res = await apiRequest('/api/chat/messages', 'POST', {
        receiver_id: selectedReceiverId,
        content: content.trim()
      });
      setMessages(prev => [...prev, res]);
      setContent('');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const getAvatarColor = (roleId: string) => {
    if (roleId === 'role-admin') return 'bg-rose-500 text-white';
    if (roleId === 'role-manager') return 'bg-amber-500 text-white';
    return 'bg-indigo-500 text-white';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(p => p[0])
      .filter(Boolean)
      .slice(-2)
      .join('')
      .toUpperCase();
  };

  const filteredContacts = contacts.filter(c =>
    c.full_name.toLowerCase().includes(contactSearch.toLowerCase())
  );

  const getReceiverName = () => {
    if (selectedReceiverId === null) return 'Kênh chung (General)';
    const found = contacts.find(c => c.id === selectedReceiverId);
    return found ? found.full_name : 'Trò chuyện';
  };

  if (activeView === 'chat') {
    return (
      <div className="flex flex-col h-[calc(100vh-140px)] bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-xs relative">
        {/* Chat Screen Header */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2 shrink-0">
          <button 
            onClick={() => setActiveView('list')}
            className="p-1 rounded-lg hover:bg-slate-200/50 text-slate-500 cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              {selectedReceiverId === null && <Hash className="w-4 h-4 text-gold-600" />}
              {getReceiverName()}
            </h4>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Trực tuyến</span>
          </div>
        </div>

        {/* Message logs */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
          {loadingMessages ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-gold-500"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs font-medium">Chưa có tin nhắn nào. Bắt đầu cuộc trò chuyện!</div>
          ) : (
            messages.map(msg => {
              const isOwn = msg.sender_id === userId;
              return (
                <div 
                  key={msg.id}
                  className={`flex gap-2.5 max-w-[85%] ${isOwn ? 'ml-auto flex-row-reverse' : ''}`}
                >
                  {!isOwn && (
                    <div className={`w-7 h-7 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0 ${getAvatarColor(msg.sender_role_id)}`}>
                      {getInitials(msg.sender_name)}
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {!isOwn && <p className="text-[8.5px] font-bold text-slate-400 ml-1">{msg.sender_name}</p>}
                    <div className={`p-3 rounded-2xl text-[11px] font-semibold leading-relaxed shadow-3xs ${
                      isOwn 
                        ? 'bg-gold-500 text-white rounded-tr-none' 
                        : 'bg-white text-slate-700 rounded-tl-none border border-slate-150'
                    }`}>
                      {msg.content}
                    </div>
                    <span className={`text-[7px] text-slate-400 font-semibold block ${isOwn ? 'text-right mr-1' : 'ml-1'}`}>
                      {new Date(msg.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Send message form */}
        <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-100 flex gap-2 items-center bg-white shrink-0">
          <input 
            type="text" 
            placeholder="Nhập tin nhắn..." 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 bg-slate-50 border rounded-xl px-3 py-2.5 text-xs focus:outline-none"
            required
          />
          <button 
            type="submit"
            disabled={sending}
            className="bg-gold-500 hover:bg-gold-600 text-white rounded-xl p-2.5 flex items-center justify-center cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Search contacts */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
        <input 
          type="text" 
          placeholder="Tìm đồng nghiệp..." 
          value={contactSearch}
          onChange={(e) => setContactSearch(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-gold-400"
        />
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kênh thảo luận</p>
        
        {/* General Channel item */}
        <div 
          onClick={() => {
            setSelectedReceiverId(null);
            setActiveView('chat');
          }}
          className="bg-white p-4 rounded-xl border border-slate-200/50 shadow-3xs flex justify-between items-center cursor-pointer active:bg-slate-50"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gold-50 text-gold-700 rounded-lg">
              <Hash className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800">Kênh chung (General)</span>
              <p className="text-[9px] text-slate-400 font-medium">Kênh thảo luận công khai nội bộ</p>
            </div>
          </div>
          <ChevronLeft className="w-4 h-4 text-slate-400 rotate-180" />
        </div>

        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pt-2">Tin nhắn cá nhân</p>

        {loadingContacts ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-gold-500"></div>
          </div>
        ) : filteredContacts.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">Không tìm thấy ai</p>
        ) : (
          filteredContacts.map(c => (
            <div 
              key={c.id}
              onClick={() => {
                setSelectedReceiverId(c.id);
                setActiveView('chat');
              }}
              className="bg-white p-4 rounded-xl border border-slate-200/50 shadow-3xs flex justify-between items-center cursor-pointer active:bg-slate-50"
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${getAvatarColor(c.role_id)}`}>
                  {getInitials(c.full_name)}
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800">{c.full_name}</span>
                  <p className="text-[9px] text-slate-400 font-semibold uppercase">{c.role_display_name}</p>
                </div>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400 rotate-180" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
