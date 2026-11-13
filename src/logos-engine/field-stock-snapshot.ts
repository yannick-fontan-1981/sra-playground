import type {
  AddressedFieldRetentionState,
  RetentionModel,
  RetentionSample,
} from './addressed-field-retention.ts';
import {
  FieldStock,
  type FieldStockEntity,
  type FieldStockRule,
  type FieldStockZone,
  type RetainedAddressedFieldPrior,
  type RetainedClassTemplate,
} from './field-stock.ts';

export interface FieldStockSnapshotV1 {
  version: 1;
  prior: RetainedAddressedFieldPrior;
  epoch: number;
  order: number[];
  requests: FieldStockEntity[];
  demands: Array<[number, number]>;
  zones: FieldStockZone[];
  interfaceBoxes: Array<readonly [number, number, number, number]>;
  lower: number;
  upper: number;
  actionRef: string;
  templates: Record<string, RetainedClassTemplate>;
  rules: Record<string, FieldStockRule>;
  lineages: Array<[string, string[]]>;
  motionTypes: number[];
  minimums: Array<[number, number]>;
  failures: string[];
  events: Array<Record<string, unknown>>;
  invalid: Record<string, unknown> | null;
  sceneRef: string;
}

export interface AddressedFieldRetentionSnapshotV1 {
  version: 1;
  epoch: number | null;
  model: RetentionModel | null;
  samples: RetentionSample[];
  indicator: Record<string, unknown> | null;
  lowerSquared: number;
  upperSquared: number | null;
  calibration: AddressedFieldRetentionState['calibration'];
  events: Array<Record<string, unknown>>;
  passed: Array<{ score: number; evidence: string }>;
  prior: RetainedAddressedFieldPrior | null;
  stock: FieldStockSnapshotV1 | null;
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return value;
}

function integer(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new TypeError(`${label} must be an integer`);
  }
  return value;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  return value;
}

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function nullableInteger(value: unknown, label: string): number | null {
  return value === null ? null : integer(value, label);
}

function nullableFinite(value: unknown, label: string): number | null {
  return value === null ? null : finite(value, label);
}

function numericEntries(value: unknown, label: string): Array<[number, number]> {
  const seen = new Set<number>();
  return array(value, label).map((entry, index) => {
    if (!Array.isArray(entry) || entry.length !== 2) {
      throw new TypeError(`${label}[${index}] must be a [number, number] entry`);
    }
    const key = integer(entry[0], `${label}[${index}][0]`);
    const item = finite(entry[1], `${label}[${index}][1]`);
    if (seen.has(key)) throw new Error(`${label} contains duplicate key ${key}`);
    seen.add(key);
    return [key, item];
  });
}

function stringEntries(value: unknown, label: string): Array<[string, string[]]> {
  const seen = new Set<string>();
  return array(value, label).map((entry, index) => {
    if (!Array.isArray(entry) || entry.length !== 2) {
      throw new TypeError(`${label}[${index}] must be a [string, string[]] entry`);
    }
    const key = nonEmpty(entry[0], `${label}[${index}][0]`);
    const values = array(entry[1], `${label}[${index}][1]`).map((item, itemIndex) =>
      nonEmpty(item, `${label}[${index}][1][${itemIndex}]`));
    if (seen.has(key)) throw new Error(`${label} contains duplicate key ${key}`);
    seen.add(key);
    return [key, values];
  });
}

function sortedNumericEntries(map: ReadonlyMap<number, number>): Array<[number, number]> {
  return [...map.entries()].sort((left, right) => left[0] - right[0]);
}

export function snapshotFieldStock(stock: FieldStock): FieldStockSnapshotV1 {
  return {
    version: 1,
    prior: structuredClone(stock.prior),
    epoch: stock.epoch,
    order: [...stock.order],
    requests: structuredClone(stock.requests),
    demands: sortedNumericEntries(stock.demands),
    zones: structuredClone(stock.zones),
    interfaceBoxes: structuredClone(stock.interfaceBoxes),
    lower: stock.lower,
    upper: stock.upper,
    actionRef: stock.actionRef,
    templates: structuredClone(stock.templates),
    rules: structuredClone(Object.fromEntries(
      Object.entries(stock.rules).map(([key, rule]) => [key, rule]),
    )),
    lineages: [...stock.lineages.entries()]
      .map(([key, values]) => [key, [...values]] as [string, string[]])
      .sort((left, right) => left[0].localeCompare(right[0])),
    motionTypes: [...stock.motionTypes].sort((left, right) => left - right),
    minimums: sortedNumericEntries(stock.minimums),
    failures: [...stock.failures].sort(),
    events: structuredClone(stock.events),
    invalid: structuredClone(stock.invalid),
    sceneRef: stock.sceneRef,
  };
}

export function restoreFieldStock(value: unknown): FieldStock {
  const snapshot = object(value, 'FieldStock snapshot');
  if (snapshot.version !== 1) throw new TypeError('unsupported FieldStock snapshot version');

  const prior = object(snapshot.prior, 'FieldStock snapshot prior') as unknown as RetainedAddressedFieldPrior;
  const order = array(snapshot.order, 'FieldStock snapshot order').map((item, index) =>
    integer(item, `FieldStock snapshot order[${index}]`));
  const requests = array(snapshot.requests, 'FieldStock snapshot requests') as unknown as FieldStockEntity[];
  const demands = numericEntries(snapshot.demands, 'FieldStock snapshot demands');
  const zones = array(snapshot.zones, 'FieldStock snapshot zones') as unknown as FieldStockZone[];
  const interfaceBoxes = array(
    snapshot.interfaceBoxes,
    'FieldStock snapshot interfaceBoxes',
  ) as unknown as Array<readonly [number, number, number, number]>;
  const templates = object(snapshot.templates, 'FieldStock snapshot templates') as Record<string, RetainedClassTemplate>;
  const rules = object(snapshot.rules, 'FieldStock snapshot rules') as Record<string, FieldStockRule>;
  const lineages = stringEntries(snapshot.lineages, 'FieldStock snapshot lineages');
  const motionTypes = array(snapshot.motionTypes, 'FieldStock snapshot motionTypes').map((item, index) =>
    integer(item, `FieldStock snapshot motionTypes[${index}]`));
  const minimums = numericEntries(snapshot.minimums, 'FieldStock snapshot minimums');
  const failures = array(snapshot.failures, 'FieldStock snapshot failures').map((item, index) =>
    nonEmpty(item, `FieldStock snapshot failures[${index}]`));
  const events = array(snapshot.events, 'FieldStock snapshot events') as Array<Record<string, unknown>>;
  const invalid = snapshot.invalid === null
    ? null
    : object(snapshot.invalid, 'FieldStock snapshot invalid');

  const stock = new FieldStock();
  stock.prior = structuredClone(prior);
  stock.epoch = integer(snapshot.epoch, 'FieldStock snapshot epoch');
  stock.order = [...order];
  stock.requests = structuredClone(requests);
  stock.demands = new Map(demands);
  stock.zones = structuredClone(zones);
  stock.interfaceBoxes = structuredClone(interfaceBoxes);
  stock.lower = finite(snapshot.lower, 'FieldStock snapshot lower');
  stock.upper = finite(snapshot.upper, 'FieldStock snapshot upper');
  stock.actionRef = nonEmpty(snapshot.actionRef, 'FieldStock snapshot actionRef');
  stock.templates = structuredClone(templates);
  stock.rules = Object.fromEntries(
    Object.entries(rules).map(([key, rule]) => [Number(key), structuredClone(rule)]),
  );
  stock.lineages = new Map(lineages.map(([key, values]) => [key, [...values]]));
  stock.motionTypes = new Set(motionTypes);
  stock.minimums = new Map(minimums);
  stock.failures = new Set(failures);
  stock.events = structuredClone(events);
  stock.invalid = structuredClone(invalid);
  stock.sceneRef = nonEmpty(snapshot.sceneRef, 'FieldStock snapshot sceneRef');
  return stock;
}

export function snapshotAddressedFieldRetention(
  state: AddressedFieldRetentionState,
): AddressedFieldRetentionSnapshotV1 {
  return {
    version: 1,
    epoch: state.epoch,
    model: structuredClone(state.model),
    samples: structuredClone(state.samples),
    indicator: structuredClone(state.indicator),
    lowerSquared: state.lowerSquared,
    upperSquared: state.upperSquared,
    calibration: state.calibration,
    events: structuredClone(state.events),
    passed: structuredClone(state.passed),
    prior: structuredClone(state.prior),
    stock: state.stock ? snapshotFieldStock(state.stock) : null,
  };
}

export function restoreAddressedFieldRetention(
  target: AddressedFieldRetentionState,
  value: unknown,
): void {
  const snapshot = object(value, 'addressed FieldStock retention snapshot');
  if (snapshot.version !== 1) {
    throw new TypeError('unsupported addressed FieldStock retention snapshot version');
  }

  const calibration = snapshot.calibration;
  if (![
    'different_offset',
    'outside_indicator',
    'indicator_edge',
    'navigation',
  ].includes(String(calibration))) {
    throw new TypeError('invalid addressed FieldStock calibration state');
  }

  const restored = {
    epoch: nullableInteger(snapshot.epoch, 'addressed FieldStock epoch'),
    model: snapshot.model === null
      ? null
      : object(snapshot.model, 'addressed FieldStock model') as unknown as RetentionModel,
    samples: array(snapshot.samples, 'addressed FieldStock samples') as unknown as RetentionSample[],
    indicator: snapshot.indicator === null
      ? null
      : object(snapshot.indicator, 'addressed FieldStock indicator'),
    lowerSquared: finite(snapshot.lowerSquared, 'addressed FieldStock lowerSquared'),
    upperSquared: nullableFinite(snapshot.upperSquared, 'addressed FieldStock upperSquared'),
    calibration: calibration as AddressedFieldRetentionState['calibration'],
    events: array(snapshot.events, 'addressed FieldStock events') as Array<Record<string, unknown>>,
    passed: array(snapshot.passed, 'addressed FieldStock passed') as Array<{ score: number; evidence: string }>,
    prior: snapshot.prior === null
      ? null
      : object(snapshot.prior, 'addressed FieldStock prior') as unknown as RetainedAddressedFieldPrior,
    stock: snapshot.stock === null ? null : restoreFieldStock(snapshot.stock),
  };

  target.epoch = restored.epoch;
  target.model = structuredClone(restored.model);
  target.samples = structuredClone(restored.samples);
  target.indicator = structuredClone(restored.indicator);
  target.lowerSquared = restored.lowerSquared;
  target.upperSquared = restored.upperSquared;
  target.calibration = restored.calibration;
  target.events = structuredClone(restored.events);
  target.passed = structuredClone(restored.passed);
  target.prior = structuredClone(restored.prior);
  target.stock = restored.stock;
}
