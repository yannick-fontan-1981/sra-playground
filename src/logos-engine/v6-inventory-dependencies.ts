/** Original observed_inventory/dependencies.py: measured unmet access relations. */
import { measured_paths } from './v6-inventory-routing.ts';
import { pythonEqual as eq, pythonTruthy as truth } from './v6-operations.ts';
import type { NativeRows } from './v6-native-types.ts';
type R = Record<string, any>;
const key = (p: readonly number[]): string => p.join(',');
const point = (p: string): number[] => p.split(',').map(Number);
const box = (c: R): number[] => ['left', 'top', 'right', 'bottom'].map(k => c.bbox[k]);
const enclosed = (inner: number[], outer: number[]): boolean => outer[0]! <= inner[0]! && inner[0]! <= inner[2]! && inner[2]! <= outer[2]!
  && outer[1]! <= inner[1]! && inner[1]! <= inner[3]! && inner[3]! <= outer[3]!;

export function measured_dependencies(scene: R, rows: NativeRows, world_pairs: R[], display_pairs: R[], interfaces: R, available: ReadonlySet<string>): R[] {
  if (display_pairs.length !== 1) return [];
  const target = [display_pairs[0]!.target_row, display_pairs[0]!.target_col];
  if (measured_paths(scene, rows, [target], interfaces, available).length) return [];
  const grouped = new Map<string, R[]>();
  for (const pair of world_pairs) { const k = key(pair.target_cell); if (!grouped.has(k)) grouped.set(k, []); grouped.get(k)!.push(pair); }
  const eligible = new Map([...grouped].filter(([, items]) => items.length === 1).map(([k, items]) => [k, items[0]!]));
  const routes = measured_paths(scene, rows, [target], interfaces, available, 16, [...eligible.keys()].map(point));
  if (routes.length !== 1) return [];
  const route = routes[0]!, barriers = (route.path as R[]).filter(step => step.surface_status === 'conditional_intermediate_partition');
  if (!barriers.length) return [];
  const first = barriers[0]!, cell = key(first.to_cell), pair = eligible.get(cell)!;
  if (measured_paths(scene, rows, [target], interfaces, available, 16, [...eligible.keys()].filter(k => k !== cell).map(point)).length) return [];
  const frontier = [...first.from_cell], prefix = measured_paths(scene, rows, [frontier], interfaces, available);
  if (prefix.length !== 1) return [];
  const supplier = measured_paths(scene, rows, [pair.source_cell], interfaces, available);
  if (supplier.length !== 1) return [];
  return [{ observation_ref: scene.observation_ref, level_epoch: scene.level_epoch, consumer_cell: target, unmet_partition: point(cell),
    supplier: pair, frontier_cell: frontier, frontier_route: prefix[0], supplier_route: supplier[0], conditional_total_distance: route.length,
    model_scope: 'current_repeated_support_plus_measured_complementary_partitions', qualifier: 'unmet_intermediate_access_under_conditional_graph',
    unknown: ['partition_access_law', 'allocation_capacity', 'reverse_transfer_applicability', 'unseen_alternative_route'], release_authority: false }];
}

export function recalled_gain_targets(scene: R, obs: R, collection: { evidence_for(signature: unknown): R } | null, dependency: R | null): any[] {
  if (collection === null || !truth(dependency) || (scene.grids ?? []).length !== 1) return [];
  const out: any[] = [];
  for (const entity of obs.entities as R[]) {
    if (truth(entity.identity_ambiguous)) continue;
    const method = collection.evidence_for(entity.signature);
    if (!truth(method.confirmed) || truth(method.counterexamples)) continue;
    const cells = (scene.grids[0].cells as R[]).filter(c => enclosed(entity.bbox, box(c)));
    if (cells.length !== 1) continue;
    const c = cells[0]!, b = box(c); if (enclosed(scene.body, b)) continue;
    out.push([[c.row, c.col], { recalled_gain_occurrence_current: true, unmet_access_dependency_current: true },
      { target_cell: [c.row, c.col], target_bbox: b, mark_bbox: entity.bbox, observation_ref: obs.observation_ref,
        dependency, method_recall: method, evidence: [...method.confirmed, obs.observation_ref], appearance_relation_only: true }]);
  }
  return out;
}

export function frontier_target(scene: R, dependency: R, held: R): any[] | null {
  const cell = (scene.grids[0].cells as R[]).find(c => eq([c.row, c.col], dependency.frontier_cell));
  if (!cell) return null;
  const b = box(cell), at = enclosed(scene.body, b);
  return [dependency.frontier_cell, { unmet_access_dependency_current: true, frontier_not_current: !at, frontier_current: at,
    current_corresponding_signature: truth(held), allocation_command_observed: truth(held) && truth(held.action) },
  { dependency, source_bbox: b, method_action: held.action, method: held, allocation_effect_unknown: true,
    future_consumer: dependency.consumer_cell, evidence: [...held.evidence, scene.observation_ref] }];
}
