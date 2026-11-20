import { measureFramedWindow } from '../logos-engine/v6-framed-window-observation.ts';
import type { NativeBox, NativeCommand, NativeRows } from '../logos-engine/v6-native-types.ts';

export type ReferenceSearch = { command: NativeCommand; kind: 'reveal' | 'match'; box: NativeBox; evidence: string[] };
export type ReferenceView = { direction: string; ref: string; image: NativeBox; sample: NativeBox };
const crop = (rows: NativeRows, [left, top, right, bottom]: NativeBox) =>
  rows.slice(top, bottom + 1).map(row => row.slice(left, right + 1));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function measuredView(rows: NativeRows) {
  const scene = measureFramedWindow(rows, true);
  return scene && scene.reference.length >= 4 && scene.reference[0].length >= 4 && scene.matches.length <= 1 ? scene : undefined;
}

export function observeReferenceView(local: ReferenceView | undefined, first: NativeRows, second: NativeRows,
  command: NativeCommand, ref: string): ReferenceView | undefined {
  if (!/^ACTION[1-4]$/.test(command.action_ref)) return local;
  const before = measuredView(first);
  if (!before) return local;
  const image = before.image_box as NativeBox, sample = before.reference_box as NativeBox;
  const changed = !same(crop(first, image), crop(second, image));
  const preserved = same(crop(first, sample), crop(second, sample));
  return changed && preserved ? { direction: command.action_ref, ref, image, sample } : local;
}

export function chooseReferenceSearch(local: ReferenceView | undefined, rows: NativeRows, inputs: readonly NativeCommand[],
  attempted: ReadonlySet<string>): ReferenceSearch | undefined {
  if (!local) return;
  const scene = measuredView(rows);
  if (!scene || !same(scene.image_box, local.image) || !same(scene.reference_box, local.sample)) return;
  if (scene.matches.length === 1) {
    const [x, y] = scene.matches[0], width = scene.reference[0].length as number, height = scene.reference.length;
    const left = local.image[0] + 1 + x, top = local.image[1] + 1 + y;
    const point = { x: left + Math.floor(width / 2), y: top + Math.floor(height / 2) };
    return { command: { action_ref: 'ACTION6', data: point }, kind: 'match',
      box: [left, top, left + width - 1, top + height - 1], evidence: [local.ref] };
  }
  const input = inputs.find(command => command.action_ref === local.direction && !attempted.has(command.action_ref));
  return input ? { command: input, kind: 'reveal', box: local.image, evidence: [local.ref] } : undefined;
}
