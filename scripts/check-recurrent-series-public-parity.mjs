/** Independent cold native replay of retained original Repeated/Supported
 * public contracts. All real returns and packets are acquired; no game is
 * loaded, no captured memory primes the owner, no future event seeds ablation.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { RecurrentSeriesMemory, proposeRecurrentSeriesCommon, bindRecurrentSeries,
  recurrentSeriesBefore, recurrentSeriesAfter } from '../src/logos-engine/v6-recurrent-series-access.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { symbolicDigest as identity } from '../src/logos-engine/v6-hash.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [sourceArg, outputArg] = process.argv.slice(2);
assert.ok(sourceArg && outputArg, 'Usage: node scripts/check-recurrent-series-public-parity.mjs SOURCE.json.gz OUTPUT.json');
const sourcePath = resolve(sourceArg), outputPath = resolve(outputArg);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = path => JSON.parse(path.endsWith('.gz') ? gunzipSync(readFileSync(path)) : readFileSync(path));
const record = path => { const data = readFileSync(path); return { path: relative(root, path), bytes: data.length, sha256: sha(data) }; };
const source = read(sourcePath), session = resolve(root, source.sessionPath), slug = source.game.toLowerCase();
const deadline = Date.parse(source.caseDeadline);
const clockCheck = () => { if (!(Date.now() < deadline)) throw new Error('Retained cumulative case deadline reached; stop case analysis'); };
clockCheck();
const localTime = () => new Date(Date.now() - 3 * 3600_000).toISOString().replace('Z', '-03:00');
const startedAt = localTime();
const reportPath = resolve(session, slug + '-campaign.json.gz'), manifestPath = resolve(session, 'source-manifest.json');
const journalPath = resolve(session, slug + '-actual-public-journal.jsonl.gz');
const report = read(reportPath), manifest = read(manifestPath);
const journal = gunzipSync(readFileSync(journalPath)).toString().trim().split('\n').map(JSON.parse);
const checks = [], selections = [], returns = [], ablations = [], observations = new Map(), batches = [];
function equal(actual, expected, name) { assert.deepStrictEqual(actual, expected, name); checks.push(name); }
function verifyOriginals() {
  const base = resolve(root, 'reference/v6', source.sourceCommit), input = read(resolve(base, 'manifest.json'));
  for (const [name, value] of Object.entries(input.files)) assert.equal(sha(readFileSync(resolve(base, 'source', name))), value.sha256, name);
  return Object.keys(input.files).length;
}
function restore(events) { const owner = new RecurrentSeriesMemory(); for (const event of events) owner.applyEvent(structuredClone(event)); return owner; }
function state(memory, expected, prefix) {
  const current = memory.currentState(), snapshot = memory.state();
  equal(current, expected.acquiredState, prefix + ': complete acquired state');
  equal(identity(current), expected.projectionDigest, prefix + ': complete projection digest');
  equal(identity(snapshot.events), expected.eventsDigest, prefix + ': complete own journal digest');
  equal(memory.eventCount, expected.eventCount, prefix + ': own event count');
  equal(memory.repeatedDigest(), expected.repeatedDigest, prefix + ': repeated ancestor digest');
  equal(memory.retainedDigest(), expected.digest, prefix + ': complete supported digest');
}
async function observation(position, expected) {
  const reference = expected.observation_ref, packet = journal[position].packet;
  if (observations.has(reference)) return observations.get(reference);
  const match = /^(.*):epoch:(\d+):revision:(\d+):frame:([a-f0-9]+)$/.exec(reference);
  assert.ok(match); assert.equal(Number(match[2]), packet.level); assert.equal(match[4], packet.frame_hash);
  const measured = await measureNativeObservation(packet, Number(match[3]), match[1]);
  equal(measured, expected, 'complete public observation ' + reference);
  observations.set(reference, measured); return measured;
}
async function proposal(memory, value, rows, inputs, remaining) {
  clockCheck();
  const result = await proposeRecurrentSeriesCommon(memory, value, rows, inputs, remaining, source.config, Infinity, () => 0);
  if (result?.status === 'proposed') bindRecurrentSeries(result, { bindings: new Set([`${value.level_epoch}:${value.frame_hash}`]) });
  return result;
}
function decision(proposed) {
  const p = proposed?.line_plan ?? proposed?.supported_line_plan ?? {};
  return { status: proposed?.status ?? null, reason: proposed?.reason ?? null, kind: proposed?.kind ?? null,
    actions: proposed?.actions ?? [], target: p.target ?? null, candidateLength: p.candidate_length ?? p.goal_length ?? null,
    supportFields: p.support_fields ?? null, supportAxis: p.support_axis ?? null,
    supportSign: p.support_sign ?? null, selected: p.selected ?? null };
}
function actionProjection(proposed) { const d = decision(proposed); return { status: d.status, reason: d.reason, actions: d.actions }; }
function omit(events, intervention, lastBatchSize) {
  if (intervention === 'remove_line_trials') return events.filter(e => e.kind !== 'repeated_line_trial');
  if (intervention === 'remove_scored_witnesses') return events.filter(e => e.kind !== 'repeated_line_scored');
  if (intervention === 'remove_insertion_samples') return events.filter(e => e.kind !== 'supported_insertion_observation');
  if (intervention === 'remove_public_order') return events.filter(e => e.kind !== 'supported_insertion_order');
  if (intervention === 'remove_refutations') return events.filter(e => e.kind !== 'supported_line_refutation'
    && !(e.kind === 'repeated_line_trial' && e.result === 'refuted'));
  assert.equal(intervention, 'remove_last_acquired_return');
  return lastBatchSize ? events.slice(0, -lastBatchSize) : [...events];
}

let failure = null, originalsBefore = null, originalsAfter = null;
const memory = new RecurrentSeriesMemory();
let ownEvents = 0, restored = 0, selectedReturns = 0;
try {
  for (const item of source.inputs) equal(record(resolve(root, item.path)), item, 'source replay input ' + item.path);
  for (const [name, digest] of Object.entries(manifest.files)) assert.equal(sha(readFileSync(resolve(root, name))), digest, name);
  checks.push('every frozen native file matches the public campaign source');
  equal(manifest.digest, source.nativeSourceDigest, 'native freeze identity');
  equal(report.source.digest, source.nativeSourceDigest, 'captured campaign source identity');
  equal(source.status, 'passed', 'complete original replay passed');
  equal(source.completeSelectedOwnTrajectoryParity, true, 'every selected original decision covered');
  equal(source.completeAllReturnAcquisitionParity, true, 'every actual foreign and selected return covered');
  equal(source.exactOriginal.coldStart, true, 'source starts cold');
  equal(source.exactOriginal.primedFromCapturedProposalMemory, false, 'captured plan memory remains comparison-only');
  originalsBefore = verifyOriginals(); equal(originalsBefore, 1786, 'unchanged originals before native replay');
  state(memory, source.exactOriginal.initialState, 'initial');
  for (const prefix of source.exactOriginal.prefixes) {
    clockCheck();
    const packet = journal[prefix.position].packet, value = await observation(prefix.position, prefix.observation);
    state(memory, prefix.sourceStateBefore, `prefix ${prefix.index} before`);
    const beforeState = memory.currentState(), beforeJournal = memory.state().events;
    let actual = {};
    if (prefix.selectedOwn) {
      actual = await proposal(memory, value, packet.frame_rows, prefix.inputs, prefix.remainingActions);
      equal(actual, prefix.sourceProposal, `prefix ${prefix.index}: complete common source proposal exact`);
      equal(memory.currentState(), beforeState, `prefix ${prefix.index}: planning acquires nothing`);
      equal(memory.state().events, beforeJournal, `prefix ${prefix.index}: planning preserves journal`);
      const rebuilt = new RecurrentSeriesMemory(); rebuilt.restore(memory.state()); restored++;
      equal(rebuilt.currentState(), beforeState, `prefix ${prefix.index}: restoration preserves acquired state`);
      equal(await proposal(rebuilt, value, packet.frame_rows, prefix.inputs, prefix.remainingActions), actual,
        `prefix ${prefix.index}: restoration preserves complete next proposal`);
      for (const expected of source.ablation.cases.filter(item => item.prefixIndex === prefix.index)) {
        clockCheck();
        const lastSize = batches.at(-1)?.length ?? 0;
        equal(lastSize, expected.lastReturnEventCount, `prefix ${prefix.index}: last real return event count`);
        const retained = omit(beforeJournal, expected.intervention, lastSize), altered = restore(retained);
        equal(retained.length, expected.retainedEvents, `prefix ${prefix.index}: ${expected.intervention} retained event count`);
        equal(identity(altered.currentState()), expected.counterfactualProjectionDigest,
          `prefix ${prefix.index}: ${expected.intervention} exact source intervention`);
        equal(!isDeepStrictEqual(beforeState, altered.currentState()), expected.knowledgeChanged,
          `prefix ${prefix.index}: ${expected.intervention} knowledge change excludes journal identity alone`);
        if (!expected.executed) {
          ablations.push({ prefixIndex: prefix.index, intervention: expected.intervention, executed: false,
            sourceError: expected.error, qualification: 'Original replay did not complete this intervention; no native contribution claimed.' });
          continue;
        }
        const alternative = await proposal(altered, value, packet.frame_rows, prefix.inputs, prefix.remainingActions);
        equal(decision(alternative), expected.counterfactual, `prefix ${prefix.index}: ${expected.intervention} exact source counterfactual`);
        const actionChanged = !isDeepStrictEqual(actionProjection(actual), actionProjection(alternative));
        const decisionChanged = !isDeepStrictEqual(decision(actual), decision(alternative));
        equal(actionChanged, expected.actionOrRefusalChanged, `prefix ${prefix.index}: ${expected.intervention} action/refusal attribution`);
        equal(decisionChanged, expected.decisionChanged, `prefix ${prefix.index}: ${expected.intervention} decision attribution`);
        equal(!isDeepStrictEqual(actual, alternative), expected.strictProposalChanged,
          `prefix ${prefix.index}: ${expected.intervention} complete proposal difference`);
        ablations.push({ prefixIndex: prefix.index, intervention: expected.intervention, executed: true,
          knowledgeChanged: expected.knowledgeChanged, actionOrRefusalChanged: actionChanged,
          decisionChanged, actual: decision(actual), counterfactual: decision(alternative) });
      }
      selections.push({ prefixIndex: prefix.index, position: prefix.position, kind: actual.kind,
        actions: actual.actions, exactCommonSourceProposal: true, acquiredEventsBefore: beforeJournal.length });
    } else equal(prefix.sourceProposal, null, `prefix ${prefix.index}: foreign proposal does not prime own memory`);
    for (const step of source.exactOriginal.steps.filter(item => item.prefixIndex === prefix.index)) {
      clockCheck();
      const position = step.sequence - 1, first = journal[position].packet, later = journal[position + 1].packet;
      const before = await observation(position, step.before), after = await observation(position + 1, step.after);
      equal(step.selectedOwn, prefix.selectedOwn, `return ${step.sequence}: selected/passive scope`);
      equal(later.frame_packet.length, step.packetFrameCount, `return ${step.sequence}: complete public packet length`);
      equal(identity(later.frame_packet), step.packetDigest, `return ${step.sequence}: exact public packet`);
      if (step.selectedOwn) {
        equal(recurrentSeriesBefore(actual, step.index, first.frame_rows, step.beforeMeta), step.beforeGuard,
          `return ${step.sequence}: original before guard`);
        equal(recurrentSeriesAfter(actual, step.index, first.frame_rows, later.frame_rows, step.afterMeta), step.afterGuard,
          `return ${step.sequence}: original after guard`);
        selectedReturns++;
      }
      state(memory, step.sourceStateBefore, `return ${step.sequence} before`);
      const events = step.ancestralRecordCutoff ? [] : memory.record(before, step.command, after,
        first.frame_rows, later.frame_rows, actual, step.index);
      const packetEvents = memory.recordPacket(before, step.command, after, first.frame_rows, later.frame_packet, []);
      events.push(...packetEvents);
      equal(packetEvents.length, step.packetEventCount, `return ${step.sequence}: original packet event count`);
      equal(events, step.sourceOwnEvents, `return ${step.sequence}: every original own event in source order`);
      batches.push(structuredClone(events)); ownEvents += events.length;
      state(memory, step.sourceStateAfter, `return ${step.sequence} after`);
      const rebuilt = new RecurrentSeriesMemory(); rebuilt.restore(memory.state()); restored++;
      equal(rebuilt.currentState(), memory.currentState(), `return ${step.sequence}: exact restored projection`);
      equal(rebuilt.state(), memory.state(), `return ${step.sequence}: exact restored journal and digest`);
      returns.push({ sequence: step.sequence, prefixIndex: prefix.index, selectedOwn: step.selectedOwn,
        ancestralRecordCutoff: step.ancestralRecordCutoff, eventCount: events.length,
        eventKinds: events.map(event => event.kind), packetFrames: later.frame_packet.length, boundary: step.boundary });
    }
  }
  state(memory, source.exactOriginal.finalState, 'final');
  equal(returns.length, source.capturedGameActions, 'every actual return is acquired');
  equal(selectedReturns, source.capturedSelectedRecurrentActions, 'every selected own return is covered');
  equal(selections.length, source.capturedSelectedRecurrentPrefixes, 'every selected own decision is covered');
  equal(ownEvents, source.capturedAllRecurrentEvents, 'every captured own event is covered, including passive acquisition');
  equal(ablations.length, source.ablation.interventions, 'all counterfactuals and negatives retained');
  equal(ablations.filter(item => item.actionOrRefusalChanged).length, source.ablation.actionOrRefusalChanges,
    'exact source/native action contribution count');
  originalsAfter = verifyOriginals(); equal(originalsAfter, originalsBefore, 'originals unchanged after native replay');
  clockCheck();
} catch (error) {
  failure = { name: error.name, message: error.message, stack: error.stack };
}
const inputPaths = [sourcePath, reportPath, journalPath, manifestPath, fileURLToPath(import.meta.url),
  resolve(root, 'src/logos-engine/v6-recurrent-series-access.ts'),
  resolve(root, 'src/logos-engine/v6-recurrent-series-observation.ts'),
  resolve(root, 'src/logos-engine/v6-supported-lines.ts'), resolve(root, 'src/logos-engine/v6-native-observer.ts')];
const output = { schema: 'logos-engine.lot3i.recurrent-series-public-native-source-review.v1',
  status: failure ? 'failed' : 'passed', startedAt, recordedAt: localTime(), displayTimeZone: 'UTC-03:00',
  game: source.game, sourceCommit: source.sourceCommit, nativeSourceDigest: manifest.digest,
  checkedCount: checks.length, checks, failure, inputs: inputPaths.map(record),
  originalFilesVerifiedBefore: originalsBefore, originalFilesVerifiedAfter: originalsAfter,
  exactOriginal: { selectedPrefixes: selections.length, returns: returns.length, selectedReturns, ownEvents,
    restorations: restored, coldStart: true, primedFromCapturedProposalMemory: false,
    completeSelectedOwnTrajectoryParity: !failure, completeAllReturnAcquisitionParity: !failure,
    fullInheritedCallerParity: false },
  contribution: { interventions: ablations.length, executed: ablations.filter(item => item.executed).length,
    actionOrRefusalChanges: ablations.filter(item => item.actionOrRefusalChanged).length,
    decisionChanges: ablations.filter(item => item.decisionChanged).length,
    negativeOrUnchanged: ablations.filter(item => item.executed && !item.actionOrRefusalChanged).length,
    componentAblation: true, fullCallerAblation: false },
  selections, returns, ablations, capturedCommonTerminal: report.final,
  newGameActions: 0, levelJumps: 0, gameEngineOrSpecificationRead: false, benchmarkExecuted: false,
  qualification: 'Cold own Repeated/Supported replay acquires every selected or foreign real return and its complete public packet. Proposals, bindings, guards, events, journal restoration and digests match unchanged source expectations. Selected own plans carry no higher-priority plan; ancestor cutoff is explicit. Counterfactuals remove earlier own events before the decision, never future evidence or captured learned state. Negative/unexecuted outcomes remain. These are component interventions, not full-caller ablations, new campaigns, timing comparisons or success predictions. Production node and integer limits remain enabled with a deterministic unexpired replay clock.' };
writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: output.status, output: relative(root, outputPath), checkedCount: checks.length,
  exactOriginal: output.exactOriginal, contribution: output.contribution, failure }));
if (failure) process.exitCode = 1;
