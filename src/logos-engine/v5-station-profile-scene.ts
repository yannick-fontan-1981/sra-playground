/** Exact V5 station-profile geometry, transferred from the pinned source.
 * The visible corner marker, rank cores and receiver cuts retain all source
 * ambiguity and truncation. Receipt geometry does not assert occupancy.
 */
import { measureRankedCuts, measureStemReliefs } from './v5-stem-reliefs.ts';
import { pythonEqual as equal, pythonTruthy } from './v6-operations.ts';
import { supportCompare as compare } from './v6-support-measurements.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
const pointKey = (row: number, column: number): string => `${row},${column}`;
const pointSet = (pixels: readonly (readonly number[])[]): Set<string> => new Set(pixels.map(p => pointKey(p[0]!, p[1]!)));
const height = (c: R): number => c.bbox.bottom - c.bbox.top + 1;
const width = (c: R): number => c.bbox.right - c.bbox.left + 1;
const box = (c: R): number[] => [c.bbox.top, c.bbox.left, c.bbox.bottom, c.bbox.right];
const count = <T>(values: readonly T[], predicate: (value: T) => boolean): number => values.reduce((sum, value) => sum + Number(predicate(value)), 0);

export function measureCornerQuartets(components: readonly R[], maximumQuartets: number, maximumExpansions: number): R {
  const sides = ['tl', 'tr', 'bl', 'br'] as const;
  const corners: Record<typeof sides[number], R[]> = { tl: [], tr: [], bl: [], br: [] };
  for (const component of components) {
    const h = height(component), w = width(component);
    if (Math.min(h, w) < 2) continue;
    const pixels = pointSet(component.relative_pixels);
    for (const side of sides) {
      const row = side[0] === 't' ? 0 : h - 1, col = side[1] === 'l' ? 0 : w - 1, expected = new Set<string>();
      for (let x = 0; x < w; x++) expected.add(pointKey(row, x));
      for (let y = 0; y < h; y++) expected.add(pointKey(y, col));
      if (pixels.size === expected.size && [...expected].every(p => pixels.has(p))) corners[side].push(component);
    }
  }
  const rows: R[] = []; let truncated = false, expansions = 0;
  for (const tl of corners.tl) {
    const shape = [tl.value, height(tl), width(tl)], same = (c: R): boolean => equal([c.value, height(c), width(c)], shape);
    for (const tr of corners.tr) {
      if (!same(tr) || tr.bbox.top !== tl.bbox.top || tr.bbox.left <= tl.bbox.right) continue;
      for (const bl of corners.bl) {
        if (expansions === maximumExpansions) return { quartets: rows, domain_truncated: true, expansion_count: expansions };
        expansions++;
        if (!same(bl) || bl.bbox.left !== tl.bbox.left || bl.bbox.top <= tl.bbox.bottom) continue;
        const brs = corners.br.filter(br => same(br) && br.bbox.top === bl.bbox.top && br.bbox.left === tr.bbox.left);
        for (const br of brs) {
          const bounds = [tl.bbox.top, tl.bbox.left, br.bbox.bottom, br.bbox.right];
          const singletons = components.filter(c => c.value === tl.value && c.area === 1
            && bounds[0]! < c.bbox.top && c.bbox.top < bounds[2]!
            && bounds[1]! < c.bbox.left && c.bbox.left < bounds[3]!).map(c => c.component_id);
          const row = { bbox: bounds, palette_value: tl.value, corner_component_refs: [tl, tr, bl, br].map(c => c.component_id),
            intrinsic_singleton_component_refs: singletons };
          if (rows.length < maximumQuartets) rows.push(row); else truncated = true;
        }
      }
    }
  }
  return { quartets: rows, domain_truncated: truncated, expansion_count: expansions };
}

export function measureStationProfileScene(rows: NativeRows, components: readonly R[], stemConfiguration: R, configuration: R): R {
  const required = ['maximum_component_count', 'maximum_marker_quartets', 'maximum_receiver_enclosures',
    'maximum_receiver_bindings', 'maximum_reference_side_margin', 'receiver_axis_directions', 'maximum_marker_expansions',
    'maximum_cut_measurement_requests', 'maximum_reference_packets', 'maximum_frame_pixels'];
  if (required.some(name => !Object.hasOwn(configuration, name))) return {};
  const limit = (name: string): number => Math.trunc(Number(configuration[name]));
  if (components.length > limit('maximum_component_count')) return { component_domain_truncated: true };
  if (rows.reduce((sum, row) => sum + row.length, 0) > limit('maximum_frame_pixels')) return { frame_domain_truncated: true };
  const stems = measureStemReliefs(components, stemConfiguration);
  const profiles: R[] = components.filter(c => Object.hasOwn(stems, c.component_id) && stems[c.component_id].stem_relief_unique_profile)
    .map(c => ({ component_ref: c.component_id, bbox: box(c), palette_value: c.value, profile: stems[c.component_id] }));
  const formatMap = new Map<string, number[]>();
  for (const p of profiles) if (configuration.receiver_axis_directions.includes(p.profile.stem_relief_axis_direction)) {
    const format = [p.profile.stem_relief_rank_height_pixels.length, p.profile.stem_relief_rank_width_pixels, p.profile.stem_relief_rank_pitch_pixels];
    formatMap.set(JSON.stringify(format), format);
  }
  const formats = [...formatMap.values()].sort(compare), counts = new Map<number, number>();
  for (const row of rows) for (const pixel of row) counts.set(pixel, (counts.get(pixel) ?? 0) + 1);
  const peak = counts.size ? Math.max(...counts.values()) : 0, modal = new Set([...counts].filter(([, n]) => n === peak).map(([value]) => value));
  const frameWidth = rows[0]?.length ?? 0, enclosures: R[] = [], enclosureGaps = new Map<string, number[][]>();
  let enclosureTruncated = false;
  const profileRefs = new Set(profiles.map(p => p.component_ref));
  const overlappingProfilePixels = pointSet(components.filter(c => profileRefs.has(c.component_id)).flatMap(c => c.pixels));
  for (const component of components) {
    const h = height(component), w = width(component);
    if (Math.min(h, w) < 3) continue;
    const pixels = pointSet(component.relative_pixels), perimeter = new Map<string, number[]>();
    for (const row of [0, h - 1]) for (let col = 0; col < w; col++) perimeter.set(pointKey(row, col), [row, col]);
    for (let row = 0; row < h; row++) for (const col of [0, w - 1]) perimeter.set(pointKey(row, col), [row, col]);
    const missing = [...perimeter].filter(([key]) => !pixels.has(key)).map(([, [row, col]]) => [component.bbox.top + row!, component.bbox.left + col!]);
    const cornersVisible = [[0, 0], [0, w - 1], [h - 1, 0], [h - 1, w - 1]].every(([row, col]) => pixels.has(pointKey(row!, col!)));
    if (cornersVisible && missing.every(([row, col]) => overlappingProfilePixels.has(pointKey(row!, col!)))) {
      if (enclosures.length < limit('maximum_receiver_enclosures')) {
        enclosures.push(component); enclosureGaps.set(component.component_id, missing.sort(compare));
      } else enclosureTruncated = true;
    }
  }
  const packets: R[] = [], bindings: R[] = []; let bindingTruncated = false, packetTruncated = false, cutRequests = 0;
  for (const enclosure of enclosures) {
    const [t, l, b, r] = box(enclosure) as [number, number, number, number];
    for (let margin = 1; margin <= limit('maximum_reference_side_margin'); margin++) {
      if (l - margin < 0 || r + margin >= frameWidth) continue;
      for (let referenceRow = t + 1; referenceRow < b; referenceRow++) {
        const value = rows[referenceRow]![l - margin]!;
        if (modal.has(value) || value === enclosure.value || rows[referenceRow]![r + margin] !== value) continue;
        let internal = 0;
        for (let x = l + 1; x < r; x++) if (rows[referenceRow]![x] === value) internal++;
        if (internal < 2) continue;
        const packet = { enclosure_component_ref: enclosure.component_id, enclosure_value: enclosure.value,
          bbox: [t, l, b, r], reference_row: referenceRow, reference_columns: [l - margin, r + margin], reference_value: value,
          perimeter_gaps_under_ranked_mask: enclosureGaps.get(enclosure.component_id)! };
        if (packets.length === limit('maximum_reference_packets')) { packetTruncated = true; continue; }
        packets.push(packet);
        for (const [countRaw, rankWidthRaw, pitchRaw] of formats) {
          const arity = countRaw!, rankWidth = rankWidthRaw!, pitch = pitchRaw!;
          for (let first = l + 1; first < r - (arity - 1) * pitch - rankWidth + 1; first++) {
            const columns = Array.from({ length: arity }, (_, i) => first + i * pitch), layers = new Set<number>();
            for (let y = t + 1; y < b; y++) for (const col of columns) {
              for (let x = col; x < col + rankWidth; x++) layers.add(rows[y]![x]!);
            }
            const layerValues = [...layers].sort((a, b) => a - b);
            for (const upper of layerValues) for (const lower of layerValues) {
              if (upper === lower) continue;
              // The source stops this inner lower-value loop at the bound.
              if (cutRequests === limit('maximum_cut_measurement_requests')) { bindingTruncated = true; break; }
              cutRequests++;
              const cut = measureRankedCuts(rows, { rank_columns: columns, rank_width: rankWidth, reference_row: referenceRow,
                reference_columns: packet.reference_columns, reference_value: value, band_top: t, band_bottom: b,
                upper_value: upper, lower_value: lower });
              if (cut.uncertain_rank_indexes.length) continue;
              if (bindings.length < limit('maximum_receiver_bindings')) {
                bindings.push({ ...packet, upper_value: upper, lower_value: lower, cut_measurements: cut,
                  cut_values: columns.map((col, i) => rows[cut.cut_rows_by_rank[i][0]]![col]) });
              } else bindingTruncated = true;
            }
          }
        }
      }
    }
  }
  const markers = measureCornerQuartets(components, limit('maximum_marker_quartets'), limit('maximum_marker_expansions'));
  return { profiles, reference_packets: packets, receiver_bindings: bindings, marker_quartets: markers.quartets,
    component_domain_truncated: false, enclosure_domain_truncated: enclosureTruncated,
    receiver_binding_domain_truncated: bindingTruncated, reference_packet_domain_truncated: packetTruncated,
    cut_measurement_request_count: cutRequests, marker_expansion_count: markers.expansion_count,
    marker_domain_truncated: markers.domain_truncated };
}

export function stationProfileContext(scene: R): R {
  if (!Object.keys(scene).length || ['frame_domain_truncated', 'component_domain_truncated', 'enclosure_domain_truncated',
    'receiver_binding_domain_truncated', 'reference_packet_domain_truncated', 'marker_domain_truncated'].some(k => pythonTruthy(scene[k]))) return {};
  const packets: R[] = scene.reference_packets;
  const contained = (inner: number[], outer: number[]): boolean => outer[0]! <= inner[0]! && inner[0]! <= inner[2]! && inner[2]! <= outer[2]!
    && outer[1]! <= inner[1]! && inner[1]! <= inner[3]! && inner[3]! <= outer[3]!;
  const ranksInside = (profile: R, bounds: number[]): boolean => profile.stem_relief_rank_origins.every(([row, col]: number[]) =>
    bounds[0]! <= row! && row! <= bounds[2]! && bounds[1]! <= col!
    && col! <= col! + profile.stem_relief_rank_width_pixels - 1 && col! + profile.stem_relief_rank_width_pixels - 1 <= bounds[3]!);
  const outer: R[] = scene.profiles.filter((p: R) => !packets.some(b => ranksInside(p.profile, b.bbox)));
  const bindings: R[] = scene.receiver_bindings, receiverArities = new Set(bindings.map(b => b.cut_measurements.signed_cut_offsets.length));
  const compatible = outer.filter(p => receiverArities.has(p.profile.stem_relief_rank_height_pixels.length));
  const markers: R[] = scene.marker_quartets, marked: [R, R][] = outer.flatMap(p => markers.filter(m => contained(p.bbox, m.bbox)).map(m => [p, m] as [R, R]));
  const heights = (p: R): number[] => p.profile.stem_relief_rank_height_pixels;
  const offsets = (b: R): number[] => b.cut_measurements.signed_cut_offsets;
  const origin = (p: R): number => p.profile.stem_relief_stem_origin[0];
  const inBand = (p: R, b: R): boolean => b.bbox[0] <= origin(p) && origin(p) <= b.bbox[2];
  const vectorEqual = (p: R, b: R): boolean => equal(heights(p), offsets(b));
  const equalityCount = (cohort: R[], sameBand = false): number => cohort.reduce((sum, p) => sum + count(bindings, b => vectorEqual(p, b) && (!sameBand || inBand(p, b))), 0);
  const zeroCutAgreesWithContour = (b: R): boolean => offsets(b).every(offset => offset === 0) && b.cut_values.every((value: number) => value === b.enclosure_value);
  const context: R = { station_profile_unenclosed_profile_count: outer.length, station_profile_reference_packet_count: packets.length,
    station_profile_receiver_binding_count: bindings.length, station_profile_exact_vector_equality_count: equalityCount(outer),
    station_profile_corner_quartet_count: markers.length, station_profile_marked_profile_count: marked.length,
    station_profile_zero_cut_contour_agreement_count: count(bindings, zeroCutAgreesWithContour),
    station_profile_same_band_vector_equality_count: equalityCount(outer, true), station_profile_receiver_arity_domain_count: receiverArities.size,
    station_profile_receiver_arity_compatible_profile_count: compatible.length,
    station_profile_receiver_arity_unmatched_profile_count: outer.length - compatible.length,
    station_profile_marked_receiver_arity_compatible: marked.length === 1 && compatible.some(p => equal(p, marked[0]![0])) };
  if (marked.length === 1 && markers.length === 1) {
    const [p, marker] = marked[0]!, stemRow = origin(p);
    const neighbors = (cohort: R[], direction: number): R[] => {
      const positions = cohort.map(origin).filter(row => direction < 0 ? row < stemRow : row > stemRow);
      if (!positions.length) return [];
      const nearest = direction < 0 ? Math.max(...positions) : Math.min(...positions);
      return cohort.filter(q => origin(q) === nearest);
    };
    const above = neighbors(outer, -1), below = neighbors(outer, 1), compatibleAbove = neighbors(compatible, -1), compatibleBelow = neighbors(compatible, 1);
    const sameBand = bindings.filter(b => inBand(p, b));
    Object.assign(context, { station_profile_compatible_neighbor_above_count: compatibleAbove.length,
      station_profile_compatible_neighbor_below_count: compatibleBelow.length, station_profile_unique_marked_profile_ref: p.component_ref,
      station_profile_inner_singleton_count: marker.intrinsic_singleton_component_refs.length,
      station_profile_marked_profile_heights: heights(p), station_profile_marker_bbox: marker.bbox,
      station_profile_neighbor_above_count: above.length, station_profile_neighbor_below_count: below.length });
    if (sameBand.length === 1) {
      const receiver = sameBand[0]!, cut = offsets(receiver);
      const sideMarks = outer.filter(q => !compatible.some(c => equal(q, c)) && inBand(q, receiver));
      const orderedHeights = [...heights(p)].sort((a, b) => a - b);
      Object.assign(context, { station_profile_marked_exact_receiver_count: count(bindings, b => vectorEqual(p, b)),
        station_profile_marked_rank_bag_receiver_count: count(bindings, b => equal(orderedHeights, [...offsets(b)].sort((a, b) => a - b))),
        station_profile_marked_band_unmatched_count: sideMarks.length,
        station_profile_marked_band_unmatched_left_count: count(sideMarks, q => q.bbox[3] < p.bbox[1]),
        station_profile_marked_band_unmatched_right_count: count(sideMarks, q => p.bbox[3] < q.bbox[1]),
        station_profile_compatible_neighbor_above_equal_marked_cut_count: count(compatibleAbove, q => equal(heights(q), cut)),
        station_profile_compatible_neighbor_below_equal_marked_cut_count: count(compatibleBelow, q => equal(heights(q), cut)),
        station_profile_compatible_neighbor_above_same_band_equality_count: equalityCount(compatibleAbove, true),
        station_profile_compatible_neighbor_below_same_band_equality_count: equalityCount(compatibleBelow, true),
        station_profile_marked_profile_equal_same_band_cut: vectorEqual(p, receiver),
        station_profile_marked_receiver_horizontal_sign: p.bbox[3] < receiver.bbox[1] ? 1 : receiver.bbox[3] < p.bbox[1] ? -1 : 0,
        station_profile_marked_zero_cut_contour_agreement: zeroCutAgreesWithContour(receiver),
        station_profile_neighbor_above_equal_marked_cut_count: count(above, q => equal(heights(q), cut)),
        station_profile_neighbor_below_equal_marked_cut_count: count(below, q => equal(heights(q), cut)),
        station_profile_neighbor_above_same_band_equality_count: equalityCount(above, true),
        station_profile_neighbor_below_same_band_equality_count: equalityCount(below, true) });
    }
  }
  return context;
}
