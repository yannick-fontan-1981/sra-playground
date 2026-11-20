import type { Prediction } from './experimental-frontier.ts';
import type { Edge, Memory } from './preparation-experiments.ts';
import { add, diff, point, same, type XY } from './access-terrain.ts';

export type Calibration = { op: string; before: XY; after: XY; bareRef: number; preparedRef: number };
export type RepertoireWitness = Calibration & { bareEffect: XY; preparedEffect: XY };

/** Find a different control whose effect on the same body actually changed after placement. */
export function changedControl(
  origin: XY,
  prepared: XY,
  calibrations: Calibration[]
): RepertoireWitness | null {
  let best: { weight: number; witness: RepertoireWitness } | null = null;
  for (const c of calibrations) {
    const bareEffect = diff(c.before, origin),
      preparedEffect = diff(c.after, prepared);
    if (same(bareEffect, preparedEffect)) continue;
    const weight = Number(same(origin, c.before)) + Number(!same(prepared, c.after));
    if (!best || weight > best.weight) best = { weight, witness: { ...c, bareEffect, preparedEffect } };
  }
  return best?.witness ?? null;
}

export type CalibrationExperiment = {
  actor: string;
  origin: XY;
  prepared: XY;
  setup: { op: string; ref: number; moved: string; from: XY; to: XY };
  direct: { op: string; ref: number; to: XY };
  alternatives: string[];
};
export type ControlExperiment = {
  actor: string;
  origin: XY;
  prepared: XY;
  setup: { op: string; ref: number; moved: string; from: XY; to: XY };
  calibration: RepertoireWitness;
  bare: { ref: number; to: XY };
};

function ends(edge: Edge, role: string): [XY, XY] | null {
  const at = edge.anchors[role]?.at;
  if (!at || !edge.visibleAfter?.includes(role)) return null;
  const movement = edge.effect.moves.find((m) => m.actor === role);
  return [point(at), point(movement?.to ?? at)];
}

/** At a reachable layout, enumerate the untested B for which a shared, already
 * measured D changed its effect. Only the reference arm needs to have exercised B. */
export function controlExperiments(m: Memory, reachable: ReadonlySet<number>) {
  const outgoing = new Map<number, Map<string, Edge>>();
  const incoming = new Map<number, Edge[]>();
  for (const e of m.edges) {
    if (!e.stable || e.effect.key === 'completion' || e.effect.key.startsWith('terminal:')) continue;
    const ops = outgoing.get(e.s) ?? new Map<string, Edge>();
    ops.set(e.cmd, e);
    outgoing.set(e.s, ops);
    if (reachable.has(e.t) && e.s !== e.t && e.effect.moves.length) {
      const routes = incoming.get(e.t) ?? [];
      routes.push(e);
      incoming.set(e.t, routes);
    }
  }
  const proposals = new Map<string, { claim: ControlExperiment; score: number }>();
  const calibrations = new Map<string, CalibrationExperiment>();
  for (const [target, routes] of incoming) {
    const prepared = outgoing.get(target) ?? new Map<string, Edge>();
    for (const setup of routes) {
      const root = outgoing.get(setup.s)!;
      if (root.size < 2) continue;
      // First learn whether this arrangement changes the response to a known control.
      // Interest requires a genuine choice at the origin and a second unanswered experiment.
      for (const [op, direct] of root) {
        if (prepared.has(op)) continue;
        for (const v of direct.effect.moves) {
          const actor = v.actor,
            placed = ends(setup, actor);
          const peer = setup.effect.moves.find((p) => p.actor !== actor);
          if (!placed || !peer || placed[0].join() !== v.from) continue;
          const unresolved = [...root.values()].filter(
            (e) =>
              e.cmd !== op &&
              !prepared.has(e.cmd) &&
              ends(e, actor)?.[0].join() === v.from &&
              ends(e, actor)?.[1].join() !== v.to
          );
          if (!unresolved.length) continue;
          const key = target + '/' + op;
          if (!calibrations.has(key))
            calibrations.set(key, {
              actor,
              origin: placed[0],
              prepared: placed[1],
              setup: {
                op: setup.cmd,
                ref: setup.ref,
                moved: peer.actor,
                from: point(peer.from),
                to: point(peer.to),
              },
              direct: { op, ref: direct.ref, to: point(v.to) },
              alternatives: unresolved.map((e) => e.cmd),
            });
        }
      }
      for (const [op, later] of prepared) {
        const earlier = root.get(op);
        if (!earlier) continue;
        const roles = new Set([...earlier.effect.moves, ...later.effect.moves].map((v) => v.actor));
        for (const actor of roles) {
          const prior = ends(earlier, actor),
            here = ends(later, actor),
            placed = ends(setup, actor);
          const peer = setup.effect.moves.find((v) => v.actor !== actor);
          if (!prior || !here || !placed || !peer || !same(prior[0], placed[0]) || !same(here[0], placed[1]))
            continue;
          const calibration = changedControl(prior[0], here[0], [
            { op, before: prior[1], after: here[1], bareRef: earlier.ref, preparedRef: later.ref },
          ]);
          if (!calibration) continue;
          for (const [probe, direct] of root) {
            if (prepared.has(probe)) continue;
            const bare = ends(direct, actor);
            if (!bare || !same(bare[0], prior[0])) continue;
            const observedEnds = new Set(
              [...prepared.values()].map((e) => ends(e, actor)?.[1].join()).filter(Boolean)
            );
            const score =
              Number(observedEnds.size >= 2) +
              Number(same(placed[0], placed[1])) +
              Number(!same(here[0], here[1]));
            const key = target + '/' + probe;
            const old = proposals.get(key);
            if (old && old.score >= score) continue;
            proposals.set(key, {
              score,
              claim: {
                actor,
                origin: prior[0],
                prepared: here[0],
                setup: {
                  op: setup.cmd,
                  ref: setup.ref,
                  moved: peer.actor,
                  from: point(peer.from),
                  to: point(peer.to),
                },
                calibration,
                bare: { ref: direct.ref, to: bare[1] },
              },
            });
          }
        }
      }
    }
  }
  return { proposals, calibrations };
}

/** Following a real response, use the best-supported continuation at the actual landing. */
export function nextControlledMove(
  m: Memory,
  claim: ControlExperiment,
  at: XY,
  width: number,
  height: number,
  choices: ReadonlySet<string>
) {
  let best: { score: number; forecast: Prediction } | null = null;
  const visited = new Set<string>();
  const ops = new Map<string, { edge: Edge; from: XY; to: XY }[]>();
  for (const edge of m.edges) {
    if (
      !edge.stable ||
      !choices.has(edge.cmd) ||
      edge.effect.key === 'completion' ||
      edge.effect.key.startsWith('terminal:')
    )
      continue;
    const observed = ends(edge, claim.actor);
    if (!observed) continue;
    const [from, to] = observed;
    visited.add(from.join());
    visited.add(to.join());
    const group = ops.get(edge.cmd) ?? [];
    group.push({ edge, from, to });
    ops.set(edge.cmd, group);
  }
  for (const [op, group] of ops) {
    const exact = group.filter((s) => same(s.from, at)),
      source = exact.length ? exact : group;
    const votes = new Map<string, { count: number; to: XY; ref: number; sites: Set<string> }>();
    for (const s of source) {
      const to = add(at, diff(s.to, s.from)),
        k = to.join();
      const v = votes.get(k) ?? { count: 0, to, ref: s.edge.ref, sites: new Set<string>() };
      v.count++;
      v.sites.add(s.from.join());
      votes.set(k, v);
    }
    for (const v of votes.values()) {
      if (v.count * 2 <= source.length || (!exact.length && v.sites.size < 2)) continue;
      const to = v.to;
      if (same(to, at) || to[0] < 0 || to[1] < 0 || to[0] >= width || to[1] >= height) continue;
      const score =
        Number(!visited.has(to.join())) * 4 +
        Number(!!exact.length) * 2 +
        v.count / source.length -
        Number(same(to, claim.prepared)) * 4;
      if (!best || score > best.score)
        best = { score, forecast: { role: claim.actor, op, from: at, to, ref: v.ref } };
    }
  }
  return best?.forecast ?? null;
}
