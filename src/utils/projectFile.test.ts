import { describe, expect, it } from 'vitest';
import type { CanvasObject } from '../types';
import { parseProjectFile, stringifyProjectFile } from './projectFile';

const objects = [
  { id: 'obj-1', type: 'box', position: { col: 0, row: 0 }, width: 4, height: 2, zIndex: 0 },
  { id: 'obj-2', type: 'box', position: { col: 2, row: 2 }, width: 4, height: 2, zIndex: 1, parentId: 'obj-1' },
] as unknown as CanvasObject[];

describe('project file object hierarchy persistence', () => {
  it('round-trips object parentId through stringify/parse', () => {
    const parsed = parseProjectFile(stringifyProjectFile(objects));

    expect(parsed.objects.find(obj => obj.id === 'obj-2')?.parentId).toBe('obj-1');
    expect(parsed.objects.find(obj => obj.id === 'obj-1')?.parentId).toBeUndefined();
  });

  it('parses a legacy bare-array file whose objects have no parentId', () => {
    const legacy = objects.map(({ parentId: _parentId, ...rest }) => rest);
    const parsed = parseProjectFile(JSON.stringify(legacy));

    expect(parsed.objects).toHaveLength(2);
    expect(parsed.objects.every(obj => obj.parentId === undefined)).toBe(true);
    expect(parsed.layers).toBeUndefined();
  });
});
