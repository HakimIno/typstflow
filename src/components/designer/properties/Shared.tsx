import type React from 'react';

export const PropertyRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex border-b border-[var(--border-default)] last:border-0 hover:bg-white/[0.01] group transition-colors min-h-[28px]">
    <div className="w-[35%] px-2 py-1 text-[9px] font-bold uppercase tracking-tighter text-[var(--text-muted)] bg-black/[0.05] border-r border-[var(--border-default)] flex items-center shrink-0">
      {label}
    </div>
    <div className="flex-1 px-1.5 py-0.5 flex items-center min-h-[28px]">{children}</div>
  </div>
);

export const SectionHeader = ({ label }: { label: string }) => (
  <div className="px-2 py-1 bg-[var(--bg-hover)] border-y border-[var(--border-default)] text-[9px] font-black uppercase tracking-[0.05em] text-[var(--text-muted)] flex items-center gap-1.5">
    {label}
  </div>
);
