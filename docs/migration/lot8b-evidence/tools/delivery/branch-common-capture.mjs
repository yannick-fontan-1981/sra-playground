#!/usr/bin/env node
/** Untimed, synthetic BranchRouting work forms through the real public service.
 * node SCRIPT CHECKOUT CANDIDATE_NATIVE.json OUTPUT.jsonl.gz
 * No original oracle, game, game replay, cost measurement or global lock. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { access, mkdir, open, readFile, readdir, realpath, stat } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createGzip } from 'node:zlib';

const SCRIPT = fileURLToPath(import.meta.url), ROOT = resolve(dirname(SCRIPT), '../../../../..');
const BASE = resolve(ROOT, 'docs/migration/lot8b-evidence');
const OWNER = 'branch_routing', REFERENCE = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e';
const FIXTURE = 'tests/fixtures/v6-branch-routing-reference.json';
const FIXTURE_SHA256 = 'e6ae197b7b982bd41f561b9df8e458436d7ce0797f39bbf86d972e55472b6769';
const TEST = 'tests/v6-branch-routing-kernel.test.ts';
const QUALIFIER = resolve(dirname(SCRIPT), 'branch-common-qualify.mjs');
const DERIVATION = 'docs/migration/lot8a-evidence/tools/work-forms/capture-cost-owner-graphs.mjs';
const DECLARATION_ROOT = `reference/v6/${REFERENCE}/source/agents/yf_arc3_v6`;
const DECLARATIONS = [`${DECLARATION_ROOT}/laya_proto/common_frontier_policy.drm.json`,
  `${DECLARATION_ROOT}/morphology_policy/strategy.drm`, `${DECLARATION_ROOT}/laya_proto/composition_target_tree.json`];
const SINGLE = 'cold_four_calibrations_move_propagate_epoch', TRIPLE = 'cold_equal_cost_select_first_point_bind_move';
const CONTRARY = 'contrary_measured_move_revises_motion';
const BUDGETS = { targetLevels: 3, levelActionCaps: [24, 24, 24], maxActions: 72 };
const CASES = ['single-positive', 'triple-prefix', 'contrary-return', 'selected-acquisition-ablation', 'incomplete-prefix'];
const DATE_NOW = Date.now;
const copy = value => structuredClone(value);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const label = path => path.startsWith(ROOT + sep) ? relative(ROOT, path) : path;
const errorRecord = error => ({ name: error?.name ?? 'Error', message: String(error?.message ?? error), stack: error?.stack ?? null });
const inside = (root, path) => { const name = relative(root, path); return name && name !== '..' && !name.startsWith(`..${sep}`); };
async function absent(path) { try { await access(path); throw new Error('Refusing existing artifact: ' + path); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
async function fingerprint(path) {
  const digest = createHash('sha256'); for await (const bytes of createReadStream(path)) digest.update(bytes);
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
  for (const directory of ['src/logos-engine', 'src/runtime']) await walk(resolve(checkout, directory));
  assert.ok(names.every(name => /^[\x20-\x7e]+$/.test(name)));
  const files = {}; for (const name of names.sort()) files[name] = sha(await readFile(resolve(checkout, name)));
  return { fileCount: names.length, digest: sha(JSON.stringify(files)), files };
}
const publicObservation = packet => ({ frame: copy(packet.frame_rows), frames: copy(packet.frame_packet),
  availableActionIds: packet.available_action_refs.map(name => Number(name.slice(6))), state: packet.state,
  level: packet.level, levelsCompleted: packet.levels_completed, stepIndex: packet.step_index });
const publicCommand = command => ({ actionRef: command.action_ref, data: { ...command.data } });
function originalRecords(fixture, id) {
  const scenario = fixture.scenarios.find(row => row.id === id); assert.ok(scenario);
  let proposalStep = null;
  return scenario.steps.flatMap((step, index) => {
    if (step.operation === 'propose') proposalStep = index;
    if (step.operation !== 'record') return [];
    assert.notEqual(proposalStep, null);
    const sourceProposal = scenario.steps[proposalStep].result, actionIndex = step.index ?? 0;
    return [{ scenario: id, recordStep: index, proposeStep: proposalStep, before: step.before, after: step.after,
      actionIndex, mode: sourceProposal.steps[actionIndex].mode, sourceCommand: copy(sourceProposal.actions[actionIndex]) }];
  });
}
function cases(fixture) {
  for (const id of [SINGLE, TRIPLE]) assert.equal(fixture.scenarios.find(row => row.id === id).initialStateOrigin.kind, 'cold_original_constructor');
  const single = originalRecords(fixture, SINGLE), triple = originalRecords(fixture, TRIPLE), contrary = originalRecords(fixture, CONTRARY);
  assert.deepEqual([single.length, triple.length, contrary.length], [6, 7, 1]);
  return [
    { id: CASES[0], records: single, finalQuestion: null, intervention: null },
    { id: CASES[1], records: triple, finalQuestion: { mode: 'propagate', command: { action_ref: 'ACTION5' } }, intervention: null },
    { id: CASES[2], records: [...single.slice(0, 4), ...contrary], finalQuestion: { mode: 'calibrate', command: { action_ref: 'ACTION5' } }, intervention: null },
    { id: CASES[3], records: single.slice(0, 1), finalQuestion: { mode: 'calibrate', command: { action_ref: 'ACTION1' } },
      intervention: 'registered_record_returns_empty_events_without_calling_original' },
    { id: CASES[4], records: triple, finalQuestion: null,
      intervention: 'runtime_level_clock_expires_after_actual_second_move_after_guard' },
  ];
}
function expectedCommand(row) {
  // This is the independent common-domain witness for the same public bar.
  // The component fixture deliberately supplied (7,13) first in a manual list.
  return row.mode === 'select' ? { action_ref: 'ACTION6', data: { x: 6, y: 13 } } : copy(row.sourceCommand);
}
function assertReleased(result, mode, command) {
  assert.equal(result.kind, 'action', result.reason ?? 'Missing actual branch release'); assert.ok(result.ticket);
  assert.deepEqual(result.command, publicCommand(command)); assert.equal(result.snapshot.lastDecision, OWNER);
  const proposal = result.snapshot.proposal;
  assert.equal(proposal.kind, 'parallel_branch_routing'); assert.equal(proposal.material_access_subquestion, 'parallel_branch_routing');
  assert.equal(proposal.steps[result.ticket.actionIndex].mode, mode);
  assert.equal(proposal.strategy_receipt.selected, 'factored_material_return');
  assert.equal(proposal.bundle_template.operation_key, 'OP18');
  assert.equal(result.snapshot.whyAct.decision.decision.status, 'action_set_released');
  assert.equal(result.snapshot.levelsCompleted, 0);
}
function scheduling(execution) {
  return execution ? { deadlineMs: execution.deadlineMs ?? null, remainingLevelActions: execution.remainingLevelActions ?? null,
    signalAborted: execution.signal?.aborted ?? false, nowProvided: typeof execution.now === 'function' } : null;
}
function methodArguments(method, args) {
  if (method === 'restore') return { checkpoint: copy(args[0]) };
  if (method === 'propose') return { observation: copy(args[0]), rows: copy(args[1]), inputs: copy(args[2]), remaining: args[3], execution: scheduling(args[4]) };
  if (method === 'bind') return { proposal: copy(args[0]), domain: { limit: args[1].limit,
    bindings: [...args[1].bindings].map(([key, table]) => [key, [...table].map(([point, value]) => [point, copy(value)])]) } };
  if (method === 'before') return { proposal: copy(args[0]), index: args[1], publicPacket: copy(args[2]), observation: copy(args[3]), execution: scheduling(args[4]) };
  if (method === 'after') return { proposal: copy(args[0]), index: args[1], before: copy(args[2]), after: copy(args[3]), firstRows: copy(args[4]), secondRows: copy(args[5]) };
  return { before: copy(args[0]), after: copy(args[1]), command: copy(args[2]), firstRows: copy(args[3]), secondRows: copy(args[4]),
    proposal: copy(args[5]), index: args[6], frames: copy(args[7]), execution: scheduling(args[8]) };
}

async function main() {
  assert.equal(process.argv.length, 5, 'Usage: node SCRIPT CHECKOUT CANDIDATE_NATIVE.json OUTPUT.jsonl.gz');
  const checkout = await realpath(resolve(process.argv[2])), manifestPath = resolve(ROOT, process.argv[3]), output = resolve(ROOT, process.argv[4]);
  assert.equal(checkout, await realpath(ROOT), 'Use the tool checkout and its frozen candidate');
  assert.ok(inside(BASE, manifestPath) && inside(BASE, output) && output.endsWith('.jsonl.gz'));
  const receiptPath = output.replace(/\.jsonl\.gz$/, '.receipt.json');
  await absent(output); await absent(receiptPath); await mkdir(dirname(output), { recursive: true });
  const receiptFile = await open(receiptPath, 'wx'), gzip = createGzip({ level: 6 });
  let streamError = null;
  const done = pipeline(gzip, createWriteStream(output, { flags: 'wx' })).catch(error => { streamError = error; });
  let recordIndex = 0;
  const write = value => new Promise((accept, reject) => gzip.write(value, error => error ? reject(error) : accept()));
  async function emit(record) {
    if (streamError) throw streamError;
    const index = recordIndex++; await write(JSON.stringify({ recordIndex: index, ...record }) + '\n'); return index;
  }
  const inputs = new Map();
  async function input(path, expected = null) {
    const actual = resolve(ROOT, path), bytes = await readFile(actual), record = await fingerprint(actual);
    assert.equal(sha(bytes), record.sha256); if (expected) assert.equal(record.sha256, expected);
    if (inputs.has(actual)) assert.deepEqual(inputs.get(actual), record); inputs.set(actual, record); return bytes;
  }
  const receipt = { schema: 'logos-engine.lot8b.branch-common-capture-receipt.v1', status: 'running',
    checkout, startedAt: new Date().toISOString(), sourceReferenceCommit: REFERENCE,
    qualification: 'synthetic_common_work_forms_and_graph_capture_only', globalLockUsed: false,
    officialPerformanceEligible: false, measuredCostSessions: 0, officialGameRuns: 0, gameReplays: 0,
    originalOraclesExecuted: 0, acquiredStateInjected: false, wholeCallerParity: false,
    inventoryOrder: 'ASCII lexical order of complete repository-relative paths; compact JSON path-to-SHA mapping',
    sessions: [], failures: [], inputsBefore: [], inputsAfter: [] };
  let nativeBefore = null, fixture = null, sourceCommit = null;
  try {
    receipt.generator = await fingerprint(SCRIPT); await input(SCRIPT, receipt.generator.sha256);
    receipt.qualifier = await fingerprint(QUALIFIER); await input(QUALIFIER, receipt.qualifier.sha256);
    receipt.derivation = await fingerprint(resolve(ROOT, DERIVATION)); await input(DERIVATION, receipt.derivation.sha256);
    await input(TEST); fixture = JSON.parse(await input(FIXTURE, FIXTURE_SHA256)); receipt.fixture = await fingerprint(resolve(ROOT, FIXTURE));
    assert.equal(fixture.schema, 'logos-engine.v6.branch-routing-reference.v1'); assert.equal(fixture.referenceCommit, REFERENCE);
    assert.equal(fixture.sourceModified, false); assert.equal(fixture.inputOrigin.gamePayloadsInterpreted, 0);
    assert.equal(fixture.inputOrigin.gameActionsDispatched, 0);
    // The manifest and exporter are fingerprinted only; neither is executed.
    await input(fixture.generator.path, fixture.generator.sha256); await input(fixture.sourceManifest.path, fixture.sourceManifest.sha256);
    for (const [name, digest] of Object.entries(fixture.sourceHashes)) await input(`reference/v6/${REFERENCE}/source/${name}`, digest);
    const frozen = JSON.parse(await input(manifestPath)); receipt.nativeManifest = await fingerprint(manifestPath);
    assert.deepEqual(Object.keys(frozen).sort(), ['digest', 'fileCount', 'files']);
    nativeBefore = await inventory(checkout); assert.deepEqual(nativeBefore, frozen, 'Frozen native file identities differ');
    receipt.nativeBefore = nativeBefore;
    sourceCommit = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 10000 }).trim();
    receipt.sourceCommit = sourceCommit;
    const declarations = { common: JSON.parse(await input(DECLARATIONS[0])), strategy: JSON.parse(await input(DECLARATIONS[1])) };
    await input(DECLARATIONS[2]);
    const declaredCases = cases(fixture);
    assert.equal(declaredCases.reduce((sum, item) => sum + item.records.length, 0), 26);
    receipt.inputsBefore = [...inputs.values()];
    await emit({ type: 'header', schema: 'logos-engine.lot8b.branch-common-capture.v1', sourceCommit, nativeSource: nativeBefore,
      fixture: receipt.fixture, generator: receipt.generator, inputs: receipt.inputsBefore, cases: declaredCases,
      plannedSessions: 5, plannedPhysicalReturns: 26, officialPerformanceEligible: false,
      pointDomain: { sourceFixturePoint: [7, 13], commonCentroidPoint: [6, 13], box: [6, 12, 7, 15],
        scope: 'Same independent public contributor; component manual inputs and actual common sampled inputs differ explicitly.' } });
    const [{ createNativeV6Runtime }, { V6AgentService }, { digest }] = await Promise.all([
      import(pathToFileURL(resolve(checkout, 'src/logos-engine/v6-native-runtime.ts')).href),
      import(pathToFileURL(resolve(checkout, 'src/runtime/v6-agent-service.ts')).href),
      import(pathToFileURL(resolve(checkout, 'src/logos-engine/canonical.ts')).href),
    ]);
    for (const item of declaredCases) {
      const sessionId = `lot8b-branch-${item.id}`, packet = (name, step) => ({ ...copy(fixture.frames[name].public), step_index: step });
      const summary = { id: item.id, sessionId, status: 'running', physicalReturns: 0, commandsChecked: 0, captures: 0,
        ownerOperations: 0, ownerCheckpoints: 0, intervention: item.intervention, factoryCalls: 0 };
      receipt.sessions.push(summary);
      await emit({ type: 'session_start', case: item.id, sessionId, budgets: BUDGETS, cold: true, acquiredStateInjected: false,
        initialPublicPacket: packet(item.records[0].before, 0), recordPlan: item.records, finalQuestion: item.finalQuestion,
        intervention: item.intervention, runtimeClock: item.id === 'incomplete-prefix' ? 'explicit_controlled_level_clock' : 'factory_default' });
      let runtime = null, owner = null, readState = null, revision = 0, chain = null, pointIndex = 0, phase = null, clockMs = 0;
      let operationOrdinal = 0, checkpointOrdinal = 0, depth = 0, expirations = 0;
      const nodes = {}, pendingOperations = [], pendingCheckpoints = [], pendingInterventions = [];
      const service = new V6AgentService(async () => {
        assert.equal(summary.factoryCalls++, 0);
        runtime = await createNativeV6Runtime(declarations, item.id === 'incomplete-prefix' ? { now: () => clockMs } : {});
        const registered = runtime.families.filter(family => family.id === OWNER); assert.equal(registered.length, 1); owner = registered[0];
        readState = owner.state.bind(owner);
        assert.deepEqual(readState(), fixture.scenarios.find(row => row.id === SINGLE).initialState);
        const group = runtime.snapshot().coverage.sourceGroups.find(row => row.id === 'factored_material_return'), index = group.families.indexOf(OWNER);
        assert.deepEqual(group.families.slice(index - 1, index + 2), ['motif_access', OWNER, 'band_transfer']); assert.equal(group.entryPoints[index], null);
        summary.ownerBinding = { id: OWNER, registeredInstances: registered.length, source: 'registered_family_wrapper_state_restore',
          group: group.id, entryIndex: index, entryPoint: group.entryPoints[index], neighbours: group.families.slice(index - 1, index + 2) };
        if (item.id === 'selected-acquisition-ablation') owner.record = () => ({ events: [] });
        owner.state = (...args) => {
          const result = readState(...args);
          pendingCheckpoints.push({ ordinal: checkpointOrdinal++, phase: copy(phase), state: copy(result) }); return result;
        };
        for (const method of ['propose', 'bind', 'before', 'after', 'record', 'restore']) {
          const original = owner[method]?.bind(owner); assert.equal(typeof original, 'function');
          owner[method] = (...args) => {
            const memory = runtime.knowledge?.memory ?? null;
            const operation = { ordinal: operationOrdinal++, depth: depth++, method, phase: copy(phase),
              nativeOriginalInvoked: !(item.id === 'selected-acquisition-ablation' && method === 'record'),
              sourceBefore: copy(readState()), arguments: methodArguments(method, args),
              graphAtStart: memory ? { chain: memory.chain, revision: memory.deltas.length,
                ownerRootRevision: memory.nodes[`family_state:${OWNER}`]?.revision ?? null } : null };
            const finish = (result, error = null) => {
              depth--;
              pendingOperations.push({ ...operation, sourceAfter: copy(readState()),
                ...(method === 'bind' ? { proposalAfter: copy(args[0]) } : {}),
                ...(error ? { exception: errorRecord(error) } : { returnKind: result === undefined ? 'undefined' : result === null ? 'null' : 'value', returnValue: result === undefined ? null : copy(result) }) });
              if (error) throw error;
              if (item.id === 'incomplete-prefix' && method === 'after' && args[1] === 1) {
                assert.equal(args[0].steps[1].mode, 'move'); assert.equal(result.matched, true); assert.equal(result.seal_prefix, true);
                assert.equal(clockMs, 0); assert.equal(expirations++, 0);
                pendingInterventions.push({ kind: 'level_clock_expired_after_unchanged_after_guard', fromMs: 0, toMs: 360_001,
                  observationRef: args[3].observation_ref, index: args[1], unchangedResult: copy(result), originalRecordChanged: false });
                clockMs = 360_001;
              }
              return result;
            };
            try {
              const result = original(...args);
              return result && typeof result.then === 'function' ? result.then(value => finish(value), error => finish(null, error)) : finish(result);
            } catch (error) { if (depth > operation.depth) return finish(null, error); throw error; }
          };
        }
        return runtime;
      });
      async function handle(request, publicPacket = null, checkedCommandRecord = null) {
        phase = { type: request.type, sequence: request.sequence };
        assert.equal(Date.now, DATE_NOW); const startedMs = Date.now();
        let response;
        try { response = await service.handle(request); }
        catch (error) {
          await emit({ type: 'service_failure', case: item.id, sessionId, request, error: errorRecord(error),
            ownerOperations: pendingOperations.splice(0), ownerCheckpoints: pendingCheckpoints.splice(0) }); throw error;
        }
        const finishedMs = Date.now(); assert.equal(Date.now, DATE_NOW);
        const memory = runtime.inspectKnowledge(), deltasAdded = memory.deltas.slice(revision), snapshot = response.snapshot;
        assert.equal(snapshot.actions, request.sequence); assert.equal(snapshot.levelsCompleted, 0);
        for (const [index, delta] of deltasAdded.entries()) {
          assert.equal(delta.sequence, revision + index + 1); assert.equal(delta.previous, chain);
          assert.equal(delta.source_digest, snapshot.sourceDigest); chain = delta.digest; nodes[delta.node.id] = delta.node;
        }
        assert.equal(chain, memory.chain); assert.deepEqual(nodes, memory.nodes);
        assert.equal(snapshot.graphChain, chain); assert.equal(snapshot.graphRevision, memory.deltas.length);
        assert.equal(snapshot.nodeCount, Object.keys(nodes).length);
        let inspection = null;
        if (request.type === 'inspect') {
          assert.deepEqual(deltasAdded, []); assert.deepEqual(response.knowledge, memory);
          inspection = { exactKnowledgeReturned: true, nodeCount: Object.keys(memory.nodes).length, deltaCount: memory.deltas.length,
            chain: memory.chain, nodesDigest: await digest(memory.nodes), deltasDigest: await digest(memory.deltas) };
        }
        const { knowledge: unusedKnowledge, ...returned } = response;
        await emit({ type: 'capture', case: item.id, sessionId, pointIndex: pointIndex++, request, publicPacket, checkedCommandRecord,
          result: returned, actualObservation: copy(runtime.observation), ownerBinding: summary.ownerBinding,
          ownerState: copy(readState()), wallClock: { source: 'unmodified_Date_now', startedMs, finishedMs },
          knowledge: { chain, nodeCount: snapshot.nodeCount, fromRevision: revision, toRevision: memory.deltas.length, deltasAdded }, inspection,
          ownerOperations: pendingOperations.splice(0).sort((a, b) => a.ordinal - b.ordinal), ownerCheckpoints: pendingCheckpoints.splice(0),
          interventions: pendingInterventions.splice(0) });
        revision = memory.deltas.length; summary.captures++; phase = null; return response;
      }
      let last = null;
      try {
        last = await handle({ type: 'init', sessionId, sequence: 0, observation: publicObservation(packet(item.records[0].before, 0)), budgets: BUDGETS }, packet(item.records[0].before, 0));
        for (const [index, row] of item.records.entries()) {
          if (last.kind === 'boundary') last = await handle({ type: 'resume', sessionId, sequence: index });
          const expected = expectedCommand(row); assertReleased(last, row.mode, expected);
          assert.equal(last.ticket.actionIndex, row.actionIndex);
          const afterPacket = packet(row.after, index + 1);
          const checked = await emit({ type: 'command_checked', case: item.id, sessionId, action: index + 1,
            sourceCapturePointIndex: pointIndex - 1, sourceCase: row.scenario, sourceRecordStep: row.recordStep,
            sourceProposeStep: row.proposeStep, sourceFrameBefore: row.before, sourceFrameAfter: row.after,
            mode: row.mode, sourceCommand: row.sourceCommand, declaredCommonCommand: expected,
            actualCommand: copy(last.command), ticket: copy(last.ticket), commandEqual: true, returnSupplied: false,
            publicPacket: afterPacket, publicPacketSha256: sha(JSON.stringify(afterPacket)) });
          summary.commandsChecked++;
          last = await handle({ type: 'advance', sessionId, sequence: index + 1, ticketId: last.ticket.id,
            observation: publicObservation(afterPacket), executionMs: 0 }, afterPacket, checked);
          summary.physicalReturns++;
        }
        if (item.finalQuestion) {
          assert.equal(last.kind, 'boundary'); last = await handle({ type: 'resume', sessionId, sequence: item.records.length });
          assertReleased(last, item.finalQuestion.mode, item.finalQuestion.command);
        }
        if (item.id === 'incomplete-prefix') {
          assert.equal(expirations, 1); assert.equal(last.kind, 'stopped'); assert.equal(last.reason, 'native_acquisition_incomplete');
          const stopped = last; last = await handle({ type: 'resume', sessionId, sequence: item.records.length });
          assert.deepEqual(last, stopped, 'A stopped service neither retries acquisition nor mints another ticket');
        }
        const terminal = { kind: last.kind, reason: last.reason, command: copy(last.command), ticket: copy(last.ticket),
          actions: last.snapshot.actions, cycles: last.snapshot.cycles, acquiredTransitions: last.snapshot.caller.acquiredTransitions,
          ownerState: copy(readState()), graphChain: last.snapshot.graphChain, graphRevision: last.snapshot.graphRevision, nodeCount: last.snapshot.nodeCount };
        await handle({ type: 'inspect', sessionId, sequence: item.records.length });
        await handle({ type: 'close', sessionId, sequence: item.records.length });
        summary.ownerOperations = operationOrdinal; summary.ownerCheckpoints = checkpointOrdinal;
        summary.terminal = terminal; summary.status = 'captured_synthetic_common_structure';
        await emit({ type: 'session_end', case: item.id, sessionId, status: summary.status, summary: copy(summary) });
      } catch (error) { summary.status = 'failed'; throw error; }
      finally { if (runtime) runtime.close('branch_capture_session_finalized'); }
    }
  } catch (error) {
    receipt.failures.push(errorRecord(error));
    try { await emit({ type: 'capture_failure', error: errorRecord(error) }); } catch (other) { receipt.failures.push(errorRecord(other)); }
  } finally {
    receipt.inputsBefore = [...inputs.values()];
    try {
      receipt.nativeAfter = await inventory(checkout);
      receipt.sourceCommitAfter = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 10000 }).trim();
      for (const path of inputs.keys()) receipt.inputsAfter.push(await fingerprint(path));
      receipt.nativeSourceUnchanged = isDeepStrictEqual(nativeBefore, receipt.nativeAfter);
      receipt.sourceCommitUnchanged = sourceCommit === receipt.sourceCommitAfter;
      receipt.inputsUnchanged = isDeepStrictEqual(receipt.inputsBefore, receipt.inputsAfter);
    } catch (error) { receipt.failures.push(errorRecord(error)); }
    receipt.sessionCount = receipt.sessions.length;
    receipt.physicalReturns = receipt.sessions.reduce((sum, row) => sum + row.physicalReturns, 0);
    receipt.finishedAt = new Date().toISOString();
    receipt.status = receipt.failures.length === 0 && receipt.nativeSourceUnchanged && receipt.sourceCommitUnchanged && receipt.inputsUnchanged
      && receipt.sessionCount === 5 && receipt.physicalReturns === 26 && receipt.sessions.every(row => row.status === 'captured_synthetic_common_structure')
      ? 'captured_synthetic_common_structure' : 'failed';
    receipt.scope = 'Five cold service sessions on the pinned independent component rasters. The capture stores complete Kernel deltas, public packets, actual commands and owner operations. The ablation deliberately omits only the selected record effect; the incomplete case changes only the runtime level clock after its unchanged second move guard. No acquired state is injected, no game outcome is claimed, and no timing sample or whole-caller parity is established.';
    try {
      await emit({ type: 'footer', status: receipt.status, sessions: receipt.sessionCount, physicalReturns: receipt.physicalReturns, recordsBeforeFooter: recordIndex });
      gzip.end(); await done; if (streamError) throw streamError; receipt.capture = await fingerprint(output);
    } catch (error) { receipt.status = 'failed'; receipt.failures.push(errorRecord(error)); gzip.destroy(); await done; }
    await receiptFile.writeFile(JSON.stringify(receipt, null, 2) + '\n'); await receiptFile.close();
    console.log(JSON.stringify({ status: receipt.status, capture: label(output), receipt: label(receiptPath), sessions: receipt.sessionCount,
      physicalReturns: receipt.physicalReturns, nativeDigest: nativeBefore?.digest ?? null, officialPerformanceEligible: false }));
    if (receipt.status === 'failed') process.exitCode = 1;
  }
}
await main();
