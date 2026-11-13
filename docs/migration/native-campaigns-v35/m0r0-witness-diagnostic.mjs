/**
 * Replay only commands already physically witnessed by the saved M0R0 campaign.
 * This is a public-observation diagnostic, NOT a new agent/game solution run.
 * Usage from any directory: node path/to/m0r0-witness-diagnostic.mjs
 * Python hosts game engines only. No private game object or Python agent is read.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { loadPyodide } from '../../../public/vendor/pyodide/pyodide.mjs';
import { toV6PublicObservation } from '../../../src/runtime/v6-agent-protocol.ts';
import { CoupledPairEvidenceMemory } from '../../../src/logos-engine/v6-coupled-pair-evidence.ts';
import { measureCoupledPairs, matchCoupledPair } from '../../../src/logos-engine/v6-coupled-pair-observation.ts';
import { proposeCoupledPairGraph } from '../../../src/logos-engine/v6-coupled-pair-planning.ts';
import { auxiliarySupportControls, auxiliarySupportCurrentPair, auxiliarySupportOccurrences,
  auxiliarySupportSelectQuestion } from '../../../src/logos-engine/v6-auxiliary-support-preparation.ts';

const ROOT = new URL('../../../', import.meta.url), here = new URL('.', import.meta.url);
const input = new URL('m0r0-before-native-checkpoint.json', here);
const bytes = await readFile(input), campaign = JSON.parse(bytes);
const hash = value => createHash('sha256').update(value).digest('hex');
const strategyPath = `reference/v6/${campaign.referenceCommit}/source/agents/yf_arc3_v6/morphology_policy/strategy.drm`;
const config = JSON.parse(await readFile(new URL(strategyPath, ROOT), 'utf8')).declarations[0].configuration.coupled_support_composition;
const sourceFiles = ['src/logos-engine/v6-coupled-pair-evidence.ts', 'src/logos-engine/v6-coupled-pair-observation.ts',
  'src/logos-engine/v6-coupled-pair-planning.ts', 'src/logos-engine/v6-coupled-pair-route.ts',
  'src/logos-engine/v6-auxiliary-support-preparation.ts'];
const sources = Object.fromEntries(await Promise.all(sourceFiles.map(async name => [name, hash(await readFile(new URL(name, ROOT)))])));
for (const [name, digest] of Object.entries(sources)) assert.equal(digest, campaign.source.files[name], `Diagnostic changed compared with campaign: ${name}`);
function packet(raw, index) {
  const publicObservation = toV6PublicObservation({ ...raw, gameCode: raw.code ?? raw.gameCode }, index);
  return { frame_rows: publicObservation.frame, frame_packet: publicObservation.frames,
    level: publicObservation.level, levels_completed: publicObservation.levelsCompleted,
    state: publicObservation.state, step_index: index,
    available_action_refs: publicObservation.availableActionIds.map(id => `ACTION${id}`),
    frame_hash: hash(JSON.stringify(publicObservation.frame)).slice(0, 16) };
}
const packetHash = packet => hash(JSON.stringify(packet));
const observed = packet => ({ revision: packet.step_index + 1, level_epoch: packet.level,
  levels_completed: packet.levels_completed, state: packet.state, available_action_refs: packet.available_action_refs,
  observation_ref: `witness-diagnostic:${packet.step_index}:${packet.frame_hash}`, frame_hash: packet.frame_hash });
const native = await loadPyodide({ indexURL: new URL('public/vendor/pyodide/', ROOT).pathname, stdout() {}, stderr() {} });
await native.loadPackage(['numpy', 'pydantic', 'typing-extensions']);
for (const name of ['custom-games.zip', 'official-games.zip']) {
  const bytes = await readFile(new URL(`public/python/${name}`, ROOT));
  assert.equal(hash(bytes), campaign.gameAssets[name]);
  native.unpackArchive(new Uint8Array(bytes), 'zip', { extractDir: '/games' });
}
for (const name of ['game_bridge.py', 'official_adapter.py', 'custom_level_navigation.py']) {
  const bytes = await readFile(new URL(`public/python/${name}`, ROOT));
  assert.equal(hash(bytes), campaign.gameAssets[name]);
  native.FS.writeFile(`/games/${name}`, bytes.toString());
}
native.runPython("import sys\nsys.path.insert(0, '/games')\nfrom game_bridge import dispatch");
const hostRequests = [];
function game(request) {
  hostRequests.push(request); native.globals.set('_witness_request', JSON.stringify(request));
  try {
    const result = JSON.parse(native.runPython('dispatch(_witness_request)'));
    if (result.error) throw new Error(result.error); return result;
  } finally { native.globals.delete('_witness_request'); }
}
function controlsSummary(state, available) {
  if (!state) return null;
  const signs = [new Set(), new Set()], firstDeltas = {};
  for (const [action, samples] of Object.entries(state.samples)) {
    firstDeltas[action] = [...new Set(samples.filter(sample => sample.deltas[0].some(v => v !== 0)).map(sample => JSON.stringify(sample.deltas[0])))].map(value => JSON.parse(value));
    for (const sample of samples) for (const axis of [0, 1]) {
      const [first, second] = [sample.deltas[0][axis], sample.deltas[1][axis]];
      if (first && second && Math.abs(first) === Math.abs(second)) signs[axis].add(first * second > 0 ? 1 : -1);
    }
  }
  return { rawAxisSigns: signs.map(values => [...values]), distinctNonzeroFirstDeltas: firstDeltas,
    admitted: auxiliarySupportControls(state, available) };
}
function planningSummary(state, current, remaining) {
  if (!state) return { reason: 'no_current_pair_state' };
  const rows = current.frame_rows, available = current.available_action_refs;
  const pair = auxiliarySupportCurrentPair(rows, state.pair);
  const cfg = { ...config, remaining_level_actions: remaining };
  const ordinary = proposeCoupledPairGraph(state, observed(current), rows, [], 16, cfg);
  const auxiliary = auxiliarySupportSelectQuestion(rows, state, available, remaining, []);
  return { currentPair: pair, floors: state.floors, unresolved: state.unresolved ?? null,
    refusedCount: state.refused.length, controls: controlsSummary(state, available),
    compactOccurrences: state.floors.length === 1 && pair ? auxiliarySupportOccurrences(rows, pair, state.floors[0]) : [],
    ordinaryProposal: ordinary, auxiliarySelectionQuestion: auxiliary };
}
const pairs = new CoupledPairEvidenceMemory(), transitions = [], checkpoints = [];
let current = packet(game({ type: 'load', code: campaign.game, level: 1 }), 0), checkedPackets = 1;
assert.equal(packetHash(current), campaign.initial.publicPacketSha256);
let level4Actions = 0, pairEvents = 0, epochAnchors = 0;
for (const witness of campaign.actions) {
  const first = current;
  current = packet(game({ type: 'action', actionId: Number(witness.command.action_ref.slice(6)),
    ...(witness.command.action_ref === 'ACTION6' ? { data: witness.command.data } : {}) }), witness.sequence);
  assert.equal(packetHash(current), witness.publicPacketSha256, `Public packet mismatch at ${witness.sequence}`);
  checkedPackets++;
  if (current.level === 4 && first.level !== 4) checkpoints.push({ afterSequence: witness.sequence,
    reason: 'natural_level_4_entry', measuredPairs: measureCoupledPairs(current.frame_rows), frame: current.frame_rows });
  if (first.level !== 4) continue;
  assert.equal(witness.family, 'observed_frontier', 'This diagnostic only reconstructs passive L4 pair acquisition');
  level4Actions++;
  const beforeState = pairs.currentState(), measuredBefore = measureCoupledPairs(first.frame_rows), measuredAfter = measureCoupledPairs(current.frame_rows);
  const events = pairs.record(observed(first), witness.command, observed(current), first.frame_rows, current.frame_rows, {}, 0);
  pairEvents += events.filter(event => event.kind === 'coupled_pair_evidence').length;
  epochAnchors += events.filter(event => event.kind === 'coupled_pair_epoch_anchor').length;
  const state = pairs.currentState();
  const matches = measuredBefore.flatMap(before => measuredAfter.filter(after => before.value === after.value && before.size === after.size)
    .map(after => ({ before, after, match: matchCoupledPair(before, after) })));
  transitions.push({ sequence: witness.sequence, command: witness.command, beforeFrameHash: first.frame_hash,
    afterFrameHash: current.frame_hash, measuredBefore, measuredAfter, matches,
    events: events.map(event => event.kind), pair: state?.pair ?? null, floors: state?.floors ?? null,
    latestSample: state?.samples[witness.command.action_ref]?.at(-1) ?? null,
    controls: controlsSummary(state, current.available_action_refs), pairStateAlreadyExisted: Boolean(beforeState) });
  if (level4Actions <= 4 || witness.sequence === campaign.actions.at(-1).sequence) checkpoints.push({
    afterSequence: witness.sequence, reason: level4Actions <= 4 ? 'initial_control_response' : 'final_observed_response',
    planning: planningSummary(state, current, 600 - level4Actions), frame: current.frame_rows });
}
assert.equal(hostRequests.length, campaign.actions.length + 1);
assert.equal(hostRequests.filter(request => request.type === 'load').length, 1);
const pythonAgentModules = JSON.parse(native.runPython("__import__('json').dumps(sorted(name for name in sys.modules if name == 'agents' or name.startswith(('agents.', 'v6_python_bridge')) or name in {'common_frontier_runtime', 'src_bridge', 'common_ordered_support', 'prospective_contact_adapter'}))"));
assert.deepEqual(pythonAgentModules, []);
const output = { schema: 'logos-engine.v6.public-witness-diagnostic.v1',
  qualification: 'Only the 151 commands already physically observed in the saved failed campaign are replayed. All 152 public packets including animation frames are compared with their recorded SHA256. This is not a new agent run, an additional attempt, or a success claim. No private game state is read. Pair acquisition is independently reconstructed for level 4 with diagnostic evidence labels; it is not a global journal/digest parity claim. Prior auxiliary models are not reconstructed; the selection question for a fresh epoch is assessed before the branch that consumes them.',
  campaignFile: input.pathname, campaignSha256: hash(bytes), campaignSource: campaign.source.digest,
  diagnosticSources: sources, gameAssets: campaign.gameAssets,
  replay: { observedCommands: campaign.actions.length, hostRequests: hostRequests.length, checkedPackets, pythonAgentModules,
    finalLevel: current.level, finalLevelsCompleted: current.levels_completed, finalState: current.state },
  level4: { actions: level4Actions, pairEvents, epochAnchors, transitions, checkpoints,
    finalPairState: pairs.currentState() } };
const destination = new URL('m0r0-witness-diagnostic.json', here);
await writeFile(destination, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ output: destination.pathname, replay: output.replay, level4: {
  actions: level4Actions, pairEvents, epochAnchors, initialFour: transitions.slice(0, 4),
  finalPlanning: checkpoints.at(-1).planning } }));
