import type { NativeCommand, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { readTravelGrid, type ObservedTravel } from './observed-travel-frontier.ts';

type Cells = ReturnType<typeof readTravelGrid>['cells'];
type Gate = { mark: string; cell: string; openRef: string; closedRef?: string };
type Bridge = { mark: string; source: string; landing: string; ref: string };
type Pose = { actor: string; pieces: string[]; supports: string[] };
export type PressureReserve = {
  body: string; radius: number; initialPieces: string[]; floor: string[]; field: Record<string, number>;
  features: string[]; exit?: string; wet?: number; supportPattern?: string; refs: string[]; losses: number;
  gate?: Gate; bridge?: Bridge; crossingBuilt?: true; shortage?: string; recovered?: true; refused: string[];
};
export type PressurePlan = { command: NativeCommand; target: string;
  goal: 'reserve_weight' | 'build_crossing' | 'cross_to_exit' | 'verify_gate_release';
  expected: Pose; evidence: string[] };

const coords = (cell: string) => cell.split(',').map(Number) as [number, number];
const offset = (cell: string, [dx, dy]: NativePoint) => {
  const [x, y] = coords(cell);
  return `${x + dx},${y + dy}`;
};
const shape = (pixels?: readonly number[]) => pixels?.join(',') ?? '';
const ordered = (cells: readonly string[]) => [...cells].sort().join(';');
const poseKey = (pose: Pose) => `${pose.actor}|${ordered(pose.pieces)}|${ordered(pose.supports)}`;
const actionKey = (pose: Pose, input: string) => `${poseKey(pose)}|${input}`;
const corners = (pitch: number) => [0, pitch - 1, pitch * (pitch - 1), pitch * pitch - 1];
const covered = (pose: Pose, cell: string) => pose.actor === cell || pose.pieces.includes(cell);

function substrate(pixels: readonly number[] | undefined, decoration: number) {
  const base = pixels?.filter(pixel => pixel !== decoration) ?? [];
  return base.length && base.every(pixel => pixel === base[0]) ? base[0] : undefined;
}

function actorAt(cells: Cells, { grid }: ObservedTravel): string | undefined {
  const core = grid.signature?.split(',').map(Number);
  if (!core) return;
  const corner = new Set(corners(grid.pitch)), mid = Math.floor(grid.pitch * grid.pitch / 2);
  const actors = [...cells].filter(([, pixels]) => pixels[mid] === grid.ink && pixels
    .map((ink, i) => corner.has(i) ? grid.floor : ink).sort((a, b) => a - b).every((ink, i) => ink === core[i]));
  return actors.length === 1 ? actors[0]![0] : undefined;
}

function piecesAt(cells: Cells, body: string, marks: ObservedTravel['grid']['annotatedMarks']): string[] {
  const core = body.split(',').map(Number), mid = Math.floor(core.length / 2);
  return [...cells].flatMap(([cell, pixels]) => {
    if (shape(pixels) === body) return [cell];
    const overlay = marks?.[cell];
    return overlay && pixels[mid] === core[mid] && pixels.filter((ink, i) => ink === core[i]).length * 2 > core.length
      && pixels.every((ink, i) => ink === core[i] || overlay.includes(ink)) ? [cell] : [];
  });
}

function position(local: PressureReserve, travel: ObservedTravel, cells: Cells): Pose | undefined {
  const actor = actorAt(cells, travel);
  if (!actor) return;
  const supports = new Set([...cells].flatMap(([cell, pixels]) => local.supportPattern === shape(pixels) ? [cell] : []));
  if (local.wet !== undefined && local.field[actor] === local.wet) supports.add(actor);
  return { actor, pieces: piecesAt(cells, local.body, travel.grid.annotatedMarks), supports: [...supports] };
}

function radiusFromOverlay(rows: NativeRows, actor: string, travel: ObservedTravel): number | undefined {
  const { pitch, ink } = travel.grid, [left, top] = coords(actor);
  let loX = Infinity, loY = Infinity, hiX = -1, hiY = -1;
  rows.forEach((row, y) => row.forEach((pixel, x) => {
    if (pixel !== ink) return;
    loX = Math.min(loX, x); loY = Math.min(loY, y); hiX = Math.max(hiX, x); hiY = Math.max(hiY, y);
  }));
  const skins = [left - loX, top - loY, hiX - left - pitch + 1, hiY - top - pitch + 1];
  return skins[0]! >= pitch && skins[0]! % pitch === 0 && skins.every(depth => depth === skins[0])
    ? skins[0]! / pitch : undefined;
}

function learnCoupling(rows: NativeRows, cells: Cells, after: Cells, travel: ObservedTravel, delta: NativePoint, ref: string): PressureReserve | undefined {
  const actor = actorAt(cells, travel), later = actorAt(after, travel);
  if (!actor || offset(actor, delta) !== later) return;
  const { grid } = travel;
  const radius = radiusFromOverlay(rows, actor, travel);
  if (!radius || !grid.annotatedMarks) return;
  const edge = corners(grid.pitch), mid = Math.floor(grid.pitch * grid.pitch / 2);
  const candidates = [...cells].filter(([cell, pixels]) => cell !== actor && pixels[0] !== grid.floor
    && edge.every(i => pixels[i] === pixels[0]) && pixels[mid] !== pixels[0]
    && shape(after.get(cell)) !== shape(pixels) && shape(after.get(offset(cell, delta))) === shape(pixels));
  if (candidates.length !== 1) return;
  const body = shape(candidates[0]![1]), initialPieces = piecesAt(cells, body, grid.annotatedMarks);
  if (initialPieces.length < 2) return;
  const field: Record<string, number> = {}, floor = new Set([actor, ...initialPieces, ...Object.keys(grid.annotatedMarks)]);
  const features: string[] = [], exits: string[] = [];
  const markColors = new Set(Object.values(grid.annotatedMarks).map(([ink]) => ink));
  for (const [cell, pixels] of cells) {
    const base = substrate(pixels, grid.ink);
    if (base !== undefined) field[cell] = base;
    if (base === grid.floor) floor.add(cell);
    if (floor.has(cell) || base !== undefined) continue;
    if (edge.every(i => pixels[i] === pixels[0]) && pixels[0] !== grid.floor && !markColors.has(pixels[0])
      && (pixels[mid] === grid.floor || pixels[mid] === pixels[0])) exits.push(cell);
    else if (!edge.every(i => pixels[i] === pixels[0]) && grid.pitch >= 3) {
      const hasLine = [0, grid.pitch - 1].some(start => Array.from({ length: grid.pitch }, (_, i) =>
        pixels[start + i * (start ? grid.pitch - 1 : grid.pitch + 1)]).every(ink => ink === pixels[start]));
      if (hasLine) features.push(cell);
    }
  }
  return { body, radius, initialPieces, field, floor: [...floor], features, refs: [ref], losses: 0, refused: [],
    ...(exits.length === 1 ? { exit: exits[0]! } : {}) };
}

export function observePressureReserve(local: PressureReserve | undefined, travel: ObservedTravel | undefined,
  before: NativeRows, after: NativeRows, command: NativeCommand, ref: string,
  plan?: PressurePlan): PressureReserve | undefined {
  if (!travel?.grid.annotatedMarks) return local;
  const delta = travel.moves[command.action_ref]?.delta;
  if (!local && !delta) return;
  const first = readTravelGrid(before, travel.grid).cells, second = readTravelGrid(after, travel.grid).cells;
  const known = local ?? learnCoupling(before, first, second, travel, delta!, ref);
  if (!known) return;
  const a = position(known, travel, first), b = position(known, travel, second);
  if (!a || !b) return known;
  let result = known;
  if (a.pieces.length === b.pieces.length + 1) {
    const directions = Object.values(travel.moves).map(move => move.delta);
    const support = a.pieces.filter(cell => !b.pieces.includes(cell)).flatMap(source =>
      directions.flatMap(vector => {
        const landing = offset(source, vector), previous = first.get(landing), current = second.get(landing);
        const wet = substrate(previous, travel.grid.ink);
        return wet !== undefined && wet !== travel.grid.floor && (known.wet === undefined || known.wet === wet)
          && current && substrate(current, travel.grid.ink) === undefined && !covered(b, landing) ? [{ source, landing, wet, current }] : [];
      }));
    if (support.length === 1) {
      const found = support[0]!, marker = travel.grid.annotatedMarks[b.actor] && a.actor !== b.actor ? b.actor : undefined;
      result = { ...result, wet: found.wet, supportPattern: shape(found.current), losses: known.losses + 1,
        refs: [...known.refs.slice(-9), ref],
        ...(marker ? { bridge: { mark: marker, source: found.source, landing: found.landing, ref }, crossingBuilt: true } : {}) };
    }
  }
  const mid = Math.floor(travel.grid.pitch * travel.grid.pitch / 2), edges = corners(travel.grid.pitch);
  for (const [mark, [rim, accent]] of Object.entries(travel.grid.annotatedMarks)) {
    if (covered(a, mark) === covered(b, mark)) continue;
    for (const [cell, original] of first) {
      const changed = second.get(cell);
      if (!changed || covered(a, cell) || covered(b, cell) || !edges.every(i => original[i] === rim && changed[i] === rim)
        || !original.includes(accent!) && !changed.includes(accent!)) continue;
      const openBefore = original[mid] === travel.grid.floor, openAfter = changed[mid] === travel.grid.floor;
      if (!openBefore && openAfter && covered(b, mark)) {
        const closedRef = result.gate?.cell === cell && result.gate.mark === mark ? result.gate.closedRef : undefined;
        result = { ...result, gate: { mark, cell, openRef: ref, ...(closedRef ? { closedRef } : {}) }, refs: [...result.refs.slice(-9), ref] };
      } else if (openBefore && !openAfter && !covered(b, mark) && result.gate?.cell === cell && result.gate.mark === mark) {
        result = { ...result, gate: { ...result.gate, closedRef: ref }, refs: [...result.refs.slice(-9), ref] };
      }
    }
  }
  // The gate and crossing may be verified in either order.
  const gate = result.gate;
  if (!result.recovered && gate?.closedRef && result.bridge
    && result.losses >= result.initialPieces.length && !b.pieces.length
    && !covered(b, gate.mark) && !covered(b, gate.cell)) {
    const rim = travel.grid.annotatedMarks[gate.mark]?.[0], pixels = second.get(gate.cell);
    if (rim !== undefined && pixels && edges.every(i => pixels[i] === rim) && pixels[mid] !== travel.grid.floor) {
      result = { ...result, shortage: ref };
    }
  }
  if (plan && poseKey(plan.expected) !== poseKey(position(result, travel, second) ?? b)) {
    result = { ...result, refused: [...new Set([...result.refused.slice(-63), actionKey(a, command.action_ref)])] };
  }
  return result;
}

export function retainPressureReserve(local: PressureReserve): PressureReserve {
  const { shortage, crossingBuilt, ...learned } = local;
  return { ...learned, recovered: true, losses: 0, refused: [] };
}

export function assessPressurePlan(local: PressureReserve, travel: ObservedTravel, rows: NativeRows, plan: PressurePlan): boolean | undefined {
  const actual = position(local, travel, readTravelGrid(rows, travel.grid).cells);
  return actual ? poseKey(actual) === poseKey(plan.expected) : undefined;
}

export function choosePressureReserve(local: PressureReserve | undefined, travel: ObservedTravel | undefined,
  rows: NativeRows, inputs: readonly NativeCommand[]): PressurePlan | undefined {
  if (!local?.gate || !local.bridge || !travel || local.wet === undefined) return;
  const { gate, bridge } = local, { pitch } = travel.grid, cells = readTravelGrid(rows, travel.grid).cells;
  const initial = position(local, travel, cells);
  if (!initial) return;
  const moves = inputs.flatMap(command => travel.moves[command.action_ref] ? [{ command, delta: travel.moves[command.action_ref]!.delta }] : []);
  if (moves.length !== 4 || new Set(moves.map(move => move.delta.join(','))).size !== 4) return;
  const ground = new Set([...local.floor, bridge.source, gate.cell, ...(local.exit ? [local.exit] : [])]);
  const wet = (cell: string) => local.field[cell] === local.wet;
  const near = (a: string, b: string) => {
    const [x, y] = coords(a), [u, v] = coords(b);
    return Math.max(Math.abs(x - u), Math.abs(y - v)) <= local.radius * pitch;
  };
  const evidence = [...new Set([...local.refs, ...Object.values(travel.moves).map(move => move.ref)])];
  const refused = new Set(local.refused);
  const free = (cell: string, pose: Pose) => ground.has(cell)
    && (cell !== gate.cell || covered(pose, gate.mark))
    && (cell !== bridge.source || !covered(pose, bridge.mark));

  function project(pose: Pose, { delta, command }: typeof moves[number]): Pose | undefined {
    if (refused.has(actionKey(pose, command.action_ref))) return;
    const nextActor = offset(pose.actor, delta);
    const active = new Map<string, string>();
    if (!free(nextActor, pose) && !pose.supports.includes(nextActor)) return;
    active.set(pose.actor, nextActor);
    for (const cell of pose.pieces) {
      const landing = offset(cell, delta);
      if (near(pose.actor, cell) && (free(landing, pose) || wet(landing))) active.set(cell, landing);
    }
    for (const cell of pose.supports) {
      const landing = offset(cell, delta);
      if (cell !== pose.actor && cell !== nextActor && near(pose.actor, cell) && wet(landing)) active.set(cell, landing);
    }
    const occupied = new Set([pose.actor, ...pose.pieces, ...pose.supports]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [from, to] of active) if (occupied.has(to) && !active.has(to) && !(from === pose.actor && pose.supports.includes(to))) {
        active.delete(from); changed = true;
      }
    }
    if (!active.has(pose.actor)) return;
    const supports = new Set(pose.supports.map(cell => cell === pose.actor || cell === nextActor ? cell : active.get(cell) ?? cell));
    const pieces: string[] = [];
    for (const cell of pose.pieces) {
      const landing = active.get(cell) ?? cell;
      if (wet(landing) && !supports.has(landing)) return;
      pieces.push(landing);
    }
    const next = { actor: nextActor, pieces, supports: [...supports] };
    if (!covered(pose, bridge.mark) && covered(next, bridge.mark) && pieces.includes(bridge.source)) {
      if (pieces.includes(bridge.landing)) return;
      next.pieces = pieces.filter(cell => cell !== bridge.source);
      next.supports = [...new Set([...next.supports, bridge.landing])];
    }
    return next;
  }

  function route(goal: PressurePlan['goal'], target: string, match: (pose: Pose) => boolean,
    preserve: (pose: Pose) => boolean = () => true): PressurePlan | undefined {
    const queue: { pose: Pose; first?: { command: NativeCommand; expected: Pose } }[] = [{ pose: initial! }];
    const seen = new Set([poseKey(initial!)]);
    for (let i = 0; i < queue.length && i < 7500; i++) {
      const { pose, first } = queue[i]!;
      if (first && match(pose)) return { ...first, goal, target, evidence };
      for (const move of moves) {
        const expected = project(pose, move);
        if (!expected || !preserve(expected)) continue;
        const key = poseKey(expected);
        if (seen.has(key)) continue;
        seen.add(key); queue.push({ pose: expected, first: first ?? { command: move.command, expected } });
      }
    }
  }
  if (!gate.closedRef && initial.actor === gate.mark && !initial.pieces.length) {
    const move = moves.find(item => project(initial, item));
    const expected = move && project(initial, move);
    return move && expected ? { command: move.command, goal: 'verify_gate_release', target: gate.cell, expected, evidence } : undefined;
  }
  if (!local.recovered || !gate.closedRef) return;
  if (!initial.pieces.includes(gate.mark) || near(initial.actor, gate.mark) && !initial.supports.length) {
    const plan = route('reserve_weight', gate.mark, pose => pose.pieces.includes(gate.mark) && !near(pose.actor, gate.mark));
    if (plan) return plan;
  }
  const holds = (pose: Pose) => pose.pieces.includes(gate.mark);
  if (!local.crossingBuilt) {
    return route('build_crossing', bridge.landing, pose => pose.supports.includes(bridge.landing), holds);
  }
  const exit = local.exit;
  if (!exit || !holds(initial)) return;
  const island = new Set([exit]);
  for (const cell of island) for (const move of moves) {
    const adjacent = offset(cell, move.delta);
    if (free(adjacent, initial)) island.add(adjacent);
  }
  if (island.has(initial.actor)) return route('cross_to_exit', exit, pose => pose.actor === exit, holds);
  const alternative = inputs.filter(input => !travel.moves[input.action_ref] && /^ACTION[1-5]$/.test(input.action_ref));
  if (alternative.length !== 1) return;
  const mid = Math.floor(pitch / 2), center = mid * pitch + mid;
  const preview = [...island].filter(cell => {
    if (cell === exit || cell === gate.cell || travel.grid.annotatedMarks?.[cell]) return false;
    const pixels = cells.get(cell), ink = pixels?.[center];
    return ink !== undefined && ink !== travel.grid.ink && ink !== travel.grid.floor && pixels?.every((value, i) =>
      i % pitch === mid || Math.floor(i / pitch) === mid ? value === ink : value === travel.grid.floor);
  });
  const command = alternative[0]!;
  if (preview.length === 1 && !refused.has(actionKey(initial, command.action_ref))) {
    return { command, target: preview[0]!, expected: { ...initial, actor: preview[0]! }, evidence, goal: 'cross_to_exit' };
  }
  const candidates = new Set<string>();
  for (const feature of local.features) {
    for (const first of moves) for (const second of moves) {
      if (!!first.delta[0] === !!second.delta[0]) continue;
      let from = feature, to = feature;
      for (let i = 0; i < cells.size; i++) {
        from = offset(from, first.delta); to = offset(to, second.delta);
        if (!(free(from, initial) || wet(from)) || !(free(to, initial) || wet(to))) break;
        if (free(from, initial) && island.has(to) && !refused.has(actionKey({ ...initial, actor: from }, command.action_ref))) candidates.add(from);
      }
    }
  }
  return route('cross_to_exit', exit, pose => candidates.has(pose.actor), holds);
}
