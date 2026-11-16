import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { coupledPiecesKey, settleCoupledPieces, type CoupledPiece as Piece } from './coupled-piece-settling.ts';

export const observedPolePairId = 'sic_reorient_observed_coupled_pair';
export const observedPolePairStrategies = {
  bind_piece_in_coupled_pair: 'Select the piece whose outward path reaches the marked destination',
  rotate_out_of_coupling_axis: 'Turn the selected piece out of the current coupling axis',
  confirm_outward_pair_motion: 'Oppose the paired poles and verify the projected outward movement',
  select_coupled_piece: 'Select the piece that can change the active coupling',
  test_coupled_motion: 'Turn the selected piece and verify which pieces move or stop',
} as const;

type Grid = { x: number; y: number; width: number; height: number; pitch: number };
type Tile = { point: NativePoint; edges: number[]; center: number; inner: number };
type Layout = { grid: Grid; poles: number[]; goal: NativePoint; goalMark: string; floor: string[] };
type Training = { epoch: number; layout: Layout | null; turns: Record<string, number>; apart: string | null; idle: string | null };
type Witness = { epoch: number; poles: number[]; goalMark: string; turns: Record<string, number>; refs: string[]; rotationOnly?: true };
type Local = { epoch: number; layout: Layout; driver: NativePoint; partner: NativePoint; input: string;
  expected: [NativePoint, NativePoint]; stage: 0 | 1 | 2; stopped: boolean };
type PairProposal = NativeProposal & { local: Local; was: Piece[]; needId: string };
type Network = { epoch: number; layout: Layout; refs: string[]; rejected: string[] };
type Step = { action: NativeCommand; focus: NativePoint; expected: Piece[] };
type NetworkProposal = NativeProposal & { network: Network; step: Step; attempt: string; needId: string };
type Proposal = PairProposal | NetworkProposal;
const isNetworkProposal = (proposal: Proposal): proposal is NetworkProposal => 'network' in proposal;

const vectors: readonly NativePoint[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const key = (p: readonly number[]) => p.join(',');
const samePoint = (a: NativePoint, b: NativePoint) => key(a) === key(b);
const advance = (a: NativePoint, b: NativePoint): NativePoint => [a[0] + b[0], a[1] + b[1]];
const rotate = (direction: number, quarter: number) => (4 + direction + quarter) % 4;
const inBoard = (x: number, y: number, rows: NativeRows) => y >= 0 && y < rows.length && x >= 0 && x < rows[y]!.length;
const marker = (tile: Tile) => key([tile.edges[0]!, tile.center, tile.inner]);
const uniform = (values: readonly number[]) => values.every(value => value === values[0]);

function measuredGrid(observation: NativeObservation): Grid | null {
  const clusters = new Map<string, Set<string>>();
  for (const entity of observation.entities) {
    const [l, t, r, b] = entity.bbox, size = r - l + 1;
    if (!entity.rectangular || size < 3 || size % 2 === 0 || b - t + 1 !== size) continue;
    const signature = key([entity.palette_value, size]), cells = clusters.get(signature) ?? new Set<string>();
    cells.add(key([(l + r) / 2, (t + b) / 2]));
    clusters.set(signature, cells);
  }
  const candidates = [...clusters].flatMap(([signature, cells]) => {
    if (cells.size < 16) return [];
    const points = [...cells].map(p => p.split(',').map(Number));
    const xs = [...new Set(points.map(point => point[0]!))].sort((a, b) => a - b);
    const ys = [...new Set(points.map(point => point[1]!))].sort((a, b) => a - b);
    if (xs.length < 4 || ys.length < 4) return [];
    const pitch = xs[1]! - xs[0]!, inner = Number(signature.split(',')[1]);
    if (pitch !== inner + 2 || [xs, ys].some(axis => axis.some((v, i) => v !== axis[0]! + i * pitch))) return [];
    const edges = [...xs.flatMap(x => [[x, ys[0]!], [x, ys.at(-1)!]]), ...ys.flatMap(y => [[xs[0]!, y], [xs.at(-1)!, y]])];
    if (!edges.every(point => cells.has(key(point)))) return [];
    return [{ x: xs[0]!, y: ys[0]!, width: xs.length, height: ys.length, pitch }];
  });
  return candidates.length === 1 ? candidates[0]! : null;
}

function tiles(rows: NativeRows, grid: Grid): Tile[] {
  const radius = Math.floor(grid.pitch / 2);
  const result: Tile[] = [];
  for (let r = 0; r < grid.height; r++) for (let c = 0; c < grid.width; c++) {
    const x = grid.x + c * grid.pitch, y = grid.y + r * grid.pitch;
    if (!inBoard(x - radius, y - radius, rows) || !inBoard(x + radius, y + radius, rows)) return [];
    result.push({ point: [c, r], center: rows[y]![x]!, inner: rows[y - 1]![x - 1]!,
      edges: vectors.map(([dx, dy]) => rows[y + dy * radius]![x + dx * radius]!) });
  }
  return result;
}

function polesOf(tile: Tile): number[] | null {
  const edges = tile.edges;
  const repeated = edges.find(color => edges.filter(value => value === color).length === 2);
  if (repeated === undefined || new Set(edges).size !== 3) return null;
  const first = edges.indexOf(repeated), second = edges.lastIndexOf(repeated);
  return second - first === 2 ? edges.filter(value => value !== repeated).sort((a, b) => a - b) : null;
}

function readPieces(rows: NativeRows, layout: Layout): Piece[] {
  return tiles(rows, layout.grid).flatMap(tile => key(polesOf(tile) ?? []) === key(layout.poles)
    ? [{ point: tile.point, direction: tile.edges.indexOf(layout.poles[0]!), selected: tile.center !== tile.inner }] : []);
}

function observedGoalContact(rows: NativeRows, layout: Layout): boolean {
  const grid = layout.grid, visible = tiles(rows, grid);
  const perimeter = visible.filter(({ point: [c, r] }) => c === 0 || r === 0 || c === grid.width - 1 || r === grid.height - 1);
  return perimeter.length > 0 && perimeter.every(tile => uniform(tile.edges) && tile.center !== tile.edges[0])
    && readPieces(rows, layout).some(piece => samePoint(piece.point, layout.goal));
}

function readLayout(observation: NativeObservation, rows: NativeRows): Layout | null {
  const grid = measuredGrid(observation);
  if (!grid) return null;
  const cells = tiles(rows, grid), candidates = cells.flatMap(tile => {
    const poles = polesOf(tile);
    return poles ? [{ tile, poles }] : [];
  });
  if (candidates.length < 2 || candidates.some(({ poles }) => key(poles) !== key(candidates[0]!.poles))) return null;
  const goals = cells.filter(tile => uniform(tile.edges) && tile.edges[0] === tile.center && tile.center !== tile.inner);
  if (goals.length !== 1) return null;
  const goal = goals[0]!, floor = cells.filter(tile => uniform(tile.edges) && tile.edges[0] === tile.center && tile.center === tile.inner);
  return { grid, poles: candidates[0]!.poles, goal: goal.point, goalMark: marker(goal),
    floor: [...floor.map(tile => key(tile.point)), key(goal.point), ...candidates.map(item => key(item.tile.point))] };
}

function box(grid: Grid, [c, r]: NativePoint): NativeBox {
  const x = grid.x + c * grid.pitch, y = grid.y + r * grid.pitch, radius = Math.floor(grid.pitch / 2);
  return [x - radius, y - radius, x + radius, y + radius];
}

function selectedPair(pieces: Piece[]): [Piece, Piece] | null {
  const selected = pieces.filter(piece => piece.selected);
  return pieces.length === 2 && selected.length === 1 ? [selected[0]!, pieces.find(piece => !piece.selected)!] : null;
}

function rotationInWinningAnimation(layout: Layout, first: NativeRows, frames: readonly NativeRows[]): number | null {
  const prior = selectedPair(readPieces(first, layout));
  if (!prior) return null;
  const [driver, partner] = prior;
  for (const frame of frames) {
    const returned = selectedPair(readPieces(frame, layout));
    if (!returned) continue;
    const [selected, other] = returned;
    if (!samePoint(driver.point, selected.point) || !samePoint(partner.point, other.point) || partner.direction !== other.direction) continue;
    const delta = (selected.direction - driver.direction + 4) % 4;
    if (delta === 1 || delta === 3) return delta === 1 ? 1 : -1;
  }
  return null;
}

function aligned(a: Piece, b: Piece) {
  return a.direction % 2 === b.direction % 2 && a.point[a.direction % 2] === b.point[a.direction % 2];
}

function outward(layout: Layout, a: NativePoint, b: NativePoint): NativePoint {
  const direction: NativePoint = [Math.sign(a[0] - b[0]), Math.sign(a[1] - b[1])];
  let current = a;
  while (layout.floor.includes(key(advance(current, direction)))) current = advance(current, direction);
  return current;
}

function confirmPairReturn(proposal: PairProposal, rows: NativeRows, turns: Record<string, number>) {
  const { local, was } = proposal, pieces = readPieces(rows, local.layout), returned = selectedPair(pieces);
  if (!returned) return false;
  const [selected, partner] = returned;
  if (local.stage === 0) return samePoint(selected.point, local.driver) && samePoint(partner.point, local.partner)
    && pieces.every(piece => was.some(prior => samePoint(prior.point, piece.point) && prior.direction === piece.direction));
  const direction = was.find(piece => piece.selected)?.direction;
  if (direction === undefined || selected.direction !== rotate(direction, turns[local.input]!)
    || partner.direction !== was.find(piece => !piece.selected)?.direction) return false;
  return local.stage === 1 ? samePoint(selected.point, local.driver) && samePoint(partner.point, local.partner)
    : samePoint(selected.point, local.expected[0]) && samePoint(partner.point, local.expected[1]);
}

function findCoupledStep(pieces: Piece[], network: Network, turns: [string, number][], remaining: number, deadline: () => boolean) {
  const { layout, rejected } = network, { grid } = layout;
  const floor = new Set(layout.floor);
  const scene = coupledPiecesKey(pieces);
  const queue: { pieces: Piece[]; depth: number; first: Step | null; attempt: string }[] = [
    { pieces, depth: 0, first: null, attempt: '' },
  ];
  const visited = new Set([scene]), limit = Math.min(remaining, 12);
  for (let head = 0; head < queue.length && head < 2400; head++) {
    if (deadline()) break;
    const current = queue[head]!;
    if (current.depth >= limit) continue;
    const active = current.pieces.find(piece => piece.selected);
    const inputs: Step[] = current.pieces.filter(piece => !piece.selected).map(({ point }) => ({
      action: { action_ref: 'ACTION6', data: { x: grid.x + point[0] * grid.pitch, y: grid.y + point[1] * grid.pitch } },
      focus: point,
      expected: current.pieces.map(piece => ({ ...piece, selected: samePoint(point, piece.point) })),
    }));
    if (active) for (const [action_ref, quarter] of turns) {
      const changed = current.pieces.map(piece => piece === active ? { ...piece, direction: rotate(piece.direction, quarter) } : piece);
      const expected = settleCoupledPieces(changed, floor, grid.width, grid.height);
      if (expected) inputs.push({ action: { action_ref, data: {} }, focus: active.point, expected });
    }
    for (const step of inputs) {
      const attempt = current.first ? current.attempt : [scene, step.action.action_ref, key(step.focus)].join('/');
      if (!current.first && rejected.includes(attempt)) continue;
      const destination = coupledPiecesKey(step.expected);
      if (visited.has(destination)) continue;
      visited.add(destination);
      const first = current.first ?? step;
      if (step.action.action_ref !== 'ACTION6' && step.expected.some(piece => samePoint(piece.point, layout.goal))) return { step: first, attempt };
      queue.push({ pieces: step.expected, depth: current.depth + 1, first, attempt });
    }
  }
  return null;
}

async function proposeCoupledNetwork(
  observation: NativeObservation, rows: NativeRows, network: Network, memory: Witness, remaining: number, deadline: () => boolean,
): Promise<NetworkProposal | null> {
  const { layout } = network, pieces = readPieces(rows, layout);
  const turns = Object.entries(memory.turns).filter(([input]) => observation.available_action_refs.includes(input));
  if (pieces.length < 3 || pieces.length > 6 || pieces.filter(piece => piece.selected).length > 1
    || !turns.length || !observation.available_action_refs.includes('ACTION6')) return null;
  const plan = findCoupledStep(pieces, network, turns, remaining, deadline);
  if (!plan) return null;
  const { step, attempt } = plan, { action, focus, expected } = step;
  const selecting = action.action_ref === 'ACTION6';
  const strategy = selecting ? 'select_coupled_piece' : 'test_coupled_motion', label = observedPolePairStrategies[strategy];
  const ref = observation.observation_ref, parent = 'G_official_completion';
  const evidence: [string, ...string[]] = [ref, ...new Set([...memory.refs, ...network.refs].filter(value => value !== ref))];
  const point: NativePoint = [layout.grid.x + focus[0] * layout.grid.pitch, layout.grid.y + focus[1] * layout.grid.pitch];
  const binding = selecting ? await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: label, evidence }) : null;
  if (selecting && !binding) return null;
  const goal = { kind: 'settle_coupled_pieces_at_marked_destination', scope: ref.split(':revision:', 1)[0]!,
    subjects: ['selected_piece', 'coupled_pieces', 'marked_destination'], parentObjective: parent,
    satisfactionContract: 'verify_projected_settled_positions_and_official_progress' };
  const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
  const id = 'coupled-pieces:' + need.id, actions = [action];
  return { status: 'proposed', kind: observedPolePairId, network, step, attempt, actions, needId: need.id,
    binding: { observation_ref: ref, level_epoch: observation.level_epoch },
    steps: [{ action, ...(binding ? { point_binding: binding } : {}), expected_after: null }],
    sicSituationCard: { strategy, mode: 'exploration', need: 'Settle a piece on the marked destination', situation: label, evidence,
      agenda: [], selected: box(layout.grid, focus), partners: pieces.filter(piece => !samePoint(piece.point, focus)).map(piece => box(layout.grid, piece.point)),
      destination: box(layout.grid, layout.goal), projected: expected.filter(piece => !pieces.some(old => samePoint(old.point, piece.point)))
        .map(piece => box(layout.grid, piece.point)) },
    question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
    compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
    sicLocalDecision: { strategy, objective: { id, label, parent }, need },
    bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
      preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
}

export function createSicObservedPolePair(): NativeFamily<Proposal> {
  let training: Training | null = null, witness: Witness | null = null, local: Local | null = null, network: Network | null = null;
  return {
    id: observedPolePairId,
    observePublicOutcome(before, after, action, first, second, frames = []) {
      const available = before.available_action_refs;
      if (!available.includes('ACTION6') || !available.includes('ACTION5') || available.includes('ACTION1') || available.includes('ACTION2')) return;
      if (training?.epoch !== before.level_epoch) training = { epoch: before.level_epoch, layout: readLayout(before, first), turns: {}, apart: null, idle: null };
      const { layout } = training;
      if (!layout || !/^ACTION[1-4]$/.test(action.action_ref)) return;
      if (after.levels_completed > before.levels_completed) {
        if (!frames.some(frame => observedGoalContact(frame, layout))) return;
        if (training.apart && training.idle) {
          witness = { epoch: after.level_epoch, poles: layout.poles, goalMark: layout.goalMark, turns: training.turns,
            refs: [training.apart, training.idle, after.observation_ref] };
        } else {
          const turn = rotationInWinningAnimation(layout, first, frames);
          if (turn !== null) witness = { epoch: after.level_epoch, poles: layout.poles, goalMark: layout.goalMark,
            turns: { ...training.turns, [action.action_ref]: turn }, refs: [before.observation_ref, after.observation_ref], rotationOnly: true };
        }
        return;
      }
      if (before.level_epoch !== after.level_epoch) return;
      const prior = selectedPair(readPieces(first, layout)), observed = selectedPair(readPieces(second, layout));
      if (!prior || !observed || prior[1].direction !== observed[1].direction) return;
      const [a, b] = prior, [c, d] = observed, delta = (c.direction - a.direction + 4) % 4;
      if (delta !== 1 && delta !== 3) return;
      training.turns = { ...training.turns, [action.action_ref]: delta === 1 ? 1 : -1 };
      if (!aligned(c, d) && samePoint(a.point, c.point) && samePoint(b.point, d.point)) training.idle = after.observation_ref;
      if (aligned(c, d) && c.direction !== d.direction && !samePoint(c.point, a.point) && !samePoint(d.point, b.point)
        && samePoint(c.point, outward(layout, a.point, b.point)) && samePoint(d.point, outward(layout, b.point, a.point))) {
        training.apart = after.observation_ref;
      }
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      const memory = witness;
      if (remaining < 1 || memory?.epoch !== observation.level_epoch) return null;
      let state = local?.epoch === observation.level_epoch ? local : null;
      const now = execution?.now ?? (() => performance.now()), deadline = Math.min(execution?.deadlineMs ?? Infinity, now() + 160);
      const inTime = () => now() >= deadline;
      if (network?.epoch === observation.level_epoch) return proposeCoupledNetwork(observation, rows, network, memory, remaining, inTime);
      if (!state) {
        if (remaining < 3) return null;
        const layout = readLayout(observation, rows);
        if (!layout || layout.goalMark !== memory.goalMark || key(layout.poles) !== key(memory.poles)) return null;
        const pieces = readPieces(rows, layout), [one, two] = pieces;
        if (pieces.length > 2) return memory.rotationOnly ? null : proposeCoupledNetwork(observation, rows, {
          epoch: observation.level_epoch, layout, refs: [], rejected: [],
        }, memory, remaining, inTime);
        if (!one || !two || !aligned(one, two) || one.direction !== two.direction || samePoint(one.point, two.point)) return null;
        const route = pieces.flatMap((driver, i) => {
          const partner = pieces[1 - i]!, end = outward(layout, driver.point, partner.point);
          return samePoint(end, layout.goal) ? [{ driver, partner, end, other: outward(layout, partner.point, driver.point) }] : [];
        });
        const input = Object.keys(memory.turns).find(action => observation.available_action_refs.includes(action));
        if (route.length !== 1 || !input || !observation.available_action_refs.includes('ACTION6')) return null;
        const { driver, partner, end, other } = route[0]!;
        state = { epoch: observation.level_epoch, layout, input, driver: driver.point, partner: partner.point, expected: [end, other], stage: 0, stopped: false };
      }
      if (state.stopped) return null;
      const { stage, layout } = state, was = readPieces(rows, layout);
      if (was.length !== 2) return null;
      const region = box(layout.grid, state.driver), [left, top, right, bottom] = region;
      const point: NativePoint = [(left + right) / 2, (top + bottom) / 2];
      const action: NativeCommand = stage === 0 ? { action_ref: 'ACTION6', data: { x: point[0], y: point[1] } }
        : { action_ref: state.input, data: {} };
      const strategy = stage === 0 ? 'bind_piece_in_coupled_pair' : stage === 1 ? 'rotate_out_of_coupling_axis' : 'confirm_outward_pair_motion';
      const label = observedPolePairStrategies[strategy], ref = observation.observation_ref, parent = 'G_official_completion';
      const evidence: [string, ...string[]] = [ref, ...new Set(memory.refs.filter(value => value !== ref))];
      const binding = stage === 0 ? await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: label, evidence }) : null;
      const goal = { kind: 'settle_coupled_pair_at_marked_destination', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['selected_piece', 'coupled_partner', 'marked_destination'], parentObjective: parent,
        satisfactionContract: 'verify_projected_settled_positions_and_official_progress' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = 'coupled-pair:' + need.id, actions = [action];
      return { status: 'proposed', kind: observedPolePairId, actions, local: state, was, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: [{ action, ...(binding ? { point_binding: binding } : {}), expected_after: stage === 2 ? state.expected : null }],
        sicSituationCard: { strategy, mode: 'solving', need: 'Settle one piece on the marked destination', situation: label, evidence, agenda: [],
          selected: region, partner: box(layout.grid, state.partner), destination: box(layout.grid, layout.goal) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_coupled_pair_bound' : 'coupled_pair_context_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) {
        return { matched: true, seal_prefix: true, reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      }
      const matched = isNetworkProposal(proposal)
        ? coupledPiecesKey(readPieces(second, proposal.network.layout)) === coupledPiecesKey(proposal.step.expected)
        : !!witness && confirmPairReturn(proposal, second, witness.turns);
      return { matched, seal_prefix: true, reason: matched ? 'expected_orientation_and_motion_confirmed' : 'orientation_or_motion_prediction_contradicted' };
    },
    record(before, after, _action, _first, second, proposal, _index, frames) {
      if (!witness) return { events: [] };
      const layout = isNetworkProposal(proposal) ? proposal.network.layout : proposal.local.layout;
      if (after.levels_completed > before.levels_completed && frames.some(frame => observedGoalContact(frame, layout))) {
        const demonstratedOutward = witness.rotationOnly && !isNetworkProposal(proposal) && proposal.local.stage === 2
          && frames.some(frame => confirmPairReturn(proposal, frame, witness!.turns));
        witness = { ...witness, epoch: after.level_epoch, refs: [...witness.refs.slice(-4), after.observation_ref] };
        if (demonstratedOutward) delete witness.rotationOnly;
      }
      if (before.level_epoch !== after.level_epoch) return { events: [] };
      if (isNetworkProposal(proposal)) {
        const prior = proposal.network;
        const matched = coupledPiecesKey(readPieces(second, layout)) === coupledPiecesKey(proposal.step.expected);
        network = { ...prior, refs: [...prior.refs.slice(-4), after.observation_ref],
          rejected: matched ? prior.rejected : [...prior.rejected.slice(-30), proposal.attempt] };
        return { events: [] };
      }
      const changed = confirmPairReturn(proposal, second, witness.turns), previous = proposal.local;
      local = { ...previous, stage: previous.stage === 0 ? 1 : 2, stopped: !changed || previous.stage === 2 };
      return { events: [] };
    },
    state: () => ({ training, witness, local, network }),
    restore(value: NativeRecord) {
      training = structuredClone((value.training as Training | undefined) ?? null);
      witness = structuredClone((value.witness as Witness | undefined) ?? null);
      local = structuredClone((value.local as Local | undefined) ?? null);
      network = structuredClone((value.network as Network | undefined) ?? null);
    },
  };
}
