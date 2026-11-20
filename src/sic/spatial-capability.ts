import type { XY } from './access-terrain.ts';

export type SpatialLayout = { actor: XY; objects: Record<string, XY> };
type Example = { layout: SpatialLayout; outcome: boolean };
export type ReferenceScope = 'pair' | 'board' | 'landmarks';
type Coordinate = { from: string | null; to: string | null; axis: 0 | 1 };
type Bound = Coordinate & { low: number | null; high: number | null };
export type SpatialCapability = {
  rules: Bound[];
  positives: number;
  negatives: number;
  sensitivity: number;
  specificity: number;
};

function coordinate(layout: SpatialLayout, c: Coordinate) {
  const from = c.from === null ? layout.actor : layout.objects[c.from];
  const to = c.to === null ? [0, 0] : layout.objects[c.to];
  return from && to ? from[c.axis] - to[c.axis]! : undefined;
}
function inside(value: number, low: number | null, high: number | null) {
  return (low === null || value >= low) && (high === null || value <= high);
}

/** At most two simultaneous spatial constraints. Each positive must be predictable from the other
 * positives to count toward sensitivity. The negative class prevents an always-open explanation. */
export function fitSpatialCapability(
  samples: Example[],
  primary: string[],
  scope: ReferenceScope
): SpatialCapability | null {
  const yes = samples.filter((s) => s.outcome),
    no = samples.filter((s) => !s.outcome);
  if (yes.length < 2 || no.length < 2) return null;
  const axes: Coordinate[] = [];
  function add(from: string | null, to: string | null) {
    for (const axis of [0, 1] as const) axes.push({ from, to, axis });
  }
  for (const peer of primary) add(null, peer);
  if (scope !== 'pair') for (const role of [null, ...primary]) add(role, null);
  if (scope === 'landmarks') {
    const first = yes[0]!.layout;
    const distance = (id: string) =>
      Math.abs(first.objects[id]![0] - first.actor[0]) + Math.abs(first.objects[id]![1] - first.actor[1]);
    const others = Object.keys(first.objects)
      .filter((id) => !primary.includes(id) && samples.every((s) => s.layout.objects[id]))
      .sort((a, b) => distance(a) - distance(b) || a.localeCompare(b, 'en'));
    for (const id of others.slice(0, 12)) for (const role of [null, ...primary]) add(role, id);
  }
  type Candidate = { rule: Bound; positive: boolean[]; negative: boolean[] };
  const candidates: Candidate[] = [];
  for (const axis of axes) {
    const ys = yes.map((s) => coordinate(s.layout, axis)),
      ns = no.map((s) => coordinate(s.layout, axis));
    if (ys.some((v) => v === undefined) || ns.some((v) => v === undefined)) continue;
    const vals = ys as number[],
      negatives = ns as number[];
    const sorted = vals.slice().sort((a, b) => a - b),
      low = sorted[0]!,
      high = sorted.at(-1)!;
    for (const [lower, upper] of [
      [true, false],
      [false, true],
      [true, true],
    ]) {
      const rule = { ...axis, low: lower ? low : null, high: upper ? high : null };
      const negative = negatives.map((v) => !inside(v, rule.low, rule.high));
      if (!negative.some(Boolean)) continue;
      const positive = vals.map((v) =>
        inside(
          v,
          lower ? (v === low ? sorted[1]! : low) : null,
          upper ? (v === high ? sorted.at(-2)! : high) : null
        )
      );
      if (!positive.some(Boolean)) continue;
      candidates.push({ rule, positive, negative });
    }
  }
  let best: SpatialCapability | null = null,
    bestScore = 1;
  function evaluate(a: Candidate, b?: Candidate) {
    const sensitivity =
      a.positive.reduce((n, v, i) => n + Number(v && (!b || b.positive[i])), 0) / yes.length;
    const specificity = a.negative.reduce((n, v, i) => n + Number(v || !!b?.negative[i]), 0) / no.length;
    const score = sensitivity + specificity;
    if (sensitivity < 0.5 || specificity < 0.5 || score <= bestScore + 1e-9) return;
    bestScore = score;
    best = {
      rules: b ? [a.rule, b.rule] : [a.rule],
      positives: yes.length,
      negatives: no.length,
      sensitivity,
      specificity,
    };
  }
  for (const a of candidates) evaluate(a);
  if (bestScore < 2)
    for (let i = 0; i < candidates.length; i++)
      for (let j = i + 1; j < candidates.length; j++) {
        evaluate(candidates[i]!, candidates[j]!);
        if (bestScore === 2) return best;
      }
  return best;
}

export function predictSpatialCapability(
  model: SpatialCapability | null,
  layout: SpatialLayout
): boolean | null {
  if (!model) return null;
  let unknown = false;
  for (const rule of model.rules) {
    const value = coordinate(layout, rule);
    if (value === undefined) unknown = true;
    else if (!inside(value, rule.low, rule.high)) return false;
  }
  return unknown ? null : true;
}
