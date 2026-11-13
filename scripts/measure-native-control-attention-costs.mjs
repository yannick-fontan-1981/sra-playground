#!/usr/bin/env node
/** Absolute real-consumer costs from states acquired through a public protocol.
 * Usage: node scripts/measure-native-control-attention-costs.mjs OUTPUT.json
 * This is a synthetic restored-component diagnostic, not a game campaign.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { cpus, platform, release } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { NativeCallerCoordinator } from '../src/logos-engine/v6-native-caller.ts';
import { NativeReasoningMemory } from '../src/logos-engine/v6-reasoning-memory.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6';
const FIXTURE = 'tests/fixtures/v6-morphology-measurements-reference.json.gz';
const CONSUMER = 'tests/fixtures/v6-control-attention-reference.json.gz';
const PROTOCOL = 'docs/migration/lot2b-evidence/performance/component-protocol.md';
const CASES = ['replication_inspection', 'replication_proposal', 'unrelated_unbound_information',
  'same_action_information', 'focused_replication_proposal', 'parent_return'];
const WARMUP = 3, REPETITIONS = 20;
const hash = value => createHash('sha256').update(value).digest('hex');
const copy = value => structuredClone(value);
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
function stats(values) {
  const sorted = values.toSorted((a, b) => a - b), n = sorted.length;
  return { count: n, medianMs: n ? n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : null,
    p95Ms: n >= 20 ? sorted[Math.ceil(n * 0.95) - 1] : null, minMs: sorted[0] ?? null, maxMs: sorted.at(-1) ?? null };
}
function group(samples) {
  const groups = {};
  for (const sample of samples) (groups[`${sample.phase}:${sample.method}`] ??= []).push(sample.elapsedMs);
  return Object.fromEntries(Object.entries(groups).map(([method, values]) => [method, stats(values)]));
}
function observe(object, method, label, samples, phase) {
  const original = object[method]; assert.equal(typeof original, 'function', label);
  object[method] = function (...args) {
    const started = performance.now(), enteredPhase = phase();
    const finish = () => samples.push({ method: label, phase: enteredPhase, elapsedMs: performance.now() - started });
    try {
      const result = original.apply(this, args);
      if (result && typeof result.then === 'function') return result.then(value => { finish(); return value; }, error => { finish(); throw error; });
      finish(); return result;
    } catch (error) { finish(); throw error; }
  };
}
function observeCaller(caller, samples, phase) {
  for (const method of ['acquireControlForTarget', 'informationOffer', 'attentionParentReturnOffer']) observe(caller, method, `caller.${method}`, samples, phase);
  for (const method of ['canProbeHere', 'propose']) observe(caller.frontier, method, `frontier.${method}`, samples, phase);
  for (const method of ['open', 'matches', 'observe', 'takeParentReturn', 'revalidate']) observe(caller.attention, method, `attention.${method}`, samples, phase);
}
function publicProtocol(seed) {
  let rows = Array.from({ length: 64 }, (_, y) => Array.from({ length: 64 }, (_, x) => seed[y]?.[x] ?? 0)), stepIndex = 0;
  const packet = () => ({ frame: copy(rows), frames: [copy(rows)], availableActionIds: [1, 2, 3, 4, 5],
    state: 'NOT_FINISHED', level: 1, levelsCompleted: 0, stepIndex });
  return { observe: packet, step(command) {
    assert.ok([1, 2, 3, 4, 5].includes(Number(command.actionRef.slice(6))));
    assert.deepEqual(command.data ?? {}, {});
    const square = [];
    for (const [y, row] of rows.entries()) for (const [x, value] of row.entries()) if (value === 9) square.push([x, y]);
    assert.equal(square.length, 4);
    const next = rows.map(row => [...row]);
    for (const [x, y] of square) next[y][x] = 0;
    for (const [x, y] of square) { assert.equal(next[y][x + 2], 0); next[y][x + 2] = 9; }
    rows = next; stepIndex++; return packet();
  } };
}
function projection(value) {
  return value ? { status: value.status ?? null, actions: value.actions ?? null,
    experiment: value.experiment ?? value.question?.control_acquisition?.experiment ?? null,
    control: value.question?.control_acquisition ?? null, curiosity: value.question?.curiosity ?? null } : null;
}

const [outputArgument] = process.argv.slice(2);
if (!outputArgument || process.argv.length !== 3) throw new Error('Usage: measure-native-control-attention-costs.mjs OUTPUT.json');
const output = resolve(ROOT, outputArgument);
assert.ok(relative(ROOT, output) && !relative(ROOT, output).startsWith('..'));
try { await access(output); throw new Error('Receipt exists; refusing overwrite'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const startedAt = new Date().toISOString(), nativeBefore = await nativeInventory();
const inputs = await Promise.all([fileURLToPath(import.meta.url), resolve(ROOT, PROTOCOL), resolve(ROOT, FIXTURE), resolve(ROOT, CONSUMER),
  resolve(ROOT, `${SOURCE}/laya_proto/common_frontier_policy.drm.json`), resolve(ROOT, `${SOURCE}/morphology_policy/strategy.drm`),
  resolve(ROOT, 'tests/v6-control-attention-kernel.test.ts')].map(fingerprint));
const result = { schema: 'logos-engine.native-control-attention-component-costs.v1', status: 'running', startedAt,
  gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(), nativeSource: nativeBefore, inputs,
  environment: { node: process.version, platform: platform(), release: release(), cpuModel: cpus()[0]?.model ?? null, logicalCpus: cpus().length },
  protocol: { warmupPerCase: WARMUP, measuredCallsPerCase: REPETITIONS, copyCensusCallsPerCase: 1, cases: CASES }, cases: [],
  qualifications: [
    'Absolute after-only restored-component diagnostic, with no V61 speed ratio or new budget.',
    'Checkpoint evidence and current decisions originate in this run from the real runtime, two synthetic public returns and real acquisition. No source expected decision enters the runtime.',
    'Information offers are explicit additionalOffers boundary inputs rebound from the source consumer fixture. Their natural production in this scene is not claimed.',
    'Fresh reasoning/caller owners restore the same real checkpoint for every measured call. Restoration and attention preparation are separate from operation time.',
    'Nested method durations include transparent wrapper overhead and overlap with operationMs; do not add them. The twenty calls are correlated warm-process samples.',
    'structuredClone calls are counted in a separate census, with interception disabled for timing repetitions. This excludes slices, spreads, JSON and unobserved copies; no byte total or per-operation normalization is inferred.',
    'The parent return uses the actual post-return decision without forcing its status. A gated return is reported as such, not as a positive follow-up proposal.',
    'Synthetic actions and zero completed levels are not an ARC game result. Component intervals exclude game execution, worker transport, browser rendering and common WHY/ACT authorization.',
  ] };
try {
  const fixture = JSON.parse(gunzipSync(await readFile(resolve(ROOT, FIXTURE))));
  const consumer = JSON.parse(gunzipSync(await readFile(resolve(ROOT, CONSUMER))));
  assert.equal(fixture.method.sourceModified, false);
  assert.equal(fixture.sourceVerification.verifiedOriginalFilesBefore, 1786);
  assert.equal(fixture.sourceVerification.verifiedOriginalFilesAfter, 1786);
  assert.equal(consumer.method.sourceModified, false); assert.equal(consumer.method.sourceChecks, 1786);
  const sourceInputs = new Map();
  for (const original of [fixture, consumer]) {
    assert.equal(original.commit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
    for (const [name, expected] of Object.entries(original.sourceHashes)) {
      const path = `reference/v6/${original.commit}/source/${name}`, actual = await fingerprint(resolve(ROOT, path));
      assert.equal(actual.sha256, expected, path); sourceInputs.set(path, actual);
    }
  }
  const generator = await fingerprint(resolve(ROOT, fixture.generator.path));
  assert.equal(generator.sha256, fixture.generator.sha256); sourceInputs.set(generator.path, generator);
  const manifest = await fingerprint(resolve(ROOT, `reference/v6/${fixture.commit}/manifest.json`));
  assert.equal(manifest.sha256, fixture.sourceVerification.manifestSha256); sourceInputs.set(manifest.path, manifest);
  const consumerGenerator = await fingerprint(resolve(ROOT, 'scripts/export-v6-control-attention-reference.py'));
  sourceInputs.set(consumerGenerator.path, consumerGenerator); inputs.push(...sourceInputs.values());
  const offerTemplate = consumer.cases.find(sample => sample.id === 'replication_defers_question_and_opens_attention').args.offers[0];
  const declarations = { common: JSON.parse(await readFile(resolve(ROOT, `${SOURCE}/laya_proto/common_frontier_policy.drm.json`))),
    strategy: JSON.parse(await readFile(resolve(ROOT, `${SOURCE}/morphology_policy/strategy.drm`))) };
  const setupStart = performance.now(), runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const service = new V6AgentService(() => runtime), protocol = publicProtocol(fixture.scenes[fixture.family.current].rows);
  const sessionId = 'synthetic-control-attention-costs', milestones = [];
  let value = await service.handle({ type: 'init', sessionId, sequence: 0, observation: protocol.observe(), budgets: { targetLevels: 3, levelActionCaps: [20, 20, 20] } });
  const note = () => milestones.push({ actions: value.snapshot.actions, levelsCompleted: value.snapshot.levelsCompleted,
    kind: value.kind, selected: value.snapshot.proposal?.strategy_receipt?.selected ?? null,
    decision: Object.fromEntries(['status', 'reason', 'route_key'].map(key => [key, value.snapshot.proposal?.morphology?.[key] ?? null])),
    control: value.snapshot.proposal?.question?.control_acquisition ?? null, acquiredTransitions: value.snapshot.caller?.acquiredTransitions ?? null });
  note();
  assert.equal(value.kind, 'action'); assert.equal(value.snapshot.proposal.question.control_acquisition.experiment, 'sample_unused_control');
  assert.equal(runtime.caller.goal.memory.episode.length, 0);
  value = await service.handle({ type: 'advance', sessionId, sequence: 1, ticketId: value.ticket.id,
    observation: protocol.step(value.command), executionMs: 0 });
  assert.equal(value.kind, 'boundary'); assert.equal(value.snapshot.caller.acquiredTransitions, 1);
  value = await service.handle({ type: 'resume', sessionId, sequence: 1 }); note();
  assert.equal(value.kind, 'action'); assert.equal(value.snapshot.proposal.question.control_acquisition.experiment, 'replicate_translation');
  const capture = () => ({ observation: copy(runtime.observation), rows: copy(runtime.current.frame_rows),
    decision: runtime.acquisitionFamilies.morphology.currentDecision(runtime.observation), memory: runtime.caller.memory.state(), state: runtime.caller.state(),
    configuration: { targetLevels: runtime.caller.configuration.targetLevels, strategy: copy(runtime.caller.configuration.strategy),
      informationGoal: runtime.caller.configuration.informationGoal, domainLimit: runtime.caller.configuration.domain.limit },
    remaining: runtime.remaining() });
  const first = capture(), question = copy(value.snapshot.proposal.question.control_acquisition), secondCommand = copy(value.command);
  assert.equal(first.state.goal.episode.length, 1);
  value = await service.handle({ type: 'advance', sessionId, sequence: 2, ticketId: value.ticket.id,
    observation: protocol.step(value.command), executionMs: 0 });
  assert.equal(value.kind, 'boundary'); assert.equal(value.snapshot.caller.acquiredTransitions, 2);
  value = await service.handle({ type: 'resume', sessionId, sequence: 2 }); note();
  const second = capture();
  assert.equal(second.state.goal.episode.length, 2);
  assert.equal(value.snapshot.levelsCompleted, 0);
  result.setup = { elapsedMs: performance.now() - setupStart, milestones, acquiredActions: 2, completedGameLevels: 0,
    checkpoints: [first, second].map(checkpoint => ({ observationRef: checkpoint.observation.observation_ref,
      historyTransitions: checkpoint.state.goal.episode.length, callerStateSha256: hash(JSON.stringify(checkpoint.state)),
      reasoningStateSha256: hash(JSON.stringify(checkpoint.memory)), decisionSha256: hash(JSON.stringify(checkpoint.decision)) })) };

  function informationOffer(base, actionRef) {
    return { ...copy(offerTemplate), action: { action_ref: actionRef }, observation_ref: base.observation.observation_ref,
      level_epoch: base.observation.level_epoch, evidence: [base.observation.observation_ref] };
  }
  async function oneCase(id, index, census) {
    const base = id === 'parent_return' ? second : first;
    const samples = [], cloneCounts = { restoration: 0, preparation: 0, operation: 0 };
    let phase = 'restoration';
    const nativeClone = globalThis.structuredClone;
    if (census) globalThis.structuredClone = function (...args) { if (phase) cloneCounts[phase]++; return nativeClone(...args); };
    try {
      const restoredAt = performance.now(), memory = new NativeReasoningMemory({ clock: () => 0 }); memory.restore(base.memory);
      const caller = new NativeCallerCoordinator(memory, { targetLevels: base.configuration.targetLevels,
        strategy: base.configuration.strategy, informationGoal: base.configuration.informationGoal,
        domain: new ObservedInputDomain(base.configuration.domainLimit) }); caller.restore(base.state);
      const restored = performance.now(); phase = 'preparation';
      observeCaller(caller, samples, () => phase);
      const obs = base.observation, rows = base.rows, commands = caller.configuration.domain.candidates(obs);
      const sameAction = question.action_ref, otherAction = commands.find(command => command.action_ref !== sameAction).action_ref;
      const additional = informationOffer(base, id === 'same_action_information' ? sameAction : otherAction);
      if (id === 'parent_return') {
        const focus = await caller.attention.open(question, first.observation); assert.ok(focus);
        const returned = caller.attention.observe(first.observation, second.observation, { action_ref: secondCommand.actionRef }, focus.id);
        assert.equal(returned.status, 'matched');
      }
      caller.prepare(obs, base.remaining);
      if (id === 'focused_replication_proposal') {
        const deferred = await caller.informationOffer(obs, rows, commands, base.remaining,
          { meter: null, morphologyDecision: base.decision, additionalOffers: [additional] });
        assert.equal(deferred, null); assert.equal(caller.attention.item.status, 'pending');
      }
      const prepared = performance.now();
      phase = 'operation';
      const began = performance.now();
      let answer;
      if (id === 'replication_inspection') answer = await caller.acquireControlForTarget(obs, rows, commands, base.decision, { inspectOnly: true });
      else if (['replication_proposal', 'focused_replication_proposal'].includes(id)) answer = await caller.acquireControlForTarget(obs, rows, commands, base.decision);
      else if (id === 'parent_return') answer = await caller.attentionParentReturnOffer(obs, rows, commands, base.decision);
      else answer = await caller.informationOffer(obs, rows, commands, base.remaining,
        { meter: null, morphologyDecision: base.decision, additionalOffers: [additional] });
      const ended = performance.now(); phase = null;
      const semantic = { answer: projection(answer), deferred: caller.deferredCuriosity, attention: caller.attention.state(),
        parentReturn: caller.returnedAttention, currentDecision: Object.fromEntries(['status', 'reason', 'route_key'].map(key => [key, base.decision?.[key] ?? null])) };
      if (id === 'replication_inspection') assert.equal(answer.experiment, 'replicate_translation');
      if (['replication_proposal', 'focused_replication_proposal'].includes(id)) assert.equal(answer.question.control_acquisition.experiment, 'replicate_translation');
      if (id === 'unrelated_unbound_information') {
        assert.equal(answer, null); assert.equal(caller.attention.item.status, 'pending');
        assert.ok(semantic.deferred.some(row => row.reason === 'would_abandon_current_control_witness_without_bound_return'));
      }
      if (id === 'same_action_information') assert.equal(answer.question.curiosity.also_tests_current_control.action_ref, sameAction);
      if (id === 'focused_replication_proposal') assert.equal(answer.question.control_acquisition.attention_ref, caller.attention.item.id);
      if (id === 'parent_return') { assert.equal(caller.returnedAttention.status, 'matched'); assert.equal(caller.attention.item.status, 'returned'); }
      return { index, restorationMs: restored - restoredAt, preparationMs: prepared - restored,
        operationMs: ended - began, nested: samples, semantic, ...(census ? { cloneCounts } : {}) };
    } finally { globalThis.structuredClone = nativeClone; }
  }
  for (const id of CASES) {
    const row = { id, warmup: [], samples: [] }; result.cases.push(row);
    for (let index = -WARMUP; index < REPETITIONS; index++) {
      const sample = await oneCase(id, index, false); (index < 0 ? row.warmup : row.samples).push(sample);
    }
    row.census = await oneCase(id, 0, true);
    const expected = row.samples[0].semantic;
    for (const sample of [...row.warmup, ...row.samples, row.census]) assert.deepEqual(sample.semantic, expected, `${id}: fresh restoration yields the same semantic branch`);
    row.costs = Object.fromEntries(['restorationMs', 'preparationMs', 'operationMs'].map(stage => [stage, stats(row.samples.map(sample => sample[stage]))]));
    row.nestedMethods = group(row.samples.flatMap(sample => sample.nested));
    console.log(JSON.stringify({ case: id, operation: row.costs.operationMs, answer: expected.answer?.status ?? null,
      parentCurrentDecision: id === 'parent_return' ? expected.currentDecision : undefined }));
  }
  result.status = 'passed';
} catch (error) {
  result.status = 'failed'; result.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
} finally {
  const after = await nativeInventory(); result.nativeSourceUnchanged = JSON.stringify(after) === JSON.stringify(nativeBefore);
  if (!result.nativeSourceUnchanged) { result.status = 'failed'; result.nativeSourceAfter = after; process.exitCode = 1; }
  result.inputsUnchanged = true;
  for (const input of inputs) if (JSON.stringify(await fingerprint(resolve(ROOT, input.path))) !== JSON.stringify(input)) result.inputsUnchanged = false;
  if (!result.inputsUnchanged) { result.status = 'failed'; process.exitCode = 1; }
  result.finishedAt = new Date().toISOString();
  await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: result.status, output: relative(ROOT, output), nativeDigest: nativeBefore.digest,
    error: result.error?.message ?? null }));
}
