#!/usr/bin/env node
/**
 * One cold, public-return diagnostic of the actual native service.
 * Usage: node scripts/profile-native-loop-costs.mjs CASES.json CASE OUTPUT.json.gz EXPECTED_NATIVE_DIGEST
 * Separate from the unchanged official cost runner/comparator. No budget claim.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { cpus, platform, release } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = value => createHash('sha256').update(value).digest('hex');
const SOURCE = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6';
const DECLARATIONS = [`${SOURCE}/laya_proto/common_frontier_policy.drm.json`, `${SOURCE}/morphology_policy/strategy.drm`];
const PROTOCOL = 'docs/migration/lot2c-cost-evidence/diagnostic/README.md';
const clean = value => JSON.parse(JSON.stringify(value));
const confined = value => {
  const path = resolve(ROOT, value), name = relative(ROOT, path);
  assert.ok(name && !name.startsWith('..'), 'Diagnostic inputs/output must be within this checkout');
  return path;
};
async function fingerprint(path) {
  const bytes = await readFile(path);
  return { path: relative(ROOT, path), bytes: bytes.length, sha256: hash(bytes) };
}
async function nativeInventory() {
  const names = [];
  async function walk(path) {
    for (const item of await readdir(path, { withFileTypes: true })) {
      const full = resolve(path, item.name);
      if (item.isDirectory()) await walk(full);
      else if (item.isFile() && /\.(ts|json|drm)$/.test(item.name)) names.push(relative(ROOT, full));
    }
  }
  for (const folder of ['src/logos-engine', 'src/runtime']) await walk(resolve(ROOT, folder));
  const files = {};
  for (const name of names.sort()) files[name] = hash(await readFile(resolve(ROOT, name)));
  return { fileCount: names.length, digest: hash(JSON.stringify(files)), files };
}
function distribution(values) {
  const sorted = values.toSorted((a, b) => a - b), n = sorted.length;
  return { count: n, totalMs: values.reduce((sum, value) => sum + value, 0),
    medianMs: n ? n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : null,
    minMs: sorted[0] ?? null, maxMs: sorted.at(-1) ?? null,
    qualification: 'One diagnostic session; no p95, confidence interval, or budget acceptance.' };
}
function grouped(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const name = key(row);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(row.elapsedMs);
  }
  return Object.fromEntries([...groups].map(([name, values]) => [name, distribution(values)]));
}
function publicPacket(packet) {
  return { frame: packet.frame_rows.map(row => [...row]),
    frames: packet.frame_packet.map(frame => frame.map(row => [...row])),
    availableActionIds: packet.available_action_refs.map(name => Number(name.slice(6))),
    state: packet.state, level: packet.level, levelsCompleted: packet.levels_completed, stepIndex: packet.step_index };
}

const [manifestArg, caseId, outputArg, expectedNativeDigest] = process.argv.slice(2);
assert.equal(process.argv.length, 6, 'Usage: profile-native-loop-costs.mjs CASES.json CASE OUTPUT.json.gz EXPECTED_NATIVE_DIGEST');
assert.match(expectedNativeDigest, /^[a-f0-9]{64}$/);
const output = confined(outputArg), manifestPath = confined(manifestArg);
assert.ok(output.endsWith('.json.gz'), 'Diagnostic output is a lossless gzip JSON receipt');
try { await access(output); throw new Error('Refusing to overwrite an existing diagnostic receipt'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const manifest = JSON.parse(await readFile(manifestPath));
assert.equal(manifest.schema, 'logos-engine.native-loop-cost-cases.v1');
const item = manifest.cases.find(value => value.id === caseId);
assert.ok(item && Number.isInteger(item.actions) && item.actions > 0);
const tracePath = confined(item.trace), traceBytes = await readFile(tracePath);
assert.equal(hash(traceBytes), item.traceSha256);
const trace = JSON.parse(tracePath.endsWith('.gz') ? gunzipSync(traceBytes) : traceBytes);
assert.equal(trace.status, 'passed');
assert.equal(trace.packets[0].packet.step_index, 0);
assert.ok(trace.packets.length > item.actions);
const nativeBefore = await nativeInventory();
assert.equal(nativeBefore.digest, expectedNativeDigest, 'Diagnostic source differs from declared frozen native inventory');
const generator = await fingerprint(fileURLToPath(import.meta.url));
const inputs = await Promise.all([manifestPath, tracePath, confined(PROTOCOL), ...DECLARATIONS.map(confined)].map(fingerprint));
const declarations = { common: JSON.parse(await readFile(confined(DECLARATIONS[0]))),
  strategy: JSON.parse(await readFile(confined(DECLARATIONS[1]))) };
const [{ createNativeV6Runtime }, { V6AgentService }, { NativeKnowledgeStore }, { NativeCallerCoordinator }] = await Promise.all([
  import('../src/logos-engine/v6-native-runtime.ts'), import('../src/runtime/v6-agent-service.ts'),
  import('../src/logos-engine/v6-knowledge-store.ts'), import('../src/logos-engine/v6-native-caller.ts'),
]);

let runtime, operation = 'setup', sequence = 0, recording = true, callNumber = 0;
const samples = [], requests = [], commands = [], undo = [];
function observe(object, method, stage, details = () => ({})) {
  const original = object[method];
  assert.equal(typeof original, 'function', `Missing diagnostic method ${stage}`);
  const ownDescriptor = Object.getOwnPropertyDescriptor(object, method);
  object[method] = function (...args) {
    if (!recording) return original.apply(this, args);
    const meta = details(this, args), id = ++callNumber, currentOperation = operation, currentSequence = sequence;
    const actionBefore = runtime?.actions ?? 0, started = performance.now();
    const finish = failed => {
      const elapsedMs = performance.now() - started;
      samples.push({ id, stage, method, operation: currentOperation, sequence: currentSequence,
        actionBefore, actionAfter: runtime?.actions ?? actionBefore, elapsedMs, failed, ...meta });
    };
    try {
      const result = original.apply(this, args);
      if (result && typeof result.then === 'function') return result.then(value => { finish(false); return value; }, error => { finish(true); throw error; });
      finish(false); return result;
    } catch (error) { finish(true); throw error; }
  };
  undo.push(() => ownDescriptor ? Object.defineProperty(object, method, ownDescriptor) : delete object[method]);
}

// Prototype observation covers stores/callers created inside initialize, before
// their first checkpoint. It changes no arguments, returned data, or owner state.
observe(NativeKnowledgeStore.prototype, 'commit', 'knowledge.commit', (_self, args) => ({
  writeCount: args[0].length, causeWorkflow: args[1]?.workflow ?? null,
  causeStep: args[1]?.step ?? null, causeStatement: args[1]?.statement ?? null,
}));
observe(NativeKnowledgeStore.prototype, 'stateValue', 'knowledge.stateValue', (_self, args) => ({ nodeId: args[0] }));
observe(NativeCallerCoordinator.prototype, 'checkpointWrites', 'caller.checkpointWrites');
const service = new V6AgentService(async () => {
  const start = performance.now(); runtime = await createNativeV6Runtime(declarations);
  samples.push({ id: ++callNumber, stage: 'runtime.creation', method: 'createNativeV6Runtime', operation,
    sequence, actionBefore: 0, actionAfter: 0, elapsedMs: performance.now() - start, failed: false });
  for (const method of ['snapshot', 'authorize', 'advance', 'persistFamilies', 'restoreFamilies', 'plan', 'seal']) {
    observe(runtime, method, `runtime.${method}`);
  }
  if (typeof runtime.authorizationIdentity === 'function') observe(runtime, 'authorizationIdentity', 'runtime.authorizationIdentity');
  for (const family of runtime.families) for (const method of ['state', 'nativeState', 'restore', 'restoreNative']) {
    if (typeof family[method] === 'function') observe(family, method, `family.${method}`, () => ({ family: family.id }));
  }
  return runtime;
});
observe(service, 'snapshot', 'service.snapshot');
observe(service, 'accept', 'service.accept');

const sessionId = 'cost-diagnostic-public-replay';
async function handle(request) {
  operation = request.type; sequence = request.sequence;
  const started = performance.now(), result = await service.handle(request), serviceMs = performance.now() - started;
  const state = result.snapshot;
  requests.push({ operation, sequence, serviceMs, resultKind: result.kind,
    actions: state.actions, levelsCompleted: state.levelsCompleted, cycles: state.cycles,
    nodeCount: state.nodeCount, graphRevision: state.graphRevision, graphChain: state.graphChain,
    nativeExecutionDigest: state.nativeExecutionDigest, acquiredTransitions: state.caller?.acquiredTransitions ?? null,
    family: state.lastDecision, proposalKind: state.proposal?.kind ?? null });
  return result;
}
const startedAt = new Date().toISOString(), start = performance.now();
let result, report;
try {
  result = await handle({ type: 'init', sessionId, sequence: 0, observation: publicPacket(trace.packets[0].packet),
    budgets: { targetLevels: item.targetLevels, levelActionCaps: Array(item.targetLevels).fill(600) } });
  for (let action = 1; action <= item.actions; action++) {
    if (result.kind === 'boundary') result = await handle({ type: 'resume', sessionId, sequence: action - 1 });
    assert.equal(result.kind, 'action', `Expected a current native authorization for action ${action}`);
    assert.ok(result.command && result.ticket);
    const expected = trace.packets[action];
    const command = { action_ref: result.command.actionRef, data: clean(result.command.data) };
    assert.deepEqual(command, expected.command, `Native command diverged before public return ${action}`);
    commands.push({ action, command, ticketActionIndex: result.ticket.actionIndex,
      observationRef: result.ticket.observationRef, decisionRevision: result.ticket.decisionRevision });
    result = await handle({ type: 'advance', sessionId, sequence: action, ticketId: result.ticket.id,
      observation: publicPacket(expected.packet), executionMs: 0 });
  }
  const replayElapsedMs = performance.now() - start, finishedAt = new Date().toISOString();
  recording = false;
  assert.equal(result.snapshot.actions, item.actions);
  assert.equal(result.snapshot.caller.acquiredTransitions, item.actions, 'Stop at an acquired prefix boundary');
  assert.equal(result.snapshot.levelsCompleted, trace.packets[item.actions].packet.levels_completed);
  assert.equal(samples.filter(row => row.failed).length, 0);
  // Structural fingerprints/facts are collected only after timed replay ends.
  const memory = runtime.inspectKnowledge(), graphJson = JSON.stringify(memory), ownerStates = {};
  for (const id of ['family_state:public_occurrence_recall', 'family_state:morphology', 'caller:counters', 'caller:lifecycle']) {
    ownerStates[id] = clean(runtime.knowledge.stateValue(id));
  }
  const final = { snapshot: clean(result.snapshot), knowledge: { chain: memory.chain, revision: memory.deltas.length,
    nodeCount: Object.keys(memory.nodes).length, jsonBytes: Buffer.byteLength(graphJson), jsonSha256: hash(graphJson),
    nodes: Object.fromEntries(Object.entries(memory.nodes).map(([id, node]) => [id, {
      kind: node.kind, revision: node.revision, valueJsonBytes: Buffer.byteLength(JSON.stringify(node.value ?? null)),
      valueJsonSha256: hash(JSON.stringify(node.value ?? null)),
    }])) }, ownerStates };
  const sourceAfter = await nativeInventory();
  assert.deepEqual(sourceAfter, nativeBefore, 'Frozen native sources changed during diagnostic');
  assert.deepEqual(await fingerprint(fileURLToPath(import.meta.url)), generator);
  for (const input of inputs) assert.deepEqual(await fingerprint(confined(input.path)), input);
  report = { schema: 'logos-engine.native-loop-profile.v1', status: 'passed', recordedAt: new Date().toISOString(),
    startedAt, finishedAt, replayElapsedMs, gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    checkout: ROOT, generator, inputs, nativeSource: nativeBefore, nativeSourceUnchanged: true,
    environment: { node: process.version, platform: platform(), release: release(), cpuModel: cpus()[0]?.model ?? null, logicalCpus: cpus().length },
    case: { id: item.id, actions: item.actions, targetLevels: item.targetLevels, diagnosticSessions: 1, warmupSessions: 0 },
    commands, requests, samples, stages: grouped(samples, row => row.stage),
    families: grouped(samples.filter(row => row.family), row => `${row.family}:${row.method}`),
    knowledgeReads: grouped(samples.filter(row => row.nodeId), row => row.nodeId), final,
    qualifications: [
      'One cold diagnostic session of the actual native runtime and V6AgentService, called directly in this Node process. It is not the official cost runner and establishes no budget acceptance.',
      'The native agent recomputes every command. The host checks it against the recorded public command before supplying its corresponding public return. No engine, oracle, learned checkpoint, or prepared plan enters the agent.',
      'Direct service calls exclude BrowserV6Agent acceptance/cloning, worker transport/scheduling, Pause, browser rendering, and game execution. Their times cannot be compared directly to official request/session metrics.',
      'Method and prototype observers preserve arguments, results, and acquisition order. They add overhead and nested measurements include child work and observer overhead. Stage totals are nonadditive and must not be summed as exclusive time.',
      'Source/script/input hashes are verified before/after. Final owner facts, graph size and node fingerprints are collected after timed replay, without JSON-size scans inside timed intervals.',
      'Single-session diagnostic identifies work locations; no p95, confidence interval, memory-leak claim, hardware-independent latency, or +10% budget claim is made.',
    ] };
} finally {
  recording = false;
  for (const restore of undo.reverse()) restore();
}
const raw = Buffer.from(JSON.stringify(report, null, 2) + '\n'), compressed = gzipSync(raw, { level: 9 });
assert.deepEqual(gunzipSync(compressed), raw);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, compressed, { flag: 'wx' });
console.log(JSON.stringify({ status: report.status, output: relative(ROOT, output), nativeDigest: report.nativeSource.digest,
  actions: report.final.snapshot.actions, levelsCompleted: report.final.snapshot.levelsCompleted,
  samples: samples.length, replayElapsedMs: report.replayElapsedMs, receipt: await fingerprint(output),
  uncompressedBytes: raw.length, uncompressedSha256: hash(raw) }));
