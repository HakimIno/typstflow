import type { ComponentNode, LayoutSchema, TableComponent } from '../../types/schema';

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

    // Zones
    typst += '\n// --- Report Base ---\n';
    
    // 1. Header (Global)
    typst += this.renderZone('header', this.schema.zones.header);

    // 2. Pages (Iterate through each page body)
    for (let i = 0; i < this.schema.pages.length; i++) {
      const page = this.schema.pages[i];
      typst += this.renderZone(`body-page-${i + 1}`, page.body);
      
      // Add pagebreak if not the last page
      if (i < this.schema.pages.length - 1) {
        typst += '\n#pagebreak()\n';
      }
    }

    // 3. Footer (Global)
    typst += this.renderZone('footer', this.schema.zones.footer);

    return typst;
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

  private renderZone(label: string, zone: any): string {
    if (!zone || !zone.components || zone.components.length === 0) return '';

    let typst = `\n// Band: ${label.toUpperCase()}\n`;
    // We treat each zone as a block to ensure clipping and containment
    typst += '#block(width: 100%, clip: true)[\n';
    for (const comp of zone.components) {
      typst += `  ${this.renderComponent(comp)}`;
    }
    typst += ']\n';
    return typst;
  }

  private renderComponent(comp: ComponentNode): string {
    const x = comp.x || 0;
    const y = comp.y || 0;
    const w = comp.width || 100;
    const h = comp.height || 20;

    const body = this.getComponentBody(comp);
    return `#place(dx: ${x}mm, dy: ${y}mm)[#block(width: ${w}mm, height: ${h}mm)[${body}]]\n`;
  }

  private getComponentBody(comp: ComponentNode): string {
    switch (comp.type) {
      case 'text': {
        const align = comp.align || 'left';
        const weight = comp.style?.fontWeight === 'bold' ? 'bold' : 'regular';
        const size = comp.style?.fontSize || 10;
        const content = this.resolveBinding(comp.content);
        return `#set align(${align})\n#text(size: ${size}pt, weight: "${weight}")[${this.escapeTypst(content)}]`;
      }

      case 'image': {
        // Resource Sanitization: Check if path is available or a remote URL
        const src = (comp as any).src || '';
        const isRemote =
          src.startsWith('http') || src.startsWith('https') || src.startsWith('data:');
        if (!isRemote && src !== '') {
          // Placeholder for missing local files to prevent crash
          return `#rect(width: 100%, height: 100%, fill: gray.lighten(95%), stroke: 0.5pt + gray)[
            #set align(center + horizon)
            #text(size: 6pt, fill: gray.darken(30%))[FILE NOT FOUND: ${src}]
          ]`;
        }
        return `#image("${src}", width: 100%, height: 100%, fit: "contain")`;
      }

      case 'table':
        return this.renderTable(comp as any);

      case 'line':
        return `#line(length: 100%, stroke: ${(comp as any).thickness || '1pt'} + ${(comp as any).color || 'black'})`;

      case 'barcode':
      case 'qr':
        return this.renderPlaceholder(
          comp.type.toUpperCase(),
          this.resolveBinding((comp as any).value || '')
        );

      default:
        return `// [${comp.type}] not implemented`;
    }
  }

  private renderTable(comp: TableComponent): string {
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
    const items = this.resolvePath(path, this.data) || [];

    for (const item of items as any[]) {
      let currentX = 0;
      for (const col of comp.columns) {
        const val = this.resolvePath(col.field, item);
        const cellVal = val !== undefined ? this.escapeTypst(String(val)) : '';
        const cs = col.colspan || 1;
        const rs = col.rowspan || 1;

        if (cs === 1 && rs === 1) {
          t += `    [${cellVal}],\n`;
        } else {
          t += `    table.cell(x: ${currentX}, y: ${currentY}, colspan: ${cs}, rowspan: ${rs})[${cellVal}],\n`;
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

  private resolveBinding(expr: string): string {
    if (!expr) return '';
    return expr.replace(/\{\{(.+?)\}\}/g, (_, path) => {
      const val = this.resolvePath(path.trim(), this.data);
      return val !== undefined ? String(val) : `{{${path}}}`;
    });
  }

  private resolvePath(path: string, obj: any) {
    if (!path) return undefined;
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
  }

  private escapeTypst(str: string): string {
    return str.replace(/([#\*_])/g, '\\$1');
  }
}
