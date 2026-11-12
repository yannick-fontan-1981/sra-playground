import type { PublicFrameLike, PublicObservationLike } from './linked-preparation.ts';

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
  consumed_count?: number;
  produced_count?: number;
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

export interface FieldStockBody {
  palette: number;
  bbox: readonly [number, number, number, number];
  mask: readonly (readonly [number, number])[];
  offset: readonly [number, number] | null;
  origins: readonly string[];
}

export interface FieldStockOffer {
  kind: 'move' | 'fuse';
  selected: readonly number[];
  point: readonly [number, number];
  product: number;
  known?: boolean;
  purpose?: string;
}

export interface FieldStockStep {
  before_bodies: readonly FieldStockBody[];
  offer: FieldStockOffer;
  expected_after?: readonly FieldStockBody[] | null;
}

export interface FieldStockProposal {
  field_plan?: { stock?: boolean };
  steps: readonly FieldStockStep[];
  binding: { observation_ref: string; level_epoch: number; levels_completed: number };
}

export interface FieldStockRecordResult {
  status:
    | 'material_transition_unaddressed'
    | 'field_preservation_prediction_refuted'
    | 'material_anchor_unresolved'
    | 'material_rewrite_refuted'
    | 'material_observation_recorded';
  events: readonly Record<string, unknown>[];
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function feature(body: FieldStockBody): string {
  return `${body.palette}:${body.bbox.join(',')}`;
}

function contains(
  outer: readonly [number, number, number, number],
  inner: readonly [number, number, number, number],
): boolean {
  return outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3];
}

function sameFeatureSet(left: readonly FieldStockBody[], right: readonly FieldStockBody[]): boolean {
  return JSON.stringify(left.map(feature).sort()) === JSON.stringify(right.map(feature).sort());
}

function childPresent(body: FieldStockBody, rows: readonly (readonly number[])[]): boolean {
  const [x, y] = body.bbox;
  return body.mask.every(([dx, dy]) =>
    0 <= y + dy && y + dy < rows.length
    && 0 <= x + dx && x + dx < (rows[0]?.length ?? 0)
    && rows[y + dy]?.[x + dx] === body.palette);
}

interface Component {
  color: number;
  bbox: readonly [number, number, number, number];
  mask: readonly (readonly [number, number])[];
  rectangular: boolean;
}

/** Exact bounded 4-connected monochrome component measurement used by the donor. */
export function components(rows: readonly (readonly number[])[]): Component[] {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  if (height * width > 65536) throw new Error('Frame exceeds admitted measurement domain');
  const seen = new Set<string>();
  const found: Component[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (seen.has(key(x, y))) continue;
      const color = rows[y]?.[x];
      if (color === undefined) continue;
      const todo: Array<readonly [number, number]> = [[x, y]];
      const points: Array<readonly [number, number]> = [];
      seen.add(key(x, y));
      while (todo.length) {
        const [px, py] = todo.pop()!;
        points.push([px, py]);
        for (const [nx, ny] of [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]] as const) {
          const marker = key(nx, ny);
          if (0 <= nx && nx < width && 0 <= ny && ny < height && !seen.has(marker) && rows[ny]?.[nx] === color) {
            seen.add(marker);
            todo.push([nx, ny]);
          }
        }
      }
      const xs = points.map(([px]) => px);
      const ys = points.map(([, py]) => py);
      const left = Math.min(...xs);
      const top = Math.min(...ys);
      const right = Math.max(...xs);
      const bottom = Math.max(...ys);
      const mask = points
        .map(([px, py]) => [px - left, py - top] as const)
        .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
      found.push({
        color,
        bbox: [left, top, right, bottom],
        mask,
        rectangular: points.length === (right - left + 1) * (bottom - top + 1),
      });
    }
  }
  return found;
}

function samePair(
  a: readonly number[] | null | undefined,
  b: readonly number[] | null | undefined,
): boolean {
  return Boolean(a && b && a.length === b.length && a.every((value, index) => value === b[index]));
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
  lineages = new Map<string, string[]>();
  motionTypes!: Set<number>;
  minimums = new Map<number, number>();
  failures = new Set<string>();
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


  bodies(rows: readonly (readonly number[])[]): FieldStockBody[] {
    const result: FieldStockBody[] = [];
    for (const entity of components(rows)) {
      const [left, top, right, bottom] = entity.bbox;
      if (!this.order.includes(entity.color) || !entity.rectangular || right - left !== bottom - top) continue;
      if (this.interfaceBoxes.some(box => contains(box, entity.bbox))) continue;
      const side = right - left + 1;
      const template = this.templates[String(entity.color)];
      const offset = template && samePair(template.size, [side, side])
        ? template.offset
        : side === 1 ? [0, 0] as const : null;
      const bodyKey = `${entity.color}:${entity.bbox.join(',')}`;
      result.push({
        palette: entity.color,
        bbox: entity.bbox,
        mask: entity.mask,
        offset,
        origins: this.lineages.get(bodyKey) ?? [],
      });
    }
    return result.sort((a, b) => a.palette - b.palette || a.bbox.join(',').localeCompare(b.bbox.join(',')));
  }

  before(
    proposal: FieldStockProposal,
    index: number,
    publicFrame: PublicFrameLike,
    observation: PublicObservationLike,
  ): { admitted: boolean; reason: string } {
    const expected = proposal.steps[index]?.before_bodies ?? [];
    const actual = this.bodies(publicFrame.frame_rows);
    let ok = publicFrame.level === proposal.binding.level_epoch
      && publicFrame.levels_completed === proposal.binding.levels_completed
      && (index > 0 || observation.observation_ref === proposal.binding.observation_ref)
      && sameFeatureSet(actual, expected);
    for (const body of expected) ok = ok && childPresent(body, publicFrame.frame_rows);
    return { admitted: Boolean(ok), reason: ok ? 'typed_stock_and_address_bound' : 'typed_stock_changed' };
  }

  after(
    proposal: FieldStockProposal,
    index: number,
    before: PublicObservationLike,
    after: PublicObservationLike,
    _first: readonly (readonly number[])[],
    second: readonly (readonly number[])[],
  ): { matched: boolean | null; seal_prefix: boolean; reason: string } {
    if (before.level_epoch !== after.level_epoch
      || before.levels_completed !== after.levels_completed
      || before.state !== after.state) {
      return { matched: null, seal_prefix: true, reason: 'official_boundary' };
    }
    const step = proposal.steps[index]!;
    const expected = step.expected_after;
    let matched: boolean | null = expected ? sameFeatureSet(this.bodies(second), expected) : null;
    if (!expected) {
      for (const [bodyIndex, body] of step.before_bodies.entries()) {
        if (!step.offer.selected.includes(bodyIndex) && !childPresent(body, second)) matched = false;
      }
    }
    return {
      matched,
      seal_prefix: matched !== true || index + 1 === proposal.steps.length,
      reason: 'compare_stable_material_stock',
    };
  }

  record(
    before: PublicObservationLike,
    after: PublicObservationLike,
    command: { action_ref: string; data?: Record<string, unknown> },
    first: readonly (readonly number[])[],
    second: readonly (readonly number[])[],
    proposal?: FieldStockProposal | null,
    index?: number | null,
  ): FieldStockRecordResult {
    const old = this.bodies(first);
    const next = this.bodies(second);
    const nextFeatures = new Set(next.map(feature));
    const oldFeatures = new Set(old.map(feature));
    const left = old.filter(body => !nextFeatures.has(feature(body)));
    const right = next.filter(body => !oldFeatures.has(feature(body)));
    this.events = [];

    const data = command.data ?? {};
    if (command.action_ref !== this.actionRef
      || JSON.stringify(Object.keys(data).sort()) !== JSON.stringify(['x', 'y'])) {
      return { status: 'material_transition_unaddressed', events: [] };
    }

    const point = [Number(data.x), Number(data.y)] as const;
    if (proposal?.field_plan?.stock) {
      const step = proposal.steps[index ?? 0]!;
      for (const [bodyIndex, body] of step.before_bodies.entries()) {
        if (!step.offer.selected.includes(bodyIndex) && !nextFeatures.has(feature(body))) {
          this.invalid = {
            reason: 'unselected_material_changed_or_occluded',
            before: before.observation_ref,
            after: after.observation_ref,
          };
          return { status: 'field_preservation_prediction_refuted', events: [this.invalid] };
        }
      }
    }

    const recognizedTransition = right.length === 1
      && ((left.length === 1 && left[0]!.palette === right[0]!.palette)
        || (left.length === 2
          && left[0]!.palette === left[1]!.palette
          && right[0]!.palette !== left[0]!.palette));

    if (recognizedTransition) {
      const child = right[0]!;
      const offset = [point[0] - child.bbox[0], point[1] - child.bbox[1]] as const;
      const size = [
        child.bbox[2] - child.bbox[0] + 1,
        child.bbox[3] - child.bbox[1] + 1,
      ] as const;
      if (!(0 <= offset[0] && offset[0] < size[0] && 0 <= offset[1] && offset[1] < size[1])) {
        return { status: 'material_anchor_unresolved', events: [] };
      }

      const former = this.templates[String(child.palette)];
      const retainedAlignment = Boolean(
        former?.alignment_supported
        && samePair(former.offset, offset)
        && samePair(former.size, size),
      );
      this.templates[String(child.palette)] = {
        offset,
        mask: child.mask,
        size,
        alignment_supported: left.length === 1 || retainedAlignment,
      };
      if (!this.templates[String(child.palette)]!.alignment_supported) this.motionTypes.delete(child.palette);

      const origins = [...new Set(left.flatMap(body =>
        body.origins.length
          ? body.origins
          : [`origin:${before.observation_ref}:${feature(body)}`]))].sort();
      for (const body of left) this.lineages.delete(feature(body));
      this.lineages.set(feature(child), origins);

      let kind: string;
      if (left.length === 1) {
        this.motionTypes.add(child.palette);
        kind = 'typed_material_relocated_to_address';
      } else {
        const symbol = left[0]!.palette;
        let previous = this.rules[symbol];
        if (previous && previous.product !== child.palette) {
          if (previous.confirmations) {
            this.invalid = {
              reason: 'observed_rewrite_context_changed',
              before: before.observation_ref,
              after: after.observation_ref,
            };
            return { status: 'material_rewrite_refuted', events: [this.invalid] };
          }
          this.events.push({
            kind: 'recalled_rewrite_refuted',
            before: before.observation_ref,
            after: after.observation_ref,
          });
          previous = undefined;
        }
        const confirmations = previous ? previous.confirmations + 1 : 1;
        this.rules[symbol] = {
          consumed_count: 2,
          product: child.palette,
          produced_count: 1,
          confirmations,
          prior_evidence: previous?.prior_evidence ?? [],
          evidence: [...(previous?.evidence ?? []), after.observation_ref],
        };
        kind = 'observed_joint_material_rewrite';
      }

      this.events.push({
        kind,
        before: before.observation_ref,
        after: after.observation_ref,
        parents: left.map(body => ({ palette: body.palette, bbox: body.bbox })),
        product: { palette: child.palette, bbox: child.bbox },
        joint_origins: origins,
        conserved_pixel_identity_claimed: false,
      });
    } else if (proposal?.field_plan?.stock) {
      const offer = proposal.steps[index ?? 0]!.offer;
      if (offer.kind === 'fuse' && left.length === 0 && right.length === 0) {
        const selected = offer.selected
          .map(selectedIndex => old[selectedIndex])
          .filter((body): body is FieldStockBody => Boolean(body));
        if (selected.length === 2) {
          this.failures.add(`${feature(selected[0]!)}|${feature(selected[1]!)}|${offer.point.join(',')}`);
        }
      }
      this.events.push({
        kind: 'material_response_unresolved',
        removed: left.length,
        added: right.length,
        before: before.observation_ref,
        after: after.observation_ref,
      });
    }
    return { status: 'material_observation_recorded', events: this.events };
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
