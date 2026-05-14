import { useDesignerStore } from '@/store/designer-store';
import type { HLineConfig, TableComponent, VLineConfig } from '@/types/schema';
import { Minus, Plus } from 'lucide-react';
import { PropertyRow, SectionHeader } from '../Shared';
import { MiniInput } from './TableShared';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';

interface Props {
  component: TableComponent;
}

export const TableLinesSection = ({ component }: Props) => {
  const updateComponent = useDesignerStore((state) => state.updateComponent);

  const addHLine = () => {
    const lines = [...(component.hlines || []), { id: crypto.randomUUID(), y: 0, stroke: '0.2pt' }];
    updateComponent(component.id, { hlines: lines } as any);
  };

  const addVLine = () => {
    const lines = [...(component.vlines || []), { id: crypto.randomUUID(), x: 0, stroke: '0.2pt' }];
    updateComponent(component.id, { vlines: lines } as any);
  };

  return (
    <div className="p-2 space-y-4 bg-[var(--bg-widget)]">
      <section>
        <SectionHeader label="Horizontal Lines (H-Lines)" />
        <div className="space-y-1">
          {(component.hlines || []).map((line, idx) => (
            <div key={idx} className="flex items-center gap-1 bg-[var(--bg-surface)] p-1 rounded border border-[var(--border-default)]">
               <span className="text-[8px] font-bold w-4">Y</span>
               <MiniInput 
                 type="number"
                 value={line.y}
                 onChange={(v) => {
                    const lines = [...(component.hlines || [])];
                    lines[idx].y = Number.parseInt(v) || 0;
                    updateComponent(component.id, { hlines: lines } as any);
                 }}
                 className="w-12 h-6"
               />
               <MiniInput 
                 value={line.stroke as string}
                 onChange={(v) => {
                    const lines = [...(component.hlines || [])];
                    lines[idx].stroke = v;
                    updateComponent(component.id, { hlines: lines } as any);
                 }}
                 placeholder="Color or Width"
                 className="flex-1 h-6"
               />
               <Select
                 value={(line as any).dash || 'solid'}
                 onValueChange={(val) => {
                    const lines = [...(component.hlines || [])];
                    (lines[idx] as any).dash = val;
                    updateComponent(component.id, { hlines: lines } as any);
                 }}
               >
                 <SelectTrigger className="h-6 w-10 text-[8px] bg-[var(--bg-widget)] border-[var(--border-default)] px-1">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="solid">─</SelectItem>
                   <SelectItem value="dashed">╍</SelectItem>
                   <SelectItem value="dotted">⋯</SelectItem>
                 </SelectContent>
               </Select>
               <button 
                 onClick={() => {
                    const lines = (component.hlines || []).filter((_, i) => i !== idx);
                    updateComponent(component.id, { hlines: lines } as any);
                 }}
                 className="p-1 text-red-500 hover:bg-red-500/10 rounded"
               >
                 <Minus className="w-3 h-3" />
               </button>
            </div>
          ))}
          <button onClick={addHLine} className="w-full py-1 text-[9px] font-bold border border-dashed border-[var(--border-default)] rounded text-[var(--text-muted)] flex items-center justify-center gap-1">
            <Plus className="w-3 h-3" /> Add H-Line
          </button>
        </div>
      </section>

      <section>
        <SectionHeader label="Vertical Lines (V-Lines)" />
        <div className="space-y-1">
          {(component.vlines || []).map((line, idx) => (
             <div key={idx} className="flex items-center gap-1 bg-[var(--bg-surface)] p-1 rounded border border-[var(--border-default)]">
               <span className="text-[8px] font-bold w-4">X</span>
               <MiniInput 
                 type="number"
                 value={line.x}
                 onChange={(v) => {
                    const lines = [...(component.vlines || [])];
                    lines[idx].x = Number.parseInt(v) || 0;
                    updateComponent(component.id, { vlines: lines } as any);
                 }}
                 className="w-12 h-6"
               />
               <MiniInput 
                 value={line.stroke as string}
                 onChange={(v) => {
                    const lines = [...(component.vlines || [])];
                    lines[idx].stroke = v;
                    updateComponent(component.id, { vlines: lines } as any);
                 }}
                 placeholder="Color or Width"
                 className="flex-1 h-6"
               />
               <Select
                 value={(line as any).dash || 'solid'}
                 onValueChange={(val) => {
                    const lines = [...(component.vlines || [])];
                    (lines[idx] as any).dash = val;
                    updateComponent(component.id, { vlines: lines } as any);
                 }}
               >
                 <SelectTrigger className="h-6 w-10 text-[8px] bg-[var(--bg-widget)] border-[var(--border-default)] px-1">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="solid">│</SelectItem>
                   <SelectItem value="dashed">┆</SelectItem>
                   <SelectItem value="dotted">┊</SelectItem>
                 </SelectContent>
               </Select>
               <button 
                 onClick={() => {
                    const lines = (component.vlines || []).filter((_, i) => i !== idx);
                    updateComponent(component.id, { vlines: lines } as any);
                 }}
                 className="p-1 text-red-500 hover:bg-red-500/10 rounded"
               >
                 <Minus className="w-3 h-3" />
               </button>
            </div>
          ))}
          <button onClick={addVLine} className="w-full py-1 text-[9px] font-bold border border-dashed border-[var(--border-default)] rounded text-[var(--text-muted)] flex items-center justify-center gap-1">
            <Plus className="w-3 h-3" /> Add V-Line
          </button>
        </div>
      </section>
    </div>
  );
};
