'use client';

import {
  DropdownMenu,
  DropdownMenuHeader,
  DropdownMenuItem,
} from '@/components/shared/DropdownMenu';
import { type AgentMessage, useAiAgent } from '@/hooks/use-ai-agent';
import { AI_MODELS } from '@/lib/utils/ai-models';
import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Database,
  FileText,
  Image,
  Layers,
  ListChecks,
  Mic,
  Minus,
  Pencil,
  PlusCircle,
  RotateCcw,
  Send,
  Space,
  Sparkles,
  Table,
  Trash2,
  Type,
  XCircle,
  Zap,
} from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { BasePanel } from './BasePanel';
import { PanelHeader } from './PanelHeader';

// ─── Icon map for tool calls ──────────────────────────────────────────────────
const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  add_text: Type,
  add_table: Table,
  add_image: Image,
  add_line: Minus,
  add_spacer: Space,
  update_component: Pencil,
  delete_component: Trash2,
  remove_component: Trash2,
  set_sample_data: Database,
  get_layout: Layers,
  load_template: FileText,
};

// ─── Quick template prompts ───────────────────────────────────────────────────
const QUICK_TEMPLATES = [
  {
    label: 'Invoice',
    prompt: 'Create a professional Thai invoice with company header, items table, VAT, and totals',
  },
  {
    label: 'Report',
    prompt: 'Create a business report with header, summary stats, data table, and footer',
  },
  {
    label: 'Receipt',
    prompt: 'Create a simple receipt with items, subtotal, VAT 7%, and grand total',
  },
  {
    label: 'Quotation',
    prompt: 'Create a quotation with customer info, itemized products, terms, and signature area',
  },
];

// ─── User message ─────────────────────────────────────────────────────────────
function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[88%] px-3 py-2 rounded-2xl rounded-tr-none bg-[var(--accent)] text-white text-[11px] leading-relaxed">
        {content}
      </div>
    </div>
  );
}

// ─── Design turn card (diff-style) ───────────────────────────────────────────
function DesignTurnCard({
  message,
  onRevert,
  isReverted,
}: {
  message: AgentMessage;
  onRevert?: () => void;
  isReverted: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const addCalls =
    message.toolCalls?.filter((tc) => tc.name.startsWith('add_') || tc.name === 'load_template') ??
    [];
  const updateCalls = message.toolCalls?.filter((tc) => tc.name === 'update_component') ?? [];
  const removeCalls = message.toolCalls?.filter((tc) => tc.name.includes('remove')) ?? [];
  const total = message.toolCalls?.length ?? 0;

  return (
    <div
      className={clsx(
        'rounded-xl border overflow-hidden transition-opacity',
        isReverted
          ? 'border-[var(--border-subtle)]/30 opacity-40'
          : 'border-[var(--accent)]/20 bg-[var(--bg-widget)]'
      )}
    >
      {/* Card header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--bg-surface)]/60 border-b border-[var(--border-subtle)]/40">
        <div className="flex items-center gap-1.5">
          {isReverted ? (
            <RotateCcw className="w-3 h-3 text-[var(--text-muted)]" />
          ) : (
            <Zap className="w-3 h-3 text-yellow-400" />
          )}
          <span className="text-[10px] font-semibold text-[var(--text-primary)]">
            {isReverted ? 'Reverted' : `${total} change${total !== 1 ? 's' : ''} applied`}
          </span>
        </div>
        {!isReverted && total > 0 && (
          <div className="flex items-center gap-2 font-mono">
            {addCalls.length > 0 && (
              <span className="text-[9px] text-green-400">+{addCalls.length}</span>
            )}
            {updateCalls.length > 0 && (
              <span className="text-[9px] text-blue-400">~{updateCalls.length}</span>
            )}
            {removeCalls.length > 0 && (
              <span className="text-[9px] text-red-400">-{removeCalls.length}</span>
            )}
          </div>
        )}
      </div>

      {/* AI text summary */}
      {!isReverted && message.content && message.content !== 'Working...' && (
        <p className="px-3 pt-2.5 pb-1 text-[10px] text-[var(--text-secondary)] leading-relaxed">
          {message.content}
        </p>
      )}

      {/* Expandable diff list */}
      {!isReverted && total > 0 && (
        <div className="px-3 py-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[9px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <ChevronRight
              className={clsx('w-2.5 h-2.5 transition-transform', expanded && 'rotate-90')}
            />
            <span>Show details</span>
          </button>

          {expanded && (
            <div className="mt-2 space-y-0.5 max-h-36 overflow-y-auto">
              {message.toolCalls?.map((tc, i) => {
                const TIcon = TOOL_ICONS[tc.name] ?? Zap;
                const isAdd = tc.name.startsWith('add_') || tc.name === 'load_template';
                const isRemove = tc.name.includes('remove');
                return (
                  <div key={`${tc.name}-${i}`} className="flex items-center gap-2 py-0.5">
                    <span
                      className={clsx(
                        'w-2.5 text-[10px] font-mono font-bold shrink-0',
                        isAdd ? 'text-green-500' : isRemove ? 'text-red-500' : 'text-blue-500'
                      )}
                    >
                      {isAdd ? '+' : isRemove ? '−' : '~'}
                    </span>
                    <TIcon className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                    <span className="text-[9px] text-[var(--text-muted)] truncate">
                      {tc.description}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Revert button */}
      {!isReverted && onRevert && (
        <div className="px-3 pb-3 pt-1">
          <button
            type="button"
            onClick={onRevert}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-red-500/25 bg-red-500/8 text-red-400 hover:bg-red-500/15 active:scale-[0.98] text-[10px] font-medium transition-all"
          >
            <RotateCcw className="w-3 h-3" />
            Revert these changes
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Plain text message (chat / plan / error) ─────────────────────────────────
function TextMessage({ message }: { message: AgentMessage }) {
  const isError = message.content.startsWith('Error:');
  const isStopped =
    message.content.includes('(Stopped)') || message.content === 'Generation cancelled.';

  return (
    <div className="flex items-start gap-2">
      <div className="w-5 h-5 rounded-full overflow-hidden shrink-0 mt-0.5 bg-[var(--accent-glow)]">
        <img src="/logo.png" alt="AI" className="w-full h-full object-cover" />
      </div>
      <div
        className={clsx(
          'flex-1 text-[11px] leading-relaxed px-3 py-2 rounded-2xl rounded-tl-none',
          isError && 'bg-red-500/10 text-red-400 border border-red-500/20 flex items-start gap-1.5',
          isStopped && 'bg-red-500/5 text-red-400/60 border border-red-500/10 italic',
          !isError &&
            !isStopped &&
            'bg-[var(--bg-widget)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
        )}
      >
        {isError && <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />}
        {isError ? message.content.replace('Error: ', '') : message.content}
      </div>
    </div>
  );
}

// ─── Thinking indicator ───────────────────────────────────────────────────────
function ThinkingIndicator({ step, elapsed }: { step: string; elapsed: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-[var(--accent-glow)] flex items-center justify-center shrink-0">
          <Sparkles className="w-2.5 h-2.5 text-[var(--accent)] animate-pulse" />
        </div>
        <span className="flex-1 text-[11px] text-[var(--text-secondary)] italic truncate">
          {step || 'Thinking...'}
        </span>
        <span className="text-[9px] font-mono text-[var(--accent)] tabular-nums shrink-0">
          {elapsed.toFixed(1)}s
        </span>
      </div>
      <div className="ml-7 h-0.5 bg-[var(--border-subtle)] rounded-full overflow-hidden">
        <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent animate-[shimmer_1.5s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}

// ─── Main AiPanel ─────────────────────────────────────────────────────────────
export const AiPanel = memo(function AiPanel() {
  const [input, setInput] = useState('');
  const [revertedIds, setRevertedIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, isLoading, thinkingStep, sendMessage, clearMessages, stop } = useAiAgent();
  const [elapsedTime, setElapsedTime] = useState(0);

  const aiModel = useDesignerStore((s) => s.aiModel);
  const aiMode = useDesignerStore((s) => s.aiMode);
  const setAiModel = useDesignerStore((s) => s.setAiModel);
  const setAiMode = useDesignerStore((s) => s.setAiMode);
  const rewindToCheckpoint = useDesignerStore((s) => s.rewindToCheckpoint);

  // Elapsed timer while loading
  useEffect(() => {
    if (!isLoading) {
      setElapsedTime(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => setElapsedTime((Date.now() - start) / 1000), 100);
    return () => clearInterval(id);
  }, [isLoading]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isLoading]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    sendMessage(text);
  }, [input, isLoading, sendMessage]);

  const handleRevert = useCallback(
    (msg: AgentMessage) => {
      if (msg.snapshotIndex === undefined) return;
      rewindToCheckpoint(msg.snapshotIndex);
      setRevertedIds((prev) => new Set([...prev, msg.id]));
    },
    [rewindToCheckpoint]
  );

  // Latest non-reverted design turn → drives the sticky revert bar
  const latestRevertable = [...messages]
    .reverse()
    .find(
      (m) =>
        m.role === 'assistant' &&
        m.mode === 'design' &&
        m.snapshotIndex !== undefined &&
        !revertedIds.has(m.id) &&
        (m.toolCalls?.length ?? 0) > 0
    );

  const modelLabel =
    AI_MODELS.find((m) => m.id === aiModel)
      ?.label.split(' ')
      .slice(-2)
      .join(' ') ?? 'Model';

  return (
    <BasePanel allowOverflow>
      <PanelHeader title="AI Designer" icon={Sparkles} />

      {/* ── Conversation history ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2.5 py-3 space-y-3 scrollbar-none">
        {messages.map((msg) => {
          if (msg.role === 'user') {
            return <UserMessage key={msg.id} content={msg.content} />;
          }

          if (
            msg.role === 'assistant' &&
            msg.mode === 'design' &&
            (msg.toolCalls?.length ?? 0) > 0
          ) {
            return (
              <DesignTurnCard
                key={msg.id}
                message={msg}
                onRevert={msg.snapshotIndex !== undefined ? () => handleRevert(msg) : undefined}
                isReverted={revertedIds.has(msg.id)}
              />
            );
          }

          return <TextMessage key={msg.id} message={msg} />;
        })}

        {isLoading && <ThinkingIndicator step={thinkingStep} elapsed={elapsedTime} />}
      </div>

      {/* ── Quick template chips ── */}
      <div className="shrink-0 px-2.5 py-1.5 flex gap-1.5 overflow-x-auto scrollbar-none border-t border-[var(--border-subtle)]/30">
        {QUICK_TEMPLATES.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => {
              setInput(t.prompt);
              textareaRef.current?.focus();
            }}
            className="shrink-0 px-2.5 py-1 rounded-full bg-[var(--bg-widget)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[9px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Composer area ── */}
      <div className="shrink-0 border-t border-[var(--border-default)] bg-[var(--bg-widget)]">
        {/* Sticky revert bar — visible when there are revertable changes */}
        {!isLoading && latestRevertable && (
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-[var(--border-subtle)]/40 bg-yellow-500/5">
            <div className="flex items-center gap-1.5 min-w-0">
              <Zap className="w-3 h-3 text-yellow-400 shrink-0" />
              <span className="text-[9px] text-[var(--text-muted)] truncate">
                {latestRevertable.toolCalls?.length ?? 0} pending changes
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleRevert(latestRevertable)}
              className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-[9px] font-medium transition-all"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              Revert
            </button>
          </div>
        )}

        <div className="p-1.5">
          <div className="rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] focus-within:border-[var(--accent)]/50 transition-colors overflow-hidden">
            <textarea
              ref={textareaRef}
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Describe your template... (Enter to send)"
              className="w-full bg-transparent border-none outline-none ring-0 text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] px-3 pt-3 pb-1 resize-none leading-relaxed"
            />

            <div className="flex items-center justify-between px-2 pb-1.5">
              {/* Left controls */}
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={clearMessages}
                  title="New conversation"
                  className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                </button>

                <div className="w-px h-3 bg-white/10 mx-0.5" />

                {/* Model picker */}
                <DropdownMenu
                  side="top"
                  trigger={
                    <button
                      type="button"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <span className="text-[9px] text-[var(--text-muted)] hover:text-[var(--text-primary)] max-w-[64px] truncate">
                        {modelLabel}
                      </span>
                      <ChevronDown className="w-2.5 h-2.5 text-[var(--text-muted)] shrink-0" />
                    </button>
                  }
                >
                  <DropdownMenuHeader>AI Model</DropdownMenuHeader>
                  {AI_MODELS.map((model) => (
                    <DropdownMenuItem
                      key={model.id}
                      label={model.label}
                      onClick={() => setAiModel(model.id)}
                      className={aiModel === model.id ? 'bg-white/5 text-[var(--accent)]' : ''}
                      rightElement={
                        <span className="text-[9px] uppercase tracking-tighter opacity-40">
                          {model.tier}
                        </span>
                      }
                    />
                  ))}
                </DropdownMenu>

                {/* Mode picker */}
                <DropdownMenu
                  side="top"
                  trigger={
                    <button
                      type="button"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      {aiMode === 'plan' ? (
                        <ListChecks className="w-3 h-3 text-[var(--text-muted)]" />
                      ) : (
                        <Zap className="w-3 h-3 text-yellow-400" />
                      )}
                      <ChevronDown className="w-2.5 h-2.5 text-[var(--text-muted)] shrink-0" />
                    </button>
                  }
                >
                  <DropdownMenuHeader>Agent Mode</DropdownMenuHeader>
                  <DropdownMenuItem
                    icon={() => <ListChecks className="w-3.5 h-3.5" />}
                    label="Plan — describe first"
                    onClick={() => setAiMode('plan')}
                    className={aiMode === 'plan' ? 'bg-white/5 text-[var(--accent)]' : ''}
                  />
                  <DropdownMenuItem
                    icon={() => <Zap className="w-3.5 h-3.5" />}
                    label="Act — build directly"
                    onClick={() => setAiMode('act')}
                    className={aiMode === 'act' ? 'bg-white/5 text-[var(--accent)]' : ''}
                  />
                </DropdownMenu>
              </div>

              {/* Right controls */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="p-1.5 rounded-full bg-[var(--bg-widget)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/30 transition-all"
                  title="Voice input (coming soon)"
                >
                  <Mic className="w-3.5 h-3.5" />
                </button>

                {isLoading ? (
                  <button
                    type="button"
                    onClick={stop}
                    title="Stop generation"
                    className="p-1.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className={clsx(
                      'p-1.5 rounded-full transition-all',
                      input.trim()
                        ? 'bg-[var(--accent)] text-white shadow-[0_0_12px_rgba(var(--accent-rgb,99,102,241),0.4)]'
                        : 'bg-[var(--bg-widget)] text-[var(--text-muted)] border border-[var(--border-subtle)]'
                    )}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </BasePanel>
  );
});
