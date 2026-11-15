import { fitFixedPortRules, fixedActive, fixedBands, fixedConnectedPorts, fixedFill, fixedPortRule,
  fixedProgramSamples, fixedStrokePorts, measureFixedScene } from '../logos-engine/v6-fixed-origin.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';
import { planNodeEffect, readProgramReturn, type NodeEffectPlan, type PortAlternatives, type PortSamples } from './program-node-effects.ts';

export const programOriginId = 'sic_program_origin';
export const learnProgramOriginId = 'sic_learn_program_origin';
export const programOriginStrategies = {
  test_central_program_node: 'Place the piece at a node suitable for observing the program',
  measure_fixed_program_trace: 'Run the displayed program and measure its instructions',
  place_at_compatible_origin: 'Place the piece where the observed instructions can reach the target',
  run_from_compatible_origin: 'Test the program from the selected starting node',
  test_origin_for_new_instruction: 'Test the new instruction from a node with few other predicted moves',
  place_for_node_effect_trial: 'Place the piece where an extra move could complete the program',
  run_node_effect_trial: 'Run the program to test whether the marked node repeats the incoming move',
} as const;
const graph = compileStrategyGraph({ id: 'find_start_for_visible_program', version: 1, order: 'FALLBACK',
  priorities: ['run_from_compatible_origin', 'place_at_compatible_origin', 'run_node_effect_trial', 'place_for_node_effect_trial',
    'measure_fixed_program_trace', 'test_origin_for_new_instruction', 'test_central_program_node'],
  strategies: {
    test_central_program_node: [{ fact: 'probe', expected: true, label: 'An untested node in the largest intermediate band can expose both kinds of instruction' }],
    measure_fixed_program_trace: [{ fact: 'placedProbe', expected: true, label: 'The piece is visibly placed on the node chosen for observation' }],
    place_at_compatible_origin: [{ fact: 'origin', expected: true, label: 'All retained port variants give one useful untried starting node' }],
    run_from_compatible_origin: [{ fact: 'placedOrigin', expected: true, label: 'The piece is visibly placed at the chosen starting node and the word is unchanged' }],
    test_origin_for_new_instruction: [{ fact: 'novel', expected: true, label: 'Previously measured instructions and visible links leave a testable route for one new symbol' }],
    place_for_node_effect_trial: [{ fact: 'effectOrigin', expected: true, label: 'A route reaches the target if a marked node repeats the incoming move' }],
    run_node_effect_trial: [{ fact: 'placedEffect', expected: true, label: 'The placement for the repeat-move hypothesis is confirmed in the current observation' }],
  },
}, ['probe', 'placedProbe', 'origin', 'placedOrigin', 'novel', 'effectOrigin', 'placedEffect']);

type Strategy = keyof typeof programOriginStrategies;
type Layout = { nodes: number[][]; boxes: number[][]; word: string[]; common_fill: number };
type Rule = [string, number, number];
type Placement = { node: number; color: number; solving: boolean; effect?: NodeEffectPlan };
type State = { epoch: number; layoutKey: string; pending: Placement | null; rules: Record<string, Rule[]>;
  attempted: number[]; evidence: string[]; stopped: boolean; transferredTarget?: number;
  measuredPorts?: PortSamples; blockedFills?: number[] };
type Proposal = NativeProposal & { layout: Layout; local: State; strategy: Strategy; node: number; solving: boolean;
  target: number; fills: (number | null)[]; needId: string; effect?: NodeEffectPlan };
type ScoredProgram = { epoch: number; score: number; target: number; rules: State['rules']; evidence: string[] };
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

function applicableRules(rules: Rule[]): Rule[] {
  const connected = rules.filter(rule => rule[0] === 'connected_neighboring_band');
  return connected.length ? connected : rules;
}

function portAlternatives(rows: NativeRows, layout: Layout, rule: Rule, strokes?: ReturnType<typeof strokeModels>['strokes']): PortAlternatives {
  return rule[0] === 'connected_neighboring_band'
    ? fixedConnectedPorts(rows, layout.nodes, rule[1], true) as PortAlternatives
    : fixedPortRule(layout.nodes, rule, null, strokes).map(node => [node]);
}

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
  const withStrokes = Object.values(local.rules).some(rules => rules.some(rule => rule[0] === 'stroke_priority'));
  const strokes = withStrokes ? strokeModels(rows, layout).strokes : undefined;
  for (const symbol of new Set(layout.word)) {
    // A connection traced in the current raster provides a more specific port than geometric proximity.
    const rules = applicableRules(local.rules[symbol] ?? []);
    if (!rules.length) return null;
    const choices = layout.nodes.map(() => new Set<number | null>());
    for (const rule of rules) {
      portAlternatives(rows, layout, rule, strokes).forEach((ports, index) => ports.forEach(port => choices[index]!.add(port)));
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

function strokeModels(rows: NativeRows, layout: Layout) {
  const strokes = Object.fromEntries([-1, 1].map(direction => [direction, fixedStrokePorts(rows, layout.nodes, direction)]));
  const rules: Rule[] = Object.entries(strokes).flatMap(([direction, styles]) =>
    Object.keys(styles).map<Rule>(style => ['stroke_priority', Number(direction), Number(style)]));
  return { strokes, rules };
}

function testNodeEffect(rows: NativeRows, layout: Layout, fills: (number | null)[], target: number, local: State): NodeEffectPlan | null {
  if (local.transferredTarget === undefined || !local.blockedFills?.length) return null;
  const { strokes, rules: strokeRules } = strokeModels(rows, layout);
  const tables = new Map<string, PortAlternatives[]>();
  for (const symbol of new Set(layout.word)) {
    const known = applicableRules(local.rules[symbol] ?? []);
    if (!known.length) return null;
    // Retain both visible stroke patterns if the measured ports have yet to distinguish them.
    const directions = known.filter(rule => rule[0].includes('neighboring_band')).map(rule => rule[1]);
    const rules = [...known, ...strokeRules.filter(rule => directions.includes(rule[1]))];
    const candidates: PortAlternatives[] = [];
    for (const rule of rules) {
      const mapping = portAlternatives(rows, layout, rule, strokes);
      for (const [from, to] of local.measuredPorts?.[symbol] ?? []) {
        mapping[from] = mapping[from]!.filter(option => (option ?? from) === to);
      }
      if (mapping.every(options => options.length > 0)) candidates.push(mapping);
    }
    if (!candidates.length) return null;
    tables.set(symbol, candidates);
  }
  return planNodeEffect(layout.word, fills, layout.common_fill, target, local.blockedFills, local.attempted, tables);
}

function testNewInstruction(rows: NativeRows, layout: Layout, fills: (number | null)[], target: number, local: State): number | null {
  if (local.transferredTarget === undefined) return null;
  const symbols = [...new Set(layout.word)], novel = symbols.filter(symbol => !local.rules[symbol]?.length);
  if (novel.length !== 1) return null;
  const { strokes, rules } = strokeModels(rows, layout), unfamiliar = novel[0]!;
  const unfamiliarPorts = [...portHypotheses, ...rules].map(rule => portAlternatives(rows, layout, rule, strokes));
  const familiar = new Map(symbols.flatMap(symbol => {
    if (symbol === unfamiliar) return [];
    return [[symbol, applicableRules(local.rules[symbol]!).map(rule => portAlternatives(rows, layout, rule, strokes))] as const];
  }));

  const trials = fills.flatMap((fill, origin) => {
    if (fill !== layout.common_fill || local.attempted.includes(origin)) return [];
    const routes = unfamiliarPorts.map(ports => {
      let positions = new Set([origin]);
      const visited = new Set<number>();
      for (const symbol of layout.word) {
        const tables = familiar.get(symbol) ?? [ports];
        const options = [...positions].flatMap(position => tables.flatMap(table => table[position]!.map(next => next ?? position)));
        // A missing port may leave the piece in place. This is a trial hypothesis.
        positions = new Set(options.filter(next => next === target || fills[next] === layout.common_fill));
        for (const position of positions) if (position !== origin) visited.add(position);
      }
      return { reaches: positions.size === 1 && positions.has(target), movement: visited.size };
    }).filter(result => result.reaches);
    if (!routes.length) return [];
    return [{ origin, support: routes.length, movement: Math.min(...routes.map(route => route.movement)) }];
  });
  trials.sort((a, b) => a.movement - b.movement || b.support - a.support || a.origin - b.origin);
  return trials[0]?.origin ?? null;
}

function programTrace(proposal: Proposal, first: NativeRows, frames: readonly NativeRows[]) {
  const { layout, local } = proposal, piece = local.pending!;
  return [first, ...frames].map(rows => {
    const matches = layout.nodes.flatMap((node, i) => fixedFill(rows, node) === piece.color ? [i] : []);
    return { active: fixedActive(rows, layout), node: matches.length === 1 ? matches[0]! : null };
  });
}

function learnPorts(proposal: Proposal, first: NativeRows, trace: ReturnType<typeof programTrace>) {
  const { layout, local } = proposal;
  const observations = fixedProgramSamples({ layout, trace }) as Record<string, number[][]>;
  const links = Object.fromEntries([-1, 1].map(direction => [direction, fixedConnectedPorts(first, layout.nodes, direction)]));
  const measureTransfer = local.transferredTarget !== undefined;
  const stroke = measureTransfer ? strokeModels(first, layout) : null;
  const rules = { ...local.rules };
  for (const [label, samples] of Object.entries(observations)) {
    const candidates = stroke ? [...portHypotheses, ...stroke.rules].filter(rule => {
      const ports = fixedPortRule(layout.nodes, rule, links, stroke.strokes);
      return samples.every(([from, to]) => (ports[from!] ?? from) === to);
    }) : fitFixedPortRules(layout.nodes, samples, portHypotheses, links) as Rule[];
    const known = rules[label];
    rules[label] = known ? known.filter(rule => candidates.some(candidate => key(candidate) === key(rule))) : candidates;
  }
  return rules;
}

export function createSicProgramOrigin(family = programOriginId): NativeFamily<Proposal> {
  const learns = family === learnProgramOriginId;
  let state: State | null = null;
  let scored: ScoredProgram | null = null;
  return {
    id: family,
    async propose(observation, rows, inputs, remaining, execution) {
      if (!observation.available_action_refs.includes('ACTION6')) return null;
      const launch = inputs.filter(input => /^ACTION[1-5]$/.test(input.action_ref));
      if (launch.length !== 1 || remaining < 1) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (learns && !prior && !execution?.readClickRegions) return null;
      const layout = measureFixedScene(rows) as Layout | null;
      if (!layout || layout.nodes.length > 80 || layout.word.length > 48 || new Set(layout.word).size < 2) return null;
      const layoutKey = key([layout.nodes, layout.word]), ref = observation.observation_ref;
      const local = prior?.layoutKey === layoutKey ? prior : empty(observation.level_epoch, layoutKey);
      const fills = layout.nodes.map(node => fixedFill(rows, node));
      if (!prior && scored?.epoch === observation.level_epoch && scored.score === observation.levels_completed
        && fills.filter(value => value === scored!.target).length === 1 && layout.word.some(symbol => scored!.rules[symbol]?.length)) {
        local.transferredTarget = scored.target;
        local.rules = scored.rules;
        local.evidence = scored.evidence;
      }
      if (learns && prior?.layoutKey !== layoutKey) {
        const click = execution?.readClickRegions?.(layout.nodes.map(box));
        if (!click || click.levelEpoch !== observation.level_epoch || click.afterRef !== ref) return null;
        const [x, y] = click.point;
        const changed = click.after.flatMap((value, i) => value !== click.before[i] ? [i] : []);
        if (changed.length !== 1) return null;
        const node = changed[0]!, [left, top, right, bottom] = box(layout.nodes[node]!);
        const color = click.after[node];
        if (color == null || click.before[node] !== layout.common_fill || x < left || x > right || y < top || y > bottom ||
          click.after.some((value, i) => value !== fills[i])) return null;
        local.pending = { node, color, solving: false };
        local.evidence = [click.beforeRef, click.afterRef];
      }
      if (local.stopped || local.attempted.length >= 8) return null;
      const goals = fills.flatMap((value, i) => value != null && value !== layout.common_fill && i !== local.pending?.node
        && (local.transferredTarget === undefined || value === local.transferredTarget) ? [i] : []);
      if (goals.length !== 1) return null;
      const target = goals[0]!;
      const origin = !local.pending && remaining >= 2 ? originFor(rows, layout, fills, target, local) : null;
      const canProbe = !local.pending && origin === null && remaining >= 2;
      const effect = local.pending?.effect ?? (canProbe ? testNodeEffect(rows, layout, fills, target, local) : null);
      const novel = canProbe && !effect ? testNewInstruction(rows, layout, fills, target, local) : null;
      const probe = canProbe && !effect && novel === null ? measurementNode(layout, fills, local) : null;
      const node = local.pending?.node ?? origin ?? effect?.origin ?? novel ?? probe;
      if (node === null || (local.pending && fills[node] !== local.pending.color)) return null;
      const evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const [x, y] = center(layout.nodes[node]!);
      const click: NativeCommand = { action_ref: 'ACTION6', data: { x, y } }, run = launch[0]!;
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        probe: { value: probe !== null, evidence }, placedProbe: { value: local.pending?.solving === false, evidence },
        origin: { value: origin !== null, evidence }, placedOrigin: { value: local.pending?.solving === true, evidence },
        novel: { value: novel !== null, evidence }, effectOrigin: { value: !!effect && !local.pending, evidence },
        placedEffect: { value: !!local.pending?.effect, evidence },
      }, planners: { test_central_program_node: () => click, measure_fixed_program_trace: () => run,
        place_at_compatible_origin: () => click, run_from_compatible_origin: () => run, test_origin_for_new_instruction: () => click,
        place_for_node_effect_trial: () => click, run_node_effect_trial: () => run } });
      if (!selected) return null;
      const strategy = selected.id, command = selected.plan, label = programOriginStrategies[strategy], parent = 'G_official_completion';
      const goal = { kind: 'reach_target_using_fixed_program', scope: ref.split(':revision:', 1)[0]!, subjects: ['fixed_word_and_nodes'],
        parentObjective: parent, satisfactionContract: 'observe_official_progress_from_a_compatible_program_origin' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `program-origin:${need.id}`, actions = [command], solving = origin !== null || local.pending?.solving === true;
      const instruction = local.transferredTarget !== undefined && !solving ? layout.word.findIndex(symbol => !local.rules[symbol]?.length) : -1;
      const binding = command === click ? await ObservedInputDomain.makeLocusWitness(observation, rows, [x, y], { reason: label, evidence }) : null;
      return { status: 'proposed', kind: family, actions, strategy, layout, local, node, target, solving, fills, needId: need.id,
        ...(effect ? { effect } : {}),
        steps: [{ action: command, expected_after: null, ...(binding ? { point_binding: binding } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Find where the displayed program can start and reach the marked destination',
          mode: solving ? 'solving' : 'exploration', situation: label, agenda: entries, evidence,
          origin: box(layout.nodes[node]!), target: box(layout.nodes[target]!),
          ...(effect ? { repeat: effect.repeat.map(i => box(layout.nodes[i]!)),
            blocked: effect.blocked.map(i => box(layout.nodes[i]!)) } : {}),
          ...(instruction < 0 ? {} : { instruction: box(layout.boxes[instruction]!) }) },
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
      const { local, node, solving, layout, target, fills, effect } = proposal;
      if (after.levels_completed > before.levels_completed && local.pending && fills[target] != null
        && Object.values(local.rules).some(rules => rules.length > 0)
        && frames.some(frame => fixedActive(frame, layout) === layout.word.length - 1
          && fixedFill(frame, layout.nodes[target]!) === local.pending!.color)) {
        scored = { epoch: after.level_epoch, score: after.levels_completed, target: fills[target]!,
          rules: local.rules, evidence: [...local.evidence.slice(-4), before.observation_ref, after.observation_ref] };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const evidence = [...local.evidence.slice(-4), after.observation_ref];
      if (!local.pending) {
        const color = placed(proposal, second);
        state = { ...local, evidence, pending: color === null ? null : { node, color, solving, ...(effect ? { effect } : {}) }, stopped: color === null };
      } else {
        const trace = programTrace(proposal, first, frames);
        state = { ...local, evidence, pending: null, attempted: [...local.attempted, node],
          rules: effect ? local.rules : learnPorts(proposal, first, trace) };
        if (local.transferredTarget !== undefined) {
          const returned = readProgramReturn(layout.word, trace, node,
            layout.nodes.every(region => fixedFill(second, region) !== local.pending!.color));
          const interruptedFill = returned.interruption === null ? null : fills[returned.interruption];
          if (interruptedFill != null && interruptedFill !== layout.common_fill && interruptedFill !== fills[target]) {
            state.blockedFills = [...new Set([...(local.blockedFills ?? []), interruptedFill])];
          }
          state.measuredPorts = { ...local.measuredPorts };
          for (const [symbol, samples] of Object.entries(returned.samples)) {
            const combined = [...(state.measuredPorts[symbol] ?? []), ...samples];
            state.measuredPorts[symbol] = [...new Map(combined.map(sample => [key(sample), sample])).values()];
          }
        }
      }
      return { events: [] };
    },
    state: () => ({ state, scored }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      scored = structuredClone((value.scored as ScoredProgram | null | undefined) ?? null);
    },
  };
}

function placed({ layout, fills, node }: Proposal, rows: NativeRows) {
  const color = fixedFill(rows, layout.nodes[node]!);
  if (color === null || color === fills[node]) return null;
  const measured = measureFixedScene(rows) as Layout | null;
  return measured && key([measured.nodes, measured.word]) === key([layout.nodes, layout.word])
    && layout.nodes.every((region, i) => i === node || fixedFill(rows, region) === fills[i]) ? color : null;
}
