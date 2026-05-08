'use client';

import { type AgentMessage, useAiAgent } from '@/hooks/use-ai-agent';
import { clsx } from 'clsx';
import { Icon } from '@iconify/react';
import { memo, useEffect, useRef, useState } from 'react';
import { BasePanel } from './BasePanel';
import { PanelHeader } from './PanelHeader';
import { useDesignerStore } from '@/store/designer-store';
import { AI_MODELS } from '@/lib/utils/ai-models';
import { DropdownMenu, DropdownMenuItem, DropdownMenuHeader } from '@/components/shared/DropdownMenu';

const MODE_BADGE: Record<
  NonNullable<AgentMessage['mode']>,
  { label: string; icon: string; color: string }
> = {
  chat: { label: 'Chat', icon: 'solar:chat-round-dots-bold-duotone', color: 'text-[var(--text-muted)]' },
  plan: { label: 'Plan', icon: 'solar:map-point-bold-duotone', color: 'text-blue-400' },
  design: { label: 'Design', icon: 'solar:bolt-circle-bold-duotone', color: 'text-yellow-400' },
};

const iconMap: Record<string, string> = {
  get_layout: 'solar:layers-minimalistic-bold-duotone',
  add_text: 'solar:text-field-bold-duotone',
  add_table: 'solar:confetti-bold-duotone',
  add_image: 'solar:gallery-bold-duotone',
  add_line: 'solar:adhesive-plaster-2-line-duotone',
  add_spacer: 'solar:sidebar-minimize-bold-duotone',
  update_component: 'solar:pen-new-square-bold-duotone',
  delete_component: 'solar:trash-bin-trash-bold-duotone',
  set_sample_data: 'solar:database-bold-duotone',
};

const statusMap: Record<string, { icon: string; color: string }> = {
  success: { icon: 'solar:check-circle-bold-duotone', color: 'text-green-500' },
  error: { icon: 'solar:close-circle-bold-duotone', color: 'text-red-500' },
  pending: { icon: 'solar:refresh-circle-bold-duotone', color: 'animate-spin text-blue-500' },
};

const SUGGESTIONS = [
  {
    icon: 'solar:magic-stick-3-bold-duotone',
    label: 'Invoice layout',
    color: 'text-blue-400',
    prompt: 'Create a basic invoice layout with company header, items table, and total',
  },
  {
    icon: 'solar:widget-add-bold-duotone',
    label: 'Add table',
    color: 'text-yellow-400',
    prompt: 'Add a data table to the body with columns for name, quantity, price, and total',
  },
  {
    icon: 'solar:refresh-bold-duotone',
    label: 'Load template',
    color: 'text-purple-400',
    prompt: 'Load the invoice template',
  },
];

function ToolCallItem({ call }: { call: NonNullable<AgentMessage['toolCalls']>[number] }) {
  return (
    <div className="flex items-center gap-1 py-0.5 px-1 group/item" title={call.description}>
      {call.success !== undefined && (
        <Icon
          icon={statusMap[call.success ? 'success' : 'error'].icon}
          className={clsx('w-3 h-3', statusMap[call.success ? 'success' : 'error'].color)}
        />
      )}
      <Icon icon={iconMap[call.name] || 'solar:play-circle-bold-duotone'} className="w-3.5 h-3.5 text-[var(--text-secondary)] group-hover/item:text-[var(--accent)] transition-colors" />
      <span className="text-[10px] text-[var(--text-primary)] font-medium">{call.name}</span>

    </div>
  );
}

export const AiPanel = memo(function AiPanel() {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, isLoading, thinkingStep, sendMessage, clearMessages, stop } = useAiAgent();
  const [elapsedTime, setElapsedTime] = useState(0);
  const aiModel = useDesignerStore((s) => s.aiModel);
  const aiMode = useDesignerStore((s) => s.aiMode);
  const setAiModel = useDesignerStore((s) => s.setAiModel);
  const setAiMode = useDesignerStore((s) => s.setAiMode);
  const rewindToCheckpoint = useDesignerStore((s) => s.rewindToCheckpoint);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      const start = Date.now();
      interval = setInterval(() => {
        setElapsedTime((Date.now() - start) / 1000);
      }, 100);
    } else {
      setElapsedTime(0);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

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

  return (
    <BasePanel allowOverflow>
      <PanelHeader title="AI Assistant" icon="solar:adhesive-plaster-bold-duotone" />

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
                  <Icon icon="solar:user-bold-duotone" className="w-3 h-3 text-[var(--text-secondary)]" />
                ) : (
                  <div className="rounded-full bg-white">
                    <img className="w-5 h-5 rounded-full overflow-hidden" src="/logo.png" alt="TypstFlow" />
                  </div>
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
                  : msg.content.startsWith('Error:')
                    ? 'bg-red-500/10 text-red-500 border border-red-500/20 rounded-tl-none font-medium flex flex-col gap-1'
                    : msg.content.includes('(Stopped)') || msg.content === 'Generation cancelled.'
                      ? 'bg-red-500/5 text-red-500/80 border border-red-500/10 italic rounded-tl-none opacity-80'
                      : 'bg-[var(--bg-widget)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-tl-none'
              )}
            >
              {msg.content.startsWith('Error:') ? (
                <>
                  <div className="flex items-center gap-1.5 text-red-500 font-bold uppercase text-[9px] tracking-widest">
                    <Icon icon="solar:danger-bold-duotone" className="w-3 h-3" />
                    System Error
                  </div>
                  <div className="text-[10px] opacity-90">{msg.content.replace('Error: ', '')}</div>
                </>
              ) : (
                msg.content
              )}
            </div>

            {msg.role === 'assistant' && msg.mode && msg.mode !== 'chat' && (
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1">
                  <Icon
                    icon={MODE_BADGE[msg.mode].icon}
                    className={clsx('w-3 h-3', MODE_BADGE[msg.mode].color)}
                  />
                  <span className={clsx('text-[9px] font-bold uppercase tracking-widest', MODE_BADGE[msg.mode].color)}>
                    {MODE_BADGE[msg.mode].label}
                  </span>
                </div>

                {msg.mode === 'design' && msg.snapshotIndex !== undefined && (
                  <button
                    type="button"
                    onClick={() => rewindToCheckpoint(msg.snapshotIndex as number)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 hover:border-orange-500/40 transition-all active:scale-95"
                    title="Rewind canvas to before this AI turn"
                  >
                    <Icon icon="solar:rewind-back-bold-duotone" className="w-3 h-3" />
                    <span className="text-[9px] font-bold uppercase tracking-widest">Rewind</span>
                  </button>
                )}
              </div>
            )}

            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="max-w-full mt-2 pt-2 border-t border-[var(--border-subtle)]/20">
                <details className="group">
                  <summary className="flex items-center gap-2 cursor-pointer list-none text-[9px] font-bold text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
                    <Icon icon="solar:alt-arrow-right-linear" className="w-2.5 h-2.5 transition-transform group-open:rotate-90" />
                    <span className="uppercase tracking-widest opacity-80">
                      System Activity ({msg.toolCalls.length})
                    </span>
                  </summary>
                  <div className="flex flex-col gap-0.5 mt-2 ml-1 pl-3 border-l border-[var(--border-subtle)]/30">
                    {msg.toolCalls.map((tc, i) => (
                      <ToolCallItem key={`${tc.name}-${i}`} call={tc} />
                    ))}
                  </div>
                </details>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="m-2 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-500 relative overflow-hidden">
            {/* Glowing background effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--accent-glow)] to-transparent opacity-30 animate-shimmer" style={{ width: '200%' }} />

            <div className="flex items-center gap-3 relative z-10">
              <div className="relative flex items-center justify-center w-4 h-4">
                <Icon icon="solar:magic-stick-3-bold-duotone" className="w-3.5 h-3.5 text-[var(--accent)] animate-pulse" />
                <div className="absolute inset-0 rounded-full border border-[var(--accent)]/30 animate-ping" />
              </div>
              <div className="flex-1">
                <span className="text-[11px] font-medium text-transparent bg-clip-text bg-gradient-to-r from-[var(--text-primary)] via-[var(--accent)] to-[var(--text-primary)] bg-[length:200%_auto] animate-shimmer-text tracking-wide">
                  {thinkingStep || 'Thinking...'}
                </span>
              </div>
              <span className="text-[9px] font-mono text-[var(--accent)] bg-[var(--accent)]/10 px-1.5 py-0.5 rounded-[var(--radius-sm)] tabular-nums">
                {elapsedTime.toFixed(1)}s
              </span>
            </div>

            {/* Sleek animated progress line */}
            <div className="w-full h-[2px] bg-[var(--border-subtle)] overflow-hidden rounded-full relative z-10">
              <div className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-[var(--accent)]/0 via-[var(--accent)] to-[var(--accent)]/0 animate-shimmer-fast w-1/2" />
            </div>
          </div>
        )}
      </div>

      {/* Quick Suggestions */}
      <div className="px-2 py-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none no-scrollbar">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            onClick={() => {
              setInput(s.prompt);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--bg-widget)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-full transition-all shrink-0 group"
          >
            <Icon icon={s.icon} className={clsx('w-3 h-3', s.color)} />
            <span className="text-[9px] font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
              {s.label}
            </span>
          </button>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-0.5 bg-[var(--bg-widget)] border-t border-[var(--border-default)] relative z-50 overflow-visible">
        <div className="flex flex-col rounded-lg bg-[var(--bg-app)] overflow-visible">
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
                <Icon icon="solar:add-circle-bold-duotone" className="w-6 h-6" />
              </button>

              <div className="w-[1px] h-3.5 bg-white/10" />

              <DropdownMenu
                side="top"
                trigger={
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-white/5 rounded-lg transition-colors group"
                  >
                    <span className="text-[10px] font-bold text-[var(--text-muted)] group-hover:text-[var(--text-primary)]">
                      {AI_MODELS.find((m) => m.id === aiModel)?.label.toLowerCase().replace(/\s+/g, '-') ||
                        aiModel.split('/').pop()}
                    </span>
                    <Icon icon="solar:alt-arrow-down-linear" className="w-3 h-3 text-[var(--text-muted)]" />
                  </button>
                }
              >
                <DropdownMenuHeader>Select AI Model</DropdownMenuHeader>
                {AI_MODELS.map((model) => (
                  <DropdownMenuItem
                    key={model.id}
                    label={model.label}
                    onClick={() => setAiModel(model.id)}
                    className={aiModel === model.id ? 'bg-white/5 text-[var(--accent)]' : ''}
                    rightElement={
                      <span className="text-[9px] uppercase tracking-tighter opacity-50">
                        {model.tier}
                      </span>
                    }
                  />
                ))}
              </DropdownMenu>

              <DropdownMenu
                side="top"
                trigger={
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-white/5 rounded-lg transition-colors group"
                  >
                    {aiMode === 'plan' ? (
                      <Icon icon="solar:list-down-minimalistic-bold-duotone" className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
                    ) : (
                      <Icon icon="solar:bolt-circle-bold-duotone" className="w-3.5 h-3.5 text-yellow-400" />
                    )}
                    <span className="text-[10px] font-bold text-[var(--text-muted)] group-hover:text-[var(--text-primary)]">
                      {aiMode === 'plan' ? 'Plan' : 'Act'}
                    </span>
                  </button>
                }
              >
                <DropdownMenuHeader>Agent Mode</DropdownMenuHeader>
                <DropdownMenuItem
                  icon={() => <Icon icon="solar:list-down-minimalistic-bold-duotone" className="w-3.5 h-3.5" />}
                  label="Plan Mode"
                  onClick={() => setAiMode('plan')}
                  className={aiMode === 'plan' ? 'bg-white/5 text-[var(--accent)]' : ''}
                />
                <DropdownMenuItem
                  icon={() => <Icon icon="solar:bolt-circle-bold-duotone" className="w-3.5 h-3.5" />}
                  label="Act Mode"
                  onClick={() => setAiMode('act')}
                  className={aiMode === 'act' ? 'bg-white/5 text-[var(--accent)]' : ''}
                />
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                className="p-2 rounded-full bg-[var(--bg-widget)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-all active:scale-95"
              >
                <Icon icon="solar:microphone-3-bold-duotone" className="w-4 h-4" />
              </button>

              {isLoading ? (
                <button
                  type="button"
                  onClick={stop}
                  className="p-2 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all animate-in zoom-in duration-200"
                  title="Stop generation"
                >
                  <Icon icon="solar:close-circle-bold-duotone" className="w-4 h-4" />
                </button>
              ) : (
                input.trim() && (
                  <button
                    type="button"
                    onClick={handleSend}
                    className="p-2 rounded-full bg-[var(--accent)] text-white shadow-[var(--accent-glow)] transition-all animate-in zoom-in duration-200"
                  >
                    <Icon icon="solar:plain-bold-duotone" className="w-3.5 h-3.5" />
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
