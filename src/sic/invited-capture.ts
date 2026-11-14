import { measureReductionScene, reductionGeometry, reductionPacked, reductionPoint, retainedReductionScene, type ReductionScene } from '../logos-engine/v6-invited-reduction.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const invitedCaptureId = 'sic_invited_capture';
export const invitedCaptureStrategies = {
  reveal_capture_choices: 'Select an occurrence and look for available landing cells',
  test_invited_capture: 'Test a visibly offered landing cell',
  preserve_capture_continuation: 'Follow a route that keeps the remaining captures possible',
} as const;
const graph = compileStrategyGraph({ id: 'reduce_population_by_visible_capture', version: 1, order: 'FALLBACK',
  priorities: ['preserve_capture_continuation', 'test_invited_capture', 'reveal_capture_choices'],
  strategies: {
    reveal_capture_choices: [{ fact: 'selection', expected: true, label: 'A current piece can reveal the next landing cells' }],
    test_invited_capture: [{ fact: 'invitation', expected: true, label: 'A highlighted empty cell can test a capture' }],
    preserve_capture_continuation: [{ fact: 'route', expected: true, label: 'Observed jump geometry admits a route that reduces the population' }],
  },
}, ['selection', 'invitation', 'route']);

type Cell = [number, number];
type Body = [number, string];
type Population = Map<string, Body>;
type Jump = { over: Cell; by: Cell };
type Move = { target: Cell; focus: Cell; victim: Cell | null };
type State = { epoch: number; geometry: NativeRecord; bases: number[]; focus: Cell | null; jumps: Record<string, Jump[]>;
  tried: string[]; stopped: boolean; evidence: string[] };
type Proposal = NativeProposal & { local: State; move: Move; selection: boolean; before: [number, number, ...Body][]; needId: string; attempt: string };
const key = (value: unknown) => JSON.stringify(value);
const equal = (a: unknown, b: unknown) => key(a) === key(b);
const add = ([x, y]: Cell, [dx, dy]: Cell): Cell => [x + dx, y + dy];
const diff = ([x, y]: Cell, [dx, dy]: Cell): Cell => [x - dx, y - dy];
const order = (a: Cell, b: Cell) => a[0] - b[0] || a[1] - b[1];
const cells = (keys: Iterable<string>) => [...keys].map(value => JSON.parse(value) as Cell);
const packed = (bodies: Population) => reductionPacked(bodies) as [number, number, ...Body][];

function dominant(pixels: number[][]) {
  const counts = new Map<number, number>();
  for (const row of pixels) for (const color of row) counts.set(color, (counts.get(color) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]![0];
}

function invitations(scene: ReductionScene, bases: number[]) {
  return cells([...scene.cells].filter(([cell, pixels]) => !scene.bodies.has(cell) && !bases.includes(dominant(pixels))).map(([cell]) => cell)).sort(order);
}

function symmetricJumps(jumps: Jump[]) {
  const values = jumps.flatMap(({ over, by }) => [false, true].flatMap(swap => [-1, 1].flatMap(x => [-1, 1].map(y => {
    const transform = ([a, b]: Cell): Cell => swap ? [x * b, y * a] : [x * a, y * b];
    return { over: transform(over), by: transform(by) };
  }))));
  return [...new Map(values.map(jump => [key(jump), jump])).values()];
}

function captureRoute(scene: ReductionScene, state: State, exposed: Cell[], remaining: number) {
  const available = new Set(exposed.map(key));
  const templates = new Map(Object.entries(state.jumps).map(([rank, jumps]) => [rank, symmetricJumps(jumps)]));
  const queue: { population: Population; focus: Cell | null; first?: Move; cost: number }[] =
    [{ population: scene.bodies, focus: state.focus, cost: 0 }];
  const visited = new Set<string>();
  for (let i = 0; i < queue.length && i < 4096; i++) {
    const { population, focus, first, cost } = queue[i]!;
    if (first && population.size === 1) return first;
    const signature = key([packed(population), focus]);
    if (cost >= remaining || visited.has(signature)) continue;
    visited.add(signature);
    for (const from of cells(population.keys()).sort(order)) {
      const body = population.get(key(from))!;
      const jumps = templates.get(body[1]) ?? [];
      const options = jumps.map(({ over, by }) => ({ target: add(from, by), victim: add(from, over) }))
        .sort((a, b) => order(a.victim, b.victim) || order(a.target, b.target));
      for (const { target, victim } of options) {
        if (!population.has(key(victim)) || population.has(key(target)) || !scene.cells.has(key(target))) continue;
        const selected = equal(focus, from);
        if (!first && selected && !available.has(key(target))) continue;
        const nextCost = cost + (selected ? 1 : 2);
        if (nextCost > remaining) continue;
        const next = new Map(population);
        next.delete(key(from));
        next.delete(key(victim));
        next.set(key(target), body);
        const move = selected ? { target, focus: from, victim } : { target: from, focus: from, victim: null };
        queue.push({ population: next, focus: target, first: first ?? move, cost: nextCost });
      }
    }
  }
  return null;
}

function captureEffect(proposal: Proposal, after: ReductionScene, selected: Cell) {
  const original: Population = new Map(proposal.before.map(([x, y, color, rank]) => [key([x, y]), [color, rank]]));
  const removed = cells([...original.keys()].filter(cell => !after.bodies.has(cell)));
  const added = cells([...after.bodies.keys()].filter(cell => !original.has(cell)));
  const victim = removed.find(cell => !equal(cell, selected));
  const selectedBody = original.get(key(selected));
  if (!selectedBody || removed.length !== 2 || !removed.some(cell => equal(cell, selected)) || !victim ||
    added.length !== 1 || !equal(added[0], proposal.move.target) ||
    !equal(after.bodies.get(key(added[0]!)), selectedBody) ||
    (proposal.move.victim && !equal(proposal.move.victim, victim))) return null;
  const expected = new Map(original);
  expected.delete(key(selected));
  expected.delete(key(victim));
  expected.set(key(added[0]!), selectedBody);
  return equal(packed(expected), packed(after.bodies)) ? { rank: selectedBody[1], jump: { over: diff(victim, selected), by: diff(added[0]!, selected) } } : null;
}

export function createSicInvitedCapture(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: invitedCaptureId,
    async propose(observation, rows, _inputs, remaining) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (prior?.stopped || (prior?.tried.length ?? 0) >= 40) return null;
      const scene = prior ? await retainedReductionScene(rows, prior.geometry) : await measureReductionScene(rows);
      if (!scene || scene.bodies.size < 2 || scene.bodies.size > 8) return null;
      const local: State = prior ?? { epoch: observation.level_epoch, geometry: reductionGeometry(scene),
        bases: [...new Set([...scene.cells].filter(([cell]) => !scene.bodies.has(cell)).map(([, pixels]) => dominant(pixels)))],
        focus: null, jumps: {}, tried: [], stopped: false, evidence: [] };
      const exposed = invitations(scene, local.bases);
      const before = packed(scene.bodies);
      const attemptKey = (target: Cell) => key([before, local.focus, target]);
      const route = Object.keys(local.jumps).length ? captureRoute(scene, local, exposed, remaining) : null;
      const offered = local.focus && exposed.find(target => !local.tried.includes(attemptKey(target)));
      const pending = cells(scene.bodies.keys()).sort((a, b) => a[1] - b[1] || a[0] - b[0])
        .find(target => !equal(target, local.focus) && !local.tried.includes(attemptKey(target)));
      const test = offered && local.focus ? { target: offered, focus: local.focus, victim: null } : null;
      const select = pending ? { target: pending, focus: pending, victim: null } : null;
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        selection: { value: !!select, evidence }, invitation: { value: !!test, evidence },
        route: { value: !!route && !local.tried.includes(attemptKey(route.target)), evidence },
      }, planners: { reveal_capture_choices: () => select, test_invited_capture: () => test, preserve_capture_continuation: () => route } });
      if (!selected) return null;
      const strategy = selected.id, move = selected.plan, selection = scene.bodies.has(key(move.target));
      const point = reductionPoint(scene, move.target), [x, y] = point;
      const command = { action_ref: 'ACTION6', data: { x, y } };
      const label = invitedCaptureStrategies[strategy], parent = 'G_official_completion';
      const goal = { kind: 'reduce_visible_population', scope: ref.split(':revision:', 1)[0]!, subjects: ['capture_source', 'intermediate_piece', 'offered_landing'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_reducing_the_visible_population' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence }, id = `invited-capture:${need.id}`;
      const actions = [command], binding = await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: label, evidence });
      const box = (cell: Cell): NativeBox => {
        const [cx, cy] = reductionPoint(scene, cell), half = Math.floor(scene.pitch / 2);
        return [cx - half, cy - half, cx - half + scene.pitch - 1, cy - half + scene.pitch - 1];
      };
      return { status: 'proposed', kind: invitedCaptureId, actions, local, move, selection, before, needId: need.id, attempt: attemptKey(move.target),
        steps: [{ action: command, expected_after: null, point_binding: binding }], binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Remove pieces while keeping a capture route open', mode: route ? 'solving' : 'exploration',
          situation: route ? 'The measured jump supports a route to one remaining piece. The next landing is checked against the current highlights.' : label,
          agenda: entries, evidence, focus: box(move.focus), target: box(move.target), victim: move.victim ? box(move.victim) : null },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'capture_locus_bound' : 'capture_domain_changed' };
    },
    async after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const scene = await retainedReductionScene(second, proposal.local.geometry);
      const matched = !!scene && (proposal.selection ? equal(packed(scene.bodies), proposal.before) && invitations(scene, proposal.local.bases).length > 0
        : !!captureEffect(proposal, scene, proposal.move.focus));
      return { matched, seal_prefix: true, reason: matched ? 'invitation_or_capture_observed' : 'capture_effect_unconfirmed' };
    },
    async record(before, after, _command, _first: NativeRows, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, move, selection } = proposal, scene = await retainedReductionScene(second, local.geometry);
      const effect = !selection && scene ? captureEffect(proposal, scene, move.focus) : null;
      const selected = selection && !!scene && equal(packed(scene.bodies), proposal.before) && invitations(scene, local.bases).length > 0;
      const jumps = { ...local.jumps };
      if (effect) jumps[effect.rank] = [...(jumps[effect.rank] ?? []), effect.jump];
      state = { ...local, jumps, focus: selected || effect ? move.target : selection ? null : local.focus,
        stopped: !scene || (!selection && !effect && !equal(packed(scene.bodies), proposal.before)),
        tried: [...local.tried, proposal.attempt], evidence: [...local.evidence.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
