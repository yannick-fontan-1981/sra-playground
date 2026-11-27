// Owner-only diagnostic from the archived L8 win. Run from the repository root.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
const open = path => import(pathToFileURL(resolve(path)));

const { NativeKnowledgeStore } = await open('src/logos-engine/v6-knowledge-store.ts');
const { measureNativeObservation } = await open('src/logos-engine/v6-native-observer.ts');
const { v6FrameHash } = await open('src/runtime/v6-agent-protocol.ts');
const { createSicVerifyOrientedDelivery } = await open(process.env.WA30_PUBLIC_DIAGNOSTIC_OWNER ?? 'src/sic/oriented-delivery.ts');
const { orientedCouplingScene } = await open('src/logos-engine/v6-oriented-coupling.ts');
const { createGameDispatcher } = await open('src/runtime/native-game-dispatcher.ts');

const engine = createGameDispatcher(async () => {
  const assets = resolve(process.env.WA30_PUBLIC_DIAGNOSTIC_PYODIDE ?? 'public/vendor/pyodide');
  const { loadPyodide } = await open(resolve(assets, 'pyodide.mjs'));
  const py = await loadPyodide({ indexURL: assets, stdout: () => {}, stderr: () => {} });
  await py.loadPackage(['numpy', 'pydantic', 'typing-extensions']);
  for (const name of ['custom-games.zip', 'official-games.zip']) {
    py.unpackArchive(new Uint8Array(await readFile(resolve('public/python', name))), 'zip', { extractDir: '/games' });
  }
  for (const name of ['game_bridge.py', 'official_adapter.py', 'custom_level_navigation.py']) {
    py.FS.writeFile('/games/' + name, await readFile(resolve('public/python', name), 'utf8'));
  }
  py.runPython("import sys\nsys.path.insert(0, '/games')\nfrom game_bridge import dispatch");
  return { dispatch(request) {
    py.globals.set('_test_request', JSON.stringify(request));
    const result = JSON.parse(py.runPython('dispatch(_test_request)'));
    assert.ok(!result.error, result.error);
    return result;
  }};
});
const saves = gunzipSync(await readFile('docs/diagnostics/sic-27-wa30-20261127/wa30-last-part-public.jsonl.gz'))
  .toString().trim().split('\n').map(JSON.parse);
const [plan, result] = saves.slice(-2);
const scope = result.observation.observation_ref.split(':epoch:')[0];
const owner = createSicVerifyOrientedDelivery();
await owner.attachPrograms(new NativeKnowledgeStore('l9-owner-diagnostic', scope));
owner.restore({ state: plan.proposal.local });
await owner.record(plan.observation, result.observation, result.command, result.first, result.second, plan.proposal, result.index, []);
const getPacket = async board => ({ frame_rows: board.frame, frame_packet: board.frames,
  frame_hash: await v6FrameHash(board.frame), level: board.level,
  state: board.state, levels_completed: board.levelsCompleted,
  available_action_refs: board.availableActionIds.map(id => 'ACTION' + id) });
let board = await engine.dispatch({ type: 'load', code: 'WA30', level: 9 }), packet = await getPacket(board);
assert.equal(packet.frame_hash, result.observation.frame_hash);
assert.equal(packet.levels_completed, 8);
let observation = await measureNativeObservation(packet, result.observation.revision, scope);
let issued = 0, failure = null;
const latest = [];
while (issued < 80 && board.levelsCompleted === 8) {
  const proposal = await owner.propose(observation, board.frame, [], 80 - issued, {reasoningMode:'solving'});
  if (!proposal) {
    failure = 'owner returned no proposal';
    break;
  }
  const priorIssued = issued;
  for (const [index, action] of proposal.actions.entries()) {
    const before = await owner.before(proposal, index, packet, observation);
    if (!before.admitted) {
      latest.push({issued, rejected: before.reason, action: action.action_ref, index});
      break;
    }
    const previous = board;
    board = await engine.dispatch({ type: 'action', actionId: Number(action.action_ref.slice(6)) });
    issued++;
    packet = await getPacket(board);
    const next = await measureNativeObservation(packet, observation.revision + 1, scope);
    const outcome = await owner.after(proposal, index, observation, next, previous.frame, board.frame, board.frames);
    await owner.record(observation, next, action, previous.frame, board.frame, proposal, index, board.frames);
    const scene = orientedCouplingScene(board.frame, proposal.local.geometry, proposal.local.color);
    latest.push({ issued, index, action: action.action_ref, reason: outcome.reason, matched: outcome.matched,
      before: observation.observation_ref, after: next.observation_ref,
      purpose: proposal.sicSituationCard?.situation,
      pose: scene?.pose, face: scene?.face });
    observation = next;
    if (outcome.seal_prefix) break;
  }
  if (issued === priorIssued) {
    failure = 'first guard refused';
    break;
  }
}
const current=owner.state().state;
console.log(JSON.stringify({ issued, completed: board.levelsCompleted, failure, stopped: current?.stopped,
  peerCount: current?.transportCarriers?.length, last: latest.slice(-7) }, null, 2));
if (process.argv[2]) await writeFile(process.argv[2], latest.map(row => JSON.stringify(row)).join('\n') + '\n', { flag: 'wx' });
