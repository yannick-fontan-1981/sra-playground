import type { PublicObservationLike } from './linked-preparation.ts';

export interface FieldStockEntity {
  palette_value: number;
  bbox: readonly [number, number, number, number];
  mask: readonly (readonly [number, number])[];
  rectangular?: boolean;
  [key: string]: unknown;
}

export interface RetainedClassTemplate {
  size: readonly [number, number];
  offset: readonly [number, number] | null;
  mask: readonly (readonly [number, number])[];
  alignment_supported?: boolean;
  [key: string]: unknown;
}

export interface RetainedRewriteRule {
  product: number;
  evidence: readonly string[];
  [key: string]: unknown;
}

export interface RetainedAddressedFieldPrior {
  action_ref: string;
  lower_squared: number;
  upper_squared: number | null;
  boundary: string;
  request_row: number;
  goal_region?: {
    size: readonly [number, number];
    envelope: readonly (readonly [number, number])[];
  };
  class_templates?: Record<string, RetainedClassTemplate>;
  observed_rules?: Record<string, RetainedRewriteRule>;
  type_order?: readonly number[];
  qualification: string;
  [key: string]: unknown;
}

export interface FieldStockZone {
  bbox: readonly [number, number, number, number];
  point: readonly [number, number];
  source_ref: string;
}

export interface FieldStockRule extends RetainedRewriteRule {
  confirmations: number;
  prior_evidence: readonly string[];
  evidence: string[];
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

/** Exact finite-mask containment helper used by the donor's FieldStock.create. */
export function filled(
  supportMask: readonly (readonly [number, number])[],
  width: number,
  height: number,
): Set<string> {
  const wall = new Set(supportMask.map(([x, y]) => key(x, y)));
  const exterior = new Set<string>([key(-1, -1)]);
  const queue: Array<readonly [number, number]> = [[-1, -1]];
  const deltas = [[0, 1], [1, 0], [-1, 0], [0, -1]] as const;
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of deltas) {
      const nx = x + dx;
      const ny = y + dy;
      const candidate = key(nx, ny);
      if (-1 <= nx && nx <= width && -1 <= ny && ny <= height && !wall.has(candidate) && !exterior.has(candidate)) {
        exterior.add(candidate);
        queue.push([nx, ny]);
      }
    }
  }
  const result = new Set<string>();
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      if (!exterior.has(key(x, y))) result.add(key(x, y));
    }
  }
  return result;
}

function sameEnvelope(
  mask: readonly (readonly [number, number])[],
  size: readonly [number, number],
  envelope: ReadonlySet<string>,
): boolean {
  const actual = filled(mask, size[0], size[1]);
  if (actual.size !== envelope.size) return false;
  return [...actual].every(item => envelope.has(item));
}

/**
 * Proven retained typed-stock slice from V6 common_field_stock.py.
 *
 * A FieldStock is not copied across an epoch. AddressedField retains a compact
 * prior and calls create() against the new public observation. Returning null is
 * deliberate: retained knowledge exists, but current applicability was not
 * re-established from the new scene.
 */
export class FieldStock {
  prior!: RetainedAddressedFieldPrior;
  epoch!: number;
  order!: number[];
  requests!: FieldStockEntity[];
  demands!: Map<number, number>;
  zones!: FieldStockZone[];
  interfaceBoxes!: Array<readonly [number, number, number, number]>;
  lower!: number;
  upper!: number;
  actionRef!: string;
  templates!: Record<string, RetainedClassTemplate>;
  rules!: Record<number, FieldStockRule>;
  motionTypes!: Set<number>;
  events: Array<Record<string, unknown>> = [];
  invalid: Record<string, unknown> | null = null;
  sceneRef!: string;

  static create(
    prior: RetainedAddressedFieldPrior,
    observation: PublicObservationLike,
    rows: readonly (readonly number[])[],
  ): FieldStock | null {
    if (!prior.goal_region || prior.upper_squared === null) return null;
    const entities = (observation.entities ?? []) as readonly FieldStockEntity[];
    const row = prior.request_row;
    const squares = entities.filter(entity =>
      entity.rectangular
      && entity.bbox[2] - entity.bbox[0] === entity.bbox[3] - entity.bbox[1]);

    const groups = new Map<string, FieldStockEntity[]>();
    for (const entity of squares) {
      const [left, top, right] = entity.bbox;
      if (right <= left) continue;
      const groupKey = `${top}:${right - left + 1}`;
      const group = groups.get(groupKey) ?? [];
      group.push(entity);
      groups.set(groupKey, group);
    }

    const ladders: Array<{ distance: number; entries: FieldStockEntity[] }> = [];
    for (const entries of groups.values()) {
      entries.sort((a, b) => a.bbox[0] - b.bbox[0]);
      const pitches = new Set(entries.slice(1).map((entry, index) => entry.bbox[0] - entries[index]!.bbox[0]));
      const palettes = new Set(entries.map(entity => entity.palette_value));
      if (entries.length >= 2 && palettes.size === entries.length && pitches.size === 1) {
        ladders.push({ distance: Math.abs(entries[0]!.bbox[1] - row), entries });
      }
    }
    if (!ladders.length) return null;
    ladders.sort((a, b) => b.entries.length - a.entries.length || a.distance - b.distance);
    const ladder = ladders[0]!.entries;
    const order = ladder.map(entity => entity.palette_value);
    const ladderBoxes = new Set(ladder.map(entity => JSON.stringify(entity.bbox)));
    const requests = squares.filter(entity =>
      entity.bbox[1] <= row && row <= entity.bbox[3]
      && !ladderBoxes.has(JSON.stringify(entity.bbox))
      && order.includes(entity.palette_value));

    const envelope = new Set(prior.goal_region.envelope.map(([x, y]) => key(x, y)));
    const size = prior.goal_region.size;
    const zones: FieldStockZone[] = [];
    for (const entity of entities) {
      const [left, top, right, bottom] = entity.bbox;
      if (right - left + 1 !== size[0] || bottom - top + 1 !== size[1]) continue;
      if (!sameEnvelope(entity.mask, size, envelope)) continue;
      zones.push({
        bbox: entity.bbox,
        point: [Math.floor((left + right) / 2), Math.floor((top + bottom) / 2)],
        source_ref: observation.observation_ref,
      });
    }
    if (!requests.length || !zones.length) return null;

    const stock = new FieldStock();
    stock.prior = structuredClone(prior);
    stock.epoch = observation.level_epoch;
    stock.order = [...order];
    stock.requests = [...requests];
    stock.demands = new Map<number, number>();
    for (const request of requests) stock.demands.set(request.palette_value, (stock.demands.get(request.palette_value) ?? 0) + 1);
    stock.zones = zones;
    stock.interfaceBoxes = [...ladder, ...requests].map(entity => entity.bbox);
    stock.interfaceBoxes.push(...entities
      .filter(entity => entity.bbox[0] === 0 && entity.bbox[2] === (rows[0]?.length ?? 0) - 1 && entity.bbox[1] === entity.bbox[3])
      .map(entity => entity.bbox));
    stock.lower = prior.lower_squared;
    stock.upper = prior.upper_squared;
    stock.actionRef = prior.action_ref;
    stock.templates = structuredClone(prior.class_templates ?? {});
    stock.rules = {};
    if (prior.type_order && JSON.stringify(prior.type_order) === JSON.stringify(order)) {
      for (const [symbolText, rule] of Object.entries(prior.observed_rules ?? {})) {
        const symbol = Number(symbolText);
        if (!order.includes(symbol) || !order.includes(rule.product)) continue;
        stock.rules[symbol] = {
          ...structuredClone(rule),
          confirmations: 0,
          prior_evidence: [...rule.evidence],
          evidence: [],
        };
      }
    }
    stock.motionTypes = new Set(Object.entries(stock.templates)
      .filter(([, template]) => template.alignment_supported)
      .map(([symbol]) => Number(symbol)));
    stock.sceneRef = observation.observation_ref;
    return stock;
  }

  refute(reason: string, before: string, after: string): void {
    this.invalid = { reason, before, after };
    this.events = [this.invalid];
  }

  retained(boundary: string): RetainedAddressedFieldPrior {
    const observedRules: Record<string, RetainedRewriteRule> = {};
    for (const [symbol, rule] of Object.entries(this.rules)) observedRules[symbol] = structuredClone(rule);
    return {
      ...structuredClone(this.prior),
      class_templates: structuredClone(this.templates),
      observed_rules: observedRules,
      type_order: [...this.order],
      boundary,
      qualification: 'structural field/material hypotheses; next epoch requires fresh bindings and rewrite witnesses',
    };
  }
}
