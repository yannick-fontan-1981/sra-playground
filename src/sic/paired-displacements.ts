import {
  neighbor,
  poseId,
  sitePoint,
  type TransportSide,
  type TransportState,
  type TransportForecast,
} from './transport-observations.ts';
import { pointCommand, type Scene, type Reading } from './paired-scene.ts';
export type Law = 'walk' | 'push' | 'pull' | 'field' | 'exchange';
export const alternatives: Law[] = [
  'walk',
  'push',
  'pull',
  'field',
  'exchange',
];
export type Bearing = { dx: number; dy: number; ref: string };
export type Learning = {
  motors: Record<string, Bearing>;
  evidence: [Partial<Record<Law, number>>, Partial<Record<Law, number>>];
  refs: string[];
  radius: number;
  scope?: string;
  denied: Record<string, number>;
  visits: Record<string, number>;
  special?: { mark: string; ref: string };
  checked: string[];
  carry?: string;
  plan?: { from: string; command: string; expected: Reading }[];
};
export function fresh(): Learning {
  return {
    motors: {},
    evidence: [{}, {}],
    refs: [],
    radius: 0,
    denied: {},
    visits: {},
    checked: [],
  };
}
export const peer = (s: TransportSide): TransportSide => (s === 0 ? 1 : 0);
export const md = (s: Scene, a: number, b: number) =>
  Math.abs((a % s.grid.columns) - (b % s.grid.columns)) +
  Math.abs(Math.floor(a / s.grid.columns) - Math.floor(b / s.grid.columns));
export const key = (v: Reading) => poseId(v) + '/' + v.anchor;
export function law(m: Learning, side: TransportSide): Law {
  const defaults: Law[] =
    side === 1 && m.scope
      ? ['field', 'exchange', 'walk', 'push', 'pull']
      : ['push', 'pull', 'exchange', 'walk', 'field'];
  return defaults.reduce((a, b) =>
    (m.evidence[side][b] ?? 0) > (m.evidence[side][a] ?? 0) ? b : a,
  );
}
export function geometry(s: Scene) {
  const ground = new Set(s.ground),
    medium = new Set(s.medium),
    doors = new Map(s.doors.map((d) => [d.site, d]));
  const at = (p: number, dx: number, dy: number) => neighbor(s.grid, p, dx, dy);
  function open(v: TransportState, p: number) {
    const door = doors.get(p);
    return (
      !door ||
      door.controls.every((x) => v.pieces.includes(x) || v.subjects.includes(x))
    );
  }
  const walk = (v: TransportState, p: number) =>
    (ground.has(p) && open(v, p)) || v.supports.includes(p);
  return { ground, medium, doors, at, open, walk };
}
type Space = ReturnType<typeof geometry>;
export function imagine(
  s: Scene,
  space: Space,
  v: Reading,
  op: string,
  m: Learning,
  h: Law,
): Reading | undefined {
  const side = v.active,
    other = peer(side),
    a = v.subjects[side],
    b = v.subjects[other];
  const n: Reading = {
    ...v,
    subjects: [...v.subjects],
    pieces: [...v.pieces],
    supports: [...v.supports],
    opened: [],
  };
  if (op === 'select') {
    n.active = other;
    return n;
  }
  if (op === 'ACTION5') {
    if (v.anchor < 0 || !m.special) return;
    const options = [...v.pieces, ...v.subjects]
      .filter((x) => x !== v.anchor)
      .sort((p, q) => md(s, p, v.anchor) - md(s, q, v.anchor));
    if (!options.length) return;
    const t = options[0]!,
      idx = n.pieces.indexOf(t),
      si = n.subjects.indexOf(t);
    if (idx >= 0) n.pieces[idx] = v.anchor;
    else if (si >= 0) n.subjects[si] = v.anchor;
    n.anchor = t;
    n.pieces.sort((a, b) => a - b);
    return n;
  }
  const motor = m.motors[op];
  if (!motor) return;
  const { dx, dy } = motor,
    at = (p: number) => space.at(p, dx, dy),
    target = at(a);
  function place(from: number, to: number) {
    const i = n.pieces.indexOf(from);
    if (i < 0) return;
    if (space.medium.has(to) && !n.supports.includes(to)) {
      n.pieces.splice(i, 1);
      n.supports.push(to);
    } else n.pieces[i] = to;
  }
  const freePiece = (to: number) =>
    to >= 0 &&
    (space.walk(v, to) || space.medium.has(to)) &&
    !n.pieces.includes(to) &&
    !n.subjects.includes(to);
  if (h === 'exchange') {
    let z = target;
    while (z >= 0 && !v.pieces.includes(z) && z !== b) z = at(z);
    if (z >= 0 && (v.pieces.includes(z) || z === b)) {
      if (z === b) n.subjects[other] = a;
      else n.pieces[n.pieces.indexOf(z)] = a;
      n.subjects[side] = z;
    }
  }
  if (n.subjects[side] === a) {
    if (h === 'field') {
      const r = m.radius || 1;
      const near = (p: number) =>
        Math.max(
          Math.abs((a % s.grid.columns) - (p % s.grid.columns)),
          Math.abs(
            Math.floor(a / s.grid.columns) - Math.floor(p / s.grid.columns),
          ),
        ) <= r;
      const movers = v.pieces.filter(near).map((p) => ({ p, kind: 'piece' }));
      if (near(b)) movers.push({ p: b, kind: 'peer' });
      movers.push({ p: a, kind: 'actor' });
      movers.sort(
        (u, w) =>
          ((w.p % s.grid.columns) - (u.p % s.grid.columns)) * dx +
          (Math.floor(w.p / s.grid.columns) -
            Math.floor(u.p / s.grid.columns)) *
            dy,
      );
      for (const { p, kind } of movers) {
        const to = at(p);
        if (kind === 'piece') {
          if (freePiece(to)) place(p, to);
        } else if (
          space.walk(v, to) &&
          !n.pieces.includes(to) &&
          !n.subjects.includes(to)
        )
          n.subjects[kind === 'actor' ? side : other] = to;
      }
    } else {
      if (!space.walk(v, target)) return;
      if (h === 'push' && (v.pieces.includes(target) || target === b)) {
        let last = target;
        const line: number[] = [];
        while (last >= 0 && (n.pieces.includes(last) || last === b)) {
          line.push(last);
          last = at(last);
        }
        if (!freePiece(last)) return;
        for (const p of line.reverse()) {
          if (p === b) {
            if (!space.walk(v, at(p))) return;
            n.subjects[other] = at(p);
          } else place(p, at(p));
        }
      }
      if (n.pieces.includes(target) || n.subjects[other] === target) return;
      n.subjects[side] = target;
      if (h === 'pull') {
        const behind = space.at(a, -dx, -dy);
        if (v.pieces.includes(behind)) place(behind, a);
        else if (behind === b) n.subjects[other] = a;
      }
    }
  }
  n.pieces.sort((u, w) => u - w);
  n.supports.sort((u, w) => u - w);
  n.opened = s.doors.filter((d) => space.open(n, d.site)).map((d) => d.site);
  return key(n) === key(v) ? undefined : n;
}
export function localEffects(
  s: Scene,
  m: Learning,
  b: Reading,
  a: Reading,
  op: string,
  ref: string,
  f?: TransportForecast,
) {
  const side = b.active,
    from = b.subjects[side],
    to = a.subjects[side],
    w = s.grid.columns;
  if (/^ACTION[1-4]$/.test(op)) {
    const dx = (to % w) - (from % w),
      dy = Math.floor(to / w) - Math.floor(from / w);
    if ((dx === 0) !== (dy === 0))
      m.motors[op] = { dx: Math.sign(dx), dy: Math.sign(dy), ref };
    const space = geometry(s),
      pred = alternatives.map((h) => {
        const next = imagine(s, space, b, op, m, h) ?? b;
        return poseId(next) === poseId(a);
      });
    if (pred.some(Boolean) && !pred.every(Boolean)) {
      for (const [i, h] of alternatives.entries())
        m.evidence[side][h] = (m.evidence[side][h] ?? 0) + (pred[i] ? 1 : -1);
      if (!m.refs.includes(ref)) m.refs = [...m.refs.slice(-5), ref];
    }
  }
  if (f) {
    if (f.purpose === 'measure_a_direction_for_the_two_registered_subjects')
      return m.motors[op]
        ? 'registered_direction_observed'
        : 'registered_direction_blocked';
    if (poseId(f.expected) !== poseId(a)) {
      m.denied[key(b) + '|' + f.command] = 1;
      delete m.plan;
      return 'relative_displacement_refuted';
    }
    if (m.plan?.[0]?.command === f.command) m.plan.shift();
    return 'relative_displacement_verified';
  }
}
export function forecast(
  s: Scene,
  m: Learning,
  v: Reading,
  next: Reading,
  op: string,
  why: string,
  open: string[],
  ref: string,
): TransportForecast {
  const command =
    op === 'select' ? pointCommand(s.grid, v.subjects[peer(v.active)]) : op;
  return {
    purpose: why,
    paired: {
      laws: [law(m, 0), law(m, 1)],
      radius: m.radius,
      scope: m.scope,
      lesson: m.carry,
    },
    command,
    from: v,
    expected: next,
    target: s.goals,
    evidence: [
      ...new Set([
        ref,
        ...m.refs,
        ...(m.scope ? [m.scope] : []),
        ...(m.carry ? [m.carry] : []),
      ]),
    ],
    open,
    key: key(v) + '|' + command,
  };
}
