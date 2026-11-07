"""Bounded current word/panel correspondences; no roles or action policy.

Counts, masks, containment and positional correspondences are measurements.
DRM alone proposes interpreting them as editable channel parameters. No train
physics, first-capture law, setting history or solution order is inferred here.
"""
from collections import Counter, defaultdict

from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from .components import detect_components
from .contracts import ComponentExtractionInput
from .agenda_measurement_transport import append_candidate_measurements


def _inside(component, panel):
    b, p = component.bbox, panel.bbox
    return p.top < b.top <= b.bottom < p.bottom and p.left < b.left <= b.right < p.right


def _regular(row):
    return len(row) >= 2 and len({b.bbox.left - a.bbox.left for a, b in zip(row, row[1:])}) == 1


def _scene(value, contract):
    frame = value.current_observed_frame or value.frame
    if frame.width * frame.height > contract['maximum_frame_pixels']:
        return None
    components = value.components.components if frame == value.frame else detect_components(
        ComponentExtractionInput(frame=frame)).components
    if len(components) > contract['maximum_components']:
        return None
    framed = defaultdict(list)
    for c in components:
        b = c.bbox
        if b.width <= b.height or b.height < 4 or c.area != 2 * (b.width + b.height) - 4:
            continue
        if all(frame.rows[y][x] == c.value for y in range(b.top, b.bottom + 1)
               for x in range(b.left, b.right + 1)
               if y in (b.top, b.bottom) or x in (b.left, b.right)):
            framed[(b.top, b.height, b.width)].append(c)
    panel_rows = [tuple(sorted(row, key=lambda c: c.bbox.left)) for _, row in sorted(framed.items())
                  if 2 <= len(row) <= contract['maximum_panels']]
    panel_rows = [row for row in panel_rows if all(a.bbox.right < b.bbox.left
                  for a, b in zip(row, row[1:]))]
    if len(panel_rows) != 1:
        return None
    panels = panel_rows[0]
    words = defaultdict(list)
    for c in components:
        b = c.bbox
        if b.bottom < panels[0].bbox.top and b.width == b.height and b.width >= 2 and c.area == b.width * b.height:
            words[(b.top, b.width)].append(c)
    references = []
    for _, row in sorted(words.items()):
        row = tuple(sorted(row, key=lambda c: c.bbox.left))
        if len(row) > contract['maximum_word_members'] or not _regular(row):
            continue
        runs = []
        for c in row:
            if runs and runs[-1][0] == c.value:
                runs[-1] = (c.value, runs[-1][1] + 1)
            else:
                runs.append((c.value, 1))
        if len(runs) == len(panels) and len({paint for paint, _ in runs}) > 1:
            references.append((row, tuple(runs)))
    if len(references) != 1:
        return None
    word, runs = references[0]
    header_paints = {c.value for c in word}
    descriptors = []
    for panel, (paint, length) in zip(panels, runs):
        members = tuple(c for c in components if _inside(c, panel))
        box = panel.bbox
        histogram = Counter(frame.rows[y][x] for y in range(box.top + 1, box.bottom)
                            for x in range(box.left + 1, box.right))
        peak = max(count for _, count in sorted(histogram.items()))
        dominant = tuple(v for v, count in sorted(histogram.items()) if count == peak)
        if len(dominant) != 1:
            return None
        marker_rows = defaultdict(list)
        for c in members:
            b = c.bbox
            if (c.value != dominant[0] and b.width == b.height and b.width >= 2
                    and b.top > (panel.bbox.top + panel.bbox.bottom) // 2):
                if c.area == b.width * b.height:
                    marker_rows[(b.top, b.width, 'filled')].append(c)
                elif c.area == b.width * b.height - 1 and any(
                        frame.rows[y][x] != c.value
                        for y, x in ((b.top, b.left), (b.top, b.right), (b.bottom, b.left), (b.bottom, b.right))):
                    marker_rows[(b.top, b.width, 'one_missing_corner')].append(c)
        rows = [(key, tuple(sorted(row, key=lambda c: c.bbox.left)))
                for key, row in sorted(marker_rows.items()) if _regular(tuple(sorted(row, key=lambda c: c.bbox.left)))]
        if len(rows) != 1:
            return None
        (_, _, mask_kind), markers = rows[0]
        if len(markers) > contract['maximum_markers']:
            return None
        paints = tuple(c.value for c in markers)
        prefix = 1
        while prefix < len(paints) and paints[prefix] == paints[0]:
            prefix += 1
        if len(set(paints)) > 2 or len(set(paints[prefix:])) > 1:
            return None
        patches = tuple(c for c in members if c.value in header_paints
                        and c.bbox.width >= 2 and c.bbox.height >= 2
                        and c.area >= c.bbox.width * c.bbox.height - 1
                        and c.bbox.bottom < markers[0].bbox.top)
        if not patches:
            return None
        count = prefix if mask_kind == 'filled' else len(markers)
        descriptors.append((panel, length, paint, mask_kind, count, markers, patches))
    return frame, word, tuple(descriptors)


def _current_scene(value, contract):
    scene = _scene(value, contract)
    if scene is not None:
        return (*scene, False)
    from .framed_word_fixed_span_cover import fixed_span_scene
    scene = fixed_span_scene(value, contract)
    return (*scene, True) if scene is not None else None


def measure_framed_word_candidates(value, agenda, contract):
    if not contract or contract.get('panel_word_correspondence') != 'revisable_increasing_column_order':
        return FrozenMap()
    scene = _current_scene(value, contract)
    if scene is None:
        return FrozenMap()
    frame, word, panels, fixed_span_cover = scene
    description = tuple(FrozenMap({
        'panel_bbox': (p.bbox.top, p.bbox.left, p.bbox.bottom, p.bbox.right),
        'reference_run_length': length, 'reference_paint': paint,
        'marker_mask_kind': kind, 'leading_marker_count': count,
        'patch_paints': tuple(sorted({c.value for c in patches})),
    }) for p, length, paint, kind, count, markers, patches in panels)
    measurement = FrozenMap({
        'panel_descriptions': description,
        'reference_word': tuple(c.value for c in word),
        'ordering': (contract['fixed_span_group_correspondence'] if fixed_span_cover
                     else contract['panel_word_correspondence']),
        'source_frame_ref': value.current_observation_frame_ref,
        'source_frame_digest': stable_digest(frame.rows),
        'context_epoch': value.current_context_epoch,
    })
    counts_match = all(count == length for _, length, _, _, count, _, _ in panels)
    paints_match = all(paint in {c.value for c in patches} for _, _, paint, _, _, _, patches in panels)
    out = {}
    for candidate in agenda.candidates:
        on_count, on_patch = False, False
        for _, length, paint, kind, count, markers, patches in panels:
            centers = lambda cells: {((c.bbox.top + c.bbox.bottom) // 2,
                                     (c.bbox.left + c.bbox.right) // 2) for c in cells}
            on_count |= (kind == 'filled' and count != length and candidate.point in centers(markers))
            on_patch |= (paint not in {c.value for c in patches} and candidate.point in centers(patches))
        out[candidate.candidate_ref] = FrozenMap({
            'framed_word_measurement_present': True,
            'framed_word_fixed_span_cover': fixed_span_cover,
            'framed_word_current_measurement': measurement,
            'framed_word_on_differing_prefix_mark': bool(on_count),
            'framed_word_on_noncorresponding_patch': bool(on_patch),
            'framed_word_numeric_correspondence': counts_match,
            'framed_word_paint_correspondence': paints_match,
            'framed_word_declared_activation_interface': candidate.point is None and candidate.action_ref == contract['activation_action_ref'],
            'framed_word_incoming_route_remaining_step_count': value.incoming_declared_route_remaining_step_count,
        })
    return FrozenMap(out)


def append_framed_word_candidates(value, agenda, contract, point_producer):
    """Expose current measured field centers through the ordinary point service.

    Existing candidates and their premises are kept. No new control interface,
    click payload authority or per-game action producer is introduced.
    """
    if not contract or contract.get('panel_word_correspondence') != 'revisable_increasing_column_order':
        return agenda
    scene = _current_scene(value, contract)
    if scene is None:
        return agenda
    points = tuple(sorted({((c.bbox.top + c.bbox.bottom) // 2,
                            (c.bbox.left + c.bbox.right) // 2)
                           for _, _, _, _, _, markers, patches in scene[2]
                           for c in (*markers, *patches)}))
    if len(points) > contract['maximum_point_members']:
        return agenda
    represented = {c.point for c in agenda.candidates if c.action_ref == contract['point_action_ref']}
    missing = tuple(point for point in points if point not in represented)
    additions = ()
    if missing and contract['point_action_ref'] in value.available_action_refs:
        additions = tuple((candidate, facts) for candidate, facts in point_producer(value,
            frozenset(agenda.current_context_no_effect_candidate_refs),
            frozenset(agenda.tested_candidate_refs_without_resolution_plan), {}, {}, {}, {},
            requested_points=missing) if candidate.point in missing)
    if len(agenda.candidates) + len(additions) > contract['maximum_frontier_candidates']:
        return agenda
    candidates = list(agenda.candidates)
    facts = dict(agenda.alternative_facts)
    deltas = dict(agenda.descriptive_delta_facts or agenda.alternative_facts)
    refs = set(agenda.alternative_refs)
    for candidate, base in additions:
        if candidate.candidate_ref in refs:
            continue
        candidates.append(candidate)
        refs.add(candidate.candidate_ref)
        facts[candidate.candidate_ref] = base
        deltas[candidate.candidate_ref] = base
    agenda = agenda.model_copy(update={'candidates': tuple(candidates),
        'alternative_refs': tuple(c.candidate_ref for c in candidates),
        'alternative_facts': FrozenMap(facts), 'descriptive_delta_facts': FrozenMap(deltas),
        'has_candidates': bool(candidates)})
    return append_candidate_measurements(agenda,
        measure_framed_word_candidates(value, agenda, contract), FrozenMap())
