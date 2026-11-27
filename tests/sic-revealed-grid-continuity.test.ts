import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeFamily, NativePoint } from '../src/logos-engine/v6-native-types.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';
import { createSicNavigateRevealedGrid } from '../src/sic/navigate-revealed-grid.ts';
import { preparedEffectsId } from '../src/sic/test-prepared-effects.ts';

type Family = ReturnType<typeof createSicNavigateRevealedGrid>;
type Proposal = Parameters<Family['after']>[0];
type Packet = Pick<GameObservation, 'frame' | 'level' | 'levelsCompleted' | 'state' | 'availableActionIds'>;
type Transition = { before: Packet; after: Packet; action: number; family: string };
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-revealed-grid-public.json.gz', import.meta.url))).toString()) as {
  grids: Record<string, Proposal['local']['grid']>; learning: Transition[];
  cut: { before: Packet; after: Packet; action: number; proposal: Proposal };
};

const packet = (value: Packet): GameObservation => ({ ...value, gameCode: 'PUBLIC', levelCount: 2,
  frames: [value.frame], canUndo: false, canSelectLevel: false, defaultFps: 10 });
const publicPacket = (value: Packet, revision: number) => ({ frame_rows: value.frame, frame_packet: [value.frame], step_index: revision,
  frame_hash: 'public-grid-' + revision, level: value.level, levels_completed: value.levelsCompleted,
  state: value.state, available_action_refs: value.availableActionIds.map(id => 'ACTION' + id) });
const observe = (value: Packet, revision: number) => measureNativeObservation(publicPacket(value, revision), revision, 'public-grid-return');

function scenario(variant: boolean) {
  const ink = (value: number) => variant ? (value * 5 + 3) % 16 : value;
  const action = (id: number) => variant && (id === 3 || id === 4) ? 7 - id : id;
  const frame = ({ frame: rows, level }: Packet) => {
    const output = rows.map(row => row.map(ink));
    if (variant) {
      const grid = fixture.grids[level]!;
      for (let cell = 0; cell < grid.size; cell++) {
        const x = grid.box[0] + cell % grid.columns * grid.pitch;
        const y = grid.box[1] + Math.floor(cell / grid.columns) * grid.pitch;
        const u = grid.box[0] + (grid.columns - 1 - cell % grid.columns) * grid.pitch;
        for (let dy = 0; dy < grid.pitch; dy++) for (let dx = 0; dx < grid.pitch; dx++)
          output[y + dy]![u + dx] = ink(rows[y + dy]![x + dx]!);
      }
      // This transfer changes the public carrier from a hollow square to a cross.
      // Its location is measured from the public pixels, never from the planned walk.
      if (grid.actorPixels?.length === 8) for (let cell = 0; cell < grid.size; cell++) {
        const x = grid.box[0] + cell % grid.columns * grid.pitch;
        const y = grid.box[1] + Math.floor(cell / grid.columns) * grid.pitch;
        const u = grid.box[0] + (grid.columns - 1 - cell % grid.columns) * grid.pitch;
        if (!grid.actorPixels.every(([dx, dy]) => rows[y + dy]?.[x + dx] === grid.actor)) continue;
        for (const [dx, dy] of grid.actorPixels) output[y + dy]![u + dx] = ink(grid.base);
        for (const [dx, dy] of [[2, 1], [1, 2], [2, 2], [3, 2], [2, 3]] as const)
          output[y + dy]![u + dx] = ink(grid.actor);
      }
    }
    return output;
  };
  const transform = (value: Packet): Packet => ({ ...value, frame: frame(value) });
  return { action, learning: fixture.learning.map(step => ({ ...step, action: action(step.action),
    before: transform(step.before), after: transform(step.after) })), before: transform(fixture.cut.before), after: transform(fixture.cut.after) };
}

function carrier(rows: number[][], grid: Proposal['local']['grid']) {
  const found: number[] = [];
  for (let cell = 0; cell < grid.size; cell++) {
    const x = grid.box[0] + cell % grid.columns * grid.pitch;
    const y = grid.box[1] + Math.floor(cell / grid.columns) * grid.pitch;
    if (grid.actorPixels!.every(([dx, dy]) => rows[y + dy]?.[x + dx] === grid.actor)) found.push(cell);
  }
  assert.equal(found.length, 1, 'The public raster contains one carrier');
  return found[0]!;
}

function shift(value: Packet, grid: Proposal['local']['grid'], action: string) {
  const next = structuredClone(value), from = carrier(next.frame, grid);
  const vectors: Record<string, NativePoint> = { ACTION1: [0, -1], ACTION2: [0, 1], ACTION3: [-1, 0], ACTION4: [1, 0] };
  const vector = vectors[action];
  assert.ok(vector);
  const to = from + vector[0] + vector[1] * grid.columns;
  const at = (cell: number): NativePoint => [grid.box[0] + cell % grid.columns * grid.pitch,
    grid.box[1] + Math.floor(cell / grid.columns) * grid.pitch];
  const [x, y] = at(from), [u, v] = at(to);
  for (const [dx, dy] of grid.actorPixels!) next.frame[y + dy]![x + dx] = grid.base;
  for (const [dx, dy] of grid.actorPixels!) next.frame[v + dy]![u + dx] = grid.actor;
  return { next, from, to };
}

for (const variant of [false, true]) test('native known-grid prefix continues past an unrelated disclosure'
  + (variant ? ' after reflected positions, remapped colors, changed carrier shape and commands' : ''), async () => {
  const s = scenario(variant), family = createSicNavigateRevealedGrid();
  let used = false;
  const foreign: NativeFamily = {
    id: preparedEffectsId,
    propose(observation) {
      if (used || observation.levels_completed !== 1) return null;
      const action = { action_ref: 'ACTION' + s.action(fixture.learning.find(step => step.family === this.id)!.action), data: {} };
      return { status: 'proposed', kind: this.id, binding: { observation_ref: observation.observation_ref, level_epoch: observation.level_epoch },
        actions: [action], steps: [{ action }], sicLocalDecision: { strategy: 'public_fixture_command' } };
    },
    before: () => ({ admitted: true, reason: 'public_fixture_bound' }),
    after: () => ({ matched: null, seal_prefix: true, reason: 'public_fixture_returned' }),
    record() { used = true; return { events: [] }; }, state: () => ({ used }), restore(value) { used = value.used === true; },
  };
  const service = new V6AgentService(() => new NativeV6Runtime({ families: [family, foreign], sourceDigest: 'public-grid-continuity', maxPointOccurrences: 250,
    groups: [{ id: 'public_grid_fixture', families: [foreign.id] }, { id: 'observed_grid_route', families: [family.id] }] }));
  const sessionId = 'public-grid-native-' + variant;
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence,
    observation: toV6PublicObservation(packet(s.learning[0]!.before)), budgets: { targetLevels: 2, levelActionCaps: [80, 80] } });
  for (const step of s.learning) {
    if (!reply.ticket) reply = await service.handle({ type: 'resume', sessionId, sequence });
    assert.ok(reply.ticket);
    assert.equal(reply.ticket.actionRef, 'ACTION' + step.action, 'The role is acquired through the chronological public commands');
    reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id, executionMs: 1,
      observation: toV6PublicObservation(packet(step.after), sequence) });
  }
  const acquired = structuredClone(family.state());
  reply = await service.handle({ type: 'resume', sessionId, sequence });
  assert.ok(reply.ticket);
  const proposal = reply.snapshot.proposal as Proposal;
  assert.equal(proposal.kind, family.id);
  assert.equal(proposal.actions.length, 5);
  assert.equal(reply.ticket.actionRef, 'ACTION' + s.action(fixture.cut.action));
  assert.ok(proposal.route_refs?.includes(reply.ticket.observationRef));
  const decisionRevision = reply.ticket.decisionRevision;
  let current = s.before;
  for (let index = 0; index < proposal.actions.length; index++) {
    assert.ok(reply.ticket);
    assert.equal(reply.ticket.decisionRevision, decisionRevision);
    assert.equal(reply.ticket.actionIndex, index);
    assert.equal(reply.ticket.actionRef, proposal.actions[index]!.action_ref);
    const physical = shift(current, proposal.local.grid, reply.ticket.actionRef);
    const next = index === 0 ? s.after : physical.next;
    assert.equal(carrier(next.frame, proposal.local.grid), physical.to, 'The actual raster, not the plan, proves the translation');
    reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id, executionMs: 1,
      observation: toV6PublicObservation(packet(next), sequence) });
    const outcomes = (reply.snapshot.trace as any[]).filter(event => event.kind === 'actual_outcome' && event.family === family.id);
    const outcome = outcomes.at(-1)!;
    assert.equal(outcome.matched, true);
    assert.equal(outcome.index, index);
    assert.equal(outcome.seal_prefix, index + 1 === proposal.actions.length);
    if (index + 1 < proposal.actions.length) {
      assert.ok(reply.ticket, 'The next command is released without a new decision');
      assert.deepEqual(family.state(), acquired, 'No new terrain is acquired before reconciliation');
    }
    current = next;
  }
  const seals = (reply.snapshot.trace as any[]).filter(event => event.kind === 'sealed_prefix' && event.family === family.id
    && event.revision === decisionRevision);
  assert.equal(seals.length, 1);
  assert.equal(seals[0]!.acquired_actions, 5);
  const retained = family.state().state as Proposal['local'];
  assert.equal(retained.last.position, carrier(current.frame, proposal.local.grid));
  assert.ok(Object.keys(retained.last.memory).length > Object.keys(proposal.local.last.memory).length,
    'The unrelated disclosed cell is retained at the single reconciliation');
  await service.handle({ type: 'close', sessionId, sequence });
});

function paintCell(rows: number[][], grid: Proposal['local']['grid'], cell: number, pixels: number[][]) {
  const x = grid.box[0] + cell % grid.columns * grid.pitch;
  const y = grid.box[1] + Math.floor(cell / grid.columns) * grid.pitch;
  for (let dy = 0; dy < grid.pitch; dy++) for (let dx = 0; dx < grid.pitch; dx++) rows[y + dy]![x + dx] = pixels[dy]![dx]!;
}

for (const condition of ['known-terrain-contradiction', 'future-route-obstacle', 'ambiguous-carrier', 'wrong-displacement', 'official-boundary'] as const)
  test('a known-grid prefix still closes on ' + condition, async () => {
    const family = createSicNavigateRevealedGrid(), proposal = structuredClone(fixture.cut.proposal);
    const before = structuredClone(fixture.cut.before), after = structuredClone(fixture.cut.after), grid = proposal.local.grid;
    if (condition === 'known-terrain-contradiction') {
      const offRoute = Object.keys(proposal.local.last.memory).map(Number).find(cell => proposal.local.last.memory[cell] === 'free'
        && cell !== grid.goal && cell !== proposal.local.last.position && !proposal.walk!.some(leg => leg.target === cell)
        && !proposal.local.last.risk.includes(cell))!;
      const wall = Array.from({ length: grid.pitch }, () => Array(grid.pitch).fill(grid.base));
      wall[0]!.fill((grid.base + 7) % 16);
      paintCell(after.frame, grid, offRoute, wall);
    }
    if (condition === 'future-route-obstacle') {
      const obstacle = proposal.local.last.obstacles[0]!;
      const x = grid.box[0] + obstacle % grid.columns * grid.pitch, y = grid.box[1] + Math.floor(obstacle / grid.columns) * grid.pitch;
      const pixels = before.frame.slice(y, y + grid.pitch).map(row => row.slice(x, x + grid.pitch));
      paintCell(after.frame, grid, proposal.walk!.at(-1)!.target, pixels);
    }
    if (condition === 'ambiguous-carrier') {
      const cell = proposal.walk![1]!.target;
      const x = grid.box[0] + cell % grid.columns * grid.pitch, y = grid.box[1] + Math.floor(cell / grid.columns) * grid.pitch;
      for (const [dx, dy] of grid.actorPixels!) after.frame[y + dy]![x + dx] = grid.actor;
    }
    if (condition === 'wrong-displacement') after.frame = structuredClone(before.frame);
    if (condition === 'official-boundary') { after.level++; after.levelsCompleted++; }
    const initial = structuredClone(family.state());
    const result = await family.after(proposal, 0, await observe(before, 1), await observe(after, 2), before.frame, after.frame);
    assert.equal(result.seal_prefix, true);
    assert.equal(result.matched, !['ambiguous-carrier', 'wrong-displacement'].includes(condition));
    assert.deepEqual(family.state(), initial, 'Checking a return does not acquire or discard independent facts');
  });

test('an unreadable next carrier or a newly occupied target refuses the intermediate guard', async () => {
  const family = createSicNavigateRevealedGrid(), proposal = structuredClone(fixture.cut.proposal), grid = proposal.local.grid;
  for (const ambiguous of [false, true]) {
    const after = structuredClone(fixture.cut.after), target = proposal.walk![1]!.target;
    const x = grid.box[0] + target % grid.columns * grid.pitch, y = grid.box[1] + Math.floor(target / grid.columns) * grid.pitch;
    if (ambiguous) for (const [dx, dy] of grid.actorPixels!) after.frame[y + dy]![x + dx] = grid.actor;
    else after.frame[y]![x] = grid.enemy;
    const result = await family.before(proposal, 1, publicPacket(after, 2), await observe(after, 2));
    assert.equal(Boolean(result.admitted), false);
  }
});
