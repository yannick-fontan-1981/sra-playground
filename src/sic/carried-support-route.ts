import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import { symbolicDigest } from '../logos-engine/v6-hash.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { measureAnimatedCells } from './observed-animation.ts';
import { observedCommandFrontier, rememberCommandReturn, type ObservedCommandGraph } from './observed-command-frontier.ts';
import { visibleCommandPanel } from './visible-command-panel.ts';

type Part = ReturnType<typeof geometricComponents>[number];
type GripSide = { axis: 0 | 1; high: boolean };
type ToolLayout = {
  field: NativeBox; voids: number[]; actorInk: number; targetInk: number; pitch: number;
  buttons: NativeBox[]; latch: NativeBox; switches: { box: NativeBox; ink: number }[];
  toolInk: number; handleInk: number; handleArea: number; railInk: number; mouth: GripSide;
  supportMask: readonly NativePoint[]; supportSize: NativePoint; priorControlInks: number[];
};
type Pose = { actor: NativePoint; tool: Part; support: Pick<Part, 'bbox' | 'mask'> };
type Grip = 'open' | 'pending' | 'held';
type Portal = { index: number; pads: [NativePoint, NativePoint] };
type SurfaceEdit = { cell: string; before: string; after: string };
type SwitchEffect = { index: number; edits: SurfaceEdit[] };
export type CarriedSupport = {
  layout: ToolLayout; grip: Grip; graph: ObservedCommandGraph; vectors: Record<string, NativePoint>;
  gripTests: string[]; rail: number[]; heldOrigin?: NativePoint; relativeSupport?: NativePoint;
  gateTests: { index: number; source: string }[]; switchEffects: SwitchEffect[];
  interruptedSwitches?: { index: number; actor: string }[];
  blocked: string[]; stableActor: boolean; portals: Portal[]; usedPortals: number[];
  markerTests: string[];
};
export type CarriedStep = { label: string; expectedActor?: NativePoint; expectedTool?: NativePoint } & (
  { kind: 'button'; index: number; probe: boolean; point: NativePoint }
  | { kind: 'grip'; point: NativePoint }
  | { kind: 'walk'; direction: string; expectedActor: NativePoint; carried: boolean; discoveryInk?: number }
  | { kind: 'switch'; index: number; point: NativePoint; probe: boolean; edits?: SurfaceEdit[] }
  | { kind: 'portal'; point: NativePoint; expectedActor: NativePoint }
);

const dirs = [['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION3', -1, 0], ['ACTION4', 1, 0]] as const;
const key = (p: NativePoint) => p.join(',');
const point = (k: string) => k.split(',').map(Number) as [number, number];
const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const delta = ([x, y]: NativePoint, [u, v]: NativePoint): NativePoint => [u - x, v - y];
const shift = ([x, y]: NativePoint, [dx, dy]: NativePoint): NativePoint => [x + dx, y + dy];
const origin = ([x, y]: NativeBox): NativePoint => [x, y];
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const span = (box: NativeBox, axis: number) => box[axis + 2]! - box[axis]! + 1;
const inside = ([l, t, r, b]: NativeBox, [x, y, u, v]: NativeBox) => l <= x && t <= y && u <= r && v <= b;
const intersects = (a: NativeBox, b: NativeBox) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const distance = (a: NativePoint, b: NativePoint) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

function face(part: Part, { axis, high }: GripSide) {
  const normal = high ? span(part.bbox, axis) - 1 : 0;
  return new Set(part.mask.filter(p => p[axis] === normal).map(p => p[1 - axis]!));
}

function mouth(part: Part): GripSide | null {
  const options: GripSide[] = [];
  for (const axis of [0, 1] as const) for (const high of [false, true]) {
    const shape = face(part, { axis, high }), transverse = span(part.bbox, 1 - axis);
    if (transverse >= 4 && shape.has(0) && shape.has(transverse - 1) && !shape.has(Math.floor(transverse / 2))) {
      options.push({ axis, high });
    }
  }
  return options.length === 1 ? options[0]! : null;
}

export function measureCarriedSupport(rows: NativeRows, known: { pitch: number; actor: number; target: number; controlColors?: number[] }): CarriedSupport | null {
  const parts = geometricComponents(rows), panel = visibleCommandPanel(rows, parts);
  if (!panel || panel.aligned.length !== dirs.length) return null;
  const world = parts.filter(part => inside(panel.area, part.bbox));
  const narrow = panel.buttons.filter(p => !panel.aligned.includes(p) && p.rectangular
    && (span(p.bbox, 0) >= 3 * span(p.bbox, 1) || span(p.bbox, 1) >= 3 * span(p.bbox, 0)));
  const devices = world.flatMap(tool => {
    if (tool.rectangular || tool.area < 12) return [];
    const side = mouth(tool), latch = narrow.filter(p => p.color === tool.color);
    return side && latch.length === 1 ? [{ tool, side, latch: latch[0]! }] : [];
  });
  if (devices.length !== 1) return null;
  const { tool, side, latch } = devices[0]!, transverse = 1 - side.axis;
  const candidates = world.filter(p => p.color !== tool.color && !p.rectangular && p.area > tool.area
    && span(p.bbox, transverse) >= span(tool.bbox, transverse) && p.area * 8 < rows.length * rows[0]!.length)
    .filter(p => {
      const edge = face(p, { axis: side.axis, high: !side.high }), length = span(p.bbox, transverse);
      return edge.has(Math.floor(length / 2)) && !edge.has(0) && !edge.has(length - 1);
    });
  const rails = [...new Set(world.filter(p => p.color !== tool.color && !p.rectangular && p.area > tool.area
    && p.area * 8 < rows.length * rows[0]!.length && intersects(p.bbox, tool.bbox)).map(p => p.color))];
  if (candidates.length !== 1 || rails.length !== 1) return null;
  const support = candidates[0]!, [x, y] = origin(panel.area);
  const layout: ToolLayout = { field: panel.area, voids: [rows[y]![x]!, rows[panel.panel[1]]![panel.panel[0]]!, tool.color, rails[0]!],
    actorInk: known.actor, targetInk: known.target, pitch: known.pitch,
    toolInk: tool.color, handleInk: support.color, handleArea: support.area, railInk: rails[0]!, mouth: side,
    supportMask: support.mask, supportSize: [span(support.bbox, 0), span(support.bbox, 1)],
    priorControlInks: known.controlColors ?? [],
    buttons: panel.aligned.map(p => p.bbox), latch: latch.bbox,
    switches: panel.buttons.filter(p => p !== latch && !panel.aligned.includes(p)).map(p => ({ box: p.bbox, ink: p.color })) };
  return readPose(layout, rows) ? { layout, grip: 'open', graph: {}, vectors: {}, gripTests: [], rail: [],
    gateTests: [], switchEffects: [], interruptedSwitches: [], blocked: [], stableActor: true, portals: [], usedPortals: [], markerTests: [] } : null;
}

function readPose(layout: ToolLayout, rows: NativeRows, relative?: NativePoint): Pose | null {
  const parts = geometricComponents(rows).filter(p => inside(layout.field, p.bbox));
  const actors = parts.filter(p => p.color === layout.actorInk && p.area === layout.pitch ** 2
    && span(p.bbox, 0) === layout.pitch && span(p.bbox, 1) === layout.pitch);
  const tools = parts.filter(p => p.color === layout.toolInk && !p.rectangular && p.area >= 12);
  const supports = parts.filter(p => p.color === layout.handleInk && p.area === layout.handleArea);
  if (actors.length !== 1 || tools.length !== 1) return null;
  const actor = actors[0]!, tool = tools[0]!;
  if (supports.length === 1) return { actor: origin(actor.bbox), tool, support: supports[0]! };
  if (!relative || supports.length) return null;
  const at = shift(origin(tool.bbox), relative), [x, y] = at;
  const bbox: NativeBox = [x, y, x + layout.supportSize[0] - 1, y + layout.supportSize[1] - 1];
  if (!intersects(bbox, actor.bbox) || !layout.supportMask.every(offset => {
    const [u, v] = shift(at, offset), value = rows[v]?.[u];
    return value === layout.handleInk || value === layout.actorInk && inside(actor.bbox, [u, v, u, v]);
  })) return null;
  return { actor: origin(actor.bbox), tool, support: { bbox, mask: layout.supportMask } };
}

function docked(layout: ToolLayout, pose: Pose) {
  const { axis, high } = layout.mouth, tool = pose.tool.bbox, support = pose.support.bbox;
  const face = high ? tool[axis + 2]! : tool[axis]!;
  const tip = high ? support[axis]! : support[axis + 2]!;
  const depth = (face - tip) * (high ? 1 : -1), across = 1 - axis;
  return depth >= 0 && depth < layout.pitch && Math.abs(center(tool)[across]! - center(support)[across]!) < layout.pitch;
}

function buttonStep(state: CarriedSupport, at: NativePoint, remaining: number): CarriedStep | null {
  const options = state.layout.buttons.map((_, i) => String(i));
  const frontier = observedCommandFrontier(state.graph, key(at), options, remaining);
  if (!frontier) return null;
  const index = Number(frontier.action);
  return { kind: 'button', index, point: center(state.layout.buttons[index]!), probe: !frontier.first,
    ...(frontier.first?.destination ? { expectedTool: point(frontier.first.destination) } : {}),
    label: state.grip === 'open' ? 'Measure the panel command and approach the matching grip'
      : 'Check the next position of the tool and the attached support' };
}

function approachGrip(state: CarriedSupport, pose: Pose): CarriedStep | null {
  const { axis, high } = state.layout.mouth, across = 1 - axis;
  const [tool, support] = [pose.tool.bbox, pose.support.bbox];
  const distanceToGrip = (m: NativePoint) => {
    const perpendicular = Math.abs(center(tool)[across]! + m[across]! - center(support)[across]!);
    const reach = tool[axis + (high ? 2 : 0)]! + m[axis]! - support[axis + (high ? 0 : 2)]!;
    return perpendicular * 2 + Math.abs(reach);
  };
  const at = origin(tool), current = distanceToGrip([0, 0]);
  const best = Object.entries(state.vectors).flatMap(([button, move]) => {
    const existing = state.graph[key(at)]?.find(edge => edge.action === button);
    const next = shift(at, move), cost = distanceToGrip(move);
    return cost < current && (!existing || existing.destination === key(next)) ? [{ index: Number(button), next, cost, existing }] : [];
  }).sort((a, b) => a.cost - b.cost)[0];
  return best ? { kind: 'button', index: best.index, point: center(state.layout.buttons[best.index]!), probe: !best.existing,
    ...(best.existing ? { expectedTool: best.next } : {}), label: 'Try the measured motion that brings the grip closer to the handle' } : null;
}

function railPixels(layout: ToolLayout, rows: NativeRows, previous: number[]) {
  const pixels = new Set(previous), [l, t, r, b] = layout.field, width = rows[0]!.length;
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) if (rows[y]?.[x] === layout.railInk) pixels.add(y * width + x);
  return [...pixels];
}

function projectedRail(state: CarriedSupport, pose: Pose, width: number): Map<string, NativePoint> | null {
  if (!state.heldOrigin || Object.keys(state.vectors).length !== state.layout.buttons.length) return null;
  const root = state.heldOrigin, rail = new Set(state.rail), moves = Object.entries(state.vectors);
  const layouts = new Map<string, Map<string, NativePoint>>();
  for (let y = 0; y < span(pose.tool.bbox, 1); y++) for (let x = 0; x < span(pose.tool.bbox, 0); x++) {
    const queue = [root], valid = new Map([[key(root), root]]);
    for (const p of queue) for (const [, move] of moves) {
      const next = shift(p, move), id = key(next);
      if (!valid.has(id) && rail.has((next[1] + y) * width + next[0] + x)) {
        valid.set(id, next);
        queue.push(next);
      }
    }
    if (!Object.entries(state.graph).every(([from, edges]) => valid.has(from) && edges.every(edge => {
      const vector = state.vectors[edge.action];
      const next = vector ? key(shift(point(from), vector)) : from;
      return !vector || (valid.has(next) ? next : from) === edge.destination;
    }))) continue;
    layouts.set([...valid.keys()].sort().join(';'), valid);
  }
  return layouts.size === 1 ? layouts.values().next().value! : null;
}

function tile(rows: NativeRows, [x, y]: NativePoint, pitch: number) {
  return rows.slice(y, y + pitch).flatMap(row => row.slice(x, x + pitch));
}

const tileKey = (rows: NativeRows, p: NativePoint, pitch: number) => tile(rows, p, pitch).join(',');

function surfaceCells({ field: [l, t, r, b], pitch }: ToolLayout, from: NativePoint): NativePoint[] {
  const cells: NativePoint[] = [];
  for (let y = t + (from[1] - t) % pitch; y + pitch - 1 <= b; y += pitch) {
    for (let x = l + (from[0] - l) % pitch; x + pitch - 1 <= r; x += pitch) cells.push([x, y]);
  }
  return cells;
}

function switchScope(layout: ToolLayout, rows: NativeRows, actor: NativePoint) {
  return symbolicDigest(surfaceCells(layout, actor).map(p => tile(rows, p, layout.pitch).map(ink =>
    ink === layout.actorInk || ink === layout.handleInk || ink === layout.toolInk ? null : ink)));
}

function isSupportedTile(layout: ToolLayout, pixels: number[]) {
  const ink = pixels[0];
  if (ink === undefined || pixels.some(value => layout.voids.includes(value))) return false;
  return pixels.every(value => value === ink) && ink !== layout.handleInk && ink !== layout.actorInk
    || pixels.length === 4 && ink === pixels[3] && pixels[1] === pixels[2] && ink !== pixels[1];
}

function readTerrain(layout: ToolLayout, rows: NativeRows, from: NativePoint) {
  const { field: [l, t, r, b], pitch, handleInk, actorInk, targetInk, voids } = layout;
  const floor = new Set<string>(), pads = new Map<string, { point: NativePoint; inks: number[] }[]>();
  const missing = layout.priorControlInks.filter(ink => ink !== layout.toolInk && !layout.switches.some(p => p.ink === ink));
  const markers = new Map<string, number>();
  let target: NativePoint | null = null;
  for (let y = t + (from[1] - t) % pitch; y + pitch - 1 <= b; y += pitch) {
    for (let x = l + (from[0] - l) % pitch; x + pitch - 1 <= r; x += pitch) {
      const at: NativePoint = [x, y], pixels = tile(rows, at, pitch), ink = pixels[0]!;
      if (voids.some(value => pixels.includes(value))) continue;
      if (pixels.every(value => value === ink) && ink !== handleInk && ink !== actorInk) {
        floor.add(key(at));
        if (ink === targetInk) target = at;
      } else if (pixels.length === 4 && ink === pixels[3] && pixels[1] === pixels[2] && ink !== pixels[1]) {
        floor.add(key(at));
        const inks = [ink, pixels[1]!].sort((a, b) => a - b), id = inks.join(',');
        const group = pads.get(id) ?? [];
        group.push({ point: at, inks });
        pads.set(id, group);
      } else if (new Set(pixels).size === 2) {
        const matching = missing.filter(color => pixels.includes(color));
        if (matching.length === 1) {
          floor.add(key(at));
          markers.set(key(at), matching[0]!);
        }
      }
    }
  }
  const portals = [...pads.values()].flatMap(group => {
    if (group.length !== 2) return [];
    const controls = layout.switches.flatMap(({ ink }, i) => group[0]!.inks.includes(ink) ? [i] : []);
    return controls.length === 1 ? [{ index: controls[0]!, pads: group.map(p => p.point) as Portal['pads'] }] : [];
  });
  return { floor, target, portals, markers };
}

function blockedKey(layout: ToolLayout, rows: NativeRows, from: NativePoint, to: NativePoint) {
  return [key(from), key(to), tileKey(rows, to, layout.pitch)].join('/');
}

function knownPoses(state: CarriedSupport) {
  const keys = new Set(Object.keys(state.graph));
  for (const edges of Object.values(state.graph)) for (const edge of edges) if (edge.destination) keys.add(edge.destination);
  return new Map([...keys].map(k => [k, point(k)]));
}

function planPassage(state: CarriedSupport, rows: NativeRows, pose: Pose, poses: Map<string, NativePoint>, remaining: number) {
  const { layout } = state, { pitch } = layout, { floor, target, portals, markers } = readTerrain(layout, rows, pose.actor);
  const currentTool = origin(pose.tool.bbox), currentSupport = origin(pose.support.bbox);
  if (state.stableActor) floor.add(key(pose.actor));
  const platform = new Set(pose.support.mask.map(p => key(shift(currentSupport, p))));
  const offsets = Array.from({ length: pitch ** 2 }, (_, i): NativePoint => [i % pitch, Math.floor(i / pitch)]);
  const standable = surfaceCells(layout, pose.actor).filter(at => offsets.every(offset => platform.has(key(shift(at, offset)))));
  const placements = new Map(poses);
  placements.set(key(currentTool), currentTool);
  const floorsAtPose = new Map<string, Set<string>>();
  for (const [id, tool] of placements) floorsAtPose.set(id, new Set(standable.map(at => key(shift(at, delta(currentTool, tool))))));
  const supported = (p: NativePoint, tool: NativePoint) => floorsAtPose.get(key(tool))?.has(key(p)) === true;
  const paired = [...new Map([...state.portals, ...portals].map(portal => [portal.index, portal])).values()]
    .filter(portal => !state.usedPortals.includes(portal.index));
  const cells = [...new Set(state.switchEffects.flatMap(effect => effect.edits.map(edit => edit.cell)))];
  const initial = new Map(cells.map(id => [id, tileKey(rows, point(id), pitch)]));
  const blocked = new Set(state.blocked);
  const interrupted = new Map<number, Set<string>>();
  for (const { index, actor } of state.interruptedSwitches ?? []) {
    const positions = interrupted.get(index) ?? new Set<string>();
    positions.add(actor);
    interrupted.set(index, positions);
  }
  const signatures = blocked.size ? new Map(surfaceCells(layout, pose.actor).map(at => [key(at), tileKey(rows, at, pitch)])) : null;
  const surfaceId = (surface: ReadonlyMap<string, string>) => cells.map(id => surface.get(id)).join(';');
  type Node = { actor: NativePoint; tool: NativePoint; steps: number; first: CarriedStep | null;
    surface: ReadonlyMap<string, string>; surfaceId: string };
  const routeKey = (actor: NativePoint, tool: NativePoint, shape: string) => [key(actor), key(tool), shape].join('/');
  const queue: Node[] = [{ actor: pose.actor, tool: currentTool, steps: 0, first: null, surface: initial, surfaceId: surfaceId(initial) }];
  const seen = new Set([routeKey(pose.actor, currentTool, queue[0]!.surfaceId)]);
  let milestone: CarriedStep | null = null;
  for (const node of queue) {
    if (target && node.first && same(node.actor, target)) return node.first;
    const marker = markers.get(key(node.actor));
    if (node.first && marker !== undefined && !milestone && !state.markerTests.includes(key(node.actor))) milestone = node.first;
    const portal = paired.find(item => item.pads.some(pad => same(pad, node.actor)));
    if (portal && !milestone) {
      milestone = node.first ?? { kind: 'portal', point: center(layout.switches[portal.index]!.box),
        expectedActor: portal.pads.find(p => !same(p, node.actor))!, label: 'Use the paired transfer from the reached island' };
    }
    if (node.steps >= remaining || queue.length >= 20_000) continue;
    const add = (actor: NativePoint, tool: NativePoint, first: CarriedStep, surface = node.surface) => {
      const shape = surface === node.surface ? node.surfaceId : surfaceId(surface);
      const id = routeKey(actor, tool, shape);
      if (seen.has(id)) return;
      seen.add(id);
      queue.push({ actor, tool, steps: node.steps + 1, first: node.first ?? first, surface, surfaceId: shape });
    };
    const fixed = (at: NativePoint) => {
      const value = node.surface.get(key(at));
      if (value !== undefined && value !== initial.get(key(at))) return isSupportedTile(layout, value.split(',').map(Number));
      return floor.has(key(at));
    };
    for (const [direction, dx, dy] of dirs) {
      const to = shift(node.actor, [dx * pitch, dy * pitch]);
      const refused = signatures && [key(node.actor), key(to), node.surface.get(key(to)) ?? signatures.get(key(to))].join('/');
      if ((fixed(to) || supported(to, node.tool)) && (!refused || !blocked.has(refused))) {
        const discoveryInk = markers.get(key(to));
        add(to, node.tool, { kind: 'walk', direction, expectedActor: to, carried: !fixed(to),
          ...(discoveryInk !== undefined ? { discoveryInk } : {}),
          label: discoveryInk === undefined ? 'Cross the support placed between two observed islands'
            : 'Reach a marker that may reveal the missing control' });
      }
    }
    if (!fixed(node.actor) || supported(node.actor, node.tool)) continue;
    for (const { index, edits } of state.switchEffects) {
      if (interrupted.get(index)?.has(key(node.actor))) continue;
      if (!edits.every(edit => node.surface.get(edit.cell) === edit.before && edit.cell !== key(node.actor))) continue;
      const surface = new Map(node.surface);
      for (const edit of edits) surface.set(edit.cell, edit.after);
      add(node.actor, node.tool, { kind: 'switch', index, point: center(layout.switches[index]!.box), probe: false, edits,
        label: 'Change the passage using a measured switch effect' }, surface);
    }
    for (const [button, vector] of Object.entries(state.vectors)) {
      const next = shift(node.tool, vector), index = Number(button);
      const known = state.graph[key(node.tool)]?.find(edge => edge.action === button);
      if (!poses.has(key(next)) || known && known.destination !== key(next) || supported(node.actor, next)) continue;
      add(node.actor, next, { kind: 'button', index, point: center(layout.buttons[index]!), expectedTool: next, probe: !known,
        label: 'Place the carried support to make the next island reachable' });
    }
  }
  return milestone;
}

export function nextCarriedStep(state: CarriedSupport, rows: NativeRows, remaining: number): CarriedStep | null {
  const pose = readPose(state.layout, rows, state.relativeSupport);
  if (!pose || remaining < 1) return null;
  const tool = origin(pose.tool.bbox);
  if (state.grip === 'open' && docked(state.layout, pose) && !state.gripTests.includes(key(tool))) {
    return { kind: 'grip', point: center(state.layout.latch), label: 'Test the grip at the aligned handle' };
  }
  if (state.grip === 'held') {
    const experiment = state.stableActor ? buttonStep(state, tool, remaining) : null;
    const poses = projectedRail(state, pose, rows[0]!.length) ?? (!experiment ? knownPoses(state) : null);
    const route = poses && planPassage(state, rows, pose, poses, remaining);
    if (route) return route;
    if (poses && state.stableActor) {
      const source = switchScope(state.layout, rows, pose.actor);
      const candidates = state.layout.switches.flatMap((_, index) => {
        if (state.interruptedSwitches?.some(item => item.index === index && item.actor === key(pose.actor))) return [];
        const tested = state.gateTests.filter(test => test.index === index);
        const known = state.switchEffects.some(effect => effect.index === index && effect.edits.every(edit =>
          tileKey(rows, point(edit.cell), state.layout.pitch) === edit.before));
        return tested.length < 12 && !tested.some(test => test.source === source) && !known && !state.portals.some(p => p.index === index)
          ? [{ index, tests: tested.length }] : [];
      }).sort((a, b) => a.tests - b.tests);
      const index = candidates[0]?.index ?? -1;
      if (index >= 0) return { kind: 'switch', index, point: center(state.layout.switches[index]!.box), probe: true,
        label: 'Check whether a remote switch opens a route from the current island' };
    }
    return experiment;
  }
  return state.stableActor ? (state.grip === 'open' ? approachGrip(state, pose) : null) ?? buttonStep(state, tool, remaining) : null;
}

export function observeCarriedStep(state: CarriedSupport, step: CarriedStep, first: NativeRows, second: NativeRows, ref: string,
  frames: readonly NativeRows[] = []) {
  const before = readPose(state.layout, first, state.relativeSupport), after = readPose(state.layout, second, state.relativeSupport);
  if (!before || !after) return null;
  const start = origin(before.tool.bbox), finish = origin(after.tool.bbox);
  if (state.relativeSupport && !same(state.relativeSupport, delta(finish, origin(after.support.bbox)))) return null;
  const portals = [...new Map([...state.portals, ...readTerrain(state.layout, first, before.actor).portals].map(p => [p.index, p])).values()];
  if (step.kind === 'walk') {
    if (!same(start, finish) || !same(after.actor, before.actor) && !same(after.actor, step.expectedActor)) return null;
    if (same(after.actor, before.actor)) return { ...state, portals,
      blocked: [...state.blocked, blockedKey(state.layout, first, before.actor, step.expectedActor)] };
    if (step.discoveryInk === undefined) return { ...state, portals, stableActor: !step.carried };
    const panel = visibleCommandPanel(second);
    const discovered = panel?.buttons.filter(p => p.color === step.discoveryInk) ?? [];
    const layout = discovered.length === 1 ? { ...state.layout, switches: [...state.layout.switches,
      { box: discovered[0]!.bbox, ink: discovered[0]!.color }] } : state.layout;
    return { ...state, layout, portals, stableActor: !step.carried, markerTests: [...state.markerTests, key(after.actor)] };
  }
  if (step.kind === 'portal') {
    if (!same(start, finish) || !same(after.actor, step.expectedActor)) return null;
    const portal = portals.find(item => same(center(state.layout.switches[item.index]!.box), step.point));
    return { ...state, portals, stableActor: true, usedPortals: portal ? [...state.usedPortals, portal.index] : state.usedPortals };
  }
  if (step.kind === 'switch') {
    if (!same(start, finish) || !same(before.actor, after.actor)) return null;
    const { layout } = state;
    const edits = surfaceCells(layout, before.actor).flatMap<SurfaceEdit>(p => {
      const from = tileKey(first, p, layout.pitch), to = tileKey(second, p, layout.pitch);
      return from === to || same(before.actor, p) ? [] : [{ cell: key(p), before: from, after: to }];
    });
    if (!edits.length && frames.length > 1) {
      const footprint = Array.from({ length: layout.pitch ** 2 }, (_, i): NativePoint =>
        shift(before.actor, [i % layout.pitch, Math.floor(i / layout.pitch)]));
      if (measureAnimatedCells(first, second, frames, footprint).length === footprint.length) {
        return { ...state, portals,
          interruptedSwitches: [...(state.interruptedSwitches ?? []), { index: step.index, actor: key(before.actor) }] };
      }
    }
    if (step.edits && JSON.stringify(step.edits) !== JSON.stringify(edits)) return null;
    return { ...state, portals, gateTests: step.probe ? [...state.gateTests, { index: step.index, source: switchScope(layout, first, before.actor) }] : state.gateTests,
      switchEffects: step.probe && edits.length ? [...state.switchEffects, { index: step.index, edits }] : state.switchEffects };
  }
  if (step.kind === 'grip') {
    if (!same(before.actor, after.actor) || !same(origin(before.support.bbox), origin(after.support.bbox))) return null;
    const changed = before.tool.area !== after.tool.area || span(before.tool.bbox, 1) !== span(after.tool.bbox, 1)
      || span(before.tool.bbox, 0) !== span(after.tool.bbox, 0);
    return { ...state, portals, grip: changed ? 'pending' as const : 'open' as const, gripTests: [...state.gripTests, key(start)],
      ...(changed ? { heldOrigin: finish, graph: {}, rail: railPixels(state.layout, second, []) } : {}) };
  }
  if (step.kind !== 'button' || !same(before.actor, after.actor)) return null;
  const move = delta(start, finish), shifted = !same(move, [0, 0]);
  const supportMove = delta(origin(before.support.bbox), origin(after.support.bbox));
  if (state.grip === 'open' ? !same(supportMove, [0, 0]) : !same(supportMove, move)) return null;
  if (step.expectedTool && !same(finish, step.expectedTool)) return null;
  const learned = state.vectors[step.index];
  if (shifted && ((move[0] === 0) === (move[1] === 0) || learned && !same(learned, move))) return null;
  const graph = structuredClone(state.graph);
  rememberCommandReturn(graph, key(start), key(finish), String(step.index), ref);
  const grip = state.grip === 'pending' && shifted ? 'held' : state.grip;
  return { ...state, portals, graph, grip, vectors: shifted ? { ...state.vectors, [step.index]: move } : state.vectors,
    ...(grip !== 'open' ? { rail: railPixels(state.layout, second, state.rail) } : {}),
    ...(grip === 'held' ? { relativeSupport: delta(finish, origin(after.support.bbox)) } : {}) };
}
