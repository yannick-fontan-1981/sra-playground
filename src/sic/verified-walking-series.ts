import type { NativeBox, NativeCommand, NativeRows } from '../logos-engine/v6-native-types.ts';
import { maximumCommittedActions, unchangedOutside } from './plan-step.ts';

export type WalkingStep = { command: NativeCommand; from: NativeBox; to: NativeBox };
export type BoundWalkingStep = WalkingStep & { substrate: number[] };
const equalBox = (a: NativeBox, b: NativeBox) => a.every((n, i) => n === b[i]);
function pixels(rows: NativeRows, box: NativeBox) {
  const [l, t, r, b] = box;
  if (l < 0 || t < 0 || r < l || b < t || r >= (rows[0]?.length ?? 0) || b >= rows.length) return [];
  const values: number[] = [];
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) values.push(rows[y]![x]!);
  return values;
}

// Bind only the visible free approach. The first manipulation, unmeasured
// operation or revisited landing is a new decision point.
export function bindWalkingSeries(path: readonly WalkingStep[], rows: NativeRows, remaining: number) {
  const bound: BoundWalkingStep[] = [];
  const seen = new Set<string>();
  for (const step of path.slice(0, Math.min(remaining, maximumCommittedActions))) {
    const last = bound.at(-1),
      { from, to } = step;
    if (last && !equalBox(last.to, from)) break;
    const dx = Math.abs(to[0] - from[0]),
      dy = Math.abs(to[1] - from[1]);
    if (
      !/^ACTION[1-4]$/.test(step.command.action_ref) ||
      from[2] - from[0] !== to[2] - to[0] ||
      from[3] - from[1] !== to[3] - to[1] ||
      !((dx === from[2] - from[0] + 1 && dy === 0) || (dy === from[3] - from[1] + 1 && dx === 0))
    )
      break;
    seen.add(from.join());
    if (seen.has(to.join())) break;
    const substrate = pixels(rows, to);
    if (!substrate.length) break;
    bound.push({ ...step, substrate });
  }
  return bound.length >= 2 ? bound : undefined;
}

export function walkingPremise(step: BoundWalkingStep, rows: NativeRows) {
  const now = pixels(rows, step.to);
  return now.length === step.substrate.length && now.every((v, i) => v === step.substrate[i]);
}

export function walkingReturn(step: WalkingStep, first: NativeRows, next: NativeRows, arrived: boolean) {
  return arrived && unchangedOutside(first, next, [step.from, step.to]);
}
