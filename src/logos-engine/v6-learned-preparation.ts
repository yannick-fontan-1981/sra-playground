/**
 * Native coordination evidence for preparation from acquired public knowledge.
 * The source algorithms keep their own hypotheses and guards. This adapter
 * exposes their evidential status to the common caller without game identity,
 * preloaded models, new observations or fabricated official progress.
 */
import type { OccurrenceRecallAccess, OccurrenceRecallPolicy } from './v6-occurrence-recall.ts';
import { occurrenceCandidates, occurrenceContextScope } from './v6-occurrence-scene.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import { symbolicDigest } from './v6-hash.ts';
import type { RadialPortState } from './v6-radial-port-access.ts';
import { rotateRadialPorts } from './v6-radial-port-observation.ts';
import type { NativeLearnedPreparationWitness, NativeObservation, NativeProposal } from './v6-native-types.ts';

type R = Record<string, any>;
const references = (values: unknown[]): string[] => [...new Set(values.flat(Infinity)
  .filter((value): value is string => typeof value === 'string' && value.length > 0))];

/** A measured point method or its bounded revalidation, never a terminal rule. */
export function radialLearnedPreparationWitness(state: RadialPortState, proposal: NativeProposal,
  observation: NativeObservation): NativeLearnedPreparationWitness | null {
  if (proposal.status !== 'proposed' || proposal.kind !== 'radial_port_composition') return null;
  const plan = (proposal as R).radial_port_plan, rule = state.port_point_rule;
  if (!plan || !rule || rule.status !== 'conditional_observed_point_method' || rule.action_ref !== 'ACTION6'
    || ![1, 2, 3].includes(rule.turn) || !Number.isInteger(rule.epoch) || rule.epoch > observation.level_epoch
    || plan.observation_ref !== observation.observation_ref || plan.epoch !== observation.level_epoch
    || plan.score !== observation.levels_completed || plan.sign !== rule.turn || !plan.scene?.geometry_ref
    || state.port_rejected.includes(plan.context) || !Array.isArray(plan.steps) || !plan.steps.length) return null;
  const current = rule.epoch === observation.level_epoch && rule.geometry_ref === plan.scene.geometry_ref;
  const revalidation = !current && plan.point_method_revalidated === false
    && plan.steps.length === 1 && proposal.actions.length === 1
    && (proposal as R).question?.reason === 'test_point_binding_of_recalled_rotation'
    && plan.steps[0].prediction_status === 'unconfirmed_point_binding_to_recalled_rotation';
  if (!(current && plan.point_method_revalidated === true) && !revalidation) return null;
  // Re-read the actual event suffix. A proposal or a rule-shaped object alone
  // cannot manufacture a witnessed transition or erase a later refutation.
  let retained: R | null = null, supporting: R | null = null;
  for (const event of state.port_events) if (event.kind === 'radial_port_effect') {
    if (event.rule) { retained = event.rule; supporting = event; }
    if (event.refuted) { retained = null; supporting = null; }
  }
  if (!equal(retained, rule) || !supporting || supporting.refuted !== false || supporting.selection_observed !== true
    || !equal(supporting.evidence, rule.evidence) || !Array.isArray(rule.evidence)) return null;
  const evidence = references(rule.evidence);
  if (evidence.length !== 2) return null;
  let ports: number[][] = plan.scene.cells.map((cell: R) => [...cell.ports]);
  if (!equal(proposal.actions, plan.steps.map((step: R) => step.action))) return null;
  for (const step of plan.steps as R[]) {
    if (!Number.isInteger(step.cell) || step.cell < 0 || step.cell >= ports.length
      || !equal(step.ports_before, ports)) return null;
    const cell = plan.scene.cells[step.cell];
    if (!equal(step.action, { action_ref: 'ACTION6', data: { x: cell.point[0], y: cell.point[1] } })) return null;
    ports = ports.map((value, index) => index === step.cell ? rotateRadialPorts(value, rule.turn) : value);
    if (!equal(step.ports_after, ports) || !equal(step.candidate_turns, [rule.turn])) return null;
  }
  return { status: 'conditional_acquired_preparation', kind: revalidation ? 'radial_point_method_revalidation' : 'radial_point_method', observation_ref: observation.observation_ref,
    model_ids: [`radial-point-method:${symbolicDigest(rule).slice(0, 20)}`], evidence_refs: evidence,
    qualification: revalidation
      ? 'A retained point rotation was acquired from a uniquely selected public response without later refutation. Its applicability to the current epoch or geometry is unknown. This single real action revalidates the current binding under the source guard; no current method or official outcome is assumed.'
      : 'Current-epoch point rotation acquired from a uniquely selected public response and retained without later refutation. Each proposed rotation uses that measured method; point guards, assembly goal hypotheses and official completion remain separate.' };
}

export function sharedLearnedPreparationWitness(memory: OccurrenceRecallAccess, policy: OccurrenceRecallPolicy,
  proposal: NativeProposal, observation: NativeObservation): NativeLearnedPreparationWitness | null {
  if (proposal.status !== 'proposed') return null;
  if (['public_program_composition', 'public_program_respondent_probe'].includes(proposal.kind)) {
    const plan = (proposal as R).program_composition_plan ?? (proposal as R).respondent_probe_plan;
    if (!plan || plan.observation_ref !== observation.observation_ref || plan.epoch !== observation.level_epoch
      || memory.compositionRefutedEpochs.has(observation.level_epoch)) return null;
    const model = memory.compositionModels.find(candidate => candidate.model_id === plan.model?.model_id);
    if (!model || model.status !== 'conditional_program_composition_model' || !equal(model, plan.model)
      || !Array.isArray(model.evidence_refs)) return null;
    const evidence = references(model.evidence_refs);
    if (!evidence.length) return null;
    return { status: 'conditional_acquired_preparation', kind: 'program_model', observation_ref: observation.observation_ref,
      model_ids: [model.model_id], evidence_refs: evidence,
      qualification: 'Retained fitted public program with acquired evidence; current binding and execution guards remain required.' };
  }
  if (proposal.kind !== 'public_occurrence_recall') return null;
  const plan = (proposal as R).occurrence_recall_plan;
  if (!plan || plan.selection_reason !== 'test_retained_occurrence_correspondence'
    || plan.observation_ref !== observation.observation_ref || plan.epoch !== observation.level_epoch
    || memory.recallEpoch !== observation.level_epoch || !memory.recallContext
    || !equal(plan.context, memory.recallContext) || !equal(plan.configuration, policy)) return null;
  const scope = occurrenceContextScope(memory.recallContext), minimum = policy.minimum_unique_observations[scope];
  if (!Number.isInteger(minimum) || minimum < 1) return null;
  const models: { key: string; model: R; selected: string }[] = [];
  for (const relation of policy.reference_families) for (const comparison of policy.comparison_families) {
    const key = `${scope}:${relation}:${comparison}`, model: R | undefined = memory.recallModels[key];
    if (!model || model.unique_support < minimum || model.counterexamples?.length !== 0
      || !Array.isArray(model.evidence) || model.evidence.length < minimum) continue;
    const candidates = occurrenceCandidates(plan.scene, memory.recallContext, memory.recallSeen, relation, comparison);
    if (candidates.length === 1) models.push({ key, model, selected: candidates[0]! });
  }
  if (!models.length || models.some(item => item.selected !== plan.selected?.id)
    || !equal(models.map(item => item.key), plan.supporting_models)) return null;
  const evidence = references(models.flatMap(item => item.model.evidence));
  if (!evidence.length) return null;
  return { status: 'conditional_acquired_preparation', kind: 'occurrence_correspondence', observation_ref: observation.observation_ref,
    model_ids: models.map(item => `occurrence-model:${symbolicDigest([item.key, item.model]).slice(0, 20)}`),
    evidence_refs: evidence,
    qualification: 'Unique convergent current occurrence prediction from retained source-threshold evidence without counterexamples; current point, WHY/ACT and official outcome remain separate requirements.' };
}
