import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { Memory } from './preparation-experiments.ts';
import type { Prospect, Step } from './projected-affordances.ts';
import { point, same, size, diff, terrain, type XY } from './access-terrain.ts';
import {
  samplesFor,
  spatialControls,
  layoutId,
  equalLayout,
  type Roles,
  type Layout,
} from './projected-motion.ts';
import { supportProjection } from './projected-support.ts';
import { contactAspirations } from './contact-aspirations.ts';

export function proposeSiteProbe(
  m: Memory,
  o: NativeObservation,
  rows: NativeRows,
  available: Set<string>,
  scene: number
): Prospect | null {
  if (m.turns < 12 || m.recurrences < 2) return null;
  const unique = o.entities.filter(
    (e) => !e.identity_ambiguous && e.area < (rows.length * rows[0]!.length) / 4
  );
  const bodies = new Map(unique.map((e) => [e.signature, e]));
  const actions = new Map<string, Set<string>>(),
    mobility = new Map<string, number>();
  for (const e of m.edges)
    if (e.stable)
      for (const v of e.effect.moves) {
        if (!bodies.has(v.actor)) continue;
        mobility.set(v.actor, (mobility.get(v.actor) ?? 0) + 1);
        if (e.cmd.includes(':')) continue;
        const ops = actions.get(v.actor) ?? new Set<string>();
        ops.add(e.cmd);
        actions.set(v.actor, ops);
      }
  const mobile = new Set(mobility.keys());
  const sources = [...actions]
    .filter(([, ops]) => ops.size >= 2)
    .sort((a, b) => b[1].size - a[1].size || mobility.get(b[0])! - mobility.get(a[0])!);
  let best: Prospect | null = null;
  for (const [actor] of sources.slice(0, 2)) {
    const subject = bodies.get(actor)!;
    // A stationary landmark can be tested as an operand before its first measured movement.
    const anchors = unique
      .filter((e) => e !== subject)
      .sort(
        (a, b) =>
          (mobility.get(b.signature) ?? 0) - (mobility.get(a.signature) ?? 0) ||
          Math.abs(Math.log(a.area / subject.area)) - Math.abs(Math.log(b.area / subject.area))
      );
    for (const anchor of anchors.slice(0, 2)) {
      const roles: Roles = [actor, anchor.signature],
        parts: [typeof subject, typeof anchor] = [subject, anchor];
      const current: Layout = [[...subject.position], [...anchor.position]];
      const traces = samplesFor(m.edges, roles, available),
        models = spatialControls(traces, available);
      const walk = models.filter((model) => {
        const f = model.rules[0].formula;
        return (
          !model.op.includes(':') &&
          f.source === 0 &&
          size(f.offset) > 0 &&
          model.samples.some((t) => same(diff(t.after[0], t.before[0]), f.offset))
        );
      });
      if (walk.length < 2) continue;
      const stride = Math.min(...walk.map((v) => size(v.rules[0].formula.offset)));
      const controls = walk.filter((model) => size(model.rules[0].formula.offset) <= 2 * stride);
      if (controls.length < 2) continue;
      const floors = parts.map((b) => terrain(rows, b, mobile, o, m.space.floor)),
        occupied = [new Set<string>(), new Set<string>()];
      const exact = new Map<string, Layout | null>(),
        refs = new Map<string, number>();
      const positions = new Map<string, Set<string>>();
      for (const [op, samples] of traces)
        for (const t of samples) {
          const k = layoutId(t.before) + '/' + op,
            old = exact.get(k);
          exact.set(k, old === undefined || (old && equalLayout(old, t.after)) ? t.after : null);
          refs.set(k, t.ref);
          const sites = positions.get(op) ?? new Set<string>();
          sites.add(t.before[0].join());
          positions.set(op, sites);
          for (const i of [0, 1]) {
            occupied[i]!.add(t.before[i]!.join());
            occupied[i]!.add(t.after[i]!.join());
          }
        }
      const surfaces = floors.map((f) => f.ground);
      const simulate = new Map(
        models.map((model) => [model.op, supportProjection(model, parts, rows, surfaces, occupied)])
      );
      const stationary = o.entities.filter(
        (e) => !mobile.has(e.signature) && e.area <= (rows.length * rows[0]!.length) / 12
      );
      const aim = contactAspirations(
        parts,
        stationary.filter((e) => !roles.includes(e.signature)),
        models,
        occupied,
        current
      );
      const uncertain = [...available].filter((op) => !controls.some((model) => model.op === op));
      if (!uncertain.length) continue;
      const coverageFor = new Map(
        uncertain.map((op) => {
          const points = [...(positions.get(op) ?? [])].map(point);
          const regions = new Set(points.map((at) => floors[0]!.region(at)));
          const distances = new Map<string, number>();
          return [
            op,
            {
              regions,
              nearest: (p: XY) => {
                const k = p.join();
                let d = distances.get(k);
                if (d === undefined) {
                  d = points.length ? Math.min(...points.map((q) => size(diff(q, p)) / stride)) : 2;
                  distances.set(k, d);
                }
                return d;
              },
            },
          ] as const;
        })
      );
      const within = (layout: Layout) =>
        layout.every(
          (p, i) =>
            p[0] >= 0 &&
            p[1] >= 0 &&
            p[0] + parts[i]!.bbox[2] - parts[i]!.bbox[0] < rows[0]!.length &&
            p[1] + parts[i]!.bbox[3] - parts[i]!.bbox[1] < rows.length
        );
      const queue: { p: Layout; path: Step[] }[] = [{ p: current, path: [] }],
        visited = new Set([layoutId(current)]);
      const currentEdges = new Map(m.edges.filter((e) => e.s === scene).map((e) => [e.cmd, e]));
      for (let n = 0; n < queue.length && n < 420; n++) {
        const { p, path } = queue[n]!;
        const [x, y] = p[0];
        const cx = x + (subject.bbox[2] - subject.bbox[0]) / 2,
          cy = y + (subject.bbox[3] - subject.bbox[1]) / 2;
        const f = stationary
          .filter(
            (z) =>
              cx >= z.bbox[0] - 0.5 && cx <= z.bbox[2] + 0.5 && cy >= z.bbox[1] - 0.5 && cy <= z.bbox[3] + 0.5
          )
          .sort(
            (a, b) =>
              Math.abs(cx * 2 - a.bbox[0] - a.bbox[2]) +
              Math.abs(cy * 2 - a.bbox[1] - a.bbox[3]) -
              Math.abs(cx * 2 - b.bbox[0] - b.bbox[2]) -
              Math.abs(cy * 2 - b.bbox[1] - b.bbox[3])
          )[0];
        for (const op of uncertain) {
          const k = layoutId(p) + '/' + op,
            sites = positions.get(op) ?? new Set<string>(),
            model = models.find((v) => v.op === op);
          if (exact.has(k) || m.projection.attempted[[...roles, layoutId(p), op].join('/')]) continue;
          if (!path.length && currentEdges.has(op)) continue;
          const click = op.split(':')[1]?.split(',').map(Number);
          if (
            click &&
            (!f ||
              click[0]! < f.bbox[0] ||
              click[0]! > f.bbox[2] ||
              click[1]! < f.bbox[1] ||
              click[1]! > f.bbox[3])
          )
            continue;
          const dest = simulate.get(op)?.(p) ?? p;
          if (!within(dest)) continue;
          const ref = model?.refs.length
            ? model.refs
            : (path.at(-1)?.refs ??
              traces
                .get(op)
                ?.slice(-1)
                .map((t) => t.ref) ??
              []);
          if (!ref.length) continue;
          const step: Step = { op, from: p, to: dest, refs: ref };
          const copied = model?.rules.some((r, i) => r.formula.source !== i) ?? false;
          const spatial = !!model && !equalLayout(dest, p);
          if (!spatial && !f && !path.length) continue;
          const region = floors[0]!.region(p[0]);
          const field = coverageFor.get(op)!;
          const untestedRegion = region > 0 && !field.regions.has(region);
          const separation = field.nearest(p[0]);
          const coverage = sites.has(p[0].join()) ? 0 : 10 + Math.min(12, separation) * 1.6;
          for (const c of controls) {
            const after = simulate.get(c.op)!(dest);
            if (!within(after) || equalLayout(after, dest)) continue;
            const continued = exact.get(layoutId(dest) + '/' + c.op);
            if (continued === null || (continued && !equalLayout(continued, after))) continue;
            const follow: Step = { op: c.op, from: dest, to: after, refs: c.refs };
            const changesRegion = dest.some(
              (pt, i) => floors[i]!.region(pt) > 0 && floors[i]!.region(pt) !== floors[i]!.region(p[i]!)
            );
            const score =
              coverage +
              (untestedRegion ? 18 : 0) +
              (copied ? 12 : 0) +
              (changesRegion ? 25 : 0) +
              (f ? 8 : 0) +
              Math.min(35, aim(after).reward) +
              Math.min(14, aim(dest).reward) / 2 -
              path.length * 1.4 -
              (sites.has(p[0].join()) ? 10 : 0);
            if (!best || score > best.score)
              best = {
                roles,
                steps: [...path, step, follow],
                arrival: path.length,
                site: { operand: actor, at: p[0], trigger: op, grounded: spatial },
                goals: f ? [{ role: actor, feature: f.id, position: p[0] }] : [],
                score,
                region: changesRegion,
              };
          }
        }
        if (path.length >= 22) continue;
        for (const c of controls) {
          const k = layoutId(p) + '/' + c.op,
            measured = exact.get(k);
          if (
            measured === null ||
            (!path.length && currentEdges.get(c.op)?.s === scene && currentEdges.get(c.op)?.t === scene)
          )
            continue;
          const next = measured ?? simulate.get(c.op)!(p);
          if (equalLayout(next, p) || !within(next) || visited.has(layoutId(next))) continue;
          if (
            !measured &&
            next.some(
              (pt, i) =>
                !same(pt, p[i]!) &&
                floors[i]!.ground >= 0 &&
                floors[i]!.region(p[i]!) &&
                !floors[i]!.region(pt) &&
                !occupied[i]!.has(pt.join()) &&
                (m.space.floor[roles[i]!]?.[rows[pt[1]]?.[pt[0]] ?? -1] ?? 0) === 0
            )
          )
            continue;
          visited.add(layoutId(next));
          queue.push({
            p: next,
            path: [...path, { op: c.op, from: p, to: next, refs: measured ? [refs.get(k)!] : c.refs }],
          });
        }
      }
    }
  }
  return best;
}
