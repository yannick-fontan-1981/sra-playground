import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeFamily } from '../src/logos-engine/v6-native-types.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';
import { createSicNavigateRevealedGrid } from '../src/sic/navigate-revealed-grid.ts';
import { preparedEffectsId } from '../src/sic/test-prepared-effects.ts';

type Family = ReturnType<typeof createSicNavigateRevealedGrid>;
type Proposal = Parameters<Family['after']>[0];
type Grid = Proposal['local']['grid'];
type Packet = Pick<GameObservation, 'frame' | 'level' | 'levelsCompleted' | 'state' | 'availableActionIds'>;
type Transition = { before: Packet; after: Packet; action: number; family: string };
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-timed-grid-continuity-public.json.gz', import.meta.url))).toString()) as {
  learning: Transition[]; foreign: Transition[]; walk: Transition[]; grid: Grid; acquired: { state: Proposal['local'] };
};
const tile = (grid: Grid, cell: number) => [grid.box[0] + cell % grid.columns * grid.pitch,
  grid.box[1] + Math.floor(cell / grid.columns) * grid.pitch] as const;
const action = (id: number, varied: boolean, level: number) => varied && level === fixture.walk[0]!.before.level && (id === 3 || id === 4) ? 7 - id : id;
function transform(value: Packet, varied: boolean): Packet {
  const rows = structuredClone(value.frame), grid = fixture.grid;
  if (!varied) return { ...value, frame: rows };
  if (value.level === fixture.walk[0]!.before.level) for (let cell = 0; cell < grid.size; cell++) {
    const [x, y] = tile(grid, cell), [u, v] = tile(grid, Math.floor(cell / grid.columns) * grid.columns + grid.columns - 1 - cell % grid.columns);
    for (let dy = 0; dy < grid.pitch; dy++) for (let dx = 0; dx < grid.pitch; dx++) rows[v + dy]![u + dx] = value.frame[y + dy]![x + dx]!;
    if (grid.actorPixels!.every(([dx, dy]) => value.frame[y + dy]?.[x + dx] === grid.actor)) {
      for (const [dx, dy] of grid.actorPixels!) rows[v + dy]![u + dx] = grid.base;
      for (const [dx, dy] of [[2, 1], [1, 2], [2, 2]] as const) rows[v + dy]![u + dx] = grid.actor;
    }
  }
  return { ...value, frame: rows.map(row => row.map(ink => (ink * 5 + 3) % 16)) };
}
const packet = (value: Packet, index: number) => toV6PublicObservation({ ...value, gameCode: 'PUBLIC', levelCount: 6,
  frames: [value.frame], canUndo: false, canSelectLevel: false, defaultFps: 10 }, index);

async function start(varied: boolean) {
  const family = createSicNavigateRevealedGrid(), used = new Map<number, number>();
  const before = family.before.bind(family);
  family.before = async (...args) => {
    const retained = structuredClone(family.state()), first = await before(...args), second = await before(...args);
    assert.deepEqual(first, second, 'Repeating the actual native guard gives the same admission');
    if (args[1] > 0) {
      const different = { ...args[3], observation_ref: args[3].observation_ref + ':unacquired' };
      assert.equal((await before(args[0], args[1], args[2], different)).admitted, false);
    }
    assert.deepEqual(family.state(), retained, 'Repeated guards do not publish acquired facts');
    return first;
  };
  const teachings = [...fixture.learning.filter(step => step.family !== family.id), ...fixture.foreign];
  const foreign: NativeFamily = {
    id: preparedEffectsId,
    propose(observation) {
      const step = teachings.filter(step => step.before.level === observation.level_epoch)[used.get(observation.level_epoch) ?? 0];
      if (!step) return null;
      const command = { action_ref: 'ACTION' + action(step.action, varied, step.before.level), data: {} };
      return { status: 'proposed', kind: this.id, binding: { observation_ref: observation.observation_ref, level_epoch: observation.level_epoch },
        actions: [command], steps: [{ action: command }], sicLocalDecision: { strategy: 'chronological_public_teaching' } };
    },
    before: () => ({ admitted: true, reason: 'public_return_bound' }),
    after: () => ({ matched: null, seal_prefix: true, reason: 'public_return_acquired' }),
    record(before) { used.set(before.level_epoch, (used.get(before.level_epoch) ?? 0) + 1); return { events: [] }; },
    state: () => ({ used: [...used] }), restore(value) { used.clear(); for (const [epoch, count] of value.used as number[][]) used.set(epoch!, count!); },
  };
  const runtime = new NativeV6Runtime({ families: [family, foreign], sourceDigest: 'timed-grid-native-prefix', maxPointOccurrences: 250,
    groups: [{ id: 'public_command_teaching', families: [foreign.id] }, { id: 'acquired_grid_route', families: [family.id] }] });
  const service = new V6AgentService(() => runtime), sessionId = 'timed-grid-' + varied;
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence,
    observation: packet(transform(fixture.learning[0]!.before, varied), 0), budgets: { targetLevels: 6, levelActionCaps: [80, 80, 80, 80, 80, 80] } });
  for (const step of [...fixture.learning, ...fixture.foreign]) {
    if (!reply.ticket) reply = await service.handle({ type: 'resume', sessionId, sequence });
    assert.ok(reply.ticket);
    assert.equal(reply.ticket.actionRef, 'ACTION' + action(step.action, varied, step.before.level), 'Chronological acquisition keeps the public teaching commands');
    reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id,
      executionMs: 1, observation: packet(transform(step.after, varied), sequence) });
  }
  assert.equal(reply.snapshot.acquiredRecords, 102);
  const acquired = structuredClone(family.state());
  reply = await service.handle({ type: 'resume', sessionId, sequence });
  assert.ok(reply.ticket);
  const proposal = reply.snapshot.proposal as Proposal;
  assert.equal(proposal.kind, family.id);
  assert.ok(proposal.local.timing && !proposal.local.timing.clock);
  assert.equal(proposal.actions.length, 6);
  return { family, runtime, service, sessionId, acquired, proposal, sequence, reply };
}

for (const varied of [false, true]) test('native timed-grid prefix follows each actual return without reacquiring or replanning'
  + (varied ? ' with reflected geometry, another palette, carrier and command directions' : ''), async () => {
  const run = await start(varied);
  let { reply, sequence } = run;
  const revision = reply.ticket!.decisionRevision, refs: string[] = [];
  try {
    for (const [index, step] of fixture.walk.entries()) {
      assert.ok(reply.ticket);
      assert.equal(reply.ticket.decisionRevision, revision);
      assert.equal(reply.ticket.actionIndex, index);
      assert.equal(reply.ticket.actionRef, 'ACTION' + action(step.action, varied, step.before.level));
      refs.push(reply.ticket.observationRef);
      reply = await run.service.handle({ type: 'advance', sessionId: run.sessionId, sequence: ++sequence, ticketId: reply.ticket.id,
        executionMs: 1, observation: packet(transform(step.after, varied), sequence) });
      const actual = reply.snapshot.trace.findLast(event => event.kind === 'actual_outcome');
      assert.equal(actual?.matched, true);
      assert.equal(actual?.index, index);
      assert.equal(actual?.seal_prefix, index === fixture.walk.length - 1);
      if (index < fixture.walk.length - 1) {
        assert.ok(reply.ticket);
        assert.deepEqual(run.family.state(), run.acquired, 'The guards inspect private returned evidence without publishing it early');
      }
    }
    const seals = reply.snapshot.trace.filter(event => event.kind === 'sealed_prefix' && event.revision === revision);
    assert.equal(seals.length, 1); assert.equal(seals[0]!.acquired_actions, 6);
    assert.equal(reply.snapshot.acquiredRecords, 108);
    const retained = run.family.state().state as Proposal['local'];
    assert.equal(retained.last.position, run.proposal.walk!.at(-1)!.target);
    assert.ok(retained.timing!.patrols.every(track => track.length >= 2));
    assert.ok(retained.refs.includes(refs.at(-1)!));
    assert.deepEqual(retained.completed, run.acquired.state!.completed);
  } finally { run.runtime.close('test_complete'); }
});

for (const changed of ['missing', 'ambiguous', 'wrong-displacement', 'future-hazard'] as const)
  test('timed native prefix closes on ' + changed + ' and retains prior independent navigation', async () => {
    const run = await start(false), { grid, last } = run.proposal.local;
    try {
      const returned = structuredClone(fixture.walk[0]!.after), target = run.proposal.walk![0]!.target;
      const [x, y] = tile(grid, target);
      if (changed === 'missing') for (const [dx, dy] of grid.actorPixels!) returned.frame[y + dy]![x + dx] = grid.base;
      if (changed === 'ambiguous') {
        const [u, v] = tile(grid, run.proposal.walk![1]!.target);
        for (const [dx, dy] of grid.actorPixels!) returned.frame[v + dy]![u + dx] = grid.actor;
      }
      if (changed === 'wrong-displacement') returned.frame = structuredClone(fixture.walk[0]!.before.frame);
      if (changed === 'future-hazard') {
        const [u, v] = tile(grid, run.proposal.walk![1]!.target), [a, b] = tile(grid, last.obstacles[0]!);
        for (let dy = 0; dy < grid.pitch; dy++) for (let dx = 0; dx < grid.pitch; dx++) returned.frame[v + dy]![u + dx] = fixture.walk[0]!.before.frame[b + dy]![a + dx]!;
      }
      const result = await run.service.handle({ type: 'advance', sessionId: run.sessionId, sequence: run.sequence + 1,
        ticketId: run.reply.ticket!.id, executionMs: 1, observation: packet(returned, run.sequence + 1) });
      assert.equal(result.kind, 'boundary');
      assert.equal(result.ticket, null);
      const actual = result.snapshot.trace.findLast(event => event.kind === 'actual_outcome');
      assert.equal(actual?.seal_prefix, true);
      assert.equal(result.snapshot.trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, 1);
      assert.deepEqual((run.family.state().state as Proposal['local']).completed, run.acquired.state!.completed);
    } finally { run.runtime.close('test_complete'); }
  });
