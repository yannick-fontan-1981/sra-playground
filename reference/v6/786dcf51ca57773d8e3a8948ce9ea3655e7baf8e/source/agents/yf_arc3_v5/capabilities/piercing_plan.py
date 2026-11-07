"""Pure, model-conditioned raster mechanics and exhaustive bounded plan enumeration.

Models, commanded laws, geometry, support premises and bounds are supplied by
Source. These measurements neither classify support knowledge nor select a plan.
"""

from __future__ import annotations

from collections import deque

from agents.yf_arc3_v5.capabilities.contracts import (
    PiercingCommandEffect, PiercingConditionalModel, PiercingConfiguration,
    PiercingGoalInput, PiercingGoalMeasurements, PiercingIntersectionInput,
    PiercingModelComparison, PiercingObservationInput, PiercingObservationMeasurements,
    PiercingPlanCandidate, PiercingPlanSearchInput, PiercingPlanSearchMeasurements,
    PiercingReconciliationInput, PiercingReconciliationMeasurements,
    PiercingRelationObservation, PiercingRolloutBranch, PiercingRolloutInput,
    PiercingRolloutMeasurements, PiercingStateDifference, PiercingStepBranch,
    PiercingStepInput, PiercingStepMeasurements, Position,
    PiercingSearchStage, PiercingStageMeasurements, PiercingStageWitness, PiercingStageFrontier,
    PiercingSearchPhysicalState, PiercingSearchTraceNode, PiercingSearchWitnessRecord,
    PiercingSearchFrontierRecord, PiercingSearchContextRecord, PiercingSearchContinuation,
)
from agents.yf_arc3_v5.capabilities.piercing_rooted_order import (
    measure_piercing_intersections,
)
from agents.yf_arc3_v5.logos.types import FrozenMap, Ref, stable_digest


def _translated(positions: tuple[Position, ...], delta: Position) -> tuple[Position, ...]:
    return tuple((r + delta[0], c + delta[1]) for r, c in positions)


def _rod_mask(rod) -> tuple[Position, ...]:
    return rod.root_to_tip_positions if rod.rod_footprint_positions is None else rod.rod_footprint_positions


def _translate_rod(rod, delta: Position):
    return rod.model_copy(update={"root_to_tip_positions": _translated(rod.root_to_tip_positions, delta),
        "rod_footprint_positions": None if rod.rod_footprint_positions is None else _translated(rod.rod_footprint_positions, delta)})


def _project(position: Position, axis: Position) -> int:
    return position[0] * axis[0] + position[1] * axis[1]


def _pairs(configuration: PiercingConfiguration) -> tuple[tuple[Ref, Ref], ...]:
    return tuple(sorted((rod_ref, p.piece_ref) for p in configuration.pieces for rod_ref in p.support_refs))


def _cost(effects: tuple[PiercingCommandEffect, ...]) -> tuple[int | None, int | None]:
    lower = sum(e.resource_cost or 0 for e in effects)
    return lower, lower if all(e.resource_cost is not None for e in effects) else None


def _physical_key(configuration: PiercingConfiguration) -> tuple:
    """No generated identity, frame or provenance can turn a physical cycle into novelty."""
    return (
        tuple(sorted((r.rod_ref, r.root_ref, r.root_to_tip_positions, _rod_mask(r)) for r in configuration.rods)),
        tuple(sorted((p.piece_ref, p.type_ref, tuple(sorted(p.occupied_positions)), tuple(sorted(p.support_refs))) for p in configuration.pieces)),
        tuple(sorted((ref, tuple(sorted(pos))) for ref, pos in configuration.root_footprints)),
        tuple(sorted(configuration.possible_support_pairs)),
        tuple(sorted(configuration.hypothetical_support_pairs)),
        tuple(sorted(configuration.entry_pending_pairs)), tuple(sorted(configuration.entry_stopped_pairs)),
    )


def _simulate_model(request: PiercingStepInput, model: PiercingConditionalModel) -> PiercingStepBranch:
    effect = request.effect
    current = request.configuration.model_copy(update={"is_predicted_configuration": True})
    if effect.coordinate_scope_ref == "coordinate.scene_conditioned":
        current = current.model_copy(update={"coordinate_scope_ref": effect.coordinate_scope_ref})
    rods = {r.rod_ref: r for r in current.rods}
    rod = rods.get(effect.rod_ref)
    n = max(abs(effect.root_translation[0]), abs(effect.root_translation[1]), abs(effect.extent_delta))
    contacts: set[Ref] = set()
    blockers: set[Ref] = set()
    pushed: set[Ref] = set()
    stopped: set[Ref] = set()
    traversed: set[Ref] = set()
    pierced: set[Ref] = set()
    unresolved = set(current.missing_piece_refs)
    missing: set[Ref] = set()
    intermediate: list[PiercingConfiguration] = []
    if rod is None:
        missing.add("premise.commanded_rod_pose")
        unresolved.add(effect.rod_ref)
    elif any((b[0] - a[0], b[1] - a[1]) != effect.axis_direction for a, b in zip(rod.root_to_tip_positions, rod.root_to_tip_positions[1:])):
        unresolved.add(effect.rod_ref)
        missing.add("premise.ordered_axial_rod_pose")
    if rod is not None and len(rod.root_to_tip_positions) + max(0, effect.extent_delta) > 512:
        unresolved.add(effect.rod_ref)
        missing.add("bound.rod_position_contract")
    if current.domain_positions is None and request.require_finite_domain:
        missing.add("premise.finite_motion_domain")
    if rod is not None and rod.root_ref not in dict(current.root_footprints):
        missing.add("premise.full_root_footprint")
    if current.possible_support_pairs:
        assignments = {(r, p): mode for r, p, mode in model.support_assignments}
        possible_pairs = set(current.possible_support_pairs)
        explicit_incomplete = bool(assignments) and not possible_pairs <= set(assignments)
        if explicit_incomplete or not assignments and model.possible_support_mode is None:
            unresolved.update(p for _, p in current.possible_support_pairs)
            missing.add("premise.complete_possible_support_assignment" if explicit_incomplete else "premise.supplied_possible_support_hypothesis")
        else:
            available_pieces = {p.piece_ref for p in current.pieces}
            for rod_ref, piece_ref in sorted(possible_pairs):
                if rod_ref not in rods or piece_ref not in available_pieces:
                    unresolved.add(piece_ref)
                    missing.add("premise.possible_support_body_pose")
            measured_support_assignment_states = tuple(p.model_copy(update={"support_refs": tuple(sorted(set(p.support_refs) | {
                r for r, member in possible_pairs if member == p.piece_ref and (assignments[(r, member)] if assignments else model.possible_support_mode) == "carried"
            }))}) for p in current.pieces)
            current = current.model_copy(update={"pieces": measured_support_assignment_states, "possible_support_pairs": (),
                "hypothetical_support_pairs": tuple(sorted(set(current.hypothetical_support_pairs) | possible_pairs))})
    for piece in current.pieces:
        if set(piece.support_refs) - set(rods):
            unresolved.add(piece.piece_ref)
            missing.add("premise.support_rod_pose")
    pending = set(current.entry_pending_pairs)
    stopped_entries = set(current.entry_stopped_pairs)
    domain = None if current.domain_positions is None else set(current.domain_positions)
    obstacles = {o.obstacle_ref: set(o.occupied_positions) for o in current.obstacles}
    moving_rod_refs = {r.rod_ref for r in current.rods if rod is not None and r.root_ref == rod.root_ref}
    for other in current.rods:
        if other.rod_ref not in moving_rod_refs:
            obstacles[other.rod_ref] = set(_rod_mask(other))
    for root_ref, footprint in current.root_footprints:
        if rod is not None and root_ref != rod.root_ref:
            obstacles[root_ref] = set(footprint)
    root_domains = {ref: set(pos) for ref, pos in current.root_admissible_positions}
    previous_delta = (0, 0)
    previous_extent = 0
    executed = 0

    def outside(positions: tuple[Position, ...]) -> tuple[Ref, ...]:
        result = [ref for ref, mask in sorted(obstacles.items()) if mask.intersection(positions)]
        if domain is not None and any(pos not in domain for pos in positions):
            if current.domain_boundary_is_known:
                result.append("boundary.supplied_domain")
            else:
                unresolved.add("boundary.unconfirmed_domain")
                missing.add("premise.unknown_domain_exit_outcome")
        return tuple(result)

    for index in range(1, min(n, request.max_microsteps) + 1):
        if rod is None or unresolved:
            break
        cumulative = tuple((abs(value) * index // n) * (1 if value >= 0 else -1) for value in effect.root_translation)
        delta = (cumulative[0] - previous_delta[0], cumulative[1] - previous_delta[1])
        cumulative_extent = (abs(effect.extent_delta) * index // n) * (1 if effect.extent_delta >= 0 else -1)
        extent = cumulative_extent - previous_extent
        previous_delta, previous_extent = cumulative, cumulative_extent
        old_rod = rod
        positions = _translated(rod.root_to_tip_positions, delta)
        material = _translated(_rod_mask(rod), delta)
        if extent > 0:
            tip = positions[-1]
            new_tip = (tip[0] + effect.axis_direction[0], tip[1] + effect.axis_direction[1])
            offsets = effect.extent_cross_section_offsets
            if offsets is None and set(_rod_mask(rod)) - set(rod.root_to_tip_positions):
                unresolved.add(rod.rod_ref); missing.add("premise.source_extent_cross_section")
                break
            offsets = ((0, 0),) if offsets is None else offsets
            positions += (new_tip,)
            material = tuple(sorted(set(material) | {(new_tip[0] + p[0], new_tip[1] + p[1]) for p in offsets}))
        elif extent < 0:
            if len(positions) <= 1:
                blockers.add(rod.root_ref)
                break
            positions = positions[:-1]
            tip_projection = _project(positions[-1], effect.axis_direction)
            material = tuple(p for p in material if _project(p, effect.axis_direction) <= tip_projection)
        explicit_material = rod.rod_footprint_positions is not None or effect.extent_cross_section_offsets is not None
        candidate_rod = rod.model_copy(update={"root_to_tip_positions": positions,
            "rod_footprint_positions": material if explicit_material else None})
        candidate_rods = {ref: _translate_rod(r, delta) if ref in moving_rod_refs else r for ref, r in sorted(rods.items())}
        candidate_rods[rod.rod_ref] = candidate_rod
        roots = dict(current.root_footprints)
        roots[rod.root_ref] = _translated(roots.get(rod.root_ref, ()), delta)
        tool_positions = tuple(p for ref, r in sorted(candidate_rods.items()) if ref in moving_rod_refs for p in _rod_mask(r)) + roots[rod.root_ref]
        swept_tool = set(tool_positions)
        if delta[0] and delta[1]:
            old_positions = tuple(p for ref, r in sorted(rods.items()) if ref in moving_rod_refs for p in _rod_mask(r)) + dict(current.root_footprints).get(rod.root_ref, ())
            swept_tool.update(_translated(old_positions, (delta[0], 0)))
            swept_tool.update(_translated(old_positions, (0, delta[1])))
        obstacle_hits = outside(tuple(sorted(swept_tool)))
        root_domain = root_domains.get(rod.root_ref)
        if root_domain is not None and any(p not in root_domain for p in roots[rod.root_ref]):
            obstacle_hits += ("boundary.supplied_root_domain",)
        if obstacle_hits:
            blockers.update(obstacle_hits)
            break
        pieces = {p.piece_ref: p for p in current.pieces}
        candidate_pieces = dict(pieces)
        attached = {p.piece_ref for p in current.pieces if moving_rod_refs.intersection(p.support_refs)}
        moving_masks: dict[Ref, tuple[Position, ...]] = {}
        reverse_stopped: set[Ref] = set()
        withdrawing_delta = (-effect.axis_direction[0], -effect.axis_direction[1])

        def movable_chain(ref: Ref, displacement: Position, visiting: set[Ref]) -> bool:
            if ref in visiting:
                return True
            body = pieces[ref]
            if ref not in current.movable_piece_refs or body.support_refs:
                return False
            proposed = _translated(body.occupied_positions, displacement)
            if outside(proposed):
                return False
            visiting.add(ref)
            for other, other_body in sorted(pieces.items()):
                if other != ref and other not in attached and set(proposed).intersection(other_body.occupied_positions):
                    if not movable_chain(other, displacement, visiting):
                        visiting.remove(ref)
                        return False
            visiting.remove(ref)
            return True

        for ref in sorted(attached):
            piece = pieces[ref]
            carry_delta = delta
            if delta != (0, 0):
                if model.carry_on_root_translation is None:
                    unresolved.add(ref); missing.add("premise.carry_on_root_translation")
                    continue
                if model.carry_on_root_translation is False:
                    carry_delta = (0, 0)
            if extent < 0 and rod.rod_ref in piece.support_refs:
                if model.retain_on_retraction is None or model.withdraw_requires_reverse_stop is None:
                    unresolved.add(ref); missing.add("premise.conditional_withdrawal")
                    continue
                if model.retain_on_retraction:
                    carry_delta = (carry_delta[0] + withdrawing_delta[0], carry_delta[1] + withdrawing_delta[1])
                    proposed = _translated(piece.occupied_positions, carry_delta)
                    fixed_hits = outside(proposed)
                    other_hits = any(set(proposed).intersection(p.occupied_positions) and not movable_chain(other, carry_delta, set()) for other, p in sorted(pieces.items()) if other != ref and other not in attached)
                    if fixed_hits or other_hits:
                        if model.withdraw_requires_reverse_stop:
                            carry_delta = delta
                            reverse_stopped.add(ref)
                            stopped.add(ref)
                        else:
                            blockers.update(fixed_hits or (ref,))
                elif model.withdraw_requires_reverse_stop:
                    unresolved.add(ref); missing.add("premise.retention_with_reverse_stop")
            if carry_delta != (0, 0) and set(piece.support_refs) - moving_rod_refs:
                unresolved.add(ref); missing.add("premise.multiple_support_motion_compatibility")
            new_positions = _translated(piece.occupied_positions, carry_delta)
            if carry_delta != (0, 0):
                moving_masks[ref] = new_positions
            candidate_pieces[ref] = piece.model_copy(update={"occupied_positions": new_positions})
        if unresolved or blockers:
            break

        # Push closure uses every mover (handle, protrusion and known load), not just its tip.
        old_tool = {p for ref, r in sorted(rods.items()) if ref in moving_rod_refs for p in _rod_mask(r)} | set(dict(current.root_footprints).get(rod.root_ref, ()))
        entered_tool = set(tool_positions) - old_tool
        moving_union = set(entered_tool) | (swept_tool - old_tool)
        if delta != (0, 0):
            moving_union.update(old_tool)
        for _, mask in sorted(moving_masks.items()):
            moving_union.update(mask)
        free_contacts = {ref for ref, p in sorted(pieces.items()) if ref not in attached and moving_union.intersection(p.occupied_positions)}
        contacts.update(free_contacts)
        motion_delta = delta if delta != (0, 0) else effect.axis_direction if extent > 0 else withdrawing_delta
        push_set: set[Ref] = set()
        penetrate: set[Ref] = set()
        push_blocked: set[Ref] = set()

        def collect_push(ref: Ref, visiting: set[Ref]) -> bool:
            if ref in visiting or ref in push_set:
                return True
            p = pieces[ref]
            if ref not in current.movable_piece_refs or p.support_refs:
                return False
            proposed = _translated(p.occupied_positions, motion_delta)
            if outside(proposed):
                return False
            visiting.add(ref)
            for other, other_piece in sorted(pieces.items()):
                if other == ref:
                    continue
                if set(proposed).intersection(other_piece.occupied_positions):
                    if other in attached or not collect_push(other, visiting):
                        visiting.remove(ref)
                        return False
            visiting.remove(ref)
            push_set.add(ref)
            return True

        for ref in sorted(free_contacts):
            piece = pieces[ref]
            axial_entry = extent > 0 and delta == (0, 0) and any(p in piece.occupied_positions
                and _project(p, effect.axis_direction) == _project(positions[-1], effect.axis_direction) for p in material)
            old_tip = _project(old_rod.root_to_tip_positions[-1], effect.axis_direction)
            face = min(_project(p, effect.axis_direction) for p in piece.occupied_positions)
            axial_entry = axial_entry and (old_tip <= face or (rod.rod_ref, ref) in pending)
            if axial_entry and model.entry_enabled is True and model.entry_requires_stop is False:
                penetrate.add(ref)
            else:
                if model.push_enabled is None:
                    unresolved.add(ref); missing.add("premise.push_enabled")
                    continue
                prior_push_set = set(push_set)
                physically_movable = collect_push(ref, set())
                can_push = model.push_enabled and physically_movable
                if not can_push:
                    push_set = prior_push_set
                    if not physically_movable:
                        stopped.add(ref)
                    push_blocked.add(ref)
                    if axial_entry:
                        if model.entry_enabled is None or model.entry_requires_stop is None:
                            unresolved.add(ref); missing.add("premise.conditional_axial_entry")
                        elif model.entry_enabled and (not model.entry_requires_stop or not physically_movable):
                            penetrate.add(ref)
                            if not physically_movable:
                                stopped_entries.add((rod.rod_ref, ref))
                        else:
                            blockers.add(ref)
                    else:
                        blockers.add(ref)
        if unresolved or blockers:
            break
        for ref in sorted(push_set - penetrate):
            candidate_pieces[ref] = pieces[ref].model_copy(update={"occupied_positions": _translated(pieces[ref].occupied_positions, motion_delta)})
        for ref in sorted(penetrate):
            pending.add((rod.rod_ref, ref))
        newly_traversed: set[Ref] = set()
        newly_pierced: set[Ref] = set()
        for rod_ref, ref in sorted(pending):
            if rod_ref != rod.rod_ref or ref not in candidate_pieces:
                continue
            piece = candidate_pieces[ref]
            far_face = max(_project(p, effect.axis_direction) for p in piece.occupied_positions)
            complete = _project(positions[-1], effect.axis_direction) >= far_face and bool(set(material).intersection(piece.occupied_positions))
            if complete:
                newly_traversed.add(ref)
                if model.entry_attaches is None:
                    unresolved.add(ref); missing.add("premise.entry_attaches")
                elif model.entry_attaches:
                    candidate_pieces[ref] = piece.model_copy(update={"support_refs": tuple(sorted(set(piece.support_refs) | {rod.rod_ref}))})
                    newly_pierced.add(ref)
                pending.discard((rod_ref, ref))
        if unresolved:
            break
        for ref in sorted(attached):
            piece = candidate_pieces[ref]
            if rod.rod_ref in piece.support_refs and not set(material).intersection(piece.occupied_positions):
                release_permitted = extent < 0 and (model.retain_on_retraction is False and model.withdraw_requires_reverse_stop is False or ref in reverse_stopped)
                if release_permitted:
                    candidate_pieces[ref] = piece.model_copy(update={"support_refs": tuple(s for s in piece.support_refs if s != rod.rod_ref)})
                else:
                    unresolved.add(ref); missing.add("premise.support_exit_law")
        if unresolved:
            break
        for ref, mask in sorted(moving_masks.items()):
            hits = outside(candidate_pieces[ref].occupied_positions)
            if hits:
                blockers.update(hits)
        if blockers:
            break
        rods = candidate_rods
        rod = candidate_rod
        current = current.model_copy(update={
            "configuration_ref": "configuration:predicted:" + stable_digest({
                "before_configuration_ref": request.configuration.configuration_ref,
                "effect_ref": effect.effect_ref,
                "model_ref": model.model_ref,
                "microstep": index,
            }),
            "rods": tuple(r for _, r in sorted(rods.items())),
            "pieces": tuple(p for _, p in sorted(candidate_pieces.items())),
            "root_footprints": tuple(sorted(roots.items())),
            "entry_pending_pairs": tuple(sorted(pending)), "entry_stopped_pairs": tuple(sorted(stopped_entries)),
        })
        intermediate.append(current)
        pushed.update(push_set - penetrate)
        traversed.update(newly_traversed)
        pierced.update(newly_pierced)
        executed += 1
    if n > request.max_microsteps:
        missing.add("bound.max_microsteps")
    before_pairs = set(_pairs(request.configuration))
    after_pairs = set(_pairs(current))
    low, high = _cost((effect,))
    return PiercingStepBranch(
        model_ref=model.model_ref, configuration=current, intermediate_configurations=tuple(intermediate),
        contacted_piece_refs=tuple(sorted(contacts)), blocking_refs=tuple(sorted(blockers)),
        pushed_piece_refs=tuple(sorted(pushed)), stopped_piece_refs=tuple(sorted(stopped)),
        entry_traversal_piece_refs=tuple(sorted(traversed)), pierced_piece_refs=tuple(sorted(pierced)),
        retained_support_pairs=tuple(sorted(before_pairs & after_pairs)), released_support_pairs=tuple(sorted(before_pairs - after_pairs)),
        unresolved_refs=tuple(sorted(unresolved)), missing_premise_refs=tuple(sorted(missing)),
        hypothesis_coverage_gap_refs=("gap.mixed_possible_support_assignments_not_enumerated",) if len(current.hypothetical_support_pairs) > 1 and not set(current.hypothetical_support_pairs) <= {(r, p) for r, p, _ in model.support_assignments} else (),
        completed=not unresolved and not missing and n <= request.max_microsteps,
        truncated=n > request.max_microsteps, executed_microsteps=executed, requested_microsteps=n,
        require_finite_domain=request.require_finite_domain,
        action_ref=effect.action_ref, resource_cost_lower_bound=low, resource_cost_upper_bound=high,
    )


def simulate_piercing_step(request: PiercingStepInput) -> PiercingStepMeasurements:
    branches = tuple(_simulate_model(request, m) for m in sorted(request.models, key=lambda m: m.model_ref))
    return PiercingStepMeasurements(branches=branches, action_ref=request.effect.action_ref, model_refs=tuple(b.model_ref for b in branches), truncated=any(b.truncated for b in branches))


def simulate_piercing_rollout(request: PiercingRolloutInput) -> PiercingRolloutMeasurements:
    results = []
    for model in sorted(request.models, key=lambda m: m.model_ref):
        configuration = request.configuration
        steps = []
        for effect in request.effects:
            step = _simulate_model(PiercingStepInput(configuration=configuration, effect=effect, models=(model,), max_microsteps=request.max_microsteps, require_finite_domain=request.require_finite_domain), model)
            steps.append(step)
            configuration = step.configuration
            if not step.completed:
                break
        low, high = _cost(request.effects[:len(steps)])
        results.append(PiercingRolloutBranch(model_ref=model.model_ref, configuration=configuration,
            steps=tuple(steps), action_refs=tuple(s.action_ref for s in steps),
            completed=len(steps) == len(request.effects) and all(s.completed for s in steps),
            truncated=any(s.truncated for s in steps), unresolved_refs=tuple(sorted({ref for s in steps for ref in s.unresolved_refs})),
            missing_premise_refs=tuple(sorted({ref for s in steps for ref in s.missing_premise_refs})),
            resource_cost_lower_bound=low, resource_cost_upper_bound=high))
    return PiercingRolloutMeasurements(branches=tuple(results), model_refs=tuple(b.model_ref for b in results), truncated=any(b.truncated for b in results))


def measure_piercing_goal(request: PiercingGoalInput) -> PiercingGoalMeasurements:
    unresolved = tuple(sorted(set(request.configuration.missing_piece_refs) | {p for _, p in request.configuration.possible_support_pairs + request.configuration.hypothetical_support_pairs}))
    if not request.configuration.rods:
        return PiercingGoalMeasurements(requested_root_ref=request.requested_root_ref, requested_support_ref=None,
            ordered_piece_refs=(), measured_type_order=(), rooted_match=False, unresolved_piece_refs=unresolved,
            coordinate_scope_ref=request.configuration.coordinate_scope_ref,
            remaining_piece_refs=tuple(sorted(p.piece_ref for p in request.configuration.pieces)))
    measured = measure_piercing_intersections(PiercingIntersectionInput(rods=request.configuration.rods,
        pieces=request.configuration.pieces, requested_root_ref=request.requested_root_ref, requested_type_order=request.requested_type_order))
    return PiercingGoalMeasurements(requested_root_ref=request.requested_root_ref, requested_support_ref=measured.requested_support_ref,
        ordered_piece_refs=measured.requested_support_piece_refs, measured_type_order=measured.requested_support_type_order,
        rooted_match=measured.rooted_match and not unresolved and not request.configuration.is_predicted_configuration, unresolved_piece_refs=unresolved,
        predicted_rooted_match=measured.rooted_match and not request.configuration.missing_piece_refs and not request.configuration.possible_support_pairs,
        coordinate_scope_ref=request.configuration.coordinate_scope_ref,
        remaining_piece_refs=measured.remaining_unconstrained_piece_refs)


def _measure_stage(configuration: PiercingConfiguration, stage: PiercingSearchStage) -> PiercingStageMeasurements:
    bodies = {p.piece_ref: p for p in configuration.pieces}
    missing = set(stage.member_refs) - set(bodies)
    missing.update(set(stage.member_refs) & set(configuration.missing_piece_refs))
    if missing:
        return PiercingStageMeasurements(stage_ref=stage.stage_ref, satisfied=None, unresolved_refs=tuple(sorted(missing)))
    if stage.measurement_kind == "independent_orthogonal_lanes":
        rods = {r.rod_ref for r in configuration.rods if r.root_ref == stage.requested_root_ref}
        normal = (-stage.axis_direction[1], stage.axis_direction[0])
        unresolved = {p for r, p in configuration.possible_support_pairs if r in rods and p in stage.member_refs}
        lanes = []
        for ref in stage.member_refs:
            piece = bodies[ref]
            if rods.intersection(piece.support_refs):
                continue
            projections = tuple(pos[0] * normal[0] + pos[1] * normal[1] for pos in piece.occupied_positions)
            lanes.append((ref, min(projections) + max(projections)))
        return PiercingStageMeasurements(stage_ref=stage.stage_ref,
            satisfied=None if unresolved else len({coordinate for _, coordinate in lanes}) == len(lanes),
            member_lane_coordinates_twice=tuple(lanes), measured_piece_refs=tuple(ref for ref, _ in lanes), unresolved_refs=tuple(sorted(unresolved)))
    if stage.measurement_kind in ("tool_load_tip_clearance", "entry_configuration"):
        moving_rods = tuple(r for r in configuration.rods if r.root_ref == stage.requested_root_ref)
        moving_refs = {r.rod_ref for r in moving_rods}
        unknown_support = {piece for rod, piece in configuration.possible_support_pairs if rod in moving_refs}
        if not moving_rods or unknown_support:
            return PiercingStageMeasurements(stage_ref=stage.stage_ref, satisfied=None,
                unresolved_refs=tuple(sorted(unknown_support)))
        material = {pos for rod in moving_rods for pos in _rod_mask(rod)}
        material.update(pos for root, positions in configuration.root_footprints
            if root == stage.requested_root_ref for pos in positions)
        material.update(pos for p in configuration.pieces
            if moving_refs.intersection(p.support_refs) for pos in p.occupied_positions)
        if not material:
            return PiercingStageMeasurements(stage_ref=stage.stage_ref, satisfied=None)
        axial_limit = max(_project(pos, stage.axis_direction) for pos in material)
        remaining = tuple(bodies[ref] for ref in stage.member_refs
            if not moving_refs.intersection(bodies[ref].support_refs))
        clearances = tuple((p.piece_ref,
            min(_project(pos, stage.axis_direction) for pos in p.occupied_positions) - axial_limit)
            for p in remaining)
        prior = measure_piercing_goal(PiercingGoalInput(configuration=configuration,
            requested_root_ref=stage.requested_root_ref, requested_type_order=stage.prior_type_order))
        prior_preserved = (not stage.prior_type_order or
            prior.measured_type_order[:len(stage.prior_type_order)] == stage.prior_type_order)
        if stage.measurement_kind == "tool_load_tip_clearance":
            return PiercingStageMeasurements(stage_ref=stage.stage_ref,
                satisfied=prior_preserved and all(gap > 0 for _, gap in clearances),
                member_axial_clearance=clearances, moving_material_axial_limit=axial_limit)
        normal = (-stage.axis_direction[1], stage.axis_direction[0])
        rows = []
        for rod in moving_rods:
            rod_material = _rod_mask(rod)
            section_plane = max((_project(pos, stage.axis_direction) for pos in rod_material), default=None)
            section = ({_project(pos, normal) for pos in rod_material
                if _project(pos, stage.axis_direction) == section_plane} if rod_material else
                {_project((rod.root_to_tip_positions[-1][0] + off[0],
                           rod.root_to_tip_positions[-1][1] + off[1]), normal)
                    for off in stage.entry_cross_section_offsets or ()})
            for p in remaining:
                if p.type_ref != stage.target_type_ref:
                    continue
                near_plane = min(_project(pos, stage.axis_direction) for pos in p.occupied_positions)
                near_section = {_project(pos, normal) for pos in p.occupied_positions
                    if _project(pos, stage.axis_direction) == near_plane}
                rows.append(FrozenMap({"rod_ref": rod.rod_ref, "piece_ref": p.piece_ref,
                    "section_present": bool(section),
                    "section_inside_member_face": bool(section) and section <= near_section,
                    "section_intersects_member_face": bool(section.intersection(near_section)),
                    "tip_before_member_face": _project(rod.root_to_tip_positions[-1], stage.axis_direction) < near_plane,
                    "prior_prefix_preserved": prior_preserved}))
        return PiercingStageMeasurements(stage_ref=stage.stage_ref,
            satisfied=(None if any(not row["section_present"] for row in rows) else
                prior_preserved and any(row["section_intersects_member_face"] and
                row["tip_before_member_face"] for row in rows)),
            member_entry_geometry=tuple(rows), member_axial_clearance=clearances,
            moving_material_axial_limit=axial_limit)
    goal = measure_piercing_goal(PiercingGoalInput(configuration=configuration, requested_root_ref=stage.requested_root_ref, requested_type_order=stage.requested_type_order))
    # Every requested prefix is Source supplied. No next member is chosen here.
    prefix_match = (bool(stage.requested_type_order) and
        goal.measured_type_order[:len(stage.requested_type_order)] == stage.requested_type_order and
        not configuration.missing_piece_refs and not configuration.possible_support_pairs)
    satisfied = prefix_match if stage.measurement_kind == "rooted_order_prefixes" else goal.predicted_rooted_match
    return PiercingStageMeasurements(stage_ref=stage.stage_ref, satisfied=satisfied,
        measured_type_order=goal.measured_type_order,
        measured_piece_refs=goal.ordered_piece_refs[:len(stage.requested_type_order)] if stage.measurement_kind == "rooted_order_prefixes" else goal.ordered_piece_refs,
        unresolved_refs=tuple(sorted(set(goal.unresolved_piece_refs) - {p for _, p in configuration.hypothetical_support_pairs})))


def _initial_prefix_pairs(request: PiercingPlanSearchInput) -> set[tuple[Ref, Ref]]:
    goal = measure_piercing_goal(PiercingGoalInput(configuration=request.configuration,
        requested_root_ref=request.goal_requested_root_ref, requested_type_order=request.goal_requested_type_order))
    prefix = []
    for ref, measured, wanted in zip(goal.ordered_piece_refs, goal.measured_type_order, request.goal_requested_type_order):
        if measured != wanted:
            break
        if ref not in {p for _, p in request.configuration.possible_support_pairs + request.configuration.hypothetical_support_pairs}:
            prefix.append((goal.requested_support_ref, ref))
    return set(prefix)


def piercing_search_request_fingerprint(request: PiercingPlanSearchInput) -> str:
    configuration = tuple((name, getattr(request.configuration, name)) for name in
        PiercingConfiguration.model_fields if name not in ("configuration_ref", "provenance", "schema_version"))
    models = tuple(tuple((name, getattr(model, name)) for name in PiercingConditionalModel.model_fields
        if name != "evidence_refs") for model in request.models)
    effects = tuple(tuple((name, getattr(effect, name)) for name in PiercingCommandEffect.model_fields
        if name != "evidence_refs") for effect in request.effects)
    return stable_digest((configuration, effects, models,
        request.goal_requested_root_ref, request.goal_requested_type_order,
        request.max_microsteps, request.max_depth, request.max_nodes,
        request.max_plans, request.staged_profiles, request.source_parent_goal_ref,
        request.source_parent_why_fingerprint))


def _state_snapshot(configuration: PiercingConfiguration) -> PiercingSearchPhysicalState:
    return PiercingSearchPhysicalState(**{name: getattr(configuration, name)
        for name in PiercingSearchPhysicalState.model_fields})


def _stage_state_key(stage_index: int, configuration: PiercingConfiguration) -> tuple[int, str]:
    return stage_index, stable_digest(_physical_key(configuration))


def _pack_search_continuation(request, all_contexts, expanded, plans):
    """Share physical poses and path prefixes; never repeat the initial domain."""
    states, state_indices = [], {}
    traces, trace_indices = [], {}
    witnesses, witness_indices = [], {}

    def state_index(configuration):
        state = _state_snapshot(configuration)
        key = stable_digest(state)
        if key not in state_indices:
            state_indices[key] = len(states)
            states.append(state)
        return state_indices[key]

    initial_state = state_index(request.configuration)
    traces.append(PiercingSearchTraceNode(physical_state_index=initial_state, action_count=0))

    def path_indices(path, steps):
        indices = [0]
        for count, (effect, step) in enumerate(zip(path, steps), 1):
            pose = state_index(step.configuration)
            key = (indices[-1], effect.effect_ref, pose)
            if key not in trace_indices:
                trace_indices[key] = len(traces)
                traces.append(PiercingSearchTraceNode(physical_state_index=pose,
                    parent_node_index=indices[-1], effect_ref=effect.effect_ref, action_count=count))
            indices.append(trace_indices[key])
        return indices

    records = []
    for context in all_contexts:
        node_records, node_keys = [], set()
        for stage_index, configuration, path, steps, prior_witnesses, local_depth in (
                tuple(context["queue"]) + tuple(context.get("deferred_frontier", ()))):
            indices = path_indices(path, steps)
            if _state_snapshot(configuration) != states[traces[indices[-1]].physical_state_index]:
                raise ValueError("frontier path and physical state differ")
            prior_indices = []
            for witness in prior_witnesses:
                trace_index = indices[witness.action_count_at_stage]
                record = PiercingSearchWitnessRecord(trace_node_index=trace_index,
                    stage_ref=witness.stage_ref, measurements=witness.measurements,
                    falsifier_refs=witness.falsifier_refs)
                key = stable_digest(record)
                if key not in witness_indices:
                    witness_indices[key] = len(witnesses)
                    witnesses.append(record)
                prior_indices.append(witness_indices[key])
            key = (stage_index, indices[-1], tuple(prior_indices), local_depth)
            if key not in node_keys:
                node_keys.add(key)
                node_records.append(PiercingSearchFrontierRecord(stage_index=stage_index,
                    trace_node_index=indices[-1], witness_record_indices=tuple(prior_indices),
                    local_depth=local_depth))
        if node_records:
            records.append(PiercingSearchContextRecord(profile_ref=context["profile"].profile_ref,
                model_ref=context["model"].model_ref, frontier_records=tuple(node_records),
                seen_stage_state_keys=tuple(sorted(context["seen"])),
                stage_node_counts=tuple(context["stage_nodes"]),
                stage_successor_counts=tuple(context["stage_successors"]),
                composition_count=context["compositions"]))
    return PiercingSearchContinuation(request_fingerprint=piercing_search_request_fingerprint(request),
        expanded_node_count=expanded, physical_states=tuple(states), trace_nodes=tuple(traces),
        witness_records=tuple(witnesses), context_records=tuple(records),
        completed_plan_effect_paths=tuple((p.search_profile_ref, p.model_ref,
            tuple(e.effect_ref for e in p.effects)) for p in plans))


def _restore_search_continuation(request):
    """Revalidate every restored prefix mechanically under its retained model."""
    continuation = request.continuation
    if continuation.request_fingerprint != piercing_search_request_fingerprint(request):
        raise ValueError("continuation request fingerprint differs")
    if continuation.expanded_node_count > request.max_nodes:
        raise ValueError("continuation consumed more than the Source bound")
    effects = {e.effect_ref: e for e in request.effects}
    models = {m.model_ref: m for m in request.models}
    profiles = {p.profile_ref: p for p in request.staged_profiles}
    if not continuation.trace_nodes:
        raise ValueError("continuation has no initial state")
    first = continuation.trace_nodes[0]
    if first.parent_node_index is not None or first.effect_ref is not None or first.action_count != 0:
        raise ValueError("continuation initial node differs")
    if continuation.physical_states[first.physical_state_index] != _state_snapshot(request.configuration):
        raise ValueError("continuation initial physical state differs")
    cache = {}

    def replay(model, index):
        key = (model.model_ref, index)
        if key in cache:
            return cache[key]
        node = continuation.trace_nodes[index]
        if index == 0:
            result = (request.configuration, (), ())
        else:
            if node.parent_node_index is None or not 0 <= node.parent_node_index < index:
                raise ValueError("continuation path is not a DAG")
            before, path, steps = replay(model, node.parent_node_index)
            effect = effects[node.effect_ref]
            step = _simulate_model(PiercingStepInput(configuration=before, effect=effect,
                models=(model,), max_microsteps=request.max_microsteps), model)
            if not step.completed or step.truncated or step.unresolved_refs or step.missing_premise_refs:
                raise ValueError("continuation prefix no longer completes")
            if node.action_count != len(path) + 1:
                raise ValueError("continuation path count differs")
            if _state_snapshot(step.configuration) != continuation.physical_states[node.physical_state_index]:
                raise ValueError("continuation physical state differs from prefix replay")
            result = (step.configuration, path + (effect,), steps + (step,))
        cache[key] = result
        return result

    contexts = deque()
    for record in continuation.context_records:
        profile, model = profiles[record.profile_ref], models[record.model_ref]
        if (len(record.stage_node_counts) != len(profile.stages) or
                len(record.stage_successor_counts) != len(profile.stages)):
            raise ValueError("continuation stage counters differ")
        queue = deque()
        for node in record.frontier_records:
            if node.stage_index >= len(profile.stages):
                raise ValueError("continuation stage index differs")
            configuration, path, steps = replay(model, node.trace_node_index)
            stage_witnesses = []
            for ordinal, witness_index in enumerate(node.witness_record_indices):
                witness = continuation.witness_records[witness_index]
                if ordinal >= node.stage_index or witness.stage_ref != profile.stages[ordinal].stage_ref:
                    raise ValueError("continuation witness stage differs")
                prior, prior_path, _ = replay(model, witness.trace_node_index)
                if tuple(path[:len(prior_path)]) != prior_path:
                    raise ValueError("continuation witness is not a prefix")
                measured = _measure_stage(prior, profile.stages[ordinal])
                if measured.satisfied is not True or measured != witness.measurements:
                    raise ValueError("continuation witness no longer holds")
                if witness.falsifier_refs != profile.stages[ordinal].falsifier_refs:
                    raise ValueError("continuation witness falsifiers differ")
                stage_witnesses.append(PiercingStageWitness(stage_ref=witness.stage_ref,
                    action_count_at_stage=len(prior_path), configuration=prior,
                    measurements=measured, falsifier_refs=witness.falsifier_refs))
            if len(stage_witnesses) != node.stage_index:
                raise ValueError("continuation stage lineage is incomplete")
            queue.append((node.stage_index, configuration, path, steps, tuple(stage_witnesses), node.local_depth))
        contexts.append({"profile": profile, "model": model, "queue": queue,
            "seen": set(record.seen_stage_state_keys), "stage_nodes": list(record.stage_node_counts),
            "stage_successors": list(record.stage_successor_counts), "compositions": record.composition_count})
    plans = []
    for profile_ref, model_ref, effect_refs in continuation.completed_plan_effect_paths:
        profile, model = profiles[profile_ref], models[model_ref]
        path = tuple(effects[ref] for ref in effect_refs)
        configuration, steps, stage_witnesses = request.configuration, [], []
        stage_index = 0
        for action_count in range(len(path) + 1):
            if action_count:
                effect = path[action_count - 1]
                step = _simulate_model(PiercingStepInput(configuration=configuration, effect=effect,
                    models=(model,), max_microsteps=request.max_microsteps), model)
                if not step.completed:
                    raise ValueError("continued completed plan no longer completes")
                steps.append(step); configuration = step.configuration
            while stage_index < len(profile.stages):
                stage = profile.stages[stage_index]
                measured = _measure_stage(configuration, stage)
                if measured.satisfied is not True:
                    break
                stage_witnesses.append(PiercingStageWitness(stage_ref=stage.stage_ref,
                    action_count_at_stage=action_count, configuration=configuration,
                    measurements=measured, falsifier_refs=stage.falsifier_refs))
                stage_index += 1
        goal = measure_piercing_goal(PiercingGoalInput(configuration=configuration,
            requested_root_ref=request.goal_requested_root_ref, requested_type_order=request.goal_requested_type_order))
        if not goal.predicted_rooted_match or stage_index != len(profile.stages):
            raise ValueError("continued completed goal no longer matches")
        low, high = _cost(path)
        plans.append(PiercingPlanCandidate(model_ref=model_ref, effects=path,
            action_refs=tuple(e.action_ref for e in path), steps=tuple(steps), configuration=configuration,
            goal=goal, resource_cost_lower_bound=low, resource_cost_upper_bound=high,
            search_profile_ref=profile_ref, stage_witnesses=tuple(stage_witnesses),
            falsifier_refs=tuple(sorted(set(profile.falsifier_refs) | {ref for s in profile.stages for ref in s.falsifier_refs}))))
    return contexts, plans, continuation.expanded_node_count


def _search_declared_stages(request: PiercingPlanSearchInput) -> PiercingPlanSearchMeasurements:
    """Round-robin bounded local searches, composing every declared stage witness."""
    profiles = tuple(sorted(request.staged_profiles, key=lambda p: p.profile_ref))
    models = tuple(sorted(request.models, key=lambda m: m.model_ref))
    required_members = {ref for profile in profiles for stage in profile.stages for ref in stage.member_refs + stage.preserve_piece_refs}
    present = {p.piece_ref for p in request.configuration.pieces}
    initial_missing = set(request.configuration.missing_piece_refs) | (required_members - present)
    premise_gaps = set()
    if initial_missing:
        premise_gaps.add("premise.complete_initial_member_geometry")
    if {r.root_ref for r in request.configuration.rods} - set(dict(request.configuration.root_footprints)):
        premise_gaps.add("premise.complete_initial_root_footprints")
    if request.configuration.domain_positions is None:
        premise_gaps.add("premise.finite_motion_domain")
    if premise_gaps:
        frontiers = tuple(PiercingStageFrontier(profile_ref=p.profile_ref, model_ref=m.model_ref,
            stage_ref=p.stages[0].stage_ref, frontier_count=1, missing_premise_refs=tuple(sorted(premise_gaps)),
            falsifier_refs=tuple(sorted(set(p.falsifier_refs) | set(p.stages[0].falsifier_refs)))) for p in profiles for m in models)
        return PiercingPlanSearchMeasurements(plans=(), expanded_node_count=0, truncated=True,
            open_frontier_count=len(frontiers), open_frontier_model_refs=tuple(m.model_ref for m in models),
            unresolved_model_refs=tuple(m.model_ref for m in models), model_refs=tuple(m.model_ref for m in models),
            missing_premise_refs=tuple(sorted(premise_gaps)), stage_frontiers=frontiers)
    # One queue per supplied profile/model makes neither alternative consume the shared budget first.
    if request.continuation is not None:
        try:
            contexts, plans, expanded = _restore_search_continuation(request)
        except (ValueError, KeyError, IndexError, TypeError):
            return PiercingPlanSearchMeasurements(plans=(), expanded_node_count=request.continuation.expanded_node_count,
                truncated=True, open_frontier_count=sum(len(c.frontier_records) for c in request.continuation.context_records),
                open_frontier_model_refs=tuple(m.model_ref for m in models), unresolved_model_refs=tuple(m.model_ref for m in models),
                model_refs=tuple(m.model_ref for m in models), missing_premise_refs=("premise.revalidated_search_continuation",),
                continuation=request.continuation, continuation_rejected_refs=("gap.search_continuation_replay_or_identity",))
    else:
        contexts = deque()
        for profile in profiles:
            for model in models:
                contexts.append({"profile": profile, "model": model,
                    "queue": deque([(0, request.configuration, (), (), (), 0)]),
                    "seen": {_stage_state_key(0, request.configuration)},
                    "stage_nodes": [0] * len(profile.stages), "stage_successors": [0] * len(profile.stages),
                    "compositions": 0})
        plans, expanded = [], 0
    all_contexts = tuple(contexts)
    start_expanded = expanded
    effects = tuple(sorted(request.effects, key=lambda e: (e.effect_ref, e.action_ref)))
    initial_prefix = _initial_prefix_pairs(request)
    witness_path_keys = {stable_digest(plan.effects) for plan in plans}
    frontiers = []
    missing_all = set()
    bounds_all = set()
    unresolved_models = set()
    rejected_invariant_transitions = 0

    def record_frontier(context, stage, count, bounds=(), missing=()):
        frontiers.append(PiercingStageFrontier(profile_ref=context["profile"].profile_ref, model_ref=context["model"].model_ref,
            stage_ref=stage.stage_ref, frontier_count=count, bound_refs=tuple(bounds), missing_premise_refs=tuple(missing),
            falsifier_refs=tuple(sorted(set(context["profile"].falsifier_refs) | set(stage.falsifier_refs)))))
        bounds_all.update(bounds); missing_all.update(missing)
        if missing:
            unresolved_models.add(context["model"].model_ref)
        if context.get("active_frontier_node") is not None:
            context.setdefault("deferred_frontier", []).append(context["active_frontier_node"])

    while contexts and expanded < request.max_nodes and (request.work_slice_nodes is None or expanded - start_expanded < request.work_slice_nodes):
        context = contexts.popleft()
        profile, model = context["profile"], context["model"]
        queue = context["queue"]
        if profile.frontier_schedule == "advance_dependency":
            # Source requests completion of its next ordered dependency before
            # alternate predecessor witnesses. Retain every other node for
            # backtracking, and keep FIFO order within the same stage. The
            # typed continuation retains this complete queue unchanged.
            next_index = max(range(len(queue)), key=lambda index: queue[index][0])
            queue.rotate(-next_index)
            node = queue.popleft()
            queue.rotate(next_index)
        else:
            node = queue.popleft()
        stage_index, configuration, path, steps, witnesses, local_depth = node
        context["active_frontier_node"] = (stage_index, configuration, path, steps, witnesses, local_depth)
        stage = profile.stages[stage_index]
        if context["stage_nodes"][stage_index] >= profile.max_stage_nodes:
            record_frontier(context, stage, 1, ("bound.max_stage_nodes",))
        else:
            expanded += 1
            context["stage_nodes"][stage_index] += 1
            measured = _measure_stage(configuration, stage)
            if measured.satisfied is True:
                if context["stage_successors"][stage_index] >= profile.max_stage_successors:
                    record_frontier(context, stage, 1, ("bound.max_stage_successors",))
                else:
                    context["stage_successors"][stage_index] += 1
                    witness = PiercingStageWitness(stage_ref=stage.stage_ref, action_count_at_stage=len(path), configuration=configuration,
                        measurements=measured, falsifier_refs=stage.falsifier_refs)
                    next_witnesses = witnesses + (witness,)
                    if stage_index + 1 == len(profile.stages):
                        goal = measure_piercing_goal(PiercingGoalInput(configuration=configuration,
                            requested_root_ref=request.goal_requested_root_ref, requested_type_order=request.goal_requested_type_order))
                        if goal.predicted_rooted_match:
                            path_key = stable_digest(path)
                            if path_key in witness_path_keys or len(witness_path_keys) < request.max_plans:
                                witness_path_keys.add(path_key)
                                low, high = _cost(path)
                                plans.append(PiercingPlanCandidate(model_ref=model.model_ref, effects=path, action_refs=tuple(e.action_ref for e in path),
                                    steps=steps, configuration=configuration, goal=goal, resource_cost_lower_bound=low, resource_cost_upper_bound=high,
                                    search_profile_ref=profile.profile_ref, stage_witnesses=next_witnesses,
                                    falsifier_refs=tuple(sorted(set(profile.falsifier_refs) | {r for s in profile.stages for r in s.falsifier_refs}))))
                            else:
                                record_frontier(context, stage, 1, ("bound.max_plans",))
                            # Retain the first complete witness for this supplied
                            # profile/model traversal, including aliases of a path
                            # already witnessed by another explanatory context.
                            context["queue"].clear()
                    elif context["compositions"] >= profile.max_compositions:
                        record_frontier(context, stage, 1, ("bound.max_compositions",))
                    else:
                        next_key = _stage_state_key(stage_index + 1, configuration)
                        if next_key not in context["seen"]:
                            context["seen"].add(next_key)
                            context["compositions"] += 1
                            context["queue"].append((stage_index + 1, configuration, path, steps, next_witnesses, 0))
            elif len(path) >= request.max_depth or local_depth >= profile.max_stage_depth:
                bound = "bound.max_depth" if len(path) >= request.max_depth else "bound.max_stage_depth"
                record_frontier(context, stage, 1, (bound,))
            else:
                protected = {(r, p.piece_ref) for p in configuration.pieces if p.piece_ref in stage.preserve_piece_refs for r in p.support_refs}
                if profile.preserve_initial_matching_prefix:
                    protected.update(initial_prefix)
                    prefix_stage_refs = {s.stage_ref for s in profile.stages if s.measurement_kind == "rooted_order_prefixes"}
                    for prior_witness in witnesses:
                        if prior_witness.stage_ref in prefix_stage_refs:
                            prefix_members = set(prior_witness.measurements.measured_piece_refs)
                            protected.update((r, p.piece_ref) for p in prior_witness.configuration.pieces
                                if p.piece_ref in prefix_members for r in p.support_refs)
                for effect in effects:
                    step = _simulate_model(PiercingStepInput(configuration=configuration, effect=effect, models=(model,), max_microsteps=request.max_microsteps), model)
                    if step.unresolved_refs or step.missing_premise_refs or step.truncated:
                        record_frontier(context, stage, 1, ("bound.max_microsteps",) if step.truncated else (), step.missing_premise_refs or ("premise.resolved_mechanical_successor",))
                        continue
                    states = step.intermediate_configurations or (step.configuration,)
                    if any(not protected <= set(_pairs(state)) or not set(stage.preserve_piece_refs) <= {p.piece_ref for p in state.pieces} or set(stage.preserve_piece_refs) & set(state.missing_piece_refs) for state in states):
                        rejected_invariant_transitions += 1
                        continue
                    key = _stage_state_key(stage_index, step.configuration)
                    if key not in context["seen"]:
                        context["seen"].add(key)
                        context["queue"].append((stage_index, step.configuration, path + (effect,), steps + (step,), witnesses, local_depth + 1))
        if context["queue"]:
            contexts.append(context)
    final_bound = ("bound.max_nodes" if expanded >= request.max_nodes else
        "bound.work_slice_nodes" if request.work_slice_nodes is not None and expanded - start_expanded >= request.work_slice_nodes else
        "bound.max_plans")
    for context in contexts:
        context["active_frontier_node"] = None
        counts = {}
        for stage_index, _, _, _, _, _ in context["queue"]:
            counts[stage_index] = counts.get(stage_index, 0) + 1
        for index, count in sorted(counts.items()):
            record_frontier(context, context["profile"].stages[index], count, (final_bound,))
    open_count = sum(f.frontier_count for f in frontiers)
    return PiercingPlanSearchMeasurements(plans=tuple(plans), expanded_node_count=expanded, truncated=bool(frontiers),
        open_frontier_count=open_count, open_frontier_model_refs=tuple(sorted({f.model_ref for f in frontiers})),
        unresolved_model_refs=tuple(sorted(unresolved_models)), model_refs=tuple(m.model_ref for m in models),
        missing_premise_refs=tuple(sorted(missing_all)), exhausted_bound_refs=tuple(sorted(bounds_all)), stage_frontiers=tuple(frontiers),
        rejected_invariant_transition_count=rejected_invariant_transitions,
        slice_expanded_node_count=expanded - start_expanded,
        continuation=_pack_search_continuation(request, all_contexts, expanded, plans))


def search_piercing_plans(request: PiercingPlanSearchInput) -> PiercingPlanSearchMeasurements:
    if request.staged_profiles:
        return _search_declared_stages(request)
    queue = deque((m, request.configuration, (), ()) for m in sorted(request.models, key=lambda m: m.model_ref))
    visited = {(m.model_ref, _physical_key(request.configuration)) for m in request.models}
    plans = []
    witness_path_keys: set[str] = set()
    expanded = 0
    unresolved_models: set[Ref] = set()
    open_models: set[Ref] = set()
    open_count = 0
    missing: set[Ref] = set()
    bounds: set[Ref] = set()
    effects = tuple(sorted(request.effects, key=lambda e: (e.effect_ref, e.action_ref)))
    while queue and expanded < request.max_nodes:
        model, configuration, path, steps = queue.popleft()
        expanded += 1
        goal = measure_piercing_goal(PiercingGoalInput(configuration=configuration, requested_root_ref=request.goal_requested_root_ref, requested_type_order=request.goal_requested_type_order))
        if goal.predicted_rooted_match:
            path_key = stable_digest(path)
            if path_key in witness_path_keys or len(witness_path_keys) < request.max_plans:
                witness_path_keys.add(path_key)
                low, high = _cost(path)
                plans.append(PiercingPlanCandidate(model_ref=model.model_ref, effects=path, action_refs=tuple(e.action_ref for e in path),
                    steps=steps, configuration=configuration, goal=goal, resource_cost_lower_bound=low, resource_cost_upper_bound=high))
            else:
                bounds.add("bound.max_plans")
                open_count += 1; open_models.add(model.model_ref)
            queue = deque(row for row in queue if row[0].model_ref != model.model_ref)
            continue
        if len(path) >= request.max_depth:
            bounds.add("bound.max_depth")
            open_count += 1; open_models.add(model.model_ref)
            continue
        for effect in effects:
            step = _simulate_model(PiercingStepInput(configuration=configuration, effect=effect, models=(model,), max_microsteps=request.max_microsteps), model)
            if step.unresolved_refs or step.missing_premise_refs or step.truncated:
                missing.update(step.missing_premise_refs)
                if step.truncated:
                    bounds.add("bound.max_microsteps")
                unresolved_models.add(model.model_ref)
                open_models.add(model.model_ref); open_count += 1
                continue
            # A command may stop before its full extent while still producing a useful physical successor.
            key = (model.model_ref, _physical_key(step.configuration))
            if key in visited:
                continue
            visited.add(key)
            queue.append((model, step.configuration, path + (effect,), steps + (step,)))
    open_count += len(queue)
    if queue and expanded >= request.max_nodes:
        bounds.add("bound.max_nodes")
    if queue and len(plans) >= request.max_plans:
        bounds.add("bound.max_plans")
    open_models.update(m.model_ref for m, _, _, _ in queue)
    return PiercingPlanSearchMeasurements(plans=tuple(plans), expanded_node_count=expanded,
        truncated=bool(queue) or open_count > 0, open_frontier_count=open_count,
        open_frontier_model_refs=tuple(sorted(open_models)), unresolved_model_refs=tuple(sorted(unresolved_models)),
        model_refs=tuple(sorted(m.model_ref for m in request.models)), missing_premise_refs=tuple(sorted(missing)), exhausted_bound_refs=tuple(sorted(bounds)))


def reconcile_piercing_prediction(request: PiercingReconciliationInput) -> PiercingReconciliationMeasurements:
    observed = request.observed_configuration
    correction = request.viewport_translation or (0, 0)
    correction_known = request.viewport_translation is not None and bool(request.viewport_translation_evidence_refs) or request.viewport_translation == (0, 0)
    comparisons = []
    for branch in request.predictions.branches:
        predicted = branch.configuration
        differences = []
        missing = set(observed.missing_piece_refs)
        op = {p.piece_ref: p for p in observed.pieces}
        for p in predicted.pieces:
            actual = op.get(p.piece_ref)
            if actual is None:
                missing.add(p.piece_ref)
                continue
            actual_positions = _translated(actual.occupied_positions, (-correction[0], -correction[1]))
            if set(p.occupied_positions) != set(actual_positions):
                differences.append(PiercingStateDifference(entity_ref=p.piece_ref, field_ref="field.occupied_positions", predicted_positions=p.occupied_positions, observed_positions=actual_positions))
            if p.type_ref != actual.type_ref:
                differences.append(PiercingStateDifference(entity_ref=p.piece_ref, field_ref="field.type_ref", predicted_value_ref=p.type_ref, observed_value_ref=actual.type_ref))
            if request.observed_supports_complete and set(p.support_refs) != set(actual.support_refs):
                differences.append(PiercingStateDifference(entity_ref=p.piece_ref, field_ref="field.support_refs", predicted_support_refs=p.support_refs, observed_support_refs=actual.support_refs))
        for ref in sorted(set(op) - {p.piece_ref for p in predicted.pieces}):
            differences.append(PiercingStateDifference(entity_ref=ref, field_ref="field.unpredicted_piece"))
        observed_rods = {r.rod_ref: r for r in observed.rods}
        for rod in predicted.rods:
            actual = observed_rods.get(rod.rod_ref)
            if actual is None:
                missing.add(rod.rod_ref)
            else:
                actual_positions = _translated(actual.root_to_tip_positions, (-correction[0], -correction[1]))
                if rod.root_ref != actual.root_ref:
                    differences.append(PiercingStateDifference(entity_ref=rod.rod_ref, field_ref="field.root_ref", predicted_value_ref=rod.root_ref, observed_value_ref=actual.root_ref))
                if rod.root_to_tip_positions != actual_positions:
                    differences.append(PiercingStateDifference(entity_ref=rod.rod_ref, field_ref="field.root_to_tip_positions", predicted_positions=rod.root_to_tip_positions, observed_positions=actual_positions))
                actual_material = _translated(_rod_mask(actual), (-correction[0], -correction[1]))
                if set(_rod_mask(rod)) != set(actual_material):
                    differences.append(PiercingStateDifference(entity_ref=rod.rod_ref, field_ref="field.rod_footprint_positions", predicted_positions=_rod_mask(rod), observed_positions=actual_material))
        observed_roots = dict(observed.root_footprints)
        for root_ref, positions in predicted.root_footprints:
            actual = observed_roots.get(root_ref)
            if actual is None:
                missing.add(root_ref)
            else:
                actual_positions = _translated(actual, (-correction[0], -correction[1]))
                if set(positions) != set(actual_positions):
                    differences.append(PiercingStateDifference(entity_ref=root_ref, field_ref="field.root_footprint", predicted_positions=positions, observed_positions=actual_positions))
        resolved = request.observation_complete and request.observation_sealed and correction_known and observed.scope == predicted.scope and not missing and branch.completed and not branch.unresolved_refs and not branch.truncated
        matches = not differences if resolved else None
        comparisons.append(PiercingModelComparison(model_ref=branch.model_ref, matches=matches, differences=tuple(differences),
            matching_support_pairs=tuple(sorted(set(_pairs(predicted)) & set(_pairs(observed)))), missing_observed_piece_refs=tuple(sorted(missing)),
            predicted_only_support_pairs=tuple(sorted(set(_pairs(predicted)) - set(_pairs(observed)))),
            observed_only_support_pairs=tuple(sorted(set(_pairs(observed)) - set(_pairs(predicted)))), support_comparison_complete=request.observed_supports_complete))
    restart_parts = (request.restart_resource_cost_bounds, request.replay_resource_cost_bounds, request.reacquisition_resource_cost_bounds)
    restart_bounds = tuple(sum(b[index] for b in restart_parts) if all(b[index] is not None for b in restart_parts) else None for index in (0, 1))
    observed_positions = {p for body in observed.pieces for p in body.occupied_positions} | {p for r in observed.rods for p in _rod_mask(r)} | {p for _, footprint in observed.root_footprints for p in footprint}
    finite_coverage = observed.domain_positions is not None and observed_positions <= set(observed.domain_positions) and not observed.missing_piece_refs
    return PiercingReconciliationMeasurements(comparisons=tuple(comparisons),
        matching_model_refs=tuple(c.model_ref for c in comparisons if c.matches is True),
        rejected_model_refs=tuple(c.model_ref for c in comparisons if c.matches is False),
        unresolved_model_refs=tuple(c.model_ref for c in comparisons if c.matches is None),
        viewport_translation=request.viewport_translation, finite_domain_coverage=finite_coverage,
        observation_complete=request.observation_complete, observation_sealed=request.observation_sealed,
        supplied_hypothesis_domain_complete=request.supplied_hypothesis_domain_complete,
        repair_resource_cost_bounds=request.repair_resource_cost_bounds, restart_replay_reacquisition_cost_bounds=restart_bounds)


def measure_piercing_observed_transition(request: PiercingObservationInput) -> PiercingObservationMeasurements:
    predictions = simulate_piercing_rollout(PiercingRolloutInput(configuration=request.before, effects=request.effects,
        models=request.models, max_microsteps=request.max_microsteps, require_finite_domain=request.require_finite_domain))
    reconciliation = reconcile_piercing_prediction(PiercingReconciliationInput(predictions=predictions, observed_configuration=request.after,
        viewport_translation=request.viewport_translation, viewport_translation_evidence_refs=request.viewport_translation_evidence_refs,
        observation_complete=request.observation_complete, observation_sealed=request.observation_sealed,
        observed_supports_complete=request.observed_supports_complete, supplied_hypothesis_domain_complete=request.supplied_hypothesis_domain_complete))
    snapshots = (request.before,) + request.intermediate_configurations + (request.after,)
    correction_known = request.viewport_translation == (0, 0) or request.viewport_translation is not None and bool(request.viewport_translation_evidence_refs)
    counts = {(r, p): n for r, p, n in request.prior_relation_evidence_counts}
    snapshot_offsets = dict(request.snapshot_viewport_translations)
    rows = []
    for rod_ref, piece_ref in sorted(request.candidate_support_pairs):
        entry: bool | None = False if request.observation_complete and request.observation_sealed else None
        carry_count = 0
        transport_count = 0
        entry_seen = False
        entry_started = False
        for before, after in zip(snapshots, snapshots[1:]):
            br = next((r for r in before.rods if r.rod_ref == rod_ref), None)
            ar = next((r for r in after.rods if r.rod_ref == rod_ref), None)
            bp = next((p for p in before.pieces if p.piece_ref == piece_ref), None)
            ap = next((p for p in after.pieces if p.piece_ref == piece_ref), None)
            if br is None or ar is None or bp is None or ap is None:
                entry = None
                continue
            before_offset = snapshot_offsets.get(before.configuration_ref)
            after_offset = snapshot_offsets.get(after.configuration_ref)
            if request.viewport_translation == (0, 0):
                before_offset = before_offset or (0, 0)
                after_offset = after_offset or (0, 0)
            else:
                if before is request.before:
                    before_offset = (0, 0)
                if after is request.after:
                    after_offset = request.viewport_translation
            if before_offset is None or after_offset is None or not correction_known:
                entry = None
                continue
            br = _translate_rod(br, (-before_offset[0], -before_offset[1]))
            ar = _translate_rod(ar, (-after_offset[0], -after_offset[1]))
            bp = bp.model_copy(update={"occupied_positions": _translated(bp.occupied_positions, (-before_offset[0], -before_offset[1]))})
            ap = ap.model_copy(update={"occupied_positions": _translated(ap.occupied_positions, (-after_offset[0], -after_offset[1]))})
            # Axis is supplied by the law, never inferred from a handle pixel ordering.
            effect = next((e for e in request.effects if e.rod_ref == rod_ref), None)
            if effect is None:
                entry = None
                continue
            axis = effect.axis_direction
            old_tip = _project(br.root_to_tip_positions[-1], axis)
            new_tip = _project(ar.root_to_tip_positions[-1], axis)
            near = min(_project(p, axis) for p in bp.occupied_positions)
            far = max(_project(p, axis) for p in ap.occupied_positions)
            root_same = br.root_to_tip_positions[0] == ar.root_to_tip_positions[0]
            piece_same = set(bp.occupied_positions) == set(ap.occupied_positions)
            intersects = bool(set(_rod_mask(ar)).intersection(ap.occupied_positions))
            if root_same and piece_same and old_tip <= near and new_tip >= near and new_tip > old_tip and intersects:
                entry_started = True
            if root_same and piece_same and entry_started and new_tip >= far and new_tip > old_tip and intersects:
                entry_seen = True
                entry = True
            if not root_same or not piece_same:
                entry_started = False
            root_delta = (ar.root_to_tip_positions[0][0] - br.root_to_tip_positions[0][0], ar.root_to_tip_positions[0][1] - br.root_to_tip_positions[0][1])
            # A carry witness follows an observed traversal, or a supplied prior support relation.
            prior_support = any(rod_ref in p.support_refs for p in request.before.pieces if p.piece_ref == piece_ref)
            commanded_translation = any(e.rod_ref == rod_ref and e.root_translation != (0, 0) and all(
                abs(root_delta[i]) <= abs(e.root_translation[i]) and (root_delta[i] == 0 or root_delta[i] * e.root_translation[i] > 0)
                for i in (0, 1)) for e in request.effects)
            relative_pose_preserved = set(_translated(bp.occupied_positions, root_delta)) == set(ap.occupied_positions)
            if correction_known and commanded_translation and root_delta != (0, 0) and relative_pose_preserved and request.observation_complete and request.observation_sealed and before.scope == after.scope and before.frame_ref is not None and after.frame_ref is not None:
                transport_count += 1
            if correction_known and (entry_seen or prior_support) and commanded_translation and root_delta != (0, 0) and relative_pose_preserved:
                carry_count += 1
        before_pair = (rod_ref, piece_ref) in set(_pairs(request.before))
        after_pair = (rod_ref, piece_ref) in set(_pairs(request.after))
        root_ref = next((r.root_ref for r in request.before.rods if r.rod_ref == rod_ref), None)
        relation_rejected = {c.model_ref for c in reconciliation.comparisons if c.matches is False and any(d.entity_ref in (rod_ref, piece_ref, root_ref) for d in c.differences)}
        rows.append(PiercingRelationObservation(rod_ref=rod_ref, piece_ref=piece_ref,
            entry_traversal_complete=entry, post_entry_carry_observed=carry_count > 0 if correction_known and request.observation_complete and request.observation_sealed else None,
            independent_motion_prediction_rejected=bool(request.independent_model_refs) and set(request.independent_model_refs) <= relation_rejected,
            stopped_motion_prediction_rejected=bool(request.stopped_model_refs) and set(request.stopped_model_refs) <= relation_rejected,
            repeated_evidence_count=counts.get((rod_ref, piece_ref), 0) + carry_count,
            retained_relative_pose_transition_count=carry_count,
            controlled_relative_transport_transition_count=transport_count,
            observed_support_added=after_pair and not before_pair, observed_support_removed=before_pair and not after_pair,
            observation_complete=request.observation_complete, observation_sealed=request.observation_sealed,
            supplied_hypothesis_domain_complete=request.supplied_hypothesis_domain_complete))
    return PiercingObservationMeasurements(predictions=predictions, reconciliation=reconciliation, relation_observations=tuple(rows),
        matching_model_refs=reconciliation.matching_model_refs, rejected_model_refs=reconciliation.rejected_model_refs,
        unresolved_model_refs=reconciliation.unresolved_model_refs, evidence_refs=request.evidence_refs)
