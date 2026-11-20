import type { NativeBox, NativeEntity, NativeExecution, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { extensionButtonMask, readClearanceLayout, targetPatterns, type ExtensionWitness } from './extension-clearance.ts';

type Part = Pick<NativeEntity, 'palette_value' | 'bbox' | 'area' | 'rectangular'>;
type Button = { box: NativeBox; at: NativePoint };
type Segment = { ink: number; pivot: NativePoint; direction: NativePoint; length: number;
  buttons: Partial<Record<ExtensionOperation, Button>>; parent?: number | null; mayClip?: boolean; fixedBox?: NativeBox };
type Alignment = { body: number; marker: NativePoint; target: NativePoint };
export type TurningLayout = {
  segments: Segment[]; quantum: number; width: number; field: NativeBox; obstacles: string[];
  floor: number; capInk: number; markerInk: number; marker: NativePoint; target: NativePoint; marks: NativePoint[];
  alignments?: Alignment[]; panels?: NativeBox[];
};
export type ExtensionOperation = 'extend' | 'retract' | 'turn';
export type TurnSign = 1 | -1;
export type TurningPose = { added: number; turns: number }[];
export type TurningMove = { body: number; operation: ExtensionOperation; quarterTurns?: number; receivers?: number[] };
type Position = { box: NativeBox; cap: NativeBox | null; pivot: NativePoint; turns: number };
type Projection = { parts: Position[]; marker: NativePoint; markers: NativePoint[] };
type MaskedPart = { part: Part; mask: string };
type Controls = { ink: number; buttons: Segment['buttons'] };
const obstacleInkBase = 256;

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const center = ([l, t, r, b]: NativeBox): NativePoint => [(l + r) / 2, (t + b) / 2];
const contains = (a: NativeBox, b: NativeBox) => a[0] <= b[0] && a[1] <= b[1] && a[2] >= b[2] && a[3] >= b[3];
const overlap = (a: NativeBox, b: NativeBox) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const dot = ([x, y]: NativePoint): NativeBox => [x, y, x, y];
const equal = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const add = ([x, y]: NativePoint, [u, v]: NativePoint, s = 1): NativePoint => [x + s * u, y + s * v];
const quarterTurn = ([x, y]: NativePoint, turns: number): NativePoint => {
  switch (turns & 3) {
    case 1: return [y, -x];
    case 2: return [-x, -y];
    case 3: return [-y, x];
    default: return [x, y];
  }
};
const bound = (a: NativePoint, b: NativePoint): NativeBox =>
  [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
const joined = (a: NativeBox, b: NativeBox | null): NativeBox => b
  ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] : a;
const distance = (a: NativePoint, b: NativePoint) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const buttonAt = (part: Part): Button => ({ box: part.bbox, at: center(part.bbox) });
const parentOf = (segment: Segment, index: number) => segment.parent === undefined ? index - 1 : segment.parent ?? -1;
const alignmentsOf = (layout: TurningLayout): readonly Alignment[] =>
  layout.alignments ?? [{ body: layout.segments.length - 1, marker: layout.marker, target: layout.target }];
const poseKey = (pose: TurningPose) => pose.map(({ added, turns }) => added + ':' + turns).join(',');
export const turningEdge = (pose: TurningPose, { body, operation }: TurningMove) => poseKey(pose) + '/' + body + '/' + operation;

function readExclusiveTurningLayout(rows: NativeRows, parts: readonly Part[], witness: ExtensionWitness): TurningLayout | null {
  const { quantum } = witness, pixels = rows[0]!.length;
  if (quantum < 3 || quantum > 7 || !(quantum % 2) || pixels > 96 || rows.length > 96) return null;
  const buttons = parts.filter(part => part.area >= 4 && width(part.bbox) === quantum && height(part.bbox) === quantum)
    .map(part => ({ part, mask: extensionButtonMask(rows, part.bbox, part.palette_value) }));
  const lengths = buttons.filter(button => button.mask === witness.extend || button.mask === witness.retract);
  const inks = [...new Set(lengths.map(button => button.part.palette_value))];
  if (inks.length < 2 || inks.length > 5 || lengths.length !== inks.length * 2) return null;
  const outlined = inks.flatMap(ink => {
    const extend = lengths.find(button => button.part.palette_value === ink && button.mask === witness.extend)?.part;
    const retract = lengths.find(button => button.part.palette_value === ink && button.mask === witness.retract)?.part;
    if (!extend || !retract || extend.bbox[1] !== retract.bbox[1]) return [];
    const [x1, y] = center(extend.bbox), [x2] = center(retract.bbox);
    const turn = buttons.filter(({ part, mask }) => part.palette_value === ink && mask !== witness.extend && mask !== witness.retract
      && center(part.bbox)[0] === (x1 + x2) / 2 && center(part.bbox)[1] < y);
    if (turn.length !== 1) return [];
    const framed = parts.filter(part => !part.rectangular && contains(part.bbox, turn[0]!.part.bbox)
      && part.bbox[3] < extend.bbox[1] && width(part.bbox) >= quantum + 2 && width(part.bbox) <= quantum * 3
      && height(part.bbox) >= quantum + 2 && height(part.bbox) <= quantum * 3);
    const outline = framed.filter(part => !framed.some(other => other !== part && contains(other.bbox, part.bbox)));
    if (outline.length !== 1) return [];
    return [{ ink, y: outline[0]!.bbox[1], mask: turn[0]!.mask,
      buttons: { extend: buttonAt(extend), retract: buttonAt(retract), turn: buttonAt(turn[0]!.part) } }];
  });
  const singleChain = outlined.length === inks.length && outlined.every(control =>
    control.y === outlined[0]!.y && control.mask === outlined[0]!.mask);
  const panelTop = singleChain ? outlined[0]!.y : Math.min(...lengths.map(({ part }) => part.bbox[1]));
  const controls = singleChain ? outlined : compactControls(buttons, lengths, inks, witness);
  if (!controls) return null;
  const controlInks = controls.map(({ ink }) => ink);
  const field: NativeBox = [0, 0, pixels - 1, panelTop - 1];
  const fieldParts = parts.filter(part => contains(field, part.bbox));
  const caps = fieldParts.filter(part => part.rectangular && part.area === quantum
    && (width(part.bbox) === 1 || height(part.bbox) === 1) && !controlInks.includes(part.palette_value));
  const { targets, dots } = targetPatterns(fieldParts, singleChain ? undefined : rows);
  if (singleChain ? targets.length !== 1 : targets.length !== 2) return null;
  const markerInk = targets[0]!.ink;
  if (targets.some(target => target.ink !== markerInk)) return null;
  const marks = targets.flatMap(target => target.marks);
  const bodies = controls.flatMap(control => {
    const matching = fieldParts.filter(part => part.palette_value === control.ink && part.area >= quantum);
    if (matching.length !== 1) return [];
    let { bbox: box } = matching[0]!;
    if (!singleChain) for (const target of targets) {
      if (!target.filled) continue;
      const [x, y] = target.at;
      const rims: NativeBox[] = [[x - 1, y - 1, x - 1, y + 1], [x + 1, y - 1, x + 1, y + 1],
        [x - 1, y - 1, x + 1, y - 1], [x - 1, y + 1, x + 1, y + 1]];
      if (rims.some(rim => overlap(box, rim))) box = joined(box, [x - 1, y - 1, x + 1, y + 1]);
    }
    const possible = caps.flatMap<{ cap: Part; direction: NativePoint }>(cap => {
      const [l, t] = cap.bbox;
      if (width(cap.bbox) === 1 && height(box) === quantum && box[1] === t) {
        if (l + 1 === box[0]) return [{ cap, direction: [1, 0] as const }];
        if (l - 1 === box[2]) return [{ cap, direction: [-1, 0] as const }];
      }
      if (height(cap.bbox) === 1 && width(box) === quantum && box[0] === l) {
        if (t + 1 === box[1]) return [{ cap, direction: [0, 1] as const }];
        if (t - 1 === box[3]) return [{ cap, direction: [0, -1] as const }];
      }
      return [];
    });
    if (possible.length !== 1) return [];
    const { cap, direction } = possible[0]!;
    const pivot = add(center(cap.bbox), direction), length = direction[0] ? width(box) : height(box);
    return [{ ink: control.ink, buttons: control.buttons, box, cap, direction, pivot, length }];
  });
  if (bodies.length !== controls.length || bodies.some(body => body.cap.palette_value !== bodies[0]!.cap.palette_value)) return null;
  const parents = bodies.map(({ box, cap }, index) => bodies.flatMap((parent, i) => {
    const [dx, dy] = parent.direction, [l, t, r, b] = parent.box, own = joined(box, cap.bbox);
    const touches: NativeBox = dx ? [dx > 0 ? r + 1 : l - 1, t, dx > 0 ? r + 1 : l - 1, b]
      : [l, dy > 0 ? b + 1 : t - 1, r, dy > 0 ? b + 1 : t - 1];
    return i !== index && overlap(own, touches) ? [i] : [];
  }));
  if (parents.some(parent => parent.length > 1)) return null;
  const order = bodies.map((_, i) => i).filter(i => parents[i]!.length === 0);
  if (!order.length || (singleChain && order.length !== 1)) return null;
  for (let i = 0; i < order.length; i++) {
    const children = bodies.map((_, j) => j).filter(j => parents[j]![0] === order[i]);
    if (singleChain && children.length > 1) return null;
    order.push(...children);
  }
  if (order.length !== bodies.length) return null;
  const markers = dots.filter(part => part.ink === markerInk && !marks.some(mark => equal(mark, part.at)));
  const open = targets.filter(target => !('filled' in target));
  if (open.length !== 1 || markers.length !== 1) return null;
  const alignments = [...open, ...targets.filter(target => 'filled' in target)].flatMap(target => {
    const marker = 'filled' in target ? target.at : markers[0]!.at;
    const owners = order.flatMap((index, body) => contains(bodies[index]!.box, dot(marker)) ? [body] : []);
    return owners.length === 1 ? [{ body: owners[0]!, target: target.at, marker }] : [];
  });
  if (alignments.length !== targets.length || singleChain && alignments[0]!.body !== order.length - 1) return null;
  const { target, marker } = alignments[0]!;
  const counts = new Map<number, number>();
  for (const row of rows.slice(0, field[3] + 1)) for (const ink of row) counts.set(ink, (counts.get(ink) ?? 0) + 1);
  const floor = [...counts].find(([, count]) => count * 2 > pixels * (field[3] + 1))?.[0];
  if (floor === undefined || floor === markerInk || floor === bodies[0]!.cap.palette_value || controlInks.includes(floor)) return null;
  const obstacles = rows.slice(0, field[3] + 1).map((row, y) => row.map((ink, x) => ink === floor
    || marks.some(mark => equal(mark, [x, y])) || bodies.some(body => contains(joined(body.box, body.cap.bbox), dot([x, y])))
    ? '.' : '#').join(''));
  const layout: TurningLayout = { segments: order.map(i => {
    const { ink, pivot, direction, length, buttons } = bodies[i]!;
    const parent = parents[i]![0];
    const mayClip = parent === undefined && !buttons.extend && !buttons.retract && !parents.some(p => p[0] === i)
      && !alignments.some(a => order[a.body] === i);
    return { ink, pivot, direction, length, buttons, ...(singleChain ? {} : {
      parent: parent === undefined ? null : order.indexOf(parent), ...(mayClip ? { mayClip } : {}),
    }) };
  }), quantum, width: pixels, field, obstacles, floor, capInk: bodies[0]!.cap.palette_value, markerInk, marker, target, marks,
  ...(singleChain ? {} : { alignments }) };
  return turningObserved(rows, layout, initialTurningPose(layout)) ? layout : null;
}

function readSharedTurningLayout(rows: NativeRows, parts: readonly Part[], witness: ExtensionWitness): TurningLayout | null {
  const measured = readClearanceLayout(rows, parts, witness);
  if (!measured?.panels || measured.targets.length !== 1) return null;
  const { bodies, panels, targets, quantum, field, capInk, markerInk } = measured;
  const roots = bodies.flatMap((root, index) => {
    if (root.cap || root.parent !== null || width(root.box) !== quantum || height(root.box) !== quantum) return [];
    const attached = bodies.flatMap((body, i) => {
      if (!body.cap || body.parent !== null) return [];
      const { axis, sign, cap } = body, across = 1 - axis;
      const edge = sign > 0 ? root.box[axis + 2]! + 1 : root.box[axis]! - 1;
      return cap[axis] === edge && cap[across] === root.box[across] && cap[across + 2] === root.box[across + 2] ? [i] : [];
    });
    if (attached.length < 2 || new Set(attached.map(i => bodies[i]!.axis)).size < 2
      || !attached.some(i => bodies.some((other, j) => j !== i && !attached.includes(j) && other.ink === bodies[i]!.ink && other.buttons))) return [];
    const buttons = parts.filter(part => part.palette_value === root.ink && part.area >= 4 && !part.rectangular
      && width(part.bbox) === quantum && height(part.bbox) === quantum && !panels.some(panel => contains(panel, part.bbox)));
    return buttons.flatMap(button => {
      const outlines = parts.filter(part => !part.rectangular && contains(part.bbox, button.bbox)
        && equal(center(part.bbox), center(button.bbox)) && width(part.bbox) >= quantum + 2 && width(part.bbox) <= quantum * 3
        && height(part.bbox) >= quantum + 2 && height(part.bbox) <= quantum * 3
        && !panels.some(panel => overlap(panel, part.bbox)));
      const outer = outlines.find(part => outlines.every(other => contains(part.bbox, other.bbox)));
      return outer ? [{ index, attached, button: buttonAt(button), panel: outer.bbox }] : [];
    });
  });
  if (roots.length !== 1) return null;
  const root = roots[0]!, parents = bodies.map((body, i) => root.attached.includes(i) ? root.index : body.parent);
  const order = parents.flatMap((parent, i) => parent === null ? [i] : []);
  for (let i = 0; i < order.length; i++) order.push(...parents.flatMap((parent, j) => parent === order[i] ? [j] : []));
  if (order.length !== bodies.length) return null;
  const bodyIndex = targets[0]!.body, marker = bodies[bodyIndex]!.marker;
  if (!marker) return null;
  const { at: target, marks } = targets[0]!;
  const pixels = rows[0]!.length, counts = new Map<number, number>();
  for (const row of rows.slice(0, field[3] + 1)) for (const ink of row) counts.set(ink, (counts.get(ink) ?? 0) + 1);
  const floor = [...counts].find(([, count]) => count * 2 > pixels * (field[3] + 1))?.[0];
  if (floor === undefined || floor === capInk || floor === markerInk || bodies.some(body => body.ink === floor)) return null;
  const obstacles = rows.slice(0, field[3] + 1).map((row, y) => row.map((ink, x) =>
    ink === floor || marks.some(mark => equal(mark, [x, y]))
      || bodies.some(body => contains(joined(body.box, body.cap), [x, y, x, y]))
      ? '.' : String.fromCharCode(obstacleInkBase + ink)).join(''));
  const segments: Segment[] = order.map((index) => {
    const body = bodies[index]!, { axis, sign, cap, box, ink } = body, parent = parents[index]!;
    const direction: NativePoint = axis === 0 ? [sign, 0] : [0, sign];
    const buttons = body.buttons ? {
      extend: { box: body.buttons[0].box, at: body.buttons[0].point },
      retract: { box: body.buttons[1].box, at: body.buttons[1].point },
    } : index === root.index ? { turn: root.button } : {};
    return { ink, pivot: cap ? add(center(cap), direction) : center(box), direction, length: axis === 0 ? width(box) : height(box), buttons,
      parent: parent === null ? null : order.indexOf(parent), ...(cap ? {} : { fixedBox: box }),
      ...(root.attached.includes(index) ? { mayClip: true } : {}) };
  });
  const layout: TurningLayout = { segments, quantum, width: pixels, field, obstacles, floor, capInk, markerInk, marker, target, marks,
    panels: [...panels, root.panel], alignments: [{ body: order.indexOf(bodyIndex), marker, target }] };
  return turningObserved(rows, layout, initialTurningPose(layout)) ? layout : null;
}

export function readTurningLayout(rows: NativeRows, parts: readonly Part[], witness: ExtensionWitness): TurningLayout | null {
  return readExclusiveTurningLayout(rows, parts, witness) ?? readSharedTurningLayout(rows, parts, witness);
}

function compactControls(buttons: readonly MaskedPart[], lengths: readonly MaskedPart[], inks: readonly number[],
  witness: ExtensionWitness): Controls[] | null {
  const paired = inks.flatMap(ink => {
    const extend = lengths.find(button => button.part.palette_value === ink && button.mask === witness.extend)?.part;
    const retract = lengths.find(button => button.part.palette_value === ink && button.mask === witness.retract)?.part;
    return extend && retract && extend.bbox[1] === retract.bbox[1]
      ? [{ ink, buttons: { extend: buttonAt(extend), retract: buttonAt(retract) } }] : [];
  });
  if (paired.length !== inks.length) return null;
  const rows = new Set(paired.map(control => control.buttons.extend.at[1]));
  const turns = buttons.filter(button => !lengths.includes(button) && rows.has(center(button.part.bbox)[1]));
  const nearby = paired.map(({ ink, buttons }) => turns.filter(({ part }) => {
    const [x, y] = center(part.bbox), [a, row] = buttons.extend.at, [b] = buttons.retract.at;
    return part.palette_value === ink && y === row && (x < Math.min(a, b) || x > Math.max(a, b))
      && Math.min(Math.abs(x - a), Math.abs(x - b)) <= witness.quantum * 3;
  }));
  const masks = new Set(nearby.flat().map(turn => turn.mask));
  if (masks.size !== 1 || nearby.filter(list => list.length === 1).length < 2 || nearby.some(list => list.length > 1)) return null;
  const [mask] = masks;
  const independent = turns.filter(turn => turn.mask === mask && !inks.includes(turn.part.palette_value));
  if (new Set(independent.map(turn => turn.part.palette_value)).size !== independent.length) return null;
  return [...paired.map((control, index) => {
    const turn = nearby[index]![0];
    return turn ? { ...control, buttons: { ...control.buttons, turn: buttonAt(turn.part) } } : control;
  }), ...independent.map(({ part }) => ({ ink: part.palette_value, buttons: { turn: buttonAt(part) } }))];
}

export function initialTurningPose(layout: TurningLayout): TurningPose {
  return layout.segments.map(() => ({ added: 0, turns: 0 }));
}

export function moveTurningPose(pose: TurningPose, move: TurningMove, direction: TurnSign): TurningPose {
  return pose.map((old, i) => !(move.receivers?.includes(i) ?? (i === move.body)) ? old : move.operation === 'turn'
    ? { ...old, turns: (old.turns + direction * (move.quarterTurns ?? 1)) & 3 }
    : { ...old, added: old.added + (move.operation === 'extend' ? 1 : -1) });
}

function projectSegment(layout: TurningLayout, parts: readonly Position[], pose: TurningPose, i: number): Position {
  const segment = layout.segments[i]!, { pivot: base, direction, length } = segment, index = parentOf(segment, i);
  const previous = layout.segments[index], parent = parts[index], local = pose[i]!, half = (layout.quantum - 1) / 2;
  const turns = (local.turns + (parent?.turns ?? 0)) & 3, along = quarterTurn(direction, turns);
  const pivot = previous && parent ? add(parent.pivot, quarterTurn(add(add(base, previous.pivot, -1),
    previous.direction, pose[index]!.added * layout.quantum), parent.turns)) : base;
  if (segment.fixedBox) {
    const [l, t, r, b] = segment.fixedBox;
    return { box: bound(add(pivot, quarterTurn(add([l, t], base, -1), turns)),
      add(pivot, quarterTurn(add([r, b], base, -1), turns))), cap: null, pivot, turns };
  }
  const normal: NativePoint = [along[1] * half, along[0] * half], delta = local.added * layout.quantum;
  const far = add(pivot, along, length + delta - 1), back = add(pivot, along, -1);
  return { box: bound(add(pivot, normal, -1), add(far, normal)), cap: bound(add(back, normal, -1), add(back, normal)), pivot, turns };
}

function projectMarker(layout: TurningLayout, pose: TurningPose, { body, marker }: Alignment, { pivot, turns }: Position): NativePoint {
  const { pivot: base, direction } = layout.segments[body]!;
  return add(add(pivot, quarterTurn(add(marker, base, -1), turns)), quarterTurn(direction, turns),
    pose[body]!.added * layout.quantum);
}

export function projectTurningPose(layout: TurningLayout, pose: TurningPose): Projection {
  const parts: Position[] = [];
  for (let i = 0; i < layout.segments.length; i++) parts.push(projectSegment(layout, parts, pose, i));
  const markers = alignmentsOf(layout).map(alignment => projectMarker(layout, pose, alignment, parts[alignment.body]!));
  return { parts, marker: markers[0]!, markers };
}

function visibleBox(layout: TurningLayout, box: NativeBox, index: number): NativeBox | null {
  if (contains(layout.field, box)) return box;
  const [l, t, r, b] = box, [a, c, d, e] = layout.field;
  if (!layout.segments[index]!.mayClip || !overlap(layout.field, box)) return null;
  return [Math.max(l, a), Math.max(t, c), Math.min(r, d), Math.min(b, e)];
}

export function turningObserved(rows: NativeRows, layout: TurningLayout, pose: TurningPose): boolean {
  const { parts, markers } = projectTurningPose(layout, pose);
  if (alignmentsOf(layout).some(({ body }, i) => !contains(parts[body]!.box, dot(markers[i]!)))) return false;
  const map = new Int8Array(layout.width * (layout.field[3] + 1)).fill(-1);
  const index = (x: number, y: number) => y * layout.width + x;
  const panelMask = layout.panels ? new Uint8Array(map.length) : null;
  if (panelMask) for (const [l, t, r, b] of layout.panels!) {
    for (let y = t; y <= b; y++) panelMask.fill(1, index(l, y), index(r, y) + 1);
  }
  const paint = ([l, t, r, b]: NativeBox, ink: number) => {
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) map[index(x, y)] = ink;
  };
  for (const [i, { box, cap }] of parts.entries()) {
    const body = visibleBox(layout, box, i), hinge = cap && visibleBox(layout, cap, i);
    if (!body || cap && !hinge) return false;
    paint(body, layout.segments[i]!.ink);
    if (hinge) paint(hinge, layout.capInk);
  }
  const markerIndices = new Set(markers.map(point => index(...point))), marks = new Set(layout.marks.map(point => index(...point)));
  for (let y = 0; y <= layout.field[3]; y++) for (let x = 0; x < layout.width; x++) {
    const at = index(x, y), ink = rows[y]?.[x], color = map[at]!;
    if (ink === undefined) return false;
    if (panelMask?.[at]) continue;
    if (markerIndices.has(at)) {
      if (ink !== layout.markerInk) return false;
    } else if (color >= 0) {
      if (ink !== color && !(marks.has(at) && ink === layout.markerInk)) return false;
    } else {
      const obstacle = layout.obstacles[y]?.[x] ?? '.';
      if (marks.has(at) ? ink !== layout.markerInk : obstacle === '#'
        ? ink === layout.floor || ink === layout.capInk || layout.segments.some(part => part.ink === ink)
        : obstacle === '.' ? ink !== layout.floor : ink !== obstacle.charCodeAt(0) - obstacleInkBase) return false;
    }
  }
  return true;
}

type SearchNode = { pose: TurningPose; previous: SearchNode | null; move: TurningMove | null; depth: number };
type ClearBox = (box: NativeBox) => boolean;

function goalPoses(layout: TurningLayout, start: TurningPose, clear: ClearBox): TurningPose[] {
  const targets = new Map(alignmentsOf(layout).map(goal => [goal.body, goal]));
  const viewLength = Math.max(layout.width, layout.field[3] + 1);
  const poses: TurningPose[] = [], pose: TurningPose = [], parts: Position[] = [], boxes: NativeBox[] = [];
  let examined = 0;
  const visit = (i: number) => {
    if (i >= layout.segments.length) {
      poses.push(pose.slice());
      return;
    }
    if (++examined >= 150_000) return;
    const segment = layout.segments[i]!, initial = start[i]!, target = targets.get(i);
    const minimum = segment.buttons.retract ? Math.ceil((1 - segment.length) / layout.quantum) : initial.added;
    const maximum = segment.buttons.extend ? Math.floor((viewLength - segment.length) / layout.quantum) : initial.added;
    const rotations = segment.buttons.turn ? [0, 1, 2, 3] : [initial.turns];
    for (const turns of rotations) {
      let low = minimum, high = maximum;
      if (target) {
        pose[i] = { added: 0, turns };
        const position = projectSegment(layout, parts, pose, i), origin = projectMarker(layout, pose, target, position);
        const along = quarterTurn(segment.direction, position.turns);
        const [dx, dy] = add(target.target, origin, -1), offset = (dx * along[0] + dy * along[1]) / layout.quantum;
        if (!Number.isInteger(offset) || !equal(add(origin, along, offset * layout.quantum), target.target)) continue;
        low = Math.max(low, offset);
        high = Math.min(high, offset);
      }
      for (let added = low; added <= high; added++) {
        pose[i] = { added, turns };
        const position = projectSegment(layout, parts, pose, i);
        const box = visibleBox(layout, joined(position.box, position.cap), i);
        if (!box || !clear(box) || boxes.slice(0, i).some(other => overlap(box, other))
          || target && !contains(position.box, dot(target.target))) continue;
        parts[i] = position;
        boxes[i] = box;
        visit(i + 1);
      }
    }
  };
  visit(0);
  return poses;
}

async function routeBetweenPoses(layout: TurningLayout, start: TurningPose, direction: TurnSign, moves: TurningMove[],
  clear: ClearBox, remaining: number, blocked: ReadonlySet<string>, execution?: NativeExecution): Promise<TurningMove[]> {
  let forward: SearchNode[] = [{ pose: start, previous: null, move: null, depth: 0 }];
  let backward: SearchNode[] = goalPoses(layout, start, clear).map(pose => ({ pose, previous: null, move: null, depth: 0 }));
  const fromStart = new Map([[poseKey(start), forward[0]!]]), fromGoals = new Map(backward.map(node => [poseKey(node.pose), node]));
  let expanded = 0, lastYield = execution?.now?.() ?? performance.now();
  const invert = (move: TurningMove): TurningMove => move.operation === 'turn' ? move
    : { body: move.body, operation: move.operation === 'extend' ? 'retract' : 'extend' };
  const route = (prefix: SearchNode, suffix: SearchNode) => {
    const first: TurningMove[] = [], second: TurningMove[] = [];
    for (let node: SearchNode | null = prefix; node?.move; node = node.previous) first.push(node.move);
    for (let node: SearchNode | null = suffix; node?.move; node = node.previous) second.push(node.move);
    return [...first.reverse(), ...second];
  };
  const goalAlignments = alignmentsOf(layout);
  const fitByPose = new Map<string, boolean>();
  const fits = ({ parts, markers }: Projection) => {
    const boxes: NativeBox[] = [];
    if (goalAlignments.some(({ body }, i) => !contains(parts[body]!.box, dot(markers[i]!)))) return false;
    for (const [i, part] of parts.entries()) {
      const box = visibleBox(layout, joined(part.box, part.cap), i);
      if (!box || !clear(box) || boxes.some(other => overlap(box, other))) return false;
      boxes.push(box);
    }
    return true;
  };
  const canOccupy = (pose: TurningPose, key: string) => {
    const cached = fitByPose.get(key);
    if (cached !== undefined) return cached;
    const fit = fits(projectTurningPose(layout, pose));
    if (fitByPose.size < 150_000) fitByPose.set(key, fit);
    return fit;
  };
  const foldedIntoParent = (pose: TurningPose, body: number, parent: number) => {
    const [x, y] = layout.segments[parent]!.direction;
    return equal(quarterTurn(layout.segments[body]!.direction, pose[body]!.turns), [-x, -y]);
  };
  const oppositeSign = direction === 1 ? -1 : 1;
  while (forward.length && backward.length && expanded < 150_000) {
    const reverse = backward.length < forward.length;
    const wave = reverse ? backward : forward, known = reverse ? fromGoals : fromStart, opposite = reverse ? fromStart : fromGoals;
    const following: SearchNode[] = [];
    for (const node of wave) {
      if (++expanded > 150_000) return [];
      const now = execution?.now?.() ?? performance.now();
      if (execution?.signal?.aborted || execution?.deadlineMs !== undefined && now >= execution.deadlineMs) return [];
      if (execution && now - lastYield >= 10) {
        await execution.yieldControl();
        lastYield = execution.now?.() ?? performance.now();
      }
      if (node.depth >= remaining) continue;
      for (const operation of moves) {
        const turning = operation.operation === 'turn';
        if (!reverse && blocked.has(turningEdge(node.pose, operation))) continue;
        const parent = turning ? parentOf(layout.segments[operation.body]!, operation.body) : -1;
        const span = parent >= 0 ? 2 : 1;
        for (let quarterTurns = 1; quarterTurns <= span; quarterTurns++) {
          const move = quarterTurns === 1 ? operation : { ...operation, quarterTurns };
          const input = reverse ? invert(move) : move;
          const pose = moveTurningPose(node.pose, input, reverse && turning ? oppositeSign : direction);
          if (layout.segments[move.body]!.length + pose[move.body]!.added * layout.quantum < 1) continue;
          if (reverse && blocked.has(turningEdge(pose, move))) continue;
          // A linked joint can skip over the orientation that would fold its
          // bar into its parent. Walls and independent obstacles still stop it.
          if (!reverse && parent >= 0 && foldedIntoParent(pose, move.body, parent)) continue;
          const key = poseKey(pose);
          if (known.has(key)) {
            if (reverse) continue;
            break;
          }
          if (!canOccupy(pose, key)) {
            if (reverse) continue;
            break;
          }
          if (reverse && quarterTurns > 1 && !foldedIntoParent(moveTurningPose(pose, operation, direction), move.body, parent)) continue;
          const next = { pose, previous: node, move, depth: node.depth + 1 }, joinedAt = opposite.get(key);
          if (joinedAt && next.depth + joinedAt.depth <= remaining) {
            return reverse ? route(joinedAt, next) : route(next, joinedAt);
          }
          known.set(key, next);
          following.push(next);
          if (!reverse) break;
        }
      }
    }
    if (reverse) backward = following;
    else forward = following;
  }
  return [];
}

export async function chooseTurningRoute(layout: TurningLayout, start: TurningPose, direction: TurnSign, rejected: readonly string[],
  remaining: number, execution?: NativeExecution): Promise<TurningMove[]> {
  const stride = layout.width + 1, sum = new Int16Array(stride * (layout.field[3] + 2));
  for (const [y, row] of layout.obstacles.entries()) for (let x = 0; x < row.length; x++) {
    const at = (y + 1) * stride + x + 1;
    sum[at] = Number(row[x] !== '.') + sum[at - 1]! + sum[at - stride]! - sum[at - stride - 1]!;
  }
  const clear = ([l, t, r, b]: NativeBox) =>
    sum[(b + 1) * stride + r + 1]! + sum[t * stride + l]! === sum[t * stride + r + 1]! + sum[(b + 1) * stride + l]!;
  const blocked = new Set(rejected), frontier: SearchNode[][] = [], explored = new Map([[poseKey(start), 0]]);
  const operations: ExtensionOperation[] = ['extend', 'retract', 'turn'];
  const moves = layout.segments.flatMap((segment, body) => operations.flatMap(operation => {
    const button = segment.buttons[operation];
    if (!button) return [];
    const receivers = layout.panels && operation !== 'turn' ? layout.segments.flatMap((other, index) =>
      other.buttons[operation] && equal(button.at, other.buttons[operation]!.at) ? [index] : []) : [body];
    return receivers[0] === body ? [{ body, operation, ...(receivers.length > 1 ? { receivers } : {}) }] : [];
  }));
  if (layout.alignments && !layout.panels) return routeBetweenPoses(layout, start, direction, moves, clear, remaining, blocked, execution);
  const goals = alignmentsOf(layout);
  const estimate = (markers: NativePoint[]) => Math.ceil(Math.max(...goals.map(({ target }, i) =>
    distance(markers[i]!, target))) / layout.quantum);
  const feasible = (projection: Projection) => {
    const { parts, markers } = projection;
    if (goals.some(({ body }, i) => !contains(parts[body]!.box, dot(markers[i]!)))) return false;
    const boxes: NativeBox[] = [];
    for (const [i, { box, cap }] of parts.entries()) {
      const outer = visibleBox(layout, joined(box, cap), i);
      if (!outer || !clear(outer) || boxes.some(other => overlap(outer, other))) return false;
      boxes.push(outer);
    }
    return true;
  };
  let best = 0, lastYield = execution?.now?.() ?? performance.now();
  const push = (node: SearchNode, markers: NativePoint[]) => {
    const score = node.depth + estimate(markers);
    (frontier[score] ??= []).push(node);
    best = Math.min(best, score);
  };
  push({ pose: start, previous: null, move: null, depth: 0 }, projectTurningPose(layout, start).markers);
  for (let expanded = 0; expanded < 65_000; expanded++) {
    const now = execution?.now?.() ?? performance.now();
    if (execution?.signal?.aborted || execution?.deadlineMs !== undefined && now >= execution.deadlineMs) return [];
    if (execution && now - lastYield >= 10) {
      await execution.yieldControl();
      lastYield = execution.now?.() ?? performance.now();
    }
    while (best < frontier.length && !frontier[best]?.length) best++;
    const node = frontier[best]?.pop();
    if (!node) return [];
    if (node.depth >= remaining || node.depth > explored.get(poseKey(node.pose))!) continue;
    for (const move of moves) {
      if (blocked.has(turningEdge(node.pose, move))) continue;
      const next = moveTurningPose(node.pose, move, direction);
      if ((move.receivers ?? [move.body]).some(i => layout.segments[i]!.length + next[i]!.added * layout.quantum < 1)) continue;
      const projected = projectTurningPose(layout, next);
      if (!feasible(projected)) continue;
      const key = poseKey(next), depth = node.depth + 1;
      if ((explored.get(key) ?? Infinity) <= depth) continue;
      if (goals.every(({ target }, i) => equal(projected.markers[i]!, target))) {
        const route = [move];
        for (let parent: SearchNode | null = node; parent?.move; parent = parent.previous) route.push(parent.move);
        return route.reverse();
      }
      explored.set(key, depth);
      push({ pose: next, previous: node, move, depth }, projected.markers);
    }
  }
  return [];
}
