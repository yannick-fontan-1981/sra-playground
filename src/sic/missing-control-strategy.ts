import type { NativeProposal } from '../logos-engine/v6-native-types.ts';
import { missingControlGraph, missingControlNeed, missingControlStrategy } from './missing-control-graph.ts';
import { resolveStrategyGraph, type AgendaEntry, type StrategyFact } from './strategy-agenda.ts';
export { missingControlLabel, missingControlNeed, missingControlStrategy } from './missing-control-graph.ts';

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
  readonly agenda?: AgendaEntry<typeof missingControlStrategy>;
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
  if (proposal.actions.length !== 1 || !command) return;
  const assessment = evaluateMissingControl(proposal, command.action_ref, situation);
  if (assessment.result === 'selected') trials.set(proposal, { id: missingControlStrategy, need: missingControlNeed,
    action: command.action_ref, observationRef: situation.observationRef, evidence: assessment.evidence ?? [], agenda: assessment });
}

export function evaluateMissingControl(proposal: TrialProposal, action: string, situation: MissingControlSituation) {
  const current = proposal.binding?.observation_ref === situation.observationRef && situation.evidence.includes(situation.observationRef);
  const evidence: [string, ...string[]] = [situation.observationRef, ...situation.evidence.filter(ref => ref !== situation.observationRef)];
  const fact = (value: boolean): StrategyFact => current ? { value, evidence } : { value: 'unknown' };
  const assessment = resolveStrategyGraph({
    graph: missingControlGraph, mode: 'active',
    facts: { currentObservation: current ? { value: true, evidence } : { value: 'unknown' },
      supportedObjective: fact(situation.objectiveSupported), availableControl: fact(situation.availableActions.includes(action)),
      knownEffect: fact(situation.effectKnown), alreadyTried: fact(situation.triedInContext) },
    planners: { [missingControlStrategy]: () => true },
  });
  return assessment.entries[0]!;
}

export function missingControlWitness(proposal: NativeProposal, action: string, observationRef: string): MissingControlWitness | undefined {
  const trial = trials.get(proposal);
  return trial?.action === action && trial.observationRef === observationRef ? trial : undefined;
}

export function retainMissingControlTrial(proposal: object, copy: object): void {
  const trial = trials.get(proposal);
  if (trial) trials.set(copy, trial);
}
