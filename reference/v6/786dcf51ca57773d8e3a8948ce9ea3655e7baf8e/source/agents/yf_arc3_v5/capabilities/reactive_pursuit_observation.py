"""Relative motion and contact measurements, without capture or cargo laws."""
from agents.yf_arc3_v5.logos.types import FrozenMap


def measure_reactive_pursuit_observation(value, *, contact_quantum, contact_grid_current):
    """Measure one exact transition; DRM may retain a revisable question.

    The intermediate distance holds the peer at its old pose while moving the
    controlled body. This decomposition does not assert an update order.
    """
    base = {"relative_escape_measurement_present": False,
            "relative_escape_counteracted_approach_count": 0,
            "relative_escape_transition_rows": (),
            "relative_motion_pair_count": 0,
            "relative_escape_contact_component_refs": (),
            "relative_escape_contact_witnesses": (),
            "relative_escape_contact_component_count": 0,
            "relative_escape_contact_measurement_status": "control_geometry_unavailable",
            "relative_escape_manipulation_confirmed": False}
    boxes = tuple(sorted(set(value.canonical_provisional_control_geometry_bboxes),
                         key=lambda box: (box.top, box.left, box.bottom, box.right)))
    if len(boxes) != 1 or not value.current_observation_frame_ref:
        return FrozenMap(base)
    body = boxes[0]
    components = {item.component_id: item for item in value.components.components}
    translations = {ref: (dr, dc) for ref, dr, dc in value.current_exact_component_translations}
    controlled = {delta for ref, delta in sorted(translations.items())
                  if ref in components and components[ref].bbox == body}
    dr, dc = next(iter(controlled)) if len(controlled) == 1 else (0, 0)
    current = (body.top + body.bottom, body.left + body.right)
    previous = (current[0] - 2 * dr, current[1] - 2 * dc)
    distance = lambda a, b: abs(a[0] - b[0]) + abs(a[1] - b[1])
    rows = []
    motion_rows = sorted(translations.items()) if len(controlled) == 1 else ()
    for ref, (pr, pc) in motion_rows:
        component = components.get(ref)
        if component is None or component.bbox == body:
            continue
        box = component.bbox
        after_peer = (box.top + box.bottom, box.left + box.right)
        before_peer = (after_peer[0] - 2 * pr, after_peer[1] - 2 * pc)
        before = distance(previous, before_peer)
        held_peer = distance(current, before_peer)
        after = distance(current, after_peer)
        before_vector = (before_peer[0] - previous[0], before_peer[1] - previous[1])
        after_vector = (after_peer[0] - current[0], after_peer[1] - current[1])
        held_vector = (before_peer[0] - current[0], before_peer[1] - current[1])
        squared = lambda vector: vector[0] ** 2 + vector[1] ** 2
        rows.append(FrozenMap({"peer_component_ref": ref,
            "controlled_component_refs": tuple(sorted(key for key in translations
                if key in components and components[key].bbox == body)),
            "frame_ref": value.current_observation_frame_ref,
            "distance_before_twice": before, "distance_held_peer_twice": held_peer,
            "distance_after_twice": after,
            "controlled_approach_twice": before - held_peer,
            "peer_separation_change_twice": after - held_peer,
            "distance_delta_twice": after - before,
            "squared_distance_before_fourfold": squared(before_vector),
            "squared_distance_after_fourfold": squared(after_vector),
            "squared_distance_delta_fourfold": squared(after_vector) - squared(before_vector),
            "controlled_squared_approach_fourfold": squared(before_vector) - squared(held_vector),
            "controlled_translation_rc": (dr, dc),
            "peer_translation_rc": (pr, pc),
            "relative_translation_rc": (pr - dr, pc - dc),
            "controlled_translation_squared_norm": dr * dr + dc * dc,
            "peer_translation_squared_norm": pr * pr + pc * pc,
            "translation_squared_norm_difference": pr * pr + pc * pc - dr * dr - dc * dc,
            "shared_translation": (pr, pc) == (dr, dc),
            "peer_counteracted_approach": (pr, pc) != (dr, dc) and before > held_peer and after >= before}))
    quantum = contact_quantum or 0
    before_frame = value.previous_action_observed_frame
    contacts = []
    contact_witnesses = []
    core_components = tuple(ref for ref, component in sorted(components.items()) if component.bbox == body)
    actor_pixels = tuple(components[core_components[0]].pixels) if len(core_components) == 1 else ()
    boundary_neighbors = {}
    for r,c in sorted(actor_pixels):
        for dr,dc in ((-1,0),(0,-1),(0,1),(1,0)):
            boundary_neighbors.setdefault((r+dr,c+dc),(r,c))
    contact_status = ("grid_unqualified" if not contact_grid_current or quantum <= 0
                      else "prior_observation_missing" if before_frame is None else "measured")
    if contact_status == "measured":
        for ref, component in sorted(components.items()):
            box = component.bbox
            if box == body or ref in translations or component.touches_frame_boundary:
                continue
            center = (box.top + box.bottom, box.left + box.right)
            cell_neighbors = (body.height <= quantum and body.width <= quantum
                and box.height <= quantum and box.width <= quantum
                and distance(current, center) == 2 * quantum
                and (center[0] == current[0] or center[1] == current[1]))
            contact_pixels = sorted(set(component.pixels).intersection(boundary_neighbors))
            if not cell_neighbors:
                # Extend the established cell-contact domain only to external
                # multicell bodies. Interior sprite details and observed floor
                # regions are not new neighboring manipulanda.
                if (box.height <= quantum and box.width <= quantum
                        or box.height % quantum or box.width % quantum
                        or (box.top-body.top) % quantum or (box.left-body.left) % quantum
                        or component.value in value.current_input_aligned_underlay_values):
                    continue
                contact_pixels = [p for p in contact_pixels
                    if not (body.top <= p[0] <= body.bottom and body.left <= p[1] <= body.right)]
            if not cell_neighbors and not contact_pixels:
                continue
            if all(0 <= r < len(before_frame.rows) and 0 <= c < len(before_frame.rows[r])
                   and before_frame.rows[r][c] == component.value for r, c in component.pixels):
                contacts.append(ref)
                if len(core_components) == 1:
                    contact_witnesses.append(FrozenMap({
                        "frame_ref": value.current_observation_frame_ref,
                        "actor_component_ref": core_components[0], "subject_component_ref": ref,
                        "actor_bbox": (body.top, body.left, body.bottom, body.right),
                        "subject_bbox": (box.top, box.left, box.bottom, box.right),
                        "cell_pitch": quantum,
                        **({"contact_geometry_kind": "observed_pixel_boundary",
                            "pixel_contact_pair": (boundary_neighbors[contact_pixels[0]],contact_pixels[0])}
                           if not cell_neighbors else {}),
                    }))
    # Do not select an actor among ambiguous peers. Keep every pair and expose
    # scalar facts only when the measured domain contains exactly one pair.
    single_pair = {f"relative_motion_{key}": item for key, item in sorted(rows[0].items())} if len(rows) == 1 else {}
    return FrozenMap({**base, **single_pair,
        "relative_motion_pair_count": len(rows),
        "relative_escape_measurement_present": bool(rows),
        "relative_escape_transition_rows": tuple(rows),
        "relative_escape_counteracted_approach_count": sum(row["peer_counteracted_approach"] for row in rows),
        "relative_escape_contact_component_refs": tuple(contacts),
        "relative_escape_contact_witnesses": tuple(contact_witnesses),
        "relative_escape_contact_measurement_status": contact_status,
        "relative_escape_contact_component_count": len(contacts)})


def attach_reactive_pursuit_observation(agenda, value, *, contact_quantum, contact_grid_current):
    measured = measure_reactive_pursuit_observation(value, contact_quantum=contact_quantum,
                                                   contact_grid_current=contact_grid_current)
    directions = {ref for ref, _dr, _dc in value.interface_action_translation_deltas}
    contact_inputs = set(value.available_action_refs) - directions - {
        "ACTION6", value.level_start_checkpoint_action_ref}
    # This is interface classification only. DRM decides whether any such
    # input is an informative experiment; no action is created or selected.
    facts = {ref: FrozenMap.overlay({
        **measured,
        "relative_escape_candidate_contact_input_available": row.get("action_ref") in contact_inputs,
    }, row) for ref, row in sorted(agenda.alternative_facts.items())}
    return agenda.model_copy(update={
        "context_facts": FrozenMap.overlay(measured, agenda.context_facts),
        "alternative_facts": FrozenMap(facts)})
