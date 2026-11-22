import assert from 'node:assert/strict';
import test from 'node:test';
import { composeSupportPlan, closedSupportRegion } from '../src/sic/compose-support-plan.ts';
import type { Board } from '../src/sic/contact-frontier-search.ts';

function workshop(): Board {
  const width = 12;
  const cell = (x: number, y: number) => x + width * y;
  const floor = new Set<number>();
  for (let y = 1; y <= 5; y++) for (let x = 1; x <= 5; x++) floor.add(cell(x, y));
  for (let y = 2; y <= 3; y++) for (let x = 8; x <= 9; x++) floor.add(cell(x, y));
  return {
    width,
    height: 7,
    floor,
    actor: cell(1, 3),
    parts: [cell(3, 3), cell(4, 4)],
    roles: ['slab', 'slab'],
    goals: [cell(9, 3)],
    pivotIndex: -1,
    motors: [
      { op: 'west', delta: -1 },
      { op: 'east', delta: 1 },
      { op: 'north', delta: -width },
      { op: 'south', delta: width },
    ],
  };
}
const limits = { maxDepth: 50, maxNodes: 500 };
test('projects a second consumable and its pushing stance before spending the first on a two-cell gap', () => {
  const board = workshop(),
    allow = (role: string) => role === 'slab';
  const plan = composeSupportPlan(board, allow, new Set(), limits);
  assert.ok(plan);
  const obligations = plan.preparations!;
  assert.equal(obligations.length, 2);
  assert.equal(obligations[1]!.at - obligations[0]!.at, 1);
  assert.ok(obligations[0]!.enables.includes('transit_of:slab'));
  const floor = new Set(board.floor),
    pieces = new Set(board.parts);
  let at = board.actor;
  for (const step of plan.steps) {
    assert.equal(step.from, at);
    if (step.role) {
      assert.ok(pieces.delete(step.to));
      assert.ok(!pieces.has(step.placed!));
      if (step.boundary) {
        assert.ok(!floor.has(step.placed!));
        floor.add(step.placed!);
      } else {
        assert.ok(floor.has(step.placed!));
        pieces.add(step.placed!);
      }
    }
    assert.ok(floor.has(step.to));
    at = step.to;
  }
  assert.ok(board.goals.includes(at));
  assert.equal(
    composeSupportPlan({ ...board, parts: [board.parts[0]!], roles: ['slab'] }, allow, new Set(), limits),
    null
  );
  assert.equal(
    composeSupportPlan(board, () => false, new Set(), limits),
    null
  );
  assert.equal(composeSupportPlan(board, allow, new Set(), { ...limits, maxDepth: 2 }), null);
});

test('bounded recovery distinguishes exhausted possibilities from a search which ran out of budget', () => {
  const b = workshop();
  assert.equal(closedSupportRegion(b, 1), null);
  const empty = { ...b, parts: [], roles: [] };
  assert.equal(closedSupportRegion(empty, 10), 1);
  assert.equal(closedSupportRegion({ ...empty, goals: [b.actor] }, 10), null);
});
