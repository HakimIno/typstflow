'use client';

import { useDesignerStore } from '@/store/designer-store';
import { Check, Copy, ExternalLink, Link2, Loader2, X } from 'lucide-react';
import { memo, useState } from 'react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal = memo(function ShareModal({ isOpen, onClose }: ShareModalProps) {
  const schema = useDesignerStore((s) => s.schema);
  const sampleData = useDesignerStore((s) => s.sampleData);

  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreate = async () => {
    setStatus('loading');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema, sampleData }),
      });
      if (!res.ok) {
        const { error } = (await res.json()) as { error?: string };
        throw new Error(error ?? 'Failed to create share link');
      }
      const { id } = (await res.json()) as { id: string };
      const url = `${window.location.origin}/view/${id}`;
      setShareUrl(url);
      setStatus('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setStatus('idle');
    setShareUrl(null);
    setCopied(false);
    setErrorMsg(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#18181f] border border-white/10 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <Link2 className="w-4 h-4 text-violet-400" />
            <h2 className="font-semibold text-sm text-white">Share Template</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-white/40 hover:text-white/70 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {status === 'idle' && (
          <>
            <p className="text-sm text-white/50 mb-5">
              Generate a read-only link — anyone with it can view this template without signing in.
            </p>
            <button
              type="button"
              onClick={handleCreate}
              className="w-full py-2 px-4 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Create Share Link
            </button>
          </>
        )}

        {status === 'loading' && (
          <div className="flex items-center justify-center gap-2 py-6 text-white/50 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Creating link…
          </div>
        )}

        {status === 'done' && shareUrl && (
          <>
            <p className="text-xs text-white/40 mb-3">Share this link:</p>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 mb-4">
              <span className="flex-1 text-xs text-white/70 truncate font-mono">{shareUrl}</span>
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 text-white/50 hover:text-white transition-colors"
                title="Copy link"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Preview in new tab
            </a>
          </>
        )}

        {status === 'error' && (
          <>
            <p className="text-sm text-red-400 mb-4">{errorMsg}</p>
            <button
              type="button"
              onClick={() => setStatus('idle')}
              className="text-xs text-white/50 hover:text-white/70 underline"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
});
