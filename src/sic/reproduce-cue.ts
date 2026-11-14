import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const reproduceCueId = 'sic_reproduce_cue';

type Part = ReturnType<typeof geometricComponents>[number];
type Cell = { box: NativeBox; point: NativePoint; initial: number };
type Scene = { panel: NativeBox; cells: Cell[]; track: NativeBox; goal: NativeBox; initialActor: NativeBox; actorColors: number[] };
type Step = { action: NativeCommand; kind: 'observe' | 'reproduce' | 'approach'; target: NativeBox; cell?: Cell; predicted?: NativeBox };
type State = { epoch: number; scene: Scene; cues: number[]; refs: string[]; demonstrationRef: string | null; prepared: boolean;
  receiver: NativeBox | null; horizontal: number | null; rejected: string[] };
type Proposal = NativeProposal & { local: State; step: Step; needId: string; attempt: string };

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const inside = (a: NativeBox, b: NativeBox) => a[0] <= b[0] && a[1] <= b[1] && a[2] >= b[2] && a[3] >= b[3];
const union = (a: NativeBox, b: NativeBox): NativeBox => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
const colorAt = (rows: NativeRows, [x, y]: NativePoint) => rows[y]?.[x];

function measure(rows: NativeRows): Scene | null {
  const parts = geometricComponents(rows), h = rows.length;
  const candidates = parts.flatMap(panel => {
    if (panel.bbox[1] < h / 2 || width(panel.bbox) < 10 || height(panel.bbox) < 10) return [];
    const squares = parts.filter(p => p.rectangular && width(p.bbox) === height(p.bbox) && width(p.bbox) >= 2
      && width(p.bbox) <= 5 && inside(panel.bbox, p.bbox) && p.color !== panel.color);
    if (squares.length !== 9) return [];
    const cells = squares.map(p => ({ box: p.bbox, point: center(p.bbox), initial: p.color }))
      .sort((a, b) => a.point[1] - b.point[1] || a.point[0] - b.point[0]);
    const pitch = cells[1]!.point[0] - cells[0]!.point[0];
    if (pitch <= width(cells[0]!.box) || !cells.every((c, i) => width(c.box) === width(cells[0]!.box)
      && c.point[0] === cells[0]!.point[0] + (i % 3) * pitch && c.point[1] === cells[0]!.point[1] + Math.floor(i / 3) * pitch)) return [];
    const cross = cells[1]!.initial, spare = cells[0]!.initial;
    if (cross === spare || !cells.every((c, i) => c.initial === (i % 2 === 0 ? spare : cross))) return [];
    return [{ panel: panel.bbox, cells }];
  });
  if (candidates.length !== 1) return null;
  const { panel, cells } = candidates[0]!;
  const rowsOfTrack = parts.filter(p => p.bbox[3] < panel[1] && width(p.bbox) > 3 * height(p.bbox)
    && height(p.bbox) >= 2 && height(p.bbox) <= 8 && p.area >= width(p.bbox) * height(p.bbox) * 0.7);
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
  return scenes.length === 1 ? scenes[0]! : null;
}

function controlled(rows: NativeRows, scene: Scene): NativeBox | null {
  const [l, t, , b] = scene.track;
  const parts = geometricComponents(rows).filter(p => scene.actorColors.includes(p.color) &&
    p.bbox[0] >= l && p.bbox[2] <= scene.initialActor[2] && p.bbox[1] >= t && p.bbox[3] <= b);
  if (parts.length < 2 || new Set(parts.map(p => p.color)).size !== 2) return null;
  const box = parts.map(p => p.bbox).reduce(union);
  return width(box) <= width(scene.initialActor) && height(box) <= height(scene.initialActor) ? box : null;
}

function observedCue(scene: Scene, first: NativeRows, second: NativeRows, frames: readonly NativeRows[]): number[] {
  const active = frames.map(frame => scene.cells.flatMap((cell, i) =>
    colorAt(frame, cell.point) !== colorAt(first, cell.point) ? [i] : []));
  const strongest = active.reduce((best, indices) => indices.length > best.length ? indices : best, [] as number[]);
  return strongest.length >= 2 && strongest.length < scene.cells.length
    && active.every(indices => indices.every(i => strongest.includes(i)))
    && scene.cells.every(cell => colorAt(second, cell.point) === colorAt(first, cell.point)) ? strongest : [];
}

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
  const direction = Math.sign(center(scene.goal)[0] - center(receiver)[0]);
  if (!direction) return null;
  const predicted: NativeBox | undefined = horizontal === null ? undefined
    : [receiver[0] + horizontal, receiver[1], receiver[2] + horizontal, receiver[3]];
  return { action: { action_ref: direction < 0 ? 'ACTION3' : 'ACTION4', data: {} }, kind: 'approach', target: scene.goal,
    ...(predicted ? { predicted } : {}) };
}

export function createSicReproduceCue(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: reproduceCueId,
    async propose(observation, rows, _inputs, remaining, execution): Promise<Proposal | null> {
      if (remaining < 1 || !['ACTION3', 'ACTION4', 'ACTION6'].every(id => observation.available_action_refs.includes(id))) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const scene = prior?.scene ?? measure(rows);
      if (!scene) return null;
      const local = prior ?? { epoch: observation.level_epoch, scene, cues: [], refs: [], demonstrationRef: null,
        prepared: false, receiver: null, horizontal: null, rejected: [] };
      const step = choose(local, rows);
      if (!step) return null;
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
        : step.kind === 'reproduce' ? 'Reproduce one of the cells activated in the demonstration'
          : learned ? 'Reuse the observed translation toward the matching end of the track'
            : 'Test movement of the prepared piece toward the matching end of the track';
      const witness = step.cell ? await ObservedInputDomain.makeLocusWitness(observation, rows, step.cell.point, { reason: situation, evidence }) : null;
      if (step.cell && !witness) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'prepare_piece_and_reach_compatible_region', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['demonstration_panel', 'controlled_piece', 'matching_region'], parentObjective: parent, satisfactionContract: 'official_progress_at_matching_region' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = reproduceCueId + ':' + need.id, action = step.action;
      return {
        status: 'proposed', kind: reproduceCueId, local, step, needId: need.id, attempt,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action],
        steps: [{ action, expected_after: step.predicted ?? null, ...(witness ? { point_binding: witness } : {}) }],
        sicSituationCard: { strategy: selected.id, need: 'Prepare the piece to fit the track and reach its matching region', situation, evidence, agenda: entries, mode,
          triggerCard: card, panel: scene.panel, target: step.target, actor: local.receiver ?? scene.initialActor, exit: scene.goal,
          observedCues: local.cues.map(i => scene.cells[i]!.box) },
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
      const cues = step.kind === 'observe' ? observedCue(local.scene, first, second, frames) : local.cues;
      const reason = step.kind === 'observe' ? (cues.length ? 'animated_cue_observed' : null) : check(proposal, first, second);
      const receiver = reason === 'prepared_footprint_observed' || local.prepared ? controlled(second, local.scene) : null;
      const horizontal = receiver && local.receiver && step.kind === 'approach' && reason ? receiver[0] - local.receiver[0] : local.horizontal;
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
    if (receiver && height(receiver) < height(local.scene.initialActor)
      && local.cues.every(i => colorAt(second, local.scene.cells[i]!.point) !== local.scene.cells[i]!.initial)) return 'prepared_footprint_observed';
    return colorAt(second, step.cell.point) !== colorAt(first, step.cell.point) ? 'cued_cell_changed' : null;
  }
  if (step.kind === 'approach' && local.receiver) {
    const next = controlled(second, local.scene);
    if (!next) return null;
    const [goal] = center(local.scene.goal);
    if (Math.abs(center(next)[0] - goal) >= Math.abs(center(local.receiver)[0] - goal)) return null;
    if (step.predicted && (next[0] !== step.predicted[0] || next[1] !== step.predicted[1])) return 'movement_replanned_from_return';
    return 'movement_toward_matching_region';
  }
  return null;
}
