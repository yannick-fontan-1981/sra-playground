/**
 * Explicit native evolution: ask what an unattributed current input does.
 * A public collection insertion and a public execution phase are separate
 * observations. Neither supplies an operator law or changes a retained model.
 * All questions issue one real action and return to common acquisition.
 */
import { bindCurrentProgramAccess } from './v6-program-current-access.ts';
import { geometricComponents } from './v6-native-observer.ts';
import { decodeProgramStacks } from './v6-program-geometry.ts';
import { alignOccurrenceProgramPacket, occurrenceRectangularMembers } from './v6-occurrence-program-observer.ts';
import { programIdentity as identity } from './v6-program-identity.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import type { NativeRows } from './v6-native-types.ts';
import type { OccurrenceRecord as R } from './v6-occurrence-scene.ts';

const schema = 'logos-engine.native.program-control-discovery.v1';
const words = (members: readonly R[]): number[] => members.map(member => member.color);
const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];
const center = (box: readonly number[]): number[] => [Math.floor((box[0]! + box[2]!) / 2), Math.floor((box[1]! + box[3]!) / 2)];
const modelDigest = (model: R): string => identity(model);
const sameCommand = (first: R, second: R): boolean => equal([first.action_ref, first.data ?? {}], [second.action_ref, second.data ?? {}]);
const knownLabels = (model: R): Set<number> => new Set([...(model.moves ?? []).map((move: R) => move.label), model.interaction?.label]
  .filter((value: unknown) => Number.isSafeInteger(value)));
const measuredLabels = (model: R): number[] => (model.editor_geometry?.controls ?? []).map((control: R) => control.color);
const baseValid = (model: R | null | undefined): model is R => !!model && typeof model.model_id === 'string'
  && model.status === 'conditional_program_composition_model' && Array.isArray(model.evidence_refs) && model.evidence_refs.length > 0
  && !!model.layer && Array.isArray(model.layer.shape) && Array.isArray(model.layer.step)
  && !!model.editor_geometry && typeof model.command_ref === 'string';

function retainedBindings(model: R, events: readonly R[], epoch?: number): R[] {
  const digest = modelDigest(model);
  return events.filter(event => event.kind === 'native_program_control_binding'
    && event.schema === schema && event.status === 'observed_collection_insertion'
    && event.model_id === model.model_id && event.model_digest === digest
    && (epoch === undefined || event.epoch === epoch) && typeof event.binding_id === 'string'
    && Array.isArray(event.evidence) && event.evidence.length === 2 && event.evidence.every((ref: unknown) => typeof ref === 'string')
    && Number.isSafeInteger(event.label) && event.label >= 0 && event.label <= 255);
}

function collection(rows: NativeRows, layout: R, labels?: ReadonlySet<number>): R[] {
  const [x] = layout.member_box, [width, height] = layout.member_size;
  if (labels) return occurrenceRectangularMembers(rows, [{ bbox: [x, 0, x + width - 1, height - 1] }], new Set(labels), layout.limit);
  // With no acquired palette, a flat strip of the surrounding background is
  // not a new member merely because its height matches. Require a separate
  // exact rectangular component in the measured member column.
  return geometricComponents(rows).filter(part => part.bbox[0] === x && part.bbox[2] === x + width - 1
    && part.bbox[3] < layout.limit && part.bbox[3] - part.bbox[1] + 1 === height && part.area === width * height)
    .map(part => ({ bbox: [...part.bbox], color: part.color, area: part.area })).sort((a, b) => a.bbox[1]! - b.bbox[1]!);
}

function world(rows: NativeRows, model: R, labels: ReadonlySet<number>): R[] {
  return decodeProgramStacks(rows, model.layer, labels, [model.editor_geometry.member_column, model.editor_geometry.footer]);
}

function controlKey(control: R, layout: R): string {
  const [dx, dy] = layout.offset;
  return identity([control.patch_digest, control.bbox.map((value: number, index: number) => value - (index % 2 ? dy : dx))]);
}

function snapshot(rows: NativeRows, model: R, layout: R, labels: ReadonlySet<number>): R | null {
  const members = collection(rows, layout, labels), all = collection(rows, layout);
  // A currently uncatalogued member may not silently disappear from a word.
  if (!equal(members, all)) return null;
  const word = words(members), objects = world(rows, model, labels);
  const owners = word.length ? objects.filter(object => equal(object.word, word)) : [];
  if (word.length && owners.length !== 1) return null;
  return { members, word, objects, owner: owners[0] ?? null };
}

function trialKey(mode: string, model: R, epoch: number, control: R, layout: R, scene: R): string {
  return identity([mode, model.model_id, modelDigest(model), epoch, controlKey(control, layout), scene.word,
    scene.owner?.base ?? null, scene.objects, mode === 'probe_execute' ? model.command_ref : 'ACTION6']);
}

function tried(events: readonly R[], key: string): boolean {
  return events.some(event => event.kind === 'native_program_control_trial' && event.schema === schema && event.trial_key === key);
}

function packageProbe(observation: R, plan: R, why: string): R {
  const ref = 'C_program_control_probe_' + identity(plan).slice(0, 18), evidence = unique([
    observation.observation_ref, plan.model.model_id, ...plan.model.evidence_refs, ...(plan.binding?.evidence ?? []),
  ]);
  const facts = { acquired_editor_context: true, current_input_question_bound: true, new_operator_effect_unknown: true };
  return { status: 'proposed', kind: 'public_program_control_probe', proposal_id: ref, program_control_probe_plan: plan,
    actions: [plan.action], steps: [{ action: plan.action, expected_after: { status: 'unknown', scope: 'A real return is required before any input or operator claim.' } }],
    facts, compositions: [{ id: ref, observed: false, open_question: why, properties: { mode: plan.mode, operator_status: 'unknown' },
      relations: ['contributes_to:G_official_completion'] }],
    question: { reason: 'measure_unattributed_program_control', hypothesis_refs: evidence }, route_refs: evidence,
    binding: { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref },
    bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [],
      actions: [plan.action], purpose: why, preconditions: facts, evidence, outcome_guard: { path: ['value'], contains: ref } } };
}

/** An acquired label in a current word must not be omitted by the old palette. */
export function programControlDiscoveryBlocksOrdinaryPlan(model: R, events: readonly R[], rows: NativeRows): boolean {
  if (!baseValid(model)) return false;
  const bindings = retainedBindings(model, events), unknown = new Set(bindings.map(binding => binding.label).filter(label => !knownLabels(model).has(label)));
  if (!unknown.size) return false;
  const access = bindCurrentProgramAccess(rows, model);
  if (access.status !== 'bound') return false;
  return collection(rows, access.layout, unknown).length > 0;
}

/**
 * Called only after the ordinary source program questions decline. No visual
 * similarity assigns an operator. The execution question requires a binding
 * present in acquired events and exactly one occurrence of its new label.
 */
export function programControlDiscoveryQuestion(model: R, events: readonly R[], observation: R, rows: NativeRows): R | null {
  if (!baseValid(model) || !Array.isArray(observation.available_action_refs) || ['WIN', 'GAME_OVER'].includes(observation.state)) return null;
  const access = bindCurrentProgramAccess(rows, model, observation);
  if (access.status !== 'bound' || !access.unknown_controls.length) return null;
  const bindings = retainedBindings(model, events, observation.level_epoch);
  const labels = new Set([...measuredLabels(model), ...bindings.map(binding => binding.label)]);
  const scene = snapshot(rows, model, access.layout, labels);
  if (!scene) return null;
  const common = { schema, epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref,
    frame_digest: identity(rows), model, model_digest: modelDigest(model), current_access: access.evidence,
    layout: { ...access.layout, members: scene.members }, before_word: scene.word, owner: scene.owner, objects: scene.objects,
    palette: [...labels].sort((a, b) => a - b), operator_status: 'unknown' };
  for (const control of access.unknown_controls) {
    const key = controlKey(control, access.layout), candidates = bindings.filter(binding => binding.control_key === key);
    if (candidates.length) {
      const binding = candidates.at(-1)!;
      if (new Set(candidates.map(candidate => candidate.label)).size !== 1 || !scene.owner
        || !equal(scene.word, binding.after_word) || scene.word.filter((label: number) => label === binding.label).length !== 1
        || scene.word.some((label: number) => label !== binding.label && !knownLabels(model).has(label))
        || !equal(scene.owner.base, binding.owner_after.base) || !equal(scene.objects, binding.objects_after)
        || !observation.available_action_refs.includes(model.command_ref)) continue;
      const trial = trialKey('probe_execute', model, observation.level_epoch, control, access.layout, scene);
      if (tried(events, trial)) continue;
      return packageProbe(observation, { ...common, mode: 'probe_execute', control, control_key: key, binding,
        binding_digest: identity(binding), trial_key: trial, action: { action_ref: model.command_ref } },
      'Execute the freshly observed collection once to measure the new member’s public phase. The insertion binding is acquired; its operator effect, preservation and terminal meaning remain unknown. Stop after this real return.');
    }
  }
  if (!observation.available_action_refs.includes('ACTION6') || scene.word.some((label: number) => !knownLabels(model).has(label))) return null;
  for (const control of access.unknown_controls) {
    const key = controlKey(control, access.layout);
    if (bindings.some(binding => binding.control_key === key)) continue;
    const trial = trialKey('probe_edit', model, observation.level_epoch, control, access.layout, scene);
    if (tried(events, trial)) continue;
    const [x, y] = center(control.bbox);
    return packageProbe(observation, { ...common, mode: 'probe_edit', control, entity: control, control_key: key,
      trial_key: trial, action: { action_ref: 'ACTION6', data: { x, y } } },
    'Test one currently unattributed row appearance in an acquired editor. Measure whether the actual return inserts a collection member; do not infer its label from glyph colour, its effect from resemblance, or its role from the missing control.');
  }
  return null;
}

/** The caller supplies its actual retained model and journal in meta. */
export function programControlDiscoveryBefore(proposal: R, index: number, rows: NativeRows, meta: R): R {
  const plan = proposal.program_control_probe_plan, model: R | undefined = meta.model, events: readonly R[] | undefined = meta.events;
  const reject = (reason: string): R => ({ admitted: false, reason });
  if (index !== 0 || !plan || plan.schema !== schema || !baseValid(model) || !Array.isArray(events)
    || !equal(model, plan.model) || modelDigest(model) !== plan.model_digest) return reject('control_probe_retained_context_missing');
  if (!equal([plan.epoch, plan.score, plan.observation_ref], [meta.epoch, meta.score, meta.observation_ref])
    || identity(rows) !== plan.frame_digest || !Array.isArray(meta.available) || !meta.available.includes(plan.action?.action_ref)
    || !equal(proposal.actions, [plan.action])) return reject('control_probe_context_changed');
  const current = programControlDiscoveryQuestion(model, events, { level_epoch: meta.epoch, levels_completed: meta.score,
    observation_ref: meta.observation_ref, available_action_refs: meta.available, state: meta.state }, rows);
  if (!current || !equal(current.program_control_probe_plan, plan)) return reject('control_probe_evidence_or_binding_changed');
  return { admitted: true, reason: 'current_unattributed_input_experiment_bound' };
}

/** An unexpected result is information, not a refutation of the old model. */
export function programControlDiscoveryAfter(proposal: R, index: number, rows: NativeRows, later: NativeRows, meta: R): R {
  const plan = proposal.program_control_probe_plan;
  if (!plan || index !== 0) return { matched: null, seal_prefix: true, reason: 'missing_control_probe' };
  return { matched: null, seal_prefix: true,
    reason: meta.epoch !== plan.epoch || meta.score !== plan.score || ['WIN', 'GAME_OVER'].includes(meta.state)
      ? 'control_probe_official_boundary' : 'control_probe_requires_public_measurement',
    public_changed: identity(rows) !== identity(later), operator_status: 'unknown' };
}

function insertedMember(plan: R, later: NativeRows): R | null {
  const afterMembers = collection(later, plan.layout), afterWord = words(afterMembers), beforeWord: number[] = plan.before_word;
  if (afterWord.length !== beforeWord.length + 1) return null;
  const candidates = afterWord.flatMap((label, index) => equal(afterWord.filter((_, i) => i !== index), beforeWord) ? [{ label, index }] : []);
  // Repeated equal labels do not locate a unique insertion occurrence.
  if (candidates.length !== 1) return null;
  const candidate = candidates[0]!, labels = new Set<number>([...plan.palette, candidate.label]);
  const afterObjects = world(later, plan.model, labels), owners = afterObjects.filter(object => equal(object.word, afterWord));
  if (owners.length !== 1 || plan.owner && !equal(owners[0]!.base, plan.owner.base)) return null;
  const beforeOthers = (plan.objects as R[]).filter(object => !plan.owner || !equal(object, plan.owner));
  const afterOthers = afterObjects.filter(object => object !== owners[0]);
  if (!equal(beforeOthers, afterOthers)) return null;
  const current = bindCurrentProgramAccess(later, plan.model);
  if (current.status !== 'bound' || !equal(current.evidence.geometry, plan.current_access.geometry)) return null;
  return { label: candidate.label, insertion_index: candidate.index, members_after: afterMembers, after_word: afterWord,
    owner_after: owners[0], objects_after: afterObjects,
    scope: 'One exact public collection insertion and its same-base visual bearer; no operator effect or causal completeness is inferred.' };
}

function phaseWorldDifference(first: R[], last: R[]): R {
  const preserved = first.filter(object => last.some(other => equal(object.base, other.base) && equal(object.word, other.word)));
  const before = first.filter(object => !preserved.includes(object));
  const after = last.filter(object => !preserved.some(other => equal(object.base, other.base) && equal(object.word, other.word)));
  const translations: R[] = [], changes: R[] = [];
  for (const object of before) {
    const sameWord = after.filter(other => equal(other.word, object.word));
    if (sameWord.length === 1 && before.filter(other => equal(other.word, object.word)).length === 1) {
      const other = sameWord[0]!;
      translations.push({ word: object.word, before_base: object.base, after_base: other.base,
        vector: object.base.map((value: number, index: number) => other.base[index] - value), status: 'unique_public_word_correspondence' });
    }
    const sameBase = after.filter(other => equal(other.base, object.base));
    if (sameBase.length === 1 && before.filter(other => equal(other.base, object.base)).length === 1) {
      const other = sameBase[0]!;
      changes.push({ base: object.base, before_word: object.word, after_word: other.word,
        member_count_delta: other.word.length - object.word.length, status: 'same_base_public_word_change' });
    }
  }
  return { before_objects: first, after_objects: last, preserved_objects: preserved, translations, word_changes: changes,
    unmatched_before: before.filter(object => !translations.some(item => equal(item.before_base, object.base))
      && !changes.some(item => equal(item.base, object.base))),
    unmatched_after: after.filter(object => !translations.some(item => equal(item.after_base, object.base))
      && !changes.some(item => equal(item.base, object.base))),
    scope: 'Measured appearances and conditional correspondences only; disappearance is not a universal removal law.' };
}

/** No raw film is duplicated: common acquisition already retains the packet. */
function measureExecution(plan: R, rows: NativeRows, frames: readonly NativeRows[], after: R): R {
  const controls = [...plan.layout.controls, { bbox: plan.control.bbox, patch: plan.control.patch,
    color: plan.binding.label, area: plan.control.patch.flat().filter((value: number) => value === plan.binding.label).length }];
  const alignment = alignOccurrenceProgramPacket(rows, frames, { members: plan.layout.members, controls,
    observation_ref: plan.observation_ref, after_observation_ref: after.observation_ref, epoch: plan.epoch, command_ref: plan.action.action_ref });
  const images = [rows, ...frames], labels = new Set<number>(plan.palette);
  const phases: R[] = [];
  if (alignment.status === 'phase_aligned_candidates') for (const phase of alignment.phases as R[]) {
    if (!Number.isSafeInteger(phase.endpoint) || phase.endpoint <= phase.start || phase.endpoint >= images.length) continue;
    phases.push({ member_index: phase.member_index, label: phase.label, new_control_label: phase.label === plan.binding.label,
      start: phase.start, endpoint: phase.endpoint, evidence: phase.evidence,
      start_frame_digest: identity(images[phase.start]), endpoint_frame_digest: identity(images[phase.endpoint]),
      residual: phase.effect, world: phaseWorldDifference(world(images[phase.start]!, plan.model, labels), world(images[phase.endpoint]!, plan.model, labels)) });
  }
  const measured = phases.filter(phase => phase.new_control_label);
  return { status: measured.length === 1 ? 'isolated_public_phase_measured' : 'operator_effect_unresolved',
    reason: measured.length === 1 ? 'one_new_member_phase_with_public_endpoint' : alignment.reason ?? 'no_unique_new_member_phase',
    binding_id: plan.binding.binding_id, label: plan.binding.label, phases, alignment_status: alignment.status,
    excluded_from: alignment.excluded_from ?? null, packet_frame_count: frames.length,
    packet_frame_digests: frames.map(frame => identity(frame)), official_progress: after.levels_completed > plan.score,
    operator_model_created: false,
    scope: 'Isolated public phases are measurements. No movement, reduction, repetition, terminal role or interchangeability law is promoted. A final collection rewrite and official boundary are excluded from phase attribution.' };
}

/** Only actual, currently admitted command/return pairs create acquired facts. */
export function recordProgramControlDiscovery(before: R, command: R, after: R, rows: NativeRows, later: NativeRows,
  frames: readonly NativeRows[], proposal: R, context: { model?: R | null; events: readonly R[] }): R[] {
  const plan = proposal.program_control_probe_plan;
  if (!plan || !sameCommand(command, plan.action)) return [];
  const admitted = programControlDiscoveryBefore(proposal, 0, rows, { epoch: before.level_epoch, score: before.levels_completed,
    observation_ref: before.observation_ref, available: before.available_action_refs, state: before.state, ...context });
  if (!admitted.admitted) return [];
  const evidence = [before.observation_ref, after.observation_ref], common = { schema, epoch: before.level_epoch,
    model_id: plan.model.model_id, model_digest: plan.model_digest, control_key: plan.control_key,
    control: plan.control, evidence, before_ref: before.observation_ref, after_ref: after.observation_ref };
  const trial: R = { ...common, kind: 'native_program_control_trial', mode: plan.mode, trial_key: plan.trial_key,
    command, before_word: plan.before_word, before_frame_digest: identity(rows), after_frame_digest: identity(later),
    public_changed: !equal(rows, later), official_progress: after.levels_completed > before.levels_completed,
    operator_status: 'unknown' };
  const events = [trial];
  if (plan.mode === 'probe_edit') {
    const sameEpoch = before.level_epoch === after.level_epoch && before.levels_completed === after.levels_completed
      && !['WIN', 'GAME_OVER'].includes(after.state);
    const measured = sameEpoch ? insertedMember(plan, later) : null;
    trial.outcome = measured ? 'collection_insertion_measured' : 'collection_insertion_unresolved';
    if (measured) {
      const binding: R = { ...common, ...measured, kind: 'native_program_control_binding', status: 'observed_collection_insertion',
        before_word: plan.before_word, owner_before: plan.owner, current_access: plan.current_access,
        insertion_command: command, operator_status: 'unknown' };
      binding.binding_id = 'program-control-binding:' + identity(binding).slice(0, 24);
      events.push(binding);
    }
  } else if (plan.mode === 'probe_execute') {
    const measurement = measureExecution(plan, rows, frames, after);
    trial.outcome = measurement.status;
    events.push({ ...common, ...measurement, kind: 'native_program_control_effect', trial_key: plan.trial_key, command });
  }
  return events;
}
