import { findAllTables } from '@/lib/excel-export';
import type { LayoutSchema } from '@/types/schema';
import { describe, expect, it } from 'vitest';

describe('findAllTables', () => {
  it('correctly extracts table components from nested schema zones', () => {
    const dummySchema: LayoutSchema = {
      id: 'dummy',
      name: 'Dummy Template',
      version: '1.0.0',
      page: {
        size: 'A4',
        orientation: 'portrait',
        margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
      },
      fonts: [],
      zones: {
        header: {
          id: 'header',
          components: [
            {
              id: 'header-table',
              type: 'table',
              dataSource: '{{items}}',
              showHeader: true,
              repeatHeaderOnPage: true,
              columns: [],
              style: {},
            },
          ],
        },
        footer: {
          id: 'footer',
          components: [],
        },
      },
      pages: [
        {
          id: 'page-1',
          name: 'Page 1',
          body: {
            id: 'body',
            components: [
              {
                id: 'body-table',
                type: 'table',
                dataSource: '{{items}}',
                showHeader: true,
                repeatHeaderOnPage: true,
                columns: [],
                style: {},
              },
              {
                id: 'cols-layout',
                type: 'columns',
                columns: [
                  {
                    width: '1fr',
                    components: [
                      {
                        id: 'nested-table',
                        type: 'table',
                        dataSource: '{{nested}}',
                        showHeader: true,
                        repeatHeaderOnPage: true,
                        columns: [],
                        style: {},
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
      groups: [],
      variables: [],
      dataSchema: [],
      metadata: {
        title: 'Dummy',
        createdAt: '',
        updatedAt: '',
        author: '',
      },
    };

    const tables = findAllTables(dummySchema);
    expect(tables).toHaveLength(3);
    expect(tables.map((t) => t.id)).toEqual(['header-table', 'body-table', 'nested-table']);
  });
});
