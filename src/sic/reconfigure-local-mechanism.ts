import type { NativeObservation, NativeRows, NativeEntity } from '../logos-engine/v6-native-types.ts';
import { add, diff, same, size, type XY } from './access-terrain.ts';
import { visualLayout } from './witnessed-preview-transfer.ts';
import { poseRole } from './occupancy-programs.ts';
import { motorsFor, zoneFloor, type ZoneRepeat, type Motor } from './local-progress.ts';
import {
  reachablePreviewConfigurations,
  type ProbePattern,
  type LayoutStep,
} from './reachable-preview-configurations.ts';
import { contactEvidence } from './contact-aspirations.ts';
import type { Experiment, Memory } from './preparation-experiments.ts';
export type MechanismPlan = {
  p: string;
  c: string;
  fixed: XY[];
  start: XY;
  initialC: XY;
  placed: XY;
  launch: XY | null;
  arrival: XY | null;
  use: XY | null;
  indicator: string | null;
  steps: LayoutStep[];
  key: string;
  basis: 'move_to_change_access' | 'test_displacement';
  support: number[];
  home: number;
  otherSetups: number;
  opensCells: number;
  recoverable: boolean;
};
type Option = {
  site: string;
  initial: XY;
  placed: XY;
  launch: XY | null;
  arrival: XY | null;
  steps: number;
  opensCells: number;
  recoverable: boolean;
};
export type MechanismTrial = { plan: MechanismPlan; index: number; cause: ZoneRepeat; options: Option[] };
const point = (e: NativeEntity): XY => [e.bbox[0] + e.bbox[2], e.bbox[1] + e.bbox[3]];
const k = (p: XY) => p.join();
function named(o: NativeObservation, rows: NativeRows, p: MechanismPlan) {
  const v = visualLayout(o, rows),
    actors = v[p.p] ?? [],
    parts = v[p.c] ?? [],
    rest = parts.filter((b) => !p.fixed.some((x) => same(x, b.at)));
  return {
    actor: actors.length === 1 ? actors[0]!.at : null,
    site:
      parts.length === p.fixed.length + 1 &&
      p.fixed.every((x) => parts.some((e) => same(x, e.at))) &&
      rest.length === 1
        ? rest[0]!.at
        : null,
  };
}
function atCurrent(s: LayoutStep, loc: ReturnType<typeof named>) {
  return !!(loc.actor && loc.site && same(loc.actor, s.p) && same(loc.site, s.c));
}
function offer(
  t: MechanismTrial,
  s: number,
  available: Set<string>,
  o: NativeObservation,
  rows: NativeRows
): Experiment | null {
  const step = t.plan.steps[t.index];
  if (!step || !available.has(step.op) || !atCurrent(step, named(o, rows, t.plan))) return null;
  if (
    step.stage === 'read' &&
    t.plan.indicator &&
    !visualLayout(o, rows)[t.plan.indicator]?.some((r) => same(r.at, step.to))
  )
    return null;
  return {
    phase: 'reconfigureMechanism',
    origin: s,
    a: step.op,
    b: step.op,
    rule: 'test_moving_a_mechanism_to_expand_access_after_a_stagnant_return',
    refs: [...new Set([t.cause.previous, t.cause.revision, ...t.plan.support])],
    mechanism: t,
  };
}
function pathToContact(from: XY, c: XY, motors: Motor[], open: (at: XY) => boolean) {
  const queue = [from],
    parents = new Map<string, LayoutStep>(),
    result: { path: LayoutStep[]; possible: number; opened: number; recoverable: boolean }[] = [];
  for (const p of queue)
    for (const motor of motors) {
      const to = add(p, motor.d);
      if (same(c, to)) {
        const placed = add(to, motor.d);
        if (!open(placed)) continue;

        const steps: LayoutStep[] = [];
        let v = p;
        while (!same(v, from)) {
          const step = parents.get(k(v))!;
          steps.push(step);
          v = step.p;
        }
        steps.reverse();
        result.push({
          path: [...steps, { op: motor.op, stage: 'write', p, c, to, placed }],
          possible: 0,
          opened: 0,
          recoverable: false,
        });
        continue;
      }
      if (!open(to) || same(to, from) || parents.has(k(to))) continue;
      parents.set(k(to), { op: motor.op, stage: 'move', p, c, to, placed: c });
      queue.push(to);
    }
  const home = new Set(queue.map(k));
  for (const option of result) {
    const placed = option.path.at(-1)!.placed,
      accessible = new Set([k(c)]),
      after = [c];
    for (const position of after)
      for (const motor of motors) {
        const next = add(position, motor.d);
        if (!same(next, placed) && open(next) && !accessible.has(k(next))) {
          accessible.add(k(next));
          after.push(next);
        }
      }
    const possible = motors.filter((m) => accessible.has(k(diff(placed, m.d))) && open(add(placed, m.d)));
    option.possible = possible.length;
    option.recoverable = possible.some((m) => same(add(placed, m.d), c));
    option.opened = after.filter((p) => !same(p, c) && !home.has(k(p))).length;
  }
  return result;
}
function priorSite(m: Memory, scene: number, c: NativeEntity, fixed: XY[]): XY | null {
  const single = m.occupancy?.layouts[scene]?.[poseRole(c)];
  if (single && !fixed.length) return single;
  const peers = m.frames?.duplicates?.[scene]?.[c.signature];
  if (!peers || peers.length !== fixed.length + 1) return null;
  const dx = c.bbox[2] - c.bbox[0],
    dy = c.bbox[3] - c.bbox[1];
  const positions = peers.map((s) => {
    const [x, y] = s.split(',').map(Number);
    return [2 * x! + dx, 2 * y! + dy] as XY;
  });
  if (!fixed.every((p) => positions.some((x) => same(p, x)))) return null;
  return positions.find((p) => !fixed.some((x) => same(p, x))) ?? null;
}
function references(m: Memory, p: string, c: NativeEntity, fixed: XY[], allowed: Set<string>) {
  const occ = m.occupancy!,
    groups = new Map<string, { r: string; q: string; examples: ProbePattern[] }>();
  for (const pair of Object.values(occ.pairs)) {
    if (pair.p !== p || pair.r === poseRole(c)) continue;
    for (const [q, hits] of Object.entries(pair.hits)) {
      if (!allowed.has(q) || q.startsWith('ACTION6:')) continue;
      const examples: ProbePattern[] = [];
      for (const h of hits) {
        const layout = occ.layouts[h.s]!,
          centre = priorSite(m, h.s, c, fixed);
        if (centre && layout[p] && layout[pair.r])
          examples.push({ actor: layout[p]!, centre, indicator: layout[pair.r]!, ref: h.ref });
      }
      if (examples.length) groups.set(pair.r + '/' + q, { r: pair.r, q, examples });
    }
  }
  return [...groups.values()];
}
export function offerMechanism(
  m: Memory,
  s: number,
  o: NativeObservation,
  rows: NativeRows,
  available: Set<string>,
  cause: ZoneRepeat | null
): Experiment | null {
  const memory = m.localProgress;
  if (!memory || !m.occupancy) return null;
  if (memory.active) return offer(memory.active, s, available, o, rows);
  if (!cause) return null;
  const occ = m.occupancy,
    p = cause.actor,
    from = occ.layouts[s]?.[p],
    actors = o.entities.filter((e) => poseRole(e) === p);
  if (!from || actors.length !== 1) return null;
  const motors = motorsFor(occ, p).filter((v) => available.has(v.op));
  const floor = zoneFloor(occ, p, o, rows, motors, from),
    layout = visualLayout(o, rows),
    options: { plan: MechanismPlan; rank: number }[] = [];
  for (const c of o.entities) {
    const role = poseRole(c),
      at = point(c),
      others = layout[role];
    if (role === p || !others || others.length > 12 || same(from, at)) continue;
    const fixed = others.filter((b) => !same(b.at, at)).map((b) => b.at),
      blocked = new Set(fixed.map(k));
    const open = (v: XY) => !blocked.has(k(v)) && (same(v, at) || floor.open(v));
    const near = motors.length >= 2 && motors.some((v) => floor.component.has(k(diff(at, v.d))));
    const candidates = near ? pathToContact(from, at, motors, open) : [];
    const groups = references(m, p, c, fixed, available);
    const witnessedMove = occ.edges.find((e) => {
      const a = priorSite(m, e.s, c, fixed),
        b = priorSite(m, e.t, c, fixed);
      return !e.unstable && a && b && !same(a, b);
    });
    const indicator = Object.values(m.previewLearning?.bindings ?? {}).some(
      (b) => b.actor === p && b.indicator === role
    );
    const independent =
      indicator &&
      occ.edges.some((e) => {
        if (e.unstable) return false;
        const a = occ.layouts[e.s]!,
          z = occ.layouts[e.t]!;
        return a[p] && z[p] && same(a[p]!, z[p]!) && a[role] && z[role] && !same(a[role]!, z[role]!);
      });
    if (indicator && !independent) continue;
    const attachment = occ.edges.filter(
      (e) =>
        !e.unstable &&
        occ.layouts[e.s]?.[p] &&
        occ.layouts[e.t]?.[p] &&
        !same(occ.layouts[e.s]![p]!, occ.layouts[e.t]![p]!)
    );
    if (
      attachment.length >= 2 &&
      attachment.every((e) => {
        const a = priorSite(m, e.s, c, fixed),
          z = priorSite(m, e.t, c, fixed);
        return a && z && same(diff(z, a), diff(occ.layouts[e.t]![p]!, occ.layouts[e.s]![p]!));
      })
    )
      continue;
    const patterns = groups.flatMap((g) => g.examples);
    const equalArms = patterns.filter(
      (v) => size(diff(v.actor, v.centre)) === size(diff(v.indicator, v.centre))
    );
    const anchored =
      patterns.length > 0 && equalArms.length === patterns.length
        ? new Set(equalArms.map((v) => diff(v.actor, v.centre).join())).size
        : 0;
    function submit(
      steps: LayoutStep[],
      basis: MechanismPlan['basis'],
      indicator: string | null,
      refs: number[],
      rank: number,
      possible: number,
      recoverable: boolean,
      launch: XY | null = null,
      arrival: XY | null = null,
      use: XY | null = null,
      opensCells = 0
    ) {
      const placed = steps.filter((v) => v.stage === 'write').at(-1)!.placed,
        first = steps.find((v) => v.stage === 'write')!;
      const key = JSON.stringify([
        p,
        role,
        fixed,
        at,
        placed,
        first.p,
        launch,
        arrival,
        steps.filter((v) => v.stage === 'read').map((v) => v.op),
      ]);
      if (memory!.attempts[key] !== undefined) return;
      if (
        steps.some(
          (v) =>
            v.stage === 'write' &&
            memory!.attempts[JSON.stringify(['failed_contact', p, role, fixed, v.p, v.c, v.op])] !== undefined
        )
      )
        return;
      options.push({
        plan: {
          p,
          c: role,
          fixed,
          start: from!,
          initialC: at,
          placed,
          launch,
          arrival,
          use,
          indicator,
          steps,
          key,
          basis,
          support: [...new Set([...refs, ...motors.map((v) => v.refs[0]!)])],
          home: floor.component.size,
          otherSetups: possible,
          opensCells,
          recoverable,
        },
        rank,
      });
    }
    const remote = new Map<string, { offset: XY; ref: number; conflict: boolean }>();
    for (const e of occ.edges) {
      if (
        e.unstable ||
        e.op === cause.op ||
        e.op.startsWith('ACTION6:') ||
        !available.has(e.op) ||
        occ.observed[s + '/' + e.op] !== undefined
      )
        continue;
      const a = occ.layouts[e.s]?.[p],
        b = occ.layouts[e.t]?.[p];
      if (!a || !b || !same(a, b)) continue;
      const before = priorSite(m, e.s, c, fixed),
        after = priorSite(m, e.t, c, fixed);
      if (!before || !after) continue;
      const offset = diff(after, before),
        law = remote.get(e.op);
      if (law) {
        law.conflict ||= !same(offset, law.offset);
      } else remote.set(e.op, { offset, ref: e.ref, conflict: false });
    }
    for (const [op, law] of remote) {
      const placed = add(at, law.offset);
      if (
        law.conflict ||
        !size(law.offset) ||
        same(placed, from) ||
        blocked.has(k(placed)) ||
        placed[0] < 0 ||
        placed[1] < 0 ||
        placed[0] >= 2 * rows[0]!.length ||
        placed[1] >= 2 * rows.length
      )
        continue;
      const seen = occ.edges.some((e) => {
        const a = occ.layouts[e.s]?.[p],
          z = priorSite(m, e.s, c, fixed);
        return a && z && same(a, from) && same(z, placed);
      });
      if (seen) continue;
      submit(
        [{ op, stage: 'write', p: from, c: at, to: from, placed }],
        'test_displacement',
        null,
        [law.ref],
        24 + Math.min(2, anchored),
        0,
        false
      );
    }
    for (const v of candidates) {
      const first = v.path.at(-1)!,
        e = occ.observed[s + '/' + first.op];
      if (v.path.length === 1 && e !== undefined) {
        const end = priorSite(m, e, c, fixed);
        if (!end || !same(end, first.placed)) continue;
      }
      const score =
        32 * Number(v.opened > 0) +
        Math.min(6, Math.log2(1 + v.opened)) +
        8 * Number(!!witnessedMove) +
        4 * Math.min(2, anchored) +
        3 * Number(v.recoverable) +
        Math.min(4, v.possible) +
        contactEvidence(actors[0]!, c) -
        Math.log2(1 + v.path.length);
      submit(
        v.path,
        'test_displacement',
        null,
        witnessedMove ? [witnessedMove.ref] : [],
        score,
        v.possible,
        v.recoverable,
        null,
        null,
        null,
        v.opened
      );
    }
    if (!near) continue;
    for (const g of groups) {
      if (!g.examples.some((v) => size(diff(v.actor, v.centre)) === size(diff(v.indicator, v.centre))))
        continue;
      const calc = reachablePreviewConfigurations({
        actor: from,
        centre: at,
        motors: motors.map((v) => ({ op: v.op, d: v.d, ref: v.refs[0]! })),
        op: g.q,
        patterns: g.examples,
        otherCentres: fixed,
        passable: open,
        readWitnessed: true,
        allowWrites: true,
        stateLimit: Math.min(4096, rows.length * rows[0]!.length * 2),
        baselineRead: motors.find((v) => v.op === g.q)?.d,
      });
      for (const h of calc.configurations.slice(0, 12))
        submit(
          h.steps,
          'move_to_change_access',
          g.r,
          [h.witness],
          64 + h.gain - Math.log2(1 + h.steps.length),
          calc.configurations.length,
          false,
          h.launch,
          h.arrival,
          h.continuation
        );
    }
  }
  options.sort((a, b) => b.rank - a.rank);
  for (const { plan } of options) {
    const trial = {
      plan,
      index: 0,
      cause,
      options: options
        .slice(0, 12)
        .map(({ plan: v }) => ({
          site: v.c,
          initial: v.initialC,
          placed: v.placed,
          launch: v.launch,
          arrival: v.arrival,
          steps: v.steps.length,
          opensCells: v.opensCells,
          recoverable: v.recoverable,
        })),
    };
    const x = offer(trial, s, available, o, rows);
    if (x) return x;
  }
  return null;
}
export function finishMechanism(
  m: Memory,
  t: MechanismTrial,
  b: NativeObservation,
  a: NativeObservation,
  rows: NativeRows,
  next: NativeRows,
  op: string
) {
  const state = m.localProgress!,
    step = t.plan.steps[t.index]!,
    before = named(b, rows, t.plan),
    actual = named(a, next, t.plan);
  const won = a.levels_completed > b.levels_completed || a.state === 'WIN',
    live = b.state === a.state && a.level_epoch === b.level_epoch;
  const matched = !!(
    live &&
    atCurrent(step, before) &&
    op === step.op &&
    actual.actor &&
    same(actual.actor, step.to) &&
    (step.stage === 'read' || step.stage === 'use' || (actual.site && same(actual.site, step.placed)))
  );
  state.attempts[t.plan.key] = a.revision;
  if (step.stage === 'write' && live && !matched)
    state.attempts[
      JSON.stringify(['failed_contact', t.plan.p, t.plan.c, t.plan.fixed, step.p, step.c, step.op])
    ] = a.revision;
  state.active = matched && !won && t.index + 1 < t.plan.steps.length ? { ...t, index: t.index + 1 } : null;
  return { trial: t, stage: step.stage, matched, won, actual, continued: !!state.active };
}
