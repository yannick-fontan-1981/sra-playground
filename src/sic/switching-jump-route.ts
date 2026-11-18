import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

export type JumpTile = { box: NativeBox; point: NativePoint; color: number };
export type JumpMemory = { completed: number; side: number; actorArea: number; goalArea: number; ground: number; highlight: number;
  offsets: NativePoint; ref: string };
export type JumpGate = { tile: JumpTile; group: number };
export type SwitchingLayout = { memory: JumpMemory; background: number; cells: JumpTile[]; goal: JumpTile; marker: JumpTile; switches: JumpTile[];
  gates: JumpGate[]; actorInk: number; actorMask: NativePoint[] };
export type SwitchingScene = { layout: SwitchingLayout; actor: JumpTile; moves: JumpTile[]; phase: number;
  collection: 'remaining' | 'under_piece' | 'confirmed'; };
export type SwitchingStep = { target: JumpTile; distance: number; phase: number; switches: boolean };

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const pointKey = (point: NativePoint) => point.join(',');
const jumpFits = (from: JumpTile, to: JumpTile, [short, long]: NativePoint) => {
  const dx = Math.abs(from.point[0] - to.point[0]), dy = Math.abs(from.point[1] - to.point[1]);
  return Math.min(dx, dy) === short && Math.max(dx, dy) === long;
};
const pixel = (rows: NativeRows, tile: JumpTile, x: number, y: number) => rows[tile.box[1] + y]?.[tile.box[0] + x] ?? -1;
function readTile(rows: NativeRows, x: number, y: number, side: number): JumpTile {
  const radius = Math.floor(side / 2);
  return { box: [x, y, x + side - 1, y + side - 1], point: [x + radius, y + radius], color: rows[y]![x]! };
}

function* interior(side: number): Generator<NativePoint> {
  for (let y = 1; y < side - 1; y++) for (let x = 1; x < side - 1; x++) yield [x, y];
}

export function readJumpGate(rows: NativeRows, tile: JumpTile, { side, ground, highlight }: JumpMemory, background: number) {
  const inset = [...interior(side)], edge = side - 2;
  const base = pixel(rows, tile, 0, 0), sides = pixel(rows, tile, 1, 1);
  const isFloor = (ink: number) => ink === ground || ink === highlight;
  if (isFloor(base) && sides !== background && sides !== base && inset.every(([x, y]) =>
    pixel(rows, tile, x, y) === (x === 1 || x === edge ? sides : y === 1 || y === edge ? background : base))) {
    return { group: sides, open: true };
  }
  if (!isFloor(base) && base !== background && sides === background && inset.every(([x, y]) =>
    pixel(rows, tile, x, y) === (x === 1 || x === edge ? background : base))) {
    return { group: base, open: false };
  }
  return null;
}

export function readJumpPhase(rows: NativeRows, gates: readonly JumpGate[], actor: JumpTile, memory: JumpMemory, background: number) {
  const at = pointKey(actor.point);
  const visible = gates.filter(gate => pointKey(gate.tile.point) !== at).map(gate => {
    const current = readJumpGate(rows, gate.tile, memory, background);
    return current?.group === gate.group ? current : null;
  });
  if (visible.some(gate => !gate)) return null;
  const open = new Set(visible.flatMap(gate => gate?.open ? [gate.group] : []));
  if (open.size !== 1 || visible.some(gate => gate && open.has(gate.group) !== gate.open)) return null;
  return [...open][0]!;
}

export function readSwitchingLayout(rows: NativeRows, memory: JumpMemory): SwitchingLayout | null {
  const { side, ground, highlight } = memory, pitch = side + 1;
  if (side < 5 || side > 12) return null;
  const parts = geometricComponents(rows);
  const footprint = parts.filter(part => width(part.bbox) === side && height(part.bbox) === side);
  const actorParts = footprint.filter(part => part.area === memory.actorArea && part.color === ground);
  if (actorParts.length !== 1) return null;
  const [ax, ay] = actorParts[0]!.bbox, actor = readTile(rows, ax, ay, side);
  const onGrid = footprint.filter(({ bbox: [x, y] }) => (x - ax) % pitch === 0 && (y - ay) % pitch === 0);
  const fixtures = onGrid.filter(part => part.color === ground || part.color === highlight);
  const centeredInset = ([l, t, r, b]: NativeBox) => parts.some(({ bbox: [x, y, right, bottom] }) =>
    x > l && y > t && right < r && bottom < b && x + right === l + r && y + bottom === t + b);
  const distinctGoal = fixtures.filter(part => part.area === memory.goalArea
    && centeredInset(part.bbox) && parts.some(({ bbox: [x, y, r, b] }) =>
      x === part.bbox[0] + 1 && y === part.bbox[1] + 1 && r === part.bbox[2] - 1 && b === part.bbox[3] - 1));
  if (distinctGoal.length !== 1) return null;
  const [gx, gy] = distinctGoal[0]!.bbox, goal = readTile(rows, gx, gy, side);
  const background = rows[0]?.[0], actorInk = rows[actor.point[1]]?.[actor.point[0]];
  if (background === undefined || actorInk === undefined || actorInk === ground || actorInk === highlight || actorInk === background) return null;
  const actorMask: NativePoint[] = [];
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    if (pixel(rows, actor, x, y) === actorInk) actorMask.push([x, y]);
  }
  if (actorMask.length < side) return null;

  const gates: JumpGate[] = [], ordinary: JumpTile[] = [actor], markers: JumpTile[] = [];
  const marked = new Map<string, JumpTile[]>();
  for (const part of onGrid) {
    const [x, y, r, b] = part.bbox;
    if ((x === ax && y === ay) || (x === gx && y === gy)) continue;
    const tile = readTile(rows, x, y, side);
    const gate = readJumpGate(rows, tile, memory, background);
    if (gate) {
      gates.push({ tile, group: gate.group });
      continue;
    }
    if (tile.color !== ground && tile.color !== highlight) continue;
    if (part.area === side * side) {
      ordinary.push(tile);
      continue;
    }
    const sealInset = parts.some(({ bbox: [l, t, right, bottom], area, color }) =>
      color !== ground && color !== highlight && l === x + 1 && t === y + 1 && right === r && bottom === b
      && area > side && area < (side - 1) ** 2);
    if (sealInset) {
      markers.push(tile);
      continue;
    }
    const signature = [...interior(side)].map(([lx, ly]) => {
      const value = pixel(rows, tile, lx, ly);
      return value === tile.color ? 'floor' : String(value);
    }).join(',');
    const group = marked.get(signature) ?? [];
    group.push(tile);
    marked.set(signature, group);
  }
  const groups = new Set(gates.map(gate => gate.group));
  const repeatedMarkers = [...marked.values()].filter(group => group.length >= 2);
  if (groups.size !== 2 || gates.length < 4 || ordinary.length < 5 || markers.length !== 1 || repeatedMarkers.length !== 1) return null;
  const marker = markers[0]!, switches = repeatedMarkers[0]!;
  return { memory, background, cells: [...ordinary, ...gates.map(gate => gate.tile), ...switches, goal, marker],
    goal, marker, switches, gates, actorInk, actorMask };
}

export function readSwitchingScene(rows: NativeRows, layout: SwitchingLayout): SwitchingScene | null {
  const { cells, actorInk, actorMask, marker, gates, memory, background, goal } = layout;
  const actors = cells.filter(tile => actorMask.every(([x, y]) => pixel(rows, tile, x, y) === actorInk));
  if (actors.length !== 1) return null;
  const actor = actors[0]!, at = pointKey(actor.point);
  const phase = readJumpPhase(rows, gates, actor, memory, background);
  if (phase === null) return null;
  const moves = cells.filter(tile => tile !== actor && pixel(rows, tile, 0, 0) === memory.highlight);
  const collection = at === pointKey(marker.point) ? 'under_piece'
    : [...interior(memory.side)].every(([x, y]) => pixel(rows, marker, x, y) === pixel(rows, marker, 0, 0)) ? 'confirmed' : 'remaining';
  const closed = new Set(gates.filter(gate => gate.group !== phase).map(gate => pointKey(gate.tile.point)));
  const allowed = (tile: JumpTile) => jumpFits(actor, tile, memory.offsets) && !closed.has(pointKey(tile.point));
  if (!moves.length || moves.some(tile => !allowed(tile))) return null;
  if (cells.some(tile => pointKey(tile.point) !== pointKey(goal.point) && allowed(tile) && !moves.includes(tile))) return null;
  return { layout, actor, phase, moves, collection };
}

export function switchingAttempt(scene: SwitchingScene, target: JumpTile): string {
  return [scene.phase, scene.collection, pointKey(scene.actor.point), pointKey(target.point)].join('/');
}

export function chooseSwitchingJump(scene: SwitchingScene, remaining: number, rejected: readonly string[]): SwitchingStep | null {
  const { layout, actor, phase, collection } = scene, { goal, marker, cells, memory, gates, switches } = layout;
  const gateGroup = new Map(gates.map(gate => [pointKey(gate.tile.point), gate.group]));
  const canToggle = new Set(switches.map(tile => pointKey(tile.point))), phases = [...new Set(gateGroup.values())];
  const goalKey = pointKey(goal.point), markerKey = pointKey(marker.point);
  const neighbors = new Map(cells.map(tile => [tile, cells.filter(to => jumpFits(tile, to, memory.offsets))]));
  type Candidate = { tile: JumpTile; phase: number; acquired: boolean; distance: number; first?: Omit<SwitchingStep, 'distance'> };
  const known = new Set<string>();
  const queue: Candidate[] = [{ tile: actor, phase, acquired: collection !== 'remaining', distance: 0 }];
  for (const move of queue) {
    if (move.distance >= remaining) break;
    for (const tile of neighbors.get(move.tile)!) {
      if (move.distance === 0 && (!scene.moves.includes(tile) || rejected.includes(switchingAttempt(scene, tile)))) continue;
      const tileKey = pointKey(tile.point), group = gateGroup.get(tileKey);
      if (group !== undefined && group !== move.phase) continue;
      const toggles = canToggle.has(tileKey);
      // An alternate phase is a hypothesis until the next public return.
      const nextPhase = toggles ? phases.find(value => value !== move.phase)! : move.phase;
      const acquired = move.acquired || tileKey === markerKey, distance = move.distance + 1;
      const first = move.first ?? { target: tile, phase: nextPhase, switches: toggles };
      if (tileKey === goalKey) {
        if (acquired) return { ...first, distance };
        continue;
      }
      const key = [tileKey, nextPhase, acquired].join(':');
      if (known.has(key)) continue;
      known.add(key);
      queue.push({ tile, phase: nextPhase, acquired, distance, first });
    }
  }
  return null;
}

export function observeSwitchingJump(rows: NativeRows, previous: SwitchingScene, step: SwitchingStep): string | null {
  const next = readSwitchingScene(rows, previous.layout);
  if (!next || pointKey(next.actor.point) !== pointKey(step.target.point) || next.phase !== step.phase) return null;
  const onMarker = pointKey(step.target.point) === pointKey(previous.layout.marker.point);
  const expectedCollection = onMarker ? 'under_piece' : previous.collection === 'under_piece' ? 'confirmed' : previous.collection;
  if (next.collection !== expectedCollection) return null;
  if (step.switches) return 'switch_changed_the_open_group_and_updated_highlights';
  if (onMarker && previous.collection === 'remaining') return 'seal_under_piece_pending_departure';
  if (previous.collection === 'under_piece') return 'seal_absence_verified_after_departure';
  return 'landing_and_phase_specific_highlights_confirmed';
}
