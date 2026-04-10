/**
 * Parses Typst numeric units (e.g., "15mm", "10pt", "1cm") into a number in millimeters.
 * Returns 0 if invalid or 10 if undefined.
 */
export function parseTypstUnit(value: string | undefined): number {
  if (!value) return 0;
  
  const match = value.match(/^([\d.]+)(mm|pt|cm|in)?$/);
  if (!match) return 0;
  
  const num = Number.parseFloat(match[1]);
  const unit = match[2] || 'pt'; // Typst default is pt if no unit
  
  switch (unit) {
    case 'mm': return num;
    case 'cm': return num * 10;
    case 'in': return num * 25.4;
    case 'pt': return num * 0.352778; // 1pt = 1/72 inch
    default: return num;
  }
}
