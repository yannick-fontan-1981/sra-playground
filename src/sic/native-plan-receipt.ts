import type { NativeObservation, NativeProposal, SicActionCoverage } from '../logos-engine/v6-native-types.ts';
import { readSicNeed } from './need-registry.ts';
import { missingControlWitness } from './missing-control-strategy.ts';
import type { ReasoningMode } from './reasoning-mode.ts';
import { standalonePlanningFamilies } from './ordered-contact.ts';

export interface StrategyObjective {
  readonly strategy: string;
  readonly parent: string | null;
  readonly aim: string | null;
  readonly observationRef: string;
}

const nonEmpty = (value: unknown) => typeof value === 'string' && value.trim() ? value : null;

/** Bind the selected strategy's stated aim to the plan and the observation that authorized it. */
export function nativePlanReceipt(family: string, proposal: NativeProposal, observation: NativeObservation, index: number, mode?: ReasoningMode) {
  const template = proposal.bundle_template;
  const rooted = proposal.rooted_line_plan;
  const recovery = objectField(objectField(rooted, 'search'), 'sic_decision');
  const view = objectField(proposal.sic_view_decision, 'mode') === 'active' ? proposal.sic_view_decision : undefined;
  const information = objectField(proposal.sic_information_decision, 'mode') === 'active' ? proposal.sic_information_decision : undefined;
  const standalone = standalonePlanningFamilies.includes(family) ? proposal.sicLocalDecision : undefined;
  const decision = standalone ?? recovery ?? proposal.sic_frontier_decision ?? view ?? information;
  const sicStrategy = objectField(decision, 'strategy'), sicTarget = objectField(decision, 'objective');
  const nativeTarget = objectField(template, 'objective_ref');
  const objective = nonEmpty(nativeTarget);
  const subObjective = objectField(sicTarget, 'parent') === objective ? objectField(sicTarget, 'id') : null;
  const strategy = typeof sicStrategy === 'string' ? sicStrategy : family;
  const aim = nonEmpty(objectField(proposal.question, 'reason')) ?? nonEmpty(objectField(template, 'purpose'));
  const strategyObjective: StrategyObjective | undefined = objective || aim
    ? { strategy, parent: objective, aim, observationRef: observation.observation_ref } : undefined;
  let authority: keyof SicActionCoverage = 'native';
  if (typeof sicStrategy === 'string') {
    if (standalone) authority = 'sicOnly';
    else if (recovery) authority = 'contactRecovery';
    else if (view) authority = 'viewAccess';
    else if (information) authority = 'information';
    else authority = objectField(decision, 'inputRanked') === true ? 'configurableFrontier' : 'fixedFrontier';
  }
  const command = proposal.actions[index];
  if (!command) throw new TypeError('A release receipt requires a command in the selected plan.');
  const missingControl = missingControlWitness(proposal, command.action_ref, observation.observation_ref, mode);
  const need = readSicNeed(objectField(decision, 'need'));
  const prerequisite = readSicNeed(objectField(decision, 'prerequisite'));
  return {
    id: `sic-plan:${observation.observation_ref}`, family, strategy, objective, authority,
    subObjective: typeof subObjective === 'string' ? subObjective : null,
    ...(strategyObjective ? { strategyObjective } : {}),
    ...(missingControl ? { missingControl } : {}),
    ...(need?.status === 'assigned' ? { need } : {}),
    ...(need?.status === 'assigned' && need.kind === 'observe_untried_input_effect'
      && prerequisite?.status === 'assigned' && prerequisite.kind === 'find_observable_frontier_access'
      && prerequisite.scope === need.scope && prerequisite.parentObjective === need.parentObjective ? { prerequisite } : {}),
    observationRef: observation.observation_ref, index, planned: proposal.actions.length,
    command, commands: proposal.actions,
  };
}

function objectField(value: unknown, field: string): unknown {
  return value !== null && typeof value === 'object' && Object.hasOwn(value, field)
    ? (value as Record<string, unknown>)[field] : undefined;
}
