import { describe, expect, it, vi } from 'vitest';
import { compressToEncodedURIComponent } from 'lz-string';
import type { CanvasLayer, CanvasObject } from '../types';
import { decodeObjects, encodeObjects } from './useShareUrl';

// encodeObjects reads window.location; the default vitest environment is
// plain Node (no window), so stub just enough of it here.
vi.stubGlobal('window', { location: { origin: 'https://example.test', pathname: '/' } });

const objects = [
  { id: 'obj-1', type: 'box', position: { col: 0, row: 0 }, width: 4, height: 2, zIndex: 0, layerId: 'layer-2' },
] as unknown as CanvasObject[];

const layers: CanvasLayer[] = [
  { id: 'layer-1', name: 'Layer 1', order: 0, objectCount: 0 },
  { id: 'layer-2', name: 'Layer 2', order: 1, objectCount: 1, parentId: 'layer-1' },
];

describe('encodeObjects / decodeObjects round trip', () => {
  it('round-trips objects and layer hierarchy through the URL hash', () => {
    const url = encodeObjects(objects, layers);
    const hash = url.slice(url.indexOf('#'));

    const decoded = decodeObjects(hash);

    expect(decoded?.objects).toEqual(objects);
    expect(decoded?.layers).toEqual(layers);
    expect(decoded?.layers?.find(l => l.id === 'layer-2')?.parentId).toBe('layer-1');
  });

  it('omits layers from the payload when none are given, keeping the legacy bare-array format', () => {
    const url = encodeObjects(objects);
    const hash = url.slice(url.indexOf('#'));

    const decoded = decodeObjects(hash);

    expect(decoded?.objects).toEqual(objects);
    expect(decoded?.layers).toBeUndefined();
  });

  it('decodes an old-format share link (bare compressed array, no layers) without breaking', () => {
    const legacyJson = JSON.stringify(objects);
    const compressed = compressToEncodedURIComponent(legacyJson);

    const decoded = decodeObjects(`#${compressed}`);

    expect(decoded?.objects).toEqual(objects);
    expect(decoded?.layers).toBeUndefined();
  });

  it('returns null for an empty or malformed hash', () => {
    expect(decodeObjects('')).toBeNull();
    expect(decodeObjects('#')).toBeNull();
    expect(decodeObjects('#not-valid-lz-string-data')).toBeNull();
  });
});
