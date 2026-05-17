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
import type { StateCreator } from 'zustand';
import type { DesignerState } from '../store-types';
import { BLANK_SCHEMA } from '../store-utils';

export type TemplateSlice = Pick<DesignerState, 'loadTemplate' | 'loadStressTest'>;

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
      set({
        schema: INVOICE_TEMPLATE,
        sampleData: INVOICE_SAMPLE_DATA,
        history: [INVOICE_TEMPLATE],
        historyIndex: 0,
      });
    } else if (name === 'complex') {
      set({
        schema: COMPLEX_TABLE_TEMPLATE,
        sampleData: COMPLEX_SAMPLE_DATA,
        history: [COMPLEX_TABLE_TEMPLATE],
        historyIndex: 0,
      });
    } else if (name === 'invoice-with-breaks') {
      set({
        schema: INVOICE_WITH_PAGE_BREAKS_TEMPLATE,
        sampleData: INVOICE_WITH_MANY_ITEMS_SAMPLE_DATA,
        history: [INVOICE_WITH_PAGE_BREAKS_TEMPLATE],
        historyIndex: 0,
      });
    } else if (name === 'tax-invoice') {
      set({
        schema: TAX_INVOICE_TEMPLATE,
        sampleData: TAX_INVOICE_SAMPLE_DATA,
        history: [TAX_INVOICE_TEMPLATE],
        historyIndex: 0,
      });
    } else if (name === 'multi-invoice') {
      set({
        schema: MULTI_INVOICE_TEMPLATE,
        sampleData: MULTI_INVOICE_SAMPLE_DATA,
        history: [MULTI_INVOICE_TEMPLATE],
        historyIndex: 0,
      });
    } else {
      set({
        schema: BLANK_SCHEMA,
        sampleData: {},
        history: [BLANK_SCHEMA],
        historyIndex: 0,
      });
    }
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
});
