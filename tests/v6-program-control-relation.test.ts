import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { programIdentity } from '../src/logos-engine/v6-program-identity.ts';
import type { NativeExecution, NativeFamily, NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { bindCurrentProgramAccess } from '../src/logos-engine/v6-program-current-access.ts';
import { acquireProgramRelationModels, retainedProgramRelations, predictProgramRelation,
  programRelationQuestion, programRelationBefore, programRelationAfter, recordProgramRelation,
  programRelationWitness } from '../src/logos-engine/v6-program-relations.ts';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const root = new URL('../', import.meta.url);
const reportPath = 'docs/migration/native-campaigns-v41/diagnostics/stck-control-discovery-six-level-attempt.json';
const tracePath = 'docs/migration/native-campaigns-v41/diagnostics/stck-control-discovery-public.json.gz';
const [reportBytes, traceBytes, diagnosisBytes, auditBytes] = await Promise.all([
  readFile(new URL(reportPath, root)), readFile(new URL(tracePath, root)),
  readFile(new URL('docs/migration/native-campaigns-v39/diagnostics/stck-level-four-program-diagnosis.json', root)),
  readFile(new URL('docs/migration/native-campaigns-v41/diagnostics/stck-control-discovery-audit.json', root)),
]);
const report = JSON.parse(reportBytes.toString()), trace = JSON.parse(gunzipSync(traceBytes).toString());
const diagnosis = JSON.parse(diagnosisBytes.toString()), audit = JSON.parse(auditBytes.toString());
const edit = report.prefixes.at(-2).sharedSeries.nativeControlDiscovery;
const execution = report.prefixes.at(-1).sharedSeries.nativeControlDiscovery;
const acquiredEvents: R[] = [edit.latestTrial, edit.latestBinding, execution.latestTrial, execution.latestEffect];
const session = edit.latestBinding.evidence[0].split(':epoch:')[0];
const normalized = (command: R): R => ({ action_ref: command.action_ref, data: command.data ?? {} });
const [v42ReportBytes, v42TraceBytes] = await Promise.all([
  readFile(new URL('docs/migration/native-campaigns-v42/stck-four-levels.json', root)),
  readFile(new URL('docs/migration/native-campaigns-v42/stck-four-level-public-trace.json.gz', root)),
]);
const v42Report = JSON.parse(v42ReportBytes.toString()), v42Trace = JSON.parse(gunzipSync(v42TraceBytes).toString());
const v42Binding = v42Report.prefixes.find((prefix: R) => prefix.decisionRevision === 38).sharedSeries.nativeControlDiscovery.latestBinding;
const v42Session = v42Binding.evidence[0].split(':epoch:')[0];

/** Reconstruct the complete recorded V41 source model, not a new fitted model.
 * The old public diagnostic contains its full payload. Only session-qualified
 * evidence references differ; the V41 acquired digest independently verifies
 * every reconstructed value before any relation question is tested. */
function recordedModel(binding: R = edit.latestBinding): R {
  const previousSession = diagnosis.model.evidence_refs[0].split(':epoch:')[0];
  const currentSession = binding.evidence[0].split(':epoch:')[0];
  const rebind = (value: any): any => typeof value === 'string' ? value.replaceAll(previousSession, currentSession)
    : Array.isArray(value) ? value.map(rebind) : value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rebind(child)])) : value;
  const model = rebind(diagnosis.model);
  delete model.model_id;
  model.model_id = 'program-model:' + programIdentity(model).slice(0, 20);
  assert.equal(model.model_id, binding.model_id);
  assert.equal(programIdentity(model), binding.model_digest,
    'The full reconstructed model must match the independently acquired public identity');
  return model;
}

/** Reconstruct only the native event subsequence from monotonic counters and
 * acquired event payloads. These are evidence fixtures, never live replay input. */
function v42Journal(through = 45): R[] {
  const events: R[] = [], counts: R = {};
  for (const prefix of v42Report.prefixes as R[]) {
    if (prefix.callerAcquiredTransitions > through) break;
    const control = prefix.sharedSeries.nativeControlDiscovery, relation = prefix.sharedSeries.nativeProgramRelations;
    for (const [key, group, count, latest] of [
      ['controlTrial', control, 'trialCount', 'latestTrial'], ['controlBinding', control, 'bindingCount', 'latestBinding'],
      ['controlEffect', control, 'effectCount', 'latestEffect'], ['relationTrial', relation, 'trialCount', 'latestTrial'],
      ['relationModel', relation, 'modelCount', 'latestModel'], ['relationRefutation', relation, 'refutationCount', 'latestRefutation'],
    ] as [string, R, string, string][]) {
      const before = counts[key] ?? 0, after = group[count];
      assert.ok(after === before || after === before + 1, 'One physical prefix cannot conceal a missing same-kind event in this fixture');
      if (after > before) { assert.ok(group[latest]); events.push(copy(group[latest])); }
      counts[key] = after;
    }
  }
  return events;
}

async function v42View(index: number) {
  const packet: NativePublicObservation = copy(v42Trace.packets[index].packet);
  const observation = await measureNativeObservation(packet, index + 1, v42Session);
  return { packet, observation };
}

function metadata(model: R, events: R[], packet: NativePublicObservation, observation: R): R {
  return { model, events, epoch: observation.level_epoch, score: observation.levels_completed,
    observation_ref: observation.observation_ref, available: packet.available_action_refs, state: packet.state };
}

async function publicView(index = 39) {
  const packet: NativePublicObservation = copy(trace.packets[index].packet);
  const observation = await measureNativeObservation(packet, index + 1, session);
  return { packet, observation };
}

function retainedFixture() {
  const model = recordedModel(), events = copy(acquiredEvents);
  const acquired = acquireProgramRelationModels(model, events);
  assert.equal(acquired.length, 1);
  assert.equal(acquired[0]!.kind, 'native_program_relation_model');
  events.push(...acquired);
  const retained = retainedProgramRelations(model, events);
  assert.equal(retained.length, 1);
  return { model, events, acquired, relation: retained[0]! };
}

function observedPhase(events: R[] = copy(acquiredEvents)): R {
  return events.find(event => event.kind === 'native_program_control_effect')!.phases.find((phase: R) => phase.new_control_label);
}

function phaseObjects() {
  const phase = observedPhase(), objects: R[] = copy(phase.world.before_objects);
  const bearer = objects.find(object => assertWord(object.word, [7, 9]))!;
  return { bearer, objects };
}

function assertWord(first: number[], second: number[]): boolean {
  return first.length === second.length && first.every((label, index) => label === second[index]);
}

test('the relational fixture reconstructs the actual public V41 model and four acquired events', async () => {
  const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha(reportBytes), audit.inputs.canonicalReport.sha256);
  assert.equal(sha(traceBytes), audit.inputs.canonicalPublicTrace.sha256);
  const model = recordedModel(), events = copy(acquiredEvents), current = await publicView();
  assert.deepEqual(events.map(event => event.kind), ['native_program_control_trial', 'native_program_control_binding',
    'native_program_control_trial', 'native_program_control_effect']);
  assert.ok(events.every(event => event.model_id === model.model_id && event.model_digest === programIdentity(model)));
  assert.deepEqual(normalized(events[0]!.command), normalized(trace.packets[38].command));
  assert.deepEqual(normalized(events[2]!.command), normalized(trace.packets[39].command));
  assert.equal(current.observation.observation_ref, events[3]!.after_ref);
  assert.equal(events[1]!.label, 7);
  assert.deepEqual(events[1]!.before_word, [9]);
  assert.deepEqual(events[1]!.after_word, [7, 9]);
  const phase = events[3]!.phases.find((item: R) => item.new_control_label);
  assert.equal(events[3]!.phases.filter((item: R) => item.new_control_label).length, 1);
  assert.deepEqual(phase.world.translations[0].vector, [4, 2]);
  assert.deepEqual(phase.world.translations[0].word, [8, 8, 8]);
  assert.deepEqual(phase.world.preserved_objects[0].word, [7, 9]);
  assert.equal(events[3]!.operator_model_created, false);
  assert.equal(report.final.levelsCompleted, 3);
  assert.equal(report.final.reason, 'frontier_unknown');
});

test('real acquired evidence supports a narrow relation while retaining absolute, relative and causal ambiguity', () => {
  const model = recordedModel(), events = copy(acquiredEvents), oldModel = copy(model), oldEvents = copy(events);
  assert.deepEqual(retainedProgramRelations(model, events), [], 'A read-only question must not acquire its own fitted state');
  const added = acquireProgramRelationModels(model, events);
  assert.equal(added.length, 1);
  assert.deepEqual(model, oldModel);
  assert.deepEqual(events, oldEvents);
  const relation = added[0]!.model;
  assert.equal(relation.status, 'conditional_relative_public_translation');
  assert.equal(relation.source_model_id, model.model_id);
  assert.equal(relation.source_model_digest, programIdentity(model));
  assert.equal(relation.support_count, 1);
  assert.deepEqual(relation.candidates, [{ kind: 'fixed_delta', delta: [4, 2] }, { kind: 'radial_delta', coefficient: 1 }]);
  assert.deepEqual(relation.observed_offset, [4, 2]);
  assert.deepEqual(relation.observed_delta, [4, 2]);
  assert.deepEqual(relation.respondent_word, [8, 8, 8]);
  assert.deepEqual(relation.samples[0].preceding_labels, [9]);
  assert.deepEqual(relation.samples[0].residual, observedPhase().residual,
    'The concurrent public display changes cannot be dropped from the measurement');
  assert.equal(relation.causal_status, 'phase_association_not_causal_identification');
  assert.ok(relation.uncertainties.some((item: string) => /delayed response/i.test(item)));
  assert.ok(relation.uncertainties.some((item: string) => /terminal/i.test(item)));
  assert.equal(model.interaction.label, 8, 'A relation is not an alias for the source reduction operator');
  assert.ok(!model.moves.some((move: R) => move.label === relation.label), 'Respondent displacement is not bearer movement');
});

test('relation recall reconstructs from actual journal events and rejects unsupported model-shaped state', () => {
  const { model, events, acquired, relation } = retainedFixture(), previous = copy(events);
  assert.deepEqual(acquireProgramRelationModels(model, events), [], 'The same public effect is acquired once');
  assert.deepEqual(retainedProgramRelations(model, copy(events)), [relation]);
  assert.deepEqual(events, previous);
  assert.deepEqual(retainedProgramRelations(model, copy(acquired)), [], 'A fitted object alone cannot create its evidence');
  const altered = copy(events), last = altered.at(-1)!;
  last.model.candidates = [{ kind: 'radial_delta', coefficient: 1 }];
  assert.deepEqual(retainedProgramRelations(model, altered), [], 'An unsupported elimination of the fixed-vector alternative cannot survive recall');
  const unsupportedSupport = copy(events);
  unsupportedSupport.at(-1)!.model.support_count = 2;
  assert.deepEqual(retainedProgramRelations(model, unsupportedSupport), [], 'A support count is not a second measured trial');
});

for (const change of [
  { id: 'missing insertion binding', apply: (events: R[]) => events.splice(1, 1) },
  { id: 'missing acquired execution trial', apply: (events: R[]) => events.splice(2, 1) },
  { id: 'effect before its binding', apply: (events: R[]) => events.unshift(events.pop()!) },
  { id: 'different retained source digest', apply: (events: R[]) => { events[3]!.model_digest = 'different-source-model'; } },
  { id: 'another visual control identity', apply: (events: R[]) => { events[3]!.control_key = 'another-input'; } },
  { id: 'nonisolated phase status', apply: (events: R[]) => { events[3]!.status = 'operator_effect_unresolved'; } },
  { id: 'two new-label phases', apply: (events: R[]) => { events[3]!.phases.push(copy(observedPhase(events))); } },
  { id: 'wrong member phase index', apply: (events: R[]) => { observedPhase(events).member_index = 1; } },
  { id: 'phase reaching excluded collection rewrite', apply: (events: R[]) => { observedPhase(events).endpoint = events[3]!.excluded_from; } },
  { id: 'official boundary instead of local evidence', apply: (events: R[]) => { events[3]!.official_progress = true; } },
  { id: 'moved bearer', apply: (events: R[]) => {
    observedPhase(events).world.after_objects.find((object: R) => assertWord(object.word, [7, 9])).base[0]++;
  } },
  { id: 'changed respondent word', apply: (events: R[]) => {
    observedPhase(events).world.after_objects.find((object: R) => assertWord(object.word, [8, 8, 8])).word.pop();
  } },
  { id: 'another same-word occurrence in the full inventory', apply: (events: R[]) => {
    const world = observedPhase(events).world, other = copy(world.before_objects.find((object: R) => assertWord(object.word, [8, 8, 8])));
    other.base = [18, 18]; other.anchor = [18, 15];
    world.before_objects.push(other); world.after_objects.push(copy(other)); world.preserved_objects.push(copy(other));
  } },
  { id: 'respondent with the bearer word', apply: (events: R[]) => {
    const world = observedPhase(events).world;
    for (const key of ['before_objects', 'after_objects']) world[key].find((object: R) => assertWord(object.word, [8, 8, 8])).word = [7, 9];
  } },
  { id: 'unmatched earlier body', apply: (events: R[]) => { observedPhase(events).world.unmatched_before.push({ base: [14, 16], word: [8] }); } },
  { id: 'unmatched returned body', apply: (events: R[]) => { observedPhase(events).world.unmatched_after.push({ base: [14, 16], word: [8] }); } },
  { id: 'simultaneous word change', apply: (events: R[]) => {
    observedPhase(events).world.word_changes.push({ base: [38, 22], before_word: [8, 8, 8], after_word: [8, 8] });
  } },
]) test(`relation acquisition refuses ${change.id}`, () => {
  const model = recordedModel(), events = copy(acquiredEvents); change.apply(events);
  assert.deepEqual(acquireProgramRelationModels(model, events), []);
});

test('a transported scene preserves role-bound prediction without pretending to distinguish the two laws', () => {
  const { relation } = retainedFixture(), { bearer, objects } = phaseObjects();
  const first = predictProgramRelation(relation, bearer, objects, [9]);
  assert.equal(first.status, 'conditional_projection');
  assert.deepEqual(first.bearer_after, bearer);
  assert.deepEqual(first.respondent_after.base, [42, 24]);
  assert.equal(first.prefix_status, 'observed_prefix');
  const displacement = [13, -7];
  const moved = objects.map(object => ({ ...copy(object), base: object.base.map((value: number, index: number) => value + displacement[index]!),
    anchor: object.anchor.map((value: number, index: number) => value + displacement[index]!) }));
  const movedBearer = moved.find(object => assertWord(object.word, bearer.word))!;
  const next = predictProgramRelation(relation, movedBearer, moved, [9]);
  assert.equal(next.status, 'conditional_projection');
  assert.deepEqual(next.bearer_after, movedBearer);
  assert.deepEqual(next.respondent_after.base, [55, 17]);
  assert.deepEqual(next.alternatives.map((alternative: R) => alternative.kind), ['fixed_delta', 'radial_delta']);
  assert.ok(next.alternatives.every((alternative: R) => assertWord(alternative.delta, [4, 2])));
  assert.equal(next.causal_status, 'phase_association_not_causal_identification');
  assert.equal(next.official_outcome, 'unknown');
  assert.equal(relation.support_count, 1, 'A symbolic transport is not an acquired second observation');
});

test('a different relative offset exposes competing predictions and remains outside the acquired scope', () => {
  const { relation } = retainedFixture(), { bearer, objects } = phaseObjects();
  const target = objects.find(object => !assertWord(object.word, bearer.word))!;
  target.base = [bearer.base[0] - 4, bearer.base[1] + 2]; target.anchor = [target.base[0], target.base[1] - target.word.length];
  const result = predictProgramRelation(relation, bearer, objects, [9]);
  assert.equal(result.status, 'unknown');
  assert.equal(result.reason, 'outside_observed_relative_offset');
  assert.deepEqual(result.alternatives.map((alternative: R) => alternative.delta), [[4, 2], [-4, 2]]);
  assert.equal(result.official_outcome, 'unknown');
});

test('the symbolic relation uses supplied colour and role bindings rather than literal labels', () => {
  const { relation } = retainedFixture(), { bearer, objects } = phaseObjects();
  // This bijection is a controlled software test, not new empirical support.
  const labels = new Map([[7, 201], [9, 202], [8, 203]]), rename = (word: number[]) => word.map(label => labels.get(label) ?? label);
  const renamedRelation = { ...copy(relation), label: 201, respondent_word: rename(relation.respondent_word) };
  const renamed = objects.map(object => ({ ...copy(object), word: rename(object.word) }));
  const renamedBearer = renamed.find(object => assertWord(object.word, rename(bearer.word)))!;
  const result = predictProgramRelation(renamedRelation, renamedBearer, renamed, [202]);
  assert.equal(result.status, 'conditional_projection');
  assert.deepEqual(result.respondent_after.word, [203, 203, 203]);
  assert.deepEqual(result.respondent_after.base, [42, 24]);
  assert.deepEqual(result.bearer_after.word, [201, 202]);
  assert.deepEqual(result.bearer_after.base, [34, 20]);
  assert.equal(predictProgramRelation(relation, objects.find(object => assertWord(object.word, [8, 8, 8]))!, objects, [9]).status, 'unknown',
    'The observed respondent cannot silently become the executing bearer');
});

test('new execution prefixes stay explicit experiments even when their local geometry matches', () => {
  const { relation } = retainedFixture(), { bearer, objects } = phaseObjects();
  const result = predictProgramRelation(relation, bearer, objects, [9, 11, 14]);
  assert.equal(result.status, 'conditional_projection');
  assert.equal(result.prefix_status, 'new_preparation_prefix_requires_validation');
  assert.equal(result.causal_status, 'phase_association_not_causal_identification');
  assert.equal(result.official_outcome, 'unknown');
  assert.deepEqual(relation.samples[0].preceding_labels, [9]);
});

test('the actual final V41 image retains its learned relation but refuses a new edit without current access', async () => {
  const { model, events, relation } = retainedFixture(), { packet, observation } = await publicView();
  const access = bindCurrentProgramAccess(packet.frame_rows, model, observation);
  assert.notEqual(access.status, 'bound');
  assert.equal(access.reason, 'no_current_learned_control');
  assert.deepEqual(retainedProgramRelations(model, events), [relation]);
  assert.equal(programRelationQuestion(model, events, observation, packet.frame_rows, 32, 360_000, () => 0), null,
    'A valid past relation does not synthesize an invisible editing control');
});

test('the real V42 return preparation preserves measured access and reconstructs exactly one initial relation', async () => {
  const model = recordedModel(v42Binding), events = v42Journal(40);
  const preparation = events.find(event => event.mode === 'probe_prepare_return')!;
  const effect = events.find(event => event.kind === 'native_program_control_effect')!;
  const fitted = events.find(event => event.kind === 'native_program_relation_model')!;
  assert.deepEqual(events.map(event => event.kind), ['native_program_control_trial', 'native_program_control_binding',
    'native_program_control_trial', 'native_program_control_trial', 'native_program_control_effect', 'native_program_relation_model']);
  assert.equal(preparation.outcome, 'known_return_member_inserted');
  assert.deepEqual(preparation.return_preparation.after_word, [11, 7, 9]);
  const outward = model.moves.find((move: R) => move.label === 9), returning = model.moves.find((move: R) => move.label === 11);
  assert.equal(outward.status, 'phase_observed_translation'); assert.equal(returning.status, 'phase_observed_translation');
  assert.deepEqual(outward.vectors[0].map((value: number, index: number) => value + returning.vectors[0][index]), [0, 0]);
  assert.deepEqual(effect.phases.map((phase: R) => phase.label), [9, 7, 11]);
  assert.deepEqual(effect.return_preparation_evidence, preparation.evidence);
  assert.equal(effect.return_measurement.status, 'observed_return_and_current_editor_access');
  assert.equal(effect.operator_model_created, false);
  const current = await v42View(40);
  assert.equal(bindCurrentProgramAccess(current.packet.frame_rows, model, current.observation).status, 'bound');
  assert.deepEqual(acquireProgramRelationModels(model, events.slice(0, -1)), [fitted]);
  assert.deepEqual(acquireProgramRelationModels(model, events), []);
  assert.deepEqual(retainedProgramRelations(model, events), [fitted.model]);
  assert.equal(fitted.model.support_count, 1);
  assert.deepEqual(fitted.model.candidates.map((candidate: R) => candidate.kind), ['fixed_delta', 'radial_delta']);
});

test('each real V42 relation command is independently grounded and its acquired event is exactly reconstructible', async () => {
  const model = recordedModel(v42Binding), previousModel = copy(model);
  for (let index = 41; index <= 45; index++) {
    const events = v42Journal(index - 1), previousEvents = copy(events), before = await v42View(index - 1), after = await v42View(index);
    const remaining = 600 - (index - 1 - 35);
    const proposal = programRelationQuestion(model, events, before.observation, before.packet.frame_rows, remaining, 360_000, () => 0);
    assert.ok(proposal, `The acquired public context before command ${index} must support its recorded inquiry`);
    assert.deepEqual(normalized(proposal.actions[0]), normalized(v42Trace.packets[index].command));
    assert.equal(proposal.actions.length, 1);
    assert.equal(programRelationBefore(proposal, 0, before.packet.frame_rows, metadata(model, events, before.packet, before.observation)).admitted, true);
    const witness = programRelationWitness(model, events, proposal, before.observation);
    assert.ok(witness);
    assert.equal(witness.status, 'acquired_context_for_unknown_effect');
    assert.equal(witness.context_model_ids.length, 2);
    const acquired = recordProgramRelation(before.observation, proposal.actions[0], after.observation,
      before.packet.frame_rows, after.packet.frame_rows, after.packet.frame_packet, proposal, { model, events });
    assert.deepEqual(acquired, v42Journal(index).slice(events.length), `Actual acquired event at command ${index}`);
    assert.deepEqual(events, previousEvents, 'Read-only grounding and returned deltas do not mutate the authoritative journal');
    assert.deepEqual(model, previousModel);
  }
});

test('the relation guard rejects stale provenance, altered projection, domain and command before authorization', async () => {
  const model = recordedModel(v42Binding), events = v42Journal(40), current = await v42View(40);
  const proposal = programRelationQuestion(model, events, current.observation, current.packet.frame_rows, 595, 360_000, () => 0)!;
  assert.ok(proposal);
  const meta = metadata(model, events, current.packet, current.observation);
  for (const alter of [
    (value: R) => { value.program_relation_plan.model_digest = 'another-source'; },
    (value: R) => { value.program_relation_plan.relation_digest = 'another-relation'; },
    (value: R) => { value.program_relation_plan.prediction.respondent_after.base[0]++; },
    (value: R) => { value.program_relation_plan.observation_ref = 'stale-view'; },
    (value: R) => { value.actions[0].data.x++; },
  ]) {
    const changed = copy(proposal); alter(changed);
    assert.equal(programRelationBefore(changed, 0, current.packet.frame_rows, meta).admitted, false);
  }
  assert.equal(programRelationBefore(proposal, 1, current.packet.frame_rows, meta).admitted, false);
  assert.equal(programRelationBefore(proposal, 0, current.packet.frame_rows, { ...meta, available: ['ACTION5'] }).admitted, false);
  assert.equal(programRelationBefore(proposal, 0, current.packet.frame_rows, { ...meta, epoch: meta.epoch + 1 }).admitted, false);
  const withoutModel = events.filter(event => event.kind !== 'native_program_relation_model');
  assert.equal(programRelationBefore(proposal, 0, current.packet.frame_rows, { ...meta, events: withoutModel }).admitted, false);
  assert.equal(programRelationWitness(model, withoutModel, proposal, current.observation), null);
  assert.equal(programRelationQuestion(model, events, current.observation, current.packet.frame_rows, 0, 360_000, () => 0), null);
  assert.equal(programRelationQuestion(model, events, current.observation, current.packet.frame_rows, 595, 0, () => 0), null);
});

test('official fourth-level completion is acquired without manufacturing a second relation sample or terminal law', async () => {
  const model = recordedModel(v42Binding), beforeEvents = v42Journal(44), finalEvents = v42Journal(45);
  const original = retainedProgramRelations(model, beforeEvents);
  const before = await v42View(44), after = await v42View(45);
  const proposal = programRelationQuestion(model, beforeEvents, before.observation, before.packet.frame_rows, 591, 360_000, () => 0)!;
  assert.equal(proposal.program_relation_plan.mode, 'execute');
  assert.equal(proposal.program_relation_plan.prediction.prefix_status, 'new_preparation_prefix_requires_validation');
  assert.deepEqual(proposal.program_relation_plan.prediction.preceding_labels, [9, 14]);
  assert.equal(proposal.program_relation_plan.destination_support, 'uncharacterized_support_extension');
  assert.equal(before.packet.levels_completed, 3);
  assert.equal(after.packet.levels_completed, 4);
  const outcome = programRelationAfter(proposal, 0, before.packet.frame_rows, after.packet.frame_rows,
    { epoch: after.observation.level_epoch, score: after.observation.levels_completed, state: after.packet.state });
  assert.equal(outcome.matched, null);
  const trial = finalEvents.at(-1)!;
  assert.equal(trial.kind, 'native_program_relation_trial');
  assert.equal(trial.official_progress, true);
  assert.equal(trial.outcome, 'relation_measurement_unresolved');
  assert.deepEqual(trial.measurement, { status: 'unresolved', reason: 'official_boundary_excluded_from_relation_attribution',
    sample: null, official_outcome: 'official_progress_observed' });
  assert.deepEqual(retainedProgramRelations(model, finalEvents), original);
  assert.equal(original[0]!.support_count, 1);
  assert.equal(finalEvents.filter(event => event.kind === 'native_program_relation_model').length, 1);
  assert.equal(finalEvents.filter(event => event.kind === 'native_program_relation_refutation').length, 0);
  assert.equal(programRelationQuestion(model, finalEvents, after.observation, after.packet.frame_rows, 600, 360_000, () => 0), null,
    'A fourth-level official boundary does not license the unobserved fifth-level relation context');
});

function patchAt(rows: readonly (readonly number[])[], box: number[]): number[][] {
  return rows.slice(box[1], box[3]! + 1).map(row => row.slice(box[0], box[2]! + 1));
}

/** Controlled failed return: real preceding animation is retained up to the
 * new-member phase, then its public body geometry remains stationary. This
 * deliberately supplied counterexample is not a claimed physical game result. */
async function controlledExecutionReturn(proposal: R, current: Awaited<ReturnType<typeof v42View>>, failedPreparation = false) {
  const plan = proposal.program_relation_plan, actual = copy(v42Trace.packets[45].packet.frame_packet) as number[][][];
  const members: R[] = plan.layout.members;
  const beforePatches = members.map(member => patchAt(current.packet.frame_rows, member.bbox));
  const firstUnknown = actual.findIndex(frame => {
    const changed = members.flatMap((member, index) => JSON.stringify(patchAt(frame, member.bbox)) !== JSON.stringify(beforePatches[index]) ? [index] : []);
    return assertWord(changed, [0]);
  });
  assert.ok(firstUnknown > 0);
  const phase = copy(actual[firstUnknown]!), final = copy(phase);
  for (const member of members) {
    const [left, top, right, bottom] = member.bbox;
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) final[y]![x] = current.packet.frame_rows[y]![x]!;
  }
  let frames = [...actual.slice(0, firstUnknown + 1), copy(phase), final];
  if (failedPreparation) frames = frames.map(frame => {
    const stationary = copy(current.packet.frame_rows) as number[][];
    for (const member of members) {
      const [left, top, right, bottom] = member.bbox;
      for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) stationary[y]![x] = frame[y]![x]!;
    }
    return stationary;
  });
  const rows = frames.at(-1)!, frameHash = createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 16);
  const packet = { ...copy(current.packet), step_index: 45, frame_rows: rows, frame_packet: frames, frame_hash: frameHash };
  return { packet, observation: await measureNativeObservation(packet, 46, v42Session) };
}

test('a failed known preparation stays unresolved and cannot refute the later relation', async () => {
  const model = recordedModel(v42Binding), events = v42Journal(44), before = await v42View(44);
  const proposal = programRelationQuestion(model, events, before.observation, before.packet.frame_rows, 591, 360_000, () => 0)!;
  const after = await controlledExecutionReturn(proposal, before, true), unchanged = copy(model);
  const acquired = recordProgramRelation(before.observation, proposal.actions[0], after.observation, before.packet.frame_rows,
    after.packet.frame_rows, after.packet.frame_packet, proposal, { model, events });
  assert.equal(acquired.length, 1);
  assert.equal(acquired[0]!.outcome, 'relation_measurement_unresolved');
  assert.equal(acquired[0]!.measurement.reason, 'known_preparation_or_phase_context_not_matched');
  assert.deepEqual(retainedProgramRelations(model, [...events, ...acquired]), retainedProgramRelations(model, events));
  assert.deepEqual(model, unchanged);
});

test('an isolated contradictory relation return suspends that native hypothesis and preserves the source model', async () => {
  const model = recordedModel(v42Binding), events = v42Journal(44), before = await v42View(44);
  const proposal = programRelationQuestion(model, events, before.observation, before.packet.frame_rows, 591, 360_000, () => 0)!;
  const after = await controlledExecutionReturn(proposal, before), unchanged = copy(model), earlier = copy(events);
  const acquired = recordProgramRelation(before.observation, proposal.actions[0], after.observation, before.packet.frame_rows,
    after.packet.frame_rows, after.packet.frame_packet, proposal, { model, events });
  assert.deepEqual(acquired.map(event => event.kind), ['native_program_relation_trial', 'native_program_relation_refutation']);
  assert.equal(acquired[0]!.outcome, 'isolated_relation_projection_refuted');
  assert.equal(acquired[0]!.measurement.sample, null);
  assert.equal(acquired[1]!.trial_id, acquired[0]!.trial_id);
  assert.equal(acquired[1]!.relation_id, proposal.program_relation_plan.relation.relation_id);
  assert.equal(acquired[1]!.context.destination_support, 'uncharacterized_support_extension');
  assert.deepEqual(retainedProgramRelations(model, [...events, ...acquired]), []);
  assert.deepEqual(model, unchanged);
  assert.deepEqual(events, earlier, 'The original acquired observations are retained independently of the failed projection');
  assert.equal(acquired.some(event => event.kind === 'program_composition_reconciled' || event.kind === 'fitted_program_composition'), false);
  assert.deepEqual(recordProgramRelation(before.observation, { action_ref: 'ACTION7' }, after.observation,
    before.packet.frame_rows, after.packet.frame_rows, after.packet.frame_packet, proposal, { model, events }), []);
});

test('cold common runtime acquires STCK fourth-level progress with guarded relation evidence and no terminal-law promotion', async () => {
  const reference = new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', root);
  const [common, strategy] = await Promise.all([
    readFile(new URL('laya_proto/common_frontier_policy.drm.json', reference), 'utf8'),
    readFile(new URL('morphology_policy/strategy.drm', reference), 'utf8'),
  ]);
  const declarations = { common: JSON.parse(common), strategy: JSON.parse(strategy) } as NativeV6Declarations;
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const family = (runtime as unknown as { families: NativeFamily[] }).families.find(item => item.id === 'public_occurrence_recall')!;
  assert.deepEqual((family.state() as R).events, []);
  const nativeExecution: NativeExecution = { now: () => 0, yieldControl: async () => {}, deadlineMs: 360_000 };
  const packet = (index: number): NativePublicObservation => copy(v42Trace.packets[index].packet);
  const native = (state: R): R[] => state.events.filter((event: R) => event.kind.startsWith('native_program_control_') || event.kind.startsWith('native_program_relation_'));
  let result = await runtime.initialize({ sessionId: v42Session, observation: packet(0),
    budgets: { targetLevels: 4, levelActionCaps: [600, 600, 600, 600], maxActions: 2400 } }, nativeExecution);
  let initialRelation: R | undefined, sourceModels: R[] | undefined;
  for (let index = 1; index <= 45; index++) {
    if (result.kind === 'boundary') result = await runtime.resume(nativeExecution);
    assert.equal(result.kind, 'action', `Before public command ${index}: ${result.reason}`);
    assert.deepEqual(normalized(result.command!), normalized(v42Trace.packets[index].command), `Recorded public choice ${index}`);
    assert.ok(result.authorization);
    assert.equal((result.snapshot.whyAct as R).decision.decision.status, 'action_set_released');
    if (index >= 41) {
      const proposal = result.snapshot.proposal as R, before = family.state() as R;
      assert.equal(proposal.kind, 'public_program_relation_probe');
      assert.equal(proposal.field_subquestion, 'observed_program_composition');
      assert.equal(proposal.strategy_receipt.native_coordination[0].grounded_inquiry.status, 'acquired_context_for_unknown_effect');
      assert.equal(proposal.strategy_receipt.native_coordination[0].learned_preparation, undefined);
      assert.equal(proposal.actions.length, 1);
      const observation = await measureNativeObservation(packet(index - 1), index, v42Session);
      assert.equal((await family.before(proposal, 0, packet(index - 1), observation)).admitted, true);
      const changed = copy(proposal); changed.program_relation_plan.prediction.respondent_after.base[0]++;
      assert.equal((await family.before(changed, 0, packet(index - 1), observation)).admitted, false);
      assert.deepEqual(family.state(), before, 'Guard checks create no acquired fact');
    }
    result = await runtime.advance({ command: result.command!, executionMs: 0, observation: packet(index) }, nativeExecution);
    assert.equal(result.snapshot.actions, index);
    if (index >= 38) {
      assert.equal((result.snapshot.caller as R).acquiredTransitions, index);
      assert.deepEqual((result.snapshot.whyAct as R).analysis.map((item: R) => item.operation), ['OP29', 'OP30', 'OP31']);
      assert.deepEqual(native(family.state() as R), v42Journal(index), 'Selected and passive registration acquire the exact native journal once');
    }
    if (index === 40) {
      const retained = family.nativeState!() as R;
      assert.equal(Object.isFrozen(retained), true);
      initialRelation = copy(retained.events.find((event: R) => event.kind === 'native_program_relation_model'));
      sourceModels = copy(retained.events.filter((event: R) => event.kind === 'fitted_program_composition'));
      assert.ok(initialRelation);
      assert.equal(initialRelation.model.support_count, 1);
      const changed = copy(retained);
      changed.events.find((event: R) => event.kind === 'native_program_relation_model').model.support_count++;
      assert.throws(() => family.restore(changed));
      assert.deepEqual(family.nativeState!(), retained, 'Failed restoration does not publish the forged support');
      family.restoreNative!(retained);
      assert.deepEqual(family.nativeState!(), retained);
    }
  }
  assert.equal(result.kind, 'stopped');
  assert.equal(result.reason, 'target_levels_completed');
  assert.equal(result.snapshot.levelsCompleted, 4);
  assert.equal((result.snapshot.caller as R).boundaryReplays, 3);
  const graph = runtime.inspectKnowledge(), read = (id: string): R => hydrateNativeState(graph.nodes[id]!.value, ref => graph.nodes[ref]!.value) as R;
  const retained = read('family_state:public_occurrence_recall');
  assert.deepEqual(retained, family.state());
  assert.deepEqual(native(retained), v42Journal(45));
  assert.equal(native(retained).length, 11);
  assert.deepEqual(retained.events.filter((event: R) => event.kind === 'native_program_relation_model'), [initialRelation]);
  assert.deepEqual(retained.events.filter((event: R) => event.kind === 'fitted_program_composition'), sourceModels);
  assert.equal(retained.events.some((event: R) => event.kind === 'native_program_relation_refutation'), false);
  const facts = (read('reasoning:memory').facts as string[]).map(read);
  assert.deepEqual(facts.find(fact => fact.key === 'repeated_series_state')!.value, retained);
  const evidence = read('prefix_evidence:45'), transition = read(`reasoning:transition:${evidence.decision_revision}`);
  assert.equal(evidence.proposal.kind, 'public_program_relation_probe');
  assert.ok(transition.caller_acquisition && transition.frontier_acquisition);
  assert.equal(native(retained).at(-1)!.measurement.reason, 'official_boundary_excluded_from_relation_attribution');
  assert.equal(native(retained).at(-1)!.official_progress, true);
});
