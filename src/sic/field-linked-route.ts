import type { NativeCommand } from '../logos-engine/v6-native-types.ts';
import { findCompositionFrontier } from './composition-frontier.ts';
import type { BridgeChart, BridgePose } from './field-bridge-route.ts';

type Cell = string;
type Step = { action: NativeCommand; after: BridgePose };
type Route = { path: Step[]; target: Cell; placement?: Cell[]; canSpend: boolean };
const key = (pose: BridgePose) => [pose.actor, ...[pose.bodies, pose.hazards, pose.supports].map(cells => [...cells].sort().join(';'))].join('|');

export function findLinkedRoute(chart: BridgeChart, controls: Cell[][],
  successors: (pose: BridgePose, canSpend: boolean) => Step[], remaining: number, tested: readonly string[]): Route | undefined {
  const start = chart.pose;
  const held = (pose: BridgePose, cell: Cell) => pose.bodies.includes(cell) || pose.hazards.includes(cell) || chart.held.has(cell);
  const installed = controls.flat().filter(cell => held(start, cell));
  const unfinished = controls.filter(group => !group.every(cell => held(start, cell)));
  const placementCandidates = unfinished.filter(group => !tested.includes('hold_access:' + group.join(';')));
  const land = new Set([...chart.floor, ...start.supports]);
  const region = (first: Cell) => {
    const reached = new Set([first]), queue = [first];
    for (const cell of queue) {
      const [x, y] = cell.split(',').map(Number) as [number, number];
      for (const [u, v] of [[x + chart.pitch, y], [x - chart.pitch, y], [x, y + chart.pitch], [x, y - chart.pitch]]) {
        const next = `${u},${v}`;
        if (land.has(next) && !reached.has(next)) { reached.add(next); queue.push(next); }
      }
    }
    return reached;
  };
  const canPlaceFrom = (cells: Set<Cell>, mark: Cell) => {
    if (cells.has(mark)) return true;
    const [x, y] = mark.split(',').map(Number) as [number, number];
    return [...cells].some(cell => {
      const [u, v] = cell.split(',').map(Number) as [number, number];
      return Math.max(Math.abs(x - u), Math.abs(y - v)) <= chart.radius;
    });
  };
  const home = region(start.actor);
  const search = (goal: (pose: BridgePose) => boolean, canSpend = false) => findCompositionFrontier({
    start, key, depth: remaining, limit: 48_000,
    successors: pose => successors(pose, canSpend).filter(step => canSpend || installed.every(cell => held(step.after, cell))),
    isComposition: (_, after) => goal(after),
  });
  if (home.has(chart.exit) || !unfinished.length) {
    const path = search(pose => pose.actor === chart.exit, true);
    if (path) return { path, target: chart.exit, canSpend: true };
  }
  for (const group of placementCandidates) {
    if (!group.every(mark => canPlaceFrom(home, mark))) continue;
    const path = search(pose => group.every(mark => held(pose, mark)));
    if (path) return { path, target: group[0]!, placement: group, canSpend: false };
  }
  const visited = new Set(home), destinations = new Set<Cell>();
  for (const cell of land) {
    if (visited.has(cell)) continue;
    const shore = region(cell);
    shore.forEach(site => visited.add(site));
    if (shore.has(chart.exit) || placementCandidates.some(group => group.every(mark => canPlaceFrom(shore, mark)))) {
      shore.forEach(site => destinations.add(site));
    }
  }
  const path = destinations.size ? search(pose => destinations.has(pose.actor)) : undefined;
  if (path) return { path, target: path.at(-1)!.after.actor, canSpend: false };
}
