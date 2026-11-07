"""Finite conservative envelopes over supplied conditional motion models.

Connectivity is raster evidence. It does not establish support or attachment.
DRM gives the compatible alternatives meaning and controls action admission.
"""
from __future__ import annotations

from pydantic import Field, model_validator

from agents.yf_arc3_v5.capabilities.influence_geometry import (
    RasterContactRegion, SweptMaskContactInput, measure_swept_mask_contacts,
)
from agents.yf_arc3_v5.capabilities.subject_identity_binding import measure_subject_identities
from agents.yf_arc3_v5.logos.operations import ActionIntent
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref


class InfluenceEnvelopeInput(FrozenModel):
    frame_ref: Ref | None = None
    tool_signature_ref: Ref | None = None
    region_identity_pairs: tuple[tuple[Ref, Ref], ...] = ()
    visible_control_positions: tuple[tuple[int, int], ...]
    collinear_control_positions: tuple[tuple[int, int], ...] = ()
    axis_coincident_regions: tuple[RasterContactRegion, ...] = ()
    retained_load_positions: tuple[tuple[int, int], ...] = ()
    required_regions: tuple[RasterContactRegion, ...] = ()
    required_projection_pairs: tuple[tuple[Ref, Ref], ...] = ()
    axis_direction: tuple[int, int]
    translation_delta: tuple[int, int]
    path_translation_delta: tuple[int, int]
    extent_reduction_delta: tuple[int, int] | None = None
    raster_shape: tuple[int, int]
    raster_digest: Ref
    enumeration_truncated: bool = False

    @model_validator(mode="after")
    def cardinal_axis(self):
        if self.axis_direction not in ((0, 1), (1, 0), (0, -1), (-1, 0)):
            raise ValueError("influence axis must be a cardinal unit vector")
        if min(self.raster_shape) <= 0:
            raise ValueError("influence raster dimensions must be positive")
        if len({item.region_ref for item in self.required_regions}) != len(self.required_regions):
            raise ValueError("required regions must have unique references")
        if not {ref for pair in self.required_projection_pairs for ref in pair} <= {
            item.region_ref for item in self.required_regions
        }:
            raise ValueError("projection pairs must reference the supplied regions")
        return self


class InfluenceEnvelopeMeasurements(FrozenModel):
    visible_control_cell_count: int
    collinear_control_cell_count: int
    compatible_axis_region_refs: tuple[Ref, ...]
    upper_envelope_positions: tuple[tuple[int, int], ...]
    primitive_contact_refs: tuple[Ref, ...]
    path_contact_refs: tuple[Ref, ...]
    primitive_collapsed_projection_pairs: tuple[tuple[Ref, Ref], ...]
    path_collapsed_projection_pairs: tuple[tuple[Ref, Ref], ...]
    resulting_region_positions: tuple[tuple[Ref, tuple[tuple[int, int], ...]], ...]
    reduced_path_contact_refs: tuple[Ref, ...]
    extent_reduction_amount: int
    response_partition_count: int
    raster_position_outside_count: int
    required_region_count: int


class CandidateInfluenceInput(FrozenModel):
    candidate_intent: ActionIntent
    geometry: InfluenceEnvelopeInput | None = None
    current_frame_ref: Ref
    parent_guiding_principle_ref: Ref | None = None
    parent_dependency_pairs: tuple[tuple[Ref, Ref], ...] = ()
    parent_continuity: FrozenMap = Field(default_factory=FrozenMap)
    loaded_tool_model: FrozenMap = Field(default_factory=FrozenMap)


def _translated(positions, delta):
    dr, dc = delta
    return tuple(sorted((r + dr, c + dc) for r, c in positions))


def measure_influence_envelope(value: InfluenceEnvelopeInput) -> InfluenceEnvelopeMeasurements:
    control = set(value.visible_control_positions) | set(value.collinear_control_positions)
    axis = value.axis_direction
    project = lambda point: point[0] * axis[0] + point[1] * axis[1]
    # Reachability through rendered material describes a compatible concealed
    # line. Empty raster gaps remain gaps; co-location is not a support claim.
    allowed = control | {p for region in value.axis_coincident_regions for p in region.positions}
    reached = set(value.visible_control_positions)
    frontier = list(sorted(reached))
    while frontier:
        r, c = frontier.pop()
        # Perception supplies both four- and eight-connected raster fragments.
        # A diagonal rendered join is therefore a compatible material path,
        # not evidence of confirmed attachment. Do not drop its far-side
        # region from the conservative envelope or invent pixels across gaps.
        for p in ((r - 1, c - 1), (r - 1, c), (r - 1, c + 1),
                  (r, c - 1), (r, c + 1),
                  (r + 1, c - 1), (r + 1, c), (r + 1, c + 1)):
            if p in allowed and p not in reached:
                reached.add(p)
                frontier.append(p)
    compatible = tuple(region for region in sorted(value.axis_coincident_regions, key=lambda x: x.region_ref)
                       if reached & set(region.positions))
    possible = {p for region in compatible for p in region.positions} | set(value.retained_load_positions)
    upper = tuple(sorted(control | possible))
    primitive = measure_swept_mask_contacts(SweptMaskContactInput(
        positions=upper, translation_delta=value.translation_delta, regions=value.required_regions))
    path = measure_swept_mask_contacts(SweptMaskContactInput(
        positions=upper, translation_delta=value.path_translation_delta, regions=value.required_regions))

    def push_rows(delta, contacts):
        # One supplied conditional rigid push successor, not a physical claim.
        translated = set(contacts)
        rows = {region.region_ref: region.positions for region in value.required_regions}
        changed = True
        while changed:
            changed = False
            shifted = {p for ref in sorted(translated) for p in _translated(rows[ref], delta)}
            for ref in sorted(rows):
                if ref not in translated and shifted & set(rows[ref]):
                    translated.add(ref)
                    changed = True
        return {ref: _translated(positions, delta) if ref in translated else positions
                for ref, positions in sorted(rows.items())}

    after = push_rows(value.translation_delta, primitive.swept_newly_contacted_region_refs)
    after_path = push_rows(value.path_translation_delta, path.swept_newly_contacted_region_refs)
    before = {region.region_ref: region.positions for region in value.required_regions}
    # Separation transverse to the supplied tool axis is measured exactly.
    transverse = lambda positions: min(r * axis[1] - c * axis[0] for r, c in positions)
    def collapsed(rows):
        return tuple(pair for pair in sorted(value.required_projection_pairs)
                     if transverse(before[pair[0]]) != transverse(before[pair[1]])
                     and transverse(rows[pair[0]]) == transverse(rows[pair[1]]))

    extent = value.extent_reduction_delta
    amount = -(extent[0] * axis[0] + extent[1] * axis[1]) if extent else 0
    reduced_contacts = ()
    partitions = 0
    if extent and amount > 0 and control:
        endpoint = max(project(p) for p in upper) - amount
        shortened = {p for p in control if project(p) <= endpoint}
        carried = set(_translated(possible, extent))
        reduced = measure_swept_mask_contacts(SweptMaskContactInput(
            positions=tuple(sorted(shortened | carried)),
            translation_delta=value.path_translation_delta, regions=value.required_regions))
        reduced_contacts = reduced.swept_newly_contacted_region_refs
        partitions = 2 if possible and carried != possible else 0
    height, width = value.raster_shape
    outside = sum(not (0 <= r < height and 0 <= c < width) for r, c in upper)
    return InfluenceEnvelopeMeasurements(
        visible_control_cell_count=len(set(value.visible_control_positions)),
        collinear_control_cell_count=len(control),
        compatible_axis_region_refs=tuple(region.region_ref for region in compatible),
        upper_envelope_positions=upper,
        primitive_contact_refs=primitive.swept_newly_contacted_region_refs,
        path_contact_refs=path.swept_newly_contacted_region_refs,
        primitive_collapsed_projection_pairs=collapsed(after),
        path_collapsed_projection_pairs=collapsed(after_path),
        resulting_region_positions=tuple(sorted(after.items())),
        reduced_path_contact_refs=reduced_contacts,
        extent_reduction_amount=amount, response_partition_count=partitions,
        raster_position_outside_count=outside, required_region_count=len(value.required_regions),
    )


def measure_candidate_influence(value: CandidateInfluenceInput) -> FrozenMap:
    geometry = value.geometry
    if geometry is not None and value.loaded_tool_model:
        # Source has declared the mandatory possible/known membership. Its
        # fresh masks enlarge the envelope, without asserting attachment.
        retained = tuple(sorted({tuple(p)
            for state in value.loaded_tool_model.get("observed_piece_states", ())
            for p in state.get("occupied_positions", ())}))
        geometry = geometry.model_copy(update={"retained_load_positions": retained})
    facts = {
        "candidate_principle_ref": value.candidate_intent.selection_principle_ref,
        "candidate_terminal_goal_ref": value.candidate_intent.active_terminal_goal_ref,
        "candidate_goal_ref": value.candidate_intent.active_goal_ref,
        "candidate_subgoal_ref": value.candidate_intent.subgoal_ref,
        "candidate_remaining_action_bound": value.candidate_intent.remaining_action_bound,
        "candidate_reconciliation_checkpoint_ref": value.candidate_intent.reconciliation_checkpoint_ref,
        "parent_guiding_principle_ref": value.parent_guiding_principle_ref,
        "parent_dependency_pairs": value.parent_dependency_pairs,
        "qualified_parent_class_ref": value.parent_continuity.get("parent_continuity_class_ref"),
        "qualified_retained_parent_goal_ref": value.parent_continuity.get("retained_parent_goal_ref"),
        "qualified_parent_scope_matches": value.parent_continuity.get("parent_scope_matches"),
        "loaded_model_present": bool(value.loaded_tool_model),
        "loaded_model_inventory_complete": value.loaded_tool_model.get("loaded_tool_inventory_complete") is True,
        "loaded_model_missing_member_refs": tuple(value.loaded_tool_model.get("missing_member_refs") or ()),
        "loaded_model_known_member_refs": tuple(value.loaded_tool_model.get("known_load_member_refs") or ()),
        "loaded_model_possible_member_refs": tuple(value.loaded_tool_model.get("possible_load_member_refs") or ()),
        "loaded_model_member_candidate_refs": tuple(sorted(set(
            tuple(value.loaded_tool_model.get("known_load_member_refs") or ())
            + tuple(value.loaded_tool_model.get("possible_load_member_refs") or ())))),
        "geometry_present": geometry is not None,
        "measurement_frame_matches": geometry is not None and geometry.frame_ref == value.current_frame_ref,
        "current_frame_ref": value.current_frame_ref,
    }
    if geometry is not None:
        measured = measure_influence_envelope(geometry)
        contact_subjects = measure_subject_identities(source_refs=measured.primitive_contact_refs,
            identity_pairs=geometry.region_identity_pairs, current_source_refs=tuple(region.region_ref
                for region in (*geometry.required_regions, *geometry.axis_coincident_regions)))
        facts.update(measured.model_dump(mode="python"))
        facts.update({
            "primitive_contact_target_refs": contact_subjects.candidate_refs,
            "unbound_contact_region_count": len(contact_subjects.missing_source_refs),
            "ambiguous_contact_region_count": len(contact_subjects.ambiguous_source_refs),
            "primitive_contact_count": len(measured.primitive_contact_refs),
            "path_contact_count": len(measured.path_contact_refs),
            "primitive_collapsed_projection_count": len(measured.primitive_collapsed_projection_pairs),
            "path_collapsed_projection_count": len(measured.path_collapsed_projection_pairs),
            "reduced_path_contact_count": len(measured.reduced_path_contact_refs),
            "primitive_axial_delta": geometry.translation_delta[0] * geometry.axis_direction[0] + geometry.translation_delta[1] * geometry.axis_direction[1],
            "primitive_transverse_delta": geometry.translation_delta[0] * geometry.axis_direction[1] - geometry.translation_delta[1] * geometry.axis_direction[0],
            "enumeration_truncated": geometry.enumeration_truncated,
            "raster_digest": geometry.raster_digest,
        })
    return FrozenMap(facts)
