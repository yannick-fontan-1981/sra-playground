import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { measureExposedReception } from '../src/logos-engine/v6-exposed-reception-observation.ts';
import { toV6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import { createSicDirectionalReception } from '../src/sic/directional-reception.ts';
import { continueRoleAfterPublicCompletion, publicCompletionFrames } from '../src/sic/observed-role-completion.ts';
import { receptionRaster, type ReceptionRasterOptions } from './helpers/v6-exposed-reception-raster.ts';
import { nativeAfterPublicBoundaries } from './helpers/sic-native-public-boundaries.ts';

async function witnessedReception(variant = false) {
  const pitch = variant ? 5 : 4, row = variant ? 3 : 2, bodyX = variant ? 3 : 4;
  const action_ref = variant ? 'ACTION2' : 'ACTION4';
  const ink = (value: number) => variant ? (value * 5 + 3) % 16 : value;
  const draw = (options: ReceptionRasterOptions) => receptionRaster({ pitch, ...options }).map(line => line.map(ink));
  const first = draw({ actor: [1, row], bodies: [{ pos: [bodyX, row], color: 7 }], slots: [{ pos: [bodyX + 1, row], color: 7 }], activeDial: 4 });
  const filled = draw({ actor: [2, row], bodies: [{ pos: [bodyX + 1, row], color: 7 }], slots: [{ pos: [bodyX + 1, row], color: 7 }], activeDial: 4 });
  const nextActor: [number, number] = variant ? [3, 3] : [2, 3];
  const nextBody: [number, number] = [nextActor[0], 2], nextGoal: [number, number] = [nextBody[0] + 1, nextBody[1]];
  const next = draw({ actor: nextActor, bodies: [{ pos: nextBody, color: 7 }], slots: [{ pos: nextGoal, color: 7 }], activeDial: 4 });
  const returned = draw({ actor: [nextActor[0] + 1, nextActor[1]], bodies: [{ pos: nextGoal, color: 7 }], slots: [{ pos: nextGoal, color: 7 }], activeDial: 4 });
  const packet = (frame: number[][], level: number, frames = [frame]): GameObservation => ({ gameCode: 'PUBLIC', frame, frames,
    level, levelsCompleted: level - 1, levelCount: 4, availableActionIds: [Number(action_ref.slice(6)), 6], state: 'NOT_FINISHED',
    canUndo: false, canSelectLevel: true, defaultFps: 10 });
  const observe = (frame: number[][], revision: number, level: number) => measureNativeObservation({ frame_rows: frame,
    frame_hash: `public-reception-${variant}-${revision}`, level, levels_completed: level - 1,
    available_action_refs: [action_ref, 'ACTION6'], state: 'NOT_FINISHED' }, revision, 'public-reception');
  const scene = measureExposedReception(first);
  assert.ok(scene);
  const family = createSicDirectionalReception();
  // A restored witness stands for prior public control and color measurements.
  // Only the newly supplied public rasters may establish the next completion.
  family.restore!({ known: { completed: 1, pitch, directions: { [action_ref]: [1, 0] }, ref: 'measured-east-motion', evidence: ['independent-control-proof'] },
    photo: { epoch: 2, shadow: ink(6), lit: ink(7), ref: 'measured-light-change' },
    state: { epoch: 2, layout: scene.layout, directions: { [action_ref]: [1, 0] }, coupled: [], tried: [],
      evidence: ['measured-orientation'], count: 1 }, exposure: null, coupling: null });
  return { family, first, filled, next, returned, draw, packet, observe, action: { action_ref, data: {} }, pitch, ink, row, bodyX };
}

for (const variant of [false, true]) test('public receiver completion reuses retained motion in the first native next-level ticket' + (variant ? ' with another body shape, palette, positions and command' : ''), async () => {
  const testCase = await witnessedReception(variant), { family, first, filled, next, action } = testCase;
  const before = await testCase.observe(first, 8, 2), after = await testCase.observe(next, 9, 3);
  await family.observePublicOutcome!(before, after, action, first, next, [filled, next]);
  const known = structuredClone(family.state().known) as Record<string, any>;
  assert.equal(known.completed, 2);
  for (const ref of ['independent-control-proof', 'measured-east-motion', 'measured-light-change', 'measured-orientation', before.observation_ref, after.observation_ref]) assert.ok(known.evidence.includes(ref));
  await family.observePublicOutcome!(before, after, action, first, next, [filled, next]);
  assert.deepEqual(family.state().known, known, 'A repeated completion does not create another acquisition');
  const { service, reply: started, sequence, sessionId } = await nativeAfterPublicBoundaries(family,
    testCase.packet(next, 3), 'reception-transfer-' + variant);
  assert.ok(started.ticket);
  assert.equal(started.ticket.actionRef, action.action_ref);
  assert.equal(started.snapshot.proposal?.sicSituationCard?.strategy, 'move_with_adjacent_piece');
  for (const ref of ['independent-control-proof', 'measured-east-motion', 'measured-light-change']) assert.ok(started.snapshot.proposal?.route_refs?.includes(ref));
  const done = await service.handle({ type: 'advance', sessionId, sequence: sequence + 1, ticketId: started.ticket.id, executionMs: 1,
    observation: toV6PublicObservation(testCase.packet(testCase.returned, 4), sequence + 1) });
  assert.equal(done.ticket, null);
  const trace = done.snapshot.trace as Record<string, any>[];
  assert.equal(trace.findLast(event => event.kind === 'actual_outcome')?.matched, true);
  assert.equal(trace.filter(event => event.kind === 'sealed_prefix').length, 3);
  assert.equal(trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, 1);
  const retained = family.state().known as Record<string, any>;
  assert.ok(known.evidence.every((ref: string) => retained.evidence.includes(ref)), 'The next owned completion also preserves the independent evidence');
});

for (const failure of ['missing', 'ambiguous', 'contradictory', 'wrong-command'] as const) test('receiver transfer rejects ' + failure + ' completion evidence while preserving independent facts', async () => {
  const testCase = await witnessedReception(), { family, first, next, action } = testCase;
  const original = structuredClone(family.state()), filled = structuredClone(testCase.filled);
  if (failure === 'ambiguous') {
    const x = 8 + 3 * testCase.pitch, y = 8 + 4 * testCase.pitch;
    filled[y + 1]![x + 1] = testCase.ink(4); filled[y + 1]![x + 2] = testCase.ink(4);
    filled[y + 2]![x + 1] = testCase.ink(2); filled[y + 2]![x + 2] = testCase.ink(3);
  }
  const frames = failure === 'missing' ? [] : failure === 'contradictory' ? [first] : [filled];
  const input = failure === 'wrong-command' ? { action_ref: 'ACTION1', data: {} } : action;
  await family.observePublicOutcome!(await testCase.observe(first, 8, 2), await testCase.observe(next, 9, 3), input, first, next, frames);
  assert.deepEqual(family.state(), original);
});

test('a completion witness has one source scope and confirms only one official transition', async () => {
  const t = await witnessedReception(), before = await t.observe(t.first, 8, 2), after = await t.observe(t.next, 9, 3);
  const role = { completed: 1, evidence: ['old-proof'], independent: { command: 'measured' } };
  assert.equal(continueRoleAfterPublicCompletion(role, before, after, false), null);
  assert.equal(continueRoleAfterPublicCompletion({ ...role, completed: 0 }, before, after, true), null);
  assert.equal(continueRoleAfterPublicCompletion(role, before, { ...after, levels_completed: 3 }, true), null);
  const retained = continueRoleAfterPublicCompletion(role, before, after, true)!;
  assert.deepEqual(retained.independent, role.independent);
  assert.equal(continueRoleAfterPublicCompletion(retained, before, after, true), null);
  assert.deepEqual(role, { completed: 1, evidence: ['old-proof'], independent: { command: 'measured' } });
});

for (const echo of [false, true]) test('a next-level raster coinciding with the old receiver terminal is not a completion witness' + (echo ? ' even when echoed in frames' : ''), async () => {
  const t = await witnessedReception(), original = structuredClone(t.family.state());
  await t.family.observePublicOutcome!(await t.observe(t.first, 8, 2), await t.observe(t.filled, 9, 3), t.action,
    t.first, t.filled, echo ? [structuredClone(t.filled)] : []);
  assert.deepEqual(t.family.state(), original);
});

test('the terminal raster remains admissible when the public context has not advanced', async () => {
  const t = await witnessedReception(), before = await t.observe(t.first, 8, 2);
  const after = { ...await t.observe(t.filled, 9, 2), levels_completed: before.levels_completed + 1, state: 'WIN' };
  assert.deepEqual(publicCompletionFrames(before, after, t.filled, []), [t.filled]);
});
