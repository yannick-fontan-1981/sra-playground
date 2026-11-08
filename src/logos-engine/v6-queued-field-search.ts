/** Pinned bounded preparation/queue composition search over acquired public relations. */
import { queuedFieldPlacement, queuedFieldClosure, queuedFieldModels, type QueuedFieldValues } from './v6-queued-field-mechanics.ts';
import { queuedFieldBoard } from './v6-queued-field-observation.ts';
import { queueTranslationPremise } from './v6-queued-field-models.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';

type R = Record<string, any>;
type Clock = () => number;
type Preparation = [number[], number, R[]];
const key = (value: unknown): string => JSON.stringify(value);
const rankGreater = (a: number[], b: number[]): boolean => {
  for (let i = 0; i < a.length; i++) { if (a[i]! > b[i]!) return true; if (a[i]! < b[i]!) return false; }
  return false;
};

export function queuedFieldPreparations(bundle: readonly number[], column: number, controls: R, width: number,
  field: QueuedFieldValues | null = null, activeRows: readonly number[] = [], state: R | null = null): Preparation[] {
  const queue: Preparation[] = [[[...bundle], column, []]], seen = new Set([key([bundle, column])]), result: Preparation[] = [];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const [values, x, path] = queue[cursor]!; result.push([values, x, path]);
    for (const action of Object.keys(controls).sort()) {
      const law = controls[action]; let members: number[], destination: number;
      if (law.kind === 'translate') {
        destination = x + law.delta; members = values;
        if (field !== null && 0 <= destination && destination < width && activeRows.some(y => field[y]![destination] !== null)) continue;
        if (state && (state.refuted_translations ?? []).some((item: R) => item.premise_ref === queueTranslationPremise(state.key, field, values, x, action))) continue;
      } else if (law.kind === 'reorder' && law.permutations.length === 1) {
        members = (law.permutations[0] as number[]).map(i => values[i]!); destination = x;
      } else continue;
      const nextKey = key([members, destination]);
      if (0 <= destination && destination < width && !seen.has(nextKey)) {
        seen.add(nextKey); queue.push([members, destination, [...path, { action_ref: action }]]);
      }
    }
  }
  return result;
}

export function chooseQueuedField(scene: R, state: R, remaining: number, deadlineMs: number, nodeBound = 24000, depthBound = 3,
  now: Clock = () => performance.now()): R | null {
  if (truth(state.closure_incompatible)) return null;
  const initial = queuedFieldBoard(scene, state.empty), mark = scene.mark, controls = state.controls, gravity = state.gravity;
  const drops = Object.keys(controls).filter(action => controls[action].kind === 'receive');
  if (drops.length !== 1) return null;
  const hypotheses: R[] = truth(state.closure_models) ? state.closure_models : queuedFieldModels(scene.geometry.shape, gravity);
  let previews: number[][][] = (scene.preview_alternatives as R[]).filter(p => (state.preview_orientations ?? []).some((orientation: unknown) => equal(orientation, p.orientation))).map(p => p.members);
  if (!previews.length) previews = [[]];
  const depth = Math.min(depthBound, 1 + Math.min(...previews.map(p => p.length)));
  let nodes = 0, bounded = false;
  const roots: { values: number[]; column: number; actions: R[]; placed: (number | null)[][] }[] = [];
  for (const [values, column, path] of queuedFieldPreparations(mark.values, mark.column, controls, scene.geometry.shape[0], initial, mark.rows, state)) {
    const actions = [...path, { action_ref: drops[0] }];
    if (actions.length > Math.min(16, remaining)) continue;
    if ((state.restorations ?? []).some((r: R) => equal(r.board, initial) && equal(r.bundle, values) && r.column === column)) continue;
    const placed = queuedFieldPlacement(initial, values, column, gravity);
    if (placed !== null) roots.push({ values, column, actions, placed });
  }
  if (!roots.length) return null;
  const projections = new Map<string, R | null>();
  function project(grid: QueuedFieldValues, bundle: number[], column: number, modelIndex: number): R | null {
    const cacheKey = key([grid, bundle, column, modelIndex]);
    if (projections.has(cacheKey)) return projections.get(cacheKey)!;
    if (nodes >= nodeBound || now() >= deadlineMs) { bounded = true; projections.set(cacheKey, null); return null; }
    nodes++; const placed = queuedFieldPlacement(grid, bundle, column, gravity);
    const result = placed === null ? null : queuedFieldClosure(placed, hypotheses[modelIndex]!);
    projections.set(cacheKey, result); return result;
  }
  const futures = new Map<string, number>();
  function future(grid: QueuedFieldValues, queue: number[][], left: number, modelIndex: number, budget: number): number {
    const cacheKey = key([grid, queue, left, modelIndex, budget]);
    if (futures.has(cacheKey)) return futures.get(cacheKey)!;
    if (left <= 0 || !queue.length || budget <= 0) { futures.set(cacheKey, 0); return 0; }
    let best = 0; const values = queue[0]!, origin = state.spawn_column_observed ?? mark.column;
    if ((mark.rows as number[]).some(y => grid[y]![origin] !== null)) { futures.set(cacheKey, 0); return 0; }
    for (const [ordered, column, path] of queuedFieldPreparations(values, origin, controls, scene.geometry.shape[0], grid, mark.rows, state)) {
      const cost = path.length + 1;
      if (cost > budget) continue;
      const output = project(grid, ordered, column, modelIndex);
      if (output === null) continue;
      const score = output.removed + future(output.board, queue.slice(1), left - 1, modelIndex, budget - cost);
      best = Math.max(best, score);
    }
    futures.set(cacheKey, best); return best;
  }
  const offers: R[] = [];
  for (const { values, column, actions, placed } of roots) {
    const outcomes: R[] = [], scores: number[] = [];
    for (const [mi] of hypotheses.entries()) {
      const output = project(initial, values, column, mi);
      if (output === null) continue;
      outcomes.push(output);
      for (const preview of previews) scores.push(output.removed + future(output.board, preview, depth - 1, mi, remaining - actions.length));
    }
    if (outcomes.length !== hypotheses.length) continue;
    const rank = truth(state.closure_models)
      ? [Math.min(...scores), scores.reduce((sum, value) => sum + value, 0) / scores.length, -actions.length]
      : [outcomes.filter(out => out.removed > 0).length, outcomes.reduce((sum, out) => sum + out.removed, 0), -actions.length];
    offers.push({ rank, values, column, actions, placed, outcomes });
  }
  if (!offers.length) return null;
  let selected = offers[0]!;
  for (const offer of offers.slice(1)) if (rankGreater(offer.rank, selected.rank)) selected = offer;
  return { actions: selected.actions, bundle: selected.values, column: selected.column, placed: selected.placed, outcomes: selected.outcomes,
    model_alternatives: hypotheses, rank: selected.rank, nodes, node_bound: nodeBound, depth_bound: depth, bounded,
    scope: 'Finite conditional queue contribution estimate, not a terminal solution certificate. Unknown line predicates remain alternatives. Future queue/spawn readings are revalidated after each receipt.' };
}
