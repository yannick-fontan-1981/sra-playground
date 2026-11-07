"""Exact bounded decomposition by previously observed raster signatures."""
from .contracts import BoundingBox, ComponentDescription


def measure_exact_component_tiling(components, signatures):
    if len(components) > 64 or len(signatures) > 16:
        return components
    result = []
    for component in components:
        tilings = set()
        for value, area, offsets in signatures:
            if not 0 < area <= 64 or len(offsets) != area or len(set(offsets)) != area:
                continue
            offsets = tuple(sorted(offsets))
            if min(r for r, _ in offsets) != 0 or min(c for _, c in offsets) != 0:
                continue
            count, remainder = divmod(component.area, area)
            if component.value != value or remainder or not 2 <= count <= 8:
                continue
            height = max(r for r, _ in offsets) + 1
            width = max(c for _, c in offsets) + 1
            if component.bbox.height != height and component.bbox.width != width:
                continue
            remaining = set(component.pixels)
            tiles = []
            while remaining:
                first = min(remaining)
                top, left = first[0] - offsets[0][0], first[1] - offsets[0][1]
                tile = tuple((top + r, left + c) for r, c in offsets)
                if not set(tile).issubset(remaining):
                    break
                remaining.difference_update(tile)
                tiles.append(tile)
            if not remaining and len(tiles) == count:
                tilings.add(tuple(tiles))
        if len(tilings) != 1:
            result.append(component)
            continue
        for ordinal, pixels in enumerate(next(iter(tilings))):
            top, left = min(r for r, _ in pixels), min(c for _, c in pixels)
            result.append(ComponentDescription(
                component_id=f'{component.component_id}:observed-tile:{ordinal}',
                value=component.value, pixels=pixels,
                relative_pixels=tuple((r-top, c-left) for r, c in pixels),
                bbox=BoundingBox(top=top,left=left,bottom=max(r for r,_ in pixels),right=max(c for _,c in pixels)),
                area=len(pixels),touches_frame_boundary=component.touches_frame_boundary))
    return tuple(result)
