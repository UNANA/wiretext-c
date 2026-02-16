import { useEffect } from 'react';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { CanvasObject } from '../types';

/**
 * Encode objects into a compressed URL hash string.
 */
export function encodeObjects(objects: CanvasObject[]): string {
    const json = JSON.stringify(objects);
    const compressed = compressToEncodedURIComponent(json);
    return `${window.location.origin}${window.location.pathname}#${compressed}`;
}

/**
 * Decode objects from a URL hash string.
 * Returns null if the hash is empty or decoding fails.
 */
export function decodeObjects(hash: string): CanvasObject[] | null {
    if (!hash || hash.length <= 1) return null;

    try {
        const compressed = hash.startsWith('#') ? hash.slice(1) : hash;
        const json = decompressFromEncodedURIComponent(compressed);
        if (!json) return null;

        const parsed = JSON.parse(json);
        if (!Array.isArray(parsed)) return null;

        return parsed as CanvasObject[];
    } catch {
        return null;
    }
}

/**
 * Hook that checks for objects encoded in the URL hash on mount.
 * If found, loads them via the provided callback.
 */
export function useShareUrl(loadObjects: (objects: CanvasObject[]) => void) {
    useEffect(() => {
        const hash = window.location.hash;
        if (hash && hash.length > 1) {
            const objects = decodeObjects(hash);
            if (objects && objects.length > 0) {
                loadObjects(objects);
                // Clear hash after loading so it doesn't reload on refresh
                // but keep the URL clean without triggering a navigation
                window.history.replaceState(null, '', window.location.pathname);
            }
        }
    }, [loadObjects]);
}
