const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapes user-provided text for HTML strings. Map popups (`popupContent` of
 * the shared OSMMapViewer) are rendered as HTML, so household and contact data
 * must never be interpolated into them unescaped.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}
