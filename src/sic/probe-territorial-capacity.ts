import type { NativeObservation } from '../logos-engine/v6-native-types.ts';
import { same, size, diff, add, type XY } from './access-terrain.ts';
import { groupsOf, resolveRole } from './exchange-roles.ts';
import { witnessedWord } from './witnessed-capacity-word.ts';
import {
  wordAt,
  nextArm,
  recordArm,
  transferBinding,
  type Arm,
  type CapacityBinding,
  type WordQuestion,
} from './conditional-word-search.ts';
import { sceneKey, type Memory } from './preparation-experiments.ts';
import type { TerritorialTrial, TerritorialStep } from './pursue-territory.ts';

type Goal = TerritorialTrial['goal'];
type Pose = { p: XY | null; r: XY | null };
type Problem = {
  q: WordQuestion;
  goal: Goal;
  choices: TerritorialTrial['choices'];
  laws: CapacityBinding[];
  last: number;
  emptyMarker: boolean;
  originalFrame: string;
};
export type CapacityTicket = {
  problem: string;
  ordinal: number;
  arm: Arm | 'reuse';
  word: string[];
  preparation: string;
  rival: string;
  refs: number[];
  rootFrame: string;
  afterFirst: Pose | null;
  preceding: number | null;
  firstIsPreparation: boolean;
  expectedPatient: XY | null;
};
export type WordMemory = {
  problems: Record<string, Problem>;
  primed?: { id: string; ref: number; frame: string; pose: Pose };
  resume?: number;
  failedReturns?: Record<string, number>;
  reused: Record<string, number>;
};
const init = (): WordMemory => ({ problems: {}, reused: {} });
const pos = (x: readonly number[] | undefined): XY | null => (x ? [x[0]!, x[1]!] : null);
function poses(o: NativeObservation, actor: string, site: WordQuestion['site']): Pose {
  const g = groupsOf(o);
  return {
    p: pos(resolveRole(g, { signature: actor, fixed: [] })?.position),
    r: pos(resolveRole(g, site)?.position),
  };
}
function harvest(m: Memory, p: Problem, revision: number) {
  const q = p.q;
  while (true) {
    const n = q.ordinal,
      w = wordAt(q.alphabet, n),
      existing = q.observations[n];
    const root = existing?.prepared?.frame ?? existing?.bare?.frame ?? p.originalFrame;
    for (const arm of ['bare', 'prepared', 'durationControl'] as const) {
      if (q.observations[n]?.[arm]) continue;
      const full = arm === 'bare' ? w : [arm === 'prepared' ? q.prepare : q.rival, ...w];
      const sample = witnessedWord(m, root, full, revision, q.traveller, q.site, arm !== 'bare');
      if (!sample) continue;
      const law = recordArm(q, n, arm, sample);
      if (law?.sameScene) p.laws.push(law);
    }
    if (n === q.ordinal) return;
  }
}
function inHome(g: Goal, p: XY) {
  const n = p[1] * g.width + p[0];
  return (
    p[0] >= 0 &&
    p[0] < g.width &&
    p[1] >= 0 &&
    g.home.some(([a, k]) => n >= a && n < a + k * g.stride[0] && (n - a) % g.stride[0] === 0)
  );
}
export function openCapacityQuestion(
  m: Memory,
  t: TerritorialTrial,
  b: NativeObservation,
  a: NativeObservation
) {
  const site = t.plan.site,
    step = t.plan.program[t.cursor],
    ideal = t.plan.ideal;
  if (
    !site ||
    !ideal ||
    !step ||
    step.stage !== 'displace' ||
    a.state !== b.state ||
    a.level_epoch !== b.level_epoch
  )
    return;
  const s = (m.territory!.words ??= init()),
    before = poses(b, t.goal.actor, site),
    after = poses(a, t.goal.actor, site);
  if (!before.p || !after.p || !inHome(t.goal, before.p) || !inHome(t.goal, after.p)) return;
  const witness = before.r ?? step.marker ?? t.plan.siteAt;
  if (!witness) return;
  const actions = b.available_action_refs.filter((k) => k !== 'ACTION6').map(String);
  if (step.op.startsWith('ACTION6:')) actions.push(step.op);
  const worth = (op: string) => {
    let v = op === t.goal.ordinary && same(before.p!, t.goal.rim) ? 6 : 0;
    for (const e of m.edges)
      if (e.stable && e.cmd === op) {
        if (
          m.scenes[e.s]?.startsWith(b.frame_hash + '|') &&
          e.anchors[t.goal.actor]?.at === before.p!.join() &&
          !e.effect.moves.some((x) => x.actor === t.goal.actor)
        )
          v = Math.max(v, 5);
        for (const move of e.effect.moves) {
          const base =
            move.actor === t.goal.actor ? before.p : move.actor === site.signature ? before.r : null;
          if (!base) continue;
          const aim = move.actor === t.goal.actor ? t.goal.foothold : ideal;
          if (size(diff(add(base, [move.dx, move.dy]), aim)) < size(diff(base, aim))) v = Math.max(v, 3);
        }
      }
    return v + (op === step.op ? 0 : 0.25);
  };
  const alphabet = [...new Set(actions)]
    .map((op) => ({ op, v: worth(op) }))
    .sort((a, b) => b.v - a.v || a.op.localeCompare(b.op))
    .map((v) => v.op);
  if (alphabet.length < 2) return;
  const id = JSON.stringify([
    t.goal.actor,
    site.signature,
    before.p,
    before.r,
    witness,
    t.goal.foothold,
    ideal,
    step.op,
  ]);
  if (!s.problems[id]) {
    const prior = m.edges.filter(
      (e) =>
        e.stable &&
        e.cmd !== step.op &&
        alphabet.includes(e.cmd) &&
        e.anchors[t.goal.actor]?.at === before.p!.join()
    );
    const rival =
      prior.find((e) => !e.effect.moves.some((v) => v.actor === site.signature || v.actor === t.goal.actor))
        ?.cmd ?? alphabet.find((k) => k !== step.op)!;
    const q: WordQuestion = {
      id,
      alphabet,
      prepare: step.op,
      rival,
      site,
      traveller: t.goal.actor,
      patient: before.p,
      marker: witness,
      ideal,
      onset: a.revision,
      ordinal: 0,
      observations: {},
      uses: 0,
    };
    s.problems[id] = {
      q,
      goal: t.goal,
      choices: t.choices,
      laws: [],
      last: 0,
      emptyMarker: !before.r,
      originalFrame: b.frame_hash,
    };
  }
  harvest(m, s.problems[id]!, a.revision);
  s.primed = { id, ref: a.revision, frame: b.frame_hash, pose: after };
}
function trial(
  problem: Problem,
  now: Pose,
  ticket: CapacityTicket,
  ops: string[],
  ideal: XY,
  key: string
): TerritorialTrial {
  const { q, goal } = problem;
  const steps: TerritorialStep[] = ops.map((op, i) => ({
    op,
    stage: i + 1 === ops.length ? 'capacity_read' : 'capacity_input',
    ...(i === 0 ? { from: now.p! } : {}),
  }));
  return {
    goal: { ...goal, from: now.p! },
    choices: problem.choices,
    cursor: 0,
    capacity: ticket,
    plan: {
      kind: ticket.arm === 'reuse' ? 'capacity_reuse' : 'capacity_word',
      site: q.site,
      siteAt: now.r,
      ideal,
      landing: goal.foothold,
      program: steps,
      key,
      score: 1,
      refs: [q.onset, ...ticket.refs, ...(ticket.preceding ? [ticket.preceding] : [])],
    },
  };
}
function revisit(
  m: Memory,
  o: NativeObservation,
  p: Problem,
  now: Pose,
  target: string,
  available: Set<string>
): TerritorialTrial | null {
  const from = m.scenes.indexOf(sceneKey(o)),
    at = m.scenes.findIndex((s) => s.startsWith(target + '|'));
  if (from < 0 || at < 0 || at === from) return null;
  const outgoing = new Map<number, Map<string, (typeof m.edges)[number] | null>>();
  for (const e of m.edges)
    if (e.stable) {
      const row = outgoing.get(e.s) ?? new Map(),
        other = row.get(e.cmd);
      row.set(e.cmd, other === null || (other && other.t !== e.t) ? null : e);
      outgoing.set(e.s, row);
    }
  const seen = new Set([from]),
    queue = [from],
    parent = new Map<number, (typeof m.edges)[number]>();
  for (const current of queue) {
    if (current === at) break;
    for (const e of outgoing.get(current)?.values() ?? [])
      if (e && !seen.has(e.t) && (current !== from || available.has(e.cmd))) {
        seen.add(e.t);
        queue.push(e.t);
        parent.set(e.t, e);
      }
  }
  if (!parent.has(at)) return null;
  const program: TerritorialStep[] = [];
  let k = at;
  while (k !== from) {
    const edge = parent.get(k)!;
    program.push({
      op: edge.cmd,
      stage: 'capacity_return',
      expectedFrame: m.scenes[k]!.split('|')[0]!,
      ref: edge.ref,
    });
    k = edge.s;
  }
  program.reverse();
  return {
    goal: { ...p.goal, from: now.p! },
    plan: {
      kind: 'revisit_capacity',
      site: p.q.site,
      siteAt: now.r,
      ideal: p.q.ideal,
      landing: p.goal.foothold,
      program,
      key: JSON.stringify(['return', p.q.id, from, at, p.q.ordinal]),
      refs: program.map((s) => s.ref!),
      score: 1,
    },
    cursor: 0,
    choices: p.choices,
  };
}
export function offerCapacityWord(
  m: Memory,
  o: NativeObservation,
  available: Set<string>
): TerritorialTrial | null {
  const s = m.territory?.words;
  if (!s) return null;
  const primed = s.primed?.ref === o.revision ? s.primed : null;
  for (const p of Object.values(s.problems).sort(
    (a, b) => Number(b.q.id === primed?.id) - Number(a.q.id === primed?.id) || a.last - b.last
  )) {
    const q = p.q;
    if ((m.territory?.crossed ?? -1) > q.onset) continue;
    const now = poses(o, q.traveller, q.site);
    if (!now.p || !inHome(p.goal, now.p)) continue;
    for (const law of p.laws) {
      if (!now.r) continue;
      const prediction = transferBinding(law, now.r, now.p, q.ideal, p.goal.foothold);
      if (!prediction || !prediction.word.every((k) => available.has(k))) continue;
      const key = JSON.stringify(['reuse', q.id, now.p, now.r, law.refs]);
      if (s.reused[key] !== undefined) continue;
      return trial(
        p,
        now,
        {
          problem: q.id,
          ordinal: -1,
          arm: 'reuse',
          preparation: q.prepare,
          rival: q.rival,
          refs: law.refs,
          rootFrame: o.frame_hash,
          afterFirst: null,
          preceding: null,
          firstIsPreparation: false,
          expectedPatient: prediction.patient,
          word: prediction.word,
        },
        prediction.word,
        prediction.marker,
        key
      );
    }
    const ready = primed?.id === q.id,
      outcomes = q.observations[q.ordinal];
    const targetFrame = outcomes?.prepared?.frame ?? outcomes?.bare?.frame;
    if (!ready && targetFrame && targetFrame !== o.frame_hash) {
      const route = revisit(m, o, p, now, targetFrame, available);
      if (route && s.failedReturns?.[route.plan.key] === undefined) return route;
    }
    const markerMatches = p.emptyMarker ? o.frame_hash === p.originalFrame : !!now.r && same(now.r, q.marker);
    if (!ready && (!same(now.p, q.patient) || !markerMatches)) continue;
    const next = nextArm(q, ready);
    if (!next) continue;
    const prepend = !ready && next.arm !== 'bare',
      ops = prepend ? [next.arm === 'prepared' ? q.prepare : q.rival, ...next.word] : next.word;
    if (!ops.every((k) => available.has(k))) continue;
    const ticket: CapacityTicket = {
      problem: q.id,
      ordinal: next.ordinal,
      arm: next.arm,
      word: next.word,
      preparation: q.prepare,
      rival: q.rival,
      refs: [],
      rootFrame: ready ? primed!.frame : o.frame_hash,
      afterFirst: ready ? primed!.pose : null,
      preceding: ready ? primed!.ref : null,
      firstIsPreparation: prepend,
      expectedPatient: null,
    };
    return trial(p, now, ticket, ops, q.ideal, JSON.stringify(['word', q.id, next.ordinal, next.arm]));
  }
  return null;
}
export function recordCapacityWord(
  m: Memory,
  t: TerritorialTrial,
  b: NativeObservation,
  a: NativeObservation,
  entered: boolean,
  win: boolean
) {
  const s = m.territory!.words!,
    ticket = t.capacity!,
    p = s.problems[ticket.problem]!,
    q = p.q,
    after = poses(a, q.traveller, q.site);
  p.last = a.revision;
  delete s.primed;
  if (ticket.arm === 'reuse') s.reused[t.plan.key] = a.revision;
  const afterFirst = ticket.firstIsPreparation && t.cursor === 0 ? after : ticket.afterFirst;
  const live = a.state === b.state && a.level_epoch === b.level_epoch;
  const end = t.cursor + 1 === t.plan.program.length || !live || entered;
  if (!end) return { ...t, cursor: t.cursor + 1, capacity: { ...ticket, afterFirst } };
  if (ticket.arm === 'reuse') {
    q.uses++;
    return null;
  }
  // An early entry is a valid outcome of the prefix, not evidence for the as-yet unexecuted suffix.
  if (t.cursor + 1 !== t.plan.program.length) return null;
  const law = recordArm(q, ticket.ordinal, ticket.arm, {
    marker: live ? after.r : null,
    patient: live ? after.p : null,
    win,
    entered,
    frame: ticket.rootFrame,
    ref: a.revision,
    afterFirst,
  });
  if (law && law.sameScene) p.laws.push(law);
  harvest(m, p, a.revision);
  if (q.ordinal === ticket.ordinal) s.resume = a.revision;
  return null;
}
