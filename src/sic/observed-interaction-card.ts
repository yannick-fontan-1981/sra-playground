import { digest } from '../logos-engine/canonical.ts';
import type { CompiledModule } from '../logos-engine/ir.ts';
import { situationChoiceWorkflow } from './situation-choice-workflow.ts';

const moduleId = 'sic.verify_observed_interaction';
export const chooseInteraction = moduleId + '.choose';

export async function interactionModule(): Promise<CompiledModule> {
  const workflows = [situationChoiceWorkflow(chooseInteraction, [
    { situation: 'repeatSupportedInteraction', strategy: 'P02' },
    { situation: 'probeNeededInteraction', strategy: 'P05' },
  ])];
  const hash = await digest(workflows);
  return { module_id: moduleId, source_name: 'src/sic/observed-interaction-card.ts', source_hash: hash, semantic_hash: hash, imports: [], workflows };
}
