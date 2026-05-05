'use client';

import { type AgentMessage, useAiAgent } from '@/hooks/use-ai-agent';
import { clsx } from 'clsx';
import {
  Bot,
  CheckCircle,
  ChevronDown,
  ListTree,
  Mic,
  Plus,
  RefreshCcw,
  Send,
  Sparkles,
  User,
  Wand2,
  XCircle,
  Zap,
} from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { BasePanel } from './BasePanel';
import { PanelHeader } from './PanelHeader';

function ToolCallBadge({ call }: { call: NonNullable<AgentMessage['toolCalls']>[number] }) {
  return (
    <div
      className={clsx(
        'flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium',
        call.success
          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
          : 'bg-red-500/10 text-red-400 border border-red-500/20'
      )}
    >
      {call.success ? <CheckCircle className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
      {call.description}
    </div>
  );
}

export const AiPanel = memo(function AiPanel() {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, isLoading, sendMessage, clearMessages, stop } = useAiAgent();

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new message or typing indicator
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isLoading]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    sendMessage(text);
  };

  const suggestions = [
    {
      icon: Wand2,
      label: 'Invoice layout',
      color: 'text-blue-400',
      prompt: 'Create a basic invoice layout with company header, items table, and total',
    },
    {
      icon: Zap,
      label: 'Add table',
      color: 'text-yellow-400',
      prompt: 'Add a data table to the body with columns for name, quantity, price, and total',
    },
    {
      icon: RefreshCcw,
      label: 'Load template',
      color: 'text-purple-400',
      prompt: 'Load the invoice template',
    },
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
                  <img className="w-4 h-4 rounded-full overflow-hidden" src="/icon.png" alt="TypstFlow" />
                )}
              </div>
              <span className="text-[8px] font-bold uppercase text-[var(--text-muted)] tracking-wider">
                {msg.role === 'user' ? 'You' : 'Assistant'}
              </span>
            </div>

            <div
              className={clsx(
                'max-w-[85%] px-3 py-2 rounded-2xl text-[11px] leading-relaxed transition-all duration-300',
                msg.role === 'user'
                  ? 'bg-[var(--accent)] text-white rounded-tr-none shadow-sm'
                  : msg.content.includes('(Stopped)') || msg.content === 'Generation cancelled.'
                    ? 'bg-red-500/5 text-red-500/80 border border-red-500/10 italic rounded-tl-none opacity-80'
                    : 'bg-[var(--bg-widget)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-tl-none'
              )}
            >
              {msg.content}
            </div>

            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="max-w-[95%] flex flex-wrap gap-1 mt-0.5">
                {msg.toolCalls.map((tc, i) => (
                  <ToolCallBadge key={`${tc.name}-${i}`} call={tc} />
                ))}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 px-4 py-2 opacity-60 animate-pulse">
            <span className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-0.5">
              Thinking
            </span>
            <button
              type="button"
              onClick={stop}
              className="text-[9px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors ml-2"
            >
              (Stop)
            </button>
          </div>
        )}
      </div>

      {/* Quick Suggestions */}
      <div className="px-3 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none no-scrollbar">
        {suggestions.map((s) => (
          <button
            key={s.label}
            type="button"
            disabled={isLoading}
            onClick={() => sendMessage(s.prompt)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[var(--bg-widget)] border border-[var(--border-subtle)] hover:border-[var(--accent)] transition-all whitespace-nowrap group disabled:opacity-40"
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
        <div className="flex flex-col rounded-lg bg-[var(--bg-app)]">
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
            placeholder="Describe what you want to build..."
            className="w-full bg-transparent border-none outline-none ring-0 focus:ring-0 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] p-4 pt-5 resize-none min-h-[80px] leading-relaxed"
          />

          <div className="flex items-center justify-between p-0.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={clearMessages}
                title="Clear chat"
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
                  claude-3.5-sonnet
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
                className="p-2 rounded-full bg-[var(--bg-widget)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-all active:scale-95"
              >
                <Mic className="w-4 h-4" />
              </button>

              {isLoading ? (
                <button
                  type="button"
                  onClick={stop}
                  className="p-2 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all animate-in zoom-in duration-200"
                  title="Stop generation"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              ) : (
                input.trim() && (
                  <button
                    type="button"
                    onClick={handleSend}
                    className="p-2 rounded-full bg-[var(--accent)] text-white shadow-[var(--accent-glow)] transition-all animate-in zoom-in duration-200"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </BasePanel>
  );
});
