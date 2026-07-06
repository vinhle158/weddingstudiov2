import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../lib/api';
import { MessageSquare, Send, Hash, User as UserIcon, Shield, Search, Sparkles, ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';

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

interface ChatProps {
  userId?: string;
  userRole?: string;
  isMobile?: boolean;
}

export default function Chat({ userId, userRole, isMobile }: ChatProps) {
  const [contacts, setContacts] = useState<UserContact[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedReceiverId, setSelectedReceiverId] = useState<string | null>(null); // null means General
  const [content, setContent] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [sending, setSending] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [mobileActiveView, setMobileActiveView] = useState<'list' | 'chat'>('list');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isManagerOrAdmin = userRole === 'admin' || userRole === 'manager';

  // Fetch private chat contacts
  const fetchContacts = async () => {
    try {
      setLoadingContacts(true);
      const allUsers = await apiRequest('/api/users');
      // Filter contacts: 
      // - Admin/Manager can see everyone (excluding themselves)
      // - Employees can only see Admins/Managers (role-admin, role-manager) to message them privately
      const filtered = allUsers.filter((u: any) => {
        if (u.id === userId) return false;
        if (isManagerOrAdmin) {
          return true; // Admin/Manager can chat with anyone
        } else {
          return u.role_id === 'role-admin' || u.role_id === 'role-manager'; // Employee can only see admins/managers
        }
      });
      setContacts(filtered);
    } catch (err) {
      console.error('Error fetching contacts:', err);
    } finally {
      setLoadingContacts(false);
    }
  };

  // Fetch messages for the currently selected channel
  const fetchMessages = async (silent = false) => {
    try {
      if (!silent) setLoadingMessages(true);
      const url = `/api/chat/messages?receiver_id=${selectedReceiverId || 'null'}`;
      const res = await apiRequest(url);
      setMessages(res);
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
    
    // Poll for new messages every 15 seconds for active feel
    const interval = setInterval(() => {
      fetchMessages(true);
    }, 15000);
    
    return () => clearInterval(interval);
  }, [selectedReceiverId]);

  // Scroll to bottom on messages load/update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    if (roleId === 'role-staff' || roleId === 'role-photographer' || roleId === 'role-editor') return 'bg-indigo-500 text-white';
    return 'bg-emerald-500 text-white';
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

  const selectedContact = contacts.find(c => c.id === selectedReceiverId);

  return (
    <div className={`max-w-6xl mx-auto ${isMobile ? 'h-full w-full' : 'h-[calc(100vh-140px)]'} flex flex-col md:flex-row bg-white ${!isMobile ? 'rounded-2xl shadow-2xs border border-gold-200/30' : ''} overflow-hidden`} id="chat-system">
      
      {/* Sidebar - Contacts & Channels */}
      {(!isMobile || mobileActiveView === 'list') && (
        <div className="w-full md:w-80 border-r border-slate-200 flex flex-col bg-slate-50/50 h-full" id="chat-sidebar">
          {/* Header */}
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-semibold text-gold-950 text-lg flex items-center gap-2 font-display italic tracking-wider">
              <MessageSquare className="w-5 h-5 text-gold-600" />
              Trò chuyện nội bộ
            </h3>
            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">Kết nối nhanh với nhân sự trong Studio</p>
          </div>

          {/* Channel / Groups section */}
          <div className="p-3 border-b border-slate-200">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">Kênh chung</p>
            <button
              onClick={() => {
                setSelectedReceiverId(null);
                if (isMobile) setMobileActiveView('chat');
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-colors duration-150 ${
                selectedReceiverId === null
                  ? 'bg-gold-100/80 text-gold-900 border border-gold-200/40'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
              id="channel-general-btn"
            >
              <Hash className={`w-4 h-4 ${selectedReceiverId === null ? 'text-gold-600' : 'text-slate-400'}`} />
              <span>Kênh chung toàn Studio</span>
            </button>
          </div>

          {/* Private Messages Section */}
          <div className="flex-grow flex flex-col min-h-0 overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tin nhắn riêng</p>
            </div>

            <div className="relative px-5 pb-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-8 top-2.5" />
              <input
                type="text"
                value={contactSearch}
                onChange={e => setContactSearch(e.target.value)}
                placeholder="Tìm kiếm nhân sự..."
                className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 outline-hidden transition-all"
              />
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1 scrollbar-none">
              {loadingContacts && contacts.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400">Đang tải danh sách...</div>
              ) : filteredContacts.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400">Không tìm thấy ai</div>
              ) : (
                filteredContacts.map(contact => (
                  <button
                    key={contact.id}
                    onClick={() => {
                      setSelectedReceiverId(contact.id);
                      if (isMobile) setMobileActiveView('chat');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-left ${
                      selectedReceiverId === contact.id
                        ? 'bg-gold-50/80 border-l-3 border-gold-500 text-gold-950 font-semibold'
                        : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                    }`}
                    id={`contact-item-${contact.id}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono shadow-xs ${getAvatarColor(contact.role_id)}`}>
                      {getInitials(contact.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate leading-tight">{contact.full_name}</p>
                      <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{contact.role_display_name}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      {(!isMobile || mobileActiveView === 'chat') && (
        <div className="flex-grow flex flex-col bg-slate-50/20 h-full min-h-0" id="chat-main-area">
          {/* Chat Area Header */}
          <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              {isMobile && (
                <button
                  onClick={() => setMobileActiveView('list')}
                  className="p-1.5 -ml-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-gold-600 transition-colors mr-1"
                >
                  <ChevronLeft className="w-5 h-5 text-gold-600" />
                </button>
              )}
              {selectedReceiverId === null ? (
                <>
                  <div className="w-9 h-9 bg-gold-50 text-gold-600 rounded-full flex items-center justify-center border border-gold-100">
                    <Hash className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Kênh chung toàn Studio</h4>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Mọi nhân sự đều có thể đọc và gửi tin nhắn</p>
                  </div>
                </>
              ) : (
                <>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${selectedContact ? getAvatarColor(selectedContact.role_id) : 'bg-gold-600 text-white'}`}>
                    {selectedContact ? getInitials(selectedContact.full_name) : 'PM'}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">{selectedContact?.full_name}</h4>
                    <span className="text-[9px] bg-gold-50 text-gold-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-gold-200/40">
                      {selectedContact?.role_display_name}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4" id="chat-messages-container">
          {loadingMessages && messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-gold-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
              <MessageSquare className="w-10 h-10 stroke-1 text-gold-400" />
              <p className="text-sm">Chưa có tin nhắn nào. Bắt đầu cuộc trò chuyện!</p>
            </div>
          ) : (
            messages.map((m, idx) => {
              const isMe = m.sender_id === userId;
              return (
                <div
                  key={m.id}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-start gap-2.5 max-w-[85%] ${
                    isMe ? 'ml-auto' : 'mr-auto'
                  }`}
                  id={`message-bubble-${m.id}`}
                >
                  {!isMe && (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono shadow-xs ${getAvatarColor(m.sender_role_id)}`}>
                      {getInitials(m.sender_name)}
                    </div>
                  )}

                  <div className="space-y-0.5">
                    {!isMe && (
                      <span className="text-[10px] text-slate-400 font-semibold ml-1">
                        {m.sender_name}
                      </span>
                    )}
                    <div className={`rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                      isMe 
                        ? 'bg-gold-500 text-white rounded-tr-xs shadow-2xs' 
                        : 'bg-white text-slate-800 border border-slate-200/60 shadow-xs rounded-tl-xs'
                    }`}>
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                    <span className={`text-[9px] text-slate-400 block px-1 ${isMe ? 'text-right' : 'text-left'}`}>
                      {new Date(m.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Box */}
        <div className="p-4 bg-white border-t border-slate-200">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Nhập nội dung tin nhắn..."
              className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 transition-all duration-150 bg-slate-50/50"
              required
              id="chat-input-field"
            />
            <button
              type="submit"
              disabled={!content.trim() || sending}
              className="bg-gold-600 hover:bg-gold-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl p-2.5 flex items-center justify-center transition-colors duration-150 shadow-xs"
              id="chat-send-btn"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    )}
  </div>
);
}
