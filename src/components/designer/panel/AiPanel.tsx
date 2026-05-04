'use client';

import { clsx } from 'clsx';
import {
  Bot,
  ChevronDown,
  ListTree,
  Mic,
  Plus,
  RefreshCcw,
  Send,
  Sparkles,
  User,
  Wand2,
  Zap,
} from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { BasePanel } from './BasePanel';
import { PanelHeader } from './PanelHeader';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const AiPanel = memo(function AiPanel() {
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
    <BasePanel>
      <PanelHeader title="AI Assistant" icon={Sparkles} />

      {/* Chat History */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-none">
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
                'max-w-[85%] px-3 py-2 rounded-2xl text-[11px] leading-relaxed ',
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
      <div className="p-0.5 bg-[var(--bg-widget)] border-t border-[var(--border-default)]">
        <div className="flex flex-col rounded-lg bg-[var(--bg-app)] ">
          {/* Textarea Area */}
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask anything, @ to mention, / for workflows"
            className="w-full bg-transparent border-none outline-none ring-0 focus:ring-0 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] p-4 pt-5 resize-none min-h-[80px] leading-relaxed"
          />

          {/* Footer Bar */}
          <div className="flex items-center justify-between p-0.5 ">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <Plus className="w-4 h-4" />
              </button>

              <div className="w-[1px] h-3.5 bg-white/10 mx-1" />

              <button
                type="button"
                className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-white/5 rounded-lg transition-colors group"
              >
                <span className="text-[10px] font-bold text-[var(--text-muted)] group-hover:text-[var(--text-primary)]">
                  Gemini 3 Flash
                </span>
                <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
              </button>

              <button
                type="button"
                className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-white/5 rounded-lg transition-colors group"
              >
                <ListTree className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
                <span className="text-[10px] font-bold text-[var(--text-muted)] group-hover:text-[var(--text-primary)]">
                  Plan
                </span>
              </button>
            </div>

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                className="p-2 rounded-full bg-[var(--bg-widget)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-all active:scale-95 "
              >
                <Mic className="w-4 h-4" />
              </button>

              {input.trim() && (
                <button
                  type="button"
                  onClick={handleSend}
                  className="p-2 rounded-full bg-[var(--accent)] text-white shadow-[var(--accent-glow)] transition-all animate-in zoom-in duration-200"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </BasePanel>
  );
});
