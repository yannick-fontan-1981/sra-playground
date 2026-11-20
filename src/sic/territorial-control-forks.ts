import type { NativeObservation } from '../logos-engine/v6-native-types.ts';
import { observedPositionAfter } from './witnessed-capacity-word.ts';
import { sceneKey, type Memory } from './preparation-experiments.ts';
import type { TerritorialTrial } from './pursue-territory.ts';
import { add, diff, same, size, type XY } from './access-terrain.ts';
import type { Territory } from './controllable-territory.ts';
import { groupsOf, resolveRole, type Role } from './exchange-roles.ts';
import {
  controlStudy,
  openControlForks,
  forkKey,
  learnControl,
  predictControl,
  checkControl,
  type ControlFork,
  type ControlStudy,
} from './matched-control-experiment.ts';

type Intention = ControlFork;
export type TerritorialControl = { study: ControlStudy; setups: Record<string, number> };
export type ControlTicket =
  | { kind: 'setup'; intent: Intention }
  | { kind: 'compare'; fork: ControlFork }
  | { kind: 'predict'; rule: number; forecast: XY; subject: Role; reference: Role; scene: string };
const identity = forkKey;
const fresh = (): TerritorialControl => ({ study: controlStudy(), setups: {} });
function preparation(
  m: Memory,
  scene: number,
  goal: Territory,
  available: Set<string>,
  state: TerritorialControl,
  o: NativeObservation
) {
  const history = m.delayed.history,
    now = o.revision,
    incoming = history.length;
  let best: { intent: Intention; score: number } | null = null;
  const known = m.edges.filter((e) => e.stable && e.s === scene && e.s !== e.t);
  if (!known.length) return null;
  for (let j = incoming - 2; j >= 0; j--) {
    const a = m.edges[history[j]!]!,
      q = m.edges[history[j + 1]!]!,
      ref = now - incoming + j + 1;
    if (
      a.s !== scene ||
      !a.stable ||
      !q.stable ||
      a.t !== q.s ||
      !available.has(q.cmd) ||
      m.revisionScene[ref - 1] !== scene ||
      m.revisionScene[ref] !== a.t ||
      m.revisionScene[ref + 1] !== q.t
    )
      continue;
    for (const alternative of known) {
      if (
        !available.has(alternative.cmd) ||
        alternative.cmd === a.cmd ||
        alternative.t === a.t ||
        m.edges.some((e) => e.s === alternative.t && e.cmd === q.cmd)
      )
        continue;
      const movable = [...(a.manipulation?.moves ?? []), ...(alternative.manipulation?.moves ?? [])];
      if (!movable.length) continue;
      const roles = new Map<string, Role>();
      // The traveller may enable a formerly still part or may be the beneficiary.
      for (const v of q.manipulation?.moves ?? []) roles.set(JSON.stringify(v.role), v.role);
      const actor = { signature: goal.actor, fixed: [] };
      roles.set(JSON.stringify(actor), actor);
      for (const { role: reference } of movable) {
        const r = observedPositionAfter(m, alternative, reference),
          other = observedPositionAfter(m, a, reference);
        if (!r || !other || same(r, other)) continue;
        for (const subject of roles.values()) {
          if (
            subject.signature === reference.signature ||
            (subject.signature !== goal.actor && reference.signature !== goal.actor)
          )
            continue;
          const p = observedPositionAfter(m, alternative, subject),
            peer = observedPositionAfter(m, a, subject),
            result = observedPositionAfter(m, q, subject);
          if (!p || !peer || !result || !same(p, peer)) continue;
          const score =
            Number(!same(result, p)) * 3 +
            Number(q.cmd === goal.rim.stroke.op) * 2 +
            Number(subject.signature === goal.actor);
          const intent: Intention = {
            root: m.scenes[scene]!,
            branch: m.scenes[alternative.t]!,
            otherBranch: m.scenes[a.t]!,
            prepare: alternative.cmd,
            rival: a.cmd,
            trigger: q.cmd,
            refs: [alternative.ref, ref, ref + 1],
            subject,
            reference,
            subjectAt: p,
            markerAt: r,
            otherMarker: other,
            otherResult: result,
            possible: same(result, p) ? [p] : [p, result],
            priority: score,
            firstMotion: !m.edges.some(
              (e) => e.stable && e.manipulation?.moves.some((v) => v.role.signature === subject.signature)
            ),
          };
          if (
            state.setups[identity(intent)] !== undefined ||
            state.study.examined[forkKey(intent)] !== undefined
          )
            continue;
          if (!best || score > best.score) best = { intent, score };
        }
      }
    }
  }
  return best?.intent ?? null;
}
export function territorialControl(
  m: Memory,
  o: NativeObservation,
  t: Territory,
  goal: TerritorialTrial['goal'],
  s: number,
  available: Set<string>
): TerritorialTrial | null {
  if (!m.territory || (t.rim.tested === null && t.basis !== 'translated_orbit') || m.recurrences === 0)
    return null;
  const state = (m.territory.control ??= fresh()),
    groups = groupsOf(o),
    here = m.scenes[s]!,
    aim = t.foothold;
  const roleAt = (r: Role): XY | null => {
    const e = resolveRole(groups, r);
    return e ? [...e.position] : null;
  };
  function trial(
    ticket: ControlTicket,
    op: string,
    ref: Role | null,
    position: XY | null,
    expected: XY | null,
    refs: number[],
    key: string
  ): TerritorialTrial {
    const kind =
      ticket.kind === 'setup'
        ? 'prepare_control'
        : ticket.kind === 'compare'
          ? 'compare_control'
          : 'reuse_control';
    return {
      goal,
      cursor: 0,
      control: ticket,
      choices: [{ kind, site: position, ideal: expected, arrival: aim }],
      plan: {
        kind,
        site: ref,
        siteAt: position,
        ideal: expected,
        landing: aim,
        refs,
        key,
        score: 1,
        program: [{ op, from: t.from, stage: 'interact' }],
      },
    };
  }
  for (const [i, rule] of state.study.rules.entries()) {
    const f = rule.fork,
      p = roleAt(f.subject),
      r = roleAt(f.reference);
    if (!p || !r || !available.has(f.trigger)) continue;
    const next = predictControl(rule, here, p, r);
    if (
      !next ||
      same(next, p) ||
      (size(diff(next, aim)) >= size(diff(p, aim)) && size(diff(next, t.rim.p)) >= size(diff(p, t.rim.p)))
    )
      continue;
    const ticket: ControlTicket = {
      kind: 'predict',
      rule: i,
      forecast: next,
      subject: f.subject,
      reference: f.reference,
      scene: here,
    };
    return trial(
      ticket,
      f.trigger,
      f.reference,
      r,
      null,
      [...f.refs, rule.measuredAt],
      JSON.stringify([i, here, 'reuse'])
    );
  }
  const offers = openControlForks(m, o, s, available).filter((f) => {
    if (state.study.examined[forkKey(f)] !== undefined) return false;
    if (f.subject.signature !== t.actor && f.reference.signature !== t.actor) return false;
    return true;
  });
  let best: ControlFork | undefined,
    max = -Infinity;
  for (const f of offers) {
    const reaches = f.possible.some((p) => t.foreign.has(p[1] * t.width + p[0]));
    const score =
      Number(f.subject.signature === t.actor && reaches) * 12 +
      f.priority +
      Number(f.trigger === t.rim.stroke.op) * 2 +
      Number(f.subject.signature === t.actor);
    if (score > max) {
      best = f;
      max = score;
    }
  }
  if (best)
    return trial(
      { kind: 'compare', fork: best },
      best.trigger,
      best.reference,
      best.markerAt,
      null,
      best.refs,
      forkKey(best)
    );
  const intent = preparation(m, s, t, available, state, o);
  if (!intent) return null;
  const t0 = trial(
    { kind: 'setup', intent },
    intent.prepare,
    intent.reference,
    roleAt(intent.reference),
    null,
    intent.refs,
    identity(intent)
  );
  t0.plan.program.push({ op: intent.trigger, stage: 'interact' });
  return t0;
}
export function recordTerritorialControl(
  m: Memory,
  ticket: ControlTicket,
  a: NativeObservation,
  live: boolean,
  cursor: number
) {
  const state = m.territory!.control!;
  if (ticket.kind === 'setup' && cursor === 0) {
    const intent = ticket.intent;
    state.setups[identity(intent)] = a.revision;
    const g = groupsOf(a),
      p = resolveRole(g, intent.subject),
      r = resolveRole(g, intent.reference);
    const matched =
      live &&
      sceneKey(a) === intent.branch &&
      !!p &&
      !!r &&
      same([...p.position], intent.subjectAt) &&
      same([...r.position], intent.markerAt);
    return { type: 'setup', live, matched };
  }
  const fork =
    ticket.kind === 'setup'
      ? {
          ...ticket.intent,
          refs: [a.revision - 1, ...ticket.intent.refs.slice(1)] as [number, number, number],
        }
      : ticket.kind === 'compare'
        ? ticket.fork
        : null;
  const subject = ticket.kind === 'predict' ? ticket.subject : fork!.subject;
  const actual = live ? resolveRole(groupsOf(a), subject)?.position : null,
    to: XY | null = actual ? [...actual] : null;
  if (ticket.kind !== 'predict') {
    const before = state.study.rules.length;
    learnControl(state.study, fork!, to, a.revision);
    return { type: 'compare', to, selective: state.study.rules.length > before };
  }
  checkControl(state.study.rules[ticket.rule]!, ticket.scene, to, ticket.forecast, a.revision);
  return { type: 'predict', to, forecast: ticket.forecast, exact: !!to && same(to, ticket.forecast) };
}
