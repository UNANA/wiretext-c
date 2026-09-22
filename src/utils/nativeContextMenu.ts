// Text fields keep the native context menu (copy / paste / spell check).
// Everywhere else the webview's default menu — typically just "Reload",
// which silently discards unsaved work — is suppressed (Issue #16).
export function allowsNativeContextMenu(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== 'function') return false;
  return (target as Element).closest('input, textarea, [contenteditable="true"]') !== null;
}
