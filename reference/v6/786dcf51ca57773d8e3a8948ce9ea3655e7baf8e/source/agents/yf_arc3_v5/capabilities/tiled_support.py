"""Exact repeated-kernel factorization; no grid, role or control assignment."""

from collections import defaultdict
from dataclasses import dataclass

from .contracts import BoundingBox, ComponentDescription


@dataclass(frozen=True)
class TiledSupport:
    component_ref: str
    pitch: tuple[int, int]
    cells: tuple[tuple[int, int], ...]
    kernel: tuple[tuple[int, int], ...]
    peer_refs: tuple[str, ...] = ()
    different_kernel_peer_refs: tuple[str, ...] = ()


def measure_tiled_supports(
    components: tuple[ComponentDescription, ...],
    pitches: tuple[tuple[int, int], ...],
) -> tuple[TiledSupport, ...]:
    """Enumerate exact factorizations at supplied measured periods.

    Every occupied tile must have precisely the same internal pixel set.
    Compare tile silhouettes separately from their kernels and palette values.
    Alternative periods are preserved, never promoted to a playable lattice.
    Oversized inputs yield no qualified measurement rather than a partial pair.
    """
    periods = tuple(sorted(set(pitches)))
    if len(components) > 256 or len(periods) > 16:
        return ()
    groups: dict[tuple[object, ...], list[TiledSupport]] = defaultdict(list)
    for component in components:
        if component.touches_frame_boundary:
            continue
        for height, width in periods:
            if (height < 1 or width < 1
                    or component.bbox.height % height
                    or component.bbox.width % width):
                continue
            tiles: dict[tuple[int, int], set[tuple[int, int]]] = defaultdict(set)
            for row, column in component.relative_pixels:
                tiles[(row // height, column // width)].add(
                    (row % height, column % width)
                )
            if not 1 < len(tiles) <= 64:
                continue
            cells = tuple(sorted(tiles))
            kernel = tuple(sorted(tiles[cells[0]]))
            if any(tuple(sorted(tiles[cell])) != kernel for cell in cells[1:]):
                continue
            measurement = TiledSupport(component.component_id, (height, width), cells, kernel)
            groups[((height, width), cells)].append(measurement)
    result = []
    for key in sorted(groups):
        members = sorted(groups[key], key=lambda item: item.component_ref)
        for item in members:
            result.append(TiledSupport(
                item.component_ref, item.pitch, item.cells, item.kernel,
                tuple(peer.component_ref for peer in members
                      if peer.component_ref != item.component_ref),
                tuple(peer.component_ref for peer in members
                      if peer.component_ref != item.component_ref
                      and peer.kernel != item.kernel),
            ))
    return tuple(result)


def tiled_support_facts_by_component(
    components: tuple[ComponentDescription, ...],
    pitches: tuple[tuple[int, int], ...],
) -> dict[str, dict[str, object]]:
    """Expose singleton correspondence facts; keep ambiguous counts explicit."""
    measurements = measure_tiled_supports(components, pitches)
    by_ref: dict[str, list[TiledSupport]] = defaultdict(list)
    for measurement in measurements:
        if measurement.different_kernel_peer_refs:
            by_ref[measurement.component_ref].append(measurement)
    result: dict[str, dict[str, object]] = {}
    for component_ref in sorted(by_ref):
        variants = by_ref[component_ref]
        facts: dict[str, object] = {
            "tiled_support_correspondence_period_count": len(variants),
        }
        if len(variants) == 1:
            unique = variants[0]
            facts.update({
                "tiled_support_different_kernel_peer_count": len(unique.different_kernel_peer_refs),
                "tiled_support_exact_peer_count": len(unique.peer_refs),
                "tiled_support_cells": unique.cells,
                "tiled_support_pitch": unique.pitch,
                "tiled_support_kernel_fills_tile": len(unique.kernel) == unique.pitch[0] * unique.pitch[1],
                "tiled_support_cell_count": len(unique.cells),
            })
            if len(unique.different_kernel_peer_refs) == 1:
                facts["tiled_support_unique_peer_ref"] = unique.different_kernel_peer_refs[0]
        result[component_ref] = facts
    return result


def unique_input_aligned_tiled_support_pair(
    components: tuple[ComponentDescription, ...],
    pitches: tuple[tuple[int, int], ...],
    aligned_bboxes: tuple[BoundingBox, ...],
) -> tuple[int, tuple[ComponentDescription, ComponentDescription] | None]:
    """Count exact support pairs containing an observed input-aligned extent.

    No role or goal is inferred. Pixel-identical pairs remain the caller's
    existing measurement; different kernels require one period and one peer.
    """
    facts = tiled_support_facts_by_component(components, pitches)
    by_ref = {item.component_id: item for item in components}
    pairs = tuple(
        (member, by_ref[row["tiled_support_unique_peer_ref"]])
        for member in components
        for row in (facts.get(member.component_id, {}),)
        if member.bbox in aligned_bboxes
        and row.get("tiled_support_kernel_fills_tile") is True
        and row.get("tiled_support_exact_peer_count") == 1
        and row.get("tiled_support_different_kernel_peer_count") == 1
        and by_ref[row["tiled_support_unique_peer_ref"]].bbox not in aligned_bboxes
    )
    return len(pairs), pairs[0] if len(pairs) == 1 else None
