import { add, diff, point, same, size, type XY } from './access-terrain.ts';
import prior from './projected-directions.json' with { type: 'json' };
import type { Edge } from './preparation-experiments.ts';

export type Layout = [XY, XY];
export type Roles = [string, string];
export type Sample = { before: Layout; after: Layout; ref: number };
type Formula = { source: number; offset: XY };
type Rule = { formula: Formula; dimension?: number; value?: number; yes?: Rule; no?: Rule };
export type Motion = {
  inferred?: boolean;
  op: string;
  rules: [Rule, Rule];
  samples: Sample[];
  refs: number[];
};
export const layoutId = (p: Layout) => p.join('|');
export const equalLayout = (a: Layout, b: Layout) => same(a[0], b[0]) && same(a[1], b[1]);
const dimensions = ([p, q]: Layout) => [p[0], p[1], q[0], q[1], p[0] - q[0], p[1] - q[1]];
const predict = (formula: Formula, pose: Layout) => add(pose[formula.source]!, formula.offset);

export function samplesFor(edges: Edge[], roles: Roles, available: Set<string>) {
  const samples = new Map<string, Sample[]>();
  for (const e of edges) {
    if (
      !e.stable ||
      !available.has(e.cmd) ||
      roles.some((id) => !e.anchors[id] || !e.visibleAfter?.includes(id))
    )
      continue;
    const before = roles.map((id) => point(e.anchors[id]!.at)) as Layout;
    const after = roles.map((id, i) => {
      const v = e.effect.moves.find((v) => v.actor === id);
      return v ? point(v.to) : before[i]!;
    }) as Layout;
    const list = samples.get(e.cmd) ?? [];
    list.push({ before, after, ref: e.ref });
    samples.set(e.cmd, list);
  }
  return samples;
}

function fit(samples: Sample[], role: number) {
  const forms = new Map<string, Formula>();
  function include(source: number, offset: XY) {
    forms.set([source, ...offset].join(), { source, offset });
  }
  include(role, [0, 0]);
  for (const s of samples) {
    include(role, diff(s.after[role]!, s.before[role]!));
    const other = 1 - role,
      offset = diff(s.after[role]!, s.before[other]!);
    // A second independent separation or a simultaneous exchange identifies the reference frame.
    if (
      !same(s.before[role]!, s.after[role]!) &&
      size(offset) < size(diff(s.after[role]!, s.before[role]!)) &&
      (same(s.after[other]!, add(s.before[role]!, [-offset[0], -offset[1]])) ||
        samples.some(
          (t) =>
            !same(diff(t.before[0], t.before[1]), diff(s.before[0], s.before[1])) &&
            same(diff(t.after[role]!, t.before[other]!), offset)
        ))
    )
      include(other, offset);
  }
  const ranked = [...forms.values()].sort(
    (a, b) => size(a.offset) - size(b.offset) || Number(b.source === role) - Number(a.source === role)
  );
  const dim = samples.map((s) => dimensions(s.before));
  const hits = ranked.map((f) => samples.map((s) => same(predict(f, s.before), s.after[role]!)));
  function best(indices: number[]) {
    let score = -1,
      formula = ranked[0]!;
    for (let i = 0; i < ranked.length; i++) {
      let n = 0;
      for (const j of indices) if (hits[i]![j]) n++;
      if (n > score) {
        score = n;
        formula = ranked[i]!;
      }
    }
    return { score, formula };
  }
  function tree(indices: number[], depth: number): Rule {
    const leaf = best(indices);
    if (depth === 0 || leaf.score === indices.length) return { formula: leaf.formula };
    let gain = 0,
      split: { d: number; v: number; y: number[]; n: number[] } | null = null;
    for (let d = 0; d < 6; d++) {
      const groups = new Map<number, number[]>();
      for (const i of indices) {
        const v = dim[i]![d]!;
        const g = groups.get(v) ?? [];
        g.push(i);
        groups.set(v, g);
      }
      for (const [v, y] of groups) {
        if (y.length < 2 || y.length === indices.length) continue;
        const n = indices.filter((i) => dim[i]![d] !== v);
        const diff = best(y).score + best(n).score - leaf.score;
        if (diff > gain) {
          gain = diff;
          split = { d, v, y, n };
        }
      }
    }
    return split
      ? {
          formula: leaf.formula,
          dimension: split.d,
          value: split.v,
          yes: tree(split.y, depth - 1),
          no: tree(split.n, depth - 1),
        }
      : { formula: leaf.formula };
  }
  return tree(
    samples.map((_, i) => i),
    2
  );
}

export function fitMotion(op: string, all: Sample[]): Motion {
  // Give each distinct measured transition one vote even if the explorer traversed a loop.
  const unique = new Map<string, Sample>();
  for (const s of all) unique.set(layoutId(s.before) + '>' + layoutId(s.after), s);
  const distinct = [...unique.values()];
  const samples =
    distinct.length <= 96
      ? distinct
      : distinct.filter(
          (_, i) => i >= distinct.length - 48 || i % Math.ceil((distinct.length - 48) / 48) === 0
        );
  return {
    op,
    samples,
    refs: samples.slice(-3).map((s) => s.ref),
    rules: [fit(samples, 0), fit(samples, 1)],
  };
}
export function projectedStep(model: Motion, pose: Layout): Layout {
  const values = dimensions(pose);
  return model.rules.map((root) => {
    let rule = root;
    while (rule.dimension !== undefined) rule = values[rule.dimension] === rule.value ? rule.yes! : rule.no!;
    return predict(rule.formula, pose);
  }) as Layout;
}

// Transfer the corpus orientation only after this role independently exhibited two
// compatible commands at the same scale. An observed exchange keeps its own formula.
export function spatialControls(traces: Map<string, Sample[]>, available: Set<string>) {
  const axes: Record<string, { axis: number[] }> = prior;
  const models: Motion[] = [];
  for (const op of available) {
    const samples = traces.get(op) ?? [];
    const model = fitMotion(op, samples);
    const axis = axes[op]?.axis;
    let supported = samples.some((s) => !equalLayout(s.before, s.after));
    for (const i of [0, 1]) {
      if (
        !axis ||
        samples.some((s) => !same(s.before[i]!, s.after[i]!)) ||
        new Set(samples.map((s) => s.before[i]!.join())).size >= 3
      )
        continue;
      const scales = new Map<number, Map<string, number>>();
      for (const [other, list] of traces) {
        const dir = axes[other]?.axis;
        if (!dir || other === op) continue;
        for (const s of list) {
          const d = diff(s.after[i]!, s.before[i]!),
            n = size(d);
          if (n && d[0] === dir[0]! * n && d[1] === dir[1]! * n) {
            const witnesses = scales.get(n) ?? new Map<string, number>();
            witnesses.set(other, s.ref);
            scales.set(n, witnesses);
          }
        }
      }
      const ordered = [...scales].sort((a, b) => b[1].size - a[1].size);
      const best = ordered[0];
      if (!best || best[1].size < 2 || ordered[1]?.[1].size === best[1].size) continue;
      model.rules[i] = { formula: { source: i, offset: [axis[0]! * best[0], axis[1]! * best[0]] } };
      model.inferred = true;
      model.refs.push(...best[1].values());
      supported = true;
    }
    if (supported) models.push(model);
  }
  return models;
}
