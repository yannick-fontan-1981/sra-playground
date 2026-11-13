"""Visible collinear material joined through supplied compact raster regions.

Spans retain visible pixels only. A compatible occluder is not an attachment
claim, and an empty raster gap is never filled.
"""
from agents.yf_arc3_v5.capabilities.contracts import BoundingBox, ComponentDescription
from agents.yf_arc3_v5.logos.types import stable_digest


def measure_occluded_collinear_spans(components, occluders):
    maximum_height = max((item.bbox.height for item in occluders), default=0)
    fragments = tuple(item for item in components
        if not item.touches_frame_boundary and item.bbox.height <= maximum_height)
    observed_bands = {(item.value, item.bbox.top, item.bbox.bottom) for item in fragments}
    # A shorter terminal fragment does not establish a thinner band when
    # supplied fragments of the same value already span it. Keep the whole
    # observed transverse extent rather than slicing a connected rendering.
    bands = sorted((value, top, bottom) for value, top, bottom in observed_bands
        if not any(other_value == value and other_top <= top and bottom <= other_bottom
            and (other_top, other_bottom) != (top, bottom)
            for other_value, other_top, other_bottom in observed_bands))
    spans = {}
    for value, top, bottom in bands:
        peers = tuple(item for item in fragments if item.value == value
            and top <= item.bbox.top and item.bbox.bottom <= bottom)
        visible = {point for item in peers for point in item.pixels}
        # Rendering may use several values for the same thin band. Measure
        # material connectivity over all supplied fragments; the returned
        # component still contains only this value's actual visible pixels.
        band_fragments = tuple(item for item in fragments
            if max(top,item.bbox.top) <= min(bottom,item.bbox.bottom))
        allowed = {point for item in (*band_fragments,*occluders) for point in item.pixels
                   if top <= point[0] <= bottom}
        remaining = set(visible)
        while remaining:
            seed = min(remaining)
            reached = {seed}
            frontier = [seed]
            while frontier:
                row, col = frontier.pop()
                for dr, dc in ((-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)):
                    point = (row + dr, col + dc)
                    if point in allowed and point not in reached:
                        reached.add(point)
                        frontier.append(point)
            pixels = tuple(sorted(reached & visible))
            remaining.difference_update(pixels)
            members = tuple(item for item in peers if reached & set(item.pixels))
            # Existing uninterrupted elongated measurements retain their
            # identity and selection domain. Only obscured spans are added.
            if any(item.bbox.width >= 3 * item.bbox.height
                   and reached & set(item.pixels) for item in band_fragments):
                continue
            if len({tuple(item.pixels) for item in members}) < 2:
                continue
            bounds = BoundingBox(top=min(r for r,c in pixels), left=min(c for r,c in pixels),
                bottom=max(r for r,c in pixels), right=max(c for r,c in pixels))
            if bounds.width < 3 * bounds.height:
                continue
            key = (value, pixels)
            spans[key] = ComponentDescription(
                component_id='part.occluded_material_span:' + stable_digest(key), value=value,
                pixels=pixels, relative_pixels=tuple((r-bounds.top,c-bounds.left) for r,c in pixels),
                bbox=bounds, area=len(pixels), touches_frame_boundary=False,
            )
    return tuple(spans[key] for key in sorted(spans))
