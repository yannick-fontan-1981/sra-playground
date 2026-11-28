import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { componentCenterPoint } from '../src/sic/interior-shape-targets.ts';
import { createSicPublicInputExploration, currentControlledMotion, currentPanelFrontier } from '../src/sic/public-input-exploration.ts';
import { observedCommandFrontier, observedCommandKey, rememberCommandReturn, type ObservedCommandGraph } from '../src/sic/observed-command-frontier.ts';
import { commandPanelState, visibleCommandPanel } from '../src/sic/visible-command-panel.ts';
import { confirmsPanelTranslation, learnPanelDirection, learnPanelTerrain, matchesPanelTerrain, panelActor, projectPanelContact, projectPanelMarker,
  projectPanelFooting, projectPanelTerrain, rememberPanelTerrain, type PanelWalker } from '../src/sic/panel-context-probe.ts';
import { sameLandingPixels } from '../src/sic/plan-step.ts';
import { measureReturningAnimation } from '../src/sic/observed-animation.ts';
import { comparePanelSupportAccess } from '../src/sic/panel-access-comparison.ts';
import { dockingDistance, findPanelDock, measureAlignedTool, measurePanelTransport,
  panelTransportPose, unchangedPanelTransport } from '../src/sic/panel-mechanism-probe.ts';
import { measureComponentTranslations, motionIntoFootprint, type DirectionalMotion } from '../src/sic/observed-translation.ts';
import { chooseTravelTrial, observeTravel } from '../src/sic/observed-travel-frontier.ts';
import { acquireInstructionReturn } from '../src/sic/symbol-contribution.ts';
import type { NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';

test('an optional diagram extraction preserves prior evidence when its component budget is exhausted', async () => {
  for (const palette of [[2, 5], [11, 6]]) {
    const first = Array.from({ length: 64 }, (_, y) => Array.from({ length: 64 }, (_, x) => palette[(x + y) % 2]!));
    const second = first.map(row => [...row]);
    second[7]![13] = 9;
    const packet = { level: 2, levels_completed: 1, state: 'LIVE', available_action_refs: ['ACTION6'] };
    const before = await measureNativeObservation({ ...packet, frame_rows: first, frame_hash: 'fragmented' }, 1);
    const after = await measureNativeObservation({ ...packet, frame_rows: second, frame_hash: 'changed' }, 2);
    const prior = { epoch: 1, appearance: palette[0]!, examples: {} };
    const clicked = { action_ref: 'ACTION6', data: { x: 13, y: 7 } };
    assert.equal(acquireInstructionReturn(prior, before, after, clicked, first, second), prior);
  }
});

test('a measured tile displacement gives untried directions a turn after a blocked contact', () => {
  const board = (at: number, alternate: boolean) => {
    const rows = Array.from({ length: 9 }, () => Array<number>(15).fill(3));
    for (let y = 3; y < 6; y++) for (let x = 12; x < 15; x++) {
      if (x !== 13 || y !== 4) rows[y]![x] = 11;
    }
    for (const [x, y] of (alternate ? [[0, 0], [1, 0], [0, 1], [0, 2]] : [[0, 0], [0, 1], [1, 1], [0, 2]])) {
      rows[3 + y!]![at + x!] = 6;
    }
    return rows;
  };
  const inputs = [1, 2, 3, 4].map(id => ({ action_ref: `ACTION${id}`, data: {} }));
  const before = board(3, false), after = board(6, true);
  const travel = observeTravel(undefined, before, after, inputs[3]!, 'observed-right');
  assert.ok(travel);
  assert.deepEqual(travel.moves.ACTION4?.delta, [3, 0]);
  const firstProbe = chooseTravelTrial(travel, after, inputs, false);
  assert.equal(firstProbe?.command.action_ref, 'ACTION1');
  const blocked = observeTravel(travel, after, after, inputs[0]!, 'observed-block');
  assert.ok(blocked);
  assert.equal(Object.values(blocked.tested).at(-1), -1);
  assert.equal(chooseTravelTrial(blocked, after, inputs, false)?.command.action_ref, 'ACTION2');

  const mixedBefore = board(3, false), mixedAfter = board(6, false);
  mixedBefore[0]![0] = mixedBefore[0]![1] = 6;
  mixedAfter[0]![3] = mixedAfter[0]![4] = 6;
  const amongOtherChanges = observeTravel(undefined, mixedBefore, mixedAfter, inputs[3]!, 'observed-among-other-moves');
  assert.equal(amongOtherChanges?.actor, '6,3');
  assert.deepEqual(amongOtherChanges?.moves.ACTION4?.delta, [3, 0]);
});

test('a stable unframed feature suggests a contact from witnessed returns owned by other families', async () => {
  const board = (at: readonly [number, number]) => {
    const rows = Array.from({ length: 15 }, () => Array<number>(15).fill(3));
    rows[7]![12] = rows[7]![13] = 11;
    for (const [x, y] of [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [0, 2]]) {
      rows[at[1] + y!]![at[0] + x!] = 6;
    }
    return rows;
  };
  const right = { action_ref: 'ACTION4', data: {} };
  const down = { action_ref: 'ACTION2', data: {} };
  const inputs = [right, down];
  const start = board([3, 3]), moved = board([6, 3]), turned = board([6, 6]);
  assert.equal(observeTravel(undefined, start, moved, right, 'observed-right'), undefined);
  const first = observeTravel(undefined, start, moved, right, 'observed-right', true);
  assert.ok(first);
  assert.equal(chooseTravelTrial(first, moved, inputs, false, true), undefined);
  const state = observeTravel(first, moved, turned, down, 'observed-down', true);
  assert.ok(state);
  assert.equal(chooseTravelTrial(state, turned, inputs, false), undefined);
  const trial = chooseTravelTrial(state, turned, inputs, false, true);
  assert.equal(trial?.purpose, 'test_contact_hypothesis');
  assert.deepEqual(trial?.target, [12, 6]);
  assert.equal(trial?.command.action_ref, 'ACTION4');
  assert.ok(trial?.evidence.includes('observed-down'));
  assert.equal(trial?.approach, undefined);
  const changed = board([6, 6]);
  changed[7]![13] = 8;
  assert.equal(chooseTravelTrial(state, changed, inputs, false, true), undefined);
  const observations = await Promise.all([start, moved, turned].map((rows, index) =>
    measureNativeObservation({ frame_rows: rows, frame_hash: 'contact-' + index, level: 1,
      levels_completed: 0, available_action_refs: ['ACTION4', 'ACTION2'], state: 'NOT_FINISHED' }, index + 1)));
  const adopted = createSicPublicInputExploration(true, { allowUnframedContact: true });
  await adopted.observePublicOutcome!(observations[0]!, observations[1]!, right, start, moved);
  await adopted.observePublicOutcome!(observations[1]!, observations[2]!, down, moved, turned);
  const proposal = await adopted.propose(observations[2]!, turned, inputs, 10);
  assert.equal(proposal?.actions[0]?.action_ref, 'ACTION4');
  assert.equal(proposal?.sicSituationCard?.unframedContactHypothesis, true);
  assert.ok(proposal?.sicSituationCard?.evidence?.includes(observations[1]!.observation_ref));
});

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

test('a panel probe keeps its identity when only a different component inside its bounds changes', async () => {
  const arms = [[27, 4], [24, 7], [30, 7], [27, 10]];
  const board = (indicator: number, outline: number) => Array.from({ length: 20 }, (_, y) => Array.from({ length: 40 }, (_, x) => {
    if (x < 20) return x >= 4 && x < 7 && y >= 5 && y < 8 ? 3 : 1;
    const slot = arms.find(([left, top]) => x >= left! && x < left! + 3 && y >= top! && y < top! + 3);
    if (!slot) return 2;
    if (slot !== arms[0]) return x === slot[0] && y === slot[1] ? 8 : 7;
    return x === slot[0] && y === slot[1] ? indicator : outline;
  }));
  const inputs = [1, 2, 3, 4].map(id => ({ action_ref: `ACTION${id}`, data: {} }));
  const refs = [...inputs.map(input => input.action_ref), 'ACTION6'];
  const firstRows = board(8, 7), secondRows = board(9, 7), changedRows = board(9, 6);
  const observe = (frame_rows: number[][], step: number) => measureNativeObservation({
    frame_rows, frame_hash: `panel-probe-${step}`, level: 1, levels_completed: 0, available_action_refs: refs, state: 'NOT_FINISHED',
  }, step);
  const before = await observe(firstRows, 1), after = await observe(secondRows, 2), changed = await observe(changedRows, 3);
  const family = createSicPublicInputExploration();
  const initial = await family.propose(before, firstRows, inputs, 20);
  assert.ok(initial?.panelTest);
  const click = initial.actions[0]!;
  assert.deepEqual(click, { action_ref: 'ACTION6', data: { x: 28, y: 5 } });
  await family.record(before, after, click, firstRows, secondRows, initial, 0, [secondRows]);
  for (const action of inputs) await family.observePublicOutcome?.(after, after, action, secondRows, secondRows, [secondRows]);
  const next = await family.propose(after, secondRows, inputs, 20);
  assert.deepEqual(next?.actions[0], { action_ref: 'ACTION6', data: { x: 25, y: 8 } });
  const replaced = await family.propose(changed, changedRows, inputs, 20);
  assert.deepEqual(replaced?.actions[0], click);

  const exploration = createSicPublicInputExploration();
  for (const action of inputs) await exploration.observePublicOutcome?.(changed, changed, action, changedRows, changedRows, [changedRows]);
  for (const control of visibleCommandPanel(secondRows)!.buttons) {
    const [x, y] = componentCenterPoint(control);
    await exploration.observePublicOutcome?.(after, after, { action_ref: 'ACTION6', data: { x, y } }, secondRows, secondRows, [secondRows]);
  }
  const untried = await exploration.propose(after, secondRows, inputs, 20);
  assert.deepEqual(untried?.actions[0], { action_ref: 'ACTION6', data: { x: 5, y: 6 } });
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
  const withTiles = board(1);
  for (let y = 14; y < 18; y++) for (let x = 34; x < 38; x++) {
    withTiles[y]![x] = 3 + Math.floor((x - 34) / 2) + 2 * Math.floor((y - 14) / 2);
  }
  assert.equal(visibleCommandPanel(withTiles)?.buttons.filter(button => button.area === 4).length, 4);
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

test('a witnessed transport can be replayed to reach an untried placement despite an earlier click on the same board', async () => {
  const rows = Array.from({ length: 18 }, (_, y) => Array.from({ length: 32 }, (_, x) => {
    if (x < 16) return x >= 4 && x <= 5 && y >= 4 && y <= 5 ? 14 : 1;
    return y >= 6 && y <= 8 && [20, 23, 26, 29].some(start => x === start || x === start + 1) ? 7 : 2;
  }));
  const inputs = [1, 2, 3, 4].map(id => ({ action_ref: `ACTION${id}`, data: {} }));
  const refs = [...inputs.map(input => input.action_ref), 'ACTION6'];
  const observation = await measureNativeObservation({ frame_rows: rows, frame_hash: 'current_transport',
    level: 1, levels_completed: 0, available_action_refs: refs, state: 'NOT_FINISHED' }, 1);
  const panel = visibleCommandPanel(rows)!;
  assert.ok(panel);
  const control = (index: number) => {
    const button = panel.buttons[index]!, [x, y] = componentCenterPoint(button);
    return { command: { action_ref: 'ACTION6', data: { x, y } }, box: button.bbox,
      ink: button.color, contact: [4, 4, 5, 5] as const, before: 'earlier', observation: observation.observation_ref };
  };
  const motion = control(0), action = observedCommandKey(motion.command), tool = 'attached_tool';
  const held = { tool: [8, 8, 11, 11] as const, support: [6, 9, 13, 10] as const };
  const other = { tool: [6, 8, 9, 11] as const, support: [4, 9, 11, 10] as const };
  const source = panelTransportPose(held), destination = panelTransportPose(other);
  const family = createSicPublicInputExploration();
  await family.attachPrograms!(new NativeKnowledgeStore('transport-test', 'current'));
  family.restore({ ...family.state(), epoch: observation.level_epoch,
    panelWalker: { ink: 14, floor: 1, controls: {} },
    revealedPanelControl: control(1),
    transitions: { [commandPanelState(rows, panel, refs)]: [{ action, destination: 'previous_board', evidence: 'prior_click' }] },
    animatedPanelControls: { [tool]: { control: motion, region: held.tool, frames: [1], tested: [],
      evidence: 'grip_confirmed', held, transport: 'transport_confirmed',
      transportReturns: { [source]: [{ action: `${action}@4,4,5,5`, destination, evidence: 'witnessed_transport' }] } } },
    panelMechanismMotions: [{ footing: motion, delta: [-2, 0], tool, evidence: 'measured_direction' }],
  });
  const proposal = await family.propose(observation, rows, inputs, 12);
  assert.ok(proposal);
  assert.deepEqual(proposal.actions, [motion.command]);
  assert.equal(proposal.sicSituationCard.strategy, 'P07');
  assert.equal(proposal.transportMove?.expected, destination);
  assert.ok(proposal.route_refs?.includes('witnessed_transport'));
});

test('a panel comparison projects a guarded route using measured commands and an untested matching marker', () => {
  const board = (ax: number, ay: number, mark = true) => Array.from({ length: 14 }, (_, y) =>
    Array.from({ length: 14 }, (_, x) => {
      if (x >= ax && x < ax + 2 && y >= ay && y < ay + 2) return 7;
      if (mark && x >= 8 && x < 10 && y >= 4 && y < 6) return (x + y) % 2 ? 6 : 3;
      return x >= 2 && x < 12 && y >= 2 && y < 12 ? 2 : 0;
    }));
  const field = [0, 0, 13, 13] as const;
  const right = { action_ref: 'ACTION1', data: {} }, up = { action_ref: 'ACTION4', data: {} };
  const first = board(2, 8), middle = board(4, 8), current = board(4, 6);
  const horizontal = learnPanelDirection(undefined, field, right.action_ref, first, middle, 'right');
  const walker = learnPanelDirection(horizontal, field, up.action_ref, middle, current, 'up');
  assert.ok(walker);
  const button = { command: { action_ref: 'ACTION6', data: { x: 24, y: 6 } }, box: [23, 5, 26, 8] as const,
    ink: 6, evidence: 'click_off_marker' };
  const inputs = [right, up];
  const projection = projectPanelMarker(walker, current, field, inputs, [button], [], 4);
  assert.ok(projection);
  assert.deepEqual(projection.target.marker, [8, 4, 9, 5]);
  assert.equal(projection.route.length, 3);
  assert.deepEqual(new Set(projection.evidence), new Set(['right', 'up']));
  assert.equal(projectPanelMarker(walker, current, field, inputs, [button], [], 3), null);
  assert.equal(projectPanelMarker(walker, current, field, inputs, [button], [projection.target.key], 4), null);
  assert.equal(projectPanelMarker(walker, current, field, inputs, [{ ...button, ink: 9 }], [], 4), null);
  assert.ok(sameLandingPixels(projection.route[2]!.landing, current));
  assert.equal(sameLandingPixels(projection.route[2]!.landing, board(4, 6, false)), false);

  current[4]![8] = 2;
  current[4]![9] = current[5]![8] = current[5]![9] = 6;
  const contact = projectPanelContact(walker, current, field, 0, inputs, [], 3);
  assert.ok(contact);
  assert.deepEqual(contact.target.box, [8, 4, 9, 5]);
  assert.equal(contact.route.length, 3);
  assert.equal(projectPanelContact(walker, current, field, 0, inputs, [contact.target.key], 3), null);
  assert.equal(projectPanelContact(walker, current, [2, 2, 11, 11], 6, inputs, [], 3), null);

  const shelf = board(4, 6, false), onShelf = board(6, 6, false);
  for (const x of [6, 7]) shelf[6]![x] = shelf[7]![x] = 9;
  assert.equal(learnPanelTerrain(walker, field, 0, right.action_ref, shelf, shelf, 'blocked'), walker);
  const extended = learnPanelTerrain(walker, field, 0, right.action_ref, shelf, onShelf, 'crossed_new_surface');
  assert.deepEqual(extended.floorReturns, { '9': 'crossed_new_surface' });

  current[4]![8] = current[5]![9] = 8;
  current[4]![9] = current[5]![8] = 9;
  current[8]![10] = current[9]![11] = 9;
  current[8]![11] = current[9]![10] = 8;
  assert.equal(projectPanelMarker(walker, current, field, inputs, [button], [], 4), null);
  const matched = projectPanelMarker(walker, current, field, inputs, [button], [], 4,
    [{ marker: [8, 4, 9, 5], command: observedCommandKey(button.command), evidence: 'earlier_displacement' }]);
  assert.deepEqual(matched?.target.peer, [10, 8, 11, 9]);
  assert.equal(matched?.target.link, 'earlier_displacement');
  const reversed = projectPanelMarker(walker, current, field, inputs, [button], [], 8,
    [{ marker: [10, 8, 11, 9], command: observedCommandKey(button.command), evidence: 'paired_departure' }], [10, 8, 11, 9]);
  assert.deepEqual(reversed?.target.marker, [8, 4, 9, 5]);
  assert.deepEqual(reversed?.target.peer, [10, 8, 11, 9]);
  assert.equal(projectPanelMarker(walker, current, field, inputs, [button], [], 8,
    [{ marker: [10, 8, 11, 9], command: observedCommandKey(button.command), evidence: 'paired_departure' }], [2, 2, 3, 3]), null);
});

test('support access compares new fixed ground and retains uncertainty about untested footprints', () => {
  const rows = Array.from({ length: 12 }, (_, y) => Array.from({ length: 20 }, (_, x) => {
    if (y < 4 || y > 7) return 0;
    if (x < 4 || x >= 16) return 1;
    if (x >= 8 && x <= 11 && (x === 8 || x === 11 || y === 4 || y === 7)) return 8;
    return 6;
  }));
  const walker: PanelWalker = { ink: 7, floor: 1, floorReturns: { 6: 'crossed_support' }, controls: {
    ACTION4: { delta: [2, 0], evidence: 'right' }, ACTION3: { delta: [-2, 0], evidence: 'left' },
    ACTION1: { delta: [0, -2], evidence: 'up' }, ACTION2: { delta: [0, 2], evidence: 'down' },
  } };
  const held = { tool: [8, 4, 11, 7] as const, support: [4, 4, 15, 7] as const };
  assert.equal(comparePanelSupportAccess(walker, rows, [0, 4, 1, 5], held)?.gain, 0);
  walker.contacts = { '2,8': { patch: '8,6,8,6', evidence: 'crossed_tool_edge' } };
  const original = structuredClone(rows);
  const result = comparePanelSupportAccess(walker, rows, [0, 4, 1, 5], held);
  assert.equal(result?.gain, 4);
  assert.ok(result && result.withSupport > result.withoutSupport && result.uncertain > 0);
  assert.deepEqual(rows, original);
});

test('a partially occluded cursor is tracked only after a visible departure and arrival', () => {
  const field = [0, 0, 11, 7] as const;
  const walker: PanelWalker = { ink: 7, floor: 1, controls: { ACTION4: { delta: [2, 0], evidence: 'right' } } };
  const before = Array.from({ length: 8 }, () => Array<number>(12).fill(1));
  for (const y of [2, 3]) { before[y]![2] = before[y]![3] = 7; before[y]![5] = 8; }
  const after = before.map(row => [...row]);
  for (const y of [2, 3]) { after[y]![2] = after[y]![3] = 1; after[y]![4] = 7; }
  assert.equal(confirmsPanelTranslation(walker, before, after, [2, 2, 3, 3], [4, 2, 5, 3]), true);
  const learned = learnPanelTerrain(walker, field, 0, 'ACTION4', before, after, 'partially_visible_arrival');
  assert.deepEqual(panelActor(learned, after, field), [4, 2, 5, 3]);
  assert.equal(panelActor(walker, after, field), undefined);
  assert.equal(confirmsPanelTranslation(walker, before, before, [2, 2, 3, 3], [4, 2, 5, 3]), false);
  const obscured = after.map(row => [...row]);
  obscured[2]![4] = obscured[3]![4] = 8;
  assert.equal(confirmsPanelTranslation(walker, before, obscured, [2, 2, 3, 3], [4, 2, 5, 3]), false);
  assert.equal(panelActor(learned, obscured, field), undefined);
});

test('contact discovery follows measured floor beyond the background component boundary', () => {
  const rows = Array.from({ length: 8 }, (_, y) => Array.from({ length: 12 }, (_, x) =>
    y >= 4 && y <= 5 ? (x >= 10 ? 9 : x >= 2 && x <= 3 ? 7 : 1) : 0));
  const walker: PanelWalker = { ink: 7, floor: 1, controls: {
    ACTION4: { delta: [2, 0], evidence: 'right' }, ACTION1: { delta: [0, -2], evidence: 'up' },
  } };
  const inputs = [{ action_ref: 'ACTION4', data: {} }, { action_ref: 'ACTION1', data: {} }];
  const projection = projectPanelContact(walker, rows, [0, 0, 5, 7], 0, inputs, [], 6, false, true);
  assert.deepEqual(projection?.target.box, [10, 4, 11, 5]);
  assert.deepEqual(projection?.field, [0, 0, 11, 7]);
  assert.equal(projection?.route.length, 4);
});

test('leaving an occupied marker retains its revealed footprint for a guarded return', () => {
  const field = [0, 0, 11, 9] as const;
  const right = { action_ref: 'ACTION4', data: {} }, left = { action_ref: 'ACTION3', data: {} };
  const up = { action_ref: 'ACTION1', data: {} }, down = { action_ref: 'ACTION2', data: {} };
  const walker: PanelWalker = { ink: 7, floor: 1, controls: {
    ACTION4: { delta: [2, 0], evidence: 'right' }, ACTION3: { delta: [-2, 0], evidence: 'left' },
    ACTION1: { delta: [0, -2], evidence: 'up' },
    ACTION2: { delta: [0, 2], evidence: 'down' },
  } };
  const before = Array.from({ length: 10 }, () => Array<number>(12).fill(1));
  const after = before.map(row => [...row]);
  for (const y of [4, 5]) for (const x of [2, 3]) before[y]![x] = 7;
  for (const y of [4, 5]) for (const x of [4, 5]) after[y]![x] = 7;
  after[4]![2] = after[5]![3] = 8;
  after[4]![3] = after[5]![2] = 9;
  assert.equal(projectPanelFooting(walker, after, field, [left, up], [2, 4, 3, 5], 'return', 2)?.route.length, 1);
  const learned = learnPanelTerrain(walker, field, 0, right.action_ref, before, after, 'departed_marker');
  assert.deepEqual(learned.contacts?.['2,4'], { patch: '8,9,9,8', evidence: 'departed_marker' });
  const route = projectPanelFooting(learned, after, field, [left, up], [0, 4, 1, 5], 'beyond_marker', 2);
  assert.equal(projectPanelFooting(walker, after, field, [left, up], [0, 4, 1, 5], 'beyond_marker', 2), null);
  assert.equal(route?.route.length, 2);
  assert.ok(route?.evidence.includes('departed_marker'));
  const fork = projectPanelFooting(learned, after, field, [down, left, up], [2, 6, 3, 7], 'next_control', 2);
  assert.equal(fork?.route[0]?.command.action_ref, left.action_ref);
  assert.equal(fork?.route.length, 2);
  const changed = after.map(row => [...row]);
  changed[4]![2] = 0;
  assert.equal(projectPanelFooting(learned, changed, field, [left, up], [0, 4, 1, 5], 'beyond_marker', 2), null);
});

test('a repeated animation localizes a response even when the field returns to its original pixels', () => {
  const before = [[0, 0, 2], [0, 4, 2], [0, 4, 2]];
  const flash = [[0, 0, 2], [0, 5, 2], [0, 5, 2]];
  const area = [0, 0, 2, 2] as const;
  assert.deepEqual(measureReturningAnimation(before, before, [before, flash, before, flash, before], area),
    { box: [1, 1, 1, 2], frames: [2, 4] });
  assert.equal(measureReturningAnimation(before, flash, [before, flash, before, flash], area), undefined);
  assert.equal(measureReturningAnimation(before, before, [before, flash, before], area), undefined);
});

test('a phased route applies an observed terrain return only while the occupied footprint stays supported', () => {
  const board = (opened: boolean, unstable: boolean, covering: boolean) => Array.from({ length: 10 }, (_, y) =>
    Array.from({ length: 12 }, (_, x) => {
      if (y < 4 || y >= 6) return 0;
      if (x >= 8 && x < 10) return (x + y) % 2 ? 6 : 3;
      if (x >= 4 && x < 6 && covering) return 7;
      if (x >= 2 && x < 6 && !(opened && unstable && x >= 4)) return 2;
      return x >= 6 && x < 8 && opened ? 2 : 0;
    }));
  const region = [4, 4, 7, 5] as const, actor = [4, 4, 5, 5] as const, observer = [2, 4, 3, 5] as const;
  const field = [0, 0, 11, 9] as const, target = [8, 4, 9, 5] as const;
  const walker: PanelWalker = { ink: 7, floor: 2, controls: { ACTION4: { delta: [2, 0], evidence: 'measured_walk' } } };
  const command = { action_ref: 'ACTION6', data: { x: 13, y: 4 } };
  const closed = board(false, false, false), open = board(true, false, false), covered = board(false, false, true);
  const model = rememberPanelTerrain(undefined, command, region, observer, closed, open, 'opened_floor');
  assert.ok(model);
  const inputs = [{ action_ref: 'ACTION4', data: {} }];
  const route = projectPanelTerrain(walker, covered, field, inputs, model, target, 4);
  assert.equal(route?.distance, 3);
  assert.equal(route?.change?.command, command);
  assert.deepEqual(route?.route, []);
  assert.ok(matchesPanelTerrain(board(true, false, true), region, route!.change!.after, actor));

  const unsafe = board(true, true, false);
  const unsafeModel = rememberPanelTerrain(undefined, command, region, observer, closed, unsafe, 'opened_without_support');
  assert.equal(projectPanelTerrain(walker, covered, field, inputs, unsafeModel!, target, 4), null);
  const disputed = rememberPanelTerrain(model, command, region, observer, closed, unsafe, 'different_return');
  assert.equal(disputed?.returns[0]?.after, null);
  assert.equal(projectPanelTerrain(walker, covered, field, inputs, disputed!, target, 4), null);
});

test('alignment uses the centre of a matching support pair and declines an ambiguous pair', () => {
  const field = [0, 0, 17, 11] as const, tool = [12, 2, 17, 7] as const;
  const board = (secondPair: boolean) => Array.from({ length: 12 }, (_, y) => Array.from({ length: 18 }, (_, x) => {
    if ((x >= 1 && x <= 4 || x >= 7 && x <= 10) && y >= 3 && y <= 5) return 6;
    if (secondPair && (x >= 1 && x <= 4 || x >= 7 && x <= 10) && y >= 8 && y <= 10) return 8;
    if (x >= 12 && x <= 17 && y >= 2 && y <= 7 && (x === 12 || x === 17 || y === 7)) return 7;
    return 0;
  }));
  const target = findPanelDock(board(false), field, tool);
  assert.deepEqual(target, [1, 3, 10, 5]);
  assert.ok(dockingDistance(tool, target!, [-4, 0]) < dockingDistance(tool, target!));
  assert.ok(dockingDistance(tool, target!, [4, 0]) > dockingDistance(tool, target!));
  assert.equal(findPanelDock(board(true), field, tool), undefined);
});

test('transport is acquired when the aligned tool and both support pieces translate together', () => {
  const field = [0, 0, 17, 11] as const, tool = [3, 4, 6, 7] as const;
  const board = (toolShift: number, supportShift: number) => Array.from({ length: 12 }, (_, y) =>
    Array.from({ length: 18 }, (_, x) => {
      if (y < 4 || y > 7) return 0;
      const support = x - supportShift, jaw = x - toolShift;
      if (support >= 0 && support <= 2 || support >= 7 && support <= 9) return 6;
      if (jaw >= 3 && jaw <= 6 && (jaw === 3 || jaw === 6 || y === 7)) return 7;
      return 0;
    }));
  const before = board(0, 0), held = measureAlignedTool(before, field, tool);
  assert.deepEqual(held, { tool, support: [0, 4, 9, 7] });
  assert.deepEqual(measurePanelTransport(before, board(2, 2), field, held!),
    { tool: [5, 4, 8, 7], support: [2, 4, 11, 7], delta: [2, 0] });
  assert.equal(measurePanelTransport(before, board(2, 0), field, held!), undefined);
  assert.equal(unchangedPanelTransport(before, board(0, 0), held!), true);
  assert.equal(unchangedPanelTransport(before, board(2, 0), held!), false);
  assert.equal(unchangedPanelTransport(before, board(0, 2), held!), false);
  const returns: ObservedCommandGraph = {}, source = panelTransportPose(held!);
  const moved = measurePanelTransport(before, board(2, 2), field, held!)!;
  const destination = panelTransportPose(moved);
  rememberCommandReturn(returns, source, source, 'up', 'blocked_up');
  rememberCommandReturn(returns, source, source, 'left', 'blocked_left');
  rememberCommandReturn(returns, source, destination, 'right', 'transported_right');
  rememberCommandReturn(returns, destination, source, 'left', 'transported_left');
  rememberCommandReturn(returns, destination, destination, 'right', 'blocked_right');
  rememberCommandReturn(returns, destination, destination, 'up', 'blocked_up_again');
  const next = observedCommandFrontier(returns, destination, ['up', 'left', 'right', 'down'], 3,
    pose => pose === destination ? ['up', 'left', 'right'] : ['up', 'left', 'right', 'down']);
  assert.equal(next?.action, 'left');
  assert.equal(next?.probe, 'down');
  assert.equal(next?.first?.evidence, 'transported_left');
  rememberCommandReturn(returns, destination, null, 'left', 'transport_unconfirmed');
  assert.equal(observedCommandFrontier(returns, destination, ['up', 'left', 'right'], 3), null);
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
