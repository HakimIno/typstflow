import type { ComponentNode, LayoutSchema, TableComponent } from '../../types/schema';
import { escapeTypst } from '../utils/typst-utils';

/**
 * Professional-grade Typst Code Generator.
 * Handles layout conversion, data binding, and resource sanitization.
 */
export class TypstGenerator {
  private schema: LayoutSchema;
  private data: Record<string, any>;

  constructor(schema: LayoutSchema, data: Record<string, any>) {
    this.schema = schema;
    this.data = data;
  }

  /**
   * Generates the full Typst source code from the schema.
   */
  generate(): string {
    let typst = '// TYPSTFLOW CORE GENERATOR v2.0\n';

    typst += this.generatePageSetup();
    typst += this.generateFonts();
    typst += this.generateHelpers();

    // Zones
    typst += '\n// --- Report Base ---\n';

    // 1. Header (Global)
    typst += this.renderZone('header', this.schema.zones.header);

    // 2. Main Content (Groups + Pages/Body)
    typst += this.renderContent();

    // 3. Footer (Global)
    typst += this.renderZone('footer', this.schema.zones.footer);

    return typst;
  }

  private renderContent(): string {
    const groups = this.schema.groups || [];
    if (groups.length === 0) {
      // Standard behavior: Render all pages
      let t = '';
      for (let i = 0; i < this.schema.pages.length; i++) {
        const page = this.schema.pages[i];
        t += this.renderZone(`body-page-${i + 1}`, page.body);
        if (i < this.schema.pages.length - 1) t += '\n#pagebreak()\n';
      }
      return t;
    }

    // Grouping behavior: Render nested loops
    // We assume data is in 'items' for grouping, or the root object is an array
    return this.renderGroupLevel(0, this.data.items || []);
  }

  private renderGroupLevel(index: number, items: any[]): string {
    const group = this.schema.groups[index];
    if (!group) {
      // Innermost level: Render the Detail Band (Body) for each item
      let t = '';
      for (const item of items) {
        t += this.renderZone('detail-band', this.schema.pages[0].body, item);
      }
      return t;
    }

    // Grouping logic: Pre-group items by field
    let filteredItems = items;
    if (group.filterBy) {
      filteredItems = items.filter(item => {
        try {
          // Simple evaluation for filtering
          return !!this.resolvePath(group.filterBy!, item);
        } catch {
          return true;
        }
      });
    }

    const groupsMap = new Map<any, any[]>();
    for (const item of filteredItems) {
      const key = this.resolvePath(group.field, item);
      if (!groupsMap.has(key)) groupsMap.set(key, []);
      groupsMap.get(key)?.push(item);
    }

    // Sort groups
    let sortedKeys = Array.from(groupsMap.keys());
    if (group.sortBy) {
      sortedKeys.sort((a, b) => {
        const valA = a ?? '';
        const valB = b ?? '';
        
        if (typeof valA === 'number' && typeof valB === 'number') {
          return group.sortBy === 'asc' ? valA - valB : valB - valA;
        }
        
        const strA = String(valA);
        const strB = String(valB);
        return group.sortBy === 'asc' 
          ? strA.localeCompare(strB, undefined, { numeric: true }) 
          : strB.localeCompare(strA, undefined, { numeric: true });
      });
    }

    let t = '';
    for (const key of sortedKeys) {
      const groupItems = groupsMap.get(key)!;
      // 1. Group Header (Pass groupItems for aggregates if needed)
      t += this.renderZone(`group-${group.id}-header`, group.header, groupItems[0], groupItems);
      
      // 2. Nested Groups or Detail Band
      t += this.renderGroupLevel(index + 1, groupItems);
      
      // 3. Group Footer (Pass groupItems for aggregates like SUM)
      t += this.renderZone(`group-${group.id}-footer`, group.footer, groupItems[0], groupItems);
    }
    return t;
  }

  private generatePageSetup(): string {
    const { page } = this.schema;
    return `#set page(
  paper: "${page.size.toLowerCase()}",
  flipped: ${page.orientation === 'landscape'},
  margin: (top: ${page.margin.top}, bottom: ${page.margin.bottom}, left: ${page.margin.left}, right: ${page.margin.right})
)\n`;
  }

  private generateFonts(): string {
    const mainFont = this.schema.fonts.find((f) => f.role === 'body') || this.schema.fonts[0];
    if (!mainFont) return '';
    return `#set text(font: "${mainFont.family}", size: ${mainFont.size}pt, lang: "th")\n`;
  }

  private renderZone(label: string, zone: any, context?: any, groupItems?: any[]): string {
    if (!zone || !zone.components || zone.components.length === 0) return '';

    let typst = `\n// Band: ${label.toUpperCase()}\n`;
    typst += `#block(width: 100%, height: ${zone.minHeight || 'auto'}, clip: true)[\n`;
    for (const comp of zone.components) {
      typst += `  ${this.renderComponent(comp, context, groupItems)}`;
    }
    typst += ']\n';
    return typst;
  }

  private renderComponent(comp: ComponentNode, context?: any, groupItems?: any[]): string {
    const x = comp.x || 0;
    const y = comp.y || 0;
    const w = comp.width || 100;
    const h = comp.height || 20;

    const body = this.getComponentBody(comp, context, groupItems);
    return `#place(dx: ${x}mm, dy: ${y}mm)[#block(width: ${w}mm, height: ${h}mm)[${body}]]\n`;
  }

  private getComponentBody(comp: ComponentNode, context?: any, groupItems?: any[]): string {
    switch (comp.type) {
      case 'text': {
        const align = comp.align || 'left';
        const weight = comp.style?.fontWeight === 'bold' ? 'bold' : 'regular';
        const size = comp.style?.fontSize || 10;
        let content = this.resolveBinding(comp.content, context, groupItems);
        
        if (comp.format && comp.format !== 'text') {
          content = `#fmt_${comp.format.replace('-', '_')}("${content}")`;
          return `#set align(${align})\n#text(size: ${size}pt, weight: "${weight}")[${content}]`;
        }
        
        return `#set align(${align})\n#text(size: ${size}pt, weight: "${weight}")[${this.escapeTypst(content)}]`;
      }

      case 'image': {
        const src = (comp as any).src || '';
        const isRemote =
          src.startsWith('http') || src.startsWith('https') || src.startsWith('data:');
        if (!isRemote && src !== '') {
          return `#rect(width: 100%, height: 100%, fill: gray.lighten(95%), stroke: 0.5pt + gray)[
            #set align(center + horizon)
            #text(size: 6pt, fill: gray.darken(30%))[FILE NOT FOUND: ${src}]
          ]`;
        }
        return `#image("${src}", width: 100%, height: 100%, fit: "contain")`;
      }

      case 'table':
        return this.renderTable(comp as any, context);

      case 'line':
        return `#line(length: 100%, stroke: ${(comp as any).thickness || '1pt'} + ${(comp as any).color || 'black'})`;

      case 'barcode':
      case 'qr':
        return this.renderPlaceholder(
          comp.type.toUpperCase(),
          this.resolveBinding((comp as any).value || '', context, groupItems)
        );

      case 'page-number': {
        const align = comp.align || 'center';
        const weight = comp.style?.fontWeight === 'bold' ? 'bold' : 'regular';
        const size = comp.style?.fontSize || 9;
        const format = (comp as any).format || 'Page {{page}} of {{pageTotal}}';

        let display = format
          .replace(/\{\{page\}\}/g, '#counter(page).display()')
          .replace(/\{\{pageTotal\}\}/g, '#counter(page).final().at(0)');

        return `#set align(${align})\n#text(size: ${size}pt, weight: "${weight}")[#context [${display}]]`;
      }
      default:
        return `// [${comp.type}] not implemented`;
    }
  }

  private renderTable(comp: TableComponent, context?: any): string {
    const style = comp.style || {};
    const headerBg = style.headerBackground || 'blue.lighten(92%)';
    const borderColor = style.borderColor || 'gray';
    const borderWidth = style.borderWidth || '0.5pt';

    let t = '#table(\n    columns: (';
    t += `${comp.columns.map((c: any) => (c.width || '1fr').replace('*', 'fr')).join(', ')}),\n`;
    t += `    inset: 7pt, align: horizon, stroke: ${borderWidth} + ${borderColor},\n`;

    if (comp.showHeader) {
      t += `    fill: (x, y) => if y == 0 { ${headerBg} },\n`;
    }

    let currentY = 0;
    if (comp.showHeader) {
      let currentX = 0;
      for (const col of comp.columns) {
        const cs = col.colspan || 1;
        const rs = col.rowspan || 1;
        if (cs === 1 && rs === 1) {
          t += `    [*${this.escapeTypst(col.header)}*],\n`;
        } else {
          t += `    table.cell(x: ${currentX}, y: ${currentY}, colspan: ${cs}, rowspan: ${rs})[*${this.escapeTypst(col.header)}*],\n`;
        }
        currentX += cs;
      }
      currentY += 1;
    }

    const path = comp.dataSource?.replace(/\{\{(.+?)\}\}/g, '$1').trim();
    const items = this.resolvePath(path, context || this.data) || [];

    for (const item of items as any[]) {
      let currentX = 0;
      for (const col of comp.columns) {
        let val = this.resolvePath(col.field, item);
        const cs = col.colspan || 1;
        const rs = col.rowspan || 1;

        if (col.format && col.format !== 'text') {
          val = `#fmt_${col.format.replace('-', '_')}("${val}")`;
        } else {
          val = this.escapeTypst(val != null ? String(val) : '');
        }

        if (cs === 1 && rs === 1) {
          t += `    [${val}],\n`;
        } else {
          t += `    table.cell(x: ${currentX}, y: ${currentY}, colspan: ${cs}, rowspan: ${rs})[${val}],\n`;
        }
        currentX += cs;
      }
      currentY += 1;
    }

    return `${t})`;
  }

  private renderPlaceholder(label: string, value: string): string {
    return `#rect(width: 100%, height: 100%, stroke: 0.5pt + gray, fill: blue.lighten(98%))[
      #set align(center + horizon)
      #stack(dir: ttb, spacing: 2pt,
        #text(size: 7pt, weight: "bold", fill: blue.darken(40%))[${label}],
        #text(size: 5pt, fill: blue.darken(20%))[${value}]
      )
    ]`;
  }

  private calculateAggregate(func: string, path: string, items: any[]): string {
    if (!items || items.length === 0) return '0';
    
    const values = items.map(item => {
      const val = this.resolvePath(path, item);
      const num = typeof val === 'number' ? val : Number.parseFloat(String(val)) || 0;
      return num;
    });

    switch (func.toUpperCase()) {
      case 'SUM':
        return values.reduce((a, b) => a + b, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      case 'COUNT':
        return items.length.toString();
      case 'AVG':
        return (values.reduce((a, b) => a + b, 0) / items.length).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      case 'MIN':
        return Math.min(...values).toLocaleString();
      case 'MAX':
        return Math.max(...values).toLocaleString();
      default:
        return '0';
    }
  }

  private resolveBinding(expr: string, context?: any, groupItems?: any[]): string {
    if (!expr) return '';
    
    // 1. Handle aggregates: {{SUM(price)}}
    let resolved = expr.replace(/\{\{(SUM|COUNT|AVG|MIN|MAX)\((.+?)\)\}\}/gi, (_, func, path) => {
      return this.calculateAggregate(func, path.trim(), groupItems || []);
    });

    // 2. Handle normal bindings
    return resolved.replace(/\{\{(.+?)\}\}/g, (_, path) => {
      const val = this.resolvePath(path.trim(), context || this.data);
      return val !== undefined ? String(val) : `{{${path}}}`;
    });
  }

  private resolvePath(path: string, obj: any) {
    if (!path) return undefined;
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
  }

  private generateHelpers(): string {
    return `
// --- Formatting Helpers ---
#let fmt_number(v) = {
  if type(v) == "string" { v } else { str(v) }
}
#let fmt_currency_thb(v) = {
  let num = if type(v) == "string" { float(v) } else { v }
  "฿" + str(num)
}
#let fmt_currency_usd(v) = {
  let num = if type(v) == "string" { float(v) } else { v }
  "$" + str(num)
}
#let fmt_date_th(v) = { v }
#let fmt_date_en(v) = { v }
#let fmt_percent(v) = {
  let num = if type(v) == "string" { float(v) } else { v }
  str(num) + "%"
}
\n`;
  }

  private escapeTypst(text: any): string {
    return escapeTypst(String(text ?? ''));
  }
}
