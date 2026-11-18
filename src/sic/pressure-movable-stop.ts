import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeCommand, NativeRows } from '../logos-engine/v6-native-types.ts';
import { auxiliaryDirections } from './auxiliary-coupled-route.ts';
import { pressureCellBox, pressureDestination, pressureOpen, projectPressureControl, verifyPressureFrame,
  type PressureField, type PressureState, type PressureStep } from './pressure-coupled-route.ts';

type Pose = { positions: PressureState['positions']; cell: number; selected: boolean };
type Focus = { memberInk: number; stopInk: number };
export type MovableStopStep = PressureStep & { pose: Pose; action: NativeCommand; heldMember?: number };
export type MovableStop = { ink: number; pose: Pose; focus: Focus | null; remaining: MovableStopStep[] };

export function verifyPressureStop(rows: NativeRows, field: PressureField, stop: MovableStop, pose: Pose) {
  let focus = stop.focus;
  if (pose.selected && !focus) {
    const [mx, my] = pressureCellBox(field, pose.positions[0]), [sx, sy] = pressureCellBox(field, pose.cell);
    const memberInk = rows[my]?.[mx], stopInk = rows[sy + 1]?.[sx + 1];
    if (memberInk === undefined || stopInk === undefined || memberInk === field.paint || stopInk === stop.ink
      || memberInk === field.floor || stopInk === field.floor || memberInk === stopInk) return null;
    focus = { memberInk, stopInk };
  }
  const overlay = { cell: pose.cell, ink: pose.selected ? focus!.stopInk : stop.ink,
    memberInk: pose.selected ? focus!.memberInk : field.paint };
  return verifyPressureFrame(rows, field, pose.positions, overlay) ? { focus } : null;
}

export function measurePressureStop(rows: NativeRows, state: PressureState, ink: number) {
  const { unit, width, height, origin, floor, paint, terrain } = state.field;
  if (unit < 4 || width * height > 256 || ink === floor || ink === paint) return null;
  const candidates = geometricComponents(rows).filter(({ color, rectangular, bbox: [l, t, r, b] }) =>
    color === ink && rectangular && r - l === unit - 3 && b - t === unit - 3);
  if (candidates.length !== 1) return null;
  const [l, t] = candidates[0]!.bbox;
  const x = (l - 1 - origin[0]) / unit, y = (t - 1 - origin[1]) / unit, cell = y * width + x;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= width || y < 0 || y >= height || terrain[cell] !== null) return null;
  const field = { ...state.field, terrain: terrain.map((value, index) => index === cell ? floor : value) };
  const stop: MovableStop = { ink, pose: { cell, positions: state.positions, selected: false }, focus: null, remaining: [] };
  return verifyPressureStop(rows, field, stop, stop.pose) ? { field, stop } : null;
}

export function planPressureWithStop(field: PressureField, start: Pose, controls: PressureState['controls'],
  commands: readonly string[], limit: number, interrupted: () => boolean): MovableStopStep[] {
  const span = field.terrain.length, maximumStates = 300_000;
  const identity = ({ positions: [a, b], cell, selected }: Pose) => ((a * span + b) * span + cell) * 2 + Number(selected);
  type Node = { pose: Pose; parent: number; depth: number; step?: MovableStopStep };
  const queue: Node[] = [{ pose: start, parent: -1, depth: 0 }];
  const seen = new Set([identity(start)]);
  for (let i = 0; i < queue.length; i++) {
    if (i % 128 === 0 && interrupted()) return [];
    const { pose, depth } = queue[i]!;
    if (pose.positions[0] === pose.positions[1]) {
      const path: MovableStopStep[] = [];
      for (let node = queue[i]!; node.step; node = queue[node.parent]!) path.push(node.step);
      return path.reverse();
    }
    if (depth >= limit) continue;
    const open = pressureOpen(field, pose.positions);
    const add = (step: MovableStopStep) => {
      const key = identity(step.pose);
      if (seen.has(key) || queue.length >= maximumStates) return;
      seen.add(key);
      queue.push({ pose: step.pose, parent: i, depth: depth + 1, step });
    };
    for (const [index, command] of commands.entries()) {
      const action = { action_ref: command, data: {} };
      if (pose.selected) {
        const [dy, dx] = auxiliaryDirections[index]!;
        const cell = pressureDestination(field, pose.cell, [dx, dy]);
        if (cell < 0 || pose.positions.includes(cell)
          || (field.terrain[cell] !== field.floor && !open[field.gateOf[cell]!])) continue;
        const gate = field.gateOf[cell]!;
        add({ command, action, positions: pose.positions, changes: [], gateCrossings: gate >= 0 ? [gate] : [], pose: { ...pose, cell } });
      } else {
        const motion = controls[command];
        if (!motion) continue;
        const step = projectPressureControl(field, pose.positions, command, motion, pose.cell);
        if (!step) continue;
        const gate = field.gateOf[pose.cell]!;
        if (gate >= 0 && !pressureOpen(field, step.positions)[gate]) continue;
        const heldMember = motion.findIndex((direction, member) =>
          pressureDestination(field, pose.positions[member]!, direction) === pose.cell);
        add({ ...step, action, pose: { ...pose, positions: step.positions }, ...(heldMember >= 0 ? { heldMember } : {}) });
      }
    }
    const [x, y] = pressureCellBox(field, pose.selected ? pose.positions[0] : pose.cell);
    const action = { action_ref: 'ACTION6', data: { x: x + 1, y: y + 1 } };
    add({ command: action.action_ref, action, positions: pose.positions, changes: [], gateCrossings: [],
      pose: { ...pose, selected: !pose.selected } });
  }
  return [];
}
