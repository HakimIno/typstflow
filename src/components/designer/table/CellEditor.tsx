'use client';

import { clsx } from 'clsx';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  initialValue: string;
  onSave: (val: string) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
}

export function CellEditor({ initialValue, onSave, className, style, placeholder }: Props) {
  const [val, setVal] = useState(initialValue);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setVal(initialValue);
  }, [initialValue]);

  const adjustHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: val triggers height adjustment
  useEffect(() => {
    adjustHeight();
  }, [val, adjustHeight]);

  return (
    <textarea
      ref={ref}
      className={clsx(
        className,
        'resize-none overflow-hidden min-h-[1.4em] p-0 block bg-transparent w-full'
      )}
      style={{ ...style, height: 'auto' }}
      rows={1}
      value={val}
      placeholder={placeholder}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => onSave(val)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}
