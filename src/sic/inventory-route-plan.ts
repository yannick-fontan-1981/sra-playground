import { composePlan } from './effect-composer.ts';
import type { NativePoint } from '../logos-engine/v6-native-types.ts';

export type InventoryRouteNode = { at: NativePoint; ordinary: boolean; gate: number | null; charge: boolean };
export type InventoryRouteMap = { nodes: InventoryRouteNode[]; goal: number; recharge: number; gateKeys?: number[]; reusable?: number[] };
type Contents = number | null | (number | null)[];
export type InventoryPosition = { at: number; held: Contents; objects: number[]; opened: number; charged: boolean; energy: number };
type Movement = { input: string; delta: NativePoint };
export type InventoryRouteStep = { input: string; kind: 'walk' | 'pick' | 'deposit' | 'unlock' | 'charge' | 'finish'; position: InventoryPosition };

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
  const viable = { relation: 'movement reserve or terminal reached',
    holds: (state: InventoryPosition) => state.energy > 0 || state.at === map.goal };
  const plan = composePlan<InventoryPosition, InventoryRouteStep>({
    domain: 'inventory-and-reserve',
    initial: start,
    key: ({ at, held, objects, opened, charged }) => [at, ...slotContents(held), opened, Number(charged), ...objects].join(','),
    goal: { relation: 'reach destination', holds: state => state.at === map.goal },
    reserve: state => state.energy,
    budget: { commands: remaining, states: 32_000 },
    *choices(position) {
      const effect = (step: InventoryRouteStep) => ({ action: step, after: step.position, ensures: [viable] });
      const here = map.nodes[position.at]!, [row, col] = here.at, held = slotContents(position.held);
      for (const { input, delta: [dy, dx] } of moves) {
        const at = bySite.get([row + dy, col + dx].join(','));
        if (at === undefined) continue;
        const node = map.nodes[at]!, closed = node.gate !== null && !(position.opened & (1 << node.gate));
        const key = node.gate === null ? null : map.gateKeys?.[node.gate] ?? node.gate;
        const slot = key === null ? -1 : held.indexOf(key);
        const charge = node.charge && !position.charged;
        const kind = at === map.goal ? 'finish' : closed ? 'unlock' : charge ? 'charge' : 'walk';
        const consumed = closed && slot >= 0 && key !== null && !map.reusable?.includes(key);
        const move = effect({ input, kind, position: { ...position, at, held: consumed ? replaceInSlot(position.held, slot, null) : position.held,
          opened: closed ? position.opened | (1 << node.gate!) : position.opened, charged: position.charged || charge,
          energy: position.energy - 1 + (charge ? map.recharge : 0) } });
        yield closed ? { ...move, requires: [{ relation: 'matching key available',
          holds: state => slotContents(state.held).includes(key!) }] } : move;
      }
      const object = position.objects.indexOf(position.at);
      const free = held.indexOf(null);
      if (free >= 0 && object !== -1) {
        const objects = position.objects.slice();
        objects[object] = -1;
        yield { ...effect({ input: interaction, kind: 'pick', position: { ...position,
          held: replaceInSlot(position.held, free, object), objects, energy: position.energy - 1 } }),
          requires: [{ relation: 'one inventory slot free', holds: state => slotContents(state.held).includes(null) }] };
      } else if (typeof position.held === 'number' && object === -1 && here.ordinary) {
        const objects = position.objects.slice();
        objects[position.held] = position.at;
        yield effect({ input: interaction, kind: 'deposit', position: { ...position, held: null, objects, energy: position.energy - 1 } });
      }
    },
  });
  return plan?.effects.map(result => result.action) ?? null;
}
