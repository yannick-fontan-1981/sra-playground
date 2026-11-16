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
  continued?: boolean;
  releaseObserved?: boolean;
};
type Receiver = Basin & { gate: Gate };
type Store = Receiver & { palette: number };
type Pump = { bbox: NativeBox; point: NativePoint };
type Outlets = { receivers: Receiver[]; openOrientation: string };
type SupplyFields = {
  relay: Basin;
  stock: Stock;
  pump: Pump;
};
type PumpedSupply = Outlets & SupplyFields & ({ buffered?: false; relay: Receiver } | { buffered: true }) & { stored?: false };
type StoredSupply = Outlets & { stored: true; stores: Store[] };
export type SupplyLayout = PumpedSupply | StoredSupply;
export type SupplyChoice = {
  kind: 'open_relay' | 'open_receiver' | 'protect_receiver' | 'deliver' | 'charge_storage' | 'test_release';
  target: Pump;
} | { kind: 'release_store'; target: Gate; store: Store };
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

function enclosedStorage(rows: NativeRows, empty: number, receiverWidth: number): Basin[] {
  return geometricComponents(rows).flatMap(part => {
    const [l, t, r, b] = part.bbox;
    const [w, h] = dimensions(part.bbox);
    if (part.color !== empty || part.rectangular || w !== receiverWidth + 2 || h < 4 || h > receiverWidth + 2) return [];
    const uniform = (y: number) => rows[y]!.slice(l + 1, r).every(value => value === empty);
    const insideWalls = (y: number) => uniform(y) && (rows[y]![l] !== empty || rows[y]![r] !== empty);
    const top = insideWalls(t) ? t : t + 1, bottom = insideWalls(b) ? b : b - 1;
    if (bottom - top < 2) return [];
    let leftWall = 0, rightWall = 0;
    for (let y = top; y <= bottom; y++) {
      if (!uniform(y)) return [];
      leftWall += Number(rows[y]![l] !== empty);
      rightWall += Number(rows[y]![r] !== empty);
    }
    if (Math.min(leftWall, rightWall) * 2 <= bottom - top + 1) return [];
    return [{ box: [l + 1, top, r - 1, bottom], empty }];
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

function linkedRelease(frame: NativeBox, inner: NativeBox, parts: ReturnType<typeof geometricComponents>, gates: Gate[]): Gate | null {
  const [left, , right] = frame, [, top, , bottom] = inner;
  const options = new Set<Gate>();
  for (const pipe of parts) {
    const [l, t, r, b] = pipe.bbox, side = l === right + 1 ? l : r === left - 1 ? r : null;
    if (side === null || l === r || t >= b || !pipe.mask.some(([x, y]) => l + x === side && t + y >= top && t + y <= bottom)) continue;
    const end = l === side ? r : l;
    for (const gate of gates) {
      if (gate.point[0] !== end) continue;
      const gap = gate.bbox[3] < t ? t - gate.bbox[3] : gate.bbox[1] > b ? gate.bbox[1] - b : 0;
      if (gap < 1 || gap > 2) continue;
      const near = gate.bbox[3] < t ? t : b;
      if (pipe.mask.some(([x, y]) => x + l === end && y + t === near)) options.add(gate);
    }
  }
  return options.size === 1 ? [...options][0]! : null;
}

function bindStored(rows: NativeRows, outlets: Outlets, controls: Gate[], model: SupplyModel): StoredSupply | null {
  if (!model.releaseObserved || !outlets.receivers.every(receiver => receiver.empty === outlets.receivers[0]!.empty)) return null;
  const empty = outlets.receivers[0]!.empty, parts = geometricComponents(rows);
  const gateSignature = (gate: Gate) => [...dimensions(gate.bbox)].sort((a, b) => a - b).join(',');
  const sizes = new Set(outlets.receivers.map(receiver => gateSignature(receiver.gate)));
  const gates = controls.filter(gate => sizes.has(gateSignature(gate))
    && !outlets.receivers.some(receiver => sameBox(receiver.gate.bbox, gate.bbox)));
  const stores = parts.flatMap(part => {
    const [l, t, r, b] = part.bbox, [width, height] = dimensions(part.bbox);
    if (width !== model.receiver[0] + 2 || height < 5 || height > width + 4 || part.rectangular) return [];
    const bands = [];
    for (let y = t; y <= b; y++) {
      const row = rows[y]!;
      if (row[l] !== part.color || row[r] !== part.color) break;
      const inside = row.slice(l + 1, r), value = inside[0]!;
      if (!inside.every(color => color === value) || value === part.color) break;
      bands.push(value);
    }
    const base = t + bands.length;
    if (bands.length < 3 || base > b || !rows[base]!.slice(l, r + 1).every(color => color === part.color)) return [];
    const pigments = [...new Set(bands.filter(color => color !== empty))];
    if (pigments.length !== 1) return [];
    const box: NativeBox = [l + 1, t, r - 1, base - 1], gate = linkedRelease(part.bbox, box, parts, gates);
    return gate ? [{ box, empty, gate, palette: pigments[0]! }] : [];
  });
  if (!stores.length || stores.length > 4 || new Set(stores.map(store => store.gate.point.join(','))).size !== stores.length) return null;
  return { ...outlets, stored: true, stores };
}

export function bindSupply(rows: NativeRows, pump: Pump | null, model: SupplyModel): SupplyLayout | null {
  const basins = basinCandidates(rows);
  const relay = basins.filter(basin => sameExtent(dimensions(basin.box), model.relay));
  const receivers = basins.filter(basin => sameExtent(dimensions(basin.box), model.receiver));
  const stocks = stockCandidates(rows);
  if (receivers.length < 2 || receivers.length > 4) return null;
  const controls = pairedControls(rows) as Gate[];
  const withGate = (basin: Basin) => {
    const gate = linkedControl({ bbox: basin.box }, controls) as Gate | null;
    return gate ? { ...basin, gate } : null;
  };
  const targets = receivers.map(withGate);
  if (targets.some(target => !target)) return null;
  const destinations = targets.filter(target => target !== null);
  if (new Set(destinations.map(basin => basin.gate.point.join(','))).size !== destinations.length) return null;
  const outlets = { receivers: destinations, openOrientation: model.openOrientation };
  if (!pump || !sameExtent(dimensions(pump.bbox), model.pump)) return bindStored(rows, outlets, controls, model);
  const common = { ...outlets, pump };
  if (!relay.length && model.continued && stocks.length === 1 && receivers.every(basin => basin.empty === receivers[0]!.empty)) {
    const stores = enclosedStorage(rows, receivers[0]!.empty, model.receiver[0]);
    if (stores.length === 1 && destinations.some(basin => basin.gate.orientation === model.openOrientation)) {
      return { ...common, buffered: true, relay: stores[0]!, stock: stocks[0]! };
    }
  }
  const matchingStocks = stocks.filter(stock => sameExtent(dimensions(stock.box), model.stock));
  if (relay.length !== 1 || matchingStocks.length !== 1) return bindStored(rows, outlets, controls, model);
  const main = withGate(relay[0]!);
  if (!main) return null;
  // Revalidate that peers on the input band are already isolated.
  const at = main.gate.point, [l, , r] = main.box;
  const depth = at[0] >= l && at[0] <= r ? 1 : 0;
  const competing = controls.filter(control => control.point[depth] === at[depth]
    && control.point[1 - depth] !== at[1 - depth] && sameExtent(dimensions(control.bbox), dimensions(main.gate.bbox)));
  if (!competing.length || competing.some(gate => gate.orientation === model.openOrientation)) return null;
  if (destinations.some(basin => basin.gate.point.every((value, axis) => value === at[axis]))) return null;
  return { ...common, relay: main, stock: matchingStocks[0]! };
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
  const outlets = layout.receivers.map(basin => ({ basin, open: open(rows, basin.gate, layout), full: full(rows, basin) }));
  if (outlets.some(outlet => outlet.open === null)) return null;
  if (!layout.stored && !layout.buffered) {
    const input = open(rows, layout.relay.gate, layout);
    if (input === null) return null;
    if (!input) return { kind: 'open_relay', target: layout.relay.gate };
  }
  const saturated = outlets.find(outlet => outlet.open && outlet.full);
  if (saturated) return { kind: 'protect_receiver', target: saturated.basin.gate };
  const closed = outlets.find(outlet => !outlet.open && !outlet.full);
  if (closed) return { kind: 'open_receiver', target: closed.basin.gate };
  if (!outlets.some(outlet => outlet.open && !outlet.full)) return null;
  if (layout.stored) {
    const store = layout.stores.find(basin => count(rows, basin.box, basin.palette) > 0 && open(rows, basin.gate, layout) === false);
    return store ? { kind: 'release_store', store, target: store.gate } : null;
  }
  if (count(rows, layout.stock.box, layout.stock.palette) < 1) return null;
  const kind = !layout.buffered ? 'deliver' : count(rows, layout.relay.box, layout.relay.empty) <= dimensions(layout.relay.box)[0]
    ? 'test_release' : 'charge_storage';
  return { kind, target: layout.pump };
}

export function supplyOutcome(choice: SupplyChoice, layout: SupplyLayout, before: NativeRows, after: NativeRows): string | null {
  if (layout.stored) {
    if (choice.kind === 'open_receiver' || choice.kind === 'protect_receiver') {
      return open(after, choice.target as Gate, layout) === (choice.kind === 'open_receiver')
        && ![...layout.stores, ...layout.receivers].some(basin => changed(before, after, basin.box))
        ? 'gate_changed_preserving_visible_stock_and_contents' : null;
    }
    if (choice.kind !== 'release_store' || open(after, choice.target, layout) !== true) return null;
    const { store } = choice;
    if (count(after, store.box, store.palette) >= count(before, store.box, store.palette)
      || layout.stores.some(item => !sameBox(item.box, store.box) && changed(before, after, item.box))) return null;
    const gain = layout.receivers.map(receiver => {
      const fetched = count(before, receiver.box, receiver.empty) - count(after, receiver.box, receiver.empty);
      const enabled = open(before, receiver.gate, layout) === true;
      return { fetched, allowed: enabled ? fetched >= 0 : !changed(before, after, receiver.box) };
    });
    return gain.some(({ fetched }) => fetched > 0) && gain.every(({ allowed }) => allowed)
      ? 'stored_supply_released_by_its_gate' : null;
  }
  if (choice.kind === 'release_store') return null;
  const basins = [layout.relay, ...layout.receivers], { stock } = layout;
  if (choice.kind === 'open_relay' || choice.kind === 'open_receiver' || choice.kind === 'protect_receiver') {
    const target = choice.target as Gate;
    return open(after, target, layout) === (choice.kind !== 'protect_receiver')
      && !basins.some(basin => changed(before, after, basin.box)) && !changed(before, after, stock.box)
      ? 'gate_changed_preserving_visible_stock_and_contents' : null;
  }
  if (count(after, stock.box, stock.palette) >= count(before, stock.box, stock.palette)) return null;
  const protectedReceivers = layout.receivers.filter(basin => full(before, basin) && open(before, basin.gate, layout) === false);
  if (protectedReceivers.some(basin => changed(before, after, basin.box))) return null;
  if (layout.buffered) {
    const previousRoom = count(before, layout.relay.box, layout.relay.empty);
    const room = count(after, layout.relay.box, layout.relay.empty);
    const changedReceivers = layout.receivers.some(basin => changed(before, after, basin.box));
    if (room < previousRoom && !changedReceivers) return 'storage_charge_observed_without_outlet_transfer';
    return room > previousRoom && changedReceivers ? 'stored_supply_released_to_receivers' : null;
  }
  if (layout.receivers.some(basin => !full(before, basin) && full(after, basin))) return 'receiver_saturation_observed';
  return basins.some(basin => changed(before, after, basin.box)) ? 'observed_stock_delivered_to_a_basin' : null;
}

export function observeSupplyRelease(layout: SupplyLayout, before: NativeRows, frames: readonly NativeRows[], choice?: SupplyChoice): number {
  if (layout.stored) {
    if (choice?.kind !== 'release_store') return 0;
    return Math.max(0, ...frames.filter(frame => supplyOutcome(choice, layout, before, frame) === 'stored_supply_released_by_its_gate')
      .map(frame => layout.receivers.filter(receiver =>
        count(frame, receiver.box, receiver.empty) < count(before, receiver.box, receiver.empty)).length));
  }
  if (!layout.buffered) return 0;
  let room = count(before, layout.relay.box, layout.relay.empty), receivers = 0;
  let atCapacity = room === 0;
  const [width, height] = dimensions(layout.relay.box), capacity = width * height;
  for (const frame of frames) {
    const after = count(frame, layout.relay.box, layout.relay.empty);
    atCapacity ||= after === 0;
    if (atCapacity && after > room) {
      const filled = layout.receivers.filter(basin => count(frame, basin.box, basin.empty) < count(before, basin.box, basin.empty)).length;
      receivers = Math.max(receivers, filled);
      if (after === capacity) break;
    }
    room = after;
  }
  return receivers;
}
