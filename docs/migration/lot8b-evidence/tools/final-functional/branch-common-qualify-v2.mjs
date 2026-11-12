#!/usr/bin/env node
/** Independent artifact reader. It never creates a runtime, runs an owner,
 * dispatches a command, executes an oracle, or manufactures source expectations.
 * node SCRIPT CAPTURE.jsonl.gz CAPTURE.receipt.json REVIEW.json FORMS.json */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';
import { digest, compareUnicode } from '../../../../../src/logos-engine/canonical.ts';
import { NativeKnowledgeStore, decodeNativeState, NATIVE_STORE_PROFILE } from '../../../../../src/logos-engine/v6-knowledge-store.ts';
import { hydrateNativeState, isNativeStateGraph } from '../../../../../src/logos-engine/v6-native-state-graph.ts';
import { symbolicDigest } from '../../../../../src/logos-engine/v6-hash.ts';

const SCRIPT = fileURLToPath(import.meta.url), ROOT = resolve(dirname(SCRIPT), '../../../../..');
const BASE = resolve(ROOT, 'docs/migration/lot8b-evidence/final-version-067-01'), OWNER = 'branch_routing', EPISODE = 'common-observation-frontier';
const CAPTURE = resolve(dirname(SCRIPT), 'branch-common-capture-v2.mjs');
const PREVIOUS_ATTEMPT = 'docs/migration/lot8b-evidence/delivery-qualification-01/branch-capture-01/capture.receipt.json';
const DERIVATION = 'docs/migration/lot8b-evidence/tools/delivery/branch-common-qualify-v2.mjs';
const EXPECTED_NATIVE = { fileCount: 331, digest: 'c234bb404de43b380e5595cee8ad4ddfcae6e02d0fcc40286546fcf6838dd44a' };
const EXPECTED_IMPLEMENTATION = 'logos-engine.typescript.v6.native-migration/0.67.0';
const FIXTURE = 'tests/fixtures/v6-branch-routing-reference.json', REFERENCE = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e';
const FIXTURE_SHA256 = 'e6ae197b7b982bd41f561b9df8e458436d7ce0797f39bbf86d972e55472b6769';
const SINGLE = 'cold_four_calibrations_move_propagate_epoch', TRIPLE = 'cold_equal_cost_select_first_point_bind_move';
const CONTRARY = 'contrary_measured_move_revises_motion';
const CASES = ['single-positive', 'triple-prefix', 'contrary-return', 'selected-acquisition-ablation', 'incomplete-prefix'];
const BUDGETS = { targetLevels: 3, levelActionCaps: [24, 24, 24], maxActions: 72 };
const EXECUTION_DECLARATION = { yieldControl: 'setTimeout(resolve, 0)', signalProvided: false,
  nowProvided: false, deadlineMsProvided: false, remainingLevelActionsProvided: false,
  runtimeClock: 'factory_default_performance_now_except_declared_incomplete_case',
  supervisorTimeoutSeconds: 300, v8OldSpaceMiB: 1536, officialPerformanceEligible: false };
const copy = value => structuredClone(value), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const label = path => path.startsWith(ROOT + sep) ? relative(ROOT, path) : path;
const inside = (root, path) => { const name = relative(root, path); return name && name !== '..' && !name.startsWith(`..${sep}`); };
const failure = error => ({ name: error?.name ?? 'Error', message: String(error?.message ?? error), stack: error?.stack ?? null });
async function absent(path) { try { await access(path); throw new Error('Refusing existing qualification: ' + path); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
async function fingerprint(path) {
  const hash = createHash('sha256'); for await (const bytes of createReadStream(path)) hash.update(bytes);
  return { path: label(resolve(path)), bytes: (await stat(path)).size, sha256: hash.digest('hex') };
}
async function nativeInventory() {
  const names = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if ((entry.isFile() || entry.isSymbolicLink() && (await stat(path)).isFile()) && /\.(ts|json|drm)$/.test(entry.name)) names.push(relative(ROOT, path));
    }
  }
  for (const directory of ['src/logos-engine', 'src/runtime']) await walk(resolve(ROOT, directory));
  assert.ok(names.every(name => /^[\x20-\x7e]+$/.test(name)));
  const files = {}; for (const name of names.sort()) files[name] = sha(await readFile(resolve(ROOT, name)));
  return { fileCount: names.length, digest: sha(JSON.stringify(files)), files };
}
async function* records(path) {
  const input = createReadStream(path), stream = input.pipe(createGunzip()), decoder = new StringDecoder('utf8');
  input.on('error', error => stream.destroy(error));
  let pending = '', index = 0, footer = false;
  function parse(line) {
    assert.equal(footer, false, 'Records follow the terminal footer');
    const row = JSON.parse(line); assert.equal(row.recordIndex, index++, 'Capture rows are missing or reordered');
    if (row.type === 'footer') { assert.equal(row.recordsBeforeFooter, row.recordIndex); footer = true; }
    return row;
  }
  try {
    for await (const chunk of stream) {
      pending += decoder.write(chunk); let at;
      while ((at = pending.indexOf('\n')) >= 0) { const line = pending.slice(0, at); pending = pending.slice(at + 1); assert.ok(line); yield parse(line); }
    }
    pending += decoder.end(); if (pending) yield parse(pending);
    assert.equal(footer, true, 'A complete capture footer is required');
  } finally { input.destroy(); stream.destroy(); }
}
// A local lookup key only, never a service ticket or another authorization.
const authorizationKey = value => JSON.stringify([value.observation_ref, value.decision_revision, value.action_index]);
function sourceRecords(fixture, id) {
  const scenario = fixture.scenarios.find(row => row.id === id); assert.ok(scenario);
  let proposed = null;
  return scenario.steps.flatMap((step, index) => {
    if (step.operation === 'propose') proposed = index;
    if (step.operation !== 'record') return [];
    const proposal = scenario.steps[proposed].result, actionIndex = step.index ?? 0;
    return [{ scenario: id, recordStep: index, proposeStep: proposed, before: step.before, after: step.after,
      actionIndex, mode: proposal.steps[actionIndex].mode, sourceCommand: copy(proposal.actions[actionIndex]) }];
  });
}
function expectedCases(fixture) {
  const single = sourceRecords(fixture, SINGLE), triple = sourceRecords(fixture, TRIPLE), contrary = sourceRecords(fixture, CONTRARY);
  return [
    { id: CASES[0], records: single, finalQuestion: null, intervention: null, completed: 6, wrapperRecords: 6, nativeAdapters: 6 },
    { id: CASES[1], records: triple, finalQuestion: { mode: 'propagate', command: { action_ref: 'ACTION5' } }, intervention: null, completed: 7, wrapperRecords: 7, nativeAdapters: 7 },
    { id: CASES[2], records: [...single.slice(0, 4), ...contrary], finalQuestion: { mode: 'calibrate', command: { action_ref: 'ACTION5' } }, intervention: null, completed: 5, wrapperRecords: 5, nativeAdapters: 5 },
    { id: CASES[3], records: single.slice(0, 1), finalQuestion: { mode: 'calibrate', command: { action_ref: 'ACTION1' } },
      intervention: 'registered_record_returns_empty_events_without_calling_original', completed: 0, wrapperRecords: 1, nativeAdapters: 0 },
    { id: CASES[4], records: triple, finalQuestion: null, intervention: 'runtime_level_clock_expires_after_actual_second_move_after_guard',
      completed: 5, wrapperRecords: 6, nativeAdapters: 6 },
  ];
}
const planOnly = ({ id, records, finalQuestion, intervention }) => ({ id, records, finalQuestion, intervention });
const commandFor = row => row.mode === 'select' ? { action_ref: 'ACTION6', data: { x: 6, y: 13 } } : copy(row.sourceCommand);
function frame(fixture, name, step) { return { ...copy(fixture.frames[name].public), step_index: step }; }
function remember(state, fixture, name, actual) {
  const ref = fixture.frames[name].observation.observation_ref, previous = state.references.get(ref);
  assert.ok(previous === undefined || previous === actual, 'One source observation must have one witnessed common reference');
  state.references.set(ref, actual);
}
function rebound(value, refs) {
  if (typeof value === 'string' && value.startsWith('O_synthetic_branches_')) { assert.ok(refs.has(value), `Unwitnessed source reference ${value}`); return refs.get(value); }
  if (Array.isArray(value)) return value.map(item => rebound(item, refs));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rebound(item, refs)]));
  return value;
}
function originalStep(fixture, row) { return fixture.scenarios.find(item => item.id === row.scenario).steps[row.recordStep]; }
function originalProposal(fixture, row) { return fixture.scenarios.find(item => item.id === row.scenario).steps[row.proposeStep]; }
function originalAfter(fixture, row) {
  const steps = fixture.scenarios.find(item => item.id === row.scenario).steps;
  const exact = steps.slice(row.proposeStep + 1, row.recordStep).find(step => step.operation === 'after'
    && step.before === row.before && step.after === row.after && (step.index ?? 0) === row.actionIndex);
  if (exact) return exact.result;
  assert.equal(originalProposal(fixture, row).result.steps[row.actionIndex].expected_after, null);
  // Pinned source after(): an explicitly unknown prediction is not confirmation.
  return { matched: null, seal_prefix: true, reason: 'compare_observed_contributor_pose' };
}
function nodeValue(state, node) {
  const cached = state.values.get(node.id);
  if (cached?.revision === node.revision) return cached.value;
  const value = isNativeStateGraph(node.value) ? hydrateNativeState(node.value, id => {
    assert.equal(state.nodes[id]?.kind, 'state_fragment'); assert.equal(state.nodes[id].scope, node.scope); return state.nodes[id].value;
  }) : decodeNativeState(node.value);
  // Complete raw deltas retain history; do not also keep every large hydration.
  state.values.set(node.id, { revision: node.revision, value }); return value;
}
function facts(state, key = null) {
  const memory = nodeValue(state, state.nodes['reasoning:memory']);
  return memory.facts.map(id => { const node = state.nodes[id]; assert.equal(node.component, 'native_reasoning_fact'); return { node, value: nodeValue(state, node) }; })
    .filter(item => item.value.episode === EPISODE && (key === null || item.value.key === key));
}
function onlyFact(state, key) { const rows = facts(state, key); assert.equal(rows.length, 1, `One retained source fact ${key}`); return rows[0]; }

class Reader {
  constructor(fixture, receipt, report) { this.fixture = fixture; this.receipt = receipt; this.report = report; this.plans = expectedCases(fixture); this.current = null; this.finished = []; this.headerSeen = false; }
  start(row) {
    assert.equal(this.current, null); const plan = this.plans[this.finished.length]; assert.ok(plan); assert.equal(row.case, plan.id);
    assert.equal(row.sessionId, `lot8b-branch-${plan.id}`); assert.deepEqual(row.budgets, BUDGETS);
    assert.equal(row.entryBoundary, 'NativeV6Runtime'); assert.deepEqual(row.nativeExecution, EXECUTION_DECLARATION);
    assert.equal(row.cold, true); assert.equal(row.acquiredStateInjected, false); assert.deepEqual(row.recordPlan, plan.records);
    assert.deepEqual(row.finalQuestion, plan.finalQuestion); assert.equal(row.intervention, plan.intervention);
    assert.equal(row.runtimeClock, plan.id === 'incomplete-prefix' ? 'explicit_controlled_level_clock' : 'factory_default');
    const first = frame(this.fixture, plan.records[0].before, 0); assert.deepEqual(row.initialPublicPacket, first);
    this.current = { id: plan.id, sessionId: row.sessionId, plan, nodes: {}, deltas: [], revision: 0, chain: null,
      chains: new Map([[null, 0]]), values: new Map(), ownerRoots: new Map(), traceClocks: new Map(), references: new Map(),
      operations: [], checkpoints: [], returned: [], pending: null, last: null, point: 0, currentPacket: first, observation: null,
      completed: [], wrapperRecords: [], releases: new Map(), finalQuestionSeen: false, stoppedResumeSeen: false,
      inspections: 0, closed: false, interventions: [], terminal: null, restoreCoverage: [], links: [], forms: [], allCheckpointsMatched: true };
  }
  command(state, row) {
    assert.equal(state.pending, null); assert.ok(state.last); assert.equal(state.last.result.kind, 'action');
    const index = state.returned.length, source = state.plan.records[index]; assert.ok(source);
    assert.equal(row.action, index + 1); assert.equal(row.sourceCapturePointIndex, state.point - 1);
    assert.deepEqual([row.sourceCase, row.sourceRecordStep, row.sourceProposeStep, row.sourceFrameBefore, row.sourceFrameAfter, row.mode],
      [source.scenario, source.recordStep, source.proposeStep, source.before, source.after, source.mode]);
    assert.deepEqual(row.sourceCommand, source.sourceCommand); assert.deepEqual(row.declaredCommonCommand, commandFor(source));
    assert.deepEqual(row.actualCommand, commandFor(source)); assert.deepEqual(row.actualCommand, state.last.result.command);
    assert.deepEqual(row.authorization, state.last.result.authorization); assert.deepEqual(row.authorizationIdentity, state.last.authorizationIdentity);
    assert.equal(row.authorizationIdentity.graphChain, state.chain);
    assert.equal(row.authorizationIdentity.nativeExecutionDigest, state.last.snapshot.nativeExecutionDigest);
    assert.equal(row.authorization.action_index, source.actionIndex); assert.equal(row.commandEqual, true); assert.equal(row.returnSupplied, false);
    assert.equal(Object.hasOwn(row, 'ticket'), false);
    assert.deepEqual(row.publicPacket, frame(this.fixture, source.after, index + 1)); assert.equal(row.publicPacketSha256, sha(JSON.stringify(row.publicPacket)));
    remember(state, this.fixture, source.before, row.authorization.observation_ref); state.pending = { ...row, source };
  }
  async graph(state, row) {
    const graph = row.knowledge, snapshot = row.snapshot;
    if (!state.kernel) { state.runtimeDigest = snapshot.sourceDigest; state.kernel = new NativeKnowledgeStore(state.runtimeDigest, state.sessionId).kernel; }
    assert.equal(snapshot.sourceDigest, state.runtimeDigest); assert.equal(snapshot.sourceCommit, REFERENCE);
    assert.equal(snapshot.implementation, EXPECTED_IMPLEMENTATION);
    assert.equal(graph.fromRevision, state.revision); assert.equal(graph.toRevision, state.revision + graph.deltasAdded.length);
    for (const delta of graph.deltasAdded) {
      assert.deepEqual(Object.keys(delta).sort(), ['cause', 'digest', 'node', 'previous', 'sequence', 'source_digest']);
      assert.equal(delta.sequence, ++state.revision); assert.equal(delta.previous, state.chain); assert.equal(delta.source_digest, state.runtimeDigest);
      state.kernel.validateNode(delta.node); assert.equal(delta.node.scope, state.sessionId);
      assert.equal(delta.node.origin.source_digest, state.runtimeDigest); assert.equal(delta.node.origin.store_profile, NATIVE_STORE_PROFILE);
      if (delta.node.kind === 'state_fragment') assert.equal(delta.node.id, `state_fragment:${symbolicDigest(delta.node.value, false)}`);
      const prior = state.nodes[delta.node.id]; assert.equal(delta.node.revision, (prior?.revision ?? 0) + 1);
      if (prior) { assert.equal(delta.node.kind, prior.kind); assert.deepEqual(delta.node.origin, prior.origin);
        assert.equal(isDeepStrictEqual({ ...delta.node, revision: prior.revision }, prior), false, 'A no-op delta was fabricated'); }
      assert.equal(await digest({ sequence: delta.sequence, previous: delta.previous, node: delta.node, cause: delta.cause, source_digest: delta.source_digest }), delta.digest);
      state.nodes[delta.node.id] = delta.node; state.chain = delta.digest; state.deltas.push(delta); state.chains.set(delta.digest, delta.sequence);
      if (delta.node.id === `family_state:${OWNER}`) state.ownerRoots.set(delta.node.revision, delta.node);
    }
    for (const delta of graph.deltasAdded) {
      if (isNativeStateGraph(delta.node.value)) nodeValue(state, delta.node);
      if (delta.node.component === 'native_reasoning_trace') {
        const value = nodeValue(state, delta.node), createdMs = Math.round(value.created * 1000);
        assert.equal(delta.node.id, `reasoning:trace:${value.id}`); assert.ok(Number.isSafeInteger(createdMs));
        assert.ok(Object.is(createdMs / 1000, value.created));
        if (state.traceClocks.has(delta.node.id)) assert.equal(value.created, state.traceClocks.get(delta.node.id));
        else { assert.equal(row.wallClock.source, 'unmodified_Date_now'); assert.ok(createdMs >= row.wallClock.startedMs && createdMs <= row.wallClock.finishedMs); state.traceClocks.set(delta.node.id, value.created); }
      }
    }
    assert.deepEqual([graph.chain, graph.toRevision, graph.nodeCount], [state.chain, state.revision, Object.keys(state.nodes).length]);
    assert.deepEqual([snapshot.graphChain, snapshot.graphRevision, snapshot.nodeCount], [state.chain, state.revision, Object.keys(state.nodes).length]);
    const executable = Object.values(state.nodes).filter(node => ['program', 'family_activation'].includes(node.kind))
      .sort((a, b) => compareUnicode(a.id, b.id)).map(node => ({ id: node.id, value: node.value }));
    assert.equal(await digest({ profile: NATIVE_STORE_PROFILE, source_digest: state.runtimeDigest, nodes: executable }), snapshot.nativeExecutionDigest);
    assert.ok(state.nodes['program:v6.composition_strategy.choose']); assert.ok(state.nodes['program:prototype.laya_router.route']);
    assert.equal(nodeValue(state, state.nodes[`family_activation:${OWNER}`]).enabled, true);
  }
  operation(state, operation) {
    assert.equal(operation.ordinal, state.operations.length); assert.ok(Number.isSafeInteger(operation.depth) && operation.depth >= 0);
    assert.equal(Object.hasOwn(operation, 'exception'), false); assert.equal(operation.sourceBefore.format, 'native.branch_routing.v1');
    assert.equal(operation.sourceAfter.format, 'native.branch_routing.v1');
    if (state.operations.length) assert.deepEqual(operation.sourceBefore, state.operations.at(-1).sourceAfter, 'One continuous owner, without hidden state injection');
    else assert.deepEqual(operation.sourceBefore, this.fixture.scenarios.find(item => item.id === SINGLE).initialState);
    if (operation.graphAtStart) assert.equal(state.chains.get(operation.graphAtStart.chain), operation.graphAtStart.revision);
    const original = !(state.id === 'selected-acquisition-ablation' && operation.method === 'record');
    assert.equal(operation.nativeOriginalInvoked, original);
    if (['before', 'after', 'bind'].includes(operation.method)) assert.deepEqual(operation.sourceAfter, operation.sourceBefore);
    if (operation.method === 'restore') {
      assert.equal(operation.returnKind, 'undefined'); assert.deepEqual(operation.sourceAfter, operation.arguments.checkpoint);
      const root = state.ownerRoots.get(operation.graphAtStart?.ownerRootRevision); assert.ok(root, 'Actual restore must read a real common owner node');
      assert.deepEqual(nodeValue(state, root), operation.arguments.checkpoint);
      state.restoreCoverage.push({ operation: operation.ordinal, ownerNode: root.id, ownerRevision: root.revision,
        graphRevision: operation.graphAtStart.revision, eventCount: operation.sourceAfter.events.length });
    }
    if (operation.method === 'before') assert.equal(operation.returnValue.admitted, true, 'Every captured release uses a current admitted guard');
    if (operation.method === 'after') {
      const actual = state.returned.find(item => item.afterObservation.observation_ref === operation.arguments.after.observation_ref); assert.ok(actual);
      assert.deepEqual(operation.arguments.before, actual.beforeObservation); assert.deepEqual(operation.arguments.after, actual.afterObservation);
      assert.deepEqual(operation.arguments.firstRows, actual.firstPacket.frame_rows); assert.deepEqual(operation.arguments.secondRows, actual.secondPacket.frame_rows);
      assert.equal(operation.arguments.index, actual.source.actionIndex); assert.deepEqual(operation.returnValue, originalAfter(this.fixture, actual.source));
      actual.afterGuard = operation.returnValue;
    }
    if (operation.method === 'record') {
      const actual = state.returned.find(item => item.afterObservation.observation_ref === operation.arguments.after.observation_ref); assert.ok(actual);
      assert.equal(actual.recordOperation, undefined, 'A public return reaches the selected wrapper once at most'); actual.recordOperation = operation;
      assert.deepEqual(operation.arguments.before, actual.beforeObservation); assert.deepEqual(operation.arguments.after, actual.afterObservation);
      assert.deepEqual(operation.arguments.command, commandFor(actual.source)); assert.deepEqual(operation.arguments.frames, actual.secondPacket.frame_packet);
      assert.deepEqual(operation.arguments.firstRows, actual.firstPacket.frame_rows); assert.deepEqual(operation.arguments.secondRows, actual.secondPacket.frame_rows);
      assert.equal(operation.arguments.index, actual.source.actionIndex);
      state.wrapperRecords.push(operation);
      if (!original) {
        assert.deepEqual(operation.returnValue, { events: [] }); assert.deepEqual(operation.sourceAfter, operation.sourceBefore);
      } else if (operation.returnValue.native_acquisition_incomplete === true) {
        assert.equal(state.id, 'incomplete-prefix'); assert.equal(actual.action, 6); assert.deepEqual(operation.returnValue.events, []);
        assert.deepEqual(operation.sourceAfter, operation.sourceBefore);
        assert.equal(operation.arguments.execution.deadlineMs, 360_001);
      } else {
        const source = originalStep(this.fixture, actual.source);
        assert.deepEqual(operation.returnValue, { events: [rebound(source.result, state.references)] });
        assert.deepEqual(operation.sourceAfter, rebound(source.afterState, state.references)); state.completed.push(operation);
      }
    }
    if (operation.method === 'propose' && operation.returnValue) {
      const publicRef = operation.arguments.observation.observation_ref;
      const count = operation.phase.sequence;
      const source = state.plan.records[count];
      if (source) {
        const original = originalProposal(this.fixture, source), expected = original.result;
        assert.deepEqual(operation.sourceAfter, rebound(original.afterState, state.references));
        assert.deepEqual(operation.returnValue.branch_plan, expected.branch_plan); assert.deepEqual(operation.returnValue.facts, expected.facts);
        assert.deepEqual(operation.returnValue.route_refs, rebound(expected.route_refs, state.references));
        assert.equal(operation.returnValue.binding.observation_ref, publicRef);
        const actions = expected.actions.map((command, index) => expected.steps[index].mode === 'select'
          ? { action_ref: 'ACTION6', data: { x: 6, y: 13 } } : command);
        assert.deepEqual(operation.returnValue.actions, actions);
        assert.deepEqual(operation.returnValue.steps, expected.steps.map((step, index) => ({ ...step, action: actions[index] })));
      } else if (state.id === 'selected-acquisition-ablation') {
        assert.deepEqual(operation.sourceAfter.motion, {}); assert.deepEqual(operation.sourceAfter.events, []);
        assert.deepEqual(operation.sourceAfter.verified, []); assert.deepEqual(operation.sourceAfter.seen, []); assert.deepEqual(operation.sourceAfter.refs, {});
        assert.equal(operation.returnValue.steps[0].mode, 'calibrate'); assert.deepEqual(operation.returnValue.actions, [{ action_ref: 'ACTION1' }]);
      } else {
        assert.ok(state.plan.finalQuestion); assert.equal(operation.returnValue.steps[0].mode, state.plan.finalQuestion.mode);
        assert.deepEqual(operation.returnValue.actions, [state.plan.finalQuestion.command]);
      }
    }
    if (operation.method === 'bind' && operation.proposalAfter.steps.some(step => step.mode === 'select')) {
      const step = operation.proposalAfter.steps[0], bindings = operation.arguments.domain.bindings;
      const table = bindings.find(([key]) => key === `${operation.proposalAfter.binding.level_epoch}:${step.expected_before.frame_hash}`)?.[1];
      const witness = table?.find(([key]) => key === '6,13')?.[1]; assert.ok(witness);
      assert.deepEqual(step.point_binding, { ...witness, projection_bbox: [6, 12, 7, 15], projected_rows_digest: step.point_digest });
      assert.deepEqual(step.action, { action_ref: 'ACTION6', data: { x: 6, y: 13 } });
    }
    state.operations.push(operation);
  }
  sourceFacts(state) {
    const retained = facts(state).filter(item => item.value.key.startsWith('branches:'));
    const completedWrappers = state.wrapperRecords.filter(operation => operation.returnValue.native_acquisition_incomplete !== true);
    assert.equal(retained.length, completedWrappers.length);
    for (const operation of completedWrappers) {
      const key = `branches:${operation.arguments.before.revision}`, fact = onlyFact(state, key);
      assert.deepEqual(fact.value.value, operation.returnValue.events[0] ?? null);
      assert.equal(fact.value.evidence, operation.arguments.after.observation_ref); assert.equal(fact.value.revision, operation.arguments.after.revision);
      assert.ok(fact.node.relations.some(relation => relation.relation === 'retained_by' && relation.target === 'reasoning:memory'));
    }
  }
  action(state, row) {
    const result = row.result; if (result?.kind !== 'action') return;
    assert.ok(result.authorization); const authorization = result.authorization, proposal = result.snapshot.proposal, index = authorization.action_index;
    assert.deepEqual(Object.keys(authorization).sort(), ['action_index', 'decision_revision', 'observation_ref']);
    assert.equal(result.snapshot.lastDecision, OWNER); assert.equal(proposal.kind, 'parallel_branch_routing');
    assert.equal(proposal.material_access_subquestion, 'parallel_branch_routing'); assert.equal(proposal.strategy_receipt.selected, 'factored_material_return');
    assert.equal(proposal.bundle_template.operation_key, 'OP18'); assert.equal(proposal.compositions[0].observed, false);
    assert.deepEqual(result.command, proposal.actions[index]);
    assert.equal(row.authorizationIdentity.graphChain, state.chain); assert.equal(row.authorizationIdentity.nativeExecutionDigest, result.snapshot.nativeExecutionDigest);
    assert.equal(authorization.observation_ref, row.actualObservation.observation_ref);
    const guard = state.operations.findLast(operation => operation.method === 'before' && operation.arguments.index === index
      && operation.arguments.observation.observation_ref === authorization.observation_ref);
    assert.ok(guard); assert.equal(guard.returnValue.admitted, true);
    assert.deepEqual(guard.arguments.publicPacket, state.currentPacket); assert.deepEqual(guard.arguments.observation, row.actualObservation);
    assert.ok(result.snapshot.trace.some(item => item.kind === 'before_guard' && item.family === OWNER && item.index === index && item.admitted && item.point_bound));
    assert.equal(result.snapshot.whyAct.decision.decision.status, 'action_set_released');
    assert.deepEqual(result.snapshot.whyAct.decision.decision.action_set.actions, proposal.actions);
    const current = onlyFact(state, 'state');
    assert.equal(current.value.value.bundles[0].composition_ref, proposal.bundle_template.composition_ref);
    assert.deepEqual(current.value.value.bundles[0].actions, proposal.actions);
    const prediction = state.nodes[`reasoning:prediction:${authorization.decision_revision}`]; assert.ok(prediction);
    assert.equal(nodeValue(state, prediction).before_observation_ref, proposal.binding.observation_ref);
    const key = authorizationKey(authorization);
    if (state.releases.has(key)) assert.deepEqual(state.releases.get(key).authorization, authorization);
    else {
      state.releases.set(key, { authorization, command: result.command, mode: proposal.steps[index].mode, point: row.pointIndex });
      state.links.push({ kind: 'checked_native_authority_correspondence', authorization, authorizationIdentity: row.authorizationIdentity,
        frameHash: row.actualObservation.frame_hash, mode: proposal.steps[index].mode,
        ownerNode: `family_state:${OWNER}`, ownerRevision: state.nodes[`family_state:${OWNER}`].revision,
        selectionProgram: 'program:v6.composition_strategy.choose', stateFact: current.node.id, predictionNode: prediction.id,
        composition: proposal.bundle_template.composition_ref, decisionRevision: authorization.decision_revision,
        actionIndex: index, pointBinding: proposal.steps[index].point_binding ?? null });
    }
  }
  async point(state, row) {
    const request = row.request, result = row.result, snapshot = row.snapshot;
    assert.equal(row.pointIndex, state.point++); assert.equal(request.sessionId, state.sessionId);
    assert.equal(snapshot.actions, request.sequence); assert.equal(snapshot.levelsCompleted, 0);
    assert.equal(snapshot.caller.enabled, true); assert.equal(snapshot.whyAct.enabled, true);
    assert.deepEqual(row.authorizationIdentity, { graphChain: snapshot.graphChain, nativeExecutionDigest: snapshot.nativeExecutionDigest });
    assert.equal(row.call.method, request.type);
    const yielding = ['initialize', 'advance', 'resume'].includes(request.type);
    assert.deepEqual(row.call.executionArgument, yielding ? EXECUTION_DECLARATION : null);
    if (yielding) {
      assert.equal(row.returnKind, 'native_yield'); assert.deepEqual(result.snapshot, snapshot);
      assert.deepEqual(Object.keys(result).sort(), ['authorization', 'command', 'kind', 'reason', 'snapshot']);
      if (result.kind !== 'action') { assert.equal(result.authorization, null); assert.equal(result.command, null); }
    } else assert.equal(Object.hasOwn(row, 'result'), false, 'Inspection and close must not manufacture native yields');
    assert.equal(row.ownerBinding.id, OWNER); assert.equal(row.ownerBinding.registeredInstances, 1);
    assert.equal(row.ownerBinding.source, 'registered_family_wrapper_state_restore'); assert.equal(row.ownerBinding.entryPoint, null);
    assert.deepEqual(row.ownerBinding.neighbours, ['motif_access', OWNER, 'band_transfer']);
    if (request.type === 'initialize') {
      assert.equal(row.pointIndex, 0); assert.equal(request.sequence, 0); assert.deepEqual(request.budgets, BUDGETS);
      assert.deepEqual(row.publicPacket, state.currentPacket); assert.deepEqual(request.observation, state.currentPacket);
      assert.deepEqual(row.call.arguments, [{ sessionId: state.sessionId, observation: state.currentPacket, budgets: BUDGETS }]);
      assert.equal(row.identityBefore, null);
      assert.equal(row.checkedCommandRecord, null); remember(state, this.fixture, state.plan.records[0].before, row.actualObservation.observation_ref);
    } else if (request.type === 'advance') {
      const pending = state.pending; assert.ok(pending); assert.equal(row.checkedCommandRecord, pending.recordIndex);
      assert.deepEqual(request.command, pending.actualCommand); assert.equal(request.sequence, state.returned.length + 1); assert.equal(request.executionMs, 0);
      assert.deepEqual(row.identityBefore, pending.authorizationIdentity);
      assert.deepEqual(row.publicPacket, pending.publicPacket); assert.deepEqual(request.observation, pending.publicPacket);
      assert.deepEqual(row.call.arguments, [{ command: pending.actualCommand, observation: pending.publicPacket, executionMs: 0 }]);
      remember(state, this.fixture, pending.source.after, row.actualObservation.observation_ref);
      state.returned.push({ action: request.sequence, source: pending.source, authorization: pending.authorization,
        authorizationIdentity: pending.authorizationIdentity, nativeCommand: pending.actualCommand,
        beforeObservation: state.observation, afterObservation: row.actualObservation,
        firstPacket: state.currentPacket, secondPacket: row.publicPacket, recordOperation: undefined });
      state.pending = null; state.currentPacket = row.publicPacket;
    } else {
      assert.equal(request.sequence, state.returned.length); assert.equal(row.publicPacket, null); assert.equal(row.checkedCommandRecord, null);
      assert.equal(row.identityBefore, null);
      if (request.type === 'resume') {
        assert.deepEqual(row.call.arguments, []);
        if (state.last.result.kind === 'stopped') { assert.equal(state.id, 'incomplete-prefix'); assert.deepEqual(result, state.last.result); state.stoppedResumeSeen = true; }
        else { assert.equal(state.last.result.kind, 'boundary'); if (state.returned.length === state.plan.records.length) { assert.ok(state.plan.finalQuestion); state.finalQuestionSeen = true;
          assert.equal(result.kind, 'action'); assert.equal(snapshot.proposal.steps[0].mode, state.plan.finalQuestion.mode); assert.deepEqual(result.command, state.plan.finalQuestion.command); } }
      } else if (request.type === 'inspectKnowledge') {
        assert.deepEqual(row.call.arguments, []); assert.equal(row.returnKind, 'knowledge_memory');
        state.inspections++; assert.deepEqual(row.ownerOperations, []); assert.deepEqual(row.ownerCheckpoints, []); assert.deepEqual(row.knowledge.deltasAdded, []);
        assert.deepEqual(snapshot, state.last.snapshot); assert.deepEqual(row.authorizationIdentity, state.last.authorizationIdentity);
      } else {
        assert.equal(request.type, 'close'); assert.equal(state.closed, false); state.closed = true;
        assert.equal(request.reason, 'branch_capture_session_closed'); assert.deepEqual(row.call.arguments, [request.reason]);
        assert.equal(row.returnKind, 'undefined'); assert.deepEqual(snapshot, { ...state.last.snapshot, reason: request.reason });
        assert.deepEqual(row.ownerOperations, []); assert.deepEqual(row.ownerCheckpoints, []); assert.deepEqual(row.knowledge.deltasAdded, []);
      }
    }
    assert.deepEqual([row.actualObservation.frame_hash, row.actualObservation.level_epoch, row.actualObservation.levels_completed, row.actualObservation.state,
      row.actualObservation.available_action_refs], [state.currentPacket.frame_hash, state.currentPacket.level, state.currentPacket.levels_completed,
      state.currentPacket.state, state.currentPacket.available_action_refs]);
    assert.equal(row.actualObservation.revision, request.sequence + 1); state.observation = row.actualObservation;
    assert.equal(state.currentPacket.frame_hash, sha(JSON.stringify(state.currentPacket.frame_rows)).slice(0, 16), 'Tool verification of the unchanged packet label, not service validation');
    assert.deepEqual(state.currentPacket.frame_packet.at(-1), state.currentPacket.frame_rows);
    await this.graph(state, row);
    for (const operation of row.ownerOperations) { assert.deepEqual(operation.phase, { type: request.type, sequence: request.sequence }); this.operation(state, operation); }
    for (const checkpoint of row.ownerCheckpoints) { assert.equal(checkpoint.ordinal, state.checkpoints.length); assert.deepEqual(checkpoint.phase, { type: request.type, sequence: request.sequence }); state.checkpoints.push(checkpoint); }
    const root = state.nodes[`family_state:${OWNER}`]; assert.equal(root.kind, 'family_state'); assert.equal(root.family, OWNER);
    const retained = nodeValue(state, root); assert.deepEqual(retained, row.ownerState);
    assert.ok(state.checkpoints.some(item => isDeepStrictEqual(item.state, retained)), 'Owner root must match an actual observed checkpoint call');
    this.sourceFacts(state); this.action(state, row);
    for (const event of row.interventions) { assert.equal(state.id, 'incomplete-prefix'); assert.equal(request.type, 'advance'); assert.equal(request.sequence, 7);
      assert.deepEqual(event, { kind: 'level_clock_expired_after_unchanged_after_guard', fromMs: 0, toMs: 360_001,
        observationRef: row.actualObservation.observation_ref, index: 1,
        unchangedResult: originalAfter(this.fixture, state.plan.records[6]), originalRecordChanged: false }); state.interventions.push(event); }
    if (request.type === 'inspectKnowledge') {
      assert.deepEqual(row.inspection, { exactKnowledgeReturned: true, nodeCount: Object.keys(state.nodes).length, deltaCount: state.deltas.length,
        chain: state.chain, nodesDigest: await digest(state.nodes), deltasDigest: await digest(state.deltas) });
    } else assert.equal(row.inspection, null);
    if (request.type === 'advance' && ['boundary', 'stopped'].includes(result.kind)) {
      assert.equal(snapshot.caller.acquiredTransitions, state.returned.length);
      assert.deepEqual(snapshot.whyAct.analysis.map(item => item.operation), ['OP29', 'OP30', 'OP31']);
    }
    if (yielding) state.terminal = { kind: result.kind, reason: result.reason, command: result.command, authorization: result.authorization,
      actions: snapshot.actions, cycles: snapshot.cycles, acquiredTransitions: snapshot.caller.acquiredTransitions,
      ownerState: row.ownerState, graphChain: snapshot.graphChain, graphRevision: snapshot.graphRevision, nodeCount: snapshot.nodeCount };
    state.forms.push({ type: request.type, sequence: request.sequence, returnKind: row.returnKind, kind: result?.kind ?? null, family: snapshot.lastDecision,
      mode: result?.kind === 'action' ? snapshot.proposal.steps[result.authorization.action_index].mode : null,
      acquiredTransitions: snapshot.caller.acquiredTransitions, ownerEventCount: row.ownerState.events.length,
      graphFrom: row.knowledge.fromRevision, graphTo: row.knowledge.toRevision, nodeCount: row.knowledge.nodeCount });
    state.last = row;
    this.report.checks.push({ case: state.id, point: row.pointIndex, request: request.type, passed: true });
  }
  end(state, row) {
    assert.equal(state.pending, null); assert.equal(state.closed, true); assert.equal(state.inspections, 1);
    assert.equal(row.status, 'captured_synthetic_common_structure'); const summary = row.summary;
    assert.equal(summary.factoryCalls, 1); assert.equal(summary.physicalReturns, state.plan.records.length); assert.equal(summary.commandsChecked, state.returned.length);
    assert.equal(summary.captures, state.point); assert.equal(summary.ownerOperations, state.operations.length); assert.equal(summary.ownerCheckpoints, state.checkpoints.length);
    assert.deepEqual(summary.terminal, state.terminal); assert.equal(state.finalQuestionSeen, state.plan.finalQuestion !== null);
    assert.equal(state.completed.length, state.plan.completed); assert.equal(state.wrapperRecords.length, state.plan.wrapperRecords);
    assert.equal(state.wrapperRecords.filter(operation => operation.nativeOriginalInvoked).length, state.plan.nativeAdapters);
    assert.ok(state.restoreCoverage.some(item => item.eventCount > 0) || state.id === 'selected-acquisition-ablation', 'Acquired state must be read through common restore');
    assert.equal(state.terminal.ownerState.events.length, state.plan.completed); assert.deepEqual(state.terminal.ownerState.passed, []);
    for (const returned of state.returned) {
      assert.ok(returned.afterGuard);
      const evidenceId = `prefix_evidence:${returned.authorization.decision_revision}`, evidenceNode = state.nodes[evidenceId]; assert.ok(evidenceNode);
      const evidence = nodeValue(state, evidenceNode);
      assert.equal(evidenceNode.family, OWNER); assert.ok(evidenceNode.relations.some(item => item.relation === 'records' && item.target === `family_state:${OWNER}`));
      assert.ok(evidenceNode.relations.some(item => item.relation === 'selected_by' && item.target === 'program:v6.composition_strategy.choose'));
      assert.equal(evidence.proposal.material_access_subquestion, 'parallel_branch_routing');
      assert.deepEqual(evidence.transitions.find(item => item.after === returned.afterObservation.observation_ref), {
        command: returned.nativeCommand, before: returned.beforeObservation.observation_ref, after: returned.afterObservation.observation_ref, outcome: returned.afterGuard });
      const transitionNode = state.nodes[`reasoning:transition:${returned.beforeObservation.revision}`]; assert.ok(transitionNode);
      const transition = nodeValue(state, transitionNode); assert.equal(transitionNode.component, 'public_transition');
      assert.deepEqual([transition.before, transition.after, transition.command], [returned.beforeObservation.observation_ref, returned.afterObservation.observation_ref, returned.nativeCommand]);
      state.links.push({ kind: 'actual_prefix_relations_and_checked_return', prefixNode: evidenceId, transitionNode: transitionNode.id,
        ownerNode: `family_state:${OWNER}`, selectedBy: 'program:v6.composition_strategy.choose', action: returned.action,
        mode: returned.source.mode, recordOperation: returned.recordOperation?.ordinal ?? null });
    }
    if (state.id === 'incomplete-prefix') {
      assert.equal(state.stoppedResumeSeen, true); assert.equal(state.interventions.length, 1);
      assert.equal(state.terminal.kind, 'stopped'); assert.equal(state.terminal.reason, 'native_acquisition_incomplete');
      const first = state.returned[5], second = state.returned[6], evidenceId = `prefix_evidence:${first.authorization.decision_revision}`;
      const evidence = nodeValue(state, state.nodes[evidenceId]);
      const incomplete = evidence.native_acquisitions_incomplete.filter(item => item.family === OWNER); assert.equal(incomplete.length, 2);
      assert.equal(second.recordOperation, undefined); assert.equal(first.recordOperation.returnValue.native_acquisition_incomplete, true);
      for (const [index, returned] of [first, second].entries()) {
        const item = incomplete[index]; assert.equal(item.acquired, false); assert.equal(item.release_authority, false); assert.equal(item.mode, 'selected');
        assert.equal(item.proposal_ref, evidenceId); assert.equal(item.continuation, 'terminal_stop_without_automatic_reacquisition');
        assert.deepEqual([item.before, item.after, item.command], [returned.beforeObservation.observation_ref, returned.afterObservation.observation_ref, returned.nativeCommand]);
        assert.deepEqual(item.public_transition, { command: returned.nativeCommand, before: returned.beforeObservation, after: returned.afterObservation,
          first: returned.firstPacket, second: returned.secondPacket, index, outcome: returned.afterGuard });
        assert.equal(item.refusal.status, 'unknown'); assert.equal(item.refusal.release_authority, false); assert.equal(item.refusal.frontier.complete, false);
        assert.deepEqual([item.refusal.observation_ref, item.refusal.level_epoch, item.refusal.frame_hash],
          [returned.afterObservation.observation_ref, returned.afterObservation.level_epoch, returned.afterObservation.frame_hash]);
        assert.deepEqual(facts(state, `branches:${returned.beforeObservation.revision}`), []);
      }
      assert.equal(incomplete[0].refusal.reason, 'branch_routing_acquisition_incomplete'); assert.equal(incomplete[0].refusal.source_record_attempted, true);
      assert.equal(incomplete[0].refusal.reached_bound, 'deadline'); assert.equal(incomplete[0].refusal.search_phase, 'identity'); assert.equal(incomplete[0].refusal.examined, 0);
      assert.equal(incomplete[1].refusal.reason, 'earlier_selected_acquisition_incomplete'); assert.equal(incomplete[1].refusal.source_record_attempted, false);
      assert.deepEqual(incomplete[1].refusal.blocked_by, { observation_ref: first.afterObservation.observation_ref, index: 0 });
      const prior = rebound(originalStep(this.fixture, state.plan.records[4]).afterState, state.references);
      assert.deepEqual(state.terminal.ownerState, prior);
    } else assert.deepEqual(state.interventions, []);
    if (state.id === 'single-positive') assert.equal(state.terminal.ownerState.finished, true);
    const consumed = new Set(state.returned.map(item => authorizationKey(item.authorization)));
    assert.equal(consumed.size, state.returned.length, 'Each actual native release is supplied one public return');
    const pending = [...state.releases.values()].filter(item => !consumed.has(authorizationKey(item.authorization)));
    assert.equal(pending.length, state.plan.finalQuestion ? 1 : 0);
    const form = { id: state.id, sessionId: state.sessionId, physicalReturns: state.returned.length,
      executedModes: state.returned.map(item => item.source.mode), executedCommands: state.returned.map(item => item.nativeCommand),
      sourceAcquisitionsCompleted: state.completed.length, wrapperRecordCalls: state.wrapperRecords.length,
      nativeAdapterRecordInvocations: state.wrapperRecords.filter(item => item.nativeOriginalInvoked).length,
      unexecutedAuthorizedQuestions: pending.map(item => ({ mode: item.mode, command: item.command })),
      terminal: state.terminal, work: state.forms, restoreCoverage: state.restoreCoverage, links: state.links,
      commonCounterQualification: 'caller.acquiredTransitions counts reconciled public returns, including ablated or incomplete owner effects.',
      nodeCount: Object.keys(state.nodes).length, graphRevision: state.revision, graphChain: state.chain,
      completeRawGraphRetainedInCapture: true, independentlyValidatedGraph: true };
    this.finished.push({ form, returned: state.returned.map(item => ({ command: item.nativeCommand, first: item.firstPacket, second: item.secondPacket,
      afterGuard: item.afterGuard, acquiredState: item.recordOperation?.sourceAfter ?? null })), terminal: state.terminal });
    this.current = null;
  }
  finish() {
    assert.equal(this.current, null); assert.deepEqual(this.finished.map(item => item.form.id), CASES);
    const [positive, triple, contrary, ablation, incomplete] = this.finished;
    assert.deepEqual(positive.returned.slice(0, 4).map(({ acquiredState: _state, ...row }) => row), contrary.returned.slice(0, 4).map(({ acquiredState: _state, ...row }) => row));
    assert.deepEqual(positive.returned[4].command, contrary.returned[4].command); assert.deepEqual(positive.returned[4].first, contrary.returned[4].first);
    assert.equal(positive.returned[4].afterGuard.matched, true); assert.equal(contrary.returned[4].afterGuard.matched, false);
    assert.deepEqual(positive.terminal.ownerState.motion.ACTION1, [0, -2]); assert.deepEqual(contrary.terminal.ownerState.motion.ACTION1, [0, 2]);
    assert.equal(contrary.form.unexecutedAuthorizedQuestions[0].mode, 'calibrate'); assert.equal(positive.form.executedModes.at(-1), 'propagate');
    assert.deepEqual(positive.returned[0].command, ablation.returned[0].command);
    assert.deepEqual(positive.returned[0].first, ablation.returned[0].first); assert.deepEqual(positive.returned[0].second, ablation.returned[0].second);
    assert.deepEqual(ablation.terminal.ownerState.motion, {}); assert.deepEqual(ablation.terminal.ownerState.events, []);
    assert.deepEqual(ablation.form.unexecutedAuthorizedQuestions, [{ mode: 'calibrate', command: { action_ref: 'ACTION1' } }]);
    assert.deepEqual(positive.form.executedCommands[1], { action_ref: 'ACTION2' });
    assert.equal(triple.form.executedModes.filter(mode => mode === 'propagate').length, 0);
    assert.deepEqual(triple.form.unexecutedAuthorizedQuestions, [{ mode: 'propagate', command: { action_ref: 'ACTION5' } }]);
    const forms = this.finished.map(item => item.form), modes = {};
    for (const form of forms) for (const mode of form.executedModes) modes[mode] = (modes[mode] ?? 0) + 1;
    assert.deepEqual(modes, { calibrate: 17, move: 6, propagate: 1, select: 2 });
    assert.equal(forms.reduce((sum, item) => sum + item.physicalReturns, 0), 26);
    assert.equal(forms.reduce((sum, item) => sum + item.sourceAcquisitionsCompleted, 0), 23);
    assert.equal(forms.reduce((sum, item) => sum + item.wrapperRecordCalls, 0), 25);
    assert.equal(forms.reduce((sum, item) => sum + item.nativeAdapterRecordInvocations, 0), 24);
    assert.equal(incomplete.form.physicalReturns - incomplete.form.sourceAcquisitionsCompleted, 2);
    this.report.contribution = { positiveAndContraryShareFourAcquisitionsAndMoveCommand: true, contraryChangesMeasuredMotionAndNextQuestion: true,
      nextActionNameAloneDoesNotDistinguishCalibrateFromPropagate: true, ablationSharesFirstCommandAndPublicReturn: true,
      ablationLeavesControlUnlearnedAndRepeatsAction1: true, commonRestoreReadsActuallyPersistedOwner: true,
      incompletePrefixRetainsTwoUnacquiredPublicTransitions: true };
    this.report.counts = { sessions: 5, physicalReturns: 26, completedSourceAcquisitions: 23, ablatedReturns: 1,
      incompleteReturns: 2, wrapperRecordCalls: 25, nativeAdapterRecordInvocations: 24, executedModes: modes,
      unexecutedAuthorizedQuestions: 3, officialSolvedLevels: 0 };
    return forms;
  }
  async accept(row) {
    if (!this.headerSeen) {
      assert.equal(row.type, 'header'); this.headerSeen = true;
      assert.equal(row.schema, 'logos-engine.lot8b.branch-common-runtime-capture.v2'); assert.deepEqual(row.nativeSource, this.receipt.nativeBefore);
      assert.equal(row.entryBoundary, 'NativeV6Runtime'); assert.deepEqual(row.nativeExecution, EXECUTION_DECLARATION);
      for (const key of ['publicServiceQualified', 'publicWorkerQualified', 'publicTicketsQualified']) assert.equal(row[key], false);
      assert.deepEqual(row.previousFailedAttempt, this.receipt.previousFailedAttempt);
      assert.equal(row.sourceCommit, this.receipt.sourceCommit); assert.deepEqual(row.fixture, this.receipt.fixture);
      assert.deepEqual(row.generator, this.receipt.generator); assert.deepEqual(row.inputs, this.receipt.inputsBefore);
      assert.deepEqual(row.cases, this.plans.map(planOnly)); assert.equal(row.plannedSessions, 5); assert.equal(row.plannedPhysicalReturns, 26);
      assert.equal(row.officialPerformanceEligible, false); assert.deepEqual(row.pointDomain.sourceFixturePoint, [7, 13]); assert.deepEqual(row.pointDomain.commonCentroidPoint, [6, 13]);
      return;
    }
    if (row.type === 'session_start') { this.start(row); return; }
    if (row.type === 'footer') { assert.equal(this.current, null); assert.equal(row.status, 'captured_synthetic_common_structure'); assert.equal(row.sessions, 5); assert.equal(row.physicalReturns, 26); return; }
    const state = this.current; assert.ok(state); assert.equal(row.case, state.id); assert.equal(row.sessionId, state.sessionId);
    if (row.type === 'command_checked') this.command(state, row);
    else if (row.type === 'capture') await this.point(state, row);
    else { assert.equal(row.type, 'session_end', 'A failure record cannot qualify'); this.end(state, row); }
  }
}

async function main() {
  assert.equal(process.argv.length, 6, 'Usage: node SCRIPT CAPTURE.jsonl.gz CAPTURE.receipt.json REVIEW.json FORMS.json');
  const [capturePath, receiptPath, reviewPath, formsPath] = process.argv.slice(2).map(name => resolve(ROOT, name));
  for (const path of [capturePath, receiptPath, reviewPath, formsPath]) assert.ok(inside(BASE, path));
  assert.ok(capturePath.endsWith('.jsonl.gz') && reviewPath.endsWith('.json') && formsPath.endsWith('.json'));
  await absent(reviewPath); await absent(formsPath); await mkdir(dirname(reviewPath), { recursive: true }); await mkdir(dirname(formsPath), { recursive: true });
  const inputs = new Map(), report = { schema: 'logos-engine.lot8b.branch-common-runtime-graph-review.v2', status: 'failed',
    startedAt: new Date().toISOString(), officialPerformanceEligible: false, wholeCallerParity: false, strictCrossVersionGraphParity: false,
    entryBoundary: 'NativeV6Runtime', publicServiceQualified: false, publicWorkerQualified: false, publicTicketsQualified: false,
    nativeExecution: EXECUTION_DECLARATION,
    runtimeSessionsExecutedByReader: 0, originalOraclesExecuted: 0, gameReplays: 0, globalLockUsed: false,
    checks: [], failures: [], inputsBefore: [], inputsAfter: [] };
  async function input(path, expected = null) {
    const absolute = resolve(ROOT, path), actual = await fingerprint(absolute);
    if (expected) assert.deepEqual(actual, expected, `Frozen input changed: ${path}`);
    if (inputs.has(absolute)) assert.deepEqual(inputs.get(absolute), actual); inputs.set(absolute, actual); return actual;
  }
  let forms = null;
  try {
    report.generator = await input(SCRIPT); report.derivation = await input(DERIVATION);
    report.capture = await input(capturePath); report.captureReceipt = await input(receiptPath);
    const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
    assert.equal(receipt.schema, 'logos-engine.lot8b.branch-common-runtime-capture-receipt.v2'); assert.equal(receipt.status, 'captured_synthetic_common_structure');
    assert.equal(receipt.entryBoundary, 'NativeV6Runtime'); assert.deepEqual(receipt.nativeExecution, EXECUTION_DECLARATION);
    for (const key of ['publicServiceQualified', 'publicWorkerQualified', 'publicTicketsQualified']) assert.equal(receipt[key], false);
    assert.deepEqual(receipt.failures, []); assert.equal(receipt.sessionCount, 5); assert.equal(receipt.physicalReturns, 26);
    for (const key of ['nativeSourceUnchanged', 'sourceCommitUnchanged', 'inputsUnchanged']) assert.equal(receipt[key], true);
    for (const key of ['officialPerformanceEligible', 'globalLockUsed', 'acquiredStateInjected', 'wholeCallerParity']) assert.equal(receipt[key], false);
    for (const key of ['officialGameRuns', 'gameReplays', 'originalOraclesExecuted', 'measuredCostSessions']) assert.equal(receipt[key], 0);
    assert.deepEqual(receipt.capture, report.capture); assert.deepEqual(receipt.nativeBefore, receipt.nativeAfter);
    assert.deepEqual({ fileCount: receipt.nativeBefore.fileCount, digest: receipt.nativeBefore.digest }, EXPECTED_NATIVE);
    assert.equal(receipt.nativeVersion, '0.67.0');
    assert.deepEqual(receipt.inputsBefore, receipt.inputsAfter); assert.equal(receipt.sourceCommit, receipt.sourceCommitAfter);
    assert.deepEqual(receipt.qualifier, report.generator); await input(CAPTURE, receipt.generator);
    for (const record of receipt.inputsBefore) await input(record.path, record);
    const previous = JSON.parse(await readFile(resolve(ROOT, PREVIOUS_ATTEMPT), 'utf8'));
    assert.equal(previous.status, 'failed'); assert.equal(previous.physicalReturns, 0); assert.equal(previous.sessions.length, 1);
    assert.equal(previous.sessions[0].factoryCalls, 0); assert.equal(previous.failures[0].message, 'The public game frame must be 64 × 64.');
    for (const key of ['nativeSourceUnchanged', 'sourceCommitUnchanged', 'inputsUnchanged']) assert.equal(previous[key], true);
    assert.deepEqual(receipt.previousFailedAttempt, { receipt: await input(PREVIOUS_ATTEMPT),
      failureStage: 'public_service_validation_before_runtime_factory', factoryCalls: 0, physicalReturns: 0,
      reason: previous.failures[0].message, priorArtifactsPreserved: true });
    report.previousFailedAttempt = receipt.previousFailedAttempt;
    assert.deepEqual(await nativeInventory(), receipt.nativeBefore);
    const manifest = JSON.parse(await readFile(resolve(ROOT, receipt.nativeManifest.path), 'utf8'));
    assert.deepEqual(manifest, receipt.nativeBefore);
    const fixture = JSON.parse(await readFile(resolve(ROOT, FIXTURE), 'utf8')); await input(FIXTURE, receipt.fixture);
    assert.equal(receipt.fixture.sha256, FIXTURE_SHA256, 'Expectations must come from the frozen independent corpus03');
    assert.equal(fixture.schema, 'logos-engine.v6.branch-routing-reference.v1'); assert.equal(fixture.referenceCommit, REFERENCE);
    assert.equal(fixture.sourceModified, false); assert.deepEqual(fixture.sourceFilesVerifiedBeforeAndAfter, [1786, 1786]);
    assert.equal(fixture.inputOrigin.kind, 'independently_constructed_contract_geometry'); assert.equal(fixture.inputOrigin.gameActionsDispatched, 0);
    assert.equal(fixture.inputOrigin.gamePayloadsInterpreted, 0);
    assert.equal(fixture.inputOrigin.nativeOracleAnswersInProduction, false);
    const reader = new Reader(fixture, receipt, report);
    for await (const row of records(capturePath)) await reader.accept(row);
    forms = reader.finish();
    assert.deepEqual(forms.map(item => item.id), receipt.sessions.map(item => item.id));
    report.status = 'qualified_synthetic_common_work_forms_and_graphs';
    report.nativeSource = receipt.nativeBefore; report.validatedSourceCommit = receipt.sourceCommit;
    report.scope = 'Five real NativeV6Runtime sessions and every retained graph delta were re-read independently. Native commands preserve missing data; actual authorizations, separately observed authorizationIdentity, current guards and measured packet labels are linked. inspectKnowledge is actual memory and close has no fabricated yield. Complete original event/state expectations come from the pinned independent corpus, with explicit reference transport and common point (6,13) distinct from manual component point (7,13). Common checkpoints, restores, WHY/ACT releases, prefix nodes, memory facts and returns are linked. Ablation and scheduling interruption remain labelled. The v1 64x64 service rejection before factory creation is retained. Public service validation, tickets and worker transport remain unqualified. No game result, full caller parity, cross-version graph equality, performance acceptance or publication is established.';
  } catch (error) { report.failures.push(failure(error)); }
  finally {
    report.inputsBefore = [...inputs.values()];
    try { for (const path of inputs.keys()) report.inputsAfter.push(await fingerprint(path));
      assert.deepEqual(report.inputsAfter, report.inputsBefore); report.inputsUnchanged = true;
      if (report.nativeSource) assert.deepEqual(await nativeInventory(), report.nativeSource);
    } catch (error) { report.status = 'failed'; report.failures.push(failure(error)); }
    report.finishedAt = new Date().toISOString();
    await writeFile(reviewPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    if (report.status === 'qualified_synthetic_common_work_forms_and_graphs') {
      await writeFile(formsPath, JSON.stringify({ schema: 'logos-engine.lot8b.branch-common-runtime-work-forms.v2', status: report.status,
        capture: report.capture, review: await fingerprint(reviewPath), nativeSource: report.nativeSource,
        entryBoundary: 'NativeV6Runtime', publicServiceQualified: false, publicWorkerQualified: false, publicTicketsQualified: false,
        nativeExecution: EXECUTION_DECLARATION, previousFailedAttempt: report.previousFailedAttempt,
        officialPerformanceEligible: false, wholeCallerParity: false, counts: report.counts, contribution: report.contribution, forms }, null, 2) + '\n', { flag: 'wx' });
    }
    console.log(JSON.stringify({ status: report.status, review: label(reviewPath), forms: report.status === 'qualified_synthetic_common_work_forms_and_graphs' ? label(formsPath) : null,
      counts: report.counts ?? null, failures: report.failures.length, officialPerformanceEligible: false }));
    if (report.status === 'failed') process.exitCode = 1;
  }
}
await main();
