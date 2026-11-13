/** Local public word supports and retrospective raster-edge revelation.
 * Source: pinned V6 program_respondent_observations.py.
 */
import { renderProgramLayers, decodeProgramStacks } from './v6-program-geometry.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;

export function programSupportMatch(rows: NativeRows, model: R, base: readonly number[], word: readonly number[]): R {
  const step = model.layer.step, anchor = [0, 1].map(index => base[index]! - word.length * step[index]);
  const image = renderProgramLayers(word, model.layer.shape, step);
  let visible = 0, matched = 0;
  for (const [point, color] of image) {
    const [u, v] = point.split(',').map(Number), x = u! + anchor[0]!, y = v! + anchor[1]!;
    if (0 <= y && y < rows.length && 0 <= x && x < rows[0]!.length) { visible++; if (rows[y]![x] === color) matched++; }
  }
  return { visible, hidden: image.size - visible, matched, matches: Boolean(visible) && visible === matched };
}

export function programFullMatch(rows: NativeRows, model: R, base: readonly number[], word: readonly number[]): boolean {
  const result = programSupportMatch(rows, model, base, word);
  return result.matches && result.hidden === 0;
}

export function observeRespondentProgramPacket(plan: R, beforeRows: NativeRows, frames: readonly NativeRows[], options: { same_epoch: boolean }): R {
  if (!options.same_epoch) return { status: 'unknown', reason: 'epoch_boundary_excludes_cross_level_attribution', results: [], revealed_candidates: [] };
  const model = plan.model, candidates: R[] = [...plan.candidates, ...(plan.own_prediction ? [plan.own_prediction] : [])], results: R[] = [];
  for (const candidate of candidates) {
    const object = candidate.object, hits: number[] = [], stationary: number[] = [];
    frames.forEach((rows, index) => {
      const old = programFullMatch(rows, model, object.base, object.word), after = programFullMatch(rows, model, candidate.expected_first_base, object.word);
      if (after && !old) hits.push(index); else if (old) stationary.push(index);
    });
    results.push({ candidate, status: hits.length ? 'predicted_local_translation_witnessed' : stationary.length ? 'stationary_support_observed' : 'unknown_support',
      matching_packet_indices: hits, stationary_packet_indices: stationary, universal_rule_confirmed: false });
  }
  const geometry = model.editor_geometry, palette = new Set<number>((geometry.controls as R[]).map(control => control.color));
  const exclusions = [geometry.member_column, geometry.footer], initial = decodeProgramStacks(beforeRows, model.layer, palette, exclusions);
  const initialWords = new Set(initial.map(object => JSON.stringify(object.word))), seen = new Set<string>(), revealed: R[] = [];
  frames.forEach((rows, index) => {
    for (const object of decodeProgramStacks(rows, model.layer, palette, exclusions)) {
      const wordKey = JSON.stringify(object.word);
      if (initialWords.has(wordKey) || seen.has(wordKey)) continue;
      seen.add(wordKey); const compatible: R[] = [];
      for (const move of model.moves as R[]) {
        if (!(object.word as number[]).includes(move.label)) continue;
        for (const vector of move.vectors as number[][]) {
          const prior = [0, 1].map(j => object.base[j] - vector[j]!);
          const before = programSupportMatch(beforeRows, model, prior, object.word);
          const adjacent = index ? programSupportMatch(frames[index - 1]!, model, prior, object.word) : before;
          const after = programSupportMatch(rows, model, prior, object.word);
          if (before.matches && before.hidden && adjacent.matches && !after.matches) compatible.push({ operator: move.label, vector,
            prior_base: prior, initial_support: before, preceding_support: adjacent, source_status: move.status });
        }
      }
      revealed.push({ object, first_complete_packet_index: index, compatible_retroprojections: compatible,
        status: compatible.length ? 'revealed_translation_hypothesis' : 'new_unexplained_word', prospective_prediction: false });
    }
  });
  return { status: 'observed', results, revealed_candidates: revealed,
    scope: 'Exact local word supports within the same official epoch. Editor changes do not invalidate spatial supports. A revealed word is retrospective evidence, not a prior forecast; other hidden objects and universal interaction laws remain unknown.' };
}
