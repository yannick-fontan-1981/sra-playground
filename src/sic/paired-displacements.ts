import { applyImages, images, type Projection } from './paired-previews.ts';
import { chooseEffectExperiment } from './discriminating-experiment.ts';
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
  passage?: import('./prepare-projected-passage.ts').Passage;
  join?: import('./paired-crossing-preparation.ts').Link;
  motors: Record<string, Bearing>;
  evidence: [Partial<Record<Law, number>>, Partial<Record<Law, number>>];
  refs: string[];
  radius: number;
  scope?: string;
  mobileSupports?: string;
  fieldWitness?: string;
  projections?: Projection[];
  imageTrial?: Reading;
  avoid?: number[];
  mobileForms?: string[];
  previewPose?: string;
  visibleEffect?: Reading;
  denied: Record<string, number>;
  visits: Record<string, number>;
  special?: { mark: string; ref: string };
  checked: string[];
  carry?: string;
  plan?: { from: string; command: string; expected: Reading }[];
  planSolves?: boolean;
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
export const key = (v: Reading) => poseId(v);
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
    if (!m.projections?.length) return;
    if (m.previewPose === key(v)) return m.visibleEffect;
    return applyImages(v, images(s, v, m.projections));
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
      if (m.mobileSupports)
        for (const p of v.supports.filter(near))
          movers.push({ p, kind: 'support' });
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
        } else if (kind === 'support') {
          if (freePiece(to) && !n.supports.includes(to)) {
            n.supports.splice(n.supports.indexOf(p), 1);
            if (space.medium.has(to)) n.supports.push(to);
            else n.pieces.push(to);
          }
        } else if (
          (m.mobileSupports
            ? (space.ground.has(to) && space.open(n, to)) ||
              n.supports.includes(to)
            : space.walk(v, to)) &&
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
    if (m.scope && side === 1 && Math.abs(dx) + Math.abs(dy) === 1) {
      const gained = [...a.pieces, ...a.supports],
        before = [...b.pieces, ...b.supports],
        w = s.grid.columns;
      const discriminating = before.some((p) => {
        const x = (p % w) - (from % w),
          y = Math.floor(p / w) - Math.floor(from / w),
          to = neighbor(s.grid, p, dx, dy);
        return (
          Math.max(Math.abs(x), Math.abs(y)) <= m.radius &&
          x * dy !== y * dx &&
          !gained.includes(p) &&
          gained.includes(to) &&
          !before.includes(to)
        );
      });
      if (discriminating) {
        m.fieldWitness = ref;
        m.evidence[side].field = (m.evidence[side].field ?? 0) + 5;
      }
    }
    if (m.scope && side === 1 && m.motors[op]) {
      const dir = m.motors[op]!;
      for (const old of b.supports) {
        const target = neighbor(s.grid, old, dir.dx, dir.dy);
        if (
          !a.supports.includes(old) &&
          !b.supports.includes(target) &&
          a.supports.includes(target)
        ) {
          m.mobileSupports ??= ref;
          break;
        }
      }
    }
    const space = geometry(s),
      pred = alternatives.map((h) => {
        const next = imagine(s, space, b, op, m, h) ?? b;
        return poseId(next) === poseId(a);
      });
    const distance = Math.abs(dx) + Math.abs(dy);
    if (
      distance > 1 &&
      (dx === 0 || dy === 0) &&
      (b.pieces.includes(to) || b.subjects[peer(side)] === to)
    ) {
      m.evidence[side].exchange = (m.evidence[side].exchange ?? 0) + 4;
      m.refs = [...m.refs.slice(-5), ref];
    }
    if (pred.some(Boolean) && !pred.every(Boolean)) {
      for (const [i, h] of alternatives.entries())
        m.evidence[side][h] = (m.evidence[side][h] ?? 0) + (pred[i] ? 1 : -1);
      if (!m.refs.includes(ref)) m.refs = [...m.refs.slice(-5), ref];
    }
  }
  if (f) {
    if (f.motionTest) {
      const trial = 'test-motion/' + f.key;
      if (!m.checked.includes(trial)) m.checked.push(trial);
      delete m.plan;
      const matching = f.motionTest.predictions.filter(p => p.pose === key(a));
      return matching.length ? 'motion_test_discriminated_public_effects' : 'motion_test_found_an_unmodeled_effect';
    }
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

export function unresolvedMotionTest(s: Scene, m: Learning, v: Reading, ref: string, minimumOutcomes: number) {
  const evidence = m.evidence[v.active];
  const strongest = Math.max(...alternatives.map(h => evidence[h] ?? 0));
  const rivals = alternatives.filter(h => (evidence[h] ?? 0) === strongest);
  if (rivals.length < minimumOutcomes) return;
  const space = geometry(s), pose = key(v);
  const trials = Object.keys(m.motors).flatMap(command => {
    if (m.checked.includes('test-motion/' + pose + '|' + command) || m.denied[pose + '|' + command]) return [];
    const predictions = rivals.map(h => ({ law: h, pose: key(imagine(s, space, v, command, m, h) ?? v) }));
    return [{ action: { command, predictions }, predictions: predictions.map(p => p.pose) }];
  });
  const test = chooseEffectExperiment(trials, minimumOutcomes);
  if (!test) return;
  const { command, predictions } = test.action;
  const offer = forecast(s, m, v, imagine(s, space, v, command, m, law(m, v.active)) ?? v,
    command, 'identify_a_motion_effect_needed_to_plan', ['compare_the_positions_of_both_subjects_and_the_objects'], ref);
  offer.motionTest = { predictions, maximumRemaining: test.partition.remaining };
  return offer;
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
      ...(m.scope ? { scope: m.scope } : {}),
      ...(m.carry ? { lesson: m.carry } : {}),
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
