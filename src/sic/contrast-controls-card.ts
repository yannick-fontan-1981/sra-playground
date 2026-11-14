import { digest, isJsonObject } from '../logos-engine/canonical.ts';
import type { CompiledModule, IrExpression, JsonObject, JsonValue, Primitive } from '../logos-engine/ir.ts';

const moduleId = 'sic.contrast_controls';
export const contrastControlsWorkflow = moduleId + '.choose';
const step = contrastControlsWorkflow + '.decide';
const reference = (value: string): IrExpression => ({ kind: 'reference', value });
const literal = (value: string): IrExpression => ({ kind: 'string', value });
const call = (value: string, args: Record<string, IrExpression>): IrExpression => ({
  kind: 'call', value, arguments: Object.entries(args).map(([name, value]) => ({ name, value })),
});

export async function contrastControlsModule(): Promise<CompiledModule> {
  const workflows: CompiledModule['workflows'] = [{
    id: contrastControlsWorkflow, entry_step_id: step,
    inputs: [{ name: 'situation', type_spec: { name: 'Map', arguments: [] } }],
    outputs: [{ name: 'choice', type_spec: { name: 'Map', arguments: [], optional: true } }], state: [],
    steps: [{ id: step, statements: [
      { id: step + '.eligible', kind: 'IF', expression: reference('situation.eligible'), body: [
        { id: step + '.contrast', kind: 'STOP', expression: call('sic.rank_observed_candidates', {
          options: reference('situation.options'), measure: literal('separation'), order: literal('largest'),
        }) },
      ] },
      { id: step + '.abstain', kind: 'STOP', expression: { kind: 'null', value: null } },
    ] }],
  }];
  const hash = await digest(workflows);
  return { module_id: moduleId, source_name: 'src/sic/contrast-controls-card.ts', source_hash: hash, semantic_hash: hash, imports: [], workflows };
}

const rankObservedCandidates: Primitive = ({ options, measure, order }): JsonValue => {
  if (!Array.isArray(options) || typeof measure !== 'string' || (order !== 'largest' && order !== 'smallest')) return null;
  let best: JsonObject | null = null;
  let bestScore = order === 'largest' ? -Infinity : Infinity;
  for (const option of options) {
    if (!isJsonObject(option)) continue;
    const score = option[measure];
    if (typeof score !== 'number' || !Number.isFinite(score)) continue;
    if (order === 'largest' ? score > bestScore : score < bestScore) {
      best = option;
      bestScore = score;
    }
  }
  return best;
};

export const contrastControlOperations = { 'sic.rank_observed_candidates': rankObservedCandidates };
