import { useDesignerStore } from '@/store/designer-store';
import type {
  BarcodeComponent,
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
import { FileDown, FileText, Layers, Sliders, Trash2 } from 'lucide-react';
import { memo, useMemo } from 'react';
import { DesignerInput } from '../shared/DesignerInput';
import { TablePropertiesPanel } from './TablePropertiesPanel';
import { TextEditor } from './TextEditor';
import { VariablePicker } from './VariablePicker';
import { AlignmentProperties } from './properties/AlignmentProperties';
import { GeometryProperties } from './properties/GeometryProperties';
import { ImageProperties } from './properties/ImageProperties';
import { LineProperties } from './properties/LineProperties';
import { SummaryBoxProperties } from './properties/SummaryBoxProperties';
import { GroupProperties } from './properties/GroupProperties';
import { FormatPicker, type FormatType } from './properties/FormatPicker';
import { getValueType } from '@/lib/utils/json-path';
import { PropertyRow, SectionHeader } from './properties/Shared';
import { TypographyProperties } from './properties/TypographyProperties';

// Type guards for safe component access
const isText = (c: ComponentNode): c is TextComponent => c.type === 'text';
const isTable = (c: ComponentNode): c is TableComponent => c.type === 'table';
const isImage = (c: ComponentNode): c is ImageComponent => c.type === 'image';
const isLine = (c: ComponentNode): c is LineComponent => c.type === 'line';
const isSummaryBox = (c: ComponentNode): c is SummaryBoxComponent => c.type === 'summary-box';
const isBarcode = (c: ComponentNode): c is BarcodeComponent =>
  c.type === 'barcode' || c.type === 'qr';
const isPageNumber = (c: ComponentNode): c is PageNumberComponent =>
  c.type === 'page-number';

export const PropertiesPanel = memo(function PropertiesPanel() {
  const selectedComponentIds = useDesignerStore((state) => state.selectedComponentIds);
  const selectedGroupId = useDesignerStore((state) => state.selectedGroupId);
  const zones = useDesignerStore((state) => state.schema.zones);
  const pages = useDesignerStore((state) => state.schema.pages);
  const fullSchema = useDesignerStore((state) => state.schema);
  const selectedZone = useDesignerStore((state) => state.selectedZone);
  const sampleData = useDesignerStore((state) => state.sampleData);

  const updateSchema = useDesignerStore((state) => state.updateSchema);
  const updateComponent = useDesignerStore((state) => state.updateComponent);
  const updateZone = useDesignerStore((state) => state.updateZone);
  const removeComponent = useDesignerStore((state) => state.removeComponent);

  // Find first selected component across all zones and pages
  const selectedComponent = useMemo(() => {
    if (selectedComponentIds.length === 0) return null;
    const firstId = selectedComponentIds[0];

    // Check header/footer
    for (const zone of Object.values(zones)) {
      const found = zone.components.find((c) => c.id === firstId);
      if (found) return found;
    }

    // Check all pages
    for (const page of pages) {
      const found = page.body.components.find((c) => c.id === firstId);
      if (found) return found;
    }

    return null;
  }, [selectedComponentIds, zones, pages]);

  if (selectedGroupId) {
    return (
      <div className="h-full flex flex-col bg-[var(--bg-surface)]">
        <div className="h-8 min-h-[32px] bg-white/[0.02] text-[var(--text-primary)] border-b border-[var(--border-default)] flex items-center px-3 gap-2">
          <Layers className="w-3 h-3 text-[var(--accent)]" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Group Settings</span>
        </div>
        <div className="flex-1 overflow-auto border-l border-[var(--border-default)]">
          <GroupProperties groupId={selectedGroupId} />
        </div>
      </div>
    );
  }

  if (!selectedComponent) {
    return (
      <div className="h-full flex flex-col bg-[var(--bg-surface)]">
        <div className="h-8 min-h-[32px] bg-white/[0.02] text-[var(--text-primary)] border-b border-[var(--border-default)] flex items-center px-3 gap-2">
          <Layers className="w-3 h-3 text-[var(--text-muted)]" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Report Settings</span>
        </div>
        <div className="flex-1 overflow-auto border-l border-[var(--border-default)]">
          <section>
            <SectionHeader label="Page Configuration" />
            <PropertyRow label="Paper Size">
              <select
                value={fullSchema.page.size}
                onChange={(e) =>
                  updateSchema({ page: { ...fullSchema.page, size: e.target.value as any } })
                }
                className="pro-input h-6 px-1 w-full text-[11px] outline-none"
              >
                <option value="A4" className="bg-[var(--bg-surface)]">
                  A4
                </option>
                <option value="A5" className="bg-[var(--bg-surface)]">
                  A5
                </option>
                <option value="Letter" className="bg-[var(--bg-surface)]">
                  Letter
                </option>
                <option value="Legal" className="bg-[var(--bg-surface)]">
                  Legal
                </option>
              </select>
            </PropertyRow>
            <PropertyRow label="Orientation">
              <select
                value={fullSchema.page.orientation}
                onChange={(e) =>
                  updateSchema({
                    page: { ...fullSchema.page, orientation: e.target.value as any },
                  })
                }
                className="pro-input h-6 px-1 w-full text-[11px] outline-none"
              >
                <option value="portrait" className="bg-[var(--bg-surface)]">
                  Portrait
                </option>
                <option value="landscape" className="bg-[var(--bg-surface)]">
                  Landscape
                </option>
              </select>
            </PropertyRow>
            <PropertyRow label="Total Pages">
              <div className="flex-1 flex items-center gap-2 overflow-hidden">
                <DesignerInput
                  type="number"
                  min={1}
                  max={100}
                  value={pages.length}
                  onChange={(v) =>
                    useDesignerStore.getState().setPageCount(Number.parseInt(v) || 1)
                  }
                  mono
                />
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => useDesignerStore.getState().setPageCount(pages.length - 1)}
                    className="w-6 h-6 flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.1] border border-[var(--border-default)] rounded-full text-[12px] font-bold text-[var(--text-muted)]"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => useDesignerStore.getState().setPageCount(pages.length + 1)}
                    className="w-6 h-6 flex items-center justify-center bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-white rounded-full text-[12px] font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            </PropertyRow>
          </section>
          <section>
            <SectionHeader label="Margins" />
            {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
              <PropertyRow key={side} label={side.charAt(0).toUpperCase() + side.slice(1)}>
                <DesignerInput
                  type="text"
                  value={fullSchema.page.margin[side]}
                  onChange={(v) =>
                    updateSchema({
                      page: {
                        ...fullSchema.page,
                        margin: { ...fullSchema.page.margin, [side]: v },
                      },
                    })
                  }
                  mono
                  placeholder="15mm"
                />
              </PropertyRow>
            ))}
          </section>
        </div>
      </div>
    );
  }

  // Handle Multiple Selection View
  if (selectedComponentIds.length > 1) {
    return (
      <div className="h-full flex flex-col bg-[var(--bg-surface)]">
        <div className="h-8 bg-white/[0.02] text-[var(--text-primary)] border-b border-[var(--border-default)] flex items-center px-3 gap-2">
          <Layers className="w-3 h-3 text-[var(--text-muted)]" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Group Selection</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--accent-glow)] flex items-center justify-center mb-4 border border-[var(--border-accent)]">
            <Layers className="w-6 h-6 text-[var(--accent)]" />
          </div>
          <h3 className="text-[13px] font-bold text-[var(--text-primary)] mb-1">
            {selectedComponentIds.length} objects selected
          </h3>
          <p className="text-[10px] text-[var(--text-muted)] mb-6">
            Multiple items are currently selected. Actions will apply to all items in the selection.
          </p>
          <button
            type="button"
            onClick={() => {
              for (const id of selectedComponentIds) removeComponent(id);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/20 rounded transition-all text-[11px] font-bold uppercase tracking-wider"
          >
            <Trash2 className="w-4 h-4" />
            Delete All Selected
          </button>
        </div>
      </div>
    );
  }

  const handleNumericUpdate = (key: string, value: string) => {
    const num = Number.parseFloat(value);
    if (!Number.isNaN(num)) {
      updateComponent(selectedComponent.id, { [key]: num });
    }
  };

  const handleStyleUpdate = (updates: any) => {
    const currentStyle = (selectedComponent as any).style || {};
    updateComponent(selectedComponent.id, {
      style: { ...currentStyle, ...updates },
    } as any);
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg-surface)]">
      <div className="h-8 min-h-[32px] bg-white/[0.02] text-[var(--text-primary)] border-b border-[var(--border-default)] flex items-center px-3 gap-2">
        <Sliders className="w-3 h-3 text-[var(--text-muted)]" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Properties Inspector</span>
      </div>

      <div className="flex-1 overflow-auto border-l border-[var(--border-default)]">
        <section>
          <SectionHeader label="Identification" />
          <PropertyRow label="Object ID">
            <span className="text-[11px] font-mono text-[var(--text-muted)] truncate">
              {selectedComponent.id}
            </span>
          </PropertyRow>
          <PropertyRow label="Type">
            <span className="text-[11px] font-bold text-[var(--accent)] uppercase">
              {selectedComponent.type}
            </span>
          </PropertyRow>
        </section>

        <section>
          <SectionHeader label="Content & Binding" />
          {isText(selectedComponent) && (
            <div className="flex flex-col border-b border-[var(--border-default)]">
              <div className="px-3 py-1 flex items-center justify-between text-[10px] bg-white/[0.01]">
                <span className="font-bold text-[var(--text-secondary)] uppercase tracking-tighter">
                  Text Content
                </span>
                <VariablePicker
                  sampleData={sampleData}
                  onSelect={(_path, binding) => {
                    const currentContent = selectedComponent.content || '';
                    updateComponent(selectedComponent.id, { content: currentContent + binding });
                  }}
                />
              </div>
              <TextEditor
                value={selectedComponent.content || ''}
                onChange={(value) => updateComponent(selectedComponent.id, { content: value })}
                sampleData={sampleData}
                textStyle={selectedComponent.style}
                placeholder="Type static text or {{binding}}..."
                className="bg-transparent"
              />
              {(() => {
                const hasBinding = (selectedComponent.content || '').includes('{{');
                if (!hasBinding) return null;
                
                return (
                  <div className="flex flex-col border-t border-[var(--border-default)]">
                    <SectionHeader label="Display Format" />
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
                );
              })()}
            </div>
          )}
          {isTable(selectedComponent) && (
            <div className="space-y-0 text-[10px]">
              <PropertyRow label="Data Source">
                <DesignerInput
                  type="text"
                  value={selectedComponent.dataSource || ''}
                  onChange={(v) => updateComponent(selectedComponent.id, { dataSource: v })}
                  mono
                  placeholder="{{path.to.array}}"
                />
              </PropertyRow>
              <PropertyRow label="Header Rows">
                <DesignerInput
                  type="number"
                  min={0}
                  max={5}
                  value={selectedComponent.style?.headerRows ?? 1}
                  onChange={(v) => handleStyleUpdate({ headerRows: Number.parseInt(v) || 0 })}
                />
              </PropertyRow>
            </div>
          )}
          {isBarcode(selectedComponent) && (
            <PropertyRow label="Value">
              <DesignerInput
                type="text"
                value={(selectedComponent as BarcodeComponent | QRComponent).value || ''}
                onChange={(v) => updateComponent(selectedComponent.id, { value: v })}
                mono
                placeholder="{{item.id}}"
              />
            </PropertyRow>
          )}
          {isImage(selectedComponent) && (
            <ImageProperties
              component={selectedComponent}
              onUpdate={(updates) => updateComponent(selectedComponent.id, updates as any)}
            />
          )}
          {isPageNumber(selectedComponent) && (
            <div className="flex flex-col border-b border-[var(--border-default)]">
              <div className="px-3 py-1 flex items-center justify-between text-[10px] bg-white/[0.01]">
                <span className="font-bold text-[var(--text-secondary)] uppercase tracking-tighter">
                  Numbering Format
                </span>
                <div className="text-[9px] text-[var(--text-muted)] italic">
                  Use {'{{page}}'} and {'{{pageTotal}}'}
                </div>
              </div>
              <div className="px-3 pb-2">
                <DesignerInput
                  type="text"
                  value={selectedComponent.format || ''}
                  onChange={(v) => updateComponent(selectedComponent.id, { format: v })}
                  placeholder="หน้าที่ {{page}} / {{pageTotal}}"
                  className="w-full"
                />
              </div>
            </div>
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

        {(isText(selectedComponent) || isTable(selectedComponent)) && (
          <TypographyProperties
            style={(selectedComponent as any).style}
            onUpdateStyle={handleStyleUpdate}
          />
        )}

        {isTable(selectedComponent) && <TablePropertiesPanel component={selectedComponent} />}

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

        <GeometryProperties
          x={selectedComponent.x || 0}
          y={selectedComponent.y || 0}
          width={selectedComponent.width || 0}
          height={selectedComponent.height || 0}
          onUpdate={handleNumericUpdate}
        />

        <section>
          <SectionHeader label="Page Management" />
          <PropertyRow label="Page Break Before">
            <button
              type="button"
              onClick={() =>
                updateComponent(selectedComponent.id, {
                  pageBreakBefore: !selectedComponent.pageBreakBefore,
                })
              }
              className={clsx(
                'flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold rounded transition-colors',
                selectedComponent.pageBreakBefore
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-white/[0.04] text-[var(--text-secondary)] hover:bg-white/[0.08]'
              )}
            >
              <FileDown className="w-3 h-3" />
              {selectedComponent.pageBreakBefore ? 'Enabled' : 'Disabled'}
            </button>
          </PropertyRow>
        </section>

        <section>
          <SectionHeader label="Zone Settings" />
          {selectedZone === 'header' && (
            <>
              <PropertyRow label="Repeat on Every Page">
                <button
                  type="button"
                  onClick={() => {
                    const headerZone = fullSchema.zones.header;
                    const newValue = !headerZone.repeatOnEveryPage;
                    updateZone('header', { 
                      repeatOnEveryPage: newValue,
                      showOnFirstPageOnly: false // Reset other flags if repeating
                    });
                  }}
                  className={clsx(
                    'flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold rounded transition-colors',
                    fullSchema.zones.header.repeatOnEveryPage
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-white/[0.04] text-[var(--text-secondary)] hover:bg-white/[0.08]'
                  )}
                >
                  <Layers className="w-3 h-3" />
                  {fullSchema.zones.header.repeatOnEveryPage ? 'Enabled' : 'Disabled'}
                </button>
              </PropertyRow>
              {!fullSchema.zones.header.repeatOnEveryPage && (
                <PropertyRow label="Visibility">
                  <button
                    type="button"
                    onClick={() => {
                      const headerZone = fullSchema.zones.header;
                      const newValue = !headerZone.showOnFirstPageOnly;
                      updateZone('header', { showOnFirstPageOnly: newValue });
                    }}
                    className={clsx(
                      'flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold rounded transition-colors',
                      fullSchema.zones.header.showOnFirstPageOnly
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-white/[0.04] text-[var(--text-secondary)] hover:bg-white/[0.08]'
                    )}
                  >
                    <FileText className="w-3 h-3" />
                    {fullSchema.zones.header.showOnFirstPageOnly ? 'First Page Only' : 'First Page Only (Default)'}
                  </button>
                </PropertyRow>
              )}
            </>
          )}
          {selectedZone === 'footer' && (
            <>
              <PropertyRow label="Repeat on Every Page">
                <button
                  type="button"
                  onClick={() => {
                    const footerZone = fullSchema.zones.footer;
                    const newValue = !footerZone.repeatOnEveryPage;
                    updateZone('footer', { 
                      repeatOnEveryPage: newValue,
                      showOnLastPageOnly: false // Reset other flags if repeating
                    });
                  }}
                  className={clsx(
                    'flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold rounded transition-colors',
                    fullSchema.zones.footer.repeatOnEveryPage
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-white/[0.04] text-[var(--text-secondary)] hover:bg-white/[0.08]'
                  )}
                >
                  <Layers className="w-3 h-3" />
                  {fullSchema.zones.footer.repeatOnEveryPage ? 'Enabled' : 'Disabled'}
                </button>
              </PropertyRow>
              {!fullSchema.zones.footer.repeatOnEveryPage && (
                <PropertyRow label="Visibility">
                  <button
                    type="button"
                    onClick={() => {
                      const footerZone = fullSchema.zones.footer;
                      const newValue = !footerZone.showOnLastPageOnly;
                      updateZone('footer', { showOnLastPageOnly: newValue });
                    }}
                    className={clsx(
                      'flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold rounded transition-colors',
                      fullSchema.zones.footer.showOnLastPageOnly
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-white/[0.04] text-[var(--text-secondary)] hover:bg-white/[0.08]'
                    )}
                  >
                    <FileText className="w-3 h-3" />
                    {fullSchema.zones.footer.showOnLastPageOnly ? 'Last Page Only' : 'First Page Only (Default)'}
                  </button>
                </PropertyRow>
              )}
            </>
          )}
        </section>
      </div>

      <div className="p-2 border-t border-[var(--border-default)] bg-white/[0.01]">
        <button
          type="button"
          onClick={() => removeComponent(selectedComponent.id)}
          className="w-full flex items-center justify-center gap-2 p-1.5 bg-red-600 text-white font-bold text-[10px] uppercase hover:bg-red-700 active:bg-red-800 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          Delete Object
        </button>
      </div>
    </div>
  );
});
