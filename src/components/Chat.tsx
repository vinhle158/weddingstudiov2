import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiRequest, apiRequestBlob } from '../lib/api';
import { MessageSquare, Send, Hash, Search, ChevronLeft, RefreshCw, WifiOff, ArrowDown, Paperclip, Camera, AtSign, Link2, X, Briefcase, UserRound } from 'lucide-react';
import { io } from 'socket.io-client';

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role_id: string;
  receiver_id: string | null;
  content: string;
  created_at: string;
  attachment_filename?: string | null;
  attachment_name?: string | null;
  attachment_mime?: string | null;
  reference_type?: 'task' | 'customer' | null;
  reference_id?: string | null;
  reference_label?: string | null;
  mentioned_user_ids?: string[];
  client_status?: 'sending' | 'sent' | 'failed';
}

interface ChatReference {
  type: 'task' | 'customer';
  id: string;
  label: string;
  subtitle: string;
}

interface PendingAttachment {
  filename: string;
  name: string;
  mime: string;
}

interface UnreadSummary {
  general: number;
  direct: Record<string, number>;
  total: number;
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
  onNavigate?: (tab: string, arg?: any) => void;
}

function ProtectedChatImage({ filename, alt }: { filename: string; alt: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let objectUrl = '';
    apiRequestBlob(`/api/chat/attachments/${filename}`)
      .then(blob => {
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(err => console.error('Không thể tải ảnh chat:', err));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [filename]);
  return src
    ? <img src={src} alt={alt} className="mt-2 max-h-72 max-w-full rounded-xl object-contain bg-slate-100" />
    : <div className="mt-2 h-28 w-48 rounded-xl bg-slate-100 animate-pulse" aria-label="Đang tải ảnh" />;
}

export default function Chat({ userId, isMobile, onNavigate }: ChatProps) {
  const [contacts, setContacts] = useState<UserContact[]>([]);
  const [mentionableUsers, setMentionableUsers] = useState<UserContact[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedReceiverId, setSelectedReceiverId] = useState<string | null>(null); // null means General
  const [content, setContent] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [unread, setUnread] = useState<UnreadSummary>({ general: 0, direct: {}, total: 0 });
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [selectedReference, setSelectedReference] = useState<ChatReference | null>(null);
  const [referenceSearch, setReferenceSearch] = useState('');
  const [referenceResults, setReferenceResults] = useState<ChatReference[]>([]);
  const [showReferencePicker, setShowReferencePicker] = useState(false);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [mobileActiveView, setMobileActiveView] = useState<'list' | 'chat'>('list');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const selectedReceiverRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch private chat contacts
  const fetchContacts = async () => {
    try {
      setLoadingContacts(true);
      const [chatContacts, usersForMentions] = await Promise.all([
        apiRequest<UserContact[]>('/api/chat/contacts'),
        apiRequest<UserContact[]>('/api/chat/mentionable-users'),
      ]);
      setContacts(chatContacts);
      setMentionableUsers(usersForMentions);
    } catch (err) {
      console.error('Error fetching contacts:', err);
    } finally {
      setLoadingContacts(false);
    }
  };

  // Fetch messages for the currently selected channel
  const updateMessage = useCallback((message: ChatMessage) => {
    setMessages(previous => {
      const existingIndex = previous.findIndex(item => item.id === message.id);
      if (existingIndex === -1) return [...previous, { ...message, client_status: 'sent' }];
      const next = [...previous];
      next[existingIndex] = { ...next[existingIndex], ...message, client_status: 'sent' };
      return next;
    });
  }, []);

  const fetchUnread = useCallback(async () => {
    try {
      setUnread(await apiRequest<UnreadSummary>('/api/chat/unread'));
    } catch (err) {
      console.error('Error fetching unread chat state:', err);
    }
  }, []);

  const markConversationRead = useCallback(async (receiverId: string | null) => {
    try {
      await apiRequest('/api/chat/read', 'POST', { receiver_id: receiverId });
      setUnread(previous => {
        if (receiverId === null) return { ...previous, general: 0, total: Math.max(0, previous.total - previous.general) };
        const removed = previous.direct[receiverId] || 0;
        const direct = { ...previous.direct, [receiverId]: 0 };
        return { ...previous, direct, total: Math.max(0, previous.total - removed) };
      });
    } catch (err) {
      console.error('Error marking chat as read:', err);
    }
  }, []);

  const fetchMessages = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingMessages(true);
      const receiverId = selectedReceiverRef.current;
      const url = `/api/chat/messages?receiver_id=${receiverId || 'null'}`;
      const res = await apiRequest(url);
      if (selectedReceiverRef.current === receiverId) {
        setMessages(res);
        await markConversationRead(receiverId);
      }
    } catch (err) {
      console.error('Error fetching chat messages:', err);
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, [markConversationRead]);

  useEffect(() => {
    fetchContacts();
  }, [userId]);

  useEffect(() => {
    selectedReceiverRef.current = selectedReceiverId;
    setNewMessageCount(0);
    fetchMessages();
  }, [selectedReceiverId, fetchMessages]);

  useEffect(() => {
    fetchUnread();
    const token = localStorage.getItem('studio_token');
    if (!token) return;
    const socket = io({ path: '/socket.io', auth: { token }, transports: ['websocket', 'polling'] });
    socket.on('connect', () => {
      setConnectionStatus('connected');
      fetchMessages(true);
      fetchUnread();
    });
    socket.on('disconnect', () => setConnectionStatus('disconnected'));
    socket.on('connect_error', () => setConnectionStatus('disconnected'));
    socket.on('chat:message', (message: ChatMessage) => {
      const activeReceiverId = selectedReceiverRef.current;
      const belongsToActiveConversation = activeReceiverId === null
        ? message.receiver_id === null
        : (message.sender_id === userId && message.receiver_id === activeReceiverId)
          || (message.sender_id === activeReceiverId && message.receiver_id === userId);

      if (belongsToActiveConversation) {
        const container = messagesContainerRef.current;
        const nearBottom = !container || container.scrollHeight - container.scrollTop - container.clientHeight < 120;
        updateMessage(message);
        if (message.sender_id !== userId) markConversationRead(activeReceiverId);
        if (!nearBottom) setNewMessageCount(count => count + 1);
      } else {
        fetchUnread();
      }
    });
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [fetchMessages, fetchUnread, markConversationRead, updateMessage, userId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (connectionStatus !== 'connected') {
        fetchMessages(true);
        fetchUnread();
      }
    }, 30000);
    return () => window.clearInterval(interval);
  }, [connectionStatus, fetchMessages, fetchUnread]);

  // Scroll to bottom on messages load/update
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || container.scrollHeight - container.scrollTop - container.clientHeight < 180) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 112)}px`;
  }, [content]);

  useEffect(() => {
    if (!showReferencePicker || referenceSearch.trim().length < 2) {
      setReferenceResults([]);
      return;
    }
    const timeout = window.setTimeout(async () => {
      try {
        setReferenceResults(await apiRequest<ChatReference[]>(`/api/chat/references?q=${encodeURIComponent(referenceSearch.trim())}`));
      } catch (err) {
        console.error('Không thể tìm hồ sơ để gắn:', err);
      }
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [referenceSearch, showReferencePicker]);

  const uploadDataUrl = async (dataUrl: string, name: string) => {
    setUploading(true);
    setSendError('');
    try {
      const attachment = await apiRequest<PendingAttachment>('/api/chat/attachments', 'POST', { data_url: dataUrl, name });
      setPendingAttachment(attachment);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Không thể tải ảnh lên');
    } finally {
      setUploading(false);
    }
  };

  const handleImageFile = (file?: File) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setSendError('Chỉ hỗ trợ ảnh PNG, JPEG hoặc WebP nhỏ hơn 5 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') void uploadDataUrl(reader.result, file.name); };
    reader.onerror = () => setSendError('Không thể đọc ảnh đã chọn');
    reader.readAsDataURL(file);
  };

  const captureScreen = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setSendError('Trình duyệt này không hỗ trợ chụp màn hình');
      return;
    }
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1920 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      await uploadDataUrl(dataUrl, `anh-chup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') return;
      setSendError('Không thể chụp màn hình');
    } finally {
      stream?.getTracks().forEach(track => track.stop());
    }
  };

  const updateMentionQuery = (value: string) => {
    setContent(value);
    const match = value.match(/(?:^|\s)@([^@\s]*)$/);
    setMentionQuery(match ? match[1].toLocaleLowerCase('vi-VN') : null);
  };

  const insertMention = (contact: UserContact) => {
    setContent(previous => previous.replace(/@[^@\s]*$/, `@${contact.full_name} `));
    setMentionedUserIds(previous => previous.includes(contact.id) ? previous : [...previous, contact.id]);
    setMentionQuery(null);
  };

  const visibleMentionContacts = mentionQuery === null ? [] : mentionableUsers
    .filter(contact => selectedReceiverId === null || contact.id === selectedReceiverId)
    .filter(contact => contact.full_name.toLocaleLowerCase('vi-VN').includes(mentionQuery))
    .slice(0, 6);

  const sendMessage = async (messageContent: string, failedMessage?: ChatMessage) => {
    if (sending) return;
    const attachment = failedMessage?.attachment_filename ? {
      filename: failedMessage.attachment_filename,
      name: failedMessage.attachment_name || 'Ảnh chụp',
      mime: failedMessage.attachment_mime || 'image/png',
    } : pendingAttachment;
    const reference = failedMessage?.reference_id ? {
      type: failedMessage.reference_type!, id: failedMessage.reference_id,
      label: failedMessage.reference_label || failedMessage.reference_id, subtitle: '',
    } : selectedReference;
    const mentions = failedMessage?.mentioned_user_ids || mentionedUserIds;
    if (!messageContent.trim() && !attachment && !reference) return;
    const temporaryId = failedMessage?.id || `pending-${crypto.randomUUID()}`;
    const optimisticMessage: ChatMessage = {
      id: temporaryId,
      sender_id: userId || '',
      sender_name: 'Bạn',
      sender_role_id: '',
      receiver_id: selectedReceiverId,
      content: messageContent.trim(),
      attachment_filename: attachment?.filename || null,
      attachment_name: attachment?.name || null,
      attachment_mime: attachment?.mime || null,
      reference_type: reference?.type || null,
      reference_id: reference?.id || null,
      reference_label: reference ? `${reference.label}${reference.subtitle ? ` · ${reference.subtitle}` : ''}` : null,
      mentioned_user_ids: mentions,
      created_at: new Date().toISOString(),
      client_status: 'sending',
    };
    setMessages(previous => failedMessage
      ? previous.map(item => item.id === failedMessage.id ? optimisticMessage : item)
      : [...previous, optimisticMessage]);
    setSendError('');
    try {
      setSending(true);
      const res = await apiRequest<ChatMessage>('/api/chat/messages', 'POST', {
        receiver_id: selectedReceiverId,
        content: messageContent.trim(),
        attachment_filename: attachment?.filename,
        attachment_name: attachment?.name,
        attachment_mime: attachment?.mime,
        reference_type: reference?.type,
        reference_id: reference?.id,
        mentioned_user_ids: mentions,
      });
      setMessages(previous => previous.filter(item => item.id !== temporaryId));
      updateMessage(res);
      setContent('');
      setPendingAttachment(null);
      setSelectedReference(null);
      setMentionedUserIds([]);
    } catch (err) {
      console.error('Error sending message:', err);
      setMessages(previous => previous.map(item => item.id === temporaryId ? { ...item, client_status: 'failed' } : item));
      setSendError(err instanceof Error ? err.message : 'Không thể gửi tin nhắn');
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage(content);
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
    <div className={`${isMobile ? 'h-full w-full' : 'max-w-7xl mx-auto h-[calc(100vh-140px)] rounded-3xl shadow-sm border border-slate-200/80'} flex flex-col md:flex-row bg-white overflow-hidden`} id="chat-system">
      
      {/* Sidebar - Contacts & Channels */}
      {(!isMobile || mobileActiveView === 'list') && (
        <div className={`${isMobile ? 'w-full bg-white' : 'w-88 bg-slate-50/70'} border-r border-slate-200 flex flex-col h-full min-h-0`} id="chat-sidebar">
          {/* Header */}
          {isMobile ? (
            <div className="h-14 px-3 border-b border-slate-200 bg-white flex items-center gap-2 shrink-0">
              <button type="button" onClick={() => onNavigate?.('menu')} aria-label="Quay lại menu" className="w-9 h-9 rounded-full flex items-center justify-center text-slate-600 active:bg-slate-100">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 text-base leading-tight">Tin nhắn</h3>
                <p className="text-[10px] text-slate-400">Nội bộ The Will Studio</p>
              </div>
            </div>
          ) : (
            <div className="p-5 border-b border-slate-200 bg-white">
              <h3 className="font-semibold text-gold-950 text-lg flex items-center gap-2 font-display italic tracking-wider">
                <MessageSquare className="w-5 h-5 text-gold-600" />
                Trò chuyện nội bộ
              </h3>
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">Kết nối nhanh với nhân sự trong Studio</p>
            </div>
          )}

          {/* Channel / Groups section */}
          <div className={`${isMobile ? 'px-4 pt-4 pb-3' : 'p-3'} border-b border-slate-200`}>
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
              {unread.general > 0 && (
                <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center">
                  {unread.general > 99 ? '99+' : unread.general}
                </span>
              )}
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
                    {(unread.direct[contact.id] || 0) > 0 && (
                      <span className="min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center">
                        {unread.direct[contact.id] > 99 ? '99+' : unread.direct[contact.id]}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      {(!isMobile || mobileActiveView === 'chat') && (
        <div className="flex-grow flex flex-col bg-[#f8f8f7] h-full min-h-0 min-w-0" id="chat-main-area">
          {/* Chat Area Header */}
          <div className={`${isMobile ? 'px-3 py-2.5' : 'px-5 py-3.5'} bg-white/95 backdrop-blur border-b border-slate-200 flex items-center justify-between shrink-0 z-10`}>
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

          {connectionStatus !== 'connected' && (
            <div className={`px-4 py-2 text-xs flex items-center justify-center gap-2 border-b ${
              connectionStatus === 'connecting'
                ? 'bg-amber-50 text-amber-700 border-amber-100'
                : 'bg-rose-50 text-rose-700 border-rose-100'
            }`} role="status">
              {connectionStatus === 'connecting' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <WifiOff className="w-3.5 h-3.5" />}
              {connectionStatus === 'connecting' ? 'Đang kết nối trò chuyện…' : 'Mất kết nối realtime — hệ thống sẽ tự tải lại tin nhắn'}
            </div>
          )}

        {/* Messages List */}
        <div ref={messagesContainerRef} className={`relative flex-1 min-h-0 overflow-y-auto overscroll-contain ${isMobile ? 'px-3 py-4' : 'px-6 py-5'} space-y-3 bg-[radial-gradient(circle_at_top,_rgba(196,169,98,0.06),_transparent_42%)]`} id="chat-messages-container">
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
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-end gap-2.5 ${isMobile ? 'max-w-[88%]' : 'max-w-[72%]'} ${
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
                    <div className={`rounded-2xl ${isMobile ? 'px-3.5 py-2.5 text-[13px]' : 'px-4 py-2.5 text-sm'} leading-relaxed ${
                      isMe 
                        ? 'bg-gold-500 text-white rounded-tr-xs shadow-2xs' 
                        : 'bg-white text-slate-800 border border-slate-200/60 shadow-xs rounded-tl-xs'
                    }`}>
                      {m.content && <p className="whitespace-pre-wrap">{m.content}</p>}
                      {m.attachment_filename && <ProtectedChatImage filename={m.attachment_filename} alt={m.attachment_name || 'Ảnh chat'} />}
                      {m.reference_id && (
                        <button
                          type="button"
                          onClick={() => onNavigate?.(m.reference_type === 'task' ? 'tasks' : 'customers', m.reference_type === 'task'
                            ? { selectTaskId: m.reference_id }
                            : { selectCustomerId: m.reference_id })}
                          className={`mt-2 w-full rounded-xl border px-3 py-2 text-left flex items-center gap-2 ${
                            isMe ? 'border-white/30 bg-white/10 hover:bg-white/20' : 'border-gold-200 bg-gold-50 text-slate-700 hover:bg-gold-100'
                          }`}
                        >
                          {m.reference_type === 'task' ? <Briefcase className="w-4 h-4 shrink-0" /> : <UserRound className="w-4 h-4 shrink-0" />}
                          <span className="min-w-0">
                            <span className="block text-[9px] uppercase font-bold opacity-70">{m.reference_type === 'task' ? 'Công việc' : 'Khách hàng'}</span>
                            <span className="block text-xs font-semibold truncate">{m.reference_label}</span>
                          </span>
                        </button>
                      )}
                    </div>
                    <div className={`flex items-center gap-1 px-1 text-[9px] text-slate-400 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <span>{new Date(m.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                      {isMe && m.client_status === 'sending' && <span>• Đang gửi</span>}
                      {isMe && m.client_status === 'failed' && (
                        <button
                          type="button"
                          onClick={() => sendMessage(m.content, m)}
                          className="inline-flex items-center gap-1 text-rose-600 font-semibold hover:text-rose-700"
                        >
                          <RefreshCw className="w-3 h-3" /> Gửi lại
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
          {newMessageCount > 0 && (
            <button
              type="button"
              onClick={() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                setNewMessageCount(0);
              }}
              className="sticky bottom-2 mx-auto flex items-center gap-1.5 rounded-full bg-slate-800 text-white px-3 py-1.5 text-xs shadow-lg"
            >
              <ArrowDown className="w-3.5 h-3.5" /> {newMessageCount} tin nhắn mới
            </button>
          )}
        </div>

        {/* Message Input Box */}
        <div className={`${isMobile ? 'px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]' : 'px-5 py-3'} relative bg-white border-t border-slate-200 shrink-0`}>
          {sendError && <p className="mb-2 text-xs text-rose-600" role="alert">{sendError}</p>}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={event => {
              handleImageFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <div className="mb-2 flex items-center gap-1.5">
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Đính kèm ảnh" className="p-2 rounded-lg text-slate-500 hover:text-gold-700 hover:bg-gold-50 disabled:opacity-40">
              <Paperclip className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => void captureScreen()} disabled={uploading} title="Chụp màn hình" className="p-2 rounded-lg text-slate-500 hover:text-gold-700 hover:bg-gold-50 disabled:opacity-40">
              <Camera className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => { setShowReferencePicker(value => !value); setReferenceSearch(''); }} title="Gắn công việc hoặc khách hàng" className="p-2 rounded-lg text-slate-500 hover:text-gold-700 hover:bg-gold-50">
              <Link2 className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => { setContent(value => `${value}${value && !value.endsWith(' ') ? ' ' : ''}@`); setMentionQuery(''); }} title="Tag nhân viên" className="p-2 rounded-lg text-slate-500 hover:text-gold-700 hover:bg-gold-50">
              <AtSign className="w-4 h-4" />
            </button>
            {uploading && <span className="text-[10px] text-slate-400">Đang tải ảnh…</span>}
          </div>
          {(pendingAttachment || selectedReference) && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pendingAttachment && (
                <span className="inline-flex items-center gap-1.5 max-w-full rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-600">
                  <Paperclip className="w-3.5 h-3.5" /><span className="truncate">{pendingAttachment.name}</span>
                  <button type="button" onClick={() => setPendingAttachment(null)} aria-label="Bỏ ảnh"><X className="w-3.5 h-3.5" /></button>
                </span>
              )}
              {selectedReference && (
                <span className="inline-flex items-center gap-1.5 max-w-full rounded-lg bg-gold-50 px-2.5 py-1.5 text-xs text-gold-800 border border-gold-100">
                  {selectedReference.type === 'task' ? <Briefcase className="w-3.5 h-3.5" /> : <UserRound className="w-3.5 h-3.5" />}
                  <span className="truncate">{selectedReference.label}</span>
                  <button type="button" onClick={() => setSelectedReference(null)} aria-label="Bỏ tham chiếu"><X className="w-3.5 h-3.5" /></button>
                </span>
              )}
            </div>
          )}
          {showReferencePicker && (
            <div className="absolute left-3 right-3 bottom-[calc(100%-0.25rem)] z-30 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
              <input value={referenceSearch} onChange={event => setReferenceSearch(event.target.value)} autoFocus placeholder="Tìm mã hoặc tên công việc, khách hàng…" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-gold-500" />
              <div className="mt-1 max-h-44 overflow-y-auto">
                {referenceSearch.trim().length >= 2 && referenceResults.length === 0 && <p className="p-2 text-xs text-slate-400">Không tìm thấy hồ sơ phù hợp</p>}
                {referenceResults.map(item => (
                  <button key={`${item.type}-${item.id}`} type="button" onClick={() => { setSelectedReference(item); setShowReferencePicker(false); }} className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2">
                    {item.type === 'task' ? <Briefcase className="w-4 h-4 text-indigo-500" /> : <UserRound className="w-4 h-4 text-emerald-500" />}
                    <span><span className="block text-xs font-semibold text-slate-700">{item.label}</span><span className="block text-[10px] text-slate-400">{item.subtitle}</span></span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {mentionQuery !== null && visibleMentionContacts.length > 0 && (
            <div className="absolute left-3 right-3 bottom-[calc(100%-0.25rem)] z-30 rounded-2xl border border-slate-200 bg-white p-1 shadow-2xl max-h-48 overflow-y-auto">
              {visibleMentionContacts.map(contact => (
                <button key={contact.id} type="button" onClick={() => insertMention(contact)} className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50 text-xs">
                  <span className="font-semibold text-slate-700">@{contact.full_name}</span> <span className="text-slate-400">· {contact.role_display_name}</span>
                </button>
              ))}
            </div>
          )}
          <form onSubmit={handleSendMessage} className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={e => updateMentionQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if ((content.trim() || pendingAttachment || selectedReference) && !sending) void sendMessage(content);
                }
              }}
              placeholder={selectedContact ? `Nhắn cho ${selectedContact.full_name}…` : 'Gửi tin vào Kênh chung…'}
              rows={1}
              maxLength={4000}
              className={`${isMobile ? 'min-h-11 px-3.5 py-3 text-[16px]' : 'min-h-10 px-4 py-2.5 text-sm'} flex-1 max-h-28 resize-none overflow-y-auto border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 transition-colors duration-150 bg-slate-50/70`}
              id="chat-input-field"
            />
            <button
              type="submit"
              disabled={(!content.trim() && !pendingAttachment && !selectedReference) || sending || uploading}
              className={`${isMobile ? 'w-11 h-11 rounded-full' : 'w-10 h-10 rounded-xl'} bg-gold-600 hover:bg-gold-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors duration-150 shadow-sm shrink-0`}
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
