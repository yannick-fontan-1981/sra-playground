/** Native transfer of the pinned V6 PreviewPacking family and donor. The
 * blocked/null/proposed contract is source-specific and remains outside the
 * NativeFamily union. The runtime owns its sole wrapper and physical release. */
import { compareUnicode } from './canonical.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import { copyNativeValue as clone, retainNativeJson } from './v6-native-owned.ts';
import { V6_DECLARATIVE_SOURCES } from './v6-src-program.ts';
import type { ObservedInputDomain } from './v6-native-observer.ts';
import type { NativeAfterResult, NativeBeforeResult, NativeExecution, NativeObservation, NativePublicObservation,
  NativeRecord, NativeRows } from './v6-native-types.ts';
import { previewPackingAssignments, PreviewPackingIncomplete, PreviewPackingWork, previewPackingLimits,
  previewPackingTransform, type PreviewPackingLimits } from './v6-preview-packing-calculus.ts';
import { previewPackingMeasureScene, previewPackingPointFor, previewPackingPose, previewPackingSample,
  previewPackingNormalized } from './v6-preview-packing-geometry.ts';
import type { PreviewPackingAssignedPose, PreviewPackingBlocked, PreviewPackingCell as Cell, PreviewPackingCommand,
  PreviewPackingConfiguration, PreviewPackingControl, PreviewPackingEvent, PreviewPackingModel, PreviewPackingPlan,
  PreviewPackingPose as Pose, PreviewPackingProposal, PreviewPackingReturn, PreviewPackingScene, PreviewPackingSourceState,
  PreviewPackingTransform } from './v6-preview-packing-types.ts';

export type { PreviewPackingProposal, PreviewPackingBlocked, PreviewPackingSourceState } from './v6-preview-packing-types.ts';
export { PREVIEW_PACKING_LIMITS, PreviewPackingIncomplete } from './v6-preview-packing-calculus.ts';
export const PREVIEW_PACKING_STATE_SCHEMA = 'native.preview_packing.v1';
export interface NativePreviewPackingOptions { limits?: Partial<PreviewPackingLimits> }
export interface NativePreviewPackingState extends PreviewPackingSourceState { schema: typeof PREVIEW_PACKING_STATE_SCHEMA }
const sourceFields = ['packing_events', 'packing_model', 'packing_controls', '_packing_scene_cache'] as const;
const initialSource = (): PreviewPackingSourceState => ({ packing_events: [], packing_model: null, packing_controls: {}, _packing_scene_cache: {} });
const validatedCheckpoints = new WeakSet<object>();
type R = Record<string, any>;
function invalid(label: string): never { throw new TypeError('Invalid PreviewPacking checkpoint: ' + label); }
function object(value: unknown, label: string): asserts value is R { if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid(label); }
function fields(value: R, names: readonly string[], label: string, optional: readonly string[] = []): void {
  const allowed = new Set([...names, ...optional]);
  if (names.some(k => !Object.hasOwn(value, k)) || Object.keys(value).some(k => !allowed.has(k))) invalid(label + ' fields');
}
function integer(value: unknown, label: string, minimum = Number.MIN_SAFE_INTEGER): void { if (!Number.isSafeInteger(value) || Number(value) < minimum) invalid(label); }
function string(value: unknown, label: string): void { if (typeof value !== 'string') invalid(label); }
function strings(value: unknown, label: string): void { if (!Array.isArray(value) || value.some(v => typeof v !== 'string')) invalid(label); }
function palette(value: unknown, label: string): void { integer(value, label, 0); if (Number(value) > 255) invalid(label); }
function cell(value: unknown, label: string, minimum = Number.MIN_SAFE_INTEGER): void {
  if (!Array.isArray(value) || value.length !== 2) invalid(label); value.forEach(v => integer(v, label, minimum));
}
function mask(value: unknown, label: string, normalized = false): void {
  if (!Array.isArray(value) || !value.length || value.length > 65536) invalid(label);
  value.forEach(p => cell(p, label, 0));
  if (new Set(value.map(p => JSON.stringify(p))).size !== value.length) invalid(label + ' duplicate cell');
  if (normalized && !equal(value, previewPackingNormalized(value)[0])) invalid(label + ' normalization');
}
function validatePose(value: unknown, label: string): void {
  object(value, label); fields(value, ['anchor', 'mask'], label); cell(value.anchor, label + ' anchor'); mask(value.mask, label + ' mask', true);
}
function validateScene(value: unknown, label: string, model: boolean): void {
  object(value, label);
  fields(value, ['q', 'offset', 'board', 'pieces', 'background', 'empty', 'frame_color', 'frame', 'world', 'selected', 'preview_color', 'evidence',
    ...(model ? ['epoch', 'tried'] : [])], label);
  integer(value.q, label + ' cell pitch', 3); if (value.q > 13) invalid(label + ' cell pitch'); cell(value.offset, label + ' offset', 0);
  mask(value.board, label + ' board'); mask(value.world, label + ' world');
  const world = new Set(value.world.map((p: Cell) => JSON.stringify(p)));
  if (value.board.some((p: Cell) => !world.has(JSON.stringify(p)))) invalid(label + ' board outside world');
  for (const name of ['background', 'empty', 'frame_color']) palette(value[name], label + ' ' + name);
  if (!Array.isArray(value.frame) || value.frame.length !== 4) invalid(label + ' frame');
  value.frame.forEach((n: unknown) => integer(n, label + ' frame', 0));
  if (value.frame[0] >= value.frame[2] || value.frame[1] >= value.frame[3]) invalid(label + ' frame order');
  if (!Array.isArray(value.pieces) || !value.pieces.length || value.pieces.length > 65536) invalid(label + ' pieces');
  const ids = new Set<string>();
  for (const p of value.pieces) {
    object(p, label + ' piece'); fields(p, ['id', 'color', 'mask', 'anchor', 'movable'], label + ' piece');
    string(p.id, label + ' piece id'); if (ids.has(p.id)) invalid(label + ' duplicate piece'); ids.add(p.id);
    palette(p.color, label + ' piece color'); mask(p.mask, label + ' piece mask', true); cell(p.anchor, label + ' piece anchor');
    if (typeof p.movable !== 'boolean') invalid(label + ' piece mobility');
  }
  if (!(value.selected === null || typeof value.selected === 'string' && ids.has(value.selected))) invalid(label + ' selected owner');
  if (value.preview_color !== null) palette(value.preview_color, label + ' preview color'); strings(value.evidence, label + ' evidence');
  if (model) {
    integer(value.epoch, label + ' epoch', 0); if (!Array.isArray(value.tried)) invalid(label + ' trials');
    for (const trial of value.tried) {
      object(trial, 'trial'); fields(trial, ['action', 'pose'], 'trial'); string(trial.action, 'trial action');
      if (!Array.isArray(trial.pose) || trial.pose.length !== 2) invalid('trial pose');
      cell(trial.pose[0], 'trial anchor'); mask(trial.pose[1], 'trial mask', true);
    }
  }
}
function validateControls(value: unknown): void {
  object(value, 'controls');
  for (const control of Object.values(value)) {
    object(control, 'control'); strings(control.evidence, 'control evidence');
    if (control.kind === 'translation') {
      fields(control, ['kind', 'delta', 'evidence'], 'translation'); cell(control.delta, 'translation delta');
      if (Math.abs(control.delta[0]) + Math.abs(control.delta[1]) !== 1) invalid('translation is not an observed unit displacement');
    } else if (control.kind === 'transform') {
      fields(control, ['kind', 'transform', 'evidence'], 'transform');
      if (!['rotate_cw', 'rotate_ccw', 'reflect_rows', 'reflect_columns'].includes(control.transform)) invalid('transform');
    } else invalid('control kind');
  }
}
function validateCommand(value: unknown): void {
  object(value, 'command'); fields(value, ['action_ref'], 'command', ['data']); string(value.action_ref, 'command action');
  if (Object.hasOwn(value, 'data')) { object(value.data, 'command data'); for (const n of Object.values(value.data)) integer(n, 'command argument'); }
}
function validateSource(value: R): void {
  if (!Array.isArray(value.packing_events)) invalid('events');
  for (const event of value.packing_events) {
    object(event, 'event'); fields(event, ['kind', 'model', 'controls', 'detail'], 'event');
    if (event.kind !== 'observed_preview_packing') invalid('event kind');
    validateScene(event.model, 'event model', true); validateControls(event.controls); object(event.detail, 'event detail');
    fields(event.detail, ['before', 'after', 'command', 'mode'], 'event detail', ['selection_observed', 'observed_pose']);
    string(event.detail.before, 'event before'); string(event.detail.after, 'event after'); validateCommand(event.detail.command);
    if (!['select', 'edit'].includes(event.detail.mode)) invalid('event mode');
    if (Object.hasOwn(event.detail, 'selection_observed') && typeof event.detail.selection_observed !== 'boolean') invalid('selection observation');
    if (Object.hasOwn(event.detail, 'observed_pose') && event.detail.observed_pose !== null) validatePose(event.detail.observed_pose, 'observed pose');
  }
  if (value.packing_model !== null) validateScene(value.packing_model, 'current model', true);
  validateControls(value.packing_controls); object(value._packing_scene_cache, 'scene cache');
  for (const [epoch, scene] of Object.entries(value._packing_scene_cache)) {
    if (!/^(0|[1-9][0-9]*)$/.test(epoch) || !Number.isSafeInteger(Number(epoch))) invalid('scene cache epoch');
    if (scene !== null) validateScene(scene, 'cached scene', false);
  }
}
function validateCheckpoint(value: NativeRecord): asserts value is NativePreviewPackingState {
  if (validatedCheckpoints.has(value)) return;
  fields(value, ['schema', ...sourceFields], 'envelope'); if (value.schema !== PREVIEW_PACKING_STATE_SCHEMA) invalid('schema');
  validateSource(value); validatedCheckpoints.add(value);
}

export class NativePreviewPacking {
  readonly id = 'preview_packing';
  readonly configuration: PreviewPackingConfiguration;
  readonly policyRef: string;
  readonly policyHash: string;
  readonly limits: Readonly<PreviewPackingLimits>;
  private memory: PreviewPackingSourceState = initialSource();
  private retained: NativePreviewPackingState | null = null;
  constructor(options: NativePreviewPackingOptions = {}) {
    const source = (V6_DECLARATIVE_SOURCES as unknown as Record<string, { text: string; sha256: string }>)['agents/yf_arc3_v6/morphology_policy/preview_packing/preview.drm']!;
    const declaration = JSON.parse(source.text).declarations[0];
    this.configuration = retainNativeJson(declaration.configuration) as PreviewPackingConfiguration;
    this.policyRef = declaration.id; this.policyHash = source.sha256; this.limits = Object.freeze(previewPackingLimits(options.limits));
  }
  hasRetainedModel(): boolean { return this.memory.packing_model !== null; }
  retainedDigest(): string { return identity(['neutral-provider', this.memory.packing_events, this.memory.packing_model, this.memory.packing_controls]); }
  private changed(): void { this.retained = null; }
  private blocked(reason: string): PreviewPackingBlocked { return { status: 'unknown', block_unrelated_probe: true, reason }; }

  async propose(obs: NativeObservation, rows: NativeRows, inputs: readonly PreviewPackingCommand[], remaining: number,
    execution?: NativeExecution): Promise<PreviewPackingProposal | PreviewPackingBlocked | null> {
    if (remaining < 1 || !this.configuration.preview_packing_question) return null;
    if (!Number.isSafeInteger(remaining)) throw new TypeError('PreviewPacking requires a finite remaining action budget');
    try { return await this.proposeCurrent(obs, rows, inputs, Math.min(16, remaining), execution); }
    catch (error) {
      if (!(error instanceof PreviewPackingIncomplete)) throw error;
      return { ...this.blocked('preview_packing_search_incomplete'), native_incomplete: {
        cause: error.cause, examined: error.examined, work: error.work, frontier: error.frontier,
      } };
    }
  }
  private async proposeCurrent(obs: NativeObservation, rows: NativeRows, inputs: readonly PreviewPackingCommand[], limit: number,
    execution?: NativeExecution): Promise<PreviewPackingProposal | PreviewPackingBlocked | null> {
    const cfg = this.configuration.preview_packing_question!, work = new PreviewPackingWork(execution, this.limits);
    let m: PreviewPackingModel | null = this.memory.packing_model?.epoch === obs.level_epoch ? clone(this.memory.packing_model) : null;
    if (m === null) {
      const epoch = String(obs.level_epoch);
      if (!Object.hasOwn(this.memory._packing_scene_cache, epoch)) {
        const scene = previewPackingMeasureScene(rows);
        this.memory = { ...this.memory, _packing_scene_cache: { ...this.memory._packing_scene_cache, [epoch]: scene } }; this.changed();
      }
      const scene = clone(this.memory._packing_scene_cache[epoch]!);
      if (scene === null) return null;
      m = { ...scene, epoch: obs.level_epoch, tried: [], evidence: [obs.observation_ref] };
    }
    work.check();
    const result = await previewPackingAssignments(m, execution, this.limits), solutions = result.packing_assignments;
    if (!solutions.length) return this.blocked('packing_partition_missing_under_current_preservation_hypothesis');
    const cost = (poses: PreviewPackingAssignedPose[]): number => m!.pieces.reduce((sum, p) => sum + poses.reduce((part, pose) => part + (p.id === pose.piece_ref
      ? Math.abs(pose.anchor[0] - p.anchor[0]) + Math.abs(pose.anchor[1] - p.anchor[1]) + 3 * Number(!equal(pose.mask, p.mask)) : 0), 0), 0);
    let target = solutions[0]!, best = cost(target.poses);
    for (const solution of solutions.slice(1)) { const amount = cost(solution.poses); if (amount < best) { best = amount; target = solution; } work.tick(); if (work.work % 256 === 0) await work.checkpoint(); }
    const targets = new Map(target.poses.map(p => [p.piece_ref, p]));
    const pending = m.pieces.filter(p => p.movable && (!equal(p.anchor, targets.get(p.id)!.anchor) || !equal(p.mask, targets.get(p.id)!.mask)));
    if (!pending.length) return this.blocked('geometric_partition_present_official_goal_unknown');
    const selected = pending.find(p => p.id === m!.selected), chosen = selected ?? pending[0]!;
    let actions: PreviewPackingCommand[] = [], expected: (Pose | null)[] = [], mode: 'select' | 'edit' = 'select', why: string;
    if (!selected) { actions = [{ action_ref: 'ACTION6', data: previewPackingPointFor(m, chosen) }]; expected = [null]; why = cfg.selection; }
    else {
      mode = 'edit'; why = cfg.transport; const goal = targets.get(selected.id)!;
      const controls = Object.entries(this.memory.packing_controls).filter(([name]) => obs.available_action_refs.includes(name)).sort(([a], [b]) => compareUnicode(a, b));
      const start: Pose = { anchor: selected.anchor, mask: selected.mask }, wanted: Pose = { anchor: goal.anchor, mask: goal.mask };
      const poseKey = (pose: Pose) => JSON.stringify([pose.anchor, pose.mask]), world = new Set(m.world.map(p => JSON.stringify(p)));
      const queue: { pose: Pose; word: PreviewPackingCommand[]; path: Pose[] }[] = [{ pose: start, word: [], path: [] }], seen = new Set([poseKey(start)]);
      let head = 0, found: typeof queue[number] | null = null;
      while (head < queue.length && seen.size < this.limits.transportStates) {
        const current = queue[head++]!; work.tick(); if (work.work % 256 === 0) await work.checkpoint();
        if (equal(current.pose, wanted)) { found = current; break; }
        for (const [action, effect] of controls) {
          let [a, b] = current.pose.anchor, shape = current.pose.mask;
          if (effect.kind === 'translation') { a += effect.delta[0]; b += effect.delta[1]; }
          else shape = previewPackingTransform(shape, effect.transform);
          const next: Pose = { anchor: [a, b], mask: shape }, key = poseKey(next); work.tick();
          if (seen.has(key) || !shape.every(([y, x]) => world.has(JSON.stringify([a + y, b + x])))) continue;
          seen.add(key); queue.push({ pose: next, word: [...current.word, { action_ref: action }], path: [...current.path, next] });
        }
      }
      if (found && found.word.length) { actions = found.word.slice(0, limit); expected = found.path.slice(0, limit); }
      else {
        if (head < queue.length && seen.size >= this.limits.transportStates) work.stop('PREVIEW_TRANSPORT_STATE_BOUND', { examined_states: head, discovered_states: seen.size });
        const tried = new Set(m.tried.filter(e => equal(e.pose, [start.anchor, start.mask])).map(e => e.action));
        const known = new Set(controls.map(([name]) => name));
        const unknown = [...new Set(inputs.filter(a => (!a.data || !Object.keys(a.data).length) && !known.has(a.action_ref) && !tried.has(a.action_ref)).map(a => a.action_ref))].sort(compareUnicode);
        if (!unknown.length) return this.blocked('packing_control_or_preparation_missing');
        actions = [{ action_ref: unknown[0]! }]; expected = [null]; why = cfg.control;
      }
    }
    const plan: PreviewPackingPlan = { model: m, chosen: chosen.id, mode, commands: actions, expected,
      before_poses: [{ anchor: chosen.anchor, mask: chosen.mask }, ...expected.slice(0, -1)], epoch: obs.level_epoch,
      score: obs.levels_completed, observation_ref: obs.observation_ref, frame_digest: identity(rows), why,
      calculation: { method: 'V5.preview_piece_packing._residual', assignments: solutions.length,
        scope: 'conditional finite geometric partition, not acquired terminal law' }, target: targets.get(chosen.id)! };
    const ref = 'preview-packing:' + identity(plan), evidence = m.evidence.slice(-16), facts = {
      current_measured_cell_inventory: true as const, strict_partition_is_library_hypothesis: true as const,
      preview_transport_provisional: true as const, current_point_bound: mode === 'select',
    };
    const proposal: PreviewPackingProposal = { status: 'proposed', kind: 'preview_packing', proposal_id: ref, preview_packing_plan: plan,
      actions, steps: actions.map(action => ({ action, expected_after: null })), facts,
      compositions: [{ id: ref, observed: false, open_question: why, properties: { roles: cfg.roles }, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: why, hypothesis_refs: evidence }, route_refs: evidence,
      binding: { level_epoch: obs.level_epoch, observation_ref: obs.observation_ref },
      bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [],
        actions, purpose: why, preconditions: facts, evidence, outcome_guard: { path: ['value'], contains: ref } },
      preview_policy_ref: this.policyRef, preview_policy_hash: this.policyHash };
    if (actions.some(action => !obs.available_action_refs.includes(action.action_ref))) return null;
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i]!;
      if (action.action_ref !== 'ACTION6') continue;
      const { x, y } = action.data!;
      const members = obs.entities.filter(e => e.mask.some(([mx, my]) => mx === x! - e.bbox[0] && my === y! - e.bbox[1]));
      if (members.length !== 1) return null;
      const e = members[0]!;
      proposal.steps[i]!.point_binding = { entity_ref: e.id, signature: e.signature, bbox: [...e.bbox], observation_ref: obs.observation_ref,
        level_epoch: obs.level_epoch, frame_hash: obs.frame_hash, point: [x!, y!], palette_value: rows[y!]![x!]!, source: 'current_observed_piece_hit_point' };
    }
    work.check(); return proposal;
  }
  bind(proposal: PreviewPackingProposal, _domain?: ObservedInputDomain | null): void {
    const plan = proposal.preview_packing_plan;
    if (!proposal.actions?.length || proposal.actions.length > 16 || !proposal.steps || !plan || !proposal.bundle_template
      || !equal(proposal.actions, proposal.steps.map(s => s.action)) || !equal(proposal.actions, plan.commands)
      || !equal(proposal.actions, proposal.bundle_template.actions)) throw new TypeError('preview exact action binding mismatch');
    if (proposal.preview_policy_hash !== this.policyHash) throw new TypeError('preview policy mismatch');
  }
  before(proposal: PreviewPackingProposal, index: number, publicPacket: NativePublicObservation, obs: NativeObservation): NativeBeforeResult {
    try { this.bind(proposal, null); } catch { return { admitted: false, reason: 'preview_exact_binding_mismatch' }; }
    const v = proposal.preview_packing_plan, action = proposal.actions[index];
    let ok = Number.isInteger(index) && index >= 0 && !!action && proposal.proposal_id === 'preview-packing:' + identity(v)
      && equal(proposal.actions, v.commands) && equal(proposal.actions, proposal.bundle_template.actions)
      && obs.level_epoch === v.epoch && obs.levels_completed === v.score && obs.available_action_refs.includes(action!.action_ref);
    if (index === 0) ok = ok && identity(publicPacket.frame_rows) === v.frame_digest && obs.observation_ref === v.observation_ref;
    else ok = ok && equal(previewPackingPose(publicPacket.frame_rows, v.model), v.before_poses[index]);
    return { admitted: !!ok, reason: ok ? 'current_preview_binding' : 'preview_binding_changed' };
  }
  after(proposal: PreviewPackingProposal, index: number, _before: NativeObservation, after: NativeObservation,
    _rows: NativeRows, later: NativeRows): NativeAfterResult {
    if (!proposal.preview_packing_plan) return { matched: null, seal_prefix: true, reason: 'wrong_provider' };
    const v = proposal.preview_packing_plan, boundary = after.level_epoch !== v.epoch || after.levels_completed !== v.score, expected = v.expected[index];
    const matched = boundary || expected == null ? null : equal(previewPackingPose(later, v.model), expected);
    return { matched, seal_prefix: boundary || matched !== true,
      reason: boundary ? 'boundary' : expected == null ? 'unknown_preview_response' : 'preview_projection' };
  }
  record(before: NativeObservation, after: NativeObservation, command: PreviewPackingCommand, _rows: NativeRows, later: NativeRows,
    proposal?: PreviewPackingProposal | null, _index = 0, _frames?: readonly NativeRows[]): PreviewPackingReturn | null {
    const v = proposal?.preview_packing_plan;
    if (!v) return null;
    if (before.level_epoch !== after.level_epoch) return { kind: 'preview_packing_return', events: [], boundary: true,
      evidence: [before.observation_ref, after.observation_ref] };
    const m = clone(this.memory.packing_model?.epoch === before.level_epoch ? this.memory.packing_model : v.model), controls = clone(this.memory.packing_controls);
    const p = m.pieces.find(piece => piece.id === v.chosen);
    if (!p) throw new TypeError('PreviewPacking return has no chosen occurrence');
    const detail: PreviewPackingEvent['detail'] = { before: before.observation_ref, after: after.observation_ref, command: clone(command), mode: v.mode };
    if (v.mode === 'select') {
      const colors = p.mask.map(([y, x]) => previewPackingSample(later, m, [p.anchor[0] + y, p.anchor[1] + x])[0]);
      if (new Set(colors).size === 1 && colors[0] !== p.color) { m.selected = p.id; m.preview_color = colors[0]!; detail.selection_observed = true; }
      else detail.selection_observed = false;
    } else {
      const old: [Cell, Cell[]] = [clone(p.anchor), clone(p.mask)], pose = previewPackingPose(later, m); detail.observed_pose = clone(pose);
      m.tried.push({ action: command.action_ref, pose: old });
      if (pose) {
        if (equal(pose.mask, p.mask) && !equal(pose.anchor, p.anchor)) {
          const delta: Cell = [pose.anchor[0] - p.anchor[0], pose.anchor[1] - p.anchor[1]];
          if (Math.abs(delta[0]) + Math.abs(delta[1]) === 1) Object.defineProperty(controls, command.action_ref, {
            value: { kind: 'translation', delta, evidence: [before.observation_ref, after.observation_ref] }, enumerable: true, writable: true, configurable: true,
          });
        } else if (equal(pose.anchor, p.anchor)) {
          const fits = (['rotate_cw', 'rotate_ccw', 'reflect_rows', 'reflect_columns'] as PreviewPackingTransform[])
            .filter(name => equal(previewPackingTransform(p.mask, name), pose.mask) && !equal(pose.mask, p.mask));
          if (fits.length === 1) Object.defineProperty(controls, command.action_ref, {
            value: { kind: 'transform', transform: fits[0]!, evidence: [before.observation_ref, after.observation_ref] }, enumerable: true, writable: true, configurable: true,
          });
        }
        p.anchor = clone(pose.anchor); p.mask = clone(pose.mask);
      }
    }
    m.evidence.push(before.observation_ref, after.observation_ref);
    const event: PreviewPackingEvent = { kind: 'observed_preview_packing', model: m, controls, detail };
    this.memory = { ...this.memory, packing_events: [...this.memory.packing_events, clone(event)], packing_model: clone(m), packing_controls: clone(controls) };
    this.changed(); return { kind: 'preview_packing_return', events: [event], boundary: false, evidence: [before.observation_ref, after.observation_ref] };
  }
  sourceState(): PreviewPackingSourceState { return clone(this.memory); }
  restoreSourceState(value: NativeRecord): void {
    object(value, 'source state');
    const next = initialSource();
    for (const name of sourceFields) if (Object.hasOwn(value, name)) (next as NativeRecord)[name] = value[name];
    // Python restores JSON keys through int(). Canonical native checkpoints
    // store the resulting decimal form while preserving each cached value.
    object(next._packing_scene_cache, 'source scene cache');
    next._packing_scene_cache = Object.fromEntries(Object.entries(next._packing_scene_cache).map(([key, v]) => {
      if (!/^[+-]?[0-9]+$/.test(key.trim()) || !Number.isSafeInteger(Number(key)) || Number(key) < 0) invalid('source cache epoch');
      return [String(Number(key)), v];
    }));
    const owned = retainNativeJson(next); validateSource(owned); this.memory = owned; this.changed();
  }
  nativeState(): NativePreviewPackingState {
    if (this.retained) return this.retained;
    const owned = retainNativeJson({ schema: PREVIEW_PACKING_STATE_SCHEMA, ...this.memory });
    validateCheckpoint(owned); this.retained = owned; return owned;
  }
  state(): NativePreviewPackingState { return clone(this.nativeState()); }
  restore(value: NativeRecord): void { this.restoreNative(value); }
  restoreNative(value: Readonly<NativeRecord>): void {
    if (value === this.retained) return;
    const owned = retainNativeJson(value); validateCheckpoint(owned);
    if (this.retained && equal(owned, this.retained)) { this.retained = owned; return; }
    const next: PreviewPackingSourceState = { packing_events: owned.packing_events, packing_model: owned.packing_model,
      packing_controls: owned.packing_controls, _packing_scene_cache: owned._packing_scene_cache };
    // Install only after the whole incoming envelope has been validated. All
    // later writes replace containers, so retained immutable branches are safe.
    this.memory = next; this.retained = owned;
  }
}
