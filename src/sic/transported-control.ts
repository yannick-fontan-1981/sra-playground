import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { Edge, Experiment, Memory } from './preparation-experiments.ts';
import { groupsOf, poseOf, type RolePair } from './exchange-roles.ts';
import { equalLayout, type Layout } from './projected-motion.ts';
import { add, diff, same, size, type XY } from './access-terrain.ts';
import { imageKey, projectEdit } from './relative-edits.ts';
import { returnPrograms, type Patient, type RoleMove } from './return-programs.ts';

type Forecast = {
  origin: number;
  prepared: number;
  a: string;
  b: string;
  inverse: string[];
  controlRef: number;
  refs: number[];
  roles: RolePair;
  initial: Layout;
  bare: Layout;
  placed: Layout;
  afterUse: Layout;
  use: string;
  rolesAfterSetup: Layout | null;
  expectedSetup: number;
  configured: number | null;
  predictedImage: string | null;
  fact: string;
  reuse: number | null;
  score: number;
  reason: string;
  other: string[];
};
export type ContextTrial = { plan: Forecast; index: number; first: number };
export type ContextMemory = {
  active: ContextTrial | null;
  attempts: Record<string, number>;
  misses: Record<string, number>;
  facts: Record<string, number>;
  last: number;
};
export const newContextMemory = (): ContextMemory => ({
  active: null,
  attempts: {},
  misses: {},
  facts: {},
  last: -1,
});
const roleKey = (p: RolePair) => JSON.stringify(p.map((r) => [r.signature, r.fixed]));
const attempt = (p: Forecast) => JSON.stringify([p.origin, p.a, p.b, roleKey(p.roles), p.placed]);
const missKey = (p: Forecast) => [p.a, p.b, p.roles[0].signature, p.roles[1].signature].join('/');
export const contextWord = (p: Forecast) => [p.a, p.b, ...p.inverse, p.use];
const fits = (q: XY, body: Patient, rows: NativeRows) =>
  q[0] >= 0 &&
  q[1] >= 0 &&
  q[0] + body.box[2]! - body.box[0]! < rows[0]!.length &&
  q[1] + body.box[3]! - body.box[1]! < rows.length &&
  !body.role.fixed.includes(q.join());
function traceMove(edge: Edge, moving: RoleMove, patient: Patient): Layout | null {
  const t = edge.manipulation;
  if (!t) return null;
  function after(role: RoleMove['role'], p: XY): XY | null {
    const m = t!.moves.find((v) => v.role.signature === role.signature && same(v.from, p));
    if (m) return m.to;
    return t!.changedClasses.includes(role.signature) ? null : p;
  }
  const a = after(moving.role, moving.from),
    b = after(patient.role, patient.at);
  return a && b ? [a, b] : null;
}
function rootBoard(rows: NativeRows, prep: Edge, arm: Edge | undefined, first: number) {
  let base = rows;
  if (first === 2) {
    if (!arm?.manipulation) return null;
    const x = projectEdit(base, arm.manipulation.edit, { reverse: true, strict: true });
    if (!x) return null;
    base = x.board;
  }
  if (first > 0) {
    const s = projectEdit(base, prep.manipulation!.edit, { reverse: true, strict: true });
    if (!s) return null;
    base = s.board;
  }
  return base;
}
function catalogue(
  m: Memory,
  o: NativeObservation,
  rows: NativeRows,
  scene: number,
  available: Set<string>,
  state: ContextMemory
) {
  const stable = m.edges.filter((e) => e.stable && e.manipulation),
    last = m.edges[m.previous];
  const history = m.delayed.history,
    prior = m.edges[history[history.length - 2] ?? -1];
  const starts: { root: number; first: number; prep?: Edge; arm?: Edge }[] = [{ root: scene, first: 0 }];
  if (last?.t === scene && last.s !== scene && last.stable) {
    starts.push({ root: last.s, first: 1, prep: last });
    if (prior?.stable && prior.t === last.s && prior.s !== prior.t)
      starts.push({ root: prior.s, first: 2, prep: prior, arm: last });
  }
  const by = new Map<number, Edge[]>();
  for (const e of stable) {
    const group = by.get(e.s) ?? [];
    group.push(e);
    by.set(e.s, group);
  }
  const proposals: { plan: Forecast; first: number }[] = [];
  for (const start of starts) {
    const direct = by.get(start.root) ?? [];
    if (direct.length < 2) continue;
    const inverses = returnPrograms(stable, start.root);
    for (const prep of start.prep ? [start.prep] : direct) {
      const a = prep.manipulation,
        back = inverses.get(prep.t);
      if (!a || !a.edit.count || !back?.length || prep.t === start.root) continue;
      const measured = by.get(prep.t) ?? [];
      for (const bare of direct) {
        if (
          !bare.manipulation?.moves.length ||
          bare.cmd === prep.cmd ||
          (start.arm && start.arm.cmd !== bare.cmd)
        )
          continue;
        const arm = measured.find((e) => e.cmd === bare.cmd);
        if (arm?.t === prep.t) continue;
        const firstOp = start.first === 0 ? prep.cmd : start.first === 1 ? bare.cmd : back[0]!.cmd;
        if (!available.has(firstOp)) continue;
        const s = rootBoard(rows, prep, arm, start.first);
        if (!s) continue;
        const merged = arm?.manipulation ? projectEdit(s, arm.manipulation.edit) : null;
        const predictedImage = merged && !merged.conflicts && merged.changed ? imageKey(merged.board) : null;
        for (const mover of bare.manipulation.moves) {
          const delta = diff(mover.to, mover.from);
          for (const receiver of a.patients) {
            if (
              mover.role.signature === receiver.role.signature ||
              bare.manipulation.changedClasses.includes(receiver.role.signature)
            )
              continue;
            const destination = add(receiver.at, delta);
            if (!fits(destination, receiver, rows)) continue;
            const roles: RolePair = [mover.role, receiver.role],
              initial: Layout = [mover.from, receiver.at],
              placed: Layout = [mover.from, destination];
            const fact = JSON.stringify([prep.cmd, back.map((e) => e.cmd), roleKey(roles)]),
              reuse = state.facts[fact] ?? null;
            const acquired = a.moves.find(
              (v) => v.role.signature === mover.role.signature && same(v.from, mover.from)
            );
            const gap = acquired ? size(diff(acquired.to, receiver.at)) : Infinity;
            const handsOver = gap <= Math.max(1, size(delta) / 2) && !same(mover.from, receiver.at);
            const affected = receiver.gap === 0;
            if (!reuse && !handsOver && (!affected || m.recurrences < 2 || m.turns - state.last < 4))
              continue;
            const follow: { edge: Edge; after: Layout; gain: number }[] = [];
            for (const c of direct) {
              if (
                c.cmd === prep.cmd ||
                !c.manipulation ||
                c.manipulation.changedClasses.includes(receiver.role.signature)
              )
                continue;
              const v = c.manipulation.moves.find(
                (x) => x.role.signature === mover.role.signature && same(x.from, mover.from)
              );
              if (!v) continue;
              const after: Layout = [v.to, destination];
              if (same(after[0], after[1])) continue;
              const gain = size(diff(mover.from, receiver.at)) - size(diff(v.to, destination));
              follow.push({ edge: c, after, gain });
            }
            follow.sort(
              (l, r) => Number(r.edge.cmd !== bare.cmd) - Number(l.edge.cmd !== bare.cmd) || r.gain - l.gain
            );
            const c = follow[0];
            if (!c) continue;
            const refs = [
              ...new Set([
                prep.ref,
                bare.ref,
                ...back.map((e) => e.ref),
                c.edge.ref,
                ...(arm ? [arm.ref] : []),
                ...(reuse ? [reuse] : []),
              ]),
            ];
            const plan: Forecast = {
              origin: start.root,
              prepared: prep.t,
              a: prep.cmd,
              b: bare.cmd,
              inverse: back.map((e) => e.cmd),
              controlRef: bare.ref,
              refs,
              roles,
              initial,
              bare: [mover.to, receiver.at],
              placed,
              afterUse: c.after,
              use: c.edge.cmd,
              rolesAfterSetup: traceMove(prep, mover, receiver),
              expectedSetup: prep.t,
              configured: arm?.t ?? null,
              predictedImage,
              fact,
              reuse,
              other: [],
              score:
                (reuse ? 80 : 0) +
                (handsOver ? 38 : 0) +
                (affected ? 7 : 0) +
                (arm ? 5 : 0) +
                (predictedImage ? 3 : 0) +
                Math.min(8, Math.max(-8, c.gain)) +
                start.first * 2 -
                back.length,
              reason: reuse
                ? 'calibrated_recipient'
                : handsOver
                  ? 'driver_at_recipient'
                  : 'recipient_at_changed_site',
            };
            if (
              state.attempts[attempt(plan)] ||
              (!reuse && (state.misses[missKey(plan)] ?? 0) >= (handsOver ? 4 : 1))
            )
              continue;
            proposals.push({ plan, first: start.first });
          }
        }
      }
    }
  }
  return proposals.sort((p, q) => q.plan.score - p.plan.score);
}
export function offerContext(
  m: Memory,
  o: NativeObservation,
  rows: NativeRows,
  available: Set<string>,
  scene: number
): Experiment | null {
  const state = m.contexts;
  if (!state) return null;
  let trial = state.active;
  if (!trial) {
    if (m.turns < 3 || !m.recurrences) return null;
    const picks = catalogue(m, o, rows, scene, available, state),
      best = picks[0];
    if (!best) return null;
    best.plan.other = [...new Set(picks.slice(1).map((p) => p.plan.placed.map((q) => q.join()).join('|')))]
      .filter((k) => k !== best.plan.placed.map((q) => q.join()).join('|'))
      .slice(0, 5);
    trial = { plan: best.plan, index: best.first, first: best.first };
  }
  const p = trial.plan,
    k = contextWord(p)[trial.index]!;
  if (!available.has(k)) return null;
  if (trial.index === 0) {
    const v = poseOf(groupsOf(o), p.roles);
    if (!v || !equalLayout(v, p.initial)) return null;
  }
  return {
    phase: 'transportControl',
    origin: p.origin,
    a: p.a,
    b: k,
    rule: p.reason,
    refs: p.refs,
    transport: trial,
  };
}
export function recordContext(
  state: ContextMemory,
  t: ContextTrial,
  b: NativeObservation,
  a: NativeObservation,
  after: number,
  rows: NativeRows,
  turn: number
) {
  const { plan: p, index } = t,
    last = 2 + p.inverse.length,
    at = poseOf(groupsOf(a), p.roles),
    won = a.levels_completed > b.levels_completed || a.state === 'WIN';
  let expected: Layout | null = null;
  if (index === last - 1) expected = p.placed;
  if (index === last) expected = p.afterUse;
  const stage = index === 0 ? 'setup' : index === 1 ? 'operand' : index === last ? 'use' : 'return';
  const matched = expected ? !!at && equalLayout(expected, at) : null;
  const live = !won && b.level_epoch === a.level_epoch && b.state === a.state;
  const admissible =
    live &&
    (index !== 0 || after === p.expectedSetup) &&
    (index !== 1 || p.configured === null || after === p.configured) &&
    matched !== false;
  const imageMatched = index === last - 1 && p.predictedImage ? imageKey(rows) === p.predictedImage : null;
  state.attempts[attempt(p)] = a.revision;
  state.last = turn;
  if (index === last - 1 && matched && live) state.facts[p.fact] = a.revision;
  if (!admissible && !won && index < last) state.misses[missKey(p)] = (state.misses[missKey(p)] ?? 0) + 1;
  state.active = admissible && index < last ? { ...t, index: index + 1 } : null;
  return {
    result:
      'transport_' +
      stage +
      (won ? '_completion' : !admissible ? '_refuted' : matched ? '_verified' : '_observed'),
    detail: { plan: p, index, first: t.first, stage, observed: at, matched, imageMatched, won },
  };
}
