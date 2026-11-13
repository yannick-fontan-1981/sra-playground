import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { OccurrenceRecallAccess } from '../src/logos-engine/v6-occurrence-recall.ts';
import { SharedSeriesConstraint } from '../src/logos-engine/v6-shared-series.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import { programEditor, projectedProgramMembers, programWorld, programWordAt, markedCollectionQuestion,
  observedProgramQuestion, observedProgramBefore, observedProgramAfter, recordObservedProgram,
  recordObservedProgramPacket } from '../src/logos-engine/v6-program-composition-access.ts';
import { renderProgramLayers, fitProgramLayerOffset, fitProgramGlyphVectors, decodeProgramStacks } from '../src/logos-engine/v6-program-geometry.ts';
import { fitProgramCompositionModel, programCoordinates, programSurface, simulateProgramWord, searchProgram } from '../src/logos-engine/v6-program-compositions.ts';
import { simulateRespondentProgram, searchRespondentProgram, searchRespondentReplacement } from '../src/logos-engine/v6-program-respondent-search.ts';
import { programSupportMatch, programFullMatch, observeRespondentProgramPacket } from '../src/logos-engine/v6-program-respondent-observations.ts';
import { learnProgramInputSupport, candidateProgramInputSites } from '../src/logos-engine/v6-program-input-access.ts';
import { occurrenceCollectionScene, occurrenceMeasuredControls, occurrenceRectangularMembers, occurrenceProgramTranslationCandidates } from '../src/logos-engine/v6-occurrence-program-observer.ts';
import { programIdentity, programCanonical, programPythonFloat } from '../src/logos-engine/v6-program-identity.ts';

type R = Record<string, any>;
const oracle = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-program-composition-reference.json.gz', import.meta.url))).toString());
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/', import.meta.url);
const copy = <T>(value: T): T => structuredClone(value);

function plain(value: any): any {
  if (value instanceof Map) return Object.fromEntries([...value].map(([key, child]) => [String(key), plain(child)]));
  if (value instanceof Set) return [...value].sort((a, b) => typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))).map(plain);
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, plain(child)]));
  return value;
}

function projection(memory: OccurrenceRecallAccess): R {
  return Object.fromEntries(Object.keys(oracle.states.empty.projection).map(key => [key,
    plain((memory as unknown as R)[key.replace(/_([a-z])/g, (_, character: string) => character.toUpperCase())])]));
}

function fromEvents(events: R[]): OccurrenceRecallAccess {
  const memory = new OccurrenceRecallAccess();
  for (const event of events) memory.applyEvent(copy(event));
  return memory;
}

function fromState(id: string): OccurrenceRecallAccess {
  const memory = fromEvents(oracle.states[id].events);
  assert.deepEqual(projection(memory), oracle.states[id].projection);
  assert.equal(memory.retainedDigest(), oracle.states[id].sourceDigest);
  return memory;
}

function sharedFromState(id: string): SharedSeriesConstraint {
  const family = new SharedSeriesConstraint(oracle.policy.recall);
  for (const event of oracle.states[id].events) {
    family.memory.applyEvent(copy(event)); family.events.push(copy(event));
  }
  const rebuilt = new SharedSeriesConstraint(oracle.policy.recall);
  rebuilt.restore(family.state());
  assert.equal(rebuilt.memory.retainedDigest(), oracle.states[id].sourceDigest);
  return rebuilt;
}

test('program oracle uses unchanged original source and source-fitted public observations', async () => {
  assert.equal(oracle.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(oracle.sourceModified, false);
  assert.match(oracle.qualification, /full raw ancestor returns retained/);
  assert.match(oracle.qualification, /not successful-game evidence/);
  assert.match(oracle.qualification, /No game module/);
  for (const [path, digest] of Object.entries(oracle.sourceHashes)) {
    assert.equal(createHash('sha256').update(await readFile(new URL(path, source))).digest('hex'), digest, path);
  }
  assert.equal(createHash('sha256').update(await readFile(new URL('../' + oracle.generator, import.meta.url))).digest('hex'), oracle.generatorSha256);
  for (const input of oracle.publicInputs ?? []) {
    assert.equal(createHash('sha256').update(await readFile(new URL('../' + input.path, import.meta.url))).digest('hex'), input.sha256);
    assert.equal(input.usedExternalActions, 3);
    assert.match(input.qualification, /completed one level, not three levels or a game/);
  }
  for (const journal of oracle.journals) for (const step of journal.steps) {
    assert.deepEqual(step.sourceEvents, [...step.parentEvents, ...step.expectedOwnEvents]);
    assert.equal(step.sourceInputsUnchanged, true);
    assert.deepEqual(step.parentEvents, [], 'Controlled observations have no crossed/line events; every source ancestor return is retained');
  }
  const fitted = oracle.journals.flatMap((journal: R) => journal.steps).flatMap((step: R) => step.sourceEvents)
    .filter((event: R) => event.kind === 'fitted_program_composition');
  assert.equal(fitted.length, 2, 'One controlled public model and one real first-level public model were independently acquired');
  assert.deepEqual(fitted[0].model, oracle.model);
  assert.deepEqual(fitted[1].model, oracle.states.real_stck_3.projection.composition_models[0]);
});

for (const [id, original] of Object.entries<R>(oracle.states)) test('source program event state and exact inherited digest: ' + id, () => {
  const memory = fromState(id), family = sharedFromState(id), state = family.state();
  assert.deepEqual(projection(family.memory), projection(memory));
  const repeated = new SharedSeriesConstraint(oracle.policy.recall); repeated.restore(copy(state));
  assert.deepEqual(repeated.state(), state);
  assert.equal(repeated.memory.retainedDigest(), original.sourceDigest);
});

for (const journal of oracle.journals) test('source program acquisition and replay: ' + journal.id, () => {
  let memory = journal.initialState ? fromState(journal.initialState) : new OccurrenceRecallAccess();
  const events = copy(journal.initialState ? oracle.states[journal.initialState].events : []);
  for (const step of journal.steps) {
    const first = oracle.scenes[step.before], second = oracle.scenes[step.after], command = copy(step.command), proposal = copy(step.proposal);
    const args = [copy(first.observation), command, copy(second.observation), copy(first.rows), copy(second.rows), proposal, step.index];
    const untouched = copy(args);
    const actual = step.operation === 'record'
      ? recordObservedProgram(memory, args[0], args[1], args[2], args[3], args[4], args[5], args[6])
      : recordObservedProgramPacket(memory, args[0], args[1], args[2], args[3], copy(step.frames));
    assert.deepEqual(actual, step.expectedOwnEvents, step.before + ': complete source own acquisition');
    assert.deepEqual(args, untouched, 'Acquisition cannot mutate its public arguments');
    assert.deepEqual(projection(memory), step.state.projection);
    assert.equal(memory.retainedDigest(), step.state.sourceDigest, 'Exact program-bearing ancestor digest, including typed floats');
    events.push(...copy(actual)); memory = fromEvents(events);
    assert.deepEqual(projection(memory), step.state.projection, 'Replaying every original event is sufficient');
    assert.equal(memory.retainedDigest(), step.state.sourceDigest);
  }
});

for (const entry of oracle.proposalCases) test('source full program proposal envelope: ' + entry.id, async () => {
  const memory = fromState(entry.state), current = oracle.scenes[entry.scene], observation = copy(entry.observation), rows = copy(current.rows);
  const old = projection(memory), digest = memory.retainedDigest(), inputs = copy(entry.inputs);
  const operation = async () => {
    if (entry.operation === 'common') {
      const family = sharedFromState(entry.state), state = family.state();
      const result = await family.programPropose(observation, rows, inputs, entry.remaining,
        entry.deadline === null ? null : entry.deadline * 1000, () => 0);
      assert.deepEqual(family.state(), state); return result;
    }
    if (entry.operation === 'marked') return markedCollectionQuestion(memory, observation, rows, inputs);
    return observedProgramQuestion(memory, observation, rows, entry.maxPrefix,
      { remaining_level_actions: entry.remaining, level_deadline: entry.deadline, now: () => 0 });
  };
  if (entry.error) await assert.rejects(operation, { message: entry.error.message });
  else assert.deepEqual(await operation(), entry.expected, 'No normalization of proposal IDs, point support, hypotheses, actions or metadata');
  assert.deepEqual(projection(memory), old); assert.equal(memory.retainedDigest(), digest);
  assert.deepEqual(observation, entry.observation); assert.deepEqual(rows, current.rows); assert.deepEqual(inputs, entry.inputs);
});

for (const entry of oracle.guardCases) test('source observed-program guard: ' + entry.id, () => {
  const memory = fromState(entry.state), proposal = copy(entry.proposal), before = copy(oracle.scenes[entry.before].rows);
  const old = projection(memory), call = () => entry.operation === 'before'
    ? observedProgramBefore(memory, proposal, entry.index, before, copy(entry.meta))
    : observedProgramAfter(memory, proposal, entry.index, before, copy(oracle.scenes[entry.after].rows), copy(entry.meta));
  if (entry.error) assert.throws(call);
  else assert.deepEqual(call(), entry.expected);
  assert.deepEqual(projection(memory), old); assert.deepEqual(proposal, entry.proposal);
});

for (const entry of oracle.bindCases) test('source program public point binding: ' + entry.id, () => {
  const family = new SharedSeriesConstraint(oracle.policy.recall), domain = new ObservedInputDomain(256), proposal = copy(entry.proposal);
  if (entry.observed) domain.candidates(oracle.scenes[entry.scene].observation);
  if (entry.error) assert.throws(() => family.bind(proposal, domain), { message: entry.error.message });
  else { family.bind(proposal, domain); assert.deepEqual(proposal, entry.expected); }
});

for (const journal of oracle.commonJournals) test('full original common program acquisition and shared restoration: ' + journal.id, () => {
  let family = sharedFromState(journal.initialState ?? 'empty');
  for (const step of journal.steps) {
    const before = oracle.scenes[step.before], after = oracle.scenes[step.after];
    const result = family.record(copy(before.observation), copy(after.observation), copy(step.command),
      copy(before.rows), copy(after.rows), copy(step.proposal), step.index, copy(after.public.frame_packet));
    assert.deepEqual(result, step.expected, 'The entire original common envelope is compared without filtering ancestor or sibling events');
    assert.deepEqual(family.state().events, step.fullSourceState.events);
    assert.deepEqual(projection(family.memory), step.programState.projection);
    assert.equal(family.memory.retainedDigest(), step.programState.sourceDigest);
    assert.notEqual(family.state().digest, step.fullSourceState.digest, 'Unported original inherited layers remain outside the native shared digest scope');
    const checkpoint = family.state(), restored = new SharedSeriesConstraint(oracle.policy.recall);
    restored.restore(checkpoint); assert.deepEqual(restored.state(), checkpoint); family = restored;
  }
});

test('program-bearing shared checkpoint corruption is rejected atomically', () => {
  const family = sharedFromState('respondents'), original = family.state();
  for (const mutate of [
    (state: R) => { state.events.find((event: R) => event.kind === 'fitted_program_composition').model.glyphs.matrix[0][0] = 0.75; },
    (state: R) => { state.events.pop(); },
    (state: R) => { state.events.push({ kind: 'outside-acquired-journal' }); },
  ]) {
    const corrupt = copy(original); mutate(corrupt);
    assert.throws(() => family.restore(corrupt));
    assert.deepEqual(family.state(), original, 'An invalid program model, missing event or foreign event cannot replace the acquired checkpoint');
  }
  const external = family.state();
  external.events.find((event: R) => event.kind === 'fitted_program_composition').model.evidence_refs.push('outside');
  assert.deepEqual(family.state(), original, 'Public state reads return independently owned events');
});

const helpers: Record<string, (...args: any[]) => unknown> = {
  render_layers: (...args) => [...(renderProgramLayers as any)(...args)].map(([key, color]: [string, number]) => [...key.split(',').map(Number), color])
    .sort((a: number[], b: number[]) => a[0]! - b[0]! || a[1]! - b[1]!),
  fit_layer_offset: fitProgramLayerOffset, fit_glyph_vectors: fitProgramGlyphVectors,
  decode_stacks: (rows, layer, palette, exclusions) => decodeProgramStacks(rows, layer, new Set(palette), exclusions),
  fit_composition_model: fitProgramCompositionModel, coordinates: programCoordinates, surface: programSurface,
  simulate_word: simulateProgramWord, search_program: searchProgram,
  simulate_respondents: simulateRespondentProgram, search_respondents: searchRespondentProgram, search_replacement: searchRespondentReplacement,
  support_match: programSupportMatch, full_match: programFullMatch, observe_respondent_packet: observeRespondentProgramPacket,
  learn_input_support: learnProgramInputSupport, candidate_sites: candidateProgramInputSites,
  editor: programEditor, projected_members: (rows, layout, palette) => projectedProgramMembers(rows, layout, new Set(palette)),
  world: programWorld, word_at: programWordAt, collection_scene: occurrenceCollectionScene,
  measured_controls: occurrenceMeasuredControls,
  rectangular_members: (rows, examples, palette, limit) => occurrenceRectangularMembers(rows, examples, new Set(palette), limit),
  translation_candidates: occurrenceProgramTranslationCandidates,
};
const withOptions = new Set(['fit_composition_model', 'search_program', 'simulate_respondents', 'search_respondents', 'search_replacement', 'observe_respondent_packet']);
for (const entry of oracle.mathCases) test('source program geometry and conditional calculation: ' + entry.id, () => {
  const args = copy(entry.args), options = copy(entry.kwargs);
  if (['search_program', 'search_respondents', 'search_replacement'].includes(entry.operation)) options.now = () => 0;
  const actual = withOptions.has(entry.operation) ? helpers[entry.operation]!(...args, options) : helpers[entry.operation]!(...args);
  assert.deepEqual(actual, entry.expected, 'Full output includes search node count, ordering and conditional scope');
  assert.deepEqual(args, entry.args);
});

for (const entry of oracle.identityCases ?? []) test('Python program identity with typed glyph floats: ' + entry.id, () => {
  assert.equal(programCanonical(copy(entry.value)), entry.canonical);
  assert.equal(programIdentity(copy(entry.value)), entry.digest);
});
for (const entry of oracle.floatCases ?? []) test('Python glyph float spelling: ' + entry.id, () => {
  assert.equal(programPythonFloat(entry.value), entry.expected);
});
