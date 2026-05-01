'use client';

import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import { AlertCircle, Braces, CheckCircle2, X } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

export const DataPanel = memo(function DataPanel() {
  const { sampleData, setSampleData } = useDesignerStore(
    useShallow((state) => ({
      sampleData: state.sampleData,
      setSampleData: state.setSampleData,
    }))
  );
  const [jsonString, setJsonString] = useState(JSON.stringify(sampleData, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Keep local sync if store changes externally
    setJsonString(JSON.stringify(sampleData, null, 2));
  }, [sampleData]);

  const handleJsonChange = (val: string) => {
    setJsonString(val);
    try {
      if (!val.trim()) {
        setSampleData({});
        setError(null);
        return;
      }
      const parsed = JSON.parse(val);
      setSampleData(parsed);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const loadExample = () => {
    const example = {
      invoice_no: 'INV-2024-888',
      date: '2024-04-09',
      customer: {
        name: 'บริษัท เทคโนโลยี จำกัด',
        address: '123 ถนนสุขุมวิท กรุงเทพฯ',
      },
      items: [
        { description: 'Industrial Controller v2', qty: 2, price: 15000, total: 30000 },
        { description: 'Sensor Array XP', qty: 5, price: 2500, total: 12500 },
      ],
      subtotal: 42500,
      vat: 2975,
      total: 45475,
    };
    handleJsonChange(JSON.stringify(example, null, 2));
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-surface)] overflow-hidden font-sans border-r border-[var(--border-default)]">
      {/* Utility Header */}
      <div className="px-3 py-2.5 bg-white/5 flex items-center justify-between border-b border-[var(--border-default)] shrink-0">
        <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
          <Braces className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span className="text-[9px] font-bold uppercase tracking-[0.1em]">Data Source</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadExample}
            className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium border border-[var(--border-subtle)] px-2 py-0.5 rounded-[4px] hover:bg-white/5 transition-colors"
          >
            Load Example
          </button>
          <button
            type="button"
            onClick={() => useDesignerStore.getState().setSidebarOpen(false)}
            className="p-1 hover:bg-[var(--bg-hover)] rounded transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-2 border-b border-[var(--border-default)] shrink-0">
        <p className="text-[10px] text-[var(--text-muted)] leading-tight">
          Define JSON schema for data bindings.
        </p>
      </div>

      <div className="flex-1 relative overflow-hidden group">
        <textarea
          value={jsonString}
          onChange={(e) => handleJsonChange(e.target.value)}
          spellCheck={false}
          className={clsx(
            'absolute inset-0 w-full h-full p-4 font-mono text-[11px] resize-none focus:ring-0 border-none transition-colors text-[var(--text-primary)] outline-none',
            error ? 'bg-red-500/5' : 'bg-transparent group-hover:bg-[var(--bg-hover)]'
          )}
          placeholder='{ "key": "value" }'
        />

        {/* Error/Success Indicator */}
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          {error ? (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--bg-surface)] border border-red-500/20 rounded shadow-sm text-red-400 animate-in fade-in slide-in-from-right-2">
              <AlertCircle className="w-3 h-3" />
              <span className="text-[9px] font-bold uppercase">Invalid JSON</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--bg-surface)] border border-green-500/20 rounded shadow-sm text-[var(--green)]">
              <CheckCircle2 className="w-3 h-3" />
              <span className="text-[9px] font-bold uppercase">Valid Data</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-2 bg-red-600 text-white text-[9px] font-mono whitespace-pre-wrap break-all border-t border-red-700">
          {error}
        </div>
      )}
    </div>
  );
});
