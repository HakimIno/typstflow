'use client';

import { useAutoFitHeight } from '@/hooks/use-auto-fit-height';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import { resolveBindings } from '@/lib/utils/json-path';
import { parseTypstUnit } from '@/lib/utils/units';
import type { FieldGridComponent, FormFieldDefinition } from '@/types/schema';
import { type ReactNode, memo, useRef } from 'react';

interface Props {
  component: FieldGridComponent;
  sampleData?: Record<string, unknown>;
}

function FieldRow({
  field,
  component,
  sampleData,
  labelWidth,
  showColon,
}: {
  field: FormFieldDefinition;
  component: FieldGridComponent;
  sampleData?: Record<string, unknown>;
  labelWidth: string;
  showColon: boolean;
}) {
  const labelSuffix = showColon ? ' :' : '';
  const labelText = `${field.label}${labelSuffix}`;
  const valueText = resolveBindings(field.value, sampleData) || '—';

  const labelSize = field.labelStyle?.fontSize ?? component.labelStyle?.fontSize ?? 9;
  const valueSize = field.style?.fontSize ?? component.valueStyle?.fontSize ?? 9;
  const labelColor = field.labelStyle?.color ?? component.labelStyle?.color ?? '#334155';
  const valueColor = field.style?.color ?? component.valueStyle?.color ?? '#111827';
  const lw = field.labelWidth ?? labelWidth;

  return (
    <div
      className="grid items-baseline w-full"
      style={{
        gridTemplateColumns: `${lw} 1fr`,
        columnGap: '4px',
      }}
    >
      <span
        style={{
          fontSize: `${labelSize}pt`,
          color: labelColor,
          fontFamily: `${field.labelStyle?.fontFamily ?? component.labelStyle?.fontFamily ?? 'Sarabun'}, sans-serif`,
        }}
      >
        {labelText}
      </span>
      <span
        style={{
          fontSize: `${valueSize}pt`,
          color: valueColor,
          textAlign: field.align ?? 'left',
          fontFamily: `${field.style?.fontFamily ?? component.valueStyle?.fontFamily ?? 'Sarabun'}, sans-serif`,
        }}
      >
        {valueText}
      </span>
    </div>
  );
}

function FieldStack({
  fields,
  component,
  sampleData,
  labelWidth,
  showColon,
  rowGap,
}: {
  fields: FormFieldDefinition[];
  component: FieldGridComponent;
  sampleData?: Record<string, unknown>;
  labelWidth: string;
  showColon: boolean;
  rowGap: string;
}) {
  return (
    <div
      className="flex flex-col w-full"
      style={{ gap: LayoutEngine.mmToPx(parseTypstUnit(rowGap)) }}
    >
      {fields.map((field) => (
        <FieldRow
          key={field.id}
          field={field}
          component={component}
          sampleData={sampleData}
          labelWidth={labelWidth}
          showColon={showColon}
        />
      ))}
    </div>
  );
}

export const FieldGridPreview = memo(function FieldGridPreview({ component, sampleData }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useAutoFitHeight(ref, component.id);

  const fields = component.fields ?? [];
  const labelWidth = component.labelWidth ?? '28mm';
  const rowGap = component.rowGap ?? '1.5mm';
  const columnGap = component.columnGap ?? '4mm';
  const showColon = component.showColon !== false;
  const hasBorder = component.strokeWidth && component.strokeWidth !== '0' && component.strokeWidth !== '0pt';
  const inset = component.inset ?? '2mm';
  const fill = component.fill ?? '#ffffff';
  const strokeColor = component.strokeColor ?? '#64748b';

  let content: ReactNode;

  if (component.columns === 2) {
    const left: FormFieldDefinition[] = [];
    const right: FormFieldDefinition[] = [];
    fields.forEach((field, index) => {
      const col = field.column ?? index % 2;
      if (col === 1) right.push(field);
      else left.push(field);
    });

    content = (
      <div
        className="grid w-full"
        style={{
          gridTemplateColumns: '1fr 1fr',
          gap: LayoutEngine.mmToPx(parseTypstUnit(columnGap)),
        }}
      >
        <FieldStack
          fields={left}
          component={component}
          sampleData={sampleData}
          labelWidth={labelWidth}
          showColon={showColon}
          rowGap={rowGap}
        />
        <FieldStack
          fields={right}
          component={component}
          sampleData={sampleData}
          labelWidth={labelWidth}
          showColon={showColon}
          rowGap={rowGap}
        />
      </div>
    );
  } else {
    content = (
      <FieldStack
        fields={fields}
        component={component}
        sampleData={sampleData}
        labelWidth={labelWidth}
        showColon={showColon}
        rowGap={rowGap}
      />
    );
  }

  if (fields.length === 0) {
    content = (
      <span className="text-[9pt] italic opacity-40" style={{ fontFamily: 'Sarabun, sans-serif' }}>
        No fields — add rows in properties
      </span>
    );
  }

  return (
    <div
      ref={ref}
      className="w-full box-border"
      style={
        hasBorder
          ? {
              backgroundColor: fill,
              border: `1px solid ${strokeColor}`,
              padding: LayoutEngine.mmToPx(parseTypstUnit(inset)),
            }
          : undefined
      }
    >
      {content}
    </div>
  );
});
