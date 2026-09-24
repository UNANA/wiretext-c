import { describe, expect, it } from 'vitest';
import type { CanvasObject } from '../types';
import { createLayerObject } from './layerMigration';
import { EXPORT_WRAPPER_LAYER_ID, extractSubtreeForExport, getSubtreeExportFilename } from './subtreeExport';

function makeObject(overrides: Partial<CanvasObject> & { id: string }): CanvasObject {
  return {
    type: 'box',
    position: { col: 0, row: 0 },
    width: 4,
    height: 2,
    zIndex: 0,
    ...overrides,
  };
}

// layer-1
//   box-a
//     box-b
//   line (connector box-a -> box-c)
// box-c (root)
const objects: CanvasObject[] = [
  createLayerObject('layer-1', 'Header', { zIndex: 0 }),
  makeObject({ id: 'box-a', parentId: 'layer-1', zIndex: 3, label: 'Card' }),
  makeObject({ id: 'box-b', parentId: 'box-a', zIndex: 0 }),
  makeObject({
    id: 'line',
    type: 'line',
    isConnector: true,
    parentId: 'layer-1',
    zIndex: 4,
    startBinding: { objectId: 'box-a', handle: 'e' },
    endBinding: { objectId: 'box-c', handle: 'w' },
  } as Partial<CanvasObject> & { id: string }),
  makeObject({ id: 'box-c', zIndex: 1 }),
];

describe('extractSubtreeForExport', () => {
  it('exports a layer with all descendants, detached to the root', () => {
    const result = extractSubtreeForExport(objects, 'layer-1');
    expect(result.map(obj => obj.id)).toEqual(['layer-1', 'box-a', 'box-b', 'line']);
    expect(result[0].parentId).toBeUndefined();
  });

  it('drops connector bindings that point outside the subtree', () => {
    const line = extractSubtreeForExport(objects, 'layer-1').find(obj => obj.id === 'line')!;
    expect(line.startBinding?.objectId).toBe('box-a');
    expect(line.endBinding).toBeUndefined();
  });

  it('wraps a non-layer root in a layer named after it', () => {
    const result = extractSubtreeForExport(objects, 'box-a');
    expect(result.map(obj => obj.id)).toEqual([EXPORT_WRAPPER_LAYER_ID, 'box-a', 'box-b']);
    expect(result[0]).toMatchObject({ type: 'layer', label: 'Card' });
    expect(result[1]).toMatchObject({ parentId: EXPORT_WRAPPER_LAYER_ID, zIndex: 0 });
    expect(result[2].parentId).toBe('box-a');
  });

  it('returns nothing for an unknown id', () => {
    expect(extractSubtreeForExport(objects, 'missing')).toEqual([]);
  });
});

describe('getSubtreeExportFilename', () => {
  it('uses the node title with unsafe characters replaced', () => {
    expect(getSubtreeExportFilename(createLayerObject('l', 'Nav / Header'))).toBe('Nav-Header.wiretext');
    expect(getSubtreeExportFilename(makeObject({ id: 'b', label: 'Card' }))).toBe('Card.wiretext');
  });
});
