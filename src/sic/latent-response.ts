import { add, diff, same, size, type XY } from './access-terrain.ts';
import { groupsOf, resolveRole, type Role } from './exchange-roles.ts';
import { frameEvidence } from './inverse-frame-experiment.ts';
import type { Memory, Experiment } from './preparation-experiments.ts';
import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';

export type Activation = {
  root: number;
  baseline: number;
  write: number;
  a: string;
  q: string;
  role: Role;
  anchor: string;
  from: XY;
  before: XY;
  placed: XY;
  prior: number | null;
  bare: number | null;
  expected: XY | null;
  useRef: number | null;
  key: string;
  binding: string;
  score: number;
};
export type ActivationReceipt = {
  binding: string;
  key: string;
  ref: number;
  q: string;
  role: Role;
  anchor: string;
  from: XY;
  placed: XY;
  before: XY;
  delta: XY | null;
  controlled: boolean;
};
const identity = (r: Role) => JSON.stringify([r.signature, r.fixed]);

// The unknown is whether Q can move this role at all. A second binding turns a measured response into a signed prediction.
export function offerActivation(
  m: Memory,
  o: NativeObservation,
  rows: NativeRows,
  s: number,
  available: Set<string>
): Experiment | null {
  const e = m.edges[m.previous];
  if (!e?.stable || e.s === e.t || e.t !== s || !e.manipulation?.moves.length) return null;
  const input = frameEvidence(m, o, rows, s, available);
  if (!input) return null;
  const pool = new Map<string, Role>();
  for (const roles of input.known.values()) for (const [id, role] of roles) pool.set(id, role);
  const shots = m.activations ?? [],
    tested = new Set(shots.map((r) => r.key)),
    offers: Activation[] = [];
  const ops = new Set([...o.available_action_refs.filter((k) => k !== 'ACTION6'), ...input.known.keys()]);
  for (const w of e.manipulation.moves) {
    if (w.role.fixed.length || same(w.from, w.to)) continue;
    const anchor = w.role.signature;
    for (const [id, role] of pool) {
      if (role.signature === anchor) continue;
      const was = input.effectAt(e.ref, role),
        cur = input.sample(input.now.g, s, role);
      if (
        !was ||
        !cur ||
        !same(was.from, was.to) ||
        !same(was.to, cur.from) ||
        !cur.anchors.has(anchor) ||
        same(cur.from, w.to)
      )
        continue;
      const binding = JSON.stringify([anchor, role, diff(w.to, cur.from)]),
        subject = cur.from;
      for (const q of ops) {
        if (q === e.cmd || m.edges.some((v) => v.s === s && v.cmd === q)) continue;
        const key = JSON.stringify([role, anchor, q, subject, w.to]);
        if (tested.has(key)) continue;
        const history = input.history.get(q + '/' + id) ?? [];
        if (
          history.some(
            (v) => v.anchors.has(anchor) && !same(v.from, v.to) && same(v.to, v.anchors.get(anchor)!)
          )
        )
          continue;
        const candidates = m.edges.filter((v) => v.cmd === q && v.stable);
        const opposite = candidates.find((v) => v.s === e.s);
        const control = opposite ? input.effectAt(opposite.ref, role) : null;
        if (control && !same(control.from, control.to)) continue;
        const local = candidates
          .map((v) => ({ v, move: input.effectAt(v.ref, role) }))
          .filter((x) => x.move && same(x.move.from, subject))
          .at(-1);
        const relevant = shots.filter((v) => v.q === q && v.anchor === anchor && identity(v.role) === id);
        // Failures at several distinct arrangements oppose re-trying the same ungrounded ability.
        if (relevant.length >= 2 && relevant.every((v) => !v.delta)) continue;
        const equivalent = relevant.filter(
          (v) => v.delta && (v.binding === binding || same(v.placed, w.to)) && !same(v.from, subject)
        );
        const elected = equivalent.at(-1);
        const expected =
          elected?.delta && equivalent.every((v) => same(v.delta!, elected.delta!))
            ? add(subject, elected.delta)
            : null;
        if (
          expected &&
          (expected[0] < 0 || expected[1] < 0 || expected[0] >= rows[0]!.length || expected[1] >= rows.length)
        )
          continue;
        const score =
          (expected ? 25 : 0) +
          (control ? 12 : 0) +
          (local ? 5 : 0) +
          (local && same(local.move!.from, local.move!.to) ? 3 : 0) +
          (!candidates.length ? 1 : 0) +
          (size(diff(subject, w.to)) > size(diff(w.to, w.from)) ? 1 : 0) +
          1 / (1 + role.fixed.length);
        offers.push({
          root: s,
          baseline: e.s,
          write: e.ref,
          a: e.cmd,
          q,
          role,
          anchor,
          from: subject,
          before: w.from,
          placed: w.to,
          prior: local?.v.ref ?? null,
          bare: control ? opposite!.ref : null,
          expected,
          useRef: expected ? elected!.ref : null,
          key,
          binding,
          score,
        });
      }
    }
  }
  offers.sort((a, b) => b.score - a.score);
  const p = offers[0];
  if (!p) return null;
  return {
    phase: 'activateResponse',
    origin: s,
    a: p.a,
    b: p.q,
    rule: p.expected
      ? 'transfer_a_measured_response_to_a_new_binding'
      : 'test_for_motion_after_an_independent_placement',
    refs: [...new Set([p.write, ...[p.prior, p.bare, p.useRef].filter((v): v is number => v !== null)])],
    activation: p,
  };
}

export function recordActivation(m: Memory, p: Activation, b: NativeObservation, a: NativeObservation) {
  const terminal = a.levels_completed > b.levels_completed || a.state === 'WIN';
  const v = a.state === b.state && a.level_epoch === b.level_epoch ? resolveRole(groupsOf(a), p.role) : null;
  const arrived: XY | null = v ? [...v.position] : null;
  const delta = arrived && !same(arrived, p.from) ? diff(arrived, p.from) : null;
  const receipt = {
    binding: p.binding,
    key: p.key,
    ref: a.revision,
    q: p.q,
    role: p.role,
    anchor: p.anchor,
    from: p.from,
    before: p.before,
    placed: p.placed,
    delta,
    controlled: p.bare !== null,
  };
  (m.activations ??= []).push(receipt);
  return {
    result: terminal ? 'activation_completion' : delta ? 'activation_motion' : 'activation_unconfirmed',
    detail: {
      plan: p,
      arrived,
      terminal,
      moved: !!delta,
      exact: !!p.expected && !!arrived && same(p.expected, arrived),
    },
  };
}
