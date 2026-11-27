import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeFamily } from '../src/logos-engine/v6-native-types.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import type { V6PublicObservation, V6Ticket } from '../src/runtime/v6-agent-protocol.ts';
import { createSicSettleMatchingEdges } from '../src/sic/settle-matching-edges.ts';
import { preparedEffectsId } from '../src/sic/test-prepared-effects.ts';

type Fault = 'absent_receipt' | 'ambiguous_panel' | 'contradictory_direction' | 'missing_command';

// This small public environment has its own physical update. The role starts
// empty, observes all four controls and two official boundaries, then observes
// a new attachment control operated by another native family.
function edgeRoom(varied: boolean, fault?: Fault) {
  const size = varied ? 6 : 8, pitch = varied ? 5 : 4, origin = (64 - size * pitch) / 2;
  const ink = (n: number) => varied ? (n * 3 + 2) % 16 : n;
  const edges = [8, 11, 14, 9].map(ink), background = ink(5), fixed = ink(0);
  const commands = varied ? ['ACTION4', 'ACTION3', 'ACTION2', 'ACTION1'] : ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'];
  const vectors = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const;
  const training = varied ? [3, 0, 1, 2] : [2, 1, 0, 3];
  let level = 1, completed = 0, moves = 0, attached = true, direction: number | null = null;
  let pieces: { x: number; y: number; ink: number }[] = [];
  let frames: number[][][] | null = null;
  const blocked = (x: number, y: number) => level === 3 && y !== (varied ? size - 1 : 0) && x !== (varied ? size - 3 : 2);
  const matches = (p: { x: number; y: number; ink: number }) => p.y === 0 && p.ink === edges[0]
    || p.y === size - 1 && p.ink === edges[1] || p.x === 0 && p.ink === edges[2]
    || p.x === size - 1 && p.ink === edges[3];
  function prepare() {
    moves = 0; attached = true; direction = null;
    if (level < 3) {
      pieces = [{ x: 2, y: 2, ink: edges[0]! }, { x: size - 2, y: size - 2, ink: edges[3]! }];
      if (varied) pieces = pieces.map(p => ({ x: size - 1 - p.x, y: size - 1 - p.y,
        ink: p.ink === edges[0] ? edges[1]! : edges[2]! }));
    } else {
      direction = varied ? 3 : 2;
      pieces = varied ? [{ x: size - 3, y: size - 1, ink: edges[1]! }, { x: size - 3, y: size - 2, ink: edges[2]! }]
        : [{ x: 2, y: 0, ink: edges[0]! }, { x: 2, y: 1, ink: edges[3]! }];
      if (fault === 'absent_receipt') { attached = false; slide(); }
    }
  }
  function slide() {
    if (direction === null) return;
    const [dx, dy] = vectors[direction]!;
    const ordered = [...pieces].sort((a, b) => (b.x * dx + b.y * dy) - (a.x * dx + a.y * dy));
    for (const p of ordered) {
      while (!attached || !matches(p)) {
        const x = p.x + dx, y = p.y + dy;
        if (x < 0 || y < 0 || x >= size || y >= size || blocked(x, y) || pieces.some(q => q !== p && q.x === x && q.y === y)) break;
        p.x = x; p.y = y;
      }
    }
  }
  function render() {
    const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(background)), end = origin + size * pitch;
    for (let p = origin; p < end; p++) {
      rows[origin - 2]![p] = rows[origin - 1]![p] = edges[0]!;
      rows[end]![p] = rows[end + 1]![p] = edges[1]!;
      rows[p]![origin - 2] = rows[p]![origin - 1] = edges[2]!;
      rows[p]![end] = rows[p]![end + 1] = edges[3]!;
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (blocked(x, y)) {
      for (let v = 0; v < pitch; v++) for (let u = 0; u < pitch; u++) {
        rows[origin + y * pitch + v]![origin + x * pitch + u] = ink(u === 0 || v === 0 || u === pitch - 1 || v === pitch - 1 ? 1 : 3);
      }
    }
    for (const p of pieces) {
      const x = origin + p.x * pitch, y = origin + p.y * pitch;
      for (let v = 0; v < pitch; v++) rows[y + v]!.fill(p.ink, x, x + pitch);
      rows[y + 1]![x + 1] = attached && matches(p) ? fixed : background;
    }
    if (level === 3) {
      const visibleDirection = moves > 0 && fault === 'contradictory_direction' ? (direction! ^ 1) : direction;
      for (const [i, [cx, cy]] of [[32, 5], [32, 58], [5, 32], [58, 32]].entries()) {
        for (let v = -2; v <= 2; v++) for (let u = -2; u <= 2; u++) {
          if (Number(Math.abs(u) === 2) + Number(Math.abs(v) === 2) === 1) rows[cy! + v]![cx! + u] = edges[i]!;
        }
        if (visibleDirection === i) rows[cy!]![cx!] = ink(2);
      }
      for (const x of moves > 0 && fault === 'ambiguous_panel' ? [54, 2] : [54]) {
        for (let v = 0; v < 4; v++) for (let u = 0; u < 5; u++) {
          if (u === 0 || u === 4 || v === 3) rows[54 + v]![x + u] = fixed;
        }
        if (attached) rows[55]![x + 2] = ink(6);
      }
    }
    return rows;
  }
  prepare();
  function packet(stepIndex: number): V6PublicObservation {
    const frame = render(), availableActionIds = commands.map(c => Number(c.slice(6)));
    if (level === 3 && !(moves > 0 && fault === 'missing_command')) availableActionIds.push(5);
    return { frame, frames: frames ?? [frame], level, levelsCompleted: completed,
      state: completed === 3 ? 'WIN' : 'NOT_FINISHED', availableActionIds, stepIndex };
  }
  function act(ticket: V6Ticket) {
    frames = null;
    if (ticket.actionRef === 'ACTION5') attached = !attached;
    else { const d = commands.indexOf(ticket.actionRef); assert.notEqual(d, -1); direction = d; }
    slide(); moves++;
    if (attached && pieces.every(matches)) {
      const terminal = render(); completed++;
      if (completed < 3) { level++; prepare(); }
      frames = [terminal, render()];
    }
  }
  const sourceAction = () => level < 3 ? commands[training[moves]!] : fault === 'absent_receipt' ? commands[direction!] : 'ACTION5';
  return { packet, act, sourceAction, commands, get level() { return level; }, get moves() { return moves; },
    get completed() { return completed; } };
}

async function nativeTransfer(varied: boolean, fault?: Fault) {
  const room = edgeRoom(varied, fault), family = createSicSettleMatchingEdges();
  const offer = (id: string, action: string, ref: string) => ({ status: 'proposed' as const, kind: id,
    actions: [{ action_ref: action, data: {} }], steps: [{}], binding: { observation_ref: ref },
    sicLocalDecision: { strategy: 'observe_public_input' } });
  const basic = { before: (p: any, _i: number, _packet: unknown, observation: any) => ({ admitted: p.binding.observation_ref === observation.observation_ref, reason: 'public_fixture_bound' }),
    after: () => ({ matched: true, seal_prefix: true, reason: 'public_fixture_return' }),
    record: () => ({ events: [] }), state: () => ({}), restore() {} };
  const source: NativeFamily = { ...basic, id: preparedEffectsId, propose(observation) {
    return room.level < 3 || room.moves === 0 ? offer(this.id, room.sourceAction()!, observation.observation_ref) : null;
  } };
  const fallback: NativeFamily = { ...basic, id: 'sic_public_input_exploration', propose(observation) {
    return offer(this.id, room.commands[0]!, observation.observation_ref);
  } };
  const runtime = new NativeV6Runtime({ families: [source, family, fallback], sourceDigest: 'edge-control-public-transfer', maxPointOccurrences: 200,
    groups: [family, source, fallback].map(f => ({ id: f.id + '_group', families: [f.id] })) });
  const service = new V6AgentService(() => runtime), sessionId = `edge-switch-${varied}-${fault ?? 'compatible'}`;
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence, observation: room.packet(sequence),
    budgets: { targetLevels: 3, levelActionCaps: [16, 16, 16] } });
  const tickets: V6Ticket[] = [], returns: typeof reply[] = [], proposals: typeof reply.snapshot.proposal[] = [];
  async function next() {
    assert.ok(reply.ticket, JSON.stringify({ reason: reply.snapshot.reason, completed: room.completed, count: tickets.length }));
    const ticket = reply.ticket; tickets.push(ticket); proposals.push(reply.snapshot.proposal); room.act(ticket);
    reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: ticket.id, executionMs: 1,
      observation: room.packet(sequence) });
    returns.push(reply);
    if (reply.kind === 'boundary' && room.completed < 3) reply = await service.handle({ type: 'resume', sessionId, sequence });
  }
  while (room.level < 3 || room.moves === 0) { assert.ok(tickets.length < 10); await next(); }
  return { room, family, runtime, tickets, returns, proposals, next, get reply() { return reply; } };
}

for (const varied of [false, true]) test('a newly observed edge attachment control is usable before its first score' + (varied ? ' with reflected pieces, another pitch, palette and directional commands' : ''), async () => {
  const run = await nativeTransfer(varied);
  try {
    const acquired = structuredClone(run.family.state().memory);
    assert.equal(acquired.wins, 2);
    assert.equal(acquired.switchVerifiedAt, undefined);
    assert.equal(acquired.switchRefs.release.input, 'ACTION5');
    assert.equal(acquired.switchRefs.attach, undefined);
    assert.equal(run.reply.snapshot.proposal?.kind, run.family.id);
    assert.ok(acquired.switchRefs.release.refs.every((ref: string) => run.reply.snapshot.proposal?.route_refs.includes(ref)));
    while (run.room.completed < 3) {
      assert.ok(run.tickets.length < 15);
      assert.equal(run.reply.snapshot.proposal?.kind, run.family.id);
      const actions = run.reply.snapshot.proposal!.actions;
      if (actions.some(action => action.action_ref === 'ACTION5')) {
        assert.deepEqual(actions, [{ action_ref: 'ACTION5', data: {} }], 'The unobserved inverse remains a unitary probe');
        assert.equal(run.reply.snapshot.proposal?.sicSituationCard?.strategy, 'P05');
      }
      assert.ok(run.reply.ticket?.graphChain && run.reply.ticket.nativeExecutionDigest);
      await run.next();
    }
    assert.equal(run.reply.snapshot.levelsCompleted, 3);
    assert.equal(run.family.state().memory.wins, 3);
    assert.deepEqual(run.family.state().memory.switchRefs.release, acquired.switchRefs.release);
    assert.equal(run.family.state().memory.switchRefs.attach.input, 'ACTION5');
    assert.equal(run.returns.flatMap(reply => reply.snapshot.trace).filter(event => event.kind === 'native_acquisition_incomplete').length, 0);
  } finally { run.runtime.close('test_complete'); }
});

for (const fault of ['absent_receipt', 'ambiguous_panel', 'contradictory_direction', 'missing_command'] as const) test('native edge-control transfer refuses ' + fault + ' while retaining the earlier controls', async () => {
  const run = await nativeTransfer(false, fault);
  try {
    assert.equal(run.reply.snapshot.proposal?.kind, 'sic_public_input_exploration');
    const known = run.family.state().memory;
    assert.equal(known.wins, 2);
    assert.equal(Object.keys(known.controls).length, 4);
    assert.equal(known.switchVerifiedAt, undefined);
    assert.equal(!!known.switchRefs?.release, fault === 'missing_command');
  } finally { run.runtime.close('test_complete'); }
});

test('the actual new release receipt permits the first lost proposal and cannot cross sessions or epochs', async () => {
  const fixture = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/sic-edge-switch-public.json.gz', import.meta.url))).toString());
  const family = createSicSettleMatchingEdges(), { receipt, current } = fixture;
  family.restore(receipt.memory);
  await family.observePublicOutcome!(receipt.before, receipt.after, receipt.command, receipt.first, receipt.second, receipt.frames);
  assert.deepEqual(family.state(), current.memory, 'The receipt is acquired from its real public return');
  const offer = () => family.propose(current.observation, current.rows, [], 23);
  const proposal = await offer();
  assert.deepEqual(proposal?.actions, [{ action_ref: 'ACTION5', data: {} }]);
  assert.equal(proposal?.sicSituationCard?.strategy, 'P05');
  assert.equal(proposal?.sicSituationCard?.movesRemaining, 8);
  for (const mutate of [
    (memory: any) => { delete memory.switchRefs; },
    (memory: any) => { memory.switchRefs.release.input = 'ACTION6'; },
    (memory: any) => { memory.switchRefs.release.refs = memory.switchRefs.release.refs.map((ref: string) => ref.replace(/^.*:epoch:/, 'foreign:epoch:')); },
    (memory: any) => { memory.switchRefs.release.refs = memory.switchRefs.release.refs.map((ref: string) => ref.replace(':epoch:5:', ':epoch:4:')); },
    (memory: any) => { memory.switchRefs.release.refs[1] = memory.switchRefs.release.refs[1].replace(':revision:63:', ':revision:64:'); },
    (memory: any) => { memory.switchRefs.release.refs.reverse(); },
  ]) {
    const retained = structuredClone(current.memory); mutate(retained.memory); family.restore(retained);
    assert.equal(await offer(), null);
    assert.deepEqual(family.state(), retained, 'Refusing an unsupported control keeps the acquired history');
  }
});
