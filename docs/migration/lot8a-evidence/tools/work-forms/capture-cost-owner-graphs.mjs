#!/usr/bin/env node
/** Premeasurement functional graph capture; no timing report is read or produced.
 * CLI: node SCRIPT baseline|candidate CHECKOUT CASES.json SOURCE_MANIFEST.json OUTPUT.json.gz
 * Four cold sessions, in case order: warmup then measured form. A measured form
 * includes the same three real terminal inspections as the unchanged cost harness.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { access, mkdir, open, readFile, readdir, realpath, stat } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createGzip, gunzipSync } from 'node:zlib';

const SCRIPT = fileURLToPath(import.meta.url), ROOT = resolve(dirname(SCRIPT), '../../../../..');
const BASE = resolve(ROOT, 'docs/migration/lot8a-evidence');
const DERIVED_FROM = resolve(ROOT, 'docs/migration/lot6b-evidence/capture-cost-owner-graphs.mjs');
const OWNERS = { binding: 'public_observed_binding', selectedRigid: 'selected_rigid', motif: 'motif_access' };
// The later qualifier imports each side's real store validator. Bind those
// external baseline paths in this capture before the analyzer's closed access
// list is frozen; an inventory digest alone is not an input-path permission.
const ROLE_VALIDATORS = ['src/logos-engine/kernel.ts', 'src/logos-engine/v6-knowledge-store.ts'];
const REFERENCE = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6';
const DECLARATIONS = [`${REFERENCE}/laya_proto/common_frontier_policy.drm.json`, `${REFERENCE}/morphology_policy/strategy.drm`];
const SELECTED_RIGID_POLICY = `${REFERENCE}/morphology_policy/strategy.drm`;
const VERSIONS = { baseline: '0.64.0', candidate: '0.65.0' };
const EXPECTED = {
  baseline: { fileCount: 322, digest: 'fa23bb76ca4a01b5cfaa72ec6d1d4b4fc2e8969762e966ada8225265fc546886' },
  candidate: { fileCount: 324, digest: '936fa2bf81965272b1ddbab4a5c01f98aeb6a48188c1f7a8c91de226598c5e43' },
};
const OBSERVED_DATE_NOW = Date.now;
const HASH = bytes => createHash('sha256').update(bytes).digest('hex');
const copy = value => structuredClone(value);
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
      else if ((entry.isFile() || entry.isSymbolicLink() && (await stat(path)).isFile()) && /\.(ts|json|drm)$/.test(entry.name)) names.push(relative(checkout, path));
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
  assert.equal(checkout === await realpath(ROOT), role === 'candidate', 'The candidate is this checkout; the baseline is its distinct frozen predecessor');
  const casesPath = resolve(ROOT, casesArgument), manifestPath = resolve(ROOT, manifestArgument);
  const output = resolve(ROOT, outputArgument), receiptPath = output.replace(/\.json\.gz$/, '.receipt.json');
  assert.ok(inside(BASE, casesPath) && inside(BASE, output) && output.endsWith('.json.gz'),
    'Cases and exclusive capture output must belong to lot8a-evidence');
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
  const receipt = { schema: 'logos-engine.lot8a-prepared-owner-cost-functional-capture-receipt.v1', status: 'running', role, checkout,
    owners: OWNERS, acquisitionMode: 'observed_three_owner_composition', preparedOnly: true, globalLockUsed: false, officialPerformanceEligible: false,
    startedAt: new Date().toISOString(), sessions: [], failures: [], inputsBefore: [], inputsAfter: [],
    nativeSourceUnchanged: false, inputsUnchanged: false, generatorUnchanged: false,
    measuredCostSessions: 0, timingReportsRead: 0, timingMetricsProduced: 0 };
  let before = null, generator = null;
  try {
    await write(`${JSON.stringify({ schema: 'logos-engine.lot8a-prepared-owner-cost-functional-capture.v1', role, checkout,
      startedAt: receipt.startedAt }).slice(0, -1)},"records":[\n`);
    generator = await fp(SCRIPT); receipt.generator = generator; await input(SCRIPT, generator);
    receipt.derivedFrom = await fp(DERIVED_FROM); await input(DERIVED_FROM, receipt.derivedFrom);
    const cases = JSON.parse(await input(casesPath)); receipt.cases = await fp(casesPath);
    assert.equal(cases.schema, 'logos-engine.native-loop-cost-cases.v1'); assert.equal(cases.rounds, 4);
    assert.deepEqual(cases.cases.map(item => [item.id, item.actions, item.warmupActions, item.targetLevels]),
      [['STCK', 10, 3, 3], ['SMLP', 15, 3, 3]]);
    const frozen = JSON.parse(await input(manifestPath)); receipt.nativeSourceBefore = await fp(manifestPath);
    before = await inventory(checkout);
    assert.deepEqual({ fileCount: before.fileCount, digest: before.digest }, EXPECTED[role], 'Unexpected frozen composition');
    receipt.sourceCommit = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 10000 }).trim();
    if (role === 'baseline') assert.equal(receipt.sourceCommit, 'a01e6faf330d82fa220feac0c9ad4632bb75a9de', 'Exact prepared parent required');
    receipt.nativeInventoryBefore = before; receipt.nativeDigest = before.digest;
    assert.deepEqual(before, frozen, 'Checkout differs from the supplied source freeze');
    const runtimeSource = (await input(resolve(checkout, 'src/logos-engine/v6-native-runtime.ts'),
      before.files['src/logos-engine/v6-native-runtime.ts'])).toString('utf8');
    const versions = [...runtimeSource.matchAll(/NATIVE_V6_IMPLEMENTATION\s*=\s*['"]logos-engine\.typescript\.v6\.native-migration\/([^'"]+)['"]/g)].map(match => match[1]);
    assert.deepEqual(versions, [VERSIONS[role]], '8A functional rehearsal requires prepared 0.64 and frozen 0.65, without a publication claim');
    receipt.nativeVersion = versions[0];
    for (const path of ROLE_VALIDATORS) await input(resolve(checkout, path), before.files[path]);
    const harness = 'scripts/measure-native-loop-costs.mjs';
    await input(resolve(checkout, harness), await fp(resolve(ROOT, harness)));
    const declarations = { common: JSON.parse(await input(resolve(checkout, DECLARATIONS[0]))),
      strategy: JSON.parse(await input(resolve(checkout, DECLARATIONS[1]))) };
    await input(resolve(checkout, SELECTED_RIGID_POLICY));
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
    const [runtimeModule, { V6AgentService }] = await Promise.all([
      import(pathToFileURL(resolve(checkout, 'src/logos-engine/v6-native-runtime.ts')).href),
      import(pathToFileURL(resolve(checkout, 'src/runtime/v6-agent-service.ts')).href),
    ]);
    for (const item of cases.cases) for (const form of ['warmup', 'measured']) {
      const trace = traces.get(item.id), limit = form === 'warmup' ? item.warmupActions : item.actions;
      const sessionId = `lot8a-prepared-owner-cost-${item.id.toLowerCase()}-${form}`;
      const identity = { case: item.id, form, sessionId };
      const budgets = { targetLevels: item.targetLevels, levelActionCaps: Array(item.targetLevels).fill(600) };
      const session = { ...identity, status: 'running', actionsLimit: limit, commands: 0, captures: 0,
        terminalInspections: 0, ownerOperationCount: 0, ownerCheckpointCount: 0, ownerCounts: {}, shape: null };
      receipt.sessions.push(session);
      await emit({ type: 'session_start', ...identity, actionsLimit: limit, budgets, coldKnowledge: true,
        checkpointSupplied: false, trace: item.trace, traceSha256: item.traceSha256,
        initialPublicPacket: trace.packets[0].packet, nativeDigest: before.digest });
      let runtime = null, revision = 0, chain = null, pointIndex = 0, last = null;
      const reconstructed = {}, pendingOwnerOperations = [], pendingOwnerCheckpoints = [], ownerReaders = {}, observedOwners = {};
      let operationDepth = 0;
      const shape = { actions: 0, cycles: 0, levelsCompleted: 0, requests: [], observations: [], inspection: [], final: null };
      const service = new V6AgentService(async () => {
        assert.equal(runtime, null, 'Only one cold runtime per session');
        runtime = await runtimeModule.createNativeV6Runtime(declarations);
        const registered = Object.fromEntries(Object.entries(OWNERS).map(([key, id]) =>
          [key, runtime.families.filter(family => family.id === id)]));
        for (const key of ['binding', 'selectedRigid']) assert.equal(registered[key].length, 1, 'Existing owner must remain unique: ' + key);
        assert.equal(registered.motif.length, role === 'candidate' ? 1 : 0, 'Motif is the only owner added by the candidate');
        observedOwners.binding = runtime.acquisitionFamilies?.binding;
        observedOwners.selectedRigid = runtime.acquisitionFamilies?.selectedRigid;
        observedOwners.motif = registered.motif[0] ?? null;
        assert.equal(observedOwners.binding, registered.binding[0], 'Binding acquisition and registered instances differ');
        assert.equal(runtimeModule.rawNativeSelectedRigid(registered.selectedRigid[0]), observedOwners.selectedRigid,
          'SelectedRigid acquisition and registered instances differ');
        session.ownerBindings = Object.fromEntries(Object.keys(OWNERS).map(key => [key, {
          id: OWNERS[key], registeredInstances: registered[key].length,
          source: key === 'motif' ? 'registered_family_wrapper_state_restore' : 'actual_acquisition_family',
          actualRegisteredOwnerVerified: Boolean(observedOwners[key]),
        }]));
        for (const [key, owner] of Object.entries(observedOwners)) {
          session.ownerCounts[key] = { operations: 0, checkpoints: 0, proposals: 0, records: 0, restores: 0 };
          if (!owner) { ownerReaders[key] = () => null; continue; }
          const readState = (key === 'selectedRigid' ? owner.sourceState : owner.state).bind(owner);
          ownerReaders[key] = () => copy(readState());
          const checkpointMethod = key === 'motif' ? 'state' : 'nativeState';
          const checkpoint = owner[checkpointMethod].bind(owner);
          owner[checkpointMethod] = (...args) => {
            const value = checkpoint(...args);
            pendingOwnerCheckpoints.push({ ordinal: session.ownerCheckpointCount++, owner: key,
              index: session.ownerCounts[key].checkpoints++, method: checkpointMethod, state: copy(value) });
            return value;
          };
          const methods = key === 'binding' ? ['proposeSource', 'recordSource', 'restoreNative', 'restore']
            : key === 'selectedRigid' ? ['propose', 'record', 'restoreNative'] : ['propose', 'record', 'restore'];
          for (const method of methods) {
            assert.equal(typeof owner[method], 'function', 'Missing actual owner method: ' + key + '/' + method);
            const original = owner[method].bind(owner);
            owner[method] = (...args) => {
              const isRecord = method.startsWith('record'), isRestore = method.startsWith('restore');
              const count = session.ownerCounts[key]; count.operations++;
              count[isRecord ? 'records' : isRestore ? 'restores' : 'proposals']++;
              const ordinal = session.ownerOperationCount++, depth = operationDepth++;
              const sourceBefore = ownerReaders[key]();
              const attention = key === 'binding' ? runtime.caller?.attention ?? null : null;
              const attentionBefore = attention ? copy(attention.state()) : null;
              const attentionWrites = [], memory = key === 'binding' ? runtime.caller?.memory ?? null : null;
              const originalPut = memory?.put;
              const observedPut = memory ? function (...putArgs) {
                const returned = originalPut.apply(this, putArgs);
                if (['attention', 'attention_composition'].includes(putArgs[1])) attentionWrites.push(copy({
                  episode: putArgs[0], key: putArgs[1], value: putArgs[2], evidence: putArgs[3], revision: putArgs[4] }));
                return returned;
              } : null;
              if (memory) memory.put = observedPut;
              const operation = { ordinal, depth, owner: key, method, sourceBefore, attentionBefore,
                arguments: isRestore ? { checkpoint: copy(args[0]) }
                  : isRecord ? { before: copy(args[0]), after: copy(args[1]), command: copy(args[2]),
                    first: copy(args[3]), second: copy(args[4]), proposal: copy(args[5] ?? null),
                    index: args[6] ?? 0, ...(key === 'binding' ? {} : { frames: copy(args[7] ?? []) }) }
                  : { observation: copy(args[0]), rows: copy(args[1]), inputs: copy(args[2]), remaining: args[3] } };
              const finish = (result, error = null) => {
                operationDepth--;
                if (memory) { assert.equal(memory.put, observedPut, 'Observed Binding memory hook changed'); memory.put = originalPut; }
                pendingOwnerOperations.push({ ...operation, sourceAfter: ownerReaders[key](),
                  attentionAfter: key === 'binding' ? copy(runtime.caller?.attention?.state() ?? null) : null,
                  ...(key === 'binding' ? { attentionWrites, sameCallerAttentionInstance: runtime.caller?.attention === attention,
                    sharedAttentionAfter: owner.attention === runtime.caller?.attention } : {}),
                  ...(error ? { exception: failure(error) }
                    : { returnKind: result === undefined ? 'undefined' : result === null ? 'null' : 'value',
                        returnValue: result === undefined ? null : copy(result) }) });
                if (error) throw error;
                return result;
              };
              try {
                const result = original(...args);
                return result && typeof result.then === 'function'
                  ? result.then(value => finish(value), error => finish(null, error)) : finish(result);
              } catch (error) {
                // Synchronous original errors are retained once. A finish error
                // is not converted into a second source-operation observation.
                if (operationDepth > depth) return finish(null, error);
                throw error;
              }
            };
          }
        }
        return runtime;
      });
      async function handle(request, packet = null, checkedCommandRecord = null, terminalInspection = false) {
        assert.equal(Date.now, OBSERVED_DATE_NOW, 'The capture must not replace the real wall clock');
        const handleStartedWallMs = Date.now();
        let response;
        try { response = await service.handle(request); }
        catch (error) {
          await emit({ type: 'service_failure', ...identity, request, error: failure(error),
            ownerOperations: pendingOwnerOperations.splice(0), ownerCheckpoints: pendingOwnerCheckpoints.splice(0) });
          throw error;
        }
        const handleFinishedWallMs = Date.now();
        assert.equal(Date.now, OBSERVED_DATE_NOW, 'Native execution replaced the observed wall clock');
        const snapshot = structuralSnapshot(response.snapshot);
        const ownerStates = Object.fromEntries(Object.entries(ownerReaders).map(([key, reader]) => [key, reader()]));
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
          wallClock: { source: 'unmodified_Date_now', startedMs: handleStartedWallMs, finishedMs: handleFinishedWallMs },
          knowledge: { chain: memory.chain, nodeCount: snapshot.nodeCount, fromRevision: revision,
            toRevision: memory.deltas.length, deltasAdded }, ownerBindings: session.ownerBindings, ownerStates,
          callerAttention: copy(runtime.caller?.attention?.state() ?? null),
          ownerOperations: pendingOwnerOperations.splice(0).sort((a, b) => a.ordinal - b.ordinal),
          ownerCheckpoints: pendingOwnerCheckpoints.splice(0) });
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
      session.status = 'captured_functional_structure'; session.shape = shape;
      await emit({ type: 'session_end', ...identity, status: session.status, shape,
        commands: session.commands, captures: session.captures, terminalInspections: session.terminalInspections,
        ownerBindings: session.ownerBindings, ownerCounts: session.ownerCounts,
        ownerOperationCount: session.ownerOperationCount, ownerCheckpointCount: session.ownerCheckpointCount,
        terminalResumePerformed: false });
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
    receipt.qualification = 'Prepared-parent-only untimed functional capture before any official cost readiness/window. Binding and SelectedRigid are observed on both roles; Motif is observed through its actual registered state/restore wrapper. No clock is replaced and all native graph values are retained. Source snapshots contain only structural fields; complete Kernel node/delta values retain their original metadata. Public commands are computed before the archived return is supplied. Three actual terminal inspections occur only for measured forms. Direct service calls preserve the source caller and acquired graph; browser scheduling/Pause timing is outside this capture. Every future measured shape must independently match this fixture; no equality with an unobserved future run is presumed.';
    await receiptFile.writeFile(JSON.stringify(receipt, null, 2) + '\n'); await receiptFile.close();
    console.log(JSON.stringify({ status: receipt.status, role, output: label(output), receipt: label(receiptPath),
      nativeDigest: receipt.nativeDigest, sessions: receipt.sessionCount, actions: receipt.actions }));
    if (receipt.status === 'failed') process.exitCode = 1;
  }
}

await main();
