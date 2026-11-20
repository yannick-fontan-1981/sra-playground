import { add, diff as sub, same as eq, type XY } from './access-terrain.ts';
import type { Role } from './exchange-roles.ts';
export type AxisPair = [string, string];
export type FramePose = {
  scene: number | string;
  index: number;
  role: Role;
  from: XY;
  anchors: Map<string, XY>;
};
export type FrameEffect = FramePose & { to: XY };
export type FrameModel = {
  family: string;
  axes: AxisPair;
  object: string | null;
  offset: XY;
  to: XY;
  score: number;
  refs: number[];
  distinct: number;
};
export function bases(examples: FrameEffect[], cur: FramePose): FrameModel[] {
  const frames: AxisPair[] = [
    ['self', 'self'],
    ['world', 'world'],
    ['self', 'world'],
    ['world', 'self'],
  ];
  for (const k of cur.anchors.keys())
    if (k !== 'self' && k !== 'world') frames.push([k, k], ['self', k], [k, 'self']);
  const best = new Map<string, FrameModel>();
  function origin(e: FramePose, axes: AxisPair): XY | null {
    const [x, y] = axes;
    return e.anchors.has(x) && e.anchors.has(y) ? [e.anchors.get(x)![0], e.anchors.get(y)![1]] : null;
  }
  for (const axes of frames) {
    const object = axes.find((x) => x !== 'self' && x !== 'world');
    const here = origin(cur, axes);
    if (!here) continue;
    const votes = new Map<string, { offset: XY; refs: { e: FrameEffect; ref: XY }[] }>();
    let seen = 0;
    for (const e of examples) {
      const ref = origin(e, axes);
      if (!ref) continue;
      seen++;
      if (eq(e.from, e.to)) continue;
      const offset = sub(e.to, ref),
        key = offset.join();
      if (!votes.has(key)) votes.set(key, { offset, refs: [] });
      votes.get(key)!.refs.push({ e, ref });
    }
    for (const { offset, refs } of votes.values()) {
      if (refs.length < 2) continue;
      const supported = refs.some(({ e, ref }) =>
        refs.some(({ e: f, ref: q }) => {
          if (e.scene === f.scene || (eq(e.from, f.from) && eq(ref, q))) return false;
          if (!object) return true;
          return axes.some(
            (axis, i) => axis === object && ref[i] !== q[i] && ref[i]! - q[i]! !== e.from[i]! - f.from[i]!
          );
        })
      );
      if (!supported) continue;
      const to = add(here, offset),
        distinct = new Set(refs.map(({ e, ref }) => e.from.join() + '/' + ref.join())).size;
      const score = ((refs.length + 1) / (seen + 2)) * Math.log2(1 + distinct);
      const family = object ? 'mechanism' : axes[0] === axes[1] ? axes[0] : 'mixed';
      const p = {
        family,
        axes,
        object: object ?? null,
        offset,
        to,
        score,
        refs: refs.map((x) => x.e.index),
        distinct,
      };
      if (!best.has(family) || score > best.get(family)!.score) best.set(family, p);
    }
  }
  return [...best.values()].sort((a, b) => b.score - a.score);
}
