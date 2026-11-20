import type { NativeEntity, NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { Memory } from './preparation-experiments.ts';
import { add, diff, same, size, type XY } from './access-terrain.ts';
import { groupsOf, resolveRole, type Role, type RolePair } from './exchange-roles.ts';
import { contactEvidence } from './contact-aspirations.ts';

export type Stride = {
  op: string;
  delta: XY;
  inverse: string;
  ref: number;
  backRef: number;
  support: number;
};
export type Waypoint = { op: string; to: XY; ref: number };
export type SitePlan = {
  roles: RolePair;
  start: XY;
  target: XY;
  placement: XY;
  origin: number;
  already: number | null;
  route: Waypoint[];
  operand: string;
  bareRef: number | null;
  control: Stride;
  desired: XY;
  future: XY;
  driverTo: XY;
  member: 0 | 1;
  delta: XY;
  goal: XY | null;
  blockedHere: boolean;
  score: number;
  key: string;
  kind: string;
  learnedRef: number | null;
  alternatives: { site: XY; target: XY; to: XY; use: XY }[];
};
export type SiteFact = { ref: number; delta: XY; control: XY; driver: boolean; setup: XY };
export type SiteSearch = {
  tried: Record<string, number>;
  facts: Record<string, SiteFact>;
  blocked: Record<string, number>;
};
// Express the measured displacement in the basis (control, quarter-turn(control)).
export function transferDisplacement(f: SiteFact | undefined, control: XY): XY | null {
  if (!f) return null;
  const [x, y] = f.control,
    [dx, dy] = f.delta,
    [u, v] = control,
    scale = x * x + y * y;
  if (!scale) return null;
  const along = (dx * x + dy * y) / scale,
    across = (dy * x - dx * y) / scale;
  const to: XY = [along * u - across * v, across * u + along * v];
  return to.every(Number.isInteger) && size(to) > 0 ? to : null;
}
export const siteFactKey = (roles: RolePair, b: string) =>
  [roles[0].signature, roles[1].signature, b].join('/');
export const gaitKey = (role: Role, p: XY, op: string) => [role.signature, p, op].join('/');
function gaits(m: Memory, o: NativeObservation, available: Set<string>) {
  const here = groupsOf(o),
    by = new Map<
      string,
      { role: Role; ops: Map<string, { op: string; delta: XY; ref: number; from: Set<string> }[]> }
    >();
  for (const e of m.edges)
    if (e.stable && !e.cmd.includes(':') && available.has(e.cmd))
      for (const v of e.manipulation?.moves ?? []) {
        const delta = diff(v.to, v.from);
        if (!size(delta)) continue;
        const id = JSON.stringify([v.role.signature, v.role.fixed]);
        let row = by.get(id);
        if (!row) {
          row = { role: v.role, ops: new Map() };
          by.set(id, row);
        }
        const list = row.ops.get(e.cmd) ?? [];
        let use = list.find((u) => same(u.delta, delta));
        if (!use) {
          use = { op: e.cmd, delta, ref: e.ref, from: new Set() };
          list.push(use);
        }
        use.from.add(v.from.join());
        use.ref = e.ref;
        row.ops.set(e.cmd, list);
      }
  const result = [];
  for (const g of by.values()) {
    const body = resolveRole(here, g.role);
    if (!body) continue;
    const modes = [...g.ops.values()].flatMap((list) => {
      list.sort((a, b) => b.from.size - a.from.size || size(a.delta) - size(b.delta));
      return list.length > 1 && list[1]!.from.size === list[0]!.from.size ? [] : [list[0]!];
    });
    const controls: Stride[] = [],
      responses: Stride[] = [];
    for (const use of modes) {
      const undo = modes.find((v) => same(v.delta, [-use.delta[0], -use.delta[1]]));
      const stride = {
        op: use.op,
        delta: use.delta,
        inverse: undo?.op ?? '',
        ref: use.ref,
        backRef: undo?.ref ?? use.ref,
        support: use.from.size,
      };
      responses.push(stride);
      if (undo) controls.push(stride);
    }
    if (responses.length)
      result.push({
        role: g.role,
        body,
        controls,
        responses,
        score: responses.reduce((n, c) => n + Math.min(4, c.support), 0),
      });
  }
  return result.sort((a, b) => b.score - a.score).slice(0, 3);
}
const boxAt = (e: NativeEntity, p: XY) => [
  p[0],
  p[1],
  p[0] + e.bbox[2] - e.bbox[0],
  p[1] + e.bbox[3] - e.bbox[1],
];
const distance = (a: readonly number[], b: readonly number[]) =>
  Math.max(0, a[0]! - b[2]!, b[0]! - a[2]!) + Math.max(0, a[1]! - b[3]!, b[1]! - a[3]!);
function fits(e: NativeEntity, p: XY, rows: NativeRows) {
  return (
    p[0] >= 0 &&
    p[1] >= 0 &&
    p[0] + e.bbox[2] - e.bbox[0] < rows[0]!.length &&
    p[1] + e.bbox[3] - e.bbox[1] < rows.length
  );
}
function closeTo(box: readonly number[], p: XY) {
  return Math.max(0, box[0]! - p[0], p[0] - box[2]!) + Math.max(0, box[1]! - p[1], p[1] - box[3]!);
}
export function findInstrumentSites(
  m: Memory,
  o: NativeObservation,
  rows: NativeRows,
  scene: number,
  available: Set<string>,
  state: SiteSearch
) {
  const actorModels = gaits(m, o, available),
    groups = groupsOf(o),
    area = rows.length * rows[0]!.length;
  const local = m.edges.filter((e) => e.stable && e.s === scene);
  const dormant = new Map<string, number>();
  for (const e of m.edges) if (e.stable && e.s === e.t && available.has(e.cmd)) dormant.set(e.cmd, e.ref);
  const plans: SitePlan[] = [];
  const last = m.edges[m.previous];
  for (const { role, body, controls, responses } of actorModels) {
    const arrived =
      last?.t === scene
        ? last.manipulation?.moves.find(
            (v) => v.role.signature === role.signature && same(v.to, [...body.position])
          )
        : null;
    const stops = new Set<string>();
    for (const e of m.edges)
      if (e.stable && e.s === e.t && e.anchors[role.signature])
        stops.add(e.anchors[role.signature]!.at + '/' + e.cmd);
    const start: XY = [...body.position],
      support = new Set(controls.map((c) => c.op));
    const operands = [...available]
      .filter((b) => !support.has(b) || dormant.has(b))
      .filter((b) => !b.includes(':') || dormant.has(b))
      .sort((a, b) => Number(dormant.has(b)) - Number(dormant.has(a)))
      .slice(0, 6);
    if (!operands.length) continue;
    const targets = o.entities
      .filter(
        (e) =>
          e.signature !== role.signature &&
          e.area > 0 &&
          e.area <= area / 10 &&
          groups.get(e.signature)!.size <= 12
      )
      .sort(
        (a, b) =>
          Number(a.identity_ambiguous) - Number(b.identity_ambiguous) ||
          Math.abs(Math.log(a.area / body.area)) - Math.abs(Math.log(b.area / body.area))
      )
      .slice(0, 28);
    if (!targets.length) continue;
    const paths: { p: XY; route: Waypoint[] }[] = [{ p: start, route: [] }],
      visited = new Set([start.join()]);
    for (const n of paths) {
      if (n.route.length >= 10 || paths.length >= 220) continue;
      for (const c of controls) {
        const stop = state.blocked[gaitKey(role, n.p, c.op)];
        if (stop && m.turns - stop < 16) continue;
        const p = add(n.p, c.delta);
        if (!fits(body, p, rows) || role.fixed.includes(p.join()) || visited.has(p.join())) continue;
        visited.add(p.join());
        paths.push({ p, route: [...n.route, { op: c.op, to: p, ref: c.ref }] });
      }
    }
    for (const target of targets) {
      const at: XY = [...target.position],
        tRole: Role = {
          signature: target.signature,
          fixed: [...groups.get(target.signature)!.keys()].filter((p) => p !== at.join()).sort(),
        };
      const roles: RolePair = [role, tRole],
        stride = Math.min(...responses.map((c) => size(c.delta)));
      const near = paths
        .filter((n) => distance(boxAt(body, n.p), target.bbox) <= stride)
        .sort(
          (a, b) =>
            distance(boxAt(body, a.p), target.bbox) - distance(boxAt(body, b.p), target.bbox) ||
            a.route.length - b.route.length
        );
      // Probe different sides and the interior. Coordinates name an experiment only inside this episode.
      const sectors = new Set<string>();
      const centre: XY = [(target.bbox[0] + target.bbox[2]) / 2, (target.bbox[1] + target.bbox[3]) / 2];
      for (const n of near) {
        const middle: XY = [
          n.p[0] + (body.bbox[2] - body.bbox[0]) / 2,
          n.p[1] + (body.bbox[3] - body.bbox[1]) / 2,
        ];
        const sector = [Math.sign(middle[0] - centre[0]), Math.sign(middle[1] - centre[1])].join();
        if (sectors.has(sector)) continue;
        sectors.add(sector);
        for (const b of operands) {
          const previousBare =
            !n.route.length && arrived && last
              ? m.edges.find((e) => e.stable && e.s === last.s && e.cmd === b)
              : undefined;
          const known = previousBare || local.find((e) => e.cmd === b),
            fact = state.facts[siteFactKey(roles, b)];
          if (!fact && known && known.t !== known.s && !dormant.has(b)) continue;
          if (!fact && !dormant.has(b) && (b.includes(':') || !n.route.length)) continue;
          for (const c of responses) {
            if (c.op === b) continue;
            const blockedHere = stops.has(n.p.join() + '/' + c.op);
            if (!n.route.length && !previousBare && !fact && !blockedHere) continue;
            const calibrated = transferDisplacement(fact, c.delta),
              member: 0 | 1 = calibrated && fact ? (fact.driver ? 0 : 1) : blockedHere ? 0 : 1;
            const delta = calibrated ?? c.delta,
              driverTo = add(n.p, member === 0 ? delta : c.delta);
            const moved = member === 0 ? body : target,
              from = member === 0 ? n.p : at;
            const desired = add(calibrated && fact ? add(from, fact.setup) : from, delta),
              future = add(desired, delta);
            if (!fits(moved, desired, rows) || roles[member].fixed.includes(desired.join())) continue;
            const key = JSON.stringify([role.signature, tRole.signature, at, n.p, b, c.op]);
            if (state.tried[key]) continue;
            let benefit = 0,
              goal: XY | null = null;
            for (const f of targets) {
              if (f.signature === target.signature) continue;
              const before = distance(boxAt(moved, from), f.bbox),
                after = distance(boxAt(moved, desired), f.bbox);
              if (after >= before) continue;
              const value =
                Math.min(10, ((before - after) / stride) * 3) + (after === 0 ? 12 : 4 / (1 + after));
              if (value > benefit) {
                benefit = value;
                goal = [...f.position];
              }
            }
            const d = distance(boxAt(body, n.p), target.bbox);
            const confidence = Math.min(4, c.support) + Math.exp(contactEvidence(body, target));
            const score =
              (calibrated ? 65 : 0) +
              (known && known.t === known.s ? 12 : dormant.has(b) ? 5 : 0) +
              (blockedHere ? 32 : 0) +
              (previousBare ? 6 : 0) +
              benefit +
              confidence +
              13 / (1 + d) +
              4 / (1 + closeTo(target.bbox, middle)) -
              n.route.length * 1.2 -
              Math.log2(groups.get(target.signature)!.size);
            plans.push({
              roles,
              start: previousBare && arrived ? arrived.from : start,
              target: at,
              placement: n.p,
              origin: previousBare ? previousBare.s : scene,
              already: previousBare && last ? last.ref : null,
              route: n.route,
              operand: b,
              bareRef: known?.ref ?? null,
              control: c,
              desired,
              future,
              driverTo,
              member,
              delta,
              goal,
              blockedHere,
              score,
              key,
              kind: calibrated
                ? 'learned site capacity'
                : blockedHere
                  ? 'open blocked motion'
                  : 'test site binding',
              learnedRef: calibrated && fact ? fact.ref : null,
              alternatives: [],
            });
          }
        }
      }
    }
  }
  plans.sort((a, b) => b.score - a.score);
  const best = plans[0];
  if (best) {
    const bindings = new Set([JSON.stringify([best.placement, best.target, best.desired])]);
    for (const p of plans) {
      const k = JSON.stringify([p.placement, p.target, p.desired]);
      if (bindings.has(k)) continue;
      best.alternatives.push({ site: p.placement, target: p.target, to: p.desired, use: p.future });
      bindings.add(k);
      if (best.alternatives.length === 5) break;
    }
  }
  return best ?? null;
}
