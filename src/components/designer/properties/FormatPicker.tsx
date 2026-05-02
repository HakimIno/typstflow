import { clsx } from 'clsx';
import { Calendar, CheckCircle, Coins, Hash, Percent, Type } from 'lucide-react';

export type FormatType = 
  | 'text' 
  | 'number' 
  | 'currency-thb' 
  | 'currency-usd' 
  | 'date-th' 
  | 'date-en' 
  | 'percent'
  | 'boolean';

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
  { id: 'boolean', label: 'Boolean', icon: CheckCircle, example: 'Yes/No' },
];

export function FormatPicker({ currentValue, onSelect }: FormatPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-1.5 px-3 py-2.5">
      {FORMATS.map((f) => (
        <button
          key={f.id}
          type="button"
          title={`Example: ${f.example}`}
          onClick={() => onSelect(f.id)}
          className={clsx(
            "flex items-center gap-2 px-2 py-1.5 rounded-[4px] border transition-all text-left group overflow-hidden",
            currentValue === f.id 
              ? "bg-[var(--accent)] border-[var(--accent)] shadow-[0_0_12px_rgba(0,111,238,0.2)]" 
              : "bg-white/[0.03] border-[var(--border-default)] hover:border-[var(--border-subtle)] hover:bg-white/[0.06]"
          )}
        >
          <div className={clsx(
            "w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors",
            currentValue === f.id ? "bg-white/20" : "bg-white/[0.04] group-hover:bg-white/[0.08]"
          )}>
            <f.icon className={clsx(
              "w-2.5 h-2.5",
              currentValue === f.id ? "text-white" : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"
            )} />
          </div>
          
          <div className="flex flex-col min-w-0">
            <span className={clsx(
              "text-[9px] font-bold uppercase tracking-tight truncate",
              currentValue === f.id ? "text-white" : "text-[var(--text-secondary)]"
            )}>
              {f.label}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
