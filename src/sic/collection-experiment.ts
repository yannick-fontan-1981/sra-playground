import { occurrenceCollectionScene } from '../logos-engine/v6-occurrence-program-observer.ts';
import type { NativeBox, NativeCommand, NativeRows } from '../logos-engine/v6-native-types.ts';

type Part = { bbox: NativeBox; color: number };
type Scene = { members: Part[]; marked_members: Part[]; marked_controls: Part[] };
export type CollectionTrial = {
  command: NativeCommand;
  box: NativeBox | null;
  expected: number[] | null;
};

export const measureCollection = (rows: NativeRows) => occurrenceCollectionScene(rows) as Scene | null;
export const collectionValues = (values: readonly number[]) => [...values].sort((a, b) => a - b);

export function matchesCollectionEdit(rows: NativeRows, expected: readonly number[]) {
  const scene = measureCollection(rows);
  return !!scene && scene.members.length === expected.length
    && collectionValues(scene.members.map(member => member.color)).every((color, i) => color === expected[i]);
}

export function proposeCollectionTrial(rows: NativeRows, commands: readonly NativeCommand[], confirmedEdit: boolean): CollectionTrial | null {
  if (commands.length !== 1) return null;
  const scene = measureCollection(rows);
  if (!scene) return null;
  const [member] = scene.marked_members, [control] = scene.marked_controls;
  if (!control) return confirmedEdit && !member ? { command: commands[0]!, box: null, expected: null } : null;
  if (!member && !confirmedEdit) return null;
  const target = member ?? control;
  const values = scene.members.filter(part => part !== member).map(part => part.color);
  if (!member) values.push(control.color);
  const [left, top, right, bottom] = target.bbox;
  return {
    command: { action_ref: 'ACTION6', data: { x: Math.floor((left + right) / 2), y: Math.floor((top + bottom) / 2) } },
    box: target.bbox,
    expected: collectionValues(values),
  };
}
