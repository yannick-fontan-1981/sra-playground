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

type Cell = [number, number];
const same = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];

function placementRoom(variant: boolean) {
  const q = variant ? 3 : 4, phase = variant ? 1 : 0;
  const ink = (value: number) => variant ? (value * 5 + 3) % 16 : value;
  const controls: Record<string, Cell> = variant
    ? { ACTION1: [0, 1], ACTION2: [0, -1], ACTION3: [1, 0], ACTION4: [-1, 0] }
    : { ACTION1: [-1, 0], ACTION2: [1, 0], ACTION3: [0, -1], ACTION4: [0, 1] };
  let level = 1, completed = 0, selected: number | null = null;
  let bodies: Cell[] = [[6, 2], [6, 9]];
  const origin = (): Cell => level === 1 ? [2, 4] : [3, 5];
  const targets = (): Cell[] => {
    const [y, x] = origin();
    return level === 1 ? [[y, x], [y, x + 1]] : [[y, x], [y + 1, x + 1]];
  };
  function frame(options: { absentSelection?: boolean; ambiguousSelection?: boolean } = {}) {
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
    for (const [r, c] of targets()) square(43 + (r - oy) * q, 43 + (c - ox) * q, 13);
    rows[35]!.fill(ink(8));
    for (const [r, c] of bodies) square(phase + r * q, phase + c * q, 13);
    if (selected !== null && !options.absentSelection) {
      const [r, c] = bodies[selected]!;
      rows[phase + r * q]![phase + c * q] = ink(15);
      if (options.ambiguousSelection) rows[phase + r * q]![phase + c * q + 1] = ink(7);
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
    if (targets().every(slot => bodies.some(body => same(body, slot)))) {
      completed++;
      if (completed < 2) { level++; bodies = variant ? [[7, 2], [7, 12]] : [[1, 2], [7, 11]]; selected = null; }
    }
    return packet();
  }
  assert.ok(measureReferencePopulation(frame()));
  return { frame, packet, act, controls, get level() { return level; }, get completed() { return completed; } };
}

async function start(variant: boolean) {
  const room = placementRoom(variant), verify = createSicVerifyReferencePlacement(), learn = createSicVerifyReferencePlacement(learnReferencePlacementId, true);
  const registry = { registerProgram: async () => ({ run: async ({ situation }: { situation: { routeSupported: boolean } }) =>
    ({ result: situation.routeSupported ? 'P07' : 'P05', receipt: {} }) }) } as unknown as NativeProgramRegistry;
  await verify.attachPrograms!(registry); await learn.attachPrograms!(registry);
  const families = [verifyReferencePlacementId, learnReferencePlacementId];
  const service = new V6AgentService(() => new NativeV6Runtime({ families: [verify, learn], sourceDigest: 'population-controls', maxPointOccurrences: 250,
    groups: [{ id: observedMechanicsGroup, families }, { id: 'fill_visible_partition', families }] }));
  const sessionId = 'population-' + variant;
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
