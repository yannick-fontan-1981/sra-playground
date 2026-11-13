import type { NativeObservation, NativeProposal } from '../logos-engine/v6-native-types.ts';

/** Project the selected native plan at its release boundary. */
export function nativePlanReceipt(family: string, proposal: NativeProposal, observation: NativeObservation, index: number) {
  const template = proposal.bundle_template;
  const rooted = proposal.rooted_line_plan;
  const decision = objectField(objectField(rooted, 'search'), 'sic_decision') ?? proposal.sic_frontier_decision;
  const sicStrategy = objectField(decision, 'strategy'), sicTarget = objectField(decision, 'objective');
  const nativeTarget = objectField(template, 'objective_ref');
  const objective = typeof nativeTarget === 'string' && nativeTarget.length > 0 ? nativeTarget : null;
  const subObjective = objectField(sicTarget, 'parent') === objective ? objectField(sicTarget, 'id') : null;
  const strategy = typeof sicStrategy === 'string' ? sicStrategy : family;
  const command = proposal.actions[index];
  if (!command) throw new TypeError('A release receipt requires a command in the selected plan.');
  return {
    id: `sic-plan:${observation.observation_ref}`, family, strategy, objective,
    subObjective: typeof subObjective === 'string' ? subObjective : null,
    observationRef: observation.observation_ref, index, planned: proposal.actions.length,
    command, commands: proposal.actions,
  };
}

function objectField(value: unknown, field: string): unknown {
  return value !== null && typeof value === 'object' && Object.hasOwn(value, field)
    ? (value as Record<string, unknown>)[field] : undefined;
}
