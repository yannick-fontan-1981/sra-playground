import { fitFixedPortRules, fixedActive, fixedBands, fixedConnectedPorts, fixedFill, fixedPortRule,
  fixedProgramSamples, measureFixedScene } from '../logos-engine/v6-fixed-origin.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const programOriginId = 'sic_program_origin';
export const programOriginStrategies = {
  test_central_program_node: 'Place the piece at a node suitable for observing the program',
  measure_fixed_program_trace: 'Run the displayed program and measure its instructions',
  place_at_compatible_origin: 'Place the piece where the observed instructions can reach the target',
  run_from_compatible_origin: 'Test the program from the selected starting node',
} as const;
const graph = compileStrategyGraph({ id: 'find_start_for_visible_program', version: 1, order: 'FALLBACK',
  priorities: ['run_from_compatible_origin', 'place_at_compatible_origin', 'measure_fixed_program_trace', 'test_central_program_node'],
  strategies: {
    test_central_program_node: [{ fact: 'probe', expected: true, label: 'An untested node in the largest intermediate band can expose both kinds of instruction' }],
    measure_fixed_program_trace: [{ fact: 'placedProbe', expected: true, label: 'The piece is visibly placed on the node chosen for observation' }],
    place_at_compatible_origin: [{ fact: 'origin', expected: true, label: 'All retained port variants give one useful untried starting node' }],
    run_from_compatible_origin: [{ fact: 'placedOrigin', expected: true, label: 'The piece is visibly placed at the chosen starting node and the word is unchanged' }],
  },
}, ['probe', 'placedProbe', 'origin', 'placedOrigin']);

type Strategy = keyof typeof programOriginStrategies;
type Layout = { nodes: number[][]; boxes: number[][]; word: string[]; common_fill: number };
type Rule = [string, number, number];
type Placement = { node: number; color: number; solving: boolean };
type State = { epoch: number; layoutKey: string; pending: Placement | null; rules: Record<string, Rule[]>;
  attempted: number[]; evidence: string[]; stopped: boolean };
type Proposal = NativeProposal & { layout: Layout; local: State; strategy: Strategy; node: number; solving: boolean;
  fills: (number | null)[]; needId: string };
const empty = (epoch: number, layoutKey: string): State =>
  ({ epoch, layoutKey, pending: null, rules: {}, attempted: [], evidence: [], stopped: false });
const key = (value: unknown) => JSON.stringify(value);
const box = ([l, t, r, b]: number[]): NativeBox => [l!, t!, r!, b!];
const center = ([l, t, r, b]: number[]): NativePoint => [Math.floor((l! + r!) / 2), Math.floor((t! + b!) / 2)];
const portHypotheses: Rule[] = [
  ['cyclic_order', -1, 1], ['cyclic_order', 1, 1],
  ['neighboring_band', -1, -1], ['neighboring_band', -1, 1], ['neighboring_band', 1, -1], ['neighboring_band', 1, 1],
  ['connected_neighboring_band', -1, 1], ['connected_neighboring_band', 1, 1],
];

function measurementNode(layout: Layout, fills: (number | null)[], local: State): number | null {
  const bands = fixedBands(layout.nodes);
  const widest = bands.slice(1, -1).sort((a, b) => b.length - a.length)[0];
  if (!widest || widest.length < 3) return null;
  const middle = (widest.length - 1) / 2;
  const choices = widest.map((node, i) => ({ node, rank: Math.abs(i - middle) }))
    .filter(({ node }) => fills[node] === layout.common_fill && !local.attempted.includes(node))
    .sort((a, b) => a.rank - b.rank);
  return choices[0]?.node ?? null;
}

function originFor(rows: NativeRows, layout: Layout, fills: (number | null)[], target: number, local: State): number | null {
  const tables = new Map<string, (number | null)[][]>();
  for (const symbol of new Set(layout.word)) {
    const applicable = local.rules[symbol] ?? [];
    // A connection traced in the current raster provides a more specific port than geometric proximity.
    const connected = applicable.filter(rule => rule[0] === 'connected_neighboring_band');
    const rules = connected.length ? connected : applicable;
    if (!rules.length) return null;
    const choices = layout.nodes.map(() => new Set<number | null>());
    for (const rule of rules) {
      const destinations = rule[0] === 'connected_neighboring_band'
        ? fixedConnectedPorts(rows, layout.nodes, rule[1], true) as (number | null)[][]
        : fixedPortRule(layout.nodes, rule).map(node => [node]);
      destinations.forEach((ports, index) => ports.forEach(port => choices[index]!.add(port)));
    }
    tables.set(symbol, choices.map(options => [...options]));
  }
  const origins = layout.nodes.flatMap((_, i) => {
    if (fills[i] !== layout.common_fill || local.attempted.includes(i)) return [];
    let positions = new Set<number | null>([i]);
    for (const symbol of layout.word) {
      const table = tables.get(symbol)!;
      positions = new Set([...positions].flatMap(position => position === null ? [null] : table[position]!));
      if (positions.has(null) || positions.size === 0) return [];
    }
    return positions.size === 1 && positions.has(target) ? [i] : [];
  });
  return origins.length === 1 ? origins[0]! : null;
}

function learnPorts(proposal: Proposal, first: NativeRows, frames: readonly NativeRows[]) {
  const { layout, local } = proposal, piece = local.pending!;
  const trace = [first, ...frames].map(rows => {
    const matches = layout.nodes.flatMap((node, i) => fixedFill(rows, node) === piece.color ? [i] : []);
    return { active: fixedActive(rows, layout), node: matches.length === 1 ? matches[0] : null };
  });
  const observations = fixedProgramSamples({ layout, trace }) as Record<string, number[][]>;
  const links = Object.fromEntries([-1, 1].map(direction => [direction, fixedConnectedPorts(first, layout.nodes, direction)]));
  const rules = { ...local.rules };
  for (const [label, samples] of Object.entries(observations)) {
    const candidates = fitFixedPortRules(layout.nodes, samples, portHypotheses, links) as Rule[];
    const known = rules[label];
    rules[label] = known ? known.filter(rule => candidates.some(candidate => key(candidate) === key(rule))) : candidates;
  }
  return rules;
}

export function createSicProgramOrigin(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: programOriginId,
    async propose(observation, rows, inputs, remaining) {
      if (!observation.available_action_refs.includes('ACTION6')) return null;
      const launch = inputs.filter(input => /^ACTION[1-5]$/.test(input.action_ref));
      if (launch.length !== 1 || remaining < 1) return null;
      const layout = measureFixedScene(rows) as Layout | null;
      if (!layout || layout.nodes.length > 80 || layout.word.length > 48 || new Set(layout.word).size < 2) return null;
      const layoutKey = key([layout.nodes, layout.word]), ref = observation.observation_ref;
      const local = state?.epoch === observation.level_epoch && state.layoutKey === layoutKey
        ? state : empty(observation.level_epoch, layoutKey);
      if (local.stopped || local.attempted.length >= 8) return null;
      const fills = layout.nodes.map(node => fixedFill(rows, node));
      const goals = fills.flatMap((value, i) => value != null && value !== layout.common_fill && i !== local.pending?.node ? [i] : []);
      if (goals.length !== 1) return null;
      const target = goals[0]!;
      const origin = !local.pending && remaining >= 2 ? originFor(rows, layout, fills, target, local) : null;
      const probe = !local.pending && origin === null && remaining >= 2 ? measurementNode(layout, fills, local) : null;
      const node = local.pending?.node ?? origin ?? probe;
      if (node === null || (local.pending && fills[node] !== local.pending.color)) return null;
      const evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const [x, y] = center(layout.nodes[node]!);
      const click: NativeCommand = { action_ref: 'ACTION6', data: { x, y } }, run = launch[0]!;
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        probe: { value: probe !== null, evidence }, placedProbe: { value: local.pending?.solving === false, evidence },
        origin: { value: origin !== null, evidence }, placedOrigin: { value: local.pending?.solving === true, evidence },
      }, planners: { test_central_program_node: () => click, measure_fixed_program_trace: () => run,
        place_at_compatible_origin: () => click, run_from_compatible_origin: () => run } });
      if (!selected) return null;
      const strategy = selected.id, command = selected.plan, label = programOriginStrategies[strategy], parent = 'G_official_completion';
      const goal = { kind: 'reach_target_using_fixed_program', scope: ref.split(':revision:', 1)[0]!, subjects: ['fixed_word_and_nodes'],
        parentObjective: parent, satisfactionContract: 'observe_official_progress_from_a_compatible_program_origin' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `program-origin:${need.id}`, actions = [command], solving = origin !== null || local.pending?.solving === true;
      const binding = command === click ? await ObservedInputDomain.makeLocusWitness(observation, rows, [x, y], { reason: label, evidence }) : null;
      return { status: 'proposed', kind: programOriginId, actions, strategy, layout, local, node, solving, fills, needId: need.id,
        steps: [{ action: command, expected_after: null, ...(binding ? { point_binding: binding } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Find where the displayed program can start and reach the marked destination',
          mode: solving ? 'solving' : 'exploration', situation: label, agenda: entries, evidence,
          origin: box(layout.nodes[node]!), target: box(layout.nodes[target]!) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'program_origin_bound' : 'program_origin_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = proposal.local.pending ? null : placed(proposal, second) !== null;
      return { matched, seal_prefix: true, reason: matched === null ? 'observe_fixed_program_trace'
        : matched ? 'fixed_program_placement_confirmed' : 'fixed_program_placement_contradicted' };
    },
    record(before, after, _command, first, second, proposal, _index, frames) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, node, solving } = proposal, evidence = [...local.evidence.slice(-4), after.observation_ref];
      if (!local.pending) {
        const color = placed(proposal, second);
        state = { ...local, evidence, pending: color === null ? null : { node, color, solving }, stopped: color === null };
      } else {
        state = { ...local, evidence, pending: null, attempted: [...local.attempted, node], rules: learnPorts(proposal, first, frames) };
      }
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

function placed({ layout, fills, node }: Proposal, rows: NativeRows) {
  const color = fixedFill(rows, layout.nodes[node]!);
  if (color === null || color === fills[node]) return null;
  const measured = measureFixedScene(rows) as Layout | null;
  return measured && key([measured.nodes, measured.word]) === key([layout.nodes, layout.word])
    && layout.nodes.every((region, i) => i === node || fixedFill(rows, region) === fills[i]) ? color : null;
}
