import type { NativeObservation, NativeProposal, SicActionCoverage } from '../logos-engine/v6-native-types.ts';

/** Project the selected native plan at its release boundary. */
export function nativePlanReceipt(family: string, proposal: NativeProposal, observation: NativeObservation, index: number) {
  const template = proposal.bundle_template;
  const rooted = proposal.rooted_line_plan;
  const recovery = objectField(objectField(rooted, 'search'), 'sic_decision');
  const view = objectField(proposal.sic_view_decision, 'mode') === 'active' ? proposal.sic_view_decision : undefined;
  const information = objectField(proposal.sic_information_decision, 'mode') === 'active' ? proposal.sic_information_decision : undefined;
  const decision = recovery ?? proposal.sic_frontier_decision ?? view ?? information;
  const sicStrategy = objectField(decision, 'strategy'), sicTarget = objectField(decision, 'objective');
  const nativeTarget = objectField(template, 'objective_ref');
  const objective = typeof nativeTarget === 'string' && nativeTarget.length > 0 ? nativeTarget : null;
  const subObjective = objectField(sicTarget, 'parent') === objective ? objectField(sicTarget, 'id') : null;
  const strategy = typeof sicStrategy === 'string' ? sicStrategy : family;
  let authority: keyof SicActionCoverage = 'native';
  if (typeof sicStrategy === 'string') {
    if (recovery) authority = 'contactRecovery';
    else if (view) authority = 'viewAccess';
    else if (information) authority = 'information';
    else authority = objectField(decision, 'inputRanked') === true ? 'configurableFrontier' : 'fixedFrontier';
  }
  const command = proposal.actions[index];
  if (!command) throw new TypeError('A release receipt requires a command in the selected plan.');
  return {
    id: `sic-plan:${observation.observation_ref}`, family, strategy, objective, authority,
    subObjective: typeof subObjective === 'string' ? subObjective : null,
    observationRef: observation.observation_ref, index, planned: proposal.actions.length,
    command, commands: proposal.actions,
  };
}

function objectField(value: unknown, field: string): unknown {
  return value !== null && typeof value === 'object' && Object.hasOwn(value, field)
    ? (value as Record<string, unknown>)[field] : undefined;
}
