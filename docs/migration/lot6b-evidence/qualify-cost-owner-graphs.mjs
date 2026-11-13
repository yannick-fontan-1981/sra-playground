#!/usr/bin/env node
/** Qualify premeasurement SelectedRigid graph captures and freeze their actual shapes.
 * CLI: node SCRIPT BASELINE.gz BASELINE.receipt.json CANDIDATE.gz CANDIDATE.receipt.json ATTRIBUTION.json FIXTURE.json
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
const BASE = resolve(ROOT, 'docs/migration/lot6b-evidence');
const CAPTURE_TOOL = resolve(BASE, 'capture-cost-owner-graphs.mjs');
const DERIVED_FROM = resolve(ROOT, 'docs/migration/lot6a-evidence/qualify-cost-owner-graphs.mjs');
const CAPTURE_DERIVATION = resolve(ROOT, 'docs/migration/lot6a-evidence/capture-cost-owner-graphs.mjs');
const POLICY_PATH = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/strategy.drm';
const OWNER = 'selected_rigid';
const IDS = [`family_state:${OWNER}`, `family_activation:${OWNER}`];
const IDSET = new Set(IDS);
const SOURCE_PROOFS = ["src/logos-engine/v6-native-runtime.ts", "src/logos-engine/v6-selected-rigid.ts", "src/logos-engine/v6-selected-rigid-types.ts", "src/logos-engine/v6-selected-rigid-geometry.ts", "src/logos-engine/v6-selected-rigid-search.ts", "src/logos-engine/v6-knowledge-store.ts", "src/logos-engine/kernel.ts"];
const ROLE_VALIDATORS = ['src/logos-engine/kernel.ts', 'src/logos-engine/v6-knowledge-store.ts'];
const TRACE_TIME_SOURCE_PROOFS = ['src/logos-engine/v6-reasoning-memory.ts', 'src/logos-engine/v6-native-authority.ts'];
const COMMON_VALIDATORS = [...TRACE_TIME_SOURCE_PROOFS, 'src/logos-engine/canonical.ts',
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
/** One source-created trace envelope leaf, never a recursive created-key rule. */
export class TraceCreatedAttribution {
  constructor(windows) {
    this.windows = {}; this.seen = new Map(); this.records = [];
    for (const role of ['baseline', 'candidate']) {
      const supplied = windows[role];
      assert.ok(supplied && typeof supplied.startedAt === 'string' && typeof supplied.finishedAt === 'string', 'Trace capture window is missing');
      const startMs = Date.parse(supplied.startedAt), finishMs = Date.parse(supplied.finishedAt);
      assert.ok(Number.isSafeInteger(startMs) && Number.isSafeInteger(finishMs) && startMs >= 0 && finishMs >= startMs, 'Invalid trace capture interval');
      assert.equal(new Date(startMs).toISOString(), supplied.startedAt, 'Noncanonical capture start');
      assert.equal(new Date(finishMs).toISOString(), supplied.finishedAt, 'Noncanonical capture finish');
      this.windows[role] = { startedAt: supplied.startedAt, finishedAt: supplied.finishedAt, startMs, finishMs };
    }
  }
  prepare(a, b, sessionId) {
    assert.ok(typeof sessionId === 'string' && sessionId.length > 0, 'Trace comparison requires its real session');
    const pending = [];
    for (const [role, node] of [['baseline', a], ['candidate', b]]) {
      const match = /^reasoning:trace:([1-9][0-9]*)$/.exec(node.id);
      assert.ok(match && Number.isSafeInteger(Number(match[1])), 'Not a real reasoning trace identifier');
      assert.equal(node.kind, 'component_state'); assert.equal(node.component, 'native_reasoning_trace');
      assert.equal(node.scope, sessionId, 'Trace belongs to another session');
      const value = node.value;
      assert.deepEqual(Object.keys(value).sort(), ['component', 'profile', 'root']);
      assert.equal(value.component, node.id); assert.equal(value.profile, 'logos-engine.v6.state-graph.v1');
      assert.deepEqual(Object.keys(value.root).sort(), ['kind', 'members']); assert.equal(value.root.kind, 'object');
      const members = value.root.members;
      assert.deepEqual(Object.keys(members).sort(), ['body', 'created', 'episode', 'id', 'kind']);
      assert.equal(members.id, Number(match[1])); assert.equal(members.episode, 'common-observation-frontier');
      assert.ok(typeof members.kind === 'string' && members.kind.length > 0, 'Invalid trace kind');
      const created = members.created;
      assert.ok(created && typeof created === 'object' && !Array.isArray(created), 'Trace created must be an encoded float64');
      assert.deepEqual(Object.keys(created).sort(), ['bits', 'kind']); assert.equal(created.kind, 'float64');
      assert.ok(typeof created.bits === 'string' && /^[a-f0-9]{16}$/.test(created.bits), 'Invalid trace float64 bits');
      const seconds = Buffer.from(created.bits, 'hex').readDoubleBE(0), milliseconds = Math.round(seconds * 1000);
      assert.ok(Number.isFinite(seconds) && Number.isSafeInteger(milliseconds) && seconds === milliseconds / 1000,
        'Trace created is not a finite Date.now()/1000 millisecond timestamp');
      const window = this.windows[role];
      assert.ok(milliseconds >= window.startMs && milliseconds <= window.finishMs, 'Trace created lies outside its own capture interval: ' + role);
      const key = JSON.stringify([role, sessionId, node.id]), prior = this.seen.get(key);
      if (prior) assert.equal(created.bits, prior.bits, 'Trace created changed within its role/session/identity');
      pending.push({ key, role, sessionId, nodeId: node.id, bits: created.bits, seconds, milliseconds,
        createdAt: new Date(milliseconds).toISOString(), captureStartedAt: window.startedAt, captureFinishedAt: window.finishedAt });
    }
    // Shallow comparison copies replace exactly the validated bits leaf. The
    // inputs, body, nested created fields and all other node values stay intact.
    const comparisonValue = value => ({ ...value, root: { ...value.root, members: { ...value.root.members,
      created: { ...value.root.members.created, bits: 'attributed_trace_envelope_timestamp' } } } });
    return { values: [comparisonValue(a.value), comparisonValue(b.value)], commit: () => {
      for (const row of pending) if (!this.seen.has(row.key)) {
        this.seen.set(row.key, row); const { key, ...record } = row; this.records.push(record);
      }
    } };
  }
}
export function commonNode(a, b, digestA, digestB, temporal = null) {
  assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), 'Common node fields changed');
  const isTrace = a.component === 'native_reasoning_trace' || b.component === 'native_reasoning_trace'
    || String(a.id).startsWith('reasoning:trace:') || String(b.id).startsWith('reasoning:trace:');
  let prepared = null;
  if (isTrace) {
    assert.ok(temporal?.attribution instanceof TraceCreatedAttribution, 'A real trace requires capture-bound time attribution');
    prepared = temporal.attribution.prepare(a, b, temporal.sessionId);
  }
  for (const key of Object.keys(a)) {
    if (key === 'value') {
      assert.deepEqual(prepared ? prepared.values[0] : a.value, prepared ? prepared.values[1] : b.value,
        'Unattributed common node value changed: ' + a.id); continue;
    }
    if (key === 'origin') {
      assert.deepEqual(Object.keys(a.origin).sort(), Object.keys(b.origin).sort());
      for (const name of Object.keys(a.origin)) {
        if (name === 'source_digest') assert.deepEqual([a.origin[name], b.origin[name]], [digestA, digestB]);
        else assert.deepEqual(a.origin[name], b.origin[name], 'Common node origin changed: ' + a.id + '/' + name);
      }
    } else assert.deepEqual(a[key], b[key], 'Common node metadata changed: ' + a.id + '/' + key);
  }
  prepared?.commit();
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
  constructor(paths) {
    this.paths = paths; this.inputs = new Map(); this.forms = []; this.traces = new Map(); this.receipts = {}; this.stores = {}; this.traceCreated = null;
    this.result = { schema: 'logos-engine.lot6b-owner-cost-structural-attribution.v1',
      status: 'functional_structure_qualification_failed', startedAt: new Date().toISOString(),
      checks: [], nodeAttributions: [], points: [], failures: [], commandBoundaryProjections: [], sourceFactCoverage: [],
      commonValueCoverage: [], commonValuePolicy: { comparison: 'exact_except_attributed_trace_envelope_created', permittedMetadataDifference: 'origin.source_digest',
        identityValueAttributions: [], unattributedDifferencesAllowed: 0 } };
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
      assert.equal(receipt.schema, 'logos-engine.lot6b-owner-cost-functional-capture-receipt.v1');
      assert.equal(receipt.status, 'captured_functional_structure'); assert.equal(receipt.role, role);
      assert.equal(receipt.ownerId, OWNER); assert.equal(receipt.acquisitionMode, 'selected_only_source_owner_no_passive_returns');
      assert.equal(receipt.nativeDigest, receipt.nativeInventoryBefore.digest);
      assert.equal(receipt.nativeVersion, role === 'baseline' ? '0.63.0' : '0.64.0');
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
    this.traceCreated = new TraceCreatedAttribution(Object.fromEntries(['baseline', 'candidate'].map(role => [role,
      { startedAt: this.receipts[role].startedAt, finishedAt: this.receipts[role].finishedAt }])));
    this.result.commonValuePolicy.traceCreatedAttribution = {
      nodeComponent: 'native_reasoning_trace', path: '/value/root/members/created/bits',
      sourceClock: 'Date.now() / 1000', sourceFiles: TRACE_TIME_SOURCE_PROOFS,
      captureWindows: this.traceCreated.windows, stabilityKey: ['role', 'sessionId', 'nodeId'],
      records: this.traceCreated.records, allOtherFieldsExact: true };
    assert.deepEqual(this.receipts.baseline.cases, this.receipts.candidate.cases);
    this.casesRecord = this.receipts.candidate.cases; this.cases = await read(this.casesRecord.path);
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
    assert.deepEqual([row.case, row.form, row.sessionId], [item.id, form, `lot6b-owner-cost-${item.id.toLowerCase()}-${form}`]);
    assert.equal(row.actionsLimit, form === 'warmup' ? item.warmupActions : item.actions);
    assert.deepEqual(row.budgets, { targetLevels: item.targetLevels, levelActionCaps: Array(item.targetLevels).fill(600) });
    assert.equal(row.nativeDigest, this.receipts[role].nativeDigest); assert.equal(row.coldKnowledge, true); assert.equal(row.checkpointSupplied, false);
    assert.deepEqual([row.trace, row.traceSha256], [item.trace, item.traceSha256]);
    const trace = this.traces.get(item.id); assert.deepEqual(row.initialPublicPacket, trace.packets[0].packet);
    return { role, start: row, trace, nodes: {}, revision: 0, chain: null, runtimeDigest: null,
      point: 0, commands: 0, pending: null, last: null, calls: [], proposals: [], checkpoints: [], ownRoots: [], ownDeltaCount: 0,
      latestSource: this.coldState(), sourceStates: [this.coldState()],
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
    assert.deepEqual(row.selectedRigidOwnerBinding, { registeredInstances: state.role === 'candidate' ? 1 : 0,
      acquisitionMatchesRegisteredOwner: state.role === 'candidate' ? true : null });
    assert.deepEqual(row.selectedRigidSourceState, state.role === 'candidate' ? this.coldState() : null,
      'Every actual functional point must bind the exact empty source journal');
    assert.equal(row.pointIndex, state.point++); assert.equal(request.sessionId, state.start.sessionId);
    assert.equal(request.sequence, state.commands); assert.equal(row.snapshot.actions, state.commands);
    assert.equal(row.snapshot.whyAct.enabled, true); assert.equal(row.snapshot.caller.enabled, true);
    if (inspection) {
      assert.equal(request.type, 'inspect'); assert.equal(state.start.form, 'measured');
      assert.equal(state.commands, state.start.actionsLimit); assert.equal(state.pending, null);
      assert.equal(row.knowledge.deltasAdded.length, 0); assert.deepEqual(row.selectedRigidCalls, []);
      assert.deepEqual(row.selectedRigidCheckpoints, []); assert.deepEqual(row.selectedRigidProposals, []);
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
    assert.deepEqual(row.selectedRigidCalls, [], 'SelectedRigid has no passive acquisition; fixed cost traces select other owners');
    for (const call of row.selectedRigidProposals) {
      assert.equal(state.role, 'candidate'); assert.equal(call.index, state.proposals.length);
      const packet = state.trace.packets[state.commands].packet;
      assert.deepEqual(call.rows, packet.frame_rows, 'SelectedRigid proposal must use the current public raster');
      assert.deepEqual([call.observation.level_epoch, call.observation.levels_completed], [packet.level, packet.levels_completed]);
      assert.equal(call.observation.revision, state.commands + 1);
      assert.equal(call.returnValue, null, 'The fixed common-loop traces must remain outside SelectedRigid');
      assert.deepEqual(call.sourceBefore, state.latestSource, 'SelectedRigid negative proposals must form one complete source-state chain');
      assert.ok(Number.isSafeInteger(call.remaining) && call.remaining >= 0);
      const expected = this.coldState();
      assert.deepEqual(call.sourceBefore, expected, 'Foreign fixed-cost traces must start with an empty rigid event journal');
      assert.deepEqual(call.sourceAfter, expected, 'A negative rigid proposal cannot acquire state or add a scene cache');
      state.latestSource = call.sourceAfter; state.sourceStates.push(call.sourceAfter); state.proposals.push(call);
    }
    for (const checkpoint of row.selectedRigidCheckpoints) {
      assert.equal(state.role, 'candidate'); assert.equal(checkpoint.index, state.checkpoints.length);
      assert.equal(checkpoint.state.schema, 'native.selected_rigid.v1');
      assert.deepEqual(Object.keys(checkpoint.state).sort(), ['schema', 'format', 'events'].sort());
      const { schema, ...source } = checkpoint.state;
      assert.ok(state.sourceStates.some(known => isDeepStrictEqual(known, source)),
        'SelectedRigid checkpoint is not the exact cold source state');
      state.checkpoints.push(checkpoint);
    }
    assert.equal(state.calls.length, 0, 'No SelectedRigid record call is admissible in the declared fixed cost traces');
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
  coldState() {
    return { format: 'selected_rigid_events.v1', events: [] };
  }
  async attribute(left, right, a, b) {
    const extraIds = Object.keys(right.nodes).filter(id => !own(left.nodes, id)).sort(compareUnicode);
    assert.deepEqual(Object.keys(left.nodes).filter(id => !own(right.nodes, id)), [], 'An existing node disappeared');
    for (const id of IDS) assert.ok(extraIds.includes(id), 'SelectedRigid installation node is missing');
    const categories = new Map();
    for (const id of extraIds) {
      const node = right.nodes[id];
      if (IDSET.has(id)) categories.set(id, { category: id === IDS[0] ? 'selectedRigid_owner_state' : 'selectedRigid_installation' });
      else assert.equal(node.kind, 'state_fragment', 'A foreign owner must not create SelectedRigid source-event facts or unrelated nodes');
    }
    // Trace each extra fragment through a real persisted SelectedRigid owner root,
    // including a superseded root retained in an earlier delta. No arbitrary
    // node-count allowance or removal of a subtree is used.
    for (const delta of b.knowledge.deltasAdded) {
      if (IDSET.has(delta.node.id)) right.ownRoots.push(delta.node);
    }
    const references = new Map();
    for (const node of right.ownRoots) {
      for (const id of fragmentReferences(node.value, right.nodes)) {
        const parents = references.get(id) ?? new Set(); parents.add(node.id); references.set(id, parents);
      }
    }
    for (const id of extraIds) if (right.nodes[id].kind === 'state_fragment') {
      assert.ok(references.has(id), 'New fragment has no SelectedRigid owner checkpoint provenance: ' + id);
      // Hydration validates referenced fragment hash and encoding. The fragment
      // content itself is also compared to the content-addressed node identity.
      assert.equal(id, `state_fragment:${symbolicDigest(right.nodes[id].value, false)}`);
      categories.set(id, { category: 'selectedRigid_referenced_state_fragment', parentNodes: [...references.get(id)].sort(compareUnicode) });
    }
    assert.equal(categories.size, extraIds.length, 'A new graph node remains unattributed');
    assert.equal(right.calls.length, 0, 'The cost traces must not acquire SelectedRigid source returns');
    this.result.sourceFactCoverage.push({ case: b.case, form: b.form, pointIndex: b.pointIndex,
      acquiredReturns: 0, persistedSourceFacts: 0, sourceCallIndices: [],
      capturedNegativeProposals: right.proposals.length });
    const temporal = { attribution: this.traceCreated, sessionId: left.start.sessionId };
    for (const id of Object.keys(left.nodes)) commonNode(left.nodes[id], right.nodes[id], left.runtimeDigest, right.runtimeDigest, temporal);
    const common = b.knowledge.deltasAdded.filter(delta => !categories.has(delta.node.id));
    assert.equal(common.length, a.knowledge.deltasAdded.length, 'Common delta count changed');
    for (let index = 0; index < common.length; index++) {
      const x = a.knowledge.deltasAdded[index], y = common[index];
      assert.deepEqual([x.node.id, x.node.kind, x.node.revision, x.cause], [y.node.id, y.node.kind, y.node.revision, y.cause],
        'Common delta identities, causes or order changed');
      commonNode(x.node, y.node, left.runtimeDigest, right.runtimeDigest, temporal);
    }
    this.result.commonValueCoverage.push({ case: b.case, form: b.form, pointIndex: b.pointIndex,
      commonNodesCompared: Object.keys(left.nodes).length, commonDeltasCompared: common.length,
      comparison: 'exact_except_attributed_trace_envelope_created', unattributedDifferences: 0 });
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
          const envelope = nodeValue(node, right.nodes); assert.equal(envelope.schema, 'native.selected_rigid.v1');
          const checkpoint = right.checkpoints.find(item => isDeepStrictEqual(item.state, envelope));
          assert.ok(checkpoint, 'A SelectedRigid owner root must equal an actual immutable checkpoint returned during this session');
          explanation = { ...explanation, checkpointIndex: checkpoint.index, sourceStateSha256: canonicalHash(envelope),
            retainedEventCount: envelope.events.length };
          assert.deepEqual(envelope, { schema: 'native.selected_rigid.v1', ...this.coldState() });
        }
      } else assert.equal(node.kind, 'state_fragment', 'Unattributed SelectedRigid source fact is forbidden');
      this.result.nodeAttributions.push({ case: b.case, form: b.form, pointIndex: b.pointIndex, request: b.request.type,
        requestSequence: b.request.sequence, deltaSequence: delta.sequence, nodeId: node.id, kind: node.kind,
        revision: node.revision, cause: delta.cause, evidence: node.evidence, nodeSha256: await digest(node), ...explanation });
      right.ownDeltaCount++;
    }
    assert.equal(right.revision - left.revision, right.ownDeltaCount, 'Revision difference is not exactly the attributed actual deltas');
    assert.equal(b.snapshot.nodeCount - a.snapshot.nodeCount, categories.size, 'Node difference is not exactly the attributed actual nodes');
    this.result.points.push({ case: b.case, form: b.form, pointIndex: b.pointIndex, request: b.request.type,
      sequence: b.request.sequence, baselineNodeCount: a.snapshot.nodeCount, candidateNodeCount: b.snapshot.nodeCount,
      baselineGraphRevision: left.revision, candidateGraphRevision: right.revision,
      baselineDeltaCount: a.knowledge.deltasAdded.length, candidateDeltaCount: b.knowledge.deltasAdded.length,
      addedNodeIds: extraIds, attributedCumulativeDeltas: right.ownDeltaCount,
      officialBoundarySourceCalls: b.selectedRigidCalls.filter(call => call.before.level_epoch !== call.after.level_epoch || call.before.levels_completed !== call.after.levels_completed).map(call => call.index) });
  }
  end(state, row, ordinal) {
    const receipt = this.receipts[state.role].sessions[ordinal];
    assert.equal(state.pending, null); assert.equal(row.status, 'captured_functional_structure');
    assert.equal(row.terminalResumePerformed, false); assert.equal(row.commands, state.commands);
    assert.equal(state.shape.actions, state.start.actionsLimit); assert.equal(state.shape.final.acquiredTransitions, state.shape.actions);
    assert.equal(state.shape.inspection.length, state.start.form === 'measured' ? 3 : 0);
    assert.equal(row.terminalInspections, state.shape.inspection.length); assert.equal(row.captures, state.shape.requests.length);
    assert.equal(row.selectedRigidRecordCalls, state.calls.length);
    assert.equal(row.selectedRigidCheckpoints, state.checkpoints.length);
    assert.equal(state.calls.length, 0);
    assert.equal(row.selectedRigidProposalCalls, state.proposals.length);
    assert.deepEqual(receipt.selectedRigidOwnerBinding, { registeredInstances: state.role === 'candidate' ? 1 : 0,
      acquisitionMatchesRegisteredOwner: state.role === 'candidate' ? true : null });
    assert.deepEqual(row.shape, state.shape); assert.deepEqual(receipt.shape, state.shape);
    for (const key of ['case', 'form', 'sessionId', 'status', 'commands', 'captures', 'terminalInspections', 'selectedRigidRecordCalls', 'selectedRigidProposalCalls', 'selectedRigidCheckpoints']) assert.deepEqual(row[key], receipt[key]);
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
              assert.equal(row.schema, 'logos-engine.lot6b-owner-cost-functional-capture.v1');
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
  assert.equal(args.length, 6, 'Usage: node SCRIPT BASELINE.gz BASELINE.receipt.json CANDIDATE.gz CANDIDATE.receipt.json ATTRIBUTION.json FIXTURE.json');
  const [baseline, baselineReceipt, candidate, candidateReceipt, attribution, fixture] = args.map(path => resolve(ROOT, path));
  for (const path of [attribution, fixture]) {
    assert.ok(path.startsWith(BASE + sep) && path.endsWith('.json')); await absent(path); await mkdir(dirname(path), { recursive: true });
  }
  const audit = new Qualification({ baseline, baselineReceipt, candidate, candidateReceipt });
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
  audit.result.qualification = 'Every captured graph reconstructs from its exact complete Kernel delta chain using the validator bound to its own source freeze and identical value codecs. Every fragment identifier is checked against its content and every changed native graph root is hydrated. Added candidate nodes/deltas receive explicit installation, actual SelectedRigid checkpoint or reachable-fragment attribution, with zero source record calls or source-event facts and the exact empty source journal at every actual point in these foreign-owner cost traces. The observed acquisition owner is the registered family instance. Common node values are compared exactly except the encoded created leaf of native_reasoning_trace envelopes, validated as finite Date.now()/1000 timestamps within each own capture interval and stable per role/session/trace; every other trace field remains exact. Common metadata differs only at the explicitly bound origin.source_digest. Common delta identity/cause/order remains exact. Any further computed identity difference inside a value is refused pending a specific premeasurement attribution. This stricter 6B scope does not amend the historical 6A qualification. Structural counts come from the captures, without an added-node or cycle formula. The forms are fixed before any cost window and every future raw trial must match its own form exactly. No cost values, timing correction, future-run success, uncaptured measured-graph values or full caller semantic parity is inferred.';
  await writeFile(attribution, JSON.stringify(audit.result, null, 2) + '\n', { flag: 'wx' });
  if (audit.result.status === 'qualified_functional_structure') {
    const value = { schema: 'logos-engine.lot6b-owner-cost-structural-fixture.v1', status: 'qualified_functional_structure',
      recordedAt: new Date().toISOString(), nativeDigests: audit.result.nativeDigests, cases: audit.casesRecord,
      captureTool: audit.captureTool, captures: {
        baseline: { report: await fingerprint(baseline), receipt: await fingerprint(baselineReceipt) },
        candidate: { report: await fingerprint(candidate), receipt: await fingerprint(candidateReceipt) },
      }, attribution: await fingerprint(attribution), forms: audit.forms };
    await writeFile(fixture, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  } else process.exitCode = 1;
  console.log(JSON.stringify({ status: audit.result.status, attribution: label(attribution),
    fixture: audit.result.status === 'qualified_functional_structure' ? label(fixture) : null,
    checks: audit.result.checkedCount, attributedDeltas: audit.result.nodeAttributions.length, forms: audit.forms.length,
    failures: audit.result.failures }));
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT) await main();
