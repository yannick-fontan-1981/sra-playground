#!/usr/bin/env node
/**
 * Bounded public-observation component diagnostic. Production is not modified.
 * Usage: node scripts/profile-native-observer-costs.mjs OUTPUT.json.gz
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { cpus, platform, release } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { geometricComponents, measureNativeObservation, v6Canonical, v6Digest } from '../src/logos-engine/v6-native-observer.ts';
import { assertPortableNumber } from '../src/logos-engine/canonical.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TRACE = 'docs/migration/native-campaigns-v39/stck-public-trace.json.gz';
const TRACE_SHA = '4610327ca5c6b67e3a42983cc55b40eab3d5aa858a185d8e81f753ba2bcb7e6b';
const PROTOCOL = 'docs/migration/lot2c-cost-evidence/diagnostic/observer-protocol.md';
const INPUTS = ['src/logos-engine/v6-native-observer.ts', 'src/logos-engine/canonical.ts',
  'src/logos-engine/bounded-weak-cache.ts', 'tests/fixtures/v6-observer-reference.json', TRACE, PROTOCOL];
const hash = value => createHash('sha256').update(value).digest('hex');
const scope = 'observer-cost-diagnostic';
const WARMUP = 3, ROUNDS = 20;
const [outputArg] = process.argv.slice(2);
assert.equal(process.argv.length, 3, 'Usage: profile-native-observer-costs.mjs OUTPUT.json.gz');
const output = resolve(ROOT, outputArg);
assert.ok(relative(ROOT, output) && !relative(ROOT, output).startsWith('..') && output.endsWith('.json.gz'));
try { await access(output); throw new Error('Refusing to overwrite an observer diagnostic'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
async function fingerprint(name) {
  const path = resolve(ROOT, name), bytes = await readFile(path);
  return { path: relative(ROOT, path), bytes: bytes.length, sha256: hash(bytes) };
}
const inputsBefore = await Promise.all(INPUTS.map(fingerprint));
const generator = await fingerprint(fileURLToPath(import.meta.url));
const source = await readFile(resolve(ROOT, INPUTS[0]), 'utf8');
assert.ok(source.includes('parts.map(part => v6Digest({ palette_value: part.color, area: part.area,'),
  'This diagnostic targets the unchanged generic production signature path');
const originalObserver = execFileSync('git', ['show', '1193377f1d574451740a7409a4102833ef868310:src/logos-engine/v6-native-observer.ts'], { cwd: ROOT });
assert.equal(hash(originalObserver), inputsBefore[0].sha256, 'Observer must still be the published V63 source');
const traceBytes = await readFile(resolve(ROOT, TRACE)); assert.equal(hash(traceBytes), TRACE_SHA);
const trace = JSON.parse(gunzipSync(traceBytes)); assert.equal(trace.status, 'passed');
const selected = [5, 6, 7, 8].map(action => {
  const record = trace.packets.find(row => row.packet.step_index === action);
  assert.ok(record, `Missing actual public outcome ${action}`);
  return { action, packet: record.packet };
});

// This is a diagnostic candidate, limited to components just constructed by
// geometricComponents. validateRows bounds their area/color/scale/coordinates.
// Constant ASCII keys are inserted in Python/portable canonical sort order.
function signatureInput(part) {
  return { palette_value: part.color, area: part.area, scale: part.scale, normalized_mask: part.normalized };
}
function closedSignatureText(part) {
  // validateRows admits -0, but the prior public canonical digest rejects it.
  // Keep that scalar boundary even for a freshly measured palette value.
  assertPortableNumber(part.color);
  return JSON.stringify({ area: part.area, normalized_mask: part.normalized, palette_value: part.color, scale: part.scale });
}
async function closedSignature(part) {
  const bytes = new TextEncoder().encode(closedSignatureText(part));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes)))].map(value => value.toString(16).padStart(2, '0')).join('');
}
// Mechanical copy of the measured-observation assembly, with only the private
// signature encoding replaced. Equality is checked against production output.
async function candidateObservation(publicPacket, revision, scope) {
  if (!Number.isSafeInteger(revision) || revision < 0) throw new TypeError('Observation revision must be an integer');
  const parts = geometricComponents(publicPacket.frame_rows);
  const signatures = await Promise.all(parts.map(closedSignature));
  const counts = new Map(), ordinal = new Map();
  for (const signature of signatures) counts.set(signature, (counts.get(signature) ?? 0) + 1);
  const entities = parts.map((part, index) => {
    const signature = signatures[index], occurrence = ordinal.get(signature) ?? 0;
    ordinal.set(signature, occurrence + 1);
    return { id: `component:${signature.slice(0, 16)}:${occurrence}`, signature,
      position: [part.bbox[0], part.bbox[1]], bbox: part.bbox, area: part.area, scale: part.scale,
      mask: part.mask, palette_value: part.color, rectangular: part.rectangular,
      identity_ambiguous: counts.get(signature) > 1, identity_scope: 'monochrome_component_not_physical_object' };
  });
  return { revision, level_epoch: publicPacket.level, frame_hash: publicPacket.frame_hash,
    observation_ref: `${scope}:epoch:${publicPacket.level}:revision:${revision}:frame:${publicPacket.frame_hash}`,
    coordinate_basis: 'screen', entities, available_action_refs: [...publicPacket.available_action_refs],
    state: publicPacket.state, levels_completed: publicPacket.levels_completed,
    unknowns: ['physical_object_roles', 'terminal_objective', 'input_semantics', 'logical_lattice'],
    provenance: 'public_frame_connected_components_only' };
}
function summary(values) {
  const sorted = values.toSorted((a, b) => a - b), n = sorted.length;
  return { count: n, medianMs: n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2,
    minMs: sorted[0], maxMs: sorted.at(-1),
    qualification: 'Warm paired component samples; no confidence interval, full-service budget, or general host-speed claim.' };
}
const exactChecks = [];
async function verifyPacket(id, packet, expected) {
  const parts = geometricComponents(packet.frame_rows);
  for (const part of parts) {
    assert.equal(closedSignatureText(part), v6Canonical(signatureInput(part)));
    assert.equal(await closedSignature(part), await v6Digest(signatureInput(part)));
  }
  const original = await measureNativeObservation(packet, 1, scope), candidate = await candidateObservation(packet, 1, scope);
  assert.deepEqual(candidate, original);
  if (expected) assert.deepEqual(original, { ...expected, observation_ref: `${scope}:epoch:${packet.level}:revision:1:frame:${packet.frame_hash}` });
  exactChecks.push({ id, components: parts.length, normalizedPixels: parts.reduce((n, p) => n + p.normalized.length, 0),
    maximumNormalizedMask: Math.max(...parts.map(p => p.normalized.length)),
    canonicalBytesEqual: true, signaturesEqual: true, observationsEqual: true, sourceFixtureEqual: Boolean(expected),
    observationSha256: hash(JSON.stringify(original)) });
}
for (const item of selected) await verifyPacket(`STCK-after-action-${item.action}`, item.packet);
const reference = JSON.parse(await readFile(resolve(ROOT, INPUTS[3])));
for (const item of reference.cases) await verifyPacket(`source-fixture:${item.id}`, item.public, item.observation);
const rejectionChecks = [];
for (const [id, rows] of [['palette-negative-zero', [[-0]]], ['palette-256', [[256]]], ['palette-nan', [[NaN]]], ['ragged-raster', [[0, 1], [2]]]]) {
  const packet = { ...selected[0].packet, frame_rows: rows };
  const reasons = [];
  for (const measure of [measureNativeObservation, candidateObservation]) {
    await assert.rejects(measure(packet, 1, scope), error => {
      assert.ok(error instanceof TypeError); reasons.push(error.message); return true;
    });
  }
  assert.equal(reasons[0], reasons[1]); rejectionChecks.push({ id, sameTypeAndMessage: true, message: reasons[0] });
}

const startedAt = new Date().toISOString(), started = performance.now();
const timings = [], cases = [];
for (const { action, packet } of selected) {
  const parts = geometricComponents(packet.frame_rows);
  const methods = {
    geometry: () => geometricComponents(packet.frame_rows),
    generic_text: () => parts.map(part => v6Canonical(signatureInput(part))),
    closed_text: () => parts.map(closedSignatureText),
    generic_signatures: () => Promise.all(parts.map(part => v6Digest(signatureInput(part)))),
    closed_signatures: () => Promise.all(parts.map(closedSignature)),
    production_observation: () => measureNativeObservation(packet, action + 1, scope),
    candidate_observation: () => candidateObservation(packet, action + 1, scope),
  };
  const names = Object.keys(methods);
  for (let round = 0; round < WARMUP; round++) for (const name of names) await methods[name]();
  for (let round = 0; round < ROUNDS; round++) {
    const results = {};
    for (const name of round % 2 ? names.toReversed() : names) {
      const start = performance.now(); results[name] = await methods[name]();
      timings.push({ action, round, method: name, elapsedMs: performance.now() - start });
    }
    // Correctness assertions sit outside the measured method intervals.
    assert.deepEqual(results.closed_text, results.generic_text);
    assert.deepEqual(results.closed_signatures, results.generic_signatures);
    assert.deepEqual(results.candidate_observation, results.production_observation);
  }
  const byMethod = Object.fromEntries(names.map(name => [name, summary(timings.filter(row => row.action === action && row.method === name).map(row => row.elapsedMs))]));
  cases.push({ action, frameHash: packet.frame_hash, components: parts.length, byMethod,
    fullObservationMedianRelativeChange: byMethod.candidate_observation.medianMs / byMethod.production_observation.medianMs - 1 });
}
const elapsedMs = performance.now() - started, finishedAt = new Date().toISOString();
const inputsAfter = await Promise.all(INPUTS.map(fingerprint)); assert.deepEqual(inputsAfter, inputsBefore);
assert.deepEqual(await fingerprint(fileURLToPath(import.meta.url)), generator);
const report = { schema: 'logos-engine.native-observer-cost-diagnostic.v1', status: 'passed', startedAt, finishedAt, elapsedMs,
  generator, inputs: inputsBefore, inputsUnchanged: true,
  environment: { node: process.version, platform: platform(), release: release(), cpu: cpus()[0]?.model, cpuCount: cpus().length },
  configuration: { publicActions: [5, 6, 7, 8], warmupRoundsPerMethod: WARMUP, measuredRoundsPerMethod: ROUNDS, alternatingMethodOrder: true },
  exactChecks, rejectionChecks, cases, timings,
  qualification: 'One predeclared component diagnostic on actual public STCK packets, plus unchanged source-observer fixtures. The candidate is local to this script and does not modify production or v6Digest. It removes generic canonicalization only for private integer component descriptions. It is a structural optimization hypothesis, not proof of the cause of the historical V62/V63 performance difference. No game, policy, action selection, acquisition, persistence, transport or browser is timed.' };
await mkdir(dirname(output), { recursive: true });
const bytes = gzipSync(Buffer.from(JSON.stringify(report, null, 2) + '\n'), { level: 9 });
await writeFile(output, bytes, { flag: 'wx' });
assert.deepEqual(JSON.parse(gunzipSync(await readFile(output))), report);
console.log(JSON.stringify({ status: report.status, output: await fingerprint(output), elapsedMs,
  exactPackets: exactChecks.length, measuredCalls: timings.length,
  cases: cases.map(row => ({ action: row.action, components: row.components,
    originalMs: row.byMethod.production_observation.medianMs, candidateMs: row.byMethod.candidate_observation.medianMs,
    relativeChange: row.fullObservationMedianRelativeChange })) }));
