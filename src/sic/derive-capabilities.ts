import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { Edge, Memory, Experiment } from './preparation-experiments.ts';
import { add, diff, point, same, size, type XY } from './access-terrain.ts';
import {
  applyOperator,
  translation,
  compose,
  inverse,
  inferCapability,
  posesMatch,
  type PoseOperator,
} from './capability-equations.ts';

type Step = { op: string; after: XY[] };
export type Capability = {
  kind: 'remote' | 'bypass' | 'product';
  roles: string[];
  initial: XY[];
  effect: PoseOperator;
  goal: XY[];
  program: Step[];
  control: string;
  basis: string;
  key: string;
  refs: number[];
  origin: number;
  direct: XY[] | null;
  opportunity: {
    op: string;
    role: number;
    forecast: XY[];
    without: XY[];
    closer: number;
    newPlace: boolean;
  } | null;
  inverseStatus: 'witnessed' | 'inferred';
  localBlocked: boolean;
  newPrimitive: boolean;
  score: number;
  transport: PoseOperator;
  primitive: PoseOperator;
};
export type CapabilityTrial = {
  claim: Capability;
  index: number;
  choices: { kind: string; roles: string[]; goal: XY[]; control: string; score: number }[];
};
export type CapabilityMemory = {
  active: CapabilityTrial | null;
  tried: Record<string, number>;
  failed: Record<string, number>;
  follow: Capability | null;
  layouts: Record<
    string,
    {
      roles: string[];
      initial: XY[];
      goal: XY[];
      program: string[];
      kind: string;
      revision: number;
      access?: XY[];
    }
  >;

  learned: Record<string, { claim: Capability; revision: number; uses: number }>;
};
export const freshCapabilities = (): CapabilityMemory => ({
  active: null,
  tried: {},
  failed: {},
  learned: {},
  follow: null,
  layouts: {},
});
function measured(e: Edge, roles: string[]) {
  if (roles.some((id) => !e.anchors[id] || !e.visibleAfter?.includes(id))) return null;
  const start = roles.map((id) => point(e.anchors[id]!.at));
  const end = roles.map((id, i) => {
    const v = e.effect.moves.find((m) => m.actor === id);
    return v ? point(v.to) : start[i]!;
  });
  return { start, end, deltas: start.map((p, i) => diff(end[i]!, p)) };
}
const current = (o: NativeObservation, roles: string[]) => {
  const pts = roles.map(
    (id) => o.entities.find((e) => e.signature === id && !e.identity_ambiguous)?.position
  );
  return pts.every(Boolean) ? pts.map((p) => [...p!] as XY) : null;
};
type Bridge = {
  roles: string[];
  p: PoseOperator;
  op: string;
  undo: string;
  repeat: number;
  inverseStatus: 'witnessed' | 'inferred';
  refs: number[];
  bypass: boolean;
  origin: number;
};
function bridges(edges: Edge[], o: NativeObservation, s: number, available: Set<string>) {
  const visible = new Map(o.entities.filter((e) => !e.identity_ambiguous).map((e) => [e.signature, e]));
  const reverse = new Map<string, Edge[]>();
  for (const e of edges) {
    const k = e.s + '/' + e.t,
      list = reverse.get(k) ?? [];
    list.push(e);
    reverse.set(k, list);
  }
  const opposite = new Map<string, Edge>();
  for (const e of edges)
    if (available.has(e.cmd))
      for (const v of e.effect.moves) {
        const k = [v.actor, v.dx, v.dy].join('/');
        if (!opposite.has(k)) opposite.set(k, e);
      }
  const result = new Map<string, Bridge>();
  function keep(b: Bridge) {
    const k = [b.roles, b.p.source, ...b.p.offset, b.op, b.undo].join('/');
    const prev = result.get(k);
    if (
      !prev ||
      (prev.inverseStatus === 'inferred' && b.inverseStatus === 'witnessed') ||
      (prev.inverseStatus === b.inverseStatus && b.origin === s)
    )
      result.set(k, b);
  }
  for (const e of edges) {
    if (e.s === e.t || !available.has(e.cmd)) continue;
    const ret = reverse.get(e.t + '/' + e.s)?.find((r) => available.has(r.cmd));
    for (const m of e.effect.moves) {
      if (!visible.has(m.actor)) continue;
      const back = ret?.effect.moves.some((v) => v.actor === m.actor && v.from === m.to && v.to === m.from)
        ? ret
        : opposite.get([m.actor, -m.dx, -m.dy].join('/'));
      if (!back || back.cmd === e.cmd) continue;
      keep({
        roles: [m.actor],
        p: translation([[m.dx, m.dy]]),
        op: e.cmd,
        undo: back.cmd,
        repeat: 1,
        inverseStatus: back === ret ? 'witnessed' : 'inferred',
        refs: [e.ref, back.ref],
        bypass: true,
        origin: e.s,
      });
    }
    const moved = e.effect.moves.filter(
      (m) =>
        visible.has(m.actor) &&
        (!ret || ret.effect.moves.some((v) => v.actor === m.actor && v.to === m.from && v.from === m.to))
    );
    if (moved.length < 2 || moved.length > 20) continue;
    const center = (id: string, at: string): XY => {
      const q = visible.get(id)!,
        p = point(at);
      return [p[0] + (q.bbox[2] - q.position[0]) / 2, p[1] + (q.bbox[3] - q.position[1]) / 2];
    };
    const fits = (a: XY, b: XY) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) <= 1;
    function cycle(path: typeof moved) {
      const first = path[0]!,
        last = path.at(-1)!;
      if (path.length >= 2 && fits(center(last.actor, last.to), center(first.actor, first.from))) {
        const roles = path.map((v) => v.actor);
        if (roles[0] !== [...roles].sort()[0]) return;
        const source = roles.map((_, i) => (i + 1) % roles.length);
        const offset = path.map((v, i) => diff(point(v.to), point(path[source[i]!]!.from)));
        if (offset.reduce((p, q) => add(p, q), [0, 0] as XY).some(Boolean)) return;
        // A finite role permutation predicts a candidate inverse even before any inverse was tried.
        // The observed frames still have to verify every step of the resulting program.
        keep({
          roles,
          p: { source, offset },
          op: e.cmd,
          undo: ret?.cmd ?? e.cmd,
          repeat: ret ? 1 : roles.length - 1,
          inverseStatus: ret ? 'witnessed' : 'inferred',
          refs: ret ? [e.ref, ret.ref] : [e.ref],
          bypass: false,
          origin: e.s,
        });
        return;
      }
      if (path.length >= 4) return;
      for (const v of moved)
        if (
          !path.includes(v) &&
          v.actor >= first.actor &&
          fits(center(last.actor, last.to), center(v.actor, v.from))
        )
          cycle([...path, v]);
    }
    for (const v of moved) cycle([v]);
  }
  return [...result.values()];
}
type Primitive = { op: string; u: PoseOperator; refs: number[]; support: number };
function primitives(edges: Edge[], roles: string[], ops: Set<string>) {
  const models = new Map<string, Primitive>();
  for (const e of edges) {
    if (!ops.has(e.cmd)) continue;
    const sample = measured(e, roles);
    if (!sample || sample.deltas.filter((v) => size(v) > 0).length !== 1) continue;
    const k = [e.cmd, ...sample.deltas].join('|'),
      m = models.get(k);
    if (m) {
      m.support++;
      continue;
    }
    models.set(k, { op: e.cmd, u: translation(sample.deltas), refs: [e.ref], support: 1 });
  }
  return [...models.values()].sort((a, b) => b.support - a.support);
}
function generate(m: Memory, o: NativeObservation, rows: NativeRows, ops: Set<string>, s: number) {
  const edges = m.edges.filter((e) => e.stable),
    local = edges.filter((e) => e.s === s);
  const occupied = new Map<string, Set<string>>(),
    joint = new Set<string>();
  for (const e of edges)
    for (const v of e.effect.moves) {
      const sites = occupied.get(v.actor) ?? new Set<string>();
      sites.add(v.from);
      sites.add(v.to);
      occupied.set(v.actor, sites);
    }
  for (const saved of Object.values(m.equations.layouts)) joint.add([saved.roles, saved.goal].join('|'));
  const landmarks = o.entities.filter(
    (e) => !occupied.has(e.signature) && e.area < (rows.length * rows[0]!.length) / 10
  );
  function closer(from: XY, to: XY) {
    const dist = (p: XY, box: readonly number[]) =>
      Math.max(0, box[0]! - p[0], p[0] - box[2]!) + Math.max(0, box[1]! - p[1], p[1] - box[3]!);
    return landmarks.reduce(
      (best, e) =>
        Math.max(best, Math.min(10, dist(from, e.bbox) - dist(to, e.bbox)) / (1 + dist(to, e.bbox))),
      0
    );
  }
  const out = new Map<string, Capability>(),
    cache = new Map<string, Primitive[]>();
  const bounds = (id: string, p: XY) => {
    const e = o.entities.find((e) => e.signature === id)!;
    return (
      p[0] >= 0 &&
      p[1] >= 0 &&
      p[0] + e.bbox[2] - e.position[0] < rows[0]!.length &&
      p[1] + e.bbox[3] - e.position[1] < rows.length
    );
  };
  for (const bridge of bridges(edges, o, s, ops)) {
    const { roles, p } = bridge,
      here = current(o, roles)!;
    const already = local.find((e) => e.cmd === bridge.op),
      known = already && measured(already, roles);
    if (known && !posesMatch(known.end, applyOperator(p, here))) continue;
    const roleKey = roles.join('/'),
      all = cache.get(roleKey) ?? primitives(edges, roles, ops);
    cache.set(roleKey, all);
    for (const u of all) {
      if (u.op === bridge.op || u.op === bridge.undo) continue;
      const cap = inferCapability(p, u.u);
      const base = [...local].find((e) => e.cmd === u.op),
        bare = base ? measured(base, roles) : null;
      if (
        bridge.bypass &&
        (!bare ||
          !same(bare.start[0]!, bare.end[0]!) ||
          p.offset[0]![0] * u.u.offset[0]![1] === p.offset[0]![1] * u.u.offset[0]![0])
      )
        continue;
      if (!bridge.bypass && posesMatch(u.u.offset, cap.offset)) continue;
      const basis = [roleKey, bridge.op, u.op, bridge.undo, ...cap.offset].join('|');
      const learned = m.equations.learned[basis];
      if ((m.equations.failed[basis] ?? 0) >= 5 && !learned) continue;
      const fresh = !all.some((other) => posesMatch(other.u.offset, cap.offset));
      // Identify the missing capability before selecting programs that could realize it.
      const implied = applyOperator(cap, here);
      const localHas = (goal: XY[]) => local.some((e) => posesMatch(measured(e, roles)?.end ?? null, goal));
      const primitiveBlocked = !!bare && !posesMatch(implied, bare.end);
      const choices: (Primitive | null)[] = [null];
      if (learned && !bridge.bypass)
        choices.push(
          ...all
            .filter(
              (d) =>
                d.op !== bridge.op &&
                d.op !== bridge.undo &&
                d.u.offset.some((v, i) => size(v) > 0 && size(cap.offset[i]!) === 0)
            )
            .slice(0, 8)
        );
      for (const prefix of choices) {
        const effect = prefix ? compose(prefix.u, cap) : cap,
          goal = applyOperator(effect, here);
        if (localHas(goal) || posesMatch(here, goal)) continue;
        const kind = prefix ? 'product' : bridge.bypass ? 'bypass' : 'remote';
        const key = [basis, prefix?.op ?? '', here.join('/'), goal.join('/')].join('|');
        if (m.equations.tried[key]) continue;
        const terms = [
          ...(prefix ? [{ op: prefix.op, f: prefix.u }] : []),
          { op: bridge.op, f: p },
          { op: u.op, f: u.u },
          ...Array.from({ length: bridge.repeat }, () => ({
            op: bridge.undo,
            f: !bridge.bypass && bridge.inverseStatus === 'inferred' ? p : inverse(p),
          })),
        ];
        let expected = here;
        const program = terms.map((t) => {
          expected = applyOperator(t.f, expected);
          return { op: t.op, after: expected };
        });
        if (!posesMatch(expected, goal) || program.some((t) => t.after.some((v, i) => !bounds(roles[i]!, v))))
          continue;
        const control = prefix?.op ?? u.op,
          ctrl = local.find((e) => e.cmd === control);
        const refs = [
          ...new Set([
            ...bridge.refs,
            ...u.refs,
            ...(prefix?.refs ?? []),
            ...(ctrl ? [ctrl.ref] : []),
            ...(learned ? [learned.revision] : []),
          ]),
        ];
        // Prefer a missing controllable degree of freedom, then a measured blocked command, then a fresh layout.
        let opportunity: Capability['opportunity'] = null;
        if (!bridge.bypass) {
          const forecast = applyOperator(p, goal),
            without = applyOperator(p, here);
          for (let i = 0; i < roles.length; i++) {
            const dest = forecast[i]!;
            if (
              same(dest, without[i]!) ||
              !bounds(roles[i]!, dest) ||
              occupied.get(roles[i]!)?.has(dest.join())
            )
              continue;
            const gain = closer(without[i]!, dest);
            if (!opportunity || gain > opportunity.closer)
              opportunity = { op: bridge.op, role: i, forecast, without, closer: gain, newPlace: true };
          }
        }
        const score =
          (opportunity ? 14 + opportunity.closer : 0) -
          (joint.has([roles, goal].join('|')) ? 15 : 0) +
          (prefix ? 57 : learned ? 32 : 0) +
          (fresh ? 30 : 0) +
          (primitiveBlocked ? 25 : 0) +
          (!bridge.bypass ? 12 : 0) +
          (bridge.origin === s ? 12 : 0) +
          (bridge.inverseStatus === 'witnessed' ? 5 : 0) +
          Math.min(8, u.support) -
          (m.equations.failed[basis] ?? 0) * 10;
        const claim: Capability = {
          kind,
          roles,
          initial: here,
          effect,
          goal,
          program,
          control,
          basis,
          key,
          refs,
          origin: s,
          opportunity,
          inverseStatus: bridge.inverseStatus,
          direct: ctrl ? (measured(ctrl, roles)?.end ?? null) : null,
          localBlocked: primitiveBlocked,
          newPrimitive: fresh,
          score,
          transport: p,
          primitive: u.u,
        };
        const old = out.get(key);
        if (!old || old.score < score) out.set(key, claim);
      }
    }
  }
  return [...out.values()].sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
}

export function proposeCapability(
  m: Memory,
  o: NativeObservation,
  rows: NativeRows,
  ops: Set<string>,
  s: number
): Experiment | null {
  const follow = m.equations.follow;
  if (
    follow?.opportunity &&
    posesMatch(current(o, follow.roles), follow.goal) &&
    ops.has(follow.opportunity.op)
  ) {
    const op = follow.opportunity.op;
    return {
      phase: 'capabilityUse',
      a: op,
      b: op,
      origin: s,
      rule: follow.basis,
      refs: follow.refs,
      equation: { claim: follow, index: follow.program.length, choices: [] },
    };
  }
  let trial = m.equations.active;
  if (
    trial &&
    !posesMatch(
      current(o, trial.claim.roles),
      trial.index ? trial.claim.program[trial.index - 1]!.after : trial.claim.initial
    )
  ) {
    m.equations.active = null;
    trial = null;
  }
  if (!trial) {
    if (m.recurrences < 1 || m.turns < 3 || m.turns % 6 === 0) return null;
    const options = generate(m, o, rows, ops, s),
      claim = options[0];
    if (!claim) return null;
    trial = {
      claim,
      index: 0,
      choices: options
        .slice(1, 5)
        .map((c) => ({ kind: c.kind, roles: c.roles, goal: c.goal, control: c.control, score: c.score })),
    };
  }
  const step = trial.claim.program[trial.index]!;
  if (!ops.has(step.op)) return null;
  return {
    phase: 'capabilityStep',
    a: step.op,
    b: step.op,
    origin: s,
    rule: trial.claim.basis,
    refs: trial.claim.refs,
    equation: trial,
  };
}
export function recordCapability(m: Memory, x: Experiment, a: NativeObservation, b: NativeObservation) {
  const { claim: c, index, choices } = x.equation!,
    using = x.phase === 'capabilityUse',
    stage = using ? { after: c.opportunity!.forecast } : c.program[index]!,
    end = index + 1 === c.program.length,
    actual = current(a, c.roles);
  m.equations.active = null;
  m.equations.follow = null;
  m.equations.tried[c.key] = a.revision;
  let result: string;
  if (a.levels_completed > b.levels_completed || a.state === 'WIN') result = 'capability_official_completion';
  else if (using) {
    result =
      a.state === b.state && posesMatch(actual, stage.after)
        ? 'derived_access_verified'
        : 'derived_access_refuted';
    if (result === 'derived_access_verified' && m.equations.layouts[c.key])
      m.equations.layouts[c.key]!.access = stage.after;
  } else if (a.state !== b.state || !posesMatch(actual, stage.after)) {
    result = actual ? 'capability_prediction_refuted' : 'capability_identity_unresolved';
    m.equations.failed[c.basis] = (m.equations.failed[c.basis] ?? 0) + 1;
  } else if (!end) {
    result = 'capability_premise_verified';
    m.equations.active = { claim: c, index: index + 1, choices: [] };
  } else {
    result = 'derived_capability_verified';
    m.equations.layouts[c.key] = {
      roles: c.roles,
      initial: c.initial,
      goal: c.goal,
      program: c.program.map((s) => s.op),
      kind: c.kind,
      revision: a.revision,
    };
    if (c.opportunity) m.equations.follow = c;
    const prior = m.equations.learned[c.basis];
    // A product has its own effect; keep the constituent as the reusable atomic claim.
    if (c.kind !== 'product')
      m.equations.learned[c.basis] = { claim: c, revision: a.revision, uses: prior ? prior.uses + 1 : 0 };
    else if (prior) prior.uses++;
  }
  return {
    result,
    detail: {
      kind: c.kind,
      roles: c.roles,
      initial: c.initial,
      effect: c.effect,
      goal: c.goal,
      actual,
      stage: stage.after,
      transport: c.transport,
      primitive: c.primitive,
      program: c.program.map((k) => k.op),
      control: c.control,
      direct: c.direct,
      opportunity: c.opportunity,
      inverseStatus: c.inverseStatus,
      newPrimitive: c.newPrimitive,
      localBlocked: c.localBlocked,
      index,
      choices,
      score: c.score,
    },
  };
}
