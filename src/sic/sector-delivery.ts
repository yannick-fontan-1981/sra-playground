import { orientedCouplingTile } from '../logos-engine/v6-oriented-coupling.ts';
import type { NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Geometry = { pitch: number; phase: NativePoint; core: number; background: number; targets: NativePoint[] };
type Port = { cell: NativePoint; face: NativePoint };
type Sector = { cells: string[]; targets: NativePoint[]; ports: Port[] };
export type SectorNetwork = { sending: string[]; receiving: Sector[]; localTargets?: NativePoint[] };

const directions: readonly NativePoint[] = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const add = ([x, y]: NativePoint, [dx, dy]: NativePoint): NativePoint => [x + dx, y + dy];
const key = (point: NativePoint) => point.join(',');

export function measureSectorNetwork(rows: NativeRows, geometry: Geometry, actor: NativePoint,
  parts: readonly NativePoint[], carriers: readonly NativePoint[]): SectorNetwork | null {
  const { pitch, phase, core, background, targets } = geometry;
  const occupied = new Set([actor, ...parts, ...targets, ...carriers].map(key));
  const floor = new Map<string, NativePoint>(), boundaries: NativePoint[] = [];
  for (let y = 0; phase[1] + (y + 1) * pitch <= rows.length; y++) {
    for (let x = 0; phase[0] + (x + 1) * pitch <= rows[0]!.length; x++) {
      const cell: NativePoint = [x, y], id = key(cell);
      const inks = new Set(orientedCouplingTile(rows, geometry, cell)!.flat());
      if (occupied.has(id) || (inks.size === 1 && inks.has(background))) floor.set(id, cell);
      else if (inks.size === 2 && inks.has(background) && !inks.has(core)) boundaries.push(cell);
    }
  }
  const groups = new Map<string, number>(), components: string[][] = [];
  for (const [id, first] of floor) {
    if (groups.has(id)) continue;
    const number = components.length, queue: NativePoint[] = [first], cells = [id];
    groups.set(id, number);
    for (let index = 0; index < queue.length; index++) for (const direction of directions) {
      const next = add(queue[index]!, direction), nextId = key(next);
      if (!floor.has(nextId) || groups.has(nextId)) continue;
      groups.set(nextId, number); cells.push(nextId); queue.push(next);
    }
    components.push(cells);
  }
  const home = groups.get(key(actor))!;
  const localTargets = targets.filter(target => groups.get(key(target)) === home);
  const receivers = [...new Set(targets.map(target => groups.get(key(target))!))].filter(sector => sector !== home);
  if (!receivers.length || receivers.length < 2 && !localTargets.length) return null;
  const receiving: Sector[] = [];
  for (const sector of receivers) {
    if (!carriers.some(carrier => groups.get(key(carrier)) === sector)) return null;
    const ports = boundaries.flatMap(cell => directions.flatMap(face => {
      const before = add(cell, [-face[0], -face[1]]), beyond = add(cell, face);
      return groups.get(key(before)) === home && groups.get(key(beyond)) === sector ? [{ cell, face }] : [];
    }));
    if (!ports.length) return null;
    receiving.push({ cells: components[sector]!, targets: targets.filter(target => groups.get(key(target)) === sector), ports });
  }
  const distinctPorts = receiving.map((sector, index) => ({ ...sector,
    ports: sector.ports.filter(port => !receiving.some((other, i) => i !== index && other.ports.some(candidate => key(candidate.cell) === key(port.cell)))) }));
  return distinctPorts.every(sector => sector.ports.length) ? { sending: components[home]!, receiving: distinctPorts,
    ...(localTargets.length ? { localTargets } : {}) } : null;
}
