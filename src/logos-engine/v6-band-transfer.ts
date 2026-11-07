/** Complete native transfer of V6 common_band_transfer.py, pinned at 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e. */
import { projection, rowsDigest, v6Digest } from './v6-native-observer.ts';
import type { ObservedInputDomain } from './v6-native-observer.ts';
import type { NativePublicObservation, NativeRows } from './v6-native-types.ts';
export type BandRecord = Record<string, any>;
export interface BandCommand extends BandRecord { action_ref: string; data?: Record<string, number> }
export interface BandObservation extends BandRecord { entities: readonly BandRecord[]; level_epoch: number; levels_completed: number; observation_ref: string; frame_hash: string; state: string }
export type BandSense = 'into_clicked' | 'away_from_clicked';
const keyOf = (value: unknown): string => JSON.stringify(value);
const truthData = (action: BandCommand): boolean => !!action.data && Object.keys(action.data).length > 0;
function same(a: any, b: any): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => same(value, b[i]));
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => Object.hasOwn(b, key) && same(a[key], b[key]));
}
function compare(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return a.length - b.length;
}
const sortSet = <T>(values: Iterable<T>): T[] => [...values].sort((a, b) => keyOf(a) < keyOf(b) ? -1 : keyOf(a) > keyOf(b) ? 1 : 0);
const targetEntries = (targets: Record<string, number>): [number, number][] => Object.entries(targets).map(([i, v]) => [Number(i), v]);

export function measureBandGeometry(observation: BandObservation, rows: NativeRows, inputs: readonly BandCommand[]): BandRecord | null {
  const groups = new Map<number, BandRecord[]>(), boxes = new Map<string, { hue: number; w: number; h: number; entities: BandRecord[] }>();
  for (const entity of observation.entities) {
    if (!groups.has(entity.palette_value)) groups.set(entity.palette_value, []); groups.get(entity.palette_value)!.push(entity);
    if (entity.rectangular) {
      const [x, y, right, bottom] = entity.bbox, key = keyOf([entity.palette_value, right - x + 1, bottom - y + 1]);
      if (!boxes.has(key)) boxes.set(key, { hue: entity.palette_value, w: right - x + 1, h: bottom - y + 1, entities: [] });
      boxes.get(key)!.entities.push(entity);
    }
  }
  const possible: BandRecord[] = [];
  for (const axis of [0, 1]) {
    const pairs: { hue: number; short: number[]; long: number[]; wall: number }[] = [];
    for (const [hue, group] of groups) {
      if (group.length !== 2 || !group.every(entity => entity.rectangular)) continue;
      const [short, long] = group.map(entity => entity.bbox as number[]).sort((a, b) => (a[3 - axis]! - a[1 - axis]!) - (b[3 - axis]! - b[1 - axis]!));
      if (!(short![axis + 2]! - short![axis]! === long![axis + 2]! - long![axis]! && long![axis + 2]! - long![axis]! < short![3 - axis]! - short![1 - axis]!
        && short![3 - axis]! - short![1 - axis]! < long![3 - axis]! - long![1 - axis]!) || short![axis] === long![axis]) continue;
      const [left, top, right, bottom] = short!;
      const depth = axis === 0 ? rows[0]!.length : rows.length;
      if (!(short![axis]! > 0 && short![2 + axis]! + 1 < depth)) continue;
      const first = axis === 0 ? rows.slice(top, bottom! + 1).map(row => row[left! - 1]!) : [...rows[top! - 1]!.slice(left, right! + 1)];
      const second = axis === 0 ? rows.slice(top, bottom! + 1).map(row => row[right! + 1]!) : [...rows[bottom! + 1]!.slice(left, right! + 1)];
      if (new Set(first).size !== 1 || !same(first, second)) continue;
      pairs.push({ hue, short: short!, long: long!, wall: first[0]! });
    }
    if (!pairs.length) continue;
    for (const { w, h, entities } of boxes.values()) {
      if (w !== h || entities.length < 2 || entities.length % 2 || new Set(entities.map(entity => entity.bbox[axis])).size !== 1) continue;
      const buttons = entities.map(entity => entity.bbox as number[]).sort((a, b) => a[1 - axis]! - b[1 - axis]!);
      const gaps = buttons.filter((_, i) => i % 2 === 0).map((box, j) => buttons[2 * j + 1]![1 - axis]! - box[3 - axis]! - 1);
      if (Math.min(...gaps) <= 0 || new Set(gaps).size !== 1) continue;
      const depth = axis === 0 ? rows[0]!.length : rows.length, across = axis === 0 ? rows.length : rows[0]!.length;
      const side = buttons[0]![axis]! + buttons[0]![axis + 2]! >= depth ? -1 : 1;
      const end = side === -1 ? buttons[0]![axis + 2]! : buttons[0]![axis]!;
      const controls: BandCommand[] = [], cuts: number[] = [], probes = new Map<number, number[]>(), adjacent: number[] = [];
      for (let i = 0; i < buttons.length; i++) {
        const box = buttons[i]!;
        const command = inputs.find(action => truthData(action) && box[0]! <= action.data!.x! && action.data!.x! <= box[2]! && box[1]! <= action.data!.y! && action.data!.y! <= box[3]!);
        if (!command) break;
        controls.push(command); const j = Math.floor(i / 2), cross = i % 2 === 0 ? box[1 - axis]! - 1 : box[3 - axis]! + 1;
        if (cross < 0 || cross >= across) break;
        if (!probes.has(j + i % 2)) probes.set(j + i % 2, []); probes.get(j + i % 2)!.push(cross);
        const ray = axis === 0 ? rows[cross]! : rows.map(row => row[cross]!);
        adjacent.push(...ray.slice(box[axis], box[2 + axis]! + 1));
        if (i % 2 === 0) cuts.push((box[3 - axis]! + buttons[i + 1]![1 - axis]!) / 2);
      }
      if (controls.length !== buttons.length || probes.size !== cuts.length + 1) continue;
      const counts = new Map<number, number>(); for (const value of adjacent) counts.set(value, (counts.get(value) ?? 0) + 1);
      const frequency = [...counts].sort((a, b) => b[1] - a[1]);
      if (!frequency.length || frequency.length > 1 && frequency[0]![1] === frequency[1]![1]) continue;
      const targets = new Map<number, number>(), markers: BandRecord[] = []; let ok = true;
      for (const { hue, short: reference, long: mobile } of pairs) {
        const cross = (mobile[1 - axis]! + mobile[3 - axis]!) / 2, index = cuts.filter(cut => cross > cut).length;
        if (targets.has(index)) { ok = false; break; }
        targets.set(index, (reference[axis]! - mobile[axis]!) * side); markers.push({ band: index, color: hue, reference, mobile });
      }
      if (!ok) continue;
      const model: BandRecord = { axis, side, end, fill: frequency[0]![0], probes: [...Array(probes.size)].map((_, i) => probes.get(i)!),
        controls, boxes: buttons, markers, step: w, cuts };
      const q = bandQuantities(rows, model); if (!q.length) continue;
      model.targets = Object.fromEntries([...targets].map(([i, delta]) => [i, q[i]! + delta]));
      if (targetEntries(model.targets).some(([i, value]) => value < 0 || value > depth || (value - q[i]!) % w !== 0)) continue;
      possible.push(model);
    }
  }
  return possible.length === 1 ? possible[0]! : null;
}

export function bandQuantities(rows: NativeRows, model: BandRecord): number[] {
  const result: number[] = [];
  for (const probes of model.probes as number[][]) {
    const lengths: number[] = [];
    for (const cross of probes) {
      const ray = model.axis === 0 ? rows[cross]! : rows.map(row => row[cross]!);
      const span = model.side === 1 ? ray.slice(model.end) : [...ray.slice(0, model.end + 1)].reverse();
      let length = 0; while (length < span.length && span[length] === model.fill) length++;
      lengths.push(length);
    }
    if (new Set(lengths).size !== 1) return [];
    result.push(lengths[0]!);
  }
  return result;
}
export function bandEffect(q: readonly number[], control: number, sense: BandSense | null, unit: number): number[] {
  const edge = Math.floor(control / 2), clicked = edge + control % 2, other = 2 * edge + 1 - clicked;
  const [receiver, donor] = sense === 'into_clicked' ? [clicked, other] : [other, clicked];
  if (q[donor]! < unit) return [...q];
  const state = [...q]; state[donor] = state[donor]! - unit; state[receiver] = state[receiver]! + unit; return state;
}

/** Python heap order is (estimated cost, depth, lexicographic state). */
export function findBandPath(q: readonly number[], targets: Record<string, number>, sense: BandSense, unit: number,
  blocked: Iterable<readonly [readonly number[], number]>, remaining: number): number[] {
  const blockedKeys = new Set([...blocked].map(keyOf));
  const lower = (state: readonly number[]) => Math.floor(Math.max(targetEntries(targets).reduce((sum, [i, value]) => sum + Math.max(0, value - state[i]!), 0),
    targetEntries(targets).reduce((sum, [i, value]) => sum + Math.max(0, state[i]! - value), 0)) / unit);
  type Entry = { estimate: number; depth: number; state: readonly number[] };
  const queue: Entry[] = [{ estimate: lower(q), depth: 0, state: q }], cost = new Map([[keyOf(q), 0]]), came = new Map<string, { previous: readonly number[]; command: number }>();
  const order = (a: Entry, b: Entry) => a.estimate - b.estimate || a.depth - b.depth || compare(a.state, b.state);
  // A binary heap retains the reference A* tie-breaking without quadratic sort.
  const push = (entry: Entry) => { let i = queue.length; queue.push(entry); while (i > 0) { const parent = Math.floor((i - 1) / 2); if (order(queue[parent]!, entry) <= 0) break; queue[i] = queue[parent]!; i = parent; } queue[i] = entry; };
  const pop = (): Entry => {
    const result = queue[0]!, tail = queue.pop()!; if (!queue.length) return result;
    let i = 0; while (i * 2 + 1 < queue.length) { let child = i * 2 + 1; if (child + 1 < queue.length && order(queue[child + 1]!, queue[child]!) < 0) child++; if (order(tail, queue[child]!) <= 0) break; queue[i] = queue[child]!; i = child; } queue[i] = tail; return result;
  };
  while (queue.length) {
    const { depth, state } = pop(); if (depth !== cost.get(keyOf(state))) continue;
    if (lower(state) === 0) {
      const path: number[] = []; let current = state;
      while (!same(current, q)) { const prior = came.get(keyOf(current))!; path.push(prior.command); current = prior.previous; }
      return path.reverse();
    }
    if (depth >= remaining) continue;
    for (let command = 0; command < 2 * (q.length - 1); command++) {
      if (blockedKeys.has(keyOf([state, command]))) continue;
      const next = bandEffect(state, command, sense, unit);
      if (same(next, state) || depth + 1 >= (cost.get(keyOf(next)) ?? remaining + 1)) continue;
      const estimate = depth + 1 + lower(next); if (estimate > remaining) continue;
      cost.set(keyOf(next), depth + 1); came.set(keyOf(next), { previous: state, command }); push({ estimate, depth: depth + 1, state: next });
    }
  }
  return [];
}

export class BandTransfer {
  readonly id = 'band_transfer'; readonly familyId = 'band_transfer';
  epoch: number | null = null; prior: BandSense | null = null; passed: BandRecord[] = []; events: BandRecord[] = [];
  model: BandRecord | null | undefined; sense: BandSense | null = null;
  blocked = new Map<string, readonly [readonly number[], number]>(); supported = new Set<number>(); refs = new Map<number, string>();
  tried = new Map<string, readonly [readonly number[], number]>(); refuted = false; initial: number[] | undefined; first: string | undefined;
  state(): BandRecord {
    const value: BandRecord = { format: 'native.band_transfer.v1', epoch: this.epoch, prior: this.prior, passed: this.passed, events: this.events };
    if (this.model !== undefined) Object.assign(value, { model: this.model, sense: this.sense, blocked: sortSet(this.blocked.values()), supported: [...this.supported].sort((a, b) => a - b),
      refs: [...this.refs], tried: sortSet(this.tried.values()), refuted: this.refuted });
    if (this.initial !== undefined) Object.assign(value, { initial: this.initial, first: this.first });
    return structuredClone(value);
  }
  restore(snapshot: BandRecord): void {
    const value = structuredClone(snapshot);
    if (value.format !== 'native.band_transfer.v1' || !Array.isArray(value.events) || !Array.isArray(value.passed)
      || Object.hasOwn(value, 'model') && (!Array.isArray(value.blocked) || !Array.isArray(value.supported) || !Array.isArray(value.refs) || !Array.isArray(value.tried))) throw new TypeError('Incompatible band-transfer state');
    this.epoch = value.epoch; this.prior = value.prior; this.passed = value.passed; this.events = value.events; this.model = value.model; this.sense = value.sense ?? null;
    this.blocked = new Map((value.blocked ?? []).map((item: any) => [keyOf(item), item])); this.supported = new Set(value.supported ?? []); this.refs = new Map(value.refs ?? []);
    this.tried = new Map((value.tried ?? []).map((item: any) => [keyOf(item), item])); this.refuted = value.refuted ?? false; this.initial = value.initial; this.first = value.first;
  }
  start(observation: BandObservation, rows: NativeRows, inputs: readonly BandCommand[]): void {
    this.epoch = observation.level_epoch; this.model = measureBandGeometry(observation, rows, inputs); this.sense = null; this.blocked.clear(); this.supported.clear(); this.refs.clear(); this.tried.clear(); this.refuted = false;
    if (this.model) { this.initial = bandQuantities(rows, this.model); this.first = observation.observation_ref; }
  }
  async propose(observation: BandObservation, rows: NativeRows, inputs: readonly BandCommand[], remaining: number): Promise<BandRecord | null> {
    if (this.epoch !== observation.level_epoch) this.start(observation, rows, inputs);
    const model = this.model; if (!model || this.refuted) return null;
    let q = bandQuantities(rows, model); if (!q.length) return null;
    for (const marker of model.markers as BandRecord[]) {
      const box = [...marker.mobile], axis = model.axis, delta = model.side * (q[marker.band]! - this.initial![marker.band]!);
      box[axis] += delta; box[2 + axis] += delta;
      if (!projection(rows, box).flat().every(value => value === marker.color) || !projection(rows, marker.reference).flat().every(value => value === marker.color)) return null;
    }
    if (targetEntries(model.targets).every(([i, value]) => q[i] === value)) return null;
    const sense = this.sense ?? this.prior;
    let path = sense ? findBandPath(q, model.targets, sense, model.step, this.blocked.values(), remaining) : [];
    if (!path.length) {
      const fresh = model.controls.map((_: unknown, i: number) => i).filter((i: number) => !this.tried.has(keyOf([q, i])));
      if (!fresh.length) return null; path = [fresh[0]];
    }
    const steps: BandRecord[] = [], start = q;
    for (const command of path.slice(0, Math.min(16, remaining))) {
      const data = model.controls[command]; if (!inputs.some(input => same(input, data))) return null;
      const expected = sense ? bandEffect(q, command, sense, model.step) : null, box = model.boxes[command];
      steps.push({ action: data, control_index: command, quantities: q, expected_after: expected,
        expected_before: { level_epoch: this.epoch, frame_hash: steps.length ? null : observation.frame_hash }, point_digest: await rowsDigest(projection(rows, box)), point_bbox: [...box] });
      if (!this.supported.has(command) || expected === null) break; q = expected;
    }
    const actions = steps.map(step => step.action), refs = [...new Set([observation.observation_ref, this.first!, ...this.refs.values()])];
    const focus = `C_band_${(await v6Digest([refs, actions])).slice(0, 16)}`, why = 'Test or compose adjacent changes of measured fill lengths until the mobile accents align with their fixed counterparts.';
    const plan = { lengths: start, constrained_lengths: targetEntries(model.targets).sort(([a], [b]) => a - b), alignment_axis: model.axis, signed_relation: sense,
      quantum: model.step, participants: model.markers, control_pairs: model.controls.length / 2, full_conditional_length: path.length,
      scope: 'Transferred visible extent and marker alignment remain conditional until observed.' };
    const facts = { fixed_and_mobile_marker_candidates: true, band_samples_bound: true, addressed_witnesses: true };
    return { status: 'proposed', kind: 'aligned_band_transfers', band_plan: plan, actions, steps, facts,
      compositions: [{ id: focus, role: 'information_question', observed: false, open_question: why, properties: plan, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: why, hypothesis_refs: refs }, route_refs: refs, binding: { observation_ref: observation.observation_ref, level_epoch: this.epoch, levels_completed: observation.levels_completed },
      bundle_template: { operation_key: 'OP18', composition_ref: focus, objective_ref: 'G_official_completion', preserve_refs: [], purpose: why, preconditions: facts, evidence: refs, actions,
        outcome_guard: { path: ['value'], contains: focus } } };
  }
  bind(proposal: BandRecord, domain: ObservedInputDomain): void {
    const frame = proposal.steps[0].expected_before.frame_hash;
    for (const step of proposal.steps) { const data = step.action.data, binding = domain.bindings.get(`${this.epoch}:${frame}`)?.get(`${data.x},${data.y}`);
      if (!binding) throw new TypeError('Band actuator has no current sampled witness');
      step.point_binding = { ...binding, projection_bbox: step.point_bbox, projected_rows_digest: step.point_digest }; }
  }
  async before(proposal: BandRecord, index: number, publicPacket: NativePublicObservation, observation: BandObservation): Promise<BandRecord> {
    const step = proposal.steps[index], bound = proposal.binding;
    const ok = publicPacket.level === bound.level_epoch && publicPacket.levels_completed === bound.levels_completed && (index !== 0 || bound.observation_ref === observation.observation_ref)
      && publicPacket.available_action_refs.includes(step.action.action_ref) && same(bandQuantities(publicPacket.frame_rows, this.model!), step.quantities)
      && await rowsDigest(projection(publicPacket.frame_rows, step.point_bbox)) === step.point_digest;
    return { admitted: !!ok, reason: 'bind_current_band_lengths_and_local_actuator' };
  }
  after(proposal: BandRecord, index: number, before: BandObservation, after: BandObservation, _first: NativeRows, second: NativeRows): BandRecord {
    if (!same([before.level_epoch, before.state, before.levels_completed], [after.level_epoch, after.state, after.levels_completed])) return { matched: null, seal_prefix: true, reason: 'official_boundary' };
    const prediction = proposal.steps[index].expected_after, matched = prediction !== null ? same(bandQuantities(second, this.model!), prediction) : null;
    return { matched, seal_prefix: matched !== true || index + 1 === proposal.steps.length, reason: 'compare_measured_band_vector' };
  }
  record(before: BandObservation, after: BandObservation, _command: BandCommand, _first: NativeRows, second: NativeRows, proposal: BandRecord, index: number): BandRecord {
    const step = proposal.steps[index], ref = after.observation_ref, control = step.control_index as number, old = step.quantities as number[];
    const event: BandRecord = { ref, control, before: old };
    if (after.levels_completed > before.levels_completed) { this.prior = this.sense; this.passed.push({ score: after.levels_completed, ref, hypothesis: this.sense }); return { ...event, status: 'official_boundary' }; }
    const next = bandQuantities(second, this.model!), trial = [old, control] as const; this.tried.set(keyOf(trial), trial);
    const fits = (['into_clicked', 'away_from_clicked'] as const).filter(value => !same(next, old) && same(bandEffect(old, control, value, this.model!.step), next));
    if (fits.length === 1) {
      if (this.sense && this.sense !== fits[0]) this.refuted = true;
      else { this.sense = fits[0]!; this.supported.add(control); this.refs.set(control, ref); }
    } else if (same(next, old)) this.blocked.set(keyOf(trial), trial);
    else this.refuted = true;
    Object.assign(event, { after: next, status: this.refuted ? 'refuted' : 'observed_band_response', signed_relation: this.sense }); this.events.push(event); return event;
  }
}
