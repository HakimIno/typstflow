'use client';

import type { ComponentNode } from '@/types/schema';
import { clsx } from 'clsx';
import {
  Barcode,
  CheckSquare,
  Columns,
  Database,
  FileDigit,
  Layers,
  ListOrdered,
  type LucideIcon,
  Maximize,
  Minus,
  Palette,
  QrCode,
  Repeat,
  SeparatorHorizontal,
  Settings,
  Type,
} from 'lucide-react';
import type { ReactNode } from 'react';

/** Add new component types here — one place for properties panel, palette, bulk edit, etc. */
export const COMPONENT_TYPE_ICONS: Record<ComponentNode['type'], LucideIcon> = {
  text: Type,
  table: Database,
  image: Palette,
  line: Maximize,
  spacer: Minus,
  repeater: Repeat,
  columns: Columns,
  barcode: Barcode,
  qr: QrCode,
  'summary-box': ListOrdered,
  'page-break-indicator': SeparatorHorizontal,
  'page-number': FileDigit,
  checklist: CheckSquare,
};

const FALLBACK_ICON = Settings;

export const getComponentTypeIcon = (type: ComponentNode['type']): LucideIcon =>
  COMPONENT_TYPE_ICONS[type] ?? FALLBACK_ICON;

export const PanelHeaderIconShell = ({
  children,
  muted = false,
}: {
  children: ReactNode;
  muted?: boolean;
}) => (
  <div
    className={clsx(
      'w-5 h-5 flex items-center justify-center shrink-0',
      muted ? 'text-[var(--text-muted)]' : 'text-[var(--accent)]'
    )}
  >
    {children}
  </div>
);

export const PanelHeaderIcon = ({
  icon: Icon,
  muted = false,
  className = 'w-4 h-4',
}: {
  icon: LucideIcon;
  muted?: boolean;
  className?: string;
}) => (
  <PanelHeaderIconShell muted={muted}>
    <div className="bg-[var(--accent)]/10 rounded-full p-1">
      <div className="w-4 h-4 flex items-center justify-center shrink-0">
        <Icon className={className} />
      </div>
    </div>
  </PanelHeaderIconShell>
);

export const ComponentTypeIcon = ({
  type,
  muted = false,
  className = 'w-4 h-4',
}: {
  type: ComponentNode['type'];
  muted?: boolean;
  className?: string;
}) => <PanelHeaderIcon icon={getComponentTypeIcon(type)} muted={muted} className={className} />;

/** Preset icons for non-component panel headers */
export const PANEL_PRESET_ICONS = {
  group: Layers,
  report: Settings,
} as const;
