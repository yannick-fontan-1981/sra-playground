import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';
import { measureAnimatedCells } from './observed-animation.ts';

export const reproduceCueId = 'sic_reproduce_cue';
export const learnAnimatedCueId = 'sic_learn_animated_cue';

type Part = ReturnType<typeof geometricComponents>[number];
type Cell = { box: NativeBox; point: NativePoint; initial: number };
type VisibleCue = { cells: number[]; examples: NativeBox[]; bands: [Part, Part]; axis: 0 | 1 };
type Scene = { panel: NativeBox; cells: Cell[]; goal: NativeBox; initialActor: NativeBox } & (
  { track: NativeBox; actorColors: number[]; visible?: never } | { visible: VisibleCue; track?: never; actorColors?: never });
type Step = { action: NativeCommand; kind: 'observe' | 'reproduce' | 'approach'; target: NativeBox; cell?: Cell; predicted?: NativeBox };
type State = { epoch: number; scene: Scene; cues: readonly number[]; refs: string[]; demonstrationRef: string | null; prepared: boolean;
  receiver: NativeBox | null; horizontal: number | null; rejected: string[] };
type Proposal = NativeProposal & { local: State; step: Step; needId: string; attempt: string };

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const inside = (a: NativeBox, b: NativeBox) => a[0] <= b[0] && a[1] <= b[1] && a[2] >= b[2] && a[3] >= b[3];
const intersects = (a: NativeBox, b: NativeBox) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const union = (a: NativeBox, b: NativeBox): NativeBox => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
const colorAt = (rows: NativeRows, [x, y]: NativePoint) => rows[y]?.[x];

function measure(rows: NativeRows, allowVisible: boolean): Scene | null {
  const parts = geometricComponents(rows), h = rows.length;
  const squaresInside = (panel: Part) => parts.filter(p => p.rectangular && width(p.bbox) === height(p.bbox)
    && width(p.bbox) >= 2 && width(p.bbox) <= 5 && inside(panel.bbox, p.bbox) && p.color !== panel.color);
  const candidates = parts.flatMap(panel => {
    if (panel.bbox[1] < h / 2 || width(panel.bbox) < 10 || height(panel.bbox) < 10) return [];
    const squares = squaresInside(panel);
    if (squares.length !== 9) return [];
    const cells = squares.map(p => ({ box: p.bbox, point: center(p.bbox), initial: p.color }))
      .sort((a, b) => a.point[1] - b.point[1] || a.point[0] - b.point[0]);
    const pitch = cells[1]!.point[0] - cells[0]!.point[0];
    if (pitch <= width(cells[0]!.box) || !cells.every((c, i) => width(c.box) === width(cells[0]!.box)
      && c.point[0] === cells[0]!.point[0] + (i % 3) * pitch && c.point[1] === cells[0]!.point[1] + Math.floor(i / 3) * pitch)) return [];
    const cross = cells[1]!.initial, spare = cells[0]!.initial;
    const checkered = cross !== spare && cells.every((c, i) => c.initial === (i % 2 === 0 ? spare : cross));
    return [{ panel: panel.bbox, panelColor: panel.color, cells, checkered }];
  });
  const checkerboards = candidates.filter(candidate => candidate.checkered);
  const input = checkerboards.length === 1 ? checkerboards[0] : allowVisible && candidates.length === 1 ? candidates[0] : null;
  if (!input) return null;
  const { panel, panelColor, cells, checkered } = input;
  const rowsOfTrack = checkered ? parts.filter(p => p.bbox[3] < panel[1] && width(p.bbox) > 3 * height(p.bbox)
    && height(p.bbox) >= 2 && height(p.bbox) <= 8 && p.area >= width(p.bbox) * height(p.bbox) * 0.7) : [];
  const scenes = rowsOfTrack.flatMap(track => {
    const [l, t, r, bottom] = track.bbox, side = height(track.bbox);
    const first = parts.filter(p => p.bbox[0] === r + 1 && p.bbox[1] === t && p.bbox[3] === bottom && width(p.bbox) <= side);
    const second = parts.filter(p => first.some(f => p.bbox[0] === f.bbox[2] + 1) && p.bbox[1] === t
      && p.bbox[3] === bottom && width(p.bbox) <= side && p.color !== first[0]?.color);
    if (first.length !== 1 || second.length !== 1) return [];
    const actorColors = [first[0]!.color, second[0]!.color];
    const target = parts.filter(p => p.bbox[2] === l - 1 && p.bbox[1] <= t && p.bbox[3] >= t + Math.floor(side / 2)
      && width(p.bbox) <= side * 2 && actorColors.includes(p.color));
    if (target.length < 2 || new Set(target.map(p => p.color)).size !== 2) return [];
    return [{ panel, cells, track: track.bbox, goal: target.map(p => p.bbox).reduce(union),
      initialActor: union(first[0]!.bbox, second[0]!.bbox), actorColors }];
  });
  if (scenes.length === 1) return scenes[0]!;
  if (scenes.length || !allowVisible) return null;
  const miniatures = parts.flatMap(preview => {
    const box = preview.bbox;
    if (preview.color !== panelColor || intersects(panel, box) || width(box) >= width(panel) || height(box) >= height(panel)
      || width(box) !== height(box)) return [];
    const examples = squaresInside(preview);
    const size = width(examples[0]?.bbox ?? box);
    if (!cueSubset(examples, cells) || width(box) < 3 * size
      || !examples.every(p => p.color === examples[0]!.color && width(p.bbox) === size)) return [];
    const pitch = width(box) / 3;
    const positions = examples.map(({ bbox }) => {
      const [x, y] = center(bbox);
      return [(x - box[0] + size / 2) / pitch, (y - box[1] + size / 2) / pitch];
    });
    if (!positions.every(point => point.every(coordinate => Math.abs(coordinate % 1 - 0.5) <= 0.25))) return [];
    const cue = positions.map(([x, y]) => Math.floor(y!) * 3 + Math.floor(x!));
    if (new Set(cue).size !== cue.length) return [];
    return [{ box, cells: cue.sort((a, b) => a - b), examples: examples.map(p => p.bbox) }];
  });
  if (miniatures.length !== 1) return null;
  const miniature = miniatures[0]!;
  const field = parts.filter(p => !intersects(p.bbox, panel) && !intersects(p.bbox, miniature.box));
  const halves = field.filter(p => p.rectangular && Math.max(width(p.bbox), height(p.bbox)) === 2 * Math.min(width(p.bbox), height(p.bbox)));
  const routes: Scene[] = [];
  for (const first of halves) {
    const axis = width(first.bbox) > height(first.bbox) ? 1 : 0;
    const cross = axis === 0 ? 1 : 0;
    for (const second of halves) {
      if (first.color === second.color || first.area !== second.area || first.bbox[axis + 2]! + 1 !== second.bbox[axis]
        || first.bbox[cross] !== second.bbox[cross] || first.bbox[cross + 2] !== second.bbox[cross + 2]) continue;
      const actor = union(first.bbox, second.bbox);
      for (const goal of field) {
        if (!goal.rectangular || goal.bbox[cross] !== actor[cross] || goal.bbox[cross + 2] !== actor[cross + 2]
          || width(goal.bbox) !== width(actor) || height(goal.bbox) !== height(actor) || intersects(goal.bbox, actor)
          || (goal.color !== first.color && goal.color !== second.color)) continue;
        const rimColor = goal.color === first.color ? second.color : first.color;
        if (!field.some(p => !p.rectangular && p.color === rimColor && inside(p.bbox, goal.bbox))) continue;
        routes.push({ panel, cells, goal: goal.bbox, initialActor: actor, visible: { ...miniature, bands: [first, second], axis } });
      }
    }
  }
  return routes.length === 1 ? routes[0]! : null;
}

const translate = (box: NativeBox, axis: 0 | 1, delta: number): NativeBox => axis === 0
  ? [box[0] + delta, box[1], box[2] + delta, box[3]] : [box[0], box[1] + delta, box[2], box[3] + delta];

function controlled(rows: NativeRows, scene: Scene): NativeBox | null {
  if (scene.visible) {
    const { axis, bands } = scene.visible;
    const from = scene.initialActor[axis], to = scene.goal[axis], direction = Math.sign(to - from);
    if (!direction) return null;
    const found: NativeBox[] = [];
    for (let position = from; direction * (to - position) >= 0; position += direction) {
      const delta = position - from;
      if (bands.every(({ bbox, color, mask }) => {
        const [left, top] = translate(bbox, axis, delta);
        return mask.every(([x, y]) => rows[top + y]?.[left + x] === color);
      })) found.push(translate(scene.initialActor, axis, delta));
    }
    return found.length === 1 ? found[0]! : null;
  }
  const [l, t, , b] = scene.track;
  const parts = geometricComponents(rows).filter(p => scene.actorColors.includes(p.color) &&
    p.bbox[0] >= l && p.bbox[2] <= scene.initialActor[2] && p.bbox[1] >= t && p.bbox[3] <= b);
  if (parts.length < 2 || new Set(parts.map(p => p.color)).size !== 2) return null;
  const box = parts.map(p => p.bbox).reduce(union);
  return width(box) <= width(scene.initialActor) && height(box) <= height(scene.initialActor) ? box : null;
}

const cueSubset = (cue: readonly unknown[], cells: readonly Cell[]) => cue.length >= 2 && cue.length < cells.length;

function choose(local: State, rows: NativeRows): Step | null {
  const { scene, cues, prepared, receiver, horizontal } = local;
  if (!prepared) {
    const cell = cues.length ? cues.map(i => scene.cells[i]!).find(c => colorAt(rows, c.point) === c.initial)
      : scene.cells.find(c => c.initial === scene.cells[1]!.initial);
    if (!cell) return null;
    const [x, y] = cell.point;
    return { action: { action_ref: 'ACTION6', data: { x, y } }, kind: cues.length ? 'reproduce' : 'observe', cell, target: cell.box };
  }
  if (!receiver) return null;
  const axis = scene.visible?.axis ?? 0;
  const direction = Math.sign(center(scene.goal)[axis] - center(receiver)[axis]);
  if (!direction) return null;
  const predicted = horizontal === null ? undefined : translate(receiver, axis, horizontal);
  const action = axis === 0 ? (direction < 0 ? 'ACTION3' : 'ACTION4') : (direction < 0 ? 'ACTION1' : 'ACTION2');
  return { action: { action_ref: action, data: {} }, kind: 'approach', target: scene.goal,
    ...(predicted ? { predicted } : {}) };
}

export function createSicReproduceCue(family = reproduceCueId): NativeFamily<Proposal> {
  const learns = family === learnAnimatedCueId;
  let state: State | null = null;
  return {
    id: family,
    async propose(observation, rows, _inputs, remaining, execution): Promise<Proposal | null> {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const supports = (a: string, b: string) => observation.available_action_refs.includes(a) && observation.available_action_refs.includes(b);
      if (!supports('ACTION3', 'ACTION4') && (learns || !supports('ACTION1', 'ACTION2'))) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const readDemonstration = learns && !prior;
      if (readDemonstration && !execution?.readAnimatedCells) return null;
      const scene = prior?.scene ?? measure(rows, !learns);
      if (!scene || (scene.visible?.axis === 1 ? !supports('ACTION1', 'ACTION2') : !supports('ACTION3', 'ACTION4'))) return null;
      const demonstration = readDemonstration ? execution?.readAnimatedCells?.(scene.cells.map(cell => cell.point)) : null;
      if (readDemonstration && (!demonstration || demonstration.afterRef !== observation.observation_ref
        || demonstration.levelEpoch !== observation.level_epoch || !cueSubset(demonstration.cells, scene.cells))) return null;
      const local = prior ?? { epoch: observation.level_epoch, scene, cues: demonstration?.cells ?? scene.visible?.cells ?? [], refs: demonstration ? [demonstration.beforeRef] : [],
        demonstrationRef: demonstration?.afterRef ?? null,
        prepared: false, receiver: null, horizontal: null, rejected: [] };
      const step = choose(local, rows);
      if (!step || !observation.available_action_refs.includes(step.action.action_ref)) return null;
      const attempt = JSON.stringify([step.action, local.receiver, local.cues.length]);
      if (local.rejected.includes(attempt)) return null;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...new Set([local.demonstrationRef, ...local.refs].filter((v): v is string => !!v && v !== ref))];
      const mode = execution?.reasoningMode ?? 'exploration';
      const offer = { input: step.action.action_ref, expected: center(step.predicted ?? step.target), evidence };
      const learned = step.kind === 'approach' && step.predicted !== undefined;
      const guided = step.kind === 'reproduce';
      const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence,
        probe: learned || guided ? null : offer, access: learned ? offer : null, interaction: guided ? offer : null });
      if (!selected) return null;
      const situation = step.kind === 'observe' ? 'Test the repeated control panel for a visible demonstration'
        : step.kind === 'reproduce' ? (scene.visible ? 'Copy a marked position from the visible sample into the input grid'
          : 'Reproduce one of the cells activated in the demonstration')
          : learned ? 'Reuse the observed translation toward the matching region'
            : 'Test movement of the prepared piece toward the matching region';
      const witness = step.cell ? await ObservedInputDomain.makeLocusWitness(observation, rows, step.cell.point, { reason: situation, evidence }) : null;
      if (step.cell && !witness) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'prepare_piece_and_reach_compatible_region', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['demonstration_panel', 'controlled_piece', 'matching_region'], parentObjective: parent, satisfactionContract: 'official_progress_at_matching_region' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = family + ':' + need.id, action = step.action;
      return {
        status: 'proposed', kind: family, local, step, needId: need.id, attempt,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action],
        steps: [{ action, expected_after: step.predicted ?? null, ...(witness ? { point_binding: witness } : {}) }],
        sicSituationCard: { strategy: selected.id, need: 'Prepare the piece and reach its matching region', situation, evidence, agenda: entries, mode,
          triggerCard: card, panel: scene.panel, target: step.target, actor: local.receiver ?? scene.initialActor, exit: scene.goal,
          ...(scene.visible ? { sampleCells: scene.visible.examples } : { observedCues: local.cues.map(i => scene.cells[i]!.box) }),
          ...(demonstration ? { demonstrationSource: demonstration.family, demonstrationAction: demonstration.action } : {}) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: selected.id, objective: { id, label: navigationPrimitives[selected.id], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, current) {
      const admitted = index === 0 && proposal.binding?.observation_ref === current.observation_ref;
      return { admitted, reason: admitted ? 'cue_action_bound' : 'cue_layout_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      if (proposal.step.kind === 'observe') return { matched: null, seal_prefix: true, reason: 'check_intermediate_frames_for_cue' };
      const reason = check(proposal, first, second);
      return { matched: !!reason, seal_prefix: true, reason: reason ?? 'cue_or_movement_not_confirmed' };
    },
    record(before, after, _action, first, second, proposal, _index, frames) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, step } = proposal;
      const animated = step.kind === 'observe' ? measureAnimatedCells(first, second, frames, local.scene.cells.map(cell => cell.point)) : [];
      const cues = step.kind === 'observe' ? (cueSubset(animated, local.scene.cells) ? animated : []) : local.cues;
      const reason = step.kind === 'observe' ? (cues.length ? 'animated_cue_observed' : null) : check(proposal, first, second);
      const receiver = reason === 'prepared_footprint_observed' || local.prepared ? controlled(second, local.scene) : null;
      const axis = local.scene.visible?.axis ?? 0;
      const horizontal = receiver && local.receiver && step.kind === 'approach' && reason ? receiver[axis] - local.receiver[axis] : local.horizontal;
      state = { ...local, cues, receiver, horizontal, prepared: local.prepared || reason === 'prepared_footprint_observed',
        demonstrationRef: step.kind === 'observe' && cues.length ? after.observation_ref : local.demonstrationRef,
        refs: reason ? [...local.refs.slice(-4), after.observation_ref] : local.refs,
        rejected: reason ? local.rejected : [...local.rejected, proposal.attempt] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

function check({ local, step }: Proposal, first: NativeRows, second: NativeRows): string | null {
  if (step.kind === 'reproduce' && step.cell) {
    const receiver = controlled(second, local.scene);
    const complete = local.cues.every(i => colorAt(second, local.scene.cells[i]!.point) !== local.scene.cells[i]!.initial);
    if (local.scene.visible) {
      if (complete) return receiver && receiver[local.scene.visible.axis] !== local.scene.initialActor[local.scene.visible.axis]
        ? 'prepared_footprint_observed' : null;
      if (!receiver || receiver[local.scene.visible.axis] !== local.scene.initialActor[local.scene.visible.axis]) return null;
    } else if (receiver && height(receiver) < height(local.scene.initialActor) && complete) return 'prepared_footprint_observed';
    return colorAt(second, step.cell.point) !== colorAt(first, step.cell.point) ? 'cued_cell_changed' : null;
  }
  if (step.kind === 'approach' && local.receiver) {
    const next = controlled(second, local.scene);
    if (!next) return null;
    const axis = local.scene.visible?.axis ?? 0;
    const goal = center(local.scene.goal)[axis];
    if (Math.abs(center(next)[axis] - goal) >= Math.abs(center(local.receiver)[axis] - goal)) return null;
    if (step.predicted && (next[0] !== step.predicted[0] || next[1] !== step.predicted[1])) return 'movement_replanned_from_return';
    return 'movement_toward_matching_region';
  }
  return null;
}
