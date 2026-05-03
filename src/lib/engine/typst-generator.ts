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

    // 1. Header (Static if not repeated)
    if (!this.schema.zones.header.repeatOnEveryPage) {
      typst += this.renderZone('header', this.schema.zones.header);
    }

    // 2. Main Content (Groups + Pages/Body)
    typst += this.renderContent();

    // 3. Footer (Static if not repeated)
    if (!this.schema.zones.footer.repeatOnEveryPage) {
      typst += this.renderZone('footer', this.schema.zones.footer);
    }

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
    const { page, zones } = this.schema;
    
    let headerStr = '';
    if (zones.header.repeatOnEveryPage) {
      headerStr = `header: [${this.renderZone('header-repeated', zones.header)}],`;
    }

    let footerStr = '';
    if (zones.footer.repeatOnEveryPage) {
      footerStr = `footer: [${this.renderZone('footer-repeated', zones.footer)}],`;
    }

    return `#set page(
  paper: "${page.size.toLowerCase()}",
  flipped: ${page.orientation === 'landscape'},
  margin: (top: ${page.margin.top}, bottom: ${page.margin.bottom}, left: ${page.margin.left}, right: ${page.margin.right}),
  ${headerStr}
  ${footerStr}
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
        const style = comp.style?.italic ? 'italic' : 'normal';
        const color = comp.style?.color || '#000000';
        const font = comp.style?.fontFamily || 'Sarabun';
        const tracking = comp.style?.letterSpacing || '0pt';
        const leading = comp.style?.lineHeight ? `${(comp.style.lineHeight - 1) * 0.8}em` : '0.65em';

        let content = this.resolveBinding(comp.content, context, groupItems);

        if (comp.format && comp.format !== 'text') {
          content = `#fmt_${comp.format.replace('-', '_')}("${content}")`;
        } else {
          content = this.escapeTypst(content);
        }

        if (comp.style?.underline) {
          content = `#underline[${content}]`;
        }

        return `#set align(${align})\n#par(leading: ${leading})[#text(size: ${size}pt, weight: "${weight}", style: "${style}", fill: rgb("${color}"), font: "${font}", tracking: ${tracking})[${content}]]`;
      }

      case 'image': {
        const src = (comp as any).src || '';
        const isVirtual = src.startsWith('asset-');
        const isRemote =
          src.startsWith('http') || src.startsWith('https') || src.startsWith('data:');

        if (!isVirtual && !isRemote && src !== '') {
          return `#rect(width: 100%, height: 100%, fill: gray.lighten(95%), stroke: 0.5pt + gray)[
            #set align(center + horizon)
            #text(size: 6pt, fill: gray.darken(30%))[FILE NOT FOUND]
          ]`;
        }
        if (src === '') {
          return '#rect(width: 100%, height: 100%, fill: gray.lighten(80%))[#set align(center + horizon); #text(size: 6pt, fill: gray.darken(30%))[NO IMAGE]]';
        }
        return `#image("${src}", width: 100%, height: 100%, fit: "${(comp as any).fit || 'contain'}")`;
      }

      case 'table':
        return this.renderTable(comp as any, context);

      case 'line': {
        const thickness = (comp as any).thickness || '1pt';
        const color = (comp as any).color || 'black';
        const lineStyle = (comp as any).style || 'solid';
        let dash = 'none';
        if (lineStyle === 'dashed') dash = '"dashed"';
        if (lineStyle === 'dotted') dash = '"dotted"';

        return `#line(length: 100%, stroke: (paint: rgb("${color}"), thickness: ${thickness}, dash: ${dash}))`;
      }
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
        const style = comp.style?.italic ? 'italic' : 'normal';
        const color = comp.style?.color || '#000000';
        const font = comp.style?.fontFamily || 'Sarabun';
        const format = (comp as any).format || 'Page {{page}} of {{pageTotal}}';

        let display = format
          .replace(/\{\{page\}\}/g, ' #counter(page).display() ')
          .replace(/\{\{pageTotal\}\}/g, ' #counter(page).final().at(0) ');

        if (comp.style?.underline) {
          display = `#underline[#context [${display}]]`;
        } else {
          display = `#context [${display}]`;
        }

        return `#set align(${align})\n#text(size: ${size}pt, weight: "${weight}", style: "${style}", fill: rgb("${color}"), font: "${font}")[${display}]`;
      }
      case 'spacer':
        return `#v(${(comp as any).height || 10}mm)`;

      case 'page-break-indicator':
        return '#pagebreak()';

      case 'columns': {
        const cols = (comp as any).columns || [];
        const gridCols = cols.map((c: any) => c.width || '1fr').join(', ');
        const contents = cols.map((c: any) => {
          const body = (c.components || [])
            .map((child: any) => this.renderComponent(child, context, groupItems))
            .join('\n');
          return `[${body}]`;
        }).join(', ');
        return `#grid(columns: (${gridCols}), gutter: 10pt, ${contents})`;
      }

      case 'repeater': {
        const dataSourceExpr = (comp as any).dataSource || '';
        const path = dataSourceExpr.replace(/\{\{|\}\}/g, '').trim();
        const rawData = this.resolvePath(path, context || this.data);
        const items = Array.isArray(rawData) ? rawData : [];

        return items.map((item, idx) => {
          return (comp as any).children
            .map((child: any) => this.renderComponent(child, item, items))
            .join('\n');
        }).join('\n');
      }

      case 'summary-box': {
        const rows = (comp as any).rows || [];
        const rowBody = rows.map((r: any) => {
          const val = this.resolveBinding(r.value || '', context, groupItems);
          const isTotal = r.style === 'total';
          const isHighlight = r.style === 'highlight';

          let label = r.label;
          let value = val;

          if (isTotal) {
            label = `*${label}*`;
            value = `*${value}*`;
          }

          const fill = isHighlight ? 'fill: yellow.lighten(80%),' : '';

          return `grid.cell(${fill})[${label}], grid.cell(${fill} align: right)[${value}]`;
        }).join(',\n    ');

        return `#rect(width: 100%, inset: 10pt, fill: white, stroke: 0.5pt + gray)[
          #grid(columns: (1fr, 1fr), gutter: 8pt,
            ${rowBody}
          )
        ]`;
      }

      default:
        return `// [${(comp as any).type}] not implemented`;
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
#let add_commas(n) = {
  let s = str(n)
  let result = ""
  let count = 0
  let is_negative = s.starts-with("-")
  let start_idx = if is_negative { 1 } else { 0 }
  
  for i in range(s.len() - 1, start_idx - 1, step: -1) {
    if count > 0 and calc.rem(count, 3) == 0 {
      result = "," + result
    }
    result = s.at(i) + result
    count += 1
  }
  
  if is_negative { "-" + result } else { result }
}

#let fmt_number(v) = {
  let val = if type(v) == "string" { 
    let trimmed = v.trim()
    if trimmed == "" { 0 } else { 
      let f = float(trimmed)
      if f == none { trimmed } else { f }
    }
  } else { v }

  if type(val) == "float" or type(val) == "integer" {
    let s = str(val)
    if s.contains(".") {
      let parts = s.split(".")
      let whole = add_commas(parts.at(0))
      let decimal = parts.at(1)
      if decimal == "0" or decimal == "00" {
        whole
      } else {
        whole + "." + decimal.slice(0, calc.min(2, decimal.len()))
      }
    } else {
      add_commas(s)
    }
  } else { str(v) }
}

#let fmt_currency_thb(v) = {
  let num = if type(v) == "string" { 
    let trimmed = v.trim()
    if trimmed == "" { 0 } else { float(trimmed) }
  } else { v }
  "฿" + fmt_number(num)
}

#let fmt_currency_usd(v) = {
  let num = if type(v) == "string" { 
    let trimmed = v.trim()
    if trimmed == "" { 0 } else { float(trimmed) }
  } else { v }
  "$" + fmt_number(num)
}

#let fmt_date_th(v) = { 
  if type(v) != "string" or v == "" { return str(v) }
  let months = ("มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม")
  if v.len() >= 10 {
    let y = int(v.slice(0, 4))
    let m = int(v.slice(5, 7))
    let d = int(v.slice(8, 10))
    if m >= 1 and m <= 12 {
      return str(d) + " " + months.at(m - 1) + " " + str(y + 543)
    }
  }
  v
}

#let fmt_date_en(v) = { 
  if type(v) != "string" or v == "" { return str(v) }
  let months = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
  if v.len() >= 10 {
    let y = int(v.slice(0, 4))
    let m = int(v.slice(5, 7))
    let d = int(v.slice(8, 10))
    if m >= 1 and m <= 12 {
      return str(d) + " " + months.at(m - 1) + " " + str(y)
    }
  }
  v
}

#let fmt_percent(v) = {
  let num = if type(v) == "string" { 
    let trimmed = v.trim()
    if trimmed == "" { 0 } else { float(trimmed) }
  } else { v }
  fmt_number(num) + "%"
}

#let fmt_boolean(v) = {
  if v == true or v == "true" or v == "1" or v == "yes" { "Yes" }
  else { "No" }
}
\n`;
  }

  private escapeTypst(text: any): string {
    return escapeTypst(String(text ?? ''));
  }
}
