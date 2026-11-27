import type { NativeProposal } from '../logos-engine/v6-native-types.ts';
import { qualifyControlTrial, type ControlTrialContext } from './control-effect-next.ts';
import type { AgendaEntry } from './strategy-agenda.ts';
import { controlEffectTrigger, type ControlEffectTrigger } from './control-effect-trigger.ts';
import type { ReasoningMode } from './reasoning-mode.ts';

export const missingControlStrategy = 'test_missing_control';
export const missingControlNeed = 'establish_control_effect_for_current_objective';
export const missingControlLabel = 'Test an input needed by the retained method';

export interface MissingControlSituation extends ControlTrialContext {
  readonly priorEffect?: string;
  readonly planDependency?: string;
}

export interface MissingControlWitness {
  readonly id: typeof missingControlStrategy;
  readonly need: typeof missingControlNeed;
  readonly observationRef: string;
  readonly action: string;
  readonly evidence: readonly string[];
  readonly agenda?: AgendaEntry<typeof missingControlStrategy>;
  readonly trigger?: ControlEffectTrigger;
}

type TrialProposal = { readonly actions: readonly { readonly action_ref: string }[];
  readonly binding?: Readonly<Record<string, unknown>> };

export function* unmeasuredControls(order: Iterable<string>, available: readonly string[],
  measured: (action: string) => boolean): IterableIterator<string> {
  const admitted = new Set(available);
  for (const action of order) if (admitted.has(action) && !measured(action)) yield action;
}

const trials = new WeakMap<object, MissingControlWitness & Pick<MissingControlSituation, 'priorEffect' | 'planDependency'>>();

/** Families supply observations that establish the same need in their current context. */
export function bindMissingControlTrial(proposal: TrialProposal, situation: MissingControlSituation): void {
  const [command] = proposal.actions;
  if (proposal.actions.length !== 1 || !command) return;
  const assessment = evaluateMissingControl(proposal, command.action_ref, situation);
  if (assessment.result === 'selected') trials.set(proposal, { id: missingControlStrategy, need: missingControlNeed,
    action: command.action_ref, observationRef: situation.observationRef, evidence: assessment.evidence ?? [], agenda: assessment,
    priorEffect: situation.priorEffect, planDependency: situation.planDependency });
}

export function evaluateMissingControl(proposal: TrialProposal, action: string, situation: MissingControlSituation): AgendaEntry<typeof missingControlStrategy> {
  const entry = qualifyControlTrial(proposal, action, proposal.binding?.observation_ref, situation);
  return { ...entry, id: missingControlStrategy };
}

export function missingControlWitness(proposal: NativeProposal, action: string, observationRef: string, mode?: ReasoningMode): MissingControlWitness | undefined {
  const trial = trials.get(proposal);
  if (trial?.action !== action || trial.observationRef !== observationRef) return undefined;
  const { priorEffect, planDependency, ...witness } = trial;
  return { ...witness, ...(mode ? { trigger: controlEffectTrigger(mode, { current: observationRef, priorEffect, planDependency, evidence: witness.evidence }) } : {}) };
}

export function retainMissingControlTrial(proposal: object, copy: object): void {
  const trial = trials.get(proposal);
  if (trial) trials.set(copy, trial);
}
