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
import type { NativeLearnedPreparationWitness, NativeObservation, NativeProposal } from './v6-native-types.ts';

type R = Record<string, any>;
const references = (values: unknown[]): string[] => [...new Set(values.flat(Infinity)
  .filter((value): value is string => typeof value === 'string' && value.length > 0))];

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
