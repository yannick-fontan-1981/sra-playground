import type { NativeBox, NativeCommand, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const settleMatchingEdgesId = 'sic_settle_pieces_at_matching_edges';
const directions = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const;
type Piece = { x: number; y: number; ink: number };
type Grid = { x: number; y: number; cols: number; rows: number; pitch: number; edges: readonly number[] };
type Blocker = { x: number; y: number; border: number; inset: number };
type Board = { grid: Grid; pieces: Piece[]; blockers: Blocker[]; freeMark?: number; fixedMark?: number };
type Witness = { direction: number; refs: readonly [string, string] };
type Memory = { controls: Record<string, Witness>; wins: number; blockedEpoch: number | null; fit: string };
type Proposal = NativeProposal & { grid: Grid; predicted: Piece[]; blockers: Blocker[]; needId: string };

function matchingContact(piece: Piece, { edges, cols, rows }: Grid) {
  return (piece.y === 0 && piece.ink === edges[0]) || (piece.y === rows - 1 && piece.ink === edges[1])
    || (piece.x === 0 && piece.ink === edges[2]) || (piece.x === cols - 1 && piece.ink === edges[3]);
}

function readBoard(frame: NativeRows, grid: Grid): Board | null {
  const { x, y, cols, rows, pitch, edges } = grid;
  const pieces: Piece[] = [], blockers: Blocker[] = [], fields = new Map<number, number>();
  let markOffset: number | undefined, fixedMark: number | undefined, freeMark: number | undefined;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const left = x + i * pitch, top = y + j * pitch, ink = frame[top]![left]!;
    const inset = frame[top + 1]![left + 1]!;
    if (ink !== inset && !edges.includes(ink) && !edges.includes(inset)) {
      const outlined = frame.slice(top, top + pitch).every((row, v) =>
        row.slice(left, left + pitch).every((value, u) =>
          value === (u === 0 || v === 0 || u === pitch - 1 || v === pitch - 1 ? ink : inset)));
      if (!outlined) return null;
      blockers.push({ x: i, y: j, border: ink, inset });
      continue;
    }
    let mark: { offset: number; ink: number } | undefined;
    for (let v = 0; v < pitch; v++) for (let u = 0; u < pitch; u++) {
      const value = frame[top + v]![left + u]!;
      if (value === ink) continue;
      if (mark) return null;
      mark = { offset: v * pitch + u, ink: value };
    }
    if (!mark) {
      if (edges.includes(ink)) return null;
      fields.set(ink, (fields.get(ink) ?? 0) + 1);
      continue;
    }
    if (!edges.includes(ink) || (markOffset !== undefined && mark.offset !== markOffset)) return null;
    markOffset = mark.offset;
    const piece = { x: i, y: j, ink };
    if (matchingContact(piece, grid)) {
      if (fixedMark !== undefined && fixedMark !== mark.ink) return null;
      fixedMark = mark.ink;
    } else {
      if (freeMark !== undefined && freeMark !== mark.ink) return null;
      freeMark = mark.ink;
    }
    pieces.push(piece);
  }
  return fields.size === 1 && pieces.length >= 2 && (fixedMark === undefined || fixedMark !== freeMark)
    ? { grid, pieces, blockers, ...(freeMark === undefined ? {} : { freeMark }), ...(fixedMark === undefined ? {} : { fixedMark }) }
    : null;
}

function findBoard(frame: NativeRows): Board | null {
  const height = frame.length, width = frame[0]?.length ?? 0;
  if (width < 20 || height < 20) return null;
  const middle = Math.floor(width / 2), centerY = Math.floor(height / 2);
  for (let top = 1; top < centerY - 8; top++) {
    const bottom = height - top - 1, north = frame[top]![middle]!, south = frame[bottom]![middle]!;
    if (north === south || frame[top - 1]![middle] === north || frame[bottom + 1]![middle] === south) continue;
    let left = middle, right = middle;
    while (left > 0 && frame[top]![left - 1] === north) left--;
    while (right + 1 < width && frame[top]![right + 1] === north) right++;
    if (left < 2 || right + 2 >= width || right - left < 15) continue;
    const west = frame[centerY]![left - 1]!, east = frame[centerY]![right + 1]!;
    const edges = [north, south, west, east];
    if (new Set(edges).size !== directions.length
      || edges.some(ink => frame[top - 1]![middle] === ink || frame[bottom + 1]![middle] === ink)) continue;
    const y = top + 2, fieldWidth = right - left + 1, fieldHeight = bottom - 1 - y;
    if (frame[top + 1]!.slice(left, right + 1).some(ink => ink !== north)
      || [bottom - 1, bottom].some(row => frame[row]!.slice(left, right + 1).some(ink => ink !== south))) continue;
    if (frame.slice(y, bottom - 1).some(row => row[left - 2] !== west || row[left - 1] !== west
      || row[right + 1] !== east || row[right + 2] !== east)) continue;
    const candidates: Board[] = [];
    for (let pitch = 3; pitch <= Math.min(fieldWidth, fieldHeight) / 3; pitch++) {
      if (fieldWidth % pitch || fieldHeight % pitch) continue;
      const board = readBoard(frame, { x: left, y, cols: fieldWidth / pitch, rows: fieldHeight / pitch, pitch, edges });
      if (board) candidates.push(board);
    }
    if (candidates.length === 1) return candidates[0]!;
  }
  return null;
}

const signature = (pieces: readonly Piece[]) => pieces.map(({ x, y, ink }) => `${ink}:${x},${y}`).sort().join('|');
const blockerPositions = ({ grid, blockers }: Board) => new Set(blockers.map(({ x, y }) => y * grid.cols + x));
const sameBlockers = (left: Blocker[], right: Blocker[]) => JSON.stringify(left) === JSON.stringify(right);

function settle(grid: Grid, pieces: readonly Piece[], direction: number, blockers: ReadonlySet<number>): Piece[] {
  const [dx, dy] = directions[direction]!;
  let settled = [...pieces];
  for (;;) {
    const occupied = new Map(settled.map(piece => [piece.y * grid.cols + piece.x, piece]));
    const moving = new Map<Piece, boolean>();
    function canMove(piece: Piece): boolean {
      const known = moving.get(piece);
      if (known !== undefined) return known;
      const x = piece.x + dx, y = piece.y + dy, cell = y * grid.cols + x, ahead = occupied.get(cell);
      const result = !matchingContact(piece, grid) && x >= 0 && x < grid.cols && y >= 0 && y < grid.rows
        && !blockers.has(cell) && (!ahead || canMove(ahead));
      moving.set(piece, result);
      return result;
    }
    if (!settled.map(canMove).some(Boolean)) return settled;
    settled = settled.map(piece => moving.get(piece) ? { ...piece, x: piece.x + dx, y: piece.y + dy } : piece);
  }
}

function findFirstStep(board: Board, controls: readonly [string, Witness][], budget: number) {
  type Node = { pieces: Piece[]; depth: number; first?: { input: string; predicted: Piece[]; direction: number } };
  const queue: Node[] = [{ pieces: board.pieces, depth: 0 }], seen = new Set([signature(board.pieces)]);
  const maxDepth = Math.min(budget, 12), maxNodes = 5_000;
  const blockers = blockerPositions(board);
  for (let index = 0; index < queue.length && index < maxNodes; index++) {
    const { pieces, depth, first } = queue[index]!;
    if (depth >= maxDepth) continue;
    for (const [input, { direction }] of controls) {
      const predicted = settle(board.grid, pieces, direction, blockers), key = signature(predicted);
      if (seen.has(key)) continue;
      const step = first ?? { input, predicted, direction };
      if (predicted.every(piece => matchingContact(piece, board.grid))) return { ...step, moves: depth + 1 };
      seen.add(key);
      if (queue.length >= maxNodes) return null;
      queue.push({ pieces: predicted, depth: depth + 1, first: step });
    }
  }
  return null;
}

function tileBox(grid: Grid, tile: { x: number; y: number }): NativeBox {
  const x = grid.x + tile.x * grid.pitch, y = grid.y + tile.y * grid.pitch;
  return [x, y, x + grid.pitch - 1, y + grid.pitch - 1];
}

function edgeBox({ x, y, rows, cols, pitch }: Grid, direction: number): NativeBox {
  const right = x + cols * pitch, bottom = y + rows * pitch;
  return ([[x, y - 2, right - 1, y - 1], [x, bottom, right - 1, bottom + 1],
    [x - 2, y, x - 1, bottom - 1], [right, y, right + 1, bottom - 1]] as const)[direction]!;
}

const fitKey = ({ grid }: Board) => grid.edges.join(',');

export function createSicSettleMatchingEdges(): NativeFamily<Proposal> {
  let memory: Memory | null = null;
  const expectedBoard = (frame: NativeRows, { grid, predicted, blockers = [] }: Proposal) => {
    const observed = readBoard(frame, grid);
    return !!observed && sameBlockers(observed.blockers, blockers) && signature(observed.pieces) === signature(predicted);
  };
  function learn(before: NativeObservation, after: NativeObservation, command: NativeCommand, first: NativeRows, second: NativeRows,
    frames: readonly NativeRows[]) {
    const input = command.action_ref, won = after.levels_completed > before.levels_completed;
    const directional = /^ACTION[1-4]$/.test(input);
    if (!directional && !(won && input === 'ACTION6')) return;
    const board = findBoard(first);
    if (!board) return;
    const returned = won && after.level_epoch !== before.level_epoch ? frames.at(-2) : second;
    const actual = returned && readBoard(returned, board.grid);
    if (!actual || !sameBlockers(board.blockers, actual.blockers)
      || (won && !actual.pieces.every(piece => matchingContact(piece, board.grid)))) return;
    const fit = fitKey(board);
    const prior = memory?.fit === fit ? memory : { controls: {}, wins: 0, blockedEpoch: null, fit };
    if (!directional) {
      if (actual.pieces.length === board.pieces.length) {
        memory = { ...prior, wins: prior.wins + 1 };
      }
      return;
    }
    const known = prior.controls[input];
    const previous = signature(board.pieces);
    const blockers = blockerPositions(board);
    const possible = directions.flatMap((_delta, direction) => {
      const predicted = settle(board.grid, board.pieces, direction, blockers);
      if (signature(predicted) === previous) return [];
      if (signature(predicted) === signature(actual.pieces)) return [direction];
      return [];
    });
    if (possible.length === 1) {
      const direction = possible[0]!;
      if (known && known.direction !== direction) {
        memory = { ...prior, blockedEpoch: before.level_epoch };
        return;
      }
      const controls = { ...prior.controls, [input]: { direction, refs: [before.observation_ref, after.observation_ref] as const } };
      memory = { ...prior, controls, wins: prior.wins + Number(won) };
    }
  }
  return {
    id: settleMatchingEdgesId,
    observePublicOutcome(before, after, command, first, second, frames = []) {
      learn(before, after, command, first, second, frames);
    },
    propose(observation, rows, _inputs, remaining, execution) {
      if (!memory || memory.wins < 2 || memory.blockedEpoch === observation.level_epoch || remaining < 1) return null;
      const controls = Object.entries(memory.controls).filter(([input]) => observation.available_action_refs.includes(input))
        .sort((a, b) => a[1].direction - b[1].direction);
      if (new Set(controls.map(([, witness]) => witness.direction)).size !== directions.length) return null;
      const board = findBoard(rows);
      if (!board || fitKey(board) !== memory.fit) return null;
      const step = findFirstStep(board, controls, execution?.remainingLevelActions ?? remaining);
      if (!step) return null;
      const { grid } = board, { predicted } = step;
      const action = { action_ref: step.input, data: {} }, actions = [action];
      const ref = observation.observation_ref, parent = 'G_official_completion';
      const evidence: [string, ...string[]] = [ref, ...new Set(controls.flatMap(([, witness]) => witness.refs))];
      const moved = predicted.flatMap((piece, index) => {
        const from = board.pieces[index]!;
        return piece.x === from.x && piece.y === from.y ? [] : [{ from, piece }];
      });
      const newlyFixed = moved.filter(({ piece }) => matchingContact(piece, grid));
      const focus = newlyFixed[0] ?? moved[0]!;
      const target: NativePoint = [grid.x + focus.piece.x * grid.pitch, grid.y + focus.piece.y * grid.pitch];
      const offer = { input: step.input, expected: target, evidence }, mode = execution?.reasoningMode ?? 'solving';
      const nav = resolveNavigationPrimitives({ mode, evidence, probe: null,
        access: newlyFixed.length ? null : offer, interaction: newlyFixed.length ? offer : null });
      const strategy = nav.selected?.id;
      if (!strategy) return null;
      const situation = newlyFixed.length ? 'Settle moving pieces until they attach to matching edges'
        : 'Slide pieces clear of a blockage while preserving those already attached';
      const goal = { kind: 'seat_pieces_at_matching_edges', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['sliding_pieces', 'matching_edges'], parentObjective: parent, satisfactionContract: 'official_completion_after_matched_contacts' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence }, id = settleMatchingEdgesId + ':' + need.id;
      return {
        status: 'proposed', kind: settleMatchingEdgesId, actions, grid, predicted, blockers: board.blockers, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: [{ action, expected_after: tileBox(grid, focus.piece) }],
        sicSituationCard: { strategy, need: 'Bring every moving piece into contact with a matching edge', mode, situation, evidence,
          agenda: nav.entries, triggerCard: nav.card, edge: edgeBox(grid, step.direction), movesRemaining: step.moves,
          slides: moved.map(({ from, piece }) => ({ from: tileBox(grid, from), to: tileBox(grid, piece), attaches: matchingContact(piece, grid) })),
          ...(board.blockers.length ? { stationaryBlockers: board.blockers.map(blocker => tileBox(grid, blocker)) } : {}) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: 'Seat the pieces at matching edges', parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'slide_bound_to_visible_board' : 'sliding_board_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = expectedBoard(second, proposal);
      return { matched, seal_prefix: true, reason: matched ? 'piece_positions_and_matching_contacts_confirmed' : 'slide_projection_contradicted' };
    },
    record(before, after, command, first, second, proposal, _index, frames) {
      if (after.levels_completed > before.levels_completed || expectedBoard(second, proposal)) {
        learn(before, after, command, first, second, frames);
      } else if (memory) {
        memory = { ...memory, blockedEpoch: before.level_epoch };
      }
      return { events: [] };
    },
    state: () => ({ memory }),
    restore(value: NativeRecord) { memory = structuredClone((value.memory ?? null) as Memory | null); },
  };
}
