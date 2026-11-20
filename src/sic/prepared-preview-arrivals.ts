import { add, diff, same, size, type XY } from './access-terrain.ts';
import type { PreviewLearning, PreviewWitness } from './witnessed-preview-transfer.ts';
import type { OccupancyMemory, OccupancyProgram, OccupancyStep } from './occupancy-programs.ts';

type Stroke = { op: string; offset: XY; ref: number; origins: Set<string>; conflict: boolean };
export type FutureArrival = {
  write: string;
  read: string;
  indicator: XY;
  arrival: XY;
  use: XY | null;
  outsideObservedSites: boolean;
  writeRef: number;
  readRef: number | null;
  useRef?: number;
  opensMeasuredRegion?: boolean;
};
export type PreviewFrontier = {
  role: string;
  homeSize: number;
  outsideSize: number;
  contains: (site: XY) => boolean;
};
export type PreparedPreview = {
  priorRead?: PreviewWitness;
  frontier?: { homeSize: number; outsideSize: number };
  kind: 'relocate_indicator_then_read';
  direct: XY;
  directBasis: 'witnessed_at_this_pose' | 'projected_from_previous_arrival';
  alternatives: FutureArrival[];
};
type Candidate = { plan: OccupancyProgram; choice: FutureArrival; priority: number };
const inside = (p: XY, w: number, h: number) => p[0] >= 0 && p[1] >= 0 && p[0] < 2 * w && p[1] < 2 * h;

// Keep zero displacements: a stationary indicator under A is a control that can rule out the translation.
function laws(m: OccupancyMemory, p: string, r: string, allowed: Set<string>) {
  const writes = new Map<string, Stroke>(),
    motor = new Map<string, Stroke>();
  function enter(map: Map<string, Stroke>, op: string, d: XY, from: XY, ref: number) {
    const law = map.get(op);
    if (!law) map.set(op, { op, offset: d, ref, origins: new Set([from.join()]), conflict: false });
    else {
      law.conflict ||= !same(law.offset, d);
      law.origins.add(from.join());
    }
  }
  for (const e of m.edges) {
    if (e.unstable || e.op.startsWith('ACTION6:') || !allowed.has(e.op)) continue;
    const b = m.layouts[e.s],
      z = m.layouts[e.t],
      u = b?.[p],
      y = z?.[p];
    if (!u || !y) continue;
    if (!same(u, y)) enter(motor, e.op, diff(y, u), u, e.ref);
    else if (b?.[r] && z?.[r]) enter(writes, e.op, diff(z[r], b[r]), b[r], e.ref);
  }
  return { writes, motor };
}
export type EarlierReads = { epoch: number; memory: PreviewLearning };
type ReadSite = { at: XY; mark: XY; ref: number | null; prior?: PreviewWitness };
function readPairs(m: OccupancyMemory, earlier?: EarlierReads) {
  const groups = new Map<string, { p: string; r: string; reads: Map<string, ReadSite[]> }>();
  function pair(p: string, r: string) {
    const k = p + '/' + r;
    if (!groups.has(k)) groups.set(k, { p, r, reads: new Map() });
    return groups.get(k)!;
  }
  for (const e of Object.values(m.pairs))
    for (const [op, hits] of Object.entries(e.hits))
      if (hits.length) {
        pair(e.p, e.r).reads.set(
          op,
          hits.map((h) => ({ at: m.layouts[h.s]![e.p]!, mark: m.layouts[h.s]![e.r]!, ref: h.ref }))
        );
      }
  if (earlier)
    for (const b of Object.values(earlier.memory.bindings)) {
      if (b.gesture.point) continue;
      const proof = b.witnesses
        .slice()
        .reverse()
        .find((w) => w.epoch < earlier.epoch && same(w.arrived, w.indicated));
      if (!proof) continue;
      const g = pair(b.actor, b.indicator);
      if (!g.reads.has(b.gesture.op))
        g.reads.set(b.gesture.op, [{ at: proof.from, mark: proof.indicated, ref: null, prior: proof }]);
    }
  return groups.values();
}
export function listPreparedPreviewArrivals(
  m: OccupancyMemory,
  scene: number,
  available: Set<string>,
  w: number,
  h: number,
  frontier?: PreviewFrontier,
  earlier?: EarlierReads
) {
  const view = m.layouts[scene],
    options: Candidate[] = [];
  if (!view) return options;
  for (const pair of readPairs(m, earlier)) {
    const { p, r } = pair,
      origin = view[p],
      mark = view[r],
      visited = m.visited[p] ?? {};
    const reads = [...pair.reads].filter(
      ([q, hits]) => hits.length && available.has(q) && !q.startsWith('ACTION6:')
    );
    if (!origin || !mark || same(origin, mark) || !reads.length) continue;
    const model = laws(m, p, r, available);
    for (const [q, hits] of reads) {
      const exact = hits.find((x) => same(x.at, origin) && same(x.mark, mark));
      const sameOrigin = exact ?? hits.find((x) => same(x.at, origin));
      const proof = sameOrigin ?? hits.at(-1)!;
      const observed = m.observed[scene + '/' + q];
      if (
        observed !== undefined &&
        (observed < 0 || !m.layouts[observed]?.[p] || !same(m.layouts[observed]![p]!, mark))
      )
        continue;
      for (const a of model.writes.values()) {
        if (a.op === q || a.conflict || !size(a.offset) || m.observed[scene + '/' + a.op] !== undefined)
          continue;
        const at = add(mark, a.offset);
        if (!inside(at, w, h) || same(at, origin)) continue;
        const key = JSON.stringify(['preview_write', p, r, origin, mark, a.op, q, at]);
        if (m.attempts[key]) continue;
        const novel = visited[at.join()] === undefined;
        const motor = [...model.motor.values()]
          .filter((s) => s.op !== q && s.op !== a.op && !s.conflict && s.origins.size >= 2)
          .find((s) => {
            const u = add(at, s.offset);
            return inside(u, w, h) && !same(u, origin) && visited[u.join()] === undefined;
          });
        const use = motor ? add(at, motor.offset) : null;
        // A change in the predicted effect of Q can also discriminate models inside known territory.
        if (!novel && !use && !sameOrigin) continue;
        const steps: OccupancyStep[] = [
          { op: a.op, stage: 'place', p: origin, r: mark, nextP: origin, nextR: at, refs: [a.ref] },
          {
            op: q,
            stage: 'occupy',
            p: origin,
            r: at,
            nextP: at,
            nextR: null,
            refs: proof.ref === null ? [] : [proof.ref],
          },
        ];
        if (use && motor)
          steps.push({
            op: motor.op,
            stage: 'use',
            p: at,
            r: at,
            nextP: use,
            nextR: null,
            refs: [motor.ref],
          });
        const opens = frontier?.role === p && !frontier.contains(origin) && frontier.contains(at);
        const choice: FutureArrival = {
          write: a.op,
          read: q,
          indicator: at,
          arrival: at,
          use,
          outsideObservedSites: novel,
          writeRef: a.ref,
          readRef: proof.ref,
          ...(motor ? { useRef: motor.ref } : {}),
          ...(opens ? { opensMeasuredRegion: true } : {}),
        };
        const plan: OccupancyProgram = {
          p,
          r,
          origin,
          marker: mark,
          wanted: at,
          landing: at,
          use,
          alternatives: [mark, origin],
          steps,
          refs: [...new Set(steps.flatMap((s) => s.refs))],
          observedSites: hits.slice(-4).map((x) => x.mark),
          predictedNewSites: [...(novel ? [at] : []), ...(use ? [use] : [])],
          basis: 'previous_occupancy',
          key,
          preparedPreview: {
            ...(proof.prior ? { priorRead: proof.prior } : {}),
            kind: 'relocate_indicator_then_read',
            direct: mark,
            directBasis: exact ? 'witnessed_at_this_pose' : 'projected_from_previous_arrival',
            alternatives: [],
            ...(opens && frontier
              ? { frontier: { homeSize: frontier.homeSize, outsideSize: frontier.outsideSize } }
              : {}),
          },
        };
        const priority =
          16 * Number(opens === true) +
          8 * Number(!!sameOrigin) +
          4 * Number(novel) +
          2 * Number(!!use) +
          Number(!!exact);
        options.push({ plan, choice, priority });
      }
    }
  }
  return options.sort((a, b) => b.priority - a.priority);
}
export function choosePreparedPreviewArrival(
  m: OccupancyMemory,
  scene: number,
  available: Set<string>,
  w: number,
  h: number,
  frontier?: PreviewFrontier,
  earlier?: EarlierReads
) {
  const options = listPreparedPreviewArrivals(m, scene, available, w, h, frontier, earlier),
    best = options[0];
  if (!best) return null;
  // Only compare choices about this subject and this indicator under the same reading action.
  best.plan.preparedPreview!.alternatives = options
    .filter((c) => c.plan.p === best.plan.p && c.plan.r === best.plan.r && c.choice.read === best.choice.read)
    .map((c) => c.choice);
  return best.plan;
}
