import { COMPLEX_SAMPLE_DATA, COMPLEX_TABLE_TEMPLATE } from '@/lib/templates/complex-table';
import { INVOICE_SAMPLE_DATA, INVOICE_TEMPLATE } from '@/lib/templates/invoice';
import {
  INVOICE_WITH_MANY_ITEMS_SAMPLE_DATA,
  INVOICE_WITH_PAGE_BREAKS_TEMPLATE,
} from '@/lib/templates/invoice-with-page-breaks';
import { MULTI_INVOICE_SAMPLE_DATA, MULTI_INVOICE_TEMPLATE } from '@/lib/templates/multi-invoice';
import { TAX_INVOICE_SAMPLE_DATA, TAX_INVOICE_TEMPLATE } from '@/lib/templates/tax-invoice';
import { agentLogger } from '@/lib/utils/agent-logger';
import { generateStressTestSchema } from '@/lib/utils/performance-test';
import { resetWasmSchemaStore } from '@/lib/wasm-schema-store';
import type { LayoutSchema } from '@/types/schema';
import type { StateCreator } from 'zustand';
import type { DesignerState } from '../store-types';
import { BLANK_SCHEMA, buildComponentRegistry } from '../store-utils';

export type TemplateSlice = Pick<DesignerState, 'loadTemplate' | 'loadStressTest'>;

function applyTemplate(
  set: (partial: Partial<DesignerState>) => void,
  schema: LayoutSchema,
  sampleData: Record<string, unknown>
) {
  set({
    schema,
    sampleData,
    componentRegistry: buildComponentRegistry(schema),
    activePageId: schema.pages[0]?.id ?? null,
    historyIndex: 0,
    historyLength: 1,
  });
  resetWasmSchemaStore(schema);
}

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
    if (name === 'invoice') {
      applyTemplate(set, INVOICE_TEMPLATE, INVOICE_SAMPLE_DATA);
    } else if (name === 'complex') {
      applyTemplate(set, COMPLEX_TABLE_TEMPLATE, COMPLEX_SAMPLE_DATA);
    } else if (name === 'invoice-with-breaks') {
      applyTemplate(set, INVOICE_WITH_PAGE_BREAKS_TEMPLATE, INVOICE_WITH_MANY_ITEMS_SAMPLE_DATA);
    } else if (name === 'tax-invoice') {
      applyTemplate(set, TAX_INVOICE_TEMPLATE, TAX_INVOICE_SAMPLE_DATA);
    } else if (name === 'multi-invoice') {
      applyTemplate(set, MULTI_INVOICE_TEMPLATE, MULTI_INVOICE_SAMPLE_DATA);
    } else {
      applyTemplate(set, BLANK_SCHEMA, {});
    }
  },

  loadStressTest: (pages?: number, components?: number) => {
    agentLogger.log({
      source: 'system',
      level: 'info',
      message: `Generating stress test schema: ${pages} pages`,
    });
    const schema = generateStressTestSchema(pages, components);
    set({ schema, historyIndex: 0, historyLength: 1, activePageId: schema.pages[0]?.id });
    resetWasmSchemaStore(schema);
  },
});
