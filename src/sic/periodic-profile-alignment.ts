import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';

export const periodicProfileAlignmentId = 'sic_verify_periodic_profile_alignment';
export const periodicProfileStrategies = {
  measure_collective_shift: 'Measure how the collective control shifts the visible profiles',
  select_profile_for_residual: 'Select the profile that can supply the remaining contribution',
  align_profile_sums: 'Apply a verified shift to match the target sums',
} as const;

type Gauge = { x: number; base: number; height: number; box: NativeBox };
type Layout = { selectors: NativeBox[]; buttons: [NativeBox, NativeBox]; colors: number[]; gauges: Gauge[]; top: number; bottom: number };
type Sample = { profiles: number[][]; selected: number; totals: number[] };
type Directions = Record<string, number>;
type Witness = { epoch: number; gauges: number; directions: Directions; refs: string[] };
type Local = { epoch: number; layout: Layout; gain: number[] | null; refs: string[]; stopped: boolean };
type Step = { action: NativeCommand; shifts: number[] | null; selected: number; box: NativeBox; strategy: keyof typeof periodicProfileStrategies };
type Proposal = NativeProposal & { local: Local; current: Sample; step: Step; needId: string };

const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const size = ([l, t, r, b]: NativeBox) => [r - l + 1, b - t + 1] as const;
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const inside = ([x, y]: NativePoint, [l, t, r, b]: NativeBox) => l <= x && x <= r && t <= y && y <= b;
const at = (rows: NativeRows, [x, y]: NativePoint) => rows[y]?.[x];
const mod = (n: number, p: number) => ((n % p) + p) % p;
const click = ([x, y]: NativePoint): NativeCommand => ({ action_ref: 'ACTION6', data: { x, y } });
const directions = /^ACTION[34]$/;
const satisfied = (layout: Layout, totals: number[]) => layout.gauges.every((gauge, i) => totals[i] === gauge.height);

function gaugeTargets(rows: NativeRows, top: number, background: number): Gauge[] {
  return geometricComponents(rows.slice(top)).flatMap(part => {
    const [l, y, r, end] = part.bbox, width = r - l + 1;
    if (y !== end || !part.rectangular || width < 5 || width > 9 || width % 2 === 0 || l < 2 || r + 2 >= rows[0]!.length) return [];
    const base = y + top, x = (l + r) / 2;
    const levels = rows.slice(top, base + 1).flatMap((row, i) => {
      const ink = row[l - 2]!;
      return ink !== background && [l - 1, r + 1, r + 2].every(col => row[col] === ink) ? [i + top] : [];
    });
    if (levels.length !== 1 || levels[0] === top) return [];
    const target = levels[0]!;
    return [{ x, base, height: base - target, box: [l - 2, target, r + 2, base] as NativeBox }];
  });
}

function periodicProfile(values: (number | null)[]): number[] | null {
  for (let period = 2; period <= Math.floor(values.length / 3); period++) {
    const entries = Array<number | null>(period).fill(null);
    if (values.every((value, i) => {
      if (value === null) return true;
      const position = i % period;
      if (entries[position] !== null && value !== entries[position]) return false;
      entries[position] = value;
      return true;
    }) && entries.every(value => value !== null) && new Set(entries).size > 1) return entries as number[];
  }
  return null;
}

function readSample(rows: NativeRows, layout: Layout): Sample | null {
  const { selectors, colors, gauges, top, bottom } = layout;
  if (!selectors.every((box, i) => at(rows, center(box)) === colors[i])) return null;
  const background = rows[0]![0];
  const selected = selectors.flatMap(([l, t, r, b], i) => {
    const ink = rows[t - 1]?.[l - 1];
    return ink !== background && [rows[t - 1]?.[r + 1], rows[b + 1]?.[l - 1], rows[b + 1]?.[r + 1]].every(value => value === ink) ? [i] : [];
  });
  if (selected.length !== 1) return null;
  const band = rows.slice(top, bottom), summary = new Set(colors);
  const profiles = colors.map(color => periodicProfile(rows[0]!.map((_, x) =>
    gauges.some(gauge => gauge.x === x) ? null : band.filter(row => row[x] === color).length)));
  if (profiles.some(profile => !profile)) return null;
  const totals = gauges.map(({ x, base }) => rows.slice(bottom + 1, base).filter(row => summary.has(row[x]!)).length);
  if (!gauges.every(({ x }, i) => profiles.reduce((sum, profile) => sum + profile![x % profile!.length]!, 0) === totals[i])) return null;
  return { profiles: profiles as number[][], selected: selected[0]!, totals };
}

function measure(rows: NativeRows): { layout: Layout; sample: Sample } | null {
  const head = geometricComponents(rows.slice(0, Math.floor(rows.length / 8)));
  const units = head.filter(part => {
    const [w, h] = size(part.bbox);
    return part.rectangular && h >= 2 && w === h + 1 && part.bbox[1] > 0;
  });
  if (units.length < 2 || units.length > 4 || new Set(units.map(part => part.color)).size !== units.length
    || !units.every(part => part.bbox[1] === units[0]!.bbox[1] && equal(size(part.bbox), size(units[0]!.bbox)))) return null;
  units.sort((a, b) => a.bbox[0] - b.bbox[0]);
  const [w, h] = size(units[0]!.bbox);
  const buttons = head.filter(part => {
    const [width, height] = size(part.bbox);
    return part.bbox[0] > units.at(-1)!.bbox[2] && width >= w * 2 && width <= w * 3
      && height === h + 3 && part.bbox[1] === units[0]!.bbox[1] - 1;
  }).sort((a, b) => a.bbox[0] - b.bbox[0]);
  if (buttons.length !== 2 || buttons[0]!.color !== buttons[1]!.color) return null;
  const top = buttons[0]!.bbox[3] + 2;
  const bottom = rows.findIndex((row, y) => y > rows.length / 2 && y < rows.length * 0.8
    && row[0] !== rows[0]![0] && row.every(value => value === row[0]));
  if (bottom < 0) return null;
  const gauges = gaugeTargets(rows, bottom + 1, rows[bottom + 1]![0]!);
  if (!gauges.length || gauges.length > 4 || !gauges.every(gauge => gauge.base === gauges[0]!.base)) return null;
  const layout: Layout = { selectors: units.map(part => part.bbox), buttons: [buttons[0]!.bbox, buttons[1]!.bbox],
    colors: units.map(part => part.color), gauges, top, bottom };
  const sample = readSample(rows, layout);
  return sample ? { layout, sample } : null;
}

function measuredShifts(before: Sample, after: Sample): number[] | null {
  const shifts = before.profiles.map((old, i) => {
    const next = after.profiles[i];
    if (!next || old.length !== next.length) return null;
    const delta = next.findIndex((_, j) => next.every((value, x) => value === old[mod(x - j, old.length)]));
    if (delta < 0) return null;
    return delta > old.length / 2 ? delta - old.length : delta;
  });
  return shifts.every(shift => shift !== null) ? shifts as number[] : null;
}

function chooseStep(layout: Layout, sample: Sample, gain: number[] | null, inputs: Directions, remaining: number): Step | null {
  if (!gain) return { action: click(center(layout.buttons[1])), shifts: null, selected: sample.selected, box: layout.buttons[1], strategy: 'measure_collective_shift' };
  const zero = gain.map(() => 0);
  const queue: { offsets: number[]; selected: number; depth: number; first: Step | null }[] = [
    { offsets: zero, selected: sample.selected, depth: 0, first: null },
  ];
  const seen = new Set<string>();
  for (let head = 0; head < queue.length && head < 4096; head++) {
    const current = queue[head]!;
    if (current.first && satisfied(layout, layout.gauges.map(({ x }) =>
      sample.profiles.reduce((sum, profile, i) => sum + profile[mod(x - current.offsets[i]!, profile.length)]!, 0)))) return current.first;
    if (current.depth >= remaining) continue;
    const { selected } = current, box = layout.selectors[selected]!;
    const steps: Step[] = Object.entries(inputs).map(([action_ref, delta]) => ({
      action: { action_ref, data: {} }, shifts: zero.map((_, i) => i === selected ? delta : 0),
      selected, box, strategy: 'align_profile_sums',
    }));
    layout.selectors.forEach((selector, i) => {
      if (i !== selected) steps.push({ action: click(center(selector)), shifts: zero, selected: i, box: selector, strategy: 'select_profile_for_residual' });
    });
    layout.buttons.forEach((button, i) => steps.push({
      action: click(center(button)), shifts: gain.map(value => i === 0 ? -value : value), selected, box: button, strategy: 'align_profile_sums',
    }));
    for (const step of steps) {
      const offsets = current.offsets.map((value, i) => mod(value + step.shifts![i]!, sample.profiles[i]!.length));
      const key = JSON.stringify([offsets, step.selected]);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ offsets, selected: step.selected, depth: current.depth + 1, first: current.first ?? step });
    }
  }
  return null;
}

function shiftReturn(proposal: Proposal, rows: NativeRows): number[] | null {
  const { local, current, step } = proposal, next = readSample(rows, local.layout);
  if (!next || next.selected !== step.selected) return null;
  const shifts = measuredShifts(current, next);
  const supported = step.shifts ? equal(shifts, step.shifts.map((delta, i) => {
    const period = current.profiles[i]!.length, phase = mod(delta, period);
    return phase > period / 2 ? phase - period : phase;
  })) : shifts?.some(shift => shift !== 0);
  return supported ? shifts : null;
}

export function createSicPeriodicProfileAlignment(): NativeFamily<Proposal> {
  let known: Directions = {}, witness: Witness | null = null, local: Local | null = null;
  let refs: string[] = [];
  return {
    id: periodicProfileAlignmentId,
    observePublicOutcome(before, after, action, first, second, frames = []) {
      if (!before.available_action_refs.includes('ACTION3') || !before.available_action_refs.includes('ACTION4')
        || !before.available_action_refs.includes('ACTION6') || before.available_action_refs.includes('ACTION1')
        || (!directions.test(action.action_ref) && (action.action_ref !== 'ACTION6' || (action.data.y ?? Infinity) > 6))) return;
      const measured = measure(first);
      if (!measured) return;
      const { layout, sample } = measured, won = after.levels_completed > before.levels_completed;
      if (won && action.action_ref === 'ACTION6' && layout.buttons.some(box => inside([action.data.x!, action.data.y!], box))) {
        for (const frame of frames) {
          const closing = readSample(frame, layout);
          if (!closing || !satisfied(layout, closing.totals) || !measuredShifts(sample, closing)?.some(shift => shift !== 0)) continue;
          witness = { epoch: after.level_epoch, gauges: layout.gauges.length,
            directions: { ...known }, refs: [...refs, before.observation_ref, after.observation_ref] };
          break;
        }
        return;
      }
      if (before.level_epoch !== after.level_epoch || !directions.test(action.action_ref)) return;
      const next = readSample(second, layout), shifts = next && measuredShifts(sample, next);
      if (shifts && next!.selected === sample.selected && Math.abs(shifts[sample.selected]!) === 1
        && shifts.every((shift, i) => i === sample.selected || shift === 0)) {
        known = { ...known, [action.action_ref]: shifts[sample.selected]! };
        refs = [...refs.slice(-3), after.observation_ref];
      }
    },
    async propose(observation, rows, _inputs, remaining) {
      if (remaining < 1 || witness?.epoch !== observation.level_epoch || witness.gauges < 2
        || !observation.available_action_refs.includes('ACTION6')) return null;
      const inputs = Object.fromEntries(Object.entries(witness.directions).filter(([action]) => observation.available_action_refs.includes(action)));
      if (new Set(Object.values(inputs)).size < 2) return null;
      const prior = local?.epoch === observation.level_epoch ? local : null;
      if (prior?.stopped) return null;
      const measured = prior ? null : measure(rows), layout = prior?.layout ?? measured?.layout;
      if (!layout) return null;
      const current = measured?.sample ?? readSample(rows, layout);
      if (!current) return null;
      const state: Local = prior ?? { epoch: observation.level_epoch, layout, gain: null, refs: witness.refs, stopped: false };
      const step = chooseStep(layout, current, state.gain, inputs, remaining);
      if (!step) return null;
      const label = periodicProfileStrategies[step.strategy], ref = observation.observation_ref, parent = 'G_official_completion';
      const evidence: [string, ...string[]] = [ref, ...state.refs.filter(value => value !== ref)];
      const point = center(step.box);
      const binding = step.action.action_ref === 'ACTION6' ? await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: label, evidence }) : null;
      if (step.action.action_ref === 'ACTION6' && !binding) return null;
      const goal = { kind: 'align_periodic_profile_sums', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['profiles', 'shared_shift', 'target_gauges'], parentObjective: parent,
        satisfactionContract: 'compare_each_sum_with_its_target_and_verify_official_progress' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence }, id = periodicProfileAlignmentId + ':' + need.id;
      const actions = [step.action];
      return { status: 'proposed', kind: periodicProfileAlignmentId, local: state, step, current, needId: need.id, actions,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: [{ action: step.action, expected_after: null, ...(binding ? { point_binding: binding } : {}) }],
        sicSituationCard: { strategy: step.strategy, mode: state.gain ? 'solving' : 'exploration',
          need: 'Make all measured sums meet their targets', situation: label, evidence, agenda: [], control: step.box,
          gauges: layout.gauges.map(gauge => gauge.box), profiles: layout.selectors },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: step.strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'profile_controls_bound' : 'profile_context_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = !!shiftReturn(proposal, second);
      return { matched, seal_prefix: true, reason: matched ? 'relative_profile_shift_verified' : 'profile_prediction_contradicted' };
    },
    record(before, after, _action, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch) return { events: [] };
      const shifts = shiftReturn(proposal, second), state = proposal.local;
      local = { ...state, gain: state.gain ?? shifts, stopped: !shifts, refs: [...state.refs.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ known, refs, witness, local }),
    restore(value: NativeRecord) {
      known = structuredClone((value.known as Directions | undefined) ?? {});
      refs = structuredClone((value.refs as string[] | undefined) ?? []);
      witness = structuredClone((value.witness as Witness | undefined) ?? null);
      local = structuredClone((value.local as Local | undefined) ?? null);
    },
  };
}
