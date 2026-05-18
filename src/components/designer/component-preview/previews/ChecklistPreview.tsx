import type { ChecklistComponent } from '@/types/schema';
import { type CSSProperties, memo } from 'react';

interface Props {
  component: ChecklistComponent;
  sampleData?: Record<string, unknown>;
}

function toRoman(num: number): string {
  const map: [number, string][] = [
    [10, 'x'],
    [9, 'ix'],
    [5, 'v'],
    [4, 'iv'],
    [1, 'i'],
  ];
  let result = '';
  let remaining = num;
  for (const [val, sym] of map) {
    while (remaining >= val) {
      result += sym;
      remaining -= val;
    }
  }
  return result;
}

/** Maps checkboxShape → CSS border-radius */
function shapeToCssRadius(shape: string): string {
  if (shape === 'square') return '0';
  if (shape === 'circle') return '50%';
  return '0.2em'; // rounded
}

/**
 * CSS checkbox that mirrors cheq package symbols.
 * Centering note: parent MUST be `display:flex; align-items:center; line-height:1`
 */
function CheckboxMark({
  checked,
  color,
  fill = '#ffffff',
  checkMark = 'x',
  shape = 'rounded',
  size,
}: {
  checked: boolean;
  color: string;
  fill?: string;
  checkMark?: string;
  shape?: string;
  size?: number;
}) {
  const dim = size !== undefined ? `${size}pt` : '0.85em';
  const borderRadius = shapeToCssRadius(shape);
  const border = `0.07em solid ${color}`;

  const base: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: dim,
    height: dim,
    minWidth: dim,
    borderRadius,
    border,
    flexShrink: 0,
    boxSizing: 'border-box',
  };

  if (!checked) {
    // unchecked-sym: empty box with custom fill background
    return <span style={{ ...base, backgroundColor: fill }} />;
  }

  if (checkMark === '/') {
    // incomplete-sym: left half filled with color, right half with fill
    return (
      <span style={{ ...base, backgroundColor: fill, overflow: 'hidden' }}>
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '50%',
            height: '100%',
            backgroundColor: color,
            borderRadius: `${borderRadius} 0 0 ${borderRadius}`,
          }}
        />
      </span>
    );
  }

  if (checkMark === '-') {
    // canceled-sym: filled box with white horizontal bar
    return (
      <span style={{ ...base, backgroundColor: color }}>
        <span
          style={{ display: 'block', width: '55%', height: '13%', backgroundColor: '#ffffff' }}
        />
      </span>
    );
  }

  // Default 'x': checked-sym — filled box with SVG checkmark
  return (
    <span style={{ ...base, backgroundColor: color }}>
      <svg
        viewBox="0 0 10 10"
        style={{ width: '60%', height: '60%' }}
        aria-hidden="true"
        role="presentation"
      >
        <polyline
          points="1.5,5 4,7.5 8.5,2.5"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function BulletMark({ char }: { char: string }) {
  return (
    <span
      style={{
        minWidth: '1.2em',
        flexShrink: 0,
        textAlign: 'left',
        opacity: 0.7,
      }}
    >
      {char}
    </span>
  );
}

export const ChecklistPreview = memo(function ChecklistPreview({ component, sampleData }: Props) {
  const {
    listStyle = 'bullet',
    items,
    dataSource,
    labelField,
    checkedField,
    style,
    spacing = 4,
    marker,
    checkboxColor = '#616161',
    checkboxFill = '#ffffff',
    checkMark = 'x',
    checkboxSize,
    checkboxShape = 'rounded',
    direction = 'vertical',
    columns = 2,
  } = component;

  // Resolve display items
  let displayItems: Array<{ label: string; checked: boolean }>;
  if (dataSource && sampleData) {
    const path = dataSource.replace(/\{\{|\}\}/g, '').trim();
    let val: unknown = sampleData;
    for (const p of path.split('.')) val = (val as Record<string, unknown>)?.[p];
    const arr = Array.isArray(val) ? val : [];
    const lf = labelField ?? 'label';
    const cf = checkedField ?? 'checked';
    displayItems = (arr as Record<string, unknown>[]).slice(0, 10).map((item) => ({
      label: String(item?.[lf] ?? ''),
      checked: Boolean(item?.[cf]),
    }));
  } else {
    displayItems = (items ?? []).map((it) => ({ label: it.label, checked: it.checked ?? false }));
  }

  const fontSize = style?.fontSize ?? 10;
  const fontWeight = (() => {
    const w = style?.fontWeight;
    if (!w) return 'normal';
    if (typeof w === 'number') return String(w);
    if (w === 'bold' || w === 'semibold' || w === 'extrabold' || w === 'black') return 'bold';
    if (w === 'thin' || w === 'extralight' || w === 'light') return '300';
    if (w === 'medium') return '500';
    return 'normal';
  })();
  const fontStyle = style?.italic ? 'italic' : 'normal';
  const decorations: string[] = [];
  if (style?.underline) decorations.push('underline');
  if (style?.strikethrough) decorations.push('line-through');
  const textDecoration = decorations.length > 0 ? decorations.join(' ') : 'none';
  const textColor = style?.color ?? '#0f172a';
  const fontFamily = `${style?.fontFamily ?? 'Sarabun'}, "Geist", "Noto Sans Thai", sans-serif`;
  const lineHeight = style?.lineHeight ?? 1.4;
  const letterSpacing = style?.letterSpacing ?? 'normal';

  const itemGap = `${spacing * 0.6}px`;
  // gap between mark and label text
  const markGap = checkboxSize !== undefined ? `${checkboxSize * 0.4}pt` : '0.35em';

  const renderMark = (i: number, checked: boolean) => {
    if (listStyle === 'checkbox') {
      return (
        <CheckboxMark
          checked={checked}
          color={checkboxColor}
          fill={checkboxFill}
          checkMark={checkMark}
          shape={checkboxShape}
          size={checkboxSize}
        />
      );
    }
    const char =
      listStyle === 'numbered'
        ? `${i + 1}.`
        : listStyle === 'alpha'
          ? `${String.fromCharCode(97 + i)}.`
          : listStyle === 'roman'
            ? `${toRoman(i + 1)}.`
            : listStyle === 'dash'
              ? '–'
              : listStyle === 'custom'
                ? (marker ?? '→')
                : '•';
    return <BulletMark char={char} />;
  };

  /**
   * Row item: line-height: 1 + explicit gap between mark and label
   * ensures the checkbox is vertically centered with the first text line.
   */
  const renderItem = (item: { label: string; checked: boolean }, i: number) => (
    <div
      key={i}
      style={{
        display: 'flex',
        alignItems: 'center',
        lineHeight: 1,
        gap: markGap,
        marginBottom: direction === 'vertical' ? itemGap : 0,
      }}
    >
      {renderMark(i, item.checked)}
      <span
        style={{ lineHeight, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {item.label || <span style={{ opacity: 0.3 }}>…</span>}
      </span>
    </div>
  );

  const containerStyle: CSSProperties = {
    fontFamily,
    fontSize: `${fontSize}pt`,
    fontWeight,
    fontStyle,
    textDecoration,
    color: textColor,
    letterSpacing,
  };

  let content: React.ReactNode;

  if (direction === 'horizontal') {
    content = (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: itemGap, alignItems: 'center' }}>
        {displayItems.map((item, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              lineHeight: 1,
              gap: markGap,
              flexShrink: 0,
            }}
          >
            {renderMark(i, item.checked)}
            <span style={{ lineHeight }}>
              {item.label || <span style={{ opacity: 0.3 }}>…</span>}
            </span>
          </div>
        ))}
      </div>
    );
  } else if (direction === 'grid') {
    const cols = Math.max(1, columns);
    content = (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: itemGap,
        }}
      >
        {displayItems.map((item, i) => renderItem(item, i))}
      </div>
    );
  } else {
    content = <div>{displayItems.map((item, i) => renderItem(item, i))}</div>;
  }

  return (
    <div className="w-full h-full overflow-hidden" style={containerStyle}>
      {displayItems.length === 0 && (
        <span style={{ opacity: 0.3, fontStyle: 'italic', fontSize: '9pt' }}>No items</span>
      )}
      {content}
    </div>
  );
});
