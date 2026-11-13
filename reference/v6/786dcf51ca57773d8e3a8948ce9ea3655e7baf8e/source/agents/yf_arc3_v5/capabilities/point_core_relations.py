"""Exact centered-mask relations at current point candidates; no role assignment."""
from __future__ import annotations

from agents.yf_arc3_v5.logos.types import FrozenMap


def measure_current_centered_core_point_relations(value, agenda):
    last = value.last_point_position
    components = value.components.components
    rows = {}
    frame = value.current_observed_frame
    for candidate in agenda.candidates:
        matches = []
        point = candidate.point
        if frame is not None and last is not None and point is not None and candidate.action_ref == 'ACTION6':
            for core in components:
                if core.area <= 1 or point != ((core.bbox.top + core.bbox.bottom) // 2,
                                              (core.bbox.left + core.bbox.right) // 2):
                    continue
                if not all(0 <= r < frame.height and 0 <= c < frame.width
                           and frame.rows[r][c] == core.value for r, c in core.pixels):
                    continue
                for outer in components:
                    if outer.value != core.value or not (
                        outer.bbox.top <= last[0] <= outer.bbox.bottom
                        and outer.bbox.left <= last[1] <= outer.bbox.right
                    ):
                        continue
                    if not all(0 <= r < frame.height and 0 <= c < frame.width
                               and frame.rows[r][c] == outer.value for r, c in outer.pixels):
                        continue
                    dh = outer.bbox.height - core.bbox.height
                    dw = outer.bbox.width - core.bbox.width
                    if dh < 0 or dw < 0 or not (dh or dw) or dh % 2 or dw % 2:
                        continue
                    crop = frozenset((r - dh // 2, c - dw // 2)
                        for r, c in outer.relative_pixels
                        if dh // 2 <= r < dh // 2 + core.bbox.height
                        and dw // 2 <= c < dw // 2 + core.bbox.width)
                    if crop != frozenset(core.relative_pixels):
                        continue
                    matches.append((core, outer))
        unique = len(matches) == 1
        core = matches[0][0] if unique else None
        rows[candidate.candidate_ref] = FrozenMap({
            'point_centered_core_match_count': len(matches),
            'point_centered_core_component_ref': core.component_id if core else '',
            'point_centered_core_outer_component_ref': matches[0][1].component_id if unique else '',
            'point_centered_core_palette_value': core.value if core else -1,
            'point_centered_core_area': core.area if core else 0,
            'point_centered_core_remembered_effectful_locus_count': sum(
                core.bbox.top <= row <= core.bbox.bottom
                and core.bbox.left <= column <= core.bbox.right
                for _ref, row, column in value.known_effectful_point_loci
            ) if core else 0,
            'point_preceding_selected_component_filled_bbox': value.last_selected_point_fills_bbox,
        })
    return FrozenMap(rows), FrozenMap()
