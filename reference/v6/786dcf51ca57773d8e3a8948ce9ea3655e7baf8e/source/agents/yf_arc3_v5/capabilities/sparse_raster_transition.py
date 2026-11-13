"""Bounded raster facts; no interpretation of movement, drawing or control."""
from collections import defaultdict

from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest, restore_nominal_dataclass_input
from .components import detect_components
from .contracts import ComponentExtractionInput, FrameGrid
from .physical_transition_contracts import SparseRasterTransition


def measure_sparse_raster_transition(
    before: FrameGrid, after: FrameGrid, action_ref: str,
    point: tuple[int, int] | None,
    reference_bands: tuple[tuple[int, int, int, int, int, int], ...] = (),
) -> SparseRasterTransition | None:
    if (before.height != after.height or before.width != after.width
            or before.height * before.width > 4096):
        return None
    changed = tuple((r, c, a, b)
        for r, (old, new) in enumerate(zip(before.rows, after.rows))
        for c, (a, b) in enumerate(zip(old, new)) if a != b)
    def groups(frame):
        grouped = defaultdict(list)
        components = detect_components(ComponentExtractionInput(
            frame=frame, connectivity=4)).components
        if len(components) > 256:
            return None
        for component in components:
            if len(component.pixels) > 16:
                continue
            box = component.bbox
            shape = tuple(sorted((r - box.top, c - box.left)
                                 for r, c in component.pixels))
            grouped[(component.value, shape)].append(component)
        contours = []
        for component in components:
            b = component.bbox
            if (not 3 <= b.height == b.width <= 16
                    or any(r not in (b.top,b.bottom) and c not in (b.left,b.right)
                           for r,c in component.pixels)):
                continue
            interior = {frame.rows[r][c] for r in range(b.top+1,b.bottom)
                        for c in range(b.left+1,b.right)}
            if len(interior) == 1:
                contours.append((b.top,b.left,b.height,component.value,
                    next(iter(interior)),component.area))
        singletons = tuple(sorted((c.bbox.top,c.bbox.left,c.value)
                                  for c in components if c.area == 1))
        patches = []
        for component in components:
            b = component.bbox
            if b.height != b.width or b.height <= 1:
                continue
            center = ((b.top+b.bottom)//2,(b.left+b.right)//2)
            if component.area == b.height*b.width:
                patches.append((b.top,b.left,b.height,component.value,None))
            elif component.area == b.height*b.width-1 and center not in component.pixels:
                patches.append((b.top,b.left,b.height,component.value,frame.rows[center[0]][center[1]]))
        return (grouped, tuple(sorted(contours)) if len(contours) <= 32 else None,
                singletons if len(singletons) <= 32 else None,
                tuple(sorted(patches)) if len(patches) <= 128 else None)

    old, new = groups(before), groups(after)
    if old is None or new is None:
        return None
    old, old_contours, old_singletons, old_patches = old
    new, new_contours, new_singletons, _ = new
    translations, transported_pixels = [], set()
    for signature in sorted(old):
        # Cancel exactly unchanged raster occurrences before inspecting the
        # residual. This confers no object identity and resolves no remaining
        # tie by proximity (several same-shaped movers remain unknown).
        positions = lambda rows: {(c.bbox.top,c.bbox.left) for c in rows}
        stationary = positions(old[signature]) & positions(new.get(signature,()))
        left = tuple(c for c in old[signature] if (c.bbox.top,c.bbox.left) not in stationary)
        right = tuple(c for c in new.get(signature,()) if (c.bbox.top,c.bbox.left) not in stationary)
        if len(left) != 1 or len(right) != 1:
            continue
        a, b = left[0], right[0]
        dr, dc = b.bbox.top - a.bbox.top, b.bbox.left - a.bbox.left
        if not (dr or dc):
            continue
        translations.append((a.value, a.bbox.top, a.bbox.left,
            a.bbox.height, a.bbox.width, dr, dc, len(a.pixels)))
        transported_pixels.update(a.pixels)
        transported_pixels.update(b.pixels)
    complete = len(changed) <= 128
    translations_complete = len(translations) <= 3
    other = tuple(row for row in changed if row[:2] not in transported_pixels) if complete else ()
    if not reference_bands:
        from .outlined_diagram_measurement import retained_stratum_geometry
        reference_bands = retained_stratum_geometry(_outline_measurement(before, ()))
    return SparseRasterTransition(action_ref, stable_digest(before.rows),
        stable_digest(after.rows), point, tuple(translations) if translations_complete else (),
        changed if complete else (), other, len(changed), complete,
        len(translations), translations_complete, old_contours, new_contours,
        old_singletons, new_singletons, old_patches,
        before_outline_diagram_measurement=_outline_measurement(before, reference_bands),
        after_outline_diagram_measurement=_outline_measurement(after, reference_bands))


def _outline_measurement(frame, reference_bands):
    from .outlined_diagram_measurement import measure_outlined_diagrams
    return measure_outlined_diagrams(frame, reference_bands)


def measure_sparse_raster_series(
    observations: tuple[FrozenMap, ...],
    prior_after_digest: str | None,
    reference_bands: tuple[tuple[int, int, int, int, int, int], ...] = (),
) -> tuple[SparseRasterTransition, ...] | None:
    """Reduce an already dispatched packet once, retaining every primitive.

    These are physical measurements, not per-action reasoning/reconciliation.
    Missing/foreign frames or an unsupported member yield no partial history.
    """
    if not 1 < len(observations) <= 128:
        return None
    result = []
    previous_ref = None
    for observation in observations:
        before = FrameGrid.model_validate(restore_nominal_dataclass_input(observation['before_frame']))
        after = FrameGrid.model_validate(restore_nominal_dataclass_input(observation['after_frame']))
        if (observation['before_context_epoch'] != observation['context_epoch']
                or (previous_ref is not None and observation['before_frame_ref'] != previous_ref)
                or (prior_after_digest is not None and stable_digest(before.rows) != prior_after_digest)):
            return None
        row = measure_sparse_raster_transition(before, after,
            observation['action_ref'], observation.get('point_position'), reference_bands)
        if row is None:
            return None
        result.append(row)
        prior_after_digest = row.after_digest
        previous_ref = observation['after_frame_ref']
    return tuple(result)
