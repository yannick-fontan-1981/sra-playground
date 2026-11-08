/**
 * Native marked-collection and observed-program questions/acquisition.
 * Original: marked_collection_access.py, program_composition_access.py and
 * program_respondent_access.py at 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 *
 * The retained state is the existing occurrence ancestor memory. These methods
 * add the source behavior to that same journal, without a second program model.
 */
import type { OccurrenceRecallAccess } from './v6-occurrence-recall.ts';
import type { OccurrenceRecord as R } from './v6-occurrence-scene.ts';
import type { NativeRows } from './v6-native-types.ts';
import { projection as patch } from './v6-native-observer.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { programIdentity as identity } from './v6-program-identity.ts';
import { occurrenceCollectionScene as collectionScene, occurrenceMeasuredControls as measuredControls,
  occurrenceRectangularMembers as rectangularMembers, occurrenceProgramTranslationCandidates as translationCandidates } from './v6-occurrence-program-observer.ts';
import { decodeProgramStacks, renderProgramLayers } from './v6-program-geometry.ts';
import { fitProgramCompositionModel, programSurface, searchProgram } from './v6-program-compositions.ts';
import { searchRespondentProgram, searchRespondentReplacement } from './v6-program-respondent-search.ts';
import { observeRespondentProgramPacket } from './v6-program-respondent-observations.ts';
import { learnProgramInputSupport, candidateProgramInputSites } from './v6-program-input-access.ts';

type Memory = OccurrenceRecallAccess;
type GuardBefore = (proposal: R, index: number, rows: NativeRows, meta: R) => R;
type GuardAfter = (proposal: R, index: number, rows: NativeRows, later: NativeRows, meta: R) => R;
const palette = (controls: readonly R[]): Set<number> => new Set(controls.map(control => control.color));
const colors = (members: readonly R[]): number[] => members.map(member => member.color);
const pointAction = (box: readonly number[]): R => ({ action_ref: 'ACTION6',
  data: { x: Math.floor((box[0]! + box[2]!) / 2), y: Math.floor((box[1]! + box[3]!) / 2) } });

export function programEditor(rows: NativeRows, model: R): R | null {
  const current = measuredControls(rows), old: R[] = model.editor_geometry.controls, offsets: number[][] = [];
  for (const control of old) {
    const matches = current.filter(candidate => candidate.color === control.color && equal(patch(rows, candidate.bbox), control.patch));
    if (matches.length !== 1) return null;
    offsets.push([matches[0]!.bbox[0] - control.bbox[0], matches[0]!.bbox[1] - control.bbox[1]]);
  }
  if (!offsets.length || offsets.some(offset => !equal(offset, offsets[0]))) return null;
  const [dx, dy] = offsets[0] as [number, number], geometry = model.editor_geometry;
  const x = geometry.member_column[0] + dx, [width, height] = geometry.member_size;
  const limit = Math.min(...current.map(control => control.bbox[1]));
  const members = rectangularMembers(rows, [{ bbox: [x, 0, x + width - 1, height - 1] }], palette(current), limit);
  return { controls: current.map(control => ({ ...control, patch: patch(rows, control.bbox) })), members,
    member_box: [x, 0, x + width - 1, limit - 1], member_size: [width, height], offset: [dx, dy], limit };
}

export function projectedProgramMembers(rows: NativeRows, layout: R, values: Set<number>): R[] {
  const x = layout.member_box[0], [width, height] = layout.member_size;
  return rectangularMembers(rows, [{ bbox: [x, 0, x + width - 1, height - 1] }], values, layout.limit);
}

export function programWorld(rows: NativeRows, model: R): R[] {
  const geometry = model.editor_geometry;
  return decodeProgramStacks(rows, model.layer, palette(geometry.controls), [geometry.member_column, geometry.footer]);
}

export function programWordAt(rows: NativeRows, model: R, base: readonly number[], word: readonly number[]): boolean {
  const step = model.layer.step, anchor = [base[0]! - word.length * step[0], base[1]! - word.length * step[1]];
  const image = renderProgramLayers(word, model.layer.shape, step);
  return word.length > 0 && [...image].every(([key, color]) => {
    const [x, y] = key.split(',').map(Number) as [number, number], u = anchor[0]! + x, v = anchor[1]! + y;
    return v >= 0 && v < rows.length && u >= 0 && u < rows[0]!.length && rows[v]![u] === color;
  });
}

export function markedCollectionQuestion(memory: Memory, observation: R, rows: NativeRows, _inputs: readonly R[] = []): R | null {
  const scene = collectionScene(rows);
  if (scene === null) return null;
  const recent = memory.markedEvents.filter(event => event.epoch === observation.level_epoch);
  if (recent.some(event => event.outcome.matched === false)) return null;
  const members: R[] = scene.members, marked: R[] = scene.marked_members;
  let mode: string, entity: R | null, action: R;
  if (marked.length && scene.marked_controls.length) { mode = 'remove'; entity = marked[0]!; }
  else if (scene.marked_controls.length) { mode = 'insert'; entity = scene.marked_controls[0]; }
  else if (recent.length && ['remove', 'insert'].includes(recent.at(-1)!.mode) && truth(recent.at(-1)!.outcome.matched)) {
    const actions = (observation.available_action_refs as string[]).filter(ref => ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'].includes(ref));
    if (actions.length !== 1) return null;
    mode = 'execute'; entity = null; action = { action_ref: actions[0] };
  } else return null;
  if (entity) {
    if (!observation.available_action_refs.includes('ACTION6')) return null;
    action = pointAction(entity.bbox);
  }
  const plan: R = { epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref,
    frame_digest: identity(rows), mode, action: action!, entity, scene, before_collection: colors(members),
    scope: 'Visible emphasis and shared appearances suggest an edit; the exact insertion/removal must be confirmed. A subsequent unique nonpoint input is only an execution experiment, with terminal role unknown.' };
  const ref = 'C_marked_collection_' + identity(plan).slice(0, 18);
  const why = ({ remove: 'Test removal of an emphasized member before inserting the independently emphasized control contribution.',
    insert: 'Test whether the emphasized control inserts its appearance in the related collection.',
    execute: 'Test the only available nonpoint input after a confirmed visible collection edit; observe whether the collection governs an effect elsewhere.' } as R)[mode];
  const facts = { homologous_collection_and_controls: true, current_edit_or_execution_question: true }, evidence = [observation.observation_ref];
  return { status: 'proposed', kind: 'marked_collection_edit', proposal_id: ref, marked_collection_plan: plan, actions: [action!],
    steps: [{ action: action!, expected_after: { mode, before_collection: plan.before_collection } }], facts,
    compositions: [{ id: ref, observed: false, open_question: why, properties: { mode }, relations: ['contributes_to:G_official_completion'] }],
    question: { reason: 'test_visible_collection_edit', hypothesis_refs: evidence }, route_refs: evidence,
    binding: { level_epoch: plan.epoch, observation_ref: plan.observation_ref },
    bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [], actions: [action!],
      purpose: why, preconditions: facts, evidence, outcome_guard: { path: ['value'], contains: ref } } };
}

export function packageObservedProgram(observation: R, plan: R, why: string): R | null {
  const actions = (plan.steps as R[]).map(step => step.action);
  if (actions.some(action => !observation.available_action_refs.includes(action.action_ref))) return null;
  const ref = 'C_program_composition_' + identity(plan).slice(0, 18);
  const facts = { public_phase_model_retained: true, current_collection_bound: true, experimental_projection_explicit: true };
  const evidence = [observation.observation_ref, plan.model.model_id, ...plan.model.evidence_refs];
  return { status: 'proposed', kind: 'public_program_composition', proposal_id: ref, program_composition_plan: plan, actions,
    steps: (plan.steps as R[]).map(step => ({ action: step.action, expected_after: { collection: step.after_word, scope: 'conditional public program projection' } })),
    facts, compositions: [{ id: ref, observed: false, open_question: why, properties: { mode: plan.mode, model_status: 'conditional' }, relations: ['contributes_to:G_official_completion'] }],
    question: { reason: 'compose_phase_observed_operators', hypothesis_refs: evidence }, route_refs: evidence,
    binding: { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref },
    bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [], actions,
      purpose: why, preconditions: facts, evidence, outcome_guard: { path: ['value'], contains: ref } } };
}

export function respondentProgramQuestion(observation: R, rows: NativeRows, model: R, layout: R, owner: R | null = null): R | null {
  if (owner === null || owner.word.length !== 1) return null;
  const objects = programWorld(rows, model), motions = new Map<number, number[]>();
  for (const move of model.moves as R[]) if (move.status === 'phase_observed_translation') motions.set(move.label, move.vectors[0]);
  const candidates: R[] = [];
  for (const object of objects) {
    if (equal(object.base, owner.base)) continue;
    if (objects.filter(candidate => equal(candidate.word, object.word)).length !== 1) continue;
    const first = [...object.word as number[]].reverse().find(label => motions.has(label));
    if (first === undefined) continue;
    const vector = motions.get(first)!;
    candidates.push({ object, operator: first, vector, expected_first_base: [object.base[0] + vector[0]!, object.base[1] + vector[1]!],
      scope: 'First matching translation on a different visible bearer, conditional on its preceding operations not interrupting execution.' });
  }
  if (!candidates.length || !observation.available_action_refs.includes(model.command_ref)) return null;
  const ownVector = motions.get(owner.word[0]);
  if (ownVector === undefined) return null;
  const inverse = [...motions].filter(([, vector]) => vector[0] === -ownVector[0]! && vector[1] === -ownVector[1]!).map(([label]) => label);
  const controls = (layout.controls as R[]).filter(control => inverse.includes(control.color));
  if (controls.length !== 1) return null;
  const control = controls[0]!, insert = pointAction(control.bbox), word = [control.color, ...owner.word];
  if (!observation.available_action_refs.includes(insert.action_ref)) return null;
  const ownPrediction = { object: { ...owner, word }, operator: owner.word[0], vector: ownVector,
    expected_first_base: [owner.base[0] + ownVector[0]!, owner.base[1] + ownVector[1]!],
    scope: 'Two phase-observed opposite translations, conditional on traversability. Expected final return to the input-bearing composition; input availability is not guaranteed.' };
  const command = { action_ref: model.command_ref }, actions = [insert, command];
  const plan = { epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref,
    frame_digest: identity(rows), model, layout, candidates, own_prediction: ownPrediction, owner_before: owner, insert_control: control,
    prepared_word: word, actions, command, own_collection_empty: false, stop_after_sealed_probe: true, expected_final_own_base: owner.base };
  const ref = 'C_respondent_operator_' + identity(plan).slice(0, 18);
  const why = 'Preserve the composition that exposes editing controls while testing another bearer: append a measured opposite operator, verify that edit, then execute the reversible pair. Separate own return, input restoration, and other-bearer translations are falsifiable hypotheses; stop after public reconciliation.';
  const facts = { public_other_word_contains_motion: true, own_collection_observed_single: true,
    opposite_operators_observed: true, respondent_operator_applicability_unknown: true };
  const evidence = [observation.observation_ref, model.model_id, ...model.evidence_refs];
  return { status: 'proposed', kind: 'public_program_respondent_probe', proposal_id: ref, respondent_probe_plan: plan, actions,
    steps: [{ action: insert, expected_after: { collection: word } }, { action: command, expected_after: {
      conditional_respondent_translations: candidates, conditional_own_return: owner.base, input_restoration: 'hypothesis', other_effects: 'unknown' } }],
    facts, compositions: [{ id: ref, observed: false, open_question: why, properties: { target: 'operator_applicability_and_preserved_input_access' }, relations: ['contributes_to:G_official_completion'] }],
    question: { reason: 'discriminate_respondent_operator_applicability', hypothesis_refs: evidence }, route_refs: evidence,
    binding: { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref },
    bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [], actions,
      purpose: why, preconditions: facts, evidence, outcome_guard: { path: ['value'], contains: ref } } };
}

/** Source search clocks are seconds; only the common native wrapper converts ms. */
function searchOptions(config: R, maxPrefix: number): { max_new_actions: number; deadline: number; now?: () => number } {
  const now: () => number = config.now ?? (() => performance.now() / 1000);
  return { max_new_actions: config.remaining_level_actions ?? maxPrefix, deadline: config.level_deadline ?? now() + 360,
    ...(config.now ? { now } : {}) };
}

/** ProgramCompositionAccess.program_question, before respondent specialization. */
export function programCompositionQuestion(memory: Memory, observation: R, rows: NativeRows, maxPrefix: number, config: R): R | null {
  if (!memory.compositionModels.length || memory.compositionRefutedEpochs.has(observation.level_epoch)) return null;
  const model = memory.compositionModels.at(-1)!, continuation = memory.compositionContinuation;
  if (truth(continuation) && continuation!.epoch === observation.level_epoch && continuation!.frame_digest === identity(rows)) {
    const turn = continuation!.turns[0], plan = { ...continuation, model, mode: 'execute', turns: continuation!.turns,
      frame_digest: identity(rows), observation_ref: observation.observation_ref, score: observation.levels_completed,
      steps: [{ mode: 'execute', before_word: continuation!.word, after_word: continuation!.word, action: { action_ref: model.command_ref }, turn }] };
    return packageObservedProgram(observation, plan, 'Continue the previously composed program after its entire expected public projection was matched; no new path search.');
  }
  const layout = programEditor(rows, model);
  if (!layout) return null;
  const controls: R[] = layout.controls, existing = colors(layout.members);
  if (!existing.length) {
    const learned = (model.moves as R[]).find(move => move.status === 'phase_observed_translation');
    const observed = memory.programEvents.length ? translationCandidates(memory.programEvents.at(-1)!.alignment) : [];
    const label = observed.length ? observed[0]!.label : learned ? learned.label : null;
    const control = controls.find(candidate => candidate.color === label);
    if (!control) return null;
    const action = pointAction(control.bbox);
    const plan = { model, mode: 'bind_single_member', epoch: observation.level_epoch, score: observation.levels_completed,
      frame_digest: identity(rows), observation_ref: observation.observation_ref, layout,
      steps: [{ mode: 'insert', before_word: [], after_word: [label], action }], word: [label], turns: [], own_base: null, targets: [] };
    return packageObservedProgram(observation, plan, 'Insert one phase-observed label to bind the currently empty collection to its visible bearer, before constructing a word. No execution is included in this binding probe.');
  }
  const objects = programWorld(rows, model), owners = objects.filter(object => equal(object.word, existing));
  if (owners.length !== 1) return null;
  const owner = owners[0]!, targets = objects.filter(object => object !== owner);
  if (!targets.length) return null;
  if (targets.some(object => (object.word as number[]).some(label => label !== model.interaction.label))) {
    const proposal = respondentProgramQuestion(observation, rows, model, layout, owner);
    return proposal && proposal.actions.length <= maxPrefix ? proposal : null;
  }
  const field = programSurface(rows, model, objects, owner.base);
  if (!field) return null;
  const found = searchProgram(existing, owner.base, targets, model, field, searchOptions(config, maxPrefix));
  if (found.status !== 'proposed') return null;
  const selected = found.plan, steps: R[] = []; let current = [...existing];
  for (const label of selected.edits as number[]) {
    const matches = controls.filter(control => control.color === label);
    if (matches.length !== 1) return null;
    const after = [label, ...current];
    steps.push({ mode: 'insert', before_word: current, after_word: after, action: pointAction(matches[0]!.bbox) }); current = after;
  }
  steps.push({ mode: 'execute', before_word: current, after_word: current, action: { action_ref: model.command_ref }, turn: selected.prediction.turns[0] });
  if (steps.length > maxPrefix) return null;
  const plan = { model, mode: 'construct_and_execute', epoch: observation.level_epoch, score: observation.levels_completed,
    frame_digest: identity(rows), observation_ref: observation.observation_ref, layout, steps, word: current, turns: selected.prediction.turns,
    own_base: owner.base, targets, target_counts: targets.map(target => target.word.length), field, search_nodes: found.nodes, search_scope: found.scope };
  return packageObservedProgram(observation, plan, 'Construct a prefix-preserving word whose conditional phase model reaches the earlier score-associated reduction. Verify each edit and the complete returned projection; cancel on discrepancy, including a global collection rewrite.');
}

/** Source ProgramRespondentAccess.program_question on the common retained state. */
export function observedProgramQuestion(memory: Memory, observation: R, rows: NativeRows, maxPrefix: number, config: R): R | null {
  const continuation = memory.compositionContinuation;
  if (truth(continuation) && truth(continuation!.respondent_predictions)) {
    if (continuation!.epoch !== observation.level_epoch || continuation!.frame_digest !== identity(rows)) return null;
    const model = memory.compositionModels.at(-1)!;
    const plan = { ...continuation, model, mode: 'execute', observation_ref: observation.observation_ref, score: observation.levels_completed,
      steps: [{ mode: 'execute', before_word: continuation!.word, after_word: continuation!.word, action: { action_ref: model.command_ref } }], turns: [] };
    return packageObservedProgram(observation, plan, 'Continue the retained composition under the still compatible respondent hypotheses; do not recompute its path after a matched return.');
  }
  const models = memory.respondentModels.filter(model => model.epoch === observation.level_epoch);
  if (!models.length || !memory.compositionModels.length) return programCompositionQuestion(memory, observation, rows, maxPrefix, config);
  const model = memory.compositionModels.at(-1)!, learned = models.at(-1)!, layout = programEditor(rows, model);
  if (!layout) return null;
  const word = colors(layout.members), objects = programWorld(rows, model), owners = objects.filter(object => equal(object.word, word));
  if (owners.length !== 1) return null;
  const owner = owners[0]!, targets = objects.filter(object => object !== owner);
  const ordering = new Map<string, number>((learned.order as R[]).map(entry => [JSON.stringify(entry.word), entry.first_effect]));
  if (!targets.length || targets.length !== ordering.size || targets.some(target => !ordering.has(JSON.stringify(target.word)))) return null;
  targets.sort((a, b) => ordering.get(JSON.stringify(a.word))! - ordering.get(JSON.stringify(b.word))!);
  const field = programSurface(rows, model, objects, owner.base);
  if (!field) return null;
  const options = searchOptions(config, maxPrefix), refusals = memory.extensionRefusals.filter(refusal => refusal.epoch === observation.level_epoch);
  let access: R | null = null, result: R;
  if (refusals.length) {
    const count = refusals.at(-1)!.word.length;
    result = searchRespondentReplacement(word, owner.base, targets, model, field, { ...options, max_members: count });
    if (result.status === 'unknown') {
      const supports = memory.inputSupports.filter(support => support.epoch === observation.level_epoch);
      if (supports.length) {
        const support = supports.at(-1)!, sites = candidateProgramInputSites(rows, field, support.support, owner.base);
        if (sites.length) {
          result = searchRespondentReplacement(word, owner.base, targets, model, field, { ...options, max_members: count, access_sites: sites });
          if (result.status === 'proposed') access = { support: support.support, sites, evidence: support.evidence,
            scope: 'Appearance-matched support; current pattern required and input restoration must be observed after arrival.' };
        }
      }
    }
  } else result = searchRespondentProgram(word, owner.base, targets, model, field, options);
  if (result.status !== 'proposed') return null;
  const selected = result.plan, steps: R[] = []; let current = [...word];
  for (let index = 0; index < (selected.removals ?? 0); index++) {
    const member = layout.members[index], later = current.slice(1);
    steps.push({ mode: 'remove', before_word: current, after_word: later, member_box: member.bbox, action: pointAction(member.bbox) }); current = later;
  }
  for (const label of selected.edits as number[]) {
    const controls = (layout.controls as R[]).filter(control => control.color === label);
    if (controls.length !== 1) return null;
    const later = [label, ...current];
    steps.push({ mode: 'insert', before_word: current, after_word: later, action: pointAction(controls[0]!.bbox) }); current = later;
  }
  steps.push({ mode: 'execute', before_word: current, after_word: current, action: { action_ref: model.command_ref } });
  if (steps.length > maxPrefix) return null;
  const plan = { model, mode: 'construct_and_execute', epoch: observation.level_epoch, score: observation.levels_completed,
    frame_digest: identity(rows), observation_ref: observation.observation_ref, layout, steps, word: current, turns: [], own_base: owner.base,
    targets, respondent_predictions: selected.predictions, respondent_order_evidence: learned.evidence, field, search_nodes: result.nodes,
    search_scope: result.scope, input_access: access, count_hypothesis_evidence: refusals.length ? refusals.at(-1)!.evidence : [] };
  const why = access
    ? 'Recompose toward an appearance-matched input-bearing support, then revalidate the actual controls before any later UI payload. A stationary extension refusal applies only to its exact context; member count is a conservative search hypothesis, not a universal capacity.'
    : 'Compose phase-observed operators with publicly ordered respondents. Keep both word-end reductions and both interaction scopes; require the chosen word to achieve the conditional reduction under all four models. Verify edits and every full return; only official score establishes completion.';
  return packageObservedProgram(observation, plan, why);
}

function markedBefore(proposal: R, index: number, rows: NativeRows, meta: R): R {
  const plan = proposal.marked_collection_plan;
  if (!truth(plan)) return { admitted: false, reason: 'missing_series_plan' };
  const admitted = index === 0 && equal([plan.epoch, plan.score, plan.observation_ref], [meta.epoch, meta.score, meta.observation_ref])
    && meta.available.includes(plan.action.action_ref) && identity(rows) === plan.frame_digest;
  return { admitted, reason: admitted ? 'measured_collection_question_bound' : 'collection_context_changed' };
}

function compositionBefore(proposal: R, index: number, rows: NativeRows, meta: R): R {
  const probe = proposal.respondent_probe_plan;
  if (truth(probe)) {
    let admitted = index >= 0 && index < probe.actions.length && equal([meta.epoch, meta.score], [probe.epoch, probe.score])
      && meta.available.includes(probe.actions[index].action_ref);
    if (index === 0) admitted = admitted && meta.observation_ref === probe.observation_ref && identity(rows) === probe.frame_digest;
    else {
      const members = projectedProgramMembers(rows, probe.layout, palette(probe.layout.controls));
      admitted = admitted && equal(colors(members), probe.prepared_word)
        && programWordAt(rows, probe.model, probe.owner_before.base, probe.prepared_word)
        && (probe.layout.controls as R[]).every(control => equal(patch(rows, control.bbox), control.patch))
        && (probe.candidates as R[]).every(candidate => programWordAt(rows, probe.model, candidate.object.base, candidate.object.word));
    }
    return { admitted, reason: admitted ? 'respondent_experiment_bound' : 'respondent_probe_context_changed' };
  }
  const plan = proposal.program_composition_plan;
  if (!truth(plan)) return markedBefore(proposal, index, rows, meta);
  if (index >= plan.steps.length || !equal([meta.epoch, meta.score], [plan.epoch, plan.score])) return { admitted: false, reason: 'program_scope_changed' };
  const step = (plan.steps as R[]).at(index)!, members = projectedProgramMembers(rows, plan.layout, palette(plan.model.editor_geometry.controls));
  let admitted = equal(colors(members), step.before_word) && meta.available.includes(step.action.action_ref);
  if (index === 0) admitted = admitted && identity(rows) === plan.frame_digest && meta.observation_ref === plan.observation_ref;
  if (step.mode === 'insert') {
    const point = step.action.data, matches = (plan.layout.controls as R[]).filter(control => control.bbox[0] <= point.x
      && point.x <= control.bbox[2] && control.bbox[1] <= point.y && point.y <= control.bbox[3]);
    admitted = admitted && matches.length === 1 && equal(patch(rows, matches[0]!.bbox), matches[0]!.patch);
  }
  if (truth(plan.own_base) && truth(step.before_word)) admitted = admitted && programWordAt(rows, plan.model, plan.own_base, step.before_word);
  const targets: R[] = plan.targets ?? [], counts: number[] = plan.target_counts ?? targets.map(target => target.word.length);
  for (let i = 0; i < Math.min(targets.length, counts.length); i++) {
    const count = counts[i]!, target = targets[i]!;
    admitted = admitted && (!count || programWordAt(rows, plan.model, target.base, target.word.slice(0, count)));
  }
  return { admitted, reason: admitted ? 'program_collection_and_operands_bound' : 'program_premise_changed' };
}

/** Respondent guard follows its parent's binding, exactly as in source MRO. */
export function observedProgramBefore(memory: Memory, proposal: R, index: number, rows: NativeRows, meta: R): R {
  const result = compositionBefore(proposal, index, rows, meta);
  if (!result.admitted) return result;
  const action = (proposal.actions as R[]).at(index)!;
  if (memory.extensionRefusals.some(refusal => refusal.epoch === meta.epoch && refusal.frame_digest === identity(rows) && equal(refusal.command, action))) {
    return { admitted: false, reason: 'exact_observed_extension_refusal' };
  }
  const plan = proposal.program_composition_plan;
  if (truth(plan)) {
    const step = (plan.steps as R[]).at(index)!;
    if (step.mode === 'remove') {
      const values = new Set(patch(rows, step.member_box).flat());
      if (values.size !== 1 || !values.has(step.before_word[0])) return { admitted: false, reason: 'removal_member_support_changed' };
    }
    const access = plan.input_access;
    if (truth(access)) {
      const pattern: NativeRows = access.support.pattern, height = pattern.length, width = pattern[0]!.length;
      // Repeated destinations are immaterial to all(), as with the source set.
      if (!(plan.respondent_predictions as R[]).every(prediction => {
        const [x, y] = prediction.turns.at(-1).base;
        return equal(patch(rows, [x, y, x + width - 1, y + height - 1]), pattern);
      })) return { admitted: false, reason: 'input_support_pattern_changed_before_access' };
    }
  }
  return result;
}

function markedAfter(proposal: R, _index: number, rows: NativeRows, later: NativeRows, meta: R): R {
  const plan = proposal.marked_collection_plan;
  if (!truth(plan)) return { matched: null, seal_prefix: true, reason: 'missing_series_plan' };
  if (meta.epoch !== plan.epoch || meta.score !== plan.score || ['WIN', 'GAME_OVER'].includes(meta.state)) {
    return { matched: null, seal_prefix: true, reason: 'official_boundary_or_terminal' };
  }
  if (plan.mode === 'execute') return { matched: null, seal_prefix: true, reason: 'execution_effect_observed_without_terminal_model', public_changed: identity(rows) !== identity(later) };
  const scene = collectionScene(later), expected = new Map<number, number>();
  for (const color of plan.before_collection as number[]) expected.set(color, (expected.get(color) ?? 0) + 1);
  expected.set(plan.entity.color, (expected.get(plan.entity.color) ?? 0) + (plan.mode === 'insert' ? 1 : -1));
  for (const [color, count] of expected) if (count <= 0) expected.delete(color);
  let actual: Map<number, number> | null = null;
  if (scene) {
    actual = new Map<number, number>();
    for (const member of scene.members as R[]) actual.set(member.color, (actual.get(member.color) ?? 0) + 1);
  }
  const matched = actual !== null && actual.size === expected.size && [...expected].every(([color, count]) => actual!.get(color) === count);
  return { matched, seal_prefix: true, reason: matched ? 'collection_edit_confirmed' : 'collection_edit_refuted',
    expected_member_count: [...expected.values()].reduce((sum, value) => sum + value, 0),
    observed_member_count: actual === null ? null : [...actual.values()].reduce((sum, value) => sum + value, 0) };
}

function compositionAfter(proposal: R, index: number, rows: NativeRows, later: NativeRows, meta: R): R {
  const probe = proposal.respondent_probe_plan;
  if (truth(probe)) {
    if (index === 0) {
      const members = projectedProgramMembers(later, probe.layout, palette(probe.layout.controls));
      const matched = meta.epoch === probe.epoch && meta.score === probe.score && equal(colors(members), probe.prepared_word)
        && programWordAt(later, probe.model, probe.owner_before.base, probe.prepared_word);
      return { matched, seal_prefix: !matched, reason: matched ? 'return_operator_inserted' : 'return_operator_edit_refuted' };
    }
    return { matched: null, seal_prefix: true, reason: 'respondent_packet_requires_scoped_reconciliation', official_progress: meta.score > probe.score };
  }
  const plan = proposal.program_composition_plan;
  if (!truth(plan)) return markedAfter(proposal, index, rows, later, meta);
  if (meta.epoch !== plan.epoch || meta.score !== plan.score || ['WIN', 'GAME_OVER'].includes(meta.state)) {
    return { matched: null, seal_prefix: true, reason: 'official_boundary_or_terminal' };
  }
  const step = (plan.steps as R[]).at(index)!, model = plan.model;
  const members = projectedProgramMembers(later, plan.layout, palette(model.editor_geometry.controls)), word = colors(members);
  let matched = equal(word, step.after_word);
  if (step.mode === 'insert') {
    if (truth(plan.own_base)) matched = matched && programWordAt(later, model, plan.own_base, word);
    return { matched, seal_prefix: !matched, reason: matched ? 'program_edit_projected' : 'program_edit_refuted', observed_member_count: word.length };
  }
  const turn = step.turn, objects = programWorld(later, model), owners = objects.filter(object => equal(object.base, turn.base) && equal(object.word, word));
  matched = matched && owners.length === 1;
  const targets: R[] = plan.targets, remaining: number[] = turn.remaining;
  for (let i = 0; i < Math.min(targets.length, remaining.length); i++) {
    const target = targets[i]!, count = remaining[i]!, matching = objects.filter(object => equal(object.base, target.base));
    matched = matched && (count ? matching.length === 1 && matching[0]!.word.length === count : matching.length === 0);
  }
  return { matched, seal_prefix: true, reason: matched ? 'returned_program_projection_matched' : 'returned_program_projection_refuted',
    expected_base: turn.base, observed_member_count: word.length, terminal_cause: 'unknown_until_official_boundary' };
}

/** Observed reductions remain conditional until an official boundary. */
export function observedProgramAfter(_memory: Memory, proposal: R, index: number, rows: NativeRows, later: NativeRows, meta: R): R {
  const plan = proposal.program_composition_plan, step: R | undefined = truth(plan) ? (plan.steps as R[]).at(index) : undefined;
  if (truth(plan) && step!.mode === 'remove') {
    const members = projectedProgramMembers(later, plan.layout, palette(plan.layout.controls));
    const matched = meta.epoch === plan.epoch && meta.score === plan.score && equal(colors(members), step!.after_word)
      && (!truth(step!.after_word) || programWordAt(later, plan.model, plan.own_base, step!.after_word));
    return { matched, seal_prefix: !matched, reason: matched ? 'member_removal_projected' : 'member_removal_refuted', observed_member_count: members.length };
  }
  if (!truth(plan) || !truth(plan.respondent_predictions) || step!.mode !== 'execute') return compositionAfter(proposal, index, rows, later, meta);
  if (meta.epoch !== plan.epoch || meta.score !== plan.score || ['WIN', 'GAME_OVER'].includes(meta.state)) {
    return { matched: null, seal_prefix: true, reason: 'official_boundary_or_terminal' };
  }
  const observed = programWorld(later, plan.model), matching: number[] = [];
  for (const [i, prediction] of (plan.respondent_predictions as R[]).entries()) {
    const turn = prediction.turns[0], expected = [{ base: turn.base, word: plan.word }, ...(turn.targets as R[]).filter(target => truth(target.word))];
    if (expected.length === observed.length && expected.every(wanted => observed.some(object => equal(object.base, wanted.base) && equal(object.word, wanted.word)))) matching.push(i);
  }
  return { matched: matching.length > 0, seal_prefix: true, reason: matching.length ? 'respondent_projection_matched' : 'respondent_projection_refuted',
    matching_hypotheses: matching, unknowns: 'Only decoded public word projections are compared; global terminal causality remains unknown.' };
}

/**
 * Own record layers, in source order: marked edit, composition, respondent.
 * The shared caller supplies higher inherited guards for mixed source envelopes.
 */
export function recordObservedProgram(memory: Memory, before: R, command: R, after: R, rows: NativeRows, later: NativeRows,
  proposal: R, index: number, guards: { before?: GuardBefore; after?: GuardAfter } = {}): R[] {
  const guardBefore = guards.before ?? ((p, i, r, meta) => observedProgramBefore(memory, p, i, r, meta));
  const guardAfter = guards.after ?? ((p, i, r, l, meta) => observedProgramAfter(memory, p, i, r, l, meta));
  const events: R[] = [], marked = proposal.marked_collection_plan;
  const add = (event: R): void => { memory.applyEvent(event); events.push(event); };
  if (truth(marked)) {
    const outcome = guardAfter(proposal, index, rows, later, { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
    add({ kind: 'marked_collection_result', epoch: before.level_epoch, mode: marked.mode, command,
      before_collection: marked.before_collection, outcome, evidence: [before.observation_ref, after.observation_ref] });
  }
  if (truth(marked) && ['remove', 'insert'].includes(marked.mode) && after.level_epoch === before.level_epoch) {
    const first = collectionScene(rows), second = collectionScene(later);
    if (first && second && Math.abs(first.members.length - second.members.length) === 1) {
      add({ kind: 'program_edit_sample', before_rows: rows, after_rows: later, before_members: first.members,
        after_members: second.members, epoch: before.level_epoch, evidence: [before.observation_ref, after.observation_ref] });
    }
  }
  const plan = proposal.program_composition_plan;
  if (truth(plan)) {
    const outcome = guardAfter(proposal, index, rows, later, { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
    let continuation: R | null = null;
    const step = (plan.steps as R[]).at(index)!;
    if (step.mode === 'execute' && outcome.matched === true && plan.turns.length > 1) {
      const turn = plan.turns[0];
      continuation = Object.fromEntries(['epoch', 'layout', 'word', 'targets'].map(key => [key, plan[key]]));
      Object.assign(continuation, { frame_digest: identity(later), own_base: turn.base, turns: plan.turns.slice(1), target_counts: turn.remaining });
    }
    add({ kind: 'program_composition_reconciled', epoch: before.level_epoch, outcome, refuted: outcome.matched === false,
      continuation, evidence: [before.observation_ref, after.observation_ref] });
  }
  const probe = proposal.respondent_probe_plan;
  if (truth(probe) && index === probe.actions.length - 1) {
    add({ kind: 'respondent_probe_pending', plan: probe, before_ref: before.observation_ref, after_ref: after.observation_ref,
      evidence: [before.observation_ref, after.observation_ref] });
  }
  if (truth(plan) && truth(plan.respondent_predictions) && (plan.steps as R[]).at(index)!.mode === 'insert'
    && equal(rows, later) && ['level_epoch', 'state', 'levels_completed', 'available_action_refs'].every(key => equal(before[key], after[key]))) {
    const step = (plan.steps as R[]).at(index)!;
    if (!equal(step.after_word, step.before_word) && guardBefore(proposal, index, rows,
      { epoch: before.level_epoch, score: before.levels_completed, available: before.available_action_refs, observation_ref: before.observation_ref }).admitted) {
      add({ kind: 'exact_program_extension_refusal', epoch: before.level_epoch, frame_digest: identity(rows), command,
        word: step.before_word, site: plan.own_base, evidence: [before.observation_ref, after.observation_ref],
        scope: 'Only this exact prefix/input/public context is refused. Count is a conservative search hypothesis; operator, content, site, and capacity explanations remain open.' });
    }
  }
  if (!truth(plan) || !truth(plan.respondent_predictions) || (plan.steps as R[]).at(index)!.mode !== 'execute') return events;
  const outcome = [...events].reverse().find(event => event.kind === 'program_composition_reconciled')!.outcome;
  let continuation: R | null = null, stop: string | null = null;
  if (outcome.matched === true) {
    const selected = (outcome.matching_hypotheses as number[]).map(i => plan.respondent_predictions[i]), turn = selected[0]!.turns[0];
    const remaining = selected.filter(prediction => prediction.turns.length > 1).map(prediction => ({ ...prediction, turns: prediction.turns.slice(1) }));
    if (remaining.length) {
      continuation = Object.fromEntries(['epoch', 'layout', 'word', 'respondent_order_evidence'].map(key => [key, plan[key]]));
      Object.assign(continuation, { frame_digest: identity(later), own_base: turn.base, targets: turn.targets,
        respondent_predictions: remaining, input_access: plan.input_access ?? null });
    } else if (truth(plan.input_access)) {
      if (programEditor(later, plan.model) === null) stop = 'input_access_hypothesis_refuted';
    } else stop = 'conditional_respondent_projection_complete_without_official_score';
  }
  add({ kind: 'respondent_composition_reconciled', epoch: before.level_epoch, continuation, outcome, stop_reason: stop,
    evidence: [before.observation_ref, after.observation_ref] });
  return events;
}

/** Complete ported packet chain, including existing marked phase alignment. */
export function recordObservedProgramPacket(memory: Memory, before: R, command: R, after: R, rows: NativeRows, frames: readonly NativeRows[]): R[] {
  const pending = memory.respondentPending;
  const events = memory.recordPacket(before, command, after, rows, frames);
  const add = (event: R): void => { memory.applyEvent(event); events.push(event); };
  const pendingMatches = truth(pending) && equal([pending!.before_ref, pending!.after_ref], [before.observation_ref, after.observation_ref]);
  if (pendingMatches) {
    const probe = pending!.plan;
    const observation = observeRespondentProgramPacket(probe, rows, frames, { same_epoch: after.level_epoch === before.level_epoch });
    const restored = frames.length > 0 && programWordAt(frames.at(-1)!, probe.model, probe.expected_final_own_base, probe.prepared_word)
      && (probe.layout.controls as R[]).every(control => equal(patch(frames.at(-1)!, control.bbox), control.patch));
    add({ kind: 'respondent_probe_result', epoch: before.level_epoch, ...observation, editing_composition_restored: restored,
      official_progress: after.levels_completed > before.levels_completed, evidence: [before.observation_ref, after.observation_ref] });
  }
  if (after.levels_completed > before.levels_completed && memory.programEvents.length) {
    const alignment = memory.programEvents.at(-1)!.alignment;
    if (alignment.after_ref === after.observation_ref) {
      for (const sample of memory.programEditSamples) {
        if (sample.epoch !== before.level_epoch) continue;
        const model = fitProgramCompositionModel(alignment, sample.before_rows, sample.after_rows, sample.before_members, sample.after_members,
          rows, frames, { official_progress: true });
        if (model) {
          add({ kind: 'fitted_program_composition', model, evidence: [before.observation_ref, after.observation_ref, ...sample.evidence] });
          break;
        }
      }
    }
  }
  if (pendingMatches && before.level_epoch === after.level_epoch) {
    const support = learnProgramInputSupport(pending!.plan, rows, frames);
    if (support) add({ kind: 'observed_input_support', epoch: before.level_epoch, support, evidence: [before.observation_ref, after.observation_ref] });
  }
  for (const event of [...events]) {
    if (event.kind !== 'respondent_probe_result' || !truth(pending) || !truth(event.editing_composition_restored) || truth(event.official_progress)) continue;
    if (!(event.results as R[]).every(result => truth(result.matching_packet_indices))) continue;
    const own = pending!.plan.prepared_word, order: R[] = [];
    for (const result of event.results as R[]) {
      const word = result.candidate.object.word;
      if (!equal(word, own)) order.push({ word, first_effect: Math.min(...result.matching_packet_indices), evidence_kind: 'prospective_local_translation' });
    }
    let unambiguous = true;
    for (const result of event.revealed_candidates as R[]) {
      if (result.compatible_retroprojections.length !== 1) { unambiguous = false; break; }
      order.push({ word: result.object.word, first_effect: result.first_complete_packet_index, evidence_kind: 'retrospective_revealed_translation' });
    }
    if (unambiguous && order.length && new Set(order.map(entry => JSON.stringify(entry.word))).size === order.length) {
      add({ kind: 'observed_respondent_order', epoch: before.level_epoch, order: order.sort((a, b) => a.first_effect - b.first_effect),
        evidence: event.evidence, model_id: pending!.plan.model.model_id, status: 'conditional_order_and_operator_transfer',
        uncertainties: ['Future order persistence', 'Which end of a heterogeneous word is removed',
          'Whether respondent interactions affect all other bearers', 'Completeness of visible body inventory'] });
    }
  }
  return events;
}
