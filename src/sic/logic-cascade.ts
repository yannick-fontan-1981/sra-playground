import { framedRows, value } from '../logos-engine/v6-coupled-displays.ts';
import type { NativeBox, NativeObservation, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Gate = { box: NativeBox; cell: NativePoint; ports: NativePoint[]; output: NativePoint };
type Terminal = { gate: number; lamp: NativeBox };
export type Cascade = { controls: NativeBox[]; initial: number; gates: Gate[]; lamp: NativeBox; off: number; terminal: number;
  terminals?: Terminal[] };
export type CascadeReading = { setting: number; active: boolean[]; ports: number[][]; lamp: number; lamps?: number[]; controlInks: number[] };
export type CascadeChoice = { index: number; setting: number; distance: number; hypotheses: number };

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const midpoint = ([l, , r]: NativeBox) => Math.floor((l + r) / 2);
const at = (rows: NativeRows, [x, y]: NativePoint) => rows[y]![x]!;
const on = (setting: number, i: number) => Boolean(setting & (1 << i));
const cost = (bits: number) => bits.toString(2).replaceAll('0', '').length;

function rim(rows: NativeRows, l: number, t: number, r: number, b: number): number | null {
  const ink = rows[t]?.[l];
  if (ink === undefined || !rows[b]) return null;
  for (let x = l; x <= r; x++) if (rows[t]![x] !== ink || rows[b]![x] !== ink) return null;
  for (let y = t + 1; y < b; y++) if (rows[y]![l] !== ink || rows[y]![r] !== ink) return null;
  return ink;
}

export function measureLogicCascade(observation: NativeObservation, rows: NativeRows): Cascade | null {
  const layouts: Cascade[] = [];
  const columns = rows[0]!.length;
  for (const controls of framedRows(observation, rows)) {
    if (controls.length < 3 || controls.length > 8) continue;
    const initial = value(rows, controls[0]!);
    if (initial === null || controls.some(box => value(rows, box) !== initial)) continue;
    const size = width(controls[0]!), bottom = controls[0]![1] - 2;
    if (size % 2 === 0 || size > 5) continue;
    const palette = new Map<number, number>();
    for (const row of rows.slice(0, bottom)) for (const ink of row) palette.set(ink, (palette.get(ink) ?? 0) + 1);
    const background = [...palette].sort((a, b) => b[1] - a[1])[0]?.[0];
    const groups = new Map<string, Gate[]>();
    for (let t = 2; t < bottom - size; t++) for (let l = 1; l < columns - size; l++) {
      for (let w = size + 2; w <= 2 * size + 1; w += 2) for (let h = size + 1; h <= size + 2; h++) {
        const r = l + w - 1, b = t + h - 1;
        if (r + 1 >= columns || b + 1 >= bottom) continue;
        const frame = rim(rows, l, t, r, b), x = (l + r) / 2, ink = rows[b - 1]![x];
        if (frame === null || frame === background || ink === frame || ink === background || rows[t - 1]![x] === background) continue;
        const ports = Array.from({ length: w }, (_, i): NativePoint => [l + i, b + 1]).filter(p => at(rows, p) !== background);
        if (ports.length < 2 || ports.length > 3 || ports.some(([px], i) => i > 0 && px <= ports[i - 1]![0] + 1)) continue;
        const box: NativeBox = [l, t, r, b], group = groups.get(`${w},${h}`) ?? [];
        group.push({ box, cell: [x, b - 1], ports, output: [x, t - 1] });
        groups.set(`${w},${h}`, group);
      }
    }
    for (const gates of groups.values()) {
      if (gates.length < 3 || gates.length > 12) continue;
      if (gates.some(({ cell }, i) => gates.some((other, j) => i !== j && cell[0] >= other.box[0] && cell[0] <= other.box[2]
        && cell[1] >= other.box[1] && cell[1] <= other.box[3]))) continue;
      gates.sort((a, b) => b.box[1] - a.box[1] || a.box[0] - b.box[0]);
      const last = gates.at(-1)!;
      const stages = new Set(gates.map(gate => gate.box[1]));
      const lampsAbove = (gate: Gate) => observation.entities.filter(entity => entity.rectangular && entity.bbox[1] > 0 && entity.bbox[0] > 0
        && entity.bbox[3] + 2 < gate.box[1] && entity.bbox[2] + 1 < columns && Math.abs(midpoint(entity.bbox) - gate.cell[0]) <= Math.floor(size / 2)
        && width(entity.bbox) >= size && height(entity.bbox) >= 2 && entity.palette_value === initial
        && rim(rows, entity.bbox[0] - 1, entity.bbox[1] - 1, entity.bbox[2] + 1, entity.bbox[3] + 1) !== null);
      const off = at(rows, last.cell);
      if (stages.size === 1) {
        const terminals = gates.flatMap((gate, index) => {
          const lamps = lampsAbove(gate);
          return lamps.length === 1 ? [{ gate: index, lamp: lamps[0]!.bbox }] : [];
        });
        if (terminals.length !== gates.length || new Set(terminals.map(({ lamp }) => lamp.join(','))).size !== terminals.length
          || new Set(terminals.map(({ lamp }) => lamp[1])).size !== 1 || gates.some(gate => at(rows, gate.cell) !== off)) continue;
        layouts.push({ controls, initial, gates, off, lamp: terminals[0]!.lamp, terminal: terminals[0]!.gate, terminals });
        continue;
      }
      if (gates.at(-2)?.box[1] === last.box[1]) continue;
      const lamps = lampsAbove(last);
      if (lamps.length !== 1 || new Set(gates.map(g => at(rows, g.cell))).size !== 2) continue;
      layouts.push({ controls, initial, gates, off, lamp: lamps[0]!.bbox, terminal: gates.length - 1 });
    }
  }
  return layouts.length === 1 ? layouts[0]! : null;
}

export function readCascade(rows: NativeRows, cascade: Cascade): CascadeReading | null {
  const controlInks = cascade.controls.map(box => value(rows, box)), lamp = value(rows, cascade.lamp);
  const lamps = cascade.terminals?.map(terminal => value(rows, terminal.lamp));
  if (lamp === null || lamps?.some(ink => ink === null) || controlInks.some(ink => ink === null)
    || new Set(controlInks.filter(ink => ink !== cascade.initial)).size > 1) return null;
  const setting = controlInks.reduce<number>((mask, ink, i) => ink === cascade.initial ? mask : mask | (1 << i), 0);
  const active = cascade.gates.map(gate => at(rows, gate.cell) !== cascade.off);
  if (lamps && cascade.terminals?.some(({ gate }, i) => active[gate] !== (lamps[i] !== cascade.initial))) return null;
  return { setting, active,
    ports: cascade.gates.map(gate => gate.ports.map(port => at(rows, port))), lamp,
    ...(lamps ? { lamps: lamps as number[] } : {}), controlInks: controlInks as number[] };
}

type Hypothesis = { feeds: number[]; truth: number; weight: number };
const bit = (sample: CascadeReading, sources: number, i: number) => i < sources ? on(sample.setting, i) : sample.active[i - sources]!;

function gateHypotheses(rows: NativeRows, layout: Cascade, samples: readonly CascadeReading[], index: number): Hypothesis[] {
  const gate = layout.gates[index]!, sources = layout.controls.length, initial = samples[0]!;
  const feeds = [...layout.controls.map((box): NativePoint => [midpoint(box), box[1] - 2]), ...layout.gates.slice(0, index).map(node => node.output)];
  const alternatives = gate.ports.map((port, p) => feeds.flatMap((outlet, i) => {
    if (outlet[1] <= port[1] || samples.some(sample =>
      (sample.ports[index]![p] !== initial.ports[index]![p]) !== (bit(sample, sources, i) !== bit(initial, sources, i)))) return [];
    const vertical = outlet[1] - port[1], lateral = Math.abs(outlet[0] - port[0]);
    const weight = (at(rows, port) === at(rows, outlet) ? 2 : 1) / (1 + (vertical + lateral) / 12);
    return [{ i, weight }];
  }));
  const arity = gate.ports.length, limit = (1 << (arity + 1)) - 1;
  const models = new Map<string, Hypothesis>();
  function bind(p: number, selected: number[], weight: number) {
    if (p < arity) {
      for (const choice of alternatives[p]!) if (!selected.includes(choice.i)) bind(p + 1, [...selected, choice.i], weight * choice.weight);
      return;
    }
    const ordered = selected.sort((a, b) => a - b);
    const observed = samples.map(sample => ordered.filter(i => bit(sample, sources, i)).length);
    for (let truth = 1; truth < limit; truth++) {
      if (samples.some((sample, i) => on(truth, observed[i]!) !== sample.active[index])) continue;
      const key = `${ordered.join(',')}:${truth}`;
      if ((models.get(key)?.weight ?? 0) < weight) models.set(key, { feeds: ordered, truth, weight });
    }
  }
  bind(0, [], 1);
  return [...models.values()];
}

// Independent marginals rank experiments. Shared signals can make a projected outcome uncertain.
function estimate(models: readonly Hypothesis[], probabilities: readonly number[]): number {
  let active = 0, total = 0;
  for (const { feeds, truth, weight } of models) {
    let projection = [1];
    for (const feed of feeds) {
      const p = probabilities[feed]!;
      projection = [...projection, 0].map((_, count) => (projection[count] ?? 0) * (1 - p) + (projection[count - 1] ?? 0) * p);
    }
    active += weight * projection.reduce((sum, chance, count) => on(truth, count) ? sum + chance : sum, 0);
    total += weight;
  }
  return total ? active / total : 0.5;
}

export function chooseCascade(rows: NativeRows, layout: Cascade, samples: readonly CascadeReading[], current: CascadeReading,
  blocked: readonly string[], remaining: number): CascadeChoice | null {
  const models = layout.gates.map((_, index) => gateHypotheses(rows, layout, samples, index));
  const terminals = layout.terminals?.map(terminal => terminal.gate) ?? [layout.terminal];
  const visited = new Set(samples.map(sample => sample.setting));
  const goals: { setting: number; distance: number; score: number }[] = [];
  for (let setting = 0; setting < 1 << layout.controls.length; setting++) {
    const distance = cost(current.setting ^ setting);
    if (!distance || distance > remaining || visited.has(setting)) continue;
    const probabilities = layout.controls.map((_, index) => Number(on(setting, index)));
    for (const local of models) probabilities.push(estimate(local, probabilities));
    // Evaluate every terminal on the same switch setting so a shared source is never assigned independently.
    const probability = terminals.reduce((joint, gate) => joint * probabilities[layout.controls.length + gate]!, 1);
    goals.push({ setting, distance, score: probability - 0.12 * (distance - 1) });
  }
  goals.sort((a, b) => b.score - a.score || a.distance - b.distance || a.setting - b.setting);
  for (const goal of goals) {
    const candidates = layout.controls.flatMap((_, index) => {
      if (!on(goal.setting ^ current.setting, index) || blocked.includes(`${current.setting}:${index}`)) return [];
      const setting = current.setting ^ (1 << index);
      return [{ index, setting, seen: visited.has(setting) }];
    });
    candidates.sort((a, b) => Number(a.seen) - Number(b.seen) || a.index - b.index);
    const next = candidates[0];
    if (next) return { ...next, distance: goal.distance, hypotheses: terminals.reduce((total, gate) => total + models[gate]!.length, 0) };
  }
  return null;
}
