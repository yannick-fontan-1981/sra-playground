import { fieldRepairId } from './field-repair.ts';
import { orderedContactId } from './ordered-contact.ts';
import { supportTransferId } from './support-transfer.ts';

export const standalonePlanningFamilies: readonly string[] = Object.freeze([fieldRepairId, orderedContactId, supportTransferId]);
