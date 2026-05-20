import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { getValueType } from '@/lib/utils/json-path';
import { useDesignerStore } from '@/store/designer-store';
import type {
  BarcodeComponent,
  ChecklistComponent,
  ColumnLayoutComponent,
  ComponentNode,
  ImageComponent,
  LineComponent,
  PageNumberComponent,
  QRComponent,
  SummaryBoxComponent,
  TableComponent,
  TextComponent,
} from '@/types/schema';
import { clsx } from 'clsx';
import {
  Columns,
  Database,
  FileDown,
  Layers,
  Layout,
  Lock,
  Maximize,
  Move,
  Palette,
  Settings,
  Trash2,
  Type,
  Workflow,
} from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { DesignerInput } from '../shared/DesignerInput';
import { TextEditor } from './TextEditor';
import { VariablePicker } from './VariablePicker';
import { AlignmentProperties } from './properties/AlignmentProperties';
import { BulkEditPanel } from './properties/BulkEditPanel';
import { ChecklistProperties } from './properties/ChecklistProperties';
import { ColumnProperties } from './properties/ColumnProperties';
import { FormatPicker } from './properties/FormatPicker';
import { GeometryProperties } from './properties/GeometryProperties';
import { GroupProperties } from './properties/GroupProperties';
import { ImageProperties } from './properties/ImageProperties';
import { LineProperties } from './properties/LineProperties';
import { CollapsibleSection, ControlField, PropertyGrid, PropertyRow, SectionHeader } from './properties/Shared';
import { SummaryBoxProperties } from './properties/SummaryBoxProperties';
import { TypographyProperties } from './properties/TypographyProperties';
import { TableAdvancedSection } from './properties/table/TableAdvancedSection';
import { TableColumnsSection } from './properties/table/TableColumnsSection';
import { TableDataSection } from './properties/table/TableDataSection';
import { TableVisualSection } from './properties/table/TableVisualSection';

// Type guards for safe component access
const isText = (c: ComponentNode): c is TextComponent => c.type === 'text';
const isTable = (c: ComponentNode): c is TableComponent => c.type === 'table';
const isImage = (c: ComponentNode): c is ImageComponent => c.type === 'image';
const isLine = (c: ComponentNode): c is LineComponent => c.type === 'line';
const isSummaryBox = (c: ComponentNode): c is SummaryBoxComponent => c.type === 'summary-box';
const isBarcode = (c: ComponentNode): c is BarcodeComponent =>
  c.type === 'barcode' || c.type === 'qr';
const isPageNumber = (c: ComponentNode): c is PageNumberComponent => c.type === 'page-number';
const isColumns = (c: ComponentNode): c is ColumnLayoutComponent => c.type === 'columns';
const isChecklist = (c: ComponentNode): c is ChecklistComponent => c.type === 'checklist';

type TabType = 'design' | 'layout' | 'data' | 'settings';

export const PropertiesPanel = memo(function PropertiesPanel() {
  const [activeTab, setActiveTab] = useState<TabType>('design');

  const selectedComponentIds = useDesignerStore(useShallow((state) => state.selectedComponentIds));
  const selectedGroupId = useDesignerStore((state) => state.selectedGroupId);
  const selectedZoneKey = useDesignerStore((state) => state.selectedZone);
  const zones = useDesignerStore(useShallow((state) => state.schema.zones));
  const pages = useDesignerStore(useShallow((state) => state.schema.pages));
  const pageConfig = useDesignerStore(useShallow((state) => state.schema.page));
  const sampleData = useDesignerStore((state) => state.sampleData);
  const activePageId = useDesignerStore((state) => state.activePageId);
  const lockedComponentIds = useDesignerStore(useShallow((state) => state.lockedComponentIds));
  // Targeted selector: only re-renders when the primary selected component changes,
  // not on every schema mutation (which would happen with a full registry subscription).
  const selectedComponent = useDesignerStore((s) =>
    s.selectedComponentIds.length > 0
      ? (s.componentRegistry[s.selectedComponentIds[0]] ?? null)
      : null
  );

  // Only active when selectedComponentIds.length > 1; useShallow prevents re-renders
  // when the same components are selected with identical data.
  const bulkSelectedComponents = useDesignerStore(
    useShallow((s) =>
      s.selectedComponentIds.length > 1
        ? (s.selectedComponentIds
            .map((id) => s.componentRegistry[id])
            .filter(Boolean) as ComponentNode[])
        : []
    )
  );

  const updateSchema = useDesignerStore((state) => state.updateSchema);
  const updateComponent = useDesignerStore((state) => state.updateComponent);
  const updateComponents = useDesignerStore((state) => state.updateComponents);
  const updateZone = useDesignerStore((state) => state.updateZone);
  const removeComponent = useDesignerStore((state) => state.removeComponent);
  const removeComponents = useDesignerStore((state) => state.removeComponents);
  const updatePageDataSource = useDesignerStore((state) => state.updatePageDataSource);

  const activePage = useMemo(
    () => pages.find((p) => p.id === activePageId) ?? pages[0],
    [pages, activePageId]
  );

  const isLocked = selectedComponent ? lockedComponentIds.includes(selectedComponent.id) : false;

  const handleNumericUpdate = (key: string, value: string) => {
    if (isLocked) return;
    const num = Number.parseFloat(value);
    if (!Number.isNaN(num) && selectedComponent) {
      updateComponent(selectedComponent.id, { [key]: num });
    }
  };

  const handleStyleUpdate = (updates: any) => {
    if (!selectedComponent || isLocked) return;
    const currentStyle = (selectedComponent as any).style || {};
    updateComponent(selectedComponent.id, {
      style: { ...currentStyle, ...updates },
    } as any);
  };

  // ---- 1. GROUP SELECTION VIEW ----
  if (selectedGroupId) {
    return (
      <div className="h-full flex flex-col bg-[var(--bg-surface)] border-l border-[var(--border-default)]">
        <div className="h-10 bg-white/[0.02] border-b border-[var(--border-default)] flex items-center px-4 gap-2">
          <Layers className="w-4 h-4 text-[var(--accent)]" />
          <span className="text-[12px] font-bold tracking-tight">Group Settings</span>
        </div>
        <div className="flex-1 overflow-auto p-2">
          <GroupProperties groupId={selectedGroupId} />
        </div>
      </div>
    );
  }

  // ---- 2. REPORT SETTINGS VIEW (NO SELECTION) ----
  if (!selectedComponent) {
    return (
      <div className="h-full flex flex-col bg-[var(--bg-surface)] border-l border-[var(--border-default)]">
        <div className="h-10 bg-white/[0.02] border-b border-[var(--border-default)] flex items-center px-4 gap-2">
          <Settings className="w-4 h-4 text-[var(--accent)]" />
          <span className="text-[12px] font-bold tracking-tight">Report Configuration</span>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="space-y-px bg-[var(--border-default)]">
            <section className="bg-[var(--bg-surface)]">
              <SectionHeader label="Page Layout" />
              <PropertyGrid cols={2}>
                <ControlField label="Paper Size">
                  <Select
                    value={pageConfig.size}
                    onValueChange={(val) =>
                      updateSchema({ page: { ...pageConfig, size: val as any } })
                    }
                  >
                    <SelectTrigger className="h-6 text-[10px] bg-[var(--bg-widget)] border-[var(--border-default)]">
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
                    onValueChange={(val) =>
                      updateSchema({
                        page: { ...pageConfig, orientation: val as any },
                      })
                    }
                  >
                    <SelectTrigger className="h-6 text-[10px] bg-[var(--bg-widget)] border-[var(--border-default)]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </ControlField>
                <ControlField label="Page Count" className="col-span-2">
                  <DesignerInput
                    type="number"
                    variant="mini"
                    min={1}
                    value={pages.length}
                    onChange={(v) =>
                      useDesignerStore.getState().setPageCount(Number.parseInt(v) || 1)
                    }
                    mono
                  />
                </ControlField>
              </PropertyGrid>
            </section>

            <section className="bg-[var(--bg-surface)]">
              <SectionHeader label="Page Margins" />
              <PropertyGrid cols={2}>
                {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
                  <ControlField key={side} label={side.charAt(0).toUpperCase()}>
                    <DesignerInput
                      type="text"
                      variant="mini"
                      value={pageConfig.margin[side]}
                      onChange={(v) =>
                        updateSchema({
                          page: {
                            ...pageConfig,
                            margin: { ...pageConfig.margin, [side]: v },
                          },
                        })
                      }
                      mono
                      placeholder="15mm"
                    />
                  </ControlField>
                ))}
              </PropertyGrid>
            </section>

            {activePage && (
              <section className="bg-[var(--bg-surface)]">
                <SectionHeader label="Batch Data Source" />
                <div className="p-2 space-y-2">
                  <DesignerInput
                    value={activePage.dataSource ?? ''}
                    onChange={(v) => updatePageDataSource(activePage.id, v.trim() || undefined)}
                    placeholder="e.g. {{invoices}}"
                    mono
                  />
                </div>
              </section>
            )}

            {selectedZoneKey && (
              <section className="bg-[var(--bg-surface)]">
                <SectionHeader label={`Zone: ${selectedZoneKey.toUpperCase()}`} />
                <div className="p-2 space-y-2">
                  {/* Layout Mode Toggle */}
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1.5 opacity-60">
                      Layout Mode
                    </p>
                    <div className="grid grid-cols-2 gap-px bg-[var(--border-default)] border border-[var(--border-default)] rounded overflow-hidden">
                      {(
                        [
                          {
                            mode: 'absolute',
                            label: 'Absolute',
                            icon: Move,
                            desc: 'Drag & drop positioning',
                          },
                          {
                            mode: 'flow',
                            label: 'Flow',
                            icon: Workflow,
                            desc: 'Stack vertically, auto-push',
                          },
                        ] as const
                      ).map(({ mode, label, icon: Icon, desc }) => {
                        const currentZone =
                          selectedZoneKey === 'body'
                            ? activePage?.body
                            : zones[selectedZoneKey as 'header' | 'footer'];
                        const currentMode = currentZone?.layoutMode ?? 'absolute';
                        const isActive = currentMode === mode;
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => {
                              updateZone(
                                selectedZoneKey,
                                { layoutMode: mode },
                                activePageId ?? undefined
                              );
                            }}
                            title={desc}
                            className={clsx(
                              'flex flex-col items-center gap-1 px-2 py-2 transition-all',
                              isActive
                                ? mode === 'flow'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'bg-[var(--accent)]/10 text-[var(--accent)]'
                                : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:bg-white/[0.02]'
                            )}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span className="text-[8px] font-bold uppercase tracking-wider">
                              {label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[8px] text-[var(--text-muted)] mt-1.5 opacity-60 leading-relaxed italic">
                      {(selectedZoneKey === 'body'
                        ? activePage?.body.layoutMode
                        : zones[selectedZoneKey as 'header' | 'footer']?.layoutMode) === 'flow'
                        ? 'Components stack top-to-bottom. Growing tables automatically push content below them down.'
                        : 'Components positioned at exact coordinates. Drag & drop to place anywhere.'}
                    </p>
                  </div>

                  {/* Flow Gap (only in flow mode) */}
                  {(selectedZoneKey === 'body'
                    ? activePage?.body.layoutMode
                    : zones[selectedZoneKey as 'header' | 'footer']?.layoutMode) === 'flow' && (
                    <PropertyRow label="Gap">
                      <DesignerInput
                        type="text"
                        variant="mini"
                        value={
                          (selectedZoneKey === 'body'
                            ? activePage?.body.flowGap
                            : zones[selectedZoneKey as 'header' | 'footer']?.flowGap) ?? '2mm'
                        }
                        onChange={(v) =>
                          updateZone(selectedZoneKey, { flowGap: v }, activePageId ?? undefined)
                        }
                        placeholder="2mm"
                        mono
                      />
                    </PropertyRow>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- 3. MULTIPLE SELECTION VIEW ----
  if (selectedComponentIds.length > 1) {
    const handleBulkUpdate = (updates: Partial<ComponentNode>) => {
      const updatesMap: Record<string, Partial<ComponentNode>> = {};
      for (const comp of bulkSelectedComponents) {
        updatesMap[comp.id] = updates;
      }
      updateComponents(updatesMap);
    };

    const handleBulkStyleUpdate = (styleUpdates: any) => {
      const updatesMap: Record<string, Partial<ComponentNode>> = {};
      for (const comp of bulkSelectedComponents) {
        const currentStyle = (comp as any).style || {};
        updatesMap[comp.id] = { style: { ...currentStyle, ...styleUpdates } } as any;
      }
      updateComponents(updatesMap);
    };

    return (
      <BulkEditPanel
        selectedComponents={bulkSelectedComponents}
        onBulkUpdate={handleBulkUpdate}
        onBulkStyleUpdate={handleBulkStyleUpdate}
        onDeleteAll={() => removeComponents(selectedComponentIds)}
      />
    );
  }

  // ---- 4. SINGLE COMPONENT VIEW (MAIN INSPECTOR) ----
  const renderTabContent = () => {
    switch (activeTab) {
      case 'design':
        return (
          <div className="space-y-1 animate-in fade-in duration-200">
            <section className="border border-[var(--border-default)] rounded-[4px] overflow-hidden bg-[var(--bg-widget)]">
              {(isText(selectedComponent) ||
                isTable(selectedComponent) ||
                isPageNumber(selectedComponent) ||
                isChecklist(selectedComponent)) && (
                <TypographyProperties
                  style={(selectedComponent as any).style}
                  onUpdateStyle={handleStyleUpdate}
                />
              )}
              {isLine(selectedComponent) && (
                <LineProperties
                  component={selectedComponent}
                  onUpdate={(updates) => updateComponent(selectedComponent.id, updates)}
                />
              )}
              {isSummaryBox(selectedComponent) && (
                <SummaryBoxProperties
                  component={selectedComponent}
                  onUpdate={(updates) => updateComponent(selectedComponent.id, updates)}
                />
              )}
            </section>

            <section className="border border-[var(--border-default)] rounded-[4px] overflow-hidden bg-[var(--bg-widget)]">
              <AlignmentProperties
                align={selectedComponent.align || 'left'}
                onUpdateAlign={(align) => {
                  updateComponent(selectedComponent.id, { align });
                  if (align === 'justify' && isText(selectedComponent)) {
                    handleStyleUpdate({ justify: true });
                  } else if (isText(selectedComponent)) {
                    handleStyleUpdate({ justify: false });
                  }
                }}
              />
              {(() => {
                const hasBinding =
                  isText(selectedComponent) && (selectedComponent.content || '').includes('{{');
                if (!hasBinding) return null;

                return (
                  <div className="border-t border-[var(--border-default)]">
                    <SectionHeader label="Format Settings" />
                    <div className="p-1.5">
                      <FormatPicker
                        currentValue={selectedComponent.format || 'text'}
                        valueType={(() => {
                          const match = (selectedComponent.content || '').match(/\{\{([^}]+)\}\}/);
                          if (match) return getValueType(sampleData, match[1].trim());
                          return undefined;
                        })()}
                        onSelect={(format) => updateComponent(selectedComponent.id, { format })}
                      />
                    </div>
                  </div>
                );
              })()}
            </section>

            {isTable(selectedComponent) && (
              <>
                <CollapsibleSection label="Table Columns" defaultOpen={true}>
                  <TableColumnsSection component={selectedComponent} />
                </CollapsibleSection>
                <TableVisualSection component={selectedComponent} />
              </>
            )}

            {isColumns(selectedComponent) && (
              <div className="border border-[var(--border-default)] rounded-[4px] overflow-hidden bg-[var(--bg-widget)]">
                <ColumnProperties component={selectedComponent} />
              </div>
            )}

            {isChecklist(selectedComponent) && (
              <div className="border border-[var(--border-default)] rounded-[4px] overflow-hidden bg-[var(--bg-widget)]">
                <ChecklistProperties
                  component={selectedComponent}
                  onUpdate={(updates) => updateComponent(selectedComponent.id, updates as any)}
                />
              </div>
            )}
          </div>
        );

      case 'layout':
        return (
          <div className="space-y-1 animate-in fade-in duration-200">
            <section className="border border-[var(--border-default)] rounded-[4px] overflow-hidden bg-[var(--bg-widget)]">
              <GeometryProperties
                x={selectedComponent.x || 0}
                y={selectedComponent.y || 0}
                width={selectedComponent.width || 0}
                height={selectedComponent.height || 0}
                onUpdate={handleNumericUpdate}
              />
            </section>

            <section className="border border-[var(--border-default)] rounded-[4px] overflow-hidden bg-[var(--bg-widget)]">
              <SectionHeader label="Page Flow" />
              <div className="p-1.5">
                <button
                  type="button"
                  onClick={() =>
                    updateComponent(selectedComponent.id, {
                      pageBreakBefore: !selectedComponent.pageBreakBefore,
                    })
                  }
                  className={clsx(
                    'flex items-center justify-center gap-2 px-2 py-1 text-[9px] font-bold rounded-[4px] transition-all w-full border uppercase tracking-widest',
                    selectedComponent.pageBreakBefore
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-default)] hover:bg-[var(--bg-hover)]'
                  )}
                >
                  <FileDown className="w-3.5 h-3.5" />
                  {selectedComponent.pageBreakBefore ? 'Page Break Active' : 'Auto Flow'}
                </button>
              </div>
            </section>
          </div>
        );

      case 'data':
        return (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Main Content Area */}
            <div className="space-y-3">
              {isText(selectedComponent) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">
                      Text Content
                    </span>
                    <VariablePicker
                      sampleData={sampleData}
                      onSelect={(_path, binding) => {
                        const currentContent = selectedComponent.content || '';
                        updateComponent(selectedComponent.id, {
                          content: currentContent + binding,
                        });
                      }}
                    />
                  </div>
                  <TextEditor
                    value={selectedComponent.content || ''}
                    onChange={(value) => updateComponent(selectedComponent.id, { content: value })}
                    sampleData={sampleData}
                    textStyle={selectedComponent.style}
                    placeholder="Type static text or use {{variables}}..."
                    className="rounded-[4px] border border-[var(--border-default)] bg-[var(--bg-widget)]/50 min-h-[120px] text-[11px] focus-within:border-[var(--accent)] transition-all"
                  />
                </div>
              )}

              {isTable(selectedComponent) && (
                <TableDataSection component={selectedComponent} />
              )}

              {isBarcode(selectedComponent) && (
                <div className="space-y-3 bg-[var(--bg-widget)] p-3 rounded-[4px] border border-[var(--border-default)]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[var(--text-primary)]">
                      Barcode Data
                    </span>
                    <VariablePicker
                      sampleData={sampleData}
                      onSelect={(_path, binding) =>
                        updateComponent(selectedComponent.id, { value: binding })
                      }
                    />
                  </div>
                  <PropertyRow label="Value Binding">
                    <DesignerInput
                      type="text"
                      value={(selectedComponent as BarcodeComponent | QRComponent).value || ''}
                      onChange={(v) => updateComponent(selectedComponent.id, { value: v })}
                      mono
                      placeholder="{{item.id}}"
                      className="bg-[var(--bg-surface)]"
                    />
                  </PropertyRow>
                </div>
              )}

              {isImage(selectedComponent) && (
                <div className="bg-[var(--bg-widget)] rounded-[4px] border border-[var(--border-default)] overflow-hidden">
                  <SectionHeader label="Image Configuration" />
                  <div className="p-1">
                    <ImageProperties
                      component={selectedComponent}
                      onUpdate={(updates) => updateComponent(selectedComponent.id, updates as any)}
                    />
                  </div>
                </div>
              )}

              {isPageNumber(selectedComponent) && (
                <div className="bg-[var(--bg-widget)] p-3 rounded-[4px] border border-[var(--border-default)] space-y-2">
                  <span className="text-[9px] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">
                    Page Format
                  </span>
                  <DesignerInput
                    type="text"
                    value={selectedComponent.format || ''}
                    onChange={(v) => updateComponent(selectedComponent.id, { format: v })}
                    placeholder="หน้าที่ {{page}} / {{pageTotal}}"
                    className="bg-[var(--bg-surface)]"
                  />
                  <p className="text-[8px] text-[var(--text-muted)] italic opacity-60">
                    Use {'{{page}}'} and {'{{pageTotal}}'} tokens.
                  </p>
                </div>
              )}
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-1 animate-in fade-in duration-200">
            <section className="border border-[var(--border-default)] rounded-[4px] overflow-hidden bg-[var(--bg-widget)]">
              <SectionHeader label="System Settings" />
              <div className="space-y-0">
                <PropertyRow label="Object ID">
                  <span className="text-[9px] font-mono text-[var(--text-muted)] bg-black/10 px-1 py-0.5 rounded-[2px] border border-[var(--border-default)] truncate max-w-[120px] block">
                    {selectedComponent.id}
                  </span>
                </PropertyRow>
                <PropertyRow label="Type">
                  <span className="text-[9px] font-bold text-[var(--accent)] uppercase tracking-widest">
                    {selectedComponent.type}
                  </span>
                </PropertyRow>
              </div>
            </section>

            {isTable(selectedComponent) && (
              <TableAdvancedSection component={selectedComponent} />
            )}

            {/* <section className="bg-[var(--bg-widget)] rounded border border-[var(--border-default)] overflow-hidden">
              <SectionHeader label="Zone Configuration" />
              <div className="p-2 space-y-0">
                {(selectedZoneKey === 'header' || selectedZoneKey === 'footer') && (
                  <PropertyRow label="Global Repeat">
                    <button
                      type="button"
                      onClick={() => {
                        const zone = zones[selectedZoneKey as 'header' | 'footer'];
                        const newValue = !zone.repeatOnEveryPage;
                        updateZone(selectedZoneKey as any, {
                          repeatOnEveryPage: newValue,
                          showOnFirstPageOnly: false,
                          showOnLastPageOnly: false,
                        });
                      }}
                      className={clsx(
                        'flex items-center justify-center gap-2 px-3 py-1.5 text-[10px] font-bold rounded-md transition-all w-full border',
                        zones[selectedZoneKey as 'header' | 'footer'].repeatOnEveryPage
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-default)]'
                      )}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      {zones[selectedZoneKey as 'header' | 'footer'].repeatOnEveryPage ? 'Repeats on Every Page' : 'Static (One Page Only)'}
                    </button>
                  </PropertyRow>
                )}
                <div className="p-2 rounded bg-blue-500/5 border border-blue-500/10 flex gap-2 mt-2">
                  <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-[9px] text-blue-300/80 leading-relaxed">
                    Components in the <strong>{selectedZoneKey}</strong> zone are managed according to the zone settings.
                  </p>
                </div>
              </div>
            </section> */}
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg-surface)]">
      {/* Header with Component Icon */}
      <div className="h-10 min-h-[40px] border-b border-[var(--border-default)] flex items-center px-2 justify-between bg-white/[0.01]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[var(--accent-glow)] flex items-center justify-center  border-[var(--border-accent)] text-[var(--accent)]">
            {isText(selectedComponent) && <Type className="w-3.5 h-3.5" />}
            {isTable(selectedComponent) && <Database className="w-3.5 h-3.5" />}
            {isImage(selectedComponent) && <Palette className="w-3.5 h-3.5" />}
            {isLine(selectedComponent) && <Maximize className="w-3.5 h-3.5" />}
            {isColumns(selectedComponent) && <Columns className="w-3.5 h-3.5" />}
            {!isText(selectedComponent) &&
              !isTable(selectedComponent) &&
              !isImage(selectedComponent) &&
              !isLine(selectedComponent) &&
              !isColumns(selectedComponent) && <Settings className="w-3.5 h-3.5" />}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold tracking-tight text-[var(--text-primary)] uppercase">
                {selectedComponent.type}
              </span>
              {isLocked && <Lock className="w-2.5 h-2.5 text-orange-400" />}
            </div>
            <span className="text-[8px] text-[var(--text-muted)] font-mono">
              {isLocked ? 'READ ONLY (LOCKED)' : `ID: ${selectedComponent.id.slice(0, 8)}`}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => removeComponent(selectedComponent.id)}
          disabled={isLocked}
          className={clsx(
            'p-1.5 rounded transition-colors',
            isLocked
              ? 'opacity-20 cursor-not-allowed text-[var(--text-muted)]'
              : 'hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500'
          )}
          title={isLocked ? 'Cannot delete locked component' : 'Delete component'}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-[var(--border-default)] bg-white/[0.02]">
        {(
          [
            { id: 'design', icon: Palette, label: 'Design' },
            { id: 'layout', icon: Layout, label: 'Layout' },
            { id: 'data', icon: Database, label: 'Content' },
            { id: 'settings', icon: Settings, label: 'Setup' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex-1 py-2 flex flex-col items-center gap-0.5 transition-all border-b-2',
              activeTab === tab.id
                ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/5'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.02]'
            )}
          >
            <tab.icon className="w-3 h-3" />
            <span className="text-[8px] font-bold uppercase tracking-tighter">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className={clsx('flex-1 overflow-auto relative', isLocked && 'select-none')}>
        {isLocked && (
          <div className="absolute inset-0 bg-[var(--bg-surface)]/20 backdrop-blur-[1px] z-50 flex items-start justify-center pt-20 pointer-events-none">
            <div className="bg-black/40 border border-white/5 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-2xl animate-in zoom-in-95 duration-200">
              <Lock className="w-3 h-3 text-orange-400" />
              <span className="text-[10px] font-bold text-white/90 uppercase tracking-widest">
                Locked
              </span>
            </div>
          </div>
        )}
        <div className={clsx(isLocked && 'pointer-events-none opacity-50 grayscale-[0.5]')}>
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
});
