/** Native transfer of V6 coupled_displays.py; repeated public supports only. */
import { pythonEqual, pythonTruthy } from './v6-operations.ts';
import type { NativeBox, NativeRows } from './v6-native-types.ts';

export type CoupledDisplayRecord = Record<string, any>;
export interface CoupledDisplayObservation extends CoupledDisplayRecord { readonly entities: readonly CoupledDisplayRecord[] }
export interface CoupledDisplayCommand { readonly action_ref: string; readonly data?: Readonly<Record<string, number>> }
export interface CoupledDisplayState {
  epoch: number | null;
  controls: NativeBox[];
  receivers: NativeBox[];
  initial_value: number | null;
  history: CoupledDisplayRecord[];
  scored_schema: CoupledDisplayRecord | null;
}
const copy = <T>(value: T): T => structuredClone(value);
function pixel(rows: NativeRows, x: number, y: number): number {
  const row = rows[y < 0 ? rows.length + y : y];
  if (!row) throw new RangeError('Pixel row outside the observed image');
  const value = row[x < 0 ? row.length + x : x];
  if (value === undefined) throw new RangeError('Pixel column outside the observed image');
  return value;
}

export function value(rows: NativeRows, box: NativeBox): number | null {
  const [left, top, right, bottom] = box, values = new Set<number>();
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) values.add(pixel(rows, x, y));
  return values.size === 1 ? values.values().next().value! : null;
}

export function framedRows(observation: CoupledDisplayObservation, rows: NativeRows): NativeBox[][] {
  const groups = new Map<string, NativeBox[]>(), height = rows.length, width = rows[0]!.length;
  for (const entity of observation.entities) {
    const [left, top, right, bottom] = entity.bbox as NativeBox, w = right - left + 1, h = bottom - top + 1;
    if (Math.min(w, h) < 2 || entity.area !== w * h || left < 1 || top < 1 || right + 1 >= width || bottom + 1 >= height) continue;
    const border = new Set<number>();
    for (const y of [top - 1, bottom + 1]) for (let x = left - 1; x <= right + 1; x++) border.add(pixel(rows, x, y));
    for (const x of [left - 1, right + 1]) for (let y = top; y <= bottom; y++) border.add(pixel(rows, x, y));
    if (border.size !== 1 || border.has(entity.palette_value)) continue;
    const key = JSON.stringify([top, w, h]), boxes = groups.get(key) ?? [];
    boxes.push([left, top, right, bottom]); groups.set(key, boxes);
  }
  const complete: NativeBox[][] = [];
  for (const boxes of groups.values()) {
    boxes.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3]);
    if (boxes.length < 2 || boxes.length > 8) continue;
    const first = boxes[0]!, denominator = boxes.length - 1, numerator = boxes.at(-1)![0] - first[0];
    if (numerator < (first[2] - first[0] + 1) * denominator) continue;
    if (boxes.every((box, i) => {
      const position = (first[0] * denominator + i * numerator) / denominator;
      return box[0] === Math.floor(position) || box[0] === Math.ceil(position);
    })) complete.push(boxes);
  }
  return complete;
}

export class CoupledDisplays {
  epoch: number | null = null;
  controls: NativeBox[] = [];
  receivers: NativeBox[] = [];
  initial_value: number | null = null;
  history: CoupledDisplayRecord[] = [];
  scored_schema: CoupledDisplayRecord | null = null;

  offers(observation: CoupledDisplayObservation, rows: NativeRows, inputs: readonly CoupledDisplayCommand[], policy: CoupledDisplayRecord): CoupledDisplayRecord[] {
    const points = inputs.filter(action => pythonTruthy(action.data) && action.action_ref === 'ACTION6');
    if (!points.length) return [];
    if (!pythonEqual(this.epoch, observation.level_epoch)) {
      this.epoch = observation.level_epoch; this.controls = []; this.receivers = []; this.initial_value = null; this.history = [];
    }
    if (!this.controls.length) {
      const groups = framedRows(observation, rows);
      let candidates: [NativeBox[], NativeBox[]][] = [];
      for (const controls of groups) for (const outputs of groups) {
        const c = controls[0]!, r = outputs[0]!;
        if (controls !== outputs && controls.length >= 3 && outputs.length >= 2 &&
          (c[2] - c[0] !== r[2] - r[0] || c[3] - c[1] !== r[3] - r[1]) &&
          new Set(controls.map(box => value(rows, box))).size === 1 && new Set(outputs.map(box => value(rows, box))).size >= 2) candidates.push([controls, outputs]);
      }
      if (!candidates.length && pythonTruthy(this.scored_schema)) {
        const shape = (box: NativeBox): [number, number] => [box[2] - box[0] + 1, box[3] - box[1] + 1];
        const ratio = (a: readonly number[], b: readonly number[]): boolean => a[0]! * b[1]! === a[1]! * b[0]!;
        candidates = [];
        for (const controls of groups) for (const receivers of groups) if (controls !== receivers &&
          ratio(shape(controls[0]!), this.scored_schema!.source_shape) && ratio(shape(receivers[0]!), this.scored_schema!.receiver_shape) &&
          new Set(controls.map(box => value(rows, box))).size === 1) candidates.push([controls, receivers]);
      }
      if (candidates.length !== 1) return [];
      [this.controls, this.receivers] = candidates[0]!; this.initial_value = value(rows, this.controls[0]!);
    }
    const state = this.controls.map(box => value(rows, box)), lamps = this.receivers.map(box => value(rows, box));
    if ([...state, ...lamps].includes(null)) return [];
    const changed = new Set(this.history.filter(event => ['local_only', 'coupled'].includes(event.result)).map(event => event.control));
    const inert = new Set(this.history.filter(event => event.result === 'unchanged').map(event => event.control));
    const visited: (number | null)[][] = [...this.history.map(event => event.state), state];
    const alternate = [...new Set(state.filter(v => !pythonEqual(v, this.initial_value)))];
    if (alternate.length > 1) return [];
    const on = alternate[0] ?? null, frequencies = new Map<number | null, number>();
    for (const lamp of lamps) frequencies.set(lamp, (frequencies.get(lamp) ?? 0) + 1);
    const least = Math.min(...frequencies.values()), targets = this.receivers.filter((_, i) => frequencies.get(lamps[i]!) === least);
    const options: { key: number[]; index: number; action: CoupledDisplayCommand; projected: (number | null)[] }[] = [];
    this.controls.forEach(([left, top, right, bottom], index) => {
      if (inert.has(index)) return;
      const addressed = points.filter(action => left <= action.data!.x! && action.data!.x! <= right && top <= action.data!.y! && action.data!.y! <= bottom);
      if (addressed.length !== 1) return;
      const projected = [...state]; projected[index] = pythonEqual(state[index], on) ? this.initial_value : on;
      if (this.history.some(event => event.control === index && pythonEqual(event.state, state))) return;
      const distance = Math.min(...targets.map(([x, , z]) => Math.abs((left + right) - (x + z))));
      options.push({ key: [Number(visited.some(previous => pythonEqual(projected, previous))), Number(changed.has(index)), distance, left], index, action: addressed[0]!, projected });
    });
    if (!options.length) return [];
    options.sort((a, b) => { for (let i = 0; i < a.key.length; i++) if (a.key[i] !== b.key[i]) return a.key[i]! - b.key[i]!; return 0; });
    const { index, action } = options[0]!;
    if (!Object.hasOwn(policy, 'question')) throw new TypeError('Coupled-display policy question is required');
    return [{ source: 'coupled_displays', action, level_epoch: this.epoch, engaged_parent: changed.size > 0,
      parent_ref: 'conjoint_state_of_observed_receiver_row', observation_ref: observation.observation_ref,
      control_index: index, starting_values: state, source_score: observation.levels_completed, receiver_values: lamps,
      controls: this.controls, receivers: this.receivers,
      relations: [['addressed_interior', 'part_of', 'repeated_control_row'], ['control_row', 'may_change', 'distinct_receiver_row'],
        ['simultaneous_receiver_values', 'may_satisfy', 'common_output_condition']],
      predictions: { inert_decoration: 'unchanged', local_switch: 'local_only', coupled_switch: 'coupled' },
      evidence: [observation.observation_ref], return_steps: null,
      risks: ['A latched control or a dependent receiver may change irreversibly.'], question: policy.question }];
  }

  observe(probe: CoupledDisplayRecord, after: CoupledDisplayObservation, rows: NativeRows): string | null {
    if (after.levels_completed > probe.source_score) {
      const size = (box: NativeBox): [number, number] => [box[2] - box[0] + 1, box[3] - box[1] + 1];
      this.scored_schema = { source_shape: size(probe.controls[0]), receiver_shape: size(probe.receivers[0]), evidence: after.observation_ref }; return 'boundary';
    }
    if (!pythonEqual(after.level_epoch, probe.level_epoch)) return null;
    const state = (probe.controls as NativeBox[]).map(box => value(rows, box)), lamps = (probe.receivers as NativeBox[]).map(box => value(rows, box));
    if ([...state, ...lamps].includes(null)) return null;
    const before: (number | null)[] = probe.starting_values, index = probe.control_index;
    const local = before.map((v, i) => pythonEqual(v, state[i]) ? null : i).filter(i => i !== null), remote = !pythonEqual(probe.receiver_values, lamps);
    const effect = local.length === 1 && local[0] === index ? remote ? 'coupled' : 'local_only' : local.length === 0 && !remote ? 'unchanged' : 'other';
    this.history.push({ control: index, state: [...before], new_state: state, result: effect, evidence: after.observation_ref }); return effect;
  }
  state(): CoupledDisplayState {
    return copy({ epoch: this.epoch, controls: this.controls, receivers: this.receivers,
      initial_value: this.initial_value, history: this.history, scored_schema: this.scored_schema });
  }
  restore(state: CoupledDisplayState): void {
    const input = copy(state);
    if (!Array.isArray(input.controls) || !Array.isArray(input.receivers) || !Array.isArray(input.history)) throw new TypeError('Invalid coupled-display memory state');
    this.epoch = input.epoch; this.controls = input.controls; this.receivers = input.receivers;
    this.initial_value = input.initial_value; this.history = input.history; this.scored_schema = input.scored_schema;
  }
}

export { framedRows as framed_rows };
