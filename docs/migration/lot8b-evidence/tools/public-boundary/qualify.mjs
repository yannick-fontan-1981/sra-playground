#!/usr/bin/env node
/** Independent, offline reader of the public BranchRouting capture.
 * This file never creates a runtime, starts a worker, dispatches an action,
 * runs an oracle, or substitutes a source expectation for an observed graph.
 * Usage: node --experimental-strip-types qualify.mjs --capture DIR --output DIR
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { createGunzip } from 'node:zlib';
import { compareUnicode, digest } from '../../../../../src/logos-engine/canonical.ts';
import { decodeNativeState, NativeKnowledgeStore, NATIVE_STORE_PROFILE } from '../../../../../src/logos-engine/v6-knowledge-store.ts';
import { hydrateNativeState, isNativeStateGraph } from '../../../../../src/logos-engine/v6-native-state-graph.ts';
import { symbolicDigest } from '../../../../../src/logos-engine/v6-hash.ts';

const SELF = fileURLToPath(import.meta.url), ROOT = resolve(dirname(SELF), '../../../../..');
const OWNER = 'branch_routing', EPISODE = 'common-observation-frontier';
const REFERENCE = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e';
const NATIVE = { fileCount: 331, digest: 'c234bb404de43b380e5595cee8ad4ddfcae6e02d0fcc40286546fcf6838dd44a' };
const IMPLEMENTATION = 'logos-engine.typescript.v6.native-migration/0.67.0';
const BUNDLE = 'dist/assets/v6-agent-worker-XfSw5eyq.js';
const BUNDLE_SHA = '9c114f84e769879507618de08c9872020e8c65d33dc317dfe7ee959b6495a38f';
const FIXTURE = 'tests/fixtures/v6-branch-routing-reference.json';
const FIXTURE_SHA = 'e6ae197b7b982bd41f561b9df8e458436d7ce0797f39bbf86d972e55472b6769';
const CASES = ['single-positive', 'triple-prefix', 'contrary-return'];
const SINGLE = 'cold_four_calibrations_move_propagate_epoch', TRIPLE = 'cold_equal_cost_select_first_point_bind_move';
const CONTRARY = 'contrary_measured_move_revises_motion';
const COUNTS = [6, 7, 5], FIELDS = ['frame', 'frames', 'availableActionIds', 'state', 'level', 'levelsCompleted', 'stepIndex'];
const sha = value => createHash('sha256').update(value).digest('hex');
const jsonSha = value => sha(JSON.stringify(value));
const copy = value => structuredClone(value);
const command = value => ({ actionRef: value.actionRef ?? value.action_ref, data: value.data ?? {} });
const label = path => path.startsWith(ROOT + sep) ? relative(ROOT, path) : path;
const ref = (sessionId, packet) => `${sessionId}:epoch:${packet.level}:revision:${packet.stepIndex + 1}:frame:${jsonSha(packet.frame).slice(0, 16)}`;
const errorRecord = error => ({ name: error?.name ?? 'Error', message: String(error?.message ?? error), stack: error?.stack ?? null });

function argumentsFor(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 2) {
    assert.ok(['--capture', '--output'].includes(argv[i]), `Unknown argument ${argv[i]}`);
    assert.ok(argv[i + 1] && !argv[i + 1].startsWith('--'), `Missing value for ${argv[i]}`);
    assert.equal(result[argv[i].slice(2)], undefined, `Repeated ${argv[i]}`);
    result[argv[i].slice(2)] = resolve(argv[i + 1]);
  }
  assert.ok(result.capture && result.output, 'Both --capture DIR and --output DIR are required');
  assert.notEqual(result.capture, result.output, 'Keep qualification output separate from immutable capture inputs');
  return result;
}

async function fingerprint(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return { path: label(path), bytes: (await stat(path)).size, sha256: hash.digest('hex') };
}

async function nativeInventory() {
  const names = [];
  async function walk(path) {
    for (const item of await readdir(path, { withFileTypes: true })) {
      const next = resolve(path, item.name);
      if (item.isDirectory()) await walk(next);
      else if ((item.isFile() || item.isSymbolicLink() && (await stat(next)).isFile()) && /\.(ts|json|drm)$/.test(item.name)) names.push(relative(ROOT, next));
    }
  }
  for (const directory of ['src/logos-engine', 'src/runtime']) await walk(resolve(ROOT, directory));
  const files = {};
  for (const name of names.sort()) files[name] = sha(await readFile(resolve(ROOT, name)));
  return { fileCount: names.length, digest: sha(JSON.stringify(files)) };
}

async function verifyFingerprint(record) {
  assert.ok(record && typeof record.path === 'string' && /^[a-f0-9]{64}$/.test(record.sha256));
  const path = isAbsolute(record.path) ? resolve(record.path) : resolve(ROOT, record.path);
  assert.ok(path.startsWith(ROOT + sep), 'Pinned input must belong to the owned checkout');
  const actual = await fingerprint(path);
  assert.equal(actual.sha256, record.sha256, `Pinned input changed: ${record.path}`);
  if (record.bytes !== undefined) assert.equal(actual.bytes, record.bytes, `Pinned input size changed: ${record.path}`);
}

async function verifyFingerprintTree(value) {
  if (!value || typeof value !== 'object') return;
  if (!Array.isArray(value) && typeof value.path === 'string' && typeof value.sha256 === 'string') {
    await verifyFingerprint(value); return;
  }
  for (const child of Object.values(value)) await verifyFingerprintTree(child);
}

async function* records(path, integrity) {
  const source = createReadStream(path), stream = source.pipe(createGunzip()), decoder = new StringDecoder('utf8');
  const rawHash = createHash('sha256'); let rawBytes = 0;
  source.on('error', error => stream.destroy(error));
  let pending = '', ordinal = 0;
  const parse = line => {
    assert.ok(line, 'Empty capture row'); const row = JSON.parse(line);
    assert.equal(row.ordinal, ordinal++, 'Capture rows are missing or reordered');
    assert.equal(typeof row.type, 'string'); return row;
  };
  try {
    for await (const chunk of stream) {
      rawHash.update(chunk); rawBytes += chunk.length;
      pending += decoder.write(chunk); let end;
      while ((end = pending.indexOf('\n')) >= 0) { const line = pending.slice(0, end); pending = pending.slice(end + 1); yield parse(line); }
    }
    pending += decoder.end(); if (pending) yield parse(pending);
    Object.assign(integrity, { rawSha256: rawHash.digest('hex'), rawBytes, count: ordinal });
  } finally { source.destroy(); stream.destroy(); }
}

function publicPacket(value, expectedSequence) {
  assert.deepEqual(Object.keys(value).sort(), [...FIELDS].sort(), 'Only the seven public wire fields are allowed');
  const frame = rows => {
    assert.equal(rows.length, 64);
    for (const row of rows) {
      assert.ok(Array.isArray(row)); assert.equal(row.length, 64);
      assert.ok(row.every(pixel => Number.isInteger(pixel) && pixel >= 0 && pixel <= 15));
    }
  };
  frame(value.frame); assert.ok(Array.isArray(value.frames) && value.frames.length >= 1 && value.frames.length <= 1024);
  value.frames.forEach(frame); assert.deepEqual(value.frames.at(-1), value.frame);
  assert.ok(Array.isArray(value.availableActionIds) && value.availableActionIds.every(id => Number.isInteger(id) && id >= 1 && id <= 7));
  assert.equal(new Set(value.availableActionIds).size, value.availableActionIds.length);
  assert.ok(['NOT_FINISHED', 'WIN', 'GAME_OVER'].includes(value.state));
  assert.ok(Number.isSafeInteger(value.level) && value.level >= 1);
  assert.ok(Number.isSafeInteger(value.levelsCompleted) && value.levelsCompleted >= 0);
  assert.equal(value.stepIndex, expectedSequence);
}

function presentationContract(presentation, fixture) {
  assert.equal(presentation.schema, 'logos-engine.lot8b.public-branch-presentation.v1');
  assert.equal(presentation.status, 'unexecuted_presentation_contract');
  assert.equal(presentation.sourceFixture.sha256, FIXTURE_SHA);
  assert.equal(presentation.sourceFixture.referenceCommit, REFERENCE);
  assert.deepEqual(presentation.cases.map(item => item.id), CASES);
  assert.deepEqual(presentation.cases.map(item => item.expectedReturnCount), COUNTS);
  assert.deepEqual(presentation.publicBudgets, { targetLevels: 3, levelActionCaps: [24, 24, 24], maxActions: 72 });
  assert.equal(presentation.presentation.kind, 'top_left_anchored_zero_padding');
  assert.deepEqual(presentation.presentation.coordinateTranslation, [0, 0]);
  assert.equal(presentation.presentation.sourceLimit, 14); assert.equal(presentation.presentation.publicLimit, 32);
  assert.equal(presentation.presentation.completeModelIdentityPreserved, false);
  assert.equal(presentation.presentation.fullSearchDomainIdentityPreserved, false);
  assert.equal(presentation.qualification.officialPerformanceEligible, false);
  assert.equal(presentation.qualification.acquiredStateInjected, false);
  const pad = rows => Array.from({ length: 64 }, (_, y) => Array.from({ length: 64 }, (_, x) => rows[y]?.[x] ?? 0));
  for (const [key, value] of Object.entries(presentation.frames)) {
    const original = fixture.frames[key]; assert.ok(original);
    const input = original.public, actual = value.observation;
    publicPacket(actual, input.step_index);
    assert.deepEqual(actual.frame, pad(input.frame_rows));
    assert.deepEqual(actual.frames, input.frame_packet.map(pad));
    assert.deepEqual(actual.availableActionIds, input.available_action_refs.map(id => Number(id.slice(6))));
    assert.deepEqual([actual.state, actual.level, actual.levelsCompleted], [input.state, input.level, input.levels_completed]);
    assert.equal(value.sourceObservationRef, original.observation.observation_ref);
    assert.equal(value.sourceFrameSha256, jsonSha(input.frame_rows));
    assert.equal(value.frameSha256, jsonSha(actual.frame)); assert.equal(value.frameHash, value.frameSha256.slice(0, 16));
    assert.equal(value.animationSha256, jsonSha(actual.frames)); assert.equal(value.observationSha256, jsonSha(actual));
  }
  for (const plan of presentation.cases) {
    assert.equal(plan.coldStartRequired, true); assert.equal(plan.steps.length, plan.expectedReturnCount);
    assert.deepEqual(plan.initial, presentation.frames[plan.initialFrameKey].observation); publicPacket(plan.initial, 0);
    assert.equal(plan.initial.level, 1); assert.equal(plan.initial.levelsCompleted, 0);
    let acquired = 0;
    const sourceRecords = id => {
      const scenario = fixture.scenarios.find(item => item.id === id); assert.ok(scenario);
      let proposeStep = null;
      return scenario.steps.flatMap((item, index) => {
        if (item.operation === 'propose') proposeStep = index;
        return item.operation === 'record' ? [{ scenarioId: id, recordStep: index, proposeStep }] : [];
      });
    };
    const expectedRecords = plan.id === 'single-positive' ? sourceRecords(SINGLE) : plan.id === 'triple-prefix'
      ? sourceRecords(TRIPLE) : [...sourceRecords(SINGLE).slice(0, 4), ...sourceRecords(CONTRARY)];
    assert.deepEqual(plan.steps.map(item => ({ scenarioId: item.source.scenarioId, recordStep: item.source.recordStep,
      proposeStep: item.source.proposeStep })), expectedRecords);
    for (const [index, step] of plan.steps.entries()) {
      assert.equal(step.sequence, index + 1); publicPacket(step.observation, index + 1);
      assert.deepEqual(step.observation, presentation.frames[step.afterFrameKey].observation);
      assert.deepEqual(index ? plan.steps[index - 1].observation : plan.initial, presentation.frames[step.beforeFrameKey].observation);
      const source = fixture.scenarios.find(row => row.id === step.source.scenarioId); assert.ok(source);
      const record = source.steps[step.source.recordStep], proposal = source.steps[step.source.proposeStep].result;
      const sourceStep = proposal.steps[step.source.actionIndex];
      assert.equal(record.operation, 'record'); assert.equal(record.before, step.beforeFrameKey); assert.equal(record.after, step.afterFrameKey);
      assert.equal(step.source.actionIndex, record.index ?? 0); assert.equal(step.expectedMode, sourceStep.mode);
      assert.deepEqual(step.source.command, proposal.actions[step.source.actionIndex]);
      assert.deepEqual(step.sourceExpected.proposalStep, sourceStep); assert.deepEqual(step.sourceExpected.recordEvent, record.result);
      for (const key of ['epoch', 'motion', 'verified', 'current', 'finished', 'passed']) assert.deepEqual(step.sourceExpected.afterRecord[key], record.afterState[key]);
      assert.equal(step.sourceExpected.afterRecord.eventCount, record.afterState.events.length);
      const expected = sourceStep.mode === 'select' ? { actionRef: 'ACTION6', data: {
        x: Math.floor((sourceStep.box[0] + sourceStep.box[2]) / 2), y: Math.floor((sourceStep.box[1] + sourceStep.box[3]) / 2),
      } } : command(proposal.actions[step.source.actionIndex]);
      assert.deepEqual(step.expectedCommand, expected);
      assert.equal(step.prefix.actionIndex, step.source.actionIndex); assert.equal(step.prefix.length, proposal.actions.length);
      const after = source.steps.slice(step.source.proposeStep + 1, step.source.recordStep).findLast(row => row.operation === 'after'
        && row.before === record.before && row.after === record.after && (row.index ?? 0) === step.source.actionIndex);
      const seal = after?.result.seal_prefix ?? step.source.actionIndex + 1 === proposal.actions.length;
      assert.equal(step.prefix.sealAfterReturn, seal); if (seal) acquired = index + 1;
      assert.equal(step.prefix.acquiredRecordCountAfterReturn, acquired);
    }
    assert.equal(acquired, plan.steps.length);
    const last = plan.steps.at(-1), finalSource = fixture.scenarios.find(item => item.id === last.source.scenarioId);
    const finalIndex = finalSource.steps.findIndex((item, index) => index > last.source.recordStep
      && item.operation === 'propose' && item.frame === last.afterFrameKey); assert.ok(finalIndex >= 0);
    const finalProposal = finalSource.steps[finalIndex].result;
    assert.equal(plan.sourceTerminalProposal.returnedNull, finalProposal === null);
    if (finalProposal === null) assert.equal(plan.finalQuestion, null);
    else {
      assert.ok(plan.finalQuestion); assert.equal(plan.finalQuestion.expectedOnly, true); assert.equal(plan.finalQuestion.executeInThisCase, false);
      assert.equal(plan.finalQuestion.expectedMode, finalProposal.steps[0].mode);
      const step = finalProposal.steps[0];
      const expected = step.mode === 'select' ? { actionRef: 'ACTION6', data: {
        x: Math.floor((step.box[0] + step.box[2]) / 2), y: Math.floor((step.box[1] + step.box[3]) / 2),
      } } : command(finalProposal.actions[0]);
      assert.deepEqual(plan.finalQuestion.expectedCommand, expected);
    }
  }
}

function valueOf(state, id) {
  const node = typeof id === 'string' ? state.nodes[id] : id; assert.ok(node, `Missing graph node ${id}`);
  const cached = state.values.get(node.id);
  if (cached?.revision === node.revision) return cached.value;
  const value = isNativeStateGraph(node.value) ? hydrateNativeState(node.value, fragmentId => {
    const fragment = state.nodes[fragmentId]; assert.equal(fragment?.kind, 'state_fragment'); assert.equal(fragment.scope, node.scope);
    return fragment.value;
  }) : decodeNativeState(node.value);
  state.values.set(node.id, { revision: node.revision, value }); return value;
}

function facts(state, key) {
  const memory = valueOf(state, 'reasoning:memory');
  return memory.facts.map(id => {
    const node = state.nodes[id]; assert.equal(node?.component, 'native_reasoning_fact');
    assert.ok(node.relations.some(item => item.relation === 'retained_by' && item.target === 'reasoning:memory'));
    return { node, value: valueOf(state, node) };
  }).filter(item => item.value.episode === EPISODE && (key === undefined || item.value.key === key));
}

class Reader {
  constructor(presentation, report) {
    this.presentation = presentation; this.report = report; this.current = null; this.finished = [];
    this.header = null; this.transportRecords = 0; this.lastOrdinal = -1; this.rpcTotals = { requests: 0, responses: 0, successes: 0, errors: 0 };
    this.prepared = new Map(); this.workers = new Map(); this.transportSequences = new Map();
  }
  async checked(name, body, details = {}) {
    try { await body(); this.report.assertions.push({ name, ...details, passed: true }); }
    catch (error) { this.report.assertions.push({ name, ...details, passed: false }); throw error; }
  }
  start(row) {
    assert.equal(this.current, null); const plan = this.presentation.cases[this.finished.length]; assert.ok(plan);
    assert.equal(row.caseId, plan.id); assert.deepEqual(row.initial, plan.initial); assert.deepEqual(row.stepPlan, plan.steps);
    this.current = { id: plan.id, plan, sessionId: row.sessionId ?? null, nodes: {}, deltas: [], chain: null, values: new Map(),
      inspections: new Map(), pending: new Map(), rpc: [], dispatched: [], usedTickets: new Set(), ticketReleases: new Map(),
      protocols: [], pauses: [], controllerStates: [], sourceDigest: null, workerIds: new Set(), initCount: 0,
      lastInspection: null, sequence: 0, positiveAdvanceCount: 0, inspectionCount: 0, authorizations: [], forms: [] };
  }
  async graph(state, result) {
    const graph = result.knowledge, snapshot = result.snapshot;
    assert.ok(graph && graph.nodes && Array.isArray(graph.deltas));
    if (!state.kernel) {
      state.sourceDigest = snapshot.sourceDigest; assert.match(state.sourceDigest, /^[a-f0-9]{64}$/);
      state.kernel = new NativeKnowledgeStore(state.sourceDigest, state.sessionId).kernel;
    }
    assert.equal(snapshot.sourceCommit, REFERENCE); assert.equal(snapshot.sourceDigest, state.sourceDigest);
    assert.equal(snapshot.implementation, IMPLEMENTATION); assert.equal(snapshot.knowledgeProfile, NATIVE_STORE_PROFILE);
    assert.ok(graph.deltas.length >= state.deltas.length, 'An inspection truncated prior graph history');
    for (let i = 0; i < state.deltas.length; i++) assert.deepEqual(graph.deltas[i], state.deltas[i], 'A historical delta changed');
    const previousRevision = state.deltas.length;
    for (const delta of graph.deltas.slice(previousRevision)) {
      assert.deepEqual(Object.keys(delta).sort(), ['cause', 'digest', 'node', 'previous', 'sequence', 'source_digest']);
      assert.equal(delta.sequence, state.deltas.length + 1); assert.equal(delta.previous, state.chain); assert.equal(delta.source_digest, state.sourceDigest);
      state.kernel.validateNode(delta.node); assert.equal(delta.node.scope, state.sessionId);
      assert.equal(delta.node.origin.source_digest, state.sourceDigest); assert.equal(delta.node.origin.store_profile, NATIVE_STORE_PROFILE);
      if (delta.node.kind === 'state_fragment') assert.equal(delta.node.id, `state_fragment:${symbolicDigest(delta.node.value, false)}`);
      const previous = state.nodes[delta.node.id]; assert.equal(delta.node.revision, (previous?.revision ?? 0) + 1);
      if (previous) {
        assert.equal(delta.node.kind, previous.kind); assert.deepEqual(delta.node.origin, previous.origin);
        assert.equal(isDeepStrictEqual({ ...delta.node, revision: previous.revision }, previous), false, 'No-op delta');
      }
      assert.equal(await digest({ sequence: delta.sequence, previous: delta.previous, node: delta.node,
        cause: delta.cause, source_digest: delta.source_digest }), delta.digest);
      state.nodes[delta.node.id] = delta.node; state.deltas.push(delta); state.chain = delta.digest;
    }
    assert.deepEqual(graph.nodes, state.nodes, 'Materialized nodes differ from the replayed actual deltas');
    assert.equal(graph.chain, state.chain); assert.equal(snapshot.graphChain, state.chain);
    assert.equal(snapshot.graphRevision, state.deltas.length); assert.equal(snapshot.nodeCount, Object.keys(state.nodes).length);
    state.values.clear();
    // Validate every currently reachable typed value and every referenced fragment.
    for (const node of Object.values(state.nodes)) if (node.kind !== 'state_fragment') valueOf(state, node);
    const executable = Object.values(state.nodes).filter(node => ['program', 'family_activation'].includes(node.kind))
      .sort((a, b) => compareUnicode(a.id, b.id)).map(node => ({ id: node.id, value: node.value }));
    assert.equal(await digest({ profile: NATIVE_STORE_PROFILE, source_digest: state.sourceDigest, nodes: executable }), snapshot.nativeExecutionDigest);
    assert.ok(state.nodes['program:v6.composition_strategy.choose']); assert.ok(state.nodes['program:prototype.laya_router.route']);
    assert.equal(valueOf(state, `family_activation:${OWNER}`).enabled, true);
    assert.equal(state.nodes[`family_state:${OWNER}`].family, OWNER);
    return { from: previousRevision, to: state.deltas.length };
  }
  authorization(state, result, packet, expected = null) {
    assert.equal(result.ok, true); assert.equal(result.sessionId, state.sessionId);
    if (result.kind !== 'action') {
      assert.ok(['boundary', 'stopped'].includes(result.kind));
      assert.equal(result.phase, result.kind === 'boundary' ? 'sealed_prefix' : 'stopped');
      assert.equal(result.command, null); assert.equal(result.ticket, null); return;
    }
    assert.equal(result.phase, 'authorised_not_executed'); const { ticket, snapshot } = result;
    assert.ok(ticket && result.command); assert.equal(ticket.sessionId, state.sessionId);
    assert.match(ticket.id, new RegExp(`^${state.sessionId}:native:[1-9][0-9]*$`));
    assert.equal(ticket.sourceDigest, snapshot.sourceDigest); assert.equal(ticket.graphChain, snapshot.graphChain);
    assert.equal(ticket.nativeExecutionDigest, snapshot.nativeExecutionDigest);
    assert.equal(ticket.frameHash, jsonSha(packet.frame).slice(0, 16)); assert.equal(ticket.observationRef, ref(state.sessionId, packet));
    assert.equal(ticket.level, packet.level); assert.equal(ticket.levelsCompleted, packet.levelsCompleted);
    assert.ok(Number.isSafeInteger(ticket.decisionRevision) && ticket.decisionRevision >= 1);
    assert.ok(Number.isSafeInteger(ticket.actionIndex) && ticket.actionIndex >= 0);
    assert.deepEqual(command(ticket), result.command); assert.ok(packet.availableActionIds.includes(Number(ticket.actionRef.slice(6))));
    const proposal = snapshot.proposal; assert.ok(proposal);
    assert.deepEqual(result.command, command(proposal.actions[ticket.actionIndex]));
    if (expected) {
      assert.equal(snapshot.lastDecision, OWNER); assert.equal(proposal.kind, 'parallel_branch_routing');
      assert.equal(proposal.material_access_subquestion, 'parallel_branch_routing');
      assert.equal(proposal.strategy_receipt.selected, 'factored_material_return'); assert.equal(proposal.bundle_template.operation_key, 'OP18');
      assert.deepEqual(result.command, expected.expectedCommand); assert.equal(proposal.steps[ticket.actionIndex].mode, expected.expectedMode);
      if (expected.prefix) { assert.equal(ticket.actionIndex, expected.prefix.actionIndex); assert.equal(proposal.actions.length, expected.prefix.length); }
      const guard = snapshot.trace.findLast(item => item.kind === 'before_guard' && item.family === OWNER && item.index === ticket.actionIndex);
      assert.ok(guard); assert.equal(guard.admitted, true); assert.equal(guard.point_bound, true);
      assert.equal(snapshot.whyAct.enabled, true); assert.equal(snapshot.whyAct.decision.decision.status, 'action_set_released');
      assert.deepEqual(snapshot.whyAct.decision.decision.action_set.actions, proposal.actions);
      const current = facts(state, 'state'); assert.equal(current.length, 1);
      assert.equal(current[0].value.value.bundles[0].composition_ref, proposal.bundle_template.composition_ref);
      assert.deepEqual(current[0].value.value.bundles[0].actions, proposal.actions);
      const predictionId = `reasoning:prediction:${ticket.decisionRevision}`, prediction = valueOf(state, predictionId);
      assert.equal(prediction.before_observation_ref, proposal.binding.observation_ref);
      if (ticket.actionIndex === 0) assert.equal(proposal.binding.observation_ref, ticket.observationRef);
      assert.equal(state.nodes[predictionId].component, 'prospective_predictions');
    }
    const prior = state.ticketReleases.get(ticket.id);
    if (prior) assert.deepEqual(prior, ticket, 'The same ticket changed its authority');
    else state.ticketReleases.set(ticket.id, copy(ticket));
    assert.equal(state.usedTickets.has(ticket.id), false, 'A consumed ticket was reissued');
  }
  acquisition(state, result, sequence) {
    const expectedCount = sequence ? state.plan.steps[sequence - 1].prefix.acquiredRecordCountAfterReturn : 0;
    const owner = valueOf(state, `family_state:${OWNER}`), snapshot = result.snapshot;
    assert.equal(owner.format, 'native.branch_routing.v1'); assert.equal(owner.events.length, expectedCount);
    assert.equal(snapshot.caller.enabled, true); assert.equal(snapshot.caller.acquiredTransitions, expectedCount);
    assert.equal(snapshot.coverage.fullV6Parity, false);
    if (owner.model) { assert.equal(owner.model.limit, 32); assert.equal(owner.model.unit, state.plan.sourceModel.unit); }
    const branchFacts = facts(state).filter(item => item.value.key.startsWith('branches:'));
    assert.equal(branchFacts.length, expectedCount);
    const mapping = new Map();
    for (let i = 0; i <= sequence; i++) {
      const frameKey = i ? state.plan.steps[i - 1].afterFrameKey : state.plan.initialFrameKey;
      const packet = i ? state.plan.steps[i - 1].observation : state.plan.initial;
      mapping.set(this.presentation.frames[frameKey].sourceObservationRef, ref(state.sessionId, packet));
    }
    const rebound = value => {
      if (typeof value === 'string' && value.startsWith('O_synthetic_branches_')) { assert.ok(mapping.has(value), `Unwitnessed source reference ${value}`); return mapping.get(value); }
      if (Array.isArray(value)) return value.map(rebound);
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rebound(item)]));
      return value;
    };
    assert.deepEqual(owner.events, state.plan.steps.slice(0, expectedCount).map(step => rebound(step.sourceExpected.recordEvent)));
    if (expectedCount === 0) { assert.deepEqual(owner.motion, {}); assert.deepEqual(owner.verified, []); }
    if (expectedCount) {
      const expected = state.plan.steps[expectedCount - 1].sourceExpected.afterRecord;
      for (const key of ['epoch', 'motion', 'verified', 'current', 'finished', 'passed']) assert.deepEqual(owner[key], rebound(expected[key]), `${state.id}: acquired ${key}`);
    }
    for (let index = 0; index < expectedCount; index++) {
      const returned = state.dispatched[index]; assert.ok(returned, 'Acquired evidence requires an observed public dispatch');
      const beforeRef = ref(state.sessionId, returned.publicBefore), afterRef = ref(state.sessionId, returned.publicAfter);
      const fact = facts(state, `branches:${index + 1}`); assert.equal(fact.length, 1);
      assert.deepEqual(fact[0].value.value, owner.events[index]); assert.equal(fact[0].value.evidence, afterRef); assert.equal(fact[0].value.revision, index + 2);
      const transitionId = `reasoning:transition:${index + 1}`, transition = valueOf(state, transitionId);
      assert.equal(state.nodes[transitionId].component, 'public_transition');
      assert.deepEqual([transition.before, transition.after, command(transition.command)], [beforeRef, afterRef, returned.expectedCommand]);
      const evidenceId = `prefix_evidence:${returned.ticket.decisionRevision}`, evidence = valueOf(state, evidenceId), evidenceNode = state.nodes[evidenceId];
      assert.equal(evidenceNode.family, OWNER); assert.equal(evidence.decision_revision, returned.ticket.decisionRevision);
      assert.equal(evidence.proposal.material_access_subquestion, 'parallel_branch_routing');
      assert.ok(evidenceNode.relations.some(item => item.relation === 'records' && item.target === `family_state:${OWNER}`));
      assert.ok(evidenceNode.relations.some(item => item.relation === 'selected_by' && item.target === 'program:v6.composition_strategy.choose'));
      const witnessed = evidence.transitions.filter(item => item.before === beforeRef && item.after === afterRef); assert.equal(witnessed.length, 1);
      assert.deepEqual(command(witnessed[0].command), returned.expectedCommand);
      const expected = state.plan.steps[index].sourceExpected.guards.after;
      if (expected) assert.deepEqual(witnessed[0].outcome, expected);
      else assert.deepEqual(witnessed[0].outcome, { matched: null, seal_prefix: true, reason: 'compare_observed_contributor_pose' });
      assert.equal(evidence.native_acquisitions_incomplete, undefined);
    }
    for (let index = expectedCount; index < sequence; index++) {
      assert.equal(facts(state, `branches:${index + 1}`).length, 0);
      assert.equal(state.nodes[`reasoning:transition:${index + 1}`], undefined);
      const returned = state.dispatched[index]; assert.ok(returned);
      assert.equal(state.nodes[`prefix_evidence:${returned.ticket.decisionRevision}`], undefined);
    }
    return { acquired: expectedCount, ownerEventCount: owner.events.length, ownerRevision: state.nodes[`family_state:${OWNER}`].revision,
      motion: owner.motion, current: owner.current, finished: owner.finished, publicModelLimit: owner.model?.limit ?? null };
  }
  async transport(row) {
    const record = row.record; assert.ok(record && typeof record.kind === 'string'); this.transportRecords++;
    if (record.schema) {
      assert.equal(record.schema, 'logos-engine.lot8b.public-worker-capture-event.v1');
      assert.equal(record.sequence, (this.transportSequences.get(row.caseId) ?? 0) + 1); this.transportSequences.set(row.caseId, record.sequence);
    } else assert.ok(['controller_dispose', 'controller_reset'].includes(record.kind));
    assert.notEqual(record.kind, 'controller_reset', 'The capture must preserve the native coroutine without resetting it');
    if (['worker_environment_error', 'worker_error', 'worker_messageerror', 'worker_startup_timeout', 'worker_adapter_listener_error'].includes(record.kind)) throw new Error(`Worker environment failure: ${JSON.stringify(record)}`);
    if (record.kind === 'transport_prepared') {
      assert.equal(this.prepared.has(row.caseId), false); assert.ok(CASES.includes(row.caseId)); assert.equal(record.pins.nativeDigest, NATIVE.digest);
      assert.equal(record.pins.bundle.path, BUNDLE); assert.equal(record.pins.bundle.sha256, BUNDLE_SHA);
      assert.equal(record.workerStarted, false); assert.equal(record.nativeRuntimeStarted, false);
      await verifyFingerprintTree(record.pins);
      const manifest = JSON.parse(await readFile(resolve(ROOT, record.pins.manifest.path), 'utf8'));
      assert.equal(manifest.nativeDigest, NATIVE.digest); assert.equal(manifest.worker.path, BUNDLE); assert.equal(manifest.worker.sha256, BUNDLE_SHA);
      for (const pin of [record.pins.bundle, ...record.pins.assets]) {
        const declared = manifest.files.find(item => item.path === pin.path); assert.ok(declared);
        assert.deepEqual([pin.bytes, pin.sha256], [declared.bytes, declared.sha256]);
      }
      this.prepared.set(row.caseId, record);
    }
    const prepared = this.prepared.get(row.caseId), workerKey = `${row.caseId}:${record.worker}`;
    if (record.kind === 'worker_ready') {
      assert.ok(prepared); assert.equal(this.workers.has(workerKey), false);
      assert.equal(record.workerEntrypointUnmodified, true); assert.equal(record.runtimeOrServiceFactorySubstituted, false);
      assert.equal(record.listenerCount, 1); assert.ok(Number.isSafeInteger(record.threadId) && record.threadId > 0);
      assert.deepEqual(record.bundle, prepared.pins.bundle); assert.deepEqual(record.bootstrap, prepared.pins.bootstrap);
      this.workers.set(workerKey, { caseId: row.caseId, threadId: record.threadId, fetches: [], terminated: false, exited: false });
    }
    if (record.kind === 'worker_fetch') {
      const worker = this.workers.get(workerKey); assert.ok(worker);
      assert.equal(record.allowed, true); assert.equal(record.verified, true); assert.equal(record.method, 'GET');
      const asset = prepared.pins.assets.find(item => item.url === record.url); assert.ok(asset);
      assert.deepEqual(record.input, { path: asset.path, bytes: asset.bytes, sha256: asset.sha256 }); worker.fetches.push(record.url);
    }
    if (record.kind === 'worker_exit') {
      const worker = this.workers.get(workerKey); assert.ok(worker); assert.equal(record.terminationRequested, true); worker.exited = true;
    }
    if (record.kind === 'worker_termination_acknowledged') {
      const worker = this.workers.get(workerKey); assert.ok(worker); worker.terminated = true;
    }
    if (!['rpc_request', 'rpc_response'].includes(record.kind)) return;
    const state = this.current; assert.ok(state, 'RPC outside a recorded session'); assert.equal(row.caseId, state.id);
    const envelope = record.envelope; assert.ok(Number.isSafeInteger(envelope.id) && envelope.id >= 1);
    state.workerIds.add(workerKey); const key = `${record.worker}:${envelope.id}`;
    if (record.kind === 'rpc_request') {
      assert.equal(state.pending.has(key), false); assert.equal(state.rpc.some(item => item.key === key), false);
      const operation = envelope.operation; assert.ok(operation);
      if (!state.sessionId) { assert.equal(operation.type, 'init'); state.sessionId = operation.sessionId; }
      if (operation.type === 'init') {
        assert.equal(operation.sessionId, state.sessionId);
        state.initCount++; assert.equal(state.initCount, 1); assert.equal(operation.sequence, 0);
        assert.deepEqual(operation.observation, state.plan.initial); assert.deepEqual(operation.budgets, this.presentation.publicBudgets);
      }
      assert.ok(['init', 'advance', 'resume', 'inspect', 'snapshot', 'close'].includes(operation.type), 'No hidden edit or restore request');
      state.pending.set(key, { key, operation, requestOrdinal: row.ordinal }); this.rpcTotals.requests++;
    } else {
      const pending = state.pending.get(key); assert.ok(pending, 'Response without an observed request'); state.pending.delete(key);
      assert.equal(envelope.sessionId, pending.operation.sessionId); assert.equal(envelope.sequence, pending.operation.sequence);
      const item = { ...pending, responseOrdinal: row.ordinal, resultDigest: envelope.result ? jsonSha(envelope.result) : null,
        error: envelope.error ?? null, result: envelope.result ? { ...envelope.result, knowledge: undefined } : null };
      state.rpc.push(item); this.rpcTotals.responses++;
      if (envelope.error) this.rpcTotals.errors++;
      else {
        this.rpcTotals.successes++; assert.equal(envelope.result?.ok, true); assert.equal(envelope.result.sessionId, state.sessionId);
        if (pending.operation.type === 'advance') {
          const index = state.positiveAdvanceCount, returned = state.dispatched[index]; assert.ok(returned, 'Successful advance without a dispatched return');
          assert.equal(pending.operation.sequence, index + 1); assert.equal(pending.operation.ticketId, returned.ticket.id);
          assert.deepEqual(pending.operation.observation, returned.publicAfter); assert.equal(pending.operation.executionMs, returned.executionMs);
          assert.equal(envelope.result.snapshot.actions, index + 1); state.positiveAdvanceCount++;
        }
      }
    }
  }
  async inspection(row) {
    const state = this.current; assert.ok(state); assert.equal(row.caseId, state.id); assert.equal(row.sessionId, state.sessionId);
    assert.equal(state.inspections.has(row.label), false, 'Inspection labels must be unique');
    assert.ok(row.label.startsWith(`${state.id}/`)); const localLabel = row.label.slice(state.id.length + 1);
    assert.equal(state.inspections.has(localLabel), false);
    const result = row.result, sequence = row.sequence; assert.ok(Number.isSafeInteger(sequence) && sequence >= 0 && sequence <= state.plan.steps.length);
    assert.equal(sequence, state.positiveAdvanceCount); assert.equal(result.sessionId, state.sessionId); assert.equal(result.snapshot.actions, sequence);
    assert.deepEqual(row.counts, { dispatches: state.dispatched.length, advances: state.positiveAdvanceCount, inits: state.initCount, resets: 0 });
    assert.equal(result.snapshot.levelsCompleted, 0); assert.equal(result.snapshot.level, 1);
    const resultDigest = jsonSha(result);
    const rpc = state.rpc.findLast(item => item.operation.type === 'inspect' && item.operation.sequence === sequence && item.resultDigest === resultDigest);
    assert.ok(rpc && rpc.responseOrdinal < row.ordinal, 'Inspection must match a complete real RPC response');
    const graph = await this.graph(state, result), packet = sequence ? state.plan.steps[sequence - 1].observation : state.plan.initial;
    const next = sequence < state.plan.steps.length ? state.plan.steps[sequence] : state.plan.finalQuestion;
    this.authorization(state, result, packet, result.kind === 'action' ? next : null);
    const acquired = this.acquisition(state, result, sequence);
    const compact = { label: row.label, ordinal: row.ordinal, sequence, resultDigest, graphChain: result.snapshot.graphChain,
      graphRevision: result.snapshot.graphRevision, nativeExecutionDigest: result.snapshot.nativeExecutionDigest, ticket: copy(result.ticket),
      command: copy(result.command), kind: result.kind, phase: result.phase, snapshot: result.snapshot, ...acquired };
    state.inspections.set(row.label, compact); state.inspections.set(localLabel, compact);
    state.lastInspection = compact; state.inspectionCount++; state.sequence = sequence;
    state.forms.push({ label: row.label, sequence, kind: result.kind, family: result.snapshot.lastDecision,
      mode: result.kind === 'action' ? result.snapshot.proposal.steps[result.ticket.actionIndex].mode : null,
      graphFrom: graph.from, graphTo: graph.to, nodeCount: result.snapshot.nodeCount, ...acquired });
    if (localLabel === 'initial_authorization') { assert.equal(sequence, 0); assert.equal(result.kind, 'action'); }
    if (localLabel.startsWith('before_return_')) {
      const n = Number(localLabel.slice('before_return_'.length)); assert.equal(sequence, n - 1); assert.equal(result.kind, 'action');
    }
    if (localLabel.startsWith('after_return_')) {
      assert.equal(sequence, Number(localLabel.slice('after_return_'.length)));
      const step = state.plan.steps[sequence - 1];
      const outcome = result.snapshot.trace.findLast(item => item.kind === 'actual_outcome' && item.family === OWNER
        && item.index === step.prefix.actionIndex && item.observation_ref === ref(state.sessionId, packet));
      assert.ok(outcome, 'Every returned public packet must have its actual after-guard trace');
      const expected = step.sourceExpected.guards.after ?? { matched: null, seal_prefix: true, reason: 'compare_observed_contributor_pose' };
      for (const [key, value] of Object.entries(expected)) assert.deepEqual(outcome[key], value);
    }
    if (localLabel === 'final_question') {
      assert.equal(sequence, state.plan.steps.length);
      if (state.plan.finalQuestion) { assert.equal(result.kind, 'action'); assert.deepEqual(result.command, state.plan.finalQuestion.expectedCommand); }
      else assert.equal(acquired.finished, true, 'The completed BranchRouting owner remains finished; other owners are outside this claim');
    }
  }
  dispatch(row) {
    const state = this.current; assert.ok(state); assert.equal(row.caseId, state.id);
    const index = state.dispatched.length, step = state.plan.steps[index]; assert.ok(step, 'No final question or unobserved extra action may be dispatched');
    assert.equal(row.stepIndex, index + 1); assert.equal(state.positiveAdvanceCount, index);
    const before = state.inspections.get(`before_return_${index + 1}`); assert.ok(before && before.ordinal < row.ordinal);
    assert.equal(before.sequence, index); assert.equal(before.kind, 'action'); assert.deepEqual(row.ticket, before.ticket);
    assert.deepEqual(row.expectedCommand, step.expectedCommand); assert.deepEqual(before.command, row.expectedCommand);
    assert.deepEqual(command({ actionRef: `ACTION${row.action.id}`, data: row.action.data }), row.expectedCommand);
    publicPacket(row.publicBefore, index); publicPacket(row.publicAfter, index + 1);
    assert.deepEqual(row.publicBefore, index ? state.plan.steps[index - 1].observation : state.plan.initial);
    assert.deepEqual(row.publicAfter, step.observation); assert.ok(Number.isFinite(row.executionMs) && row.executionMs >= 0);
    assert.equal(state.usedTickets.has(row.ticket.id), false); state.usedTickets.add(row.ticket.id);
    state.dispatched.push(row);
  }
  protocol(row) {
    const state = this.current; assert.ok(state); assert.equal(row.caseId, state.id);
    const before = state.inspections.get(row.beforeLabel), after = state.inspections.get(row.afterLabel);
    assert.ok(before && after); assert.ok(before.ordinal < after.ordinal && after.ordinal < row.ordinal);
    assert.equal(before.sequence, after.sequence); assert.equal(before.graphChain, after.graphChain);
    assert.equal(before.graphRevision, after.graphRevision); assert.equal(before.nativeExecutionDigest, after.nativeExecutionDigest);
    assert.deepEqual(before.ticket, after.ticket); assert.deepEqual(before.command, after.command);
    const rpc = state.rpc.findLast(item => item.requestOrdinal > before.ordinal && item.responseOrdinal < after.ordinal
      && isDeepStrictEqual(item.operation, row.operation) && item.error);
    assert.ok(rpc, 'Negative protocol check must retain the actual rejected RPC'); assert.deepEqual(row.error, rpc.error);
    assert.ok(['stale', 'invalid'].includes(row.error.code)); assert.equal(row.preserved, true);
    assert.equal(row.operation.type, 'advance');
    if (row.name === 'wrong_ticket') { assert.notEqual(row.operation.ticketId, before.ticket.id); assert.equal(row.error.code, 'stale'); }
    else if (row.name === 'wrong_session') { assert.notEqual(row.operation.sessionId, state.sessionId); assert.equal(row.error.code, 'stale'); }
    else if (row.name === 'wrong_sequence') { assert.notEqual(row.operation.sequence, before.sequence + 1); assert.equal(row.error.code, 'stale'); }
    else if (row.name === 'step_index_mismatch') assert.notEqual(row.operation.observation.stepIndex, row.operation.sequence);
    else if (row.name === 'invalid_frame_dimensions') assert.ok(row.operation.observation.frame.length !== 64
      || row.operation.observation.frame.some(line => line.length !== 64));
    else if (row.name === 'invalid_palette') assert.ok(row.operation.observation.frame.some(line => line.some(pixel => !Number.isInteger(pixel) || pixel < 0 || pixel > 15)));
    else if (row.name === 'inconsistent_animation') assert.notDeepEqual(row.operation.observation.frames.at(-1), row.operation.observation.frame);
    else if (row.name === 'negative_execution_duration') assert.ok(row.operation.executionMs < 0);
    else if (row.name === 'consumed_ticket') {
      assert.equal(state.usedTickets.has(row.operation.ticketId), true); assert.notEqual(row.operation.ticketId, before.ticket.id);
      assert.equal(row.operation.sequence, before.sequence + 1); assert.equal(row.error.code, 'stale');
    } else throw new Error(`Unexpected negative-protocol case ${row.name}`);
    if (row.resumeResult) {
      const resumed = state.rpc.findLast(item => item.operation.type === 'resume' && item.resultDigest === jsonSha(row.resumeResult)); assert.ok(resumed);
      assert.deepEqual(row.resumeResult.ticket, after.ticket); assert.deepEqual(row.resumeResult.command, after.command);
      assert.equal(row.resumeResult.snapshot.graphChain, after.graphChain); assert.equal(row.resumeResult.snapshot.actions, after.sequence);
    }
    state.protocols.push({ name: row.name, sequence: after.sequence, code: row.error.code, operation: row.operation.type, preserved: true });
  }
  pause(row) {
    const state = this.current; assert.ok(state); assert.equal(row.caseId, state.id);
    assert.ok(['before_first_dispatch', 'during_dispatch'].includes(row.name)); assert.equal(row.preserved, true);
    const before = state.inspections.get(row.beforeLabel), after = state.inspections.get(row.afterLabel);
    assert.ok(before && after); assert.ok(before.ordinal <= after.ordinal && after.ordinal < row.ordinal);
    assert.deepEqual(row.ticketBefore, before.ticket); assert.deepEqual(row.ticketAfter, after.ticket);
    const countsAt = inspection => ({
      dispatches: state.dispatched.filter(item => item.ordinal < inspection.ordinal).length,
      advances: state.rpc.filter(item => item.operation.type === 'advance' && !item.error && item.responseOrdinal < inspection.ordinal).length,
      inits: state.rpc.filter(item => item.operation.type === 'init' && item.requestOrdinal < inspection.ordinal).length,
      resets: 0,
    });
    assert.deepEqual(row.countsBefore, countsAt(before)); assert.deepEqual(row.countsAfter, countsAt(after));
    assert.equal(row.countsBefore.inits, 1); assert.equal(row.countsAfter.inits, 1);
    assert.equal(row.countsBefore.resets, 0); assert.equal(row.countsAfter.resets, 0); assert.equal(state.workerIds.size, 1);
    const paused = state.controllerStates.filter(item => item.ordinal < after.ordinal && item.snapshot.status === 'paused');
    assert.ok(paused.length > 0, 'The production controller must actually publish a paused state');
    if (row.name === 'before_first_dispatch') {
      assert.equal(row.sequence, 0); assert.equal(before.sequence, 0); assert.equal(after.sequence, 0);
      assert.deepEqual(row.ticketBefore, row.ticketAfter); assert.equal(before.graphChain, after.graphChain);
      assert.equal(row.countsAfter.dispatches, 0); assert.equal(row.countsAfter.advances, 0);
    } else {
      assert.equal(row.sequence, after.sequence); assert.equal(after.sequence, before.sequence + 1);
      assert.equal(row.countsAfter.dispatches, row.countsBefore.dispatches + 1); assert.equal(row.countsAfter.advances, row.countsBefore.advances + 1);
      const returned = state.dispatched[before.sequence]; assert.ok(returned); assert.deepEqual(returned.ticket, before.ticket);
      if (after.ticket) assert.notEqual(after.ticket.id, before.ticket.id);
      if (state.id === 'triple-prefix' && after.sequence === 6) {
        assert.equal(after.acquired, 5); assert.equal(after.ticket.decisionRevision, before.ticket.decisionRevision);
        assert.deepEqual([before.ticket.actionIndex, after.ticket.actionIndex], [0, 1]);
      }
    }
    state.pauses.push(row);
  }
  end(row) {
    const state = this.current; assert.ok(state); assert.equal(row.caseId, state.id); assert.equal(row.sessionId, state.sessionId);
    assert.equal(state.pending.size, 0); assert.equal(state.initCount, 1); assert.equal(state.workerIds.size, 1);
    assert.equal(state.dispatched.length, state.plan.expectedReturnCount); assert.equal(state.positiveAdvanceCount, state.plan.expectedReturnCount);
    assert.equal(row.physicalReturns, state.dispatched.length);
    assert.equal(state.pauses.filter(item => item.name === 'before_first_dispatch').length, 1);
    for (const pause of state.pauses) {
      const following = state.dispatched[pause.sequence];
      if (following) assert.deepEqual(following.ticket, pause.ticketAfter, 'Resume must consume the exact pending post-pause ticket');
    }
    assert.ok(state.inspections.has('initial_authorization'));
    if (state.plan.finalQuestion) assert.ok(state.inspections.has('final_question'));
    for (let n = 1; n <= state.plan.steps.length; n++) {
      assert.ok(state.inspections.has(`before_return_${n}`)); assert.ok(state.inspections.has(`after_return_${n}`));
    }
    const close = row.closeResult; assert.equal(close.ok, true); assert.equal(close.kind, 'stopped'); assert.equal(close.phase, 'stopped');
    assert.equal(close.sessionId, state.sessionId); assert.equal(close.ticket, null); assert.equal(close.command, null);
    assert.equal(close.snapshot.actions, state.dispatched.length); assert.equal(close.snapshot.graphChain, state.chain);
    assert.ok(state.rpc.some(item => item.operation.type === 'close' && item.resultDigest === jsonSha(close)), 'Close must be acknowledged by the actual worker');
    const final = state.inspections.get('final_question') ?? state.inspections.get(`after_return_${state.plan.steps.length}`);
    assert.ok(final); if (!state.plan.finalQuestion) assert.equal(final.finished, true);
    assert.equal(row.status, 'captured'); assert.deepEqual(row.errors, []); assert.equal(row.closeError, null); assert.equal(row.workersClosed, true);
    assert.deepEqual(row.counts, { dispatches: state.dispatched.length, advances: state.positiveAdvanceCount, inits: 1, resets: 0 });
    const transport = row.workerTransport;
    assert.equal(transport.schema, 'logos-engine.lot8b.public-worker-transport-receipt.v1');
    assert.equal(transport.closed, true); assert.equal(transport.nativeVersion, '0.67.0'); assert.equal(transport.workerCount, 1);
    assert.equal(transport.actualPublishedEntrypoint, true); assert.equal(transport.nativeServiceReplaced, false);
    assert.equal(transport.nativeRuntimeReplaced, false); assert.equal(transport.internalNativeStateInjected, false);
    assert.equal(transport.browserExecution, false); assert.equal(transport.liveGameEngineExecution, false);
    assert.deepEqual(transport.loggingFailures, []); assert.equal(transport.recordCount, this.transportSequences.get(state.id));
    assert.deepEqual(transport.pins, this.prepared.get(state.id).pins); assert.equal(transport.workers.length, 1);
    const worker = transport.workers[0]; assert.ok(worker.readyAt && worker.exitedAt); assert.equal(worker.terminationAcknowledged, true);
    assert.deepEqual(worker.environmentErrors, []); assert.equal(worker.requests, state.rpc.length); assert.equal(worker.responses, state.rpc.length);
    assert.equal(worker.rpcErrors, state.rpc.filter(item => item.error).length);
    if (state.id === 'triple-prefix') {
      const firstMove = state.inspections.get('after_return_6'), secondMove = state.inspections.get('after_return_7');
      assert.equal(firstMove.snapshot.actions, 6); assert.equal(firstMove.acquired, 5); assert.equal(firstMove.kind, 'action');
      assert.equal(secondMove.snapshot.actions, 7); assert.equal(secondMove.acquired, 7);
      assert.equal(state.dispatched[5].ticket.decisionRevision, state.dispatched[6].ticket.decisionRevision);
      assert.deepEqual([state.dispatched[5].ticket.actionIndex, state.dispatched[6].ticket.actionIndex], [0, 1]);
    }
    if (state.id === 'contrary-return') {
      assert.deepEqual(state.inspections.get('after_return_4').motion.ACTION1, [0, -2]);
      assert.deepEqual(state.inspections.get('after_return_5').motion.ACTION1, [0, 2]);
      assert.deepEqual(final.command, { actionRef: 'ACTION5', data: {} });
    }
    const summary = { caseId: state.id, sessionId: state.sessionId, physicalReturns: state.dispatched.length,
      successfulAdvances: state.positiveAdvanceCount, initializations: state.initCount, workers: [...state.workerIds],
      inspections: state.inspectionCount, graphDeltas: state.deltas.length, finalGraphChain: state.chain, finalGraphNodes: Object.keys(state.nodes).length,
      consumedTickets: state.usedTickets.size, issuedTicketsObserved: state.ticketReleases.size,
      acquiredBranchReturns: final.acquired, retainedOwnerEvents: final.ownerEventCount,
      finalQuestion: final.command, finalQuestionExecuted: false, protocolChecks: state.protocols, pauseChecks: state.pauses,
      forms: state.forms };
    this.finished.push(summary); this.report.summaries = this.finished; this.current = null;
  }
  async row(row) {
    this.lastOrdinal = row.ordinal;
    await this.checked(`capture.${row.type}`, async () => {
      if (row.type === 'header') { assert.equal(this.header, null); assert.equal(row.ordinal, 0); this.header = row; }
      else {
        assert.ok(this.header, 'Header must precede capture events');
        if (row.type === 'session_start') this.start(row);
        else if (row.type === 'transport') await this.transport(row);
        else if (row.type === 'inspection') await this.inspection(row);
        else if (row.type === 'host_dispatch') this.dispatch(row);
        else if (row.type === 'protocol_check') this.protocol(row);
        else if (row.type === 'pause_check') this.pause(row);
        else if (row.type === 'session_end') this.end(row);
        else if (row.type === 'controller_state') {
          assert.ok(this.current); assert.equal(row.caseId, this.current.id);
          const snapshot = row.snapshot ?? row.state; assert.ok(snapshot); assert.notEqual(snapshot.status, 'error', snapshot.message);
          this.current.controllerStates.push({ ordinal: row.ordinal, snapshot });
        } else if (row.type === 'receipt' || row.type === 'footer') { assert.equal(this.current, null); this.footer = row; }
        else if (row.type === 'presentation') { if (row.sha256) assert.equal(row.sha256, this.report.inputs.presentation.sha256); }
        else throw new Error(`Unsupported capture event ${row.type}`);
      }
    }, { ordinal: row.ordinal, caseId: row.caseId ?? null, label: row.label ?? null });
  }
  finish() {
    assert.equal(this.current, null, 'Capture stopped during a session'); assert.deepEqual(this.finished.map(item => item.caseId), CASES);
    assert.equal(new Set(this.finished.map(item => item.sessionId)).size, CASES.length);
    assert.equal(this.finished.reduce((n, item) => n + item.physicalReturns, 0), 18);
    assert.equal(this.rpcTotals.requests, this.rpcTotals.responses);
    assert.equal(this.prepared.size, 3); assert.equal(this.workers.size, 3); assert.equal(new Set([...this.workers.values()].map(worker => worker.threadId)).size, 3);
    for (const worker of this.workers.values()) {
      assert.equal(worker.exited, true); assert.equal(worker.terminated, true);
      assert.deepEqual([...new Set(worker.fetches)].sort(), this.prepared.get(worker.caseId).pins.assets.map(item => item.url).sort());
    }
    assert.ok(this.finished.some(item => item.pauseChecks.some(check => check.name === 'during_dispatch')));
    assert.deepEqual(this.finished.flatMap(item => item.protocolChecks.map(check => check.name)).sort(), [
      'wrong_ticket', 'wrong_session', 'wrong_sequence', 'step_index_mismatch', 'invalid_frame_dimensions',
      'invalid_palette', 'inconsistent_animation', 'negative_execution_duration', 'consumed_ticket',
    ].sort());
    this.report.transport = { records: this.transportRecords, workers: this.workers.size,
      pins: Object.fromEntries([...this.prepared].map(([id, record]) => [id, record.pins])), ...this.rpcTotals };
  }
}

async function main() {
  const args = argumentsFor(process.argv.slice(2)); await mkdir(args.output, { recursive: true });
  const report = { schema: 'logos-engine.lot8b.public-branch-qualification.v1', status: 'running',
    capture: label(args.capture), reader: label(SELF), startedAt: new Date().toISOString(),
    inputs: {}, assertions: [], failures: [], summaries: [],
    claims: { actualPublicService: false, actualPublishedWorker: false, actualProductionClientController: false,
      public64x64Packets: false, realServiceTickets: false, realGraphAcquisitions: false,
      observedOwnerRestoreCalls: false, wholeModelIdentity14versus32: false, fullV6Parity: false,
      officialPerformanceEligible: false, browserDomOrCsp: false, liveGameEngine: false, solvedLevel: false },
    limitations: [
      'Retained public presentations use zero padding from the original small component corpus to 64x64; the model limit changes from 14 to 32.',
      'The reader validates actual recorded public RPCs and authoritative graph deltas. It never starts a runtime, worker, game or oracle.',
      'Retained graph state and the ensuing questions are checked; internal restore method calls are not observed by this capture.',
      'The final authorized question is inspected and closed without dispatch. A finished BranchRouting owner does not constrain every other native owner.',
      'Node interthread environment adaptation is not a browser DOM, HTTP/CSP, real-game, complete-parity or performance qualification.',
      'Previously instrumented native incomplete-acquisition evidence is not reclassified as an ordinary public-worker run.',
    ],
  };
  try {
    const receiptNames = (await readdir(args.capture)).filter(name => ['receipt.json', 'capture.receipt.json'].includes(name));
    assert.equal(receiptNames.length, 1, 'Exactly one unambiguous capture receipt is required');
    const paths = { presentation: resolve(args.capture, 'presentation.json'), events: resolve(args.capture, 'events.jsonl.gz'),
      receipt: resolve(args.capture, receiptNames[0]), fixture: resolve(ROOT, FIXTURE) };
    for (const [key, path] of Object.entries(paths)) report.inputs[key] = await fingerprint(path);
    report.inputs.reader = await fingerprint(SELF);
    assert.equal(report.inputs.fixture.sha256, FIXTURE_SHA);
    const receipt = JSON.parse(await readFile(paths.receipt, 'utf8'));
    const presentation = JSON.parse(await readFile(paths.presentation, 'utf8'));
    const fixture = JSON.parse(await readFile(paths.fixture, 'utf8'));
    const reader = new Reader(presentation, report);
    await reader.checked('unchanged_published_native_inventory', async () => assert.deepEqual(await nativeInventory(), NATIVE));
    await reader.checked('source_and_public_presentation_contract', () => presentationContract(presentation, fixture));
    await reader.checked('capture_receipt_integrity', async () => {
      assert.equal(receipt.schema, 'logos-engine.lot8b.public-boundary-capture-receipt.v1'); assert.equal(receipt.status, 'captured');
      const expectedSha = receipt.shaevents ?? receipt.eventsSha256 ?? receipt.events?.sha256 ?? receipt.capture?.sha256;
      assert.equal(expectedSha, report.inputs.events.sha256, 'Compressed event bytes must match the retained receipt');
      assert.ok(receipt.inputsBefore && receipt.inputsAfter, 'Capture input fingerprints are required');
      assert.deepEqual(receipt.inputsBefore, receipt.inputsAfter, 'Capture changed its pinned inputs');
      await verifyFingerprintTree(receipt.inputsBefore);
      assert.equal(receipt.presentation.sha256, report.inputs.presentation.sha256); assert.equal(receipt.presentation.bytes, report.inputs.presentation.bytes);
      assert.equal(receipt.events.bytes, report.inputs.events.bytes);
      assert.deepEqual(receipt.errors, []); assert.equal(receipt.inputsUnchanged, true); assert.equal(receipt.workersClosed, true);
      assert.equal(receipt.physicalReturns, 18); assert.equal(receipt.originalOraclesExecuted, 0);
      assert.equal(receipt.gameEnginesExecuted, 0); assert.equal(receipt.gameReplays, 0); assert.equal(receipt.acquiredStateInjected, false);
      assert.equal(receipt.officialPerformanceEligible, false); assert.equal(receipt.fullOriginalModelIdentityClaimed, false);
    });
    const streamIntegrity = {};
    for await (const row of records(paths.events, streamIntegrity)) await reader.row(row);
    await reader.checked('complete_three_session_population', () => {
      reader.finish(); assert.equal(reader.header.schema, 'logos-engine.lot8b.public-boundary-capture.v1');
      assert.deepEqual(reader.header.inputsBefore, receipt.inputsBefore); assert.equal(receipt.events.count, reader.lastOrdinal + 1);
      assert.deepEqual(streamIntegrity, { rawSha256: receipt.events.rawSha256, rawBytes: receipt.events.rawBytes, count: receipt.events.count });
      assert.equal(reader.header.nativeDigest, NATIVE.digest); assert.equal(reader.header.publishedSourceCommit, '8462204043aa368faa7df280d796bb706eb53b38');
      assert.deepEqual(reader.header.publishedRuntimeInputs, receipt.publishedRuntimeInputs);
      assert.deepEqual(receipt.publishedRuntimeInputs.map(item => item.path).sort(), [
        'contracts.ts', 'v6-agent.ts', 'v6-agent-client.ts', 'v6-agent-protocol.ts', 'v6-agent-service.ts', 'v6-agent-worker.ts',
      ].map(name => `src/runtime/${name}`).sort());
      for (const item of receipt.publishedRuntimeInputs) {
        assert.equal(item.publishedSourceCommit, reader.header.publishedSourceCommit); assert.equal(item.publishedSha256, item.workingSha256);
        const pinned = receipt.inputsBefore.find(pin => pin.path === item.path); assert.ok(pinned);
        assert.equal(pinned.sha256, item.workingSha256); assert.equal(pinned.bytes, item.bytes);
      }
      assert.deepEqual(receipt.sessions.map(item => item.caseId), CASES);
      for (const [index, session] of receipt.sessions.entries()) {
        assert.equal(session.status, 'captured'); assert.equal(session.sessionId, reader.finished[index].sessionId);
        assert.equal(session.physicalReturns, reader.finished[index].physicalReturns); assert.equal(session.workersClosed, true);
        assert.deepEqual(session.errors, []);
      }
    });
    report.status = 'qualified_public_branch_boundary';
    Object.assign(report.claims, { actualPublicService: true, actualPublishedWorker: true, actualProductionClientController: true,
      public64x64Packets: true, realServiceTickets: true, realGraphAcquisitions: true });
  } catch (error) { report.status = 'failed'; report.failures.push(errorRecord(error)); process.exitCode = 1; }
  report.finishedAt = new Date().toISOString();
  await writeFile(resolve(args.output, 'qualification.json'), JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ status: report.status, report: label(resolve(args.output, 'qualification.json')),
    passedAssertions: report.assertions.filter(item => item.passed).length, failures: report.failures }) + '\n');
}

main().catch(error => { process.stderr.write(JSON.stringify(errorRecord(error)) + '\n'); process.exitCode = 1; });
