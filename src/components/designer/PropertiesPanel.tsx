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
  RectangleComponent,
  SignatureComponent,
  SummaryBoxComponent,
  TableComponent,
  TextComponent,
  TextStyle,
} from '@/types/schema';
import { clsx } from 'clsx';
import { Blocks, Database, Layout, Lock, Palette, Settings, Trash2 } from 'lucide-react';
import { memo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { DesignerInput } from '../shared/DesignerInput';
import { ComponentTypeIcon, PANEL_PRESET_ICONS, PanelHeaderIcon } from './ComponentTypeIcon';
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
import { RectangleProperties } from './properties/RectangleProperties';
import { ReportConfigPanel } from './properties/ReportConfigPanel';
import {
  CollapsibleSection,
  PANEL_SECTION_BODY,
  PROPERTY_SECTION_CLASS,
  PROPERTY_STACK_CLASS,
  PropertyRow,
  SectionHeader,
} from './properties/Shared';
import { SignatureProperties } from './properties/SignatureProperties';
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
const isRectangle = (c: ComponentNode): c is RectangleComponent => c.type === 'rectangle';
const isSignature = (c: ComponentNode): c is SignatureComponent => c.type === 'signature';

type TabType = 'design' | 'layout' | 'data' | 'settings';

export const PropertiesPanel = memo(function PropertiesPanel() {
  const [activeTab, setActiveTab] = useState<TabType>('design');

  const selectedComponentIds = useDesignerStore(useShallow((state) => state.selectedComponentIds));
  const selectedGroupId = useDesignerStore((state) => state.selectedGroupId);
  const sampleData = useDesignerStore((state) => state.sampleData);
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

  const updateComponent = useDesignerStore((state) => state.updateComponent);
  const updateComponents = useDesignerStore((state) => state.updateComponents);
  const removeComponent = useDesignerStore((state) => state.removeComponent);
  const removeComponents = useDesignerStore((state) => state.removeComponents);
  const saveBlock = useDesignerStore((state) => state.saveBlock);
  const selectedZone = useDesignerStore((state) => state.selectedZone) ?? 'body';

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
        <div className="h-10 min-h-[40px] border-b border-[var(--border-default)] flex items-center px-3 gap-2 bg-white/[0.01]">
          <PanelHeaderIcon icon={PANEL_PRESET_ICONS.group} />
          <span className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
            Group Settings
          </span>
        </div>
        <div className="flex-1 overflow-auto">
          <GroupProperties groupId={selectedGroupId} />
        </div>
      </div>
    );
  }

  // ---- 2. REPORT SETTINGS VIEW (NO SELECTION) ----
  if (!selectedComponent) {
    return (
      <div className="h-full flex flex-col bg-[var(--bg-surface)] border-l border-[var(--border-default)]">
        <div className="h-10 min-h-[40px] border-b border-[var(--border-default)] flex items-center px-3 gap-2 bg-white/[0.01]">
          <PanelHeaderIcon icon={PANEL_PRESET_ICONS.report} />
          <span className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
            Report Configuration
          </span>
        </div>

        <div className="flex-1 overflow-auto">
          <ReportConfigPanel />
        </div>
      </div>
    );
  }

  // ---- 3. MULTIPLE SELECTION VIEW ----
  if (selectedComponentIds.length > 1) {
    const applyBulkMap = (map: Record<string, Partial<ComponentNode>>) => {
      if (Object.keys(map).length > 0) updateComponents(map);
    };

    const bulkActions = {
      updateAll: (updates: Partial<ComponentNode>) => {
        const updatesMap: Record<string, Partial<ComponentNode>> = {};
        for (const comp of bulkSelectedComponents) {
          updatesMap[comp.id] = updates;
        }
        applyBulkMap(updatesMap);
      },
      updateByType: (type: ComponentNode['type'], updates: Partial<ComponentNode>) => {
        const updatesMap: Record<string, Partial<ComponentNode>> = {};
        for (const comp of bulkSelectedComponents) {
          if (comp.type === type) updatesMap[comp.id] = updates;
        }
        applyBulkMap(updatesMap);
      },
      updateStyleByType: (type: ComponentNode['type'], styleUpdates: Partial<TextStyle>) => {
        const updatesMap: Record<string, Partial<ComponentNode>> = {};
        for (const comp of bulkSelectedComponents) {
          if (comp.type !== type) continue;
          const currentStyle = (comp as { style?: TextStyle }).style || {};
          updatesMap[comp.id] = {
            style: { ...currentStyle, ...styleUpdates },
          } as Partial<ComponentNode>;
        }
        applyBulkMap(updatesMap);
      },
      deleteAll: () => removeComponents(selectedComponentIds),
      saveAsBlock: () =>
        saveBlock(`Block (${bulkSelectedComponents.length})`, bulkSelectedComponents, selectedZone),
    };

    return <BulkEditPanel selectedComponents={bulkSelectedComponents} actions={bulkActions} />;
  }

  // ---- 4. SINGLE COMPONENT VIEW (MAIN INSPECTOR) ----
  const renderTabContent = () => {
    switch (activeTab) {
      case 'design':
        return (
          <div className={`${PROPERTY_STACK_CLASS} animate-in fade-in duration-200`}>
            <section className={PROPERTY_SECTION_CLASS}>
              {(isText(selectedComponent) ||
                isTable(selectedComponent) ||
                isPageNumber(selectedComponent) ||
                isChecklist(selectedComponent)) && (
                <TypographyProperties
                  style={(selectedComponent as any).style}
                  onUpdateStyle={handleStyleUpdate}
                  allowBlockSettings={isText(selectedComponent)}
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

            <section className={PROPERTY_SECTION_CLASS}>
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
                <CollapsibleSection label="Table Columns">
                  <TableColumnsSection component={selectedComponent} />
                </CollapsibleSection>
                <TableVisualSection component={selectedComponent} />
              </>
            )}

            {isColumns(selectedComponent) && (
              <div className={PROPERTY_SECTION_CLASS}>
                <ColumnProperties component={selectedComponent} />
              </div>
            )}

            {isChecklist(selectedComponent) && (
              <div className={PROPERTY_SECTION_CLASS}>
                <ChecklistProperties
                  component={selectedComponent}
                  onUpdate={(updates) => updateComponent(selectedComponent.id, updates as any)}
                />
              </div>
            )}

            {isRectangle(selectedComponent) && (
              <div className={PROPERTY_SECTION_CLASS}>
                <RectangleProperties
                  component={selectedComponent}
                  onUpdate={(updates) => updateComponent(selectedComponent.id, updates)}
                />
              </div>
            )}

            {isSignature(selectedComponent) && (
              <div className={PROPERTY_SECTION_CLASS}>
                <SignatureProperties
                  component={selectedComponent}
                  onUpdate={(updates) => updateComponent(selectedComponent.id, updates as any)}
                />
              </div>
            )}
          </div>
        );

      case 'layout':
        return (
          <div className={`${PROPERTY_STACK_CLASS} animate-in fade-in duration-200`}>
            <section className={PROPERTY_SECTION_CLASS}>
              <GeometryProperties
                x={selectedComponent.x || 0}
                y={selectedComponent.y || 0}
                width={selectedComponent.width || 0}
                height={selectedComponent.height || 0}
                onUpdate={handleNumericUpdate}
              />
            </section>
          </div>
        );

      case 'data':
        return (
          <div className={`${PROPERTY_STACK_CLASS} animate-in fade-in duration-200`}>
            {/* Main Content Area */}
            <div className={PROPERTY_STACK_CLASS}>
              {isText(selectedComponent) && (
                <section className={`${PROPERTY_SECTION_CLASS} p-3 space-y-2`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
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
                    className="rounded-[4px] border border-[var(--border-default)] bg-white/[0.01] min-h-[120px] text-[11px] focus-within:border-[var(--accent)] transition-all"
                  />
                </section>
              )}

              {isTable(selectedComponent) && <TableDataSection component={selectedComponent} />}

              {isBarcode(selectedComponent) && (
                <div className={`${PROPERTY_SECTION_CLASS} p-3 space-y-3`}>
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
                <div className={PROPERTY_SECTION_CLASS}>
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
                <div className={`${PROPERTY_SECTION_CLASS} p-3 space-y-2`}>
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
          <div className={`${PROPERTY_STACK_CLASS} animate-in fade-in duration-200`}>
            <CollapsibleSection label="System">
              <div className={PANEL_SECTION_BODY}>
                <PropertyRow label="Object ID" inline>
                  <span className="text-[9px] font-mono text-[var(--text-muted)] truncate">
                    {selectedComponent.id}
                  </span>
                </PropertyRow>
                <PropertyRow label="Type" inline>
                  <span className="text-[9px] font-bold text-[var(--accent)] uppercase">
                    {selectedComponent.type}
                  </span>
                </PropertyRow>
              </div>
            </CollapsibleSection>

            {isTable(selectedComponent) && <TableAdvancedSection component={selectedComponent} />}

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
      <div className="h-10 min-h-[30px] border-b border-[var(--border-default)] flex items-center px-3 justify-between bg-white/[0.01]">
        <div className="flex items-center gap-2">
          <ComponentTypeIcon type={selectedComponent.type} />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold tracking-tight text-[var(--text-primary)] uppercase">
                {selectedComponent.type}
              </span>
              {isLocked && <Lock className="w-2.5 h-2.5 text-orange-400" />}
            </div>
            <span className="text-[8px] text-[var(--text-muted)] font-mono">
              {isLocked ? 'READ ONLY (LOCKED)' : `ID: ${selectedComponent.id.slice(0, 8)}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() =>
              saveBlock(
                selectedComponent.name ?? selectedComponent.type,
                [selectedComponent],
                selectedZone
              )
            }
            disabled={isLocked}
            className={clsx(
              'p-1 rounded transition-colors',
              isLocked
                ? 'opacity-20 cursor-not-allowed text-[var(--text-muted)]'
                : 'hover:bg-violet-500/10 text-[var(--text-muted)] hover:text-violet-400'
            )}
            title="Save as reusable block"
          >
            <Blocks className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => removeComponent(selectedComponent.id)}
            disabled={isLocked}
            className={clsx(
              'p-1 rounded transition-colors',
              isLocked
                ? 'opacity-20 cursor-not-allowed text-[var(--text-muted)]'
                : 'hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500'
            )}
            title={isLocked ? 'Cannot delete locked component' : 'Delete component'}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="grid grid-cols-4 border-b border-[var(--border-default)] bg-white/[0.012]">
        {(
          [
            { id: 'design', icon: Palette, label: 'Design' },
            { id: 'layout', icon: Layout, label: 'Layout' },
            { id: 'data', icon: Database, label: 'Content' },
            { id: 'settings', icon: Settings, label: 'Setup' },
          ] as const
        ).map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'h-9 min-w-0 flex flex-col items-center justify-center gap-1.5 transition-all border-b-2',
              activeTab === tab.id
                ? 'border-[var(--accent)] text-[var(--accent)] bg-white/[0.025]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.02]'
            )}
          >
            <tab.icon className="w-4 h-4" />
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
