import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLineDrop, landing, lineAt, type DropChoice, type LineCell } from './column-alignment-plan.ts';
import { resolveNavigationPrimitives } from './navigation-primitives.ts';
import { solidRegionValue } from './observed-click-regions.ts';
import { sicNeedId } from './need-identity.ts';

export const columnAlignmentId = 'sic_defend_or_complete_observed_line';

type Grid = { x: number; y: number; pitch: number; width: number; height: number };
type Colors = { player: number; opponent: number };
type Memory = { epoch: number; grid: Grid; empty: number; colors?: Colors; minimum: number; maximum?: number; evidence: string[]; stopped?: true };
type Proposal = NativeProposal & { memory: Memory; cells: number[][]; choice: DropChoice; needId: string };
type Token = { cell: LineCell; color: number };

const sameCell = (a: LineCell, b: LineCell) => a[0] === b[0] && a[1] === b[1];
const box = (grid: Grid, [row, col]: LineCell): NativeBox => {
  const x = grid.x + col * grid.pitch, y = grid.y + row * grid.pitch;
  return [x, y, x + grid.pitch - 2, y + grid.pitch - 2];
};

function cellsOf(rows: NativeRows, grid: Grid): number[][] | null {
  const board: number[][] = [];
  for (let row = 0; row < grid.height; row++) {
    const line: number[] = [];
    for (let col = 0; col < grid.width; col++) {
      const color = solidRegionValue(rows, box(grid, [row, col]));
      if (color === null) return null;
      line.push(color);
    }
    board.push(line);
  }
  return board;
}

function emptyBoard(rows: NativeRows): { grid: Grid; empty: number } | null {
  const rules = new Map<string, number[]>(), components = geometricComponents(rows);
  for (const { bbox: [l, t, r, b], color, area } of components) {
    if (l !== r || area !== b - t + 1 || area < 12) continue;
    const id = [t, b, color].join(',');
    const columns = rules.get(id) ?? [];
    columns.push(l);
    rules.set(id, columns);
  }
  const found: { grid: Grid; empty: number }[] = [];
  for (const [id, columns] of rules) {
    if (columns.length < 3 || columns.length > 8) continue;
    columns.sort((a, b) => a - b);
    const pitch = columns[1]! - columns[0]!, [y, bottom] = id.split(',').map(Number) as [number, number];
    if (pitch < 3 || columns.some((column, i) => i > 0 && column !== columns[i - 1]! + pitch)) continue;
    const height = (bottom - y + 2) / pitch, width = columns.length + 1, x = columns[0]! - pitch + 1;
    if (!Number.isInteger(height) || height < 4 || height > 9 || x < 0 || columns.at(-1)! + pitch >= rows[0]!.length) continue;
    const grid = { x, y, pitch, width, height }, board = cellsOf(rows, grid);
    const empty = board?.[0]?.[0];
    if (empty !== undefined && board!.every(line => line.every(color => color === empty))) found.push({ grid, empty });
  }
  return found.length === 1 ? found[0]! : null;
}

function additions(before: number[][], next: number[][], empty: number): Token[] | null {
  const tokens: Token[] = [];
  for (const [r, line] of before.entries()) for (const [c, value] of line.entries()) {
    const after = next[r]![c]!;
    if (value === after) continue;
    if (value !== empty || after === empty) return null;
    tokens.push({ cell: [r, c], color: after });
  }
  return tokens;
}

const supports = (board: number[][], [row, col]: LineCell, empty: number) =>
  board[row]![col] === empty && (row === board.length - 1 || board[row + 1]![col] !== empty);

function confirmedTurn(before: number[][], next: number[][], cell: LineCell, empty: number) {
  if (!supports(before, cell, empty)) return null;
  const tokens = additions(before, next, empty);
  const player = tokens?.find(token => sameCell(token.cell, cell));
  const opponent = tokens?.find(token => !sameCell(token.cell, cell));
  if (tokens?.length !== 2 || !player || !opponent || player.color === opponent.color) return null;
  const [r, c] = opponent.cell;
  if (!supports(before, opponent.cell, empty) && !(r + 1 === cell[0] && c === cell[1])) return null;
  return { player, opponent };
}

const normalized = (board: number[][], colors: Colors, empty: number) =>
  board.map(row => row.map(value => value === empty ? 0 : value === colors.player ? 1 : value === colors.opponent ? -1 : NaN));
const dropAt = (board: number[][], column: number, empty: number) => landing(board.map(row => row.map(value => Number(value !== empty))), column);

function solitaryDrop(before: number[][], rows: NativeRows, memory: Memory, cell: LineCell): Token | null {
  const grid = cellsOf(rows, memory.grid), tokens = grid && additions(before, grid, memory.empty);
  return tokens?.length === 1 && sameCell(tokens[0]!.cell, cell) ? tokens[0]! : null;
}

function verifiedPlacement({ memory, cells, choice }: Proposal, rows: NativeRows): boolean {
  const returned = cellsOf(rows, memory.grid), turn = returned && confirmedTurn(cells, returned, choice.cell, memory.empty);
  return !!turn && turn.player.color === memory.colors?.player && turn.opponent.color === memory.colors?.opponent;
}

export function createSicColumnAlignment(): NativeFamily<Proposal> {
  let state: Memory | null = null;
  function learn(before: NativeObservation, after: NativeObservation, command: NativeCommand,
    first: NativeRows, second: NativeRows, frames: readonly NativeRows[]) {
    if (command.action_ref !== 'ACTION6' || before.available_action_refs.some(input => input !== 'ACTION6' && input !== 'ACTION7')) return;
    if (state?.epoch !== before.level_epoch) {
      const empty = emptyBoard(first);
      state = empty ? { epoch: before.level_epoch, ...empty, minimum: 2, evidence: [] } : null;
    }
    if (!state || state.stopped) return;
    const current = state, { grid, empty } = current, { x, y } = command.data;
    if (typeof x !== 'number' || typeof y !== 'number' || y < grid.y || y >= grid.y + grid.height * grid.pitch) return;
    const old = cellsOf(first, grid);
    if (!old) return;
    // A click on a separator can be associated with either adjacent column.
    // The observed first landing resolves that ambiguity.
    const columns = new Set([Math.floor((x - grid.x) / grid.pitch), Math.floor((x - grid.x + 1) / grid.pitch)]);
    const candidates = [...columns].flatMap(column => {
      const cell = dropAt(old, column, empty);
      return cell ? [cell] : [];
    });
    if (!candidates.length) return;

    if (after.levels_completed > before.levels_completed) {
      if (!current.colors) return;
      const player = current.colors.player;
      const winning = candidates.flatMap(cell => {
        const frame = frames.find(frame => solitaryDrop(old, frame, current, cell)?.color === player);
        return frame ? [{ cell, frame }] : [];
      });
      const nextBoard = emptyBoard(second);
      if (winning.length !== 1 || !nextBoard) return;
      const { cell, frame } = winning[0]!;
      const length = lineAt(normalized(cellsOf(frame, grid)!, current.colors, empty), cell, 1).length;
      const maximum = Math.min(current.maximum ?? Infinity, length);
      if (maximum < current.minimum || nextBoard.empty !== empty) return;
      state = { ...current, ...nextBoard, epoch: after.level_epoch, maximum,
        evidence: [...current.evidence.slice(-5), before.observation_ref, after.observation_ref] };
      return;
    }

    const settled = cellsOf(second, grid);
    if (!settled) return;
    const replies = candidates.flatMap(cell => {
      const turn = confirmedTurn(old, settled, cell, empty);
      if (!turn) return [];
      const identified = current.colors ? turn.player.color === current.colors.player && turn.opponent.color === current.colors.opponent
        : frames.some(frame => solitaryDrop(old, frame, current, cell)?.color === turn.player.color);
      return identified ? [turn] : [];
    });
    if (replies.length !== 1) return;
    const turn = replies[0]!, colors = { player: turn.player.color, opponent: turn.opponent.color };
    const board = normalized(settled, colors, empty);
    const lower = Math.max(lineAt(board, turn.player.cell, 1).length, lineAt(board, turn.opponent.cell, -1).length) + 1;
    const minimum = Math.max(current.minimum, lower);
    state = { ...current, colors, minimum,
      evidence: [...current.evidence.slice(-5), after.observation_ref] };
  }

  return {
    id: columnAlignmentId,
    observePublicOutcome(before, after, command, first, second, frames = []) {
      learn(before, after, command, first, second, frames);
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      const memory = state;
      if (!memory || memory.epoch !== observation.level_epoch || memory.stopped || remaining < 1
        || !observation.available_action_refs.includes('ACTION6') || !memory.colors || memory.minimum !== memory.maximum) return null;
      const cells = cellsOf(rows, memory.grid);
      if (!cells) return null;
      const board = normalized(cells, memory.colors, memory.empty), choice = board.flat().some(Number.isNaN) ? null : chooseLineDrop(board, memory.minimum);
      if (!choice) return null;
      const target = box(memory.grid, choice.cell), [l, t, r, b] = target, point: NativePoint = [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...new Set(memory.evidence.filter(item => item !== ref))];
      const mode = execution?.reasoningMode ?? 'solving';
      const nav = resolveNavigationPrimitives({ mode, evidence, probe: null,
        access: { input: 'ACTION6', expected: point, evidence }, interaction: null });
      const strategy = nav.selected?.id;
      if (!strategy) return null;
      const reason = choice.reason === 'complete' ? 'Complete the measured winning line on a supported cell'
        : choice.reason === 'block' ? 'Occupy the supported cell that would complete the opponent’s line'
          : 'Compare possible replies before choosing the next supported placement';
      const binding = await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason, evidence });
      if (!binding) return null;
      const parent = 'G_official_completion';
      const goal = { kind: 'complete_supported_line_against_observed_opponent', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['drop_column', 'winning_line', 'opponent_reply'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_a_measured_supported_line' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = columnAlignmentId + ':' + need.id, [x, y] = point, action = { action_ref: 'ACTION6', data: { x, y } }, actions = [action];
      return { status: 'proposed', kind: columnAlignmentId, memory, cells, choice, needId: need.id, actions,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: [{ action, point_binding: binding, expected_after: target }],
        sicSituationCard: { strategy, need: 'Complete a supported line while defending against the opponent',
          mode, situation: reason, evidence, agenda: nav.entries, triggerCard: nav.card,
          target, line: choice.line.map(cell => box(memory.grid, cell)), defensive: choice.reason === 'block' },
        question: { reason, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: reason, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: reason, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: reason,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_column_and_gravity_bound' : 'placement_board_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = before.state === after.state && verifiedPlacement(proposal, second);
      return { matched, seal_prefix: true, reason: matched ? 'supported_drop_and_opponent_reply_observed' : 'placement_prediction_contradicted' };
    },
    record(before, after, command, first, second, proposal, _index, frames = []) {
      const matched = after.levels_completed > before.levels_completed || before.state === after.state && verifiedPlacement(proposal, second);
      if (!matched && state) state = { ...state, stopped: true };
      else learn(before, after, command, first, second, frames);
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone((value.state as Memory | null | undefined) ?? null); },
  };
}
