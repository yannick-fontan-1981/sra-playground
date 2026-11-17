import { cropReturn } from '../logos-engine/v6-public-return-visuals.ts';
import type { StrategyObjective } from './native-plan-receipt.ts';
import { missingControlNeed, missingControlStrategy, type MissingControlWitness } from './missing-control-strategy.ts';
import { readControlEffectTrigger } from './control-effect-trigger.ts';
import { contactRecoveryStrategies, isContactStrategy, isRecoveryStop, rootedRecoveryStrategy,
  type ContactRecoveryNeed, type ContactStrategy } from './active-recovery.ts';
import type { AgendaEntry } from './strategy-agenda.ts';
import { orderedContactId, orderedContactStrategies, verifyContactOrderId } from './ordered-contact.ts';
import { cavityAccessId, cavityStrategies } from './cavity-access.ts';
import { publicInputExplorationId, publicInputStrategies } from './public-input-exploration.ts';
import { recheckDirectionalControlsId, recheckDirectionalControlsStrategies } from './recheck-directional-controls.ts';
import { trialRepeatedLinearControlsId, trialRepeatedLinearControlsStrategies } from './trial-repeated-linear-controls.ts';
import { compareAvailableControlsId, compareAvailableControlsStrategies } from './compare-available-controls.ts';
import { framedContactId, framedContactStrategies, learnPatternAccessId } from './framed-contact.ts';
import { navigationPrimitives } from './navigation-primitives.ts';
import { learnTransportAccessId, transportContactId, transportContactStrategies } from './transport-contact.ts';
import { bandAlignmentId, bandAlignmentStrategies, verifyBandTransferId } from './band-alignment.ts';
import { sharedArrivalId, sharedArrivalStrategies, verifySharedArrivalId } from './shared-arrival.ts';
import { preparedConfigurationStrategies } from './prepared-configuration-card.ts';
import { learnOutlineServiceId, outlineServiceId, outlineServiceStrategies } from './outline-service.ts';
import { labeledSequenceId, labeledSequenceStrategies, learnLabeledSequenceId } from './labeled-sequence.ts';
import { markedCollectionId, markedCollectionStrategies } from './marked-collection.ts';
import { visibleConfigurationCoverageId, visibleConfigurationStrategies } from './visible-configuration-coverage.ts';
import { markedCompartmentFlowId, markedCompartmentStrategies } from './marked-compartment-flow.ts';
import { observedRelayRouteId, observedRelayStrategies } from './observed-relay-route.ts';
import { observedPrefixQuotasId, observedPrefixQuotaStrategies } from './observed-prefix-quotas.ts';
import { observedCarrierReductionId, observedCarrierStrategies } from './observed-carrier-reduction.ts';
import { observedLinePlacementId, observedLineStrategies } from './observed-line-placement.ts';
import { observedPolePairId, observedPolePairStrategies } from './observed-pole-pair.ts';
import { observedSharedRelationsId, observedSharedRelationsStrategies } from './observed-shared-relations.ts';
import { observedPatternLayoutId, observedPatternLayoutStrategies } from './observed-pattern-layout.ts';
import { observedActuatorArrangementId } from './observed-actuator-arrangement.ts';
import { observedRouteInterventionId } from './observed-route-intervention.ts';
import { observedSurvivalId } from './observed-survival.ts';
import { observedRailTransfersId } from './observed-rail-transfers.ts';
import { columnAlignmentId } from './column-alignment.ts';
import { settleMatchingEdgesId } from './settle-matching-edges.ts';
import { slotTransferId, slotTransferStrategies } from './slot-transfer.ts';
import { learnRemoteAccessId, remoteSupportRouteId, remoteSupportRouteStrategies } from './remote-support-route.ts';
import { occurrenceRecallId, occurrenceRecallStrategies, verifyOccurrenceChoiceId } from './occurrence-recall.ts';
import { slotPermutationId, slotPermutationStrategies, verifySlotPermutationId } from './slot-permutation.ts';
import { learnSurfaceCopyId, surfaceCopyId, surfaceCopyStrategies } from './surface-copy.ts';
import { codeRouteId, codeRouteStrategies, verifyProgramConfigurationId } from './code-route.ts';
import { profileTransferId, profileTransferStrategies, verifyProfileTransferId } from './profile-transfer.ts';
import { learnOrderedReplenishmentId, orderedReplenishmentId, orderedReplenishmentStrategies } from './ordered-replenishment.ts';
import { learnProgramOriginId, programOriginId, programOriginStrategies } from './program-origin.ts';
import { previewPlacementId, previewPlacementStrategies, verifyPreviewPlacementId } from './preview-placement.ts';
import { symbolContributionId, symbolContributionStrategies } from './symbol-contribution.ts';
import { markedLatticeId, markedLatticeStrategies, verifyMarkedLatticeId } from './marked-lattice.ts';
import { learnQueuedPlacementId, queuedPlacementId, queuedPlacementStrategies } from './queued-placement.ts';
import { legendRecolorId, legendRecolorStrategies, matchExampleId } from './legend-recolor.ts';
import { visualPatternId, visualPatternStrategies, verifyPatternChoiceId } from './visual-pattern.ts';
import { facetGrowthId, facetGrowthStrategies, learnFacetGrowthId } from './facet-growth.ts';
import { chartRouteId, chartRouteStrategies, learnChartRouteId } from './chart-route.ts';
import { populationPlacementId, populationPlacementStrategies, verifyReferencePlacementId } from './population-placement.ts';
import { carryToFrameId, carryToFrameStrategies, learnCarryToFrameId } from './carry-to-frame.ts';
import { learnPortPairingId, portPairingId, portPairingCardStrategies } from './port-pairing.ts';
import { contrastControlsId, contrastControlsStrategies, contrastProbeId } from './contrast-controls.ts';
import { displayCouplingId, displayCouplingStrategies } from './display-coupling.ts';
import { periodicProfileAlignmentId, periodicProfileStrategies } from './periodic-profile-alignment.ts';
import { framedSearchId, framedSearchStrategies, stableReferenceId, stableReferenceStrategies } from './framed-search.ts';
import { framedReceptionId, framedReceptionStrategies, learnFramedReceptionId } from './framed-reception.ts';
import { windowRelationId, windowRelationStrategies } from './window-relation.ts';
import { animationContactId, animationContactStrategies, learnAnimationContactId } from './animation-contact.ts';
import { coordinateObservedMotionId, reflectedPlacementId, reflectedPlacementStrategies } from './reflected-placement.ts';
import { learnMaterialAssemblyId, materialAssemblyId, materialAssemblyStrategies } from './material-assembly.ts';
import { coupledMotionId, coupledMotionStrategies, verifyCoupledRouteId } from './coupled-motion.ts';
import { materialRouteId, verifyConnectedRouteId, materialRouteStrategies } from './material-route.ts';
import { inventoryAccessId, verifyInventoryTransferId, inventoryAccessStrategies } from './inventory-access.ts';
import { replayAccessId, verifyRemoteReplayId } from './replay-access.ts';
import { orientedDeliveryId, verifyOrientedDeliveryId } from './oriented-delivery.ts';
import { indicatedJumpId, learnIndicatedJumpId } from './indicated-jump.ts';
import { highlightedRouteId, learnHighlightedRouteId } from './highlighted-route.ts';
import { learnPairedPassageId, pairedPassageId } from './paired-passage.ts';
import { seatedContactId, verifyFrameContactId } from './seated-contact.ts';
import { learnSwitchedSurfaceId, switchedSurfaceId } from './switched-surface.ts';
import { markedGaugeId, verifyGaugeEffectId } from './marked-gauge.ts';
import { coupledGaugeRouteId } from './coupled-gauge-route.ts';
import { mergeForDemandId } from './merge-for-demand.ts';
import { reactiveTargetId, verifyReactiveMotionId } from './reactive-target.ts';
import { pairedChannelsId, verifyChannelAccessId } from './paired-channels.ts';
import { compartmentGrowthId } from './compartment-growth.ts';
import { pointReachId, verifyPointAccessId } from './point-reach.ts';
import { linkedMidpointId, verifyLinkedMotionId } from './linked-midpoint.ts';
import { linkedGroupRouteId } from './linked-group-route.ts';
import { excavateDescentId, verifyRemovableSupportId } from './excavate-descent.ts';
import { protectGravityRouteId } from './protect-gravity-route.ts';
import { gatedCascadeId, learnCascadeId } from './gated-cascade.ts';
import { layeredFitId, learnLayeredFitId } from './layered-fit.ts';
import { litRouteId, learnLitRouteId } from './lit-route.ts';
import { learnPivotCargoId, pivotCargoId } from './pivot-cargo.ts';
import { learnNestedPassageId, nestedPassageId } from './nested-passage.ts';
import { learnContactAccessId, translateCoupledPiecesId } from './translate-coupled-pieces.ts';
import { stagedMarksId, verifyCombinedMarksId } from './staged-marks.ts';
import { learnSelectedAccessId, moveMaskedPiecesId } from './move-masked-pieces.ts';
import { learnLinkOpeningsId, linkOpeningsId } from './link-openings.ts';
import { learnAnimatedCueId, reproduceCueId } from './reproduce-cue.ts';
import { navigateRevealedGridId } from './navigate-revealed-grid.ts';
import { learnGridAccessId } from './learn-grid-access.ts';
import { arrangeTurnPostsId, learnTurnPostsId } from './arrange-turn-posts.ts';
import { learnSupportMovesId, learnObservedSupportsId } from './learn-support-moves.ts';
import { learnScopeEffectsId, learnVisibleGroupEffectsId } from './learn-scope-effects.ts';
import { learnCorrespondenceId, learnCorrespondenceStrategies, learnRepeatedCellsId } from './learn-correspondence.ts';
import { glyphEditingId, verifySequenceEditsId, glyphEditingStrategies } from './glyph-editing.ts';
import { fieldIsolationId, learnFieldIsolationId, fieldIsolationStrategies } from './field-isolation.ts';
import { directionalReceptionId, directionalReceptionStrategies, learnDirectionalReceptionId } from './directional-reception.ts';
import { learnWindowCoverageId, windowCoverageId, windowCoverageStrategies } from './window-coverage.ts';
import { panelMatchingId, panelMatchingStrategies, verifyPanelConfigurationId } from './panel-matching.ts';
import { crossingRowsId, crossingRowsStrategies, verifyCrossingRowsId } from './crossing-rows.ts';
import { parallelSymbolPrefixesId } from './parallel-symbol-prefixes.ts';
import { traceCoverageId, traceCoverageStrategies, verifyTraceCoverageId } from './trace-coverage.ts';
import { learnRadialConnectionId, radialConnectionId, radialConnectionStrategies } from './radial-connection.ts';
import { invitedCaptureId, invitedCaptureStrategies, verifyCaptureRouteId } from './invited-capture.ts';
import { branchAlignmentId, branchAlignmentStrategies, verifyBranchAlignmentId } from './branch-alignment.ts';
import { feedbackTrialId, feedbackTrialStrategies, verifyOrderedFeedbackId } from './feedback-trial.ts';
import { feedbackChoiceStrategies } from './feedback-choice-card.ts';
import { catalogueComparisonId, catalogueComparisonStrategies, revealedExampleId } from './catalogue-comparison.ts';
import { learnReceptionAccessId, receptionAccessId, receptionAccessStrategies } from './reception-access.ts';
import { markerCoverageId, markerCoverageStrategies, verifyMarkerPlacementId } from './marker-coverage.ts';
import { frontierStrategies, isFrontierStrategy, type FrontierStrategy } from './frontier-strategy.ts';
import { isViewStrategy, viewStrategies, type ViewStrategy } from './view-strategy.ts';
import { informationStrategies, isInformationStrategy, type InformationStrategy } from './information-strategy.ts';
import { openNeedLabels, readSicNeed } from './need-registry.ts';
import { openingCuriosityLabel } from './opening-curiosity.ts';
import { isFrontierInputOrder, type FrontierChoiceEvidence, type FrontierInputOrder, type FrontierLocalRule } from './frontier-configuration.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

const situationStrategies = { ...orderedContactStrategies, ...cavityStrategies, ...publicInputStrategies, ...compareAvailableControlsStrategies, ...framedContactStrategies,
  ...transportContactStrategies, ...bandAlignmentStrategies, ...sharedArrivalStrategies, ...outlineServiceStrategies,
  ...labeledSequenceStrategies, ...markedCollectionStrategies, ...slotTransferStrategies, ...remoteSupportRouteStrategies,
  ...occurrenceRecallStrategies, ...slotPermutationStrategies, ...surfaceCopyStrategies, ...codeRouteStrategies, ...profileTransferStrategies,
  ...orderedReplenishmentStrategies, ...programOriginStrategies, ...previewPlacementStrategies, ...symbolContributionStrategies, ...markedLatticeStrategies,
  ...queuedPlacementStrategies, ...legendRecolorStrategies, ...visualPatternStrategies, ...facetGrowthStrategies, ...chartRouteStrategies, ...populationPlacementStrategies, ...carryToFrameStrategies, ...portPairingCardStrategies, ...displayCouplingStrategies, ...framedSearchStrategies, ...glyphEditingStrategies, ...fieldIsolationStrategies, ...directionalReceptionStrategies, ...windowCoverageStrategies, ...panelMatchingStrategies, ...crossingRowsStrategies, ...traceCoverageStrategies, ...radialConnectionStrategies, ...invitedCaptureStrategies, ...branchAlignmentStrategies, ...feedbackTrialStrategies, ...catalogueComparisonStrategies, ...receptionAccessStrategies, ...markerCoverageStrategies, ...framedReceptionStrategies, ...windowRelationStrategies, ...animationContactStrategies, ...reflectedPlacementStrategies, ...materialAssemblyStrategies, ...coupledMotionStrategies, ...materialRouteStrategies, ...inventoryAccessStrategies, ...learnCorrespondenceStrategies };

export interface NativeStep {
  readonly action: string;
  readonly expected: string | null;
}

export interface NativePlanContext {
  readonly obligation: string | null;
  readonly access: string | null;
  readonly effect: string | null;
  readonly orientation: 'aligned' | 'different' | 'ambiguous' | null;
  readonly residual: number | null;
  readonly entryDelta: number | null;
  readonly entryStatus: string | null;
  readonly entryActions: readonly number[];
  readonly strategy?: NativeStrategyContext;
}

type MeterStrip = readonly [axis: 'x' | 'y', line: number, color: number, anchor: 'lo' | 'hi', edge: number];

interface NativeStrategyContext {
  readonly route: string | null;
  readonly pairRef: string | null;
  readonly color: 'equal' | 'different' | null;
  readonly colors: readonly [number, number] | null;
  readonly capacityNeeded: boolean;
  readonly directCost: number | null;
  readonly totalCost: number | null;
  readonly plannedCharges: number;
  readonly colorWitness: number | null;
  readonly patternWitness: number | null;
  readonly meter: { readonly strip: MeterStrip | null; readonly steps: number; readonly units: number;
    readonly rate: number; readonly capacity: number | null } | null;
}

export interface NativeResolution {
  readonly family: string | null;
  readonly proposalKind: string | null;
  readonly question: string | null;
  readonly objective: string | null;
  readonly objectiveSource: 'native' | 'question' | 'unpublished' | null;
  readonly strategyObjective?: StrategyObjective;
  readonly situationCard?: { readonly strategy: keyof typeof situationStrategies; readonly need: string; readonly mode: string;
    readonly situation: string; readonly triggerCard?: string; readonly agenda: readonly AgendaEntry<keyof typeof situationStrategies>[];
    readonly evidenceActions: readonly number[]; readonly distance: number | null;
    readonly predictionSupport?: { readonly actions: readonly number[]; readonly compatibleRelations: number } };
  readonly missingControl?: MissingControlWitness;
  readonly operation: string | null;
  readonly searchOperation?: string;
  readonly recoveryOperations?: readonly { key: string; finding: string }[];
  readonly recoveryDecision?: { readonly strategy: string; readonly need: string; readonly objective: SicObjective | null; readonly maxDepth: number;
    readonly maxNodes: number; readonly packDigest: string | null; readonly agenda?: readonly AgendaEntry<ContactStrategy>[];
    readonly situationAction?: number; readonly agendaEvidence?: Readonly<Partial<Record<ContactStrategy, readonly number[]>>> };
  readonly recoveryAction?: number;
  readonly composition: string | null;
  readonly compositions: readonly { readonly id: string; readonly role: string | null; readonly observed: boolean | null }[];
  readonly subjects: readonly { readonly label: string; readonly box: NativeBox }[];
  readonly route: readonly NativePoint[];
  readonly proposalRef: string | null;
  readonly planRevision?: number;
  readonly releasedPlan?: { readonly family: string; readonly planned: number; readonly objective: string | null };
  readonly frontierStrategy?: { readonly title: string; readonly objective: SicObjective; readonly inputOrder: FrontierInputOrder | null;
    readonly choices?: Readonly<Record<FrontierInputOrder, string>>; readonly agenda: readonly AgendaEntry<FrontierStrategy>[];
    readonly viewContinuity?: true;
    readonly opening?: { readonly mode: 'active' | 'shadow'; readonly command: string; readonly baseline: string; readonly relations: number };
    readonly ruleEvidence?: FrontierChoiceEvidence;
    readonly localRule?: { readonly title: string; readonly matched: boolean; readonly mode: FrontierLocalRule['mode']; readonly reason: string } };
  readonly viewStrategy?: { readonly title: string; readonly objective: SicObjective; readonly agenda: readonly AgendaEntry<ViewStrategy>[];
    readonly expectedPixels: number | null; readonly agendaEvidence: Readonly<Partial<Record<ViewStrategy, readonly number[]>>> };
  readonly informationStrategy?: { readonly title: string; readonly objective: SicObjective; readonly agenda: readonly AgendaEntry<InformationStrategy>[];
    readonly distinctOutcomes: number | null; readonly openingComplexity?: number; readonly openingShadow?: { readonly command: string; readonly relations: number };
    readonly preference?: { readonly mode: 'shadow' | 'active'; readonly strategy: InformationStrategy; readonly minimumOutcomes: number;
      readonly baseline: string; readonly preferred: string | null; readonly preferredOutcomes: number | null } };
  readonly remainingSteps: number;
  readonly footprint: NativeBox | null;
  readonly context: NativePlanContext | null;
  readonly guard: string | null;
  readonly pending: boolean;
  readonly steps: readonly NativeStep[];
  readonly nextIndex: number | null;
  readonly outcome: { readonly family: string; readonly matched: boolean | null; readonly reason: string | null;
    readonly frontierOutcome?: { readonly objective: string; readonly status: 'observed' | 'access_interrupted' };
    readonly viewOutcome?: { readonly objective: string; readonly status: 'expanded' | 'no_new_area' | 'unregistered'; readonly newPixels: number | null };
    readonly informationOutcome?: { readonly objective: string; readonly matched: number; readonly contradicted: number; readonly unknown: number };
    readonly recoveryNeed?: { readonly id: string; readonly status: ContactRecoveryNeed['status'] } } | null;
  readonly history: readonly { readonly sequence: number; readonly level: number; readonly family: string;
    readonly matched: boolean | null; readonly reason: string | null }[];
}

export interface SicObjective {
  readonly id: string;
  readonly label: string;
  readonly parent: string;
}

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const label = (value: unknown) => typeof value === 'string' && value.length <= 320 ? value : null;
const natural = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;

function readAgenda<Id extends string>(value: unknown, accepts: (id: unknown) => id is Id): AgendaEntry<Id>[] {
  return Array.isArray(value) ? value.slice(0, 16).flatMap(item => {
    const entry = record(item), reason = label(entry?.reason), applicability = entry?.applicability, result = entry?.result;
    if (!accepts(entry?.id) || !reason
      || (applicability !== 'applicable' && applicability !== 'inapplicable' && applicability !== 'undetermined')
      || (result !== 'selected' && result !== 'no_plan' && result !== 'lower_priority' && result !== 'skipped' && result !== 'shadow')) return [];
    const evidence = Array.isArray(entry.evidence) ? entry.evidence.slice(0, 16).filter((ref): ref is string => typeof ref === 'string') : [];
    return [{ id: entry.id, applicability, result, reason, evidence }];
  }) : [];
}

export function readRecoveryRefusal(agent: { sessionId: string | null; sequence: number; level: number; trace: readonly unknown[] }) {
  if (!agent.sessionId) return null;
  const scope = `${agent.sessionId}:epoch:${agent.level}:revision:${agent.sequence + 1}:frame:`;
  const refusal = agent.trace.slice(-128).reverse().map(record).find(event =>
    event?.kind === 'sic_recovery_refusal' && typeof event.observation_ref === 'string' && event.observation_ref.startsWith(scope));
  if (!isRecoveryStop(refusal?.reason)) return null;
  const agenda = readAgenda(record(refusal?.decision)?.agenda, isContactStrategy);
  return agenda.length ? { reason: refusal.reason, agenda } : null;
}

export function readFrontierRefusal(agent: Parameters<typeof readRecoveryRefusal>[0]) {
  if (!agent.sessionId) return [];
  const scope = `${agent.sessionId}:epoch:${agent.level}:revision:${agent.sequence + 1}:frame:`;
  const refusal = agent.trace.slice(-128).reverse().map(record).find(event =>
    event?.kind === 'sic_frontier_refusal' && typeof event.observation_ref === 'string' && event.observation_ref.startsWith(scope));
  return readAgenda(record(refusal?.decision)?.agenda, isFrontierStrategy);
}

export function readOpenNeed(agent: Parameters<typeof readRecoveryRefusal>[0]) {
  if (!agent.sessionId) return null;
  const scope = `${agent.sessionId}:epoch:${agent.level}:revision:${agent.sequence + 1}:frame:`;
  const refusal = agent.trace.slice(-128).reverse().map(record).find(event =>
    (event?.kind === 'sic_frontier_refusal' || event?.kind === 'sic_recovery_refusal')
    && typeof event.observation_ref === 'string' && event.observation_ref.startsWith(scope));
  const need = readSicNeed(record(refusal?.decision)?.need);
  if (need?.status !== 'open' || !Object.hasOwn(openNeedLabels, need.kind)) return null;
  return { label: openNeedLabels[need.kind as keyof typeof openNeedLabels] };
}

const actions: Record<string, string> = { ACTION1: 'Up', ACTION2: 'Down', ACTION3: 'Left', ACTION4: 'Right',
  ACTION5: 'Space', ACTION6: 'Click', ACTION7: 'Action 7' };

function actionName(value: unknown): string | null {
  const action = record(value);
  const name = actions[label(action?.action_ref) ?? ''];
  if (!name) return null;
  const point = record(action?.data);
  return name === 'Click' && Number.isSafeInteger(point?.x) && Number.isSafeInteger(point?.y)
    ? `Click (${point!.x}, ${point!.y})` : name;
}

function expectedText(value: unknown): string | null {
  if (typeof value === 'string' && value.length) return 'Compare the returned board with the forecast';
  const expected = record(value);
  if (!expected) return null;
  const position = expected.position ?? expected.body_position;
  if (Array.isArray(position) && position.length === 2 && position.every(Number.isSafeInteger)) {
    return `Position (${position.join(', ')})`;
  }
  if (Object.values(expected).includes('unknown')) return null;
  return 'Check predicted effect';
}

/** Read the public snapshot only. Never propose, admit or execute an action. */
export function readNativeResolution(agent: {
  readonly sessionId: string | null; readonly sequence: number; readonly level: number;
  readonly trace: readonly unknown[]; readonly lastDecision: string | null; readonly proposal: unknown;
  readonly phase: string | null;
}): NativeResolution | null {
  if (!agent.sessionId) return null;
  const entries = agent.trace.slice(-128).map(record);
  const reverse = [...entries].reverse();
  const currentRef = `${agent.sessionId}:epoch:${agent.level}:revision:${agent.sequence + 1}:frame:`;
  const result = reverse.find(event => event?.kind === 'actual_outcome'
    && typeof event.observation_ref === 'string' && event.observation_ref.startsWith(currentRef));
  const scope = `${agent.sessionId}:epoch:`;
  const history: NativeResolution['history'] = entries.flatMap(event => {
    const ref = event?.observation_ref;
    const family = label(event?.family);
    if (event?.kind !== 'actual_outcome' || !family || typeof ref !== 'string' || !ref.startsWith(scope)
        || (event.matched !== null && typeof event.matched !== 'boolean')) return [];
    const match = /^(\d+):revision:(\d+):frame:/.exec(ref.slice(scope.length));
    if (!match) return [];
    const sequence = Number(match[2]) - 1, level = Number(match[1]);
    return sequence > 0 && sequence <= agent.sequence ? [{ sequence, level, family, matched: event.matched, reason: label(event.reason) }] : [];
  }).slice(-12);
  const family = label(agent.lastDecision);
  const pending = agent.phase === 'authorised_not_executed';
  const active = record(agent.proposal);
  const binding = record(active?.binding);
  const activeRef = binding?.observation_ref;
  const scoped = typeof activeRef !== 'string' || activeRef.startsWith(scope + agent.level + ':');
  const proposal = active && scoped ? active : null;
  const proposalAt = entries.map(event => event?.kind === 'proposal' && event.family === family).lastIndexOf(true);
  const guard = proposal && proposalAt >= 0 ? entries.slice(proposalAt + 1).reverse().find(event =>
    event?.kind === 'before_guard' && event.family === family && event.admitted === true) : null;
  const release = pending && guard ? entries.slice(proposalAt + 1).reverse().find(event =>
    event?.kind === 'why_act_release' && event.admitted === true) : null;
  const planReceipt = pending && proposalAt >= 0 && proposal ? entries.slice(proposalAt + 1).find(event =>
    event?.kind === 'sic_native_plan' && event.family === family
    && typeof event.observationRef === 'string' && event.observationRef.startsWith(`${scope}${agent.level}:`))
    : result?.sic_plan ? entries.find(event => event?.kind === 'sic_native_plan' && event.id === result.sic_plan) : null;
  const receiptFamily = label(planReceipt?.family), receiptSize = natural(planReceipt?.planned);
  const releasedPlan = receiptFamily && receiptSize ? { family: receiptFamily, planned: receiptSize, objective: label(planReceipt?.objective) } : undefined;
  const objectiveReceipt = record(planReceipt?.strategyObjective);
  const objectiveStrategy = label(objectiveReceipt?.strategy), receiptRef = label(objectiveReceipt?.observationRef);
  const receiptParent = label(objectiveReceipt?.parent), receiptAim = label(objectiveReceipt?.aim);
  const strategyObjective = objectiveStrategy && receiptRef && receiptRef === planReceipt?.observationRef
    && objectiveStrategy === planReceipt?.strategy && receiptParent === planReceipt?.objective && (receiptParent || receiptAim)
    ? { strategy: objectiveStrategy, parent: receiptParent, aim: receiptAim, observationRef: receiptRef } : undefined;
  const control = record(planReceipt?.missingControl);
  const controlAction = label(control?.action);
  const controlEvidence = Array.isArray(control?.evidence) ? control.evidence.slice(0, 8).filter((ref): ref is string => typeof ref === 'string') : [];
  const controlAgenda = readAgenda([control?.agenda], (value): value is typeof missingControlStrategy => value === missingControlStrategy)[0];
  const controlTrigger = typeof control?.observationRef === 'string' ? readControlEffectTrigger(control.trigger, control.observationRef) : undefined;
  const missingControl: MissingControlWitness | undefined = control?.id === missingControlStrategy && control.need === missingControlNeed
    && controlAction && typeof control.observationRef === 'string' && control.observationRef === planReceipt?.observationRef
    && controlEvidence.includes(control.observationRef)
    ? { id: missingControlStrategy, need: missingControlNeed, observationRef: control.observationRef, action: controlAction, evidence: controlEvidence,
      ...(controlAgenda?.result === 'selected' && controlAgenda.applicability === 'applicable' ? { agenda: controlAgenda } : {}),
      ...(controlTrigger ? { trigger: controlTrigger } : {}) } : undefined;
  const traced = proposalAt >= 0 && result && proposalAt < entries.indexOf(result) && result.family === family
    ? entries[proposalAt] : null;
  const stepList = Array.isArray(proposal?.steps) ? proposal.steps : [];
  const plan = Array.isArray(proposal?.actions) ? proposal.actions
    : Array.isArray(traced?.actions) ? traced.actions : [];
  const steps = plan.slice(0, 24).flatMap((action, index) => {
    const name = actionName(action);
    return name ? [{ action: name, expected: expectedText(record(stepList[index])?.expected_after) }] : [];
  });
  const outcomeFamily = label(result?.family);
  if (!family && !outcomeFamily) return null;
  const template = record(proposal?.bundle_template);
  const question = strategyObjective?.aim ?? label(record(proposal?.question ?? traced?.question)?.reason) ?? label(template?.purpose);
  const nativeObjective = strategyObjective?.parent ?? label(template?.objective_ref);
  const frontier = record(proposal?.sic_frontier_decision), frontierTarget = record(frontier?.objective);
  const frontierId = frontier?.strategy, frontierObjectiveId = label(frontierTarget?.id), frontierObjectiveLabel = label(frontierTarget?.label);
  const frontierChoices = record(frontier?.choices);
  const leastTried = actionName(frontierChoices?.least_tried), commandOrder = actionName(frontierChoices?.command_order);
  const frontierEvidence = record(frontier?.ruleEvidence), candidateRefs = record(frontierEvidence?.candidateRefs);
  const leastRef = label(candidateRefs?.least_tried), stableRef = label(candidateRefs?.command_order);
  const usageGap = natural(frontierEvidence?.usageGap);
  const rule = record(frontier?.localRule), ruleName = label(rule?.title), ruleReason = label(rule?.reason), ruleMode = rule?.mode;
  const baseOrder = frontier?.inputRanked === true && isFrontierInputOrder(frontier.inputOrder) ? frontier.inputOrder : null;
  const opening = record(frontier?.openingCuriosity), openingEvidence = record(opening?.evidence);
  const openingCommand = actionName(opening?.command), baselineCommand = actionName(opening?.baseline);
  const openingRelations = natural(openingEvidence?.distinctRelations), openingMode = opening?.mode;
  const frontierStrategy: NativeResolution['frontierStrategy'] = nativeObjective && frontierObjectiveId && frontierObjectiveLabel && frontierTarget?.parent === nativeObjective
    && isFrontierStrategy(frontierId)
    ? { title: openingMode === 'active' ? openingCuriosityLabel : frontierStrategies[frontierId], objective: { id: frontierObjectiveId, label: frontierObjectiveLabel, parent: nativeObjective },
      inputOrder: baseOrder && isFrontierInputOrder(frontier?.effectiveOrder) ? frontier.effectiveOrder : baseOrder,
      agenda: readAgenda(frontier?.agenda, isFrontierStrategy),
      ...(frontier?.purpose === 'view_continuity' ? { viewContinuity: true as const } : {}),
      ...(openingCommand && baselineCommand && openingRelations !== null && (openingMode === 'shadow' || openingMode === 'active')
        ? { opening: { mode: openingMode, command: openingCommand, baseline: baselineCommand, relations: openingRelations } } : {}),
      ...(leastRef && stableRef && usageGap !== null ? { ruleEvidence: { candidateRefs: { least_tried: leastRef, command_order: stableRef }, usageGap } } : {}),
      ...(ruleName && ruleReason && typeof rule?.matched === 'boolean' && (ruleMode === 'active' || ruleMode === 'shadow')
        ? { localRule: { title: ruleName, reason: ruleReason, mode: ruleMode, matched: rule.matched } } : {}),
      ...(leastTried && commandOrder ? { choices: { least_tried: leastTried, command_order: commandOrder } } : {}) }
    : undefined;
  const objectiveSource = nativeObjective ? 'native' : steps.length && question ? 'question' : steps.length ? 'unpublished' : null;
  const viewDecision = record(proposal?.sic_view_decision), viewTarget = record(viewDecision?.objective);
  const viewObjective = label(viewTarget?.id), viewKind = viewDecision?.strategy;
  const information = record(proposal?.sic_information_decision), informationTarget = record(information?.objective);
  const informationObjective = label(informationTarget?.id), informationKind = information?.strategy;
  const complexity = natural(information?.openingComplexity);
  const shadow = record(information?.openingShadow);
  const shadowCommand = actionName(shadow?.action), shadowRelations = natural(shadow?.relations);
  const preference = record(information?.preference);
  const baseline = actionName(preference?.baseline), minimumOutcomes = natural(preference?.minimumOutcomes);
  const informationStrategy: NativeResolution['informationStrategy'] = information?.mode === 'active' && nativeObjective && informationObjective
    && informationTarget?.parent === nativeObjective && isInformationStrategy(informationKind) ? {
      title: complexity === null ? informationStrategies[informationKind] : openingCuriosityLabel,
      objective: { id: informationObjective, label: informationStrategies[informationKind], parent: nativeObjective },
      distinctOutcomes: natural(record(information.evidence)?.distinctOutcomes),
      ...(complexity !== null ? { openingComplexity: complexity } : {}),
      ...(shadowCommand && shadowRelations !== null ? { openingShadow: { command: shadowCommand, relations: shadowRelations } } : {}),
      ...(baseline && minimumOutcomes !== null && isInformationStrategy(preference?.strategy)
        && (preference?.mode === 'shadow' || preference?.mode === 'active') ? {
          preference: { mode: preference.mode, strategy: preference.strategy, minimumOutcomes, baseline,
            preferred: actionName(preference.preferred), preferredOutcomes: natural(preference.preferredOutcomes) },
        } : {}),
      agenda: Array.isArray(information.considered) ? information.considered.slice(0, 12).flatMap(value => {
        const attempt = record(value), id = attempt?.strategy, result = attempt?.result;
        return isInformationStrategy(id) && (result === 'selected' || result === 'no_plan') ? [{ id, result, applicability: 'applicable' as const,
          reason: result === 'selected' ? 'The predicted returns differ on measured evidence.' : 'The candidate did not produce an admissible experiment.' }] : [];
      }) : [],
    } : undefined;
  const morphology = record(proposal?.morphology_plan);
  const entry = record(morphology?.entry_model);
  const facts = record(record(proposal?.morphology)?.measured_facts);
  const orientation = facts?.orientation_relation;
  const quarterTurns = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 4 ? value : null;
  const priorAction = (ref: unknown): number | null => {
    const prefix = `${scope}${agent.level}:revision:`;
    if (typeof ref !== 'string' || !ref.startsWith(prefix)) return null;
    const match = /^(\d+):frame:/.exec(ref.slice(prefix.length));
    const sequence = match ? Number(match[1]) - 1 : 0;
    return sequence > 0 && sequence <= agent.sequence ? sequence : null;
  };
  const entryActions = Array.isArray(entry?.evidence) ? entry.evidence.slice(0, 16).flatMap(ref => {
    const action = ref === activeRef || ref === entry?.observation_ref ? null : priorAction(ref);
    return action === null ? [] : [action];
  }) : [];
  const forecast = record(facts?.meter_forecast);
  const strip = forecast?.measured_strip;
  const meterStrip: MeterStrip | null = Array.isArray(strip) && strip.length === 5
    && (strip[0] === 'x' || strip[0] === 'y') && natural(strip[1]) !== null && natural(strip[2]) !== null
    && (strip[3] === 'lo' || strip[3] === 'hi') && natural(strip[4]) !== null
    ? [strip[0], strip[1], strip[2], strip[3], strip[4]] : null;
  const meterSteps = natural(forecast?.steps_before_empty), meterUnits = natural(forecast?.current_units), meterRate = natural(forecast?.loss_per_step);
  const color = facts?.color_relation;
  const colors = record(facts?.feature_residuals)?.observed_colors;
  const context: NativePlanContext | null = morphology ? {
    obligation: label(morphology.obligation),
    access: label(morphology.access_phase),
    effect: label(morphology.physical_effect ?? morphology.route_key),
    orientation: orientation === 'aligned' || orientation === 'different' || orientation === 'ambiguous' ? orientation : null,
    residual: quarterTurns(entry?.residual),
    entryDelta: quarterTurns(entry?.entry_delta),
    entryStatus: label(entry?.status),
    entryActions: [...new Set(entryActions)],
    strategy: {
      route: label(morphology.route_key),
      pairRef: label(facts?.pair_ref),
      color: color === 'equal' || color === 'different' ? color : null,
      colors: Array.isArray(colors) && colors.length === 2 && colors.every(value => natural(value) !== null)
        ? [colors[0], colors[1]] : null,
      capacityNeeded: facts?.capacity_needed === true,
      directCost: natural(facts?.direct_goal_cost_lower_bound),
      totalCost: natural(morphology.total_cost),
      plannedCharges: Array.isArray(morphology.charge_order) ? morphology.charge_order.length : 0,
      colorWitness: priorAction(record(facts?.feature_reaccess)?.effect_after),
      patternWitness: priorAction(facts?.single_pattern_change_observation_ref),
      meter: meterSteps !== null && meterUnits !== null && meterRate
        ? { strip: meterStrip, steps: meterSteps, units: meterUnits, rate: meterRate, capacity: natural(forecast?.capacity_steps) } : null,
    },
  } : null;
  const pair = record(morphology?.pair);
  const subjects: NativeResolution['subjects'][number][] = [];
  const bounds = (value: unknown): NativeBox | null => Array.isArray(value) && value.length === 4
    && value.every(Number.isSafeInteger) ? [value[0], value[1], value[2], value[3]] : null;
  if (Array.isArray(pair?.sites)) for (const [index, site] of pair.sites.slice(0, 2).entries()) {
    const box = bounds(site);
    if (box) subjects.push({ label: `Pattern compared by the engine ${index + 1}`, box });
  }
  const routeIndex = guard && Number.isSafeInteger(guard.index) ? Number(guard.index) : 0;
  const support = record(proposal?.support_plan);
  const bodyType = Array.isArray(support?.body_type) && support.body_type.length === 3 ? support.body_type : null;
  const positionSteps = Array.isArray(morphology?.steps) ? morphology.steps
    : stepList.map(item => {
      const step = record(item), earlier = record(step?.expected_before), later = record(step?.expected_after);
      return { from: step?.from ?? earlier?.body_position, to: step?.to ?? later?.body_position };
    });
  const measuredStep = record(positionSteps[routeIndex]);
  const point = measuredStep?.from;
  const size = morphology?.size ?? (bodyType ? [bodyType[2], bodyType[1]] : null);
  let footprint: NativeBox | null = null;
  if (Array.isArray(point) && Array.isArray(size) && point.length === 2 && size.length === 2
      && [...point, ...size].every(Number.isSafeInteger) && size.every(n => n > 0)) {
    footprint = [point[0], point[1], point[0] + size[0] - 1, point[1] + size[1] - 1];
    subjects.push({ label: 'Controlled footprint before the step', box: footprint });
  }
  const op = label(template?.operation_key);
  const rooted = record(proposal?.rooted_line_plan);
  const rootedScene = record(rooted?.scene);
  const labels = family === orderedContactId ? orderedContactStrategies : family === cavityAccessId ? cavityStrategies
    : family === publicInputExplorationId ? publicInputStrategies
    : family === recheckDirectionalControlsId ? recheckDirectionalControlsStrategies
    : family === trialRepeatedLinearControlsId ? trialRepeatedLinearControlsStrategies
    : family === stableReferenceId ? stableReferenceStrategies
    : (family === verifySharedArrivalId || family === verifyPanelConfigurationId || family === verifyProgramConfigurationId
      || family === verifyCombinedMarksId) ? preparedConfigurationStrategies
    : (family === verifyOccurrenceChoiceId || family === verifyOrderedFeedbackId || family === verifyPatternChoiceId) ? feedbackChoiceStrategies
    : (family === verifyBandTransferId || family === verifyPointAccessId || family === verifyLinkedMotionId || family === linkedGroupRouteId || family === mergeForDemandId
      || family === verifySlotPermutationId || family === verifyPreviewPlacementId || family === verifyReferencePlacementId
      || family === verifyProfileTransferId || family === verifyCaptureRouteId || family === verifyMarkerPlacementId
      || family === verifyFrameContactId || family === verifyContactOrderId || family === verifyCoupledRouteId
      || family === verifyOrientedDeliveryId || family === verifyTraceCoverageId || family === verifyCrossingRowsId
      || family === verifyBranchAlignmentId || family === verifyMarkedLatticeId) ? inventoryAccessStrategies
    : family === compareAvailableControlsId ? compareAvailableControlsStrategies
    : family === visibleConfigurationCoverageId ? visibleConfigurationStrategies
    : family === markedCompartmentFlowId ? markedCompartmentStrategies
    : family === observedRelayRouteId ? observedRelayStrategies
    : family === observedPrefixQuotasId ? observedPrefixQuotaStrategies
    : family === observedCarrierReductionId ? observedCarrierStrategies
    : family === observedLinePlacementId ? observedLineStrategies
    : family === observedPolePairId ? observedPolePairStrategies
    : family === observedSharedRelationsId ? observedSharedRelationsStrategies
    : family === observedPatternLayoutId ? observedPatternLayoutStrategies
    : family === periodicProfileAlignmentId ? periodicProfileStrategies
    : family === learnGridAccessId || family === learnSelectedAccessId || family === learnContactAccessId || family === coupledGaugeRouteId ? inventoryAccessStrategies
    : family === framedContactId ? { ...framedContactStrategies, ...navigationPrimitives } : family === learnPatternAccessId || family === learnTransportAccessId || family === learnReceptionAccessId || family === learnRemoteAccessId ? inventoryAccessStrategies
      : family === transportContactId ? transportContactStrategies : family === bandAlignmentId ? bandAlignmentStrategies
        : family === sharedArrivalId ? sharedArrivalStrategies : (family === outlineServiceId || family === learnOutlineServiceId) ? outlineServiceStrategies
          : (family === labeledSequenceId || family === learnLabeledSequenceId) ? labeledSequenceStrategies : family === markedCollectionId ? markedCollectionStrategies
            : family === slotTransferId ? slotTransferStrategies : family === remoteSupportRouteId ? remoteSupportRouteStrategies
              : family === occurrenceRecallId ? occurrenceRecallStrategies : family === slotPermutationId ? slotPermutationStrategies
                : (family === surfaceCopyId || family === learnSurfaceCopyId) ? surfaceCopyStrategies : family === codeRouteId ? codeRouteStrategies
                  : family === profileTransferId ? profileTransferStrategies : (family === orderedReplenishmentId || family === learnOrderedReplenishmentId) ? orderedReplenishmentStrategies
                    : (family === programOriginId || family === learnProgramOriginId) ? programOriginStrategies : family === previewPlacementId ? previewPlacementStrategies
                      : family === symbolContributionId ? symbolContributionStrategies : family === markedLatticeId ? markedLatticeStrategies
                        : (family === queuedPlacementId || family === learnQueuedPlacementId) ? queuedPlacementStrategies : (family === legendRecolorId || family === matchExampleId) ? legendRecolorStrategies
                          : family === visualPatternId ? visualPatternStrategies : (family === facetGrowthId || family === learnFacetGrowthId) ? facetGrowthStrategies
                            : (family === chartRouteId || family === learnChartRouteId) ? chartRouteStrategies : family === populationPlacementId ? populationPlacementStrategies
                              : (family === carryToFrameId || family === learnCarryToFrameId) ? carryToFrameStrategies : (family === portPairingId || family === learnPortPairingId) ? portPairingCardStrategies
                                : (family === contrastControlsId || family === contrastProbeId) ? contrastControlsStrategies : family === displayCouplingId ? displayCouplingStrategies : family === framedSearchId ? framedSearchStrategies
                                  : (family === glyphEditingId || family === verifySequenceEditsId) ? glyphEditingStrategies : (family === fieldIsolationId || family === learnFieldIsolationId) ? fieldIsolationStrategies
                                    : (family === directionalReceptionId || family === learnDirectionalReceptionId) ? directionalReceptionStrategies : (family === windowCoverageId || family === learnWindowCoverageId) ? windowCoverageStrategies
                                      : family === panelMatchingId ? panelMatchingStrategies : family === crossingRowsId ? crossingRowsStrategies
                                        : family === traceCoverageId ? traceCoverageStrategies : (family === radialConnectionId || family === learnRadialConnectionId) ? radialConnectionStrategies
                                          : family === invitedCaptureId ? invitedCaptureStrategies : family === branchAlignmentId ? branchAlignmentStrategies
                                            : family === feedbackTrialId ? feedbackTrialStrategies
                                            : family === catalogueComparisonId || family === revealedExampleId ? catalogueComparisonStrategies
                                              : family === receptionAccessId ? receptionAccessStrategies : family === markerCoverageId ? markerCoverageStrategies : (family === framedReceptionId || family === learnFramedReceptionId) ? framedReceptionStrategies : family === windowRelationId ? windowRelationStrategies : (family === animationContactId || family === learnAnimationContactId) ? animationContactStrategies : (family === reflectedPlacementId || family === coordinateObservedMotionId) ? reflectedPlacementStrategies : (family === materialAssemblyId || family === learnMaterialAssemblyId) ? materialAssemblyStrategies : family === coupledMotionId ? coupledMotionStrategies : (family === materialRouteId || family === verifyConnectedRouteId) ? materialRouteStrategies : family === inventoryAccessId || family === verifyInventoryTransferId || family === replayAccessId || family === verifyRemoteReplayId || family === orientedDeliveryId || family === indicatedJumpId || family === highlightedRouteId || family === pairedPassageId || family === learnPairedPassageId || family === seatedContactId || family === switchedSurfaceId || family === learnSwitchedSurfaceId || family === markedGaugeId || family === verifyGaugeEffectId || family === reactiveTargetId || family === verifyReactiveMotionId || family === pairedChannelsId || family === verifyChannelAccessId || family === compartmentGrowthId || family === pointReachId || family === linkedMidpointId || family === excavateDescentId || family === verifyRemovableSupportId || family === gatedCascadeId || family === learnCascadeId || family === layeredFitId || family === learnLayeredFitId || family === litRouteId || family === pivotCargoId || family === learnPivotCargoId || family === nestedPassageId || family === learnNestedPassageId || family === translateCoupledPiecesId || family === stagedMarksId || family === moveMaskedPiecesId || family === linkOpeningsId || family === learnLinkOpeningsId || family === reproduceCueId || family === learnAnimatedCueId || family === navigateRevealedGridId || family === arrangeTurnPostsId || family === learnTurnPostsId || family === learnSupportMovesId || family === learnObservedSupportsId || (family === learnScopeEffectsId || family === learnVisibleGroupEffectsId) ? inventoryAccessStrategies : (family === learnCorrespondenceId || family === learnRepeatedCellsId) ? learnCorrespondenceStrategies : null;
  const card = planReceipt?.authority === 'sicOnly' && labels ? record(proposal?.sicSituationCard) : null;
  const isSituationStrategy = (id: unknown): id is keyof typeof situationStrategies =>
    typeof id === 'string' && !!labels && Object.hasOwn(labels, id);
  const cardNeed = label(card?.need), cardMode = label(card?.mode), cardSituation = label(card?.situation);
  const cardStrategy = card?.strategy;
  const situationCard: NativeResolution['situationCard'] = isSituationStrategy(cardStrategy) && cardStrategy === planReceipt?.strategy && cardNeed && cardMode && cardSituation ? {
    strategy: cardStrategy, need: cardNeed, mode: cardMode, situation: cardSituation,
    ...(typeof card?.triggerCard === 'string' ? { triggerCard: card.triggerCard } : {}),
    agenda: readAgenda(card?.agenda, isSituationStrategy), distance: natural(card?.distance),
    ...(Array.isArray(card?.predictionSupport) && natural(card.compatibleRelations) !== null ? {
      predictionSupport: { actions: [...new Set(card.predictionSupport.flatMap(ref => priorAction(ref) ?? []))],
        compatibleRelations: natural(card.compatibleRelations)! },
    } : {}),
    evidenceActions: Array.isArray(card?.evidence) ? [...new Set(card.evidence.flatMap(ref => priorAction(ref) ?? []))] : [],
  } : undefined;
  if (situationCard && family === compareAvailableControlsId) {
    const subject = bounds(card?.subject);
    if (subject) subjects.push({ label: 'Piece moved by the previous control', box: subject });
  }
  if (situationCard && family === publicInputExplorationId) {
    const region = bounds(card?.addressedRegion);
    if (region) subjects.push({ label: 'Visible region tested by the click', box: region });
    const workspace = bounds(card?.workspace), example = bounds(card?.example);
    if (workspace) subjects.push({ label: 'Work area', box: workspace });
    if (example) subjects.push({ label: 'Example to preserve', box: example });
    const focus = bounds(card?.focus), moved = bounds(record(card?.lastControlledMotion)?.to);
    if (focus) subjects.push({ label: 'Piece whose control is being tested', box: focus });
    if (moved) subjects.push({ label: 'Piece moved by the tested direction', box: moved });
    const marker = bounds(card?.marker), control = bounds(card?.control);
    if (marker) subjects.push({ label: 'Marker reached to vary the test conditions', box: marker });
    if (control && !region) subjects.push({ label: 'Panel control previously observed to change the board', box: control });
    const peer = bounds(card?.projectedPeer);
    if (peer) subjects.push({ label: 'Candidate destination with the matching marker', box: peer });
    const contact = bounds(card?.contact);
    if (contact) subjects.push({ label: 'Contact at the edge of the known floor', box: contact });
    const animated = bounds(card?.animatedMechanism);
    if (animated) {
      const frames = Array.isArray(card?.animatedMechanismFrames) ? card.animatedMechanismFrames.filter(Number.isSafeInteger) : [];
      subjects.push({ label: frames.length ? `Piece that reacted in frames ${frames.join(', ')}` : 'Piece that reacted during the earlier test',
        box: animated });
    }
  }
  if (situationCard && (family === trialRepeatedLinearControlsId || family === recheckDirectionalControlsId)) {
    const target = bounds(card?.addressedRegion);
    if (target) subjects.push({ label: family === trialRepeatedLinearControlsId
      ? 'Repeated element tested by the click' : 'Visible shape tested by the click', box: target });
  }
  if (situationCard && (family === framedContactId || family === learnPatternAccessId)) {
    const region = bounds(card?.addressedRegion), actor = bounds(card?.controlledPiece);
    if (actor) subjects.push({ label: 'Controlled piece', box: actor });
    if (region) subjects.push({ label: card?.routeObligation === 'recharge' ? 'Candidate recharge'
      : card?.routeObligation === 'rotation' ? card.rotationConfirmed === false ? 'Candidate rotator' : 'Observed rotator'
        : card?.routeObligation === 'exit' ? 'Approach to the exit'
        : card?.routeObligation === 'shape' ? 'Shape station' : card?.routeObligation === 'color' ? 'Color station'
          : card?.routeObligation === 'transport' ? 'Projected landing' : 'Proposed contact surface', box: region });
    const transportEntry = bounds(card?.transportEntry);
    if (transportEntry) subjects.push({ label: 'Expected start of forced movement', box: transportEntry });
    const exit = bounds(card?.exit);
    if (exit) subjects.push({ label: 'Exit', box: exit });
    if (Array.isArray(card?.motifs)) for (const motif of card.motifs.slice(0, 2)) {
      const box = bounds(motif);
      if (box) subjects.push({ label: 'Motif compared by SIC', box });
    }
  }
  if (situationCard && (family === transportContactId || family === learnTransportAccessId) && Array.isArray(card?.subjects)) {
    for (const [i, subject] of card.subjects.entries()) {
      const box = bounds(subject);
      if (box) subjects.push({ label: i ? 'Body or target on the transport route' : 'Controlled piece', box });
    }
  }
  if (situationCard && (family === bandAlignmentId || family === verifyBandTransferId)) {
    const button = bounds(card?.addressedRegion);
    if (button) subjects.push({ label: card?.bandOperation === 'door' ? 'Passage tested' : 'Transfer control tested', box: button });
    const gate = bounds(card?.gate);
    if (gate) subjects.push({ label: 'Passage being prepared', box: gate });
    if (Array.isArray(card?.subjects)) for (const subject of card.subjects) {
      const marker = bounds(subject);
      if (marker) subjects.push({ label: 'Marker compared by SIC', box: marker });
    }
  }
  if (situationCard && (family === sharedArrivalId || family === verifySharedArrivalId) && Array.isArray(card?.subjects)) {
    for (const [index, element] of card.subjects.entries()) {
      const box = bounds(element);
      if (box) subjects.push({ label: ['First piece', 'Second piece', 'Common receiver', 'Cell to test'][index] ?? 'Observed region', box });
    }
  }
  if (situationCard && (family === outlineServiceId || family === learnOutlineServiceId)) {
    for (const [field, label] of [['controlledPiece', 'Controlled outline'], ['addressedRegion', 'Frame or matching outline'],
      ['markedBody', 'Nearby body'], ['marker', 'Direction marker']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && family === observedRouteInterventionId) {
    for (const [field, label] of [['controlledPiece', 'Controlled outline'], ['markedBody', 'Autonomous body'],
      ['marker', 'Announced movement'], ['rival', 'Interfering mobile'], ['addressedRegion', 'Intervention cell'],
      ['destination', 'Matching outline']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && family === columnAlignmentId) {
    const target = bounds(card?.target);
    if (target) subjects.push({ label: 'Next supported placement', box: target });
    if (Array.isArray(card?.line)) for (const cell of card.line) {
      const box = bounds(cell);
      if (box && !subjects.some(subject => subject.box.every((value, i) => value === box[i]))) {
        subjects.push({ label: card.defensive ? 'Opponent token in the threat' : 'Token in the winning line', box });
      }
    }
  }
  if (situationCard && family === observedRailTransfersId) {
    const train = bounds(card?.train), rail = bounds(card?.target);
    if (train) subjects.push({ label: 'Train selected for the transfer', box: train });
    if (rail) subjects.push({ label: 'Rail cell for the new position', box: rail });
    if (Array.isArray(card?.arms)) for (const item of card.arms.slice(0, 6)) {
      const box = bounds(item);
      if (box) subjects.push({ label: 'Arm in the predicted transfer sequence', box });
    }
  }
  if (situationCard && family === settleMatchingEdgesId) {
    const edge = bounds(card?.edge);
    if (edge) subjects.push({ label: 'Edge in the direction selected', box: edge });
    if (Array.isArray(card?.stationaryBlockers)) for (const item of card.stationaryBlockers) {
      const box = bounds(item);
      if (box) subjects.push({ label: 'Stationary obstruction', box });
    }
    if (Array.isArray(card?.slides)) for (const slide of card.slides) {
      const part = slide as { from?: unknown; to?: unknown; attaches?: boolean } | null;
      const from = bounds(part?.from), to = bounds(part?.to);
      if (from) subjects.push({ label: 'Piece before the slide', box: from });
      if (to) subjects.push({ label: part?.attaches === true ? 'Predicted matching contact' : 'Predicted piece position', box: to });
    }
  }
  if (situationCard && family === observedSurvivalId) {
    for (const [field, label] of [['controlledPiece', 'Controlled piece'], ['addressedRegion', 'Chosen open cell'],
      ['nearestRival', 'Nearest moving piece']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && (family === labeledSequenceId || family === learnLabeledSequenceId)) {
    const panels = Array.isArray(card?.examples) ? card.examples : [];
    for (const panel of panels) {
      const box = bounds(panel);
      if (box) subjects.push({ label: 'Labeled examples', box });
    }
    const query = bounds(card?.query), control = bounds(card?.addressedRegion);
    if (query) subjects.push({ label: 'Current sequence', box: query });
    if (control) subjects.push({ label: 'Selected label control', box: control });
  }
  if (situationCard && family === markedCollectionId) {
    const edited = bounds(card?.addressedRegion);
    if (edited) subjects.push({ label: 'Marked card or control tested', box: edited });
    const actor = bounds(card?.actor);
    if (actor) subjects.push({ label: 'Piece carrying the current program', box: actor });
    const destination = bounds(card?.contactDestination);
    if (destination) subjects.push({ label: 'Unfamiliar tile in the proposed trial', box: destination });
    if (Array.isArray(card?.markedTerrain)) for (const tile of card.markedTerrain) {
      const box = bounds(tile);
      if (box) subjects.push({ label: 'Interior tile with an unverified effect', box });
    }
    if (Array.isArray(card?.affected)) for (const target of card.affected) {
      const box = bounds(target);
      if (box) subjects.push({ label: 'Piece in the projected interaction', box });
    }
    if (Array.isArray(card?.members)) for (const member of card.members) {
      const box = bounds(member);
      if (box) subjects.push({ label: 'Member in the visible collection', box });
    }
  }
  if (situationCard && family === visibleConfigurationCoverageId) {
    const factor = bounds(card?.factor), target = bounds(card?.target);
    if (factor) subjects.push({ label: 'Factor being changed', box: factor });
    if (target) subjects.push({ label: 'Unvisited configuration', box: target });
  }
  if (situationCard && family === markedCompartmentFlowId) {
    const chamber = bounds(card?.chamber), outlet = bounds(card?.outlet);
    const concurrent = bounds(card?.concurrent);
    if (chamber) subjects.push({ label: 'Current marked compartment', box: chamber });
    if (outlet) subjects.push({ label: 'Previously confirmed outlet', box: outlet });
    if (concurrent) subjects.push({ label: 'Downstream compartment checked in the same turn', box: concurrent });
  }
  if (situationCard && family === observedRelayRouteId) {
    const source = bounds(card?.source), control = bounds(card?.control);
    if (source) subjects.push({ label: 'Measured emitter', box: source });
    if (control) subjects.push({ label: 'Relay controller under test', box: control });
    if (Array.isArray(card?.receivers)) for (const receiver of card.receivers) {
      const box = bounds(receiver);
      if (box) subjects.push({ label: 'Receiver in the projected route', box });
    }
  }
  if (situationCard && family === observedPrefixQuotasId) {
    const target = bounds(card?.target);
    if (target) subjects.push({ label: 'Cell selected to satisfy the visible quota', box: target });
  }
  if (situationCard && family === observedCarrierReductionId) {
    const cargo = Array.isArray(card?.carriedIntermediates) ? card.carriedIntermediates.flatMap(item => {
      const box = bounds(item);
      return box ? [box] : [];
    }) : [];
    const intermediate = bounds(card?.intermediate);
    const carried = (box: NativeBox) => cargo.some(other => other.every((value, i) => value === box[i]));
    for (const [field, label] of [['carrier', 'Measured carrier'], ['source', 'Piece chosen for the jump'],
      ['intermediate', intermediate && carried(intermediate) ? 'Carried intermediate in this jump' : 'Fixed intermediate'],
      ['landing', 'Projected landing']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
    for (const box of cargo) if (!intermediate?.every((value, i) => value === box[i])) subjects.push({ label: 'Intermediate on a carrier', box });
  }
  if (situationCard && family === observedLinePlacementId) {
    const target = bounds(card?.target);
    if (target) subjects.push({ label: 'Cell selected for the next mark', box: target });
    const own = bounds(card?.ownMark), other = bounds(card?.otherMark), pending = card?.markRolesPending === true;
    if (own) subjects.push({ label: pending ? 'Candidate mark under control' : 'Mark under control', box: own });
    if (other) subjects.push({ label: pending ? 'Candidate opposing mark' : 'Opposing mark', box: other });
  }
  if (situationCard && family === observedPolePairId) {
    for (const [field, label] of [['selected', 'Piece under control'], ['partner', 'Coupled piece'], ['destination', 'Marked destination']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
    for (const [field, label] of [['partners', 'Other visible piece'], ['projected', 'Predicted landing']] as const) {
      if (!Array.isArray(card?.[field])) continue;
      for (const item of card[field]) {
        const box = bounds(item);
        if (box) subjects.push({ label, box });
      }
    }
  }
  if (situationCard && family === observedSharedRelationsId) {
    const control = bounds(card?.control);
    if (control) subjects.push({ label: 'Shared relation control', box: control });
    for (const [field, label] of [['actors', 'Piece expected to move'], ['destinations', 'Marked destination']] as const) {
      const values = card?.[field];
      if (!Array.isArray(values)) continue;
      for (const value of values) {
        const box = bounds(value);
        if (box) subjects.push({ label, box });
      }
    }
  }
  if (situationCard && family === observedPatternLayoutId) {
    for (const [field, label] of [['focus', 'Piece to place'], ['destination', 'Position shown by the preview'],
      ['example', 'Corresponding preview piece'], ['covered', 'Piece expected to be covered']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && family === observedActuatorArrangementId) {
    for (const [field, label] of [['focus', 'Selected piece'], ['control', 'Control point'],
      ['destination', 'Position in the relative arrangement'], ['reference', 'Visible reference']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && family === slotTransferId) {
    const source = bounds(card?.source), destination = bounds(card?.destination);
    if (source) subjects.push({ label: 'Matching token', box: source });
    if (destination) subjects.push({ label: 'Slot to fill', box: destination });
  }
  if (situationCard && (family === remoteSupportRouteId || family === learnRemoteAccessId)) {
    for (const [field, label] of [['actor', 'Moving piece'], ['target', 'Target piece'], ['control', 'Remote control'],
      ['landing', 'Proposed next cell'], ['affectedSupport', 'Support that may change'], ['acquisition', 'Marker to test for the missing control']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && (family === occurrenceRecallId || family === verifyOccurrenceChoiceId)) {
    const chosen = bounds(card?.chosen);
    if (chosen) subjects.push({ label: 'Selected occurrence', box: chosen });
    if (Array.isArray(card?.candidates)) for (const candidate of card.candidates) {
      const box = bounds(candidate);
      if (box) subjects.push({ label: 'Other visible occurrence', box });
    }
  }
  if (situationCard && (family === slotPermutationId || family === verifySlotPermutationId)) {
    const control = bounds(card?.control);
    if (control) subjects.push({ label: 'Rearrangement control', box: control });
    if (Array.isArray(card?.targets)) for (const target of card.targets) {
      const box = bounds(target);
      if (box) subjects.push({ label: 'Marked target slot', box });
    }
    if (Array.isArray(card?.motion)) for (const movement of card.motion) {
      const move = record(movement);
      const source = bounds(move?.source), destination = bounds(move?.destination);
      if (source) subjects.push({ label: 'Piece on the measured cycle', box: source });
      if (destination) subjects.push({ label: 'Expected next slot', box: destination });
    }
  }
  if (situationCard && (family === surfaceCopyId || family === learnSurfaceCopyId)) {
    for (const [field, label] of [['reference', 'Reference pattern'], ['surface', 'Working surface'],
      ['swatch', 'Color selector'], ['attachment', 'Smaller part of the tool']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && (family === codeRouteId || family === verifyProgramConfigurationId)) {
    for (const [field, label] of [['actor', 'Programmed piece'], ['target', 'Target cell'], ['addressed', 'Edited instruction or run control'],
      ['demonstration', 'Separate demonstration area']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && (family === profileTransferId || family === verifyProfileTransferId)) {
    for (const [field, label] of [['marker', 'Current focus marker'], ['profile', 'Current profile'],
      ['receiver', 'Receiver to fill'], ['tool', 'Profile transformation control']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && (family === orderedReplenishmentId || family === learnOrderedReplenishmentId)) {
    for (const [field, name] of [['encounter', 'Current encounter'], ['nextEncounter', 'Next encounter'], ['control', 'Reinforcement control']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label: name, box });
    }
  }
  if (situationCard && (family === programOriginId || family === learnProgramOriginId)) {
    const origin = bounds(card?.origin), target = bounds(card?.target), instruction = bounds(card?.instruction);
    if (origin) subjects.push({ label: 'Program starting node', box: origin });
    if (target) subjects.push({ label: 'Marked destination', box: target });
    if (instruction) subjects.push({ label: 'Instruction under test', box: instruction });
    for (const [field, label] of [['repeat', 'Possible repeat-move node'], ['blocked', 'Same marking as interrupted route'],
      ['repellers', 'Possible source of redirection'], ['arrivals', 'Predicted intermediate arrival']] as const) {
      const regions = card?.[field];
      if (!Array.isArray(regions)) continue;
      for (const region of regions) {
        const box = bounds(region);
        if (box) subjects.push({ label, box });
      }
    }
  }
  if (situationCard && (family === previewPlacementId || family === verifyPreviewPlacementId)) {
    const piece = bounds(card?.currentPiece), target = bounds(card?.target);
    if (piece) subjects.push({ label: 'Movable piece', box: piece });
    if (target) subjects.push({ label: 'Place in the partition', box: target });
    if (Array.isArray(card?.remaining)) for (const entry of card.remaining) {
      const contribution = record(entry);
      const other = bounds(contribution?.piece), destination = bounds(contribution?.destination);
      if (other) subjects.push({ label: 'Complementary piece', box: other });
      if (destination) subjects.push({ label: 'Place reserved for it', box: destination });
    }
  }
  if (situationCard && family === symbolContributionId) {
    const guide = bounds(card?.guide);
    const target = bounds(card?.contributionTarget);
    if (guide) subjects.push({ label: target ? 'Current symbol or control' : 'Indicated symbol or operand', box: guide });
    if (target) subjects.push({ label: 'Request served by the action', box: target });
  }
  if (situationCard && (family === markedLatticeId || family === verifyMarkedLatticeId)) {
    const cursor = bounds(card?.cursor), target = bounds(card?.target);
    if (cursor) subjects.push({ label: 'Current cursor', box: cursor });
    if (target) subjects.push({ label: Array.isArray(card?.counter) ? 'Current marker or control' : 'Unvisited marker', box: target });
    if (Array.isArray(card?.preparation)) for (const slot of card.preparation) {
      const box = bounds(slot);
      if (box) subjects.push({ label: 'Preparation indicator', box });
    }
    if (Array.isArray(card?.counter)) for (const slot of card.counter) {
      const box = bounds(slot);
      if (box) subjects.push({ label: 'Acquisition slot', box });
    }
  }
  if (situationCard && (family === queuedPlacementId || family === learnQueuedPlacementId)) {
    const group = bounds(card?.activeGroup), field = bounds(card?.field);
    if (group) subjects.push({ label: 'Active group', box: group });
    if (field) subjects.push({ label: 'Receiving field', box: field });
  }
  if (situationCard && (family === markerCoverageId || family === verifyMarkerPlacementId)) {
    const actor = bounds(card?.actor);
    if (actor) subjects.push({ label: 'Selected piece or focus marker', box: actor });
    for (const [field, label] of [['otherSupports', 'Other measured piece'], ['targets', 'Candidate placement']] as const) {
      if (Array.isArray(card?.[field])) for (const candidate of card[field]) {
        const box = bounds(candidate);
        if (box) subjects.push({ label, box });
      }
    }
  }
  if (situationCard && (family === receptionAccessId || family === learnReceptionAccessId)) {
    for (const [field, label] of [['actor', 'Current carrier'], ['target', 'Candidate support'], ['request', 'Visible request'],
      ['device', 'Device under contact test'], ['next', 'Expected carrier position']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && (family === catalogueComparisonId || family === revealedExampleId)) {
    for (const [field, label] of [['field', 'Partial view'], ['choice', 'Current choice']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
    if (Array.isArray(card?.cards)) for (const candidate of card.cards) {
      const box = bounds(candidate);
      if (box) subjects.push({ label: 'Compatible shape', box });
    }
  }
  if (situationCard && (family === feedbackTrialId || family === verifyOrderedFeedbackId)) {
    const palette = bounds(card?.palette);
    if (palette) subjects.push({ label: 'Available tile colors', box: palette });
    if (Array.isArray(card?.slots)) for (const row of card.slots) {
      const box = bounds(row);
      if (box) subjects.push({ label: 'Ordered slots', box });
    }
  }
  if (situationCard && (family === branchAlignmentId || family === verifyBranchAlignmentId)) {
    const contributor = bounds(card?.contributor);
    if (contributor) subjects.push({ label: 'Selected contributor', box: contributor });
    const turn = bounds(card?.turningContributor);
    if (turn && !contributor?.every((value, i) => value === turn[i])) subjects.push({ label: 'Corner that turns the flow', box: turn });
    if (Array.isArray(card?.goals)) for (const goal of card.goals) {
      const box = bounds(goal);
      if (box) subjects.push({ label: 'Receiving opening', box });
    }
  }
  if (situationCard && (family === invitedCaptureId || family === verifyCaptureRouteId)) {
    for (const [field, label] of [['focus', 'Selected piece'], ['terrain', 'Terrain used to change color'], ['swatch', 'Color requested'],
      ['target', card?.portalExit ? 'Entry to click' : 'Next cell'], ['portalExit', 'Paired exit'], ['victim', 'Piece to capture']] as const) {
      const box = bounds(card?.[field]);
      if (box && !subjects.some(subject => subject.box.every((value, i) => value === box[i]))) subjects.push({ label, box });
    }
    if (Array.isArray(card?.rayPieces)) for (const item of card.rayPieces) {
      const box = bounds(item);
      if (box && !subjects.some(subject => subject.box.every((value, i) => value === box[i]))) {
        subjects.push({ label: 'Distinct rank used in the route', box });
      }
    }
  }
  if (situationCard && (family === radialConnectionId || family === learnRadialConnectionId)) {
    const tile = bounds(card?.tile);
    if (tile) subjects.push({ label: 'Tile to rotate', box: tile });
    if (Array.isArray(card?.neighbors)) for (const neighbor of card.neighbors) {
      const box = bounds(neighbor);
      if (box) subjects.push({ label: 'Tile in the arrangement', box });
    }
  }
  if (situationCard && (family === traceCoverageId || family === verifyTraceCoverageId)) {
    for (const [field, label] of [['head', 'Current trace end'], ['next', 'Next adjacent cell'], ['endpoint', 'Candidate finish']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && (family === crossingRowsId || family === verifyCrossingRowsId)) {
    for (const [field, label] of [['controller', 'Row or column selector'], ['target', 'Cell to compare'], ['reference', 'Visible reference']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && (family === panelMatchingId || family === verifyPanelConfigurationId) && Array.isArray(card?.panels)) {
    if (Array.isArray(card.destinations)) for (const destination of card.destinations) {
      const target = record(destination);
      const choice = bounds(target?.choice), receiver = bounds(target?.receiver);
      if (choice) subjects.push({ label: 'Room selector', box: choice });
      if (receiver) subjects.push({ label: 'Matching receiver', box: receiver });
    }
    for (const panel of card.panels) {
      const box = bounds(panel);
      if (box) subjects.push({ label: 'Activity and material', box });
    }
  }
  if (situationCard && (family === windowCoverageId || family === learnWindowCoverageId)) {
    const sequence = bounds(card?.sequence);
    if (sequence) subjects.push({ label: 'Visible sequence', box: sequence });
    if (Array.isArray(card?.receivers)) for (const receiver of card.receivers) {
      const box = bounds(receiver);
      if (box) subjects.push({ label: 'Configurable receiver', box });
    }
    if (Array.isArray(card?.signalLinks)) for (const link of card.signalLinks) {
      const box = bounds(link);
      if (box) subjects.push({ label: 'Signal between receivers', box });
    }
  }
  if (situationCard && (family === directionalReceptionId || family === learnDirectionalReceptionId)) {
    for (const [field, label] of [['actor', 'Controlled body'], ['dial', 'Orientation control'], ['landing', 'Expected piece position']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
    for (const [field, label] of [['pieces', 'Piece'], ['receivers', 'Receiver']] as const) {
      const items = card?.[field];
      if (Array.isArray(items)) for (const item of items) {
        const box = bounds(item);
        if (box) subjects.push({ label, box });
      }
    }
  }
  if (situationCard && (family === fieldIsolationId || family === learnFieldIsolationId)) {
    const control = bounds(card?.control);
    if (control) subjects.push({ label: 'Control tested', box: control });
    const relay = bounds(card?.relay), reserve = bounds(card?.reserve);
    if (relay) subjects.push({ label: card?.buffered === true ? 'Storage chamber' : 'Relay basin', box: relay });
    if (reserve) subjects.push({ label: 'Visible supply', box: reserve });
    if (Array.isArray(card?.stores)) for (const store of card.stores) {
      const box = bounds(store);
      if (box) subjects.push({ label: 'Stored supply', box });
    }
    if (Array.isArray(card?.lossOutlets)) for (const outlet of card.lossOutlets) {
      const box = bounds(outlet);
      if (box) subjects.push({ label: 'Grated outlet', box });
    }
    if (Array.isArray(card?.fields)) for (const field of card.fields) {
      const box = bounds(field);
      if (box) subjects.push({ label: 'Compared field', box });
    }
  }
  if (situationCard && (family === glyphEditingId || family === verifySequenceEditsId)) {
    const fixed = bounds(card?.fixedExample);
    for (const [field, label] of [['source', fixed ? 'Fixed input word' : 'Source symbols'], ['editable', 'Editable symbols'],
      ['active', fixed ? 'Focused rule side' : 'Focused symbol']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
    if (fixed) subjects.push({ label: 'Fixed output word', box: fixed });
  }
  if (situationCard && family === parallelSymbolPrefixesId) {
    for (const [field, label] of [['targets', 'Symbol advanced by this command'], ['panels', 'Symbol group']] as const) {
      const items = card?.[field];
      if (Array.isArray(items)) for (const item of items) {
        const box = bounds(item);
        if (box) subjects.push({ label, box });
      }
    }
  }
  if (situationCard && (family === learnScopeEffectsId || family === learnVisibleGroupEffectsId)) {
    const control = bounds(card?.target);
    if (control) subjects.push({ label: 'Tested control or candidate', box: control });
    if (Array.isArray(card?.members)) for (const member of card.members.slice(0, 6)) {
      const box = bounds(member);
      if (box) subjects.push({ label: 'Member in the tested group', box });
    }
  }
  if (situationCard && (family === learnSupportMovesId || family === learnObservedSupportsId || family === learnObservedSupportsId)) {
    for (const [field, description] of [['focus', 'Exposed piece'], ['target', 'Receiving support'], ['goal', 'Final support']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label: description, box });
    }
  }
  if (situationCard && (family === learnCorrespondenceId || family === learnRepeatedCellsId)) {
    for (const [field, label] of [['target', 'Cell under test'], ['source', 'Cell supporting the prediction']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && (family === arrangeTurnPostsId || family === learnTurnPostsId)) {
    for (const [field, label] of [['actor', 'Moving sprite'], ['target', 'Post position'], ['exit', 'Exit']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
    if (Array.isArray(card?.posts)) for (const post of card.posts) {
      const box = bounds(post);
      if (box) subjects.push({ label: 'Turning post', box });
    }
  }
  if (situationCard && (family === navigateRevealedGridId || family === learnGridAccessId)) {
    for (const [field, label] of [['actor', 'Moving sprite'], ['target', 'Next cell'], ['obstacle', 'Moving obstacle'], ['exit', 'Exit']] as const) {
      if (field === 'obstacle' && Array.isArray(card?.obstacles)) continue;
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
    if (Array.isArray(card?.obstacles)) for (const obstacle of card.obstacles) {
      const box = bounds(obstacle);
      if (box) subjects.push({ label: 'Moving obstacle', box });
    }
    if (Array.isArray(card?.sentries)) for (const sentry of card.sentries) {
      const box = bounds(sentry);
      if (box) subjects.push({ label: 'Moving hazard', box });
    }
  }
  if (situationCard && (family === reproduceCueId || family === learnAnimatedCueId)) {
    for (const [field, label] of [['actor', 'Moving sprite'], ['panel', 'Input grid'], ['target', 'Current target'], ['exit', 'Matching region']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
    if (Array.isArray(card?.sampleCells)) for (const cue of card.sampleCells) {
      const box = bounds(cue);
      if (box) subjects.push({ label: 'Marked cell of the visible sample', box });
    }
    if (Array.isArray(card?.observedCues)) for (const cue of card.observedCues) {
      const box = bounds(cue);
      if (box) subjects.push({ label: 'Cell shown in the animation', box });
    }
  }
  if (situationCard && (family === linkOpeningsId || family === learnLinkOpeningsId)) {
    for (const [field, label] of [['actor', 'Moving sprite'], ['target', 'Current target'], ['exit', 'Exit']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
    for (const [field, label] of [['load', 'Transferred load'], ['loadControl', 'Load interaction control'],
      ['support', 'Support to keep occupied'], ['passage', 'Passage kept open']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
    if (Array.isArray(card?.openings)) for (const opening of card.openings) {
      const box = bounds(opening);
      if (box) subjects.push({ label: 'Linked opening', box });
    }
  }
  if (situationCard && (family === moveMaskedPiecesId || family === learnSelectedAccessId)) {
    for (const [field, label] of [['focus', 'Selected piece'], ['destination', 'Next position'], ['target', 'Matching opening']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && (family === stagedMarksId || family === verifyCombinedMarksId)) {
    const preview = bounds(card?.focus), target = bounds(card?.target);
    const fixture = bounds(card?.fixture), reference = bounds(card?.reference);
    if (preview) subjects.push({ label: 'Placement preview', box: preview });
    if (target) subjects.push({ label: fixture ? 'Proposed placement' : 'Visible mark source or reference', box: target });
    if (fixture) subjects.push({ label: 'Fixed support', box: fixture });
    if (reference) subjects.push({ label: 'Target to reach', box: reference });
    if (Array.isArray(card?.carriers)) for (const carrier of card.carriers) {
      const box = bounds(carrier);
      if (box) subjects.push({ label: fixture ? 'Required foundation' : 'Deposited marked piece', box });
    }
  }
  if (situationCard && (family === translateCoupledPiecesId || family === learnContactAccessId)) {
    for (const [field, label] of [['focus', 'Controlled piece'], ['related', 'Other piece'], ['target', 'Matching opening'],
      ['projected', 'Predicted landing after contact']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
    const contacts = card?.observedContact;
    if (Array.isArray(contacts)) for (const contact of contacts.slice(-1)) {
      const landing = bounds(record(contact)?.to);
      if (landing) subjects.push({ label: 'Previously observed contact landing', box: landing });
    }
    if (Array.isArray(card?.timedSources)) for (const source of card.timedSources) {
      const actuator = record(source);
      const box = bounds(actuator?.box);
      if (box) subjects.push({ label: actuator?.active ? 'Pusher involved in this step' : 'Pusher with its own cycle', box });
    }
  }
  if (situationCard && (family === nestedPassageId || family === learnNestedPassageId)) {
    for (const [field, label] of [['room', 'Selected room'], ['source', 'Source'], ['exit', 'Exit opening']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && (family === pivotCargoId || family === learnPivotCargoId)) {
    const actor = bounds(card?.actor);
    if (actor) subjects.push({ label: 'Carrier', box: actor });
    for (const [field, label] of [['cargo', 'Cargo cell'], ['receivers', 'Receiving cell'], ['pivot', 'Pivot pad']] as const) {
      const values = card?.[field];
      if (!Array.isArray(values)) continue;
      for (const value of values) {
        const box = bounds(value);
        if (box) subjects.push({ label, box });
      }
    }
  }
  if (situationCard && (family === litRouteId || family === learnLitRouteId)) {
    for (const [field, label] of [['actor', 'Travelling sprite'], ['focus', 'Chosen stopping point'], ['goal', 'Exit'], ['light', 'Observed beam']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
    if (Array.isArray(card?.patrols)) for (const patrol of card.patrols) {
      const box = bounds(patrol);
      if (box) subjects.push({ label: 'Patrol', box });
    }
  }
  if (situationCard && (family === layeredFitId || family === learnLayeredFitId)) {
    for (const [field, label] of [['pane', 'Pane under control'], ['marker', 'Selection marker'], ['canvas', 'Current composite'], ['reference', 'Reference pattern']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && (family === gatedCascadeId || family === learnCascadeId)) {
    const gate = card?.channel === true ? ['coveredLink', 'Covered link'] as const : ['gate', 'Branch to block'] as const;
    const junction = card?.channel === true ? 'Link to target' : 'Shared junction';
    for (const [field, label] of [['actor', 'Controlled cursor'], gate, ['junction', junction], ['target', 'Target piece'],
      ['gap', 'Gap to relay'], ['reveal', 'Link to uncover']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
    if (Array.isArray(card?.guards)) for (const guard of card.guards) {
      const box = bounds(guard);
      if (box) subjects.push({ label: 'Intercept competing arrival', box });
    }
  }
  if (situationCard && (family === excavateDescentId || family === verifyRemovableSupportId)) {
    for (const [field, label] of [['actor', 'Controlled sprite'], ['focus', 'Chosen passage'], ['goal', 'Visible destination']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && family === protectGravityRouteId) {
    for (const [field, label] of [['actor', 'Controlled sprite'], ['focus', 'Cell to cross or change'],
      ['ceiling', 'Protective ceiling'], ['danger', 'Visible hazard'], ['landing', 'Expected stopping point'], ['exit', 'Exit']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && (family === linkedMidpointId || family === verifyLinkedMotionId)) {
    for (const [field, label] of [['actor', 'Linked piece'], ['active', 'Active marker'], ['passive', 'Other marker'], ['focus', 'Click target'], ['goal', 'Destination']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && family === linkedGroupRouteId) {
    for (const [field, label] of [['actor', 'Derived body'], ['active', 'Selected anchor'], ['focus', 'Click target'],
      ['goal', 'Destination'], ['landing', 'Predicted body position'], ['pickup', 'Piece supplying missing colors']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
    for (const [field, label] of [['related', 'Linked anchor'], ['preserved', 'Contact to preserve']] as const) {
      if (Array.isArray(card?.[field])) for (const item of card[field]) {
        const box = bounds(item);
        if (box) subjects.push({ label, box });
      }
    }
  }
  if (situationCard && (family === pointReachId || family === verifyPointAccessId)) {
    for (const [field, label] of [['actor', 'Controlled sprite'], ['focus', 'Predicted landing'], ['goal', 'Framed receptor'], ['reserve', 'Visible reserve']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && family === mergeForDemandId) {
    const mobile = bounds(card?.autonomous);
    if (mobile) subjects.push({ label: 'Mobile approaching the material', box: mobile });
    if (Array.isArray(card?.autonomousMobiles)) for (const item of card.autonomousMobiles) {
      const box = bounds(item);
      if (box) subjects.push({ label: 'Mobile near the work area', box });
    }
    for (const [field, label] of [['actor', card?.protectiveClick ? 'Material to protect' : 'Material moved'], ['partner', 'Other merge input'], ['focus', 'Click target'],
      ['demand', 'Product requested'], ['receptor', 'Delivery receiver']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
    if (Array.isArray(card?.reserved)) for (const item of card.reserved) {
      const box = bounds(item);
      if (box) subjects.push({ label: card.protectiveClick ? 'Material reserved for the requested product' : 'Reserved for another delivery', box });
    }
  }
  if (situationCard && family === compartmentGrowthId) {
    const gate = bounds(card?.target), threshold = bounds(card?.threshold);
    if (gate) subjects.push({ label: card?.gateOpens === false ? 'Gate to close' : 'Gate to open', box: gate });
    if (threshold) subjects.push({ label: card?.turnsLeft === undefined ? 'Isolated sprite used for the size comparison' : 'Sprite used for the size comparison', box: threshold });
    if (Array.isArray(card?.focus)) for (const item of card.focus) {
      const box = bounds(item);
      if (box) subjects.push({ label: 'Sprite involved in the expected interaction', box });
    }
    if (Array.isArray(card?.plannedGates)) for (const item of card.plannedGates.slice(0, 8)) {
      const box = bounds(item);
      if (box && (!gate || box[0] !== gate[0] || box[1] !== gate[1])) subjects.push({ label: 'Gate on the planned route', box });
    }
  }
  if (situationCard && (family === pairedChannelsId || family === verifyChannelAccessId)) {
    for (const [field, label] of [['target', 'Tile to open'], ['source', 'Source marker'],
      ['otherSource', 'Second source of the mixture'], ['sink', 'Receiving marker']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
    if (Array.isArray(card?.branches)) for (const branch of card.branches) {
      const box = bounds(branch);
      if (box) subjects.push({ label: 'Another outlet of the same channel', box });
    }
  }
  if (situationCard && (family === reactiveTargetId || family === verifyReactiveMotionId)) {
    for (const [field, label] of [['actor', 'Controlled sprite'], ['focus', 'Reactive sprite'], ['landing', 'Predicted position of the reactive sprite'],
      ['step', 'Next position of the controlled sprite'], ['movedObstacle', 'Obstacle expected to move']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
    if (Array.isArray(card?.movingTargets)) for (const target of card.movingTargets) {
      const box = bounds(target);
      if (box) subjects.push({ label: 'Remaining moving target', box });
    }
  }
  if (situationCard && (family === markedGaugeId || family === verifyGaugeEffectId)) {
    for (const [field, label] of [['focus', 'Selected button'], ['gauge', 'Current gauge'], ['target', 'Target tick']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && family === coupledGaugeRouteId) {
    for (const [field, label] of [['focus', 'Selected button'], ['gauge', 'Extending piece'], ['actor', 'Transported marker'],
      ['target', 'Destination marks'], ['obstacle', 'Obstacle'], ['landing', 'Predicted marker position']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
    if (Array.isArray(card?.carried)) for (const item of card.carried) {
      const box = bounds(item);
      if (box) subjects.push({ label: 'Transported piece', box });
    }
  }
  if (situationCard && (family === seatedContactId || family === verifyFrameContactId || family === switchedSurfaceId || family === learnSwitchedSurfaceId)) {
    for (const [field, label] of [['actor', 'Current piece'], ['focus', family === seatedContactId ? 'Receiving frame' : 'Target sprite'],
      ['landing', 'Predicted landing'], ['capacity', 'Capacity indicator'], ['passage', 'Passage between observed rooms'],
      ['reserve', 'Action reserve'], ['exit', 'Receiving frame']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && (family === pairedPassageId || family === learnPairedPassageId)) {
    for (const [field, label] of [['actor', 'Current piece'], ['focus', 'Passage or exit'], ['exit', 'Paired opening'], ['landing', 'Predicted landing'],
      ['routingState', 'Passage configuration indicator']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
    if (Array.isArray(card?.flags)) for (const flag of card.flags) {
      const box = bounds(flag);
      if (box) subjects.push({ label: 'Remote indicator', box });
    }
    if (Array.isArray(card?.switchSites)) for (const site of card.switchSites) {
      const box = bounds(site);
      if (box) subjects.push({ label: 'Configuration switch', box });
    }
  }
  if (situationCard && (family === highlightedRouteId || family === learnHighlightedRouteId)) {
    for (const [field, label] of [['actor', 'Current piece'], ['focus', card?.projectedLanding ? 'Highlighted entrance' : 'Highlighted landing'],
      ['projectedLanding', 'Projected arrival after the transfer'], ['destination', 'Framed marker']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
    if (Array.isArray(card?.seals)) for (const seal of card.seals) {
      const box = bounds(seal);
      if (box) subjects.push({ label: 'Seal still visible', box });
    }
  }
  if (situationCard && (family === indicatedJumpId || family === learnIndicatedJumpId)) {
    for (const [field, label] of [['actor', 'Current direction indicator'], ['focus', 'Selected jump destination'],
      ['destination', 'Candidate goal marker']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && (family === orientedDeliveryId || family === verifyOrientedDeliveryId)) {
    for (const [field, label] of [['actor', 'Oriented carrier'], ['cargo', 'Part at current contact'], ['target', 'Part or candidate receiving cell']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
    for (const [field, label] of [['externalCarriers', 'Other observed carrier'], ['reservedParts', 'Part carried by the other carrier']] as const) {
      if (Array.isArray(card?.[field])) for (const candidate of card[field]) {
        const box = bounds(candidate);
        if (box) subjects.push({ label, box });
      }
    }
  }
  if (situationCard && (family === replayAccessId || family === verifyRemoteReplayId)) {
    for (const [field, label] of [['actor', 'Current carrier'], ['target', 'Current destination'],
      ['remote', 'Distant linked region']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
    for (const [field, label] of [['slots', 'Replay slot'], ['replayActors', 'Piece replaying a recorded route'],
      ['replaySupports', 'Region linked to a recorded contact']] as const) {
      if (Array.isArray(card?.[field])) for (const candidate of card[field]) {
        const box = bounds(candidate);
        if (box) subjects.push({ label, box });
      }
    }
  }
  if (situationCard && (family === inventoryAccessId || family === verifyInventoryTransferId)) {
    for (const [field, label] of [['actor', 'Carrier'], ['target', 'Current destination'], ['display', 'Object display'], ['reserve', 'Measured reserve']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && (family === materialRouteId || family === verifyConnectedRouteId)) {
    for (const [field, label] of [['actor', 'Controlled piece'], ['target', 'Next tile'], ['guard', 'Guard being approached'],
      ['front', 'Tile in the guard’s facing direction'], ['patrol', 'Patrol before the move'],
      ['patrolNext', 'Predicted patrol position after the move']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
    for (const [field, label] of [['patrols', 'Visible patrol position'], ['patrolForecast', 'Possible patrol position on the next move']] as const) {
      if (Array.isArray(card?.[field])) for (const item of card[field]) {
        const box = bounds(item);
        if (box) subjects.push({ label, box });
      }
    }
  }
  if (situationCard && (family === coupledMotionId || family === verifyCoupledRouteId)) {
    for (const [field, label] of [['members', 'Controlled piece'], ['nextMembers', 'Projected position']] as const) {
      if (Array.isArray(card?.[field])) for (const [index, current] of card[field].entries()) {
        const box = bounds(current);
        if (box) subjects.push({ label: label + ' ' + (index + 1), box });
      }
    }
    for (const [field, label] of [['auxiliary', 'Auxiliary in focus'], ['nextAuxiliary', 'Projected auxiliary position'],
      ['parking', 'Side pocket'], ['pressureHolder', 'Piece holding the plate']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
    for (const [field, label] of [['pressurePlates', 'Pressure plate'], ['pressureGates', 'Passage linked to the plate']] as const) {
      if (Array.isArray(card?.[field])) for (const item of card[field]) {
        const box = bounds(item);
        if (box) subjects.push({ label, box });
      }
    }
  }
  if (situationCard && (family === materialAssemblyId || family === learnMaterialAssemblyId)) {
    for (const [field, label] of [['focus', 'Current marked or produced piece'], ['partner', 'Previously marked piece'],
      ['destination', 'Matching frame'], ['control', 'Core orientation control']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && (family === reflectedPlacementId || family === coordinateObservedMotionId)) {
    const axis = bounds(card?.axis);
    if (axis) subjects.push({ label: 'Controlled axis', box: axis });
    for (const [field, label] of [['body', axis ? 'Piece that stays in place' : 'Controlled piece'],
      ['reflection', 'Reflected piece'], ['target', 'Marked cells']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
    if (Array.isArray(card?.reflections)) {
      for (const reflection of card.reflections) {
        const box = bounds(reflection);
        if (box) subjects.push({ label: 'Reflected piece', box });
      }
    }
  }
  if (situationCard && (family === animationContactId || family === learnAnimationContactId)) {
    for (const [field, label] of [['point', 'Aim point'], ['source', card?.sourceCandidate ? 'Candidate source' : 'Observed source'],
      ['peer', 'Candidate contact'], ['obstacle', 'Obstacle touched in the animation'], ['meter', 'Magnitude display']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && family === windowRelationId) {
    const cell = bounds(card?.cell);
    const affected = Array.isArray(card?.affected) ? card.affected : null;
    if (cell) subjects.push({ label: affected ? 'Control clicked' : 'Cell that disagrees with the examples', box: cell });
    for (const item of affected ?? []) {
      const box = bounds(item);
      if (box && !cell?.every((value, i) => value === box[i])) subjects.push({ label: 'Other cell in the predicted effect', box });
    }
    if (Array.isArray(card?.references)) for (const reference of card.references) {
      const box = bounds(reference);
      if (box) subjects.push({ label: 'Example window', box });
    }
  }
  if (situationCard && (family === framedReceptionId || family === learnFramedReceptionId)) {
    for (const [field, label] of [['control', 'Paired control bands'], ['point', 'Test point'],
      ['source', 'Framed piece'], ['marker', 'Candidate receiving frame']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && (family === framedSearchId || family === stableReferenceId)) {
    for (const [field, label] of [['reference', 'Framed sample'], ['view', 'Area searched'], ['match', 'Exact match']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && (family === displayCouplingId || family === contrastControlsId || family === contrastProbeId)) {
    const control = bounds(card?.control);
    if (control) subjects.push({ label: 'Switch tested', box: control });
    const source = bounds(card?.source);
    if (source) subjects.push({ label: 'Previously tested switch', box: source });
    if (Array.isArray(card?.receivers)) for (const indicator of card.receivers) {
      const box = bounds(indicator);
      if (box) subjects.push({ label: Array.isArray(card?.cascadeGates) ? 'Final lamp' : 'Separate indicator', box });
    }
    if (Array.isArray(card?.cascadeGates)) for (const gate of card.cascadeGates) {
      const box = bounds(gate);
      if (box) subjects.push({ label: 'Intermediate logic component', box });
    }
  }
  if (situationCard && family === periodicProfileAlignmentId) {
    const control = bounds(card?.control);
    if (control) subjects.push({ label: 'Control under test', box: control });
    for (const [field, label] of [['gauges', 'Target gauge'], ['profiles', 'Profile selector']] as const) {
      if (!Array.isArray(card?.[field])) continue;
      for (const item of card[field]) {
        const box = bounds(item);
        if (box) subjects.push({ label, box });
      }
    }
  }
  if (situationCard && (family === portPairingId || family === learnPortPairingId) && Array.isArray(card?.pieces)) {
    for (const part of card.pieces) {
      const box = bounds(part);
      if (box) subjects.push({ label: 'Piece with connection points', box });
    }
  }
  if (situationCard && (family === carryToFrameId || family === learnCarryToFrameId)) {
    for (const [field, label] of [['actor', 'Controlled body'], ['object', 'Object to transport'],
      ['frame', 'Matching frame'], ['pendingObject', 'Next object to collect']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && (family === populationPlacementId || family === verifyReferencePlacementId)) {
    const targetLabel = card?.supportingPlacement ? 'Position beside the reference' : 'Receiving position';
    for (const [field, label] of [['piece', 'Selected piece'], ['target', targetLabel], ['reference', 'Visible reference']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
    if (Array.isArray(card?.neighbors)) for (const neighbor of card.neighbors) {
      const box = bounds(neighbor);
      if (box) subjects.push({ label: 'Neighbor with an observed color change', box });
    }
    if (Array.isArray(card?.predictedNeighbors)) for (const neighbor of card.predictedNeighbors) {
      const box = bounds(neighbor);
      if (box) subjects.push({ label: 'Neighbor expected to change color', box });
    }
    if (Array.isArray(card?.supportPositions)) for (const position of card.supportPositions) {
      const box = bounds(position), target = bounds(card?.target);
      if (box && (!target || box.some((coordinate, axis) => coordinate !== target[axis]))) {
        subjects.push({ label: 'Supporting position beside the reference', box });
      }
    }
  }
  if (situationCard && (family === chartRouteId || family === learnChartRouteId)) {
    for (const [field, label] of [['marker', 'Candidate chart marker'], ['chartOrigin', 'Shared starting mark'],
      ['chartPosition', 'Current chart marker']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
    if (Array.isArray(card?.slots)) for (const slot of card.slots.slice(0, 3)) {
      const box = bounds(slot);
      if (box) subjects.push({ label: 'Observed inventory slot', box });
    }
  }
  if (situationCard && (family === facetGrowthId || family === learnFacetGrowthId)) {
    for (const [field, label] of [['support', 'Clicked surface'], ['example', 'Visible example'], ['reference', 'Target proportions']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && (family === visualPatternId || family === verifyPatternChoiceId)) {
    const target = bounds(card?.target), option = bounds(card?.option);
    if (target) subjects.push({ label: 'Missing card', box: target });
    if (option) subjects.push({ label: 'Compatible option', box: option });
    if (Array.isArray(card?.examples)) for (const example of card.examples.slice(0, 4)) {
      const box = bounds(example);
      if (box) subjects.push({ label: 'Observed card', box });
    }
  }
  if (situationCard && (family === legendRecolorId || family === matchExampleId)) {
    for (const [field, label] of [['region', 'Region to recolor'], ['legend', 'Visible color legend'],
      ['example', 'Matching example'], ['swatch', 'Color selector']] as const) {
      const box = bounds(card?.[field]);
      if (box) subjects.push({ label, box });
    }
  }
  if (situationCard && family === cavityAccessId) {
    const obstacle = bounds(card?.movingObstacle), actor = bounds(card?.controlledPiece);
    if (obstacle) subjects.push({ label: 'Moving obstacle before the action', box: obstacle });
    if (actor) subjects.push({ label: 'Controlled piece before the action', box: actor });
    if (Array.isArray(card?.slots)) for (const slot of card.slots.slice(0, 4)) {
      const box = bounds(slot);
      if (box) subjects.push({ label: 'Candidate slot between matching sides', box });
    }
  }
  const searchOperation = label(record(rooted?.search)?.operation);
  const search = record(rooted?.search);
  const recoveryOperations = Array.isArray(search?.recovery_operations) ? search.recovery_operations.slice(0, 4).flatMap(value => {
    const element = record(value), key = label(element?.key), finding = label(element?.finding);
    return key && finding && ['OP03', 'OP12', 'OP08', 'OP26'].includes(key) ? [{ key, finding }] : [];
  }) : [];
  const recoveryAction = Array.isArray(search?.recovery_evidence) ? priorAction(search.recovery_evidence[1]) : null;
  const sic = record(search?.sic_decision), recoveryPack = record(sic?.configuration);
  const maxDepth = natural(recoveryPack?.maxDepth), maxNodes = natural(recoveryPack?.maxNodes);
  const target = record(sic?.objective), targetLabel = label(target?.label);
  const recoveryObjective = target?.id === rootedRecoveryStrategy.objective.id && targetLabel &&
    target.parent === nativeObjective && nativeObjective
    ? { id: rootedRecoveryStrategy.objective.id, label: targetLabel, parent: nativeObjective } : null;
  const agenda = readAgenda(sic?.agenda, isContactStrategy);
  const situation = record(sic?.situation);
  const situationAction = priorAction(situation?.revision) ?? undefined;
  const agendaEvidence = Object.fromEntries(agenda.map(entry => [entry.id,
    [...new Set((entry.evidence ?? []).flatMap(ref => priorAction(ref) ?? []))].sort((a, b) => a - b),
  ]));
  const viewAgenda = readAgenda(viewDecision?.agenda, isViewStrategy);
  const viewStrategy: NativeResolution['viewStrategy'] = viewDecision?.mode === 'active' && nativeObjective && viewObjective
    && viewTarget?.parent === nativeObjective && isViewStrategy(viewKind) ? {
      title: viewStrategies[viewKind], objective: { id: viewObjective, label: viewStrategies[viewKind], parent: nativeObjective },
      agenda: viewAgenda, expectedPixels: natural(record(record(proposal?.view_plan)?.details)?.conditional_new_viewport_pixels),
      agendaEvidence: Object.fromEntries(viewAgenda.map(entry => [entry.id,
        [...new Set((entry.evidence ?? []).flatMap(ref => priorAction(ref) ?? []))].sort((a, b) => a - b),
      ])),
    } : undefined;
  const recoveryDecision = isContactStrategy(sic?.strategy) && recoveryPack?.mode === 'active'
    && maxDepth !== null && maxNodes !== null
    ? { strategy: contactRecoveryStrategies[sic.strategy], need: rootedRecoveryStrategy.need, objective: recoveryObjective, agenda, situationAction, agendaEvidence,
      maxDepth, maxNodes, packDigest: typeof sic.packDigest === 'string' && /^[a-f0-9]{64}$/.test(sic.packDigest) ? sic.packDigest : null }
    : undefined;
  const returnedNeed = record(result?.sic_need);
  const viewReturn = reverse.find(event => event?.kind === 'sic_view_return' && typeof event.evidence === 'string' && event.evidence.startsWith(currentRef));
  const viewStatus = viewReturn?.status, viewReturnObjective = label(viewReturn?.objective);
  const viewOutcome = viewReturnObjective && (viewStatus === 'expanded' || viewStatus === 'no_new_area' || viewStatus === 'unregistered')
    ? { objective: viewReturnObjective, status: viewStatus, newPixels: natural(viewReturn?.newPixels) } as const : undefined;
  const informationReturn = reverse.find(event => event?.kind === 'sic_information_return' && typeof event.evidence === 'string' && event.evidence.startsWith(currentRef));
  const informationReturnObjective = label(informationReturn?.objective);
  const checks = Object.values(record(informationReturn?.checks) ?? {});
  const informationOutcome = informationReturnObjective && checks.length ? { objective: informationReturnObjective,
    matched: checks.filter(check => check === 'matched').length, contradicted: checks.filter(check => check === 'contradicted').length,
    unknown: checks.filter(check => check === 'unknown').length } : undefined;
  const frontierResult = record(result?.sic_frontier_outcome);
  const frontierOutcome: NonNullable<NativeResolution['outcome']>['frontierOutcome'] =
    typeof frontierResult?.objective === 'string' && /^Q_[a-f0-9]{20}$/.test(frontierResult.objective)
    && (frontierResult.status === 'observed' || frontierResult.status === 'access_interrupted')
    ? { objective: frontierResult.objective, status: frontierResult.status } : undefined;
  const needStatus = returnedNeed?.status;
  const recoveryNeed: NonNullable<NativeResolution['outcome']>['recoveryNeed'] =
    typeof returnedNeed?.id === 'string' && /^sic-need:[a-f0-9]{64}$/.test(returnedNeed.id)
    && (needStatus === 'assigned' || needStatus === 'satisfied' || needStatus === 'refuted' || needStatus === 'expired')
    ? { id: returnedNeed.id, status: needStatus } : undefined;
  const previousProjection = routeIndex > 0 && Array.isArray(rooted?.predictions) ? record(rooted.predictions[routeIndex - 1]) : null;
  const rootBox = bounds(previousProjection?.root ?? rootedScene?.root);
  if (rootBox) subjects.push({ label: 'Controlled root', box: rootBox });
  const previousPieces = new Map(Array.isArray(previousProjection?.pieces) ? previousProjection.pieces
    .filter(piece => Array.isArray(piece) && piece.length === 2).map(piece => [piece[0], piece[1]]) : []);
  if (Array.isArray(rootedScene?.pieces)) for (const piece of rootedScene.pieces.slice(0, 8)) {
    const material = record(piece), box = bounds(previousPieces.get(material?.id) ?? material?.bbox);
    if (box) subjects.push({ label: `Material ${label(material?.type) ?? ''}`.trim(), box });
  }
  if (Array.isArray(rootedScene?.guides)) for (const guide of rootedScene.guides.slice(0, 4)) {
    const box = bounds(guide);
    if (box) subjects.push({ label: 'Fixed guide', box });
  }
  const route: NativePoint[] = [];
  if (routeIndex === 0 && openingEvidence) {
    const target = bounds(openingEvidence.box);
    if (target) subjects.push({ label: openingMode === 'shadow' ? 'Curiosity candidate in shadow' : 'Composition investigated', box: target });
    for (const related of Array.isArray(openingEvidence.related) ? openingEvidence.related.slice(0, 4) : []) {
      const box = bounds(record(related)?.box);
      if (box) subjects.push({ label: 'Related visible element', box });
    }
  }
  if (viewStrategy && routeIndex === 0 && Array.isArray(viewDecision?.subjects)) {
    for (const subject of viewDecision.subjects.slice(0, 8)) {
      const measured = record(subject), name = label(measured?.label), box = bounds(measured?.box);
      if (name && box) subjects.push({ label: name, box });
    }
  }
  const pointAt = (value: unknown): NativePoint | null => Array.isArray(value) && value.length === 2
    && value.every(Number.isSafeInteger) ? [value[0], value[1]] : null;
  const command = record(plan[routeIndex]), click = record(command?.data);
  if (command?.action_ref === 'ACTION6' && natural(click?.x) !== null && natural(click?.y) !== null) {
    const x = Number(click!.x), y = Number(click!.y);
    subjects.push({ label: 'Clicked area', box: [Math.max(0, x - 3), Math.max(0, y - 3), x + 3, y + 3] });
  }
  if (positionSteps.length) {
    for (const [index, item] of positionSteps.slice(routeIndex, routeIndex + 24).entries()) {
      const step = record(item), from = pointAt(step?.from), to = pointAt(step?.to);
      if (!from || !to || (index && (from[0] !== route.at(-1)?.[0] || from[1] !== route.at(-1)?.[1]))) break;
      if (!index) route.push(from);
      route.push(to);
    }
  }
  const compositions = Array.isArray(proposal?.compositions) ? proposal.compositions.slice(0, 6).flatMap(item => {
    const value = record(item);
    const id = label(value?.id);
    return id ? [{ id, role: label(value?.role), observed: typeof value?.observed === 'boolean' ? value.observed : null }] : [];
  }) : [];
  return { family, pending: pending && !!proposal,
    proposalKind: label(proposal?.kind), question,
    objective: nativeObjective ?? (objectiveSource === 'question' ? question : null), objectiveSource,
    strategyObjective,
    situationCard,
    missingControl,
    operation: op && /^OP(?:0[1-9]|[12]\d|3[01])$/.test(op) ? op : null,
    searchOperation: searchOperation === 'OP26' ? searchOperation : undefined,
    recoveryOperations: recoveryOperations.length ? recoveryOperations : undefined,
    recoveryDecision,
    recoveryAction: recoveryAction ?? undefined,
    composition: label(template?.composition_ref), compositions, subjects, route, proposalRef: label(proposal?.proposal_id),
    planRevision: natural(release?.decision_revision) ?? undefined,
    releasedPlan,
    frontierStrategy,
    viewStrategy,
    informationStrategy,
    remainingSteps: Math.max(0, plan.length - routeIndex), footprint, context,
    guard: label(guard?.reason),
    nextIndex: pending && guard && Number.isSafeInteger(guard.index) ? Number(guard.index) : null, steps,
    history, outcome: outcomeFamily && (result?.matched === null || typeof result?.matched === 'boolean')
      ? { family: outcomeFamily, matched: result.matched, reason: label(result.reason),
        ...(recoveryNeed ? { recoveryNeed } : {}), ...(frontierOutcome ? { frontierOutcome } : {}), ...(viewOutcome ? { viewOutcome } : {}),
        ...(informationOutcome ? { informationOutcome } : {}) } : null };
}
export interface DecisionSprites {
  readonly family: string | null;
  readonly objective: NativeResolution['objective'];
  readonly objectiveSource: NativeResolution['objectiveSource'];
  readonly strategyObjective?: StrategyObjective;
  readonly situationCard?: NativeResolution['situationCard'];
  readonly missingControl?: MissingControlWitness;
  readonly operation: string | null;
  readonly searchOperation?: string;
  readonly recoveryOperations?: readonly { key: string; finding: string }[];
  readonly recoveryDecision?: NativeResolution['recoveryDecision'];
  readonly frontierStrategy?: NativeResolution['frontierStrategy'];
  readonly viewStrategy?: NativeResolution['viewStrategy'];
  readonly informationStrategy?: NativeResolution['informationStrategy'];
  readonly recoveryAction?: number;
  readonly composition: string | null;
  readonly question: string | null;
  readonly proposalRef: string | null;
  readonly planRevision?: number;
  readonly route: readonly NativePoint[];
  readonly steps: readonly NativeStep[];
  readonly remainingSteps: number;
  readonly stepIndex?: number | null;
  readonly context?: NativePlanContext | null;
  readonly destinationSprite?: NativeRows;
  readonly strategyTarget?: { readonly before: NativeRows; readonly after: NativeRows | null };
  readonly strategyMeter?: { readonly before: NativeRows; readonly after: NativeRows | null;
    readonly unitsBefore: number; readonly unitsAfter: number | null };
  readonly sprites: readonly { readonly label: string; readonly before: NativeRows; readonly after: NativeRows | null }[];
}

function captureMeter(meter: NonNullable<NativeStrategyContext['meter']>, before: NativeRows, after: NativeRows | null,
  firstStep: boolean): DecisionSprites['strategyMeter'] {
  if (!meter.strip) return undefined;
  const [axis, line, color, anchor, edge] = meter.strip;
  const getLine = (rows: NativeRows) => axis === 'x' ? rows[line] : rows[0]?.[line] === undefined ? undefined : rows.map(row => row[line]!);
  const length = (rows: NativeRows): number | null => {
    const values = getLine(rows);
    if (!values || edge > values.length) return null;
    let start = anchor === 'lo' ? edge : edge - 1;
    const direction = anchor === 'lo' ? 1 : -1;
    let count = 0;
    while (values[start] === color) { count++; start += direction; }
    // A shifted anchor or another run is not the same strip measured by 0.68.
    if (values[anchor === 'lo' ? edge - 1 : edge] === color || values.filter(value => value === color).length !== count) return null;
    return count;
  };
  const unitsBefore = length(before);
  if (unitsBefore === null || (firstStep && unitsBefore !== meter.units)) return undefined;
  const unitsAfter = after ? length(after) : null;
  const extent = getLine(before)!.length;
  const width = Math.max(unitsBefore, unitsAfter ?? 0, (meter.capacity ?? 0) * meter.rate);
  const lo = anchor === 'lo' ? edge : Math.max(0, edge - width);
  const hi = anchor === 'lo' ? Math.min(extent, edge + width) : edge;
  if (hi <= lo) return undefined;
  // Keep both bar ends and the full strip so before/after can be compared.
  const other = Math.min(line + 1, (axis === 'x' ? before.length : before[0]!.length) - 1);
  const box: NativeBox = axis === 'x' ? [lo, line, hi - 1, other] : [line, lo, other, hi - 1];
  return { before: cropReturn(before, box, 1), after: after && unitsAfter !== null ? cropReturn(after, box, 1) : null, unitsBefore, unitsAfter };
}

export function captureDecisionSprites(decision: NativeResolution, before: NativeRows, after: NativeRows | null): DecisionSprites {
  const sprites = decision.subjects.flatMap(({ label: name, box: original }) => {
    const [x, y, r, b] = original;
    const right = name === 'Clicked area' ? Math.min(r, (before[0]?.length ?? 0) - 1) : r;
    const bottom = name === 'Clicked area' ? Math.min(b, before.length - 1) : b;
    const box: NativeBox = [x, y, right, bottom];
    if (x < 0 || y < 0 || x > right || y > bottom || right >= (before[0]?.length ?? 0) || bottom >= before.length) return [];
    const stride = Math.max(1, Math.ceil(Math.max(right - x + 1, bottom - y + 1) / 20));
    return [{ label: name, before: cropReturn(before, box, stride),
      after: after && right < (after[0]?.length ?? 0) && bottom < after.length ? cropReturn(after, box, stride) : null }];
  });
  const next = decision.route[1];
  const box = decision.footprint;
  const right = next && box ? next[0] + box[2] - box[0] : -1;
  const bottom = next && box ? next[1] + box[3] - box[1] : -1;
  const destinationSprite = after && next && box && next[0] >= 0 && next[1] >= 0
    && right < (after[0]?.length ?? 0) && bottom < after.length
    ? cropReturn(after, [next[0], next[1], right, bottom], Math.max(1, Math.ceil(Math.max(right - next[0] + 1, bottom - next[1] + 1) / 20)))
    : undefined;
  if (next && box && next[0] >= 0 && next[1] >= 0 && right < (before[0]?.length ?? 0) && bottom < before.length) {
    const stride = Math.max(1, Math.ceil(Math.max(right - next[0] + 1, bottom - next[1] + 1) / 20));
    sprites.push({ label: 'Predicted destination', before: cropReturn(before, [next[0], next[1], right, bottom], stride),
      after: destinationSprite ?? null });
  }
  const target = decision.route.at(-1), context = decision.context;
  const strategy = context?.strategy;
  const strategyMeter = strategy?.meter ? captureMeter(strategy.meter, before, after, decision.nextIndex === 0) : undefined;
  const targetRight = target && box ? target[0] + box[2] - box[0] : -1;
  const targetBottom = target && box ? target[1] + box[3] - box[1] : -1;
  let strategyTarget: DecisionSprites['strategyTarget'];
  if (strategy && target && target[0] >= 0 && target[1] >= 0 && targetRight >= target[0] && targetBottom >= target[1]
      && targetRight < (before[0]?.length ?? 0) && targetBottom < before.length) {
    const region: NativeBox = [target[0], target[1], targetRight, targetBottom];
    const stride = Math.max(1, Math.ceil(Math.max(targetRight - target[0] + 1, targetBottom - target[1] + 1) / 20));
    strategyTarget = { before: cropReturn(before, region, stride),
      after: after && targetRight < (after[0]?.length ?? 0) && targetBottom < after.length ? cropReturn(after, region, stride) : null };
  }
  return { family: decision.family, objective: decision.objective, objectiveSource: decision.objectiveSource,
    strategyObjective: decision.strategyObjective,
    situationCard: decision.situationCard,
    missingControl: decision.missingControl,
    operation: decision.operation, searchOperation: decision.searchOperation, recoveryOperations: decision.recoveryOperations,
    recoveryDecision: decision.recoveryDecision,
    frontierStrategy: decision.frontierStrategy,
    viewStrategy: decision.viewStrategy,
    informationStrategy: decision.informationStrategy,
    recoveryAction: decision.recoveryAction, composition: decision.composition, question: decision.question,
    proposalRef: decision.proposalRef, planRevision: decision.planRevision, route: decision.route, steps: decision.steps.slice(decision.nextIndex ?? 0),
    remainingSteps: decision.remainingSteps, stepIndex: decision.nextIndex, context, destinationSprite, strategyTarget, strategyMeter, sprites };
}
