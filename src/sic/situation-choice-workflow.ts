import type { IrStatement, IrWorkflow } from '../logos-engine/ir.ts';

export function situationChoiceWorkflow(id: string, rules: readonly { situation: string; strategy: string }[]): IrWorkflow {
  const decide = id + '.decide';
  const statements: IrStatement[] = rules.map(({ situation, strategy }) => ({
    id: decide + '.' + situation, kind: 'IF', expression: { kind: 'reference', value: 'situation.' + situation },
    body: [{ id: decide + '.' + situation + '.select', kind: 'STOP', expression: { kind: 'string', value: strategy } }],
  }));
  statements.push({ id: decide + '.abstain', kind: 'STOP', expression: { kind: 'null', value: null } });
  return {
    id, entry_step_id: decide, state: [],
    inputs: [{ name: 'situation', type_spec: { name: 'Map', arguments: [] } }],
    outputs: [{ name: 'choice', type_spec: { name: 'String', arguments: [], optional: true } }],
    steps: [{ id: decide, statements }],
  };
}
