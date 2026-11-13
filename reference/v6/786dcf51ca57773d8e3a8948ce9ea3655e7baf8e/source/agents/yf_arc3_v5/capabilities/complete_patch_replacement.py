"""Exact current raster patches matching a fully replaced point-local unit."""

from agents.yf_arc3_v5.logos.types import FrozenMap


def measure_complete_patch_replacement(value, contract):
    """Return measured descriptors; no control, role or shared response is inferred."""
    before = value.previous_action_observed_frame
    point = value.last_point_position
    if (contract.get("retain_loci") is not True or before is None or point is None
            or value.last_action_ref != "ACTION6"):
        return {}, True
    after = value.frame
    if before.height != after.height or before.width != after.width:
        return {}, False

    def patch(frame, box):
        return tuple(tuple(row[box.left:box.right + 1])
            for row in frame.rows[box.top:box.bottom + 1])

    descriptors = {}
    for grid in value.periodic_cell_grids.candidates:
        cells = tuple(cell for cell in grid.cells
            if cell.bbox.top <= point[0] <= cell.bbox.bottom
            and cell.bbox.left <= point[1] <= cell.bbox.right)
        if len(cells) != 1:
            continue
        cell = cells[0]
        area = cell.bbox.height * cell.bbox.width
        if area > int(contract["maximum_cell_area"]):
            continue
        old = patch(before, cell.bbox)
        new = patch(after, cell.bbox)
        if len({v for row in old for v in row}) < int(contract["minimum_palette_count"]):
            continue
        if not all(a != b for ro, rn in zip(old, new) for a, b in zip(ro, rn)):
            continue
        peers = tuple(peer for peer in grid.cells if patch(after, peer.bbox) == old)
        if len(peers) < int(contract["minimum_peer_count"]):
            continue
        for pattern in sorted({peer.pattern_ref for peer in peers}):
            descriptors[(grid.candidate_ref, pattern)] = FrozenMap({
                "point_patch_preimage_peer": True,
                "point_patch_prior_peer_count": len(peers),
                "point_patch_complete_replacement_area": area,
            })
    complete = len(descriptors) <= int(contract["maximum_descriptors"])
    return (descriptors if complete else {}), complete
