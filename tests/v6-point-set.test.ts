import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PointSet, pointHash, type Point } from '../src/logos-engine/v6-point-set.ts';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/v6-point-set-reference.json', import.meta.url), 'utf8'));
test('finite point hashes retain the exact reference 64-bit tuple hash', () => {
  for (const item of fixture.hashes) assert.equal(pointHash(item.point).toString(), item.hash);
});
test('coordinate set operations, tie order and restored tables match CPython', () => {
  const sets = new Map<string, PointSet>();
  for (const [index, { operation: op, expected, order, state }] of fixture.steps.entries()) {
    let result: unknown = null;
    if (op.kind === 'create') sets.set(op.name, new PointSet(op.points));
    else if (op.kind === 'add') sets.get(op.name)!.add(op.point);
    else if (op.kind === 'delete') result = sets.get(op.name)!.delete(op.point);
    else if (op.kind === 'pop') result = sets.get(op.name)!.pop();
    else if (op.kind === 'update') sets.get(op.name)!.update(sets.get(op.other)!);
    else if (op.kind === 'difference_update') sets.get(op.name)!.differenceUpdate(sets.get(op.other)!);
    else if (op.kind === 'copy') sets.set(op.name, sets.get(op.left)!.copy());
    else if (op.kind === 'union') sets.set(op.name, sets.get(op.left)!.union(sets.get(op.right)!));
    else if (op.kind === 'intersection') sets.set(op.name, sets.get(op.left)!.intersection(sets.get(op.right)!));
    else if (op.kind === 'difference') sets.set(op.name, sets.get(op.left)!.difference(sets.get(op.right)!));
    else throw new Error(`Unknown operation ${op.kind}`);
    assert.deepEqual(result, expected, `result ${index} ${op.kind}`);
    assert.deepEqual([...sets.get(op.name)!], order, `order ${index} ${op.kind}`);
    assert.deepEqual(sets.get(op.name)!.state(), state, `table ${index} ${op.kind}`);
    // Check the actual graph serialization/reconstruction boundary on every step.
    for (const [name, value] of sets) sets.set(name, PointSet.restore(JSON.parse(JSON.stringify(value.state()))));
  }
});
test('point-set membership and codecs reject non-integral or malformed domains', () => {
  assert.throws(() => new PointSet([[0.5, 1] as Point]), /safe integers/);
  assert.throws(() => PointSet.restore({ format: 'cpython-3.12-64-point-set', capacity: 9, finger: 0, entries: [], dummies: [] }), /Incompatible/);
  const points = new PointSet([[1, 2], [3, 4]]); assert(points.isSubset(points)); assert(points.equals(points)); assert(points.disjoint(new PointSet([[9, 9]])));
});
