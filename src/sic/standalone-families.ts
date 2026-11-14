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

export const standalonePlanningGroups = [
  { id: 'repair_visible_field', families: [fieldRepairId, orderedContactId, supportTransferId] },
  { id: 'inspect_candidate_relations', families: [subsetExperimentId, framedContactId, transportContactId] },
  { id: 'coordinate_visible_motion', families: [bandAlignmentId, sharedArrivalId, outlineServiceId] },
  { id: 'interpret_examples_and_collections', families: [labeledSequenceId, markedCollectionId, slotTransferId] },
  { id: 'apply_learned_relations', families: [remoteSupportRouteId, occurrenceRecallId, slotPermutationId, surfaceCopyId] },
  { id: 'explore_available_inputs', families: [cavityAccessId, publicInputExplorationId] },
] as const;

export const standalonePlanningFamilies: readonly string[] = Object.freeze(standalonePlanningGroups.flatMap(group => group.families));
