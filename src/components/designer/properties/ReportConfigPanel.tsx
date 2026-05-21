'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { useDesignerStore } from '@/store/designer-store';
import type { PageConfig } from '@/types/schema';
import { Move, Workflow } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  CollapsibleSection,
  ControlField,
  PANEL_FIELD_STACK,
  PANEL_SELECT_TRIGGER,
  PROPERTY_STACK_CLASS,
  PanelMiniInput,
  PropertyGrid,
  SegmentedControl,
} from './Shared';

const ZONE_LAYOUT_HINT: Record<'absolute' | 'flow', string> = {
  absolute: 'Exact coordinates — drag to place',
  flow: 'Stack top-to-bottom — growing content pushes down',
};

export const ReportConfigPanel = memo(function ReportConfigPanel() {
  const pageConfig = useDesignerStore(useShallow((s) => s.schema.page));
  const pages = useDesignerStore(useShallow((s) => s.schema.pages));
  const zones = useDesignerStore(useShallow((s) => s.schema.zones));
  const activePageId = useDesignerStore((s) => s.activePageId);
  const selectedZoneKey = useDesignerStore((s) => s.selectedZone);
  const updateSchema = useDesignerStore((s) => s.updateSchema);
  const updatePageDataSource = useDesignerStore((s) => s.updatePageDataSource);
  const updateZone = useDesignerStore((s) => s.updateZone);

  const activePage = useMemo(
    () => pages.find((p) => p.id === activePageId) ?? pages[0],
    [pages, activePageId]
  );

  const patchPage = (patch: Partial<PageConfig>) =>
    updateSchema({ page: { ...pageConfig, ...patch } });

  const zone =
    selectedZoneKey === 'body'
      ? activePage?.body
      : selectedZoneKey
        ? zones[selectedZoneKey as 'header' | 'footer']
        : undefined;

  const zoneLayoutMode = zone?.layoutMode ?? 'absolute';

  return (
    <div className={PROPERTY_STACK_CLASS}>
      <CollapsibleSection label="Page Layout">
        <PropertyGrid cols={2} className="gap-2">
          <ControlField label="Paper">
            <Select
              value={pageConfig.size}
              onValueChange={(val) => patchPage({ size: val as PageConfig['size'] })}
            >
              <SelectTrigger className={PANEL_SELECT_TRIGGER}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A4">A4</SelectItem>
                <SelectItem value="A5">A5</SelectItem>
                <SelectItem value="Letter">Letter</SelectItem>
                <SelectItem value="Legal">Legal</SelectItem>
              </SelectContent>
            </Select>
          </ControlField>
          <ControlField label="Orientation">
            <Select
              value={pageConfig.orientation}
              onValueChange={(val) => patchPage({ orientation: val as PageConfig['orientation'] })}
            >
              <SelectTrigger className={PANEL_SELECT_TRIGGER}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">Portrait</SelectItem>
                <SelectItem value="landscape">Landscape</SelectItem>
              </SelectContent>
            </Select>
          </ControlField>
          <ControlField label="Pages" className="col-span-2">
            <PanelMiniInput
              type="number"
              min={1}
              value={pages.length}
              onChange={(v) => useDesignerStore.getState().setPageCount(Number.parseInt(v) || 1)}
              mono
              className="w-full"
            />
          </ControlField>
        </PropertyGrid>
      </CollapsibleSection>

      <CollapsibleSection label="Margins">
        <PropertyGrid cols={2} className="gap-2">
          {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
            <ControlField key={side} label={side.charAt(0).toUpperCase()}>
              <PanelMiniInput
                value={pageConfig.margin[side]}
                onChange={(v) =>
                  patchPage({
                    margin: { ...pageConfig.margin, [side]: v },
                  })
                }
                mono
                placeholder="15mm"
                className="w-full"
              />
            </ControlField>
          ))}
        </PropertyGrid>
      </CollapsibleSection>

      {activePage && (
        <CollapsibleSection label="Batch Data">
          <PanelMiniInput
            value={activePage.dataSource ?? ''}
            onChange={(v) => updatePageDataSource(activePage.id, v.trim() || undefined)}
            placeholder="{{invoices}}"
            mono
            className="w-full"
          />
        </CollapsibleSection>
      )}

      {selectedZoneKey && zone && (
        <CollapsibleSection label={`Zone · ${selectedZoneKey}`}>
          <div className={PANEL_FIELD_STACK}>
            <ControlField label="Layout">
              <SegmentedControl
                value={zoneLayoutMode}
                onChange={(mode) =>
                  updateZone(selectedZoneKey, { layoutMode: mode }, activePageId ?? undefined)
                }
                options={[
                  { value: 'absolute', label: 'Abs', icon: Move, tone: 'accent' },
                  { value: 'flow', label: 'Flow', icon: Workflow, tone: 'emerald' },
                ]}
              />
            </ControlField>
            <p className="text-[8px] text-[var(--text-muted)] leading-snug">
              {ZONE_LAYOUT_HINT[zoneLayoutMode]}
            </p>
            {zoneLayoutMode === 'flow' && (
              <ControlField label="Gap">
                <PanelMiniInput
                  value={zone.flowGap ?? '2mm'}
                  onChange={(v) =>
                    updateZone(selectedZoneKey, { flowGap: v }, activePageId ?? undefined)
                  }
                  mono
                  placeholder="2mm"
                  className="w-full"
                />
              </ControlField>
            )}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
});
