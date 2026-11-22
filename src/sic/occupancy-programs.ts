import type { NativeObservation, NativeRows, NativeEntity } from '../logos-engine/v6-native-types.ts';
import {
  projectMorphologicalPreview,
  measureMorphologicalPreview,
  type MorphologicalPreview,
} from '../logos-engine/v6-morphology-preview.ts';
import { symbolicDigest } from '../logos-engine/v6-hash.ts';
import { poseFamilyKey } from './pose-families.ts';
import { same, add, diff, size, type XY } from './access-terrain.ts';
import {choosePreparedPreviewArrival,type PreparedPreview,type PreviewFrontier,type EarlierReads} from './prepared-preview-arrivals.ts';
import type { Experiment } from './preparation-experiments.ts';

export type PoseView = Record<string, XY>;
export type PoseEdge = { s: number; t: number; op: string; ref: number; unstable?: boolean };
type Hit = { s: number; t: number; ref: number };
type Pair = { p: string; r: string; hits: Record<string, Hit[]>; coupled: number[] };
export type OccupancyStep = {
  op: string;
  stage: 'place' | 'occupy' | 'use';
  p: XY;
  r: XY;
  nextP: XY;
  nextR: XY | null;
  refs: number[];
};
export type OccupancyProgram = {
  preparedPreview?:PreparedPreview;
  p: string;
  r: string;
  origin: XY;
  marker: XY;
  wanted: XY;
  landing: XY;
  use: XY | null;
  alternatives: XY[];
  steps: OccupancyStep[];
  refs: number[];
  observedSites: XY[];
  predictedNewSites: XY[];
  basis: 'previous_occupancy' | 'coupled_motion';
  key: string;
};
export type OccupancyTrial = { plan: OccupancyProgram; index: number; preview?: MorphologicalPreview };
export type OccupancyMemory = {
  mechanismRefutations?: import('./refuted-mechanism-steps.ts').MechanismRefutations;
  exposedSubstrate?:Record<string,Record<string,{count:number;ref:number}>>;
  layouts: Record<number, PoseView>;
  forms?: Record<number, Record<string, string>>;
  previewTrials?: Record<
    string,
    {
      observed: number;
      realized: number;
      contradicted: number;
      unobserved: number;
      last: number;
      failedPrimary?: number[];
    }
  >;
  edges: PoseEdge[];
  observed: Record<string, number>;
  rejections?: Record<string, Record<string, true>>;
  pairs: Record<string, Pair>;
  visited: Record<string, Record<string, number>>;
  attempts: Record<string, number>;
  active: OccupancyTrial | null;
};
export const newOccupancyMemory = (): OccupancyMemory => ({
  layouts: {},
  edges: [],
  observed: {},
  pairs: {},
  visited: {},
  attempts: {},
  active: null,
});
const signatures = new Map<string, string>();
const views = new WeakMap<NativeObservation, PoseView>();
const observedForms = new WeakMap<NativeObservation, Record<string, string>>();
export function occupancyForms(o: NativeObservation, rows: NativeRows) {
  occupancyView(o, rows);
  return observedForms.get(o)!;
}
export function poseRole(e: NativeEntity) {
  let id = signatures.get(e.signature);
  if (!id) {
    id = symbolicDigest(poseFamilyKey(e)).slice(0, 24);
    signatures.set(e.signature, id);
  }
  return id;
}
export function occupancyView(o: NativeObservation, rows: NativeRows): PoseView {
  const cached = views.get(o);
  if (cached) return cached;
  const groups = new Map<string, XY | null>(),
    max = (rows.length * rows[0]!.length) / 12;
  for (const e of o.entities) {
    if (e.area > max) continue;
    const k = poseRole(e),
      b = e.bbox;
    groups.set(k, groups.has(k) ? null : [b[0] + b[2], b[1] + b[3]]);
  }
  const forms: Record<string, string> = {};
  for (const e of o.entities) {
    if (e.area <= max) {
      const role = poseRole(e);
      if (groups.get(role)) forms[role] = e.signature;
    }
  }
  observedForms.set(o, forms);
  const view: PoseView = {};
  for (const [k, v] of groups) if (v) view[k] = v;
  views.set(o, view);
  return view;
}
function getPair(m: OccupancyMemory, p: string, r: string) {
  return (m.pairs[p + '/' + r] ??= { p, r, hits: {}, coupled: [] });
}
// Observing a co-motion is sufficient to ask a question. Recording an occupancy
// requires the subject to arrive at the other part's previously observed position.
export function observePoses(
  m: OccupancyMemory,
  s: number,
  t: number,
  b: PoseView,
  z: PoseView,
  op: string,
  ref: number,
  beforeForms?: Record<string, string>,
  afterForms?: Record<string, string>
) {
  if (beforeForms && afterForms) {
    const forms = (m.forms ??= {});
    forms[s] ??= beforeForms;
    forms[t] ??= afterForms;
  }
  m.layouts[s] ??= b;
  m.layouts[t] ??= z;
  const k = s + '/' + op,
    prior = m.observed[k];
  if (prior !== undefined) {
    if (prior !== t && prior !== -1) {
      m.observed[k] = -1;
      const edge = m.edges.find((e) => e.s === s && e.op === op);
      if (edge) edge.unstable = true;
      for (const pair of Object.values(m.pairs)) {
        if (pair.hits[op]) {
          pair.hits[op] = pair.hits[op]!.filter((h) => h.s !== s);
          if (!pair.hits[op]!.length) delete pair.hits[op];
        }
        pair.coupled = pair.coupled.filter((i) => !m.edges[i]!.unstable);
      }
    }
    return;
  }
  m.observed[k] = t;
  const edge = m.edges.length;
  m.edges.push({ s, t, op, ref });
  const moving = Object.keys(b).filter((p) => z[p] && !same(b[p]!, z[p]!));
  for (const p of moving) {
    const visits = (m.visited[p] ??= {});
    visits[b[p]!.join()] ??= ref - 1;
    visits[z[p]!.join()] ??= ref;
    for (const r of Object.keys(b)) {
      if (p === r || same(b[p]!, b[r]!)) continue;
      if (same(z[p]!, b[r]!)) {
        const v = getPair(m, p, r);
        (v.hits[op] ??= []).push({ s, t, ref });
      }
    }
    for (const r of moving)
      if (p !== r && !same(b[p]!, b[r]!) && !same(diff(z[p]!, b[p]!), diff(z[r]!, b[r]!)))
        getPair(m, p, r).coupled.push(edge);
  }
}
type Stroke = { op: string; dp: XY; dr: XY; refs: number[]; starts: Set<string>; relative: Set<string> };
function motions(m: OccupancyMemory, p: string, r: string, available: Set<string>) {
  const grouped = new Map<string, Stroke>();
  for (const e of m.edges) {
    if (e.unstable || !available.has(e.op)) continue;
    const b = m.layouts[e.s]!,
      z = m.layouts[e.t]!,
      u = b[p],
      v = b[r],
      y = z[p],
      w = z[r];
    if (!u || !v || !y || !w) continue;
    const dp = diff(y, u),
      dr = diff(w, v);
    if (!size(dp) && !size(dr)) continue;
    const key = JSON.stringify([e.op, dp, dr]),
      c = grouped.get(key) ?? { op: e.op, dp, dr, refs: [], starts: new Set(), relative: new Set() };
    c.refs.push(e.ref);
    c.starts.add(u.join() + '/' + v.join());
    c.relative.add(diff(u, v).join());
    grouped.set(key, c);
  }
  return [...grouped.values()].sort((a, b) => b.starts.size - a.starts.size);
}
const hypothesisKey = (p: string, r: string, s: OccupancyStep) =>
  JSON.stringify([p, r, s.stage, s.op, diff(s.nextP, s.p), s.nextR ? diff(s.nextR, s.r) : null]);
const poseKey = (p: XY, r: XY) => p.join() + '/' + r.join();
const readKey = (p: string, r: string, q: string) => JSON.stringify([p, r, 'occupy', q]);
const trialKey = (p: string, r: string, s: OccupancyStep) =>
  s.stage === 'occupy' ? readKey(p, r, s.op) : hypothesisKey(p, r, s);
function contrast(m: OccupancyMemory, pair: Pair, op: string) {
  const hits = pair.hits[op] ?? [],
    roots = new Set(hits.map((h) => h.s)),
    refs: number[] = [];
  if (!roots.size) return refs;
  for (const edge of m.edges) {
    if (edge.unstable || edge.op === op || !roots.has(edge.s)) continue;
    const expected = m.layouts[edge.s]![pair.r],
      actual = m.layouts[edge.t]![pair.p];
    if (expected && actual && !same(expected, actual)) refs.push(edge.ref);
  }
  return refs;
}
function displayedPreview(m: OccupancyMemory, scene: number, trial: OccupancyTrial) {
  const { plan, index } = trial,
    step = plan.steps[index]!;
  if (step.stage !== 'occupy') return null;
  const pair = m.pairs[plan.p + '/' + plan.r];
  if (!pair) return null;
  const hits = pair.hits[step.op] ?? [],
    counterexamples = m.edges
      .filter((e) => {
        if (e.unstable || e.op !== step.op) return false;
        const b = m.layouts[e.s]!,
          p = b[plan.p],
          r = b[plan.r],
          after = m.layouts[e.t]![plan.p];
        return p && r && after && same(p, step.p) && same(r, step.r) && !same(after, r);
      })
      .map((e) => e.ref);
  return projectMorphologicalPreview(
    m.layouts[scene]!,
    m.forms?.[scene] ?? {},
    plan.p,
    plan.r,
    step.op,
    hits.map((h) => ({
      ref: h.ref,
      before: m.layouts[h.s]!,
      after: m.layouts[h.t]!,
      beforeForms: m.forms?.[h.s],
      afterForms: m.forms?.[h.t],
    })),
    contrast(m, pair, step.op),
    [
      ...new Set([
        ...counterexamples,
        ...(m.previewTrials?.[readKey(plan.p, plan.r, step.op)]?.failedPrimary ?? []),
      ]),
    ]
  );
}
function proposal(
  m: OccupancyMemory,
  scene: number,
  pair: Pair,
  available: Set<string>,
  w: number,
  h: number
) {
  const { p, r } = pair,
    view = m.layouts[scene]!,
    u = view[p],
    v = view[r];
  if (!u || !v || same(u, v)) return null;
  const tentative = !Object.keys(pair.hits).length;
  if (
    tentative &&
    (pair.coupled.length < 2 ||
      new Set(pair.coupled.map((i) => m.layouts[m.edges[i]!.s]![p]!.join())).size < 2)
  )
    return null;
  const visited = m.visited[p] ?? {},
    inside = (a: XY) => a[0] >= 0 && a[1] >= 0 && a[0] < w * 2 && a[1] < h * 2;
  const couplingRefs = pair.coupled.slice(-2).map((i) => m.edges[i]!.ref);
  const ops = tentative
    ? [...available].filter(
        (q) => !q.startsWith('ACTION6:') && !pair.coupled.some((i) => m.edges[i]!.op === q)
      )
    : Object.keys(pair.hits).filter((q) => available.has(q));
  if (!ops.length) return null;
  const strokes = motions(m, p, r, available);
  const motorChoices = new Set(
    strokes.filter((st) => size(st.dp) > 0 && st.starts.size >= 2).map((st) => st.op)
  );
  let best: { score: number; plan: OccupancyProgram } | null = null;
  for (const q of ops) {
    const failedReads = m.rejections?.[readKey(p, r, q)] ?? {};
    if (tentative && Object.keys(failedReads).length >= 2) continue;
    const hits = pair.hits[q] ?? [],
      sites = hits.map((x) => m.layouts[x.s]![r]!),
      recent = hits.at(-1);
    const pastPreview = m.previewTrials?.[readKey(p, r, q)];
    const selective =
      !pastPreview?.contradicted &&
      sites.length >= 2 &&
      new Set(sites.map((z) => z.join())).size >= 2 &&
      contrast(m, pair, q).length > 0;
    const start = { p: u, r: v, steps: [] as OccupancyStep[] };
    const queue = [start],
      seen = new Set([u.join() + '/' + v.join()]);
    for (const node of queue) {
      const at = node.r,
        here = node.p,
        novel = visited[at.join()] === undefined,
        changed = sites.every((z) => !same(z, at));
      if (
        !same(here, at) &&
        !failedReads[poseKey(here, at)] &&
        (node.steps.length || m.observed[scene + '/' + q] === undefined)
      ) {
        const key = JSON.stringify([p, r, q, here, at, node.steps.map((x) => [x.op, x.p, x.r])]);
        const future: XY[] = [],
          uses = strokes.filter(
            (s) => s.op !== q && s.starts.size >= 2 && size(s.dp) > 0 && inside(add(at, s.dp))
          );
        const distinctOps = new Set<string>();
        let next: Stroke | undefined;
        for (const step of uses) {
          if (distinctOps.has(step.op)) continue;
          distinctOps.add(step.op);
          const n = add(at, step.dp),
            useStep: OccupancyStep = {
              op: step.op,
              stage: 'use',
              p: at,
              r: at,
              nextP: n,
              nextR: null,
              refs: [],
            };
          if (m.rejections?.[trialKey(p, r, useStep)]?.[poseKey(at, at)]) continue;
          if (visited[n.join()] !== undefined || same(n, here) || future.some((x) => same(x, n))) continue;
          future.push(n);
          next ??= step;
        }
        // A direct experiment can also distinguish cue-relative movement from an ordinary walk.
        const ordinary = strokes.find((v) => v.op === q && v.starts.size >= 2),
          alternative = ordinary ? add(here, ordinary.dp) : null;
        const informative = !!recent && changed && (!alternative || !same(alternative, at));
        // Two repeatable motor controls can motivate a discriminating local experiment
        // even when both visible sites belong to the already explored area.
        const distinguishes =
          tentative && motorChoices.size >= 2 && !motorChoices.has(q) && node.steps.length === 0;
        if (!m.attempts[key] && (novel || future.length || informative || distinguishes)) {
          const refs = hits.length ? hits.slice(-3).map((x) => x.ref) : couplingRefs;
          const read: OccupancyStep = {
            stage: 'occupy',
            op: q,
            p: here,
            r: at,
            nextP: at,
            nextR: null,
            refs,
          };
          const steps = [...node.steps, read],
            use = next ? add(at, next.dp) : null;
          if (next && use)
            steps.push({
              stage: 'use',
              op: next.op,
              p: at,
              r: at,
              nextP: use,
              nextR: null,
              refs: [next.refs[0]!],
            });
          const alternatives = [
            here,
            ...(alternative ? [alternative] : []),
            ...(recent ? [m.layouts[recent.s]![r]!] : []),
          ].filter((x, i, a) => !same(x, at) && a.findIndex((y) => same(x, y)) === i);
          const plan: OccupancyProgram = {
            p,
            r,
            origin: u,
            marker: v,
            wanted: at,
            landing: at,
            use,
            alternatives,
            steps,
            refs: [...new Set(steps.flatMap((x) => x.refs))],
            observedSites: sites.slice(-4),
            predictedNewSites: [...(novel ? [at] : []), ...future],
            basis: tentative ? 'coupled_motion' : 'previous_occupancy',
            key,
          };
          const score =
            Number(selective && changed) * 4 +
            Number(!tentative) * 12 +
            Number(informative) * 5 +
            Number(distinguishes) * 3 +
            Number(novel) * 5 +
            Math.min(3, future.length) +
            Number(size(diff(at, here)) > size(ordinary?.dp ?? [0, 0])) -
            3 * node.steps.length;
          if (!best || score > best.score) best = { score, plan };
        }
      }
      if (tentative || node.steps.length >= 2) continue;
      for (const d of strokes) {
        if (d.op === q || !size(d.dr) || (!d.relative.has(diff(here, at).join()) && d.starts.size < 2))
          continue;
        const nextP = add(here, d.dp),
          nextR = add(at, d.dr),
          key = nextP.join() + '/' + nextR.join();
        const prep: OccupancyStep = {
          stage: 'place',
          op: d.op,
          p: here,
          r: at,
          nextP,
          nextR,
          refs: [d.refs[0]!],
        };
        if (
          !inside(nextP) ||
          !inside(nextR) ||
          seen.has(key) ||
          m.rejections?.[trialKey(p, r, prep)]?.[poseKey(here, at)]
        )
          continue;
        if (!node.steps.length && m.observed[scene + '/' + d.op] !== undefined) {
          const observed = m.layouts[m.observed[scene + '/' + d.op]!]!;
          if (
            !observed ||
            !observed[p] ||
            !observed[r] ||
            !same(observed[p]!, nextP) ||
            !same(observed[r]!, nextR)
          )
            continue;
        }
        seen.add(key);
        queue.push({ p: nextP, r: nextR, steps: [...node.steps, prep] });
      }
    }
  }
  return best;
}
export function offerPreparedPreview(m:OccupancyMemory,scene:number,available:Set<string>,w:number,h:number,frontier?:PreviewFrontier,earlier?:EarlierReads):Experiment|null {
  const plan=choosePreparedPreviewArrival(m,scene,available,w,h,frontier,earlier);if(!plan)return null;
  const op=plan.steps[0]!.op;return {phase:'occupancy',origin:scene,a:op,b:op,rule:'relocate_indicator_then_read',refs:plan.refs,occupancy:{plan,index:0}};
}
export function offerOccupancy(
  m: OccupancyMemory,
  scene: number,
  available: Set<string>,
  w: number,
  h: number
): Experiment | null {
  const view = m.layouts[scene];
  if (!view) return null;
  let trial = m.active;
  if (trial) {
    const step = trial.plan.steps[trial.index]!,
      p = view[trial.plan.p],
      r = view[trial.plan.r];
    if (
      !p ||
      !same(p, step.p) ||
      (step.stage !== 'use' && (!r || !same(r, step.r))) ||
      !available.has(step.op)
    )
      trial = null;
  }
  if (!trial) {
    let chosen: ReturnType<typeof proposal> = null;
    for (const pair of Object.values(m.pairs)) {
      const c = proposal(m, scene, pair, available, w, h);
      if (c && (!chosen || c.score > chosen.score)) chosen = c;
    }
    if (!chosen) return null;
    trial = { plan: chosen.plan, index: 0 };
  }
  const stage = trial.plan.steps[trial.index]!;
  const preview = displayedPreview(m, scene, trial);
  if (preview) trial = { ...trial, preview };
  return {
    phase: 'occupancy',
    origin: scene,
    a: trial.plan.steps[0]!.op,
    b: stage.op,
    rule: trial.plan.basis,
    refs: trial.plan.refs,
    occupancy: trial,
  };
}
export function finishOccupancy(
  m: OccupancyMemory,
  t: OccupancyTrial,
  after: PoseView,
  live: boolean,
  win: boolean,
  revision: number,
  afterForms: Record<string, string> = {},
  executedOp?: string
) {
  const { plan, index } = t,
    s = plan.steps[index]!,
    p = after[plan.p] ?? null,
    r = after[plan.r] ?? null;
  const matched = live && (executedOp===undefined||executedOp===s.op) && !!p && same(p, s.nextP) && (!s.nextR || (!!r && same(r, s.nextR)));
  const preview = t.preview
    ? measureMorphologicalPreview(t.preview, executedOp ?? s.op, after, afterForms, live)
    : null;
  if (preview && live && preview.status!=='inapplicable') {
    const knowledge = (m.previewTrials ??= {}),
      key = readKey(plan.p, plan.r, s.op);
    const v = (knowledge[key] ??= { observed: 0, realized: 0, contradicted: 0, unobserved: 0, last: 0 });
    v.observed++;
    v.last = revision;
    if (preview.status === 'realized') v.realized++;
    else if (preview.status === 'contradicted') {
      v.contradicted++;
      if (p && !same(p, s.nextP)) (v.failedPrimary ??= []).push(revision);
    } else if (preview.status === 'unobserved') v.unobserved++;
  }
  if (live && !matched) {
    const rejected = (m.rejections ??= {});
    (rejected[trialKey(plan.p, plan.r, s)] ??= {})[poseKey(s.p, s.r)] = true;
  }
  m.attempts[plan.key] = revision;
  m.active =
    matched && (!preview || preview.status === 'realized') && index + 1 < plan.steps.length
      ? { plan, index: index + 1 }
      : null;
  return {
    trial: t,
    arrived: p,
    marker: r,
    matched,
    won: win,
    stage: s.stage,
    ...(preview ? { preview } : {}),
  };
}
