import { fieldRepairId } from './field-repair.ts';
import { orderedContactId } from './ordered-contact.ts';
import { supportTransferId } from './support-transfer.ts';
import { learnSupportMovesId } from './learn-support-moves.ts';
import { subsetExperimentId } from './subset-experiment.ts';
import { learnScopeEffectsId } from './learn-scope-effects.ts';
import { cavityAccessId } from './cavity-access.ts';
import { publicInputExplorationId } from './public-input-exploration.ts';
import { compareAvailableControlsId } from './compare-available-controls.ts';
import { framedContactId, learnPatternAccessId } from './framed-contact.ts';
import { animationContactId, learnAnimationContactId } from './animation-contact.ts';
import { learnTransportAccessId, transportContactId } from './transport-contact.ts';
import { bandAlignmentId } from './band-alignment.ts';
import { sharedArrivalId } from './shared-arrival.ts';
import { learnOutlineServiceId, outlineServiceId } from './outline-service.ts';
import { labeledSequenceId, learnLabeledSequenceId } from './labeled-sequence.ts';
import { markedCollectionId } from './marked-collection.ts';
import { slotTransferId } from './slot-transfer.ts';
import { learnRemoteAccessId, remoteSupportRouteId } from './remote-support-route.ts';
import { occurrenceRecallId } from './occurrence-recall.ts';
import { slotPermutationId } from './slot-permutation.ts';
import { learnSurfaceCopyId, surfaceCopyId } from './surface-copy.ts';
import { codeRouteId } from './code-route.ts';
import { profileTransferId } from './profile-transfer.ts';
import { orderedReplenishmentId, learnOrderedReplenishmentId } from './ordered-replenishment.ts';
import { learnProgramOriginId, programOriginId } from './program-origin.ts';
import { previewPlacementId } from './preview-placement.ts';
import { symbolContributionId } from './symbol-contribution.ts';
import { markedLatticeId } from './marked-lattice.ts';
import { queuedPlacementId, learnQueuedPlacementId } from './queued-placement.ts';
import { legendRecolorId, matchExampleId } from './legend-recolor.ts';
import { visualPatternId } from './visual-pattern.ts';
import { facetGrowthId, learnFacetGrowthId } from './facet-growth.ts';
import { chartRouteId, learnChartRouteId } from './chart-route.ts';
import { populationPlacementId } from './population-placement.ts';
import { carryToFrameId, learnCarryToFrameId } from './carry-to-frame.ts';
import { learnPortPairingId, portPairingId } from './port-pairing.ts';
import { displayCouplingId } from './display-coupling.ts';
import { contrastControlsId, contrastProbeId } from './contrast-controls.ts';
import { framedSearchId } from './framed-search.ts';
import { framedReceptionId, learnFramedReceptionId } from './framed-reception.ts';
import { windowRelationId } from './window-relation.ts';
import { glyphEditingId } from './glyph-editing.ts';
import { fieldIsolationId, learnFieldIsolationId } from './field-isolation.ts';
import { directionalReceptionId, learnDirectionalReceptionId } from './directional-reception.ts';
import { learnWindowCoverageId, windowCoverageId } from './window-coverage.ts';
import { panelMatchingId } from './panel-matching.ts';
import { crossingRowsId } from './crossing-rows.ts';
import { traceCoverageId } from './trace-coverage.ts';
import { learnRadialConnectionId, radialConnectionId } from './radial-connection.ts';
import { invitedCaptureId } from './invited-capture.ts';
import { branchAlignmentId } from './branch-alignment.ts';
import { feedbackTrialId } from './feedback-trial.ts';
import { catalogueComparisonId, revealedExampleId } from './catalogue-comparison.ts';
import { learnReceptionAccessId, receptionAccessId } from './reception-access.ts';
import { markerCoverageId } from './marker-coverage.ts';
import { coordinateObservedMotionId, reflectedPlacementId } from './reflected-placement.ts';
import { coupledMotionId } from './coupled-motion.ts';
import { materialRouteId } from './material-route.ts';
import { inventoryAccessId } from './inventory-access.ts';
import { replayAccessId } from './replay-access.ts';
import { orientedDeliveryId } from './oriented-delivery.ts';
import { indicatedJumpId, learnIndicatedJumpId } from './indicated-jump.ts';
import { highlightedRouteId, learnHighlightedRouteId } from './highlighted-route.ts';
import { learnPairedPassageId, pairedPassageId } from './paired-passage.ts';
import { seatedContactId } from './seated-contact.ts';
import { learnSwitchedSurfaceId, switchedSurfaceId } from './switched-surface.ts';
import { markedGaugeId } from './marked-gauge.ts';
import { reactiveTargetId } from './reactive-target.ts';
import { pairedChannelsId } from './paired-channels.ts';
import { pointReachId } from './point-reach.ts';
import { linkedMidpointId } from './linked-midpoint.ts';
import { excavateDescentId } from './excavate-descent.ts';
import { gatedCascadeId, learnCascadeId } from './gated-cascade.ts';
import { layeredFitId, learnLayeredFitId } from './layered-fit.ts';
import { litRouteId, learnLitRouteId } from './lit-route.ts';
import { learnPivotCargoId, pivotCargoId } from './pivot-cargo.ts';
import { nestedPassageId, learnNestedPassageId } from './nested-passage.ts';
import { learnContactAccessId, translateCoupledPiecesId } from './translate-coupled-pieces.ts';
import { stagedMarksId } from './staged-marks.ts';
import { learnSelectedAccessId, moveMaskedPiecesId } from './move-masked-pieces.ts';
import { learnLinkOpeningsId, linkOpeningsId } from './link-openings.ts';
import { learnAnimatedCueId, reproduceCueId } from './reproduce-cue.ts';
import { navigateRevealedGridId } from './navigate-revealed-grid.ts';
import { learnGridAccessId } from './learn-grid-access.ts';
import { arrangeTurnPostsId, learnTurnPostsId } from './arrange-turn-posts.ts';
import { learnCorrespondenceId } from './learn-correspondence.ts';
import { learnMaterialAssemblyId, materialAssemblyId } from './material-assembly.ts';

export const standalonePlanningGroups = [
  { id: 'repair_visible_field', families: [reproduceCueId, learnAnimatedCueId, fieldRepairId, orderedContactId, supportTransferId, learnSupportMovesId] },
  { id: 'inspect_candidate_relations', families: [crossingRowsId, invitedCaptureId, subsetExperimentId, learnScopeEffectsId, framedContactId, learnPatternAccessId, transportContactId, learnTransportAccessId, stagedMarksId, materialAssemblyId, learnMaterialAssemblyId, animationContactId, learnAnimationContactId] },
  { id: 'coordinate_visible_motion', families: [bandAlignmentId, sharedArrivalId, outlineServiceId, learnOutlineServiceId, carryToFrameId, learnCarryToFrameId, directionalReceptionId, learnDirectionalReceptionId, branchAlignmentId, receptionAccessId, learnReceptionAccessId, markerCoverageId, reflectedPlacementId, coordinateObservedMotionId, pivotCargoId, learnPivotCargoId, moveMaskedPiecesId, translateCoupledPiecesId, learnContactAccessId, coupledMotionId, materialRouteId, inventoryAccessId, replayAccessId, orientedDeliveryId, indicatedJumpId, learnIndicatedJumpId, highlightedRouteId, learnHighlightedRouteId, pairedPassageId, learnPairedPassageId, seatedContactId, switchedSurfaceId, learnSwitchedSurfaceId, reactiveTargetId, pointReachId, linkedMidpointId, excavateDescentId, litRouteId, learnLitRouteId, nestedPassageId, learnNestedPassageId, linkOpeningsId, learnLinkOpeningsId, navigateRevealedGridId, arrangeTurnPostsId, learnTurnPostsId] },
  { id: 'interpret_examples_and_collections', families: [labeledSequenceId, learnLabeledSequenceId, markedCollectionId, slotTransferId, visualPatternId, framedSearchId, feedbackTrialId, catalogueComparisonId, revealedExampleId, windowRelationId, layeredFitId, learnLayeredFitId] },
  { id: 'apply_learned_relations', families: [remoteSupportRouteId, learnRemoteAccessId, occurrenceRecallId, slotPermutationId, surfaceCopyId, learnSurfaceCopyId, chartRouteId, learnChartRouteId] },
  { id: 'construct_executable_program', families: [codeRouteId, programOriginId, learnProgramOriginId, glyphEditingId, windowCoverageId, learnWindowCoverageId, panelMatchingId] },
  { id: 'fit_profiles_into_receivers', families: [profileTransferId, portPairingId, learnPortPairingId, radialConnectionId, learnRadialConnectionId, framedReceptionId, learnFramedReceptionId] },
  { id: 'preserve_ordered_team', families: [orderedReplenishmentId, learnOrderedReplenishmentId] },
  { id: 'fill_visible_partition', families: [previewPlacementId, populationPlacementId] },
  { id: 'follow_symbol_diagram', families: [symbolContributionId, legendRecolorId, matchExampleId, facetGrowthId, learnFacetGrowthId] },
  { id: 'visit_marked_surface', families: [traceCoverageId, markedLatticeId] },
  { id: 'place_incoming_groups', families: [queuedPlacementId, learnQueuedPlacementId, gatedCascadeId, learnCascadeId] },
  { id: 'explore_available_inputs', families: [displayCouplingId, contrastControlsId, fieldIsolationId, learnFieldIsolationId, cavityAccessId, learnCorrespondenceId, markedGaugeId, pairedChannelsId, learnGridAccessId, learnSelectedAccessId, contrastProbeId, compareAvailableControlsId, publicInputExplorationId] },
] as const;

export const standalonePlanningFamilies: readonly string[] = Object.freeze(standalonePlanningGroups.flatMap(group => group.families));
