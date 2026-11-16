import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import { measuredMetricScene } from '../logos-engine/v6-metric-composition.ts';
import type { NativeBox, NativeCommand, NativeEntity, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { chooseStackStep, readStackExample, type PatternExample, type PatternGrid as Grid, type PatternPiece as Piece,
  type PatternPiles, type PatternStep } from './pattern-stacks.ts';

export const observedPatternLayoutId = 'sic_match_observed_pattern_layout';
export const observedPatternLayoutStrategies = {
  select_piece_to_match_preview: 'Check which piece a click selects',
  align_piece_to_preview: 'Move one cell toward the position shown in the example',
  park_piece_absent_from_preview: 'Bring the extra piece to a cell where it can be covered',
  park_surplus_piece: 'Move the surplus piece to a cell where it can be covered',
  cover_piece_to_match_preview: 'Test which piece remains visible when they share a cell',
  reveal_piece_under_stack: 'Move the top piece to check what it hides',
  clear_preview_destination: 'Temporarily clear a cell needed by the example',
} as const;

type Scan = { edges: number[]; colors: NativePoint; line: number };
type Preview = { color: number; box: NativeBox };
type Scene = { grid: Grid; preview: Preview[]; pieces: Piece[]; goals: Record<number, NativePoint> };
type Moves = Record<string, NativePoint>;
type Training = { epoch: number; scene: Scene; controls: Moves; refs: string[] };
type Witness = { epoch: number; score: number; controls: Moves; refs: string[] };
type MetricControlProof = { floor: string; score: number; moves: Record<string, { delta: NativePoint; refs: string[] }> };
type Local = { epoch: number; scene: Scene; refs: string[]; contradicted: boolean };
type OrdinaryProposal = NativeProposal & { scene: Scene; piece: Piece; destination: NativePoint | null; covered?: Piece; refs: string[]; needId: string };
type StackedLayout = { epoch: number; grid: Grid; goals: PatternExample[]; piles: PatternPiles; refs: string[]; stopped: boolean };
type StackProposal = NativeProposal & { stack: StackedLayout; pieces: Piece[]; choice: PatternStep;
  destination: NativePoint | null; refs: string[]; needId: string };
type Proposal = OrdinaryProposal | StackProposal;
const isStack = (proposal: Proposal): proposal is StackProposal => 'stack' in proposal;

const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const size = ([l, t, r, b]: NativeBox): NativePoint => [r - l + 1, b - t + 1];
const same = ([x, y]: NativePoint, [u, v]: NativePoint) => x === u && y === v;
const key = ([x, y]: NativePoint) => `${x},${y}`;
const direction = /^ACTION[1-4]$/;
const goalSatisfied = (scene: Scene, pieces: Piece[]) => pieces.length === scene.preview.length
  && pieces.every(piece => !!scene.goals[piece.color] && same(piece.cell, scene.goals[piece.color]!));
const cellBox = (grid: Grid, [c, r]: NativePoint): NativeBox =>
  [grid.xs[c]!, grid.ys[r]!, grid.xs[c + 1]! - 1, grid.ys[r + 1]! - 1];

function runStarts(values: readonly number[], offset: number): number[] {
  return [...values.flatMap((value, index) => index === 0 || value !== values[index - 1] ? [offset + index] : []), offset + values.length];
}

function checkerScan(values: readonly number[], offset: number, line: number): Scan | null {
  if (new Set(values).size !== 2) return null;
  const edges = runStarts(values, offset);
  if (edges.length < 4 || edges.length > 15 || edges.slice(1).some((edge, i) => edge - edges[i]! < 3)) return null;
  return { edges, colors: [values[0]!, values[edges[1]! - offset]!], line };
}

function crossingGrid(horizontal: Scan, vertical: Scan, boundary: NativeBox): Grid | null {
  const xs = horizontal.edges, ys = vertical.edges;
  const row = ys.slice(1).findIndex(edge => edge > horizontal.line);
  const column = xs.slice(1).findIndex(edge => edge > vertical.line);
  if (row < 0 || column < 0) return null;
  const floor: NativePoint = row % 2 === 0 ? horizontal.colors : [horizontal.colors[1], horizontal.colors[0]];
  if (vertical.colors[0] !== floor[column % 2] || vertical.colors[1] !== floor[1 - column % 2]) return null;
  return { boundary, xs, ys, floor };
}

function gridFromBorder(entities: readonly NativeEntity[], rows: NativeRows, repeatedColors = false): Grid | null {
  const read = repeatedColors ? readTopPieces : readPieces;
  const borders = entities.filter(entity => {
    const [width, height] = size(entity.bbox);
    return Math.min(width, height) >= 24 && entity.area === 2 * (width + height - 2)
      && entity.mask.every(([x, y]) => x === 0 || y === 0 || x === width - 1 || y === height - 1);
  });
  if (borders.length !== 1) return null;
  const boundary = borders[0]!.bbox, [l, t, r, b] = boundary;
  const inside = rows.slice(t + 1, b);
  const rowAt = (y: number) => checkerScan(rows[y]!.slice(l + 1, r), l + 1, y);
  const columnAt = (x: number) => checkerScan(inside.map(row => row[x]!), t + 1, x);
  const top = rowAt(t + 1), left = columnAt(l + 1);
  const direct = top && left && crossingGrid(top, left, boundary);
  if (direct && read(rows, direct)) return direct;

  const horizontal = inside.map((_, i) => rowAt(t + 1 + i)).filter((scan): scan is Scan => scan !== null);
  const vertical = rows[0]!.slice(l + 1, r).map((_, i) => columnAt(l + 1 + i)).filter((scan): scan is Scan => scan !== null);
  const distinct = new Map<string, Grid>();
  for (const h of horizontal) for (const v of vertical) {
    const grid = crossingGrid(h, v, boundary);
    if (grid) distinct.set(JSON.stringify([grid.xs, grid.ys, grid.floor]), grid);
  }
  const consistent = [...distinct.values()].filter(grid => read(rows, grid) !== null);
  return consistent.length === 1 ? consistent[0]! : null;
}

function cells(grid: Grid): NativePoint[] {
  return grid.ys.slice(0, -1).flatMap((_, row) => grid.xs.slice(0, -1).map((_, column) => [column, row] as const));
}

function readTopPieces(rows: NativeRows, grid: Grid): Piece[] | null {
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
  if (!pieces.length || pieces.length > 16 || pieces.filter(piece => piece.selected).length > 1) return null;
  return pieces;
}

function readPieces(rows: NativeRows, grid: Grid): Piece[] | null {
  const pieces = readTopPieces(rows, grid);
  return pieces && pieces.length >= 2 && pieces.length <= 8 && new Set(pieces.map(piece => piece.color)).size === pieces.length ? pieces : null;
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
  }).map(entity => ({ color: piece.color, box: entity.bbox }))).filter(domain => domain.length > 0);
  if (candidates.length < 2) return null;
  if (candidates.reduce((count, domain) => count * domain.length, 1) > 32) return null;
  let variants: Preview[][] = [[]];
  for (const domain of candidates) variants = variants.flatMap(variant => domain.map(sample => [...variant, sample]));
  const layouts = variants.flatMap(preview => mappedExamples(grid, preview).map(goals => ({ grid, preview, pieces, goals })));
  return layouts.length === 1 ? layouts[0]! : null;
}

function nextMove(grid: Grid, piece: Piece, goal: NativePoint, controls: Moves, occupied: Set<string>, cover = false) {
  const found = new Set([key(piece.cell)]);
  const queue: { cell: NativePoint; first: string | null; step: NativePoint; length: number }[] =
    [{ cell: piece.cell, first: null, step: piece.cell, length: 0 }];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const entry = queue[cursor]!, [x, y] = entry.cell;
    if (same(entry.cell, goal)) return entry.first ? { command: entry.first, step: entry.step, length: entry.length } : null;
    for (const [command, [dx, dy]] of Object.entries(controls)) {
      const next: NativePoint = [x + dx, y + dy], id = key(next);
      if (next[0] < 0 || next[0] >= grid.xs.length - 1 || next[1] < 0 || next[1] >= grid.ys.length - 1
        || found.has(id) || (occupied.has(id) && !(cover && same(next, goal)))) continue;
      found.add(id);
      queue.push({ cell: next, first: entry.first ?? command, step: entry.first ? entry.step : next, length: entry.length + 1 });
    }
  }
  return null;
}

function previewRoutes(scene: Scene, controls: Moves) {
  const occupancy = new Map(scene.pieces.map(piece => [key(piece.cell), piece]));
  const occupied = new Set(occupancy.keys()), goals = Object.values(scene.goals);
  const parking = goals.filter(goal => {
    const holding = occupancy.get(key(goal));
    return !holding || !scene.goals[holding.color];
  });
  const routes = scene.pieces.flatMap(piece => {
    const expected = scene.goals[piece.color];
    const destinations = expected ? [expected] : goals.some(goal => same(goal, piece.cell)) ? [] : parking;
    return destinations.flatMap(goal => {
      const occupant = occupancy.get(key(goal)), cover = !!occupant && !scene.goals[occupant.color];
      const move = nextMove(scene.grid, piece, goal, controls, occupied, cover);
      if (!move) return [];
      const covered = move && cover && same(move.step, goal) ? occupant : undefined;
      return [{ piece, move, goal, covered }];
    });
  });
  const spareRoutes = routes.filter(({ piece }) => !scene.goals[piece.color]);
  return (spareRoutes.length ? spareRoutes : routes)
    .sort((a, b) => Number(b.piece.selected) - Number(a.piece.selected) || a.move.length - b.move.length);
}

function singleChange(pieces: Piece[], after: Piece[], focus: Piece) {
  const found = after.find(piece => piece.color === focus.color);
  return found && after.length === pieces.length && pieces.every(piece => piece.color === focus.color
    || after.some(next => next.color === piece.color && same(piece.cell, next.cell))) ? found : null;
}

function confirmedStack(proposal: StackProposal, rows: NativeRows): Piece[] | null {
  const { stack, pieces, choice: { piece }, destination } = proposal;
  const current = readTopPieces(rows, stack.grid), expected = destination ?? piece.cell;
  const moved = current?.find(item => item.selected && same(item.cell, expected) && item.color === piece.color);
  if (!current || !moved) return null;
  if (destination) {
    const source = stack.piles[key(piece.cell)];
    const exposed = current.find(item => same(item.cell, piece.cell));
    if (!source || (source.colors.length > 1 ? source.colors[1] !== exposed?.color : !source.unknownBelow && exposed)) return null;
  }
  const unrelated = (item: Piece) => !same(item.cell, piece.cell) && !same(item.cell, expected);
  const before = pieces.filter(unrelated), after = current.filter(unrelated);
  return before.length === after.length && before.every(item => after.some(other => item.color === other.color && same(item.cell, other.cell)))
    ? current : null;
}

function updatePiles(proposal: StackProposal, observed: Piece[]) {
  const { stack: { piles }, choice: { piece }, destination } = proposal;
  if (!destination) return { piles, exposed: null };
  const source = key(piece.cell), target = key(destination), below = piles[source]!, replaced = piles[target];
  const exposed = observed.find(item => same(item.cell, piece.cell)) ?? null;
  const next = { ...piles, [target]: { colors: [piece.color, ...(replaced?.colors ?? [])], unknownBelow: replaced?.unknownBelow ?? false } };
  if (exposed) next[source] = { colors: below.colors.length > 1 ? below.colors.slice(1) : [exposed.color], unknownBelow: below.unknownBelow };
  else delete next[source];
  return { piles: next, exposed };
}

export function createSicObservedPatternLayout(): NativeFamily<Proposal> {
  let training: Training | null = null, witness: Witness | null = null, local: Local | null = null;
  let stacked: StackedLayout | null = null;
  let metricControls: MetricControlProof | null = null;

  function observeMetricControls(before: NativeObservation, after: NativeObservation, action: NativeCommand,
    first: NativeRows, second: NativeRows) {
    if (!before.available_action_refs.includes('ACTION5')) return;
    const measured = measuredMetricScene(first);
    if (!measured || measured.selected === null) return;
    const floor = [...measured.background].sort().join(',');
    const prior = metricControls?.floor === floor ? metricControls : null;
    if (after.levels_completed > before.levels_completed) {
      if (prior) metricControls = { ...prior, score: after.levels_completed };
      return;
    }
    if (before.level_epoch !== after.level_epoch) return;
    const next = measuredMetricScene(second);
    if (!next || next.selected === null || next.grid_ref !== measured.grid_ref
      || [...next.background].sort().join(',') !== floor) return;
    const from: number = measured.selected, to: number = next.selected;
    const ink: string = measured.fills[from];
    if (next.fills[to] !== ink || next.fills[from] === ink
      || !measured.fills.every((fill: string, index: number) => index === from || index === to || next.fills[index] === fill)) return;
    const width: number = measured.xs.length - 1;
    const delta: NativePoint = [to % width - from % width, Math.floor(to / width) - Math.floor(from / width)];
    if (Math.abs(delta[0]) + Math.abs(delta[1]) !== 1) return;
    const old = prior?.moves[action.action_ref];
    const moves = old && !same(old.delta, delta) ? {} : prior?.moves ?? {};
    metricControls = { floor, score: before.levels_completed, moves: { ...moves,
      [action.action_ref]: { delta, refs: [before.observation_ref, after.observation_ref] } } };
  }

  async function offerStack(observation: NativeObservation, rows: NativeRows, retained: Witness,
    learnedFloor?: string): Promise<StackProposal | null> {
    const prior = stacked?.epoch === observation.level_epoch ? stacked : null;
    if (prior?.stopped) return null;
    const grid = prior?.grid ?? gridFromBorder(observation.entities, rows, true), pieces = grid && readTopPieces(rows, grid);
    if (!grid || !pieces) return null;
    const goals = prior?.goals ?? readStackExample(grid, rows, observation.entities, pieces);
    if (!goals) return null;
    if (learnedFloor && ([...grid.floor].sort().join(',') !== learnedFloor
      || !goals.some(goal => goals.filter(item => item.color === goal.color).length
        > pieces.filter(piece => piece.color === goal.color).length))) return null;
    const stack = prior ?? { epoch: observation.level_epoch, grid, goals, refs: [], stopped: false,
      piles: Object.fromEntries(pieces.map(piece => [key(piece.cell), { colors: [piece.color], unknownBelow: true }])) };
    if (Object.keys(stack.piles).length !== pieces.length || pieces.some(piece => stack.piles[key(piece.cell)]?.colors[0] !== piece.color)) return null;
    const controls = Object.fromEntries(Object.entries(retained.controls).filter(([input]) => observation.available_action_refs.includes(input)));
    const choice = chooseStackStep(grid, pieces, goals, stack.piles, (piece, goal, occupied, cover) => nextMove(grid, piece, goal, controls, occupied, cover));
    if (!choice) return null;
    const { piece, intent, covered, move } = choice, focus = cellBox(grid, piece.cell), [x, y] = center(focus);
    const strategy = !piece.selected ? 'select_piece_to_match_preview' : intent === 'uncover' ? 'reveal_piece_under_stack'
      : intent === 'clear' ? 'clear_preview_destination' : covered ? 'cover_piece_to_match_preview'
      : intent === 'park' ? 'park_surplus_piece' : 'align_piece_to_preview';
    const label = observedPatternLayoutStrategies[strategy], ref = observation.observation_ref, parent = 'G_official_completion';
    const evidence: [string, ...string[]] = [ref, ...new Set([...retained.refs, ...stack.refs].filter(value => value !== ref))];
    const point = piece.selected ? null : await ObservedInputDomain.makeLocusWitness(observation, rows, [x, y], { reason: label, evidence });
    if (!piece.selected && !point) return null;
    const action: NativeCommand = piece.selected ? { action_ref: move.command, data: {} } : { action_ref: 'ACTION6', data: { x, y } };
    const actions = [action], destination = piece.selected ? move.step : null;
    const goal = { kind: 'match_scaled_preview_positions', scope: ref.split(':revision:', 1)[0]!, subjects: ['piece', 'scaled_preview', 'destination'],
      parentObjective: parent, satisfactionContract: 'match_the_observed_example_and_verify_official_progress' };
    const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence }, id = `preview-layout:${need.id}`;
    return { status: 'proposed', kind: observedPatternLayoutId, actions, stack, pieces, choice, destination, refs: evidence, needId: need.id,
      binding: { observation_ref: ref, level_epoch: observation.level_epoch },
      steps: [{ action, ...(point ? { point_binding: point } : {}), expected_after: destination }],
      sicSituationCard: { strategy, need: 'Match the visible pieces to the example', situation: label,
        mode: intent === 'uncover' ? 'exploration' : piece.selected ? 'solving' : 'assimilation', evidence, agenda: [], focus,
        destination: cellBox(grid, choice.goal), example: goals.find(sample => same(sample.cell, choice.goal))?.box ?? null,
        covered: piece.selected && covered ? cellBox(grid, covered.cell) : null },
      question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
      compositions: [{ id, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
      sicLocalDecision: { strategy, objective: { id, label, parent }, need },
      bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
        preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
  }

  return {
    id: observedPatternLayoutId,
    observePublicOutcome(before, after, action, first, second, frames = []) {
      if (!direction.test(action.action_ref) || !before.available_action_refs.includes('ACTION6') || before.frame_hash === after.frame_hash) return;
      if (!witness || witness.epoch < before.level_epoch) observeMetricControls(before, after, action, first, second);
      const prior = training?.epoch === before.level_epoch ? training : null;
      const scene = prior?.scene ?? readScene(before, first);
      if (!scene) return;
      const pieces = readPieces(first, scene.grid), selected = pieces?.find(piece => piece.selected);
      if (!pieces || !selected) return;
      if (after.levels_completed > before.levels_completed) {
        if (prior && Object.keys(prior.controls).length === 4 && frames.some(frame => {
          const current = readPieces(frame, scene.grid);
          return current && current.length === pieces.length
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
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      if (witness?.epoch !== observation.level_epoch || witness.score !== observation.levels_completed) {
        if (!metricControls || !observation.levels_completed || metricControls.score !== observation.levels_completed
          || !observation.available_action_refs.includes('ACTION5')) return null;
        const moves = Object.entries(metricControls.moves);
        if (moves.length !== 4 || new Set(moves.map(([, move]) => key(move.delta))).size !== 4) return null;
        const retained = { epoch: observation.level_epoch, score: observation.levels_completed,
          controls: Object.fromEntries(moves.map(([input, move]) => [input, move.delta])),
          refs: [...new Set(moves.flatMap(([, move]) => move.refs))] };
        const proposal = await offerStack(observation, rows, retained, metricControls.floor);
        if (proposal) witness = retained;
        return proposal;
      }
      if (stacked?.epoch === observation.level_epoch) return offerStack(observation, rows, witness);
      const prior = local?.epoch === observation.level_epoch ? local : null;
      if (prior?.contradicted) return null;
      const retained = prior?.scene ?? readScene(observation, rows);
      if (!retained) return offerStack(observation, rows, witness);
      const pieces = readPieces(rows, retained.grid);
      if (!pieces || pieces.length !== retained.pieces.length || pieces.some(piece => !retained.pieces.some(known => piece.color === known.color))) return null;
      const scene = { ...retained, pieces };
      const controls = Object.fromEntries(Object.entries(witness.controls).filter(([input]) => observation.available_action_refs.includes(input)));
      const next = previewRoutes(scene, controls)[0];
      if (!next) return null;
      const { piece, move, goal: target, covered } = next, focus = cellBox(scene.grid, piece.cell), [x, y] = center(focus);
      const strategy = !piece.selected ? 'select_piece_to_match_preview' : covered ? 'cover_piece_to_match_preview'
        : scene.goals[piece.color] ? 'align_piece_to_preview' : 'park_piece_absent_from_preview';
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
        ...(piece.selected && covered ? { covered } : {}),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: [{ action, ...(binding ? { point_binding: binding } : {}), expected_after: destination }],
        sicSituationCard: { strategy, need: 'Match the arrangement shown in the example', situation: label,
          mode: piece.selected ? covered ? 'exploration' : 'solving' : 'assimilation', evidence, agenda: [], focus,
          destination: cellBox(scene.grid, target), example: scene.preview.find(sample => sample.color === piece.color)?.box ?? null,
          covered: piece.selected && covered ? cellBox(scene.grid, covered.cell) : null },
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
      const matched = before.level_epoch === after.level_epoch && !!(isStack(proposal) ? confirmedStack(proposal, second) : confirmed(proposal, second));
      return { matched, seal_prefix: true, reason: matched ? 'observed_selection_or_step' : 'preview_placement_prediction_contradicted' };
    },
    record(before, after, _action, _first, second, proposal, _index, frames) {
      if (isStack(proposal)) {
        if (after.levels_completed > before.levels_completed) {
          if (witness && frames.some(frame => {
            const pieces = readTopPieces(frame, proposal.stack.grid);
            return pieces?.length === proposal.stack.goals.length && proposal.stack.goals.every(goal =>
              pieces.some(piece => piece.color === goal.color && same(piece.cell, goal.cell)));
          })) witness = { ...witness, epoch: after.level_epoch, score: after.levels_completed, refs: [...proposal.refs.slice(-3), after.observation_ref] };
          return { events: [] };
        }
        const pieces = before.level_epoch === after.level_epoch ? confirmedStack(proposal, second) : null;
        const result = pieces && updatePiles(proposal, pieces);
        stacked = { ...proposal.stack, piles: result?.piles ?? proposal.stack.piles, stopped: !result,
          refs: [...proposal.refs.slice(-4), after.observation_ref] };
        return { events: [], ...(result?.exposed ? { reviewEvidence: 'Moving the top piece revealed another piece on its previous cell.' } : {}) };
      }
      if (after.levels_completed > before.levels_completed) {
        if (witness && frames.some(frame => {
          const observed = readPieces(frame, proposal.scene.grid);
          return observed && goalSatisfied(proposal.scene, observed);
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
    state: () => ({ training, witness, local, ...(stacked ? { stacked } : {}), ...(metricControls ? { metricControls } : {}) }),
    restore(value: NativeRecord) {
      training = structuredClone((value.training as Training | undefined) ?? null);
      witness = structuredClone((value.witness as Witness | undefined) ?? null);
      local = structuredClone((value.local as Local | undefined) ?? null);
      stacked = structuredClone((value.stacked as StackedLayout | undefined) ?? null);
      metricControls = structuredClone((value.metricControls as MetricControlProof | undefined) ?? null);
    },
  };
}

function confirmed(proposal: OrdinaryProposal, rows: NativeRows): Piece[] | null {
  const { scene, piece, destination, covered } = proposal;
  const expected = covered ? scene.pieces.filter(other => other.color !== covered.color) : scene.pieces;
  const observed = readPieces(rows, scene.grid), moved = observed && singleChange(expected, observed, piece);
  return moved?.selected && same(moved.cell, destination ?? piece.cell) ? observed : null;
}
