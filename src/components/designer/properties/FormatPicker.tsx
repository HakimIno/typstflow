import { clsx } from 'clsx';
import { Calendar, Coins, Hash, Percent, Type } from 'lucide-react';

export type FormatType = 'text' | 'number' | 'currency-thb' | 'currency-usd' | 'date-th' | 'date-en' | 'percent';

interface FormatPickerProps {
  currentValue: string;
  onSelect: (format: FormatType) => void;
}

const FORMATS: { id: FormatType; label: string; icon: any; example: string }[] = [
  { id: 'text', label: 'Plain Text', icon: Type, example: 'Abc' },
  { id: 'number', label: 'Number', icon: Hash, example: '1,234.56' },
  { id: 'currency-thb', label: 'Currency (฿)', icon: Coins, example: '฿1,234.56' },
  { id: 'currency-usd', label: 'Currency ($)', icon: Coins, example: '$1,234.56' },
  { id: 'date-th', label: 'Date (Thai)', icon: Calendar, example: '9 เม.ย. 67' },
  { id: 'date-en', label: 'Date (EN)', icon: Calendar, example: 'Apr 9, 2024' },
  { id: 'percent', label: 'Percent', icon: Percent, example: '12.5%' },
];

export function FormatPicker({ currentValue, onSelect }: FormatPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-1 px-3 py-2">
      {FORMATS.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onSelect(f.id)}
          className={clsx(
            "flex flex-col items-start p-1.5 rounded border transition-all text-left group",
            currentValue === f.id 
              ? "bg-[var(--accent-glow)] border-[var(--accent)]" 
              : "bg-white/[0.02] border-[var(--border-default)] hover:border-[var(--text-muted)] hover:bg-white/[0.04]"
          )}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <f.icon className={clsx(
              "w-3 h-3",
              currentValue === f.id ? "text-[var(--accent)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"
            )} />
            <span className={clsx(
              "text-[9px] font-bold uppercase tracking-tight",
              currentValue === f.id ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"
            )}>
              {f.label}
            </span>
          </div>
          <span className="text-[8px] text-[var(--text-muted)] font-mono truncate w-full">
            {f.example}
          </span>
        </button>
      ))}
    </div>
  );
}
