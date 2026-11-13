/**
 * Standalone FramedTransfer owner from pinned V6 framed_transfer/family.py.
 * propose and analogy share this one memory. Actual public point returns from
 * any selected family can enter recordSource; portable records never authorize
 * a command in a new epoch without current geometric revalidation.
 */
import { FramedPolicy } from './v6-framed-transfer-policy.ts';
import { candidates, transition } from './v6-framed-transfer-observation.ts';
import type { FramedOffer } from './v6-framed-transfer-observation.ts';
import { measureCurrentPublicPacketReceptions } from './v6-framed-transfer-public-receptions.ts';
import { measureCurrentPhasedPublicPacketReceptions, PHASED_PUBLIC_PACKET_RECEPTION_CONTRACT } from './v6-framed-transfer-phased-receptions.ts';
import { measureCurrentUniformReceptionQuestions } from './v6-framed-uniform-questions.ts';
import { measureCurrentDirectedReceiverQuestions } from './v6-framed-directed-composition.ts';
import { symbolicDigest } from './v6-hash.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { isJsonObject } from './canonical.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import type { ObservedInputDomain } from './v6-native-observer.ts';
import type { NativeAfterResult, NativeBeforeResult, NativeCommand, NativeExecution, NativeFamily,
  NativeObservation, NativeProgramRegistry, NativeProposal, NativePublicObservation, NativeRecord,
  NativeRecordResult, NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
const FIELDS = ['epoch', 'spans', 'receipts', 'attempts', 'portable', 'last'] as const;
const NATIVE_FORMAT = 'native.public_framed_transfer.v1';
const PUBLIC_PACKET_FORMAT = 'native.public_framed_transfer.v2';
const PACKET_MEMORY_FORMAT = 'native.framed.public_packet_receptions.v1';
const NATIVE_SRC_ANNOTATIONS = new Set(['all_executed_statements', 'instruction_quantum', 'instructions', 'trace',
  'execution_engine', 'reference_commit', 'reference_semantic_hash', 'native_execution_hash', 'source_definition_hash', 'edited']);
const sourceRecordViews = new WeakMap<object, R>();

/**
 * Source record equality sees its four SRC receipt fields. Exclude only the ten
 * native annotations at this exact path, so an original source checkpoint and
 * the same real native return deduplicate. Unknown fields remain significant;
 * the complete native record is still retained for graph execution evidence.
 */
function sourceRecordView(record: R): R {
  const known = sourceRecordViews.get(record); if (known) return known;
  const derivation = record.derivation;
  if (!isJsonObject(derivation) || !isJsonObject(derivation.workflow)) return record;
  const workflow = Object.fromEntries(Object.entries(derivation.workflow).filter(([key]) => !NATIVE_SRC_ANNOTATIONS.has(key)));
  const result = { ...record, derivation: { ...derivation, workflow } };
  // Only owned immutable records enter this comparison in acquisition.
  sourceRecordViews.set(record, result); return result;
}

export interface NativeFramedTransferOptions {
  /** Native current-witness disambiguation after the exact source guard refuses. */
  readonly currentPointWitnessBinding?: boolean;
  /** Actual stable public subframes can support a stationary-receiver observation. */
  readonly currentPublicPacketReceptions?: boolean;
  /** Current reception tasks or source-allowed typed analogies can justify a missing-side calibration. */
  readonly currentUniformReceptionQuestions?: boolean;
  /** Observe a reception after its surrounding support settles within a real returned packet. */
  readonly currentSettledSupportReceptions?: boolean;
  /** Explicit one-step compositions through a currently bound independent receiver. */
  readonly currentDirectedReceptionComposition?: boolean;
}

/** Current native bindings distinguish booleans from measured coordinates. */
function samePublicValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length && left.every((value, index) => samePublicValue(value, right[index]));
  if (!isJsonObject(left) || !isJsonObject(right)) return false;
  return Object.keys(left).length === Object.keys(right).length
    && Object.keys(left).every(key => Object.hasOwn(right, key) && samePublicValue(left[key], right[key]));
}

function hasTypedReceptionPrerequisite(question: R | undefined): boolean {
  return question?.basis_kind === 'current_typed_analogy_prerequisite'
    || question?.basis_kind === 'mixed_current_reception_prerequisites';
}

function calibrationEvidenceStrength(question: R): R {
  const tasks = question.tasks as readonly R[];
  const observedUniform = tasks.filter(task => task.basis_kind !== 'current_typed_analogy_prerequisite'
    && task.receiver?.inner_fills_bbox === true).length;
  const typed = tasks.filter(task => task.basis_kind === 'current_typed_analogy_prerequisite').length;
  return { observed_uniform_task_count: observedUniform, typed_hypothesis_task_count: typed,
    relation_support: observedUniform > 0 ? typed > 0 ? 'observed_uniform_prerequisite_and_typed_hypothesis' : 'observed_uniform_prerequisite'
      : 'typed_hypothesis_only', control_offset_status: 'unknown_until_actual_return' };
}

export interface FramedState extends R {
  readonly epoch: number | null;
  readonly spans: readonly R[];
  readonly receipts: readonly R[];
  readonly attempts: Readonly<Record<string, R>>;
  readonly portable: readonly R[];
  readonly last: R | null;
}
export interface NativePacketReceptionState extends R {
  readonly format: typeof PACKET_MEMORY_FORMAT;
  readonly epoch: number | null;
  readonly receipts: readonly R[];
  readonly portable: readonly R[];
  readonly last: R | null;
}
export interface FramedProposal extends NativeProposal {
  readonly kind: 'public_framed_transfer';
  readonly actions: readonly NativeCommand[];
  readonly steps: readonly R[];
  readonly binding: R;
  readonly framed_transfer_plan: { readonly offer: FramedOffer; readonly choice: R; readonly workflow: R; readonly drm_hash: string;
    readonly native_public_packet_reception?: R; readonly native_uniform_reception_question?: R;
    readonly native_directed_receiver_composition?: R };
}
interface FramedSelection {
  readonly offer: FramedOffer;
  readonly choice: R;
  readonly workflow: R;
  readonly coordination: R | null;
  readonly directed?: R;
}

/** Shape validation is atomic; mutable caller-owned objects are never retained. */
function ownedState(value: R): FramedState {
  const owned = retainNativeJson(value);
  if (Object.keys(owned).length !== FIELDS.length || FIELDS.some(field => !Object.hasOwn(owned, field))
    || owned.epoch !== null && !Number.isSafeInteger(owned.epoch)
    || !Array.isArray(owned.spans) || !owned.spans.every(isJsonObject)
    || !Array.isArray(owned.receipts) || !owned.receipts.every(isJsonObject)
    || !isJsonObject(owned.attempts) || !Object.values(owned.attempts).every(isJsonObject)
    || !Array.isArray(owned.portable) || !owned.portable.every(isJsonObject)
    || owned.last !== null && !isJsonObject(owned.last)) throw new TypeError('Incompatible framed-transfer source state');
  for (const item of owned.portable as R[]) {
    if (item.authority !== 'historical_not_current_permit' || item.source_epoch !== null && !Number.isSafeInteger(item.source_epoch)
      || !Array.isArray(item.spans) || !item.spans.every(isJsonObject)
      || !Array.isArray(item.receipts) || !item.receipts.every(isJsonObject)) throw new TypeError('Invalid historical framed records');
  }
  return owned as FramedState;
}

function emptyPacketState(epoch: number | null): NativePacketReceptionState {
  return retainNativeJson({ format: PACKET_MEMORY_FORMAT, epoch, receipts: [], portable: [], last: null });
}

function ownedPacketState(value: R, epoch: number | null): NativePacketReceptionState {
  const owned = retainNativeJson(value);
  if (!isJsonObject(owned) || owned.format !== PACKET_MEMORY_FORMAT || owned.epoch !== epoch
    || Object.keys(owned).length !== 5 || !Array.isArray(owned.receipts) || !owned.receipts.every(isJsonObject)
    || !Array.isArray(owned.portable) || !owned.portable.every(isJsonObject)
    || owned.last !== null && !isJsonObject(owned.last)) throw new TypeError('Invalid native public-packet reception state');
  const validReceipt = (record: R, expectedEpoch: number | null): boolean => record.context_epoch === expectedEpoch
    && typeof record.source_claim_ref === 'string' && record.source_claim_ref.length > 0
    && Array.isArray(record.evidence) && record.evidence.length === 2 && record.evidence.every((ref: unknown) => typeof ref === 'string')
    && isJsonObject(record.derivation) && isJsonObject(record.derivation.workflow)
    && isJsonObject(record.native_packet_witness) && record.native_packet_witness.causal_action_efficacy_established === false
    && (record.native_packet_witness.schema !== PHASED_PUBLIC_PACKET_RECEPTION_CONTRACT.schema
      || record.native_directed_composition_only === true && record.native_packet_witness.native_directed_composition_only === true);
  if (!(owned.receipts as R[]).every(record => validReceipt(record, epoch))) throw new TypeError('Unbound current public-packet reception receipt');
  for (const history of owned.portable as R[]) if (history.authority !== 'historical_not_current_permit'
    || history.source_epoch !== null && !Number.isSafeInteger(history.source_epoch)
    || !Array.isArray(history.receipts) || !history.receipts.every((record: R) => isJsonObject(record) && validReceipt(record, history.source_epoch))) {
    throw new TypeError('Invalid historical public-packet reception receipts');
  }
  return owned as NativePacketReceptionState;
}

export class FramedTransfer implements NativeFamily<FramedProposal> {
  readonly id = 'public_framed_transfer';
  readonly policy: FramedPolicy;
  private current: FramedState = ownedState({ epoch: null, spans: [], receipts: [], attempts: {}, portable: [], last: null });
  private version = 0;
  private checkpoint: NativeRecord | null = null;
  private readonly currentPointWitnessBinding: boolean;
  private readonly currentPublicPacketReceptions: boolean;
  private readonly currentUniformReceptionQuestions: boolean;
  private readonly currentSettledSupportReceptions: boolean;
  private readonly currentDirectedReceptionComposition: boolean;
  private packetReceptions: NativePacketReceptionState = emptyPacketState(null);
  private constructor(policy: FramedPolicy, options: NativeFramedTransferOptions = {}) {
    this.policy = policy; this.currentPointWitnessBinding = options.currentPointWitnessBinding === true;
    this.currentPublicPacketReceptions = options.currentPublicPacketReceptions === true;
    this.currentUniformReceptionQuestions = options.currentUniformReceptionQuestions === true;
    this.currentSettledSupportReceptions = options.currentSettledSupportReceptions === true;
    this.currentDirectedReceptionComposition = options.currentDirectedReceptionComposition === true;
  }

  static async create(options: NativeFramedTransferOptions = {}): Promise<FramedTransfer> {
    return new FramedTransfer(await FramedPolicy.create(), options);
  }
  async attachPrograms(registry: NativeProgramRegistry): Promise<void> { await this.policy.attachPrograms(registry); }
  get nativeRevision(): number { return this.version; }
  get epoch(): number | null { return this.current.epoch; }
  get spans(): readonly R[] { return this.current.spans; }
  get receipts(): readonly R[] { return this.current.receipts; }
  get attempts(): Readonly<Record<string, R>> { return this.current.attempts; }
  get portable(): readonly R[] { return this.current.portable; }
  get last(): R | null { return this.current.last; }
  private get packetMemoryEnabled(): boolean {
    return this.currentPublicPacketReceptions || this.currentSettledSupportReceptions || this.currentDirectedReceptionComposition;
  }

  private commit(value: R, packets: NativePacketReceptionState = this.packetReceptions): void {
    const next = ownedState(value);
    const annex = ownedPacketState(packets, next.epoch);
    if (next === this.current && annex === this.packetReceptions) return;
    this.current = next; this.packetReceptions = annex; this.version++; this.checkpoint = null;
  }

  /** Exactly the six original source fields, returned as independent JSON. */
  state(): FramedState { return structuredClone(this.current); }

  /** Native graph checkpoints share only validated, deeply immutable branches. */
  nativeState(): NativeRecord {
    this.checkpoint ??= retainNativeJson(this.packetMemoryEnabled
      ? { format: PUBLIC_PACKET_FORMAT, source_state: this.current, public_packet_receptions: this.packetReceptions }
      : { format: NATIVE_FORMAT, source_state: this.current });
    return this.checkpoint;
  }

  /** Independent read-only view; portable examples never enter current candidates. */
  publicPacketReceptionState(): NativePacketReceptionState { return structuredClone(this.packetReceptions); }

  private currentReceipts(observation: Pick<NativeObservation, 'level_epoch'>): readonly R[] {
    return this.currentPublicPacketReceptions && this.packetReceptions.epoch === observation.level_epoch
      ? [...this.receipts, ...this.packetReceptions.receipts.filter(record => record.native_directed_composition_only !== true
        && record.native_packet_witness?.native_directed_composition_only !== true)] : this.receipts;
  }

  private compositionReceipts(observation: Pick<NativeObservation, 'level_epoch'>): readonly R[] {
    return this.packetReceptions.epoch === observation.level_epoch ? [...this.receipts, ...this.packetReceptions.receipts] : this.receipts;
  }

  private packetPremiseWitness(observation: NativeObservation, choice: R): R | null {
    if (!this.currentPublicPacketReceptions || this.packetReceptions.epoch !== observation.level_epoch) return null;
    const premises = choice.projected?.premise_claim_refs;
    if (!Array.isArray(premises)) return null;
    const records = this.packetReceptions.receipts.filter(record => record.native_directed_composition_only !== true
      && record.native_packet_witness?.native_directed_composition_only !== true && premises.includes(record.source_claim_ref));
    if (!records.length) return null;
    return {
      rule: 'native.current_public_packet_reception_premises', observation_ref: observation.observation_ref,
      level_epoch: observation.level_epoch, frame_hash: observation.frame_hash,
      records: records.map(record => ({ source_claim_ref: record.source_claim_ref,
        record_ref: `native_packet_reception:${symbolicDigest(sourceRecordView(record))}`,
        evidence: record.evidence, packet_witness: record.native_packet_witness })),
      release_authority: false, expected_effect_status: 'unknown',
      qualification: 'Observed public replacements support a current question; packet subframes establish no control law.',
    };
  }

  /** Source SRC still selects every offer. Only the explicit native profile
   * narrows a general calibration domain to a measured reception prerequisite. */
  private async selectQuestion(observation: NativeObservation, rows: NativeRows): Promise<FramedSelection | null> {
    const receipts = this.currentReceipts(observation);
    const sourceOffers = await candidates(rows, observation, this.policy, this.spans, receipts, this.attempts);
    if (!sourceOffers.length && !this.currentUniformReceptionQuestions && !this.currentDirectedReceptionComposition) return null;
    const [sourceChoice, sourceWorkflow] = await this.policy.choose(sourceOffers);
    const uniform = this.currentUniformReceptionQuestions || this.currentDirectedReceptionComposition
      ? await measureCurrentUniformReceptionQuestions(rows, observation, this.policy, this.spans, receipts, this.attempts, sourceOffers,
        this.currentDirectedReceptionComposition) : null;
    if (this.currentDirectedReceptionComposition && uniform?.complete) {
      const composition = await this.selectDirectedQuestion(observation, rows, sourceOffers, sourceChoice, sourceWorkflow, uniform.receptionOffers,
        uniform.occupiedReceptionPoints ?? []);
      if (composition !== null) return composition;
    }
    let offers = sourceOffers, choice = sourceChoice, workflow = sourceWorkflow, nativeMeasurement: R | null = null;
    let calibrationPrecedence: R | null = null;
    if (this.currentUniformReceptionQuestions) {
      const measured = uniform!;
      if (measured.complete) {
        nativeMeasurement = measured;
        if (measured.receptionOffers.length) {
          offers = [...sourceOffers, ...measured.receptionOffers];
          [choice, workflow] = await this.policy.choose(offers);
        }
        const revalidatedControl = choice.status === 'selected'
          && choice.projection_ref === 'projection.exploration.revalidated_point_motion_span_question';
        const unqualifiedInterface = choice.status === 'selected'
          && choice.projection_ref === 'projection.exploration.parallel_solid_band_interface_question';
        // Preserve a current observed offset before a purely typed hypothesis
        // whose required control is still unknown. Direct uniform observations
        // retain their existing precedence, including mixed observed/typed tasks.
        const calibrationOffers = measured.calibrationOffers.filter(candidate => !revalidatedControl
          || calibrationEvidenceStrength(candidate.native_uniform_reception_question).observed_uniform_task_count > 0);
        if (calibrationOffers.length && (choice.status === 'abstain' || unqualifiedInterface || revalidatedControl)) {
          const incumbent = choice.status === 'selected' ? offers[choice.index]! : null;
          calibrationPrecedence = {
            rule: 'native.pure_typed_calibration_preserves_revalidated_control',
            incumbent_status: choice.status, incumbent_projection_ref: choice.projection_ref ?? null,
            incumbent_candidate_ref: incumbent?.candidate_ref ?? null,
            incumbent_point: incumbent ? [incumbent.point_x, incumbent.point_y] : null,
            incumbent_revalidated_control: revalidatedControl,
            incumbent_current_support_exact: incumbent?.facts.point_span_current_support_exact === true,
            incumbent_control_premise_refs: incumbent?.facts.point_span_locus_support_claim_refs ?? [],
            pure_typed_permitted_only_before: ['abstain', 'projection.exploration.parallel_solid_band_interface_question'],
            observed_uniform_prerequisite_keeps_existing_precedence: true,
            measured_calibration_offer_count: measured.calibrationOffers.length,
            eligible_calibration_offer_count: calibrationOffers.length,
          };
          offers = [...calibrationOffers];
          [choice, workflow] = await this.policy.choose(offers);
        }
      }
    }
    if (choice.status !== 'selected') return null;
    const offer = offers[choice.index]!;
    if (!offer) throw new TypeError('Framed SRC selected an absent offer');
    const question = offer.native_uniform_reception_question as R | undefined;
    let coordination: R | null = null;
    if (question !== undefined) {
      if (!nativeMeasurement || !['calibration_dependency', 'reception_question'].includes(question.kind)) throw new TypeError('Unmeasured native uniform reception question');
      const sourceSelected = sourceChoice.status === 'selected' ? sourceOffers[sourceChoice.index] : null;
      const typedPrerequisite = hasTypedReceptionPrerequisite(question);
      if (typedPrerequisite && question.kind !== 'calibration_dependency') throw new TypeError('A typed prerequisite cannot become a native reception offer');
      coordination = {
        schema: 'logos-engine.native.uniform-reception-coordination.v1',
        rule: question.kind === 'calibration_dependency'
          ? typedPrerequisite ? 'native.current_typed_reception_dependency' : 'native.current_uniform_reception_dependency'
          : 'native.current_uniform_reception_question',
        observation_ref: observation.observation_ref, level_epoch: observation.level_epoch, frame_hash: observation.frame_hash,
        question, source_choice: sourceChoice, source_choice_workflow: sourceWorkflow,
        source_choice_scope: 'original_candidates_with_current_reception_receipts',
        reception_premises: receipts.filter(record => question.receipt_claim_refs.includes(record.source_claim_ref))
          .map(record => ({ source_claim_ref: record.source_claim_ref,
            record_ref: `framed_reception:${symbolicDigest(sourceRecordView(record))}`,
            context_epoch: record.context_epoch, evidence: record.evidence,
            ...(record.native_packet_witness ? { packet_witness: record.native_packet_witness } : {}) })),
        source_selected_candidate_ref: sourceSelected?.candidate_ref ?? null,
        source_selected_point: sourceSelected ? [sourceSelected.point_x, sourceSelected.point_y] : null,
        selected_candidate_ref: offer.candidate_ref, selected_point: [offer.point_x, offer.point_y],
        selected_projection_ref: choice.projection_ref,
        source_offer_count: sourceOffers.length, current_reception_offer_count: nativeMeasurement.receptionOffers.length,
        current_calibration_offer_count: nativeMeasurement.calibrationOffers.length,
        ...(calibrationPrecedence ? { calibration_precedence: { ...calibrationPrecedence,
          selected_basis: calibrationEvidenceStrength(question), admissible_against_incumbent: true } } : {}),
        selection_scope: question.kind === 'calibration_dependency'
          ? typedPrerequisite ? 'current_source_calibrations_bound_to_a_current_typed_analogy_prerequisite'
            : 'current_source_calibrations_bound_to_an_observed_reception_prerequisite'
          : 'current_source_and_exact_uniform_reception_questions',
        original_physical_candidate: question.kind === 'calibration_dependency'
          ? sourceOffers.some(candidate => ['candidate_ref', 'component_ref', 'point', 'point_x', 'point_y', 'point_value', 'patches', 'bbox', 'signature', 'facts']
            .every(field => samePublicValue(candidate[field], offer[field]))) : false,
        control_offset_status: question.kind === 'calibration_dependency' ? 'unknown_until_actual_return' : 'bound_from_current_observed_span',
        release_authority: false, expected_effect_status: 'unknown',
        qualification: question.kind === 'calibration_dependency'
          ? typedPrerequisite
            ? 'A current source-generated point can test the missing operator side of a current typed analogy supported by an unchanged observed uniform-reception receipt; typed reception and control effect remain hypotheses.'
            : 'A current source-generated point can test the missing operator side of an observed reception task; this action does not claim to perform that reception.'
          : 'Exact current geometry and an observed operator offset support a conditional reception question, not an established terminal or control law.',
      };
      if (question.kind === 'calibration_dependency' && coordination.original_physical_candidate !== true) throw new TypeError('Native calibration is not an unchanged current source offer');
    }
    return { offer, choice, workflow, coordination };
  }

  private async selectDirectedQuestion(observation: NativeObservation, rows: NativeRows, sourceOffers: readonly FramedOffer[],
    sourceChoice: R, sourceWorkflow: R, competingUniformReceptions: readonly FramedOffer[],
    occupiedUniformReceptionPoints: readonly R[]): Promise<FramedSelection | null> {
    const receipts = this.compositionReceipts(observation);
    const measured = await measureCurrentDirectedReceiverQuestions(rows, observation, this.policy, this.spans, receipts, this.attempts,
      [...sourceOffers, ...competingUniformReceptions], occupiedUniformReceptionPoints);
    if (!measured.complete || !measured.offers.length) return null;
    const ready = measured.offers.filter(offer => offer.native_directed_receiver_question.kind === 'test_directed_reception');
    const stage = ready.length ? ready : measured.offers;
    const revalidated = stage.filter(offer => offer.native_directed_receiver_question.source_locus_revalidated === true);
    const domain = revalidated.length ? revalidated : stage;
    const [choice, workflow] = await this.policy.choose(domain); if (choice.status !== 'selected') return null;
    const offer = domain[choice.index]!, question = offer.native_directed_receiver_question;
    const original = sourceChoice.status === 'selected' ? sourceOffers[sourceChoice.index] : null;
    const directed = {
      schema: 'logos-engine.native.directed-receiver-coordination.v1', rule: 'native.current_directed_receiver_composition',
      observation_ref: observation.observation_ref, level_epoch: observation.level_epoch, frame_hash: observation.frame_hash,
      question, source_choice: sourceChoice, source_choice_workflow: sourceWorkflow,
      source_selected_point: original ? [original.point_x, original.point_y] : null,
      source_offer_count: sourceOffers.length, measured_composition_offer_count: measured.offers.length,
      occupied_uniform_reception_points: occupiedUniformReceptionPoints,
      selected_stage: ready.length ? 'current_directed_reception_question' : 'current_receiver_anchor_preparation',
      selected_strength: revalidated.length ? 'original_source_point_locus_revalidated' : 'explicit_competing_offset_hypotheses',
      selected_domain_count: domain.length,
      selection_rule: 'ready_reception_before_preparation_then_revalidated_source_locus_before_exploration_then_unchanged_src',
      early_entry_rule: 'current_co_carried_pair_and_independent_receiver_with_directed_literal_gap',
      reception_premises: receipts.filter(record => question.receipt_claim_refs.includes(record.source_claim_ref))
        .map(record => ({ source_claim_ref: record.source_claim_ref, record_ref: `framed_reception:${symbolicDigest(sourceRecordView(record))}`,
          context_epoch: record.context_epoch, evidence: record.evidence,
          native_directed_composition_only: record.native_directed_composition_only === true,
          ...(record.native_packet_witness ? { packet_witness: record.native_packet_witness } : {}) })),
      release_authority: false, expected_effect_status: 'unknown', stored_action_sequence: false,
      qualification: 'One current point tests a directed receiver composition; all compatible offsets remain explicit and the following phase requires a new actual observation.',
    };
    return { offer, choice, workflow, coordination: null, directed };
  }

  /** Preserve source partial-restore semantics, validating the merged value first. */
  restore(state: NativeRecord): void {
    const supplied = retainNativeJson(state);
    if (!isJsonObject(supplied)) throw new TypeError('Framed restore requires a source state mapping');
    const merged: R = { ...this.current };
    for (const key of FIELDS) if (Object.hasOwn(supplied, key)) merged[key] = supplied[key];
    const next = ownedState(merged);
    // A source-only checkpoint contains no native packet evidence. It cannot
    // silently retain newer acquisition while rolling the source state back.
    this.commit(next, emptyPacketState(next.epoch));
  }

  restoreNative(state: Readonly<NativeRecord>): void {
    if (state === this.checkpoint) return;
    const supplied = retainNativeJson(state);
    if (!isJsonObject(supplied) || !isJsonObject(supplied.source_state)) throw new TypeError('Incompatible native framed-transfer checkpoint');
    const next = ownedState(supplied.source_state);
    let packets: NativePacketReceptionState;
    if (supplied.format === NATIVE_FORMAT && Object.keys(supplied).length === 2) packets = emptyPacketState(next.epoch);
    else if (this.packetMemoryEnabled && supplied.format === PUBLIC_PACKET_FORMAT && Object.keys(supplied).length === 3
      && isJsonObject(supplied.public_packet_receptions)) packets = ownedPacketState(supplied.public_packet_receptions, next.epoch);
    else throw new TypeError('Incompatible native framed-transfer checkpoint');
    this.commit(next, packets);
    if ((supplied.format === PUBLIC_PACKET_FORMAT) === this.packetMemoryEnabled) this.checkpoint = supplied;
  }

  scope(observation: Pick<NativeObservation, 'level_epoch'>): void {
    if (this.epoch === observation.level_epoch) return;
    const portable = this.spans.length || this.receipts.length
      ? [...this.portable, { source_epoch: this.epoch, spans: this.spans, receipts: this.receipts, authority: 'historical_not_current_permit' }]
      : this.portable;
    const packetPortable = this.packetReceptions.receipts.length
      ? [...this.packetReceptions.portable, { source_epoch: this.packetReceptions.epoch,
        receipts: this.packetReceptions.receipts, authority: 'historical_not_current_permit' }]
      : this.packetReceptions.portable;
    this.commit({ epoch: observation.level_epoch, spans: [], receipts: [], attempts: {}, portable, last: null },
      retainNativeJson({ format: PACKET_MEMORY_FORMAT, epoch: observation.level_epoch, receipts: [], portable: packetPortable, last: null }));
  }

  async propose(observation: NativeObservation, rows: NativeRows, _inputs: readonly NativeCommand[], remaining: number,
    _execution?: NativeExecution): Promise<FramedProposal | null> {
    this.scope(observation);
    const actionRef = this.policy.config.point_action as string;
    if (remaining < 1 || !observation.available_action_refs.includes(actionRef)) return null;
    const selection = await this.selectQuestion(observation, rows);
    if (selection === null) return null;
    const { offer: selected, choice, workflow, coordination, directed } = selection;
    const action: NativeCommand = { action_ref: actionRef, data: { x: selected.point_x, y: selected.point_y } };
    const facts = { framed_interface_current: true };
    const nativeQuestion = directed?.question ?? coordination?.question;
    const questionEvidence: string[] = nativeQuestion
      ? [...nativeQuestion.receipt_claim_refs, ...nativeQuestion.span_claim_refs] : [];
    const typedHypotheses: string[] = coordination
      ? [...new Set<string>(coordination.question.tasks.flatMap((task: R) => (task.source_hypotheses ?? []).map((hypothesis: R) => hypothesis.hypothesis_ref)))] : [];
    const evidence = [observation.observation_ref, ...(choice.projected.premise_claim_refs ?? []), ...questionEvidence];
    const focus = `composition:framed:${selected.candidate_ref}`;
    const purpose = directed ? directed.question.kind === 'prepare_uniform_receiver'
      ? 'test_current_receiver_translation_toward_a_directed_literal_gap_anchor'
      : 'test_one_current_directed_reception_through_an_independent_receiver'
      : coordination?.question.kind === 'calibration_dependency'
      ? hasTypedReceptionPrerequisite(coordination.question)
        ? 'qualify_current_operator_side_for_current_typed_reception_hypothesis'
        : 'qualify_current_operator_side_for_observed_uniform_reception'
      : Object.hasOwn(choice.projected, 'subgoal_ref') ? choice.projected.subgoal_ref : 'test_current_framed_relation';
    const pointBinding = { observation_ref: observation.observation_ref, entity_ref: selected.component_ref,
      signature: selected.signature, bbox: selected.bbox, level_epoch: observation.level_epoch, frame_hash: observation.frame_hash,
      point: [selected.point_x, selected.point_y], palette_value: selected.point_value, source: 'measured_parallel_support_pair' };
    const packetPremises = this.packetPremiseWitness(observation, choice);
    return {
      status: 'proposed', kind: 'public_framed_transfer', actions: [action],
      steps: [{ action, expected_after: null, point_binding: pointBinding }], facts,
      binding: { observation_ref: observation.observation_ref, level_epoch: observation.level_epoch,
        frame_hash: observation.frame_hash, levels_completed: observation.levels_completed },
      framed_transfer_plan: { offer: selected, choice, workflow, drm_hash: this.policy.loaded.source_hash,
        ...(packetPremises ? { native_public_packet_reception: packetPremises } : {}),
        ...(coordination ? { native_uniform_reception_question: coordination } : {}),
        ...(directed ? { native_directed_receiver_composition: directed } : {}) },
      compositions: [{ id: focus, role: directed ? 'conditional_directed_receiver_composition' : 'conditional_framed_relation', observed: false,
        things: [selected.component_ref, ...(directed ? [directed.question.source.component_ref, directed.question.ghost.component_ref,
          directed.question.receiver.component_ref] : [])],
        properties: { current_measurement: selected.facts, projected: choice.projected,
          unknown: ['control_effect', 'interior_rigidity', 'cargo_role', 'terminal_role'], portable_records_not_current: this.portable.length,
          ...(packetPremises ? { native_public_packet_reception: packetPremises } : {}),
          ...(coordination ? { native_uniform_reception_question: coordination } : {}),
          ...(directed ? { native_directed_receiver_composition: directed } : {}) },
        relations: [`contributes_to:${this.policy.config.goal}`], open_question: purpose }],
      question: { reason: purpose, hypothesis_refs: [choice.projection_ref, ...(nativeQuestion ? [nativeQuestion.question_ref] : []), ...typedHypotheses,
        ...(directed ? directed.question.receipt_hypotheses.map((hypothesis: R) => hypothesis.hypothesis_ref) : [])] }, route_refs: evidence,
      bundle_template: { operation_key: 'OP18', composition_ref: focus, objective_ref: this.policy.config.goal,
        purpose, preconditions: facts, evidence, actions: [action], preserve_refs: [], preservation_evidence: {},
        outcome_guard: { path: ['value'], contains: focus } },
    };
  }

  async analogy(observation: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number,
    execution?: NativeExecution): Promise<FramedProposal | null> {
    const proposal = await this.propose(observation, rows, inputs, remaining, execution);
    if (proposal) {
      if (this.currentDirectedReceptionComposition && proposal.framed_transfer_plan.native_directed_receiver_composition !== undefined) return proposal;
      const choice = proposal.framed_transfer_plan.choice;
      const conditions = this.policy.config.early_continuation_by_projection[choice.projection_ref];
      if (truth(conditions) && this.policy.holds(conditions, choice.projected)) return proposal;
    }
    return null;
  }

  /** Two ordered caller entries retain one epoch, one history and one last return. */
  async proposeInSubquestion(group: string, subquestion: string, observation: NativeObservation, rows: NativeRows,
    inputs: readonly NativeCommand[], remaining: number, execution?: NativeExecution): Promise<FramedProposal | null> {
    if (group === 'factored_material_return' && subquestion === 'observed_framed_transfer') {
      const proposal = await this.propose(observation, rows, inputs, remaining, execution);
      return proposal === null ? null : { ...proposal, material_access_subquestion: subquestion };
    }
    if (group === 'window_constraints' && subquestion === 'observed_framed_analogy') {
      const proposal = await this.analogy(observation, rows, inputs, remaining, execution);
      return proposal === null ? null : { ...proposal, field_subquestion: subquestion };
    }
    return null;
  }

  bind(proposal: FramedProposal, _preserve?: ObservedInputDomain | null): void {
    if (proposal.actions.length !== 1 || !equal(proposal.actions, proposal.steps.map(step => step.action ?? null))) {
      throw new TypeError('framed action set changed');
    }
  }

  /** Unchanged source guard, including refusal of multiple equal descriptions. */
  async beforeSource(proposal: FramedProposal, index: number, publicPacket: NativePublicObservation,
    observation: NativeObservation): Promise<NativeBeforeResult> {
    if (index !== 0 || ['observation_ref', 'level_epoch', 'frame_hash'].some(key => !equal(observation[key], proposal.binding[key]))) {
      return { admitted: false, reason: 'scope_or_observation_changed' };
    }
    this.bind(proposal, null);
    const offer = proposal.framed_transfer_plan.offer, action = proposal.actions[0]!;
    if (!equal(action, { action_ref: this.policy.config.point_action, data: { x: offer.point_x, y: offer.point_y } })) {
      return { admitted: false, reason: 'payload_changed' };
    }
    const current = await candidates(publicPacket.frame_rows, observation, this.policy, this.spans, this.receipts, {});
    const matches = current.filter(row => row.candidate_ref === offer.candidate_ref && equal(row.patches, offer.patches));
    return { admitted: matches.length === 1 && observation.available_action_refs.includes(action.action_ref),
      reason: 'current_parallel_support_and_payload' };
  }

  /**
   * The default remains the source guard. The opt-in extension only resolves
   * multiple current descriptions of one physical point by the proposal's
   * already selected, uniquely present component witness. It changes neither
   * offer selection nor acquired mechanics and makes no prediction of effect.
   */
  async before(proposal: FramedProposal, index: number, publicPacket: NativePublicObservation,
    observation: NativeObservation): Promise<NativeBeforeResult & { native_binding_receipt?: R }> {
    const source = await this.beforeSource(proposal, index, publicPacket, observation);
    const directedRetained = proposal.framed_transfer_plan.native_directed_receiver_composition;
    const inScope = index === 0 && ['observation_ref', 'level_epoch', 'frame_hash']
      .every(field => samePublicValue(observation[field], proposal.binding[field]));
    const selectedNow = (this.currentDirectedReceptionComposition || this.currentUniformReceptionQuestions) && inScope
      ? await this.selectQuestion(observation, publicPacket.frame_rows) : null;
    if (directedRetained !== undefined || selectedNow?.directed !== undefined) {
      return this.beforeDirectedQuestion(proposal, index, observation, source, selectedNow);
    }
    // Coordination is a native decision even if the unchanged source guard
    // already recognizes this point. Recompute it before any source fast path
    // or packet-premise guard; a stripped coordination cannot inherit a permit.
    const uniformRetained = proposal.framed_transfer_plan.native_uniform_reception_question;
    if (this.currentUniformReceptionQuestions || uniformRetained !== undefined) {
      const current = this.currentUniformReceptionQuestions ? selectedNow : null;
      if (uniformRetained !== undefined || current?.coordination !== null && current?.coordination !== undefined) {
        return this.beforeUniformQuestion(proposal, index, observation, source, current);
      }
    }
    if (proposal.framed_transfer_plan.native_public_packet_reception !== undefined) {
      return this.beforePacketPremise(proposal, index, publicPacket, observation, source);
    }
    if (source.admitted || !this.currentPointWitnessBinding || source.reason !== 'current_parallel_support_and_payload') return source;
    const action = proposal.actions[0]!;
    if (!observation.available_action_refs.includes(action.action_ref)) return source;
    const offer = proposal.framed_transfer_plan.offer;
    const current = await candidates(publicPacket.frame_rows, observation, this.policy, this.spans, this.receipts, {});
    const matches = current.filter(row => row.candidate_ref === offer.candidate_ref && equal(row.patches, offer.patches));
    if (matches.length <= 1) return source;

    const fields = ['candidate_ref', 'patches', 'point', 'point_x', 'point_y', 'point_value', 'bbox', 'signature'] as const;
    const samePhysicalPoint = matches.every(row => fields.every(field => samePublicValue(row[field], offer[field])))
      && samePublicValue(offer.point, [offer.point_y, offer.point_x]);
    const selected = matches.filter(row => row.component_ref === offer.component_ref);
    const binding = proposal.steps[0]?.point_binding;
    const pointBindingCurrent = isJsonObject(binding)
      && binding.entity_ref === offer.component_ref && binding.signature === offer.signature
      && samePublicValue(binding.bbox, offer.bbox) && samePublicValue(binding.point, [offer.point_x, offer.point_y])
      && binding.palette_value === offer.point_value && binding.observation_ref === observation.observation_ref
      && binding.level_epoch === observation.level_epoch && binding.frame_hash === observation.frame_hash;
    const admitted = samePhysicalPoint && selected.length === 1 && pointBindingCurrent;
    return { admitted, reason: admitted ? 'native_current_framed_point_witness_bound' : 'native_current_framed_point_witness_not_bound',
      native_binding_receipt: {
        schema: 'logos-engine.native.current-point-binding.v1', rule: 'native.current_framed_point_witness',
        source_guard: source, observation_ref: observation.observation_ref, level_epoch: observation.level_epoch,
        frame_hash: observation.frame_hash, current_description_count: matches.length,
        current_component_refs: matches.map(row => row.component_ref), selected_component_ref: offer.component_ref,
        selected_current_bindings: selected.length, same_physical_point: samePhysicalPoint,
        point_binding_current: pointBindingCurrent, physical_command: action,
        release_authority: false, expected_effect_status: 'unknown',
        qualification: 'current_public_binding_only_no_effect_claim',
      } };
  }

  private beforeDirectedQuestion(proposal: FramedProposal, index: number, observation: NativeObservation,
    source: NativeBeforeResult, current: FramedSelection | null): NativeBeforeResult & { native_binding_receipt: R } {
    const { offer, choice, workflow } = proposal.framed_transfer_plan, action = proposal.actions[0]!;
    const point = proposal.steps[0]?.point_binding, retained = proposal.framed_transfer_plan.native_directed_receiver_composition;
    const scopeCurrent = this.currentDirectedReceptionComposition && index === 0
      && ['observation_ref', 'level_epoch', 'frame_hash'].every(field => samePublicValue(observation[field], proposal.binding[field]));
    const commandCurrent = samePublicValue(action, { action_ref: this.policy.config.point_action, data: { x: offer.point_x, y: offer.point_y } })
      && observation.available_action_refs.includes(action.action_ref);
    const offerCurrent = current !== null && samePublicValue(current.offer, offer) && samePublicValue(offer.point, [offer.point_y, offer.point_x]);
    const compositionCurrent = current?.directed !== undefined && samePublicValue(current.directed, retained);
    const projectionCurrent = current !== null && samePublicValue(current.choice, choice) && samePublicValue(current.workflow, workflow)
      && proposal.framed_transfer_plan.drm_hash === this.policy.loaded.source_hash;
    const pointCurrent = isJsonObject(point) && point.entity_ref === offer.component_ref && point.signature === offer.signature
      && samePublicValue(point.bbox, offer.bbox) && samePublicValue(point.point, [offer.point_x, offer.point_y])
      && point.palette_value === offer.point_value && point.observation_ref === observation.observation_ref
      && point.level_epoch === observation.level_epoch && point.frame_hash === observation.frame_hash;
    const noEffectClaim = proposal.steps[0]?.expected_after === null && current?.directed?.question.physical_task_count === 1;
    const admitted = scopeCurrent && commandCurrent && offerCurrent && compositionCurrent && projectionCurrent && pointCurrent && noEffectClaim;
    return { admitted, reason: admitted ? 'native_current_directed_receiver_composition_bound' : 'native_current_directed_receiver_composition_not_bound',
      native_binding_receipt: { schema: 'logos-engine.native.current-point-binding.v1', rule: 'native.current_directed_receiver_composition',
        source_guard: source, observation_ref: observation.observation_ref, level_epoch: observation.level_epoch, frame_hash: observation.frame_hash,
        scope_current: scopeCurrent, command_current: commandCurrent, offer_current: offerCurrent, point_binding_current: pointCurrent,
        composition_current: compositionCurrent, projection_current: projectionCurrent, no_effect_claim: noEffectClaim,
        current_composition: current?.directed ?? null, physical_command: action, release_authority: false, expected_effect_status: 'unknown',
        qualification: 'The current composition, directed observation, literal anchor, point and all offset hypotheses are remeasured; one real return is required before any following question.' } };
  }

  private beforeUniformQuestion(proposal: FramedProposal, index: number, observation: NativeObservation,
    source: NativeBeforeResult, current: FramedSelection | null): NativeBeforeResult & { native_binding_receipt: R } {
    const { offer, choice, workflow } = proposal.framed_transfer_plan, action = proposal.actions[0]!;
    const binding = proposal.steps[0]?.point_binding, retained = proposal.framed_transfer_plan.native_uniform_reception_question;
    const scopeCurrent = this.currentUniformReceptionQuestions && index === 0
      && ['observation_ref', 'level_epoch', 'frame_hash'].every(field => samePublicValue(observation[field], proposal.binding[field]));
    const commandCurrent = samePublicValue(action, { action_ref: this.policy.config.point_action, data: { x: offer.point_x, y: offer.point_y } })
      && observation.available_action_refs.includes(action.action_ref);
    const offerCurrent = current !== null && samePublicValue(current.offer, offer)
      && samePublicValue(offer.point, [offer.point_y, offer.point_x]);
    const coordinationCurrent = current?.coordination !== null && current?.coordination !== undefined
      && samePublicValue(current.coordination, retained);
    const pointBindingCurrent = isJsonObject(binding) && binding.entity_ref === offer.component_ref && binding.signature === offer.signature
      && samePublicValue(binding.bbox, offer.bbox) && samePublicValue(binding.point, [offer.point_x, offer.point_y])
      && binding.palette_value === offer.point_value && binding.observation_ref === observation.observation_ref
      && binding.level_epoch === observation.level_epoch && binding.frame_hash === observation.frame_hash;
    const projectionCurrent = current !== null && samePublicValue(current.choice, choice) && samePublicValue(current.workflow, workflow)
      && proposal.framed_transfer_plan.drm_hash === this.policy.loaded.source_hash;
    const packetPremises = this.packetPremiseWitness(observation, choice);
    const packetPremisesCurrent = packetPremises === null
      ? proposal.framed_transfer_plan.native_public_packet_reception === undefined
      : samePublicValue(packetPremises, proposal.framed_transfer_plan.native_public_packet_reception);
    const admitted = scopeCurrent && commandCurrent && offerCurrent && coordinationCurrent && pointBindingCurrent && projectionCurrent && packetPremisesCurrent;
    return { admitted, reason: admitted ? 'native_current_uniform_reception_question_bound' : 'native_current_uniform_reception_question_not_bound',
      native_binding_receipt: {
        schema: 'logos-engine.native.current-point-binding.v1',
        rule: current?.coordination?.rule ?? retained?.rule ?? 'native.current_uniform_reception_question',
        source_guard: source, observation_ref: observation.observation_ref, level_epoch: observation.level_epoch, frame_hash: observation.frame_hash,
        scope_current: scopeCurrent, command_current: commandCurrent, current_offer: offerCurrent,
        coordination_current: coordinationCurrent, point_binding_current: pointBindingCurrent, projection_current: projectionCurrent,
        packet_premises_current: packetPremisesCurrent, current_coordination: current?.coordination ?? null,
        current_reception_premises: packetPremises, selected_component_ref: offer.component_ref,
        physical_command: action, release_authority: false, expected_effect_status: 'unknown',
        qualification: hasTypedReceptionPrerequisite((current?.coordination ?? retained)?.question)
          ? 'A remeasured current typed hypothesis coordinates a missing operator-side test; the original uniform-reception observation is unchanged and the control offset still requires an actual return.'
          : 'A remeasured current question coordinates an observed reception prerequisite; an unknown operator offset must still be learned from its actual return.',
      } };
  }

  private async beforePacketPremise(proposal: FramedProposal, index: number, publicPacket: NativePublicObservation,
    observation: NativeObservation, source: NativeBeforeResult): Promise<NativeBeforeResult & { native_binding_receipt?: R }> {
    if (!this.currentPublicPacketReceptions || index !== 0
      || ['observation_ref', 'level_epoch', 'frame_hash'].some(field => !samePublicValue(observation[field], proposal.binding[field]))) {
      return { admitted: false, reason: 'native_packet_premise_scope_changed' };
    }
    this.bind(proposal, null);
    const { offer, choice } = proposal.framed_transfer_plan, action = proposal.actions[0]!, binding = proposal.steps[0]?.point_binding;
    const commandCurrent = samePublicValue(action, { action_ref: this.policy.config.point_action, data: { x: offer.point_x, y: offer.point_y } })
      && observation.available_action_refs.includes(action.action_ref);
    const retained = this.packetPremiseWitness(observation, choice);
    const premisesCurrent = retained !== null && samePublicValue(retained, proposal.framed_transfer_plan.native_public_packet_reception);
    const current = await candidates(publicPacket.frame_rows, observation, this.policy, this.spans, this.currentReceipts(observation), {});
    const matches = current.filter(row => row.candidate_ref === offer.candidate_ref && samePublicValue(row.patches, offer.patches));
    const selected = matches.filter(row => row.component_ref === offer.component_ref);
    const fields = ['candidate_ref', 'patches', 'point', 'point_x', 'point_y', 'point_value', 'bbox', 'signature'] as const;
    const physicalCurrent = matches.length > 0 && matches.every(row => fields.every(field => samePublicValue(row[field], offer[field])))
      && samePublicValue(offer.point, [offer.point_y, offer.point_x]);
    const pointBindingCurrent = isJsonObject(binding) && binding.entity_ref === offer.component_ref && binding.signature === offer.signature
      && samePublicValue(binding.bbox, offer.bbox) && samePublicValue(binding.point, [offer.point_x, offer.point_y])
      && binding.palette_value === offer.point_value && binding.observation_ref === observation.observation_ref
      && binding.level_epoch === observation.level_epoch && binding.frame_hash === observation.frame_hash;
    const projection = this.policy.projections[choice.projection_ref];
    let projectionCurrent = false;
    if (selected.length === 1 && projection) {
      const facts = selected[0]!.facts;
      projectionCurrent = samePublicValue(facts, offer.facts) && this.policy.holds(projection.all_conditions, facts)
        && this.policy.holds(this.policy.config.local_conditions, facts)
        && this.policy.holds(this.policy.config.projection_scope_conditions?.[choice.projection_ref] ?? [], facts)
        && samePublicValue(this.policy.projected(projection, facts), choice.projected);
    }
    const admitted = commandCurrent && premisesCurrent && physicalCurrent && selected.length === 1 && pointBindingCurrent && projectionCurrent;
    return { admitted, reason: admitted ? 'native_current_packet_reception_question_bound' : 'native_current_packet_reception_question_not_bound',
      native_binding_receipt: {
        schema: 'logos-engine.native.current-point-binding.v1', rule: 'native.current_public_packet_reception_premises',
        source_guard: source, observation_ref: observation.observation_ref, level_epoch: observation.level_epoch, frame_hash: observation.frame_hash,
        current_description_count: matches.length, current_component_refs: matches.map(row => row.component_ref),
        selected_component_ref: offer.component_ref, selected_current_bindings: selected.length,
        same_physical_point: physicalCurrent, point_binding_current: pointBindingCurrent, command_current: commandCurrent,
        reception_premises_current: premisesCurrent, projection_current: projectionCurrent, reception_premises: retained,
        physical_command: action, release_authority: false, expected_effect_status: 'unknown',
        qualification: 'Current raster, current point evidence and actual public packet receipts support only a question; no effect is authorized by an intermediate frame.',
      } };
  }

  after(_proposal: FramedProposal, _index: number, _before: NativeObservation, _after: NativeObservation,
    _first: NativeRows, _second: NativeRows): NativeAfterResult & { preservation_matched: null } {
    return { matched: null, preservation_matched: null, seal_prefix: true,
      reason: 'reconcile_complete_point_transition_without_assumed_mechanics' };
  }

  /** Exact source return, including null for an irrelevant public transition. */
  async recordSource(before: NativeObservation, after: NativeObservation, command: NativeCommand,
    first: NativeRows, second: NativeRows, proposal: NativeProposal | null = null, _index = 0): Promise<R | null> {
    this.scope(before);
    if (command.action_ref !== this.policy.config.point_action || !truth(command.data)) return null;
    const refs = [before.observation_ref, after.observation_ref];
    if (before.level_epoch !== after.level_epoch) {
      this.scope(after); return { status: 'boundary', evidence: refs, portable_not_revalidated: true };
    }
    const relevant = proposal !== null && Object.hasOwn(proposal, 'framed_transfer_plan');
    if (!relevant && !this.spans.length && !(await candidates(first, before, this.policy, [], [], {})).length) return null;
    const version = this.version;
    const [spanFacts, replacementFacts] = await transition(first, second, before, after, command, this.policy, this.spans);
    const spans = [...this.spans], receipts = [...this.receipts], derived: R[] = [];
    const sources: readonly [string, readonly R[], R[]][] = [
      ['policy.record_observed_point_motion_span', spanFacts.point_motion_span_rows, spans],
      ['policy.record_observed_framed_replacement', replacementFacts.framed_replacement_rows, receipts],
    ];
    for (const [key, rows, target] of sources) for (const row of rows) {
      const [result, workflow] = await this.policy.record(key, row);
      if (result.status === 'derived') {
        const record = retainNativeJson({ ...result.record, evidence: refs,
          derivation: { policy: result.policy_ref, rule: result.rule_ref, event: result.event_ref, workflow } });
        if (!target.some(existing => equal(sourceRecordView(existing), sourceRecordView(record)))) target.push(record);
        derived.push(record);
      }
    }
    const unchanged = equal(first, second);
    const attempts = relevant ? { ...this.attempts,
      [(proposal!.framed_transfer_plan as R).offer.candidate_ref]: { evidence: refs, unchanged } } : this.attempts;
    const last = { status: derived.length ? 'observed_records' : 'no_supported_record', evidence: refs,
      spans: spanFacts.point_motion_span_rows.length, replacements: replacementFacts.framed_replacement_rows.length,
      derived, scene_changed: !unchanged, temporal_correspondence: spanFacts.temporal_correspondence ?? null,
      unresolved: 'reception_or_coupled_state_change' };
    if (this.version !== version) throw new Error('Framed state changed during asynchronous acquisition');
    this.commit({ ...this.current, spans, receipts, attempts, last });
    return structuredClone(last);
  }

  async record(before: NativeObservation, after: NativeObservation, command: NativeCommand,
    first: NativeRows, second: NativeRows, proposal: FramedProposal, index: number,
    frames: readonly NativeRows[]): Promise<NativeRecordResult> {
    const result = await this.recordPublicTransition(before, after, command, first, second, proposal, index, frames);
    return { events: result === null ? [] : [result] };
  }

  /** One real command, one source acquisition, then a separately scoped annex. */
  async recordPublicTransition(before: NativeObservation, after: NativeObservation, command: NativeCommand,
    first: NativeRows, second: NativeRows, proposal: NativeProposal | null = null, index = 0,
    frames: readonly NativeRows[] = []): Promise<R | null> {
    const sourceResult = await this.recordSource(before, after, command, first, second, proposal, index);
    if (!this.currentPublicPacketReceptions && !this.currentSettledSupportReceptions) return sourceResult;
    if (command.action_ref !== this.policy.config.point_action || !truth(command.data)) return sourceResult;
    const evidence = [before.observation_ref, after.observation_ref];
    if (before.level_epoch !== after.level_epoch) return { status: 'public_transition_acquired', source_result: sourceResult,
      native_result: { status: 'boundary', evidence, historical_not_current_permit: true, derived: [] } };
    const version = this.version;
    const measured = this.currentPublicPacketReceptions
      ? await measureCurrentPublicPacketReceptions(first, second, before, after, command, frames, this.policy)
      : { complete: true, rows: [], frame_count: frames.length, work_count: 0, reason: undefined };
    const phased = this.currentSettledSupportReceptions
      ? await measureCurrentPhasedPublicPacketReceptions(first, second, before, after, command, frames, this.policy) : null;
    const receipts = [...this.packetReceptions.receipts], derived: R[] = [];
    for (const measurement of [measured, ...(phased ? [phased] : [])]) if (measurement.complete) for (const row of measurement.rows) {
      const [result, workflow] = await this.policy.record('policy.record_observed_framed_replacement', row.facts);
      if (result.status !== 'derived') continue;
      const record = retainNativeJson({ ...result.record, evidence,
        derivation: { policy: result.policy_ref, rule: result.rule_ref, event: result.event_ref, workflow },
        native_packet_witness: row.packet_witness,
        ...(row.packet_witness.native_directed_composition_only === true ? { native_directed_composition_only: true } : {}) });
      if (!receipts.some(existing => equal(sourceRecordView(existing), sourceRecordView(record)))) receipts.push(record);
      derived.push(record);
    }
    const allComplete = measured.complete && (phased?.complete ?? true);
    const nativeResult = { status: derived.length ? 'observed_public_packet_receptions' : allComplete ? 'no_supported_public_packet_reception' : 'public_packet_measurement_incomplete',
      evidence, complete: allComplete, frame_count: measured.frame_count, work_count: measured.work_count + (phased?.work_count ?? 0),
      reason: measured.reason ?? phased?.reason ?? null, derived, intermediate_command_count: 0, causal_action_efficacy_established: false,
      ...(phased ? { phased_measurement: { complete: phased.complete, frame_count: phased.frame_count, work_count: phased.work_count,
        reason: phased.reason ?? null, directed_replacement_count: phased.rows.length, source_candidate_authority: false } } : {}) };
    if (this.version !== version) throw new Error('Framed state changed during public packet acquisition');
    this.commit(this.current, retainNativeJson({ ...this.packetReceptions, receipts, last: nativeResult }));
    return { status: 'public_transition_acquired', source_result: sourceResult, native_result: structuredClone(nativeResult) };
  }
}
