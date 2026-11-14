import { crossedPrefixCell, crossedPrefixGeometry, crossedPrefixMeasureControls, crossedPrefixReferencePresent, crossedPrefixSlot,
  type CrossedPrefixController, type CrossedPrefixLayout } from '../logos-engine/v6-crossed-prefix-observation.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const crossingRowsId = 'sic_crossing_rows';
export const crossingRowsStrategies = {
  select_aligned_prefix: 'Select the row or column that can contribute to the pattern',
  test_prefix_advance: 'Test a command for advancing the selected row or column',
  extend_measured_prefix: 'Extend the selected row or column with a measured command',
} as const;
const graph = compileStrategyGraph({ id: 'fill_a_reference_through_crossing_prefixes', version: 1, order: 'FALLBACK',
  priorities: ['extend_measured_prefix', 'test_prefix_advance', 'select_aligned_prefix'],
  strategies: {
    select_aligned_prefix: [{ fact: 'selection', expected: true, label: 'The next contribution belongs to a different visible row or column' }],
    test_prefix_advance: [{ fact: 'trial', expected: true, label: 'There is a cell where the effect or crossing order can be tested' }],
    extend_measured_prefix: [{ fact: 'measured', expected: true, label: 'An earlier return confirmed an advance on this axis and the crossing remains compatible' }],
  },
}, ['selection', 'trial', 'measured']);
type State = { epoch: number; layout: CrossedPrefixLayout; progress: Record<string, number>; selected: string | null;
  commands: Record<string, string>; axisCommands: [string[], string[]]; crossed: boolean; tried: string[]; stopped: boolean; evidence: string[] };
type Choice = { controller: CrossedPrefixController; action: NativeCommand; cell: NativePoint; selecting: boolean; crossing: boolean };
type Proposal = NativeProposal & { local: State; choice: Choice; attempt: string; needId: string };
const key = (value: unknown) => JSON.stringify(value);
const equal = (a: unknown, b: unknown) => key(a) === key(b);
const painted = (rows: NativeRows, layout: CrossedPrefixLayout, cell: NativePoint) => {
  const pixels = crossedPrefixSlot(rows, layout, cell);
  return pixels[Math.floor(pixels.length / 2)]?.[Math.floor((pixels[0]?.length ?? 0) / 2)];
};

function initial(epoch: number, rows: NativeRows): State | null {
  const layout = crossedPrefixGeometry(rows);
  if (!layout || layout.controllers.length > 16 || layout.shape[0] * layout.shape[1] > 64) return null;
  const palette = new Set(layout.reference.palette);
  if (layout.reference.values.some((row, y) => row.some((_, x) => crossedPrefixSlot(rows, layout, [x, y])
    .some(line => line.some(color => palette.has(color)))))) return null;
  return { epoch, layout, progress: Object.fromEntries(layout.controllers.map(control => [control.key, 0])), selected: null,
    commands: {}, axisCommands: [[], []], crossed: false, tried: [], stopped: false, evidence: [] };
}

function returnAssessment(proposal: Proposal, first: NativeRows, second: NativeRows) {
  const { local, choice } = proposal, { layout } = local;
  if (!crossedPrefixReferencePresent(second, layout)) return 'refuted';
  if (choice.selecting) return 'selection';
  const before = crossedPrefixSlot(first, layout, choice.cell), after = crossedPrefixSlot(second, layout, choice.cell);
  if (equal(before, after)) return equal(first, second) ? 'unchanged' : 'refuted';
  const [x, y] = choice.cell, expected = choice.crossing ? layout.reference.values[y]![x] : choice.controller.color;
  return painted(second, layout, choice.cell) === expected ? 'advanced' : 'refuted';
}

export function createSicCrossingRows(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: crossingRowsId,
    async propose(observation, rows, _inputs, remaining) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const local = state?.epoch === observation.level_epoch ? state : initial(observation.level_epoch, rows);
      if (!local || local.stopped || local.tried.length >= 80 || !crossedPrefixReferencePresent(rows, local.layout)) return null;
      const { layout } = local, controls = crossedPrefixMeasureControls(rows, layout);
      if (!controls) return null;
      const horizontal = controls.filter(control => control.axis === 0), vertical = controls.filter(control => control.axis === 1);
      const byLane = (items: CrossedPrefixController[], lane: number) => items.find(item => item.lane === lane)!;
      if (layout.reference.values.some((row, y) => row.some((value, x) =>
        value !== byLane(horizontal, y)?.color && value !== byLane(vertical, x)?.color))) return null;
      const progress = (controller: CrossedPrefixController) => local.progress[controller.key] ?? 0;
      let controller: CrossedPrefixController | undefined;
      if (!local.crossed) {
        const anchors = layout.reference.values.flatMap((row, y) => row.flatMap((_, x) => {
          const h = byLane(horizontal, y), v = byLane(vertical, x);
          return h.color !== v.color ? [{ x, y, h, v }] : [];
        })).sort((a, b) => a.x + a.y - b.x - b.y);
        const anchor = anchors[0];
        if (anchor) {
          const { x, y, h, v } = anchor;
          const steps = (control: CrossedPrefixController, coordinate: number) => control.side < 0 ? coordinate + 1 : control.length - coordinate;
          controller = progress(h) < steps(h, x) ? h : progress(v) < steps(v, y) ? v : undefined;
        }
      }
      controller ??= controls.find(control => progress(control) < control.length);
      if (!controller) return null;
      const index = progress(controller), cell = crossedPrefixCell(controller, index);
      const [x, y] = cell, peer = controller.axis === 0 ? byLane(vertical, x) : byLane(horizontal, y);
      const coordinate = controller.axis === 0 ? y : x;
      const peerIndex = peer.side < 0 ? coordinate : peer.length - 1 - coordinate;
      const priorCommand = local.commands[`${peer.key}:${peerIndex}`], crossing = priorCommand !== undefined;
      const selecting = local.selected !== controller.key;
      const tested = (action: NativeCommand) => local.tried.includes(key([controller.key, index, priorCommand ?? null, action]));
      const learned = local.axisCommands[controller.axis], opposite = local.axisCommands[1 - controller.axis]!;
      const available = observation.available_action_refs.filter(action => /^ACTION[1-5]$/.test(action));
      const ordered = [...new Set([...learned, ...available.filter(action => !opposite.includes(action)), ...available])];
      const plain = ordered.filter(action => available.includes(action)).map(action_ref => ({ action_ref, data: {} }))
        .find(action => !tested(action));
      const point = controller.point;
      const action = selecting ? { action_ref: 'ACTION6', data: { x: point[0], y: point[1] } } : plain;
      if (!action || tested(action)) return null;
      const measured = !selecting && learned.includes(action.action_ref) && (!crossing || local.crossed);
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        selection: { value: selecting, evidence }, trial: { value: !selecting && !measured, evidence }, measured: { value: measured, evidence },
      }, planners: { select_aligned_prefix: () => action, test_prefix_advance: () => action, extend_measured_prefix: () => action } });
      if (!selected) return null;
      const strategy = selected.id, label = crossingRowsStrategies[strategy], parent = 'G_official_completion';
      const objective = { kind: 'copy_pattern_with_crossing_lines', scope: layout.ref, subjects: ['row_contributions', 'column_contributions'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_advancing_the_reference_contributions' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = `crossing-rows:${need.id}`;
      const actions = [action];
      const binding = selecting && await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: label, evidence });
      const left = layout.origin[0] + x * layout.pitch[0], top = layout.origin[1] + y * layout.pitch[1];
      const target: NativeBox = [left, top, left + layout.size[0] - 1, top + layout.size[1] - 1];
      const { origin: [rx, ry], scale: [sx, sy] } = layout.reference;
      const reference: NativeBox = [rx, ry, rx + sx * layout.shape[0] - 1, ry + sy * layout.shape[1] - 1];
      return { status: 'proposed', kind: crossingRowsId, actions, local, choice: { controller, action, cell, selecting, crossing },
        attempt: key([controller.key, index, priorCommand ?? null, action]), needId: need.id,
        steps: [{ action, expected_after: null, ...(binding ? { point_binding: binding } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Reproduce the reference through contributions from both axes', mode: measured ? 'solving' : 'exploration',
          situation: crossing ? 'The other axis has already reached this cell. Compare the crossing color with the reference.' : label,
          agenda: entries, evidence, target, reference, controller: [...point, ...point] },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'crossing_inputs_bound' : 'crossing_inputs_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const result = returnAssessment(proposal, first, second);
      return { matched: result === 'selection' ? null : result === 'advanced', seal_prefix: true, reason: `prefix_${result}` };
    },
    record(before, after, issued, first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, choice } = proposal, { controller } = choice;
      const result = returnAssessment(proposal, first, second), progress = { ...local.progress }, commands = { ...local.commands };
      const axisCommands: [string[], string[]] = [[...local.axisCommands[0]], [...local.axisCommands[1]]];
      if (result === 'advanced') {
        const index = progress[controller.key]!;
        progress[controller.key] = index + 1;
        commands[`${controller.key}:${index}`] = issued.action_ref;
        if (!axisCommands[controller.axis].includes(issued.action_ref)) axisCommands[controller.axis].push(issued.action_ref);
      }
      state = { ...local, commands, axisCommands, progress, selected: controller.key, stopped: result === 'refuted',
        crossed: local.crossed || result === 'advanced' && choice.crossing, tried: [...local.tried, proposal.attempt],
        evidence: [...local.evidence.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
