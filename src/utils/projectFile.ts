import type { CanvasObject } from '../types';
import type { CanvasLayer } from './layerMigration';

// Version 2: layers are `type: 'layer'` objects inside `objects` (unified
// tree); the separate `layers` array is no longer written. Version 1 files
// (objects + optional `layers`) and pre-versioned bare arrays are still
// read — the conversion happens at load time via migrateToUnifiedTree.
const FILE_VERSION = 2;

export interface WiretextProjectFile {
  app: 'wiretext';
  version: number;
  savedAt: string;
  objects: CanvasObject[];
  // v1 only: separate layer entities. Never written anymore; carried through
  // parseProjectFile so loadObjects can migrate old files.
  layers?: CanvasLayer[];
}

export interface ParsedProjectFile {
  objects: CanvasObject[];
  layers?: CanvasLayer[];
}

export function createProjectFile(objects: CanvasObject[]): WiretextProjectFile {
  return {
    app: 'wiretext',
    version: FILE_VERSION,
    savedAt: new Date().toISOString(),
    objects,
  };
}

export function stringifyProjectFile(objects: CanvasObject[]): string {
  return JSON.stringify(createProjectFile(objects), null, 2);
}

export function parseProjectFile(text: string): ParsedProjectFile {
  const parsed = JSON.parse(text) as unknown;

  if (Array.isArray(parsed)) {
    return { objects: parsed as CanvasObject[] };
  }

  if (
    parsed
    && typeof parsed === 'object'
    && 'app' in parsed
    && parsed.app === 'wiretext'
    && 'objects' in parsed
    && Array.isArray(parsed.objects)
  ) {
    const layers = 'layers' in parsed && Array.isArray(parsed.layers)
      ? parsed.layers as CanvasLayer[]
      : undefined;
    return { objects: parsed.objects as CanvasObject[], layers };
  }

  throw new Error('Invalid Wiretext project file.');
}

export function getDefaultProjectFilename(date = new Date()): string {
  const stamp = date
    .toISOString()
    .slice(0, 19)
    .replace(/[:T]/g, '-');
  return `wiretext-${stamp}.wiretext`;
}
