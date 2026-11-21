import { sicNeedId } from './need-identity.ts';

export const informationStrategies = {
  point_contrast: 'Compare competing explanations for a clicked feature',
  coupled_displays: 'Measure which displays respond together',
  motion_contrast: 'Test competing predictions for a movement',
  paired_arrival: 'Compare selection before and after a subject reaches a repeated landmark',
  indicated_access: 'Seek an indication at a traversable site when ordinary movement fails to reach a destination',
  plan_after_selection: 'Use a verified change of control to plan a placement and test the return to the previous subject',
  test_partner_preparation: 'Retest a blocked movement after changing the other subject’s placement',
  bind_earlier_motions_to_registered_subjects: 'Recover witnessed movements after subject registration and reuse them to plan a continuous crossing',
  compose_a_sustained_crossing: 'Compose a maintained opening, chained displacements and successive changes in traversable terrain',
  prefer_a_verified_coverage_experiment: 'Give a grounded placement experiment or its verified continuation priority over independent exploration',
  prepare_a_contact_stance: 'Plan the approach to a pushing or pulling position that makes a required placement feasible',
  test_contact_on_another_subject: 'Extend a witnessed displacement mechanism to another subject and test the contact',
  maintain_access_by_composing_piece_effects: 'Choose a subject and movement to maintain access with the displaced pieces',
  follow_a_marked_displacement: 'Verify a marked subject across a change of pose and surrounding objects',
  verify_control_across_pose_changes: 'Keep testing a transferred mark when the selected subject changes pose in place',
  challenge_recurrent_placements: 'Test control transfer when a placement repeatedly produces the same return',
  compose_transport_by_region: 'Prepare each region needed to connect observed transport mechanisms',
  compose_observed_transports: 'Compose observed exchanges, object displacement and changes of walkable terrain',
  transfer_registered_footing: 'Test a footing occupied in a corresponding layout while preparing indicated arrivals',
  prepare_joint_arrivals: 'Prepare a shared operation for multiple indicated destinations',
  reclassify_displaced_goal: 'Revise a destination after observing that the subject pushed it',
} as const;

export type InformationStrategy = keyof typeof informationStrategies;

export function isInformationStrategy(source: unknown): source is InformationStrategy {
  return typeof source === 'string' && Object.hasOwn(informationStrategies, source);
}

/** The observation producer supplies candidates in its evidence-qualified order.
 * Admission stays lazy because testing another offer may retain an attention obligation. */
export async function selectInformationStrategy<Offer, Receipt extends { readonly source?: unknown }, Plan>(
  ordered: Iterable<readonly [Offer, Receipt]>, plan: (offer: Offer, receipt: Receipt) => Promise<Plan | null>) {
  const considered: { strategy: InformationStrategy; result: 'selected' | 'no_plan' }[] = [];
  for (const [offer, receipt] of ordered) {
    const result = await plan(offer, receipt);
    if (isInformationStrategy(receipt.source)) {
      if (considered.length >= 12) considered.shift();
      considered.push({ strategy: receipt.source, result: result ? 'selected' : 'no_plan' });
    }
    if (result) return { plan: result, considered };
  }
  return { plan: null, considered };
}

export function informationNeed(observationRef: string, parentObjective: string, subjects: readonly string[], evidence: readonly string[]) {
  const identity = { kind: 'distinguish_public_hypotheses', scope: observationRef.split(':revision:', 1)[0]!,
    subjects, parentObjective, satisfactionContract: 'measure_a_return_that_separates_competing_predictions' } as const;
  return { ...identity, id: sicNeedId(identity), evidence, status: 'assigned' as const };
}
