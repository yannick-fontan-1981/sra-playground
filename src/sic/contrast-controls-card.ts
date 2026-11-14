import { digest, isJsonObject } from '../logos-engine/canonical.ts';
import type { CompiledModule, IrExpression, JsonObject, JsonValue, Primitive } from '../logos-engine/ir.ts';

const moduleId = 'sic.contrast_controls';
export const contrastControlsWorkflow = moduleId + '.choose';
export const contrastReturnWorkflow = moduleId + '.check_return';
export const contrastNeed = 'compare_remote_control_effect';
export const contrastPrimitive = 'contrast_observed_controls';
export const contrastCheck = 'remote_indicator_changes';
const step = contrastControlsWorkflow + '.decide';
const returnStep = contrastReturnWorkflow + '.verify';
const reference = (value: string): IrExpression => ({ kind: 'reference', value });
const literal = (value: string): IrExpression => ({ kind: 'string', value });
const integer = (value: number): IrExpression => ({ kind: 'integer', value });
const list = (...items: IrExpression[]): IrExpression => ({ kind: 'list', items });
const abstain: IrExpression = { kind: 'null', value: null };
const call = (value: string, args: Record<string, IrExpression>): IrExpression => ({
  kind: 'call', value, arguments: Object.entries(args).map(([name, value]) => ({ name, value })),
});

export async function contrastControlsModule(): Promise<CompiledModule> {
  const workflows: CompiledModule['workflows'] = [{
    id: contrastControlsWorkflow, entry_step_id: step,
    inputs: [{ name: 'situation', type_spec: { name: 'Map', arguments: [] } }],
    outputs: [{ name: 'choice', type_spec: { name: 'Map', arguments: [], optional: true } }], state: [],
    steps: [{ id: step, statements: [
      { id: step + '.eligible', kind: 'IF', expression: call('sic.matches_observed_situation', {
        situation: reference('situation'), need: literal(contrastNeed),
        modes: list(literal('exploration'), literal('assimilation'), literal('solving')), minimumRemoteChanges: integer(1),
      }), body: [
        { id: step + '.contrast', kind: 'STOP', expression: call('sic.bind_candidate_experiment', {
          need: literal(contrastNeed), primitive: literal(contrastPrimitive),
          target: call('sic.rank_observed_candidates', {
            options: reference('situation.options'), measure: literal('separation'), order: literal('largest'),
          }),
          check: literal(contrastCheck), minimumChanges: integer(1),
        }) },
      ] },
      { id: step + '.initial_probe', kind: 'IF', expression: reference('situation.initialProbe'), body: [
        { id: step + '.sample', kind: 'STOP', expression: call('sic.bind_candidate_experiment', {
          need: literal(contrastNeed), primitive: literal(contrastPrimitive),
          target: call('sic.rank_observed_candidates', {
            options: reference('situation.options'), measure: literal('separation'), order: literal('smallest'),
          }),
          check: literal(contrastCheck), minimumChanges: integer(1),
        }) },
      ] },
      { id: step + '.abstain', kind: 'STOP', expression: abstain },
    ] }],
  }, {
    id: contrastReturnWorkflow, entry_step_id: returnStep,
    inputs: [{ name: 'outcome', type_spec: { name: 'Map', arguments: [] } }],
    outputs: [{ name: 'verdict', type_spec: { name: 'Boolean', arguments: [], optional: true } }], state: [],
    steps: [{ id: returnStep, statements: [
      { id: returnStep + '.compare', kind: 'STOP', expression: call('sic.check_observed_change', {
        check: reference('outcome.check'), minimumChanges: reference('outcome.minimumChanges'),
        changes: reference('outcome.changes'),
      }) },
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

const matchesObservedSituation: Primitive = ({ situation, need, modes, minimumRemoteChanges }) =>
  isJsonObject(situation) && situation.initialProbe !== true && situation.need === need && Array.isArray(modes) && modes.includes(situation.mode ?? null)
  && situation.pointOnChangedControl === true && (situation.previousControlsUniform === true || situation.continuing === true)
  && situation.changedControls === 1 && typeof situation.changedIndicators === 'number'
  && typeof minimumRemoteChanges === 'number' && situation.changedIndicators >= minimumRemoteChanges;

const bindCandidateExperiment: Primitive = ({ need, primitive, target, check, minimumChanges }) =>
  isJsonObject(target) ? { need: need!, primitive: primitive!, target, check: check!, minimumChanges: minimumChanges! } : null;

const checkObservedChange: Primitive = ({ check, minimumChanges, changes }) =>
  check === contrastCheck && typeof minimumChanges === 'number' && typeof changes === 'number' ? changes >= minimumChanges : null;

export const contrastControlOperations = {
  'sic.rank_observed_candidates': rankObservedCandidates,
  'sic.matches_observed_situation': matchesObservedSituation,
  'sic.bind_candidate_experiment': bindCandidateExperiment,
  'sic.check_observed_change': checkObservedChange,
};
