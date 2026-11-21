import type { Experiment, Memory } from './preparation-experiments.ts';

export const evidencedPlanGroup = 'continue_or_test_a_witnessed_effect';
export const recurrentExperimentGroup = 'experiment_after_unproductive_returns';

export type ReturnHistory = {
  repeatedChanges: number;
  recent: { repeated: boolean; returned: boolean }[];
};

export function recordReturn(history: ReturnHistory, repeated: boolean, returned: boolean) {
  if (repeated) history.repeatedChanges++;
  history.recent.push({ repeated, returned });
  if (history.recent.length > 8) history.recent.shift();
}

export function hasExperimentOpportunity(m: Memory): boolean {
  const history = m.returnHistory;
  if (!history || m.frontier.lastScene === m.turns) return false;
  return (history.repeatedChanges >= 3 && history.recent.some(step => step.repeated))
    || (m.recurrences >= 6 && history.recent.filter(step => step.returned).length >= 2);
}

export function mayPursueWitnessedEffect(m: Memory, frame?: string): boolean {
  if (frame && m.previewLearning?.pendingSourceContact?.frame===frame) return true;
  if(m.localCapacity?.pending||m.localCapacity?.retained)return true;
  // Give the current strategy a chance to continue after opening a new public state.
  if (m.turns && m.frontier.lastScene === m.turns && m.lastTrial !== m.turns) return false;
  return !!m.localProgress?.active || !!m.previewLearning?.terminal?.length
    || Object.values(m.previewLearning?.bindings ?? {}).some(binding =>
      binding.witnesses.length >= 2 || binding.witnesses.some(witness => witness.epoch !== m.epoch));
}

export function witnessedObjective(x: Experiment): boolean {
  if (x.localCapacity && x.localCapacity.stage!=='control')return true;
  if (x.terminalContact || x.witnessedPreview?.basis === 'observed_in_previous_level') return true;
  const trial = x.mechanism;
  return !!trial?.plan.arrival && (trial.cause.tag === 'projected_access_limit' || trial.index > 0);
}
