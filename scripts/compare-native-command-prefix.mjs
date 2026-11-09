/** Cold native comparison; stop before a differing archived return is supplied.
 * Expected commands and the trace stay in this outer test host. The ordinary
 * production controller receives only the public observation packet.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { gunzipSync } from 'node:zlib';

const [implementationArgument, traceArgument, outputArgument] = process.argv.slice(2);
if (!implementationArgument || !traceArgument || !outputArgument) {
  throw new Error('Usage: compare-native-command-prefix.mjs IMPLEMENTATION_ROOT ACTUAL_PUBLIC_TRACE.gz OUTPUT.json');
}
const implementation = resolve(implementationArgument), tracePath = resolve(traceArgument), outputPath = resolve(outputArgument);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function sourceManifest() {
  const files = {};
  async function visit(directory) {
    for (const item of await readdir(join(implementation, directory), { withFileTypes: true })) {
      const name = directory + '/' + item.name;
      if (item.isDirectory()) await visit(name);
      else if (/\.(ts|json|drm)$/.test(item.name)) files[name] = hash(await readFile(join(implementation, name)));
    }
  }
  await visit('src/logos-engine'); await visit('src/runtime');
  const ordered = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  return { fileCount: Object.keys(ordered).length, digest: hash(JSON.stringify(ordered)), files: ordered };
}
const sourceBefore = await sourceManifest(), traceBytes = await readFile(tracePath);
const trace = JSON.parse(gunzipSync(traceBytes)), packets = trace.packets;
assert.equal(packets[0].command, null); assert.ok(packets.length > 1);
const { BrowserV6Agent } = await import(pathToFileURL(join(implementation, 'src/runtime/v6-agent.ts')).href);
const { V6AgentService } = await import(pathToFileURL(join(implementation, 'src/runtime/v6-agent-service.ts')).href);
const { createNativeV6Runtime } = await import(pathToFileURL(join(implementation, 'src/logos-engine/v6-native-runtime.ts')).href);
const sourceDirectory = join(implementation, 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6');
const declarations = {
  common: JSON.parse(await readFile(join(sourceDirectory, 'laya_proto/common_frontier_policy.drm.json'), 'utf8')),
  strategy: JSON.parse(await readFile(join(sourceDirectory, 'morphology_policy/strategy.drm'), 'utf8')),
};
let runtime;
const service = new V6AgentService(async () => runtime = await createNativeV6Runtime(declarations));
const requests = [], matched = [], sessions = new Set(); let lastResponse;
const transport = {
  async request(operation) {
    sessions.add(operation.sessionId);
    if (operation.observation) assert.deepEqual(Object.keys(operation.observation).sort(),
      ['availableActionIds', 'frame', 'frames', 'level', 'levelsCompleted', 'state', 'stepIndex']);
    const response = await service.handle(operation); lastResponse = response;
    requests.push({ type: operation.type, sequence: operation.sequence, kind: response.kind,
      family: response.snapshot?.lastDecision ?? null, actions: response.snapshot?.actions ?? null,
      cycles: response.snapshot?.cycles ?? null, reason: response.reason ?? null });
    return response;
  }, reset() { assert.fail('One cold native session must be retained'); }, dispose() {},
};
const observation = packet => ({ gameCode: trace.game, frame: structuredClone(packet.frame_rows), frames: structuredClone(packet.frame_packet),
  state: packet.state, availableActionIds: packet.available_action_refs.map(ref => Number(ref.slice(6))),
  canUndo: false, canSelectLevel: false, level: packet.level, levelCount: 100,
  levelsCompleted: packet.levels_completed, defaultFps: 0 });
let current = observation(packets[0].packet), divergence = null, archiveExhausted = false;
const startedAt = new Date().toISOString(), start = performance.now();
const maximumCompleted = Math.max(...packets.map(item => item.packet.levels_completed));
const maximumVisibleLevel = Math.max(...packets.map(item => item.packet.level));
const agent = new BrowserV6Agent({ transport, targetLevels: Math.max(1, maximumCompleted, maximumVisibleLevel), actionsPerLevel: 600,
  getObservation: () => current, canDispatch: () => true, onState: () => {},
  dispatch: async action => {
    assert.equal(lastResponse.snapshot.whyAct.decision.decision.status, 'action_set_released');
    const index = matched.length + 1, expected = packets[index];
    if (!expected) { archiveExhausted = true; throw new Error('Archived public prefix exhausted before any extra action'); }
    const command = { action_ref: `ACTION${action.id}`, data: action.id === 6 ? { ...action.data } : {} };
    if (!isDeepStrictEqual(command, expected.command)) {
      divergence = { sequence: index, recomputedCommand: command, observedCurrentCommand: expected.command,
        baselineFamily: lastResponse.snapshot.lastDecision, baselineDecisionRevision: lastResponse.ticket.decisionRevision,
        levelBefore: current.level, levelsCompletedBefore: current.levelsCompleted,
        beforePublicPacketSha256: hash(JSON.stringify(packets[index - 1].packet)),
        baselineWhyActStatus: lastResponse.snapshot.whyAct.decision.decision.status,
        differingReturnSupplied: false };
      throw new Error('Native command divergence: stopped before supplying the differing archived return');
    }
    current = observation(expected.packet);
    matched.push({ sequence: index, command, family: lastResponse.snapshot.lastDecision,
      publicPacketSha256: hash(JSON.stringify(expected.packet)) });
    return { observation: current, executionMs: 0 };
  },
});
for (let count = 0; count < Math.max(1, maximumCompleted + 1); count++) {
  const prior = matched.length;
  await agent.run(600);
  if (divergence || archiveExhausted || matched.length === prior || agent.snapshot.status === 'error'
    || current.levelsCompleted >= maximumCompleted && matched.length === packets.length - 1) break;
}
assert.equal(sessions.size, 1);
const sourceAfter = await sourceManifest(); assert.deepEqual(sourceAfter, sourceBefore);
const report = {
  schema: 'logos-engine.native-cold-prefix-ablation.v1', startedAt, finishedAt: new Date().toISOString(), elapsedSeconds: (performance.now() - start) / 1000,
  implementationRoot: implementation, source: sourceBefore, sourceAfter, sourceUnchanged: true,
  inputs: { trace: { path: relative(process.cwd(), tracePath), sha256: hash(traceBytes), bytes: traceBytes.length },
    runner: { path: relative(process.cwd(), new URL(import.meta.url).pathname), sha256: hash(await readFile(new URL(import.meta.url))) } },
  game: trace.game, traceSourceDigest: trace.sourceDigest, traceStatus: trace.status,
  status: divergence ? 'first_command_divergence_observed' : archiveExhausted || matched.length === packets.length - 1 ? 'all_available_commands_matched' : 'baseline_stopped_before_remaining_trace',
  sessionCount: sessions.size, matchedCommands: matched.length, matched, divergence, requests,
  final: { status: agent.snapshot.status, reason: agent.snapshot.reason, message: agent.snapshot.message,
    actions: agent.snapshot.actions, cycles: agent.snapshot.cycles, level: current.level, levelsCompleted: current.levelsCompleted,
    acquiredTransitions: agent.snapshot.caller?.acquiredTransitions ?? null },
  qualification: 'One cold ordinary native controller/service session. Archived expected commands remain outside production and are compared only after a released command is independently chosen. The experiment stops before any mismatched return is supplied. No game host executes; no new live completion, full baseline failure, timing improvement or unique-cause claim follows from this bounded divergence test.',
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output: outputArgument, status: report.status, matchedCommands: report.matchedCommands, divergence, final: report.final }));
