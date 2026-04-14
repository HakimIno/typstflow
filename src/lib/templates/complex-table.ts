import type { LayoutSchema } from '../../types/schema';

export const COMPLEX_TABLE_TEMPLATE: LayoutSchema = {
  id: 'complex-table-demo',
  name: 'Complex Table Demo',
  version: '1.0.0',
  page: {
    size: 'A4',
    orientation: 'portrait',
    margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
  },
  fonts: [{ family: 'Sarabun', role: 'body', size: 10, embedded: true }],
  zones: {
    header: {
      id: 'header',
      minHeight: '30mm',
      components: [
        {
          id: 't1',
          type: 'text',
          content: 'Complex Table & Data Binding Demo',
          x: 0,
          y: 0,
          width: 180,
          height: 15,
          style: { fontSize: 20, fontWeight: 'bold' },
          align: 'center',
        },
      ],
    },
    body: {
      id: 'body',
      minHeight: '150mm',
      components: [
        {
          id: 'demo-table',
          type: 'table',
          x: 0,
          y: 20,
          width: 180,
          height: 80,
          dataSource: '{{inventory}}',
          showHeader: true,
          style: {
            headerBackground: '#1e293b',
            headerRows: 1,
            alternateRowBackground: '#f8fafc',
            borderColor: '#e2e8f0',
            borderWidth: '0.5pt',
          },
          columns: [
            { id: 'c1', header: 'Category & Product', field: 'name', width: '2fr', colspan: 2 },
            { id: 'c2', header: 'Hidden', field: '', width: '1fr' }, // This will be covered by C1
            { id: 'c3', header: 'Details', field: 'sku', width: '1fr', rowspan: 1 },
            { id: 'c4', header: 'Quantity', field: 'qty', width: '50pt', align: 'center' },
            { id: 'c5', header: 'Price', field: 'price', width: '70pt', align: 'right' },
          ],
        },
      ],
    },
    footer: {
      id: 'footer',
      minHeight: '20mm',
      components: [],
    },
  },
  variables: [],
  dataSchema: [],
  metadata: {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: 'Antigravity',
  },
};

export const COMPLEX_SAMPLE_DATA = {
  inventory: [
    { name: 'Electronics: Smartphone X', sku: 'SP-X01', qty: 25, price: '$999.00' },
    { name: 'Electronics: Laptop Pro', sku: 'LP-P02', qty: 10, price: '$1,499.00' },
    { name: 'Office: Ergonomic Chair', sku: 'CH-E03', qty: 50, price: '$299.00' },
    { name: 'Office: Standing Desk', sku: 'SD-S04', qty: 15, price: '$450.00' },
  ],
};
