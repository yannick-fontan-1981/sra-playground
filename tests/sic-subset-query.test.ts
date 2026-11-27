import assert from 'node:assert/strict';
import test from 'node:test';
import { selectSubsetQuery, subsetQuerySplit, type SubsetQueryOffer } from '../src/sic/subset-query.ts';

function offer(kind: SubsetQueryOffer['kind'], tested: number[], inside: number, population: number, x = 3): SubsetQueryOffer {
  return { kind, tested, command: { action_ref: 'ACTION6', data: { x, y: 2 } }, controlShape: null,
    ...subsetQuerySplit(inside, population) };
}
test('a click alone does not determine a subset partition', () => {
  const balanced = offer('scope', [0,4], 2, 4), one = offer('member', [1], 1, 4);
  assert.deepEqual(balanced.command, one.command);
  assert.deepEqual([balanced.remaining, one.remaining], [2,3]);
  assert.equal(selectSubsetQuery([one,balanced]), balanced);
  assert.equal(selectSubsetQuery([balanced,one]), balanced);
  assert.deepEqual(subsetQuerySplit(1,1), { global:1,local:0,remaining:1 });
  assert.equal(selectSubsetQuery([]), undefined);
});
test('equal costs use the source tie order and retain the actual offer object', () => {
  const left = offer('scope',[0,4],2,4,6), right = offer('scope',[1,5],2,4,27);
  assert.equal(selectSubsetQuery([right,left]), left);
  const control = offer('scope',[0],1,2), member = offer('member',[0],1,2);
  assert.equal(selectSubsetQuery([member,control]), control);
  const anotherControl = { ...control, command: right.command };
  assert.equal(selectSubsetQuery([anotherControl,control]), anotherControl);
});
