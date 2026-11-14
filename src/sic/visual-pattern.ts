import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { explainVisual, visualInterior, visualLayout, visualSequenceConfiguration } from '../logos-engine/v6-visual-sequences.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const visualPatternId = 'sic_visual_pattern';
const strategy = 'complete_visible_pattern';
export const visualPatternStrategies = {
  [strategy]: 'Complete the pattern with the only compatible option',
} as const;
const graph = compileStrategyGraph({
  id: 'complete_pattern_from_visible_examples', version: 1, order: 'FALLBACK',
  priorities: [strategy],
  strategies: { [strategy]: [{ fact: 'unique', expected: true, label: 'Only one option fits the supported color and shape relations' }] },
}, ['unique']);

type Raster = readonly (readonly number[])[];
type State = { epoch: number; stopped: boolean; evidence: string[] };
type Proposal = NativeProposal & { target: NativeBox; preserve: NativeBox[]; expected: Raster; needId: string };
const sameRaster = (first: Raster, second: Raster) => first.length === second.length && first.every((row, y) =>
  row.length === second[y]!.length && row.every((color, x) => color === second[y]![x]));

function fillsTarget(proposal: Proposal, first: NativeRows, second: NativeRows) {
  return sameRaster(visualInterior(second, proposal.target), proposal.expected) &&
    proposal.preserve.every(box => sameRaster(visualInterior(first, box), visualInterior(second, box)));
}

export function createSicVisualPattern(): NativeFamily<Proposal> {
  let state: State | null = null;
  let configuration: ReturnType<typeof visualSequenceConfiguration> | undefined;
  return {
    id: visualPatternId,
    async propose(observation, rows, _inputs, remaining) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (prior?.stopped) return null;
      const layout = await visualLayout(observation, rows);
      if (!layout || layout.options.length > 12 || layout.active.rasters.length > 12) return null;
      const { active, options, background } = layout;
      const cards = active.rasters.map((raster, index) => index === active.missing ? null : raster);
      const config = configuration ??= visualSequenceConfiguration();
      let choice: (typeof options)[number] | undefined;
      for (const option of options) {
        if (!await explainVisual(cards, active.missing, option.raster, background, config)) continue;
        if (choice) return null;
        choice = option;
      }
      if (!choice) return null;
      const [l, t, r, b] = choice.box;
      const point: NativePoint = [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
      const command = { action_ref: 'ACTION6', data: { x: point[0], y: point[1] } };
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...(prior?.evidence ?? [])];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active',
        facts: { unique: { value: true, evidence } }, planners: { [strategy]: () => command } });
      if (!selected) return null;
      const target = active.boxes[active.missing]!, preserve = layout.grid.flat().filter(box => box !== target);
      const parent = 'G_official_completion', label = visualPatternStrategies[strategy];
      const goal = { kind: 'fill_missing_pattern_card', scope: layout.question_ref, subjects: ['visible_pattern', 'missing_card'],
        parentObjective: parent, satisfactionContract: 'the predicted card fills the gap and other cards are preserved' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `visual-pattern:${need.id}`, actions = [command];
      const binding = await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: label, evidence });
      return { status: 'proposed', kind: visualPatternId, actions, target, preserve, expected: choice.raster, needId: need.id,
        steps: [{ action: command, expected_after: null, point_binding: binding }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Fill the missing card', mode: 'solving',
          situation: `One of ${options.length} options fits the measured color and shape relations. Acceptance still needs a return.`,
          agenda: entries, evidence, target, option: choice.box, examples: active.boxes.filter(box => box !== target) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'visible_pattern_bound' : 'visible_pattern_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      const boundary = after.levels_completed > before.levels_completed;
      const matched = boundary || fillsTarget(proposal, first, second);
      return { matched, seal_prefix: true, reason: boundary ? 'official_boundary' : matched ? 'predicted_card_observed' : 'predicted_card_unconfirmed',
        ...(matched ? { sic_need: { id: proposal.needId, status: 'satisfied' } } : {}) };
    },
    record(before, after, _command, first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const previous = state?.epoch === before.level_epoch ? state.evidence : [];
      state = { epoch: before.level_epoch, stopped: !fillsTarget(proposal, first, second), evidence: [...previous.slice(-3), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
