import { digest, isJsonObject } from '../logos-engine/canonical.ts';
import type { CompiledModule, IrExpression, IrStatement, Primitive } from '../logos-engine/ir.ts';

const moduleId = 'sic.resolve_observed_ambiguity';
export const chooseRevealedExample = moduleId + '.choose';
export const checkRevealedExample = moduleId + '.check_return';

const ref = (value: string): IrExpression => ({ kind: 'reference', value });
const literal = (value: string): IrExpression => ({ kind: 'string', value });
const abstain: IrExpression = { kind: 'null', value: null };
const call = (value: string, args: Record<string, IrExpression>): IrExpression => ({
  kind: 'call', value, arguments: Object.entries(args).map(([name, value]) => ({ name, value })),
});

export async function revealedExampleModule(): Promise<CompiledModule> {
  const decide = chooseRevealedExample + '.decide';
  const verify = checkRevealedExample + '.verify';
  const rules = [
    { situation: 'unique', strategy: 'test_unique_catalogue_match' },
    { situation: 'next', strategy: 'change_catalogue_subject' },
    { situation: 'views', strategy: 'seek_distinguishing_view' },
  ];
  const statements: IrStatement[] = rules.map(({ situation, strategy }) => ({
    id: decide + '.' + situation, kind: 'IF', expression: ref('situation.' + situation), body: [{
      id: decide + '.' + situation + '.select', kind: 'STOP', expression: literal(strategy),
    }],
  }));
  statements.push({ id: decide + '.abstain', kind: 'STOP', expression: abstain });
  const workflows: CompiledModule['workflows'] = [{
    id: chooseRevealedExample, entry_step_id: decide, state: [],
    inputs: [{ name: 'situation', type_spec: { name: 'Map', arguments: [] } }],
    outputs: [{ name: 'choice', type_spec: { name: 'String', arguments: [], optional: true } }],
    steps: [{ id: decide, statements }],
  }, {
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
