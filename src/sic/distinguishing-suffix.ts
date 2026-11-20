import type { NativeObservation } from '../logos-engine/v6-native-types.ts';
import type { Edge, Experiment, Memory } from './preparation-experiments.ts';
import { add, diff, point, size } from './access-terrain.ts';

type Reading = { op: string; from: string; to: string; ref: number };
type Trial = {
  prep: string;
  prepRef: number;
  direct: boolean;
  bare: number;
  start: number;
  actor: string;
  sequence: Reading[];
  index: number;
  alternativeRef: number;
  predicted: string;
  reuseRef?: number;
  nextScene: number;
  use?: string;
};
export type DelayedTrial = Trial;
export type DelayedMemory = {
  history: number[];
  active: Trial | null;
  tested: Record<string, boolean>;
  learned: Record<string, { delta: string; ref: number }>;
  last: number;
};
export const newDelayedMemory = (): DelayedMemory => ({
  history: [],
  active: null,
  tested: {},
  learned: {},
  last: -1,
});
const programKey = (scene: number, seq: Reading[]) => JSON.stringify([scene, seq.map((s) => s.op)]);
const ruleKey = (t: Trial, index: number) =>
  JSON.stringify([
    t.prep,
    t.actor,
    t.sequence.slice(0, index + 1).map((s) => s.op),
    diff(point(t.sequence[index]!.to), point(t.sequence[index]!.from)),
  ]);
const at = (o: NativeObservation, id: string) =>
  o.entities.find((e) => !e.identity_ambiguous && e.signature === id)?.position.join();
function reading(edge: Edge, actor: string): Reading | null {
  if (!edge.anchors[actor] || !edge.visibleAfter?.includes(actor)) return null;
  const from = edge.anchors[actor]!.at;
  return {
    op: edge.cmd,
    from,
    to: edge.effect.moves.find((v) => v.actor === actor)?.to ?? from,
    ref: edge.ref,
  };
}

export function selectDelayed(
  m: Memory,
  o: NativeObservation,
  scene: number,
  available: Set<string>
): Experiment | null {
  const memory = m.delayed;
  function offer(t: Trial): Experiment | null {
    const op = t.use ?? t.sequence[t.index]!.op;
    if (t.nextScene !== scene || !available.has(op)) return null;
    return {
      phase: 'delayedProbe',
      origin: scene,
      a: op,
      b: op,
      rule: 'distinguish_prepared_and_bare_futures',
      refs: [
        ...new Set([
          t.prepRef,
          t.alternativeRef,
          ...t.sequence.map((s) => s.ref),
          ...(t.reuseRef ? [t.reuseRef] : []),
        ]),
      ],
      delayed: t,
    };
  }
  if (memory.active) {
    const keep = offer(memory.active);
    if (keep) return keep;
    memory.active = null;
  }
  if (m.turns < 6 || m.recurrences < 2 || m.turns - memory.last < 4) return null;
  // Start from a measured intervention ending here. The control program must have
  // been executed contiguously from its exact origin before the current decision.
  const roots = new Map<number, Edge>();
  for (const e of m.edges)
    if (e.stable && e.t === scene && e.s !== scene && !e.effect.key.startsWith('terminal:'))
      roots.set(e.s, e);
  const previous = m.edges[m.previous];
  if (previous?.stable && previous.t === scene && previous.s !== scene) roots.set(previous.s, previous);
  if (!roots.size) return null;
  const motion = new Map<string, { edge: Edge; actor: string; from: string; to: string }[]>();
  const samples = new Set<string>();
  for (const e of m.edges)
    if (e.stable)
      for (const v of e.effect.moves) {
        const id = JSON.stringify([e.cmd, v.actor, v.from, v.to]);
        if (samples.has(id)) continue;
        samples.add(id);
        const entry = motion.get(e.cmd) ?? [];
        entry.push({ edge: e, actor: v.actor, from: v.from, to: v.to });
        motion.set(e.cmd, entry);
      }
  const positions = new Map(
    o.entities.filter((e) => !e.identity_ambiguous).map((e) => [e.signature, e.position.join()])
  );
  const observed = new Map(m.edges.map((e) => [e.s + '|' + e.cmd, e]));
  const history = memory.history;
  let best: { rank: number; t: Trial } | null = null;
  for (let j = 0; j + 1 < history.length; j++) {
    const first = m.edges[history[j]!]!,
      prep = roots.get(first.s);
    if (!prep || !available.has(first.cmd)) continue;
    let treated: number | undefined = scene;
    const path: Edge[] = [];
    for (let k = j; k < Math.min(j + 5, history.length); k++) {
      const e = m.edges[history[k]!]!;
      if (!e.stable || e.effect.key.startsWith('terminal:') || (path.length && path.at(-1)!.t !== e.s)) break;
      path.push(e);
      const known: Edge | undefined = treated === undefined ? undefined : observed.get(treated + '|' + e.cmd);
      if (known && !known.stable) break;
      treated = known?.t;
      if (treated === e.t) break; // Same public state erases the measured preparation.
      if (path.length < 2 || treated !== undefined) continue;
      const commands = path.map((v) => v.cmd);
      if (memory.tested[JSON.stringify([scene, commands])]) continue;
      // One previously moving body supplies the envisaged capability. Its start
      // must match across arms. A still prefix is allowed to carry information.
      for (const alt of motion.get(e.cmd) ?? []) {
        const actor = alt.actor;
        if (positions.get(actor) !== first.anchors[actor]?.at || !first.anchors[actor]) continue;
        const seq = path.map((step) => reading(step, actor));
        if (seq.some((r) => !r)) continue;
        const sequence = seq as Reading[],
          last = sequence.at(-1)!;
        if (sequence.some((r, i) => i > 0 && r.from !== sequence[i - 1]!.to)) continue;
        const d = diff(point(alt.to), point(alt.from));
        const predicted = add(point(last.from), d).join();
        if (predicted === last.to) continue;
        const t: Trial = {
          prep: prep.cmd,
          prepRef: prep.ref,
          bare: prep.s,
          start: scene,
          actor,
          sequence,
          index: 0,
          direct: prep === previous,
          alternativeRef: alt.edge.ref,
          predicted,
          nextScene: scene,
        };
        const learned = memory.learned[ruleKey(t, sequence.length - 1)];
        if (learned) {
          t.predicted = add(point(last.from), point(learned.delta)).join();
          t.reuseRef = learned.ref;
        }
        const rank =
          (learned ? 90 : 0) +
          (t.direct ? 32 : 0) +
          (alt.from === last.from ? 18 : 0) +
          (last.to === last.from ? 8 : 0) +
          Math.min(20, size(d)) +
          (prep.effect.moves.some((v) => v.actor !== actor) ? 5 : 0) -
          2 * path.length;
        if (!best || rank > best.rank) best = { rank, t };
      }
    }
  }
  return best ? offer(best.t) : null;
}

export function recordDelayed(
  m: Memory,
  t: Trial,
  e: Edge,
  b: NativeObservation,
  a: NativeObservation,
  won: boolean
) {
  const memory = m.delayed,
    step = t.sequence[t.index]!,
    before = at(b, t.actor),
    after = at(a, t.actor);
  memory.active = null;
  memory.tested[programKey(t.start, t.sequence)] = true;
  memory.last = m.turns;
  const sameStart = before === step.from,
    alive = b.level_epoch === a.level_epoch && a.state === b.state;
  const last = t.index === t.sequence.length - 1;
  const compared = !t.use && !won && alive && sameStart && after !== undefined;
  const predictedMatched = compared && last ? after === t.predicted : null;
  if (t.reuseRef && predictedMatched === false) delete memory.learned[ruleKey(t, t.index)];
  let result: string;
  if (won) result = 'official_completion';
  else if (!alive || !before || !after) result = 'delayed_unobservable';
  else if (t.use) result = before !== after ? 'delayed_followup_moved' : 'delayed_followup_still';
  else if (!sameStart) result = 'delayed_unmatched_origin';
  else if (after !== step.to) {
    result =
      before === after
        ? 'delayed_motion_suppressed'
        : t.direct
          ? 'delayed_access_observed'
          : 'delayed_distinct_arrival';
    if (before !== after) {
      const delta = diff(point(after), point(before)).join();
      if (t.direct) memory.learned[ruleKey(t, t.index)] = { delta, ref: a.revision };
      const next = m.edges.find(
        (v) =>
          v.stable &&
          v.anchors[t.actor]?.at === after &&
          v.effect.moves.some((z) => z.actor === t.actor) &&
          a.available_action_refs.includes(v.cmd.split(':')[0]!)
      );
      if (next) memory.active = { ...t, nextScene: e.t, use: next.cmd };
    }
  } else if (t.index + 1 < t.sequence.length) {
    result = 'delayed_prefix_matched';
    memory.active = { ...t, index: t.index + 1, nextScene: e.t };
  } else result = 'delayed_matched_control';
  return {
    result,
    detail: {
      prep: t.prep,
      prepRef: t.prepRef,
      preparedImmediately: t.direct,
      predictedMatched,
      controlScene: t.bare,
      treatmentScene: t.start,
      role: t.actor,
      baseline: t.sequence,
      step: t.index,
      alternativeRef: t.alternativeRef,
      predicted: t.predicted,
      reuseRef: t.reuseRef ?? null,
      follow: t.use ?? null,
      before: before ?? null,
      after: after ?? null,
    },
  };
}
