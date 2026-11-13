/** Entry rebind and continuation from the unchanged V6 morphology adapter.
 * Public measurements bind only the released prefix; a recalled method is not
 * authority. Facts are enriched in the source order and no history is owned here.
 */
import { compareUnicode } from './canonical.ts';
import { compositionIdentity, registered } from './v6-composition-memory.ts';
import type { CompositionTransition, Snapshot } from './v6-composition-memory.ts';
import { measureMorphologyRoutes, morphologyPairs } from './v6-morphology-measurements.ts';
import type { MorphologyCollectionEvidence } from './v6-morphology-managed.ts';
import { motionFootprint } from './v6-motion-contrast.ts';
import type { RigidMotionTrack } from './v6-motion-contrast.ts';
import { pythonEqual as same, pythonTruthy as truth } from './v6-operations.ts';
import { recalledDirections } from './v6-target-method.ts';
import type { NativePoint, NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
const key = (value: unknown): string => JSON.stringify(value);
const point = (value: readonly number[]): NativePoint => [value[0]!, value[1]!];
const footprint = (rows: NativeRows, at: readonly number[], size: readonly number[]) => motionFootprint(rows, point(at), point(size));
const hasRoles = (scene: Snapshot, roles: readonly string[]): boolean => roles.every(role => Object.hasOwn(scene.roles, role));

/** Source perimeter_values returns only observed colors, without a fixed role. */
export function morphologyEntryPerimeterValues(rows: NativeRows, at: readonly number[], size: readonly number[]): Set<number> {
  const [x, y] = point(at), [w, h] = point(size), cells: NativePoint[] = [];
  for (const i of [x - 1, x + w]) for (let j = y; j < y + h; j++) cells.push([i, j]);
  for (const j of [y - 1, y + h]) for (let i = x; i < x + w; i++) cells.push([i, j]);
  return new Set(cells.filter(([i, j]) => 0 <= j && j < rows.length && 0 <= i && i < rows[0]!.length).map(([i, j]) => rows[j]![i]!));
}

/** Exact coordinate-sorted contour, excluding the previously occupied rectangle. */
export function morphologyEntryContour(rows: NativeRows, at: readonly number[], size: readonly number[], exclude: readonly number[] | null = null): number[][] {
  const [x, y] = point(at), [w, h] = point(size), cells = new Map<string, NativePoint>();
  for (const i of [x - 1, x + w]) for (let j = y; j < y + h; j++) cells.set(key([i, j]), [i, j]);
  for (const j of [y - 1, y + h]) for (let i = x; i < x + w; i++) cells.set(key([i, j]), [i, j]);
  return [...cells.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .filter(([i, j]) => 0 <= j && j < rows.length && 0 <= i && i < rows[0]!.length
      && !(truth(exclude) && exclude![0]! <= i && i < exclude![0]! + w && exclude![1]! <= j && j < exclude![1]! + h))
    .map(([i, j]) => [i, j, rows[j]![i]!]);
}

/** continuation.resume mutates the current facts only after all source guards. */
export async function resumeMorphologyEntry(pending: R | null, current: Snapshot, observation: R, facts: R,
  remaining: number, available: readonly string[], forecast: R | null): Promise<R | null> {
  if (!truth(pending) || remaining < 2 || !truth(forecast) || forecast!.steps_before_empty < 2) return null;
  const plan = pending!.plan, step = plan.steps[0], size = plan.size, roles = plan.role_refs as string[];
  if (!same([pending!.after, plan.level_epoch, plan.score, plan.facts_pair], [current.ref, current.epoch, current.score, facts.pair_ref ?? null])) return null;
  if (current.ref !== observation.observation_ref || truth(facts.alignment_refuted)) return null;
  if (!hasRoles(current, roles)) return null;
  const origin = [0, 1].map(i => Math.min(...roles.map(role => current.roles[role]![i]!)));
  if (!same(origin, step.from) || !available.includes(step.action_ref)) return null;
  if (await compositionIdentity(footprint(current.rows, origin, size)) !== plan.footprint_sha) return null;
  if (await compositionIdentity(footprint(current.rows, step.to, size)) !== step.surface_sha) return null;
  if (!same(morphologyEntryContour(current.rows, step.to, size, step.from), plan.untested_contour)) return null;
  const retreat = plan.exit_candidate;
  if (await compositionIdentity(footprint(current.rows, retreat.to, size)) !== retreat.surface_sha) return null;
  if (!available.includes(retreat.action_ref)) return null;
  const route = 'entry_probe', actions = [{ action_ref: step.action_ref }];
  const proof = [pending!.before, pending!.after, ...plan.evidence];
  Object.assign(facts, { entry_probe_bound: true, controlled_xy: origin, entry_probe_xy: step.to, entry_access_return: pending!.return_ref });
  facts.routes[route] = { start_xy: origin, end_xy: step.to, actions, observation_ref: current.ref,
    level_epoch: current.epoch, contact_in_prefix: true, full_access_length: 1 };
  return { ...plan, route_key: route, observation_ref: current.ref, trial: await compositionIdentity([current.ref, route, actions]),
    evidence: proof, last_effect_unknown: true, contact_in_prefix: true, access_phase: 'discriminant', goal_xy: step.to,
    full_access_length: 1, information_cost: 1, reserve_after_probe: forecast!.steps_before_empty - 1,
    risks: ['untested_contour_may_cause_nonlocal_motion', 'control_or_resource_loss', 'reverse_is_not_yet_observed_in_this_epoch'],
    alternatives: ['test_another_control_axis', 'return_over_previously_traversed_surface'],
    predictions: { local_translation: step.to, different_effect: 'stop_and_measure_current_position_and_composition' },
    parent_return_ref: pending!.return_ref };
}

/** entry_rebind.approach revalidates two origins on one phase-matched axis. */
export async function approachMorphologyEntry(method: R | null, history: readonly CompositionTransition[], current: Snapshot,
  observation: R, facts: R, remaining: number, available: readonly string[], forecast: R | null,
  collection: MorphologyCollectionEvidence | null): Promise<R | null> {
  if (!truth(method) || !history.length || remaining < 2 || truth(facts.control_attested) || !truth(facts.framed_pair)
    || !truth(facts.homologous) || !truth(facts.asymmetric) || truth(facts.alignment_refuted)
    || !same([current.epoch, current.ref], [observation.level_epoch, observation.observation_ref])) return null;
  const decision = { composition: 'alignment_of_homologous_patterns', measured_facts: facts };
  const recalled = recalledDirections(method, decision, current);
  const motions = Object.fromEntries(Object.entries(recalled).filter(([action]) => available.includes(action)).map(([action, vector]) => [action, point(vector as number[])]));
  const witness = truth(method!.station_hypothesis) ? method!.station_hypothesis : {}, roles = [...(method!.role_refs ?? [])] as string[];
  const witnessRoles = new Set(witness.role_refs ?? []), uniqueRoles = new Set(roles);
  if (!Object.keys(motions).length || !roles.length || witnessRoles.size !== uniqueRoles.size || [...uniqueRoles].some(role => !witnessRoles.has(role))) return null;
  if (!hasRoles(current, roles) || !truth(method!.scoring_observation)) return null;
  const boxes = roles.map(role => current.roles[role]!), x = Math.min(...boxes.map(box => box[0])), y = Math.min(...boxes.map(box => box[1]));
  const size: NativePoint = [Math.max(...boxes.map(box => box[2])) - x + 1, Math.max(...boxes.map(box => box[3])) - y + 1];
  if (!same(size, witness.size ?? [])) return null;
  const offsets = new Map(roles.map(role => [role, [current.roles[role]![0] - x, current.roles[role]![1] - y] as NativePoint]));
  const position = (scene: Snapshot): NativePoint | null => {
    if (!hasRoles(scene, roles)) return null;
    const origins = new Map<string, NativePoint>();
    for (const [role, [dx, dy]] of offsets) {
      const origin: NativePoint = [scene.roles[role]![0] - dx, scene.roles[role]![1] - dy]; origins.set(key(origin), origin);
    }
    return origins.size === 1 ? [...origins.values()][0]! : null;
  };
  const pixels = new Set<string>();
  const [, parts] = await morphologyPairs(current.rows);
  for (const part of parts) {
    const signature = await compositionIdentity({ palette_value: part.color, area: part.area, scale: part.scale,
      normalized_mask: [...part.normalized].sort((a, b) => a[0] - b[0] || a[1] - b[1]) });
    if (!offsets.has(signature)) continue;
    const [left, top] = part.bbox;
    for (const [i, j] of part.mask) pixels.add(key([left + i, top + j]));
  }
  if (pixels.size !== size[0] * size[1]) return null;
  type Witnesses = Map<string, readonly [string, string]>;
  const confirmed = new Map<string, Map<string, { surface: readonly number[]; origins: Witnesses }>>();
  const blocked = new Map<string, Set<string>>(), unresolved = new Set<string>(), surround = new Map<string, Set<number>>();
  for (const [before, command, after] of history) {
    if (before.epoch !== current.epoch || after.epoch !== current.epoch || before.score !== after.score || !Object.hasOwn(motions, command)) continue;
    const first = position(before), second = position(after);
    if (!first || !second || !registered(before, after) || !registered(after, current)) continue;
    const [dx, dy] = motions[command]!, dest: NativePoint = [first[0] + dx, first[1] + dy], surface = footprint(before.rows, dest, size);
    if (surface === null) continue;
    const surfaceHash = await compositionIdentity(surface);
    if (same(second, dest) && same(footprint(after.rows, second, size), footprint(before.rows, first, size))) {
      const surfaces = confirmed.get(command) ?? new Map<string, { surface: readonly number[]; origins: Witnesses }>();
      const item = surfaces.get(key(surface)) ?? { surface, origins: new Map<string, readonly [string, string]>() };
      item.origins.set(key(first), [before.ref, after.ref]); surfaces.set(key(surface), item); confirmed.set(command, surfaces);
      const at = key([command, surfaceHash]), colors = surround.get(at) ?? new Set<number>();
      for (const color of morphologyEntryPerimeterValues(before.rows, dest, size)) colors.add(color);
      surround.set(at, colors);
    } else if (same(second, first)) {
      const items = blocked.get(command) ?? new Set<string>(); items.add(key([first, surfaceHash])); blocked.set(command, items);
    } else unresolved.add(command);
  }
  const attest = new Map<string, Map<string, Witnesses>>();
  for (const [command, surfaces] of confirmed) {
    if (unresolved.has(command)) continue;
    const items = new Map<string, Witnesses>();
    for (const { surface, origins } of surfaces.values()) if (origins.size >= 2) items.set(await compositionIdentity(surface), origins);
    attest.set(command, items);
  }
  if (![...attest.values()].some(value => value.size)) return null;
  const candidate: RigidMotionTrack = { roles, moves: motions, position, size };
  const { plans } = await measureMorphologyRoutes({ history, current, limit: Math.min(16, remaining), contacts: new Map(),
    tried: new Set(), available, actionBudget: remaining, observation, meterForecast: forecast,
    stationMethod: witness, collectionEvidence: collection, provisionalControl: candidate });
  const ordered = Object.entries(plans).filter(([name, plan]) => ['feature_probe', 'capacity_probe'].includes(name) && truth(plan.steps))
    .sort(([a], [b]) => compareUnicode(a, b)) as [string, R][];
  if (!ordered.length) return null;
  const prefix: R[] = []; let proof: (readonly [string, string])[] = [], chosenAxis: string | null = null, deferred: R | null = null;
  const commonLength = Math.min(...ordered.map(([, plan]) => plan.steps.length));
  for (let index = 0; index < commonLength; index++) {
    const group = ordered.map(([, plan]) => plan.steps[index]), first = group[0]!, command = first.action_ref;
    if (group.some(step => !same([step.from, step.to, step.action_ref], [first.from, first.to, command]))) break;
    if (group.some(step => truth(step.nonlocal_witness))) break;
    if (group.some((step, at) => same(step.to, ordered[at]![1].goal_xy))) break;
    const anchors = attest.get(command)?.get(first.surface_sha);
    if (!anchors || blocked.get(command)?.has(key([first.from, first.surface_sha]))) break;
    const witnessedSurround = surround.get(key([command, first.surface_sha]))!;
    if ([...morphologyEntryPerimeterValues(current.rows, first.to, size)].some(value => !witnessedSurround.has(value))) {
      if (prefix.length >= 2) {
        const inverse = Object.entries(motions).filter(([, value]) => same(value, motions[command]!.map(z => -z))).map(([action]) => action);
        if (inverse.length === 1) {
          const retreat = prefix.at(-1)!.from;
          deferred = { steps: [first], untested_contour: morphologyEntryContour(current.rows, first.to, size, first.from),
            exit_candidate: { action_ref: inverse[0], to: retreat, surface_sha: await compositionIdentity(footprint(current.rows, retreat, size)) } };
        }
      }
      break;
    }
    if (chosenAxis && command !== chosenAxis) break;
    chosenAxis = command; proof = [...anchors.values()].slice(0, 2); prefix.push(first);
    if (prefix.length >= 16 || prefix.length >= remaining) break;
    if (truth(forecast) && prefix.length >= forecast!.steps_before_empty - 1) break;
  }
  if (prefix.length < 2 || truth(forecast) && prefix.length >= forecast!.steps_before_empty) return null;
  const [, plan] = ordered[0]!, actions = prefix.map(step => ({ action_ref: step.action_ref }));
  const evidence = [method!.scoring_observation, ...proof.flat(), current.ref], route = 'entry_rebind';
  Object.assign(facts, { entry_rebind_bound: true, revalidated_axis: chosenAxis, controlled_xy: [x, y], entry_rebind_xy: prefix.at(-1)!.to,
    entry_rebind_evidence: evidence, entry_rebind_goals: ordered.map(([family, item]) => ({ family, site: item.goal_xy, full_distance: item.full_access_length })),
    entry_rebind_uncertainty: 'only the confirmed direction and measured entrance surface are locally bound' });
  facts.routes[route] = { start_xy: [x, y], end_xy: prefix.at(-1)!.to, actions, observation_ref: current.ref,
    level_epoch: current.epoch, contact_in_prefix: false, full_access_length: prefix.length };
  const pending = deferred ? { ...Object.fromEntries(['size', 'role_refs', 'footprint_sha', 'pair', 'level_epoch', 'score'].map(name => [name, plan[name]])),
    ...deferred, facts_pair: facts.pair_ref, evidence } : null;
  return { ...plan, deferred_probe: pending, route_key: route, steps: prefix, goal_xy: prefix.at(-1)!.to, contact_in_prefix: false,
    access_phase: 'approach', last_effect_unknown: false, full_access_length: prefix.length,
    trial: await compositionIdentity([current.ref, route, actions]), source_role_refs: roles, evidence };
}
