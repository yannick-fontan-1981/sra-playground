import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand } from '../src/logos-engine/v6-native-types.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import { toV6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';
import { acquireMarkedOutlet, checkRecalledOutlet, createSicMarkedCompartmentFlow, projectRecalledOutlet } from '../src/sic/marked-compartment-flow.ts';
import { nativeAfterPublicBoundaries } from './helpers/sic-native-public-boundaries.ts';

function outletFixture(variant = false) {
  const ink = (value: number) => variant ? (value * 5 + 3) % 16 : value;
  const control: NativeBox = variant ? [26, 10, 31, 21] : [31, 12, 38, 26];
  const outlet: NativeBox = variant ? [38, 9, 42, 24] : [45, 10, 48, 27];
  const peer: NativeBox = [52, 39, 57, 53];
  const anchors: NativeBox[] = [[4, 9, 9, 20], [4, 30, 9, 43], [15, 9, 20, 22], [15, 32, 20, 45], control, outlet, peer];
  const offset = variant ? [1, 3] : [4, 8];
  const shifted = (box: NativeBox, shift: number): NativeBox => [box[0] + shift, box[1], box[2] + shift, box[3]];
  const command = (shift = 0): NativeCommand => ({ action_ref: 'ACTION6', data: { x: control[0] + shift + offset[0]!, y: control[1] + offset[1]! } });
  function frame(options: { drained?: boolean; shift?: number; ambiguous?: boolean; changedControl?: boolean; wrongPigment?: boolean } = {}) {
    const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(ink(5))), shift = options.shift ?? 0;
    for (const anchor of anchors) {
      const [l, t, r, b] = shifted(anchor, shift), material = anchor === outlet || options.ambiguous && anchor === peer;
      for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
        if (x === l || x === r || y === t || y === b) rows[y]![x] = ink(material ? 0 : 3);
        else if (material && y >= b - 3 && (!options.drained || options.wrongPigment)) rows[y]![x] = ink(options.wrongPigment ? 13 : 14);
      }
    }
    if (options.changedControl) rows[control[1] + 1]![control[0] + shift + 1] = ink(10);
    return rows;
  }
  const observe = (rows: number[][], revision: number, level: number) => measureNativeObservation({ frame_rows: rows,
    frame_hash: `outlet-${variant}-${revision}`, level, levels_completed: level - 1,
    available_action_refs: ['ACTION5', 'ACTION6'], state: 'NOT_FINISHED' }, revision, 'public-outlet');
  const packet = (rows: number[][], level: number, frames = [rows]): GameObservation => ({ gameCode: 'PUBLIC', frame: rows, frames,
    level, levelCount: 4, levelsCompleted: level - 1, availableActionIds: [5, 6], state: 'NOT_FINISHED',
    canUndo: false, canSelectLevel: true, defaultFps: 10 });
  return { frame, observe, packet, command, outlet, control, shifted, ink };
}

for (const variant of [false, true]) test('native outlet transfer binds the observed remote actuator instead of moving the click onto its effect' + (variant ? ' with changed shape, palette, positions and click' : ''), async () => {
  const t = outletFixture(variant), family = createSicMarkedCompartmentFlow();
  const first = t.frame(), second = t.frame({ shift: 1 }), drained = t.frame({ drained: true });
  const before = await t.observe(first, 1, 1), after = await t.observe(second, 2, 2);
  await family.observePublicOutcome!(before, after, t.command(), first, second, [drained, second]);
  const witness = family.state().witness as NonNullable<Awaited<ReturnType<typeof acquireMarkedOutlet>>>;
  assert.ok(witness);
  assert.deepEqual(witness.outlet, t.outlet);
  assert.deepEqual(witness.control?.box, t.control);
  const fallback = await acquireMarkedOutlet(null, before, after, t.command(), first, second, [drained, second]);
  assert.deepEqual(fallback, witness);
  const projection = await projectRecalledOutlet(witness, after, second, []);
  assert.ok(projection);
  assert.deepEqual(projection.controlBox, t.shifted(t.control, 1));
  assert.deepEqual(projection.choice.point, [t.command(1).data.x, t.command(1).data.y]);
  assert.equal(checkRecalledOutlet(projection, second, t.frame({ shift: 1, drained: true })), true);
  const { service, reply, sequence, sessionId } = await nativeAfterPublicBoundaries(family, t.packet(second, 2), 'outlet-transfer-' + variant);
  assert.ok(reply.ticket);
  assert.equal(reply.ticket.actionRef, 'ACTION6');
  assert.deepEqual(reply.ticket.data, t.command(1).data);
  assert.deepEqual(reply.snapshot.proposal?.sicSituationCard?.chamber, t.shifted(t.control, 1));
  assert.ok(reply.snapshot.proposal?.route_refs?.includes(before.observation_ref));
  const next = t.frame(), emptied = t.frame({ shift: 1, drained: true });
  const done = await service.handle({ type: 'advance', sessionId, sequence: sequence + 1, ticketId: reply.ticket.id, executionMs: 1,
    observation: toV6PublicObservation(t.packet(next, 3, [emptied, next]), sequence + 1) });
  assert.equal(done.ticket, null);
  const trace = done.snapshot.trace as Record<string, any>[];
  assert.equal(trace.findLast(event => event.kind === 'actual_outcome')?.matched, true);
  assert.equal(trace.filter(event => event.kind === 'sealed_prefix').length, 2);
  assert.equal(trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, 1);
  assert.equal((family.state().witness as typeof witness).wins, 2);
});

for (const condition of ['missing', 'ambiguous', 'unchanged', 'wrong-pigment', 'new-context-only'] as const) test('remote outlet acquisition rejects ' + condition + ' animation evidence', async () => {
  const t = outletFixture(), first = t.frame({ ambiguous: condition === 'ambiguous' });
  const emptied = t.frame({ drained: true, ambiguous: condition === 'ambiguous', wrongPigment: condition === 'wrong-pigment' });
  const second = condition === 'new-context-only' ? emptied : t.frame({ shift: 1 });
  const before = await t.observe(first, 1, 1), after = await t.observe(second, 2, 2);
  const frames = condition === 'missing' ? [] : [condition === 'unchanged' ? first : emptied, second];
  assert.equal(await acquireMarkedOutlet(null, before, after, t.command(), first, second, frames), null);
});

test('a changed actuator or a contradictory release does not erase the independently witnessed output', async () => {
  const t = outletFixture(), first = t.frame(), next = t.frame({ shift: 1 });
  const before = await t.observe(first, 1, 1), after = await t.observe(next, 2, 2);
  const witness = await acquireMarkedOutlet(null, before, after, t.command(), first, next, [t.frame({ drained: true }), next]);
  assert.ok(witness);
  const changed = t.frame({ shift: 1, changedControl: true });
  assert.equal(await projectRecalledOutlet(witness, await t.observe(changed, 3, 2), changed, []), null);
  const projection = await projectRecalledOutlet(witness, after, next, []);
  assert.ok(projection);
  assert.equal(checkRecalledOutlet(projection, next, changed), false, 'A change near the control does not confirm output release');
  assert.equal(checkRecalledOutlet(projection, next, t.frame({ shift: 1, drained: true, wrongPigment: true })), false);
  const family = createSicMarkedCompartmentFlow();
  family.restore!({ witness: structuredClone(witness), attempted: [] });
  const proposal = await family.propose(after, next, [], 8);
  assert.ok(proposal);
  assert.equal((await family.after(proposal, 0, after, await t.observe(changed, 3, 2), next, changed)).matched, false);
  await family.record(after, await t.observe(changed, 3, 2), t.command(1), next, changed, proposal, 0, []);
  assert.deepEqual(family.state().witness, witness);
  assert.equal(await family.propose(await t.observe(changed, 3, 2), changed, [], 8), null);
  assert.strictEqual(await acquireMarkedOutlet(witness, before, after, t.command(), first, next, [t.frame({ drained: true }), next]), witness,
    'The same public victory is acquired once');
});

test('moving material within the outlet does not confirm a release', async () => {
  const t = outletFixture(), first = t.frame(), next = t.frame({ shift: 1 });
  const before = await t.observe(first, 1, 1), after = await t.observe(next, 2, 2);
  const witness = await acquireMarkedOutlet(null, before, after, t.command(), first, next, [t.frame({ drained: true }), next]);
  assert.ok(witness);
  const projection = await projectRecalledOutlet(witness, after, next, []);
  assert.ok(projection);
  const moved = structuredClone(next), [left, top, right, bottom] = t.shifted(t.outlet, 1);
  for (let y = top + 1; y < bottom; y++) for (let x = left + 1; x < right; x++) moved[y]![x] = t.ink(5);
  for (let y = bottom - 4; y <= bottom - 2; y++) for (let x = left + 1; x < right; x++) moved[y]![x] = t.ink(14);
  assert.equal(checkRecalledOutlet(projection, next, moved), false,
    'Lost old pixels are insufficient when the same population remains inside the chamber');
});
