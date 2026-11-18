import { measurePortLayout, placedPorts, portAgreement, portCells, portNeighbors,
  type PortModel, type PortPose } from '../logos-engine/v6-port-assembly.ts';
import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import { PointSet, pointKey, type Point } from '../logos-engine/v6-point-set.ts';

export type GeometryControl = { part: number; cell: Point; ink: number; revealedBySelection?: true };

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

export function measureSelectedGeometryControl(first: NativeRows, second: NativeRows, model: PortModel,
  poses: readonly PortPose[], part: number): GeometryControl | null {
  const previous = portCells(first, model), current = portCells(second, model);
  const [body] = placedPorts(model, part, poses[part]!);
  const colors = new Map<number, Point[]>();
  for (const cell of body) {
    const ink = current.get(pointKey(cell))?.value;
    if (ink === undefined || ink === model.marker) continue;
    colors.set(ink, [...(colors.get(ink) ?? []), cell]);
  }
  if (colors.size !== 2) return null;
  const candidates = [...colors].filter(([ink, cells]) => cells.length === 1 && previous.get(pointKey(cells[0]!))?.value !== ink);
  if (candidates.length !== 1) return null;
  const [ink, [cell]] = candidates[0]!;
  return { part, cell: cell!, ink, revealedBySelection: true };
}

function observeSelectedGeometryControl(first: NativeRows, second: NativeRows, old: PortModel,
  poses: readonly PortPose[], control: GeometryControl) {
  const firstCells = portCells(first, old), secondCells = portCells(second, old);
  const unaffected = new PointSet();
  for (const [part, pose] of poses.entries()) {
    if (part === control.part) continue;
    const [material] = placedPorts(old, part, pose);
    if ([...material].some(cell => firstCells.get(pointKey(cell))?.value !== secondCells.get(pointKey(cell))?.value)) return null;
    unaffected.update(material);
  }
  const residual = [...secondCells.values()].filter(({ point }) => !unaffected.has(point));
  const controls = residual.filter(({ value }) => value === control.ink);
  const material = new PointSet(residual.filter(({ value }) => value !== control.ink).map(({ point }) => point));
  const ports = new PointSet(residual.filter(({ value }) => value === old.marker).map(({ point }) => point));
  const [previous, previousPorts] = placedPorts(old, control.part, poses[control.part]!);
  previous.delete(control.cell);
  if (controls.length > 1 || !ports.size || previous.disjoint(material)
    || (previous.equals(material) && previousPorts.equals(ports))) return null;
  // A revealed connector can separate two drawn regions of the same piece.
  // Attribute each region through overlap with the prior footprint or its control.
  const queue = [...material].filter(cell => previous.has(cell) || !portNeighbors(cell).disjoint(previous)
    || portNeighbors(cell).has(control.cell));
  const reached = new PointSet(queue);
  for (const cell of queue) for (const neighbor of portNeighbors(cell)) {
    if (!material.has(neighbor) || reached.has(neighbor)) continue;
    reached.add(neighbor);
    queue.push(neighbor);
  }
  if (reached.size !== material.size || controls.some(({ point }) => portNeighbors(point).disjoint(material))) return null;
  const x = Math.min(...[...material].map(cell => cell[0])), y = Math.min(...[...material].map(cell => cell[1]));
  const normalize = (points: PointSet) => new PointSet([...points].map(([px, py]) => [px - x, py - y]));
  const bodies = [...old.bodies], nextPoses = [...poses], part = control.part;
  bodies[part] = { material: normalize(material), ports: normalize(ports), known: true };
  nextPoses[part] = [0, x, y];
  const next = controls.length ? { ...control, cell: controls[0]!.point } : null;
  return { model: { ...old, bodies, poses: nextPoses }, part, next };
}

export function observeGeometryControl(observation: NativeObservation, first: NativeRows, second: NativeRows,
  old: PortModel, poses: readonly PortPose[], control: GeometryControl) {
  if (control.revealedBySelection) return observeSelectedGeometryControl(first, second, old, poses, control);
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
