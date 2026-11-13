/**
 * Native transfer of every function and method in V6 terminal_composition.py
 * (786dcf51ca57773d8e3a8948ce9ea3655e7baf8e).
 *
 * Only public integer rasters, measured component occurrences and observed
 * commands enter this learner. A proposed access is a conditional experiment,
 * never an action permit. Set membership is structural, as for Python tuples;
 * no JavaScript array-identity comparisons stand in for the original sets.
 */
import { compareUnicode } from './canonical.ts';
import { v6Digest, validateRows } from './v6-native-observer.ts';
import type { NativeBox, NativePoint, NativeRows } from './v6-native-types.ts';

/** Retained evidence is heterogeneous in the original, including future fields. */
export type CompositionRecord = Record<string, any>;
export interface CompositionObservation extends CompositionRecord {
  entities: readonly CompositionRecord[];
  level_epoch: number;
  levels_completed: number;
  observation_ref: string;
  frame_hash: string;
}
export interface CompositionCommand extends CompositionRecord {
  action_ref: string;
  data?: Readonly<Record<string, number>>;
}
export interface CompositionModel extends CompositionRecord {
  role: string;
  size: NativePoint;
  moves: Record<string, NativePoint>;
  scoring_pattern: readonly number[];
  earlier_site_patterns: readonly (readonly number[])[];
  observed_passages: readonly (readonly number[])[];
  possible_prerequisites: readonly CompositionRecord[];
}
export type CompositionTransition = readonly [Snapshot, string, Snapshot];
export type ScoringContact = readonly [CompositionRecord, number] | null;
export type ChangeRegion = readonly NativePoint[];
export type ChangeFamilies = Record<string, ChangeRegion[]>;
type PointTable = Map<string, NativePoint>;
type Patch = readonly number[];

const has = (value: object, key: string): boolean => Object.hasOwn(value, key);
const keyOf = (value: unknown): string => JSON.stringify(value);
const pointKey = (point: NativePoint): string => `${point[0]},${point[1]}`;
const comparePoint = (a: NativePoint, b: NativePoint): number => a[0] - b[0] || a[1] - b[1];
function compareArray(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return a.length - b.length;
}
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => same(v, b[i]));
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  const first = a as CompositionRecord, second = b as CompositionRecord;
  const keys = Object.keys(first);
  return keys.length === Object.keys(second).length && keys.every(key => has(second, key) && same(first[key], second[key]));
}
function truth(value: any): boolean {
  if (value == null || value === false || value === 0 || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}
function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return Math.abs(a);
}
function pointFromBox(box: NativeBox): NativePoint { return [box[0], box[1]]; }
function pointSet(points: Iterable<NativePoint>): PointTable { return new Map([...points].map(point => [pointKey(point), point])); }
function patternMap(patterns: Iterable<Patch>): Map<string, Patch> { return new Map([...patterns].map(patch => [keyOf(patch), patch])); }
function setHas(values: Iterable<string> | Record<string, unknown>, value: string): boolean {
  if (values instanceof Set || values instanceof Map) return values.has(value);
  if (Symbol.iterator in Object(values)) return [...values as Iterable<string>].includes(value);
  return has(values, value);
}

/** Exact Python json.dumps(sort_keys=True,separators=(',',':')) on the shared integer JSON domain. */
export const compositionIdentity = v6Digest;

/** Frozen raster and unique measured roles at one observed public instant. */
export class Snapshot {
  readonly rows: NativeRows;
  readonly roles: Readonly<Record<string, NativeBox>>;
  readonly epoch: number;
  readonly score: number;
  readonly ref: string;
  readonly frame_hash: string;

  constructor(rows: NativeRows, roles: Readonly<Record<string, NativeBox>>, epoch: number, score: number, ref: string, frame_hash: string) {
    validateRows(rows);
    this.rows = Object.freeze(rows.map(row => Object.freeze([...row])));
    this.roles = Object.freeze(Object.fromEntries(Object.entries(roles).map(([key, value]) => [key, Object.freeze([...value]) as NativeBox])));
    this.epoch = epoch; this.score = score; this.ref = ref; this.frame_hash = frame_hash;
    Object.freeze(this);
  }

  static fromPublic(observation: CompositionObservation, rows: NativeRows): Snapshot {
    const roles = Object.fromEntries(observation.entities.filter(entity => !entity.identity_ambiguous)
      .map(entity => [entity.signature, entity.bbox as NativeBox]));
    return new Snapshot(rows, roles, observation.level_epoch, observation.levels_completed, observation.observation_ref, observation.frame_hash);
  }
}

/** One pixel around the measured role bounding box, including immediate neighbours. */
export function localPatch(scene: Pick<Snapshot, 'rows'>, origin: NativePoint, size: NativePoint): number[] | null {
  const [x, y] = origin, [width, height] = size;
  if (Math.min(x, y) < 1 || y + height >= scene.rows.length || x + width >= scene.rows[0]!.length) return null;
  return scene.rows.slice(y - 1, y + height + 1).flatMap(row => [...row.slice(x - 1, x + width + 1)]);
}

export function equalityPattern(patch: Patch): number[] {
  const labels = new Map<number, number>();
  return patch.map(value => { if (!labels.has(value)) labels.set(value, labels.size); return labels.get(value)!; });
}

/** Unverified dihedral orientations, preserving the original motif dimensions. */
export function orientationPatterns(patch: Patch, size: NativePoint): number[][] {
  const width = size[0] + 2, height = size[1] + 2;
  let matrix = Array.from({ length: height }, (_, i) => [...patch.slice(i * width, (i + 1) * width)]);
  const forms = new Map<string, number[]>();
  for (let turn = 0; turn < 4; turn++) {
    if (matrix.length === height && matrix[0]!.length === width) {
      for (const variant of [matrix, matrix.map(row => [...row].reverse())]) {
        const form = equalityPattern(variant.flat()); forms.set(keyOf(form), form);
      }
    }
    matrix = Array.from({ length: matrix[0]!.length }, (_, x) => [...matrix].reverse().map(row => row[x]!));
  }
  // Python returns a set. Sorting only makes that set's transport deterministic.
  return [...forms.values()].sort(compareArray);
}

export function addPoint(point: NativePoint, displacement: NativePoint): NativePoint {
  return [point[0] + displacement[0], point[1] + displacement[1]];
}
export function relativeMotion(before: Snapshot, after: Snapshot, signature: string): NativePoint | null {
  const first = before.roles[signature], last = after.roles[signature];
  return first && last ? [last[0] - first[0], last[1] - first[1]] : null;
}
export function registered(first: Snapshot, last: Snapshot): boolean {
  const stable = pointSet(Object.entries(first.roles).filter(([sig, box]) => same(last.roles[sig], box)).map(([, box]) => pointFromBox(box)));
  if (stable.size < 3) return false;
  const [a, b, ...others] = [...stable.values()].sort(comparePoint);
  return others.some(([x, y]) => (b![0] - a![0]) * (y - a![1]) !== (b![1] - a![1]) * (x - a![0]));
}

/** Competing/stationary outcomes remain in each counter; ties do not become controls. */
export function motionModels(transitions: readonly CompositionTransition[], terminal: Snapshot): [string, Record<string, NativePoint>][] {
  type CounterValue = { delta: NativePoint; count: number; positions: Set<string> };
  const counts = new Map<string, Map<string, Map<string, CounterValue>>>();
  for (const [before, action, after] of transitions) for (const sig of Object.keys(before.roles)) {
    if (!has(after.roles, sig)) continue;
    if (!counts.has(sig)) counts.set(sig, new Map());
    const actions = counts.get(sig)!;
    if (!actions.has(action)) actions.set(action, new Map());
    const effects = actions.get(action)!, delta = relativeMotion(before, after, sig)!;
    const key = pointKey(delta);
    if (!effects.has(key)) effects.set(key, { delta, count: 0, positions: new Set() });
    const value = effects.get(key)!; value.count++;
    value.positions.add(pointKey(pointFromBox(before.roles[sig]!)));
  }
  const result: [string, Record<string, NativePoint>][] = [];
  for (const sig of Object.keys(terminal.roles).sort(compareUnicode)) {
    const moves: Record<string, NativePoint> = Object.create(null);
    for (const [action, effects] of counts.get(sig) ?? []) {
      const best = [...effects.values()].sort((a, b) => b.count - a.count).slice(0, 2);
      const value = best[0]!;
      if ((value.delta[0] !== 0 || value.delta[1] !== 0) && (best.length === 1 || best[1]!.count < value.count) && value.positions.size >= 2) moves[action] = value.delta;
    }
    if (new Set(Object.values(moves).map(pointKey)).size >= 2) result.push([sig, { ...moves }]);
  }
  return result;
}

/** Families of at least two separated, identically rewritten connected patches. */
export async function repeatedChanges(before: Snapshot, after: Snapshot): Promise<ChangeFamilies> {
  const remaining = new Map<string, NativePoint>();
  after.rows.forEach((row, y) => row.forEach((value, x) => {
    if (!before.rows[y] || x >= before.rows[y]!.length) throw new RangeError('Repeated-change rasters must share the observed viewport');
    if (value !== before.rows[y]![x]) remaining.set(`${x},${y}`, [x, y]);
  }));
  const families: ChangeFamilies = Object.create(null);
  while (remaining.size) {
    const first = remaining.values().next().value!;
    const region = pointSet([first]); remaining.delete(pointKey(first));
    const queue = [first];
    while (queue.length) {
      const [x, y] = queue.pop()!;
      const neighbours: NativePoint[] = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (const cell of neighbours) if (remaining.has(pointKey(cell))) {
        remaining.delete(pointKey(cell)); region.set(pointKey(cell), cell); queue.push(cell);
      }
    }
    const points = [...region.values()].sort(comparePoint);
    const x0 = Math.min(...points.map(p => p[0])), y0 = Math.min(...points.map(p => p[1]));
    const rewritten = points.map(([x, y]) => [x - x0, y - y0, before.rows[y]![x]!, after.rows[y]![x]!]);
    const key = await compositionIdentity(rewritten);
    (families[key] ??= []).push(points);
  }
  // A Python set has no authored order. Regions are canonically transported;
  // all source consumers use intersection, membership, sorted points or union.
  return Object.fromEntries(Object.entries(families).filter(([, regions]) => regions.length >= 2)
    .map(([key, regions]) => [key, regions.sort((a, b) => compareArray(a.flat(), b.flat()))]));
}

export function scoringContactDirection(episode: readonly CompositionTransition[], sig: string,
  moves: Readonly<Record<string, NativePoint>>, contact: ScoringContact): CompositionRecord | null {
  if (contact === null) return null;
  const [terminal, action] = episode.at(-1)!, [route, index] = contact, step = route.prefix[index];
  if (route.role !== sig || route.epoch !== terminal.epoch || route.score !== terminal.score || step.action_ref !== action
      || step.input_status !== 'inverse_hypothesis' || step.effect !== 'unknown_then_observe'
      || !same(step.from, pointFromBox(terminal.roles[sig]!)) || !same(step.to, route.site) || !truth(route.remote_change_evidence)) return null;
  const delta: NativePoint = [step.to[0] - step.from[0], step.to[1] - step.from[1]];
  const vectors = pointSet(Object.values(moves)), missing = pointSet([...vectors.values()].map(([x, y]) => [x === 0 ? 0 : -x, y === 0 ? 0 : -y]));
  for (const key of vectors.keys()) missing.delete(key);
  if (missing.size !== 1 || !missing.has(pointKey(delta))
      || ![...vectors.values()].some(([x, y]) => [...vectors.values()].some(([i, j]) => x * j - y * i !== 0))) return null;
  const alternatives = new Set([...vectors.keys(), ...missing.keys()]);
  const local = episode.slice(0, -1).filter(([before, key, after]) => key === action && has(before.roles, sig) && has(after.roles, sig)
    && registered(before, terminal) && registered(after, terminal)).map(([before, , after]) => [before.ref, relativeMotion(before, after, sig)!] as const);
  const witnesses = local.filter(([, vector]) => same(vector, delta)).map(([ref]) => ref);
  if (!witnesses.length || local.some(([, vector]) => alternatives.has(pointKey(vector)) && !same(vector, delta))) return null;
  return { action_ref: action, delta: [...delta], local_witnesses: witnesses, contact_ref: terminal.ref,
    qualification: 'One-step geometric hypothesis from committed scoring contact; test before further use' };
}

/** Infer reusable, explicitly qualified scoring approaches from the first public score boundary. */
export async function fitBoundary(episode: readonly CompositionTransition[], contact: ScoringContact = null): Promise<CompositionModel[]> {
  if (!episode.length) throw new RangeError('A continuous public prefix ending in a scoring boundary is required');
  const [terminal, scoringAction, entered] = episode.at(-1)!;
  if (entered.score <= terminal.score || episode.slice(0, -1).some(([b, , a]) => b.epoch !== terminal.epoch || a.epoch !== b.epoch)) {
    throw new RangeError('A continuous public prefix ending in a scoring boundary is required');
  }
  const changes = await Promise.all(episode.slice(0, -1).map(([b, , a]) => repeatedChanges(b, a)));
  const models: CompositionModel[] = [];
  for (const [sig, measuredMoves] of motionModels(episode.slice(0, -1), terminal)) {
    let moves = measuredMoves, tentative: CompositionRecord | null = null;
    if (!has(moves, scoringAction)) {
      tentative = scoringContactDirection(episode, sig, moves, contact);
      if (tentative === null) continue;
      moves = { ...moves, [scoringAction]: tentative.delta };
    }
    const [left, top, right, bottom] = terminal.roles[sig]!, size: NativePoint = [right - left + 1, bottom - top + 1];
    const goalSite = addPoint([left, top], moves[scoringAction]!);
    const finalPattern = localPatch(terminal, goalSite, size);
    if (!finalPattern?.length || new Set(finalPattern).size < 2) continue;
    const versions = new Map<string, { patch: Patch; frames: Set<string> }>();
    const enablingFamilies = new Set<string>(), contradicted = new Set<string>();
    const passable = new Map<string, { patch: Patch; sources: Set<string> }>();
    for (let i = 0; i < episode.length - 1; i++) {
      const [before, action, after] = episode[i]!, groups = changes[i]!;
      if (!registered(before, terminal) || !registered(after, terminal)) continue;
      const original = localPatch(before, goalSite, size), resulting = localPatch(after, goalSite, size);
      if (original === null || resulting === null) continue;
      const versionKey = keyOf(original);
      if (!versions.has(versionKey)) versions.set(versionKey, { patch: original, frames: new Set() });
      versions.get(versionKey)!.frames.add(before.frame_hash);
      if (!same(original, resulting) && same(resulting, finalPattern)) {
        const [x, y] = goalSite, targetArea = new Set<string>();
        for (let u = x - 1; u < x + size[0] + 1; u++) for (let v = y - 1; v < y + size[1] + 1; v++) targetArea.add(`${u},${v}`);
        for (const [key, regions] of Object.entries(groups)) if (regions.every(region => region.every(point => !targetArea.has(pointKey(point))))) enablingFamilies.add(key);
      }
      if (!has(before.roles, sig) || !has(moves, action)) continue;
      const origin = pointFromBox(before.roles[sig]!), dest = addPoint(origin, moves[action]!);
      const patch = localPatch(before, dest, size);
      if (patch === null) continue;
      const patchKey = keyOf(patch);
      if (same(relativeMotion(before, after, sig), moves[action])) {
        if (!passable.has(patchKey)) passable.set(patchKey, { patch, sources: new Set() });
        passable.get(patchKey)!.sources.add(pointKey(origin));
      } else contradicted.add(patchKey);
    }
    const terminalVariants = [...versions.values()].filter(v => !same(v.patch, finalPattern) && v.frames.size >= 2).map(v => [...v.patch]);
    const probes: CompositionRecord[] = [];
    for (let i = 0; i < episode.length - 1; i++) {
      const [before, action, after] = episode[i]!, groups = changes[i]!;
      const shared = [...enablingFamilies].filter(key => has(groups, key));
      if (!shared.length || !has(before.roles, sig) || !has(moves, action)) continue;
      const patch = localPatch(before, addPoint(pointFromBox(before.roles[sig]!), moves[action]!), size);
      if (patch !== null) probes.push({ pattern: patch, topology: equalityPattern(patch), observed_command: action,
        event_families: shared.sort(compareUnicode), source_ref: before.ref, result_ref: after.ref });
    }
    const model: CompositionModel = { role: sig, size, moves: Object.fromEntries(Object.entries(moves).map(([key, vector]) => [key, [...vector]])),
      scoring_pattern: finalPattern, earlier_site_patterns: terminalVariants,
      observed_passages: [...passable.values()].sort((a, b) => compareArray(a.patch, b.patch))
        .filter(value => value.sources.size >= 2 && !contradicted.has(keyOf(value.patch))).map(value => [...value.patch]),
      possible_prerequisites: probes, boundary_before: terminal.ref, boundary_after: entered.ref,
      score_before: terminal.score, score_after: entered.score,
      qualification: 'Observed scoring approach and correlated changes. Goal role and prerequisite necessity are hypotheses.' };
    if (tentative) model.tentative_scoring_control = tentative;
    models.push(model);
  }
  return models;
}

export function occurrenceAt(epoch: number, role: string, site: NativePoint): CompositionRecord { return { epoch, role, site: [...site] }; }

/** Breadth-first conditional access; its final contact is always experimentally unsealed. */
export async function proposeAccess(model: CompositionModel, current: Snapshot, tried: Iterable<string> = [], maxPrefix = 16,
  transfers: readonly CompositionRecord[] = [], observedContext: readonly unknown[] = [], refuted: Iterable<string> = [],
  occurrences: Iterable<string> | Record<string, unknown> = []): Promise<CompositionRecord> {
  const sig = model.role;
  if (!has(current.roles, sig)) return { status: 'role_unbound' };
  const start = pointFromBox(current.roles[sig]!), size = model.size, moves = model.moves;
  const dx = Object.values(moves).reduce((value, vector) => gcd(value, Math.abs(vector[0])), 0);
  const dy = Object.values(moves).reduce((value, vector) => gcd(value, Math.abs(vector[1])), 0);
  if (!dx || !dy) return { status: 'insufficient_translation_basis' };
  const surfaces = patternMap(model.observed_passages), earlier = patternMap(model.earlier_site_patterns), terminal = model.scoring_pattern;
  const probes = patternMap(model.possible_prerequisites.map(p => p.pattern));
  const topologies = new Set(model.possible_prerequisites.map(p => keyOf(p.topology))), rotated = new Set<string>();
  for (const patch of probes.values()) for (const form of orientationPatterns(patch, size)) rotated.add(keyOf(form));
  const cells = new Map<string, { point: NativePoint; patch: Patch }>();
  // Python modulo is non-negative for positive step; roles are normally in view.
  for (let y = ((start[1] % dy) + dy) % dy; y < current.rows.length; y += dy) {
    for (let x = ((start[0] % dx) + dx) % dx; x < current.rows[0]!.length; x += dx) {
      const value = localPatch(current, [x, y], size);
      if (value !== null) cells.set(`${x},${y}`, { point: [x, y], patch: value });
    }
  }
  const goals = [...cells.values()].filter(value => same(value.patch, terminal)).map(value => value.point);
  const earlierSites = [...cells.values()].filter(value => earlier.has(keyOf(value.patch))).map(value => value.point);
  const precursors = new Map<string, string>();
  for (const [key, { patch }] of cells) {
    const pattern = keyOf(equalityPattern(patch));
    if (probes.has(keyOf(patch)) || rotated.has(pattern)) precursors.set(key,
      probes.has(keyOf(patch)) ? 'literal_precursor' : topologies.has(pattern) ? 'relocated_shape_precursor' : 'oriented_shape_precursor');
  }
  let targets: Map<string, string>;
  if (goals.length === 1) targets = new Map([[pointKey(goals[0]!), 'possible_scoring_contact']]);
  else if (earlierSites.length === 1 && !goals.length) targets = precursors;
  else return { status: 'ambiguous_or_missing_goal_site', goal_matches: goals.length, earlier_matches: earlierSites.length };
  const trialKey = (dest: NativePoint, action: string) => compositionIdentity([current.epoch, sig, dest, action, cells.get(pointKey(dest))!.patch, !!goals.length, observedContext]);
  const premise = (pos: NativePoint, action: string, dest: NativePoint) => compositionIdentity([current.epoch, sig, pos, action, cells.get(pointKey(dest))!.patch, !!goals.length, observedContext]);
  const knownEdges = new Map<string, [NativePoint, CompositionRecord][]>();
  for (const edge of transfers) {
    if (edge.epoch !== current.epoch || edge.role !== sig) continue;
    const src = edge.origin as NativePoint, contact = edge.contact as NativePoint, landing = edge.landing as NativePoint;
    if (same(cells.get(pointKey(contact))?.patch, edge.surface) && cells.has(pointKey(landing))) {
      const key = keyOf([src, edge.action_ref]);
      if (!knownEdges.has(key)) knownEdges.set(key, []);
      knownEdges.get(key)!.push([landing, edge]);
    }
  }
  type Parent = { point: NativePoint; previous: NativePoint; action: string; effect: string; contact: NativePoint | null };
  type Experiment = readonly [NativePoint, string, NativePoint, string];
  const queue: NativePoint[] = [start], parent = new Map<string, Parent | null>([[pointKey(start), null]]);
  const experiments: Experiment[] = [], orderedMoves = Object.entries(moves).sort(([a], [b]) => compareUnicode(a, b));
  for (let queueIndex = 0; queueIndex < queue.length; queueIndex++) {
    const pos = queue[queueIndex]!;
    for (const [action, delta] of orderedMoves) {
      const dest = addPoint(pos, delta), destKey = pointKey(dest);
      if (!cells.has(destKey) || setHas(refuted, await premise(pos, action, dest))) continue;
      const edges = knownEdges.get(keyOf([pos, action])) ?? [];
      if (edges.length) {
        if (pointSet(edges.map(([landing]) => landing)).size === 1) {
          const [landing, edge] = edges[0]!, landingKey = pointKey(landing);
          if (!parent.has(landingKey)) {
            parent.set(landingKey, { point: landing, previous: pos, action, effect: 'conditional_observed_access', contact: edge.contact }); queue.push(landing);
          }
        }
        continue;
      }
      if (targets.has(destKey)) {
        if (!setHas(tried, await trialKey(dest, action))) experiments.push([pos, action, dest, targets.get(destKey)!]);
        continue;
      }
      if (!parent.has(destKey) && surfaces.has(keyOf(cells.get(destKey)!.patch))) {
        parent.set(destKey, { point: dest, previous: pos, action, effect: 'conditional_translation', contact: null }); queue.push(dest);
      }
    }
  }
  if (!experiments.length && goals.length === 1 && transfers.length) {
    const observedFamilies = new Set<string>();
    for (const edge of transfers) if (edge.epoch === current.epoch && edge.role === sig) observedFamilies.add(keyOf(equalityPattern(edge.surface)));
    const supported = new Set<string>();
    for (const patch of probes.values()) {
      const family = orientationPatterns(patch, size).map(keyOf);
      if (family.some(key => observedFamilies.has(key))) for (const key of family) supported.add(key);
    }
    // Insertion order is the original breadth-first order, not coordinate sort.
    for (const node of parent.values()) {
      const pos = node?.point ?? start;
      for (const [action, delta] of orderedMoves) {
        const dest = addPoint(pos, delta), destKey = pointKey(dest);
        if (precursors.has(destKey) && supported.has(keyOf(equalityPattern(cells.get(destKey)!.patch)))
            && !knownEdges.get(keyOf([pos, action]))?.length && !setHas(tried, await trialKey(dest, action))
            && !setHas(refuted, await premise(pos, action, dest))) experiments.push([pos, action, dest, 'probe_access_to_unreachable_scoring_composition']);
      }
    }
  }
  if (!experiments.length) return { status: 'no_observed_surface_access', target_count: targets.size, reachable: parent.size };
  const firstVisits: Experiment[] = [];
  for (const experiment of experiments) if (!setHas(occurrences, await compositionIdentity(occurrenceAt(current.epoch, sig, experiment[2])))) firstVisits.push(experiment);
  const preferNew = !goals.length && !!firstVisits.length;
  let [pos, action, dest, kind] = (preferNew ? firstVisits : experiments)[0]!;
  const steps: CompositionRecord[] = [{ action_ref: action, from: pos, to: dest, effect: 'unknown_then_observe' }];
  while (parent.get(pointKey(pos)) !== null) {
    const node = parent.get(pointKey(pos))!;
    steps.push({ action_ref: node.action, from: node.previous, to: pos, effect: node.effect, contact: node.contact }); pos = node.previous;
  }
  steps.reverse();
  let prefix = steps.slice(0, maxPrefix);
  for (let i = 0; i < prefix.length; i++) {
    const step = prefix[i]!, nominal = addPoint(step.from, moves[step.action_ref]!);
    step.premise_ref = await premise(step.from, step.action_ref, nominal);
    if (step.effect === 'conditional_observed_access') { prefix = prefix.slice(0, i + 1); break; }
  }
  const predictedFamilies = new Set<string>();
  if (kind !== 'possible_scoring_contact') for (const example of model.possible_prerequisites) {
    if (orientationPatterns(example.pattern, size).some(pattern => same(equalityPattern(cells.get(pointKey(dest))!.patch), pattern))) {
      for (const family of example.event_families) predictedFamilies.add(family);
    }
  }
  return { status: 'proposed', kind, origin: start, site: dest, reachable: parent.size,
    terminal_site: goals.length ? goals[0] : earlierSites[0], terminal_appearance: goals.length ? 'scoring_appearance' : 'earlier_appearance',
    possible_effect_families: [...predictedFamilies].sort(compareUnicode), eligible_approaches: experiments.length,
    earlier_site_matches: earlierSites.length, scoring_site_matches: goals.length, trial_key: await trialKey(dest, action), prefix,
    planned_steps: steps.length, role: sig, role_size: size, experimental_occurrence: occurrenceAt(current.epoch, sig, dest),
    prefers_untried_occurrence: preferNew, reachable_experimental_sites: pointSet(experiments.map(e => e[2])).size,
    reachable_untried_sites: pointSet(firstVisits.map(e => e[2])).size, epoch: current.epoch, observation_ref: current.ref, release_authority: false,
    falsifiers: ['observed role outside expected local support', 'unexpected change outside swept supports', 'boundary or input unavailable'] };
}

/** Isolated measured support: adjoining equal-colour pixels invalidate identity. */
export function compositionOccurs(rows: NativeRows, position: NativePoint, mask: readonly NativePoint[], value: number): boolean {
  const [x, y] = position, support = pointSet(mask.map(([u, v]) => [x + u, y + v]));
  if (!support.size || [...support.values()].some(([u, v]) => v < 0 || u < 0 || v >= rows.length || u >= rows[v]!.length || rows[v]![u] !== value)) return false;
  for (const [u, v] of support.values()) {
    const neighbours: NativePoint[] = [[u - 1, v], [u + 1, v], [u, v - 1], [u, v + 1]];
    for (const [a, b] of neighbours) if (!support.has(`${a},${b}`) && b >= 0 && b < rows.length && a >= 0 && a < rows[b]!.length && rows[b]![a] === value) return false;
  }
  return true;
}

export function checkAccessBefore(plan: CompositionRecord, index: number, rows: NativeRows,
  options: { epoch: number; score: number; available: readonly string[]; observation_ref?: string | null }): { admitted: boolean; reason: string } {
  if (plan.status !== 'proposed' || index < 0 || index >= plan.prefix.length) return { admitted: false, reason: 'outside_committed_set' };
  if (options.epoch !== plan.epoch || options.score !== plan.score) return { admitted: false, reason: 'scope_changed' };
  if (index === 0 && (options.observation_ref ?? null) !== plan.observation_ref) return { admitted: false, reason: 'initial_observation_changed' };
  const step = plan.prefix[index];
  if (!options.available.includes(step.action_ref)) return { admitted: false, reason: 'command_unavailable' };
  if (!compositionOccurs(rows, step.from, plan.role_mask, plan.role_value)) return { admitted: false, reason: 'role_position_or_shape_changed' };
  const actual = localPatch({ rows }, truth(step.contact) ? step.contact : step.to, plan.role_size);
  if (actual === null || !same(step.surface_before, actual)) return { admitted: false, reason: 'destination_premise_changed' };
  return { admitted: true, reason: 'bound_role_and_destination_match' };
}

export function checkAccessAfter(plan: CompositionRecord, index: number, beforeRows: NativeRows, afterRows: NativeRows,
  options: { epoch: number; score: number; state: string }): { matched: boolean | null; seal_prefix: boolean; reason: string } {
  if (plan.status !== 'proposed' || index < 0 || index >= plan.prefix.length) return { matched: false, seal_prefix: true, reason: 'outside_committed_set' };
  if (options.epoch !== plan.epoch || options.score !== plan.score || options.state === 'WIN' || options.state === 'GAME_OVER') {
    return { matched: null, seal_prefix: true, reason: 'official_boundary_or_terminal' };
  }
  const step = plan.prefix[index];
  if (step.effect === 'unknown_then_observe') return { matched: null, seal_prefix: true, reason: 'experimental_contact_observed' };
  if (beforeRows.length !== afterRows.length || beforeRows.some((row, i) => row.length !== afterRows[i]!.length)) return { matched: false, seal_prefix: true, reason: 'viewport_changed' };
  const reached = compositionOccurs(afterRows, step.to, plan.role_mask, plan.role_value), left = !compositionOccurs(afterRows, step.from, plan.role_mask, plan.role_value);
  if (!reached || !left) return { matched: false, seal_prefix: true, reason: 'displacement_prediction_refuted' };
  if (step.effect === 'conditional_observed_access') return { matched: true, seal_prefix: true, reason: 'observed_access_arrival_reconcile' };
  const [width, height] = plan.role_size as NativePoint, possible = new Set<string>();
  for (const [x, y] of [step.from, step.to] as NativePoint[]) for (let u = x - 1; u < x + width + 1; u++) for (let v = y - 1; v < y + height + 1; v++) possible.add(`${u},${v}`);
  for (let y = 0; y < beforeRows.length; y++) for (let x = 0; x < beforeRows[y]!.length; x++) {
    if (beforeRows[y]![x] !== afterRows[y]![x] && !possible.has(`${x},${y}`)) return { matched: false, seal_prefix: true, reason: 'unexpected_remote_effect' };
  }
  return { matched: true, seal_prefix: index + 1 === plan.prefix.length, reason: 'observed_local_translation' };
}

/** One active public epoch plus reusable scoring hypotheses and local trials. */
export class GoalAccessMemory {
  episode: CompositionTransition[] = [];
  models: CompositionModel[] = [];
  readonly tried = new Set<string>();
  transfers: CompositionRecord[] = [];
  readonly effectPoints: PointTable = new Map();
  readonly refuted = new Set<string>();
  readonly occurrences: Record<string, CompositionRecord> = Object.create(null);
  last: Snapshot | null = null;
  unresolvedReturns: CompositionRecord[] = [];

  retainedState(): CompositionRecord {
    return { models: this.models, tried: [...this.tried].sort(compareUnicode), transfers: this.transfers,
      effect_points: [...this.effectPoints.values()].sort(comparePoint).map(p => [...p]), refuted: [...this.refuted].sort(compareUnicode),
      occurrences: { ...this.occurrences }, unresolved_returns: this.unresolvedReturns };
  }

  async retainOccurrence(event: CompositionRecord): Promise<void> {
    const occurrence = event.occurrence;
    if (occurrence == null) return;
    const identity = await compositionIdentity(occurrence);
    const site = this.occurrences[identity] ??= { occurrence, conditions: {} };
    const outcomes = site.conditions[event.key] ??= {};
    outcomes[event.after] = { before: event.before, after: event.after, surface: event.contact_surface,
      command: event.command, terminal_appearance: event.terminal_appearance_before, score_delta: event.score_delta,
      terminal_site_changed: event.terminal_site_changed, matched_effect_families: event.matched_effect_families,
      matched_effect_points: event.matched_effect_points, landing: event.landing };
  }

  /** Restore retained knowledge from verified persisted events; do not forge a live episode. */
  async applyEvent(event: CompositionRecord): Promise<void> {
    switch (event.kind) {
      case 'goal_approach_retrospective':
        if (event.models.length) this.models = event.models;
        this.episode = []; this.tried.clear(); this.transfers = []; this.effectPoints.clear(); this.refuted.clear(); this.last = null; this.unresolvedReturns = [];
        break;
      case 'goal_contact_trial':
        this.tried.add(event.key);
        for (const point of event.matched_effect_points ?? []) this.effectPoints.set(pointKey(point), point);
        await this.retainOccurrence(event);
        break;
      case 'observed_nonlocal_access': this.transfers.push(event.edge); break;
      case 'unresolved_whole_scene_return': this.unresolvedReturns.push(event); break;
      case 'displacement_refuted_in_context': this.refuted.add(event.premise_ref); break;
      default: throw new TypeError('Unknown public goal-memory event');
    }
  }

  snapshot(observation: CompositionObservation, rows: NativeRows): Snapshot {
    if (this.last !== null && this.last.ref === observation.observation_ref) return this.last;
    return Snapshot.fromPublic(observation, rows);
  }

  async propose(observation: CompositionObservation, rows: NativeRows, actions: readonly CompositionCommand[], maxPrefix = 16): Promise<CompositionRecord> {
    const current = this.snapshot(observation, rows);
    const context = [...this.effectPoints.values()].sort(comparePoint)
      .filter(([x, y]) => y >= 0 && y < current.rows.length && x >= 0 && x < current.rows[y]!.length).map(([x, y]) => [x, y, current.rows[y]![x]!]);
    const offered = new Set(actions.filter(action => !truth(action.data)).map(action => action.action_ref));
    const results: CompositionRecord[] = [];
    for (const model of this.models) {
      const active: CompositionModel = { ...model, moves: Object.fromEntries(Object.entries(model.moves).filter(([key]) => offered.has(key))) };
      if (!Object.keys(active.moves).length) continue;
      const route = await proposeAccess(active, current, this.tried, maxPrefix, this.transfers, context, this.refuted, this.occurrences);
      if (route.status !== 'proposed') continue;
      const role = observation.entities.find(entity => entity.signature === model.role && !entity.identity_ambiguous);
      if (!role) continue;
      const tentative = model.tentative_scoring_control;
      if (truth(tentative)) {
        route.tentative_scoring_control = tentative;
        for (let index = 0; index < route.prefix.length; index++) if (route.prefix[index].action_ref === tentative.action_ref) {
          route.prefix = route.prefix.slice(0, index + 1); route.test_tentative_control = true; break;
        }
      }
      Object.assign(route, { role_mask: role.mask.map((p: NativePoint) => [...p]), role_value: role.palette_value, score: current.score,
        source_model_ref: await compositionIdentity(model), source_boundary: model.boundary_before,
        qualification: 'Conditional route toward a hypothesized scoring or enabling composition' });
      for (const step of route.prefix) {
        const patch = localPatch(current, truth(step.contact) ? step.contact : step.to, model.size);
        if (patch === null) throw new TypeError('Committed composition destination has no public patch');
        step.surface_before = patch;
      }
      results.push(route);
    }
    if (!results.length) return { status: 'unbound_or_no_access' };
    const identities = await Promise.all(results.map(route => compositionIdentity([route.role, route.site, route.prefix])));
    if (new Set(identities).size !== 1) return { status: 'competing_scoring_approaches' };
    return results[0]!;
  }

  async record(beforeObs: CompositionObservation, beforeRows: NativeRows, command: CompositionCommand,
    afterObs: CompositionObservation, afterRows: NativeRows,
    options: { plan?: CompositionRecord | null; action_index?: number | null; scoring_contact?: ScoringContact } = {}): Promise<CompositionRecord[]> {
    const before = this.snapshot(beforeObs, beforeRows), after = Snapshot.fromPublic(afterObs, afterRows);
    this.last = after;
    const key = truth(command.data) ? `addressed:${await compositionIdentity(command)}` : command.action_ref;
    this.episode.push([before, key, after]);
    const events: CompositionRecord[] = [], plan = options.plan ?? null, actionIndex = options.action_index ?? null;
    const step = plan !== null && actionIndex !== null ? plan.prefix.at(actionIndex) : null;
    if (plan !== null && actionIndex !== null && after.epoch === before.epoch && after.score === before.score) {
      const role = plan.role, b = before.roles[role], a = after.roles[role];
      if (step.effect !== 'unknown_then_observe' && key === step.action_ref && b && a && same(pointFromBox(b), step.from)
          && same(pointFromBox(a), pointFromBox(b)) && !same(step.to, pointFromBox(a))) {
        this.refuted.add(step.premise_ref);
        events.push({ kind: 'displacement_refuted_in_context', premise_ref: step.premise_ref, before: before.ref, after: after.ref,
          scope: 'same epoch, role, origin, command, destination appearance and measured progress context' });
      }
    }
    if (plan !== null && actionIndex !== null && step.effect === 'unknown_then_observe') {
      this.tried.add(plan.trial_key);
      const groups = before.epoch === after.epoch ? await repeatedChanges(before, after) : {};
      const matched = Object.keys(groups).filter(key => plan.possible_effect_families.includes(key)).sort(compareUnicode);
      const points = pointSet(matched.flatMap(key => groups[key]!.flat()));
      for (const [key, point] of points) this.effectPoints.set(key, point);
      const modeComparison = after.epoch === before.epoch ? !same(localPatch(before, plan.terminal_site, plan.role_size), localPatch(after, plan.terminal_site, plan.role_size)) : null;
      const contact = step.to as NativePoint, arrival = before.epoch === after.epoch ? after.roles[plan.role] : undefined;
      const event: CompositionRecord = { kind: 'goal_contact_trial', key: plan.trial_key, before: before.ref, after: after.ref,
        occurrence: occurrenceAt(before.epoch, plan.role, contact), command: key,
        contact_surface: localPatch(before, contact, plan.role_size) ?? [], landing: arrival ? [...pointFromBox(arrival)] : null,
        terminal_appearance_before: plan.terminal_appearance, terminal_site_changed: modeComparison,
        matched_effect_families: matched, matched_effect_points: [...points.values()].sort(comparePoint), score_delta: after.score - before.score };
      events.push(event); await this.retainOccurrence(event);
    }
    if (after.epoch !== before.epoch || after.score > before.score) {
      const learned = after.score > before.score ? await fitBoundary(this.episode, options.scoring_contact ?? null) : [];
      if (learned.length) this.models = learned;
      events.push({ kind: 'goal_approach_retrospective', models: learned, before: before.ref, after: after.ref });
      this.episode = []; this.tried.clear(); this.transfers = []; this.effectPoints.clear(); this.refuted.clear(); this.unresolvedReturns = [];
      return events;
    }
    for (const model of this.models) {
      const sig = model.role;
      if (!has(before.roles, sig) || !has(after.roles, sig) || !has(model.moves, key)) continue;
      const origin = pointFromBox(before.roles[sig]!), landing = pointFromBox(after.roles[sig]!), contact = addPoint(origin, model.moves[key]!);
      const surface = localPatch(before, contact, model.size);
      if (surface === null) continue;
      const previous = this.transfers.filter(edge => edge.epoch === before.epoch && edge.role === sig && same(edge.origin, origin) && edge.action_ref === key && same(edge.surface, surface));
      if (!previous.length && (same(landing, origin) || same(landing, contact))) continue;
      if (previous.some(edge => same(edge.landing, landing))) continue;
      const edge = { epoch: before.epoch, role: sig, origin: [...origin], landing: [...landing], contact: [...contact], surface,
        action_ref: key, before: before.ref, after: after.ref };
      const initial = this.episode[0]![0];
      if (initial.epoch === after.epoch && initial.score === after.score && same(initial.rows, after.rows) && !same(before.rows, after.rows)) {
        const event = { kind: 'unresolved_whole_scene_return', edge, initial_observation: initial.ref, before: before.ref, after: after.ref,
          qualification: 'Exact public scene returned; local transport and scene restoration remain unresolved.' };
        this.unresolvedReturns.push(event); events.push(event); continue;
      }
      this.transfers.push(edge); events.push({ kind: 'observed_nonlocal_access', edge });
    }
    return events;
  }
}
