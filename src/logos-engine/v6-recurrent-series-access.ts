/** RepeatedLinePatterns and SupportedLineAccess from the pinned V6 source.
 * These are the first two retained layers of the shared series ancestry. A
 * continuation, scored appearance and alternating response remain hypotheses;
 * only current public patches and returned official progression are acquired.
 */
import { recurrentSeriesFields, recurrentSeriesPointedCandidates, recurrentSeriesExtensions,
  recurrentSeriesLayoutKey } from './v6-recurrent-series-observation.ts';
import type { RecurrentSeriesField, RecurrentSeriesExtension } from './v6-recurrent-series-observation.ts';
import { lineInsertions, lineWindows, linePlace, searchLines, NativeLineSearchDomainError,
  NativeLineSearchWorkBoundError } from './v6-supported-lines.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { compareUnicode } from './canonical.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import type { ObservedInputDomain } from './v6-native-observer.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type Clock = () => number;
type BeforeMeta = { epoch: number; score: number; observation_ref: string; available: readonly string[] };
type AfterMeta = { epoch: number; score: number; state?: string };
type Point = readonly [number, number];
export interface RecurrentSeriesConfig {
  repeated_line_completion?: unknown;
  prepare_supported_lines: unknown;
  supported_line_reply_plies: number;
}
export interface RecurrentSeriesSearchBounds { maxNodes?: number }
export interface RecurrentSeriesQuestionOptions extends RecurrentSeriesSearchBounds {
  nativeBounds?: boolean;
  deadlineMs?: number | null;
  now?: Clock;
}
export interface RecurrentSeriesRecordOptions {
  /** Both source record methods call the complete inherited self.after. */
  after?: (proposal: R, index: number, rows: NativeRows, later: NativeRows, meta: AfterMeta) => R;
}
export interface RecurrentSeriesState {
  line_trials: R;
  line_goals: R[];
  insert_samples: R[];
  insert_orders: R;
  insert_rejections: string[];
  insert_refuted_epochs: number[];
}
export const RECURRENT_SERIES_NATIVE_SEARCH_BOUNDS = Object.freeze({ maxNodes: 250_000 });
export const freshRecurrentSeriesMemory = (): RecurrentSeriesState => ({ line_trials: {}, line_goals: [],
  insert_samples: [], insert_orders: {}, insert_rejections: [], insert_refuted_epochs: [] });

function required(value: R, key: string): any {
  if (!Object.hasOwn(value, key)) throw new TypeError('Recurrent-series source contract requires ' + key);
  return value[key];
}
const own = (value: R, key: string, fallback: any = null): any => Object.hasOwn(value, key) ? value[key] : fallback;
const abstained = (): R => ({ status: 'abstained', reason: 'no_recurrent_line_question' });
const containsPoint = (points: readonly (readonly number[])[], point: readonly number[]): boolean => points.some(value => equal(value, point));
function setItem(target: R, key: string, value: R): void {
  Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
}
function address(field: RecurrentSeriesField, point: readonly number[]): { action: R; target: number[] } {
  const x = field.origin[0] + point[0]! * field.pitch[0], y = field.origin[1] + point[1]! * field.pitch[1];
  return { action: { action_ref: 'ACTION6', data: { x: x + Math.floor((field.size[0] - 1) / 2),
    y: y + Math.floor((field.size[1] - 1) / 2) } }, target: [x, y] };
}

/** Indexing retains Python's negative-index behavior for the direct guard API.
 * Produced plans always use a positive measured rectangle; malformed targets
 * remain validation errors, not refutations acquired as causal knowledge. */
function pixel(rows: NativeRows, x: number, y: number): number {
  const row = rows.at(y), value = row?.at(x);
  if (value === undefined) throw new RangeError('Recurrent-series public patch exceeds the available raster');
  return value;
}
function patchMatches(rows: NativeRows, target: readonly number[], size: readonly number[], color: unknown): boolean {
  const [x, y] = target, [w, h] = size;
  if (![x, y, w, h].every(Number.isSafeInteger)) throw new TypeError('Recurrent-series public patch requires integer coordinates');
  for (let v = y!; v < y! + h!; v++) for (let u = x!; u < x! + w!; u++) if (!equal(pixel(rows, u, v), color)) return false;
  return true;
}
function changes(first: RecurrentSeriesField, last: RecurrentSeriesField): [number, number, unknown, unknown][] {
  const result: [number, number, unknown, unknown][] = [];
  for (const [y, row] of first.grid.entries()) for (const [x, before] of row.entries()) {
    const after = last.grid[y]![x];
    if (!equal(before, after)) result.push([x, y, before, after]);
  }
  return result;
}

export function repeatedLineBefore(proposal: R, index: number, rows: NativeRows, meta: BeforeMeta): R {
  const plan = proposal.line_plan;
  if (!truth(plan)) return { admitted: false, reason: 'missing_series_plan' };
  const admitted = equal(index, 0) && required(meta, 'available').includes(required(required(plan, 'action'), 'action_ref'))
    && equal([required(plan, 'epoch'), required(plan, 'score'), required(plan, 'observation_ref')],
      [required(meta, 'epoch'), required(meta, 'score'), required(meta, 'observation_ref')])
    && identity(rows) === required(plan, 'frame_digest');
  return { admitted, reason: admitted ? 'pointed_series_bound' : 'pointed_series_changed' };
}
export function repeatedLineAfter(proposal: R, _index: number, _rows: NativeRows, later: NativeRows, meta: AfterMeta): R {
  const plan = proposal.line_plan;
  if (!truth(plan)) return { matched: null, seal_prefix: true, reason: 'missing_series_plan' };
  if (!equal(required(meta, 'epoch'), required(plan, 'epoch')) || !equal(required(meta, 'score'), required(plan, 'score'))
    || ['WIN', 'GAME_OVER'].includes(required(meta, 'state'))) return { matched: null, seal_prefix: true, reason: 'official_boundary_or_terminal' };
  const matched = patchMatches(later, required(plan, 'target'), required(plan, 'size'), required(plan, 'expected_palette'));
  return { matched, seal_prefix: true, reason: matched ? 'series_continuation_observed' : 'series_continuation_refuted' };
}

/** This own guard preserves the source priority SupportedLine > RepeatedLine.
 * SharedSeries owns the higher inherited priority and current physical binding. */
export function recurrentSeriesBefore(proposal: R, index: number, rows: NativeRows, meta: BeforeMeta): R {
  const plan = proposal.supported_line_plan;
  if (!truth(plan)) return repeatedLineBefore(proposal, index, rows, meta);
  const admitted = equal(index, 0)
    && equal([required(plan, 'epoch'), required(plan, 'score'), required(plan, 'observation_ref')],
      [required(meta, 'epoch'), required(meta, 'score'), required(meta, 'observation_ref')])
    && required(meta, 'available').includes(required(required(plan, 'action'), 'action_ref'))
    && identity(rows) === required(plan, 'frame_digest');
  return { admitted, reason: admitted ? 'supported_preparation_bound' : 'supported_preparation_changed' };
}
export function recurrentSeriesAfter(proposal: R, index: number, rows: NativeRows, later: NativeRows, meta: AfterMeta): R {
  const plan = proposal.supported_line_plan;
  if (!truth(plan)) return repeatedLineAfter(proposal, index, rows, later, meta);
  if (!equal(required(meta, 'epoch'), required(plan, 'epoch')) || !equal(required(meta, 'score'), required(plan, 'score'))
    || ['WIN', 'GAME_OVER'].includes(required(meta, 'state'))) return { matched: null, seal_prefix: true, reason: 'official_boundary_or_terminal' };
  const match = patchMatches(later, required(plan, 'target'), required(plan, 'size'), required(plan, 'expected_palette'));
  const first = recurrentSeriesFields(rows), last = recurrentSeriesFields(later);
  let compatible = false;
  if (match && first.length === 1 && last.length === 1 && recurrentSeriesLayoutKey(first[0]!) === recurrentSeriesLayoutKey(last[0]!)
    && recurrentSeriesLayoutKey(last[0]!) === required(plan, 'layout')) {
    const f = first[0]!, g = last[0]!, changed = changes(f, g);
    const placed = changed.filter(([, , before, after]) => equal(before, plan.empty_palette) && equal(after, plan.expected_palette));
    const reply = changed.filter(([, , before, after]) => equal(before, plan.empty_palette) && equal(after, plan.response_palette));
    if (changed.length === 2 && placed.length === 1 && reply.length === 1) {
      compatible = containsPoint(lineInsertions(linePlace(f.grid, [placed[0]![0], placed[0]![1]], plan.expected_palette),
        plan.empty_palette, plan.support_axis, plan.support_sign), [reply[0]![0], reply[0]![1]]);
    }
    if (lineWindows(g.grid, required(plan, 'goal_length')).some(window => window.every(([x, y]) => equal(g.grid[y]![x], plan.expected_palette)))) {
      return { matched: false, seal_prefix: true, reason: 'scored_line_not_sufficient_in_this_context' };
    }
  }
  const matched = match && compatible;
  return { matched, seal_prefix: true, reason: matched ? 'prepared_contribution_and_compatible_response_observed' : 'supported_insertion_or_response_refuted' };
}

function ownedEvent(event: R): R {
  if (!['repeated_line_trial', 'repeated_line_scored', 'supported_insertion_observation',
    'supported_insertion_order', 'supported_line_refutation'].includes(event.kind)) {
    throw new TypeError('Outside recurrent-series layers: ' + String(event.kind));
  }
  const value = retainNativeJson(event);
  // Source append-only values remain opaque, including historical minimal
  // checkpoints. Only the keys consumed during this reduction are required.
  for (const key of value.kind === 'repeated_line_trial' ? ['trial'] : value.kind === 'supported_insertion_order' ? ['source']
    : value.kind === 'supported_line_refutation' ? ['trial'] : []) {
    if (typeof required(value, key) !== 'string') throw new TypeError('Recurrent-series journal key requires a string: ' + key);
  }
  if (value.kind === 'supported_line_refutation' && !Number.isSafeInteger(required(value, 'epoch'))) {
    throw new TypeError('Recurrent-series refutation requires an integer epoch');
  }
  return value;
}

export class RecurrentSeriesMemory {
  // The shared family's historical public projections remain observable. Its
  // restoration witness detects direct edits as well as reducer revisions.
  lineTrials: R = {};
  lineGoals: R[] = [];
  insertSamples: R[] = [];
  insertOrders: R = {};
  insertRejections = new Set<string>();
  insertRefutedEpochs = new Set<number>();
  private events: R[] = [];
  private version = 0;
  get nativeRevision(): number { return this.version; }
  get eventCount(): number { return this.events.length; }
  currentState(): RecurrentSeriesState {
    return structuredClone({ line_trials: this.lineTrials, line_goals: this.lineGoals, insert_samples: this.insertSamples,
      insert_orders: this.insertOrders, insert_rejections: [...this.insertRejections].sort(compareUnicode),
      insert_refuted_epochs: [...this.insertRefutedEpochs].sort((a, b) => a - b) });
  }
  repeatedDigest(): string { return identity([this.lineTrials, this.lineGoals]); }
  retainedDigest(): string {
    return identity([this.repeatedDigest(), this.insertSamples, this.insertOrders,
      [...this.insertRejections].sort(compareUnicode), [...this.insertRefutedEpochs].sort((a, b) => a - b)]);
  }
  state(): R { return structuredClone({ events: this.events, digest: this.retainedDigest() }); }
  restore(state: R): void {
    const rebuilt = new RecurrentSeriesMemory();
    for (const event of required(state, 'events')) rebuilt.applyEvent(event);
    if (rebuilt.retainedDigest() !== required(state, 'digest')) throw new TypeError('Supported-series memory digest changed');
    this.lineTrials = rebuilt.lineTrials; this.lineGoals = rebuilt.lineGoals;
    this.insertSamples = rebuilt.insertSamples; this.insertOrders = rebuilt.insertOrders;
    this.insertRejections = rebuilt.insertRejections; this.insertRefutedEpochs = rebuilt.insertRefutedEpochs;
    this.events = rebuilt.events; this.version++;
  }
  private applyOwned(event: R): void {
    if (event.kind === 'repeated_line_trial') setItem(this.lineTrials, event.trial, event);
    else if (event.kind === 'repeated_line_scored') this.lineGoals.push(event);
    else if (event.kind === 'supported_insertion_observation') this.insertSamples.push(event);
    else if (event.kind === 'supported_insertion_order') setItem(this.insertOrders, event.source, event);
    else { this.insertRejections.add(event.trial); this.insertRefutedEpochs.add(event.epoch); }
    this.events.push(event); this.version++;
  }
  applyEvent(event: R): void { this.applyOwned(ownedEvent(event)); }
  private acquire(events: R[]): R[] {
    const retained = events.map(ownedEvent);
    for (const event of retained) this.applyOwned(event);
    return structuredClone(events);
  }

  /** Source base question, including the first retained matched trial's fixed
   * support set. Completing one field never upgrades that goal hypothesis. */
  lineQuestion(observation: R, rows: NativeRows, inputs: readonly R[]): R | null {
    const fields = recurrentSeriesFields(rows);
    if (fields.length < 2 || !inputs.some(action => required(action, 'action_ref') === 'ACTION6' && truth(action.data))) return null;
    const supports = new Map<string, { color: number; length: number; fields: Set<string> }>();
    const options: { field: RecurrentSeriesField; extension: RecurrentSeriesExtension }[] = [];
    for (const field of fields) for (const extension of recurrentSeriesExtensions(field)) {
      const key = identity([extension.color, extension.length]);
      let support = supports.get(key);
      if (!support) { support = { color: extension.color, length: extension.length, fields: new Set() }; supports.set(key, support); }
      support.fields.add(field.ref); options.push({ field, extension });
    }
    if (!supports.size) return null;
    const trials = Object.values(this.lineTrials) as R[];
    const retained = trials.find(event => equal(required(event, 'epoch'), observation.level_epoch)
      && required(event, 'result') === 'matched' && truth(event.support_fields));
    let color: number, length: number, originalFields: Set<string>, evidenceFields: string[];
    if (retained) {
      color = required(retained, 'palette'); length = required(retained, 'candidate_length') - 1;
      originalFields = new Set(required(retained, 'support_fields'));
      const current = new Set(fields.map(field => field.ref));
      if ([...originalFields].some(ref => !current.has(ref))) return null;
      evidenceFields = retained.support_fields;
    } else {
      const ranked = [...supports.values()].sort((a, b) => b.fields.size - a.fields.size || b.length - a.length), first = ranked[0]!;
      const winners = ranked.filter(value => value.fields.size === first.fields.size && value.length === first.length);
      if (winners.length !== 1 || first.fields.size < 2) return null;
      color = first.color; length = first.length; originalFields = first.fields; evidenceFields = [...originalFields].sort(compareUnicode);
    }
    const accepted = new Set(trials.filter(event => equal(required(event, 'epoch'), observation.level_epoch)
      && required(event, 'result') === 'matched').map(event => required(event, 'field')));
    const candidates: { field: RecurrentSeriesField; extension: RecurrentSeriesExtension; action: R; trial: string; target: number[] }[] = [];
    for (const { field, extension } of options) {
      if (!equal([extension.color, extension.length], [color, length]) || accepted.has(field.ref) || !originalFields.has(field.ref)) continue;
      const { action, target } = address(field, extension.target);
      if (!inputs.some(value => required(value, 'action_ref') === action.action_ref && equal(own(value, 'data'), action.data))) continue;
      const trial = identity([observation.level_epoch, field.ref, extension.target, color, length]);
      if (Object.hasOwn(this.lineTrials, trial)) continue;
      candidates.push({ field, extension, action, trial, target });
    }
    if (!candidates.length) return null;
    const selected = candidates.sort((a, b) => a.field.origin[1] - b.field.origin[1] || a.field.origin[0] - b.field.origin[0]
      || a.extension.target[1] - b.extension.target[1] || a.extension.target[0] - b.extension.target[0])[0]!;
    const { field, action, trial, target } = selected;
    const plan = { epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref,
      frame_digest: identity(rows), trial, field: field.ref, target, size: field.size, expected_palette: color, action,
      observed_length: length, candidate_length: length + 1, support_fields: evidenceFields,
      scope: 'Repeated geometric continuation is a goal hypothesis; pointing may have a different or absent effect. No terminal role is presumed.' };
    const ref = 'C_line_continuation_' + identity(plan).slice(0, 18);
    const why = 'Test a continuation of the same collinear pattern repeated across independent measured fields.';
    const facts = { recurrent_collinear_pattern: true, measured_point_on_support: true }, evidence = [observation.observation_ref, ...plan.support_fields];
    return structuredClone({ status: 'proposed', kind: 'repeated_line_completion', proposal_id: ref, line_plan: plan,
      actions: [action], steps: [{ action, expected_after: { target, palette: color } }], facts,
      compositions: [{ id: ref, observed: false, open_question: why, properties: { pattern_length: length, candidate_length: length + 1 },
        relations: ['contributes_to:G_official_completion'] }],
      question: { reason: 'complete_a_recurrent_geometric_series', hypothesis_refs: evidence }, route_refs: evidence,
      binding: { level_epoch: plan.epoch, observation_ref: plan.observation_ref },
      bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [], actions: [action],
        purpose: why, preconditions: facts, evidence, outcome_guard: { path: ['value'], contains: ref } } });
  }

  propose(observation: R, rows: NativeRows, inputs: readonly R[], _remaining: number, config: RecurrentSeriesConfig,
    options: RecurrentSeriesQuestionOptions = {}): R {
    if (truth(config.repeated_line_completion)) {
      const proposal = this.lineQuestion(observation, rows, inputs);
      if (proposal) return proposal;
    }
    const base = abstained();
    if (!truth(config.prepare_supported_lines)) return base;
    const fields = recurrentSeriesFields(rows);
    if (fields.length !== 1 || !this.lineGoals.length || this.insertRefutedEpochs.has(observation.level_epoch)) return base;
    const field = fields[0]!, layout = recurrentSeriesLayoutKey(field);
    const samples = this.insertSamples.filter(sample => equal(required(sample, 'epoch'), observation.level_epoch)
      && required(sample, 'layout') === layout && truth(own(this.insertOrders, required(sample, 'source'), {}).own_before_response));
    if (new Set(samples.map(sample => identity(required(sample, 'point')))).size < 2
      || new Set(samples.map(sample => identity(required(sample, 'arrived')))).size < 2) return base;
    if (!samples.some(sample => truth(required(sample, 'blocked_goal_extension')))) return base;
    const roles = new Map(samples.map(sample => {
      const tuple = [required(sample, 'own'), required(sample, 'other'), required(sample, 'empty')];
      return [identity(tuple), tuple];
    }));
    if (roles.size !== 1) return base;
    const [ownColor, otherColor, empty] = [...roles.values()][0]!;
    const compatible: Point[] = [];
    for (const axis of [0, 1]) for (const sign of [-1, 1]) {
      if (samples.every(sample => containsPoint(lineInsertions(required(sample, 'board'), empty, axis, sign), required(sample, 'arrived'))
        && equal(sample.point[1 - axis], sample.arrived[1 - axis])
        && containsPoint(lineInsertions(linePlace(sample.board, sample.arrived, ownColor), empty, axis, sign), required(sample, 'response')))) compatible.push([axis, sign]);
    }
    if (compatible.length !== 1) return base;
    const [axis, sign] = compatible[0]!, goal = this.lineGoals.at(-1)!, length = required(goal, 'candidate_length');
    let ranked: R[], search: R;
    try {
      [ranked, search] = searchLines(field.grid, ownColor, otherColor, empty, length, axis, sign, required(config, 'supported_line_reply_plies'),
        options.nativeBounds ? { maxNodes: options.maxNodes ?? RECURRENT_SERIES_NATIVE_SEARCH_BOUNDS.maxNodes,
          deadlineMs: options.deadlineMs, now: options.now } : {});
    } catch (error) {
      if (error instanceof NativeLineSearchWorkBoundError) {
        return { status: 'unknown', reason: 'supported_line_search_work_bound', block_unrelated_probe: true,
          exhausted_bound: error.bound, frontier: { complete: false, nodes: error.nodes,
            max_nodes: options.maxNodes ?? RECURRENT_SERIES_NATIVE_SEARCH_BOUNDS.maxNodes,
            deadline_ms: options.deadlineMs ?? null,
            scope: 'Unfinished finite-horizon line hypothesis, not a refutation or an acquired opponent policy.' } };
      }
      if (options.nativeBounds && error instanceof NativeLineSearchDomainError) {
        return { status: 'unknown', reason: 'supported_line_native_integer_domain', block_unrelated_probe: true,
          frontier: { complete: false, scope: 'Conditional search exceeds the native exact-integer domain; no outcome is acquired.' } };
      }
      throw error;
    }
    const available = new Set(inputs.map(action => identity(action)));
    let choice: { selected: R; action: R; trial: string; target: number[] } | null = null;
    for (const selected of ranked) {
      const { action, target } = address(field, selected.point), trial = identity([observation.level_epoch, field.grid, action]);
      if (available.has(identity(action)) && !this.insertRejections.has(trial)) { choice = { selected, action, trial, target }; break; }
    }
    if (choice === null) return base;
    const { selected, action, trial, target } = choice;
    const plan = { epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref,
      frame_digest: identity(rows), trial, target, size: field.size, expected_palette: ownColor, response_palette: otherColor, empty_palette: empty,
      action, support_axis: axis, support_sign: sign, goal_length: length, layout, ranked, search, selected,
      scope: 'Prepare a scored geometric line under a current-epoch measured insertion candidate; opponent policy and symmetric adverse goal are hypotheses, not universal causal knowledge.' };
    const ref = 'C_supported_line_' + identity(plan).slice(0, 18);
    const why = 'Prepare an accessible contribution to the scored geometric line while considering all compatible immediate counter-placements and their supports.';
    const evidence = [observation.observation_ref, required(goal, 'source'), ...samples.map(sample => sample.source)];
    const facts = { scored_line_witness_recalled: true, current_insertion_revalidated: true, persistent_response_order_observed: true,
      goal_extension_actually_blocked: true, point_on_measured_field: true };
    return structuredClone({ status: 'proposed', kind: 'supported_line_preparation', proposal_id: ref, supported_line_plan: plan,
      actions: [action], steps: [{ action, expected_after: { target, palette: ownColor, other_effect: 'one compatible counter-placement or official boundary' } }],
      facts, compositions: [{ id: ref, observed: false, open_question: why,
        properties: { goal_length: length, selected_contribution: selected, search_scope: search.scope }, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: 'prepare_a_supported_geometric_goal_under_response', hypothesis_refs: evidence }, route_refs: evidence,
      binding: { level_epoch: plan.epoch, observation_ref: plan.observation_ref },
      bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [], actions: [action],
        purpose: why, preconditions: facts, evidence, outcome_guard: { path: ['value'], contains: ref } } });
  }

  /** The repeated trial and optional score are acquired before supported-line
   * evidence. Passive additions also run for returns from other proposals. A
   * new scored witness is visible to that acquisition within this same return. */
  record(before: R, command: R, after: R, rows: NativeRows, later: NativeRows, proposal: R, index: number,
    options: RecurrentSeriesRecordOptions = {}): R[] {
    const extra: R[] = [], line = proposal.line_plan, supported = proposal.supported_line_plan;
    const check = options.after ?? recurrentSeriesAfter;
    const meta = { epoch: after.level_epoch, score: after.levels_completed, state: after.state };
    let latestGoal = this.lineGoals.at(-1);
    if (truth(line)) {
      const outcome = check(proposal, index, rows, later, meta);
      extra.push({ kind: 'repeated_line_trial', epoch: before.level_epoch, trial: required(line, 'trial'), field: required(line, 'field'),
        result: outcome.matched === null ? 'boundary' : truth(outcome.matched) ? 'matched' : 'refuted',
        before: before.observation_ref, after: after.observation_ref, candidate_length: required(line, 'candidate_length'),
        palette: required(line, 'expected_palette'), support_fields: required(line, 'support_fields'), action: command });
      if (after.levels_completed > before.levels_completed) {
        latestGoal = { kind: 'repeated_line_scored', epoch: before.level_epoch, candidate_length: line.candidate_length,
          palette: line.expected_palette, source: after.observation_ref,
          scope: 'Scored completion witness; current-level visual and input applicability must be rediscovered.' };
        extra.push(latestGoal);
      }
    }
    if (truth(supported)) {
      const outcome = check(proposal, index, rows, later, meta);
      if (outcome.matched === false) extra.push({ kind: 'supported_line_refutation', epoch: before.level_epoch,
        trial: required(supported, 'trial'), source: after.observation_ref, reason: required(outcome, 'reason') });
    }
    if (latestGoal !== undefined && required(command, 'action_ref') === 'ACTION6' && equal(before.level_epoch, after.level_epoch)) {
      const first = recurrentSeriesFields(rows), last = recurrentSeriesFields(later);
      if (first.length === 1 && last.length === 1 && recurrentSeriesLayoutKey(first[0]!) === recurrentSeriesLayoutKey(last[0]!)) {
        const f = first[0]!, g = last[0]!, ownColor = required(latestGoal, 'palette'), empty = f.empty_hypothesis, changed = changes(f, g);
        const placed = changed.filter(([, , from, to]) => equal(from, empty) && equal(to, ownColor));
        const reply = changed.filter(([, , from, to]) => equal(from, empty) && ![ownColor, empty, null].some(value => equal(value, to)));
        if (placed.length === 1 && reply.length === 1 && changed.length === 2) {
          const data = own(command, 'data', {}), ix = Math.floor((own(data, 'x', -1) - f.origin[0]) / f.pitch[0]),
            iy = Math.floor((own(data, 'y', -1) - f.origin[1]) / f.pitch[1]);
          if (ix >= 0 && ix < f.shape[0] && iy >= 0 && iy < f.shape[1]) {
            const arrived = placed[0]!.slice(0, 2) as number[], response = reply[0]!.slice(0, 2) as number[];
            const prepared = linePlace(f.grid, arrived, ownColor);
            const blocked = lineWindows(prepared, required(latestGoal, 'candidate_length')).some(window => containsPoint(window, response)
              && window.every(([x, y]) => equal([x, y], response) || equal(prepared[y]![x], ownColor)));
            const { grid: _grid, ...measured } = f;
            extra.push({ kind: 'supported_insertion_observation', epoch: before.level_epoch, source: before.observation_ref,
              after: after.observation_ref, layout: recurrentSeriesLayoutKey(f), field: measured, board: f.grid, blocked_goal_extension: blocked,
              own: ownColor, other: reply[0]![3], empty, point: [ix, iy], arrived, response,
              scope: 'Two stable additions; actor/order and support law require separate compatibility checks.' });
          }
        }
      }
    }
    return this.acquire(extra);
  }

  recordPacket(before: R, _command: R, _after: R, _rows: NativeRows, packet: readonly NativeRows[], _episode: readonly R[] = []): R[] {
    const sample = [...this.insertSamples].reverse().find(value => required(value, 'source') === before.observation_ref);
    if (!sample || !packet.length) return [];
    const field = required(sample, 'field');
    const stableStart = (point: readonly number[], color: unknown): number => {
      const target = [field.origin[0] + point[0]! * field.pitch[0], field.origin[1] + point[1]! * field.pitch[1]];
      let first = packet.length;
      for (let i = packet.length - 1; i >= 0; i--) {
        if (patchMatches(packet[i]!, target, field.size, color)) first = i;
        else break;
      }
      return first;
    };
    const ownStart = stableStart(required(sample, 'arrived'), required(sample, 'own'));
    const responseStart = stableStart(required(sample, 'response'), required(sample, 'other'));
    return this.acquire([{ kind: 'supported_insertion_order', epoch: before.level_epoch, source: before.observation_ref,
      own_stable_from: ownStart, response_stable_from: responseStart, packet_frames: packet.length,
      own_before_response: ownStart < responseStart && responseStart < packet.length,
      scope: 'Order of persistent public patches within the returned packet, not private turn state.' }]);
  }
}

/** Source SupportedLineConstraint transport: measured cell candidates are
 * independent of the common bounded exploratory sampler. Only the additional
 * native search bounds can interrupt an otherwise applicable source question. */
export async function proposeRecurrentSeriesCommon(memory: RecurrentSeriesMemory, observation: R, rows: NativeRows,
  inputs: readonly R[], remaining: number, config: RecurrentSeriesConfig, deadlineMs: number | null = null,
  now: Clock = () => performance.now(), bounds: RecurrentSeriesSearchBounds = {}): Promise<R | null> {
  if (remaining < 1) return null;
  const proposal = memory.propose(observation, rows, [...inputs, ...recurrentSeriesPointedCandidates(rows, observation.available_action_refs)], remaining,
    { repeated_line_completion: true, prepare_supported_lines: required(config, 'prepare_supported_lines'),
      supported_line_reply_plies: required(config, 'supported_line_reply_plies') },
    { ...bounds, nativeBounds: true, deadlineMs, now });
  if (proposal.status === 'unknown') return proposal;
  if (proposal.status !== 'proposed') return null;
  proposal.steps[0].expected_before = { level_epoch: observation.level_epoch, frame_hash: observation.frame_hash,
    levels_completed: observation.levels_completed, state: observation.state };
  const action = proposal.actions[0], x = action.data.x, y = action.data.y, plan = truth(proposal.line_plan) ? proposal.line_plan : proposal.supported_line_plan;
  const [w, h] = plan.size, [left, top] = plan.target, field = own(plan, 'field', own(plan, 'layout'));
  proposal.point_support = { observation_ref: observation.observation_ref, level_epoch: observation.level_epoch, frame_hash: observation.frame_hash,
    point: [x, y], palette_value: pixel(rows, x, y), bbox: [left, top, left + w - 1, top + h - 1],
    entity_ref: 'measured-lattice-cell:' + plan.trial, signature: identity([field, plan.target, plan.size]),
    provenance: 'uniform cell measured between repeated public separators; not a connected-component identity',
    field_ref: field, full_raster_digest: plan.frame_digest };
  return proposal;
}

export function bindRecurrentSeries(proposal: R, domain: ObservedInputDomain): void {
  const support = required(proposal, 'point_support');
  if (!domain.bindings.has(`${support.level_epoch}:${support.frame_hash}`)) throw new TypeError('Current public point domain has not been observed');
  if (proposal.actions.length !== 1 || !equal(support.point, [proposal.actions[0].data.x, proposal.actions[0].data.y])) {
    throw new TypeError('Measured cell address changed');
  }
  proposal.steps[0].point_binding = { ...support, scope: 'one composition-derived measured cell, full-raster guarded; not an enumerated exploratory sample' };
}
