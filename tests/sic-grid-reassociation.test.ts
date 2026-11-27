import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeFamily } from '../src/logos-engine/v6-native-types.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';
import { createSicNavigateRevealedGrid } from '../src/sic/navigate-revealed-grid.ts';
import { preparedEffectsId } from '../src/sic/test-prepared-effects.ts';

type Family = ReturnType<typeof createSicNavigateRevealedGrid>;
type Proposal = Parameters<Family['after']>[0];
type Packet = Pick<GameObservation, 'frame' | 'level' | 'levelsCompleted' | 'state' | 'availableActionIds'>;
type Transition = { before: Packet; after: Packet; action: number; family: string };
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-grid-reassociation-public.json.gz', import.meta.url))).toString()) as {
  learning: Transition[]; foreign: { before: Packet; after: Packet; action: number };
  grids: Record<number, Proposal['local']['grid']>; acquired: { state: Proposal['local'] };
};
const grid = fixture.grids[fixture.foreign.before.level]!;
const packet = (value: Packet): GameObservation => ({ ...value, gameCode: 'PUBLIC', levelCount: 4,
  frames: [value.frame], canUndo: false, canSelectLevel: false, defaultFps: 10 });
const tile = (model: typeof grid, cell: number) => [model.box[0] + cell % model.columns * model.pitch,
  model.box[1] + Math.floor(cell / model.columns) * model.pitch] as const;

function transformed(value: Packet, variant: boolean): Packet {
  if (!variant) return structuredClone(value);
  const rows = value.frame, output = rows.map(row => [...row]);
  if (value.level === fixture.foreign.before.level) {
    for (let cell = 0; cell < grid.size; cell++) {
      const [x, y] = tile(grid, cell), [u, v] = tile(grid, grid.size - 1 - cell);
      for (let dy = 0; dy < grid.pitch; dy++) for (let dx = 0; dx < grid.pitch; dx++) output[v + dy]![u + dx] = rows[y + dy]![x + dx]!;
      if (grid.actorPixels!.every(([dx, dy]) => rows[y + dy]?.[x + dx] === grid.actor)) {
        for (const [dx, dy] of grid.actorPixels!) output[v + dy]![u + dx] = grid.base;
        for (const [dx, dy] of [[2, 1], [1, 2], [2, 2]] as const) output[v + dy]![u + dx] = grid.actor;
      }
    }
  }
  return { ...value, frame: output.map(row => row.map(value => (value * 5 + 3) % 16)) };
}

for (const variant of [false, true]) test('native grid roles survive a foreign blocked step after the public level boundary'
  + (variant ? ' with rotated locations, changed colors, another carrier shape and a different command' : ''), async () => {
  const family = createSicNavigateRevealedGrid();
  const used = new Set<number>();
  const foreign: NativeFamily = {
    id: preparedEffectsId,
    propose(observation) {
      if (![1, 3].includes(observation.levels_completed) || used.has(observation.level_epoch)) return null;
      const action = { action_ref: observation.levels_completed === 3 && variant ? 'ACTION2' : 'ACTION1', data: {} };
      return { status: 'proposed', kind: this.id, binding: { observation_ref: observation.observation_ref, level_epoch: observation.level_epoch },
        actions: [action], steps: [{ action }], sicLocalDecision: { strategy: 'public_foreign_step' } };
    },
    before: () => ({ admitted: true, reason: 'public_fixture_bound' }),
    after: () => ({ matched: null, seal_prefix: true, reason: 'public_fixture_returned' }),
    record(before) { used.add(before.level_epoch); return { events: [] }; },
    state: () => ({ used: [...used] }), restore(value) { used.clear(); for (const epoch of value.used as number[]) used.add(epoch); },
  };
  const service = new V6AgentService(() => new NativeV6Runtime({ families: [family, foreign], sourceDigest: 'public-grid-reassociation', maxPointOccurrences: 250,
    groups: [{ id: 'foreign_public_command', families: [foreign.id] }, { id: 'known_grid_access', families: [family.id] }] }));
  const sessionId = 'grid-reassociation-' + variant;
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence,
    observation: toV6PublicObservation(packet(transformed(fixture.learning[0]!.before, variant))), budgets: { targetLevels: 4, levelActionCaps: [80, 80, 80, 80] } });
  for (const step of fixture.learning) {
    if (!reply.ticket) reply = await service.handle({ type: 'resume', sessionId, sequence });
    assert.ok(reply.ticket);
    assert.equal(reply.ticket.actionRef, 'ACTION' + step.action);
    reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id, executionMs: 1,
      observation: toV6PublicObservation(packet(transformed(step.after, variant)), sequence) });
  }
  const learned = structuredClone(family.state().state) as Proposal['local'];
  assert.equal(learned.score, 2);
  assert.equal(learned.epoch, 3);
  reply = await service.handle({ type: 'resume', sessionId, sequence });
  assert.ok(reply.ticket);
  assert.equal((reply.snapshot.proposal as any).kind, foreign.id);
  assert.equal(reply.ticket.actionRef, variant ? 'ACTION2' : 'ACTION1');
  const beforeRef = reply.ticket.observationRef;
  const returned = transformed(fixture.foreign.after, variant);
  reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id, executionMs: 1,
    observation: toV6PublicObservation(packet(returned), sequence) });
  const rebound = structuredClone(family.state().state) as Proposal['local'];
  assert.equal(rebound.epoch, 4);
  assert.equal(rebound.score, 3);
  assert.equal(rebound.grid.size, grid.size);
  const blocked = rebound.last.position + (variant ? rebound.grid.columns : -rebound.grid.columns);
  assert.equal(rebound.last.memory[blocked], 'wall', 'The refused step is attested by the newly visible wall');
  assert.ok(rebound.refs.includes(beforeRef));
  assert.ok(learned.refs.some(ref => rebound.refs.includes(ref)), 'The independently acquired role proof remains attached');
  reply = await service.handle({ type: 'resume', sessionId, sequence });
  assert.ok(reply.ticket);
  const proposal = reply.snapshot.proposal as Proposal;
  assert.equal(proposal.kind, family.id, 'The first useful native ticket consumes the reassociated role');
  assert.equal(reply.ticket.actionRef, 'ACTION5');
  assert.ok(proposal.route_refs?.includes(beforeRef));
  assert.ok(proposal.route_refs?.includes(rebound.refs.at(-1)!));
  assert.equal(proposal.local.last.memory[blocked], 'wall');
  // This declared synthetic disclosure validates the selected pulse, independently
  // of the real game replay: one reserve is spent and the queried cell is exposed.
  const disclosed = structuredClone(returned), [x, y] = tile(rebound.grid, proposal.choice.target);
  assert.equal(rebound.last.memory[proposal.choice.target], undefined);
  for (let dy = 0; dy < rebound.grid.pitch; dy++) for (let dx = 0; dx < rebound.grid.pitch; dx++) disclosed.frame[y + dy]![x + dx] = rebound.grid.tint;
  const charge = rebound.grid.charges.find(([u, v]) => disclosed.frame[v]![u] === rebound.grid.enemy)!;
  assert.ok(charge); disclosed.frame[charge[1]]![charge[0]] = rebound.grid.base;
  const revision = reply.ticket.decisionRevision;
  reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id, executionMs: 1,
    observation: toV6PublicObservation(packet(disclosed), sequence) });
  const trace = reply.snapshot.trace as any[];
  assert.equal(trace.findLast(event => event.kind === 'actual_outcome')?.matched, true);
  assert.equal(trace.filter(event => event.kind === 'sealed_prefix' && event.family === family.id && event.revision === revision).length, 1);
  assert.equal((family.state().state as Proposal['local']).last.memory[blocked], 'wall');
  await service.handle({ type: 'close', sessionId, sequence });
});

async function negative(condition: string) {
  const family = createSicNavigateRevealedGrid(), state = structuredClone(fixture.acquired);
  if (condition === 'missing-proof') state.state.refs = [];
  if (condition !== 'unacquired-role') family.restore(state);
  const prior = structuredClone(family.state()), first = structuredClone(fixture.foreign.before), second = structuredClone(fixture.foreign.after);
  if (condition === 'wall-absent') second.frame = structuredClone(first.frame);
  if (condition === 'ambiguous-carrier') {
    const [x, y] = tile(grid, 1);
    for (const [dx, dy] of grid.actorPixels!) second.frame[y + dy]![x + dx] = grid.actor;
  }
  if (condition === 'changed-lattice') for (let cell = 0; cell < Math.ceil(grid.size / 3); cell++) {
    const [x, y] = tile(grid, cell); second.frame[y]![x] = grid.base;
  }
  if (condition === 'changed-goal') { const [x, y] = tile(grid, grid.goal); second.frame[y]![x] = grid.base; }
  if (condition === 'new-level') second.level++;
  if (condition === 'changed-score') second.levelsCompleted++;
  const scope = state.state.refs[0]?.split(':epoch:')[0] ?? 'unacquired-grid';
  const observe = (value: Packet, revision: number, domain = scope) => measureNativeObservation({ frame_rows: value.frame,
    frame_hash: 'boundary-' + revision, level: value.level, levels_completed: value.levelsCompleted,
    state: value.state, available_action_refs: value.availableActionIds.map(id => 'ACTION' + id) }, revision, domain);
  const before = await observe(first, 61), after = await observe(second, 62, condition === 'other-session' ? 'unrelated-grid' : scope);
  const command = { action_ref: condition === 'wrong-command' ? 'ACTION4' : 'ACTION1', data: {} };
  await family.observePublicOutcome!(before, after, command, first.frame, second.frame);
  return { family, prior, before, after, command, first, second };
}

for (const condition of ['wall-absent', 'ambiguous-carrier', 'changed-lattice', 'changed-goal', 'wrong-command', 'new-level', 'changed-score', 'other-session', 'missing-proof', 'unacquired-role'])
  test('foreign grid reassociation refuses ' + condition + ' without changing independent facts', async () => {
    const result = await negative(condition);
    assert.deepEqual(result.family.state(), result.prior);
  });

test('the same foreign return is acquired once', async () => {
  const result = await negative('valid');
  assert.notDeepEqual(result.family.state(), result.prior);
  const once = structuredClone(result.family.state());
  await result.family.observePublicOutcome!(result.before, result.after, result.command, result.first.frame, result.second.frame);
  assert.deepEqual(result.family.state(), once);
});
