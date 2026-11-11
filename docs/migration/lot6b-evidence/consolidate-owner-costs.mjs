#!/usr/bin/env node
/**
 * Predeclared lot 6B owner-cost consolidation. No runtime or benchmark executes.
 * CLI: node docs/migration/lot6b-evidence/consolidate-owner-costs.mjs CONTRACT OUTPUT
 * Arithmetic, workSignature and report checks are identified adaptations of
 * scripts/compare-native-cost-cohorts.mjs and compare-native-loop-costs.mjs.
 * Historical tools, failures and raw inputs remain unchanged. This schema never
 * asserts that the historical strict graph-identity comparison passed.
 */
// Directly adapted from the immutable published lot6A tool. Source fingerprints
// and review diffs are retained in cost-review/attempt-01.
// No predecessor measurements are reused.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const EVIDENCE = 'docs/migration/lot6b-evidence/';
const SELF = EVIDENCE + 'consolidate-owner-costs.mjs';
const REVIEWER = EVIDENCE + 'review-owner-costs.py';
const HISTORICAL = 'scripts/compare-native-cost-cohorts.mjs';
const PAIR = 'scripts/compare-native-loop-costs.mjs';
const STAGES = ['session_elapsed', 'new_decision', 'known_prefix_service', 'known_prefix_request',
  'known_prefix_guard', 'acquisition_and_persistence', 'persistence', 'restoration'];
const ORDER = ['A1', 'B1', 'B2', 'A2'];
const EXPECTATION = {
  ownerId: 'selected_rigid', programId: null,
  installedNodeIds: ['family_state:selected_rigid', 'family_activation:selected_rigid'],
  allowedPaths: ['observations[*].nodeCount', 'inspection[*].graphNodes', 'final.nodeCount', 'final.graphRevision'],
  mode: 'predeclared_functional_fixture',
  qualification: 'functional_structure_frozen_before_measurement',
};
const SOURCE_PATHS = ["src/logos-engine/v6-native-runtime.ts", "src/logos-engine/v6-selected-rigid.ts", "src/logos-engine/v6-selected-rigid-types.ts", "src/logos-engine/v6-selected-rigid-geometry.ts", "src/logos-engine/v6-selected-rigid-search.ts", "src/logos-engine/v6-knowledge-store.ts", "src/logos-engine/kernel.ts"];

/** Validate emitted records; exhaustive graph traversal belongs to the pinned qualifier. */
export function validateCommonValueAttribution(attribution, receipts, fixture) {
  const comparison = 'exact_except_attributed_trace_envelope_created';
  const sources = ['src/logos-engine/v6-reasoning-memory.ts', 'src/logos-engine/v6-native-authority.ts'];
  const roles = ['baseline', 'candidate'];
  const keys = (value, expected) => {
    assert.ok(value && typeof value === 'object' && !Array.isArray(value), 'Expected an attribution object');
    assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
  };
  const integer = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum;
  const millis = value => {
    assert.equal(typeof value, 'string');
    const result = Date.parse(value);
    assert.ok(integer(result)); assert.equal(new Date(result).toISOString(), value);
    return result;
  };
  const fingerprint = record => {
    keys(record, ['path', 'bytes', 'sha256']); assert.equal(typeof record.path, 'string'); assert.ok(record.path.length > 0);
    assert.ok(integer(record.bytes)); assert.equal(typeof record.sha256, 'string'); assert.match(record.sha256, /^[0-9a-f]{64}$/);
  };
  const same = (a, b) => { try { assert.deepEqual(a, b); return true; } catch { return false; } };
  assert.equal(attribution.schema, 'logos-engine.lot6b-owner-cost-structural-attribution.v1');
  assert.equal(attribution.status, 'qualified_functional_structure'); assert.deepEqual(attribution.failures, []);
  keys(receipts, roles); keys(fixture.captures, roles); assert.deepEqual(attribution.nativeDigests, fixture.nativeDigests);
  const policy = attribution.commonValuePolicy;
  keys(policy, ['comparison', 'permittedMetadataDifference', 'identityValueAttributions',
    'unattributedDifferencesAllowed', 'traceCreatedAttribution']);
  const { traceCreatedAttribution: temporal, ...fixedPolicy } = policy;
  assert.deepEqual(fixedPolicy, { comparison, permittedMetadataDifference: 'origin.source_digest',
    identityValueAttributions: [], unattributedDifferencesAllowed: 0 });
  keys(temporal, ['nodeComponent', 'path', 'sourceClock', 'sourceFiles', 'captureWindows', 'stabilityKey', 'records', 'allOtherFieldsExact']);
  const { captureWindows, records, ...fixedTemporal } = temporal;
  assert.deepEqual(fixedTemporal, { nodeComponent: 'native_reasoning_trace', path: '/value/root/members/created/bits',
    sourceClock: 'Date.now() / 1000', sourceFiles: sources, stabilityKey: ['role', 'sessionId', 'nodeId'], allOtherFieldsExact: true });
  assert.ok(Array.isArray(attribution.inputs)); attribution.inputs.forEach(fingerprint);
  assert.equal(new Set(attribution.inputs.map(record => record.path)).size, attribution.inputs.length);
  fingerprint(attribution.generator);
  assert.equal(attribution.generator.path, 'docs/migration/lot6b-evidence/qualify-cost-owner-graphs.mjs');
  assert.ok(attribution.inputs.some(record => same(record, attribution.generator)), 'Qualifier input is unbound');
  const forms = fixture.forms;
  assert.deepEqual(forms.map(form => [form.case, form.form]), [['STCK', 'warmup'], ['STCK', 'measured'], ['SMLP', 'warmup'], ['SMLP', 'measured']]);
  const windows = {}, sessions = {}; let expectedPoints = null;
  for (const role of roles) {
    const receipt = receipts[role];
    assert.equal(receipt.schema, 'logos-engine.lot6b-owner-cost-functional-capture-receipt.v1');
    assert.equal(receipt.status, 'captured_functional_structure'); assert.equal(receipt.role, role);
    assert.equal(receipt.nativeDigest, attribution.nativeDigests[role]); assert.deepEqual(receipt.report, fixture.captures[role].report);
    assert.deepEqual(receipt.generator, fixture.captureTool); assert.deepEqual(receipt.nativeInventoryBefore, receipt.nativeInventoryAfter);
    assert.equal(receipt.nativeInventoryBefore.digest, receipt.nativeDigest);
    assert.deepEqual(receipt.inputsBefore, receipt.inputsAfter); assert.deepEqual(receipt.generator, receipt.generatorAfter);
    for (const key of ['nativeSourceUnchanged', 'inputsUnchanged', 'generatorUnchanged']) assert.equal(receipt[key], true);
    assert.deepEqual(receipt.failures, []);
    for (const record of Object.values(fixture.captures[role])) {
      fingerprint(record); assert.ok(attribution.inputs.some(item => same(record, item)), 'Capture receipt/report is unbound');
    }
    for (const path of sources) {
      const source = attribution.inputs.filter(record => record.path === path);
      assert.equal(source.length, 1); assert.equal(source[0].sha256, receipt.nativeInventoryBefore.files[path], 'Clock source is unbound');
    }
    const startMs = millis(receipt.startedAt), finishMs = millis(receipt.finishedAt);
    assert.ok(startMs <= finishMs); windows[role] = { startedAt: receipt.startedAt, finishedAt: receipt.finishedAt, startMs, finishMs };
    assert.ok(integer(receipt.sessionCount, 1)); assert.equal(receipt.sessionCount, receipt.sessions.length);
    assert.equal(receipt.sessions.length, forms.length);
    const sessionMap = new Map(), pointKeys = [];
    receipt.sessions.forEach((session, index) => {
      const form = forms[index], sid = 'lot6b-owner-cost-' + form.case.toLowerCase() + '-' + form.form;
      assert.deepEqual([session.case, session.form, session.sessionId], [form.case, form.form, sid]);
      assert.equal(session.status, 'captured_functional_structure'); assert.ok(!sessionMap.has(sid));
      assert.ok(integer(session.captures, 1) && integer(session.terminalInspections));
      assert.equal(session.captures, session.shape.requests.length); assert.equal(session.terminalInspections, session.shape.inspection.length);
      assert.deepEqual(session.shape, form[role]); sessionMap.set(sid, session);
      for (let pointIndex = 0; pointIndex < session.captures + session.terminalInspections; pointIndex++)
        pointKeys.push([form.case, form.form, pointIndex]);
    });
    sessions[role] = sessionMap; if (expectedPoints === null) expectedPoints = pointKeys;
    assert.deepEqual(pointKeys, expectedPoints);
  }
  assert.deepEqual(captureWindows, windows, 'Policy windows must match bound capture receipts');
  assert.ok(Array.isArray(attribution.points) && attribution.points.length > 0);
  assert.deepEqual(attribution.points.map(point => [point.case, point.form, point.pointIndex]), expectedPoints);
  assert.deepEqual(attribution.commonValueCoverage, attribution.points.map(point => {
    assert.ok(integer(point.pointIndex) && integer(point.baselineNodeCount, 1) && integer(point.baselineDeltaCount));
    return { case: point.case, form: point.form, pointIndex: point.pointIndex, commonNodesCompared: point.baselineNodeCount,
      commonDeltasCompared: point.baselineDeltaCount, comparison, unattributedDifferences: 0 };
  }));
  assert.ok(Array.isArray(records) && records.length > 0);
  const seen = new Set(), pairs = new Map(), represented = new Set();
  for (const record of records) {
    keys(record, ['role', 'sessionId', 'nodeId', 'bits', 'seconds', 'milliseconds', 'createdAt', 'captureStartedAt', 'captureFinishedAt']);
    const { role, sessionId, nodeId, bits, seconds, milliseconds } = record;
    assert.ok(roles.includes(role) && typeof sessionId === 'string' && sessions[role].has(sessionId));
    assert.equal(typeof nodeId, 'string'); const match = /^reasoning:trace:([1-9][0-9]*)$/.exec(nodeId);
    assert.ok(match && integer(Number(match[1]), 1));
    const key = JSON.stringify([role, sessionId, nodeId]), pair = JSON.stringify([sessionId, nodeId]);
    assert.ok(!seen.has(key), 'Duplicate or unstable role/session/trace'); seen.add(key);
    represented.add(JSON.stringify([role, sessionId]));
    if (!pairs.has(pair)) pairs.set(pair, new Set()); pairs.get(pair).add(role);
    assert.equal(typeof bits, 'string'); assert.match(bits, /^[0-9a-f]{16}$/);
    const decoded = Buffer.from(bits, 'hex').readDoubleBE(0);
    assert.ok(typeof seconds === 'number' && Number.isFinite(decoded) && integer(milliseconds));
    assert.equal(seconds, decoded); assert.equal(seconds, milliseconds / 1000); assert.equal(Math.round(seconds * 1000), milliseconds);
    const window = windows[role];
    assert.ok(milliseconds >= window.startMs && milliseconds <= window.finishMs);
    assert.equal(millis(record.createdAt), milliseconds);
    assert.equal(record.captureStartedAt, window.startedAt); assert.equal(record.captureFinishedAt, window.finishedAt);
  }
  for (const pair of pairs.values()) assert.deepEqual([...pair].sort(), roles);
  assert.deepEqual([...represented].sort(), roles.flatMap(role => [...sessions[role].keys()].map(sid => JSON.stringify([role, sid]))).sort());
  // No derived trace-count rule. The pinned qualifier establishes exhaustive
  // common-node/delta traversal, exact other values and role-bound graph origins,
  // chains and tickets; this local validator neither reopens nor normalizes them.
  return true;
}

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const omit = (value, keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
const touched = new Map();
// The lot 7A io-v1 variant (SHA-256
// 78ed9ea54051f9f5de6ce7a6659094d33d2729f3cd53075a03c44be3a98f6aac)
// exposed an attribution-reader path defect. Here this bounded adapter is part
// of the declared 6B tool BEFORE measurement. It takes its exact whitelist from
// the already-fingerprinted baseline capture, not from a post-measurement receipt.
let baselineAttributionAccess = null;
function inside(path) {
  assert.equal(typeof path, 'string');
  const absolute = resolve(ROOT, path), local = relative(ROOT, absolute);
  assert.ok(local && !local.startsWith('..') && !local.startsWith('/'), 'Evidence path must stay inside this checkout');
  return absolute;
}
async function hashFile(absolute) {
  const hash = createHash('sha256'); let bytes = 0;
  for await (const chunk of createReadStream(absolute)) { bytes += chunk.length; hash.update(chunk); }
  return { sha256: hash.digest('hex'), bytes };
}
function retainFingerprint(absolute, record) {
  const previous = touched.get(absolute);
  if (previous) assert.equal(previous, record.sha256, 'Input changed during analysis: ' + absolute);
  touched.set(absolute, record.sha256);
}
async function fingerprint(path) {
  const absolute = inside(path), record = { path: relative(ROOT, absolute), ...await hashFile(absolute) };
  retainFingerprint(absolute, record);
  return record;
}
async function readEvidence(path) {
  const absolute = inside(path), bytes = await readFile(absolute), record = await fingerprint(absolute);
  assert.equal(sha(bytes), record.sha256, 'Read raced with input mutation');
  return { value: JSON.parse(path.endsWith('.gz') ? gunzipSync(bytes) : bytes), fingerprint: record };
}
async function verify(record) { assert.deepEqual(await fingerprint(record.path), record); return record; }
async function verifyCaptureInput(record) {
  assert.deepEqual(Object.keys(record).sort(), ['bytes', 'path', 'sha256']);
  assert.equal(typeof record.path, 'string'); assert.match(record.sha256, /^[0-9a-f]{64}$/);
  assert.ok(Number.isSafeInteger(record.bytes) && record.bytes >= 0);
  if (record.path.startsWith('/')) {
    const absolute = resolve(record.path), current = await hashFile(absolute);
    assert.deepEqual(current, omit(record, ['path']), 'Frozen capture input changed: ' + record.path);
    retainFingerprint(absolute, current);
  } else await verify(record);
}
async function pinBaselineAttributionInputs(receipt) {
  assert.equal(baselineAttributionAccess, null, 'Only one frozen baseline capture may authorize attribution inputs');
  assert.ok(typeof receipt.checkout === 'string' && isAbsolute(receipt.checkout));
  const root = await realpath(receipt.checkout);
  assert.notEqual(root, await realpath(ROOT), 'Baseline capture must use a distinct checkout');
  const inputs = new Map();
  for (const record of receipt.inputsBefore.filter(item => isAbsolute(item.path))) {
    const absolute = await realpath(record.path), local = relative(root, absolute);
    assert.ok(local && !local.startsWith('..') && !isAbsolute(local), 'Absolute baseline capture input escaped its frozen checkout');
    assert.ok(!inputs.has(record.path), 'Duplicate baseline capture path'); inputs.set(record.path, record);
  }
  assert.ok(inputs.size > 0, 'Baseline capture must identify its external frozen inputs');
  baselineAttributionAccess = { root, inputs };
}
async function verifyAttributionInput(record) {
  if (!isAbsolute(record.path)) return verify(record);
  assert.ok(baselineAttributionAccess, 'Baseline capture inputs must be pinned before attribution');
  assert.deepEqual(record, baselineAttributionAccess.inputs.get(record.path), 'External attribution input is not exactly in the predeclared baseline capture');
  const absolute = await realpath(record.path), local = relative(baselineAttributionAccess.root, absolute);
  assert.ok(local && !local.startsWith('..') && !isAbsolute(local), 'External attribution input escaped its frozen baseline checkout');
  return verifyCaptureInput(record); // Same byte/SHA-256 checks and final rehash as every retained capture input.
}
function instant(value) {
  assert.equal(typeof value, 'string');
  assert.match(value, /(?:Z|[+-]\d{2}:\d{2})$/);
  const result = Date.parse(value); assert.ok(Number.isFinite(result), 'Invalid timestamp'); return result;
}
function sameMembers(actual, expected, message) {
  assert.equal(new Set(actual).size, actual.length, 'Duplicate members: ' + message);
  assert.deepEqual([...actual].sort(), [...expected].sort(), message);
}
function sourceDigest(files) {
  return sha(Buffer.from(JSON.stringify(Object.fromEntries(Object.entries(files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)))));
}
function unresolvedFor(comparisons) {
  return comparisons.flatMap(row => row.metrics.filter(metric => metric.budgetApplies && metric.result !== 'within_observed_budget')
    .map(metric => ({ case: row.case, stage: metric.stage, result: metric.result, medianRelativeIncrease: metric.medianRelativeIncrease })));
}
function strictDecimalBudget(before, after) {
  const rational = value => {
    assert.ok(Number.isFinite(value) && value > 0, 'Positive finite global median required');
    const [mantissa, exponent = '0'] = String(value).toLowerCase().split('e');
    const [whole, fraction = ''] = mantissa.split('.');
    let numerator = BigInt(whole + fraction), denominator = 1n;
    const scale = fraction.length - Number(exponent);
    if (scale >= 0) denominator = 10n ** BigInt(scale); else numerator *= 10n ** BigInt(-scale);
    return [numerator, denominator];
  };
  const [a, ad] = rational(before), [b, bd] = rational(after);
  return b * ad * 10n < a * bd * 11n;
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function functionalShape(trial) {
  return { actions: trial.actions, cycles: trial.cycles, levelsCompleted: trial.levelsCompleted,
    requests: trial.requests.map(row => ({ type: row.type, sequence: row.sequence, kind: row.kind, actions: row.actions })),
    observations: trial.observations, inspection: trial.inspection.map(row => ({ graphNodes: row.graphNodes })), final: trial.final };
}
function structuralExpectations(form) {
  const before = form.baseline, after = form.candidate;
  assert.equal(before.observations.length, after.observations.length, 'Functional observation count changed');
  assert.equal(before.inspection.length, after.inspection.length, 'Functional inspection count changed');
  const expected = new Map();
  before.observations.forEach((row, i) => expected.set('observations[' + i + '].nodeCount', [row.nodeCount, after.observations[i].nodeCount]));
  before.inspection.forEach((row, i) => expected.set('inspection[' + i + '].graphNodes', [row.graphNodes, after.inspection[i].graphNodes]));
  expected.set('final.nodeCount', [before.final.nodeCount, after.final.nodeCount]);
  expected.set('final.graphRevision', [before.final.graphRevision, after.final.graphRevision]);
  return expected;
}
function compareQualifiedStructure(before, after, form, context) {
  const expected = structuralExpectations(form);
  const rows = [], visited = new Set();
  function walk(a, b, path) {
    if (expected.has(path)) {
      assert.ok(Number.isSafeInteger(a) && a >= 0 && Number.isSafeInteger(b) && b >= 0, 'Invalid structural count: ' + path);
      const [expectedBefore, expectedAfter] = expected.get(path);
      assert.equal(a, expectedBefore, 'Baseline differs from predeclared functional fixture: ' + path);
      assert.equal(b, expectedAfter, 'Candidate differs from predeclared functional fixture: ' + path);
      rows.push({ ...context, path, before: a, after: b, delta: b - a, expectedBefore, expectedAfter,
        expectedDelta: expectedAfter - expectedBefore, rule: 'predeclared_functional_fixture', fixtureForm: { case: form.case, form: form.form } });
      visited.add(path); return;
    }
    if (Array.isArray(a)) {
      assert.ok(Array.isArray(b), 'Array type changed: ' + path); assert.equal(a.length, b.length, 'Array length changed: ' + path);
      a.forEach((value, i) => walk(value, b[i], path + '[' + i + ']')); return;
    }
    if (a !== null && typeof a === 'object') {
      assert.ok(b !== null && typeof b === 'object' && !Array.isArray(b), 'Object type changed: ' + path);
      assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), 'Fields changed: ' + path);
      for (const key of Object.keys(a)) walk(a[key], b[key], path ? path + '.' + key : key);
      return;
    }
    assert.deepEqual(a, b, 'Unqualified work difference: ' + path);
  }
  walk(before, after, '');
  assert.deepEqual([...visited].sort(), [...expected.keys()].sort(), 'Missing structural fields');
  return rows.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
function compareOwnerWork(before, after, context, form) {
  assert.ok(form, 'Missing predeclared functional form');
  assert.deepEqual(functionalShape(before), form.baseline, 'Baseline trial differs from its predeclared functional form');
  assert.deepEqual(functionalShape(after), form.candidate, 'Candidate trial differs from its predeclared functional form');
  return compareQualifiedStructure(workSignature(before), workSignature(after), form, context);
}
async function loadStructuralFixture(contract, declaration, manifests) {
  await verify(contract.structuralFixture);
  const fixtureFile = await readEvidence(contract.structuralFixture.path), fixture = fixtureFile.value;
  assert.equal(fixture.schema, 'logos-engine.lot6b-owner-cost-structural-fixture.v1');
  assert.equal(fixture.status, 'qualified_functional_structure');
  assert.deepEqual(fixture.nativeDigests, declaration.nativeDigests);
  await verify(fixture.cases); await verify(fixture.captureTool);
  assert.deepEqual(omit(fixture.cases, ['path']), omit(declaration.cases, ['path']), 'Functional and measured cases must be byte-identical');
  assert.deepEqual(Object.keys(fixture.captures).sort(), ['baseline', 'candidate']);
  assert.deepEqual(fixture.forms.map(row => [row.case, row.form]), [
    ['STCK', 'warmup'], ['STCK', 'measured'], ['SMLP', 'warmup'], ['SMLP', 'measured']]);
  const expectedKeys = {
    shape: ['actions', 'cycles', 'levelsCompleted', 'requests', 'observations', 'inspection', 'final'],
    request: ['type', 'sequence', 'kind', 'actions'],
    observation: ['type', 'sequence', 'family', 'proposalKind', 'poseMode', 'actions', 'cycles', 'levelsCompleted', 'nodeCount', 'acquiredTransitions'],
    final: ['actions', 'levelsCompleted', 'reason', 'graphRevision', 'nodeCount', 'acquiredTransitions', 'implementation'],
  };
  for (const form of fixture.forms) {
    assert.deepEqual(Object.keys(form).sort(), ['baseline', 'candidate', 'case', 'form']);
    for (const role of ['baseline', 'candidate']) {
      const shape = form[role];
      assert.deepEqual(Object.keys(shape).sort(), [...expectedKeys.shape].sort(), 'Functional shape fields');
      assert.equal(shape.actions, form.form === 'warmup' ? 3 : form.case === 'STCK' ? 10 : 15);
      for (const key of ['actions', 'cycles', 'levelsCompleted']) assert.ok(Number.isSafeInteger(shape[key]) && shape[key] >= 0);
      assert.ok(Array.isArray(shape.requests) && shape.requests.length > 0);
      for (const row of shape.requests) assert.deepEqual(Object.keys(row).sort(), [...expectedKeys.request].sort());
      assert.ok(Array.isArray(shape.observations) && shape.observations.length > 0);
      for (const row of shape.observations) {
        assert.deepEqual(Object.keys(row).sort(), [...expectedKeys.observation].sort());
        assert.ok(Number.isSafeInteger(row.nodeCount) && row.nodeCount >= 0);
      }
      assert.ok(Array.isArray(shape.inspection)); assert.equal(shape.inspection.length, form.form === 'warmup' ? 0 : 3);
      for (const row of shape.inspection) {
        assert.deepEqual(Object.keys(row), ['graphNodes']); assert.ok(Number.isSafeInteger(row.graphNodes) && row.graphNodes >= 0);
      }
      assert.deepEqual(Object.keys(shape.final).sort(), [...expectedKeys.final].sort());
      for (const key of ['nodeCount', 'graphRevision']) assert.ok(Number.isSafeInteger(shape.final[key]) && shape.final[key] >= 0);
      assert.equal(shape.final.actions, shape.actions); assert.equal(shape.final.acquiredTransitions, shape.actions);
      assert.equal(shape.final.levelsCompleted, shape.levelsCompleted);
      assert.equal(shape.final.implementation, 'logos-engine.typescript.v6.native-migration/' + declaration[role].nativeVersion);
    }
    compareQualifiedStructure({ ...form.baseline, final: omit(form.baseline.final, ['implementation']) },
      { ...form.candidate, final: omit(form.candidate.final, ['implementation']) }, form, {});
  }
  const requiredInputs = [fixture.captureTool, fixture.cases, ...contract.sourceEvidence], captureFinishes = [], captureReceipts = {};
  for (const role of ['baseline', 'candidate']) {
    const capture = fixture.captures[role];
    assert.deepEqual(Object.keys(capture).sort(), ['receipt', 'report']);
    // The graph reports are fingerprinted as streams. The separate, pinned
    // qualifier reconstructs their node histories; this analyzer reads only receipts.
    await verify(capture.report); await verify(capture.receipt);
    const receipt = (await readEvidence(capture.receipt.path)).value;
    captureReceipts[role] = receipt;
    assert.equal(receipt.schema, 'logos-engine.lot6b-owner-cost-functional-capture-receipt.v1');
    assert.equal(receipt.status, 'captured_functional_structure'); assert.equal(receipt.role, role);
    assert.equal(receipt.nativeDigest, fixture.nativeDigests[role]);
    await verifyCaptureInput(receipt.nativeSourceBefore); await verifyCaptureInput(receipt.nativeSourceAfter);
    assert.deepEqual(receipt.nativeSourceBefore, receipt.nativeSourceAfter);
    assert.deepEqual(omit(receipt.nativeSourceBefore, ['path']), omit(declaration[role + 'Manifest'], ['path']));
    assert.deepEqual(receipt.nativeInventoryBefore, manifests[role]); assert.deepEqual(receipt.nativeInventoryAfter, manifests[role]);
    assert.equal(receipt.nativeSourceUnchanged, true); assert.equal(receipt.inputsUnchanged, true); assert.equal(receipt.generatorUnchanged, true);
    assert.deepEqual(receipt.failures, []); assert.deepEqual(receipt.report, capture.report); assert.deepEqual(receipt.generator, fixture.captureTool);
    await verifyCaptureInput(receipt.cases);
    assert.deepEqual(omit(receipt.cases, ['path']), omit(fixture.cases, ['path']));
    assert.deepEqual(receipt.inputsBefore, receipt.inputsAfter);
    assert.ok(Array.isArray(receipt.inputsBefore) && receipt.inputsBefore.length > 0);
    assert.equal(new Set(receipt.inputsBefore.map(record => record.path)).size, receipt.inputsBefore.length);
    for (const record of receipt.inputsBefore) await verifyCaptureInput(record);
    for (const required of [receipt.cases, receipt.nativeSourceBefore]) {
      assert.ok(receipt.inputsBefore.some(record => record.path === required.path && record.sha256 === required.sha256 && record.bytes === required.bytes),
        'Functional capture must bind ' + required.path);
    }
    assert.equal(receipt.sessionCount, 4); assert.equal(receipt.actions, 31); assert.equal(receipt.sessions.length, 4);
    assert.deepEqual(receipt.sessions.map(row => [row.case, row.form]), fixture.forms.map(row => [row.case, row.form]));
    for (let i = 0; i < 4; i++) assert.deepEqual(receipt.sessions[i].shape, fixture.forms[i][role], 'Fixture must reproduce captured functional shape');
    assert.equal(receipt.sessions.reduce((total, row) => total + row.shape.actions, 0), 31);
    assert.ok(instant(receipt.startedAt) <= instant(receipt.finishedAt) && instant(receipt.finishedAt) <= instant(fixture.recordedAt));
    if (role === 'baseline') await pinBaselineAttributionInputs(receipt);
    captureFinishes.push(instant(receipt.finishedAt)); requiredInputs.push(capture.report, capture.receipt);
  }
  await verify(fixture.attribution);
  const attribution = (await readEvidence(fixture.attribution.path)).value;
  assert.equal(attribution.schema, 'logos-engine.lot6b-owner-cost-structural-attribution.v1');
  assert.equal(attribution.status, 'qualified_functional_structure'); assert.deepEqual(attribution.nativeDigests, declaration.nativeDigests);
  assert.deepEqual(attribution.failures, []);
  validateCommonValueAttribution(attribution, captureReceipts, fixture);
  await verify(attribution.generator);
  assert.ok(Number.isSafeInteger(attribution.checkedCount) && attribution.checkedCount > 0);
  assert.equal(attribution.checkedCount, attribution.checks.length); assert.ok(attribution.checks.every(row => row.passed === true));
  assert.ok(Array.isArray(attribution.nodeAttributions) && attribution.nodeAttributions.length > 0, 'A detailed causal node register is required');
  assert.ok(Array.isArray(attribution.inputs)); assert.equal(new Set(attribution.inputs.map(record => record.path)).size, attribution.inputs.length);
  for (const record of attribution.inputs) await verifyAttributionInput(record);
  for (const required of requiredInputs) {
    assert.ok(attribution.inputs.some(record => record.path === required.path && record.sha256 === required.sha256 && record.bytes === required.bytes),
      'Structural attribution must bind ' + required.path);
  }
  assert.equal(attribution.formsSha256, sha(Buffer.from(JSON.stringify(canonical(fixture.forms)), 'utf8')), 'Attribution binds different functional forms');
  assert.ok(captureFinishes.every(value => value <= instant(attribution.recordedAt)) && instant(attribution.recordedAt) <= instant(fixture.recordedAt)
    && instant(fixture.recordedAt) <= instant(contract.declaredAt), 'Capture, causal qualification and fixture must precede the contract');
  return fixture;
}
/** Exact arithmetic of compare-native-loop-costs.mjs, checked against both receipts. */
export function distribution(values) {
  assert.ok(values.every(value => Number.isFinite(value) && value >= 0), 'Timings must be finite and nonnegative');
  const sorted = values.toSorted((a, b) => a - b), n = sorted.length;
  return { count: n, medianMs: !n ? null : n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2,
    p95Ms: n >= 20 ? sorted[Math.ceil(n * 0.95) - 1] : null, minMs: sorted[0] ?? null, maxMs: sorted.at(-1) ?? null };
}

export function valuesFor(trial, stage) {
  if (stage === 'session_elapsed') return [trial.replayElapsedMs];
  if (stage === 'known_prefix_service' || stage === 'known_prefix_request') return trial.requests
    .filter(row => row.type === 'advance' && row.kind === 'action')
    .map(row => stage === 'known_prefix_service' ? row.nativeServiceMs : row.wallMs);
  return trial.samples.filter(row => row.stage === stage).map(row => row.elapsedMs);
}

export function metricFor(trials, stage) {
  const values = trials.flatMap(row => valuesFor(row, stage));
  const medians = trials.map(row => distribution(valuesFor(row, stage)).medianMs).filter(Number.isFinite);
  const noise = distribution(medians);
  return { distribution: distribution(values),
    noise: noise.medianMs ? (noise.maxMs - noise.minMs) / noise.medianMs : null };
}

export function comparisonMetrics(leftTrials, rightTrials, stages, budget, unaffected) {
  return stages.map(stage => {
    const lm = metricFor(leftTrials, stage), rm = metricFor(rightTrials, stage);
    const left = lm.distribution, right = rm.distribution;
    assert.ok(left.count > 0 && right.count > 0, `Missing measured stage ${stage}`);
    assert.equal(left.count, right.count, `Measured sample count changed for ${stage}`);
    assert.ok(left.medianMs > 0, `Cannot define a finite relative budget for zero baseline median ${stage}`);
    const increase = right.medianMs / left.medianMs - 1;
    const noise = { baselineRelativeRange: lm.noise, afterRelativeRange: rm.noise };
    return { stage, before: left, after: right, medianRelativeIncrease: increase,
      roundMedianNoise: noise, budgetApplies: unaffected,
      result: !unaffected ? 'changed_path_diagnostic' : increase <= budget ? 'within_observed_budget' :
        Math.max(noise.baselineRelativeRange ?? 0, noise.afterRelativeRange ?? 0) > budget ? 'over_budget_with_noise_unresolved' : 'over_budget' };
  });
}

/** Compare physical work and phase placement, not scheduling or allocation noise. */
export function workSignature(trial) {
  return { case: trial.case, warmup: trial.warmup, actions: trial.actions,
    levelsCompleted: trial.levelsCompleted, cycles: trial.cycles,
    samples: trial.samples.map(row => omit(row, ['elapsedMs'])),
    requests: trial.requests.map(row => omit(row, ['wallMs', 'nativeServiceMs', 'transportAndSchedulingMs'])),
    observations: trial.observations,
    pauses: trial.pauses.map(row => omit(row, ['requestedAt', 'acknowledgementMs', 'safeBoundaryMs'])),
    inspection: trial.inspection.map(row => omit(row, ['nativeServiceMs', 'endToEndMs'])),
    memorySamples: trial.memory.map(row => omit(row, ['heapUsed', 'rss'])),
    final: omit(trial.final, ['implementation']) };
}

function validateTrial(trial) {
  assert.equal(trial.final.actions, trial.actions);
  assert.equal(trial.final.acquiredTransitions, trial.actions);
  assert.equal(trial.final.levelsCompleted, trial.levelsCompleted);
  assert.equal(trial.requests.filter(row => row.type === 'init').length, 1);
  assert.equal(trial.requests.filter(row => row.type === 'advance').length, trial.actions);
  assert.ok(trial.pauses.every(row => row.acknowledgedPaused === true));
  assert.ok(trial.samples.every(row => Number.isFinite(row.elapsedMs) && row.elapsedMs >= 0));
  assert.ok(trial.requests.every(row => ['wallMs', 'nativeServiceMs', 'transportAndSchedulingMs'].every(key => Number.isFinite(row[key]) && row[key] >= 0)));
  assert.ok(trial.inspection.every(row => ['nativeServiceMs', 'endToEndMs'].every(key => Number.isFinite(row[key]) && row[key] >= 0)));
  if (trial.warmup) { assert.deepEqual(trial.pauses, []); assert.deepEqual(trial.inspection, []); }
  else {
    assert.deepEqual(trial.pauses.map(row => row.phase), ['initial_planning', 'engaged_action']);
    assert.equal(trial.inspection.length, 3);
    assert.equal(trial.pauses.find(row => row.phase === 'initial_planning').actionsAtSafeBoundary, 0);
    assert.equal(trial.pauses.find(row => row.phase === 'engaged_action').actionsAtSafeBoundary, 1);
  }
}

async function validateReport(file) {
  const report = file.value;
  assert.equal(report.schema, 'logos-engine.native-loop-costs.v1');
  assert.equal(report.status, 'passed', 'An incomplete harness run cannot be silently treated as a full cohort');
  assert.equal(report.nativeSourceUnchanged, true);
  assert.ok(Number.isInteger(report.manifest.rounds) && report.manifest.rounds > 0);
  assert.equal(Object.keys(report.nativeSource.files).length, report.nativeSource.fileCount);
  assert.equal(sha(Buffer.from(JSON.stringify(report.nativeSource.files))), report.nativeSource.digest);
  assert.deepEqual(await fingerprint(report.generator.path), report.generator, 'Measured timing harness bytes changed');
  assert.ok(report.inputs.length > 0);
  for (const input of report.inputs) assert.deepEqual(await fingerprint(input.path), input, 'Retained input fingerprint changed');
  // The unchanged measurement harness records its CASES declaration first.
  const declared = await readEvidence(report.inputs[0].path);
  assert.deepEqual(declared.value, report.manifest, 'Cases-file bytes and embedded declaration must agree');
  assert.deepEqual(report.cases.map(row => row.id), report.manifest.cases.map(row => row.id));
  for (const item of report.cases) {
    const measured = item.trials.filter(row => !row.warmup), warmups = item.trials.filter(row => row.warmup);
    assert.equal(measured.length, report.manifest.rounds);
    assert.equal(warmups.length, 1, 'Preserve the single declared warmup of each original harness case');
    assert.deepEqual(measured.map(row => row.round), Array.from({ length: report.manifest.rounds }, (_, index) => index + 1));
    for (const trial of item.trials) validateTrial(trial);
    assert.deepEqual(omit(item.sessionElapsed, ['tailQualification']), distribution(measured.map(row => row.replayElapsedMs)));
  }
}


async function main() {
  const [contractArg, outputArg, ...extra] = process.argv.slice(2);
  assert.ok(contractArg && outputArg && !extra.length, 'Usage: consolidate-owner-costs.mjs CONTRACT OUTPUT');
  const output = inside(outputArg), contractFile = await readEvidence(contractArg), contract = contractFile.value;
  assert.ok(contractFile.fingerprint.path.startsWith(EVIDENCE));
  try { await access(output); throw new Error('Output already exists'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  assert.equal(contract.schema, 'logos-engine.lot6b-owner-cost-contract.v2'); assert.equal(contract.lot, '6B');
  assert.deepEqual(contract.structuralExpectation, EXPECTATION);
  const perf = relative(ROOT, inside(contract.performanceDirectory));
  // The chosen directory is bound by the declaration/contract and exclusive
  // outputs below. The old 7A isolated-window name is not a 6B restriction.
  assert.ok(perf.startsWith(EVIDENCE), 'A declared lot 6B window directory is required');
  assert.equal(dirname(output), inside(perf), 'Write the qualified aggregate beside its own window');
  const names = suffix => perf + '/' + suffix;
  assert.equal(contract.declaration.path, names('declaration.json'));
  await verify(contract.declaration);
  const declaration = (await readEvidence(contract.declaration.path)).value;
  assert.equal(declaration.schema, 'logos-engine.native-cost-protocol-declaration.v2');
  assert.equal(declaration.status, 'declared_before_official_window');
  assert.equal(declaration.baseline.nativeVersion, '0.63.0');
  assert.equal(declaration.candidate.nativeVersion, '0.64.0');
  assert.equal(declaration.noOfficialWindowAtDeclaration, true);
  assert.deepEqual(declaration.ownerCostQualification, {
    schema: 'logos-engine.lot6b-owner-cost-qualification.v1', contractPath: contractFile.fingerprint.path, tools: contract.tools,
  });
  assert.deepEqual(Object.keys(contract.tools).sort(), ['consolidator', 'reviewer']);
  assert.equal(contract.tools.consolidator.path, SELF); assert.equal(contract.tools.reviewer.path, REVIEWER);
  for (const record of Object.values(contract.tools)) await verify(record);
  const history = (await readEvidence('docs/migration/lot3h-evidence/performance/declaration.json')).value;
  const historical = [...declaration.officialTools, declaration.globalDecisionTool, declaration.globalCalculationTool];
  assert.deepEqual(historical, [...history.officialTools, history.globalDecisionTool, history.globalCalculationTool]);
  assert.equal(historical.length, 7);
  for (const record of historical) await verify(record);
  for (const key of ['protocol', 'cases', 'diagnosticComparisonPolicy', 'globalBudgetPolicy', 'baselineManifest', 'candidateManifest', 'candidateArchiveManifest']) await verify(declaration[key]);
  const protocolText = await readFile(inside(declaration.protocol.path), 'utf8');
  for (const marker of [contractFile.fingerprint.path, ...Object.values(contract.tools).map(record => record.sha256)]) {
    assert.ok(protocolText.includes(marker), 'Watched protocol omits owner-cost announcement: ' + marker);
  }
  const baseline = (await readEvidence(declaration.baselineManifest.path)).value;
  const candidate = (await readEvidence(declaration.candidateManifest.path)).value;
  const archive = (await readEvidence(declaration.candidateArchiveManifest.path)).value;
  const policyFile = await readEvidence(declaration.diagnosticComparisonPolicy.path), policy = policyFile.value;
  const cases = (await readEvidence(declaration.cases.path)).value;
  const globalPolicy = (await readEvidence(declaration.globalBudgetPolicy.path)).value;
  assert.equal(policyFile.fingerprint.path, names('comparison-policy.json'));
  assert.equal(policy.schema, 'logos-engine.native-loop-cost-comparison-policy.v1');
  assert.equal(policy.relativeBudget, 0.1); assert.deepEqual(policy.unaffectedCaseIds, ['STCK', 'SMLP']); assert.deepEqual(policy.stages, STAGES);
  assert.equal(cases.rounds, 4); assert.deepEqual(cases.cases.map(row => [row.id, row.actions, row.warmupActions]), [['STCK', 10, 3], ['SMLP', 15, 3]]);
  assert.equal(globalPolicy.schema, 'logos-engine.native-global-cost-policy.v1');
  const exactPolicy = { globalStage: 'session_elapsed', relativeIncreaseLimit: 0.1, comparison: 'strictly_less_than',
    allCasesMustPass: true, crossCaseCompensation: false, phaseOverrunsMayBeAccepted: true, phasesAndP95RemainVisible: true,
    excludedMeasuredSessions: 0, excludedOutliers: 0, plannedOrder: ORDER, cohorts: 2,
    sessionsPerCaseVersionCohort: 4, measuredSessions: 32, measuredActions: 400, excludedWarmupSessions: 8, excludedWarmupActions: 24 };
  for (const [key, value] of Object.entries(exactPolicy)) assert.deepEqual(globalPolicy[key], value, 'Global rule differs: ' + key);
  assert.equal(globalPolicy.authorization.verbatim, "si le global reste en dessous de 10% d'augmentation alors une phase qui dépasse 10% peut être accepté.");
  assert.deepEqual(globalPolicy.caseIds, ['STCK', 'SMLP']);
  assert.equal(globalPolicy.diagnosticPhasePolicy, declaration.diagnosticComparisonPolicy.path);
  for (const key of ['plannedOrder', 'cohorts', 'sessionsPerCaseVersionCohort', 'measuredSessions', 'measuredActions', 'excludedWarmupSessions', 'excludedWarmupActions', 'allCasesMustPass', 'crossCaseCompensation']) assert.deepEqual(declaration[key], exactPolicy[key]);
  assert.equal(declaration.relativeGlobalBudget, 0.1); assert.equal(declaration.globalComparison, 'strictly_less_than');
  assert.equal(declaration.phaseOverrunsBlockAcceptance, false); assert.equal(declaration.diagnosticMetrics, 16); assert.equal(declaration.globalBudgetCases, 2);
  for (const [role, manifest] of [['baseline', baseline], ['candidate', candidate]]) {
    assert.equal(manifest.fileCount, Object.keys(manifest.files).length); assert.equal(manifest.digest, sourceDigest(manifest.files));
    assert.deepEqual(declaration[role], globalPolicy[role]);
    assert.equal(declaration.nativeDigests[role], manifest.digest); assert.equal(declaration[role].nativeDigest, manifest.digest);
    assert.equal(declaration[role].nativeFiles, manifest.fileCount);
  }
  assert.notEqual(baseline.digest, candidate.digest);
  assert.equal(archive.nativeSourceManifestDigest, candidate.digest); assert.equal(archive.baseCommit, declaration.candidate.sourceBaseCommit);
  for (const [path, digest] of Object.entries(candidate.files)) assert.equal(archive.files[path], digest);
  sameMembers(contract.sourceEvidence.map(record => record.path), SOURCE_PATHS, 'Source expectation evidence');
  for (const record of contract.sourceEvidence) { await verify(record); assert.equal(record.sha256, candidate.files[record.path]); }
  await verify(contract.ownerInventory);
  const inventory = (await readEvidence(contract.ownerInventory.path)).value;
  assert.equal(inventory.schema, 'logos-engine.lot6b-owner-cost-source-inventory.v1');
  assert.equal(inventory.programScope, 'family-installed programs'); assert.deepEqual(inventory.nativeDigests, declaration.nativeDigests);
  assert.ok(instant(inventory.recordedAt) <= instant(contract.declaredAt));
  for (const [key, addition] of [['owners', EXPECTATION.ownerId], ['programs', EXPECTATION.programId]]) {
    const before = inventory[key].baseline, after = inventory[key].candidate;
    assert.ok(Array.isArray(before) && before.length && before.every(item => typeof item === 'string' && item));
    assert.ok(Array.isArray(after) && after.every(item => typeof item === 'string' && item));
    assert.equal(new Set(before).size, before.length); assert.equal(new Set(after).size, after.length);
    if (addition !== null) assert.ok(!before.includes(addition));
    sameMembers(after, addition === null ? before : [...before, addition], 'Only the declared ' + key + ' addition is allowed');
  }
  const structuralFixture = await loadStructuralFixture(contract, declaration, { baseline, candidate });
  const staticFile = await readEvidence(names('static-preflight.json')), staticReceipt = staticFile.value;
  assert.equal(staticReceipt.status, 'static_inputs_checked');
  assert.ok(staticReceipt.checks.length > 0 && staticReceipt.checks.every(row => row.satisfied === true));
  assert.equal(staticReceipt.checkedCount, staticReceipt.checks.length);
  assert.deepEqual(staticReceipt.declaration, contract.declaration);
  assert.deepEqual(staticReceipt.ownerCostContract, contractFile.fingerprint); assert.deepEqual(staticReceipt.ownerCostTools, contract.tools);
  const readinessFile = await readEvidence(names('readiness.json')), readiness = readinessFile.value;
  assert.equal(readiness.measurementAuthorized, true); assert.deepEqual(readiness.pendingRequirements, []);
  assert.equal(readiness.nativeSourceDigest, candidate.digest);
  for (const record of readiness.inputs) await verify(record);
  for (const record of [contractFile.fingerprint, staticFile.fingerprint, contract.declaration, ...Object.values(contract.tools)]) {
    assert.ok(readiness.inputs.some(input => input.path === record.path && input.sha256 === record.sha256 && input.bytes === record.bytes), 'Readiness must bind ' + record.path);
  }
  const windowFile = await readEvidence(names('window.json')), window = windowFile.value;
  assert.equal(window.schema, 'logos-engine.native-cost-window.v1'); assert.equal(window.status, 'passed'); assert.equal(window.finalIntegrity, 'passed');
  assert.deepEqual(window.plannedOrder, ORDER); assert.deepEqual(window.executions.map(row => row.label), ORDER);
  assert.deepEqual(window.nativeDigests, { baseline: baseline.digest, correction: candidate.digest });
  assert.equal(resolve(window.correctionCheckout), ROOT); assert.notEqual(resolve(window.baselineCheckout), ROOT);
  assert.equal(await realpath(window.baselineCheckout), baselineAttributionAccess.root,
    'Measured baseline checkout differs from the predeclared functional capture');
  assert.ok(instant(window.startedAt) < instant(window.finishedAt));
  assert.ok(instant(globalPolicy.declaredAt) <= instant(declaration.recordedAt) && instant(declaration.recordedAt) <= instant(declaration.finalizedAt));
  assert.ok(instant(declaration.finalizedAt) <= instant(contract.declaredAt) && instant(contract.declaredAt) <= instant(staticReceipt.recordedAt)
    && instant(staticReceipt.recordedAt) <= instant(readiness.finalizedAt) && instant(readiness.finalizedAt) < instant(window.startedAt), 'Contract/static/readiness must precede window');
  const runner = historical.find(record => record.path === 'scripts/measure-native-loop-costs.mjs');
  assert.equal(window.runnerSha256, runner.sha256);
  const watched = window.inputs.filter(record => resolve(record.path) === inside(declaration.protocol.path));
  assert.equal(watched.length, 1); assert.equal(watched[0].sha256, declaration.protocol.sha256);
  assert.equal(new Set(window.inputs.map(record => resolve(record.path))).size, window.inputs.length);
  for (const record of window.inputs) {
    assert.deepEqual(Object.keys(record).sort(), ['path', 'sha256']); assert.ok(record.path.startsWith('/'));
    const absolute = resolve(record.path), bytes = await readFile(absolute); assert.equal(sha(bytes), record.sha256, 'Watched window input changed');
    retainFingerprint(absolute, record);
  }
  const cohorts = [];
  for (const index of [1, 2]) cohorts.push({ id: 'cohort_' + index,
    baseline: await readEvidence(names('cohort' + index + '/baseline.json')),
    after: await readEvidence(names('cohort' + index + '/after.json')),
    comparison: await readEvidence(names('cohort' + index + '/comparison.json')) });
  assert.equal(new Set(cohorts.flatMap(c => [c.baseline.fingerprint.sha256, c.after.fingerprint.sha256])).size, 4);
  assert.notEqual(cohorts[0].comparison.fingerprint.sha256, cohorts[1].comparison.fingerprint.sha256);
  const reference = cohorts[0].baseline.value;
  let previousEnd = instant(window.startedAt);
  for (const execution of window.executions) {
    const index = Number(execution.label[1]) - 1, side = execution.label[0] === 'A' ? 'baseline' : 'after';
    const file = cohorts[index][side], report = file.value, manifest = side === 'baseline' ? baseline : candidate;
    assert.equal(execution.status, 'passed'); assert.equal(execution.exitCode, 0);
    assert.deepEqual(execution.command, ['node', runner.path, declaration.cases.path, file.fingerprint.path]);
    assert.equal(resolve(execution.checkout), side === 'baseline' ? resolve(window.baselineCheckout) : ROOT);
    assert.ok(previousEnd <= instant(execution.startedAt) && instant(execution.startedAt) <= instant(execution.finishedAt)
      && instant(execution.finishedAt) <= instant(window.finishedAt)); previousEnd = instant(execution.finishedAt);
    assert.equal(execution.reportSha256, file.fingerprint.sha256); assert.equal(execution.nativeDigest, manifest.digest);
    if (side === 'baseline') assert.equal(execution.copiedReportSha256, file.fingerprint.sha256);
    const logBytes = await readFile(resolve(execution.log)); assert.equal(sha(logBytes), execution.logSha256);
    retainFingerprint(resolve(execution.log), { sha256: execution.logSha256 });
    await validateReport(file);
    assert.deepEqual(report.nativeSource, manifest); assert.deepEqual(report.generator, runner);
    assert.deepEqual(report.manifest, cases); assert.deepEqual(report.inputs, reference.inputs); assert.deepEqual(report.environment, reference.environment);
    assert.deepEqual(report.inputs[0], declaration.cases);
    assert.equal(new Set(report.inputs.map(record => record.path)).size, report.inputs.length);
    let previousTrialEnd = instant(execution.startedAt);
    for (const item of report.cases) {
      assert.deepEqual(item.trials.map(row => [row.round, row.warmup]), [[0, true], [1, false], [2, false], [3, false], [4, false]]);
      for (const trial of item.trials) {
        const caseRule = cases.cases.find(row => row.id === item.id);
        assert.equal(trial.case, item.id); assert.equal(trial.actions, trial.warmup ? caseRule.warmupActions : caseRule.actions);
        assert.ok(Number.isFinite(trial.replayElapsedMs) && trial.replayElapsedMs > 0);
        assert.ok(previousTrialEnd <= instant(trial.startedAt) && instant(trial.startedAt) <= instant(trial.finishedAt)
          && instant(trial.finishedAt) <= instant(execution.finishedAt)); previousTrialEnd = instant(trial.finishedAt);
        const version = side === 'baseline' ? declaration.baseline.nativeVersion : declaration.candidate.nativeVersion;
        assert.equal(trial.final.implementation, 'logos-engine.typescript.v6.native-migration/' + version);
      }
    }
  }
  const strictPath = relative(ROOT, inside(contract.strictFailureReceipt));
  const logPath = relative(ROOT, inside(contract.strictFailureLog));
  assert.equal(dirname(inside(strictPath)), inside(perf)); assert.equal(dirname(inside(logPath)), inside(perf));
  assert.equal(contract.historicalAggregateOutput, names('combined-comparison.json'));
  assert.notEqual(output, inside(contract.historicalAggregateOutput));
  const strictFile = await readEvidence(strictPath), strict = strictFile.value;
  const command = ['node', HISTORICAL, policyFile.fingerprint.path,
    ...cohorts.flatMap(c => [c.baseline.fingerprint.path, c.after.fingerprint.path, c.comparison.fingerprint.path]), contract.historicalAggregateOutput];
  assert.equal(strict.schema, 'logos-engine.retained-tool-failure.v1'); assert.deepEqual(strict.command, command);
  assert.ok(Number.isSafeInteger(strict.exitCode) && strict.exitCode !== 0);
  assert.equal(strict.inputsUnchanged, true); assert.equal(strict.outputExists, false);
  assert.ok(instant(window.finishedAt) <= instant(strict.startedAt) && instant(strict.startedAt) <= instant(strict.finishedAt));
  const strictTool = historical.find(record => record.path === HISTORICAL);
  const strictInputs = [strictTool, policyFile.fingerprint, ...cohorts.flatMap(c => [c.baseline.fingerprint, c.after.fingerprint, c.comparison.fingerprint])];
  assert.deepEqual(strict.inputs, strictInputs);
  for (const record of strict.inputs) await verify(record);
  assert.equal(strict.log.path, logPath); await verify(strict.log);
  assert.ok((await readFile(inside(logPath), 'utf8')).includes('Within-cohort work metadata changed'), 'Retained failure is not the declared strict metadata rejection');
  try { await access(inside(contract.historicalAggregateOutput)); throw new Error('A historical aggregate exists despite recorded refusal'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const structuralDifferences = [], cohortComparisons = [];
  for (const cohort of cohorts) {
    const before = cohort.baseline.value, after = cohort.after.value, official = cohort.comparison.value;
    assert.equal(official.schema, 'logos-engine.native-loop-cost-comparison.v1');
    assert.ok(['passed', 'budget_review_required'].includes(official.status));
    assert.deepEqual(official.inputs, { policy: policyFile.fingerprint, baseline: cohort.baseline.fingerprint, after: cohort.after.fingerprint });
    const pairTool = historical.find(record => record.path === PAIR);
    assert.equal(official.generator.path, PAIR); assert.equal(official.generator.sha256, pairTool.sha256);
    if (Object.hasOwn(official.generator, 'bytes')) assert.equal(official.generator.bytes, pairTool.bytes);
    assert.equal(official.relativeBudget, 0.1); assert.equal(official.harnessInputsMatched, true); assert.equal(official.environmentMatched, true); assert.equal(official.replayWorkMatched, true);
    assert.deepEqual(official.before, { headCommit: before.gitHead, nativeDigest: baseline.digest });
    assert.deepEqual(official.after, { headCommit: after.gitHead, nativeDigest: candidate.digest });
    const reproduced = [];
    for (let i = 0; i < before.cases.length; i++) {
      const a = before.cases[i], b = after.cases[i];
      for (let j = 0; j < a.trials.length; j++) structuralDifferences.push(...compareOwnerWork(a.trials[j], b.trials[j], {
        cohort: cohort.id, case: a.id, round: a.trials[j].round, warmup: a.trials[j].warmup },
        structuralFixture.forms.find(row => row.case === a.id && row.form === (a.trials[j].warmup ? 'warmup' : 'measured'))));
      const metrics = comparisonMetrics(a.trials.filter(t => !t.warmup), b.trials.filter(t => !t.warmup), STAGES, 0.1, true);
      const row = official.comparisons[i]; assert.equal(row.case, a.id); assert.equal(row.measuredSessions, 4);
      assert.equal(row.actionsPerSession, a.trials[1].actions); assert.equal(row.levelsCompleted, a.trials[1].levelsCompleted); assert.equal(row.unaffected, true);
      assert.deepEqual(row.metrics, metrics);
      assert.deepEqual(row.sessionElapsed, { before: a.sessionElapsed, after: b.sessionElapsed, medianRelativeIncrease: b.sessionElapsed.medianMs / a.sessionElapsed.medianMs - 1 });
      assert.deepEqual(row.inspection, { before: a.inspection, after: b.inspection }); assert.deepEqual(row.pause, { before: a.pause, after: b.pause });
      reproduced.push({ case: a.id, metrics });
    }
    assert.equal(official.comparisons.length, 2);
    const unresolved = unresolvedFor(reproduced), status = unresolved.length ? 'budget_review_required' : 'passed';
    assert.deepEqual(official.unresolved, unresolved); assert.equal(official.status, status);
    cohortComparisons.push({ cohort: cohort.id, status, withinObservedBudget: 16 - unresolved.length, budgetMetricCount: 16, comparisons: reproduced, unresolved });
  }
  const comparisons = [], includedMeasuredSessions = [], excludedWarmups = [], globalCases = [], seen = new Set();
  for (const caseRule of cases.cases) {
    const bySide = {};
    for (const side of ['baseline', 'after']) {
      const measured = []; let warmSignature, signature;
      for (const cohort of cohorts) for (const trial of cohort[side].value.cases.find(row => row.id === caseRule.id).trials) {
        const work = workSignature(trial), key = [trial.startedAt, trial.finishedAt].join('|');
        assert.ok(!seen.has(key), 'A physical measurement session must not be included twice'); seen.add(key);
        if (trial.warmup) {
          if (warmSignature) assert.deepEqual(work, warmSignature, 'Warmup work changed within one version'); else warmSignature = work;
          excludedWarmups.push({ cohort: cohort.id, side, case: trial.case, round: trial.round, startedAt: trial.startedAt, finishedAt: trial.finishedAt, actions: trial.actions, cycles: trial.cycles });
        } else {
          if (signature) assert.deepEqual(work, signature, 'Full signature changed within one version'); else signature = work;
          measured.push(trial);
          includedMeasuredSessions.push({ cohort: cohort.id, side, case: trial.case, round: trial.round, startedAt: trial.startedAt,
            finishedAt: trial.finishedAt, actions: trial.actions, levelsCompleted: trial.levelsCompleted, sampleCount: trial.samples.length, requestCount: trial.requests.length });
        }
      }
      assert.equal(measured.length, 8); bySide[side] = measured;
    }
    const metrics = comparisonMetrics(bySide.baseline, bySide.after, STAGES, 0.1, true);
    comparisons.push({ case: caseRule.id, unaffected: true, measuredSessionsPerVersion: 8, actionsPerSession: bySide.baseline[0].actions,
      levelsCompleted: bySide.baseline[0].levelsCompleted, cohortRounds: cohorts.map(c => ({ cohort: c.id, rounds: 4 })), metrics });
    const metric = metrics.find(row => row.stage === 'session_elapsed'), beforeMedianMs = metric.before.medianMs, afterMedianMs = metric.after.medianMs;
    const accepted = strictDecimalBudget(beforeMedianMs, afterMedianMs);
    globalCases.push({ case: caseRule.id, sessionsPerVersion: 8, beforeMedianMs, afterMedianMs,
      medianRelativeIncrease: (afterMedianMs - beforeMedianMs) / beforeMedianMs, accepted, result: accepted ? 'within_user_global_budget' : 'global_budget_exceeded' });
  }
  assert.equal(includedMeasuredSessions.length, 32); assert.equal(includedMeasuredSessions.reduce((n, row) => n + row.actions, 0), 400);
  assert.equal(excludedWarmups.length, 8); assert.equal(excludedWarmups.reduce((n, row) => n + row.actions, 0), 24);
  const unresolved = unresolvedFor(comparisons), globalAccepted = globalCases.every(row => row.accepted);
  const derivedFrom = [await fingerprint(HISTORICAL), await fingerprint(PAIR)];
  const report = {
    schema: 'logos-engine.lot6b-owner-cost-consolidation.v2', status: 'qualified_consolidation_complete', recordedAt: new Date().toISOString(),
    generator: await fingerprint(SELF), derivedFrom, contract: contractFile.fingerprint, declaration: contract.declaration,
    inputs: { policy: policyFile.fingerprint, window: windowFile.fingerprint, readiness: readinessFile.fingerprint,
      staticPreflight: staticFile.fingerprint, sourceInventory: contract.ownerInventory, sourceEvidence: contract.sourceEvidence,
      structuralFixture: contract.structuralFixture, structuralAttribution: structuralFixture.attribution,
      cohorts: cohorts.map(c => ({ id: c.id, baseline: c.baseline.fingerprint, after: c.after.fingerprint, originalComparison: c.comparison.fingerprint })) },
    historicalStrict: { passed: false, status: 'failed_work_metadata', failureReceipt: strictFile.fingerprint, failureLog: strict.log, tool: strictTool },
    sources: { baseline: { digest: baseline.digest, fileCount: baseline.fileCount }, after: { digest: candidate.digest, fileCount: candidate.fileCount } },
    environment: reference.environment, timingHarness: runner,
    method: { selectedCohort: null, excludedMeasuredSessions: 0, excludedOutliers: 0, noiseAllowanceAdded: false,
      excludedWarmupsPerCaseAndVersion: 2, workMetadataExactWithinEachVersion: true, workMetadataExactAcrossVersions: false,
      behaviorMetadataExactAcrossVersions: true, structuralExpectation: contract.structuralExpectation, structuralFixture: contract.structuralFixture,
      structuralDifferencesEnumerated: true,
      originalBudgetMetricsExactlyReproduced: true, p95MinimumSamples: 20, p95Method: 'Empirical nearest rank, withheld below 20 samples.',
      globalComparison: 'strictly_less_than', globalRelativeLimit: 0.1 },
    relativeBudget: 0.1, budgetMetricCount: 16, withinObservedBudget: 16 - unresolved.length,
    phaseStatus: unresolved.length ? 'budget_review_required' : 'passed', comparisons, cohortComparisons, unresolved,
    includedMeasuredSessions, excludedWarmups, structuralDifferences, globalCases, globalAccepted,
    globalStatus: globalAccepted ? 'accepted_under_predeclared_owner_cost_rule' : 'global_budget_review_required',
    measuredSessions: 32, measuredActions: 400, excludedWarmupSessions: 8, excludedWarmupActions: 24,
    qualification: 'Supplemental predeclared owner-cost analysis only. The historical strict comparison remains failed. Every trial matches the exact functional shape captured and causally qualified before the contract and window. Every qualified structural position is retained, including warmups. Matching measured shapes does not prove uncaptured private graph leaves. Raw reports and timings are unchanged. All measured sessions and both cohorts are retained. Phase overruns remain visible. An independent Python review must reproduce these calculations before this supplemental global result is used.',
  };
  assert.ok(instant(strict.finishedAt) <= instant(report.recordedAt));
  for (const [path, digest] of touched) assert.equal((await hashFile(path)).sha256, digest, 'Input changed before output: ' + path);
  assert.ok(!touched.has(output), 'Output must not replace an input');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: report.status, output: relative(ROOT, output), historicalStrictPassed: false,
    structuralDifferences: structuralDifferences.length, globalStatus: report.globalStatus, independentReviewRequired: true }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(); }
  catch (error) {
    console.error(JSON.stringify({ schema: 'logos-engine.lot6b-owner-cost-analysis-failure.v1', status: 'owner_cost_analysis_blocked',
      structuralProof: false, historicalStrictPassed: false, outputWritten: false,
      error: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  }
}
