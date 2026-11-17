import type { NativeBox, NativeEntity, NativeExecution, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Part = Pick<NativeEntity, 'palette_value' | 'bbox' | 'area' | 'rectangular'>;
type Axis = 0 | 1;
type Button = { point: NativePoint; box: NativeBox };
type Body = { box: NativeBox; ink: number; cap: NativeBox | null; axis: Axis; sign: 1 | -1;
  buttons: [Button, Button] | null; marker: NativePoint | null; parent: number | null };
type Target = { at: NativePoint; marks: NativePoint[]; body: number; amount: number };
export type ExtensionWitness = { epoch: number; quantum: number; extend: string; retract: string; evidence: string[] };
export type ClearanceLayout = { field: NativeBox; bodies: Body[]; targets: Target[]; quantum: number; capInk: number; markerInk: number;
  panels?: NativeBox[]; coupledTargets?: true };
export type ClearanceMove = { body: number; delta: 1 | -1; receivers?: number[] };
export type ClearanceProjection = { boxes: NativeBox[]; caps: (NativeBox | null)[]; markers: (NativePoint | null)[] };

const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((value, i) => value === b[i]);
const center = ([l, t, r, b]: NativeBox): NativePoint => [(l + r) / 2, (t + b) / 2];
const extent = (box: NativeBox, axis: Axis) => box[axis + 2]! - box[axis]! + 1;
const contains = (a: NativeBox, b: NativeBox) => a[0] <= b[0] && a[1] <= b[1] && a[2] >= b[2] && a[3] >= b[3];
const intersects = (a: NativeBox, b: NativeBox) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
const dot = ([x, y]: NativePoint): NativeBox => [x, y, x, y];
const translated = (box: NativeBox, [x, y]: NativePoint): [number, number, number, number] =>
  [box[0] + x, box[1] + y, box[2] + x, box[3] + y];
const crossAxis = (axis: Axis): Axis => axis === 0 ? 1 : 0;
const tip = (axis: Axis, sign: 1 | -1) => sign === 1 ? axis + 2 : axis;
const surround = (box: NativeBox, cap: NativeBox | null): NativeBox => cap
  ? [Math.min(box[0], cap[0]), Math.min(box[1], cap[1]), Math.max(box[2], cap[2]), Math.max(box[3], cap[3])] : box;

export function extensionButtonMask(rows: NativeRows, [l, t, r, b]: NativeBox, hue: number): string {
  const bits: number[] = [];
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) bits.push(Number(rows[y]?.[x] === hue));
  return [r - l + 1, b - t + 1, ...bits].join(',');
}

function targetPatterns(parts: readonly Part[], rows?: NativeRows) {
  const dots = parts.filter(p => p.area === 1).map(p => ({ at: center(p.bbox), ink: p.palette_value }));
  const targets: { at: NativePoint; marks: NativePoint[]; ink: number; filled?: true }[] = [];
  const arms = ([x, y]: NativePoint): NativePoint[] => [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
  for (const { at: [x, y], ink } of dots) {
    const centerPoint: NativePoint = [x, y], marks = arms(centerPoint);
    for (const markerInk of new Set(dots.filter(d => d.ink !== ink).map(d => d.ink))) {
      if (!marks.every(arm => dots.some(d => d.ink === markerInk && same(d.at, arm)))) continue;
      targets.push({ at: centerPoint, marks, ink: markerInk });
    }
  }
  if (rows) for (const part of parts) {
    if (part.area !== 5 || extent(part.bbox, 0) !== 3 || extent(part.bbox, 1) !== 3) continue;
    const at = center(part.bbox), marks = arms(at), ink = part.palette_value;
    if ([at, ...marks].every(([x, y]) => rows[y]?.[x] === ink)) targets.push({ at, marks, ink, filled: true });
  }
  return { targets, dots };
}

function readTargets(parts: readonly Part[], bodies: readonly Body[], quantum: number, minimum: number, rows?: NativeRows) {
  const { targets, dots } = targetPatterns(parts, rows);
  if (targets.length < minimum || targets.length > 2 || targets.some(target => target.ink !== targets[0]!.ink)) return null;
  const markerInk = targets[0]!.ink, arms = targets.flatMap(target => target.marks);
  const pieces = [...dots.filter(({ at, ink }) => ink === markerInk && !arms.some(mark => same(mark, at))),
    ...targets.filter(target => target.filled)];
  const options = targets.map(target =>
    bodies.flatMap((body, index) => {
      if (!rows && (!body.buttons || body.parent !== null)) return [];
      const marker = pieces.find(d => contains(body.box, dot(d.at)));
      if (!marker) return [];
      const axes = new Set<Axis>();
      for (let at: number | null = index; at !== null; at = rows ? bodies[at]!.parent : null) {
        if (bodies[at]!.buttons) axes.add(bodies[at]!.axis);
      }
      if (!axes.size || target.at.some((value, axis) => (value - marker.at[axis]!) % quantum !== 0
        || value !== marker.at[axis] && !axes.has(axis as Axis))) return [];
      const amount = body.sign * (target.at[body.axis] - marker.at[body.axis]) / quantum;
      return rows || amount > 0 ? [{ body: index, marker: marker.at, amount, at: target.at, marks: target.marks }] : [];
    }));
  const assignments = options[0]!.flatMap(first => options[1]
    ? options[1].filter(second => second.body !== first.body).map(second => [first, second]) : [[first]]);
  if (assignments.length !== 1) return null;
  return { targets: assignments[0]!.map(({ marker, ...target }) => {
    bodies[target.body]!.marker = marker;
    return target;
  }), markerInk };
}

export function readClearanceLayout(rows: NativeRows, parts: readonly Part[], witness: ExtensionWitness): ClearanceLayout | null {
  return measureClearanceLayout(rows, parts, witness, false) ?? measureClearanceLayout(rows, parts, witness, true)
    ?? measureClearanceLayout(rows, parts, witness, true, true);
}

function measureClearanceLayout(rows: NativeRows, parts: readonly Part[], witness: ExtensionWitness, shared: boolean, coupled = false): ClearanceLayout | null {
  const { quantum } = witness;
  const marked = parts.flatMap(part => {
    if (part.area < 4 || extent(part.bbox, 0) > quantum + 2 || extent(part.bbox, 1) > quantum + 2) return [];
    const pattern = extensionButtonMask(rows, part.bbox, part.palette_value);
    return pattern === witness.extend || pattern === witness.retract
      ? [{ part, extend: pattern === witness.extend }] : [];
  });
  const buttonColors = [...new Set(marked.map(button => button.part.palette_value))];
  if (buttonColors.length < 4 || buttonColors.length > 8 || marked.length !== 2 * buttonColors.length) return null;
  const top = Math.min(...marked.map(button => button.part.bbox[1]));
  const panels = shared ? buttonColors.flatMap(ink => {
    const buttons = marked.filter(button => button.part.palette_value === ink).map(button => button.part.bbox);
    const outlines = parts.filter(part => !part.rectangular && extent(part.bbox, 0) >= quantum * 2
      && extent(part.bbox, 1) <= quantum * 3 && buttons.every(box => contains(part.bbox, box)));
    return outlines.length === 1 ? [outlines[0]!.bbox] : [];
  }) : [];
  if (shared && panels.length !== buttonColors.length) return null;
  const field: NativeBox = [0, 0, rows[0]!.length - 1, shared ? rows.length - 2 : top - quantum];
  const fieldParts = parts.filter(part => contains(field, part.bbox) && !panels.some(panel => contains(panel, part.bbox)));
  const filledTargets = coupled ? targetPatterns(fieldParts, rows).targets.filter(target => target.filled) : [];
  const overlays = new Set(filledTargets.flatMap(target => [target.at, ...target.marks]).map(point => point.join(',')));
  const caps = fieldParts.filter(part => part.rectangular && part.area === quantum
    && (extent(part.bbox, 0) === 1 || extent(part.bbox, 1) === 1));
  const bodies: Body[] = [];
  let capInk: number | null = null;
  for (const ink of buttonColors) {
    const pair = marked.filter(button => button.part.palette_value === ink);
    const extend = pair.find(button => button.extend), retract = pair.find(button => !button.extend);
    const pieces = fieldParts.filter(part => part.palette_value === ink && part.area > quantum);
    if (!extend || !retract || !pieces.length || (!shared && pieces.length !== 1)) return null;
    for (const { bbox: bounds } of pieces) {
      const box: [number, number, number, number] = [...bounds];
      const adjacent = caps.flatMap(({ bbox, palette_value }) =>
        ([0, 1] as const).flatMap<{ bbox: NativeBox; axis: Axis; sign: 1 | -1; palette_value: number }>(axis => {
          const cross = crossAxis(axis);
          if (extent(bbox, axis) !== 1 || bbox[cross] !== box[cross] || bbox[cross + 2] !== box[cross + 2]) return [];
          if (bbox[axis + 2]! === box[axis] - 1) return [{ bbox, axis, sign: 1 as const, palette_value }];
          if (bbox[axis] === box[axis + 2]! + 1) return [{ bbox, axis, sign: -1 as const, palette_value }];
          return [];
        }));
      if (adjacent.length !== 1 || capInk !== null && adjacent[0]!.palette_value !== capInk) return null;
      const { bbox: cap, axis, sign, palette_value } = adjacent[0]!;
      capInk = palette_value;
      // A filled cross can conceal the full terminal section and split off its rim.
      if (coupled) {
        const edge = tip(axis, sign), cross = crossAxis(axis);
        let confirmed = box[edge]!;
        for (let along = confirmed + sign; along >= field[axis]! && along <= field[axis + 2]!; along += sign) {
          let covered = true, visible = false;
          for (let across = box[cross]; across <= box[cross + 2]!; across++) {
            const [x, y] = axis === 0 ? [along, across] : [across, along];
            const material = rows[y]?.[x] === ink;
            covered &&= material || overlays.has([x, y].join(','));
            visible ||= material;
          }
          if (!covered) break;
          if (visible) confirmed = along;
        }
        box[edge] = confirmed;
      }
      bodies.push({ box, ink, cap, axis, sign, parent: null, marker: null,
        buttons: [extend, retract].map(({ part }) => ({ box: part.bbox, point: center(part.bbox) })) as [Button, Button] });
    }
  }
  if (shared && !coupled && bodies.length === buttonColors.length) return null;
  for (const part of fieldParts) {
    const { area, bbox, rectangular, palette_value } = part;
    if (!rectangular || area < quantum * quantum || buttonColors.includes(palette_value) || palette_value === capInk) continue;
    if (Math.min(extent(bbox, 0), extent(bbox, 1)) !== quantum) continue;
    bodies.push({ box: bbox, ink: palette_value, cap: null, axis: 0, sign: 1, buttons: null, marker: null, parent: null });
  }
  for (const [index, body] of bodies.entries()) {
    const ext = surround(body.box, body.cap);
    const parents = bodies.flatMap((candidate, i) => {
      if (i === index || !candidate.buttons) return [];
      const { axis, sign, box } = candidate, cross = crossAxis(axis);
      return ext[tip(axis, sign === 1 ? -1 : 1)] === box[tip(axis, sign)]! + sign
        && ext[cross] <= box[cross + 2]! && ext[cross + 2]! >= box[cross] ? [i] : [];
    });
    if (parents.length > 1) return null;
    body.parent = parents[0] ?? null;
  }
  for (const index of bodies.keys()) {
    const visited = new Set<number>();
    for (let at: number | null = index; at !== null; at = bodies[at]!.parent) {
      if (visited.has(at)) return null;
      visited.add(at);
    }
  }
  const goals = readTargets(fieldParts, bodies, quantum, shared ? 1 : 2, coupled ? rows : undefined);
  if (!goals || capInk === null || !coupled && goals.targets.some(target => {
    const members = receiversOf(bodies, target.body);
    return bodies.some(body => body.parent !== null && members.includes(body.parent));
  }) || (!shared && !bodies.some(body => !body.buttons && body.parent !== null))) return null;
  return { field, bodies, quantum, capInk, ...goals, ...(shared ? { panels } : {}), ...(coupled ? { coupledTargets: true } : {}) };
}

function receiversOf(bodies: readonly Body[], index: number): number[] {
  const button = bodies[index]!.buttons![0].point;
  return bodies.flatMap((body, i) => body.buttons && same(body.buttons[0].point, button) ? [i] : []);
}

export const clearanceMoved = (lengths: readonly number[], move: ClearanceMove) =>
  lengths.map((value, i) => (move.receivers ? move.receivers.includes(i) : i === move.body) ? value + move.delta : value);
export const clearanceEdge = (lengths: readonly number[], move: ClearanceMove) => [lengths.join(','), move.body, move.delta].join('/');

export function clearanceProject(layout: ClearanceLayout, lengths: readonly number[]): ClearanceProjection {
  const boxes: NativeBox[] = [], caps: (NativeBox | null)[] = [], markers: (NativePoint | null)[] = [];
  for (const [index, { box, cap, marker, parent, axis, sign }] of layout.bodies.entries()) {
    const shift: [number, number] = [0, 0];
    for (let at = parent; at !== null; at = layout.bodies[at]!.parent) {
      const body = layout.bodies[at]!;
      shift[body.axis] += lengths[at]! * layout.quantum * body.sign;
    }
    const displacement = lengths[index]! * layout.quantum * sign;
    const extended = translated(box, shift);
    extended[tip(axis, sign)]! += displacement;
    boxes.push(extended);
    caps.push(cap ? translated(cap, shift) : null);
    markers.push(marker ? [marker[0] + shift[0] + (axis === 0 ? displacement : 0),
      marker[1] + shift[1] + (axis === 1 ? displacement : 0)] : null);
  }
  return { boxes, caps, markers };
}

function allowed(layout: ClearanceLayout, positions: ClearanceProjection): boolean {
  const footprints = positions.boxes.map((box, i) => surround(box, positions.caps[i]!));
  return positions.boxes.every((box, i) => extent(box, layout.bodies[i]!.axis) >= 1 && contains(layout.field, footprints[i]!))
    && footprints.every((a, i) => footprints.slice(0, i).every(b => !intersects(a, b)));
}

export function clearanceObserved(rows: NativeRows, layout: ClearanceLayout, projection: ClearanceProjection): boolean {
  const { boxes, caps, markers } = projection;
  const markerPoints = [...layout.targets.flatMap(target => target.marks), ...markers.filter((p): p is NativePoint => p !== null)];
  const map = new Map<string, number>();
  const key = (x: number, y: number) => y + ',' + x;
  const paint = ([l, t, r, b]: NativeBox, color: number) => {
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) map.set(key(x, y), color);
  };
  boxes.forEach((box, i) => paint(box, layout.bodies[i]!.ink));
  caps.forEach(cap => { if (cap) paint(cap, layout.capInk); });
  const ignored = new Set(markerPoints.map(([x, y]) => key(x, y)));
  const panelPixels = new Set<string>();
  for (const [l, t, r, b] of layout.panels ?? []) for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) panelPixels.add(key(x, y));
  const tracked = new Set(layout.bodies.map(body => body.ink));
  for (let y = layout.field[1]; y <= layout.field[3]; y++) for (let x = layout.field[0]; x <= layout.field[2]; x++) {
    const position = key(x, y), actual = rows[y]?.[x], expected = map.get(position);
    if (!panelPixels.has(position) && (expected === undefined ? tracked.has(actual ?? -1) : actual !== expected && !ignored.has(position))) return false;
  }
  return markers.every(point => point === null || rows[point[1]]?.[point[0]] === layout.markerInk);
}

type RouteNode = { lengths: readonly number[]; depth: number; parent: number; move?: ClearanceMove };

function routeTo(node: RouteNode, queue: readonly RouteNode[]): ClearanceMove[] {
  const route: ClearanceMove[] = [];
  for (let at = node; at.move; at = queue[at.parent]!) route.push(at.move);
  return route.reverse();
}

export async function chooseClearanceRoute(layout: ClearanceLayout, lengths: readonly number[], rejected: readonly string[], remaining: number,
  execution?: NativeExecution): Promise<ClearanceMove[]> {
  const blocked = new Set(rejected);
  const moveFor = (body: number, delta: 1 | -1): ClearanceMove => {
    const receivers = receiversOf(layout.bodies, body);
    return receivers.length > 1 ? { body, delta, receivers } : { body, delta };
  };
  const goalBodies = new Set<number>();
  const suffix: ClearanceMove[] = [];
  for (const target of layout.coupledTargets ? [] : layout.targets) {
    if (goalBodies.has(target.body)) continue;
    const move = moveFor(target.body, 1), receivers = move.receivers ?? [target.body];
    for (const receiver of receivers) goalBodies.add(receiver);
    for (let count = lengths[target.body]!; count < target.amount; count++) suffix.push(move);
  }
  const verifiedTerminal = suffix.reduce(clearanceMoved, lengths);
  if (!layout.coupledTargets && !layout.targets.every(({ body, amount }) => verifiedTerminal[body] === amount)) return [];
  if (suffix.length > remaining) return [];
  const moves = layout.bodies.flatMap((body, i) => body.buttons && !goalBodies.has(i)
    && receiversOf(layout.bodies, i)[0] === i ? ([1, -1] as const).map(delta => moveFor(i, delta)) : []);
  const queue: RouteNode[] = [{ lengths, depth: 0, parent: -1 }];
  const visited = new Set([lengths.join(',')]);
  for (let i = 0; i < queue.length && i < 40_000; i++) {
    if (execution?.signal?.aborted || execution?.deadlineMs !== undefined && (execution.now ?? (() => performance.now()))() >= execution.deadlineMs) return [];
    if (execution && i % 128 === 127) await execution.yieldControl();
    const node = queue[i]!;
    if (node.depth + suffix.length > remaining) break;
    const terminal = layout.coupledTargets ? node.lengths
      : node.lengths.map((length, index) => goalBodies.has(index) ? verifiedTerminal[index]! : length);
    const projection = clearanceProject(layout, terminal);
    // The targets have fixed roots and no descendants. Growing them only makes
    // each footprint larger, so clear terminal footprints certify the suffix.
    const fits = layout.coupledTargets ? layout.targets.every(target => same(projection.markers[target.body]!, target.at))
      : allowed(layout, projection);
    if (fits) {
      const full = [...routeTo(node, queue), ...suffix];
      if (full.length && !blocked.has(clearanceEdge(lengths, full[0]!))) return full;
    }
    if (node.depth + suffix.length === remaining) continue;
    for (const move of moves) {
      if (blocked.has(clearanceEdge(node.lengths, move))) continue;
      const next = clearanceMoved(node.lengths, move), key = next.join(',');
      if (visited.has(key)) continue;
      visited.add(key);
      if (allowed(layout, clearanceProject(layout, next))) queue.push({ lengths: next, depth: node.depth + 1, parent: i, move });
    }
  }
  return [];
}
