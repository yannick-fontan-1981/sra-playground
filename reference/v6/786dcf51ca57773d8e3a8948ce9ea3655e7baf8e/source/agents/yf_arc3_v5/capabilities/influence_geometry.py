"""Exact swept-mask contacts; no support, mobility or effect is inferred."""
from __future__ import annotations

from pydantic import Field

from agents.yf_arc3_v5.logos.types import FrozenModel, Ref


class RasterContactRegion(FrozenModel):
    region_ref: Ref
    positions: tuple[tuple[int, int], ...] = Field(min_length=1)


class SweptMaskContactInput(FrozenModel):
    positions: tuple[tuple[int, int], ...]
    translation_delta: tuple[int, int]
    regions: tuple[RasterContactRegion, ...]


class SweptMaskContactMeasurements(FrozenModel):
    mask_cell_count: int
    translated_positions: tuple[tuple[int, int], ...]
    newly_contacted_region_refs: tuple[Ref, ...]
    swept_newly_contacted_region_refs: tuple[Ref, ...]


def measure_swept_mask_contacts(value: SweptMaskContactInput) -> SweptMaskContactMeasurements:
    """Enumerate every raster offset on the supplied exact translation.

    Existing intersections are kept distinct from new contact. Contact does
    not establish attachment, pushing, penetration or immobilization.
    """
    before = set(value.positions)
    dr, dc = value.translation_delta
    steps = max(abs(dr), abs(dc))
    offsets = tuple(sorted({
        (round(dr * i / steps), round(dc * i / steps))
        for i in range(1, steps + 1)
    })) if steps else ()
    after = {(r + dr, c + dc) for r, c in before}
    swept = {(r + rr, c + cc) for rr, cc in offsets for r, c in before}
    regions = tuple(sorted(value.regions, key=lambda item: item.region_ref))
    return SweptMaskContactMeasurements(
        mask_cell_count=len(before),
        translated_positions=tuple(sorted(after)),
        newly_contacted_region_refs=tuple(
            item.region_ref for item in regions
            if (after - before) & set(item.positions)
        ),
        swept_newly_contacted_region_refs=tuple(
            item.region_ref for item in regions
            if (swept - before) & set(item.positions)
        ),
    )
