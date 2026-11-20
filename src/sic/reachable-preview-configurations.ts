import { add, diff, same, size, type XY } from './access-terrain.ts';

export type ProbePattern = { actor: XY; centre: XY; indicator: XY; ref: number };
export type GroundStroke = { op: string; d: XY; ref: number };
export type LayoutStep = {
  op: string;
  stage: 'move' | 'write' | 'read' | 'use';
  p: XY;
  c: XY;
  to: XY;
  placed: XY;
};
export type ReachablePreview = {
  placed: XY;
  launch: XY;
  arrival: XY;
  continuation: XY | null;
  source: 'translated_witness' | 'fitted_symmetry' | 'projected_same_ray';
  witness: number;
  transform: number | null;
  steps: LayoutStep[];
  gain: number;
};
type Input = {
  actor: XY;
  centre: XY;
  motors: GroundStroke[];
  op: string;
  patterns: ProbePattern[];
  passable: (p: XY) => boolean;
  otherCentres: XY[];
  baselineRead?: XY;
  readWitnessed: boolean;
  useCurrent?: boolean;
  extendRay?: boolean;
  allowWrites: boolean;
  stateLimit: number;
  attempted?: (s: LayoutStep) => boolean;
};
function transform(p: XY, i: number): XY {
  const [x, y] = p;
  const values: XY[] = [
    [x, y],
    [-x, y],
    [x, -y],
    [-x, -y],
    [y, x],
    [-y, x],
    [y, -x],
    [-y, -x],
  ];
  return values[i]!;
}
function ray(p: XY): string {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a || 1);
  const n = gcd(Math.abs(p[0]), Math.abs(p[1]));
  return [p[0] / n, p[1] / n].join();
}
// A relative layout observed at one centre can be translated to another centre.
// Extending it to an unobserved distance needs an independently fitted transformation.
export function previewLaw(examples: ProbePattern[], extendRay = false) {
  const measured = new Map<string, { offset: XY; ref: number } | null>();
  for (const e of examples) {
    const key = diff(e.actor, e.centre).join(),
      offset = diff(e.indicator, e.centre),
      old = measured.get(key);
    if (old === undefined) measured.set(key, { offset, ref: e.ref });
    else if (old && !same(old.offset, offset)) measured.set(key, null);
  }
  const valid = examples.filter((e) => measured.get(diff(e.actor, e.centre).join()));
  const rays = new Set(valid.map((e) => ray(diff(e.actor, e.centre))));
  const varies = new Set(valid.map((e) => diff(e.indicator, e.actor).join())).size >= 2;
  const transforms =
    varies && measured.size >= 2
      ? [1, 2, 3, 4, 5, 6, 7].filter((i) =>
          valid.every((e) => same(transform(diff(e.actor, e.centre), i), diff(e.indicator, e.centre)))
        )
      : [];
  return (p: XY, c: XY) => {
    const relative = diff(p, c),
      observed = measured.get(relative.join());
    if (observed)
      return [
        {
          at: add(c, observed.offset),
          source: 'translated_witness' as const,
          ref: observed.ref,
          transform: null,
        },
      ];
    if (observed === null || !rays.has(ray(relative))) return [];
    if (extendRay && !transforms.length) {
      const proposals = new Map<
        string,
        { at: XY; source: 'projected_same_ray'; ref: number; transform: null }
      >();
      for (const v of valid) {
        const from = diff(v.actor, v.centre);
        if (ray(from) !== ray(relative) || !size(from)) continue;
        const u = diff(v.indicator, v.centre),
          ratio = size(relative) / size(from),
          dx = u[0] * ratio,
          dy = u[1] * ratio;
        if (!Number.isInteger(dx) || !Number.isInteger(dy)) continue;
        const at = add(c, [dx, dy]);
        proposals.set(at.join(), { at, source: 'projected_same_ray', ref: v.ref, transform: null });
      }
      if (proposals.size === 1) return [...proposals.values()];
    }
    const sites = new Map<string, { at: XY; source: 'fitted_symmetry'; ref: number; transform: number }>();
    for (const i of transforms) {
      const at = add(c, transform(relative, i));
      sites.set(at.join(), { at, source: 'fitted_symmetry', ref: valid[0]!.ref, transform: i });
    }
    return [...sites.values()];
  };
}
export function reachablePreviewConfigurations(input: Input) {
  const { actor, centre, motors, otherCentres, op } = input;
  const blocked = new Set(otherCentres.map((p) => p.join())),
    open = (p: XY) => !blocked.has(p.join()) && input.passable(p);
  const predict = previewLaw(input.patterns, input.extendRay),
    home = new Set([actor.join()]),
    initial = [actor];
  for (const p of initial) {
    const moves = motors.map((s) => add(p, s.d));
    if (input.readWitnessed && !input.useCurrent)
      for (const forecast of predict(p, centre)) moves.push(forecast.at);
    for (const v of moves)
      if (!same(v, centre) && open(v) && !home.has(v.join())) {
        home.add(v.join());
        initial.push(v);
      }
    if (initial.length > input.stateLimit)
      return { configurations: [] as ReachablePreview[], home, complete: false };
  }
  type Node = { p: XY; c: XY; parent: number; step: LayoutStep | null; writes: number };
  const nodes: Node[] = [{ p: actor, c: centre, parent: -1, step: null, writes: 0 }],
    seen = new Set([actor.join() + '/' + centre.join()]);
  const layouts = new Map<string, ReachablePreview>();
  let complete = true;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    if (node.writes || input.useCurrent) {
      for (const projected of predict(node.p, node.c)) {
        const at = projected.at;
        if (
          home.has(at.join()) ||
          same(at, node.p) ||
          same(at, node.c) ||
          !open(at) ||
          (input.baselineRead && same(at, add(node.p, input.baselineRead)))
        )
          continue;
        const key = [node.c, node.p, at].map((x) => x.join()).join('/');
        if (layouts.has(key)) continue;
        const path: LayoutStep[] = [];
        let k = i;
        while (k >= 0) {
          const n = nodes[k]!;
          if (n.step) path.push(n.step);
          k = n.parent;
        }
        path.reverse();
        const read: LayoutStep = { op, stage: 'read', p: node.p, c: node.c, to: at, placed: node.c };
        if (input.attempted?.(read)) continue;
        path.push(read);
        const exits = motors
          .map((s) => ({ s, at: add(at, s.d) }))
          .filter((v) => open(v.at) && !same(v.at, node.c) && !home.has(v.at.join()));
        const use = exits[0];
        if (use) path.push({ op: use.s.op, stage: 'use', p: at, c: node.c, to: use.at, placed: node.c });
        layouts.set(key, {
          placed: node.c,
          launch: node.p,
          arrival: at,
          continuation: use?.at ?? null,
          source: projected.source,
          witness: projected.ref,
          transform: projected.transform,
          steps: path,
          gain: 1 + new Set(exits.map((e) => e.at.join())).size,
        });
      }
    }
    for (const s of motors) {
      const dest = add(node.p, s.d),
        write = same(dest, node.c),
        newC = write ? add(node.c, s.d) : node.c;
      if (!size(s.d) || !open(dest) || (write && (!input.allowWrites || !open(newC)))) continue;
      const key = dest.join() + '/' + newC.join();
      if (seen.has(key)) continue;
      const step: LayoutStep = {
        op: s.op,
        stage: write ? 'write' : 'move',
        p: node.p,
        c: node.c,
        to: dest,
        placed: newC,
      };
      if (input.attempted?.(step)) continue;
      if (nodes.length >= input.stateLimit) {
        complete = false;
        continue;
      }
      seen.add(key);
      nodes.push({ p: dest, c: newC, parent: i, step, writes: node.writes + Number(write) });
    }
  }
  const configurations = [...layouts.values()].sort(
    (a, b) => a.steps.length - b.steps.length || b.gain - a.gain
  );
  return { configurations, home, complete };
}
