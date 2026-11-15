import { digest } from '../logos-engine/canonical.ts';
import type { CompiledModule } from '../logos-engine/ir.ts';
import type { ReasoningMode } from './reasoning-mode.ts';
import { situationChoiceWorkflow } from './situation-choice-workflow.ts';

const moduleId = 'sic.apply_verified_configuration';
export const choosePreparedConfiguration = moduleId + '.choose';
export const preparedConfigurationStrategies = {
  P02: 'Reuse an observed control with the verified configuration',
  P05: 'Test a configuration change or its application',
};
const initialFacts = {
  readyWithKnownApplication: false,
  pendingWithKnownEdit: false,
  readyForFirstApplication: false,
  pendingWithUntestedEdit: false,
  needsApplicationObservation: false,
};

export function preparedConfigurationFacts(mode: ReasoningMode, facts: Partial<typeof initialFacts>) {
  return { ...initialFacts, ...facts, mode };
}

export async function preparedConfigurationModule(): Promise<CompiledModule> {
  const workflows = [situationChoiceWorkflow(choosePreparedConfiguration, [
    { situation: 'readyWithKnownApplication', strategy: 'P02' },
    { situation: 'pendingWithKnownEdit', strategy: 'P02' },
    { situation: 'readyForFirstApplication', strategy: 'P05' },
    { situation: 'pendingWithUntestedEdit', strategy: 'P05' },
    { situation: 'needsApplicationObservation', strategy: 'P05' },
  ])];
  const hash = await digest(workflows);
  return { module_id: moduleId, source_name: 'src/sic/prepared-configuration-card.ts', source_hash: hash,
    semantic_hash: hash, imports: [], workflows };
}
