import { agentLogger } from '@/lib/utils/agent-logger';
import { generateStressTestSchema } from '@/lib/utils/performance-test';
import { validateAndRepairSchema } from '@/lib/utils/schema-validator';
import type { StateCreator } from 'zustand';
import type { DesignerState } from '../store-types';
import { BLANK_SCHEMA, buildComponentRegistry } from '../store-utils';

export type TemplateSlice = Pick<
  DesignerState,
  | 'loadTemplate'
  | 'loadStressTest'
  | 'customTemplates'
  | 'addCustomTemplate'
  | 'deleteCustomTemplate'
  | 'applyCustomTemplate'
>;

export const createTemplateSlice: StateCreator<DesignerState, [], [], TemplateSlice> = (
  set,
  _get
) => ({
  loadTemplate: (name) => {
    agentLogger.log({
      source: 'ai-agent',
      level: 'action',
      message: `Loading template: ${name}`,
    });
    set({
      schema: BLANK_SCHEMA,
      sampleData: {},
      componentRegistry: buildComponentRegistry(BLANK_SCHEMA),
      history: [BLANK_SCHEMA],
      historyIndex: 0,
    });
  },

  loadStressTest: (pages?: number, components?: number) => {
    agentLogger.log({
      source: 'system',
      level: 'info',
      message: `Generating stress test schema: ${pages} pages`,
    });
    const schema = generateStressTestSchema(pages, components);
    set({ schema, history: [schema], historyIndex: 0, activePageId: schema.pages[0]?.id });
  },

  customTemplates: [],

  addCustomTemplate: (name, schema, sampleData) => {
    const safeSchema = validateAndRepairSchema(schema, BLANK_SCHEMA);
    const template = {
      id: `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      schema: safeSchema,
      sampleData,
      createdAt: Date.now(),
    };
    set((state) => ({ customTemplates: [...state.customTemplates, template] }));
    agentLogger.log({
      source: 'system',
      level: 'info',
      message: `Added custom template: ${name}`,
    });
  },

  deleteCustomTemplate: (id) => {
    set((state) => ({
      customTemplates: state.customTemplates.filter((t) => t.id !== id),
    }));
  },

  applyCustomTemplate: (id) => {
    const template = _get().customTemplates.find((t) => t.id === id);
    if (!template) return;
    set({
      schema: template.schema,
      sampleData: template.sampleData ?? {},
      componentRegistry: buildComponentRegistry(template.schema),
      history: [template.schema],
      historyIndex: 0,
      activePageId: template.schema.pages[0]?.id ?? null,
      selectedComponentIds: [],
      selectedGroupId: null,
      selectedZone: null,
    });
    agentLogger.log({
      source: 'ai-agent',
      level: 'action',
      message: `Applied custom template: ${template.name}`,
    });
  },
});
