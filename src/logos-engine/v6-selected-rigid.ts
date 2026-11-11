/** Native transfer of SelectedRigid -> SelectedRigidAccess -> NeutralAccess.
 * Only selected canonical public returns acquire this owner. The raw blocked
 * result is not an action offer; the runtime owns its unique family adapter. */
import { compareUnicode } from './canonical.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import { copyNativeValue as clone, retainNativeJson } from './v6-native-owned.ts';
import { V6_DECLARATIVE_SOURCES } from './v6-src-program.ts';
import type { ObservedInputDomain } from './v6-native-observer.ts';
import type { NativeAfterResult, NativeBeforeResult, NativeExecution, NativeObservation,
  NativePublicObservation, NativeRecord, NativeRows } from './v6-native-types.ts';
import { SELECTED_RIGID_DIRECTIONS, selectedRigidMoved, selectedRigidPoint, selectedRigidPoses,
  selectedRigidScene } from './v6-selected-rigid-geometry.ts';
import { SelectedRigidIncomplete, selectedRigidLimits, selectedRigidRoute, type SelectedRigidLimits } from './v6-selected-rigid-search.ts';
import type { SelectedRigidBlocked, SelectedRigidCaptureContext, SelectedRigidCell as Cell,
  SelectedRigidCommand, SelectedRigidConfiguration, SelectedRigidControlModel, SelectedRigidEvent,
  SelectedRigidPlan, SelectedRigidPoses as Poses, SelectedRigidProposal, SelectedRigidReturn,
  SelectedRigidScene as Scene, SelectedRigidSourceState, SelectedRigidState } from './v6-selected-rigid-types.ts';

export type { SelectedRigidProposal, SelectedRigidBlocked, SelectedRigidSourceState,
  SelectedRigidCaptureContext, SelectedRigidConfiguration } from './v6-selected-rigid-types.ts';
export { SELECTED_RIGID_LIMITS, SELECTED_RIGID_SOURCE_LIMITS, SelectedRigidIncomplete } from './v6-selected-rigid-search.ts';
export const SELECTED_RIGID_STATE_SCHEMA = 'native.selected_rigid.v1';
export interface NativeSelectedRigidState extends SelectedRigidSourceState { schema: typeof SELECTED_RIGID_STATE_SCHEMA }
export interface NativeSelectedRigidOptions {
  configuration?: SelectedRigidConfiguration | null; limits?: Partial<SelectedRigidLimits>;
}
type R = Record<string, any>;
const ACTIONS = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'] as const;
const validEvents = new WeakSet<object>(), validCheckpoints = new WeakSet<object>();
const initialSource = (): SelectedRigidSourceState => ({ format: 'selected_rigid_events.v1', events: [] });

/** src_bridge.plain recursively rebuilds each occurrence; unlike deepcopy it
 * does not retain aliases between a plan's scene and its older state.scene. */
function plain<T>(value: T): T {
  if (Array.isArray(value)) return value.map(plain) as T;
  if (value !== null && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, plain(item)])) as T;
  return value;
}
function invalid(label: string): never { throw new TypeError('Invalid SelectedRigid checkpoint: ' + label); }
function object(value: unknown, label: string): asserts value is R {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid(label);
}
function fields(value: R, required: readonly string[], label: string, optional: readonly string[] = []): void {
  const allowed = new Set([...required, ...optional]);
  if (required.some(name => !Object.hasOwn(value, name)) || Object.keys(value).some(name => !allowed.has(name))) invalid(label + ' fields');
}
function integer(value: unknown, label: string, minimum = Number.MIN_SAFE_INTEGER): void {
  if (!Number.isSafeInteger(value) || Number(value) < minimum) invalid(label);
}
function string(value: unknown, label: string): void { if (typeof value !== 'string') invalid(label); }
function strings(value: unknown, label: string): void {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) invalid(label);
}
function cell(value: unknown, label: string, minimum = Number.MIN_SAFE_INTEGER): asserts value is Cell {
  if (!Array.isArray(value) || value.length !== 2) invalid(label);
  value.forEach(item => integer(item, label, minimum));
}
function palette(value: unknown, label: string): void {
  integer(value, label, 0); if (Number(value) > 255) invalid(label);
}
function mask(value: unknown, label: string): asserts value is Cell[] {
  if (!Array.isArray(value) || !value.length || value.length > 65536) invalid(label);
  let minX = Infinity, minY = Infinity;
  for (let index = 0; index < value.length; index++) {
    const current = value[index]; cell(current, label, 0); minX = Math.min(minX, current[0]); minY = Math.min(minY, current[1]);
    if (index > 0) {
      const previous = value[index - 1] as Cell;
      if (previous[0] > current[0] || previous[0] === current[0] && previous[1] >= current[1]) invalid(label + ' sorted unique full mask');
    }
  }
  if (minX !== 0 || minY !== 0) invalid(label + ' normalized mask');
}
function validateScene(value: unknown, label: string): asserts value is Scene {
  object(value, label); fields(value, ['geometry', 'bodies', 'receptacle'], label);
  object(value.geometry, label + ' geometry');
  fields(value.geometry, ['q', 'origin', 'size', 'frame_color'], label + ' geometry');
  integer(value.geometry.q, label + ' pitch', 6); if (value.geometry.q > 14) invalid(label + ' pitch');
  cell(value.geometry.origin, label + ' origin', 0); cell(value.geometry.size, label + ' size', 3);
  palette(value.geometry.frame_color, label + ' frame color');
  const [width, height] = value.geometry.size;
  if (width * height > 65536) invalid(label + ' public measurement domain');
  if (!Array.isArray(value.bodies) || value.bodies.length < 3 || value.bodies.length > 256) invalid(label + ' body population');
  let lastColor = -1;
  const occupied = new Set<string>();
  for (const body of value.bodies) {
    object(body, label + ' body'); fields(body, ['key', 'color', 'position', 'mask'], label + ' body');
    palette(body.color, label + ' body color');
    if (body.color <= lastColor || body.key !== String(body.color)) invalid(label + ' numeric body order');
    lastColor = body.color; cell(body.position, label + ' body position', 0); mask(body.mask, label + ' full body mask');
    for (const [x, y] of body.mask) {
      const xx = body.position[0] + x, yy = body.position[1] + y, key = `${xx},${yy}`;
      if (xx >= width || yy >= height || occupied.has(key)) invalid(label + ' measured body support');
      occupied.add(key);
    }
  }
  object(value.receptacle, label + ' receptacle'); fields(value.receptacle, ['key', 'position', 'mask'], label + ' receptacle');
  string(value.receptacle.key, label + ' receptacle key'); cell(value.receptacle.position, label + ' receptacle position');
  mask(value.receptacle.mask, label + ' receptacle mask');
  const target = value.bodies.find((body: R) => body.key === value.receptacle.key);
  if (!target || !equal(target.mask, value.receptacle.mask) || value.receptacle.position[1] < height) invalid(label + ' homologous outlined receptacle');
}
function validateModels(value: unknown): asserts value is SelectedRigidControlModel[] {
  if (!Array.isArray(value) || value.length > 24) invalid('control models');
  for (const model of value) {
    object(model, 'control model'); fields(model, ACTIONS, 'control model');
    const directions = new Set<string>();
    for (const action of ACTIONS) {
      cell(model[action], 'control direction');
      if (!SELECTED_RIGID_DIRECTIONS.some(direction => equal(direction, model[action]))) invalid('cardinal control hypothesis');
      directions.add(JSON.stringify(model[action]));
    }
    if (directions.size !== 4) invalid('competing cardinal permutation');
  }
}
function validateCommand(value: unknown): void {
  object(value, 'command'); fields(value, ['action_ref'], 'command', ['data']); string(value.action_ref, 'action ref');
  if (Object.hasOwn(value, 'data')) {
    object(value.data, 'command data'); for (const coordinate of Object.values(value.data)) integer(coordinate, 'command data value');
  }
}
/** Stronger validation is an explicit native ingress contract. Python restore
 * checks only its root keys/format/event kind, then replays the event payloads. */
function validateEvent(value: unknown): asserts value is SelectedRigidEvent {
  object(value, 'event'); if (validEvents.has(value)) return;
  fields(value, ['kind', 'state', 'models', 'detail'], 'event');
  if (value.kind !== 'observed_selected_rigid') invalid('event kind');
  object(value.state, 'event state'); fields(value.state, ['epoch', 'scene', 'active', 'evidence', 'tried'], 'event state');
  integer(value.state.epoch, 'epoch', 0); validateScene(value.state.scene, 'retained scene');
  // A body can disappear/reorder in the measured return. Source keeps the
  // provisional integer selection; do not silently bind it to another key.
  if (value.state.active !== null) integer(value.state.active, 'active body hypothesis', 0);
  strings(value.state.evidence, 'evidence');
  if (!Array.isArray(value.state.tried)) invalid('tried commands');
  for (const trial of value.state.tried) {
    if (!Array.isArray(trial) || trial.length !== 3) invalid('tried command');
    string(trial[0], 'tried pose digest'); integer(trial[1], 'tried body index', 0); string(trial[2], 'tried action');
  }
  validateModels(value.models); object(value.detail, 'event detail');
  fields(value.detail, ['before', 'after', 'command', 'prior_model_count', 'role_status', 'compatible_model_count'],
    'event detail', ['selection_pixels_changed', 'moved']);
  string(value.detail.before, 'before reference'); string(value.detail.after, 'after reference'); validateCommand(value.detail.command);
  integer(value.detail.prior_model_count, 'prior model count', 0); integer(value.detail.compatible_model_count, 'compatible model count', 0);
  if (!['selected_receiver_hypothesis', 'observed_exclusive_receiver', 'blocked_or_unselected_remains_conditional'].includes(value.detail.role_status)) invalid('receiver role status');
  for (const key of ['selection_pixels_changed', 'moved']) {
    if (Object.hasOwn(value.detail, key) && typeof value.detail[key] !== 'boolean') invalid('event ' + key);
  }
  validEvents.add(value);
}
function validateSource(value: R): asserts value is SelectedRigidSourceState {
  if (value.format !== 'selected_rigid_events.v1' || !Array.isArray(value.events)) invalid('source format/events');
  value.events.forEach(validateEvent);
}
function validateCheckpoint(value: unknown): asserts value is NativeSelectedRigidState {
  object(value, 'native envelope'); if (validCheckpoints.has(value)) return;
  fields(value, ['schema', 'format', 'events'], 'native envelope');
  if (value.schema !== SELECTED_RIGID_STATE_SCHEMA) invalid('schema');
  validateSource(value); validCheckpoints.add(value);
}
function initialModels(refs: readonly string[]): SelectedRigidControlModel[] {
  const result: SelectedRigidControlModel[] = [], current: Cell[] = [], used = new Set<number>();
  const visit = (): void => {
    if (current.length === SELECTED_RIGID_DIRECTIONS.length) {
      result.push(Object.fromEntries(refs.map((name, index) => [name, [...current[index]!] as Cell]))); return;
    }
    for (let index = 0; index < SELECTED_RIGID_DIRECTIONS.length; index++) if (!used.has(index)) {
      used.add(index); current.push(SELECTED_RIGID_DIRECTIONS[index]!); visit(); current.pop(); used.delete(index);
    }
  };
  visit(); return result;
}
function modelDirection(model: SelectedRigidControlModel, action: string): Cell {
  if (!Object.hasOwn(model, action)) throw new TypeError('SelectedRigid control model has no current action');
  return model[action]!;
}

export class NativeSelectedRigid {
  readonly id = 'selected_rigid';
  readonly configuration: SelectedRigidConfiguration | null;
  readonly limits: Readonly<SelectedRigidLimits>;
  private memory: SelectedRigidSourceState = retainNativeJson(initialSource());
  private rigidState: SelectedRigidState | null = null;
  private rigidModels: SelectedRigidControlModel[] | null = null;
  private retained: NativeSelectedRigidState | null = null;
  private budgetExecution: NativeExecution | undefined;
  private levelDeadlineMs: number | null = null;
  private remainingLevelActions: number | null = null;
  private requestedStopReasonValue: string | null = null;
  private observedNowMs: number | null = null;
  private readonly clockObservers = new Set<(valueMs: number) => void>();

  /** The direct configuration form is used by the common caller. The options
   * form additionally exposes only tighter bounds to synthetic qualification. */
  constructor(configurationOrOptions?: SelectedRigidConfiguration | NativeSelectedRigidOptions | null) {
    const optionsForm = configurationOrOptions !== null && configurationOrOptions !== undefined
      && (Object.hasOwn(configurationOrOptions, 'configuration') || Object.hasOwn(configurationOrOptions, 'limits'));
    const options: NativeSelectedRigidOptions = configurationOrOptions === undefined ? {} : optionsForm
      ? configurationOrOptions as NativeSelectedRigidOptions
      : { configuration: configurationOrOptions as SelectedRigidConfiguration | null };
    let configuration: SelectedRigidConfiguration | null;
    if (Object.hasOwn(options, 'configuration')) configuration = options.configuration ?? null;
    else {
      const source = (V6_DECLARATIVE_SOURCES as unknown as Record<string, { text: string }>)[
        'agents/yf_arc3_v6/morphology_policy/strategy.drm']!;
      configuration = JSON.parse(source.text).declarations[0].configuration.selected_rigid_question;
    }
    this.configuration = retainNativeJson(configuration); this.limits = Object.freeze(selectedRigidLimits(options.limits));
  }
  hasRetainedEvents(): boolean { return this.memory.events.length > 0; }
  retainedDigest(): string { return identity(['isolated-selected-rigid-v1', this.rigidState, this.rigidModels, this.memory.events]); }
  /** No extra clock read is performed by this setter or by captureContext. */
  setCurrentBudget(execution: NativeExecution | undefined, remainingLevelActions: number | null): void {
    if (execution?.deadlineMs !== undefined && !Number.isFinite(execution.deadlineMs)) throw new TypeError('SelectedRigid requires a finite current level deadline');
    if (remainingLevelActions !== null && (!Number.isSafeInteger(remainingLevelActions) || remainingLevelActions < 0)) throw new TypeError('Invalid SelectedRigid current level action budget');
    this.budgetExecution = execution; this.levelDeadlineMs = execution?.deadlineMs ?? null;
    this.remainingLevelActions = remainingLevelActions; this.observedNowMs = null;
  }
  captureContext(): SelectedRigidCaptureContext {
    return { configuration: clone(this.configuration), requestedStopReason: this.requestedStopReasonValue,
      levelDeadlineMs: this.levelDeadlineMs, remainingLevelActions: this.remainingLevelActions, observedNowMs: this.observedNowMs };
  }
  /** The observer receives values already consumed by actual native work.
   * Diagnostic listeners must be synchronous; neither registration nor removal
   * reads a clock, changes source state or replaces the execution's clock. */
  attachClockObserver(listener: (valueMs: number) => void): () => void {
    if (typeof listener !== 'function') throw new TypeError('SelectedRigid clock observer must be callable');
    this.clockObservers.add(listener); return () => { this.clockObservers.delete(listener); };
  }
  private now(): number {
    const value = (this.budgetExecution?.now ?? (() => performance.now()))();
    if (!Number.isFinite(value)) throw new TypeError('SelectedRigid clock must be finite');
    this.observedNowMs = value; for (const observer of this.clockObservers) observer(value); return value;
  }
  private blocked(reason: string, error?: SelectedRigidIncomplete): SelectedRigidBlocked {
    this.requestedStopReasonValue = reason;
    return { status: 'unknown', block_unrelated_probe: true, reason,
      ...(error ? { native_incomplete: { cause: error.cause, examined: error.examined, work: error.work, frontier: clone(error.frontier) } } : {}) };
  }
  async propose(obs: NativeObservation, rows: NativeRows, _inputs: readonly SelectedRigidCommand[], remaining: number,
    execution?: NativeExecution): Promise<SelectedRigidProposal | SelectedRigidBlocked | null> {
    this.requestedStopReasonValue = null;
    if (execution !== undefined) this.setCurrentBudget(execution, execution.remainingLevelActions ?? remaining);
    if (this.levelDeadlineMs === null || this.now() >= this.levelDeadlineMs || remaining < 1) return null;
    if (this.remainingLevelActions === null) throw new TypeError('Missing current level action budget');
    if (!Number.isSafeInteger(remaining)) throw new TypeError('SelectedRigid requires a finite remaining action budget');
    try {
      if (this.budgetExecution?.signal?.aborted) throw new SelectedRigidIncomplete('aborted', 0, 0);
      return await this.proposeCurrent(obs, rows, Math.min(remaining, 16));
    } catch (error) {
      if (!(error instanceof SelectedRigidIncomplete)) throw error;
      return this.blocked('rigid_conditional_configuration_search_incomplete', error);
    }
  }
  private async proposeCurrent(obs: NativeObservation, rows: NativeRows, limit: number): Promise<SelectedRigidProposal | SelectedRigidBlocked | null> {
    const cfg = this.configuration;
    let state = this.rigidState?.epoch === obs.level_epoch ? clone(this.rigidState) : null;
    const scene = selectedRigidScene(rows, state?.scene ?? null);
    if (!cfg || !Object.keys(cfg).length || !scene) return null;
    const refs = obs.available_action_refs.filter(name => ACTIONS.includes(name as typeof ACTIONS[number])).sort(compareUnicode);
    if (refs.length !== 4) return this.blocked('rigid_direction_domain_incomplete');
    const models = this.rigidModels !== null ? clone(this.rigidModels) : initialModels(refs);
    if (!models.length) return this.blocked('rigid_control_or_collision_model_refuted');
    state ??= { epoch: obs.level_epoch, scene, active: null, evidence: [obs.observation_ref], tried: [] };
    const deadline = Math.min(this.levelDeadlineMs!, this.now() + this.limits.timeBoundMs);
    const searchExecution: NativeExecution = { ...this.budgetExecution,
      yieldControl: this.budgetExecution?.yieldControl ?? (() => new Promise<void>(resolve => setTimeout(resolve, 0))), now: () => this.now() };
    const [route, nodes] = await selectedRigidRoute(scene, state.active, deadline, searchExecution, this.limits);
    if (route === null) return this.blocked('rigid_conditional_configuration_search_incomplete');
    if (!route.length) return this.blocked('rigid_receptacle_matched_terminal_unknown');
    const actions: SelectedRigidCommand[] = [], expected: (Poses | null)[] = [], beforeStates: Poses[] = [];
    let active = state.active, poses = selectedRigidPoses(scene), mode: SelectedRigidPlan['mode'] = 'path', why = cfg.compose;
    for (const [index, direction, next] of route) {
      if (active !== index) {
        if (actions.length) break;
        const temporary = clone(scene);
        for (let body = 0; body < temporary.bodies.length; body++) temporary.bodies[body]!.position = [...poses[body]!] as Cell;
        actions.push({ action_ref: 'ACTION6', data: selectedRigidPoint(temporary, index) });
        beforeStates.push(poses); expected.push(poses); active = index; mode = 'select'; break;
      }
      const candidates = refs.filter(name => models.every(model => equal(modelDirection(model, name), direction)));
      if (candidates.length) {
        actions.push({ action_ref: candidates[0]! }); beforeStates.push(poses); expected.push(next); poses = next;
      } else {
        let choice: readonly [outcomes: number, movingOutcomes: number, action: string] | null = null;
        const poseDigest = identity(poses), stationary = JSON.stringify(poses);
        for (const name of refs) {
          const outcomes = new Set(models.map(model => JSON.stringify(selectedRigidMoved(scene, poses, index, modelDirection(model, name)))));
          const key = [poseDigest, index, name];
          if (state.tried.some(trial => equal(trial, key))) continue;
          const candidate = [outcomes.size, outcomes.size - Number(outcomes.has(stationary)), name] as const;
          if (choice === null || candidate[0] > choice[0] || candidate[0] === choice[0] &&
            (candidate[1] > choice[1] || candidate[1] === choice[1] && compareUnicode(candidate[2], choice[2]) > 0)) choice = candidate;
        }
        if (choice === null) break;
        actions.push({ action_ref: choice[2] }); beforeStates.push(poses); expected.push(null);
        mode = 'probe'; why = cfg.control; break;
      }
      if (actions.length >= limit) break;
    }
    if (!actions.length) return this.blocked('rigid_control_discrimination_exhausted');
    const plan: SelectedRigidPlan = plain({ scene, state, models, commands: actions, expected, before_states: beforeStates,
      active, epoch: obs.level_epoch, score: obs.levels_completed, observation_ref: obs.observation_ref,
      frame_digest: identity(rows), mode, why, search_nodes: nodes });
    const ref = 'selected-rigid:' + identity(plan), evidence = state.evidence.slice(-16);
    const facts: SelectedRigidProposal['facts'] = { current_full_masks_measured: true, receptacle_goal_is_library_prior: true,
      collision_domain_is_provisional: true, control_hypotheses_preserved: true };
    const proposal: SelectedRigidProposal = { status: 'proposed', kind: 'selected_rigid', proposal_id: ref,
      selected_rigid_plan: plan, actions, steps: actions.map(action => ({ action, expected_after: null })), facts,
      compositions: [{ id: ref, observed: false, open_question: why, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: why, hypothesis_refs: evidence }, route_refs: evidence,
      binding: { level_epoch: obs.level_epoch, observation_ref: obs.observation_ref },
      bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [],
        actions, purpose: why, preconditions: facts, evidence, outcome_guard: { path: ['value'], contains: ref } } };
    if (actions.some(action => !obs.available_action_refs.includes(action.action_ref))) return null;
    for (let index = 0; index < actions.length; index++) {
      const action = actions[index]!;
      if (action.action_ref !== 'ACTION6') continue;
      const { x, y } = action.data!;
      const members = obs.entities.filter(entity => entity.mask.some(([mx, my]) => mx === x! - entity.bbox[0] && my === y! - entity.bbox[1]));
      if (members.length !== 1) return null;
      const entity = members[0]!;
      proposal.steps[index]!.point_binding = { entity_ref: entity.id, signature: entity.signature, bbox: [...entity.bbox],
        observation_ref: obs.observation_ref, level_epoch: obs.level_epoch, frame_hash: obs.frame_hash,
        point: [x!, y!], palette_value: rows[y!]![x!]!, source: 'current_observed_occupied_mask_point' };
    }
    return proposal;
  }
  bind(proposal: SelectedRigidProposal, _domain?: ObservedInputDomain | null): void {
    if (!proposal.actions?.length || proposal.actions.length > 16 || !proposal.selected_rigid_plan || !proposal.bundle_template
      || !proposal.steps || !equal(proposal.actions, proposal.selected_rigid_plan.commands)
      || !equal(proposal.actions, proposal.bundle_template.actions) || !equal(proposal.actions, proposal.steps.map(step => step.action))) {
      throw new TypeError('Selected rigid exact action binding differs');
    }
  }
  before(proposal: SelectedRigidProposal, index: number, publicPacket: NativePublicObservation, obs: NativeObservation): NativeBeforeResult {
    try { this.bind(proposal, null); } catch { return { admitted: false, reason: 'selected_rigid_exact_binding_changed' }; }
    if (this.levelDeadlineMs === null || this.now() >= this.levelDeadlineMs) return { admitted: false, reason: 'level_deadline' };
    const plan = proposal.selected_rigid_plan, scene = selectedRigidScene(publicPacket.frame_rows, plan.scene), action = proposal.actions[index];
    let admitted = scene !== null && Number.isSafeInteger(index) && index >= 0 && !!action
      && proposal.proposal_id === 'selected-rigid:' + identity(plan)
      && equal(proposal.actions, plan.commands) && equal(proposal.actions, proposal.bundle_template.actions)
      && obs.level_epoch === plan.epoch && obs.levels_completed === plan.score && obs.available_action_refs.includes(action!.action_ref);
    admitted = admitted && equal(scene!.geometry, plan.scene.geometry) && equal(scene!.receptacle, plan.scene.receptacle)
      && equal(scene!.bodies.map(body => [body.key, body.mask]), plan.scene.bodies.map(body => [body.key, body.mask]))
      && equal(selectedRigidPoses(scene!), plan.before_states[index]);
    if (index === 0) admitted = admitted && identity(publicPacket.frame_rows) === plan.frame_digest && obs.observation_ref === plan.observation_ref;
    return { admitted: !!admitted, reason: admitted ? 'current_rigid_support_and_conditional_path' : 'rigid_binding_changed' };
  }
  after(proposal: SelectedRigidProposal, index: number, _before: NativeObservation, after: NativeObservation,
    _rows: NativeRows, later: NativeRows): NativeAfterResult {
    if (!proposal.selected_rigid_plan) return { matched: null, seal_prefix: true, reason: 'not_selected_rigid' };
    const plan = proposal.selected_rigid_plan, boundary = after.level_epoch !== plan.epoch || after.levels_completed !== plan.score;
    const scene = selectedRigidScene(later, plan.scene), expected = plan.expected[index];
    const matched = boundary || expected == null ? null : !!scene && equal(selectedRigidPoses(scene), expected);
    return { matched, seal_prefix: boundary || matched !== true || plan.mode === 'select',
      reason: boundary ? 'boundary' : expected == null ? 'unknown_control_response' : 'rigid_public_projection' };
  }
  record(before: NativeObservation, after: NativeObservation, command: SelectedRigidCommand, rows: NativeRows, later: NativeRows,
    proposal?: SelectedRigidProposal | null, _index = 0, _frames?: readonly NativeRows[]): SelectedRigidReturn | null {
    const plan = proposal?.selected_rigid_plan;
    if (!plan || before.level_epoch !== after.level_epoch) return null;
    const state = clone(this.rigidState?.epoch === before.level_epoch ? this.rigidState : plan.state);
    const first = selectedRigidScene(rows, plan.scene), second = selectedRigidScene(later, plan.scene);
    let models = clone(this.rigidModels !== null ? this.rigidModels : plan.models);
    if (!first || !second) return null;
    const detail: SelectedRigidEvent['detail'] = { before: before.observation_ref, after: after.observation_ref,
      command: clone(command), prior_model_count: models.length, role_status: 'selected_receiver_hypothesis', compatible_model_count: 0 };
    if (command.data && Object.keys(command.data).length > 0) {
      state.active = plan.active; detail.selection_pixels_changed = !equal(rows, later);
    } else if (state.active !== null) {
      const index = state.active, firstPoses = selectedRigidPoses(first), secondPoses = selectedRigidPoses(second);
      models = models.filter(model => equal(selectedRigidMoved(first, firstPoses, index, modelDirection(model, command.action_ref)), secondPoses));
      state.tried.push([identity(firstPoses), index, command.action_ref]); detail.moved = !equal(firstPoses, secondPoses);
      detail.role_status = detail.moved ? 'observed_exclusive_receiver' : 'blocked_or_unselected_remains_conditional';
    }
    state.scene = second; state.evidence.push(before.observation_ref, after.observation_ref); detail.compatible_model_count = models.length;
    const event: SelectedRigidEvent = plain({ kind: 'observed_selected_rigid', state, models, detail });
    const owned = retainNativeJson(event); validateEvent(owned);
    this.install(retainNativeJson({ format: 'selected_rigid_events.v1', events: [...this.memory.events, owned] }), null);
    return { events: [event], scope: 'Canonical public transition; receiver remains hypothetical until discriminating displacement.' };
  }
  private install(source: SelectedRigidSourceState, retained: NativeSelectedRigidState | null): void {
    const last = source.events.at(-1);
    this.memory = source; this.rigidState = last?.state ?? null; this.rigidModels = last?.models ?? null; this.retained = retained;
  }
  sourceState(): SelectedRigidSourceState { return clone(this.memory); }
  restoreSourceState(value: NativeRecord): void {
    const owned = retainNativeJson(value); object(owned, 'source state'); fields(owned, ['format', 'events'], 'source state');
    validateSource(owned); this.install(owned, null);
  }
  nativeState(): NativeSelectedRigidState {
    if (this.retained) return this.retained;
    const owned = retainNativeJson({ schema: SELECTED_RIGID_STATE_SCHEMA, ...this.memory });
    validateCheckpoint(owned); this.retained = owned; return owned;
  }
  state(): NativeSelectedRigidState { return clone(this.nativeState()); }
  restore(value: NativeRecord): void { this.restoreNative(value); }
  restoreNative(value: Readonly<NativeRecord>): void {
    if (value === this.retained) return;
    const owned = retainNativeJson(value); validateCheckpoint(owned);
    // Every event already contains the complete state and model population.
    // After validating the entire envelope, installing its last event equals
    // replaying all apply_event calls. Immutable identity/value rehydration
    // uses the same installation so no stale derived model can survive.
    this.install(retainNativeJson({ format: owned.format, events: owned.events }), owned);
  }
}
