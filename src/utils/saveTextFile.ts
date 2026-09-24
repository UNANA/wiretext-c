import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

/**
 * Saves `contents` as a Wiretext file: through the save dialog in the
 * desktop app, as a download in the browser. Resolves to the saved path
 * (or the download name), or null when the user cancels the dialog.
 */
export async function saveWiretextFile(contents: string, defaultFilename: string): Promise<string | null> {
  if ('__TAURI_INTERNALS__' in window) {
    const path = await save({
      defaultPath: defaultFilename,
      filters: [{ name: 'Wiretext project', extensions: ['wiretext'] }],
    });
    if (!path) return null;
    await writeTextFile(path, contents);
    return path;
  }

  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = defaultFilename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return defaultFilename;
}
