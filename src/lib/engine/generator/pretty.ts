import type { ComponentNode, LayoutSchema } from '@/types/schema';

/** Document banner shown at the top of pretty exports. */
export function generateDocumentBanner(schema: LayoutSchema): string {
  const title = schema.metadata?.title || schema.name || 'Untitled Report';
  const { page } = schema;
  const font = schema.fonts.find((f) => f.role === 'body') ?? schema.fonts[0];
  const fontLabel = font ? `${font.family} ${font.size}pt` : 'default';

  return [
    '// ===========================================================================',
    `//  ${title}`,
    `//  Exported from TypstFlow · ${schema.id} v${schema.version}`,
    `//  Paper: ${page.size} ${page.orientation} · Font: ${fontLabel}`,
    '//',
    '//  Reuse this file:',
    '//    1. Values are pre-formatted from preview data (snapshot export)',
    '//    2. Edit layout blocks below, then: typst compile main.typ main.pdf',
    '// ===========================================================================',
    '',
  ].join('\n');
}

/** One-line label placed above each component in pretty mode. */
export function formatComponentComment(comp: ComponentNode): string {
  const label = comp.name?.trim() || comp.id;
  const hint = componentContentHint(comp);
  return hint
    ? `// ── ${comp.type} · ${label} · ${hint} ──`
    : `// ── ${comp.type} · ${label} ──`;
}

function componentContentHint(comp: ComponentNode): string | undefined {
  if (comp.type === 'text' && comp.content) {
    const raw = comp.content.replace(/\s+/g, ' ').trim();
    if (!raw) return undefined;
    const preview = raw.length > 48 ? `${raw.slice(0, 45)}…` : raw;
    return preview;
  }
  if (comp.type === 'table' && comp.dataSource) {
    return comp.dataSource;
  }
  if (comp.type === 'image' && comp.src) {
    return comp.src;
  }
  return undefined;
}

/** Indent every non-empty line. */
export function indentLines(body: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return body
    .trimEnd()
    .split('\n')
    .map((line) => (line.trim() === '' ? '' : pad + line))
    .join('\n');
}

/** Format `#set name(k: v, …)` with one argument per line when pretty. */
export function formatSetCall(name: string, args: string[], pretty: boolean): string {
  if (!pretty || args.length <= 2) {
    return `#set ${name}(${args.join(', ')})\n`;
  }
  const inner = args.map((arg) => `  ${arg},`).join('\n');
  return `#set ${name}(\n${inner}\n)\n`;
}

/** Collapse excessive blank lines and ensure file ends with a single newline. */
export function finalizePrettyOutput(source: string): string {
  return `${source.replace(/\n{3,}/g, '\n\n').replace(/\s+$/g, '')}\n`;
}
