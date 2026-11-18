import { queuedFieldClosure, queuedFieldPlacement, type QueuedFieldValues } from '../logos-engine/v6-queued-field-mechanics.ts';
import { queuedFieldBoard } from '../logos-engine/v6-queued-field-observation.ts';
import { queuedFieldPreparations } from '../logos-engine/v6-queued-field-search.ts';
import type { NativeCommand } from '../logos-engine/v6-native-types.ts';

type QueueRecord = Record<string, any>;
type Projection = { board: QueuedFieldValues; removed: number; cost: number; root: number; clearance: number };
type Offer = { actions: NativeCommand[]; column: number; group: number[] };
export type QueueHorizon = { actions: NativeCommand[]; projected: number; groups: number };

const compare = (a: Projection, b: Projection) => b.removed - a.removed || b.clearance - a.clearance || a.cost - b.cost;

/** Extend only a measured queue ordering and evaluate the retained closure alternatives. */
export function seekQueueHorizon(scene: QueueRecord, state: QueueRecord, remaining: number, deadline: number,
  now: () => number = () => performance.now()): QueueHorizon | null {
  const mark = scene.mark, { gravity, controls, closure_models: models } = state;
  const orientations = new Set((state.preview_orientations ?? []).map((value: unknown) => JSON.stringify(value)));
  const previews = scene.preview_alternatives.filter((item: QueueRecord) => orientations.has(JSON.stringify(item.orientation)));
  const drops = Object.keys(controls).filter(input => controls[input].kind === 'receive');
  if ((scene.preview_alternatives.length && previews.length !== 1) || !models?.length || models.length > 8 || drops.length !== 1) return null;
  const queue: number[][] = [mark.values, ...(previews[0]?.members ?? [])];
  if (queue.length > 8) return null;
  const start = queuedFieldBoard(scene, state.empty), width = scene.geometry.shape[0];
  const activeRows = mark.rows as readonly number[], spawn = state.spawn_column_observed ?? mark.column;
  const receipt = { action_ref: drops[0]!, data: {} };
  const roots: Offer[] = queuedFieldPreparations(mark.values, mark.column, controls, width, start, activeRows, state)
    .flatMap(([group, column, travel]): Offer[] => travel.length < Math.min(16, remaining)
      && !(state.restorations ?? []).some((failed: QueueRecord) => failed.column === column
        && JSON.stringify(failed.board) === JSON.stringify(start) && JSON.stringify(failed.bundle) === JSON.stringify(group))
      ? [{ actions: [...travel.map(item => ({ action_ref: item.action_ref, data: {} })), receipt], column, group }] : []);
  if (!roots.length) return null;
  const scores = roots.map(() => [] as number[]);
  const clearance = (board: QueuedFieldValues) => Array.from({ length: width }, (_, col) => col)
    .filter(col => activeRows.every(row => board[row]![col] === null)).length;
  for (const model of models as QueueRecord[]) {
    if (now() >= deadline) return null;
    const best = roots.map(() => -1);
    const projection = (board: QueuedFieldValues, group: number[], column: number, root: number, prior: number, cost: number): Projection | null => {
      const placement = queuedFieldPlacement(board, group, column, gravity);
      if (!placement) return null;
      const consequence = queuedFieldClosure(placement, model);
      if (!consequence.closed) return null;
      const removed = prior + consequence.removed;
      best[root] = Math.max(best[root]!, removed);
      return { board: consequence.board, removed, cost, root, clearance: clearance(consequence.board) };
    };
    let frontier = roots.map(({ group, column, actions }, i) => projection(start, group, column, i, 0, actions.length))
      .filter((item): item is Projection => item !== null);
    for (const group of queue.slice(1)) {
      const next = new Map<string, Projection>();
      for (const node of frontier) {
        if (now() >= deadline) break;
        if (activeRows.some(row => node.board[row]![spawn] !== null)) continue;
        for (const [ordered, column, path] of queuedFieldPreparations(group, spawn, controls, width, node.board, activeRows)) {
          const cost = node.cost + path.length + 1;
          if (cost > remaining) continue;
          const result = projection(node.board, ordered, column, node.root, node.removed, cost);
          if (!result) continue;
          const key = JSON.stringify([node.root, result.board]), previous = next.get(key);
          if (!previous || compare(result, previous) < 0) next.set(key, result);
        }
      }
      // Keep multiple continuations of every first deposit so that early credit
      // does not crowd out preparations for a later cascade.
      const kept = new Map<number, number>();
      frontier = [...next.values()].sort(compare).filter(node => {
        const count = kept.get(node.root) ?? 0;
        kept.set(node.root, count + 1);
        return count < 10;
      });
      if (!frontier.length || now() >= deadline) break;
    }
    best.forEach((value, i) => scores[i]!.push(value));
  }
  const offers = roots.flatMap((root, i) => {
    const measured = scores[i]!, projected = Math.min(...measured);
    return projected < 0 ? [] : [{ actions: root.actions, projected, groups: queue.length,
      total: measured.reduce((sum, value) => sum + value, 0) }];
  });
  return offers.sort((a, b) => b.projected - a.projected || b.total - a.total || a.actions.length - b.actions.length)[0] ?? null;
}
