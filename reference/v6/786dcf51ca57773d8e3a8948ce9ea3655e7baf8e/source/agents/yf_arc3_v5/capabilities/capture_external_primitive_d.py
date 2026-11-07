"""Identity-preserving captures with ordered rewrites and current future domains."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .ray_capture_domain_d import CaptureBodyD, RayCaptureDomainRequestD, _capture_landings
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class CaptureRewriteD(FrozenModel):
    actor_type_ref: Ref
    actor_rank: int
    victim_type_ref: Ref
    victim_rank: int
    resulting_type_ref: Ref
    resulting_rank: int
    evidence_ref: Ref


class CaptureBathD(FrozenModel):
    cell: tuple[int, int]
    incoming_type_ref: Ref
    resulting_type_ref: Ref
    evidence_ref: Ref


class CapturePortalD(FrozenModel):
    source: tuple[int, int]
    destination: tuple[int, int]
    evidence_ref: Ref


class CaptureExternalPrimitiveRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.capture_external_primitive_request_d.v1'
    phase_ref: Literal['ONE_SELECTION_OR_CAPTURE']
    domain: RayCaptureDomainRequestD
    channel: Literal['SELECT', 'CAPTURE']
    focus_input_ref: Ref | None
    victim_ref: Ref | None
    landing: tuple[int, int] | None
    rewrites: tuple[CaptureRewriteD, ...] = Field(default=(), max_length=128)
    baths: tuple[CaptureBathD, ...] = Field(default=(), max_length=4096)
    portals: tuple[CapturePortalD, ...] = Field(default=(), max_length=4096)
    phase_order: tuple[Literal['PROMOTION', 'BATH', 'SUPPORT', 'PORTAL', 'TERMINAL'], ...]
    departure_support_consumed: bool
    selection_persistence: Literal['FOLLOW_SURVIVOR', 'RETAIN_IF_PRESENT', 'DROP']
    remaining_resource: int
    selection_cost: int = Field(ge=0)
    accepted_capture_cost: int = Field(ge=0)
    refused_capture_cost: int = Field(ge=0)
    future_range_laws: tuple[RayCaptureDomainRequestD, ...] = Field(default=(), max_length=128)
    goal_count: int = Field(ge=1)
    goal_identity_refs: tuple[Ref, ...] | None
    goal_type_rank_pairs: tuple[tuple[Ref, int], ...] | None
    goal_locations: tuple[tuple[int, int], ...] | None
    terminal_order: Literal['GOAL_THEN_DEPLETION', 'DEPLETION_THEN_GOAL']
    depletion_at_zero: bool
    failed_trial_restores_domain: bool
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = (('mechanics.typed_jump_carriers.capture_external_primitive', 'STEP'),)


def _capture_full_landing(body, population, support):
    occupied = {(b.origin[0]+dx, b.origin[1]+dy) for b in population if b.member_ref != body.member_ref for dx, dy in b.occupied_offsets}
    footprint = {(body.origin[0]+dx, body.origin[1]+dy) for dx, dy in body.occupied_offsets}
    return footprint <= support and not footprint & occupied


def measure_capture_external_primitive_d(request: CaptureExternalPrimitiveRequestD):
    refusal = d_validate_request(request)
    if refusal is not None: return refusal
    budget = DWorkBudget(request)
    try:
        if request.domain.scope != request.scope or request.domain.mode_ref != 'DOMAIN':
            return d_result(request, 'NEEDS_EVIDENCE', 'CAPTURE_DOMAIN_SCOPE_MISMATCH')
        if set(request.phase_order) != {'PROMOTION', 'BATH', 'SUPPORT', 'PORTAL', 'TERMINAL'} or len(request.phase_order) != 5 or request.phase_order[-1] != 'TERMINAL':
            return d_result(request, 'NEEDS_EVIDENCE', 'COMPLETE_POST_CAPTURE_ORDER_REQUIRED')
        population = list(request.domain.population)
        bodies = {b.member_ref: b for b in population}
        focus = request.domain.native_focus_ref
        support = set(request.domain.landing_support_cells)
        events, accepted, boundary = [], False, None
        resource = request.remaining_resource
        if request.channel == 'SELECT':
            if request.focus_input_ref not in bodies:
                return d_result(request, 'NEEDS_EVIDENCE', 'SELECTION_IDENTITY_NOT_BOUND')
            focus = request.focus_input_ref
            resource -= request.selection_cost
            accepted = True
            events.append({'cause': 'NATIVE_SELECTION_ONLY', 'member_ref': focus})
        else:
            incidences, _, qualified = _capture_landings(request.domain, budget)
            if not qualified: return d_result(request, 'NEEDS_EVIDENCE', 'RANK_RANGE_LAW_UNQUALIFIED')
            accepted = any(r['victim_ref'] == request.victim_ref and r['landing'] == request.landing for r in incidences)
            resource -= request.accepted_capture_cost if accepted else request.refused_capture_cost
            if accepted:
                actor, victim = bodies[focus], bodies[request.victim_ref]
                departure = actor.origin
                actor = actor.model_copy(update={'origin': request.landing})
                population = [actor if b.member_ref == focus else b for b in population if b.member_ref != victim.member_ref]
                events.append({'cause': 'LEGAL_CAPTURE', 'actor_ref': focus, 'victim_ref': victim.member_ref,
                    'departure': departure, 'landing': request.landing})
                transferred = False
                for phase in request.phase_order:
                    budget.visit({'stage': 'post_capture_phase', 'phase': phase})
                    if phase == 'PROMOTION':
                        matches = [r for r in request.rewrites if (r.actor_type_ref, r.actor_rank, r.victim_type_ref, r.victim_rank) ==
                            (bodies[focus].type_ref, bodies[focus].rank, victim.type_ref, victim.rank)]
                        if len(matches) != 1:
                            return d_result(request, 'NEEDS_EVIDENCE', 'EXACT_CAPTURE_REWRITE_REQUIRED')
                        rewrite = matches[0]
                        actor = actor.model_copy(update={'type_ref': rewrite.resulting_type_ref, 'rank': rewrite.resulting_rank})
                        events.append({'cause': 'CAPTURE_RANK_TYPE_REWRITE', 'evidence_ref': rewrite.evidence_ref,
                            'member_ref': focus, 'rank': actor.rank, 'type_ref': actor.type_ref})
                    elif phase == 'BATH':
                        matches = [b for b in request.baths if b.cell == actor.origin and b.incoming_type_ref == actor.type_ref]
                        if len(matches) > 1: return d_result(request, 'NEEDS_EVIDENCE', 'AMBIGUOUS_BATH_LAW')
                        if matches:
                            actor = actor.model_copy(update={'type_ref': matches[0].resulting_type_ref})
                            events.append({'cause': 'POST_CAPTURE_BATH', 'evidence_ref': matches[0].evidence_ref})
                    elif phase == 'SUPPORT' and request.departure_support_consumed:
                        for dx, dy in bodies[focus].occupied_offsets: support.discard((departure[0]+dx, departure[1]+dy))
                        events.append({'cause': 'ACCEPTED_CAPTURE_SUPPORT_CONSUMPTION', 'departure': departure})
                    elif phase == 'PORTAL':
                        matches = [p for p in request.portals if p.source == actor.origin]
                        if len(matches) > 1: return d_result(request, 'NEEDS_EVIDENCE', 'AMBIGUOUS_SINGLE_TRANSFER')
                        if matches and not transferred:
                            actor = actor.model_copy(update={'origin': matches[0].destination})
                            transferred = True
                            events.append({'cause': 'POST_CAPTURE_SINGLE_TRANSFER', 'evidence_ref': matches[0].evidence_ref})
                    population = [actor if b.member_ref == focus else b for b in population]
                    if phase in ('PORTAL', 'SUPPORT') and not _capture_full_landing(actor, population, support):
                        boundary = 'POST_CAPTURE_SUPPORT_OR_OCCUPANCY_FAILURE'; break
                if request.selection_persistence == 'DROP': focus = None
                elif request.selection_persistence == 'RETAIN_IF_PRESENT' and focus not in {b.member_ref for b in population}: focus = None
            else: events.append({'cause': 'REFUSED_CAPTURE', 'requested_victim_ref': request.victim_ref, 'requested_landing': request.landing})
        goal = len(population) == request.goal_count
        if request.goal_identity_refs is not None: goal = goal and sorted(b.member_ref for b in population) == sorted(request.goal_identity_refs)
        if request.goal_type_rank_pairs is not None: goal = goal and sorted((b.type_ref, b.rank) for b in population) == sorted(request.goal_type_rank_pairs)
        if request.goal_locations is not None: goal = goal and sorted(b.origin for b in population) == sorted(request.goal_locations)
        depleted = resource <= 0 if request.depletion_at_zero else resource < 0
        if boundary is None:
            for kind in (('GOAL', 'DEPLETION') if request.terminal_order == 'GOAL_THEN_DEPLETION' else ('DEPLETION', 'GOAL')):
                if kind == 'GOAL' and goal or kind == 'DEPLETION' and depleted: boundary = kind; break
        future, future_complete = (), True
        if boundary is None and focus is not None:
            actor = next(b for b in population if b.member_ref == focus)
            laws = [law for law in request.future_range_laws if law.range_law_rank == actor.rank and law.native_focus_ref == focus]
            if len(laws) != 1: future_complete = False
            else:
                law = laws[0]
                if law.scope != request.scope: return d_result(request, 'NEEDS_EVIDENCE', 'FUTURE_CAPTURE_SCOPE_MISMATCH')
                native = law.model_copy(update={'population': tuple(population), 'native_focus_ref': focus,
                    'landing_support_cells': tuple(sorted(support)), 'eligible_victim_refs': tuple(ref for ref in law.eligible_victim_refs if ref in {b.member_ref for b in population}),
                    'depth_bound': request.depth_bound})
                future, _, future_complete = _capture_landings(native, budget)
        budget.finish()
        failed = boundary is not None and boundary != 'GOAL'
        return d_result(request, 'COMPLETE' if future_complete else 'NEEDS_EVIDENCE', 'ONE_CAPTURE_PACKET' if future_complete else 'FUTURE_RANK_RANGE_LAW_REQUIRED',
            complete=future_complete, examined=budget.examined, values={'population': tuple(population), 'native_focus_ref': focus,
                'support_cells': tuple(sorted(support)), 'remaining_resource': resource, 'accepted': accepted,
                'events': tuple(events), 'boundary': boundary, 'future_capture_incidences': tuple(future),
                'restored_domain': request.domain if failed and request.failed_trial_restores_domain else None, 'external_inputs': 1})
    except DComputationInterrupted as error:
        return d_result(request, 'BUDGET_REACHED', error.cause, examined=budget.examined,
            frontier={'restart_atomic_capture_packet': True, 'work': error.frontier})
