import type React from 'react';

export const PropertyRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex border-b border-[var(--border-default)] last:border-0 hover:bg-white/[0.02] group transition-colors">
    <div className="w-1/3 px-3 py-2 text-[10px] font-medium text-[var(--text-secondary)] bg-white/[0.01] border-r border-[var(--border-default)] flex items-center shrink-0">
      {label}
    </div>
    <div className="flex-1 px-2 py-1.5 flex items-center overflow-hidden">{children}</div>
  </div>
);

export const SectionHeader = ({ label }: { label: string }) => (
  <div className="px-3 py-1.5 bg-white/[0.03] border-b border-[var(--border-default)] text-[11px] font-bold text-[var(--text-muted)]">
    {label}
  </div>
);
