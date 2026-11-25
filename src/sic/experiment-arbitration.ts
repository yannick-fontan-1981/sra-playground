import type { Experiment, Memory } from './preparation-experiments.ts';
import type { LocalForecast } from './prospective-local-use.ts';

export const coveragePlanGroup='test_or_continue_a_grounded_coverage_plan';
export const evidencedPlanGroup = 'continue_or_test_a_witnessed_effect';
export const transferredPreviewGroup = 'revalidate_transferred_preview_after_grounded_mechanics';
export const recurrentExperimentGroup = 'experiment_after_unproductive_returns';

function usesTransferredPreview(experiment: Pick<Experiment, 'witnessedPreview'> | null): boolean {
  return experiment?.witnessedPreview?.basis === 'observed_in_previous_level';
}

export function requiresPreviewRevalidation(experiment: Pick<Experiment, 'rule' | 'witnessedPreview'> | null): boolean {
  // A cue just rediscovered by an active search already has a current return.
  const preview = experiment?.witnessedPreview;
  if (preview?.basis !== 'observed_in_previous_level' || experiment?.rule === 'use_the_rediscovered_cue') return false;
  const { from, indicated, witness } = preview;
  const dx = Math.abs(indicated[0] - from[0]), dy = Math.abs(indicated[1] - from[1]);
  const oldDx = Math.abs(witness.indicated[0] - witness.from[0]), oldDy = Math.abs(witness.indicated[1] - witness.from[1]);
  // The shape and the command are already matched. Preserve priority when the
  // relative positions also match through a translation or an orthogonal symmetry.
  return !(dx === oldDx && dy === oldDy || dx === oldDy && dy === oldDx);
}
/** A negative control at the current placement is evidence for the question,
 * but the proposed preparation still comes from a different placement. */
export function isUnwitnessedDirectionalPreparation(forecast: Pick<LocalForecast,
  'stage' | 'origin' | 'training' | 'revised' | 'observedPrefix' | 'a' | 'b' | 'c'> | undefined): boolean {
  return forecast?.stage === 'prepare' && forecast.origin !== forecast.training
    && !forecast.revised && !forecast.observedPrefix
    && [forecast.a, forecast.b, forecast.c].every(command => /^ACTION[1-4]$/.test(command));
}

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

export function mayPursueWitnessedEffect(m: Memory): boolean {
  if(m.localCapacity?.pending||m.localCapacity?.retained||m.previewLearning?.cueSearch?.seeking)return true;
  // Give the current strategy a chance to continue after opening a new public state.
  if (m.turns && m.frontier.lastScene === m.turns && m.lastTrial !== m.turns) return false;
  return !!m.localProgress?.active || !!m.previewLearning?.terminal?.length
    || Object.values(m.previewLearning?.bindings ?? {}).some(binding =>
      binding.witnesses.length >= 2 || binding.witnesses.some(witness => witness.epoch !== m.epoch));
}

export function witnessedObjective(x: Experiment): boolean {
  if(x.relative)return true;
  if (x.cue) return x.cue.blocked.length>=2;
  if (x.localCapacity && x.localCapacity.stage!=='control')return true;
  if (x.terminalContact?.preparationKey) return !!x.terminalContact.blockedGoal;
  if ((x.terminalContact?.distance === 1 && x.terminalContact.currentMotionWitness && x.phase !== 'testScoringContact')
    || usesTransferredPreview(x)) return true;
  const trial = x.mechanism;
  return !!trial?.plan.arrival && (trial.cause.tag === 'projected_access_limit' || trial.index > 0);
}
