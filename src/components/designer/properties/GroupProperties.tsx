import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import { ArrowDownAZ, ArrowUpAZ, Filter } from 'lucide-react';
import { DesignerInput } from '../../shared/DesignerInput';
import { VariablePicker } from '../VariablePicker';
import { PropertyRow, SectionHeader } from './Shared';

export function GroupProperties({ groupId }: { groupId: string }) {
  const group = useDesignerStore((state) => state.schema.groups.find((g) => g.id === groupId));
  const updateGroup = useDesignerStore((state) => state.updateGroup);
  const sampleData = useDesignerStore((state) => state.sampleData);

  if (!group) return null;

  return (
    <div className="flex flex-col gap-0">
      <section>
        <SectionHeader label="Group Information" />
        <PropertyRow label="Group Name">
          <DesignerInput
            value={group.name}
            onChange={(v) => updateGroup(groupId, { name: v })}
            placeholder="e.g. Customer Group"
          />
        </PropertyRow>
        <div className="flex flex-col border-b border-[var(--border-default)]">
          <div className="px-3 py-1 flex items-center justify-between text-[10px] bg-white/[0.01]">
            <span className="font-bold text-[var(--text-secondary)] uppercase tracking-tighter">
              Group Expression
            </span>
            <VariablePicker
              sampleData={sampleData}
              onSelect={(_path, binding) => {
                // Remove {{ }} for the raw path
                const rawPath = binding.replace(/\{\{|\}\}/g, '');
                updateGroup(groupId, { field: rawPath });
              }}
              showAggregates={false}
            />
          </div>
          <div className="px-3 pb-2">
            <DesignerInput
              value={group.field}
              onChange={(v) => updateGroup(groupId, { field: v })}
              mono
              placeholder="item.category"
              className="w-full"
            />
          </div>
        </div>
      </section>

      <section>
        <SectionHeader label="Sorting & Logic" />
        <PropertyRow label="Sort Order">
          <div className="flex items-center gap-1 bg-[var(--bg-widget)] p-0.5 rounded border border-[var(--border-default)]">
            <button
              type="button"
              onClick={() => updateGroup(groupId, { sortBy: 'asc' })}
              className={clsx(
                'flex-1 flex items-center justify-center gap-1.5 py-1 rounded text-[10px] font-bold transition-all',
                group.sortBy === 'asc'
                  ? 'bg-[var(--accent)] text-white shadow-sm'
                  : 'hover:bg-white/5 text-[var(--text-muted)]'
              )}
            >
              <ArrowDownAZ className="w-3 h-3" />
              ASC
            </button>
            <button
              type="button"
              onClick={() => updateGroup(groupId, { sortBy: 'desc' })}
              className={clsx(
                'flex-1 flex items-center justify-center gap-1.5 py-1 rounded text-[10px] font-bold transition-all',
                group.sortBy === 'desc'
                  ? 'bg-[var(--accent)] text-white shadow-sm'
                  : 'hover:bg-white/5 text-[var(--text-muted)]'
              )}
            >
              <ArrowUpAZ className="w-3 h-3" />
              DESC
            </button>
            <button
              type="button"
              onClick={() => updateGroup(groupId, { sortBy: undefined })}
              className={clsx(
                'flex-1 flex items-center justify-center gap-1.5 py-1 rounded text-[10px] font-bold transition-all',
                !group.sortBy
                  ? 'bg-[var(--bg-surface-solid)] text-white border border-[var(--border-default)]'
                  : 'hover:bg-white/5 text-[var(--text-muted)]'
              )}
            >
              None
            </button>
          </div>
        </PropertyRow>
        <div className="flex flex-col border-b border-[var(--border-default)]">
          <div className="px-3 py-1 flex items-center justify-between text-[10px] bg-white/[0.01]">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3 h-3 text-[var(--accent)]" />
              <span className="font-bold text-[var(--text-secondary)] uppercase tracking-tighter">
                Filter Expression
              </span>
            </div>
          </div>
          <div className="px-3 pb-2">
            <DesignerInput
              value={group.filterBy || ''}
              onChange={(v) => updateGroup(groupId, { filterBy: v })}
              mono
              placeholder="e.g. item.price > 100"
              className="w-full"
            />
            <p className="mt-1 text-[8px] text-[var(--text-muted)] leading-tight italic">
              Optional: Only items matching this criteria will be included in the group.
            </p>
          </div>
        </div>
      </section>

      <section>
        <SectionHeader label="Behavior" />
        <PropertyRow label="Repeat on Page">
          <button
            type="button"
            onClick={() => updateGroup(groupId, { repeatHeaderOnPage: !group.repeatHeaderOnPage })}
            className={clsx(
              'px-3 py-1 rounded text-[10px] font-bold transition-all border',
              group.repeatHeaderOnPage
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : 'bg-white/5 text-[var(--text-muted)] border-[var(--border-default)] hover:border-[var(--text-muted)]'
            )}
          >
            {group.repeatHeaderOnPage ? 'ENABLED' : 'DISABLED'}
          </button>
        </PropertyRow>
      </section>
    </div>
  );
}
