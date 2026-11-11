#!/usr/bin/env node
/** Passive synthetic common-caller capture. This module is a CLI, never a test import.
 * No original oracle, game environment, source-state seed or selected proposal is installed.
 * V3 pairs with compare-selected-rigid-synthetic-terminal-parity.py.
 * A terminal unexecuted continuation is retained separately, never forged into a sealed prefix.
 * This is a synthetic functional capture; it has no official performance isolation claim.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, open, mkdir } from 'node:fs/promises';
import { resolve, relative, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { createNativeV6Runtime, rawNativeSelectedRigid } from '../../../../src/logos-engine/v6-native-runtime.ts';
import { hydrateNativeState, isNativeStateGraph } from '../../../../src/logos-engine/v6-native-state-graph.ts';
import { decodeNativeState } from '../../../../src/logos-engine/v6-knowledge-store.ts';
import { captureSelectedRigid } from '../../../../tests/helpers/capture-selected-rigid.ts';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const QUALIFICATION_ROOT = resolve(ROOT, 'docs/migration/lot8a-evidence/qualification-provisional-01');
const REFERENCE = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e';
const SCENARIO = 'common-caller-exact-commands-prefix-and-boundary';
const SOURCE = 'reference/v6/' + REFERENCE + '/source/agents/yf_arc3_v6/';
const MANIFEST = 'docs/migration/lot8a-evidence/integration-provisional-063-064-01/contract/source-manifest.json';
const NATIVE_DIGEST = '936fa2bf81965272b1ddbab4a5c01f98aeb6a48188c1f7a8c91de226598c5e43';
const FIXTURE = 'tests/fixtures/v6-selected-rigid/reference.json.gz';
const LIMITS = { maximumPhysicalReturns: 96, maximumSourceSteps: 96, wallTimeoutMs: 120000 };
const copy = value => structuredClone(value);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const nowUTC = () => new Date().toISOString();
const json = async name => JSON.parse(await readFile(resolve(ROOT, name), 'utf8'));
const command = value => ({ action_ref: value.action_ref, data: copy(value.data ?? {}) });
const confined = (parent, path) => {
  const rel = relative(parent, path);
  return rel !== '' && !rel.startsWith('..' + '/') && rel !== '..' && !isAbsolute(rel);
};
async function fingerprints(names) {
  const result = [];
  for (const name of names) {
    const bytes = await readFile(resolve(ROOT, name));
    result.push({ path: name, sha256: sha(bytes), bytes: bytes.length });
  }
  return result;
}
function packet(value, sequence) {
  assert.ok(value && Array.isArray(value.frame_rows) && value.frame_rows.length > 0, 'Missing declared public raster');
  const rows = copy(value.frame_rows);
  const frames = copy(value.frame_packet ?? [value.frame_rows]);
  assert.ok(Array.isArray(frames) && frames.length > 0, 'Missing declared public packet');
  const hash = sha(JSON.stringify(rows)).slice(0, 16);
  if (value.frame_hash !== undefined) assert.equal(value.frame_hash, hash, 'Declared raster hash differs');
  return { frame_rows: rows, frame_packet: frames, level: value.level,
    levels_completed: value.levels_completed, state: value.state, step_index: sequence,
    available_action_refs: copy(value.available_action_refs), frame_hash: hash };
}
function publicScene(value) {
  return { frame_rows: value.frame_rows, level: value.level, levels_completed: value.levels_completed,
    state: value.state, available_action_refs: value.available_action_refs };
}
function readGraph(graph, id) {
  assert.ok(graph.nodes[id], 'Missing actual graph node: ' + id);
  const raw = graph.nodes[id].value;
  return isNativeStateGraph(raw) ? hydrateNativeState(raw, key => graph.nodes[key].value) : decodeNativeState(raw);
}
function released(result) {
  assert.equal(result.kind, 'action', result.reason ?? 'Expected an actual selected offer');
  assert.equal(result.snapshot.lastDecision, 'selected_rigid');
  assert.equal(result.snapshot.whyAct.decision.decision.status, 'action_set_released');
  assert.equal(result.snapshot.srcDecision.workflow, 'v6.composition_strategy.choose');
  assert.equal(result.snapshot.proposal.strategy_receipt.selected, 'goal_access');
  assert.ok(result.authorization && result.command);
}

async function main() {
  const args = process.argv.slice(2);
  assert.equal(args.length, 2, 'Usage: export-selected-rigid-synthetic-common-v3.mjs --output NEW_REPORT.json');
  assert.equal(args[0], '--output');
  const output = resolve(ROOT, args[1]);
  assert.ok(confined(QUALIFICATION_ROOT, output) && output.endsWith('.json'), 'Use a new JSON output beneath qualification-provisional-01');
  await mkdir(dirname(output), { recursive: true });
  const sink = await open(output, 'wx');
  const report = { schema: 'logos-engine.lot8a.selected-rigid-synthetic-common.v3', status: 'failed',
    startedAt: nowUTC(), referenceCommit: REFERENCE, synthetic: true, gameExecution: false,
    nativeExecution: true, originalOracleExecution: false, officialGameLevelsClaimed: 0,
    qualification: 'Fresh passive capture of the declared cold synthetic SelectedRigid common-caller scenario on provisional8A. Not a game, full caller parity, final qualification, cost or publication.',
    normalization: 'Only public host step_index is assigned the actual monotonic return number. A fixture without an animation packet declares its public raster as the single returned frame.',
    limits: LIMITS, coordination: { mode: 'independent_functional_work', globalLockUsed: false, quietGatingUsed: false, performanceQualification: false }, nodeVersion: process.version, command: process.argv,
    scenarioId: SCENARIO, selectedRigidEvents: [], selectedRigidCapture: null, actions: [], prefixes: [],
    boundaryObservations: [], terminalObservation: null, captureStatus: 'not_completed',
    readerCompatibility: { status: 'unverified', reader: 'docs/migration/lot8a-evidence/tools/compare-selected-rigid-synthetic-terminal-parity.py' },
    checks: [], error: null };
  let runtime = null, timer = null;
  const controller = new AbortController();
  let inputNames = [];
  try {
    const manifest = await json(MANIFEST);
    assert.equal(manifest.fileCount, 324); assert.equal(manifest.digest, NATIVE_DIGEST);
    assert.equal(Object.keys(manifest.files).length, manifest.fileCount);
    const nativeMap = Object.fromEntries(Object.entries(manifest.files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
    assert.equal(sha(JSON.stringify(nativeMap)), NATIVE_DIGEST);
    const ownPath = relative(ROOT, fileURLToPath(import.meta.url));
    inputNames = [...new Set([MANIFEST, FIXTURE, ownPath, 'tests/helpers/capture-selected-rigid.ts',
      'tests/v6-selected-rigid-integration.test.ts', 'scripts/compare-selected-rigid-public-parity.py',
      'docs/migration/lot8a-evidence/tools/compare-selected-rigid-synthetic-terminal-parity.py',
      'scripts/export-v6-selected-rigid-reference.py', 'scripts/verify-selected-rigid-presence.py',
      'reference/v6/' + REFERENCE + '/manifest.json', SOURCE + 'laya_proto/common_frontier_policy.drm.json',
      SOURCE + 'morphology_policy/strategy.drm', ...Object.keys(nativeMap)])].sort();
    report.inputsBefore = await fingerprints(inputNames);
    for (const row of report.inputsBefore) if (nativeMap[row.path]) assert.equal(row.sha256, nativeMap[row.path], 'Frozen native source changed: ' + row.path);
    report.nativeSource = { fileCount: manifest.fileCount, digest: manifest.digest, manifest: MANIFEST };
    const fixture = JSON.parse(gunzipSync(await readFile(resolve(ROOT, FIXTURE))).toString('utf8'));
    assert.equal(fixture.exportStatus, 'passed');
    assert.equal(fixture.provenance.nativeStatesUsedToGenerateExpected, false);
    assert.equal(fixture.provenance.nativePlansUsedToGenerateExpected, false);
    const matching = fixture.sessions.filter(value => value.id === SCENARIO);
    assert.equal(matching.length, 1); const session = matching[0]; assert.equal(session.cold, true);
    assert.ok(Array.isArray(session.steps) && session.steps.length > 0 && session.steps.length <= LIMITS.maximumSourceSteps);
    // Project only the independently declared public observations and commands.
    // Expected source states, proposals, guards and acquisition results are never supplied.
    const table = session.steps.map(step => ({ beforePublic: copy(step.beforePublic),
      returns: step.returns.map(row => ({ command: command(row.command), afterPublic: copy(row.afterPublic) })) }));
    const expectedReturns = table.reduce((sum, row) => sum + row.returns.length, 0);
    assert.ok(expectedReturns > 0 && expectedReturns <= LIMITS.maximumPhysicalReturns);
    assert.equal(table.at(-1).returns.length, 0, 'The declared terminal continuation must remain present');
    assert.ok(table.slice(0, -1).every(row => row.returns.length > 0), 'Only the declared final step may have no return');
    report.declaredPublicTable = table;
    report.expectedPhysicalReturns = expectedReturns;
    const declarations = { common: await json(SOURCE + 'laya_proto/common_frontier_policy.drm.json'),
      strategy: await json(SOURCE + 'morphology_policy/strategy.drm') };
    const declarationsBefore = copy(declarations);
    const budgets = { targetLevels: 3, levelActionCaps: [80, 80, 80] };
    report.budgets = copy(budgets);
    timer = setTimeout(() => controller.abort(new Error('Declared120s capture timeout')), LIMITS.wallTimeoutMs);
    const execution = { signal: controller.signal, yieldControl: async () => {}, now: () => performance.now(),
      deadlineMs: performance.now() + LIMITS.wallTimeoutMs };
    runtime = await createNativeV6Runtime(declarations);
    const wrappers = runtime.families.filter(family => family.id === 'selected_rigid');
    assert.equal(wrappers.length, 1);
    const owner = rawNativeSelectedRigid(wrappers[0]);
    assert.ok(owner); assert.equal(runtime.acquisitionFamilies.selectedRigid, owner);
    report.coldSourceState = copy(owner.sourceState());
    assert.deepEqual(report.coldSourceState, { format: 'selected_rigid_events.v1', events: [] });
    report.selectedRigidCapture = captureSelectedRigid(owner, report.selectedRigidEvents);
    let currentPacket = packet(table[0].beforePublic, 0);
    let result = await runtime.initialize({ sessionId: 'lot8a-selected-rigid-synthetic-common-03',
      observation: currentPacket, budgets }, execution);
    report.implementation = result.snapshot.implementation;
    let previousCursor = 0, retainedPrefixObserved = false;
    const seenPrefixes = new Set();
    const recordEvents = () => report.selectedRigidEvents.filter(event => event.method === 'record');
    for (const [stepIndex, step] of table.entries()) {
      const actionsBeforeStep = report.actions.length, recordsBeforeStep = recordEvents().length;
      const resumedBoundary = result.kind === 'boundary';
      if (result.kind === 'boundary') {
        report.boundaryObservations.push({ phase: 'before-resume', stepIndex, value: copy(result) });
        result = await runtime.resume(execution);
      }
      assert.deepEqual(publicScene(currentPacket), publicScene(step.beforePublic), 'Public scenario frontier differs');
      // Match the existing common-caller test: even its zero-return terminal row
      // observes a real released continuation. Zero returns does not mean no offer.
      released(result);
      if (step.returns.length === 0) {
        assert.equal(stepIndex, table.length - 1);
        assert.equal(resumedBoundary, true, 'The terminal decision must follow the actual sealed boundary');
        const terminalCalls = report.selectedRigidEvents.slice(previousCursor);
        assert.ok(terminalCalls.length > 0, 'The terminal decision was not observed');
        assert.ok(terminalCalls.every(event => event.method !== 'record'), 'An unexecuted offer acquired a return');
        const proposalEvent = terminalCalls.findLast(event => event.method === 'propose');
        assert.ok(proposalEvent && proposalEvent.returnedNormally && proposalEvent.result,
          'The real terminal proposal is absent');
        const continuation = proposalEvent.result.selected_rigid_plan;
        assert.ok(continuation);
        assert.equal(continuation.epoch, 2);
        assert.equal(continuation.mode, 'select');
        assert.equal(continuation.models.length, 6);
        assert.deepEqual(continuation.models, owner.sourceState().events.at(-1).models,
          'The terminal decision did not consume its actually restored controls');
        assert.equal(report.actions.length, actionsBeforeStep);
        assert.equal(recordEvents().length, recordsBeforeStep);
        report.terminalObservation = {
          kind: 'released_continuation_without_public_return', stepIndex,
          resumedBoundary, executed: false, declaredPhysicalReturns: 0,
          eventsFrom: previousCursor, eventsThrough: report.selectedRigidEvents.length,
          events: copy(terminalCalls), proposalEventSequence: proposalEvent.sequence,
          observedYield: copy(result), instanceSourceState: copy(owner.sourceState()),
          instanceContext: copy(owner.captureContext()),
          actualGraphState: copy(readGraph(runtime.inspectKnowledge(), 'family_state:selected_rigid')),
          physicalActionsBefore: actionsBeforeStep, physicalActionsAfter: report.actions.length,
          recordsBefore: recordsBeforeStep, recordsAfter: recordEvents().length,
          scope: 'Observed next decision only; no returned command, acquisition or sealed prefix is invented.'
        };
      }
      for (const returned of step.returns) {
        if (controller.signal.aborted) throw controller.signal.reason;
        released(result);
        assert.deepEqual(command(result.command), returned.command, 'The actually released command differs from the declared public response');
        assert.ok(report.actions.length < LIMITS.maximumPhysicalReturns);
        const before = copy(result), actualCommand = copy(result.command), countBefore = recordEvents().length;
        const sequence = report.actions.length + 1;
        const nextPacket = packet(returned.afterPublic, sequence);
        result = await runtime.advance({ command: actualCommand, observation: nextPacket, executionMs: 0 }, execution);
        report.actions.push({ sequence, family: before.snapshot.lastDecision, command: actualCommand,
          actionIndex: before.authorization.action_index, decisionRevision: before.authorization.decision_revision,
          levelBefore: currentPacket.level, completedBefore: currentPacket.levels_completed,
          levelAfter: nextPacket.level, completedAfter: nextPacket.levels_completed, state: nextPacket.state,
          frameHash: nextPacket.frame_hash, animationFrames: nextPacket.frame_packet.length,
          publicPacketSha256: sha(JSON.stringify(nextPacket)) });
        currentPacket = nextPacket;
        const graph = runtime.inspectKnowledge(), evidenceId = 'prefix_evidence:' + before.authorization.decision_revision;
        if (!graph.nodes[evidenceId]) {
          assert.equal(result.kind, 'action', 'Return neither continued nor sealed its real prefix');
          assert.equal(recordEvents().length, countBefore, 'Acquisition occurred before the actual prefix seal');
          retainedPrefixObserved = true;
          continue;
        }
        assert.ok(!seenPrefixes.has(evidenceId), 'Prefix was exported twice'); seenPrefixes.add(evidenceId);
        const evidence = readGraph(graph, evidenceId);
        assert.equal(evidence.proposal.kind, 'selected_rigid');
        const facts = readGraph(graph, 'reasoning:memory').facts.map(id => readGraph(graph, id));
        const through = report.selectedRigidEvents.length;
        const acquiredCalls = report.selectedRigidEvents.slice(previousCursor, through).filter(event => event.method === 'record');
        assert.equal(acquiredCalls.length, evidence.transitions.length);
        const acquired = acquiredCalls.map(event => {
          const key = 'selected_rigid_event:' + event.arguments[0].revision;
          const matches = facts.filter(fact => fact.key === key);
          assert.equal(matches.length, 1, 'Missing unique actually retained selected-return fact');
          const fact = matches[0];
          return { key: fact.key, evidence: fact.evidence, revision: fact.revision, result: copy(fact.value) };
        });
        const retained = facts.find(fact => fact.key === 'selected_rigid_state') ?? null;
        const state = readGraph(graph, 'family_state:selected_rigid');
        const observedRestores = report.selectedRigidEvents.slice(previousCursor, through).filter(event => event.kind === 'restore');
        assert.ok(observedRestores.length > 0, 'No actual restoration on sealed prefix');
        report.prefixes.push({ id: evidenceId, decisionRevision: evidence.decision_revision,
          acquiredActions: evidence.transitions.length, family: before.snapshot.lastDecision,
          proposalKind: evidence.proposal.kind, selectionGroup: evidence.proposal.strategy_receipt?.selected ?? null,
          selectedRigid: { stateNode: 'family_state:selected_rigid', state: copy(state), eventsThrough: through,
            instanceSourceState: copy(owner.sourceState()), instanceContext: copy(owner.captureContext()),
            proposal: copy(evidence.proposal), acquired, retainedSourceFact: copy(retained),
            transitions: copy(evidence.transitions) } });
        previousCursor = through;
        if (result.kind === 'boundary') report.boundaryObservations.push({ phase: 'after-return', sequence, value: copy(result) });
      }
    }
    assert.equal(report.actions.length, expectedReturns);
    assert.equal(recordEvents().length, report.actions.length, 'Every actual selected return must be acquired exactly once');
    assert.ok(retainedPrefixObserved, 'The declared scenario did not exercise a continued known prefix');
    assert.ok(report.prefixes.length > 0);
    assert.ok(report.terminalObservation);
    assert.equal(previousCursor, report.terminalObservation.eventsFrom);
    assert.equal(report.terminalObservation.eventsThrough, report.selectedRigidEvents.length);
    assert.deepEqual(report.terminalObservation.events, report.selectedRigidEvents.slice(previousCursor));
    assert.equal(recordEvents().at(-1).resultKind, 'null', 'Declared natural epoch boundary did not preserve its actual null acquisition');
    assert.ok(report.selectedRigidEvents.every(event => event.returnedNormally && event.observationErrors.length === 0));
    assert.deepEqual(report.selectedRigidCapture.unscopedClockReads, []);
    assert.deepEqual(declarations, declarationsBefore);
    report.finalSourceState = copy(owner.sourceState());
    report.finalYield = copy(result);
    report.checks = ['cold_unique_owner', 'normal_factory_current_guards_and_why_act',
      'only_declared_public_responses_to_actual_commands', 'complete_passive_call_journal',
      'one_record_per_physical_return_at_real_prefix_seal', 'actual_graph_checkpoints_and_restorations',
      'retained_known_prefix', 'selected_null_boundary_fact',
      'terminal_released_continuation_observed_without_execution', 'exhaustive_sealed_and_terminal_event_cursors'];
    report.captureStatus = 'passed_synthetic_observation_only';
    report.readerCompatibility = {
      status: 'requires_independent_cold_terminal_comparison',
      reader: 'docs/migration/lot8a-evidence/tools/compare-selected-rigid-synthetic-terminal-parity.py',
      contract: 'sealed_prefixes_then_terminal_observation.v1',
      completeJournalRetained: true, terminalEventsOutsideSealedPrefixes: true,
      artificialPrefixAdded: false, existingPrefixCursorExtended: false,
      independentReplayExecutedByCapture: false
    };
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed'; report.error = { name: error.name, message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    if (timer) clearTimeout(timer);
    runtime?.close('lot8a_selected_rigid_synthetic_capture_complete');
    try {
      report.inputsAfter = await fingerprints(inputNames);
      assert.deepEqual(report.inputsAfter, report.inputsBefore, 'An executed input changed during capture');
      report.inputsUnchanged = true;
    } catch (error) {
      report.status = 'failed'; report.finalVerificationError = { name: error.name, message: error.message };
      process.exitCode = 1;
    }
    report.finishedAt = nowUTC();
    await sink.writeFile(JSON.stringify(report, null, 2) + '\n');
    await sink.close();
    console.log(JSON.stringify({ status: report.status, output: relative(ROOT, output),
      actions: report.actions.length, prefixes: report.prefixes.length, events: report.selectedRigidEvents.length,
      inputsUnchanged: report.inputsUnchanged ?? false, error: report.error }));
  }
}
main().catch(error => {
  console.error(JSON.stringify({ status: 'failed_before_capture', error: { name: error.name, message: error.message } }));
  process.exitCode = 1;
});
