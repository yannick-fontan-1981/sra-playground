import type { NativeCommand, NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { Experiment, Memory } from './preparation-experiments.ts';
import { groupsOf, resolveRole, type Groups, type Role } from './exchange-roles.ts';
import { same, point, type XY } from './access-terrain.ts';
import { inversePlans, type InversePlan } from './inverse-frame-sites.ts';
import type { FramePose, FrameEffect } from './motion-frames.ts';

type Choice = { at: XY; to: XY; goal: XY | null };
export type FrameTrial = { plan: InversePlan; step: number; choices: Choice[] };
export type FrameMemory = { active: FrameTrial | null; tried: Record<string, number>; last: number };
export const newFrameMemory = (): FrameMemory => ({ active: null, tried: {}, last: -100 });
export function repeatedFrameCommand(
  key: string,
  o: NativeObservation,
  rows: NativeRows
): NativeCommand | null {
  const cursor = /^ACTION6:(\d+),(\d+)$/.exec(key);
  if (!cursor || !o.available_action_refs.includes('ACTION6')) return null;
  const x = Number(cursor[1]),
    y = Number(cursor[2]);
  return y < rows.length && x < rows[y]!.length ? { action_ref: 'ACTION6', data: { x, y } } : null;
}
const identity = (r: Role) => JSON.stringify([r.signature, r.fixed]);
const sampleAt = (
  s: string | number,
  r: Role,
  from: XY,
  reference: Map<string, XY>,
  index: number
): FramePose => {
  const anchors = new Map(reference);
  anchors.delete(r.signature);
  anchors.set('self', from);
  anchors.set('world', [0, 0]);
  return { scene: s, index, role: r, from, anchors };
};
function forecast(m: Memory, o: NativeObservation, rows: NativeRows, s: number, available: Set<string>) {
  const known = new Map<string, Map<string, Role>>(),
    mobile = new Set<string>();
  const edges = m.edges.filter(
    (e) => e.stable && !!e.manipulation && (available.has(e.cmd) || repeatedFrameCommand(e.cmd, o, rows))
  );
  for (const e of edges)
    for (const v of e.manipulation!.moves) {
      let group = known.get(e.cmd);
      if (!group) {
        group = new Map();
        known.set(e.cmd, group);
      }
      group.set(identity(v.role), v.role);
      if (!v.role.fixed.length) mobile.add(v.role.signature);
    }
  if (!mobile.size || known.size < 2) return [];
  const g = groupsOf(o),
    current = new Map<string, XY>();
  for (const k of mobile) {
    const group = g.get(k);
    if (group?.size === 1) current.set(k, [...group.values().next().value!.position]);
  }
  if (!current.size) return [];
  const history = new Map<string, FrameEffect[]>();
  for (const e of edges) {
    const roles = known.get(e.cmd);
    if (!roles) continue;
    const anchors = new Map<string, XY>();
    for (const k of mobile) if (e.anchors[k]) anchors.set(k, point(e.anchors[k]!.at));
    for (const [id, r] of roles) {
      const move = e.manipulation!.moves.find((v) => identity(v.role) === id);
      let from = move?.from,
        to = move?.to;
      if (!from || !to) {
        if (
          r.fixed.length ||
          !e.anchors[r.signature] ||
          e.manipulation!.changedClasses.includes(r.signature) ||
          !e.visibleAfter?.includes(r.signature)
        )
          continue;
        from = point(e.anchors[r.signature]!.at);
        to = from;
      }
      const k = e.cmd + '/' + id,
        list = history.get(k) ?? [];
      list.push({ ...sampleAt(e.s, r, from, anchors, e.ref), to });
      history.set(k, list);
    }
  }
  function sample(here: Groups, scene: string | number, r: Role) {
    const v = resolveRole(here, r);
    return v ? sampleAt(scene, r, [...v.position], current, o.revision) : null;
  }
  return inversePlans({
    i: o.revision - 1,
    now: { s, g },
    rows,
    known,
    history,
    sample,
    tried: new Set(Object.keys(m.frames!.tried)),
  });
}
function action(t: FrameTrial) {
  const p = t.plan;
  return t.step < p.length ? p.a : t.step === p.length ? p.q : p.follow?.op;
}
export function offerFrame(
  m: Memory,
  o: NativeObservation,
  rows: NativeRows,
  s: number,
  available: Set<string>
): Experiment | null {
  const state = m.frames;
  if (!state) return null;
  let t = state.active;
  if (!t) {
    if (m.edges.length < 6 || m.turns % 3 || m.turns - state.last < 3) return null;
    const plans = forecast(m, o, rows, s, available),
      p = plans[0];
    if (!p) return null;
    t = { plan: p, step: 0, choices: plans.map((q) => ({ at: q.placement, to: q.to, goal: q.goal })) };
  }
  const p = t.plan,
    op = action(t);
  if (!op || (!available.has(op) && !repeatedFrameCommand(op, o, rows))) return null;
  const refs = [...new Set([...p.refs, ...p.actuatorRefs, ...(p.follow?.refs ?? [])])];
  return {
    phase: 'inverseFrame',
    origin: Number(p.root),
    a: p.a,
    b: op,
    rule: 'move_the_reference_for_a_predicted_arrival',
    refs,
    frame: t,
  };
}
export function recordFrame(m: Memory, t: FrameTrial, b: NativeObservation, a: NativeObservation) {
  const p = t.plan,
    state = m.frames!,
    k = t.step,
    group = groupsOf(a);
  const at = resolveRole(group, { signature: p.anchor, fixed: [] }),
    patient = resolveRole(group, p.role);
  const won = a.levels_completed > b.levels_completed || a.state === 'WIN',
    live = !won && b.state === a.state && b.level_epoch === a.level_epoch;
  const stage = k < p.length ? 'place' : k === p.length ? 'arrive' : 'use';
  const intermediate = (from: XY, to: XY): XY =>
    [0, 1].map((i) => from[i]! + ((to[i]! - from[i]!) * (k + 1)) / p.length) as XY;
  const expected =
    stage === 'place' ? intermediate(p.from, p.patient) : stage === 'arrive' ? p.to : p.follow!.to;
  const reference = stage === 'place' ? intermediate(p.at, p.placement) : null;
  const exact =
    !!patient &&
    same([...patient.position], expected) &&
    (!reference || (!!at && same([...at.position], reference)));
  state.tried[p.key] = a.revision;
  state.last = m.turns;
  state.active =
    live && exact && (stage === 'place' || (stage === 'arrive' && !!p.follow)) ? { ...t, step: k + 1 } : null;
  return {
    result: 'frame_' + stage + (won ? '_completion' : live && exact ? '_verified' : '_refuted'),
    detail: {
      trial: t,
      stage,
      expected,
      reference,
      patient: patient?.position ?? null,
      anchor: at?.position ?? null,
      exact,
      won,
      ref: a.revision,
    },
  };
}
