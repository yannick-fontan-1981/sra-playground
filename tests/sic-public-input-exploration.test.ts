import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { createSicPublicInputExploration } from '../src/sic/public-input-exploration.ts';

test('SIC probes repeated interior markers while requiring independent visible arrangements', async () => {
  const board = (secondSquare: boolean) => Array.from({ length: 14 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => {
      if ((x === 2 || x === 4) && (y === 2 || y === 4)) return 7;
      if ((x === 10 || x === 12) && (y === 6 || (secondSquare && y === 8))) return 7;
      if ((x === 0 || x === 2) && (y === 8 || y === 10)) return 7;
      return x >= 6 && x <= 7 && y >= 9 && y <= 10 ? 3 : 0;
    }),
  );
  for (const repeated of [true, false]) {
    const rows = board(repeated);
    const observation = await measureNativeObservation({
      frame_rows: rows, frame_hash: String(repeated), level: 1, levels_completed: 0,
      available_action_refs: ['ACTION6'], state: 'NOT_FINISHED',
    }, 1);
    const proposed = await createSicPublicInputExploration().propose(observation, rows, [], 12);
    assert.ok(proposed);
    assert.equal(proposed.sicSituationCard.strategy, repeated ? 'test_repeated_marker' : 'compare_public_input');
    assert.equal(rows[proposed.actions[0]!.data.y!]![proposed.actions[0]!.data.x!], repeated ? 7 : 3);
  }
});

test('SIC tests a direction after a click changes a piece and binds the observed translation to that click', async () => {
  const family = createSicPublicInputExploration();
  const directions = [1, 2, 3, 4].map(id => ({ action_ref: `ACTION${id}`, data: {} }));
  const available_action_refs = [...directions.map(command => command.action_ref), 'ACTION6'];
  const board = (left: number, color: number, tick: number) => Array.from({ length: 12 }, (_, y) =>
    Array.from({ length: 12 }, (_, x) => y === 0 && x === tick ? 7 :
      y >= 4 && y <= 6 && x >= left && x <= left + 2 ? color : 0));
  let revision = 0;
  const observe = (frame_rows: number[][]) => measureNativeObservation({ frame_rows, frame_hash: String(revision),
    level: 1, levels_completed: 0, available_action_refs, state: 'NOT_FINISHED' }, ++revision);
  let rows = board(3, 2, 0), observation = await observe(rows);
  for (let tick = 1; tick <= 5; tick++) {
    const proposal = await family.propose(observation, rows, directions, 20);
    assert.ok(proposal);
    const command = proposal.actions[0]!;
    assert.equal(command.action_ref === 'ACTION6', tick === 5);
    const nextRows = board(3, tick === 5 ? 5 : 2, tick), next = await observe(nextRows);
    await family.record(observation, next, command, rows, nextRows, proposal, 0, [nextRows]);
    rows = nextRows;
    observation = next;
  }
  const probe = await family.propose(observation, rows, directions, 20);
  assert.ok(probe);
  assert.equal(probe.sicSituationCard.strategy, 'P05');
  const nextRows = board(5, 5, 6), next = await observe(nextRows);
  const result = await family.record(observation, next, probe.actions[0]!, rows, nextRows, probe, 0, [nextRows]);
  assert.deepEqual(result.events.map(event => [event.kind, event.from, event.to, event.evidence]),
    [['sic_selected_piece_motion', [3, 4, 5, 6], [5, 4, 7, 6], [observation.observation_ref, next.observation_ref]]]);
});
