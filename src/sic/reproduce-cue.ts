import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeExecution, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';
import { measureAnimatedCells } from './observed-animation.ts';
import { observedMechanicsGroup } from './strategy-agenda.ts';
import { bindTranslationLanding, maximumCommittedActions, sameLandingPixels, unchangedOutside, type MeasuredLanding } from './plan-step.ts';
import { aimCommands, aimPoseMatches, aimRoute, hasAimedRay, overlaps, readAdaptableRemote, readAimPose, readGauge,
  readRemoteRoute, remoteFlightObserved, remoteOpeningObserved,
  type AimCommand, type AimPose, type AimWitness, type RemoteRoute, type ResizeWitness } from './remote-effect-route.ts';
import { chooseLinkedCue, measureLinkedCue, observeLinkedCue, type LinkedCue, type LinkedCueStep } from './linked-cue-route.ts';

export const reproduceCueId = 'sic_reproduce_cue';
export const learnAnimatedCueId = 'sic_learn_animated_cue';

type Part = ReturnType<typeof geometricComponents>[number];
type Cell = { box: NativeBox; point: NativePoint; initial: number };
type VisibleCue = { cells: number[]; examples: NativeBox[]; bands: [Part, Part]; axis: 0 | 1 };
type Scene = { panel: NativeBox; cells: Cell[]; goal: NativeBox; initialActor: NativeBox } & (
  { track: NativeBox; actorColors: number[]; visible?: never } | { visible: VisibleCue; track?: never; actorColors?: never });
type Step = { action: NativeCommand; kind: 'observe' | 'reproduce' | 'approach'; target: NativeBox; cell?: Cell; predicted?: NativeBox };
type State = { epoch: number; scene: Scene; cues: readonly number[]; refs: string[]; demonstrationRef: string | null; prepared: boolean;
  receiver: NativeBox | null; horizontal: number | null; rejected: string[]; resize?: Omit<ResizeWitness, 'unit' | 'refs'> };
type ApproachLeg = { step: Step; from: NativeBox; landing: MeasuredLanding };
type Proposal = NativeProposal & { local: State; step: Step; needId: string; attempt: string; approach?: readonly ApproachLeg[] };
type Recipe = { box: NativeBox; cells: number[]; examples: NativeBox[]; ink: number };
type Adaptation = { resizeRecipe: Recipe; shotRecipe: Recipe; fineRoute: RemoteRoute; pose: AimPose; finePose: AimPose;
  gauge: NativeBox; fill: number; inputs: Cell[]; active: Cell[]; resized: boolean; replenished: boolean; refs: string[] };
type RemoteState = { epoch: number; route: RemoteRoute; panel: NativeBox; cells: Cell[]; samples: NativeBox[];
  opened: boolean; stopped: boolean; refs: string[]; lastRef: string; recipe: number[]; adaptation?: Adaptation };
type RemoteStep = { kind: 'aim' | 'copy' | 'launch' | 'exit' | 'select' | 'resize' | 'recover'; action: NativeCommand;
  pose: AimPose; expected: AimPose; cell?: Cell; recipe?: Recipe };
type RemoteProposal = NativeProposal & { remote: RemoteState; aiming: RemoteStep; needId: string };
type LinkedProposal = NativeProposal & { linked: LinkedCue; linkedStep: LinkedCueStep; needId: string };
type CueProposal = Proposal | RemoteProposal | LinkedProposal;
const isRemote = (p: CueProposal): p is RemoteProposal => 'remote' in p;
const isLinked = (p: CueProposal): p is LinkedProposal => 'linked' in p;

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const inside = (a: NativeBox, b: NativeBox) => a[0] <= b[0] && a[1] <= b[1] && a[2] >= b[2] && a[3] >= b[3];
const intersects = (a: NativeBox, b: NativeBox) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const union = (a: NativeBox, b: NativeBox): NativeBox => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
const colorAt = (rows: NativeRows, [x, y]: NativePoint) => rows[y]?.[x];

const squaresInside = (parts: Part[], panel: Part) => parts.filter(p => p.rectangular && width(p.bbox) === height(p.bbox)
  && width(p.bbox) >= 2 && width(p.bbox) <= 5 && inside(panel.bbox, p.bbox) && p.color !== panel.color);

function measureInput(parts: Part[], h: number, allowVisible: boolean) {
  const candidates = parts.flatMap(panel => {
    if (panel.bbox[1] < h / 2 || width(panel.bbox) < 10 || height(panel.bbox) < 10) return [];
    const squares = squaresInside(parts, panel);
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
  return checkerboards.length === 1 ? checkerboards[0] : allowVisible && candidates.length === 1 ? candidates[0] : null;
}

function measureExamples(parts: Part[], { panel, panelColor, cells }: NonNullable<ReturnType<typeof measureInput>>): Recipe[] {
  return parts.flatMap(preview => {
    const box = preview.bbox;
    if (preview.color !== panelColor || intersects(panel, box) || width(box) >= width(panel) || height(box) >= height(panel)
      || width(box) !== height(box)) return [];
    const examples = squaresInside(parts, preview);
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
    return [{ box, cells: cue.sort((a, b) => a - b), examples: examples.map(p => p.bbox), ink: examples[0]!.color }];
  });
}

function measureExample(parts: Part[], input: NonNullable<ReturnType<typeof measureInput>>) {
  const miniatures = measureExamples(parts, input);
  return miniatures.length === 1 ? miniatures[0]! : null;
}

function measure(rows: NativeRows, allowVisible: boolean): Scene | null {
  const parts = geometricComponents(rows), input = measureInput(parts, rows.length, allowVisible);
  if (!input) return null;
  const { panel, cells, checkered } = input;
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
  const miniature = measureExample(parts, input);
  if (!miniature) return null;
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

function approachPath(local: State, step: Step, rows: NativeRows, remaining: number): ApproachLeg[] {
  const { receiver, horizontal, scene } = local;
  if (step.kind !== 'approach' || !step.predicted || !receiver || !horizontal) return [];
  const axis = scene.visible?.axis ?? 0, goal = center(scene.goal)[axis];
  const direction = Math.sign(goal - center(receiver)[axis]);
  if (Math.sign(horizontal) !== direction) return [];
  const route: ApproachLeg[] = [];
  let from = receiver;
  for (let i = 0; i < remaining && Math.sign(goal - center(from)[axis]) === direction; i++) {
    const predicted = translate(from, axis, horizontal);
    if (Math.abs(goal - center(predicted)[axis]) >= Math.abs(goal - center(from)[axis])) break;
    const landing = bindTranslationLanding(rows, receiver, from, predicted);
    if (!landing) break;
    route.push({ step: { ...step, predicted }, from, landing });
    from = predicted;
  }
  return route;
}

function cueStep(proposal: Proposal, index: number, state = proposal.local): { local: State; step: Step } {
  const leg = proposal.approach?.[index];
  return leg ? { local: { ...state, receiver: leg.from }, step: leg.step } : { local: state, step: proposal.step };
}

function chooseRemote(local: RemoteState, rows: NativeRows, available: readonly string[], remaining: number): RemoteStep | null {
  if (local.adaptation) return chooseAdaptedRemote(local, local.adaptation, rows, available, remaining);
  const pose = readAimPose(rows, local.route);
  if (!pose) return null;
  const aimed = hasAimedRay(rows, local.route, pose);
  if (!local.opened && aimed) {
    const unresolved = local.cells.filter(cell => colorAt(rows, cell.point) === cell.initial), cell = unresolved[0];
    if (!cell) return null;
    const [x, y] = cell.point;
    return { kind: unresolved.length === 1 ? 'launch' : 'copy', action: { action_ref: 'ACTION6', data: { x, y } },
      pose, expected: pose, cell };
  }
  const plan = aimRoute(rows, local.route, pose, available, local.opened ? 'exit' : 'aim', remaining);
  if (!plan) return null;
  return { kind: local.opened ? 'exit' : 'aim', action: { action_ref: plan.action, data: {} }, pose, expected: plan.pose };
}

function chooseAdaptedRemote(local: RemoteState, adapted: Adaptation, rows: NativeRows, available: readonly string[],
  remaining: number): RemoteStep | null {
  const { pose, active, finePose, resized, replenished } = adapted;
  const { route } = local;
  if (!aimPoseMatches(rows, route.witness, pose)) return null;
  const needsAim = resized && !local.opened && !hasAimedRay(rows, route, pose);
  if (needsAim || local.opened) {
    const goal = needsAim ? 'aim' : replenished ? 'exit' : 'supply';
    const plan = aimRoute(rows, route, pose, available, goal, remaining);
    if (!plan) return null;
    return { kind: goal === 'supply' ? 'recover' : goal, action: { action_ref: plan.action, data: {} }, pose, expected: plan.pose };
  }
  if (!active.length) {
    const recipe = resized ? adapted.shotRecipe : adapted.resizeRecipe;
    const [x, y] = center(recipe.box);
    return { kind: 'select', action: { action_ref: 'ACTION6', data: { x, y } }, pose, expected: pose, recipe };
  }
  const unresolved = active.filter(cell => colorAt(rows, cell.point) === cell.initial);
  const cell = unresolved[0];
  if (!cell) return null;
  const [x, y] = cell.point, final = unresolved.length === 1;
  return { kind: final ? resized ? 'launch' : 'resize' : 'copy', action: { action_ref: 'ACTION6', data: { x, y } },
    pose, expected: final && !resized ? finePose : pose, cell };
}

function selectedCells(rows: NativeRows, adapted: Adaptation, recipe: Recipe): Cell[] {
  const visible = adapted.inputs.filter(cell => colorAt(rows, cell.point) !== cell.initial);
  if (visible.length !== recipe.cells.length || !recipe.cells.every(i => visible.includes(adapted.inputs[i]!))) return [];
  return visible.map(cell => ({ ...cell, initial: colorAt(rows, cell.point)! }));
}

function remoteReturn(rows: NativeRows, { remote, aiming }: RemoteProposal, first?: NativeRows): string | null {
  const { kind, expected, cell, recipe } = aiming;
  const adapted = remote.adaptation, witness = kind === 'resize' ? adapted!.fineRoute.witness : remote.route.witness;
  if (!aimPoseMatches(rows, witness, expected)) return null;
  if (kind === 'select') return recipe && adapted && selectedCells(rows, adapted, recipe).length ? 'recipe_selection_confirmed' : null;
  if (kind === 'resize') return 'smaller_directional_footprint_confirmed';
  if (kind === 'launch') return remoteOpeningObserved(rows, remote.route) ? 'contact_and_distant_barrier_removed' : null;
  if (kind === 'copy') return cell && colorAt(rows, cell.point) !== cell.initial ? 'recipe_cell_activation_confirmed' : null;
  if (kind === 'recover' && adapted && remote.route.supply && overlaps(expected.box, remote.route.supply)) {
    return first && readGauge(rows, adapted.gauge, adapted.fill) > readGauge(first, adapted.gauge, adapted.fill)
      ? 'contact_and_reserve_increase_confirmed' : null;
  }
  if (kind === 'recover') return 'movement_toward_reserve_confirmed';
  return kind === 'aim' ? 'movement_and_heading_confirmed' : 'movement_through_opened_route_confirmed';
}

function seenResize(local: State, receiver: NativeBox | null): State['resize'] {
  if (local.scene.visible || !receiver) return undefined;
  const start = local.scene.initialActor, from = width(start), side = width(receiver);
  if (width(start) !== height(start) || side !== height(receiver) || side >= from) return undefined;
  return { from, side, offsets: [receiver[0] - start[0], receiver[1] - start[1]], cells: [...local.cues].sort((a, b) => a - b) };
}

function witnessedAim(rows: NativeRows, proposal: Proposal, epoch: number, ref: string): AimWitness | null {
  const { local, step } = proposal, { receiver, horizontal, scene } = local;
  if (!scene.visible || !receiver || !horizontal || step.kind !== 'approach' || !Object.hasOwn(aimCommands, step.action.action_ref)) return null;
  const heading = step.action.action_ref as AimCommand, [dx, dy] = aimCommands[heading];
  const side = width(receiver);
  if (side !== height(receiver) || side % 2 || Math.sign(horizontal) !== (dx || dy)) return null;
  const opposite = (from: number, to: number, sign: number) => sign > 0 ? [to, from] : [from, to];
  const [frontX, backX] = dx ? opposite(receiver[0], receiver[2], dx) : [receiver[0], receiver[0]];
  const [frontY, backY] = dy ? opposite(receiver[1], receiver[3], dy) : [receiver[1], receiver[1]];
  const frontInk = rows[frontY!]?.[frontX!], backInk = rows[backY!]?.[backX!];
  if (frontInk === undefined || backInk === undefined || frontInk === backInk) return null;
  const candidate = { epoch, unit: Math.abs(horizontal), side, frontInk, backInk, refs: [...local.refs.slice(-3), ref] };
  return aimPoseMatches(rows, candidate, { box: receiver, heading }) ? candidate : null;
}

export function createSicReproduceCue(family = reproduceCueId, transferObservedCue = false): NativeFamily<CueProposal> {
  const learns = family === learnAnimatedCueId;
  let scoredCue: { epoch: number; refs: string[] } | null = null;
  let state: State | null = null;
  let witness: AimWitness | null = null;
  let remoteState: RemoteState | null = null;
  let resize: ResizeWitness | null = null;
  let shot: { epoch: number; cells: number[]; refs: string[] } | null = null;
  let transfer: { cells: number[]; refs: string[] } | null = null;
  let linked: LinkedCue | null = null;
  async function offerLinked(observation: NativeObservation, rows: NativeRows, remaining: number,
    execution?: NativeExecution): Promise<LinkedProposal | null> {
    const { level_epoch: epoch, observation_ref: ref, available_action_refs: available } = observation;
    if (learns || remaining < 1 || !available.includes('ACTION6')) return null;
    let route = linked?.epoch === epoch ? linked : null;
    if (route && (route.stopped || route.lastRef !== ref)) return null;
    if (!route) {
      const learned = linked?.epoch === epoch - 1 && !linked.stopped && linked.trips > 1
        && linked.cleared.length === linked.scene.routes.length ? linked : null;
      const transferred = learned?.scene.large ?? (witness?.epoch === epoch - 1 && remoteState?.epoch === epoch - 1
        && remoteState.adaptation && remoteState.opened ? witness : null);
      if (!resize || !shot || !transfer || !transferred) return null;
      const parts = geometricComponents(rows), input = measureInput(parts, rows.length, true);
      const cards = input ? measureExamples(parts, input) : [];
      if (!input || cards.length < 3) return null;
      const match = (cells: readonly number[]) => {
        const matches = cards.filter(card => card.cells.join() === cells.join());
        return matches.length === 1 ? matches[0]! : null;
      };
      const resizing = match(resize.cells), aiming = match(shot.cells), transport = match(transfer.cells);
      if (!resizing || !aiming || !transport || new Set([resizing, aiming, transport]).size !== 3) return null;
      route = measureLinkedCue(rows, input.panel, input.cells, { resize: resizing, launch: aiming, transfer: transport },
        transferred, resize, epoch, ref, [...new Set([...resize.refs, ...shot.refs, ...transfer.refs, ...(learned?.refs ?? remoteState?.refs ?? [])])],
        learned?.scene.routes[0]?.floor);
      if (!route) return null;
    }
    const step = chooseLinkedCue(route, rows, available, remaining);
    if (!step) return null;
    const { action, click, expected, work } = step, { scene, pose } = route, target = scene.routes[step.target]!;
    const evidence: [string, ...string[]] = [ref, ...route.refs.filter(value => value !== ref)];
    const mode = execution?.reasoningMode ?? 'assimilation';
    const offer = { input: action.action_ref, expected: center(click ?? expected?.box ?? pose.box), evidence };
    const probing = step.kind === 'apply' && work === 'launch';
    const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence,
      probe: probing ? offer : null, access: click ? null : offer, interaction: click && !probing ? offer : null });
    if (!selected) return null;
    const situation = step.kind === 'apply'
      ? work === 'resize' ? 'Change the footprint for the next part of the route'
        : work === 'launch' ? 'Check the aimed effect against its matching distant barrier'
          : 'Apply the transfer and verify which platform received the moving piece'
      : { aim: 'Find a clear line to the inset linked to an unopened barrier',
        recover: 'Reach the piece that restores the reserve', exit: 'Reach the exit through the openings already confirmed',
        copy: 'Activate the next marked cell of the current recipe', select: 'Select the observed recipe for the next effect' }[step.kind];
    const pointBinding = click ? await ObservedInputDomain.makeLocusWitness(observation, rows, center(click), { reason: situation, evidence }) : null;
    if (click && !pointBinding) return null;
    const parent = 'G_official_completion';
    const objective = { kind: 'prepare_linked_exit_from_another_platform', scope: ref.split(':revision:', 1)[0]!,
      subjects: [...scene.routes.map(item => center(item.barrier).join(',')), center(scene.exit).join(',')],
      parentObjective: parent, satisfactionContract: 'official_progress_after_verified_platform_transfers' };
    const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = family + ':' + need.id;
    return { status: 'proposed', kind: family, linked: route, linkedStep: step, needId: need.id, actions: [action],
      binding: { observation_ref: ref, level_epoch: epoch },
      steps: [{ action, expected_after: expected?.box ?? null, ...(pointBinding ? { point_binding: pointBinding } : {}) }],
      sicSituationCard: { strategy: selected.id, need: 'Open the passages on the receiving platform', situation, mode, evidence,
        agenda: entries, triggerCard: card, panel: scene.panel, sampleCells: work ? scene.recipes[work].examples : [],
        actor: pose.box, target: click ?? (step.kind === 'aim' ? target.target
          : step.kind === 'recover' ? route.recovery?.box ?? scene.supply ?? target.target : scene.exit),
        addressedRegion: target.target, obstacle: target.barrier, exit: scene.exit, reserveGauge: scene.gauge,
        ...(expected ? { expectedFootprint: expected.box } : {}) },
      question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
      compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
      sicLocalDecision: { strategy: selected.id, objective: { id, label: navigationPrimitives[selected.id], parent }, need },
      bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
        preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } } };
  }
  async function offerRemote(observation: NativeObservation, rows: NativeRows, remaining: number,
    execution?: NativeExecution): Promise<RemoteProposal | null> {
    const { level_epoch: epoch, observation_ref: ref, available_action_refs: available } = observation;
    if (learns || witness?.epoch !== epoch || remaining < 1 || !available.includes('ACTION6')) return null;
    let remote = remoteState?.epoch === epoch ? remoteState : null;
    if (remote && (remote.stopped || remote.lastRef !== ref)) return null;
    if (!remote) {
      const parts = geometricComponents(rows), input = measureInput(parts, rows.length, true);
      const samples = input ? measureExamples(parts, input) : [];
      const sample = samples.length === 1 ? samples[0]! : null;
      const route = input && sample && readRemoteRoute(rows, input.panel, sample.ink, witness);
      if (!input) return null;
      if (sample && route) {
        remote = { epoch, route, panel: input.panel, cells: sample.cells.map(i => input.cells[i]!), samples: sample.examples,
          opened: false, stopped: false, refs: [], lastRef: ref, recipe: sample.cells };
      } else if (resize && shot?.epoch === epoch && samples.length > 1) {
        const matching = (cells: number[]) => samples.filter(s => s.cells.join() === cells.join());
        const resizeCards = matching(resize.cells), shotCards = matching(shot.cells);
        if (resizeCards.length !== 1 || shotCards.length !== 1 || resizeCards[0] === shotCards[0]) return null;
        const resizeRecipe = resizeCards[0]!, shotRecipe = shotCards[0]!;
        const adapted = readAdaptableRemote(rows, input.panel, shotRecipe.ink, witness, resize);
        if (!adapted) return null;
        const { actor, fineRoute, finePose, gauge, fill } = adapted;
        const adaptation = { resizeRecipe, shotRecipe, fineRoute, pose: actor, finePose, gauge, fill,
          inputs: input.cells, active: [], resized: false, replenished: false, refs: [...resize.refs, ...shot.refs] };
        remote = { epoch, route: adapted.route, panel: input.panel, cells: [], samples: shotRecipe.examples,
          opened: false, stopped: false, refs: [], lastRef: ref, recipe: shot.cells, adaptation };
      } else return null;
    }
    const aiming = chooseRemote(remote, rows, available, remaining);
    if (!aiming) return null;
    const { action, kind, cell, pose, expected, recipe } = aiming;
    const route = remote.route, click = cell?.box ?? recipe?.box;
    const target = click ?? (kind === 'aim' ? route.target : kind === 'recover' ? route.supply ?? route.exit : route.exit);
    const evidence: [string, ...string[]] = [ref,
      ...new Set([...remote.refs, ...(remote.adaptation?.refs ?? []), ...witness.refs].filter(value => value !== ref))];
    const mode = execution?.reasoningMode ?? 'assimilation';
    const offer = { input: action.action_ref, expected: center(click ?? expected.box), evidence };
    const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence, probe: kind === 'launch' ? offer : null,
      access: click ? null : offer, interaction: click && kind !== 'launch' ? offer : null });
    if (!selected) return null;
    const situation = {
      aim: 'Turn the moving piece toward the inset linked to the blocked passage',
      copy: 'Copy the marked cell from the visible motif',
      launch: 'Test whether the aligned motif effect removes both the inset and the distant barrier',
      exit: 'Move to the framed exit through the opened passage',
      select: remote.adaptation?.resized ? 'Select the observed recipe linked to the aimed effect'
        : 'Select the observed recipe that reduced the piece to fit a narrower alignment',
      resize: 'Apply the recipe and verify the smaller footprint and preserved heading',
      recover: 'Test whether contact with the piece matching the reserve gauge restores it',
    }[kind];
    const pointBinding = click ? await ObservedInputDomain.makeLocusWitness(observation, rows, center(click), { reason: situation, evidence }) : null;
    if (click && !pointBinding) return null;
    const parent = 'G_official_completion';
    const objective = { kind: 'open_route_by_remote_effect', scope: ref.split(':revision:', 1)[0]!,
      subjects: [center(route.target).join(','), center(route.barrier).join(','), center(route.exit).join(',')],
      parentObjective: parent, satisfactionContract: 'official_progress_after_opening_and_access' };
    const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = family + ':' + need.id;
    return { status: 'proposed', kind: family, remote, aiming, needId: need.id, actions: [action],
      binding: { observation_ref: ref, level_epoch: epoch },
      steps: [{ action, expected_after: expected.box, ...(pointBinding ? { point_binding: pointBinding } : {}) }],
      sicSituationCard: { strategy: selected.id, need: 'Open the blocked passage and reach the exit', situation, mode, evidence,
        agenda: entries, triggerCard: card, panel: remote.panel,
        sampleCells: recipe?.examples ?? (remote.adaptation && !remote.adaptation.resized ? remote.adaptation.resizeRecipe.examples : remote.samples),
        actor: pose.box, target, addressedRegion: route.target, obstacle: route.barrier, exit: route.exit,
        ...(remote.adaptation ? { reserveGauge: remote.adaptation.gauge, expectedFootprint: expected.box } : {}) },
      question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
      compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
      sicLocalDecision: { strategy: selected.id, objective: { id, label: navigationPrimitives[selected.id], parent }, need },
      bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
        preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } } };
  }
  return {
    id: family,
    async proposeInGroup(group, observation, rows, inputs, remaining, execution) {
      return group === observedMechanicsGroup ? await offerLinked(observation, rows, remaining, execution)
        ?? await offerRemote(observation, rows, remaining, execution)
        : this.propose(observation, rows, inputs, remaining, execution);
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const opening = await offerLinked(observation, rows, remaining, execution) ?? await offerRemote(observation, rows, remaining, execution);
      if (opening) return opening;
      const supports = (a: string, b: string) => observation.available_action_refs.includes(a) && observation.available_action_refs.includes(b);
      const comparableCue = transferObservedCue && scoredCue?.epoch === observation.level_epoch ? scoredCue : null;
      if (!supports('ACTION3', 'ACTION4') && (learns && !comparableCue || !supports('ACTION1', 'ACTION2'))) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const readDemonstration = learns && !prior && !comparableCue;
      if (readDemonstration && !execution?.readAnimatedCells) return null;
      const scene = prior?.scene ?? measure(rows, !learns || !!comparableCue);
      if (!scene || (scene.visible?.axis === 1 ? !supports('ACTION1', 'ACTION2') : !supports('ACTION3', 'ACTION4'))) return null;
      const demonstration = readDemonstration ? execution?.readAnimatedCells?.(scene.cells.map(cell => cell.point)) : null;
      if (readDemonstration && (!demonstration || demonstration.afterRef !== observation.observation_ref
        || demonstration.levelEpoch !== observation.level_epoch || !cueSubset(demonstration.cells, scene.cells))) return null;
      const local = prior ?? { epoch: observation.level_epoch, scene, cues: demonstration?.cells ?? scene.visible?.cells ?? [], refs: demonstration ? [demonstration.beforeRef] : scene.visible && comparableCue ? comparableCue.refs : [],
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
      const approach = approachPath(local, step, rows, Math.min(remaining, maximumCommittedActions));
      const actions = approach.length > 1 ? approach.map(leg => leg.step.action) : [action];
      return {
        status: 'proposed', kind: family, local, step, needId: need.id, attempt,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions,
        ...(actions.length > 1 ? { approach } : {}),
        steps: actions.length > 1 ? approach.map(leg => ({ action: leg.step.action, expected_after: leg.step.predicted }))
          : [{ action, expected_after: step.predicted ?? null, ...(witness ? { point_binding: witness } : {}) }],
        sicSituationCard: { strategy: selected.id, need: 'Prepare the piece and reach its matching region', situation, evidence, agenda: entries, mode,
          triggerCard: card, panel: scene.panel, target: step.target, actor: local.receiver ?? scene.initialActor, exit: scene.goal,
          ...(scene.visible ? { sampleCells: scene.visible.examples } : { observedCues: local.cues.map(i => scene.cells[i]!.box) }),
          ...(demonstration ? { demonstrationSource: demonstration.family, demonstrationAction: demonstration.action } : {}),
          ...(actions.length > 1 ? { plannedSeries: approach.map(leg => center(leg.step.predicted!)) } : {}) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: selected.id, objective: { id, label: navigationPrimitives[selected.id], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, packet, current) {
      if (index > 0 && !isRemote(proposal) && !isLinked(proposal)) {
        const leg = proposal.approach?.[index], receiver = leg ? controlled(packet.frame_rows, proposal.local.scene) : null;
        const admitted = !!leg && proposal.binding?.level_epoch === current.level_epoch && !!receiver
          && receiver.every((value, i) => value === leg.from[i]) && sameLandingPixels(leg.landing, packet.frame_rows);
        return { admitted, reason: admitted ? 'recognized_footprint_and_landing_still_visible' : 'cue_route_landing_changed' };
      }
      const admitted = index === 0 && proposal.binding?.observation_ref === current.observation_ref;
      return { admitted, reason: admitted ? 'cue_action_bound' : 'cue_layout_changed' };
    },
    after(proposal, index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      if (isLinked(proposal)) {
        if (proposal.linkedStep.kind === 'apply' && proposal.linkedStep.work === 'launch') {
          return { matched: null, seal_prefix: true, reason: 'check_projectile_and_linked_opening_in_frames' };
        }
        const outcome = observeLinkedCue(proposal.linked, proposal.linkedStep, first, second);
        return { matched: !!outcome, seal_prefix: true, reason: outcome?.reason ?? 'linked_cue_prediction_contradicted' };
      }
      if (isRemote(proposal)) {
        const reason = remoteReturn(second, proposal, first);
        return { matched: !!reason, seal_prefix: true, reason: reason ?? 'remote_effect_or_movement_contradicted' };
      }
      if (proposal.step.kind === 'observe') return { matched: null, seal_prefix: true, reason: 'check_intermediate_frames_for_cue' };
      const bound = cueStep(proposal, index);
      const reason = check(bound, first, second);
      const canContinue = reason === 'movement_toward_matching_region' && index + 1 < proposal.actions.length
        && bound.local.receiver && bound.step.predicted && unchangedOutside(first, second, [bound.local.receiver, bound.step.predicted]);
      return { matched: !!reason, seal_prefix: !canContinue, reason: reason ?? 'cue_or_movement_not_confirmed' };
    },
    record(before, after, _action, first, second, proposal, index, frames) {
      if (isLinked(proposal)) {
        if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
        const outcome = observeLinkedCue(proposal.linked, proposal.linkedStep, first, second, frames);
        linked = { ...(outcome?.run ?? proposal.linked), stopped: !outcome, lastRef: after.observation_ref,
          refs: outcome ? [...proposal.linked.refs.slice(-12), after.observation_ref] : proposal.linked.refs };
        return { events: [], ...(outcome?.reason === 'visible_effect_reached_inset_and_removed_its_barrier'
          ? { reviewEvidence: 'The projectile reached the inset and removed the matching barrier on the receiving platform.' } : {}) };
      }
      if (isRemote(proposal)) {
        const { remote, aiming } = proposal;
        if (after.levels_completed > before.levels_completed && remote.opened && remote.recipe?.length && !remote.adaptation && witness) {
          shot = { epoch: after.level_epoch, cells: remote.recipe, refs: [...remote.refs, after.observation_ref] };
          witness = { ...witness, epoch: after.level_epoch };
        }
        if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
        const reason = remoteReturn(second, proposal, first);
        const flight = aiming.kind === 'launch' && !!reason && remoteFlightObserved(first, frames ?? [], aiming.pose, remote.route);
        const confirmed = reason && (aiming.kind !== 'launch' || flight);
        const adapted = remote.adaptation;
        const resized = reason === 'smaller_directional_footprint_confirmed';
        const adaptation = adapted && confirmed ? { ...adapted, pose: aiming.expected, resized: adapted.resized || resized,
          replenished: adapted.replenished || reason === 'contact_and_reserve_increase_confirmed',
          active: aiming.recipe ? selectedCells(second, adapted, aiming.recipe) : resized || flight ? [] : adapted.active } : adapted;
        remoteState = { ...remote, ...(adaptation ? { adaptation } : {}), route: resized && adapted ? adapted.fineRoute : remote.route,
          opened: remote.opened || flight, stopped: !confirmed,
          refs: confirmed ? [...remote.refs.slice(-5), after.observation_ref] : remote.refs, lastRef: after.observation_ref };
        return { events: [], ...(flight ? { reviewEvidence: 'The visible effect travelled to the inset before the distant passage opened.' } : {}) };
      }
      const bound = cueStep(proposal, index, index > 0 && state?.epoch === proposal.local.epoch ? state : proposal.local);
      const { local, step } = bound;
      if (after.levels_completed > before.levels_completed) {
        if (transferObservedCue && local.prepared) {
          scoredCue = { epoch: after.level_epoch, refs: [...local.refs.slice(-4), before.observation_ref, after.observation_ref] };
        }
        witness = witnessedAim(first, { ...proposal, ...bound }, after.level_epoch, after.observation_ref);
        if (local.resize && local.horizontal && local.prepared) resize = { ...local.resize, unit: Math.abs(local.horizontal),
          refs: [...local.refs.slice(-2), after.observation_ref] };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const animated = step.kind === 'observe' ? measureAnimatedCells(first, second, frames, local.scene.cells.map(cell => cell.point)) : [];
      const cues = step.kind === 'observe' ? (cueSubset(animated, local.scene.cells) ? animated : []) : local.cues;
      const reason = step.kind === 'observe' ? (cues.length ? 'animated_cue_observed' : null) : check(bound, first, second);
      const receiver = reason === 'prepared_footprint_observed' || local.prepared ? controlled(second, local.scene) : null;
      if (reason === 'prepared_footprint_observed' && receiver && local.scene.visible
        && width(receiver) === width(local.scene.initialActor) && height(receiver) === height(local.scene.initialActor)) {
        transfer = { cells: [...local.cues].sort((a, b) => a - b), refs: [...local.refs.slice(-3), after.observation_ref] };
      }
      const axis = local.scene.visible?.axis ?? 0;
      const horizontal = receiver && local.receiver && step.kind === 'approach' && reason ? receiver[axis] - local.receiver[axis] : local.horizontal;
      const measuredResize = reason === 'prepared_footprint_observed' ? seenResize(local, receiver) : local.resize;
      state = { ...local, cues, receiver, horizontal, prepared: local.prepared || reason === 'prepared_footprint_observed',
        ...(measuredResize ? { resize: measuredResize } : {}),
        demonstrationRef: step.kind === 'observe' && cues.length ? after.observation_ref : local.demonstrationRef,
        refs: reason ? [...local.refs.slice(-4), after.observation_ref] : local.refs,
        rejected: reason ? local.rejected : [...local.rejected, JSON.stringify([step.action, local.receiver, local.cues.length])] };
      return { events: [] };
    },
    state: () => ({ state, witness, remoteState, resize, shot, transfer, linked, ...(scoredCue ? { scoredCue } : {}) }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      witness = structuredClone((value.witness ?? null) as AimWitness | null);
      remoteState = structuredClone((value.remoteState ?? null) as RemoteState | null);
      resize = structuredClone((value.resize ?? null) as ResizeWitness | null);
      shot = structuredClone((value.shot ?? null) as typeof shot);
      transfer = structuredClone((value.transfer ?? null) as typeof transfer);
      linked = structuredClone((value.linked ?? null) as LinkedCue | null);
      scoredCue = structuredClone((value.scoredCue ?? null) as typeof scoredCue);
    },
  };
}

function check({ local, step }: Pick<Proposal, 'local' | 'step'>, first: NativeRows, second: NativeRows): string | null {
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
