#!/usr/bin/env node
/**
 * Separate, untimed owner-graph diagnostic. Never invokes a cost comparator.
 * Usage: node capture-cost-owner-graphs.mjs A|B CHECKOUT OUTPUT.json.gz
 * Reads the existing integrated declarations from this script's checkout.
 * Four cold sessions: STCK warmup3/full10, SMLP warmup3/full15. No retries.
 * The gzip is streaming JSON: one compact record per line, separated by ,\n.
 * A sibling .receipt.json retains success or failure. Both use exclusive writes.
 * Preparation/static review does not authorize running this diagnostic.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { access, mkdir, open, readFile, readdir, realpath } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createGzip, gunzipSync } from 'node:zlib';

const SCRIPT = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(SCRIPT), '../../..');
const EVIDENCE = resolve(ROOT, 'docs/migration/lot4a-evidence');
const PERFORMANCE = resolve(EVIDENCE, 'performance-integrated');
const REFERENCE = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6';
const DECLARATIONS = [`${REFERENCE}/laya_proto/common_frontier_policy.drm.json`, `${REFERENCE}/morphology_policy/strategy.drm`];
const FEEDBACK_IDS = ['family_state:feedback_sequences', 'family_activation:feedback_sequences', 'program:v6.feedback_sequences.choose'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const errorRecord = error => ({ name: error?.name ?? 'Error', message: String(error?.message ?? error), stack: error?.stack ?? null });
const within = (root, path) => { const name = relative(root, path); return name !== '' && name !== '..' && !name.startsWith('../'); };

async function fingerprint(path) {
  const bytes = await readFile(path);
  return { path: resolve(path), bytes: bytes.length, sha256: hash(bytes) };
}

// Identical inventory domain/order to the unchanged official measurement tool.
async function nativeInventory(checkout) {
  const names = [];
  async function walk(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const full = resolve(path, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && /\.(ts|json|drm)$/.test(entry.name)) names.push(relative(checkout, full));
    }
  }
  for (const name of ['src/logos-engine', 'src/runtime']) await walk(resolve(checkout, name));
  const files = {};
  for (const name of names.sort()) files[name] = hash(await readFile(resolve(checkout, name)));
  return { fileCount: names.length, digest: hash(JSON.stringify(files)), files };
}

function publicObservation(packet) {
  return { frame: packet.frame_rows.map(row => [...row]),
    frames: packet.frame_packet.map(frame => frame.map(row => [...row])),
    availableActionIds: packet.available_action_refs.map(name => Number(name.slice(6))),
    state: packet.state, level: packet.level, levelsCompleted: packet.levels_completed, stepIndex: packet.step_index };
}

function observationShape(type, sequence, snapshot) {
  return { type, sequence, family: snapshot.lastDecision, proposalKind: snapshot.proposal?.kind ?? null,
    poseMode: snapshot.proposal?.material_pose_plan?.mode ?? null, actions: snapshot.actions, cycles: snapshot.cycles,
    levelsCompleted: snapshot.levelsCompleted, nodeCount: snapshot.nodeCount,
    acquiredTransitions: snapshot.caller?.acquiredTransitions ?? null };
}

function finalShape(snapshot) {
  return { actions: snapshot.actions, levelsCompleted: snapshot.levelsCompleted, reason: snapshot.reason,
    graphRevision: snapshot.graphRevision, nodeCount: snapshot.nodeCount,
    acquiredTransitions: snapshot.caller?.acquiredTransitions ?? null, implementation: snapshot.implementation };
}

function rawTrialShape(trial) {
  assert.ok(trial.requests.every(row => ['init', 'advance', 'resume'].includes(row.type)), 'Unexpected raw request kind');
  return {
    requests: trial.requests.map(({ type, sequence, kind, actions }) => ({ type, sequence, kind, actions })),
    observations: trial.observations.map(row => ({ ...row })),
    final: { ...trial.final }, actions: trial.actions, cycles: trial.cycles, levelsCompleted: trial.levelsCompleted,
  };
}

const [side, checkoutArgument, outputArgument] = process.argv.slice(2);
assert.ok(process.argv.length === 5 && ['A', 'B'].includes(side) && checkoutArgument && outputArgument,
  'Usage: capture-cost-owner-graphs.mjs A|B CHECKOUT OUTPUT.json.gz');
const checkout = await realpath(resolve(checkoutArgument));
const output = resolve(ROOT, outputArgument);
assert.ok(output.endsWith('.json.gz'), 'The capture must be a gzip JSON file');
const diagnosticFolder = resolve(EVIDENCE, 'diagnostic/cost-owner-graphs');
assert.ok(within(diagnosticFolder, output)
  || (dirname(output) === PERFORMANCE && /^owner-graphs-[A-Za-z0-9_-]+\.json\.gz$/.test(relative(PERFORMANCE, output))),
  'Output must use a separate owner-graphs diagnostic destination');
const receiptPath = output.replace(/\.json\.gz$/, '.receipt.json');
for (const path of [output, receiptPath]) {
  try { await access(path); throw new Error(`Refusing to overwrite ${path}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
await mkdir(dirname(output), { recursive: true });
const receiptFile = await open(receiptPath, 'wx');
const gzip = createGzip({ level: 6 });
const outputStream = createWriteStream(output, { flags: 'wx' });
let streamFailure = null;
const pipelineDone = pipeline(gzip, outputStream).catch(error => { streamFailure = error; });
const write = value => new Promise((accept, reject) => gzip.write(value, error => error ? reject(error) : accept()));
let recordCount = 0;
async function emit(record) {
  if (streamFailure) throw streamFailure;
  const recordIndex = recordCount++;
  await write(`${recordIndex ? ',\n' : ''}${JSON.stringify({ recordIndex, ...record })}`);
  return recordIndex;
}

const startedAt = new Date().toISOString();
const receipt = {
  schema: 'logos-engine.lot4a.cost-owner-graphs-receipt.v1', status: 'running', side, checkout, startedAt,
  sessions: [], failures: [], inputsBefore: [], inputsAfter: [],
  nativeSourceUnchanged: false, inputsUnchanged: false, generatorUnchanged: false,
  officialMeasurementSessionsAdded: 0, officialTimingValuesModified: false,
  strictCostComparatorReexecuted: false, strictCostComparatorPassEstablished: false,
  qualifications: [
    'Untimed structural diagnostic, separate from the completed official cost window. Runtime snapshots are retained verbatim, including their own counters; no diagnostic latency, distribution, ratio or speed verdict is calculated.',
    'One fresh runtime/service and empty knowledge per game/form. Session identities are fixed across A/B and distinct between games/forms. No checkpoint, oracle, prepared command or learned state initializes the agent.',
    'Every actual command is checked before its corresponding recorded public return is supplied. Init and every advance/resume retain all actual nodes and all newly appended deltas. Earlier deltas are not duplicated or dropped.',
    'Direct V6AgentService calls preserve native caller WHY/ACT and acquisition, but do not reproduce the browser controller, worker scheduling or Pause timing. Raw request/observation/final structural forms are checked separately for every corresponding official trial.',
    'Official raw observations expose graphRevision only in final metadata. Intermediate revisions are captured and bound to the actual graph, without fabricating unavailable intermediate official revisions.',
    'No normalization or removal of Feedback nodes occurs. This capture does not establish A/B graph equality, justify an aggregation exception, alter raw timings, or turn the failed strict aggregator into a pass.',
  ],
};
const inputs = new Map();
let nativeBefore = null;
let expectedNativeDigest = null;
let generatorBefore = null;
let runtimeModules = null;

async function inputBytes(path, expected = null) {
  const absolute = resolve(path), bytes = await readFile(absolute);
  const item = { path: absolute, bytes: bytes.length, sha256: hash(bytes) };
  if (inputs.has(absolute)) assert.deepEqual(item, inputs.get(absolute), 'An input changed during preflight');
  inputs.set(absolute, item);
  if (expected) {
    assert.equal(item.sha256, typeof expected === 'string' ? expected : expected.sha256, `Input hash differs: ${absolute}`);
    if (typeof expected === 'object' && expected.bytes !== undefined) assert.equal(item.bytes, expected.bytes);
  }
  return bytes;
}
const inputJson = async (path, expected = null) => JSON.parse(await inputBytes(path, expected));

async function captureSession(item, trace, form, rawTrials, declarations) {
  const actionsLimit = form === 'warmup' ? item.warmupActions : item.actions;
  const sessionId = `lot4a-owner-graphs-${item.id.toLowerCase()}-${form}`;
  const identity = { caseId: item.id, form, sessionId };
  const budgets = { targetLevels: item.targetLevels, levelActionCaps: Array(item.targetLevels).fill(600) };
  const summary = { ...identity, status: 'running', actionsLimit, actions: 0, commands: 0, captures: [], comparisons: [], failures: [] };
  receipt.sessions.push(summary);
  await emit({ type: 'session_start', ...identity, actionsLimit, targetLevels: item.targetLevels, budgets, coldKnowledge: true,
    checkpointSupplied: false, nativeInventoryDigest: nativeBefore.digest, trace: item.trace, traceSha256: item.traceSha256,
    initialPublicPacket: trace.packets[0].packet, initialPublicPacketSha256: hash(JSON.stringify(trace.packets[0].packet)),
    rawTrials: rawTrials.map(({ label, trial }) => ({ label, round: trial.round, warmup: trial.warmup, actions: trial.actions })) });
  const { createNativeV6Runtime, V6AgentService, decodeNativeState, hydrateNativeState, isNativeStateGraph } = runtimeModules;
  let runtime = null, previousRevision = 0, previousChain = null, result = null, pointIndex = 0;
  const actual = { requests: [], observations: [], final: null, actions: 0, cycles: 0, levelsCompleted: 0 };
  const service = new V6AgentService(async () => {
    assert.equal(runtime, null, 'One runtime initialization per cold session');
    runtime = await createNativeV6Runtime(declarations);
    return runtime;
  });

  async function handle(request, publicPacket = null, checkedCommandRecord = null) {
    const response = await service.handle(request);
    const snapshot = response.snapshot;
    assert.equal(snapshot.actions, request.sequence);
    assert.equal(snapshot.whyAct?.enabled, true, 'Real WHY/ACT authority must be enabled');
    assert.equal(snapshot.caller?.enabled, true, 'Real common caller must be enabled');
    const memory = runtime.inspectKnowledge();
    assert.equal(memory.chain, snapshot.graphChain, 'Inspection must bind the returned snapshot');
    assert.equal(memory.deltas.length, snapshot.graphRevision);
    assert.equal(Object.keys(memory.nodes).length, snapshot.nodeCount);
    assert.ok(memory.deltas.length >= previousRevision);
    const deltasAdded = memory.deltas.slice(previousRevision);
    let chain = previousChain;
    for (const [index, delta] of deltasAdded.entries()) {
      assert.equal(delta.sequence, previousRevision + index + 1);
      assert.equal(delta.previous, chain);
      assert.equal(delta.source_digest, snapshot.sourceDigest);
      chain = delta.digest;
    }
    assert.equal(chain, memory.chain);
    const nodeIds = Object.keys(memory.nodes).filter(id => FEEDBACK_IDS.includes(id) || memory.nodes[id].family === 'feedback_sequences').sort();
    const owner = memory.nodes['family_state:feedback_sequences'];
    let state = null;
    if (owner) state = isNativeStateGraph(owner.value) ? hydrateNativeState(owner.value, id => {
      const node = memory.nodes[id];
      assert.ok(node && node.kind === 'state_fragment');
      return node.value;
    }) : decodeNativeState(owner.value);
    const feedback = { present: Boolean(owner), nodeIds, state,
      nodeRevisions: nodeIds.map(id => ({ id, kind: memory.nodes[id].kind, revision: memory.nodes[id].revision })),
      deltaRevisions: deltasAdded.filter(delta => nodeIds.includes(delta.node.id)).map(delta => ({
        sequence: delta.sequence, id: delta.node.id, revision: delta.node.revision, cause: delta.cause,
      })) };
    const requestShape = { type: request.type, sequence: request.sequence, kind: response.kind, actions: snapshot.actions };
    const observation = observationShape(request.type, request.sequence, snapshot);
    actual.requests.push(requestShape); actual.observations.push(observation);
    const { snapshot: _snapshot, ...resultWithoutSnapshot } = response;
    const index = await emit({ type: 'capture', ...identity, pointIndex, request, checkedCommandRecord,
      publicPacket, result: resultWithoutSnapshot, snapshot, runtimeSourceDigest: snapshot.sourceDigest,
      knowledge: { chain: memory.chain, nodes: memory.nodes, deltasAdded, fromRevision: previousRevision, toRevision: memory.deltas.length },
      feedback });
    summary.captures.push({ recordIndex: index, pointIndex, ...requestShape, ...observation,
      level: snapshot.level, graphRevision: snapshot.graphRevision, prefix: snapshot.prefix ?? null,
      runtimeSourceDigest: snapshot.sourceDigest, feedbackNodeRevisions: feedback.nodeRevisions, feedbackDeltaRevisions: feedback.deltaRevisions });
    previousRevision = memory.deltas.length; previousChain = memory.chain; pointIndex++;
    summary.actions = snapshot.actions;
    return response;
  }

  try {
    result = await handle({ type: 'init', sessionId, sequence: 0, observation: publicObservation(trace.packets[0].packet), budgets }, trace.packets[0].packet);
    for (let action = 1; action <= actionsLimit; action++) {
      if (result.kind === 'boundary') result = await handle({ type: 'resume', sessionId, sequence: action - 1 });
      assert.equal(result.kind, 'action', `No authorized command for ${item.id}/${form} action ${action}`);
      assert.ok(result.command && result.ticket);
      const expected = trace.packets[action];
      assert.equal(expected.packet.step_index, action);
      const actualCommand = { action_ref: result.command.actionRef, data: clone(result.command.data) };
      const commandEqual = isDeepStrictEqual(actualCommand, expected.command);
      summary.commands++;
      const checkedCommandRecord = await emit({ type: 'command_checked', ...identity, action,
        sourceCapturePointIndex: pointIndex - 1, actualCommand, expectedCommand: expected.command, commandEqual,
        ticket: result.ticket, tracePacketIndex: action, publicPacket: expected.packet,
        publicPacketSha256: hash(JSON.stringify(expected.packet)), returnSupplied: false,
        qualification: 'This record is written before advance. Only equality permits the following advance request to receive this public packet.' });
      assert.equal(commandEqual, true, `Native command diverged before public return ${item.id}/${form}/${action}`);
      result = await handle({ type: 'advance', sessionId, sequence: action, ticketId: result.ticket.id,
        observation: publicObservation(expected.packet), executionMs: 0 }, expected.packet, checkedCommandRecord);
    }
    // Match the official terminal point: never resume after the action cap.
    assert.equal(result.snapshot.actions, actionsLimit);
    assert.equal(result.snapshot.caller.acquiredTransitions, actionsLimit, 'Stop at the same acquired prefix boundary as the official trial');
    assert.equal(result.snapshot.levelsCompleted, trace.packets[actionsLimit].packet.levels_completed);
    assert.equal(actual.requests.filter(row => row.type === 'init').length, 1);
    assert.equal(actual.requests.filter(row => row.type === 'advance').length, actionsLimit);
    assert.equal(actual.requests.at(-1).type, 'advance');
    Object.assign(actual, { final: finalShape(result.snapshot), actions: result.snapshot.actions,
      cycles: result.snapshot.cycles, levelsCompleted: result.snapshot.levelsCompleted });
    for (const { label, trial } of rawTrials) {
      const expected = rawTrialShape(trial), passed = isDeepStrictEqual(actual, expected);
      const comparison = { label, round: trial.round, warmup: trial.warmup, passed,
        requests: isDeepStrictEqual(actual.requests, expected.requests), observations: isDeepStrictEqual(actual.observations, expected.observations),
        final: isDeepStrictEqual(actual.final, expected.final), counters: ['actions', 'cycles', 'levelsCompleted'].every(key => actual[key] === expected[key]),
        graphRevisionCoverage: 'Exact final raw graphRevision; intermediate raw observations do not expose graphRevision.' };
      summary.comparisons.push(comparison);
      if (!passed) {
        summary.failures.push({ message: `Structural diagnostic differs from raw ${label}/${item.id}/${trial.round}` });
        await emit({ type: 'raw_shape_mismatch', ...identity, comparison, expected, actual });
      }
    }
    summary.final = actual.final;
    summary.status = summary.failures.length ? 'failed' : 'captured_and_raw_shapes_verified';
  } catch (error) {
    summary.status = 'failed'; summary.failures.push(errorRecord(error));
    await emit({ type: 'session_failure', ...identity, error: errorRecord(error), actionsAcquired: summary.actions });
  }
  await emit({ type: 'session_end', ...identity, status: summary.status, actionsLimit, actions: summary.actions,
    cycles: result?.snapshot.cycles ?? null, levelsCompleted: result?.snapshot.levelsCompleted ?? null,
    points: summary.captures.length, commands: summary.commands,
    final: summary.final ?? null, comparisons: summary.comparisons, failures: summary.failures,
    captureCount: summary.captures.length, terminalResumePerformed: false });
}

try {
  await write(`${JSON.stringify({ schema: 'logos-engine.lot4a.cost-owner-graphs.v1', side, checkout, startedAt }).slice(0, -1)},"records":[\n`);
  generatorBefore = await fingerprint(SCRIPT); receipt.generator = generatorBefore;
  const ownerDeclaration = await inputJson(resolve(PERFORMANCE, 'owner-addition-declaration.json'));
  assert.equal(ownerDeclaration.schema, 'logos-engine.native-cost-owner-qualification-declaration.v1');
  assert.equal(ownerDeclaration.originalStrictAggregationStatus, 'failed');
  assert.equal(ownerDeclaration.rawTimingModificationPermitted, false);
  for (const item of ownerDeclaration.inputs) await inputBytes(resolve(ROOT, item.path), item);
  assert.ok(ownerDeclaration.inputs.some(item => item.path === 'docs/migration/lot4a-evidence/performance-integrated/owner-addition-protocol.md'));
  const declaration = await inputJson(resolve(PERFORMANCE, 'declaration.json'));
  assert.equal(declaration.schema, 'logos-engine.native-cost-protocol-declaration.v2');
  const cases = await inputJson(resolve(ROOT, declaration.cases.path), declaration.cases);
  assert.equal(cases.schema, 'logos-engine.native-loop-cost-cases.v1');
  assert.equal(cases.rounds, 4);
  assert.deepEqual(cases.cases.map(item => [item.id, item.actions, item.warmupActions, item.targetLevels]), [['STCK', 10, 3, 3], ['SMLP', 15, 3, 3]]);
  const frozen = side === 'A' ? declaration.baselineManifest : declaration.candidateManifest;
  const manifest = await inputJson(resolve(ROOT, frozen.path), frozen);
  expectedNativeDigest = declaration.nativeDigests[side === 'A' ? 'baseline' : 'candidate'];
  assert.equal(manifest.digest, expectedNativeDigest);
  nativeBefore = await nativeInventory(checkout); receipt.nativeSourceBefore = nativeBefore;
  assert.deepEqual(nativeBefore, manifest, 'Diagnostic checkout differs from the frozen source manifest');
  for (const item of declaration.officialTools) await inputBytes(resolve(ROOT, item.path), item);
  const runner = declaration.officialTools.find(item => item.path === 'scripts/measure-native-loop-costs.mjs');
  assert.ok(runner);
  await inputBytes(resolve(checkout, runner.path), runner);
  const window = await inputJson(resolve(PERFORMANCE, 'window.json'));
  assert.equal(window.status, 'passed', 'The official measurement window must be complete; this is not an aggregation verdict');
  const executions = window.executions.filter(item => item.label.startsWith(side));
  assert.deepEqual(executions.map(item => item.label).sort(), [`${side}1`, `${side}2`]);
  const rawReports = [];
  for (const execution of executions) {
    assert.equal(execution.status, 'passed'); assert.equal(execution.nativeDigest, expectedNativeDigest);
    assert.equal(await realpath(execution.checkout), checkout);
    const raw = await inputJson(execution.copiedOutput ?? execution.output, execution.copiedReportSha256 ?? execution.reportSha256);
    assert.equal(raw.schema, 'logos-engine.native-loop-costs.v1'); assert.equal(raw.status, 'passed');
    assert.equal(raw.nativeSourceUnchanged, true); assert.deepEqual(raw.nativeSource, nativeBefore);
    assert.deepEqual(raw.manifest, cases); assert.deepEqual(raw.generator, runner);
    assert.deepEqual(raw.cases.map(item => item.id), ['STCK', 'SMLP']);
    for (const item of raw.cases) {
      assert.equal(item.trials.length, 5);
      assert.deepEqual(item.trials.map(trial => [trial.round, trial.warmup]), [[0, true], [1, false], [2, false], [3, false], [4, false]]);
    }
    rawReports.push({ label: execution.label, report: raw });
  }
  const policyBytes = await Promise.all(DECLARATIONS.map(name => inputBytes(resolve(checkout, name))));
  for (const { report } of rawReports) for (const name of DECLARATIONS) {
    const expected = report.inputs.find(item => item.path === name); assert.ok(expected);
    await inputBytes(resolve(checkout, name), expected);
  }
  const declarations = { common: JSON.parse(policyBytes[0]), strategy: JSON.parse(policyBytes[1]) };
  const traces = new Map();
  for (const item of cases.cases) {
    const bytes = await inputBytes(resolve(ROOT, item.trace), item.traceSha256);
    const trace = JSON.parse(item.trace.endsWith('.gz') ? gunzipSync(bytes) : bytes);
    assert.equal(trace.status, 'passed'); assert.equal(trace.packets[0].packet.step_index, 0);
    assert.ok(trace.packets.length > item.actions); traces.set(item.id, trace);
  }
  receipt.inputsBefore = [...inputs.values()];
  await emit({ type: 'preflight', generator: generatorBefore, nativeSource: nativeBefore, inputs: receipt.inputsBefore,
    declaredStrictAggregationStatus: ownerDeclaration.originalStrictAggregationStatus,
    expectedOwnerIds: ownerDeclaration.expectedAddedNodeIds,
    plannedSessions: 4, plannedActions: 31, measuredCostSessions: 0 });
  const modules = await Promise.all([
    import(pathToFileURL(resolve(checkout, 'src/logos-engine/v6-native-runtime.ts')).href),
    import(pathToFileURL(resolve(checkout, 'src/runtime/v6-agent-service.ts')).href),
    import(pathToFileURL(resolve(checkout, 'src/logos-engine/v6-knowledge-store.ts')).href),
    import(pathToFileURL(resolve(checkout, 'src/logos-engine/v6-native-state-graph.ts')).href),
  ]);
  runtimeModules = { createNativeV6Runtime: modules[0].createNativeV6Runtime, V6AgentService: modules[1].V6AgentService,
    decodeNativeState: modules[2].decodeNativeState, hydrateNativeState: modules[3].hydrateNativeState, isNativeStateGraph: modules[3].isNativeStateGraph };
  for (const item of cases.cases) for (const form of ['warmup', 'full']) {
    const rawTrials = rawReports.flatMap(({ label, report }) => report.cases.find(row => row.id === item.id).trials
      .filter(trial => trial.warmup === (form === 'warmup')).map(trial => ({ label, trial })));
    assert.equal(rawTrials.length, form === 'warmup' ? 2 : 8);
    await captureSession(item, traces.get(item.id), form, rawTrials, declarations);
  }
} catch (error) {
  receipt.failures.push(errorRecord(error));
  try { await emit({ type: 'diagnostic_failure', error: errorRecord(error) }); } catch (streamError) { receipt.failures.push(errorRecord(streamError)); }
} finally {
  receipt.inputsBefore = [...inputs.values()];
  if (nativeBefore) {
    try {
      receipt.nativeSourceAfter = await nativeInventory(checkout);
      receipt.nativeSourceUnchanged = isDeepStrictEqual(receipt.nativeSourceAfter, nativeBefore);
    } catch (error) { receipt.failures.push(errorRecord(error)); }
  }
  for (const item of receipt.inputsBefore) {
    try { receipt.inputsAfter.push(await fingerprint(item.path)); }
    catch (error) { receipt.failures.push(errorRecord(error)); }
  }
  receipt.inputsUnchanged = isDeepStrictEqual(receipt.inputsBefore, receipt.inputsAfter);
  try {
    receipt.generatorAfter = await fingerprint(SCRIPT);
    receipt.generatorUnchanged = isDeepStrictEqual(generatorBefore, receipt.generatorAfter);
  } catch (error) { receipt.failures.push(errorRecord(error)); }
  receipt.sessionCount = receipt.sessions.length;
  receipt.actions = receipt.sessions.reduce((sum, item) => sum + item.actions, 0);
  receipt.rawTrialsCompared = receipt.sessions.reduce((sum, item) => sum + item.comparisons.length, 0);
  receipt.status = receipt.failures.length === 0 && receipt.nativeSourceUnchanged && receipt.inputsUnchanged && receipt.generatorUnchanged
    && receipt.sessionCount === 4 && receipt.actions === 31 && receipt.rawTrialsCompared === 20
    && receipt.sessions.every(item => item.status === 'captured_and_raw_shapes_verified') ? 'captured_and_raw_shapes_verified' : 'failed';
  receipt.completedAt = new Date().toISOString();
  try {
    await write(`\n],"status":${JSON.stringify(receipt.status)},"completedAt":${JSON.stringify(receipt.completedAt)},"recordCount":${recordCount}}\n`);
    gzip.end(); await pipelineDone;
    if (streamFailure) throw streamFailure;
    receipt.capture = await fingerprint(output);
  } catch (error) { receipt.status = 'failed'; receipt.failures.push(errorRecord(error)); gzip.destroy(); await pipelineDone; }
  await receiptFile.writeFile(JSON.stringify(receipt, null, 2) + '\n'); await receiptFile.close();
  console.log(JSON.stringify({ status: receipt.status, side, output, receipt: receiptPath,
    sessions: receipt.sessionCount, actions: receipt.actions, rawTrialsCompared: receipt.rawTrialsCompared }));
  if (receipt.status === 'failed') process.exitCode = 1;
}
