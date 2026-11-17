import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import { symbolicDigest } from '../logos-engine/v6-hash.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeObservation, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { navigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';
import { measureComponentTranslations } from './observed-translation.ts';
import { componentCenterPoint } from './interior-shape-targets.ts';
import { observedCommandFrontier, observedCommandKey as commandKey, observedCommandState as interfaceKey, oppositeDirection, rememberCommandReturn,
  stationaryCommandEvidence, type ObservedCommandGraph } from './observed-command-frontier.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';
import { matchesCollectionEdit, proposeCollectionTrial, type CollectionTrial } from './collection-experiment.ts';
import { repeatedInputTargets } from './repeated-input-targets.ts';
import { countChangesInside, workspaceClickCandidate } from './workspace-click.ts';
import { commandPanelState, visibleCommandPanel, type VisibleCommandPanel } from './visible-command-panel.ts';
import { canReachPanelMarker, containsBox, learnPanelDirection, learnPanelTerrain, matchesPanelTerrain, matchingPanelMarker, panelActor,
  panelMarkerCode, panelMarkerTrialKey, projectPanelContact, projectPanelFooting, projectPanelMarker, projectPanelTerrain, rememberPanelTerrain, sameBox,
  type KnownPanelSource, type PanelApproach, type PanelContactApproach, type PanelEffect, type PanelMarkerTrial,
  type PanelTerrain, type PanelTerrainStep, type PanelWalker, type TerrainProjection } from './panel-context-probe.ts';
import { sameLandingPixels } from './plan-step.ts';
import { measureReturningAnimation } from './observed-animation.ts';
import { centeredToolRegion, dockingDistance, findPanelDock, measureAlignedTool, measurePanelTransport, panelToolTranslation } from './panel-mechanism-probe.ts';

export const publicInputExplorationId = 'sic_public_input_exploration';
export const publicInputStrategies = {
  P05: 'Test a direction on the visibly changed piece',
  P07: 'Follow an observed return to an untested control',
  test_marked_edit: 'Test the edit suggested by the visible marks',
  test_edited_collection: 'Test the effect of the verified edit',
  test_repeated_target: 'Test a target from a repeated group',
  test_workspace_target: 'Test a target in the work area while preserving the example',
  recheck_controls_after_change: 'Recheck directional controls after an interface change',
  test_repeated_marker: 'Test a small marker in a repeated arrangement',
  compare_public_input: 'Test an available command on this board',
  revisit_input_frontier: 'Revisit a board with an untested command',
} as const;
const order = ['P05', 'recheck_controls_after_change', 'test_marked_edit', 'test_edited_collection', 'test_workspace_target',
  'test_repeated_marker', 'test_repeated_target', 'compare_public_input', 'revisit_input_frontier'] as const;
const graph = compileStrategyGraph({ id: 'understand_public_controls', version: 7, order: 'FALLBACK', priorities: order,
  strategies: {
    P05: [{ fact: 'clickedControl', expected: true, label: 'A click changed a piece after directional commands failed to move it' }],
    recheck_controls_after_change: [{ fact: 'changedControlContext', expected: true, label: 'Previously stationary directions can be rechecked after a visible interface change' }],
    test_marked_edit: [{ fact: 'markedEdit', expected: true, label: 'A visible mark suggests a testable change to the collection' }],
    test_edited_collection: [{ fact: 'verifiedEdit', expected: true, label: 'The expected edit occurred and no mark requests another change' }],
    test_workspace_target: [{ fact: 'workspaceTarget', expected: true, label: 'A bounded work area offers a candidate matching the separate example' }],
    test_repeated_marker: [{ fact: 'repeatedMarker', expected: true, label: 'Several equal square arrangements of isolated markers are visible, and this marker is untested on this board' }],
    test_repeated_target: [{ fact: 'repeatedTarget', expected: true, label: 'The available non-point command and several clicks left the board unchanged, and a repeated group offers a distinct test' }],
    compare_public_input: [{ fact: 'untestedHere', expected: true, label: 'An available illustrated input has no return on this board' }],
    revisit_input_frontier: [{ fact: 'observedRoute', expected: true, label: 'Previously observed returns lead to an untested input' }],
  },
}, ['clickedControl', 'changedControlContext', 'markedEdit', 'verifiedEdit', 'workspaceTarget', 'repeatedMarker', 'repeatedTarget', 'untestedHere', 'observedRoute']);
const explorationLimit = 40;
const clickLimit = 30;
const completion = 'G_official_completion';

type ClickedControl = { box: NativeBox; point: NativePoint; remaining: string[]; evidence: string; destination: string };
type RevealedControl = { command: NativeCommand; box: NativeBox; contact: NativeBox; before: string; observation: string; ink?: number };
type AnimatedPanelControl = { control: RevealedControl; region: NativeBox; frames: number[]; evidence: string; tested: string[];
  dock?: NativeBox; changedAtDock?: string; held?: { tool: NativeBox; support: NativeBox }; transport?: string };
type PanelMechanismMotion = { footing: RevealedControl; delta: NativePoint | null; tool: string; evidence: string };
type ObservedMarkerProgram = { selector: PanelEffect; source: KnownPanelSource; from: string; code: string | null; evidence: string };
export type ControlledMotion = { from: NativeBox; to: NativeBox; command: string; evidence: readonly [string, string]; destination: string };
type State = { epoch: number; experiments: number; transitions: ObservedCommandGraph; options: Record<string, string[]>;
  lastChange: { destination: string; action: string; evidence: string } | null;
  clickedControl?: ClickedControl;
  controlledPiece?: ControlledMotion;
  directionHadLocalEffect?: true;
  testedDirections?: string[];
  panelTests?: string[];
  lastPanelInputWasClick?: boolean;
  lastPanelContext?: string;
  panelWalker?: PanelWalker;
  panelEffects?: PanelEffect[];
  panelMarker?: { trial: PanelMarkerTrial; observation: string };
  testedPanelMarkers?: string[];
  panelArrival?: string;
  testedPanelContacts?: string[];
  testedPanelTerrain?: string[];
  revealedPanelControl?: RevealedControl;
  revealedPanelControls?: RevealedControl[];
  animatedPanelControls?: Record<string, AnimatedPanelControl>;
  panelSources?: KnownPanelSource[];
  panelDestinations?: NativeBox[];
  panelPrograms?: ObservedMarkerProgram[];
  panelTerrain?: Record<string, PanelTerrain>;
  panelMechanismMotions?: PanelMechanismMotion[];
  testedMechanismMotions?: string[];
  collectionEdit?: readonly [string, string];
  recheck: { until: number; evidence: readonly string[] } | null };
type Proposal = NativeProposal & { source: string; candidates: string[]; expected?: string; selectedBox?: NativeBox;
  clickedControl?: ClickedControl; collectionTrial?: CollectionTrial; workspaceTrial?: NativeBox; needId: string;
  panel?: Pick<VisibleCommandPanel, 'area' | 'panel'>; panelTest?: string;
  panelApproach?: PanelApproach; panelComparison?: PanelMarkerTrial; panelContact?: PanelContactApproach;
  revealedControl?: RevealedControl; retestedControl?: AnimatedPanelControl; terrainStep?: PanelTerrainStep;
  mechanismMove?: { motion: PanelMechanismMotion; trial: string } };
export type PanelFrontier = Pick<State, 'transitions' | 'options'>;
const initial = (epoch = 0): State => ({ epoch, experiments: 0, transitions: {}, options: {}, lastChange: null, recheck: null });
export function currentPanelFrontier(state: NativeRecord, observation: NativeObservation): PanelFrontier | undefined {
  const exploration = state as State;
  return exploration.epoch === observation.level_epoch && exploration.lastPanelContext
    ? { transitions: exploration.transitions, options: exploration.options } : undefined;
}
export function currentControlledMotion(state: NativeRecord, observation: NativeObservation): ControlledMotion | undefined {
  const exploration = state as State;
  const motion = exploration.controlledPiece;
  return exploration.epoch === observation.level_epoch && motion?.evidence[1] === observation.observation_ref
    && motion.destination === interfaceKey(observation) ? motion : undefined;
}

function changedWithin(before: NativeRows, after: NativeRows, [l, t, r, b]: NativeBox) {
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) if (before[y]?.[x] !== after[y]?.[x]) return true;
  return false;
}

function panelChangeBounds(before: NativeRows, after: NativeRows, [l, t, r, b]: NativeBox): NativeBox | undefined {
  let left = r + 1, top = b + 1, right = l - 1, bottom = t - 1;
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
    if (before[y]?.[x] === after[y]?.[x]) continue;
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  return right >= left ? [left, top, right, bottom] : undefined;
}

function terrainTestKey(rows: NativeRows, effect: PanelEffect) {
  const [l, t, r, b] = effect.affected!;
  return symbolicDigest([commandKey(effect.command), effect.affected, rows.slice(t, b + 1).map(row => row.slice(l, r + 1))]);
}

function retainPanelEffect(state: State, panel: VisibleCommandPanel, command: NativeCommand,
  rows: NativeRows, afterRows: NativeRows, evidence: string, measureTerrain: boolean) {
  if (/^ACTION[1-4]$/.test(command.action_ref)) {
    const walker = learnPanelDirection(state.panelWalker, panel.area, command.action_ref, rows, afterRows, evidence);
    if (walker) state.panelWalker = state.panelArrival
      ? learnPanelTerrain(walker, panel.area, panel.fieldInk, command.action_ref, rows, afterRows, evidence) : walker;
    return;
  }
  if (command.action_ref !== 'ACTION6' || !state.panelWalker || !changedWithin(rows, afterRows, panel.area)) return;
  const { x, y } = command.data;
  if (x === undefined || y === undefined) return;
  const button = panel.buttons.find(part => containsBox(part.bbox, [x, y, x, y]));
  const previous = button && panelActor(state.panelWalker, rows, panel.area);
  const current = previous && panelActor(state.panelWalker, afterRows, panel.area);
  if (!button || !previous || !current || !sameBox(previous, current)) return;
  const effects = state.panelEffects ??= [];
  const key = commandKey(command);
  const existing = effects.find(effect => effect.ink === button.color && commandKey(effect.command) === key);
  const affected = existing?.affected ?? (measureTerrain ? panelChangeBounds(rows, afterRows, panel.area) : undefined);
  if (!existing) effects.push({ command, box: button.bbox, ink: button.color, evidence, ...(affected ? { affected } : {}) });
  else if (!existing.affected && affected) existing.affected = affected;
}

function finishPanelTrial(state: State, key: string) {
  delete state.panelMarker;
  state.testedPanelMarkers = [...new Set([...(state.testedPanelMarkers ?? []), key])];
}

function newlyVisibleControls(first: VisibleCommandPanel | null, rows: NativeRows) {
  const next = first && visibleCommandPanel(rows);
  return next && first ? next.buttons.filter(button => !first.buttons.some(previous =>
    previous.color === button.color && previous.area === button.area && sameBox(previous.bbox, button.bbox))) : [];
}

function retainMarkerPrograms(state: State, effect: PanelEffect, before: NativeRows, after: NativeRows, evidence: string) {
  for (const source of state.panelSources ?? []) {
    if (!effect.affected || !containsBox(source.marker, effect.affected)) continue;
    const former = panelMarkerCode(before, source.marker), code = panelMarkerCode(after, source.marker);
    if (!former || !code) continue;
    const programs = state.panelPrograms ??= [];
    const known = programs.find(program => commandKey(program.selector.command) === commandKey(effect.command)
      && sameBox(program.source.marker, source.marker) && program.from === former);
    if (known) {
      if (known.code !== code) known.code = null;
    } else if (former !== code) programs.push({ selector: effect, source, from: former, code, evidence });
  }
}

const gap = (a: NativeBox, b: NativeBox) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

function selectMarkerProgram(local: State, effects: readonly PanelEffect[], rows: NativeRows, field: NativeBox,
  attempted: ReadonlySet<string>, inputs: readonly NativeCommand[], remaining: number, phaseFor: (marker: NativeBox) => TerrainProjection | null) {
  const available = new Set(effects.map(effect => commandKey(effect.command)));
  const offers: { program: ObservedMarkerProgram; peer: NativeBox; distance: number; depth: number }[] = [];
  for (const source of local.panelSources ?? []) {
    const start = panelMarkerCode(rows, source.marker), portal = effects.find(effect => commandKey(effect.command) === source.command);
    if (!start || !portal) continue;
    const transitions = local.panelPrograms?.filter(program => program.code && sameBox(source.marker, program.source.marker)
      && available.has(commandKey(program.selector.command)));
    if (!transitions?.length || (!canReachPanelMarker(local.panelWalker!, rows, field, inputs, source.marker, remaining - 2)
      && !phaseFor(source.marker))) continue;
    const queue: { code: string; first?: ObservedMarkerProgram; depth: number }[] = [{ code: start, depth: 0 }];
    const seen = new Set([start]);
    for (const step of queue) {
      for (const transition of transitions) {
        const code = transition.code!;
        if (step.code !== transition.from || seen.has(code) || (!step.first && attempted.has(commandKey(transition.selector.command)))) continue;
        seen.add(code);
        const first = step.first ?? transition, depth = step.depth + 1;
        queue.push({ code, first, depth });
        if (local.testedPanelMarkers?.includes(panelMarkerTrialKey(portal.command, source.marker, code))) continue;
        const peer = matchingPanelMarker(rows, field, source.marker, code);
        if (peer && !local.panelDestinations?.some(destination => sameBox(destination, peer))) {
          offers.push({ program: first, peer, distance: gap(source.marker, peer), depth });
        }
      }
    }
  }
  return offers.sort((left, right) => left.distance - right.distance || left.depth - right.depth)[0];
}

function phasedMarker(local: State, effects: readonly PanelEffect[], rows: NativeRows, field: NativeBox,
  phaseFor: (marker: NativeBox) => TerrainProjection | null) {
  const offers: { target: PanelMarkerTrial; path: TerrainProjection }[] = [];
  for (const source of local.panelSources ?? []) {
    const code = panelMarkerCode(rows, source.marker);
    const control = effects.find(effect => commandKey(effect.command) === source.command);
    if (!code || !control) continue;
    const key = panelMarkerTrialKey(control.command, source.marker, code);
    if (local.testedPanelMarkers?.includes(key)) continue;
    const peer = matchingPanelMarker(rows, field, source.marker, code);
    if (!peer || local.panelDestinations?.some(destination => sameBox(destination, peer))) continue;
    const path = phaseFor(source.marker);
    if (path) offers.push({ target: { key, marker: source.marker, control, link: source.evidence, peer }, path });
  }
  return offers.sort((left, right) => left.path.distance - right.path.distance)[0];
}

function alignPanelMechanism(local: State, panel: VisibleCommandPanel, rows: NativeRows, inputs: readonly NativeCommand[],
  attempted: ReadonlySet<string>, budget: number) {
  if (!local.panelWalker || !local.panelMechanismMotions?.length) return;
  const actor = panelActor(local.panelWalker, rows, panel.area);
  if (!actor) return;
  const offers = local.panelMechanismMotions.flatMap<{
    motion: PanelMechanismMotion; mechanism: AnimatedPanelControl; distance: number; trial: string; route: PanelContactApproach | null;
  }>(motion => {
    const mechanism = local.animatedPanelControls?.[motion.tool];
    if (!motion.delta || !mechanism?.dock || mechanism.changedAtDock) return [];
    const distance = dockingDistance(mechanism.region, mechanism.dock, motion.delta);
    if (distance >= dockingDistance(mechanism.region, mechanism.dock)) return [];
    const key = commandKey(motion.footing.command);
    const trial = panelTestKey(key, rows, mechanism.region);
    if (local.testedMechanismMotions?.includes(trial)) return [];
    const atControl = sameBox(actor, motion.footing.contact);
    const visible = atControl && panel.buttons.some(button => sameBox(button.bbox, motion.footing.box) && button.color === motion.footing.ink);
    if (atControl) return visible && !attempted.has(key) ? [{ motion, mechanism, distance, trial, route: null }] : [];
    const route = projectPanelFooting(local.panelWalker!, rows, panel.area, inputs, motion.footing.contact, trial, budget - 1);
    return route ? [{ motion, mechanism, distance, trial, route }] : [];
  });
  return offers.sort((a, b) => a.distance - b.distance || (a.route?.route.length ?? 0) - (b.route?.route.length ?? 0))[0];
}

function translatedPiece(before: NativeRows, after: NativeRows, { point: [x, y], box: [l, t, r, b] }: ClickedControl) {
  const coversClick = ([left, top, right, bottom]: NativeBox) => x >= left && x <= right && y >= top && y <= bottom;
  const matches = measureComponentTranslations(before, after, part => part.area >= 6 && coversClick(part.bbox), part => part.area >= 6);
  const moves = matches.flatMap(({ from, to, displacement: [dx, dy] }) => {
    return (!!dx === !!dy || Math.max(Math.abs(dx), Math.abs(dy)) > Math.max(r - l + 1, b - t + 1)) ? []
      : [{ from: from.bbox, to: to.bbox, vector: `${dx},${dy}` }];
  });
  if (!moves.length || moves.some(move => move.vector !== moves[0]!.vector)) return null;
  return moves.reduce((a, b) => (b.from[2] - b.from[0] + 1) * (b.from[3] - b.from[1] + 1) >
    (a.from[2] - a.from[0] + 1) * (a.from[3] - a.from[1] + 1) ? b : a);
}

function repeatedInteriorMarkers(parts: ReturnType<typeof geometricComponents>, width: number, height: number) {
  const byColor = new Map<number, NativePoint[]>();
  for (const { area, bbox: [x, y], color } of parts) {
    if (area !== 1 || x === 0 || x === width - 1 || y === 0 || y === height - 1) continue;
    const group = byColor.get(color) ?? [];
    group.push([x, y]);
    byColor.set(color, group);
  }
  const markers = new Set<string>();
  for (const group of byColor.values()) {
    if (group.length < 8 || group.length > clickLimit) continue;
    const occupied = new Set(group.map(point => point.join(',')));
    const squares = new Map<number, string[][]>();
    for (const [x, y] of group) for (const [right, otherY] of group) {
      if (otherY !== y || right <= x) continue;
      const span = right - x, bottom = y + span;
      if (!occupied.has(`${x},${bottom}`) || !occupied.has(`${right},${bottom}`)) continue;
      const corners = [`${x},${y}`, `${right},${y}`, `${x},${bottom}`, `${right},${bottom}`];
      const matching = squares.get(span) ?? [];
      matching.push(corners);
      squares.set(span, matching);
    }
    for (const matching of squares.values()) {
      for (const corners of matching) {
        if (matching.some(other => corners.every(corner => !other.includes(corner)))) {
          for (const corner of corners) markers.add(corner);
        }
      }
    }
  }
  return markers;
}

function visibleInputs(observation: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], includeRepeated: boolean) {
  const candidates = new Map(inputs.filter(command => /^ACTION[1-5]$/.test(command.action_ref))
    .map(command => [commandKey(command), { command, box: null as NativeBox | null, marker: false, repeated: false }]));
  if (!observation.available_action_refs.includes('ACTION6')) return candidates;
  const width = rows[0]!.length, height = rows.length;
  const components = geometricComponents(rows);
  const markers = repeatedInteriorMarkers(components, width, height);
  const isMarker = ({ area, bbox: [x, y] }: typeof components[number]) => area === 1 && markers.has(`${x},${y}`);
  const toCenter = ({ bbox: [left, top, right, bottom] }: typeof components[number]) =>
    Math.abs(left + right - width + 1) + Math.abs(top + bottom - height + 1);
  const parts = components.filter(component => isMarker(component) || (component.area >= 2 && component.area * 4 < width * height))
    .sort((a, b) => Number(isMarker(b)) - Number(isMarker(a))
      || (isMarker(a) && isMarker(b) ? toCenter(a) - toCenter(b) : b.area - a.area));
  const usual = new Set(parts.slice(0, clickLimit));
  const repeated = new Set(includeRepeated ? repeatedInputTargets(parts, usual, 6) : []);
  for (const part of new Set([...parts.filter(isMarker).slice(0, clickLimit), ...repeated, ...usual])) {
    const { bbox } = part;
    const [x, y] = componentCenterPoint(part);
    const command = { action_ref: 'ACTION6', data: { x, y } };
    candidates.set(commandKey(command), { command, box: bbox, marker: isMarker(part), repeated: repeated.has(part) });
  }
  return candidates;
}

function explorationKey(observation: NativeObservation, rows: NativeRows, panel?: Proposal['panel']) {
  return panel ? commandPanelState(rows, panel, observation.available_action_refs) : interfaceKey(observation);
}

const panelPoint = (part: VisibleCommandPanel['buttons'][number]): NativeCommand => {
  const [x, y] = componentCenterPoint(part);
  return { action_ref: 'ACTION6', data: { x, y } };
};

function panelTestKey(command: string, rows: NativeRows, box: NativeBox | null | undefined) {
  if (!box || !command.startsWith('ACTION6:')) return command;
  const [left, top, right, bottom] = box;
  return `${command}:${rows.slice(top, bottom + 1).map(row => row.slice(left, right + 1).join(',')).join('/')}`;
}

export function createSicPublicInputExploration(): NativeFamily<Proposal> {
  let state = initial();
  let decide: NativeProgramHandle | undefined;
  return {
    id: publicInputExplorationId,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async propose(observation, rows, inputs, remaining, execution) {
      const local = state.epoch === observation.level_epoch ? state : initial(observation.level_epoch);
      if (remaining < 1) return null;
      const ref = observation.observation_ref;
      const nonPoint = inputs.filter(command => /^ACTION[1-5]$/.test(command.action_ref));
      const panel = nonPoint.length > 1 && observation.available_action_refs.includes('ACTION6') ? visibleCommandPanel(rows) : null;
      const budget = panel ? remaining : Math.min(remaining, explorationLimit - local.experiments);
      if (budget < 1) return null;
      const panelBounds = panel ? { area: panel.area, panel: panel.panel } : undefined;
      const source = explorationKey(observation, rows, panelBounds);
      const stationaryClicks = (local.transitions[source] ?? []).filter(edge => edge.destination === source && edge.action.startsWith('ACTION6:'));
      const stationaryCommand = nonPoint.length === 1
        ? local.transitions[source]?.find(edge => edge.action === nonPoint[0]!.action_ref && edge.destination === source) : undefined;
      const candidates = visibleInputs(observation, rows, inputs, !!stationaryCommand && stationaryClicks.length >= 4);
      const named = [...candidates.keys()].filter(key => /^ACTION[1-5]$/.test(key));
      const panelKeys = panel?.buttons.map(part => {
        const command = panelPoint(part);
        const key = commandKey(command);
        candidates.set(key, { command, box: part.bbox, marker: false, repeated: false });
        return key;
      }) ?? [];
      const presentEffects = panel && local.panelEffects?.filter(effect => panel.buttons.some(button =>
        button.color === effect.ink && sameBox(button.bbox, effect.box)));
      for (const effect of presentEffects || []) {
        candidates.set(commandKey(effect.command), { command: effect.command, box: effect.box, marker: false, repeated: false });
      }
      const verifiedEdit = local.collectionEdit?.[1] === ref ? local.collectionEdit : undefined;
      const trial = observation.available_action_refs.includes('ACTION6') && named.length === 1
        ? proposeCollectionTrial(rows, named.map(key => candidates.get(key)!.command), !!verifiedEdit) : null;
      const trialKey = trial && commandKey(trial.command);
      if (trial && trialKey) candidates.set(trialKey, { command: trial.command, box: trial.box, marker: false, repeated: false });
      const workspace = observation.available_action_refs.includes('ACTION6') && !nonPoint.length
        ? workspaceClickCandidate(observation, rows) : null;
      const workspaceCommand = workspace && { action_ref: 'ACTION6', data: { x: workspace.point[0], y: workspace.point[1] } };
      const workspaceKey = workspaceCommand && commandKey(workspaceCommand);
      if (workspace && workspaceCommand && workspaceKey) {
        candidates.set(workspaceKey, { command: workspaceCommand, box: workspace.box, marker: false, repeated: false });
      }
      const keys = [...candidates.keys()];
      const attempted = new Set(local.transitions[source]?.map(edge => edge.action));
      const testKey = (key: string) => panelTestKey(key, rows, candidates.get(key)?.box);
      const clickedControl = local.clickedControl?.destination === source ? local.clickedControl : undefined;
      const controlledPiece = local.controlledPiece?.destination === interfaceKey(observation) ? local.controlledPiece : undefined;
      const probe = clickedControl?.remaining.find(key => candidates.has(key) && !attempted.has(key));
      const canDiversifyDirection = keys.includes('ACTION5')
        || (keys.some(key => key === 'ACTION1' || key === 'ACTION2') && keys.some(key => key === 'ACTION3' || key === 'ACTION4'));
      const lastChange = local.lastChange?.destination === source && canDiversifyDirection ? local.lastChange : null;
      const deferred = lastChange ? oppositeDirection[lastChange.action] : undefined;
      const recheck = local.recheck && local.experiments < local.recheck.until ? local.recheck : null;
      const measuredControls = recheck && keys.length > named.length
        ? observedCommandFrontier(local.transitions, source, named, 1, () => named, deferred) : null;
      const preferred = trialKey && (trial?.expected === null || !local.transitions[source]?.some(edge => edge.action === trialKey))
        ? { action: trialKey, probe: trialKey, depth: 0, first: null } : null;
      const workspaceProbe = workspaceKey && !local.transitions[source]?.some(edge => edge.action === workspaceKey)
        ? { action: workspaceKey, probe: workspaceKey, depth: 0, first: null } : null;
      const pendingButton = panelKeys.find(key => !attempted.has(key) && !local.panelTests?.includes(testKey(key)));
      const pendingNonPoint = pendingButton && local.lastPanelInputWasClick
        && !execution?.readDirectionalMotion?.() ? named.find(key => !attempted.has(key) && !local.panelTests?.includes(key)) : undefined;
      const variedInput = pendingNonPoint || pendingButton;
      const panelProbe = variedInput ? { action: variedInput, probe: variedInput, depth: 0, first: null } : null;
      const directionalProbe = panel && local.lastPanelInputWasClick
        ? observedCommandFrontier(local.transitions, source, named, 1, () => named, deferred) : null;
      const marker = local.panelMarker?.observation === ref ? local.panelMarker.trial : undefined;
      const actor = marker && panel && local.panelWalker && panelActor(local.panelWalker, rows, panel.area);
      const markerAction = marker && commandKey(marker.control.command);
      const comparison = actor && markerAction && sameBox(actor, marker.marker) && !attempted.has(markerAction)
        && presentEffects?.some(effect => effect.ink === marker.control.ink && commandKey(effect.command) === markerAction) ? marker : null;
      const newControl = local.revealedPanelControl?.observation === ref ? local.revealedPanelControl
        : local.revealedPanelControls?.find(item => !attempted.has(commandKey(item.command)) && panel?.buttons.some(button =>
          sameBox(button.bbox, item.box) && button.color === item.ink));
      const retestedControl = !newControl && panel && Object.values(local.animatedPanelControls ?? {}).find(item => {
        const key = commandKey(item.control.command);
        return !item.changedAtDock && panelKeys.includes(key) && !attempted.has(key) && panel.buttons.some(button => sameBox(button.bbox, item.control.box))
          && !item.tested.includes(panelTestKey(key, rows, item.region));
      });
      const reveal = newControl || retestedControl && retestedControl.control;
      const revealKey = reveal && commandKey(reveal.command);
      const revealedControl = revealKey && panelKeys.includes(revealKey) && !attempted.has(revealKey) ? reveal : undefined;
      const mechanism = !revealedControl && !comparison && panel ? alignPanelMechanism(local, panel, rows, nonPoint, attempted, budget) : undefined;
      const mechanismMove = mechanism && !mechanism.route ? { motion: mechanism.motion, trial: mechanism.trial } : undefined;
      const phaseCache = new Map<NativeBox, TerrainProjection | null>();
      const phaseFor = (marker: NativeBox) => {
        if (!panel || !local.panelWalker || !local.panelPrograms?.length) return null;
        if (phaseCache.has(marker)) return phaseCache.get(marker)!;
        const projections = Object.values(local.panelTerrain ?? {}).flatMap(model => {
          const key = commandKey(model.command);
          if (!presentEffects || !presentEffects.some(effect => commandKey(effect.command) === key)) return [];
          const approach = projectPanelTerrain(local.panelWalker!, rows, panel.area, nonPoint, model, marker, budget - 1);
          if (!approach || approach.change && attempted.has(commandKey(approach.change.command))) return [];
          return [approach];
        });
        const chosen = projections.sort((left, right) => left.distance - right.distance)[0] ?? null;
        phaseCache.set(marker, chosen);
        return chosen;
      };
      const composed = !mechanism && !revealedControl && !comparison && panel && local.panelPrograms?.length && presentEffects
        ? phasedMarker(local, presentEffects, rows, panel.area, phaseFor) : undefined;
      const verifyTransport = Object.values(local.animatedPanelControls ?? {}).some(control => control.held && !control.transport);
      const contact = mechanism?.route ?? (!mechanism && !composed && !revealedControl && !comparison && panel && local.panelWalker && local.panelArrival
        ? projectPanelContact(local.panelWalker, rows, panel.area, panel.fieldInk, nonPoint, local.testedPanelContacts ?? [], budget, verifyTransport)
        : null);
      const portalEffects = presentEffects && presentEffects.filter(effect => !local.panelPrograms?.some(program =>
        commandKey(program.selector.command) === commandKey(effect.command)));
      const directMarkerRoute = !mechanism && !revealedControl && !comparison && !contact && panel && local.panelWalker && portalEffects?.length
        ? projectPanelMarker(local.panelWalker, rows, panel.area, nonPoint, portalEffects, local.testedPanelMarkers ?? [], budget, local.panelSources)
        : null;
      const markerRoute = directMarkerRoute ?? (composed?.path.route.length ? { target: composed.target,
        route: composed.path.route, evidence: composed.path.evidence } : null);
      const programme = !mechanism && !contact && !revealedControl && !comparison && panel && local.panelWalker && presentEffects?.length
        ? selectMarkerProgram(local, presentEffects, rows, panel.area, attempted, nonPoint, budget, phaseFor) : undefined;
      const boundGoal = markerRoute?.target ?? composed?.target;
      const programming = programme && (!boundGoal || boundGoal.peer
        && gap(boundGoal.marker, boundGoal.peer) > programme.distance) ? programme : undefined;
      const approach = programming ? null : markerRoute;
      const walk = contact ?? approach;
      const terrainStep = !walk && !programming ? composed?.path.change : undefined;
      const unmeasured = !mechanism && !walk && !revealedControl && !comparison && !programming && !terrainStep && local.panelArrival
        ? named.find(key => /^ACTION[1-4]$/.test(key) && !local.panelWalker?.controls[key] && !attempted.has(key)) : undefined;
      const terrain = !mechanism && !walk && !revealedControl && !comparison && !terrainStep && !unmeasured && local.panelArrival && presentEffects
        ? presentEffects.find(effect => effect.affected && !attempted.has(commandKey(effect.command))
          && !local.animatedPanelControls?.[commandKey(effect.command)]?.held
          && !local.panelPrograms?.some(program => commandKey(program.selector.command) === commandKey(effect.command))
          && !local.testedPanelTerrain?.includes(terrainTestKey(rows, effect))) : undefined;
      const contextualCommand = revealedControl ? revealKey : comparison ? markerAction
        : walk ? commandKey(walk.route[0]!.command) : mechanismMove ? commandKey(mechanismMove.motion.footing.command)
          : programming ? commandKey(programming.program.selector.command)
          : terrainStep ? commandKey(terrainStep.command) : unmeasured ?? (terrain ? commandKey(terrain.command) : null);
      const frontier = contextualCommand ? { action: contextualCommand, probe: contextualCommand, depth: walk?.route.length ?? 0, first: null }
        : probe ? { action: probe, probe, depth: 0, first: null }
        : measuredControls ?? preferred ?? workspaceProbe ?? panelProbe ?? directionalProbe
          ?? observedCommandFrontier(local.transitions, source, keys, budget,
          board => board === source ? keys : local.options[board] ?? [], deferred);
      const offer = frontier && candidates.get(frontier.action);
      if (!offer) return null;
      const collectionTrial = frontier === preferred ? trial : null;
      const workspaceTrial = frontier === workspaceProbe ? workspace : null;
      const panelTest = frontier === panelProbe;
      const verifiedContextChange = !contextualCommand && recheck && !probe && !collectionTrial && !workspaceTrial && named.includes(frontier.action)
        ? recheck.evidence : null;
      const repeatedTarget = frontier.depth === 0 && offer.repeated;
      const proof: [string, ...string[]] = [ref, ...(frontier.first ? [frontier.first.evidence] : []),
        ...(repeatedTarget && stationaryCommand ? [stationaryCommand.evidence, ...stationaryClicks.slice(-4).map(edge => edge.evidence)] : []),
        ...(clickedControl && probe ? [clickedControl.evidence] : []),
        ...(collectionTrial && verifiedEdit ? [verifiedEdit[0]] : []),
        ...(controlledPiece ? controlledPiece.evidence.filter(item => item !== ref) : []),
        ...(deferred && lastChange ? [lastChange.evidence] : []), ...(verifiedContextChange ?? []),
        ...(approach ? [approach.target.control.evidence, ...approach.evidence] : []), ...(comparison ? [comparison.control.evidence] : []),
        ...(contact ? [local.panelArrival!, ...contact.evidence] : []),
        ...(revealedControl ? [revealedControl.before, revealedControl.observation] : []),
        ...(retestedControl ? [retestedControl.evidence] : []), ...(terrain && !programming ? [terrain.evidence] : []),
        ...(approach?.target.link ? [approach.target.link] : []), ...(comparison?.link ? [comparison.link] : []),
        ...(programming ? [programming.program.evidence, programming.program.source.evidence] : []),
        ...(terrainStep && composed ? [...composed.path.evidence, composed.target.link!] : []),
        ...(mechanism ? [mechanism.motion.evidence, mechanism.mechanism.evidence] : []),
        ...(unmeasured ? [local.panelArrival!] : [])];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        clickedControl: { value: !!probe, evidence: proof },
        changedControlContext: { value: !!measuredControls, evidence: proof },
        markedEdit: { value: !!collectionTrial?.expected, evidence: proof },
        verifiedEdit: { value: collectionTrial?.expected === null, evidence: proof },
        workspaceTarget: { value: !!workspaceTrial, evidence: proof },
        repeatedMarker: { value: frontier.depth === 0 && offer.marker, evidence: proof },
        repeatedTarget: { value: repeatedTarget, evidence: proof },
        untestedHere: { value: frontier.depth === 0, evidence: proof },
        observedRoute: { value: frontier.depth > 0, evidence: proof },
      }, planners: { P05: () => offer, recheck_controls_after_change: () => offer, test_marked_edit: () => offer,
        test_edited_collection: () => offer, test_workspace_target: () => offer, test_repeated_marker: () => offer, test_repeated_target: () => offer,
        compare_public_input: () => offer, revisit_input_frontier: () => offer } });
      if (!selected) return null;
      const { command, box } = selected.plan;
      const mode = verifiedContextChange ? execution?.reasoningMode ?? 'exploration' : 'exploration';
      const routeSupported = !!frontier.first || !!walk;
      const facts = { eligibleProbe: !routeSupported, routeSupported, knownInteraction: false, mode };
      const decision = verifiedContextChange || contextualCommand
        ? await decide?.run({ situation: facts }, { signal: execution?.signal }) : undefined;
      if ((verifiedContextChange || contextualCommand) && decision?.result !== (routeSupported ? 'P07' : 'P05')) return null;
      const strategy = decision ? (routeSupported ? 'P07' : 'P05') : selected.id;
      const label = mechanism ? (mechanismMove ? 'Use the measured movement that brings the tool closer to the support'
        : 'Return to the footing that enabled the measured movement')
        : contact ? 'Explore the new landing and test contact with an object at the edge of the known floor'
        : revealedControl ? (retestedControl ? 'Retest the command after the animated piece changes' : 'Test the panel command that appeared after contact')
        : programming ? 'Test a selector that gave the source marker the same pattern as a new destination'
        : terrainStep ? 'Advance the measured terrain phase to open the next section of the route'
        : unmeasured ? 'Measure an available direction at the new landing before changing the terrain'
        : terrain ? 'Test the terrain control from a newly observed configuration'
        : approach ? 'Follow the measured terrain to test a panel control from a matching marker'
        : comparison ? 'Test the same panel control while the moving piece covers the matching marker'
        : decision
        ? (routeSupported ? publicInputStrategies.P07 : 'Recheck an available control after the visible interface changes')
        : panelTest && command.action_ref === 'ACTION6' ? 'Test a distinct control on the visible panel'
          : panelTest ? 'Compare a non-point command with the tested panel controls' : publicInputStrategies[selected.id];
      const goal = { kind: 'learn_public_command_effect', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['current_public_interface'], parentObjective: completion, satisfactionContract: 'observe_public_return_to_available_input' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence: proof };
      const id = `public-input:${need.id}`, actions = walk ? walk.route.map(step => step.command) : [command];
      const witness = command.action_ref === 'ACTION6'
        ? await ObservedInputDomain.makeLocusWitness(observation, rows, [command.data.x!, command.data.y!], { reason: label, evidence: proof })
        : null;
      return {
        status: 'proposed', kind: publicInputExplorationId, actions, source, candidates: keys, needId: need.id,
        ...(panelBounds ? { panel: panelBounds } : {}), ...(panelTest ? { panelTest: testKey(frontier.action) } : {}),
        ...(clickedControl && probe ? { clickedControl } : {}), ...(box && !offer.marker ? { selectedBox: box } : {}),
        ...(collectionTrial ? { collectionTrial } : {}),
        ...(workspaceTrial ? { workspaceTrial: workspaceTrial.workspace } : {}),
        ...(approach ? { panelApproach: approach } : {}), ...(comparison ? { panelComparison: comparison } : {}),
        ...(contact ? { panelContact: contact } : {}), ...(revealedControl ? { revealedControl } : {}),
        ...(revealedControl && retestedControl ? { retestedControl } : {}),
        ...(terrainStep ? { terrainStep } : {}),
        ...(mechanismMove ? { mechanismMove } : {}),
        ...(frontier.first?.destination ? { expected: frontier.first.destination } : {}),
        steps: walk ? walk.route.map(step => ({ action: step.command, expected_after: step.to }))
          : [{ action: command, expected_after: null, ...(witness ? { point_binding: witness } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        ...(decision ? { sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: { ...facts, stage: mechanism ? (mechanismMove ? 'align_panel_mechanism' : 'reach_mechanism_control')
            : contact ? 'test_contact_after_landing' : revealedControl ? 'test_revealed_control'
            : programming ? 'test_marker_selector' : terrainStep ? 'advance_measured_terrain'
              : unmeasured ? 'calibrate_at_landing' : terrain ? 'test_terrain_configuration'
              : approach ? 'approach_marker' : comparison ? 'compare_on_marker' : 'recheck' } } } : {}),
        sicSituationCard: { strategy, need: 'Learn how to act on the current board', mode,
          situation: !contextualCommand && deferred && frontier.depth === 0 && frontier.probe !== deferred
            ? 'The last direction changed the board. Test another input before trying its opposite.'
            : label, agenda: decision ? [] : entries, evidence: proof, ...(box ? { addressedRegion: box } : {}),
          ...(decision ? { triggerCard: decision.receipt.workflow } : {}),
          ...(clickedControl && probe ? { focus: clickedControl.box } : {}),
          ...(workspaceTrial ? { workspace: workspaceTrial.workspace, example: workspaceTrial.example } : {}),
          ...(approach || comparison ? { marker: (approach?.target ?? comparison)!.marker,
            control: (approach?.target ?? comparison)!.control.box } : {}),
          ...(contact || revealedControl ? { contact: contact?.target.box ?? revealedControl!.contact } : {}),
          ...(revealedControl && retestedControl ? { animatedMechanism: retestedControl.region,
            animatedMechanismFrames: retestedControl.frames } : {}),
          ...(mechanism ? { animatedMechanism: mechanism.mechanism.region, dockingSupport: mechanism.mechanism.dock } : {}),
          ...(terrainStep || terrain && !programming ? { affectedSupport: terrainStep?.region ?? terrain!.affected } : {}),
          ...(programming ? { marker: programming.program.source.marker, projectedPeer: programming.peer }
            : terrainStep && composed ? { marker: composed.target.marker, projectedPeer: composed.target.peer }
              : approach?.target.peer || comparison?.peer ? { projectedPeer: (approach?.target ?? comparison)!.peer } : {}),
          ...(controlledPiece ? { lastControlledMotion: controlledPiece } : {}) },
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${completion}`] }],
        question: { reason: label, hypothesis_refs: proof }, route_refs: proof,
        sicLocalDecision: { strategy,
          objective: { id, label: probe ? navigationPrimitives.P05 : label, parent: completion }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: completion, purpose: label,
          evidence: proof, preconditions: {}, preserve_refs: [], actions, outcome_guard: { path: ['value'], contains: id } },
      };
    },
    observePublicOutcome(before, after, command, rows, afterRows) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state
        || !before.available_action_refs.includes('ACTION6') || before.available_action_refs.filter(action => /^ACTION[1-5]$/.test(action)).length < 2) return;
      const panel = visibleCommandPanel(rows);
      if (!panel) return;
      if (state.epoch !== before.level_epoch) state = initial(before.level_epoch);
      const source = explorationKey(before, rows, panel), destination = explorationKey(after, afterRows, panel);
      const action = commandKey(command);
      state.options[source] ??= [...before.available_action_refs.filter(key => /^ACTION[1-5]$/.test(key)),
        ...panel.buttons.map(part => commandKey(panelPoint(part)))];
      rememberCommandReturn(state.transitions, source, destination, action, after.observation_ref, null);
      state.lastPanelContext = destination;
      state.lastPanelInputWasClick = command.action_ref === 'ACTION6';
      retainPanelEffect(state, panel, command, rows, afterRows, after.observation_ref, !!state.panelArrival);
      const marker = state.panelMarker;
      if (marker?.observation === before.observation_ref && commandKey(marker.trial.control.command) === action) {
        finishPanelTrial(state, marker.trial.key);
      }
    },
    before(proposal, index, packet, observation) {
      if (proposal.terrainStep && proposal.panel && state.panelWalker) {
        const step = proposal.terrainStep, actor = panelActor(state.panelWalker, packet.frame_rows, proposal.panel.area);
        const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref
          && !!actor && sameBox(actor, step.actor) && matchesPanelTerrain(packet.frame_rows, step.region, step.before, actor);
        return { admitted, reason: admitted ? 'measured_terrain_phase_bound' : 'measured_terrain_phase_changed' };
      }
      const step = (proposal.panelApproach ?? proposal.panelContact)?.route[index];
      if (step && proposal.panel && state.panelWalker) {
        const actor = panelActor(state.panelWalker, packet.frame_rows, proposal.panel.area);
        const admitted = !!actor && sameBox(actor, step.from) && sameLandingPixels(step.landing, packet.frame_rows);
        return { admitted, reason: admitted ? 'panel_walk_step_bound' : 'panel_walk_step_changed' };
      }
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_public_input_bound' : 'public_input_scope_changed' };
    },
    after(proposal, index, before, after, rows, afterRows) {
      const scored = after.levels_completed > before.levels_completed;
      if (!scored && proposal.terrainStep && proposal.panel && state.panelWalker) {
        const step = proposal.terrainStep, actor = panelActor(state.panelWalker, afterRows, proposal.panel.area);
        const matched = !!actor && sameBox(actor, step.actor) && matchesPanelTerrain(afterRows, step.region, step.after, actor);
        return { matched, seal_prefix: true, reason: matched ? 'measured_terrain_phase_confirmed' : 'measured_terrain_phase_contradicted' };
      }
      const walk = proposal.panelApproach ?? proposal.panelContact;
      if (!scored && proposal.panel && state.panelWalker && (walk || proposal.panelComparison || proposal.revealedControl)) {
        if (proposal.revealedControl) {
          const changed = changedWithin(rows, afterRows, proposal.panel.area)
            || changedWithin(rows, afterRows, proposal.panel.panel);
          return { matched: null, seal_prefix: true,
            reason: changed ? 'revealed_control_changed_visible_state' : 'revealed_control_left_visible_state_unchanged' };
        }
        const actor = panelActor(state.panelWalker, afterRows, proposal.panel.area);
        if (walk) {
          const { route } = walk, matched = !!actor && sameBox(actor, route[index]!.to);
          const contact = proposal.panelContact && sameBox(route[index]!.to, proposal.panelContact.target.box);
          const changedPanel = matched && changedWithin(rows, afterRows, proposal.panel.panel);
          return { matched, seal_prefix: !matched || changedPanel || index + 1 === route.length,
            reason: contact ? (matched ? 'panel_boundary_contact_reached' : 'panel_boundary_contact_blocked')
              : changedPanel ? 'panel_command_context_changed_during_walk'
                : (matched ? 'panel_walk_step_confirmed' : 'panel_walk_step_contradicted') };
        }
        return { matched: null, seal_prefix: true, reason: actor && !sameBox(actor, proposal.panelComparison!.marker)
          ? 'panel_control_displaced_piece_from_marker' : 'panel_control_displacement_not_confirmed_at_marker' };
      }
      const expected = proposal.collectionTrial?.expected;
      const matched = !scored && expected ? matchesCollectionEdit(afterRows, expected)
        : !scored && proposal.workspaceTrial ? !!countChangesInside(rows, afterRows, proposal.workspaceTrial)
        : !scored && proposal.expected ? proposal.expected === explorationKey(after, afterRows, proposal.panel) : null;
      return { matched, seal_prefix: true, reason: scored ? 'official_boundary'
        : expected ? (matched ? 'collection_edit_confirmed' : 'collection_edit_contradicted')
          : proposal.workspaceTrial ? (matched ? 'workspace_changed_with_example_preserved' : 'workspace_change_unconfirmed')
          : matched === false ? 'public_transition_contradicted'
            : proposal.panelTest && proposal.panel ? (changedWithin(rows, afterRows, proposal.panel.area)
              ? 'input_changed_playing_surface' : 'input_left_playing_surface_unchanged') : 'observed_public_input_return',
        ...(scored ? { sic_need: { id: proposal.needId, status: 'satisfied' } } : {}) };
    },
    record(before, after, command, rows, afterRows, proposal, index, frames) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      if (state.epoch !== before.level_epoch) state = initial(before.level_epoch);
      state.experiments++;
      const expected = proposal.collectionTrial?.expected;
      delete state.collectionEdit;
      if (expected && matchesCollectionEdit(afterRows, expected)) state.collectionEdit = [before.observation_ref, after.observation_ref];
      const source = index === 0 ? proposal.source : explorationKey(before, rows, proposal.panel);
      state.options[source] = proposal.candidates;
      const destination = explorationKey(after, afterRows, proposal.panel), action = commandKey(command);
      const panel = proposal.panel ? visibleCommandPanel(rows) : null;
      if (proposal.panel) {
        state.lastPanelContext = destination;
        state.lastPanelInputWasClick = command.action_ref === 'ACTION6';
        if (panel) retainPanelEffect(state, panel, command, rows, afterRows, after.observation_ref, true);
        const effect = state.panelArrival && command.action_ref === 'ACTION6'
          ? state.panelEffects?.find(item => item.affected && commandKey(item.command) === action) : undefined;
        if (effect) {
          state.testedPanelTerrain = [...new Set([...(state.testedPanelTerrain ?? []), terrainTestKey(rows, effect)])];
          retainMarkerPrograms(state, effect, rows, afterRows, after.observation_ref);
        }
        const visibleEffect = effect ?? state.panelEffects?.find(item => item.affected && commandKey(item.command) === action);
        if (visibleEffect?.affected && panel && state.panelWalker && (proposal.panelTest || state.panelArrival)) {
          const beforeActor = panelActor(state.panelWalker, rows, panel.area);
          const afterActor = panelActor(state.panelWalker, afterRows, panel.area);
          const measured = panelChangeBounds(rows, afterRows, panel.area);
          const phase = state.panelTerrain?.[action];
          if (proposal.terrainStep && phase
            && (!afterActor || !sameBox(afterActor, proposal.terrainStep.actor)
              || !matchesPanelTerrain(afterRows, phase.region, proposal.terrainStep.after, afterActor))) {
            const source = proposal.terrainStep.before;
            phase.returns = phase.returns.map(edge => edge.before.every((ink, i) => ink === source[i]) ? { ...edge, after: null } : edge);
          } else if (beforeActor && afterActor && sameBox(beforeActor, afterActor)
            && (!measured || containsBox(visibleEffect.affected, measured))) {
            const learned = rememberPanelTerrain(phase, command, visibleEffect.affected, beforeActor, rows, afterRows, after.observation_ref);
            if (learned) (state.panelTerrain ??= {})[action] = learned;
          }
        }
      }
      if (proposal.panelTest) {
        state.panelTests = [...new Set([...(state.panelTests ?? []), proposal.panelTest])];
      }
      let motionReceipt: ControlledMotion | undefined;
      if (/^ACTION[1-4]$/.test(action)) {
        const playable: NativeBox = [1, 1, rows[0]!.length - 2, rows.length - 2];
        if (changedWithin(rows, afterRows, playable)) state.directionHadLocalEffect = true;
        const tested = state.testedDirections ?? [];
        if (!tested.includes(action)) state.testedDirections = [...tested, action];
      }
      delete state.clickedControl;
      if (proposal.clickedControl) {
        const { box, point, evidence, remaining } = proposal.clickedControl;
        const motion = translatedPiece(rows, afterRows, proposal.clickedControl);
        if (motion) {
          motionReceipt = { from: motion.from, to: motion.to, command: action, evidence: [evidence, after.observation_ref],
            destination: interfaceKey(after) };
          state.controlledPiece = motionReceipt;
        }
        else if (remaining.length > 1 && !changedWithin(rows, afterRows, box)) {
          state.clickedControl = { box, point, evidence, remaining: remaining.filter(key => key !== action), destination };
        }
      } else if (proposal.selectedBox && !state.directionHadLocalEffect && state.testedDirections?.length === 4
        && changedWithin(rows, afterRows, proposal.selectedBox)) {
        state.clickedControl = { box: proposal.selectedBox, point: [command.data.x!, command.data.y!], remaining: state.testedDirections,
          evidence: after.observation_ref, destination };
      }
      if (!state.recheck && action === 'ACTION5' && destination !== proposal.source) {
        const directions = proposal.candidates.filter(key => /^ACTION[1-4]$/.test(key));
        const evidence = stationaryCommandEvidence(state.transitions, proposal.source, directions);
        if (evidence) state.recheck = {
          until: state.experiments + directions.length * 3, evidence: [...evidence, after.observation_ref],
        };
      }
      rememberCommandReturn(state.transitions, source, destination, action, after.observation_ref, proposal.panel ? null : undefined);
      state.lastChange = destination === source ? null : { destination, action, evidence: after.observation_ref };
      const events: NativeRecord[] = motionReceipt ? [{ kind: 'sic_selected_piece_motion', ...motionReceipt }] : [];
      let reviewEvidence: string | undefined;
      if (proposal.panel && action.startsWith('ACTION6:')) {
        for (const item of Object.values(state.animatedPanelControls ?? {})) {
          if (!item.held) continue;
          const transfer = measurePanelTransport(rows, afterRows, proposal.panel.area, item.held);
          if (!transfer) continue;
          item.held = { tool: transfer.tool, support: transfer.support };
          item.transport = after.observation_ref;
          events.push({ kind: 'sic_panel_tool_carried_support', command: action, delta: transfer.delta,
            tool: transfer.tool, support: transfer.support, evidence: [before.observation_ref, after.observation_ref] });
          reviewEvidence = 'The tool and its support moved by the same measured displacement.';
        }
      }
      if (proposal.mechanismMove) {
        state.testedMechanismMotions = [...new Set([...(state.testedMechanismMotions ?? []), proposal.mechanismMove.trial])];
      }
      if (proposal.panel && state.panelWalker && (proposal.panelApproach || proposal.panelComparison)) {
        const actor = panelActor(state.panelWalker, afterRows, proposal.panel.area);
        const trial = proposal.panelApproach?.target ?? proposal.panelComparison!;
        const step = proposal.panelApproach?.route[index];
        if (!step || !actor || !sameBox(actor, step.to)) {
          finishPanelTrial(state, trial.key);
        } else if (sameBox(actor, trial.marker)) {
          if (state.transitions[destination]?.some(edge => edge.action === commandKey(trial.control.command))) {
            finishPanelTrial(state, trial.key);
          } else state.panelMarker = { trial, observation: after.observation_ref };
        }
        if (proposal.panelComparison) {
          const displaced = !!actor && !sameBox(actor, trial.marker);
          if (displaced) {
            state.panelArrival = after.observation_ref;
            const sources = state.panelSources ??= [];
            if (!sources.some(source => source.command === action && sameBox(source.marker, trial.marker))) {
              sources.push({ marker: trial.marker, command: action, evidence: after.observation_ref });
            }
            const destinations = state.panelDestinations ??= [];
            if (!destinations.some(destination => sameBox(destination, actor))) destinations.push(actor);
          }
          events.push({ kind: 'sic_panel_control_marker_return', command: action,
            marker: trial.marker, control: trial.control.box, destination: actor ?? null, displaced,
            evidence: [trial.control.evidence, before.observation_ref, after.observation_ref] });
        }
      }
      if (proposal.panel && state.panelWalker && proposal.panelContact) {
        const { target, route } = proposal.panelContact;
        const actor = panelActor(state.panelWalker, afterRows, proposal.panel.area);
        const followed = !!actor && sameBox(actor, route[index]!.to);
        const reached = followed && sameBox(actor, target.box);
        if (!followed || reached) state.testedPanelContacts = [...new Set([...(state.testedPanelContacts ?? []), target.key])];
        if (followed && after.available_action_refs.includes('ACTION6')) {
          const buttons = newlyVisibleControls(panel, afterRows);
          if (buttons.length) {
            const controls = state.revealedPanelControls ??= [];
            for (const button of buttons) {
              const command = panelPoint(button);
              if (!controls.some(item => commandKey(item.command) === commandKey(command) && item.ink === button.color)) {
                controls.push({ command, box: button.bbox, contact: actor, ink: button.color,
                  before: before.observation_ref, observation: after.observation_ref });
              }
            }
            events.push({ kind: 'sic_panel_contact_revealed_controls', contact: actor, controls: buttons.map(button => button.bbox),
              evidence: [before.observation_ref, after.observation_ref] });
            reviewEvidence = buttons.length === 1 ? 'Contact with the object revealed a new panel command.'
              : `Contact with the object revealed ${buttons.length} new panel commands.`;
          }
        }
      }
      if (proposal.revealedControl) {
        delete state.revealedPanelControl;
        if (state.revealedPanelControls) state.revealedPanelControls = state.revealedPanelControls.filter(item =>
          commandKey(item.command) !== action || item.ink !== proposal.revealedControl!.ink);
        if (proposal.panel) {
          const changed = changedWithin(rows, afterRows, proposal.panel.area) || changedWithin(rows, afterRows, proposal.panel.panel);
          if (changed && !proposal.retestedControl) for (const [tool, item] of Object.entries(state.animatedPanelControls ?? {})) {
            const delta = panelToolTranslation(rows, afterRows, proposal.panel.area, item.region);
            if (!delta) continue;
            const motions = state.panelMechanismMotions ??= [];
            const known = motions.find(motion => motion.tool === tool && commandKey(motion.footing.command) === action
              && sameBox(motion.footing.contact, proposal.revealedControl!.contact));
            if (known) {
              if (known.delta?.some((value, i) => value !== delta[i])) known.delta = null;
            } else motions.push({ footing: proposal.revealedControl, delta, tool, evidence: after.observation_ref });
          }
          const animation = !changed ? measureReturningAnimation(rows, afterRows, frames, proposal.panel.area) : undefined;
          const known = proposal.retestedControl;
          const region = animation?.box ?? known?.region;
          if (region) {
            const controls = state.animatedPanelControls ??= {};
            const tested = known && sameBox(known.region, region) ? known.tested : [];
            const dock = known?.dock ?? (animation && findPanelDock(rows, proposal.panel.area, region));
            const aligned = known?.dock && changed ? centeredToolRegion(known.region, known.dock) : undefined;
            const held = aligned && changedWithin(rows, afterRows, aligned) ? measureAlignedTool(afterRows, proposal.panel.area, aligned) : undefined;
            const changedAtDock = held ? after.observation_ref : known?.changedAtDock;
            controls[action] = { control: proposal.revealedControl, region: held?.tool ?? region, frames: animation?.frames ?? known!.frames,
              evidence: animation ? after.observation_ref : known!.evidence,
              ...(dock ? { dock } : {}), ...(changedAtDock ? { changedAtDock } : {}),
              ...(held ? { held } : {}),
              tested: [...new Set([...tested, panelTestKey(action, rows, region)])] };
          }
          events.push({ kind: 'sic_panel_revealed_control_return', command: action,
            contact: proposal.revealedControl.contact, control: proposal.revealedControl.box,
            changed, ...(animation ? { animation } : {}), evidence: [before.observation_ref, after.observation_ref] });
          reviewEvidence ??= animation ? `The piece flashed in frames ${animation.frames.join(', ')} and returned to its starting appearance.`
            : changed ? 'The new control changed the visible state.' : 'The tested control left the visible state unchanged.';
        }
      }
      if (proposal.panel && proposal.panelTest && command.action_ref === 'ACTION6') {
        const { area } = proposal.panel;
        const translations = measureComponentTranslations(rows, afterRows, part => part.area >= 4 && part.area < 256
          && part.bbox[0] >= area[0] && part.bbox[1] >= area[1] && part.bbox[2] <= area[2] && part.bbox[3] <= area[3]);
        if (translations.length) events.push({ kind: 'sic_panel_control_translation', command: action,
          translations: translations.map(({ from, to, displacement }) => ({ from: from.bbox, to: to.bbox, displacement })),
          evidence: [before.observation_ref, after.observation_ref] });
      }
      return { events, ...(reviewEvidence ? { reviewEvidence } : {}) };
    },
    state: () => ({ ...state }),
    restore(value: NativeRecord) { state = structuredClone(value as State); },
  };
}
