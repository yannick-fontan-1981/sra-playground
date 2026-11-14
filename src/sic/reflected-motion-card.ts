import { digest } from '../logos-engine/canonical.ts';
import type { CompiledModule } from '../logos-engine/ir.ts';
import { situationChoiceWorkflow } from './situation-choice-workflow.ts';

const moduleId = 'sic.coordinate_observed_motion';
export const chooseObservedMotion = moduleId + '.choose';
export const checkObservedMotion = moduleId + '.check_return';

export async function observedMotionModule(): Promise<CompiledModule> {
  const verify = checkObservedMotion + '.verify';
  const workflows: CompiledModule['workflows'] = [
    situationChoiceWorkflow(chooseObservedMotion, [
      { situation: 'move', strategy: 'place_reflected_contributor' },
      { situation: 'select', strategy: 'select_reflected_contributor' },
      { situation: 'test', strategy: 'test_reflected_displacement' },
    ]), {
      id: checkObservedMotion, entry_step_id: verify, state: [],
      inputs: [{ name: 'outcome', type_spec: { name: 'Map', arguments: [] } }],
      outputs: [{ name: 'confirmed', type_spec: { name: 'Boolean', arguments: [], optional: true } }],
      steps: [{ id: verify, statements: [{
        id: verify + '.compare', kind: 'STOP', expression: { kind: 'reference', value: 'outcome.matched' },
      }] }],
    },
  ];
  const hash = await digest(workflows);
  return { module_id: moduleId, source_name: 'src/sic/reflected-motion-card.ts', source_hash: hash, semantic_hash: hash, imports: [], workflows };
}
