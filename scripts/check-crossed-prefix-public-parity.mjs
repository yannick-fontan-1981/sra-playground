/** Cold native verification of a completed unchanged-original public replay.
 * Uses only retained public returns, computes every own proposal and acquisition,
 * and checks the same event-omission counterfactuals. No game host is loaded.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { CrossedPrefixMemory, proposeCrossedPrefixCommon, bindCrossedPrefix,
  crossedPrefixBefore, crossedPrefixAfter } from '../src/logos-engine/v6-crossed-prefix-access.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { symbolicDigest as identity } from '../src/logos-engine/v6-hash.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [sourceArg, outputArg] = process.argv.slice(2);
assert.ok(sourceArg && outputArg, 'Usage: node scripts/check-crossed-prefix-public-parity.mjs SOURCE.json.gz OUTPUT.json');
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
const journalPath = resolve(session, slug + '-actual-public-journal.jsonl.gz'), report = read(reportPath), manifest = read(manifestPath);
const journal = gunzipSync(readFileSync(journalPath)).toString().trim().split('\n').map(JSON.parse);
const checks = [], selections = [], returns = [], ablations = [], observations = new Map();
function equal(actual, expected, name) { assert.deepStrictEqual(actual, expected, name); checks.push(name); }
function check(condition, name) { assert.ok(condition, name); checks.push(name); }
function verifyOriginals() {
  const base = resolve(root, 'reference/v6', source.sourceCommit), input = read(resolve(base, 'manifest.json'));
  for (const [name, value] of Object.entries(input.files)) assert.equal(sha(readFileSync(resolve(base, 'source', name))), value.sha256, name);
  return Object.keys(input.files).length;
}
function restore(events) { const owner = new CrossedPrefixMemory(); for (const event of events) owner.applyEvent(structuredClone(event)); return owner; }
function state(memory, expected, prefix) {
  const current = memory.currentState();
  const { cross_events, ...acquiredState } = current;
  equal(acquiredState, expected.acquiredState, prefix + ': complete acquired state');
  equal(identity(cross_events), expected.eventsDigest, prefix + ': event journal digest');
  equal(identity(current), expected.projectionDigest, prefix + ': complete projection digest');
  equal(memory.eventCount, expected.eventCount, prefix + ': event count');
  equal(memory.retainedDigest(expected.parentDigest), expected.digest, prefix + ': own digest on opaque original parent');
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
  const result = await proposeCrossedPrefixCommon(memory, value, rows, inputs, remaining, Infinity, () => 0);
  if (result?.status === 'proposed') bindCrossedPrefix(result, { bindings: new Set([`${value.level_epoch}:${value.frame_hash}`]) });
  return result;
}
function decision(proposed) {
  const p = proposed?.crossed_prefix_plan ?? {};
  return { status: proposed?.status ?? null, reason: proposed?.reason ?? null,
    actions: proposed?.actions ?? [], mode: p.mode ?? null, controller: p.controller?.key ?? null, intent: p.intent ?? {} };
}
function actionProjection(proposed) { const d = decision(proposed); return { status: d.status, reason: d.reason, actions: d.actions }; }
function omit(events, intervention) {
  if (intervention === 'remove_pairs') return events.filter(e => e.kind !== 'crossed_prefix_pair');
  if (intervention === 'remove_axis_inputs') return events.filter(e => e.kind !== 'crossed_prefix_input');
  if (intervention === 'remove_local_state') return events.filter(e => e.kind !== 'crossed_prefix_state');
  assert.equal(intervention, 'remove_last_acquired_return');
  const prior = events.slice(0, -1).flatMap((event, i) => event.kind === 'crossed_prefix_state' ? [i] : []);
  return prior.length ? events.slice(0, prior.at(-1) + 1) : [];
}
let failure = null, originalsBefore = null, originalsAfter = null;
let memory = new CrossedPrefixMemory(), ownEvents = 0, restored = 0;
try {
  for (const item of source.inputs) equal(record(resolve(root, item.path)), item, 'source replay input ' + item.path);
  for (const [name, digest] of Object.entries(manifest.files)) assert.equal(sha(readFileSync(resolve(root, name))), digest, name);
  checks.push('every frozen native file matches the campaign source');
  equal(manifest.digest, source.nativeSourceDigest, 'native freeze identity');
  equal(report.source.digest, source.nativeSourceDigest, 'captured campaign source identity');
  equal(source.status, 'passed', 'complete original replay passed');
  equal(source.completeSelectedOwnTrajectoryParity, true, 'all selected original contexts covered');
  equal(source.exactOriginal.coldStart, true, 'source starts cold');
  equal(source.exactOriginal.primedFromCapturedProposalMemory, false, 'captured state is comparison-only');
  originalsBefore = verifyOriginals(); equal(originalsBefore, 1786, 'unchanged originals before native replay');
  state(memory, source.exactOriginal.initialState, 'initial');
  for (const prefix of source.exactOriginal.prefixes) {
    clockCheck();
    const packet = journal[prefix.position].packet, value = await observation(prefix.position, prefix.observation);
    state(memory, prefix.sourceStateBefore, `prefix ${prefix.index} before`);
    const before = memory.currentState(), actual = await proposal(memory, value, packet.frame_rows, prefix.inputs, prefix.remainingActions);
    equal(actual, prefix.sourceProposal, `prefix ${prefix.index}: every source common-proposal field exact`);
    equal(memory.currentState(), before, `prefix ${prefix.index}: planning has no acquisition`);
    const restoredOwner = restore(before.cross_events); restored++;
    equal(restoredOwner.currentState(), before, `prefix ${prefix.index}: own journal reconstruction`);
    equal(await proposal(restoredOwner, value, packet.frame_rows, prefix.inputs, prefix.remainingActions), actual,
      `prefix ${prefix.index}: restoration preserves next complete proposal`);
    for (const expected of source.ablation.cases.filter(item => item.prefixIndex === prefix.index)) {
      clockCheck();
      const altered = restore(omit(before.cross_events, expected.intervention));
      equal(identity(altered.currentState()), expected.counterfactualProjectionDigest, `prefix ${prefix.index}: ${expected.intervention} exact retained intervention`);
      const { cross_events: originalJournal, ...originalKnowledge } = before;
      const { cross_events: alteredJournal, ...alteredKnowledge } = altered.currentState();
      equal(!isDeepStrictEqual(originalKnowledge, alteredKnowledge), expected.knowledgeChanged,
        `prefix ${prefix.index}: ${expected.intervention} acquired knowledge change excludes journal identity alone`);
      if (!expected.executed) {
        ablations.push({ prefixIndex: prefix.index, intervention: expected.intervention, executed: false,
          sourceError: expected.error, qualification: 'Not executed in the unchanged source bounded replay; no native contribution claimed.' });
        continue;
      }
      const alternative = await proposal(altered, value, packet.frame_rows, prefix.inputs, prefix.remainingActions);
      equal(decision(alternative), expected.counterfactual, `prefix ${prefix.index}: ${expected.intervention} source/native counterfactual`);
      const actionChanged = !isDeepStrictEqual(actionProjection(actual), actionProjection(alternative));
      const decisionChanged = !isDeepStrictEqual(decision(actual), decision(alternative));
      equal(actionChanged, expected.actionOrRefusalChanged, `prefix ${prefix.index}: ${expected.intervention} action/refusal attribution`);
      equal(decisionChanged, expected.decisionChanged, `prefix ${prefix.index}: ${expected.intervention} decision attribution`);
      ablations.push({ prefixIndex: prefix.index, intervention: expected.intervention, executed: true,
        knowledgeChanged: expected.knowledgeChanged, actionOrRefusalChanged: actionChanged, decisionChanged,
        actual: decision(actual), counterfactual: decision(alternative) });
    }
    const steps = source.exactOriginal.steps.filter(item => item.prefixIndex === prefix.index);
    for (const step of steps) {
      clockCheck(); const position = step.sequence - 1, first = journal[position].packet, later = journal[position + 1].packet;
      const beforeObservation = await observation(position, step.before), afterObservation = await observation(position + 1, step.after);
      equal(crossedPrefixBefore(actual, step.index, first.frame_rows, step.beforeMeta), step.beforeGuard, `return ${step.sequence}: original before guard`);
      equal(crossedPrefixAfter(actual, step.index, first.frame_rows, later.frame_rows, step.afterMeta), step.afterGuard, `return ${step.sequence}: original after guard`);
      state(memory, step.sourceStateBefore, `return ${step.sequence} before`);
      const events = memory.record(beforeObservation, step.command, afterObservation, first.frame_rows, later.frame_rows, actual, step.index);
      equal(events, step.sourceOwnEvents, `return ${step.sequence}: complete original own acquisition`);
      ownEvents += events.length; state(memory, step.sourceStateAfter, `return ${step.sequence} after`);
      const reconstructed = restore(memory.currentState().cross_events); restored++;
      equal(reconstructed.currentState(), memory.currentState(), `return ${step.sequence}: exact reconstructed projection`);
      returns.push({ sequence: step.sequence, prefixIndex: prefix.index, eventCount: events.length,
        eventKinds: events.map(event => event.kind), boundary: step.boundary });
    }
    selections.push({ prefixIndex: prefix.index, position: prefix.position, mode: actual.crossed_prefix_plan.mode,
      actions: actual.actions, exactCommonSourceProposal: true, emptySeed: selections.length === 0 });
  }
  state(memory, source.exactOriginal.finalState, 'final');
  equal(returns.length, source.capturedSelectedCrossedActions, 'every selected actual return covered');
  equal(ownEvents, source.capturedSelectedCrossedEvents, 'every captured own event covered');
  equal(ablations.length, source.ablation.interventions, 'all counterfactuals including negatives retained');
  equal(ablations.filter(item => item.actionOrRefusalChanged).length, source.ablation.actionOrRefusalChanges, 'exact native/source action contribution count');
  originalsAfter = verifyOriginals(); equal(originalsAfter, originalsBefore, 'originals unchanged after native replay');
  clockCheck();
} catch (error) {
  failure = { name: error.name, message: error.message, stack: error.stack };
}
const inputPaths = [sourcePath, reportPath, journalPath, manifestPath, fileURLToPath(import.meta.url),
  resolve(root, 'src/logos-engine/v6-crossed-prefix-access.ts'), resolve(root, 'src/logos-engine/v6-crossed-prefix-observation.ts'),
  resolve(root, 'src/logos-engine/v6-native-observer.ts')];
const output = { schema: 'logos-engine.lot3h.crossed-prefix-public-native-source-review.v1',
  status: failure ? 'failed' : 'passed', startedAt, recordedAt: localTime(), displayTimeZone: 'UTC-03:00',
  game: source.game, sourceCommit: source.sourceCommit, nativeSourceDigest: manifest.digest,
  checkedCount: checks.length, checks, failure, inputs: inputPaths.map(record),
  originalFilesVerifiedBefore: originalsBefore, originalFilesVerifiedAfter: originalsAfter,
  exactOriginal: { prefixes: selections.length, returns: returns.length, ownEvents, restorations: restored,
    coldStart: true, primedFromCapturedProposalMemory: false, completeSelectedOwnTrajectoryParity: !failure,
    fullInheritedCallerParity: false },
  contribution: { interventions: ablations.length, executed: ablations.filter(item => item.executed).length,
    actionOrRefusalChanges: ablations.filter(item => item.actionOrRefusalChanged).length,
    decisionChanges: ablations.filter(item => item.decisionChanged).length,
    negativeOrUnchanged: ablations.filter(item => item.executed && !item.actionOrRefusalChanged).length,
    componentAblation: true, fullCallerAblation: false },
  selections, returns, ablations, capturedCommonTerminal: report.final,
  newGameActions: 0, levelJumps: 0, gameEngineOrSpecificationRead: false, benchmarkExecuted: false,
  qualification: 'Cold native own-memory replay over complete actual public observations. Proposals, bindings, guards, returned events and reconstructed state match the unchanged original source scope. Captured plan.state is never an initialization source. Counterfactuals omit only earlier acquired event types or the last earlier return; zero and negative effects are retained. Source and native component ablations agree, but no full-caller ablation, new live action, full inherited parity, timing replay or success inference is claimed. Native assignment limits remain enabled with a deterministic unexpired replay clock.' };
writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: output.status, output: relative(root, outputPath), checkedCount: checks.length,
  exactOriginal: output.exactOriginal, contribution: output.contribution, failure }));
if (failure) process.exitCode = 1;
