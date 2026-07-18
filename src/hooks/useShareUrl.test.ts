import { describe, expect, it, vi } from 'vitest';
import { compressToEncodedURIComponent } from 'lz-string';
import type { CanvasObject } from '../types';
import type { CanvasLayer } from '../utils/layerMigration';
import { decodeObjects, encodeObjects } from './useShareUrl';

// encodeObjects reads window.location; the default vitest environment is
// plain Node (no window), so stub just enough of it here.
vi.stubGlobal('window', { location: { origin: 'https://example.test', pathname: '/' } });

// Unified-tree payload: layers travel as type:'layer' nodes inside objects.
const objects = [
  { id: 'layer-1', type: 'layer', position: { col: 0, row: 0 }, width: 0, height: 0, zIndex: 0, label: 'Layer 1' },
  { id: 'obj-1', type: 'box', position: { col: 0, row: 0 }, width: 4, height: 2, zIndex: 0, parentId: 'layer-1' },
] as unknown as CanvasObject[];

describe('encodeObjects / decodeObjects round trip', () => {
  it('round-trips the unified objects tree (layer nodes included) through the URL hash', () => {
    const url = encodeObjects(objects);
    const hash = url.slice(url.indexOf('#'));

    const decoded = decodeObjects(hash);

    expect(decoded?.objects).toEqual(objects);
    expect(decoded?.layers).toBeUndefined();
  });

  it('decodes an old-format share link (bare compressed array, no layers) without breaking', () => {
    const legacy = [
      { id: 'obj-1', type: 'box', position: { col: 0, row: 0 }, width: 4, height: 2, zIndex: 0, layerId: 'layer-2' },
    ] as unknown as CanvasObject[];
    const compressed = compressToEncodedURIComponent(JSON.stringify(legacy));

    const decoded = decodeObjects(`#${compressed}`);

    expect(decoded?.objects).toEqual(legacy);
    expect(decoded?.layers).toBeUndefined();
  });

  it('decodes a v1 share link ({ objects, layers }) and surfaces the layers for migration', () => {
    const v1Objects = [
      { id: 'obj-1', type: 'box', position: { col: 0, row: 0 }, width: 4, height: 2, zIndex: 0, layerId: 'layer-2' },
    ] as unknown as CanvasObject[];
    const v1Layers: CanvasLayer[] = [
      { id: 'layer-1', name: 'Layer 1', order: 0, objectCount: 0 },
      { id: 'layer-2', name: 'Layer 2', order: 1, objectCount: 1, parentId: 'layer-1' },
    ];
    const compressed = compressToEncodedURIComponent(JSON.stringify({ objects: v1Objects, layers: v1Layers }));

    const decoded = decodeObjects(`#${compressed}`);

    expect(decoded?.objects).toEqual(v1Objects);
    expect(decoded?.layers).toEqual(v1Layers);
    expect(decoded?.layers?.find(l => l.id === 'layer-2')?.parentId).toBe('layer-1');
  });

  it('round-trips object parent hierarchy (parentId travels with each object)', () => {
    const nested = [
      { id: 'obj-1', type: 'box', position: { col: 0, row: 0 }, width: 4, height: 2, zIndex: 0 },
      { id: 'obj-2', type: 'box', position: { col: 2, row: 2 }, width: 4, height: 2, zIndex: 1, parentId: 'obj-1' },
    ] as unknown as CanvasObject[];

    const url = encodeObjects(nested);
    const decoded = decodeObjects(url.slice(url.indexOf('#')));

    expect(decoded?.objects.find(obj => obj.id === 'obj-2')?.parentId).toBe('obj-1');
  });

  it('returns null for an empty or malformed hash', () => {
    expect(decodeObjects('')).toBeNull();
    expect(decodeObjects('#')).toBeNull();
    expect(decodeObjects('#not-valid-lz-string-data')).toBeNull();
  });
});
