#!/usr/bin/env node
/**
 * Strict preservation of a declared, unresolved public trajectory.
 *
 * Usage (only after the final native freeze and explicit execution release):
 *   node --expose-gc --max-old-space-size=1536 SCRIPT BASELINE TRACE SOURCE_MANIFEST OUTPUT_DIRECTORY --contract CONTRACT
 *
 * The contract schema is logos-engine.partial-public-regression-contract.v1.
 * Required fields: schema, declaredAt, status="declared", baseline, trace,
 * baselineExecution, sourceManifest, executionInputs, expected, comparisonScope.
 * Pins contain path/sha256 and optionally bytes; all paths are checkout-relative.
 * executionInputs pins this runner, the unchanged harness, service, protocol and
 * both original declarations (see executionInputPaths below).
 * expected declares game, targetLevels, baselineSourceDigest, status="failed",
 * traceStatus="failed", baselineExitCode=1, failure, actions, prefixes,
 * completePublicPackets, boundaryActionCounts, final and workshop. final has
 * EXACTLY FINAL_FIELDS. workshop has calls/records/selectedRecords/passiveRecords.
 * comparisonScope must equal COMPARISON_SCOPE below, including its limitations.
 * A plan with null future fingerprints is not an executable contract.
 *
 * No historical script, helper, native source, budget, checkpoint or game is
 * modified. recordedPublic is the existing common harness host. A read-only
 * observer checks the actual service command before it can reach that host;
 * it returns the original service result unchanged or stops on divergence.
 * All raw failed campaign evidence remains failed. Only the separate result can
 * say partial_trajectory_preserved; this never means the target was completed.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, fsyncSync, openSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SELF = relative(ROOT, fileURLToPath(import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const clone = value => structuredClone(value);
const pick = (value, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]]));
const omit = (value, keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
const sameKeys = (value, keys, label) => {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), `${label} field presence`);
};
const PACKET_FIELDS = ['frame_rows', 'frame_packet', 'level', 'levels_completed', 'state', 'step_index', 'available_action_refs', 'frame_hash'];
const FINAL_FIELDS = ['actions', 'levelsCompleted', 'level', 'state', 'status', 'reason', 'prefixes', 'sessions', 'operationCounts'];
const CALLER_FIELDS = ['enabled', 'acquiredTransitions', 'boundaryReplays', 'goalEvents', 'frontierDeltas', 'components'];
const PREFIX_FIELDS = ['id', 'decisionRevision', 'acquiredActions', 'family', 'operations', 'proposalKind', 'fieldSubquestion',
  'materialSubquestion', 'selectionGroup', 'programControlProbeMode', 'programRelationMode', 'rootedQuotaPhase',
  'productPanelFactors', 'productPanelEstimated', 'productPanelObservedSteps', 'labeledSequenceLabel', 'labeledSequenceQuery',
  'labeledSequenceTrainingReused', 'labeledSequenceCompatiblePredicates', 'labeledSequenceAgreement',
  'labeledSequenceGrammarSize', 'supportMode', 'callerAcquiredTransitions'];
const COORDINATION_FIELDS = ['rule', 'guard_reason', 'scope', 'deferred_family', 'preferred_family', 'physical_action_authorized',
  'source_trigger_group', 'source_trigger_entry', 'selected_group', 'selected_entry', 'selected_subquestion'];
const BOUNDARY_FIELDS = ['completedLevel', 'nativeLevel', 'levelsCompleted', 'levelActions', 'totalActions', 'prefixCount', 'phase', 'sessionRetained'];
const COMPARISON_SCOPE = {
  exact: ['complete public commands and packets', 'action metadata except executionMs',
    'selected prefix scalar fields and declared coordination fields', 'epoch order and inherited source-series counts',
    'request protocol and caller counters/components', 'natural boundaries and retained-session caller counters/components',
    'final public outcome, unresolved failure and operation counts', 'mechanical domain assessments',
    'Workshop source-call order, public revisions, commands, selections and record cardinality'],
  excluded: ['durations', 'native implementation label', 'migration coverage/status labels',
    'fresh observation-session identifiers in coordination and epoch anchors',
    'graph chains, graph revisions, graph node counts and complete provider state equality'],
  actionNormalization: 'none', publicPacketNormalization: 'none',
  targetCompletionClaim: false, speedComparisonClaim: false, originalCallerParityClaim: false,
};
const REFERENCE = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6';
// Statically reviewed in both the 4B development and 7A helper: only
// HANO/SYME/DNOI have an implicit historical fixture. Any edit requires review.
const REVIEWED_BASELINE_FOR_SHA256 = '77c9d5ca75f6ff41104d74f9afe30e130e458cc847c9820cbbb601a9f91df28d';
const executionInputPaths = {
  runner: SELF,
  harness: 'tests/helpers/v6-live-game-campaign.ts',
  service: 'src/runtime/v6-agent-service.ts',
  protocol: 'src/runtime/v6-agent-protocol.ts',
  commonDeclaration: `${REFERENCE}/laya_proto/common_frontier_policy.drm.json`,
  strategyDeclaration: `${REFERENCE}/morphology_policy/strategy.drm`,
};

function local(name) {
  assert.ok(typeof name === 'string' && name.length > 0 && !isAbsolute(name), 'Use a nonempty checkout-relative path');
  const path = resolve(ROOT, name), part = relative(ROOT, path);
  assert.ok(part && !part.startsWith('..') && !isAbsolute(part), 'Evidence must remain inside the checkout');
  return path;
}
async function file(name) {
  const path = local(name), actual = await realpath(path);
  assert.equal(actual, path, 'Input evidence must not traverse symlinks');
  const bytes = await readFile(path);
  return { bytes, fingerprint: { path: relative(ROOT, path), sha256: hash(bytes), bytes: bytes.byteLength } };
}
async function jsonFile(name) {
  const item = await file(name);
  const decoded = item.bytes[0] === 0x1f && item.bytes[1] === 0x8b ? gunzipSync(item.bytes) : item.bytes;
  return { value: JSON.parse(decoded.toString('utf8')), fingerprint: item.fingerprint };
}
function pinMatches(pin, actual, label) {
  assert.ok(pin && typeof pin === 'object' && !Array.isArray(pin), `${label}: pin missing`);
  assert.ok(Object.keys(pin).every(key => ['path', 'sha256', 'bytes'].includes(key)), `${label}: unexpected pin fields`);
  assert.match(pin.sha256, /^[a-f0-9]{64}$/, `${label}: missing real SHA-256`);
  assert.equal(local(pin.path), local(actual.path), `${label}: path differs`);
  assert.equal(pin.sha256, actual.sha256, `${label}: bytes differ`);
  if (Object.hasOwn(pin, 'bytes')) assert.equal(pin.bytes, actual.bytes, `${label}: byte length differs`);
}
async function pinned(pin, label) {
  const item = await file(pin?.path);
  pinMatches(pin, item.fingerprint, label);
  return item;
}
async function nativeSource() {
  const files = {};
  async function walk(name) {
    for (const entry of await readdir(local(name), { withFileTypes: true })) {
      const child = `${name}/${entry.name}`;
      if (entry.isDirectory()) await walk(child);
      else if (/\.(?:ts|json|drm)$/.test(entry.name)) {
        assert.ok(entry.isFile(), `Native source must be a regular file: ${child}`);
        files[child] = hash(await readFile(local(child)));
      }
    }
  }
  await walk('src/logos-engine'); await walk('src/runtime');
  // Exactly the common harness inventory order, without native source imports.
  const ordered = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b, 'en')));
  return { digest: hash(JSON.stringify(ordered)), fileCount: Object.keys(ordered).length, files: ordered };
}
function validManifest(value, label) {
  sameKeys(value, ['digest', 'fileCount', 'files'], label);
  const files = Object.fromEntries(Object.entries(value.files).sort(([a], [b]) => a.localeCompare(b, 'en')));
  assert.equal(value.fileCount, Object.keys(files).length, `${label}: inventory count`);
  assert.equal(value.digest, hash(JSON.stringify(files)), `${label}: inventory digest`);
  for (const [path, digest] of Object.entries(files)) { local(path); assert.match(digest, /^[a-f0-9]{64}$/); }
}
function caller(value) {
  assert.ok(value && typeof value === 'object', 'A real common caller must be retained');
  assert.equal(value.enabled, true);
  for (const key of CALLER_FIELDS) assert.ok(Object.hasOwn(value, key), `Missing caller ${key}`);
  return pick(value, CALLER_FIELDS);
}
function requestProjection(value) {
  return { ...omit(value, ['activeSeconds', 'elapsedMs', 'caller']), caller: caller(value.caller) };
}
function responseProjection(operation, result) {
  const s = result.snapshot;
  return { operation: operation.type, sequence: operation.sequence, kind: result.kind, reason: result.reason,
    level: s.level, levelsCompleted: s.levelsCompleted, actions: s.actions, cycles: s.cycles,
    family: s.lastDecision, caller: caller(s.caller) };
}
function boundaryProjection(value) { return { ...pick(value, BOUNDARY_FIELDS), caller: caller(value.caller) }; }
function prefixProjection(value) {
  assert.ok(value.sharedSeries && Array.isArray(value.sharedSeries.epochAnchors), 'Missing inherited common source-series evidence');
  return { scalars: pick(value, PREFIX_FIELDS),
    coordination: (value.nativeCoordination ?? []).map(row => pick(row, COORDINATION_FIELDS)),
    epochs: value.sharedSeries.epochAnchors.map(row => row.epoch),
    seriesCounts: Object.fromEntries(Object.entries(value.sharedSeries).filter(([key]) => key.endsWith('Count'))) };
}
function command(value) {
  sameKeys(value, ['action_ref', 'data'], 'native public command');
  assert.match(value.action_ref, /^ACTION[1-7]$/);
  assert.ok(value.data && typeof value.data === 'object' && !Array.isArray(value.data));
  if (value.action_ref === 'ACTION6') {
    sameKeys(value.data, ['x', 'y'], 'point command data');
    assert.ok(Number.isSafeInteger(value.data.x) && Number.isSafeInteger(value.data.y));
  } else sameKeys(value.data, [], 'non-point command data');
  return value;
}
function workshopProjection(report, packets) {
  assert.ok(Array.isArray(report.workshopSourceCalls), 'The merged, unchanged harness must capture the actual Workshop source calls');
  const calls = report.workshopSourceCalls, transitions = new Set();
  let records = 0, selectedRecords = 0;
  const rows = calls.map((call, index) => {
    assert.equal(call.index, index); assert.ok(['proposeSource', 'recordSource'].includes(call.method));
    assert.ok(!Object.hasOwn(call, 'error'), 'A source-call error cannot qualify as preserved acquisition');
    const args = call.arguments;
    assert.ok(Array.isArray(args) && args[0] && call.sourceBefore && call.sourceAfter && Object.hasOwn(call, 'result'));
    const row = { index, method: call.method, revision: args[0].revision, epoch: args[0].level_epoch,
      frameHash: args[0].frame_hash };
    if (call.method === 'recordSource') {
      assert.ok(args[1] && args[2]);
      assert.ok(report.actions[records] && packets[records] && packets[records + 1], 'Workshop record must bind a retained public action');
      const sourceCommand = args[2], publicAction = report.actions[records];
      const publicCommand = command(publicAction.command);
      assert.match(sourceCommand.action_ref, /^ACTION[1-7]$/);
      // Source scalar actions may omit data or retain an explicit empty data
      // object; the public transport requires data:{}. Validate both source
      // forms separately without rewriting either object. The raw source
      // envelope remains in the compared row, including data field presence.
      if (sourceCommand.action_ref === 'ACTION6') {
        sameKeys(sourceCommand, ['action_ref', 'data'], 'Workshop source point command');
        sameKeys(sourceCommand.data, ['x', 'y'], 'Workshop source point command data');
        assert.deepEqual(sourceCommand.data, publicCommand.data, 'Workshop point data binds the actual public command');
      } else {
        const hasData = Object.hasOwn(sourceCommand, 'data');
        sameKeys(sourceCommand, hasData ? ['action_ref', 'data'] : ['action_ref'], 'Workshop source scalar command');
        if (hasData) sameKeys(sourceCommand.data, [], 'Workshop source scalar command data');
        sameKeys(publicCommand.data, [], 'Workshop scalar public command data');
      }
      assert.equal(sourceCommand.action_ref, publicCommand.action_ref, 'Workshop source action binds the actual public command in order');
      assert.equal(args[0].frame_hash, packets[records].packet.frame_hash, 'Workshop before frame must bind the public packet');
      assert.equal(args[1].frame_hash, packets[records + 1].packet.frame_hash, 'Workshop after frame must bind the public packet');
      const key = JSON.stringify([args[0].observation_ref, args[1].observation_ref]);
      assert.ok(!transitions.has(key), 'Workshop must acquire each transition only once'); transitions.add(key);
      const selected = args[5] !== null && args[5] !== undefined && Object.hasOwn(args[5], 'workshop_plan');
      records++; if (selected) selectedRecords++;
      Object.assign(row, { afterRevision: args[1].revision, afterEpoch: args[1].level_epoch,
        afterFrameHash: args[1].frame_hash, command: clone(sourceCommand), publicActionSequence: publicAction.sequence, selected });
    } else {
      Object.assign(row, { proposalKind: call.result?.kind ?? null,
        proposalActions: call.result === null ? null : clone(call.result.actions) });
    }
    return row;
  });
  return { summary: { calls: calls.length, records, selectedRecords, passiveRecords: records - selectedRecords }, rows };
}

function parseArguments() {
  const args = process.argv.slice(2);
  assert.ok(args.length === 6 && args[4] === '--contract',
    'Usage: SCRIPT BASELINE TRACE SOURCE_MANIFEST OUTPUT_DIRECTORY --contract CONTRACT');
  const [baseline, trace, sourceManifest, output, , contract] = args;
  const paths = [baseline, trace, sourceManifest, output, contract].map(local);
  assert.equal(new Set(paths).size, paths.length, 'All inputs and output must be distinct');
  for (const path of paths.filter(path => path !== local(output)))
    assert.ok(!path.startsWith(local(output) + '/'), 'The exclusive output directory must not contain an input');
  return { baseline, trace, sourceManifest, output, contract };
}

async function prepare(args) {
  const contractFile = await jsonFile(args.contract), contract = contractFile.value;
  sameKeys(contract, ['schema', 'declaredAt', 'status', 'baseline', 'trace', 'baselineExecution', 'sourceManifest',
    'executionInputs', 'expected', 'comparisonScope'], 'partial trajectory contract');
  assert.equal(contract.schema, 'logos-engine.partial-public-regression-contract.v1');
  assert.equal(contract.status, 'declared');
  assert.ok(Number.isFinite(Date.parse(contract.declaredAt)) && Date.parse(contract.declaredAt) <= Date.now(), 'The contract must be declared before execution');
  assert.deepEqual(contract.comparisonScope, COMPARISON_SCOPE, 'No weakening or hidden enlargement of the declared comparison scope');
  assert.equal(contract.baseline.path, args.baseline); assert.equal(contract.trace.path, args.trace);
  assert.equal(contract.sourceManifest.path, args.sourceManifest);
  const baselineFile = await jsonFile(args.baseline), traceFile = await jsonFile(args.trace);
  pinMatches(contract.baseline, baselineFile.fingerprint, 'baseline'); pinMatches(contract.trace, traceFile.fingerprint, 'trace');
  const sourceFile = await jsonFile(args.sourceManifest); pinMatches(contract.sourceManifest, sourceFile.fingerprint, 'final native freeze');
  validManifest(sourceFile.value, 'final native freeze');
  const before = await nativeSource(); assert.deepEqual(before, sourceFile.value, 'Current native source is not the actual declared freeze');
  sameKeys(contract.executionInputs, Object.keys(executionInputPaths), 'execution input pins');
  const inputs = { contract: contractFile.fingerprint, baseline: baselineFile.fingerprint, trace: traceFile.fingerprint, sourceManifest: sourceFile.fingerprint };
  for (const [name, path] of Object.entries(executionInputPaths)) {
    assert.equal(contract.executionInputs[name].path, path);
    inputs[name] = (await pinned(contract.executionInputs[name], name)).fingerprint;
  }
  const executionFile = await jsonFile(contract.baselineExecution.path);
  pinMatches(contract.baselineExecution, executionFile.fingerprint, 'historical execution'); inputs.baselineExecution = executionFile.fingerprint;
  const baseline = baselineFile.value, trace = traceFile.value, execution = executionFile.value, expected = contract.expected;
  sameKeys(expected, ['game', 'targetLevels', 'baselineSourceDigest', 'status', 'traceStatus', 'baselineExitCode', 'failure',
    'actions', 'prefixes', 'completePublicPackets', 'boundaryActionCounts', 'final', 'workshop'], 'expected historical partial trajectory');
  assert.match(expected.game, /^[A-Z0-9]{4}$/);
  assert.ok(!['HANO', 'SYME', 'DNOI'].includes(expected.game), 'This host rejects games with a harness baselineFor fixture');
  assert.equal(expected.status, 'failed'); assert.equal(expected.traceStatus, 'failed'); assert.equal(expected.baselineExitCode, 1);
  assert.ok(Number.isSafeInteger(expected.targetLevels) && expected.targetLevels > 1 && expected.targetLevels <= 100);
  assert.ok(Number.isSafeInteger(expected.actions) && expected.actions > 0);
  assert.ok(Number.isSafeInteger(expected.prefixes) && expected.prefixes > 0);
  sameKeys(expected.final, FINAL_FIELDS, 'expected final partial outcome');
  assert.equal(expected.final.actions, expected.actions); assert.equal(expected.final.prefixes, expected.prefixes);
  assert.equal(expected.final.sessions, 1); assert.equal(expected.final.status, 'stopped');
  assert.equal(expected.final.reason, 'frontier_unknown');
  assert.ok(Number.isSafeInteger(expected.final.levelsCompleted) && expected.final.levelsCompleted > 0
    && expected.final.levelsCompleted < expected.targetLevels, 'A declared partial trajectory must leave the original target unresolved');
  assert.equal(expected.completePublicPackets, expected.actions + 1);
  assert.ok(Array.isArray(expected.boundaryActionCounts) && expected.boundaryActionCounts.length === expected.final.levelsCompleted);
  assert.ok(typeof expected.failure === 'string' && expected.failure.includes('frontier_unknown'));
  assert.equal(baseline.schema, 'logos-engine.v6.integrated-game-campaign.v1');
  assert.equal(trace.schema, 'logos-engine.native-public-game-trace.v1');
  assert.equal(execution.schema, 'logos-engine.v53.actual-journaled-campaign-execution.v1');
  assert.equal(baseline.status, expected.status); assert.equal(trace.status, expected.traceStatus);
  assert.equal(baseline.failure, expected.failure); assert.equal(baseline.game, expected.game); assert.equal(trace.game, expected.game);
  assert.equal(baseline.targetLevels, expected.targetLevels); assert.equal(baseline.baseline, null);
  assert.equal(baseline.sourceUnchangedDuringRun, true); assert.deepEqual(baseline.pythonAgentModules, []);
  validManifest(baseline.source, 'historical native source');
  assert.equal(baseline.source.digest, expected.baselineSourceDigest); assert.equal(trace.sourceDigest, expected.baselineSourceDigest);
  assert.equal(execution.exitCode, expected.baselineExitCode); assert.equal(execution.nativeSourceUnchanged, true);
  assert.equal(execution.executionCodeUnchanged, true); assert.deepEqual(execution.executionInputs, execution.executionInputsAfter);
  assert.deepEqual(execution.nativeSource, baseline.source); assert.deepEqual(execution.nativeSourceAfter, baseline.source);
  assert.equal(execution.nativeSourceManifestDigest, expected.baselineSourceDigest);
  pinMatches(execution.report, baselineFile.fingerprint, 'historical execution report');
  pinMatches(execution.trace, traceFile.fingerprint, 'historical execution trace');
  const journalFile = await pinned(execution.publicJournal, 'historical passive public journal');
  inputs.baselinePublicJournal = journalFile.fingerprint;
  const journalBytes = journalFile.bytes[0] === 0x1f && journalFile.bytes[1] === 0x8b ? gunzipSync(journalFile.bytes) : journalFile.bytes;
  const journal = journalBytes.toString('utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  assert.deepEqual(journal, trace.packets, 'Every original journal entry must equal the archived public trace');
  assert.deepEqual(baseline.budget, { levelActionCaps: Array(expected.targetLevels).fill(600), activeSecondsPerLevel: 360,
    clock: 'real active compute and native execution' });
  assert.match(baseline.referenceCommit, /^[a-f0-9]{40}$/);
  assert.ok(baseline.gameAssets && Object.keys(baseline.gameAssets).length > 0);
  for (const value of Object.values(baseline.gameAssets)) assert.match(value, /^[a-f0-9]{64}$/);
  assert.equal(baseline.actions.length, expected.actions); assert.equal(baseline.prefixes.length, expected.prefixes);
  assert.equal(trace.packets.length, expected.completePublicPackets);
  assert.deepEqual(pick(baseline.final, FINAL_FIELDS), expected.final);
  assert.equal(baseline.final.caller.acquiredTransitions, expected.actions);
  assert.equal(baseline.final.caller.boundaryReplays, expected.boundaryActionCounts.length);
  assert.equal(baseline.prefixes.reduce((total, row) => total + row.acquiredActions, 0), expected.actions);
  const operationCounts = {};
  for (const row of baseline.requests) operationCounts[row.operation] = (operationCounts[row.operation] ?? 0) + 1;
  assert.deepEqual(operationCounts, expected.final.operationCounts);
  assert.equal(operationCounts.init, 1); assert.equal(operationCounts.advance, expected.actions);
  assert.ok(Object.keys(operationCounts).every(key => ['init', 'advance', 'resume'].includes(key)));
  const derivedBoundaries = [];
  for (const [index, item] of trace.packets.entries()) {
    sameKeys(item, ['command', 'packet'], 'public trace entry');
    const packet = item.packet; sameKeys(packet, PACKET_FIELDS, 'complete public packet');
    assert.equal(packet.step_index, index); assert.equal(packet.frame_hash, hash(JSON.stringify(packet.frame_rows)).slice(0, 16));
    assert.ok(Array.isArray(packet.frame_packet) && packet.frame_packet.length > 0);
    assert.deepEqual(packet.frame_rows, packet.frame_packet.at(-1));
    const packetSha256 = hash(JSON.stringify(pick(packet, PACKET_FIELDS)));
    if (index === 0) {
      assert.equal(item.command, null); assert.equal(packet.level, 1); assert.equal(packet.levels_completed, 0);
      assert.deepEqual(baseline.initial, { publicPacketSha256: packetSha256, state: packet.state, level: 1, levelsCompleted: 0 });
    } else {
      command(item.command); const action = baseline.actions[index - 1], previous = trace.packets[index - 1].packet;
      assert.deepEqual(action.command, item.command); assert.equal(action.sequence, index);
      assert.equal(action.publicPacketSha256, packetSha256); assert.equal(action.frameHash, packet.frame_hash);
      assert.equal(action.animationFrames, packet.frame_packet.length);
      assert.equal(action.levelBefore, previous.level); assert.equal(action.completedBefore, previous.levels_completed);
      assert.equal(action.levelAfter, packet.level); assert.equal(action.completedAfter, packet.levels_completed);
      assert.equal(action.state, packet.state); assert.ok(packet.levels_completed >= previous.levels_completed);
      if (packet.levels_completed > previous.levels_completed) {
        assert.equal(packet.levels_completed, previous.levels_completed + 1);
        derivedBoundaries.push(index);
      }
    }
  }
  assert.deepEqual(derivedBoundaries, expected.boundaryActionCounts);
  assert.deepEqual(baseline.boundaries.map(row => row.totalActions), derivedBoundaries);
  assert.ok(baseline.boundaries.every(row => row.sessionRetained === true));
  const last = trace.packets.at(-1).packet;
  assert.deepEqual([last.level, last.levels_completed, last.state], [expected.final.level, expected.final.levelsCompleted, expected.final.state]);
  const workshop = workshopProjection(baseline, trace.packets); assert.deepEqual(workshop.summary, expected.workshop);
  assert.equal(workshop.summary.records, expected.actions);
  // baselineFor has no LKEY branch in either the development or 7A helper.
  // Retain and inspect its exact body before importing any native module. A
  // future helper edit adding the declared game must refuse this host.
  const helperText = (await readFile(local(executionInputPaths.harness), 'utf8'));
  assert.ok(helperText.includes('workshopSourceCalls: []')
    && helperText.includes("f.id === 'public_ranked_workshop'")
    && helperText.includes('report.workshopSourceCalls.push(event)'),
  'The declared final merged helper must retain its real Workshop source-call observer');
  const baselineFor = helperText.match(/async function baselineFor\(game: string\): Promise<R \| null> \{([\s\S]*?)\n\}/)?.[0];
  assert.ok(baselineFor, 'The reviewed baselineFor surface must be present');
  assert.equal(hash(baselineFor), REVIEWED_BASELINE_FOR_SHA256, 'baselineFor changed; review its fixture behavior before replay');
  assert.ok(!baselineFor.includes(expected.game), 'The declared game now has a hidden fixture path in baselineFor; review required');
  const expectation = clone({
    game: baseline.game, targetLevels: baseline.targetLevels, referenceCommit: baseline.referenceCommit, budget: baseline.budget,
    gameAssets: baseline.gameAssets, initial: baseline.initial, failure: baseline.failure,
    actions: baseline.actions.map(row => omit(row, ['executionMs'])),
    requests: baseline.requests.map(requestProjection), prefixes: baseline.prefixes.map(prefixProjection),
    boundaries: baseline.boundaries.map(boundaryProjection), final: expected.final, finalCaller: caller(baseline.final.caller),
    domainAssessments: baseline.domainAssessments, workshop,
  });
  return { contract, inputs, source: before, expectation, packets: trace.packets,
    baselinePin: pick(baselineFile.fingerprint, ['path', 'sha256']), tracePin: pick(traceFile.fingerprint, ['path', 'sha256']),
    baselineRoot: new WeakRef(baseline), baselineForSha256: hash(baselineFor),
    expectationSha256: hash(JSON.stringify(expectation)), publicPacketStreamSha256: hash(JSON.stringify(trace.packets)) };
}

async function main() {
  const args = parseArguments();
  // Exclusive evidence directory: even a failed preflight remains a distinct
  // attempt and can never be overwritten by a subsequent invocation.
  await mkdir(dirname(local(args.output)), { recursive: true });
  await mkdir(local(args.output));
  assert.equal(await realpath(local(args.output)), local(args.output), 'Output must not traverse symlinks');
  const output = name => `${args.output}/${name}`;
  const writeJson = (name, value) => writeFile(local(output(name)), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  const logFd = openSync(local(output('progress.jsonl')), 'wx');
  const journalFd = openSync(local(output('public-journal.jsonl')), 'wx');
  let sequence = 0;
  const log = value => { writeFileSync(logFd, JSON.stringify({ eventIndex: sequence++, ...value }) + '\n'); fsyncSync(logFd); };
  const startedAt = new Date().toISOString();
  const result = { schema: 'logos-engine.partial-public-regression-qualification.v1', status: 'incomplete',
    startedAt, finishedAt: null, gameTargetCompleted: null, liveGameExecuted: false,
    timingQualification: 'Elapsed values in raw reports are diagnostic only; this is not a speed measurement.',
    comparisonScope: COMPARISON_SCOPE, checks: [], error: null };
  let prepared, report, partialReport, sourceAfter, inputsAfter, originalHandle, serviceClass;
  const observedPackets = [], responses = [], commandChecks = [], boundaries = [], observedPrefixes = [];
  const compare = (name, actual, expected) => {
    try { assert.deepEqual(actual, expected, name); result.checks.push({ name, passed: true }); }
    catch (error) { result.checks.push({ name, passed: false }); throw error; }
  };
  try {
    await writeJson('started.json', { schema: 'logos-engine.partial-public-regression-started.v1', startedAt,
      command: process.argv, inputs: pick(args, ['baseline', 'trace', 'sourceManifest', 'contract']),
      status: 'started', qualification: 'No success is implied by this receipt. Missing terminal qualification means incomplete.' });
    assert.equal(typeof globalThis.gc, 'function', 'Use --expose-gc to release the baseline report before native import');
    prepared = await prepare(args);
    await new Promise(resolve => setImmediate(resolve)); globalThis.gc();
    assert.equal(prepared.baselineRoot.deref(), undefined, 'The historical report root must be released before native import');
    delete prepared.baselineRoot;
    Object.assign(result, { game: prepared.expectation.game, targetLevels: prepared.expectation.targetLevels,
      inputs: prepared.inputs, nativeSource: prepared.source,
      historicalStatus: 'failed', historicalExitCode: 1, expectedPartialOutcome: prepared.contract.expected });
    await writeJson('preparation.json', { schema: 'logos-engine.partial-public-regression-preparation.v1', status: 'preflight_verified',
      inputPinsVerified: true, inputs: prepared.inputs, nativeSource: prepared.source,
      baselineRootCollectedBeforeHarnessImport: true, baselineForSha256: prepared.baselineForSha256,
      helperBaselineFixtureExpected: null, expectationSha256: prepared.expectationSha256,
      publicPacketStreamSha256: prepared.publicPacketStreamSha256, expected: prepared.contract.expected,
      comparisonScope: COMPARISON_SCOPE });
    log({ phase: 'preflight_verified', game: prepared.expectation.game, expected: prepared.contract.expected });
    // No runtime is constructed here. The unchanged common harness constructs
    // the real factory/service. This observer only checks already computed
    // responses before returning the very same object to the caller.
    ({ V6AgentService: serviceClass } = await import('../src/runtime/v6-agent-service.ts'));
    const { runNativeGameCampaign } = await import('../tests/helpers/v6-live-game-campaign.ts');
    originalHandle = serviceClass.prototype.handle;
    let observedService = null, observedSession = null;
    serviceClass.prototype.handle = async function (...argsToService) {
      const operation = argsToService[0];
      assert.ok(observedService === null || observedService === this, 'Only one cold common service is permitted'); observedService = this;
      assert.ok(observedSession === null || observedSession === operation.sessionId, 'No session restart is permitted'); observedSession = operation.sessionId;
      const response = await originalHandle.apply(this, argsToService);
      const row = responseProjection(operation, response);
      log({ phase: 'service_response_observed', index: responses.length, response: row,
        command: response.command, ticket: response.ticket });
      compare(`service response ${responses.length}`, row, prepared.expectation.requests[responses.length]);
      assert.equal(response.snapshot.whyAct?.enabled, true);
      responses.push(clone(row));
      if (response.kind === 'action') {
        sameKeys(response.command, ['actionRef', 'data'], 'actual service command');
        const actual = { action_ref: response.command.actionRef, data: clone(response.command.data) };
        command(actual);
        const nextIndex = observedPackets.length;
        assert.ok(nextIndex > 0 && nextIndex < prepared.packets.length, 'No command may outlive the declared public trace');
        assert.equal(commandChecks.length, nextIndex - 1, 'Every public action has one fresh authorization');
        assert.equal(response.snapshot.whyAct.decision.decision.status, 'action_set_released');
        compare(`authorized command before return ${nextIndex}`, actual, prepared.packets[nextIndex].command);
        const checked = { index: nextIndex, command: actual, exactCommandSha256: hash(JSON.stringify(actual)),
          beforeArchivedReturn: true, sequence: operation.sequence, decisionRevision: response.ticket.decisionRevision,
          actionIndex: response.ticket.actionIndex };
        commandChecks.push(checked); log({ phase: 'command_checked_before_return', ...checked });
      } else {
        assert.equal(response.command, null); assert.equal(response.ticket, null);
      }
      return response;
    };
    report = await runNativeGameCampaign({ gameCode: prepared.expectation.game, targetLevels: prepared.expectation.targetLevels,
      progress(event) {
        log(event);
        // The unchanged harness spreads its boundary after the progress phase;
        // boundary.phase is the actual snapshot phase. completedLevel belongs
        // only to this event schema. Keep its phase and every comparison intact.
        if (Object.hasOwn(event, 'completedLevel')) {
          const row = boundaryProjection(event);
          compare(`natural boundary ${boundaries.length}`, row, prepared.expectation.boundaries[boundaries.length]); boundaries.push(clone(row));
        }
      },
      publicTrace(packet, actualCommand) {
        const index = observedPackets.length;
        const entry = { command: clone(actualCommand), packet: clone(packet) };
        // The actual entry is durable even if its subsequent comparison fails
        // or the process is interrupted before the common report is returned.
        writeFileSync(journalFd, JSON.stringify(entry) + '\n'); fsyncSync(journalFd);
        observedPackets.push(entry);
        if (index > 0) assert.equal(commandChecks.length, index, 'The service command must be checked before this return is observed');
        compare(`complete public return ${index}`, entry, prepared.packets[index]);
        log({ phase: 'public_return_observed', index, command: entry.command,
          publicPacketSha256: hash(JSON.stringify(pick(entry.packet, PACKET_FIELDS))) });
      },
      checkpoint(partial) {
        partialReport = partial;
        const index = observedPrefixes.length;
        assert.equal(partial.prefixes.length, index + 1, 'Exactly one new acquired prefix is checkpointed');
        const row = prefixProjection(partial.prefixes[index]);
        compare(`acquired prefix ${index}`, row, prepared.expectation.prefixes[index]); observedPrefixes.push(clone(row));
      },
      recordedPublic: { trace: prepared.tracePin, baseline: prepared.baselinePin,
        gameAssets: clone(prepared.expectation.gameAssets), packets: prepared.packets },
    });
    // Preserve the raw unresolved report before any qualification can fail.
    await writeFile(local(output('replay-campaign.json.gz')), gzipSync(JSON.stringify(report) + '\n'), { flag: 'wx' });
    result.report = (await file(output('replay-campaign.json.gz'))).fingerprint;
    await writeFile(local(output('replay-public-trace.json.gz')), gzipSync(JSON.stringify({
      schema: 'logos-engine.native-public-game-trace.v1', game: report.game, sourceDigest: report.source.digest,
      status: report.status, packets: observedPackets,
    }) + '\n'), { flag: 'wx' });
    result.trace = (await file(output('replay-public-trace.json.gz'))).fingerprint;
    compare('raw status remains failed', report.status, 'failed');
    compare('same unresolved failure', report.failure, prepared.expectation.failure);
    compare('no implicit helper reference fixture', report.baseline, null);
    compare('actual source equals frozen source', report.source, prepared.source);
    compare('actual source unchanged within common harness', report.sourceUnchangedDuringRun, true);
    compare('no Python agent imported', report.pythonAgentModules, []);
    for (const key of ['game', 'targetLevels', 'referenceCommit', 'budget', 'gameAssets', 'initial', 'domainAssessments'])
      compare(`same ${key}`, report[key], prepared.expectation[key]);
    compare('every full public return consumed', observedPackets, prepared.packets);
    compare('every exact action metadata row', report.actions.map(row => omit(row, ['executionMs'])), prepared.expectation.actions);
    compare('every common request retained', report.requests.map(requestProjection), prepared.expectation.requests);
    compare('service observer covers every common request', responses, prepared.expectation.requests);
    compare('every acquired prefix retained', report.prefixes.map(prefixProjection), prepared.expectation.prefixes);
    compare('prefix observer covers every acquired prefix', observedPrefixes, prepared.expectation.prefixes);
    compare('every natural boundary retained', report.boundaries.map(boundaryProjection), prepared.expectation.boundaries);
    compare('boundary observer covers every natural boundary', boundaries, prepared.expectation.boundaries);
    compare('same declared final public outcome', pick(report.final, FINAL_FIELDS), prepared.expectation.final);
    compare('same final caller acquisition', caller(report.final.caller), prepared.expectation.finalCaller);
    compare('Workshop call order and real selected/passive acquisition', workshopProjection(report, observedPackets), prepared.expectation.workshop);
    compare('one command checked before each archived return', commandChecks.length, prepared.contract.expected.actions);
    compare('host provenance exact', pick(report.recordedPublicReplay, ['baseline', 'trace']),
      { baseline: prepared.baselinePin, trace: prepared.tracePin });
    assert.ok(report.final.levelsCompleted < report.targetLevels, 'Partial preservation cannot be relabelled as target completion');
    assert.ok(result.checks.every(row => row.passed), 'An earlier failed check cannot be hidden by the common harness error boundary');
    result.status = 'partial_trajectory_preserved';
  } catch (error) {
    result.status = 'failed';
    result.error = { name: error?.name ?? 'Error', message: String(error?.message ?? error).slice(0, 12000) };
    log({ phase: 'qualification_failed', error: result.error });
  } finally {
    if (originalHandle) serviceClass.prototype.handle = originalHandle;
    if (prepared) {
      try {
        sourceAfter = await nativeSource(); inputsAfter = {};
        for (const [name, pin] of Object.entries(prepared.inputs)) inputsAfter[name] = (await file(pin.path)).fingerprint;
        compare('native freeze unchanged before and after', sourceAfter, prepared.source);
        compare('every execution/evidence input unchanged before and after', inputsAfter, prepared.inputs);
      } catch (error) {
        result.status = 'failed'; result.error ??= { name: error?.name ?? 'Error', message: String(error?.message ?? error).slice(0, 12000) };
      }
    }
    Object.assign(result, { finishedAt: new Date().toISOString(), nativeSourceAfter: sourceAfter ?? null,
      executionInputsAfter: inputsAfter ?? null, rawCampaignStatus: report?.status ?? null,
      rawCampaignFailure: report?.failure ?? null, actualFinal: report?.final ?? null,
      gameTargetCompleted: report ? report.final.levelsCompleted >= report.targetLevels : null,
      commandsCheckedBeforeReturn: commandChecks.length, publicPacketsObserved: observedPackets.length,
      requestsObserved: responses.length, acquiredPrefixesObserved: observedPrefixes.length,
      naturalBoundariesObserved: boundaries.length,
      qualification: 'Exact preservation is limited to the declared trajectory scope. The raw historical and current campaigns remain failed at their original unresolved target. '
        + 'No live game, third-level success, full original-caller parity, complete owner-state equality or speed result is claimed. '
        + 'A failed or absent terminal qualification must not be excluded from later reporting.' });
    await writeJson('command-checks.json', { schema: 'logos-engine.partial-public-command-checks.v1', checks: commandChecks });
    fsyncSync(journalFd); closeSync(journalFd);
    result.rawPublicJournal = (await file(output('public-journal.jsonl'))).fingerprint;
    try {
      await writeFile(local(output('public-journal.jsonl.gz')), gzipSync(await readFile(local(output('public-journal.jsonl')))), { flag: 'wx' });
      result.publicJournal = (await file(output('public-journal.jsonl.gz'))).fingerprint;
      if (!report && partialReport) {
        await writeFile(local(output('partial-campaign-checkpoint.json.gz')), gzipSync(JSON.stringify(partialReport) + '\n'), { flag: 'wx' });
        result.partialReport = (await file(output('partial-campaign-checkpoint.json.gz'))).fingerprint;
      }
    } catch (error) {
      result.status = 'failed'; result.error ??= { name: error?.name ?? 'Error', message: String(error?.message ?? error).slice(0, 12000) };
    }
    log({ phase: 'finished', status: result.status, rawCampaignStatus: result.rawCampaignStatus,
      commandsCheckedBeforeReturn: commandChecks.length, publicPacketsObserved: observedPackets.length });
    fsyncSync(logFd); closeSync(logFd);
    result.progress = (await file(output('progress.jsonl'))).fingerprint;
    await writeJson('qualification.json', result);
    console.log(JSON.stringify({ status: result.status, qualification: output('qualification.json'),
      rawCampaignStatus: result.rawCampaignStatus, targetLevels: result.targetLevels,
      levelsCompleted: report?.final?.levelsCompleted ?? null, liveGameExecuted: false }));
    if (result.status !== 'partial_trajectory_preserved') process.exitCode = 1;
  }
}

await main();
