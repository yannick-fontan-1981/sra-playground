import test from 'node:test';
import assert from 'node:assert/strict';
import { relayTransportPlan } from '../src/sic/relay-transport-plan.ts';
import type { Board } from '../src/sic/contact-frontier-search.ts';

const width = 17,
  cell = (x: number, y: number) => y * width + x;
function corridor(): Board {
  const floor = new Set([cell(0, 2)]);
  for (const y of [1, 2, 3]) for (let x = 4; x <= 11; x++) floor.add(cell(x, y));
  return {
    width,
    height: 5,
    floor,
    actor: cell(8, 1),
    parts: [cell(6, 2), cell(9, 2)],
    roles: ['load', 'machine'],
    pivotIndex: 1,
    goals: [cell(0, 2), cell(5, 1)],
    motors: [
      { op: 'north', delta: -width },
      { op: 'east', delta: 1 },
      { op: 'south', delta: width },
      { op: 'west', delta: -1 },
    ],
    transport: {
      op: 'exchange',
      land: (from, pivot) => {
        if (from === pivot || Math.floor(from / width) !== Math.floor(pivot / width)) return null;
        const dest = 2 * (pivot % width) - (from % width);
        return dest < 0 || dest >= width ? null : cell(dest, Math.floor(pivot / width));
      },
    },
  };
}
const reserve = cell(10, 3),
  landing = cell(14, 2),
  cap = { maxDepth: 70, maxNodes: 1000 };
test('a second operator changes a horizontal exchanger while the first stays at an intermediate site', () => {
  const b = corridor(),
    plan = relayTransportPlan(
      b,
      reserve,
      0,
      (p) => p === landing,
      (p) => 'select/' + p,
      cap,
    );
  assert.ok(plan);
  const { design, steps } = plan;
  assert.equal(design.landing, landing);
  assert.equal(design.second, cell(7, 2));
  assert.equal(b.transport!.land(design.launch, design.first), landing);
  assert.notEqual(design.first, design.second);
  const handoff = steps.findIndex((s) => s.select);
  const delivery = steps.findIndex((s) => s.peerTo === design.remote);
  assert.ok(handoff > 0 && delivery > handoff);
  assert.equal(steps[handoff]!.op, 'select/' + reserve);
  assert.ok(steps.slice(handoff + 1, delivery).every((s) => s.peerFrom === landing && s.peerTo === landing));
  assert.ok(steps.slice(handoff + 1, delivery).some((s) => s.role === 'machine'));
  assert.equal(steps.at(-1)?.to, design.local);
});
test('a relay needs a permitted receiving site, two obligations and a feasible budget', () => {
  const b = corridor();
  assert.equal(
    relayTransportPlan(b, reserve, 0, () => false, String, cap),
    null,
  );
  assert.equal(
    relayTransportPlan({ ...b, goals: b.goals.slice(0, 1) }, reserve, 0, () => true, String, cap),
    null,
  );
  assert.equal(
    relayTransportPlan(b, reserve, 0, (p) => p === landing, String, { maxDepth: 4, maxNodes: 2 }),
    null,
  );
});
