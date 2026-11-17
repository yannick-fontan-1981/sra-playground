import { measurePortLayout, placedPorts, portAgreement, portCells, portNeighbors,
  type PortModel, type PortPose } from '../logos-engine/v6-port-assembly.ts';
import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import { PointSet, pointKey, type Point } from '../logos-engine/v6-point-set.ts';

export type GeometryControl = { part: number; cell: Point; ink: number };

export function measureGeometryControl(rows: NativeRows, model: PortModel, poses: readonly PortPose[]): GeometryControl | null {
  const cells = portCells(rows, model), bodies = poses.map((pose, part) => placedPorts(model, part, pose)[0]);
  const occupied = new PointSet(bodies.flatMap(body => [...body]));
  const measured = new PointSet([...cells.values()].map(cell => cell.point));
  if (!occupied.isSubset(measured)) return null;
  const extra = measured.difference(occupied);
  if (extra.size !== 1) return null;
  const cell = [...extra][0]!, ink = cells.get(pointKey(cell))!.value;
  if (ink === model.marker) return null;
  const neighbors = portNeighbors(cell);
  const owners = bodies.flatMap((body, part) => neighbors.disjoint(body) ? [] : [part]);
  return owners.length === 1 && model.bodies[owners[0]!]!.known ? { part: owners[0]!, cell, ink } : null;
}

export function observeGeometryControl(observation: NativeObservation, first: NativeRows, second: NativeRows,
  old: PortModel, poses: readonly PortPose[], control: GeometryControl) {
  const model = measurePortLayout(observation, second);
  if (!model || model.unit !== old.unit || model.marker !== old.marker || model.background !== old.background
    || pointKey(model.phase) !== pointKey(old.phase) || model.bodies.length !== old.bodies.length) return null;
  const previous = poses.map((pose, index) => placedPorts(old, index, pose));
  const current = model.poses.map((pose, index) => placedPorts(model, index, pose));
  const firstCells = portCells(first, old), secondCells = portCells(second, model);
  const unmatched = new Set(current.map((_, index) => index));
  for (const [index, [material, ports]] of previous.entries()) {
    if (index === control.part) continue;
    const matches = [...unmatched].filter(other => material.equals(current[other]![0]) && ports.equals(current[other]![1]));
    if (matches.length !== 1 || [...material].some(cell => firstCells.get(pointKey(cell))?.value !== secondCells.get(pointKey(cell))?.value)) return null;
    unmatched.delete(matches[0]!);
  }
  const part = [...unmatched][0]!;
  const before = previous[control.part]![0], [after, ports] = current[part]!;
  if (!ports.size || after.equals(before) || after.disjoint(before)) return null;
  const next = measureGeometryControl(second, model, model.poses);
  if (next ? next.part !== part || next.ink !== control.ink : !portAgreement(second, model, model.poses)) return null;
  return { model, part, next };
}
