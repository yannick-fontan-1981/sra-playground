/**
 * Explicit native experiment: transport a phase-associated public relation.
 * This journal is separate from the unchanged source program model. A temporal
 * alignment is not causal identification; an approach followed by a response
 * remains a competing explanation even after spatially translated matches.
 */
import { bindCurrentProgramAccess } from './v6-program-current-access.ts';
import { geometricComponents } from './v6-native-observer.ts';
import { decodeProgramStacks } from './v6-program-geometry.ts';
import { programCoordinates, programSurface } from './v6-program-compositions.ts';
import { alignOccurrenceProgramPacket, occurrenceRectangularMembers } from './v6-occurrence-program-observer.ts';
import { programIdentity as identity } from './v6-program-identity.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import type { NativeGroundedInquiryWitness, NativeRows } from './v6-native-types.ts';
import type { OccurrenceRecord as R } from './v6-occurrence-scene.ts';

const schema = 'logos-engine.native.program-relations.v1';
const discoverySchema = 'logos-engine.native.program-control-discovery.v1';
const clone = <T>(value: T): T => structuredClone(value);
const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];
const key = (point: readonly number[]): string => point.join(',');
const difference = (a: readonly number[], b: readonly number[]): number[] => a.map((value, index) => value - b[index]!);
const add = (a: readonly number[], b: readonly number[]): number[] => a.map((value, index) => value + b[index]!);
const point = (value: unknown): value is number[] => Array.isArray(value) && value.length === 2 && value.every(Number.isSafeInteger);
const commandEqual = (a: R, b: R): boolean => equal([a.action_ref, a.data ?? {}], [b.action_ref, b.data ?? {}]);
const pointCommand = (box: readonly number[]): R => ({ action_ref: 'ACTION6',
  data: { x: Math.floor((box[0]! + box[2]!) / 2), y: Math.floor((box[1]! + box[3]!) / 2) } });
const sourceValid = (model: R | null | undefined): model is R => !!model && typeof model.model_id === 'string'
  && model.status === 'conditional_program_composition_model' && Array.isArray(model.evidence_refs) && model.evidence_refs.length > 0
  && Array.isArray(model.basis) && model.basis.length === 2 && model.basis.every(point)
  && !!model.layer && !!model.editor_geometry && typeof model.command_ref === 'string';
const sourceMatches = (model: R, event: R): boolean => event.model_id === model.model_id && event.model_digest === identity(model);
const refsValid = (value: unknown): value is string[] => Array.isArray(value) && value.length === 2
  && value.every(ref => typeof ref === 'string' && ref.length > 0) && new Set(value).size === 2;
const worldEqual = (a: readonly R[], b: readonly R[]): boolean => a.length === b.length
  && a.every(object => b.filter(other => equal(object.base, other.base) && equal(object.word, other.word)).length === 1);
const controlKey = (control: R, layout: R): string => identity([control.patch_digest,
  control.bbox.map((value: number, index: number) => value - layout.offset[index % 2])]);

function phaseSample(phase: R, word: number[], evidence: string[], provenance: R): R | null {
  const world = phase.world;
  if (!world || !Array.isArray(world.before_objects) || !Array.isArray(world.after_objects)
    || !Array.isArray(world.unmatched_before) || world.unmatched_before.length
    || !Array.isArray(world.unmatched_after) || world.unmatched_after.length
    || !Array.isArray(world.word_changes) || world.word_changes.length
    || world.before_objects.length !== 2 || world.after_objects.length !== 2
    || !Array.isArray(world.translations) || world.translations.length !== 1
    || !Number.isInteger(phase.start) || !Number.isInteger(phase.endpoint) || phase.endpoint <= phase.start
    || typeof phase.start_frame_digest !== 'string' || typeof phase.endpoint_frame_digest !== 'string') return null;
  const own = world.before_objects.filter((object: R) => equal(object.word, word));
  const ownAfter = world.after_objects.filter((object: R) => equal(object.word, word));
  if (own.length !== 1 || ownAfter.length !== 1 || !equal(own[0].base, ownAfter[0].base)) return null;
  const target = world.before_objects.filter((object: R) => object !== own[0]);
  const targetAfter = world.after_objects.filter((object: R) => object !== ownAfter[0]);
  if (target.length !== 1 || targetAfter.length !== 1 || !equal(target[0].word, targetAfter[0].word)
    || equal(target[0].word, word) || !target[0].word.length || !point(own[0].base) || !point(target[0].base)
    || !point(targetAfter[0].base)) return null;
  const delta = difference(targetAfter[0].base, target[0].base), offset = difference(target[0].base, own[0].base);
  if (!delta.some(Boolean) || !offset.some(Boolean)) return null;
  const translation = world.translations[0];
  if (!equal(translation.word, target[0].word) || !equal(translation.before_base, target[0].base)
    || !equal(translation.after_base, targetAfter[0].base) || !equal(translation.vector, delta)
    || !world.preserved_objects?.some((object: R) => equal(object.word, word) && equal(object.base, own[0].base))) return null;
  const sample: R = { evidence: clone(evidence), phase_evidence: clone(phase.evidence), phase_start: phase.start, phase_endpoint: phase.endpoint,
    start_frame_digest: phase.start_frame_digest, endpoint_frame_digest: phase.endpoint_frame_digest,
    bearer_word: clone(word), bearer_base: clone(own[0].base), respondent_word: clone(target[0].word),
    respondent_before: clone(target[0].base), respondent_after: clone(targetAfter[0].base), offset, delta,
    preceding_labels: clone(provenance.preceding_labels), residual: clone(phase.residual ?? {}),
    provenance, scope: 'Two unique decoded public words; bearer and words preserved during this isolated interval. Other public display changes remain outside this projection.' };
  sample.sample_id = 'program-relation-sample:' + identity(sample).slice(0, 24);
  return sample;
}

function initialRelation(model: R, events: readonly R[], effectIndex: number): R | null {
  const effect = events[effectIndex]!;
  if (effect.kind !== 'native_program_control_effect' || effect.schema !== discoverySchema || !sourceMatches(model, effect)
    || effect.status !== 'isolated_public_phase_measured' || effect.alignment_status !== 'phase_aligned_candidates'
    || effect.official_progress !== false || !refsValid(effect.evidence) || !commandEqual(effect.command ?? {}, { action_ref: model.command_ref })
    || !Array.isArray(effect.phases)) return null;
  const earlier = events.slice(0, effectIndex);
  const bindings = earlier.filter(event => event.kind === 'native_program_control_binding' && event.schema === discoverySchema
    && sourceMatches(model, event) && event.binding_id === effect.binding_id && event.control_key === effect.control_key
    && event.label === effect.label && event.epoch === effect.epoch && event.status === 'observed_collection_insertion' && refsValid(event.evidence));
  if (bindings.length !== 1) return null;
  const binding = bindings[0]!;
  const editTrials = earlier.filter(event => event.kind === 'native_program_control_trial' && event.schema === discoverySchema
    && sourceMatches(model, event) && event.mode === 'probe_edit' && event.outcome === 'collection_insertion_measured'
    && event.control_key === binding.control_key && equal(event.evidence, binding.evidence)
    && equal(event.before_word, binding.before_word) && commandEqual(event.command ?? {}, binding.insertion_command ?? {}));
  if (editTrials.length !== 1) return null;
  const trials = earlier.filter(event => event.kind === 'native_program_control_trial' && event.schema === discoverySchema
    && sourceMatches(model, event) && event.mode === 'probe_execute' && event.trial_key === effect.trial_key
    && event.control_key === effect.control_key && equal(event.evidence, effect.evidence) && event.epoch === effect.epoch
    && event.outcome === 'isolated_public_phase_measured' && commandEqual(event.command ?? {}, effect.command));
  if (trials.length !== 1) return null;
  const word: number[] = trials[0]!.before_word;
  const preparation = earlier.filter(event => event.kind === 'native_program_control_trial' && event.schema === discoverySchema
    && sourceMatches(model, event) && event.mode === 'probe_prepare_return' && event.binding_id === binding.binding_id
    && event.outcome === 'known_return_member_inserted' && event.epoch === effect.epoch
    && equal(event.return_preparation?.after_word, word) && equal(event.evidence, effect.return_preparation_evidence));
  if (!equal(word, binding.after_word) && preparation.length !== 1) return null;
  if (word.filter(label => label === effect.label).length !== 1) return null;
  const measured = effect.phases.filter((phase: R) => phase.new_control_label === true && phase.label === effect.label);
  if (measured.length !== 1) return null;
  const phase = measured[0]!, ordinal = effect.phases.indexOf(phase);
  if (word[phase.member_index] !== effect.label || !Array.isArray(phase.evidence) || phase.evidence.length !== 2
    || !equal(phase.evidence.map((item: R) => [item.observation_ref, item.packet_index]),
      [[effect.before_ref, phase.start - 1], [effect.before_ref, phase.endpoint - 1]])
    || !Number.isInteger(effect.excluded_from) || phase.endpoint >= effect.excluded_from
    || phase.endpoint > effect.packet_frame_count || effect.phases.some((candidate: R) => candidate !== phase && candidate.label === effect.label)) return null;
  const sample = phaseSample(phase, word, effect.evidence, { kind: 'acquired_control_effect', effect_digest: identity(effect),
    binding_digest: identity(binding), trial_digest: identity(trials[0]),
    return_preparation_evidence: preparation.length ? clone(preparation[0]!.evidence) : [],
    preceding_labels: effect.phases.slice(0, ordinal).map((candidate: R) => candidate.label) });
  if (!sample) return null;
  const offset = programCoordinates(sample.offset, [0, 0], model.basis), delta = programCoordinates(sample.delta, [0, 0], model.basis);
  if (!offset || !delta) return null;
  // The alternatives coincide in this sample; they remain explicit. No later
  // translated repetition is allowed to pretend it has distinguished them.
  const candidates: R[] = [{ kind: 'fixed_delta', delta: sample.delta }];
  if (equal(sample.delta, sample.offset)) candidates.push({ kind: 'radial_delta', coefficient: 1 });
  const relation: R = { schema, status: 'conditional_relative_public_translation', source_model_id: model.model_id,
    source_model_digest: identity(model), epoch: effect.epoch, binding_id: binding.binding_id, control_key: binding.control_key,
    label: effect.label, basis: clone(model.basis), observed_offset: sample.offset, observed_offset_coordinates: offset,
    observed_delta: sample.delta, observed_delta_coordinates: delta, respondent_word: sample.respondent_word,
    bearer_role: 'unique_current_collection_word', respondent_role: 'one_other_unique_decoded_word',
    candidates, samples: [sample], support_count: 1, evidence_refs: unique([...binding.evidence, ...effect.evidence]),
    causal_status: 'phase_association_not_causal_identification',
    uncertainties: ['A delayed response to preceding motion is still possible.', 'Fixed and relative displacement are not distinguished by equal-offset transport.',
      'Applicability to other offsets, words, object counts, supports or execution prefixes is unestablished.',
      'Only the decoded bearer/respondent projection is modeled; other public changes and terminal meaning remain unknown.'] };
  relation.relation_id = 'program-relation:' + identity(relation).slice(0, 24);
  return relation;
}

function modelEvent(model: R, previous: R | null = null, trialId: string | null = null): R {
  return { kind: 'native_program_relation_model', schema, relation_id: model.relation_id, epoch: model.epoch,
    model, previous_model_digest: previous ? identity(previous) : null, support_trial_id: trialId,
    evidence: model.evidence_refs, acquisition_scope: 'Conditional phase relation; preserved alternatives and causal uncertainty.' };
}

/** Called by acquisition after a real control-effect event, never by lookahead. */
export function acquireProgramRelationModels(model: R, events: readonly R[]): R[] {
  if (!sourceValid(model)) return [];
  const added: R[] = [];
  for (let index = 0; index < events.length; index++) {
    const relation = initialRelation(model, events, index);
    if (relation && ![...events, ...added].some(event => event.kind === 'native_program_relation_model' && event.relation_id === relation.relation_id)) added.push(modelEvent(relation));
  }
  return added;
}

function supportedModel(previous: R, sample: R): R {
  const samples = previous.samples.some((old: R) => old.sample_id === sample.sample_id) ? previous.samples : [...previous.samples, sample];
  return { ...previous, samples, support_count: samples.length, evidence_refs: unique([...previous.evidence_refs, ...sample.evidence]) };
}

/** Model-shaped proposal data cannot create or repair retained evidence. */
export function retainedProgramRelations(model: R, events: readonly R[]): R[] {
  if (!sourceValid(model)) return [];
  const active = new Map<string, R>(), roots = new Map<string, R>();
  const refuted = new Set<string>();
  for (let index = 0; index < events.length; index++) {
    const event = events[index]!, root = initialRelation(model, events, index);
    if (root) roots.set(root.relation_id, root);
    if (event.kind === 'native_program_relation_refutation') { refuted.add(event.relation_id); active.delete(event.relation_id); }
    if (event.kind !== 'native_program_relation_model' || event.schema !== schema || refuted.has(event.relation_id)) continue;
    const previous = active.get(event.relation_id), seed = roots.get(event.relation_id);
    if (!previous) { if (seed && equal(event, modelEvent(seed))) active.set(event.relation_id, seed); continue; }
    const trial = events.slice(0, index).reverse().find(candidate => candidate.kind === 'native_program_relation_trial'
      && candidate.trial_id === event.support_trial_id && candidate.relation_id === event.relation_id
      && candidate.outcome === 'isolated_relation_projection_matched' && candidate.measurement?.sample);
    if (!trial || trial.relation_model_digest !== identity(previous)) continue;
    const expected = supportedModel(previous, trial.measurement.sample);
    if (equal(event, modelEvent(expected, previous, trial.trial_id))) active.set(event.relation_id, expected);
  }
  return [...active.values()];
}

/** Outside the observed relation, alternatives are descriptive, not admission. */
export function predictProgramRelation(relation: R, bearer: R, objects: readonly R[], precedingLabels: readonly number[] = []): R {
  const others = objects.filter(object => !equal(object.base, bearer.base) || !equal(object.word, bearer.word));
  const unknown = (reason: string, alternatives: R[] = []): R => ({ status: 'unknown', reason, alternatives,
    causal_status: relation.causal_status, official_outcome: 'unknown' });
  if (objects.length !== 2 || others.length !== 1 || objects.filter(object => equal(object.word, bearer.word)).length !== 1
    || !equal(others[0]!.word, relation.respondent_word) || equal(others[0]!.word, bearer.word)) return unknown('ambiguous_or_unobserved_bearer_binding');
  const target = others[0]!, offset = difference(target.base, bearer.base);
  const alternatives = relation.candidates.map((candidate: R) => ({ kind: candidate.kind,
    delta: candidate.kind === 'fixed_delta' ? candidate.delta : offset,
    target_after: add(target.base, candidate.kind === 'fixed_delta' ? candidate.delta : offset) }));
  if (!equal(offset, relation.observed_offset)) return unknown('outside_observed_relative_offset', alternatives);
  if (!alternatives.length || alternatives.some((candidate: R) => !equal(candidate.delta, alternatives[0].delta))) return unknown('retained_candidates_disagree', alternatives);
  return { status: 'conditional_projection', bearer_before: clone(bearer), bearer_after: clone(bearer), respondent_before: clone(target),
    respondent_after: { ...clone(target), base: alternatives[0].target_after,
      anchor: add(target.anchor, alternatives[0].delta) }, alternatives,
    prefix_status: relation.samples.some((sample: R) => equal(sample.preceding_labels, precedingLabels)) ? 'observed_prefix' : 'new_preparation_prefix_requires_validation',
    preceding_labels: clone(precedingLabels), causal_status: relation.causal_status, official_outcome: 'unknown' };
}

function exclusions(rows: NativeRows, layout: R): number[][] {
  return [[layout.member_box[0], 0, layout.member_box[2], rows.length - 1], [0, layout.limit, rows[0]!.length - 1, rows.length - 1]];
}
function measuredWorld(rows: NativeRows, model: R, layout: R, labels: ReadonlySet<number>): R[] {
  return decodeProgramStacks(rows, model.layer, labels, exclusions(rows, layout));
}
function measuredMembers(rows: NativeRows, layout: R, labels: ReadonlySet<number>): R[] | null {
  const [x] = layout.member_box, [width, height] = layout.member_size;
  const known = occurrenceRectangularMembers(rows, [{ bbox: [x, 0, x + width - 1, height - 1] }], new Set(labels), layout.limit);
  const all = geometricComponents(rows).filter(part => part.bbox[0] === x && part.bbox[2] === x + width - 1
    && part.bbox[3] < layout.limit && part.bbox[3] - part.bbox[1] + 1 === height && part.area === width * height)
    .map(part => ({ bbox: [...part.bbox], color: part.color, area: part.area })).sort((a, b) => a.bbox[1]! - b.bbox[1]!);
  return equal(known, all) ? known : null;
}

function currentScene(model: R, relation: R, events: readonly R[], observation: R, rows: NativeRows): R | null {
  const access = bindCurrentProgramAccess(rows, model, observation);
  if (access.status !== 'bound') return null;
  const bindings = events.filter(event => event.kind === 'native_program_control_binding' && sourceMatches(model, event)
    && event.binding_id === relation.binding_id && event.control_key === relation.control_key && event.epoch === observation.level_epoch);
  if (bindings.length !== 1) return null;
  const controls = access.unknown_controls.filter(control => controlKey(control, access.layout) === relation.control_key);
  if (controls.length !== 1 || !equal(controls[0]!.patch, bindings[0]!.control.patch)) return null;
  const labels = new Set<number>([...model.editor_geometry.controls.map((control: R) => control.color), relation.label]);
  const members = measuredMembers(rows, access.layout, labels);
  if (!members?.length) return null;
  const word = members.map(member => member.color), objects = measuredWorld(rows, model, access.layout, labels);
  const owners = objects.filter(object => equal(object.word, word));
  if (owners.length !== 1 || objects.length !== 2) return null;
  const target = objects.find(object => object !== owners[0])!;
  if (!equal(target.word, relation.respondent_word) || equal(target.word, word)) return null;
  return { access, layout: { ...access.layout, members }, control: controls[0], word, objects, owner: owners[0], target,
    palette: [...labels].sort((a, b) => a - b) };
}

function knownPath(labels: readonly number[], start: number[], target: R, moves: Map<number, number[]>, safe: ReadonlySet<string>): R | null {
  let position = [...start]; const phases: R[] = [];
  for (const label of labels) {
    const vector = moves.get(label); if (!vector) return null;
    const next = add(position, vector);
    if (!safe.has(key(next)) || equal(next, target.base)) return null;
    phases.push({ label, before: position, after: next, status: 'phase_observed_translation_on_matched_surface' }); position = next;
  }
  return { base: position, phases };
}

function shortestPreparation(start: number[], goal: number[], target: R, moves: Map<number, number[]>, labels: number[],
  safe: ReadonlySet<string>, maximum: number, deadline: number, now: () => number): number[] | null {
  const queue: { base: number[]; labels: number[] }[] = [{ base: start, labels: [] }], seen = new Set([key(start)]);
  for (let index = 0; index < queue.length; index++) {
    if (now() >= deadline) return null;
    const item = queue[index]!;
    if (equal(item.base, goal)) return item.labels;
    if (item.labels.length >= maximum) continue;
    for (const label of labels) {
      const next = add(item.base, moves.get(label)!);
      if (equal(next, target.base) || !safe.has(key(next)) || seen.has(key(next))) continue;
      seen.add(key(next)); queue.push({ base: next, labels: [...item.labels, label] });
    }
  }
  return null;
}

function trialKey(plan: R): string {
  return identity([plan.relation.relation_id, plan.epoch, plan.mode, plan.word, plan.owner.base, plan.objects,
    plan.action, plan.prepared_word, plan.prediction.respondent_after.base]);
}

function packageQuestion(observation: R, plan: R): R {
  const ref = 'C_program_relation_' + identity(plan).slice(0, 22);
  const evidence = unique([observation.observation_ref, plan.model.model_id, plan.relation.relation_id, ...plan.relation.evidence_refs]);
  const why = 'Validate a transported public relation with one currently bound real action. Preparation uses observed movements; the later respondent displacement, its destination support and the changed preparation prefix remain conditional. Fixed/relative displacement and delayed-response explanations are retained. Official completion is not predicted.';
  const facts = { acquired_phase_relation: true, currently_measured_editor: true, one_real_action: true,
    relation_causal_identification: false, official_outcome_unknown: true };
  return clone({ status: 'proposed', kind: 'public_program_relation_probe', proposal_id: ref, program_relation_plan: plan,
    actions: [plan.action], steps: [{ action: plan.action, expected_after: plan.mode === 'execute'
      ? { isolated_phase_projection: plan.prediction, other_public_effects: 'unknown' }
      : { collection: plan.after_word, bearer_base: plan.owner.base, scope: 'Conditional current edit projection; actual return required.' } }],
    facts, compositions: [{ id: ref, observed: false, open_question: why,
      properties: { mode: plan.mode, relation_status: plan.relation.status, causal_status: plan.relation.causal_status }, relations: ['contributes_to:G_official_completion'] }],
    question: { reason: 'validate_transported_public_relation', hypothesis_refs: evidence }, route_refs: evidence,
    binding: { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref },
    bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [],
      actions: [plan.action], purpose: why, preconditions: facts, evidence, outcome_guard: { path: ['value'], contains: ref } } });
}

/** A bounded validation planner, not a replacement for the source goal search.
 * `deadline` and `now` use the same millisecond clock as the native caller. */
export function programRelationQuestion(model: R, events: readonly R[], observation: R, rows: NativeRows,
  remaining: number, deadline: number, now: () => number = () => performance.now()): R | null {
  if (!sourceValid(model) || remaining < 1 || !Array.isArray(observation.available_action_refs)
    || ['WIN', 'GAME_OVER'].includes(observation.state) || !observation.available_action_refs.includes(model.command_ref)) return null;
  for (const relation of retainedProgramRelations(model, events)) {
    if (relation.epoch !== observation.level_epoch || now() >= deadline) continue;
    // One new independent transport is this inquiry's bounded objective. More
    // contrasts need a separately justified question; do not push forever.
    if (relation.support_count >= 2) continue;
    const scene = currentScene(model, relation, events, observation, rows); if (!scene) continue;
    const { word, owner, target, layout } = scene;
    const observedMoves = (model.moves as R[]).filter(move => move.status === 'phase_observed_translation'
      && move.vectors?.length === 1 && point(move.vectors[0]));
    const moves = new Map<number, number[]>(observedMoves.map(move => [move.label, move.vectors[0]]));
    const labels = [...moves.keys()].filter(label => layout.controls.some((control: R) => control.color === label)).sort((a, b) => a - b);
    const [column, footer] = exclusions(rows, layout);
    const field = programSurface(rows, { ...model, editor_geometry: { ...model.editor_geometry, member_column: column, footer } }, scene.objects, owner.base);
    if (!field) continue;
    const safe = new Set<string>(field.points.map(key));
    const goal = difference(target.base, relation.observed_offset), targetAfter = add(target.base, relation.observed_delta);
    if (!safe.has(key(goal)) || relation.samples.some((sample: R) => equal(sample.bearer_base, goal) && equal(sample.respondent_before, target.base))) continue;
    const common: R = { schema, epoch: observation.level_epoch, score: observation.levels_completed,
      observation_ref: observation.observation_ref, frame_digest: identity(rows), model, model_digest: identity(model),
      relation, relation_digest: identity(relation), current_access: scene.access.evidence, layout,
      control: scene.control, word, owner, objects: scene.objects, palette: scene.palette, field,
      search_budget: remaining, destination_support: safe.has(key(targetAfter)) ? 'currently_matched_surface' : 'uncharacterized_support_extension',
      context_scope: 'Transport at the measured relative offset and respondent word; preparation prefix and destination support are explicitly tested extensions.' };
    const candidates: R[] = [];
    // An already prepared word can be executed only with one final occurrence
    // of the new label and a fully observed movement prefix.
    if (word[0] === relation.label && word.filter((label: number) => label === relation.label).length === 1) {
      const prefix = [...word.slice(1)].reverse(), path = knownPath(prefix, owner.base, target, moves, safe);
      if (path && equal(path.base, goal)) {
        const bearer = { ...owner, base: goal, anchor: difference(goal, model.layer.step.map((value: number) => value * word.length)) };
        const prediction = predictProgramRelation(relation, bearer, [bearer, target], prefix);
        if (prediction.status === 'conditional_projection') candidates.push({ ...common, mode: 'execute', prepared_word: word, after_word: word,
          known_preparation: path.phases, prediction, action: { action_ref: model.command_ref }, cost: 1 });
      }
    }
    if (observation.available_action_refs.includes('ACTION6')) for (let removals = 0; removals < word.length; removals++) {
      const kept = word.slice(removals), prefix = [...kept].reverse();
      const first = knownPath(prefix, owner.base, target, moves, safe); if (!first) continue;
      const availableEdits = remaining - removals - 2;
      if (availableEdits < 0) continue;
      const extension = shortestPreparation(first.base, goal, target, moves, labels, safe, availableEdits, deadline, now);
      if (extension === null) continue;
      const prepared = [relation.label, ...extension.slice().reverse(), ...kept];
      // This is a geometric raster bound, not a claimed editor capacity.
      if (prepared.length * layout.member_size[1] > layout.limit) continue;
      const executionPrefix = [...prefix, ...extension], path = knownPath(executionPrefix, owner.base, target, moves, safe)!;
      const bearer = { ...owner, word: prepared, base: goal, anchor: difference(goal, model.layer.step.map((value: number) => value * prepared.length)) };
      const prediction = predictProgramRelation(relation, bearer, [bearer, target], executionPrefix);
      if (prediction.status !== 'conditional_projection') continue;
      const cost = removals + extension.length + 2;
      let mode: string, entity: R, afterWord: number[];
      if (removals) { mode = 'remove'; entity = layout.members[0]; afterWord = word.slice(1); }
      else {
        mode = 'insert'; const label = extension[0] ?? relation.label;
        const controls = label === relation.label ? [scene.control] : layout.controls.filter((control: R) => control.color === label);
        if (controls.length !== 1) continue;
        entity = controls[0]; afterWord = [label, ...word];
      }
      candidates.push({ ...common, mode, entity, prepared_word: prepared, after_word: afterWord,
        known_preparation: path.phases, prediction, action: pointCommand(entity.bbox), cost });
    }
    candidates.sort((a, b) => a.cost - b.cost || a.prepared_word.length - b.prepared_word.length
      || JSON.stringify(a.prepared_word).localeCompare(JSON.stringify(b.prepared_word)));
    for (const candidate of candidates) {
      candidate.trial_key = trialKey(candidate);
      if (events.some(event => event.kind === 'native_program_relation_trial' && event.trial_key === candidate.trial_key)) continue;
      return packageQuestion(observation, candidate);
    }
  }
  return null;
}

export function programRelationBefore(proposal: R, index: number, rows: NativeRows, meta: R): R {
  const plan = proposal.program_relation_plan, model = meta.model, events = meta.events;
  const reject = (reason: string): R => ({ admitted: false, reason });
  if (!plan || index !== 0 || plan.schema !== schema || !sourceValid(model) || !Array.isArray(events)
    || !equal(plan.model, model) || plan.model_digest !== identity(model)) return reject('relation_retained_source_missing');
  if (!equal([plan.epoch, plan.score, plan.observation_ref], [meta.epoch, meta.score, meta.observation_ref])
    || identity(rows) !== plan.frame_digest || !meta.available?.includes(plan.action?.action_ref)
    || !equal(proposal.actions, [plan.action])) return reject('relation_current_context_changed');
  const current = programRelationQuestion(model, events, { level_epoch: meta.epoch, levels_completed: meta.score,
    observation_ref: meta.observation_ref, available_action_refs: meta.available, state: meta.state }, rows, plan.search_budget, Infinity, () => 0);
  return current && equal(current.program_relation_plan, plan)
    ? { admitted: true, reason: 'acquired_relation_validation_bound_to_current_public_context' }
    : reject('relation_evidence_projection_or_candidate_changed');
}

export function programRelationAfter(proposal: R, index: number, _rows: NativeRows, later: NativeRows, meta: R): R {
  const plan = proposal.program_relation_plan;
  if (!plan || index !== 0) return { matched: null, seal_prefix: true, reason: 'missing_relation_probe' };
  if (meta.epoch !== plan.epoch || meta.score !== plan.score || ['WIN', 'GAME_OVER'].includes(meta.state)) {
    return { matched: null, seal_prefix: true, reason: 'relation_official_boundary_not_attributed' };
  }
  if (plan.mode === 'execute') return { matched: null, seal_prefix: true, reason: 'relation_requires_isolated_public_phase_reconciliation' };
  const labels = new Set<number>(plan.palette), members = measuredMembers(later, plan.layout, labels);
  const objects = measuredWorld(later, plan.model, plan.layout, labels);
  const expected = plan.objects.map((object: R) => equal(object.base, plan.owner.base) && equal(object.word, plan.word)
    ? { ...object, word: plan.after_word } : object);
  const current = bindCurrentProgramAccess(later, plan.model);
  const matched = !!members && equal(members.map(member => member.color), plan.after_word) && worldEqual(expected, objects)
    && current.status === 'bound' && equal(current.evidence.geometry, plan.current_access.geometry);
  return { matched, seal_prefix: true, reason: matched ? 'relation_preparation_edit_matched' : 'relation_preparation_edit_refused',
    scope: 'An edit discrepancy is local input evidence, not a refutation of the phase relation or original source model.' };
}

function worldDifference(before: R[], after: R[]): R {
  const preserved = before.filter(object => after.some(other => equal(object.base, other.base) && equal(object.word, other.word)));
  const translations: R[] = [];
  for (const object of before) {
    const matches = after.filter(other => equal(other.word, object.word));
    if (before.filter(other => equal(other.word, object.word)).length !== 1 || matches.length !== 1 || equal(matches[0]!.base, object.base)) continue;
    translations.push({ word: object.word, before_base: object.base, after_base: matches[0]!.base,
      vector: difference(matches[0]!.base, object.base), status: 'unique_public_word_correspondence' });
  }
  return { before_objects: before, after_objects: after, preserved_objects: preserved, translations, word_changes: [],
    unmatched_before: before.filter(object => !after.some(other => equal(other.word, object.word))),
    unmatched_after: after.filter(object => !before.some(other => equal(other.word, object.word))) };
}

function measureRelationExecution(plan: R, rows: NativeRows, frames: readonly NativeRows[], after: R): R {
  const unresolved = (reason: string, extra: R = {}): R => ({ status: 'unresolved', reason, sample: null,
    official_outcome: after.levels_completed > plan.score ? 'official_progress_observed' : 'unknown', ...extra });
  if (after.level_epoch !== plan.epoch || after.levels_completed !== plan.score || ['WIN', 'GAME_OVER'].includes(after.state)) {
    return unresolved('official_boundary_excluded_from_relation_attribution');
  }
  const controls = [...plan.layout.controls, { ...plan.control, color: plan.relation.label }];
  const alignment = alignOccurrenceProgramPacket(rows, frames, { members: plan.layout.members, controls,
    observation_ref: plan.observation_ref, after_observation_ref: after.observation_ref, epoch: plan.epoch, command_ref: plan.action.action_ref });
  if (alignment.status !== 'phase_aligned_candidates') return unresolved(alignment.reason ?? 'phase_alignment_unknown');
  const selected = alignment.phases.filter((phase: R) => phase.label === plan.relation.label);
  if (selected.length !== 1) return unresolved('relation_phase_not_unique');
  const phase = selected[0]!, images = [rows, ...frames];
  if (!Number.isInteger(phase.endpoint) || phase.endpoint <= phase.start || phase.endpoint >= alignment.excluded_from
    || phase.endpoint >= images.length || phase.member_index !== 0) return unresolved('relation_phase_interval_not_isolated');
  const beforeWorld = measuredWorld(images[phase.start]!, plan.model, plan.layout, new Set(plan.palette));
  const afterWorld = measuredWorld(images[phase.endpoint]!, plan.model, plan.layout, new Set(plan.palette));
  const measured = { ...phase, new_control_label: true, start_frame_digest: identity(images[phase.start]),
    endpoint_frame_digest: identity(images[phase.endpoint]), residual: phase.effect, world: worldDifference(beforeWorld, afterWorld) };
  const evidence = [plan.observation_ref, after.observation_ref];
  const expectedBefore = [plan.prediction.bearer_before, plan.prediction.respondent_before];
  const expectedAfter = [plan.prediction.bearer_after, plan.prediction.respondent_after];
  const preceding = alignment.phases.slice(0, alignment.phases.indexOf(phase)).map((item: R) => item.label);
  const metadata = { phase: measured, alignment_status: alignment.status, excluded_from: alignment.excluded_from,
    packet_frame_count: frames.length, packet_frame_digests: frames.map(frame => identity(frame)),
    preceding_labels: preceding, destination_support: plan.destination_support,
    residual_scope: 'Other public changes are retained separately; absence never implies removal, reduction or terminal success.' };
  if (!worldEqual(expectedBefore, beforeWorld) || !equal(preceding, plan.prediction.preceding_labels)) {
    return unresolved('known_preparation_or_phase_context_not_matched', metadata);
  }
  if (!worldEqual(expectedAfter, afterWorld)) return { status: 'projection_refuted', reason: 'transported_relation_projection_not_observed',
    sample: null, ...metadata, official_outcome: 'unknown',
    scope: 'Reject this transported relation hypothesis under the stated prefix/support context. Earlier measurements and the original program model are retained.' };
  const sample = phaseSample(measured, plan.prepared_word, evidence, { kind: 'native_relation_validation',
    relation_id: plan.relation.relation_id, relation_model_digest: plan.relation_digest, preceding_labels: preceding,
    destination_support: plan.destination_support, preceding_phase_evidence: alignment.phases.slice(0, alignment.phases.indexOf(phase))
      .map((item: R) => ({ label: item.label, member_index: item.member_index, evidence: item.evidence })) });
  return sample ? { status: 'matched', reason: 'transported_relation_phase_projection_matched', sample, ...metadata,
    official_outcome: 'unknown', causal_status: plan.relation.causal_status }
    : unresolved('matched_projection_has_no_unique_conservative_sample', metadata);
}

/** Every effect and model revision is produced after a real admitted command. */
export function recordProgramRelation(before: R, command: R, after: R, rows: NativeRows, later: NativeRows,
  frames: readonly NativeRows[], proposal: R, context: { model?: R | null; events: readonly R[] }): R[] {
  const plan = proposal.program_relation_plan;
  if (!plan || !commandEqual(command, plan.action)) return [];
  const admitted = programRelationBefore(proposal, 0, rows, { epoch: before.level_epoch, score: before.levels_completed,
    observation_ref: before.observation_ref, available: before.available_action_refs, state: before.state, ...context });
  if (!admitted.admitted) return [];
  const outcome = programRelationAfter(proposal, 0, rows, later, { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
  const measurement = plan.mode === 'execute' ? measureRelationExecution(plan, rows, frames, after) : null;
  const trial: R = { kind: 'native_program_relation_trial', schema, relation_id: plan.relation.relation_id,
    relation_model_digest: plan.relation_digest, epoch: plan.epoch, mode: plan.mode, trial_key: plan.trial_key,
    command, evidence: [before.observation_ref, after.observation_ref], before_frame_digest: identity(rows), after_frame_digest: identity(later),
    before_word: plan.word, expected_after_word: plan.after_word, prepared_word: plan.prepared_word,
    before_bearer: plan.owner, before_objects: plan.objects, destination_support: plan.destination_support,
    measurement, official_progress: after.levels_completed > before.levels_completed,
    outcome: measurement ? measurement.status === 'matched' ? 'isolated_relation_projection_matched'
      : measurement.status === 'projection_refuted' ? 'isolated_relation_projection_refuted' : 'relation_measurement_unresolved'
      : outcome.matched === true ? 'relation_edit_matched' : outcome.matched === false ? 'relation_edit_refused' : 'relation_edit_boundary_unknown' };
  trial.trial_id = 'program-relation-trial:' + identity(trial).slice(0, 24);
  const events = [trial];
  if (measurement?.status === 'matched') {
    const next = supportedModel(plan.relation, measurement.sample);
    events.push(modelEvent(next, plan.relation, trial.trial_id));
  } else if (measurement?.status === 'projection_refuted') {
    events.push({ kind: 'native_program_relation_refutation', schema, relation_id: plan.relation.relation_id,
      epoch: plan.epoch, trial_id: trial.trial_id, reason: measurement.reason, evidence: trial.evidence,
      context: { phase_before: [plan.prediction.bearer_before, plan.prediction.respondent_before],
        preceding_labels: plan.prediction.preceding_labels, destination_support: plan.destination_support },
      scope: 'The native transport-validation hypothesis is suspended for this acquired context. No original program model, alias, removal law or official result is changed.' });
  }
  return events;
}

export function programRelationWitness(model: R, events: readonly R[], proposal: R, observation: R): NativeGroundedInquiryWitness | null {
  const plan = proposal.program_relation_plan;
  if (proposal.kind !== 'public_program_relation_probe' || proposal.status !== 'proposed' || !plan
    || !sourceValid(model) || !equal(model, plan.model) || plan.model_digest !== identity(model)
    || !equal([plan.epoch, plan.score, plan.observation_ref], [observation.level_epoch, observation.levels_completed, observation.observation_ref])
    || !retainedProgramRelations(model, events).some(relation => equal(relation, plan.relation) && identity(relation) === plan.relation_digest)) return null;
  return { status: 'acquired_context_for_unknown_effect', observation_ref: observation.observation_ref,
    context_model_ids: [model.model_id, plan.relation.relation_id], evidence_refs: plan.relation.evidence_refs,
    qualification: 'A phase-associated relation was acquired. This bounded transport tests its applicability with the stated preparation and support context. Fixed/relative displacement, delayed response and terminal meaning remain unresolved; current input and public-frame guards are still required.' };
}
