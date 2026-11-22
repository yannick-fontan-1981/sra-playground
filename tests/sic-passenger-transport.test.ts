import assert from 'node:assert/strict';
import test from 'node:test';
import type { Board } from '../src/sic/contact-frontier-search.ts';
import { passengerProject } from '../src/sic/passenger-transport.ts';

// Independent board with a horizontal exchanger. The passive piece starts in
// an alcove; a horizontal transfer makes all four delivery stances available.
function alcove(): Board {
  const scene = [
    '###########',
    '###....#..#',
    '###....#..#',
    '#p.c...#.g#',
    '###.s..#..#',
    '###....#..#',
    '###########',
  ];
  const width = scene[0]!.length, cells = [...scene.join('')];
  return {
    width, height: scene.length, floor: new Set(cells.flatMap((v,i) => v === '#' ? [] : [i])),
    goals: [cells.indexOf('g')], actor: cells.indexOf('s'), parts: [cells.indexOf('c'), cells.indexOf('p')],
    roles: ['axis', 'cargo'], pivotIndex: 0,
    motors: [{op:'right',delta:1},{op:'up',delta:-width},{op:'left',delta:-1},{op:'down',delta:width}],
    transport: { op: 'exchange', land: (from, axis) => {
      if (from === axis || Math.floor(from/width) !== Math.floor(axis/width)) return null;
      const col = 2 * (axis % width) - from % width;
      return col >= 0 && col < width ? axis - axis % width + col : null;
    } },
  };
}
const limits = {maxNodes: 500, maxDepth: 36};
test('selects a reversible isolated test by the pushes unlocked and reuses a witnessed passenger', () => {
  const b = alcove(), index = 1, gap = b.width * 3 + 7;
  const probe = passengerProject(b, index, undefined, at => at === gap, new Set(), limits);
  assert.equal(probe?.purpose, 'test_passenger');
  assert.equal(probe.steps.length, 1);
  const step = probe.steps[0]!;
  assert.equal(step.op, 'exchange');
  assert.equal(step.from, step.to);
  assert.equal(step.passenger?.source, b.parts[index]);
  assert.deepEqual(new Set(step.passenger.pushes), new Set(b.motors.map(m => m.op)));
  assert.equal(b.transport!.land(step.placed!, b.parts[0]!), b.parts[index]);
  const after = {...b, parts: [b.parts[0]!, step.placed!]};
  const plan = passengerProject(after, index, 'observed-arrival', p => p === gap, new Set(), limits);
  assert.equal(plan?.purpose, 'reach_goal');
  assert.ok(plan.steps.some(s => s.boundary && s.placed === gap));
  assert.equal(plan.steps.at(-1)?.to, b.goals[0]);
});
test('abstains when the hypothesized transfer has no inverse, or the declared search depth is insufficient', () => {
  const b = alcove(), target = 3*b.width + 5;
  const oneWay = {...b, transport:{ op:'send', land:(from:number) => from === b.parts[1] ? target : null }};
  assert.equal(passengerProject(oneWay, 1, undefined, () => true, new Set(), limits), null);
  assert.equal(passengerProject(b, 1, undefined, () => true, new Set(), {...limits,maxDepth:0}), null);
});
