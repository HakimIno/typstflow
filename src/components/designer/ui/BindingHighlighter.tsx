'use client';

import { clsx } from 'clsx';
import type React from 'react';

type Token =
  | { kind: 'text'; value: string }
  | { complete: boolean; kind: 'binding'; value: string };

interface BindingHighlighterProps {
  value: string;
  placeholder?: string;
  className?: string;
  highlighterRef?: React.Ref<HTMLDivElement>;
  style?: React.CSSProperties;
  trailingBreak?: boolean;
}

function tokenizeBindings(value: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;

  while (cursor < value.length) {
    const start = value.indexOf('{{', cursor);
    if (start === -1) {
      tokens.push({ kind: 'text', value: value.slice(cursor) });
      break;
    }

    if (start > cursor) {
      tokens.push({ kind: 'text', value: value.slice(cursor, start) });
    }

    const end = value.indexOf('}}', start + 2);
    if (end === -1) {
      tokens.push({ complete: false, kind: 'binding', value: value.slice(start + 2) });
      break;
    }

    tokens.push({ complete: true, kind: 'binding', value: value.slice(start + 2, end) });
    cursor = end + 2;
  }

  return tokens.length ? tokens : [{ kind: 'text', value }];
}

export function BindingHighlighter({
  value,
  placeholder,
  className,
  highlighterRef,
  style,
  trailingBreak = false,
}: BindingHighlighterProps) {
  if (!value) {
    return (
      <div ref={highlighterRef} aria-hidden className={className} style={style}>
        {placeholder && (
          <span className="pointer-events-none text-slate-300 italic">{placeholder}</span>
        )}
      </div>
    );
  }

  return (
    <div ref={highlighterRef} aria-hidden className={className} style={style}>
      {tokenizeBindings(value).map((token, index) => {
        if (token.kind === 'text') return <span key={index}>{token.value}</span>;

        const path = token.value.trim();
        return (
          <span
            key={index}
            className={clsx(
              'rounded-[3px] bg-sky-400/10 outline outline-1 outline-sky-400/20',
              !token.complete && 'bg-amber-400/10 outline-amber-400/30'
            )}
          >
            <span className="text-fuchsia-500">{'{{'}</span>
            <span className={token.complete ? 'text-sky-600' : 'text-amber-600'}>{path}</span>
            {token.complete && <span className="text-fuchsia-500">{'}}'}</span>}
          </span>
        );
      })}
      {trailingBreak && value.endsWith('\n') && <br />}
    </div>
  );
}
