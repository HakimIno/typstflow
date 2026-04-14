import type { ComponentNode, LayoutSchema } from '../types/schema';

/**
 * Phoenix Generator (Stable FIX)
 * Removed 'clip: true' from zones to prevent absolute components from being hidden.
 *
 * COORDINATE SYSTEM:
 * The designer has a 24px (6.35mm) header bar in each zone.
 * Components are positioned relative to the content area below this header.
 * To match this in Typst (which doesn't render the header), we offset all
 * component y-positions by ZONE_HEADER_HEIGHT_MM.
 */

const ZONE_HEADER_HEIGHT_MM = 6.35; // 24px at 96 DPI

function resolvePath(path: string, obj: any) {
  if (!path) return undefined;
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

function resolveBinding(expr: string, data: Record<string, any>): string {
  if (!expr) return '';
  return expr.replace(/\{\{(.+?)\}\}/g, (_, path) => {
    const val = resolvePath(path.trim(), data);
    return val !== undefined ? String(val) : `{{${path}}}`;
  });
}

function escapeTypst(str: string): string {
  if (!str) return '';
  return str.replace(/([#\*_\[\]\(\)\{\}<>@=\/])/g, '\\$1');
}

function formatColor(color: string): string {
  if (!color) return 'none';
  if (color.startsWith('#')) return `rgb("${color}")`;
  return color;
}

function renderComponent(comp: ComponentNode, data: Record<string, any>, yOffset = 0): string {
  const x = comp.x || 0;
  const y = (comp.y || 0) + yOffset; // Apply vertical offset for zone header
  const w = comp.width || 100;
  const h = comp.height || 20;

  let body = '';
  switch (comp.type) {
    case 'text': {
      const align = comp.align || 'left';
      const weight = comp.style?.fontWeight === 'bold' ? 'bold' : 'regular';
      const size = comp.style?.fontSize || 10;
      const content = resolveBinding(comp.content || '', data);
      const escapedContent = escapeTypst(content) || ' '; // Ensure non-empty content
      body = `#set align(${align})\n#set par(leading: 0.2em)\n#text(size: ${size}pt, weight: "${weight}")[${escapedContent}]`;
      break;
    }
    case 'table': {
      const table = comp as TableComponent;
      const style = table.style || {};
      const headerBg = formatColor(style.headerBackground || 'blue.lighten(92%)');
      const alternateBg = formatColor(style.alternateRowBackground || 'none');
      const borderColor = formatColor(style.borderColor || 'gray');
      const borderWidth = style.borderWidth || '0.5pt';

      const columns = table.columns || [];
      if (columns.length === 0) {
        body = '/* empty table */';
        break;
      }

      // 1. Physical Tracks (Standard, one track per column definition)
      let t = '#table(\n  columns: (';
      t += columns.map((c: any) => (c.width || '1fr').replace('*', 'fr')).join(', ');
      t += `),\n  inset: 7pt, stroke: ${borderWidth} + ${borderColor},\n`;
      t += `  fill: (x, y) => if y == 0 { ${headerBg} } else if calc.even(y) { ${alternateBg} } else { none },\n`;

      let currentY = 0;

      // (2) Header Row
      const coveredHeader = new Set<number>();
      for (let x = 0; x < columns.length; x++) {
        if (coveredHeader.has(x)) continue;
        
        const col = columns[x];
        const cs = col.colspan || 1;
        const rs = col.rowspan || 1;
        const escapedHeader = escapeTypst(col.header || '');
        
        if (cs === 1 && rs === 1) {
          t += `  [*${escapedHeader}*],\n`;
        } else {
          t += `  table.cell(x: ${x}, y: ${currentY}, colspan: ${cs}, rowspan: ${rs})[*${escapedHeader}*],\n`;
        }
        
        for (let i = 1; i < cs; i++) coveredHeader.add(x + i);
      }
      currentY += 1;

      // (3) Data Rows
      const path = (table.dataSource || '').replace(/\{\{(.+?)\}\}/g, '$1').trim();
      const items = resolvePath(path, data) || [];
      if (Array.isArray(items)) {
        for (const item of items) {
          const coveredRow = new Set<number>();
          for (let x = 0; x < columns.length; x++) {
            if (coveredRow.has(x)) continue;

            const col = columns[x];
            const cs = col.colspan || 1;
            const rs = col.rowspan || 1;
            const val = resolvePath(col.field, item);
            const cellVal = val !== undefined ? escapeTypst(String(val)) : '';
            
            if (cs === 1 && rs === 1) {
              t += `  [${cellVal}],\n`;
            } else {
              t += `  table.cell(x: ${x}, y: ${currentY}, colspan: ${cs}, rowspan: ${rs})[${cellVal}],\n`;
            }
            
            for (let i = 1; i < cs; i++) coveredRow.add(x + i);
          }
          currentY += 1;
        }
      }
      body = `${t})`;
      break;
    }
    case 'line':
      body = `#line(length: 100%, stroke: ${(comp as any).thickness || '1pt'} + ${formatColor((comp as any).color || 'black')})`;
      break;
    case 'image': {
      const img = comp as any;
      const fit = img.fit || 'contain';
      // In Typst WASM, we usually use paths or we'd need to provide files.
      // For now, we use the source string.
      body = `#image("${img.src}", width: 100%, height: 100%, fit: "${fit}")`;
      break;
    }
    case 'spacer':
      body = `#v(${(comp as any).height || 0}mm, weak: true)`;
      break;
    case 'summary-box': {
      const box = comp as any;
      let rowsHtml = '';
      for (const row of box.rows || []) {
        const val = resolveBinding(row.value || '', data);
        const isTotal = row.style === 'total';
        const weight = isTotal ? 'bold' : 'regular';
        const size = isTotal ? '11pt' : '10pt';
        rowsHtml += `  [${escapeTypst(row.label)}:], [#text(weight: "${weight}", size: ${size})[${escapeTypst(val)}]],\n`;
      }
      body = `#table(columns: (1fr, auto), stroke: none, inset: 4pt,\n${rowsHtml})`;
      break;
    }
    case 'barcode':
    case 'qr': {
      const val = resolveBinding((comp as any).value || '', data);
      body = `#rect(width: 100%, height: 100%, fill: gray.lighten(80%), stroke: 0.5pt + black)[\n    #set align(center + horizon)\n    #text(size: 8pt)[${comp.type.toUpperCase()}\n${escapeTypst(val)}]\n  ]`;
      break;
    }
    default:
      body = `/* [${comp.type}] fallback */`;
  }

  // Final placement with fixed dimensions. Use block(clip: true) to contain content.
  return `#place(dx: ${x}mm, dy: ${y}mm)[#block(width: ${w}mm, height: ${h}mm, clip: false)[${body}]]\n`;
}

export function schemaToTypst(schema: LayoutSchema, data: Record<string, any>): string {
  const { page } = schema;
  let typst = '// PHOENIX ENGINE v1.1 STABLE\n';

  // Page Setup
  typst += `#set page(
  paper: "${page.size.toLowerCase()}",
  flipped: ${page.orientation === 'landscape'},
  margin: (top: ${page.margin.top}, bottom: ${page.margin.bottom}, left: ${page.margin.left}, right: ${page.margin.right}),
)\n`;

  // Fonts & Paragraph Setup
  const mainFont = schema.fonts[0];
  typst += `#set text(font: "${mainFont.family}", size: ${mainFont.size}pt, lang: "th")\n`;
  typst += '#set par(leading: 0.2em, justify: false)\n';

  // Zones - NO CLIPPING here, as absolute placed items have 0 height in their container flow
  for (const key of ['header', 'body', 'footer'] as const) {
    const zone = schema.zones[key];
    if (zone.components.length > 0) {
      typst += `\n// ZONE: ${key.toUpperCase()}\n`;
      // We wrap in a block for namespacing but CLIP MUST BE FALSE or UNSET
      typst += '#block(width: 100%)[\n';
      for (const c of zone.components) {
        // Apply ZONE_HEADER_HEIGHT_MM offset to match designer's coordinate system
        // (designer has a 24px header bar that Typst doesn't render)
        typst += `  ${renderComponent(c, data, ZONE_HEADER_HEIGHT_MM)}`;
      }
      // Add some spacing between bands to prevent overlap if not absolutely positioned
      typst += ']\n';
    }
  }

  return typst;
}
