/**
 * Supported acquisition closure of the original ObservedCompositionConstraint.
 *
 * The source calls the inherited record chain before record_packet. At this
 * migration stage that chain contains observed-program composition, occurrence recall, cell-patch placement,
 * coupled-pair epoch anchors, alternating graph evidence, pair-response evidence
 * and coupled support planning/acquisition, followed by the panel-service layer.
 * Panel service is one of the six observed-composition service branches.
 * Other providers remain pending. The retained digest describes this native closure, not the
 * original full ObservedCompositionConstraint inheritance chain.
 */
import { OccurrenceRecallAccess, OccurrenceRecallConstraint, asNativeOccurrenceRecallFamily } from './v6-occurrence-recall.ts';
import type { OccurrenceRecallPolicy } from './v6-occurrence-recall.ts';
import { CoupledPairEvidenceMemory, coupledPairAfter } from './v6-coupled-pair-evidence.ts';
import { proposeCoupledPairGraph, coupledPairBefore } from './v6-coupled-pair-planning.ts';
import { AuxiliarySupportMemory, auxiliarySupportBefore, auxiliarySupportAfter } from './v6-auxiliary-support.ts';
import { PanelServiceMemory, proposePanelService, panelServiceBefore, panelServiceAfter } from './v6-panel-service-access.ts';
import { panelServiceInputCandidates } from './v6-panel-service-observation.ts';
import { AlternatingGraphMemory, alternatingGraphBefore, alternatingGraphAfter } from './v6-alternating-graph-access.ts';
import { CellPlacementMemory, cellPlacementBefore } from './v6-cell-placement.ts';
import { TypedMaterialMemory, commonTypedMaterialProposal, bindTypedMaterial, typedMaterialBefore, typedMaterialAfter } from './v6-typed-material-access.ts';
import { proposedTypedMaterialInquiryWitness } from './v6-typed-material-evidence.ts';
import { RadialPortMemory, commonRadialPortProposal, bindRadialPort, radialPortBefore, radialPortAfter } from './v6-radial-port-access.ts';
import { FieldServiceMemory, commonFieldServiceProposal, bindFieldService, fieldServiceBefore, fieldServiceAfter } from './v6-field-service-access.ts';
import { RootedQuotaMemory, commonRootedQuotaProposal, bindRootedQuota, rootedQuotaBefore, rootedQuotaAfter } from './v6-rooted-quota-access.ts';
import { OccludedCatalogueMemory, commonOccludedCatalogueProposal, commonCatalogueViewProposal,
  bindOccludedCatalogue, occludedCatalogueBefore, occludedCatalogueAfter } from './v6-occluded-catalogue-access.ts';
import { QueuedFieldMemory, commonQueuedFieldProposal, bindQueuedField, queuedFieldBefore, queuedFieldAfter } from './v6-queued-field-access.ts';
import { ProductPanelMemory, commonProductPanelProposal, bindProductPanel, productPanelBefore, productPanelAfter } from './v6-product-panel-access.ts';
import { LabeledSequenceMemory, commonLabeledSequenceProposal, bindLabeledSequence, labeledSequenceBefore, labeledSequenceAfter } from './v6-labeled-sequence-access.ts';
import { TraceFieldMemory, commonTraceFieldProposal, bindTraceField, traceFieldBefore, traceFieldAfter } from './v6-trace-field-access.ts';
import { LinkedPacketMemory, commonLinkedPacketProposal, bindLinkedPacket, linkedPacketBefore, linkedPacketAfter } from './v6-linked-packet-access.ts';
import { markedCollectionQuestion, observedProgramQuestion, observedProgramBefore, observedProgramAfter,
  recordObservedProgram, recordObservedProgramPacket } from './v6-program-composition-access.ts';
import { programIdentity } from './v6-program-identity.ts';
import { sharedLearnedPreparationWitness, radialLearnedPreparationWitness } from './v6-learned-preparation.ts';
import { cellUnacquiredInquiryWitness, retainedTraceBoundaryCandidate, traceAcquiredContinuationWitness } from './v6-acquired-continuation.ts';
import { programControlDiscoveryQuestion, programControlDiscoveryBefore, programControlDiscoveryAfter, programControlDiscoveryBlocksOrdinaryPlan,
  recordProgramControlDiscovery } from './v6-program-control-discovery.ts';
import { acquireProgramRelationModels, programRelationQuestion, programRelationBefore, programRelationAfter,
  recordProgramRelation, programRelationWitness } from './v6-program-relations.ts';
import { projection, rowsDigest } from './v6-native-observer.ts';
import type { ObservedInputDomain } from './v6-native-observer.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import type { OccurrenceRecord as R } from './v6-occurrence-scene.ts';
import type { NativeFamily, NativeRows, NativePublicObservation, NativeProposal } from './v6-native-types.ts';

export const SHARED_SERIES_DIGEST_SCOPE = 'native_program_relations_recall_typed_material_and_pose_radial_ports_field_service_rooted_quota_mark_support_occluded_catalogue_and_view_queued_field_product_panel_labeled_sequence_trace_field_linked_packet_cell_placement_alternating_graph_coupled_support_and_panel_service_one_of_six_observed_compositions_v6';

export interface NativeSharedSeriesOptions {
  /** Native current-control revalidation; the default preserves source contracts. */
  currentProgramAccess?: boolean;
  /** Explicit native public-input experiment; never supplies an operator role. */
  programControlDiscovery?: boolean;
  /** Native conditional relation acquisition and a separately guarded contrast. */
  programRelationLearning?: boolean;
  /** Explicit native measurement of complete homologous aligned mark support. */
  extendedRootedMarkSupport?: boolean;
  /** Exhaustive bounded native AND/OR fallback after atomic contradiction. */
  composedLabeledPredicates?: boolean;
  /** Explicit native interpretation of structurally witnessed trace-cell rims. */
  distinguishTraceCellSupport?: boolean;
}

/** The inherited public reducer participates in the native mutation guard. */
class SharedOccurrenceMemory extends OccurrenceRecallAccess {
  private version = 0;
  controlDiscoveryEvents: R[] = [];
  get nativeRevision(): number { return this.version; }
  override applyEvent(event: R): void {
    const owned = retainNativeJson(event);
    // Invalidate before the reducer: a partially failed reduction must never
    // authorize reuse of a previously accepted working copy.
    this.version++;
    if (['native_program_control_trial', 'native_program_control_binding', 'native_program_control_effect',
      'native_program_relation_model', 'native_program_relation_trial', 'native_program_relation_refutation'].includes(owned.kind)) {
      this.controlDiscoveryEvents.push(owned);
    } else super.applyEvent(owned);
  }
  override retainedDigest(): string {
    const ancestor = super.retainedDigest();
    // No new source behavior or digest layer before a native experiment.
    return this.controlDiscoveryEvents.length
      ? programIdentity([ancestor, 'native_program_control_and_relation_evidence', this.controlDiscoveryEvents]) : ancestor;
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
  material: TypedMaterialMemory; materialRevision: number;
  radial: RadialPortMemory; radialRevision: number;
  service: FieldServiceMemory; serviceRevision: number;
  rooted: RootedQuotaMemory; rootedRevision: number;
  catalogue: OccludedCatalogueMemory; catalogueRevision: number;
  queued: QueuedFieldMemory; queuedRevision: number;
  product: ProductPanelMemory; productRevision: number;
  labeled: LabeledSequenceMemory; labeledRevision: number;
  trace: TraceFieldMemory; traceRevision: number;
  linked: LinkedPacketMemory; linkedRevision: number;
  cells: CellPlacementMemory; cellRevision: number;
  graph: AlternatingGraphMemory; graphRevision: number;
  pairs: CoupledPairEvidenceMemory; pairRevision: number;
  auxiliary: AuxiliarySupportMemory; auxiliaryRevision: number;
  panel: PanelServiceMemory; panelRevision: number; panelWitness: WorkingWitness;
  events: WorkingWitness;
}

/** One journal is owned by the already registered public-occurrence provider. */
export class SharedSeriesConstraint extends OccurrenceRecallConstraint {
  override memory = new SharedOccurrenceMemory();
  material = new TypedMaterialMemory();
  radial = new RadialPortMemory();
  service = new FieldServiceMemory();
  rooted = new RootedQuotaMemory();
  catalogue = new OccludedCatalogueMemory();
  queued = new QueuedFieldMemory();
  product = new ProductPanelMemory();
  labeled = new LabeledSequenceMemory();
  trace = new TraceFieldMemory();
  linked = new LinkedPacketMemory();
  cells = new CellPlacementMemory();
  graph = new AlternatingGraphMemory();
  pairs = new CoupledPairEvidenceMemory();
  auxiliary = new AuxiliarySupportMemory();
  panel = new PanelServiceMemory();
  private certified: SharedWorkingStamp | null = null;
  private checkpoint: { value: R; stamp: SharedWorkingStamp; certified: boolean } | null = null;
  private accepted: { value: Readonly<R>; stamp: SharedWorkingStamp } | null = null;
  private readonly currentProgramAccess: boolean;
  private readonly programControlDiscovery: boolean;
  private readonly programRelationLearning: boolean;
  private readonly extendedRootedMarkSupport: boolean;
  private readonly composedLabeledPredicates: boolean;
  private readonly distinguishTraceCellSupport: boolean;

  constructor(config: OccurrenceRecallPolicy, options: NativeSharedSeriesOptions = {}) {
    super(config);
    this.currentProgramAccess = options.currentProgramAccess === true;
    this.programControlDiscovery = options.programControlDiscovery === true;
    this.programRelationLearning = options.programRelationLearning === true;
    this.extendedRootedMarkSupport = options.extendedRootedMarkSupport === true;
    this.composedLabeledPredicates = options.composedLabeledPredicates === true;
    this.distinguishTraceCellSupport = options.distinguishTraceCellSupport === true;
    this.certified = this.workingStamp();
  }

  private workingStamp(): SharedWorkingStamp {
    return { memory: this.memory, memoryRevision: this.memory.nativeRevision, memoryWitness: workingWitness(this.memory),
      material: this.material, materialRevision: this.material.nativeRevision,
      radial: this.radial, radialRevision: this.radial.nativeRevision,
      service: this.service, serviceRevision: this.service.nativeRevision,
      rooted: this.rooted, rootedRevision: this.rooted.nativeRevision,
      catalogue: this.catalogue, catalogueRevision: this.catalogue.nativeRevision,
      queued: this.queued, queuedRevision: this.queued.nativeRevision,
      product: this.product, productRevision: this.product.nativeRevision,
      labeled: this.labeled, labeledRevision: this.labeled.nativeRevision,
      trace: this.trace, traceRevision: this.trace.nativeRevision,
      linked: this.linked, linkedRevision: this.linked.nativeRevision,
      cells: this.cells, cellRevision: this.cells.nativeRevision,
      graph: this.graph, graphRevision: this.graph.nativeRevision,
      pairs: this.pairs, pairRevision: this.pairs.nativeRevision,
      auxiliary: this.auxiliary, auxiliaryRevision: this.auxiliary.nativeRevision,
      panel: this.panel, panelRevision: this.panel.nativeRevision, panelWitness: workingWitness(this.panel),
      events: workingWitness(this.events) };
  }
  private unchanged(stamp: SharedWorkingStamp): boolean {
    return this.memory === stamp.memory && this.memory.nativeRevision === stamp.memoryRevision
      && this.material === stamp.material && this.material.nativeRevision === stamp.materialRevision
      && this.radial === stamp.radial && this.radial.nativeRevision === stamp.radialRevision
      && this.service === stamp.service && this.service.nativeRevision === stamp.serviceRevision
      && this.rooted === stamp.rooted && this.rooted.nativeRevision === stamp.rootedRevision
      && this.catalogue === stamp.catalogue && this.catalogue.nativeRevision === stamp.catalogueRevision
      && this.queued === stamp.queued && this.queued.nativeRevision === stamp.queuedRevision
      && this.product === stamp.product && this.product.nativeRevision === stamp.productRevision
      && this.labeled === stamp.labeled && this.labeled.nativeRevision === stamp.labeledRevision
      && this.trace === stamp.trace && this.trace.nativeRevision === stamp.traceRevision
      && this.linked === stamp.linked && this.linked.nativeRevision === stamp.linkedRevision
      && this.cells === stamp.cells && this.cells.nativeRevision === stamp.cellRevision
      && this.graph === stamp.graph && this.graph.nativeRevision === stamp.graphRevision
      && this.pairs === stamp.pairs && this.pairs.nativeRevision === stamp.pairRevision
      && this.auxiliary === stamp.auxiliary && this.auxiliary.nativeRevision === stamp.auxiliaryRevision
      && this.panel === stamp.panel && this.panel.nativeRevision === stamp.panelRevision && witnessMatches(stamp.panelWitness, this.panel)
      && witnessMatches(stamp.events, this.events) && witnessMatches(stamp.memoryWitness, this.memory);
  }

  /** One transferred branch of the original six-plan observed-composition entry. */
  async observedPropose(observation: R, rows: NativeRows, inputs: readonly R[], remaining: number,
    config: R, levelDeadline: number | null): Promise<R | null> {
    if (remaining < 1) return null;
    if (levelDeadline === null || levelDeadline === undefined) throw new TypeError('Observed composition requires current level deadline');
    // This 1/6 closure adds measured panel points to the caller's observed
    // inputs. Additional inherited candidate generators remain outside it.
    const candidates = [...inputs, ...panelServiceInputCandidates(rows, observation.available_action_refs)];
    const proposal = this.sourceGraphProposal(observation, rows, candidates, Math.min(16, remaining),
      { ...config, remaining_level_actions: remaining, level_deadline: levelDeadline });
    if (proposal.block_unrelated_probe) return proposal;
    if (proposal.status !== 'proposed' || !Object.hasOwn(proposal, 'panel_service_plan')) return null;
    proposal.field_subquestion = 'observed_composition_services';
    for (const [index, action] of (proposal.actions as R[]).entries()) {
      const step = proposal.steps[index];
      step.expected_before = Object.fromEntries(['level_epoch', 'frame_hash', 'levels_completed', 'state'].map(key => [key, observation[key]]));
      if (action.action_ref === 'ACTION6') {
        const { x, y } = action.data, value = rows.at(y)?.at(x);
        if (value === undefined) throw new RangeError('Observed composition point is outside its public frame');
        step.point_support = { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref,
          frame_hash: observation.frame_hash, point: [x, y], palette_value: value, projection_bbox: [x, y, x, y],
          projected_rows_digest: await rowsDigest([[value]]), entity_ref: `observed-composition-control:${identity([observation.observation_ref, x, y])}`,
          signature: identity([observation.frame_hash, x, y, value]),
          scope: 'Measured control point, independently rechecked before dispatch; family geometry and predicted-state guards additionally apply.' };
      }
    }
    return proposal;
  }

  /** The original goal-access entry, separate from the later occurrence recall. */
  async coupledPropose(observation: R, rows: NativeRows, inputs: readonly R[], remaining: number,
    config: R, levelDeadline: number | null): Promise<R | null> {
    if (remaining < 1) return null;
    if (levelDeadline === null || levelDeadline === undefined) throw new TypeError('Coupled experiment requires current level deadline');
    const proposal = this.sourceGraphProposal(observation, rows, inputs, Math.min(16, remaining),
      { ...config, remaining_level_actions: remaining });
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

  /** Same actual inherited planner, reached by the next declared source entry. */
  graphPropose(observation: R, rows: NativeRows, inputs: readonly R[], remaining: number,
    config: R, levelDeadline: number | null): R | null {
    if (remaining < 1) return null;
    if (levelDeadline === null || levelDeadline === undefined) throw new TypeError('Graph composition requires the current level deadline');
    const proposal = this.sourceGraphProposal(observation, rows, inputs, Math.min(16, remaining),
      { ...config, remaining_level_actions: remaining });
    if (proposal.block_unrelated_probe) return proposal;
    if (proposal.status !== 'proposed') return null;
    proposal.field_subquestion = 'alternating_graph_composition';
    return proposal;
  }

  /** CellPlacementConstraint's separate declared window-constraint entry. */
  async cellPropose(observation: R, rows: NativeRows, inputs: readonly R[], remaining: number,
    config: R, levelDeadline: number | null): Promise<R | null> {
    if (remaining < 1) return null;
    if (levelDeadline === null || levelDeadline === undefined) throw new TypeError('Cell experiment requires current level deadline');
    const proposal = this.cells.proposeCell(observation, rows, inputs, Math.min(16, remaining),
      { ...config, level_deadline: levelDeadline, remaining_level_actions: remaining });
    if (!proposal || !Object.hasOwn(proposal, 'cell_placement_plan')) return null;
    const plan = proposal.cell_placement_plan, [x, y] = plan.pixel, value = rows[y]![x]!;
    for (const step of proposal.steps as R[]) {
      step.expected_before = Object.fromEntries(['level_epoch', 'frame_hash', 'levels_completed', 'state'].map(key => [key, observation[key]]));
      step.point_support = { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref, frame_hash: observation.frame_hash,
        point: [x, y], palette_value: value, projection_bbox: [x, y, x, y], projected_rows_digest: await rowsDigest([[value]]),
        entity_ref: `measured-cell:${identity([plan.field.ref, plan.point])}`, signature: identity([plan.field.ref, plan.point, value]),
        scope: 'Current cell point and actual center pixel, distinct from predicted patch identity. No old-epoch point authority or acquired terminal role.' };
    }
    return proposal;
  }

  /** Typed carrier, material flow and pose use the same inherited acquired owner. */
  materialPropose(observation: R, rows: NativeRows, inputs: readonly R[], remaining: number, config: R): Promise<R | null> {
    return commonTypedMaterialProposal(this.material, observation, rows, inputs, remaining, config);
  }

  /** The source radial entry shares the inherited acquired journal. */
  radialPropose(observation: R, rows: NativeRows, inputs: readonly R[], remaining: number, config: R): Promise<R | null> {
    return commonRadialPortProposal(this.radial, observation, rows, inputs, remaining, config);
  }

  /** Service experiments retain their returned evidence in the common owner. */
  servicePropose(observation: R, rows: NativeRows, inputs: readonly R[], remaining: number, config: R): Promise<R | null> {
    return commonFieldServiceProposal(this.service, observation, rows, inputs, remaining, config);
  }

  /** The source quota entry uses the same journal and current physical budget. */
  rootedPropose(observation: R, rows: NativeRows, inputs: readonly R[], remaining: number, config: R,
    deadlineMs: number | null, now?: () => number): Promise<R | null> {
    return commonRootedQuotaProposal(this.rooted, observation, rows, inputs, remaining, config, deadlineMs, now, undefined,
      { extendedMarkSupport: this.extendedRootedMarkSupport });
  }

  /** ProductPanelConstraint's declared entry, sharing the actual acquired journal. */
  productPropose(observation: R, rows: NativeRows, inputs: readonly R[], remaining: number, config: R,
    deadlineMs: number | null, now?: () => number): Promise<R | null> {
    return commonProductPanelProposal(this.product, observation, rows, inputs, remaining, config, deadlineMs, now);
  }

  /** Current measured catalogue controls use the same acquired owner. */
  cataloguePropose(observation: R, rows: NativeRows, inputs: readonly R[], remaining: number, config: R,
    deadlineMs: number | null, now?: () => number): Promise<R | null> {
    return commonOccludedCatalogueProposal(this.catalogue, observation, rows, inputs, remaining, config, deadlineMs, now);
  }

  /** Source fallback after the common ViewFrontier, using actual field-input evidence. */
  catalogueViewPropose(observation: R, rows: NativeRows, inputs: readonly R[], remaining: number, config: R,
    deadlineMs: number | null, now?: () => number): Promise<R | null> {
    return commonCatalogueViewProposal(this.catalogue, observation, rows, inputs, remaining, config, deadlineMs, now);
  }

  /** The queued-field source entry retains conditional models in the same owner. */
  queuedPropose(observation: R, rows: NativeRows, inputs: readonly R[], remaining: number, config: R,
    deadlineMs: number | null, now?: () => number): R | null {
    return commonQueuedFieldProposal(this.queued, observation, rows, inputs, remaining, config, deadlineMs, now);
  }

  /** Current labeled-query entry with the same acquired journal and physical guard. */
  labeledPropose(observation: R, rows: NativeRows, inputs: readonly R[], remaining: number, config: R,
    deadlineMs: number | null, now?: () => number): Promise<R | null> {
    return commonLabeledSequenceProposal(this.labeled, observation, rows, inputs, remaining, config, deadlineMs, now, undefined,
      { composedPredicates: this.composedLabeledPredicates });
  }

  /** Current measured trace, with source evidence and the current physical deadline. */
  tracePropose(observation: R, rows: NativeRows, inputs: readonly R[], remaining: number, config: R,
    deadlineMs: number | null, now?: () => number): Promise<R | null> {
    return commonTraceFieldProposal(this.trace, observation, rows, inputs, remaining, config, deadlineMs, now, undefined,
      { distinguishCellSupport: this.distinguishTraceCellSupport });
  }

  /** Current controls and complete dated public returns share the same acquired owner. */
  linkedPropose(observation: R, rows: NativeRows, inputs: readonly R[], remaining: number, config: R,
    deadlineMs: number | null, now?: () => number): Promise<R | null> {
    return commonLinkedPacketProposal(this.linked, observation, rows, inputs, remaining, config, deadlineMs, now);
  }

  /** ProgramCompositionConstraint's declared question on the same ancestor memory. */
  async programPropose(observation: R, rows: NativeRows, inputs: readonly R[], remaining: number,
    levelDeadline: number | null, now?: () => number): Promise<R | null> {
    if (remaining < 1) return null;
    if (this.memory.compositionModels.length && (levelDeadline === null || levelDeadline === undefined)) {
      throw new TypeError('Program search requires the current level deadline');
    }
    const config = { remaining_level_actions: remaining, level_deadline: levelDeadline === null ? null : levelDeadline / 1000,
      ...(this.currentProgramAccess ? { native_current_program_access: true } : {}),
      ...(now ? { now: () => now() / 1000 } : {}) };
    const unmodeledMembers = this.programControlDiscovery && this.memory.compositionModels.length > 0
      && programControlDiscoveryBlocksOrdinaryPlan(this.memory.compositionModels.at(-1)!, this.memory.controlDiscoveryEvents, rows);
    const proposal = (unmodeledMembers ? null : observedProgramQuestion(this.memory, observation, rows, Math.min(16, remaining), config)
      ?? markedCollectionQuestion(this.memory, observation, rows, inputs))
      ?? (this.programRelationLearning && this.memory.compositionModels.length
        ? programRelationQuestion(this.memory.compositionModels.at(-1)!, this.memory.controlDiscoveryEvents, observation, rows,
          remaining, levelDeadline ?? Infinity, now) : null)
      ?? (this.programControlDiscovery && this.memory.compositionModels.length
        ? programControlDiscoveryQuestion(this.memory.compositionModels.at(-1)!, this.memory.controlDiscoveryEvents, observation, rows,
          { prepareReturn: this.programRelationLearning }) : null);
    if (!proposal) return null;
    proposal.steps[0].expected_before = Object.fromEntries(['level_epoch', 'frame_hash', 'levels_completed', 'state'].map(key => [key, observation[key]]));
    for (const [index, action] of (proposal.actions as R[]).entries()) {
      if (action.action_ref !== 'ACTION6') continue;
      const { x, y } = action.data;
      const plan = [proposal.program_relation_plan, proposal.program_control_probe_plan, proposal.program_composition_plan, proposal.respondent_probe_plan,
        proposal.marked_collection_plan].find(candidate => truth(candidate));
      if (!plan || y < 0 || y >= rows.length || x < 0 || x >= rows[0]!.length) throw new TypeError('Program point lacks public composition');
      let box = [x, y, x, y];
      if (Object.hasOwn(plan, 'entity') && truth(plan.entity)) box = plan.entity.bbox;
      else if (truth(proposal.program_composition_plan) && plan.steps[index].mode === 'remove') box = plan.steps[index].member_box;
      else if (truth(plan.layout)) {
        const matches = (plan.layout.controls as R[]).filter(control => control.bbox[0] <= x && x <= control.bbox[2]
          && control.bbox[1] <= y && y <= control.bbox[3]);
        if (matches.length !== 1) throw new TypeError('Program input is not one current measured control');
        box = matches[0]!.bbox;
      }
      const digest = await rowsDigest(projection(rows, box));
      proposal.steps[index].point_support = { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref,
        frame_hash: observation.frame_hash, point: [x, y], palette_value: rows[y]![x], projection_bbox: box,
        projected_rows_digest: digest, entity_ref: 'measured-program-input:' + identity([box, [x, y], digest]),
        signature: programIdentity([plan, action, index]),
        scope: 'Composition-derived observed control/member support, rechecked before this primitive; program/prefix guards are additional.' };
    }
    return proposal;
  }

  private sourceGraphProposal(observation: R, rows: NativeRows, inputs: readonly R[], maxPrefix: number, config: R): R {
    // All three source adapters call this same inherited planner. Their own
    // configurations and result filters decide which entry can expose a plan.
    const panel = proposePanelService(this.panel, observation, rows, inputs, maxPrefix, config);
    if (panel) return panel;
    const pair = this.pairs.currentState();
    const ordinary = (): R => proposeCoupledPairGraph(pair, observation, rows, inputs, maxPrefix, config)
      ?? this.graph.proposeGraph(observation, rows, inputs, maxPrefix, config);
    return this.auxiliary.proposeGraph(pair, observation, rows, inputs, maxPrefix, config, ordinary);
  }

  override bind(proposal: R, domain: ObservedInputDomain): void {
    // The common source wrappers dispatch by key presence in this inherited
    // order; a mixed envelope must not let a lower layer bypass its parent.
    if (Object.hasOwn(proposal, 'panel_service_plan')) {
      for (const [index, action] of (proposal.actions as R[]).entries()) {
        const step = proposal.steps[index];
        if (action.action_ref === 'ACTION6') {
          if (!equal(step.point_support.point, [action.data.x, action.data.y])) throw new TypeError('Current point changed');
          step.point_binding = { ...step.point_support };
        } else if (truth(action.data)) throw new TypeError('Unexpected nonpoint payload');
      }
      return;
    }
    if (['pair_access_plan', 'support_preparation_plan'].some(key => Object.hasOwn(proposal, key))) {
      for (const [index, action] of (proposal.actions as R[]).entries()) {
        const step = proposal.steps[index];
        if (action.action_ref === 'ACTION6') {
          if (!equal(step.point_support.point, [action.data.x, action.data.y])) throw new TypeError('Current point changed');
          step.point_binding = { ...step.point_support };
        } else if (truth(action.data)) throw new TypeError('Unexpected discrete control payload');
      }
      return;
    }
    if (Object.hasOwn(proposal, 'graph_access_plan')) {
      if ((proposal.actions as R[]).some(action => truth(action.data))) throw new TypeError('Graph input payload changed');
      return;
    }
    if (Object.hasOwn(proposal, 'cell_placement_plan')) {
      for (const [index, action] of (proposal.actions as R[]).entries()) {
        const step = proposal.steps[index], support = step.point_support;
        if (!equal(support.point, [action.data.x, action.data.y])) throw new TypeError('Current cell point changed');
        step.point_binding = { ...support };
      }
      return;
    }
    if (Object.hasOwn(proposal, 'linked_packet_plan')) { bindLinkedPacket(proposal, domain); return; }
    if (Object.hasOwn(proposal, 'trace_field_plan')) { bindTraceField(proposal, domain); return; }
    if (Object.hasOwn(proposal, 'labeled_sequence_plan')) { bindLabeledSequence(proposal, domain); return; }
    if (Object.hasOwn(proposal, 'product_panel_plan')) { bindProductPanel(proposal, domain); return; }
    if (Object.hasOwn(proposal, 'queued_field_plan')) { bindQueuedField(proposal, domain); return; }
    if (Object.hasOwn(proposal, 'occluded_catalogue_plan')) { bindOccludedCatalogue(proposal, domain); return; }
    if (Object.hasOwn(proposal, 'rooted_quota_plan')) { bindRootedQuota(proposal, domain); return; }
    if (Object.hasOwn(proposal, 'nested_control_plan')) { bindFieldService(proposal, domain); return; }
    if (Object.hasOwn(proposal, 'radial_port_plan')) { bindRadialPort(proposal, domain); return; }
    if (['typed_carrier_plan', 'material_flow_plan', 'material_pose_plan'].some(key => Object.hasOwn(proposal, key))) {
      bindTypedMaterial(proposal, domain); return;
    }
    if (Object.hasOwn(proposal, 'occurrence_recall_plan')) { super.bind(proposal, domain); return; }
    if (['marked_collection_plan', 'program_composition_plan', 'respondent_probe_plan', 'program_control_probe_plan', 'program_relation_plan'].some(key => Object.hasOwn(proposal, key))) {
      const first = proposal.steps[0].expected_before;
      if (!domain.bindings.has(`${first.level_epoch}:${first.frame_hash}`)) throw new TypeError('Program input domain not currently observed');
      for (const [index, action] of (proposal.actions as R[]).entries()) {
        if (action.action_ref !== 'ACTION6') continue;
        const support = proposal.steps[index].point_support;
        if (!equal(support.point, [action.data.x, action.data.y])) throw new TypeError('Program payload differs from its current public support');
        proposal.steps[index].point_binding = { ...support };
      }
      return;
    }
    super.bind(proposal, domain);
  }

  override before(proposal: R, index: number, packet: NativePublicObservation, observation: R): R {
    if (truth(proposal.panel_service_plan)) return panelServiceBefore(proposal, index, packet.frame_rows,
      { epoch: packet.level, score: packet.levels_completed, observation_ref: observation.observation_ref, available: packet.available_action_refs });
    if (truth(proposal.support_preparation_plan)) return auxiliarySupportBefore(proposal, index, packet.frame_rows,
      { epoch: packet.level, score: packet.levels_completed, observation_ref: observation.observation_ref, available: packet.available_action_refs });
    if (truth(proposal.pair_access_plan)) return coupledPairBefore(proposal, index, packet.frame_rows,
      { epoch: packet.level, score: packet.levels_completed, observation_ref: observation.observation_ref, available: packet.available_action_refs });
    if (truth(proposal.graph_access_plan)) return alternatingGraphBefore(proposal, index, packet.frame_rows,
      { epoch: packet.level, score: packet.levels_completed, observation_ref: observation.observation_ref, available: packet.available_action_refs });
    if (truth(proposal.cell_placement_plan)) return cellPlacementBefore(proposal, index, packet.frame_rows,
      { epoch: packet.level, score: packet.levels_completed, observation_ref: observation.observation_ref, available: packet.available_action_refs });
    if (truth(proposal.linked_packet_plan)) return linkedPacketBefore(proposal, index, packet.frame_rows,
      { epoch: packet.level, score: packet.levels_completed, observation_ref: observation.observation_ref, available: packet.available_action_refs });
    if (truth(proposal.trace_field_plan)) return traceFieldBefore(proposal, index, packet.frame_rows,
      { epoch: packet.level, score: packet.levels_completed, observation_ref: observation.observation_ref, available: packet.available_action_refs },
      { distinguishCellSupport: this.distinguishTraceCellSupport });
    if (truth(proposal.labeled_sequence_plan)) return labeledSequenceBefore(proposal, index, packet.frame_rows,
      { epoch: packet.level, score: packet.levels_completed, observation_ref: observation.observation_ref, available: packet.available_action_refs });
    if (truth(proposal.product_panel_plan)) return productPanelBefore(proposal, index, packet.frame_rows,
      { epoch: packet.level, score: packet.levels_completed, observation_ref: observation.observation_ref, available: packet.available_action_refs });
    if (truth(proposal.queued_field_plan)) return queuedFieldBefore(proposal, index, packet.frame_rows,
      { epoch: packet.level, score: packet.levels_completed, observation_ref: observation.observation_ref, available: packet.available_action_refs }, this.queued);
    if (truth(proposal.occluded_catalogue_plan)) return occludedCatalogueBefore(proposal, index, packet.frame_rows,
      { epoch: packet.level, score: packet.levels_completed, observation_ref: observation.observation_ref, available: packet.available_action_refs });
    if (truth(proposal.program_relation_plan)) return programRelationBefore(proposal, index, packet.frame_rows,
      { epoch: packet.level, score: packet.levels_completed, observation_ref: observation.observation_ref,
        available: packet.available_action_refs, state: packet.state,
        model: this.memory.compositionModels.at(-1), events: this.memory.controlDiscoveryEvents });
    if (truth(proposal.rooted_quota_plan)) return rootedQuotaBefore(proposal, index, packet.frame_rows,
      { epoch: packet.level, score: packet.levels_completed, observation_ref: observation.observation_ref, available: packet.available_action_refs },
      { extendedMarkSupport: this.extendedRootedMarkSupport });
    if (truth(proposal.nested_control_plan)) return fieldServiceBefore(proposal, index, packet.frame_rows,
      { epoch: packet.level, score: packet.levels_completed, observation_ref: observation.observation_ref, available: packet.available_action_refs });
    if (truth(proposal.radial_port_plan)) return radialPortBefore(proposal, index, packet.frame_rows,
      { epoch: packet.level, score: packet.levels_completed, observation_ref: observation.observation_ref, available: packet.available_action_refs });
    if (['material_pose_plan', 'material_flow_plan', 'typed_carrier_plan'].some(key => truth(proposal[key]))) return typedMaterialBefore(proposal, index, packet.frame_rows,
      { epoch: packet.level, score: packet.levels_completed, observation_ref: observation.observation_ref, available: packet.available_action_refs });
    if (truth(proposal.program_control_probe_plan)) return programControlDiscoveryBefore(proposal, index, packet.frame_rows,
      { epoch: packet.level, score: packet.levels_completed, observation_ref: observation.observation_ref, available: packet.available_action_refs,
        model: this.memory.compositionModels.at(-1), events: this.memory.controlDiscoveryEvents, prepareReturn: this.programRelationLearning });
    if (!truth(proposal.occurrence_recall_plan) && ['marked_collection_plan', 'program_composition_plan', 'respondent_probe_plan'].some(key => truth(proposal[key]))) {
      return observedProgramBefore(this.memory, proposal, index, packet.frame_rows,
        { epoch: packet.level, score: packet.levels_completed, observation_ref: observation.observation_ref, available: packet.available_action_refs });
    }
    return super.before(proposal, index, packet, observation);
  }
  override after(proposal: R, index: number, before: R, after: R, first: NativeRows, second: NativeRows): R {
    if (truth(proposal.panel_service_plan)) return panelServiceAfter(proposal, index, first, second,
      { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
    if (truth(proposal.support_preparation_plan)) return auxiliarySupportAfter(proposal, index, first, second,
      { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
    if (truth(proposal.pair_access_plan)) return coupledPairAfter(proposal, index, first, second,
      { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
    if (truth(proposal.graph_access_plan)) return alternatingGraphAfter(proposal, index, first, second,
      { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
    if (truth(proposal.cell_placement_plan)) return this.cells.after(proposal, index, first, second,
      { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
    if (truth(proposal.linked_packet_plan)) return linkedPacketAfter(proposal, index, first, second,
      { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
    if (truth(proposal.trace_field_plan)) return traceFieldAfter(proposal, index, first, second,
      { epoch: after.level_epoch, score: after.levels_completed, state: after.state },
      { distinguishCellSupport: this.distinguishTraceCellSupport });
    if (truth(proposal.labeled_sequence_plan)) return labeledSequenceAfter(proposal, index, first, second,
      { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
    if (truth(proposal.product_panel_plan)) return productPanelAfter(proposal, index, first, second,
      { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
    if (truth(proposal.queued_field_plan)) return queuedFieldAfter(proposal, index, first, second,
      { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
    if (truth(proposal.occluded_catalogue_plan)) return occludedCatalogueAfter(proposal, index, first, second,
      { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
    if (truth(proposal.program_relation_plan)) return programRelationAfter(proposal, index, first, second,
      { epoch: after.level_epoch, score: after.levels_completed, state: after.state,
        model: this.memory.compositionModels.at(-1), events: this.memory.controlDiscoveryEvents });
    if (truth(proposal.rooted_quota_plan)) return rootedQuotaAfter(proposal, index, first, second,
      { epoch: after.level_epoch, score: after.levels_completed, state: after.state },
      { extendedMarkSupport: this.extendedRootedMarkSupport });
    if (truth(proposal.nested_control_plan)) return fieldServiceAfter(proposal, index, first, second,
      { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
    if (truth(proposal.radial_port_plan)) return radialPortAfter(proposal, index, first, second,
      { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
    if (['material_pose_plan', 'material_flow_plan', 'typed_carrier_plan'].some(key => truth(proposal[key]))) return typedMaterialAfter(proposal, index, first, second,
      { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
    if (truth(proposal.program_control_probe_plan)) return programControlDiscoveryAfter(proposal, index, first, second,
      { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
    if (!truth(proposal.occurrence_recall_plan) && ['marked_collection_plan', 'program_composition_plan', 'respondent_probe_plan'].some(key => truth(proposal[key]))) {
      return observedProgramAfter(this.memory, proposal, index, first, second,
        { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
    }
    return super.after(proposal, index, before, after, first, second);
  }

  override record(before: R, after: R, command: R, first: NativeRows, second: NativeRows,
    proposal: R, index: number, frames: readonly NativeRows[] = []): R {
    const certified = this.certified !== null && this.unchanged(this.certified);
    this.certified = null;
    // Queue records its pending actual return before its inherited record chain;
    // it acquires the conditional model only after the complete dated packet.
    this.queued.record(before, command, after, first, second, proposal, index);
    // CatalogueViewMemory removes its scalar-view plan only while calling its
    // older ancestors. Queue staging and the higher layers retain the original.
    const parentProposal = proposal.occluded_catalogue_plan?.mode === 'view'
      ? Object.fromEntries(Object.entries(proposal).filter(([key]) => key !== 'occluded_catalogue_plan')) : proposal;
    // Program ancestors acquire before the higher occurrence/cell layers.
    // Their source record methods dispatch self.before/self.after through the
    // complete inherited guard chain, including mixed-key test envelopes.
    // RootedQuotaAccess.record returns its own event without calling its older
    // ancestors. Higher cell/graph/pair/support layers and record_packet still run.
    const selectedRooted = truth(proposal.rooted_quota_plan);
    const events = selectedRooted ? [] : recordObservedProgram(this.memory, before, command, after, first, second, parentProposal, index, {
      before: (p, i, rows, meta) => this.before(p, i, { frame_rows: rows, level: meta.epoch,
        levels_completed: meta.score, available_action_refs: meta.available } as NativePublicObservation, before),
      after: (p, i, rows, later) => this.after(p, i, before, after, rows, later),
    });
    const discoveries = recordProgramControlDiscovery(before, command, after, first, second, frames, parentProposal,
      { model: this.memory.compositionModels.at(-1), events: this.memory.controlDiscoveryEvents, prepareReturn: this.programRelationLearning });
    for (const event of discoveries) this.memory.applyEvent(event);
    events.push(...discoveries);
    const sourceModel = this.memory.compositionModels.at(-1);
    if (this.programRelationLearning && sourceModel) {
      const relations = recordProgramRelation(before, command, after, first, second, frames, parentProposal,
        { model: sourceModel, events: this.memory.controlDiscoveryEvents });
      for (const event of relations) this.memory.applyEvent(event);
      events.push(...relations);
      const fitted = acquireProgramRelationModels(sourceModel, this.memory.controlDiscoveryEvents);
      for (const event of fitted) this.memory.applyEvent(event);
      events.push(...fitted);
    }
    if (!selectedRooted) {
      events.push(...this.memory.record(before, command, after, first, second, parentProposal, index));
      events.push(...this.material.record(before, command, after, first, second, parentProposal, index));
      events.push(...this.radial.record(before, command, after, first, second, parentProposal, index));
      events.push(...this.service.record(before, command, after, first, second, parentProposal, index));
    }
    events.push(...this.rooted.record(before, command, after, first, second, parentProposal, index));
    // Public returns chosen by any provider can acquire a field-changing input.
    events.push(...this.catalogue.record(before, command, after, first, second, proposal, index));
    // ProductPanelAccess calls its inherited record first, then measures every
    // actual return. It remains outside RootedQuotaAccess's older-chain cutoff.
    events.push(...this.product.record(before, command, after, first, second, proposal, index));
    // LabeledSequenceAccess first lets Product and its ancestors acquire, then
    // retains this actual submission without promoting a unique universal law.
    events.push(...this.labeled.record(before, command, after, first, second, proposal, index));
    // TraceFieldAccess records only an actual extension after its inherited layers.
    events.push(...this.trace.record(before, command, after, first, second, proposal, index,
      { distinguishCellSupport: this.distinguishTraceCellSupport }));
    events.push(...this.linked.record(before, command, after, first, second, proposal, index));
    events.push(...this.cells.record(before, command, after, first, second, proposal, index));
    events.push(...this.graph.record(before, command, after, first, second, proposal, index));
    // The source pair layer first acquires the before-epoch anchor, then its
    // measured response evidence. Packet observation follows the whole chain.
    events.push(...this.pairs.record(before, command, after, first, second, proposal, index));
    const supportEvents = this.auxiliary.record(this.pairs.currentState(), before, command, after, first, second, proposal, index);
    for (const event of supportEvents) if (event.kind === 'coupled_pair_evidence') this.pairs.applyEvent(event);
    events.push(...supportEvents);
    // PanelServiceAccess acquires after its inherited Coupled/Auxiliary chain.
    // This common owner runs that chain once, then the public packet acquisition.
    events.push(...this.panel.record(before, command, after, first, second, proposal, index));
    events.push(...recordObservedProgramPacket(this.memory, before, command, after, first, frames));
    events.push(...this.queued.recordPacket(before, command, after, first, frames));
    events.push(...this.linked.recordPacket(before, command, after, first, frames));
    events.push(...this.cells.recordPacket(before, command, after, first, frames));
    // Keep returned source envelopes independently mutable. Only the retained
    // journal owns these frozen copies; old entries keep their identities.
    this.events.push(...events.map(event => retainNativeJson(event)));
    if (certified) this.certified = this.workingStamp();
    return { status: after.levels_completed > before.levels_completed ? 'official_boundary_witness' : 'measured_series_or_insertion_response',
      events, transfer_authority: 'hypothesis_only' };
  }

  override state(): R {
    return { events: structuredClone(this.events), digest: this.sharedDigest() };
  }

  private sharedDigest(): string {
    let digest = this.memory.retainedDigest();
    for (const layer of [this.material, this.radial, this.service, this.rooted, this.catalogue, this.queued, this.product, this.labeled, this.trace,
      this.linked, this.cells, this.graph, this.pairs, this.auxiliary]) digest = layer.retainedDigest(digest);
    // Existing native checkpoints keep their exact digest until the first panel
    // event. This conditional layer is a native migration envelope, not a claim
    // that the complete source inheritance digest has already been transferred.
    if (this.panel.eventCount) digest = this.panel.retainedDigest(digest);
    return digest;
  }

  /** Internal checkpoint only: public state() still returns an independent copy. */
  nativeState(): R {
    if (this.checkpoint && this.unchanged(this.checkpoint.stamp)) return this.checkpoint.value;
    const certified = this.certified !== null && this.unchanged(this.certified);
    const owned = this.events.map(event => retainNativeJson(event));
    // Direct public journal edits are also owned before entering persistence,
    // but cannot certify agreement with the acquired reducers on their own.
    if (owned.some((event, index) => event !== this.events[index])) this.events = owned;
    const value = retainNativeJson({ events: this.events,
      digest: this.sharedDigest() });
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
    const events = [...state.events] as R[], memory = new SharedOccurrenceMemory(), material = new TypedMaterialMemory(), radial = new RadialPortMemory(), service = new FieldServiceMemory(), rooted = new RootedQuotaMemory(), catalogue = new OccludedCatalogueMemory(), queued = new QueuedFieldMemory(), product = new ProductPanelMemory(), labeled = new LabeledSequenceMemory(), trace = new TraceFieldMemory(), linked = new LinkedPacketMemory(), cells = new CellPlacementMemory(), graph = new AlternatingGraphMemory(),
      pairs = new CoupledPairEvidenceMemory(), auxiliary = new AuxiliarySupportMemory(), panel = new PanelServiceMemory();
    for (const event of events) {
      if (['typed_carrier_response', 'typed_material_flow', 'typed_pose_scope', 'typed_pose_model', 'typed_pose_response'].includes(event.kind)) material.applyEvent(event);
      else if (event.kind === 'radial_method_recall' || event.kind === 'radial_port_effect') radial.applyEvent(event);
      else if (['nested_control_response', 'envelope_fill_context', 'field_service_context', 'field_service_transfer'].includes(event.kind)) service.applyEvent(event);
      else if (event.kind === 'rooted_quota_state') rooted.applyEvent(event);
      else if (['catalogue_observation', 'catalogue_response', 'catalogue_field_input_observed'].includes(event.kind)) catalogue.applyEvent(event);
      else if (event.kind === 'observed_queue_field_model') queued.applyEvent(event);
      else if (event.kind === 'observed_factor_product') product.applyEvent(event);
      else if (event.kind === 'labeled_sequence_submission') labeled.applyEvent(event);
      else if (event.kind === 'observed_trace_extension') trace.applyEvent(event);
      else if (event.kind === 'linked_packet_evidence') linked.applyEvent(event);
      else if (event.kind === 'cell_patch_placement_evidence') cells.applyEvent(event);
      else if (event.kind === 'alternating_graph_evidence') graph.applyEvent(event);
      else if (event.kind === 'coupled_pair_epoch_anchor' || event.kind === 'coupled_pair_evidence') pairs.applyEvent(event);
      else if (event.kind === 'coupled_support_control_model' || event.kind === 'coupled_support_preparation') auxiliary.applyEvent(event);
      else if (event.kind === 'observed_panel_service') panel.applyEvent(event);
      else memory.applyEvent(event);
    }
    let digest = memory.retainedDigest();
    for (const layer of [material, radial, service, rooted, catalogue, queued, product, labeled, trace, linked, cells, graph, pairs, auxiliary]) digest = layer.retainedDigest(digest);
    if (panel.eventCount) digest = panel.retainedDigest(digest);
    if (digest !== state.digest) throw new TypeError('Shared series memory changed during recall');
    // Only publish the reconstructed working copies after the complete journal
    // has passed integrity checks. A rejected edit cannot clear learned state.
    this.memory = memory; this.material = material; this.radial = radial; this.service = service; this.rooted = rooted; this.catalogue = catalogue; this.queued = queued; this.product = product; this.labeled = labeled; this.trace = trace; this.linked = linked; this.cells = cells; this.graph = graph; this.pairs = pairs; this.auxiliary = auxiliary; this.panel = panel; this.events = events;
    const stamp = this.workingStamp();
    this.certified = stamp; this.accepted = { value: state, stamp };
    this.checkpoint = { value: retainNativeJson({ events: this.events, digest: state.digest }), stamp, certified: true };
  }
}

export function createNativeSharedSeriesFamily(config: OccurrenceRecallPolicy, coupledConfig?: R, graphConfig?: R, cellConfig?: R,
  options: NativeSharedSeriesOptions = {}, radialConfig?: R, rootedConfig?: R, productConfig?: R, labeledConfig?: R, traceConfig?: R, linkedConfig?: R,
  queuedConfig?: R, catalogueConfig?: R, materialConfig?: R, serviceConfig?: R, observedConfig?: R): NativeFamily {
  const family = new SharedSeriesConstraint(config, options), adapter = asNativeOccurrenceRecallFamily(family);
  return { ...adapter, nativeState: () => family.nativeState(), restoreNative: state => family.restoreNative(state),
    compositionDependencyState: () => family.material.currentState() as unknown as R,
    proposeForRetainedComposition: async (binding, observation, rows, inputs, remaining) => {
      const proposal = materialConfig ? await commonTypedMaterialProposal(family.material, observation, rows, inputs, remaining, materialConfig, binding) : null;
      if (proposal) proposal.field_subquestion = 'typed_material_flow';
      return proposal as NativeProposal | null;
    },
    currentInquiryWitness: (proposal, observation, rows) => proposedTypedMaterialInquiryWitness(family.material.currentState(), proposal, observation, rows),
    unacquiredInquiryWitness: (proposal, observation) => cellUnacquiredInquiryWitness(family.cells.state(), proposal, observation),
    retainedSuccessWitness: observation => retainedTraceBoundaryCandidate(family.trace.currentState(), observation),
    acquiredContinuationWitness: (proposal, observation) => traceAcquiredContinuationWitness(family.trace.currentState(), proposal, observation),
    groundedInquiryWitness: (proposal, observation) => {
      if (proposal.kind === 'public_program_relation_probe') return programRelationWitness(family.memory.compositionModels.at(-1)!,
        family.memory.controlDiscoveryEvents, proposal, observation);
      if (proposal.kind !== 'public_program_control_probe') return null;
      const plan = (proposal as R).program_control_probe_plan, model = family.memory.compositionModels.at(-1);
      if (!plan || !model || plan.operator_status !== 'unknown' || plan.epoch !== observation.level_epoch
        || plan.observation_ref !== observation.observation_ref || !equal(plan.model, model)
        || !Array.isArray(model.evidence_refs) || !model.evidence_refs.length) return null;
      return { status: 'acquired_context_for_unknown_effect', observation_ref: observation.observation_ref,
        context_model_ids: [model.model_id], evidence_refs: [...model.evidence_refs],
        qualification: 'The editor and prior model were acquired. This current control question still has an unknown effect; its acquired binding and current input must pass the dedicated guard.' };
    },
    learnedPreparationWitness: (proposal, observation) => proposal.kind === 'radial_port_composition'
      ? radialLearnedPreparationWitness(family.radial.currentState(), proposal, observation)
      : sharedLearnedPreparationWitness(family.memory, config, proposal, observation),
    requestedStopReason: observation => family.memory.compositionRefutedEpochs.has(observation.level_epoch)
      ? 'program_composition_projection_refuted' : family.catalogue.requestedStopReason ?? family.rooted.requestedStopReason ?? family.service.requestedStopReason ?? family.material.requestedStopReason ?? family.memory.requestedStopReason,
    proposeInSubquestion: async (group, subquestion, observation, rows, inputs, remaining, execution) => {
      if (group === 'window_constraints') {
        if (subquestion === 'occluded_catalogue_composition') {
          const proposal = catalogueConfig ? await family.cataloguePropose(observation, rows, inputs, remaining, catalogueConfig,
            execution?.deadlineMs ?? null, execution?.now) : null;
          if (proposal) proposal.field_subquestion = 'occluded_catalogue_composition';
          return proposal as NativeProposal | null;
        }
        if (subquestion === 'queued_field_composition') {
          const proposal = queuedConfig ? family.queuedPropose(observation, rows, inputs, remaining, queuedConfig,
            execution?.deadlineMs ?? null, execution?.now) : null;
          if (proposal) proposal.field_subquestion = 'queued_field_composition';
          return proposal as NativeProposal | null;
        }
        if (subquestion === 'product_panel_composition') {
          const proposal = productConfig ? await family.productPropose(observation, rows, inputs, remaining, productConfig,
            execution?.deadlineMs ?? null, execution?.now) : null;
          if (proposal) proposal.field_subquestion = 'product_panel_composition';
          return proposal as NativeProposal | null;
        }
        if (subquestion === 'labeled_sequence_composition') {
          const proposal = labeledConfig ? await family.labeledPropose(observation, rows, inputs, remaining, labeledConfig,
            execution?.deadlineMs ?? null, execution?.now) : null;
          if (proposal) proposal.field_subquestion = 'labeled_sequence_composition';
          return proposal as NativeProposal | null;
        }
        if (subquestion === 'linked_packet_composition') {
          const proposal = linkedConfig ? await family.linkedPropose(observation, rows, inputs, remaining, linkedConfig,
            execution?.deadlineMs ?? null, execution?.now) : null;
          if (proposal) proposal.field_subquestion = 'linked_packet_composition';
          return proposal as NativeProposal | null;
        }
        if (subquestion === 'trace_field_composition') {
          const proposal = traceConfig ? await family.tracePropose(observation, rows, inputs, remaining, traceConfig,
            execution?.deadlineMs ?? null, execution?.now) : null;
          if (proposal) proposal.field_subquestion = 'trace_field_composition';
          return proposal as NativeProposal | null;
        }
        if (subquestion === 'rooted_quota_composition') {
          const proposal = rootedConfig ? await family.rootedPropose(observation, rows, inputs, remaining, rootedConfig,
            execution?.deadlineMs ?? null, execution?.now) : null;
          if (proposal) proposal.field_subquestion = 'rooted_quota_composition';
          return proposal as NativeProposal | null;
        }
        if (subquestion === 'field_service_composition') {
          const proposal = serviceConfig ? await family.servicePropose(observation, rows, inputs, remaining, serviceConfig) : null;
          if (proposal) proposal.field_subquestion = 'field_service_composition';
          return proposal as NativeProposal | null;
        }
        if (subquestion === 'radial_port_composition') {
          const proposal = radialConfig ? await family.radialPropose(observation, rows, inputs, remaining, radialConfig) : null;
          if (proposal) proposal.field_subquestion = 'radial_port_composition';
          return proposal as NativeProposal | null;
        }
        if (subquestion === 'typed_material_flow') {
          const proposal = materialConfig ? await family.materialPropose(observation, rows, inputs, remaining, materialConfig) : null;
          if (proposal) proposal.field_subquestion = 'typed_material_flow';
          return proposal as NativeProposal | null;
        }
        if (subquestion === 'cell_patch_composition') {
          const proposal = cellConfig ? await family.cellPropose(observation, rows, inputs, remaining, cellConfig, execution?.deadlineMs ?? null) : null;
          if (proposal) proposal.field_subquestion = 'cell_patch_composition';
          return proposal as NativeProposal | null;
        }
        if (subquestion === 'observed_occurrence_recall') return adapter.propose(observation, rows, inputs, remaining, execution);
        if (subquestion === 'observed_program_composition') {
          const proposal = await family.programPropose(observation, rows, inputs, remaining, execution?.deadlineMs ?? null, execution?.now);
          if (proposal) proposal.field_subquestion = 'observed_program_composition';
          return proposal as NativeProposal | null;
        }
        throw new TypeError('Unsupported shared-series source subquestion');
      }
      if (group !== 'goal_access') return null;
      if (subquestion === 'observed_composition_services') return observedConfig
        ? await family.observedPropose(observation, rows, inputs, remaining, observedConfig, execution?.deadlineMs ?? null) as NativeProposal | null : null;
      if (subquestion === 'coupled_support_composition') return coupledConfig
        ? await family.coupledPropose(observation, rows, inputs, remaining, coupledConfig, execution?.deadlineMs ?? null) as NativeProposal | null : null;
      if (subquestion === 'alternating_graph_composition') return graphConfig
        ? family.graphPropose(observation, rows, inputs, remaining, graphConfig, execution?.deadlineMs ?? null) as NativeProposal | null : null;
      throw new TypeError('Unsupported shared-series source subquestion');
    },
    proposeInGroup: async (group, observation, rows, inputs, remaining, execution) => {
    if (group === 'view') {
      const proposal = catalogueConfig ? await family.catalogueViewPropose(observation, rows, inputs, remaining, catalogueConfig,
        execution?.deadlineMs ?? null, execution?.now) : null;
      return proposal as NativeProposal | null;
    }
    if (group === 'goal_access') {
      const observed = observedConfig ? await family.observedPropose(observation, rows, inputs, remaining, observedConfig, execution?.deadlineMs ?? null) : null;
      if (observed) return observed as NativeProposal;
      const coupled = coupledConfig ? await family.coupledPropose(observation, rows, inputs, remaining, coupledConfig, execution?.deadlineMs ?? null) : null;
      if (coupled) return coupled as NativeProposal;
      return graphConfig ? family.graphPropose(observation, rows, inputs, remaining, graphConfig, execution?.deadlineMs ?? null) as NativeProposal | null : null;
    }
    if (group === 'window_constraints') {
      const catalogue = catalogueConfig ? await family.cataloguePropose(observation, rows, inputs, remaining, catalogueConfig,
        execution?.deadlineMs ?? null, execution?.now) : null;
      if (catalogue) catalogue.field_subquestion = 'occluded_catalogue_composition';
      if (catalogue) return catalogue as NativeProposal;
      const queued = queuedConfig ? family.queuedPropose(observation, rows, inputs, remaining, queuedConfig,
        execution?.deadlineMs ?? null, execution?.now) : null;
      if (queued) queued.field_subquestion = 'queued_field_composition';
      if (queued) return queued as NativeProposal;
      const product = productConfig ? await family.productPropose(observation, rows, inputs, remaining, productConfig,
        execution?.deadlineMs ?? null, execution?.now) : null;
      if (product) product.field_subquestion = 'product_panel_composition';
      if (product) return product as NativeProposal;
      const labeled = labeledConfig ? await family.labeledPropose(observation, rows, inputs, remaining, labeledConfig,
        execution?.deadlineMs ?? null, execution?.now) : null;
      if (labeled) labeled.field_subquestion = 'labeled_sequence_composition';
      if (labeled) return labeled as NativeProposal;
      const linked = linkedConfig ? await family.linkedPropose(observation, rows, inputs, remaining, linkedConfig,
        execution?.deadlineMs ?? null, execution?.now) : null;
      if (linked) linked.field_subquestion = 'linked_packet_composition';
      if (linked) return linked as NativeProposal;
      const trace = traceConfig ? await family.tracePropose(observation, rows, inputs, remaining, traceConfig,
        execution?.deadlineMs ?? null, execution?.now) : null;
      if (trace) trace.field_subquestion = 'trace_field_composition';
      if (trace) return trace as NativeProposal;
      const cell = cellConfig ? await family.cellPropose(observation, rows, inputs, remaining, cellConfig, execution?.deadlineMs ?? null) : null;
      if (cell) cell.field_subquestion = 'cell_patch_composition';
      if (cell) return cell as NativeProposal;
      const recall = await adapter.propose(observation, rows, inputs, remaining, execution);
      if (recall) return recall;
      const program = await family.programPropose(observation, rows, inputs, remaining, execution?.deadlineMs ?? null, execution?.now);
      if (program) program.field_subquestion = 'observed_program_composition';
      if (program) return program as NativeProposal;
      const material = materialConfig ? await family.materialPropose(observation, rows, inputs, remaining, materialConfig) : null;
      if (material) material.field_subquestion = 'typed_material_flow';
      if (material) return material as NativeProposal;
      const radial = radialConfig ? await family.radialPropose(observation, rows, inputs, remaining, radialConfig) : null;
      if (radial) radial.field_subquestion = 'radial_port_composition';
      if (radial) return radial as NativeProposal;
      const service = serviceConfig ? await family.servicePropose(observation, rows, inputs, remaining, serviceConfig) : null;
      if (service) service.field_subquestion = 'field_service_composition';
      if (service) return service as NativeProposal;
      const rooted = rootedConfig ? await family.rootedPropose(observation, rows, inputs, remaining, rootedConfig,
        execution?.deadlineMs ?? null, execution?.now) : null;
      if (rooted) rooted.field_subquestion = 'rooted_quota_composition';
      return rooted as NativeProposal | null;
    }
    return null;
  } };
}
