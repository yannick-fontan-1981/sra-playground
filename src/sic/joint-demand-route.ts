import type { NativeBox, NativePoint } from '../logos-engine/v6-native-types.ts';

export type JointMotion = { radius: number; stride: number; ticks: number; pursuit: number };
export type JointStep = { point: NativePoint; anchors: number[]; affected: boolean[] };

const clamp = (value: number, lower: number, upper: number) => Math.max(lower, Math.min(upper, value));
const gapSquared = (x: number, y: number, [l, t, r, b]: NativeBox) =>
  Math.max(l - x, 0, x - r) ** 2 + Math.max(t - y, 0, y - b) ** 2;
export const motionAnchor = ([l, t, r, b]: NativeBox): NativePoint =>
  [Math.floor((l + r + 1) / 2), Math.floor((t + b + 1) / 2)];

/** Search for a return that accepts all products before autonomous motion reopens a delivery. */
export function planJointDelivery(boxes: readonly NativeBox[], arena: NativeBox, receivers: readonly NativeBox[],
  motion: JointMotion, attempted: (point: NativePoint) => boolean, shouldStop: () => boolean): JointStep | null {
  const mobile = boxes.length - 1;
  const shapes = boxes.map(([l, t, r, b]) => {
    const width = r - l + 1, height = b - t + 1;
    return { width, height, x: Math.floor(width / 2), y: Math.floor(height / 2) };
  });
  const [left, top, right, bottom] = arena;
  const box = (pose: readonly number[], i: number): NativeBox => {
    const shape = shapes[i]!, l = pose[2 * i]! - shape.x, t = pose[2 * i + 1]! - shape.y;
    return [l, t, l + shape.width - 1, t + shape.height - 1];
  };
  const complete = (pose: readonly number[]) => shapes.every((_, i) =>
    receivers.some(zone => gapSquared(pose[2 * i]!, pose[2 * i + 1]!, zone) === 0));
  const overlaps = ([l, t, r, b]: NativeBox, [a, c, d, e]: NativeBox) => l <= d && r >= a && t <= e && b >= c;
  const penalty = (pose: readonly number[]) => shapes.reduce((total, _, i) => {
    const x = pose[2 * i]!, y = pose[2 * i + 1]!;
    return total + Math.min(...receivers.map(zone => {
      const [a, b] = motionAnchor(zone);
      return Math.sqrt(gapSquared(x, y, zone)) + 0.035 * Math.hypot(x - a, y - b);
    }));
  }, 0);

  function forecast(pose: readonly number[], [x, y]: NativePoint) {
    const next = [...pose], affected = shapes.map((_, i) => gapSquared(x, y, box(pose, i)) <= motion.radius ** 2);
    const mobileX = mobile * 2, mobileY = mobileX + 1;
    for (let tick = 0; tick < motion.ticks; tick++) {
      for (let i = 0; i < shapes.length; i++) if (affected[i]) {
        next[2 * i] = next[2 * i]! + clamp(x - next[2 * i]!, -motion.stride, motion.stride);
        next[2 * i + 1] = next[2 * i + 1]! + clamp(y - next[2 * i + 1]!, -motion.stride, motion.stride);
      }
      if (!affected[mobile]) {
        let closest = 0, closestDistance = Infinity;
        for (let i = 0; i < mobile; i++) {
          const distance = (next[2 * i]! - next[mobileX]!) ** 2 + (next[2 * i + 1]! - next[mobileY]!) ** 2;
          if (distance < closestDistance) { closest = i; closestDistance = distance; }
        }
        next[mobileX] = next[mobileX]! + Math.sign(next[2 * closest]! - next[mobileX]!) * motion.pursuit;
        next[mobileY] = next[mobileY]! + Math.sign(next[2 * closest + 1]! - next[mobileY]!) * motion.pursuit;
      }
      shapes.forEach((shape, i) => {
        next[2 * i] = clamp(next[2 * i]!, left + shape.x - 1, right + 2 - shape.width + shape.x);
        next[2 * i + 1] = clamp(next[2 * i + 1]!, top + shape.y, bottom + 1 - shape.height + shape.y);
      });
      if (complete(next)) return { pose: next, affected, won: true };
      if (!affected[mobile] && shapes.slice(0, mobile).some((_, i) => overlaps(box(next, i), box(next, mobile)))) return null;
    }
    // A predicted return must still allow every product to be identified for the next command.
    if (shapes.some((_, i) => shapes.slice(i + 1).some((_, j) => overlaps(box(next, i), box(next, i + 1 + j))))) return null;
    return { pose: next, affected, won: false };
  }

  function* clicks(pose: readonly number[], sampling: number): Generator<NativePoint> {
    const footprints = shapes.map((_, i) => box(pose, i));
    let pauseOffered = false;
    for (let y = top; y <= bottom; y += sampling) for (let x = left; x <= right; x += sampling) {
      if (footprints.some(footprint => gapSquared(x, y, footprint) <= motion.radius ** 2)) yield [x, y];
      else if (!pauseOffered) { pauseOffered = true; yield [x, y]; }
    }
  }

  type Node = { pose: number[]; rank: number; first: JointStep | null };
  const initial = boxes.flatMap(motionAnchor), seen = new Set([initial.join(',')]);
  let wave: Node[] = [{ pose: initial, rank: penalty(initial), first: null }];
  let best: JointStep | null = null, bestRank = wave[0]!.rank;
  for (let depth = 0; depth < 9 && wave.length && !shouldStop(); depth++) {
    const next: Node[] = [];
    for (const node of wave) {
      if (shouldStop()) return best;
      for (const point of clicks(node.pose, depth === 0 ? 1 : 2)) {
        if (depth === 0 && attempted(point)) continue;
        const projected = forecast(node.pose, point);
        if (!projected) continue;
        const first = node.first ?? { point, anchors: projected.pose, affected: projected.affected };
        if (projected.won) return first;
        const key = projected.pose.join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        const rank = penalty(projected.pose);
        if (rank + 0.08 * depth < bestRank) { best = first; bestRank = rank + 0.08 * depth; }
        next.push({ pose: projected.pose, rank, first });
      }
    }
    wave = next.sort((a, b) => a.rank - b.rank).slice(0, 65);
  }
  return best;
}
