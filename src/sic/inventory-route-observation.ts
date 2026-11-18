import { complements, current_goal_witnesses } from '../logos-engine/v6-inventory-boundary.ts';
import { display_matches, normalized, reverse_transfer, world_complements } from '../logos-engine/v6-inventory-contrast.ts';
import { _unique_action_conditioned_control_centered_grid_candidate, box, detect_components, patch } from '../logos-engine/v6-inventory-measurements.ts';
import type { NativeBox, NativeObservation, NativePoint, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { replaceInSlot, slotContents, type InventoryPosition, type InventoryRouteMap, type InventoryRouteStep } from './inventory-route-plan.ts';

type Slot = { bounds: NativeBox; pixels: NativeRows; evidence: string };
type Gauge = { x: number; y: number; value: number };
type Link = { source_cell: NativePoint; target_cell: NativePoint; source_mask: number[][]; source_value: number; shapeOnly?: true };
type ActorTemplate = { relativeBox: NativeBox; pixels: NativeRows };
export type InventoryEvidence = { actor: string; slot: Slot; pitch: number; travel: number[]; scoredPattern: number[];
  controls: Record<string, NativePoint>; meter: Gauge; before: string; after: string; recharge?: number; interaction?: string };
export type InventoryRouteScene = { map: InventoryRouteMap; actor: string; boxes: NativeBox[];
  links: Link[]; slot: Slot; slots?: Slot[]; meter: Gauge; moves: { input: string; delta: NativePoint }[]; interaction: string; actorTemplate?: ActorTemplate;
  opaqueSlotInk?: number };
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

function occupiedSlotInk(rows: NativeRows, slot: Slot): number | undefined {
  const pixels = patch(rows, slot.bounds), last = slot.pixels.length - 1;
  const ink = pixels[1]?.[1], corner = pixels[0]?.[0];
  if (last < 2 || pixels.length !== last + 1 || pixels.some(row => row.length !== last + 1)
    || ink === undefined || corner === undefined || slot.pixels.flat().includes(ink)) return undefined;
  return pixels.every((row, y) => row.every((value, x) => {
    const outerX = x === 0 || x === last, outerY = y === 0 || y === last;
    return value === (outerX && outerY ? corner : outerX || outerY ? slot.pixels[y]![x] : ink);
  })) ? ink : undefined;
}

export function readInventoryRoute(rows: NativeRows, observation: NativeObservation, memory: InventoryEvidence, previous?: InventoryRouteScene) {
  const { meter, interaction, recharge } = memory;
  let { slot } = memory;
  if (!interaction || !recharge || !observation.available_action_refs.includes(interaction)) return null;
  let opaqueSlotInk: number | undefined;
  if (!same(patch(rows, slot.bounds), slot.pixels)) {
    const remembered = previous?.slots?.find(candidate => inside(candidate.bounds, slot.bounds));
    if (!remembered) return null;
    opaqueSlotInk = occupiedSlotInk(rows, remembered);
    if (opaqueSlotInk === undefined) return null;
    slot = remembered;
  }
  const width = slot.bounds[2] - slot.bounds[0] + 1;
  const frames = observation.entities.filter(entity => {
    const [l, t, r, b] = entity.bbox;
    return t >= slot.bounds[1] && r - l === width - 1 && b - t === width - 1
      && entity.area === 4 * (width - 1) && entity.mask.every(([x, y]) => x === 0 || y === 0 || x === width - 1 || y === width - 1);
  });
  const primary = frames.find(frame => inside(frame.bbox, slot.bounds));
  if (opaqueSlotInk === undefined ? !primary : frames.some(frame => !inside(frame.bbox, slot.bounds))) return null;
  const emptyFrame = primary ? patch(rows, primary.bbox) : slot.pixels;
  const slots = frames.length <= 1 ? [slot] : frames.map(({ bbox: bounds }) => ({
    bounds, pixels: patch(rows, bounds), evidence: observation.observation_ref,
  })).sort((a, b) => a.bounds[0] - b.bounds[0]);
  if (slots.length > 1 && !slots.every(candidate => candidate.bounds[1] === primary!.bbox[1]
    && same(candidate.pixels, emptyFrame))) return null;
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
  const pigmentLinks = world_complements(scope, rows, opaqueSlotInk !== undefined) as Link[];
  const goalCell = cells.find(cell => same([cell.row, cell.col], goals[0]!.current_cell));
  if (!goalCell) return null;
  const initialCell: NativePoint = [initial.row, initial.col];
  const carry = opaqueSlotInk === undefined ? [] : (previous?.links ?? []).flatMap(link => {
    if (link.shapeOnly || pigmentLinks.some(found => found.source_value === link.source_value && same(found.source_mask, link.source_mask))) return [];
    const targets = complements(scope, rows, link).filter(target => !pigmentLinks.some(found =>
      same(found.target_cell, [target.target_row, target.target_col])));
    return targets.length ? [{ link, targets }] : [];
  });
  if (opaqueSlotInk !== undefined && carry.length !== 1) return null;
  for (const { link, targets } of carry) for (const target of targets) pigmentLinks.push({
    source_cell: initialCell, target_cell: [target.target_row, target.target_col], source_mask: link.source_mask, source_value: link.source_value,
  });
  const hasSeparateGates = pigmentLinks.length >= 2 && pigmentLinks.length <= 8
    && new Set(pigmentLinks.map(link => pointKey(link.target_cell))).size === pigmentLinks.length;
  const sharedKeys = (slots.length > 1 || carry.length === 1) && hasSeparateGates && !unambiguous(pigmentLinks)
    && pigmentLinks.every(link => pigmentLinks.filter(other => same(link.source_cell, other.source_cell))
      .every(other => link.source_value === other.source_value && same(link.source_mask, other.source_mask)));
  const gates = unambiguous(pigmentLinks) || sharedKeys ? pigmentLinks : shapeComplements(cells, rows, floor, [initial, goalCell]);
  if (!sharedKeys && !unambiguous(gates)) return null;
  const links = gates.filter((link, i) => gates.findIndex(other => same(link.source_cell, other.source_cell)) === i);
  const gateKeys = gates.map(gate => links.findIndex(link => same(link.source_cell, gate.source_cell)));
  const reusable = gateKeys.filter((key, i) => gateKeys.indexOf(key) !== i);
  const nodes: InventoryRouteMap['nodes'] = [], boxes: NativeBox[] = [];
  for (const cell of cells) {
    const at: NativePoint = [cell.row, cell.col], bounds = cellBox(cell), pixels = patch(rows, bounds);
    const gate = gates.findIndex(link => same(link.target_cell, at));
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
  const goal = id(goals[0]!.current_cell), at = id(initialCell);
  const carriedKey = carry.length ? links.findIndex(link => same(link.source_cell, initialCell)) : -1;
  if (carry.length && carriedKey < 0) return null;
  const position: InventoryPosition = { at, held: slots.length === 1 ? carriedKey < 0 ? null : carriedKey : slots.map(() => null),
    objects: links.map((link, index) => index === carriedKey ? -1 : id(link.source_cell)),
    opened: 0, charged: false, energy: readInventoryReserve(rows, meter) };
  const moves = Object.entries(memory.controls).flatMap(([input, delta]) => observation.available_action_refs.includes(input)
    && Math.abs(delta[0]) + Math.abs(delta[1]) === 1 ? [{ input, delta }] : []);
  if (goal < 0 || at < 0 || position.objects.some((node, index) => node < 0 && index !== carriedKey)
    || new Set(moves.map(move => pointKey(move.delta))).size !== 4) return null;
  const scene: InventoryRouteScene = { map: { nodes, goal, recharge, ...(sharedKeys ? { gateKeys, reusable } : {}) },
    actor: memory.actor, boxes, links, slot: slots.length === 1 ? slot : slots[0]!, meter, moves, interaction,
    ...(opaqueSlotInk === undefined ? {} : { opaqueSlotInk }),
    ...(slots.length > 1 ? { slots } : {}) };
  if (scene.slots || opaqueSlotInk !== undefined || links.some(link => link.shapeOnly)) {
    const [left, top] = cellBox(initial);
    scene.actorTemplate = { relativeBox: [actor[0] - left, actor[1] - top, actor[2] - left, actor[3] - top], pixels: patch(rows, actor) };
  }
  return { scene, position };
}

function displayReceipt(scene: InventoryRouteScene, held: number): NativeRecord {
  if (scene.opaqueSlotInk !== undefined) {
    const [left, top, right, bottom] = scene.slot.bounds;
    const bounds: NativeBox = [left + 1, top + 1, right - 1, bottom - 1];
    const display_mask: NativePoint[] = [];
    for (let y = 0; y <= bounds[3] - bounds[1]; y++) for (let x = 0; x <= bounds[2] - bounds[0]; x++) display_mask.push([x, y]);
    return { ...scene.links[held]!, display_bbox: bounds, display_mask, display_value: scene.opaqueSlotInk };
  }
  return { ...scene.links[held]!, display_bbox: scene.slot.bounds };
}

function observedShapeReceipt(scene: InventoryRouteScene, held: number, rows: NativeRows, slot = scene.slot): NativeRecord | null {
  const link = scene.links[held]!, [left, top] = slot.bounds;
  const points: number[][] = [], inks = new Set<number>();
  for (const [y, line] of patch(rows, slot.bounds).entries()) {
    for (const [x, ink] of line.entries()) {
      if (ink === slot.pixels[y]![x]) continue;
      if (scene.slots && !link.shapeOnly && ink !== link.source_value) continue;
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
  if (!template || !position.objects.some((site, index) => site === position.at
    && (scene.slots || scene.opaqueSlotInk !== undefined || scene.links[index]!.shapeOnly))) return null;
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
  const contents = slotContents(position.held).every((held, index) => {
    const slot = scene.slots?.[index] ?? scene.slot;
    if (held === null) return same(patch(rows, slot.bounds), slot.pixels);
    if (scene.opaqueSlotInk !== undefined) return occupiedSlotInk(rows, slot) === scene.opaqueSlotInk;
    if (scene.slots || scene.links[held]!.shapeOnly) {
      const receipt = observedShapeReceipt(scene, held, rows, slot);
      return !!receipt && (scene.links[held]!.shapeOnly || receipt.display_value === scene.links[held]!.source_value);
    }
    return display_matches(displayReceipt(scene, held), rows);
  });
  return inside(scene.boxes[position.at]!, actor) && contents ? actor : null;
}

export function reusableKeyAt(scene: InventoryRouteScene, step: InventoryRouteStep): number | null {
  const gate = scene.map.nodes[step.position.at]!.gate;
  const key = gate === null ? null : scene.map.gateKeys?.[gate] ?? gate;
  return step.kind === 'unlock' && key !== null && scene.map.reusable?.includes(key) ? key : null;
}

export function verifyInventoryReturn(scene: InventoryRouteScene, initial: InventoryPosition, step: InventoryRouteStep,
  before: NativeObservation, after: NativeObservation, first: NativeRows, second: NativeRows): InventoryPosition | null {
  let position = step.position, actor = inventoryPositionMatches(scene, position, after, second);
  const reuse = reusableKeyAt(scene, step);
  if (!actor && reuse !== null) {
    const slot = slotContents(initial.held).indexOf(reuse);
    if (slot >= 0) {
      position = { ...position, held: replaceInSlot(position.held, slot, null) };
      actor = inventoryPositionMatches(scene, position, after, second);
    }
  }
  if (!actor) return null;
  const energy = readInventoryReserve(second, scene.meter);
  if (step.kind === 'charge' ? energy <= initial.energy : energy !== initial.energy - 1) return null;
  if (step.kind === 'deposit' && typeof initial.held === 'number') {
    const receipt = scene.links[initial.held]!.shapeOnly ? observedShapeReceipt(scene, initial.held, first) : displayReceipt(scene, initial.held);
    if (!receipt) return null;
    const bounds = scene.boxes[step.position.at]!;
    const delta = reverse_transfer(receipt, before, after, first, second,
      { body: actor, grids: [{ cells: [{ bbox: box(bounds) }] }] });
    if (delta.status !== 'unique_reverse_correspondence') return null;
  }
  return { ...position, energy };
}
