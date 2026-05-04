import type { ComponentNode, GroupDefinition, LayoutSchema, Zone } from '@/types/schema';
import { resolveBinding } from './binding';
import { FORMAT_HELPERS, IMPORTS, generateFonts, generatePageSetup } from './preamble';
import { PluginRegistry } from './registry';
import type { ComponentPlugin, RenderContext } from './types';

import { barcodePlugin } from './plugins/barcode';
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
      '\n// --- Report ---\n',
    ];

    // Zone Y origins: stacked from page corner, matching the designer flex-col layout.
    const headerH = Number.parseFloat(schema.zones.header.minHeight ?? '0');
    const footerH = Number.parseFloat(schema.zones.footer.minHeight ?? '0');
    const pageH = paperHeightMm(schema.page.size, schema.page.orientation === 'landscape');

    const headerY = 0;
    const bodyY = headerH;
    const footerY = pageH - footerH;

    if (schema.groups && schema.groups.length > 0) {
      // Grouped rendering
      const items = Array.isArray((data as Record<string, unknown>).items)
        ? ((data as Record<string, unknown>).items as Record<string, unknown>[])
        : [];
      parts.push(this.renderGroupLevel(schema, schema.groups, 0, items, data, bodyY));
    } else {
      // Page-by-page rendering
      const totalPages = schema.pages.length;
      for (let i = 0; i < totalPages; i++) {
        if (i > 0) parts.push('\n#pagebreak(weak: true)\n');
        const pageDef = schema.pages[i];

        // Header
        const h = schema.zones.header;
        if (shouldRenderZone(h, i, totalPages)) {
          parts.push(`// --- PAGE ${i + 1} HEADER ---\n`);
          parts.push(this.renderZoneComponents(h, data, data, [], 0, headerY, schema));
        }

        // Body
        parts.push(`// --- PAGE ${i + 1} BODY ---\n`);
        parts.push(this.renderZoneComponents(pageDef.body, data, data, [], 0, bodyY, schema));

        // Footer
        const f = schema.zones.footer;
        if (shouldRenderZone(f, i, totalPages)) {
          parts.push(`// --- PAGE ${i + 1} FOOTER ---\n`);
          parts.push(this.renderZoneComponents(f, data, data, [], 0, footerY, schema));
        }
      }
    }

    return parts.join('');
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
        render: renderChild,
        ...overrides,
      };
      return registry.render(comp, ctx);
    };

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

function shouldRenderZone(zone: Zone, pageIndex: number, totalPages: number): boolean {
  if (zone.repeatOnEveryPage) return true;
  if (zone.showOnFirstPageOnly) return pageIndex === 0;
  if (zone.showOnLastPageOnly) return pageIndex === totalPages - 1;
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
