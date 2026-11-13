"""Bounded geometric interiors; no ownership or collision meaning is assigned."""
from functools import lru_cache


@lru_cache(maxsize=32)
def enclosed_rendering_pixels(pixels: frozenset[tuple[int, int]]):
    """Pixels enclosed by a component under the same four-neighbour topology."""
    if not pixels:
        return frozenset()
    top, bottom = min(r for r, _ in pixels), max(r for r, _ in pixels)
    left, right = min(c for _, c in pixels), max(c for _, c in pixels)
    outside = {(r, c) for r in range(top, bottom + 1) for c in (left, right)
               if (r, c) not in pixels}
    outside.update((r, c) for r in (top, bottom) for c in range(left, right + 1)
                   if (r, c) not in pixels)
    pending = list(outside)
    while pending:
        r, c = pending.pop()
        for p in ((r-1,c), (r+1,c), (r,c-1), (r,c+1)):
            if (top <= p[0] <= bottom and left <= p[1] <= right
                    and p not in pixels and p not in outside):
                outside.add(p)
                pending.append(p)
    return frozenset((r, c) for r in range(top, bottom + 1)
                     for c in range(left, right + 1)
                     if (r, c) not in pixels and (r, c) not in outside)
