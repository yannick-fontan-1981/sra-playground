/** Current-public-frame measurement and the V5 equality request consumed by
 * pinned V6 FramedWindowAccess. Reference role and pointing utility remain
 * hypotheses, even when a single pixel-equal window is measured. */
import { geometricComponents } from './v6-native-observer.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { measureTemporalFragmentMatch, TEMPORAL_FRAGMENT_EXACT_OPERATION } from './v5-temporal-fragment-match.ts';
import type { TemporalFragmentClock } from './v5-temporal-fragment-match.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type Frame = { bbox: readonly [number, number, number, number]; palette: number; area: number };

export function measureFramedWindow(rows: NativeRows): R | null {
  const frames: Frame[] = [];
  for (const part of geometricComponents(rows)) {
    const [left, top, right, bottom] = part.bbox, width = right - left + 1, height = bottom - top + 1;
    if (Math.min(width, height) < 3 || left === 0 || top === 0 || right === rows[0]!.length - 1 || bottom === rows.length - 1) continue;
    const mask = new Set(part.mask.map(([x, y]) => `${x},${y}`));
    let enclosed = true;
    for (let y = 0; y < height && enclosed; y++) for (let x = 0; x < width; x++) {
      if ((x === 0 || x === width - 1 || y === 0 || y === height - 1) && !mask.has(`${x},${y}`)) { enclosed = false; break; }
    }
    if (enclosed) frames.push({ bbox: part.bbox, palette: part.color, area: (width - 2) * (height - 2) });
  }
  const pairs: [Frame, Frame][] = [];
  for (const small of frames) for (const large of frames) {
    if (small.area >= large.area || small.palette !== large.palette) continue;
    const [left, top, right, bottom] = small.bbox, [x, y, z, v] = large.bbox;
    if (!(right < x || z < left || bottom < y || v < top)) continue;
    if (right - left > z - x || bottom - top > v - y) continue;
    pairs.push([small, large]);
  }
  const interior = (frame: Frame): number[][] => {
    const [left, top, right, bottom] = frame.bbox;
    return rows.slice(top + 1, bottom).map(row => row.slice(left + 1, right));
  };
  const compatible: R[] = [];
  let total = 0;
  for (const [small, large] of pairs) {
    const reference = interior(small), image = interior(large);
    if (new Set(reference.flat()).size < 2) continue;
    const height = reference.length, width = reference[0]!.length, matches: number[][] = [];
    let examined = 0;
    for (let y = 0; y <= image.length - height; y++) for (let x = 0; x <= image[0]!.length - width; x++) {
      examined++;
      let same = true;
      for (let j = 0; j < height && same; j++) for (let i = 0; i < width; i++) {
        if (image[y + j]![x + i] !== reference[j]![i]) { same = false; break; }
      }
      if (same) matches.push([x, y]);
    }
    total += examined;
    if (matches.length) compatible.push({ reference, image, reference_box: [...small.bbox], image_box: [...large.bbox],
      matches, examined_windows: examined, hypothesis: 'smaller_disjoint_same_border_frame_as_reference_larger_as_search_domain' });
  }
  if (compatible.length !== 1 || compatible[0]!.matches.length !== 1) return null;
  return { ...compatible[0], frame_pair_candidates: pairs.length, all_pair_windows_examined: total };
}

/** The source deadline/perf_counter seconds become native monotonic milliseconds.
 * The time bound retains the source clamp to [1, 300000], including expiry;
 * current-deadline admission remains the common caller's responsibility. */
export function certifyFramedWindow(scene: R, observation: R, deadlineMs: number,
  now: TemporalFragmentClock = () => performance.now()): R {
  const revision = observation.observation_ref;
  const model = { model_ref: 'M_exact_current_window', photo_count: 1, equality_law_ref: 'exact_palette_value' };
  const scope = { request_ref: 'window_request:' + identity([revision, scene]), caller_ref: 'public_framed_window_question',
    parent_consumer_ref: 'SRC_composition', parent_goal_ref: 'G_official_completion',
    parent_contribution_ref: 'test_current_exact_window', caller_next_item_ref: revision, epoch: observation.level_epoch,
    evidence_revision_ref: revision, model_revision_ref: identity(model),
    model_status_ref: 'descriptive_pixel_equality_with_conditional_reference_role', event_owner_ref: 'SRC',
    input_domain_complete: true, assumption_refs: [scene.hypothesis, 'pointing_at_equal_window_may_contribute_to_official_progress'] };
  const photo = { photo_ref: 'P_current', scene_ref: `scene:${observation.level_epoch}`, film_revision_ref: revision,
    photo_index: 0, frame: { rows: scene.image }, evidence_ref: revision,
    content_support_ref: 'measured_large_frame_interior', content_kind_ref: 'acquired_photo_content' };
  const windows = (scene.matches as number[][]).map(([x, y]) => ({ window_ref: `W_${x}_${y}`, photo_ref: 'P_current', left: x, top: y }));
  return measureTemporalFragmentMatch({ scope, operation_ref: TEMPORAL_FRAGMENT_EXACT_OPERATION, mode_ref: 'MATCH',
    requested_result_type: 'DMechanicalResult', node_bound: 100000, depth_bound: 4096, domain_bound: 4096,
    time_bound_ms: Math.max(1, Math.min(300000, Math.trunc(deadlineMs - now()))), models: [model],
    reference: { rows: scene.reference }, reference_revision_ref: revision, photos: [photo], windows }, now);
}
