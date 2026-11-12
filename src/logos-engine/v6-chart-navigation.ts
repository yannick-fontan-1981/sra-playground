/** Pinned V6 ChartNavigation. Chart geometry, possible room locations and
 * peripheral inventory remain separate observations. A local permission
 * hypothesis never establishes a general transaction law or goal completion.
 */
import { ChartPolicy } from './v6-chart-navigation-policy.ts';
import { measureChart, chartInventory, chartScene, decodeChart, routeChart,
  chartDigest, chartPointKey, chartEdgeKey } from './v6-chart-navigation-geometry.ts';
import { pythonEqual as equal, pythonTruthy as truthy } from './v6-operations.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { isJsonObject } from './canonical.ts';
import type { NativeAfterResult, NativeBeforeResult, NativeCommand, NativeExecution, NativeFamily, NativeObservation,
  NativeProgramRegistry, NativeProposal, NativePublicObservation, NativeRecord, NativeRecordResult, NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
const FIELDS = ['epoch', 'chart', 'position', 'positions', 'position_status', 'visited', 'grants', 'gains',
  'views', 'blocked', 'evidence', 'portable', 'last', 'method_use'] as const;
const FORMAT = 'native.public_chart_navigation.v1';
const copy = <T>(value: T): T => structuredClone(value);
const isPoint = (value: unknown): value is number[] => Array.isArray(value) && value.length === 2 && value.every(Number.isSafeInteger);
const isPixelPoint = (value: unknown): value is number[] => isPoint(value) && value.every(coordinate => coordinate >= 0);
const includesPoint = (points: readonly number[][], point: unknown): boolean => points.some(candidate => equal(candidate, point));

function isRectangle(value: unknown): boolean {
  if (!isJsonObject(value)) return false;
  const rectangle = value as R, box = rectangle.bbox;
  return isPixelPoint(rectangle.center) && Array.isArray(box) && box.length === 4
    && box.every(coordinate => Number.isSafeInteger(coordinate) && coordinate >= 0)
    && Number.isSafeInteger(rectangle.size) && rectangle.size > 0 && rectangle.size % 2 === 1
    && box[2] - box[0] + 1 === rectangle.size && box[3] - box[1] + 1 === rectangle.size
    && rectangle.center[0] === box[0] + Math.floor(rectangle.size / 2)
    && rectangle.center[1] === box[1] + Math.floor(rectangle.size / 2)
    && ['edge', 'corner', 'center_value'].every(key => Number.isSafeInteger(rectangle[key]))
    && (rectangle.inside === null || Number.isSafeInteger(rectangle.inside));
}

/** Validate the shapes actually consumed after restoration. No node, link,
 * location or history cap is added, and an explicit link may be absent.
 * The native boundary also accepts a chart captured before optional decode
 * decoration; the current raster is still revalidated by the source guard.
 */
function isChart(value: unknown): boolean {
  if (!isJsonObject(value)) return false;
  const chart = value as R;
  if (!Array.isArray(chart.nodes) || !chart.nodes.length || !chart.nodes.every(isRectangle)
    || !Array.isArray(chart.slots) || !chart.slots.length || !chart.slots.every(isRectangle)
    || !Array.isArray(chart.links) || !isPoint(chart.current) || !isPoint(chart.origin)
    || !Number.isSafeInteger(chart.pitch) || chart.pitch <= 0
    || !Number.isSafeInteger(chart.goal_annotation_hypothesis) || !Number.isSafeInteger(chart.slot_background)
    || !Number.isSafeInteger(chart.field_bottom) || chart.field_bottom < 0 || !Number.isSafeInteger(chart.epoch)
    || !Array.isArray(chart.evidence) || !chart.evidence.length || !chart.evidence.every((ref: unknown) => typeof ref === 'string')
    || Object.hasOwn(chart, 'initial_scene_hash') && typeof chart.initial_scene_hash !== 'string'
    || Object.hasOwn(chart, 'decoded') && !isJsonObject(chart.decoded)) return false;
  const nodes = new Set<string>((chart.nodes as R[]).map(node => chartPointKey(node.center)));
  return nodes.has(chartPointKey(chart.current)) && nodes.has(chartPointKey(chart.origin))
    && chart.slots.every((slot: R) => slot.bbox[1] >= chart.field_bottom)
    && chart.slots.some((slot: R) => slot.bbox[1] === chart.field_bottom)
    && chart.nodes.every((node: R) => node.bbox[3] < chart.field_bottom)
    && chart.links.every((value: unknown) => {
      if (!isJsonObject(value)) return false;
      const edge = value as R;
      return isPoint(edge.from) && isPoint(edge.to) && isPoint(edge.delta) && Math.abs(edge.delta[0]!) + Math.abs(edge.delta[1]!) === 1
        && Number.isSafeInteger(edge.annotation) && nodes.has(chartPointKey(edge.from)) && nodes.has(chartPointKey(edge.to))
        && edge.to[0]! - edge.from[0]! === edge.delta[0]! * chart.pitch
        && edge.to[1]! - edge.from[1]! === edge.delta[1]! * chart.pitch;
    });
}

function isViews(value: unknown): boolean {
  return isJsonObject(value) && Object.values(value).every(location => isJsonObject(location)
    && Object.values(location).every(view => isJsonObject(view) && Array.isArray(view.pixels)
      && view.pixels.every(isPixelPoint) && typeof view.observation_ref === 'string' && typeof view.edge === 'string'));
}

function validateState(value: R): R {
  const state = retainNativeJson(value);
  if (Object.keys(state).length !== FIELDS.length || FIELDS.some(key => !Object.hasOwn(state, key))
    || state.epoch !== null && !Number.isSafeInteger(state.epoch)
    || state.chart !== null && !isChart(state.chart)
    || ['last', 'method_use'].some(key => state[key] !== null && !isJsonObject(state[key]))
    || state.position !== null && !isPoint(state.position)
    || ['positions', 'visited'].some(key => !Array.isArray(state[key]) || !state[key].every(isPoint))
    || state.position_status !== null && typeof state.position_status !== 'string'
    || ['grants', 'gains', 'portable'].some(key => !Array.isArray(state[key]) || !state[key].every(isJsonObject))
    || ['blocked', 'evidence'].some(key => !Array.isArray(state[key]) || !state[key].every((item: unknown) => typeof item === 'string'))
    || !isViews(state.views)) {
    throw new TypeError('Incompatible chart-navigation source state');
  }
  return state;
}

/** Native identity is typed JSON identity; Python equality belongs only to
 * source algorithms. All mutable fields are scanned before checkpoint reuse.
 */
function sameState(left: any, right: any): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object'
    || Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left)) return left.length === right.length && left.every((value, index) => sameState(value, right[index]));
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length
    && keys.every(key => Object.hasOwn(right, key) && sameState(left[key], right[key]));
}

function uniqueSortedPoints(points: readonly number[][]): number[][] {
  const unique = new Map<string, number[]>();
  for (const point of points) if (!unique.has(chartPointKey(point))) unique.set(chartPointKey(point), [...point]);
  return [...unique.values()].sort((left, right) => left[0]! - right[0]! || left[1]! - right[1]!);
}

export class ChartNavigation implements NativeFamily<any> {
  readonly id = 'public_chart_navigation';
  readonly policy: ChartPolicy;
  epoch: number | null = null;
  chart: R | null = null;
  position: number[] | null = null;
  positions: number[][] = [];
  position_status: string | null = null;
  visited: number[][] = [];
  grants: R[] = [];
  gains: R[] = [];
  views: R = {};
  blocked: string[] = [];
  evidence: string[] = [];
  portable: R[] = [];
  last: R | null = null;
  method_use: R | null = null;
  private checkpoint: R | null = null;
  private revision = 0;
  private refusal: R | null = null;

  private constructor(policy: ChartPolicy) { this.policy = policy; }
  static async create(): Promise<ChartNavigation> { return new ChartNavigation(await ChartPolicy.create()); }
  async attachPrograms(registry: NativeProgramRegistry): Promise<void> { await this.policy.attachPrograms(registry); }
  private sourceView(): R { return Object.fromEntries(FIELDS.map(key => [key, this[key]])); }
  get nativeRevision(): number { this.nativeState(); return this.revision; }
  state(): R { return copy(this.sourceView()); }
  sourceState(): R { return this.state(); }
  /** Original common caller's reasoning-fact predicate, separate from the
   * complete native checkpoint, which also retains last/positions alone.
   */
  sourceStateShouldPersist(): boolean { return truthy(this.chart) || this.portable.length > 0; }
  nativeState(): NativeRecord {
    const source = validateState(this.sourceView());
    if (this.checkpoint && sameState(this.checkpoint.source_state, source)) return this.checkpoint;
    this.checkpoint = retainNativeJson({ format: FORMAT, source_state: source }); this.revision++; return this.checkpoint;
  }
  restore(value: NativeRecord): void {
    const supplied = retainNativeJson(value);
    if (!isJsonObject(supplied)) throw new TypeError('Chart-navigation restore requires a source state mapping');
    const next = validateState({ ...this.sourceView(),
      ...Object.fromEntries(FIELDS.filter(key => Object.hasOwn(supplied, key)).map(key => [key, supplied[key]])) });
    for (const key of FIELDS) (this as unknown as R)[key] = copy(next[key]);
    this.refusal = null;
  }
  restoreNative(value: Readonly<NativeRecord>): void {
    if (value === this.checkpoint) {
      let current: R | null = null;
      try { current = validateState(this.sourceView()); }
      catch (error) { if (!(error instanceof TypeError)) throw error; }
      if (current && sameState(current, this.checkpoint!.source_state)) { this.refusal = null; return; }
    }
    const supplied = retainNativeJson(value);
    if (!isJsonObject(supplied) || supplied.format !== FORMAT || Object.keys(supplied).length !== 2 || !isJsonObject(supplied.source_state)) {
      throw new TypeError('Invalid native chart-navigation checkpoint');
    }
    const next = validateState(supplied.source_state), changed = !this.checkpoint || !sameState(this.checkpoint.source_state, next);
    for (const key of FIELDS) (this as unknown as R)[key] = copy(next[key]);
    this.checkpoint = supplied; if (changed) this.revision++; this.refusal = null;
  }
  scope(obs: R): void {
    if (equal(this.epoch, obs.level_epoch)) return;
    if (this.chart && this.evidence.length) this.portable.push({ source_epoch: this.epoch,
      signature: this.signature(this.chart), evidence: this.evidence,
      authority: 'tested_chart_interpretation_not_current_room_or_permit' });
    this.epoch = obs.level_epoch; this.chart = null; this.position = null; this.positions = []; this.position_status = null;
    this.visited = []; this.grants = []; this.gains = []; this.views = {}; this.blocked = []; this.evidence = [];
    this.last = null; this.method_use = null;
  }
  signature(chart: R): R { return { node_size: chart.nodes[0].size, corners_separate: true, slot_size: chart.slots[0].size }; }
  current(obs: NativeObservation, rows: NativeRows): R | null {
    this.scope(obs); const fresh: R | null = measureChart(rows, obs);
    if (fresh) {
      if (this.chart && !equal(fresh.nodes.map((node: R) => [node.center, node.inside]),
        this.chart.nodes.map((node: R) => [node.center, node.inside]))) {
        this.visited = []; this.grants = []; this.gains = []; this.views = {}; this.blocked = [];
      }
      fresh.initial_scene_hash = chartScene(rows, fresh); this.chart = fresh; this.position = fresh.current;
      this.positions = [fresh.current]; this.position_status = 'current_corner_anchor_hypothesis';
      this.chart.decoded = decodeChart(fresh, obs);
      const method = [...this.portable].reverse().find(candidate => equal(candidate.signature, this.signature(fresh)));
      this.method_use = method ? { method, current_ref: obs.observation_ref, current_signature: this.signature(fresh),
        status: 'current_morphology_revalidated_not_world_state' } : null;
    }
    return this.chart;
  }
  offers(obs: NativeObservation, rows: NativeRows): R[] {
    const chart = this.current(obs, rows);
    if (!chart || !this.positions.length) return [];
    const config = this.policy.config;
    if (config.semantics.goal !== 'same_interior_annotation_as_current_anchor'
      || config.semantics.dependency !== 'node_annotation_matches_link_annotation') return [];
    const goals = (chart.nodes as R[]).filter(node => !equal(node.center, chart.origin) && equal(node.inside, chart.goal_annotation_hypothesis));
    if (goals.length !== 1) return [];
    const held = chartInventory(rows, chart), colors = (chart.links as R[]).map(edge => edge.annotation),
      dependencies = (chart.nodes as R[]).filter(node => node.inside !== null && colors.some(color => equal(color, node.inside))
        && !equal(node.inside, chart.goal_annotation_hypothesis)), out: R[] = [];
    const targets: [string, R][] = [
      ...dependencies.filter(node => !includesPoint(this.visited, node.center)).map(node => ['annotation_dependency', node] as [string, R]),
      ['homologous_marker', goals[0]!],
    ];
    for (const [kind, target] of targets) {
      const excluded = new Set<string>((chart.nodes as R[]).filter(node => node.inside !== null
        && ![chart.origin, this.position, target.center].some(point => equal(point, node.center))
        && !includesPoint(this.visited, node.center) && !equal(node.inside, chart.goal_annotation_hypothesis))
        .map(node => chartPointKey(node.center))), blocked = [...this.blocked];
      for (const edge of chart.links as R[]) {
        if (dependencies.some(node => equal(node.inside, edge.annotation)) && !held.some(value => equal(value, edge.annotation))
          && !this.grants.some(grant => grant.edge === chartEdgeKey(edge))) blocked.push(chartEdgeKey(edge));
      }
      const paths = this.positions.map(origin => routeChart(chart, origin, target.center, excluded, blocked));
      if (!paths.length || paths.some(path => !path?.length) || this.positions.length > config.max_location_alternatives) continue;
      const routes = paths as R[][];
      if (!routes.every(path => equal(path[0]!.delta, routes[0]![0]!.delta))) continue;
      let path = routes[0]!;
      for (const alternative of routes) if (alternative.length > path.length) path = alternative;
      const priors = (config.directions as R[]).filter(direction => equal(direction.delta, path[0]!.delta)
        && obs.available_action_refs.includes(direction.action));
      if (priors.length !== 1) continue;
      out.push({ kind, facts: { current_scope: equal(chart.epoch, obs.level_epoch), conditional_route_nonempty: true,
        common_action_for_locations: true }, action: priors[0]!.action, distance: path.length, route: path,
        route_alternatives: routes, target, held, position: this.position, location_alternatives: this.positions,
        position_status: this.position_status, chart_ref: chart.evidence[0], method_use: this.method_use, unknown: [
          'chart_direction_control_until_observed', 'room_correspondence_beyond_anchor', 'moved_or_stayed_when_scene_equal',
          'inventory_entry_effect', 'permission_transaction', 'goal_role',
        ] });
    }
    return out;
  }
  /** Native scheduling checks are invocation-local. They create no source
   * evidence, no graph refutation and no additional source search limit.
   */
  private executionAllowed(obs: NativeObservation, execution: NativeExecution | undefined, phase: string): boolean {
    if (!execution) return true;
    const reason = execution.signal?.aborted ? 'native_abort'
      : execution.deadlineMs !== undefined && (execution.now?.() ?? performance.now()) >= execution.deadlineMs ? 'native_deadline' : null;
    if (reason === null) return true;
    this.refusal = { status: 'chart_navigation_search_incomplete', observation_ref: obs.observation_ref,
      level_epoch: obs.level_epoch, frame_hash: obs.frame_hash, release_authority: false, domain_complete: false,
      status_is_not_an_acquired_refutation: true,
      native_search_incomplete: { reason, frontier: { phase } } };
    return false;
  }
  private async proposeChecked(obs: NativeObservation, rows: NativeRows, remaining: number,
    execution?: NativeExecution): Promise<NativeProposal | null> {
    this.refusal = null;
    if (!this.executionAllowed(obs, execution, 'before_measurement') || remaining < 1) return null;
    const offers = this.offers(obs, rows); if (!offers.length) return null;
    if (!this.executionAllowed(obs, execution, 'before_source_selection')) return null;
    const [choice, workflow] = await this.policy.choose(offers);
    if (!this.executionAllowed(obs, execution, 'source_selection_completed') || choice.status !== 'selected') return null;
    const offer = offers[choice.index]!, action: any = { action_ref: offer.action },
      focus = 'composition:charted:' + chartDigest([obs.level_epoch, offer.target.center, offer.kind]),
      evidence = [obs.observation_ref, offer.chart_ref, ...this.evidence], facts = { chart_question_current: true };
    return { status: 'proposed', kind: this.id, actions: [action], steps: [{ action, expected_after: null }], facts,
      binding: Object.fromEntries(['observation_ref', 'level_epoch', 'frame_hash', 'levels_completed'].map(key => [key, obs[key]])),
      chart_plan: { offer, choice, workflow, drm_hash: this.policy.loaded.source_hash },
      compositions: [{ id: focus, role: 'conditional_chart_access', observed: false,
        things: ['chart-node:' + chartDigest(offer.target.center)], properties: offer,
        relations: ['contributes_to:' + this.policy.config.goal], open_question: choice.reason }],
      question: { reason: choice.reason, hypothesis_refs: choice.hypotheses }, route_refs: evidence,
      bundle_template: { operation_key: 'OP18', composition_ref: focus, objective_ref: this.policy.config.goal,
        purpose: choice.reason, preconditions: facts, evidence, actions: [action], preserve_refs: [], preservation_evidence: {},
        outcome_guard: { path: ['value'], contains: focus } } };
  }
  async proposeSource(obs: NativeObservation, rows: NativeRows, _inputs: readonly NativeCommand[], remaining: number): Promise<NativeProposal | null> {
    return this.proposeChecked(obs, rows, remaining);
  }
  async propose(obs: NativeObservation, rows: NativeRows, _inputs: readonly NativeCommand[], remaining: number,
    execution?: NativeExecution): Promise<NativeProposal | null> {
    return this.proposeChecked(obs, rows, remaining, execution);
  }
  async proposeInSubquestion(group: string, question: string, obs: NativeObservation, rows: NativeRows,
    inputs: readonly NativeCommand[], remaining: number, execution?: NativeExecution): Promise<NativeProposal | null> {
    if (group !== 'factored_material_return' || question !== 'chart_navigation') throw new TypeError('Unknown chart-navigation source entry');
    const proposal = await this.propose(obs, rows, inputs, remaining, execution);
    if (proposal) proposal.material_access_subquestion = question; return proposal;
  }
  currentProposalRefusal(obs: NativeObservation): NativeRecord | null {
    return this.refusal && ['observation_ref', 'level_epoch', 'frame_hash'].every(key => equal(this.refusal![key], obs[key]))
      ? copy(this.refusal) : null;
  }
  bind(proposal: R, _preserve?: unknown): void {
    if (proposal.actions.length !== 1 || !equal(proposal.actions, proposal.steps.map((step: R) => step.action ?? null))) {
      throw new TypeError('chart actionset mismatch');
    }
  }
  before(proposal: R, index: number, publicPacket: NativePublicObservation, obs: NativeObservation): NativeBeforeResult {
    this.bind(proposal);
    if (index !== 0 || ['observation_ref', 'level_epoch', 'frame_hash'].some(key => !equal(obs[key], proposal.binding[key]))) {
      return { admitted: false, reason: 'scope_changed' };
    }
    const offer = proposal.chart_plan.offer, matches = this.offers(obs, publicPacket.frame_rows).filter(candidate =>
      ['kind', 'route', 'location_alternatives', 'route_alternatives', 'held', 'action'].every(key => equal(candidate[key], offer[key])));
    return { admitted: matches.length === 1 && equal(proposal.actions, [{ action_ref: offer.action }]),
      reason: 'current_anchor_or_scoped_transition_hypothesis_and_route_revalidated' };
  }
  after(_proposal: R, _index: number, _before: NativeObservation, _after: NativeObservation,
    _first: NativeRows, _second: NativeRows): NativeAfterResult & R {
    return { matched: null, preservation_matched: null, seal_prefix: true, reason: 'new_room_and_inventory_effect_unknown' };
  }
  returnedView(chart: R, edge: R, value: number, frames: readonly NativeRows[] | null,
    second: NativeRows, after: NativeObservation): R | null {
    const [dx, dy] = edge.delta, width = second[0]!.length, height = chart.field_bottom, thickness = 2 * chart.nodes[0].size;
    const inBoundary = (x: number, y: number): boolean => dx > 0 ? x >= width - thickness : dx < 0 ? x < thickness
      : dy > 0 ? y >= height - thickness : y < thickness;
    frameLoop: for (const [ordinal, frame] of (frames ?? []).entries()) {
      if (frame.length !== second.length || frame.some((row, index) => row.length !== second[index]!.length)) continue;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        if (!inBoundary(x, y) && !equal(frame[y]![x], second[y]![x])) continue frameLoop;
      }
      const pixels: number[][] = [];
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        if (inBoundary(x, y) && equal(frame[y]![x], value)) pixels.push([x, y]);
      }
      if (pixels.length && pixels.every(([x, y]) => !equal(second[y!]![x!], value))) {
        return { pixels, observation_ref: after.observation_ref + ':returned-frame:' + ordinal + ':' + chartDigest(frame),
          edge: (edge.from == null ? 'None' : chartPointKey(edge.from)) + '>'
            + (edge.to == null ? 'None' : chartPointKey(edge.to)),
          frame_ordinal: ordinal, outside_boundary_equal_to_canonical: true };
      }
    }
    return null;
  }
  recordSource(before: NativeObservation, after: NativeObservation, _command: R, first: NativeRows, second: NativeRows,
    proposal: R | null = null, _index = 0, frames: readonly NativeRows[] | null = null): R | null {
    this.refusal = null; this.scope(before);
    if (!this.chart) return null;
    if (!equal(before.level_epoch, after.level_epoch)) {
      const delta = after.levels_completed - before.levels_completed,
        result = { status: delta > 0 ? 'official_boundary_return' : 'new_scope_uninterpreted', events: [], actual_score_delta: delta,
          evidence: [before.observation_ref, after.observation_ref], old_scene_effect: 'unknown_without_identified_old_scope_frame',
          new_epoch_pixels_not_old_scope_evidence: true, parent_goal_unchanged: true };
      this.evidence.push(...result.evidence); this.scope(after); return result;
    }
    const chart = this.chart, prior = chartInventory(first, chart), now = chartInventory(second, chart),
      gain = now.filter(value => !prior.some(previous => equal(previous, value))),
      lost = prior.filter(value => !now.some(current => equal(current, value))),
      changed = chartScene(first, chart) !== chartScene(second, chart), events: any[] = [],
      relevant = proposal !== null && Object.hasOwn(proposal, 'chart_plan');
    if (!relevant && changed) {
      this.position = null; this.positions = []; this.position_status = 'unknown_after_unattributed_scene_change';
      const result = { status: 'chart_position_withdrawn', events: ['unattributed_scene_change_requires_current_anchor'],
        evidence: [before.observation_ref, after.observation_ref], chart_and_prior_evidence_preserved: true };
      this.last = result; return result;
    }
    if (relevant) {
      const offer = proposal!.chart_plan.offer,
        destinations = (offer.route_alternatives as R[][]).map(path => path[0]!.to),
        alternatives = changed ? destinations : [...offer.location_alternatives, ...destinations];
      this.positions = uniqueSortedPoints(alternatives); this.position = this.positions.length === 1 ? this.positions[0]! : null;
      this.position_status = this.positions.length === 1 ? 'conditional_arrival_scene_changed_not_unique_world_proof'
        : 'indistinguishable_scene_location_alternatives';
      events.push(changed ? 'scene_change_after_direction' : 'scene_equal_retains_stay_and_arrival_alternatives');
      const returned: R | null = measureChart(second, after), initialReturn = chartScene(second, chart) === (chart.initial_scene_hash ?? null),
        contradiction = returned !== null && !includesPoint(this.positions, returned.current);
      if (contradiction) {
        this.position = returned!.current; this.positions = [returned!.current]; this.position_status = 'current_anchor_refutes_predicted_arrival';
        this.visited = []; this.grants = []; events.push('predicted_arrival_refuted_by_current_anchor');
      }
      let contextBound = changed;
      if (!contradiction && !initialReturn && this.positions.length > 1 && lost.length === 1
        && this.policy.config.conditional_boundary_anchor === 'match_explicit_link_annotation') {
        const value = lost[0]!, observed: { delta: number[]; view: R }[] = [];
        for (const direction of this.policy.config.directions as R[]) {
          const view = this.returnedView(chart, { delta: direction.delta }, value, frames, second, after);
          if (view) observed.push({ delta: direction.delta, view });
        }
        if (observed.length === 1) {
          const { delta, view } = observed[0]!, matches: number[][] = [], unknown: number[][] = [], refuted: R[] = [];
          for (const location of this.positions) {
            const links = (chart.links as R[]).filter(edge => equal(edge.from, location) && equal(edge.delta, delta));
            if (links.length !== 1) unknown.push(location);
            else if (equal(links[0]!.annotation, value)) matches.push(location);
            else refuted.push({ location, explicit_link_annotation: links[0]!.annotation, observed_boundary_annotation: value });
          }
          if (matches.length === 1 && !unknown.length) {
            this.positions = matches; this.position = matches[0]!; this.position_status = 'conditional_current_boundary_annotation_anchor';
            contextBound = true; events.push({ conditional_boundary_anchor: { retained: matches,
              refuted_under_chart_hypothesis: refuted, evidence: view.observation_ref, not_universal_room_identity: true } });
          }
        }
      }
      for (const value of gain) {
        const occurrence = this.positions.length === 1
          ? (chart.nodes as R[]).find(node => equal(node.center, this.position) && equal(node.inside, value)) : undefined,
          receipt = { value, current_occurrence: occurrence ? occurrence.center : null,
            evidence: [before.observation_ref, after.observation_ref], status: 'peripheral_gain_observed_ownership_role_hypothetical' };
        this.gains.push(receipt);
        if (occurrence && changed && !contradiction && this.positions.length === 1) this.visited.push(occurrence.center);
        events.push({ peripheral_value_gained: receipt });
      }
      for (const value of lost) {
        events.push({ peripheral_value_lost: value, evidence: [before.observation_ref, after.observation_ref],
          interpretation: 'unexplained_until_local_context_bound', quantity_unknown: true });
        const candidates = (chart.links as R[]).filter(edge => equal(edge.from, this.position) && equal(edge.annotation, value)),
          priorView = this.views[this.position === null ? 'None' : chartPointKey(this.position)] ?? {};
        let view: R | null = priorView[String(value)] ?? null,
          removed: number[][] = view ? (view.pixels as number[][]).filter(([x, y]) => !equal(second[y!]![x!], value)) : [];
        if (view === null && contextBound && !initialReturn && !contradiction && candidates.length === 1) {
          view = this.returnedView(chart, candidates[0]!, value, frames, second, after);
          if (view) removed = view.pixels;
        }
        if (contextBound && !initialReturn && !contradiction && candidates.length === 1 && view
          && removed.length === view.pixels.length && removed.length && view.edge === chartEdgeKey(candidates[0]!)) {
          const edge = candidates[0]!, [dx, dy] = edge.delta, width = first[0]!.length, height = chart.field_bottom,
            thickness = 2 * chart.nodes[0].size,
            side = removed.every(([x, y]) => dx > 0 ? x! >= width - thickness : dx < 0 ? x! < thickness
              : dy > 0 ? y! >= height - thickness : y! < thickness);
          if (side) {
            const receipt = { edge: chartEdgeKey(edge), from: edge.from, to: edge.to, value,
              removed_boundary_bbox: [Math.min(...removed.map(point => point[0]!)), Math.min(...removed.map(point => point[1]!)),
                Math.max(...removed.map(point => point[0]!)), Math.max(...removed.map(point => point[1]!))],
              evidence: [view.observation_ref, before.observation_ref, after.observation_ref],
              returned_frame_context: Object.fromEntries(['frame_ordinal', 'outside_boundary_equal_to_canonical']
                .filter(key => Object.hasOwn(view!, key)).map(key => [key, view![key]])),
              position_association: 'scoped_conditional_chart_correspondence', status: 'local_permission_hypothesis_not_confirmed_transaction' };
            this.grants.push(receipt); events.push({ inventory_loss_and_local_boundary_change: receipt });
          }
        }
      }
      if (contextBound && !contradiction && this.positions.length === 1) {
        const views: R = {}, width = second[0]!.length, height = chart.field_bottom, thickness = 2 * chart.nodes[0].size;
        for (const edge of chart.links as R[]) {
          if (!equal(edge.from, this.position)) continue;
          const [dx, dy] = edge.delta, value = edge.annotation, pixels: number[][] = [];
          for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            if (equal(second[y]![x], value) && (dx > 0 ? x >= width - thickness : dx < 0 ? x < thickness
              : dy > 0 ? y >= height - thickness : y < thickness)) pixels.push([x, y]);
          }
          if (pixels.length) views[String(value)] = { pixels, observation_ref: after.observation_ref, edge: chartEdgeKey(edge) };
        }
        this.views[chartPointKey(this.position!)] = views;
      }
      this.evidence.push(before.observation_ref, after.observation_ref);
    }
    const result = { status: 'observed_chart_transition', events, position: this.position, position_status: this.position_status,
      location_alternatives: this.positions, actual_score_delta: after.levels_completed - before.levels_completed,
      evidence: [before.observation_ref, after.observation_ref], annotations_do_not_restore_inventory: true };
    this.last = result; return result;
  }
  record(before: NativeObservation, after: NativeObservation, command: NativeCommand, first: NativeRows, second: NativeRows,
    proposal: R, index: number, frames: readonly NativeRows[]): NativeRecordResult {
    const event = this.recordSource(before, after, command, first, second, proposal, index, frames);
    return { events: event === null ? [] : [event] };
  }
}
