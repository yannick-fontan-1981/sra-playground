import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { measureComponentTranslations } from './observed-translation.ts';
import { observedCommandKey } from './observed-command-frontier.ts';
import { bindTranslationLanding, maximumCommittedActions, type MeasuredLanding } from './plan-step.ts';

type Translation = { delta: NativePoint; evidence: string };
export type PanelWalker = { ink: number; floor: number; controls: Record<string, Translation>;
  floorReturns?: Record<string, string>; contacts?: Record<string, { patch: string; evidence: string }> };
export type PanelEffect = { command: NativeCommand; box: NativeBox; ink: number; evidence: string; affected?: NativeBox };
export type PanelMarkerTrial = { key: string; marker: NativeBox; control: PanelEffect; link?: string; peer?: NativeBox };
export type KnownPanelSource = { marker: NativeBox; command: string; evidence: string };
export type PanelContact = { key: string; box: NativeBox };
type RouteStep = { command: NativeCommand; from: NativeBox; to: NativeBox; landing: MeasuredLanding };
type WalkProjection<T> = { target: T; route: RouteStep[]; evidence: string[] };
type TerrainReturn = { before: number[]; after: number[] | null; evidence: string };
export type PanelTerrain = { command: NativeCommand; region: NativeBox; returns: TerrainReturn[] };
export type PanelTerrainStep = { command: NativeCommand; actor: NativeBox; region: NativeBox; before: number[]; after: number[] };
export type TerrainProjection = { distance: number; evidence: string[]; route: RouteStep[]; change?: PanelTerrainStep };

export const containsBox = (outer: NativeBox, inner: NativeBox) =>
  outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3];
export const sameBox = (left: NativeBox, right: NativeBox) => left.every((value, i) => value === right[i]);
const footprint = (x: number, y: number): NativeBox => [x, y, x + 1, y + 1];
const tile = (rows: NativeRows, [x, y, r, b]: NativeBox) =>
  [rows[y]?.[x], rows[y]?.[r], rows[b]?.[x], rows[b]?.[r]];
const place = (box: NativeBox) => box.slice(0, 2).join(',');
const alternatingCode = ([a, b, c, d]: ReturnType<typeof tile>) =>
  a !== undefined && b !== undefined && a === d && b === c && a !== b ? [Math.min(a, b), Math.max(a, b)].join(',') : undefined;
export const panelMarkerCode = (rows: NativeRows, box: NativeBox) => alternatingCode(tile(rows, box));
export const panelMarkerTrialKey = (command: NativeCommand, box: NativeBox, code: string) =>
  `${command.data.x},${command.data.y}:${place(box)}:${code}`;

export function matchingPanelMarker(rows: NativeRows, field: NativeBox, source: NativeBox, code: string): NativeBox | undefined {
  let match: NativeBox | undefined;
  for (let y = field[1] + (source[1] - field[1]) % 2; y < field[3]; y += 2) {
    for (let x = field[0] + (source[0] - field[0]) % 2; x < field[2]; x += 2) {
      const box = footprint(x, y);
      if (sameBox(box, source) || panelMarkerCode(rows, box) !== code) continue;
      if (match) return;
      match = box;
    }
  }
  return match;
}

export function panelActor(walker: PanelWalker, rows: NativeRows, field: NativeBox): NativeBox | undefined {
  const candidates = geometricComponents(rows).filter(part => part.color === walker.ink && part.rectangular && part.area === 4
    && part.bbox[2] - part.bbox[0] === 1 && containsBox(field, part.bbox));
  return candidates.length === 1 ? candidates[0]!.bbox : undefined;
}

/** Calibrate a movement from an isolated rigid displacement and its uncovered floor. */
export function learnPanelDirection(previous: PanelWalker | undefined, field: NativeBox, command: string,
  before: NativeRows, after: NativeRows, evidence: string): PanelWalker | undefined {
  if (previous?.controls[command]) return previous;
  const shifts = measureComponentTranslations(before, after, part => part.rectangular && part.area === 4
    && part.bbox[2] - part.bbox[0] === 1 && containsBox(field, part.bbox)
    && (!previous || previous.ink === part.color));
  const movements = shifts.filter(({ displacement: [dx, dy] }) => Math.abs(dx) === 2 && dy === 0 || Math.abs(dy) === 2 && dx === 0);
  if (movements.length !== 1) return previous;
  const { from, to, displacement } = movements[0]!;
  const uncovered = tile(after, from.bbox), approach = tile(before, to.bbox);
  const floor = previous?.floor ?? uncovered[0];
  if (floor === undefined || floor === from.color || !uncovered.every(ink => ink === floor) || !approach.every(ink => ink === floor)) return previous;
  return { ...previous, ink: from.color, floor, controls: { ...previous?.controls, [command]: { delta: displacement, evidence } } };
}

function supportEvidence(walker: PanelWalker, box: NativeBox, patch: ReturnType<typeof tile>) {
  if (patch.every(ink => ink === patch[0])) {
    if (patch[0] === walker.floor) return true;
    if (patch[0] !== undefined && walker.floorReturns?.[patch[0]]) return walker.floorReturns[patch[0]];
  }
  const contact = walker.contacts?.[place(box)];
  return contact?.patch === patch.join(',') ? contact.evidence : false;
}

/** Only a witnessed translation can add support beyond the floor first measured. */
export function learnPanelTerrain(walker: PanelWalker, field: NativeBox, fieldInk: number,
  command: string, before: NativeRows, after: NativeRows, evidence: string): PanelWalker {
  const motion = walker.controls[command];
  const source = motion && panelActor(walker, before, field);
  if (!source) return walker;
  const next = footprint(source[0] + motion.delta[0], source[1] + motion.delta[1]);
  const patch = tile(before, next);
  if (!containsBox(field, next) || supportEvidence(walker, next, patch)
    || !tile(after, next).every(ink => ink === walker.ink)) return walker;
  const moved = panelActor(walker, after, field);
  if (!moved || !sameBox(moved, next)) return walker;
  const color = patch[0];
  if (color !== undefined && color !== fieldInk && color !== walker.ink && patch.every(ink => ink === color)) {
    return { ...walker, floorReturns: { ...walker.floorReturns, [color]: evidence } };
  }
  return { ...walker, contacts: { ...walker.contacts, [place(next)]: { patch: patch.join(','), evidence } } };
}

function projectPanelWalk<T>(walker: PanelWalker, rows: NativeRows, field: NativeBox, inputs: readonly NativeCommand[], budget: number,
  targetAt: (box: NativeBox, patch: ReturnType<typeof tile>, walkable: boolean) => T | undefined): WalkProjection<T> | null {
  const actor = panelActor(walker, rows, field);
  if (!actor || budget < 1) return null;
  const moves = inputs.flatMap(command => {
    const known = walker.controls[command.action_ref];
    return known ? [{ command, ...known }] : [];
  });
  if (moves.length < 2 || !moves.some(move => move.delta[0]) || !moves.some(move => move.delta[1])) return null;
  type Node = { box: NativeBox; depth: number; previous?: Node; move?: typeof moves[number]; terrain?: string };
  const nodes: Node[] = [{ box: actor, depth: 0 }];
  const seen = new Set([place(actor)]);
  for (const node of nodes) {
    if (node.depth >= budget) continue;
    for (const move of moves) {
      const [dx, dy] = move.delta;
      const next = footprint(node.box[0] + dx, node.box[1] + dy), location = place(next);
      if (!containsBox(field, next) || seen.has(location)) continue;
      seen.add(location);
      const patch = tile(rows, next), supported = supportEvidence(walker, next, patch);
      const reached = { box: next, depth: node.depth + 1, previous: node, move, terrain: typeof supported === 'string' ? supported : undefined };
      const target = targetAt(next, patch, !!supported);
      if (target !== undefined) {
        const route: RouteStep[] = [], evidence = new Set<string>();
        for (let cursor: Node = reached; cursor.previous && cursor.move; cursor = cursor.previous) {
          const landing = bindTranslationLanding(rows, actor, cursor.previous.box, cursor.box);
          if (!landing) return null;
          route.push({ command: cursor.move.command, from: cursor.previous.box, to: cursor.box, landing });
          evidence.add(cursor.move.evidence);
          if (cursor.terrain) evidence.add(cursor.terrain);
        }
        return { target, route: route.reverse().slice(0, maximumCommittedActions), evidence: [...evidence] };
      }
      if (supported) nodes.push(reached);
    }
  }
  return null;
}

/** Reach a visible candidate for a controlled comparison using only measured walk vectors and floor. */
export function projectPanelMarker(walker: PanelWalker, rows: NativeRows, field: NativeBox, inputs: readonly NativeCommand[],
  controls: readonly PanelEffect[], excluded: readonly string[], remaining: number,
  sources: readonly KnownPanelSource[] = []): WalkProjection<PanelMarkerTrial> | null {
  return projectPanelWalk(walker, rows, field, inputs, remaining - 1, (box, patch) => {
    const code = alternatingCode(patch);
    if (!code) return;
    for (const control of controls) {
      const key = panelMarkerTrialKey(control.command, box, code);
      if (excluded.includes(key)) continue;
      const known = sources.find(source => source.command === observedCommandKey(control.command) && sameBox(source.marker, box));
      const peer = known && matchingPanelMarker(rows, field, box, code);
      if (known && peer) return { key, marker: box, control, link: known.evidence, peer };
      if (patch.includes(control.ink)) return { key, marker: box, control };
    }
  });
}

/** From a new landing, test the boundary where measured floor meets a visible object. */
export function projectPanelContact(walker: PanelWalker, rows: NativeRows, field: NativeBox, fieldInk: number,
  inputs: readonly NativeCommand[], excluded: readonly string[], remaining: number, broadenContact = false): WalkProjection<PanelContact> | null {
  return projectPanelWalk(walker, rows, field, inputs, remaining, (box, patch, walkable) => {
    if (walkable || patch.some(ink => ink === undefined || ink === fieldInk) || patch.every(ink => ink === walker.ink)
      || (!broadenContact && patch.includes(walker.ink))) return;
    const first = patch[0];
    const sameSurface = patch.every(ink => ink === first);
    const joinsFloor = patch.some(ink => ink !== undefined && (ink === walker.floor || walker.floorReturns?.[ink]));
    if (!sameSurface && !joinsFloor) return;
    const key = `${place(box)}:${patch.join(',')}`;
    return excluded.includes(key) ? undefined : { box, key };
  });
}

export function canReachPanelMarker(walker: PanelWalker, rows: NativeRows, field: NativeBox, inputs: readonly NativeCommand[],
  marker: NativeBox, remaining: number) {
  return !!projectPanelWalk(walker, rows, field, inputs, remaining, box => sameBox(box, marker) ? box : undefined);
}

export function projectPanelFooting(walker: PanelWalker, rows: NativeRows, field: NativeBox, inputs: readonly NativeCommand[],
  footing: NativeBox, key: string, remaining: number): PanelContactApproach | null {
  return projectPanelWalk(walker, rows, field, inputs, remaining, box => sameBox(box, footing) ? { key, box } : undefined);
}

const overlaps = (a: NativeBox, b: NativeBox) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const crop = (rows: NativeRows, [l, t, r, b]: NativeBox) => rows.slice(t, b + 1).flatMap(row => row.slice(l, r + 1));

export function rememberPanelTerrain(known: PanelTerrain | undefined, command: NativeCommand, region: NativeBox, actor: NativeBox,
  before: NativeRows, after: NativeRows, evidence: string): PanelTerrain | undefined {
  if (overlaps(region, actor)) return known;
  const first = crop(before, region), second = crop(after, region);
  const observations = known && sameBox(known.region, region) ? known.returns : [];
  const existing = observations.findIndex(item => item.before.every((ink, i) => ink === first[i]));
  if (existing < 0) {
    if (first.every((ink, i) => ink === second[i])) return known;
    return { command, region, returns: [...observations, { before: first, after: second, evidence }] };
  }
  const edge = observations[existing]!;
  if (!edge.after || edge.after.every((ink, i) => ink === second[i])) return known;
  return { command, region, returns: observations.map((item, i) => i === existing ? { ...item, after: null } : item) };
}

export function matchesPanelTerrain(rows: NativeRows, region: NativeBox, phase: readonly number[], actor: NativeBox) {
  const [l, t, r, b] = region, width = r - l + 1;
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
    if (containsBox(actor, [x, y, x, y])) continue;
    if (rows[y]?.[x] !== phase[(y - t) * width + x - l]) return false;
  }
  return phase.length === width * (b - t + 1);
}

/** Search the product of observed walking positions and measured terrain returns. */
export function projectPanelTerrain(walker: PanelWalker, rows: NativeRows, field: NativeBox, inputs: readonly NativeCommand[],
  model: PanelTerrain, target: NativeBox, remaining: number): TerrainProjection | null {
  const actor = panelActor(walker, rows, field);
  if (!actor || remaining < 1 || overlaps(target, model.region)) return null;
  const phases = new Map<string, number[]>(), transitions = new Map<string, TerrainReturn>();
  for (const edge of model.returns) {
    if (!edge.after) continue;
    const before = edge.before.join(','), after = edge.after.join(',');
    phases.set(before, edge.before);
    phases.set(after, edge.after);
    transitions.set(before, edge);
  }
  const matched = [...phases].filter(([, values]) => matchesPanelTerrain(rows, model.region, values, actor));
  if (matched.length !== 1) return null;
  const [l, t, r, b] = model.region, width = r - l + 1;
  const color = (phase: number[], x: number, y: number) =>
    x >= l && x <= r && y >= t && y <= b ? phase[(y - t) * width + x - l] : rows[y]?.[x];
  const support = (box: NativeBox, phase: number[]) => {
    if (sameBox(box, actor) && !overlaps(box, model.region)) return true;
    const [x, y, u, v] = box;
    return supportEvidence(walker, box, [color(phase, x, y), color(phase, u, y), color(phase, x, v), color(phase, u, v)]);
  };
  const moves = inputs.flatMap(command => walker.controls[command.action_ref] ? [{ command, ...walker.controls[command.action_ref]! }] : []);
  type Node = { box: NativeBox; phase: string; depth: number; previous?: Node; action?: NativeCommand; evidence?: string[]; change?: TerrainReturn };
  const queue: Node[] = [{ box: actor, phase: matched[0]![0], depth: 0 }];
  const seen = new Set([`${place(actor)}:${matched[0]![0]}`]);
  const enqueue = (node: Node) => {
    const key = `${place(node.box)}:${node.phase}`;
    if (seen.has(key)) return;
    seen.add(key);
    queue.push(node);
  };
  for (const node of queue) {
    if (sameBox(node.box, target)) {
      const path: Node[] = [], evidence = new Set<string>();
      for (let cursor: Node | undefined = node; cursor?.previous; cursor = cursor.previous) {
        path.push(cursor);
        for (const ref of cursor.evidence ?? []) evidence.add(ref);
      }
      path.reverse();
      const first = path[0]?.change;
      if (first?.after) return { distance: node.depth, evidence: [...evidence], route: [],
        change: { command: model.command, actor, region: model.region, before: first.before, after: first.after } };
      const route: RouteStep[] = [];
      for (const step of path) {
        if (step.change || route.length >= maximumCommittedActions) break;
        const from = step.previous!.box, landing = bindTranslationLanding(rows, actor, from, step.box);
        if (!landing) return null;
        route.push({ command: step.action!, from, to: step.box, landing });
      }
      return route.length ? { distance: node.depth, evidence: [...evidence], route } : null;
    }
    if (node.depth >= remaining) continue;
    const phase = phases.get(node.phase)!;
    for (const move of moves) {
      const [dx, dy] = move.delta, next = footprint(node.box[0] + dx, node.box[1] + dy);
      if (!containsBox(field, next)) continue;
      const measured = support(next, phase);
      if (!measured && !sameBox(next, target)) continue;
      enqueue({ box: next, phase: node.phase, depth: node.depth + 1, previous: node, action: move.command,
        evidence: typeof measured === 'string' ? [move.evidence, measured] : [move.evidence] });
    }
    const change = transitions.get(node.phase);
    if (change?.after && (!overlaps(node.box, model.region) || support(node.box, change.after))) {
      enqueue({ box: node.box, phase: change.after.join(','), depth: node.depth + 1,
        previous: node, change, evidence: [change.evidence] });
    }
  }
  return null;
}

export type PanelApproach = NonNullable<ReturnType<typeof projectPanelMarker>>;
export type PanelContactApproach = NonNullable<ReturnType<typeof projectPanelContact>>;
