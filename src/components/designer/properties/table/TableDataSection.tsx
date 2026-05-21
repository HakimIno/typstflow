import { useDesignerStore } from '@/store/designer-store';
import type { TableComponent } from '@/types/schema';
import { CollapsibleSection, ControlField, InsetSection, PROPERTY_STACK_CLASS } from '../Shared';
import {
  AddRowButton,
  BindingField,
  CompactTextStyleFields,
  MiniInput,
  SettingToggle,
  SummaryRowEditor,
  TABLE_FIELD_STACK,
} from './TableShared';

interface Props {
  component: TableComponent;
}

export const TableDataSection = ({ component }: Props) => {
  const updateComponent = useDesignerStore((state) => state.updateComponent);
  const sampleData = useDesignerStore((state) => state.sampleData);
  const groupHeaderStyle = component.groupHeaderStyle || {};
  const id = component.id;

  const patch = (updates: Partial<TableComponent>) =>
    updateComponent(id, updates as Partial<TableComponent>);

  const patchGroupStyle = (stylePatch: Partial<typeof groupHeaderStyle>) =>
    patch({ groupHeaderStyle: { ...groupHeaderStyle, ...stylePatch } });

  return (
    <div className={`${PROPERTY_STACK_CLASS} animate-in fade-in duration-200`}>
      <CollapsibleSection label="Data Source & Behavior">
        <div className={TABLE_FIELD_STACK}>
          <BindingField
            label="Data Path"
            value={component.dataSource || ''}
            onChange={(v) => patch({ dataSource: v })}
            sampleData={sampleData}
            onBindingSelect={(_path, binding) => patch({ dataSource: binding })}
            placeholder="{{items}}"
            mono
          />
          <SettingToggle
            label="Repeat Header"
            description="On page breaks"
            value={!!component.repeatHeaderOnPage}
            onChange={(v) => patch({ repeatHeaderOnPage: v })}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection label="Data Grouping" defaultOpen={false}>
        <div className={TABLE_FIELD_STACK}>
          <BindingField
            label="Group By"
            value={component.groupBy || ''}
            onChange={(v) => patch({ groupBy: v })}
            sampleData={sampleData}
            onBindingSelect={(_path, binding) => patch({ groupBy: binding })}
            placeholder="department"
            mono
          />
          <BindingField
            label="Header Text"
            value={component.groupHeaderFormat || ''}
            onChange={(v) => patch({ groupHeaderFormat: v })}
            sampleData={sampleData}
            onBindingSelect={(_path, binding) => patch({ groupHeaderFormat: binding })}
            placeholder="Group: {{department}}"
            appendBinding
          />
          <InsetSection label="Group Header Style">
            <CompactTextStyleFields style={groupHeaderStyle} onPatch={patchGroupStyle} />
          </InsetSection>
        </div>
      </CollapsibleSection>

      <CollapsibleSection label="Summaries & Totals" defaultOpen={false}>
        <div className={TABLE_FIELD_STACK}>
          <SettingToggle
            label="Auto Subtotal"
            description="Per group"
            value={!!component.autoGroupFooter}
            onChange={(v) => patch({ autoGroupFooter: v })}
          />
          {component.autoGroupFooter && (
            <ControlField label="Footer Label">
              <MiniInput
                value={component.autoGroupFooterLabel ?? 'Subtotal'}
                onChange={(v) => patch({ autoGroupFooterLabel: v })}
                placeholder="Subtotal"
                className="w-full"
              />
            </ControlField>
          )}
          <SettingToggle
            label="Repeat Notes"
            description="Per group"
            value={!!component.repeatSummaryOnGroup}
            onChange={(v) => patch({ repeatSummaryOnGroup: v })}
          />
          <InsetSection label="Manual Summary Rows" contentClassName="space-y-1.5">
            {(component.summaryRows || []).map((row, idx) => (
              <SummaryRowEditor
                key={idx}
                label={row.label}
                value={row.value}
                onLabelChange={(v) => {
                  const rows = [...(component.summaryRows || [])];
                  rows[idx] = { ...rows[idx], label: v };
                  patch({ summaryRows: rows });
                }}
                onValueChange={(v) => {
                  const rows = [...(component.summaryRows || [])];
                  rows[idx] = { ...rows[idx], value: v };
                  patch({ summaryRows: rows });
                }}
                onRemove={() => {
                  patch({
                    summaryRows: (component.summaryRows || []).filter((_, i) => i !== idx),
                  });
                }}
              />
            ))}
            <AddRowButton
              label="Add Summary"
              onClick={() =>
                patch({
                  summaryRows: [
                    ...(component.summaryRows || []),
                    { label: '', value: '', separator: false },
                  ],
                })
              }
            />
          </InsetSection>
        </div>
      </CollapsibleSection>
    </div>
  );
};
