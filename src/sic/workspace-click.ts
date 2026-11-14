import { facetProject } from '../logos-engine/v6-facet-examples-geometry.ts';
import type { NativeBox, NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { ClickRegionEvidence } from './observed-click-regions.ts';

export type WorkspaceClickEvidence = Omit<ClickRegionEvidence, 'before' | 'after'> & { readonly changedInside: number };

export function countChangesInside(before: NativeRows, after: NativeRows, [left, top, right, bottom]: NativeBox): number | null {
  let changed = 0;
  for (let y = 0; y < before.length; y++) for (let x = 0; x < before[y]!.length; x++) {
    if (before[y]![x] === after[y]?.[x]) continue;
    if (x <= left || x >= right || y <= top || y >= bottom) return null;
    changed++;
  }
  return changed;
}

export function workspaceClickCandidate(observation: NativeObservation, rows: NativeRows) {
  const scene = facetProject(observation, rows);
  if (scene?.offer.kind !== 'probe_congruent_empty_face') return null;
  return { point: scene.offer.point, box: scene.offer.support.bbox, workspace: scene.world, example: scene.example_box };
}
