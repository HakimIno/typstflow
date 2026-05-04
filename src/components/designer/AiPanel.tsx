'use client';

import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import { Bot, RefreshCcw, Send, Sparkles, User, Wand2, X, Zap } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const AiPanel = memo(function AiPanel() {
  const setSidebarOpen = useDesignerStore((state) => state.setSidebarOpen);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content:
        'Hello! I am your AI Design Assistant. How can I help you perfect your report today?',
      timestamp: new Date(),
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: These dependencies are needed to trigger scrolling when content updates.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Math.random().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const aiMsg: Message = {
        id: Math.random().toString(),
        role: 'assistant',
        content: `I've analyzed your request: "${userMsg.content}". I can help you with that! Would you like me to suggest some layout improvements or automatically bind your data fields?`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1500);
  };

  const suggestions = [
    { icon: Wand2, label: 'Fix Alignment', color: 'text-blue-400' },
    { icon: Zap, label: 'Auto Layout', color: 'text-yellow-400' },
    { icon: RefreshCcw, label: 'Reset Data', color: 'text-purple-400' },
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--bg-surface)] overflow-hidden font-sans border-r border-[var(--border-default)]">
      {/* Premium Header */}
      <div className="px-3 py-2.5 bg-white/5 flex items-center justify-between border-b border-[var(--border-default)] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(0,111,238,0.3)]">
            <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
              AI Assistant
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="p-1 hover:bg-[var(--bg-hover)] rounded transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Chat History */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-none">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={clsx(
              'flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-300',
              msg.role === 'user' ? 'items-end' : 'items-start'
            )}
          >
            <div
              className={clsx(
                'flex items-center gap-2 mb-0.5',
                msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              )}
            >
              <div
                className={clsx(
                  'w-5 h-5 rounded-md flex items-center justify-center',
                  msg.role === 'user' ? 'bg-[var(--bg-widget)]' : 'bg-[var(--accent-glow)]'
                )}
              >
                {msg.role === 'user' ? (
                  <User className="w-3 h-3 text-[var(--text-secondary)]" />
                ) : (
                  <Bot className="w-3 h-3 text-[var(--accent)]" />
                )}
              </div>
              <span className="text-[8px] font-bold uppercase text-[var(--text-muted)] tracking-wider">
                {msg.role === 'user' ? 'You' : 'Assistant'}
              </span>
            </div>

            <div
              className={clsx(
                'max-w-[85%] px-3 py-2 rounded-2xl text-[11px] leading-relaxed shadow-sm',
                msg.role === 'user'
                  ? 'bg-[var(--accent)] text-white rounded-tr-none'
                  : 'bg-[var(--bg-widget)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-tl-none'
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-2 px-1">
            <div className="w-5 h-5 rounded-md bg-[var(--accent-glow)] flex items-center justify-center">
              <Bot className="w-3 h-3 text-[var(--accent)]" />
            </div>
            <div className="flex gap-1">
              <div
                className="w-1 h-1 rounded-full bg-[var(--accent)] animate-bounce"
                style={{ animationDelay: '0ms' }}
              />
              <div
                className="w-1 h-1 rounded-full bg-[var(--accent)] animate-bounce"
                style={{ animationDelay: '150ms' }}
              />
              <div
                className="w-1 h-1 rounded-full bg-[var(--accent)] animate-bounce"
                style={{ animationDelay: '300ms' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      <div className="px-3 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none no-scrollbar">
        {suggestions.map((s) => (
          <button
            key={s.label}
            type="button"
            className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[var(--bg-widget)] border border-[var(--border-subtle)] hover:border-[var(--accent)] transition-all whitespace-nowrap group"
          >
            <s.icon className={clsx('w-3 h-3', s.color)} />
            <span className="text-[9px] font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
              {s.label}
            </span>
          </button>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-3 bg-[var(--bg-surface)] border-t border-[var(--border-default)]">
        <div className="relative flex items-center gap-2 p-1.5 pl-3 rounded-xl bg-[var(--bg-widget)] border border-[var(--border-subtle)] focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-glow)] transition-all duration-200">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask me to design something..."
            className="flex-1 bg-transparent border-none outline-none ring-0 focus:ring-0 focus:outline-none text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] py-1"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-1.5 rounded-lg bg-[var(--accent)] text-white disabled:opacity-30 disabled:grayscale transition-all hover:scale-105 active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
});
