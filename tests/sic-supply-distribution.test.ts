import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseSupplyCommand, supplyOutcome, type SupplyLayout } from '../src/sic/supply-distribution.ts';

test('a flat storage reading permits another charge only with the loss outlet isolated', () => {
  const gate = { bbox: [3, 8, 9, 10] as const, point: [6, 9] as const, orientation: 'horizontal' };
  const pump = { bbox: [12, 6, 16, 10] as const, point: [14, 8] as const };
  const layout: SupplyLayout = { buffered: true, relay: { box: [18, 12, 22, 15], empty: 0 },
    stock: { box: [3, 2, 15, 3], palette: 2 }, pump, receivers: [], openOrientation: 'vertical',
    lossOutlets: [{ box: [3, 13, 9, 17], gate }] };
  const render = (open: boolean, consumed: boolean) => {
    const rows = Array.from({ length: 24 }, () => Array<number>(26).fill(0));
    for (const y of [2, 3]) rows[y]!.fill(2, 3, consumed ? 14 : 16);
    const halves = [[-3, -1], [-3, 0], [-3, 1], [-2, -1], [-1, -1],
      [3, -1], [3, 0], [3, 1], [2, -1], [1, -1]] as const;
    for (const [x, y] of halves) rows[9 + (open ? x : y)]![6 + (open ? y : x)] = 7;
    return rows;
  };
  assert.equal(chooseSupplyCommand(render(true, false), layout)?.kind, 'close_loss');
  const charge = { kind: 'charge_storage', target: pump } as const;
  assert.equal(supplyOutcome(charge, layout, render(false, false), render(false, true)), 'stock_decreased_without_resolved_storage_rise');
  assert.equal(supplyOutcome(charge, layout, render(false, false), render(true, true)), null);
});
