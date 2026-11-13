/** Original program_input_access.py: public appearance of input-bearing support.
 * Reference: 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 */
import { projection as patch } from './v6-native-observer.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { programFullMatch } from './v6-program-respondent-observations.ts';
import type { NativeRows } from './v6-native-types.ts';
import type { OccurrenceRecord as R } from './v6-occurrence-scene.ts';

export function learnProgramInputSupport(plan: R, beforeRows: NativeRows, frames: readonly NativeRows[]): R | null {
  if (!frames.length || !truth(plan.own_prediction) || !truth(plan.prepared_word)) return null;
  const model = plan.model, owner = plan.own_prediction.object, origin = owner.base, word = owner.word;
  const controls: R[] = plan.layout.controls;
  if (!controls.every(control => equal(patch(beforeRows, control.bbox), control.patch))) return null;
  const last = frames.at(-1)!;
  if (!programFullMatch(last, model, origin, word) || !controls.every(control => equal(patch(last, control.bbox), control.patch))) return null;
  const width = Math.max(...(model.layer.shape as number[][]).map(point => point[0]!)) + 1;
  const height = Math.max(...(model.layer.shape as number[][]).map(point => point[1]!)) + 1;
  for (const [index, rows] of frames.entries()) {
    if (programFullMatch(rows, model, plan.own_prediction.expected_first_base, word)
      && !programFullMatch(rows, model, origin, word)
      && !controls.every(control => equal(patch(rows, control.bbox), control.patch))) {
      const box = [origin[0], origin[1], origin[0] + width - 1, origin[1] + height - 1];
      if (box[2] >= rows[0]!.length || box[3] >= rows.length) return null;
      return { pattern: patch(rows, box), origin, visible_after_departure_frame: index,
        input_evidence: 'Controls present before; absent after departure; reappear on measured return. Causal sufficiency at another matching support remains hypothetical.',
        status: 'conditional_input_access_support' };
    }
  }
  return null;
}

export function candidateProgramInputSites(rows: NativeRows, field: R, support: R, origin: readonly number[]): number[][] {
  const pattern: NativeRows = support.pattern, height = pattern.length, width = pattern[0]!.length, sites: number[][] = [];
  for (const point of field.points as number[][]) {
    const [x, y] = point as [number, number];
    if (equal(point, origin) || x < 0 || y < 0 || x + width > rows[0]!.length || y + height > rows.length) continue;
    if (equal(patch(rows, [x, y, x + width - 1, y + height - 1]), pattern)) sites.push(point);
  }
  return sites;
}
