import { maximumInjectiveMatching } from '../logos-engine/v5-reference-population-calculus.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { measureReferencePopulation, referencePopulationCellKey, referencePopulationLocalRelations, referencePopulationNeighborhood,
  referencePopulationPaths, referencePopulationPoint,
  type ReferencePopulationCell } from '../logos-engine/v6-reference-population-observation.ts';
import { sicNeedId } from './need-identity.ts';
import { maximumCommittedActions } from './plan-step.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { observedMechanicsGroup } from './strategy-agenda.ts';
import { readPopulationZones, populationZoneTargets, type PopulationZone } from './population-zones.ts';

export const populationPlacementId = 'sic_population_placement';
export const verifyReferencePlacementId = 'sic_verify_reference_placement';
export const learnReferencePlacementId = 'sic_learn_reference_placement';
export const populationPlacementStrategies = {
  select_unplaced_piece: 'Select a piece outside the reference positions',
  test_selected_displacement: 'Measure a direction for the selected piece',
  move_to_assigned_slot: 'Move toward a distinct position required by the reference',
} as const;

type Cell = ReferencePopulationCell;
type Scene = { q: number; offset: Cell; floor: Cell[]; zone_box: NativeBox; reference_box: NativeBox; reference_digest: string;
  target: [number, number, number][]; background: number; empty: number; border: number; population: number;
  bodies: { cell: Cell; appearance: number }[]; observed_marker_overlays?: number[][]; comparisonCells?: Cell[] };
type Controls = Record<string, { delta: Cell }>;
type Neighborhood = Partial<Record<number, { appearance: number | null; ref: string }>>;
type Support = { cells: Cell[]; evidence: string[] };
type Assignment = { slot: Cell; previous: Cell; retained: boolean };
type State = { epoch: number; scene: Scene; selection: Cell | null; active: boolean; controls: Controls;
  tried: string[]; evidence: string[]; frame: string; stopped: boolean; probes?: number; changedNeighbors?: Cell[];
  assignment?: Assignment | null; ordered?: Choice[]; neighborhood?: Neighborhood; support?: Support | null; rejectedSupport?: string[] };
type PlacementWitness = { epoch: number; score: number; pitch: number; controls: Controls; evidence: string[]; neighborhood?: Neighborhood };
type Choice = { command: NativeCommand; cell: Cell; expected: Cell | null; slot: Cell | null; retainsSlot?: boolean; ordered?: boolean };
type Proposal = NativeProposal & { local: State; choice: Choice; route?: Choice[]; strategy: keyof typeof populationPlacementStrategies; needId: string };
const key = referencePopulationCellKey;
const supportKey = (cells: readonly Cell[]) => cells.length === 1 ? key(cells[0]!)
  : JSON.stringify([...cells].sort(([row, col], [otherRow, otherCol]) => row - otherRow || col - otherCol));
const supportAttempt = (scene: Scene, cells: readonly Cell[]) => scene.comparisonCells
  ? JSON.stringify([scene.target, supportKey(cells)]) : supportKey(cells);
const cardinal = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'];
const neighbors: readonly Cell[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const distance = ([y, x]: Cell, [r, c]: Cell) => Math.abs(y - r) + Math.abs(x - c);
const cellBox = (scene: Scene, [row, col]: Cell): NativeBox => {
  const x = scene.offset[1] + col * scene.q, y = scene.offset[0] + row * scene.q;
  return [x, y, x + scene.q - 2, y + scene.q - 2];
};

function compareMovement({ local, choice }: Pick<Proposal, 'local' | 'choice'>, rows: NativeRows) {
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

function rememberNeighborhood(scene: Scene, previous: Neighborhood | undefined, ref: string): Neighborhood {
  const result = { ...previous };
  for (const { local_direction_mask: mask, appearance } of referencePopulationLocalRelations(scene)) {
    const known = result[mask];
    if (!known) result[mask] = { appearance, ref };
    else if (known.appearance !== null && known.appearance !== appearance) result[mask] = { appearance: null, ref };
  }
  return result;
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

function orderReferencePlacements(scene: Scene, controls: Controls, deadline: number, positions?: Cell[]): Choice[] | null {
  const targets = positions ?? scene.target.map(([row, col]): Cell => [row, col]);
  const targetKeys = new Set(targets.map(key)), floor = new Set(scene.floor.map(key));
  const openEdges = ([row, col]: Cell) => neighbors
    .map(([dy, dx]): Cell => [row + dy, col + dx]).filter(cell => floor.has(key(cell)));
  // A destination surrounded by other destinations can be isolated by an otherwise valid matching.
  if (!positions && !targets.some(slot => openEdges(slot).length && openEdges(slot).every(cell => targetKeys.has(key(cell))))) return null;
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

function supportEvidence(scene: Scene, cells: readonly Cell[], neighborhood: Neighborhood): string[] | null {
  const occupied = new Set([...cells.map(key), ...scene.target.map(([y, x]) => key([y, x]))]);
  const refs = new Set<string>();
  for (const [y, x, appearance] of scene.target) {
    const { local_direction_mask: mask } = referencePopulationNeighborhood([y, x], occupied);
    const observed = neighborhood[mask];
    if (!observed || observed.appearance !== appearance) return null;
    refs.add(observed.ref);
  }
  return [...refs];
}

function planSupport(local: State, controls: Controls, deadline: number): { support: Support; ordered: Choice[] } | null {
  const { scene, neighborhood } = local;
  if (!neighborhood) return null;
  const target = scene.target.map(([row, col]): Cell => [row, col]), surplus = scene.population - target.length;
  const targetKeys = new Set(target.map(key)), floor = new Set(scene.floor.map(key));
  const compared = new Set(scene.comparisonCells?.map(key));
  const candidates = new Map<string, Cell>();
  for (const [row, col] of target) for (const [dy, dx] of neighbors) {
    const cell: Cell = [row + dy, col + dx], id = key(cell);
    if (floor.has(id) && !targetKeys.has(id) && !compared.has(id)) candidates.set(id, cell);
  }
  const positions = [...candidates.values()], rejected = new Set(local.rejectedSupport);
  let best: { support: Support; ordered: Choice[] } | null = null;
  const evaluate = (cells: Cell[]) => {
    if (rejected.has(supportAttempt(scene, cells))) return;
    const evidence = supportEvidence(scene, cells, neighborhood);
    if (!evidence) return;
    const plan = orderReferencePlacements(scene, controls, deadline, [...target, ...cells]);
    if (!plan?.length) return;
    const ordered = local.selection && key(local.selection) === key(plan[0]!.cell) ? plan.slice(1) : plan;
    if (ordered.length && (!best || ordered.length < best.ordered.length)) {
      best = { support: { cells, evidence }, ordered };
    }
  };
  function choose(start: number, cells: Cell[]) {
    const missing = surplus - cells.length;
    if (!missing) return evaluate(cells);
    for (let i = start; i <= positions.length - missing && performance.now() < deadline; i++) {
      choose(i + 1, [...cells, positions[i]!]);
    }
  }
  choose(0, []);
  return best;
}

function planInMeasuredZone(local: State, controls: Controls, zones: PopulationZone[], deadline: number) {
  let best: { scene: Scene; support: Support; ordered: Choice[] } | null = null;
  for (const { positions, zone } of populationZoneTargets(local.scene.target, zones)) {
    if (performance.now() >= deadline) break;
    const scene = { ...local.scene, target: positions, zone_box: zone.box, comparisonCells: zone.cells };
    const plan = planSupport({ ...local, scene }, controls, deadline);
    if (plan && (!best || plan.ordered.length < best.ordered.length)) best = { ...plan, scene };
  }
  return best;
}

export function createSicVerifyReferencePlacement(family = verifyReferencePlacementId, transferObservedPlacement = false): NativeFamily<Proposal> {
  const learns = family === learnReferencePlacementId;
  let state: State | null = null;
  let witness: PlacementWitness | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: family,
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
      const recall = transferObservedPlacement && witness?.epoch === observation.level_epoch && witness.score === observation.levels_completed;
      const click = learns && !prior && !recall ? await execution?.readPriorClickScene?.((first, _before, command) => {
        const previous = measureReferencePopulation(first) as Scene | null;
        if (!previous) return null;
        const { x, y } = command.data;
        const piece = previous.bodies.find(({ cell }) => {
          const [l, t, r, b] = cellBox(previous, cell);
          return x! >= l && x! <= r && y! >= t && y! <= b;
        });
        if (!piece) return null;
        const scene = selectionScene(previous, piece.cell, first, rows);
        return scene ? { scene, selection: piece.cell } : null;
      }) : null;
      if (learns && !prior && !recall && (!click || click.afterRef !== observation.observation_ref || click.levelEpoch !== observation.level_epoch)) return null;
      const previous = witness?.epoch === observation.level_epoch && witness.score === observation.levels_completed ? witness : null;
      let scene = prior?.scene ?? click?.scene.scene ?? (measureReferencePopulation(rows) as Scene | null)
        ?? (previous?.neighborhood ? measureReferencePopulation(rows, null, { allowSurplus: true }) as Scene | null : null);
      if (!scene || scene.floor.length > 256) return null;
      if ((prior?.probes ?? 0) >= Math.max(20, scene.population * available.length)) return null;
      const transferred = previous?.pitch === scene.q ? previous : null;
      let local: State = prior ?? { epoch: observation.level_epoch, scene, selection: click?.scene.selection ?? null, active: false,
        controls: transferred?.controls ?? {}, tried: [], evidence: click ? [click.beforeRef, click.afterRef] : transferred?.evidence ?? [],
        frame: observation.frame_hash, stopped: false,
        ...(transferred?.neighborhood ? { neighborhood: transferred.neighborhood } : {}) };
      if (local.support && !supportEvidence(scene, local.support.cells, local.neighborhood ?? {})) {
        local = { ...local, support: null, ordered: [] };
      }
      const surplus = scene.population - scene.target.length;
      const controls = Object.fromEntries(available.flatMap(action => local.controls[action] ? [[action, local.controls[action]]] : []));
      if (!local.ordered?.length && Object.keys(controls).length === available.length) {
        const deadline = Math.min(execution?.deadlineMs ?? Infinity, performance.now() + 300);
        if (surplus > 0) {
          const zones = readPopulationZones(rows, scene);
          const support = zones.length > 1 ? planInMeasuredZone(local, controls, zones, deadline) : planSupport(local, controls, deadline);
          if (support) {
            local = { ...local, ...support };
            scene = local.scene;
          }
        } else if (surplus === 0) {
          const plan = orderReferencePlacements(scene, controls, deadline);
          if (plan?.length) local = { ...local, ordered: plan };
        }
      }
      if ((surplus || scene.population > 8) && !local.ordered?.length) return null;
      const targets = scene.target.map(([y, x]): Cell => [y, x]);
      if (local.support) targets.push(...local.support.cells);
      const occupied = new Set(scene.bodies.map(body => key(body.cell)));
      const unsettled = scene.bodies.map(body => body.cell).filter(cell => targets.every(target => key(target) !== key(cell)));
      const empty = targets.filter(cell => !occupied.has(key(cell)));
      if (!empty.length || unsettled.length !== empty.length) return null;
      const index = unsettled.findIndex(cell => local.selection && key(cell) === key(local.selection));
      let move: Choice | null = null, probe: Choice | null = null, pick: Choice | null = null;
      let route: Choice[] = [];
      const ordered = local.ordered?.[0];
      if (ordered) {
        if (ordered.command.action_ref === 'ACTION6') pick = ordered;
        else if (local.active) {
          move = ordered;
          for (const choice of local.ordered!) {
            if (!choice.expected || !controls[choice.command.action_ref]) break;
            route.push(choice);
          }
        }
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
          if (local.active) {
            move = approach;
            route = [approach, ...word.slice(1).map((action, index) => ({ command: { action_ref: action.action_ref, data: {} },
              cell: path[index + 1]!, expected: path[index + 2]!, slot, ...(retainsSlot ? { retainsSlot } : {}) }))];
          }
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
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...new Set([...local.evidence, ...(local.support?.evidence ?? [])].filter(value => value !== ref))];
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
      const supportMove = local.support?.cells.some(cell => choice.slot && key(choice.slot) === key(cell));
      const multipleSupports = (local.support?.cells.length ?? 0) > 1;
      const predictedNeighbors = supportMove ? scene.target.flatMap(([y, x]): NativeBox[] =>
        distance([y, x], choice.slot!) === 1 && occupied.has(key([y, x])) ? [cellBox(scene, [y, x])] : []) : [];
      const label = populationPlacementStrategies[phase], parent = 'G_official_completion';
      const goal = { kind: 'match_reference_occupancy', scope: scene.reference_digest, subjects: ['movable_pieces', 'distinct_reference_slots'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_matching_reference_positions' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `population-placement:${need.id}`;
      const planned = strategy === 'P07' && route.length > 1 ? route.slice(0, Math.min(remaining, maximumCommittedActions)) : [choice];
      const actions = planned.map(step => step.command);
      const point = [choice.command.data.x, choice.command.data.y] as NativePoint;
      const binding = phase === 'select_unplaced_piece'
        ? await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: label, evidence }) : undefined;
      return { status: 'proposed', kind: family, actions, local, choice, strategy: phase, needId: need.id,
        ...(planned.length > 1 ? { route: planned } : {}),
        steps: planned.map(step => ({ action: step.command, expected_after: (step.ordered || planned.length > 1) && step.expected
          ? cellBox(scene, step.expected) : null, ...(binding ? { point_binding: binding } : {}) })),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Occupy the positions shown by the reference', mode,
          situation: supportMove ? 'Place this piece beside the reference to reproduce the expected neighbor colors.'
            : local.support ? multipleSupports ? 'Fill the reference positions while keeping access to the positions that complete the colors.'
              : 'Fill the reference positions while keeping access to the neighbor that completes the colors.'
            : choice.ordered && local.changedNeighbors?.length
            ? 'A neighbor changed color. Continue in the order that keeps the remaining positions reachable.'
            : choice.ordered ? 'Place the pieces in an order that keeps the remaining positions reachable.'
            : choice.retainsSlot ? 'Keep the selected piece’s reachable destination and preserve an assignment for every other piece.'
            : choice.slot && local.changedNeighbors?.length
            ? 'A neighboring piece changed color after the last move. Check the next position against the current reference.'
            : choice.slot ? 'The matched position is reachable with measured commands. Color interactions still need confirmation.' : label,
          agenda: [], evidence, triggerCard: decision.receipt.workflow,
          piece: cellBox(scene, choice.cell), target: choice.slot ? cellBox(scene, choice.slot) : scene.zone_box,
          reference: scene.reference_box,
          ...(supportMove ? { supportingPlacement: true } : {}),
          ...(multipleSupports ? { supportPositions: local.support!.cells.map(cell => cellBox(scene, cell)) } : {}),
          ...(predictedNeighbors.length ? { predictedNeighbors } : {}),
          ...(local.changedNeighbors?.length ? { neighbors: local.changedNeighbors.map(cell => cellBox(scene, cell)) } : {}) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      if (index > 0 && proposal.route) {
        const current = measureReferencePopulation(packet.frame_rows, proposal.local.scene) as Scene | null;
        const next = proposal.route[index]!;
        const expected = new Set(proposal.local.scene.bodies.map(({ cell }) =>
          key(key(cell) === key(proposal.choice.cell) ? next.cell : cell)));
        const admitted = proposal.local.epoch === observation.level_epoch && !!current
          && current.bodies.every(({ cell }) => expected.has(key(cell))) && expected.size === current.bodies.length
          && !!next.expected && !expected.has(key(next.expected));
        return { admitted, reason: admitted ? 'population_and_next_cell_confirmed' : 'population_or_reference_changed' };
      }
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'population_and_reference_bound' : 'population_or_reference_changed' };
    },
    after(proposal, index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      if (proposal.strategy === 'select_unplaced_piece') {
        const matched = !!selectionScene(proposal.local.scene, proposal.choice.cell, first, second);
        return { matched, seal_prefix: true, reason: matched ? 'selection_marker_observed' : 'selection_unconfirmed' };
      }
      const choice = proposal.route?.[index] ?? proposal.choice;
      const scene = index > 0 ? measureReferencePopulation(first, proposal.local.scene) as Scene | null : proposal.local.scene;
      const measured = scene && compareMovement({ local: { ...proposal.local, scene }, choice }, second), expected = choice.expected;
      const matched = !!measured && (!expected || !!measured.destination && key(measured.destination) === key(expected));
      if (matched && proposal.local.support && proposal.local.ordered?.length === index + 1) {
        return { matched: false, seal_prefix: true, reason: 'neighbor_placement_did_not_complete_reference' };
      }
      const neighborChange = scene && measured?.destination && changedNeighbors(scene, measured.next, choice.cell, measured.destination).length > 0;
      return { matched, seal_prefix: !matched || !!neighborChange || index + 1 >= proposal.actions.length,
        reason: matched ? 'population_return_measured' : 'population_effect_contradicted' };
    },
    record(before, after, _command, first, second, proposal, index) {
      const { strategy } = proposal, choice = proposal.route?.[index] ?? proposal.choice;
      const local = (index > 0 && state?.frame === before.frame_hash ? state : null) ?? proposal.local;
      if (after.levels_completed > before.levels_completed && choice.expected && Object.keys(local.controls).length >= 2) {
        const expected = new Set(local.scene.bodies.map(body => key(key(body.cell) === key(choice.cell) ? choice.expected! : body.cell)));
        if (local.scene.target.every(([y, x]) => expected.has(key([y, x])))) {
          witness = { epoch: after.level_epoch, score: after.levels_completed, pitch: local.scene.q, controls: local.controls,
            evidence: [...local.evidence.slice(-3), before.observation_ref, after.observation_ref],
            ...(local.neighborhood ? { neighborhood: local.neighborhood } : {}) };
        }
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const evidence = [...local.evidence.slice(-4), after.observation_ref];
      const current = { ...local, frame: after.frame_hash, evidence };
      if (strategy === 'select_unplaced_piece') {
        const measured = selectionScene(local.scene, choice.cell, first, second);
        state = { ...current, scene: measured ?? local.scene, selection: choice.cell, active: false, stopped: !measured,
          ...(measured ? { neighborhood: rememberNeighborhood(measured, local.neighborhood, after.observation_ref) } : {}),
          ...(choice.ordered && measured ? { ordered: local.ordered!.slice(1) } : {}),
          ...(local.assignment ? { assignment: null } : {}) };
        return { events: [] };
      }
      const measured = compareMovement({ local, choice }, second), destination = measured?.destination;
      const tried = [...local.tried, JSON.stringify([choice.command.action_ref, choice.cell])];
      const controls = { ...local.controls };
      const contradicted = !!choice.expected && (!destination || key(destination) !== key(choice.expected));
      if (contradicted) delete controls[choice.command.action_ref];
      if (destination) controls[choice.command.action_ref] = { delta: [destination[0] - choice.cell[0], destination[1] - choice.cell[1]] };
      const neighbors = measured && destination ? changedNeighbors(local.scene, measured.next, choice.cell, destination) : [];
      const assignment = choice.slot && destination && !contradicted && key(destination) !== key(choice.slot)
        ? { slot: choice.slot, previous: choice.cell, retained: choice.retainsSlot ?? false } : null;
      const exhaustedSupport = local.support && choice.ordered && local.ordered?.length === 1 && !contradicted;
      state = { ...current, scene: measured?.next ?? local.scene, selection: destination ?? choice.cell,
        active: local.active || !!destination, tried, controls, stopped: !measured, changedNeighbors: neighbors,
        ...(choice.ordered ? { ordered: contradicted ? [] : local.ordered!.slice(1) } : {}),
        ...(measured ? { neighborhood: rememberNeighborhood(measured.next, local.neighborhood, after.observation_ref) } : {}),
        ...(exhaustedSupport ? { support: null, rejectedSupport: [...(local.rejectedSupport ?? []), supportAttempt(local.scene, local.support!.cells)] } : {}),
        ...(assignment || local.assignment ? { assignment } : {}),
        probes: (local.probes ?? 0) + Number(strategy === 'test_selected_displacement' || contradicted) };
      return { events: [], ...(neighbors.length ? { reviewEvidence: 'A stationary neighbor changed appearance after the selected piece moved' } : {}) };
    },
    state: () => ({ state, witness }),
    restore(value: NativeRecord) {
      const saved = structuredClone(value.state as (Omit<State, 'support'> & { support?: Support | { cell: Cell; evidence: string[] } | null }) | null);
      const support = saved?.support;
      state = saved && support && !('cells' in support)
        ? { ...saved, support: { cells: [support.cell], evidence: support.evidence } } : saved as State | null;
      witness = structuredClone((value.witness as PlacementWitness | null | undefined) ?? null);
    },
  };
}
