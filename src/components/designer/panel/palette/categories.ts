import {
  Building2,
  Columns,
  FileDown,
  Frame,
  Hash,
  Image,
  LayoutDashboard,
  ListChecks,
  Minus,
  PenLine,
  QrCode,
  RectangleHorizontal,
  Rows3,
  Signature,
  Space,
  Table,
  Table2,
  TextCursorInput,
  Type,
} from 'lucide-react';
import type { ComponentType } from 'react';

export interface PaletteItemProps {
  type: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

// Adding a new item type here also requires a case in `component-templates.ts`
// (createDefaultComponent) and, for a custom drag preview, in `PaletteDragPreview.tsx`.
export const CATEGORIES = [
  {
    id: 'widgets',
    label: 'Standard Widgets',
    items: [
      { type: 'table', label: 'Data Table', icon: Table },
      { type: 'summary-box', label: 'Summary Box', icon: LayoutDashboard },
      { type: 'checklist', label: 'Checklist', icon: ListChecks },
    ],
  },
  {
    id: 'thai-form',
    label: 'Thai Form Kit',
    items: [
      { type: 'letterhead', label: 'Letterhead', icon: Building2 },
      { type: 'field-grid', label: 'Field Grid', icon: Rows3 },
      { type: 'form-table', label: 'Form Table', icon: Table2 },
      { type: 'form-box', label: 'Form Box', icon: Frame },
      { type: 'signature-block', label: 'Signature Block', icon: Signature },
      { type: 'fill-in', label: 'Fill-in Line', icon: TextCursorInput },
    ],
  },
  {
    id: 'basics',
    label: 'Common',
    items: [
      { type: 'text', label: 'Text Field', icon: Type },
      { type: 'image', label: 'Picture', icon: Image },
      { type: 'line', label: 'Line Divider', icon: Minus },
      { type: 'rectangle', label: 'Rectangle', icon: RectangleHorizontal },
      { type: 'signature', label: 'Signature Line', icon: PenLine },
    ],
  },
  {
    id: 'advanced',
    label: 'Data Rendering',
    items: [{ type: 'qr', label: 'QR Code', icon: QrCode }],
  },
  {
    id: 'layout',
    label: 'Layout',
    items: [
      { type: 'columns', label: 'Columns', icon: Columns },
      { type: 'spacer', label: 'Space', icon: Space },
      { type: 'page-number', label: 'Page Number', icon: Hash },
      { type: 'page-break-indicator', label: 'Page Break', icon: FileDown },
    ],
  },
];
