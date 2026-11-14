import { digest } from '../logos-engine/canonical.ts';
import type { CompiledModule } from '../logos-engine/ir.ts';
import { situationChoiceWorkflow } from './situation-choice-workflow.ts';

const moduleId = 'sic.align_with_observed_receiver';
export const chooseReception = moduleId + '.choose';

export async function receptionMotionModule(): Promise<CompiledModule> {
  const workflows = [situationChoiceWorkflow(chooseReception, [
    { situation: 'orientation', strategy: 'orient_toward_mismatched_piece' },
    { situation: 'route', strategy: 'approach_reception_slots' },
    { situation: 'test', strategy: 'measure_reception_displacement' },
  ])];
  const hash = await digest(workflows);
  return { module_id: moduleId, source_name: 'src/sic/reception-motion-card.ts', source_hash: hash, semantic_hash: hash, imports: [], workflows };
}
