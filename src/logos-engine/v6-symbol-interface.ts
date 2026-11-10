/** Complete transfer of symbol_transactions/interface.py at pinned V6 786dcf51.
 * Current raster contrasts support revisable methods, not recipe or stock laws.
 * Learning rules and the condition evaluator are supplied by the DRM owner. */
import type { NativeRows } from './v6-native-types.ts';
import { symbolicDigest } from './v6-hash.ts';
import { pythonEqual as same, pythonTruthy as truth } from './v6-operations.ts';
import { revalidate_frame } from './v6-inventory-measurements.ts';
import { frame } from './v6-symbol-transactions-geometry.ts';
import { _components as components, _solid_square as solidSquare, _rectangular_perimeter as rectangularPerimeter,
  measure_diagram_rows as measureDiagramRows, measure_equal_row_pairs as measureEqualRowPairs,
  measure_diagram_transition as measureDiagramTransition } from './v5-symbolic-diagrams.ts';
import { measure_concentric_frames as measureConcentricFrames } from './v5-concentric-frames.ts';

export type R = Record<string, any>;
export type InterfaceHolds = (conditions: readonly R[], facts: R) => boolean;
const copy = <T>(value: T): T => structuredClone(value);
export const digest = symbolicDigest;
export const inside = (point: readonly number[], box: readonly number[]): boolean =>
  box[0]! < point[0]! && point[0]! < box[2]! && box[1]! < point[1]! && point[1]! < box[3]!;
export const signature = (box: R): number[] =>
  [box.value, box.box[2] - box.box[0] + 1, box.box[3] - box.box[1] + 1];
export function pairSignature(pair: readonly R[]): number[] {
  if (pair.length !== 2) throw new TypeError('A symbol interface pair requires exactly two slots');
  const a = pair[0]!, b = pair[1]!;
  return [a.outer, a.width, a.height, b.outer, b.width, b.height,
    b.point[0] - a.point[0], b.point[1] - a.point[1]];
}
export const at = (glyphs: R[], point: readonly number[]): R[] => glyphs.filter(g => same(g.point, point));
export const countInside = (glyphs: R[], box: readonly number[]): number => glyphs.filter(g => inside(g.point, box)).length;
const unique = <T>(values: T[]): T[] => [...new Map(values.map(value => [digest(value), value])).values()];
function counts(values: readonly number[]): Map<number, number> {
  const result = new Map<number, number>();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
}
function missingValues(required: readonly number[], loaded: readonly number[]): number[] {
  const left = counts(required), right = counts(loaded);
  return [...left].filter(([value, n]) => n > (right.get(value) ?? 0)).map(([value]) => value);
}
function sameCounter(a: readonly number[], b: readonly number[]): boolean {
  const left = counts(a), right = counts(b);
  return left.size === right.size && [...left].every(([value, n]) => right.get(value) === n);
}
function perimeter(box: readonly number[], predicate: (x: number, y: number) => boolean): boolean {
  for (let y = box[1]!; y <= box[3]!; y++) for (let x = box[0]!; x <= box[2]!; x++) {
    if ((y === box[1] || y === box[3] || x === box[0] || x === box[2]) && !predicate(x, y)) return false;
  }
  return true;
}

export function scene(rows: NativeRows, config: R): R {
  const f = frame(rows), parts = components(f), diagrams = measureDiagramRows(f);
  const extents = new Set(diagrams.map((r: R) => r.symbol_extent));
  const glyphs: R[] = [], containers: R[] = [];
  for (const component of parts) {
    const b = component.bbox, point = [Math.floor((b.left + b.right) / 2), Math.floor((b.top + b.bottom) / 2)];
    const box = [b.left, b.top, b.right, b.bottom];
    if (b.height === b.width && extents.has(b.height) && (solidSquare(component) || rectangularPerimeter(component))) {
      glyphs.push({ point, value: component.value, size: b.height, solid: solidSquare(component), box });
    }
    if (Math.min(b.height, b.width) > 1 && perimeter(box, (x, y) => rows[y]![x] === component.value)) {
      containers.push({ value: component.value, box });
    }
  }
  const rects = measureConcentricFrames(f);
  const tight = rects.filter((r: R) => r.outer_value === config.palette_white_value && r.maximum_equal_padding === 1)
    .map((r: R) => ({ point: [r.center[1], r.center[0]], value: rows[r.center[0]]![r.center[1]],
      box: [r.left, r.top, r.right, r.bottom] }));
  const pairs = measureEqualRowPairs(f).map((pair: readonly R[]) => pair.map(r => ({
    point: [r.center[1], r.center[0]], value: rows[r.center[0]]![r.center[1]],
    outer: r.outer_value, width: r.right - r.left + 1, height: r.bottom - r.top + 1,
  })));
  return { glyphs, containers, tight, pairs,
    diagrams: diagrams.map((r: R) => ({ left: [...r.left_values], right: [...r.right_values],
      branch: r.branch_value, size: r.symbol_extent })) };
}

export class Interface {
  config: R;
  holds: InterfaceHolds;
  epoch: any = null;
  samples: R[] = [];
  contrasts: R[] = [];
  methods: R[] = [];
  refutations: R[] = [];
  bound: R | null = null;

  constructor(config: R, holds: InterfaceHolds) { this.config = config; this.holds = holds; }

  scope(epoch: any): void {
    if (!same(this.epoch, epoch)) { this.epoch = epoch; this.samples = []; this.contrasts = []; this.bound = null; }
  }

  remember(sc: R, ref: any): void {
    this.samples.push({ scene: sc, ref }); this.samples = this.samples.slice(-24);
  }

  record(before: R, after: R, command: R, first: NativeRows, second: NativeRows, proposal: R): R | null {
    this.scope(before.level_epoch);
    const a = scene(first, this.config); this.remember(a, before.observation_ref);
    const evidence = [before.observation_ref, after.observation_ref];
    if (!same(before.level_epoch, after.level_epoch)) {
      const method = this.buildMethod(evidence);
      if (method && !this.methods.some(m => m.id === method.id)) { this.methods.push(method); this.methods = this.methods.slice(-8); }
      this.scope(after.level_epoch);
      return { status: method ? 'boundary_method_built' : 'boundary_method_incomplete', method_ref: method ? method.id : null };
    }
    const b = scene(second, this.config); this.remember(b, after.observation_ref);
    const data = Object.hasOwn(command, 'data') ? command.data : {};
    if (!same(Object.keys(data).sort(), ['x', 'y'])) return null;
    const point = [data.x, data.y], ga = at(a.glyphs, point), gb = at(b.glyphs, point);
    const selected = a.tight.length === 1 ? a.tight[0] : null;
    const beforeTight = new Set(a.tight.map((x: R) => digest(x.point)));
    const afterTight = new Set(b.tight.map((x: R) => digest(x.point)));
    const pair = a.pairs.find((p: R[]) => p.some(s => same(s.point, point))) ?? null;
    const facts: R = {
      clicked_solid_preserved_and_tight_added: ga.length === 1 && gb.length === 1 && ga[0]!.solid
        && same(ga[0], gb[0]) && afterTight.has(digest(point)) && !beforeTight.has(digest(point)),
      selection_cleared_clicked_pair_takes_value: selected !== null && pair !== null && b.tight.length === 0
        && gb.length === 1 && gb[0]!.solid && gb[0]!.value === selected.value && (ga.length !== 1 || ga[0]!.value !== gb[0]!.value),
      diagram_transition_count: measureDiagramTransition(frame(first), frame(second)),
      selection_cleared_matching_hollow_filled: selected !== null && b.tight.length === 0
        && ga.length === 1 && gb.length === 1 && !ga[0]!.solid && gb[0]!.solid
        && ga[0]!.value === gb[0]!.value && gb[0]!.value === selected.value,
    };
    let accepted: string[] = [];
    for (const rule of this.config.interface_learning_rules) {
      if (!this.holds(rule.all_conditions, facts)) continue;
      const kind = rule.static_facts.interface_effect;
      const event: R = { kind, evidence, scope: before.level_epoch, action_ref: command.action_ref,
        point, glyph_before: ga, glyph_after: gb, selected_before: selected, pair, facts };
      if (kind === 'transform') event.transform_pairs = a.pairs.filter((p: R[]) =>
        a.diagrams.some((r: R) => same(p.map(x => x.value), r.left))
        && b.pairs.some((q: R[]) => same(q.map(x => x.point), p.map(x => x.point)) && new Set(q.map(x => x.value)).size === 1));
      this.contrasts.push(event); accepted.push(kind);
    }
    this.contrasts = this.contrasts.slice(-32);
    const method = (proposal.symbol_transaction_plan ?? {}).interface_offer;
    if (truth(method)) {
      const previous = this.bound && same(this.bound.epoch, before.level_epoch) && this.bound.method_ref === method.method_ref
        ? this.bound : {};
      this.bound = { epoch: before.level_epoch, method_ref: method.method_ref, source: copy(method.current_source),
        receiver: copy(method.current_receiver), receipt_overlays: copy(previous.receipt_overlays ?? []), evidence };
      const box = method.current_receiver.box, ignore = method.expected_effect === 'receive' ? point : null;
      const oldRequests = a.glyphs.filter((g: R) => inside(g.point, box) && !same(g.point, ignore));
      const newRequests = b.glyphs.filter((g: R) => inside(g.point, box) && !same(g.point, ignore));
      // Source records the contrast first. A preservation failure clears the
      // returned acceptance, but does not remove that historical contrast.
      if (!same(oldRequests, newRequests)) accepted = [];
      if (accepted.includes('receive')) {
        const additions = b.containers.filter((c: R) => {
          if (a.containers.some((old: R) => same(old, c)) || !inside(point, c.box)
              || !(box[0] <= c.box[0] && c.box[0] <= c.box[2] && c.box[2] <= box[2]
                && box[1] <= c.box[1] && c.box[1] <= c.box[3] && c.box[3] <= box[3])) return false;
          for (let y = c.box[1]; y <= c.box[3]; y++) for (let x = c.box[0]; x <= c.box[2]; x++) {
            // This is deliberately the PARENT perimeter test from Python.
            if ((x === box[0] || x === box[2] || y === box[1] || y === box[3]) && first[y]![x] !== second[y]![x]) return true;
          }
          return false;
        });
        if (additions.length === 1) {
          const overlay = { container: copy(additions[0]), point, glyph: copy(gb[0]), evidence,
            status: 'new_perimeter_after_confirmed_receipt; hidden_parent_pixels_unknown' };
          this.bound.receipt_overlays = [...this.bound.receipt_overlays, overlay].slice(-8);
        }
      }
    }
    if (truth(method) && !accepted.includes(method.expected_effect)) {
      this.refutations.push({ method_ref: method.method_ref, epoch: before.level_epoch, evidence,
        reason: 'predicted_current_interface_contrast_absent', expected: method.expected_effect, observed: accepted });
      this.refutations = this.refutations.slice(-32);
    }
    return { status: 'interface_contrasts', kinds: accepted, evidence, facts };
  }

  buildMethod(boundary: any[]): R | null {
    const byKind = new Map<string, R[]>((this.config.interface_required_effects as string[])
      .map(kind => [kind, this.contrasts.filter(e => e.kind === kind)]));
    if ([...byKind.values()].some(events => events.length === 0)) return null;
    const selected = byKind.get('select')!.map(e => e.point), receipts = byKind.get('receive')!.map(e => e.point);
    const containers = (points: number[][], exclude: number[][]): R[] => {
      const found = new Map<string, R>();
      for (const sample of this.samples) for (const c of sample.scene.containers) {
        if (points.every(p => inside(p, c.box)) && !exclude.some(p => inside(p, c.box))
            && countInside(sample.scene.glyphs, c.box) > 1) found.set(digest(c), c);
      }
      if (!found.size) return [];
      const area = (c: R): number => (c.box[2] - c.box[0] + 1) * (c.box[3] - c.box[1] + 1);
      const size = Math.min(...[...found.values()].map(area));
      return [...found.values()].filter(c => area(c) === size);
    };
    const sources = containers(selected, receipts), sinks = containers(receipts, selected);
    const sourceSigs = unique(sources.map(signature)), sinkSigs = unique(sinks.map(signature));
    const loads = byKind.get('load')!, transforms = byKind.get('transform')!;
    const pairSigs = unique(loads.filter(e => truth(e.pair)).map(e => pairSignature(e.pair)));
    const empty = unique(loads.flatMap(e => e.glyph_before.map((g: R) => g.value)));
    const actions = unique([...byKind.values()].flatMap(events => events.map(e => e.action_ref)));
    if (sourceSigs.length !== 1 || sinkSigs.length !== 1 || pairSigs.length !== 1 || empty.length !== 1 || actions.length !== 1) return null;
    const offsets: number[][] = [];
    for (const event of transforms) {
      if (event.transform_pairs.length !== 1) return null;
      const pair = event.transform_pairs[0];
      offsets.push([0, 1].map(i => 2 * event.point[i] - pair.reduce((n: number, s: R) => n + s.point[i], 0)));
    }
    const uniqueOffsets = unique(offsets); if (uniqueOffsets.length !== 1) return null;
    const payload: R = { source_signature: sourceSigs[0], receiver_signature: sinkSigs[0], pair_signature: pairSigs[0],
      empty_value: empty[0], action_ref: actions[0], activation_offset_twice: uniqueOffsets[0], source_epoch: this.epoch,
      evidence: [...new Set([...byKind.values()].flatMap(events => events.flatMap(e => e.evidence)).concat(boundary))],
      status: 'observed_interface_method_requires_current_revalidation',
      terminal_scope: 'receipt_contribution_and_boundary; not_universal_all_slots_law' };
    const identity = Object.fromEntries(Object.entries(payload).filter(([key]) =>
      !['source_epoch', 'evidence', 'status', 'terminal_scope'].includes(key)));
    return { id: 'symbol_interface:' + digest(identity), ...payload };
  }

  build_method(boundary: any[]): R | null { return this.buildMethod(boundary); }

  options(obs: R, rows: NativeRows, inputs: readonly R[], remaining: number): R[] {
    this.scope(obs.level_epoch);
    const active = this.methods.filter(m => !this.refutations.some(r => r.method_ref === m.id && same(r.epoch, obs.level_epoch)));
    if (!active.length) return [];
    const sc = scene(rows, this.config), offers: R[] = [];
    for (const method of active) {
      let sources = sc.containers.filter((c: R) => same(signature(c), method.source_signature));
      let receivers = sc.containers.filter((c: R) => same(signature(c), method.receiver_signature));
      const pairs = sc.pairs.filter((p: R[]) => same(pairSignature(p), method.pair_signature));
      if (!sources.length && this.bound && same(this.bound.epoch, obs.level_epoch)
          && this.bound.method_ref === method.id && sc.tight.length === 1) {
        const prior = this.bound.source, box = prior.box, overlay = sc.tight[0].box, value = prior.value;
        if (same(signature(prior), method.source_signature) && inside(sc.tight[0].point, box)
            && perimeter(box, (x, y) => rows[y]![x] === value || (overlay[0] <= x && x <= overlay[2]
              && overlay[1] <= y && y <= overlay[3] && rows[y]![x] === this.config.palette_white_value))) sources = [copy(prior)];
      }
      if (!receivers.length && this.bound && same(this.bound.epoch, obs.level_epoch)
          && this.bound.method_ref === method.id && truth(this.bound.receiver)) {
        const prior = this.bound.receiver, overlays: R[] = [];
        for (const record of this.bound.receipt_overlays ?? []) {
          const c = record.container, glyphs = at(sc.glyphs, record.point);
          if (same(glyphs, [record.glyph]) && revalidate_frame({ bbox: c.box, palette_value: c.value, corner_value: c.value }, rows)) overlays.push(record);
        }
        if (overlays.length && same(signature(prior), method.receiver_signature)) {
          const rebound = revalidate_frame({ bbox: prior.box, palette_value: prior.value, corner_value: prior.value },
            rows, overlays.map(r => r.container.box));
          if (rebound) receivers = [{ ...copy(prior), visibility: rebound, occlusion_evidence: copy(overlays),
            binding_evidence: copy(this.bound.evidence),
            inference: 'same recipient region under measured post-receipt perimeter; concealed parent pixels unknown' }];
        }
      }
      if (sources.length !== 1 || receivers.length !== 1 || pairs.length !== 1 || sc.tight.length > 1) continue;
      const source = sources[0], receiver = receivers[0], pair: R[] = pairs[0];
      const inventory: R[] = sc.glyphs.filter((g: R) => inside(g.point, source.box));
      const demands: R[] = sc.glyphs.filter((g: R) => inside(g.point, receiver.box) && !g.solid);
      const selected = sc.tight.length && inside(sc.tight[0].point, source.box) ? sc.tight[0] : null;
      if (sc.tight.length && selected === null) continue;
      const loaded: number[] = pair.filter(s => s.value !== method.empty_value).map(s => s.value);
      const emptySlots = pair.filter(s => s.value === method.empty_value);
      const available = new Set(inventory.filter(g => g.solid).map(g => g.value));
      const needed = new Map<number, number>(demands.map(g => [g.value, 0]));
      for (let depth = 0; depth < this.config.interface_dependency_depth; depth++) for (const row of sc.diagrams) {
        if (row.right.some((value: number) => needed.has(value) && needed.get(value)! <= depth)) {
          for (const value of row.left) if (!needed.has(value)) needed.set(value, depth + 1);
        }
      }
      const useful: R[] = sc.diagrams.filter((r: R) => r.left.length === pair.length
        && r.right.some((value: number) => needed.has(value)) && same(loaded, r.left.slice(0, loaded.length)));
      const add = (kind: string, point: number[], goal: number[], expected: string, row: R | null = null): void => {
        const commands = inputs.filter(action => action.action_ref === method.action_ref && same(action.data, { x: point[0], y: point[1] }));
        const entities = obs.entities.filter((e: R) => e.mask.some(([x, y]: number[]) => x === point[0]! - e.position[0] && y === point[1]! - e.position[1]));
        if (commands.length !== 1 || entities.length !== 1 || remaining < 1) return;
        const depths = (row ?? {}).right?.map((value: number) => needed.get(value) ?? 99) ?? [];
        const facts = { interface_method_current: true, offer_kind: kind, target_y: goal[1], target_x: goal[0],
          source_y: point[1], source_x: point[0], recipe_dependency_depth: depths.length ? Math.min(...depths) : 0,
          selected_present: selected !== null, loaded_count: loaded.length };
        const data = { method_ref: method.id, evidence: method.evidence, expected_effect: expected,
          current_source: source, current_receiver: receiver, current_pair: pair, current_demands: demands,
          displayed_row: row, selected,
          unknown: ['current_effect_requires_sealed_return', 'inventory_exact_multiplicities', 'recipe_generalization_to_untried_row'],
          falsifiers: ['predicted_interface_contrast_absent', 'other_request_changes', 'current_container_or_point_ambiguous', 'scope_changed'] };
        offers.push({ action: commands[0], facts, entities, point_entity: entities[0], interface_offer: data });
      };
      if (selected) {
        for (const demand of demands) if (demand.value === selected.value) add('receive_selected', demand.point, demand.point, 'receive');
        for (const row of useful) if (loaded.length < row.left.length && selected.value === row.left[loaded.length]) {
          for (const slot of emptySlots) add('load_selected', slot.point, slot.point, 'load', row);
        }
      } else {
        for (const row of useful) if (sameCounter(loaded, row.left)) {
          const xy = [0, 1].map(i => pair.reduce((n, s) => n + s.point[i], 0) + method.activation_offset_twice[i]);
          if (xy.every(v => v % 2 === 0)) { const point = xy.map(v => v / 2); add('activate_loaded', point, point, 'transform', row); }
        }
        if (!loaded.length) for (const demand of demands) for (const glyph of inventory) {
          if (glyph.solid && glyph.value === demand.value) add('select_direct', glyph.point, demand.point, 'select');
        }
        for (const row of useful) {
          if (missingValues(row.left, loaded).some(value => !available.has(value))) continue;
          for (const glyph of inventory) if (glyph.solid && loaded.length < row.left.length && glyph.value === row.left[loaded.length]) {
            add('select_operand', glyph.point, glyph.point, 'select', row);
          }
        }
      }
    }
    return offers;
  }

  state(): R {
    return copy({ epoch: this.epoch, samples: this.samples, contrasts: this.contrasts,
      methods: this.methods, refutations: this.refutations, bound: this.bound });
  }

  restore(state: R): void {
    for (const name of ['epoch', 'samples', 'contrasts', 'methods', 'refutations', 'bound'] as const) {
      if (Object.hasOwn(state, name)) (this as unknown as R)[name] = copy(state[name]);
    }
  }
}
