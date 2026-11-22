import { isInformationStrategy, type InformationStrategy } from './information-strategy.ts';

export interface InformationPreference {
  readonly mode: 'shadow' | 'active';
  readonly strategy: InformationStrategy;
  readonly minimumOutcomes: number;
  readonly mechanismRefutationLimit?: number;
  readonly motorExperiment?: 'measure_positional_baseline';
  readonly fieldRegistration?: 'test_aligned_fragments_after_motion';
}

export function compileInformationPreference(input: unknown): InformationPreference {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(key => !['minimumOutcomes','mode','strategy','mechanismRefutationLimit','fieldRegistration','motorExperiment'].includes(key))) {
    throw new TypeError('The information preference requires a strategy, a mode and a minimum number of predicted outcomes.');
  }
  const { mode, strategy, minimumOutcomes, mechanismRefutationLimit, fieldRegistration, motorExperiment } = input as Record<string, unknown>;
  if ((mode !== 'shadow' && mode !== 'active') || !isInformationStrategy(strategy)
    || typeof minimumOutcomes !== 'number' || !Number.isSafeInteger(minimumOutcomes) || minimumOutcomes < 2 || minimumOutcomes > 64) {
    throw new TypeError('Select a registered information strategy, an execution mode and 2–64 distinct predicted outcomes.');
  }
  if (mechanismRefutationLimit !== undefined && (typeof mechanismRefutationLimit !== 'number' ||
      !Number.isSafeInteger(mechanismRefutationLimit) || mechanismRefutationLimit < 1 || mechanismRefutationLimit > 64)) {
    throw new TypeError('The number of identical conflicting mechanism returns must be between 1 and 64.');
  }
  if (motorExperiment !== undefined && motorExperiment !== 'measure_positional_baseline')
    throw new TypeError('Unrecognized motor experiment.');
  if (fieldRegistration !== undefined && fieldRegistration !== 'test_aligned_fragments_after_motion')
    throw new TypeError('Unrecognized field registration hypothesis.');
  return Object.freeze({ mode, strategy, minimumOutcomes, ...(mechanismRefutationLimit === undefined ? {} : {mechanismRefutationLimit}),
    ...(motorExperiment === undefined ? {} : {motorExperiment}),
    ...(fieldRegistration === undefined ? {} : {fieldRegistration}) });
}

export interface InformationOfferSummary {
  readonly strategy: InformationStrategy;
  readonly distinctOutcomes: number;
}

export function informationPriority(offer: InformationOfferSummary, preference: InformationPreference) {
  const prepared=['paired_arrival','indicated_access','plan_after_selection','test_partner_preparation','reclassify_displaced_goal','prepare_joint_arrivals','transfer_registered_footing','compose_observed_transports','compose_transport_by_region','challenge_recurrent_placements','verify_control_across_pose_changes','follow_a_marked_displacement','maintain_access_by_composing_piece_effects','test_contact_on_another_subject','prepare_a_contact_stance','prefer_a_verified_coverage_experiment','compose_a_sustained_crossing','bind_earlier_motions_to_registered_subjects','learn_the_scope_of_a_control','test_an_unresponsive_input_after_preparation','learn_control_within_one_room'].includes(preference.strategy);
  const matches=offer.strategy===preference.strategy ||
    ((prepared || preference.strategy==='test_what_moves_after_a_conditional_change' || preference.strategy==='retest_a_conditional_control_after_transport') && offer.strategy==='motion_contrast');
  return matches && offer.distinctOutcomes >= preference.minimumOutcomes ? 1 : 0;
}
