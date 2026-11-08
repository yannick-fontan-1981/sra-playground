/**
 * Supported acquisition closure of the original ObservedCompositionConstraint.
 *
 * The source calls the inherited record chain before record_packet. At this
 * migration stage that chain contains occurrence recall, coupled-pair epoch
 * anchors, pair-response evidence and coupled support planning/acquisition.
 * Other providers remain pending. The retained digest describes this native closure, not the
 * original full ObservedCompositionConstraint inheritance chain.
 */
import { OccurrenceRecallAccess, OccurrenceRecallConstraint, asNativeOccurrenceRecallFamily } from './v6-occurrence-recall.ts';
import type { OccurrenceRecallPolicy } from './v6-occurrence-recall.ts';
import { CoupledPairEvidenceMemory, coupledPairAfter } from './v6-coupled-pair-evidence.ts';
import { proposeCoupledPairGraph, coupledPairBefore } from './v6-coupled-pair-planning.ts';
import { AuxiliarySupportMemory, auxiliarySupportBefore, auxiliarySupportAfter } from './v6-auxiliary-support.ts';
import { rowsDigest } from './v6-native-observer.ts';
import type { ObservedInputDomain } from './v6-native-observer.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import type { OccurrenceRecord as R } from './v6-occurrence-scene.ts';
import type { NativeFamily, NativeRows, NativePublicObservation, NativeProposal } from './v6-native-types.ts';

export const SHARED_SERIES_DIGEST_SCOPE = 'native_recall_ancestors_and_coupled_support_v3';

/** The inherited public reducer participates in the native mutation guard. */
class SharedOccurrenceMemory extends OccurrenceRecallAccess {
  private version = 0;
  get nativeRevision(): number { return this.version; }
  override applyEvent(event: R): void {
    const owned = retainNativeJson(event);
    // Invalidate before the reducer: a partially failed reduction must never
    // authorize reuse of a previously accepted working copy.
    this.version++; super.applyEvent(owned);
  }
}

/**
 * Public working containers remain mutable. A version alone cannot detect a
 * direct edit to memory.lineTrials, a Set/Map or the common event array. This
 * witness owns their small container structure and stops at validated frozen
 * event subtrees, so a cache check never traverses the old cumulative payloads.
 */
type WorkingWitness = { kind: 'leaf'; value: unknown }
  | { kind: 'object'; value: object; fields: readonly (readonly [string, WorkingWitness])[] }
  | { kind: 'map'; value: Map<unknown, unknown>; entries: readonly (readonly [unknown, WorkingWitness])[] }
  | { kind: 'set'; value: Set<unknown>; entries: readonly WorkingWitness[] };

function workingWitness(value: unknown, ancestors = new WeakSet<object>()): WorkingWitness {
  if (value === null || typeof value !== 'object') return { kind: 'leaf', value };
  if (ancestors.has(value)) throw new TypeError('Cyclic shared-series working memory');
  ancestors.add(value);
  try {
    if (value instanceof Map) return { kind: 'map', value, entries: [...value].map(([key, item]) => [key, workingWitness(item, ancestors)]) };
    if (value instanceof Set) return { kind: 'set', value, entries: [...value].map(item => workingWitness(item, ancestors)) };
    // Object.isFrozen alone is not a trust boundary: descendants must also
    // pass the existing ownership validator before identity can be sufficient.
    if (Object.isFrozen(value) && retainNativeJson(value) === value) return { kind: 'leaf', value };
    if (Object.getOwnPropertySymbols(value).length) throw new TypeError('Symbolic shared-series working memory');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    return { kind: 'object', value, fields: Object.entries(descriptors).map(([key, descriptor]) => {
      if (!('value' in descriptor)) throw new TypeError('Accessor shared-series working memory');
      return [key, workingWitness(descriptor.value, ancestors)];
    }) };
  } finally { ancestors.delete(value); }
}

function witnessMatches(witness: WorkingWitness, value: unknown): boolean {
  if (witness.kind === 'leaf') return Object.is(value, witness.value);
  if (value !== witness.value) return false;
  if (witness.kind === 'map') {
    if (witness.value.size !== witness.entries.length) return false;
    const entries = witness.value.entries();
    return witness.entries.every(([key, child]) => {
      const next = entries.next().value;
      return next !== undefined && Object.is(next[0], key) && witnessMatches(child, next[1]);
    });
  }
  if (witness.kind === 'set') {
    if (witness.value.size !== witness.entries.length) return false;
    const entries = witness.value.values();
    return witness.entries.every(child => witnessMatches(child, entries.next().value));
  }
  if (Object.getOwnPropertySymbols(witness.value).length) return false;
  const descriptors = Object.getOwnPropertyDescriptors(witness.value), keys = Object.keys(descriptors);
  return keys.length === witness.fields.length && witness.fields.every(([key, child], index) => key === keys[index]
    && 'value' in descriptors[key]! && witnessMatches(child, descriptors[key]!.value));
}

interface SharedWorkingStamp {
  memory: SharedOccurrenceMemory; memoryRevision: number; memoryWitness: WorkingWitness;
  pairs: CoupledPairEvidenceMemory; pairRevision: number;
  auxiliary: AuxiliarySupportMemory; auxiliaryRevision: number;
  events: WorkingWitness;
}

/** One journal is owned by the already registered public-occurrence provider. */
export class SharedSeriesConstraint extends OccurrenceRecallConstraint {
  override memory = new SharedOccurrenceMemory();
  pairs = new CoupledPairEvidenceMemory();
  auxiliary = new AuxiliarySupportMemory();
  private certified: SharedWorkingStamp | null = null;
  private checkpoint: { value: R; stamp: SharedWorkingStamp; certified: boolean } | null = null;
  private accepted: { value: Readonly<R>; stamp: SharedWorkingStamp } | null = null;

  constructor(config: OccurrenceRecallPolicy) { super(config); this.certified = this.workingStamp(); }

  private workingStamp(): SharedWorkingStamp {
    return { memory: this.memory, memoryRevision: this.memory.nativeRevision, memoryWitness: workingWitness(this.memory),
      pairs: this.pairs, pairRevision: this.pairs.nativeRevision,
      auxiliary: this.auxiliary, auxiliaryRevision: this.auxiliary.nativeRevision, events: workingWitness(this.events) };
  }
  private unchanged(stamp: SharedWorkingStamp): boolean {
    return this.memory === stamp.memory && this.memory.nativeRevision === stamp.memoryRevision
      && this.pairs === stamp.pairs && this.pairs.nativeRevision === stamp.pairRevision
      && this.auxiliary === stamp.auxiliary && this.auxiliary.nativeRevision === stamp.auxiliaryRevision
      && witnessMatches(stamp.events, this.events) && witnessMatches(stamp.memoryWitness, this.memory);
  }

  /** The original goal-access entry, separate from the later occurrence recall. */
  async coupledPropose(observation: R, rows: NativeRows, inputs: readonly R[], remaining: number,
    config: R, levelDeadline: number | null): Promise<R | null> {
    if (remaining < 1) return null;
    if (levelDeadline === null || levelDeadline === undefined) throw new TypeError('Coupled experiment requires current level deadline');
    const pair = this.pairs.currentState(), limit = Math.min(16, remaining), configured = { ...config, remaining_level_actions: remaining };
    const ordinary = (): R => {
      const offered = proposeCoupledPairGraph(pair, observation, rows, inputs, limit, configured);
      if (offered) return offered;
      // The original coupled-support declaration does not enable alternating
      // graphs. Retain that exact parent refusal, which auxiliary selection
      // consults before opening its conditional support question.
      if (truth(config.alternating_graph_question)) throw new TypeError('Alternating-graph planning is outside the transferred coupled-support declaration');
      return { status: 'abstained', reason: 'graph_question_not_enabled' };
    };
    const proposal = this.auxiliary.proposeGraph(pair, observation, rows, inputs, limit, configured, ordinary);
    if (proposal?.block_unrelated_probe) return proposal;
    if (!proposal || proposal.status !== 'proposed' || !['pair_access_plan', 'support_preparation_plan'].some(key => Object.hasOwn(proposal, key))) return null;
    proposal.field_subquestion = 'coupled_support_composition';
    for (const [index, action] of (proposal.actions as R[]).entries()) {
      const step = proposal.steps[index];
      step.expected_before = Object.fromEntries(['level_epoch', 'frame_hash', 'levels_completed', 'state'].map(key => [key, observation[key]]));
      if (action.action_ref === 'ACTION6') {
        const { x, y } = action.data, value = rows.at(y)?.at(x);
        if (value === undefined) throw new RangeError('Selected support point is outside its public frame');
        step.point_support = { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref,
          frame_hash: observation.frame_hash, point: [x, y], palette_value: value, projection_bbox: [x, y, x, y],
          projected_rows_digest: await rowsDigest([[value]]), entity_ref: `current-selected-support:${identity([observation.observation_ref, x, y])}`,
          signature: identity([observation.frame_hash, x, y, value]),
          scope: 'Current visible point only; role/control effect remains a question until physical response. Geometry guards bind the whole current composition independently.' };
      }
    }
    return proposal;
  }

  override bind(proposal: R, domain: ObservedInputDomain): void {
    if (!['pair_access_plan', 'support_preparation_plan'].some(key => Object.hasOwn(proposal, key))) { super.bind(proposal, domain); return; }
    for (const [index, action] of (proposal.actions as R[]).entries()) {
      const step = proposal.steps[index];
      if (action.action_ref === 'ACTION6') {
        if (!equal(step.point_support.point, [action.data.x, action.data.y])) throw new TypeError('Current point changed');
        step.point_binding = { ...step.point_support };
      } else if (truth(action.data)) throw new TypeError('Unexpected discrete control payload');
    }
  }

  override before(proposal: R, index: number, packet: NativePublicObservation, observation: R): R {
    if (truth(proposal.support_preparation_plan)) return auxiliarySupportBefore(proposal, index, packet.frame_rows,
      { epoch: packet.level, score: packet.levels_completed, observation_ref: observation.observation_ref, available: packet.available_action_refs });
    if (truth(proposal.pair_access_plan)) return coupledPairBefore(proposal, index, packet.frame_rows,
      { epoch: packet.level, score: packet.levels_completed, observation_ref: observation.observation_ref, available: packet.available_action_refs });
    return super.before(proposal, index, packet, observation);
  }
  override after(proposal: R, index: number, before: R, after: R, first: NativeRows, second: NativeRows): R {
    if (truth(proposal.support_preparation_plan)) return auxiliarySupportAfter(proposal, index, first, second,
      { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
    if (truth(proposal.pair_access_plan)) return coupledPairAfter(proposal, index, first, second,
      { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
    return super.after(proposal, index, before, after, first, second);
  }

  override record(before: R, after: R, command: R, first: NativeRows, second: NativeRows,
    proposal: R, index: number, frames: readonly NativeRows[] = []): R {
    const certified = this.certified !== null && this.unchanged(this.certified);
    this.certified = null;
    const events = this.memory.record(before, command, after, first, second, proposal, index);
    // The source pair layer first acquires the before-epoch anchor, then its
    // measured response evidence. Packet observation follows the whole chain.
    events.push(...this.pairs.record(before, command, after, first, second, proposal, index));
    const supportEvents = this.auxiliary.record(this.pairs.currentState(), before, command, after, first, second, proposal, index);
    for (const event of supportEvents) if (event.kind === 'coupled_pair_evidence') this.pairs.applyEvent(event);
    events.push(...supportEvents);
    events.push(...this.memory.recordPacket(before, command, after, first, frames));
    // Keep returned source envelopes independently mutable. Only the retained
    // journal owns these frozen copies; old entries keep their identities.
    this.events.push(...events.map(event => retainNativeJson(event)));
    if (certified) this.certified = this.workingStamp();
    return { status: after.levels_completed > before.levels_completed ? 'official_boundary_witness' : 'measured_series_or_insertion_response',
      events, transfer_authority: 'hypothesis_only' };
  }

  override state(): R {
    return { events: structuredClone(this.events), digest: this.auxiliary.retainedDigest(this.pairs.retainedDigest(this.memory.retainedDigest())) };
  }

  /** Internal checkpoint only: public state() still returns an independent copy. */
  nativeState(): R {
    if (this.checkpoint && this.unchanged(this.checkpoint.stamp)) return this.checkpoint.value;
    const certified = this.certified !== null && this.unchanged(this.certified);
    const owned = this.events.map(event => retainNativeJson(event));
    // Direct public journal edits are also owned before entering persistence,
    // but cannot certify agreement with the three reducers on their own.
    if (owned.some((event, index) => event !== this.events[index])) this.events = owned;
    const value = retainNativeJson({ events: this.events,
      digest: this.auxiliary.retainedDigest(this.pairs.retainedDigest(this.memory.retainedDigest())) });
    const stamp = this.workingStamp();
    this.checkpoint = { value, stamp, certified };
    if (certified) this.certified = stamp;
    return value;
  }

  /** An unchanged immutable value never outranks changed working memory. */
  restoreNative(state: Readonly<R>): void {
    const owned = retainNativeJson(state);
    if (this.certified && this.unchanged(this.certified)) {
      if (this.accepted?.value === owned && this.unchanged(this.accepted.stamp)) return;
      if (this.checkpoint?.certified && this.checkpoint.value === owned && this.unchanged(this.checkpoint.stamp)) {
        this.accepted = { value: owned, stamp: this.certified }; return;
      }
    }
    this.restoreOwned(owned);
  }

  override restore(state: R): void {
    // This source-compatible public API always reconstructs and verifies the
    // full state, including a mutable object passed more than once.
    this.restoreOwned(retainNativeJson(state));
  }

  private restoreOwned(state: Readonly<R>): void {
    if (!Array.isArray(state.events) || typeof state.digest !== 'string') throw new TypeError('Incomplete shared series memory');
    const events = [...state.events] as R[], memory = new SharedOccurrenceMemory(), pairs = new CoupledPairEvidenceMemory(), auxiliary = new AuxiliarySupportMemory();
    for (const event of events) {
      if (event.kind === 'coupled_pair_epoch_anchor' || event.kind === 'coupled_pair_evidence') pairs.applyEvent(event);
      else if (event.kind === 'coupled_support_control_model' || event.kind === 'coupled_support_preparation') auxiliary.applyEvent(event);
      else memory.applyEvent(event);
    }
    if (auxiliary.retainedDigest(pairs.retainedDigest(memory.retainedDigest())) !== state.digest) throw new TypeError('Shared series memory changed during recall');
    // Only publish the reconstructed working copies after the complete journal
    // has passed integrity checks. A rejected edit cannot clear learned state.
    this.memory = memory; this.pairs = pairs; this.auxiliary = auxiliary; this.events = events;
    const stamp = this.workingStamp();
    this.certified = stamp; this.accepted = { value: state, stamp };
    this.checkpoint = { value: retainNativeJson({ events: this.events, digest: state.digest }), stamp, certified: true };
  }
}

export function createNativeSharedSeriesFamily(config: OccurrenceRecallPolicy, coupledConfig?: R): NativeFamily {
  const family = new SharedSeriesConstraint(config), adapter = asNativeOccurrenceRecallFamily(family);
  return { ...adapter, nativeState: () => family.nativeState(), restoreNative: state => family.restoreNative(state),
    proposeInGroup: async (group, observation, rows, inputs, remaining, execution) => {
    if (group === 'goal_access') return coupledConfig
      ? await family.coupledPropose(observation, rows, inputs, remaining, coupledConfig, execution?.deadlineMs ?? null) as NativeProposal | null : null;
    if (group === 'window_constraints') return adapter.propose(observation, rows, inputs, remaining, execution);
    return null;
  } };
}
