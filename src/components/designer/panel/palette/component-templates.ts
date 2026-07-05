// Cases here enumerate the same component types as `DragThumb` in
// `PaletteDragPreview.tsx`. Kept separate (different return shapes: data object
// vs. visual mock) — if you add a type here, check whether `DragThumb` needs a
// matching case.
export function createDefaultComponent(type: string) {
  const base = { id: '', x: 10, y: 10, width: 100, height: 20 };
  switch (type) {
    case 'text':
      return {
        ...base,
        type: 'text',
        content: 'Double click to edit',
        style: { fontSize: 10 },
        width: 60,
        height: 6,
      };
    case 'table': {
      const headerRow = {
        id: 'header-row-1',
        type: 'header',
        height: '10mm',
        cells: [{ id: 'header-cell-1', content: 'Header', align: 'left' }],
      };
      const detailRow = {
        id: 'detail-row-1',
        type: 'data',
        height: '10mm',
        cells: [{ id: 'detail-cell-1', content: '{{items.field}}', align: 'left' }],
      };

      return {
        ...base,
        type: 'table',
        dataSource: '{{items}}',
        columns: [{ id: '1', header: 'Header', field: 'field', width: '180mm', align: 'left' }],
        style: {
          inset: '7pt',
          borderWidth: '0.5pt',
          borderColor: '#cbd5e1',
          headerBackground: '#f1f5f9',
          headerColor: '#000000',
          headerFontSize: 10,
          headerFontWeight: 'bold',
          bodyFontSize: 10,
          bodyColor: '#334155',
          fillPattern: 'header-only',
          fontFamily: 'Sarabun',
        },
        showHeader: true,
        repeatHeaderOnPage: true,
        headerRows: [headerRow],
        detailRows: [detailRow],
        rows: [headerRow, detailRow],
        width: 120,
        height: 20,
      };
    }
    case 'image':
      return { ...base, type: 'image', src: '/logo13.png', width: 40, height: 40 };
    case 'line':
      return {
        ...base,
        type: 'line',
        orientation: 'horizontal',
        thickness: '1pt',
        color: 'black',
        width: 180,
        height: 2,
      };
    case 'qr':
      return { ...base, type: 'qr', value: 'https://example.com', width: 30, height: 30 };
    case 'spacer':
      return { ...base, type: 'spacer', height: 10, width: 10 };
    case 'columns':
      return {
        ...base,
        type: 'columns',
        gap: '10mm',
        columns: [
          { width: '1fr', components: [] },
          { width: '1fr', components: [] },
        ],
        width: 180,
        height: 28,
      };
    case 'summary-box':
      return {
        ...base,
        type: 'summary-box',
        rows: [{ label: 'Subtotal', value: '$0.00' }],
        width: 80,
        height: 14,
      };
    case 'checklist':
      return {
        ...base,
        type: 'checklist',
        listStyle: 'bullet',
        items: [
          { id: 'item-1', label: 'รายการที่ 1', checked: false },
          { id: 'item-2', label: 'รายการที่ 2', checked: false },
          { id: 'item-3', label: 'รายการที่ 3', checked: false },
        ],
        spacing: 4,
        indent: 5,
        style: { fontSize: 10, fontFamily: 'Sarabun', color: '#000000' },
        width: 120,
        height: 18,
      };
    case 'page-break-indicator':
      return {
        ...base,
        type: 'page-break-indicator',
        width: 210,
        height: 2,
      };
    case 'page-number':
      return {
        ...base,
        type: 'page-number',
        format: 'Page X of Y',
        style: { fontSize: 9, fontWeight: 'medium' },
        width: 35,
        height: 6,
      };
    case 'rectangle':
      return {
        ...base,
        type: 'rectangle',
        fill: '#f3f4f6',
        strokeColor: '#d1d5db',
        strokeWidth: '1pt',
        strokeStyle: 'solid',
        radius: '2mm',
        width: 60,
        height: 20,
      };
    case 'signature':
      return {
        ...base,
        type: 'signature',
        slots: [
          {
            id: 'sig-1',
            label: 'ผู้อนุมัติ',
            nameLabel: '(......................)',
            dateLabel: 'วันที่: ___/___/______',
          },
          {
            id: 'sig-2',
            label: 'ผู้ตรวจสอบ',
            nameLabel: '(......................)',
            dateLabel: 'วันที่: ___/___/______',
          },
        ],
        showNameLine: true,
        showDateLine: true,
        lineStyle: 'solid',
        lineColor: '#000000',
        labelStyle: { fontSize: 8 },
        width: 180,
        height: 16,
      };
    default:
      return { ...base, type: 'text', content: '', height: 10 };
  }
}
