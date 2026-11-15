import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeEntity, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';

export const observedPatternLayoutId = 'sic_match_observed_pattern_layout';
export const observedPatternLayoutStrategies = {
  select_piece_to_match_preview: 'Check which piece a click selects',
  align_piece_to_preview: 'Move one cell toward the position shown in the example',
} as const;

type Grid = { xs: number[]; ys: number[]; floor: NativePoint; boundary: NativeBox };
type Piece = { color: number; cell: NativePoint; selected: boolean };
type Preview = { color: number; box: NativeBox };
type Scene = { grid: Grid; preview: Preview[]; pieces: Piece[]; goals: Record<number, NativePoint> };
type Moves = Record<string, NativePoint>;
type Training = { epoch: number; scene: Scene; controls: Moves; refs: string[] };
type Witness = { epoch: number; score: number; controls: Moves; refs: string[] };
type Local = { epoch: number; scene: Scene; refs: string[]; contradicted: boolean };
type Proposal = NativeProposal & { scene: Scene; piece: Piece; destination: NativePoint | null; refs: string[]; needId: string };

const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const size = ([l, t, r, b]: NativeBox): NativePoint => [r - l + 1, b - t + 1];
const same = ([x, y]: NativePoint, [u, v]: NativePoint) => x === u && y === v;
const key = ([x, y]: NativePoint) => `${x},${y}`;
const direction = /^ACTION[1-4]$/;
const goalSatisfied = (scene: Scene, pieces: Piece[]) => pieces.every(piece => same(piece.cell, scene.goals[piece.color]!));
const cellBox = (grid: Grid, [c, r]: NativePoint): NativeBox =>
  [grid.xs[c]!, grid.ys[r]!, grid.xs[c + 1]! - 1, grid.ys[r + 1]! - 1];

function runStarts(values: readonly number[], offset: number): number[] {
  return [...values.flatMap((value, index) => index === 0 || value !== values[index - 1] ? [offset + index] : []), offset + values.length];
}

function gridFromBorder(entities: readonly NativeEntity[], rows: NativeRows): Grid | null {
  const borders = entities.filter(entity => {
    const [width, height] = size(entity.bbox);
    return Math.min(width, height) >= 24 && entity.area === 2 * (width + height - 2)
      && entity.mask.every(([x, y]) => x === 0 || y === 0 || x === width - 1 || y === height - 1);
  });
  if (borders.length !== 1) return null;
  const boundary = borders[0]!.bbox, [l, t, r, b] = boundary;
  const horizontal = rows[t + 1]!.slice(l + 1, r), vertical = rows.slice(t + 1, b).map(row => row[l + 1]!);
  const xs = runStarts(horizontal, l + 1), ys = runStarts(vertical, t + 1);
  const floor: NativePoint = [horizontal[0]!, horizontal[xs[1]! - l - 1]!];
  if (xs.length < 4 || ys.length < 4 || xs.length > 15 || ys.length > 15
    || new Set(horizontal).size !== 2 || new Set(vertical).size !== 2 || !floor.every(color => vertical.includes(color))) return null;
  if (![xs, ys].every(axis => axis.slice(1).every((line, index) => line - axis[index]! >= 3))) return null;
  return { boundary, xs, ys, floor };
}

function cells(grid: Grid): NativePoint[] {
  return grid.ys.slice(0, -1).flatMap((_, row) => grid.xs.slice(0, -1).map((_, column) => [column, row] as const));
}

function readPieces(rows: NativeRows, grid: Grid): Piece[] | null {
  const [left, top, right, bottom] = grid.boundary, frame = rows[top]?.[left];
  if (frame === undefined || rows[top]?.[right] !== frame || rows[bottom]?.[left] !== frame || rows[bottom]?.[right] !== frame) return null;
  const pieces: Piece[] = [];
  for (const cell of cells(grid)) {
    const [l, t, r, b] = cellBox(grid, cell), [cx, cy] = center([l, t, r, b]);
    const ink = rows[cy]?.[cx], outline = rows[t]?.[l];
    if (ink === undefined || outline === undefined) return null;
    const selected = ink !== outline;
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
      const border = x === l || x === r || y === t || y === b;
      if (rows[y]?.[x] !== (border ? outline : ink)) return null;
    }
    if (grid.floor.includes(ink)) {
      if (selected || ink !== grid.floor[(cell[0] + cell[1]) % 2]) return null;
    } else {
      if (selected && grid.floor.includes(outline)) return null;
      pieces.push({ color: ink, cell, selected });
    }
  }
  if (pieces.length < 2 || pieces.length > 8 || pieces.filter(piece => piece.selected).length > 1
    || new Set(pieces.map(piece => piece.color)).size !== pieces.length) return null;
  return pieces;
}

function mappedExamples(grid: Grid, preview: Preview[]): Record<number, NativePoint>[] {
  const first = preview[0]!, [width, height] = size(first.box);
  const units = cells(grid), byBox = new Map(units.map(cell => [cellBox(grid, cell).join(','), cell]));
  return units.flatMap(cell => {
    const origin = cellBox(grid, cell), [w, h] = size(origin), scale = w / width;
    if (!Number.isInteger(scale) || scale <= 1 || h !== height * scale) return [];
    const positions = preview.map(({ color, box: [l, t, r, b] }) => {
      const x = origin[0] + (l - first.box[0]) * scale, y = origin[1] + (t - first.box[1]) * scale;
      return [color, byBox.get([x, y, x + (r - l + 1) * scale - 1, y + (b - t + 1) * scale - 1].join(','))] as const;
    });
    return positions.every(([, cell]) => cell) ? [Object.fromEntries(positions) as Record<number, NativePoint>] : [];
  });
}

function readScene(observation: NativeObservation, rows: NativeRows): Scene | null {
  const grid = gridFromBorder(observation.entities, rows);
  const pieces = grid && readPieces(rows, grid);
  if (!grid || !pieces) return null;
  const [l, t, r, b] = grid.boundary;
  const candidates = pieces.map(piece => observation.entities.filter(entity => {
    const [x, y, u, v] = entity.bbox, [width, height] = size(entity.bbox);
    return entity.palette_value === piece.color && entity.rectangular && Math.min(width, height) >= 2
      && (u < l || x > r || v < t || y > b);
  }).map(entity => ({ color: piece.color, box: entity.bbox })));
  if (candidates.reduce((count, domain) => count * domain.length, 1) > 32) return null;
  let variants: Preview[][] = [[]];
  for (const domain of candidates) variants = variants.flatMap(variant => domain.map(sample => [...variant, sample]));
  const layouts = variants.flatMap(preview => mappedExamples(grid, preview).map(goals => ({ grid, preview, pieces, goals })));
  return layouts.length === 1 ? layouts[0]! : null;
}

function nextMove(grid: Grid, piece: Piece, goal: NativePoint, controls: Moves, occupied: Set<string>) {
  const found = new Set([key(piece.cell)]);
  const queue: { cell: NativePoint; first: string | null; step: NativePoint; length: number }[] =
    [{ cell: piece.cell, first: null, step: piece.cell, length: 0 }];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const entry = queue[cursor]!, [x, y] = entry.cell;
    if (same(entry.cell, goal)) return entry.first ? { command: entry.first, step: entry.step, length: entry.length } : null;
    for (const [command, [dx, dy]] of Object.entries(controls)) {
      const next: NativePoint = [x + dx, y + dy], id = key(next);
      if (next[0] < 0 || next[0] >= grid.xs.length - 1 || next[1] < 0 || next[1] >= grid.ys.length - 1
        || found.has(id) || occupied.has(id)) continue;
      found.add(id);
      queue.push({ cell: next, first: entry.first ?? command, step: entry.first ? entry.step : next, length: entry.length + 1 });
    }
  }
  return null;
}

function singleChange(pieces: Piece[], after: Piece[], focus: Piece) {
  const found = after.find(piece => piece.color === focus.color);
  return found && after.length === pieces.length && pieces.every(piece => piece.color === focus.color
    || after.some(next => next.color === piece.color && same(piece.cell, next.cell))) ? found : null;
}

export function createSicObservedPatternLayout(): NativeFamily<Proposal> {
  let training: Training | null = null, witness: Witness | null = null, local: Local | null = null;
  return {
    id: observedPatternLayoutId,
    observePublicOutcome(before, after, action, first, second, frames = []) {
      if (!direction.test(action.action_ref) || !before.available_action_refs.includes('ACTION6') || before.frame_hash === after.frame_hash) return;
      const prior = training?.epoch === before.level_epoch ? training : null;
      const scene = prior?.scene ?? readScene(before, first);
      if (!scene) return;
      const pieces = readPieces(first, scene.grid), selected = pieces?.find(piece => piece.selected);
      if (!pieces || !selected) return;
      if (after.levels_completed > before.levels_completed) {
        if (prior && Object.keys(prior.controls).length === 4 && frames.some(frame => {
          const current = readPieces(frame, scene.grid);
          return current && current.length === pieces.length && current.every(piece => scene.goals[piece.color])
            && !!singleChange(pieces, current, selected) && goalSatisfied(scene, current);
        })) {
          witness = { epoch: after.level_epoch, score: after.levels_completed, controls: prior.controls, refs: [...prior.refs, after.observation_ref] };
        }
        return;
      }
      if (after.level_epoch !== before.level_epoch) return;
      const observed = readPieces(second, scene.grid), next = observed && singleChange(pieces, observed, selected);
      if (!next?.selected) return;
      const delta: NativePoint = [next.cell[0] - selected.cell[0], next.cell[1] - selected.cell[1]];
      if (Math.abs(delta[0]) + Math.abs(delta[1]) !== 1) return;
      const controls = { ...prior?.controls }, learned = controls[action.action_ref];
      if (learned && !same(learned, delta)) {
        training = null;
        return;
      }
      controls[action.action_ref] = delta;
      training = { epoch: before.level_epoch, scene, controls, refs: [...new Set([...(prior?.refs ?? []).slice(-3), before.observation_ref, after.observation_ref])] };
    },
    async propose(observation, rows, _inputs, remaining) {
      if (witness?.epoch !== observation.level_epoch || witness.score !== observation.levels_completed || remaining < 1
        || !observation.available_action_refs.includes('ACTION6')) return null;
      const prior = local?.epoch === observation.level_epoch ? local : null;
      if (prior?.contradicted) return null;
      const retained = prior?.scene ?? readScene(observation, rows);
      if (!retained) return null;
      const pieces = readPieces(rows, retained.grid);
      if (!pieces || pieces.length !== retained.pieces.length || pieces.some(piece => !retained.goals[piece.color])) return null;
      const scene = { ...retained, pieces }, occupied = new Set(pieces.map(piece => key(piece.cell)));
      const controls = Object.fromEntries(Object.entries(witness.controls).filter(([input]) => observation.available_action_refs.includes(input)));
      const routes = pieces.flatMap(piece => {
        const move = nextMove(scene.grid, piece, scene.goals[piece.color]!, controls, occupied);
        return move ? [{ piece, move }] : [];
      }).sort((a, b) => Number(b.piece.selected) - Number(a.piece.selected) || a.move.length - b.move.length);
      const next = routes[0];
      if (!next) return null;
      const { piece, move } = next, focus = cellBox(scene.grid, piece.cell), [x, y] = center(focus);
      const strategy = piece.selected ? 'align_piece_to_preview' : 'select_piece_to_match_preview';
      const label = observedPatternLayoutStrategies[strategy], ref = observation.observation_ref, parent = 'G_official_completion';
      const evidence: [string, ...string[]] = [ref, ...new Set([...witness.refs, ...(prior?.refs ?? [])].filter(value => value !== ref))];
      const binding = piece.selected ? null : await ObservedInputDomain.makeLocusWitness(observation, rows, [x, y], { reason: label, evidence });
      if (!piece.selected && !binding) return null;
      const action: NativeCommand = piece.selected ? { action_ref: move.command, data: {} } : { action_ref: 'ACTION6', data: { x, y } };
      const actions = [action], destination = piece.selected ? move.step : null;
      const goal = { kind: 'match_scaled_preview_positions', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['piece', 'scaled_preview', 'destination'], parentObjective: parent,
        satisfactionContract: 'match_the_observed_example_and_verify_official_progress' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `preview-layout:${need.id}`;
      return { status: 'proposed', kind: observedPatternLayoutId, actions, scene, piece, destination, refs: evidence, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: [{ action, ...(binding ? { point_binding: binding } : {}), expected_after: destination }],
        sicSituationCard: { strategy, need: 'Match the arrangement shown in the example', situation: label,
          mode: piece.selected ? 'solving' : 'assimilation', evidence, agenda: [], focus,
          destination: cellBox(scene.grid, scene.goals[piece.color]!), example: scene.preview.find(sample => sample.color === piece.color)!.box },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'preview_and_piece_bound' : 'preview_or_piece_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = before.level_epoch === after.level_epoch && !!confirmed(proposal, second);
      return { matched, seal_prefix: true, reason: matched ? 'observed_selection_or_step' : 'preview_placement_prediction_contradicted' };
    },
    record(before, after, _action, _first, second, proposal, _index, frames) {
      if (after.levels_completed > before.levels_completed) {
        if (witness && frames.some(frame => {
          const observed = readPieces(frame, proposal.scene.grid);
          return observed && observed.length === proposal.scene.pieces.length && observed.every(piece => proposal.scene.goals[piece.color])
            && goalSatisfied(proposal.scene, observed);
        })) {
          witness = { ...witness, epoch: after.level_epoch, score: after.levels_completed,
            refs: [...proposal.refs.slice(-3), after.observation_ref] };
        }
        return { events: [] };
      }
      const pieces = before.level_epoch === after.level_epoch ? confirmed(proposal, second) : null;
      local = { epoch: before.level_epoch, scene: pieces ? { ...proposal.scene, pieces } : proposal.scene, contradicted: !pieces,
        refs: [...proposal.refs.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ training, witness, local }),
    restore(value: NativeRecord) {
      training = structuredClone((value.training as Training | undefined) ?? null);
      witness = structuredClone((value.witness as Witness | undefined) ?? null);
      local = structuredClone((value.local as Local | undefined) ?? null);
    },
  };
}

function confirmed(proposal: Proposal, rows: NativeRows): Piece[] | null {
  const { scene, piece, destination } = proposal;
  const observed = readPieces(rows, scene.grid), moved = observed && singleChange(scene.pieces, observed, piece);
  return moved?.selected && same(moved.cell, destination ?? piece.cell) ? observed : null;
}
