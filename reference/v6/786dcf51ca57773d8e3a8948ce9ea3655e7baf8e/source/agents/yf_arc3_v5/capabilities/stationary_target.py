"""Exact destination-overlap measurements; obstacle meaning belongs to DRM."""
from agents.yf_arc3_v5.logos.types import stable_digest


def _patch(frame, box):
    return tuple(tuple(frame.rows[r][box.left:box.right + 1])
                 for r in range(box.top, box.bottom + 1))


def _inside(inner, outer):
    return (outer.top <= inner.top <= inner.bottom <= outer.bottom
            and outer.left <= inner.left <= inner.right <= outer.right)


def _component_token(component):
    return stable_digest((component.value, tuple(sorted(component.pixels))))


def measure_stationary_target(value):
    """Measure a unique calibrated target covered by one unchanged component.

    A stationary body does not prove a wall: this packet records an observation
    and its exact scope for a revisable DRM interpretation, without classifying
    any palette value or extending the observation to similar components.
    """
    return measure_stationary_target_sample(
        before_rows=value.before_scene.frame.rows, after_rows=value.after_scene.frame.rows,
        before_boxes=value.pre_action_input_aligned_entity_bboxes,
        after_boxes=value.post_action_input_aligned_entity_bboxes,
        before_tracking=value.before_tracking, after_tracking=value.after_tracking,
        before_components=value.before_scene.blocks.components,
        after_components=value.after_scene.blocks.components,
        calibration_facts=value.canonical_input_frame_translation_facts,
        action_ref=value.action_ref, context_epoch=value.context_epoch)


def measure_stationary_target_sample(*, before_rows, after_rows, before_boxes,
        after_boxes, before_tracking, after_tracking, calibration_facts,
        action_ref, context_epoch, before_components=(), after_components=()):
    """Shared exact sample measurement, independent of reconciliation transport."""
    empty = {"stationary_target_count": 0}
    if len(before_boxes) != 1 or before_boxes != after_boxes:
        return empty
    body = before_boxes[0]
    body_patch = tuple(tuple(row[body.left:body.right + 1])
                       for row in before_rows[body.top:body.bottom + 1])
    after_patch = tuple(tuple(row[body.left:body.right + 1])
                        for row in after_rows[body.top:body.bottom + 1])
    if body_patch != after_patch:
        return empty
    before = {e.entity_id: e for e in before_tracking.entities}
    after = {e.entity_id: e for e in after_tracking.entities}
    measurements = {}
    for fact in calibration_facts:
        entity_ref = fact.get("moving_entity_ref")
        old, new = before.get(entity_ref), after.get(entity_ref)
        if (fact.get("action_ref") != action_ref
                or fact.get("context_epoch") != context_epoch
                or fact.get("action_delta_frame") != "input_aligned_controller"
                or fact.get("delta_unit") != "pixel"
                or old is None or new is None
                or not _inside(old.component.bbox, body)
                or _component_token(old.component) != _component_token(new.component)
                or old.match_kind == "ambiguous" or new.match_kind == "ambiguous"):
            continue
        dr, dc = fact.get("delta_row"), fact.get("delta_col")
        if (not isinstance(dr, int) or not isinstance(dc, int)
                or (dr == 0) == (dc == 0)):
            continue
        measurements.setdefault((entity_ref, dr, dc), []).append(fact["claim_ref"])
    if len(measurements) != 1:
        return empty
    (body_ref, dr, dc), calibration_refs = sorted(measurements.items())[0]
    destination = frozenset((r + dr, c + dc)
        for r in range(body.top, body.bottom + 1)
        for c in range(body.left, body.right + 1))
    matches = tuple(e for ref, e in sorted(after.items())
        if ref in before and e.match_kind != "ambiguous"
        and _component_token(e.component) == _component_token(before[ref].component)
        and destination.issubset(e.component.pixels)
        and not any(body.top <= r <= body.bottom and body.left <= c <= body.right
                    for r, c in e.component.pixels))
    # Temporal scope may omit a still-visible component. A spatial observation
    # can qualify its exact current mask without inventing a tracked entity.
    old_tokens = {_component_token(c) for c in before_components}
    spatial_matches = tuple(c for c in after_components
        if _component_token(c) in old_tokens
        and destination.issubset(c.pixels)
        and not any(body.top <= r <= body.bottom and body.left <= c0 <= body.right
                    for r, c0 in c.pixels)
        and all(before_rows[r][c0] == after_rows[r][c0] == c.value
                for r, c0 in c.pixels))
    if len(spatial_matches) == 1:
        component = spatial_matches[0]
        identity_basis = "exact_observed_component_mask"
        target_ref = "observed-component:" + _component_token(component)
    elif len(matches) == 1:
        component = matches[0].component
        identity_basis = "temporal_entity"
        target_ref = matches[0].entity_id
    else:
        return empty
    return {"stationary_target_count": 1,
        "stationary_target_ref": target_ref,
        "stationary_target_identity_basis": identity_basis,
        "stationary_target_component_token": _component_token(component),
        "stationary_target_body_ref": body_ref,
        "stationary_target_body_token": stable_digest(body_patch),
        "stationary_target_body_height": body.height,
        "stationary_target_body_width": body.width,
        "stationary_target_calibration_refs": tuple(calibration_refs),
        "stationary_target_delta_row": dr, "stationary_target_delta_col": dc,
        "stationary_target_token": stable_digest((context_epoch, body_ref,
            _component_token(component), stable_digest(body_patch))),
        "stationary_target_before_bbox": (body.top, body.left, body.bottom, body.right)}


def revalidate_declared_target_masks(value, body):
    """Revalidate exact DRM-declared exclusions against current public geometry.

    Return all current masks and their real canonical premises. Changed bodies,
    changed components, missing identities and level changes release exclusions.
    No class-wide color exclusion is inferred by this mechanical consumer.
    """
    components = {c.component_id: c for c in value.components.components}
    refs = value.current_entity_component_refs
    patch_token = stable_digest(_patch(value.frame, body))
    masks, premises = set(), set()
    for fact in value.canonical_stationary_target_facts:
        if (fact.get("context_epoch") != value.current_context_epoch
                or fact.get("body_token") != patch_token
                or fact.get("body_height") != body.height
                or fact.get("body_width") != body.width):
            continue
        body_component = components.get(refs.get(fact.get("body_ref")))
        if fact.get("target_identity_basis") == "exact_observed_component_mask":
            matches = tuple(c for c in value.components.components
                            if _component_token(c) == fact.get("component_token"))
            target = matches[0] if len(matches) == 1 else None
        else:
            target = components.get(refs.get(fact.get("target_ref")))
        if (body_component is None or not _inside(body_component.bbox, body)
                or target is None
                or _component_token(target) != fact.get("component_token")):
            continue
        masks.update(target.pixels)
        premises.add(fact["claim_ref"])
    return frozenset(masks), tuple(sorted(premises))
