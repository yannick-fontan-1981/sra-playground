import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation, ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeBox, NativeFamily } from '../src/logos-engine/v6-native-types.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';
import { acquireMarkedOutlet, createSicMarkedCompartmentFlow, projectRecalledOutlet } from '../src/sic/marked-compartment-flow.ts';
import { preparedEffectsId } from '../src/sic/test-prepared-effects.ts';

function controlFixture(variant = false) {
  const ink = (value: number) => variant ? (value * 5 + 3) % 16 : value;
  const width = variant ? 9 : 8, height = variant ? 19 : 15, pocketWidth = variant ? 3 : 2, pocketHeight = variant ? 2 : 1;
  const tops = variant ? [0, 7, 14] : [0, 5, 10], spine = width - 4;
  const control: NativeBox = variant ? [27, 8, 35, 26] : [29, 10, 36, 24];
  const outlet: NativeBox = variant ? [44, 8, 47, 28] : [45, 10, 48, 27];
  const offset = variant ? [4, 10] : [3, 7];
  const anchors: NativeBox[] = [[4, 8, 9, 20], [4, 28, 9, 40], [15, 9, 20, 23], [15, 31, 20, 45], [52, 39, 57, 55], outlet];
  const command = (shift = 0) => ({ action_ref: 'ACTION6', data: { x: control[0] + shift + offset[0]!, y: control[1] + offset[1]! } });
  const pattern = (ready: boolean) => {
    const rows = Array.from({ length: height }, () => Array<number>(width).fill(ink(5)));
    for (let y = 1; y < height; y++) for (let x = spine; x < width; x++) {
      if (x === spine || x === width - 1 || y === 1 || y === height - 1) rows[y]![x] = ink(3);
    }
    for (const [index, top] of tops.entries()) for (let y = top; y <= top + pocketHeight + 1; y++) {
      for (let x = 0; x <= pocketWidth + 1; x++) {
        const edge = x === 0 || x === pocketWidth + 1 || y === top || y === top + pocketHeight + 1;
        rows[y]![x] = ink(edge ? ready ? 0 : 3 : ready ? [10, 11, 9][index]! : 5);
      }
    }
    return rows;
  };
  const paintControl = (rows: number[][], left: number, top: number, ready = true) => {
    const p = pattern(ready);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) rows[top + y]![left + x] = p[y]![x]!;
  };
  const frame = ({ shift = 0, ready = false, drained = false } = {}) => {
    const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(ink(5)));
    for (const anchor of anchors) {
      const [l, t, r, b] = anchor;
      for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
        const edge = x === l || x === r || y === t || y === b;
        rows[y]![x + shift] = ink(edge ? anchor === outlet ? 0 : 3 : anchor === outlet && !drained ? 14 : 5);
      }
    }
    paintControl(rows, control[0] + shift, control[1], ready);
    return rows;
  };
  const packet = (rows: number[][], level: number, frames = [rows]): GameObservation => ({ gameCode: 'PUBLIC', frame: rows, frames,
    level, levelCount: 3, levelsCompleted: level - 1, state: 'NOT_FINISHED', availableActionIds: [5, 6],
    canUndo: false, canSelectLevel: false, defaultFps: 10 });
  const observe = (rows: number[][], level: number, revision: number) => measureNativeObservation({ frame_rows: rows,
    frame_hash: 'compound-control-' + revision, level, levels_completed: level - 1, state: 'NOT_FINISHED',
    available_action_refs: ['ACTION5', 'ACTION6'] }, revision, 'compound-control');
  return { frame, packet, observe, command, control, outlet, width, height, ink, paintControl, spine, tops };
}

for (const variant of [false, true]) test('native outlet control keeps its identity when repeated pockets change their contents and readiness'
  + (variant ? ' with another palette, pocket shape, position and clicked offset' : ''), async () => {
  const t = controlFixture(variant), family = createSicMarkedCompartmentFlow();
  const source: NativeFamily = {
    id: preparedEffectsId,
    async propose(observation, rows) {
      if (observation.levels_completed !== 0) return null;
      const action = t.command(), point: [number, number] = [action.data.x, action.data.y];
      const point_binding = await ObservedInputDomain.makeLocusWitness(observation, rows, point,
        { reason: 'Declared public outlet boundary fixture', evidence: [observation.observation_ref] });
      return { status: 'proposed', kind: this.id, actions: [action], steps: [{ action, point_binding }],
        binding: { observation_ref: observation.observation_ref, level_epoch: observation.level_epoch },
        sicLocalDecision: { strategy: 'observe_public_control_return' } };
    },
    before: () => ({ admitted: true, reason: 'public_control_fixture' }),
    after: () => ({ matched: true, seal_prefix: true, reason: 'official_boundary' }),
    record: () => ({ events: [] }), state: () => ({}), restore() {},
  };
  const service = new V6AgentService(() => new NativeV6Runtime({ families: [family, source],
    sourceDigest: 'compound-control-public-transfers', maxPointOccurrences: 100,
    groups: [{ id: 'observed_outlet', families: [family.id] }, { id: 'public_fixture', families: [source.id] }] }));
  const sessionId = 'compound-control-' + variant, first = t.frame();
  let reply = await service.handle({ type: 'init', sessionId, sequence: 0,
    observation: toV6PublicObservation(t.packet(first, 1)), budgets: { targetLevels: 2, levelActionCaps: [8, 8] } });
  assert.equal(family.state().witness, null, 'The native run begins without an outlet role');
  assert.ok(reply.ticket);
  assert.deepEqual(reply.ticket.data, t.command().data);
  const next = t.frame({ shift: 1, ready: true });
  reply = await service.handle({ type: 'advance', sessionId, sequence: 1, ticketId: reply.ticket.id, executionMs: 1,
    observation: toV6PublicObservation(t.packet(next, 2, [t.frame({ drained: true }), next]), 1) });
  const witness = structuredClone(family.state().witness) as NonNullable<Awaited<ReturnType<typeof acquireMarkedOutlet>>>;
  assert.ok(witness?.control);
  assert.deepEqual(witness.control.box, t.control);
  assert.equal(witness.wins, 1);
  reply = await service.handle({ type: 'resume', sessionId, sequence: 1 });
  assert.ok(reply.ticket);
  assert.equal(reply.snapshot.proposal?.kind, family.id);
  assert.equal(reply.snapshot.proposal?.sicSituationCard?.strategy, 'deliver_from_confirmed_outlet');
  assert.deepEqual(reply.ticket.data, t.command(1).data);
  assert.ok(witness.refs.every(ref => reply.snapshot.proposal?.route_refs?.includes(ref)));
  const returned = t.frame({ shift: 1, ready: true, drained: true });
  reply = await service.handle({ type: 'advance', sessionId, sequence: 2, ticketId: reply.ticket.id, executionMs: 1,
    observation: toV6PublicObservation(t.packet(returned, 2), 2) });
  const trace = reply.snapshot.trace as Record<string, any>[];
  assert.equal(trace.findLast(event => event.kind === 'actual_outcome')?.matched, true);
  assert.equal(trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, 1);
  assert.equal(trace.filter(event => event.kind === 'sealed_prefix').length, 2);
  assert.deepEqual(family.state().witness, witness, 'A local release does not manufacture another official victory');
});

for (const condition of ['ambiguous-control', 'changed-process-cavity', 'changed-frame', 'mixed-pocket', 'invalid-pocket-border'] as const) {
  test('compound outlet rebinding refuses ' + condition + ' and preserves its independent witness', async () => {
    const t = controlFixture(), first = t.frame(), next = t.frame({ shift: 1, ready: true });
    const before = await t.observe(first, 1, 1), after = await t.observe(next, 2, 2);
    const witness = await acquireMarkedOutlet(null, before, after, t.command(), first, next, [t.frame({ drained: true }), next]);
    assert.ok(witness);
    const changed = structuredClone(next), left = t.control[0] + 1, top = t.control[1];
    if (condition === 'ambiguous-control') {
      for (let y = top; y < top + t.height; y++) for (let x = left; x < left + t.width; x++) changed[y]![x] = t.ink(5);
      t.paintControl(changed, t.control[0] - t.width / 2, top);
      t.paintControl(changed, t.control[0] + t.width / 2, top);
    } else if (condition === 'changed-process-cavity') changed[top + 3]![left + t.spine + 1] = t.ink(10);
    else if (condition === 'changed-frame') changed[top + 3]![left + t.width - 1] = t.ink(8);
    else if (condition === 'mixed-pocket') changed[top + 1]![left + 2] = t.ink(12);
    else changed[top]![left] = t.ink(8);
    const observation = await t.observe(changed, 2, 3);
    assert.equal(await projectRecalledOutlet(witness, observation, changed, []), null);
    const family = createSicMarkedCompartmentFlow();
    family.restore!({ witness: structuredClone(witness), attempted: [] });
    assert.equal(await family.propose(observation, changed, [], 8), null);
    assert.deepEqual(family.state().witness, witness);
  });
}

test('a compound control with no measured outlet role cannot authorize a recalled release', async () => {
  const t = controlFixture(), family = createSicMarkedCompartmentFlow(), rows = t.frame({ ready: true });
  assert.equal(await family.propose(await t.observe(rows, 2, 1), rows, [], 8), null);
});

test('a partial background loss does not confirm the acquired complete outlet release', async () => {
  const t = controlFixture(), first = t.frame(), next = t.frame({ shift: 1, ready: true });
  const before = await t.observe(first, 1, 1), current = await t.observe(next, 2, 2);
  const witness = await acquireMarkedOutlet(null, before, current, t.command(), first, next, [t.frame({ drained: true }), next]);
  assert.ok(witness);
  const family = createSicMarkedCompartmentFlow();
  family.restore!({ witness: structuredClone(witness), attempted: [] });
  const proposal = await family.propose(current, next, [], 8);
  assert.ok(proposal);
  const partial = structuredClone(next);
  partial[t.outlet[1] + 1]![t.outlet[0] + 2] = t.ink(5);
  const after = await t.observe(partial, 2, 3);
  assert.equal((await family.after(proposal, 0, current, after, next, partial)).matched, false);
  await family.record(current, after, t.command(1), next, partial, proposal, 0, []);
  assert.deepEqual(family.state().witness, witness);
});
