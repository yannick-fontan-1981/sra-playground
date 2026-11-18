import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { Panel, Pattern, Scene } from './panel-service-chain.ts';

type Workshop = { marker: number; places: NativePoint[]; slots: number[]; fuel: number; input: number; output: number;
  furnace: NativePoint; cold: number[]; burn: Pattern; rewrite: Pattern };
export type WorkshopLayout = { rooms: Workshop[]; materials: number[]; unit: number };
export type WorkshopState = { stock: number[][]; workers: number[]; hot: boolean[] };
type Work = { input: number; kind: 'burn' | 'rewrite' | 'move'; target: number };
export type WorkshopTurn = { jobs: (Work | null)[]; expected: WorkshopState };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const tile = (rows: NativeRows, [x, y]: NativePoint, unit: number) =>
  rows.slice(y, y + unit).flatMap(line => line.slice(x, x + unit));

export function measureWorkshopLayout(rows: NativeRows, scene: Scene, unit: number): WorkshopLayout | null {
  if (scene.panels.length < 2 || scene.panels.length > 6
    || new Set(scene.panels.map(panel => panel.room_marker)).size !== scene.panels.length) return null;
  const parts = geometricComponents(rows), ordered = [...scene.panels].sort((a, b) => a.room[1] - b.room[1]);
  const recipes = ordered.map(panel => {
    const burner = panel.services.filter(item => item.kind === 'displayed_receiver');
    const maker = panel.services.filter(item => item.kind === 'displayed_rewrite' && item.output !== undefined);
    return burner.length === 1 && maker.length === 1 ? { panel, burner: burner[0]!, maker: maker[0]! } : null;
  });
  if (recipes.some(item => !item)) return null;
  const materials = [...new Set(recipes.flatMap(item => [item!.maker.input, item!.maker.output!, item!.burner.input]))];
  const rooms: Workshop[] = [];
  for (const { panel, burner, maker } of recipes as NonNullable<typeof recipes[number]>[]) {
    const [left, top, right, bottom] = panel.room;
    const places: NativePoint[] = [], slots: number[] = [];
    for (const part of parts) {
      const [x, y, r, b] = part.bbox;
      if (x <= left || r >= right || y <= top || b >= bottom || r - x + 1 !== unit || b - y + 1 !== unit
        || y <= maker.observed_site[1] + unit || x + unit >= burner.observed_site[0]) continue;
      if (part.area === unit * unit && materials.includes(part.color)) { places.push([x, y]); continue; }
      if (part.area !== unit * unit - (unit - 2) ** 2) continue;
      const pixels = tile(rows, [x, y], unit);
      if (pixels.every((color, i) => i >= unit && i < unit * (unit - 1) && i % unit !== 0 && i % unit !== unit - 1
        ? color !== part.color : color === part.color)) {
        places.push([x, y]);
        slots.push(part.color);
      }
    }
    if (places.length < 2 || !slots.length || new Set(slots).size !== 1) return null;
    rooms.push({ marker: panel.room_marker, places, slots: [...new Set(slots)], fuel: materials.indexOf(burner.input),
      input: materials.indexOf(maker.input), output: materials.indexOf(maker.output!), furnace: burner.observed_site,
      cold: tile(rows, burner.observed_site, unit), burn: burner.symbol, rewrite: maker.symbol });
  }
  return { rooms, materials, unit };
}

export function measureWorkshopState(rows: NativeRows, scene: Scene, layout: WorkshopLayout): WorkshopState | null {
  const stock: number[][] = [], hot: boolean[] = [];
  for (const room of layout.rooms) {
    const quantities = layout.materials.map(() => 0);
    for (const point of room.places) {
      const pixels = tile(rows, point, layout.unit);
      const kind = layout.materials.indexOf(pixels[0]!);
      if (kind >= 0 && pixels.every(ink => ink === pixels[0])) quantities[kind]!++;
      else {
        const side = layout.unit, edge = pixels.filter((_ink, i) => i < side || i >= side * (side - 1) || i % side === 0 || i % side === side - 1);
        if (!room.slots.includes(edge[0]!) || !edge.every(ink => ink === edge[0])) return null;
      }
    }
    stock.push(quantities);
    hot.push(!same(room.cold, tile(rows, room.furnace, layout.unit)));
  }
  const workers = scene.panels.map(panel => layout.rooms.findIndex(room => room.marker === panel.room_marker));
  return workers.every(i => i >= 0) ? { stock, workers, hot } : null;
}

export function matchesWorkshopState(observed: WorkshopState | null, expected: WorkshopState) {
  return observed !== null && same(observed.stock, expected.stock) && same(observed.workers, expected.workers) && same(observed.hot, expected.hot);
}

export function planWorkshopTurn(layout: WorkshopLayout, start: WorkshopState, maxTurns: number, shouldStop: () => boolean): WorkshopTurn | null {
  const { rooms, materials } = layout;
  const capacities = rooms.map(room => room.places.length), total = (counts: number[]) => counts.reduce((sum, n) => sum + n, 0);
  const cost = rooms.map((room, r) => materials.map((_ink, m) => m === room.fuel ? 1
    : rooms.some((other, i) => i !== r && other.fuel === m) ? 2 : Infinity));
  for (let iteration = 0; iteration < rooms.length * materials.length; iteration++) {
    for (const [r, room] of rooms.entries()) {
      cost[r]![room.input] = Math.min(cost[r]![room.input]!, 1 + cost[r]![room.output]!);
      for (const values of cost) for (let m = 0; m < materials.length; m++) {
        cost[r]![m] = Math.min(cost[r]![m]!, 1 + values[m]!);
      }
    }
  }
  type Node = { state: WorkshopState; depth: number; first?: WorkshopTurn };
  type PendingNode = Node & { estimate: number; work: number };
  let pending = new Map<number, PendingNode[]>(), prioritizeRemaining = false;
  const seen = new Map<string, number>();
  const workRange = maxTurns * start.workers.length + 1;
  const key = (s: WorkshopState) => JSON.stringify(s);
  function queue(node: PendingNode) {
    const { depth, estimate, work } = node;
    const score = prioritizeRemaining ? (depth + 2 * estimate) * workRange + work : depth + estimate;
    const bucket = pending.get(score);
    if (bucket) bucket.push(node);
    else pending.set(score, [node]);
  }
  function enqueue(node: Node) {
    const address = key(node.state);
    if ((seen.get(address) ?? Infinity) <= node.depth) return;
    seen.set(address, node.depth);
    let work = 0, single = 0;
    for (const [r, values] of node.state.stock.entries()) for (const [m, count] of values.entries()) {
      if (!count) continue;
      const steps = cost[r]![m]!;
      work += steps * count;
      single = Math.max(single, steps);
    }
    const estimate = Math.max(single, Math.ceil(work / start.workers.length));
    if (!Number.isFinite(estimate) || node.depth + estimate > maxTurns) return;
    queue({ ...node, estimate, work });
  }
  enqueue({ state: start, depth: 0 });
  let combinations = 0, interrupted = false;
  for (let steps = 0; pending.size && steps < 20_000; steps++) {
    if (steps % 16 === 0 && shouldStop()) return null;
    if (steps === 4096) {
      // Preserve the explored states and prioritize progress when the frontier grows large.
      const frontier = pending;
      pending = new Map();
      prioritizeRemaining = true;
      for (const bucket of frontier.values()) for (const node of bucket) queue(node);
    }
    const best = Math.min(...pending.keys()), bucket = pending.get(best)!, node = bucket.pop()!;
    if (!bucket.length) pending.delete(best);
    const { stock, workers, hot } = node.state;
    if (node.first && stock.every(counts => counts.every(n => n === 0))) return node.first;
    if (node.depth >= maxTurns || seen.get(key(node.state)) !== node.depth) continue;
    const options = workers.map(r => {
      const room = rooms[r]!, result: (Work | null)[] = [null];
      for (const [m, count] of stock[r]!.entries()) {
        if (!count) continue;
        if (!hot[r] && m === room.fuel) result.push({ input: m, kind: 'burn', target: r });
        if (m === room.input) result.push({ input: m, kind: 'rewrite', target: r });
        for (let t = 0; t < rooms.length; t++) if (r !== t) result.push({ input: m, kind: 'move', target: t });
      }
      return result;
    });
    const jobs: (Work | null)[] = [], reserved = stock.map(counts => counts.map(() => 0)), fires = rooms.map(() => false);
    const counts = stock.map(total);
    function assign(worker: number) {
      if (interrupted) return;
      if (worker === workers.length) {
        if (++combinations % 128 === 0 && shouldStop()) { interrupted = true; return; }
        if (counts.some((count, r) => count > capacities[r]!) || jobs.every(job => !job) && !hot.some(Boolean)) return;
        const next: WorkshopState = { stock: stock.map(values => [...values]), workers: [...workers], hot: [...fires] };
        for (const [i, job] of jobs.entries()) {
          if (!job) continue;
          const r = workers[i]!, source = next.stock[r]!;
          source[job.input]!--;
          if (job.kind === 'rewrite') source[rooms[r]!.output]!++;
          if (job.kind === 'move') {
            next.stock[job.target]![job.input]!++;
            next.workers[i] = job.target;
          }
        }
        enqueue({ state: next, depth: node.depth + 1, first: node.first ?? { jobs: [...jobs], expected: next } });
        return;
      }
      const room = workers[worker]!;
      for (const work of options[worker]!) {
        if (work && (reserved[room]![work.input]! >= stock[room]![work.input]! || work.kind === 'burn' && fires[room])) continue;
        jobs[worker] = work;
        if (work) {
          reserved[room]![work.input]!++;
          if (work.kind === 'burn') fires[room] = true;
          if (work.kind !== 'rewrite') counts[room]!--;
          if (work.kind === 'move') counts[work.target]!++;
        }
        assign(worker + 1);
        if (work) {
          reserved[room]![work.input]!--;
          if (work.kind === 'burn') fires[room] = false;
          if (work.kind !== 'rewrite') counts[room]!++;
          if (work.kind === 'move') counts[work.target]!--;
        }
      }
    }
    assign(0);
    if (interrupted) return null;
  }
  return null;
}

export function nextWorkshopEdit(scene: Scene, layout: WorkshopLayout, state: WorkshopState, turn: WorkshopTurn,
  transport: Pattern) {
  for (const [i, job] of turn.jobs.entries()) {
    const panel: Panel = scene.panels[i]!, room = layout.rooms[state.workers[i]!]!;
    const active = panel.activity_controls.find(cell => cell.outline === panel.selection_color);
    if (!job) {
      if (active) return { panel: i, cell: active, pause: true };
      continue;
    }
    const material = layout.materials[job.input];
    if (panel.material !== material) {
      const cell = panel.cells.find(item => item.col === 0 && item.solid && item.color === material);
      return cell ? { panel: i, cell, pause: false } : undefined;
    }
    const symbol = job.kind === 'burn' ? room.burn : job.kind === 'rewrite' ? room.rewrite : transport;
    const activity = panel.activity_controls.find(cell => same(cell.pattern, symbol));
    if (!activity) return undefined;
    if (activity !== active) return { panel: i, cell: activity, pause: false };
    const value = job.kind === 'rewrite' ? layout.materials[room.output] : layout.rooms[job.target]!.marker;
    const parameters = panel.cells.filter(cell => cell.row === activity.row && cell.col >= 2 && (job.kind === 'burn' ? !cell.solid : cell.solid && cell.color === value));
    if (parameters.length !== 1) return undefined;
    if (parameters[0]!.outline !== panel.selection_color) return { panel: i, cell: parameters[0]!, pause: false };
  }
  return null;
}
