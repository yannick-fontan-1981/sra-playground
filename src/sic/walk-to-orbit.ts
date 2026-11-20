import type { NativeRows, NativeEntity } from '../logos-engine/v6-native-types.ts';
import { add, diff, size, type XY } from './access-terrain.ts';
import type { Memory } from './preparation-experiments.ts';
import type { Territory, Stroke } from './controllable-territory.ts';
import type { TerritorialStep } from './pursue-territory.ts';

// Search for a command word before attributing an inaccessible region to an unknown mechanism.
// An origin where this command already failed cannot serve as an imagined ordinary edge.
export function walkToOrbit(
  t: Territory,
  m: Memory,
  rows: NativeRows,
  available: Set<string>,
  actor: NativeEntity
): TerritorialStep[] {
  const maxX = t.width - 1 - (actor.bbox[2] - actor.bbox[0]),
    maxY = rows.length - 1 - (actor.bbox[3] - actor.bbox[1]);
  const known = new Map<string, Set<string>>();
  for (const e of m.edges) {
    const p = e.anchors[t.actor]?.at;
    if (!e.stable || !p || !e.visibleAfter?.includes(t.actor)) continue;
    const k = p + '/' + e.cmd,
      returns = known.get(k) ?? new Set<string>(),
      d = e.effect.moves.find((v) => v.actor === t.actor);
    if (d) returns.add(d.to);
    else if (!e.manipulation?.changedClasses.includes(t.actor)) returns.add(p);
    if (returns.size) known.set(k, returns);
  }
  const key = (p: XY) => p[1] * t.width + p[0],
    xy = (n: number): XY => [n % t.width, Math.floor(n / t.width)];
  const start = key(t.from),
    exact = key(t.foothold),
    queue = [start],
    path = new Map<number, { from: number; op: Stroke }>();
  let found: number | null = null;
  const ops = t.ops.filter((v) => available.has(v.op));
  if (!ops.length) return [];
  for (const current of queue) {
    if (current === exact) {
      found = current;
      break;
    }
    if (found === null && t.foreign.has(current)) found = current;
    const p = xy(current);
    const choices = ops
      .map((op) => ({ op, to: add(p, op.d) }))
      .sort(
        (a, b) => size(diff(a.to, t.foothold)) - size(diff(b.to, t.foothold)) || b.op.support - a.op.support
      );
    for (const { op, to } of choices) {
      if (to[0] < 0 || to[0] > maxX || to[1] < 0 || to[1] > maxY) continue;
      const k = key(to),
        witness = known.get(p.join() + '/' + op.op);
      if (k === start || path.has(k) || (witness && !witness.has(to.join()))) continue;
      path.set(k, { from: current, op });
      queue.push(k);
    }
  }
  if (found === null) return [];
  const steps: TerritorialStep[] = [];
  for (let k = found; k !== start; ) {
    const { op, from } = path.get(k)!;
    steps.push({
      op: op.op,
      stage: k === found ? 'challenge' : 'approach',
      from: xy(from),
      to: xy(k),
      ref: op.ref,
    });
    k = from;
  }
  return steps.reverse();
}
