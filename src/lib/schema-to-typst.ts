import { LayoutSchema, ComponentNode } from '../types/schema';

/**
 * Phoenix Generator (Stable FIX)
 * Removed 'clip: true' from zones to prevent absolute components from being hidden.
 */

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
  // Typst syntax characters: #, *, _, [, ], (, ), {, }, <, >, @, =, /
  // We need to be careful with backslashes too.
  return str.replace(/([#\*_\[\]\(\)\{\}<>@=\/])/g, '\\$1');
}

function renderComponent(comp: ComponentNode, data: Record<string, any>): string {
  const x = comp.x || 0;
  const y = comp.y || 0;
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
      body = `#set align(${align})\n#text(size: ${size}pt, weight: "${weight}")[${escapedContent}]`;
      break;
    }
    case 'table': {
      const table = comp as any;
      let t = '#table(\n  columns: (';
      const columns = table.columns || [{ header: 'Column', field: '', width: '1fr' }];
      t += columns.map((c: any) => (c.width || '1fr').replace('*', 'fr')).join(', ');
      t += '),\n  inset: 7pt, stroke: 0.5pt + gray, fill: (x, y) => if y == 0 { blue.lighten(92%) },\n';
      
      // Headers
      t += '  ' + columns.map((c: any) => `[*${escapeTypst(c.header || '')}*]`).join(', ') + ',\n';
      
      // Data Rows
      const path = (table.dataSource || '').replace(/\{\{(.+?)\}\}/g, '$1').trim();
      const items = resolvePath(path, data) || [];
      if (Array.isArray(items)) {
        items.forEach(item => {
          t += '  ' + columns.map((c: any) => {
            const val = resolvePath(c.field, item);
            const cellVal = val !== undefined ? escapeTypst(String(val)) : '';
            return `[${cellVal}]`;
          }).join(', ') + ',\n';
        });
      }
      body = t + ')';
      break;
    }
    case 'line':
      body = `#line(length: 100%, stroke: ${(comp as any).thickness || '1pt'} + ${(comp as any).color || 'black'})`;
      break;
    default:
      body = `/* [${comp.type}] fallback */`;
  }

  // Final placement with fixed dimensions. Use block(clip: true) to contain content.
  return `#place(dx: ${x}mm, dy: ${y}mm)[#block(width: ${w}mm, height: ${h}mm, clip: false)[${body}]]\n`;
}


export function schemaToTypst(schema: LayoutSchema, data: Record<string, any>): string {
  const { page } = schema;
  let typst = `// PHOENIX ENGINE v1.1 STABLE\n`;
  
  // Page Setup
  typst += `#set page(
  paper: "${page.size.toLowerCase()}",
  flipped: ${page.orientation === 'landscape'},
  margin: (top: ${page.margin.top}, bottom: ${page.margin.bottom}, left: ${page.margin.left}, right: ${page.margin.right}),
)\n`;

  // Fonts
  const mainFont = schema.fonts[0];
  typst += `#set text(font: "${mainFont.family}", size: ${mainFont.size}pt, lang: "th")\n`;

  // Zones - NO CLIPPING here, as absolute placed items have 0 height in their container flow
  for (const key of ['header', 'body', 'footer'] as const) {
    const zone = schema.zones[key];
    if (zone.components.length > 0) {
      typst += `\n// ZONE: ${key.toUpperCase()}\n`;
      // We wrap in a block for namespacing but CLIP MUST BE FALSE or UNSET
      typst += `#block(width: 100%)[\n`;
      zone.components.forEach(c => {
        typst += `  ${renderComponent(c, data)}`;
      });
      // Add some spacing between bands to prevent overlap if not absolutely positioned
      typst += `]\n`;
    }
  }

  return typst;
}
