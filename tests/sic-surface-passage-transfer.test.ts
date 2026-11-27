import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeFamily, NativePoint, NativeRows } from '../src/logos-engine/v6-native-types.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';
import { measureSurface, type SurfaceRoles } from '../src/sic/observed-surfaces.ts';
import { createSicSwitchedSurface } from '../src/sic/switched-surface.ts';
import { preparedEffectsId } from '../src/sic/test-prepared-effects.ts';

type Packet = Pick<GameObservation, 'frame' | 'level' | 'levelsCompleted' | 'state' | 'availableActionIds'>;
type Transition = { before: Packet; after: Packet; action: { id: number } };
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-surface-passage-public.json.gz', import.meta.url))).toString()) as {
  learning: Transition[]; crossing: Transition; roles: SurfaceRoles;
};

function scenario(variant = false) {
  const roles = fixture.roles, source = measureSurface(fixture.crossing.before.frame, roles)!;
  const landing = measureSurface(fixture.crossing.after.frame, roles)!;
  const paint = (rows: number[][], cell: NativePoint, color: number) => {
    const [x, y] = [roles.origin[0] + cell[0] * roles.pitch + 1, roles.origin[1] + cell[1] * roles.pitch + 1];
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) rows[y + dy]![x + dx] = color;
  };
  const before = structuredClone(fixture.crossing.before), after = structuredClone(fixture.crossing.after);
  before.level = after.level = 2; before.levelsCompleted = after.levelsCompleted = 1;
  // A different public target placement makes the observed return passage immediately useful.
  const goal: NativePoint = [source.address.cell[0] + 1, source.address.cell[1]];
  assert.ok(source.surface.free.includes(goal.join(',')));
  paint(before.frame, source.surface.goal!, roles.support); paint(before.frame, goal, roles.goal);
  const returned = structuredClone(before);
  paint(returned.frame, source.address.cell, roles.support); paint(returned.frame, landing.address.cell, roles.actor);
  const ink = (value: number) => variant ? (value * 5 + 3) % 16 : value;
  const bottom = roles.origin[1] + Math.floor((before.frame.length - roles.origin[1]) / roles.pitch) * roles.pitch;
  const frame = (rows: NativeRows) => rows.map((row, y) =>
    [...rows[variant && y < bottom ? bottom - 1 - y : y]!].map(ink));
  const transform = (packet: Packet): Packet => ({ ...packet, frame: frame(packet.frame) });
  const action = (id: number) => variant && (id === 1 || id === 2) ? 3 - id : id;
  const packet = (p: Packet): GameObservation => ({ ...p, gameCode: 'PUBLIC', levelCount: 2,
    frames: [p.frame], canUndo: false, canSelectLevel: false, defaultFps: 10 });
  const learning = fixture.learning.map((step, index) => ({
    before: transform(step.before), after: transform(index === fixture.learning.length - 1 ? before : step.after), action: action(step.action.id),
  }));
  return { learning, before: transform(before), after: transform(after), returned: transform(returned), packet, action,
    roles: { ...roles, actor: ink(roles.actor), goal: ink(roles.goal), support: ink(roles.support), gap: ink(roles.gap) } };
}

for (const variant of [false, true]) test('native transfer retains an externally executed surface passage and reuses it on the first useful ticket'
  + (variant ? ' with mirrored rooms, new colors, positions and commands' : ''), async () => {
  const s = scenario(variant), family = createSicSwitchedSurface();
  let used = false;
  const foreign: NativeFamily = {
    id: preparedEffectsId,
    async propose(observation) {
      if (used || observation.levels_completed !== 1) return null;
      const action = { action_ref: 'ACTION' + s.action(fixture.crossing.action.id), data: {} };
      return { status: 'proposed', kind: this.id, binding: { observation_ref: observation.observation_ref, level_epoch: observation.level_epoch },
        actions: [action], steps: [{ action }], sicLocalDecision: { strategy: 'observe_public_passage' } };
    },
    before: () => ({ admitted: true, reason: 'public_fixture_bound' }),
    after: () => ({ matched: true, seal_prefix: true, reason: 'public_fixture_returned' }),
    record() { used = true; return { events: [] }; }, state: () => ({ used }), restore(value) { used = value.used === true; },
  };
  const service = new V6AgentService(() => new NativeV6Runtime({ families: [family, foreign], sourceDigest: 'public-surface-passage', maxPointOccurrences: 250,
    groups: [{ id: 'public_surface_fixture', families: [foreign.id] }, { id: 'existing_surface_navigation', families: [family.id] }] }));
  const sessionId = 'public-surface-native-' + variant;
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence,
    observation: toV6PublicObservation(s.packet(s.learning[0]!.before)), budgets: { targetLevels: 2, levelActionCaps: [80, 80] } });
  for (const step of s.learning) {
    if (!reply.ticket) reply = await service.handle({ type: 'resume', sessionId, sequence });
    assert.ok(reply.ticket); assert.equal(reply.ticket.actionRef, 'ACTION' + step.action);
    reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id, executionMs: 1,
      observation: toV6PublicObservation(s.packet(step.after), sequence) });
  }
  const learned = structuredClone(family.state().witness) as any;
  assert.equal(learned.score, 1, 'The role is acquired by actual native commands and the official first-level score');
  reply = await service.handle({ type: 'resume', sessionId, sequence });
  assert.ok(reply.ticket); assert.equal((reply.snapshot.proposal as any).kind, foreign.id);
  const beforeRef = reply.ticket.observationRef;
  reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id, executionMs: 1,
    observation: toV6PublicObservation(s.packet(s.after), sequence) });
  const acquired = structuredClone(family.state().mapped) as any;
  const first = measureSurface(s.before.frame, s.roles)!, next = measureSurface(s.after.frame, s.roles)!;
  assert.equal(Object.keys(acquired.memory.floors).length, 2);
  assert.deepEqual(acquired.memory.floors[first.address.floor].goal, first.surface.goal);
  assert.deepEqual(acquired.memory.links[first.address.floor + '/' + next.address.cell.join(',')], next.address);
  assert.ok(acquired.refs.includes(beforeRef));
  assert.deepEqual(family.state().witness, learned, 'An external command cannot replace the independent role proof');
  reply = await service.handle({ type: 'resume', sessionId, sequence });
  assert.ok(reply.ticket);
  const proposal = reply.snapshot.proposal as any;
  assert.equal(proposal.kind, family.id);
  assert.equal(reply.ticket.actionRef, 'ACTION' + s.action(2));
  assert.equal(proposal.transfer.plan.kind, 'linked');
  assert.equal(proposal.transfer.plan.expected.floor, first.address.floor);
  assert.ok(proposal.route_refs.includes(beforeRef));
  assert.ok(proposal.route_refs.includes(acquired.refs.at(-1)));
  reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id, executionMs: 1,
    observation: toV6PublicObservation(s.packet(s.returned), sequence) });
  const trace = reply.snapshot.trace as any[];
  assert.equal(trace.findLast(event => event.kind === 'actual_outcome')?.matched, true);
  assert.equal(trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, 1);
  assert.deepEqual(family.state().witness, learned);
  await service.handle({ type: 'close', sessionId, sequence });
});

async function acquiredPassage() {
  const s = scenario(), family = createSicSwitchedSurface();
  let revision = 0;
  const observe = (p: Packet, scope = 'public-surface-negative') => measureNativeObservation({ frame_rows: p.frame,
    frame_hash: 'surface-' + ++revision, level: p.level, levels_completed: p.levelsCompleted,
    available_action_refs: p.availableActionIds.map(id => 'ACTION' + id), state: p.state }, revision, scope);
  for (const step of s.learning) {
    const before = await observe(step.before), after = await observe(step.after);
    const proposal = await family.propose(before, step.before.frame, [], 80);
    assert.ok(proposal); assert.equal(proposal.actions[0]!.action_ref, 'ACTION' + step.action);
    await family.record(before, after, proposal.actions[0]!, step.before.frame, step.after.frame, proposal, 0, []);
  }
  const before = await observe(s.before), after = await observe(s.after), command = { action_ref: 'ACTION1', data: {} };
  await family.observePublicOutcome!(before, after, command, s.before.frame, s.after.frame);
  assert.ok(family.state().mapped);
  return { s, family, observe, before, after, command };
}

test('one foreign passage is retained once, and its reverse is attributed at the observed gate', async () => {
  const s = await acquiredPassage(), prior = structuredClone(s.family.state());
  await s.family.observePublicOutcome!(s.before, s.after, s.command, s.s.before.frame, s.s.after.frame);
  assert.deepEqual(s.family.state(), prior);
  const returned = await s.observe(s.s.returned);
  await s.family.observePublicOutcome!(s.after, returned, { action_ref: 'ACTION2', data: {} }, s.s.after.frame, s.s.returned.frame);
  const view = measureSurface(s.s.after.frame, s.s.roles)!, landing = measureSurface(s.s.returned.frame, s.s.roles)!;
  const retained = s.family.state().mapped as any;
  assert.deepEqual(retained.memory.steps[view.address.floor + '/' + view.address.cell.join(',') + '/1'], landing.address);
  assert.deepEqual(s.family.state().witness, prior.witness);
});

for (const condition of ['ambiguous-actor', 'contradictory-command', 'unpaired-gate', 'new-level', 'other-session'] as const)
  test('a foreign passage rejects ' + condition + ' while preserving independent acquired facts', async () => {
    const s = await acquiredPassage(), prior = structuredClone(s.family.state()), changed = structuredClone(s.s.after);
    const view = measureSurface(changed.frame, s.s.roles)!;
    if (condition === 'ambiguous-actor') {
      const cell = view.surface.free.map(key => key.split(',').map(Number) as NativePoint).find(cell => cell.join(',') !== view.address.cell.join(','))!;
      const [x, y] = [s.s.roles.origin[0] + cell[0] * s.s.roles.pitch + 1, s.s.roles.origin[1] + cell[1] * s.s.roles.pitch + 1];
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) changed.frame[y + dy]![x + dx] = s.s.roles.actor;
    }
    if (condition === 'unpaired-gate') {
      const [x, y] = [s.s.roles.origin[0] + view.address.cell[0] * s.s.roles.pitch, s.s.roles.origin[1] + view.address.cell[1] * s.s.roles.pitch];
      changed.frame[y - 1]![x] = s.s.roles.support;
    }
    if (condition === 'new-level') { changed.level++; changed.levelsCompleted++; }
    const after = await s.observe(changed, condition === 'other-session' ? 'unrelated-surface-session' : undefined);
    const command = condition === 'contradictory-command' ? { action_ref: 'ACTION4', data: {} } : s.command;
    await s.family.observePublicOutcome!(s.before, after, command, s.s.before.frame, changed.frame);
    assert.deepEqual(s.family.state(), prior);
  });

test('a public crossing cannot invent an unacquired surface role', async () => {
  const s = await acquiredPassage(), family = createSicSwitchedSurface(), empty = structuredClone(family.state());
  await family.observePublicOutcome!(s.before, s.after, s.command, s.s.before.frame, s.s.after.frame);
  assert.deepEqual(family.state(), empty);
});
