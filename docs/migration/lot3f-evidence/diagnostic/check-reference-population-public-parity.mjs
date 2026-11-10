/** Cold native verification of the explicitly supplied original-source replay.
 * No game host or captured plan.state initializes this own memory. Every return,
 * including an empty acquisition, is replayed with a newly computed proposal.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ReferencePopulationMemory, referencePopulationBefore, referencePopulationAfter } from '../../../../src/logos-engine/v6-reference-population-access.ts';
import { measureReferencePopulation } from '../../../../src/logos-engine/v6-reference-population-observation.ts';
import { measureNativeObservation, ObservedInputDomain } from '../../../../src/logos-engine/v6-native-observer.ts';
import { symbolicDigest as identity } from '../../../../src/logos-engine/v6-hash.ts';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../../../..');
assert.ok(process.argv[2], 'Usage: node check-reference-population-public-parity.mjs SOURCE_REPLAY.json.gz [OUTPUT.json]');
const sourcePath = resolve(process.argv[2]);
const load = path => JSON.parse(path.endsWith('.gz') ? gunzipSync(readFileSync(path)) : readFileSync(path));
const source = load(sourcePath), slug = source.game.toLowerCase(), session = resolve(root, source.sessionPath);
const reportPath = resolve(session, slug + '-campaign.json.gz'), journalPath = resolve(session, slug + '-actual-public-journal.jsonl.gz');
const tracePath = resolve(session, slug + '-public-trace.json.gz'), nativeManifestPath = resolve(session, 'source-manifest.json');
const report = load(reportPath), trace = load(tracePath), nativeManifest = load(nativeManifestPath);
const journal = gunzipSync(readFileSync(journalPath)).toString().trim().split('\n').map(JSON.parse);
const originalRoot = resolve(root, 'reference/v6', source.sourceCommit, 'source');
const originalManifestPath = resolve(originalRoot, '../manifest.json'), originalManifest = load(originalManifestPath);
const policyPath = resolve(originalRoot, 'agents/yf_arc3_v6/morphology_policy/strategy.drm');
const policy = load(policyPath).declarations[0].configuration.observed_composition_services;
const checks = [], observations = new Map(), capturedObservations = new Map();
const sha = value => createHash('sha256').update(value).digest('hex');
const copy = value => structuredClone(value);
const publicCommand = command => ({ action_ref: command.action_ref, data: command.data ?? {} });
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); checks.push(label); }
function check(condition, label) { assert.ok(condition, label); checks.push(label); }
function verifyOriginals() {
  for (const [name, expected] of Object.entries(originalManifest.files)) assert.equal(sha(readFileSync(resolve(originalRoot, name))), expected.sha256, name);
  return Object.keys(originalManifest.files).length;
}
function findObservations(value) {
  if (Array.isArray(value)) for (const child of value) findObservations(child);
  else if (value && typeof value === 'object') {
    if (['observation_ref', 'revision', 'level_epoch', 'available_action_refs', 'entities'].every(key => key in value)) {
      if (capturedObservations.has(value.observation_ref)) assert.deepStrictEqual(capturedObservations.get(value.observation_ref), value);
      capturedObservations.set(value.observation_ref, value);
    } else for (const child of Object.values(value)) findObservations(child);
  }
}
findObservations(report.inventorySourceCalls);
for (const [name, expected] of Object.entries(source.inputs)) assert.equal(sha(readFileSync(resolve(root, name))), expected, name);
checks.push('all original replay inputs retain their recorded hashes');
for (const [name, expected] of Object.entries(nativeManifest.files)) assert.equal(sha(readFileSync(resolve(root, name))), expected, name);
checks.push('every frozen native source retains its captured hash');
equal(source.nativeSourceDigest, nativeManifest.digest, 'source replay and native manifest identify the same frozen implementation');
equal(report.source.digest, nativeManifest.digest, 'captured campaign uses the same frozen implementation');
equal(source.originalFilesVerifiedBefore, 1786, 'Python verified every original before replay');
equal(source.originalFilesVerifiedAfter, 1786, 'Python verified every original after replay');
const originalsBefore = verifyOriginals();
equal(originalsBefore, 1786, 'native review independently verifies every original before its own replay');
equal(trace.packets, journal, 'public trace equals the independently retained actual journal');
equal(journal.length, report.actions.length + 1, 'each captured actual action has exactly one public return');
for (let position = 0; position < journal.length; position++) {
  const entry = journal[position];
  assert.equal(entry.packet.step_index, position);
  assert.equal(identity(entry.packet.frame_rows).slice(0, 16), entry.packet.frame_hash);
  assert.deepStrictEqual(entry.command, position ? report.actions[position - 1].command : null);
}
checks.push('every retained public raster and actual command retains its packet identity');
const observationReceipts = new Map(source.originalObservationReceipts.map(item => [item.observationRef, item]));
async function observation(position, reference) {
  const packet = journal[position].packet;
  if (observations.has(reference)) return observations.get(reference);
  const match = /^(.*):epoch:(\d+):revision:(\d+):frame:([a-f0-9]+)$/.exec(reference);
  assert.ok(match); assert.equal(Number(match[2]), packet.level); assert.equal(match[4], packet.frame_hash);
  const measured = await measureNativeObservation(packet, Number(match[3]), match[1]);
  const receipt = observationReceipts.get(reference);
  check(receipt !== undefined, `observation ${reference} has an independent original measurement`);
  equal(measured.observation_ref, reference, `observation ${reference} exact identity`);
  equal(identity(packet.frame_rows), receipt.rasterDigest, `observation ${reference} exact public pixels`);
  equal(identity(measured), receipt.observationDigest, `observation ${reference} complete original/native neutral measurement`);
  const captured = capturedObservations.get(reference);
  equal(captured !== undefined, receipt.capturedInventoryObservationMatched, `observation ${reference} Inventory capture presence`);
  if (captured) equal(measured, captured, `observation ${reference} complete captured Inventory value`);
  observations.set(reference, measured);
  return measured;
}
const lane = source.exactOriginal;
equal(lane.coldStart, true, 'unchanged original starts cold');
equal(lane.primedFromCapturedProposalMemory, false, 'native proposal state never initializes original memory');
let memory = new ReferencePopulationMemory(), returns = 0, ownEvents = 0, emptyReturns = 0, restored = 0;
function state(expected, label) {
  const current = memory.currentState();
  equal({ population_controls: current.population_controls, population_state: current.population_state }, expected.acquiredState, `${label} complete acquired controls and state`);
  equal(identity(current.population_events), expected.eventsDigest, `${label} complete own journal digest`);
  equal(identity(current.population_controls), expected.controlsDigest, `${label} controls digest`);
  equal(identity(current.population_state), expected.stateDigest, `${label} state digest`);
  equal(identity(current), expected.projectionDigest, `${label} complete own projection digest`);
  equal(memory.eventCount, expected.eventCount, `${label} own event count`);
  equal(memory.retainedDigest(expected.parentDigest), expected.digest, `${label} own suffix on opaque original parent`);
}
function rebuild(label) {
  const previous = memory.currentState(), next = new ReferencePopulationMemory();
  for (const event of previous.population_events) next.applyEvent(copy(event));
  equal(next.currentState(), previous, `${label} own restore reconstructs every field`);
  equal(next.retainedDigest('independent-own-layer'), memory.retainedDigest('independent-own-layer'), `${label} own restore preserves digest`);
  memory = next; restored++;
}
function stripEnvelope(captured, proposal) {
  const result = Object.fromEntries(Object.keys(proposal).filter(key => Object.hasOwn(captured, key)).map(key => [key, copy(captured[key])]));
  for (const step of result.steps ?? []) for (const key of ['expected_before', 'point_support', 'point_binding']) delete step[key];
  return result;
}
state(lane.initialState, 'cold initial');
for (const prefix of lane.prefixes) {
  state(prefix.sourceStateBefore, `prefix ${prefix.index} before`);
  const current = await observation(prefix.position, prefix.observationRef), rows = journal[prefix.position].packet.frame_rows;
  const inputs = new ObservedInputDomain(256).candidates(current).filter(action => !action.data || !Object.keys(action.data).length);
  equal(inputs, prefix.nonpointInputs, `prefix ${prefix.index} consumed nonpoint input domain`);
  const config = { ...copy(policy), remaining_level_actions: prefix.remainingActions };
  const proposal = memory.propose(copy(current), copy(rows), copy(inputs), prefix.prefixLimit, config);
  equal(proposal, prefix.sourceProposal, `prefix ${prefix.index} complete own source proposal`);
  const capturedPrefix = report.prefixes[prefix.index], captured = capturedPrefix.observedReferencePopulation.proposal;
  equal(proposal, stripEnvelope(captured, proposal), `prefix ${prefix.index} complete captured own proposal`);
  equal(lane.restorations.find(item => item.prefixIndex === prefix.index)?.nextProposalEqual, true, `prefix ${prefix.index} source restore preserves proposal`);
  state(prefix.sourceStateBefore, `prefix ${prefix.index} after pure proposal`);
  const capturedEvents = capturedPrefix.sharedSeries.referencePopulationAcquiredEvents;
  let eventCursor = 0;
  for (const step of lane.steps.filter(item => item.prefixIndex === prefix.index)) {
    const beforePosition = step.sequence - 1, afterPosition = step.sequence;
    const before = await observation(beforePosition, step.beforeObservationRef), after = await observation(afterPosition, step.afterObservationRef);
    const first = journal[beforePosition].packet.frame_rows, later = journal[afterPosition].packet.frame_rows;
    state(step.sourceStateBefore, `return ${step.sequence} before`);
    equal(proposal.actions[step.index], step.command, `return ${step.sequence} source-selected command`);
    equal(publicCommand(step.command), publicCommand(journal[afterPosition].command), `return ${step.sequence} actual public command`);
    const beforeGuard = referencePopulationBefore(proposal, step.index, first, step.beforeMeta);
    const afterGuard = referencePopulationAfter(proposal, step.index, first, later, step.afterMeta);
    equal(beforeGuard, step.beforeGuard, `return ${step.sequence} source before guard`);
    equal(beforeGuard.admitted, true, `return ${step.sequence} actual action admitted`);
    equal(afterGuard, step.afterGuard, `return ${step.sequence} source after guard`);
    equal(afterGuard, step.capturedOutcome, `return ${step.sequence} captured common outcome`);
    equal(measureReferencePopulation(first, proposal.reference_population_plan.scene), step.sourceProjectionBefore, `return ${step.sequence} source retained projection`);
    equal(step.capturedOwnEventStart, eventCursor, `return ${step.sequence} own event slice starts at actual cursor`);
    const generated = memory.record(copy(before), copy(step.command), copy(after), copy(first), copy(later), proposal, step.index);
    equal(generated, step.sourceOwnEvents, `return ${step.sequence} unchanged-original own acquisition`);
    equal(generated, capturedEvents.slice(eventCursor, eventCursor + generated.length), `return ${step.sequence} captured native own acquisition`);
    check(generated.length <= 1, `return ${step.sequence} at most one own event`);
    eventCursor += generated.length; ownEvents += generated.length; returns++;
    if (!generated.length) emptyReturns++;
    state(step.sourceStateAfter, `return ${step.sequence} after`);
  }
  if (lane.stop === null || lane.stop.prefixIndex !== prefix.index) equal(eventCursor, capturedEvents.length, `prefix ${prefix.index} every captured own event belongs to one actual return`);
  rebuild(`prefix ${prefix.index}`);
}
state(lane.finalState, 'final');
rebuild('final');
state(lane.finalState, 'final after restore');
equal(lane.restorationOwnLayerEqual, true, 'original final own reconstruction is exact');
for (const receipt of lane.restorations) {
  equal(receipt.ownProjectionEqual, true, `original restore ${receipt.phase} preserves complete own projection`);
  // The live original ancestor is deliberately opaque. The source receipt
  // records both its fresh parent and the own suffix rebound to the live one.
  check(typeof receipt.restoredSuffixOnOriginalParent === 'string' && receipt.restoredSuffixOnOriginalParent.length === 64,
    `original restore ${receipt.phase} retains its explicit parent-bound digest`);
}
if (lane.terminalRecomputation?.sourceProposal) {
  const terminal = lane.terminalRecomputation, current = await observation(terminal.position, terminal.observationRef);
  const before = memory.currentState();
  const proposal = memory.propose(copy(current), copy(journal[terminal.position].packet.frame_rows), copy(terminal.nonpointInputs),
    terminal.prefixLimit, { ...copy(policy), remaining_level_actions: terminal.remainingActions });
  equal(proposal, terminal.sourceProposal, 'final own recomputation matches the unchanged original');
  equal(memory.currentState(), before, 'final own recomputation acquires no new evidence');
  equal(terminal.capturedControllerCall, false, 'final recomputation is explicitly not an additional captured controller call');
}
equal(returns, lane.steps.length, 'every source-replayed return is checked once');
equal(ownEvents, lane.finalState.eventCount, 'own events are derived exclusively from replayed public returns');
equal(source.capturedGameActions, journal.length - 1, 'read-only replay does not change the captured actual action count');
const complete = lane.stop === null && lane.differences.length === 0 && returns === source.capturedSelectedPopulationActions;
if (source.status === 'passed') {
  equal(complete, true, 'complete selected own trajectory matches the unchanged original');
  equal(ownEvents, source.capturedSelectedPopulationEvents, 'all captured own events are covered');
}
const originalsAfter = verifyOriginals();
equal(originalsAfter, originalsBefore, 'every original remains unchanged after native review');
const paths = [sourcePath, reportPath, journalPath, tracePath, nativeManifestPath, policyPath, originalManifestPath, fileURLToPath(import.meta.url),
  resolve(root, 'src/logos-engine/v6-reference-population-access.ts'), resolve(root, 'src/logos-engine/v6-reference-population-observation.ts'),
  resolve(root, 'src/logos-engine/v5-reference-population-calculus.ts'), resolve(root, 'src/logos-engine/v6-native-observer.ts')];
const receipt = { schema: 'logos-engine.lot3f.reference-population-public-native-source-review.v1',
  status: complete && source.status === 'passed' ? 'passed' : 'incomplete_source_replay', game: source.game,
  checks: checks.length, failed: 0, labels: checks, sourceCommit: source.sourceCommit, nativeSourceDigest: nativeManifest.digest,
  exactOriginal: { prefixes: lane.prefixes.length, returns, ownEvents, emptyReturns, restorations: restored,
    sourceStop: lane.stop, differences: lane.differences.length, coldStart: true, primedFromCapturedProposalMemory: false,
    completeSelectedOwnTrajectoryParity: complete, fullInheritedCallerParity: false },
  originalFilesVerifiedBefore: originalsBefore, originalFilesVerifiedAfter: originalsAfter,
  newGameActions: 0, levelJumps: 0, inputs: Object.fromEntries(paths.map(path => [relative(root, path), sha(readFileSync(path))])),
  capturedCommonTerminal: { actions: report.final.actions, levelsCompleted: report.final.levelsCompleted,
    level: report.final.level, status: report.final.status, reason: report.final.reason, prefixes: report.final.prefixes },
  qualification: 'Own Population memory starts cold and is rebuilt from its own newly computed events after each prefix. Selected proposals, complete neutral measurements, guards, actual commands, captured outcomes, own acquisitions including empty returns, states and digest suffixes match the unchanged original on the replayed scope. The original parent remains an opaque digest boundary. Native search deadlines and work interruption are not simulated in this deterministic replay. No full inherited-caller parity, new game action, inferred success or cost result is claimed.' };
const output = resolve(process.argv[3] ?? resolve(here, slug + '-public-parity.json'));
const temporary = output + '.tmp'; writeFileSync(temporary, JSON.stringify(receipt, null, 2) + '\n'); renameSync(temporary, output);
process.stdout.write(JSON.stringify({ path: relative(root, output), status: receipt.status, checks: checks.length,
  failed: 0, exactOriginal: receipt.exactOriginal, originalFilesVerifiedBefore: originalsBefore, originalFilesVerifiedAfter: originalsAfter }) + '\n');
if (receipt.status !== 'passed') process.exitCode = 1;
