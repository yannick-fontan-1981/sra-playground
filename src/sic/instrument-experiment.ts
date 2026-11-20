import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { Edge, Memory, Experiment } from './preparation-experiments.ts';
import { groupsOf, resolveRole, type RolePair } from './exchange-roles.ts';
import { add, diff, same, size, type XY } from './access-terrain.ts';
import {
  findInstrumentSites,
  gaitKey,
  siteFactKey,
  type SitePlan,
  type SiteSearch,
} from './instrument-sites.ts';
import { returnPrograms } from './return-programs.ts';

type Pair = [XY | null, XY | null];
type Arm = { ref: number; from: Pair; to: Pair; scene: number };
type Stage = 'bare' | 'walk' | 'arrive' | 'control' | 'bind' | 'exercise' | 'back' | 'continue';
export type SiteTrial = {
  plan: SitePlan;
  stage: Stage;
  index: number;
  chosen: number;
  bareRef: number | null;
  site: number | null;
  siteRef: number | null;
  baseline: Arm | null;
  exposed: Arm | null;
  operandRef: number | null;
  back: string[];
  backTo: 'control' | 'bind';
  predicted: Pair | null;
};
export type InstrumentMemory = SiteSearch & { active: SiteTrial | null; last: number };
export const newInstrumentMemory = (): InstrumentMemory => ({
  active: null,
  last: -100,
  tried: {},
  facts: {},
  blocked: {},
});
function positions(o: NativeObservation, roles: RolePair): Pair {
  const g = groupsOf(o);
  return roles.map((r) => {
    const e = resolveRole(g, r);
    return e ? [...e.position] : null;
  }) as Pair;
}
const equal = (a: XY | null, b: XY | null) => !!a && !!b && same(a, b);
function cachedArm(e: Edge, p: SitePlan, from: Pair): Arm | null {
  const edit = e.manipulation;
  if (!edit || !e.stable) return null;
  const to = p.roles.map((r, i) => {
    const v = edit.moves.find((m) => m.role.signature === r.signature && from[i] && same(m.from, from[i]!));
    return v ? v.to : edit.changedClasses.includes(r.signature) ? null : from[i];
  }) as Pair;
  return { ref: e.ref, from, to, scene: e.t };
}
function chooseAtSite(m: Memory, t: SiteTrial, o: NativeObservation, s: number) {
  const p = t.plan,
    from = positions(o, p.roles);
  const measured = m.edges.find(
    (e) => e.stable && e.s === s && e.cmd === p.control.op && e.ref < o.revision + 1
  );
  t.site = s;
  t.siteRef = o.revision;
  t.baseline = measured ? cachedArm(measured, p, from) : null;
  t.stage = !t.baseline && p.blockedHere ? 'control' : 'bind';
}
function next(t: SiteTrial) {
  switch (t.stage) {
    case 'walk':
      return t.plan.route[t.index]?.op;
    case 'bare':
    case 'bind':
      return t.plan.operand;
    case 'back':
      return t.back[t.index];
    case 'control':
    case 'exercise':
    case 'continue':
      return t.plan.control.op;
    default:
      return undefined;
  }
}
export function offerInstrument(
  m: Memory,
  o: NativeObservation,
  rows: NativeRows,
  available: Set<string>,
  s: number
): Experiment | null {
  const state = m.instrument;
  if (!state) return null;
  let t = state.active;
  if (!t) {
    if (m.turns < 6 || m.recurrences < 1 || m.turns - state.last < 3) return null;
    const p = findInstrumentSites(m, o, rows, s, available, state);
    if (!p) return null;
    t = {
      plan: p,
      stage: p.bareRef === null ? 'bare' : p.route.length ? 'walk' : 'arrive',
      index: 0,
      chosen: o.revision,
      bareRef: p.bareRef,
      site: null,
      siteRef: null,
      baseline: null,
      exposed: null,
      operandRef: null,
      back: [],
      backTo: 'bind',
      predicted: null,
    };
  }
  if (t.stage === 'arrive') {
    t = { ...t };
    chooseAtSite(m, t, o, s);
  }
  const cmd = next(t);
  if (!cmd || !available.has(cmd)) return null;
  const p = t.plan,
    refs = [
      p.bareRef,
      p.already,
      p.learnedRef,
      p.control.ref,
      p.control.backRef,
      ...p.route.map((s) => s.ref),
      t.bareRef,
      t.siteRef,
      t.baseline?.ref,
      t.operandRef,
      t.exposed?.ref,
    ].filter((n): n is number => typeof n === 'number');
  return {
    phase: 'instrumentSite',
    origin: p.origin,
    a: p.operand,
    b: cmd,
    rule: p.kind,
    refs: [...new Set(refs)],
    instrument: t,
  };
}
function returnToSite(m: Memory, t: SiteTrial, scene: number, after: 'bind' | 'control') {
  if (t.site === null) return false;
  if (t.site === scene) {
    t.stage = after;
    t.index = 0;
    return true;
  }
  const path = returnPrograms(m.edges, t.site).get(scene);
  const back = path?.map((e) => e.cmd) ?? (t.plan.control.inverse ? [t.plan.control.inverse] : []);
  if (!back.length) return false;
  t.stage = 'back';
  t.index = 0;
  t.back = back;
  t.backTo = after;
  return true;
}
export function compareSiteArms(bare: Arm | null, prepared: Arm | null) {
  if (!bare || !prepared)
    return { driver: false, recipient: false, displacedDriver: false, displacedRecipient: false };
  const altered = [0, 1].map(
    (i) =>
      equal(bare.from[i]!, prepared.from[i]!) &&
      !!bare.to[i] &&
      !!prepared.to[i] &&
      !equal(prepared.from[i]!, prepared.to[i]!) &&
      !equal(prepared.to[i]!, bare.to[i]!)
  );
  const released = [0, 1].map(
    (i) =>
      !!bare.from[i] &&
      !!prepared.from[i] &&
      !!bare.to[i] &&
      !!prepared.to[i] &&
      !equal(bare.from[i]!, prepared.from[i]!) &&
      equal(bare.from[i]!, bare.to[i]!) &&
      !equal(prepared.from[i]!, prepared.to[i]!)
  );
  return {
    driver: altered[0]!,
    recipient: altered[1]!,
    displacedDriver: released[0]!,
    displacedRecipient: released[1]!,
  };
}
export function recordInstrument(
  m: Memory,
  t: SiteTrial,
  b: NativeObservation,
  a: NativeObservation,
  e: Edge,
  rows: NativeRows,
  actualScene: number
) {
  const state = m.instrument!,
    p = t.plan,
    stage = t.stage,
    from = positions(b, p.roles),
    to = positions(a, p.roles);
  const won = a.levels_completed > b.levels_completed || a.state === 'WIN',
    live = !won && a.level_epoch === b.level_epoch && b.state === a.state;
  const u: SiteTrial = { ...t };
  let keep = live,
    result = 'observed',
    baselineUsed: Arm | null = t.baseline;
  const arm = { ref: a.revision, from, to, scene: actualScene };
  state.tried[p.key] = a.revision;
  state.last = m.turns;
  if (!live) result = won ? 'completion' : 'boundary';
  else if (stage === 'bare') {
    keep = e.s === actualScene;
    if (keep) {
      u.bareRef = a.revision;
      u.stage = p.route.length ? 'walk' : 'arrive';
    }
    result = keep ? 'inactive' : 'active_at_origin';
  } else if (stage === 'walk') {
    const leg = p.route[t.index]!,
      end = t.index + 1 === p.route.length,
      reached = equal(to[0], leg.to);
    // A marker can disappear on contact. Only a changed local image at the final footprint admits the probe.
    const xy = leg.to,
      close = end && size(diff(xy, p.target)) <= size(p.control.delta) + 4;
    const changed =
      close &&
      e.manipulation?.edit.runs.some(([i, n]) => {
        const w = rows[0]!.length,
          x = i % w,
          y = Math.floor(i / w);
        return Math.abs(y - xy[1]) <= 3 && x <= xy[0] + 3 && x + n > xy[0] - 3;
      });
    const contact = end && ((equal(from[0], to[0]) && close) || (!to[0] && changed));
    keep = reached || !!contact;
    if (!reached && from[0]) state.blocked[gaitKey(p.roles[0], from[0], leg.op)] = m.turns;
    if (keep) {
      u.index = t.index + 1;
      if (end) u.stage = 'arrive';
    }
    result = reached ? 'placement_verified' : contact ? 'contact_probe' : 'placement_refuted';
  } else if (stage === 'control') {
    u.baseline = arm;
    baselineUsed = arm;
    if (t.exposed) keep = false;
    else keep = returnToSite(m, u, actualScene, 'bind');
    result = 'measured_alone';
  } else if (stage === 'bind') {
    u.operandRef = a.revision;
    u.stage = 'exercise';
    u.predicted = to.map((v) => (v ? add(v, p.delta) : null)) as Pair;
    result = e.s === actualScene ? 'silent_at_site' : 'changed_at_site';
  } else if (stage === 'exercise') {
    u.exposed = arm;
    const shift =
      equal(to[p.member], t.predicted?.[p.member] ?? p.desired) && !equal(from[p.member], to[p.member]);
    const evidence = compareSiteArms(t.baseline, arm);
    if (shift || Object.values(evidence).some(Boolean)) {
      u.stage = 'continue';
      u.predicted = to.map((v, i) => (v && from[i] ? add(v, diff(v, from[i]!)) : null)) as Pair;
      result = shift
        ? p.member === 0
          ? 'predicted_driver_moved'
          : 'predicted_recipient_moved'
        : 'changed_control';
    } else if (!t.baseline) {
      keep = returnToSite(m, u, actualScene, 'control');
      result = 'seek_matched_control';
    } else {
      keep = false;
      result = 'capacity_refuted';
    }
  } else if (stage === 'back') {
    if (actualScene === t.site) {
      u.stage = t.backTo;
      u.index = 0;
      result = 'site_restored';
    } else {
      u.index = t.index + 1;
      keep = u.index < t.back.length;
      result = keep ? 'returning' : 'return_refuted';
    }
  } else if (stage === 'continue') {
    keep = false;
    const moved = u.predicted?.some((v, i) => v && !equal(v, from[i]!) && equal(v, to[i]!));
    result = moved ? 'continuation_verified' : 'continuation_refuted';
  }
  const evidence = compareSiteArms(u.baseline, u.exposed);
  if (live && (stage === 'exercise' || stage === 'control') && Object.values(evidence).some(Boolean)) {
    const i = evidence.recipient || evidence.displacedRecipient ? 1 : 0,
      arm = u.exposed!;
    state.facts[siteFactKey(p.roles, p.operand)] = {
      ref: a.revision,
      delta: diff(arm.to[i]!, arm.from[i]!),
      control: p.control.delta,
      driver: i === 0,
      setup: diff(arm.from[i]!, u.baseline!.from[i]!),
    };
  }
  state.active = keep ? u : null;
  return {
    result: 'site_' + result,
    detail: {
      plan: p,
      stage,
      index: t.index,
      chosen: t.chosen,
      bareRef: u.bareRef,
      siteRef: u.siteRef,
      back: t.back,
      backTo: t.backTo,
      baseline: baselineUsed,
      exposed: u.exposed,
      operandRef: u.operandRef,
      from,
      to,
      predicted: t.predicted,
      evidence,
      won,
      ref: a.revision,
    },
  };
}
