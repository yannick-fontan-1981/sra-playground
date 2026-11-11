/** Diagnostic only: no game host or learned-state initialization. Run from the
 * checkout root. Complete Window observations come from the real common runtime;
 * controlled public return rasters come from the independently generated fixture.
 */
import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { resolve, relative } from 'node:path';

const root = process.cwd(), local = name => pathToFileURL(resolve(root, name));
const { createNativeV6Runtime } = await import(local('src/logos-engine/v6-native-runtime.ts'));
const { hydrateNativeState, isNativeStateGraph } = await import(local('src/logos-engine/v6-native-state-graph.ts'));
const { decodeNativeState } = await import(local('src/logos-engine/v6-knowledge-store.ts'));
const { installWindowQuestionCapture } = await import(local('tests/helpers/v6-window-question-capture.ts'));
const commit = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e';
const pin = `reference/v6/${commit}/source/agents/yf_arc3_v6/`;
const declarations = { common: JSON.parse(await readFile(local(pin + 'laya_proto/common_frontier_policy.drm.json'))),
  strategy: JSON.parse(await readFile(local(pin + 'morphology_policy/strategy.drm'))) };
const fixturePath = 'tests/fixtures/v6-window-question-reference.json.gz';
const fixtureBytes = await readFile(local(fixturePath));
const fixture = JSON.parse(gunzipSync(fixtureBytes));
const copy = value => structuredClone(value), hash = value => createHash('sha256').update(value).digest('hex');
async function manifest() {
  const files = {};
  async function walk(path) {
    for (const entry of await readdir(local(path), { withFileTypes: true })) {
      const name = `${path}/${entry.name}`;
      if (entry.isDirectory()) await walk(name);
      else if (/\.(?:ts|json|drm)$/.test(entry.name)) files[name] = hash(await readFile(local(name)));
    }
  }
  await walk('src/logos-engine'); await walk('src/runtime');
  const ordered = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b, 'en')));
  return { digest: hash(JSON.stringify(ordered)), fileCount: Object.keys(ordered).length, files: ordered };
}
const source = await manifest();
const output = resolve(process.argv[2] ?? 'docs/migration/lot10b-evidence/recovery/diagnostic/source-call-capture/synthetic-common-runtime-02.json.gz');
const tracePath = output.replace(/\.json\.gz$/, '-public-trace.json.gz');
const report = { schema: 'logos-engine.window-question-synthetic-common-runtime.v1',
  evidenceKind: 'synthetic_common_runtime', referenceCommit: commit, game: null,
  qualification: 'Real cold production common runtime and passive collector on controlled public returns. No game host, learned-state injection, live action or official level completion. Fixture expectations only validate commands after production selection and never enter agent transport.',
  gameHostRun: false, learnedStateInjected: false, status: 'running', failure: null,
  fixture: { path: fixturePath, bytes: fixtureBytes.length, sha256: hash(fixtureBytes) },
  source, actions: [], prefixes: [], requests: [] };
const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
const window = runtime.acquisitionFamilies.window;
const capture = installWindowQuestionCapture(window, report);
const execution = { now: () => 0, deadlineMs: 360000, yieldControl: async () => {} };
const f = fixture.kernelCold, portable = fixture.kernelPortable;
const publicTrace = { schema: 'logos-engine.native-public-game-trace.v1', game: null,
  evidenceKind: 'synthetic_common_runtime', sourceDigest: source.digest, status: 'running', packets: [] };
function packet(rows, obs, frames = [rows]) {
  return { frame_rows: copy(rows), frame_packet: copy(frames), frame_hash: obs.frame_hash,
    available_action_refs: copy(obs.available_action_refs), level: obs.level_epoch,
    levels_completed: obs.levels_completed, state: obs.state, step_index: obs.revision - 1 };
}
function packetHash(packet) {
  return hash(JSON.stringify({ frame_rows: packet.frame_rows, frame_packet: packet.frame_packet,
    level: packet.level, levels_completed: packet.levels_completed, state: packet.state,
    step_index: packet.step_index, available_action_refs: packet.available_action_refs, frame_hash: packet.frame_hash }));
}
function snapshotPrefix(response) {
  const graph = runtime.inspectKnowledge();
  const read = id => {
    assert.ok(graph.nodes[id], `Missing actual node ${id}`);
    const raw = graph.nodes[id].value;
    return isNativeStateGraph(raw) ? hydrateNativeState(raw, key => graph.nodes[key]?.value) : decodeNativeState(raw);
  };
  const snapshot = response.snapshot, id = `prefix_evidence:${snapshot.prefix.revision}`, evidence = read(id);
  const facts = read('reasoning:memory').facts.map(read);
  report.prefixes.push({ id, decisionRevision: evidence.decision_revision,
    acquiredActions: evidence.transitions.length, family: snapshot.lastDecision, operations: ['OP29', 'OP30', 'OP31'],
    windowQuestion: capture.prefixSnapshot({ read, facts, transitions: evidence.transitions,
      proposal: evidence.proposal, selectedFamily: snapshot.lastDecision }) });
}
let finalObservation = f.initialObservation;
try {
  const initial = packet(f.initialRows, f.initialObservation);
  publicTrace.packets.push({ command: null, packet: copy(initial) });
  report.initial = { publicPacketSha256: packetHash(initial), state: initial.state,
    level: initial.level, levelsCompleted: initial.levels_completed };
  let response = await runtime.initialize({ sessionId: 'window:synthetic',
    observation: initial,
    budgets: { targetLevels: 3, levelActionCaps: [9, 9, 9], maxActions: 27 } }, execution);
  const stages = [
    { rows: f.editedRows, obs: f.editedObservation, command: f.foreignCommand },
    { rows: f.readyRows, obs: f.readyObservation, command: f.proposal.value.actions[0] },
    { rows: portable.newRows, obs: portable.newObservation, command: f.launch.value.actions[0],
      frames: [f.readyRows, portable.newRows] },
  ];
  for (const stage of stages) {
    assert.equal(response.kind, 'action', response.reason);
    assert.deepEqual(response.command, stage.command, 'Independent fixture validates the selected actual command only after selection');
    const previous = finalObservation, family = response.snapshot.lastDecision;
    const actualPacket = packet(stage.rows, stage.obs, stage.frames);
    publicTrace.packets.push({ command: { action_ref: response.command.action_ref, data: response.command.data ?? {} },
      packet: copy(actualPacket) });
    const returned = await runtime.advance({ command: response.command,
      observation: actualPacket, executionMs: 0 }, execution);
    finalObservation = stage.obs;
    report.actions.push({ sequence: report.actions.length + 1,
      command: { action_ref: response.command.action_ref, data: response.command.data ?? {} },
      levelBefore: previous.level_epoch, completedBefore: previous.levels_completed,
      levelAfter: stage.obs.level_epoch, completedAfter: stage.obs.levels_completed,
      state: stage.obs.state, frameHash: stage.obs.frame_hash, publicPacketSha256: packetHash(actualPacket),
      animationFrames: stage.frames?.length ?? 1, family, executionMs: 0 });
    assert.equal(returned.kind, 'boundary', returned.reason);
    snapshotPrefix(returned);
    response = await runtime.resume(execution);
  }
  report.finalUnexecutedSelection = { kind: response.kind, command: response.command,
    selectedFamily: response.snapshot.lastDecision, proposal: response.snapshot.proposal };
  assert.equal(response.kind, 'action');
  assert.equal(response.snapshot.lastDecision, 'public_window_question');
  assert.deepEqual(report.windowCaptureErrors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = { name: error.name, message: error.message, stack: error.stack };
} finally {
  report.sourceUnchangedDuringRun = source.digest === (await manifest()).digest;
  if (!report.sourceUnchangedDuringRun) report.status = 'failed';
  report.final = { actions: report.actions.length, prefixes: report.prefixes.length,
    levelsCompleted: finalObservation.levels_completed, level: finalObservation.level_epoch,
    qualification: 'Controlled fixture metadata only; these are not game achievements.' };
  capture.dispose(); runtime.close('synthetic-window-capture-complete');
  publicTrace.status = report.status;
  const traceBytes = gzipSync(JSON.stringify(publicTrace));
  await writeFile(tracePath, traceBytes, { flag: 'wx' });
  const bytes = gzipSync(JSON.stringify(report));
  assert.ok(bytes.length < 32 * 1024 * 1024);
  await writeFile(output, bytes, { flag: 'wx' });
  console.log(JSON.stringify({ status: report.status, path: relative(root, output), bytes: bytes.length,
    sha256: hash(bytes), calls: report.windowSourceCalls.length, restores: report.windowRestoreCalls.length,
    actions: report.actions.length, prefixes: report.prefixes.length, failure: report.failure,
    trace: { path: relative(root, tracePath), bytes: traceBytes.length, sha256: hash(traceBytes) } }));
}
process.exitCode = report.status === 'passed' ? 0 : 1;
