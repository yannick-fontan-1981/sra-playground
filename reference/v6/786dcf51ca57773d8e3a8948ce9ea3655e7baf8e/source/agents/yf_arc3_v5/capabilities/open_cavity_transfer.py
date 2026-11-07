"""Bounded conditional stop graphs and ordered edge measurements, without roles."""
from collections import deque
from agents.yf_arc3_v5.capabilities.open_cavity import (
    rectangular_open_complements, measure_connecting_surface,
)


def measure_recalled_stop_graph(value):
    records = getattr(value, "canonical_surface_stop_facts", ())
    if not records:
        return {}
    descriptions = {(r.get("local_row_pitch"), r.get("local_column_pitch"),
                     r.get("revisable_floor_value")) for r in records}
    if len(descriptions) != 1:
        return {}
    height, width, surface = next(iter(descriptions))
    if not isinstance(height, int) or not isinstance(width, int) or min(height, width) < 1:
        return {}
    blocking = {v for r in records for v in r.get("stop_surface_values", ())}
    components = value.components.components
    cores = tuple(r for r in rectangular_open_complements(components)
                  if r[1].height == height and r[1].width == width)
    if len(cores) != 1:
        return {}
    ref, core, inward = cores[0]
    bodies = tuple(c for c in components if c.area == height * width
                   and c.bbox.height == height and c.bbox.width == width
                   and c.value not in blocking and c.value != surface)
    if len(bodies) != 1:
        return {}
    body = bodies[0]
    incidence = measure_connecting_surface(components, body.bbox, core)
    if not incidence.get("open_cavity_connecting_surface_present"):
        return {}
    regions = tuple(c for c in components
                    if c.component_id == incidence["open_cavity_connecting_surface_ref"])
    if len(regions) != 1 or regions[0].value != surface:
        return {}
    bounds = regions[0].bbox
    if (bounds.height % height or bounds.width % width
            or (body.bbox.top - bounds.top) % height
            or (body.bbox.left - bounds.left) % width):
        return {}
    rows, columns = bounds.height // height, bounds.width // width
    if rows * columns > 4096:
        return {}
    frame = value.current_observed_frame or value.frame
    start = ((body.bbox.top - bounds.top) // height, (body.bbox.left - bounds.left) // width)
    target = ((core.top - bounds.top) // height, (core.left - bounds.left) // width)
    open_cells = set()
    for r in range(rows):
        for c in range(columns):
            if (r, c) == start or all(frame.rows[y][x] == surface
                    for y in range(bounds.top + r * height, bounds.top + (r + 1) * height)
                    for x in range(bounds.left + c * width, bounds.left + (c + 1) * width)):
                open_cells.add((r, c))
    order = value.route_generation_policy.get("open_cavity_action_order", ())
    bound = value.route_generation_policy.get("open_cavity_search_state_bound", 0)
    if not order or not isinstance(bound, int) or bound < 1:
        return {}
    directions = {ref: (0 if dr == 0 else (1 if dr > 0 else -1),
                        0 if dc == 0 else (1 if dc > 0 else -1))
                  for ref, dr, dc in value.interface_action_translation_deltas
                  if ref in value.available_action_refs and (dr == 0) != (dc == 0)}
    known_seams = set()
    seam_claims = []
    for memory in value.canonical_screen_wrap_facts:
        if (memory.get("playable_origin_row"), memory.get("playable_origin_column"),
                memory.get("playable_row_count"), memory.get("playable_column_count"),
                memory.get("cell_row_pitch"), memory.get("cell_column_pitch")) == (
                bounds.top, bounds.left, rows, columns, height, width):
            known_seams.add(memory.get("directed_edge_pair_ref"))
            seam_claims.append(memory["claim_ref"])

    def stop(pose, delta, allow_unknown):
        visited = {pose}
        unqualified = set()
        for _ in range(max(rows, columns)):
            raw = (pose[0] + delta[0], pose[1] + delta[1])
            following = raw
            if not (0 <= raw[0] < rows and 0 <= raw[1] < columns):
                seam = f"edge_pair:{delta[0]}:{delta[1]}"
                if seam not in known_seams and not allow_unknown:
                    return None, frozenset(unqualified)
                if seam not in known_seams:
                    unqualified.add(seam)
                following = (raw[0] % rows, raw[1] % columns)
            if following in visited:
                return None, frozenset(unqualified)  # no learned revisit-stop law
            if following not in open_cells:
                return pose, frozenset(unqualified)
            visited.add(following)
            pose = following
        return pose, frozenset(unqualified)

    def witness(allow_unknown):
        queue = deque([(start, (), frozenset())])
        seen = {start}
        while queue and len(seen) <= bound:
            pose, path, seams = queue.popleft()
            if pose == target:
                return (path, seams), True, len(seen)
            for action in order:
                if action not in directions:
                    continue
                end, crossed = stop(pose, directions[action], allow_unknown)
                if end is not None and end not in seen:
                    seen.add(end)
                    queue.append((end, (*path, action), seams | crossed))
        return None, not queue, len(seen)

    route, known_search_complete, known_state_count = witness(False)
    known_route_present = route is not None
    if route is None:
        route, _, _ = witness(True)  # counterfactual only; DRM authorizes an experiment, not the suffix
    if route is None or not route[0]:
        return {}
    path, seams = route
    _, first_seams = stop(start, directions[path[0]], True)
    resource_present = getattr(value, "established_boundary_indicator_present", False)
    remaining_quanta = getattr(value, "boundary_indicator_remaining_quantum_count", 0)
    result = dict(incidence,
        open_cavity_exact_body_fit_count=1,
        open_cavity_component_ref=ref,
        open_cavity_core_bbox=(core.top, core.left, core.bottom, core.right),
        open_cavity_body_bbox=(body.bbox.top, body.bbox.left, body.bbox.bottom, body.bbox.right),
        open_cavity_inward_cell_delta=inward,
        open_cavity_local_row_pitch=height, open_cavity_local_column_pitch=width,
        open_cavity_recalled_stop_model_present=True,
        open_cavity_single_bounded_witness_present=True,
        open_cavity_nonreturn_first_action_refs=(path[0],),
        open_cavity_conditional_route_action_refs=path,
        open_cavity_unqualified_route_seam_count=len(seams),
        open_cavity_first_action_unqualified_seam_count=len(first_seams),
        open_cavity_known_stop_search_complete=known_search_complete,
        open_cavity_known_stop_search_state_count=known_state_count,
        open_cavity_known_stop_goal_route_present=known_route_present,
        open_cavity_conditional_route_primitive_count=len(path),
        open_cavity_resource_bound_present=resource_present,
        open_cavity_conditional_route_within_remaining_resource=(
            resource_present and remaining_quanta >= len(path)),
        open_cavity_conditional_route_resource_slack=(
            remaining_quanta - len(path) if resource_present else None),
        open_cavity_recalled_stop_claim_refs=tuple(dict.fromkeys(
            [r["claim_ref"] for r in records] + seam_claims)),
        playable_origin_row=bounds.top, playable_origin_column=bounds.left,
        playable_row_count=rows, playable_column_count=columns,
        cell_row_pitch=height, cell_column_pitch=width,
        padding_present=(bounds.top > 0 or bounds.left > 0
                         or bounds.bottom < frame.height - 1 or bounds.right < frame.width - 1),
    )
    result.update(measure_ordered_crossing(value, body.value, bounds, height, width, directions))
    return result


def measure_ordered_crossing(value, body_value, bounds, height, width, directions):
    packet = value.latest_ordered_action_frames
    delta = directions.get(value.last_action_ref)
    if not delta or len(packet) < 2:
        return {}
    positions = []
    for frame in packet:
        matches = tuple((r, c) for r in range(bounds.top, bounds.bottom + 1, height)
                        for c in range(bounds.left, bounds.right + 1, width)
                        if all(frame.rows[y][x] == body_value
                               for y in range(r, r + height) for x in range(c, c + width)))
        if len(matches) != 1:
            return {}
        positions.append(matches[0])
    crossing = None
    for index, (a, b) in enumerate(zip(positions, positions[1:])):
        ordinary = (a[0] + delta[0] * height, a[1] + delta[1] * width)
        opposite = (bounds.top + ((a[0] - bounds.top) // height + delta[0])
                    % (bounds.height // height) * height,
                    bounds.left + ((a[1] - bounds.left) // width + delta[1])
                    % (bounds.width // width) * width)
        if b != a and b != ordinary and b != opposite:
            return {}
        excluded = {(y, x) for r, c in (a, b) for y in range(r, r + height)
                    for x in range(c, c + width)}
        if any(packet[index].rows[y][x] != packet[index + 1].rows[y][x]
               for y in range(bounds.top, bounds.bottom + 1)
               for x in range(bounds.left, bounds.right + 1) if (y, x) not in excluded):
            return {}
        if b == opposite and opposite != ordinary:
            crossing = (a, b)
    if crossing is None:
        return {}
    return {
        "measurement_context_ref": value.current_observation_frame_ref,
        "directed_edge_pair_ref": f"edge_pair:{delta[0]}:{delta[1]}",
        "playable_boundary_ref": f"boundary:{bounds.top}:{bounds.left}:{bounds.height}:{bounds.width}",
        "member_correspondence_ref": f"member_packet:{value.current_observation_frame_ref}",
        "playable_cell_bounds_qualified": True,
        "ordered_crossing_packet_complete": True,
        "same_member_correspondence_unique": True,
        "stationary_scene_registration_supported": True,
        "requested_directed_edge_pair_crossing_observed": True,
        "opposite_playable_edge_successor_matches": True,
        "orthogonal_cell_coordinate_preserved": True,
        "competing_transport_explanation_count": 0,
        "qualified_edge_pair_counterexample_count": 0,
        "open_cavity_ordered_crossing_screen_anchors": crossing,
    }
