import type { NativeEntity, NativeRows } from '../logos-engine/v6-native-types.ts';
import { add, diff, same, size, type XY } from './access-terrain.ts';
import { projectedStep, type Layout, type Motion } from './projected-motion.ts';

// Learn the support of each role independently. A blocked member of a moving group
// can provide the preparation for a new relative configuration of the group.
export function supportProjection(
  model: Motion,
  bodies: [NativeEntity, NativeEntity],
  rows: NativeRows,
  ground: number[],
  occupied: Set<string>[]
) {
  function substrate(i: number, p: XY) {
    const body = bodies[i]!,
      x = p[0] + Math.floor((body.bbox[2] - body.bbox[0]) / 2),
      y = p[1] + Math.floor((body.bbox[3] - body.bbox[1]) / 2);
    if (
      p[0] < 0 ||
      p[1] < 0 ||
      p[0] + body.bbox[2] - body.bbox[0] >= rows[0]!.length ||
      p[1] + body.bbox[3] - body.bbox[1] >= rows.length ||
      rows[y]?.[x] === undefined
    )
      return -2;
    if (bodies.some((e) => e.bbox[0] <= x && x <= e.bbox[2] && e.bbox[1] <= y && y <= e.bbox[3]))
      return ground[i]!;
    return rows[y]![x]!;
  }
  const predictors = [0, 1].map((i) => {
    const frequencies = new Map<string, { d: XY; n: number }>();
    for (const sample of model.samples) {
      const d = diff(sample.after[i]!, sample.before[i]!);
      if (!size(d)) continue;
      const item = frequencies.get(d.join()) ?? { d, n: 0 };
      item.n++;
      frequencies.set(d.join(), item);
    }
    const all = [...frequencies.values()].sort((a, b) => b.n - a.n);
    if (!all.length || model.rules[i]!.formula.source !== i || all[1]?.n === all[0]!.n) return null;
    const d = all[0]!.d,
      votes = new Map<number, Set<string>[]>(),
      byOrigin = new Map<string, Set<boolean>>();
    for (const s of model.samples) {
      const start = s.before[i]!,
        target = add(start, d),
        moved = same(target, s.after[i]!);
      if (!moved && !same(start, s.after[i]!)) continue;
      const c = substrate(i, target),
        v = votes.get(c) ?? [new Set<string>(), new Set<string>()];
      v[Number(moved)]!.add(start.join());
      votes.set(c, v);
      const result = byOrigin.get(start.join()) ?? new Set<boolean>();
      result.add(moved);
      byOrigin.set(start.join(), result);
    }
    return { d, votes, byOrigin };
  });
  return (pose: Layout): Layout => {
    const predicted = projectedStep(model, pose);
    for (const i of [0, 1]) {
      const fit = predictors[i];
      if (!fit) {
        if (model.rules[i]!.formula.source === i && substrate(i, predicted[i]!) === -2)
          predicted[i] = pose[i]!;
        continue;
      }
      const from = pose[i]!,
        target = add(from, fit.d),
        atOrigin = fit.byOrigin.get(from.join());
      if (!same(predicted[i]!, from) && !same(predicted[i]!, target)) continue;
      const c = substrate(i, target),
        vote = fit.votes.get(c);
      if (c === -2 || (vote && vote[0]!.size >= 2 && !vote[1]!.size && !occupied[i]!.has(target.join()))) {
        predicted[i] = from;
      } else if (atOrigin?.size === 1 && atOrigin.has(true) && fit.byOrigin.size >= 2) {
        predicted[i] = target;
      } else if (atOrigin?.size === 1 && atOrigin.has(false) && vote && !vote[1]!.size) {
        predicted[i] = from;
      }
    }
    return predicted;
  };
}
