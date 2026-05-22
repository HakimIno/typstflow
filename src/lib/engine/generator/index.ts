import type { ComponentNode, GroupDefinition, LayoutSchema, Zone } from '@/types/schema';
import { resolveBinding, resolvePath } from './binding';
import type { GenerateOptions } from './options';
import {
  FORMAT_HELPERS,
  generateFonts,
  generateImports,
  generatePageSetup,
} from './preamble';
import { finalizePrettyOutput, formatComponentComment, generateDocumentBanner } from './pretty';
import {
  schemaNeedsCodetasticImports,
  schemaNeedsFormatHelpers,
} from './schema-analysis';
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
import { rectanglePlugin } from './plugins/rectangle';
import { repeaterPlugin } from './plugins/repeater';
import { signaturePlugin } from './plugins/signature';
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
  rectanglePlugin,
  signaturePlugin,
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

  generate(schema: LayoutSchema, data: Record<string, unknown>, options: GenerateOptions = {}): string {
    const pretty = options.pretty ?? false;
    const pageIndices = options.pageIndices;
    const skipEmptyPages = options.skipEmptyPages ?? pretty;
    const parts: string[] = [];

    if (pretty) {
      parts.push(generateDocumentBanner(schema));
    }

    if (schemaNeedsCodetasticImports(schema)) {
      parts.push(generateImports(pretty));
    }

    parts.push(generatePageSetup(schema, pretty), generateFonts(schema, pretty));

    if (!pretty && schemaNeedsFormatHelpers(schema)) {
      parts.push(FORMAT_HELPERS);
    }

    const pageH = paperHeightMm(schema.page.size, schema.page.orientation === 'landscape');
    const headerH = Number.parseFloat(schema.zones.header.minHeight ?? '0');
    const footerH = Number.parseFloat(schema.zones.footer.minHeight ?? '0');

    // Detect if any page body is in flow mode.
    // Flow bodies need Typst-native page bands so that dynamic content (e.g. expanding
    // tables) paginate correctly without overflowing into fixed-position zones.
    const hasFlowBody = schema.pages.some((p) => p.body.layoutMode === 'flow');

    if (hasFlowBody) {
      // Top margin reserves space for the static header band on flow documents.
      // Bottom margin only when footer uses native repeating page bands — static
      // footers flow after body content and must not leave empty space on every page.
      const topMargin = headerH > 0 ? headerH : 0;
      const bottomMargin =
        schema.zones.footer.repeatOnEveryPage && footerH > 0 ? footerH : 0;
      if (topMargin > 0 || bottomMargin > 0) {
        parts.push(
          `#set page(margin: (top: ${topMargin}mm, bottom: ${bottomMargin}mm, left: 0mm, right: 0mm))\n`
        );
      }
      // Render header and footer as native Typst page bands (repeat on every page).
      // offsetY = 0: component positions are relative to the band's own top-left.
      if (schema.zones.header.repeatOnEveryPage && headerH > 0) {
        const hContent = this.renderZoneComponents(
          schema.zones.header,
          data,
          data,
          [],
          0,
          0,
          schema,
          pretty
        );
        parts.push(`#set page(header: [${hContent}])\n`);
      }
      if (schema.zones.footer.repeatOnEveryPage && footerH > 0) {
        const fContent = this.renderZoneComponents(
          schema.zones.footer,
          data,
          data,
          [],
          0,
          0,
          schema,
          pretty
        );
        parts.push(`#set page(footer: [${fContent}])\n`);
      }
    } else {
      // --- Legacy: Global Repeating Zones (explicit repeatOnEveryPage flag) ---
      if (schema.zones.header.repeatOnEveryPage) {
        const headerContent = this.renderZoneComponents(
          schema.zones.header,
          data,
          data,
          [],
          0,
          0,
          schema,
          pretty
        );
        parts.push(`\n#set page(header: [${headerContent}])\n`);
      }

      if (schema.zones.footer.repeatOnEveryPage) {
        const footerY = pageH - footerH;
        const footerContent = this.renderZoneComponents(
          schema.zones.footer,
          data,
          data,
          [],
          0,
          footerY,
          schema,
          pretty
        );
        parts.push(`\n#set page(footer: [${footerContent}])\n`);
      }
    }

    parts.push(pretty ? '\n// --- Report Content ---\n\n' : '\n// --- Report ---\n');

    // bodyY: offset passed to body zone renderer.
    // - Flow body: 0 — Typst margin (top: headerH) already shifts content below the header band.
    // - Absolute body: headerH — manual #place() components need the offset baked in.
    const bodyY = hasFlowBody ? 0 : headerH;
    // In Flow Mode, non-repeating (static) header and footer are normal page content,
    // which gets automatically shifted down by the top margin (headerH).
    // We subtract headerH to place them at their correct absolute coordinates.
    const headerY = hasFlowBody ? -headerH : 0;
    const footerY = hasFlowBody ? pageH - headerH - footerH : pageH - footerH;

    if (schema.batchDataSource) {
      const resolvedItems = resolvePath(schema.batchDataSource, data);
      const batchItems = Array.isArray(resolvedItems) ? resolvedItems : [data];

      for (let i = 0; i < batchItems.length; i++) {
        const item = batchItems[i] as Record<string, unknown>;
        if (i > 0) parts.push('\n#pagebreak(weak: true)\n#box()\n');
        parts.push(
          this.renderDocument(
            schema,
            item,
            data,
            0,
            bodyY,
            headerY,
            footerY,
            hasFlowBody,
            pretty,
            pageIndices,
            skipEmptyPages
          )
        );
      }
    } else if (schema.groups && schema.groups.length > 0) {
      const sourcePath = schema.groupDataSource || 'items';
      const resolvedItems = resolvePath(sourcePath, data);
      const items = Array.isArray(resolvedItems)
        ? (resolvedItems as Record<string, unknown>[])
        : [];

      if (
        !zoneUsesNativePageBand(schema.zones.header, hasFlowBody, headerH) &&
        shouldRenderZone(schema.zones.header, 0, 1, 'header')
      ) {
        parts.push('// --- REPORT HEADER ---\n');
        parts.push(
          this.renderZoneComponents(schema.zones.header, data, data, [], 0, headerY, schema, pretty)
        );
      }

      parts.push(this.renderGroupLevel(schema, schema.groups, 0, items, data, bodyY, pretty));

      if (
        !zoneUsesNativePageBand(schema.zones.footer, hasFlowBody, footerH) &&
        shouldRenderZone(schema.zones.footer, 0, 1, 'footer')
      ) {
        parts.push('// --- REPORT FOOTER ---\n');
        parts.push(
          this.renderZoneComponents(schema.zones.footer, data, data, [], 0, footerY, schema, pretty)
        );
      }
    } else {
      parts.push(
        this.renderDocument(
          schema,
          data,
          data,
          0,
          bodyY,
          headerY,
          footerY,
          hasFlowBody,
          pretty,
          pageIndices,
          skipEmptyPages
        )
      );
    }

    const raw = parts.join('');
    return pretty ? finalizePrettyOutput(raw) : raw;
  }

  private renderDocument(
    schema: LayoutSchema,
    localData: Record<string, unknown>,
    globalData: Record<string, unknown>,
    offsetX: number,
    bodyOffsetY: number,
    headerOffsetY: number,
    footerOffsetY: number,
    nativeBands = false,
    pretty = false,
    pageIndices?: number[],
    skipEmptyPages = false
  ): string {
    let t = '';
    const totalPages = schema.pages.length;
    const includePage = (i: number) => !pageIndices || pageIndices.includes(i);
    let firstEmitted = true;

    for (let i = 0; i < totalPages; i++) {
      if (!includePage(i)) continue;

      const pageDef = schema.pages[i];
      let pageOutput = '';

      const h = schema.zones.header;
      if (
        !zoneUsesNativePageBand(h, nativeBands, Number.parseFloat(h.minHeight ?? '0')) &&
        shouldRenderZone(h, i, totalPages, 'header')
      ) {
        const headerContent = this.renderZoneComponents(
          h,
          localData,
          globalData,
          [],
          offsetX,
          headerOffsetY,
          schema,
          pretty
        );
        if (headerContent.trim()) {
          if (pretty) pageOutput += `\n// --- Page ${i + 1} · Header ---\n\n`;
          else pageOutput += `// --- PAGE ${i + 1} HEADER ---\n`;
          pageOutput += headerContent;
          if (pretty) pageOutput += '\n';
        }
      }

      const bodyContent = this.renderZoneComponents(
        pageDef.body,
        localData,
        globalData,
        [],
        offsetX,
        bodyOffsetY,
        schema,
        pretty
      );
      if (bodyContent.trim()) {
        if (pretty) pageOutput += `\n// --- Page ${i + 1} · Body ---\n\n`;
        else pageOutput += `// --- PAGE ${i + 1} BODY ---\n`;
        pageOutput += bodyContent;
      }

      const f = schema.zones.footer;
      if (
        !zoneUsesNativePageBand(f, nativeBands, Number.parseFloat(f.minHeight ?? '0')) &&
        shouldRenderZone(f, i, totalPages, 'footer')
      ) {
        const footerContent = this.renderZoneComponents(
          f,
          localData,
          globalData,
          [],
          offsetX,
          footerOffsetY,
          schema,
          pretty
        );
        if (footerContent.trim()) {
          if (pretty) pageOutput += `\n// --- Page ${i + 1} · Footer ---\n\n`;
          else pageOutput += `// --- PAGE ${i + 1} FOOTER ---\n`;
          pageOutput += footerContent;
          if (pretty) pageOutput += '\n';
        }
      }

      if (!pageOutput.trim()) {
        if (skipEmptyPages) continue;
        if (!firstEmitted) {
          t += pretty ? '\n#pagebreak(weak: true)\n#box()\n\n' : '\n#pagebreak(weak: true)\n#box()\n';
        }
        firstEmitted = false;
        t += pretty ? `\n// --- Page ${i + 1} · Body ---\n\n` : `// --- PAGE ${i + 1} BODY ---\n`;
        continue;
      }

      if (!firstEmitted) {
        t += pretty ? '\n#pagebreak(weak: true)\n#box()\n\n' : '\n#pagebreak(weak: true)\n#box()\n';
      }
      firstEmitted = false;
      t += pageOutput;
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
    schema: LayoutSchema,
    pretty = false
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
        pretty,
        render: renderChild,
        ...overrides,
      };
      return registry.render(comp, ctx);
    };

    const renderOne = (comp: ComponentNode): string => {
      const output = renderChild(comp);
      if (!output) return '';
      if (!pretty) return output;
      return `${formatComponentComment(comp)}\n${output}`;
    };

    if (isFlowZone) {
      // Push flow content below any preceding absolute zones (e.g. header rendered with #place())
      // Without this, flow blocks start at y=0 and overlap the header area.
      const leadingSpace = offsetY > 0 ? `#v(${offsetY}mm)\n` : '';
      const separator = flowGap === '0mm' ? (pretty ? '\n\n' : '') : `#v(${flowGap})\n`;
      const content = zone.components
        .map((comp) => renderOne(comp))
        .filter(Boolean)
        .join(separator);
      return leadingSpace + content;
    }

    const separator = pretty ? '\n\n' : '';
    return zone.components.map((comp) => renderOne(comp)).filter(Boolean).join(separator);
  }

  private renderGroupLevel(
    schema: LayoutSchema,
    groups: GroupDefinition[],
    index: number,
    items: Record<string, unknown>[],
    global: Record<string, unknown>,
    bodyY: number,
    pretty = false
  ): string {
    const group = groups[index];

    if (!group) {
      // Innermost level: detail band
      const parts: string[] = [];
      for (const item of items) {
        parts.push(
          this.renderZoneComponents(schema.pages[0].body, item, global, [], 0, bodyY, schema, pretty)
        );
      }
      return parts.join(pretty ? '\n\n' : '');
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

      parts.push(
        pretty
          ? `\n// --- Group · ${group.name || group.id} · ${key} · Header ---\n\n`
          : `// GROUP [${group.id}] HEADER\n`
      );
      parts.push(
        this.renderZoneComponents(group.header, firstItem, global, groupItems, 0, bodyY, schema, pretty)
      );
      parts.push(this.renderGroupLevel(schema, groups, index + 1, groupItems, global, bodyY, pretty));
      parts.push(
        pretty
          ? `\n// --- Group · ${group.name || group.id} · ${key} · Footer ---\n\n`
          : `// GROUP [${group.id}] FOOTER\n`
      );
      parts.push(
        this.renderZoneComponents(group.footer, firstItem, global, groupItems, 0, bodyY, schema, pretty)
      );
    }
    return parts.join('');
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function zoneUsesNativePageBand(
  zone: Zone,
  nativeBands: boolean,
  bandHeightMm: number
): boolean {
  if (!zone.repeatOnEveryPage) return false;
  if (nativeBands) return bandHeightMm > 0;
  return true;
}

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
export type { GenerateOptions } from './options';
export { PluginRegistry };
export { isVisible, resolveBinding } from './binding';
