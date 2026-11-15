import { digest } from '../logos-engine/canonical.ts';
import type { CompiledModule } from '../logos-engine/ir.ts';
import type { ReasoningMode } from './reasoning-mode.ts';
import { situationChoiceWorkflow } from './situation-choice-workflow.ts';

const moduleId = 'sic.choose_from_observed_feedback';
export const chooseFromFeedback = moduleId + '.choose';
export const feedbackChoiceStrategies = {
  P02: 'Reuse a control or relation supported by earlier feedback',
  P05: 'Test a visible cue or a trial that can resolve uncertainty',
};
const emptyFacts = {
  pointedCueNeedsTest: false,
  modelMatchNeedsTest: false,
  feedbackSupportsOneChoice: false,
  trialCanClarifyAlternatives: false,
  firstSubmissionNeedsFeedback: false,
  submissionControlObserved: false,
};

export function feedbackChoiceFacts(mode: ReasoningMode, facts: Partial<typeof emptyFacts>) {
  return { ...emptyFacts, ...facts, mode };
}

export async function feedbackChoiceModule(): Promise<CompiledModule> {
  const workflows = [situationChoiceWorkflow(chooseFromFeedback, [
    { situation: 'pointedCueNeedsTest', strategy: 'P05' },
    { situation: 'feedbackSupportsOneChoice', strategy: 'P02' },
    { situation: 'submissionControlObserved', strategy: 'P02' },
    { situation: 'trialCanClarifyAlternatives', strategy: 'P05' },
    { situation: 'firstSubmissionNeedsFeedback', strategy: 'P05' },
    { situation: 'modelMatchNeedsTest', strategy: 'P05' },
  ])];
  const hash = await digest(workflows);
  return { module_id: moduleId, source_name: 'src/sic/feedback-choice-card.ts', source_hash: hash,
    semantic_hash: hash, imports: [], workflows };
}
