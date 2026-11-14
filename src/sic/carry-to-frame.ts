import { center, correspondence, find_body, intersects, moved_core, near } from '../logos-engine/v6-object-binding-geometry.ts';
import { distance, shift } from '../logos-engine/v6-object-binding-planning.ts';
import type { NativeBox, NativeCommand, NativeEntity, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const carryToFrameId = 'sic_carry_to_frame';
export const carryToFrameStrategies = {
  measure_transport_control: 'Measure a command for the moving body',
  approach_matching_object: 'Move toward the object that fits the frame',
  test_transport_interaction: 'Test the interaction at the object',
  carry_toward_frame: 'Move the carried object toward its matching frame',
  test_delivery_at_frame: 'Test the same interaction when the object reaches the frame',
} as const;
const graph = compileStrategyGraph({ id: 'move_an_object_into_matching_frame', version: 1, order: 'FALLBACK',
  priorities: ['test_delivery_at_frame', 'test_transport_interaction', 'carry_toward_frame', 'approach_matching_object', 'measure_transport_control'],
  strategies: {
    measure_transport_control: [{ fact: 'probe', expected: true, label: 'A command may reveal a displacement toward the target' }],
    approach_matching_object: [{ fact: 'approach', expected: true, label: 'A measured move brings the body closer to the object' }],
    test_transport_interaction: [{ fact: 'pickup', expected: true, label: 'The body overlaps the current object position' }],
    carry_toward_frame: [{ fact: 'carry', expected: true, label: 'The carried object has room to approach the matching frame' }],
    test_delivery_at_frame: [{ fact: 'release', expected: true, label: 'A region moving with the body now touches the matching frame' }],
  },
}, ['probe', 'approach', 'pickup', 'carry', 'release']);
type Strategy = keyof typeof carryToFrameStrategies;
type Pair = { object: { bbox: NativeBox; palette_value: number; area: number }; frame: { bbox: NativeBox; interior_bbox: NativeBox } };
type State = { epoch: number; pair: Pair; actor: string | null; controls: Record<string, NativePoint>; held: NativeBox | null;
  movedTogether: boolean; interaction: string | null; tried: string[]; evidence: string[]; frame: string; stopped: boolean };
type Proposal = NativeProposal & { local: State; actor: NativeBox | null; subject: NativeBox; strategy: Strategy; needId: string; attempt: string };
const unit: Readonly<Record<string, NativePoint>> = { ACTION1: [0, -1], ACTION2: [0, 1], ACTION3: [-1, 0], ACTION4: [1, 0] };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const span = (box: NativeBox) => Math.max(box[2] - box[0] + 1, box[3] - box[1] + 1);
const overlaps = (a: NativeBox, b: NativeBox) => intersects(a, b);
const objectCandidates = (obs: NativeObservation, pair: Pair) => obs.entities.filter(e => e.palette_value === pair.object.palette_value
  && e.area >= Math.max(4, Math.ceil(pair.object.area / 2)) && e.bbox[0] !== e.bbox[2] && e.bbox[1] !== e.bbox[3]);

function actorMotion(proposal: Proposal, before: NativeObservation, after: NativeObservation) {
  if (!proposal.local.actor) return moved_core(before, after);
  const actor = find_body(after, proposal.local.actor) as NativeEntity | null;
  if (!actor || !proposal.actor) return null;
  return { signature: actor.signature, bbox: actor.bbox,
    delta: [actor.bbox[0] - proposal.actor[0], actor.bbox[1] - proposal.actor[1]] as NativePoint };
}

function returnedObject(proposal: Proposal, after: NativeObservation, delta: NativePoint) {
  const candidates = objectCandidates(after, proposal.local.pair), held = proposal.local.held;
  if (!held) return null;
  const projected = shift(held, delta);
  const exact = candidates.find(item => equal(item.bbox, projected));
  if (exact) return exact.bbox;
  const { frame } = proposal.local.pair;
  const touching = candidates.filter(item => overlaps(item.bbox, frame.bbox) &&
    distance(center(item.bbox), center(frame.bbox)) < distance(center(held), center(frame.bbox)));
  return touching.length === 1 && !candidates.some(item => equal(item.bbox, held)) ? touching[0]!.bbox : null;
}

export function createSicCarryToFrame(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: carryToFrameId,
    async propose(observation, rows, _inputs, remaining) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION5')) return null;
      const prior = state?.epoch === observation.level_epoch && state.frame === observation.frame_hash ? state : null;
      if (prior?.stopped || (prior?.tried.length ?? 0) >= 36) return null;
      const pairs = prior ? [] : correspondence(observation, rows) as Pair[];
      const pair = prior?.pair ?? (pairs.length === 1 ? pairs[0] : null);
      if (!pair) return null;
      const local = prior ?? { epoch: observation.level_epoch, pair, actor: null, controls: {}, held: null,
        movedTogether: false, interaction: null, tried: [], evidence: [], frame: observation.frame_hash, stopped: false };
      const actor = local.actor ? (find_body(observation, local.actor) as NativeEntity | null)?.bbox ?? null : null;
      if (local.actor && !actor) return null;
      const subject = local.held ?? pair.object.bbox;
      const target = local.held ? pair.frame.interior_bbox : subject;
      const current = local.held ?? actor;
      const remainingActions = observation.available_action_refs.filter(action =>
        !local.tried.includes(JSON.stringify([observation.frame_hash, action])));
      const moves = remainingActions.filter(action => unit[action]);
      const movesCloser = (point: NativePoint) => current && distance(center(shift(current, point)), center(target)) < distance(center(current), center(target));
      const learned = moves.filter(action => local.controls[action] && movesCloser(local.controls[action]!))
        .sort((a, b) => distance(center(shift(current!, local.controls[a]!)), center(target)) -
          distance(center(shift(current!, local.controls[b]!)), center(target)))[0];
      const experiment = moves.filter(action => !local.controls[action]).sort((a, b) =>
        Number(!!movesCloser(unit[b]!)) - Number(!!movesCloser(unit[a]!)))[0];
      const pickup = !!actor && !local.held && near(actor, subject) && remainingActions.includes('ACTION5');
      const release = !!local.held && local.movedTogether && near(local.held, pair.frame.bbox) &&
        !!local.interaction && remainingActions.includes(local.interaction);
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        probe: { value: !!experiment, evidence }, approach: { value: !!learned && !local.held, evidence },
        pickup: { value: pickup, evidence }, carry: { value: !!learned && !!local.held, evidence }, release: { value: release, evidence },
      }, planners: { measure_transport_control: () => experiment ?? null, approach_matching_object: () => learned ?? null,
        test_transport_interaction: () => 'ACTION5', carry_toward_frame: () => learned ?? null, test_delivery_at_frame: () => local.interaction } });
      if (!selected) return null;
      const strategy = selected.id, label = carryToFrameStrategies[strategy], parent = 'G_official_completion';
      const command: NativeCommand = { action_ref: selected.plan, data: {} };
      const goal = { kind: 'deliver_fitting_object', scope: ref.split(':revision:', 1)[0]!, subjects: ['matching_object', 'receiving_frame'],
        parentObjective: parent, satisfactionContract: 'observe_official_progress_or_object_retained_in_the_frame' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `carry-to-frame:${need.id}`, actions = [command];
      return { status: 'proposed', kind: carryToFrameId, actions, local, actor, subject, strategy, needId: need.id,
        attempt: JSON.stringify([observation.frame_hash, command.action_ref]),
        steps: [{ action: command, expected_after: null }], binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Bring the object to the frame that matches it', mode: learned ? 'solving' : 'exploration',
          situation: release ? 'The object color has travelled with the controlled body and now touches the frame. Delivery awaits the return.' : label,
          agenda: entries, evidence, actor, object: subject, frame: pair.frame.bbox },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'transport_context_bound' : 'transport_context_changed' };
    },
    after(proposal, _index, before, after) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      return { matched: null, seal_prefix: true, reason: 'observe_completed_motion_or_transport_interaction' };
    },
    record(before, after, command, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, strategy } = proposal;
      const motion = actorMotion(proposal, before, after), delta = motion?.delta as NativePoint | undefined;
      const controls = { ...local.controls };
      let held = local.held, interaction = local.interaction, stopped = false, movedTogether = local.movedTogether;
      if (strategy === 'test_transport_interaction' && motion && delta && !delta.some(Boolean)) {
        const changed = objectCandidates(after, local.pair).filter(e => near(e.bbox, motion.bbox) && !equal(e.bbox, proposal.subject)
          && distance(center(e.bbox), center(motion.bbox)) <= 2 * span(proposal.subject));
        if (changed.length === 1) { held = changed[0]!.bbox; interaction = command.action_ref; }
      } else if (strategy === 'test_delivery_at_frame') {
        stopped = true;
      } else if (unit[command.action_ref] && motion && delta?.some(Boolean)) {
        if (local.held) {
          const next = returnedObject(proposal, after, delta);
          if (next) { held = next; movedTogether = true; } else { stopped = true; }
        }
        if (Math.abs(delta[0]) + Math.abs(delta[1]) <= span(motion.bbox)) controls[command.action_ref] = delta;
      }
      const candidates = !held ? (correspondence(after, second, motion?.signature ?? local.actor) as Pair[]).filter(p =>
        equal(p.frame.bbox, local.pair.frame.bbox) && near(p.object.bbox, local.pair.object.bbox)) : [];
      const pair = candidates.length === 1 ? candidates[0]! : local.pair;
      state = { ...local, pair, actor: motion?.signature ?? local.actor, held, movedTogether, interaction, controls, stopped,
        frame: after.frame_hash, tried: [...local.tried, proposal.attempt], evidence: [...local.evidence.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
