"""Exact contact-question geometry; disposition remains in DRM retrospection.

These records describe the last edge of an existing measured route. They do
not select a destination, infer a role, or assert that an objective succeeded.
"""
from __future__ import annotations

from collections.abc import Mapping

from agents.yf_arc3_v5.logos.types import stable_digest


def _box_tuple(box):
    return (box.top, box.left, box.bottom, box.right)


def _crop(frame, box):
    top, left, bottom, right = box
    if not frame or top < 0 or left < 0 or bottom >= len(frame) or right >= len(frame[0]):
        return ()
    return tuple(tuple(row[left:right + 1]) for row in frame[top:bottom + 1])


def measure_route_contact(value, grid, mover, destination, witness, deltas, route_ref):
    """Bind one face to its target raster, current control and inventory evidence."""
    if not witness or any(action not in deltas for action in witness):
        return {}
    frame = value.frame.rows
    # Include the margins between cell cores: terminal borders may change while
    # their inner core stays identical. Preserve clipped margins explicitly.
    target = destination.bbox
    target_box = (
        max(0, target.top - grid.row_gap // 2),
        max(0, target.left - grid.col_gap // 2),
        min(len(frame) - 1, target.bottom + (grid.row_gap + 1) // 2),
        min(len(frame[0]) - 1, target.right + (grid.col_gap + 1) // 2),
    )
    before_row = sum(deltas[action][0] for action in witness[:-1]) * grid.row_pitch
    before_col = sum(deltas[action][1] for action in witness[:-1]) * grid.col_pitch
    mover_box = _box_tuple(mover.bbox)
    entry_box = tuple(number + (before_row if i % 2 == 0 else before_col)
                      for i, number in enumerate(mover_box))
    target_digest = stable_digest(_crop(frame, target_box))
    scope = {
        "route_ref": route_ref,
        "target_digest": target_digest,
        "control_raster": _crop(frame, mover_box),
        "available_action_refs": tuple(value.available_action_refs),
        "context_epoch": value.current_context_epoch,
        "inventory_evidence": tuple(value.canonical_temporal_contact_inventory_facts),
    }
    context_ref = f"{route_ref}:contact-question:{stable_digest(scope)[:24]}"
    face_digest = stable_digest((witness[-1], entry_box))[:24]
    question_ref = f"{context_ref}:entry:{face_digest}"
    prior_rows = tuple(row for row in value.canonical_contact_question_outcome_facts
                       if str(row.get("candidate_ref") or "").startswith(context_ref + ":entry:"))
    return {
        "question_ref": question_ref,
        "context_ref": context_ref,
        "prior_refused_face_claim_refs": tuple(str(row["claim_ref"]) for row in prior_rows),
        "route_ref": route_ref,
        "entry_action_ref": witness[-1],
        "entry_box": entry_box,
        "target_box": target_box,
        "target_digest": target_digest,
        "context_epoch": value.current_context_epoch,
    }


def measure_contact_receipt(record, before, observed, executed_action_ref, control_boxes):
    """Compare an actual terminal receipt with the frozen route's last edge."""
    if not isinstance(record, Mapping) or not record.get("question_ref"):
        return {}
    target_box = tuple(record.get("target_box") or ())
    entry_box = tuple(record.get("entry_box") or ())
    if len(target_box) != 4 or len(entry_box) != 4:
        return {}
    actual_boxes = tuple(_box_tuple(box) for box in control_boxes)
    return {
        "object_contact_question_ref": str(record["question_ref"]),
        "object_contact_route_ref": str(record["route_ref"]),
        "object_contact_context_epoch": record["context_epoch"],
        "object_contact_entry_action_ref": str(record["entry_action_ref"]),
        "object_contact_entry_box": entry_box,
        "object_contact_target_box": target_box,
        "object_contact_target_digest": str(record["target_digest"]),
        "object_contact_last_action_matches": executed_action_ref == record["entry_action_ref"],
        "object_contact_body_at_expected_entry": actual_boxes == (entry_box,),
        "object_contact_target_unchanged": (
            stable_digest(_crop(before.frame, target_box)) == record["target_digest"]
            and stable_digest(_crop(observed.frame, target_box)) == record["target_digest"]
        ),
        "object_contact_frames_equal": before.frame == observed.frame,
    }


def measure_contact_question_context(value):
    """Transport canonical evidence and existing frozen-WHY header counts."""
    refs = tuple(dict.fromkeys(str(row["claim_ref"])
        for row in value.canonical_contact_question_outcome_facts))
    lifecycle = value.incoming_declared_action_lifecycle_facts
    return {
        "current_level_closed_contact_question_claim_refs": refs,
        "current_level_closed_contact_question_claim_count": len(refs),
        "previous_action_lifecycle_goal_dependency_chain_count": len(tuple(
            lifecycle.get("previous_action_lifecycle_goal_dependency_chain_refs") or ())),
        "level_start_checkpoint_probe_is_lossless_in_current_observed_context":
            value.level_start_checkpoint_probe_is_lossless_in_current_observed_context,
    }
