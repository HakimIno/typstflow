import type { ComponentNode, LayoutSchema } from '../../types/schema';

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
    typst += this.renderZone('header');
    typst += this.renderZone('body');
    typst += this.renderZone('footer');

    return typst;
  }

  private generatePageSetup(): string {
    const { page } = this.schema;
    return `#set page(
  paper: "${page.size.toLowerCase()}",
  flipped: ${page.orientation === 'landscape'},
  margin: (top: ${page.margin.top}, bottom: ${page.margin.bottom}, left: ${page.margin.left}, right: ${page.margin.right}),
)\n`;
  }

  private generateFonts(): string {
    const mainFont = this.schema.fonts.find((f) => f.role === 'body') || this.schema.fonts[0];
    if (!mainFont) return '';
    return `#set text(font: "${mainFont.family}", size: ${mainFont.size}pt, lang: "th")\n`;
  }

  private renderZone(key: 'header' | 'body' | 'footer'): string {
    const zone = this.schema.zones[key];
    if (zone.components.length === 0) return '';

    let typst = `\n// Band: ${key.toUpperCase()}\n`;
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

  private renderTable(comp: any): string {
    let t = '#table(\n    columns: (';
    t += `${comp.columns.map((c: any) => (c.width || '1fr').replace('*', 'fr')).join(', ')}),\n`;
    t += '    inset: 7pt, align: horizon, stroke: 0.5pt + gray,\n';

    if (comp.showHeader) {
      t += '    fill: (x, y) => if y == 0 { blue.lighten(92%) },\n';
      t += `    ${comp.columns.map((c: any) => `[*${c.header}*]`).join(', ')},\n`;
    }

    const path = comp.dataSource?.replace(/\{\{(.+?)\}\}/g, '$1').trim();
    const items = this.resolvePath(path, this.data) || [];

    for (const item of items as any[]) {
      t += `    ${comp.columns
        .map((c: any) => {
          const val = this.resolvePath(c.field, item);
          return `[${val !== undefined ? this.escapeTypst(String(val)) : ''}]`;
        })
        .join(', ')},\n`;
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
