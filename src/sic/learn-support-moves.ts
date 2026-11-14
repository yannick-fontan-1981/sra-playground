import { measureOrderedSupportScene, measureSupportBand, orderedSupportSelectionMatches,
  type MaterialBand, type OrderedSupportScene } from '../logos-engine/v6-ordered-support.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const learnSupportMovesId = 'sic_learn_support_moves';

type Move = { source: number; destination: number; expected: number[][] };
type State = { epoch: number; selected: { member: MaterialBand; source: number; key: string; frameHash: string; scene: OrderedSupportScene } | null; effects: string[]; refused: string[] };
type Offer = NativeProposal & { local: State; move: Move; member: MaterialBand; key: string; phase: 'select' | 'deposit'; needId: string;
  scene: OrderedSupportScene };
const signature = (state: number[][]) => JSON.stringify(state);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const center = ([l,t,r,b]: NativeBox): NativePoint => [Math.floor((l+r)/2), Math.floor((t+b)/2)];

function nextTransfer(scene: OrderedSupportScene, local: State): Move | null {
  const { configuration, target } = scene;
  const total = configuration.flat().length;
  const key = signature(configuration);
  const selected = local.selected?.key === key ? local.selected.source : null;
  const queue: { state: number[][]; first: Move | null }[] = [{ state: configuration, first: null }];
  const seen = new Set([key]);
  for (let cursor = 0; cursor < queue.length && cursor < 12000; cursor++) {
    const { state, first } = queue[cursor]!;
    if (state[target]!.length === total) return first;
    for (const [source, stack] of state.entries()) {
      if (!first && selected !== null && selected !== source) continue;
      const piece = stack.at(-1);
      if (piece === undefined) continue;
      for (const [destination, receiver] of state.entries()) {
        if (destination === source || (receiver.at(-1) ?? Infinity) <= piece) continue;
        if (!first && local.refused.includes(JSON.stringify([key, source, destination]))) continue;
        const expected = state.map((support, i) => i === source ? support.slice(0,-1) : i === destination ? [...support, piece] : support);
        const id = signature(expected);
        if (seen.has(id)) continue;
        seen.add(id);
        queue.push({ state: expected, first: first ?? { source, destination, expected } });
      }
    }
  }
  return null;
}

async function deposited(offer: Offer, rows: NativeRows) {
  const scene = await measureOrderedSupportScene(rows);
  return !!scene && scene.target === offer.scene.target && same(scene.configuration, offer.move.expected)
    && same(scene.structural_supports, offer.scene.structural_supports);
}

export function createSicLearnSupportMoves(): NativeFamily<Offer> {
  let state: State | null = null;
  return {
    id: learnSupportMovesId,
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const local = state?.epoch === observation.level_epoch && (!state.selected || state.selected.frameHash === observation.frame_hash)
        ? state : { epoch: observation.level_epoch, selected: null, effects: [], refused: [] };
      // The selection outline can cover parts of the structural supports.
      // Its verified frame binds the last complete measurement until deposit.
      const scene = local.selected?.scene ?? await measureOrderedSupportScene(rows);
      if (!scene) return null;
      const move = nextTransfer(scene, local);
      if (!move) return null;
      const layout = signature(scene.configuration);
      const phase = local.selected?.key === layout && local.selected.source === move.source ? 'deposit' : 'select';
      const member = phase === 'deposit' ? local.selected!.member
        : await measureSupportBand(rows, scene, move.source, scene.configuration[move.source]!.at(-1)!);
      if (!member) return null;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...local.effects.filter(value => value !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      const receiver = scene.structural_supports[move.destination]!.bbox;
      const [y,x] = scene.geometry.supports[phase === 'select' ? move.source : move.destination]!.point;
      const action = { action_ref: 'ACTION6', data: { x, y } };
      const offer = { input: action.action_ref, expected: center(receiver), evidence };
      const known = local.effects.length >= 2;
      const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence, probe: known ? null : offer,
        access: known && phase === 'select' ? offer : null, interaction: known && phase === 'deposit' ? offer : null });
      if (!selected) return null;
      const purpose = phase === 'select' ? 'Test or reuse selection of the exposed piece' : 'Check the deposit on a support with enough room';
      const witness = await ObservedInputDomain.makeLocusWitness(observation, rows, [x,y], { reason: purpose, evidence });
      if (!witness) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'move_exposed_pieces_to_receiving_support', scope: ref.split(':revision:',1)[0]!,
        subjects: ['exposed_piece', 'receiving_support'], parentObjective: parent, satisfactionContract: 'official_progress_after_verified_deposits' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = learnSupportMovesId + ':' + need.id;
      return {
        status: 'proposed', kind: learnSupportMovesId, local, move, member, phase, key: layout, needId: need.id,
        scene,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        actions: [action], steps: [{ action, point_binding: witness, expected_after: phase === 'deposit' ? move.expected : null }],
        sicSituationCard: { strategy: selected.id, need: 'Move exposed pieces to the indicated support', situation: purpose, evidence,
          agenda: entries, mode, triggerCard: card, focus: member.bbox, target: receiver, goal: scene.structural_supports[scene.target]!.bbox },
        question: { reason: purpose, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: purpose, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: selected.id, objective: { id, label: navigationPrimitives[selected.id], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(offer, index, _packet, current) {
      const admitted = index === 0 && offer.binding?.observation_ref === current.observation_ref;
      return { admitted, reason: admitted ? 'support_control_bound' : 'support_scene_changed' };
    },
    async after(offer, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: offer.needId, status: 'satisfied' } };
      const matched = offer.phase === 'select' ? orderedSupportSelectionMatches(first, second, offer) : await deposited(offer, second);
      return { matched, seal_prefix: true, reason: matched ? offer.phase === 'select' ? 'exposed_member_selected' : 'deposit_observed' : 'support_projection_refuted' };
    },
    async record(before, after, _command, first, second, offer) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, move, phase, key } = offer;
      const matched = phase === 'select' ? orderedSupportSelectionMatches(first, second, offer) : await deposited(offer, second);
      state = { ...local,
        selected: phase === 'select' && matched ? { member: offer.member, source: move.source, key, frameHash: after.frame_hash, scene: offer.scene } : null,
        effects: phase === 'deposit' && matched ? [...local.effects.slice(-3), after.observation_ref] : local.effects,
        refused: matched ? local.refused : [...local.refused.slice(-23), JSON.stringify([key, move.source, move.destination])] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
