"""Neutral scene/command geometry candidates for declarative piercing enrollment.

Visible masks are not support evidence. Raster borders are not physical walls.
Only supplied Source roles produce configurations; other shapes remain rows of
measured alternatives for Source qualification.
"""
from __future__ import annotations

from collections.abc import Mapping

from pydantic import Field

from agents.yf_arc3_v5.capabilities.components import detect_components
from agents.yf_arc3_v5.capabilities.contracts import (
    ComponentExtractionInput, FrameGrid, PiercingCommandEffect,
    PiercingConfiguration, PiercingObstacleRegion, PiercingPieceState,
    PiercingRodState, Position,
)
from agents.yf_arc3_v5.capabilities.influence_conservation import InfluenceEnvelopeInput
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, stable_digest


class PiercingSceneProjectionInput(FrozenModel):
    frame_ref: Ref
    current_scope: FrozenMap
    frame: FrameGrid | None = None
    interaction_measurements: FrozenMap = Field(default_factory=FrozenMap)
    canonical_control_facts: tuple[FrozenMap, ...] = ()
    canonical_effect_facts: tuple[FrozenMap, ...] = ()
    canonical_target_facts: tuple[FrozenMap, ...] = ()
    source_obstacles: tuple[PiercingObstacleRegion, ...] = ()
    source_domain_positions: tuple[Position, ...] | None = None
    source_domain_boundary_is_known: bool = True
    source_root_admissible_positions: tuple[tuple[Ref, tuple[Position, ...]], ...] = ()
    source_movable_piece_refs: tuple[Ref, ...] = ()
    source_possible_support_pairs: tuple[tuple[Ref, Ref], ...] = ()
    provenance: tuple[Ref, ...] = ()
    schema_version: Ref = "yf_arc3_v5.piercing_scene_projection_input.v1"


class PiercingSceneProjectionMeasurements(FrozenModel):
    configuration_candidates: tuple[PiercingConfiguration, ...]
    command_effect_candidates: tuple[PiercingCommandEffect, ...]
    control_geometry_rows: tuple[FrozenMap, ...]
    target_rows: tuple[FrozenMap, ...]
    command_geometry_rows: tuple[FrozenMap, ...]
    missing_premise_refs: tuple[Ref, ...]
    ambiguous_refs: tuple[Ref, ...]
    frame_ref: Ref
    current_scope: FrozenMap
    provenance: tuple[Ref, ...]
    schema_version: Ref = "yf_arc3_v5.piercing_scene_projection_measurements.v1"


class PiercingCommandGeometryInput(FrozenModel):
    action_ref: Ref
    before_positions: tuple[Position, ...]
    after_positions: tuple[Position, ...]
    entity_ref: Ref
    before_frame_ref: Ref
    after_frame_ref: Ref
    before_valued_pixels: tuple[tuple[int, int, int], ...] = ()
    after_valued_pixels: tuple[tuple[int, int, int], ...] = ()
    viewport_translation: Position | None = None
    viewport_evidence_refs: tuple[Ref, ...] = ()
    action_data: FrozenMap = Field(default_factory=FrozenMap)
    rod_ref: Ref | None = None
    axis_direction: Position | None = None
    before_root_position: Position | None = None
    after_root_position: Position | None = None
    before_root_to_tip_positions: tuple[Position, ...] = ()
    after_root_to_tip_positions: tuple[Position, ...] = ()
    resource_cost: int | None = Field(default=None, ge=0)
    evidence_refs: tuple[Ref, ...] = ()
    coordinate_scope_ref: Ref = "coordinate.world"
    schema_version: Ref = "yf_arc3_v5.piercing_command_geometry_input.v1"


class PiercingCommandGeometryMeasurements(FrozenModel):
    candidate_rows: tuple[FrozenMap, ...]
    command_effect_candidates: tuple[PiercingCommandEffect, ...]
    translation_candidates: tuple[Position, ...]
    missing_premise_refs: tuple[Ref, ...]
    frame_refs: tuple[Ref, Ref]
    evidence_refs: tuple[Ref, ...]
    schema_version: Ref = "yf_arc3_v5.piercing_command_geometry_measurements.v1"


def _positions(value) -> tuple[Position, ...]:
    return tuple((int(p[0]), int(p[1])) for p in value)


def _translated(positions, delta):
    return tuple((r + delta[0], c + delta[1]) for r, c in positions)


def _scope_matches(fact: Mapping, scope: FrozenMap) -> bool | None:
    supplied = fact.get("scope")
    supplied = supplied if isinstance(supplied, Mapping) else fact
    keys = ("game_ref", "level_ref", "session_ref")
    if not all(supplied.get(k) is not None and scope.get(k) is not None for k in keys):
        return None
    return all(supplied[k] == scope[k] for k in keys)


def _maximal_lines(positions: tuple[Position, ...]) -> tuple[tuple[Position, ...], ...]:
    mask = set(positions)
    runs = set()
    for axis in ((0, 1), (1, 0)):
        for start in sorted(mask):
            if (start[0] - axis[0], start[1] - axis[1]) in mask:
                continue
            run = [start]
            while (run[-1][0] + axis[0], run[-1][1] + axis[1]) in mask:
                run.append((run[-1][0] + axis[0], run[-1][1] + axis[1]))
            if len(run) > 1:
                runs.add(tuple(run))
    return tuple(sorted(runs))


def _shape_rows(ref: Ref, positions: tuple[Position, ...], metadata: Mapping) -> tuple[FrozenMap, ...]:
    mask = set(positions)
    rows = []
    for run in _maximal_lines(positions):
        for ordered in (run, tuple(reversed(run))):
            axis = (ordered[1][0] - ordered[0][0], ordered[1][1] - ordered[0][1])
            complement = tuple(sorted(mask - set(run)))
            root, tip = ordered[0], ordered[-1]
            root_degree = sum((root[0] + dr, root[1] + dc) in mask for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            tip_degree = sum((tip[0] + dr, tip[1] + dc) in mask for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            rows.append(FrozenMap({**metadata, "candidate_ref": "geometry.rooted_mask:" + stable_digest((ref, ordered)),
                "entity_ref": ref, "occupied_positions": positions, "root_to_tip_positions": ordered,
                "root_candidate_position": root, "tip_candidate_position": tip, "axis_direction": axis,
                "root_footprint_positions": complement, "axis_run_length": len(run),
                "root_neighbor_count": root_degree, "tip_neighbor_count": tip_degree,
                "off_axis_cell_count": len(complement), "orientation_is_hypothesis": True}))
    return tuple(rows)


def _external_cardinal_band_rows(ref, root_positions, components, metadata):
    """Enumerate whole-component bands, without assigning contact a meaning.

    A spine is a section representative; every band cell remains in its body.
    Large components are never cropped into apparent narrow protrusions.
    """
    root = set(root_positions)
    if not root:
        return ()
    rows = {}
    for axis in ((-1, 0), (0, -1), (0, 1), (1, 0)):
        transverse = (-axis[1], axis[0])
        def forward(p):
            return p[0] * axis[0] + p[1] * axis[1]
        def sideways(p):
            return p[0] * transverse[0] + p[1] * transverse[1]
        face = max(forward(p) for p in sorted(root))
        lanes = sorted({sideways(p) for p in sorted(root) if forward(p) == face})
        external = tuple((component.component_id, tuple(component.pixels))
            for component in components if component.pixels
            and not root.intersection(component.pixels)
            and all(forward(p) > face for p in component.pixels))
        for lo in lanes:
            for hi in lanes:
                if hi < lo or any(lane not in lanes for lane in range(lo, hi + 1)):
                    continue
                corridor = tuple((component_ref, pixels) for component_ref, pixels in external
                    if all(lo <= sideways(p) <= hi for p in pixels))
                depths = sorted({max(forward(p) - face for p in pixels) for _, pixels in corridor})
                for depth in depths:
                    members = tuple((component_ref, pixels) for component_ref, pixels in corridor
                        if all(forward(p) - face <= depth for p in pixels))
                    band = {p for _, pixels in members for p in pixels}
                    sections = tuple(tuple(sorted(p for p in sorted(band) if forward(p) - face == offset))
                        for offset in range(1, depth + 1))
                    if not sections or any(len(section) != hi - lo + 1 for section in sections):
                        continue
                    contacts = tuple(sorted((p, (p[0] - axis[0], p[1] - axis[1]))
                        for p in sections[0] if (p[0] - axis[0], p[1] - axis[1]) in root))
                    if len(contacts) != hi - lo + 1:
                        continue
                    external_spine = tuple(section[0] for section in sections)
                    anchor = (external_spine[0][0] - axis[0], external_spine[0][1] - axis[1])
                    spine = (anchor, *external_spine)
                    tip = spine[-1]
                    union = root | band
                    offsets = tuple(sorted((p[0] - tip[0], p[1] - tip[1]) for p in sections[-1]))
                    candidate = "geometry.external_cardinal_band:" + stable_digest((ref, axis, root_positions, tuple(sorted(band))))
                    rows[candidate] = FrozenMap({**metadata,
                        "candidate_ref": candidate, "entity_ref": ref,
                        "geometry_is_external_cardinal_band": True,
                        "occupied_positions": tuple(sorted(union)),
                        "root_to_tip_positions": spine, "root_footprint_positions": tuple(sorted(root)),
                        "rod_footprint_positions": tuple(sorted(band)), "axis_direction": axis,
                        "root_candidate_position": spine[0], "tip_candidate_position": tip,
                        "axis_run_length": depth, "off_axis_cell_count": len(root),
                        "root_neighbor_count": sum((spine[0][0] + dr, spine[0][1] + dc) in union
                            for dr, dc in ((-1, 0), (0, -1), (0, 1), (1, 0))),
                        "tip_neighbor_count": sum((tip[0] + dr, tip[1] + dc) in union
                            for dr, dc in ((-1, 0), (0, -1), (0, 1), (1, 0))),
                        "band_component_refs": tuple(sorted(component_ref for component_ref, _ in members)),
                        "root_band_contact_pairs": contacts, "band_cross_section_width": hi - lo + 1,
                        "rod_mask_cell_count": len(band), "rod_cross_section_offsets": offsets,
                        "band_constant_cross_section": True,
                        "axis_spine_representation_ref": "representation.root_contact_anchor_and_cross_section_representatives",
                        "orientation_is_hypothesis": True})
    return tuple(rows[key] for key in sorted(rows))


def project_piercing_scene(request: PiercingSceneProjectionInput) -> PiercingSceneProjectionMeasurements:
    missing: set[Ref] = set()
    ambiguous: set[Ref] = set()
    control_rows = []
    target_rows = []
    command_rows = []
    configurations = []
    effects = []
    geometry_packets = request.interaction_measurements.get("parent_influence_geometry_by_action", {})
    geometry_packets = geometry_packets if isinstance(geometry_packets, Mapping) else {}
    components = () if request.frame is None else detect_components(ComponentExtractionInput(frame=request.frame, connectivity=4)).components
    components_by_ref = {c.component_id: c for c in components}
    geometry_masks = set()
    target_by_ref = {}
    for action_ref, raw in sorted(geometry_packets.items()):
        geometry = raw if isinstance(raw, InfluenceEnvelopeInput) else InfluenceEnvelopeInput.model_validate(raw)
        if geometry.frame_ref != request.frame_ref:
            missing.add("premise.current_cross_axis_geometry")
            continue
        visible = tuple(sorted(set(geometry.visible_control_positions) | set(geometry.collinear_control_positions)))
        geometry_masks.update(visible)
        control_rows.extend(_shape_rows(f"geometry.control:{geometry.tool_signature_ref or geometry.raster_digest}", visible,
            {"frame_ref": request.frame_ref, "tool_signature_ref": geometry.tool_signature_ref, "mask_scope_ref": "geometry.visible_fragments_only", "action_ref": str(action_ref)}))
        identities = dict(geometry.region_identity_pairs)
        for region in geometry.required_regions:
            first = region.positions[0] if region.positions else None
            inside = request.frame is not None and first is not None and 0 <= first[0] < request.frame.height and 0 <= first[1] < request.frame.width
            palette = request.frame.rows[first[0]][first[1]] if inside else None
            target_by_ref[region.region_ref] = FrozenMap({"current_region_ref": region.region_ref,
                "stable_part_ref": identities.get(region.region_ref), "occupied_positions": region.positions,
                "palette_value": palette,
                "frame_ref": request.frame_ref, "axis_coincident": region.region_ref in {r.region_ref for r in geometry.axis_coincident_regions}})
        command_rows.append(FrozenMap({"action_ref": str(action_ref), "measured_delta": geometry.translation_delta,
            "axis_direction": geometry.axis_direction, "effect_kind_unresolved": True,
            "missing_premise_ref": "premise.observed_root_translation_versus_extent"}))
    # Connected masks touching the candidate line are alternatives; same color is not a carrier join.
    for component in components:
        if set(component.pixels).intersection(geometry_masks):
            control_rows.extend(_shape_rows(component.component_id, component.pixels,
                {"frame_ref": request.frame_ref, "palette_value": component.value, "mask_scope_ref": "geometry.observed_connected_component"}))
    horizontal_refs = tuple(request.interaction_measurements.get("cross_axis_horizontal_member_refs", ()))
    horizontal_values = tuple(request.interaction_measurements.get("cross_axis_horizontal_member_values", ()))
    for ordinal, ref in enumerate(horizontal_refs):
        component = components_by_ref.get(ref)
        target_rows.append(FrozenMap({"current_region_ref": ref, "measured_family_ref": "geometry.shared_horizontal_family",
            "measured_ordinal": ordinal, "palette_value": horizontal_values[ordinal] if ordinal < len(horizontal_values) else None,
            "occupied_positions": component.pixels if component else (), "frame_ref": request.frame_ref,
            "member_role_unresolved": True}))
    target_rows.extend(target_by_ref[ref] for ref in sorted(target_by_ref))
    pieces = []
    missing_pieces = []
    for fact in request.canonical_target_facts:
        scope_match = _scope_matches(fact, request.current_scope)
        if scope_match is False or fact.get("frame_ref", request.frame_ref) != request.frame_ref:
            missing.add("premise.current_target_pose")
            continue
        if scope_match is None and fact.get("frame_ref") != request.frame_ref:
            missing.add("premise.current_target_scope_or_frame_join")
            continue
        piece_ref, type_ref = fact.get("piece_ref"), fact.get("type_ref")
        occupied = fact.get("occupied_positions")
        if not piece_ref or not type_ref or occupied is None or "support_refs" not in fact:
            if piece_ref:
                missing_pieces.append(str(piece_ref))
            missing.add("premise.declared_piece_identity_type_pose_and_support_classification")
            continue
        pieces.append(PiercingPieceState(piece_ref=str(piece_ref), type_ref=str(type_ref), occupied_positions=_positions(occupied), support_refs=tuple(fact.get("support_refs", ()))))
    for fact in request.canonical_control_facts:
        scope_match = _scope_matches(fact, request.current_scope)
        frame_matches = fact.get("frame_ref", request.frame_ref) == request.frame_ref
        positions = fact.get("occupied_positions")
        if positions is not None and frame_matches:
            control_rows.extend(_shape_rows(str(fact.get("entity_ref") or fact.get("rod_ref") or fact.get("association_ref") or "geometry.unbound_control"), _positions(positions),
                {"frame_ref": request.frame_ref, "scope_matches": scope_match, "association_ref": fact.get("association_ref"), "normalized_valued_pixels": fact.get("normalized_valued_pixels")}))
            control_rows.extend(_external_cardinal_band_rows(
                str(fact.get("entity_ref") or fact.get("rod_ref") or fact.get("association_ref") or "geometry.unbound_control"),
                _positions(fact.get("root_footprint_positions") or positions), components,
                {"frame_ref": request.frame_ref, "scope_matches": scope_match}))
        if scope_match is False or not frame_matches:
            missing.add("premise.current_declared_control_pose")
            continue
        if scope_match is None and fact.get("frame_ref") != request.frame_ref:
            missing.add("premise.current_control_scope_or_frame_join")
            continue
        rod_ref, root_ref = fact.get("rod_ref"), fact.get("root_ref")
        ordered = fact.get("root_to_tip_positions")
        full = fact.get("root_footprint_positions")
        if full is None and positions is not None and ordered is not None:
            full = tuple(sorted(set(_positions(positions)) - set(_positions(ordered))))
        if not rod_ref or not root_ref or not ordered or full is None:
            missing.add("premise.declared_root_rod_and_fullmask_partition")
            if fact.get("normalized_valued_pixels") and positions is None:
                missing.add("premise.current_pose_for_intrinsic_control_shape")
            continue
        rod = PiercingRodState(rod_ref=str(rod_ref), root_ref=str(root_ref), root_to_tip_positions=_positions(ordered),
            rod_footprint_positions=None if fact.get("rod_footprint_positions") is None else _positions(fact["rod_footprint_positions"]))
        configurations.append(PiercingConfiguration(configuration_ref="configuration.scene_projection:" + stable_digest((request.frame_ref, rod_ref, root_ref, ordered)),
            rods=(rod,), pieces=tuple(pieces), obstacles=request.source_obstacles, domain_positions=request.source_domain_positions,
            domain_boundary_is_known=request.source_domain_boundary_is_known,
            root_footprints=((str(root_ref), _positions(full)),), root_admissible_positions=request.source_root_admissible_positions,
            movable_piece_refs=request.source_movable_piece_refs, possible_support_pairs=request.source_possible_support_pairs,
            missing_piece_refs=tuple(sorted(set(missing_pieces))), frame_ref=request.frame_ref, scope=request.current_scope, provenance=request.provenance))
    if configurations:
        declared_rods = {}
        root_masks = {}
        contradictory = False
        for candidate in configurations:
            for rod in candidate.rods:
                if rod.rod_ref in declared_rods and declared_rods[rod.rod_ref] != rod:
                    ambiguous.add(rod.rod_ref)
                    contradictory = True
                declared_rods[rod.rod_ref] = rod
            for root_ref, positions in candidate.root_footprints:
                root_masks.setdefault(root_ref, set()).update(positions)
        if contradictory:
            configurations = []
            missing.add("premise.unambiguous_declared_rod_pose")
        else:
            configurations = [configurations[0].model_copy(update={
                "configuration_ref": "configuration.scene_projection:" + stable_digest((request.frame_ref, tuple(sorted(declared_rods)))),
                "rods": tuple(r for _, r in sorted(declared_rods.items())),
                "root_footprints": tuple((ref, tuple(sorted(mask))) for ref, mask in sorted(root_masks.items())),
            })]
    if not configurations:
        missing.add("premise.source_qualified_rooted_tool_candidate")
    if request.source_domain_positions is None:
        missing.add("premise.source_physical_domain")
    for fact in request.canonical_effect_facts:
        action_ref, effect_ref, rod_ref = fact.get("action_ref"), fact.get("effect_ref"), fact.get("rod_ref")
        axis, translation, extent = fact.get("axis_direction"), fact.get("root_translation"), fact.get("extent_delta")
        evidence = tuple(fact.get("evidence_refs", ()))
        command_rows.append(fact)
        if not action_ref or not effect_ref or not rod_ref or axis is None or translation is None or extent is None or not evidence:
            missing.add("premise.observed_bound_command_effect")
            continue
        effects.append(PiercingCommandEffect(effect_ref=str(effect_ref), action_ref=str(action_ref), rod_ref=str(rod_ref),
            action_data=FrozenMap(fact.get("action_data", {})), axis_direction=tuple(axis), root_translation=tuple(translation),
            extent_delta=int(extent), resource_cost=fact.get("resource_cost"), evidence_refs=evidence,
            coordinate_scope_ref=fact.get("coordinate_scope_ref", "coordinate.world"), source_profile_refs=tuple(fact.get("source_profile_refs", ())),
            extent_cross_section_offsets=None if fact.get("extent_cross_section_offsets") is None else _positions(fact["extent_cross_section_offsets"])))
    rows_by_ref = {}
    for row in control_rows:
        rows_by_ref.setdefault(row["candidate_ref"], row)
    for ref in sorted({row["entity_ref"] for row in control_rows}):
        if sum(row["entity_ref"] == ref for _, row in sorted(rows_by_ref.items())) > 1:
            ambiguous.add(ref)
    if not effects:
        missing.add("premise.observed_command_effects")
    return PiercingSceneProjectionMeasurements(configuration_candidates=tuple(configurations), command_effect_candidates=tuple(effects),
        control_geometry_rows=tuple(row for _, row in sorted(rows_by_ref.items())), target_rows=tuple(target_rows), command_geometry_rows=tuple(command_rows),
        missing_premise_refs=tuple(sorted(missing)), ambiguous_refs=tuple(sorted(ambiguous)), frame_ref=request.frame_ref,
        current_scope=request.current_scope, provenance=request.provenance)


def measure_piercing_command_geometry(request: PiercingCommandGeometryInput) -> PiercingCommandGeometryMeasurements:
    missing: set[Ref] = set()
    rows = []
    effects = []
    translations = []
    scene_conditioned = request.coordinate_scope_ref == "coordinate.scene_conditioned"
    corrected = scene_conditioned or request.viewport_translation == (0, 0) or request.viewport_translation is not None and bool(request.viewport_evidence_refs)
    if not corrected:
        missing.add("premise.measured_viewport_correction")
    offset = (0, 0) if scene_conditioned else request.viewport_translation or (0, 0)
    before = tuple(sorted(set(request.before_positions)))
    after = tuple(sorted(set(_translated(request.after_positions, (-offset[0], -offset[1])))))
    if before and after and corrected:
        delta = (after[0][0] - before[0][0], after[0][1] - before[0][1])
        shape_translation = set(_translated(before, delta)) == set(after)
        if request.before_valued_pixels and request.after_valued_pixels:
            shape_translation = shape_translation and {(r + delta[0], c + delta[1], v) for r, c, v in request.before_valued_pixels} == {(r - offset[0], c - offset[1], v) for r, c, v in request.after_valued_pixels}
        if shape_translation:
            translations.append(delta)
            rows.append(FrozenMap({"action_ref": request.action_ref, "entity_ref": request.entity_ref,
                "root_translation_candidate": delta, "extent_delta_candidate": 0, "fullmask_translation_exact": True,
                "coordinate_scope_ref": request.coordinate_scope_ref}))
        # Exact line growth/removal from either stable end remains an orientation alternative.
        if before != after:
            for axis in ((0, 1), (1, 0), (0, -1), (-1, 0)):
                key = lambda p: p[0] * axis[0] + p[1] * axis[1]
                old = tuple(sorted(before, key=key)); new = tuple(sorted(after, key=key))
                contiguous = all((b[0]-a[0], b[1]-a[1]) == axis for points in (old, new) for a, b in zip(points, points[1:]))
                if contiguous and old[0] == new[0] and (old == new[:len(old)] or new == old[:len(new)]):
                    rows.append(FrozenMap({"action_ref": request.action_ref, "entity_ref": request.entity_ref,
                        "axis_direction": axis, "root_candidate_position": old[0], "root_translation_candidate": (0, 0),
                        "extent_delta_candidate": len(new)-len(old), "single_axis_extent_exact": True, "coordinate_scope_ref": request.coordinate_scope_ref}))
            # The full handle can remain unchanged while just one axial run grows.
            for run in _maximal_lines(before):
                for old in (run, tuple(reversed(run))):
                    axis = (old[1][0] - old[0][0], old[1][1] - old[0][1])
                    fixed_coordinate = 0 if axis[0] == 0 else 1
                    new = tuple(sorted((p for p in after if p[fixed_coordinate] == old[0][fixed_coordinate]), key=lambda p: p[0]*axis[0]+p[1]*axis[1]))
                    if not new or new == old:
                        continue
                    contiguous = all((b[0]-a[0], b[1]-a[1]) == axis for a, b in zip(new, new[1:]))
                    unchanged_body = set(before) - set(old) == set(after) - set(new)
                    if contiguous and unchanged_body and old[0] == new[0] and (old == new[:len(old)] or new == old[:len(new)]):
                        rows.append(FrozenMap({"action_ref": request.action_ref, "entity_ref": request.entity_ref,
                            "axis_direction": axis, "root_candidate_position": old[0], "root_translation_candidate": (0, 0),
                            "extent_delta_candidate": len(new)-len(old), "fullmask_axial_extent_exact": True,
                            "unchanged_off_axis_positions": tuple(sorted(set(before)-set(old))),
                            "before_root_to_tip_positions": old, "after_root_to_tip_positions": new}))
    if request.rod_ref and request.axis_direction and request.before_root_position is not None and request.after_root_position is not None and corrected:
        root_after = (request.after_root_position[0] - offset[0], request.after_root_position[1] - offset[1])
        root_delta = (root_after[0] - request.before_root_position[0], root_after[1] - request.before_root_position[1])
        old_line = request.before_root_to_tip_positions
        new_line = _translated(request.after_root_to_tip_positions, (-offset[0], -offset[1]))
        translated_line = _translated(old_line, root_delta)
        axis = request.axis_direction
        axial = old_line and new_line and all((b[0]-a[0], b[1]-a[1]) == axis for points in (old_line, new_line) for a, b in zip(points, points[1:]))
        common_prefix = translated_line == new_line[:len(translated_line)] or new_line == translated_line[:len(new_line)]
        if axial and common_prefix and translated_line[0] == new_line[0] and request.evidence_refs:
            effects.append(PiercingCommandEffect(effect_ref="effect.observed_geometry:" + stable_digest((request.action_ref, request.entity_ref, request.before_frame_ref, request.after_frame_ref)),
                action_ref=request.action_ref, action_data=request.action_data, rod_ref=request.rod_ref, root_translation=root_delta,
                extent_delta=len(new_line)-len(old_line), axis_direction=axis, resource_cost=request.resource_cost, evidence_refs=request.evidence_refs,
                coordinate_scope_ref=request.coordinate_scope_ref))
        else:
            missing.add("premise.exact_root_and_axial_extent_correspondence")
    else:
        missing.add("premise.source_bound_rod_root_axis")
    rows = [FrozenMap({**dict(row), "coordinate_scope_ref": request.coordinate_scope_ref}) for row in rows]
    return PiercingCommandGeometryMeasurements(candidate_rows=tuple(rows), command_effect_candidates=tuple(effects), translation_candidates=tuple(translations),
        missing_premise_refs=tuple(sorted(missing)), frame_refs=(request.before_frame_ref, request.after_frame_ref), evidence_refs=request.evidence_refs)
