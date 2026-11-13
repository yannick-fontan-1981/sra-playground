"""Exact current support union, using already-declared control and translations."""

from dataclasses import dataclass

from .contracts import ComponentDescription, InteractionProbeInput


@dataclass(frozen=True)
class CotranslatedControlShape:
    component: ComponentDescription
    relative_pixels: frozenset[tuple[int, int]]
    support_claim_refs: tuple[str, ...]


def measure_cotranslated_control_shape(
    value: InteractionProbeInput,
) -> CotranslatedControlShape | None:
    """Join visible members only; neither fill unobserved holes nor assign roles.

    All members must have the very same measured nonzero translation, lie
    inside the unique current declared control box and agree with a current
    declared member count. Stale, ambiguous or partial evidence yields nothing.
    """
    boxes = value.canonical_provisional_control_geometry_bboxes
    rows = value.canonical_provisional_control_term_facts
    if len(boxes) != 1 or not rows:
        return None
    box = boxes[0]
    if box not in value.input_aligned_entity_bboxes:
        return None
    bearers = {row.get("entity_ref") for row in rows}
    if len(bearers) != 1 or not all(bearers):
        return None
    for row in rows:
        bindings = row.get("control_support_claim_bindings", ())
        if (row.get("control_support_partition_frame_ref")
                != value.current_observation_frame_ref
                or row.get("control_support_unresolved_refs")
                or row.get("control_support_stale_term_refs")
                or not row.get("control_support_claim_refs")
                or not bindings
                or not all(binding.get("reference_bindings_current") is True
                           for binding in bindings)):
            return None
    components = value.components.components
    exact = tuple(component for component in components if component.bbox == box)
    if len(exact) != 1:
        return None
    component = exact[0]
    translations = {}
    for ref, dr, dc in value.current_exact_component_translations:
        translations.setdefault(ref, set()).add((dr, dc))
    deltas = translations.get(component.component_id, set())
    if len(deltas) != 1 or (0, 0) in deltas:
        return None
    members = tuple(member for member in components
                    if box.top <= member.bbox.top <= member.bbox.bottom <= box.bottom
                    and box.left <= member.bbox.left <= member.bbox.right <= box.right
                    and translations.get(member.component_id) == deltas)
    if len(members) <= 1 or not any(
        len(set(row.get("current_member_entity_refs", ()))) == len(members)
        for row in rows
    ):
        return None
    pixels = frozenset((r - box.top, c - box.left)
                       for member in members for r, c in member.pixels)
    if not frozenset(component.relative_pixels) < pixels:
        return None
    return CotranslatedControlShape(
        component, pixels,
        tuple(sorted({str(ref) for row in rows
                      for ref in row.get("control_support_claim_refs", ())})),
    )
