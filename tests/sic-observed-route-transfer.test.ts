import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { createSicObservedRouteIntervention } from '../src/sic/observed-route-intervention.ts';
import { createSicOutlineService, outlineServiceId } from '../src/sic/outline-service.ts';
import { createPreparedEffects } from '../src/sic/test-prepared-effects.ts';
import { defaultRecoveryPack } from '../src/sic/active-recovery.ts';
import { planningGroupsWithExperiments } from '../src/sic/experiment-selection-groups.ts';
import { standalonePlanningGroups } from '../src/sic/standalone-families.ts';
import { observedPressureRecoveryGroup } from '../src/sic/public-input-exploration.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import type { NativeRows } from '../src/logos-engine/v6-native-types.ts';
import type { V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-observed-route-public.json.gz', import.meta.url))).toString());
const { grid, roles } = fixture;
const origin = (cell: number) => [grid.bounds[0] + 1 + cell % grid.width * grid.pitch,
  grid.bounds[1] + 1 + Math.floor(cell / grid.width) * grid.pitch];
const border = (rows: number[][], cell: number, color: number) => {
  const [x, y] = origin(cell);
  for (let dy = 0; dy < grid.pitch; dy++) for (let dx = 0; dx < grid.pitch; dx++) {
    if (!dx || !dy || dx === grid.pitch - 1 || dy === grid.pitch - 1) rows[y! + dy]![x! + dx] = color;
  }
};
const actorCell = (rows: NativeRows) => Array.from({ length: grid.width * grid.height }, (_, cell) => cell).find(cell => {
  const [x, y] = origin(cell);
  return Array.from({ length: grid.pitch }, (_, i) => rows[y!]![x! + i] === roles.actor
    && rows[y! + grid.pitch - 1]![x! + i] === roles.actor && rows[y! + i]![x!] === roles.actor
    && rows[y! + i]![x! + grid.pitch - 1] === roles.actor).every(Boolean);
})!;
type Mutation = 'none' | 'duplicate_actor' | 'duplicate_cue';

// The second scenario recolors the acquisition and then reverses the new
// stations and directional command and changes the carrier's silhouette.
// Cell artwork keeps its public glyph grammar while the cells change position.
function raster(rows: NativeRows, level: number, varied: boolean, mutation: Mutation = 'none'): number[][] {
  const source = rows.map(row => [...row]);
  if (level === 2 && mutation === 'duplicate_actor') border(source, 0, roles.actor);
  if (level === 2 && mutation === 'duplicate_cue') {
    const [x, y] = origin(0); source[y! + 1]![x! + 1] = roles.carrier;
  }
  if (!varied) return source;
  const height = source.length, width = source[0]!.length;
  const result = level === 2 ? source.map(row => [...row].reverse()).reverse() : source;
  if (level === 2) {
    const left = width - 1 - grid.bounds[2], top = height - 1 - grid.bounds[3];
    for (let cell = 0; cell < grid.width * grid.height; cell++) {
      const [x, y] = origin(cell), tx = left + 1 + (grid.width - 1 - cell % grid.width) * grid.pitch;
      const ty = top + 1 + (grid.height - 1 - Math.floor(cell / grid.width)) * grid.pitch;
      let body = 0;
      for (let dy = 0; dy < grid.pitch; dy++) for (let dx = 0; dx < grid.pitch; dx++) {
        const value = source[y! + dy]![x! + dx]!;
        result[ty + dy]![tx + dx] = value;
        if (dx && dy && value === roles.carrier) body++;
      }
      if (body === (grid.pitch - 1) ** 2 && source[y!]![x!] !== roles.actor) {
        result[ty + grid.pitch - 1]![tx + grid.pitch - 1] = grid.floor;
      }
    }
  }
  return result.map(row => row.map(value => (value * 5 + 3) % 16));
}

function packet(board: any, index: number, varied: boolean, mutation: Mutation = 'none'): V6PublicObservation {
  const frame = raster(board.frame, board.level, varied, mutation);
  return { frame, frames: [frame], state: board.state, level: board.level, levelsCompleted: board.levelsCompleted,
    availableActionIds: board.availableActionIds, stepIndex: index };
}

// An independent one-tick functional return: keep the autonomous public return
// actually captured, restore the old cursor site from the preceding raster,
// and apply only the directional cursor input. The corrected live first tick
// is separately qualified by the standard chronological runner.
function directionalReturn(input: number): number[][] {
  const before = fixture.steps[16].before.frame, after = fixture.steps[16].after.frame.map((row: number[]) => [...row]);
  const old = actorCell(before), moved = actorCell(after), [x, y] = origin(moved);
  for (let dy = 0; dy < grid.pitch; dy++) for (let dx = 0; dx < grid.pitch; dx++) after[y! + dy]![x! + dx] = before[y! + dy][x! + dx];
  const delta = input === 1 ? -grid.width : input === 2 ? grid.width : input === 3 ? -1 : 1;
  border(after, old + delta, roles.actor);
  return after;
}

async function start(varied: boolean, mutation: Mutation = 'none') {
  const route = createSicObservedRouteIntervention(), outline = createSicOutlineService(outlineServiceId, witness => route.learn(witness));
  const prepared = createPreparedEffects(undefined, defaultRecoveryPack), calls: { group: string; level: number; proposed: boolean }[] = [];
  const propose = route.proposeInGroup!.bind(route);
  route.proposeInGroup = async (group, observation, ...args) => {
    const proposal = await propose(group, observation, ...args);
    calls.push({ group, level: observation.level_epoch, proposed: proposal !== null });
    return proposal;
  };
  const ids = [route.id, outline.id, prepared.id];
  const groups = planningGroupsWithExperiments(standalonePlanningGroups).map(group => {
    const entries = group.families.flatMap((id, index) => ids.includes(id) ? [{ id, entry: group.entryPoints?.[index] ?? null }] : []);
    return { ...group, families: entries.map(item => item.id), entryPoints: entries.map(item => item.entry) };
  }).filter(group => group.families.length);
  const runtime = new NativeV6Runtime({ families: [route, outline, prepared], groups, sourceDigest: 'observed-route-transfer', maxPointOccurrences: 100 });
  const service = new V6AgentService(() => runtime), sessionId = 'route-transfer-' + varied + '-' + mutation;
  let sequence = 0, result = await service.handle({ type: 'init', sessionId, sequence,
    observation: packet(fixture.steps[0].before, 0, varied), budgets: { targetLevels: 3, levelActionCaps: [60, 60, 60] } });
  for (const step of fixture.steps.slice(0, 16)) {
    assert.ok(result.ticket, JSON.stringify({ sequence, reason: result.reason }));
    assert.equal(result.snapshot.proposal?.kind, outline.id);
    assert.equal(result.ticket.actionRef, 'ACTION' + step.command.id,
      JSON.stringify({ sequence, strategy: result.snapshot.proposal?.strategy, local: result.snapshot.proposal?.local }));
    result = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: result.ticket.id, executionMs: 1,
      observation: packet(step.after, sequence, varied, mutation) });
    if (result.kind === 'boundary') result = await service.handle({ type: 'resume', sessionId, sequence });
  }
  async function advance(rows: NativeRows) {
    assert.ok(result.ticket);
    const observation = packet(fixture.steps[16].before, sequence + 1, varied);
    observation.frame = rows; observation.frames = [rows];
    result = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: result.ticket.id, executionMs: 1, observation });
    return result;
  }
  async function resume() {
    result = await service.handle({ type: 'resume', sessionId, sequence });
    return result;
  }
  return { route, outline, runtime, calls, advance, resume, get result() { return result; } };
}

for (const varied of [false, true]) test('native route ownership continues the acquired outline role before a preview'
  + (varied ? ' with changed silhouette, palette, stations and directional commands' : ''), async () => {
  const run = await start(varied);
  try {
    assert.ok(run.calls.filter(call => call.level === 1 && call.group === observedPressureRecoveryGroup).every(call => !call.proposed));
    assert.equal(run.result.snapshot.levelsCompleted, 1);
    assert.equal(run.result.snapshot.actions, 16);
    assert.equal(run.result.snapshot.proposal?.kind, run.route.id);
    assert.equal(run.calls.at(-1)?.group, observedPressureRecoveryGroup);
    assert.equal(run.result.ticket?.actionRef, varied ? 'ACTION2' : 'ACTION1');
    assert.ok(run.result.ticket?.nativeExecutionDigest && run.result.ticket.graphChain);
    const acquired = structuredClone(run.route.state!().roles);
    assert.ok(acquired.refs.some((ref: string) => ref.includes(':epoch:1:')));
    assert.ok(acquired.refs.every((ref: string) => run.result.snapshot.proposal?.route_refs.includes(ref)));
    assert.equal(acquired.routeVerified, undefined);
    const returned = await run.advance(raster(directionalReturn(1), 2, varied));
    assert.equal(returned.kind, 'boundary');
    const actual = returned.snapshot.trace.findLast((event: any) => event.kind === 'actual_outcome');
    assert.equal(actual?.family, run.route.id);
    assert.equal(actual?.matched, true);
    const seal = returned.snapshot.trace.findLast((event: any) => event.kind === 'sealed_prefix');
    assert.equal(seal?.family, run.route.id);
    assert.equal(seal?.acquired_actions, 1);
    assert.equal(run.route.state!().state.lastMatched, true);
    assert.deepEqual(run.route.state!().roles, acquired);
    // The native store restores record keys in canonical order. Compatibility
    // must compare the measured fields, not the object's serialization order.
    const continued = await run.resume();
    assert.equal(continued.snapshot.proposal?.kind, run.route.id);
    assert.equal(run.calls.at(-1)?.group, observedPressureRecoveryGroup);
    assert.equal(run.calls.at(-1)?.proposed, true);
  } finally { run.runtime.close('test_complete'); }
});

for (const mutation of ['duplicate_actor', 'duplicate_cue'] as const) test('native route continuation refuses ' + mutation + ' without losing its acquired roles', async () => {
  const run = await start(false, mutation);
  try {
    assert.ok(run.calls.some(call => call.level === 2 && call.group === observedPressureRecoveryGroup && !call.proposed));
    assert.ok(!run.calls.some(call => call.level === 2 && call.group === observedPressureRecoveryGroup && call.proposed));
    assert.ok(run.route.state!().roles.refs.length > 1);
    assert.equal(run.route.state!().roles.routeVerified, undefined);
  } finally { run.runtime.close('test_complete'); }
});

test('a contradictory route return suspends early ownership while retaining the older roles', async () => {
  const run = await start(false), acquired = structuredClone(run.route.state!().roles);
  try {
    const rows = fixture.steps[16].before.frame, returned = await run.advance(rows);
    assert.equal(returned.kind, 'boundary');
    assert.equal(returned.snapshot.trace.findLast((event: any) => event.kind === 'actual_outcome')?.matched, false);
    assert.equal(run.route.state!().state.lastMatched, false);
    assert.deepEqual(run.route.state!().roles, acquired);
    const observation = (run.runtime as any).observation;
    assert.equal(await run.route.proposeInGroup!(observedPressureRecoveryGroup, observation, rows,
      observation.available_action_refs.map((action_ref: string) => ({ action_ref, data: {} })), 30), null);
  } finally { run.runtime.close('test_complete'); }
});

test('route priority requires current references from the same scope and a matching score', async () => {
  const run = await start(false), acquired = structuredClone(run.route.state!());
  try {
    const observation = (run.runtime as any).observation, rows = fixture.steps[16].before.frame;
    const inputs = observation.available_action_refs.map((action_ref: string) => ({ action_ref, data: {} }));
    for (const roles of [null, { ...acquired.roles, refs: [] }, { ...acquired.roles, refs: acquired.roles.refs.slice(0, -1) },
      { ...acquired.roles, refs: ['foreign:epoch:1:revision:1', observation.observation_ref] },
      { ...acquired.roles, score: acquired.roles.score + 1 }]) {
      run.route.restore!({ ...acquired, roles });
      assert.equal(await run.route.proposeInGroup!(observedPressureRecoveryGroup, observation, rows, inputs, 30), null);
    }
    run.route.restore!(acquired);
    assert.ok(await run.route.proposeInGroup!(observedPressureRecoveryGroup, observation, rows, inputs, 30));
  } finally { run.runtime.close('test_complete'); }
});
