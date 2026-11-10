/** Native owner for the exact linked_temporal_preparation source entry.
 * Source proposal: LinkedPreparation -> PhaseRelations.linked_contact.propose.
 * PhaseRelations and PhaseTransfer acquisition are preserved without activating
 * their separate, unconsumed proposal policies. Native restoration is explicit.
 */
import { measureNativeObservation, validateRows, type ObservedInputDomain } from './v6-native-observer.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { LinkedTemporalPhaseRelations } from './v6-linked-temporal-phase.ts';
import { LINKED_CONTACT_FIELDS, LINKED_CONTACT_SOURCE_POLICY, type LinkedContactPolicy } from './v6-linked-temporal-contact.ts';
import { LinkedTemporalWork, LinkedTemporalWorkBound, temporalClone as clone, temporalDigest as digest, temporalEqual as equal, temporalKey as key,
  type LinkedTemporalSearchBounds, type TemporalRecord as R } from './v6-linked-temporal-common.ts';
import type { NativeAfterResult, NativeBeforeResult, NativeCommand, NativeExecution, NativeFamily, NativeObservation,
  NativeProposal, NativePublicObservation, NativeRecord, NativeRecordResult, NativeRows } from './v6-native-types.ts';

export { LINKED_TEMPORAL_NATIVE_SEARCH_BOUNDS, LinkedTemporalWorkBound } from './v6-linked-temporal-common.ts';
export { LINKED_CONTACT_SOURCE_POLICY } from './v6-linked-temporal-contact.ts';
export interface LinkedTemporalOptions { boundedSearch?: LinkedTemporalSearchBounds }
export const LINKED_TEMPORAL_STATE_SCHEMA = 'logos-engine.linked-temporal-preparation.v1';
const validatedSnapshots = new WeakSet<object>(), validatedCheckpoints = new WeakSet<object>();
const validatedGeometry = new WeakMap<object, { digest: string; width: number; height: number }>();

function object(value: any, label: string): asserts value is R {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid linked temporal ' + label);
}
function array(value: any, label: string): asserts value is any[] { if (!Array.isArray(value)) throw new TypeError('Invalid linked temporal ' + label); }
function integer(value: any, label: string, minimum = Number.MIN_SAFE_INTEGER): void {
  if (!Number.isSafeInteger(value) || value < minimum) throw new TypeError('Invalid linked temporal ' + label);
}
function string(value: any, label: string): void { if (typeof value !== 'string') throw new TypeError('Invalid linked temporal ' + label); }
function boolean(value: any, label: string): void { if (typeof value !== 'boolean') throw new TypeError('Invalid linked temporal ' + label); }
function point(value: any, label: string): void { array(value, label); if (value.length !== 2) throw new TypeError('Invalid linked temporal ' + label); value.forEach(n => integer(n, label)); }
function points(value: any, label: string): void { array(value, label); value.forEach(p => point(p, label)); }
function fields(value: R, names: readonly string[], label: string): void { for (const name of names) if (!Object.hasOwn(value, name)) throw new TypeError('Missing linked temporal ' + label + '.' + name); }
function entries(value: any, label: string, keyCheck?: (k: any) => void, itemCheck?: (v: any) => void): void {
  array(value, label); const keys = new Set<string>();
  for (const row of value) { array(row, label); if (row.length !== 2 || keys.has(key(row[0]))) throw new TypeError('Invalid or duplicate linked temporal ' + label + ' key');
    keys.add(key(row[0])); keyCheck?.(row[0]); itemCheck?.(row[1]); }
}
function set(value: any, label: string): void { array(value, label); if (new Set(value.map(key)).size !== value.length) throw new TypeError('Duplicate linked temporal ' + label); }
function changes(value: any, label: string): void {
  array(value, label); for (const p of value) { array(p, label); if (p.length !== 4) throw new TypeError('Invalid linked temporal ' + label);
    p.forEach((n: any) => integer(n, label)); if (p[2] < 0 || p[2] > 255 || p[3] < 0 || p[3] > 255) throw new TypeError('Invalid linked temporal palette'); }
}
function bytes(value: any, label: string): void { if (value === null) return; array(value, label); for (const n of value) { integer(n, label, 0); if (n > 255) throw new TypeError('Invalid linked temporal bytes'); } }
function validateObservation(observation: R, rows: NativeRows, requireEntities = true): void {
  validateRows(rows); object(observation, 'observation');
  if (requireEntities || Object.hasOwn(observation, 'entities')) array(observation.entities, 'entities');
  for (const field of ['revision', 'level_epoch', 'levels_completed']) integer(observation[field], field, 0);
  for (const field of ['observation_ref', 'frame_hash', 'state']) string(observation[field], field);
  array(observation.available_action_refs, 'available action references'); observation.available_action_refs.forEach((s: any) => string(s, 'action reference'));
  for (const entity of (observation.entities ?? []) as R[]) {
    object(entity, 'entity'); string(entity.signature, 'entity signature'); point(entity.position, 'entity position'); points(entity.mask, 'entity mask');
    array(entity.bbox, 'entity box'); if (entity.bbox.length !== 4) throw new TypeError('Invalid linked temporal entity box'); entity.bbox.forEach((n: any) => integer(n, 'entity box'));
    integer(entity.area, 'entity area', 0); integer(entity.palette_value, 'entity palette', 0); boolean(entity.identity_ambiguous, 'entity ambiguity');
    if (entity.palette_value > 255) throw new TypeError('Invalid linked temporal entity palette');
  }
}
function validateContact(value: R, phase: R, policy: LinkedContactPolicy): void {
  object(value, 'contact state'); fields(value, [...LINKED_CONTACT_FIELDS, 'policy', 'vectors', 'tested', 'persistent_sites'], 'contact');
  if (!equal(value.policy, policy)) throw new TypeError('Linked temporal policy changed across restoration');
  for (const k of ['phase_changed', 'replay_refuted', 'recording_next']) boolean(value[k], k);
  for (const k of ['replay_cursor', 'phase_start', 'replay_ticks', 'waited', 'seen']) integer(value[k], k, 0);
  if (value.seen > phase.commands.length || value.phase_start > phase.commands.length) throw new TypeError('Linked temporal cursor exceeds acquired history');
  for (const k of ['nodes', 'replay_motion_support', 'replay_blocked_support', 'slot_boxes', 'history_paths', 'prepared', 'prepared_effects', 'events']) array(value[k], k);
  for (const path of value.history_paths) { points(path, 'recorded path'); if (!path.length) throw new TypeError('Empty linked temporal recorded path'); }
  points(value.prepared, 'prepared sites'); if (value.prepared.length !== value.history_paths.length) throw new TypeError('Linked temporal prepared sites disagree with recorded paths');
  if (value.slot_count !== null) integer(value.slot_count, 'slot count', 2);
  if (value.phase_action !== null) string(value.phase_action, 'phase action');
  entries(value.vectors, 'vectors', k => string(k, 'vector action'), v => point(v, 'vector')); set(value.tested, 'tested inputs'); set(value.persistent_sites, 'persistent sites');
  for (const row of value.tested) { if (!Array.isArray(row) || row.length !== 2) throw new TypeError('Invalid linked temporal tested input'); point(row[0], 'tested position'); string(row[1], 'tested action'); }
  points(value.persistent_sites, 'persistent sites');
  if (value.body !== null) {
    object(value.body, 'body'); fields(value.body, ['signature', 'size', 'start', 'palette', 'floor', 'quantum', 'mask'], 'body');
    string(value.body.signature, 'body signature'); point(value.body.size, 'body size'); value.body.size.forEach((n: any) => integer(n, 'body size', 2));
    point(value.body.start, 'body start'); points(value.body.mask, 'body mask'); integer(value.body.quantum, 'body quantum', 1);
    if (value.body.quantum <= Math.max(...value.body.size)) throw new TypeError('Linked temporal body quantum was not an observed inter-cell displacement');
    for (const k of ['palette', 'floor']) { integer(value.body[k], 'body ' + k, 0); if (value.body[k] > 255) throw new TypeError('Invalid linked temporal body palette'); }
    if (!Object.hasOwn(phase.geometry, value.body.signature) || !equal(phase.size[value.body.signature], value.body.size)
      || !equal(phase.masks[value.body.signature], value.body.mask)) throw new TypeError('Linked temporal body disagrees with its acquired geometry');
    point(value.goal, 'goal');
  } else if (value.selected !== null || value.contact !== null || value.phase_changed || value.history_paths.length || value.vectors.length) throw new TypeError('Linked temporal state has effects without an acquired body');
  for (const node of value.nodes) { object(node, 'node'); point(node.position, 'node position'); points(node.support, 'node support'); points(node.peer_support, 'peer support'); }
  if (value.selected !== null && !value.nodes.some((node: R) => equal(node, value.selected))) throw new TypeError('Linked temporal selected occurrence is not acquired');
  if (value.contact !== null) { object(value.contact, 'contact'); changes(value.contact.pixels, 'contact pixels'); point(value.contact.site, 'contact site'); point(value.contact.from, 'contact origin'); }
  if (value.departure !== null && value.contact === null || value.reversal !== null && value.departure === null) throw new TypeError('Linked temporal effect chronology is incomplete');
  if (value.phase_trial !== null) { object(value.phase_trial, 'phase trial'); points(value.phase_trial.source_path, 'phase source path');
    if (!value.phase_trial.source_path.length || !value.history_paths.some((path: any) => equal(path, value.phase_trial.source_path))) throw new TypeError('Linked temporal phase trial has no retained path'); }
  if (value.phase_changed && value.phase_trial === null) throw new TypeError('Linked temporal phase change lacks its frozen trial');
  for (const effect of value.prepared_effects) { object(effect, 'prepared effect'); point(effect.site, 'effect site'); changes(effect.pixels, 'effect pixels');
    if (!['persistent_after_observed_departure', 'reversible_occupancy'].includes(effect.kind)) throw new TypeError('Unknown linked temporal prepared effect'); array(effect.evidence, 'effect evidence'); }
}
function validatePortable(value: R): void {
  object(value, 'portable state'); fields(value, ['prior', 'start', 'sites', 'exits', 'samples', 'pending', 'prepared', 'mode_edges', 'failures', 'attempted',
    'hold_observed', 'visited', 'cache', 'cycles', 'site_trials', 'local_vectors', 'portable_misses'], 'portable');
  object(value.prior, 'portable prior'); fields(value.prior, ['marker', 'primary', 'secondary', 'shape', 'mask', 'size', 'switch', 'vectors', 'locus_template', 'terminal_template', 'walkable', 'boundary', 'entry', 'leave', 'source_validation'], 'portable prior');
  for (const k of ['marker', 'primary', 'secondary', 'shape', 'switch', 'boundary', 'entry', 'leave', 'source_validation']) string(value.prior[k], 'portable ' + k);
  points(value.prior.mask, 'portable mask'); point(value.prior.size, 'portable size'); value.prior.size.forEach((n: any) => integer(n, 'portable size', 1));
  object(value.prior.vectors, 'portable vectors'); Object.values(value.prior.vectors).forEach(v => point(v, 'portable vector'));
  bytes(value.prior.locus_template, 'locus template'); bytes(value.prior.terminal_template, 'terminal template'); array(value.prior.walkable, 'walkable'); value.prior.walkable.forEach((v: any) => bytes(v, 'walkable tile'));
  if (digest(value.prior.mask, false) !== value.prior.shape) throw new TypeError('Linked temporal portable shape digest disagrees with its mask');
  const area = value.prior.size[0] * value.prior.size[1];
  for (const tile of [value.prior.locus_template, value.prior.terminal_template, ...value.prior.walkable]) if (tile !== null && tile.length !== area) throw new TypeError('Linked temporal portable template does not cover its declared size');
  if (value.start !== null) string(value.start, 'portable start');
  for (const k of ['sites', 'exits']) { set(value[k], k); points(value[k], k); }
  for (const k of ['samples', 'pending']) entries(value[k], k, p => point(p, k), v => { object(v, k); changes(v.pixels, k + ' pixels'); });
  entries(value.mode_edges, 'mode edges', p => point(p, 'mode'), p => point(p, 'next mode'));
  for (const k of ['failures', 'attempted', 'site_trials']) entries(value[k], k, undefined, n => integer(n, k, 0));
  for (const k of ['visited', 'local_vectors']) entries(value[k], k, undefined, v => { set(v, k); points(v, k); });
  for (const k of ['hold_observed', 'portable_misses']) set(value[k], k);
  array(value.prepared, 'portable prepared'); array(value.cycles, 'portable cycles');
}
function validateCheckpoint(value: R, policy: LinkedContactPolicy): void {
  if (validatedCheckpoints.has(value)) return;
  if (value.schema !== LINKED_TEMPORAL_STATE_SCHEMA) throw new TypeError('Invalid linked temporal checkpoint schema');
  fields(value, ['phase', 'events', 'passed', 'current_observation'], 'checkpoint'); const phase = value.phase;
  object(phase, 'phase'); fields(phase, ['epoch', 'states', 'commands', 'geometry', 'size', 'masks', 'portable', 'model', 'trial', 'supported', 'remote', 'checked', 'events', 'attempts', 'missed', 'linked_contact'], 'phase');
  if (phase.epoch !== null) integer(phase.epoch, 'epoch', 0);
  array(phase.states, 'states'); array(phase.commands, 'commands');
  if (phase.commands.length !== Math.max(0, phase.states.length - 1)) throw new TypeError('Linked temporal state/command history is not contiguous');
  for (const command of phase.commands) if (command !== null) string(command, 'retained command');
  for (const k of ['geometry', 'size', 'masks']) object(phase[k], k);
  const signatures = Object.keys(phase.geometry); if (!equal([...signatures].sort(), Object.keys(phase.size).sort()) || !equal([...signatures].sort(), Object.keys(phase.masks).sort())) throw new TypeError('Linked temporal geometry registries disagree');
  for (const signature of signatures) {
    string(phase.geometry[signature], 'geometry digest'); point(phase.size[signature], 'geometry size');
    phase.size[signature].forEach((n: any) => integer(n, 'geometry size', 1)); const mask = phase.masks[signature];
    array(mask, 'geometry mask'); const [w, h] = phase.size[signature], known = validatedGeometry.get(mask);
    if (known) {
      if (known.digest !== phase.geometry[signature] || known.width !== w || known.height !== h) throw new TypeError('Linked temporal retained geometry binding changed');
      continue;
    }
    points(mask, 'geometry mask');
    if (!mask.length || new Set(mask.map(key)).size !== mask.length) throw new TypeError('Invalid linked temporal geometry mask');
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of mask) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
    if (minX !== 0 || minY !== 0 || maxX + 1 !== w || maxY + 1 !== h)
      throw new TypeError('Linked temporal geometry mask disagrees with its measured size');
    const actual = digest(mask, false);
    if (actual !== phase.geometry[signature]) throw new TypeError('Linked temporal geometry digest disagrees with its mask');
    validatedGeometry.set(mask, { digest: actual, width: w, height: h });
  }
  const references = new Set<string>();
  for (const state of phase.states) {
    object(state, 'snapshot'); fields(state, ['ref', 'frame', 'poses', 'occurrences', 'rows'], 'snapshot'); string(state.ref, 'snapshot reference');
    if (references.has(state.ref)) throw new TypeError('Duplicate linked temporal observation reference'); references.add(state.ref);
    if (!validatedSnapshots.has(state)) { string(state.frame, 'snapshot frame'); validateRows(state.rows); object(state.poses, 'snapshot poses'); array(state.occurrences, 'snapshot occurrences');
      Object.values(state.poses).forEach(p => point(p, 'snapshot pose')); for (const occurrence of state.occurrences) { object(occurrence, 'occurrence');
        string(occurrence.signature, 'occurrence signature'); string(occurrence.geometry, 'occurrence geometry'); point(occurrence.position, 'occurrence position'); } validatedSnapshots.add(state); }
    for (const signature of Object.keys(state.poses)) if (!Object.hasOwn(phase.geometry, signature)) throw new TypeError('Linked temporal snapshot has unknown geometry');
  }
  if (phase.states.length && phase.epoch === null) throw new TypeError('Linked temporal snapshots have no epoch');
  for (const k of ['checked', 'missed']) set(phase[k], k); entries(phase.attempts, 'phase attempts', undefined, n => integer(n, 'attempt count', 0)); array(phase.events, 'phase events');
  if (phase.model !== null) { object(phase.model, 'phase model'); for (const k of ['marker', 'primary', 'other']) {
    string(phase.model[k], 'phase role'); if (!Object.hasOwn(phase.geometry, phase.model[k])) throw new TypeError('Linked temporal model has unknown geometry'); } }
  if (phase.trial !== null) { object(phase.trial, 'phase trial'); points(phase.trial.source_path, 'predicted source path'); points(phase.trial.visible, 'visible path'); set(phase.trial.primary_at_endpoint, 'primary positions'); points(phase.trial.primary_at_endpoint, 'primary positions'); boolean(phase.trial.refuted, 'trial refutation'); }
  if (phase.remote !== null) { object(phase.remote, 'remote'); changes(phase.remote.pixels, 'remote pixels'); point(phase.remote.site, 'remote site'); }
  validateContact(phase.linked_contact, phase, policy); if (phase.portable !== null) validatePortable(phase.portable);
  array(value.events, 'adapter events'); array(value.passed, 'scored witnesses');
  for (const event of value.passed) { object(event, 'scored witness'); integer(event.score, 'scored witness', 0); string(event.observation_ref, 'scored witness reference'); }
  if (value.current_observation !== null) object(value.current_observation, 'current observation');
  validatedCheckpoints.add(value);
}

export class LinkedTemporalPreparation implements NativeFamily<any> {
  readonly id = 'linked_temporal_preparation';
  phase: LinkedTemporalPhaseRelations; events: R[] = []; passed: R[] = []; current_observation: R | null = null;
  private refusal: R | null = null; private retained: R | null = null;
  readonly policy: LinkedContactPolicy; readonly boundedSearch: LinkedTemporalSearchBounds | undefined;
  constructor(policy: LinkedContactPolicy = LINKED_CONTACT_SOURCE_POLICY, options: LinkedTemporalOptions = {}) {
    this.policy = retainNativeJson(policy); this.phase = new LinkedTemporalPhaseRelations(this.policy);
    this.boundedSearch = options.boundedSearch ? { ...options.boundedSearch } : undefined;
    if (this.boundedSearch) new LinkedTemporalWork(this.boundedSearch);
  }
  static async fullObservation(observation: R, rows: NativeRows): Promise<R> {
    if (Object.hasOwn(observation, 'entities')) return observation;
    return measureNativeObservation({ frame_rows: rows, level: observation.level_epoch, levels_completed: observation.levels_completed,
      state: observation.state, frame_hash: observation.frame_hash, available_action_refs: observation.available_action_refs },
    observation.revision, observation.observation_ref.split(':epoch:')[0]);
  }
  private changed(): void { this.retained = null; this.refusal = null; }
  propose(observation: NativeObservation | R, rows: NativeRows, inputs: readonly NativeCommand[] | readonly R[], remaining: number, execution?: NativeExecution): R | null {
    this.changed(); if (!this.phase.states.length) return null;
    validateObservation(observation, rows, !this.phase.linked_contact.body && this.phase.states.length >= 2 && this.policy.enabled); integer(remaining, 'remaining action budget');
    const before = this.boundedSearch ? clone(this.phase.linked_contact.sourceState()) : null;
    try {
      const work = this.boundedSearch ? new LinkedTemporalWork(this.boundedSearch, execution) : undefined;
      const proposal = this.phase.linked_contact.propose(this.phase, observation, rows, inputs, remaining, work);
      work?.check(); if (proposal) proposal.linked_preparation_plan = true; return proposal;
    } catch (error) {
      if (!(error instanceof LinkedTemporalWorkBound) || !before) throw error;
      this.phase.linked_contact.restoreSource(before);
      this.refusal = { status: 'unknown', reason: 'linked_temporal_search_work_bound', observation_ref: observation.observation_ref,
        level_epoch: observation.level_epoch, frame_hash: observation.frame_hash, release_authority: false, block_unrelated_probe: true,
        exhausted_bound: error.bound, frontier: { complete: false, nodes: error.nodes, work: error.work,
          maximum_nodes: this.boundedSearch!.maximumNodes ?? null, maximum_work: this.boundedSearch!.maximumWork ?? null,
          deadline_ms: execution?.deadlineMs ?? null, scope: 'An incomplete linked-contact question; no action, refutation or acquired impossibility.' } };
      return null;
    }
  }
  currentProposalRefusal(observation: NativeObservation | R): NativeRecord | null {
    return this.refusal && ['observation_ref', 'level_epoch', 'frame_hash'].every(k => this.refusal![k] === observation[k]) ? clone(this.refusal) : null;
  }
  bind(proposal: NativeProposal | R, domain: ObservedInputDomain): void { domain.bindProposal(proposal as any); }
  async before(proposal: R, index: number, publicPacket: NativePublicObservation | R, observation: NativeObservation | R): Promise<NativeBeforeResult> {
    this.changed(); this.current_observation = retainNativeJson(await LinkedTemporalPreparation.fullObservation(observation, publicPacket.frame_rows));
    return this.phase.before(proposal, index, publicPacket, this.current_observation);
  }
  async after(proposal: R, index: number, before: NativeObservation | R, after: NativeObservation | R, first: NativeRows, second: NativeRows): Promise<NativeAfterResult> {
    this.changed(); const prior = await LinkedTemporalPreparation.fullObservation(before, first);
    this.current_observation = retainNativeJson(await LinkedTemporalPreparation.fullObservation(after, second));
    return this.phase.after(proposal, index, prior, this.current_observation, first, second);
  }
  recordSource(before: NativeObservation | R, after: NativeObservation | R, command: NativeCommand | R, first: NativeRows, second: NativeRows, _proposal?: R, _index?: number): R[] {
    this.changed();
    const boundary = before.level_epoch !== after.level_epoch || before.state !== after.state;
    validateObservation(before, first, !boundary && (this.phase.epoch !== before.level_epoch || !this.phase.states.length)); validateObservation(after, second);
    const events = this.phase.record(before, after, command, first, second); this.events.push(...events.map(event => retainNativeJson(event)));
    if (after.levels_completed > before.levels_completed) this.passed.push(retainNativeJson({ score: after.levels_completed, observation_ref: after.observation_ref }));
    return events;
  }
  record(before: NativeObservation, after: NativeObservation, command: NativeCommand, first: NativeRows, second: NativeRows, proposal?: any, index?: number, _frames?: readonly NativeRows[]): NativeRecordResult {
    return { events: this.recordSource(before, after, command, first, second, proposal, index) };
  }
  preservationObligations(observation: NativeObservation | R, rows: NativeRows): R[] { return this.phase.linked_contact.preservationObligations(observation, rows); }
  sourceState(): R { return clone({ phase: this.phase.sourceState(), events: this.events, passed: this.passed, current_observation: this.current_observation }); }
  nativeState(): R {
    if (!this.retained) {
      const state = retainNativeJson({ schema: LINKED_TEMPORAL_STATE_SCHEMA, phase: this.phase.sourceState(), events: this.events, passed: this.passed, current_observation: this.current_observation });
      validateCheckpoint(state, this.policy); this.retained = state;
    }
    return this.retained;
  }
  state(): R { return clone(this.nativeState()); }
  restore(value: NativeRecord): void { this.restoreNative(value); }
  restoreNative(value: Readonly<NativeRecord>): void {
    if (value === this.retained) return;
    const owned = retainNativeJson(value) as R; validateCheckpoint(owned, this.policy);
    // Reconstruct off to the side. Invalid checkpoints never publish a partial owner.
    const phase = new LinkedTemporalPhaseRelations(this.policy); phase.restoreSource(owned.phase);
    const events = [...owned.events], passed = [...owned.passed], current = owned.current_observation;
    this.phase = phase; this.events = events; this.passed = passed; this.current_observation = current; this.retained = owned; this.refusal = null;
  }
}
