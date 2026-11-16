import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import type { NativePoint } from '../src/logos-engine/v6-native-types.ts';
import { chooseStackStep, readStackExample, type PatternGrid, type PatternPiece, type PatternPiles } from '../src/sic/pattern-stacks.ts';

const grid: PatternGrid = { xs: [1, 5, 7, 13], ys: [1, 5, 11], floor: [5, 4], boundary: [0, 0, 13, 11] };

test('the scaled example includes a needed color that is missing from the visible pieces', async () => {
  const rows = Array.from({ length: 32 }, () => Array<number>(32).fill(5));
  for (let y = 20; y <= 21; y++) {
    rows[y]![22] = rows[y]![23] = 8;
    rows[y]![24] = 9;
  }
  for (let y = 22; y <= 24; y++) rows[y]!.fill(11, 25, 28);
  const observation = await measureNativeObservation({ frame_rows: rows, level: 1, levels_completed: 0,
    state: 'NOT_FINISHED', available_action_refs: [], frame_hash: 'fixture' }, 1);
  const visible: PatternPiece[] = [{ color: 8, cell: [0, 1], selected: false }, { color: 8, cell: [1, 1], selected: false }];
  assert.deepEqual(readStackExample(grid, rows, observation.entities, visible)?.map(goal => [goal.color, goal.cell]),
    [[8, [0, 0]], [9, [1, 0]], [11, [2, 1]]]);
});

test('the planner exposes a needed lower piece and keeps a matching top with a duplicate elsewhere', () => {
  const matching: PatternPiece = { color: 8, cell: [0, 0], selected: false };
  const surplus: PatternPiece = { color: 8, cell: [1, 1], selected: true };
  const requested: PatternPiece = { color: 9, cell: [2, 0], selected: false };
  const goals = [
    { color: 8, cell: matching.cell, box: [22, 20, 23, 21] as const },
    { color: 9, cell: [1, 0] as const, box: [24, 20, 24, 21] as const },
  ];
  const piles: PatternPiles = { '0,0': { colors: [8], unknownBelow: true }, '1,1': { colors: [8, 9], unknownBelow: false } };
  const route = (piece: PatternPiece, goal: NativePoint) => {
    const distance = Math.abs(piece.cell[0] - goal[0]) + Math.abs(piece.cell[1] - goal[1]);
    return distance === 1 ? { command: 'ACTION1', step: goal, length: 1 } : null;
  };
  const uncover = chooseStackStep(grid, [matching, surplus], goals, piles, route);
  assert.equal(uncover?.piece, surplus);
  assert.equal(uncover.intent, 'uncover');
  const park = chooseStackStep(grid, [matching, surplus, requested], goals, piles, route);
  assert.equal(park?.piece, surplus);
  assert.equal(park.intent, 'park');
});
