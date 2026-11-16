import { CODE_DIRECTIONS, codeBits, decodeCodeWord, normalizeCodeMask } from '../logos-engine/v6-code-program.ts';
import { geometricComponents, projection } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeObservation, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

export type CodeExample = { readonly command: NativeCommand; readonly box: NativeBox;
  readonly columns: readonly (readonly NativeBox[])[]; readonly stage: NativeBox };
type DemonstrationBoard = { readonly size: number; readonly mask: readonly NativePoint[]; readonly button_hue: number;
  readonly values: readonly number[]; readonly scaled?: boolean };
type Pose = { readonly point: NativePoint; readonly mask: string; readonly scale: number };

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const contains = ([l, t, r, b]: NativeBox, [x, y, u, v]: NativeBox) => x >= l && y >= t && u <= r && v <= b;
const maskKey = (points: readonly NativePoint[]) => points.map(point => point.join(',')).sort().join(';');

function rotationKey(points: readonly NativePoint[], side: number) {
  let pose = points;
  const keys: string[] = [];
  for (let turn = 0; turn < 4; turn++) {
    keys.push(maskKey(pose));
    pose = pose.map(([x, y]) => [side - 1 - y, x]);
  }
  return keys.sort()[0]!;
}

export function bindExamples(examples: readonly CodeExample[], board: DemonstrationBoard, observation: NativeObservation) {
  const bound = new Map<string, CodeExample>();
  for (const example of examples) {
    const envelope = observation.entities.filter(part => contains(part.bbox, example.box) && width(part.bbox) === height(part.bbox) &&
      width(part.bbox) > board.size && width(part.bbox) <= board.size * 3 && part.area * 2 > width(part.bbox) ** 2)
      .sort((a, b) => width(a.bbox) - width(b.bbox))[0];
    const box = envelope?.bbox ?? example.box, [l, t, r, b] = box;
    const x = Math.floor((l + r) / 2), y = Math.floor((t + b) / 2);
    bound.set(x + ',' + y, { ...example, box, command: { action_ref: example.command.action_ref, data: { x, y } } });
  }
  return [...bound.values()].sort((a, b) => a.command.data.x! - b.command.data.x! || a.command.data.y! - b.command.data.y!);
}

export function readDemonstration(board: DemonstrationBoard, example: CodeExample, frames: readonly NativeRows[]) {
  const { size, mask } = board, silhouette = rotationKey(mask, size);
  const observed = new Map<number, Pose & { readonly word: string }>();
  let examplePose: Pose | null = null, firstHighlight = false;
  for (const frame of frames) {
    const objects = geometricComponents(frame).flatMap(part => {
      const side = width(part.bbox), scale = side / size;
      if (!contains(example.stage, part.bbox) || height(part.bbox) !== side || (!board.scaled && scale !== 1)
        || part.area !== mask.length * scale ** 2) return [];
      const normalized = normalizeCodeMask(part.mask, scale);
      return normalized && rotationKey(normalized, size) === silhouette
        ? [{ point: [part.bbox[0], part.bbox[1]] as NativePoint, mask: maskKey(normalized), scale }] : [];
    });
    if (objects.length !== 1) continue;
    const pose = objects[0]!;
    const scores = example.columns.map(column => {
      const [l, t, r] = column[0]!, bottom = column.at(-1)![3];
      return projection(frame, [l - 1, t - 1, r + 1, bottom + 1]).flat().filter(pixel => pixel === board.button_hue).length;
    });
    const highest = Math.max(...scores);
    if (!highest) {
      if (!firstHighlight) examplePose = pose;
      continue;
    }
    firstHighlight = true;
    if (scores.filter(value => value === highest).length !== 1) continue;
    const index = scores.indexOf(highest), words = codeBits(frame, board, example.columns);
    if (words?.[index] !== undefined) observed.set(index, { ...pose, word: String(decodeCodeWord(words[index]!)) });
  }
  return [...observed].flatMap(([index, after]) => {
    const before = index ? observed.get(index - 1) : examplePose;
    if (!before || before.mask !== after.mask) return [];
    const motion: NativePoint = [(after.point[0] - before.point[0]) / size, (after.point[1] - before.point[1]) / size];
    const resize = after.scale - before.scale;
    const translated = resize === 0 && CODE_DIRECTIONS.some(([x, y]) => motion[0] === x && motion[1] === y);
    const resized = resize !== 0 && motion.every(value => value === 0);
    return translated || resized ? [{ word: after.word, motion,
      ...(board.scaled ? { resize, fromScale: before.scale } : {}) }] : [];
  });
}
