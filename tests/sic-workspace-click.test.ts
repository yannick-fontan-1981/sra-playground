import assert from 'node:assert/strict';
import test from 'node:test';
import { countChangesInside } from '../src/sic/workspace-click.ts';

test('a work area return changes only its interior', () => {
  const before = Array.from({ length: 5 }, () => Array<number>(6).fill(0));
  const after = structuredClone(before);
  after[2]![2] = 7;
  const workspace = [1, 1, 4, 3] as const;
  assert.equal(countChangesInside(before, before, workspace), 0);
  assert.equal(countChangesInside(before, after, workspace), 1);
  after[0]![0] = 7;
  assert.equal(countChangesInside(before, after, workspace), null);
  after[0]![0] = 0;
  after[2]![4] = 7;
  assert.equal(countChangesInside(before, after, workspace), null);
});
