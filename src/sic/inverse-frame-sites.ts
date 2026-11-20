import { add, diff, same, size, type XY } from './access-terrain.ts';
import { bases, type AxisPair, type FrameEffect, type FramePose } from './motion-frames.ts';
import type { NativeRows } from '../logos-engine/v6-native-types.ts';
import type { Groups, Role } from './exchange-roles.ts';
export type FrameUse = { op: string; to: XY; refs: number[]; score: number };
export type InversePlan = {
  i: number;
  root: number | string;
  role: Role;
  anchor: string;
  at: XY;
  from: XY;
  placement: XY;
  patient: XY;
  to: XY;
  direct: XY;
  goal: XY | null;
  solved: (number | null)[] | null;
  axes: AxisPair;
  offset: XY;
  a: string;
  q: string;
  length: number;
  refs: number[];
  actuatorRefs: number[];
  novel: boolean;
  key: string;
  score: number;
  follow: FrameUse | null;
};
type InverseInputs = {
  i: number;
  now: { s: string | number; g: Groups };
  rows: NativeRows;
  known: Map<string, Map<string, Role>>;
  history: Map<string, FrameEffect[]>;
  sample: (g: Groups, s: string | number, r: Role) => FramePose | null;
  tried: Set<string>;
};
const scale = (p: XY, k: number): XY => [k * p[0], k * p[1]];
export function stepsToReach(from: XY, stride: XY, goal: XY): number | null {
  let turns: number | null = null;
  for (const axis of [0, 1] as const) {
    const gap = goal[axis] - from[axis],
      step = stride[axis];
    if (step === 0) {
      if (gap !== 0) return null;
      continue;
    }
    const required = gap / step;
    if (!Number.isInteger(required) || required < 1 || (turns !== null && required !== turns)) return null;
    turns = required;
  }
  return turns;
}
function movement(samples: FrameEffect[]) {
  const bins = new Map<string, { delta: XY; refs: number[] }>();
  for (const e of samples) {
    if (same(e.from, e.to)) continue;
    const delta = diff(e.to, e.from),
      key = delta.join(),
      s = bins.get(key) ?? { delta, refs: [] };
    s.refs.push(e.index);
    bins.set(key, s);
  }
  return [...bins.values()].sort((a, b) => b.refs.length - a.refs.length || size(a.delta) - size(b.delta))[0];
}
export function inversePlans({ i, now, rows, known, history, sample, tried }: InverseInputs): InversePlan[] {
  const offers: InversePlan[] = [];
  for (const [q, pool] of known)
    for (const [id, role] of pool) {
      const cur = sample(now.g, now.s, role),
        h = history.get(q + '/' + id);
      if (!cur || !h || h.length < 2) continue;
      const mechanism = bases(h, cur).find((m) => m.object);
      if (!mechanism) continue;
      const m = mechanism,
        anchor = m.object!,
        at = cur.anchors.get(anchor);
      if (!at) continue;
      const anchorId = JSON.stringify([anchor, []]);
      for (const [a] of known) {
        const actuator = movement(history.get(a + '/' + anchorId) ?? []);
        if (!actuator) continue;
        const patientReadings = history.get(a + '/' + id) ?? [],
          pat = movement(patientReadings);
        const fixed = patientReadings.some((e) => same(e.from, e.to));
        const assumed: XY = pat && !fixed ? pat.delta : [0, 0];
        const lengths = new Set([1, 2, 3]);
        const step = (k: string, j: 0 | 1) =>
          k === anchor ? actuator.delta[j] : k === 'self' ? assumed[j] : 0;
        const stride: XY = [step(m.axes[0], 0), step(m.axes[1], 1)];
        for (const [sig, sites] of now.g) {
          if (sig === anchor || sig === role.signature || sites.size > 8) continue;
          for (const feature of sites.values()) {
            if (feature.area > (rows.length * rows[0]!.length) / 10) continue;
            const solved = stepsToReach(m.to, stride, [...feature.position]);
            if (solved !== null) lengths.add(solved);
          }
        }
        for (const length of lengths) {
          const placement = add(at, scale(actuator.delta, length)),
            patient = add(cur.from, scale(assumed, length));
          const axis = (k: string): XY => (k === anchor ? placement : k === 'self' ? patient : [0, 0]);
          const to: XY = [axis(m.axes[0])[0] + m.offset[0], axis(m.axes[1])[1] + m.offset[1]];
          const inside = (p: XY) => p[0] >= 0 && p[1] >= 0 && p[0] < rows[0]!.length && p[1] < rows.length;
          if (!inside(placement) || !inside(patient) || !inside(to) || same(to, m.to) || same(to, patient))
            continue;
          const key = JSON.stringify([now.s, q, a, role, placement, to]);
          if (tried.has(key)) continue;
          let goal: XY | null = null,
            gain = 0;
          for (const [sig, g] of now.g) {
            if (sig === anchor || sig === role.signature || g.size > 8) continue;
            for (const e of g.values()) {
              if (e.area > (rows.length * rows[0]!.length) / 10) continue;
              const d1 = size(diff([...e.position], m.to)),
                d2 = size(diff([...e.position], to));
              const improvement = (d1 - d2) / (1 + d2);
              if (improvement > gain) {
                gain = improvement;
                goal = [...e.position];
              }
            }
          }
          const solved = goal ? m.axes.map((k, j) => (k === anchor ? goal![j]! - m.offset[j]! : null)) : null;
          const novel = !h.some((e) => same(e.to, to));
          offers.push({
            i: i + 1,
            root: now.s,
            role,
            anchor,
            at,
            from: cur.from,
            placement,
            patient,
            to,
            direct: m.to,
            goal,
            solved,
            axes: m.axes,
            offset: m.offset,
            a,
            q,
            length,
            refs: m.refs,
            actuatorRefs: actuator.refs,
            follow: null,
            novel,
            key,
            score:
              Math.min(8, gain) +
              Number(novel) * 3 +
              Math.min(4, actuator.refs.length) -
              length * 0.7 +
              Number(a !== q),
          });
        }
      }
    }
  offers.sort((a, b) => b.score - a.score);
  const chosen = [],
    ends = new Set();
  for (const p of offers) {
    const target = JSON.stringify([p.q, p.role, p.to]);
    if (ends.has(target)) continue;
    ends.add(target);
    tried.add(p.key);
    chosen.push(p);
    if (chosen.length === 2) break;
  }
  for (const p of chosen) {
    const id = JSON.stringify([p.role.signature, p.role.fixed]),
      anchorId = JSON.stringify([p.anchor, []]);
    const cur = sample(now.g, now.s, p.role),
      anchors = new Map(cur!.anchors);
    const anchorShift = movement(history.get(p.q + '/' + anchorId) ?? []);
    anchors.set(p.anchor, add(p.placement, anchorShift?.delta ?? [0, 0]));
    anchors.set('self', p.to);
    const alternatives = [];
    for (const [s] of known) {
      const h = history.get(s + '/' + id) ?? [];
      if (h.length < 2) continue;
      const model = bases(h, { ...cur!, from: p.to, anchors })[0];
      if (!model || same(model.to, p.to)) continue;
      if (model.to.some((v, i) => v < 0 || v >= (i === 0 ? rows[0]!.length : rows.length))) continue;
      const gain = p.goal ? size(diff(p.to, p.goal)) - size(diff(model.to, p.goal)) : 0;
      alternatives.push({
        op: s,
        to: model.to,
        refs: model.refs,
        score: model.score + Math.max(-6, Math.min(6, gain)),
      });
    }
    alternatives.sort((a, b) => b.score - a.score);
    p.follow = alternatives[0] ?? null;
  }
  return chosen;
}
