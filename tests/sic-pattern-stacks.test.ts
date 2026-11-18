import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import type { NativePoint } from '../src/logos-engine/v6-native-types.ts';
import { chooseStackStep, readStackExample, type PatternGrid, type PatternPiece, type PatternPiles } from '../src/sic/pattern-stacks.ts';
import { gridFromBorder } from '../src/sic/observed-pattern-layout.ts';

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

test('tile edges recover the checker grid when one axis has no complete floor scan', async () => {
  const xs = [4, 9, 15, 21, 26, 34, 40, 46], ys = [3, 8, 15, 22, 29, 36];
  const rows = Array.from({ length: 48 }, () => Array<number>(48).fill(0));
  for (let y = 2; y <= 36; y++) rows[y]!.fill(3, 3, 47);
  for (let r = 0; r < ys.length - 1; r++) for (let c = 0; c < xs.length - 1; c++) {
    const occupied = [1, 2, 3, 5].includes(c);
    const ink = occupied ? 8 + (r + c) % 7 : (r + c) % 2 === 0 ? 5 : 4;
    for (let y = ys[r]!; y < ys[r + 1]!; y++) rows[y]!.fill(ink, xs[c], xs[c + 1]);
  }
  const observe = (frame_rows: number[][]) => measureNativeObservation({ frame_rows, level: 1, levels_completed: 0,
    state: 'NOT_FINISHED', available_action_refs: [], frame_hash: 'recovered-checker' }, 1);
  const observation = await observe(rows);
  assert.deepEqual(gridFromBorder(observation.entities, rows, true), {
    xs, ys, floor: [5, 4], boundary: [3, 2, 46, 36],
  });
  const transposed = rows[0]!.map((_, x) => rows.map(row => row[x]!));
  const rotated = await observe(transposed);
  assert.deepEqual(gridFromBorder(rotated.entities, transposed, true), {
    xs: ys, ys: xs, floor: [5, 4], boundary: [2, 3, 36, 46],
  });
});
