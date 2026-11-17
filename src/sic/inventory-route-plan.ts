import type { NativePoint } from '../logos-engine/v6-native-types.ts';

export type InventoryRouteNode = { at: NativePoint; ordinary: boolean; gate: number | null; charge: boolean };
export type InventoryRouteMap = { nodes: InventoryRouteNode[]; goal: number; recharge: number; gateKeys?: number[]; reusable?: number[] };
type Contents = number | null | (number | null)[];
export type InventoryPosition = { at: number; held: Contents; objects: number[]; opened: number; charged: boolean; energy: number };
type Movement = { input: string; delta: NativePoint };
export type InventoryRouteStep = { input: string; kind: 'walk' | 'pick' | 'deposit' | 'unlock' | 'charge' | 'finish'; position: InventoryPosition };
type Frontier = { position: InventoryPosition; depth: number; parent: number; step?: InventoryRouteStep };

export const slotContents = (held: Contents) => Array.isArray(held) ? held : [held];
export function replaceInSlot(held: Contents, slot: number, object: number | null): Contents {
  if (!Array.isArray(held)) return object;
  const contents = held.slice();
  contents[slot] = object;
  return contents;
}

export function planInventoryRoute(map: InventoryRouteMap, start: InventoryPosition, moves: Movement[],
  interaction: string, remaining: number): InventoryRouteStep[] | null {
  const bySite = new Map(map.nodes.map((node, index) => [node.at.join(','), index]));
  const frontier: Frontier[] = [{ position: start, depth: 0, parent: -1 }];
  const energyAt = new Map<string, number>();
  for (let index = 0; index < frontier.length; index++) {
    const { position, depth } = frontier[index]!;
    if (position.at === map.goal) {
      const route: InventoryRouteStep[] = [];
      for (let cursor = index; cursor >= 0; cursor = frontier[cursor]!.parent) {
        const step = frontier[cursor]!.step;
        if (step) route.push(step);
      }
      return route.reverse();
    }
    if (depth >= remaining || frontier.length >= 32000) continue;
    const add = (step: InventoryRouteStep) => {
      const { at, held, objects, opened, charged, energy } = step.position;
      if (energy <= 0 && at !== map.goal) return;
      const key = [at, ...slotContents(held), opened, Number(charged), ...objects].join(',');
      if ((energyAt.get(key) ?? -1) >= energy) return;
      energyAt.set(key, energy);
      frontier.push({ position: step.position, depth: depth + 1, parent: index, step });
    };
    const here = map.nodes[position.at]!, [row, col] = here.at, held = slotContents(position.held);
    for (const { input, delta: [dy, dx] } of moves) {
      const at = bySite.get([row + dy, col + dx].join(','));
      if (at === undefined) continue;
      const node = map.nodes[at]!, closed = node.gate !== null && !(position.opened & (1 << node.gate));
      const key = node.gate === null ? null : map.gateKeys?.[node.gate] ?? node.gate;
      const slot = key === null ? -1 : held.indexOf(key);
      if (closed && slot < 0) continue;
      const charge = node.charge && !position.charged;
      const kind = at === map.goal ? 'finish' : closed ? 'unlock' : charge ? 'charge' : 'walk';
      const consumed = closed && key !== null && !map.reusable?.includes(key);
      add({ input, kind, position: { ...position, at, held: consumed ? replaceInSlot(position.held, slot, null) : position.held,
        opened: closed ? position.opened | (1 << node.gate!) : position.opened, charged: position.charged || charge,
        energy: position.energy - 1 + (charge ? map.recharge : 0) } });
    }
    const object = position.objects.indexOf(position.at);
    const free = held.indexOf(null);
    if (free >= 0 && object !== -1) {
      const objects = position.objects.slice();
      objects[object] = -1;
      add({ input: interaction, kind: 'pick', position: { ...position, held: replaceInSlot(position.held, free, object), objects, energy: position.energy - 1 } });
    } else if (typeof position.held === 'number' && object === -1 && here.ordinary) {
      const objects = position.objects.slice();
      objects[position.held] = position.at;
      add({ input: interaction, kind: 'deposit', position: { ...position, held: null, objects, energy: position.energy - 1 } });
    }
  }
  return null;
}
