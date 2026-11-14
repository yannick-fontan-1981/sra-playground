import { digest } from '../logos-engine/canonical.ts';
import type { CompiledModule } from '../logos-engine/ir.ts';
import { situationChoiceWorkflow } from './situation-choice-workflow.ts';

const moduleId = 'sic.transport_to_visible_target';
export const chooseTransport = moduleId + '.choose';

export async function transportModule(): Promise<CompiledModule> {
  const workflows = [situationChoiceWorkflow(chooseTransport, [
    { situation: 'release', strategy: 'test_delivery_at_frame' },
    { situation: 'pickup', strategy: 'test_transport_interaction' },
    { situation: 'carry', strategy: 'carry_toward_frame' },
    { situation: 'approach', strategy: 'approach_matching_object' },
    { situation: 'probe', strategy: 'measure_transport_control' },
  ])];
  const hash = await digest(workflows);
  return { module_id: moduleId, source_name: 'src/sic/transport-motion-card.ts', source_hash: hash, semantic_hash: hash, imports: [], workflows };
}
