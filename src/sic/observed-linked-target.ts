import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { measureLinkedMarkerLayout, readLinkedMarkerScene, type LinkedMarkerLayout } from './linked-midpoint.ts';

export type LinkedTarget = { command: NativeCommand; box: NativeBox; evidence: string[]; intent: 'probe' | 'place' | 'switch' };
export type MeasuredLink = { layout: LinkedMarkerLayout; proof: string };
const same = ([x, y]: NativePoint, [u, v]: NativePoint) => x === u && y === v;

export function observeLink(local: MeasuredLink | undefined, before: NativeRows, after: NativeRows,
  command: NativeCommand, proof: string): MeasuredLink | undefined {
  if (command.action_ref !== 'ACTION6') return local;
  const first = geometricComponents(before), layout = local?.layout ?? measureLinkedMarkerLayout(first, before);
  if (!layout) return local;
  const a = readLinkedMarkerScene(first, layout), b = readLinkedMarkerScene(geometricComponents(after), layout);
  if (!a || !b || !same(a.passive.point, b.passive.point) || same(a.active.point, b.active.point) || same(a.actor.point, b.actor.point)) return local;
  const [x, y] = b.active.point, [u, v] = b.passive.point;
  if (x !== command.data.x || y !== command.data.y || !same(b.actor.point, [Math.floor((x + u) / 2), Math.floor((y + v) / 2)])) return local;
  return { layout, proof };
}

export function chooseLinkedTarget(local: MeasuredLink | undefined, rows: NativeRows, tried: ReadonlySet<string>): LinkedTarget | undefined {
  const parts = geometricComponents(rows), layout = local?.layout ?? measureLinkedMarkerLayout(parts, rows);
  if (!layout) return;
  const scene = readLinkedMarkerScene(parts, layout);
  if (!scene) return;
  const { goal, side, ground } = layout, { active, passive } = scene;
  const offset = Math.floor(side / 2);
  const bounds = ([x, y]: NativePoint): NativeBox => [x - offset, y - offset, x + offset, y + offset];
  const safe = (p: NativePoint) => {
    const [l, t, r, b] = bounds(p);
    return [[l, t], [l, b], [r, t], [r, b]].every(([xx, yy]) => rows[yy!]?.[xx!] === ground);
  };
  function inverse(other: NativePoint): NativePoint | undefined {
    const [x, y] = goal, [u, v] = other;
    for (const dx of [0, 1]) for (const dy of [0, 1]) {
      const p: NativePoint = [2 * x - u + dx, 2 * y - v + dy];
      if (Math.max(Math.abs(p[0] - u), Math.abs(p[1] - v)) < side) continue;
      if (safe(p)) return p;
    }
  }
  const placement = inverse(passive.point);
  const switchPoint = inverse(active.point) ? passive.point : undefined;
  const probe = () => {
    const [x, y] = goal;
    for (const dx of [-side, side]) for (const dy of [-side, side]) {
      const p: NativePoint = [x + dx, y + dy];
      const center: NativePoint = [Math.floor((p[0] + passive.point[0]) / 2), Math.floor((p[1] + passive.point[1]) / 2)];
      if (safe(p) && safe(center) && inverse(p) && !tried.has(`ACTION6:${p[0]},${p[1]}`)) return p;
    }
  };
  const point = placement ?? switchPoint ?? (!local ? probe() : undefined);
  if (!point || tried.has(`ACTION6:${point[0]},${point[1]}`)) return;
  return { command: { action_ref: 'ACTION6', data: { x: point[0], y: point[1] } },
    box: bounds(point), evidence: local ? [local.proof] : [], intent: !local ? 'probe' : placement ? 'place' : 'switch' };
}
