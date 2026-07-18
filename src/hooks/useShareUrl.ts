import { useEffect } from 'react';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { CanvasObject } from '../types';
import type { CanvasLayer } from '../utils/layerMigration';

export interface DecodedShareData {
    objects: CanvasObject[];
    // Present only when decoding a v1 share link that carried separate layer
    // entities; loadObjects migrates them into the unified tree.
    layers?: CanvasLayer[];
}

/**
 * Encode objects into a compressed URL hash string. Layers travel inside
 * `objects` as `type: 'layer'` nodes (unified tree), so the payload is just
 * `{ objects }` — no separate layers field is written anymore.
 */
export function encodeObjects(objects: CanvasObject[]): string {
    const json = JSON.stringify({ objects });
    const compressed = compressToEncodedURIComponent(json);
    return `${window.location.origin}${window.location.pathname}#${compressed}`;
}

/**
 * Decode objects (and layers, if present) from a URL hash string.
 * Returns null if the hash is empty or decoding fails.
 *
 * Supports both the legacy bare-array format (`[...objects]`) and the
 * current `{ objects, layers }` format, so old share links keep working.
 */
export function decodeObjects(hash: string): DecodedShareData | null {
    if (!hash || hash.length <= 1) return null;

    try {
        const compressed = hash.startsWith('#') ? hash.slice(1) : hash;
        const json = decompressFromEncodedURIComponent(compressed);
        if (!json) return null;

        const parsed = JSON.parse(json) as unknown;

        if (Array.isArray(parsed)) {
            return { objects: parsed as CanvasObject[] };
        }

        if (
            parsed
            && typeof parsed === 'object'
            && 'objects' in parsed
            && Array.isArray((parsed as { objects: unknown }).objects)
        ) {
            const record = parsed as { objects: unknown; layers?: unknown };
            const layers = Array.isArray(record.layers) ? record.layers as CanvasLayer[] : undefined;
            return { objects: record.objects as CanvasObject[], layers };
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Hook that checks for objects (and layer hierarchy) encoded in the URL hash
 * on mount. If found, loads them via the provided callback.
 */
export function useShareUrl(loadObjects: (objects: CanvasObject[], layers?: CanvasLayer[]) => void) {
    useEffect(() => {
        const hash = window.location.hash;
        if (hash && hash.length > 1) {
            const decoded = decodeObjects(hash);
            if (decoded && decoded.objects.length > 0) {
                loadObjects(decoded.objects, decoded.layers);
                // Clear hash after loading so it doesn't reload on refresh
                // but keep the URL clean without triggering a navigation
                window.history.replaceState(null, '', window.location.pathname);
            }
        }
    }, [loadObjects]);
}
