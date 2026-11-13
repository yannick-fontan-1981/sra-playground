/** Consumed common_field_stock.py, including the public guards and acquisition.
 * Recalled rewrites start with zero current confirmations. Geometry and type
 * order come solely from the public scene and the retained scored hypothesis. */
import { geometricComponents, ObservedInputDomain } from './v6-native-observer.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { typedChildPresent } from './v6-typed-material-observation.ts';
import { addressedClone as clone, addressedCompare as compare, addressedContains as contains,
  addressedDigest as digest, addressedEqual as equal, addressedFilled as filled, addressedKey as key,
  type AddressedRecord as R, type AddressedPoint as Point, type AddressedWork } from './v6-addressed-material-common.ts';
import type { NativeAfterResult, NativeBeforeResult, NativeObservation, NativeRows } from './v6-native-types.ts';

export type FieldStockFeature = readonly [number, readonly [number, number, number, number]];
export interface FieldStockBody extends R {
  palette: number;
  bbox: [number, number, number, number];
  mask: Point[];
  offset: Point | null;
  origins: string[];
}
export interface FieldStockOffer extends R {
  kind: 'move' | 'fuse';
  selected: number[];
  point: Point;
  purpose: string;
  known: boolean;
  product: number;
}
export const FIELD_STOCK_STATE_SCHEMA = 'logos-engine.addressed-field-stock.v1';

export const fieldStockFeature = (body: R): FieldStockFeature => [body.palette, body.bbox];
export function fieldStockPixels(body: R, work?: AddressedWork): Set<string> {
  const result = new Set<string>(), [left, top] = body.bbox;
  for (const [x, y] of body.mask as Point[]) { work?.tick(); result.add(key([left + x, top + y])); }
  return result;
}
export function fieldStockDistance(point: Point, body: R, work?: AddressedWork): number {
  let value = Infinity;
  const [left, top] = body.bbox;
  for (const [x, y] of body.mask as Point[]) {
    work?.tick(); value = Math.min(value, (point[0] - left - x) ** 2 + (point[1] - top - y) ** 2);
  }
  if (value === Infinity) throw new RangeError('Field stock support is empty');
  return value;
}
export function fieldStockAnchor(body: R): Point | null {
  return body.offset == null ? null : [body.bbox[0] + body.offset[0], body.bbox[1] + body.offset[1]];
}
const featureKey = (body: R): string => key(fieldStockFeature(body));
const sortBodies = (bodies: FieldStockBody[]): FieldStockBody[] => bodies.sort((a, b) => compare(fieldStockFeature(a), fieldStockFeature(b)));
const toward = (point: Point, target: readonly number[]): number => (point[0] - target[0]!) ** 2 + (point[1] - target[1]!) ** 2;
const countBodies = (bodies: readonly R[]): Map<number, number> => {
  const counts = new Map<number, number>();
  for (const body of bodies) counts.set(body.palette, (counts.get(body.palette) ?? 0) + 1);
  return counts;
};
/** Public JSON transport stringifies integer mapping keys. Internal/source
 * checkpoints use entries so insertion order survives that transport. */
const publicMap = <T>(values: ReadonlyMap<number, T>): Record<string, T> => Object.fromEntries([...values].map(([symbol, value]) => [String(symbol), value]));
const ruleEntries = (value: any): [number, R][] => Array.isArray(value)
  ? value.map(([symbol, rule]: [number, R]) => [Number(symbol), rule] as [number, R])
  : Object.entries(value ?? {}).map(([symbol, rule]) => [Number(symbol), rule as R] as [number, R]);
const priorProjection = (prior: R): R => Object.hasOwn(prior, 'observed_rules')
  ? { ...prior, observed_rules: Array.isArray(prior.observed_rules) ? prior.observed_rules : Object.entries(prior.observed_rules) }
  : prior;

export class FieldStock {
  private prior: R = {};
  private epoch = 0;
  private order: number[] = [];
  private requests: R[] = [];
  private demands = new Map<number, number>();
  private zones: R[] = [];
  private interfaceBoxes: number[][] = [];
  private lower = 0;
  private upper = 0;
  private actionRef = '';
  private templates: R = {};
  private rules = new Map<number, R>();
  private lineages = new Map<string, string[]>();
  private motionTypes = new Set<number>();
  private minimums = new Map<number, number>();
  private failures = new Set<string>();
  private events: R[] = [];
  private invalid: R | null = null;
  private sceneRef = '';
  private version = 0;
  private cachedState: R | null = null;

  private constructor() {}
  get revision(): number { return this.version; }
  private changed(): void { this.version++; this.cachedState = null; }

  static create(prior: R, observation: R, rows: NativeRows, work?: AddressedWork): FieldStock | null {
    if (!prior.goal_region || prior.upper_squared == null) return null;
    work?.check();
    const row = prior.request_row;
    const squares = (observation.entities as R[]).filter(entity => {
      work?.tick(); return entity.rectangular && entity.bbox[2] - entity.bbox[0] === entity.bbox[3] - entity.bbox[1];
    });
    const groups = new Map<string, R[]>();
    for (const entity of squares) {
      work?.tick(); const [left, top, right] = entity.bbox;
      if (right > left) { const group = key([top, right - left + 1]); if (!groups.has(group)) groups.set(group, []); groups.get(group)!.push(entity); }
    }
    const ladders: { distance: number; entries: R[] }[] = [];
    for (const [group, entries] of groups) {
      work?.tick(entries.length); entries.sort((a, b) => a.bbox[0] - b.bbox[0]);
      const pitches = new Set(entries.slice(1).map((entry, i) => entry.bbox[0] - entries[i]!.bbox[0]));
      if (entries.length >= 2 && new Set(entries.map(entity => entity.palette_value)).size === entries.length && pitches.size === 1)
        ladders.push({ distance: Math.abs((JSON.parse(group) as number[])[0]! - row), entries });
    }
    if (!ladders.length) return null;
    ladders.sort((a, b) => b.entries.length - a.entries.length || a.distance - b.distance);
    const ladder = ladders[0]!.entries, order = ladder.map(entity => entity.palette_value as number);
    const ladderBoxes = new Set(ladder.map(entity => key(entity.bbox)));
    const requests = squares.filter(entity => entity.bbox[1] <= row && row <= entity.bbox[3] && !ladderBoxes.has(key(entity.bbox)) && order.includes(entity.palette_value));
    const envelope = new Set<string>((prior.goal_region.envelope as Point[]).map(key)), size = prior.goal_region.size as Point;
    const zones: R[] = [];
    for (const entity of observation.entities as R[]) {
      work?.tick(); const [left, top, right, bottom] = entity.bbox;
      if (!equal([right - left + 1, bottom - top + 1], size)) continue;
      const inside = filled(new Set<string>((entity.mask as Point[]).map(key)), size[0], size[1], work);
      if (inside.size === envelope.size && [...inside].every(point => envelope.has(point))) zones.push({
        bbox: entity.bbox, point: [Math.floor((left + right) / 2), Math.floor((top + bottom) / 2)], source_ref: observation.observation_ref,
      });
    }
    if (!requests.length || !zones.length) return null;
    const instance = new FieldStock();
    // Owned immutable scene branches can be reused across subsequent snapshots.
    instance.prior = retainNativeJson(priorProjection(prior)); instance.epoch = observation.level_epoch;
    instance.order = retainNativeJson(order); instance.requests = retainNativeJson(requests);
    for (const entity of requests) instance.demands.set(entity.palette_value, (instance.demands.get(entity.palette_value) ?? 0) + 1);
    instance.zones = retainNativeJson(zones);
    instance.interfaceBoxes = retainNativeJson([...ladder, ...requests].map(entity => entity.bbox).concat(
      (observation.entities as R[]).filter(entity => entity.bbox[0] === 0 && entity.bbox[2] === rows[0]!.length - 1 && entity.bbox[1] === entity.bbox[3]).map(entity => entity.bbox)));
    instance.lower = prior.lower_squared; instance.upper = prior.upper_squared; instance.actionRef = prior.action_ref;
    instance.templates = retainNativeJson(prior.class_templates ?? {});
    for (const [symbol, rule] of ruleEntries(prior.observed_rules)) if (order.includes(symbol) && order.includes(rule.product) && equal(prior.type_order, order))
      instance.rules.set(symbol, retainNativeJson({ ...rule, confirmations: 0, prior_evidence: rule.evidence, evidence: [] }));
    instance.motionTypes = new Set(Object.entries(instance.templates).filter(([, template]) => template.alignment_supported).map(([symbol]) => Number(symbol)));
    instance.sceneRef = observation.observation_ref;
    work?.check(); return instance;
  }

  bodies(rows: NativeRows, work?: AddressedWork): FieldStockBody[] {
    work?.tick(rows.length * (rows[0]?.length ?? 0));
    const components = geometricComponents(rows), result: FieldStockBody[] = [];
    work?.check();
    for (const entity of components) {
      work?.tick(); const [left, top, right, bottom] = entity.bbox;
      if (!this.order.includes(entity.color) || !entity.rectangular || right - left !== bottom - top) continue;
      if (this.interfaceBoxes.some(box => { work?.tick(); return contains(box, entity.bbox); })) continue;
      const side = right - left + 1, template = this.templates[String(entity.color)];
      const offset = template && equal(template.size, [side, side]) ? template.offset : side === 1 ? [0, 0] : null;
      const body: FieldStockBody = { palette: entity.color, bbox: [...entity.bbox], mask: [...entity.mask].map(point => [...point] as Point).sort(compare),
        offset: offset === null ? null : [...offset] as unknown as Point, origins: [...(this.lineages.get(key([entity.color, entity.bbox])) ?? [])] };
      result.push(body);
    }
    return sortBodies(result);
  }

  private allocationsOrdered(bodies: readonly FieldStockBody[], work?: AddressedWork): [Map<number, number>, number[], Set<number>, number[]] {
    const remaining = new Map(this.demands), free = this.zones.map((_, index) => index), assigned: [number, number][] = [];
    for (const [index, body] of bodies.entries()) {
      work?.tick(); const position = fieldStockAnchor(body);
      const matches = free.filter(zone => equal(position, this.zones[zone]!.point));
      if ((remaining.get(body.palette) ?? 0) && matches.length) {
        const zone = matches[0]!; remaining.set(body.palette, remaining.get(body.palette)! - 1); free.splice(free.indexOf(zone), 1); assigned.push([index, zone]);
      }
    }
    const reserved = new Set(assigned.map(([index]) => index)), ready: number[] = [];
    for (const [symbol, count] of remaining) {
      const options = bodies.flatMap((body, index) => { work?.tick(); return body.palette === symbol && !reserved.has(index) ? [index] : []; });
      const cost = (index: number): number => {
        const position = fieldStockAnchor(bodies[index]!);
        if (!position) return Infinity;
        let distance = Infinity;
        for (const zone of free) { work?.tick(); distance = Math.min(distance, toward(position, this.zones[zone]!.point)); }
        return free.length ? distance : 0;
      };
      const ranked = options.map(index => ({ index, cost: cost(index) })); ranked.sort((a, b) => a.cost === b.cost ? 0 : a.cost - b.cost);
      for (const { index } of ranked.slice(0, count)) { ready.push(index); reserved.add(index); }
    }
    return [remaining, free, reserved, ready];
  }

  allocations(bodies: readonly FieldStockBody[], work?: AddressedWork): [Record<string, number>, number[], number[], number[]] {
    const [remaining, free, reserved, ready] = this.allocationsOrdered(bodies, work);
    return [publicMap(remaining), free, [...reserved].sort((a, b) => a - b), ready];
  }

  loci(rows: NativeRows, bodies: readonly FieldStockBody[], selected: ReadonlySet<number> | readonly number[], work?: AddressedWork): Point[] {
    const indices = selected instanceof Set ? selected : new Set(selected), result: Point[] = [];
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[0]!.length; x++) {
      work?.node(); const point: Point = [x, y]; let admitted = true;
      for (const index of indices) if (fieldStockDistance(point, bodies[index]!, work) > this.lower) { admitted = false; break; }
      if (!admitted) continue;
      for (let index = 0; index < bodies.length; index++) if (!indices.has(index) && fieldStockDistance(point, bodies[index]!, work) < this.upper) { admitted = false; break; }
      if (admitted) result.push(point);
    }
    return result;
  }

  static toward(point: Point, target: readonly number[]): number { return toward(point, target); }

  movement(rows: NativeRows, bodies: readonly FieldStockBody[], index: number, target: readonly number[], purpose: string, work?: AddressedWork): FieldStockOffer | null {
    const body = bodies[index]!, position = fieldStockAnchor(body);
    if (position === null) return null;
    const points = this.loci(rows, bodies, new Set([index]), work).filter(point => !equal(point, position));
    let useful = points.filter(point => toward(point, target) < toward(position, target));
    let point: Point;
    if (useful.length) {
      useful.sort((a, b) => toward(a, target) - toward(b, target) || compare(a, b)); point = useful[0]!;
    } else {
      const others = bodies.filter((_, other) => other !== index);
      const separationAt = (at: Point): number => {
        let distance = Infinity; for (const other of others) distance = Math.min(distance, fieldStockDistance(at, other, work));
        return others.length ? distance : 0;
      };
      const separation = separationAt(position);
      const separated = points.map(value => ({ value, separation: separationAt(value) })).filter(item => item.separation > separation);
      if (!separated.length) return null;
      separated.sort((a, b) => b.separation - a.separation || toward(a.value, target) - toward(b.value, target) || compare(a.value, b.value));
      point = separated[0]!.value; purpose = 'Separate one retained material occurrence to make a later access possible.';
    }
    return { kind: 'move', selected: [index], point, purpose, known: this.motionTypes.has(body.palette), product: body.palette };
  }

  offer(rows: NativeRows, bodies: readonly FieldStockBody[], work?: AddressedWork): FieldStockOffer | null {
    const [remaining, free, reserved, ready] = this.allocationsOrdered(bodies, work);
    if (ready.length && free.length) {
      const choices: { distance: number; move: FieldStockOffer }[] = [];
      for (const index of ready) for (const zone of free) {
        work?.tick(); const move = this.movement(rows, bodies, index, this.zones[zone]!.point, 'Deliver an observed requested type while preserving the other stock.', work);
        if (move) choices.push({ distance: toward(move.point, this.zones[zone]!.point), move });
      }
      if (choices.length) { choices.sort((a, b) => a.distance - b.distance); return choices[0]!.move; }
    }
    const missing = [...remaining].filter(([symbol, count]) => count && !ready.some(index => bodies[index]!.palette === symbol)).map(([symbol]) => symbol);
    if (!missing.length) return null;
    const targetRank = Math.max(...missing.map(symbol => this.order.indexOf(symbol)));
    const options: { rank: readonly number[]; offer: FieldStockOffer }[] = [];
    for (let left = 0; left < bodies.length; left++) for (let right = left + 1; right < bodies.length; right++) {
      work?.node(); const first = bodies[left]!, second = bodies[right]!, symbol = first.palette;
      if (reserved.has(left) || reserved.has(right) || symbol !== second.palette || this.order.indexOf(symbol) >= targetRank) continue;
      const rank = this.order.indexOf(symbol), product = this.rules.get(symbol)?.product ?? this.order[rank + 1]!;
      const targets = this.zones.map(zone => ({ point: zone.point as Point, distance: toward(zone.point, fieldStockAnchor(first) ?? first.bbox.slice(0, 2)) + toward(zone.point, fieldStockAnchor(second) ?? second.bbox.slice(0, 2)) }));
      targets.sort((a, b) => a.distance - b.distance); const target = targets[0]!.point;
      const points = this.loci(rows, bodies, new Set([left, right]), work).filter(point => !this.failures.has(key([fieldStockFeature(first), fieldStockFeature(second), point])));
      if (points.length) {
        points.sort((a, b) => toward(a, target) - toward(b, target) || compare(a, b)); const point = points[0]!;
        options.push({ rank: [-rank, 0, toward(point, target)], offer: { kind: 'fuse', selected: [left, right], point, product,
          known: (this.rules.get(symbol)?.confirmations ?? 0) >= 2,
          purpose: 'Test the production of a missing requested type through two observed intrants; a higher rewrite remains a hypothesis.' } });
      } else {
        for (const [moving, other] of [[left, right], [right, left]] as const) {
          const move = this.movement(rows, bodies, moving, fieldStockAnchor(bodies[other]!) ?? bodies[other]!.bbox.slice(0, 2),
            'Bring one producer intrant into a common field domain without consuming the other stock.', work);
          if (move) options.push({ rank: [-rank, 1, toward(move.point, target)], offer: move });
        }
      }
    }
    options.sort((a, b) => compare(a.rank, b.rank)); return options[0]?.offer ?? null;
  }

  simulate(bodies: readonly FieldStockBody[], offer: FieldStockOffer, work?: AddressedWork): FieldStockBody[] | null {
    const point = offer.point, selected = new Set(offer.selected), old = bodies[offer.selected[0]!]!;
    let template: R | undefined = this.templates[String(offer.product)];
    if (offer.kind === 'move') template = { offset: old.offset, mask: old.mask, size: [old.bbox[2] - old.bbox[0] + 1, old.bbox[3] - old.bbox[1] + 1] };
    if (!template || template.offset === null) return null;
    const left = point[0] - template.offset[0], top = point[1] - template.offset[1], [width, height] = template.size;
    const origins = new Set<string>();
    for (const index of offer.selected) for (const origin of bodies[index]!.origins) { work?.tick(); origins.add(origin); }
    const product: FieldStockBody = { palette: offer.product, bbox: [left, top, left + width - 1, top + height - 1], mask: clone(template.mask), offset: clone(template.offset), origins: [...origins].sort(compare) };
    return sortBodies([...bodies.filter((_, index) => !selected.has(index)), product]);
  }

  preservationObligations(observation: R, rows: NativeRows, work?: AddressedWork): R[] {
    const counts = countBodies(this.bodies(rows, work)), next = new Map(this.minimums);
    for (const [symbol, required] of this.demands) { work?.tick(); next.set(symbol, Math.max(next.get(symbol) ?? 0, Math.min(required, counts.get(symbol) ?? 0))); }
    work?.check();
    // Counter assignment creates a zero entry too. Preserve its order without
    // invalidating an immutable checkpoint when no acquired minimum changed.
    if (!equal([...next], [...this.minimums])) { this.minimums = next; this.changed(); }
    return [...this.minimums].filter(([, count]) => count !== 0).map(([symbol, count]) => ({
      id: 'C_material_' + digest([this.epoch, symbol]).slice(0, 16), meaning: 'Retain the observed type count needed by the current request.',
      entity_predicate: { palette_value: symbol, minimum_count: count, exclude_boxes: clone(this.interfaceBoxes) },
      evidence: [this.sceneRef, observation.observation_ref], revision_inputs: [this.actionRef],
    }));
  }

  async propose(observation: R, rows: NativeRows, remaining: number, work?: AddressedWork): Promise<R | null> {
    if (this.invalid) return { status: 'typed_field_applicability_refuted', actions: [], question: clone(this.invalid) };
    if (!(observation.available_action_refs as string[]).includes(this.actionRef)) return null;
    const bodies = this.bodies(rows, work), steps: R[] = [], changed = new Set<string>();
    let state = bodies;
    for (let iteration = 0; iteration < Math.min(16, remaining); iteration++) {
      work?.check(); const offer = this.offer(rows, state, work);
      if (offer === null || changed.has(key(offer.point))) break;
      const expected = offer.known ? this.simulate(state, offer, work) : null;
      const action = { action_ref: this.actionRef, data: { x: offer.point[0], y: offer.point[1] } };
      await work?.yield();
      const witness = await ObservedInputDomain.makeLocusWitness(observation as NativeObservation, rows, offer.point, {
        reason: offer.purpose, evidence: [this.sceneRef, observation.observation_ref],
      });
      work?.check();
      steps.push({ action, before_bodies: state, offer, locus_witness: witness,
        expected_before: { level_epoch: this.epoch, frame_hash: steps.length ? null : observation.frame_hash }, expected_after: expected });
      if (expected === null) break;
      for (const index of offer.selected) for (const point of fieldStockPixels(state[index]!, work)) changed.add(point);
      const previous = new Set(state.map(featureKey));
      for (const body of expected) if (!previous.has(featureKey(body))) for (const point of fieldStockPixels(body, work)) changed.add(point);
      state = expected;
    }
    if (!steps.length) return { status: 'typed_material_access_or_rewrite_unresolved', actions: [] };
    const actions = steps.map(step => step.action), why = steps[0]!.offer.purpose;
    const reference = 'C_field_stock_' + digest([observation.observation_ref, actions]).slice(0, 16);
    const facts = { typed_stock_observed: true, request_recalled_from_scored_context: true, unknown_rewrite_closes_prefix: true };
    const obligations = this.preservationObligations(observation, rows, work);
    const changes = Object.fromEntries(obligations.map(item => [item.id, { observation_ref: observation.observation_ref, action_ref: this.actionRef, actions,
      why: 'The bound field question retains the requested material count.', revise_condition: false,
      expected_reestablishment: { minimum_count: item.entity_predicate.minimum_count, palette_value: item.entity_predicate.palette_value } }]));
    const plan = { stock: true, steps, order: clone(this.order), demands: publicMap(this.demands), counts_before: publicMap(countBodies(bodies)),
      acquired_minimums: publicMap(this.minimums), rules: clone(publicMap(this.rules)),
      scope: 'Joint parentage is inferred from stable consumption and production; conserved pixel identity is not asserted.' };
    const evidence = [this.sceneRef, observation.observation_ref];
    return { status: 'proposed', kind: 'typed_field_stock', field_plan: plan, steps, actions, facts, preservation_changes: changes,
      compositions: [{ id: reference, role: 'information_question', observed: false, open_question: why,
        properties: { demand_counts: publicMap(this.demands), available_counts: plan.counts_before }, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: why, hypothesis_refs: evidence }, route_refs: evidence,
      binding: { observation_ref: observation.observation_ref, level_epoch: this.epoch, levels_completed: observation.levels_completed },
      bundle_template: { operation_key: 'OP18', composition_ref: reference, objective_ref: 'G_official_completion', preserve_refs: [], purpose: why,
        preconditions: facts, evidence, actions, frozen_field_plan: clone(plan), outcome_guard: { path: ['value'], contains: reference } } };
  }

  before(proposal: R, index: number, publicPacket: R, observation: R, work?: AddressedWork): NativeBeforeResult {
    const expected = proposal.steps[index].before_bodies as FieldStockBody[], actual = this.bodies(publicPacket.frame_rows, work);
    let ok = publicPacket.level === proposal.binding.level_epoch && publicPacket.levels_completed === proposal.binding.levels_completed
      && (index > 0 || observation.observation_ref === proposal.binding.observation_ref)
      && equal(actual.map(fieldStockFeature).sort(compare), expected.map(fieldStockFeature).sort(compare));
    for (const body of expected) {
      work?.tick(body.mask.length);
      const child = { center: body.bbox.slice(0, 2), marks: body.mask.map(([x, y]) => [body.palette, x, y]) };
      ok = ok && typedChildPresent(child, publicPacket.frame_rows);
    }
    return { admitted: Boolean(ok), reason: ok ? 'typed_stock_and_address_bound' : 'typed_stock_changed' };
  }

  after(proposal: R, index: number, before: R, after: R, _first: NativeRows, second: NativeRows, work?: AddressedWork): NativeAfterResult {
    if (before.level_epoch !== after.level_epoch || before.levels_completed !== after.levels_completed || before.state !== after.state)
      return { matched: null, seal_prefix: true, reason: 'official_boundary' };
    const expected = proposal.steps[index].expected_after as FieldStockBody[] | null;
    let matched: boolean | null = expected === null ? null : equal(this.bodies(second, work).map(fieldStockFeature).sort(compare), expected.map(fieldStockFeature).sort(compare));
    if (expected === null) {
      const step = proposal.steps[index];
      for (const [i, body] of (step.before_bodies as FieldStockBody[]).entries()) if (!(step.offer.selected as number[]).includes(i)) {
        work?.tick(body.mask.length);
        if (!typedChildPresent({ center: body.bbox.slice(0, 2), marks: body.mask.map(([x, y]) => [body.palette, x, y]) }, second)) matched = false;
      }
    }
    return { matched, seal_prefix: matched !== true || index + 1 === proposal.steps.length, reason: 'compare_stable_material_stock' };
  }

  record(before: R, after: R, command: R, first: NativeRows, second: NativeRows, proposal: R | null = null, index: number | null = null): R {
    const old = this.bodies(first), current = this.bodies(second), oldFeatures = new Set(old.map(featureKey)), newFeatures = new Set(current.map(featureKey));
    const left = old.filter(body => !newFeatures.has(featureKey(body))), right = current.filter(body => !oldFeatures.has(featureKey(body)));
    let mutated = this.events.length > 0;
    this.events = [];
    const finish = (status: string, events: R[] = this.events): R => {
      this.events = retainNativeJson(this.events);
      if (mutated) this.changed();
      return { status, events: clone(events) };
    };
    if (command.action_ref !== this.actionRef || !equal(Object.keys(command.data ?? {}).sort(compare), ['x', 'y'])) return finish('material_transition_unaddressed', []);
    const point: Point = [command.data.x, command.data.y];
    if (proposal?.field_plan?.stock) {
      const step = proposal.steps[index!];
      for (const [i, body] of (step.before_bodies as FieldStockBody[]).entries()) if (!(step.offer.selected as number[]).includes(i) && !newFeatures.has(featureKey(body))) {
        this.invalid = retainNativeJson({ reason: 'unselected_material_changed_or_occluded', before: before.observation_ref, after: after.observation_ref }); mutated = true;
        // The source returns this event but leaves self.events empty.
        return finish('field_preservation_prediction_refuted', [this.invalid]);
      }
    }
    if (right.length === 1 && ((left.length === 1 && left[0]!.palette === right[0]!.palette)
      || (left.length === 2 && left[0]!.palette === left[1]!.palette && right[0]!.palette !== left[0]!.palette))) {
      const child = right[0]!, offset: Point = [point[0] - child.bbox[0], point[1] - child.bbox[1]], size: Point = [child.bbox[2] - child.bbox[0] + 1, child.bbox[3] - child.bbox[1] + 1];
      if (!(0 <= offset[0] && offset[0] < size[0] && 0 <= offset[1] && offset[1] < size[1])) return finish('material_anchor_unresolved', []);
      const former = this.templates[String(child.palette)] ?? {};
      const retainedAlignment = former.alignment_supported && equal(former.offset, offset) && equal(former.size, size);
      const template = retainNativeJson({ offset, mask: child.mask, size, alignment_supported: left.length === 1 || Boolean(retainedAlignment) });
      this.templates = retainNativeJson({ ...this.templates, [String(child.palette)]: template }); mutated = true;
      if (!template.alignment_supported) this.motionTypes.delete(child.palette);
      const origins = [...new Set(left.flatMap(body => body.origins.length ? body.origins : [digest([before.observation_ref, fieldStockFeature(body)])]))].sort(compare);
      for (const body of left) this.lineages.delete(featureKey(body));
      this.lineages.set(featureKey(child), retainNativeJson(origins));
      let kind: string;
      if (left.length === 1) { this.motionTypes.add(child.palette); kind = 'typed_material_relocated_to_address'; }
      else {
        const symbol = left[0]!.palette; let previous = this.rules.get(symbol);
        if (previous && previous.product !== child.palette) {
          if (previous.confirmations) {
            this.invalid = retainNativeJson({ reason: 'observed_rewrite_context_changed', before: before.observation_ref, after: after.observation_ref });
            // Template and lineage changes precede this source refusal.
            return finish('material_rewrite_refuted', [this.invalid]);
          }
          this.events.push({ kind: 'recalled_rewrite_refuted', before: before.observation_ref, after: after.observation_ref }); previous = undefined;
        }
        this.rules.set(symbol, retainNativeJson({ consumed_count: 2, product: child.palette, produced_count: 1,
          confirmations: previous ? previous.confirmations + 1 : 1, prior_evidence: previous?.prior_evidence ?? [], evidence: [...(previous?.evidence ?? []), after.observation_ref] }));
        kind = 'observed_joint_material_rewrite';
      }
      this.events.push({ kind, before: before.observation_ref, after: after.observation_ref,
        parents: left.map(body => ({ palette: body.palette, bbox: body.bbox })), product: { palette: child.palette, bbox: child.bbox },
        joint_origins: origins, conserved_pixel_identity_claimed: false });
    } else if (proposal?.field_plan?.stock) {
      const offer = proposal.steps[index!].offer as FieldStockOffer;
      if (offer.kind === 'fuse' && !left.length && !right.length) {
        const firstBody = old[offer.selected[0]!]!, secondBody = old[offer.selected[1]!]!;
        this.failures.add(key([fieldStockFeature(firstBody), fieldStockFeature(secondBody), offer.point]));
      }
      this.events.push({ kind: 'material_response_unresolved', removed: left.length, added: right.length, before: before.observation_ref, after: after.observation_ref }); mutated = true;
    }
    return finish('material_observation_recorded');
  }

  retained(boundary: string): R {
    return clone({ ...this.prior, class_templates: this.templates, observed_rules: publicMap(this.rules), type_order: this.order, boundary,
      qualification: 'structural field/material hypotheses; next epoch requires fresh bindings and rewrite witnesses' });
  }
  /** Internal hypothesis transport preserves Python integer-key insertion order. */
  retainedHypotheses(boundary: string): R {
    return clone({ ...this.prior, class_templates: this.templates, observed_rules: [...this.rules], type_order: this.order, boundary,
      qualification: 'structural field/material hypotheses; next epoch requires fresh bindings and rewrite witnesses' });
  }

  private projectSourceState(): R {
    return { prior: this.prior, epoch: this.epoch, order: this.order, requests: this.requests, demands: [...this.demands], zones: this.zones,
      interface_boxes: this.interfaceBoxes, lower: this.lower, upper: this.upper, action_ref: this.actionRef, templates: this.templates, rules: [...this.rules],
      lineages: [...this.lineages].map(([feature, origins]) => [JSON.parse(feature), origins]), motion_types: [...this.motionTypes].sort((a, b) => a - b),
      minimums: [...this.minimums], failures: [...this.failures].map(value => JSON.parse(value)).sort(compare), events: this.events, invalid: this.invalid, scene_ref: this.sceneRef };
  }
  sourceState(): R { return clone(this.nativeState().source); }
  nativeState(): R {
    if (!this.cachedState) this.cachedState = retainNativeJson({ schema: FIELD_STOCK_STATE_SCHEMA, source: this.projectSourceState() });
    return this.cachedState;
  }
  state(): R { return clone(this.nativeState()); }
  snapshot(): R { return this.state(); }
  static fromState(state: R): FieldStock { const stock = new FieldStock(); stock.restore(state); return stock; }
  restore(state: R): void {
    const owned = validateFieldStockState(state), source = owned.source;
    // Complete validation happens before any current field is replaced.
    this.prior = source.prior; this.epoch = source.epoch; this.order = source.order; this.requests = source.requests;
    this.demands = new Map(source.demands); this.zones = source.zones; this.interfaceBoxes = source.interface_boxes;
    this.lower = source.lower; this.upper = source.upper; this.actionRef = source.action_ref; this.templates = source.templates;
    this.rules = new Map(source.rules); this.lineages = new Map(source.lineages.map(([feature, origins]: [FieldStockFeature, string[]]) => [key(feature), origins]));
    this.motionTypes = new Set(source.motion_types); this.minimums = new Map(source.minimums); this.failures = new Set(source.failures.map(key));
    this.events = source.events; this.invalid = source.invalid; this.sceneRef = source.scene_ref;
    this.version++; this.cachedState = owned;
  }
}

/** Native checkpoint validation is an extension of the original owner, which
 * has no restore method. It checks all retained contracts before installation. */
function validateFieldStockState(input: R): R {
  const state = retainNativeJson(input) as R;
  const fail = (message: string): never => { throw new TypeError('Invalid field stock checkpoint: ' + message); };
  const object = (value: any, name: string): R => { if (!value || Array.isArray(value) || typeof value !== 'object') fail(name); return value; };
  const array = (value: any, name: string): any[] => { if (!Array.isArray(value)) fail(name); return value; };
  const integer = (value: any, name: string, minimum = 0): number => { if (!Number.isSafeInteger(value) || value < minimum) fail(name); return value; };
  const palette = (value: any): number => { integer(value, 'palette'); if (value > 255) fail('palette'); return value; };
  const string = (value: any, name: string): string => { if (typeof value !== 'string' || !value.length) fail(name); return value; };
  const keys = (value: R, expected: readonly string[], name: string): void => { if (!equal(Object.keys(value).sort(compare), [...expected].sort(compare))) fail(name + ' fields'); };
  const point = (value: any, name: string): number[] => { array(value, name); if (value.length !== 2) fail(name); for (const coordinate of value) integer(coordinate, name); return value; };
  const box = (value: any, name: string): number[] => {
    array(value, name); if (value.length !== 4) fail(name); for (const coordinate of value) integer(coordinate, name);
    if (value[0] > value[2] || value[1] > value[3]) fail(name); return value;
  };
  const strings = (value: any, name: string, sorted = false): string[] => {
    array(value, name); for (const item of value) string(item, name);
    if (sorted && (new Set(value).size !== value.length || !equal(value, [...value].sort(compare)))) fail(name + ' order'); return value;
  };
  const entries = (value: any, name: string): any[][] => {
    array(value, name); const seen = new Set<string>();
    for (const entry of value) { if (!Array.isArray(entry) || entry.length !== 2 || seen.has(key(entry[0]))) fail(name + ' entries'); seen.add(key(entry[0])); }
    return value;
  };
  const mask = (value: any, size: readonly number[], name: string): void => {
    array(value, name); if (!value.length) fail(name); const seen = new Set<string>();
    for (const item of value) { point(item, name); if (item[0] >= size[0]! || item[1] >= size[1]! || seen.has(key(item))) fail(name); seen.add(key(item)); }
  };
  const template = (value: any): void => {
    object(value, 'template'); const size = point(value.size, 'template size'); if (size.some(n => n === 0)) fail('template size');
    const offset = point(value.offset, 'template offset'); if (offset.some((n, i) => n >= size[i]!)) fail('template offset');
    mask(value.mask, size, 'template mask'); if (typeof value.alignment_supported !== 'boolean') fail('template alignment');
  };
  const templates = (value: any): R => {
    object(value, 'templates'); for (const [symbol, item] of Object.entries(value)) { if (String(palette(Number(symbol))) !== symbol) fail('template symbol'); template(item); } return value;
  };
  const rule = (value: any): void => {
    object(value, 'rule'); if (value.consumed_count !== 2 || value.produced_count !== 1) fail('rewrite cardinality'); palette(value.product);
    integer(value.confirmations, 'rewrite confirmations'); strings(value.evidence, 'rewrite evidence'); strings(value.prior_evidence ?? [], 'prior rewrite evidence');
    if (value.evidence.length !== value.confirmations) fail('rewrite confirmations/evidence');
  };
  const feature = (value: any): void => {
    array(value, 'feature'); if (value.length !== 2) fail('feature'); palette(value[0]); const bbox = box(value[1], 'feature bbox');
    if (bbox[2]! - bbox[0]! !== bbox[3]! - bbox[1]!) fail('non-square feature');
  };
  object(state, 'root'); keys(state, ['schema', 'source'], 'root'); if (state.schema !== FIELD_STOCK_STATE_SCHEMA) fail('schema');
  const s = object(state.source, 'source');
  keys(s, ['prior', 'epoch', 'order', 'requests', 'demands', 'zones', 'interface_boxes', 'lower', 'upper', 'action_ref', 'templates', 'rules', 'lineages', 'motion_types', 'minimums', 'failures', 'events', 'invalid', 'scene_ref'], 'source');
  const prior = object(s.prior, 'prior'), region = object(prior.goal_region, 'prior goal region'), size = point(region.size, 'goal size');
  if (size.some(n => n === 0)) fail('goal size'); mask(region.envelope, size, 'goal envelope');
  integer(prior.request_row, 'request row'); integer(s.epoch, 'epoch'); integer(s.lower, 'lower bound'); integer(s.upper, 'upper bound');
  if (s.lower !== prior.lower_squared || s.upper !== prior.upper_squared || s.action_ref !== prior.action_ref) fail('prior binding');
  string(s.action_ref, 'action reference'); string(s.scene_ref, 'scene reference');
  if (prior.class_templates !== undefined) templates(prior.class_templates);
  if (prior.observed_rules !== undefined) {
    const values = entries(prior.observed_rules, 'prior rules');
    for (const [symbol, value] of values) { palette(Number(symbol)); rule(value); }
  }
  const order = array(s.order, 'order'); if (order.length < 2 || new Set(order).size !== order.length) fail('type order'); order.forEach(palette);
  if (prior.type_order !== undefined) { const oldOrder = array(prior.type_order, 'prior type order'); oldOrder.forEach(palette); if (new Set(oldOrder).size !== oldOrder.length) fail('prior type order'); }
  const requests = array(s.requests, 'requests'); if (!requests.length) fail('empty requests');
  const counts = new Map<number, number>();
  for (const request of requests) {
    object(request, 'request'); const bbox = box(request.bbox, 'request bbox'); palette(request.palette_value);
    if (!order.includes(request.palette_value) || request.rectangular !== true || bbox[2]! - bbox[0]! !== bbox[3]! - bbox[1]!
      || bbox[1]! > prior.request_row || bbox[3]! < prior.request_row) fail('request geometry');
    mask(request.mask, [bbox[2]! - bbox[0]! + 1, bbox[3]! - bbox[1]! + 1], 'request mask');
    counts.set(request.palette_value, (counts.get(request.palette_value) ?? 0) + 1);
  }
  const demands = entries(s.demands, 'demands'); if (!equal(demands, [...counts])) fail('demand counts/order');
  const boxes = array(s.interface_boxes, 'interface boxes'); boxes.forEach(value => box(value, 'interface bbox'));
  if (boxes.length < order.length + requests.length) fail('interface cardinality');
  const ladder = boxes.slice(0, order.length), side = ladder[0][2] - ladder[0][0] + 1;
  if (side < 2) fail('ladder size');
  const pitch = ladder[1][0] - ladder[0][0];
  for (let i = 0; i < ladder.length; i++) {
    const item = ladder[i]; if (item[1] !== ladder[0][1] || item[2] - item[0] + 1 !== side || item[3] - item[1] + 1 !== side
      || (i > 0 && item[0] - ladder[i - 1][0] !== pitch)) fail('ladder geometry');
  }
  if (pitch <= 0 || !equal(boxes.slice(order.length, order.length + requests.length), requests.map(request => request.bbox))) fail('request interface');
  for (const bbox of boxes.slice(order.length + requests.length)) if (bbox[0] !== 0 || bbox[1] !== bbox[3]) fail('separator geometry');
  const zones = array(s.zones, 'zones'); if (!zones.length) fail('empty zones');
  for (const zone of zones) {
    object(zone, 'zone'); const bbox = box(zone.bbox, 'zone bbox'); point(zone.point, 'zone point');
    if (!equal([bbox[2]! - bbox[0]! + 1, bbox[3]! - bbox[1]! + 1], size)
      || !equal(zone.point, [Math.floor((bbox[0]! + bbox[2]!) / 2), Math.floor((bbox[1]! + bbox[3]!) / 2)]) || zone.source_ref !== s.scene_ref) fail('zone binding');
  }
  const knownTemplates = templates(s.templates), rules = entries(s.rules, 'rules');
  for (const [symbol, value] of rules) { palette(symbol); rule(value); if (!order.includes(symbol) || !order.includes(value.product) || value.product === symbol) fail('rewrite type'); }
  const lineages = entries(s.lineages, 'lineages');
  for (const [item, origins] of lineages) { feature(item); if (!order.includes(item[0])) fail('lineage type'); strings(origins, 'lineage origins', true); if (!origins.length) fail('empty lineage'); }
  const motionTypes = array(s.motion_types, 'motion types'); motionTypes.forEach(palette);
  const supported = Object.entries(knownTemplates).filter(([, value]) => value.alignment_supported).map(([symbol]) => Number(symbol)).sort((a, b) => a - b);
  if (!equal(motionTypes, supported)) fail('motion templates');
  const minimums = entries(s.minimums, 'minimums');
  if (minimums.length && !equal(minimums.map(([symbol]) => symbol), demands.map(([symbol]) => symbol))) fail('minimum order');
  for (const [symbol, count] of minimums) { palette(symbol); integer(count, 'minimum count'); if (!counts.has(symbol) || count > counts.get(symbol)!) fail('minimum demand'); }
  const failures = array(s.failures, 'failures'); if (!equal(failures, [...failures].sort(compare)) || new Set(failures.map(key)).size !== failures.length) fail('failure order');
  for (const failure of failures) {
    array(failure, 'failure'); if (failure.length !== 3) fail('failure'); feature(failure[0]); feature(failure[1]); point(failure[2], 'failure locus');
    if (failure[0][0] !== failure[1][0] || !order.includes(failure[0][0]) || equal(failure[0], failure[1])) fail('failure parents');
  }
  for (const event of array(s.events, 'events')) {
    object(event, 'event'); string(event.before, 'event before'); string(event.after, 'event after');
    if (event.kind === 'material_response_unresolved') { integer(event.removed, 'removed count'); integer(event.added, 'added count'); }
    else if (event.kind === 'recalled_rewrite_refuted') { /* Source event has just kind and the two references. */ }
    else if (event.kind === 'typed_material_relocated_to_address' || event.kind === 'observed_joint_material_rewrite') {
      const parents = array(event.parents, 'event parents'); if (parents.length !== (event.kind === 'typed_material_relocated_to_address' ? 1 : 2)) fail('event parent count');
      for (const body of [...parents, object(event.product, 'event product')]) { palette(body.palette); box(body.bbox, 'event bbox'); }
      strings(event.joint_origins, 'event origins', true); if (!event.joint_origins.length || event.conserved_pixel_identity_claimed !== false) fail('event identity');
    } else fail('event kind');
  }
  if (s.invalid !== null) {
    object(s.invalid, 'invalid'); if (!['unselected_material_changed_or_occluded', 'observed_rewrite_context_changed'].includes(s.invalid.reason)) fail('invalid reason');
    string(s.invalid.before, 'invalid before'); string(s.invalid.after, 'invalid after');
  }
  return state;
}
