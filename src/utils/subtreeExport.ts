import type { CanvasObject } from '../types';
import { createLayerObject, isLayerObject } from './layerMigration';
import { collectObjectDescendants } from './objectHierarchy';
import { getObjectTitle } from './objectLabel';

export const EXPORT_WRAPPER_LAYER_ID = 'export-root';

/**
 * Extracts `rootId` and its whole subtree as a standalone project payload
 * for "Export" in the layers panel (Issue #15); the file is reused through
 * Import (additive load). The root is detached to the top level, and a
 * non-layer root is wrapped in a layer named after it so importing it lands
 * as its own layer instead of an extra copy of the default layer.
 * Connector bindings to objects outside the subtree are dropped.
 */
export function extractSubtreeForExport(objects: CanvasObject[], rootId: string): CanvasObject[] {
  const root = objects.find(obj => obj.id === rootId);
  if (!root) return [];

  const ids = collectObjectDescendants(objects, [rootId]);
  const keepBinding = (binding: CanvasObject['startBinding']) => (
    binding && ids.has(binding.objectId) ? binding : undefined
  );
  const wrapper = isLayerObject(root)
    ? undefined
    : createLayerObject(EXPORT_WRAPPER_LAYER_ID, getObjectTitle(root));

  const subtree = objects
    .filter(obj => ids.has(obj.id))
    .map(obj => ({
      ...obj,
      parentId: obj.id === rootId ? wrapper?.id : obj.parentId,
      zIndex: obj.id === rootId ? 0 : obj.zIndex,
      startBinding: keepBinding(obj.startBinding),
      endBinding: keepBinding(obj.endBinding),
    }));
  return wrapper ? [wrapper, ...subtree] : subtree;
}

// File name for an exported subtree: the node's title with characters that
// are invalid in file names replaced.
export function getSubtreeExportFilename(root: CanvasObject): string {
  const title = (isLayerObject(root) ? root.label : getObjectTitle(root)) || 'export';
  const safe = title.replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '') || 'export';
  return `${safe}.wiretext`;
}
