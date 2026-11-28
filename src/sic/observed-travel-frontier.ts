import type {NativeBox} from '../logos-engine/v6-native-types.ts';
import type {WalkingStep} from './verified-walking-series.ts';
import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeCommand, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { observedCommandKey } from './observed-command-frontier.ts';
import { measureComponentTranslations } from './observed-translation.ts';

type Move = { delta: NativePoint; ref: string };
type Grid = { pitch: number; phase: NativePoint; ink: number; floor: number; signature?: string;
  annotatedMarks?: Readonly<Record<string, readonly number[]>>; actorFooting?: readonly number[] };
type Calibration = { grid: Grid; previous: string[]; next: string[]; destination: string; delta: NativePoint };
type ContactSite = { appearance: string; reference: string };
type ContactCover = { sites: Record<string, ContactSite>; evidence: string[] };
export type ObservedTravel = { grid: Grid; actor: string | null; supports: string[]; visited: string[];
  moves: Record<string, Move>; tested: Record<string, number>; altered: string[]; controls: string[];
  completed: string[]; switches: Record<string, string | null>; pendingSelection?: string; refs: string[]; stalled: number;
  possibleContacts?: Record<string, ContactSite>;
  contactAccess?: { origin: string; sites: string[]; evidence: [string, string] }; contactCover?: ContactCover };
export type TravelTrial = { approach?: WalkingStep[]; command: NativeCommand; target: NativePoint; evidence: string[];
  purpose: 'approach' | 'contact' | 'test_contact_hypothesis' | 'verify_contact_access' | 'test_contact_activation'
    | 'switch' | 'select' | 'approach_object' | 'separate_object'; experiment?: string; jointContactCover?: true };
export type MarkContact = { command: NativeCommand; target: string; expected: string; evidence: string[] };

const key = ([x, y]: NativePoint) => `${x},${y}`;
const point = (value: string): NativePoint => value.split(',').map(Number) as [number, number];
const add = ([x, y]: NativePoint, [dx, dy]: NativePoint): NativePoint => [x + dx, y + dy];
const distance = ([x, y]: NativePoint, [u, v]: NativePoint) => Math.abs(x - u) + Math.abs(y - v);
const directional = (action: string) => /^ACTION[1-4]$/.test(action);

function tile(rows: NativeRows, grid: Grid, [x, y]: NativePoint) {
  return rows.slice(y, y + grid.pitch).flatMap(row => row.slice(x, x + grid.pitch));
}

function paletteSignature(pixels: readonly number[]) {
  return [...pixels].sort((a, b) => a - b).join(',');
}

function corners(pitch: number) {
  return new Set([0, pitch - 1, pitch * (pitch - 1), pitch * pitch - 1]);
}

function matchesAnnotatedOverlay(pixels: readonly number[], grid: Grid, cell: string) {
  const annotation = grid.annotatedMarks?.[cell];
  if (!annotation || !grid.signature || pixels[Math.floor(pixels.length / 2)] !== grid.ink) return false;
  const limits = corners(grid.pitch);
  if (pixels.some((ink, i) => limits.has(i) && ink !== grid.floor && !annotation.includes(ink))) return false;
  const normalized = pixels.map((ink, i) => limits.has(i) ? grid.floor : ink);
  return paletteSignature(normalized) === grid.signature;
}

function matchesActorFooting(pixels: readonly number[], grid: Grid) {
  if (!grid.signature || grid.actorFooting?.length !== pixels.length || !pixels.includes(grid.ink)) return false;
  const footing = grid.actorFooting;
  if (footing.includes(grid.ink)) return false;
  let exposed = false;
  const normalized = pixels.map((ink, index) => {
    if (ink !== footing[index]) return ink;
    exposed = true;
    return grid.floor;
  });
  return exposed && paletteSignature(normalized) === grid.signature;
}

function dominant(pixels: readonly number[], excluded: number) {
  const counts = new Map<number, number>();
  for (const ink of pixels) if (ink !== excluded) counts.set(ink, (counts.get(ink) ?? 0) + 1);
  return [...counts].find(([, count]) => count * 2 > pixels.length)?.[0];
}

function frameMarks(rows: NativeRows, { pitch, phase, floor }: Grid) {
  return geometricComponents(rows).filter(({ color, rectangular, bbox: [l, t, r, b], area }) => {
    if (color === floor || rectangular || r - l + 1 !== pitch || b - t + 1 !== pitch
      || l % pitch !== phase[0] || t % pitch !== phase[1] || area < 2 * pitch - 1) return false;
    return rows[t + Math.floor(pitch / 2)]?.[l + Math.floor(pitch / 2)] === floor;
  }).map(({ bbox: [x, y] }) => key([x, y]));
}

function read(rows: NativeRows, grid: Grid) {
  const cells = new Map<string, number[]>(), pieces: string[] = [], onFooting = new Set<string>();
  for (let y = grid.phase[1]; y + grid.pitch <= rows.length; y += grid.pitch) {
    for (let x = grid.phase[0]; x + grid.pitch <= rows[0]!.length; x += grid.pitch) {
      const id = key([x, y]), pixels = tile(rows, grid, [x, y]);
      cells.set(id, pixels);
      if (grid.signature ? pixels.includes(grid.ink) && (paletteSignature(pixels) === grid.signature || matchesAnnotatedOverlay(pixels, grid, id))
        : pixels.filter(ink => ink === grid.ink).length >= Math.max(2, Math.floor(grid.pitch / 2))) pieces.push(id);
      else if (matchesActorFooting(pixels, grid)) { pieces.push(id); onFooting.add(id); }
    }
  }
  return { cells, pieces, onFooting };
}

export { read as readTravelGrid, tile as readTravelCell };

export function rebindTravelControls(previous: Pick<ObservedTravel, 'grid' | 'moves'>, rows: NativeRows,
  inputs: readonly string[]): ObservedTravel | undefined {
  const { grid, moves } = previous;
  if (inputs.length !== 4 || Object.keys(moves).length !== inputs.length || !inputs.every(input => moves[input])) return;
  const { pieces } = read(rows, grid);
  if (pieces.length !== 1) return;
  const actor = pieces[0]!;
  return { grid, moves, actor, visited: [actor], supports: [], tested: {}, altered: [], controls: [],
    completed: [], switches: {}, refs: Object.values(moves).map(move => move.ref), stalled: 0 };
}

export function annotateTravelMarks(travel: ObservedTravel | undefined, rows: NativeRows): ObservedTravel | undefined {
  if (!travel?.grid.signature || travel.grid.annotatedMarks || travel.grid.pitch % 2 !== 1) return travel;
  const { pitch, floor, ink } = travel.grid, half = Math.floor(pitch / 2), center = half * pitch + half;
  const groups = new Map<number, Record<string, readonly number[]>>();
  for (const [cell, pixels] of read(rows, travel.grid).cells) {
    const arm = pixels[half]!, accent = pixels[center]!;
    if (arm === floor || arm === ink || accent === floor || accent === arm || accent === ink) continue;
    if (!pixels.every((color, i) => i === center || color === (i % pitch === half || Math.floor(i / pitch) === half ? arm : floor))) continue;
    const group = groups.get(arm) ?? {};
    group[cell] = [arm, accent]; groups.set(arm, group);
  }
  const repeated = [...groups.values()].filter(group => Object.keys(group).length >= 2);
  return repeated.length === 1 ? { ...travel, grid: { ...travel.grid, annotatedMarks: repeated[0]! } } : travel;
}

function knownFooting(pixels: readonly number[] | undefined, floor: number, supports: readonly string[]) {
  return !!pixels && (pixels.every(ink => ink === floor) || supports.includes(pixels.join(',')));
}

function repeatedContactCover(
  state: ObservedTravel, cells: ReadonlyMap<string, number[]>, pieces: readonly string[],
): ContactCover | undefined {
  if (pieces.length < 2 || pieces.length > 4) return;
  const groups = new Map<string, Record<string, ContactSite>>();
  const visited = new Set(state.visited);
  for (const [cell, contact] of Object.entries(state.possibleContacts ?? {})) {
    const pixels = cells.get(cell);
    if (!pixels || pixels.join(',') !== contact.appearance || pieces.includes(cell) || visited.has(cell)) continue;
    const shape = pixels.map(ink => Number(ink !== state.grid.floor)).join('');
    const sites = groups.get(shape) ?? {};
    sites[cell] = contact;
    groups.set(shape, sites);
  }
  const matching = [...groups.values()].filter(sites => Object.keys(sites).length === pieces.length);
  if (matching.length === 1) return { sites: matching[0]!,
    evidence: [...new Set(Object.values(matching[0]!).map(contact => contact.reference))] };
}

function currentCover(cover: ContactCover | undefined,
  cells: ReadonlyMap<string, number[]>, occupied: readonly string[]) {
  if (!cover) return;
  const sites = Object.entries(cover.sites);
  if (sites.length !== occupied.length || sites.every(([cell]) => occupied.includes(cell))) return;
  if (sites.every(([cell, contact]) => occupied.includes(cell) || cells.get(cell)?.join(',') === contact.appearance)) return cover;
}

function calibrateAmongOtherChanges(before: NativeRows, after: NativeRows, lattices: Iterable<Grid>,
  changed: readonly NativePoint[]): Calibration[] {
  const translations = measureComponentTranslations(before, after, part => part.area >= 3 && part.area <= 36);
  const result: Calibration[] = [];
  for (const { from, displacement: delta } of translations) {
    if (Boolean(delta[0]) === Boolean(delta[1])) continue;
    for (const lattice of lattices) {
      const { pitch, phase: [px, py], floor } = lattice;
      if (distance([0, 0], delta) !== pitch || from.color === floor) continue;
      const [x, y, r, b] = from.bbox;
      const origin: NativePoint = [px + Math.floor((x - px) / pitch) * pitch, py + Math.floor((y - py) / pitch) * pitch];
      const landing = add(origin, delta);
      if (origin[0] < 0 || origin[1] < 0 || r >= origin[0] + pitch || b >= origin[1] + pitch
        || landing[0] < 0 || landing[1] < 0 || landing[0] + pitch > after[0]!.length || landing[1] + pitch > after.length) continue;
      const outside = ([u, v]: NativePoint, [l, t]: NativePoint) => u < l || u >= l + pitch || v < t || v >= t + pitch;
      if (!changed.some(cell => outside(cell, origin) && outside(cell, landing))) continue;
      const oldTile = tile(before, lattice, origin), newTile = tile(after, lattice, landing);
      const signature = paletteSignature(oldTile);
      if (!oldTile.includes(floor) || paletteSignature(newTile) !== signature) continue;
      const grid = { ...lattice, ink: from.color, signature };
      const previous = read(before, grid).pieces, next = read(after, grid).pieces;
      if (previous.length === 1 && previous[0] === key(origin) && next.length === 1 && next[0] === key(landing)) {
        result.push({ grid, previous, next, destination: next[0]!, delta });
      }
    }
  }
  return result;
}

function learnGrid(before: NativeRows, after: NativeRows, command: string, ref: string,
  allowUnframedContact: boolean): ObservedTravel | undefined {
  if (before.length !== after.length || before[0]?.length !== after[0]?.length) return;
  const changed: NativePoint[] = [];
  for (const [y, row] of before.entries()) {
    for (const [x, ink] of row.entries()) if (ink !== after[y]?.[x]) changed.push([x, y]);
  }
  if (changed.length < 6) return;
  const lattices = new Map<string, Grid>();
  for (const { color, bbox: [x, y, r, b], rectangular, area } of geometricComponents(before)) {
    const pitch = r - x + 1;
    if (rectangular || pitch < 2 || pitch > 8 || b - y + 1 !== pitch || area < 2 * pitch - 1) continue;
    const floor = before[y + Math.floor(pitch / 2)]![x + Math.floor(pitch / 2)]!;
    if (floor === color) continue;
    const grid: Grid = { pitch, phase: [x % pitch, y % pitch], ink: -1, floor };
    lattices.set(JSON.stringify(grid), grid);
  }
  if (allowUnframedContact && !lattices.size) {
    for (const { from, displacement } of measureComponentTranslations(before, after, part => part.area >= 3)) {
      const [dx, dy] = displacement, pitch = Math.abs(dx) + Math.abs(dy);
      const [x, y, right, bottom] = from.bbox;
      if (Boolean(dx) === Boolean(dy) || pitch < 2 || pitch > 8
        || right - x + 1 !== pitch || bottom - y + 1 !== pitch) continue;
      const floor = after[y]![x]!;
      if (floor === from.color) continue;
      const grid: Grid = { pitch, phase: [x % pitch, y % pitch], ink: -1, floor };
      const vacated = tile(after, grid, [x, y]), destination = tile(before, grid, [x + dx, y + dy]);
      if (vacated.length === pitch ** 2 && destination.length === pitch ** 2
        && vacated.every(ink => ink === floor) && destination.every(ink => ink === floor)) {
        lattices.set(JSON.stringify(grid), grid);
      }
    }
  }
  const candidates: Calibration[] = [];
  for (const lattice of lattices.values()) {
    const [px, py] = lattice.phase, size = lattice.pitch;
    const origins = new Set(changed.map(([x, y]) =>
      key([px + Math.floor((x - px) / size) * size, py + Math.floor((y - py) / size) * size])));
    const exits: [string, number[]][] = [], entries: [string, number[]][] = [];
    for (const id of origins) {
      const at = point(id);
      if (at[0] < 0 || at[1] < 0 || at[0] + size > before[0]!.length || at[1] + size > before.length) continue;
      const first = tile(before, lattice, at), second = tile(after, lattice, at);
      const wasFloor = first.every(ink => ink === lattice.floor), isFloor = second.every(ink => ink === lattice.floor);
      if (!wasFloor && isFloor) exits.push([id, first]);
      if (wasFloor && !isFloor) entries.push([id, second]);
    }
    if (exits.length !== 1 || entries.length !== 1) continue;
    const [from, vacated] = exits[0]!, [destination, occupied] = entries[0]!;
    const [x, y] = point(from), [u, v] = point(destination), delta: NativePoint = [u - x, v - y];
    if (Boolean(delta[0]) === Boolean(delta[1]) || distance([x, y], [u, v]) !== lattice.pitch) continue;
    // A cursor may change its silhouette as it turns. Learn from matching ink vacated and
    // acquired on two separate cells of the same measured surface.
    const hues = [...new Set(vacated)].filter(ink => ink !== lattice.floor
      && vacated.filter(color => color === ink).length >= 3
      && occupied.filter(color => color === ink).length >= 3);
    if (hues.length !== 1) continue;
    const grid = { ...lattice, ink: hues[0]! };
    const previous = read(before, grid).pieces, next = read(after, grid).pieces;
    if (!previous.length || previous.length > 4 || next.length !== previous.length
      || previous.filter(cell => !next.includes(cell)).join(';') !== from
      || next.filter(cell => !previous.includes(cell)).join(';') !== destination) continue;
    candidates.push({ grid, previous, next, destination, delta });
  }
  if (!candidates.length && lattices.size) candidates.push(...calibrateAmongOtherChanges(before, after, lattices.values(), changed));
  if (candidates.length !== 1) return;
  const { grid, previous, next, destination, delta } = candidates[0]!;
  return { grid, actor: destination, supports: [], visited: [...previous, ...next], moves: { [command]: { delta, ref } },
    tested: {}, altered: [], controls: [], completed: [], switches: {}, refs: [ref], stalled: 0 };
}

function trialKey(cells: ReadonlyMap<string, number[]>, action: string, from: string, target: NativePoint) {
  return JSON.stringify([action, from, cells.get(key(target))]);
}

// A departure from beside a repeated object distinguishes a following object from a
// stationary one. Reach the experimental position using already measured movement.
export function chooseSeparationTrial(travel: ObservedTravel | undefined, rows: NativeRows,
  inputs: readonly NativeCommand[], tested: readonly string[]): TravelTrial | undefined {
  if (!travel?.actor) return;
  const { grid, actor } = travel, { cells, pieces } = read(rows, grid);
  if (!pieces.includes(actor)) return;
  const moves = inputs.flatMap(command => {
    const move = travel.moves[command.action_ref];
    return move ? [{ command, ...move }] : [];
  });
  if (!moves.length) return;
  const supports = new Set(travel.supports);
  const walkable = (cell: string) => {
    const pixels = cells.get(cell);
    return cell === actor || !!pixels && (pixels.every(v => v === grid.floor) || supports.has(pixels.join(',')));
  };
  const counts = new Map<string, number>();
  for (const [cell, pixels] of cells) {
    if (pieces.includes(cell) || walkable(cell) || pixels.includes(grid.floor) || new Set(pixels).size < 2) continue;
    const shape = pixels.join(',');
    counts.set(shape, (counts.get(shape) ?? 0) + 1);
  }
  const paths = new Map<string, NativeCommand | null>([[actor, null]]);
  for (const [cell, first] of paths) {
    const pos = point(cell);
    for (const move of moves) {
      const dest = add(pos, move.delta), ahead = key(dest);
      if (!walkable(ahead) || travel.tested[trialKey(cells, move.command.action_ref, cell, dest)] === -1) continue;
      const behind = key([pos[0] - move.delta[0], pos[1] - move.delta[1]]);
      const pattern = cells.get(behind)?.join(',') ?? '';
      const experiment = JSON.stringify([pattern, move.command.action_ref]);
      if ((counts.get(pattern) ?? 0) >= 2 && !tested.includes(experiment)) {
        return { command: first ?? move.command, target: point(behind), evidence: [...travel.refs, move.ref],
          purpose: first ? 'approach_object' : 'separate_object', ...(first ? {} : { experiment }) };
      }
      if (!paths.has(ahead)) paths.set(ahead, first ?? move.command);
    }
  }
}

export function chooseAnnotatedMarkContact(travel: ObservedTravel | undefined, rows: NativeRows,
  inputs: readonly NativeCommand[]): MarkContact | undefined {
  if (!travel?.actor || !travel.grid.annotatedMarks) return;
  const { grid, actor } = travel, { cells, pieces } = read(rows, grid);
  if (pieces.length !== 1 || pieces[0] !== actor) return;
  const moves = inputs.flatMap(command => travel.moves[command.action_ref] ? [{ command, ...travel.moves[command.action_ref]! }] : []);
  const visited = new Set(travel.visited), center = Math.floor(grid.pitch * grid.pitch / 2);
  const marks = new Set(Object.entries(travel.grid.annotatedMarks).filter(([cell, profile]) =>
    !visited.has(cell) && cells.get(cell)?.[center] === profile[1]).map(([cell]) => cell));
  if (!marks.size) return;
  const queue: { at: string; first?: { command: NativeCommand; expected: string } }[] = [{ at: actor }];
  const seen = new Set([actor]);
  for (const { at, first } of queue) {
    if (first && marks.has(at)) {
      return { ...first, target: at, evidence: [...new Set([...travel.refs, ...moves.map(move => move.ref)])] };
    }
    for (const { command, delta } of moves) {
      const destination = add(point(at), delta), cell = key(destination), pixels = cells.get(cell);
      if (!pixels || seen.has(cell) || (travel.tested[trialKey(cells, command.action_ref, at, destination)] ?? 0) < 0) continue;
      const walkable = pixels.every(ink => ink === grid.floor || ink === grid.ink) &&
        pixels.filter(ink => ink === grid.floor).length > pixels.length / 2;
      if (!walkable && !marks.has(cell)) continue;
      seen.add(cell); queue.push({ at: cell, first: first ?? { command, expected: cell } });
    }
  }
}

export function observedTravelActor(travel: ObservedTravel | undefined, rows: NativeRows): string | undefined {
  if (!travel) return;
  const { pieces } = read(rows, travel.grid);
  return pieces.length === 1 ? pieces[0] : undefined;
}

export function observeTravel(previous: ObservedTravel | undefined, before: NativeRows, after: NativeRows,
  command: NativeCommand, ref: string, witnessPossibleContacts = false): ObservedTravel | undefined {
  const action = command.action_ref;
  if (!previous) return directional(action) ? learnGrid(before, after, action, ref, witnessPossibleContacts) : undefined;
  const { grid } = previous, first = read(before, grid), next = read(after, grid);
  const left = first.pieces.filter(cell => !next.pieces.includes(cell)), entered = next.pieces.filter(cell => !first.pieces.includes(cell));
  const changed = [...first.cells].filter(([cell, pixels]) => !first.pieces.includes(cell) && !next.pieces.includes(cell)
    && pixels.some((ink, i) => ink !== next.cells.get(cell)?.[i])).map(([cell]) => cell);
  if (directional(action) && !left.length && !entered.length && changed.length >= 2 && (!grid.annotatedMarks || !first.pieces.length)) {
    const other = learnGrid(before, after, action, ref, witnessPossibleContacts);
    if (other && other.grid.ink !== grid.ink) return other;
  }
  let actor = previous.actor, pendingSelection = previous.pendingSelection;
  const moves = { ...previous.moves }, tested = { ...previous.tested }, switches = { ...previous.switches };
  const controls = action === 'ACTION5' && changed.length >= 2 ? [...new Set([...previous.controls, action])] : previous.controls;
  const altered = action === 'ACTION5' && changed.length >= 2 ? [...new Set([...previous.altered, ...changed])].sort() : previous.altered;
  const supports = new Set(previous.supports), visited = new Set(previous.visited), completed = new Set(previous.completed);
  let possibleContacts = previous.possibleContacts;
  let contactCover = currentCover(previous.contactCover, next.cells, next.pieces);
  const stillOpen = previous.contactAccess?.sites.filter(cell => !next.pieces.includes(cell)
    && !visited.has(cell) && knownFooting(next.cells.get(cell), grid.floor, previous.supports));
  let contactAccess = previous.contactAccess && stillOpen?.length ? { ...previous.contactAccess, sites: stillOpen } : undefined;
  if (left.length === 1 && entered.length === 1) {
    const from = left[0]!, to = entered[0]!, [x, y] = point(from), [u, v] = point(to);
    const delta: NativePoint = [u - x, v - y];
    actor = to;
    pendingSelection = undefined;
    visited.add(to);
    if (directional(action) && distance([x, y], [u, v]) === grid.pitch && (!delta[0] || !delta[1])) {
      if (!moves[action]) moves[action] = { delta, ref };
      if (key(moves[action]!.delta) === key(delta)) {
        supports.add(first.cells.get(to)!.join(','));
        if (witnessPossibleContacts) {
          const contact = previous.possibleContacts?.[to];
          if (contact && contact.appearance === first.cells.get(to)?.join(',')) {
            if (!frameMarks(before, grid).length) {
              const cover = currentCover(previous.contactCover, first.cells, first.pieces)
                ?? repeatedContactCover(previous, first.cells, first.pieces);
              if (cover?.sites[to]) {
                const witnessed = currentCover(cover, next.cells, next.pieces);
                if (witnessed) contactCover = { ...witnessed, evidence: [...new Set([...witnessed.evidence, ref])] };
              }
            }
            const opened = changed.filter(cell => !visited.has(cell)
              && !knownFooting(first.cells.get(cell), grid.floor, previous.supports)
              && knownFooting(next.cells.get(cell), grid.floor, previous.supports));
            if (opened.length) contactAccess = { origin: to, sites: opened, evidence: [contact.reference, ref] };
          }
          possibleContacts = {};
          for (const [cell, pixels] of next.cells) {
            if (visited.has(cell) || next.pieces.includes(cell) || pixels.includes(grid.ink)) continue;
            const marks = pixels.filter(ink => ink !== grid.floor).length;
            if (marks < 2 || marks * 2 >= pixels.length || !pixels.every((ink, i) => first.cells.get(cell)?.[i] === ink)) continue;
            possibleContacts[cell] = { appearance: pixels.join(','), reference: ref };
          }
        }
      }
    }
    if (frameMarks(before, grid).includes(to)) completed.add(to);
    completed.delete(from);
  } else if (directional(action) && pendingSelection && next.pieces.includes(pendingSelection)) {
    if (actor !== pendingSelection && next.pieces.length > 1) actor = pendingSelection;
    pendingSelection = undefined;
  } else if (action === 'ACTION6' && typeof command.data.x === 'number' && typeof command.data.y === 'number') {
    const { x, y } = command.data, at = first.pieces.find(cell => {
      const [l, t] = point(cell);
      return x >= l && x < l + grid.pitch && y >= t && y < t + grid.pitch;
    });
    if (at && before.some((row, yy) => row.some((ink, xx) => ink !== after[yy]?.[xx]))) {
      actor = at;
      pendingSelection = at;
    }
  }
  const origin = previous.actor;
  let freshTrial = false;
  if (action === 'ACTION5' && origin && previous.altered.includes(origin)) {
    switches[origin] = actor === origin ? null : actor;
  }
  if (origin && first.pieces.includes(origin)) {
    const expected = directional(action) && moves[action] ? add(point(origin), moves[action]!.delta) : point(origin);
    const attempt = trialKey(first.cells, observedCommandKey(command), origin, expected);
    freshTrial = !Object.hasOwn(tested, attempt);
    if (directional(action) && actor === origin && !left.length && !entered.length && !changed.includes(key(expected))) tested[attempt] = -1;
    else tested[attempt] = (tested[attempt] ?? 0) + 1;
  }
  for (const cell of completed) if (!next.pieces.includes(cell)) completed.delete(cell);
  const gained = freshTrial || visited.size > previous.visited.length || supports.size > previous.supports.length
    || completed.size > previous.completed.length || Object.keys(moves).length > Object.keys(previous.moves).length;
  return { grid, actor: actor && next.pieces.includes(actor) ? actor : next.pieces.length === 1 ? next.pieces[0]! : null,
    supports: [...supports], visited: [...visited], moves, tested, altered, controls, switches, completed: [...completed],
    ...(possibleContacts ? { possibleContacts } : {}),
    ...(contactAccess ? { contactAccess } : {}),
    ...(contactCover ? { contactCover } : {}),
    ...(pendingSelection ? { pendingSelection } : {}), refs: [...previous.refs.slice(-5), ref], stalled: gained ? 0 : previous.stalled + 1 };
}

export function chooseTravelTrial(state: ObservedTravel | undefined, rows: NativeRows, inputs: readonly NativeCommand[],
  canSelect: boolean, allowUnframedContact = false): TravelTrial | undefined {
  if (!state?.actor || state.stalled >= 12) return;
  const { grid, actor, tested, switches } = state, { cells, pieces } = read(rows, grid);
  const framed = frameMarks(rows, grid).filter(cell => !pieces.includes(cell));
  if (!pieces.includes(actor) || pieces.length > 4) return;
  const moves = inputs.flatMap(command => state.moves[command.action_ref] ? [{ command, ...state.moves[command.action_ref]! }] : []);
  if (!moves.length) return;
  const visited = new Set(state.visited);
  const hypotheses = !framed.length && allowUnframedContact && moves.length >= 2
    ? Object.keys(state.possibleContacts ?? {}).filter(cell => !pieces.includes(cell) && !visited.has(cell)
      && cells.get(cell)?.join(',') === state.possibleContacts![cell]!.appearance) : [];
  const witnessedAccess = !framed.length && allowUnframedContact
    ? (state.contactAccess?.sites ?? []).filter(cell => !pieces.includes(cell) && !visited.has(cell)
      && knownFooting(cells.get(cell), grid.floor, state.supports)) : [];
  const cover = !framed.length && allowUnframedContact && canSelect && moves.length >= 2
    ? currentCover(state.contactCover, cells, pieces) ?? repeatedContactCover(state, cells, pieces) : undefined;
  const pendingCover = Object.keys(cover?.sites ?? {}).filter(cell => !pieces.includes(cell));
  const goals = framed.length ? framed : [...new Set([...pendingCover, ...witnessedAccess, ...hypotheses])];
  const desired = pendingCover.length ? pendingCover : goals;
  if (!goals.length) return;
  const access = new Set(witnessedAccess);
  const contactOnly = new Set(cover ? pendingCover : hypotheses.filter(cell => !access.has(cell)));
  const evidence = [...new Set([...state.refs, ...moves.map(move => move.ref)])];
  const start = point(actor);
  const unmeasured = inputs.filter(input => directional(input.action_ref) && !state.moves[input.action_ref]);
  const untriedAt = (cell: string) => unmeasured.find(input => !(trialKey(cells, input.action_ref, cell, point(cell)) in tested));
  const unmapped = untriedAt(actor);
  if (unmapped) return { command: unmapped, target: start, purpose: 'contact', evidence };
  const switchCommand = inputs.find(input => state.controls.includes(input.action_ref));
  const altered = new Set(state.altered);
  const floorCost = (cell: string): number => {
    if (goals.includes(cell)) return 0;
    const pixels = cells.get(cell);
    if (!pixels) return Infinity;
    if (state.supports.includes(pixels.join(',')) || dominant(pixels, grid.ink) === grid.floor) return 1;
    return new Set(pixels).size > 1 && (grid.signature || !pixels.includes(grid.ink))
      && (pixels.includes(grid.floor) || altered.has(cell)) ? 4 : Infinity;
  };
  type Path = { at: string; first: NativeCommand | null; cost: number; parent?:Path; via?:NativeCommand };
  const canTestSwitch = (cell: string) => !!switchCommand && altered.has(cell) && !(cell in switches);
  function route(origin: string) {
    const open: Path[] = [{ at: origin, first: null, cost: 0 }];
    const costs = new Map([[origin, 0]]);
    let best: { first: NativeCommand; cell: string; score: number; goal: boolean; priority: number; path?:Path } | undefined;
    const offer = (first: NativeCommand, cell: string, cost: number, goal: boolean, path?:Path) => {
      const near = Math.min(...desired.map(target => distance(point(cell), point(target)))) / grid.pitch;
      const score = cost + 4 * near - (canTestSwitch(cell) ? 4 : 0);
      const priority = pendingCover.includes(cell) ? 3 : access.has(cell) ? 2 : Number(goal && !cover);
      if (!best || priority > best.priority || priority === best.priority && score < best.score) {
        best = { first, cell, score, goal: priority > 0, priority, path };
      }
    };
    for (let i = 0; i < open.length; i++) {
      const node = open[i]!;
      if (node.cost !== costs.get(node.at)) continue;
      if (node.first && (!visited.has(node.at) || canTestSwitch(node.at) || goals.includes(node.at) || untriedAt(node.at))) {
        offer(node.first, node.at, node.cost, goals.includes(node.at),node);
      }
      for (const move of moves) {
        const destination = add(point(node.at), move.delta), cell = key(destination);
        if (pieces.includes(cell) && cell !== origin) continue;
        const tried = tested[trialKey(cells, move.command.action_ref, node.at, destination)] ?? 0;
        if (tried < 0) continue;
        if (contactOnly.has(cell)) {
          if (!tried) offer(node.first ?? move.command, cell, node.cost + 1, true);
          continue;
        }
        const cost = node.cost + 1 + floorCost(cell) + Math.min(8, tried * 2);
        if (!Number.isFinite(cost)) {
          const pixels = cells.get(cell);
          // A visible feature is worth a contact trial. Transit beyond it needs a measured foothold.
          if (!tried && pixels && new Set(pixels).size > 1 && (grid.signature || !pixels.includes(grid.ink))) {
            offer(node.first ?? move.command, cell, node.cost + 6, false);
          }
          continue;
        }
        if (cost >= (costs.get(cell) ?? Infinity)) continue;
        costs.set(cell, cost);
        open.push({ at: cell, first: node.first ?? move.command, cost, parent:node, via:move.command });
      }
      const landing = switches[node.at];
      if (switchCommand && landing && !pieces.includes(landing) && node.cost + 2 < (costs.get(landing) ?? Infinity)) {
        costs.set(landing, node.cost + 2);
        open.push({ at: landing, first: node.first ?? switchCommand, cost: node.cost + 2, parent:node, via:switchCommand });
      }
    }
    return best;
  }
  const park = (cell: string) => state.completed.includes(cell) || !!cover?.sites[cell];
  const active = park(actor) ? undefined : route(actor);
  const contactReturn = witnessedAccess.length && state.contactAccess;
  if (contactReturn && contactReturn.origin === actor && contactReturn.evidence[1] === state.refs.at(-1)
    && !park(actor) && active?.priority !== 3) {
    const controls = inputs.filter(command => !directional(command.action_ref)
      && !Object.hasOwn(tested, trialKey(cells, observedCommandKey(command), actor, start)));
    if (controls.length === 1) return { command: controls[0]!, target: start, purpose: 'test_contact_activation',
      evidence: [...new Set([...evidence, ...contactReturn.evidence])] };
  }
  if (switchCommand && !active?.goal && canTestSwitch(actor)) {
    return { command: switchCommand, target: start, purpose: 'switch', evidence };
  }
  const peer = pieces.filter(cell => cell !== actor && !park(cell)).map(cell => ({ cell, plan: route(cell) }))
    .filter(option => !!option.plan).sort((a, b) => a.plan!.score - b.plan!.score)[0];
  if (canSelect && peer && (!active || peer.plan!.score + 8 < active.score)) {
    const at = point(peer.cell), offset = Math.floor(grid.pitch / 2);
    const command = { action_ref: 'ACTION6', data: { x: at[0] + offset, y: at[1] + offset } };
    if (!tested[trialKey(cells, observedCommandKey(command), actor, start)]) {
      return { command, target: at, purpose: 'select',
        evidence: cover ? [...new Set([...evidence, ...cover.evidence])] : evidence,
        ...(cover ? { jointContactCover: true } : {}) };
    }
  }
  if (active) {
    if (access.has(active.cell)) return {
      command: active.first, target: point(active.cell), purpose: 'verify_contact_access',
      evidence: [...new Set([...evidence, ...state.contactAccess!.evidence])],
    };
    if (contactOnly.has(active.cell) || hypotheses.includes(active.cell)) return {
      command: active.first, target: point(active.cell), purpose: 'test_contact_hypothesis',
      evidence: [...new Set([...evidence, (cover?.sites[active.cell] ?? state.possibleContacts![active.cell]!).reference,
        ...(cover?.evidence ?? [])])],
      ...(cover ? { jointContactCover: true } : {}),
    };
    if (cover) return { command: active.first, target: point(active.cell), purpose: 'contact', jointContactCover: true,
      evidence: [...new Set([...evidence, ...cover.evidence])] };
    const approach:WalkingStep[]=[];
    const bounds=(at:string):NativeBox=>{const [x,y]=point(at);return [x,y,x+grid.pitch-1,y+grid.pitch-1];};
    if(active.goal && !unmeasured.length){
      for(let step=active.path;step?.parent&&step.via;step=step.parent)
        approach.unshift({from:bounds(step.parent.at),to:bounds(step.at),command:step.via});
      const frontier=approach.findIndex(step=>canTestSwitch(key([step.from[0],step.from[1]])));
      if(frontier>=0)approach.splice(frontier);
    }
    return { approach, command: active.first, target: point(active.cell),
    purpose: active.first === switchCommand ? 'switch' : active.goal ? 'approach' : 'contact', evidence };
  }
}

export function travelOccupies(travel:ObservedTravel,rows:NativeRows,box:NativeBox){return read(rows,travel.grid).pieces.includes(key([box[0],box[1]]));}
