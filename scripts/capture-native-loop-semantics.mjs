#!/usr/bin/env node
/**
 * Complete semantic capture of one cold public-return replay, without a cost benchmark.
 * Usage: node scripts/capture-native-loop-semantics.mjs CASES.json CASE OUTPUT.json.gz EXPECTED_NATIVE_DIGEST
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = value => createHash('sha256').update(value).digest('hex');
const SOURCE = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6';
const DECLARATIONS = [`${SOURCE}/laya_proto/common_frontier_policy.drm.json`, `${SOURCE}/morphology_policy/strategy.drm`];
const PROTOCOL = 'docs/migration/lot2c-cost-evidence/diagnostic/semantic-control-protocol.md';
const clean = value => JSON.parse(JSON.stringify(value));
function confined(value) {
  const path = resolve(ROOT, value), name = relative(ROOT, path);
  assert.ok(name && !name.startsWith('..'), 'Semantic capture inputs/output must stay in this checkout');
  return path;
}
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
function publicPacket(packet) {
  return { frame: packet.frame_rows.map(row => [...row]), frames: packet.frame_packet.map(frame => frame.map(row => [...row])),
    availableActionIds: packet.available_action_refs.map(name => Number(name.slice(6))), state: packet.state,
    level: packet.level, levelsCompleted: packet.levels_completed, stepIndex: packet.step_index };
}

const [manifestArg, caseId, outputArg, expectedNativeDigest] = process.argv.slice(2);
assert.equal(process.argv.length, 6, 'Usage: capture-native-loop-semantics.mjs CASES.json CASE OUTPUT.json.gz EXPECTED_NATIVE_DIGEST');
assert.match(expectedNativeDigest, /^[a-f0-9]{64}$/);
const output = confined(outputArg), manifestPath = confined(manifestArg);
assert.ok(output.endsWith('.json.gz'));
try { await access(output); throw new Error('Refusing to overwrite a semantic capture'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const manifest = JSON.parse(await readFile(manifestPath));
assert.equal(manifest.schema, 'logos-engine.native-loop-cost-cases.v1');
const item = manifest.cases.find(value => value.id === caseId);
assert.ok(item && Number.isInteger(item.actions) && item.actions > 0);
const tracePath = confined(item.trace), traceBytes = await readFile(tracePath);
assert.equal(hash(traceBytes), item.traceSha256);
const trace = JSON.parse(tracePath.endsWith('.gz') ? gunzipSync(traceBytes) : traceBytes);
assert.equal(trace.status, 'passed'); assert.equal(trace.packets[0].packet.step_index, 0);
assert.ok(trace.packets.length > item.actions);
const nativeBefore = await nativeInventory();
assert.equal(nativeBefore.digest, expectedNativeDigest, 'Semantic capture source differs from declared frozen native inventory');
const generator = await fingerprint(fileURLToPath(import.meta.url));
const inputs = await Promise.all([manifestPath, tracePath, confined(PROTOCOL), ...DECLARATIONS.map(confined)].map(fingerprint));
const declarations = { common: JSON.parse(await readFile(confined(DECLARATIONS[0]))),
  strategy: JSON.parse(await readFile(confined(DECLARATIONS[1]))) };
const [{ createNativeV6Runtime }, { V6AgentService }] = await Promise.all([
  import('../src/logos-engine/v6-native-runtime.ts'), import('../src/runtime/v6-agent-service.ts'),
]);

let runtime;
const service = new V6AgentService(async () => { runtime = await createNativeV6Runtime(declarations); return runtime; });
const sessionId = 'cost-semantic-public-replay', commands = [], requests = [];
async function handle(operation) {
  const result = await service.handle(operation), state = result.snapshot;
  requests.push({ operation: operation.type, sequence: operation.sequence, kind: result.kind,
    actions: state.actions, cycles: state.cycles, levelsCompleted: state.levelsCompleted, nodeCount: state.nodeCount,
    graphRevision: state.graphRevision, graphChain: state.graphChain, nativeExecutionDigest: state.nativeExecutionDigest,
    acquiredTransitions: state.caller?.acquiredTransitions ?? null, family: state.lastDecision,
    proposalKind: state.proposal?.kind ?? null });
  return result;
}

const startedAt = new Date().toISOString();
let result = await handle({ type: 'init', sessionId, sequence: 0, observation: publicPacket(trace.packets[0].packet),
  budgets: { targetLevels: item.targetLevels, levelActionCaps: Array(item.targetLevels).fill(600) } });
for (let action = 1; action <= item.actions; action++) {
  if (result.kind === 'boundary') result = await handle({ type: 'resume', sessionId, sequence: action - 1 });
  assert.equal(result.kind, 'action', `Expected a native authorization before public return ${action}`);
  assert.ok(result.command && result.ticket);
  const expected = trace.packets[action], command = { action_ref: result.command.actionRef, data: clean(result.command.data) };
  assert.deepEqual(command, expected.command, `Native command diverged before public return ${action}`);
  commands.push({ action, command, ticketActionIndex: result.ticket.actionIndex,
    observationRef: result.ticket.observationRef, decisionRevision: result.ticket.decisionRevision });
  result = await handle({ type: 'advance', sessionId, sequence: action, ticketId: result.ticket.id,
    observation: publicPacket(expected.packet), executionMs: 0 });
}
assert.equal(result.snapshot.actions, item.actions);
assert.equal(result.snapshot.caller.acquiredTransitions, item.actions, 'Stop at an acquired prefix boundary');
assert.equal(result.snapshot.levelsCompleted, trace.packets[item.actions].packet.levels_completed);

// Complete immutable encoded graph, including all node values and all deltas.
// Decode every reasoning trace as well, so changed Float64 leaves are attributable
// to exact trace fields rather than guessed from unequal value fingerprints.
const graph = runtime.inspectKnowledge(), decodedTraces = {}, ownerStates = {};
for (const id of Object.keys(graph.nodes).filter(id => /^reasoning:trace:[0-9]+$/.test(id)).sort()) {
  decodedTraces[id] = runtime.knowledge.stateValue(id);
}
for (const id of ['family_state:public_occurrence_recall', 'family_state:morphology', 'caller:counters', 'caller:lifecycle']) {
  ownerStates[id] = runtime.knowledge.stateValue(id);
}
assert.deepEqual(await nativeInventory(), nativeBefore, 'Frozen native source changed during semantic capture');
assert.deepEqual(await fingerprint(fileURLToPath(import.meta.url)), generator);
for (const input of inputs) assert.deepEqual(await fingerprint(confined(input.path)), input);
const report = { schema: 'logos-engine.native-loop-semantic-capture.v1', status: 'passed',
  startedAt, finishedAt: new Date().toISOString(),
  gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(), checkout: ROOT,
  generator, inputs, nativeSource: nativeBefore, nativeSourceUnchanged: true,
  case: { id: item.id, actions: item.actions, targetLevels: item.targetLevels, sessions: 1 },
  commands, requests, final: { snapshot: result.snapshot, graph, decodedTraces, ownerStates },
  qualification: 'Separate semantic control addressing missing full trace payloads in the first diagnostic. No performance metrics, budget, percentile or speed claim. One cold uninstrumented actual-service replay checks every native command before supplying its public return. Full graph/node values/deltas and decoded trace values are retained without normalizing version provenance, clocks or any business value. The source/script/inputs stay fixed. Original profile receipts remain unchanged.' };
const raw = Buffer.from(JSON.stringify(report, null, 2) + '\n'), archive = gzipSync(raw, { level: 9 });
assert.deepEqual(gunzipSync(archive), raw);
await mkdir(dirname(output), { recursive: true }); await writeFile(output, archive, { flag: 'wx' });
console.log(JSON.stringify({ status: report.status, output: relative(ROOT, output), nativeDigest: nativeBefore.digest,
  actions: result.snapshot.actions, levelsCompleted: result.snapshot.levelsCompleted, nodes: Object.keys(graph.nodes).length,
  deltas: graph.deltas.length, decodedTraces: Object.keys(decodedTraces).length, receipt: await fingerprint(output),
  uncompressedBytes: raw.length, uncompressedSha256: hash(raw) }));
