import prior from './contact-aspiration-prior.json' with { type: 'json' };
import type { NativeEntity } from '../logos-engine/v6-native-types.ts';
import { add, point, size, type XY } from './access-terrain.ts';
import { layoutId, type Layout, type Motion } from './projected-motion.ts';

type Aim = {
  role: number;
  target: NativeEntity;
  estimate: number;
  best: number;
  stride: number;
  transfers: XY[];
};
function contactEvidence(body: NativeEntity, f: NativeEntity) {
  const width = f.bbox[2] - f.bbox[0] + 1,
    height = f.bbox[3] - f.bbox[1] + 1;
  const tags: (keyof typeof prior.movement.features)[] = ['contact', 'centered'];
  if (!f.identity_ambiguous) tags.push('unique');
  if (f.area / (width * height) < 0.75) tags.push('openShape');
  if (f.area >= body.area / 2 && f.area <= body.area * 2) tags.push('similarArea');
  if (width === body.bbox[2] - body.bbox[0] + 1 && height === body.bbox[3] - body.bbox[1] + 1)
    tags.push('sameExtent');
  if (width === height) tags.push('square');
  // The predicates overlap. Average the game-balanced evidence instead of multiplying it.
  return (
    tags.reduce((total, tag) => {
      const { wins, expected } = prior.movement.features[tag];
      return total + Math.log((wins + 1) / (expected + 1));
    }, 0) / tags.length
  );
}

export function contactAspirations(
  bodies: [NativeEntity, NativeEntity],
  features: NativeEntity[],
  models: Motion[],
  reached: Set<string>[],
  initial: Layout
) {
  const aims: Aim[] = [];
  const targetOrigin = (role: number, f: NativeEntity): XY => {
    const body = bodies[role]!;
    return [
      (f.bbox[0] + f.bbox[2] - body.bbox[2] + body.bbox[0]) / 2,
      (f.bbox[1] + f.bbox[3] - body.bbox[3] + body.bbox[1]) / 2,
    ];
  };
  const gap = (p: XY, q: XY) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]);
  for (const role of [0, 1]) {
    const transforms = models.map((m) => m.rules[role]!.formula);
    const own = transforms
      .filter((f) => f.source === role && size(f.offset) > 0)
      .map((f) => size(f.offset))
      .sort((a, b) => a - b);
    if (!own.length && !transforms.some((f) => f.source !== role)) continue;
    const stride = own[0] ?? 1,
      positions = [initial[role]!, ...[...reached[role]!].map(point)];
    const targets = features
      .map((f) => {
        const dest = targetOrigin(role, f),
          best = Math.min(...positions.map((p) => gap(p, dest))) / stride;
        return {
          role,
          target: f,
          estimate: contactEvidence(bodies[role]!, f),
          best,
          stride,
          transfers: transforms.filter((t) => t.source !== role).map((t) => t.offset),
        };
      })
      .filter((t) => t.best > 0.5)
      .sort((a, b) => b.estimate - a.estimate || a.best - b.best);
    // Keep disparate sites so a repeated texture cannot monopolize the entire search.
    const selected: Aim[] = [];
    for (const aim of targets) {
      const p = targetOrigin(role, aim.target);
      if (selected.some((t) => gap(p, targetOrigin(role, t.target)) < stride * 2)) continue;
      selected.push(aim);
      if (selected.length === 5) break;
    }
    aims.push(...selected);
  }
  const cache = new Map<string, { dist: number[]; reward: number }>();
  return (layout: Layout) => {
    const id = layoutId(layout),
      hit = cache.get(id);
    if (hit) return hit;
    let reward = 0;
    const dist = aims.map((aim) => {
      const dest = targetOrigin(aim.role, aim.target),
        d = gap(layout[aim.role]!, dest) / aim.stride;
      const via = Math.min(
        d,
        ...aim.transfers.map((offset) => 1 + gap(add(layout[1 - aim.role]!, offset), dest) / aim.stride)
      );
      const weight = Math.exp(aim.estimate);
      const advance = Math.max(0, aim.best - d);
      const atGoal = d < 0.51;
      reward = Math.max(
        reward,
        weight * (Math.min(15, advance) * 2 + (atGoal ? 36 : 0)) + Math.min(10, Math.max(0, aim.best - via))
      );
      return via;
    });
    const estimate = { dist, reward };
    cache.set(id, estimate);
    return estimate;
  };
}

export function allocateHorizon<T extends { p: Layout; uncertainty: number }>(
  nodes: T[],
  estimate: (p: Layout) => { dist: number[]; reward: number },
  limit: number
) {
  if (nodes.length <= limit) return nodes;
  const ranked = nodes.map((n) => ({ n, e: estimate(n.p) }));
  const selected = new Set<T>();
  const lanes = ranked[0]!.e.dist.length;
  for (let i = 0; i < lanes; i++) {
    ranked.sort((a, b) => a.e.dist[i]! + a.n.uncertainty / 4 - (b.e.dist[i]! + b.n.uncertainty / 4));
    for (const v of ranked.slice(0, Math.floor(limit / (lanes + 2)))) selected.add(v.n);
  }
  ranked.sort((a, b) => b.e.reward - b.n.uncertainty - (a.e.reward - a.n.uncertainty));
  for (const v of ranked) {
    if (selected.size >= limit) break;
    selected.add(v.n);
  }
  return [...selected];
}
