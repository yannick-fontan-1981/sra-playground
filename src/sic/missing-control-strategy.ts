import type { NativeProposal } from '../logos-engine/v6-native-types.ts';

export const missingControlLabel = 'Test an input needed by the retained method';
export const missingControlStrategy = 'test_missing_control';
export const missingControlNeed = 'establish_control_effect_for_current_objective';

export interface MissingControlSituation {
  readonly observationRef: string;
  readonly availableActions: readonly string[];
  readonly objectiveSupported: boolean;
  readonly effectKnown: boolean;
  readonly triedInContext: boolean;
  readonly evidence: readonly string[];
}

export interface MissingControlWitness {
  readonly id: typeof missingControlStrategy;
  readonly need: typeof missingControlNeed;
  readonly observationRef: string;
  readonly action: string;
  readonly evidence: readonly string[];
}

type TrialProposal = { readonly actions: readonly { readonly action_ref: string }[];
  readonly binding?: Readonly<Record<string, unknown>> };

export function* unmeasuredControls(order: Iterable<string>, available: readonly string[],
  measured: (action: string) => boolean): IterableIterator<string> {
  const admitted = new Set(available);
  for (const action of order) if (admitted.has(action) && !measured(action)) yield action;
}

const trials = new WeakMap<object, MissingControlWitness>();

/** Families supply observations that establish the same need in their current context. */
export function bindMissingControlTrial(proposal: TrialProposal, situation: MissingControlSituation): void {
  const [command] = proposal.actions;
  if (proposal.actions.length !== 1 || !command || !situation.objectiveSupported
    || situation.effectKnown || situation.triedInContext || !situation.availableActions.includes(command.action_ref)
    || proposal.binding?.observation_ref !== situation.observationRef || !situation.evidence.includes(situation.observationRef)) return;
  trials.set(proposal, { id: missingControlStrategy, need: missingControlNeed, action: command.action_ref,
    observationRef: situation.observationRef, evidence: [...new Set(situation.evidence)] });
}

export function missingControlWitness(proposal: NativeProposal, action: string, observationRef: string): MissingControlWitness | undefined {
  const trial = trials.get(proposal);
  return trial?.action === action && trial.observationRef === observationRef ? trial : undefined;
}

export function retainMissingControlTrial(proposal: object, copy: object): void {
  const trial = trials.get(proposal);
  if (trial) trials.set(copy, trial);
}
