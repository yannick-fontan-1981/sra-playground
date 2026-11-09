/** Consumed original ObservedMeter and CollectionEvidence caller context.
 * It is checkpointed separately from the inventory family's eight source
 * fields. An indicator is measured before a resource role is hypothesized. */
import { pythonEqual as same, pythonTruthy as truth } from './v6-operations.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { isJsonObject } from './canonical.ts';
import type { NativeRows } from './v6-native-types.ts';
type R = Record<string, any>;
type Key = [string, number, number, string, number];
const clone = <T>(v: T): T => structuredClone(v);
const keyOf = (key: readonly unknown[]): string => JSON.stringify(key);
const tuple = (key: string): Key => JSON.parse(key);
const compare = (a: readonly any[], b: readonly any[]): number => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  return a.length - b.length;
};
const rowsOf = <T>(map: ReadonlyMap<string, T>): [Key, T][] => [...map].map(([k, v]): [Key, T] => [tuple(k), clone(v)]).sort((a, b) => compare(a[0], b[0]));
const mapOf = <T>(rows: readonly [Key, T][]): Map<string, T> => new Map(rows.map(([k, v]) => [keyOf(k), clone(v)]));

export function strips(rows: NativeRows): Map<string, number> {
  const result = new Map<string, number>();
  for (const axis of ['x', 'y']) {
    const lines = axis === 'x' ? rows : rows[0]!.map((_, x) => rows.map(row => row[x]!));
    for (const [line_no, line] of lines.entries()) {
      const runs = new Map<number, [number, number][]>();
      for (let cursor = 0; cursor < line.length;) {
        const start = cursor, value = line[cursor]!; while (cursor < line.length && line[cursor] === value) cursor++;
        const spans = runs.get(value) ?? []; spans.push([start, cursor - start]); runs.set(value, spans);
      }
      for (const [value, spans] of runs) {
        if (spans.length !== 1) continue;
        const [start, length] = spans[0]!;
        result.set(keyOf([axis, line_no, value, 'lo', start]), length);
        result.set(keyOf([axis, line_no, value, 'hi', start + length]), length);
      }
    }
  }
  return result;
}
export function single_line_supports(rows: NativeRows, measured: ReadonlyMap<string, number>): Set<string> {
  const height = rows.length, width = rows[0]!.length, result = new Set<string>();
  for (const [encoded, length] of measured) {
    const [axis, line, color, anchor, edge] = tuple(encoded), extent = axis === 'x' ? height : width;
    if (length < 1 || Math.min(line, extent - 1 - line) > 1) continue;
    const start = anchor === 'lo' ? edge : edge - length, stop = start + length;
    let isolated = true;
    for (const neighbor of [line - 1, line + 1]) if (neighbor >= 0 && neighbor < extent) for (let offset = start; offset < stop; offset++) {
      if ((axis === 'x' ? rows[neighbor]![offset] : rows[offset]![neighbor]) === color) isolated = false;
    }
    if (isolated) result.add(encoded);
  }
  return result;
}
/** Exact consumed two-frame branch of V5's pixel packet + monotonic strip
 * decrease predicate. No intermediate packet or general transition API is claimed. */
export function boundary_strip_decrease(first: NativeRows, second: NativeRows): boolean {
  const changed: number[][] = [], pairs = new Set<string>(), before_values = new Set<number>(), after_values = new Set<number>();
  for (let y = 0; y < first.length; y++) for (let x = 0; x < first[0]!.length; x++) if (first[y]![x] !== second[y]![x]) {
    changed.push([y, x]); const a = first[y]![x]!, b = second[y]![x]!;
    pairs.add(keyOf([a, b])); before_values.add(a); after_values.add(b);
  }
  if (!changed.length || pairs.size !== 1 || [...before_values].some(v => after_values.has(v)) || before_values.size !== 1) return false;
  const source = [...before_values][0]!, frontier = [changed[0]!], component = new Map<string, number[]>();
  while (frontier.length) {
    const [row, col] = frontier.pop()!, key = keyOf([row, col]);
    if (component.has(key) || first[row!]![col!] !== source) continue;
    component.set(key, [row!, col!]);
    for (const [y, x] of [[row! - 1, col!], [row! + 1, col!], [row!, col! - 1], [row!, col! + 1]]) {
      if (y! >= 0 && y! < first.length && x! >= 0 && x! < first[0]!.length && !component.has(keyOf([y, x]))) frontier.push([y!, x!]);
    }
  }
  if (changed.some(p => !component.has(keyOf(p)) || second[p[0]!]![p[1]!] === source)) return false;
  const points = [...component.values()], top = Math.min(...points.map(p => p[0]!)), bottom = Math.max(...points.map(p => p[0]!));
  const left = Math.min(...points.map(p => p[1]!)), right = Math.max(...points.map(p => p[1]!));
  const width = right - left + 1, height = bottom - top + 1;
  const gap = width > height ? Math.min(top, first.length - 1 - bottom) : height > width ? Math.min(left, first[0]!.length - 1 - right) : -1;
  return gap >= 0 && gap < 2 && points.some(([y, x]) => second[y!]![x!] === source);
}

export class ObservedMeter {
  epoch: number | null = null;
  recent: [string, Map<string, number>][] = [];
  hypotheses = new Map<string, [number, string, number]>();
  peaks = new Map<string, number>();
  last_ref: string | null = null;
  previous_rows: NativeRows | null = null;
  single_line_evidence = new Map<string, string[]>();
  recent_steps: (number | null)[] = [];
  last_step_index: number | null = null;
  state(): R { return { epoch: this.epoch, recent: this.recent.map(([ref, m]) => [ref, rowsOf(m)]), hypotheses: rowsOf(this.hypotheses), peaks: rowsOf(this.peaks),
    last_ref: this.last_ref, previous_rows: clone(this.previous_rows), single_line_evidence: rowsOf(this.single_line_evidence), recent_steps: [...this.recent_steps], last_step_index: this.last_step_index }; }
  restore(value: R): void {
    const v = retainNativeJson(value);
    if (Object.keys(v).length !== 9 || !['recent', 'hypotheses', 'peaks', 'single_line_evidence', 'recent_steps'].every(k => Array.isArray(v[k]))
      || v.recent.length > 5 || v.recent_steps.length !== v.recent.length) throw new TypeError('Invalid observed meter checkpoint');
    this.epoch = v.epoch; this.recent = v.recent.map(([ref, rows]: any[]) => [ref, mapOf(rows)]);
    this.hypotheses = mapOf(v.hypotheses); this.peaks = mapOf(v.peaks); this.single_line_evidence = mapOf(v.single_line_evidence);
    this.last_ref = v.last_ref; this.previous_rows = clone(v.previous_rows); this.recent_steps = [...v.recent_steps]; this.last_step_index = v.last_step_index;
  }
  observe(epoch: number, ref: string, rows: NativeRows, primitive_index: number | null = null): void {
    if (epoch !== this.epoch) { this.restore(new ObservedMeter().state()); this.epoch = epoch; }
    if (ref === this.last_ref) return;
    const elapsed = Number.isSafeInteger(primitive_index) && Number.isSafeInteger(this.last_step_index) ? primitive_index! - this.last_step_index! : null;
    const measured = strips(rows), thin = single_line_supports(rows, measured), previous = this.recent.at(-1)?.[1] ?? new Map<string, number>();
    const discover = [...thin].filter(k => !this.single_line_evidence.has(k) && (previous.get(k) ?? 0) > measured.get(k)!);
    if (discover.length && this.previous_rows !== null) for (const encoded of discover) {
      const [axis, line] = tuple(encoded);
      const band = (frame: NativeRows): NativeRows => axis === 'x' ? frame.slice(Math.max(0, line - 1), line + 2) : frame.map(row => row.slice(Math.max(0, line - 1), line + 2));
      if (boundary_strip_decrease(band(this.previous_rows), band(rows))) this.single_line_evidence.set(encoded, [this.last_ref!, ref]);
    }
    this.previous_rows = clone(rows); this.recent.push([ref, measured]); this.recent = this.recent.slice(-5);
    this.recent_steps.push(primitive_index); this.recent_steps = this.recent_steps.slice(-5); this.last_step_index = primitive_index; this.last_ref = ref;
    for (const [encoded, [rate, , old]] of [...this.hypotheses]) {
      const value = measured.get(encoded) ?? 0, [axis, line, color, anchor, edge] = tuple(encoded), neighbor = keyOf([axis, line + 1, color, anchor, edge]);
      const supported = measured.get(neighbor) === value || this.single_line_evidence.has(encoded) && thin.has(encoded), gain = value > old && supported;
      const single = measured.get(neighbor) !== value && this.single_line_evidence.has(encoded), interval = single ? elapsed : 1;
      if (single && (interval === null || interval <= 0 || !supported) || value !== old - rate * interval! && !gain) this.hypotheses.delete(encoded);
      else { this.hypotheses.set(encoded, [rate, ref, value]); this.peaks.set(encoded, Math.max(value, this.peaks.get(encoded) ?? 0)); }
    }
    if (this.recent.length < 5) return;
    for (const [encoded, value] of measured) {
      const [axis, line, color, anchor, edge] = tuple(encoded), neighbor = keyOf([axis, line + 1, color, anchor, edge]);
      if (measured.get(neighbor) !== value && !(this.single_line_evidence.has(encoded) && thin.has(encoded))) continue;
      const lengths = this.recent.map(([, m]) => m.get(encoded) ?? 0); let rate = lengths[0]! - lengths[1]!;
      const parallel = this.recent.every(([, m], i) => (m.get(neighbor) ?? 0) === lengths[i]);
      const supported_single = this.single_line_evidence.has(encoded) && thin.has(encoded);
      let uniform = rate > 0 && lengths.slice(1).every((v, i) => lengths[i]! - v === rate) && parallel;
      if (supported_single && !parallel && this.recent_steps.every(Number.isSafeInteger)) {
        const gaps = this.recent_steps.slice(1).map((b, i) => b! - this.recent_steps[i]!), differences = lengths.slice(1).map((b, i) => lengths[i]! - b);
        if (gaps.every((gap, i) => gap > 0 && differences[i]! > 0 && differences[i]! % gap === 0)) {
          const rates = new Set(differences.map((diff, i) => diff / gaps[i]!)); uniform = rates.size === 1; if (uniform) rate = [...rates][0]!;
        }
      }
      if (uniform) { this.hypotheses.set(encoded, [rate, ref, value]); this.peaks.set(encoded, Math.max(lengths[0]!, this.peaks.get(encoded) ?? 0)); }
    }
  }
  forecast(): R | null {
    const forecasts = new Set([...this.hypotheses.values()].map(([rate, , value]) => Math.floor(value / rate)));
    if (forecasts.size !== 1) return null;
    const key = [...this.hypotheses.keys()].sort((a, b) => compare(tuple(a), tuple(b)))[0]!, [rate, ref, value] = this.hypotheses.get(key)!;
    return { steps_before_empty: [...forecasts][0], current_units: value, loss_per_step: rate, capacity_steps: Math.floor(this.peaks.get(key)! / rate),
      capacity_status: 'largest_measured_value', measured_strip: tuple(key), observation_ref: ref, level_epoch: this.epoch, qualification: 'provisional_constant_loss_until_a_measured_change' };
  }
}

const intersects = (a: readonly number[], b: readonly number[]): boolean => a[0]! <= b[2]! && b[0]! <= a[2]! && a[1]! <= b[3]! && b[1]! <= a[3]!;
const encloses = (a: readonly number[], b: readonly number[]): boolean => a[0]! <= b[0]! && b[0]! <= b[2]! && b[2]! <= a[2]! && a[1]! <= b[1]! && b[1]! <= b[3]! && b[3]! <= a[3]!;
export function participant(obs: R, refs: readonly string[]): number[] | null {
  const visible = new Map<string, R>(obs.entities.filter((r: R) => !truth(r.identity_ambiguous)).map((r: R) => [r.signature, r]));
  if (!refs.length || !refs.every(r => visible.has(r))) return null;
  const boxes = refs.map(r => visible.get(r)!.bbox);
  return [Math.min(...boxes.map(b => b[0])), Math.min(...boxes.map(b => b[1])), Math.max(...boxes.map(b => b[2])), Math.max(...boxes.map(b => b[3]))];
}
export function anchored(before: R, after: R): boolean {
  const exact = (obs: R): Set<string> => new Set(obs.entities.filter((r: R) => !truth(r.identity_ambiguous)).map((r: R) => keyOf([r.signature, ...r.bbox])));
  const second = exact(after), stable = [...new Set([...exact(before)].filter(key => second.has(key)).map(key => keyOf(JSON.parse(key).slice(1, 3))))].map(key => JSON.parse(key) as number[]).sort(compare);
  if (stable.length < 3) return false; const [a, b, ...rest] = stable;
  return rest.some(([x, y]) => (b![0]! - a![0]!) * (y! - a![1]!) !== (b![1]! - a![1]!) * (x! - a![0]!));
}
export class CollectionEvidence {
  pending: R = {}; history: R = {};
  apply_event(event: R): void {
    const uid = event.id; if (Object.hasOwn(this.history, uid)) return;
    this.history[uid] = clone(event); if (event.kind === 'gain_on_entry') this.pending[uid] = clone(event);
    if (Object.hasOwn(event, 'entry_id')) delete this.pending[event.entry_id];
  }
  retained_state(): R { return { events: clone(Object.values(this.history)) }; }
  restore(value: R): void {
    const state = retainNativeJson(value);
    if (!isJsonObject(state) || Object.keys(state).length !== 1 || !Array.isArray(state.events) || !state.events.every(isJsonObject)) throw new TypeError('Invalid collection checkpoint');
    const staged = new CollectionEvidence(); for (const event of state.events) staged.apply_event(event);
    this.pending = staged.pending; this.history = staged.history;
  }
  evidence_for(signature: string): R {
    const confirmed = Object.values(this.history).filter((e: R) => e.kind === 'disappearance_confirmed' && e.signature === signature) as R[];
    const rivals = Object.values(this.history).filter((e: R) => e.kind === 'occurrence_persisted' && e.signature === signature) as R[];
    const sites = new Set(confirmed.map(e => keyOf([e.epoch, e.bbox])));
    return { signature, role: sites.size ? 'observed_candidate_refill' : 'unconfirmed', independent_sites: sites.size,
      confirmed: confirmed.map(e => e.id), counterexamples: rivals.map(e => e.id), pending: Object.values(this.pending).filter((e: R) => e.signature === signature).map((e: R) => e.id),
      scope: 'current location/state must be revalidated; compatible appearance alone does not prove a gain' };
  }
  observe(before: R, after: R, first: NativeRows, second: NativeRows, command: R | string, meter_before: R | null, mover: R | null): R[] {
    const events: R[] = [], epoch = before.level_epoch, ref = after.observation_ref;
    const compatible = epoch === after.level_epoch && before.levels_completed === after.levels_completed;
    if (!compatible) {
      for (const [key, p] of Object.entries(this.pending) as [string, R][]) events.push({ kind: 'scope_ended', id: ref + '/scope/' + key, entry_id: key, epoch: p.epoch });
    } else {
      const control = mover || {}, refs = control.role_refs ?? [], old = participant(before, refs), next = participant(after, refs);
      const cmd = typeof command === 'string' ? command : command.action_ref, directions = control.moves ?? {}, declared = directions[cmd] ?? null;
      const delta = old && next ? [next[0]! - old[0]!, next[1]! - old[1]!] : null;
      const measured = Object.values(directions) as number[][], lattice = new Set([...measured, ...measured.map(([x, y]) => [-x!, -y!])].map(keyOf));
      const motion_ok = delta !== null && (declared !== null ? same(declared, delta) : lattice.has(keyOf(delta)));
      const local = Boolean(old && next && !same(delta, [0, 0]) && motion_ok && same([next[2]! - old[2]!, next[3]! - old[3]!], delta) && anchored(before, after));
      for (const [key, p] of Object.entries(this.pending) as [string, R][]) {
        if (p.epoch !== epoch) continue;
        const old_pending = participant(before, p.role_refs), new_pending = participant(after, p.role_refs);
        if (!new_pending || intersects(new_pending, p.bbox)) continue;
        let kind: string;
        if (!local || !old_pending || !intersects(old_pending, p.bbox) || !same([...new Set(refs)].sort(), [...new Set(p.role_refs)].sort())) kind = 'ambiguous_departure';
        else kind = p.occupied_pixels.every(([x, y]: number[]) => second[y!]![x!] !== p.palette_value) ? 'disappearance_confirmed' : 'occurrence_persisted';
        events.push({ kind, id: ref + '/' + kind + '/' + key, entry_id: key, epoch, bbox: p.bbox, signature: p.signature,
          uncovered_observation: ref, meter_change: p.meter_after - p.meter_before });
      }
      if (truth(meter_before) && meter_before!.observation_ref === before.observation_ref && meter_before!.level_epoch === epoch) {
        const strip = meter_before!.measured_strip as Key, [axis, line, color, edge, anchor] = strip, adjacent = [axis, line + 1, color, edge, anchor];
        const pre = strips(first), post = strips(second), encoded = keyOf(strip), adjacent_key = keyOf(adjacent), units = meter_before!.current_units, gain = post.get(encoded) ?? 0;
        const paired = (pre.get(encoded) ?? 0) === units && (pre.get(adjacent_key) ?? 0) === units && (post.get(adjacent_key) ?? 0) === gain;
        const single = (pre.get(encoded) ?? 0) === units && single_line_supports(first, pre).has(encoded) && single_line_supports(second, post).has(encoded);
        if ((paired || single) && gain > units) {
          let contact = control.contact_cell_bbox ?? null;
          if (!(truth(contact) && control.observation_ref === before.observation_ref && control.level_epoch === epoch && next && encloses(contact, next) && old && !encloses(contact, old))) contact = null;
          let sites: R[] = !local ? [] : before.entities.filter((e: R) => e.palette_value === color && (encloses(next!, e.bbox) || contact && encloses(contact, e.bbox)) && !intersects(old!, e.bbox));
          if (sites.length === 1) {
            const regions = [old!, next!, sites[0]!.bbox], meter_lines = new Set(paired ? [line, line + 1] : [line]); let changed_elsewhere = false;
            for (let y = 0; y < first.length; y++) for (let x = 0; x < first[0]!.length; x++) if (first[y]![x] !== second[y]![x]
              && !meter_lines.has(axis === 'x' ? y : x) && !regions.some(([l, t, r, b]) => l! <= x && x <= r! && t! <= y && y <= b!)) changed_elsewhere = true;
            if (changed_elsewhere) sites = [];
          }
          const ambiguous = !local || sites.length !== 1 || units <= meter_before!.loss_per_step;
          if (ambiguous) events.push({ kind: 'gain_unassigned', id: ref + '/gain_unassigned', epoch,
            reason: !local ? 'unattested_or_nonlocal_arrival' : units <= meter_before!.loss_per_step ? 'meter_depletion_competes' : 'candidate_count_not_one', candidates: sites.length, meter_before: units, meter_after: gain });
          else {
            const site = sites[0]!, [l, t, r, b] = site.bbox, pixels: number[][] = [];
            for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) if (first[y]![x] === color) pixels.push([x, y]);
            events.push({ kind: 'gain_on_entry', id: ref + '/gain_on_entry', epoch, bbox: [...site.bbox], signature: site.signature, palette_value: color,
              occupied_pixels: pixels, meter_before: units, meter_after: gain, measured_strip: [...strip], role_refs: [...refs], before: before.observation_ref, after: ref, delta: [...delta!],
              motion_basis: declared !== null ? 'bound_command_prediction' : 'observed_single_lattice_step', from_xy: old!.slice(0, 2), to_xy: next!.slice(0, 2), other_explanations: ['occlusion', 'coincident_reward'] });
          }
        }
      }
    }
    for (const event of events) this.apply_event(event); return events;
  }
}

export class InventoryCallerContext {
  meter = new ObservedMeter(); collection = new CollectionEvidence();
  state(): R { return { meter: this.meter.state(), collection: this.collection.retained_state() }; }
  restore(value: R): void {
    if (!isJsonObject(value) || Object.keys(value).length !== 2 || !isJsonObject(value.meter) || !isJsonObject(value.collection)) throw new TypeError('Invalid inventory caller context');
    const meter = new ObservedMeter(), collection = new CollectionEvidence(); meter.restore(value.meter); collection.restore(value.collection);
    this.meter = meter; this.collection = collection;
  }
  observePlanning(obs: R, rows: NativeRows): void { this.meter.observe(obs.level_epoch, obs.observation_ref, rows, obs.revision ?? null); }
  record(before: R, after: R, command: R, first: NativeRows, second: NativeRows, proposal: R, index: number): R[] {
    const prior = this.meter.forecast(), role = proposal.morphology?.measured_facts ?? {};
    let mover: R = { role_refs: role.controlled_role_refs ?? [], moves: role.motion_examples ?? {} };
    if (truth(proposal.inventory_plan)) {
      const scene = proposal.inventory_plan.offer.scene;
      mover = { role_refs: [scene.body_signature], moves: Object.fromEntries(Object.entries(scene.controls).filter(([, record]: [string, any]) => !truth(record.contradictions)).map(([key, record]: [string, any]) => [key, record.delta])),
        observation_ref: before.observation_ref, level_epoch: before.level_epoch };
      const cell = scene.grids[0].cells.find((c: R) => same([c.row, c.col], proposal.steps[index].to_cell));
      if (cell) mover.contact_cell_bbox = ['left', 'top', 'right', 'bottom'].map(key => cell.bbox[key]);
    }
    const events = this.collection.observe(before, after, first, second, command, prior, mover);
    return events;
  }
}
