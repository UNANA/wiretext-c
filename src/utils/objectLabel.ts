import type { CanvasObject } from '../types';

/**
 * Returns the first line of a (possibly multi-line) string. Annotations and
 * text content may contain embedded newlines (issue #12), but single-line
 * display contexts — the layers panel row, list titles — only ever want the
 * first line. Legacy single-line values pass through unchanged.
 */
export function getFirstLine(text: string | undefined): string {
  if (!text) return '';
  const newlineIndex = text.indexOf('\n');
  return newlineIndex === -1 ? text : text.slice(0, newlineIndex);
}

/**
 * Short, single-line display title for an object row (layers panel, etc).
 * Prefers the user-supplied annotation/label, falling back to type-specific
 * defaults. Multi-line annotations/content are collapsed to their first
 * line so the title never breaks a single-line layout.
 */
export function getObjectTitle(obj: CanvasObject): string {
  if (obj.type === 'line' && obj.isConnector) return getFirstLine(obj.annotation) || obj.label || 'connector';
  if (obj.type === 'component') return getFirstLine(obj.annotation) || obj.label || obj.componentType || 'component';
  if (obj.type === 'text') return getFirstLine(obj.content) || 'text';
  return getFirstLine(obj.annotation) || obj.label || obj.type;
}
