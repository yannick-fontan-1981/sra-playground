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

export const standalonePlanningFamilies: readonly string[] = Object.freeze([
  fieldRepairId, orderedContactId, supportTransferId, subsetExperimentId, framedContactId, transportContactId,
  bandAlignmentId, sharedArrivalId, outlineServiceId, labeledSequenceId, markedCollectionId, slotTransferId, remoteSupportRouteId,
  occurrenceRecallId, cavityAccessId, publicInputExplorationId,
]);
