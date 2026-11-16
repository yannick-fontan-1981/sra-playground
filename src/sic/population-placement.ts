import { maximumInjectiveMatching } from '../logos-engine/v5-reference-population-calculus.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { measureReferencePopulation, referencePopulationCellKey, referencePopulationPaths, referencePopulationPoint,
  type ReferencePopulationCell } from '../logos-engine/v6-reference-population-observation.ts';
import { sicNeedId } from './need-identity.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { observedMechanicsGroup } from './strategy-agenda.ts';

export const populationPlacementId = 'sic_population_placement';
export const verifyReferencePlacementId = 'sic_verify_reference_placement';
export const populationPlacementStrategies = {
  select_unplaced_piece: 'Select a piece outside the reference positions',
  test_selected_displacement: 'Measure a direction for the selected piece',
  move_to_assigned_slot: 'Move toward a distinct position required by the reference',
} as const;

type Cell = ReferencePopulationCell;
type Scene = { q: number; offset: Cell; floor: Cell[]; zone_box: NativeBox; reference_box: NativeBox; reference_digest: string;
  target: [number, number, number][]; background: number; empty: number; border: number; population: number;
  bodies: { cell: Cell; appearance: number }[]; observed_marker_overlays?: number[][] };
type Controls = Record<string, { delta: Cell }>;
type Assignment = { slot: Cell; previous: Cell; retained: boolean };
type State = { epoch: number; scene: Scene; selection: Cell | null; active: boolean; controls: Controls;
  tried: string[]; evidence: string[]; frame: string; stopped: boolean; probes?: number; changedNeighbors?: Cell[];
  assignment?: Assignment | null; ordered?: Choice[] };
type PlacementWitness = { epoch: number; score: number; pitch: number; controls: Controls; evidence: string[] };
type Choice = { command: NativeCommand; cell: Cell; expected: Cell | null; slot: Cell | null; retainsSlot?: boolean; ordered?: boolean };
type Proposal = NativeProposal & { local: State; choice: Choice; strategy: keyof typeof populationPlacementStrategies; needId: string };
const key = referencePopulationCellKey;
const cardinal = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'];
const neighbors: readonly Cell[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const distance = ([y, x]: Cell, [r, c]: Cell) => Math.abs(y - r) + Math.abs(x - c);
const cellBox = (scene: Scene, [row, col]: Cell): NativeBox => {
  const x = scene.offset[1] + col * scene.q, y = scene.offset[0] + row * scene.q;
  return [x, y, x + scene.q - 2, y + scene.q - 2];
};

function compareMovement({ local, choice }: Proposal, rows: NativeRows) {
  const next = measureReferencePopulation(rows, local.scene) as Scene | null;
  if (!next) return null;
  const occupied = new Set(local.scene.bodies.map(body => key(body.cell))), current = new Set(next.bodies.map(body => key(body.cell)));
  const gone = [...occupied].filter(cell => !current.has(cell)), added = next.bodies.filter(body => !occupied.has(key(body.cell)));
  if (!gone.length && !added.length) return { next, destination: null };
  if (gone.length !== 1 || gone[0] !== key(choice.cell) || added.length !== 1 || distance(choice.cell, added[0]!.cell) !== 1) return null;
  return { next, destination: added[0]!.cell };
}

function changedNeighbors(previous: Scene, current: Scene, from: Cell, to: Cell): Cell[] {
  return previous.bodies.flatMap(body => {
    if (distance(body.cell, from) !== 1 && distance(body.cell, to) !== 1) return [];
    const after = current.bodies.find(candidate => key(candidate.cell) === key(body.cell));
    return after && after.appearance !== body.appearance ? [body.cell] : [];
  });
}

function selectionScene(scene: Scene, cell: Cell, first: NativeRows, second: NativeRows) {
  const [l, t, r, b] = cellBox(scene, cell), changed: number[][] = [];
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
    const value = second[y]?.[x];
    if (value !== undefined && value !== first[y]?.[x]) changed.push([y - t, x - l, value]);
  }
  if (changed.length !== 1) return null;
  const overlays = [...(scene.observed_marker_overlays ?? []), changed[0]!];
  const next = measureReferencePopulation(second, { ...scene, observed_marker_overlays: overlays }) as Scene | null;
  return next && next.bodies.every((body, index) => key(body.cell) === key(scene.bodies[index]!.cell)) ? next : null;
}

function orderReferencePlacements(scene: Scene, controls: Controls, deadline: number): Choice[] | null {
  const targets = scene.target.map(([row, col]): Cell => [row, col]);
  const targetKeys = new Set(targets.map(key)), floor = new Set(scene.floor.map(key));
  const openEdges = ([row, col]: Cell) => neighbors
    .map(([dy, dx]): Cell => [row + dy, col + dx]).filter(cell => floor.has(key(cell)));
  // A destination surrounded by other destinations can be isolated by an otherwise valid matching.
  if (!targets.some(slot => openEdges(slot).length && openEdges(slot).every(cell => targetKeys.has(key(cell))))) return null;
  const entrances = new Map(targets.map(slot => [key(slot), openEdges(slot).filter(cell => !targetKeys.has(key(cell))).length]));
  const failed = new Set<string>();
  let examined = 0;
  const search = (bodies: Cell[]): Choice[] | null => {
    if (++examined > 256 || performance.now() >= deadline) return null;
    const occupied = new Set(bodies.map(key));
    const identity = [...occupied].sort().join('|');
    if (failed.has(identity)) return null;
    const slots = targets.filter(slot => !occupied.has(key(slot)));
    if (!slots.length) return [];
    const pieces = bodies.filter(cell => !targetKeys.has(key(cell)));
    const paths = pieces.map(cell => referencePopulationPaths(cell, floor, occupied, controls));
    const domains = paths.map(path => slots.filter(slot => path.has(key(slot))));
    if (maximumInjectiveMatching(domains)[1].length) {
      failed.add(identity);
      return null;
    }
    const candidates = pieces.flatMap((from, index) => domains[index]!.map(slot => ({
      from, slot, route: paths[index]!.get(key(slot))!,
    })));
    candidates.sort((a, b) => entrances.get(key(a.slot))! - entrances.get(key(b.slot))!
      || a.route[0].length - b.route[0].length);
    for (const { from, slot, route: [commands, path] } of candidates) {
      const remainder = search(bodies.map(cell => key(cell) === key(from) ? slot : cell));
      if (!remainder) continue;
      const select: Choice = { command: { action_ref: 'ACTION6', data: referencePopulationPoint(scene, from) },
        cell: from, slot, expected: null, ordered: true };
      return [select, ...commands.map((command, index): Choice => ({
        command: { action_ref: command.action_ref, data: {} }, cell: path[index]!, expected: path[index + 1]!, slot, ordered: true,
      })), ...remainder];
    }
    failed.add(identity);
    return null;
  };
  return search(scene.bodies.map(body => body.cell));
}

export function createSicVerifyReferencePlacement(): NativeFamily<Proposal> {
  let state: State | null = null;
  let witness: PlacementWitness | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: verifyReferencePlacementId,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async proposeInGroup(group, observation, rows, inputs, remaining, execution): Promise<Proposal | null> {
      if (group !== observedMechanicsGroup) return this.propose(observation, rows, inputs, remaining, execution);
      const epoch = observation.level_epoch;
      const continuing = state?.epoch === epoch && state.frame === observation.frame_hash && state.ordered?.length;
      const transferred = witness?.epoch === epoch && witness.score === observation.levels_completed;
      if (!continuing && !transferred) return null;
      const proposal = await this.propose(observation, rows, inputs, remaining, execution);
      return proposal?.choice.ordered ? proposal : null;
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const available = cardinal.filter(action => observation.available_action_refs.includes(action));
      if (!available.length) return null;
      const prior = state?.epoch === observation.level_epoch && state.frame === observation.frame_hash ? state : null;
      if (prior?.stopped) return null;
      const scene = prior?.scene ?? (measureReferencePopulation(rows) as Scene | null);
      if (!scene || scene.floor.length > 256 || scene.population > 8) return null;
      if ((prior?.probes ?? 0) >= Math.max(20, scene.population * available.length)) return null;
      const transferred = witness?.epoch === observation.level_epoch && witness.score === observation.levels_completed && witness.pitch === scene.q
        ? witness : null;
      let local: State = prior ?? { epoch: observation.level_epoch, scene, selection: null, active: false,
        controls: transferred?.controls ?? {}, tried: [], evidence: transferred?.evidence ?? [], frame: observation.frame_hash, stopped: false };
      const targets = scene.target.map(([y, x]): Cell => [y, x]), occupied = new Set(scene.bodies.map(body => key(body.cell)));
      const unsettled = scene.bodies.map(body => body.cell).filter(cell => targets.every(target => key(target) !== key(cell)));
      const empty = targets.filter(cell => !occupied.has(key(cell)));
      if (!empty.length || unsettled.length !== empty.length) return null;
      const controls = Object.fromEntries(available.flatMap(action => local.controls[action] ? [[action, local.controls[action]]] : []));
      if (!local.ordered?.length && Object.keys(controls).length === available.length) {
        const plan = orderReferencePlacements(scene, controls, Math.min(execution?.deadlineMs ?? Infinity, performance.now() + 300));
        if (plan?.length) local = { ...local, ordered: plan };
      }
      const index = unsettled.findIndex(cell => local.selection && key(cell) === key(local.selection));
      let move: Choice | null = null, probe: Choice | null = null, pick: Choice | null = null;
      const ordered = local.ordered?.[0];
      if (ordered) {
        if (ordered.command.action_ref === 'ACTION6') pick = ordered;
        else if (local.active) move = ordered;
        else probe = ordered;
      } else if (index >= 0) {
        const paths = unsettled.map(cell => referencePopulationPaths(cell, scene.floor, occupied, controls));
        const domains = paths.map(path => empty.filter(slot => path.has(key(slot))).sort((a, b) =>
          path.get(key(a))![0].length - path.get(key(b))![0].length));
        const [matching, missing] = maximumInjectiveMatching(domains);
        const assignment = matching.find(([body]) => body === index);
        const cell = unsettled[index]!;
        if ((local.active || transferred) && !missing.length && assignment) {
          let slot: Cell = [assignment[1][0]!, assignment[1][1]!];
          let [word, path] = paths[index]!.get(key(slot))!;
          let retainsSlot = false;
          const previous = local.assignment;
          if (previous && (previous.retained || key(path[1]!) === key(previous.previous))) {
            const previousKey = key(previous.slot), retained = paths[index]!.get(previousKey);
            if (retained && empty.some(target => key(target) === previousKey)) {
              const [, unfilled] = maximumInjectiveMatching(domains.map((domain, i) =>
                i === index ? [previous.slot] : domain.filter(target => key(target) !== previousKey)));
              if (!unfilled.length) {
                slot = previous.slot;
                [word, path] = retained;
                retainsSlot = true;
              }
            }
          }
          const approach = { command: { action_ref: word[0]!.action_ref, data: {} }, cell, slot, expected: path[1]!,
            ...(retainsSlot ? { retainsSlot } : {}) };
          if (local.active) move = approach;
          else probe = approach;
        }
        const unexplored = available.filter(action => !local.tried.includes(JSON.stringify([action, cell])) && !local.controls[action]);
        const action = local.active ? unexplored[0] : [...unexplored, ...available.filter(command =>
          !local.tried.includes(JSON.stringify([command, cell])))][0];
        if (action && !probe) probe = { command: { action_ref: action, data: {} }, cell, slot: null, expected: null };
      }
      if (!ordered && index < 0) {
        const score = (cell: Cell) => Math.min(...empty.map(slot => distance(cell, slot)));
        const cell = [...unsettled].sort((a, b) => score(a) - score(b))[0]!;
        pick = { command: { action_ref: 'ACTION6', data: referencePopulationPoint(scene, cell) }, cell, slot: null, expected: null };
      }
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const trial = probe ?? pick;
      const mode = execution?.reasoningMode ?? (move ? 'solving' : 'exploration');
      const facts = { routeSupported: !!move, eligibleProbe: !!trial, knownInteraction: false, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = decision?.result;
      if (!decision || (strategy !== 'P07' && strategy !== 'P05')) return null;
      const choice = strategy === 'P07' ? move : trial;
      if (!choice) return null;
      const phase = strategy === 'P07' ? 'move_to_assigned_slot'
        : choice === pick ? 'select_unplaced_piece' : 'test_selected_displacement';
      const label = populationPlacementStrategies[phase], parent = 'G_official_completion';
      const goal = { kind: 'match_reference_occupancy', scope: scene.reference_digest, subjects: ['movable_pieces', 'distinct_reference_slots'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_matching_reference_positions' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `population-placement:${need.id}`, actions = [choice.command];
      const point = [choice.command.data.x, choice.command.data.y] as NativePoint;
      const binding = phase === 'select_unplaced_piece'
        ? await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: label, evidence }) : undefined;
      return { status: 'proposed', kind: verifyReferencePlacementId, actions, local, choice, strategy: phase, needId: need.id,
        steps: [{ action: choice.command, expected_after: choice.ordered && choice.expected ? cellBox(scene, choice.expected) : null,
          ...(binding ? { point_binding: binding } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Occupy the positions shown by the reference', mode,
          situation: choice.ordered && local.changedNeighbors?.length
            ? 'A neighbor changed color. Continue in the order that keeps the remaining positions reachable.'
            : choice.ordered ? 'Place the pieces in an order that keeps the remaining positions reachable.'
            : choice.retainsSlot ? 'Keep the selected piece’s reachable destination and preserve an assignment for every other piece.'
            : choice.slot && local.changedNeighbors?.length
            ? 'A neighboring piece changed color after the last move. Check the next position against the current reference.'
            : choice.slot ? 'The matched position is reachable with measured commands. Color interactions still need confirmation.' : label,
          agenda: [], evidence, triggerCard: decision.receipt.workflow,
          piece: cellBox(scene, choice.cell), target: choice.slot ? cellBox(scene, choice.slot) : scene.zone_box,
          reference: scene.reference_box,
          ...(local.changedNeighbors?.length ? { neighbors: local.changedNeighbors.map(cell => cellBox(scene, cell)) } : {}) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'population_and_reference_bound' : 'population_or_reference_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      if (proposal.strategy === 'select_unplaced_piece') {
        const matched = !!selectionScene(proposal.local.scene, proposal.choice.cell, first, second);
        return { matched, seal_prefix: true, reason: matched ? 'selection_marker_observed' : 'selection_unconfirmed' };
      }
      const measured = compareMovement(proposal, second), expected = proposal.choice.expected;
      const matched = !!measured && (!expected || !!measured.destination && key(measured.destination) === key(expected));
      return { matched, seal_prefix: true, reason: matched ? 'population_return_measured' : 'population_effect_contradicted' };
    },
    record(before, after, _command, first, second, proposal) {
      const { local, choice, strategy } = proposal;
      if (after.levels_completed > before.levels_completed && choice.expected && Object.keys(local.controls).length >= 2) {
        const expected = new Set(local.scene.bodies.map(body => key(key(body.cell) === key(choice.cell) ? choice.expected! : body.cell)));
        if (local.scene.target.every(([y, x]) => expected.has(key([y, x])))) {
          witness = { epoch: after.level_epoch, score: after.levels_completed, pitch: local.scene.q, controls: local.controls,
            evidence: [...local.evidence.slice(-3), before.observation_ref, after.observation_ref] };
        }
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const evidence = [...local.evidence.slice(-4), after.observation_ref];
      const current = { ...local, frame: after.frame_hash, evidence };
      if (strategy === 'select_unplaced_piece') {
        const measured = selectionScene(local.scene, choice.cell, first, second);
        state = { ...current, scene: measured ?? local.scene, selection: choice.cell, active: false, stopped: !measured,
          ...(choice.ordered && measured ? { ordered: local.ordered!.slice(1) } : {}),
          ...(local.assignment ? { assignment: null } : {}) };
        return { events: [] };
      }
      const measured = compareMovement(proposal, second), destination = measured?.destination;
      const tried = [...local.tried, JSON.stringify([choice.command.action_ref, choice.cell])];
      const controls = { ...local.controls };
      const contradicted = !!choice.expected && (!destination || key(destination) !== key(choice.expected));
      if (contradicted) delete controls[choice.command.action_ref];
      if (destination) controls[choice.command.action_ref] = { delta: [destination[0] - choice.cell[0], destination[1] - choice.cell[1]] };
      const neighbors = measured && destination ? changedNeighbors(local.scene, measured.next, choice.cell, destination) : [];
      const assignment = choice.slot && destination && !contradicted && key(destination) !== key(choice.slot)
        ? { slot: choice.slot, previous: choice.cell, retained: choice.retainsSlot ?? false } : null;
      state = { ...current, scene: measured?.next ?? local.scene, selection: destination ?? choice.cell,
        active: local.active || !!destination, tried, controls, stopped: !measured, changedNeighbors: neighbors,
        ...(choice.ordered ? { ordered: contradicted ? [] : local.ordered!.slice(1) } : {}),
        ...(assignment || local.assignment ? { assignment } : {}),
        probes: (local.probes ?? 0) + Number(strategy === 'test_selected_displacement' || contradicted) };
      return { events: [], ...(neighbors.length ? { reviewEvidence: 'A stationary neighbor changed appearance after the selected piece moved' } : {}) };
    },
    state: () => ({ state, witness }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      witness = structuredClone((value.witness as PlacementWitness | null | undefined) ?? null);
    },
  };
}
