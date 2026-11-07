"""Bounded geometric description of one small filled-square point family.

The measurement assigns no control role or mechanical effect. Palette values,
game identifiers, coordinates and expected click sequences are not inputs.
"""
from __future__ import annotations
from typing import Sequence
from agents.yf_arc3_v5.capabilities.contracts import ComponentDescription

MAX_POINT_FAMILY_MEMBERS = 64

def measure_unique_compact_square_family(
    components: Sequence[ComponentDescription],
) -> dict[str, dict[str, int | bool]]:
    squares = tuple(c for c in components
        if c.bbox.height == c.bbox.width and c.bbox.height > 1
        and c.area == c.bbox.height * c.bbox.width)
    sizes = tuple(sorted({int(c.bbox.height) for c in squares}))
    if len(sizes) != 1 or not 1 <= len(squares) <= MAX_POINT_FAMILY_MEMBERS:
        return {}
    side = sizes[0]
    larger_count = sum(c.bbox.height > side and c.bbox.width > side
        and c.area > side * side for c in components)
    if not larger_count:
        return {}
    return {c.component_id: {
        'unique_compact_square_size_family_present': True,
        'compact_square_family_side': side,
        'compact_square_family_member_count': len(squares),
        'compact_square_family_distinct_size_count': len(sizes),
        'compact_square_family_larger_surface_count': larger_count,
        'compact_square_family_center_row': (c.bbox.top + c.bbox.bottom) // 2,
        'compact_square_family_center_col': (c.bbox.left + c.bbox.right) // 2,
    } for c in sorted(squares, key=lambda c: c.component_id)}
