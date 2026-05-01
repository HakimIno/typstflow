import { beforeEach, describe, expect, it } from 'vitest';
import { useDesignerStore } from '../store/designer-store';

describe('Keyboard Actions (Store)', () => {
  const resetStore = () => {
    useDesignerStore.getState().loadTemplate('blank');
    useDesignerStore.getState().clearSelection();
  };

  beforeEach(() => {
    resetStore();
  });

  it('should copy selected components to clipboard', () => {
    const store = useDesignerStore.getState();

    // 1. Add a component and select it
    store.addComponent('body', { type: 'text', content: 'Test' } as any);
    const componentId = useDesignerStore.getState().selectedComponentIds[0];

    // 2. Copy
    useDesignerStore.getState().copySelected();

    // 3. Verify clipboard
    const updatedStore = useDesignerStore.getState();
    expect(updatedStore.clipboard).toHaveLength(1);
    expect(updatedStore.clipboard?.[0].id).toBe(componentId);
  });

  it('should paste components from clipboard with offset', () => {
    const store = useDesignerStore.getState();

    // 1. Add, select, and copy
    store.addComponent('body', { type: 'text', content: 'Original', x: 10, y: 10 } as any);
    useDesignerStore.getState().copySelected();

    // 2. Paste
    useDesignerStore.getState().paste();

    // 3. Verify
    const finalStore = useDesignerStore.getState();
    const bodyComps = finalStore.schema.pages[0].body.components;

    expect(bodyComps).toHaveLength(2);
    const pasted = bodyComps.find((c) => c.content === 'Original' && c.id !== bodyComps[0].id);
    expect(pasted).toBeDefined();
    expect(pasted?.x).toBe(15); // 10 + 5 offset
    expect(pasted?.y).toBe(15); // 10 + 5 offset
    expect(finalStore.selectedComponentIds).toContain(pasted?.id);
  });

  it('should duplicate selected components', () => {
    const store = useDesignerStore.getState();

    // 1. Add and select
    store.addComponent('body', { type: 'text', content: 'Duplicate Me', x: 20, y: 20 } as any);

    // 2. Duplicate
    useDesignerStore.getState().duplicateSelected();

    // 3. Verify
    const finalStore = useDesignerStore.getState();
    const bodyComps = finalStore.schema.pages[0].body.components;

    expect(bodyComps).toHaveLength(2);
    const copy = bodyComps[1];
    expect(copy.x).toBe(25);
    expect(copy.y).toBe(25);
    expect(finalStore.selectedComponentIds).toEqual([copy.id]);
  });

  it('should nudge selected components correctly', () => {
    const store = useDesignerStore.getState();

    // 1. Add and select
    store.addComponent('body', { type: 'text', content: 'Nudge Me', x: 50, y: 50 } as any);

    // 2. Nudge Right (10mm)
    useDesignerStore.getState().nudgeSelected(10, 0);

    // 3. Verify
    let currentStore = useDesignerStore.getState();
    let comp = currentStore.schema.pages[0].body.components[0];
    expect(comp.x).toBe(60);

    // 4. Nudge Up (-5mm)
    useDesignerStore.getState().nudgeSelected(0, -5);

    currentStore = useDesignerStore.getState();
    comp = currentStore.schema.pages[0].body.components[0];
    expect(comp.y).toBe(45);
  });

  it('should undo and redo nudges', () => {
    const store = useDesignerStore.getState();

    // 1. Add and nudge
    store.addComponent('body', { type: 'text', content: 'Undo Me', x: 10, y: 10 } as any);
    useDesignerStore.getState().nudgeSelected(10, 0); // x: 20

    expect(useDesignerStore.getState().schema.pages[0].body.components[0].x).toBe(20);

    // 2. Undo
    useDesignerStore.getState().undo();
    expect(useDesignerStore.getState().schema.pages[0].body.components[0].x).toBe(10);

    // 3. Redo
    useDesignerStore.getState().redo();
    expect(useDesignerStore.getState().schema.pages[0].body.components[0].x).toBe(20);
  });
});
