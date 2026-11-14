import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { createSicPublicInputExploration, currentControlledMotion } from '../src/sic/public-input-exploration.ts';
import { measureComponentTranslations, motionIntoFootprint, type DirectionalMotion } from '../src/sic/observed-translation.ts';
import type { NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';

test('SIC prioritizes a marked edit and checks that it changed the collection', async () => {
  const fixtures = JSON.parse(await readFile(new URL('./fixtures/v6-occurrence-reference.json', import.meta.url), 'utf8'));
  const packet: NativePublicObservation = fixtures.scenes['stck:initial'].public;
  const family = createSicPublicInputExploration();
  const inputs = [{ action_ref: 'ACTION5', data: {} }];
  const before = await measureNativeObservation(packet, 1);
  const proposal = await family.propose(before, packet.frame_rows, inputs, 20);
  assert.ok(proposal);
  assert.equal(proposal.sicSituationCard.strategy, 'test_marked_edit');
  assert.deepEqual(proposal.steps?.[0]?.point_binding?.point, [4, 50]);
  const stationary = await measureNativeObservation({ ...packet, step_index: 1 }, 2);
  const verdict = await family.after(proposal, 0, before, stationary, packet.frame_rows, packet.frame_rows);
  assert.equal(verdict.matched, false);
  await family.record(before, stationary, proposal.actions[0]!, packet.frame_rows, packet.frame_rows, proposal, 0, []);
  const next = await family.propose(stationary, packet.frame_rows, inputs, 20);
  assert.notEqual(next?.sicSituationCard.strategy, 'test_edited_collection');
  assert.notDeepEqual(next?.actions[0], proposal.actions[0]);
});

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

test('motion measurement reports unique component translations and rejects ambiguous destination masks', () => {
  const frame = (origins: number[]) => Array.from({ length: 8 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => y >= 2 && y <= 3 && origins.some(left => x >= left && x <= left + 1) ? 7 : 0));
  const pieces = (part: { color: number }) => part.color === 7;
  const before = frame([2]), after = frame([5]);
  assert.deepEqual(measureComponentTranslations(before, after, pieces).map(({ from, to, displacement }) =>
    [from.bbox, to.bbox, displacement]), [[[2, 2, 3, 3], [5, 2, 6, 3], [3, 0]]]);
  assert.deepEqual(measureComponentTranslations(before, frame([5, 10]), pieces), []);
  assert.deepEqual(measureComponentTranslations(before, before, pieces), []);
});

test('component motion stays ambiguous when parts entering the same footprint disagree', () => {
  const receipt: DirectionalMotion = { command: 'ACTION4', family: 'probe', beforeRef: 'before', afterRef: 'after', levelEpoch: 1,
    translations: [
      { from: [0, 2, 2, 4], to: [4, 2, 6, 4], displacement: [4, 0], area: 8, color: 2 },
      { from: [1, 3, 1, 3], to: [5, 3, 5, 3], displacement: [4, 0], area: 1, color: 3 },
    ] };
  assert.deepEqual(motionIntoFootprint(receipt, [4, 2, 7, 5]), [4, 0]);
  assert.equal(motionIntoFootprint(receipt, [9, 9, 11, 11]), null);
  assert.equal(motionIntoFootprint({ ...receipt, translations: [...receipt.translations,
    { from: [5, 1, 5, 1], to: [5, 2, 5, 2], displacement: [0, 1], area: 1, color: 4 },
  ] }, [4, 2, 7, 5]), null);
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
  const checkpoint = family.state();
  assert.equal(currentControlledMotion(checkpoint, next)?.command, probe.actions[0]!.action_ref);
  assert.equal(currentControlledMotion(checkpoint, { ...next, observation_ref: 'later' }), undefined);
  assert.equal(currentControlledMotion(checkpoint, { ...next, level_epoch: next.level_epoch + 1 }), undefined);
});
