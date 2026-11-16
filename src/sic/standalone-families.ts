import { fieldRepairId } from './field-repair.ts';
import { verifyContactOrderId } from './ordered-contact.ts';
import { supportTransferId } from './support-transfer.ts';
import { learnSupportMovesId, learnObservedSupportsId } from './learn-support-moves.ts';
import { subsetExperimentId } from './subset-experiment.ts';
import { learnScopeEffectsId, learnVisibleGroupEffectsId } from './learn-scope-effects.ts';
import { cavityAccessId } from './cavity-access.ts';
import { publicInputExplorationId } from './public-input-exploration.ts';
import { recheckDirectionalControlsId } from './recheck-directional-controls.ts';
import { trialRepeatedLinearControlsId } from './trial-repeated-linear-controls.ts';
import { compareAvailableControlsId } from './compare-available-controls.ts';
import { framedContactId, learnPatternAccessId } from './framed-contact.ts';
import { animationContactId, learnAnimationContactId } from './animation-contact.ts';
import { learnTransportAccessId, transportContactId } from './transport-contact.ts';
import { verifyBandTransferId } from './band-alignment.ts';
import { verifySharedArrivalId } from './shared-arrival.ts';
import { learnOutlineServiceId, outlineServiceId } from './outline-service.ts';
import { labeledSequenceId, learnLabeledSequenceId } from './labeled-sequence.ts';
import { markedCollectionId } from './marked-collection.ts';
import { observedMechanicsGroup } from './strategy-agenda.ts';
import { visibleConfigurationCoverageId } from './visible-configuration-coverage.ts';
import { markedCompartmentFlowId } from './marked-compartment-flow.ts';
import { observedRelayRouteId } from './observed-relay-route.ts';
import { observedPrefixQuotasId } from './observed-prefix-quotas.ts';
import { observedCarrierReductionId } from './observed-carrier-reduction.ts';
import { observedLinePlacementId } from './observed-line-placement.ts';
import { observedPolePairId } from './observed-pole-pair.ts';
import { observedSharedRelationsId } from './observed-shared-relations.ts';
import { observedPatternLayoutId } from './observed-pattern-layout.ts';
import { observedActuatorArrangementId } from './observed-actuator-arrangement.ts';
import { observedRouteInterventionId } from './observed-route-intervention.ts';
import { observedSurvivalId } from './observed-survival.ts';
import { observedRailTransfersId } from './observed-rail-transfers.ts';
import { columnAlignmentId } from './column-alignment.ts';
import { settleMatchingEdgesId } from './settle-matching-edges.ts';
import { slotTransferId } from './slot-transfer.ts';
import { learnRemoteAccessId, remoteSupportRouteId } from './remote-support-route.ts';
import { verifyOccurrenceChoiceId } from './occurrence-recall.ts';
import { learnSlotPermutationId, verifySlotPermutationId } from './slot-permutation.ts';
import { learnSurfaceCopyId, surfaceCopyId } from './surface-copy.ts';
import { verifyProgramConfigurationId } from './code-route.ts';
import { verifyProfileTransferId } from './profile-transfer.ts';
import { orderedReplenishmentId, learnOrderedReplenishmentId } from './ordered-replenishment.ts';
import { learnProgramOriginId, programOriginId } from './program-origin.ts';
import { verifyPreviewPlacementId } from './preview-placement.ts';
import { symbolContributionId } from './symbol-contribution.ts';
import { verifyMarkedLatticeId } from './marked-lattice.ts';
import { queuedPlacementId, learnQueuedPlacementId } from './queued-placement.ts';
import { legendRecolorId, matchExampleId } from './legend-recolor.ts';
import { verifyPatternChoiceId } from './visual-pattern.ts';
import { facetGrowthId, learnFacetGrowthId } from './facet-growth.ts';
import { chartRouteId, learnChartRouteId } from './chart-route.ts';
import { verifyReferencePlacementId } from './population-placement.ts';
import { carryToFrameId, learnCarryToFrameId } from './carry-to-frame.ts';
import { learnPortPairingId, portPairingId } from './port-pairing.ts';
import { displayCouplingId } from './display-coupling.ts';
import { periodicProfileAlignmentId } from './periodic-profile-alignment.ts';
import { contrastControlsId, contrastProbeId } from './contrast-controls.ts';
import { stableReferenceId } from './framed-search.ts';
import { framedReceptionId, learnFramedReceptionId } from './framed-reception.ts';
import { windowRelationId } from './window-relation.ts';
import { verifySequenceEditsId } from './glyph-editing.ts';
import { fieldIsolationId, learnFieldIsolationId } from './field-isolation.ts';
import { directionalReceptionId, learnDirectionalReceptionId } from './directional-reception.ts';
import { learnWindowCoverageId, windowCoverageId } from './window-coverage.ts';
import { verifyPanelConfigurationId } from './panel-matching.ts';
import { verifyCrossingRowsId } from './crossing-rows.ts';
import { parallelSymbolPrefixesId } from './parallel-symbol-prefixes.ts';
import { verifyTraceCoverageId } from './trace-coverage.ts';
import { learnRadialConnectionId, radialConnectionId } from './radial-connection.ts';
import { verifyCaptureRouteId } from './invited-capture.ts';
import { verifyBranchAlignmentId } from './branch-alignment.ts';
import { verifyOrderedFeedbackId } from './feedback-trial.ts';
import { catalogueComparisonId, revealedExampleId } from './catalogue-comparison.ts';
import { learnReceptionAccessId, receptionAccessId } from './reception-access.ts';
import { verifyMarkerPlacementId } from './marker-coverage.ts';
import { coordinateObservedMotionId, reflectedPlacementId } from './reflected-placement.ts';
import { verifyCoupledRouteId } from './coupled-motion.ts';
import { verifyConnectedRouteId } from './material-route.ts';
import { verifyInventoryTransferId } from './inventory-access.ts';
import { verifyRemoteReplayId } from './replay-access.ts';
import { verifyOrientedDeliveryId } from './oriented-delivery.ts';
import { indicatedJumpId, learnIndicatedJumpId } from './indicated-jump.ts';
import { highlightedRouteId, learnHighlightedRouteId } from './highlighted-route.ts';
import { learnPairedPassageId, pairedPassageId } from './paired-passage.ts';
import { learnFrameAccessId, verifyFrameContactId } from './seated-contact.ts';
import { learnSwitchedSurfaceId, switchedSurfaceId } from './switched-surface.ts';
import { verifyGaugeEffectId } from './marked-gauge.ts';
import { coupledGaugeRouteId } from './coupled-gauge-route.ts';
import { mergeForDemandId } from './merge-for-demand.ts';
import { linkedGroupRouteId } from './linked-group-route.ts';
import { verifyReactiveMotionId } from './reactive-target.ts';
import { verifyChannelAccessId } from './paired-channels.ts';
import { compartmentGrowthId } from './compartment-growth.ts';
import { verifyPointAccessId } from './point-reach.ts';
import { verifyLinkedMotionId } from './linked-midpoint.ts';
import { learnRemovableSupportId, verifyRemovableSupportId } from './excavate-descent.ts';
import { protectGravityRouteId } from './protect-gravity-route.ts';
import { gatedCascadeId, learnCascadeId } from './gated-cascade.ts';
import { layeredFitId, learnLayeredFitId } from './layered-fit.ts';
import { litRouteId, learnLitRouteId } from './lit-route.ts';
import { learnPivotCargoId, pivotCargoId } from './pivot-cargo.ts';
import { nestedPassageId, learnNestedPassageId } from './nested-passage.ts';
import { learnContactAccessId, translateCoupledPiecesId } from './translate-coupled-pieces.ts';
import { verifyCombinedMarksId } from './staged-marks.ts';
import { learnSelectedAccessId, moveMaskedPiecesId } from './move-masked-pieces.ts';
import { learnLinkOpeningsId, linkOpeningsId } from './link-openings.ts';
import { learnAnimatedCueId, reproduceCueId } from './reproduce-cue.ts';
import { navigateRevealedGridId } from './navigate-revealed-grid.ts';
import { learnGridAccessId } from './learn-grid-access.ts';
import { arrangeTurnPostsId, learnTurnPostsId } from './arrange-turn-posts.ts';
import { learnCorrespondenceId, learnRepeatedCellsId } from './learn-correspondence.ts';
import { learnMaterialAssemblyId, materialAssemblyId } from './material-assembly.ts';

export const standalonePlanningGroups = [
  { id: observedMechanicsGroup, families: [markedCollectionId, visibleConfigurationCoverageId, markedCompartmentFlowId, animationContactId,
    observedRelayRouteId, observedPrefixQuotasId, observedCarrierReductionId, observedLinePlacementId, observedPolePairId, verifyPreviewPlacementId,
    verifyInventoryTransferId, chartRouteId, framedContactId, coupledGaugeRouteId, reproduceCueId, arrangeTurnPostsId, directionalReceptionId, pairedPassageId,
    remoteSupportRouteId, verifyFrameContactId, verifyProfileTransferId, protectGravityRouteId, translateCoupledPiecesId, learnContactAccessId, verifyCoupledRouteId, verifyOrientedDeliveryId, verifyReferencePlacementId, verifyChannelAccessId,
    displayCouplingId, periodicProfileAlignmentId, materialAssemblyId, observedSharedRelationsId, observedPatternLayoutId, verifyReactiveMotionId, switchedSurfaceId, navigateRevealedGridId,
    pivotCargoId, observedActuatorArrangementId, observedRouteInterventionId, observedSurvivalId, observedRailTransfersId, settleMatchingEdgesId, columnAlignmentId] },
  { id: 'repair_visible_field', families: [reproduceCueId, learnAnimatedCueId, fieldRepairId, verifyContactOrderId, supportTransferId, learnSupportMovesId, learnObservedSupportsId] },
  { id: 'inspect_candidate_relations', families: [verifyCrossingRowsId, verifyCaptureRouteId, subsetExperimentId, learnScopeEffectsId, framedContactId, learnPatternAccessId, transportContactId, learnTransportAccessId, verifyCombinedMarksId, materialAssemblyId, learnMaterialAssemblyId, animationContactId, learnAnimationContactId] },
  { id: 'coordinate_visible_motion', families: [coupledGaugeRouteId, mergeForDemandId, verifyBandTransferId, verifySharedArrivalId, outlineServiceId, learnOutlineServiceId, carryToFrameId, learnCarryToFrameId, directionalReceptionId, learnDirectionalReceptionId, verifyBranchAlignmentId, receptionAccessId, learnReceptionAccessId, verifyMarkerPlacementId, reflectedPlacementId, coordinateObservedMotionId, pivotCargoId, learnPivotCargoId, moveMaskedPiecesId, translateCoupledPiecesId, learnContactAccessId, verifyCoupledRouteId, verifyConnectedRouteId, verifyInventoryTransferId, verifyRemoteReplayId, verifyOrientedDeliveryId, indicatedJumpId, learnIndicatedJumpId, highlightedRouteId, learnHighlightedRouteId, pairedPassageId, learnPairedPassageId, verifyFrameContactId, learnFrameAccessId, switchedSurfaceId, learnSwitchedSurfaceId, verifyReactiveMotionId, verifyPointAccessId, verifyLinkedMotionId, linkedGroupRouteId, verifyRemovableSupportId, learnRemovableSupportId, litRouteId, learnLitRouteId, nestedPassageId, learnNestedPassageId, linkOpeningsId, learnLinkOpeningsId, navigateRevealedGridId, arrangeTurnPostsId, learnTurnPostsId] },
  { id: 'interpret_examples_and_collections', families: [labeledSequenceId, learnLabeledSequenceId, markedCollectionId, slotTransferId, verifyPatternChoiceId, stableReferenceId, verifyOrderedFeedbackId, catalogueComparisonId, revealedExampleId, windowRelationId, layeredFitId, learnLayeredFitId] },
  { id: 'apply_learned_relations', families: [remoteSupportRouteId, learnRemoteAccessId, verifyOccurrenceChoiceId, verifySlotPermutationId, learnSlotPermutationId, surfaceCopyId, learnSurfaceCopyId, chartRouteId, learnChartRouteId] },
  { id: 'construct_executable_program', families: [verifyProgramConfigurationId, programOriginId, learnProgramOriginId, parallelSymbolPrefixesId, verifySequenceEditsId, windowCoverageId, learnWindowCoverageId, verifyPanelConfigurationId] },
  { id: 'fit_profiles_into_receivers', families: [verifyProfileTransferId, portPairingId, learnPortPairingId, radialConnectionId, learnRadialConnectionId, framedReceptionId, learnFramedReceptionId] },
  { id: 'preserve_ordered_team', families: [orderedReplenishmentId, learnOrderedReplenishmentId] },
  { id: 'fill_visible_partition', families: [verifyPreviewPlacementId, verifyReferencePlacementId] },
  { id: 'follow_symbol_diagram', families: [symbolContributionId, legendRecolorId, matchExampleId, facetGrowthId, learnFacetGrowthId] },
  { id: 'visit_marked_surface', families: [verifyTraceCoverageId, verifyMarkedLatticeId] },
  { id: 'place_incoming_groups', families: [queuedPlacementId, learnQueuedPlacementId, gatedCascadeId, learnCascadeId] },
  { id: 'explore_available_inputs', families: [displayCouplingId, contrastControlsId, fieldIsolationId, learnFieldIsolationId, cavityAccessId, learnCorrespondenceId, verifyGaugeEffectId, verifyChannelAccessId, compartmentGrowthId, learnGridAccessId, learnSelectedAccessId, contrastProbeId, compareAvailableControlsId, learnRepeatedCellsId, learnVisibleGroupEffectsId, publicInputExplorationId, recheckDirectionalControlsId, trialRepeatedLinearControlsId] },
] as const;

export const standalonePlanningFamilies: readonly string[] = Object.freeze([...new Set(standalonePlanningGroups.flatMap(group => group.families))]);
