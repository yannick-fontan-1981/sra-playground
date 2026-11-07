/** Complete native transfer of V6 common_slot_substitution.py at 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e. */
import { projection, rowsDigest, v6Digest } from './v6-native-observer.ts';
import type { ObservedInputDomain } from './v6-native-observer.ts';
import type { NativePublicObservation, NativeRows } from './v6-native-types.ts';
export type SlotRecord = Record<string, any>;
export interface SlotCommand extends SlotRecord { action_ref: string; data?: Record<string, number> }
export interface SlotObservation extends SlotRecord { entities: readonly SlotRecord[]; level_epoch: number; levels_completed: number; observation_ref: string; frame_hash: string; state: string }
export type SlotState = readonly [available: readonly boolean[], contents: readonly (number | null)[], selected: number | null];
const keyOf = (value: unknown) => JSON.stringify(value);
const addressed = (action: SlotCommand) => !!action.data && Object.keys(action.data).length > 0;
function same(a: any, b: any): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => same(value, b[i]));
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => Object.hasOwn(b, key) && same(a[key], b[key]));
}
function compare(a: readonly number[], b: readonly number[]): number { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!; return a.length - b.length; }
const multiset = (values: readonly number[]) => { const counts = new Map<number, number>(); for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1); return [...counts].sort(([a], [b]) => a - b); };

export function slotBoundary(rows: NativeRows, box: readonly number[]): number[] {
  const [x, y, right, bottom] = box;
  if (Math.min(x!, y!) < 1 || bottom! + 1 >= rows.length || right! + 1 >= rows[0]!.length) return [];
  return [...rows[y! - 1]!.slice(x! - 1, right! + 2), ...rows[bottom! + 1]!.slice(x! - 1, right! + 2),
    ...rows.slice(y, bottom! + 1).map(row => row[x! - 1]!), ...rows.slice(y, bottom! + 1).map(row => row[right! + 1]!)];
}

export function measureSlotLayout(observation: SlotObservation, rows: NativeRows): SlotRecord | null {
  type Group = { row: number; width: number; entities: SlotRecord[] };
  const frames = new Map<string, Group>(), tokens = new Map<string, Group>();
  for (const entity of observation.entities) {
    const [left, top, right, bottom] = entity.bbox, width = right - left + 1, height = bottom - top + 1;
    if (width !== height) continue;
    const key = keyOf([top, width]);
    if (entity.rectangular) { if (!tokens.has(key)) tokens.set(key, { row: top, width, entities: [] }); tokens.get(key)!.entities.push(entity); continue; }
    if (width >= 3 && entity.area === 4 * (width - 1)) {
      const cut = projection(rows, entity.bbox);
      if (cut.every((row, y) => row.every((value, x) => x > 0 && x < width - 1 && y > 0 && y < height - 1 || value === entity.palette_value))) {
        if (!frames.has(key)) frames.set(key, { row: top, width, entities: [] }); frames.get(key)!.entities.push(entity);
      }
    }
  }
  const matches: { word: number[]; inventory: SlotRecord[]; upper: number; lower: number; tokenSize: number }[] = [];
  for (const reference of frames.values()) {
    const word = [...reference.entities].sort((a, b) => a.bbox[0] - b.bbox[0]).map(entity => entity.palette_value as number);
    if (new Set(word).size < 2) continue;
    for (const tokensAt of tokens.values()) {
      if (reference.row === tokensAt.row || !word.every(value => tokensAt.entities.some(entity => entity.palette_value === value))) continue;
      const inventory = [...tokensAt.entities].sort((a, b) => a.bbox[0] - b.bbox[0]);
      if (!same(multiset(inventory.map(entity => entity.palette_value)), multiset(word))) continue;
      matches.push({ word, inventory, upper: reference.row, lower: tokensAt.row, tokenSize: tokensAt.width });
    }
  }
  if (matches.length !== 1) return null;
  const { word, inventory, upper, lower, tokenSize } = matches[0]!, groups = new Map<number, { boxes: number[][]; background: number }>();
  for (const entity of observation.entities) {
    const [left, top, right, bottom] = entity.bbox, width = right - left + 1, height = bottom - top + 1;
    if (!(Math.min(upper, lower) < top && top < bottom && bottom < Math.max(upper, lower)) || !(width > height && height > tokenSize) || entity.area * 2 < width * height) continue;
    const upperEdge = rows[top - 1]!.slice(left, right + 1), lowerEdge = rows[bottom + 1]!.slice(left, right + 1), counts = new Map<number, number>();
    for (const value of upperEdge) counts.set(value, (counts.get(value) ?? 0) + 1);
    const [rim, n] = [...counts].sort((a, b) => b[1] - a[1])[0]!;
    if (2 * n <= width || 2 * lowerEdge.filter(value => value === rim).length <= width || rim === entity.palette_value) continue;
    const candidates: number[][][] = [];
    for (const token of tokens.values()) {
      if (!(top < token.row && token.row < bottom && token.width < tokenSize)) continue;
      const cells = token.entities.map(cell => cell.bbox as number[]).filter(box => left < box[0]! && box[2]! < right && box[3]! < bottom).sort(compare);
      if (cells.length >= 2 && new Set(cells.slice(1).map((q, i) => q[0]! - cells[i]![0]!)).size === 1) candidates.push(cells);
    }
    if (candidates.length !== 1) continue;
    if (groups.has(rim)) return null;
    groups.set(rim, { boxes: candidates[0]!, background: entity.palette_value });
  }
  if (!groups.size) return null;
  const links = new Set<number>(), nodes = new Map<number, (readonly ['call', number] | readonly ['slot', number[]])[]>();
  for (const [label, group] of groups) {
    const cells: (readonly ['call', number] | readonly ['slot', number[]])[] = [];
    for (const box of group.boxes) {
      const edge = new Set(slotBoundary(rows, box)), target = edge.size === 1 ? [...edge][0]! : null;
      if (target !== group.background && target !== null && groups.has(target)) { links.add(target); cells.push(['call', target]); }
      else cells.push(['slot', [...box]]);
    }
    nodes.set(label, cells);
  }
  const roots = [...groups.keys()].filter(label => !links.has(label)); if (roots.length !== 1) return null;
  const expand = (label: number, stack: Set<number>): number[][] | null => {
    if (stack.has(label)) return null;
    const result: number[][] = [];
    for (const [operation, argument] of nodes.get(label)!) {
      const child = operation === 'call' ? expand(argument as number, new Set([...stack, label])) : [argument as number[]];
      if (child === null) return null; result.push(...child); if (result.length > word.length) return null;
    }
    return result;
  };
  const sequence = expand(roots[0]!, new Set()); if (!sequence?.length || sequence.length !== word.length) return null;
  const required = new Map<string, { box: number[]; value: number }>();
  for (let i = 0; i < sequence.length; i++) { const box = sequence[i]!, key = keyOf(box), value = word[i]!; if (required.has(key) && required.get(key)!.value !== value) return null; required.set(key, { box, value }); }
  return { targets: [...required.values()].map(item => item.value), slots: [...required.values()].map(item => item.box), word,
    inventory: inventory.map(entity => entity.bbox), hues: inventory.map(entity => entity.palette_value), neutral_borders: inventory.map(entity => slotBoundary(rows, entity.bbox)),
    group_count: groups.size, call_count: [...nodes.values()].flat().filter(([operation]) => operation === 'call').length };
}

export function readSlotState(rows: NativeRows, scene: SlotRecord): SlotState | null {
  const available: boolean[] = [], selected: number[] = [];
  for (let i = 0; i < scene.inventory.length; i++) {
    const box = scene.inventory[i], value = scene.hues[i], base = scene.neutral_borders[i];
    const full = projection(rows, box).flat().every(pixel => pixel === value); available.push(full);
    const edge = slotBoundary(rows, box); if (full && edge.length && new Set(edge).size === 1 && !same(edge, base)) selected.push(i);
  }
  if (selected.length > 1) return null;
  const contents: (number | null)[] = [];
  for (const box of scene.slots) { const values = [...new Set(projection(rows, box).flat())]; if (values.length !== 1) return null; contents.push(scene.word.includes(values[0]) ? values[0]! : null); }
  return [available, contents, selected[0] ?? null];
}
export function slotCommandAt(inputs: readonly SlotCommand[], box: readonly number[]): SlotCommand | null { return inputs.find(action => addressed(action) && box[0]! <= action.data!.x! && action.data!.x! <= box[2]! && box[1]! <= action.data!.y! && action.data!.y! <= box[3]!) ?? null; }

export class SlotSubstitution {
  readonly id = 'slot_substitution'; readonly familyId = 'slot_substitution';
  epoch: number | null = null; passed: SlotRecord[] = []; events: SlotRecord[] = []; scene: SlotRecord | null | undefined;
  tested = new Set<string>(); retired = false; refs = new Map<string, string>(); first: string | undefined;
  state(): SlotRecord { const result: SlotRecord = { format: 'native.slot_substitution.v1', epoch: this.epoch, passed: this.passed, events: this.events };
    if (this.scene !== undefined) Object.assign(result, { scene: this.scene, tested: [...this.tested].sort(), retired: this.retired, refs: [...this.refs], first: this.first }); return structuredClone(result); }
  restore(snapshot: SlotRecord): void {
    const value = structuredClone(snapshot); if (value.format !== 'native.slot_substitution.v1' || !Array.isArray(value.passed) || !Array.isArray(value.events)
      || Object.hasOwn(value, 'scene') && (!Array.isArray(value.tested) || !Array.isArray(value.refs))) throw new TypeError('Incompatible slot-substitution state');
    this.epoch = value.epoch; this.passed = value.passed; this.events = value.events; this.scene = value.scene; this.tested = new Set(value.tested ?? []); this.retired = value.retired ?? false; this.refs = new Map(value.refs ?? []); this.first = value.first;
  }
  async propose(observation: SlotObservation, rows: NativeRows, inputs: readonly SlotCommand[], remaining: number): Promise<SlotRecord | null> {
    const submit = inputs.filter(action => !addressed(action)); if (submit.length !== 1 || !inputs.some(addressed)) return null;
    if (observation.level_epoch !== this.epoch) { this.epoch = observation.level_epoch; this.scene = measureSlotLayout(observation, rows); this.tested.clear(); this.retired = false; this.refs.clear(); this.first = observation.observation_ref; }
    if (!this.scene || this.retired) return null;
    const scene = this.scene, start = readSlotState(rows, scene); if (start === null) return null;
    let current = start; const steps: SlotRecord[] = [];
    for (let count = 0; count < Math.min(remaining, 16); count++) {
      const [available, contents, active] = current, wrong = contents.flatMap((value, i) => value !== scene.targets[i] ? [i] : []);
      if (wrong.some(i => contents[i] !== null)) return null;
      let mode: string, command: SlotCommand | null, predicted: SlotState | null, box: number[] | null;
      if (!wrong.length) { mode = 'submit'; command = submit[0]!; predicted = null; box = null; }
      else {
        const slot = wrong.find(i => active !== null && scene.targets[i] === scene.hues[active]) ?? wrong[0]!, value = scene.targets[slot];
        if (active === null) {
          const source = available.findIndex((present, i) => present && scene.hues[i] === value); if (source === -1) return null;
          mode = 'select'; box = scene.inventory[source]; predicted = [available, contents, source];
        } else if (scene.hues[active] === value) { mode = 'place'; box = scene.slots[slot]; predicted = [available.map((present, i) => present && i !== active), contents.map((old, i) => i === slot ? value : old), null]; }
        else return null;
        command = slotCommandAt(inputs, box!); if (!command) break;
      }
      steps.push({ action: command, operation: mode, state: current, expected_after: predicted, address_box: box ? [...box] : null,
        point_digest: box ? await rowsDigest(projection(rows, box)) : null, expected_before: { level_epoch: this.epoch, frame_hash: steps.length ? null : observation.frame_hash } });
      if (!this.tested.has(mode) || predicted === null) break; current = predicted;
    }
    if (!steps.length) return null;
    const actions = steps.map(step => step.action), refs = [...new Set([observation.observation_ref, this.first!, ...this.refs.values()])];
    const focus = `C_substitution_${(await v6Digest([refs, actions])).slice(0, 16)}`, why = 'Test a transfer into a measured slot of the expanded row, then validate its output sequence.';
    const info = { reference: scene.word, expanded_slot_order: scene.slots, required_values: scene.targets, groups: scene.group_count, typed_references: scene.call_count,
      scope: 'A same-color framed slot may expand its linked row. Output and control remain hypotheses until validation.' };
    const facts = { ordered_shape_correspondence: true, inventory_matches_reference_multiset: true, slot_bindings: true };
    return { status: 'proposed', kind: 'ordered_slot_substitution', slot_plan: info, actions, steps, facts,
      compositions: [{ id: focus, role: 'information_question', observed: false, open_question: why, properties: info, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: why, hypothesis_refs: refs }, route_refs: refs, binding: { observation_ref: observation.observation_ref, level_epoch: this.epoch, levels_completed: observation.levels_completed },
      bundle_template: { operation_key: 'OP18', composition_ref: focus, objective_ref: 'G_official_completion', preserve_refs: [], purpose: why, preconditions: facts, evidence: refs, actions,
        outcome_guard: { path: ['value'], contains: focus } } };
  }
  bind(proposal: SlotRecord, domain: ObservedInputDomain): void { const frame = proposal.steps[0].expected_before.frame_hash; for (const step of proposal.steps) if (step.address_box) {
    const data = step.action.data, binding = domain.bindings.get(`${this.epoch}:${frame}`)?.get(`${data.x},${data.y}`); if (!binding) throw new TypeError('Slot input has no current sampled witness');
    step.point_binding = { ...binding, projection_bbox: step.address_box, projected_rows_digest: step.point_digest }; } }
  before(proposal: SlotRecord, index: number, publicPacket: NativePublicObservation, observation: SlotObservation): SlotRecord {
    const step = proposal.steps[index], bound = proposal.binding, ok = publicPacket.level === bound.level_epoch && publicPacket.levels_completed === bound.levels_completed
      && publicPacket.available_action_refs.includes(step.action.action_ref) && (index !== 0 || bound.observation_ref === observation.observation_ref) && same(readSlotState(publicPacket.frame_rows, this.scene!), step.state);
    return { admitted: !!ok, reason: 'bind_visible_inventory_selection_and_all_occupancies' };
  }
  after(proposal: SlotRecord, index: number, before: SlotObservation, after: SlotObservation, _first: NativeRows, second: NativeRows): SlotRecord {
    if (!same([before.level_epoch, before.state, before.levels_completed], [after.level_epoch, after.state, after.levels_completed])) return { matched: null, seal_prefix: true, reason: 'official_boundary' };
    const predicted = proposal.steps[index].expected_after, matched = predicted ? same(readSlotState(second, this.scene!), predicted) : null;
    return { matched, seal_prefix: matched !== true || index + 1 === proposal.steps.length, reason: 'compare_frozen_selection_transfer' };
  }
  record(before: SlotObservation, after: SlotObservation, _command: SlotCommand, _first: NativeRows, second: NativeRows, proposal: SlotRecord, index: number): SlotRecord {
    const step = proposal.steps[index], mode = step.operation as string, ref = after.observation_ref;
    if (after.levels_completed > before.levels_completed) { this.passed.push({ score: after.levels_completed, ref }); return { status: 'official_boundary', evidence: ref }; }
    const matched = same(readSlotState(second, this.scene!), step.expected_after);
    if (matched) { this.tested.add(mode); this.refs.set(mode, ref); } else this.retired = true;
    const event = { status: matched ? 'matched_bound_operation' : 'operation_refuted', operation: mode, matched, ref }; this.events.push(event); return event;
  }
}
