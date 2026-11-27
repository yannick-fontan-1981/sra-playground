import assert from 'node:assert/strict';
import test from 'node:test';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeProgramRegistry } from '../src/logos-engine/v6-native-types.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation, type V6Ticket } from '../src/runtime/v6-agent-protocol.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import { createSicVerifyReferencePlacement, learnReferencePlacementId, verifyReferencePlacementId } from '../src/sic/population-placement.ts';
import { observedMechanicsGroup } from '../src/sic/strategy-agenda.ts';
import { measureReferencePopulation } from '../src/logos-engine/v6-reference-population-observation.ts';
import { nativeAfterPublicBoundaries } from './helpers/sic-native-public-boundaries.ts';

type Cell = [number, number];
const same = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];

function placementRoom(variant: boolean, neighborResponse = false) {
  const q = variant ? 3 : 4, phase = variant ? 1 : 0;
  const ink = (value: number) => variant ? (value * 5 + 3) % 16 : value;
  const controls: Record<string, Cell> = variant
    ? { ACTION1: [0, 1], ACTION2: [0, -1], ACTION3: [1, 0], ACTION4: [-1, 0] }
    : { ACTION1: [-1, 0], ACTION2: [1, 0], ACTION3: [0, -1], ACTION4: [0, 1] };
  let level = 1, completed = 0, selected: number | null = null;
  let bodies: Cell[] = neighborResponse ? (variant ? [[6, 2], [7, 2]] : [[6, 2], [6, 3]]) : [[6, 2], [6, 9]];
  const origin = (): Cell => level === 1 ? [2, 4] : [3, 5];
  const targets = (): Cell[] => {
    const [y, x] = origin();
    if (!neighborResponse) return level === 1 ? [[y, x], [y, x + 1]] : [[y, x], [y + 1, x + 1]];
    if (level === 1) return variant ? [[y, x], [y + 1, x]] : [[y, x], [y, x + 1]];
    return variant ? [[y, x], [y + 1, x], [y + 1, x + 1]] : [[y, x], [y, x + 1], [y + 1, x]];
  };
  const degree = ([y, x]: Cell) => bodies.filter(([r, c]) => Math.abs(r - y) + Math.abs(c - x) === 1).length;
  const response = (cell: Cell) => [13, 9, 12, 15, 11][degree(cell)]!;
  function frame(options: { absentSelection?: boolean; ambiguousSelection?: boolean; duplicateSelection?: boolean } = {}) {
    const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(ink(0)));
    const square = (y: number, x: number, color: number) => {
      for (let dy = 0; dy < q - 1; dy++) for (let dx = 0; dx < q - 1; dx++) rows[y + dy]![x + dx] = ink(color);
    };
    const border = (y: number, x: number) => {
      const left = x - 1, top = y - 1, right = x + 3 * q - 1, bottom = y + 3 * q - 1;
      for (let i = left; i <= right; i++) { rows[top]![i] = ink(8); rows[bottom]![i] = ink(8); }
      for (let j = top; j <= bottom; j++) { rows[j]![left] = ink(8); rows[j]![right] = ink(8); }
    };
    const [oy, ox] = origin(), y = phase + oy * q, x = phase + ox * q;
    border(y, x);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) square(y + r * q, x + c * q, 2);
    border(43, 43);
    for (const [r, c] of targets()) square(43 + (r - oy) * q, 43 + (c - ox) * q, neighborResponse ? (level === 1 ? 9 : 12) : 13);
    rows[35]!.fill(ink(8));
    for (const [r, c] of bodies) square(phase + r * q, phase + c * q, neighborResponse ? response([r, c]) : 13);
    if (selected !== null && !options.absentSelection) {
      const [r, c] = bodies[selected]!;
      rows[phase + r * q]![phase + c * q] = ink(15);
      if (options.ambiguousSelection) rows[phase + r * q]![phase + c * q + 1] = ink(7);
      if (options.duplicateSelection) {
        const [otherRow, otherCol] = bodies.find((_cell, index) => index !== selected)!;
        rows[phase + otherRow * q]![phase + otherCol * q] = ink(15);
      }
    }
    return rows;
  }
  function packet(options = {}): GameObservation {
    const rows = frame(options);
    return { gameCode: 'PUBLIC', frame: rows, frames: [rows], state: completed === 2 ? 'WIN' : 'NOT_FINISHED',
      level, levelCount: 2, levelsCompleted: completed, availableActionIds: [1, 2, 3, 4, 6],
      canUndo: false, canSelectLevel: true, defaultFps: 10 };
  }
  function act(ticket: V6Ticket, contradictory = false) {
    if (ticket.actionRef === 'ACTION6') {
      const { x, y } = ticket.data;
      selected = bodies.findIndex(([r, c]) => x! >= phase + c * q && x! < phase + c * q + q - 1
        && y! >= phase + r * q && y! < phase + r * q + q - 1);
      if (selected < 0) selected = null;
    } else if (selected !== null && !contradictory) {
      const [dy, dx] = controls[ticket.actionRef]!, [r, c] = bodies[selected]!;
      const next: Cell = [r + dy, c + dx];
      if (next[0] >= 0 && phase + next[0] * q + q - 2 < 35 && next[1] >= 0
        && phase + next[1] * q + q - 2 < 64 && !bodies.some((cell, i) => i !== selected && same(cell, next))) bodies[selected] = next;
    }
    if (targets().every(slot => bodies.some(body => same(body, slot))
      && (!neighborResponse || degree(slot) === (level === 1 ? 1 : 2)))) {
      completed++;
      if (completed < 2) {
        level++;
        bodies = neighborResponse ? (variant ? [[0, 1], [1, 12], [8, 3], [8, 11]] : [[0, 2], [0, 11], [7, 1], [7, 10]])
          : variant ? [[7, 2], [7, 12]] : [[1, 2], [7, 11]];
        selected = null;
      }
    }
    return packet();
  }
  assert.ok(measureReferencePopulation(frame()));
  return { frame, packet, act, controls, get level() { return level; }, get completed() { return completed; } };
}

async function start(variant: boolean, neighborResponse = false) {
  const room = placementRoom(variant, neighborResponse), verify = createSicVerifyReferencePlacement(), learn = createSicVerifyReferencePlacement(learnReferencePlacementId, true);
  const registry = { registerProgram: async () => ({ run: async ({ situation }: { situation: { routeSupported: boolean } }) =>
    ({ result: situation.routeSupported ? 'P07' : 'P05', receipt: {} }) }) } as unknown as NativeProgramRegistry;
  await verify.attachPrograms!(registry); await learn.attachPrograms!(registry);
  const families = [verifyReferencePlacementId, learnReferencePlacementId];
  const service = new V6AgentService(() => new NativeV6Runtime({ families: [verify, learn], sourceDigest: 'population-controls', maxPointOccurrences: 250,
    groups: [{ id: observedMechanicsGroup, families }, { id: 'fill_visible_partition', families }] }));
  const sessionId = 'population-' + variant + '-' + neighborResponse;
  let sequence = 0, result = await service.handle({ type: 'init', sessionId, sequence,
    observation: toV6PublicObservation(room.packet()), budgets: { targetLevels: 2, levelActionCaps: [80, 80] } });
  const tickets: V6Ticket[] = [];
  async function next(contradictory = false, options = {}) {
    assert.ok(result.ticket, JSON.stringify({ kind: result.kind, reason: result.snapshot.reason }));
    const ticket = result.ticket;
    tickets.push(ticket); room.act(ticket, contradictory);
    result = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: ticket.id, executionMs: 1,
      observation: toV6PublicObservation(room.packet(options), sequence) });
    if (!result.ticket && room.completed < 2) result = await service.handle({ type: 'resume', sessionId, sequence });
    return result;
  }
  while (room.level === 1) { assert.ok(tickets.length < 70); await next(); }
  return { room, learn, tickets, next, get result() { return result; } };
}

for (const variant of [false, true]) test('native selection retains controls acquired before the boundary' + (variant ? ' with different size, palette, positions and controls' : ''), async () => {
  const run = await start(variant), witness = structuredClone(run.learn.state().witness);
  assert.ok(witness && Object.keys(witness.controls).length === 4);
  assert.equal(run.result.snapshot.proposal?.kind, learnReferencePlacementId);
  assert.equal(run.result.ticket?.actionRef, 'ACTION6', 'The first useful transferred operation is selection');
  assert.ok(run.result.snapshot.proposal?.sicSituationCard?.evidence.some((ref: string) => witness.evidence.includes(ref)));
  await run.next();
  const proposal = run.result.snapshot.proposal;
  assert.equal(proposal?.kind, learnReferencePlacementId);
  assert.deepEqual(proposal?.local.controls, witness.controls);
  assert.ok(proposal?.choice.expected, 'The first movement checks a learned effect instead of restarting calibration');
  while (run.room.completed < 2) { assert.ok(run.tickets.length < 120); await run.next(); }
  assert.equal(run.room.completed, 2);
  assert.ok(run.tickets.some(ticket => ticket.level === 2 && ticket.actionIndex > 0), 'Measured routes remain continuous');
});

for (const option of ['absentSelection', 'ambiguousSelection'] as const) test('transferred control does not issue a blind movement when selection is ' + option, async () => {
  const run = await start(false), witness = structuredClone(run.learn.state().witness);
  await run.next(false, { [option]: true });
  assert.ok(!run.result.ticket || run.result.ticket.actionRef === 'ACTION6', 'An unconfirmed selection requires a new observation before movement');
  assert.ok(run.result.snapshot.trace.some(event => event.kind === 'actual_outcome' && event.matched === false));
  assert.deepEqual(run.learn.state().witness, witness, 'Unconfirmed selection does not erase independently measured directions');
});

test('a contradictory first displacement removes only its control association', async () => {
  const run = await start(true), witness = structuredClone(run.learn.state().witness);
  await run.next();
  const contradicted = run.result.ticket!.actionRef;
  await run.next(true);
  const state = run.learn.state().state;
  assert.equal(state.controls[contradicted], undefined);
  for (const [action, effect] of Object.entries(witness.controls)) if (action !== contradicted) assert.deepEqual(state.controls[action], effect);
  assert.ok(run.result.snapshot.trace.some(event => event.kind === 'actual_outcome' && event.matched === false));
});


for (const variant of [false, true]) test('native placement retains an observed neighbor dependence across a public score' + (variant ? ' with changed geometry, shape, colors and controls' : ''), async () => {
  const run = await start(variant, true), witness = structuredClone(run.learn.state().witness);
  assert.ok(witness.neighborEffectRef, 'A stationary neighbor really changed before the completed level');
  const initial = run.result.snapshot.proposal;
  assert.equal(initial?.kind, learnReferencePlacementId);
  assert.equal(run.result.ticket?.actionRef, 'ACTION6');
  assert.ok(initial?.local.support?.unknownMasks?.length, 'The new arrangement contains a response still to be measured');
  assert.ok(initial?.sicSituationCard?.evidence.includes(witness.neighborEffectRef));
  for (const mask of initial!.local.support.unknownMasks) assert.equal(initial!.local.neighborhood[mask], undefined,
    'Retaining a dependence must not invent an unobserved appearance');
  await run.next();
  assert.deepEqual(run.result.snapshot.proposal?.local.controls, witness.controls);
  assert.ok(run.result.snapshot.proposal?.choice.expected, 'The selected preparation uses a previously measured displacement');
  while (run.room.completed < 2) { assert.ok(run.tickets.length < 150); await run.next(); }
  assert.equal(run.room.completed, 2);
  const trace = run.result.snapshot.trace;
  assert.ok(run.tickets.some(ticket => ticket.level === 2 && ticket.actionIndex > 0));
  assert.ok(trace.some(event => event.kind === 'actual_outcome' && event.matched === true));
  assert.ok(trace.some(event => event.kind === 'sealed_prefix' && Number(event.acquired_actions) > 1));
});

for (const option of ['absentSelection', 'ambiguousSelection'] as const) test('an inherited neighbor experiment stops when its first selection is ' + option, async () => {
  const run = await start(false, true), witness = structuredClone(run.learn.state().witness);
  await run.next(false, { [option]: true });
  assert.ok(!run.result.ticket || run.result.ticket.actionRef === 'ACTION6');
  assert.ok(run.result.snapshot.trace.some(event => event.kind === 'actual_outcome' && event.matched === false));
  assert.deepEqual(run.learn.state().witness, witness, 'An unconfirmed mark does not erase independent adjacency evidence');
});

test('a missing neighbor-effect proof does not authorize an unknown support arrangement', async () => {
  const run = await start(false, true), saved = structuredClone(run.learn.state());
  delete saved.witness.neighborEffectRef;
  run.learn.restore(saved);
  const isolated = await nativeAfterPublicBoundaries(run.learn, run.room.packet(), 'missing-neighbor-effect', 80, observedMechanicsGroup);
  assert.ok(!isolated.reply.snapshot.proposal?.local.support?.unknownMasks?.length);
  assert.deepEqual(run.learn.state().witness, saved.witness);
});

test('a contradicted displacement in an inherited neighbor experiment seals only its executed prefix', async () => {
  const run = await start(true, true), witness = structuredClone(run.learn.state().witness);
  await run.next();
  const contradicted = run.result.ticket!.actionRef;
  await run.next(true);
  const state = run.learn.state().state;
  assert.equal(state.controls[contradicted], undefined);
  for (const [action, effect] of Object.entries(witness.controls)) if (action !== contradicted) assert.deepEqual(state.controls[action], effect);
  assert.equal(state.neighborEffectRef, witness.neighborEffectRef);
  const outcome = run.result.snapshot.trace.findLast(event => event.kind === 'actual_outcome');
  assert.equal(outcome?.matched, false);
  assert.ok(!run.result.ticket || run.result.ticket.actionIndex === 0);
});

async function firstPreparedSelection(variant: boolean) {
  const run = await start(variant, true);
  while (!(run.result.ticket?.actionRef === 'ACTION6' && run.result.snapshot.proposal?.route?.length > 1)) {
    assert.ok(run.tickets.length < 130 && run.room.completed < 2, 'A known selection should expose its measured approach');
    await run.next();
  }
  return run;
}

for (const variant of [false, true]) test('a confirmed selection continues into its measured movement in one native prefix' + (variant ? ' with different shape, colors, size and controls' : ''), async () => {
  const run = await firstPreparedSelection(variant), first = run.result.ticket!;
  const plan = run.result.snapshot.trace.findLast(event => event.kind === 'sic_native_plan')!;
  assert.ok(run.result.snapshot.proposal!.actions.length <= 16);
  const saved = structuredClone(run.learn.state());
  await run.next();
  assert.equal(run.result.ticket?.decisionRevision, first.decisionRevision);
  assert.equal(run.result.ticket?.actionIndex, 1);
  assert.notEqual(run.result.ticket?.actionRef, 'ACTION6');
  assert.deepEqual(run.learn.state(), saved, 'Learning waits for one reconciliation of the executed prefix');
  let executed = 1;
  while (run.result.ticket?.decisionRevision === first.decisionRevision) { await run.next(); executed++; }
  const returns = run.result.snapshot.trace.filter(event => event.kind === 'actual_outcome' && event.sic_plan === plan.id);
  assert.equal(returns.length, executed);
  assert.deepEqual(returns.map(event => event.index), Array.from({ length: executed }, (_, i) => i));
  const seals = run.result.snapshot.trace.filter(event => event.kind === 'sealed_prefix'
    && event.family === plan.family && event.revision === first.decisionRevision);
  assert.equal(seals.length, 1);
  assert.equal(seals[0]!.acquired_actions, executed);
  assert.ok(executed >= 2);
});

for (const failure of ['absentSelection', 'duplicateSelection'] as const) test('a prepared movement is not issued after an ' + failure + ' mark', async () => {
  const run = await firstPreparedSelection(false), first = run.result.ticket!, controls = structuredClone(run.learn.state().state.controls);
  await run.next(false, { [failure]: true });
  assert.ok(!run.result.ticket || run.result.ticket.decisionRevision !== first.decisionRevision);
  const outcome = run.result.snapshot.trace.findLast(event => event.kind === 'actual_outcome');
  assert.equal(outcome?.index, 0);
  assert.equal(outcome?.matched, false);
  assert.equal(run.result.snapshot.trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, 1);
  assert.deepEqual(run.learn.state().state.controls, controls);
});

test('a contradicted movement after selection closes exactly the two actual tickets', async () => {
  const run = await firstPreparedSelection(true), first = run.result.ticket!;
  await run.next();
  const action = run.result.ticket!.actionRef, controls = structuredClone(run.result.snapshot.proposal!.local.controls);
  await run.next(true);
  assert.ok(!run.result.ticket || run.result.ticket.decisionRevision !== first.decisionRevision);
  assert.equal(run.result.snapshot.trace.findLast(event => event.kind === 'actual_outcome')?.matched, false);
  assert.equal(run.result.snapshot.trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, 2);
  assert.equal(run.learn.state().state.controls[action], undefined);
  for (const [command, effect] of Object.entries(controls)) if (command !== action) assert.deepEqual(run.learn.state().state.controls[command], effect);
});
