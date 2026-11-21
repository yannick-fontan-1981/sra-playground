import type { NativeRows } from '../logos-engine/v6-native-types.ts';
import {
  maintained,
  other,
  readCoverage,
  type Coverage,
  type PieceRelation,
} from './controlled-coverage.ts';
import {
  neighbor,
  poseId,
  sitePoint,
  type TransportForecast,
  type TransportState,
  type TransportStep,
} from './transport-observations.ts';
type Law = { kind: 'push' | 'pull' | 'range'; radius: number };
function affects(law: Law, x: number, y: number, dx: number, dy: number) {
  if (law.kind === 'push') return x === dx && y === dy;
  if (law.kind === 'pull') return x === -dx && y === -dy;
  return Math.max(Math.abs(x), Math.abs(y)) <= law.radius;
}
export function inferPieceLaw(samples: PieceRelation[]): Law {
  const laws: Law[] = [
    { kind: 'push', radius: 1 },
    { kind: 'pull', radius: 1 },
  ];
  const positives = samples.filter((o) => o.moved);
  for (const n of [
    ...new Set(positives.map((o) => Math.max(Math.abs(o.x), Math.abs(o.y)))),
  ].sort((a, b) => a - b))
    laws.push({ kind: 'range', radius: n });
  const errors = (l: Law) =>
    samples.reduce(
      (n, o) => n + Number(affects(l, o.x, o.y, o.dx, o.dy) !== o.moved),
      0,
    );
  return laws.sort((a, b) => errors(a) - errors(b))[0]!;
}
const dirKey = (x: number, y: number) => x + ',' + y;
const cardinal = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
] as const;
type Node = {
  s: TransportState;
  cost: number;
  rank: number;
  prev?: Node;
  command?: string;
};
function route(n: Node) {
  const path: TransportStep[] = [];
  while (n.prev) {
    path.push({ command: n.command!, state: n.prev.s, after: n.s });
    n = n.prev;
  }
  return path.reverse();
}
function queueByRank(q: Node[], n: Node) {
  let low = 0,
    high = q.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (q[mid]!.rank > n.rank) low = mid + 1;
    else high = mid;
  }
  q.splice(low, 0, n);
}
export function proposeCoverage(
  c: Coverage,
  rows: NativeRows,
  available: readonly string[],
  depth: number,
  limit: number,
): TransportForecast | undefined {
  if (!c.discovery) return;
  const initial = readCoverage(c, rows);
  if (!initial) return;
  const g = c.grid,
    ground = new Set(c.terrain),
    laws = c.observations.map(inferPieceLaw);
  const lawId = laws.map((l) => l.kind + l.radius).join('/');
  const key = (s: TransportState, op: string) =>
    lawId + '/' + poseId(s) + '/' + op;
  const md = (a: number, b: number) =>
    Math.abs((a % g.columns) - (b % g.columns)) +
    Math.abs(Math.floor(a / g.columns) - Math.floor(b / g.columns));
  const costToMarks = (sites: number[], marks: number[]) =>
    Math.min(
      md(sites[0]!, marks[0]!) + md(sites[1]!, marks[1]!),
      md(sites[0]!, marks[1]!) + md(sites[1]!, marks[0]!),
    );
  const select = (s: TransportState) =>
    'ACTION6:' + sitePoint(g, s.subjects[other(s.active)]).join(',');
  const evidence = [
    c.selection,
    c.discovery,
    ...c.observations.flatMap((z) =>
      z
        .filter((o) => o.moved)
        .slice(0, 2)
        .map((o) => o.ref),
    ),
    ...Object.values(c.motors).map((o) => o.ref),
    ...(c.opening ? [c.opening] : []),
  ];
  const describe = (s: TransportStep, purpose: string): TransportForecast => ({
    purpose,
    from: s.state,
    expected: s.after,
    command: s.command,
    key: key(s.state, s.command),
    target: [...c.controls, ...c.goals],
    evidence: [...new Set(evidence)],
    open: [
      ...(!c.opening ? ['covering_the_controls_keeps_the_passage_open'] : []),
      ...laws.flatMap((l, i) =>
        c.observations[i]!.some((o) => o.moved)
          ? []
          : ['test_' + l.kind + '_with_the_other_subject'],
      ),
    ],
    coverage: {
      controls: c.controls,
      gate: c.gate,
      goals: c.goals,
      laws: laws.map((l) => ({ ...l })),
      openBefore: maintained(c, s.state),
      openAfter: maintained(c, s.after),
    },
  });
  function transitions(s: TransportState): TransportStep[] {
    const active = s.active,
      from = s.subjects[active],
      parked = s.subjects[other(active)],
      result: TransportStep[] = [];
    for (const [op, { dx, dy }] of Object.entries(c.motors)) {
      if (c.denied[key(s, op)]) continue;
      const to = neighbor(g, from, dx, dy);
      if (
        to === parked ||
        (!ground.has(to) && !(to === c.gate && maintained(c, s)))
      )
        continue;
      const displaced = s.pieces
        .map((p) => {
          const x = (p % g.columns) - (from % g.columns),
            y = Math.floor(p / g.columns) - Math.floor(from / g.columns);
          const dest = neighbor(g, p, dx, dy);
          return affects(laws[active]!, x, y, dx, dy) &&
            ground.has(dest) &&
            dest !== parked &&
            !s.pieces.includes(dest)
            ? dest
            : p;
        })
        .sort((a, b) => a - b);
      if (displaced.includes(to)) continue;
      const subjects: [number, number] = [...s.subjects];
      subjects[active] = to;
      result.push({
        state: s,
        command: op,
        after: { ...s, subjects, pieces: displaced },
      });
    }
    const op = select(s);
    if (available.includes('ACTION6') && !c.denied[key(s, op)])
      result.push({
        state: s,
        command: op,
        after: { ...s, active: other(active) },
      });
    return result;
  }
  const cached = c.plan?.[0];
  if (
    cached &&
    poseId(initial) === poseId(cached.state) &&
    !c.denied[key(initial, cached.command)]
  )
    return describe(cached, 'compose_subject_and_piece_placements');
  delete c.plan;
  const known = new Set(Object.values(c.motors).map((m) => dirKey(m.dx, m.dy)));
  const missing = available.filter(
    (op) => /^ACTION[1-4]$/.test(op) && !c.motors[op],
  );
  if (missing.length) {
    // To calibrate, reach a site with room along an unmeasured axis; the verifying motor remains an experiment.
    const first: Node = { s: initial, cost: 0, rank: 0 },
      q = [first],
      seen = new Set([poseId(initial)]);
    for (let i = 0; i < q.length && i < limit; i++) {
      const n = q[i]!,
        s = n.s,
        p = s.subjects[s.active];
      const canTest = cardinal.some(([dx, dy]) => {
        const to = neighbor(g, p, dx, dy);
        return (
          !known.has(dirKey(dx, dy)) &&
          ground.has(to) &&
          !s.subjects.includes(to) &&
          !s.pieces.includes(to)
        );
      });
      const op = canTest && missing.find((k) => !c.tried[poseId(s) + '/' + k]);
      if (op) {
        const path = route(n);
        return path.length
          ? describe(path[0]!, 'reach_a_site_for_motor_calibration')
          : describe(
              { state: s, command: op, after: s },
              'measure_direction_for_coverage',
            );
      }
      if (n.cost >= depth) continue;
      for (const step of transitions(s)) {
        const k = poseId(step.after);
        if (seen.size >= limit || seen.has(k)) continue;
        seen.add(k);
        q.push({
          s: step.after,
          cost: n.cost + 1,
          rank: 0,
          prev: n,
          command: step.command,
        });
      }
    }
  }
  const rank = (s: TransportState) => {
    const pieces = costToMarks(s.pieces, c.controls),
      arrivals = costToMarks(s.subjects, c.goals);
    if (pieces === 0) return arrivals;
    const free = s.pieces.filter((p) => !c.controls.includes(p));
    return (
      c.terrain.length +
      3 * pieces +
      Math.min(...free.map((p) => md(s.subjects[s.active], p))) / 3
    );
  };
  const first: Node = { s: initial, cost: 0, rank: rank(initial) },
    q: Node[] = [first],
    cost = new Map([[poseId(initial), 0]]);
  let best = first,
    bestValue = rank(initial),
    examined = 0;
  while (q.length && examined++ < limit) {
    const n = q.pop()!;
    if (cost.get(poseId(n.s)) !== n.cost) continue;
    if (costToMarks(n.s.subjects, c.goals) === 0) {
      best = n;
      break;
    }
    if (n.cost >= depth) continue;
    for (const step of transitions(n.s)) {
      const k = poseId(step.after),
        g = n.cost + 1;
      if (
        g >= (cost.get(k) ?? Infinity) ||
        (!cost.has(k) && cost.size >= limit)
      )
        continue;
      cost.set(k, g);
      const h = rank(step.after),
        child = {
          s: step.after,
          cost: g,
          rank: g + 5 * h,
          prev: n,
          command: step.command,
        };
      if (h < bestValue) {
        best = child;
        bestValue = h;
      }
      queueByRank(q, child);
    }
  }
  const plan = route(best);
  if (!plan.length) return;
  c.plan = plan;
  return describe(plan[0]!, 'compose_subject_and_piece_placements');
}
