#!/usr/bin/env node
/** Premeasurement functional graph capture; no timing report is read or produced.
 * CLI: node SCRIPT baseline|candidate CHECKOUT CASES.json SOURCE_MANIFEST.json OUTPUT.json.gz
 * Four cold sessions, in case order: warmup then measured form. A measured form
 * includes the same three real terminal inspections as the unchanged cost harness.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { access, mkdir, open, readFile, readdir, realpath, stat } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createGzip, gunzipSync } from 'node:zlib';

const SCRIPT = fileURLToPath(import.meta.url), ROOT = resolve(dirname(SCRIPT), '../../..');
const BASE = resolve(ROOT, 'docs/migration/lot10b-evidence');
const REFERENCE = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6';
const DECLARATIONS = [`${REFERENCE}/laya_proto/common_frontier_policy.drm.json`, `${REFERENCE}/morphology_policy/strategy.drm`];
const HASH = bytes => createHash('sha256').update(bytes).digest('hex');
const copy = value => JSON.parse(JSON.stringify(value));
const label = path => path.startsWith(ROOT + sep) ? relative(ROOT, path) : path;
const failure = error => ({ name: error?.name ?? 'Error', message: String(error?.message ?? error) });
const inside = (root, path) => { const name = relative(root, path); return name && name !== '..' && !name.startsWith(`..${sep}`); };

async function absent(path) {
  try { await access(path); throw new Error('Refusing existing output/window: ' + path); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
async function fp(path) {
  const digest = createHash('sha256');
  for await (const bytes of createReadStream(path)) digest.update(bytes);
  return { path: label(resolve(path)), bytes: (await stat(path)).size, sha256: digest.digest('hex') };
}
async function inventory(checkout) {
  const names = [];
  async function walk(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const path = resolve(folder, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && /\.(ts|json|drm)$/.test(entry.name)) names.push(relative(checkout, path));
    }
  }
  for (const folder of ['src/logos-engine', 'src/runtime']) await walk(resolve(checkout, folder));
  assert.ok(names.every(name => /^[\x20-\x7e]+$/.test(name)), 'Inventory requires the existing ASCII source paths');
  const files = {};
  for (const name of names.sort()) files[name] = HASH(await readFile(resolve(checkout, name)));
  return { fileCount: names.length, digest: HASH(JSON.stringify(files)), files };
}
function publicObservation(packet) {
  return { frame: packet.frame_rows.map(row => [...row]), frames: packet.frame_packet.map(frame => frame.map(row => [...row])),
    availableActionIds: packet.available_action_refs.map(name => Number(name.slice(6))), state: packet.state,
    level: packet.level, levelsCompleted: packet.levels_completed, stepIndex: packet.step_index };
}
function structuralSnapshot(snapshot) {
  const names = ['sourceDigest', 'sourceCommit', 'sessionId', 'sequence', 'actions', 'cycles', 'levelsCompleted', 'level',
    'reason', 'nodeCount', 'graphRevision', 'graphChain', 'nativeExecutionDigest', 'lastDecision', 'implementation'];
  return { ...Object.fromEntries(names.map(name => [name, snapshot[name]])),
    proposal: snapshot.proposal ? { kind: snapshot.proposal.kind,
      ...(snapshot.proposal.material_pose_plan ? { material_pose_plan: { mode: snapshot.proposal.material_pose_plan.mode } } : {}) } : null,
    whyAct: { enabled: snapshot.whyAct?.enabled }, caller: { enabled: snapshot.caller?.enabled,
      acquiredTransitions: snapshot.caller?.acquiredTransitions ?? null, boundaryReplays: snapshot.caller?.boundaryReplays ?? null } };
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
function observedIdentity(observation) {
  return Object.fromEntries(['revision', 'level_epoch', 'levels_completed', 'observation_ref', 'frame_hash']
    .map(name => [name, observation[name]]));
}

async function main() {
  const [role, checkoutArgument, casesArgument, manifestArgument, outputArgument] = process.argv.slice(2);
  assert.ok(process.argv.length === 7 && ['baseline', 'candidate'].includes(role),
    'Usage: node SCRIPT baseline|candidate CHECKOUT CASES.json SOURCE_MANIFEST.json OUTPUT.json.gz');
  const checkout = await realpath(resolve(checkoutArgument));
  const casesPath = resolve(ROOT, casesArgument), manifestPath = resolve(ROOT, manifestArgument);
  const output = resolve(ROOT, outputArgument), receiptPath = output.replace(/\.json\.gz$/, '.receipt.json');
  assert.ok(inside(BASE, casesPath) && inside(BASE, output) && output.endsWith('.json.gz'),
    'Cases and exclusive capture output must belong to lot10b-evidence');
  for (const path of [output, receiptPath, resolve(dirname(casesPath), 'window.json'), resolve(dirname(casesPath), 'readiness.json')]) await absent(path);
  await mkdir(dirname(output), { recursive: true });
  const receiptFile = await open(receiptPath, 'wx'), gzip = createGzip({ level: 6 });
  let streamFailure = null;
  const done = pipeline(gzip, createWriteStream(output, { flags: 'wx' })).catch(error => { streamFailure = error; });
  const write = value => new Promise((accept, reject) => gzip.write(value, error => error ? reject(error) : accept()));
  let recordCount = 0;
  async function emit(record) {
    if (streamFailure) throw streamFailure;
    const recordIndex = recordCount++;
    await write(`${recordIndex ? ',\n' : ''}${JSON.stringify({ recordIndex, ...record })}`);
    return recordIndex;
  }
  const inputs = new Map();
  async function input(path, expected = null) {
    const absolute = resolve(path), bytes = await readFile(absolute), record = await fp(absolute);
    assert.equal(HASH(bytes), record.sha256, 'Input changed during read');
    if (inputs.has(absolute)) assert.deepEqual(record, inputs.get(absolute));
    inputs.set(absolute, record);
    if (expected) assert.equal(record.sha256, typeof expected === 'string' ? expected : expected.sha256);
    return bytes;
  }
  const receipt = { schema: 'logos-engine.lot10b-owner-cost-functional-capture-receipt.v1', status: 'running', role, checkout,
    startedAt: new Date().toISOString(), sessions: [], failures: [], inputsBefore: [], inputsAfter: [],
    nativeSourceUnchanged: false, inputsUnchanged: false, generatorUnchanged: false,
    measuredCostSessions: 0, timingReportsRead: 0, timingMetricsProduced: 0 };
  let before = null, generator = null;
  try {
    await write(`${JSON.stringify({ schema: 'logos-engine.lot10b-owner-cost-functional-capture.v1', role, checkout,
      startedAt: receipt.startedAt }).slice(0, -1)},"records":[\n`);
    generator = await fp(SCRIPT); receipt.generator = generator; await input(SCRIPT, generator);
    const cases = JSON.parse(await input(casesPath)); receipt.cases = await fp(casesPath);
    assert.equal(cases.schema, 'logos-engine.native-loop-cost-cases.v1'); assert.equal(cases.rounds, 4);
    assert.deepEqual(cases.cases.map(item => [item.id, item.actions, item.warmupActions, item.targetLevels]),
      [['STCK', 10, 3, 3], ['SMLP', 15, 3, 3]]);
    const frozen = JSON.parse(await input(manifestPath)); receipt.nativeSourceBefore = await fp(manifestPath);
    before = await inventory(checkout); receipt.nativeInventoryBefore = before; receipt.nativeDigest = before.digest;
    assert.deepEqual(before, frozen, 'Checkout differs from the supplied source freeze');
    const harness = 'scripts/measure-native-loop-costs.mjs';
    await input(resolve(checkout, harness), await fp(resolve(ROOT, harness)));
    const declarations = { common: JSON.parse(await input(resolve(checkout, DECLARATIONS[0]))),
      strategy: JSON.parse(await input(resolve(checkout, DECLARATIONS[1]))) };
    const traces = new Map();
    for (const item of cases.cases) {
      const bytes = await input(resolve(checkout, item.trace), item.traceSha256);
      const trace = JSON.parse(item.trace.endsWith('.gz') ? gunzipSync(bytes) : bytes);
      assert.equal(trace.status, 'passed'); assert.equal(trace.packets[0].packet.step_index, 0);
      assert.ok(trace.packets.length > item.actions); traces.set(item.id, trace);
    }
    receipt.inputsBefore = [...inputs.values()];
    await emit({ type: 'preflight', nativeSource: before, manifest: receipt.nativeSourceBefore, generator, cases: receipt.cases,
      inputs: receipt.inputsBefore, plannedSessions: 4, plannedActions: 31, measuredCostSessions: 0 });
    const [{ createNativeV6Runtime }, { V6AgentService }] = await Promise.all([
      import(pathToFileURL(resolve(checkout, 'src/logos-engine/v6-native-runtime.ts')).href),
      import(pathToFileURL(resolve(checkout, 'src/runtime/v6-agent-service.ts')).href),
    ]);
    for (const item of cases.cases) for (const form of ['warmup', 'measured']) {
      const trace = traces.get(item.id), limit = form === 'warmup' ? item.warmupActions : item.actions;
      const sessionId = `lot10b-owner-cost-${item.id.toLowerCase()}-${form}`;
      const identity = { case: item.id, form, sessionId };
      const budgets = { targetLevels: item.targetLevels, levelActionCaps: Array(item.targetLevels).fill(600) };
      const session = { ...identity, status: 'running', actionsLimit: limit, commands: 0, captures: 0,
        terminalInspections: 0, windowRecordCalls: 0, shape: null };
      receipt.sessions.push(session);
      await emit({ type: 'session_start', ...identity, actionsLimit: limit, budgets, coldKnowledge: true,
        checkpointSupplied: false, trace: item.trace, traceSha256: item.traceSha256,
        initialPublicPacket: trace.packets[0].packet, nativeDigest: before.digest });
      let runtime = null, revision = 0, chain = null, pointIndex = 0, last = null;
      const reconstructed = {}, pendingWindowCalls = [];
      const shape = { actions: 0, cycles: 0, levelsCompleted: 0, requests: [], observations: [], inspection: [], final: null };
      const service = new V6AgentService(async () => {
        assert.equal(runtime, null, 'Only one cold runtime per session');
        runtime = await createNativeV6Runtime(declarations);
        const owner = runtime.acquisitionFamilies?.window;
        assert.equal(Boolean(owner), role === 'candidate', 'Window owner differs from declared capture side');
        if (owner) {
          const record = owner.recordSource.bind(owner);
          owner.recordSource = (...args) => {
            const sourceBefore = owner.sourceState(), result = record(...args), sourceAfter = owner.sourceState();
            pendingWindowCalls.push({ index: session.windowRecordCalls++, before: observedIdentity(args[0]),
              after: observedIdentity(args[1]), command: copy(args[2]), selected: args[5] != null,
              first: copy(args[3]), second: copy(args[4]), proposal: copy(args[5] ?? null),
              actionIndex: args[6] ?? 0, frames: copy(args[7] ?? null),
              sourceBefore, returnValue: copy(result), sourceAfter });
            return result;
          };
        }
        return runtime;
      });
      async function handle(request, packet = null, checkedCommandRecord = null, terminalInspection = false) {
        const response = await service.handle(request), snapshot = structuralSnapshot(response.snapshot);
        assert.equal(snapshot.actions, request.sequence);
        assert.equal(snapshot.whyAct.enabled, true); assert.equal(snapshot.caller.enabled, true);
        const memory = runtime.inspectKnowledge(), deltasAdded = memory.deltas.slice(revision);
        assert.equal(memory.chain, snapshot.graphChain); assert.equal(memory.deltas.length, snapshot.graphRevision);
        for (const [index, delta] of deltasAdded.entries()) {
          assert.equal(delta.sequence, revision + index + 1); assert.equal(delta.previous, chain);
          assert.equal(delta.source_digest, snapshot.sourceDigest);
          chain = delta.digest; reconstructed[delta.node.id] = delta.node;
        }
        assert.equal(chain, memory.chain); assert.deepEqual(reconstructed, memory.nodes);
        assert.equal(Object.keys(reconstructed).length, snapshot.nodeCount);
        if (terminalInspection) {
          assert.equal(deltasAdded.length, 0, 'Terminal inspection must not change acquired knowledge');
          assert.deepEqual(response.knowledge, memory, 'Service inspection must expose the actual graph');
          shape.inspection.push({ graphNodes: Object.keys(response.knowledge.nodes).length });
          session.terminalInspections++;
        } else {
          shape.requests.push({ type: request.type, sequence: request.sequence, kind: response.kind, actions: snapshot.actions });
          shape.observations.push(observationShape(request.type, request.sequence, snapshot));
          session.captures++;
        }
        const { snapshot: unusedSnapshot, knowledge: unusedKnowledge, ...result } = response;
        await emit({ type: terminalInspection ? 'terminal_inspection' : 'capture', ...identity, pointIndex: pointIndex++,
          request, publicPacket: packet, checkedCommandRecord, result, snapshot,
          knowledge: { chain: memory.chain, nodeCount: snapshot.nodeCount, fromRevision: revision,
            toRevision: memory.deltas.length, deltasAdded }, windowCalls: pendingWindowCalls.splice(0) });
        revision = memory.deltas.length;
        return response;
      }
      last = await handle({ type: 'init', sessionId, sequence: 0,
        observation: publicObservation(trace.packets[0].packet), budgets }, trace.packets[0].packet);
      for (let action = 1; action <= limit; action++) {
        if (last.kind === 'boundary') last = await handle({ type: 'resume', sessionId, sequence: action - 1 });
        assert.equal(last.kind, 'action', `No authorized action ${item.id}/${form}/${action}`);
        assert.ok(last.command && last.ticket);
        const expected = trace.packets[action], command = { action_ref: last.command.actionRef, data: copy(last.command.data) };
        assert.equal(expected.packet.step_index, action);
        const commandEqual = isDeepStrictEqual(command, expected.command);
        const checked = await emit({ type: 'command_checked', ...identity, action, sourceCapturePointIndex: pointIndex - 1,
          actualCommand: command, expectedCommand: expected.command, commandEqual, ticket: last.ticket,
          publicPacket: expected.packet, publicPacketSha256: HASH(JSON.stringify(expected.packet)), returnSupplied: false });
        assert.equal(commandEqual, true, 'A public return cannot be supplied before its actual command matches');
        session.commands++;
        last = await handle({ type: 'advance', sessionId, sequence: action, ticketId: last.ticket.id,
          observation: publicObservation(expected.packet), executionMs: 0 }, expected.packet, checked);
      }
      const snapshot = last.snapshot;
      assert.equal(snapshot.actions, limit); assert.equal(snapshot.caller.acquiredTransitions, limit);
      assert.equal(snapshot.levelsCompleted, trace.packets[limit].packet.levels_completed);
      assert.equal(shape.requests.filter(row => row.type === 'init').length, 1);
      assert.equal(shape.requests.filter(row => row.type === 'advance').length, limit);
      assert.equal(shape.requests.at(-1).type, 'advance');
      Object.assign(shape, { actions: snapshot.actions, cycles: snapshot.cycles,
        levelsCompleted: snapshot.levelsCompleted, final: finalShape(snapshot) });
      if (form === 'measured') for (let index = 0; index < 3; index++) {
        await handle({ type: 'inspect', sessionId, sequence: limit }, null, null, true);
      }
      assert.equal(shape.inspection.length, form === 'warmup' ? 0 : 3);
      assert.equal(session.windowRecordCalls, role === 'candidate' ? limit : 0);
      session.status = 'captured_functional_structure'; session.shape = shape;
      await emit({ type: 'session_end', ...identity, status: session.status, shape,
        commands: session.commands, captures: session.captures, terminalInspections: session.terminalInspections,
        windowRecordCalls: session.windowRecordCalls, terminalResumePerformed: false });
      await service.handle({ type: 'close', sessionId, sequence: limit });
    }
  } catch (error) {
    receipt.failures.push(failure(error));
    try { await emit({ type: 'capture_failure', error: failure(error) }); }
    catch (streamError) { receipt.failures.push(failure(streamError)); }
  } finally {
    receipt.inputsBefore = [...inputs.values()];
    try {
      receipt.nativeInventoryAfter = await inventory(checkout); receipt.nativeSourceAfter = await fp(manifestPath);
      receipt.nativeSourceUnchanged = isDeepStrictEqual(before, receipt.nativeInventoryAfter)
        && isDeepStrictEqual(receipt.nativeSourceBefore, receipt.nativeSourceAfter);
      for (const path of inputs.keys()) receipt.inputsAfter.push(await fp(path));
      receipt.inputsUnchanged = isDeepStrictEqual(receipt.inputsBefore, receipt.inputsAfter);
      receipt.generatorAfter = await fp(SCRIPT); receipt.generatorUnchanged = isDeepStrictEqual(generator, receipt.generatorAfter);
      await absent(resolve(dirname(casesPath), 'window.json')); await absent(resolve(dirname(casesPath), 'readiness.json'));
    } catch (error) { receipt.failures.push(failure(error)); }
    receipt.sessionCount = receipt.sessions.length;
    receipt.actions = receipt.sessions.reduce((sum, row) => sum + (row.shape?.actions ?? 0), 0);
    receipt.finishedAt = new Date().toISOString();
    receipt.status = receipt.failures.length === 0 && receipt.nativeSourceUnchanged && receipt.inputsUnchanged && receipt.generatorUnchanged
      && receipt.sessionCount === 4 && receipt.actions === 31 && receipt.sessions.every(row => row.status === 'captured_functional_structure')
      ? 'captured_functional_structure' : 'failed';
    try {
      await write(`\n],"status":${JSON.stringify(receipt.status)},"finishedAt":${JSON.stringify(receipt.finishedAt)},"recordCount":${recordCount}}\n`);
      gzip.end(); await done; if (streamFailure) throw streamFailure;
      receipt.report = await fp(output);
    } catch (error) { receipt.status = 'failed'; receipt.failures.push(failure(error)); gzip.destroy(); await done; }
    receipt.qualification = 'Untimed functional capture before cost readiness/window. Source snapshots contain only structural fields; complete Kernel node/delta values retain their original metadata. Public commands are computed before the archived return is supplied. Three actual terminal inspections occur only for measured forms. Direct service calls preserve the source caller and acquired graph; browser scheduling/Pause timing is outside this capture. Every future measured shape must independently match this fixture; no equality with an unobserved future run is presumed.';
    await receiptFile.writeFile(JSON.stringify(receipt, null, 2) + '\n'); await receiptFile.close();
    console.log(JSON.stringify({ status: receipt.status, role, output: label(output), receipt: label(receiptPath),
      nativeDigest: receipt.nativeDigest, sessions: receipt.sessionCount, actions: receipt.actions }));
    if (receipt.status === 'failed') process.exitCode = 1;
  }
}

await main();
