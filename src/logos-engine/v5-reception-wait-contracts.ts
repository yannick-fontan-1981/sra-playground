/** Consumed portable domain of the pinned V5 ReceptionWaitBudgetD contract. */
import { retainNativeJson } from './v6-native-owned.ts';

export interface ReceptionWaitBudgetD {
  parent_goal_ref: string;
  parent_contribution_ref: string;
  consumer_request_ref: string;
  level_scope_ref: string;
  restore_epoch: number;
  observed_clock: number;
  maximum_total_wait_primitives: number;
  spent_wait_primitives: number;
  ledger_claim_ref: string;
}

/** This native boundary takes normalized JSON rather than Python coercions.
 * The source does not require spent <= maximum: exhaustion is a caller matter.
 * Both counters retain the source's independent closed interval [0, 128]. */
export function normalizeReceptionWaitBudget(value: unknown): Readonly<ReceptionWaitBudgetD> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Reception wait budget requires an object');
  const record = value as Record<string, unknown>;
  const refs = ['parent_goal_ref', 'parent_contribution_ref', 'consumer_request_ref', 'level_scope_ref', 'ledger_claim_ref'] as const;
  const integers = ['restore_epoch', 'observed_clock', 'maximum_total_wait_primitives', 'spent_wait_primitives'] as const;
  const fields: readonly string[] = [...refs, ...integers];
  for (const key of Object.keys(record)) if (!fields.includes(key)) throw new TypeError('Unknown reception wait field: ' + key);
  const result: Record<string, string | number> = {};
  for (const key of refs) {
    const item = record[key];
    if (typeof item !== 'string' || !item.trim()) throw new TypeError('Reception wait Ref must be a nonempty string');
    result[key] = item.trim();
  }
  for (const key of integers) {
    const item = record[key], maximum = key.endsWith('_primitives') ? 128 : Number.MAX_SAFE_INTEGER;
    if (typeof item !== 'number' || !Number.isSafeInteger(item) || Object.is(item, -0) || item < 0 || item > maximum) {
      throw new RangeError('Reception wait integer outside portable source domain: ' + key);
    }
    result[key] = item;
  }
  return retainNativeJson(result) as unknown as Readonly<ReceptionWaitBudgetD>;
}
