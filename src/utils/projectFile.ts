import type { CanvasObject } from '../types';

const FILE_VERSION = 1;

export interface WiretextProjectFile {
  app: 'wiretext';
  version: number;
  savedAt: string;
  objects: CanvasObject[];
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

export function parseProjectFile(text: string): CanvasObject[] {
  const parsed = JSON.parse(text) as unknown;

  if (Array.isArray(parsed)) {
    return parsed as CanvasObject[];
  }

  if (
    parsed
    && typeof parsed === 'object'
    && 'app' in parsed
    && parsed.app === 'wiretext'
    && 'objects' in parsed
    && Array.isArray(parsed.objects)
  ) {
    return parsed.objects as CanvasObject[];
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
