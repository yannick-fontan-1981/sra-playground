import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativeCommand, NativeRows } from '../src/logos-engine/v6-native-types.ts';
import { observeCoverage, rememberCoverageWin, type CoverageLearning, type CoverageTransfer } from '../src/sic/observed-coverage.ts';
import { choosePushAccess, matchesPushAccess, observePushAccess, pushAccessBindingAfter, rebindPushAccess, rememberPushAccess,
  type PushAccessBinding, type PushAccessKnowledge } from '../src/sic/observed-push-access.ts';
import { observeTravel, readTravelGrid, type ObservedTravel } from '../src/sic/observed-travel-frontier.ts';
import { createGameDispatcher } from '../src/runtime/native-game-dispatcher.ts';

const input = (id: number): NativeCommand => ({ action_ref: `ACTION${id}`, data: {} });
const inputs = [1, 2, 3, 4].map(input);
const prefix = [2, 2, 4, 2, 1, 3, 2, 4, 1, 4, 3, 2, 2, 4, 1, 1, 3, 3, 4, 4, 2, 4, 4];

for (const [pitch, floor, ink, surface, side] of [[3, 1, 6, 10, 1], [5, 12, 3, 4, 0]] as const) {
  test(`rebinds the cursor on a witnessed ${pitch}-pixel footing and rejects ambiguous returns`, () => {
    const area = pitch * pitch;
    const shape = new Set([Math.floor(area / 2), Math.floor(area / 2) + 1, Math.floor(area / 2) - pitch]);
    const footing = Array.from({ length: area }, (_, i) => i % 2 ? surface : surface + 1);
    const signature = footing.map((_, i) => shape.has(i) ? ink : floor).sort((a, b) => a - b).join(',');
    const commands = side ? ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'] : ['ACTION4', 'ACTION3', 'ACTION2', 'ACTION1'];
    const grid = { pitch, phase: [0, 0] as const, floor, ink, signature };
    const moves = Object.fromEntries(commands.map((command, i) => [command, { delta: [[pitch, 0], [0, pitch], [-pitch, 0], [0, -pitch]][i] as [number, number], ref: 'walk' }]));
    const conversion = { water: Array(area).fill(surface).join(','), support: footing.join(','), ref: 'formed', crossingRef: 'crossed' };
    const controls = { grid, moves };
    const rows = Array.from({ length: pitch }, (_, y) => Array.from({ length: 2 * pitch }, (_, x) => {
      if (Math.floor(x / pitch) !== side) return floor;
      const i = y * pitch + x % pitch;
      return shape.has(i) ? ink : footing[i]!;
    }));
    const memory = { controls, roles: { conversion } };
    const rebound = rebindPushAccess(memory, rows, commands);
    const position = `${side * pitch},0`;
    assert.equal(rebound?.travel.actor, position);
    assert.deepEqual([...readTravelGrid(rows, rebound!.travel.grid).onFooting], [position]);
    assert.equal(rebindPushAccess({ controls, roles: {} }, rows, commands), undefined);
    const duplicated = rows.map(row => [...row.slice(side * pitch, (side + 1) * pitch), ...row.slice(side * pitch, (side + 1) * pitch)]);
    assert.equal(rebindPushAccess(memory, duplicated, commands), undefined);
  });
}

for (const mirrored of [false, true]) {
  test(`learned pushing preserves access to the marked destination${mirrored ? ' after mirroring and recoloring' : ''}`, async () => {
    const game = createGameDispatcher(async () => { throw new Error('Expected the native game'); });
    let board = await game.dispatch({ type: 'load', code: 'SS02', level: 2 });
    let travel: ObservedTravel | undefined, knowledge: PushAccessKnowledge | undefined;
    const ink = (n: number) => mirrored ? (n + 5) % 16 : n;
    const observed = (rows: NativeRows) => mirrored ? rows.map(row => [...row].reverse().map(ink)) : rows;
    const transfer: CoverageTransfer = { epoch: 1, motion: 'push', ref: 'prior-observed-score',
      exitPattern: [11, 11, 11, 11, 3, 11, 11, 11, 11].map(ink).join(',') };
    let actions = 0;
    async function act(command: NativeCommand) {
      const before = observed(board.frame);
      board = await game.dispatch({ type: 'action', actionId: Number(command.action_ref.slice(6)) });
      const after = observed(board.frame), ref = `step:${++actions}`;
      const updated = observeTravel(travel, before, after, command, ref);
      knowledge = observePushAccess(knowledge, travel, updated, before, after, command, ref);
      travel = updated;
    }
    for (const action of prefix) await act(input(action));
    assert.equal(knowledge?.push?.chain, true);
    assert.ok(knowledge?.wall && travel);
    const first = choosePushAccess(knowledge, transfer, travel, observed(board.frame), inputs, 120);
    assert.ok(first?.blocked);
    assert.equal(first.blocked.blockedBy.action_ref, 'ACTION4');
    assert.ok(first.steps.length > 1);
    assert.equal(first.steps.at(-1)?.pushed, true);
    assert.ok(matchesPushAccess(knowledge, travel, observed(board.frame), first, first.start));
    assert.equal(matchesPushAccess(knowledge, travel, observed(board.frame), first, first.steps[0]!.after), false);
    assert.equal(choosePushAccess(knowledge, transfer, travel, observed(board.frame), inputs, 1), undefined);

    while (board.level === 2 && actions < 65) {
      const plan = choosePushAccess(knowledge, transfer, travel, observed(board.frame), inputs, 120 - actions,
        { field: first.field, supports: [] });
      assert.ok(plan);
      for (const step of plan.steps) {
        await act(step.command);
        if (board.level === 2) assert.ok(knowledge && travel && matchesPushAccess(knowledge, travel, observed(board.frame), plan, step.after));
      }
    }
    assert.equal(board.levelsCompleted, 1);
  });
}

const supportVariants: { name: string; levels: number[]; observe: (rows: NativeRows) => NativeRows }[] = [
  { name: 'survives changes of layout and target count', levels: [2, 3, 4, 5, 6], observe: rows => rows },
  { name: 'survives mirroring and palette changes', levels: [5, 6],
    observe: rows => rows.map(row => [...row].reverse().map(ink => (ink + 5) % 16)) },
  { name: 'survives swapped axes and a different palette', levels: [5, 6],
    observe: rows => rows[0]!.map((_, x) => rows.map(row => 15 - row[x]!)) },
];
for (const { name, levels, observe } of supportVariants) test(`support planning ${name}`, async () => {
  const game = createGameDispatcher(async () => { throw new Error('Expected the native game'); });
  let board = await game.dispatch({ type: 'load', code: 'SS02' });
  let travel: ObservedTravel | undefined, coverage: CoverageLearning | undefined, knowledge: PushAccessKnowledge | undefined;
  let transfer: CoverageTransfer | undefined, evidence = 0, witnessRows = observe(board.frame);
  // Public returns from the completed tutorial include a sink, a later crossing and a gate opening.
  const tutorial = [1, 3, 2, 4, 2, 1, 4, 3, 4, 4, 4, 4, 4, 4, 2, 4, 4, 1, 1, 1,
    3, 1, 4, 2, 2, 3, 2, 2, 2, 3, 2, 4, 4, 1, 1, 1, 4, 4, 4, 4];
  for (const actionId of tutorial) {
    const before = observe(board.frame), command = input(actionId), ref = `tutorial:${++evidence}`;
    board = await game.dispatch({ type: 'action', actionId });
    if (board.levelsCompleted > 0) {
      transfer = rememberCoverageWin(coverage, travel, before, command, 1, ref);
      witnessRows = before;
      break;
    }
    const after = observe(board.frame), returned = observeTravel(travel, before, after, command, ref);
    coverage = observeCoverage(coverage, travel, returned, before, after, command, ref);
    knowledge = observePushAccess(knowledge, travel, returned, before, after, command, ref, coverage);
    travel = returned;
  }
  const memory = rememberPushAccess(knowledge, travel, { rows: witnessRows, ref: 'tutorial:boundary' });
  assert.ok(transfer && memory?.roles.conversion?.crossingRef && memory.roles.pressure);
  assert.equal(Object.keys(memory.controls.moves).length, 4);

  for (const level of levels) {
    board = await game.dispatch({ type: 'selectLevel', level });
    const cap = level === 5 ? 160 : 120;
    let binding: PushAccessBinding | undefined, turns = 0, supports = 0, marksHeld = 0, retainedRoute = false;
    const initialCompleted = board.levelsCompleted;
    while (board.level === level && turns < cap) {
      const rows = observe(board.frame);
      const rebound = rebindPushAccess(memory, rows, board.availableActionIds.map(id => input(id).action_ref));
      assert.ok(rebound);
      const plan = choosePushAccess(rebound.roles, transfer, rebound.travel, rows, inputs, cap - turns, binding);
      assert.ok(plan);
      if (turns === 0) {
        assert.ok(plan.steps.length > 1);
        if (level >= 3) {
          assert.ok(plan.plannedSupport);
          assert.equal(plan.field.marks.length, level === 3 ? 1 : 2);
        }
      }
      for (const [index, step] of plan.steps.entries()) {
        board = await game.dispatch({ type: 'action', actionId: Number(step.command.action_ref.slice(6)) });
        turns++;
        supports = step.after.supports.length;
        marksHeld = plan.field.marks.filter(mark => step.after.bodies.includes(mark)).length;
        if (board.level === level) assert.ok(matchesPushAccess(rebound.roles, rebound.travel, observe(board.frame), plan, step.after));
        // The persisted checkpoint orders keys independently of the field reader.
        const { gates, goal, ground, marks, water } = plan.field;
        binding = { ...pushAccessBindingAfter(plan, index), field: { gates, goal, ground, marks, water } };
        retainedRoute ||= !!binding.continuation;
      }
    }
    assert.equal(board.levelsCompleted, initialCompleted + 1);
    if (level >= 3) assert.ok(supports > 0);
    if (level === 5) {
      assert.equal(supports, 3);
      assert.equal(marksHeld, 2);
      assert.ok(retainedRoute);
    }
  }
});
