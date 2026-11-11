#!/usr/bin/env node
/** Qualify premeasurement Window graph captures and freeze their actual shapes.
 * CLI: node SCRIPT BASELINE_CHECKOUT BASELINE.gz BASELINE.receipt.json CANDIDATE.gz CANDIDATE.receipt.json ATTRIBUTION.json FIXTURE.json
 * Reads functional captures only. No runtime, replay, game or timing report runs.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createGunzip, gunzipSync } from 'node:zlib';
import { digest, compareUnicode } from '../../../src/logos-engine/canonical.ts';
import { NativeKnowledgeStore, decodeNativeState, NATIVE_STORE_PROFILE } from '../../../src/logos-engine/v6-knowledge-store.ts';
import { hydrateNativeState, isNativeStateGraph } from '../../../src/logos-engine/v6-native-state-graph.ts';
import { symbolicDigest } from '../../../src/logos-engine/v6-hash.ts';
import { nativeProgramDescriptions, V6_NATIVE_PROGRAM_REFERENCE } from '../../../src/logos-engine/v6-src-program.ts';

const SCRIPT = fileURLToPath(import.meta.url), ROOT = resolve(dirname(SCRIPT), '../../..');
const BASE = resolve(ROOT, 'docs/migration/lot10b-evidence');
const CAPTURE_TOOL = resolve(BASE, 'capture-cost-owner-graphs.mjs');
const OWNER = 'public_window_question', WORKFLOW = 'v6.window_question.choose';
const IDS = [`family_state:${OWNER}`, `family_activation:${OWNER}`, `program:${WORKFLOW}`];
const IDSET = new Set(IDS), EPISODE = 'common-observation-frontier';
const SOURCE_PROOFS = ['src/logos-engine/v6-native-runtime.ts', 'src/logos-engine/v6-window-question.ts',
  'src/logos-engine/v6-window-question-geometry.ts', 'src/logos-engine/v6-window-question-policy.ts',
  'src/logos-engine/v5-window-processing.ts', 'src/logos-engine/v6-native-types.ts', 'src/logos-engine/v6-knowledge-store.ts'];
const VALIDATORS = ['src/logos-engine/kernel.ts', 'src/logos-engine/canonical.ts', 'src/logos-engine/v6-knowledge-store.ts',
  'src/logos-engine/v6-native-state-graph.ts', 'src/logos-engine/v6-hash.ts', 'src/logos-engine/v6-src-program.ts', 'src/logos-engine/v6/programs.json',
  'src/runtime/v6-agent-service.ts'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const label = path => path.startsWith(ROOT + sep) ? relative(ROOT, path) : path;
const own = (value, key) => Object.hasOwn(value, key);
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort(compareUnicode).map(key => [key, canonical(value[key])])) : value;
const canonicalHash = value => hash(JSON.stringify(canonical(value)));
const errorRecord = error => ({ name: error?.name ?? 'Error', message: String(error?.message ?? error) });
const copy = value => JSON.parse(JSON.stringify(value));
const SOURCE_FIELDS = ['attempts', 'edits', 'epoch', 'last', 'launches', 'portable'];
const FIELD_AUTHORITY = 'observed_field_change_not_capture_law';
const PACKET_AUTHORITY = 'observed_packet_not_complete_mechanical_model';
const METHOD_AUTHORITY = 'method_only_not_current_permit';

function sourceState(value) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value));
  assert.deepEqual(Object.keys(value).sort(), SOURCE_FIELDS, 'Window source must retain its exact six fields');
  assert.ok(value.epoch === null || Number.isSafeInteger(value.epoch));
  for (const key of ['edits', 'launches', 'portable']) assert.ok(Array.isArray(value[key]));
  assert.ok(value.attempts && typeof value.attempts === 'object' && !Array.isArray(value.attempts));
  assert.ok(value.last === null || typeof value.last === 'object' && !Array.isArray(value.last));
  return value;
}
function savesSource(value) {
  return value.edits.length > 0 || value.portable.length > 0 || Object.keys(value.attempts).length > 0;
}
// Exact source scope transition, applied only at the points called by record.
// This checks retained receipts/state, not a second geometry or game oracle.
function scopedSource(value, epoch) {
  const next = copy(sourceState(value));
  if (next.epoch !== epoch) {
    if (next.edits.length) next.portable.push({ source_epoch: next.epoch, methods: next.edits,
      launches: next.launches, authority: METHOD_AUTHORITY });
    next.epoch = epoch; next.edits = []; next.launches = []; next.attempts = {}; next.last = null;
  }
  return next;
}
function qualifySourceReturn(call) {
  sourceState(call.sourceBefore); sourceState(call.sourceAfter);
  const expected = scopedSource(call.sourceBefore, call.before.level_epoch), returned = call.returnValue;
  assert.equal(call.selected, call.proposal !== null);
  if (call.selected) {
    assert.equal(call.proposal.kind, OWNER); assert.equal(call.actionIndex, 0);
    assert.deepEqual(call.proposal.actions, [call.command]);
    assert.equal(typeof call.proposal.window_question_plan.offer.key, 'string');
  }
  // record scopes the old observation before measure(first). A null first
  // measurement returns immediately, even across a real level boundary.
  if (returned === null) {
    assert.deepEqual(call.sourceAfter, expected, 'Unmeasurable return must retain only the initial source scope');
    return;
  }
  assert.deepEqual(Object.keys(returned).sort(), ['boundary', 'events', 'evidence', 'status']);
  const refs = [call.before.observation_ref, call.after.observation_ref], boundary = call.before.level_epoch !== call.after.level_epoch;
  assert.equal(returned.boundary, boundary); assert.deepEqual(returned.evidence, refs);
  assert.ok(Array.isArray(returned.events));
  assert.equal(returned.status, returned.events.length ? 'observed_window_interface' : 'no_supported_window_change');
  let fields = 0, packets = 0;
  for (const event of returned.events) {
    assert.deepEqual(event.command, call.command); assert.deepEqual(event.evidence, refs);
    if (event.authority === FIELD_AUTHORITY) {
      assert.deepEqual(Object.keys(event).sort(), ['after', 'authority', 'before', 'box', 'command', 'evidence', 'field', 'signature', 'source_epoch']);
      assert.equal(boundary, false); assert.equal(packets, 0); assert.equal(++fields, 1);
      assert.ok(['capacity', 'filter', 'second_field'].includes(event.field));
      assert.ok(Number.isSafeInteger(event.box) && event.box >= 0);
      assert.equal(isDeepStrictEqual(event.before, event.after), false);
      assert.equal(event.source_epoch, call.before.level_epoch);
      expected.edits.push(event);
    } else {
      assert.equal(event.authority, PACKET_AUTHORITY); assert.equal(++packets, 1);
      assert.deepEqual(Object.keys(event).sort(), ['authority', 'boundary', 'command', 'distinct_frames', 'evidence', 'frames', 'score_delta', 'signature']);
      assert.ok(call.frames && call.frames.length > 1);
      assert.equal(event.frames, call.frames.length);
      assert.equal(event.distinct_frames, new Set(call.frames.map(frame => symbolicDigest(frame))).size);
      assert.equal(event.boundary, boundary);
      assert.equal(event.score_delta, call.after.levels_completed - call.before.levels_completed);
      expected.launches.push(event);
    }
  }
  assert.equal(packets, call.frames && call.frames.length > 1 ? 1 : 0,
    'Every measured multi-frame packet, including identical frames, has exactly its source receipt');
  if (call.selected) expected.attempts[call.proposal.window_question_plan.offer.key] = { evidence: refs, events: returned.events };
  expected.last = returned;
  assert.deepEqual(call.sourceAfter, boundary ? scopedSource(expected, call.after.level_epoch) : expected,
    'Actual Window acquisition differs from source receipt, attempts or boundary scope');
}

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

class Qualification {
  constructor(paths) {
    this.paths = paths; this.inputs = new Map(); this.forms = []; this.traces = new Map(); this.receipts = {};
    this.result = { schema: 'logos-engine.lot10b-owner-cost-structural-attribution.v1',
      status: 'functional_structure_qualification_failed', startedAt: new Date().toISOString(),
      checks: [], nodeAttributions: [], points: [], failures: [], commandBoundaryProjections: [] };
  }
  async input(path) {
    const actual = await realpath(resolve(ROOT, path));
    assert.ok(actual.startsWith(await realpath(ROOT) + sep) || actual.startsWith(this.paths.baselineCheckout + sep),
      'Capture input must resolve within the candidate or explicitly selected baseline');
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
      assert.equal(await realpath(receipt.checkout), role === 'baseline' ? this.paths.baselineCheckout : await realpath(ROOT),
        'Capture checkout differs from the explicitly selected source root');
      assert.equal(receipt.schema, 'logos-engine.lot10b-owner-cost-functional-capture-receipt.v1');
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
    for (const path of SOURCE_PROOFS) {
      const record = await this.input(resolve(ROOT, path));
      assert.equal(record.sha256, this.receipts.candidate.nativeInventoryBefore.files[path]);
    }
    for (const path of VALIDATORS) {
      const record = await this.input(resolve(ROOT, path));
      for (const role of ['baseline', 'candidate']) assert.equal(record.sha256, this.receipts[role].nativeInventoryBefore.files[path],
        'Graph validator differs from captured source: ' + role + '/' + path);
    }
    for (const item of this.cases.cases) {
      const record = await this.input(resolve(ROOT, item.trace)); assert.equal(record.sha256, item.traceSha256);
      const trace = await read(record.path); assert.equal(trace.status, 'passed'); this.traces.set(item.id, trace);
    }
  }
  start(role, row, ordinal) {
    const item = this.cases.cases[Math.floor(ordinal / 2)], form = ordinal % 2 ? 'measured' : 'warmup';
    assert.deepEqual([row.case, row.form, row.sessionId], [item.id, form, `lot10b-owner-cost-${item.id.toLowerCase()}-${form}`]);
    assert.equal(row.actionsLimit, form === 'warmup' ? item.warmupActions : item.actions);
    assert.deepEqual(row.budgets, { targetLevels: item.targetLevels, levelActionCaps: Array(item.targetLevels).fill(600) });
    assert.equal(row.nativeDigest, this.receipts[role].nativeDigest); assert.equal(row.coldKnowledge, true); assert.equal(row.checkpointSupplied, false);
    assert.deepEqual([row.trace, row.traceSha256], [item.trace, item.traceSha256]);
    const trace = this.traces.get(item.id); assert.deepEqual(row.initialPublicPacket, trace.packets[0].packet);
    return { role, start: row, trace, nodes: {}, revision: 0, chain: null, runtimeDigest: null,
      point: 0, commands: 0, pending: null, last: null, calls: [], ownRoots: [], ownDeltaCount: 0,
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
      state.kernel = new NativeKnowledgeStore(state.runtimeDigest, row.sessionId).kernel;
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
      assert.equal(row.knowledge.deltasAdded.length, 0); assert.deepEqual(row.windowCalls, []);
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
    for (const call of row.windowCalls) {
      assert.equal(state.role, 'candidate'); assert.equal(call.index, state.calls.length);
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
      assert.equal(state.calls.some(prior => prior.before.observation_ref === call.before.observation_ref), false, 'Duplicate actual Window feedback');
      assert.deepEqual([call.before.levels_completed, call.after.levels_completed],
        [state.trace.packets[action - 1].packet.levels_completed, state.trace.packets[action].packet.levels_completed]);
      assert.deepEqual([call.first, call.second, call.frames], [state.trace.packets[action - 1].packet.frame_rows,
        state.trace.packets[action].packet.frame_rows, state.trace.packets[action].packet.frame_packet],
      'Source acquisition must receive the exact actual old frame, new frame and entire public packet');
      qualifySourceReturn(call);
      state.calls.push(call);
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
    let call;
    if (/^window_question_event:\d+$/.test(fact.key)) {
      call = state.calls.find(item => fact.key === `window_question_event:${item.before.revision}`
        && isDeepStrictEqual(fact.value, item.returnValue));
      assert.ok(call && (call.selected || call.returnValue !== null), 'Window event is not bound to an actual selected/source return');
    } else {
      assert.equal(fact.key, 'window_question_state', 'Unattributed new reasoning fact');
      call = state.calls.findLast(item => item.after.revision === fact.revision
        && savesSource(item.sourceAfter)
        && isDeepStrictEqual(fact.value, item.sourceAfter));
      assert.ok(call, 'Window state fact differs from actual post-acquisition source state');
    }
    assert.equal(fact.evidence, call.after.observation_ref); assert.equal(fact.revision, call.after.revision);
    return { category: fact.key === 'window_question_state' ? 'window_source_state_fact' : 'window_source_event_fact',
      factKey: fact.key, sourceCallIndex: call.index, sourceReturnStatus: call.returnValue?.status ?? null,
      beforeObservation: call.before.observation_ref, afterObservation: call.after.observation_ref,
      officialBoundary: call.before.level_epoch !== call.after.level_epoch };
  }
  async attribute(left, right, a, b) {
    const extraIds = Object.keys(right.nodes).filter(id => !own(left.nodes, id)).sort(compareUnicode);
    assert.deepEqual(Object.keys(left.nodes).filter(id => !own(right.nodes, id)), [], 'An existing node disappeared');
    for (const id of IDS) assert.ok(extraIds.includes(id), 'Window installation node is missing');
    const categories = new Map();
    for (const id of extraIds) {
      const node = right.nodes[id];
      if (IDSET.has(id)) categories.set(id, { category: id === IDS[0] ? 'window_owner_state' : 'window_installation' });
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
        if (!index.facts?.some(id => categories.get(id)?.category?.startsWith('window_source_'))) continue;
      }
      for (const id of fragmentReferences(node.value, right.nodes)) {
        const parents = references.get(id) ?? new Set(); parents.add(node.id); references.set(id, parents);
      }
    }
    for (const id of extraIds) if (right.nodes[id].kind === 'state_fragment') {
      assert.ok(references.has(id), 'New fragment has no Window owner/fact/index provenance: ' + id);
      // Hydration validates referenced fragment hash and encoding. The fragment
      // content itself is also compared to the content-addressed node identity.
      assert.equal(id, `state_fragment:${symbolicDigest(right.nodes[id].value, false)}`);
      categories.set(id, { category: 'window_referenced_state_fragment', parentNodes: [...references.get(id)].sort(compareUnicode) });
    }
    assert.equal(categories.size, extraIds.length, 'A new graph node remains unattributed');
    for (const id of Object.keys(left.nodes)) commonNode(left.nodes[id], right.nodes[id], left.runtimeDigest, right.runtimeDigest);
    const common = b.knowledge.deltasAdded.filter(delta => !categories.has(delta.node.id));
    assert.equal(common.length, a.knowledge.deltasAdded.length, 'Common delta count changed');
    for (let index = 0; index < common.length; index++) {
      const x = a.knowledge.deltasAdded[index], y = common[index];
      assert.deepEqual([x.node.id, x.node.kind, x.node.revision, x.cause], [y.node.id, y.node.kind, y.node.revision, y.cause],
        'Common delta identities, causes or order changed');
      commonNode(x.node, y.node, left.runtimeDigest, right.runtimeDigest);
    }
    for (const delta of b.knowledge.deltasAdded.filter(item => categories.has(item.node.id))) {
      const node = delta.node; let explanation = categories.get(node.id);
      if (IDSET.has(node.id)) {
        if (node.revision === 1) {
          assert.deepEqual(delta.cause, node.id === IDS[2]
            ? { workflow: WORKFLOW, step: 'native_store', statement: 'program.install' }
            : { workflow: 'v6.composition_strategy.choose', step: 'initialize', statement: 'family.install' });
          if (node.id === IDS[0]) {
            assert.equal(node.kind, 'family_state'); assert.equal(node.family, OWNER);
            assert.deepEqual(node.relations, [{ relation: 'controlled_by', target: IDS[1] }]);
          } else if (node.id === IDS[1]) assert.deepEqual(nodeValue(node, right.nodes), { enabled: true });
          else {
            const program = nativeProgramDescriptions().find(value => value.id === WORKFLOW); assert.ok(program);
            assert.deepEqual(nodeValue(node, right.nodes), { module: program.module,
              executionHash: await digest({ profile: 'native-stored-ir.v1', module: program.module }), edited: false });
            assert.deepEqual(node.definition, { reference_commit: V6_NATIVE_PROGRAM_REFERENCE, source_hash: program.sourceHash,
              semantic_hash: program.semanticHash, transitive_source_hash: program.transitiveSourceHash });
          }
        } else { assert.equal(node.id, IDS[0]); assert.equal(delta.cause.workflow, 'v6.composition_strategy.choose'); }
        if (node.id === IDS[0]) {
          const envelope = nodeValue(node, right.nodes); assert.equal(envelope.format, 'native.public_window_question.v1');
          assert.deepEqual(Object.keys(envelope).sort(), ['format', 'source_state']);
          const source = sourceState(envelope.source_state);
          explanation = { ...explanation, sourceStateSha256: canonicalHash(envelope.source_state), epoch: envelope.source_state.epoch,
            retainedEdits: source.edits.map(method => ({ box: method.box, field: method.field, evidence: method.evidence })),
            retainedLaunches: source.launches.length,
            sourcePublicationPredicate: savesSource(source),
            portableMethodCount: source.portable.reduce((sum, item) => sum + item.methods.length, 0) };
          const eventObserved = (event, authority) => event.authority === authority && right.calls.some(call =>
            call.returnValue?.events.some(known => isDeepStrictEqual(known, event)));
          for (const method of source.edits) assert.ok(eventObserved(method, FIELD_AUTHORITY), 'Field method has no actual acquired return');
          for (const launch of source.launches) assert.ok(eventObserved(launch, PACKET_AUTHORITY), 'Launch receipt has no actual acquired packet');
          for (const item of source.portable) {
            assert.deepEqual(Object.keys(item).sort(), ['authority', 'launches', 'methods', 'source_epoch']);
            assert.equal(item.authority, METHOD_AUTHORITY);
            for (const method of item.methods) {
              assert.equal(method.source_epoch, item.source_epoch);
              assert.ok(eventObserved(method, FIELD_AUTHORITY), 'Portable method has no actual acquired return');
            }
            for (const launch of item.launches) assert.ok(eventObserved(launch, PACKET_AUTHORITY), 'Portable packet receipt has no actual acquired return');
          }
          if (source.last !== null) assert.ok(right.calls.some(call => isDeepStrictEqual(call.sourceAfter.last, source.last)),
            'Last Window receipt has no actual acquired return');
          for (const [key, attempt] of Object.entries(source.attempts)) assert.ok(right.calls.some(call =>
            own(call.sourceAfter.attempts, key) && isDeepStrictEqual(call.sourceAfter.attempts[key], attempt)),
          'Attempt has no actual acquired return');
        }
      } else if (node.kind !== 'state_fragment') explanation = this.classifyFact(node, right);
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
      addedNodeIds: extraIds, attributedCumulativeDeltas: right.ownDeltaCount,
      officialBoundarySourceCalls: b.windowCalls.filter(call => call.before.level_epoch !== call.after.level_epoch).map(call => call.index) });
  }
  end(state, row, ordinal) {
    const receipt = this.receipts[state.role].sessions[ordinal];
    assert.equal(state.pending, null); assert.equal(row.status, 'captured_functional_structure');
    assert.equal(row.terminalResumePerformed, false); assert.equal(row.commands, state.commands);
    assert.equal(state.shape.actions, state.start.actionsLimit); assert.equal(state.shape.final.acquiredTransitions, state.shape.actions);
    assert.equal(state.shape.inspection.length, state.start.form === 'measured' ? 3 : 0);
    assert.equal(row.terminalInspections, state.shape.inspection.length); assert.equal(row.captures, state.shape.requests.length);
    assert.equal(row.windowRecordCalls, state.calls.length);
    assert.equal(state.calls.length, state.role === 'candidate' ? state.shape.actions : 0);
    assert.deepEqual(row.shape, state.shape); assert.deepEqual(receipt.shape, state.shape);
    for (const key of ['case', 'form', 'sessionId', 'status', 'commands', 'captures', 'terminalInspections', 'windowRecordCalls']) assert.deepEqual(row[key], receipt[key]);
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
              assert.equal(row.schema, 'logos-engine.lot10b-owner-cost-functional-capture.v1');
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
  assert.equal(args.length, 7, 'Usage: node SCRIPT BASELINE_CHECKOUT BASELINE.gz BASELINE.receipt.json CANDIDATE.gz CANDIDATE.receipt.json ATTRIBUTION.json FIXTURE.json');
  const baselineCheckout = await realpath(resolve(args[0]));
  assert.notEqual(baselineCheckout, await realpath(ROOT), 'Baseline and candidate must be distinct source roots');
  const [baseline, baselineReceipt, candidate, candidateReceipt, attribution, fixture] = args.slice(1).map(path => resolve(ROOT, path));
  for (const path of [attribution, fixture]) {
    assert.ok(path.startsWith(BASE + sep) && path.endsWith('.json')); await absent(path); await mkdir(dirname(path), { recursive: true });
  }
  const audit = new Qualification({ baselineCheckout, baseline, baselineReceipt, candidate, candidateReceipt });
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
  audit.result.qualification = 'Every captured graph reconstructs from its exact complete Kernel delta chain. Added candidate nodes/deltas receive explicit installation, Window state, observed source event/state-fact or reachable-fragment attribution. Common node identities/metadata and common delta identity/cause/order remain exact apart from their declared runtime source digest; private value equality across versions is not asserted. Structural counts come from the captures, without an added-node or cycle formula. The forms are fixed before any cost window and every future raw trial must match its own form exactly. No cost values, timing correction, future-run success or full graph/caller semantic parity is inferred.';
  await writeFile(attribution, JSON.stringify(audit.result, null, 2) + '\n', { flag: 'wx' });
  if (audit.result.status === 'qualified_functional_structure') {
    const value = { schema: 'logos-engine.lot10b-owner-cost-structural-fixture.v1', status: 'qualified_functional_structure',
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

await main();
