import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRows } from '../logos-engine/v6-native-types.ts';

export const observedRailTransfersId = 'sic_follow_visible_rail_transfers';

type Grid = { pitch: number; x: number; y: number };
type Cell = { col: number; row: number };
type Tile = Cell & { role: 'rail' | 'rear' | 'front' | 'arm' | 'bay' | 'slot' | 'box'; paint: number; shape?: string; direction?: number };
type Bay = { box: string | null; slot: string | null; alreadyFilled: boolean };
type Train = Cell & { length: number; bays: Bay[] };
type Board = { grid: Grid; trains: Train[]; rails: Cell[]; arms: (Cell & { dy: number })[]; stock: (Cell & { box: string | null })[] };
type Witness = { epoch: number; grid: Grid; wins: number; evidence: string[] };
type Move = { train: number; rail: Cell; col: number; travel: number };
type Projection = { trains: Train[]; stock: Board['stock']; exposed: number; filled: number; disturbed: number; transfers: number; arms: Cell[] };
type Proposal = NativeProposal & { move: Move; projection: Projection; needId: string; grid: Grid };

const key = ({ col, row }: Cell) => `${col},${row}`;
const at = (grid: Grid, { col, row }: Cell): NativePoint =>
  [grid.x + col * grid.pitch + Math.floor(grid.pitch / 2), grid.y + row * grid.pitch + Math.floor(grid.pitch / 2)];
const box = (grid: Grid, { col, row }: Cell, length = 1): NativeBox =>
  [grid.x + col * grid.pitch, grid.y + row * grid.pitch, grid.x + (col + length) * grid.pitch - 1, grid.y + (row + 1) * grid.pitch - 1];

function tiles(rows: NativeRows, grid: Grid, empty: number) {
  const { x, y, pitch } = grid, end = pitch - 1, middle = Math.floor(pitch / 2);
  const result: Tile[] = [];
  for (let py = y; py + pitch <= rows.length; py += pitch) for (let px = x; px + pitch <= rows[0]!.length; px += pitch) {
    const patch = rows.slice(py, py + pitch).map(line => line.slice(px, px + pitch));
    const profile = patch.map(line => line.filter(color => color !== empty).length), central = patch[middle]!;
    const loc = { col: (px - x) / pitch, row: (py - y) / pitch };
    const perimeter = patch.flatMap((line, i) => i === 0 || i === end ? line : [line[0]!, line[end]!]);
    const inner = patch.slice(1, end).flatMap(line => line.slice(1, end));
    const paint = perimeter[0]!, center = central[middle]!;
    if (profile[0] === 0 && profile[end] === 0 && profile[middle - 1] === pitch && profile[middle + 1] === pitch
      && profile[middle] === 2 && patch[middle - 1]!.every((color, i) => color === patch[middle + 1]![i])) {
      result.push({ ...loc, role: 'rail', paint: patch[middle - 1]![middle]! });
    } else if (paint !== empty && perimeter.every(color => color === paint)) {
      const colors = new Set(inner);
      if (colors.size === 1 && colors.has(empty)) result.push({ ...loc, role: 'bay', paint });
      else if (colors.size === 2 && colors.has(paint)) {
        result.push({ ...loc, role: colors.has(empty) ? 'box' : 'slot', paint,
          shape: inner.map(color => Number(colors.has(empty) ? color === empty : color !== paint)).join('') });
      }
    } else if (profile[middle] === pitch && profile[0] === 2 && profile[end] === 2
      && profile[middle - 1] === pitch - 2 && profile[middle + 1] === pitch - 2
      && central.slice(1, end).every(color => color === center)) {
      if (central[0] === center && central[end] !== center) result.push({ ...loc, role: 'rear', paint: center });
      else if (central[end] === center && central[0] !== center) result.push({ ...loc, role: 'front', paint: center });
    } else if (central.every(color => color === center) && center !== empty
      && ((profile[0] === 1 && profile[end] === 2) || (profile[0] === 2 && profile[end] === 1))) {
      const direction = profile[0] === 1 ? 1 : -1;
      const stem = patch[direction > 0 ? 0 : end]!, arms = patch[direction > 0 ? end : 0]!;
      if (stem[middle] === center && arms[0] === center && arms[end] === center) {
        result.push({ ...loc, role: 'arm', paint: center, direction });
      }
    }
  }
  return result;
}

function readBoard(rows: NativeRows, grid: Grid, empty: number): Board | null {
  const measures = tiles(rows, grid, empty), indexed = new Map(measures.map(tile => [key(tile), tile]));
  const arms = measures.flatMap(tile => tile.role === 'arm' && tile.direction ? [{ col: tile.col, row: tile.row, dy: tile.direction }] : []);
  const rails = measures.filter(tile => tile.role === 'rail').map(({ col, row }) => ({ col, row }));
  if (!arms.length || rails.length < 2) return null;
  const trains: Train[] = [], manifests: Tile[][] = [];
  for (const rear of measures.filter(tile => tile.role === 'rear')) {
    const bays: Tile[] = [];
    for (let col = rear.col + 1; ; col++) {
      const tile = indexed.get(key({ row: rear.row, col }));
      if (!tile) return null;
      if (tile.role === 'front' && tile.paint === rear.paint && bays.length) {
        trains.push({ row: rear.row, col: rear.col, length: col - rear.col + 1, bays: [] });
        manifests.push(bays);
        break;
      }
      if (tile.role !== 'box' && tile.role !== 'bay' && tile.role !== 'slot') return null;
      bays.push(tile);
    }
  }
  if (!trains.length || trains.length !== measures.filter(tile => tile.role === 'front').length || trains.length > 10) return null;
  const payload = measures.filter(tile => tile.role === 'box'), colors = new Map<number, number>();
  for (const tile of payload) colors.set(tile.paint, (colors.get(tile.paint) ?? 0) + 1);
  const ordered = [...colors].sort((a, b) => b[1] - a[1]);
  if (!ordered[0] || ordered[0][1] === ordered[1]?.[1]) return null;
  const normal = ordered[0][0];
  const onTrain = (cell: Cell) => trains.some(t => t.row === cell.row && cell.col >= t.col && cell.col < t.col + t.length);
  const stock = payload.filter(tile => !onTrain(tile) && tile.paint === normal
    && arms.some(arm => tile.col === arm.col && tile.row === arm.row - arm.dy))
    .map(({ row, col, shape }) => ({ row, col, box: shape! }));
  trains.forEach((train, i) => {
    train.bays = manifests[i]!.map(tile => ({
      box: tile.role === 'box' ? tile.shape! : null,
      slot: tile.role === 'slot' ? tile.shape! : tile.role === 'box' && tile.paint !== normal ? 'hidden' : null,
      alreadyFilled: tile.role === 'box' && tile.paint === normal,
    }));
    for (let col = train.col; col < train.col + train.length; col++) rails.push({ col, row: train.row });
  });
  return { grid, trains, rails, arms, stock };
}

function findBoard(rows: NativeRows, known?: Grid): Board | null {
  const components = geometricComponents(rows), empty = [...components].sort((a, b) => b.area - a.area)[0]?.color;
  if (empty === undefined) return null;
  if (known) return readBoard(rows, known, empty);
  const pitches = [...new Set(components.flatMap(({ bbox: [l, t, r, b], area }) => {
    const width = r - l + 1, height = b - t + 1;
    return width === height && width >= 5 && width <= 9 && width % 2 === 1 && area >= 4 * (width - 1) ? [width] : [];
  }))];
  const boards: Board[] = [];
  for (const pitch of pitches) for (let x = 0; x < pitch; x++) for (let y = 0; y < pitch; y++) {
    const board = readBoard(rows, { x, y, pitch }, empty);
    if (board) boards.push(board);
  }
  return boards.length === 1 ? boards[0]! : null;
}

function moves(board: Board): Move[] {
  const rail = new Set(board.rails.map(key));
  const occupied = (cell: Cell) => board.trains.some(t => t.row === cell.row && t.col <= cell.col && cell.col < t.col + t.length);
  return board.rails.flatMap(button => {
    if (occupied(button)) return [];
    const candidates = board.trains.flatMap((train, i) => {
      if (train.row !== button.row) return [];
      const col = button.col < train.col ? button.col : button.col - train.length + 1;
      const first = Math.min(train.col, col), last = Math.max(train.col, col) + train.length - 1;
      for (let j = first; j <= last; j++) {
        if (!rail.has(key({ row: train.row, col: j })) || (j < train.col || j >= train.col + train.length) && occupied({ row: train.row, col: j })) return [];
      }
      return [{ train: i, rail: button, col, travel: Math.abs(col - train.col) }];
    }).sort((a, b) => a.travel - b.travel);
    return candidates[0] && candidates[0].travel !== candidates[1]?.travel ? [candidates[0]] : [];
  });
}

function project(board: Board, move: Move): Projection | null {
  const { trains, stock } = structuredClone(board);
  trains[move.train]!.col = move.col;
  const slots = new Map<string, Bay>();
  for (const train of trains) train.bays.forEach((bay, i) => slots.set(key({ row: train.row, col: train.col + i + 1 }), bay));
  const parked = new Map(stock.map(crate => [key(crate), crate]));
  let transfers = 0;
  const used = new Map<string, Cell>();
  const signatures = new Set<string>();
  for (;;) {
    const signature = JSON.stringify([trains.map(train => train.bays.map(bay => bay.box)), stock.map(crate => crate.box)]);
    if (signatures.has(signature) || signatures.size >= 48) return null;
    signatures.add(signature);
    const wave = board.arms.flatMap(({ row, col, dy }) => {
      const source = key({ row: row - dy, col }), from = slots.get(source) ?? parked.get(source);
      const to = slots.get(key({ row: row + dy, col }));
      return from?.box && to && !to.box ? [{ from, to, arm: { row, col } }] : [];
    });
    if (!wave.length) break;
    if (new Set(wave.map(entry => entry.from)).size !== wave.length || new Set(wave.map(entry => entry.to)).size !== wave.length) return null;
    for (const { from, to, arm } of wave) { to.box = from.box; from.box = null; transfers++; used.set(key(arm), arm); }
  }
  const bays = trains.flatMap(train => train.bays);
  return { trains, stock, transfers, arms: [...used.values()],
    exposed: bays.filter(bay => bay.slot === 'hidden' && !bay.box).length,
    filled: bays.filter(bay => bay.slot !== null && bay.box === bay.slot).length,
    disturbed: bays.filter(bay => bay.alreadyFilled && !bay.box).length };
}

function matches(board: Board, projection: Projection) {
  const expectedStock = projection.stock.filter(crate => crate.box);
  return board.stock.length === expectedStock.length && expectedStock.every(crate => board.stock.some(actual =>
    actual.row === crate.row && actual.col === crate.col && actual.box === crate.box))
    && board.trains.length === projection.trains.length && projection.trains.every(train => {
    const observed = board.trains.find(item => item.row === train.row && item.col === train.col && item.length === train.length);
    return observed && observed.bays.every((bay, i) => bay.box === train.bays[i]!.box
      && (train.bays[i]!.slot !== train.bays[i]!.box || !bay.box || bay.slot !== 'hidden')
      && (train.bays[i]!.slot !== 'hidden' || !!train.bays[i]!.box || bay.slot !== null));
  });
}

export function createSicObservedRailTransfers(): NativeFamily<Proposal> {
  let witness: Witness | null = null;
  let stopped: number | null = null;
  function learn(before: NativeObservation, after: NativeObservation, command: NativeCommand, rows: NativeRows) {
    if (after.levels_completed <= before.levels_completed || command.action_ref !== 'ACTION6') return;
    const board = findBoard(rows, witness?.grid);
    if (!board) return;
    const { grid } = board, { x, y } = command.data;
    if (typeof x !== 'number' || typeof y !== 'number' || !moves(board).some(({ rail }) =>
      rail.col === Math.floor((x - grid.x) / grid.pitch) && rail.row === Math.floor((y - grid.y) / grid.pitch))) return;
    const previous = witness?.epoch === before.level_epoch ? witness : null;
    witness = { epoch: after.level_epoch, grid, wins: (previous?.wins ?? 0) + 1,
      evidence: [...(previous?.evidence.slice(-3) ?? []), before.observation_ref, after.observation_ref] };
  }
  return {
    id: observedRailTransfersId,
    observePublicOutcome: learn,
    async propose(observation, rows, _inputs, remaining, execution) {
      if (!witness || witness.wins < 2 || observation.level_epoch !== witness.epoch || observation.level_epoch === stopped
        || remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const board = findBoard(rows, witness.grid);
      if (!board) return null;
      const choice = moves(board).flatMap(move => {
        const prediction = project(board, move);
        return prediction && (prediction.exposed || prediction.filled) ? [{ move, prediction }] : [];
      }).sort((a, b) => b.prediction.filled - a.prediction.filled || b.prediction.exposed - a.prediction.exposed
        || a.prediction.disturbed - b.prediction.disturbed || b.prediction.transfers - a.prediction.transfers
        || a.move.travel - b.move.travel || a.move.rail.row - b.move.rail.row)[0];
      if (!choice) return null;
      const { move, prediction } = choice, { grid } = board, point = at(grid, move.rail), [x, y] = point;
      const action = { action_ref: 'ACTION6', data: { x, y } }, actions = [action];
      const ref = observation.observation_ref, parent = 'G_official_completion';
      const evidence: [string, ...string[]] = [ref, ...witness.evidence];
      const offer = { input: 'ACTION6', expected: point, evidence };
      const mode = execution?.reasoningMode ?? 'solving';
      const nav = resolveNavigationPrimitives({ mode, evidence, probe: prediction.exposed ? offer : null,
        access: prediction.exposed ? null : offer, interaction: null });
      const strategy = nav.selected?.id;
      if (!strategy) return null;
      const situation = prediction.exposed ? 'Move a train to clear the mismatched load and expose its receiving slot'
        : 'Align an empty receiving slot with a compatible load and the visible transfer arm';
      const pointBinding = await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: situation, evidence });
      if (!pointBinding) return null;
      const goal = { kind: 'route_typed_loads_through_visible_transfers', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['rail', 'transfer_arms', 'receiver_slots'], parentObjective: parent,
        satisfactionContract: 'predicted_train_and_load_placement_confirmed' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence }, id = observedRailTransfersId + ':' + need.id;
      return { status: 'proposed', kind: observedRailTransfersId, actions, move, grid, projection: prediction, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, steps: [{ action, expected_after: null, point_binding: pointBinding }],
        sicSituationCard: { strategy, need: 'Move loads into compatible receiving slots', mode, situation, evidence, agenda: nav.entries,
          triggerCard: nav.card, target: box(grid, move.rail), train: box(grid, board.trains[move.train]!, board.trains[move.train]!.length),
          transfers: prediction.transfers, arms: prediction.arms.map(arm => box(grid, arm)) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation, preconditions: {},
          preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'rail_move_bound' : 'rail_scene_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const measured = findBoard(second, proposal.grid), matched = !!measured && matches(measured, proposal.projection);
      return { matched, seal_prefix: true, reason: matched ? 'rail_and_transfer_projection_confirmed' : 'transfer_projection_contradicted' };
    },
    record(before, after, command, first, second, proposal) {
      if (after.levels_completed > before.levels_completed) learn(before, after, command, first);
      else {
        const board = findBoard(second, proposal.grid);
        if (!board || !matches(board, proposal.projection)) stopped = before.level_epoch;
        else if (witness?.epoch === after.level_epoch) witness = { ...witness,
          evidence: [...witness.evidence.slice(-4), after.observation_ref] };
      }
      return { events: [] };
    },
    state: () => ({ witness, stopped }),
    restore(value) { witness = structuredClone((value.witness as Witness | undefined) ?? null); stopped = (value.stopped as number | undefined) ?? null; },
  };
}
