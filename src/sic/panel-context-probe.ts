import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { measureComponentTranslations } from './observed-translation.ts';
import { bindTranslationLanding, maximumCommittedActions, type MeasuredLanding } from './plan-step.ts';

type Translation = { delta: NativePoint; evidence: string };
export type PanelWalker = { ink: number; floor: number; controls: Record<string, Translation> };
export type PanelEffect = { command: NativeCommand; box: NativeBox; ink: number; evidence: string };
export type PanelMarkerTrial = { key: string; marker: NativeBox; control: PanelEffect };
export type PanelContact = { key: string; box: NativeBox };
type RouteStep = { command: NativeCommand; from: NativeBox; to: NativeBox; landing: MeasuredLanding };
type WalkProjection<T> = { target: T; route: RouteStep[]; evidence: string[] };

export const containsBox = (outer: NativeBox, inner: NativeBox) =>
  outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3];
export const sameBox = (left: NativeBox, right: NativeBox) => left.every((value, i) => value === right[i]);
const footprint = (x: number, y: number): NativeBox => [x, y, x + 1, y + 1];
const tile = (rows: NativeRows, [x, y, r, b]: NativeBox) =>
  [rows[y]?.[x], rows[y]?.[r], rows[b]?.[x], rows[b]?.[r]];

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
  return { ink: from.color, floor, controls: { ...previous?.controls, [command]: { delta: displacement, evidence } } };
}

function projectPanelWalk<T>(walker: PanelWalker, rows: NativeRows, field: NativeBox, inputs: readonly NativeCommand[], budget: number,
  targetAt: (box: NativeBox, patch: ReturnType<typeof tile>) => T | undefined): WalkProjection<T> | null {
  const actor = panelActor(walker, rows, field);
  if (!actor || budget < 1) return null;
  const moves = inputs.flatMap(command => {
    const known = walker.controls[command.action_ref];
    return known ? [{ command, ...known }] : [];
  });
  if (moves.length < 2 || !moves.some(move => move.delta[0]) || !moves.some(move => move.delta[1])) return null;
  const keyOf = (box: NativeBox) => box.slice(0, 2).join(',');
  type Node = { box: NativeBox; depth: number; previous?: Node; move?: typeof moves[number] };
  const nodes: Node[] = [{ box: actor, depth: 0 }];
  const seen = new Set([keyOf(actor)]);
  for (const node of nodes) {
    if (node.depth >= budget) continue;
    for (const move of moves) {
      const [dx, dy] = move.delta;
      const next = footprint(node.box[0] + dx, node.box[1] + dy), location = keyOf(next);
      if (!containsBox(field, next) || seen.has(location)) continue;
      seen.add(location);
      const patch = tile(rows, next), reached = { box: next, depth: node.depth + 1, previous: node, move };
      const target = targetAt(next, patch);
      if (target !== undefined) {
        const route: RouteStep[] = [], evidence = new Set<string>();
        for (let cursor: Node = reached; cursor.previous && cursor.move; cursor = cursor.previous) {
          const landing = bindTranslationLanding(rows, actor, cursor.previous.box, cursor.box);
          if (!landing) return null;
          route.push({ command: cursor.move.command, from: cursor.previous.box, to: cursor.box, landing });
          evidence.add(cursor.move.evidence);
        }
        return { target, route: route.reverse().slice(0, maximumCommittedActions), evidence: [...evidence] };
      }
      if (patch.every(ink => ink === walker.floor)) nodes.push(reached);
    }
  }
  return null;
}

/** Reach a visible candidate for a controlled comparison using only measured walk vectors and floor. */
export function projectPanelMarker(walker: PanelWalker, rows: NativeRows, field: NativeBox, inputs: readonly NativeCommand[],
  controls: readonly PanelEffect[], excluded: readonly string[], remaining: number): WalkProjection<PanelMarkerTrial> | null {
  return projectPanelWalk(walker, rows, field, inputs, remaining - 1, (box, [a, b, c, d]) => {
    if (a !== d || b !== c || a === b) return;
    for (const control of controls) {
      const key = `${control.command.data.x},${control.command.data.y}:${box.slice(0, 2).join(',')}:${a},${b}`;
      if ((control.ink === a || control.ink === b) && !excluded.includes(key)) return { key, marker: box, control };
    }
  });
}

/** From a new landing, test the boundary where measured floor meets a visible object. */
export function projectPanelContact(walker: PanelWalker, rows: NativeRows, field: NativeBox, fieldInk: number,
  inputs: readonly NativeCommand[], excluded: readonly string[], remaining: number): WalkProjection<PanelContact> | null {
  return projectPanelWalk(walker, rows, field, inputs, remaining, (box, patch) => {
    if (!patch.includes(walker.floor)) return;
    const object = patch.find(ink => ink !== walker.floor);
    if (object === undefined || object === fieldInk || object === walker.ink
      || patch.some(ink => ink !== walker.floor && ink !== object)) return;
    const key = `${box.slice(0, 2).join(',')}:${patch.join(',')}`;
    return excluded.includes(key) ? undefined : { box, key };
  });
}

export type PanelApproach = NonNullable<ReturnType<typeof projectPanelMarker>>;
export type PanelContactApproach = NonNullable<ReturnType<typeof projectPanelContact>>;
