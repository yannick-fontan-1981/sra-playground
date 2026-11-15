import { digest } from '../logos-engine/canonical.ts';
import type { CompiledModule } from '../logos-engine/ir.ts';
import { situationChoiceWorkflow } from './situation-choice-workflow.ts';

const moduleId = 'sic.follow_visible_instruction';
export const chooseVisibleInstruction = moduleId + '.choose';
export const visibleInstructionRules = {
  deliver_matching_symbol: 'request',
  apply_indicated_transformation: 'operation',
  load_indicated_operand: 'operand',
  select_indicated_symbol: 'selectable',
} as const;
export type VisibleInstruction = keyof typeof visibleInstructionRules;

export async function visibleInstructionModule(): Promise<CompiledModule> {
  const workflows = [situationChoiceWorkflow(chooseVisibleInstruction,
    Object.entries(visibleInstructionRules).map(([strategy, situation]) => ({ situation, strategy })))];
  const hash = await digest(workflows);
  return { module_id: moduleId, source_name: 'src/sic/visible-instruction-card.ts', source_hash: hash, semantic_hash: hash, imports: [], workflows };
}
