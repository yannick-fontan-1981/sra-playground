/**
 * Current framed-pair measurements and access from the pinned V5/V6 source.
 * The producer owns no retained knowledge and grants no physical authority.
 * It consumes the caller's real public history and shared meter forecast.
 *
 * Supported route domain: a complete or witnessed border-occluded current
 * pair, observed or caller-revalidated rigid control,
 * ordinary traversable surfaces and first modifier/peer/feature/capacity
 * questions, with current revalidation of observed station/feature sites,
 * witnessed station cycles and border-only partial correspondence. Retained
 * station methods are revalidated before finite managed-capacity projection.
 */
import { compareUnicode } from './canonical.ts';
import { compositionIdentity, registered, Snapshot } from './v6-composition-memory.ts';
import type { CompositionTransition } from './v6-composition-memory.ts';
import { framedPatterns } from './v6-geometric-scene.ts';
import type { FramedPattern } from './v6-geometric-scene.ts';
import { gauge_related_marks } from './v6-inventory-continuation.ts';
import { componentSignatures, motionFootprint, rigidRole } from './v6-motion-contrast.ts';
import type { RigidMotionTrack } from './v6-motion-contrast.ts';
import { projectManagedLayout, searchManagedAccess } from './v6-morphology-managed.ts';
import type { MorphologyCollectionEvidence } from './v6-morphology-managed.ts';
import { geometricComponents, rotateMask } from './v6-native-observer.ts';
import type { GeometricComponent } from './v6-native-observer.ts';
import { pythonEqual as same, pythonTruthy as truth } from './v6-operations.ts';
import type { NativeBox, NativePoint, NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
export interface MorphologyPair extends R {
  sites: number[][]; scales: number[]; orientations: string[]; palette_values: number[];
  permitted_turns: number[]; quarter_turns: number | null; shape_class: string; signature: string;
}
export interface MorphologyMeasurementInput {
  history: readonly CompositionTransition[];
  current: Snapshot;
  limit: number;
  /** Source (epoch, pair_key) tuple encoded with JSON.stringify. */
  contacts: ReadonlyMap<string, R>;
  tried: ReadonlySet<string>;
  available: readonly string[];
  actionBudget?: number | null;
  meterForecast?: R | null;
  stationMethod?: R | null;
  collectionEvidence?: MorphologyCollectionEvidence | null;
  observation?: R | null;
  featureTrials?: R | null;
  /** Current control reconstructed by the source entry-rebind consumer. */
  provisionalControl?: RigidMotionTrack | null;
}
export interface MorphologyMeasurements { facts: R; plans: R; receipt: R }
type Step = { from: number[]; to: number[]; action_ref: string | null; surface_sha: string; nonlocal_witness?: R;
  departure_ref?: string; prior_entry?: string };
type Target = { dest: NativePoint; path: Step[] };
const key = (value: unknown): string => JSON.stringify(value);
const point = (value: readonly number[]): NativePoint => [value[0]!, value[1]!];
const comparePoint = (a: readonly number[], b: readonly number[]): number => a[0]! - b[0]! || a[1]! - b[1]!;
function lex(a: any, b: any): number {
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) { const c = lex(a[i], b[i]); if (c) return c; }
    return a.length - b.length;
  }
  return typeof a === 'string' && typeof b === 'string' ? compareUnicode(a, b) : a < b ? -1 : a > b ? 1 : 0;
}
const intersects = (a: readonly number[], b: readonly number[]): boolean => a[0]! <= b[2]! && b[0]! <= a[2]! && a[1]! <= b[3]! && b[1]! <= a[3]!;
const enclosed = (inner: readonly number[], outer: readonly number[]): boolean => outer[0]! <= inner[0]! && inner[0]! <= inner[2]! && inner[2]! <= outer[2]!
  && outer[1]! <= inner[1]! && inner[1]! <= inner[3]! && inner[3]! <= outer[3]!;
const bounds = (at: NativePoint, size: NativePoint): NativeBox => [at[0], at[1], at[0] + size[0] - 1, at[1] + size[1] - 1];

export class MorphologyMeasurementDomainError extends RangeError {}

/** Consumed V5 measure_contours/measure_centered_enclosure_identities result.
 * Components have the same four-connected raster order in V5 and V6; the V5
 * component IDs are not consumed. Open contours still count toward MAX_BOXES,
 * so an overfull inventory never leaks a partial set of closed enclosures. */
export function centeredMorphologyEnclosures(rows: NativeRows, parts = geometricComponents(rows)): R[] {
  if (rows.length * rows[0]!.length > 4096) throw new MorphologyMeasurementDomainError('contour raster bound exceeded');
  if (parts.length > 512) throw new MorphologyMeasurementDomainError('contour component bound exceeded');
  const contours: { box: NativeBox; value: number; closed: boolean }[] = [];
  for (const part of parts) {
    const [l, t, r, b] = part.bbox, w = r - l + 1, h = b - t + 1;
    if (Math.min(h, w) < 3) continue;
    const pixels = new Set(part.mask.map(key)), perimeter: NativePoint[] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (y === 0 || y === h - 1 || x === 0 || x === w - 1) perimeter.push([x, y]);
    const missing = perimeter.filter(p => !pixels.has(key(p)));
    if (pixels.size < h * w && !missing.length) { contours.push({ box: part.bbox, value: part.color, closed: true }); continue; }
    const rim = new Set(perimeter.map(key));
    if ([...pixels].some(p => !rim.has(p))) continue;
    if (!missing.length) { contours.push({ box: part.bbox, value: part.color, closed: true }); continue; }
    const sides: [NativePoint, NativePoint[]][] = [
      [[-1, 0], missing.filter(([x, y]) => x === 0 && 0 < y && y < h - 1)],
      [[1, 0], missing.filter(([x, y]) => x === w - 1 && 0 < y && y < h - 1)],
      [[0, -1], missing.filter(([x, y]) => y === 0 && 0 < x && x < w - 1)],
      [[0, 1], missing.filter(([x, y]) => y === h - 1 && 0 < x && x < w - 1)],
    ];
    for (const [[dx, dy], side] of sides) {
      if (side.length !== missing.length) continue;
      const gap = side.map(([x, y]) => dx ? y : x).sort((a, b) => a - b);
      if (!gap.every((v, i) => v === gap[0]! + i)) continue;
      const positions = side.map(([x, y]): NativePoint => [l + x, t + y]);
      const outside = positions.map(([x, y]): NativePoint => [x + dx, y + dy]);
      if (!outside.every(([x, y]) => 0 <= x && x < rows[0]!.length && 0 <= y && y < rows.length)) continue;
      if (new Set([...positions, ...outside].map(([x, y]) => rows[y]![x])).size === 1) contours.push({ box: part.bbox, value: part.color, closed: false });
    }
  }
  if (contours.length > 32) return [];
  return contours.filter(c => c.closed && parts.some(p => {
    const [l, t, r, b] = c.box, [pl, pt, pr, pb] = p.bbox, gaps = [pt - t, pl - l, b - pb, r - pr];
    return Math.min(pb - pt + 1, pr - pl + 1) >= 2 && Math.min(...gaps) > 0 && new Set(gaps).size === 1;
  })).map(c => ({ box: [...c.box], value: c.value }));
}

/** Exact orthogonal_features.matched_pairs: pigment never supplies a role. */
export async function matchedMorphologyPairs(patterns: readonly FramedPattern[]): Promise<MorphologyPair[]> {
  const out: MorphologyPair[] = [];
  for (let i = 0; i < patterns.length; i++) for (let j = i + 1; j < patterns.length; j++) {
    const a = patterns[i]!, b = patterns[j]!; if (same(a.bbox, b.bbox)) continue;
    const rotations = [0, 1, 2, 3].map(k => rotateMask(a.mask, k)), transforms = rotations.flatMap((mask, k) => same(mask, b.mask) ? [k] : []);
    if (!transforms.length) continue;
    const invariant = [...rotations].sort(lex)[0]!, [first, second, shape] = await Promise.all([
      compositionIdentity([...a.mask].sort(comparePoint)), compositionIdentity([...b.mask].sort(comparePoint)), compositionIdentity(invariant),
    ]);
    out.push({ sites: [[...a.bbox], [...b.bbox]], scales: [a.scale, b.scale], orientations: [first, second],
      palette_values: [a.color, b.color], permitted_turns: transforms, quarter_turns: transforms.length === 1 ? transforms[0]! : null,
      shape_class: shape, signature: first });
  }
  return out;
}
export async function morphologyPairs(rows: NativeRows): Promise<[MorphologyPair[], GeometricComponent[]]> {
  const parts = geometricComponents(rows), boxes = new Set(centeredMorphologyEnclosures(rows, parts).map(c => key(c.box)));
  return [await matchedMorphologyPairs(framedPatterns(rows, parts).filter(p => boxes.has(key(p.bbox)))), parts];
}
export const morphologyPairKey = (pair: MorphologyPair): Promise<string> => compositionIdentity([...pair.sites].sort(lex));
/** rearm_evidence.orientation/prediction are measurements, not rearm plans. */
export async function morphologyOrientation(rows: NativeRows, pairKey: string, peer: readonly number[]): Promise<R | null> {
  const [pairs] = await morphologyPairs(rows), matching: MorphologyPair[] = [];
  for (const pair of pairs) if (await morphologyPairKey(pair) === pairKey) matching.push(pair);
  if (matching.length !== 1) return null;
  const pair = matching[0]!, index = pair.sites.findIndex(b => same(b, peer));
  if (index < 0 || pair.quarter_turns === null) return null;
  return { residual: index === 0 ? pair.quarter_turns : (4 - pair.quarter_turns) % 4,
    peer_pose: pair.orientations[index], mobile_pose: pair.orientations[1 - index],
    peer_color: pair.palette_values[index], mobile_color: pair.palette_values[1 - index] };
}
export function morphologyStationPrediction(station: R, currentPose: R | null): R | null {
  const entries = station.entries as R[], deltas = new Set(entries.map(r => r.delta));
  if (new Set(entries.map(r => r.after)).size < 2 || deltas.size !== 1 || deltas.has(0) || entries.some(r => !truth(r.peer_preserved)) || !truth(currentPose)) return null;
  const delta = [...deltas][0];
  return { relation: 'selective_entry_rotation_mod4', delta, before_residual: currentPose!.residual,
    expected_residual: (currentPose!.residual + delta) % 4, expected_peer_pose: currentPose!.peer_pose,
    entry_refs: entries.map(r => r.after), falsifiers: ['different_residual', 'peer_changes', 'site_identity_changes'] };
}
export function morphologyResiduals(pair: MorphologyPair, method: R | null = null): R {
  const values = pair.palette_values, choices = !truth(method) ? [] : pair.scales.flatMap((s, i) => s === method!.peer_scale ? [i] : []);
  const recalled = choices.length === 1 && same([...pair.scales].sort((a, b) => a - b), [...(method!.observed_scales ?? [])].sort((a: number, b: number) => a - b)) && truth(method!.after);
  const q = pair.quarter_turns;
  return { shape: 'homologous_under_rotation', shape_class: pair.shape_class,
    orientation: q === null ? 'ambiguous' : q === 0 ? 'aligned' : 'different', orientation_alternatives: [...pair.permitted_turns],
    color: values[0] === values[1] ? 'equal' : 'different', observed_colors: [...values], sites: pair.sites.map(box => [...box]),
    palette_values: [...values], possible_peer: recalled ? pair.sites[choices[0]!] : null, prior_method_ref: recalled ? method!.after : null,
    prior_surface: recalled ? method!.site_surface ?? null : null,
    scope: 'appearance and currently rebound reference-scale hypothesis; scoring role remains conditional' };
}
export function morphologyCompareFeatures(first: MorphologyPair | null, second: MorphologyPair | null): R {
  if (!first || !second) return { status: 'unmeasured', reason: 'unique_frame_pair_unavailable' };
  const scene = (p: MorphologyPair): Map<string, R> => new Map(p.sites.map((box, i) => [key(box), { shape: p.shape_class, orientation: p.orientations[i], color: p.palette_values[i] }]));
  const before = scene(first), after = scene(second);
  if (before.size !== 2 || after.size !== before.size || [...before.keys()].some(k => !after.has(k))) return { status: 'unmeasured', reason: 'frame_sites_changed' };
  const sites = [...before.keys()].sort((a, b) => lex(JSON.parse(a), JSON.parse(b))).map(k => ({ bbox: JSON.parse(k), before: before.get(k)!, after: after.get(k)!,
    changed: ['shape', 'orientation', 'color'].filter(name => before.get(k)![name] !== after.get(k)![name]) }));
  const changed = sites.filter(r => r.changed.length);
  return { status: 'measured', sites, color_only_at_one_site: changed.length === 1 && same(changed[0]!.changed, ['color']),
    orientation_preserved: sites.every(r => !r.changed.includes('orientation')), shape_preserved: sites.every(r => !r.changed.includes('shape')),
    peer_unchanged: changed.length === 1, score_meaning: 'unconfirmed' };
}
export async function observedMorphologySelectiveChange(first: NativeRows, second: NativeRows, expected: MorphologyPair): Promise<number[] | null> {
  const expectedKey = await morphologyPairKey(expected);
  const sites = async (rows: NativeRows): Promise<Map<string, string>> => {
    const [seen] = await morphologyPairs(rows), matching: MorphologyPair[] = [];
    for (const pair of seen) if (await morphologyPairKey(pair) === expectedKey) matching.push(pair);
    return matching.length === 1 ? new Map(matching[0]!.sites.map((b, i) => [key(b), matching[0]!.orientations[i]!])) : new Map();
  };
  const [before, after] = await Promise.all([sites(first), sites(second)]);
  if (before.size !== 2 || before.size !== after.size || [...before.keys()].some(k => !after.has(k))) return null;
  const unchanged = [...before.keys()].filter(k => before.get(k) === after.get(k));
  return unchanged.length === 1 ? JSON.parse(unchanged[0]!) : null;
}

/** Exact feature_occurrences.known_feature_sites, used to exclude current
 * effectful sites from ordinary transit. Unrelated historical epochs and
 * failed arrivals do not permanently disable a new current measurement. */
export async function knownMorphologyFeatureSites(current: Snapshot, pair: MorphologyPair,
  history: readonly CompositionTransition[], trials: R | null, origin: NativePoint, size: NativePoint): Promise<Map<string, R>> {
  const sites = pair.sites, epoch = current.epoch, sitesKey = await morphologyPairKey(pair), pairRef = await compositionIdentity([epoch, sitesKey]);
  const historyByEdge = new Map(history.filter(([a, , b]) => a.epoch === epoch && b.epoch === epoch).map(([a, , b]) => [key([a.ref, b.ref]), [a, b] as const]));
  const result = new Map<string, R>();
  for (const trial of Object.values(trials ?? {}) as R[]) {
    if (!truth(trial.arrived) || !truth(trial.before_ref) || !truth(trial.after_ref)) continue;
    if ((Object.hasOwn(trial, 'epoch') ? trial.epoch : epoch) !== epoch || (Object.hasOwn(trial, 'pair_ref') ? trial.pair_ref : pairRef) !== pairRef) continue;
    const frames = historyByEdge.get(key([trial.before_ref, trial.after_ref]));
    if (!frames && (trial.epoch !== epoch || trial.pair_ref !== pairRef)) continue;
    const delta = trial.outcome ?? {}, rows = delta.sites ?? [];
    if (rows.length !== 2 || await compositionIdentity(rows.map((r: R) => r.bbox).sort(lex)) !== sitesKey) continue;
    const at = point(trial.site); let saved = trial.site_surface ?? null;
    if (frames) {
      const before = await compositionIdentity(motionFootprint(frames[0].rows, at, size));
      if (truth(saved) && saved !== before) continue;
      saved = before;
    }
    if (!truth(saved) || !same(at, origin) && await compositionIdentity(motionFootprint(current.rows, at, size)) !== saved) continue;
    let record = result.get(key(at));
    if (!record) {
      record = { id: 'feature:' + await compositionIdentity([epoch, at, saved]), sites: [[...at]], site_surface: saved, evidence: [], effects: [], uncertain_sources: [] };
      result.set(key(at), record);
    }
    const changed = rows.filter((r: R) => truth(r.changed));
    if (changed.length !== 1 || !truth(delta.color_only_at_one_site) || !truth(delta.orientation_preserved) || !truth(delta.shape_preserved)) {
      record.uncertain_sources.push(...rows.map((r: R) => r.before.color)); continue;
    }
    const row = changed[0]!; if (!same(row.changed, ['color'])) continue;
    record.evidence.push(trial.after_ref);
    record.effects.push({ from_color: row.before.color, to_color: row.after.color, mobile_site: row.bbox, before: trial.before_ref, after: trial.after_ref });
  }
  return result;
}

/** Detect the exact source retention premise.
 * The last complete comparison is authoritative; contrary recent evidence
 * never causes a search for a more convenient older pair. */
async function retainedPartialPair(input: MorphologyMeasurementInput, parts: GeometricComponent[]): Promise<R | null> {
  const { history, current, contacts } = input, control = rigidRole(history, current, parts, await componentSignatures(parts));
  if (!control) return null;
  const { position, size } = control, origin = position(current); if (!origin) return null;
  const body = bounds(origin, size);
  for (const [before] of [...history].reverse()) {
    if (before.epoch !== current.epoch || before.score !== current.score) continue;
    const [candidates] = await morphologyPairs(before.rows); if (candidates.length !== 1) continue;
    const pair = candidates[0]!, pairKey = await morphologyPairKey(pair), contact = contacts.get(key([current.epoch, pairKey]));
    const prior = position(before);
    if (!contact || !registered(before, current) || !prior) return null;
    const peer = contact.peer;
    if (!pair.sites.some(b => same(b, peer)) || !same(motionFootprint(current.rows, origin, size), motionFootprint(before.rows, prior, size))) return null;
    if (!same(pair.sites.filter(site => intersects(body, site)), [peer])) return null;
    const visible: number[][] = [], hidden: number[][] = [], changes: number[][] = [];
    for (const [l, t, r, b] of pair.sites) for (let y = t!; y <= b!; y++) for (let x = l!; x <= r!; x++) {
      const masked = body[0] <= x && x <= body[2] && body[1] <= y && y <= body[3];
      if (masked) {
        if ((x === l || x === r) && (y === t || y === b) || l! < x && x < r! && t! < y && y < b!) return null;
        hidden.push([x, y]); if (before.rows[y]![x] !== current.rows[y]![x]) changes.push([x, y]);
      } else { if (before.rows[y]![x] !== current.rows[y]![x]) return null; visible.push([x, y, current.rows[y]![x]!]); }
    }
    if (!hidden.length || !changes.length) return null;
    return { pair, control, support: { status: 'border_occluded_interior_observed', before: before.ref, after: current.ref,
      epoch: current.epoch, pair_ref: await compositionIdentity([current.epoch, pairKey]), peer: [...peer], body: [...body],
      visible_pixels: visible, hidden_pixels: hidden, changed_pixels: changes,
      falsifiers: ['visible_anchor_or_interior_changes', 'body_identity_or_pose_changes', 'epoch_changes', 'another_overlap_explanation'],
      inference: 'the same framed carrier persists behind the currently observed participant; its concealed border is unknown' } };
  }
  return null;
}

/** Exact partial_correspondence.interior_probe: an observed border may be
 * covered, but every corner and interior pixel remains measured. */
async function partialInteriorProbe(input: MorphologyMeasurementInput, pair: MorphologyPair,
  control: RigidMotionTrack, support: R, facts: R): Promise<R> {
  const remaining = input.actionBudget ?? null, forecast = input.meterForecast ?? null, current = input.current;
  if (remaining !== null && remaining < 1 || forecast !== null && forecast.steps_before_empty < 1) return {};
  const { roles, moves, position, size } = control, origin = position(current)!;
  const choices: [string, NativePoint, number[]][] = [];
  for (const [action, [dx, dy]] of Object.entries(moves)) {
    if (!input.available.includes(action)) continue;
    const dest: NativePoint = [origin[0] + dx, origin[1] + dy], patch = motionFootprint(current.rows, dest, size);
    if (patch !== null && enclosed(bounds(dest, size), support.peer)) choices.push([action, dest, patch]);
  }
  if (choices.length !== 1) return {};
  const [action, dest, surface] = choices[0]!, actions = [{ action_ref: action }], route = 'peer';
  const step: Step = { from: [...origin], to: [...dest], action_ref: action, surface_sha: await compositionIdentity(surface) };
  Object.assign(facts, { peer_xy: [...dest], partial_correspondence: true, correspondence_visibility: support,
    final_capacity_step: !!forecast && forecast.steps_before_empty === 1 });
  facts.routes[route] = { start_xy: [...origin], end_xy: [...dest], actions, observation_ref: current.ref, level_epoch: current.epoch,
    contact_in_prefix: true, full_access_length: 1, goal_xy: [...dest] };
  return { [route]: { route_key: route, steps: [step], size: [...size], footprint_sha: await compositionIdentity(motionFootprint(current.rows, origin, size)),
    role_refs: [...roles], pair, trial: await compositionIdentity([current.ref, 'partially_occluded_contact', dest]), score: current.score,
    level_epoch: current.epoch, observation_ref: current.ref, access_phase: 'contact', contact_in_prefix: true, full_access_length: 1,
    goal_xy: [...dest], last_effect_unknown: true, partial_correspondence: support, evidence: [support.before, support.after],
    predicted_position_if_local: [...dest], expected_terminal: false,
    risks: ['contact_may_be_blocked_or_nonterminal', facts.final_capacity_step ? 'depletion_order_unverified' : 'unknown_contact_effect'] } };
}

/** Exact first-missing-reverse-axis measurement, including competing commands. */
export async function morphologyMissingAxisWitness(current: Snapshot, history: readonly CompositionTransition[],
  control: RigidMotionTrack, peer: readonly number[], surfaces: ReadonlySet<string>, available: readonly string[], limit: number): Promise<[Step[], R] | null> {
  const { position, moves: motions, size } = control, origin = position(current); if (!origin) return null;
  const vectors = new Set(Object.values(motions).map(key)), missing = new Map<string, NativePoint>();
  for (const [dx, dy] of Object.values(motions)) { const v: NativePoint = [-dx || 0, -dy || 0]; if (!vectors.has(key(v))) missing.set(key(v), v); }
  const rivals: { length: number; index: number; vector: NativePoint; route: Step[] }[] = [];
  for (const vector of [...missing.values()].sort(comparePoint)) {
    const moves: [string | null, NativePoint][] = [...Object.entries(motions).sort(([a], [b]) => compareUnicode(a, b)), [null, vector]];
    const queue: [NativePoint, Step[]][] = [[origin, []]], visited = new Set([key(origin)]), found: Step[][] = [];
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const [at, path] = queue[cursor]!; if (found.length && path.length >= found[0]!.length) break;
      for (const [action, [dx, dy]] of moves) {
        const dest: NativePoint = [at[0] + dx, at[1] + dy]; if (visited.has(key(dest))) continue;
        const patch = motionFootprint(current.rows, dest, size); if (patch === null) continue;
        const step: Step = { from: [...at], to: [...dest], action_ref: action, surface_sha: await compositionIdentity(patch) }, trail = [...path, step];
        if (intersects(bounds(dest, size), peer)) found.push(trail);
        else if (surfaces.has(key(patch))) { visited.add(key(dest)); queue.push([dest, trail]); }
      }
    }
    for (const route of found) { const index = route.findIndex(s => s.action_ref === null); if (index >= 0 && index < limit) rivals.push({ length: route.length, index, vector, route }); }
  }
  if (!rivals.length) return null;
  const shortest = Math.min(...rivals.map(r => r.length)), minimum = rivals.filter(r => r.length === shortest);
  if (new Set(minimum.map(r => key(r.vector))).size !== 1) return null;
  const selected = [...minimum].sort((a, b) => a.index - b.index)[0]!, { index, vector, route } = selected;
  const probe = route[index]!, exposure = point(probe.from), candidates: [number, string][] = [];
  for (const name of [...new Set(available)].filter(a => !Object.hasOwn(motions, a)).sort(compareUnicode)) {
    const positives = new Set<string>(); let contradicted = false;
    for (const [before, action, after] of history) {
      if (action !== name) continue;
      const p = position(before), q = position(after); if (!p || !q) { contradicted = true; break; }
      const delta = [q[0] - p[0], q[1] - p[1]];
      if (same(delta, vector)) positives.add(key(p));
      else if (!same(delta, [0, 0]) || same(p, exposure) && same(motionFootprint(before.rows, point(probe.to), size), motionFootprint(current.rows, point(probe.to), size))) { contradicted = true; break; }
    }
    if (!contradicted && !positives.has(key(exposure))) candidates.push([positives.size, name]);
  }
  if (!candidates.length) return null;
  const support = Math.max(...candidates.map(row => row[0])), equivalent = candidates.filter(row => row[0] === support).map(row => row[1]).sort(compareUnicode);
  probe.action_ref = equivalent[0]!;
  return [route.slice(0, index + 1), { predicted_delta: [...vector], other_outcomes: ['no_translation', 'other_displacement', 'nonlocal_change'],
    equivalent_unidentified_inputs: equivalent, prior_distinct_success_positions: support, conditional_distance: shortest, remaining_budget: limit,
    probe_index: index, expected_if_positive: [...probe.to], source_position: [...probe.from], peer_bbox: [...peer] }];
}

/** geometry.measure_routes with current revalidation of retained methods.
 * Projection and search remain measurements with no physical authority. */
export async function measureMorphologyRoutes(input: MorphologyMeasurementInput): Promise<MorphologyMeasurements> {
  const { history, current, limit, contacts, tried, available } = input;
  const actionBudget = input.actionBudget ?? null, meter = input.meterForecast ?? null;
  if (!Number.isSafeInteger(limit) || limit < 0 || limit > 16 || actionBudget !== null && (!Number.isSafeInteger(actionBudget) || actionBudget < 0)) throw new TypeError('Bounded nonnegative morphology action allowance required');
  const facts: R = { observation_ref: current.ref, level_epoch: current.epoch, framed_pair: false, homologous: false, asymmetric: false,
    orientation_relation: 'ambiguous', control_attested: false, single_pattern_contact_change: false, alignment_refuted: false,
    peer_discrimination_bound: false, routes: {} };
  const receipt: R = { source: 'geometry.measure_routes', source_commit: '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e',
    status: 'measured', domain: 'current_pair_routes_and_revalidated_managed_capacity', observation_ref: current.ref, level_epoch: current.epoch,
    history_transition_count: history.length, release_authority: false, deferred_source_branches: [] };
  const defer = (reason: string, evidence: R = {}): MorphologyMeasurements => ({ facts: { ...facts, routes: {} }, plans: {},
    receipt: { ...receipt, status: 'deferred_source_branch', reason, deferred_source_branches: [reason], ...evidence } });
  if (meter && (meter.observation_ref !== current.ref || meter.level_epoch !== current.epoch)) return defer('meter_forecast_scope_changed');
  if (input.observation && (input.observation.observation_ref !== current.ref || input.observation.level_epoch !== current.epoch)) return defer('observation_scope_changed');
  const [candidates, parts] = await morphologyPairs(current.rows); receipt.pair_candidate_count = candidates.length;
  let pair = candidates.length === 1 ? candidates[0]! : null, partial: R | null = null;
  if (!pair && !candidates.length && contacts.size) {
    const retained = await retainedPartialPair(input, parts);
    if (retained) { pair = retained.pair; partial = retained; }
  }
  if (!pair) {
    return { facts, plans: {}, receipt: { ...receipt, reason: candidates.length ? 'current_pair_ambiguous' : 'no_current_pair' } };
  }
  const pairKey = await morphologyPairKey(pair), facets = morphologyResiduals(pair, input.stationMethod ?? null);
  Object.assign(facts, { framed_pair: true, homologous: true, asymmetric: pair.quarter_turns !== null,
    pair_ref: await compositionIdentity([current.epoch, pairKey]), feature_residuals: facets, color_relation: facets.color, orientation_relation: facets.orientation,
    preserve_features: ['normalized_shape', 'current_oriented_masks', 'unchanged_peer_palette', 'current_control_and_epoch', 'reserve_and_available_return'] });
  const contact = contacts.get(key([current.epoch, pairKey])), peer = contact ? contact.peer ?? null : null;
  if (contact) facts.single_pattern_change_observation_ref = contact.observed;
  facts.single_pattern_contact_change = peer !== null;
  const control: RigidMotionTrack | null = partial ? partial.control : input.provisionalControl ?? rigidRole(history, current, parts, await componentSignatures(parts));
  if (!control) return { facts, plans: {}, receipt: { ...receipt, reason: 'current_control_unattested' } };
  const { roles, moves: motions, position, size } = control, origin = position(current);
  if (!origin) return { facts, plans: {}, receipt: { ...receipt, reason: 'current_control_position_missing' } };
  Object.assign(facts, { control_attested: true, controlled_xy: [...origin], controlled_role_refs: [...roles], motion_examples: structuredClone(motions) });
  if (partial) {
    Object.assign(facts, { partial_correspondence: true, correspondence_visibility: partial.support });
    const plans = await partialInteriorProbe(input, pair, control, partial.support, facts);
    return { facts, plans, receipt: { ...receipt, route_keys: Object.keys(plans), partial_correspondence: true, retained_support: partial.support } };
  }
  const featureSites = await knownMorphologyFeatureSites(current, pair, history, input.featureTrials ?? null, origin, size);
  const positives = new Map<string, Set<string>>(), negatives = new Set<string>(), anchors: Snapshot[] = [], unresolved = new Map<string, R>();
  for (const [before, action, after] of history) {
    const start = position(before), end = position(after); if (!start || !end || !Object.hasOwn(motions, action)) continue;
    const [dx, dy] = motions[action]!, dest: NativePoint = [start[0] + dx, start[1] + dy], patch = motionFootprint(before.rows, dest, size);
    if (patch !== null) {
      const p = key(patch), edge = key([start, action, dest, patch]);
      if (same(dest, end)) { const seen = positives.get(p) ?? new Set<string>(); seen.add(key(start)); positives.set(p, seen); unresolved.delete(edge); }
      else if (same(start, end)) negatives.add(p);
      else unresolved.set(edge, { before: before.ref, after: after.ref, landing: [...end] });
    }
    if (!same(start, origin) && registered(before, current)) anchors.push(before);
  }
  const surfaces = new Set([...positives].filter(([p, starts]) => starts.size >= 2 && !negatives.has(p)).map(([p]) => p));
  const marks = gauge_related_marks(parts, meter, size, pair.sites);
  const stations = new Map<string, R>(Object.values(contact?.stations ?? {}).map((s: any) => [key(s.site), s]));
  facts.observed_color_sites = [...featureSites].map(([at, site]) => ({ site: JSON.parse(at), signature: site.site_surface, evidence: site.evidence }));
  const queue: [NativePoint, Step[]][] = [[origin, []]], visited = new Set([key(origin)]);
  const targets = new Map<string, Map<string, Target>>(['peer', 'modifier', 'capacity_probe', 'feature_probe'].map(name => [name, new Map()]));
  const add = (name: string, dest: NativePoint, path: Step[]): void => { const pool = targets.get(name)!; if (!pool.has(key(dest))) pool.set(key(dest), { dest, path }); };
  const patchHashes = new Map<string, Promise<string>>();
  const patchHash = (patch: readonly number[]): Promise<string> => { const k = key(patch); let value = patchHashes.get(k); if (!value) { value = compositionIdentity(patch); patchHashes.set(k, value); } return value; };
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const [at, path] = queue[cursor]!; if (actionBudget !== null && path.length >= actionBudget) continue;
    for (const [action, [dx, dy]] of Object.entries(motions).sort(([a], [b]) => compareUnicode(a, b))) {
      const dest: NativePoint = [at[0] + dx, at[1] + dy]; if (visited.has(key(dest))) continue;
      const surface = motionFootprint(current.rows, dest, size); if (surface === null) continue;
      const box = bounds(dest, size), step: Step = { from: [...at], to: [...dest], action_ref: action, surface_sha: await patchHash(surface) };
      const adverse = unresolved.get(key([at, action, dest, surface])); if (adverse) step.nonlocal_witness = adverse;
      const trail = [...path, step];
      if (featureSites.has(key(dest))) continue;
      if (marks.some(mark => enclosed(mark, box))) { add('capacity_probe', dest, trail); continue; }
      const station = stations.get(key(dest));
      if (station && same(station.size, size) && step.surface_sha === station.site_surface) { add('modifier', dest, trail); continue; }
      if (peer !== null && intersects(box, peer)) { add('peer', dest, trail); continue; }
      if (surfaces.has(key(surface))) { visited.add(key(dest)); queue.push([dest, trail]); continue; }
      if (pair.sites.some(site => intersects(box, site))) continue;
      const islands = parts.filter(p => enclosed(p.bbox, box)), pigments = new Set(islands.map(p => p.color));
      if (pigments.size >= 2 && anchors.some(a => same(motionFootprint(a.rows, dest, size), surface))) {
        add('modifier', dest, trail);
        if (facets.color === 'different' && pair.palette_values.every(v => pigments.has(v)) && await patchHash(surface) !== facets.prior_surface && !station) add('feature_probe', dest, trail);
      }
    }
  }
  const atStation = stations.get(key(origin));
  if (atStation && atStation.footprint === await compositionIdentity(motionFootprint(current.rows, origin, size))) {
    const cycles: Step[][] = [];
    for (const departure of atStation.departures as R[]) {
      if (!truth(departure.preserved)) continue;
      const neighbor = point(departure.to), out = departure.command, outMove = motions[out];
      if (!outMove || !same([origin[0] + outMove[0], origin[1] + outMove[1]], neighbor)) continue;
      const patch = motionFootprint(current.rows, neighbor, size); if (!surfaces.has(key(patch))) continue;
      for (const arrival of atStation.entries as R[]) {
        const back = arrival.command, backMove = motions[back];
        if (!same(arrival.from, neighbor) || !truth(arrival.delta) || !backMove || !same([neighbor[0] + backMove[0], neighbor[1] + backMove[1]], origin)) continue;
        cycles.push([{ from: [...origin], to: [...neighbor], action_ref: out, surface_sha: await compositionIdentity(patch), departure_ref: departure.after },
          { from: [...neighbor], to: [...origin], action_ref: back, surface_sha: atStation.site_surface, prior_entry: arrival.after }]);
      }
    }
    if (cycles.length && (actionBudget === null || actionBudget >= 2)) {
      cycles.sort((a, b) => lex(a.map(s => [s.action_ref, s.to]), b.map(s => [s.action_ref, s.to])));
      targets.get('modifier')!.set(key(origin), { dest: origin, path: cycles[0]! });
    }
  }
  const plans: R = {}, footprint = await compositionIdentity(motionFootprint(current.rows, origin, size));
  for (const [name, pool] of targets) {
    const ranked: { dest: NativePoint; path: Step[]; trial: string }[] = [];
    for (const { dest, path } of pool.values()) {
      const trial = await compositionIdentity([current.epoch, pairKey, name, dest, pair.orientations, pair.palette_values]);
      if (!tried.has(trial)) ranked.push({ dest, path, trial });
    }
    if (!ranked.length) continue;
    const length = Math.min(...ranked.map(r => r.path.length)), choices = ranked.filter(r => r.path.length === length);
    if (choices.length !== 1) continue;
    const { dest, path: full, trial } = choices[0]!, unknown = full.findIndex(s => Object.hasOwn(s, 'nonlocal_witness'));
    const steps = full.slice(0, Math.min(limit, unknown < 0 ? full.length : unknown + 1)); if (!steps.length) continue;
    const contactInPrefix = steps.length === full.length && !Object.hasOwn(steps.at(-1)!, 'nonlocal_witness');
    const actions = steps.map(s => ({ action_ref: s.action_ref }));
    facts[name + '_xy'] = [...steps.at(-1)!.to];
    facts.routes[name] = { start_xy: [...origin], end_xy: [...steps.at(-1)!.to], actions, goal_xy: [...dest], full_access_length: full.length,
      contact_in_prefix: contactInPrefix, observation_ref: current.ref, level_epoch: current.epoch };
    plans[name] = { route_key: name, steps, size: [...size], footprint_sha: footprint, role_refs: [...roles], pair, trial, score: current.score,
      level_epoch: current.epoch, observation_ref: current.ref, access_phase: contactInPrefix ? 'contact' : 'approach', contact_in_prefix: contactInPrefix,
      full_access_length: full.length, goal_xy: [...dest], last_effect_unknown: contactInPrefix || Object.hasOwn(steps.at(-1)!, 'nonlocal_witness') };
    if (name === 'capacity_probe') facts.capacity_candidate_bound = true;
    if (name === 'modifier' && stations.has(key(dest))) {
      const station = stations.get(key(dest))!, predicted = morphologyStationPrediction(station, peer === null ? null : await morphologyOrientation(current.rows, pairKey, peer));
      plans[name].known_effectful_site = { site: [...dest], site_surface: station.site_surface,
        independent_entry_refs: station.entries.map((r: R) => r.after),
        preserved_exit_refs: station.departures.filter((r: R) => truth(r.preserved)).map((r: R) => r.after), hypothesis: predicted };
      facts.routes[name].predicted_on_complete_entry = predicted;
    }
  }
  const probeTargets: [string, readonly number[][]][] = [];
  if (peer !== null && !plans.peer) probeTargets.push(['peer_access_probe', [peer]]);
  if (marks.length && !plans.capacity_probe) probeTargets.push(['capacity_access_probe', marks]);
  for (const [name, sites] of probeTargets) {
    const witnesses: [Step[], R][] = [];
    for (const site of sites) {
      const item = await morphologyMissingAxisWitness(current, history, control, site, surfaces, available, limit);
      if (item && (name === 'peer_access_probe' || item[1].conditional_distance <= meter!.steps_before_empty)) witnesses.push(item);
    }
    if (!witnesses.length) continue;
    witnesses.sort((a, b) => lex([a[1].conditional_distance, a[0].length, a[1].peer_bbox], [b[1].conditional_distance, b[0].length, b[1].peer_bbox]));
    const [steps, contrast] = witnesses[0]!, last = steps.at(-1)!, dest = last.to;
    const trial = await compositionIdentity([current.epoch, pairKey, name, last.from, last.action_ref, dest]); if (tried.has(trial)) continue;
    facts[name + '_xy'] = [...dest];
    if (name === 'peer_access_probe') Object.assign(facts, { peer_discrimination_bound: true, access_contrast: contrast });
    else Object.assign(facts, { capacity_candidate_bound: true, capacity_contrast: contrast });
    facts.routes[name] = { start_xy: [...origin], end_xy: [...dest], actions: steps.map(s => ({ action_ref: s.action_ref })), observation_ref: current.ref, level_epoch: current.epoch };
    plans[name] = { route_key: name, steps, size: [...size], footprint_sha: footprint, role_refs: [...roles], pair, trial, score: current.score,
      level_epoch: current.epoch, observation_ref: current.ref };
  }
  if (meter && (plans.capacity_probe || plans.capacity_access_probe)) {
    const principal = plans[facts.orientation_relation === 'aligned' ? 'peer' : 'modifier']; let minimum: number | null = null;
    if (principal) {
      minimum = principal.full_access_length;
      if (principal.route_key === 'modifier') {
        const [x, y] = principal.goal_xy, speed = Math.max(...Object.values(motions).map(([dx, dy]) => Math.abs(dx) + Math.abs(dy)));
        const gap = Math.min(...pair.sites.map(([l, t, r, b]) => Math.max(l! - x - size[0] + 1, x - r!, 0) + Math.max(t! - y - size[1] + 1, y - b!, 0)));
        minimum! += Math.floor((gap + speed - 1) / speed);
      }
    }
    facts.capacity_needed = minimum === null || minimum > meter.steps_before_empty; facts.direct_goal_cost_lower_bound = minimum;
  }
  const collection = input.collectionEvidence;
  if ((facets.color === 'equal' || featureSites.size) && pair.quarter_turns !== null && truth(meter) && input.observation && actionBudget
    && (marks.length || truth(collection?.pending) || Object.values(collection?.history ?? {}).some(e => e.epoch === current.epoch && e.kind === 'disappearance_confirmed'))) {
    const [layout, orientation] = projectManagedLayout({ current, pair, origin, size, motions, surfaces, unresolvedEdges: unresolved,
      marks, stations, stationMethod: input.stationMethod ?? null, roleRefs: roles, available,
      collectionEvidence: collection ?? null, observation: input.observation, featureSites });
    if (layout !== null && orientation !== null) {
      const search = searchManagedAccess(layout, meter, orientation, { actionBudget, maxPrefix: limit }), options: R[] = search.options;
      facts.managed_search = { status: search.status, options: options.length, charge_orders: options.slice(0, 12).map(option => ({
        order: option.charge_order, cost: option.primitive_count, remaining: option.remaining_at_goal, objective: option.objective })) };
      for (const option of options) {
        const prefix: R[] = option.prefix, commands: string[] = prefix.map(step => step.test_command || step.command);
        if (!commands.length || commands.some(command => !available.includes(command))) continue;
        const last = prefix.at(-1)!;
        if (truth(last.unidentified_control)) {
          const move = last.unidentified_control, eligible: [number, string][] = [];
          for (const command of move.test_commands as string[]) {
            let success = 0, contrary = false;
            for (const [before, action, after] of history) {
              if (action !== command) continue;
              const a = position(before), b = position(after); if (a === null || b === null) continue;
              if (same([b[0] - a[0], b[1] - a[1]], move.predicted_delta)) success++;
              else if (same(a, last.from) && same(motionFootprint(before.rows, point(last.to), size), motionFootprint(current.rows, point(last.to), size))) contrary = true;
            }
            if (!contrary) eligible.push([-success, command]);
          }
          if (!eligible.length) continue;
          eligible.sort(lex); commands[commands.length - 1] = eligible[0]![1];
        }
        const trial = await compositionIdentity([current.epoch, pairKey, option.first_obligation, last.from, last.to,
          commands.at(-1), orientation.residual, meter!.steps_before_empty, layout.color_state?.initial ?? null]);
        if (tried.has(trial)) continue;
        const steps = await Promise.all(prefix.map(async (step, index) => ({ from: step.from, to: step.to, action_ref: commands[index],
          surface_sha: await compositionIdentity(motionFootprint(current.rows, point(step.to), size)) })));
        const name = 'managed_access', terminalEffect = ({ test_or_rearm_orientation: 'modifier', test_aligned_peer: 'peer',
          test_or_collect_capacity: 'capacity_probe', test_observed_palette_entry: 'feature_probe' } as R)[option.first_obligation] ?? null;
        Object.assign(facts, { managed_capacity_bound: true, managed_access_xy: last.to });
        if (facets.color === 'different') {
          facts.feature_reaccess_bound = !!(truth(layout.color_state) && option.conditional_path.some((s: R) => truth(s.feature))
            && ['aligned_peer', 'feature_then_recovery'].includes(option.objective));
          if (facts.feature_reaccess_bound) {
            const path: R[] = option.conditional_path, ix = path.findIndex(s => truth(s.feature)), repair = path[ix]!;
            const station = (layout.color_state.features as R[]).find(v => v.id === repair.feature)!;
            const witnessed = (station.effects as R[]).filter(r => r.from_color === repair.color_before && r.to_color === repair.color_after
              && same(r.mobile_site, layout.color_state.mobile_site));
            const j = path.findIndex((s, index) => index > ix && (truth(s.charge) || truth(s.peer))), recovery = path[j]!;
            facts.feature_reaccess = { route_key: name, effect_site: repair.to, effect_before: witnessed.at(-1)!.before,
              effect_after: witnessed.at(-1)!.after, steps_to_effect: ix + 1, recovery_site: recovery.to, steps_to_recovery: j + 1,
              total_cost: path.length, observation_ref: current.ref, level_epoch: current.epoch, pair_ref: facts.pair_ref,
              objective: option.objective, release_authority: false };
          }
        }
        facts.routes[name] = { start_xy: [...origin], end_xy: last.to, actions: commands.map(action_ref => ({ action_ref })),
          observation_ref: current.ref, level_epoch: current.epoch };
        plans[name] = { route_key: name, steps, size: [...size], footprint_sha: footprint, role_refs: [...roles], pair, trial,
          score: current.score, level_epoch: current.epoch, observation_ref: current.ref, contact_in_prefix: truth(terminalEffect), goal_xy: last.to,
          access_phase: terminalEffect ? 'contact' : 'intermediate', physical_effect: terminalEffect,
          obligation: option.first_obligation, charge_order: option.charge_order, total_cost: option.primitive_count,
          assumptions: option.hypotheses, falsifiers: option.falsifiers, entry_model: orientation,
          composition_objective: option.objective, first_obligation: option.next_composition,
          feature_witnesses: option.conditional_path.filter((s: R) => truth(s.feature)),
          recovery_witnesses: option.conditional_path.filter((s: R) => truth(s.charge) || truth(s.peer)), predicted_last: last };
        break;
      }
    }
  }
  Object.assign(receipt, { route_keys: Object.keys(plans), measured_passage_pattern_count: surfaces.size, persistent_anchor_count: anchors.length,
    nonlocal_edge_count: unresolved.size, gauge_related_mark_count: marks.length });
  return { facts, plans, receipt };
}
