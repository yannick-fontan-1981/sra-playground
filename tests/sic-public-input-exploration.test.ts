import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { createSicPublicInputExploration, currentControlledMotion, currentPanelFrontier } from '../src/sic/public-input-exploration.ts';
import { observedCommandFrontier, observedCommandKey } from '../src/sic/observed-command-frontier.ts';
import { commandPanelState, visibleCommandPanel } from '../src/sic/visible-command-panel.ts';
import { measureComponentTranslations, motionIntoFootprint, type DirectionalMotion } from '../src/sic/observed-translation.ts';
import type { NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';

test('a separated panel gets a turn between movement probes despite unrelated changes in the status strip', async () => {
  const board = (step: number) => Array.from({ length: 18 }, (_, y) => Array.from({ length: 32 }, (_, x) => {
    if (y === 17) return x < step ? 4 : 0;
    if (x < 16) return x >= 4 && x <= 6 && y >= 5 && y <= 7 ? 3 : 1;
    return y >= 6 && y <= 8 && [20, 23, 26, 29].some(start => x === start || x === start + 1) ? 7 : 2;
  }));
  const observe = (step: number) => measureNativeObservation({ frame_rows: board(step), frame_hash: `frame-${step}`,
    level: 1, levels_completed: 0, available_action_refs: ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION6'], state: 'NOT_FINISHED' }, step);
  const family = createSicPublicInputExploration();
  const inputs = [1, 2, 3, 4].map(id => ({ action_ref: `ACTION${id}`, data: {} }));
  const examples = [];
  const sources = new Set<string>();
  for (let i = 1; i <= 4; i++) {
    const before = await observe(i), after = await observe(i + 1);
    const proposal = await family.propose(before, board(i), inputs, 20);
    assert.ok(proposal);
    const action = proposal.actions[0]!;
    examples.push([action.action_ref, action.data.x]);
    sources.add(proposal.source);
    const effect = await family.after(proposal, 0, before, after, board(i), board(i + 1));
    assert.equal(effect.reason, 'input_left_playing_surface_unchanged');
    await family.record(before, after, action, board(i), board(i + 1), proposal, 0, []);
  }
  assert.equal(sources.size, 1);
  assert.deepEqual(examples.map(([id]) => id), ['ACTION6', 'ACTION1', 'ACTION6', 'ACTION2']);
  assert.notEqual(examples[0]![1], examples[2]![1]);
});

test('public exploration shares tested panel commands across families and only revisits states with a new test', async () => {
  const arms = [[27, 4], [24, 7], [30, 7], [27, 10]];
  const board = (step: number, shifted = false) => Array.from({ length: 20 }, (_, y) => Array.from({ length: 40 }, (_, x) => {
    if (y === 19) return x < step ? 4 : 0;
    if (x < 20) {
      const left = shifted ? 8 : 4;
      return x >= left && x < left + 3 && y >= 5 && y < 8 ? 3 : 1;
    }
    const slot = arms.find(([l, t]) => x >= l! && x < l! + 3 && y >= t! && y < t! + 3);
    return slot ? (x === slot[0] && y === slot[1] ? 8 : 7) : 2;
  }));
  const inputs = [1, 2, 3, 4].map(id => ({ action_ref: `ACTION${id}`, data: {} }));
  const refs = [...inputs.map(input => input.action_ref), 'ACTION6'];
  const beforeRows = board(1), afterRows = board(2, true), recurringRows = board(3);
  const observe = (frame_rows: number[][], step: number) => measureNativeObservation({
    frame_rows, frame_hash: `frame-${step}`, level: 1, levels_completed: 0, available_action_refs: refs, state: 'NOT_FINISHED',
  }, step);
  const before = await observe(beforeRows, 1), after = await observe(afterRows, 2), recurring = await observe(recurringRows, 3);
  const panel = visibleCommandPanel(beforeRows);
  assert.ok(panel);
  assert.deepEqual(panel.buttons.map(button => button.bbox.slice(0, 2)), arms);
  const initial = commandPanelState(beforeRows, panel, refs), displaced = commandPanelState(afterRows, panel, refs);
  assert.notEqual(initial, displaced);
  assert.equal(commandPanelState(recurringRows, panel, refs), initial);

  const family = createSicPublicInputExploration();
  assert.ok(family.observePublicOutcome);
  await family.observePublicOutcome(before, after, inputs[0]!, beforeRows, afterRows, [afterRows]);
  await family.observePublicOutcome(after, recurring, inputs[1]!, afterRows, recurringRows, [recurringRows]);
  const first = { action_ref: 'ACTION6', data: { x: 28, y: 5 } };
  await family.observePublicOutcome(recurring, recurring, first, recurringRows, recurringRows, [recurringRows]);
  const shared = currentPanelFrontier(family.state(), recurring);
  assert.ok(shared);
  assert.equal(currentPanelFrontier(family.state(), { ...recurring, level_epoch: recurring.level_epoch + 1 }), undefined);
  const next = await family.propose(recurring, recurringRows, inputs, 20);
  assert.ok(next);
  assert.match(next.actions[0]!.action_ref, /^ACTION[234]$/);
  await family.record(recurring, recurring, next.actions[0]!, recurringRows, recurringRows, next, 0, [recurringRows]);
  const click = await family.propose(recurring, recurringRows, inputs, 20);
  assert.equal(click?.actions[0]!.action_ref, 'ACTION6');
  assert.notDeepEqual(click?.actions[0], first);
  const testedHere = ['ACTION1', observedCommandKey(first)];
  const routable = observedCommandFrontier(shared.transitions, initial, testedHere, 3,
    state => state === initial ? testedHere : ['ACTION2', 'ACTION3']);
  assert.equal(routable?.action, 'ACTION1');
  assert.equal(routable?.probe, 'ACTION3');
  assert.equal(observedCommandFrontier(shared.transitions, initial, testedHere, 3,
    state => state === initial ? testedHere : ['ACTION2']), null);
});

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

test('stationary clicks and a stationary non-point command give a smaller repeated target a turn', async () => {
  const rows = Array.from({ length: 31 }, (_, y) => Array.from({ length: 61 }, (_, x) => {
    if (y >= 2 && y <= 3 && [2, 6, 10, 14, 18].some(left => left <= x && x <= left + 1)) return 7;
    if (y >= 7 && (y - 7) % 6 < 4 && x % 6 < 4) return 2;
    return 0;
  }));
  const family = createSicPublicInputExploration();
  const inputs = [{ action_ref: 'ACTION5', data: {} }];
  const observe = (step: number) => measureNativeObservation({
    frame_rows: rows, frame_hash: 'same board', level: 1, levels_completed: 0,
    available_action_refs: ['ACTION5', 'ACTION6'], state: 'NOT_FINISHED',
  }, step);
  let before = await observe(1);
  for (let step = 2; step <= 6; step++) {
    const trial = await family.propose(before, rows, inputs, 20);
    assert.ok(trial);
    assert.equal(trial.sicSituationCard.strategy, 'compare_public_input');
    const after = await observe(step);
    await family.record(before, after, trial.actions[0]!, rows, rows, trial, 0, [rows]);
    before = after;
  }
  const trial = await family.propose(before, rows, inputs, 20);
  assert.ok(trial);
  assert.equal(trial.sicSituationCard.strategy, 'test_repeated_target');
  assert.equal(rows[trial.actions[0]!.data.y!]![trial.actions[0]!.data.x!], 7);
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
