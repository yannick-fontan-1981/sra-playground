import { currentControl, linkedControl, pairedControls } from '../logos-engine/v6-field-service-observation.ts';
import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Basin = { box: NativeBox; empty: number };
type Extent = readonly [number, number];
type Gate = { bbox: NativeBox; point: NativePoint; orientation: string };
type Stock = { box: NativeBox; palette: number };
export type SupplyCalibration = {
  basins: Basin[];
  stock: Stock;
  relay: NativeBox;
  receivers: NativeBox[];
  openOrientation: string;
  refs: string[];
};
export type SupplyModel = {
  relay: Extent;
  receiver: Extent;
  stock: Extent;
  pump: Extent;
  openOrientation: string;
  completed: number;
  refs: string[];
};
export type SupplyLayout = {
  relay: Basin & { gate: Gate };
  receivers: (Basin & { gate: Gate })[];
  stock: Stock;
  pump: { bbox: NativeBox; point: NativePoint };
  openOrientation: string;
};
export type SupplyChoice = {
  kind: 'open_relay' | 'open_receiver' | 'protect_receiver' | 'deliver';
  target: { bbox: NativeBox; point: NativePoint };
};
const dimensions = ([l, t, r, b]: NativeBox): Extent => [r - l + 1, b - t + 1];
const sameExtent = (a: Extent, b: Extent) => a[0] === b[0] && a[1] === b[1];
const sameBox = (a: NativeBox, b: NativeBox) => a.every((value, i) => value === b[i]);
const values = (rows: NativeRows, [l, t, r, b]: NativeBox) => rows.slice(t, b + 1).flatMap(row => row.slice(l, r + 1));
const changed = (a: NativeRows, b: NativeRows, [l, t, r, bottom]: NativeBox) => {
  for (let y = t; y <= bottom; y++) for (let x = l; x <= r; x++) if (a[y]?.[x] !== b[y]?.[x]) return true;
  return false;
};
const count = (rows: NativeRows, box: NativeBox, palette: number) => values(rows, box).filter(value => value === palette).length;

function basinCandidates(rows: NativeRows): Basin[] {
  return geometricComponents(rows).flatMap(part => {
    const [w, h] = dimensions(part.bbox), [l, t, r, b] = part.bbox;
    return part.rectangular && w >= 4 && h >= 4 && Math.max(w, h) <= Math.min(rows.length, rows[0]!.length) / 4
      && l > 0 && t > 0 && r < rows[0]!.length - 1 && b < rows.length - 1 ? [{ box: part.bbox, empty: part.color }] : [];
  });
}

function stockCandidates(rows: NativeRows): Stock[] {
  return geometricComponents(rows).flatMap(part => {
    const [w, h] = dimensions(part.bbox);
    return part.rectangular && w >= 6 * h && w >= rows[0]!.length / 4 && h <= rows.length / 16
      ? [{ box: part.bbox, palette: part.color }] : [];
  });
}

export function acquireSupplyCalibration(
  previous: SupplyCalibration | null, before: NativeRows, after: NativeRows, openOrientation: string, refs: readonly string[],
): SupplyCalibration | null {
  if (previous) {
    if (count(after, previous.stock.box, previous.stock.palette) >= count(before, previous.stock.box, previous.stock.palette)) return null;
    const newReceivers = previous.basins.filter(basin => !sameBox(basin.box, previous.relay) && changed(before, after, basin.box));
    if (newReceivers.length && changed(before, after, previous.relay)) return null;
    return { ...previous, receivers: [...previous.receivers, ...newReceivers.map(basin => basin.box)
      .filter(box => !previous.receivers.some(other => sameBox(box, other)))], refs: [...previous.refs.slice(-3), ...refs] };
  }
  const basins = basinCandidates(before);
  const relay = basins.filter(basin => changed(before, after, basin.box));
  const stocks = stockCandidates(before).filter(stock => count(after, stock.box, stock.palette) < count(before, stock.box, stock.palette));
  return basins.length >= 2 && relay.length === 1 && stocks.length === 1
    ? { basins, stock: stocks[0]!, relay: relay[0]!.box, receivers: [], openOrientation, refs: [...refs] } : null;
}

export function consolidateSupply(calibration: SupplyCalibration | null, pump: NativeBox, completed: number, ref: string): SupplyModel | null {
  if (!calibration?.receivers.length) return null;
  const receiver = dimensions(calibration.receivers[0]!);
  if (!calibration.receivers.every(box => sameExtent(dimensions(box), receiver))) return null;
  const relay = dimensions(calibration.relay);
  if (sameExtent(relay, receiver)) return null;
  return { receiver, relay, pump: dimensions(pump), stock: dimensions(calibration.stock.box), completed,
    openOrientation: calibration.openOrientation, refs: [...calibration.refs, ref] };
}

export function bindSupply(rows: NativeRows, pump: SupplyLayout['pump'], model: SupplyModel): SupplyLayout | null {
  if (!sameExtent(dimensions(pump.bbox), model.pump)) return null;
  const basins = basinCandidates(rows);
  const relay = basins.filter(basin => sameExtent(dimensions(basin.box), model.relay));
  const receivers = basins.filter(basin => sameExtent(dimensions(basin.box), model.receiver));
  const stocks = stockCandidates(rows).filter(stock => sameExtent(dimensions(stock.box), model.stock));
  if (relay.length !== 1 || receivers.length < 2 || receivers.length > 4 || stocks.length !== 1) return null;
  const controls = pairedControls(rows);
  const withGate = (basin: Basin) => {
    const gate = linkedControl({ bbox: basin.box }, controls) as Gate | null;
    return gate ? { ...basin, gate } : null;
  };
  const main = withGate(relay[0]!);
  const targets = receivers.map(withGate);
  if (!main || targets.some(target => !target)) return null;
  // Revalidate that peers on the input band are already isolated.
  const at = main.gate.point, [l, , r] = main.box;
  const depth = at[0] >= l && at[0] <= r ? 1 : 0;
  const competing = controls.filter(control => control.point[depth] === at[depth]
    && control.point[1 - depth] !== at[1 - depth] && sameExtent(dimensions(control.bbox), dimensions(main.gate.bbox)));
  if (!competing.length || competing.some(gate => gate.orientation === model.openOrientation)) return null;
  const destinations = targets.filter(target => target !== null);
  if (new Set([main, ...destinations].map(basin => basin.gate.point.join(','))).size !== 1 + destinations.length) return null;
  return { relay: main, receivers: destinations, stock: stocks[0]!, pump, openOrientation: model.openOrientation };
}

const open = (rows: NativeRows, gate: Gate, layout: SupplyLayout): boolean | null => {
  const control = currentControl(rows, gate);
  return control ? control.orientation === layout.openOrientation : null;
};
const full = (rows: NativeRows, basin: Basin): boolean => {
  const paint = values(rows, basin.box);
  return paint[0] !== basin.empty && paint.every(value => value === paint[0]);
};

export function chooseSupplyCommand(rows: NativeRows, layout: SupplyLayout): SupplyChoice | null {
  const input = open(rows, layout.relay.gate, layout);
  const outlets = layout.receivers.map(basin => ({ basin, open: open(rows, basin.gate, layout), full: full(rows, basin) }));
  if (input === null || outlets.some(outlet => outlet.open === null)) return null;
  if (!input) return { kind: 'open_relay', target: layout.relay.gate };
  const saturated = outlets.find(outlet => outlet.open && outlet.full);
  if (saturated) return { kind: 'protect_receiver', target: saturated.basin.gate };
  const closed = outlets.find(outlet => !outlet.open && !outlet.full);
  if (closed) return { kind: 'open_receiver', target: closed.basin.gate };
  if (!outlets.some(outlet => outlet.open && !outlet.full) || count(rows, layout.stock.box, layout.stock.palette) < 1) return null;
  return { kind: 'deliver', target: layout.pump };
}

export function supplyOutcome(choice: SupplyChoice, layout: SupplyLayout, before: NativeRows, after: NativeRows): string | null {
  const basins = [layout.relay, ...layout.receivers], { stock } = layout;
  if (choice.kind !== 'deliver') {
    const target = choice.target as Gate;
    return open(after, target, layout) === (choice.kind !== 'protect_receiver')
      && !basins.some(basin => changed(before, after, basin.box)) && !changed(before, after, stock.box)
      ? 'gate_changed_preserving_visible_stock_and_contents' : null;
  }
  if (count(after, stock.box, stock.palette) >= count(before, stock.box, stock.palette)) return null;
  const protectedReceivers = layout.receivers.filter(basin => full(before, basin) && open(before, basin.gate, layout) === false);
  if (protectedReceivers.some(basin => changed(before, after, basin.box))) return null;
  if (layout.receivers.some(basin => !full(before, basin) && full(after, basin))) return 'receiver_saturation_observed';
  return basins.some(basin => changed(before, after, basin.box)) ? 'observed_stock_delivered_to_a_basin' : null;
}
