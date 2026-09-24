// Remembers the project file the desktop app last saved or opened so it can
// be reopened on the next launch (Issue #17). Storage can be unavailable
// (private mode, quota), so every access is best-effort.
const LAST_PROJECT_PATH_KEY = 'wiretext:lastProjectPath';

export function getLastProjectPath(storage: Pick<Storage, 'getItem'> = localStorage): string | null {
  try {
    return storage.getItem(LAST_PROJECT_PATH_KEY) || null;
  } catch {
    return null;
  }
}

export function setLastProjectPath(
  path: string | null,
  storage: Pick<Storage, 'setItem' | 'removeItem'> = localStorage,
): void {
  try {
    if (path) storage.setItem(LAST_PROJECT_PATH_KEY, path);
    else storage.removeItem(LAST_PROJECT_PATH_KEY);
  } catch {
    // Not remembering the path only costs the reopen-on-launch convenience.
  }
}
