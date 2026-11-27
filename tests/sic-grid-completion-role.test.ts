import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';
import { createSicNavigateRevealedGrid } from '../src/sic/navigate-revealed-grid.ts';
import { createPreparedEffects } from '../src/sic/test-prepared-effects.ts';
import { planningGroupsWithExperiments } from '../src/sic/experiment-selection-groups.ts';
import { standalonePlanningGroups } from '../src/sic/standalone-families.ts';
import { observedPressureRecoveryGroup } from '../src/sic/public-input-exploration.ts';
import { defaultRecoveryPack } from '../src/sic/active-recovery.ts';

type R = Record<string, any>;
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-revealed-grid-public.json.gz', import.meta.url)))) as R;
const action = (id: number, varied: boolean) => varied && (id === 3 || id === 4) ? 7 - id : id;
function transform(value: R, varied: boolean): R {
  const rows = structuredClone(value.frame) as number[][];
  if (!varied) return { ...value, frame: rows };
  const grid = fixture.grids[value.level];
  for (let cell = 0; cell < grid.size; cell++) {
    const x = grid.box[0] + cell % grid.columns * grid.pitch, y = grid.box[1] + Math.floor(cell / grid.columns) * grid.pitch;
    const u = grid.box[0] + (grid.columns - 1 - cell % grid.columns) * grid.pitch;
    for (let dy = 0; dy < grid.pitch; dy++) for (let dx = 0; dx < grid.pitch; dx++) rows[y + dy]![u + dx] = value.frame[y + dy][x + dx];
    if (grid.actorPixels?.length === 8 && grid.actorPixels.every(([dx, dy]: number[]) => value.frame[y + dy!][x + dx!] === grid.actor)) {
      for (const [dx, dy] of grid.actorPixels) rows[y + dy]![u + dx] = grid.base;
      for (const [dx, dy] of [[2,1],[1,2],[2,2],[3,2],[2,3]]) rows[y + dy!]![u + dx!] = grid.actor;
    }
  }
  return { ...value, frame: rows.map(row => row.map(ink => (ink * 5 + 3) % 16)) };
}
const packet = (value: R, index = 0) => toV6PublicObservation({ ...value, gameCode: 'PUBLIC', levelCount: 3, frames: [value.frame],
  canUndo: false, canSelectLevel: false, defaultFps: 10 } as any, index);
const at = (grid: R, cell: number) => [grid.box[0] + cell % grid.columns * grid.pitch,
  grid.box[1] + Math.floor(cell / grid.columns) * grid.pitch];

for (const varied of [false, true]) test('native completed navigation owns the first needed command on a compatible new board'
  + (varied ? ' with reflected positions, changed palette, silhouette and commands' : ''), async () => {
  const family = createSicNavigateRevealedGrid(), prepared = createPreparedEffects(undefined, defaultRecoveryPack);
  const ids = new Set([family.id, prepared.id]);
  const groups = planningGroupsWithExperiments(standalonePlanningGroups).map(group => {
    const selected = group.families.flatMap((id, i) => ids.has(id) ? [{ id, entry: group.entryPoints?.[i] ?? null }] : []);
    return { ...group, families: selected.map(item => item.id), entryPoints: selected.map(item => item.entry) };
  }).filter(group => group.families.length);
  const runtime = new NativeV6Runtime({ families: [family, prepared], groups, sourceDigest: 'completed-grid-role', maxPointOccurrences: 100 });
  const service = new V6AgentService(() => runtime), sessionId = 'completed-grid-' + varied;
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence,
    observation: packet(transform(fixture.learning[0].before, varied)), budgets: { targetLevels: 3, levelActionCaps: [60, 60, 60] } });
  try {
    for (const step of fixture.learning.slice(0, 16)) {
      if (!reply.ticket) reply = await service.handle({ type: 'resume', sessionId, sequence });
      assert.ok(reply.ticket);
      assert.equal(reply.snapshot.proposal?.kind, family.id);
      assert.equal(reply.ticket.actionRef, 'ACTION' + action(step.action, varied));
      reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id,
        executionMs: 1, observation: packet(transform(step.after, varied), sequence) });
    }
    const completed = (family.state().state as R).completed;
    assert.equal(completed.epoch, 1); assert.equal(completed.score, 1);
    assert.ok(completed.before.includes(':epoch:1:') && completed.after.includes(':epoch:2:'));
    assert.equal(reply.snapshot.acquiredRecords, 16);
    const current = transform(fixture.learning[15].after, varied);
    reply = await service.handle({ type: 'resume', sessionId, sequence });
    assert.ok(reply.ticket);
    const proposal = reply.snapshot.proposal as R;
    assert.equal(proposal.kind, family.id, 'An unrelated transferred cue cannot displace the completed navigation role');
    assert.ok(proposal.route_refs.includes(completed.before) && proposal.route_refs.includes(completed.after));
    const retained = structuredClone(family.state()), grid = proposal.local.grid, carrier = proposal.local.last.position;
    const scope = reply.ticket.observationRef.split(':epoch:')[0]!;
    for (const change of ['none', 'duplicate', 'missing', 'goal', 'inputs', 'score', 'session']) {
      const changed = structuredClone(current), [x, y] = at(grid, carrier);
      if (change === 'duplicate') {
        const other = Object.keys(proposal.local.last.memory).map(Number).find(cell => cell !== carrier && cell !== grid.goal
          && !proposal.local.last.obstacles.includes(cell)) ?? (carrier + 2) % grid.size;
        const [u, v] = at(grid, other);
        for (const [dx, dy] of grid.actorPixels) changed.frame[v! + dy][u! + dx] = grid.actor;
      }
      if (change === 'missing') for (const [dx, dy] of grid.actorPixels) changed.frame[y! + dy][x! + dx] = grid.base;
      if (change === 'goal') {
        const [u, v] = at(grid, grid.goal);
        for (let dy = 0; dy < grid.pitch; dy++) for (let dx = 0; dx < grid.pitch; dx++) changed.frame[v! + dy][u! + dx] = grid.base;
      }
      const input = { frame_rows: changed.frame as number[][], frame_hash: 'completion-transfer-' + change,
        level: changed.level as number, levels_completed: changed.levelsCompleted as number,
        state: changed.state as string, available_action_refs: changed.availableActionIds.map((id: number) => 'ACTION' + id) };
      if (change === 'inputs') input.available_action_refs = [...input.available_action_refs, 'ACTION6'];
      if (change === 'score') input.levels_completed++;
      const observation = await measureNativeObservation(input, 17, change === 'session' ? 'another-session' : scope);
      const offered = await family.proposeInGroup!(observedPressureRecoveryGroup, observation, input.frame_rows, [], 60);
      if (change === 'none') assert.ok(offered, 'The same-session compatible public board is admitted');
      else assert.equal(offered, null, change);
      assert.deepEqual(family.state(), retained, 'A refused association preserves independently acquired facts');
    }
    // A declared functional public return executes the actual chosen command.
    // The real backend is separately exercised by the full chronological replay.
    const returned = structuredClone(current), choice = proposal.choice;
    if (choice.kind === 'pulse') {
      const charge = grid.charges.find(([x, y]: number[]) => returned.frame[y!][x!] === grid.enemy);
      assert.ok(charge); returned.frame[charge[1]][charge[0]] = grid.base;
      const [x, y] = at(grid, choice.target);
      for (let dy = 0; dy < grid.pitch; dy++) for (let dx = 0; dx < grid.pitch; dx++) returned.frame[y! + dy][x! + dx] = grid.tint;
    } else {
      assert.equal(choice.kind, 'move');
      const delta: Record<string, number> = { ACTION1: -grid.columns, ACTION2: grid.columns, ACTION3: -1, ACTION4: 1 };
      const [x, y] = at(grid, carrier), [u, v] = at(grid, carrier + delta[reply.ticket.actionRef]!);
      for (const [dx, dy] of grid.actorPixels) returned.frame[y! + dy][x! + dx] = grid.base;
      for (const [dx, dy] of grid.actorPixels) returned.frame[v! + dy][u! + dx] = grid.actor;
    }
    reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id,
      executionMs: 1, observation: packet(returned, sequence) });
    assert.equal(reply.snapshot.trace.findLast(event => event.kind === 'actual_outcome')?.matched, true);
    assert.equal(reply.snapshot.trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, 1);
    assert.deepEqual((family.state().state as R).completed, completed);
  } finally { runtime.close('test_complete'); }
});
