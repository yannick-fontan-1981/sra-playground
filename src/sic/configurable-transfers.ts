import type { NativeEntity, NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { Edge, Experiment, Memory } from './preparation-experiments.ts';
import { add, diff, point, same, size, type XY } from './access-terrain.ts';
import {
  siteParts,
  siteShape,
  siteKey,
  transferAddress,
  type SiteLedger,
} from './site-operations.ts';

type Step = { op: string; from: XY; to: XY; stage: 'prepare' | 'approach' | 'cross' | 'use'; sites: XY[] };
type Configuration = { entry: XY; exit: XY; desired: XY; following: XY; prepare: string[] };
type Plan = Configuration & {
  id: string;
  shape: string;
  role: string;
  steps: Step[];
  refs: number[];
  priority: number;
  alternatives: Configuration[];
};
export type TransferTrial = { plan: Plan; index: number };
export type TransferMemory = {
  sites: SiteLedger;
  active: TransferTrial | null;
  tried: Record<string, number>;
  learned: Record<string, number>;
  experiments: number;
  lastStart: number;
};
export const newTransferMemory = (): TransferMemory => ({
  sites: {},
  active: null,
  tried: {},
  learned: {},
  experiments: 0,
  lastStart: -20,
});
type Motion = { op: string; d: XY; ref: number; count: number };
type Pair = {
  shape: string;
  active: XY;
  other: XY;
  box: XY;
  refs: number[];
  setup: { op: string; at: XY }[];
  evidence: number;
};
const extent = (e: NativeEntity): XY => [e.bbox[2] - e.bbox[0], e.bbox[3] - e.bbox[1]];
const inBoard = (p: XY, e: XY, rows: NativeRows) =>
  p[0] >= 0 && p[1] >= 0 && p[0] + e[0] < rows[0]!.length && p[1] + e[1] < rows.length;
const gap = (p: XY, a: XY, box: XY) =>
  Math.max(0, a[0] - p[0], p[0] - a[0] - box[0]) + Math.max(0, a[1] - p[1], p[1] - a[1] - box[1]);
const observed = (o: NativeObservation, role: string) =>
  o.entities.find((e) => !e.identity_ambiguous && e.signature === role);
function motions(edges: Edge[], role: string, available: Set<string>) {
  const byOp = new Map<string, Map<string, Motion>>(),
    visited = new Set<string>();
  for (const e of edges) {
    if (!e.stable) continue;
    const move = e.effect.moves.find((x) => x.actor === role);
    if (!move) continue;
    visited.add(move.from);
    visited.add(move.to);
    if (!available.has(e.cmd) || e.cmd.includes(':')) continue;
    let values = byOp.get(e.cmd);
    if (!values) {
      values = new Map();
      byOp.set(e.cmd, values);
    }
    const k = [move.dx, move.dy].join(),
      m = values.get(k);
    if (m) m.count++;
    else values.set(k, { op: e.cmd, d: [move.dx, move.dy], ref: e.ref, count: 1 });
  }
  const controls: Motion[] = [];
  for (const values of byOp.values()) {
    const sorted = [...values.values()].sort((a, b) => b.count - a.count || size(a.d) - size(b.d));
    if (sorted[0] && sorted[0].count !== (sorted[1]?.count ?? 0)) controls.push(sorted[0]);
  }
  return { controls, visited };
}
function arrangements(m: TransferMemory, o: NativeObservation, rows: NativeRows, available: Set<string>) {
  const parts = siteParts(o, rows),
    groups = new Map<string, NativeEntity[]>();
  for (const e of parts) {
    const form = siteShape(e),
      g = groups.get(form) ?? [];
    g.push(e);
    groups.set(form, g);
  }
  const pairs: Pair[] = [];
  for (const [shape, sites] of groups) {
    if (sites.length > 4) continue;
    for (const member of sites) {
      const at: XY = [...member.position],
        box = extent(member);
      const birth = m.sites[siteKey(shape, at)];
      if (!birth) continue;
      for (const other of sites) {
        if (member === other) continue;
        const p: XY = [...other.position],
          w = m.sites[siteKey(shape, p)];
        const learned = m.learned[shape];
        if ((w && w.ref !== birth.ref) || learned)
          pairs.push({
            shape,
            active: at,
            other: p,
            box,
            refs: [...new Set([birth.ref, w?.ref, learned].filter((n): n is number => n !== undefined))],
            setup: [],
            evidence: learned ? 4 : 2,
          });
        if (!birth.displacement || !available.has(birth.op)) continue;
        const q = add(at, birth.displacement);
        if (inBoard(q, box, rows) && !same(q, p))
          pairs.push({
            shape,
            active: p,
            other: q,
            box,
            refs: [birth.ref],
            setup: [{ op: birth.op, at: q }],
            evidence: 1,
          });
      }
      if (!birth.address) continue;
      for (const op of available) {
        if (!op.startsWith('ACTION6:')) continue;
        const q = diff(point(op.split(':')[1]!), birth.address);
        if (
          !inBoard(q, box, rows) ||
          sites.some((s) => same([...s.position], q)) ||
          !transferAddress(birth, q, rows, available)
        )
          continue;
        pairs.push({
          shape,
          active: at,
          other: q,
          box,
          refs: [birth.ref],
          setup: [{ op, at: q }],
          evidence: 1,
        });
      }
    }
  }
  return pairs
    .sort((a, b) => b.evidence - a.evidence || size(diff(b.other, b.active)) - size(diff(a.other, a.active)))
    .slice(0, 48);
}
function catalogue(m: Memory, o: NativeObservation, rows: NativeRows, available: Set<string>) {
  const memory = m.transfers!,
    pairs = arrangements(memory, o, rows, available);
  if (!pairs.length) return [];
  const visible = siteParts(o, rows),
    roles = new Set(m.edges.flatMap((e) => e.effect.moves.map((v) => v.actor)));
  const candidates: Plan[] = [];
  for (const actor of visible
    .filter((e) => !e.identity_ambiguous && roles.has(e.signature))
    .sort((a, b) => a.area - b.area)
    .slice(0, 10)) {
    const { controls, visited } = motions(m.edges, actor.signature, available);
    if (!controls.length) continue;
    const start: XY = [...actor.position],
      extentActor = extent(actor),
      half: XY = [extentActor[0] / 2, extentActor[1] / 2];
    for (const pair of pairs) {
      if (siteShape(actor) === pair.shape) continue;
      const prep: Step[] = [],
        refs = new Set(pair.refs);
      let initial = start;
      for (const s of pair.setup) {
        const movement = controls.find((c) => c.op === s.op),
          end = movement ? add(initial, movement.d) : initial;
        if (movement) refs.add(movement.ref);
        prep.push({ stage: 'prepare', op: s.op, from: initial, to: end, sites: [pair.active, s.at] });
        initial = end;
      }
      for (const [entry, exit] of [
        [pair.active, pair.other],
        [pair.other, pair.active],
      ] as [XY, XY][]) {
        const queue: [XY, Step[]][] = [[initial, []]],
          seen = new Set([initial.join()]);
        for (let i = 0; i < queue.length && i < 72; i++) {
          const [p, walk] = queue[i]!;
          for (const cmd of controls) {
            const n = add(p, cmd.d),
              stride = size(cmd.d);
            const before = gap(add(p, half), entry, pair.box),
              after = gap(add(n, half), entry, pair.box);
            if (
              (before === 0 || (after < before && after <= stride / 2)) &&
              size(diff(exit, entry)) >= 3 * stride
            ) {
              const desired = add(n, diff(exit, entry)),
                following = add(desired, cmd.d);
              if (
                !inBoard(desired, extentActor, rows) ||
                !inBoard(following, extentActor, rows) ||
                visited.has(desired.join())
              )
                continue;
              const id = [
                actor.signature,
                pair.shape,
                entry,
                exit,
                p,
                cmd.op,
                pair.setup.map((s) => s.op),
              ].join('|');
              if (memory.tried[id]) continue;
              const forecast: Step[] = [
                ...prep,
                ...walk,
                { stage: 'cross', op: cmd.op, from: p, to: desired, sites: [entry, exit] },
                { stage: 'use', op: cmd.op, from: desired, to: following, sites: [entry, exit] },
              ];
              const featureDistance = visible.reduce(
                (best, e) =>
                  siteShape(e) === pair.shape || e.signature === actor.signature
                    ? best
                    : Math.min(best, gap(add(following, half), [...e.position], extent(e))),
                32
              );
              const evidence = [
                ...new Set([...refs, cmd.ref, ...walk.map((w) => controls.find((c) => c.op === w.op)!.ref)]),
              ];
              const priority =
                3 * pair.evidence -
                walk.length -
                prep.length / 2 -
                Math.min(after, before) / Math.max(1, stride) +
                1 / (1 + featureDistance);
              candidates.push({
                id,
                shape: pair.shape,
                role: actor.signature,
                entry,
                exit,
                desired,
                following,
                prepare: prep.map((s) => s.op),
                steps: forecast,
                refs: evidence,
                priority,
                alternatives: [],
              });
            }
            if (walk.length >= 5 || !inBoard(n, extentActor, rows) || seen.has(n.join())) continue;
            // Each move brings the traveller closer to this particular entrance. Verify it on execution.
            if (gap(add(n, half), entry, pair.box) >= before) continue;
            seen.add(n.join());
            queue.push([
              n,
              [...walk, { stage: 'approach', op: cmd.op, from: p, to: n, sites: [entry, exit] }],
            ]);
          }
        }
      }
    }
  }
  return candidates.sort((a, b) => b.priority - a.priority);
}
function availableStep(trial: TransferTrial, o: NativeObservation, available: Set<string>) {
  const s = trial.plan.steps[trial.index]!,
    actor = observed(o, trial.plan.role);
  if (!actor || !same([...actor.position], s.from) || !available.has(s.op)) return false;
  return (
    s.stage === 'prepare' ||
    s.sites.every((p) =>
      o.entities.some((e) => same([...e.position], p) && siteShape(e) === trial.plan.shape)
    )
  );
}
export function chooseTransfer(
  m: Memory,
  o: NativeObservation,
  rows: NativeRows,
  available: Set<string>,
  scene: number
): Experiment | null {
  const memory = m.transfers;
  if (!memory) return null;
  let trial = memory.active;
  if (trial && !availableStep(trial, o, available)) trial = memory.active = null;
  if (!trial) {
    if (m.turns - memory.lastStart < 8 || !Object.keys(memory.sites).length) return null;
    const plans = catalogue(m, o, rows, available);
    const best = plans[0];
    if (!best) return null;
    const distinct = new Set([best.desired.join()]);
    for (const p of plans.slice(1)) {
      if (distinct.has(p.desired.join())) continue;
      best.alternatives.push({
        entry: p.entry,
        exit: p.exit,
        desired: p.desired,
        following: p.following,
        prepare: p.prepare,
      });
      distinct.add(p.desired.join());
      if (best.alternatives.length >= 4) break;
    }
    trial = { plan: best, index: 0 };
    if (!availableStep(trial, o, available)) return null;
  }
  const s = trial.plan.steps[trial.index]!;
  return {
    phase: 'configuredTransfer',
    origin: scene,
    a: s.op,
    b: s.op,
    rule: 'test_a_transfer_between_configured_sites',
    refs: trial.plan.refs,
    transfer: trial,
  };
}
export function recordTransfer(m: Memory, x: TransferTrial, b: NativeObservation, a: NativeObservation) {
  const mem = m.transfers!,
    p = x.plan,
    s = p.steps[x.index]!;
  if (!x.index) {
    mem.lastStart = m.turns;
    mem.experiments++;
    mem.tried[p.id] = a.revision;
  }
  const won = b.levels_completed < a.levels_completed || a.state === 'WIN';
  const actual = observed(a, p.role),
    position = actual ? ([...actual.position] as XY) : null;
  const geometry =
    s.stage !== 'prepare' ||
    s.sites.every((q) => a.entities.some((e) => same([...e.position], q) && siteShape(e) === p.shape));
  const matched = !!position && same(position, s.to) && geometry;
  if (s.stage === 'cross' && matched && !won) mem.learned[p.shape] = a.revision;
  mem.active =
    matched && !won && b.level_epoch === a.level_epoch && b.state === a.state && x.index + 1 < p.steps.length
      ? { plan: p, index: x.index + 1 }
      : null;
  return {
    result: won
      ? 'official_completion'
      : !matched
        ? 'configured_transfer_refuted'
        : 'configured_' + s.stage + '_verified',
    detail: {
      stage: s.stage,
      role: p.role,
      shape: p.shape,
      op: s.op,
      from: s.from,
      to: s.to,
      actual: position,
      sites: s.sites,
      geometry,
      matched,
      entry: p.entry,
      exit: p.exit,
      destination: p.desired,
      following: p.following,
      prepare: p.prepare,
      alternatives: p.alternatives,
      official: won,
    },
  };
}
