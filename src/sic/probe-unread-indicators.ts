import type { NativeObservation } from '../logos-engine/v6-native-types.ts';
import { same, diff, type XY } from './access-terrain.ts';
import { poseRole, type PoseView, type PoseEdge, type OccupancyMemory } from './occupancy-programs.ts';
import type { Memory, Experiment } from './preparation-experiments.ts';

type Cue = {
  p: string;
  r: string;
  origin: XY;
  site: XY;
  independent: number;
  onset: number;
  newDisplay: boolean;
  ordinary: boolean;
  foreign: boolean;
};
export type IndicatorTest = {
  cue: Cue;
  op: string;
  word: string[];
  ref: number;
  stationary: number;
  moved: number;
  before: string;
};
export type IndicatorMemory = { pending: { cue: Cue; word: string[] } | null };
const aligned = (s: PoseView, v: Cue) => s[v.p] && s[v.r] && same(s[v.p]!, v.origin) && same(s[v.r]!, v.site);
const moving = (u: XY | undefined, z: XY | undefined) => !!(u && z && !same(u, z));
function chooseControl(m: OccupancyMemory, scene: number, cue: Cue, available: Set<string>, word: string[]) {
  const counts = new Map<string, number>();
  for (const op of word) counts.set(op, (counts.get(op) ?? 0) + 1);
  const clicks = new Set<string>();
  for (let i = m.edges.length - 1; i >= 0 && clicks.size < 2; i--) {
    const op = m.edges[i]!.op;
    if (op.startsWith('ACTION6:') && available.has(op)) clicks.add(op);
  }
  const keys = [...available].filter((op) => !op.startsWith('ACTION6:') || clicks.has(op));
  let best: {
    op: string;
    score: number;
    otherLand: boolean;
    elsewhere: boolean;
    ref: number;
    stationary: number;
    moved: number;
  } | null = null;
  for (const op of keys) {
    if (m.observed[scene + '/' + op] !== undefined || (counts.get(op) ?? 0) >= 2 || word.at(-1) === op)
      continue;
    let stationary = 0,
      motions = 0,
      elsewhere = false,
      otherLand = false;
    let ref = cue.independent;
    for (const e of m.edges) {
      if (e.unstable || e.op !== op) continue;
      const before = m.layouts[e.s]!,
        after = m.layouts[e.t]!,
        x = before[cue.p],
        y = after[cue.p];
      if (!x || !y) continue;
      if (same(x, y)) {
        stationary++;
        if (e.s !== e.t) elsewhere = true;
        ref = e.ref;
      } else motions++;
      if (!otherLand) {
        const sites = new Set(Object.values(before).map((v) => v.join()));
        otherLand = Object.entries(before).some(
          ([role, u]) => role !== cue.p && moving(u, after[role]) && sites.has(after[role]!.join())
        );
      }
    }
    const score = (stationary + 1) / (stationary + motions + 2) - (counts.get(op) ?? 0);
    if (
      best &&
      (score < best.score ||
        (score === best.score &&
          (Number(otherLand) < Number(best.otherLand) ||
            (otherLand === best.otherLand && Number(elsewhere) <= Number(best.elsewhere)))))
    )
      continue;
    best = { op, score, otherLand, elsewhere, ref, stationary, moved: motions };
  }
  return best;
}
function resemblance(a: readonly number[], b: readonly number[], area: number, other: number) {
  const w = a[2]! - a[0]! + 1,
    h = a[3]! - a[1]! + 1,
    x = b[2]! - b[0]! + 1,
    y = b[3]! - b[1]! + 1;
  return (
    ((w === x && h === y) || (w === y && h === x)) &&
    Math.abs(area - other) <= Math.max(1, Math.floor(Math.min(area, other) / 4))
  );
}
function firstCue(
  m: Memory,
  occ: OccupancyMemory,
  scene: number,
  o: NativeObservation,
  foreign: (id: string, at: XY) => boolean
): Cue[] {
  const edge = m.edges[m.previous];
  if (!edge || !edge.stable || edge.t !== scene || edge.s === scene) return [];
  const before = occ.layouts[edge.s],
    current = occ.layouts[scene];
  if (!before || !current) return [];
  const parts = new Map(o.entities.filter((e) => current[poseRole(e)]).map((e) => [poseRole(e), e]));
  const candidates: { cue: Cue; score: number }[] = [];
  for (const [p, actor] of parts) {
    const u = current[p]!,
      v = before[p];
    if (!v || !occ.visited[p]) continue;
    for (const [r, indicator] of parts) {
      const at = current[r]!,
        old = before[r];
      if (p === r || same(at, u) || !resemblance(actor.bbox, indicator.bbox, actor.area, indicator.area))
        continue;
      if (old && (same(at, old) || same(diff(at, old), diff(u, v)))) continue;
      if (Object.keys(occ.pairs[p + '/' + r]?.hits ?? {}).length) continue;
      if (Object.values(m.previewLearning?.bindings ?? {}).some((b) => b.actor === p && b.indicator === r))
        continue;
      let independent: PoseEdge | undefined,
        ordinary = false;
      const origins = new Set<string>();
      for (const e of occ.edges) {
        if (e.unstable) continue;
        const a = occ.layouts[e.s]!,
          z = occ.layouts[e.t]!,
          start = a[p],
          end = z[p];
        if (!start || !end || same(start, end)) continue;
        if (!a[r]) {
          independent ??= e;
          origins.add(start.join());
        }
        if (same(diff(end, start), diff(at, u))) ordinary = true;
      }
      if (!independent) continue;
      const crossing = foreign(p, at);
      const cue = {
        p,
        r,
        origin: u,
        site: at,
        independent: independent.ref,
        onset: edge.ref,
        newDisplay: !old,
        ordinary,
        foreign: crossing,
      };
      candidates.push({
        cue,
        score: 16 * Number(crossing) + 8 * Number(!ordinary) + 4 * Number(!old) + Math.min(3, origins.size),
      });
    }
  }
  return candidates.sort((a, b) => b.score - a.score).map((v) => v.cue);
}
export function offerUnreadIndicator(
  m: Memory,
  scene: number,
  o: NativeObservation,
  available: Set<string>,
  foreign: (id: string, at: XY) => boolean
): Experiment | null {
  const occ = m.occupancy,
    view = occ?.layouts[scene];
  if (!occ || !view || !occ.edges.length) return null;
  const state = (m.indicators ??= { pending: null });
  const active = state.pending && aligned(view, state.pending.cue) ? state.pending : null;
  const list = active ? [active.cue] : firstCue(m, occ, scene, o, foreign);
  for (const cue of list) {
    const selected = chooseControl(occ, scene, cue, available, active?.word ?? []);
    if (!selected) continue;
    const test: IndicatorTest = {
      cue,
      op: selected.op,
      word: [...(active?.word ?? []), selected.op],
      ref: selected.ref,
      stationary: selected.stationary,
      moved: selected.moved,
      before: o.observation_ref,
    };
    return {
      phase: 'unreadIndicator',
      origin: scene,
      a: test.op,
      b: test.op,
      rule: 'test_the_command_that_could_realize_this_displayed_arrival',
      refs: [...new Set([cue.independent, cue.onset, test.ref])],
      unreadIndicator: test,
    };
  }
  return null;
}
export function measureUnreadIndicator(
  m: Memory,
  x: IndicatorTest,
  b: NativeObservation,
  a: NativeObservation,
  before: PoseView,
  after: PoseView,
  op: string
) {
  const { cue } = x,
    state = (m.indicators ??= { pending: null }),
    p = after[cue.p] ?? null,
    r = after[cue.r] ?? null;
  const live =
    x.before === b.observation_ref &&
    op === x.op &&
    aligned(before, cue) &&
    b.level_epoch === a.level_epoch &&
    b.levels_completed === a.levels_completed &&
    b.state === a.state;
  const status = !live ? 'inapplicable' : !p ? 'unobserved' : same(p, cue.site) ? 'realized' : 'contradicted';
  state.pending = live && status !== 'realized' && aligned(after, cue) ? { cue, word: x.word } : null;
  return { test: x, status, actual: p, indicator: r, canContinue: !!state.pending };
}
