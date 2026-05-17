import type { ComponentNode, GroupDefinition, LayoutSchema, Zone } from '@/types/schema';
import { resolveBinding, resolvePath } from './binding';
import { FORMAT_HELPERS, IMPORTS, generateFonts, generatePageSetup } from './preamble';
import { PluginRegistry } from './registry';
import type { ComponentPlugin, RenderContext } from './types';

import { barcodePlugin } from './plugins/barcode';
import { checklistPlugin } from './plugins/checklist';
import { columnsPlugin } from './plugins/columns';
import { imagePlugin } from './plugins/image';
import { linePlugin } from './plugins/line';
import { pageBreakIndicatorPlugin } from './plugins/page-break-indicator';
import { pageNumberPlugin } from './plugins/page-number';
import { qrPlugin } from './plugins/qr';
import { repeaterPlugin } from './plugins/repeater';
import { spacerPlugin } from './plugins/spacer';
import { summaryBoxPlugin } from './plugins/summary-box';
import { tablePlugin } from './plugins/table';
// Built-in plugins
import { textPlugin } from './plugins/text';

/** All built-in component plugins registered by default. */
const BUILT_IN_PLUGINS: ComponentPlugin[] = [
  textPlugin,
  imagePlugin,
  linePlugin,
  spacerPlugin,
  barcodePlugin,
  qrPlugin,
  pageNumberPlugin,
  pageBreakIndicatorPlugin,
  summaryBoxPlugin,
  repeaterPlugin,
  columnsPlugin,
  tablePlugin,
  checklistPlugin,
];

/**
 * Plugin-based Typst source generator.
 *
 * All built-in component types are pre-registered. Pass `customPlugins` to
 * add new types or override any built-in renderer — the last registration wins.
 *
 * @example
 * ```ts
 * // Default usage
 * const src = new TypstGenerator().generate(schema, data);
 *
 * // Override a built-in renderer
 * const myTextPlugin: ComponentPlugin<TextComponent> = {
 *   type: 'text',
 *   render(comp, ctx) { return '// custom text'; },
 * };
 * const src = new TypstGenerator([myTextPlugin]).generate(schema, data);
 * ```
 */
export class TypstGenerator {
  private readonly registry: PluginRegistry;

  constructor(customPlugins: ComponentPlugin[] = []) {
    this.registry = new PluginRegistry();
    for (const p of BUILT_IN_PLUGINS) this.registry.register(p);
    for (const p of customPlugins) this.registry.register(p);
  }

  generate(schema: LayoutSchema, data: Record<string, unknown>): string {
    const parts: string[] = [
      IMPORTS,
      generatePageSetup(schema),
      generateFonts(schema),
      FORMAT_HELPERS,
    ];

    const pageH = paperHeightMm(schema.page.size, schema.page.orientation === 'landscape');
    const headerH = Number.parseFloat(schema.zones.header.minHeight ?? '0');
    const footerH = Number.parseFloat(schema.zones.footer.minHeight ?? '0');

    // Detect if any page body is in flow mode.
    // Flow bodies need Typst-native page bands so that dynamic content (e.g. expanding
    // tables) paginate correctly without overflowing into fixed-position zones.
    const hasFlowBody = schema.pages.some((p) => p.body.layoutMode === 'flow');

    if (hasFlowBody) {
      // Override margins to allocate space for the header/footer bands.
      // The content area becomes: pageH - headerH - footerH per page.
      if (headerH > 0 || footerH > 0) {
        parts.push(
          `#set page(margin: (top: ${headerH}mm, bottom: ${footerH}mm, left: 0mm, right: 0mm))\n`
        );
      }
      // Render header and footer as native Typst page bands (repeat on every page).
      // offsetY = 0: component positions are relative to the band's own top-left.
      if (!schema.zones.header.repeatOnEveryPage && headerH > 0) {
        const hContent = this.renderZoneComponents(
          schema.zones.header,
          data,
          data,
          [],
          0,
          0,
          schema
        );
        parts.push(`#set page(header: [${hContent}])\n`);
      }
      if (!schema.zones.footer.repeatOnEveryPage && footerH > 0) {
        const fContent = this.renderZoneComponents(
          schema.zones.footer,
          data,
          data,
          [],
          0,
          0,
          schema
        );
        parts.push(`#set page(footer: [${fContent}])\n`);
      }
    } else {
      // --- Legacy: Global Repeating Zones (explicit repeatOnEveryPage flag) ---
      const margin = schema.page.margin;
      const topM = Number.parseFloat(margin.top ?? '0');
      const bottomM = Number.parseFloat(margin.bottom ?? '0');

      if (schema.zones.header.repeatOnEveryPage) {
        const headerContent = this.renderZoneComponents(
          schema.zones.header,
          data,
          data,
          [],
          0,
          topM,
          schema
        );
        parts.push(`\n#set page(header: [${headerContent}])\n`);
      }

      if (schema.zones.footer.repeatOnEveryPage) {
        const footerY = pageH - bottomM - footerH;
        const footerContent = this.renderZoneComponents(
          schema.zones.footer,
          data,
          data,
          [],
          0,
          footerY,
          schema
        );
        parts.push(`\n#set page(footer: [${footerContent}])\n`);
      }
    }

    parts.push('\n// --- Report ---\n');

    // bodyY: offset passed to body zone renderer.
    // - Flow body: 0 — Typst margin (top: headerH) already shifts content below the header band.
    // - Absolute body: headerH — manual #place() components need the offset baked in.
    const bodyY = hasFlowBody ? 0 : headerH;
    const footerY = pageH - footerH;
    const headerY = 0;

    if (schema.batchDataSource) {
      const resolvedItems = resolvePath(schema.batchDataSource, data);
      const batchItems = Array.isArray(resolvedItems) ? resolvedItems : [data];

      for (let i = 0; i < batchItems.length; i++) {
        const item = batchItems[i] as Record<string, unknown>;
        if (i > 0) parts.push('\n#pagebreak(weak: true)\n#box()\n');
        parts.push(
          this.renderDocument(schema, item, data, 0, bodyY, headerY, footerY, hasFlowBody)
        );
      }
    } else if (schema.groups && schema.groups.length > 0) {
      const sourcePath = schema.groupDataSource || 'items';
      const resolvedItems = resolvePath(sourcePath, data);
      const items = Array.isArray(resolvedItems)
        ? (resolvedItems as Record<string, unknown>[])
        : [];

      if (
        !hasFlowBody &&
        !schema.zones.header.repeatOnEveryPage &&
        shouldRenderZone(schema.zones.header, 0, 1, 'header')
      ) {
        parts.push('// --- REPORT HEADER ---\n');
        parts.push(
          this.renderZoneComponents(schema.zones.header, data, data, [], 0, headerY, schema)
        );
      }

      parts.push(this.renderGroupLevel(schema, schema.groups, 0, items, data, bodyY));

      if (
        !hasFlowBody &&
        !schema.zones.footer.repeatOnEveryPage &&
        shouldRenderZone(schema.zones.footer, 0, 1, 'footer')
      ) {
        parts.push('// --- REPORT FOOTER ---\n');
        parts.push(
          this.renderZoneComponents(schema.zones.footer, data, data, [], 0, footerY, schema)
        );
      }
    } else {
      parts.push(this.renderDocument(schema, data, data, 0, bodyY, headerY, footerY, hasFlowBody));
    }

    return parts.join('');
  }

  private renderDocument(
    schema: LayoutSchema,
    localData: Record<string, unknown>,
    globalData: Record<string, unknown>,
    offsetX: number,
    bodyOffsetY: number,
    headerOffsetY: number,
    footerOffsetY: number,
    nativeBands = false
  ): string {
    let t = '';
    const totalPages = schema.pages.length;

    for (let i = 0; i < totalPages; i++) {
      const pageDef = schema.pages[i];
      if (i > 0) t += '\n#pagebreak(weak: true)\n#box()\n';

      // Header — skip if using native bands (#set page(header: ...) handles it)
      const h = schema.zones.header;
      if (!nativeBands && !h.repeatOnEveryPage && shouldRenderZone(h, i, totalPages, 'header')) {
        t += `// --- PAGE ${i + 1} HEADER ---\n`;
        t += this.renderZoneComponents(
          h,
          localData,
          globalData,
          [],
          offsetX,
          headerOffsetY,
          schema
        );
      }

      // Body
      t += `// --- PAGE ${i + 1} BODY ---\n`;
      t += this.renderZoneComponents(
        pageDef.body,
        localData,
        globalData,
        [],
        offsetX,
        bodyOffsetY,
        schema
      );

      // Footer — skip if using native bands
      const f = schema.zones.footer;
      if (!nativeBands && !f.repeatOnEveryPage && shouldRenderZone(f, i, totalPages, 'footer')) {
        t += `// --- PAGE ${i + 1} FOOTER ---\n`;
        t += this.renderZoneComponents(
          f,
          localData,
          globalData,
          [],
          offsetX,
          footerOffsetY,
          schema
        );
      }
    }

    return t;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private renderZoneComponents(
    zone: Zone,
    local: Record<string, unknown>,
    global: Record<string, unknown>,
    groupItems: unknown[],
    offsetX: number,
    offsetY: number,
    schema: LayoutSchema
  ): string {
    const registry = this.registry;
    const isFlowZone = zone.layoutMode === 'flow';
    // Default to 0mm gap so Typst output matches the designer (no physical gap between rows).
    const flowGap = zone.flowGap ?? '0mm';

    const renderChild = (
      comp: ComponentNode,
      overrides: Partial<Omit<RenderContext, 'render'>> = {}
    ): string => {
      const ctx: RenderContext = {
        local,
        global,
        groupItems,
        offsetX,
        offsetY,
        schema,
        flowMode: isFlowZone,
        render: renderChild,
        ...overrides,
      };
      return registry.render(comp, ctx);
    };

    if (isFlowZone) {
      // Push flow content below any preceding absolute zones (e.g. header rendered with #place())
      // Without this, flow blocks start at y=0 and overlap the header area.
      const leadingSpace = offsetY > 0 ? `#v(${offsetY}mm)\n` : '';
      const separator = flowGap === '0mm' ? '' : `#v(${flowGap})\n`;
      const content = zone.components
        .map((comp) => renderChild(comp))
        .filter(Boolean)
        .join(separator);
      return leadingSpace + content;
    }

    return zone.components.map((comp) => renderChild(comp)).join('');
  }

  private renderGroupLevel(
    schema: LayoutSchema,
    groups: GroupDefinition[],
    index: number,
    items: Record<string, unknown>[],
    global: Record<string, unknown>,
    bodyY: number
  ): string {
    const group = groups[index];

    if (!group) {
      // Innermost level: detail band
      const parts: string[] = [];
      for (const item of items) {
        parts.push(
          this.renderZoneComponents(schema.pages[0].body, item, global, [], 0, bodyY, schema)
        );
      }
      return parts.join('');
    }

    // Filter
    let filtered = items;
    if (group.filterBy) {
      filtered = items.filter((item) => {
        const resolved = resolveBinding(group.filterBy ?? '', item, global);
        return !['false', '0', ''].includes(resolved.trim().toLowerCase());
      });
    }

    // Group by field
    const groupMap = new Map<string, Record<string, unknown>[]>();
    for (const item of filtered) {
      const keyRaw = resolveBinding(`{{${group.field}}}`, item, global);
      const key = String(keyRaw);
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)?.push(item);
    }

    // Sort
    let keys = Array.from(groupMap.keys());
    if (group.sortBy) {
      keys = keys.sort((a, b) =>
        group.sortBy === 'desc' ? b.localeCompare(a) : a.localeCompare(b)
      );
    }

    const parts: string[] = [];
    for (const key of keys) {
      const groupItems = groupMap.get(key) ?? [];
      const firstItem = groupItems[0] ?? global;

      parts.push(`// GROUP [${group.id}] HEADER\n`);
      parts.push(
        this.renderZoneComponents(group.header, firstItem, global, groupItems, 0, bodyY, schema)
      );
      parts.push(this.renderGroupLevel(schema, groups, index + 1, groupItems, global, bodyY));
      parts.push(`// GROUP [${group.id}] FOOTER\n`);
      parts.push(
        this.renderZoneComponents(group.footer, firstItem, global, groupItems, 0, bodyY, schema)
      );
    }
    return parts.join('');
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function shouldRenderZone(
  zone: Zone,
  pageIndex: number,
  totalPages: number,
  _type: 'header' | 'footer'
): boolean {
  if (zone.repeatOnEveryPage) return true;
  if (zone.showOnFirstPageOnly) return pageIndex === 0;
  if (zone.showOnLastPageOnly) return pageIndex === totalPages - 1;

  // Default behavior if no flags are set:
  // Headers usually show on first page by default if not global.
  // Footers usually show on last page by default if not global?
  // Actually, the user says "Footer page 1 shows in page 2 even if not global".
  // This implies they expect it to be page-specific, but it's a GLOBAL zone.
  // So if it's not set to repeat, it should only show on page 1 (Report Footer).
  return pageIndex === 0;
}

function paperHeightMm(size: string, landscape: boolean): number {
  const dims: Record<string, [number, number]> = {
    a4: [210, 297],
    a5: [148, 210],
    a6: [105, 148],
    letter: [215.9, 279.4],
    legal: [215.9, 355.6],
    b4: [250, 353],
    b5: [176, 250],
  };
  const [w, h] = dims[size.toLowerCase()] ?? [210, 297];
  return landscape ? w : h;
}

// Re-export for external use
export type { ComponentPlugin, RenderContext };
export { PluginRegistry };
export { isVisible, resolveBinding } from './binding';
