import type { NativeBox, NativeCommand, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';
import { maximumCommittedActions } from './plan-step.ts';

export const settleMatchingEdgesId = 'sic_settle_pieces_at_matching_edges';
const directions = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const;
type Piece = { x: number; y: number; ink: number };
type Grid = { x: number; y: number; cols: number; rows: number; pitch: number; edges: readonly number[] };
type Blocker = { x: number; y: number; border: number; inset: number };
type SlideMode = { attached: boolean; direction: number | null };
type Panel = SlideMode & { box: NativeBox };
type AttachmentMarks = { freeMark?: number; fixedMark?: number };
type Board = AttachmentMarks & { grid: Grid; pieces: Piece[]; blockers: Blocker[]; panel?: Panel };
type Witness = { direction: number; refs: readonly [string, string] };
type SwitchWitness = { input: string; refs: readonly [string, string] };
type Memory = { controls: Record<string, Witness>; wins: number; blockedEpoch: number | null; fit: string;
  switchRefs?: Partial<Record<'attach' | 'release', SwitchWitness>>;
  switchVerifiedAt?: number;
  refuted?: { epoch: number; edges: string[] } };
type Proposal = NativeProposal & { grid: Grid; predicted: Piece[]; blockers: Blocker[]; needId: string;
  slidePath?: readonly SwitchedStep[]; attachmentMarks?: AttachmentMarks };

function matchingContact(piece: Piece, { edges, cols, rows }: Grid) {
  return (piece.y === 0 && piece.ink === edges[0]) || (piece.y === rows - 1 && piece.ink === edges[1])
    || (piece.x === 0 && piece.ink === edges[2]) || (piece.x === cols - 1 && piece.ink === edges[3]);
}

function readSlidePanel(frame: NativeRows, grid: Grid): Panel | null {
  const active: number[] = [], rings = new Set<number>(), switches: { attached: boolean; box: NativeBox }[] = [];
  const fieldRight = grid.x + grid.cols * grid.pitch, fieldBottom = grid.y + grid.rows * grid.pitch;
  for (let y = 0; y < frame.length - 3; y++) for (let x = 0; x < frame[y]!.length - 4; x++) {
    if (x + 4 >= grid.x - 2 && x < fieldRight + 2 && y + 4 >= grid.y - 2 && y < fieldBottom + 2) continue;
    const stroke = frame[y]![x]!, base = frame[y]![x + 1]!;
    const inside = frame[y + 1]![x + 2];
    if (stroke !== base && [0, 1, 2, 3].every(v => [0, 1, 2, 3, 4].every(u =>
      v === 1 && u === 2 || frame[y + v]![x + u] === (u === 0 || u === 4 || v === 3 ? stroke : base)))) {
      switches.push({ attached: inside !== base, box: [x, y, x + 4, y + 3] });
    }
    if (y + 4 >= frame.length) continue;
    const edge = grid.edges.indexOf(base);
    if (edge < 0 || stroke === base) continue;
    const ring = [0, 1, 2, 3, 4].every(v => [0, 1, 2, 3, 4].every(u => {
      if (u === 2 && v === 2) return true;
      const boundary = Number(u === 0 || u === 4) + Number(v === 0 || v === 4);
      return frame[y + v]![x + u] === (boundary === 1 ? base : stroke);
    }));
    if (!ring) continue;
    if (rings.has(edge)) return null;
    rings.add(edge);
    if (frame[y + 2]![x + 2] !== stroke) active.push(edge);
  }
  return switches.length === 1 && rings.size === directions.length && active.length <= 1
    ? { ...switches[0]!, direction: active[0] ?? null } : null;
}

function readBoard(frame: NativeRows, grid: Grid, withSwitch = false): Board | null {
  const { x, y, cols, rows, pitch, edges } = grid;
  const panel = withSwitch ? readSlidePanel(frame, grid) : null;
  if (withSwitch && !panel) return null;
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
    if (panel?.attached !== false && matchingContact(piece, grid)) {
      if (fixedMark !== undefined && fixedMark !== mark.ink) return null;
      fixedMark = mark.ink;
    } else {
      if (freeMark !== undefined && freeMark !== mark.ink) return null;
      freeMark = mark.ink;
    }
    pieces.push(piece);
  }
  return fields.size === 1 && pieces.length >= 2 && (fixedMark === undefined || fixedMark !== freeMark)
    ? { grid, pieces, blockers, ...(freeMark === undefined ? {} : { freeMark }), ...(fixedMark === undefined ? {} : { fixedMark }),
      ...(panel ? { panel } : {}) }
    : null;
}

function findBoard(frame: NativeRows, withSwitch = false): Board | null {
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
      const board = readBoard(frame, { x: left, y, cols: fieldWidth / pitch, rows: fieldHeight / pitch, pitch, edges }, withSwitch);
      if (board) candidates.push(board);
    }
    if (candidates.length === 1) return candidates[0]!;
  }
  return null;
}

const signature = (pieces: readonly Piece[]) => pieces.map(({ x, y, ink }) => `${ink}:${x},${y}`).sort().join('|');
const blockerPositions = ({ grid, blockers }: Board) => new Set(blockers.map(({ x, y }) => y * grid.cols + x));
const sameBlockers = (left: Blocker[], right: Blocker[]) => JSON.stringify(left) === JSON.stringify(right);
const sameAttachmentMarks = (before: AttachmentMarks, after: AttachmentMarks) =>
  (after.freeMark === undefined || (before.freeMark ?? after.freeMark) === after.freeMark && before.fixedMark !== after.freeMark)
  && (after.fixedMark === undefined || (before.fixedMark ?? after.fixedMark) === after.fixedMark && before.freeMark !== after.fixedMark);

function settle(grid: Grid, pieces: readonly Piece[], direction: number | null, blockers: ReadonlySet<number>, attached = true): Piece[] {
  let settled = [...pieces];
  if (direction === null) return settled;
  const [dx, dy] = directions[direction]!;
  for (;;) {
    const occupied = new Map(settled.map(piece => [piece.y * grid.cols + piece.x, piece]));
    const moving = new Map<Piece, boolean>();
    function canMove(piece: Piece): boolean {
      const known = moving.get(piece);
      if (known !== undefined) return known;
      const x = piece.x + dx, y = piece.y + dy, cell = y * grid.cols + x, ahead = occupied.get(cell);
      const result = (!attached || !matchingContact(piece, grid)) && x >= 0 && x < grid.cols && y >= 0 && y < grid.rows
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

const switchKey = (pieces: readonly Piece[], mode: SlideMode) => `${Number(mode.attached)}:${mode.direction}:${signature(pieces)}`;
const switchEffect = (attached: boolean) => attached ? 'attach' : 'release';
type SwitchedStep = { input: string; predicted: Piece[]; direction: number | null; expectedMode: SlideMode; triedEdge: string };

function findSwitchedPath(board: Board, controls: readonly [string, Witness][], budget: number, refuted: readonly string[]) {
  type Node = { key: string; pieces: Piece[]; mode: SlideMode; depth: number; previous: number; step?: SwitchedStep };
  const panel = board.panel!, blockers = blockerPositions(board);
  const root = switchKey(board.pieces, panel), seen = new Set([root]);
  const queue: Node[] = [{ key: root, pieces: board.pieces, mode: panel, depth: 0, previous: -1 }];
  const commands: readonly (readonly [string, number | null])[] = [...controls.map(([key, witness]) => [key, witness.direction] as const), ['ACTION5', null]];
  const denied = new Set(refuted), maxNodes = 40_000, maxDepth = Math.min(budget, 12);
  for (let i = 0; i < queue.length && i < maxNodes; i++) {
    const current = queue[i]!;
    if (current.depth >= maxDepth) continue;
    for (const [input, direction] of commands) {
      const triedEdge = current.key + '/' + input;
      if (denied.has(triedEdge)) continue;
      const expectedMode = direction === null ? { attached: !current.mode.attached, direction: current.mode.direction }
        : { attached: current.mode.attached, direction };
      const predicted = settle(board.grid, current.pieces, expectedMode.direction, blockers, expectedMode.attached);
      const key = switchKey(predicted, expectedMode);
      if (seen.has(key)) continue;
      const step = { input, predicted, direction, expectedMode, triedEdge };
      if (expectedMode.attached && predicted.every(piece => matchingContact(piece, board.grid))) {
        const path = [step];
        for (let node = current; node.previous >= 0; node = queue[node.previous]!) path.push(node.step!);
        return path.reverse();
      }
      seen.add(key);
      if (queue.length >= maxNodes) return null;
      queue.push({ key, pieces: predicted, mode: expectedMode, depth: current.depth + 1, previous: i, step });
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

function currentSwitchEvidence(memory: Memory | null, observation: NativeObservation): boolean {
  // A newly introduced control is usable after its measured return in this
  // context. Cross-level reuse still requires the existing scored witness.
  const scope = observation.observation_ref.split(':epoch:')[0];
  return Object.values(memory?.switchRefs ?? {}).some(witness => {
    if (!witness || witness.input !== 'ACTION5' || !Array.isArray(witness.refs) || witness.refs.length !== 2) return false;
    const refs = witness.refs.map(ref => typeof ref === 'string' ? ref.match(/^(.*):epoch:(\d+):revision:(\d+):frame:(.+)$/) : null);
    return refs.every(ref => ref && ref[1] === scope && Number(ref[2]) === observation.level_epoch
      && Number.isSafeInteger(Number(ref[3])) && Number(ref[3]) <= observation.revision)
      && Number(refs[0]![3]) < Number(refs[1]![3]);
  });
}

export function createSicSettleMatchingEdges(): NativeFamily<Proposal> {
  let memory: Memory | null = null;
  const expectedBoard = (frame: NativeRows, { grid, predicted, blockers = [], slidePath, attachmentMarks }: Proposal, index: number) => {
    const step = slidePath?.[index], expectedMode = step?.expectedMode;
    const observed = readBoard(frame, grid, !!expectedMode);
    return !!observed && sameBlockers(observed.blockers, blockers) && signature(observed.pieces) === signature(step?.predicted ?? predicted)
      && (!attachmentMarks || sameAttachmentMarks(attachmentMarks, observed))
      && (!expectedMode || observed.panel?.attached === expectedMode.attached && observed.panel.direction === expectedMode.direction);
  };
  function learn(before: NativeObservation, after: NativeObservation, command: NativeCommand, first: NativeRows, second: NativeRows,
    frames: readonly NativeRows[]) {
    const input = command.action_ref, won = after.levels_completed > before.levels_completed;
    const directional = /^ACTION[1-4]$/.test(input);
    const possibleSwitch = before.available_action_refs.includes('ACTION5') && (input === 'ACTION5' || input === 'ACTION6');
    const switching = ((memory?.switchVerifiedAt ?? Infinity) <= before.level_epoch || currentSwitchEvidence(memory, before))
      && before.available_action_refs.includes('ACTION5');
    if (!directional && !possibleSwitch && !(won && input === 'ACTION6')) return;
    const switchedBoard = possibleSwitch || switching ? findBoard(first, true) : null;
    const bounds = switchedBoard?.panel?.box, { x, y } = command.data;
    const toggled = possibleSwitch && (input === 'ACTION5' || !!bounds && typeof x === 'number' && typeof y === 'number'
      && x >= bounds[0] && x <= bounds[2] && y >= bounds[1] && y <= bounds[3]);
    if (!directional && !toggled && !(won && input === 'ACTION6')) return;
    const board = toggled ? switchedBoard : (switching && switchedBoard) || findBoard(first);
    if (!board) return;
    const returned = won && after.level_epoch !== before.level_epoch ? frames.at(-2) : second;
    const actual = returned && readBoard(returned, board.grid, !!board.panel);
    if (!actual || !sameBlockers(board.blockers, actual.blockers)
      || (won && !actual.pieces.every(piece => matchingContact(piece, board.grid)))) return;
    const fit = fitKey(board);
    const known: Memory = memory?.fit === fit ? memory : { controls: {}, wins: 0, blockedEpoch: null, fit };
    const prior = won && known.switchRefs?.attach && known.switchRefs.release
      ? { ...known, switchVerifiedAt: after.level_epoch } : known;
    if (board.panel && actual.panel) {
      const refs = [before.observation_ref, after.observation_ref] as const;
      const intendedDirection = toggled ? board.panel.direction : actual.panel.direction;
      if ((!toggled && (!directional || intendedDirection === null))
        || actual.panel.attached !== (toggled ? !board.panel.attached : board.panel.attached)
        || actual.panel.direction !== intendedDirection || !sameAttachmentMarks(board, actual)) return;
      const projected = settle(board.grid, board.pieces, intendedDirection, blockerPositions(board), actual.panel.attached);
      if (signature(projected) !== signature(actual.pieces)) return;
      if (toggled) {
        const switchRefs = { ...prior.switchRefs, [switchEffect(actual.panel.attached)]: { input, refs } };
        memory = { ...prior, switchRefs, wins: prior.wins + Number(won),
          ...(won && switchRefs.attach && switchRefs.release ? { switchVerifiedAt: after.level_epoch } : {}) };
      }
      else if (intendedDirection !== null && (prior.controls[input]?.direction ?? intendedDirection) === intendedDirection) {
        memory = { ...prior, controls: { ...prior.controls, [input]: { direction: intendedDirection, refs } }, wins: prior.wins + Number(won) };
      }
      return;
    }
    if (!directional) {
      if (actual.pieces.length === board.pieces.length) {
        memory = { ...prior, wins: prior.wins + 1 };
      }
      return;
    }
    const witness = prior.controls[input];
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
      if (witness && witness.direction !== direction) {
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
      const switching = ((memory.switchVerifiedAt ?? Infinity) <= observation.level_epoch || currentSwitchEvidence(memory, observation))
        && observation.available_action_refs.includes('ACTION5');
      const board = (switching ? findBoard(rows, true) : null) ?? findBoard(rows);
      if (!board || fitKey(board) !== memory.fit) return null;
      const budget = execution?.remainingLevelActions ?? remaining;
      const refuted = memory.refuted?.epoch === observation.level_epoch ? memory.refuted.edges : [];
      const route = board.panel ? findSwitchedPath(board, controls, budget, refuted) : null;
      const switched = route?.[0];
      const ordinary = board.panel ? null : findFirstStep(board, controls, budget);
      const step = switched ?? ordinary;
      if (!step) return null;
      const { grid } = board, { predicted } = step;
      const action = { action_ref: step.input, data: {} };
      const unknownSwitch = route?.findIndex(leg => leg.input === 'ACTION5'
        && memory!.switchRefs?.[switchEffect(leg.expectedMode.attached)]?.input !== leg.input) ?? -1;
      const prefix = unknownSwitch < 0 ? maximumCommittedActions : Math.max(1, unknownSwitch);
      const slidePath = route?.slice(0, Math.min(remaining, prefix, maximumCommittedActions));
      const actions = slidePath?.map(({ input }) => ({ action_ref: input, data: {} })) ?? [action];
      const ref = observation.observation_ref, parent = 'G_official_completion';
      const evidence: [string, ...string[]] = [ref, ...new Set([...controls.flatMap(([, witness]) => witness.refs),
        ...(switched ? Object.values(memory.switchRefs ?? {}).flatMap(witness => witness.refs) : [])])];
      const moved = predicted.flatMap((piece, index) => {
        const from = board.pieces[index]!;
        return piece.x === from.x && piece.y === from.y ? [] : [{ from, piece }];
      });
      const newlyFixed = switched?.expectedMode.attached === false ? [] : moved.filter(({ piece }) => matchingContact(piece, grid));
      const toggle = !!switched && step.input === 'ACTION5', probing = toggle && unknownSwitch === 0;
      const focus = newlyFixed[0] ?? moved[0], directionBox = step.direction === null ? null : edgeBox(grid, step.direction);
      const targetBox = toggle ? board.panel!.box : focus ? tileBox(grid, focus.piece) : directionBox!;
      const target: NativePoint = [targetBox[0], targetBox[1]];
      const offer = { input: step.input, expected: target, evidence }, mode = execution?.reasoningMode ?? (probing ? 'exploration' : 'solving');
      const interacts = toggle || newlyFixed.length > 0;
      const nav = resolveNavigationPrimitives({ mode, evidence, probe: probing ? offer : null,
        access: interacts ? null : offer, interaction: interacts && !probing ? offer : null });
      const strategy = nav.selected?.id;
      if (!strategy) return null;
      const situation = toggle ? switched!.expectedMode.attached
        ? 'Enable attachment and check the pieces at their matching edges'
        : 'Release attachment and check how the pieces settle under the current gravity'
        : newlyFixed.length ? 'Settle moving pieces until they attach to matching edges'
        : 'Slide pieces clear of a blockage while preserving those already attached';
      const goal = { kind: 'seat_pieces_at_matching_edges', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['sliding_pieces', 'matching_edges'], parentObjective: parent, satisfactionContract: 'official_completion_after_matched_contacts' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence }, id = settleMatchingEdgesId + ':' + need.id;
      return {
        status: 'proposed', kind: settleMatchingEdgesId, actions, grid, predicted, blockers: board.blockers, needId: need.id,
        ...(slidePath ? { slidePath, attachmentMarks: { ...(board.freeMark === undefined ? {} : { freeMark: board.freeMark }),
          ...(board.fixedMark === undefined ? {} : { fixedMark: board.fixedMark }) } } : {}),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: actions.map((command, i) => ({ action: command, expected_after: slidePath?.[i]?.expectedMode ?? targetBox })),
        sicSituationCard: { strategy, need: 'Bring every moving piece into contact with a matching edge', mode, situation, evidence,
          agenda: nav.entries, triggerCard: nav.card, ...(directionBox ? { edge: directionBox } : {}), movesRemaining: route?.length ?? ordinary!.moves,
          slides: moved.map(({ from, piece }) => ({ from: tileBox(grid, from), to: tileBox(grid, piece),
            attaches: switched?.expectedMode.attached !== false && matchingContact(piece, grid) })),
          ...(switched ? { attachmentControl: board.panel!.box, attachmentEnabled: board.panel!.attached,
            expectedAttachmentEnabled: switched.expectedMode.attached } : {}),
          ...(board.blockers.length ? { stationaryBlockers: board.blockers.map(blocker => tileBox(grid, blocker)) } : {}) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: 'Seat the pieces at matching edges', parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, packet, observation) {
      const admitted = index === 0 ? proposal.binding?.observation_ref === observation.observation_ref
        : !!proposal.slidePath?.[index] && proposal.binding?.level_epoch === observation.level_epoch
          && expectedBoard(packet.frame_rows, proposal, index - 1);
      return { admitted, reason: admitted ? 'slide_bound_to_visible_board' : 'sliding_board_changed' };
    },
    after(proposal, index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = expectedBoard(second, proposal, index);
      return { matched, seal_prefix: !matched || index + 1 === proposal.actions.length,
        reason: matched ? 'piece_positions_and_matching_contacts_confirmed' : 'slide_projection_contradicted' };
    },
    record(before, after, command, first, second, proposal, index, frames) {
      const edge = proposal.slidePath?.[index]?.triedEdge;
      if (after.levels_completed > before.levels_completed || expectedBoard(second, proposal, index)) {
        learn(before, after, command, first, second, frames);
      } else if (memory && edge) {
        const edges = memory.refuted?.epoch === before.level_epoch ? memory.refuted.edges : [];
        memory = { ...memory, refuted: { epoch: before.level_epoch, edges: [...edges, edge] } };
      } else if (memory) {
        memory = { ...memory, blockedEpoch: before.level_epoch };
      }
      return { events: [] };
    },
    state: () => ({ memory }),
    restore(value: NativeRecord) { memory = structuredClone((value.memory ?? null) as Memory | null); },
  };
}
