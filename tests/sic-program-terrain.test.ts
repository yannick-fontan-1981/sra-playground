import assert from 'node:assert/strict';
import test from 'node:test';
import { planRespondentPrograms, type RespondentContext } from '../src/sic/respondent-program-planner.ts';
import { measureRespondentTerrain } from '../src/sic/program-terrain-context.ts';

test('measure repeated interior markings and preserve occluded terrain as unknown', () => {
  const rows = Array.from({ length: 7 }, () => Array<number>(9).fill(0));
  const points: number[][] = [];
  for (let x = 1; x <= 7; x++) for (let y = 1; y <= 5; y++) {
    const markedOrHidden = y === 3 && (x === 3 || x === 5) || x === 4 && y === 2;
    rows[y]![x] = markedOrHidden ? 7 : 3;
    if (!markedOrHidden) points.push([x, y]);
  }
  const model = { basis: [[1, 0], [0, 1]], layer: { shape: [[0, 0]], step: [0, 1] } };
  const field = { points, origin: [1, 1], bounds: [[0, 6], [0, 4]] };
  const terrain = measureRespondentTerrain(rows, field, model, [{ anchor: [4, 2], word: [7] }]);
  assert.deepEqual(terrain, { marked: [[3, 3], [5, 3]], unknown: [[4, 2]] });
  rows[3]![5] = 6;
  assert.equal(measureRespondentTerrain(rows, field, model, [{ anchor: [4, 2], word: [7] }]), null);
});

const model = { moves: [{ label: 1, vectors: [[1, 0]] }, { label: 2, vectors: [[-1, 0]] }],
  interaction: { label: 3, vectors: [[1, 0], [-1, 0]] } };
const context: RespondentContext = { initial: { base: [0, 0], targets: [{ base: [3, 0], word: [1] }] },
  points: [[0, 0], [1, 0], [2, 0], [3, 0], [5, 0]], sites: [[0, 0]], evidence: ['before'],
  terrain: { marked: [[4, 0]], unknown: [] } };

test('project a respondent crossing the marked tile after the controlled stack finishes moving', () => {
  const plan = planRespondentPrograms(model, context, [1], [1, 2, 3], 1, Infinity);
  assert.deepEqual(plan, [{
    kind: 'execute', before: [1], word: [1], base: [0, 0], forecasts: [{ base: [1, 0], targets: [] }],
    markedTerrain: [[4, 0]],
  }]);
  assert.equal(planRespondentPrograms(model, { ...context, terrain: undefined }, [1], [1, 2, 3], 1, Infinity), null);
  const unknown: RespondentContext = { ...context, terrain: { marked: [[4, 1]], unknown: [[4, 0]] } };
  assert.equal(planRespondentPrograms(model, unknown, [1], [1, 2, 3], 1, Infinity), null);
});

test('refuse a marked landing for the controlled stack', () => {
  const unsafe: RespondentContext = { ...context, initial: { ...context.initial, base: [5, 0] } };
  assert.equal(planRespondentPrograms(model, unsafe, [2], [1, 2, 3], 1, Infinity), null);
});

test('refuse a terrain experiment if the blocking alternative exposes the controlled stack to contact', () => {
  const unsafe: RespondentContext = {
    ...context, initial: { base: [1, 0], targets: [{ base: [3, 0], word: [3, 1] }] },
  };
  assert.equal(planRespondentPrograms(model, unsafe, [1], [1, 2, 3], 1, Infinity), null);
});
