import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativeCommand } from '../src/logos-engine/v6-native-types.ts';
import { createGameDispatcher } from '../src/runtime/native-game-dispatcher.ts';
import { assessExchange, chooseExchange, matchesBoundExchange, matchesExchangeSeries, observeExchange, observeExchangeThreat,
  planBoundExchange, rememberExchangeVictory, witnessedExchangeStep,
  type BoundExchange, type ExchangePlan, type ExchangeTransfer, type ObservedExchange } from '../src/sic/observed-exchange.ts';
import { observeTravel, type ObservedTravel } from '../src/sic/observed-travel-frontier.ts';

test('position exchange learns both participants and composes with transport and a reflected route', async () => {
  const game = createGameDispatcher(async () => { throw new Error('Expected a native game'); });
  let board = await game.dispatch({ type: 'load', code: 'SS04', level: 1 });
  let travel: ObservedTravel | undefined, exchange: ObservedExchange | undefined, count = 0;
  const picture = (rows: typeof board.frame) => rows.map(row => [...row].reverse().map(ink => (ink + 5) % 16));
  async function learn(actionId: number, plan?: ExchangePlan) {
    const prior = travel, before = picture(board.frame), ref = `return:${++count}`;
    const command = { action_ref: `ACTION${actionId}`, data: {} };
    board = await game.dispatch({ type: 'action', actionId });
    if (board.levelsCompleted) return;
    const after = picture(board.frame);
    const returned = plan && assessExchange(exchange, prior, before, after, plan);
    travel = observeTravel(prior, before, after, command, ref);
    exchange = observeExchange(exchange, prior, travel, before, after, command, ref, board.frames.map(picture), plan?.prediction);
    return returned;
  }
  // Public actions from a run before exchange reasoning was available.
  const beforeFirstExchange = [
    1, 3, 2, 4, 1, 1, 1, 4, 1, 1, 4, 4, 2, 4, 1, 2, 2, 2, 1, 3, 2, 2, 4, 2, 2, 1, 3, 1,
  ];
  for (const input of beforeFirstExchange) {
    await learn(input);
    assert.equal(exchange, undefined);
  }
  await learn(3);
  assert.equal(exchange?.last.ref, 'return:29');
  assert.notEqual(exchange?.last.from, exchange?.last.to);
  assert.deepEqual(exchange?.last.turns, []);

  let sawTransport = false, sawReflection = false, verifiedSeries = false;
  for (let i = 0; i < 55 && !board.levelsCompleted; i++) {
    const plan = chooseExchange(exchange, travel, picture(board.frame));
    assert.ok(plan);
    if (plan.series) {
      const series = plan.series, [first] = series.steps;
      assert.ok(first && series.steps.length <= 16);
      assert.ok(matchesExchangeSeries(series, series.start, picture(board.frame)));
      for (const prediction of series.steps) {
        await learn(Number(prediction.command.slice(6)), { ...plan, prediction });
        if (board.levelsCompleted || !matchesExchangeSeries(series, prediction.pose, picture(board.frame))) break;
        verifiedSeries = true;
        sawReflection ||= !!exchange?.last.turns.length;
      }
      continue;
    }
    const returned = await learn(Number(plan.command.action_ref.slice(6)), plan);
    if (plan.goal === 'test_transport' && returned?.satisfied) sawTransport = true;
    sawReflection ||= !!exchange?.last.turns.length;
  }
  assert.ok(sawTransport);
  assert.ok(sawReflection);
  assert.ok(verifiedSeries);
  assert.equal(board.levelsCompleted, 1);
});

// The level-entry replay calibrates the controls before the bridge is made,
// so the tests can transfer both the witnessed actuator and the reflected ray.
const tutorial = [
  1, 3, 2, 4, 1, 3, 1, 4, 4, 1, 2, 1, 3, 2, 2, 4, 4,
  4, 4, 3, 2, 4, 4, 4, 1, 1, 1, 4, 2, 3, 3, 3, 1, 1,
  1, 3, 1, 4, 4, 4, 2, 2, 4, 4, 4, 1, 2, 1, 2, 2, 4,
];

for (const mirror of [false, true]) test(`exchange transfers to pressure circuits, survival and separated footholds${mirror ? ' on a mirrored board' : ''}`, async () => {
  const game = createGameDispatcher(async () => { throw Error('Expected a native game'); });
  let board = await game.dispatch({ type: 'load', code: 'SS04', level: 1 });
  const map = new Map([1, 2, 3, 4].map((id, i) => [`ACTION${(mirror ? 28 : 14) + i}`, id]));
  const inputs: NativeCommand[] = [...map.keys()].map(action_ref => ({ action_ref, data: {} }));
  const frame = (rows: typeof board.frame) => rows.map(row =>
    (mirror ? [...row].reverse() : row).map(ink => (ink + (mirror ? 9 : 5)) % 16));
  let travel: ObservedTravel | undefined, exchange: ObservedExchange | undefined, roles: ExchangeTransfer | undefined;
  for (const [i, actionId] of tutorial.entries()) {
    const before = frame(board.frame), command = { action_ref: `ACTION${actionId}`, data: {} };
    board = await game.dispatch({ type: 'action', actionId });
    if (board.levelsCompleted > 0) {
      roles = rememberExchangeVictory(exchange, travel, before, command, 'official-score');
      break;
    }
    const ref = `tutorial-return:${i + 1}`, after = frame(board.frame);
    const observed = observeTravel(travel, before, after, command, ref);
    exchange = observeExchange(exchange, travel, observed, before, after, command, ref, board.frames.map(frame));
    travel = observed;
  }
  assert.ok(roles?.exchangeRef.startsWith('tutorial-return:'));
  assert.ok(Object.values(roles.transmission ?? {}).some(ref => ref.startsWith('tutorial-return:')));
  roles = { ...roles, moves: Object.fromEntries([...map].map(([alias, id]) => [alias, roles!.moves[`ACTION${id}`]!])) };
  assert.equal(board.level, 2);
  const first = planBoundExchange(roles, frame(board.frame), inputs, 65);
  assert.ok(first && first.steps.length > 1);
  const duplicateExit = frame(board.frame).map(row => [...row]);
  const duplicate = first.field.floor.find(cell => cell !== first.pose.actor && cell !== first.field.exit
    && !first.pose.pieces.includes(cell) && !first.field.marks[cell] && !first.field.doors[cell])!;
  const [x, y] = duplicate.split(',').map(Number) as [number, number];
  roles.exitStamp.split(',').map(Number).forEach((ink, index) => {
    duplicateExit[y + Math.floor(index / 3)]![x + index % 3] = ink;
  });
  assert.equal(planBoundExchange(roles, duplicateExit, inputs, 65), undefined);

  const [door] = Object.keys(first.field.doors);
  assert.ok(door);
  const [dx, dy] = door.split(',').map(Number) as [number, number];
  let binding: BoundExchange | undefined, actions = 0, plans = 0, mixed = 0, testedDoor = false;
  while (board.level === 2 && actions < 65) {
    const plan = planBoundExchange(roles, frame(board.frame), inputs, 65 - actions, binding);
    assert.ok(plan?.steps.length && plan.steps.length <= 16);
    plans++;
    let previous = plan.pose, positioned = false;
    for (const [index, step] of plan.steps.entries()) {
      const swapped = previous.pieces.join(';') !== step.after.pieces.join(';');
      if (index && positioned && swapped) mixed++;
      positioned = !swapped;
      board = await game.dispatch({ type: 'action', actionId: map.get(step.action.action_ref)! });
      actions++;
      if (board.level > 2) break;
      const returned = frame(board.frame);
      assert.ok(matchesBoundExchange(roles, plan.field, step.after, returned));
      if (!testedDoor && !swapped) {
        const wrong = returned.map(row => [...row]);
        wrong[dy + 1]![dx + 1] = (wrong[dy + 1]![dx + 1]! + 1) % 16;
        assert.equal(matchesBoundExchange(roles, plan.field, step.after, wrong), false);
        testedDoor = true;
      }
      binding = { field: plan.field, pose: step.after };
      previous = step.after;
    }
  }
  assert.equal(board.levelsCompleted, 2);
  assert.equal(actions, 54);
  assert.equal(plans, 4);
  assert.ok(mixed > 0 && testedDoor);

  board = await game.dispatch({ type: 'load', code: 'SS04', level: 4 });
  const startingScore = board.levelsCompleted;
  assert.equal(planBoundExchange(roles, frame(board.frame), inputs, 50), undefined);
  board = await game.dispatch({ type: 'action', actionId: 2 });
  const approach = frame(board.frame), east = [...map].find(([, id]) => id === 4)![0];
  board = await game.dispatch({ type: 'action', actionId: 4 });
  assert.equal(board.state, 'GAME_OVER');
  const loss = frame(board.frame);
  const threat = observeExchangeThreat(roles, approach, loss, { action_ref: east, data: {} }, ['approach', 'loss']);
  assert.ok(threat);
  assert.equal(observeExchangeThreat(roles, approach, approach, { action_ref: east, data: {} }, ['approach', 'loss']), undefined);

  board = await game.dispatch({ type: 'reset' });
  binding = undefined;
  actions = 0;
  let movedThreat = false, verifiedThreatGuard = false;
  while (board.level === 4 && actions < 50) {
    const plan = planBoundExchange(roles, frame(board.frame), inputs, 50 - actions, binding, threat);
    assert.ok(plan?.steps.length && plan.steps.length <= 16);
    let previousPose = plan.pose;
    for (const step of plan.steps) {
      board = await game.dispatch({ type: 'action', actionId: map.get(step.action.action_ref)! });
      actions++;
      assert.notEqual(board.state, 'GAME_OVER');
      if (board.levelsCompleted > startingScore) break;
      const returned = frame(board.frame);
      assert.ok(matchesBoundExchange(roles, plan.field, step.after, returned));
      if (previousPose.threats!.join(';') !== step.after.threats!.join(';')) {
        movedThreat = true;
        const changed = returned.map(row => [...row]);
        const [sx, sy] = step.after.threats![0]!.split(',').map(Number) as [number, number];
        changed[sy]![sx] = (changed[sy]![sx]! + 1) % 16;
        assert.equal(matchesBoundExchange(roles, plan.field, step.after, changed), false);
        verifiedThreatGuard = true;
      }
      binding = { field: plan.field, pose: step.after };
      previousPose = step.after;
    }
  }
  assert.equal(board.levelsCompleted, startingScore + 1);
  assert.ok(movedThreat && verifiedThreatGuard);

  board = await game.dispatch({ type: 'load', code: 'SS04', level: 5 });
  const islandEntry = frame(board.frame), islandScore = board.levelsCompleted;
  const { transmission: _transmission, ...unmeasured } = roles;
  assert.equal(planBoundExchange(unmeasured, islandEntry, inputs, 85), undefined);
  const islandPlan = planBoundExchange(roles, islandEntry, inputs, 85);
  assert.ok(islandPlan?.pressureTarget && islandPlan.field.transmission);
  const [wx, wy] = islandPlan.field.transmission[0]!.split(',').map(Number) as [number, number];
  const changedWater = islandEntry.map(row => [...row]);
  changedWater[wy]![wx] = (changedWater[wy]![wx]! + 1) % 16;
  assert.equal(matchesBoundExchange(roles, islandPlan.field, islandPlan.pose, changedWater), false);

  binding = undefined;
  actions = 0;
  let loadedControl = false;
  while (board.levelsCompleted === islandScore && actions < 85) {
    const plan = planBoundExchange(roles, frame(board.frame), inputs, 85 - actions, binding);
    assert.ok(plan?.steps.length && plan.steps.length <= 16);
    for (const step of plan.steps) {
      board = await game.dispatch({ type: 'action', actionId: map.get(step.action.action_ref)! });
      actions++;
      assert.notEqual(board.state, 'GAME_OVER');
      if (board.levelsCompleted > islandScore) break;
      assert.ok(matchesBoundExchange(roles, plan.field, step.after, frame(board.frame)));
      loadedControl ||= step.after.pieces.includes(islandPlan.pressureTarget);
      binding = { field: plan.field, pose: step.after };
    }
  }
  assert.equal(board.levelsCompleted, islandScore + 1);
  assert.equal(actions, 79);
  assert.ok(loadedControl);

  board = await game.dispatch({ type: 'load', code: 'SS04', level: 6 });
  const circuitEntry = frame(board.frame), circuitScore = board.levelsCompleted;
  const { openings: _openings, ...unboundGate } = roles;
  const { reflections: _reflections, ...unboundReflection } = roles;
  assert.equal(planBoundExchange(unboundGate, circuitEntry, inputs, 50), undefined);
  assert.equal(planBoundExchange(unboundReflection, circuitEntry, inputs, 50), undefined);
  const circuitPlan = planBoundExchange(roles, circuitEntry, inputs, 50);
  assert.ok(circuitPlan?.pressureTarget && circuitPlan.field.reflectors);
  const controls = circuitPlan.field.doors[circuitPlan.field.exit]!.controls;
  assert.equal(controls.length, 2);
  assert.equal(Object.keys(circuitPlan.field.reflectors).length, 2);
  assert.ok(circuitPlan.field.mechanismRefs?.length);
  const changedMirror = circuitEntry.map(row => [...row]);
  const [mx, my] = Object.keys(circuitPlan.field.reflectors)[0]!.split(',').map(Number) as [number, number];
  changedMirror[my]![mx] = (changedMirror[my]![mx]! + 1) % 16;
  assert.equal(matchesBoundExchange(roles, circuitPlan.field, circuitPlan.pose, changedMirror), false);
  let placed: string[] = [], reflected = false;
  binding = undefined;
  actions = 0;
  while (board.levelsCompleted === circuitScore && actions < 50) {
    const plan = planBoundExchange(roles, frame(board.frame), inputs, 50 - actions, binding);
    assert.ok(plan?.steps.length && plan.steps.length <= 16);
    let previous = plan.pose;
    for (const step of plan.steps) {
      board = await game.dispatch({ type: 'action', actionId: map.get(step.action.action_ref)! });
      actions++;
      if (board.levelsCompleted > circuitScore) break;
      assert.ok(matchesBoundExchange(roles, plan.field, step.after, frame(board.frame)));
      const [fromX, fromY] = previous.actor.split(','), [toX, toY] = step.after.actor.split(',');
      reflected ||= fromX !== toX && fromY !== toY;
      const next = controls.filter(cell => step.after.pieces.includes(cell));
      assert.ok(placed.every(cell => next.includes(cell)));
      if (!placed.length && next.length) assert.ok(next.includes(circuitPlan.pressureTarget));
      placed = next;
      binding = { field: plan.field, pose: step.after };
      previous = step.after;
    }
  }
  assert.equal(board.levelsCompleted, circuitScore + 1);
  assert.equal(actions, 35);
  assert.deepEqual(placed, controls);
  assert.equal(reflected, true);

  board = await game.dispatch({ type: 'load', code: 'SS04', level: 7 });
  const bridgeEntry = frame(board.frame), bridgeScore = board.levelsCompleted;
  const withoutTransport = { ...roles, openings: roles.openings?.filter(sample => !sample.bridge) };
  assert.equal(planBoundExchange(withoutTransport, bridgeEntry, inputs, 110, undefined, threat), undefined);
  const bridgePlan = planBoundExchange(roles, bridgeEntry, inputs, 110, undefined, threat);
  assert.ok(bridgePlan && (bridgePlan.bridgeTarget || bridgePlan.pressureTarget), 'The first proposal should advance the composition');
  assert.equal(Object.keys(bridgePlan.field.bridges ?? {}).length, 2);
  binding = undefined;
  actions = 0;
  let bridgeCount = 0, holdsWithBothRoles = false;
  while (board.levelsCompleted === bridgeScore && actions < 110) {
    const plan = planBoundExchange(roles, frame(board.frame), inputs, 110 - actions, binding, threat);
    assert.ok(plan?.steps.length && plan.steps.length <= 16);
    const dependencies = Object.values(plan.field.doors).find(door => door.controls.length === 2)!.controls;
    for (const step of plan.steps) {
      board = await game.dispatch({ type: 'action', actionId: map.get(step.action.action_ref)! });
      actions++;
      assert.notEqual(board.state, 'GAME_OVER');
      if (board.levelsCompleted > bridgeScore) break;
      assert.ok(matchesBoundExchange(roles, plan.field, step.after, frame(board.frame)), `Bridge route diverged at command ${actions}`);
      assert.ok((step.after.bridges?.length ?? 0) >= bridgeCount);
      bridgeCount = step.after.bridges?.length ?? 0;
      holdsWithBothRoles ||= dependencies.some(cell => step.after.pieces.includes(cell))
        && dependencies.some(cell => step.after.threats?.includes(cell));
      binding = { field: plan.field, pose: step.after };
    }
  }
  assert.equal(board.levelsCompleted, bridgeScore + 1);
  assert.equal(bridgeCount, 2);
  assert.equal(holdsWithBothRoles, true);

  board = await game.dispatch({ type: 'load', code: 'SS04', level: 8 });
  const finalScore = board.levelsCompleted;
  const hidden = planBoundExchange(roles, frame(board.frame), inputs, 100, undefined, threat);
  assert.ok(hidden?.revealControl);
  assert.equal(Object.keys(hidden.field.reflectors ?? {}).length, 2);
  actions = 0;
  binding = undefined;
  let observedReveal = false, tookReflectedRoute = false;
  while (board.levelsCompleted === finalScore && actions < 100) {
    const plan = planBoundExchange(roles, frame(board.frame), inputs, 100 - actions, binding, threat);
    assert.ok(plan?.steps.length && plan.steps.length <= 16, `No plan at action ${actions}`);
    let prior = plan.pose;
    for (const [index, step] of plan.steps.entries()) {
      const before = frame(board.frame);
      board = await game.dispatch({ type: 'action', actionId: map.get(step.action.action_ref)! });
      actions++;
      assert.notEqual(board.state, 'GAME_OVER');
      if (board.levelsCompleted > finalScore) break;
      const witnessed = witnessedExchangeStep(plan, index, frame(board.frame), `final-return:${actions}`);
      assert.ok(witnessed, `Unwitnessed action ${actions}${plan.revealControl ? ' in discovery series' : ''}`);
      if (plan.revealControl && index === plan.steps.length - 1) {
        assert.equal(witnessedExchangeStep(plan, index, before, 'unconfirmed'), undefined);
        assert.equal(Object.keys(witnessed.field.doors).length - Object.keys(plan.field.doors).length, 2);
        assert.equal(witnessed.pose.bridges?.length, 1);
        observedReveal = true;
      }
      const [fromX, fromY] = prior.actor.split(','), [toX, toY] = witnessed.pose.actor.split(',');
      tookReflectedRoute ||= fromX !== toX && fromY !== toY;
      binding = witnessed;
      prior = witnessed.pose;
    }
  }
  assert.equal(board.levelsCompleted, finalScore + 1);
  assert.ok(observedReveal && tookReflectedRoute);
});
