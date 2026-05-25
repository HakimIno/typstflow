import { extractSchemaBindings } from '@/lib/utils/binding-extractor';
import { setNestedValue } from '@/lib/utils/json-path';
import type { LayoutSchema } from '@/types/schema';
import { describe, expect, it } from 'vitest';

describe('Batch PDF Export Utilities', () => {
  describe('extractSchemaBindings', () => {
    it('should extract simple bindings in text content', () => {
      const dummySchema = {
        zones: {
          header: {
            components: [
              {
                id: 'c1',
                type: 'text',
                content: 'Hello {{customer.name}}!',
              },
            ],
          },
          footer: {
            components: [],
          },
        },
        pages: [
          {
            id: 'p1',
            name: 'Page 1',
            body: {
              components: [
                {
                  id: 'c2',
                  type: 'text',
                  content: 'Your invoice number is {{invoice.id}} on date {{invoice.date}}.',
                },
              ],
            },
          },
        ],
        groups: [],
        variables: [],
        dataSchema: [],
      } as unknown as LayoutSchema;

      const bindings = extractSchemaBindings(dummySchema);
      expect(bindings).toContain('customer.name');
      expect(bindings).toContain('invoice.id');
      expect(bindings).toContain('invoice.date');
      expect(bindings).toHaveLength(3);
    });

    it('should extract from aggregates like SUM and COUNT', () => {
      const dummySchema = {
        zones: {
          header: { components: [] },
          footer: {
            components: [
              {
                id: 'c1',
                type: 'text',
                content: 'Total: {{SUM(items.price)}} of {{COUNT(items)}} items',
              },
            ],
          },
        },
        pages: [],
        groups: [],
        variables: [],
        dataSchema: [],
      } as unknown as LayoutSchema;

      const bindings = extractSchemaBindings(dummySchema);
      expect(bindings).toContain('items.price');
      expect(bindings).toContain('items');
      expect(bindings).toHaveLength(2);
    });

    it('should include paths declared in dataSchema', () => {
      const dummySchema = {
        zones: {
          header: { components: [] },
          footer: { components: [] },
        },
        pages: [],
        groups: [],
        variables: [],
        dataSchema: [
          { path: 'customer.taxId', type: 'string' },
          { path: 'invoice.total', type: 'number' },
        ],
      } as unknown as LayoutSchema;

      const bindings = extractSchemaBindings(dummySchema);
      expect(bindings).toContain('customer.taxId');
      expect(bindings).toContain('invoice.total');
      expect(bindings).toHaveLength(2);
    });
  });

  describe('setNestedValue mapping reconstruction', () => {
    it('should correctly build a nested object structure from flat CSV mappings', () => {
      const flatRow = {
        'Invoice Number': 'INV-999',
        'Buyer Name': 'David',
        'Amount Due': 150.5,
      };

      const mappings = {
        'invoice.number': 'Invoice Number',
        'customer.name': 'Buyer Name',
        'invoice.total': 'Amount Due',
      };

      let constructed: Record<string, any> = {};
      for (const [bindingPath, csvColumn] of Object.entries(mappings)) {
        const val = flatRow[csvColumn as keyof typeof flatRow];
        constructed = setNestedValue(constructed, bindingPath, val);
      }

      expect(constructed).toEqual({
        invoice: {
          number: 'INV-999',
          total: 150.5,
        },
        customer: {
          name: 'David',
        },
      });
    });

    it('should auto-parse JSON-like strings (arrays and objects) when mapped', () => {
      const flatRow = {
        'Items Column': '[{"desc":"Item 1","price":100}]',
        'Details Column': '{"discount":10,"notes":"test"}',
        'Normal String': '[This is not valid JSON]',
      };

      const mappings = {
        'invoice.items': 'Items Column',
        'invoice.details': 'Details Column',
        'invoice.notes': 'Normal String',
      };

      let constructed: Record<string, any> = {};
      for (const [bindingPath, csvColumn] of Object.entries(mappings)) {
        let val = flatRow[csvColumn as keyof typeof flatRow];
        if (typeof val === 'string' && (val.trim().startsWith('[') || val.trim().startsWith('{'))) {
          try {
            val = JSON.parse(val);
          } catch {
            // Keep as string
          }
        }
        constructed = setNestedValue(constructed, bindingPath, val);
      }

      expect(constructed.invoice.items).toEqual([{ desc: 'Item 1', price: 100 }]);
      expect(constructed.invoice.details).toEqual({ discount: 10, notes: 'test' });
      expect(constructed.invoice.notes).toBe('[This is not valid JSON]');
    });
  });
});
