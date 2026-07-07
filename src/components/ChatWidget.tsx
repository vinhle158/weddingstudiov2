import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Bot, Loader2, MessageCircle, Send, X, Zap } from 'lucide-react';
import { apiRequest } from '../lib/api';

interface ChatWidgetProps {
  userName?: string;
  userEmail?: string;
  placement?: 'desktop' | 'mobile';
}

interface Message {
  role: 'user' | 'bot';
  content: string;
}

interface ChatbotApiResponse {
  reply: string;
  intent: string;
  data?: any;
  needsClarification?: boolean;
  sessionId?: string;
}

export default function ChatWidget({ userName, userEmail, placement = 'desktop' }: ChatWidgetProps) {
  const canUseChatbot = userEmail?.toLowerCase() === 'viet@studio.com';
  const [open, setOpen] = useState(() => sessionStorage.getItem('studio_chatbot_seen') !== 'true');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Maintain a random session ID for conversation state
  const sessionId = useMemo(() => {
    return 'session-' + Math.random().toString(36).substring(2, 15);
  }, []);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Chào buổi sáng.';
    if (hour < 14) return 'Chào buổi trưa. Tôi đang trực bàn điều phối.';
    if (hour < 18) return 'Chào buổi chiều. Tôi có thể kiểm tra nhanh dữ liệu studio.';
    return 'Chào buổi tối. Robot hỗ trợ đang trực hệ thống.';
  }, []);

  const [messages, setMessages] = useState<Message[]>([]);

  // Initialize with greeting
  useEffect(() => {
    setMessages([
      {
        role: 'bot',
        content: `${greeting}\n\nTôi là Chatbot AI tra cứu CRM. Bạn có thể hỏi tôi:\n- Tra cứu thông tin khách hàng (VD: "Thông tin khách hàng Tuấn")\n- Thống kê doanh số (VD: "Doanh số tháng này bao nhiêu")\n- Trạng thái hợp đồng (VD: "Hợp đồng của Triệu Vy sao rồi")`
      }
    ]);
  }, [greeting]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (prompt: string) => {
    if (!prompt.trim() || loading) return;

    const userMsg = prompt.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setQuestion('');
    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest<ChatbotApiResponse>('/api/chatbot', 'POST', {
        message: userMsg,
        sessionId
      });

      setMessages(prev => [
        ...prev,
        { role: 'bot', content: response.reply || 'Không nhận được câu trả lời từ hệ thống.' }
      ]);
    } catch (err: any) {
      console.error('[Chatbot Widget Error]', err);
      setError(err.message || 'Hệ thống chatbot đang bận. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage(question);
  };

  const quickQuestions = [
    'Doanh số tháng này',
    'Doanh thu quý này',
    'Khách hàng Tuấn',
    'Hợp đồng Triệu Vy'
  ];

  const handleQuickQuestion = async (q: string) => {
    await sendMessage(q);
  };

  const closeChat = () => {
    sessionStorage.setItem('studio_chatbot_seen', 'true');
    setOpen(false);
  };

  const renderMessageContent = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      let isBullet = false;
      let isSubBullet = false;
      let content = line;

      if (trimmed.startsWith('•')) {
        isBullet = true;
        content = line.substring(line.indexOf('•') + 1).trim();
      } else if (trimmed.startsWith('-')) {
        isSubBullet = true;
        content = line.substring(line.indexOf('-') + 1).trim();
      }

      // Parse **bold** and *italic*
      const parts = content.split('**');
      const renderedText = parts.map((part, pIdx) => {
        if (pIdx % 2 === 1) {
          const italicParts = part.split('*');
          return (
            <strong key={pIdx} className="font-bold text-slate-950">
              {italicParts.map((subPart, sIdx) => sIdx % 2 === 1 ? <em key={sIdx} className="italic font-semibold text-slate-900">{subPart}</em> : subPart)}
            </strong>
          );
        }
        
        const italicParts = part.split('*');
        return italicParts.map((subPart, sIdx) => {
          if (sIdx % 2 === 1) {
            return <em key={sIdx} className="italic text-slate-700 font-medium">{subPart}</em>;
          }
          return subPart;
        });
      });

      if (isBullet) {
        return (
          <div key={idx} className="flex items-start gap-2 pl-0.5 mt-2 first:mt-0">
            <span className="text-gold-600 font-bold shrink-0">•</span>
            <div className="flex-1 text-slate-800 text-[12px]">{renderedText}</div>
          </div>
        );
      }

      if (isSubBullet) {
        return (
          <div key={idx} className="flex items-start gap-1.5 pl-4 text-slate-600 text-[11px] mt-1">
            <span className="text-slate-400 font-bold shrink-0">-</span>
            <div className="flex-1">{renderedText}</div>
          </div>
        );
      }

      return (
        <div key={idx} className="min-h-[1.2rem] text-slate-800 text-[12px]">
          {renderedText}
        </div>
      );
    });
  };

  const isMobilePlacement = placement === 'mobile';
  const rootClass = isMobilePlacement
    ? 'absolute bottom-20 right-4 z-50 flex flex-col items-end pointer-events-none'
    : 'fixed bottom-5 right-[max(1rem,calc((100vw-28rem)/2+1rem))] lg:right-5 z-50 flex flex-col items-end pointer-events-none';
  const panelClass = isMobilePlacement
    ? 'mb-3 w-[calc(min(100vw,28rem)-2rem)] max-w-[340px] bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden pointer-events-auto flex flex-col h-[400px]'
    : 'mb-3 w-[min(calc(100vw-2.5rem),380px)] bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden pointer-events-auto flex flex-col h-[480px]';
  const buttonClass = isMobilePlacement
    ? 'w-12 h-12 rounded-full bg-slate-950 active:bg-slate-800 text-white shadow-2xl border border-white/20 flex items-center justify-center pointer-events-auto relative overflow-hidden'
    : 'w-14 h-14 rounded-full bg-slate-950 hover:bg-slate-800 text-white shadow-2xl border border-white/20 flex items-center justify-center pointer-events-auto transition-transform hover:scale-105 relative overflow-hidden';

  if (!canUseChatbot) {
    return null;
  }

  return (
    <div className={rootClass}>
      {open && (
        <div className={panelClass}>
          {/* Header */}
          <div className="px-4 py-3 bg-slate-950 text-white flex items-center justify-between relative overflow-hidden shrink-0">
            <div className="absolute inset-y-0 right-0 w-24 bg-gold-500/10 skew-x-[-18deg] translate-x-8 pointer-events-none" />
            <div className="flex items-center gap-2 min-w-0 relative z-10">
              <div className="w-9 h-9 rounded-full bg-gold-500 text-white flex items-center justify-center shrink-0 shadow-lg relative">
                <Bot className="w-4 h-4" />
                <span className="absolute -right-0.5 -top-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-slate-950 rounded-full animate-pulse" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate flex items-center gap-1.5">
                  Chatbot AI Tra Cứu
                  <Zap className="w-3 h-3 text-gold-300" />
                </p>
                <p className="text-[10px] text-slate-300 truncate">Robot Hỗ Trợ CRM · {userName || 'Nhân viên'}</p>
              </div>
            </div>
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                closeChat();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                closeChat();
              }}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors relative z-20 cursor-pointer"
              aria-label="Đóng Chatbot"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2.5 shadow-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-slate-950 text-white rounded-br-none'
                      : 'bg-white border border-slate-100 rounded-bl-none'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="text-[12px]">{msg.content}</p>
                  ) : (
                    <div className="space-y-1">{renderMessageContent(msg.content)}</div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-none px-4 py-3 shadow-xs flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-gold-600" />
                  <span className="text-[11px] text-slate-500 font-medium">Đang tra cứu dữ liệu...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-[11px] text-rose-600">
                {error}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area and Quick Queries */}
          <div className="p-3 border-t border-slate-100 bg-white shrink-0 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {quickQuestions.map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleQuickQuestion(q)}
                  disabled={loading}
                  className="text-[10px] font-semibold text-slate-600 bg-slate-50 hover:bg-gold-50 hover:text-gold-800 border border-slate-200/65 hover:border-gold-200 rounded-full px-2.5 py-1.5 transition-colors disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={500}
                placeholder="Tra cứu doanh số, thông tin khách..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:bg-white focus:border-gold-500 focus:ring-2 focus:ring-gold-500/10"
              />
              <button
                type="submit"
                disabled={loading || !question.trim()}
                className="w-10 h-10 rounded-xl bg-gold-600 hover:bg-gold-700 disabled:bg-slate-200 disabled:text-slate-400 text-white flex items-center justify-center transition-colors shrink-0"
                aria-label="Gửi tin nhắn"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={buttonClass}
        aria-label="Mở Chatbot"
      >
        <span className="absolute inset-0 bg-gold-500/20 animate-pulse" />
        {!open && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
            <MessageCircle className="w-2.5 h-2.5 text-white" />
          </span>
        )}
        <Bot className={isMobilePlacement ? 'w-5 h-5' : 'w-6 h-6'} />
      </button>
    </div>
  );
}
