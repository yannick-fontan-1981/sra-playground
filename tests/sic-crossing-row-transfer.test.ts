import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeFamily } from '../src/logos-engine/v6-native-types.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import type { V6PublicObservation, V6Ticket } from '../src/runtime/v6-agent-protocol.ts';
import { continueCrossingRowsGroup, createSicVerifyCrossingRows } from '../src/sic/crossing-rows.ts';
import { planningGroupsWithExperiments } from '../src/sic/experiment-selection-groups.ts';
import { standalonePlanningGroups } from '../src/sic/standalone-families.ts';
import { preparedEffectsId } from '../src/sic/test-prepared-effects.ts';

type Change = 'ambiguous' | 'missing_command' | 'contradictory' | 'missing_reference';

// Independent public crossing interface. Both axes contribute; the direction
// of the row stroke decides which contribution is visible at their overlap.
// The second target mixes those contributions, so the first target's answer
// cannot be replayed. The owner must retain the measured commands and pairs.
function crossingRoom(varied: boolean, change?: Change) {
  const width = varied ? 3 : 2, height = varied ? 2 : 3, size = varied ? 4 : 5, pitch = size + 2;
  const ink = (value: number) => varied ? (value * 3 + 2) % 16 : value;
  const background = ink(5), empty = ink(4), cursor = ink(0), colors = [ink(10), ink(14)];
  const primary = varied ? 'ACTION4' : 'ACTION1', alternate = varied ? 'ACTION3' : 'ACTION2';
  const column = varied ? 'ACTION2' : 'ACTION3', opposite = varied ? 'ACTION1' : 'ACTION4';
  const side = varied ? 1 : -1;
  let level = 1, completed = 0, moves = 0, selected: { axis: number; lane: number } | null = null;
  let progress = [Array(height).fill(0), Array(width).fill(0)];
  let strokes: (string | null)[][][] = Array.from({ length: 2 }, () => Array.from({ length: height }, () => Array(width).fill(null)));
  const geometry = () => ({ x: (varied ? 11 : 21) + (level > 1 ? 2 : 0), y: (varied ? 27 : 21) + (level > 1 ? 3 : 0) });
  const color = (axis: number, lane: number) => level === 1 ? colors[(axis + lane) % 2]! : colors[axis]!;
  const target = (x: number, y: number) => level === 1 ? color(0, y) : colors[(x + y) % 2]!;
  const point = (axis: number, lane: number, oppositeSide = false): [number, number] => {
    const { x, y } = geometry(), edge = oppositeSide ? -side : side;
    return axis === 0 ? [edge < 0 ? x - 4 : x + (width - 1) * pitch + size + 2, y + lane * pitch + Math.floor((size - 1) / 2)]
      : [x + lane * pitch + Math.floor((size - 1) / 2), edge < 0 ? y - 4 : y + (height - 1) * pitch + size + 2];
  };
  function packet(stepIndex: number): V6PublicObservation {
    const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(background)), { x, y } = geometry();
    const tile = (left: number, top: number, w: number, h: number, value: number) => {
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) rows[top + dy]![left + dx] = value;
    };
    for (let cy = 0; cy < height; cy++) for (let cx = 0; cx < width; cx++) {
      const r = strokes[0]![cy]![cx], c = strokes[1]![cy]![cx];
      const value = r && c ? r === primary ? color(0, cy) : color(1, cx) : r ? color(0, cy) : c ? color(1, cx) : empty;
      tile(x + cx * pitch, y + cy * pitch, size, size, value);
      if (!(level === 2 && moves > 0 && change === 'missing_reference')) tile(52 + cx, 3 + cy, 1, 1, target(cx, cy));
    }
    for (let axis = 0; axis < 2; axis++) for (let lane = 0; lane < (axis === 0 ? height : width); lane++) {
      const [cx, cy] = point(axis, lane); tile(cx - 1, cy - 1, 3, 3, color(axis, lane));
      if (level === 2 && moves > 0 && change === 'ambiguous') {
        const [ox, oy] = point(axis, lane, true); tile(ox - 1, oy - 1, 3, 3, color(axis, lane));
      }
    }
    if (selected) {
      const count = selected.axis === 0 ? width : height, next = progress[selected.axis]![selected.lane]!;
      if (next < count) {
        const along = side < 0 ? next : count - 1 - next;
        const cx = selected.axis === 0 ? along : selected.lane, cy = selected.axis === 0 ? selected.lane : along;
        rows[y + cy * pitch + Math.floor(size / 2)]![x + cx * pitch + Math.floor(size / 2)] = cursor;
      }
    }
    if (level === 2 && moves > 0 && change === 'contradictory') {
      const cx = side < 0 ? 0 : width - 1;
      rows[y + Math.floor(size / 2)]![x + cx * pitch + Math.floor(size / 2)] = ink(8);
    }
    const availableActionIds = level === 1 ? [Number(primary.slice(6)), Number(column.slice(6)), 6]
      : moves > 0 && change === 'missing_command' ? [5, 6] : [1, 2, 3, 4, 5, 6];
    return { frame: rows, frames: [rows], level, levelsCompleted: completed, state: completed === 2 ? 'WIN' : 'NOT_FINISHED',
      availableActionIds, stepIndex };
  }
  function act(ticket: V6Ticket) {
    if (ticket.actionRef === 'ACTION6') {
      const matches = [0, 1].flatMap(axis => Array.from({ length: axis === 0 ? height : width }, (_, lane) => ({ axis, lane })))
        .filter(({ axis, lane }) => { const [x, y] = point(axis, lane); return Math.abs(Number(ticket.data.x) - x) <= 1 && Math.abs(Number(ticket.data.y) - y) <= 1; });
      assert.equal(matches.length, 1, 'The ticket selects a unique current line'); selected = matches[0]!;
    } else if (selected && (selected.axis === 0 ? [primary, alternate] : [column, opposite]).includes(ticket.actionRef)) {
      const { axis, lane } = selected, limit = axis === 0 ? width : height, next = progress[axis]![lane]!;
      if (next >= limit) return;
      const along = side < 0 ? next : limit - 1 - next, x = axis === 0 ? along : lane, y = axis === 0 ? lane : along;
      strokes[axis]![y]![x] = ticket.actionRef; progress[axis]![lane]++; moves++;
    }
    const finished = progress[0]!.every(count => count === width) && progress[1]!.every(count => count === height)
      && strokes[0]!.every((row, y) => row.every((r, x) => (r === primary ? color(0, y) : color(1, x)) === target(x, y)));
    if (finished) {
      completed++;
      if (completed < 2) { level++; moves = 0; selected = null; progress = [Array(height).fill(0), Array(width).fill(0)];
        strokes = Array.from({ length: 2 }, () => Array.from({ length: height }, () => Array(width).fill(null))); }
    }
  }
  return { packet, act, primary, column, get level() { return level; }, get completed() { return completed; }, get moves() { return moves; } };
}

async function start(varied = false, change?: Change) {
  const room = crossingRoom(varied, change), family = createSicVerifyCrossingRows();
  const calls: { entry: string | null; completed: number; proposed: boolean }[] = [];
  const offer = family.proposeInSubquestion!.bind(family);
  family.proposeInSubquestion = async (group, entry, observation, ...rest) => {
    const proposal = await offer(group, entry, observation, ...rest); calls.push({ entry, completed: observation.levels_completed, proposed: proposal !== null }); return proposal;
  };
  const fallback: NativeFamily = {
    id: preparedEffectsId,
    proposeInSubquestion(_group, _entry, ...args) { return this.propose(...args); },
    propose(observation) {
      if (room.level !== 2 || !room.moves) return null;
      const action = { action_ref: 'ACTION5', data: {} };
      return { status: 'proposed', kind: this.id, actions: [action], steps: [{ action }], binding: { observation_ref: observation.observation_ref } };
    },
    before: (proposal, index, _packet, observation) => ({ admitted: index === 0 && proposal.binding?.observation_ref === observation.observation_ref, reason: 'foreign_trial_bound' }),
    after: () => ({ matched: null, seal_prefix: true, reason: 'foreign_trial_return' }),
    record: () => ({ events: [] }), state: () => ({}), restore() {},
  };
  const groups = planningGroupsWithExperiments(standalonePlanningGroups).map(group => {
    const entries = group.families.flatMap((id, index) => [family.id, fallback.id].includes(id) ? [{ id, entry: group.entryPoints?.[index] ?? null }] : []);
    return { ...group, families: entries.map(item => item.id), entryPoints: entries.map(item => item.entry) };
  }).filter(group => group.families.length);
  const runtime = new NativeV6Runtime({ families: [family, fallback], groups, sourceDigest: 'public-crossing-transfer', maxPointOccurrences: 200 });
  const service = new V6AgentService(() => runtime), sessionId = `crossing-transfer-${varied}-${change ?? 'compatible'}`;
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence, observation: room.packet(sequence),
    budgets: { targetLevels: 2, levelActionCaps: [60, 70] } });
  const tickets: V6Ticket[] = [], returns: typeof reply[] = [], owners: unknown[] = [];
  async function next() {
    assert.ok(reply.ticket, JSON.stringify({ reason: reply.snapshot.reason, completed: room.completed, count: tickets.length }));
    const ticket = reply.ticket; tickets.push(ticket); owners.push(reply.snapshot.proposal?.kind); room.act(ticket);
    reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: ticket.id, executionMs: 1, observation: room.packet(sequence) });
    returns.push(reply);
    if (reply.kind === 'boundary' && room.completed < 2) reply = await service.handle({ type: 'resume', sessionId, sequence });
  }
  while (room.level === 1 || room.moves === 0) { assert.ok(tickets.length < 60); await next(); }
  return { room, family, runtime, tickets, returns, owners, calls, next, get reply() { return reply; } };
}

for (const varied of [false, true]) test('a native crossing role continues before the unrelated preview' + (varied ? ' with reflected controls, different field shape, pitch, palette and commands' : ''), async () => {
  const run = await start(varied);
  try {
    const learned = structuredClone(run.family.state().acquired);
    assert.equal(learned.boundary.completed, 1);
    assert.ok(learned.pairs.some((pair: any) => pair.commands[0] === run.room.primary && pair.commands[1] === run.room.column));
    assert.ok(run.calls.filter(call => call.entry === continueCrossingRowsGroup && call.completed === 0).every(call => !call.proposed));
    assert.equal(run.reply.snapshot.proposal?.kind, run.family.id);
    assert.equal(run.calls.at(-1)?.entry, continueCrossingRowsGroup);
    assert.ok(run.reply.snapshot.proposal?.route_refs.includes(learned.pairs[0].proof));
    assert.ok(run.reply.snapshot.proposal?.route_refs.includes(learned.boundary.evidence[1]));
    assert.ok(run.reply.ticket?.graphChain && run.reply.ticket.nativeExecutionDigest);
    while (run.room.completed < 2) { assert.ok(run.tickets.length < 100); await run.next(); }
    assert.equal(run.reply.snapshot.levelsCompleted, 2);
    assert.ok(run.owners.every(owner => owner === run.family.id));
    assert.equal(run.returns.flatMap(reply => reply.snapshot.trace).filter(event => event.kind === 'native_acquisition_incomplete').length, 0);
  } finally { run.runtime.close('test_complete'); }
});

for (const change of ['ambiguous', 'missing_command', 'contradictory', 'missing_reference'] as const) test('native crossing continuation declines ' + change + ' and retains the prior role', async () => {
  const run = await start(false, change);
  try {
    assert.equal(run.reply.snapshot.proposal?.kind, preparedEffectsId);
    assert.equal(run.calls.findLast(call => call.entry === continueCrossingRowsGroup && call.completed === 1)?.proposed, false);
    assert.ok(run.family.state().acquired.pairs.length > 0);
    assert.equal(run.family.state().acquired.boundary.completed, 1);
    if (change === 'contradictory' || change === 'missing_reference') {
      assert.equal(run.family.state().state.stopped, true);
      assert.equal(run.returns.at(-1)?.snapshot.trace.findLast(event => event.kind === 'actual_outcome')?.matched, false);
    }
  } finally { run.runtime.close('test_complete'); }
});

test('the first public lost crossing proposal reuses its actual official boundary and rejects stale or foreign evidence', async () => {
  const captured = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/sic-crossing-current-public.json.gz', import.meta.url))).toString());
  const family = createSicVerifyCrossingRows(), { score, current } = captured;
  await family.attachPrograms!(new NativeKnowledgeStore('public-crossing-capture', 'captured-reproposal'));
  family.restore(score.memory);
  await family.record(score.before, score.after, score.command, score.first, score.second, score.proposal, score.index, []);
  const acquired = structuredClone(family.state().acquired);
  const retained = { ...current.memory, acquired };
  const offer = () => family.proposeInSubquestion!('continue_observed_pressure_recovery', continueCrossingRowsGroup,
    current.observation, current.rows, [], 30);
  family.restore(retained);
  const proposal = await offer();
  assert.deepEqual(proposal?.actions, [{ action_ref: 'ACTION2', data: {} }]);
  assert.ok(proposal?.route_refs.includes(acquired.boundary.evidence[1]));
  assert.equal(captured.actual.family, preparedEffectsId);
  assert.equal(captured.actual.command.id, 1);
  for (const mutate of [
    (value: any) => { value.acquired = null; },
    (value: any) => { value.acquired.boundary.scope = 'foreign-session'; },
    (value: any) => { value.acquired.boundary.epoch++; },
    (value: any) => { value.acquired.boundary.completed++; },
    (value: any) => { value.state.evidence.pop(); },
  ]) {
    const incompatible = structuredClone(retained); mutate(incompatible); family.restore(incompatible);
    const before = structuredClone(family.state());
    assert.equal(await offer(), null);
    assert.deepEqual(family.state(), before, 'Refusing early priority does not erase retained facts');
  }
});
