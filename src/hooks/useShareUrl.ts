import { useEffect } from 'react';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { CanvasLayer, CanvasObject } from '../types';

export interface DecodedShareData {
    objects: CanvasObject[];
    // Absent when decoding a share link created before layer hierarchy was
    // included in the payload — see decodeObjects, which falls back to the
    // legacy per-object layerParentId migration in that case (same as
    // project files without a persisted `layers` array).
    layers?: CanvasLayer[];
}

/**
 * Encode objects (and, optionally, layer hierarchy/order/names) into a
 * compressed URL hash string. When `layers` is omitted the payload is the
 * bare objects array, matching the legacy format older share links used —
 * this keeps decodeObjects' legacy branch exercised and avoids surprising
 * older builds that might still read the hash directly.
 */
export function encodeObjects(objects: CanvasObject[], layers?: CanvasLayer[]): string {
    const payload = layers && layers.length > 0 ? { objects, layers } : objects;
    const json = JSON.stringify(payload);
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
