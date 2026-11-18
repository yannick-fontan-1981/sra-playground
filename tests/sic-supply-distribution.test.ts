import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseSupplyCommand, supplyOutcome, type SupplyLayout } from '../src/sic/supply-distribution.ts';

function paintGate(rows: number[][], point: readonly [number, number], isOpen: boolean) {
  const halves = [[-3, -1], [-3, 0], [-3, 1], [-2, -1], [-1, -1],
    [3, -1], [3, 0], [3, 1], [2, -1], [1, -1]] as const;
  for (const [x, y] of halves) rows[point[1] + (isOpen ? x : y)]![point[0] + (isOpen ? y : x)] = 7;
}

test('a flat storage reading permits another charge only with the loss outlet isolated', () => {
  const gate = { bbox: [3, 8, 9, 10] as const, point: [6, 9] as const, orientation: 'horizontal' };
  const pump = { bbox: [12, 6, 16, 10] as const, point: [14, 8] as const };
  const layout: SupplyLayout = { buffered: true, relay: { box: [18, 12, 22, 15], empty: 0 },
    stock: { box: [3, 2, 15, 3], palette: 2 }, pump, receivers: [], openOrientation: 'vertical',
    lossOutlets: [{ box: [3, 13, 9, 17], gate }] };
  const render = (open: boolean, consumed: boolean) => {
    const rows = Array.from({ length: 24 }, () => Array<number>(26).fill(0));
    for (const y of [2, 3]) rows[y]!.fill(2, 3, consumed ? 14 : 16);
    paintGate(rows, gate.point, open);
    return rows;
  };
  assert.equal(chooseSupplyCommand(render(true, false), layout)?.kind, 'close_loss');
  const charge = { kind: 'charge_storage', target: pump } as const;
  assert.equal(supplyOutcome(charge, layout, render(false, false), render(false, true)), 'stock_decreased_without_resolved_storage_rise');
  assert.equal(supplyOutcome(charge, layout, render(false, false), render(true, true)), null);
});

test('priming a buffered inlet requires its gate open and the other branch isolated', () => {
  const gate = { bbox: [17, 13, 23, 15] as const, point: [20, 14] as const, orientation: 'horizontal' };
  const peer = { bbox: [3, 13, 9, 15] as const, point: [6, 14] as const, orientation: 'horizontal' };
  const outlet = { bbox: [7, 6, 13, 8] as const, point: [10, 7] as const, orientation: 'vertical' };
  const pump = { bbox: [10, 21, 14, 25] as const, point: [12, 23] as const };
  const layout: SupplyLayout = { buffered: true, relay: { box: [14, 4, 18, 9], empty: 0 },
    stock: { box: [4, 27, 15, 28], palette: 2 }, pump, openOrientation: 'vertical',
    inlet: { box: [19, 6, 22, 10], gate, peers: [peer] },
    receivers: [{ box: [8, 0, 12, 3], empty: 0, gate: outlet }] };
  const render = (opened: boolean, peerOpened: boolean, charged: boolean) => {
    const rows = Array.from({ length: 31 }, () => Array<number>(30).fill(0));
    for (const y of [27, 28]) rows[y]!.fill(2, 4, charged ? 14 : 16);
    paintGate(rows, gate.point, opened);
    paintGate(rows, peer.point, peerOpened);
    paintGate(rows, outlet.point, true);
    if (charged) rows[9]![21] = 4;
    return rows;
  };
  assert.equal(chooseSupplyCommand(render(false, false, false), layout)?.kind, 'open_relay');
  assert.equal(chooseSupplyCommand(render(true, false, false), layout)?.kind, 'charge_storage');
  assert.equal(chooseSupplyCommand(render(true, true, false), layout), null);
  const charge = { kind: 'charge_storage', target: pump } as const;
  assert.equal(supplyOutcome(charge, layout, render(true, false, false), render(true, false, true)), 'upstream_relay_primed_before_storage');
  assert.equal(supplyOutcome(charge, layout, render(true, false, false), render(true, true, true)), null);
});
