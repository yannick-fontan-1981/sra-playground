import { composePlan } from './effect-composer.ts';
import { measureOrderedSupportScene, measureSupportBand, orderedSupportSelectionMatches,
  type MaterialBand, type OrderedSupportScene } from '../logos-engine/v6-ordered-support.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { observeSupports, type ObservedSupports } from './observed-supports.ts';

export const learnSupportMovesId = 'sic_learn_support_moves';
export const learnObservedSupportsId = 'sic_learn_observed_supports';

type Scene = OrderedSupportScene | ObservedSupports;
type Move = { source: number; destination: number; expected: number[][] };
type State = { epoch: number; selected: { member: MaterialBand; source: number; key: string; frameHash: string; scene: Scene } | null; effects: string[]; refused: string[] };
type Offer = NativeProposal & { local: State; move: Move; member: MaterialBand; key: string; phase: 'select' | 'deposit'; needId: string;
  scene: Scene };
const signature = (state: number[][]) => JSON.stringify(state);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const center = ([l,t,r,b]: NativeBox): NativePoint => [Math.floor((l+r)/2), Math.floor((t+b)/2)];

function supportClick(scene: Scene, index: number): NativeCommand {
  const point = 'contacts' in scene ? scene.contacts[index]! : scene.geometry.supports[index]!.point;
  const [x, y] = 'contacts' in scene ? point : [point[1], point[0]];
  return { action_ref: 'ACTION6', data: { x, y } };
}

function nextTransfer(scene: Scene, local: State): Move | null {
  const { configuration, target } = scene;
  const total = configuration.flat().length;
  const key = signature(configuration);
  const selected = local.selected?.key === key ? local.selected.source : null;
  const plan = composePlan<number[][], Move>({
    domain: 'ordered-support-transfer',
    initial: configuration, key: signature,
    goal: { relation: 'all pieces on the marked support', holds: state => state[target]!.length === total },
    budget: { commands: 12_000, states: 12_000 },
    *choices(state) {
      for (const [source, stack] of state.entries()) {
        if (state === configuration && selected !== null && selected !== source) continue;
        const piece = stack.at(-1);
        if (piece === undefined) continue;
        for (const [destination, receiver] of state.entries()) {
          if (destination === source) continue;
          if (state === configuration && local.refused.includes(JSON.stringify([key, source, destination]))) continue;
          const expected = state.map((support, i) => i === source ? support.slice(0,-1) : i === destination ? [...support, piece] : support);
          yield { action: { source, destination, expected }, after: expected, evidence: local.effects,
            requires: [{ relation: 'receiver accepts the order relationship',
              holds: () => (receiver.at(-1) ?? Infinity) > piece }] };
        }
      }
    },
  });
  return plan?.effects[0]?.action ?? null;
}

export function createSicLearnSupportMoves(family = learnSupportMovesId): NativeFamily<Offer> {
  const fromObservedSupports = family === learnObservedSupportsId;
  const readScene = (rows: NativeRows) => fromObservedSupports ? observeSupports(rows) : measureOrderedSupportScene(rows);
  async function deposited(offer: Offer, rows: NativeRows) {
    const scene = await readScene(rows);
    return !!scene && scene.target === offer.scene.target && same(scene.configuration, offer.move.expected)
      && same(scene.structural_supports, offer.scene.structural_supports);
  }
  let state: State | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: family,
    async attachPrograms(registry) {
      if (fromObservedSupports) decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const local: State = state?.epoch === observation.level_epoch && (!state.selected || state.selected.frameHash === observation.frame_hash)
        ? state : { epoch: observation.level_epoch, selected: null, effects: [], refused: [] };
      // The selection outline can cover parts of the structural supports.
      // Its verified frame binds the last complete measurement until deposit.
      const scene = local.selected?.scene ?? await readScene(rows);
      if (!scene) return null;
      const move = nextTransfer(scene, local);
      if (!move) return null;
      const layout = signature(scene.configuration);
      const phase = local.selected?.key === layout && local.selected.source === move.source ? 'deposit' : 'select';
      const member = phase === 'deposit' ? local.selected!.member
        : 'bands' in scene ? scene.bands[move.source]?.at(-1)
          : await measureSupportBand(rows, scene, move.source, scene.configuration[move.source]!.at(-1)!);
      if (!member) return null;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...local.effects.filter(value => value !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      const receiver = scene.structural_supports[move.destination]!.bbox;
      const action = supportClick(scene, phase === 'select' ? move.source : move.destination);
      const offer = { input: action.action_ref, expected: center(receiver), evidence };
      const known = local.effects.length >= 2;
      const legacy = fromObservedSupports ? null : resolveNavigationPrimitives({ mode, evidence, probe: known ? null : offer,
        access: known && phase === 'select' ? offer : null, interaction: known && phase === 'deposit' ? offer : null });
      const facts = { routeSupported: known && phase === 'select', eligibleProbe: !known, knownInteraction: known && phase === 'deposit', mode };
      const decision = fromObservedSupports ? await decide?.run({ situation: facts }, { signal: execution?.signal }) : undefined;
      const primitive = facts.routeSupported ? 'P07' : facts.knownInteraction ? 'P02' : 'P05';
      if (fromObservedSupports && decision?.result !== primitive) return null;
      const strategy = fromObservedSupports ? primitive : legacy?.selected?.id;
      if (!strategy) return null;
      const purpose = phase === 'select' ? 'Test or reuse selection of the exposed piece' : 'Check the deposit on a support with enough room';
      const witness = await ObservedInputDomain.makeLocusWitness(observation, rows, [action.data.x!, action.data.y!], { reason: purpose, evidence });
      if (!witness) return null;
      const actions = [action];
      const steps = [{ action, point_binding: witness, expected_after: phase === 'deposit' ? move.expected : null }];
      if (known && phase === 'select' && remaining > 1) {
        const deposit = supportClick(scene, move.destination);
        try {
          const receiverWitness = await ObservedInputDomain.makeLocusWitness(observation, rows, [deposit.data.x!, deposit.data.y!],
            { reason: 'Deposit the selected piece on the verified support', evidence });
          if (receiverWitness) {
            actions.push(deposit);
            steps.push({ action: deposit, point_binding: receiverWitness, expected_after: move.expected });
          }
        } catch (error) { if (!(error instanceof TypeError)) throw error; }
      }
      const parent = 'G_official_completion';
      const objective = { kind: 'move_exposed_pieces_to_receiving_support', scope: ref.split(':revision:',1)[0]!,
        subjects: ['exposed_piece', 'receiving_support'], parentObjective: parent, satisfactionContract: 'official_progress_after_verified_deposits' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = family + ':' + need.id;
      return {
        status: 'proposed', kind: family, local, move, member, phase, key: layout, needId: need.id,
        scene,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        actions, steps,
        ...(decision ? { sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts } } : {}),
        sicSituationCard: { strategy, need: 'Move exposed pieces to the indicated support', situation: purpose, evidence,
          agenda: legacy?.entries ?? [], mode, triggerCard: fromObservedSupports ? chooseLanding : legacy?.card,
          focus: member.bbox, target: receiver, goal: scene.structural_supports[scene.target]!.bbox },
        question: { reason: purpose, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: purpose, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(offer, index, _packet, current) {
      const admitted = index === 0 ? offer.binding?.observation_ref === current.observation_ref
        : index === 1 && offer.actions.length > 1 && offer.binding?.level_epoch === current.level_epoch;
      return { admitted, reason: admitted ? 'support_control_bound' : 'support_scene_changed' };
    },
    async after(offer, index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: offer.needId, status: 'satisfied' } };
      const selection = index === 0 && offer.phase === 'select';
      const matched = selection ? orderedSupportSelectionMatches(first, second, offer) : await deposited(offer, second);
      return { matched, seal_prefix: !matched || index + 1 >= offer.actions.length,
        reason: matched ? selection ? 'exposed_member_selected' : 'deposit_observed' : 'support_projection_refuted' };
    },
    async record(before, after, _command, first, second, offer, index) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { move, key } = offer;
      const local = (index > 0 && state?.selected?.frameHash === before.frame_hash ? state : null) ?? offer.local;
      const phase = index > 0 ? 'deposit' : offer.phase;
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
