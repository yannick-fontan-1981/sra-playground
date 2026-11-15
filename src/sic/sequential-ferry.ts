import { center, contains, correspondence, find_body, intersects } from '../logos-engine/v6-object-binding-geometry.ts';
import type { NativeBox, NativeEntity, NativeObservation, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

export type Crossing = { from: number; to: number; forward: string; back: string };
export type DeliveryModel = { crossing: Crossing; actor: string; motion: Record<string, NativePoint>; interaction: string;
  evidence: string[]; completed: number };
type Cargo = { object: { bbox: NativeBox; palette_value: number; area: number }; frame: { bbox: NativeBox; interior_bbox: NativeBox } };
export type DeliveryState = { model: DeliveryModel; cargo: Cargo[]; delivered: number; held: NativeBox | null; refs: string[]; stopped: boolean };
export type DeliveryStep = { phase: 'approach' | 'take' | 'align' | 'cross' | 'release' | 'return'; target: NativeBox; command: string; expect: NativeBox };
const boxEqual = (a: NativeBox, b: NativeBox) => a.every((value, axis) => b[axis] === value);
const shiftBox = ([l, t, r, b]: NativeBox, [x, y]: NativePoint): NativeBox => [l + x, t + y, r + x, b + y];
const midpoint = (box: NativeBox, axis: number) => center(box)[axis]!;
function nearestPickupRow(object: NativeBox, row: number, height: number, step: number) {
  const first = row + step * Math.ceil((object[1] - height - row) / step);
  const last = row + step * Math.floor((object[3] - row) / step);
  return first <= last ? Math.max(first, Math.min(row, last)) : null;
}

const area = (rows: NativeRows, box: NativeBox, palette: number) => {
  const [l, t, r, b] = box;
  let count = 0;
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) if (rows[y]?.[x] === palette) count++;
  return count;
};

export function startRecoveredDelivery(observation: NativeObservation, rows: NativeRows, model: DeliveryModel): DeliveryState | null {
  const actor = find_body(observation, model.actor) as NativeEntity | null;
  const { crossing, motion } = model, heading = motion[crossing.forward];
  if (!actor || actor.bbox[0] !== crossing.from || !heading?.[0]) return null;
  const sign = Math.sign(heading[0]);
  const inDeparture = (box: NativeBox) => sign * (midpoint(box, 0) - midpoint(actor.bbox, 0)) < 0;
  const inArrival = (box: NativeBox) => sign * (midpoint(box, 0) - midpoint(shiftBox(actor.bbox, [crossing.to - crossing.from, 0]), 0)) > 0;
  const candidates = (correspondence(observation, rows, actor.signature) as Cargo[])
    .filter(pair => inDeparture(pair.object.bbox) && inArrival(pair.frame.bbox));
  const frames = new Map<string, Cargo[]>();
  for (const pair of candidates) {
    const key = pair.frame.bbox.join(',');
    const candidatesForFrame = frames.get(key) ?? [];
    candidatesForFrame.push(pair);
    frames.set(key, candidatesForFrame);
  }
  const cargo: Cargo[] = [];
  for (const choices of frames.values()) {
    choices.sort((a, b) => b.object.area - a.object.area);
    if (choices[1] && choices[0]!.object.area < 2 * choices[1].object.area) return null;
    cargo.push(choices[0]!);
  }
  if (cargo.length < 2 || cargo.length > 4 || new Set(cargo.map(pair => pair.object.palette_value)).size !== cargo.length) return null;
  const row = actor.bbox[1], height = actor.bbox[3] - row;
  const stride = Object.values(motion).find(([dx, dy]) => !dx && dy > 0)?.[1];
  const pickupDistance = ({ object }: Cargo) => {
    if (model.completed < 2 || !stride) return Math.abs(midpoint(object.bbox, 1) - midpoint(actor.bbox, 1));
    const target = nearestPickupRow(object.bbox, row, height, stride);
    return target === null ? Infinity : Math.abs(target - row);
  };
  cargo.sort((a, b) => pickupDistance(a) - pickupDistance(b));
  return { model, cargo, delivered: 0, held: null, refs: model.evidence, stopped: false };
}

export function nextDeliveryStep(state: DeliveryState, actor: NativeBox): DeliveryStep | null {
  const active = state.cargo[state.delivered];
  if (!active || state.stopped) return null;
  const { crossing, motion, interaction } = state.model;
  const horizontal = motion[crossing.forward];
  const down = Object.entries(motion).find(([, delta]) => delta[0] === 0 && delta[1] > 0);
  const up = Object.entries(motion).find(([, delta]) => delta[0] === 0 && delta[1] < 0);
  if (!horizontal?.[0] || !up || !down || up[1][1] !== -down[1][1]) return null;
  const x = actor[0], y = actor[1], stepY = down[1][1], homeApproach = crossing.from - horizontal[0];
  const other = state.cargo[state.delivered + 1];
  const vertical = (phase: 'approach' | 'align', target: NativeBox, row: number): DeliveryStep => {
    const [command, movement] = (row > y ? down : up);
    return { phase, target, command, expect: shiftBox(actor, movement) };
  };
  if (x === crossing.to) {
    return state.held
      ? { phase: 'release', target: active.frame.bbox, command: interaction, expect: actor }
      : { phase: 'return', target: active.object.bbox, command: crossing.back, expect: shiftBox(actor, [crossing.from - x, 0]) };
  }
  if (x !== homeApproach && x !== crossing.from) return null;
  if (!state.held) {
    const object = active.object.bbox;
    const aligned = shiftBox(actor, [homeApproach - x, 0]);
    const row = state.delivered && intersects(aligned, object) ? y
      : state.model.completed >= 2 ? nearestPickupRow(object, y, actor[3] - y, stepY)
        : y + stepY * Math.round((midpoint(object, 1) - midpoint(actor, 1)) / stepY);
    if (row === null) return null;
    if (row !== y) return vertical('approach', object, row);
    if (!intersects(aligned, object)) return null;
    return x === homeApproach
      ? { phase: 'take', target: object, command: interaction, expect: actor }
      : { phase: 'approach', target: object, command: crossing.back, expect: aligned };
  }
  if (other) {
    const object = other.object.bbox, height = actor[3] - y;
    const row = nearestPickupRow(object, y, height, stepY);
    if (row === null) return null;
    if (row !== y) return vertical('align', object, row);
  }
  const landing = x === crossing.from ? crossing.to : crossing.from;
  return { phase: x === crossing.from ? 'cross' : 'align', target: active.frame.bbox,
    command: crossing.forward, expect: shiftBox(actor, [landing - x, 0]) };
}

export function assessDelivery(state: DeliveryState, step: DeliveryStep, observation: NativeObservation,
  before: NativeRows, rows: NativeRows, actor: NativeBox): { state: DeliveryState; reason: string } | null {
  const actual = find_body(observation, state.model.actor) as NativeEntity | null;
  if (!actual || !boxEqual(actual.bbox, step.expect)) return null;
  for (const pair of state.cargo.slice(0, state.delivered)) {
    if (area(rows, pair.frame.interior_bbox, pair.object.palette_value) < Math.ceil(pair.object.area / 2)) return null;
  }
  for (const { object } of state.cargo.slice(state.delivered + 1)) {
    if (area(rows, object.bbox, object.palette_value) < Math.ceil(object.area / 2)) return null;
  }
  const { object, frame } = state.cargo[state.delivered]!;
  const retained = { ...state, refs: [...state.refs.slice(-5), observation.observation_ref] };
  const eligibleArea = Math.ceil(object.area / 2);
  if (step.phase === 'take') {
    const reach: NativeBox = [actor[0] - (actor[2] - actor[0] + 1), actor[1] - (actor[3] - actor[1] + 1),
      actor[2] + (actor[2] - actor[0] + 1), actor[3] + (actor[3] - actor[1] + 1)];
    const candidates = observation.entities.filter(entity => entity.palette_value === object.palette_value
      && entity.area >= eligibleArea && contains(reach, entity.bbox) && !boxEqual(entity.bbox, object.bbox)
      && (!intersects(entity.bbox, object.bbox) || (
        entity.area === object.area
        && entity.bbox[2] - entity.bbox[0] === object.bbox[2] - object.bbox[0]
        && entity.bbox[3] - entity.bbox[1] === object.bbox[3] - object.bbox[1]
        && area(rows, entity.bbox, object.palette_value) - area(before, entity.bbox, object.palette_value) >= eligibleArea
      )));
    return candidates.length === 1 && area(rows, object.bbox, object.palette_value) < eligibleArea
      ? { state: { ...retained, held: candidates[0]!.bbox }, reason: 'object_left_source_and_is_bound_to_the_carrier' } : null;
  }
  if (step.phase === 'release') {
    const contained = observation.entities.some(entity => entity.palette_value === object.palette_value && entity.area >= eligibleArea
      && contains(frame.interior_bbox, entity.bbox));
    return state.held && contained
      ? { state: { ...retained, held: null, delivered: state.delivered + 1 }, reason: 'object_preserved_in_its_receiver' } : null;
  }
  if (state.held) {
    if (step.phase === 'cross') {
      const reach = shiftBox(actual.bbox, [0, state.held[1] - actor[1]]);
      const candidates = observation.entities.filter(entity => entity.palette_value === object.palette_value
        && intersects(entity.bbox, reach)
        && area(rows, entity.bbox, object.palette_value) - area(before, entity.bbox, object.palette_value) >= eligibleArea);
      return candidates.length === 1 && area(rows, state.held, object.palette_value) < eligibleArea
        ? { state: { ...retained, held: candidates[0]!.bbox }, reason: 'carrier_crossed_and_object_appeared_at_receiver' } : null;
    }
    const newHeld = shiftBox(state.held, [actual.bbox[0] - actor[0], actual.bbox[1] - actor[1]]);
    if (area(rows, newHeld, object.palette_value) < eligibleArea) return null;
    return { state: { ...retained, held: newHeld }, reason: 'object_verified_at_the_new_carrier_position' };
  }
  if (area(rows, object.bbox, object.palette_value) < eligibleArea) return null;
  return { state: retained, reason: step.phase === 'return' ? 'unloaded_return_preserved_the_delivery' : 'carrier_at_predicted_position' };
}
