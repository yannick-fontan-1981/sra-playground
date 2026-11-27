import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeCommand, NativeProgramRegistry } from '../src/logos-engine/v6-native-types.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import { acquireCompartmentReturn, createSicVerifyCompartmentGrowth, measureCompartments, type CompartmentAcquisition } from '../src/sic/compartment-growth.ts';
import { nativeAfterPublicBoundaries } from './helpers/sic-native-public-boundaries.ts';

async function encounterRoom(variant = false) {
  const ink = (value: number) => variant ? (value * 5 + 3) % 16 : value;
  const left = variant ? 5 : 2, top = variant ? 7 : 4, width = variant ? 12 : 11;
  const at = (room: number, x: number, y: number) => [left + room * (width + 1) + x, top + y] as const;
  const gate = (index: number) => ({ x: left + (index + 1) * (width + 1) - 1, y: top + 6 });
  const command = (index: number): NativeCommand => ({ action_ref: 'ACTION6', data: gate(index) });
  const shape = variant ? [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]] : [[0, 0], [1, 0], [0, 1], [1, 1]];
  function frame(stage: number, options: { ambiguous?: boolean; changedReference?: boolean; changedLatch?: boolean; noGrowth?: boolean; entered?: boolean; encounterOnly?: boolean } = {}) {
    const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(ink(2)));
    for (let room = 0; room < 4; room++) {
      const [x, y] = at(room, 0, 0);
      for (let j = y; j < y + 17; j++) rows[j]!.fill(ink(4), x, x + width);
    }
    for (let index = 0; index < 3; index++) {
      const { x, y } = gate(index), opened = stage > index && (!options.encounterOnly || index === 2);
      for (const offset of [-2, -1, 0, 1, 2]) rows[y + offset]![x] = opened ? ink(4) : ink(offset ? 13 : 7);
    }
    for (let i = 0; i < 12; i++) rows[1]![2 + 2 * i] = ink(i < 12 - stage ? 1 : 3);
    const paint = (room: number, x: number, y: number, color: number, points = [[0, 0]]) => {
      const [l, t] = at(room, x, y);
      for (const [dx, dy] of points) rows[t + dy!]![l + dx!] = ink(color);
    };
    paint(3, 5, 11, 15, options.changedReference ? [[0, 0]] : shape);
    if (stage === 0) {
      paint(0, 2, 3, 11); paint(0, 6, 10, 11); paint(0, 8, 13, 11);
      paint(1, 3, 3, 14); paint(1, 7, 11, 14); paint(2, 5, 4, 14);
    } else if (stage === 1 || options.noGrowth) {
      paint(1, 3, 3, 12); paint(1, 7, 11, 11); paint(1, 8, 14, 11); paint(2, 5, 4, 14);
    } else {
      paint(options.entered ? 3 : 2, 3, 4, 8, shape); paint(1, 7, 11, 9);
      if (options.ambiguous) paint(1, 2, 3, 8, shape);
    }
    if (options.changedLatch) rows[gate(2).y]![gate(2).x] = ink(6);
    return rows;
  }
  const observe = (rows: number[][], revision: number, level = 1) => measureNativeObservation({ frame_rows: rows,
    frame_hash: `encounter-${variant}-${revision}`, level, levels_completed: level - 1,
    available_action_refs: ['ACTION6'], state: 'NOT_FINISHED' }, revision, 'public-encounter');
  const packet = (rows: number[][], level = 1): GameObservation => ({ gameCode: 'PUBLIC', frame: rows, frames: [rows],
    level, levelCount: 2, levelsCompleted: level - 1, availableActionIds: [6], state: 'NOT_FINISHED',
    canUndo: false, canSelectLevel: true, defaultFps: 10 });
  const family = createSicVerifyCompartmentGrowth();
  let acquisition: CompartmentAcquisition | undefined;
  await family.attachPrograms?.({ registerProgram: async () => ({ run: async () => ({ result: 'P05', receipt: {} }) }) } as unknown as NativeProgramRegistry);
  assert.equal(measureCompartments(frame(0))?.rooms.length, 4);
  for (let stage = 0; stage < 2; stage++) {
    const first = frame(stage), second = frame(stage + 1);
    const before = await observe(first, stage + 1), after = await observe(second, stage + 2);
    await family.observePublicOutcome!(before, after, command(stage), first, second);
    acquisition = acquireCompartmentReturn(acquisition, before, after, command(stage), first, second);
  }
  return { family, frame, observe, packet, command, ink, acquisition };
}

for (const variant of [false, true]) test('native encounter reuses externally observed opening and growth before a known objective' + (variant ? ' with different shapes, palette, positions and click commands' : ''), async () => {
  const room = await encounterRoom(variant), learned = room.family.state() as Record<string, any>;
  assert.ok(learned.calibration.feeding && learned.calibration.encounter);
  assert.equal(learned.model, null, 'A plausible encounter is not yet a terminal role');
  const service = new V6AgentService(() => new NativeV6Runtime({ families: [room.family], sourceDigest: 'public-encounter', maxPointOccurrences: 250 }));
  const sessionId = 'encounter-' + variant;
  const start = await service.handle({ type: 'init', sessionId, sequence: 0,
    observation: toV6PublicObservation(room.packet(room.frame(2))), budgets: { targetLevels: 1, levelActionCaps: [8] } });
  assert.ok(start.ticket);
  assert.equal(start.ticket.actionRef, 'ACTION6');
  assert.deepEqual(start.ticket.data, room.command(2).data);
  assert.equal(start.ticket.actionIndex, 0);
  assert.match(String(start.snapshot.proposal?.question?.reason), /unknown/);
  const done = await service.handle({ type: 'advance', sessionId, sequence: 1, ticketId: start.ticket.id, executionMs: 1,
    observation: toV6PublicObservation(room.packet(room.frame(3), 2), 1) });
  assert.equal(done.ticket, null);
  const trace = done.snapshot.trace as Record<string, any>[];
  assert.equal(trace.findLast(event => event.kind === 'actual_outcome')?.matched, true);
  assert.equal(trace.filter(event => event.kind === 'sealed_prefix').length, 1);
  assert.equal(trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, 1);
  const model = (room.family.state() as Record<string, any>).model;
  assert.equal(model.grower, room.ink(8));
  assert.ok(model.evidence.includes(learned.calibration.feeding.ref));
});

for (const condition of ['ambiguous', 'changedReference', 'changedLatch'] as const) test('reject unproved encounter when ' + condition, async () => {
  const room = await encounterRoom(), rows = room.frame(2, { [condition]: true });
  const proposal = await room.family.propose(await room.observe(rows, 4), rows, [], 8);
  assert.equal(proposal, null);
  assert.ok((room.family.state() as Record<string, any>).calibration.feeding, 'Keep the independently observed feeding fact');
});

test('a failed encounter is recorded once without creating a terminal role or discarding prior evidence', async () => {
  const room = await encounterRoom(), first = room.frame(2), second = room.frame(2);
  const before = await room.observe(first, 3), after = await room.observe(second, 4);
  const proposal = await room.family.propose(before, first, [], 8);
  assert.ok(proposal);
  const checked = await room.family.after(proposal, 0, before, after, first, second);
  assert.equal(checked.matched, false);
  const feeding = (room.family.state() as Record<string, any>).calibration.feeding;
  await room.family.record(before, after, proposal.actions[0]!, first, second, proposal, 0, []);
  assert.equal(await room.family.propose(after, second, [], 8), null);
  const state = room.family.state() as Record<string, any>;
  assert.deepEqual(state.calibration.feeding, feeding);
  assert.equal(state.model, null);
});

async function completedRoom(variant = false) {
  const room = await encounterRoom(variant), first = room.frame(2), second = room.frame(0);
  const before = await room.observe(first, 3), after = await room.observe(second, 4, 2);
  const frames = [room.frame(3, { entered: true }), second];
  await room.family.observePublicOutcome!(before, after, room.command(2), first, second, frames);
  const acquisition = acquireCompartmentReturn(room.acquisition, before, after, room.command(2), first, second, frames);
  assert.equal((room.family.state() as Record<string, any>).model?.completed, 1);
  assert.equal(acquisition?.model?.completed, 1);
  return { ...room, acquisition };
}

for (const variant of [false, true]) test('an external public completion keeps the encounter role for the first next-level native command' + (variant ? ' with changed shapes, colors, positions and click commands' : ''), async () => {
  const room = await completedRoom(variant), original = structuredClone((room.family.state() as Record<string, any>).model);
  const first = room.frame(2, { encounterOnly: true }), second = room.frame(0), frames = [room.frame(3, { entered: true, encounterOnly: true }), second];
  const before = await room.observe(first, 5, 2), after = await room.observe(second, 6, 3);
  await room.family.observePublicOutcome!(before, after, room.command(2), first, second, frames);
  const acquired = acquireCompartmentReturn(room.acquisition, before, after, room.command(2), first, second, frames);
  const continued = (room.family.state() as Record<string, any>).model;
  assert.equal(continued.completed, 2);
  assert.deepEqual(acquired?.model, continued, 'Both consumers keep the same independently acquired role');
  assert.ok(original.evidence.every((ref: string) => continued.evidence.includes(ref)));
  assert.ok(continued.evidence.includes(before.observation_ref) && continued.evidence.includes(after.observation_ref));
  await room.family.observePublicOutcome!(before, after, room.command(2), first, second, frames);
  assert.deepEqual((room.family.state() as Record<string, any>).model, continued, 'A duplicate victory notification adds no second event');
  assert.deepEqual(acquireCompartmentReturn(acquired, before, after, room.command(2), first, second, frames)?.model, continued);
  const { service, reply: start, sequence, sessionId } = await nativeAfterPublicBoundaries(room.family,
    { ...room.packet(second, 3), levelCount: 4 }, 'completion-' + variant);
  assert.ok(start.ticket);
  assert.equal(start.ticket.actionRef, 'ACTION6');
  assert.deepEqual(start.ticket.data, room.command(0).data);
  assert.ok(original.evidence.every((ref: string) => start.snapshot.proposal?.route_refs?.includes(ref)));
  const done = await service.handle({ type: 'advance', sessionId, sequence: sequence + 1, ticketId: start.ticket.id, executionMs: 1,
    observation: toV6PublicObservation({ ...room.packet(room.frame(1), 3), levelCount: 4 }, sequence + 1) });
  const trace = done.snapshot.trace as Record<string, any>[];
  assert.equal(trace.findLast(event => event.kind === 'actual_outcome')?.matched, true);
  assert.equal(trace.filter(event => event.kind === 'sealed_prefix').length, 3);
  assert.equal(trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, 1);
});

for (const failure of ['missing', 'ambiguous', 'contradictory', 'changedReference'] as const) test('public completion rejects ' + failure + ' encounter frames without discarding the learned role', async () => {
  const room = await completedRoom(), first = room.frame(2, { encounterOnly: true }), second = room.frame(0);
  const original = structuredClone((room.family.state() as Record<string, any>).model);
  const before = await room.observe(first, 5, 2), after = await room.observe(second, 6, 3);
  const returned = room.frame(3, { encounterOnly: true, entered: failure !== 'contradictory', ambiguous: failure === 'ambiguous', changedReference: failure === 'changedReference' });
  const frames = failure === 'missing' ? [] : [returned];
  await room.family.observePublicOutcome!(before, after, room.command(2), first, second, frames);
  assert.deepEqual((room.family.state() as Record<string, any>).model, original);
  assert.deepEqual(acquireCompartmentReturn(room.acquisition, before, after, room.command(2), first, second, frames)?.model, original);
});

test('the new-level raster cannot confirm an old encounter even when it coincides with the expected return', async () => {
  const room = await completedRoom(), first = room.frame(2, { encounterOnly: true });
  const second = room.frame(3, { encounterOnly: true, entered: true }), frames = [structuredClone(second)];
  const original = structuredClone((room.family.state() as Record<string, any>).model);
  const before = await room.observe(first, 5, 2), after = await room.observe(second, 6, 3);
  await room.family.observePublicOutcome!(before, after, room.command(2), first, second, frames);
  assert.deepEqual((room.family.state() as Record<string, any>).model, original);
  assert.deepEqual(acquireCompartmentReturn(room.acquisition, before, after, room.command(2), first, second, frames)?.model, original);
});
