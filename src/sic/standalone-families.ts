import { fieldRepairId } from './field-repair.ts';
import { orderedContactId } from './ordered-contact.ts';
import { supportTransferId } from './support-transfer.ts';
import { subsetExperimentId } from './subset-experiment.ts';
import { cavityAccessId } from './cavity-access.ts';
import { publicInputExplorationId } from './public-input-exploration.ts';
import { framedContactId } from './framed-contact.ts';
import { transportContactId } from './transport-contact.ts';
import { bandAlignmentId } from './band-alignment.ts';
import { sharedArrivalId } from './shared-arrival.ts';
import { outlineServiceId } from './outline-service.ts';
import { labeledSequenceId } from './labeled-sequence.ts';
import { markedCollectionId } from './marked-collection.ts';
import { slotTransferId } from './slot-transfer.ts';
import { remoteSupportRouteId } from './remote-support-route.ts';
import { occurrenceRecallId } from './occurrence-recall.ts';
import { slotPermutationId } from './slot-permutation.ts';
import { surfaceCopyId } from './surface-copy.ts';
import { codeRouteId } from './code-route.ts';
import { profileTransferId } from './profile-transfer.ts';
import { orderedReplenishmentId } from './ordered-replenishment.ts';
import { programOriginId } from './program-origin.ts';
import { previewPlacementId } from './preview-placement.ts';
import { symbolContributionId } from './symbol-contribution.ts';
import { markedLatticeId } from './marked-lattice.ts';
import { queuedPlacementId } from './queued-placement.ts';
import { legendRecolorId } from './legend-recolor.ts';
import { visualPatternId } from './visual-pattern.ts';
import { facetGrowthId } from './facet-growth.ts';
import { chartRouteId } from './chart-route.ts';
import { populationPlacementId } from './population-placement.ts';

export const standalonePlanningGroups = [
  { id: 'repair_visible_field', families: [fieldRepairId, orderedContactId, supportTransferId] },
  { id: 'inspect_candidate_relations', families: [subsetExperimentId, framedContactId, transportContactId] },
  { id: 'coordinate_visible_motion', families: [bandAlignmentId, sharedArrivalId, outlineServiceId] },
  { id: 'interpret_examples_and_collections', families: [labeledSequenceId, markedCollectionId, slotTransferId, visualPatternId] },
  { id: 'apply_learned_relations', families: [remoteSupportRouteId, occurrenceRecallId, slotPermutationId, surfaceCopyId, chartRouteId] },
  { id: 'construct_executable_program', families: [codeRouteId, programOriginId] },
  { id: 'fit_profiles_into_receivers', families: [profileTransferId] },
  { id: 'preserve_ordered_team', families: [orderedReplenishmentId] },
  { id: 'fill_visible_partition', families: [previewPlacementId, populationPlacementId] },
  { id: 'follow_symbol_diagram', families: [symbolContributionId, legendRecolorId, facetGrowthId] },
  { id: 'visit_marked_surface', families: [markedLatticeId] },
  { id: 'place_incoming_groups', families: [queuedPlacementId] },
  { id: 'explore_available_inputs', families: [cavityAccessId, publicInputExplorationId] },
] as const;

export const standalonePlanningFamilies: readonly string[] = Object.freeze(standalonePlanningGroups.flatMap(group => group.families));
