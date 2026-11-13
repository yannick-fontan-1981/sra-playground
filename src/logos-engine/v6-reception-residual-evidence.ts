/** The ResidualAccess record/apply closure consumed inside ReceptionService.
 * Proposal, temporal forecasting and residual navigation are not transferred.
 */
import { symbolicDigest as identity } from './v6-hash.ts';
import { compareUnicode } from './canonical.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type Point = [number, number];
const point = (p: readonly number[]): Point => [p[0]!, p[1]!];
const add = (a: readonly number[], b: readonly number[]): Point => [a[0]! + b[0]!, a[1]! + b[1]!];
const subtract = (a: readonly number[], b: readonly number[]): Point => [a[0]! - b[0]!, a[1]! - b[1]!];
const key = (p: readonly number[]): string => JSON.stringify(p);
const order = (a: readonly number[], b: readonly number[]): number => a[0]! - b[0]! || a[1]! - b[1]!;
const unique = (points: readonly (readonly number[])[]): Point[] => [...new Map(points.map(p => [key(p), point(p)])).values()];

function measuredGroups(observation: R): Map<string, R[]> {
  const result = new Map<string, R[]>();
  for (const entity of observation.entities as R[]) {
    const group = result.get(entity.signature) ?? []; group.push(entity); result.set(entity.signature, group);
  }
  return result;
}
function anchors(positions: readonly (readonly number[])[], offsets: readonly (readonly number[])[]): Point[] {
  const points = unique(positions), present = new Set(points.map(key));
  return points.map(p => subtract(p, offsets[0]!))
    .filter(anchor => offsets.every(offset => present.has(key(add(anchor, offset))))).sort(order);
}
function entry(rows: NativeRows, origin: readonly number[], target: readonly number[], mask: readonly (readonly number[])[]): number[] | null {
  const old = new Set(mask.map(p => key(add(origin, p))));
  const coords = unique(mask.map(p => add(target, p))).filter(p => !old.has(key(p))).sort(order);
  if (!coords.length || coords.some(([x, y]) => x < 0 || y < 0 || y >= rows.length || x >= rows[0]!.length)) return null;
  return coords.map(([x, y]) => rows[y]![x]!);
}

export class ReceptionResidualEvidence {
  private roles = new Map<string, R>();
  private controls = new Map<string, R[]>();
  private visited = new Map<string, Map<string, Point>>();
  private failed = new Set<string>();

  applyEvent(event: R): void {
    const kind = event.kind;
    if (kind === 'residual_role_shape') this.roles.set(event.role_ref, structuredClone(event.role));
    else if (kind === 'residual_role_transition') {
      const role = event.role_ref, controls = this.controls.get(role) ?? [], visited = this.visited.get(role) ?? new Map<string, Point>();
      controls.push(structuredClone(event)); this.controls.set(role, controls);
      visited.set(key(event.origin), point(event.origin));
      if (event.arrivals.length === 1) visited.set(key(event.arrivals[0]), point(event.arrivals[0]));
      this.visited.set(role, visited);
    } else if (kind === 'residual_access_result' && event.reached !== true) this.failed.add(event.premise_ref);
  }

  currentState(): R {
    return structuredClone({ roles: Object.fromEntries(this.roles), controls: Object.fromEntries(this.controls),
      visited: Object.fromEntries([...this.visited].map(([name, values]) => [name, [...values.values()].sort(order)])),
      failed: [...this.failed].sort(compareUnicode) });
  }
  retainedDigest(): string { return identity(this.currentState()); }

  record(before: R, command: R, after: R, first: NativeRows, _last: NativeRows, proposal: R, index: number): R[] {
    if (truth(command.data)) return [];
    if (before.level_epoch !== after.level_epoch || before.state !== after.state) {
      if (!Object.hasOwn(proposal, 'residual_plan')) return [];
      const step = proposal.residual_plan.prefix[index];
      return [{ kind: 'residual_boundary_witness', role_ref: proposal.residual_plan.role_ref, premise_ref: step.premise_ref,
        before_ref: before.observation_ref, after_ref: after.observation_ref, score_delta: after.levels_completed - before.levels_completed }];
    }
    const old = measuredGroups(before), current = measuredGroups(after), events: R[] = [], epoch = before.level_epoch;
    for (const signature of [...new Set([...old.keys(), ...current.keys()])].sort(compareUnicode)) {
      const oldGroup = old.get(signature) ?? [], newGroup = current.get(signature) ?? [];
      const a = unique(oldGroup.map(e => e.position)), b = unique(newGroup.map(e => e.position));
      const aKeys = new Set(a.map(key)), bKeys = new Set(b.map(key));
      const removed = a.filter(p => !bKeys.has(key(p))).sort(order), appeared = b.filter(p => !aKeys.has(key(p))).sort(order);
      if (Math.max(a.length, b.length) <= 1 || !(removed.length || appeared.length)) continue;
      events.push({ kind: 'residual_correspondence_set', epoch, signature, removed, appeared,
        pairing: 'cartesian_product_unassigned', candidate_pair_count: removed.length * appeared.length,
        stationary_occurrences_cancelled: a.filter(p => bKeys.has(key(p))).length,
        before_ref: before.observation_ref, after_ref: after.observation_ref });
      if (removed.length < 2 || removed.length !== appeared.length) continue;
      const vector = subtract(appeared[0]!, removed[0]!);
      if (!equal(removed.map(p => add(p, vector)).sort(order), appeared)) continue;
      const origin: Point = [Math.min(...removed.map(p => p[0])), Math.min(...removed.map(p => p[1]))];
      const offsets = removed.map(p => subtract(p, origin)).sort(order), sample = oldGroup[0]!;
      const mask = unique(offsets.flatMap(d => (sample.mask as Point[]).map(m => add(d, m)))).sort(order);
      const shape = { epoch, signature, offsets, mask, value: sample.palette_value };
      const identifier = 'residual:' + identity(shape);
      if (!this.roles.has(identifier)) {
        const definition = { kind: 'residual_role_shape', role_ref: identifier, role: shape,
          before_ref: before.observation_ref, after_ref: after.observation_ref };
        this.applyEvent(definition); events.push(definition);
      }
    }
    for (const [identifier, role] of this.roles) {
      if (role.epoch !== epoch) continue;
      const source = anchors((old.get(role.signature) ?? []).map(e => e.position), role.offsets);
      const arrivals = anchors((current.get(role.signature) ?? []).map(e => e.position), role.offsets);
      if (source.length !== 1) continue;
      const origin = source[0]!, surface = arrivals.length === 1 && !equal(arrivals[0], origin)
        ? entry(first, origin, arrivals[0]!, role.mask) : null;
      const change = { kind: 'residual_role_transition', role_ref: identifier, origin, arrivals, action: command.action_ref,
        entry_surface: surface, before_ref: before.observation_ref, after_ref: after.observation_ref };
      this.applyEvent(change); events.push(change);
    }
    if (Object.hasOwn(proposal, 'residual_plan')) {
      const route = proposal.residual_plan, step = route.prefix[index], role = this.roles.get(route.role_ref)!;
      const locations = anchors((current.get(role.signature) ?? []).map(e => e.position), role.offsets);
      const changed = { kind: 'residual_access_result', role_ref: route.role_ref, premise_ref: step.premise_ref, from: step.from,
        expected: step.to, actual_candidates: locations, reached: locations.length === 1 ? equal(locations, [step.to]) : null,
        before_ref: before.observation_ref, after_ref: after.observation_ref };
      this.applyEvent(changed); events.push(changed);
    }
    return structuredClone(events);
  }
}
