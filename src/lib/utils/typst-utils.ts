/**
 * Typst String Escaping Utility
 * Handles sanitization of user-provided content to prevent Typst syntax injection.
 */

/**
 * Escapes characters that have special meaning in Typst markup.
 *
 * Active characters in Typst:
 * # - Starts a command
 * \ - Escape character
 * * - Bold markup
 * _ - Italic/Subscript markup
 * [ ] - Content blocks
 * ~ - Non-breaking space
 * @ - Labels/Citations
 * $ - Math mode
 * < > - Label definitions/Citations
 * ` - Raw blocks
 * " - String boundaries (in commands)
 */
export function escapeTypst(str: string | null | undefined): string {
  if (str === null || str === undefined) return '';
  const input = String(str);

  // Note: We MUST escape the backslash FIRST, otherwise we'll escape the backslashes
  // we add for other characters later.
  return input
    .replace(/\\/g, '\\\\') // Backslash \
    .replace(/#/g, '\\#') // Commands #
    .replace(/\*/g, '\\*') // Bold *
    .replace(/_/g, '\\_') // Italic _
    .replace(/\[/g, '\\[') // Left bracket [
    .replace(/\]/g, '\\]') // Right bracket ]
    .replace(/~/g, '\\~') // Non-breaking space ~
    .replace(/@/g, '\\@') // Citations @
    .replace(/\$/g, '\\$') // Math $
    .replace(/</g, '\\<') // Less than <
    .replace(/>/g, '\\>') // Greater than >
    .replace(/"/g, '\\"') // Double quote "
    .replace(/`/g, '\\`'); // Backticks `
}

/**
 * Validates if a string is a safe binding path (only alphanumeric and dots)
 */
export function isValidBindingPath(path: string): boolean {
  return /^[a-zA-Z0-9_\.]+$/.test(path);
}
