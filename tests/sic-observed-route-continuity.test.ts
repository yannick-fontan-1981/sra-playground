import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { createSicObservedRouteIntervention } from '../src/sic/observed-route-intervention.ts';
import { createSicOutlineService, outlineServiceId } from '../src/sic/outline-service.ts';
import { createPreparedEffects } from '../src/sic/test-prepared-effects.ts';
import { defaultRecoveryPack } from '../src/sic/active-recovery.ts';
import { planningGroupsWithExperiments } from '../src/sic/experiment-selection-groups.ts';
import { standalonePlanningGroups } from '../src/sic/standalone-families.ts';
import { observedPressureRecoveryGroup } from '../src/sic/public-input-exploration.ts';

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-observed-route-opening-public.json.gz', import.meta.url))).toString());
const { grid, roles } = fixture;
const origin = (cell: number) => [grid.bounds[0] + 1 + cell % grid.width * grid.pitch,
  grid.bounds[1] + 1 + Math.floor(cell / grid.width) * grid.pitch];
const opposite = (id: number) => id === 1 ? 2 : id === 2 ? 1 : id === 3 ? 4 : id === 4 ? 3 : id;

function raster(rows: number[][], varied: boolean, successor = false) {
  if (!varied) return structuredClone(rows);
  const out = successor ? rows.map(row => [...row].reverse()).reverse() : structuredClone(rows);
  if (successor) {
    const left = rows[0]!.length - 1 - grid.bounds[2], top = rows.length - 1 - grid.bounds[3];
    for (let cell = 0; cell < grid.width * grid.height; cell++) {
      const [x, y] = origin(cell), tx = left + 1 + (grid.width - 1 - cell % grid.width) * grid.pitch;
      const ty = top + 1 + (grid.height - 1 - Math.floor(cell / grid.width)) * grid.pitch;
      let body = 0;
      for (let dy = 0; dy < grid.pitch; dy++) for (let dx = 0; dx < grid.pitch; dx++) {
        const value = rows[y! + dy]![x! + dx]!;
        out[ty + dy]![tx + dx] = value;
        if (dx && dy && value === roles.carrier) body++;
      }
      if (body === (grid.pitch - 1) ** 2 && rows[y!]![x!] !== roles.actor) out[ty + grid.pitch - 1]![tx + grid.pitch - 1] = grid.floor;
    }
  }
  return out.map(row => row.map(value => (value * 5 + 3) % 16));
}

function packet(board: any, varied: boolean, index: number, successor = false) {
  const frame = raster(board.frame, varied, successor);
  return { frame, frames: [frame], state: board.state, level: successor ? 3 : board.level,
    levelsCompleted: successor ? 2 : board.levelsCompleted, availableActionIds: board.availableActionIds, stepIndex: index };
}

for (const varied of [false, true]) test('native acquired opening preparation executes and reconciles its actual prefix'
  + (varied ? ' with another palette, carrier shape, positions and commands' : ''), async () => {
  const route = createSicObservedRouteIntervention(), outline = createSicOutlineService(outlineServiceId, witness => route.learn(witness));
  const prepared = createPreparedEffects(undefined, defaultRecoveryPack), ids = [route.id, outline.id, prepared.id];
  const groups = planningGroupsWithExperiments(standalonePlanningGroups).map(group => {
    const entries = group.families.flatMap((id, index) => ids.includes(id) ? [{ id, entry: group.entryPoints?.[index] ?? null }] : []);
    return { ...group, families: entries.map(item => item.id), entryPoints: entries.map(item => item.entry) };
  }).filter(group => group.families.length);
  const runtime = new NativeV6Runtime({ families: [route, outline, prepared], groups, sourceDigest: 'observed-opening-prefix', maxPointOccurrences: 250 });
  const service = new V6AgentService(() => runtime), sessionId = 'opening-prefix-' + varied;
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence,
    observation: packet(fixture.learning[0].before, varied, sequence), budgets: { targetLevels: 3, levelActionCaps: [60, 60, 60] } });
  try {
    for (const [index, step] of fixture.learning.entries()) {
      if (!reply.ticket) reply = await service.handle({ type: 'resume', sessionId, sequence });
      assert.ok(reply.ticket);
      assert.equal(reply.ticket.actionRef, 'ACTION' + step.command.id);
      const successor = index + 1 === fixture.learning.length;
      const board = successor ? fixture.opening[0].before : step.after;
      reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id, executionMs: 1,
        observation: packet(board, varied, sequence, successor) });
    }
    assert.equal(route.state!().roles.routeVerified, true, 'The prior public opening and score establish the effect');
    reply = await service.handle({ type: 'resume', sessionId, sequence });
    assert.ok(reply.ticket);
    assert.equal(reply.snapshot.proposal?.actions.length, 1, 'The announced carrier move is still an observation-dependent decision');
    assert.equal(reply.ticket.actionRef, 'ACTION' + (varied ? opposite(fixture.opening[0].command.id) : fixture.opening[0].command.id));
    reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id, executionMs: 1,
      observation: packet(fixture.opening[0].after, varied, sequence, true) });
    const warmupRef = (reply.snapshot.trace as any[]).findLast(event => event.kind === 'actual_outcome' && event.family === route.id)?.observation_ref;
    reply = await service.handle({ type: 'resume', sessionId, sequence });
    assert.ok(reply.ticket);
    const proposal = reply.snapshot.proposal as any, acquired = structuredClone(route.state!());
    assert.equal(proposal.kind, route.id);
    assert.equal(proposal.actions.length, 6);
    assert.equal(proposal.route.at(-1).toggle, true);
    assert.ok(proposal.route.slice(0, -1).every((leg: any) => !leg.toggle));
    const revision = reply.ticket.decisionRevision, refs: string[] = [];
    const prefix = fixture.opening.slice(1);
    for (const [index, step] of prefix.entries()) {
      assert.ok(reply.ticket);
      assert.equal(reply.ticket.decisionRevision, revision);
      assert.equal(reply.ticket.actionIndex, index);
      assert.equal(reply.ticket.actionRef, 'ACTION' + (varied ? opposite(step.command.id) : step.command.id));
      assert.ok(reply.ticket.nativeExecutionDigest && reply.ticket.graphChain);
      reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id, executionMs: 1,
        observation: packet(step.after, varied, sequence, true) });
      const outcome = (reply.snapshot.trace as any[]).findLast(event => event.kind === 'actual_outcome' && event.family === route.id);
      assert.equal(outcome?.index, index);
      assert.equal(outcome?.matched, true);
      assert.equal(outcome?.seal_prefix, index + 1 === prefix.length);
      refs.push(outcome.observation_ref);
      if (index + 1 < prefix.length) {
        assert.ok(reply.ticket);
        assert.deepEqual(route.state!(), acquired, 'Known facts change only when the real prefix is reconciled');
      }
    }
    const seals = (reply.snapshot.trace as any[]).filter(event => event.kind === 'sealed_prefix' && event.family === route.id && event.revision === revision);
    assert.equal(seals.length, 1);
    assert.equal(seals[0].acquired_actions, 6);
    const final = route.state!().state;
    assert.equal(final.count, 7);
    assert.equal(final.opening, proposal.choice.target);
    assert.equal(final.cells.actor, proposal.choice.target);
    assert.deepEqual(final.refs, [warmupRef, ...refs]);
    assert.equal(final.lastMatched, true);
    assert.deepEqual(route.state!().roles, acquired.roles);
  } finally { runtime.close('test_complete'); }
});

async function proposed(remaining = 16, verified = true) {
  const family = createSicObservedRouteIntervention(), state = structuredClone(fixture.acquired);
  state.roles.routeVerified = verified;
  family.restore!(state);
  const observation = fixture.opening[1].observation;
  const inputs = observation.available_action_refs.map((action_ref: string) => ({ action_ref, data: {} }));
  const proposal = await family.proposeInGroup!(observedPressureRecoveryGroup, observation,
    fixture.opening[1].before.frame, inputs, remaining);
  assert.ok(proposal);
  return { family, proposal, observation };
}

test('opening preparation respects the remaining budget and requires a completed acquired opening', async () => {
  const bounded = await proposed(3);
  assert.equal(bounded.proposal.actions.length, 3);
  assert.ok(bounded.proposal.actions.every(action => action.action_ref !== 'ACTION5'));
  const unitary = await proposed(1);
  assert.equal(unitary.proposal.actions.length, 1);
  const unknown = await proposed(16, false);
  assert.equal(unknown.proposal.actions.length, 1);
});

for (const condition of ['moved-carrier', 'new-cue', 'removed-wall', 'ambiguous-actor', 'wrong-actor', 'rival-cue'] as const)
  test('opening preparation closes when its public premise changes: ' + condition, async () => {
    const { family, proposal, observation } = await proposed(), state = structuredClone(family.state!());
    const first = fixture.opening[1].before.frame, second = structuredClone(fixture.opening[1].after.frame);
    const [x, y] = origin(proposal.choice.target);
    if (condition === 'new-cue') second[y! + 1][x! + 1] = roles.carrier;
    if (condition === 'rival-cue') second[y! + grid.pitch - 2][x! + grid.pitch - 2] = proposal.scene.rivals.find((rival: any) => !proposal.scene.walls.includes(rival.cell))!.color;
    if (condition === 'removed-wall') for (let dy = 0; dy < grid.pitch; dy++) for (let dx = 0; dx < grid.pitch; dx++) {
      second[y! + dy][x! + dx] = dx > 0 && dx < grid.pitch - 1 && dy > 0 && dy < grid.pitch - 1 ? grid.inset : grid.floor;
    }
    if (condition === 'moved-carrier') {
      const [u, v] = origin(proposal.scene.carrier), [a, b] = origin(proposal.scene.carrier + grid.width);
      for (let dy = 1; dy < grid.pitch; dy++) for (let dx = 1; dx < grid.pitch; dx++) {
        second[v! + dy][u! + dx] = dx < grid.pitch - 1 && dy < grid.pitch - 1 ? grid.inset : grid.floor;
        second[b! + dy][a! + dx] = roles.carrier;
      }
    }
    if (condition === 'ambiguous-actor') for (let dy = 0; dy < grid.pitch; dy++) for (let dx = 0; dx < grid.pitch; dx++) {
      if (!dx || !dy || dx === grid.pitch - 1 || dy === grid.pitch - 1) second[y! + dy][x! + dx] = roles.actor;
    }
    const returned = await family.after(proposal, 0, observation, fixture.opening[2].observation,
      first, condition === 'wrong-actor' ? first : second);
    assert.equal(returned.seal_prefix, true);
    assert.deepEqual(family.state!(), state);
    if (condition === 'new-cue' || condition === 'removed-wall' || condition === 'rival-cue') assert.equal(returned.matched, true);
    else assert.equal(returned.matched, false);
  });

test('the next opening preparation checks command availability and the same public context', async () => {
  const { family, proposal } = await proposed(), next = fixture.opening[2];
  const packet = { frame_rows: next.before.frame } as any;
  assert.equal((await family.before(proposal, 1, packet, next.observation)).admitted, true);
  const missing = { ...next.observation, available_action_refs: next.observation.available_action_refs.filter((ref: string) => ref !== proposal.actions[1]!.action_ref) };
  assert.equal((await family.before(proposal, 1, packet, missing)).admitted, false);
  assert.equal((await family.before(proposal, 1, packet, { ...next.observation, level_epoch: next.observation.level_epoch + 1 })).admitted, false);
});
