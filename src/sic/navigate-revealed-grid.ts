import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';
import { maximumCommittedActions } from './plan-step.ts';
import { observedMechanicsGroup } from './strategy-agenda.ts';

export const navigateRevealedGridId = 'sic_navigate_revealed_grid';

type Part = ReturnType<typeof geometricComponents>[number];
type Mechanisms = { pads: Record<number, NativePoint>; doors: Record<number, number> };
type Sentry = [number, number, number][];
type Grid = { box: NativeBox; pitch: number; columns: number; size: number; tint: number; base: number; actor: number; enemy: number; trail: number;
  goal: number; charges: NativePoint[]; actorPixels?: NativePoint[]; rail?: number; sentry?: Sentry; multipleSentries?: true;
  sentryPatterns?: Sentry[];
  mechanisms?: Mechanisms };
type Cell = 'wall' | 'free';
type Reading = { position: number; obstacle: number | null; obstacles: number[]; risk: number[];
  memory: Partial<Record<number, Cell>>; charges: number; sentries?: number[]; sentryRisk?: number[];
  closedDoors?: number[]; landings?: Record<number, number>; failedEntrances?: number[]; nextHazards?: number[] };
type Motion = { from: number; at: number };
type RailTrack = { at: number; shifted: number[]; period?: number };
type RailClock = { turn: number; rails: Record<string, RailTrack>; crossed: number[]; visits: number[]; scans: number[];
  gateGoal?: number; gateEntry?: { gate: number; from: number } };
type Timing = { start: number; patrols: number[][]; walls: number[][]; scannedPads: number[]; pendingPad?: number;
  clock?: RailClock };
type State = { epoch: number; grid: Grid; last: Reading; previousObstacle: number | null; motions?: Motion[]; refs: string[]; consecutiveWaits: number; timing?: Timing };
type Choice = { action: NativeCommand; kind: 'pulse' | 'wait' | 'move'; target: number; uncertain: boolean; entry?: number };
type Walk = { action: string; target: number; entry?: number };
type Proposal = NativeProposal & { local: State; choice: Choice; walk?: Walk[]; needId: string };

const directions = [['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION4', 1, 0], ['ACTION3', -1, 0]] as const;
const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const colorAt = (rows: NativeRows, [x, y]: NativePoint) => rows[y]?.[x];

function tile(grid: Grid, index: number): NativeBox {
  const x = grid.box[0] + index % grid.columns * grid.pitch;
  const y = grid.box[1] + Math.floor(index / grid.columns) * grid.pitch;
  return [x, y, x + grid.pitch - 1, y + grid.pitch - 1];
}

function measureMechanisms(rows: NativeRows, marks: readonly Part[], grid: Grid): Mechanisms | null {
  const { pitch, box: [x, y], columns, size } = grid;
  const pads: Mechanisms['pads'] = {}, doors: Mechanisms['doors'] = {};
  const midpoint = Math.floor((pitch - 1) / 2);
  for (const mark of marks) {
    const [left, top] = mark.bbox, cx = left + midpoint, cy = top + midpoint, ink = rows[cy]![cx]!;
    const arrows = directions.filter(([, dx, dy]) => rows[cy + dy]?.[cx + dx] === ink
      && rows[cy + dx]?.[cx - dy] === ink && rows[cy - dx]?.[cx + dy] === ink && rows[cy - dy]?.[cx - dx] !== ink);
    if (arrows.length !== 1 || ink === mark.color) return null;
    const [, dx, dy] = arrows[0]!;
    pads[(top - y) / pitch * columns + (left - x) / pitch] = [dx, dy];
  }
  const known = new Set([grid.base, grid.tint, grid.actor, grid.enemy, grid.trail]);
  for (let i = 0; i < size; i++) {
    if (pads[i]) continue;
    const [a, b] = tile(grid, i), left = rows[b + 1]![a + 1]!, right = rows[b + 1]![a + pitch - 2]!;
    const innerRows = rows.slice(b + 1, b + pitch - 1);
    if (left !== right && !known.has(left) && !known.has(right)
      && innerRows.every(row => row[a + 1] === left && row[a + pitch - 2] === right)) doors[i] = left;
    else if (grid.sentryPatterns) {
      const edge = rows[b + 1]![a]!, far = a + pitch - 1;
      if (!known.has(edge) && rows[b]![a] === grid.tint && rows[b]![far] !== edge
        && innerRows.every(row => row[a] === edge && row[far] === edge && row[a + 1] !== edge)) doors[i] = edge;
    }
  }
  return { pads, doors };
}

function measure(rows: NativeRows, inherited?: Grid): Grid | null {
  const parts = geometricComponents(rows), candidates: Grid[] = [];
  const outlines = parts.filter(p => width(p.bbox) >= 24 && height(p.bbox) >= 24
    && p.area >= 2 * (width(p.bbox) + height(p.bbox) - 2)
    && p.area < width(p.bbox) * height(p.bbox) / 4);
  for (const frame of outlines) {
    const box: NativeBox = [frame.bbox[0] + 1, frame.bbox[1] + 1, frame.bbox[2] - 1, frame.bbox[3] - 1];
    const [x, y] = box, tint = frame.color;
    const base = rows[y]?.[x + 1];
    if (base === undefined || base === tint) continue;
    const inside = (p: Part) => p.bbox[0] >= box[0] && p.bbox[1] >= box[1] && p.bbox[2] <= box[2] && p.bbox[3] <= box[3];
    for (let pitch = 4; pitch <= 9; pitch++) {
      if (width(box) % pitch || height(box) % pitch) continue;
      const columns = width(box) / pitch, size = columns * height(box) / pitch;
      const dots = Array.from({ length: size }, (_, i) => [x + i % columns * pitch, y + Math.floor(i / columns) * pitch] as const);
      if (dots.filter(([a, b]) => rows[b]?.[a] === tint && rows[b]?.[a + 1] === base).length < size * 0.8) continue;
      const squareFrames: Part[] = parts.filter(p => inside(p) && width(p.bbox) === pitch && height(p.bbox) === pitch
        && (p.bbox[0] - x) % pitch === 0 && (p.bbox[1] - y) % pitch === 0 && p.color !== base && p.color !== tint && !p.rectangular);
      if (squareFrames.length < 2) continue;
      const repeated = squareFrames.length > 2;
      const goalFrames: Part[] = repeated ? squareFrames.filter(p => squareFrames.filter(q => p.color === q.color).length === 1)
        : squareFrames.filter(p => colorAt(rows, center(p.bbox)) === base);
      if (goalFrames.length !== 1) continue;
      const goalFrame = goalFrames[0]!;
      const changedBounds = repeated && inherited && box.some((boundary, i) => boundary !== inherited.box[i]);
      const marks = changedBounds && inherited ? squareFrames.filter(p => p !== goalFrame && p.color !== inherited.enemy) : [];
      const enemyFrames = squareFrames.filter(p => p !== goalFrame && !marks.includes(p));
      const enemyFrame = enemyFrames[0];
      if (!enemyFrame) continue;
      const rebound: Grid | null = inherited && (inherited.pitch !== pitch || changedBounds) && inherited.tint === tint && inherited.base === base
        && enemyFrame.color === inherited.enemy ? inherited : null;
      if (inherited && !rebound) continue;
      const trail: number | undefined = (!repeated ? rebound?.trail : undefined) ?? colorAt(rows, center(enemyFrame.bbox));
      if (trail === undefined || trail === enemyFrame.color || trail === tint) continue;
      if (repeated && enemyFrames.some(frame => frame.color !== enemyFrame.color || colorAt(rows, center(frame.bbox)) !== trail)) continue;
      const details = new Set<number>();
      if (repeated) for (const frame of enemyFrames) {
        const [left, top, right, bottom] = frame.bbox;
        for (let v = top + 1; v < bottom; v++) for (let u = left + 1; u < right; u++) {
          const color = rows[v]?.[u];
          if (color !== undefined && color !== enemyFrame.color && color !== trail && color !== base && color !== tint) details.add(color);
        }
      }
      const rail = details.size === 1 ? [...details][0]! : rebound?.rail ?? null;
      const bodies = parts.filter(p => inside(p) && p.color !== base && p.color !== tint && width(p.bbox) === height(p.bbox)
        && width(p.bbox) >= 2 && width(p.bbox) <= (repeated ? Math.ceil(pitch / 2) : pitch / 2) && !p.rectangular
        && !squareFrames.some(f => p.bbox[0] >= f.bbox[0] && p.bbox[1] >= f.bbox[1] && p.bbox[2] <= f.bbox[2] && p.bbox[3] <= f.bbox[3]));
      const player = rebound ? bodies.filter(body => body.color === rebound.actor) : bodies;
      if (player.length !== 1) continue;
      const badges = parts.filter(p => p.color === enemyFrame.color && p.rectangular && p.bbox[3] < y
        && width(p.bbox) >= 2 && width(p.bbox) <= pitch && height(p.bbox) >= 2 && height(p.bbox) <= pitch);
      if (!badges.length) continue;
      const goal = ((goalFrame.bbox[1] - y) / pitch) * columns + (goalFrame.bbox[0] - x) / pitch;
      const actor = player[0]!;
      const actorPixels = actor.mask.map(([dx, dy]) => [(actor.bbox[0] - x) % pitch + dx, (actor.bbox[1] - y) % pitch + dy] as const);
      if ((repeated || rebound) && actorPixels.some(([dx, dy]) => dx >= pitch || dy >= pitch)) continue;
      const phase = ([left, top]: NativeBox) => [(left - x) % pitch, (top - y) % pitch];
      const otherBodies = rebound ? bodies.filter(body => body !== actor && body.area === actor.area
        && width(body.bbox) === width(actor.bbox) && phase(body.bbox).every((value, axis) => value === phase(actor.bbox)[axis])) : [];
      const sentryPatterns = otherBodies.map(body => {
        const [left, top, right, bottom] = body.bbox, [u, v] = phase(body.bbox);
        const pixels: [number, number, number][] = [];
        for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) {
          pixels.push([u! + col - left, v! + row - top, rows[row]![col]!]);
        }
        return pixels;
      });
      const signature = sentryPatterns[0];
      const sentry = signature?.some(([, , value]) => value === actor.color)
        && sentryPatterns.every(pattern => pattern.every(([, , value], i) => value === signature[i]?.[2])) ? signature : undefined;
      const secondSignatures = !sentry && rebound?.sentry ? sentryPatterns.filter(pattern =>
        pattern.some(([, , value]) => value === actor.color) && new Set(pattern.map(([, , value]) => value)).size === 2
        && pattern.length === rebound.sentry!.length
        && pattern.every(([dx,dy], i) => dx === rebound.sentry![i]?.[0] && dy === rebound.sentry![i]?.[1])) : [];
      const separateSentries = [...new Map(secondSignatures.map(pattern => [JSON.stringify(pattern), pattern])).values()];
      const grid: Grid = { box, pitch, columns, size, tint, base, actor: actor.color, enemy: enemyFrame.color, trail,
        goal, charges: badges.map(p => center(p.bbox)), ...(repeated || rebound ? { actorPixels } : {}),
        ...(rail === null ? {} : { rail }), ...(sentry ? { sentry } : {}),
        ...(sentry && sentryPatterns.length > 1 ? { multipleSentries: true as const } : {}),
        ...(separateSentries.length > 1 ? { sentryPatterns: separateSentries, multipleSentries: true as const } : {}) };
      const mechanisms = rebound && marks.length ? measureMechanisms(rows, marks, grid) : null;
      if (marks.length && !mechanisms) continue;
      candidates.push(mechanisms ? { ...grid, mechanisms } : grid);
    }
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

function read(rows: NativeRows, grid: Grid, prior?: Reading): Reading | null {
  const memory = { ...prior?.memory }, risk = new Set(prior?.risk);
  const positions: number[] = [], obstacles: number[] = [], sentries: number[] = [];
  const closedDoors: number[] = [];
  for (let i = 0; i < grid.size; i++) {
    const [x, y] = tile(grid, i), m = Math.floor(grid.pitch / 2);
    const a = rows[y]?.[x], b = rows[y]?.[x + 1], c = rows[y + 1]?.[x + 1], d = rows[y + m]?.[x + m];
    const actorVisible = grid.actorPixels ? grid.actorPixels.every(([dx, dy]) => rows[y + dy]?.[x + dx] === grid.actor) : d === grid.actor;
    const occupied = actorVisible && a !== grid.enemy && i !== grid.goal;
    if (occupied) positions.push(i);
    if (grid.sentry?.every(([dx, dy, value]) => rows[y + dy]?.[x + dx] === value)
      || grid.sentryPatterns?.some(pattern => pattern.every(([dx, dy, value]) => rows[y + dy]?.[x + dx] === value))) sentries.push(i);
    if (a === grid.enemy) obstacles.push(i);
    if (a === grid.enemy || d === grid.trail || (grid.rail !== undefined && d === grid.rail)) risk.add(i);
    const door = grid.mechanisms?.doors[i];
    if (door !== undefined) {
      const open = rows.slice(y + 1, y + grid.pitch - 1).every(row => row[x] === door && row[x + grid.pitch - 1] === door);
      if (!open) closedDoors.push(i);
      memory[i] = 'free';
    } else if (i === grid.goal || occupied || grid.mechanisms?.pads[i]) memory[i] = 'free';
    else if (a === grid.enemy) continue;
    else if (a === b && c !== b && a !== grid.tint && a !== grid.base) memory[i] = 'wall';
    else if (a === grid.tint && b === a && c === a && memory[i] !== 'wall') memory[i] = 'free';
  }
  if (positions.length !== 1 || (!grid.actorPixels && obstacles.length > 1) || (grid.sentry && !sentries.length)) return null;
  const sentryRisk = grid.multipleSentries ? new Set([...prior?.sentryRisk ?? [], ...sentries.flatMap(sentry => {
    const [x, y] = coordinate(sentry, grid);
    return [sentry, ...directions.flatMap(([, dx, dy]) => {
      const target = (y + dy) * grid.columns + x + dx;
      return x + dx >= 0 && x + dx < grid.columns && target >= 0 && target < grid.size ? [target] : [];
    })];
  })]) : null;
  return { position: positions[0]!, obstacle: obstacles[0] ?? null, obstacles, risk: [...risk], memory,
    charges: grid.charges.filter(p => colorAt(rows, p) === grid.enemy).length, ...(grid.sentry || grid.sentryPatterns ? { sentries } : {}),
    ...(sentryRisk ? { sentryRisk: [...sentryRisk] } : {}),
    ...(grid.mechanisms ? { closedDoors, landings: { ...prior?.landings }, failedEntrances: prior?.failedEntrances ?? [] } : {}) };
}

function hazardOnNextMove(reading: Reading, target: number): boolean {
  return reading.obstacles.includes(target) || !!reading.sentries?.includes(target) || !!reading.nextHazards?.includes(target);
}

function route(reading: Reading, grid: Grid, protectInitialMove = false, destination = grid.goal, clock?: RailClock): Walk[] | null {
  const start = reading.position, risk = new Set(reading.risk), sentryRisk = new Set(reading.sentryRisk);
  const { mechanisms } = grid;
  const repeats = new Map<number, number>();
  for (const cell of clock?.visits ?? []) repeats.set(cell, (repeats.get(cell) ?? 0) + 1);
  type Candidate = { index: number; cost: number; from?: { parent: Candidate; step: Walk } };
  const queue: Candidate[] = [{ index: start, cost: 0 }], best = new Map([[start, 0]]);
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const candidate = queue.shift()!, { index, cost } = candidate;
    if (cost !== best.get(index)) continue;
    if (index === destination) {
      const path: Walk[] = [];
      for (let node = candidate; node.from; node = node.from.parent) path.push(node.from.step);
      return path.reverse();
    }
    for (const [action, dx, dy] of directions) {
      const x = index % grid.columns + dx, y = Math.floor(index / grid.columns) + dy;
      const entry = y * grid.columns + x;
      if (x < 0 || x >= grid.columns || y < 0 || entry >= grid.size || reading.memory[entry] === 'wall') continue;
      const closed = reading.closedDoors?.includes(entry);
      if (closed && !reading.charges) continue;
      const arrow = mechanisms?.pads[entry], projected = arrow ? entry + arrow[0] + arrow[1] * grid.columns : entry;
      const alongPad = clock && arrow && x + arrow[0] >= 0 && x + arrow[0] < grid.columns && projected >= 0 && projected < grid.size
        && reading.memory[projected] !== 'wall' && !reading.closedDoors?.includes(projected)
        && axisDistance(projected, destination, grid) < axisDistance(entry, destination, grid);
      const target = reading.landings?.[entry] ?? (alongPad ? projected : entry);
      if (index === start && (mechanisms ? protectInitialMove && (hazardOnNextMove(reading, entry) || hazardOnNextMove(reading, target))
        : reading.sentries?.some(sentry => axisDistance(sentry, target, grid) <= 1))) continue;
      const movesAway = arrow && entry === target && axisDistance(projected, grid.goal, grid) > axisDistance(entry, grid.goal, grid);
      const riskyStep = clock && destination === grid.goal ? 6 : mechanisms ? 1 : 8;
      const patrolledStep = clock && destination === grid.goal ? 2 : mechanisms ? 1 : 6;
      const nextCost = cost + 1 + (reading.memory[target] ? 0 : mechanisms ? 1 : 2)
        + (risk.has(target) ? riskyStep : 0) + (sentryRisk.has(target) ? patrolledStep : 0)
        + Math.max(0, (repeats.get(target) ?? 0) - 1) * 3 + (clock?.crossed.includes(entry) ? 9 : 0)
        + (movesAway ? 10 : 0) + (closed ? grid.sentryPatterns ? 4 : 16 : 0) + (reading.failedEntrances?.includes(entry) ? 25 : 0);
      if (nextCost >= (best.get(target) ?? Infinity)) continue;
      best.set(target, nextCost);
      queue.push({ index: target, cost: nextCost, from: { parent: candidate, step: { action, target, ...(target === entry ? {} : { entry }) } } });
    }
  }
  return null;
}

function coordinate(index: number, grid: Grid): NativePoint {
  return [index % grid.columns, Math.floor(index / grid.columns)];
}

function axisDistance(a: number, b: number, grid: Grid): number {
  const [x, y] = coordinate(a, grid), [u, v] = coordinate(b, grid);
  return Math.abs(x - u) + Math.abs(y - v);
}

function track(previous: Reading, current: Reading, grid: Grid, motions: Motion[] = []): Motion[] {
  const old = previous.obstacles ?? [];
  return current.obstacles.flatMap(at => {
    const nearby = old.filter(from => axisDistance(from, at, grid) <= 1);
    if (nearby.length !== 1 || current.obstacles.filter(other => axisDistance(nearby[0]!, other, grid) <= 1).length !== 1) return [];
    const from = nearby[0]!;
    if (at !== from) return [{ from, at }];
    const known = motions.find(motion => motion.at === at);
    return known ? [known] : [];
  });
}

function updateTracks(previous: number[][], positions: number[], grid: Grid): number[][] {
  return positions.map(at => {
    const nearby = previous.filter(points => axisDistance(points.at(-1)!, at, grid) <= 1);
    const track = nearby.length === 1 && positions.filter(other => axisDistance(nearby[0]!.at(-1)!, other, grid) <= 1).length === 1
      ? nearby[0]! : [];
    return [...track.slice(-63), at];
  });
}

function forecastTracks(tracks: readonly number[][]): number[] {
  return tracks.flatMap(track => {
    for (let size = Math.min(9, track.length - 1); size >= 2; size--) {
      const suffix = track.slice(-size), next = new Set<number>();
      for (let start = 0; start + size < track.length; start++) {
        if (suffix.every((cell, index) => cell === track[start + index])) next.add(track[start + size]!);
      }
      if (next.size === 1) return [...next];
    }
    return [];
  });
}

function movingRails(rows: NativeRows, grid: Grid) {
  const { box, pitch, columns, size } = grid;
  return geometricComponents(rows).flatMap(({ bbox: [l,t,r,b], color }) => {
    const w = r - l + 1, h = b - t + 1;
    if (color !== grid.enemy || l < box[0] || t < box[1] || r > box[2] || b > box[3]
      || w % pitch || h % pitch || (l - box[0]) % pitch || (t - box[1]) % pitch) return [];
    const x = (l - box[0]) / pitch, y = (t - box[1]) / pitch;
    const cx = l + Math.floor(w / 2), cy = t + Math.floor(h / 2);
    if (grid.rail === undefined || rows[cy]?.[cx] !== grid.rail) return [];
    const headings = directions.filter(([, dx, dy]) => rows[cy + dy]?.[cx + dx] === grid.rail);
    if (headings.length !== 1) return [];
    const [, dx, dy] = headings[0]!;
    const next: number[] = [];
    for (let j = 0; j < h / pitch; j++) for (let i = 0; i < w / pitch; i++) {
      const col = x + i + dx, at = (y + j + dy) * columns + col;
      if (col >= 0 && col < columns && at >= 0 && at < size) next.push(at);
    }
    return [{ id: [w, h, dx ? 'row' : 'column', dx ? y : x].join(','), at: y * columns + x, next }];
  });
}

function updateRailClock(rows: NativeRows, grid: Grid, prior?: RailClock): Pick<RailClock, 'turn' | 'rails'> {
  const turn = (prior?.turn ?? -1) + 1;
  const rails: Record<string, RailTrack> = {};
  const items = movingRails(rows, grid);
  for (const item of items) {
    if (items.filter(candidate => candidate.id === item.id).length !== 1) continue;
    const previous = prior?.rails[item.id], moved = previous && previous.at !== item.at;
    const shifted = moved ? [...previous.shifted.slice(-3), turn] : previous?.shifted ?? [];
    const diff = shifted.length >= 2 ? shifted.at(-1)! - shifted.at(-2)! : 0;
    const repeat = shifted.length >= 3 && diff === shifted.at(-2)! - shifted.at(-3)!
      || shifted.length === 2 && diff === shifted[0] ? diff : 0;
    const retained = previous?.period && (!moved || diff % previous.period === 0) ? previous.period : 0;
    const period = retained || repeat;
    rails[item.id] = { at: item.at, shifted, ...(period ? { period } : {}) };
  }
  return { turn, rails };
}

function scheduledRailHazards(rows: NativeRows, grid: Grid, clock: NonNullable<Timing['clock']>) {
  return movingRails(rows, grid).flatMap(item => {
    const track = clock.rails[item.id];
    return track?.period && (clock.turn + 1 - track.shifted.at(-1)!) % track.period !== 0 ? [] : item.next;
  });
}

function chooseTimed({ grid, last, timing, consecutiveWaits }: State, path: Walk[] | null): Choice | null {
  const pulse = (target: number, kind: 'pulse' | 'wait'): Choice =>
    ({ action: { action_ref: 'ACTION5', data: {} }, kind, target, uncertain: true });
  const pending = timing?.pendingPad;
  if (pending !== undefined && axisDistance(last.position, pending, grid) === 1 && !hazardOnNextMove(last, pending)) {
    const move = directions.find(([, dx, dy]) => dx + dy * grid.columns === pending - last.position);
    if (move) return { action: { action_ref: move[0], data: {} }, kind: 'move', target: pending, uncertain: true };
  }
  const first = path?.[0];
  if (first && (hazardOnNextMove(last, first.target) || first.entry !== undefined && hazardOnNextMove(last, first.entry))) {
    if (!last.nextHazards?.includes(last.position) && consecutiveWaits < 4) return pulse(first.target, 'wait');
    path = route(last, grid, true);
  }
  const next = path?.[0];
  if (!next) return null;
  const { target, entry } = next, contact = entry ?? target;
  if (last.closedDoors?.includes(contact) && last.charges) return pulse(contact, 'pulse');
  const pad = grid.mechanisms?.pads[contact];
  if (pad && last.landings?.[contact] === undefined && !last.closedDoors?.length && last.charges
    && !timing?.scannedPads.includes(contact)) return pulse(contact, 'pulse');
  return { action: { action_ref: next.action, data: {} }, kind: 'move', target,
    uncertain: !last.memory[target] || !!pad && last.landings?.[contact] === undefined,
    ...(entry === undefined ? {} : { entry }) };
}

function chooseWithPulseReserve(local: State, path: Walk[] | null, destination: number): Choice | null {
  const { grid, last, consecutiveWaits } = local;
  const clock = local.timing!.clock!;
  const first = path?.[0];
  const contact = first ? first.entry ?? first.target : last.position;
  const canScan = last.charges > 0 && !last.nextHazards?.includes(last.position);
  const closed = !!last.closedDoors?.includes(contact);
  const reveal = clock.crossed.length > 0 && !last.risk.includes(last.position)
    && !clock.scans.some(cell => axisDistance(cell, last.position, grid) <= 2)
    && (!path || last.charges > 1 && path.slice(0, 5).filter(leg => !last.memory[leg.target]).length >= 2);
  if (canScan && (closed || reveal)) {
    return { action: { action_ref: 'ACTION5', data: {} }, kind: 'pulse', target: closed ? contact : last.position, uncertain: true };
  }
  if (!first) return null;
  const hazardous = closed || hazardOnNextMove(last, first.target) || hazardOnNextMove(last, contact);
  const move = ({ action, target, entry }: Walk): Choice => ({
    action: { action_ref: action, data: {} }, kind: 'move', target,
    uncertain: !last.memory[target] || !!grid.mechanisms?.pads[entry ?? target] && last.landings?.[entry ?? target] === undefined,
    ...(entry === undefined ? {} : { entry }),
  });
  if (!hazardous) return move(first);
  const [x, y] = coordinate(last.position, grid);
  if (!last.nextHazards?.includes(last.position) && consecutiveWaits < 12) {
    if (!last.charges) return { action: { action_ref: 'ACTION5', data: {} }, kind: 'wait', target: contact, uncertain: true };
    const hold = directions.find(([, dx, dy]) => {
      const next = (y + dy) * grid.columns + x + dx;
      return x + dx >= 0 && x + dx < grid.columns && y + dy >= 0 && next < grid.size && last.memory[next] === 'wall';
    });
    if (hold) return { action: { action_ref: hold[0], data: {} }, kind: 'wait', target: contact, uncertain: true };
  }
  const alternate = route(last, grid, true, destination, local.timing?.clock)?.[0];
  if (alternate && !last.closedDoors?.includes(alternate.entry ?? alternate.target)) return move(alternate);
  const refuge = directions.flatMap(([action, dx, dy]) => {
    const target = (y + dy) * grid.columns + x + dx;
    return x + dx >= 0 && x + dx < grid.columns && y + dy >= 0 && target < grid.size && last.memory[target] === 'free'
      && !grid.mechanisms?.pads[target] && !last.closedDoors?.includes(target) && !hazardOnNextMove(last, target)
      ? [{ action, target }] : [];
  }).sort((a, b) => Number(last.risk.includes(a.target)) - Number(last.risk.includes(b.target))
    || axisDistance(a.target, contact, grid) - axisDistance(b.target, contact, grid))[0];
  return refuge ? move(refuge) : null;
}

function showsActor(rows: NativeRows, grid: Grid, position: number): boolean {
  const [left, top] = tile(grid, position);
  return !!grid.actorPixels?.every(([a, b]) => rows[top + b]?.[left + a] === grid.actor);
}

function forcedLanding(grid: Grid, entry: number, position: number, frames: readonly NativeRows[]): boolean {
  const arrow = grid.mechanisms?.pads[entry];
  if (!arrow || !grid.actorPixels || entry === position) return false;
  const [x, y] = coordinate(entry, grid), [u, v] = coordinate(position, grid), [dx, dy] = arrow;
  if (dx ? v !== y || (u - x) * dx <= 0 : u !== x || (v - y) * dy <= 0) return false;
  return frames.some(frame => showsActor(frame, grid, entry));
}

function restoredGridStart(local: State, choice: Choice, next: Reading): boolean {
  const { timing, last } = local;
  return !!timing && next.position === timing.start && last.position !== timing.start
    && choice.target !== timing.start && (next.charges > last.charges
      || !!timing.clock && axisDistance(last.position, timing.start, local.grid) > 1);
}

function choose({ grid, last, previousObstacle, consecutiveWaits, motions }: State, path: Walk[] | null): Choice | null {
  const next = path?.[0];
  if (!next) return null;
  const target = next.target, uncertain = !last.memory[target], obstacle = last.obstacle;
  const approaching = grid.actorPixels ? motions?.some(({ at, from }) => target === 2 * at - from && axisDistance(at, target, grid) === 1)
    : obstacle !== null && previousObstacle !== null && target === 2 * obstacle - previousObstacle;
  const wait = last.obstacles.includes(target) || approaching;
  if (last.charges && (!Object.keys(last.memory).some(i => Number(i) !== grid.goal && Number(i) !== last.position) || uncertain)) {
    return { action: { action_ref: 'ACTION5', data: {} }, kind: 'pulse', target, uncertain: true };
  }
  if (wait) {
    if (consecutiveWaits >= 2 * Math.max(1, last.risk.length)) return null;
    return { action: { action_ref: 'ACTION5', data: {} }, kind: 'wait', target, uncertain: true };
  }
  return { action: { action_ref: next.action, data: {} }, kind: 'move', target, uncertain };
}

export type NavigationAcquisition = { epoch: number; grid: Grid | null; pulse?: string; movement?: string; won?: number };
export function acquireRevealedNavigation(previous: NavigationAcquisition | undefined, before: NativeObservation, after: NativeObservation,
  command: NativeCommand, first: NativeRows, second: NativeRows): NavigationAcquisition | undefined {
  if (before.available_action_refs.includes('ACTION6')
    || !['ACTION5', ...directions.map(([id]) => id)].every(id => before.available_action_refs.includes(id))) return previous;
  if (previous?.won === before.levels_completed && previous.epoch === before.level_epoch - 1) return previous;
  const local = previous?.epoch === before.level_epoch ? previous : { epoch: before.level_epoch, grid: measure(first) };
  const { grid } = local;
  if (!grid || grid.mechanisms) return local;
  if (after.levels_completed > before.levels_completed) {
    return local.movement ? { ...local, won: after.levels_completed } : local;
  }
  if (before.level_epoch !== after.level_epoch || before.frame_hash === after.frame_hash) return local;
  const current = read(first, grid), next = current && read(second, grid, current);
  if (!current || !next) return local;
  const pulse = command.action_ref === 'ACTION5' && next.charges < current.charges
    && Object.keys(next.memory).length > Object.keys(current.memory).length;
  const movement = directions.some(([input, dx, dy]) => command.action_ref === input && next.position === current.position + grid.columns * dy + dx);
  return { ...local, ...(pulse ? { pulse: after.observation_ref } : {}), ...(movement ? { movement: after.observation_ref } : {}) };
}

export function projectRecalledNavigation(transfer: NavigationAcquisition, previous: State | undefined, observation: NativeObservation, rows: NativeRows) {
  if (!transfer.grid || !transfer.movement || transfer.won !== observation.levels_completed
    || transfer.epoch !== observation.level_epoch - 1) return null;
  const grid = previous?.grid ?? measure(rows) ?? measure(rows, transfer.grid);
  if (!grid || grid.actor !== transfer.grid.actor || grid.tint !== transfer.grid.tint || grid.mechanisms) return null;
  const last = read(rows, grid, previous?.last);
  if (!last) return null;
  const local: State = previous ? { ...previous, last } : { epoch: observation.level_epoch, grid, last, previousObstacle: null,
    refs: transfer.pulse ? [transfer.pulse, transfer.movement] : [transfer.movement], consecutiveWaits: 0 };
  const path = route(last, grid), choice = choose(local, path);
  if (!choice) return null;
  return { local, choice, box: tile(grid, choice.target), goal: tile(grid, grid.goal),
    novelty: !previous && (!!grid.multipleSentries !== !!transfer.grid.multipleSentries || grid.size !== transfer.grid.size || grid.pitch !== transfer.grid.pitch) };
}

export function observeRecalledNavigation({ local, choice }: NonNullable<ReturnType<typeof projectRecalledNavigation>>,
  rows: NativeRows, ref: string) {
  const next = read(rows, local.grid, local.last);
  if (!next) return { matched: false, local, stopped: true };
  const matched = choice.kind === 'pulse' ? next.charges < local.last.charges && Object.keys(next.memory).length > Object.keys(local.last.memory).length
    : choice.kind === 'move' ? next.position === choice.target : null;
  if (choice.kind === 'move' && next.position === local.last.position
    && !next.obstacles.includes(choice.target) && !next.risk.includes(choice.target)) next.memory[choice.target] = 'wall';
  return { matched, stopped: false, local: { ...local, last: next,
    previousObstacle: next.obstacle !== local.last.obstacle ? local.last.obstacle : local.previousObstacle,
    ...(local.grid.actorPixels ? { motions: track(local.last, next, local.grid, local.motions) } : {}),
    refs: [...local.refs.slice(-4), ref], consecutiveWaits: choice.kind === 'wait' ? local.consecutiveWaits + 1 : 0 } };
}

export function createSicNavigateRevealedGrid(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: navigateRevealedGridId,
    async proposeInGroup(group, observation, rows, inputs, remaining, execution): Promise<Proposal | null> {
      if (group !== observedMechanicsGroup) return this.propose(observation, rows, inputs, remaining, execution);
      if (state?.epoch !== observation.level_epoch - 1 && !state?.grid.sentry && !state?.grid.sentryPatterns) return null;
      const proposal = await this.propose(observation, rows, inputs, remaining, execution);
      return proposal?.local.grid.sentry || proposal?.local.grid.sentryPatterns ? proposal : null;
    },
    async propose(observation, rows, _inputs, remaining, execution): Promise<Proposal | null> {
      if (remaining < 1 || !['ACTION5', ...directions.map(([id]) => id)].every(id => observation.available_action_refs.includes(id))) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const inherited = state?.epoch === observation.level_epoch - 1 ? state : null;
      const normal = prior?.grid ?? measure(rows);
      const grid = normal ?? (inherited ? measure(rows, inherited.grid) : null);
      if (!grid) return null;
      const last = read(rows, grid, prior?.last);
      if (!last) return null;
      const timing = grid.mechanisms ? prior?.timing ?? { start: last.position,
        patrols: updateTracks([], last.sentries ?? [], grid), walls: updateTracks([], last.obstacles, grid), scannedPads: [],
        ...(grid.sentryPatterns ? { clock: { ...updateRailClock(rows, grid), crossed: [], visits: [last.position], scans: [] } } : {}) } : null;
      if (timing) last.nextHazards = [...new Set(timing.clock
        ? [...forecastTracks(timing.patrols), ...scheduledRailHazards(rows, grid, timing.clock)]
        : forecastTracks([...timing.walls, ...timing.patrols]))];
      const local: State = prior ? { ...prior, last } : { epoch: observation.level_epoch, grid, last, previousObstacle: null,
        refs: !normal && inherited ? inherited.refs : [], consecutiveWaits: 0, ...(timing ? { timing } : {}) };
      const clock = timing?.clock;
      const door = clock ? clock.gateGoal ?? (last.charges
        ? last.closedDoors?.find(cell => !clock.crossed.includes(cell)) : undefined) : undefined;
      const gateEntry = timing?.clock?.gateEntry;
      const across = gateEntry?.gate === last.position ? gateEntry.gate * 2 - gateEntry.from : undefined;
      const destination = across === undefined ? door ?? grid.goal : last.landings?.[across] ?? across;
      const path = route(last, grid, false, destination, timing?.clock), choice = timing ? grid.sentryPatterns
        ? chooseWithPulseReserve(local, path, destination) : chooseTimed(local, path) : choose(local, path);
      if (!choice) return null;
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.refs.filter(v => v !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      const target = tile(grid, choice.target), offer = { input: choice.action.action_ref, expected: center(target), evidence };
      const known = choice.kind === 'move' && !choice.uncertain;
      const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence, probe: known ? null : offer,
        access: known ? offer : null, interaction: null });
      if (!selected) return null;
      const waiting = grid.multipleSentries && last.charges > 0 ? 'Send a pulse to observe the next positions of the moving obstacles'
        : last.obstacles.length > 1 ? 'Check the next positions of the moving obstacles before crossing'
          : 'Check the next phase of the moving obstacle before crossing';
      const traversing = last.sentryRisk?.length ? 'Follow the route through observed open cells while avoiding observed patrol areas'
        : 'Follow the route through observed open cells';
      const contact = choice.entry ?? choice.target, pad = grid.mechanisms?.pads[contact];
      const situation = choice.kind === 'pulse' && last.closedDoors?.includes(contact) ? 'Test the pulse at the visible closed passage'
        : choice.kind === 'pulse' ? 'Reveal nearby cells before taking an uncertain route'
          : choice.kind === 'wait' && choice.action.action_ref !== 'ACTION5' ? 'Advance the obstacle phase without spending a pulse'
            : choice.kind === 'wait' && timing ? 'Let the moving obstacle pass before crossing'
            : choice.kind === 'wait' ? waiting : pad && choice.uncertain ? 'Test the landing from the directional marker'
              : choice.uncertain ? 'Test the next unconfirmed cell on the route' : traversing;
      const parent = 'G_official_completion';
      const objective = { kind: 'navigate_with_partially_revealed_terrain', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['controlled_sprite', 'revealed_cells', 'moving_obstacle', 'exit'], parentObjective: parent, satisfactionContract: 'official_progress_at_visible_exit' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = navigateRevealedGridId + ':' + need.id, action = choice.action;
      const walk: Walk[] = [];
      const first = path?.[0];
      if (known && (!timing || clock && first?.action === action.action_ref && first.target === choice.target)) for (const leg of path!.slice(0, Math.min(remaining, maximumCommittedActions))) {
        if (last.memory[leg.target] !== 'free' || last.risk.includes(leg.target) || last.sentryRisk?.includes(leg.target)
          || last.obstacles.includes(leg.target)) break;
        if (clock && (leg.entry !== undefined || grid.mechanisms?.pads[leg.target] || grid.mechanisms?.doors[leg.target] !== undefined
          || last.nextHazards?.includes(leg.target))) break;
        walk.push(leg);
      }
      const actions = walk.length > 1 ? walk.map(leg => ({ action_ref: leg.action, data: {} })) : [action];
      return {
        status: 'proposed', kind: navigateRevealedGridId, local, choice, needId: need.id,
        ...(walk.length > 1 ? { walk } : {}),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions,
        steps: actions.map((action, index) => ({ action, expected_after: choice.kind === 'move' ? tile(grid, walk[index]?.target ?? choice.target) : null })),
        sicSituationCard: { strategy: selected.id, need: 'Find a passable route to the exit', situation, evidence, agenda: entries, mode,
          triggerCard: card, actor: tile(grid, last.position), target, exit: tile(grid, grid.goal),
          obstacle: last.obstacle === null ? null : tile(grid, last.obstacle),
          ...(last.obstacles.length > 1 ? { obstacles: last.obstacles.map(index => tile(grid, index)) } : {}),
          ...(last.sentries?.length ? { sentries: last.sentries.map(index => tile(grid, index)) } : {}),
          revealedWalls: Object.values(last.memory).filter(v => v === 'wall').length },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: selected.id, objective: { id, label: navigationPrimitives[selected.id], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, packet, current) {
      if (index > 0 && proposal.walk) {
        const { local } = proposal;
        const basis = local.timing?.clock && state?.epoch === current.level_epoch ? state : local;
        const reading = read(packet.frame_rows, local.grid, basis.last), target = proposal.walk[index]!.target;
        const clock = basis.timing?.clock;
        const nextHazards = clock ? [...scheduledRailHazards(packet.frame_rows, local.grid, clock), ...forecastTracks(basis.timing!.patrols)] : [];
        const admitted = local.epoch === current.level_epoch && reading?.position === proposal.walk[index - 1]!.target
          && reading.memory[target] === 'free' && !reading.risk.includes(target) && !reading.obstacles.includes(target)
          && !reading.sentryRisk?.includes(target) && !nextHazards.includes(target);
        return { admitted, reason: admitted ? 'next_grid_cell_still_open' : 'revealed_grid_changed' };
      }
      const admitted = index === 0 && proposal.binding?.observation_ref === current.observation_ref;
      return { admitted, reason: admitted ? 'revealed_grid_bound' : 'revealed_grid_changed' };
    },
    after(proposal, index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const { local } = proposal, walk = proposal.walk?.[index], choice = walk ? { ...proposal.choice, target: walk.target } : proposal.choice;
      const prior = index > 0 ? read(first, local.grid, local.last) ?? local.last : local.last;
      const next = read(second, local.grid, prior);
      if (!next) return { matched: false, seal_prefix: true, reason: 'grid_return_unreadable' };
      if (restoredGridStart(local, choice, next)) return { matched: false, seal_prefix: true, reason: 'crossing_restored_start' };
      const doorChanged = next.closedDoors?.some(cell => !prior.closedDoors?.includes(cell))
        || prior.closedDoors?.some(cell => !next.closedDoors?.includes(cell));
      const contact = choice.entry ?? choice.target;
      const probeLanding = choice.kind === 'move' && !!local.grid.mechanisms?.pads[contact]
        && prior.landings?.[contact] === undefined && next.position !== prior.position && next.position !== contact;
      const matched = choice.kind === 'pulse' ? next.charges < local.last.charges
        && (!!doorChanged || Object.keys(next.memory).length > Object.keys(local.last.memory).length)
        : choice.kind === 'move' && !probeLanding ? next.position === choice.target : null;
      const terrainChanged = proposal.walk && Object.entries(next.memory).some(([cell, value]) => prior.memory[Number(cell)] !== value);
      return { matched, seal_prefix: !matched || !!terrainChanged || index + 1 >= proposal.actions.length, reason: choice.kind === 'pulse' ? 'check_revealed_cells' : choice.kind === 'move'
        ? probeLanding ? 'check_directional_marker_landing' : matched ? 'observed_grid_step' : 'grid_step_contradicted' : 'observe_obstacle_phase' };
    },
    record(before, after, _action, _first, second, proposal, index, frames) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const local = (index > 0 && state?.epoch === before.level_epoch ? state : null) ?? proposal.local;
      const walk = proposal.walk?.[index], choice = walk ? { ...proposal.choice, target: walk.target } : proposal.choice;
      const next = read(second, local.grid, local.last);
      if (!next) return { events: [] };
      const contact = choice.entry ?? choice.target, timing = local.timing;
      const reset = restoredGridStart(local, choice, next);
      const ejected = !reset && choice.kind === 'move' && next.position !== local.last.position
        && forcedLanding(local.grid, contact, next.position, frames);
      if (ejected && next.landings) next.landings[contact] = next.position;
      if (reset) next.failedEntrances = [...new Set([...(next.failedEntrances ?? []), contact])];
      const clock = timing?.clock;
      const didNotEnter = next.position === local.last.position || !!clock && next.position !== contact && frames.length > 0
        && !frames.some(frame => showsActor(frame, local.grid, contact));
      if (!reset && !ejected && choice.kind === 'move' && didNotEnter
        && !next.obstacles.includes(contact) && !next.risk.includes(contact) && !next.closedDoors?.includes(contact)
        && (!timing || !local.last.sentries?.includes(contact) && !next.sentries?.includes(contact))) {
        next.memory[contact] = 'wall';
      }
      const scanned = !reset && choice.kind === 'pulse' && !!local.grid.mechanisms?.pads[contact];
      const entered = clock && !reset && next.position !== local.last.position && local.grid.mechanisms?.doors[next.position] !== undefined
        && !clock.crossed.includes(next.position) ? { gate: next.position, from: local.last.position } : undefined;
      const left = clock?.gateEntry && next.position !== clock.gateEntry.gate ? clock.gateEntry : undefined;
      const crossed = clock && !reset && left && next.position !== left.from ? [...clock.crossed, left.gate] : reset ? [] : clock?.crossed ?? [];
      const gateEntry = reset ? undefined : entered ?? (left ? undefined : clock?.gateEntry);
      const selectedGate = choice.kind === 'pulse' && local.last.closedDoors?.includes(contact) ? contact : clock?.gateGoal;
      const gateGoal = reset || selectedGate !== undefined && crossed.includes(selectedGate) ? undefined : selectedGate;
      const visits = !clock || reset ? [next.position] : next.position === local.last.position
        ? clock.visits : [...clock.visits.slice(-31), next.position];
      const scans = !clock || reset ? [] : choice.kind === 'pulse' && next.charges < local.last.charges
        ? [...clock.scans, local.last.position] : clock.scans;
      state = { ...local, last: next, previousObstacle: next.obstacle !== local.last.obstacle ? local.last.obstacle : local.previousObstacle,
        ...(local.grid.actorPixels ? { motions: track(local.last, next, local.grid, local.motions) } : {}),
        ...(timing ? { timing: { start: timing.start, patrols: updateTracks(reset ? [] : timing.patrols, next.sentries ?? [], local.grid),
          walls: updateTracks(reset ? [] : timing.walls, next.obstacles, local.grid),
          scannedPads: reset ? [] : scanned ? [...timing.scannedPads, contact] : timing.scannedPads,
          ...(clock ? { clock: { ...updateRailClock(second, local.grid, reset ? undefined : clock), crossed, visits, scans,
            ...(gateGoal === undefined ? {} : { gateGoal }), ...(gateEntry ? { gateEntry } : {}) } } : {}),
          ...(scanned ? { pendingPad: contact } : {}) } } : {}),
        refs: [...local.refs.slice(-4), after.observation_ref],
        consecutiveWaits: choice.kind === 'wait' ? local.consecutiveWaits + 1 : 0 };
      const opened = timing && local.last.closedDoors?.some(cell => !next.closedDoors?.includes(cell));
      return { events: [], ...(reset ? { reviewEvidence: 'The return restored the starting position and pulse reserve.' }
        : ejected ? { reviewEvidence: 'The move entered the marked cell and the return showed the carrier slide to a new landing.' }
        : opened ? { reviewEvidence: 'The pulse changed a closed passage into an opening.' } : {}) };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
