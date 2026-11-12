#!/usr/bin/env node
/** Review published 0.66 / candidate 8B work forms, five-owner observations and each complete graph.
 * CLI: node SCRIPT INVENTORY.json BASELINE.gz BASELINE.receipt.json CANDIDATE.gz CANDIDATE.receipt.json REVIEW.json FORMS.json
 * Reads functional captures only. No runtime, replay, game or timing report runs.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { once } from 'node:events';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createGunzip, createGzip, gunzipSync } from 'node:zlib';
import { digest, compareUnicode } from '../../../../../../src/logos-engine/canonical.ts';
import { decodeNativeState, NATIVE_STORE_PROFILE } from '../../../../../../src/logos-engine/v6-knowledge-store.ts';
import { hydrateNativeState, isNativeStateGraph } from '../../../../../../src/logos-engine/v6-native-state-graph.ts';
import { symbolicDigest } from '../../../../../../src/logos-engine/v6-hash.ts';
import { V6_NATIVE_PROGRAM_REFERENCE } from '../../../../../../src/logos-engine/v6-src-program.ts';

const SCRIPT = fileURLToPath(import.meta.url), ROOT = resolve(dirname(SCRIPT), '../../../../../..');
const BASE = resolve(ROOT, 'docs/migration/lot8b-evidence');
const TOOL_DIRECTORY = resolve(BASE, 'tools/delivery/work-forms');
const CAPTURE_TOOL = resolve(TOOL_DIRECTORY, 'capture-cost-owner-graphs.mjs');
const INVENTORY_TOOL = resolve(TOOL_DIRECTORY, 'record-owner-source-inventory.mjs');
const DERIVED_FROM = resolve(ROOT, 'docs/migration/lot8a-evidence/tools/work-forms/qualify-cost-owner-graphs.mjs');
const CAPTURE_DERIVATION = resolve(ROOT, 'docs/migration/lot8a-evidence/tools/work-forms/capture-cost-owner-graphs.mjs');
const POLICY_PATH = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/strategy.drm';
const OWNER = 'branch_routing';
const OWNERS = { binding: 'public_observed_binding', selectedRigid: 'selected_rigid', motif: 'motif_access',
  recruitment: 'public_ordered_recruitment', branchRouting: OWNER };
const WRAPPED_OWNERS = new Set(['motif', 'branchRouting']);
const PUBLISHED_BASELINE = '4ff7bf45286a8a19d34401988adca587253ae41e';
const EXPECTED = {
  baseline: { fileCount: 329, digest: 'ab674682f3345b09bec94959174fbb5bf0f1bd06154693697e5814987b572316' },
  candidate: { fileCount: 331, digest: '3ff1d9ad56e22aedc0fee3a0da6a3af50a1da0bc14a0ba01cb38272ba85234be' },
};
const IDS = [`family_state:${OWNER}`, `family_activation:${OWNER}`];
const IDSET = new Set(IDS);
const SOURCE_PROOFS = ['src/logos-engine/v6-native-runtime.ts', 'src/logos-engine/v6-motif-access.ts',
  'src/logos-engine/v6-motif-access-geometry.ts', 'src/logos-engine/v6-observed-binding.ts',
  'src/logos-engine/v6-selected-rigid.ts', 'src/logos-engine/v6-reasoning-memory.ts',
  'src/logos-engine/v6-ordered-recruitment.ts', 'src/logos-engine/v6-ordered-recruitment-geometry.ts',
  'src/logos-engine/v6-ordered-recruitment-policy.ts', 'src/logos-engine/v6-ordered-recruitment-projection.ts',
  'src/logos-engine/v6-branch-routing.ts', 'src/logos-engine/v6-branch-routing-geometry.ts',
  'src/logos-engine/v6-native-authority.ts', 'src/logos-engine/v6-knowledge-store.ts', 'src/logos-engine/kernel.ts'];
const ROLE_VALIDATORS = ['src/logos-engine/kernel.ts', 'src/logos-engine/v6-knowledge-store.ts'];
const COMMON_VALIDATORS = ['src/logos-engine/canonical.ts',
  'src/logos-engine/v6-native-state-graph.ts', 'src/logos-engine/v6-hash.ts', 'src/logos-engine/v6-src-program.ts', 'src/logos-engine/v6/programs.json',
  'src/runtime/v6-agent-service.ts', 'src/logos-engine/v6-reasoning-memory.ts', 'src/logos-engine/v6-native-authority.ts'];
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
const MISSING = Symbol('missing');
const descriptor = value => value === MISSING ? { present: false } : value !== null && typeof value === 'object'
  ? { present: true, kind: Array.isArray(value) ? 'array' : 'object', keys: Object.keys(value) }
  : { present: true, kind: value === null ? 'null' : typeof value, value };
function exactCreatedEncoding(node, proof) {
  if (node.value?.root?.kind !== 'object' || !own(node.value.root.members ?? {}, 'created')) return false;
  const encoded = node.value.root.members.created;
  if (typeof encoded === 'number') return Number.isSafeInteger(encoded) && Object.is(encoded, proof.created);
  if (!encoded || typeof encoded !== 'object' || Array.isArray(encoded)
    || !isDeepStrictEqual(Object.keys(encoded).sort(), ['bits', 'kind']) || encoded.kind !== 'float64'
    || typeof encoded.bits !== 'string' || !/^[0-9a-f]{16}$/.test(encoded.bits)) return false;
  return Object.is(Buffer.from(encoded.bits, 'hex').readDoubleBE(0), proof.created);
}
const pointer = value => String(value).replaceAll('~', '~0').replaceAll('/', '~1');
async function differences(a, b, path, visit) {
  if (isDeepStrictEqual(a, b)) return;
  const objectA = a !== MISSING && a !== null && typeof a === 'object';
  const objectB = b !== MISSING && b !== null && typeof b === 'object';
  if (!objectA && !objectB) { await visit(path, descriptor(a), descriptor(b)); return; }
  if (!objectA || !objectB || Array.isArray(a) !== Array.isArray(b)) await visit(path, descriptor(a), descriptor(b));
  const keys = [...new Set([...(objectA ? Object.keys(a) : []), ...(objectB ? Object.keys(b) : [])])].sort(compareUnicode);
  for (const key of keys) await differences(objectA && own(a, key) ? a[key] : MISSING,
    objectB && own(b, key) ? b[key] : MISSING, path + '/' + pointer(key), visit);
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

class Qualification {
  constructor(paths, writeDifference) {
    this.writeDifference = writeDifference;
    this.paths = paths; this.inputs = new Map(); this.forms = []; this.traces = new Map(); this.receipts = {}; this.stores = {};
    this.result = { schema: 'logos-engine.lot8b-delivery-work-graph-review.v1',
      status: 'functional_structure_qualification_failed', startedAt: new Date().toISOString(),
      checks: [], nodeAttributions: [], points: [], failures: [], commandBoundaryProjections: [], sourceFactCoverage: [],
      commonValueCoverage: [], commonValuePolicy: { comparison: 'exact', permittedMetadataDifference: 'origin.source_digest',
        identityValueAttributions: [], unattributedDifferencesAllowed: 0 },
      preparedOnly: true, officialPerformanceEligible: false, strictCommonGraphParity: false,
      publishedBaseline: { site: 107, sourceCommit: PUBLISHED_BASELINE, nativeVersion: '0.66.0' }, candidatePublished: false,
      differenceCount: 0, unattributedDifferenceCount: 0, differenceClasses: {}, differenceExamples: [],
      traceClockBounds: [], ownerCheckpointCoverage: [], sourceFactCoverage: [] };
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
    this.result.derivedFrom = await this.input(DERIVED_FROM);
    this.captureTool = await this.input(CAPTURE_TOOL);
    this.captureDerivation = await this.input(CAPTURE_DERIVATION);
    for (const role of ['baseline', 'candidate']) {
      const receiptPath = this.paths[role + 'Receipt']; await this.input(receiptPath);
      const receipt = await read(receiptPath); this.receipts[role] = receipt;
      assert.equal(receipt.schema, 'logos-engine.lot8b-delivery-owner-cost-functional-capture-receipt.v1');
      assert.equal(receipt.status, 'captured_functional_structure'); assert.equal(receipt.role, role);
      assert.deepEqual(receipt.owners, OWNERS); assert.equal(receipt.acquisitionMode, 'observed_five_owner_composition');
      assert.deepEqual(receipt.publishedBaseline, this.result.publishedBaseline); assert.equal(receipt.candidatePublished, false);
      assert.equal(receipt.preparedOnly, true); assert.equal(receipt.globalLockUsed, false); assert.equal(receipt.officialPerformanceEligible, false);
      assert.deepEqual({ fileCount: receipt.nativeInventoryBefore.fileCount, digest: receipt.nativeDigest }, EXPECTED[role]);
      if (role === 'baseline') assert.equal(receipt.sourceCommit, PUBLISHED_BASELINE);
      assert.equal(receipt.nativeDigest, receipt.nativeInventoryBefore.digest);
      assert.equal(receipt.nativeVersion, '0.66.0');
      assert.deepEqual(receipt.nativeInventoryBefore, receipt.nativeInventoryAfter);
      assert.deepEqual(receipt.nativeSourceBefore, receipt.nativeSourceAfter);
      assert.deepEqual(receipt.inputsBefore, receipt.inputsAfter); assert.deepEqual(receipt.generator, receipt.generatorAfter);
      assert.deepEqual(receipt.generator, this.captureTool); assert.deepEqual(receipt.failures, []);
      assert.deepEqual(receipt.derivedFrom, this.captureDerivation);
      for (const key of ['nativeSourceUnchanged', 'inputsUnchanged', 'generatorUnchanged']) assert.equal(receipt[key], true);
      for (const key of ['measuredCostSessions', 'timingReportsRead', 'timingMetricsProduced']) assert.equal(receipt[key], 0);
      assert.equal(receipt.sessionCount, 4); assert.equal(receipt.actions, 31);
      assert.ok(Date.parse(receipt.finishedAt) >= Date.parse(receipt.startedAt));
      assert.deepEqual(await read(await this.recorded(receipt.nativeSourceBefore)), receipt.nativeInventoryBefore);
      await this.recorded(receipt.cases);
      assert.equal(await this.recorded(receipt.report), this.paths[role]);
      assert.equal(new Set(receipt.inputsBefore.map(row => row.path)).size, receipt.inputsBefore.length);
      for (const record of receipt.inputsBefore) await this.recorded(record);
      for (const required of [receipt.cases, receipt.nativeSourceBefore, receipt.generator, receipt.derivedFrom]) {
        assert.ok(receipt.inputsBefore.some(record => isDeepStrictEqual(record, required)), 'Capture input binding is missing');
      }
      const policyInput = receipt.inputsBefore.find(record => resolve(ROOT, record.path) === resolve(receipt.checkout, POLICY_PATH));
      assert.ok(policyInput, 'The actual source policy is absent from the capture');
      const policy = (await read(policyInput.path)).declarations[0].configuration.selected_rigid_question;
      assert.ok(policy, 'Pinned SelectedRigid policy is missing');
      if (this.selectedRigidPolicy) assert.deepEqual(policy, this.selectedRigidPolicy, 'Pinned SelectedRigid policy changed between roles');
      else this.selectedRigidPolicy = policy;
    }
    await this.input(this.paths.inventory);
    const inventory = await read(this.paths.inventory); this.result.ownerInventory = await fingerprint(this.paths.inventory);
    assert.equal(inventory.schema, 'logos-engine.lot8b-delivery-owner-cost-source-inventory.v1');
    assert.equal(inventory.officialPerformanceEligible, false);
    await this.recorded(inventory.generator); assert.deepEqual(inventory.generator, await this.input(INVENTORY_TOOL));
    await this.recorded(inventory.derivedFrom);
    assert.deepEqual(inventory.changes, { ownersAdded: ['branch_routing'], ownersRemoved: [], programsAdded: [], programsRemoved: [] });
    assert.deepEqual(inventory.publishedBaseline, this.result.publishedBaseline);
    for (const role of ['baseline', 'candidate']) {
      assert.deepEqual(inventory.sourceInventory[role].native, this.receipts[role].nativeInventoryBefore);
      assert.equal(inventory.sourceInventory[role].checkout, this.receipts[role].checkout);
      assert.equal(inventory.sourceInventory[role].sourceCommit, this.receipts[role].sourceCommit);
      assert.equal(inventory.sourceInventory[role].published, role === 'baseline');
    }
    const reasoning = await readFile(resolve(ROOT, 'src/logos-engine/v6-reasoning-memory.ts'), 'utf8');
    const authority = await readFile(resolve(ROOT, 'src/logos-engine/v6-native-authority.ts'), 'utf8');
    assert.ok(reasoning.includes('this.clock = options.clock ?? (() => Date.now() / 1000)'));
    assert.ok(reasoning.includes('created: this.clock()'));
    assert.ok(authority.includes('readonly memory = new NativeReasoningMemory();'));
    this.result.traceClockSource = { memory: await this.input('src/logos-engine/v6-reasoning-memory.ts'),
      authority: await this.input('src/logos-engine/v6-native-authority.ts'),
      derivation: 'Default NativeReasoningMemory clock is unmodified Date.now()/1000; authority constructs it without options. Each new reasoning:trace id must be bounded by its actual service.handle wall-clock interval.' };
    assert.deepEqual(this.receipts.baseline.cases, this.receipts.candidate.cases);
    this.casesRecord = this.receipts.candidate.cases; this.cases = await read(this.casesRecord.path);
    assert.equal(this.cases.schema, 'logos-engine.lot8b-functional-work-cases.v1');
    assert.equal(this.cases.qualificationStage, 'functional_preparation_against_published_066_not_official_cost');
    assert.equal(this.cases.officialPerformanceEligible, false);
    assert.equal(this.cases.plannedSessionsPerRole, 4); assert.equal(this.cases.plannedActionsPerRole, 31);
    assert.equal(Object.hasOwn(this.cases, 'budget'), false); assert.equal(Object.hasOwn(this.cases, 'rounds'), false);
    assert.deepEqual(this.cases.cases.map(row => [row.id, row.warmupActions, row.actions]), [['STCK', 3, 10], ['SMLP', 3, 15]]);
    this.performanceDirectory = dirname(resolve(ROOT, this.casesRecord.path));
    await absent(resolve(this.performanceDirectory, 'window.json')); await absent(resolve(this.performanceDirectory, 'readiness.json'));
    this.result.nativeDigests = Object.fromEntries(['baseline', 'candidate'].map(role => [role, this.receipts[role].nativeDigest]));
    for (const path of SOURCE_PROOFS) {
      const record = await this.input(resolve(ROOT, path));
      assert.equal(record.sha256, this.receipts.candidate.nativeInventoryBefore.files[path]);
    }
    for (const path of COMMON_VALIDATORS) {
      const record = await this.input(resolve(ROOT, path));
      for (const role of ['baseline', 'candidate']) assert.equal(record.sha256, this.receipts[role].nativeInventoryBefore.files[path],
        'Graph validator differs from captured source: ' + role + '/' + path);
    }
    // Validate each frozen role with its captured Kernel/store implementation.
    // The actual predecessor can include the already published common batching
    // work; no historical native version or validator bytes are substituted.
    for (const role of ['baseline', 'candidate']) {
      const receipt = this.receipts[role];
      for (const path of ROLE_VALIDATORS) {
        const record = await this.input(resolve(receipt.checkout, path));
        assert.equal(record.sha256, receipt.nativeInventoryBefore.files[path], 'Role validator changed: ' + role + '/' + path);
        assert.ok(receipt.inputsBefore.some(input => isDeepStrictEqual(input, record)), 'Role validator was not bound by its capture: ' + role + '/' + path);
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
    assert.deepEqual([row.case, row.form, row.sessionId], [item.id, form, `lot8b-delivery-owner-cost-${item.id.toLowerCase()}-${form}`]);
    assert.equal(row.actionsLimit, form === 'warmup' ? item.warmupActions : item.actions);
    assert.deepEqual(row.budgets, { targetLevels: item.targetLevels, levelActionCaps: Array(item.targetLevels).fill(600) });
    assert.equal(row.nativeDigest, this.receipts[role].nativeDigest); assert.equal(row.coldKnowledge, true); assert.equal(row.checkpointSupplied, false);
    assert.deepEqual([row.trace, row.traceSha256], [item.trace, item.traceSha256]);
    const trace = this.traces.get(item.id); assert.deepEqual(row.initialPublicPacket, trace.packets[0].packet);
    return { role, start: row, trace, nodes: {}, revision: 0, chain: null, runtimeDigest: null,
      point: 0, commands: 0, pending: null, last: null,
      ownerOperations: [], ownerCheckpoints: [], ownerCounts: Object.fromEntries(Object.keys(OWNERS).map(key => [key, { operations: 0, checkpoints: 0, proposals: 0, records: 0, restores: 0, refusals: 0 }])),
      traceClocks: new Map(), ownRoots: [], seenAdded: new Set(), seenRemoved: new Set(),
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
      if (delta.node.kind === 'state_fragment') assert.equal(delta.node.id,
        `state_fragment:${symbolicDigest(delta.node.value, false)}`, 'Fragment content and identifier differ');
      const prior = state.nodes[delta.node.id]; assert.equal(delta.node.revision, (prior?.revision ?? 0) + 1);
      if (prior) {
        assert.equal(delta.node.kind, prior.kind); assert.deepEqual(delta.node.origin, prior.origin);
        assert.equal(isDeepStrictEqual({ ...delta.node, revision: prior.revision }, prior), false, 'Fabricated no-op delta');
      }
      assert.equal(await digest({ sequence: delta.sequence, previous: delta.previous, node: delta.node,
        cause: delta.cause, source_digest: delta.source_digest }), delta.digest, 'Invalid Kernel delta hash');
      state.nodes[delta.node.id] = delta.node; state.chain = delta.digest;
    }
    for (const delta of graph.deltasAdded) if (isNativeStateGraph(delta.node.value)) nodeValue(delta.node, state.nodes);
    assert.deepEqual([graph.chain, graph.toRevision, graph.nodeCount], [state.chain, state.revision, Object.keys(state.nodes).length]);
    assert.deepEqual([snapshot.graphChain, snapshot.graphRevision, snapshot.nodeCount], [state.chain, state.revision, Object.keys(state.nodes).length]);
    for (const delta of graph.deltasAdded) {
      if (state.role === 'candidate' && IDSET.has(delta.node.id)) state.ownRoots.push(delta.node);
      if (delta.node.component === 'native_reasoning_trace') {
        const value = nodeValue(delta.node, state.nodes), id = delta.node.id;
        assert.deepEqual(Object.keys(value).sort(), ['body', 'created', 'episode', 'id', 'kind']);
        assert.ok(Number.isSafeInteger(value.id) && value.id > 0);
        assert.equal(id, 'reasoning:trace:' + value.id, 'Trace identifier must be source-derived');
        assert.ok(Number.isFinite(value.created));
        const createdMs = Math.round(value.created * 1000);
        assert.ok(Number.isSafeInteger(createdMs) && Object.is(createdMs / 1000, value.created),
          'Trace creation must be exactly reproducible from integer Date.now milliseconds');
        const previous = state.traceClocks.get(id);
        if (previous) assert.equal(value.created, previous.created, 'A retained trace creation timestamp changed');
        else {
          assert.equal(row.wallClock.source, 'unmodified_Date_now');
          assert.ok(Number.isSafeInteger(row.wallClock.startedMs) && Number.isSafeInteger(row.wallClock.finishedMs));
          assert.ok(row.wallClock.finishedMs >= row.wallClock.startedMs, 'Clock reversal prevents bounded attribution');
          assert.ok(createdMs >= row.wallClock.startedMs && createdMs <= row.wallClock.finishedMs,
            'Trace creation is outside its actual service.handle wall-clock interval');
          const record = { role: state.role, case: row.case, form: row.form, pointIndex: row.pointIndex,
            nodeId: id, created: value.created, createdMs, wallClock: row.wallClock };
          state.traceClocks.set(id, record); this.result.traceClockBounds.push(record);
        }
      }
    }
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
    assert.deepEqual(row.ownerBindings, this.receipts[state.role].sessions.find(session => session.sessionId === row.sessionId).ownerBindings);
    for (const key of Object.keys(OWNERS)) {
      const expected = key === 'branchRouting' && state.role === 'baseline' ? 0 : 1;
      assert.equal(row.ownerBindings[key].id, OWNERS[key]);
      assert.equal(row.ownerBindings[key].registeredInstances, expected);
      assert.equal(row.ownerBindings[key].actualRegisteredOwnerVerified, Boolean(expected));
      assert.equal(row.ownerBindings[key].source, WRAPPED_OWNERS.has(key) ? 'registered_family_wrapper_state_restore' : 'actual_acquisition_family');
      if (!expected) assert.equal(row.ownerStates[key], null);
    }
    assert.deepEqual(row.ownerStates.selectedRigid, { format: 'selected_rigid_events.v1', events: [] },
      'The declared foreign workloads must retain the exact empty SelectedRigid journal');
    assert.equal(row.ownerStates.motif.format, 'native.motif_access.v1');
    if (state.role === 'candidate') assert.equal(row.ownerStates.branchRouting.format, 'native.branch_routing.v1');
    assert.equal(row.pointIndex, state.point++); assert.equal(request.sessionId, state.start.sessionId);
    assert.equal(request.sequence, state.commands); assert.equal(row.snapshot.actions, state.commands);
    assert.equal(row.snapshot.whyAct.enabled, true); assert.equal(row.snapshot.caller.enabled, true);
    if (inspection) {
      assert.equal(request.type, 'inspect'); assert.equal(state.start.form, 'measured');
      assert.equal(state.commands, state.start.actionsLimit); assert.equal(state.pending, null);
      assert.deepEqual(row.knowledge.deltasAdded, []); assert.deepEqual(row.ownerOperations, []);
      assert.deepEqual(row.ownerCheckpoints, []);
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
    for (const operation of row.ownerOperations) {
      assert.equal(operation.ordinal, state.ownerOperations.length); assert.ok(own(OWNERS, operation.owner));
      assert.ok(Number.isSafeInteger(operation.depth) && operation.depth >= 0); assert.equal(own(operation, 'exception'), false);
      assert.ok(own(operation, 'sourceBefore') && own(operation, 'sourceAfter'));
      const counts = state.ownerCounts[operation.owner]; counts.operations++;
      const type = operation.method.startsWith('record') ? 'records' : operation.method.startsWith('restore') ? 'restores'
        : operation.method === 'currentProposalRefusal' ? 'refusals' : 'proposals';
      counts[type]++;
      if (operation.owner === 'selectedRigid') {
        assert.notEqual(type, 'records', 'Fixed work forms must not acquire SelectedRigid returns');
        assert.deepEqual(operation.sourceBefore, { format: 'selected_rigid_events.v1', events: [] });
        assert.deepEqual(operation.sourceAfter, { format: 'selected_rigid_events.v1', events: [] });
      }
      if (operation.owner === 'branchRouting') assert.equal(state.role, 'candidate');
      state.ownerOperations.push(operation);
    }
    for (const checkpoint of row.ownerCheckpoints) {
      assert.equal(checkpoint.ordinal, state.ownerCheckpoints.length); assert.ok(own(OWNERS, checkpoint.owner));
      assert.equal(checkpoint.index, state.ownerCounts[checkpoint.owner].checkpoints++);
      assert.equal(checkpoint.method, WRAPPED_OWNERS.has(checkpoint.owner) ? 'state' : 'nativeState');
      state.ownerCheckpoints.push(checkpoint);
    }
    await this.graph(state, row);
    for (const [key, id] of Object.entries(OWNERS)) {
      const node = state.nodes['family_state:' + id];
      if (key === 'branchRouting' && state.role === 'baseline') { assert.equal(node, undefined); continue; }
      assert.ok(node && node.kind === 'family_state' && node.family === id);
      const checkpointValue = nodeValue(node, state.nodes);
      const matched = state.ownerCheckpoints.findLast(item => item.owner === key && isDeepStrictEqual(item.state, checkpointValue));
      assert.ok(matched, 'Persisted owner state lacks an actual observed checkpoint: ' + id);
      this.result.ownerCheckpointCoverage.push({ role: state.role, case: row.case, form: row.form,
        pointIndex: row.pointIndex, owner: id, nodeRevision: node.revision, checkpointOrdinal: matched.ordinal });
    }
    const facts = Object.values(state.nodes).filter(node => node.component === 'native_reasoning_fact')
      .map(node => ({ node, value: nodeValue(node, state.nodes) }))
      .filter(item => item.value.episode === 'common-observation-frontier');
    for (const [owner, prefix] of [['motif', 'motif'], ['branchRouting', 'branches']]) {
      const calls = state.ownerOperations.filter(operation => operation.owner === owner && operation.method === 'record');
      const acquiredCalls = calls.filter(operation => operation.returnValue?.native_acquisition_incomplete !== true);
      const sourceFacts = facts.filter(item => item.value.key.startsWith(prefix + ':'));
      assert.equal(sourceFacts.length, acquiredCalls.length, 'Source facts must equal successful selected acquisitions: ' + owner);
      for (const fact of sourceFacts) {
        const call = acquiredCalls.find(operation => fact.value.key === prefix + ':' + operation.arguments.before.revision);
        assert.ok(call, 'Source fact has no actual successful selected record: ' + owner);
        assert.deepEqual(fact.value.value, call.returnValue.events[0] ?? null);
        assert.equal(fact.value.evidence, call.arguments.after.observation_ref);
        assert.equal(fact.value.revision, call.arguments.after.revision);
      }
      this.result.sourceFactCoverage.push({ role: state.role, case: row.case, form: row.form, pointIndex: row.pointIndex,
        owner: OWNERS[owner], selectedRecordCalls: calls.length, successfulSelectedAcquisitions: acquiredCalls.length,
        incompleteSelectedAcquisitions: calls.length - acquiredCalls.length, persistedSourceFacts: sourceFacts.length,
        positiveContributionClaim: false, officialSuccessClaim: false });
    }
    if (inspection) state.shape.inspection.push({ graphNodes: row.snapshot.nodeCount });
    else {
      state.shape.requests.push({ type: request.type, sequence: request.sequence, kind: row.result.kind, actions: row.snapshot.actions });
      state.shape.observations.push(observationShape(row));
      Object.assign(state.shape, { actions: row.snapshot.actions, cycles: row.snapshot.cycles,
        levelsCompleted: row.snapshot.levelsCompleted, final: finalShape(row.snapshot) });
    }
    state.last = row;
  }
  async difference(context, path, a, b, classification = 'unattributed_difference', evidence = null) {
    const record = { index: this.result.differenceCount++, ...context, path, baseline: a, candidate: b, classification,
      ...(evidence ? { evidence } : {}) };
    this.result.differenceClasses[classification] = (this.result.differenceClasses[classification] ?? 0) + 1;
    if (classification.startsWith('unattributed')) this.result.unattributedDifferenceCount++;
    if (this.result.differenceExamples.length < 20) this.result.differenceExamples.push(record);
    await this.writeDifference(record);
  }
  async compareNode(left, right, a, b, context) {
    await differences(a, b, '', async (path, first, second) => {
      let classification = 'unattributed_common_node_difference', evidence = null;
      if (path === '/origin/source_digest' && first.value === left.runtimeDigest && second.value === right.runtimeDigest) {
        classification = 'attributed_role_source_digest';
        evidence = { baseline: left.runtimeDigest, candidate: right.runtimeDigest, independentlyValidatedKernelOrigins: true };
      } else if (['/value/root/members/created', '/value/root/members/created/bits', '/value/root/members/created/kind'].includes(path)
        && a.id === b.id && /^reasoning:trace:[1-9][0-9]*$/.test(a.id)
        && a.component === 'native_reasoning_trace' && b.component === 'native_reasoning_trace') {
        const before = left.traceClocks.get(a.id), after = right.traceClocks.get(b.id);
        if (before && after && exactCreatedEncoding(a, before) && exactCreatedEncoding(b, after)) {
          classification = 'attributed_exact_trace_created_wall_clock';
          evidence = { baseline: before, candidate: after, clockSource: this.result.traceClockSource,
            scope: 'Only the exact source-created scalar or float64 created encoding; all raw graph hashes, fragments and other leaves remain checked.' };
        }
      }
      await this.difference({ ...context, nodeId: a.id }, path, first, second, classification, evidence);
    });
  }
  async attribute(left, right, a, b) {
    const context = { case: a.case, form: a.form, pointIndex: a.pointIndex };
    const commonIds = Object.keys(left.nodes).filter(id => own(right.nodes, id)).sort(compareUnicode);
    for (const id of commonIds) await this.compareNode(left, right, left.nodes[id], right.nodes[id], { ...context, scope: 'common_current_node' });
    const branchFragments = new Set();
    for (const node of right.ownRoots) for (const id of fragmentReferences(node.value, right.nodes)) branchFragments.add(id);
    for (const [role, state, other, seen] of [['baseline', left, right, left.seenRemoved], ['candidate', right, left, right.seenAdded]]) {
      for (const [id, node] of Object.entries(state.nodes)) if (!own(other.nodes, id) && !seen.has(id)) {
        seen.add(id);
        const expectedBranch = role === 'candidate' && (IDSET.has(id) || node.kind === 'state_fragment' && branchFragments.has(id));
        await this.difference({ ...context, scope: 'node_population', nodeId: id }, '/nodes/' + pointer(id),
          role === 'baseline' ? { present: true, kind: node.kind, sha256: await digest(node) } : { present: false },
          role === 'candidate' ? { present: true, kind: node.kind, sha256: await digest(node) } : { present: false },
          expectedBranch ? 'attributed_branch_routing_owner_or_reachable_fragment' : 'unattributed_node_population_difference',
          expectedBranch ? { persistedOwnerCheckpointValidated: true, fullNodeRetainedInCapture: true } : null);
      }
    }
    const commonA = a.knowledge.deltasAdded.filter(delta => own(right.nodes, delta.node.id));
    const commonB = b.knowledge.deltasAdded.filter(delta => own(left.nodes, delta.node.id));
    await differences(commonA.map(delta => ({ id: delta.node.id, kind: delta.node.kind, revision: delta.node.revision, cause: delta.cause })),
      commonB.map(delta => ({ id: delta.node.id, kind: delta.node.kind, revision: delta.node.revision, cause: delta.cause })), '',
      (path, first, second) => this.difference({ ...context, scope: 'common_delta_order_identity_cause' }, path, first, second));
    const paired = new Map(commonB.map(delta => [delta.node.id + ':' + delta.node.revision, delta]));
    for (const delta of commonA) {
      const match = paired.get(delta.node.id + ':' + delta.node.revision);
      if (match) await this.compareNode(left, right, delta.node, match.node,
        { ...context, scope: 'common_delta_node', baselineSequence: delta.sequence, candidateSequence: match.sequence });
    }
    for (const key of ['binding', 'selectedRigid', 'motif', 'recruitment']) await differences(a.ownerStates[key], b.ownerStates[key], '',
      (path, first, second) => this.difference({ ...context, scope: 'common_owner_state', owner: OWNERS[key] }, path, first, second));
    this.result.commonValueCoverage.push({ ...context, commonNodesCompared: commonIds.length,
      commonBaselineDeltas: commonA.length, commonCandidateDeltas: commonB.length, rawValueLeavesNotRemoved: true });
    this.result.points.push({ ...context, baselineNodeCount: a.snapshot.nodeCount, candidateNodeCount: b.snapshot.nodeCount,
      baselineGraphRevision: left.revision, candidateGraphRevision: right.revision });
  }
  end(state, row, ordinal) {
    const receipt = this.receipts[state.role].sessions[ordinal];
    assert.equal(state.pending, null); assert.equal(row.status, 'captured_functional_structure');
    assert.equal(row.terminalResumePerformed, false); assert.equal(row.commands, state.commands);
    assert.equal(state.shape.actions, state.start.actionsLimit); assert.equal(state.shape.final.acquiredTransitions, state.shape.actions);
    assert.equal(state.shape.inspection.length, state.start.form === 'measured' ? 3 : 0);
    assert.equal(row.terminalInspections, state.shape.inspection.length); assert.equal(row.captures, state.shape.requests.length);
    assert.equal(row.ownerOperationCount, state.ownerOperations.length);
    assert.equal(row.ownerCheckpointCount, state.ownerCheckpoints.length); assert.deepEqual(row.ownerCounts, state.ownerCounts);
    assert.equal(state.ownerCounts.binding.records, state.start.actionsLimit, 'Binding must observe every fixed public return');
    assert.equal(state.ownerCounts.recruitment.records, state.start.actionsLimit, 'Recruitment must observe every fixed public return exactly once');
    assert.deepEqual(row.shape, state.shape); assert.deepEqual(receipt.shape, state.shape);
    for (const key of ['case', 'form', 'sessionId', 'status', 'commands', 'captures', 'terminalInspections',
      'ownerCounts', 'ownerOperationCount', 'ownerCheckpointCount', 'ownerBindings']) assert.deepEqual(row[key], receipt[key]);
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
              assert.equal(row.schema, 'logos-engine.lot8b-delivery-owner-cost-functional-capture.v1');
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
    } finally { await Promise.all(streams.map(stream => stream.return())); }
  }
}

async function main() {
  const args = process.argv.slice(2);
  assert.equal(args.length, 7, 'Usage: node SCRIPT INVENTORY.json BASELINE.gz BASELINE.receipt.json CANDIDATE.gz CANDIDATE.receipt.json REVIEW.json FORMS.json');
  const [inventory, baseline, baselineReceipt, candidate, candidateReceipt, attribution, fixture] = args.map(path => resolve(ROOT, path));
  const differencesPath = attribution.replace(/\.json$/, '.differences.jsonl.gz');
  for (const path of [attribution, fixture, differencesPath]) {
    assert.ok(path.startsWith(BASE + sep)); await absent(path); await mkdir(dirname(path), { recursive: true });
  }
  assert.ok(attribution.endsWith('.json') && fixture.endsWith('.json'));
  let streamFailure = null;
  const gzip = createGzip({ level: 6 });
  const done = pipeline(gzip, createWriteStream(differencesPath, { flags: 'wx' })).catch(error => { streamFailure = error; });
  const audit = new Qualification({ inventory, baseline, baselineReceipt, candidate, candidateReceipt }, async record => {
    if (streamFailure) throw streamFailure;
    if (!gzip.write(JSON.stringify(record) + '\n')) await once(gzip, 'drain');
  });
  try {
    await audit.checked('published_baseline_functional_capture_provenance', () => audit.provenance());
    await audit.captures();
    await audit.checked('all_inputs_unchanged_and_no_official_window', async () => {
      for (const record of audit.inputs.values()) assert.deepEqual(await fingerprint(record.path), record);
      await absent(resolve(audit.performanceDirectory, 'window.json')); await absent(resolve(audit.performanceDirectory, 'readiness.json'));
    });
    audit.result.status = 'qualified_functional_work_forms_and_individual_graphs';
    audit.result.privateComparison = audit.result.unattributedDifferenceCount === 0
      ? 'all_observed_common_differences_attributed_functional_only_requires_final_review'
      : 'unattributed_differences_retained_strict_qualification_pending';
  } catch (error) { audit.result.failures.push(errorRecord(error)); }
  gzip.end(); await done;
  if (streamFailure) { audit.result.failures.push(errorRecord(streamFailure)); audit.result.status = 'functional_structure_qualification_failed'; }
  audit.result.recordedAt = new Date().toISOString(); audit.result.inputs = [...audit.inputs.values()];
  audit.result.checkedCount = audit.result.checks.length; audit.result.formsSha256 = canonicalHash(audit.forms);
  audit.result.differences = await fingerprint(differencesPath);
  audit.result.qualification = 'Functional preparation against exact Site 107 published source 4ff7bf45286a8a19d34401988adca587253ae41e. Every role graph is reconstructed and validated from its own frozen Kernel/store; all fragment identities and changed roots are checked. Binding, SelectedRigid, Motif and OrderedRecruitment exist in both roles; only BranchRouting is added. Motif and BranchRouting use their actual registered wrappers, and Recruitment passive calls use its real acquisition instance. Exact work shapes exclude only independently bound implementation identity and declared structural counts. All raw common node values and common delta identities/causes/order are compared; differences remain without removing node.value or replacing clocks. Only exact reasoning:trace created scalar/float64 leaves with unmodified source clock code and actual service.handle wall-clock bounds receive clock attribution. Other private differences remain unqualified. State presence, negative proposals, graph nodes, acquiredRecords and acquiredTransitions do not establish successful BranchRouting acquisition, positive game contribution or official success. The separate cold synthetic contribution corpus and official game results retain their own scopes. This artifact grants no official timing readiness, full source/caller parity or publication.';
  await writeFile(attribution, JSON.stringify(audit.result, null, 2) + '\n', { flag: 'wx' });
  if (audit.result.status === 'qualified_functional_work_forms_and_individual_graphs') {
    const value = { schema: 'logos-engine.lot8b-delivery-work-forms.v1', status: audit.result.status,
      preparedOnly: true, officialPerformanceEligible: false, strictCommonGraphParity: false,
      publishedBaseline: audit.result.publishedBaseline, candidatePublished: false,
      recordedAt: new Date().toISOString(), nativeDigests: audit.result.nativeDigests, cases: audit.casesRecord,
      captureTool: audit.captureTool, captures: {
        baseline: { report: await fingerprint(baseline), receipt: await fingerprint(baselineReceipt) },
        candidate: { report: await fingerprint(candidate), receipt: await fingerprint(candidateReceipt) },
      }, review: await fingerprint(attribution), differences: audit.result.differences, forms: audit.forms };
    await writeFile(fixture, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  } else process.exitCode = 1;
  console.log(JSON.stringify({ status: audit.result.status, review: label(attribution),
    forms: audit.forms.length, differences: audit.result.differenceCount,
    unattributedDifferences: audit.result.unattributedDifferenceCount, officialPerformanceEligible: false,
    failures: audit.result.failures }));
}

await main();
