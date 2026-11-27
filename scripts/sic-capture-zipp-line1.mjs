import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { sourceBackend } from './sic-study-source-games.mjs';

const [checkout, arm, output, clock] = process.argv.slice(2);
if (!output || !['native', 'previous-epoch'].includes(arm) || (clock && clock !== '--fixed-clock')) {
  throw Error('Usage: node scripts/sic-capture-zipp-line1.mjs CHECKOUT native|previous-epoch NEW-RECEIPT.json [--fixed-clock]');
}
if (clock) Date.now = () => 1700000000000;
const git = (...args) => execFileSync('git', args, { cwd: checkout });
git('diff', '--exit-code', 'HEAD', '--', 'src', 'public', 'reference', 'scripts');
const source = git('rev-parse', 'HEAD').toString().trim();
const fixtureRef = '273b95a740a26bde3688e37a45338a624fb5450c:tests/fixtures/sic-control-zipp-public.json.gz';
const expected = JSON.parse(gunzipSync(git('show', fixtureRef)));
const at = path => import(pathToFileURL(resolve(checkout, path)).href);
const { toV6PublicObservation } = await at('src/runtime/v6-agent-protocol.ts');
const { createNativeV6Runtime } = await at('src/logos-engine/v6-native-runtime.ts');
const { V6AgentService } = await at('src/runtime/v6-agent-service.ts');
const { NativeCallerCoordinator } = await at('src/logos-engine/v6-native-caller.ts');
const { Snapshot } = await at('src/logos-engine/v6-composition-memory.ts');
const { hydrateNativeState } = await at('src/logos-engine/v6-native-state-graph.ts');
const directory = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const read = file => JSON.parse(readFileSync(resolve(checkout, directory, file)));
const runtime = await createNativeV6Runtime({ common: read('laya_proto/common_frontier_policy.drm.json'),
  strategy: read('morphology_policy/strategy.drm') }, { now: () => 0 });
const service = new V6AgentService(() => runtime);
const backend = await sourceBackend(checkout);
const { sessionId, budgets } = expected;
const observed = { source, arm, fixture: git('rev-parse', fixtureRef).toString().trim(), sessionId, budgets,
  wallClock: clock ? 1700000000000 : 'host', commands: [], ticketChains: [], decisions: [], interventions: 0 };
const historical = NativeCallerCoordinator.prototype.acquireControlForTarget;
function previous(s) {
  return new Snapshot(s.rows, s.roles, s.epoch - 1, s.score, s.ref.replace(':epoch:2:', ':epoch:1:'), s.frame_hash);
}
if (arm === 'previous-epoch') {
  NativeCallerCoordinator.prototype.acquireControlForTarget = async function (...args) {
    if (!args[0].observation_ref.includes(':epoch:2:revision:15:')) return historical.apply(this, args);
    const memory = this.goal.memory;
    const original = memory.episode;
    assert.equal(original.filter(([, a]) => a === 'ACTION2').length, 1);
    memory.episode = original.map(([a, command, b]) => command === 'ACTION2' ? [previous(a), command, previous(b)] : [a, command, b]);
    observed.interventions++;
    try { return await historical.apply(this, args); }
    finally { memory.episode = original; }
  };
}
function packet(sequence, command) {
  const board = backend.dispatch(command ? { type: 'action', actionId: Number(command.actionRef.slice(6)), data: command.data }
    : { type: 'load', code: 'ZIPP', level: 1 });
  const p = toV6PublicObservation(board, sequence);
  const { palette, ...fields } = p;
  assert.deepEqual(fields, expected.observations[sequence], 'public observation ' + sequence);
  return p;
}
let result = await service.handle({ type: 'init', sessionId, sequence: 0, budgets, observation: packet(0) });
for (let turn = 1; turn <= (arm === 'native' ? 16 : 15); turn++) {
  while (result.kind === 'boundary') result = await service.handle({ type: 'resume', sessionId, sequence: turn - 1 });
  assert.equal(result.kind, 'action');
  const { snapshot, command, ticket } = result;
  const release = snapshot.trace.findLast(e => e.kind === 'sic_native_plan');
  const guard = snapshot.trace.findLast(e => e.kind === 'before_guard');
  const acquisition = snapshot.proposal.question?.control_acquisition ?? null;
  assert.equal(command.actionRef, 'ACTION' + expected.commands[turn - 1].id);
  assert.deepEqual(command.data ?? {}, expected.commands[turn - 1].data ?? {});
  observed.commands.push({ turn, command, observation: ticket.observationRef, family: release.family, strategy: release.strategy });
  observed.ticketChains.push(ticket.graphChain);
  result = await service.handle({ type: 'advance', sessionId, sequence: turn, ticketId: ticket.id,
    observation: packet(turn, command), executionMs: 0 });
  if (turn < 15) continue;
  const outcome = result.snapshot.trace.findLast(e => e.kind === 'actual_outcome');
  const detail = { turn, ticket, guard, release, acquisition, outcome };
  if (turn === 15) {
    const graph = runtime.inspectKnowledge();
    const episode = hydrateNativeState(graph.nodes['caller:goal'].value, id => graph.nodes[id].value).episode;
    detail.measuredRoles = episode.filter(([, a]) => a === command.actionRef).map(([before, action, after]) =>
      ({ before: before.ref, after: after.ref, action, beforeRoles: before.roles, afterRoles: after.roles }));
  }
  observed.decisions.push(detail);
}
assert.equal(observed.interventions > 0, arm === 'previous-epoch');
writeFileSync(output, JSON.stringify(observed) + '\n', { flag: 'wx' });
