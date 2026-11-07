/** Exact, ambiguity-preserving V5 component matching on native public measurements. */
import { compareUnicode } from './canonical.ts';
import type { V5Component, V5ComponentExtraction } from './v6-native-observer.ts';

export function enumerateComponentMatches(before: V5ComponentExtraction, after: V5ComponentExtraction, actionRef: string | null = null) {
  const signature = (part: V5Component) => JSON.stringify([part.value, part.relative_pixels]);
  const bySignature = new Map<string, V5Component[]>();
  for (const part of after.components) { const id = signature(part), matches = bySignature.get(id) ?? []; matches.push(part); bySignature.set(id, matches); }
  const candidates = [], beforeCounts = new Map<string, number>(), afterCounts = new Map(after.components.map(part => [part.component_id, 0]));
  for (const part of before.components) {
    const matches = bySignature.get(signature(part)) ?? []; beforeCounts.set(part.component_id, matches.length);
    for (const target of matches) {
      candidates.push({ before_component_id: part.component_id, after_component_id: target.component_id,
        delta_row: target.bbox.top - part.bbox.top, delta_col: target.bbox.left - part.bbox.left,
        exact_value_identity: true, exact_shape_identity: true, schema_version: 'yf_arc3_v5.component_match_candidate.v1' });
      afterCounts.set(target.component_id, afterCounts.get(target.component_id)! + 1);
    }
  }
  const counted = (counts: Map<string, number>, condition: (count: number) => boolean) => [...counts].filter(([, count]) => condition(count)).map(([id]) => id).sort(compareUnicode);
  return { candidates, ambiguous_before_component_ids: counted(beforeCounts, count => count > 1),
    ambiguous_after_component_ids: counted(afterCounts, count => count > 1), unmatched_before_component_ids: counted(beforeCounts, count => count === 0),
    unmatched_after_component_ids: counted(afterCounts, count => count === 0), action_ref: actionRef, schema_version: 'yf_arc3_v5.component_match_result.v1' };
}
