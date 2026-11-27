import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { measureReceptionService, receptionServiceCarriers } from '../src/logos-engine/v6-reception-service-observation.ts';
import { createSicReceptionAccess } from '../src/sic/reception-access.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation, type V6Ticket } from '../src/runtime/v6-agent-protocol.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';

type Point = [number, number];
const same = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-reception-service-reference.json.gz', import.meta.url))).toString());

function receptionRoom(variant: boolean, uncertain?: 'ambiguous' | 'missing' | 'different-support', arrivalTransfer = false) {
  const template: number[][] = structuredClone(fixture.rasters.base), layout = measureReceptionService(template)!;
  const carrier = receptionServiceCarriers(template, layout)[0]!, q = layout.pitch as number;
  const ink = (value: number) => variant ? (value * 7 + 1) % 16 : value;
  const shift: Point = variant ? [12, 4] : [0, 0];
  const controls: Record<string, Point> = variant
    ? { ACTION1: [q, 0], ACTION2: [-q, 0], ACTION3: [0, q], ACTION4: [0, -q] }
    : { ACTION1: [0, -q], ACTION2: [0, q], ACTION3: [-q, 0], ACTION4: [q, 0] };
  for (let y = 0; y < q; y++) for (let x = 0; x < q; x++) template[carrier.anchor[1] + y]![carrier.anchor[0] + x] = layout.background;
  if (variant) {
    // Change the requested glyph and its matching body together, preserving
    // their observed relation rather than a fixed appearance.
    for (const box of [layout.counterparts[0].body_bbox, layout.counterparts[0].request_bbox]) {
      template[box[1]]![box[2]] = template[box[1]]![box[0]];
      template[box[3]]![box[2]] = layout.background;
    }
  }
  const targetLevels = arrivalTransfer ? 3 : 2;
  let level = 1, completed = 0, at: Point = [...carrier.anchor], held = 0;
  const target: Point = [...layout.target.anchor];
  function frame() {
    const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(ink(layout.background)));
    for (let y = 0; y < 64 - shift[1]; y++) for (let x = 0; x < 64 - shift[0]; x++) rows[y + shift[1]]![x + shift[0]] = ink(template[y]![x]!);
    if (level === 2 && uncertain === 'different-support') {
      for (let y = target[1]; y < target[1] + q; y++) for (let x = target[0]; x < target[0] + q; x++)
        if (rows[y + shift[1]]![x + shift[0]] === ink(layout.target.color)) rows[y + shift[1]]![x + shift[0]] = ink(10);
    }
    const paintCarrier = ([x, y]: Point) => {
      for (const [dx, dy] of [[0, 0], [q - 1, 0], [0, q - 1], [q - 1, q - 1]]) rows[y + shift[1] + dy!]![x + shift[0] + dx!] = ink(carrier.color);
      if (variant) rows[y + shift[1] + 1]![x + shift[0] + 1] = ink(14);
    };
    if (!(level === 2 && uncertain === 'missing')) paintCarrier(at);
    if (level === 2 && uncertain === 'ambiguous') paintCarrier([17, 9]);
    return rows;
  }
  function packet(): GameObservation {
    const rows = frame();
    return { gameCode: 'PUBLIC', frame: rows, frames: [rows], state: completed === targetLevels ? 'WIN' : 'NOT_FINISHED',
      level, levelCount: targetLevels, levelsCompleted: completed, availableActionIds: [1, 2, 3, 4], canUndo: false, canSelectLevel: true, defaultFps: 10 };
  }
  function act(ticket: V6Ticket, contradiction = false, unrelatedCompletion = false) {
    let delta = controls[ticket.actionRef]!;
    if (contradiction) delta = delta[0] === 0 ? [q, 0] : [0, -q];
    const next: Point = [at[0] + delta[0], at[1] + delta[1]];
    const valid = layout.cells.some((point: Point) => same(point, next))
      && !layout.support_candidates.some((support: { anchor: Point }) => !same(support.anchor, target) && same(support.anchor, next));
    if (valid) { at = next; held = 0; }
    else if (same(at, target)) held++;
    if (held === 2 || (arrivalTransfer && level === 2 && same(at, target)) || unrelatedCompletion) {
      completed++;
      if (completed < targetLevels) { level++; at = variant ? [5, 21] : [9, 25]; held = 0; }
    }
  }
  assert.ok(measureReceptionService(frame()));
  return { packet, act, controls, targetLevels, get level() { return level; }, get completed() { return completed; } };
}

async function acquiredReception(variant = false, uncertain?: 'ambiguous' | 'missing' | 'different-support', arrivalTransfer = false) {
  const room = receptionRoom(variant, uncertain, arrivalTransfer), family = createSicReceptionAccess();
  const service = new V6AgentService(() => new NativeV6Runtime({ families: [family], sourceDigest: 'reception-controls', maxPointOccurrences: 250 }));
  const sessionId = 'reception-' + variant + '-' + uncertain;
  let sequence = 0, result = await service.handle({ type: 'init', sessionId, sequence,
    observation: toV6PublicObservation(room.packet()), budgets: { targetLevels: room.targetLevels, levelActionCaps: Array(room.targetLevels).fill(80) } });
  const issued: V6Ticket[] = [];
  async function next(contradiction = false, unrelatedCompletion = false) {
    assert.ok(result.ticket, JSON.stringify({ kind: result.kind, reason: result.snapshot.reason }));
    const ticket = result.ticket; issued.push(ticket); room.act(ticket, contradiction, unrelatedCompletion);
    result = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: ticket.id, executionMs: 1,
      observation: toV6PublicObservation(room.packet(), sequence) });
    if (!result.ticket && room.completed < room.targetLevels) result = await service.handle({ type: 'resume', sessionId, sequence });
    return result;
  }
  while (room.level === 1) { assert.ok(issued.length < 70); await next(); }
  return { room, family, issued, next, get result() { return result; } };
}

for (const variant of [false, true]) test('native reception reuses its measured control role immediately after a win' + (variant ? ' with new glyphs, palette, positions and controls' : ''), async () => {
  const run = await acquiredReception(variant), memory = structuredClone(run.family.state().remembered);
  assert.ok(memory && Object.keys(memory.controls).length >= 2);
  const proposal = run.result.snapshot.proposal;
  assert.equal(proposal?.kind, run.family.id);
  assert.equal(proposal?.sicSituationCard?.strategy, 'P07');
  assert.deepEqual(proposal?.local.controls, memory.controls);
  assert.ok(proposal?.sicSituationCard?.evidence.some((ref: string) => memory.evidence.includes(ref)));
  assert.ok(proposal?.actions.length > 1, 'The known preparation is offered as one guarded route');
  const direction = run.result.ticket!.actionRef;
  assert.ok(memory.controls[direction]);
  while (run.room.completed < 2) { assert.ok(run.issued.length < 120); await run.next(); }
  assert.equal(run.room.completed, 2);
  assert.ok(run.issued.some(ticket => ticket.level === 2 && ticket.actionIndex > 0));
});

for (const uncertainty of ['ambiguous', 'missing', 'different-support'] as const) test('a transferred reception role is not assumed with ' + uncertainty, async () => {
  const run = await acquiredReception(false, uncertainty), memory = run.family.state().remembered;
  assert.ok(memory && Object.keys(memory.controls).length >= 2, 'The earlier role remains documented');
  const proposal = run.result.snapshot.proposal;
  assert.notEqual(proposal?.sicSituationCard?.strategy, 'P07');
  if (proposal?.local) assert.deepEqual(proposal.local.controls, {}, 'An unbound current role cannot consume those controls');
});

test('a contradicted transferred reception route closes and revises only the observed command', async () => {
  const run = await acquiredReception(), memory = structuredClone(run.family.state().remembered);
  const action = run.result.ticket!.actionRef;
  await run.next(true);
  const state = run.family.state().state;
  assert.notDeepEqual(state.controls[action], memory.controls[action]);
  for (const [command, delta] of Object.entries(memory.controls)) if (command !== action) assert.deepEqual(state.controls[command], delta);
  assert.ok(run.result.snapshot.trace.some(event => event.kind === 'actual_outcome' && event.matched === false));
  assert.ok(!run.result.ticket || run.result.ticket.actionIndex === 0, 'A contradiction cannot release the old suffix');
});

for (const variant of [false, true]) test('an official reception on a measured arrival carries the role into another native level' + (variant ? ' with a different interface and controls' : ''), async () => {
  const run = await acquiredReception(variant, undefined, true), original = structuredClone(run.family.state().remembered);
  while (run.room.level === 2) { assert.ok(run.issued.length < 100); await run.next(); }
  const transferred = run.family.state().remembered, proposal = run.result.snapshot.proposal;
  assert.equal(transferred.epoch, 3);
  assert.deepEqual(transferred.controls, original.controls);
  assert.equal(proposal?.sicSituationCard?.strategy, 'P07');
  assert.deepEqual(proposal?.local.controls, original.controls);
  assert.ok(proposal?.sicSituationCard?.evidence.some((ref: string) => transferred.evidence.includes(ref)));
  assert.ok(run.result.ticket && original.controls[run.result.ticket.actionRef]);
  await run.next();
  assert.ok(run.issued.some(ticket => ticket.level === 3));
});

test('an unrelated official completion cannot advance a reception that was still approaching its support', async () => {
  const run = await acquiredReception(false, undefined, true), prior = structuredClone(run.family.state().remembered);
  const proposal = run.result.snapshot.proposal!;
  assert.notDeepEqual(proposal.route[0].to, proposal.local.scene.target.anchor);
  await run.next(false, true);
  assert.deepEqual(run.family.state().remembered, prior);
  assert.notEqual(run.result.snapshot.proposal?.sicSituationCard?.strategy, 'P07');
});
