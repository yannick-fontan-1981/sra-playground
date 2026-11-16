import { current_goal_witnesses } from '../logos-engine/v6-inventory-boundary.ts';
import { display_matches, normalized, reverse_transfer, world_complements } from '../logos-engine/v6-inventory-contrast.ts';
import { _unique_action_conditioned_control_centered_grid_candidate, box, detect_components, patch } from '../logos-engine/v6-inventory-measurements.ts';
import type { NativeBox, NativeObservation, NativePoint, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { InventoryPosition, InventoryRouteMap, InventoryRouteStep } from './inventory-route-plan.ts';

type Slot = { bounds: NativeBox; pixels: NativeRows; evidence: string };
type Gauge = { x: number; y: number; value: number };
type Link = { source_cell: NativePoint; target_cell: NativePoint; source_mask: number[][]; source_value: number; shapeOnly?: true };
type ActorTemplate = { relativeBox: NativeBox; pixels: NativeRows };
export type InventoryEvidence = { actor: string; slot: Slot; pitch: number; travel: number[]; scoredPattern: number[];
  controls: Record<string, NativePoint>; meter: Gauge; before: string; after: string; recharge?: number; interaction?: string };
export type InventoryRouteScene = { map: InventoryRouteMap; actor: string; boxes: NativeBox[];
  links: Link[]; slot: Slot; meter: Gauge; moves: { input: string; delta: NativePoint }[]; interaction: string; actorTemplate?: ActorTemplate };
type GridCell = { row: number; col: number; bbox: { left: number; top: number; right: number; bottom: number };
  palette_values: number[]; pattern_occurrence_count: number };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const inside = ([l, t, r, b]: NativeBox, [x, y, u, v]: NativeBox) => l <= x && t <= y && u <= r && v <= b;
const cellBox = ({ bbox: b }: GridCell): NativeBox => [b.left, b.top, b.right, b.bottom];
const pointKey = (point: NativePoint) => point.join(',');
const unambiguous = (links: Link[]) => links.length >= 2 && links.length <= 4
  && new Set(links.map(v => pointKey(v.source_cell))).size === links.length
  && new Set(links.map(v => pointKey(v.target_cell))).size === links.length;

function shapeComplements(cells: GridCell[], rows: NativeRows, floor: NativeRows, excluded: GridCell[]): Link[] {
  const floorInks = new Set(floor.flat()), rim = floor[0]![0]!;
  const components = detect_components(rows, 8).components as { value: number; area: number; bbox: GridCell['bbox'] }[];
  const sources: { cell: NativePoint; points: number[][]; ink: number }[] = [];
  const gates: { cell: NativePoint; aperture: number[][] }[] = [];
  for (const cell of cells) {
    if (excluded.includes(cell)) continue;
    const bounds = cellBox(cell), pixels = patch(rows, bounds);
    const foreign = cell.palette_values.filter(ink => !floorInks.has(ink));
    if (foreign.length !== 1) continue;
    const ink = foreign[0]!, points: number[][] = [], aperture: number[][] = [];
    let untouchedFloor = true;
    for (const [y, line] of pixels.entries()) {
      for (const [x, value] of line.entries()) {
        if (value === ink) points.push([x, y]);
        else {
          aperture.push([x, y]);
          untouchedFloor &&= value === floor[y]![x];
        }
      }
    }
    if (Math.min(points.length, aperture.length) < 2) continue;
    const at: NativePoint = [cell.row, cell.col];
    if (untouchedFloor && components.some(component => component.value === ink && component.area === points.length
      && inside(bounds, [component.bbox.left, component.bbox.top, component.bbox.right, component.bbox.bottom]))) {
      sources.push({ cell: at, points, ink });
    }
    if (!untouchedFloor && cell.palette_values.length === 2 && cell.palette_values.includes(rim)) gates.push({ cell: at, aperture });
  }
  return sources.flatMap(source => gates.flatMap(gate => !same(source.cell, gate.cell) && same(source.points, gate.aperture)
    ? [{ source_cell: source.cell, target_cell: gate.cell, source_mask: normalized(source.points),
      source_value: source.ink, shapeOnly: true as const }] : []));
}

export function readInventoryReserve(rows: NativeRows, gauge: Gauge): number {
  let end = gauge.x;
  while (rows[gauge.y]?.[end] === gauge.value) end++;
  return end - gauge.x;
}

export function readInventoryRoute(rows: NativeRows, observation: NativeObservation, memory: InventoryEvidence) {
  const { slot, meter, interaction, recharge } = memory;
  if (!interaction || !recharge || !observation.available_action_refs.includes(interaction)
    || !same(patch(rows, slot.bounds), slot.pixels)) return null;
  const width = slot.bounds[2] - slot.bounds[0] + 1;
  const slots = observation.entities.filter(entity => {
    const [l, t, r, b] = entity.bbox;
    return t >= slot.bounds[1] && r - l === width - 1 && b - t === width - 1
      && entity.area === 4 * (width - 1) && entity.mask.every(([x, y]) => x === 0 || y === 0 || x === width - 1 || y === width - 1);
  });
  if (slots.length !== 1 || !inside(slots[0]!.bbox, slot.bounds)) return null;
  const actors = observation.entities.filter(entity => entity.signature === memory.actor);
  if (actors.length !== 1) return null;
  const actor = actors[0]!.bbox;
  const grid = _unique_action_conditioned_control_centered_grid_candidate({
    frame: rows, canonical_provisional_control_geometry_bboxes: [box(actor)],
  }, memory.pitch);
  if (!grid) return null;
  const scope = { grids: [grid], body_signature: memory.actor, level_epoch: observation.level_epoch, observation_ref: observation.observation_ref };
  const goals = current_goal_witnesses(scope, rows, [{ role: memory.actor, boundary_before: memory.before,
    boundary_after: memory.after, scoring_pattern: memory.scoredPattern }]);
  if (goals.length !== 1) return null;
  const cells = grid.cells as GridCell[];
  const ordinary = cells.filter(cell => cell.palette_values.length === memory.travel.length
    && cell.palette_values.every(value => memory.travel.includes(value)))
    .sort((a, b) => b.pattern_occurrence_count - a.pattern_occurrence_count)[0];
  if (!ordinary) return null;
  const floor = patch(rows, cellBox(ordinary)), initial = cells.find(cell => inside(cellBox(cell), actor));
  if (!initial) return null;
  const pigmentLinks = world_complements(scope, rows) as Link[];
  const goalCell = cells.find(cell => same([cell.row, cell.col], goals[0]!.current_cell));
  if (!goalCell) return null;
  const links = unambiguous(pigmentLinks) ? pigmentLinks : shapeComplements(cells, rows, floor, [initial, goalCell]);
  if (!unambiguous(links)) return null;
  const nodes: InventoryRouteMap['nodes'] = [], boxes: NativeBox[] = [];
  for (const cell of cells) {
    const at: NativePoint = [cell.row, cell.col], bounds = cellBox(cell), pixels = patch(rows, bounds);
    const gate = links.findIndex(link => same(link.target_cell, at));
    const source = links.some(link => same(link.source_cell, at));
    const walkable = same(pixels, floor);
    const middle = Math.floor(grid.cell_width / 2);
    const charge = pixels[middle]?.[middle] === meter.value
      && pixels.every((row, y) => row.every((ink, x) => (ink === meter.value) === (x === middle || y === middle)));
    if (!walkable && !source && gate === -1 && !charge && cell !== initial && !same(at, goals[0]!.current_cell)) continue;
    nodes.push({ at, ordinary: walkable || cell === initial, gate: gate === -1 ? null : gate, charge });
    boxes.push(bounds);
  }
  if (nodes.filter(node => node.charge).length !== 1) return null;
  const id = (at: NativePoint) => nodes.findIndex(node => same(node.at, at));
  const goal = id(goals[0]!.current_cell), at = id([initial.row, initial.col]);
  const position: InventoryPosition = { at, held: null, objects: links.map(link => id(link.source_cell)),
    opened: 0, charged: false, energy: readInventoryReserve(rows, meter) };
  const moves = Object.entries(memory.controls).flatMap(([input, delta]) => observation.available_action_refs.includes(input)
    && Math.abs(delta[0]) + Math.abs(delta[1]) === 1 ? [{ input, delta }] : []);
  if (goal < 0 || at < 0 || position.objects.some(node => node < 0) || new Set(moves.map(move => pointKey(move.delta))).size !== 4) return null;
  const scene: InventoryRouteScene = { map: { nodes, goal, recharge }, actor: memory.actor, boxes, links, slot, meter, moves, interaction };
  if (links.some(link => link.shapeOnly)) {
    const [left, top] = cellBox(initial);
    scene.actorTemplate = { relativeBox: [actor[0] - left, actor[1] - top, actor[2] - left, actor[3] - top], pixels: patch(rows, actor) };
  }
  return { scene, position };
}

function displayReceipt(scene: InventoryRouteScene, held: number): NativeRecord {
  return { ...scene.links[held]!, display_bbox: scene.slot.bounds };
}

function observedShapeReceipt(scene: InventoryRouteScene, held: number, rows: NativeRows): NativeRecord | null {
  const link = scene.links[held]!, [left, top] = scene.slot.bounds;
  const points: number[][] = [], inks = new Set<number>();
  for (const [y, line] of patch(rows, scene.slot.bounds).entries()) {
    for (const [x, ink] of line.entries()) {
      if (ink === scene.slot.pixels[y]![x]) continue;
      points.push([x, y]);
      inks.add(ink);
    }
  }
  if (inks.size !== 1 || !same(normalized(points), link.source_mask)) return null;
  const x = points.map(point => point[0]! + left), y = points.map(point => point[1]! + top);
  return { ...link, display_value: [...inks][0], display_bbox: [Math.min(...x), Math.min(...y), Math.max(...x), Math.max(...y)] };
}

function actorOverObject(scene: InventoryRouteScene, position: InventoryPosition, rows: NativeRows): NativeBox | null {
  const template = scene.actorTemplate;
  if (!template || !position.objects.some((site, index) => site === position.at && scene.links[index]!.shapeOnly)) return null;
  const [x, y, right, bottom] = template.relativeBox;
  const matches = scene.boxes.flatMap(([l, t], site) => {
    const bounds: NativeBox = [l + x, t + y, l + right, t + bottom];
    return same(patch(rows, bounds), template.pixels) ? [{ bounds, site }] : [];
  });
  return matches.length === 1 && matches[0]!.site === position.at ? matches[0]!.bounds : null;
}

export function inventoryPositionMatches(scene: InventoryRouteScene, position: InventoryPosition, observation: NativeObservation, rows: NativeRows) {
  const actors = observation.entities.filter(entity => entity.signature === scene.actor);
  const actor = actors.length === 1 ? actors[0]!.bbox : actors.length === 0 ? actorOverObject(scene, position, rows) : null;
  if (!actor) return null;
  const contents = position.held === null ? same(patch(rows, scene.slot.bounds), scene.slot.pixels)
    : scene.links[position.held]!.shapeOnly ? observedShapeReceipt(scene, position.held, rows) !== null
      : display_matches(displayReceipt(scene, position.held), rows);
  return inside(scene.boxes[position.at]!, actor) && contents ? actor : null;
}

export function verifyInventoryReturn(scene: InventoryRouteScene, initial: InventoryPosition, step: InventoryRouteStep,
  before: NativeObservation, after: NativeObservation, first: NativeRows, second: NativeRows): number | null {
  const actor = inventoryPositionMatches(scene, step.position, after, second);
  if (!actor) return null;
  const energy = readInventoryReserve(second, scene.meter);
  if (step.kind === 'charge' ? energy <= initial.energy : energy !== initial.energy - 1) return null;
  if (step.kind === 'deposit' && initial.held !== null) {
    const receipt = scene.links[initial.held]!.shapeOnly ? observedShapeReceipt(scene, initial.held, first) : displayReceipt(scene, initial.held);
    if (!receipt) return null;
    const bounds = scene.boxes[step.position.at]!;
    const delta = reverse_transfer(receipt, before, after, first, second,
      { body: actor, grids: [{ cells: [{ bbox: box(bounds) }] }] });
    if (delta.status !== 'unique_reverse_correspondence') return null;
  }
  return energy;
}
