import type { NativeBox, NativePoint } from '../logos-engine/v6-native-types.ts';
import type { PanelLattice, PanelParameter } from '../logos-engine/v6-panel-service-observation.ts';

export type Pattern = readonly NativePoint[];
export type PanelCell = PanelParameter & { pattern: Pattern; color: number; solid: boolean };
export type Service = { kind: string; input: number; output?: number; symbol: Pattern; control: PanelCell | null; observed_site: NativePoint };
export type Panel = { id: string; bbox: NativeBox; material: number | null; room_marker: number; selection_color: number;
  operators: Service[]; services: Service[]; cells: PanelCell[]; activity_controls: PanelCell[]; lattice?: PanelLattice };
export type Scene = { panels: Panel[]; layout: unknown };
type Location = { room: number; material: number };
type Task = { panel: Panel; control: PanelCell; next: Location | null; parameter?: PanelCell; site?: NativePoint };
export type ChainEdit = { panel: Panel; control: PanelCell; parameter?: PanelCell };
export type ChainReturn = { stocks: { room: number; materials: number[] }[]; workers: { id: string; room: number }[] };
export type ChainTurn = { tasks: Task[]; edit: ChainEdit | null; predicted: ChainReturn };
const distanceKey = ({ room, material }: Location) => room + '/' + material;
const samePattern = (a: Pattern, b: Pattern) => JSON.stringify(a) === JSON.stringify(b);

function supplies(scene: Scene): Map<number, Set<number>> | null {
  const result = new Map<number, Set<number>>();
  for (const panel of scene.panels) {
    const types = new Set(panel.cells.filter(cell => cell.col === 0 && cell.solid).map(cell => cell.color));
    const previous = result.get(panel.room_marker);
    if (previous && (previous.size !== types.size || [...types].some(color => !previous.has(color)))) return null;
    result.set(panel.room_marker, types);
  }
  return result;
}

function remainingWork(rooms: Map<number, Service[]>, start: Location): number {
  const queue = [{ ...start, depth: 1 }], seen = new Set([distanceKey(start)]);
  for (const { room, material, depth } of queue) {
    const here = rooms.get(room)!.filter(service => service.input === material);
    if (here.some(service => service.kind === 'displayed_receiver')) return depth;
    const rewrites = here.flatMap(service => service.output === undefined ? [] : [{ room, material: service.output }]);
    const destinations = [...rooms].flatMap(([other, services]) =>
      other !== room && services.some(service => service.input === material) ? [{ room: other, material }] : []);
    for (const next of [...rewrites, ...destinations]) {
      const key = distanceKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ ...next, depth: depth + 1 });
    }
  }
  return Infinity;
}

export function prepareServiceChain(scene: Scene, transport: Pattern): ChainTurn | null {
  const current = supplies(scene);
  if (!current) return null;
  const rooms = new Map<number, Service[]>();
  for (const panel of scene.panels) {
    const services = rooms.get(panel.room_marker) ?? [];
    for (const service of panel.services) if (!services.some(other =>
      other.kind === service.kind && other.input === service.input && other.output === service.output)) services.push(service);
    rooms.set(panel.room_marker, services);
  }
  // Material selectors show availability by type. Reserve each visible room/type
  // at most once per turn so a shared selector cannot double-count its supply.
  const reserved = new Set<string>(), furnaces = new Set<number>(), tasks: Task[] = [];
  const active = (panel: Panel) => panel.activity_controls.find(control => control.outline === panel.selection_color);
  const panels = [...scene.panels].sort((a, b) => Number(!!active(b)) - Number(!!active(a)));
  for (const panel of panels) {
    if (panel.material === null) continue;
    const room = panel.room_marker, material = panel.material, stock = distanceKey({ room, material });
    const possibilities: Task[] = [];
    if (!reserved.has(stock)) {
      for (const service of panel.operators) {
        if (!service.control || service.input !== material) continue;
        if (service.kind === 'displayed_receiver' && !furnaces.has(room)) {
          possibilities.push({ panel, control: service.control, next: null, site: service.observed_site });
        } else if (service.kind === 'displayed_rewrite' && service.output !== undefined) {
          possibilities.push({ panel, control: service.control, next: { room, material: service.output }, site: service.observed_site });
        }
      }
      const mover = panel.activity_controls.find(control => samePattern(control.pattern, transport));
      if (mover) for (const [destination, services] of rooms) {
        const target = services.find(service => service.input === material);
        if (destination === room || !target) continue;
        const parameters = panel.cells.filter(cell => cell.row === mover.row && cell.col >= 2 && cell.solid && cell.color === destination);
        if (parameters.length === 1) possibilities.push({ panel, control: mover, parameter: parameters[0]!,
          next: { room: destination, material }, site: target.observed_site });
      }
    }
    const ready = (task: Task) => task.control.outline === panel.selection_color
      && (!task.parameter || task.parameter.outline === panel.selection_color);
    const ranked = possibilities.map(task => ({ task, distance: task.next ? remainingWork(rooms, task.next) : 0 }))
      .filter(({ distance }) => Number.isFinite(distance))
      .sort((a, b) => a.distance - b.distance || Number(ready(b.task)) - Number(ready(a.task)));
    const best = ranked[0]?.task;
    if (!best) {
      const control = active(panel);
      if (control && (!samePattern(control.pattern, transport) || panel.cells.some(cell =>
        cell.row === control.row && cell.col >= 2 && cell.solid && cell.outline === panel.selection_color))) return null;
      continue;
    }
    tasks.push(best);
    reserved.add(stock);
    if (!best.next) furnaces.add(room);
  }
  if (!tasks.length) return null;
  const edit = tasks.find(({ panel, control, parameter }) => control.outline !== panel.selection_color
    || parameter && parameter.outline !== panel.selection_color);
  for (const { panel } of tasks) current.get(panel.room_marker)!.delete(panel.material!);
  for (const { next } of tasks) if (next) current.get(next.room)!.add(next.material);
  return {
    tasks, edit: edit ? { panel: edit.panel, control: edit.control,
      ...(edit.control.outline === edit.panel.selection_color && edit.parameter ? { parameter: edit.parameter } : {}) } : null,
    predicted: {
      stocks: [...current].map(([room, materials]) => ({ room, materials: [...materials] })),
      workers: scene.panels.map(panel => ({ id: panel.id, room: tasks.find(task => task.panel === panel)?.next?.room ?? panel.room_marker })),
    },
  };
}

export function matchesServiceChain(scene: Scene, expected: ChainReturn): boolean {
  const observed = supplies(scene);
  return !!observed && scene.panels.length === expected.workers.length
    && expected.workers.every(worker => scene.panels.some(panel => panel.id === worker.id && panel.room_marker === worker.room))
    && expected.stocks.every(({ room, materials }) => (observed.get(room)?.size ?? 0) === materials.length
      && materials.every(material => observed.get(room)?.has(material)));
}
