import { measureContextualCompartments } from '../logos-engine/v6-contextual-compartments.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';

export const markedCompartmentFlowId = 'sic_follow_observed_compartment_readiness';
export const markedCompartmentStrategies = {
  use_marked_compartment: 'Use the marked compartment while its contents are available',
  advance_marked_process: 'Check whether the marked process progresses after a turn',
  deliver_from_confirmed_outlet: 'Use the outlet that previously produced official progress',
} as const;

type Chamber = { box: NativeBox; point: NativePoint; filled: number };
type Scene = { frames: Chamber[]; marked: Chamber[]; mark: number; normal: number; background: number; key: string };
type Witness = { epoch: number; mark: number; normal: number; background: number; chambers: NativeBox[];
  outlet: NativeBox; refs: [string, string] };
type Proposal = NativeProposal & { changedRegion: NativeBox; attempt: string; needId: string };

const boxKey = (box: NativeBox) => box.join(',');
const contains = ([left, top, right, bottom]: NativeBox, [x, y]: NativePoint) => x >= left && x <= right && y >= top && y <= bottom;

function acceptsPoint(observation: NativeObservation): boolean {
  return observation.available_action_refs.includes('ACTION6') && observation.available_action_refs.includes('ACTION5')
    && !observation.available_action_refs.some(input => /^ACTION[1-4]$/.test(input));
}

function sameChamberSite(a: NativeBox, b: NativeBox): boolean {
  const width = Math.min(a[2], b[2]) - Math.max(a[0], b[0]) + 1;
  const height = Math.min(a[3], b[3]) - Math.max(a[1], b[1]) + 1;
  const area = ([left, top, right, bottom]: NativeBox) => (right - left + 1) * (bottom - top + 1);
  return width > 0 && height > 0 && width * height * 2 >= Math.max(area(a), area(b));
}

function continuationOf(scene: Scene, memory: Witness): boolean {
  if (scene.normal !== memory.normal || scene.background !== memory.background) return false;
  const matched = new Set<NativeBox>();
  for (const chamber of scene.frames) {
    const matches = memory.chambers.filter(box => sameChamberSite(box, chamber.box));
    if (matches.length === 1) matched.add(matches[0]!);
  }
  return matched.size * 3 >= memory.chambers.length * 2;
}

function localRegion(chamber: NativeBox, rows: NativeRows): NativeBox {
  const [left, top, right, bottom] = chamber, span = right - left + 1;
  return [Math.max(0, left - span), Math.max(0, top - 2), Math.min(rows[0]!.length - 1, right + span),
    Math.min(rows.length - 1, bottom + 2)];
}

function changed(first: NativeRows, second: NativeRows, [left, top, right, bottom]: NativeBox): boolean {
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) if (first[y]?.[x] !== second[y]?.[x]) return true;
  }
  return false;
}

export function createSicMarkedCompartmentFlow(): NativeFamily<Proposal> {
  let witness: Witness | null = null;
  let attempted: string[] = [];
  return {
    id: markedCompartmentFlowId,
    async observePublicOutcome(before, after, command, first) {
      if (after.levels_completed <= before.levels_completed || command.action_ref !== 'ACTION6' || !acceptsPoint(before)) return;
      const { x, y } = command.data;
      if (typeof x !== 'number' || typeof y !== 'number') return;
      const scene = await measureContextualCompartments(first) as Scene | null;
      if (!scene || scene.marked.length !== 1) return;
      const outlet = scene.marked[0]!;
      if (!outlet.filled || !contains(outlet.box, [x, y])) return;
      witness = { epoch: after.level_epoch, mark: scene.mark, normal: scene.normal, background: scene.background,
        chambers: scene.frames.map(chamber => chamber.box), outlet: outlet.box, refs: [before.observation_ref, after.observation_ref] };
      attempted = [];
    },
    async propose(observation, rows, _inputs, remaining) {
      const memory = witness;
      if (remaining < 1 || memory?.epoch !== observation.level_epoch || !acceptsPoint(observation)) return null;
      const scene = await measureContextualCompartments(rows, memory.mark) as Scene | null;
      if (!scene || !continuationOf(scene, memory)) return null;
      const attemptFor = (chamber: Chamber) => scene.key + ':' + boxKey(chamber.box);
      const isOutlet = (chamber: Chamber) => sameChamberSite(chamber.box, memory.outlet) && chamber.filled > 0;
      const choice = scene.marked.filter(chamber => !attempted.includes(attemptFor(chamber)))
        .sort((a, b) => Number(isOutlet(b)) - Number(isOutlet(a)) || Number(b.filled > 0) - Number(a.filled > 0)
          || a.box[0] - b.box[0] || a.box[1] - b.box[1])[0];
      if (!choice) return null;
      const strategy = isOutlet(choice) ? 'deliver_from_confirmed_outlet'
        : choice.filled ? 'use_marked_compartment' : 'advance_marked_process';
      const label = markedCompartmentStrategies[strategy];
      const ref = observation.observation_ref, parent = 'G_official_completion';
      const evidence: [string, ...string[]] = [ref, ...memory.refs.filter(value => value !== ref)];
      const [x, y] = choice.point, action = { action_ref: 'ACTION6', data: { x, y } }, actions = [action];
      const pointBinding = await ObservedInputDomain.makeLocusWitness(observation, rows, choice.point, { reason: label, evidence });
      const goal = { kind: 'maintain_flow_toward_confirmed_outlet', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['marked_control', 'previous_scoring_outlet'], parentObjective: parent,
        satisfactionContract: 'confirm_local_transition_then_official_delivery' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `marked-compartment:${need.id}`;
      return { status: 'proposed', kind: markedCompartmentFlowId, actions, changedRegion: localRegion(choice.box, rows),
        attempt: attemptFor(choice), needId: need.id,
        steps: [{ action, point_binding: pointBinding, expected_after: null }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Advance material toward the outlet that led to progress',
          situation: label, mode: strategy === 'deliver_from_confirmed_outlet' ? 'solving' : 'assimilation',
          agenda: [], evidence, chamber: choice.box, outlet: memory.outlet },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label, preconditions: {},
          preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'marked_compartment_bound' : 'compartment_readiness_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) {
        return { matched: true, seal_prefix: true, reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      }
      const matched = before.level_epoch === after.level_epoch && changed(first, second, proposal.changedRegion);
      return { matched, seal_prefix: true, reason: matched ? 'local_compartment_change_observed' : 'no_local_compartment_change' };
    },
    async record(before, after, command, first, second, proposal) {
      if (after.levels_completed > before.levels_completed) await this.observePublicOutcome!(before, after, command, first, second);
      else attempted = [...attempted, proposal.attempt];
      return { events: [] };
    },
    state: () => ({ witness, attempted }),
    restore(value: NativeRecord) {
      witness = structuredClone((value.witness as Witness | undefined) ?? null);
      attempted = structuredClone((value.attempted as string[] | undefined) ?? []);
    },
  };
}
