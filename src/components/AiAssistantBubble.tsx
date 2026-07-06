import React, { useEffect, useMemo, useState } from 'react';
import { Bot, Loader2, MessageCircle, Send, Sparkles, X, Zap } from 'lucide-react';
import { apiRequest } from '../lib/api';

interface AiAssistantBubbleProps {
  userName?: string;
  placement?: 'desktop' | 'mobile';
}

interface AssistantResponse {
  answer: string;
  tools_used?: string[];
}

export default function AiAssistantBubble({ userName, placement = 'desktop' }: AiAssistantBubbleProps) {
  const [open, setOpen] = useState(() => sessionStorage.getItem('studio_ai_assistant_seen') !== 'true');
  const [question, setQuestion] = useState('');
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Chào buổi sáng. Robot tra cứu đã sẵn sàng.';
    if (hour < 14) return 'Chào buổi trưa. Tôi đang trực bàn điều phối.';
    if (hour < 18) return 'Chào buổi chiều. Tôi có thể kiểm tra nhanh dữ liệu studio.';
    return 'Chào buổi tối. Robot hỗ trợ đang trực hệ thống.';
  }, []);
  const [answer, setAnswer] = useState(`${greeting}\n\nBạn cần kiểm tra mục nào trước?`);
  const [toolsUsed, setToolsUsed] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const askAssistantStream = async (prompt: string) => {
    setLoading(true);
    setError(null);
    setToolsUsed([]);
    setAnswer('');

    try {
      const token = localStorage.getItem('studio_token');
      const response = await fetch('/api/ai/assistant/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ question: prompt })
      });

      if (!response.ok || !response.body) {
        throw new Error('stream_unavailable');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamedAnswer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const eventBlock of events) {
          const eventLine = eventBlock.split('\n').find(line => line.startsWith('event: '));
          const dataLine = eventBlock.split('\n').find(line => line.startsWith('data: '));
          if (!eventLine || !dataLine) continue;

          const eventName = eventLine.replace('event: ', '').trim();
          const data = JSON.parse(dataLine.replace('data: ', ''));

          if (eventName === 'delta') {
            streamedAnswer += data.text || '';
            setAnswer(streamedAnswer);
          }
          if (eventName === 'tools') {
            setToolsUsed(data.tools_used || []);
          }
          if (eventName === 'error') {
            throw new Error(data.error || 'stream_error');
          }
        }
      }

      setQuestion('');
    } catch (err: any) {
      try {
        const response = await apiRequest<AssistantResponse>('/api/ai/assistant', 'POST', {
          question: prompt
        });
        setAnswer(response.answer || 'Không có kết quả phù hợp.');
        setToolsUsed(response.tools_used || []);
        setQuestion('');
      } catch (fallbackErr: any) {
        setError(fallbackErr.message || err.message || 'Trợ lý AI đang lỗi. Vui lòng thử lại sau.');
      }
    } finally {
      setLoading(false);
    }
  };

  const askAssistant = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;
    await askAssistantStream(trimmed);
  };

  const quickQuestions = [
    'Tổng quan hôm nay',
    'Lịch chụp sắp tới',
    'Cảnh báo vận hành',
    'Ai đang bận nhất tuần này?',
    'Lead nào cần chăm sóc?'
  ];

  const askQuickQuestion = async (quickQuestion: string) => {
    if (loading) return;
    setQuestion(quickQuestion);
    await askAssistantStream(quickQuestion);
  };

  const closeAssistant = () => {
    sessionStorage.setItem('studio_ai_assistant_seen', 'true');
    setOpen(false);
  };

  const isMobilePlacement = placement === 'mobile';
  const rootClass = isMobilePlacement
    ? 'absolute bottom-20 right-4 z-50 flex flex-col items-end pointer-events-none'
    : 'fixed bottom-5 right-[max(1rem,calc((100vw-28rem)/2+1rem))] lg:right-5 z-50 flex flex-col items-end pointer-events-none';
  const panelClass = isMobilePlacement
    ? 'mb-3 w-[calc(min(100vw,28rem)-2rem)] max-w-[340px] bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden pointer-events-auto'
    : 'mb-3 w-[min(calc(100vw-2.5rem),360px)] bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden pointer-events-auto';
  const buttonClass = isMobilePlacement
    ? 'w-12 h-12 rounded-full bg-slate-950 active:bg-slate-800 text-white shadow-2xl border border-white/20 flex items-center justify-center pointer-events-auto relative overflow-hidden'
    : 'w-14 h-14 rounded-full bg-slate-950 hover:bg-slate-800 text-white shadow-2xl border border-white/20 flex items-center justify-center pointer-events-auto transition-transform hover:scale-105 relative overflow-hidden';

  return (
    <div className={rootClass}>
      {open && (
        <div className={panelClass}>
          <div className="px-4 py-3 bg-slate-950 text-white flex items-center justify-between relative overflow-hidden">
            <div className="absolute inset-y-0 right-0 w-24 bg-gold-500/10 skew-x-[-18deg] translate-x-8" />
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-full bg-gold-500 text-white flex items-center justify-center shrink-0 shadow-lg relative">
                <Bot className="w-4 h-4" />
                <span className="absolute -right-0.5 -top-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-slate-950 rounded-full animate-pulse" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate flex items-center gap-1.5">
                  AI Tra Cứu
                  <Zap className="w-3 h-3 text-gold-300" />
                </p>
                <p className="text-[10px] text-slate-300 truncate">Robot hỗ trợ Admin · {userName || 'The Will Studio'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeAssistant}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Đóng trợ lý AI"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 min-h-[96px] relative">
              {!loading && !error && (
                <div className="absolute top-2 right-2 flex items-center gap-1 text-[8px] font-bold text-emerald-600 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Online
                </div>
              )}
              {loading && !answer ? (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin text-gold-600" />
                  Đang kiểm tra dữ liệu...
                </div>
              ) : error ? (
                <p className="text-xs leading-relaxed text-rose-600">{error}</p>
              ) : (
                <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
                  {answer}
                  {loading && <span className="inline-block w-1.5 h-3 ml-0.5 bg-gold-500 animate-pulse align-[-2px]" />}
                </p>
              )}
            </div>

            {toolsUsed.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[9px] font-bold uppercase tracking-wider bg-gold-50 text-gold-700 border border-gold-200/60 rounded-full px-2 py-1">
                  Đã kiểm tra dữ liệu
                </span>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {quickQuestions.map(quickQuestion => (
                <button
                  key={quickQuestion}
                  type="button"
                  onClick={() => askQuickQuestion(quickQuestion)}
                  disabled={loading}
                  className="text-[10px] font-semibold text-slate-600 bg-white hover:bg-gold-50 hover:text-gold-800 border border-slate-200 hover:border-gold-200 rounded-full px-2.5 py-1.5 transition-colors disabled:opacity-50"
                >
                  {quickQuestion}
                </button>
              ))}
            </div>

            <form onSubmit={askAssistant} className="flex gap-2">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={500}
                placeholder="Nhập điều cần kiểm tra..."
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-400/10"
              />
              <button
                type="submit"
                disabled={loading || !question.trim()}
                className="w-10 h-10 rounded-xl bg-gold-600 hover:bg-gold-700 disabled:bg-slate-200 disabled:text-slate-400 text-white flex items-center justify-center transition-colors"
                aria-label="Gửi câu hỏi cho trợ lý AI"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={buttonClass}
        aria-label="Mở trợ lý AI"
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
