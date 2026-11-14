import { measureSlotLayout, readSlotState, type SlotState } from '../logos-engine/v6-slot-substitution.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const slotTransferId = 'sic_slot_transfer';
export const slotTransferStrategies = {
  select_matching_token: 'Select a token that fits an empty slot',
  place_selected_token: 'Put the selected token into its matching slot',
  submit_completed_sequence: 'Submit the filled sequence',
} as const;
const graph = compileStrategyGraph({ id: 'fill_slots_to_match_reference', version: 1, order: 'FALLBACK',
  priorities: ['submit_completed_sequence', 'place_selected_token', 'select_matching_token'],
  strategies: {
    select_matching_token: [{ fact: 'canSelect', expected: true, label: 'An empty slot has a unique matching available token' }],
    place_selected_token: [{ fact: 'canPlace', expected: true, label: 'The visibly selected token matches an empty slot' }],
    submit_completed_sequence: [{ fact: 'isComplete', expected: true, label: 'Every slot matches the expanded reference sequence' }],
  },
}, ['canSelect', 'canPlace', 'isComplete']);

type Layout = { targets: number[]; slots: NativeBox[]; inventory: NativeBox[]; hues: number[]; word: number[]; neutral_borders: number[][] };
type Move = { command: NativeCommand; expected: SlotState | null; source: NativeBox | null; destination: NativeBox | null };
type State = { epoch: number; layout: Layout; evidence: string[]; stopped: boolean };
type Proposal = NativeProposal & { local: State; move: Move; needId: string };
const sameState = (a: SlotState, b: SlotState | null) => b !== null && JSON.stringify(a) === JSON.stringify(b);
const point = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const click = (box: NativeBox): NativeCommand => {
  const [x, y] = point(box);
  return { action_ref: 'ACTION6', data: { x, y } };
};

function transferOffers(layout: Layout, [available, contents, active]: SlotState, submit: NativeCommand) {
  const missing = contents.flatMap((value, index) => value === layout.targets[index] ? [] : [index]);
  if (missing.some(index => contents[index] !== null)) return null;
  if (!missing.length) return { submit: { command: submit, expected: null, source: null, destination: null } as Move };
  const slot = active === null ? missing[0] : missing.find(index => layout.targets[index] === layout.hues[active]);
  if (slot === undefined) return null;
  const destination = layout.slots[slot]!;
  if (active !== null) return { place: { command: click(destination), source: layout.inventory[active]!, destination,
    expected: [available.map((present, i) => present && i !== active), contents.map((value, i) => i === slot ? layout.targets[slot]! : value), null] } as Move };
  const sources = available.flatMap((present, index) => present && layout.hues[index] === layout.targets[slot] ? [index] : []);
  if (sources.length !== 1) return null;
  const source = sources[0]!, box = layout.inventory[source]!;
  return { select: { command: click(box), source: box, destination, expected: [available, contents, source] } as Move };
}

export function createSicSlotTransfer(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: slotTransferId,
    async propose(observation, rows, inputs, remaining) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const buttons = inputs.filter(input => /^ACTION[1-5]$/.test(input.action_ref));
      if (buttons.length !== 1) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (prior?.stopped) return null;
      const layout = prior?.layout ?? (measureSlotLayout(observation, rows) as Layout | null);
      if (!layout) return null;
      const ref = observation.observation_ref;
      const local = prior ?? { epoch: observation.level_epoch, layout, evidence: [ref], stopped: false };
      const current = readSlotState(rows, layout);
      if (!current) return null;
      const offers = transferOffers(layout, current, buttons[0]!);
      if (!offers) return null;
      const evidence: [string, ...string[]] = [ref, ...local.evidence.filter(item => item !== ref)];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        canSelect: { value: !!offers.select, evidence }, canPlace: { value: !!offers.place, evidence },
        isComplete: { value: !!offers.submit, evidence },
      }, planners: { select_matching_token: () => offers.select ?? null, place_selected_token: () => offers.place ?? null,
        submit_completed_sequence: () => offers.submit ?? null } });
      if (!selected) return null;
      const strategy = selected.id, move = selected.plan, label = slotTransferStrategies[strategy], parent = 'G_official_completion';
      const goal = { kind: 'match_expanded_reference_sequence', scope: ref.split(':revision:', 1)[0]!, subjects: ['visible_slot_row'],
        parentObjective: parent, satisfactionContract: 'observe_official_progress_after_matching_every_slot' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `slot-transfer:${need.id}`, actions = [move.command];
      const address = strategy === 'select_matching_token' ? move.source : strategy === 'place_selected_token' ? move.destination : null;
      const pointBinding = address ? await ObservedInputDomain.makeLocusWitness(observation, rows, point(address), { reason: label, evidence }) : null;
      return { status: 'proposed', kind: slotTransferId, actions, local, move, needId: need.id,
        steps: [{ action: move.command, expected_after: null, ...(pointBinding ? { point_binding: pointBinding } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Fill the visible slots to match the reference sequence', mode: 'solving',
          situation: label, agenda: entries, evidence, source: move.source, destination: move.destination },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'slot_transfer_bound' : 'slot_transfer_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = proposal.move.expected ? sameState(proposal.move.expected, readSlotState(second, proposal.local.layout)) : null;
      return { matched, seal_prefix: true, reason: matched === null ? 'submission_did_not_score'
        : matched ? 'slot_transfer_confirmed' : 'slot_transfer_contradicted' };
    },
    record(before, after, _command, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, move } = proposal;
      state = { ...local, evidence: [local.evidence[0]!, ...local.evidence.slice(-2).filter(ref => ref !== local.evidence[0]), after.observation_ref],
        stopped: !move.expected || !sameState(move.expected, readSlotState(second, local.layout)) };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
