import type { LayoutSchema } from '@/types/schema';
import { formatFontFamily } from './placement';

/** Returns the Typst `#set page(...)` block. Margin is always 0mm so that
 *  `#place(dx, dy)` coordinates map 1-to-1 with the designer's mm coordinate
 *  system (page corner = 0,0). The schema margin is visual-only in the designer.
 */
export function generatePageSetup(schema: LayoutSchema, pretty = false): string {
  const { page } = schema;
  const paper = page.size.toLowerCase();
  const flipped = page.orientation === 'landscape';
  if (pretty) {
    return [
      '// --- Page Setup ---',
      '#set page(',
      `  paper: "${paper}",`,
      `  flipped: ${flipped},`,
      '  margin: 0mm,',
      ')',
      '',
    ].join('\n');
  }
  return `#set page(\n  paper: "${paper}",\n  flipped: ${flipped},\n  margin: 0mm,\n)\n\n`;
}

/** Returns the `#set text(...)` block using the first body font. */
export function generateFonts(schema: LayoutSchema, pretty = false): string {
  const font = schema.fonts.find((f) => f.role === 'body') ?? schema.fonts[0];
  if (!font) return '';
  const family = formatFontFamily(font.family);
  if (pretty) {
    return [
      '// --- Document Typography ---',
      '#set text(',
      `  font: ("${family}", "Sarabun", "sans-serif"),`,
      `  size: ${font.size}pt,`,
      '  lang: "th",',
      ')',
      '#set par(leading: 0.75em, justify: false)',
      '',
    ].join('\n');
  }
  return `#set text(font: ("${family}", "Sarabun", "sans-serif"), size: ${font.size}pt, lang: "th")\n#set par(leading: 0.75em, justify: false)\n\n`;
}

/** Import block for bundled packages (codetastic for QR / barcodes). */
export function generateImports(pretty = false): string {
  const line = '#import "@preview/codetastic:0.2.2": qrcode, ean13, ean8';
  return pretty ? `// --- Imports ---\n${line}\n\n` : `${line}\n`;
}

/** @deprecated Use {@link generateImports} — kept for compact output compatibility. */
export const IMPORTS = '#import "@preview/codetastic:0.2.2": qrcode, ean13, ean8\n';

/** Typst helper functions for formatting (number, currency, date, etc.).
 *  These are injected once per document and referenced as `#fmt_*()` calls.
 */
export const FORMAT_HELPERS = `
// --- Formatting Helpers ---
#let add_commas(n) = {
  let s = str(n)
  let result = ""
  let count = 0
  let is_negative = s.starts-with("-")
  let start_idx = if is_negative { 1 } else { 0 }
  for i in range(s.len() - 1, start_idx - 1, step: -1) {
    if count > 0 and calc.rem(count, 3) == 0 { result = "," + result }
    result = s.at(i) + result
    count += 1
  }
  if is_negative { "-" + result } else { result }
}

#let fmt_number(v) = {
  let val = if type(v) == "string" {
    let t = v.trim()
    if t == "" { 0 } else { let f = float(t); if f == none { t } else { f } }
  } else { v }
  if type(val) == "float" or type(val) == "integer" {
    let s = str(val)
    if s.contains(".") {
      let parts = s.split(".")
      let decimal = parts.at(1)
      if decimal == "0" or decimal == "00" { add_commas(parts.at(0)) }
      else { add_commas(parts.at(0)) + "." + decimal.slice(0, calc.min(2, decimal.len())) }
    } else { add_commas(s) }
  } else { str(v) }
}

#let fmt_currency_thb(v) = {
  let n = if type(v) == "string" { let t = v.trim(); if t == "" { 0 } else { float(t) } } else { v }
  "฿" + fmt_number(n)
}

#let fmt_currency_usd(v) = {
  let n = if type(v) == "string" { let t = v.trim(); if t == "" { 0 } else { float(t) } } else { v }
  "$" + fmt_number(n)
}

#let fmt_date_th(v) = {
  if type(v) != "string" or v == "" { return str(v) }
  let months = ("มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม")
  if v.len() >= 10 {
    let y = int(v.slice(0, 4)); let m = int(v.slice(5, 7)); let d = int(v.slice(8, 10))
    if m >= 1 and m <= 12 { return str(d) + " " + months.at(m - 1) + " " + str(y + 543) }
  }
  v
}

#let fmt_date_en(v) = {
  if type(v) != "string" or v == "" { return str(v) }
  let months = ("Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec")
  if v.len() >= 10 {
    let y = int(v.slice(0, 4)); let m = int(v.slice(5, 7)); let d = int(v.slice(8, 10))
    if m >= 1 and m <= 12 { return str(d) + " " + months.at(m - 1) + " " + str(y) }
  }
  v
}

#let fmt_percent(v) = {
  let n = if type(v) == "string" { let t = v.trim(); if t == "" { 0 } else { float(t) } } else { v }
  fmt_number(n) + "%"
}

#let fmt_boolean(v) = {
  if v == true or v == "true" or v == "1" or v == "yes" { "Yes" } else { "No" }
}
`;

/** Same as {@link FORMAT_HELPERS} with an expanded section title for pretty exports. */
export const PRETTY_FORMAT_HELPERS = FORMAT_HELPERS.replace(
  '// --- Formatting Helpers ---',
  '// --- Formatting Helpers (numbers, currency, dates) ---'
);
