import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeRows } from '../src/logos-engine/v6-native-types.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import { toV6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';
import { createSicVerifyChannelAccess } from '../src/sic/paired-channels.ts';
import { observedMechanicsGroup } from '../src/sic/strategy-agenda.ts';
import { nativeAfterPublicBoundaries } from './helpers/sic-native-public-boundaries.ts';

type Packet = { frame: number[][]; level: number; levelsCompleted: number; availableActionIds: number[]; state: 'NOT_FINISHED' };
type Transition = { before: Packet; after: Packet; action: { id: number; data: { x: number; y: number } } };
type Geometry = { pitch: number; tiles: NativeBox[] };
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-channel-mixture-public.json.gz', import.meta.url))).toString()) as {
  initial: Transition; mixture: Transition & { pair: { color: number; from: { box: NativeBox; color: number }; other: { box: NativeBox; color: number } } };
  next: Transition; geometry: Record<number, Geometry>;
};

function scenario(variant: boolean) {
  const ink = (color: number) => variant ? (color * 5 + 3) % 16 : color;
  const move = ([x, y]: readonly number[]) => variant ? [x! - 1, y! + 1] : [x!, y!];
  const box = ([l, t, r, b]: NativeBox): NativeBox => variant ? [l - 1, t + 1, r - 1, b + 1] : [l, t, r, b];
  const frame = (p: Packet): Packet => {
    const rows = structuredClone(p.frame), geometry = fixture.geometry[p.level]!;
    if (variant) for (const [l, t, r, b] of geometry.tiles) {
      for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) rows[t + x - l]![l + geometry.pitch - 1 - (y - t)] = p.frame[y]![x]!;
    }
    const result = Array.from({ length: rows.length }, () => Array<number>(rows[0]!.length).fill(ink(rows[0]![0]!)));
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y]!.length; x++) {
      const [xx, yy] = move([x, y]);
      if (xx! >= 0 && yy! >= 0 && yy! < result.length && xx! < result[0]!.length) result[yy!]![xx!] = ink(rows[y]![x]!);
    }
    return { ...p, frame: result };
  };
  const command = (transition: Transition): NativeCommand => {
    let { x, y } = transition.action.data;
    if (variant) {
      const geometry = fixture.geometry[transition.before.level]!;
      const tile = geometry.tiles.find(([l, t, r, b]) => x >= l && x <= r && y >= t && y <= b)!;
      [x, y] = [tile[0] + geometry.pitch - 1 - (y - tile[1]), tile[1] + x - tile[0]];
      [x, y] = move([x, y]) as [number, number];
    }
    return { action_ref: 'ACTION' + transition.action.id, data: { x, y } };
  };
  let revision = 0;
  const observe = (p: Packet) => measureNativeObservation({ frame_rows: p.frame, frame_hash: 'channel-transfer-' + variant + '-' + ++revision,
    level: p.level, levels_completed: p.levelsCompleted, available_action_refs: p.availableActionIds.map(id => 'ACTION' + id), state: p.state,
  }, revision, 'public-channel-transfer-' + variant);
  return { ink, box, frame, command, observe };
}

async function acquire(variant: boolean) {
  const t = scenario(variant), family = createSicVerifyChannelAccess();
  const first = t.frame(fixture.initial.before), opened = t.frame(fixture.initial.after);
  await family.observePublicOutcome!(await t.observe(first), await t.observe(opened), t.command(fixture.initial), first.frame, opened.frame);
  const beforePacket = t.frame(fixture.mixture.before), afterPacket = t.frame(fixture.mixture.after);
  const before = await t.observe(beforePacket), after = await t.observe(afterPacket), command = t.command(fixture.mixture);
  return { t, family, beforePacket, afterPacket, before, after, command };
}

for (const variant of [false, true]) test('native transfer retains a publicly observed mixture before the first reused channel decision' + (variant ? ' with rotated marker shapes, new palette, positions and click' : ''), async () => {
  const s = await acquire(variant), { family, t, before, after, command, beforePacket, afterPacket } = s;
  assert.deepEqual(family.state().recipes, []);
  await family.observePublicOutcome!(before, after, command, beforePacket.frame, afterPacket.frame);
  const recipes = structuredClone(family.state().recipes) as { from: number; other: number; result: number; before: string; evidence: string; control: { point: number[]; box: NativeBox } }[];
  assert.equal(recipes.length, 1);
  assert.deepEqual(new Set([recipes[0]!.from, recipes[0]!.other]), new Set([t.ink(fixture.mixture.pair.from.color), t.ink(fixture.mixture.pair.other.color)]));
  assert.equal(recipes[0]!.result, t.ink(fixture.mixture.pair.color));
  assert.equal(recipes[0]!.before, before.observation_ref);
  assert.equal(recipes[0]!.evidence, after.observation_ref);
  assert.deepEqual(recipes[0]!.control.point, [command.data.x, command.data.y]);
  await family.observePublicOutcome!(before, after, command, beforePacket.frame, afterPacket.frame);
  assert.deepEqual(family.state().recipes, recipes, 'A repeated public event is acquired once');
  const current = t.frame(fixture.next.before);
  const packet: GameObservation = { ...current, gameCode: 'PUBLIC', levelCount: 4, frames: [current.frame],
    defaultFps: 10, canSelectLevel: false, canUndo: false };
  const { service, reply, sequence, sessionId } = await nativeAfterPublicBoundaries(family, packet, 'channel-transfer-native-' + variant, 80, observedMechanicsGroup);
  assert.ok(reply.ticket);
  assert.equal(reply.ticket.actionRef, 'ACTION6');
  const proposal = reply.snapshot.proposal as any;
  assert.equal(proposal.kind, family.id);
  assert.ok(proposal.route_refs.includes(before.observation_ref));
  assert.ok(proposal.route_refs.includes(after.observation_ref));
  assert.ok(proposal.state.layout.pairs.filter((pair: any) => pair.other).length >= 2,
    'The measured mixture admits the existing group for a field with several source combinations');
  assert.ok(proposal.state.layout.pairs.every((pair: any) => !pair.other
    || ![pair.from.color, pair.other.color].every((color: number) => [recipes[0]!.from, recipes[0]!.other].includes(color))
    || pair.color === recipes[0]!.result), 'The earlier pigment pair cannot be reassigned to an inconsistent result');
  assert.equal(proposal.completes, false);
  assert.equal(proposal.merging, undefined);
  const returned = structuredClone(current.frame), [l, top, r, bottom] = proposal.tile.box;
  for (let y = top; y <= bottom; y++) for (let x = l; x <= r; x++) returned[y]![x] = proposal.pair.from.color;
  const done = await service.handle({ type: 'advance', sessionId, sequence: sequence + 1, ticketId: reply.ticket.id, executionMs: 1,
    observation: toV6PublicObservation({ ...packet, frame: returned, frames: [returned] }, sequence + 1) });
  const trace = done.snapshot.trace as Record<string, any>[];
  assert.equal(trace.findLast(event => event.kind === 'actual_outcome')?.matched, true);
  assert.equal(trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, 1);
  assert.deepEqual(family.state().recipes, recipes, 'Reusing the route keeps the earlier independent mixture evidence');
});

for (const condition of ['missing-participant', 'third-participant', 'contradictory-pigment', 'wrong-control', 'new-context'] as const) test('public mixture acquisition rejects ' + condition + ' without erasing another acquired relation', async () => {
  const s = await acquire(false), { family, before, command, beforePacket } = s, rows = structuredClone(s.afterPacket.frame);
  const earlier = { from: 1, other: 4, result: 6, evidence: 'independent-public-mixture' };
  family.restore!({ ...family.state(), recipes: [earlier] });
  const copy = (box: NativeBox, from: NativeRows, to: number[][]) => {
    for (let y = box[1]; y <= box[3]; y++) for (let x = box[0]; x <= box[2]; x++) to[y]![x] = from[y]![x]!;
  };
  if (condition === 'missing-participant') copy(fixture.mixture.pair.other.box, beforePacket.frame, rows);
  if (condition === 'contradictory-pigment') {
    const [l, t] = fixture.mixture.pair.other.box;
    rows[t]![l] = 15;
  }
  if (condition === 'third-participant') {
    const field = family.state().observed as any;
    const source = field.terminals.find((tile: any) => tile.color !== field.open && tile.color !== fixture.mixture.pair.from.color && tile.color !== fixture.mixture.pair.other.color);
    assert.ok(source);
    const [l, t, r, b] = source.box;
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) if (rows[y]![x] === source.color) rows[y]![x] = fixture.mixture.pair.color;
  }
  const after = condition === 'new-context' ? await s.t.observe({ ...s.afterPacket, frame: rows, level: 3, levelsCompleted: 2 })
    : await s.t.observe({ ...s.afterPacket, frame: rows });
  await family.observePublicOutcome!(before, after, condition === 'wrong-control' ? { action_ref: 'ACTION6', data: { x: 0, y: 0 } } : command,
    beforePacket.frame, rows);
  assert.deepEqual(family.state().recipes, [earlier]);
});

test('an owned route retains the existing acquisition of a mixture completed progressively', async () => {
  const s = await acquire(false), rows = structuredClone(s.beforePacket.frame), pair = fixture.mixture.pair as any;
  const [l, t, r, b] = pair.from.box;
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) rows[y]![x] = s.afterPacket.frame[y]![x]!;
  const before = await s.t.observe({ ...s.beforePacket, frame: rows }), after = await s.t.observe(s.afterPacket);
  await s.family.observePublicOutcome!(before, after, s.command, rows, s.afterPacket.frame);
  assert.deepEqual(s.family.state().recipes, [], 'An unowned return alone does not prove the earlier participation');
  const field = s.family.state().observed as any;
  const tile = field.tiles.find((value: any) => s.command.data.x! >= value.box[0] && s.command.data.x! <= value.box[2]
    && s.command.data.y! >= value.box[1] && s.command.data.y! <= value.box[3]);
  const proposal = { pair, tile, merging: true, completes: false, state: { epoch: before.level_epoch,
    layout: { ...field, pairs: [pair], reserve: 80 }, threads: [], refs: [s.before.observation_ref], rejected: [], count: 1 } } as any;
  assert.equal((await s.family.after(proposal, 0, before, after, rows, s.afterPacket.frame)).matched, true);
  await s.family.record(before, after, s.command, rows, s.afterPacket.frame, proposal, 0);
  assert.equal((s.family.state().recipes as any[]).length, 1);
  assert.equal((s.family.state().recipes as any[])[0].result, pair.color);
});
