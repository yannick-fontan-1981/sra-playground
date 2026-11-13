#!/usr/bin/env node
/** Qualify premeasurement LinkedTemporal graphs with a closed first-creator ledger.
 * CLI: node SCRIPT BASELINE.gz BASELINE.receipt.json CANDIDATE.gz CANDIDATE.receipt.json SUPPLEMENT.json ATTRIBUTION.json FIXTURE.json
 * Reads functional captures only. No runtime, replay, game or timing report runs.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createGunzip, gunzipSync } from 'node:zlib';
import { digest, compareUnicode } from '../../../src/logos-engine/canonical.ts';
import { decodeNativeState, NATIVE_STORE_PROFILE } from '../../../src/logos-engine/v6-knowledge-store.ts';
import { hydrateNativeState, isNativeStateGraph } from '../../../src/logos-engine/v6-native-state-graph.ts';
import { symbolicDigest } from '../../../src/logos-engine/v6-hash.ts';
import { V6_NATIVE_PROGRAM_REFERENCE } from '../../../src/logos-engine/v6-src-program.ts';

const SCRIPT = fileURLToPath(import.meta.url), ROOT = resolve(dirname(SCRIPT), '../../..');
const BASE = resolve(ROOT, 'docs/migration/lot5a-evidence');
const CAPTURE_TOOL = resolve(BASE, 'capture-cost-owner-graphs.mjs');
const OWNER = 'linked_temporal_preparation';
const IDS = [`family_state:${OWNER}`, `family_activation:${OWNER}`];
const IDSET = new Set(IDS), EPISODE = 'common-observation-frontier';
const SOURCE_PROOFS = ['src/logos-engine/v6-native-runtime.ts', 'src/logos-engine/v6-linked-temporal-preparation.ts',
  'src/logos-engine/v6-linked-temporal-contact.ts', 'src/logos-engine/v6-linked-temporal-phase.ts',
  'src/logos-engine/v6-linked-temporal-common.ts', 'src/logos-engine/v6-knowledge-store.ts', 'src/logos-engine/kernel.ts'];
const ROLE_VALIDATORS = ['src/logos-engine/kernel.ts', 'src/logos-engine/v6-knowledge-store.ts'];
const COMMON_VALIDATORS = ['src/logos-engine/canonical.ts',
  'src/logos-engine/v6-native-state-graph.ts', 'src/logos-engine/v6-hash.ts', 'src/logos-engine/v6-src-program.ts', 'src/logos-engine/v6/programs.json',
  'src/runtime/v6-agent-service.ts'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const label = path => path.startsWith(ROOT + sep) ? relative(ROOT, path) : path;
const own = (value, key) => Object.hasOwn(value, key);
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort(compareUnicode).map(key => [key, canonical(value[key])])) : value;
const canonicalHash = value => hash(JSON.stringify(canonical(value)));
const errorRecord = error => ({ name: error?.name ?? 'Error', message: String(error?.message ?? error) });

async function absent(path) {
  try { await access(path); throw new Error('Refusing existing output/window: ' + path); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
async function fingerprint(path) {
  const actual = resolve(ROOT, path), sha = createHash('sha256');
  for await (const chunk of createReadStream(actual)) sha.update(chunk);
  return { path: label(actual), bytes: (await stat(actual)).size, sha256: sha.digest('hex') };
}
async function read(path) {
  const bytes = await readFile(resolve(ROOT, path));
  return JSON.parse(String(path).endsWith('.gz') ? gunzipSync(bytes) : bytes);
}
async function* streamCapture(path) {
  const source = createReadStream(path), stream = source.pipe(createGunzip()), decoder = new StringDecoder('utf8');
  source.on('error', error => stream.destroy(error));
  let pending = '', line = 0, record = 0, previousComma = true, ended = false;
  const parse = value => {
    if (line++ === 0) {
      assert.ok(value.endsWith('"records":[')); return { type: '$header', value: JSON.parse(value + ']}') };
    }
    assert.equal(ended, false);
    if (value.startsWith('],')) {
      assert.ok(record > 0 && !previousComma); ended = true;
      const footer = JSON.parse('{' + value.slice(2)); assert.equal(footer.recordCount, record);
      return { type: '$footer', value: footer };
    }
    assert.ok(previousComma, 'Missing record separator'); previousComma = value.endsWith(',');
    const result = JSON.parse(previousComma ? value.slice(0, -1) : value);
    assert.equal(result.recordIndex, record++, 'Capture records are omitted or reordered'); return result;
  };
  try {
    for await (const chunk of stream) {
      pending += decoder.write(chunk); let index;
      while ((index = pending.indexOf('\n')) >= 0) {
        const value = pending.slice(0, index); pending = pending.slice(index + 1);
        if (value.length) yield parse(value);
      }
    }
    pending += decoder.end(); if (pending.length) yield parse(pending);
    assert.ok(ended, 'Capture footer is absent');
  } finally { source.destroy(); stream.destroy(); }
}
function nodeValue(node, nodes) {
  return isNativeStateGraph(node.value) ? hydrateNativeState(node.value, id => {
    assert.equal(nodes[id]?.kind, 'state_fragment'); assert.equal(nodes[id].scope, node.scope);
    return nodes[id].value;
  }) : decodeNativeState(node.value);
}
function publicObservation(packet) {
  return { frame: packet.frame_rows, frames: packet.frame_packet,
    availableActionIds: packet.available_action_refs.map(name => Number(name.slice(6))), state: packet.state,
    level: packet.level, levelsCompleted: packet.levels_completed, stepIndex: packet.step_index };
}
function publicCommandFromSource(command) {
  // Exact boundary in V6AgentService.commandFromNative: the native command
  // remains untouched while public data is copied with {...command.data}.
  // In particular, absent native data becomes the actual public empty object.
  assert.ok(command && typeof command === 'object' && !Array.isArray(command));
  assert.ok(Object.keys(command).every(key => ['action_ref', 'data'].includes(key)), 'Unknown native command field');
  assert.equal(typeof command.action_ref, 'string');
  if (own(command, 'data')) assert.ok(command.data !== null && typeof command.data === 'object' && !Array.isArray(command.data),
    'Present native command data must remain an object');
  return { action_ref: command.action_ref, data: { ...command.data } };
}
function observationShape(row) {
  const s = row.snapshot;
  return { type: row.request.type, sequence: row.request.sequence, family: s.lastDecision,
    proposalKind: s.proposal?.kind ?? null, poseMode: s.proposal?.material_pose_plan?.mode ?? null,
    actions: s.actions, cycles: s.cycles, levelsCompleted: s.levelsCompleted, nodeCount: s.nodeCount,
    acquiredTransitions: s.caller?.acquiredTransitions ?? null };
}
function finalShape(s) {
  return { actions: s.actions, levelsCompleted: s.levelsCompleted, reason: s.reason, graphRevision: s.graphRevision,
    nodeCount: s.nodeCount, acquiredTransitions: s.caller?.acquiredTransitions ?? null, implementation: s.implementation };
}
function assertSameWork(a, b) {
  const withoutIdentityAndCounts = shape => ({ ...shape,
    observations: shape.observations.map(({ nodeCount, ...rest }) => rest),
    inspection: shape.inspection.map(() => ({})),
    final: Object.fromEntries(Object.entries(shape.final).filter(([key]) => !['nodeCount', 'graphRevision', 'implementation'].includes(key))) });
  assert.deepEqual(withoutIdentityAndCounts(a), withoutIdentityAndCounts(b), 'Non-structural work changed between versions');
}
function commonNode(a, b, digestA, digestB) {
  assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), 'Common node fields changed');
  for (const key of Object.keys(a)) {
    if (key === 'value') continue; // Original private values stay retained; no value-parity claim.
    if (key === 'origin') {
      assert.deepEqual(Object.keys(a.origin).sort(), Object.keys(b.origin).sort());
      for (const name of Object.keys(a.origin)) {
        if (name === 'source_digest') assert.deepEqual([a.origin[name], b.origin[name]], [digestA, digestB]);
        else assert.deepEqual(a.origin[name], b.origin[name], `Common node origin changed: ${a.id}/${name}`);
      }
    } else assert.deepEqual(a[key], b[key], `Common node metadata changed: ${a.id}/${key}`);
  }
}
function fragmentReferences(value, nodes, found = new Set()) {
  function visit(item) {
    if (!item || typeof item !== 'object') return;
    if (!Array.isArray(item) && item.kind === 'ref' && typeof item.id === 'string') {
      assert.equal(nodes[item.id]?.kind, 'state_fragment');
      if (!found.has(item.id)) { found.add(item.id); visit(nodes[item.id].value.node); }
      return;
    }
    for (const child of Object.values(item)) visit(child);
  }
  if (isNativeStateGraph(value)) visit(value.root);
  return found;
}
function encodedReferences(value, path = '$') {
  if (!value || typeof value !== 'object') return [];
  if (!Array.isArray(value) && value.kind === 'ref' && typeof value.id === 'string') return [{ id: value.id, path }];
  return Object.entries(value).flatMap(([key, item]) => encodedReferences(item,
    path + (Array.isArray(value) ? `[${key}]` : `.${key}`)));
}
function fragmentTrails(value, nodes, fragment, path = '$.value.root', chain = []) {
  return encodedReferences(value, path).flatMap(reference => {
    if (reference.id === fragment) return [{ path: reference.path, fragmentChain: [...chain, reference.id] }];
    assert.ok(!chain.includes(reference.id), 'Cyclic fragment reference in causal path');
    assert.equal(nodes[reference.id]?.kind, 'state_fragment');
    return fragmentTrails(nodes[reference.id].value.node, nodes, fragment,
      reference.path + '→' + reference.id, [...chain, reference.id]);
  });
}
const sharedKey = (item, fragment = item.fragmentId) => `${item.case}:${item.form}:${fragment}`;
const creationCause = role => role === 'candidate'
  ? { workflow: 'v6.composition_strategy.choose', step: 'sealed_prefix', statement: 'outcome.acquire' }
  : { workflow: 'prototype.laya_router.route', step: 'native_memory', statement: 'transition.acquire' };
async function eventView(record) {
  const { delta, pointIndex, requestType, requestSequence } = record, node = delta.node;
  return { pointIndex, requestType, requestSequence, deltaSequence: delta.sequence,
    nodeId: node.id, kind: node.kind, revision: node.revision, cause: delta.cause,
    origin: node.origin, nodeSha256: await digest(node), deltaDigest: delta.digest };
}

class Qualification {
  constructor(paths) {
    this.paths = paths; this.inputs = new Map(); this.forms = []; this.traces = new Map(); this.receipts = {}; this.stores = {};
    this.sharedLedger = new Map(); this.closedShared = new Set();
    this.result = { schema: 'logos-engine.lot5a-owner-cost-structural-attribution.v1',
      status: 'functional_structure_qualification_failed', startedAt: new Date().toISOString(),
      checks: [], nodeAttributions: [], points: [], failures: [], commandBoundaryProjections: [], sharedFragmentCatchups: [] };
  }
  async input(path) {
    const record = await fingerprint(path), previous = this.inputs.get(record.path);
    if (previous) assert.deepEqual(previous, record, 'Input changed during qualification');
    this.inputs.set(record.path, record); return record;
  }
  async recorded(record) {
    assert.deepEqual(Object.keys(record).sort(), ['bytes', 'path', 'sha256']);
    const actual = await this.input(record.path);
    assert.deepEqual([actual.bytes, actual.sha256], [record.bytes, record.sha256], 'Recorded bytes differ: ' + record.path);
    return resolve(ROOT, record.path);
  }
  async checked(name, operation) {
    try { await operation(); this.result.checks.push({ name, passed: true }); }
    catch (error) { this.result.checks.push({ name, passed: false, error: errorRecord(error) }); throw error; }
  }
  async provenance() {
    this.result.generator = await this.input(SCRIPT);
    this.captureTool = await this.input(CAPTURE_TOOL);
    for (const role of ['baseline', 'candidate']) {
      const receiptPath = this.paths[role + 'Receipt']; await this.input(receiptPath);
      const receipt = await read(receiptPath); this.receipts[role] = receipt;
      assert.equal(receipt.schema, 'logos-engine.lot5a-owner-cost-functional-capture-receipt.v1');
      assert.equal(receipt.status, 'captured_functional_structure'); assert.equal(receipt.role, role);
      assert.equal(receipt.nativeDigest, receipt.nativeInventoryBefore.digest);
      assert.deepEqual(receipt.nativeInventoryBefore, receipt.nativeInventoryAfter);
      assert.deepEqual(receipt.nativeSourceBefore, receipt.nativeSourceAfter);
      assert.deepEqual(receipt.inputsBefore, receipt.inputsAfter); assert.deepEqual(receipt.generator, receipt.generatorAfter);
      assert.deepEqual(receipt.generator, this.captureTool); assert.deepEqual(receipt.failures, []);
      for (const key of ['nativeSourceUnchanged', 'inputsUnchanged', 'generatorUnchanged']) assert.equal(receipt[key], true);
      for (const key of ['measuredCostSessions', 'timingReportsRead', 'timingMetricsProduced']) assert.equal(receipt[key], 0);
      assert.equal(receipt.sessionCount, 4); assert.equal(receipt.actions, 31);
      assert.ok(Date.parse(receipt.finishedAt) >= Date.parse(receipt.startedAt));
      assert.deepEqual(await read(await this.recorded(receipt.nativeSourceBefore)), receipt.nativeInventoryBefore);
      await this.recorded(receipt.cases);
      assert.equal(await this.recorded(receipt.report), this.paths[role]);
      assert.equal(new Set(receipt.inputsBefore.map(row => row.path)).size, receipt.inputsBefore.length);
      for (const record of receipt.inputsBefore) await this.recorded(record);
      for (const required of [receipt.cases, receipt.nativeSourceBefore, receipt.generator]) {
        assert.ok(receipt.inputsBefore.some(record => isDeepStrictEqual(record, required)), 'Capture input binding is missing');
      }
    }
    assert.deepEqual(this.receipts.baseline.cases, this.receipts.candidate.cases);
    this.casesRecord = this.receipts.candidate.cases; this.cases = await read(this.casesRecord.path);
    assert.deepEqual(this.cases.cases.map(row => [row.id, row.warmupActions, row.actions]), [['STCK', 3, 10], ['SMLP', 3, 15]]);
    this.performanceDirectory = dirname(resolve(ROOT, this.casesRecord.path));
    await absent(resolve(this.performanceDirectory, 'window.json')); await absent(resolve(this.performanceDirectory, 'readiness.json'));
    this.result.nativeDigests = Object.fromEntries(['baseline', 'candidate'].map(role => [role, this.receipts[role].nativeDigest]));
    this.result.premeasurementSupplement = await this.input(this.paths.supplement);
    const supplement = await read(this.paths.supplement);
    assert.equal(supplement.schema, 'logos-engine.lot5a-shared-fragment-premeasurement-supplement.v1');
    assert.equal(supplement.status, 'declared_before_measurement');
    assert.deepEqual(supplement.nativeDigests, this.result.nativeDigests);
    assert.deepEqual(supplement.qualifier, this.result.generator);
    assert.equal(supplement.noOfficialWindowAtDeclaration, true);
    assert.equal(supplement.numericPolicyChanged, false); assert.equal(supplement.measuredSessionsDiscarded, 0);
    for (const record of supplement.inputs) await this.recorded(record);
    const declaration = await read(await this.recorded(supplement.initialDeclaration));
    assert.deepEqual(declaration.nativeDigests, this.result.nativeDigests);
    assert.deepEqual(declaration.ownerCostQualification.tools, supplement.unchangedCostAnalyzers);
    for (const record of Object.values(supplement.unchangedCostAnalyzers)) await this.recorded(record);
    assert.deepEqual(supplement.allowedWorkPaths,
      ['observations[*].nodeCount', 'inspection[*].graphNodes', 'final.nodeCount', 'final.graphRevision']);
    const failed = await read(await this.recorded(supplement.initialFailedAttribution));
    assert.equal(failed.status, 'functional_structure_qualification_failed');
    assert.ok(failed.failures.some(error => error.message.includes('Common node origin changed: state_fragment:5447ef')));
    assert.ok(Date.parse(failed.recordedAt) <= Date.parse(supplement.declaredAt)
      && Date.parse(supplement.declaredAt) <= Date.parse(this.result.startedAt), 'Supplement must predate qualification');
    for (const role of ['baseline', 'candidate']) {
      assert.deepEqual(supplement.captures[role].report, await this.input(this.paths[role]));
      assert.deepEqual(supplement.captures[role].receipt, await this.input(this.paths[role + 'Receipt']));
    }
    const inventory = await read(await this.recorded(supplement.fragmentInventory));
    assert.equal(inventory.status, 'diagnostic_complete_not_qualified');
    assert.equal(inventory.inputsUnchanged, true); assert.deepEqual(inventory.inputsBefore, inventory.inputsAfter);
    for (const record of [inventory.generator, ...inventory.inputsBefore]) await this.recorded(record);
    const observed = inventory.sessions.flatMap(session => session.firstCreatorDifferences.map(item => ({
      case: session.case, form: session.form, fragmentId: item.fragmentId,
      canonicalValueSha256: canonicalHash(item.baseline.node.value),
      baseline: { creation: Object.fromEntries(Object.entries(item.baseline).filter(([key]) =>
        !['firstConsumer', 'consumerRootsAtFirstPoint', 'directParentsAtFirstPoint'].includes(key))),
        firstConsumer: item.baseline.firstConsumer, consumerRootsAtFirstPoint: item.baseline.consumerRootsAtFirstPoint },
      candidate: { creation: Object.fromEntries(Object.entries(item.candidate).filter(([key]) =>
        !['firstConsumer', 'consumerRootsAtFirstPoint', 'directParentsAtFirstPoint'].includes(key))),
        firstConsumer: item.candidate.firstConsumer, consumerRootsAtFirstPoint: item.candidate.consumerRootsAtFirstPoint },
    })));
    assert.deepEqual(supplement.closedLedger, observed, 'Closed ledger differs from the independent retained-capture inventory');
    assert.equal(observed.length, 14);
    assert.deepEqual(['STCK:warmup', 'STCK:measured', 'SMLP:warmup', 'SMLP:measured'].map(key =>
      observed.filter(item => `${item.case}:${item.form}` === key).length), [0, 3, 0, 11]);
    for (const item of observed) {
      const key = sharedKey(item); assert.equal(this.sharedLedger.has(key), false);
      assert.equal(item.fragmentId, 'state_fragment:' + item.canonicalValueSha256);
      assert.ok(item.candidate.creation.pointIndex < item.baseline.creation.pointIndex);
      this.sharedLedger.set(key, item);
    }
    this.result.closedSharedFragmentLedgerCount = observed.length;
    for (const path of SOURCE_PROOFS) {
      const record = await this.input(resolve(ROOT, path));
      assert.equal(record.sha256, this.receipts.candidate.nativeInventoryBefore.files[path]);
    }
    for (const path of COMMON_VALIDATORS) {
      const record = await this.input(resolve(ROOT, path));
      for (const role of ['baseline', 'candidate']) assert.equal(record.sha256, this.receipts[role].nativeInventoryBefore.files[path],
        'Graph validator differs from captured source: ' + role + '/' + path);
    }
    // Kernel batching and store batching are the implementation under review.
    // Bind each validator to its own captured source instead of pretending that
    // those two files are unchanged. The value codecs must remain exact.
    for (const role of ['baseline', 'candidate']) {
      const receipt = this.receipts[role];
      for (const path of ROLE_VALIDATORS) {
        const record = await this.input(resolve(receipt.checkout, path));
        assert.equal(record.sha256, receipt.nativeInventoryBefore.files[path], 'Role validator changed: ' + role + '/' + path);
      }
      this.stores[role] = await import(pathToFileURL(resolve(receipt.checkout, 'src/logos-engine/v6-knowledge-store.ts')).href);
      assert.equal(this.stores[role].NATIVE_STORE_PROFILE, NATIVE_STORE_PROFILE);
    }
    for (const name of ['encodeNativeState', 'decodeNativeState']) assert.equal(
      String(this.stores.baseline[name]), String(this.stores.candidate[name]), 'Native value codec changed: ' + name);
    for (const item of this.cases.cases) {
      const record = await this.input(resolve(ROOT, item.trace)); assert.equal(record.sha256, item.traceSha256);
      const trace = await read(record.path); assert.equal(trace.status, 'passed'); this.traces.set(item.id, trace);
    }
  }
  start(role, row, ordinal) {
    const item = this.cases.cases[Math.floor(ordinal / 2)], form = ordinal % 2 ? 'measured' : 'warmup';
    assert.deepEqual([row.case, row.form, row.sessionId], [item.id, form, `lot5a-owner-cost-${item.id.toLowerCase()}-${form}`]);
    assert.equal(row.actionsLimit, form === 'warmup' ? item.warmupActions : item.actions);
    assert.deepEqual(row.budgets, { targetLevels: item.targetLevels, levelActionCaps: Array(item.targetLevels).fill(600) });
    assert.equal(row.nativeDigest, this.receipts[role].nativeDigest); assert.equal(row.coldKnowledge, true); assert.equal(row.checkpointSupplied, false);
    assert.deepEqual([row.trace, row.traceSha256], [item.trace, item.traceSha256]);
    const trace = this.traces.get(item.id); assert.deepEqual(row.initialPublicPacket, trace.packets[0].packet);
    return { role, start: row, trace, nodes: {}, revision: 0, chain: null, runtimeDigest: null,
      point: 0, commands: 0, pending: null, last: null, calls: [], checkpoints: [], ownRoots: [], ownDeltaCount: 0,
      sharedCatchupCount: 0, fragmentCreations: new Map(), firstFragmentConsumers: new Map(), rootEventsAtPoint: [],
      qualifiedShared: new Map(), sharedFragmentConsumers: new Map(),
      shape: { actions: 0, cycles: 0, levelsCompleted: 0, requests: [], observations: [], inspection: [], final: null } };
  }
  command(state, row) {
    assert.equal(state.last.result.kind, 'action'); assert.equal(state.pending, null);
    assert.equal(row.action, state.commands + 1); assert.equal(row.sourceCapturePointIndex, state.point - 1);
    assert.equal(row.commandEqual, true); assert.equal(row.returnSupplied, false);
    assert.deepEqual(row.actualCommand, { action_ref: state.last.result.command.actionRef, data: state.last.result.command.data });
    assert.deepEqual(row.actualCommand, state.trace.packets[row.action].command);
    assert.deepEqual(row.expectedCommand, row.actualCommand); assert.deepEqual(row.ticket, state.last.result.ticket);
    assert.equal(row.ticket.graphChain, state.chain); assert.equal(row.ticket.nativeExecutionDigest, state.last.snapshot.nativeExecutionDigest);
    assert.deepEqual(row.publicPacket, state.trace.packets[row.action].packet);
    assert.equal(row.publicPacketSha256, hash(JSON.stringify(row.publicPacket)));
    state.commands++; state.pending = row;
  }
  async graph(state, row) {
    const graph = row.knowledge, snapshot = row.snapshot;
    state.rootEventsAtPoint = [];
    if (state.runtimeDigest === null) {
      state.runtimeDigest = snapshot.sourceDigest;
      const Store = this.stores[state.role].NativeKnowledgeStore;
      state.kernel = new Store(state.runtimeDigest, row.sessionId).kernel;
    }
    assert.equal(snapshot.sourceDigest, state.runtimeDigest); assert.equal(snapshot.sourceCommit, V6_NATIVE_PROGRAM_REFERENCE);
    assert.equal(graph.fromRevision, state.revision); assert.equal(graph.toRevision, state.revision + graph.deltasAdded.length);
    for (const delta of graph.deltasAdded) {
      assert.deepEqual(Object.keys(delta).sort(), ['cause', 'digest', 'node', 'previous', 'sequence', 'source_digest']);
      assert.equal(delta.sequence, ++state.revision); assert.equal(delta.previous, state.chain);
      assert.equal(delta.source_digest, state.runtimeDigest); state.kernel.validateNode(delta.node);
      assert.equal(delta.node.scope, row.sessionId); assert.equal(delta.node.origin.source_digest, state.runtimeDigest);
      assert.equal(delta.node.origin.store_profile, NATIVE_STORE_PROFILE);
      const prior = state.nodes[delta.node.id]; assert.equal(delta.node.revision, (prior?.revision ?? 0) + 1);
      if (prior) {
        assert.equal(delta.node.kind, prior.kind); assert.deepEqual(delta.node.origin, prior.origin);
        assert.equal(isDeepStrictEqual({ ...delta.node, revision: prior.revision }, prior), false, 'Fabricated no-op delta');
      }
      assert.equal(await digest({ sequence: delta.sequence, previous: delta.previous, node: delta.node,
        cause: delta.cause, source_digest: delta.source_digest }), delta.digest, 'Invalid Kernel delta hash');
      state.nodes[delta.node.id] = delta.node; state.chain = delta.digest;
      const record = { delta, pointIndex: row.pointIndex, requestType: row.request.type, requestSequence: row.request.sequence };
      if (delta.node.kind === 'state_fragment') {
        assert.equal(prior, undefined, 'Immutable fragments may not be revised');
        assert.equal(delta.node.revision, 1);
        state.fragmentCreations.set(delta.node.id, record);
      } else if (isNativeStateGraph(delta.node.value)) {
        state.rootEventsAtPoint.push(record);
        const references = fragmentReferences(delta.node.value, state.nodes);
        for (const id of references) if (this.sharedLedger.has(sharedKey(state.start, id))) {
          if (!state.firstFragmentConsumers.has(id)) state.firstFragmentConsumers.set(id, record);
          const consumers = state.sharedFragmentConsumers.get(id) ?? [];
          consumers.push(record); state.sharedFragmentConsumers.set(id, consumers);
        }
      }
    }
    assert.deepEqual([graph.chain, graph.toRevision, graph.nodeCount], [state.chain, state.revision, Object.keys(state.nodes).length]);
    assert.deepEqual([snapshot.graphChain, snapshot.graphRevision, snapshot.nodeCount], [state.chain, state.revision, Object.keys(state.nodes).length]);
    const executable = Object.values(state.nodes).filter(node => ['program', 'family_activation'].includes(node.kind))
      .sort((a, b) => compareUnicode(a.id, b.id)).map(node => ({ id: node.id, value: node.value }));
    if (state.executable) assert.deepEqual(executable, state.executable, 'Executable nodes changed in a fixed-cost case');
    else {
      state.executable = executable;
      state.executionDigest = await digest({ profile: NATIVE_STORE_PROFILE, source_digest: state.runtimeDigest, nodes: executable });
    }
    assert.equal(snapshot.nativeExecutionDigest, state.executionDigest);
  }
  async point(state, row) {
    const request = row.request, inspection = row.type === 'terminal_inspection';
    assert.equal(row.pointIndex, state.point++); assert.equal(request.sessionId, state.start.sessionId);
    assert.equal(request.sequence, state.commands); assert.equal(row.snapshot.actions, state.commands);
    assert.equal(row.snapshot.whyAct.enabled, true); assert.equal(row.snapshot.caller.enabled, true);
    if (inspection) {
      assert.equal(request.type, 'inspect'); assert.equal(state.start.form, 'measured');
      assert.equal(state.commands, state.start.actionsLimit); assert.equal(state.pending, null);
      assert.equal(row.knowledge.deltasAdded.length, 0); assert.deepEqual(row.linkedTemporalCalls, []);
      assert.deepEqual(row.linkedTemporalCheckpoints, []);
    } else if (request.type === 'init') {
      assert.equal(row.pointIndex, 0); assert.deepEqual(request.budgets, state.start.budgets);
      assert.equal(row.checkedCommandRecord, null);
    } else if (request.type === 'resume') {
      assert.equal(state.last.result.kind, 'boundary'); assert.equal(state.pending, null);
      assert.ok(state.commands < state.start.actionsLimit); assert.equal(row.publicPacket, null); assert.equal(row.checkedCommandRecord, null);
    } else {
      assert.equal(request.type, 'advance'); assert.ok(state.pending);
      assert.equal(row.checkedCommandRecord, state.pending.recordIndex); assert.equal(request.ticketId, state.pending.ticket.id);
      assert.equal(request.executionMs, 0); state.pending = null;
    }
    if (['init', 'advance'].includes(request.type)) {
      assert.deepEqual(row.publicPacket, state.trace.packets[state.commands].packet);
      assert.deepEqual(request.observation, publicObservation(row.publicPacket));
    }
    for (const call of row.linkedTemporalCalls) {
      assert.equal(state.role, 'candidate'); assert.equal(call.index, state.calls.length);
      assert.equal(call.selected, false, 'The fixed cost traces must remain passive for the added owner');
      assert.equal(call.after.revision, call.before.revision + 1);
      const action = call.after.revision - 1;
      assert.ok(action > 0 && action <= state.commands);
      const publicCommand = publicCommandFromSource(call.command);
      assert.deepEqual(publicCommand, state.trace.packets[action].command,
        'Native source command does not project to the exact actual public command');
      if (!own(call.command, 'data')) this.result.commandBoundaryProjections.push({ case: row.case, form: row.form,
        sourceCallIndex: call.index, action, sourceCommand: call.command, publicCommand,
        rule: 'V6AgentService.commandFromNative data object spread; source omission retained' });
      assert.deepEqual([call.before.level_epoch, call.after.level_epoch],
        [state.trace.packets[action - 1].packet.level, state.trace.packets[action].packet.level]);
      assert.equal(state.calls.some(prior => prior.before.observation_ref === call.before.observation_ref), false, 'Duplicate actual LinkedTemporal feedback');
      const first = state.trace.packets[action - 1].packet, second = state.trace.packets[action].packet;
      assert.ok(Array.isArray(call.returnValue), 'LinkedPreparation returns its exact raw event list');
      assert.deepEqual(call.sourceAfter.events, [...call.sourceBefore.events, ...call.returnValue]);
      assert.deepEqual(call.sourceAfter.current_observation, call.sourceBefore.current_observation,
        'Passive record must not manufacture a before/after guard observation');
      assert.deepEqual(call.sourceAfter.passed, second.levels_completed > first.levels_completed
        ? [...call.sourceBefore.passed, { score: second.levels_completed, observation_ref: call.after.observation_ref }]
        : call.sourceBefore.passed);
      const phase = call.sourceAfter.phase, boundary = first.level !== second.level || first.state !== second.state;
      assert.equal(phase.epoch, second.level); assert.equal(phase.commands.length, phase.states.length - 1);
      assert.deepEqual(phase.states.at(-1).rows, second.frame_rows);
      assert.equal(phase.states.at(-1).ref, call.after.observation_ref);
      assert.equal(phase.states.at(-1).frame, call.after.frame_hash);
      if (boundary) {
        assert.equal(phase.states.length, 1); assert.deepEqual(phase.commands, []);
        assert.deepEqual(Object.keys(phase.geometry).sort(), Object.keys(phase.masks).sort());
        if (second.levels_completed <= first.levels_completed) assert.equal(phase.portable, null);
        if (phase.portable) assert.equal(phase.portable.start, call.after.observation_ref);
      } else {
        const previous = call.sourceBefore.phase.epoch === first.level ? call.sourceBefore.phase.commands : [];
        assert.deepEqual(phase.commands, [...previous,
          call.command.data && Object.keys(call.command.data).length ? null : call.command.action_ref]);
        assert.equal(phase.states.at(-2).ref, call.before.observation_ref);
      }
      state.calls.push(call);
    }
    for (const checkpoint of row.linkedTemporalCheckpoints) {
      assert.equal(state.role, 'candidate'); assert.equal(checkpoint.index, state.checkpoints.length);
      assert.equal(checkpoint.state.schema, 'logos-engine.linked-temporal-preparation.v1');
      assert.deepEqual(Object.keys(checkpoint.state).sort(), ['current_observation', 'events', 'passed', 'phase', 'schema']);
      state.checkpoints.push(checkpoint);
    }
    await this.graph(state, row);
    if (inspection) state.shape.inspection.push({ graphNodes: row.snapshot.nodeCount });
    else {
      state.shape.requests.push({ type: request.type, sequence: request.sequence, kind: row.result.kind, actions: row.snapshot.actions });
      state.shape.observations.push(observationShape(row));
      Object.assign(state.shape, { actions: row.snapshot.actions, cycles: row.snapshot.cycles,
        levelsCompleted: row.snapshot.levelsCompleted, final: finalShape(row.snapshot) });
    }
    state.last = row;
  }
  classifyFact(node, state) {
    assert.equal(node.kind, 'component_state'); assert.equal(node.component, 'native_reasoning_fact');
    const fact = nodeValue(node, state.nodes);
    assert.equal(fact.episode, EPISODE); assert.equal(node.id, `reasoning:fact:${symbolicDigest([fact.episode, fact.key])}`);
    assert.match(fact.key, /^linked_preparation_event:\d+$/, 'No unconsumed extra state fact is admitted');
    const call = state.calls.find(item => fact.key === `linked_preparation_event:${item.before.revision}`
      && isDeepStrictEqual(fact.value, item.returnValue));
    assert.ok(call && !call.selected && call.returnValue.length > 0,
      'A passive event fact must bind the nonempty raw return of exactly one actual source call');
    assert.equal(fact.evidence, call.after.observation_ref); assert.equal(fact.revision, call.after.revision);
    return { category: 'linkedTemporal_source_event_fact',
      factKey: fact.key, sourceCallIndex: call.index, sourceEventCount: call.returnValue.length,
      beforeObservation: call.before.observation_ref, afterObservation: call.after.observation_ref,
      officialBoundary: call.before.level_epoch !== call.after.level_epoch };
  }
  async qualifySharedCatchup(left, right, a, b, delta) {
    const id = delta.node.id, key = sharedKey(a, id), expected = this.sharedLedger.get(key);
    assert.ok(expected, 'No closed-ledger entry for a displaced first creation');
    assert.equal(this.closedShared.has(key), false, 'A shared first creation may be paired only once');
    const records = {}, consumers = {};
    for (const state of [left, right]) {
      const role = state.role, entry = expected[role], record = state.fragmentCreations.get(id);
      assert.ok(record && record.delta.node.revision === 1);
      const view = { ...await eventView(record), node: record.delta.node };
      assert.deepEqual(view, entry.creation, 'Actual immutable creation differs from the closed ledger');
      assert.deepEqual(record.delta.cause, creationCause(role));
      assert.equal(record.delta.node.origin.source_digest, state.runtimeDigest);
      for (const field of ['workflow', 'step', 'statement']) assert.equal(record.delta.node.origin[field], record.delta.cause[field]);
      assert.deepEqual(encodedReferences(record.delta.node.value.node), [], 'Only terminal fragments are qualified');
      assert.equal(canonicalHash(record.delta.node.value), expected.canonicalValueSha256);
      assert.equal(id, `state_fragment:${symbolicDigest(record.delta.node.value, false)}`);
      const first = state.firstFragmentConsumers.get(id); assert.ok(first);
      assert.ok(first.delta.sequence > record.delta.sequence && first.pointIndex === record.pointIndex);
      const paths = fragmentTrails(first.delta.node.value.root, state.nodes, id);
      assert.deepEqual({ ...await eventView(first), references: paths }, entry.firstConsumer,
        'The actual first consumer differs from the retained causal root');
      records[role] = record; consumers[role] = first;
    }
    assert.equal(records.baseline.delta, delta);
    assert.equal(records.baseline.pointIndex, a.pointIndex);
    assert.ok(records.candidate.pointIndex < records.baseline.pointIndex);
    assert.equal(consumers.candidate.delta.node.id, IDS[0]);
    assert.deepEqual(consumers.candidate.delta.cause, creationCause('candidate'));
    const candidateConsumersAtCreation = [], earlierCandidateOwnerConsumers = [];
    for (const consumer of right.sharedFragmentConsumers.get(id) ?? []) {
      const paths = fragmentTrails(consumer.delta.node.value.root, right.nodes, id);
      const view = { ...await eventView(consumer), references: paths };
      if (consumer.pointIndex === records.candidate.pointIndex) candidateConsumersAtCreation.push(view);
      if (consumer.pointIndex < records.baseline.pointIndex) {
        assert.equal(consumer.delta.node.id, IDS[0], 'No common root may consume the fragment before the A catch-up');
        for (const reference of paths) assert.match(reference.path,
          /^\$\.value\.root\.members\.phase\.members\.masks\.members\.[a-f0-9]{64}(?:\.parts\[\d+\])?$/);
        earlierCandidateOwnerConsumers.push(view);
      }
    }
    assert.deepEqual(candidateConsumersAtCreation, expected.candidate.consumerRootsAtFirstPoint,
      'All candidate consumers at first creation must match the closed owner-only register');
    assert.ok(earlierCandidateOwnerConsumers.length > 0);
    assert.match(consumers.baseline.delta.node.id, /^reasoning:transition:\d+$/);
    const x = records.baseline.delta.node, y = records.candidate.delta.node;
    assert.deepEqual(x.value, y.value, 'Complete shared fragment values changed');
    assert.deepEqual(Object.fromEntries(Object.entries(x).filter(([name]) => name !== 'origin')),
      Object.fromEntries(Object.entries(y).filter(([name]) => name !== 'origin')));
    assert.deepEqual(Object.fromEntries(Object.entries(x.origin).filter(([name]) => !['source_digest', 'workflow', 'step', 'statement'].includes(name))),
      Object.fromEntries(Object.entries(y.origin).filter(([name]) => !['source_digest', 'workflow', 'step', 'statement'].includes(name))));
    const attribution = this.result.nodeAttributions.find(item => item.case === a.case && item.form === a.form
      && item.nodeId === id && item.deltaSequence === records.candidate.delta.sequence
      && item.pointIndex === records.candidate.pointIndex);
    assert.ok(attribution && attribution.category === 'linkedTemporal_referenced_state_fragment'
      && attribution.parentNodes.includes(IDS[0]), 'The earlier B creation must already have actual owner attribution');
    const firstOwner = this.result.nodeAttributions.find(item => item.case === a.case && item.form === a.form
      && item.nodeId === IDS[0] && item.deltaSequence === consumers.candidate.delta.sequence);
    assert.ok(firstOwner && Number.isSafeInteger(firstOwner.checkpointIndex),
      'The first owner root must equal a checkpoint actually returned in the captured execution');
    const actualBaselineConsumers = [];
    const commonRootReuses = [];
    for (const root of left.rootEventsAtPoint) {
      const paths = fragmentTrails(root.delta.node.value.root, left.nodes, id);
      if (!paths.length) continue;
      actualBaselineConsumers.push({ ...await eventView(root), references: paths });
      const same = right.rootEventsAtPoint.find(other => other.delta.node.id === root.delta.node.id
        && other.delta.node.revision === root.delta.node.revision);
      assert.ok(same, 'The common B root must actually reuse this fragment at the A creation point');
      assert.deepEqual(root.delta.cause, same.delta.cause);
      commonNode(root.delta.node, same.delta.node, left.runtimeDigest, right.runtimeDigest);
      assert.deepEqual(root.delta.node.value, same.delta.node.value,
        'The complete encoded common consumer root changed at catch-up');
      assert.deepEqual(fragmentTrails(same.delta.node.value.root, right.nodes, id), paths);
      commonRootReuses.push({ nodeId: root.delta.node.id, revision: root.delta.node.revision,
        baselineDeltaSequence: root.delta.sequence, candidateDeltaSequence: same.delta.sequence,
        baselineDeltaDigest: root.delta.digest, candidateDeltaDigest: same.delta.digest,
        encodedValueSha256: canonicalHash(root.delta.node.value), completeEncodedValuesEqual: true,
        exactCause: root.delta.cause, references: paths });
    }
    assert.deepEqual(actualBaselineConsumers, expected.baseline.consumerRootsAtFirstPoint);
    assert.ok(commonRootReuses.length > 0);
    assert.equal(b.knowledge.deltasAdded.some(item => item.node.id === id), false,
      'B must reuse the earlier creation without another fragment delta');
    right.sharedCatchupCount++;
    right.qualifiedShared.set(id, { baseline: x, candidate: y }); this.closedShared.add(key);
    this.result.sharedFragmentCatchups.push({ case: a.case, form: a.form, fragmentId: id,
      canonicalValueSha256: expected.canonicalValueSha256, baseline: expected.baseline,
      candidate: expected.candidate, earlierCandidateAttribution: attribution,
      firstOwnerCheckpointIndex: firstOwner.checkpointIndex, earlierCandidateOwnerConsumers, commonRootReuses,
      completeValuesEqual: true, otherCompleteNodeFieldsEqual: true, terminalFragment: true,
      baselineCatchupOrdinal: right.sharedCatchupCount });
  }
  async attribute(left, right, a, b) {
    const extraIds = Object.keys(right.nodes).filter(id => !own(left.nodes, id)).sort(compareUnicode);
    assert.deepEqual(Object.keys(left.nodes).filter(id => !own(right.nodes, id)), [], 'An existing node disappeared');
    for (const id of IDS) assert.ok(extraIds.includes(id), 'LinkedTemporal installation node is missing');
    const categories = new Map();
    for (const id of extraIds) {
      const node = right.nodes[id];
      if (IDSET.has(id)) categories.set(id, { category: id === IDS[0] ? 'linkedTemporal_owner_state' : 'linkedTemporal_installation' });
      else if (node.kind !== 'state_fragment') categories.set(id, this.classifyFact(node, right));
    }
    // Trace each extra fragment through a real persisted owner/fact/index root,
    // including a superseded root retained in an earlier delta. No arbitrary
    // node-count allowance or removal of a subtree is used.
    for (const delta of b.knowledge.deltasAdded) {
      if (categories.has(delta.node.id) || delta.node.id === 'reasoning:memory') right.ownRoots.push(delta.node);
    }
    const references = new Map();
    for (const node of right.ownRoots) {
      if (node.id === 'reasoning:memory') {
        const index = nodeValue(node, right.nodes);
        if (!index.facts?.some(id => categories.get(id)?.category?.startsWith('linkedTemporal_source_'))) continue;
      }
      for (const id of fragmentReferences(node.value, right.nodes)) {
        const parents = references.get(id) ?? new Set(); parents.add(node.id); references.set(id, parents);
      }
    }
    for (const id of extraIds) if (right.nodes[id].kind === 'state_fragment') {
      assert.ok(references.has(id), 'New fragment has no LinkedTemporal owner/fact/index provenance: ' + id);
      // Hydration validates referenced fragment hash and encoding. The fragment
      // content itself is also compared to the content-addressed node identity.
      assert.equal(id, `state_fragment:${symbolicDigest(right.nodes[id].value, false)}`);
      categories.set(id, { category: 'linkedTemporal_referenced_state_fragment', parentNodes: [...references.get(id)].sort(compareUnicode) });
    }
    assert.equal(categories.size, extraIds.length, 'A new graph node remains unattributed');
    const catchups = new Set();
    for (const delta of a.knowledge.deltasAdded) if (this.sharedLedger.has(sharedKey(a, delta.node.id))) {
      await this.qualifySharedCatchup(left, right, a, b, delta); catchups.add(delta.sequence);
    }
    for (const id of Object.keys(left.nodes)) {
      const shared = right.qualifiedShared.get(id);
      if (shared) {
        assert.deepEqual(left.nodes[id], shared.baseline); assert.deepEqual(right.nodes[id], shared.candidate);
        assert.equal(left.nodes[id].origin.source_digest, left.runtimeDigest);
        assert.equal(right.nodes[id].origin.source_digest, right.runtimeDigest);
      } else commonNode(left.nodes[id], right.nodes[id], left.runtimeDigest, right.runtimeDigest);
      if (left.nodes[id].kind === 'state_fragment') assert.deepEqual(left.nodes[id].value, right.nodes[id].value,
        'A common complete immutable fragment value changed');
    }
    const baselineCommon = a.knowledge.deltasAdded.filter(delta => !catchups.has(delta.sequence));
    const common = b.knowledge.deltasAdded.filter(delta => !categories.has(delta.node.id));
    assert.equal(common.length, baselineCommon.length, 'Common delta count changed after exact declared catch-ups');
    for (let index = 0; index < common.length; index++) {
      const x = baselineCommon[index], y = common[index];
      assert.deepEqual([x.node.id, x.node.kind, x.node.revision, x.cause], [y.node.id, y.node.kind, y.node.revision, y.cause],
        'Common delta identities, causes or order changed');
      commonNode(x.node, y.node, left.runtimeDigest, right.runtimeDigest);
    }
    for (const delta of b.knowledge.deltasAdded.filter(item => categories.has(item.node.id))) {
      const node = delta.node; let explanation = categories.get(node.id);
      if (IDSET.has(node.id)) {
        if (node.revision === 1) {
          assert.deepEqual(delta.cause, { workflow: 'v6.composition_strategy.choose', step: 'initialize', statement: 'family.install' });
          if (node.id === IDS[0]) {
            assert.equal(node.kind, 'family_state'); assert.equal(node.family, OWNER);
            assert.deepEqual(node.relations, [{ relation: 'controlled_by', target: IDS[1] }]);
          } else { assert.equal(node.id, IDS[1]); assert.deepEqual(nodeValue(node, right.nodes), { enabled: true }); }
        } else { assert.equal(node.id, IDS[0]); assert.equal(delta.cause.workflow, 'v6.composition_strategy.choose'); }
        if (node.id === IDS[0]) {
          const envelope = nodeValue(node, right.nodes); assert.equal(envelope.schema, 'logos-engine.linked-temporal-preparation.v1');
          const checkpoint = right.checkpoints.find(item => isDeepStrictEqual(item.state, envelope));
          assert.ok(checkpoint, 'A linked owner root must equal an actual immutable checkpoint returned during this session');
          explanation = { ...explanation, checkpointIndex: checkpoint.index, sourceStateSha256: canonicalHash(envelope), epoch: envelope.phase.epoch,
            retainedEvents: envelope.events.map(event => ({ kind: event.kind, source: event.source ?? null })) };
          for (const event of envelope.events) assert.ok(right.calls.some(call =>
            call.sourceAfter.events.some(known => isDeepStrictEqual(known, event))), 'Owner event has no actual acquired source call');
        }
      } else if (node.kind !== 'state_fragment') explanation = this.classifyFact(node, right);
      this.result.nodeAttributions.push({ case: b.case, form: b.form, pointIndex: b.pointIndex, request: b.request.type,
        requestSequence: b.request.sequence, deltaSequence: delta.sequence, nodeId: node.id, kind: node.kind,
        revision: node.revision, cause: delta.cause, evidence: node.evidence, nodeSha256: await digest(node), ...explanation });
      right.ownDeltaCount++;
    }
    assert.equal(right.revision - left.revision, right.ownDeltaCount - right.sharedCatchupCount,
      'Revision difference is not the exact cumulative B additions minus observed A catch-ups');
    assert.equal(b.snapshot.nodeCount - a.snapshot.nodeCount, categories.size, 'Node difference is not exactly the attributed actual nodes');
    this.result.points.push({ case: b.case, form: b.form, pointIndex: b.pointIndex, request: b.request.type,
      sequence: b.request.sequence, baselineNodeCount: a.snapshot.nodeCount, candidateNodeCount: b.snapshot.nodeCount,
      baselineGraphRevision: left.revision, candidateGraphRevision: right.revision,
      addedNodeIds: extraIds, attributedCumulativeDeltas: right.ownDeltaCount,
      matchedBaselineCatchupDeltas: right.sharedCatchupCount,
      netAttributedDeltaDifference: right.ownDeltaCount - right.sharedCatchupCount,
      officialBoundarySourceCalls: b.linkedTemporalCalls.filter(call => call.before.level_epoch !== call.after.level_epoch).map(call => call.index) });
  }
  end(state, row, ordinal) {
    const receipt = this.receipts[state.role].sessions[ordinal];
    assert.equal(state.pending, null); assert.equal(row.status, 'captured_functional_structure');
    assert.equal(row.terminalResumePerformed, false); assert.equal(row.commands, state.commands);
    assert.equal(state.shape.actions, state.start.actionsLimit); assert.equal(state.shape.final.acquiredTransitions, state.shape.actions);
    assert.equal(state.shape.inspection.length, state.start.form === 'measured' ? 3 : 0);
    assert.equal(row.terminalInspections, state.shape.inspection.length); assert.equal(row.captures, state.shape.requests.length);
    assert.equal(row.linkedTemporalRecordCalls, state.calls.length);
    assert.equal(row.linkedTemporalCheckpoints, state.checkpoints.length);
    assert.equal(state.calls.length, state.role === 'candidate' ? state.shape.actions : 0);
    assert.deepEqual(row.shape, state.shape); assert.deepEqual(receipt.shape, state.shape);
    for (const key of ['case', 'form', 'sessionId', 'status', 'commands', 'captures', 'terminalInspections', 'linkedTemporalRecordCalls', 'linkedTemporalCheckpoints']) assert.deepEqual(row[key], receipt[key]);
  }
  async captures() {
    const streams = [streamCapture(this.paths.baseline), streamCapture(this.paths.candidate)];
    let states = null, ordinal = 0, preflight = false, footer = false;
    try {
      while (true) {
        const [left, right] = await Promise.all(streams.map(stream => stream.next()));
        assert.equal(left.done, right.done, 'Capture streams have different lengths'); if (left.done) break;
        const a = left.value, b = right.value; assert.equal(a.type, b.type, 'Recorded operations differ between sources');
        if (a.type === '$header' || a.type === '$footer') {
          for (const [role, row] of [['baseline', a.value], ['candidate', b.value]]) {
            const receipt = this.receipts[role];
            if (a.type === '$header') {
              assert.equal(row.schema, 'logos-engine.lot5a-owner-cost-functional-capture.v1');
              assert.equal(row.role, role); assert.equal(row.checkout, receipt.checkout); assert.equal(row.startedAt, receipt.startedAt);
            } else { assert.equal(row.status, receipt.status); assert.equal(row.finishedAt, receipt.finishedAt); }
          }
          if (a.type === '$footer') { assert.equal(states, null); assert.equal(ordinal, 4); footer = true; }
          continue;
        }
        assert.equal(a.recordIndex, b.recordIndex);
        if (a.type === 'preflight') {
          assert.equal(preflight, false); preflight = true;
          for (const [role, row] of [['baseline', a], ['candidate', b]]) {
            const receipt = this.receipts[role]; assert.deepEqual(row.nativeSource, receipt.nativeInventoryBefore);
            assert.deepEqual(row.manifest, receipt.nativeSourceBefore); assert.deepEqual(row.inputs, receipt.inputsBefore);
            assert.deepEqual(row.generator, this.captureTool); assert.deepEqual(row.cases, this.casesRecord);
            assert.equal(row.measuredCostSessions, 0); assert.equal(row.plannedSessions, 4); assert.equal(row.plannedActions, 31);
          }
        } else if (a.type === 'session_start') {
          assert.ok(preflight && states === null && ordinal < 4);
          states = [this.start('baseline', a, ordinal), this.start('candidate', b, ordinal)];
        } else {
          assert.ok(states);
          for (const [state, row] of [[states[0], a], [states[1], b]]) assert.deepEqual([row.case, row.form, row.sessionId],
            [state.start.case, state.start.form, state.start.sessionId]);
          if (['capture', 'terminal_inspection'].includes(a.type)) {
            await this.checked(`graphs:${a.case}:${a.form}:${a.pointIndex}`, async () => {
              assert.deepEqual([a.request.type, a.request.sequence, a.pointIndex], [b.request.type, b.request.sequence, b.pointIndex]);
              await this.point(states[0], a); await this.point(states[1], b);
              await this.attribute(states[0], states[1], a, b);
            });
          } else if (a.type === 'command_checked') {
            this.command(states[0], a); this.command(states[1], b);
            assert.deepEqual([a.actualCommand, a.publicPacket], [b.actualCommand, b.publicPacket]);
          } else if (a.type === 'session_end') {
            await this.checked(`shape:${a.case}:${a.form}`, async () => {
              this.end(states[0], a, ordinal); this.end(states[1], b, ordinal);
              assertSameWork(states[0].shape, states[1].shape);
              this.forms.push({ case: a.case, form: a.form, baseline: states[0].shape, candidate: states[1].shape });
            });
            states = null; ordinal++;
          } else throw new Error('Capture failure or unsupported record: ' + a.type);
        }
      }
      assert.ok(footer && preflight && states === null && this.forms.length === 4);
      assert.deepEqual([...this.closedShared].sort(compareUnicode), [...this.sharedLedger.keys()].sort(compareUnicode),
        'Every closed-ledger creation must be observed and paired exactly once');
    } finally { await Promise.all(streams.map(stream => stream.return())); }
  }
}

async function main() {
  const args = process.argv.slice(2);
  assert.equal(args.length, 7, 'Usage: node SCRIPT BASELINE.gz BASELINE.receipt.json CANDIDATE.gz CANDIDATE.receipt.json SUPPLEMENT.json ATTRIBUTION.json FIXTURE.json');
  const [baseline, baselineReceipt, candidate, candidateReceipt, supplement, attribution, fixture] = args.map(path => resolve(ROOT, path));
  for (const path of [attribution, fixture]) {
    assert.ok(path.startsWith(BASE + sep) && path.endsWith('.json')); await absent(path); await mkdir(dirname(path), { recursive: true });
  }
  const audit = new Qualification({ baseline, baselineReceipt, candidate, candidateReceipt, supplement });
  try {
    await audit.checked('immutable_capture_provenance_before_measurement', () => audit.provenance());
    await audit.captures();
    await audit.checked('all_inputs_unchanged_and_no_window_started', async () => {
      for (const record of audit.inputs.values()) assert.deepEqual(await fingerprint(record.path), record);
      await absent(resolve(audit.performanceDirectory, 'window.json')); await absent(resolve(audit.performanceDirectory, 'readiness.json'));
      assert.ok(audit.result.nodeAttributions.length > 0);
    });
    audit.result.status = 'qualified_functional_structure';
  } catch (error) { audit.result.failures.push(errorRecord(error)); }
  audit.result.recordedAt = new Date().toISOString(); audit.result.inputs = [...audit.inputs.values()];
  audit.result.checkedCount = audit.result.checks.length;
  audit.result.formsSha256 = canonicalHash(audit.forms);
  audit.result.qualification = 'Every captured graph reconstructs from its exact complete Kernel delta chain using its own frozen validator and identical value codecs. Candidate additions retain explicit installation, actual checkpoint, raw passive event or reachable-fragment attribution. The premeasurement supplement closes exactly 14 terminal-mask first-creator differences: each complete content-addressed value and other node field is equal, each actual source digest and cause is retained, B first consumes it through the added owner, and the later common reasoning roots in both versions have identical complete encoded values and causes. Every other common metadata/delta identity/cause/order remains exact apart from declared source digests. At every point, revisionB-minus-revisionA equals all actual attributed B deltas minus the explicitly matched A creation deltas; no delta or cause is rewritten. All common fragment values are compared in full, but equality of every private root value is not asserted. Forms are fixed before costs. No timing correction, discarded measurement, future-run result or full graph/caller semantic parity is inferred.';
  await writeFile(attribution, JSON.stringify(audit.result, null, 2) + '\n', { flag: 'wx' });
  if (audit.result.status === 'qualified_functional_structure') {
    const value = { schema: 'logos-engine.lot5a-owner-cost-structural-fixture.v1', status: 'qualified_functional_structure',
      recordedAt: new Date().toISOString(), nativeDigests: audit.result.nativeDigests, cases: audit.casesRecord,
      captureTool: audit.captureTool, captures: {
        baseline: { report: await fingerprint(baseline), receipt: await fingerprint(baselineReceipt) },
        candidate: { report: await fingerprint(candidate), receipt: await fingerprint(candidateReceipt) },
      }, attribution: await fingerprint(attribution), forms: audit.forms };
    await writeFile(fixture, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  } else process.exitCode = 1;
  console.log(JSON.stringify({ status: audit.result.status, attribution: label(attribution),
    fixture: audit.result.status === 'qualified_functional_structure' ? label(fixture) : null,
    checks: audit.result.checkedCount, attributedDeltas: audit.result.nodeAttributions.length,
    sharedFragmentCatchups: audit.result.sharedFragmentCatchups.length, forms: audit.forms.length,
    failures: audit.result.failures }));
}

await main();
