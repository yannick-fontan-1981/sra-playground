import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import { add, diff, same, size, type XY } from './access-terrain.ts';
import { aligned } from './controlled-parts.ts';
import { cellMatches, spatialControls, surfaceFromVisits } from './calibrate-spatial-controls.ts';
import { visualLayout, type PreviewLearning, type VisualLayout } from './witnessed-preview-transfer.ts';
import type { Memory, Experiment } from './preparation-experiments.ts';

export type TerminalContact = {
  sourceDescriptor?: string;
  actor: string;
  marker: string;
  offset: XY;
  pitch: XY;
  before: string;
  after: string;
  at: XY;
  from: XY;
  destination: XY;
  q: string;
  support: number;
  peers: number;
};
export type TerminalTrial = {
  witness: TerminalContact;
  from: XY;
  to: XY;
  goal: XY;
  site: XY;
  fixed: XY[];
  peers: XY[];
  pitch: XY;
  op: string;
  distance: number;
  before: string;
  key: string;
};
const selectBody = (v: VisualLayout, p: string, last?: XY) =>
  v[p]?.length === 1 ? v[p]![0] : v[p]?.find((x) => last && same(x.at, last));
export function completionContacts(
  learn: PreviewLearning,
  b: NativeObservation,
  a: NativeObservation,
  layout: VisualLayout,
  op: string
) {
  const out: TerminalContact[] = [];
  if (!(a.levels_completed > b.levels_completed || a.state === 'WIN') || op.startsWith('ACTION6:'))
    return out;
  for (const [actor, motion] of Object.entries(learn.partMotion ?? {})) {
    const body = selectBody(layout, actor, learn.lastActor[actor]);
    if (!body) continue;
    const model = spatialControls(motion, new Set(b.available_action_refs), '', {}, b.frame_hash, actor),
      stroke = model?.motors.find((m) => m.op === op && m.support > 0);
    if (!model || !stroke) continue;
    const from = body.at,
      destination = add(from, stroke.d);
    for (const [marker, parts] of Object.entries(layout)) {
      if (marker === actor || parts.length > 12) continue;
      for (const part of parts) {
        if (!cellMatches(part.at, destination, model.pitch) || cellMatches(part.at, from, model.pitch))
          continue;
        out.push({
          actor,
          marker,
          offset: diff(part.at, destination),
          pitch: model.pitch,
          before: b.observation_ref,
          after: a.observation_ref,
          at: part.at,
          from,
          destination,
          q: op,
          support: stroke.support,
          peers: layout[actor]!.length - 1,
        });
      }
    }
  }
  return out.sort((a, b) => b.support - a.support || size(a.offset) - size(b.offset)).slice(0, 24);
}
export function offerTerminalContact(
  m: Memory,
  scene: number,
  o: NativeObservation,
  rows: NativeRows,
  available: Set<string>,
  hypotheses?: readonly TerminalContact[]
): Experiment | null {
  const learn = m.previewLearning,
    layout = visualLayout(o, rows);
  const choices=hypotheses??learn?.terminal;
  if (!learn || !choices?.length) return null;
  let winner: { trial: TerminalTrial; score: number } | null = null;
  const attempts = learn.goalAttempts ?? {};
  for (const w of choices) {
    const body = selectBody(layout, w.actor, learn.lastActor[w.actor]),
      motion = learn.partMotion?.[w.actor],
      markers = layout[w.marker];
    if (!body || !motion || !markers || markers.length > 12) continue;
    const p = body.at,
      peers = layout[w.actor]!.filter((z) => z !== body).map((z) => z.at);
    const model = spatialControls(motion, available, '', attempts, o.frame_hash, w.actor);
    if (!model) continue;
    const pitch = model.pitch,
      ground = surfaceFromVisits(motion.sites, rows, p, pitch, [p, ...peers]);
    const colors = Object.entries(motion.substrate).sort((a, b) => b[1] - a[1]),
      floor = ground ?? (colors[0] ? Number(colors[0][0]) : null);
    const known = new Set(
      Object.keys(motion.sites).map((k) => aligned(k.split(',').map(Number) as XY, p, pitch).join())
    );
    const moves = model.motors.filter((z) => z.support > 0 || available.size >= 4);
    for (const part of markers) {
      if (w.sourceDescriptor && !same(w.at,part.at)) continue;
      const goal = aligned(diff(part.at, w.offset), p, pitch);
      if (same(goal, p) || peers.some((z) => cellMatches(z, goal, pitch))) continue;
      if (learn.visitedContacts?.[JSON.stringify([w.actor, w.marker, part.at, peers])] !== undefined)
        continue;
      const queue = [p],
        seen = new Map<string, { first: string; to: XY; n: number; walked: boolean }>([
          [p.join(), { first: '', to: p, n: 0, walked: true }],
        ]);
      for (const u of queue) {
        if (same(u, goal)) break;
        const parent = seen.get(u.join())!;
        for (const d of moves) {
          const v = add(u, d.d),
            k = v.join();
          if (
            seen.has(k) ||
            v[0] < 0 ||
            v[1] < 0 ||
            v[0] >= 2 * rows[0]!.length ||
            v[1] >= 2 * rows.length ||
            peers.some((z) => cellMatches(z, v, pitch))
          )
            continue;
          const target = same(v, goal);
          if (
            !target &&
            !known.has(k) &&
            (floor === null || rows[Math.floor(v[1] / 2)]![Math.floor(v[0] / 2)] !== floor)
          )
            continue;
          const first = parent.n ? parent.first : d.op;
          if (attempts[JSON.stringify([o.frame_hash, w.actor, w.marker, part.at, first])] !== undefined)
            continue;
          seen.set(k, {
            first,
            to: parent.n ? parent.to : v,
            n: parent.n + 1,
            walked: parent.walked && (target || known.has(k)),
          });
          queue.push(v);
        }
      }
      const route = seen.get(goal.join());
      if (!route?.n) continue;
      if (route.n > 1 && m.localProgress?.active) continue;
      if (route.n > 2 && !route.walked && m.localProgress?.foreignArrival?.actor !== w.actor) continue;
      const key = JSON.stringify([o.frame_hash, w.actor, w.marker, part.at, route.first]),
        terminal = route.n === 1;
      const score =
        32 * Number(terminal) +
        8 * Number(m.localProgress?.realizedPlacement?.actor === w.actor) +
        Math.min(6, w.support) -
        2 * route.n -
        size(w.offset) / Math.max(1, pitch[0]);
      if (!winner || score > winner.score)
        winner = {
          score,
          trial: {
            witness: w,
            from: p,
            to: route.to,
            goal,
            site: part.at,
            peers,
            fixed: markers.filter((z) => z !== part).map((z) => z.at),
            pitch,
            op: route.first,
            distance: route.n,
            before: o.observation_ref,
            key,
          },
        };
    }
  }
  if (!winner) return null;
  const trial = winner.trial;
  return {
    phase: 'seekTerminalContact',
    origin: scene,
    a: trial.op,
    b: trial.op,
    rule: trial.witness.sourceDescriptor ? 'test_a_contact_observed_at_completion_in_source_families'
      : 'approach_the_visible_contact_that_preceded_official_completion',
    refs: [],
    terminalContact: trial,
  };
}
export function measureTerminalContact(
  learn: PreviewLearning,
  trial: TerminalTrial,
  b: NativeObservation,
  a: NativeObservation,
  op: string,
  after: VisualLayout
) {
  const won = a.levels_completed > b.levels_completed || a.state === 'WIN',
    group = after[trial.witness.actor] ?? [];
  const others = group.filter((z) => !trial.peers.some((v) => cellMatches(z.at, v, trial.pitch)));
  const actual =
    others.length === 1 &&
    group.length === trial.peers.length + 1 &&
    trial.peers.every((v) => group.some((z) => cellMatches(z.at, v, trial.pitch)))
      ? others[0]!.at
      : null;
  const live = b.observation_ref === trial.before && trial.op === op;
  const matched = live && (won || cellMatches(actual, trial.to, trial.pitch));
  if (trial.witness.sourceDescriptor) {
    if (matched && !won && trial.distance>1) learn.pendingSourceContact={frame:a.frame_hash,witness:trial.witness};
    else delete learn.pendingSourceContact;
  }
  (learn.goalAttempts ??= {})[trial.key] = a.revision;
  if (live && matched && !won && trial.distance === 1)
    (learn.visitedContacts ??= {})[
      JSON.stringify([trial.witness.actor, trial.witness.marker, trial.site, trial.peers])
    ] = a.revision;
  return { trial, won: won && live, matched, actual: won ? null : actual };
}
