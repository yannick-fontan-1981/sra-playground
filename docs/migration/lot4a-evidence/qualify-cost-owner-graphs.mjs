#!/usr/bin/env node
/**
 * Separate structural qualification of the Feedback owner addition.
 * Usage: node qualify-cost-owner-graphs.mjs BASELINE.gz BASELINE.receipt.json AFTER.gz AFTER.receipt.json OUTPUT.json
 * Reads completed captures and retained measurements only. No agent, game,
 * benchmark, replay, timing correction or official comparison is executed.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, lstat, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createGunzip, gunzipSync } from 'node:zlib';
import { digest, compareUnicode } from '../../../src/logos-engine/canonical.ts';
import { NativeKnowledgeStore, decodeNativeState, NATIVE_STORE_PROFILE } from '../../../src/logos-engine/v6-knowledge-store.ts';
import { hydrateNativeState, isNativeStateGraph } from '../../../src/logos-engine/v6-native-state-graph.ts';
import { nativeProgramDescriptions, V6_NATIVE_PROGRAM_REFERENCE } from '../../../src/logos-engine/v6-src-program.ts';
import { workSignature } from '../../../scripts/compare-native-cost-cohorts.mjs';

const SCRIPT = fileURLToPath(import.meta.url), ROOT = resolve(dirname(SCRIPT), '../../..');
const BASE = resolve(ROOT, 'docs/migration/lot4a-evidence'), PERF = resolve(BASE, 'performance-integrated');
const IDS = ['family_state:feedback_sequences', 'family_activation:feedback_sequences', 'program:v6.feedback_sequences.choose'];
const IDSET = new Set(IDS), STRATEGY = 'v6.composition_strategy.choose';
const hash = value => createHash('sha256').update(value).digest('hex');
const own = (value, key) => Object.hasOwn(value, key);
const label = path => path.startsWith(ROOT + sep) ? relative(ROOT, path) : path;
const failure = error => ({ name: error?.name ?? 'Error', message: String(error?.message ?? error) });
const qualifications = [
  'Separate untimed captures attest the structural owner addition on the same frozen sources. They do not retroactively establish the uncaptured node/delta leaves of the 400 measured actions.',
  'Every captured graph is reconstructed and validated against its own complete delta chain. Common node identities, kinds, revisions and other declared metadata, and common delta causes/order are compared exactly. Encoded private values remain unmodified in the captures; their complete equality between versions is not asserted.',
  'Exactly three owner nodes and their declared installation/per-prefix provenance deltas are permitted. No generic subtree deletion, value normalization, clock normalization or numeric tolerance is applied.',
  'The original strict aggregation failure remains failed. This receipt is not an official aggregate, a cost acceptance verdict, a new measurement, a browser test or full original-caller parity.',
];

function differences(a, b, path = '$') {
  if (isDeepStrictEqual(a, b)) return [];
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) return a.flatMap((v, i) => differences(v, b[i], `${path}[${i}]`));
  if (a && b && !Array.isArray(a) && !Array.isArray(b) && typeof a === 'object' && typeof b === 'object') {
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().flatMap(key =>
      own(a, key) && own(b, key) ? differences(a[key], b[key], `${path}.${key}`)
        : [{ path: `${path}.${key}`, baselinePresent: own(a, key), candidatePresent: own(b, key), baseline: a[key] ?? null, candidate: b[key] ?? null }]);
  }
  return [{ path, baseline: a, candidate: b }];
}

function publicObservation(packet) {
  return { frame: packet.frame_rows, frames: packet.frame_packet,
    availableActionIds: packet.available_action_refs.map(name => Number(name.slice(6))), state: packet.state,
    level: packet.level, levelsCompleted: packet.levels_completed, stepIndex: packet.step_index };
}
function observationShape(point) {
  const s = point.snapshot;
  return { type: point.request.type, sequence: point.request.sequence, family: s.lastDecision,
    proposalKind: s.proposal?.kind ?? null, poseMode: s.proposal?.material_pose_plan?.mode ?? null,
    actions: s.actions, cycles: s.cycles, levelsCompleted: s.levelsCompleted, nodeCount: s.nodeCount,
    acquiredTransitions: s.caller?.acquiredTransitions ?? null };
}
function finalShape(s) {
  return { actions: s.actions, levelsCompleted: s.levelsCompleted, reason: s.reason, graphRevision: s.graphRevision,
    nodeCount: s.nodeCount, acquiredTransitions: s.caller?.acquiredTransitions ?? null, implementation: s.implementation };
}
function rawShape(trial) {
  return { requests: trial.requests.map(({ type, sequence, kind, actions }) => ({ type, sequence, kind, actions })),
    observations: trial.observations, final: trial.final, actions: trial.actions, cycles: trial.cycles, levelsCompleted: trial.levelsCompleted };
}

// The capture contract writes a compact header, one compact record per line,
// and one footer. At most one graph record per side is parsed at a time.
async function* captureStream(path) {
  const source = createReadStream(path), stream = source.pipe(createGunzip()), decoder = new StringDecoder('utf8');
  source.on('error', error => stream.destroy(error));
  let pending = '', lineIndex = 0, recordIndex = 0, ended = false, previousComma = true;
  const parse = line => {
    if (lineIndex++ === 0) {
      assert.ok(line.endsWith('"records":['), 'Capture header does not follow its streaming contract');
      return { type: '$header', value: JSON.parse(line + ']}') };
    }
    assert.equal(ended, false, 'Content appears after the capture footer');
    if (line.startsWith('],')) {
      assert.ok(recordIndex > 0 && !previousComma, 'Invalid terminal record separator');
      ended = true;
      const value = JSON.parse('{' + line.slice(2));
      assert.equal(value.recordCount, recordIndex, 'Incomplete record inventory');
      return { type: '$footer', value };
    }
    assert.ok(previousComma, 'Missing separator between capture records');
    previousComma = line.endsWith(',');
    const value = JSON.parse(previousComma ? line.slice(0, -1) : line);
    assert.equal(value.recordIndex, recordIndex++, 'Capture records are missing, repeated or reordered');
    return value;
  };
  try {
    for await (const chunk of stream) {
      pending += decoder.write(chunk);
      let index;
      while ((index = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, index); pending = pending.slice(index + 1);
        if (line.length) yield parse(line);
      }
    }
    pending += decoder.end();
    if (pending.length) yield parse(pending);
    assert.ok(ended, 'Capture footer is absent');
  } finally { source.destroy(); stream.destroy(); }
}

class Qualification {
  constructor(paths) {
    this.paths = paths; this.roots = [ROOT]; this.inputs = new Map(); this.assertions = 0;
    this.report = { schema: 'logos-engine.feedback-cost-owner-addition-qualification.v1', status: 'owner_addition_qualification_failed',
      startedAt: new Date().toISOString(), workMetadataExact: false, strictAggregationReclassified: false,
      addedNodeIds: IDS, checks: [], qualifications, counts: {}, points: [], sessions: [], extraDeltas: [] };
  }
  check(condition, message) { this.assertions++; assert.ok(condition, message); }
  equal(a, b, message) { this.assertions++; assert.deepEqual(a, b, message); }
  async group(name, operation) {
    const before = this.assertions, check = { name, passed: true, assertions: 0 };
    try { await operation(); } catch (error) { check.passed = false; check.error = failure(error); }
    check.assertions = this.assertions - before; this.report.checks.push(check);
    return check.passed;
  }
  async safe(name) {
    this.check(typeof name === 'string' && !name.includes('\\') && !name.split('/').includes('..'), 'Unsafe evidence path');
    const path = resolve(ROOT, name), boundary = this.roots.find(root => path === root || path.startsWith(root + sep));
    this.check(Boolean(boundary), 'Evidence path lies outside the declared checkouts');
    let current = boundary;
    for (const component of relative(boundary, path).split(sep).filter(Boolean)) {
      current = resolve(current, component);
      this.check(!(await lstat(current)).isSymbolicLink(), 'Symlink evidence is not supported');
    }
    return path;
  }
  async fingerprint(name) {
    const path = await this.safe(name), stat = await lstat(path);
    this.check(stat.isFile(), 'Evidence input is not a regular file');
    const sha = createHash('sha256');
    for await (const chunk of createReadStream(path)) sha.update(chunk);
    return { path: label(path), bytes: stat.size, sha256: sha.digest('hex') };
  }
  async input(name) {
    const actual = await this.fingerprint(name), prior = this.inputs.get(actual.path);
    if (prior) this.equal(actual, prior, 'Input changed while being read');
    else this.inputs.set(actual.path, actual);
    return actual;
  }
  async recorded(record, expected = null) {
    this.equal(Object.keys(record).sort(), ['bytes', 'path', 'sha256'], 'Invalid fingerprint shape');
    this.check(Number.isSafeInteger(record.bytes) && record.bytes >= 0 && /^[a-f0-9]{64}$/.test(record.sha256), 'Invalid fingerprint values');
    const path = await this.safe(record.path), actual = await this.input(path);
    this.equal([actual.bytes, actual.sha256], [record.bytes, record.sha256], 'Recorded evidence bytes differ');
    if (expected) this.equal(path, resolve(ROOT, expected), 'Recorded evidence has an unexpected path');
    return path;
  }
  async read(name) {
    const path = await this.safe(name); await this.input(path);
    const bytes = await readFile(path);
    return JSON.parse(path.endsWith('.gz') ? gunzipSync(bytes) : bytes);
  }
  async provenance() {
    this.declaration = await this.read(resolve(PERF, 'owner-addition-declaration.json'));
    const declaration = this.declaration;
    this.equal(declaration.schema, 'logos-engine.native-cost-owner-qualification-declaration.v1');
    this.equal(declaration.expectedAddedNodeIds, IDS);
    this.equal(declaration.expectedNodeCountDelta, IDS.length);
    this.equal(declaration.expectedFinalGraphRevisionDelta, '3 + trial.cycles');
    this.equal(declaration.originalStrictAggregationStatus, 'failed');
    for (const key of ['numericPolicyChanged', 'measurementOrNativeChange', 'rawTimingModificationPermitted']) this.equal(declaration[key], false, 'Qualification changes the declared experiment');
    this.equal(declaration.allOtherWorkFieldsMustBeExact, true);
    for (const input of declaration.inputs) await this.recorded(input);
    this.check(declaration.inputs.some(row => row.path === relative(ROOT, resolve(PERF, 'owner-addition-protocol.md'))), 'Owner protocol is not declared');
    this.original = await this.read(resolve(PERF, 'declaration.json'));
    this.window = await this.read(resolve(PERF, 'window.json'));
    this.equal(this.window.status, 'passed', 'The original measurement window is incomplete');
    this.report.nativeDigests = this.original.nativeDigests;
    this.receipts = {};
    for (const [side, key] of [['A', 'baseline'], ['B', 'candidate']]) {
      const executionRoots = [...new Set(this.window.executions.filter(row => row.label.startsWith(side)).map(row => resolve(row.checkout)))];
      this.equal(executionRoots.length, 1, 'One frozen checkout is required per measured version');
      this.roots.push(executionRoots[0]);
      const receipt = await this.read(this.paths[key + 'Receipt']); this.receipts[side] = receipt;
      this.equal(receipt.schema, 'logos-engine.lot4a.cost-owner-graphs-receipt.v1');
      this.equal(receipt.status, 'captured_and_raw_shapes_verified'); this.equal(receipt.side, side);
      this.equal(receipt.checkout, executionRoots[0]); this.equal(receipt.failures, []);
      this.equal(receipt.officialMeasurementSessionsAdded, 0); this.equal(receipt.officialTimingValuesModified, false);
      this.equal(receipt.strictCostComparatorPassEstablished, false); this.equal(receipt.strictCostComparatorReexecuted, false);
      this.check(Date.parse(receipt.startedAt) >= Date.parse(declaration.recordedAt), 'Capture predates the declared qualification');
      this.check(Date.parse(receipt.completedAt) >= Date.parse(receipt.startedAt), 'Invalid capture chronology');
      for (const flag of ['nativeSourceUnchanged', 'inputsUnchanged', 'generatorUnchanged']) this.equal(receipt[flag], true, 'Capture input was mutable');
      this.equal(receipt.nativeSourceBefore, receipt.nativeSourceAfter);
      this.equal(receipt.nativeSourceBefore.digest, this.report.nativeDigests[key]);
      const frozen = this.original[key === 'baseline' ? 'baselineManifest' : 'candidateManifest'];
      await this.recorded(frozen); this.equal(await this.read(frozen.path), receipt.nativeSourceBefore, 'Capture does not use the frozen native inventory');
      this.equal(receipt.inputsBefore, receipt.inputsAfter); this.equal(receipt.generator, receipt.generatorAfter);
      await this.recorded(receipt.generator, resolve(BASE, 'capture-cost-owner-graphs.mjs'));
      for (const input of receipt.inputsBefore) await this.recorded(input);
      for (const name of ['owner-addition-declaration.json', 'owner-addition-protocol.md']) {
        this.check(receipt.inputsBefore.some(row => resolve(row.path) === resolve(PERF, name)), 'Capture omitted the owner declaration/protocol');
      }
      await this.recorded(receipt.capture, this.paths[key]);
    }
    this.strict = await this.read(resolve(PERF, 'aggregation-failure-reproduced.json'));
    this.equal(this.strict.exitCode, 1); this.equal(this.strict.inputsUnchanged, true); this.equal(this.strict.outputExists, false);
    await this.recorded(this.strict.log);
    this.report.strictFailure = await this.input(resolve(PERF, 'aggregation-failure-reproduced.json'));
    this.diagnostic = await this.read(resolve(BASE, 'planning/feedback-cost-work-delta.json'));
    this.equal(this.diagnostic.status, 'diagnostic_only_strict_aggregation_failed');
    this.equal(this.diagnostic.inputsUnchanged, true);
    this.raw = {};
    for (const side of ['A', 'B']) {
      this.raw[side] = [];
      for (const execution of this.window.executions.filter(row => row.label.startsWith(side))) {
        const path = execution.copiedOutput ?? execution.output, report = await this.read(path);
        this.equal((await this.input(path)).sha256, execution.copiedReportSha256 ?? execution.reportSha256);
        this.equal(report.status, 'passed'); this.equal(report.nativeSourceUnchanged, true);
        this.equal(report.nativeSource, this.receipts[side].nativeSourceBefore);
        this.raw[side].push({ label: execution.label, report });
      }
      this.raw[side].sort((a, b) => a.label.localeCompare(b.label));
      this.equal(this.raw[side].map(row => row.label), [side + '1', side + '2']);
    }
    this.cases = this.raw.A[0].report.manifest;
    for (const row of [...this.raw.A, ...this.raw.B]) this.equal(row.report.manifest, this.cases);
    this.equal(this.cases.cases.map(row => [row.id, row.actions, row.warmupActions]), [['STCK', 10, 3], ['SMLP', 15, 3]]);
    this.traces = new Map();
    for (const item of this.cases.cases) {
      this.equal((await this.input(item.trace)).sha256, item.traceSha256);
      const trace = await this.read(item.trace); this.equal(trace.status, 'passed'); this.traces.set(item.id, trace);
    }
    for (const path of ['src/logos-engine/kernel.ts', 'src/logos-engine/canonical.ts', 'src/logos-engine/v6-knowledge-store.ts',
      'src/logos-engine/v6-native-state-graph.ts', 'src/logos-engine/v6-src-program.ts', 'src/logos-engine/v6/programs.json',
      'src/logos-engine/interpreter.ts', 'src/logos-engine/ir.ts', 'scripts/compare-native-cost-cohorts.mjs']) {
      const record = await this.input(resolve(ROOT, path));
      if (path.startsWith('src/')) for (const side of ['A', 'B']) this.equal(record.sha256, this.receipts[side].nativeSourceBefore.files[path], 'Graph validator differs between frozen versions');
    }
  }
  measuredWork() {
    const pairs = [], counts = {}, nodeFields = /^\$\.(?:observations\[\d+\]\.nodeCount|inspection\[\d+\]\.graphNodes|final\.nodeCount)$/;
    for (let cohort = 0; cohort < 2; cohort++) for (const item of this.cases.cases) {
      const a = this.raw.A[cohort].report.cases.find(row => row.id === item.id), b = this.raw.B[cohort].report.cases.find(row => row.id === item.id);
      this.equal(a.trials.length, b.trials.length);
      for (let i = 0; i < a.trials.length; i++) {
        const left = a.trials[i], right = b.trials[i], found = differences(workSignature(left), workSignature(right));
        this.equal([left.round, left.warmup], [right.round, right.warmup]);
        for (const change of found) {
          const path = change.path.replace(/\[\d+\]/g, '[*]'); counts[path] = (counts[path] ?? 0) + 1;
          this.check(nodeFields.test(change.path) || change.path === '$.final.graphRevision', 'Additional measured work difference');
          this.equal(change.candidate - change.baseline, nodeFields.test(change.path) ? IDS.length : IDS.length + left.cycles);
        }
        const recorded = this.diagnostic.trialPairs.find(row => row.cohort === `cohort${cohort + 1}` && row.case === item.id && row.round === left.round);
        this.check(Boolean(recorded), 'The exhaustive diagnostic omits a measured pair');
        this.equal(found, recorded.differences, 'The retained exhaustive difference list is not reproduced');
        pairs.push({ cohort: `cohort${cohort + 1}`, case: item.id, round: left.round, warmup: left.warmup, differences: found.length });
      }
    }
    for (const side of ['A', 'B']) for (const item of this.cases.cases) {
      const a = this.raw[side][0].report.cases.find(row => row.id === item.id), b = this.raw[side][1].report.cases.find(row => row.id === item.id);
      this.equal(a.trials.map(workSignature), b.trials.map(workSignature), 'Within-version measured work changed across cohorts');
    }
    this.equal(counts, this.diagnostic.differencesByPath);
    this.equal(pairs.length, this.diagnostic.trialPairs.length);
    this.report.measuredWork = { pairs, differencesByPath: counts, otherWorkFieldsExact: true, withinVersionAcrossCohortsExact: true };
    this.report.counts.measuredPairedTrials = pairs.filter(row => !row.warmup).length;
    this.report.counts.warmupPairedTrials = pairs.filter(row => row.warmup).length;
    this.report.counts.allPairedTrials = pairs.length;
    this.report.counts.measuredWorkDifferences = Object.values(counts).reduce((a, b) => a + b, 0);
  }
  rawTrials(side, caseId, form) {
    return this.raw[side].flatMap(({ label: name, report }) => report.cases.find(row => row.id === caseId).trials
      .filter(row => row.warmup === (form === 'warmup')).map(trial => ({ label: name, trial })));
  }
  start(side, row, ordinal) {
    const item = this.cases.cases[Math.floor(ordinal / 2)], form = ordinal % 2 ? 'full' : 'warmup';
    this.equal([row.caseId, row.form, row.sessionId], [item.id, form, `lot4a-owner-graphs-${item.id.toLowerCase()}-${form}`]);
    this.equal(row.actionsLimit, form === 'warmup' ? item.warmupActions : item.actions);
    this.equal(row.targetLevels, item.targetLevels); this.equal(row.coldKnowledge, true); this.equal(row.checkpointSupplied, false);
    this.equal(row.budgets, { targetLevels: item.targetLevels, levelActionCaps: Array(item.targetLevels).fill(600) });
    this.equal(row.nativeInventoryDigest, this.receipts[side].nativeSourceBefore.digest);
    this.equal([row.trace, row.traceSha256], [item.trace, item.traceSha256]);
    const trace = this.traces.get(item.id);
    this.equal(row.initialPublicPacket, trace.packets[0].packet); this.equal(row.initialPublicPacketSha256, hash(JSON.stringify(row.initialPublicPacket)));
    const trials = this.rawTrials(side, item.id, form);
    this.equal(row.rawTrials, trials.map(({ label, trial }) => ({ label, round: trial.round, warmup: trial.warmup, actions: trial.actions })));
    return { side, start: row, item, trace, trials, identity: [row.caseId, row.form, row.sessionId],
      nodes: {}, revision: 0, chain: null, runtimeDigest: null, commands: 0, pending: null, last: null,
      actual: { requests: [], observations: [], final: null, actions: 0, cycles: 0, levelsCompleted: 0 },
      captureMetadata: [], ownInitial: new Map(), ownPrefixEvidence: [], ownDeltas: 0, commonDeltas: 0 };
  }
  nodeValue(node, nodes) {
    return isNativeStateGraph(node.value) ? hydrateNativeState(node.value, id => {
      this.check(nodes[id]?.kind === 'state_fragment' && nodes[id].scope === node.scope, 'Invalid owner fragment');
      return nodes[id].value;
    }) : decodeNativeState(node.value);
  }
  async graph(state, row) {
    const graph = row.knowledge, snapshot = row.snapshot;
    this.equal(row.runtimeSourceDigest, snapshot.sourceDigest);
    if (state.runtimeDigest === null) {
      state.runtimeDigest = row.runtimeSourceDigest;
      state.kernel = new NativeKnowledgeStore(state.runtimeDigest, row.sessionId).kernel;
    }
    this.equal(row.runtimeSourceDigest, state.runtimeDigest, 'Runtime source identity changed within a cold session');
    this.equal(snapshot.sourceCommit, V6_NATIVE_PROGRAM_REFERENCE);
    this.equal(graph.fromRevision, state.revision); this.equal(graph.toRevision, state.revision + graph.deltasAdded.length);
    const nodes = { ...state.nodes };
    let chain = state.chain;
    for (const delta of graph.deltasAdded) {
      this.equal(Object.keys(delta).sort(), ['cause', 'digest', 'node', 'previous', 'sequence', 'source_digest']);
      this.equal(delta.sequence, ++state.revision); this.equal(delta.previous, chain); this.equal(delta.source_digest, state.runtimeDigest);
      state.kernel.validateNode(delta.node); this.assertions++;
      this.equal(delta.node.scope, row.sessionId); this.equal(delta.node.origin.source_digest, state.runtimeDigest);
      this.equal(delta.node.origin.store_profile, NATIVE_STORE_PROFILE);
      const previous = nodes[delta.node.id];
      this.equal(delta.node.revision, (previous?.revision ?? 0) + 1, 'Node revision progression is invalid');
      if (previous) {
        this.equal(delta.node.kind, previous.kind); this.equal(delta.node.origin, previous.origin);
        this.check(!isDeepStrictEqual({ ...delta.node, revision: previous.revision }, previous), 'A no-op was fabricated as a Kernel delta');
      }
      const actual = await digest({ sequence: delta.sequence, previous: delta.previous, node: delta.node, cause: delta.cause, source_digest: delta.source_digest });
      this.equal(actual, delta.digest, 'Kernel delta digest is invalid');
      chain = delta.digest; nodes[delta.node.id] = delta.node;
    }
    this.equal(graph.chain, chain); this.equal(graph.nodes, nodes, 'Captured nodes do not reconstruct from their complete delta history');
    this.equal([snapshot.graphChain, snapshot.graphRevision, snapshot.nodeCount], [chain, state.revision, Object.keys(nodes).length]);
    const executable = Object.values(nodes).filter(node => ['program', 'family_activation'].includes(node.kind))
      .sort((a, b) => compareUnicode(a.id, b.id)).map(node => ({ id: node.id, value: node.value }));
    this.equal(snapshot.nativeExecutionDigest, await digest({ profile: NATIVE_STORE_PROFILE, source_digest: state.runtimeDigest, nodes: executable }),
      'Snapshot executable identity is not bound to its own graph');
    const ownerIds = Object.keys(nodes).filter(id => IDSET.has(id) || nodes[id].family === 'feedback_sequences').sort();
    this.equal(ownerIds, state.side === 'B' ? [...IDS].sort() : []);
    const owner = nodes[IDS[0]], decoded = owner ? this.nodeValue(owner, nodes) : null;
    this.equal(row.feedback, { present: Boolean(owner), nodeIds: ownerIds, state: decoded,
      nodeRevisions: ownerIds.map(id => ({ id, kind: nodes[id].kind, revision: nodes[id].revision })),
      deltaRevisions: graph.deltasAdded.filter(delta => ownerIds.includes(delta.node.id)).map(delta => ({ sequence: delta.sequence,
        id: delta.node.id, revision: delta.node.revision, cause: delta.cause })) }, 'Decoded Feedback evidence differs from the actual graph');
    state.nodes = nodes; state.chain = chain;
  }
  commonNode(a, b, sourceA, sourceB) {
    this.equal(Object.keys(a).sort(), Object.keys(b).sort(), 'Common node field inventory changed');
    for (const key of Object.keys(a)) {
      if (key === 'value') continue; // Explicit scope: raw values retained; no cross-version value-equality claim.
      if (key === 'origin') {
        this.equal(Object.keys(a.origin).sort(), Object.keys(b.origin).sort());
        for (const field of Object.keys(a.origin)) {
          if (field === 'source_digest') this.equal([a.origin[field], b.origin[field]], [sourceA, sourceB]);
          else this.equal(a.origin[field], b.origin[field], 'Common node origin changed beyond its declared source identity');
        }
      } else this.equal(a[key], b[key], 'Common node metadata changed: ' + a.id + '.' + key);
    }
  }
  async additions(state, point) {
    const extra = point.knowledge.deltasAdded.filter(delta => IDSET.has(delta.node.id));
    for (const delta of extra) {
      const node = delta.node, initial = state.ownInitial.get(node.id);
      if (!initial) {
        this.equal(node.revision, 1); this.equal(node.evidence, []);
        this.equal(delta.cause, node.id === IDS[2]
          ? { workflow: 'v6.feedback_sequences.choose', step: 'native_store', statement: 'program.install' }
          : { workflow: STRATEGY, step: 'initialize', statement: 'family.install' });
        if (node.id === IDS[0]) {
          this.equal(node.kind, 'family_state'); this.equal(node.family, 'feedback_sequences'); this.equal(node.status, 'retained');
          this.equal(node.relations, [{ relation: 'controlled_by', target: IDS[1] }]);
        } else if (node.id === IDS[1]) {
          this.equal(node.kind, 'family_activation'); this.equal(node.family, 'feedback_sequences'); this.equal(node.status, 'active');
          this.equal(this.nodeValue(node, state.nodes), { enabled: true });
        } else {
          this.equal(node.kind, 'program'); this.equal(node.status, 'active');
          const program = nativeProgramDescriptions().find(row => row.id === 'v6.feedback_sequences.choose');
          this.check(Boolean(program), 'Feedback SRC declaration is missing');
          this.equal(this.nodeValue(node, state.nodes), { module: program.module,
            executionHash: await digest({ profile: 'native-stored-ir.v1', module: program.module }), edited: false });
          this.equal(node.definition, { reference_commit: V6_NATIVE_PROGRAM_REFERENCE, source_hash: program.sourceHash,
            semantic_hash: program.semanticHash, transitive_source_hash: program.transitiveSourceHash });
        }
        state.ownInitial.set(node.id, node);
      } else {
        this.equal(node.id, IDS[0], 'Only the owner provenance may add later deltas');
        this.equal(delta.cause, { workflow: STRATEGY, step: 'sealed_prefix', statement: 'outcome.acquire' });
        this.equal(node.evidence.length, 1);
        const evidence = node.evidence[0];
        this.check(typeof evidence === 'string' && evidence.startsWith('prefix_evidence:') && !state.ownPrefixEvidence.includes(evidence), 'Duplicated or invalid owner prefix provenance');
        this.check(point.knowledge.deltasAdded.some(row => row.node.id === evidence && row.node.kind === 'prefix_evidence' && row.node.revision === 1),
          'Owner provenance is not attached to a newly acquired prefix at this point');
        for (const key of Object.keys(initial)) if (!['revision', 'evidence'].includes(key)) this.equal(node[key], initial[key], 'Additional owner state/value changed beyond declared provenance');
        this.equal(Object.keys(node).sort(), Object.keys(initial).sort());
        state.ownPrefixEvidence.push(evidence);
      }
      state.ownDeltas++;
      this.report.extraDeltas.push({ caseId: point.caseId, form: point.form, pointIndex: point.pointIndex, sequence: delta.sequence,
        nodeId: node.id, revision: node.revision, cause: delta.cause, evidence: node.evidence, nodeDigest: await digest(node) });
    }
    this.equal(state.ownInitial.size, IDS.length, 'Not all three owner nodes were installed');
    this.equal(state.ownPrefixEvidence.length, point.snapshot.cycles, 'Owner provenance does not cover every acquired prefix exactly once');
    return extra;
  }
  async point(state, row) {
    this.equal(row.pointIndex, state.actual.requests.length); this.equal(row.request.sessionId, row.sessionId);
    const request = row.request, index = state.commands;
    this.check(['init', 'advance', 'resume'].includes(request.type), 'Unsupported captured operation');
    this.equal(request.sequence, index); this.equal(row.snapshot.actions, index);
    this.equal(row.snapshot.whyAct.enabled, true); this.equal(row.snapshot.caller.enabled, true);
    if (request.type === 'init') {
      this.equal(row.pointIndex, 0); this.equal(request.budgets, state.start.budgets);
      this.equal(row.publicPacket, state.start.initialPublicPacket); this.equal(row.checkedCommandRecord, null);
    } else if (request.type === 'resume') {
      this.equal(state.last?.result.kind, 'boundary'); this.equal(row.publicPacket, null); this.equal(row.checkedCommandRecord, null);
      this.equal(state.pending, null); this.check(index < state.start.actionsLimit, 'A terminal resume was added');
    } else {
      this.check(Boolean(state.pending), 'Public return supplied before its native command was checked');
      this.equal(row.checkedCommandRecord, state.pending.recordIndex); this.equal(request.ticketId, state.pending.ticket.id);
      this.equal(row.publicPacket, state.pending.publicPacket); this.equal(request.executionMs, 0);
      state.pending = null;
    }
    if (request.type !== 'resume') {
      this.equal(row.publicPacket, state.trace.packets[index].packet);
      this.equal(request.observation, publicObservation(row.publicPacket), 'Service received another public return');
    }
    await this.graph(state, row);
    state.actual.requests.push({ type: request.type, sequence: request.sequence, kind: row.result.kind, actions: row.snapshot.actions });
    state.actual.observations.push(observationShape(row));
    state.actual.final = finalShape(row.snapshot);
    for (const key of ['actions', 'cycles', 'levelsCompleted']) state.actual[key] = row.snapshot[key];
    state.last = { result: row.result, pointIndex: row.pointIndex, graphChain: row.snapshot.graphChain, executionDigest: row.snapshot.nativeExecutionDigest };
    state.captureMetadata.push({ recordIndex: row.recordIndex, pointIndex: row.pointIndex, ...state.actual.requests.at(-1),
      ...state.actual.observations.at(-1), level: row.snapshot.level, graphRevision: row.snapshot.graphRevision,
      prefix: row.snapshot.prefix ?? null, runtimeSourceDigest: row.snapshot.sourceDigest,
      feedbackNodeRevisions: row.feedback.nodeRevisions, feedbackDeltaRevisions: row.feedback.deltaRevisions });
  }
  command(state, row) {
    this.check(state.last?.result.kind === 'action' && state.pending === null, 'Command is not authorized by the preceding service result');
    this.equal(row.action, state.commands + 1); this.equal(row.tracePacketIndex, row.action);
    this.equal(row.sourceCapturePointIndex, state.last.pointIndex);
    this.equal(row.returnSupplied, false); this.equal(row.commandEqual, true);
    const expected = state.trace.packets[row.action];
    this.equal(row.expectedCommand, expected.command); this.equal(row.actualCommand, row.expectedCommand);
    this.equal(row.actualCommand, { action_ref: state.last.result.command.actionRef, data: state.last.result.command.data });
    this.equal(row.ticket, state.last.result.ticket); this.equal(row.publicPacket, expected.packet);
    this.equal(row.ticket.graphChain, state.last.graphChain, 'Command ticket does not bind the preceding graph');
    this.equal(row.ticket.nativeExecutionDigest, state.last.executionDigest, 'Command ticket does not bind executable authority');
    this.equal(row.publicPacketSha256, hash(JSON.stringify(expected.packet)));
    state.commands++; state.pending = row;
  }
  end(state, row, receiptSession) {
    this.equal(row.status, 'captured_and_raw_shapes_verified'); this.equal(row.failures, []); this.equal(row.terminalResumePerformed, false);
    this.equal(state.pending, null); this.equal(state.actual.requests.at(-1).type, 'advance');
    this.equal(row.actionsLimit, state.start.actionsLimit);
    for (const key of ['actions', 'cycles', 'levelsCompleted', 'final']) this.equal(row[key], state.actual[key]);
    this.equal(row.actions, row.actionsLimit); this.equal(row.commands, state.commands);
    this.equal(row.captureCount, state.actual.requests.length); this.equal(row.points, row.captureCount);
    const comparisons = [];
    for (const { label: name, trial } of state.trials) {
      this.equal(state.actual, rawShape(trial), 'Captured request/observation/final shape differs from an official trial');
      comparisons.push({ label: name, round: trial.round, warmup: trial.warmup, passed: true, requests: true, observations: true,
        final: true, counters: true, graphRevisionCoverage: 'Exact final raw graphRevision; intermediate raw observations do not expose graphRevision.' });
    }
    this.equal(row.comparisons, comparisons); this.equal(receiptSession.comparisons, comparisons);
    this.equal(receiptSession.captures, state.captureMetadata); this.equal(receiptSession.final, row.final);
    this.equal(receiptSession.status, row.status); this.equal(receiptSession.failures, []);
    this.report.sessions.push({ side: state.side, caseId: row.caseId, form: row.form, sessionId: row.sessionId,
      actions: row.actions, cycles: row.cycles, levelsCompleted: row.levelsCompleted, capturedPoints: row.points,
      rawTrialsCompared: comparisons.length, final: row.final, runtimeSourceDigest: state.runtimeDigest,
      graphDeltasVerified: state.revision, ownerDeltas: state.ownDeltas });
  }
  async captures() {
    const a = captureStream(this.paths.baseline), b = captureStream(this.paths.candidate);
    let sessions = 0, states = null, count = 0, footer = false, points = 0, commands = 0, preflight = false;
    try {
      while (true) {
        const [left, right] = await Promise.all([a.next(), b.next()]);
        this.equal(left.done, right.done, 'The two capture streams have different lengths');
        if (left.done) break;
        const x = left.value, y = right.value;
        this.equal(x.type, y.type, 'Captured operations were reordered between versions');
        if (x.type === '$header') {
          for (const [side, row] of [['A', x.value], ['B', y.value]]) {
            this.equal(row.schema, 'logos-engine.lot4a.cost-owner-graphs.v1'); this.equal(row.side, side);
            this.equal(row.checkout, this.receipts[side].checkout); this.equal(row.startedAt, this.receipts[side].startedAt);
          }
          continue;
        }
        if (x.type === '$footer') {
          this.equal(states, null); this.equal(sessions, 4); footer = true;
          for (const [side, row] of [['A', x.value], ['B', y.value]]) {
            this.equal(row.status, this.receipts[side].status); this.equal(row.completedAt, this.receipts[side].completedAt);
            this.equal(row.recordCount, count);
          }
          continue;
        }
        this.equal(x.recordIndex, count); this.equal(y.recordIndex, count++);
        if (x.type === 'preflight') {
          this.equal(preflight, false); this.equal(sessions, 0); preflight = true;
          for (const [side, row] of [['A', x], ['B', y]]) {
            this.equal(row.nativeSource, this.receipts[side].nativeSourceBefore); this.equal(row.generator, this.receipts[side].generator);
            this.equal(row.inputs, this.receipts[side].inputsBefore); this.equal(row.expectedOwnerIds, IDS);
            this.equal(row.declaredStrictAggregationStatus, 'failed'); this.equal(row.measuredCostSessions, 0);
            this.equal(row.plannedSessions, 4); this.equal(row.plannedActions, this.cases.cases.reduce((n, item) => n + item.actions + item.warmupActions, 0));
          }
        } else if (x.type === 'session_start') {
          this.check(preflight && states === null && sessions < 4, 'Unexpected cold session boundary');
          states = [this.start('A', x, sessions), this.start('B', y, sessions)];
        } else {
          this.check(Boolean(states), 'A record appeared outside its cold session');
          for (const [state, row] of [[states[0], x], [states[1], y]]) this.equal([row.caseId, row.form, row.sessionId], state.identity);
          if (x.type === 'capture') {
            this.equal([x.request.type, x.request.sequence, x.pointIndex], [y.request.type, y.request.sequence, y.pointIndex]);
            await this.point(states[0], x); await this.point(states[1], y); points++;
            const aIds = Object.keys(x.knowledge.nodes).sort(), bIds = Object.keys(y.knowledge.nodes).sort();
            this.equal(aIds.filter(id => !own(y.knowledge.nodes, id)), [], 'A common graph node was removed');
            this.equal(bIds.filter(id => !own(x.knowledge.nodes, id)), [...IDS].sort(), 'Unexpected added node identities');
            for (const id of aIds) this.commonNode(x.knowledge.nodes[id], y.knowledge.nodes[id], states[0].runtimeDigest, states[1].runtimeDigest);
            const common = y.knowledge.deltasAdded.filter(delta => !IDSET.has(delta.node.id));
            this.equal(common.length, x.knowledge.deltasAdded.length, 'Additional or missing common deltas');
            const structure = [];
            for (let index = 0; index < common.length; index++) {
              const da = x.knowledge.deltasAdded[index], db = common[index];
              this.equal([da.node.id, da.node.kind, da.node.revision, da.cause], [db.node.id, db.node.kind, db.node.revision, db.cause], 'Common delta identity/cause/order changed');
              this.commonNode(da.node, db.node, states[0].runtimeDigest, states[1].runtimeDigest);
              structure.push({ baselineSequence: da.sequence, candidateSequence: db.sequence, nodeId: da.node.id, revision: da.node.revision, cause: da.cause });
            }
            const extra = await this.additions(states[1], y);
            this.equal(y.knowledge.toRevision - x.knowledge.toRevision, IDS.length + y.snapshot.cycles);
            this.equal(y.snapshot.nodeCount - x.snapshot.nodeCount, IDS.length);
            this.report.points.push({ caseId: x.caseId, form: x.form, pointIndex: x.pointIndex, request: x.request.type,
              sequence: x.request.sequence, baselineNodes: x.snapshot.nodeCount, candidateNodes: y.snapshot.nodeCount,
              baselineRevision: x.snapshot.graphRevision, candidateRevision: y.snapshot.graphRevision, acquiredPrefixes: x.snapshot.cycles,
              commonDeltas: common.length, commonDeltaPositionDigest: await digest(structure), extraDeltaSequences: extra.map(delta => delta.sequence) });
          } else if (x.type === 'command_checked') {
            this.command(states[0], x); this.command(states[1], y); commands++;
            this.equal([x.action, x.actualCommand, x.publicPacket, x.publicPacketSha256], [y.action, y.actualCommand, y.publicPacket, y.publicPacketSha256]);
          } else if (x.type === 'session_end') {
            this.end(states[0], x, this.receipts.A.sessions[sessions]); this.end(states[1], y, this.receipts.B.sessions[sessions]);
            states = null; sessions++;
          } else this.check(false, 'Unexpected capture failure or record type: ' + x.type);
        }
      }
      this.check(footer && preflight && states === null, 'Capture stream is incomplete');
      this.report.counts.capturedSessions = sessions * 2;
      this.report.counts.capturedSessionPairs = sessions;
      this.report.counts.capturedPoints = points * 2;
      this.report.counts.capturedPointPairs = points;
      this.report.counts.capturedActions = commands * 2;
      this.report.counts.capturedCommandPairs = commands;
      this.report.counts.extraOwnerDeltas = this.report.extraDeltas.length;
      for (const side of ['A', 'B']) {
        const list = this.report.sessions.filter(row => row.side === side), receipt = this.receipts[side];
        this.equal(receipt.sessionCount, list.length); this.equal(receipt.actions, list.reduce((n, row) => n + row.actions, 0));
        this.equal(receipt.rawTrialsCompared, list.reduce((n, row) => n + row.rawTrialsCompared, 0));
      }
    } finally { await a.return(); await b.return(); }
  }
  async unchanged() {
    this.report.inputs = [...this.inputs.values()];
    this.report.inputsAfter = [];
    for (const input of this.report.inputs) this.report.inputsAfter.push(await this.fingerprint(input.path));
    this.equal(this.report.inputsAfter, this.report.inputs, 'Qualification input bytes changed');
    this.report.inputsUnchanged = true;
  }
}

async function main() {
  const args = process.argv.slice(2);
  assert.equal(args.length, 5, 'Usage: qualify-cost-owner-graphs.mjs BASELINE.gz BASELINE.receipt.json AFTER.gz AFTER.receipt.json OUTPUT.json');
  const [baseline, baselineReceipt, candidate, candidateReceipt, output] = args.map(path => resolve(ROOT, path));
  assert.equal(dirname(output), PERF, 'Exclusive qualification output belongs in performance-integrated');
  assert.ok(output.endsWith('.json'));
  try { await access(output); throw new Error('Qualification output already exists'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const audit = new Qualification({ baseline, baselineReceipt, candidate, candidateReceipt, output });
  audit.report.generator = await audit.input(SCRIPT);
  let complete = true;
  for (const [name, operation] of [['declared_scope_and_immutable_provenance', () => audit.provenance()],
    ['all_measured_work_differences_reproduced', () => audit.measuredWork()],
    ['every_captured_graph_public_order_and_owner_delta', () => audit.captures()],
    ['inputs_unchanged_after_qualification', () => audit.unchanged()]]) {
    if (complete) complete = await audit.group(name, operation);
    else audit.report.checks.push({ name, passed: false, assertions: 0, notRunAfterFailure: true });
  }
  audit.report.status = complete ? 'qualified_owner_addition_verified' : 'owner_addition_qualification_failed';
  audit.report.checkedCount = audit.report.checks.reduce((n, row) => n + row.assertions, 0);
  audit.report.checksAssertions = audit.report.checkedCount;
  audit.report.inputs ??= [...audit.inputs.values()]; audit.report.inputsUnchanged ??= false;
  audit.report.completedAt = new Date().toISOString();
  await writeFile(output, JSON.stringify(audit.report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: audit.report.status, output: label(output), nativeDigests: audit.report.nativeDigests,
    counts: audit.report.counts, checks: audit.report.checks, checkedCount: audit.report.checkedCount,
    workMetadataExact: false, strictAggregationReclassified: false }, null, 2));
  if (!complete) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT) await main();
