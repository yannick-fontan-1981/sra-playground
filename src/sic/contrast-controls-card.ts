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
export type ContrastCardSettings = {
  readonly minimumRemoteChanges: number;
  readonly order: 'largest' | 'smallest';
  readonly minimumChanges: number;
};
export const defaultContrastCardSettings: ContrastCardSettings = { minimumRemoteChanges: 1, order: 'largest', minimumChanges: 1 };
const reference = (value: string): IrExpression => ({ kind: 'reference', value });
const literal = (value: string): IrExpression => ({ kind: 'string', value });
const integer = (value: number): IrExpression => ({ kind: 'integer', value });
const list = (...items: IrExpression[]): IrExpression => ({ kind: 'list', items });
const abstain: IrExpression = { kind: 'null', value: null };
const call = (value: string, args: Record<string, IrExpression>): IrExpression => ({
  kind: 'call', value, arguments: Object.entries(args).map(([name, value]) => ({ name, value })),
});

export async function contrastControlsModule(settings: ContrastCardSettings = defaultContrastCardSettings): Promise<CompiledModule> {
  if (![settings.minimumRemoteChanges, settings.minimumChanges].every(value => Number.isInteger(value) && value >= 1 && value <= 8)
    || !['largest', 'smallest'].includes(settings.order)) throw new RangeError('Choose an order and thresholds from 1 to 8.');
  const workflows: CompiledModule['workflows'] = [{
    id: contrastControlsWorkflow, entry_step_id: step,
    inputs: [{ name: 'situation', type_spec: { name: 'Map', arguments: [] } }],
    outputs: [{ name: 'choice', type_spec: { name: 'Map', arguments: [], optional: true } }], state: [],
    steps: [{ id: step, statements: [
      { id: step + '.eligible', kind: 'IF', expression: call('sic.matches_observed_situation', {
        situation: reference('situation'), need: literal(contrastNeed),
        modes: list(literal('exploration'), literal('assimilation'), literal('solving')), minimumRemoteChanges: integer(settings.minimumRemoteChanges),
      }), body: [
        { id: step + '.contrast', kind: 'STOP', expression: call('sic.bind_candidate_experiment', {
          need: literal(contrastNeed), primitive: literal(contrastPrimitive),
          target: call('sic.rank_observed_candidates', {
            options: reference('situation.options'), measure: literal('separation'), order: literal(settings.order),
          }),
          check: literal(contrastCheck), minimumChanges: integer(settings.minimumChanges),
        }) },
      ] },
      { id: step + '.initial_probe', kind: 'IF', expression: reference('situation.initialProbe'), body: [
        { id: step + '.sample', kind: 'STOP', expression: call('sic.bind_candidate_experiment', {
          need: literal(contrastNeed), primitive: literal(contrastPrimitive),
          target: call('sic.rank_observed_candidates', {
            options: reference('situation.options'), measure: literal('separation'), order: literal('smallest'),
          }),
          check: literal(contrastCheck), minimumChanges: integer(settings.minimumChanges),
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

export function readContrastCardSettings(module: CompiledModule): ContrastCardSettings | null {
  const statements = module.workflows.find(workflow => workflow.id === contrastControlsWorkflow)?.steps[0]?.statements;
  const argument = (expression: IrExpression | null | undefined, name: string) =>
    expression?.arguments?.find(arg => arg.name === name)?.value;
  const minimumRemoteChanges = argument(statements?.[0]?.expression, 'minimumRemoteChanges')?.value;
  const experiment = statements?.[0]?.body?.[0]?.expression;
  const order = argument(argument(experiment, 'target'), 'order')?.value;
  const minimumChanges = argument(experiment, 'minimumChanges')?.value;
  if (typeof minimumRemoteChanges !== 'number' || typeof minimumChanges !== 'number' || (order !== 'largest' && order !== 'smallest')) return null;
  return { minimumRemoteChanges, order, minimumChanges };
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
