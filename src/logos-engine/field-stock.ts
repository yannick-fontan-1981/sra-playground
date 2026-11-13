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

export interface FieldStockDependencies {
  digest(value: unknown): string;
  makeLocusWitness(
    observation: PublicObservationLike,
    rows: readonly (readonly number[])[],
    point: readonly [number, number],
    reason: string,
    evidence: readonly string[],
  ): unknown;
}

export interface FieldStockPreservationObligation {
  id: string;
  meaning: string;
  entity_predicate: {
    palette_value: number;
    minimum_count: number;
    exclude_boxes: Array<readonly [number, number, number, number]>;
  };
  evidence: string[];
  revision_inputs: string[];
}

export interface FieldStockProposalResult extends Record<string, unknown> {
  status: 'proposed' | 'typed_material_access_or_rewrite_unresolved' | 'typed_field_applicability_refuted';
  actions: Array<{ action_ref: string; data: { x: number; y: number } }>;
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

function bodyPixels(body: FieldStockBody): Array<readonly [number, number]> {
  const [left, top] = body.bbox;
  return body.mask.map(([x, y]) => [left + x, top + y] as const);
}

function bodyDistanceSquared(point: readonly [number, number], body: FieldStockBody): number {
  return Math.min(...bodyPixels(body).map(([x, y]) => (point[0] - x) ** 2 + (point[1] - y) ** 2));
}

function bodyAnchor(body: FieldStockBody): readonly [number, number] | null {
  if (!body.offset) return null;
  return [body.bbox[0] + body.offset[0], body.bbox[1] + body.offset[1]];
}

function toward(point: readonly [number, number], target: readonly [number, number]): number {
  return (point[0] - target[0]) ** 2 + (point[1] - target[1]) ** 2;
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


  allocations(bodies: readonly FieldStockBody[]): {
    remaining: Map<number, number>;
    free: number[];
    reserved: Set<number>;
    ready: number[];
  } {
    const remaining = new Map(this.demands);
    const free = this.zones.map((_, index) => index);
    const assigned: Array<readonly [number, number]> = [];
    for (const [index, body] of bodies.entries()) {
      const position = bodyAnchor(body);
      const matches = free.filter(zoneIndex => {
        const point = this.zones[zoneIndex]?.point;
        return Boolean(position && point && position[0] === point[0] && position[1] === point[1]);
      });
      if ((remaining.get(body.palette) ?? 0) > 0 && matches.length) {
        const zone = matches[0]!;
        remaining.set(body.palette, (remaining.get(body.palette) ?? 0) - 1);
        free.splice(free.indexOf(zone), 1);
        assigned.push([index, zone]);
      }
    }
    const reserved = new Set(assigned.map(([index]) => index));
    const ready: number[] = [];
    for (const [symbol, count] of remaining) {
      const options = bodies
        .map((body, index) => ({ body, index }))
        .filter(({ body, index }) => body.palette === symbol && !reserved.has(index))
        .sort((a, b) => {
          const aa = bodyAnchor(a.body);
          const ba = bodyAnchor(b.body);
          const ad = aa ? Math.min(...free.map(zone => toward(aa, this.zones[zone]!.point)), 0) : Number.POSITIVE_INFINITY;
          const bd = ba ? Math.min(...free.map(zone => toward(ba, this.zones[zone]!.point)), 0) : Number.POSITIVE_INFINITY;
          return ad - bd || a.index - b.index;
        });
      for (const { index } of options.slice(0, count)) {
        ready.push(index);
        reserved.add(index);
      }
    }
    return { remaining, free, reserved, ready };
  }

  loci(
    rows: readonly (readonly number[])[],
    bodies: readonly FieldStockBody[],
    selected: ReadonlySet<number>,
  ): Array<readonly [number, number]> {
    const result: Array<readonly [number, number]> = [];
    for (let y = 0; y < rows.length; y += 1) {
      for (let x = 0; x < (rows[0]?.length ?? 0); x += 1) {
        const point = [x, y] as const;
        const selectedOk = [...selected].every(index => bodyDistanceSquared(point, bodies[index]!) <= this.lower);
        const othersOk = bodies.every((body, index) => selected.has(index) || bodyDistanceSquared(point, body) >= this.upper);
        if (selectedOk && othersOk) result.push(point);
      }
    }
    return result;
  }

  movement(
    rows: readonly (readonly number[])[],
    bodies: readonly FieldStockBody[],
    index: number,
    target: readonly [number, number],
    purpose: string,
  ): FieldStockOffer | null {
    const body = bodies[index];
    if (!body) return null;
    const position = bodyAnchor(body);
    if (!position) return null;
    const points = this.loci(rows, bodies, new Set([index]))
      .filter(point => point[0] !== position[0] || point[1] !== position[1]);
    let useful = points.filter(point => toward(point, target) < toward(position, target));
    let chosenPurpose = purpose;
    if (!useful.length) {
      const others = bodies.filter((_, bodyIndex) => bodyIndex !== index);
      const separation = Math.min(...others.map(other => bodyDistanceSquared(position, other)), 0);
      useful = points.filter(point =>
        Math.min(...others.map(other => bodyDistanceSquared(point, other)), 0) > separation);
      if (!useful.length) return null;
      useful.sort((a, b) => {
        const as = Math.min(...others.map(other => bodyDistanceSquared(a, other)), 0);
        const bs = Math.min(...others.map(other => bodyDistanceSquared(b, other)), 0);
        return bs - as || toward(a, target) - toward(b, target) || a[0] - b[0] || a[1] - b[1];
      });
      chosenPurpose = 'Separate one retained material occurrence to make a later access possible.';
    } else {
      useful.sort((a, b) => toward(a, target) - toward(b, target) || a[0] - b[0] || a[1] - b[1]);
    }
    return {
      kind: 'move',
      selected: [index],
      point: useful[0]!,
      purpose: chosenPurpose,
      known: this.motionTypes.has(body.palette),
      product: body.palette,
    };
  }

  offer(
    rows: readonly (readonly number[])[],
    bodies: readonly FieldStockBody[],
  ): FieldStockOffer | null {
    const { remaining, free, reserved, ready } = this.allocations(bodies);
    if (ready.length && free.length) {
      const choices: Array<{ distance: number; offer: FieldStockOffer }> = [];
      for (const index of ready) {
        for (const zone of free) {
          const move = this.movement(
            rows,
            bodies,
            index,
            this.zones[zone]!.point,
            'Deliver an observed requested type while preserving the other stock.',
          );
          if (move) choices.push({ distance: toward(move.point, this.zones[zone]!.point), offer: move });
        }
      }
      if (choices.length) {
        choices.sort((a, b) => a.distance - b.distance);
        return choices[0]!.offer;
      }
    }

    const missing = [...remaining].filter(([symbol, count]) =>
      count > 0 && !ready.some(index => bodies[index]?.palette === symbol)).map(([symbol]) => symbol);
    if (!missing.length) return null;
    const targetRank = Math.max(...missing.map(symbol => this.order.indexOf(symbol)));
    const options: Array<{ rank: number; mode: number; distance: number; offer: FieldStockOffer }> = [];

    for (let left = 0; left < bodies.length; left += 1) {
      for (let right = left + 1; right < bodies.length; right += 1) {
        const first = bodies[left]!;
        const second = bodies[right]!;
        const symbol = first.palette;
        if (reserved.has(left) || reserved.has(right) || symbol !== second.palette || this.order.indexOf(symbol) >= targetRank) continue;
        const rank = this.order.indexOf(symbol);
        const product = this.rules[symbol]?.product ?? this.order[rank + 1]!;
        const target = [...this.zones]
          .map(zone => zone.point)
          .sort((a, b) => {
            const ad = [first, second].reduce((sum, body) => sum + toward(a, bodyAnchor(body) ?? body.bbox.slice(0, 2) as [number, number]), 0);
            const bd = [first, second].reduce((sum, body) => sum + toward(b, bodyAnchor(body) ?? body.bbox.slice(0, 2) as [number, number]), 0);
            return ad - bd;
          })[0]!;
        let points = this.loci(rows, bodies, new Set([left, right]));
        points = points.filter(point => !this.failures.has(`${feature(first)}|${feature(second)}|${point.join(',')}`));
        if (points.length) {
          points.sort((a, b) => toward(a, target) - toward(b, target) || a[0] - b[0] || a[1] - b[1]);
          options.push({
            rank: -rank,
            mode: 0,
            distance: toward(points[0]!, target),
            offer: {
              kind: 'fuse',
              selected: [left, right],
              point: points[0]!,
              product,
              known: (this.rules[symbol]?.confirmations ?? 0) >= 2,
              purpose: 'Test the production of a missing requested type through two observed intrants; a higher rewrite remains a hypothesis.',
            },
          });
        } else {
          for (const [moving, other] of [[left, right], [right, left]] as const) {
            const move = this.movement(
              rows,
              bodies,
              moving,
              bodyAnchor(bodies[other]!) ?? bodies[other]!.bbox.slice(0, 2) as [number, number],
              'Bring one producer intrant into a common field domain without consuming the other stock.',
            );
            if (move) options.push({ rank: -rank, mode: 1, distance: toward(move.point, target), offer: move });
          }
        }
      }
    }
    options.sort((a, b) => a.rank - b.rank || a.mode - b.mode || a.distance - b.distance);
    return options[0]?.offer ?? null;
  }

  simulate(
    bodies: readonly FieldStockBody[],
    offer: FieldStockOffer,
  ): FieldStockBody[] | null {
    const old = bodies[offer.selected[0]!];
    if (!old) return null;
    let template = this.templates[String(offer.product)];
    if (offer.kind === 'move') {
      template = {
        offset: old.offset,
        mask: old.mask,
        size: [old.bbox[2] - old.bbox[0] + 1, old.bbox[3] - old.bbox[1] + 1],
      };
    }
    if (!template || !template.offset) return null;
    const left = offer.point[0] - template.offset[0];
    const top = offer.point[1] - template.offset[1];
    const [width, height] = template.size;
    const origins = [...new Set(offer.selected.flatMap(index => bodies[index]?.origins ?? []))].sort();
    const product: FieldStockBody = {
      palette: offer.product,
      bbox: [left, top, left + width - 1, top + height - 1],
      mask: template.mask,
      offset: template.offset,
      origins,
    };
    return bodies
      .filter((_, index) => !offer.selected.includes(index))
      .concat(product)
      .sort((a, b) => a.palette - b.palette || a.bbox.join(',').localeCompare(b.bbox.join(',')));
  }

  preservationObligations(
    observation: PublicObservationLike,
    rows: readonly (readonly number[])[],
    deps: Pick<FieldStockDependencies, 'digest'>,
  ): FieldStockPreservationObligation[] {
    const counts = new Map<number, number>();
    for (const body of this.bodies(rows)) counts.set(body.palette, (counts.get(body.palette) ?? 0) + 1);
    for (const [symbol, required] of this.demands) {
      const current = Math.min(required, counts.get(symbol) ?? 0);
      this.minimums.set(symbol, Math.max(this.minimums.get(symbol) ?? 0, current));
    }
    return [...this.minimums]
      .filter(([, count]) => count > 0)
      .map(([symbol, count]) => ({
        id: 'C_material_' + deps.digest([this.epoch, symbol]).slice(0, 16),
        meaning: 'Retain the observed type count needed by the current request.',
        entity_predicate: {
          palette_value: symbol,
          minimum_count: count,
          exclude_boxes: [...this.interfaceBoxes],
        },
        evidence: [this.sceneRef, observation.observation_ref],
        revision_inputs: [this.actionRef],
      }));
  }

  propose(
    observation: PublicObservationLike,
    rows: readonly (readonly number[])[],
    remaining: number,
    deps: FieldStockDependencies,
  ): FieldStockProposalResult | null {
    if (this.invalid) {
      return { status: 'typed_field_applicability_refuted', actions: [], question: this.invalid };
    }
    if (!observation.available_action_refs.includes(this.actionRef)) return null;

    const bodies = this.bodies(rows);
    const steps: Array<Record<string, unknown>> = [];
    let state = bodies;
    const changed = new Set<string>();

    for (let count = 0; count < Math.min(16, remaining); count += 1) {
      const offer = this.offer(rows, state);
      if (!offer || changed.has(offer.point.join(','))) break;
      const expected = offer.known ? this.simulate(state, offer) : null;
      const action = { action_ref: this.actionRef, data: { x: offer.point[0], y: offer.point[1] } };
      const witness = deps.makeLocusWitness(
        observation,
        rows,
        offer.point,
        offer.purpose ?? '',
        [this.sceneRef, observation.observation_ref],
      );
      steps.push({
        action,
        before_bodies: state,
        offer,
        locus_witness: witness,
        expected_before: {
          level_epoch: this.epoch,
          frame_hash: steps.length === 0 ? observation.frame_hash : null,
        },
        expected_after: expected,
      });
      if (!expected) break;

      for (const index of offer.selected) {
        for (const point of bodyPixels(state[index]!)) changed.add(point.join(','));
      }
      const oldFeatures = new Set(state.map(feature));
      for (const body of expected) {
        if (!oldFeatures.has(feature(body))) for (const point of bodyPixels(body)) changed.add(point.join(','));
      }
      state = expected;
    }

    if (!steps.length) return { status: 'typed_material_access_or_rewrite_unresolved', actions: [] };
    const actions = steps.map(step => step.action as { action_ref: string; data: { x: number; y: number } });
    const firstOffer = steps[0]!.offer as FieldStockOffer;
    const why = firstOffer.purpose ?? '';
    const reference = 'C_field_stock_' + deps.digest([observation.observation_ref, actions]).slice(0, 16);
    const facts = {
      typed_stock_observed: true,
      request_recalled_from_scored_context: true,
      unknown_rewrite_closes_prefix: true,
    };
    const obligations = this.preservationObligations(observation, rows, deps);
    const preservationChanges = Object.fromEntries(obligations.map(item => [item.id, {
      observation_ref: observation.observation_ref,
      action_ref: this.actionRef,
      actions,
      why: 'The bound field question retains the requested material count.',
      revise_condition: false,
      expected_reestablishment: {
        minimum_count: item.entity_predicate.minimum_count,
        palette_value: item.entity_predicate.palette_value,
      },
    }]));
    const countsBefore = Object.fromEntries(this.order.map(symbol => [
      String(symbol),
      bodies.filter(body => body.palette === symbol).length,
    ]));
    const acquiredMinimums = Object.fromEntries([...this.minimums].map(([symbol, count]) => [String(symbol), count]));
    const plan = {
      stock: true,
      steps,
      order: [...this.order],
      demands: Object.fromEntries([...this.demands].map(([symbol, count]) => [String(symbol), count])),
      counts_before: countsBefore,
      acquired_minimums: acquiredMinimums,
      rules: structuredClone(this.rules),
      scope: 'Joint parentage is inferred from stable consumption and production; conserved pixel identity is not asserted.',
    };
    const evidence = [this.sceneRef, observation.observation_ref];
    return {
      status: 'proposed',
      kind: 'typed_field_stock',
      field_plan: plan,
      steps,
      actions,
      facts,
      preservation_changes: preservationChanges,
      compositions: [{
        id: reference,
        role: 'information_question',
        observed: false,
        open_question: why,
        properties: {
          demand_counts: plan.demands,
          available_counts: countsBefore,
        },
        relations: ['contributes_to:G_official_completion'],
      }],
      question: { reason: why, hypothesis_refs: evidence },
      route_refs: evidence,
      binding: {
        observation_ref: observation.observation_ref,
        level_epoch: this.epoch,
        levels_completed: observation.levels_completed,
      },
      bundle_template: {
        operation_key: 'OP18',
        composition_ref: reference,
        objective_ref: 'G_official_completion',
        preserve_refs: [],
        purpose: why,
        preconditions: facts,
        evidence,
        actions,
        frozen_field_plan: structuredClone(plan),
        outcome_guard: { path: ['value'], contains: reference },
      },
    };
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
