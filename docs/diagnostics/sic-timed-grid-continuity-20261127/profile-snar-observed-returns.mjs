// CPU diagnostic against archived public returns. Does not start a game or
// qualify the original deadlines. Run from the checkout with Node 24.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { Session } from 'node:inspector/promises';
import { gunzipSync } from 'node:zlib';
import { createNativeV6Runtime } from '../../../src/logos-engine/v6-native-runtime.ts';
import { V6AgentService } from '../../../src/runtime/v6-agent-service.ts';
import { nativeV6Action, toV6PublicObservation } from '../../../src/runtime/v6-agent-protocol.ts';
import { defaultRecoveryPack } from '../../../src/sic/active-recovery.ts';

const profilerPath = process.argv[2];
assert.ok(profilerPath, 'Supply a new path for the local CPU profile.');
const [captureBytes, tailBytes, common, strategy] = await Promise.all([
  readFile(new URL('snar-level6-full-horizon-c137a9d5.json.gz', import.meta.url)),
  readFile(new URL('snar-observed-tail-161.json.gz', import.meta.url)),
  readFile('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/common_frontier_policy.drm.json', 'utf8').then(JSON.parse),
  readFile('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/strategy.drm', 'utf8').then(JSON.parse),
]);
const capture = JSON.parse(gunzipSync(captureBytes));
const tail = JSON.parse(gunzipSync(tailBytes));
const transitions = [
  ...capture.learning,
  ...capture.publicEvidence.map(({ index, action, publicBefore: before, publicAfter: after }) => ({ index, action, before, after })),
  ...tail.tail,
];
const uuid = '98d555fa-6cf9-42fc-b483-9225bfc834d9';
const sessionId = 'sra-v6-' + uuid;
crypto.randomUUID = () => uuid;
const service = new V6AgentService(recovery => createNativeV6Runtime({ common, strategy }, { recovery }));
const session = new Session();
const packet = (observation, sequence, frames = observation.frames) => toV6PublicObservation({
  gameCode: 'SNAR', levelCount: 6, canUndo: false, canSelectLevel: true, defaultFps: 10, ...observation, frames,
}, sequence);
let current = await service.handle({
  type: 'init', sessionId, sequence: 0, observation: packet(transitions[0].before, 0),
  recovery: { ...defaultRecoveryPack, solver: 'sic' },
  budgets: { targetLevels: 6, levelActionCaps: [21, 29, 28, 44, 42, 35] },
});
let started, sequence = 0;
const counts = [], commandHash = createHash('sha256');
session.connect();
try {
  for (const step of transitions) {
    if (step.before.level === 6 && started === undefined) {
      await session.post('Profiler.enable');
      await session.post('Profiler.start');
      started = performance.now();
    }
    if (current.kind === 'boundary') current = await service.handle({ type: 'resume', sessionId, sequence });
    assert.ok(current.ticket, 'Missing ticket at archived command ' + step.index);
    const action = nativeV6Action(current.command);
    assert.equal(action.id, step.action.id, 'Archived command ' + step.index);
    assert.deepEqual(action.data ?? null, step.action.data ?? null);
    commandHash.update(JSON.stringify([action.id, action.data ?? null]));
    const frames = step.after.frames ?? transitions[sequence + 1].before.frames;
    current = await service.handle({
      type: 'advance', sessionId, sequence: ++sequence, ticketId: current.ticket.id,
      observation: packet(step.after, sequence, frames), executionMs: 0,
    });
    if (step.after.levelsCompleted > step.before.levelsCompleted) counts.push(sequence);
  }
} finally {
  if (started !== undefined) {
    const { profile } = await session.post('Profiler.stop');
    await writeFile(profilerPath, JSON.stringify(profile), { flag: 'wx' });
  }
  session.disconnect();
}
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
console.log(JSON.stringify({
  diagnosticOnly: true, source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceDiffSHA256: sha256(execFileSync('git', ['diff', 'HEAD', '--', 'src'])),
  node: process.version, sequence, levelCompletionsAt: counts, commandHash: commandHash.digest('hex'),
  captures: { first: sha256(captureBytes), tail: sha256(tailBytes) },
  profiledMs: Math.round(performance.now() - started),
}));
