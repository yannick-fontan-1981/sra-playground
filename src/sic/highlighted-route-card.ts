import { digest } from '../logos-engine/canonical.ts';
import type { CompiledModule } from '../logos-engine/ir.ts';
import { situationChoiceWorkflow } from './situation-choice-workflow.ts';

const moduleId = 'sic.follow_observed_landings';
export const chooseLanding = moduleId + '.choose';

export async function landingModule(): Promise<CompiledModule> {
  const workflows = [situationChoiceWorkflow(chooseLanding, [
    { situation: 'routeSupported', strategy: 'P07' },
    { situation: 'eligibleProbe', strategy: 'P05' },
  ])];
  const hash = await digest(workflows);
  return { module_id: moduleId, source_name: 'src/sic/highlighted-route-card.ts', source_hash: hash, semantic_hash: hash, imports: [], workflows };
}
