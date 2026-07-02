/** CSS font stack used by designer previews — mirrors Typst body font fallbacks. */
export function buildPreviewFontStack(family?: string): string {
  const primary = family?.trim() || 'Sarabun';
  return `${primary}, "Geist", "Inter", "Sarabun-Local", "Noto Sans Thai", sans-serif`;
}
