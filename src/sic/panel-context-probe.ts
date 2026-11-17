import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { measureComponentTranslations } from './observed-translation.ts';
import { bindTranslationLanding, maximumCommittedActions, type MeasuredLanding } from './plan-step.ts';

type Translation = { delta: NativePoint; evidence: string };
export type PanelWalker = { ink: number; floor: number; controls: Record<string, Translation> };
export type PanelEffect = { command: NativeCommand; box: NativeBox; ink: number; evidence: string };
export type PanelMarkerTrial = { key: string; marker: NativeBox; control: PanelEffect };
type RouteStep = { command: NativeCommand; from: NativeBox; to: NativeBox; landing: MeasuredLanding };

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

/** Reach a visible candidate for a controlled comparison using only measured walk vectors and floor. */
export function projectPanelMarker(walker: PanelWalker, rows: NativeRows, field: NativeBox, inputs: readonly NativeCommand[],
  controls: readonly PanelEffect[], excluded: readonly string[], remaining: number) {
  const actor = panelActor(walker, rows, field);
  if (!actor || remaining < 2) return null;
  const moves = inputs.flatMap(command => {
    const known = walker.controls[command.action_ref];
    return known ? [{ command, ...known }] : [];
  });
  if (moves.length < 2 || !moves.some(move => move.delta[0]) || !moves.some(move => move.delta[1])) return null;
  const keyOf = (box: NativeBox) => box.slice(0, 2).join(',');
  const nodes: { box: NativeBox; route: RouteStep[]; evidence: string[] }[] = [{ box: actor, route: [], evidence: [] }];
  const seen = new Set([keyOf(actor)]);
  for (const node of nodes) {
    if (node.route.length >= remaining - 1) continue;
    for (const { command, delta: [dx, dy], evidence } of moves) {
      const next = footprint(node.box[0] + dx, node.box[1] + dy), location = keyOf(next);
      if (!containsBox(field, next) || seen.has(location)) continue;
      seen.add(location);
      const [a, b, c, d] = tile(rows, next);
      const landing = bindTranslationLanding(rows, actor, node.box, next);
      if (!landing) continue;
      const route = [...node.route, { command, from: node.box, to: next, landing }];
      const refs = [...new Set([...node.evidence, evidence])];
      if (a === d && b === c && a !== b) {
        for (const control of controls) {
          const key = `${control.command.data.x},${control.command.data.y}:${location}:${a},${b}`;
          if ((control.ink === a || control.ink === b) && !excluded.includes(key)) {
            return { trial: { key, marker: next, control }, route: route.slice(0, maximumCommittedActions), evidence: refs };
          }
        }
      }
      if ([a, b, c, d].every(ink => ink === walker.floor)) nodes.push({ box: next, route, evidence: refs });
    }
  }
  return null;
}

export type PanelApproach = NonNullable<ReturnType<typeof projectPanelMarker>>;
