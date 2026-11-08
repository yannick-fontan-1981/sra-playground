/**
 * Reproduce ONLY the 32 commands physically witnessed by the saved DICO run.
 * Compare all public packets; compare the final transition's complete neutral
 * measurements with pure pinned Python observer/check functions in isolation.
 * No agent loop, further action, private state, cap change, or solution claim.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { loadPyodide } from '../../../public/vendor/pyodide/pyodide.mjs';
import { toV6PublicObservation } from '../../../src/runtime/v6-agent-protocol.ts';
import { geometricComponents, measureNativeObservation } from '../../../src/logos-engine/v6-native-observer.ts';
import { assessRetainedTransition } from '../../../src/logos-engine/v6-transition-learning.ts';

const ROOT = new URL('../../../', import.meta.url), here = new URL('.', import.meta.url);
const input = new URL('dico-before-domain-handling.json', here), bytes = await readFile(input), campaign = JSON.parse(bytes);
const hash = value => createHash('sha256').update(value).digest('hex');
const sources = Object.fromEntries(await Promise.all(['src/logos-engine/v6-native-observer.ts',
  'src/logos-engine/v6-transition-learning.ts'].map(async name => [name, hash(await readFile(new URL(name, ROOT)))])));
for (const [name, digest] of Object.entries(sources)) assert.equal(digest, campaign.source.files[name]);
function packet(raw, index) {
  const value = toV6PublicObservation({ ...raw, gameCode: raw.code ?? raw.gameCode }, index);
  return { frame_rows: value.frame, frame_packet: value.frames, level: value.level,
    levels_completed: value.levelsCompleted, state: value.state, step_index: index,
    available_action_refs: value.availableActionIds.map(id => `ACTION${id}`), frame_hash: hash(JSON.stringify(value.frame)).slice(0, 16) };
}
const native = await loadPyodide({ indexURL: new URL('public/vendor/pyodide/', ROOT).pathname, stdout() {}, stderr() {} });
await native.loadPackage(['numpy', 'pydantic', 'typing-extensions']);
for (const name of ['custom-games.zip', 'official-games.zip']) {
  const bytes = await readFile(new URL(`public/python/${name}`, ROOT)); assert.equal(hash(bytes), campaign.gameAssets[name]);
  native.unpackArchive(new Uint8Array(bytes), 'zip', { extractDir: '/games' });
}
for (const name of ['game_bridge.py', 'official_adapter.py', 'custom_level_navigation.py']) {
  const bytes = await readFile(new URL(`public/python/${name}`, ROOT)); assert.equal(hash(bytes), campaign.gameAssets[name]);
  native.FS.writeFile(`/games/${name}`, bytes.toString());
}
native.runPython("import sys\nsys.path.insert(0, '/games')\nfrom game_bridge import dispatch");
let requests = 0;
function game(request) {
  requests++; native.globals.set('_domain_witness_request', JSON.stringify(request));
  try {
    const result = JSON.parse(native.runPython('dispatch(_domain_witness_request)'));
    if (result.error) throw new Error(result.error); return result;
  } finally { native.globals.delete('_domain_witness_request'); }
}
let current = packet(game({ type: 'load', code: campaign.game, level: 1 }), 0), previous = null;
assert.equal(hash(JSON.stringify(current)), campaign.initial.publicPacketSha256);
const measurements = [{ afterSequence: 0, level: current.level, entities: geometricComponents(current.frame_rows).length }];
for (const witness of campaign.actions) {
  previous = current;
  current = packet(game({ type: 'action', actionId: Number(witness.command.action_ref.slice(6)),
    ...(witness.command.action_ref === 'ACTION6' ? { data: witness.command.data } : {}) }), witness.sequence);
  assert.equal(hash(JSON.stringify(current)), witness.publicPacketSha256, `Packet differs at ${witness.sequence}`);
  measurements.push({ afterSequence: witness.sequence, level: current.level,
    entities: geometricComponents(current.frame_rows).length,
    animationEntities: current.frame_packet.map(frame => geometricComponents(frame).length) });
}
assert.equal(requests, campaign.actions.length + 1);
const command = campaign.actions.at(-1).command;
const before = await measureNativeObservation(previous, previous.step_index + 1, 'domain-witness');
const after = await measureNativeObservation(current, current.step_index + 1, 'domain-witness');
let nativeCheck;
try { await assessRetainedTransition(before, after, command, []); nativeCheck = { accepted: true }; }
catch (error) { nativeCheck = { accepted: false, type: error.name, message: error.message, stack: error.stack }; }
const reference = new URL(`reference/v6/${campaign.referenceCommit}/source/agents/yf_arc3_v6/laya_proto/`, ROOT);
const original = JSON.parse(execFileSync('python', [new URL('dico-domain-measurement-oracle.py', here).pathname, reference.pathname], {
  input: JSON.stringify({ before: previous, after: current, command }), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
assert.deepEqual(before, original.before, 'The complete source neutral observation before must match');
assert.deepEqual(after, original.after, 'The complete source neutral observation after must match');
assert.equal(nativeCheck.accepted, original.check.accepted); assert.equal(nativeCheck.message, original.check.message);
const pythonAgentModules = JSON.parse(native.runPython("__import__('json').dumps(sorted(name for name in sys.modules if name == 'agents' or name.startswith(('agents.', 'v6_python_bridge')) or name in {'common_frontier_runtime', 'src_bridge', 'common_ordered_support', 'prospective_contact_adapter'}))"));
assert.deepEqual(pythonAgentModules, []);
const aggregate = observation => ({ entities: observation.entities.length,
  byPalette: Object.fromEntries([...new Set(observation.entities.map(entity => entity.palette_value))]
    .map(value => [value, observation.entities.filter(entity => entity.palette_value === value).length])),
  byArea: Object.fromEntries([...new Set(observation.entities.map(entity => entity.area))].sort((a, b) => a - b)
    .map(value => [value, observation.entities.filter(entity => entity.area === value).length])),
  ambiguous: observation.entities.filter(entity => entity.identity_ambiguous).length });
const witnessPath = new URL('dico-domain-public-witness.json.gz', here);
await writeFile(witnessPath, gzipSync(JSON.stringify({ before: previous, after: current, command, neutralBefore: before, neutralAfter: after })));
const report = { schema: 'logos-engine.v6.public-neutral-domain-diagnostic.v1',
  qualification: 'Only the recorded 32 game commands are replayed, with all 33 complete public packets compared. Python in the game interpreter hosts games only. A separate pure observer/check oracle consumes supplied public JSON and never runs the Python agent. No further action, private state, cap change or solution claim. The original and native complete neutral observations agree; the same limit rejects the final transition.',
  campaign: { file: input.pathname, sha256: hash(bytes), sourceDigest: campaign.source.digest, sourceFileCount: campaign.source.fileCount },
  nativeSources: sources, referenceSources: original.sourceSha256, gameAssets: campaign.gameAssets,
  replay: { commands: campaign.actions.length, checkedPackets: requests, pythonAgentModules,
    finalLevel: current.level, completedLevels: current.levels_completed, lastCommand: command },
  measurements, finalTransition: { before: aggregate(before), after: aggregate(after), maxEntities: original.maxEntities,
    fullNeutralObservationParity: true, nativeCheck, originalCheck: original.check }, witnessFile: witnessPath.pathname };
const output = new URL('dico-domain-witness-diagnostic.json', here);
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output: output.pathname, replay: report.replay, finalTransition: report.finalTransition }));
