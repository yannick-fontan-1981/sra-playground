"""Exact open rectangular complements and bounded first-stop counterfactuals.

No component is named a receptacle here. Geometry, observed displacement and
conditional successors remain separate measurements for declarative selection.
"""
from agents.yf_arc3_v5.capabilities.contracts import BoundingBox


def rectangular_open_complements(components):
    """A rectangular empty core touches exactly one face of its solid armature."""
    records = []
    for component in components:
        box = component.bbox
        if component.touches_frame_boundary or component.area == box.height * box.width:
            continue
        occupied = frozenset(component.pixels)
        missing = frozenset(
            (r, c) for r in range(box.top, box.bottom + 1)
            for c in range(box.left, box.right + 1) if (r, c) not in occupied
        )
        if not missing:
            continue
        core = BoundingBox(top=min(r for r, _ in missing),
                           left=min(c for _, c in missing),
                           bottom=max(r for r, _ in missing),
                           right=max(c for _, c in missing))
        if len(missing) != core.height * core.width:
            continue
        faces = tuple(direction for condition, direction in (
            (core.top == box.top, (1, 0)),
            (core.bottom == box.bottom, (-1, 0)),
            (core.left == box.left, (0, 1)),
            (core.right == box.right, (0, -1)),
        ) if condition)
        if len(faces) != 1:
            continue
        # Since the complement is the entire rectangular core, both flanks and
        # the opposite face are continuously occupied, including their corners.
        records.append((component.component_id, core, faces[0]))
        if len(records) == 8:
            break
    return tuple(records)


def measure_open_cavity_stop_geometry(value):
    result = _measure_open_cavity_stop_geometry(value)
    result["open_cavity_current_continuation_present"] = bool(
        result.get("open_cavity_unique_nonreturn_action_present")
        or result.get("open_cavity_single_bounded_witness_present"))
    result["open_cavity_revalidation_frame_ref"] = getattr(value, "current_observation_frame_ref", None)
    return result


def _measure_open_cavity_stop_geometry(value):
    result = {
        "open_cavity_exact_body_fit_count": 0,
        "open_cavity_stop_route_present": False,
        "open_cavity_stop_first_action_refs": (),
        "open_cavity_stop_action_refs": (),
        "open_cavity_observed_first_stop_matches": False,
        "open_cavity_stop_search_bound_reached": False,
        "open_cavity_unique_nonreturn_action_present": False,
        "open_cavity_nonreturn_first_action_refs": (),
        "open_cavity_unique_initial_exit_present": False,
        "requested_directed_edge_pair_crossing_observed": False,
    }
    from agents.yf_arc3_v5.capabilities.open_cavity_transfer import measure_recalled_stop_graph
    recalled = measure_recalled_stop_graph(value)
    if recalled:
        return dict(result, **recalled)
    boxes = tuple(dict.fromkeys(value.input_aligned_entity_bboxes))
    if not boxes:
        return measure_initial_single_exit_geometry(value, result)
    if len(boxes) != 1:
        return result
    body = boxes[0]
    components = value.components.components
    exact_body = tuple(c for c in components if c.bbox == body
                       and c.area == body.height * body.width)
    if len(exact_body) != 1:
        return result
    records = tuple(record for record in rectangular_open_complements(components)
                    if record[1].height == body.height and record[1].width == body.width
                    and (record[1].top - body.top) % body.height == 0
                    and (record[1].left - body.left) % body.width == 0)
    result["open_cavity_exact_body_fit_count"] = len(records)
    if len(records) != 1:
        return result
    component_ref, core, inward = records[0]
    result.update({
        "open_cavity_component_ref": component_ref,
        "open_cavity_core_bbox": (core.top, core.left, core.bottom, core.right),
        "open_cavity_body_bbox": (body.top, body.left, body.bottom, body.right),
        "open_cavity_inward_cell_delta": inward,
        "open_cavity_local_row_pitch": body.height,
        "open_cavity_local_column_pitch": body.width,
    })
    result.update(measure_connecting_surface(components, body, core))
    floor = frozenset(value.current_input_aligned_underlay_values)
    if len(floor) != 1:
        return result
    frame = value.current_observed_frame or value.frame
    floor_value = next(iter(floor))
    start = (body.top, body.left)
    target = (core.top, core.left)
    rows, cols = len(frame.rows), len(frame.rows[0])

    def passable(pose):
        r, c = pose
        if pose == start:
            return True
        return (r >= 0 and c >= 0 and r + body.height <= rows
                and c + body.width <= cols
                and all(frame.rows[y][x] == floor_value
                        for y in range(r, r + body.height)
                        for x in range(c, c + body.width)))

    def first_stop(pose, delta):
        for _ in range(max(rows // body.height, cols // body.width) + 1):
            following = (pose[0] + delta[0] * body.height,
                         pose[1] + delta[1] * body.width)
            if not passable(following):
                return pose
            pose = following
        return None  # no unbounded or implicitly wrapped continuation

    deltas = tuple((ref, (0 if dr == 0 else (1 if dr > 0 else -1),
                         0 if dc == 0 else (1 if dc > 0 else -1)))
                   for ref, dr, dc in value.interface_action_translation_deltas
                   if ref in value.available_action_refs and (dr == 0) != (dc == 0))
    observed = tuple((dr, dc) for ref, dr, dc in value.known_action_translation_deltas
                     if ref == value.last_action_ref and (dr == 0) != (dc == 0))
    if len(observed) != 1:
        return result
    dr, dc = observed[0]
    direction = next((delta for ref, delta in deltas if ref == value.last_action_ref), None)
    if (direction is None or dr % body.height or dc % body.width
            or (dr * direction[0] + dc * direction[1]) <= 0
            or max(abs(dr) // body.height, abs(dc) // body.width) <= 1):
        return result
    previous = (start[0] - dr, start[1] - dc)
    if not passable(previous) or first_stop(previous, direction) != start:
        return result
    result["open_cavity_observed_first_stop_matches"] = True
    stop_front = (start[0] + direction[0] * body.height,
                  start[1] + direction[1] * body.width)
    if (0 <= stop_front[0] and stop_front[0] + body.height <= rows
            and 0 <= stop_front[1] and stop_front[1] + body.width <= cols):
        result["open_cavity_stop_surface_values"] = tuple(sorted({
            frame.rows[r][c] for r in range(stop_front[0], stop_front[0] + body.height)
            for c in range(stop_front[1], stop_front[1] + body.width)}))
    result["open_cavity_observed_action_ref"] = value.last_action_ref
    result["open_cavity_observed_command_delta"] = (dr, dc)
    result["open_cavity_last_action_preserves_current_stop"] = first_stop(start, direction) == start
    local_moves = tuple((ref, first_stop(start, delta)) for ref, delta in deltas
                        if delta != (-direction[0], -direction[1])
                        and first_stop(start, delta) not in (None, start))
    result["open_cavity_nonreturn_first_action_refs"] = tuple(ref for ref, _ in local_moves)
    result["open_cavity_unique_nonreturn_action_present"] = len(local_moves) == 1
    if len(local_moves) == 1:
        ref, end = local_moves[0]
        result["open_cavity_predicted_first_stop"] = end
        result["open_cavity_next_stop_equals_core"] = end == target
        return result  # direct continuation needs no complete route search
    return result


def measure_initial_single_exit_geometry(value, result):
    """Preserve only exact singleton geometry, never presume control identity."""
    components = value.components.components
    cores = rectangular_open_complements(components)
    if len(cores) != 1:
        return result
    component_ref, core, inward = cores[0]
    frame = value.current_observed_frame or value.frame
    core_values = {frame.rows[r][c] for r in range(core.top, core.bottom + 1)
                   for c in range(core.left, core.right + 1)}
    if len(core_values) != 1:
        return result
    core_value = next(iter(core_values))
    measured = []
    for component in components:
        box = component.bbox
        if (component.touches_frame_boundary or box.height != core.height
                or box.width != core.width or component.area != box.height * box.width
                or component.value == core_value):
            continue
        exits = []
        for ref, dr, dc in value.interface_action_translation_deltas:
            if ref not in value.available_action_refs or (dr == 0) == (dc == 0):
                continue
            top = box.top + (0 if dr == 0 else (core.height if dr > 0 else -core.height))
            left = box.left + (0 if dc == 0 else (core.width if dc > 0 else -core.width))
            if (0 <= top and top + core.height <= frame.height and 0 <= left
                    and left + core.width <= frame.width
                    and all(frame.rows[r][c] == core_value
                            for r in range(top, top + core.height)
                            for c in range(left, left + core.width))):
                exits.append(ref)
        if len(exits) == 1:
            measured.append((box, exits[0]))
    if len(measured) != 1:
        return result
    box, action_ref = measured[0]
    return dict(result,
        **measure_connecting_surface(components, box, core),
        open_cavity_exact_body_fit_count=1,
        open_cavity_unique_initial_exit_present=True,
        open_cavity_unique_nonreturn_action_present=True,
        open_cavity_nonreturn_first_action_refs=(action_ref,),
        open_cavity_body_bbox=(box.top, box.left, box.bottom, box.right),
        open_cavity_core_bbox=(core.top, core.left, core.bottom, core.right),
        open_cavity_component_ref=component_ref,
        open_cavity_inward_cell_delta=inward,
        open_cavity_local_row_pitch=core.height,
        open_cavity_local_column_pitch=core.width)


def measure_connecting_surface(components, body, core):
    """A single observed 4-connected region contains the core and touches body.

    This is incidence, not a floor/wall interpretation or a route decision.
    """
    core_pixels = frozenset((r, c) for r in range(core.top, core.bottom + 1)
                            for c in range(core.left, core.right + 1))
    contacts = frozenset(
        [(body.top - 1, c) for c in range(body.left, body.right + 1)]
        + [(body.bottom + 1, c) for c in range(body.left, body.right + 1)]
        + [(r, body.left - 1) for r in range(body.top, body.bottom + 1)]
        + [(r, body.right + 1) for r in range(body.top, body.bottom + 1)]
    )
    connecting = tuple(component for component in components
                       if core_pixels.issubset(frozenset(component.pixels))
                       and contacts.intersection(component.pixels))
    result = {"open_cavity_connecting_surface_present": len(connecting) == 1}
    if len(connecting) == 1:
        result.update(open_cavity_connecting_surface_ref=connecting[0].component_id,
                      open_cavity_connecting_surface_value=connecting[0].value)
    return result
