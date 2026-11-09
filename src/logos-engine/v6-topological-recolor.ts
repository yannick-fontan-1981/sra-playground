/** Pinned V6 TopologicalRecolor owner. Selection and write effects remain
 * revisable observations; neither paints nor carried methods certify a goal.
 * The common caller records this owner only when its proposal was selected.
 */
import { RecolorPolicy } from './v6-topological-recolor-policy.ts';
import { measure, digest, selectionSupportSignature } from './v6-topological-recolor-geometry.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { isJsonObject } from './canonical.ts';
import type { NativeAfterResult, NativeBeforeResult, NativeCommand, NativeFamily, NativeObservation,
  NativeProgramRegistry, NativeProposal, NativePublicObservation, NativeRecord, NativeRecordResult, NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
const FIELDS = ['epoch', 'selection', 'writes', 'attempts', 'portable', 'last'] as const;
const FORMAT = 'native.public_topological_recolor.v1';
const copy = <T>(value: T): T => structuredClone(value);
const key = (p: readonly number[]): string => p.join(',');

function validateState(value: R): R {
  const state = retainNativeJson(value);
  if (Object.keys(state).length !== FIELDS.length || FIELDS.some(k => !Object.hasOwn(state, k))
    || state.epoch !== null && !Number.isSafeInteger(state.epoch)
    || ['selection', 'writes', 'portable'].some(k => !Array.isArray(state[k]) || !state[k].every(isJsonObject))
    || !isJsonObject(state.attempts) || !Object.values(state.attempts).every(isJsonObject)
    || state.last !== null && !isJsonObject(state.last)) throw new TypeError('Incompatible topological-recolor source state');
  return state;
}

function changedPixels(first: NativeRows, second: NativeRows): number[][] {
  const changed: number[][] = [];
  for (let y = 0; y < first.length; y++) for (let x = 0; x < first[y]!.length; x++) {
    if (second[y]?.[x] === undefined) throw new RangeError('Recolor return is smaller than the source raster');
    if (first[y]![x] !== second[y]![x]) changed.push([x, y]);
  }
  return changed;
}

export class TopologicalRecolor implements NativeFamily<any> {
  readonly id = 'public_topological_recolor';
  readonly policy: RecolorPolicy;
  epoch: number | null = null;
  selection: R[] = [];
  writes: R[] = [];
  attempts: R = {};
  portable: R[] = [];
  last: R | null = null;
  private checkpoint: R | null = null;
  private revision = 0;
  private constructor(policy: RecolorPolicy) { this.policy = policy; }
  static async create(): Promise<TopologicalRecolor> { return new TopologicalRecolor(await RecolorPolicy.create()); }
  async attachPrograms(registry: NativeProgramRegistry): Promise<void> { await this.policy.attachPrograms(registry); }
  get nativeRevision(): number { this.nativeState(); return this.revision; }
  state(): R { return copy(Object.fromEntries(FIELDS.map(k => [k, this[k]]))); }
  sourceState(): R { return this.state(); }
  nativeState(): NativeRecord {
    const source = validateState(Object.fromEntries(FIELDS.map(k => [k, this[k]])));
    if (this.checkpoint && equal(this.checkpoint.source_state, source)) return this.checkpoint;
    this.checkpoint = retainNativeJson({ format: FORMAT, source_state: source }); this.revision++; return this.checkpoint;
  }
  restore(value: NativeRecord): void {
    if (!isJsonObject(value)) throw new TypeError('Topological-recolor restore requires a source state mapping');
    const next = validateState({ ...this.state(), ...Object.fromEntries(FIELDS.filter(k => Object.hasOwn(value, k)).map(k => [k, value[k]])) });
    for (const k of FIELDS) (this as unknown as R)[k] = copy(next[k]);
  }
  restoreNative(value: Readonly<NativeRecord>): void {
    if (value === this.checkpoint && equal(this.state(), this.checkpoint!.source_state)) return;
    const supplied = retainNativeJson(value);
    if (!isJsonObject(supplied) || supplied.format !== FORMAT || Object.keys(supplied).length !== 2 || !isJsonObject(supplied.source_state)) {
      throw new TypeError('Invalid native topological-recolor checkpoint');
    }
    const next = validateState(supplied.source_state), changed = !this.checkpoint || !equal(this.checkpoint.source_state, next);
    for (const k of FIELDS) (this as unknown as R)[k] = copy(next[k]);
    this.checkpoint = supplied; if (changed) this.revision++;
  }
  scope(obs: R): void {
    if (this.epoch === obs.level_epoch) return;
    if (this.selection.length || this.writes.length) this.portable.push({ source_epoch: this.epoch, selection: this.selection,
      writes: this.writes, authority: 'method_hypothesis_not_current_permit' });
    this.epoch = obs.level_epoch; this.selection = []; this.writes = []; this.attempts = {}; this.last = null;
  }
  revalidateSelection(m: R, obs: R): R | null {
    const current = selectionSupportSignature(m);
    if (!current.one_distinct_indicator || !current.uniform_well_bodies || !obs.available_action_refs.includes(this.policy.config.point_action)) return null;
    for (const source of [...this.selection, ...this.portable.flatMap(p => p.selection)]) {
      if (equal(source.method_signature, current) && source.action_ref === this.policy.config.point_action && (source.evidence ?? []).length === 2) {
        return { source_evidence: source.evidence, source_epoch: source.source_epoch, current_observation_ref: obs.observation_ref,
          current_epoch: obs.level_epoch, current_frame_hash: obs.frame_hash, method_signature: current, command_ref: source.action_ref,
          status: 'current_supports_match_observed_selection_method', law_status: 'revisable_transfer_hypothesis', release_authority: false };
      }
    }
    return null;
  }
  offers(obs: R, rows: NativeRows): [R[], R | null] {
    const m = measure(rows, obs, this.writes);
    if (!m) return [[], null];
    const revalidation = this.revalidateSelection(m, obs), supported = revalidation !== null, out: R[] = [];
    for (const body of m.bodies as R[]) {
      if (body.value === body.target) continue;
      const needed = m.active !== body.target || !supported, mode = needed ? 'select_pigment' : 'paint_region',
        well = (m.wells as R[]).find(c => c.value === body.target)!, site = needed ? well : body;
      let point = [Math.floor((site.bbox[0] + site.bbox[2]) / 2), Math.floor((site.bbox[1] + site.bbox[3]) / 2)];
      if (!site.cells.some((p: number[]) => equal(p, point))) point = [...site.cells[0]];
      const context = digest([obs.level_epoch, mode, site.cells, body.cells, body.value, body.target, m.mapping, m.active]);
      if (Object.hasOwn(this.attempts, context)) continue;
      out.push({ key: context, mode, point, site, body, measurement: m, facts: { target_differs: true, selection_needed: needed,
        selection_method_supported: supported, relation_kind: body.relation_kind ?? 'shell', shells_currently_match: body.shells_currently_match ?? false,
        partial_topology: body.partial_topology ?? false }, signature: digest(site), method_revalidation: revalidation });
    }
    return [out, m];
  }
  async proposeSource(obs: NativeObservation, rows: NativeRows, _inputs: readonly NativeCommand[], remaining: number): Promise<NativeProposal | null> {
    this.scope(obs); const actionRef = this.policy.config.point_action;
    if (remaining < 1 || !obs.available_action_refs.includes(actionRef)) return null;
    const [offers] = this.offers(obs, rows); if (!offers.length) return null;
    const [choice, workflow] = await this.policy.choose(offers); if (choice.status !== 'selected') return null;
    const s = offers[choice.index]!, [x, y] = s.point, action = { action_ref: actionRef, data: { x, y } },
      facts = { topological_relation_current: true }, focus = 'composition:recolor:' + s.key,
      evidence = [obs.observation_ref, ...(s.method_revalidation ? s.method_revalidation.source_evidence : []),
        ...this.writes.filter(r => r.source_epoch === obs.level_epoch).flatMap(r => r.evidence)];
    return { status: 'proposed', kind: this.id, actions: [action], steps: [{ action, expected_after: null,
      point_binding: { entity_ref: 'region:' + s.signature, observation_ref: obs.observation_ref, signature: s.signature,
        bbox: s.site.bbox, level_epoch: obs.level_epoch, frame_hash: obs.frame_hash, point: [x, y], palette_value: rows[y]![x],
        source: 'current_topological_correspondence' } }], facts,
      binding: Object.fromEntries(['observation_ref', 'level_epoch', 'frame_hash', 'levels_completed'].map(k => [k, obs[k]])),
      recolor_plan: { offer: s, choice, workflow, drm_hash: this.policy.loaded.source_hash },
      compositions: [{ id: focus, role: 'hypothetical_topological_recolor', observed: false, things: ['region:' + s.signature],
        properties: { pocket_count: s.body.pocket_count, topology_scope: s.body.evidence.scope ?? 'complete_visible_region',
          partial_topology: s.body.partial_topology ?? false, correspondence_relation: s.body.relation_kind ?? 'shell',
          target_pigment: s.body.target, goal_hypothesis: true, selection_supported: s.facts.selection_method_supported,
          method_revalidation: s.method_revalidation, partition_write_evidence: this.writes.filter(r => r.source_epoch === obs.level_epoch).map(r => r.evidence),
          unknown: ['write_scope', 'acceptance_rule', 'hidden_partition'], portable_not_permit: this.portable.length },
        relations: ['contributes_to:' + this.policy.config.goal], open_question: choice.reason }],
      question: { reason: choice.reason, hypothesis_refs: choice.hypotheses }, route_refs: evidence,
      bundle_template: { operation_key: 'OP18', composition_ref: focus, objective_ref: this.policy.config.goal,
        purpose: choice.reason, preconditions: facts, evidence, actions: [action], preserve_refs: [], preservation_evidence: {},
        outcome_guard: { path: ['value'], contains: focus } } };
  }
  async propose(obs: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number): Promise<NativeProposal | null> {
    return this.proposeSource(obs, rows, inputs, remaining);
  }
  async proposeInSubquestion(group: string, question: string, obs: NativeObservation, rows: NativeRows,
    inputs: readonly NativeCommand[], remaining: number): Promise<NativeProposal | null> {
    if (group !== 'factored_material_return' || question !== 'topological_recolor') throw new TypeError('Unknown topological-recolor source entry');
    const proposal = await this.propose(obs, rows, inputs, remaining);
    if (proposal) proposal.material_access_subquestion = question; return proposal;
  }
  bind(proposal: R, _preserve?: unknown): void {
    if (proposal.actions.length !== 1 || !equal(proposal.actions, proposal.steps.map((s: R) => s.action ?? null))) {
      throw new TypeError('recolor exact action mismatch');
    }
  }
  before(proposal: R, index: number, publicPacket: NativePublicObservation, obs: NativeObservation): NativeBeforeResult {
    if (index !== 0 || ['observation_ref', 'level_epoch', 'frame_hash'].some(k => !equal(obs[k], proposal.binding[k]))) {
      return { admitted: false, reason: 'scope_changed' };
    }
    this.bind(proposal); const s = proposal.recolor_plan.offer,
      action = { action_ref: this.policy.config.point_action, data: { x: s.point[0], y: s.point[1] } }, [offers] = this.offers(obs, publicPacket.frame_rows);
    return { admitted: offers.filter(o => o.key === s.key && o.signature === s.signature).length === 1
      && equal(action, proposal.actions[0]) && obs.available_action_refs.includes(action.action_ref), reason: 'current_partition_topology_and_exact_point' };
  }
  after(proposal: R, _index: number, _before: NativeObservation, _after: NativeObservation, first: NativeRows, second: NativeRows): NativeAfterResult & R {
    const s = proposal.recolor_plan.offer, m = s.measurement, allowed = new Set<string>();
    if (s.mode === 'paint_region') for (const p of s.body.cells) allowed.add(key(p));
    else for (const well of m.wells) for (let y = well.bbox[1] - 1; y <= well.bbox[3] + 1; y++) {
      for (let x = well.bbox[0] - 1; x <= well.bbox[2] + 1; x++) allowed.add(key([x, y]));
    }
    const changed = changedPixels(first, second), outside = changed.filter(p => !allowed.has(key(p)));
    return { matched: null, preservation_matched: outside.length === 0, seal_prefix: true,
      reason: 'unknown_effect_measured_not_goal_confirmation', changed_count: changed.length, outside_count: outside.length };
  }
  recordSource(before: NativeObservation, after: NativeObservation, command: R, first: NativeRows, second: NativeRows,
    proposal: R | null = null, index = 0): R | null {
    this.scope(before); const refs = [before.observation_ref, after.observation_ref];
    if (before.level_epoch !== after.level_epoch) {
      this.scope(after); return { status: 'boundary', evidence: refs, goal_scope: 'acceptance_only_for_completed_configuration' };
    }
    if (!proposal || !Object.hasOwn(proposal, 'recolor_plan')) return null;
    const s = proposal.recolor_plan.offer, m = measure(second, after, this.writes), changed = changedPixels(first, second),
      result = this.after(proposal, index, before, after, first, second);
    let status = 'unknown_or_no_visible_effect';
    if (s.mode === 'select_pigment' && m && m.active === s.body.target && changed.length && result.preservation_matched) {
      this.selection.push({ evidence: refs, point: s.point, pigment: m.active, scope: 'well_point_selection_observed',
        method_signature: selectionSupportSignature(m), action_ref: command.action_ref, source_epoch: after.level_epoch,
        partition_signature: digest([m.field, m.legend, m.mapping]) }); status = 'selection_observed';
    }
    if (s.mode === 'paint_region' && changed.length) {
      const expected = new Set<string>(s.body.cells.map(key)), painted = changed.filter(([x, y]) => second[y!]![x!] === s.body.target);
      this.writes.push({ evidence: refs, seed: s.point, pigment: s.body.target, changed_mask: changed,
        same_component_scope: changed.length === expected.size && changed.every(p => expected.has(key(p))),
        only_target_pigment: painted.length === changed.length, outside_count: result.outside_count, goal_confirmed: false,
        source_epoch: before.level_epoch, partition_binding: Object.fromEntries(['field', 'legend', 'separator', 'mapping'].map(k => [k, s.measurement[k]])) });
      status = 'write_effect_observed';
    }
    this.attempts[s.key] = { evidence: refs, status };
    this.last = { status, evidence: refs, changed_count: changed.length, comparison: result, goal_hypothesis: true }; return this.last;
  }
  record(before: NativeObservation, after: NativeObservation, command: NativeCommand, first: NativeRows, second: NativeRows,
    proposal: R, index: number, _frames: readonly NativeRows[]): NativeRecordResult {
    return { events: [this.recordSource(before, after, command, first, second, proposal, index)] };
  }
}
