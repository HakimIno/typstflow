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
  readOnly?: boolean;
}

export function CellEditor({
  initialValue,
  onSave,
  className,
  style,
  placeholder,
  readOnly = false,
}: Props) {
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
      readOnly={readOnly}
      tabIndex={readOnly ? -1 : 0}
      className={clsx(
        className,
        'resize-none overflow-hidden min-h-[1.4em] p-0 block bg-transparent w-full',
        'focus:outline-none focus:ring-0',
        readOnly && 'pointer-events-none select-none'
      )}
      style={{ ...style, height: 'auto' }}
      rows={1}
      value={val}
      placeholder={placeholder}
      onChange={(e) => {
        if (readOnly) return;
        setVal(e.target.value);
      }}
      onMouseDown={(e) => {
        if (readOnly) e.preventDefault();
      }}
      onBlur={() => {
        if (readOnly) return;
        onSave(val);
      }}
      onKeyDown={(e) => {
        if (readOnly) return;
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}
