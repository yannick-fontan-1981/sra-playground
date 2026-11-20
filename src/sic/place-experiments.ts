import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { Edge, Memory } from './preparation-experiments.ts';
import type { FrontierQuestion, Prediction } from './experimental-frontier.ts';
import { add, diff, point, size, type XY } from './access-terrain.ts';

type Sites = Map<string, string>;
type Sample = { edge: Edge; from: string; to: string };
type Control = {
  at: Map<string, Sample[]>;
  deltas: Map<string, { sample: Sample; count: number }>;
  exchange: Map<string, { ref: number; offset: XY; support: number[]; reciprocal: boolean }>;
};
type Actor = { id: string; poses: Set<string>; ops: Map<string, Control>; stride: number; extent: XY };
type Target = { id: string; at: XY; extent: XY; nearest: number; signature: string; ambiguous: boolean };
type Opening = {
  mover: string;
  placement: XY;
  traveler: string;
  trigger: string;
  without: XY;
  destination: XY;
  controlRef: number | null;
};
export type PlaceClaim = {
  opening?: Opening;
  actor: string;
  from: XY;
  context: string[];
  placementChanged: boolean;
  bare: { to: XY; ref: number } | null;
  preparationRef: number | null;
  reference: string | null;
  referenceEvidence: number[];
  target: string | null;
  newArrival: boolean;
  newUse: boolean;
};
type Option = { score: number; question: FrontierQuestion };
const emptyControl = (): Control => ({ at: new Map(), deltas: new Map(), exchange: new Map() });
const dist = (p: XY, q: XY) => size(diff(p, q));
const bounds = (p: XY, e: XY, w: number, h: number) =>
  p[0] >= 0 && p[1] >= 0 && p[0] + e[0] <= w && p[1] + e[1] <= h;
function gap(p: XY, extent: XY, target: Target) {
  const right = p[0] + extent[0] - 1,
    bottom = p[1] + extent[1] - 1;
  return (
    Math.max(0, p[0] - target.at[0] - target.extent[0] + 1, target.at[0] - right) +
    Math.max(0, p[1] - target.at[1] - target.extent[1] + 1, target.at[1] - bottom)
  );
}

/** Evaluate an unmeasured input by the spatial experiment it can perform. A
 * new image can repeat an old (pose, command) control. A moved partner can
 * instead turn a previously blocked control into a genuine new experiment. */
export function placeExperiments(m: Memory, live: NativeObservation, rows: NativeRows, scene: number) {
  const stable = m.edges.filter(
    (e) => e.stable && e.effect.key !== 'completion' && !e.effect.key.startsWith('terminal:')
  );
  const locations = new Map<string, Set<string>>();
  const shapes = new Map(live.entities.filter((e) => !e.identity_ambiguous).map((e) => [e.signature, e]));
  for (const e of stable)
    for (const v of e.effect.moves) {
      if (!shapes.has(v.actor)) continue;
      const ps = locations.get(v.actor) ?? new Set<string>();
      ps.add(v.from);
      ps.add(v.to);
      locations.set(v.actor, ps);
    }
  const actors: Actor[] = [...locations]
    .filter(([id, ps]) => ps.size >= 2 && shapes.get(id)!.area < (rows.length * rows[0]!.length) / 4)
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([id, poses]) => {
      const e = shapes.get(id)!;
      return {
        id,
        poses,
        ops: new Map(),
        stride: Infinity,
        extent: [e.bbox[2] - e.bbox[0] + 1, e.bbox[3] - e.bbox[1] + 1],
      };
    });
  if (!actors.length) return null;
  const evidence = new Map<number, Edge>();
  const states = new Map<number, Sites>();
  const mapAt = (s: number) => {
    let v = states.get(s);
    if (!v) {
      v = new Map();
      states.set(s, v);
    }
    return v;
  };
  for (const e of stable) {
    evidence.set(e.s, e);
    const before = mapAt(e.s),
      after = mapAt(e.t);
    for (const actor of actors) {
      const start = e.anchors[actor.id]?.at;
      if (!start) continue;
      before.set(actor.id, start);
      if (!e.visibleAfter?.includes(actor.id)) continue;
      const move = e.effect.moves.find((v) => v.actor === actor.id),
        end = move?.to ?? start;
      after.set(actor.id, end);
      const c = actor.ops.get(e.cmd) ?? emptyControl();
      actor.ops.set(e.cmd, c);
      const sample = { edge: e, from: start, to: end },
        prior = c.at.get(start) ?? [];
      prior.push(sample);
      c.at.set(start, prior);
      if (!move) continue;
      const dk = [move.dx, move.dy].join(),
        v = c.deltas.get(dk) ?? { sample, count: 0 };
      v.count++;
      c.deltas.set(dk, v);
      actor.stride = Math.min(actor.stride, Math.abs(move.dx) + Math.abs(move.dy));
      for (const peer of e.effect.moves) {
        if (peer.actor === actor.id || peer.from !== move.to || peer.to !== move.from) continue;
        c.exchange.set(peer.actor, { ref: e.ref, offset: [0, 0], support: [e.ref], reciprocal: true });
      }
    }
  }
  // A landmark-relative landing needs independent placements: a pair that
  // merely translates together cannot establish which body determines the destination.
  for (const a of actors)
    for (const c of a.ops.values()) {
      if (c.exchange.size || c.deltas.size < 2) continue;
      for (const b of actors) {
        if (a === b) continue;
        const variants = new Map<string, { separations: Set<string>; sites: Set<string>; refs: number[] }>();
        let moved = 0;
        for (const list of c.at.values())
          for (const s of list) {
            const anchor = s.edge.anchors[b.id]?.at;
            if (!anchor || s.from === s.to) continue;
            moved++;
            const d = diff(point(s.to), point(anchor));
            if (size(d) >= dist(point(s.from), point(s.to))) continue;
            const key = d.join(),
              votes = variants.get(key) ?? {
                separations: new Set<string>(),
                sites: new Set<string>(),
                refs: [],
              };
            votes.separations.add(diff(point(s.from), point(anchor)).join());
            votes.sites.add(anchor);
            votes.refs.push(s.edge.ref);
            variants.set(key, votes);
          }
        const winner = [...variants]
          .filter(([, v]) => v.separations.size >= 2 && v.sites.size >= 2 && v.refs.length * 4 >= moved * 3)
          .sort((x, y) => y[1].refs.length - x[1].refs.length)[0];
        if (winner) {
          c.exchange.set(b.id, {
            ref: winner[1].refs.at(-1)!,
            offset: point(winner[0]),
            support: winner[1].refs.slice(-4),
            reciprocal: false,
          });
          break;
        }
      }
    }
  const current = mapAt(scene);
  for (const a of actors) current.set(a.id, shapes.get(a.id)!.position.join());
  const targets = new Map<string, Target[]>();
  for (const a of actors) {
    const choices: Target[] = [];
    for (const f of live.entities) {
      const w = f.bbox[2] - f.bbox[0] + 1,
        h = f.bbox[3] - f.bbox[1] + 1;
      if (locations.has(f.signature) || f.area > (rows.length * rows[0]!.length) / 16 || f.area < 2) continue;
      const t: Target = {
        id: f.id,
        at: [...f.position],
        extent: [w, h],
        nearest: Infinity,
        signature: f.signature,
        ambiguous: f.identity_ambiguous,
      };
      for (const p of a.poses) t.nearest = Math.min(t.nearest, gap(point(p), a.extent, t));
      choices.push(t);
    }
    // Keep nearby opportunities and distal landmarks beyond the known range.
    const closest = choices.sort((x, y) => x.nearest - y.nearest || x.id.localeCompare(y.id));
    targets.set(a.id, [
      ...closest.slice(0, 12),
      ...closest
        .slice(12)
        .filter((x) => x.nearest > 0)
        .slice(-8),
    ]);
  }
  const modal = new Map<Control, Sample>();
  for (const a of actors)
    for (const c of a.ops.values()) {
      const best = [...c.deltas.values()].sort(
        (x, y) => y.count - x.count || x.sample.edge.ref - y.sample.edge.ref
      )[0];
      if (best) modal.set(c, best.sample);
    }
  function transfer(
    a: Actor,
    op: string,
    from: XY,
    at: Sites
  ): {
    p: Prediction;
    peer: string | null;
    samples: Sample[];
    changed: boolean;
    bare: Sample | null;
    known: boolean;
  } | null {
    const c = a.ops.get(op);
    if (!c) return null;
    const samples = c.at.get(from.join()) ?? [];
    const peers = actors.filter((b) => b !== a && at.has(b.id));
    const matches = samples.filter((s) => peers.every((b) => s.edge.anchors[b.id]?.at === at.get(b.id)));
    const group = matches.length ? matches : samples,
      bare = group[0] ?? null;
    const changed =
      samples.length > 0 &&
      !matches.length &&
      peers.some((b) =>
        samples.some((s) => s.edge.anchors[b.id] && s.edge.anchors[b.id]!.at !== at.get(b.id))
      );
    const rebound = [...c.exchange.entries()].find(([peer]) => at.has(peer));
    let to: XY,
      ref: number,
      peer: string | null = null;
    if (matches.length && bare && matches.every((s) => s.to === bare.to)) {
      to = point(bare.to);
      ref = bare.edge.ref;
    } else if (rebound) {
      peer = rebound[0];
      to = add(point(at.get(peer)!), rebound[1].offset);
      ref = rebound[1].ref;
    } else if (bare && group.every((s) => s.to === bare.to) && (!changed || bare.to !== bare.from)) {
      to = point(bare.to);
      ref = bare.edge.ref;
    } else {
      const model = modal.get(c);
      if (!model) return null;
      to = add(from, diff(point(model.to), point(model.from)));
      ref = model.edge.ref;
    }
    if (!bounds(to, a.extent, rows[0]!.length, rows.length)) return null;
    return { p: { role: a.id, op, from, to, ref }, peer, samples, changed, bare, known: !!matches.length };
  }
  const valueCache = new Map<string, { value: number; id: string | null }>();
  function aspiration(a: Actor, p: XY, target: number) {
    const key = target + '/' + a.id + '/' + p,
      hit = valueCache.get(key);
    if (hit) return hit;
    let value = 0,
      id: string | null = null;
    for (const t of targets.get(a.id)!) {
      if (target !== scene && (t.ambiguous || evidence.get(target)?.anchors[t.signature]?.at !== t.at.join()))
        continue;
      const d = gap(p, a.extent, t),
        gain = t.nearest - d;
      if (gain <= 0) continue;
      const reward = Math.min(5, gain / Math.max(1, a.stride)) + (d === 0 ? 4 : 0);
      if (reward > value) {
        value = reward;
        id = t.id;
      }
    }
    const v = { value, id };
    valueCache.set(key, v);
    return v;
  }
  function continuation(a: Actor, from: XY, at: Sites, target: number, origin: string) {
    let best: { p: Prediction; value: number; fresh: boolean } | null = null;
    for (const [op, c] of a.ops) {
      if (!c.deltas.size) continue;
      const next = transfer(a, op, from, at);
      if (!next || next.p.to.join() === from.join()) continue;
      const pos = next.p.to.join(),
        fresh = !a.poses.has(pos);
      const value = (fresh ? 3 : 0) + aspiration(a, next.p.to, target).value + (pos === origin ? -4 : 0);
      if (!best || value > best.value) best = { p: next.p, value, fresh };
    }
    return best;
  }
  return (target: number, op: string): Option | null => {
    const at = states.get(target);
    if (!at) return null;
    let best: Option | null = null;
    for (const a of actors) {
      const origin = at.get(a.id);
      if (!origin) continue;
      const first = transfer(a, op, point(origin), at);
      if (!first) continue;
      const land = first.p.to,
        moves = origin !== land.join();
      let score = first.known ? -6 : first.samples.length ? (first.changed ? 3 : 0) : 5;
      const novel = !a.poses.has(land.join()),
        goal = aspiration(a, land, target);
      if (moves) score += 2 + (novel ? 6 : 0) + goal.value;
      if (first.changed && first.bare?.to !== land.join()) score += 6;
      if (first.peer && first.changed) score += 4;
      let use: Prediction | null = null,
        after: Prediction | undefined,
        opening: Opening | undefined,
        future = -Infinity,
        newUse = false;
      if (moves) {
        const projected = new Map(at);
        projected.set(a.id, land.join());
        if (first.peer && a.ops.get(op)!.exchange.get(first.peer)!.reciprocal)
          projected.set(first.peer, origin);
        const same = continuation(a, land, projected, target, origin);
        if (same) {
          future = same.value;
          use = same.p;
          newUse = same.fresh;
        }
        // Hold the traveler's position constant and substitute only the
        // proposed placement. The same trigger must predict a different landing.
        for (const traveler of actors) {
          const start = at.get(traveler.id);
          if (traveler === a || !start || projected.get(traveler.id) !== start) continue;
          const preparation = transfer(traveler, op, point(start), at);
          if (preparation && preparation.p.to.join() !== start) continue;
          for (const [trigger, c] of traveler.ops) {
            if (!c.exchange.has(a.id) && !c.at.has(start)) continue;
            const bare = transfer(traveler, trigger, point(start), at);
            const ready = transfer(traveler, trigger, point(start), projected);
            if (!bare || !ready || ready.p.to.join() === start || ready.p.to.join() === bare.p.to.join())
              continue;
            if (ready.peer !== a.id && (!bare.known || !ready.changed)) continue;
            const arrival = new Map(projected);
            arrival.set(traveler.id, ready.p.to.join());
            if (ready.peer && c.exchange.get(ready.peer)!.reciprocal) arrival.set(ready.peer, start);
            const next = continuation(traveler, ready.p.to, arrival, target, start);
            if (!next) continue;
            const value =
              8 +
              Math.max(0, next.value) +
              aspiration(traveler, ready.p.to, target).value +
              (traveler.poses.has(ready.p.to.join()) ? 0 : 5);
            if (value <= future) continue;
            future = value;
            use = ready.p;
            after = next.p;
            newUse = next.fresh;
            opening = {
              mover: a.id,
              placement: land,
              traveler: traveler.id,
              trigger,
              without: bare.p.to,
              destination: ready.p.to,
              controlRef:
                bare.samples.find((s) => s.edge.s === target && s.to === bare.p.to.join())?.edge.ref ?? null,
            };
          }
        }
      }
      if (use) score += Math.max(0, future) / 2;
      const direct =
        first.changed &&
        first.bare &&
        stable.find(
          (e) =>
            e.s === first.bare!.edge.s &&
            e.t === target &&
            e.anchors[a.id]?.at === origin &&
            e.visibleAfter?.includes(a.id) &&
            !e.effect.moves.some((v) => v.actor === a.id) &&
            e.effect.moves.some((v) => v.actor !== a.id && at.get(v.actor) === v.to)
        );
      if (direct && first.bare!.to !== land.join()) score += 4;
      const place: PlaceClaim = {
        ...(opening ? { opening } : {}),
        actor: a.id,
        from: point(origin),
        context: [...at].filter(([id]) => id !== a.id).map(([id, p]) => id + '@' + p),
        placementChanged: first.changed,
        bare: first.bare ? { to: point(first.bare.to), ref: first.bare.edge.ref } : null,
        preparationRef: direct ? direct.ref : null,
        reference: first.peer,
        referenceEvidence: first.peer ? (a.ops.get(op)!.exchange.get(first.peer)?.support ?? []) : [],
        target: goal.id,
        newArrival: novel,
        newUse,
      };
      if (!best || score > best.score)
        best = { score, question: { target, probe: op, arrival: moves ? first.p : null, use, after, place } };
    }
    return best;
  };
}
