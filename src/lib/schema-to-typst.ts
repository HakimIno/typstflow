import type { ComponentNode, FillPattern, LayoutSchema, TableComponent } from '../types/schema';

/**
 * Phoenix Generator v3.0 — Advanced Table Engine + Page Management
 * Full Typst table API support: table.header, table.footer, table.cell,
 * table.hline, table.vline, fill patterns, inset, gutter, stroke.
 *
 * PAGE MANAGEMENT:
 * - Multi-page tables with automatic header repeat
 * - Zone-based page control (first/last/every page)
 * - Manual page breaks before components
 * - Page break indicators
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

// --- Fill pattern generator ---
function generateFillFunction(
  pattern: FillPattern,
  headerBg: string,
  color1: string,
  color2: string
): string {
  switch (pattern) {
    case 'none':
      return 'none';
    case 'header-only':
      return `(x, y) => if y == 0 { ${formatColor(headerBg)} } else { none }`;
    case 'striped-rows':
      return `(x, y) => if y == 0 { ${formatColor(headerBg)} } else if calc.even(y) { ${formatColor(color1)} } else { ${formatColor(color2)} }`;
    case 'striped-cols':
      return `(x, y) => if y == 0 { ${formatColor(headerBg)} } else if calc.even(x) { ${formatColor(color1)} } else { ${formatColor(color2)} }`;
    case 'checkerboard':
      return `(x, y) => if y == 0 { ${formatColor(headerBg)} } else if calc.even(x + y) { ${formatColor(color1)} } else { ${formatColor(color2)} }`;
    default:
      return `(x, y) => if y == 0 { ${formatColor(headerBg)} } else { none }`;
  }
}

function renderComponent(comp: ComponentNode, data: Record<string, any>, yOffset = 0): string {
  const x = comp.x || 0;
  const y = (comp.y || 0) + yOffset; // Apply vertical offset for zone header
  const w = comp.width || 100;
  const h = comp.height || 20;

  // Handle page break before component
  const pageBreakBefore = (comp as any).pageBreakBefore ? '\n#pagebreak(weak: true)\n' : '';

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
      body = renderTable(table, data);
      break;
    }
    case 'line':
      body = `#line(length: 100%, stroke: ${(comp as any).thickness || '1pt'} + ${formatColor((comp as any).color || 'black')})`;
      break;
    case 'image': {
      const img = comp as any;
      const fit = img.fit || 'contain';
      // Use virtual path if srcData is present — trust the Worker which already swapped it
      const path = img.src;
      body = `#image("${path}", width: 100%, height: 100%, fit: "${fit}")`;
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
        const style = row.style || 'normal';
        const isTotal = style === 'total';
        const isHighlight = style === 'highlight';
        
        const weight = (isTotal || isHighlight) ? 'bold' : 'regular';
        const size = isTotal ? '12pt' : '10pt';
        const color = isTotal ? formatColor('#2563eb') : isHighlight ? formatColor('#3b82f6') : formatColor('#1e293b');
        const bg = isTotal ? formatColor('#eff6ff') : 'none';
        
        rowsHtml += `  table.cell(inset: 5pt, fill: ${bg})[#text(size: 9pt, fill: gray.darken(20%))[${escapeTypst(row.label)}]],\n`;
        rowsHtml += `  table.cell(inset: 5pt, align: right, fill: ${bg})[#text(weight: "${weight}", size: ${size}, fill: ${color})[${escapeTypst(val)}]],\n`;
      }
      body = `#table(columns: (1fr, auto), stroke: none, inset: 1pt,\n${rowsHtml})`;
      break;
    }
    case 'barcode':
    case 'qr': {
      const val = resolveBinding((comp as any).value || '', data);
      body = `#rect(width: 100%, height: 100%, fill: gray.lighten(80%), stroke: 0.5pt + black)[\n    #set align(center + horizon)\n    #text(size: 8pt)[${comp.type.toUpperCase()}\n${escapeTypst(val)}]\n  ]`;
      break;
    }
    case 'page-break-indicator': {
      const indicator = comp as any;
      const label = indicator.label || 'Continued on next page...';
      const showPageNum = indicator.showPageNumber !== false;
      const strokeStyle = indicator.style || 'dashed';
      const stroke = strokeStyle === 'dashed' ? 'dash' : strokeStyle === 'dotted' ? 'dot' : 'solid';

      if (showPageNum) {
        body = `#align(center)[#line(length: 40%, stroke: 0.5pt + gray, ${stroke})\n#text(size: 8pt, fill: gray)[${escapeTypst(label)} — Page #context counter(page).display() of #context counter(page).final().display()]\n#line(length: 40%, stroke: 0.5pt + gray, ${stroke})]`;
      } else {
        body = `#align(center)[#line(length: 40%, stroke: 0.5pt + gray, ${stroke})\n#text(size: 8pt, fill: gray)[${escapeTypst(label)}]\n#line(length: 40%, stroke: 0.5pt + gray, ${stroke})]`;
      }
      break;
    }
    default:
      body = `/* [${comp.type}] fallback */`;
  }

  // Final placement with fixed dimensions. Use block(clip: true) to contain content.
  return `${pageBreakBefore}#place(dx: ${x}mm, dy: ${y}mm)[#block(width: ${w}mm, height: ${h}mm, clip: false)[${body}]]\n`;
}

// --- Advanced Table Renderer ---
function renderTable(table: TableComponent, data: Record<string, any>): string {
  const style = table.style || {};
  const columns = table.columns || [];

  if (columns.length === 0) {
    return '/* empty table */';
  }

  let t = '#table(\n';

  // 1. Columns
  t += '  columns: (';
  t += columns.map((c) => (c.width || '1fr').replace('*', 'fr')).join(', ');
  t += '),\n';

  // 2. Row heights (if specified)
  if (style.rowHeights && style.rowHeights.length > 0) {
    t += `  rows: (${style.rowHeights.join(', ')}),\n`;
  }

  // 3. Inset
  const inset = style.inset || style.cellPadding || '7pt';
  t += `  inset: ${inset},\n`;

  // 4. Stroke
  const borderWidth = style.borderWidth || '0.5pt';
  const borderColor = formatColor(style.borderColor || 'gray');
  if (typeof style.stroke === 'object' && style.stroke) {
    // Per-side stroke dictionary
    const s = style.stroke;
    const parts: string[] = [];
    if (s.top) parts.push(`top: ${s.top}`);
    if (s.bottom) parts.push(`bottom: ${s.bottom}`);
    if (s.left) parts.push(`left: ${s.left}`);
    if (s.right) parts.push(`right: ${s.right}`);
    t += `  stroke: (${parts.join(', ')}),\n`;
  } else {
    t += `  stroke: ${borderWidth} + ${borderColor},\n`;
  }

  // 5. Gutter
  if (style.columnGutter) {
    t += `  column-gutter: ${style.columnGutter},\n`;
  }
  if (style.rowGutter) {
    t += `  row-gutter: ${style.rowGutter},\n`;
  }
  if (style.gutter && !style.columnGutter && !style.rowGutter) {
    t += `  gutter: ${style.gutter},\n`;
  }

  // 6. Fill
  const fillPattern = style.fillPattern || 'header-only';
  const headerBg = style.headerBackground || '#e2e8f0';
  const color1 = style.stripedColor1 || style.alternateRowBackground || '#f8fafc';
  const color2 = style.stripedColor2 || '#ffffff';

  if (fillPattern === 'none') {
    t += '  fill: none,\n';
  } else {
    const fillFn = generateFillFunction(fillPattern, headerBg, color1, color2);
    t += `  fill: ${fillFn},\n`;
  }

  // 7. Align (per-column array)
  const aligns = columns.map((c) => c.align || 'left');
  const hasVariedAligns = aligns.some((a) => a !== aligns[0]);
  if (hasVariedAligns) {
    t += `  align: (${aligns.join(', ')}),\n`;
  }

  // 8. Header - Enhanced multi-page support
  let currentY = 0;

  if (table.headerRows && table.headerRows.length > 0) {
    // Structured multi-row header with automatic page repeat
    const repeat = table.repeatHeaderOnPage !== false; // Default: true for multi-page
    t += `  table.header(repeat: ${repeat},\n`;
    for (const headerRow of table.headerRows) {
      for (const cell of headerRow.cells) {
        const content = escapeTypst(cell.content || '');
        const cs = cell.colspan || 1;
        const rs = cell.rowspan || 1;
        if (cs === 1 && rs === 1 && !cell.fill && !cell.align) {
          t += `    [*${content}*],\n`;
        } else {
          let cellArgs = '';
          if (cs > 1) cellArgs += `colspan: ${cs}, `;
          if (rs > 1) cellArgs += `rowspan: ${rs}, `;
          if (cell.fill) cellArgs += `fill: ${formatColor(cell.fill)}, `;
          if (cell.align) cellArgs += `align: ${cell.align}, `;
          if (cell.inset) cellArgs += `inset: ${cell.inset}, `;
          t += `    table.cell(${cellArgs})[*${content}*],\n`;
        }
      }
      currentY++;
    }
    t += '  ),\n';
  } else {
    // Legacy: use column headers as single header row
    if (table.showHeader !== false) {
      const repeat = table.repeatHeaderOnPage !== false; // Enable auto-repeat on multi-page
      t += `  table.header(repeat: ${repeat},\n`;
      const coveredHeader = new Set<number>();
      for (let cx = 0; cx < columns.length; cx++) {
        if (coveredHeader.has(cx)) continue;
        const col = columns[cx];
        const cs = col.colspan || 1;
        const rs = col.rowspan || 1;
        const escapedHeader = escapeTypst(col.header || '');

        if (cs === 1 && rs === 1) {
          t += `    [*${escapedHeader}*],\n`;
        } else {
          let cellArgs = `x: ${cx}, y: ${currentY}`;
          if (cs > 1) cellArgs += `, colspan: ${cs}`;
          if (rs > 1) cellArgs += `, rowspan: ${rs}`;
          t += `    table.cell(${cellArgs})[*${escapedHeader}*],\n`;
        }
        for (let i = 1; i < cs; i++) coveredHeader.add(cx + i);
      }
      t += '  ),\n';
      currentY++;
    }
  }

  // 9. HLines before data (if any target row <= currentY)
  const hlines = table.hlines || [];
  for (const hl of hlines.filter((h) => h.y <= currentY)) {
    let hlArgs = `y: ${hl.y}`;
    if (hl.start !== undefined && hl.start > 0) hlArgs += `, start: ${hl.start}`;
    if (hl.end !== undefined) hlArgs += `, end: ${hl.end}`;
    if (hl.stroke) hlArgs += `, stroke: ${hl.stroke}`;
    t += `  table.hline(${hlArgs}),\n`;
  }

  // 10. Data Rows
  const path = (table.dataSource || '').replace(/\{\{(.+?)\}\}/g, '$1').trim();
  const items = resolvePath(path, data) || [];
  if (Array.isArray(items)) {
    for (const item of items) {
      const coveredRow = new Set<number>();
      for (let cx = 0; cx < columns.length; cx++) {
        if (coveredRow.has(cx)) continue;
        const col = columns[cx];
        const cs = col.colspan || 1;
        const rs = col.rowspan || 1;
        const val = resolvePath(col.field, item);
        const cellVal = val !== undefined ? escapeTypst(String(val)) : '';

        // Check for per-column cell style overrides
        const hasOverrides = col.background || (cs > 1) || (rs > 1);

        if (!hasOverrides) {
          t += `  [${cellVal}],\n`;
        } else {
          let cellArgs = '';
          if (cs > 1) cellArgs += `colspan: ${cs}, `;
          if (rs > 1) cellArgs += `rowspan: ${rs}, `;
          if (col.background) cellArgs += `fill: ${formatColor(col.background)}, `;
          t += `  table.cell(${cellArgs})[${cellVal}],\n`;
        }

        for (let i = 1; i < cs; i++) coveredRow.add(cx + i);
      }
      currentY++;
    }
  }

  // 11. HLines (rendered after data rows — Typst places them by y position)
  const headerEndY = table.showHeader !== false ? 1 : 0;
  for (const hl of hlines) {
    if (hl.y <= headerEndY) continue; // already rendered before data
    let hlArgs = `y: ${hl.y}`;
    if (hl.start !== undefined && hl.start > 0) hlArgs += `, start: ${hl.start}`;
    if (hl.end !== undefined) hlArgs += `, end: ${hl.end}`;
    if (hl.stroke) hlArgs += `, stroke: ${hl.stroke}`;
    if (hl.position) hlArgs += `, position: ${hl.position}`;
    t += `  table.hline(${hlArgs}),\n`;
  }

  // 12. VLines
  const vlines = table.vlines || [];
  for (const vl of vlines) {
    let vlArgs = `x: ${vl.x}`;
    if (vl.start !== undefined && vl.start > 0) vlArgs += `, start: ${vl.start}`;
    if (vl.end !== undefined) vlArgs += `, end: ${vl.end}`;
    if (vl.stroke) vlArgs += `, stroke: ${vl.stroke}`;
    if (vl.position) vlArgs += `, position: ${vl.position}`;
    t += `  table.vline(${vlArgs}),\n`;
  }

  // 13. Footer
  const footerRows = table.footerRows || [];
  if (footerRows.length > 0) {
    const repeat = footerRows[0]?.repeat !== false;
    t += `  table.footer(repeat: ${repeat},\n`;
    for (const footerRow of footerRows) {
      for (const cell of footerRow.cells) {
        const content = resolveBinding(cell.content || '', data);
        const escapedContent = escapeTypst(content);
        const cs = cell.colspan || 1;
        const rs = cell.rowspan || 1;

        if (cs === 1 && rs === 1 && !cell.fill && !cell.align) {
          t += `    [*${escapedContent}*],\n`;
        } else {
          let cellArgs = '';
          if (cs > 1) cellArgs += `colspan: ${cs}, `;
          if (rs > 1) cellArgs += `rowspan: ${rs}, `;
          if (cell.fill) cellArgs += `fill: ${formatColor(cell.fill)}, `;
          if (cell.align) cellArgs += `align: ${cell.align}, `;
          t += `    table.cell(${cellArgs})[*${escapedContent}*],\n`;
        }
      }
    }
    t += '  ),\n';
  }

  // 14. Summary Rows (legacy support)
  if (table.summaryRows && table.summaryRows.length > 0) {
    for (const row of table.summaryRows) {
      if (row.separator) {
        t += `  table.hline(stroke: 1pt + black),\n`;
      }
      const val = resolveBinding(row.value || '', data);
      const escapedLabel = escapeTypst(row.label || '');
      const escapedVal = escapeTypst(val);
      const weight = row.style?.fontWeight === 'bold' ? 'bold' : 'regular';
      t += `  table.cell(colspan: ${columns.length - 1}, align: right)[*${escapedLabel}*],\n`;
      t += `  [#text(weight: "${weight}")[${escapedVal}]],\n`;
    }
  }

  t += ')';
  return t;
}

export function schemaToTypst(schema: LayoutSchema, data: Record<string, any>): string {
  const { page } = schema;
  let typst = '// PHOENIX ENGINE v3.0 — PAGE MANAGEMENT + MULTI-PAGE TABLES\n';

  // Page Setup with zone-based control
  const headerZone = schema.zones.header;
  const footerZone = schema.zones.footer;
  const bodyZone = schema.zones.body;

  // Build header content for page setup
  let headerContent = '';
  if (headerZone.components.length > 0) {
    // Check if header should only show on first page
    if (headerZone.showOnFirstPageOnly) {
      headerContent = '#context if counter(page).get().at(0) == 1 [';
      for (const c of headerZone.components) {
        headerContent += `  ${renderComponent(c, data, ZONE_HEADER_HEIGHT_MM)}`;
      }
      headerContent += ']';
    } else {
      // Default: show on every page
      for (const c of headerZone.components) {
        headerContent += `  ${renderComponent(c, data, ZONE_HEADER_HEIGHT_MM)}`;
      }
    }
  }

  // Build footer content for page setup
  let footerContent = '';
  if (footerZone.components.length > 0) {
    // Check if footer should only show on last page
    if (footerZone.showOnLastPageOnly) {
      footerContent = '#context if counter(page).get().at(0) == counter(page).final().at(0) [';
      for (const c of footerZone.components) {
        footerContent += `  ${renderComponent(c, data, ZONE_HEADER_HEIGHT_MM)}`;
      }
      footerContent += ']';
    } else {
      // Default: show on every page
      for (const c of footerZone.components) {
        footerContent += `  ${renderComponent(c, data, ZONE_HEADER_HEIGHT_MM)}`;
      }
    }
  }

  typst += `#set page(
  paper: "${page.size.toLowerCase()}",
  flipped: ${page.orientation === 'landscape'},
  margin: (top: ${page.margin.top}, bottom: ${page.margin.bottom}, left: ${page.margin.left}, right: ${page.margin.right}),
  header: ${headerContent ? '[#place(dx: 0mm, dy: 2mm)[' + headerContent + ']]' : 'none'},
  footer: ${footerContent ? '[#place(dx: 0mm, dy: -2mm)[' + footerContent + ']]' : 'none'},
)\n`;

  // Fonts & Paragraph Setup
  const mainFont = schema.fonts[0];
  typst += `#set text(font: "${mainFont.family}", size: ${mainFont.size}pt, lang: "th")\n`;
  typst += '#set par(leading: 0.2em, justify: false)\n';

  // Body Zone - Main content area (header/footer are handled by page setup)
  if (bodyZone.components.length > 0) {
    typst += '\n// ZONE: BODY (MAIN CONTENT)\n';
    typst += '#block(width: 100%)[\n';
    for (const c of bodyZone.components) {
      // Apply ZONE_HEADER_HEIGHT_MM offset to match designer's coordinate system
      typst += `  ${renderComponent(c, data, ZONE_HEADER_HEIGHT_MM)}`;
    }
    typst += ']\n';
  }

  return typst;
}
