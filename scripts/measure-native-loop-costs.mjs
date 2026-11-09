#!/usr/bin/env node
/** Reproducible public-return cost measurements; no native decision is injected.
 * Usage: node scripts/measure-native-loop-costs.mjs CASES.json OUTPUT.json
 * A dedicated Node worker runs the actual native service. The real browser
 * controller runs outside that worker so Pause acknowledgement and safe
 * boundary completion are measured separately. This is not browser rendering
 * or live game timing. Instance wrappers observe calls without changing data.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { cpus, platform, release } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { isMainThread, parentPort, Worker } from 'node:worker_threads';
import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = value => createHash('sha256').update(value).digest('hex');
const clean = value => JSON.parse(JSON.stringify(value));
const SOURCE = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6';
const DECLARATIONS = [`${SOURCE}/laya_proto/common_frontier_policy.drm.json`, `${SOURCE}/morphology_policy/strategy.drm`];
async function fingerprint(path) { const bytes = await readFile(path); return { path: relative(ROOT, path), bytes: bytes.length, sha256: hash(bytes) }; }
async function nativeInventory() {
  const names = [];
  async function walk(path) { for (const item of await readdir(path, { withFileTypes: true })) {
    const full = resolve(path, item.name); if (item.isDirectory()) await walk(full);
    else if (item.isFile() && /\.(ts|json|drm)$/.test(item.name)) names.push(relative(ROOT, full));
  } }
  for (const folder of ['src/logos-engine', 'src/runtime']) await walk(resolve(ROOT, folder));
  const files = {}; for (const name of names.sort()) files[name] = hash(await readFile(resolve(ROOT, name)));
  return { fileCount: names.length, digest: hash(JSON.stringify(files)), files };
}
function summary(values) {
  if (!values.length) return { count: 0, medianMs: null, p95Ms: null, minMs: null, maxMs: null };
  const sorted = values.toSorted((a, b) => a - b), n = sorted.length;
  return { count: n, medianMs: n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2,
    p95Ms: n >= 20 ? sorted[Math.ceil(n * 0.95) - 1] : null,
    minMs: sorted[0], maxMs: sorted[n - 1], tailQualification: n < 20 ? 'Fewer than 20 samples; no p95 reported.' : 'Empirical nearest-rank p95; repeated observations within a session are correlated.' };
}
function grouped(samples) {
  const groups = {};
  for (const row of samples) (groups[row.stage] ??= []).push(row.elapsedMs);
  return Object.fromEntries(Object.entries(groups).map(([name, values]) => [name, summary(values)]));
}

async function workerMain() {
  const [{ createNativeV6Runtime }, { V6AgentService }] = await Promise.all([
    import('../src/logos-engine/v6-native-runtime.ts'), import('../src/runtime/v6-agent-service.ts'),
  ]);
  const declarations = { common: JSON.parse(await readFile(resolve(ROOT, DECLARATIONS[0]))),
    strategy: JSON.parse(await readFile(resolve(ROOT, DECLARATIONS[1]))) };
  let service, runtime, rows = [], sequence = 0;
  function observe(object, key, stage, enabled = () => true) {
    const original = object[key]; assert.equal(typeof original, 'function', `Missing measured method ${key}`);
    object[key] = function (...args) {
      const measured = enabled(this), actionBefore = this.actions ?? 0, started = performance.now();
      const finish = () => {
        const elapsedMs = performance.now() - started;
        if (measured) rows.push({ stage, elapsedMs, sequence, actionBefore, actionAfter: this.actions ?? actionBefore,
          family: this.lastFamily ?? null, proposalKind: this.prefix?.proposal?.kind ?? null,
          subquestion: this.prefix?.proposal?.field_subquestion ?? null, poseMode: this.prefix?.proposal?.material_pose_plan?.mode ?? null });
      };
      try { const result = original.apply(this, args);
        if (result && typeof result.then === 'function') return result.then(value => { finish(); return value; }, error => { finish(); throw error; });
        finish(); return result;
      } catch (error) { finish(); throw error; }
    };
  }
  parentPort.on('message', async message => {
    try {
      if (message.type === 'begin') {
        rows = []; runtime = undefined;
        service = new V6AgentService(async () => {
          const started = performance.now(); runtime = await createNativeV6Runtime(declarations);
          rows.push({ stage: 'runtime_creation', elapsedMs: performance.now() - started, sequence: 0, actionBefore: 0, actionAfter: 0 });
          observe(runtime, 'plan', 'new_decision');
          observe(runtime, 'authorize', 'known_prefix_guard', object => (object.prefix?.index ?? 0) > 0);
          observe(runtime, 'seal', 'acquisition_and_persistence');
          observe(runtime, 'persistFamilies', 'persistence');
          observe(runtime, 'restoreFamilies', 'restoration');
          return runtime;
        });
        parentPort.postMessage({ id: message.id, ok: true }); return;
      }
      assert.ok(service, 'Begin a measured session before requesting service work');
      sequence = message.operation.sequence;
      const start = performance.now();
      const result = await service.handle(message.operation);
      const serviceMs = performance.now() - start;
      const measured = rows; rows = [];
      parentPort.postMessage({ id: message.id, ok: true, result, samples: measured, serviceMs,
        memory: process.memoryUsage(), implementation: result.snapshot.implementation ?? null });
    } catch (error) { parentPort.postMessage({ id: message.id, ok: false, error: { message: error.message, stack: error.stack } }); }
  });
  parentPort.postMessage({ ready: true });
}

async function bridge() {
  const started = performance.now(), worker = new Worker(new URL(import.meta.url));
  let next = 0; const pending = new Map();
  const ready = new Promise((resolveReady, rejectReady) => {
    worker.on('message', message => {
      if (message.ready) { resolveReady(); return; }
      const entry = pending.get(message.id); if (!entry) return;
      pending.delete(message.id);
      if (message.ok) entry.resolve(message); else entry.reject(new Error(message.error.message));
    });
    worker.on('error', error => { rejectReady(error); for (const item of pending.values()) item.reject(error); pending.clear(); });
    worker.on('exit', code => { if (code) for (const item of pending.values()) item.reject(new Error(`Measurement worker exited ${code}`)); pending.clear(); });
  });
  await ready;
  return { startupMs: performance.now() - started,
    request(payload) { const id = ++next; return new Promise((resolveReply, reject) => { pending.set(id, { resolve: resolveReply, reject }); worker.postMessage({ ...payload, id }); }); },
    async close() { await worker.terminate(); } };
}
function gamePacket(packet, code, levels) {
  return { gameCode: code, frame: packet.frame_rows.map(row => [...row]), frames: packet.frame_packet.map(frame => frame.map(row => [...row])),
    state: packet.state, availableActionIds: packet.available_action_refs.map(name => Number(name.slice(6))),
    level: packet.level, levelCount: levels, levelsCompleted: packet.levels_completed, canUndo: false, canSelectLevel: true, defaultFps: 10 };
}

async function trial(connection, item, trace, round, actionsLimit, warmup) {
  const { BrowserV6Agent } = await import('../src/runtime/v6-agent.ts');
  await connection.request({ type: 'begin' });
  let index = 0, current = gamePacket(trace.packets[0].packet, item.id, item.targetLevels), lastResult, agent;
  const samples = [], requests = [], pauses = [], observed = [], memory = [];
  let planningPause = null, engagedPause = null, requestPlanningPause = !warmup, requestEngagedPause = !warmup;
  const pause = phase => {
    const requestedAt = performance.now(), before = index; agent.pause();
    const row = { phase, requestedAt, acknowledgementMs: performance.now() - requestedAt, actionsAtRequest: before,
      acknowledgedPaused: agent.snapshot.paused };
    pauses.push(row); return row;
  };
  const transport = {
    async request(operation) {
      const begin = performance.now();
      const waiting = connection.request({ type: 'request', operation });
      if (requestPlanningPause && operation.type === 'init') {
        requestPlanningPause = false;
        planningPause = pause('initial_planning');
      }
      const response = await waiting, elapsedMs = performance.now() - begin;
      samples.push(...response.samples);
      requests.push({ type: operation.type, sequence: operation.sequence, wallMs: elapsedMs, nativeServiceMs: response.serviceMs,
        transportAndSchedulingMs: Math.max(0, elapsedMs - response.serviceMs), kind: response.result.kind, actions: response.result.snapshot.actions });
      if (operation.type !== 'inspect') {
        const snapshot = response.result.snapshot;
        observed.push({ type: operation.type, sequence: operation.sequence, family: snapshot.lastDecision, proposalKind: snapshot.proposal?.kind ?? null,
          poseMode: snapshot.proposal?.material_pose_plan?.mode ?? null, actions: snapshot.actions, cycles: snapshot.cycles,
          levelsCompleted: snapshot.levelsCompleted, nodeCount: snapshot.nodeCount, acquiredTransitions: snapshot.caller?.acquiredTransitions ?? null });
        memory.push({ sequence: operation.sequence, heapUsed: response.memory.heapUsed, rss: response.memory.rss });
      }
      lastResult = response.result; return response.result;
    },
    reset() { throw new Error('Measured sessions must never reset their retained knowledge'); }, dispose() {},
  };
  agent = new BrowserV6Agent({ transport, targetLevels: item.targetLevels, actionsPerLevel: 600,
    getObservation: () => current, canDispatch: () => true, onState: () => {},
    dispatch: async action => {
      const hostStart = performance.now(), expected = trace.packets[index + 1];
      assert.ok(expected && index < actionsLimit, 'No unrecorded action is supplied by the replay host');
      const command = { action_ref: `ACTION${action.id}`, data: action.id === 6 ? { ...action.data } : {} };
      assert.deepEqual(command, expected.command, `Native command diverged at public return ${index + 1}`);
      if (requestEngagedPause) { requestEngagedPause = false; engagedPause = pause('engaged_action'); }
      current = gamePacket(expected.packet, item.id, item.targetLevels); index++;
      samples.push({ stage: 'recorded_host_lookup_and_copy', elapsedMs: performance.now() - hostStart, actionBefore: index - 1, actionAfter: index });
      return { observation: current, executionMs: 0 };
    } });
  const startedAt = new Date().toISOString(), start = performance.now();
  while (index < actionsLimit) {
    const before = index; await agent.run(Math.min(600, actionsLimit - index));
    assert.notEqual(agent.snapshot.status, 'error', agent.snapshot.message);
    if (planningPause && planningPause.safeBoundaryMs === undefined) {
      planningPause.safeBoundaryMs = performance.now() - planningPause.requestedAt;
      planningPause.actionsAtSafeBoundary = index;
      assert.equal(index, 0, 'Pause during planning must retain the first unexecuted command');
      assert.equal(lastResult.kind, 'action');
      planningPause.pendingTicketRetained = Boolean(lastResult.ticket);
    }
    if (engagedPause && engagedPause.safeBoundaryMs === undefined) {
      engagedPause.safeBoundaryMs = performance.now() - engagedPause.requestedAt;
      engagedPause.actionsAtSafeBoundary = index;
      assert.equal(index, 1, 'Pause acquires exactly the action already engaged');
      assert.equal(agent.snapshot.actions, index);
    }
    assert.ok(index > before || (planningPause && index === 0 && pauses.length === 1), 'Measured controller made no progress');
    if (agent.snapshot.status === 'stopped') break;
  }
  const replayElapsedMs = performance.now() - start, snapshot = agent.snapshot;
  assert.equal(index, actionsLimit); assert.equal(snapshot.actions, index);
  assert.equal(requests.filter(row => row.type === 'init').length, 1);
  assert.equal(requests.filter(row => row.type === 'advance').length, index);
  const acquisitionBoundary = snapshot.caller?.acquiredTransitions;
  assert.equal(acquisitionBoundary, index, 'Configured test stops only at an acquired prefix boundary');
  const inspection = [];
  if (!warmup) for (let n = 0; n < 3; n++) {
    const before = performance.now();
    const response = await connection.request({ type: 'request', operation: { type: 'inspect', sessionId: snapshot.sessionId, sequence: snapshot.sequence } });
    const endToEndMs = performance.now() - before;
    assert.equal(response.result.snapshot.actions, index);
    inspection.push({ nativeServiceMs: response.serviceMs, endToEndMs, graphNodes: Object.keys(response.result.knowledge.nodes).length });
  }
  for (const row of pauses) delete row.requestedAt;
  const result = { case: item.id, round, warmup, startedAt, finishedAt: new Date().toISOString(), actions: index,
    levelsCompleted: snapshot.levelsCompleted, cycles: snapshot.cycles, replayElapsedMs, phaseCosts: grouped(samples), samples,
    requests, pauses, inspection, observations: observed, memory,
    final: { actions: snapshot.actions, levelsCompleted: snapshot.levelsCompleted, reason: snapshot.reason,
      graphRevision: snapshot.graphRevision, nodeCount: snapshot.nodeCount, acquiredTransitions: acquisitionBoundary,
      implementation: snapshot.implementation } };
  await connection.request({ type: 'request', operation: { type: 'close', sessionId: snapshot.sessionId, sequence: snapshot.sequence } });
  agent.dispose(); return result;
}

async function main() {
  const [manifestArgument, outputArgument] = process.argv.slice(2);
  if (!manifestArgument || !outputArgument || process.argv.length !== 4) throw new Error('Usage: measure-native-loop-costs.mjs CASES.json OUTPUT.json');
  const output = resolve(ROOT, outputArgument), manifestPath = resolve(ROOT, manifestArgument);
  assert.ok(relative(ROOT, output) && !relative(ROOT, output).startsWith('..')); assert.ok(!relative(ROOT, manifestPath).startsWith('..'));
  try { await access(output); throw new Error('Cost receipt already exists; refusing overwrite'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const manifest = JSON.parse(await readFile(manifestPath));
  assert.equal(manifest.schema, 'logos-engine.native-loop-cost-cases.v1');
  assert.ok(Number.isInteger(manifest.rounds) && manifest.rounds >= 3 && manifest.rounds <= 10);
  assert.ok(Array.isArray(manifest.cases) && manifest.cases.length > 0);
  const sourceBefore = await nativeInventory(), generator = await fingerprint(fileURLToPath(import.meta.url));
  const inputFiles = [await fingerprint(manifestPath), ...await Promise.all(DECLARATIONS.map(name => fingerprint(resolve(ROOT, name))))];
  const cases = [];
  for (const item of manifest.cases) {
    assert.ok(/^[A-Za-z0-9_-]+$/.test(item.id)); assert.ok(Number.isInteger(item.actions) && item.actions > 0);
    assert.ok(Number.isInteger(item.targetLevels) && item.targetLevels > 0);
    const path = resolve(ROOT, item.trace); assert.ok(!relative(ROOT, path).startsWith('..'));
    const bytes = await readFile(path); assert.equal(hash(bytes), item.traceSha256);
    inputFiles.push(await fingerprint(path));
    const trace = JSON.parse(item.trace.endsWith('.gz') ? gunzipSync(bytes) : bytes);
    assert.equal(trace.status, 'passed'); assert.ok(trace.packets.length > item.actions);
    assert.equal(trace.packets[0].packet.step_index, 0);
    const connection = await bridge(), trials = [];
    try {
      const warmupActions = item.warmupActions ?? Math.min(3, item.actions);
      console.log(JSON.stringify({ case: item.id, phase: 'warmup', actions: warmupActions }));
      trials.push(await trial(connection, item, trace, 0, warmupActions, true));
      for (let round = 1; round <= manifest.rounds; round++) {
        console.log(JSON.stringify({ case: item.id, phase: 'measuring', round, actions: item.actions }));
        const measured = await trial(connection, item, trace, round, item.actions, false); trials.push(measured);
        console.log(JSON.stringify({ case: item.id, phase: 'measured', round, elapsedMs: measured.replayElapsedMs, actions: measured.actions }));
      }
    } finally { await connection.close(); }
    const measured = trials.filter(row => !row.warmup), byStage = grouped(measured.flatMap(row => row.samples));
    const roundMedians = Object.fromEntries(Object.keys(byStage).map(stage => {
      const values = measured.map(row => row.phaseCosts[stage]?.medianMs).filter(Number.isFinite), s = summary(values);
      return [stage, { values, medianMs: s.medianMs, relativeRange: s.medianMs ? (s.maxMs - s.minMs) / s.medianMs : null }];
    }));
    cases.push({ id: item.id, declaredPurpose: item.purpose, workerStartupMs: connection.startupMs, trials,
      pooledPhaseCosts: byStage, roundMedianNoise: roundMedians,
      sessionElapsed: summary(measured.map(row => row.replayElapsedMs)),
      inspection: { nativeService: summary(measured.flatMap(row => row.inspection.map(x => x.nativeServiceMs))),
        endToEnd: summary(measured.flatMap(row => row.inspection.map(x => x.endToEndMs))) },
      pause: Object.fromEntries(['initial_planning', 'engaged_action'].map(phase => [phase, {
        acknowledgement: summary(measured.flatMap(row => row.pauses.filter(p => p.phase === phase).map(p => p.acknowledgementMs))),
        safeBoundary: summary(measured.flatMap(row => row.pauses.filter(p => p.phase === phase).map(p => p.safeBoundaryMs))) }])) });
  }
  const sourceAfter = await nativeInventory(); assert.deepEqual(sourceAfter, sourceBefore, 'Native source changed during cost measurement');
  assert.deepEqual(await fingerprint(fileURLToPath(import.meta.url)), generator);
  for (const row of inputFiles) assert.deepEqual(await fingerprint(resolve(ROOT, row.path)), row);
  const report = { schema: 'logos-engine.native-loop-costs.v1', status: 'passed', recordedAt: new Date().toISOString(),
    gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(), checkout: ROOT,
    generator, inputs: inputFiles, nativeSource: sourceBefore, nativeSourceUnchanged: true,
    environment: { node: process.version, platform: platform(), release: release(), cpuModel: cpus()[0]?.model ?? null, logicalCpus: cpus().length },
    manifest, cases,
    qualifications: [
      'Actual common native runtime, service and BrowserV6Agent controller; one separate Node worker per case, limited warmup then three or more cold sessions.',
      'Only recorded public returns enter the solver after its own command matches; no game implementation, oracle, imported learned state or expected route is supplied to decisions.',
      'Phase timings are nested and must not be summed. Instance observers leave arguments, results, states and acquisition order unchanged; the same observer overhead is present before/after.',
      'Game execution is excluded (executionMs=0); recorded_host_lookup_and_copy measures replay checks/copies, not the original game. No browser rendering or machine-independent latency is claimed.',
      'Inspection runs explicitly after the replay and is excluded from replay/agent phase times. Pause acknowledgement is controller time; safe-boundary latency includes in-flight worker work and protocol scheduling.',
      'A longer retained session is the declared finite public trajectory, not an hours-long stress run. State-size and heap observations do not establish a memory leak.',
      'P95 is withheld below 20 samples. Pooled within-session samples are correlated; between-round median range reports observed noise, not a confidence interval.',
    ] };
  await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: report.status, output: relative(ROOT, output), nativeDigest: sourceBefore.digest,
    cases: cases.map(row => ({ id: row.id, actions: row.trials.filter(x => !x.warmup).reduce((sum, x) => sum + x.actions, 0), sessionMedianMs: row.sessionElapsed.medianMs })) }));
}

if (isMainThread) await main(); else await workerMain();
