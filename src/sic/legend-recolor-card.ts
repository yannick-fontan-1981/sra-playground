import { digest, isJsonObject } from '../logos-engine/canonical.ts';
import type { CompiledModule, IrExpression, Primitive } from '../logos-engine/ir.ts';

const moduleId = 'sic.match_visible_example';
export const matchExampleWorkflow = moduleId + '.choose';
export const checkExampleWorkflow = moduleId + '.check_return';
const reference = (value: string): IrExpression => ({ kind: 'reference', value });
const literal = (value: string): IrExpression => ({ kind: 'string', value });
const call = (value: string, args: Record<string, IrExpression>): IrExpression => ({
  kind: 'call', value, arguments: Object.entries(args).map(([name, value]) => ({ name, value })),
});

export async function matchExampleModule(): Promise<CompiledModule> {
  const chooseStep = matchExampleWorkflow + '.decide', checkStep = checkExampleWorkflow + '.verify';
  const workflows: CompiledModule['workflows'] = [{
    id: matchExampleWorkflow, entry_step_id: chooseStep,
    inputs: [{ name: 'situation', type_spec: { name: 'Map', arguments: [] } }],
    outputs: [{ name: 'choice', type_spec: { name: 'Map', arguments: [], optional: true } }], state: [],
    steps: [{ id: chooseStep, statements: [
      { id: chooseStep + '.reuse', kind: 'IF', expression: reference('situation.hasReadyRegion'), body: [
        { id: chooseStep + '.apply', kind: 'STOP', expression: call('sic.select_example_interaction', {
          candidates: reference('situation.ready'), strategy: literal('apply_legend_pigment'),
        }) },
      ] },
      { id: chooseStep + '.select', kind: 'STOP', expression: call('sic.select_example_interaction', {
        candidates: reference('situation.pending'), strategy: literal('acquire_legend_pigment'),
      }) },
    ] }],
  }, {
    id: checkExampleWorkflow, entry_step_id: checkStep,
    inputs: [{ name: 'outcome', type_spec: { name: 'Map', arguments: [] } }],
    outputs: [{ name: 'confirmed', type_spec: { name: 'Boolean', arguments: [] } }], state: [],
    steps: [{ id: checkStep, statements: [
      { id: checkStep + '.preserved', kind: 'IF', expression: reference('outcome.preserved'), body: [
        { id: checkStep + '.matched', kind: 'STOP', expression: reference('outcome.expectedValueObserved') },
      ] },
      { id: checkStep + '.contradicted', kind: 'STOP', expression: { kind: 'boolean', value: false } },
    ] }],
  }];
  const hash = await digest(workflows);
  return { module_id: moduleId, source_name: 'src/sic/legend-recolor-card.ts', source_hash: hash, semantic_hash: hash, imports: [], workflows };
}

const selectExampleInteraction: Primitive = ({ candidates, strategy }) => {
  const candidate = Array.isArray(candidates) ? candidates[0] : null;
  return isJsonObject(candidate) && typeof strategy === 'string' ? { candidate, strategy } : null;
};

export const matchExampleOperations = { 'sic.select_example_interaction': selectExampleInteraction };
