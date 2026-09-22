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
//
// The fs commands carry a `$HOME/**` scope so the project file remembered
// from the previous launch can be reopened and overwritten (Issue #17);
// dialog-picked paths are only granted for the running session.
const REQUIRED_PERMISSIONS = [
  'fs:allow-write-text-file', // writeTextFile() in src/App.tsx (handleSaveProject)
  'fs:allow-read-text-file', // readTextFile() in src/App.tsx (openProjectPath)
  'dialog:default', // save()/open() in src/App.tsx — allow-save/allow-open are in dialog:default
];

type CapabilityPermission = string | { identifier: string; allow?: Array<{ path: string }> };

const permissions = defaultCapabilities.permissions as CapabilityPermission[];
const identifiers = permissions.map(permission => (
  typeof permission === 'string' ? permission : permission.identifier
));

describe('Tauri default capability grants what the frontend actually uses', () => {
  it('grants every permission the frontend relies on', () => {
    for (const permission of REQUIRED_PERMISSIONS) {
      expect(identifiers).toContain(permission);
    }
  });

  it('lets the remembered project file be reopened and overwritten after a restart', () => {
    for (const identifier of ['fs:allow-read-text-file', 'fs:allow-write-text-file']) {
      const permission = permissions.find(entry => typeof entry !== 'string' && entry.identifier === identifier);
      expect(typeof permission === 'object' && permission.allow).toContainEqual({ path: '$HOME/**' });
    }
  });
});
