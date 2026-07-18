import { describe, expect, it } from 'vitest';
import defaultCapabilities from '../../src-tauri/capabilities/default.json';

// Guards against a real bug: `fs:default` (tauri-plugin-fs) only grants
// access to app-specific directories (AppConfig/AppData/AppLocalData/...);
// it does NOT include the `write_text_file` command used to save a project
// to a path the user picked via the save dialog. Without the explicit
// `fs:allow-write-text-file` permission below, every "Save Project" click in
// the Tauri build fails with a permission-denied error that the app's
// generic catch block quietly turns into a "Could not save" toast.
//
// If the frontend ever starts calling another @tauri-apps/plugin-* command,
// add its required permission identifier to REQUIRED_PERMISSIONS below.
const REQUIRED_PERMISSIONS = [
  'fs:allow-write-text-file', // writeTextFile() in src/App.tsx (handleSaveProject)
  'dialog:default', // save() in src/App.tsx (handleSaveProject) — allow-save is in dialog:default
];

describe('Tauri default capability grants what the frontend actually uses', () => {
  it('grants every permission the frontend relies on', () => {
    for (const permission of REQUIRED_PERMISSIONS) {
      expect(defaultCapabilities.permissions).toContain(permission);
    }
  });
});
