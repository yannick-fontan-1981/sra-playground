import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { createSicNavigateRevealedGrid } from '../src/sic/navigate-revealed-grid.ts';

type Family = ReturnType<typeof createSicNavigateRevealedGrid>;
type Proposal = Parameters<Family['after']>[0];
type Grid = Proposal['local']['grid'];
type Packet = Pick<GameObservation, 'frame' | 'level' | 'levelsCompleted' | 'state' | 'availableActionIds'> & { frames?: number[][][] };
type Transition = { before: Packet; after: Packet; action: number; family: string };
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-patrol-terrain-public.json.gz', import.meta.url))).toString()) as {
  learning: Transition[]; walk: Transition[]; selectedDetour: Transition[]; mechanismAfterDetour: Transition; grid: Grid; acquired: { state: Proposal['local'] }; proposal: Proposal;
};
const exitFixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-grid-exit-probe-public.json.gz', import.meta.url))).toString()) as {
  steps: [Transition, Transition]; atProbe: ReturnType<Family['state']>;
};
const tile = (grid: Grid, cell: number) => [grid.box[0] + cell % grid.columns * grid.pitch,
  grid.box[1] + Math.floor(cell / grid.columns) * grid.pitch] as const;
const mapped = (cell: number) => Math.floor(cell / fixture.grid.columns) * fixture.grid.columns + fixture.grid.columns - 1 - cell % fixture.grid.columns;
function transform(value: Packet, varied: boolean): Packet {
  if (!varied) return structuredClone(value);
  const raster = (source: number[][]) => {
    const rows = structuredClone(source), grid = fixture.grid;
    if (value.level === fixture.walk[0]!.before.level) for (let cell = 0; cell < grid.size; cell++) {
      const [x, y] = tile(grid, cell), [u, v] = tile(grid, mapped(cell));
      for (let dy = 0; dy < grid.pitch; dy++) for (let dx = 0; dx < grid.pitch; dx++) rows[v + dy]![u + dx] = source[y + dy]![x + dx]!;
      if (grid.mechanisms?.pads[cell]?.[0]) {
        const m = Math.floor((grid.pitch - 1) / 2), left = rows[v + m]![u + m - 1]!;
        rows[v + m]![u + m - 1] = rows[v + m]![u + m + 1]!;
        rows[v + m]![u + m + 1] = left;
      }
      if (grid.actorPixels!.every(([dx, dy]) => source[y + dy]?.[x + dx] === grid.actor)) {
        for (const [dx, dy] of grid.actorPixels!) rows[v + dy]![u + dx] = grid.base;
        for (const [dx, dy] of [[2, 1], [1, 2], [2, 2]] as const) rows[v + dy]![u + dx] = grid.actor;
      }
    }
    return rows.map(row => row.map(ink => (ink * 5 + 3) % 16));
  };
  return { ...value, frame: raster(value.frame), frames: (value.frames ?? [value.frame]).map(raster) };
}
const action = (step: Transition, varied: boolean) => varied && step.before.level === fixture.walk[0]!.before.level
  && (step.action === 3 || step.action === 4) ? 7 - step.action : step.action;
const packet = (value: Packet, index: number) => toV6PublicObservation({ ...value, gameCode: 'PUBLIC', levelCount: 6,
  frames: value.frames ?? [value.frame], canUndo: false, canSelectLevel: false, defaultFps: 10 }, index);

for (const varied of [false, true]) test('native navigation retains known terrain beneath independently measured patrols'
  + (varied ? ' after reflecting geometry, remapping colors, changing the carrier and reversing horizontal commands' : ''), async () => {
  const family = createSicNavigateRevealedGrid();
  const runtime = new NativeV6Runtime({ families: [family], sourceDigest: 'patrol-terrain-role', maxPointOccurrences: 300 });
  const service = new V6AgentService(() => runtime), sessionId = 'patrol-terrain-' + varied;
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence,
    observation: packet(transform(fixture.learning[0]!.before, varied), 0), budgets: { targetLevels: 6, levelActionCaps: [80, 80, 80, 80, 80, 80] } });
  let holding: { revision: number; before: ReturnType<Family['state']>; count: number } | null = null;
  let heldCommands = 0;
  try {
    for (const step of fixture.learning) {
      if (!reply.ticket) reply = await service.handle({ type: 'resume', sessionId, sequence });
      assert.ok(reply.ticket, JSON.stringify({ sequence, reason: reply.reason }));
      assert.equal(reply.ticket.actionRef, 'ACTION' + action(step, varied), 'Learning command ' + (sequence + 1));
      const offered = reply.snapshot.proposal as Proposal;
      if (offered.hold) {
        if (!holding) {
          holding = { revision: reply.ticket.decisionRevision, before: structuredClone(family.state()), count: offered.actions.length };
          assert.equal(holding.count, 3, 'The measured rail cadence bounds the needed waiting prefix');
          assert.deepEqual(offered.hold.role, holding.before.state!.stationary);
          assert.ok(offered.route_refs?.includes(offered.hold.role.before) && offered.route_refs?.includes(offered.hold.role.after));
        }
        assert.equal(reply.ticket.decisionRevision, holding.revision);
        assert.equal(reply.ticket.actionIndex, heldCommands);
      }
      reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id,
        executionMs: 1, observation: packet(transform(step.after, varied), sequence) });
      if (offered.hold) {
        heldCommands++;
        const actual = reply.snapshot.trace.findLast(event => event.kind === 'actual_outcome');
        assert.equal(actual?.matched, true);
        if (heldCommands < holding!.count) assert.deepEqual(family.state(), holding!.before);
        else {
          assert.equal(reply.snapshot.trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, 3);
          assert.equal((family.state().state as Proposal['local']).last.charges, offered.local.last.charges);
        }
      }
    }
    assert.equal(heldCommands, 3, 'The first useful repetition reuses the acquired stationary control');
    const before = structuredClone(family.state());
    reply = await service.handle({ type: 'resume', sessionId, sequence });
    assert.ok(reply.ticket);
    const proposal = reply.snapshot.proposal as Proposal, revision = reply.ticket.decisionRevision;
    assert.equal(proposal.actions.length, 8);
    const crossed = [111, 112, 113].map(cell => varied ? mapped(cell) : cell);
    assert.ok(crossed.every(cell => proposal.local.last.memory[cell] === 'free'));
    for (const [index, step] of fixture.walk.entries()) {
      assert.ok(reply.ticket);
      assert.equal(reply.ticket.decisionRevision, revision);
      assert.equal(reply.ticket.actionIndex, index);
      assert.equal(reply.ticket.actionRef, 'ACTION' + action(step, varied));
      reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id,
        executionMs: 1, observation: packet(transform(step.after, varied), sequence) });
      const outcome = reply.snapshot.trace.findLast(event => event.kind === 'actual_outcome');
      assert.equal(outcome?.matched, true); assert.equal(outcome?.seal_prefix, index + 1 === fixture.walk.length);
      if (index + 1 < fixture.walk.length) assert.deepEqual(family.state(), before, 'Actual readings remain private until the single ordered reconciliation');
    }
    assert.equal(reply.snapshot.acquiredRecords, fixture.learning.length + 8);
    const seal = reply.snapshot.trace.filter(event => event.kind === 'sealed_prefix' && event.revision === revision);
    assert.equal(seal.length, 1); assert.equal(seal[0]!.acquired_actions, 8);
    const acquired = family.state().state as Proposal['local'];
    assert.ok(crossed.every(cell => acquired.last.memory[cell] === 'free'), 'A moving patrol does not replace independently known terrain');
    assert.ok(acquired.last.sentries?.length);
    assert.equal(acquired.timing!.clock!.turn, proposal.local.timing!.clock!.turn + 8);
    reply = await service.handle({ type: 'resume', sessionId, sequence });
    assert.ok(reply.ticket);
    const detour = reply.snapshot.proposal as Proposal, detourRevision = reply.ticket.decisionRevision;
    assert.equal(detour.sicSituationCard?.strategy, 'P07', 'The selected ordinary access keeps its learned movement role');
    assert.equal(detour.actions.length, 2, 'The selected safe path retains both already known cells');
    assert.equal(detour.walk?.[0]!.target, detour.choice.target);
    const detourBefore = structuredClone(family.state());
    for (const [index, step] of fixture.selectedDetour.entries()) {
      assert.ok(reply.ticket); assert.equal(reply.ticket.decisionRevision, detourRevision);
      assert.equal(reply.ticket.actionIndex, index); assert.equal(reply.ticket.actionRef, 'ACTION' + action(step, varied));
      reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id,
        executionMs: 1, observation: packet(transform(step.after, varied), sequence) });
      assert.equal(reply.snapshot.trace.findLast(event => event.kind === 'actual_outcome')?.matched, true);
      if (index === 0) assert.deepEqual(family.state(), detourBefore);
    }
    const detourSeals = reply.snapshot.trace.filter(event => event.kind === 'sealed_prefix' && event.revision === detourRevision);
    assert.equal(detourSeals.length, 1); assert.equal(detourSeals[0]!.acquired_actions, 2);
    assert.equal(family.state().state!.timing!.clock!.turn, acquired.timing!.clock!.turn + 2);
    reply = await service.handle({ type: 'resume', sessionId, sequence });
    assert.ok(reply.ticket); assert.equal(reply.ticket.actionRef, 'ACTION' + action(fixture.mechanismAfterDetour, varied));
    assert.equal((reply.snapshot.proposal as Proposal).actions.length, 1, 'The unmeasured marker landing remains a separate experiment');
    for (const step of [fixture.mechanismAfterDetour, exitFixture.steps[0]]) {
      assert.ok(reply.ticket); assert.equal(reply.ticket.actionRef, 'ACTION' + action(step, varied));
      assert.equal((reply.snapshot.proposal as Proposal).actions.length, 1);
      reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id,
        executionMs: 1, observation: packet(transform(step.after, varied), sequence) });
      reply = await service.handle({ type: 'resume', sessionId, sequence });
    }
    const exitProbe = exitFixture.steps[1];
    assert.ok(reply.ticket); assert.equal(reply.ticket.actionRef, 'ACTION' + action(exitProbe, varied));
    const plannedExit = reply.snapshot.proposal as Proposal, exitRevision = reply.ticket.decisionRevision;
    assert.equal(plannedExit.sicSituationCard?.strategy, 'P05');
    assert.equal(plannedExit.choice.uncertain, true, 'The first step is an experiment until the actual return');
    assert.equal(plannedExit.local.last.memory[plannedExit.choice.target], undefined);
    assert.equal(plannedExit.actions.length, 2);
    assert.equal(plannedExit.walk?.[1]?.target, plannedExit.local.grid.goal);
    const exitBefore = structuredClone(family.state());
    const acquiredBefore = reply.snapshot.acquiredRecords;
    reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id,
      executionMs: 1, observation: packet(transform(exitProbe.after, varied), sequence) });
    assert.ok(reply.ticket);
    assert.equal(reply.ticket.decisionRevision, exitRevision);
    assert.equal(reply.ticket.actionIndex, 1);
    assert.equal(reply.ticket.actionRef, 'ACTION' + (varied ? 3 : 4));
    assert.deepEqual(family.state(), exitBefore, 'The probe return is private until the single seal');
    assert.equal(reply.snapshot.acquiredRecords, acquiredBefore);
    // Functional terminal fixture for the next native ticket. Only the probe
    // return before this packet is retained from the backend diagnostic.
    const terminal: Packet = { ...structuredClone(exitProbe.after), state: 'WIN', levelsCompleted: 6 };
    const unmirroredGrid = exitFixture.atProbe.state!.grid;
    const [x, y] = tile(unmirroredGrid, exitFixture.atProbe.state!.last.position - unmirroredGrid.columns);
    const [goalX, goalY] = tile(unmirroredGrid, unmirroredGrid.goal);
    for (const [dx, dy] of unmirroredGrid.actorPixels!) {
      terminal.frame[y + dy]![x + dx] = unmirroredGrid.base;
      terminal.frame[goalY + dy]![goalX + dx] = unmirroredGrid.actor;
    }
    terminal.frames = [terminal.frame];
    reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id,
      executionMs: 1, observation: packet(transform(terminal, varied), sequence) });
    const exitSeals = reply.snapshot.trace.filter(event => event.kind === 'sealed_prefix' && event.revision === exitRevision);
    assert.equal(exitSeals.length, 1); assert.equal(exitSeals[0]!.acquired_actions, 2);
    assert.equal(reply.snapshot.acquiredRecords, acquiredBefore + 2);
    assert.equal(family.state().state!.completed?.score, 6);
  } finally { runtime.close('test_complete'); }
});

for (const condition of ['wrong-arrival', 'ambiguous-carrier', 'changed-exit', 'new-patrol', 'stale-return', 'one-action-budget'] as const)
  test('the experimental exit approach stops on ' + condition, async () => {
    const family = createSicNavigateRevealedGrid(), current = exitFixture.steps[1];
    family.restore(structuredClone(exitFixture.atProbe));
    const observe = (value: Packet, revision: number) => measureNativeObservation({
      frame_rows: value.frame, frame_hash: 'exit-probe-' + revision, level: value.level, levels_completed: value.levelsCompleted,
      state: value.state, available_action_refs: value.availableActionIds.map(id => 'ACTION' + id),
    }, revision, 'exit-probe');
    const before = await observe(current.before, 162);
    const proposal = await family.propose(before, current.before.frame, [], condition === 'one-action-budget' ? 1 : 2);
    assert.ok(proposal);
    if (condition === 'one-action-budget') {
      assert.equal(proposal.actions.length, 1);
      assert.equal(proposal.exitAfterProbe, undefined);
      return;
    }
    assert.equal(proposal.actions.length, 2);
    const actual = structuredClone(condition === 'wrong-arrival' ? current.before : current.after);
    const grid = proposal.local.grid;
    if (condition === 'changed-exit') {
      const [x, y] = tile(grid, grid.goal);
      actual.frame[y]![x] = (actual.frame[y]![x]! + 1) % 16;
    }
    if (condition === 'ambiguous-carrier') {
      const [x, y] = tile(grid, proposal.local.last.position);
      for (const [dx, dy] of grid.actorPixels!) actual.frame[y + dy]![x + dx] = grid.actor;
    }
    if (condition === 'new-patrol') {
      const [x, y] = tile(grid, grid.goal - grid.columns);
      for (const [dx, dy, ink] of grid.sentryPatterns![0]!) actual.frame[y + dy]![x + dx] = ink;
    }
    const after = await observe(actual, 163);
    const returned = await family.after(proposal, 0, before, after, current.before.frame, actual.frame, [actual.frame]);
    const packet = { frame_rows: actual.frame } as Parameters<Family['before']>[2];
    if (condition === 'stale-return') {
      assert.equal(returned.seal_prefix, false);
      assert.equal((await family.before(proposal, 1, packet, after)).admitted, true);
      assert.equal((await family.before(proposal, 1, packet, { ...after, observation_ref: before.observation_ref })).admitted, false);
    } else {
      assert.equal(returned.seal_prefix, true);
      if (condition === 'new-patrol') assert.equal(returned.matched, true, 'Arrival alone does not justify continuing through a hazard');
    }
    assert.deepEqual(family.state(), exitFixture.atProbe, 'Checking a hypothesis does not publish acquisition');
  });

for (const changed of ['patrol-role', 'unrecognized-wall', 'ambiguous-carrier', 'route-wall'] as const)
  test('the returned patrol role distinguishes ' + changed + ' without losing independent facts', async () => {
    const family = createSicNavigateRevealedGrid(), proposal = structuredClone(fixture.proposal);
    family.restore(fixture.acquired);
    const previous = structuredClone(family.state()), first = structuredClone(fixture.walk[0]!.before), second = structuredClone(fixture.walk[0]!.after);
    const grid = proposal.local.grid, paintWall = (cell: number) => {
      const [x, y] = tile(grid, cell), ink = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]
        .find(value => ![grid.base,grid.tint,grid.actor,grid.enemy].includes(value))!;
      for (let dy = 0; dy < grid.pitch; dy++) for (let dx = 0; dx < grid.pitch; dx++) second.frame[y + dy]![x + dx] = dy === 0 ? ink : grid.base;
    };
    if (changed === 'unrecognized-wall') paintWall(111);
    if (changed === 'route-wall') paintWall(proposal.walk![1]!.target);
    if (changed === 'ambiguous-carrier') {
      const [x,y] = tile(grid, proposal.walk![1]!.target);
      for (const [dx,dy] of grid.actorPixels!) second.frame[y + dy]![x + dx] = grid.actor;
    }
    const observe = (value: Packet, revision: number) => measureNativeObservation({ frame_rows: value.frame,
      frame_hash: 'patrol-terrain-' + revision, level: value.level, levels_completed: value.levelsCompleted,
      state: value.state, available_action_refs: value.availableActionIds.map(id => 'ACTION' + id) }, revision, 'native-patrol-counterexample');
    const before = await observe(first, 1), after = await observe(second, 2);
    proposal.binding!.observation_ref = before.observation_ref;
    const returned = await family.after(proposal, 0, before, after, first.frame, second.frame, second.frames ?? [second.frame]);
    assert.equal(returned.seal_prefix, changed !== 'patrol-role');
    assert.equal(returned.matched, changed === 'ambiguous-carrier' ? false : true);
    assert.deepEqual(family.state(), previous, 'Inspection preserves the independently acquired state until native record');
  });

for (const changed of ['none', 'missing-carrier', 'duplicate-carrier', 'displacement', 'spent-charge', 'opened-wall', 'cleared-passage'] as const)
  test('an acquired stationary control stops precisely on ' + changed, async () => {
    const lesson = fixture as typeof fixture & { holdTeaching: (Transition & { observation: any })[]; holdAcquired: { state: Proposal['local'] } };
    const family = createSicNavigateRevealedGrid(); family.restore(lesson.holdAcquired);
    const [teaching, repeated] = lesson.holdTeaching;
    const observe = (value: Packet, revision: number) => measureNativeObservation({ frame_rows: value.frame,
      frame_hash: 'hold-public-' + revision, level: value.level, levels_completed: value.levelsCompleted,
      state: value.state, available_action_refs: value.availableActionIds.map(id => 'ACTION' + id) }, revision, 'hold-public-session');
    const before = await observe(teaching!.before, 1), established = await observe(teaching!.after, 2);
    const first = await family.propose(before, teaching!.before.frame, [], 35);
    assert.ok(first); assert.equal(first.hold, undefined, 'An unproved stationary control remains an individual experiment');
    assert.equal(first.choice.kind, 'wait');
    await family.record(before, established, first.actions[0]!, teaching!.before.frame, teaching!.after.frame, first, 0,
      teaching!.after.frames ?? [teaching!.after.frame]);
    const acquired = structuredClone(family.state()), role = acquired.state!.stationary!;
    assert.equal(role.before, before.observation_ref); assert.equal(role.after, established.observation_ref);
    const offered = await family.propose(established, repeated!.before.frame, [], 34);
    assert.ok(offered?.hold); assert.equal(offered.actions.length, 3);
    const returned = structuredClone(repeated!.after), grid = offered.local.grid, [x, y] = tile(grid, role.at);
    if (changed === 'missing-carrier' || changed === 'displacement')
      for (const [dx,dy] of grid.actorPixels!) returned.frame[y + dy]![x + dx] = grid.base;
    if (changed === 'duplicate-carrier' || changed === 'displacement') {
      const [u,v] = tile(grid, role.at - 1);
      for (const [dx,dy] of grid.actorPixels!) returned.frame[v + dy]![u + dx] = grid.actor;
    }
    if (changed === 'spent-charge') {
      const charge = grid.charges.find(([x,y]) => returned.frame[y]![x] === grid.enemy)!;
      returned.frame[charge[1]]![charge[0]] = grid.base;
    }
    if (changed === 'opened-wall' || changed === 'cleared-passage') {
      const [u,v] = tile(grid, changed === 'opened-wall' ? role.wall : offered.hold.target);
      for (let dy=0;dy<grid.pitch;dy++) for(let dx=0;dx<grid.pitch;dx++) returned.frame[v+dy]![u+dx]=grid.tint;
    }
    const after = await observe(returned, 3);
    const effect = await family.after(offered, 0, established, after, repeated!.before.frame, returned.frame, [returned.frame]);
    assert.equal(effect.matched, changed === 'none' || changed === 'cleared-passage');
    assert.equal(effect.seal_prefix, changed !== 'none');
    assert.deepEqual(family.state(), acquired, 'Checking a contradictory return preserves all prior independently acquired navigation');
    if (changed === 'none') {
      const packet = { frame_rows: returned.frame } as any;
      assert.equal((await family.before(offered, 1, packet, after)).admitted, true);
      assert.equal((await family.before(offered, 1, packet, { ...after, observation_ref: after.observation_ref + ':missing-return' })).admitted, false);
    }
  });

for (const condition of ['repeated-public-cycle', 'missing-period', 'incomplete-cycle', 'contradicted-cycle', 'ambiguous-track'] as const)
  test('a remembered rail cell requires ' + condition, async () => {
    const family = createSicNavigateRevealedGrid(), saved = structuredClone(fixture.acquired), local = saved.state;
    const actual = fixture.walk[6]!.after.frame, grid = fixture.grid;
    const target = Array.from({ length: grid.size }, (_, cell) => cell).find(cell => {
      const [x,y] = tile(grid,cell);
      return actual[y]![x] !== grid.enemy && grid.actorPixels!.every(([dx,dy]) => actual[y+dy]![x+dx] === grid.actor);
    })!;
    assert.ok(Number.isSafeInteger(target));
    const index = local.timing!.walls.findIndex(track => track.includes(target) && track.length > 8);
    assert.ok(index >= 0);
    if (condition === 'missing-period') for (const rail of Object.values(local.timing!.clock!.rails)) delete rail.period;
    if (condition === 'incomplete-cycle') local.timing!.walls[index] = local.timing!.walls[index]!.slice(-7);
    if (condition === 'contradicted-cycle') local.timing!.walls[index]![5] = local.timing!.walls[index]![5]! + 1;
    if (condition === 'ambiguous-track') local.timing!.walls.push([...local.timing!.walls[index]!]);
    family.restore(saved);
    const prior = structuredClone(family.state()), current = fixture.walk[0]!.before;
    const observation = await measureNativeObservation({ frame_rows: current.frame, frame_hash: 'rail-recurrence-current',
      level: current.level, levels_completed: current.levelsCompleted, state: current.state,
      available_action_refs: current.availableActionIds.map(id => 'ACTION' + id) }, 150, 'rail-recurrence');
    const offered = await family.propose(observation, current.frame, [], 35);
    assert.ok(offered);
    assert.equal(offered.actions.length, condition === 'repeated-public-cycle' ? 8 : 6);
    assert.deepEqual(family.state(), prior, 'Forecasting an acquired cycle does not publish new observations');
  });

test('an actual rail return contradicting the acquired recurrence closes before its future crossing', async () => {
  const family = createSicNavigateRevealedGrid(); family.restore(fixture.acquired);
  const first = fixture.walk[0]!.before, second = structuredClone(fixture.walk[0]!.after), grid = fixture.grid;
  const observe = (value: Packet, revision: number) => measureNativeObservation({ frame_rows: value.frame,
    frame_hash: 'rail-changed-' + revision, level: value.level, levels_completed: value.levelsCompleted,
    state: value.state, available_action_refs: value.availableActionIds.map(id => 'ACTION' + id) }, revision, 'rail-changed');
  const before = await observe(first, 1), proposal = await family.propose(before, first.frame, [], 35);
  assert.ok(proposal); assert.equal(proposal.actions.length, 8);
  const futureCell = proposal.walk![6]!.target;
  const track = proposal.local.timing!.walls.find(track => track.includes(futureCell) && track.length > 8)!;
  const expected = track[0]!, [x,y] = tile(grid,expected), [u,v] = tile(grid,futureCell);
  const pixels = second.frame.slice(y,y+grid.pitch).map(row=>row.slice(x,x+grid.pitch));
  assert.equal(pixels[0]![0],grid.enemy);
  for(let dy=0;dy<grid.pitch;dy++) for(let dx=0;dx<grid.pitch;dx++) {
    second.frame[v+dy]![u+dx]=pixels[dy]![dx]!;
    second.frame[y+dy]![x+dx]=grid.tint;
  }
  const retained = structuredClone(family.state());
  const outcome = await family.after(proposal, 0, before, await observe(second,2), first.frame, second.frame, [second.frame]);
  assert.equal(outcome.matched,true); assert.equal(outcome.seal_prefix,true);
  assert.deepEqual(family.state(),retained);
});

for (const changed of ['ambiguous-carrier', 'contradicted-next-cell'] as const)
  test('a native selected-route prefix closes on ' + changed + ' and preserves the unrelated acquired role', async () => {
    const family = createSicNavigateRevealedGrid();
    const runtime = new NativeV6Runtime({ families: [family], sourceDigest: 'selected-route-counterexample', maxPointOccurrences: 300 });
    const service = new V6AgentService(() => runtime), sessionId = 'selected-route-' + changed;
    let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence,
      observation: packet(fixture.learning[0]!.before, 0), budgets: { targetLevels: 6, levelActionCaps: [80,80,80,80,80,80] } });
    try {
      for (const step of [...fixture.learning, ...fixture.walk]) {
        if (!reply.ticket) reply = await service.handle({ type: 'resume', sessionId, sequence });
        assert.ok(reply.ticket); assert.equal(reply.ticket.actionRef, 'ACTION' + step.action);
        reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id,
          executionMs: 1, observation: packet(step.after, sequence) });
      }
      reply = await service.handle({ type: 'resume', sessionId, sequence });
      assert.ok(reply.ticket); const proposal = reply.snapshot.proposal as Proposal;
      assert.equal(proposal.actions.length, 2);
      const acquired = structuredClone(family.state()), returned = structuredClone(fixture.selectedDetour[0]!.after);
      const grid = proposal.local.grid, [x,y] = tile(grid,proposal.walk![1]!.target);
      if (changed === 'ambiguous-carrier') {
        for (const [dx,dy] of grid.actorPixels!) returned.frame[y+dy]![x+dx] = grid.actor;
      } else {
        const ink = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].find(value => ![grid.base,grid.tint,grid.actor,grid.enemy].includes(value))!;
        for (let dy=0;dy<grid.pitch;dy++) for(let dx=0;dx<grid.pitch;dx++) returned.frame[y+dy]![x+dx] = dy===0?ink:grid.base;
      }
      returned.frames=[returned.frame];
      reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id,
        executionMs: 1, observation: packet(returned, sequence) });
      assert.equal(reply.ticket, null);
      const outcome=reply.snapshot.trace.findLast(event=>event.kind==='actual_outcome');
      assert.equal(outcome?.seal_prefix,true); assert.equal(outcome?.matched,changed==='contradicted-next-cell');
      assert.equal(reply.snapshot.trace.findLast(event=>event.kind==='sealed_prefix')?.acquired_actions,1);
      assert.deepEqual(family.state().state!.completed, acquired.state!.completed);
      if (changed === 'ambiguous-carrier') assert.deepEqual(family.state(), acquired, 'An unbound return cannot replace independent navigation facts');
      else assert.equal(family.state().state!.last.memory[proposal.walk![1]!.target],'wall');
    } finally { runtime.close('counterexample_complete'); }
  });
