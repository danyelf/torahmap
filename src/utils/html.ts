// Small helpers for the places that build HTML as a string.

/**
 * Make a string safe to drop into markup as text or as a quoted attribute.
 *
 * Everything escaped here is written by us rather than typed by a reader, so
 * this guards against an ampersand or an angle bracket in a source name or a
 * description silently breaking the markup around it, not against an attack.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
