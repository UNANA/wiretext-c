import type { CanvasLayer, CanvasObject } from '../types';

const FILE_VERSION = 1;

export interface WiretextProjectFile {
  app: 'wiretext';
  version: number;
  savedAt: string;
  objects: CanvasObject[];
  // Optional: layer hierarchy/order/names. Absent in files saved before
  // layer nesting existed, or by older builds of this feature — see
  // parseProjectFile, which falls back to reconstructing/migrating from the
  // objects in that case.
  layers?: CanvasLayer[];
}

export interface ParsedProjectFile {
  objects: CanvasObject[];
  layers?: CanvasLayer[];
}

export function createProjectFile(objects: CanvasObject[], layers?: CanvasLayer[]): WiretextProjectFile {
  return {
    app: 'wiretext',
    version: FILE_VERSION,
    savedAt: new Date().toISOString(),
    objects,
    ...(layers ? { layers } : {}),
  };
}

export function stringifyProjectFile(objects: CanvasObject[], layers?: CanvasLayer[]): string {
  return JSON.stringify(createProjectFile(objects, layers), null, 2);
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
