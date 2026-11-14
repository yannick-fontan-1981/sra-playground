import { digest, isJsonObject } from '../logos-engine/canonical.ts';
import type { CompiledModule, IrExpression, Primitive } from '../logos-engine/ir.ts';
import { situationChoiceWorkflow } from './situation-choice-workflow.ts';

const moduleId = 'sic.resolve_observed_ambiguity';
export const chooseRevealedExample = moduleId + '.choose';
export const checkRevealedExample = moduleId + '.check_return';

const ref = (value: string): IrExpression => ({ kind: 'reference', value });
const call = (value: string, args: Record<string, IrExpression>): IrExpression => ({
  kind: 'call', value, arguments: Object.entries(args).map(([name, value]) => ({ name, value })),
});

export async function revealedExampleModule(): Promise<CompiledModule> {
  const verify = checkRevealedExample + '.verify';
  const rules = [
    { situation: 'unique', strategy: 'test_unique_catalogue_match' },
    { situation: 'next', strategy: 'change_catalogue_subject' },
    { situation: 'views', strategy: 'seek_distinguishing_view' },
  ];
  const workflows: CompiledModule['workflows'] = [situationChoiceWorkflow(chooseRevealedExample, rules), {
    id: checkRevealedExample, entry_step_id: verify, state: [],
    inputs: [{ name: 'outcome', type_spec: { name: 'Map', arguments: [] } }],
    outputs: [{ name: 'confirmed', type_spec: { name: 'Boolean', arguments: [], optional: true } }],
    steps: [{ id: verify, statements: [{
      id: verify + '.compare', kind: 'STOP', expression: call('sic.check_ambiguity_reduction', { outcome: ref('outcome') }),
    }] }],
  }];
  const hash = await digest(workflows);
  return { module_id: moduleId, source_name: 'src/sic/revealed-example-card.ts', source_hash: hash, semantic_hash: hash, imports: [], workflows };
}

const checkAmbiguityReduction: Primitive = ({ outcome }) => {
  if (!isJsonObject(outcome) || outcome.comparable !== true) return null;
  if (typeof outcome.subjectSelected === 'boolean') return outcome.subjectSelected;
  const { beforeCount, afterCount } = outcome;
  return typeof beforeCount === 'number' && typeof afterCount === 'number'
    ? afterCount > 0 && afterCount < beforeCount : null;
};

export const revealedExampleOperations = { 'sic.check_ambiguity_reduction': checkAmbiguityReduction };
