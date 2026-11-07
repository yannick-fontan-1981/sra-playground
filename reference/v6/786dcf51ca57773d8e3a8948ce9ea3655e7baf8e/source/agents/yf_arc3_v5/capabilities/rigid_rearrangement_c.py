"""Finite rigid-body search formulation; existing D STEP and K09 own solving.

The caller supplies meaning, admission domains, supported laws and the goal.
This module measures incidences and constructs typed inputs, never executes an
environment command or independently implements collision physics / BFS.
"""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref, stable_digest
from .mechanical_request_contracts import MechanicalRequestIdentity, MechanicalResponseInput
from .mechanical_common_contracts_c import SearchDomainInputC, SearchStateC, MechanicalPredicateC
from .mechanical_search_driver_contracts_c import SearchDriverInputC, SearchPrimitiveC, SearchProviderC
from .mechanical_event_composition_c import packet_context_equal
from .rigid_edit_search_contracts_c import RigidEditSearchTemplateC
from .mechanical_profile_d import measure_d_native_profile
from .rigid_collision_classes_c import (RigidCollisionClassGateC, RigidCollisionRuleFactsC,
    measure_collision_class_bindings)


class RigidDirectionBindingC(FrozenModel):
    action_ref: Ref
    vector: tuple[int, int]


class RigidRearrangementInputC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.rigid_rearrangement_input_c.v1'
    query_identity: MechanicalRequestIdentity
    template: RigidEditSearchTemplateC
    beneficiary_ref: Ref
    destination_origins: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=128)
    goal_predicate_ref: Ref
    goal_contract_ref: Ref
    selection_action_ref: Ref
    selection_hit_offsets: FrozenMap
    directions: tuple[RigidDirectionBindingC, ...] = Field(min_length=1, max_length=64)
    remaining_primitive_reserve: int = Field(ge=0, le=65536)
    deterministic_response_ref: Ref
    preservation_predicates: tuple[MechanicalPredicateC, ...] = Field(default=(), max_length=128)
    evidence_refs: tuple[Ref, ...] = Field(min_length=1, max_length=128)
    maximum_geometry_checks: int = Field(ge=1, le=65536)
    collision_gate: RigidCollisionClassGateC


class RigidRearrangementPreparationC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.rigid_rearrangement_preparation_c.v1'
    request: RigidRearrangementInputC
    driver: SearchDriverInputC | None
    facts: FrozenMap
    missing_refs: tuple[Ref, ...]
    displacement_incidences: tuple[FrozenMap, ...]
    collision_rule_facts: tuple[RigidCollisionRuleFactsC, ...] = ()


class RigidRearrangementUnresolvedInputC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.rigid_rearrangement_unresolved_input_c.v1'
    measured: RigidRearrangementPreparationC
    source_status: Ref
    missing_cause: Literal['MISSING_OBSERVATION', 'UNSUPPORTED_MODEL', 'SIGNATURE_MISMATCH',
        'MISSING_IMPLEMENTATION', 'DOMAIN_EXHAUSTED', 'COMPUTATION_BOUND']
    unresolved_question_ref: Ref | None = None


class RigidRearrangementSearchBindingC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.rigid_rearrangement_search_binding_c.v1'
    measured: RigidRearrangementPreparationC
    route_witness_policy_ref: Literal['PER_ROOT_BOUNDED','FIRST_SHORTEST']
    evidence_refs: tuple[Ref, ...] = Field(min_length=1, max_length=128)
    pure_rigid_batch: bool
    operator_scope_ref: Literal['FULL', 'UNIQUE_APPROACH_CLEARANCE'] = 'FULL'
    vacancy_scope: 'RigidVacancyScopeC | None' = None


class RigidVacancyScopeC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.rigid_vacancy_scope_c.v1'
    measured: RigidRearrangementPreparationC
    unique_participant_refs: tuple[Ref, ...] = ()
    facts: FrozenMap


def measure_rigid_vacancy_scope(measured: RigidRearrangementPreparationC) -> RigidVacancyScopeC:
    """Finite incidences only: Source decides whether to search this subdomain.

    A singleton final-entry footprint and one-step clearance incidences do not
    constitute a route. All masks, including inactive bodies, remain in STEP.
    Partial enumeration can never establish singleton disambiguation.
    """
    value = measured.request
    native = value.template.profile.native_request
    bodies = {body.body_ref: body for body in native.bodies}
    masks = {ref: frozenset((body.origin[0]+x, body.origin[1]+y)
        for x, y in body.solid_offsets) for ref, body in sorted(bodies.items())}
    admissions = {ref: frozenset(body.admitted_solid_cells) for ref, body in sorted(bodies.items())}
    vectors = tuple(row.vector for row in value.directions)
    count = sum(len(body.solid_offsets)+len(body.admitted_solid_cells) for body in native.bodies)
    complete = False
    approaches = set()
    participant_sets = set()
    footprint = frozenset()
    blockers = ()

    def charge(amount):
        nonlocal count
        count += amount
        if count > value.maximum_geometry_checks:
            raise OverflowError('rigid vacancy geometry bound')

    def translated(ref, vector):
        charge(len(masks[ref]))
        return frozenset((x+vector[0], y+vector[1]) for x, y in masks[ref])

    def disjoint(first, second):
        charge(len(first))
        return first.isdisjoint(second)

    def admitted(ref, cells):
        charge(len(cells))
        return cells <= admissions[ref]

    def occupants(cells, excluded):
        return tuple(ref for ref, mask in sorted(masks.items())
            if ref not in excluded and not disjoint(cells, mask))

    eligible = (not measured.missing_refs and measured.driver is not None
        and value.beneficiary_ref in bodies
        and all(abs(x)+abs(y) == 1 for x, y in vectors)
        and not native.containment_supported and not native.collision_exclusion_pairs
        and all(body.parent_ref is None for body in native.bodies))
    try:
        charge(0)
        if eligible:
            beneficiary = bodies[value.beneficiary_ref]
            destinations = frozenset(value.destination_origins)
            for x, y in sorted(destinations):
                for dx, dy in vectors:
                    charge(1)
                    origin = (x-dx, y-dy)
                    if origin not in destinations:
                        charge(len(beneficiary.solid_offsets))
                        cells = frozenset((origin[0]+a, origin[1]+b) for a, b in beneficiary.solid_offsets)
                        if admitted(value.beneficiary_ref, cells):
                            approaches.add(origin)
            if len(approaches) == 1 and beneficiary.origin not in destinations:
                origin = next(iter(approaches))
                charge(len(beneficiary.solid_offsets))
                footprint = frozenset((origin[0]+a, origin[1]+b) for a, b in beneficiary.solid_offsets)
                blockers = occupants(footprint, {value.beneficiary_ref})
                if len(blockers) == 1:
                    blocker = blockers[0]
                    focus = {native.native_focus_ref} if native.native_focus_ref is not None else set()
                    base = {value.beneficiary_ref, blocker} | focus
                    def clearing_sets(ref, forbidden, ancestors):
                        if ref in ancestors:
                            return ()
                        found = set()
                        for vector in vectors:
                            endpoint = translated(ref, vector)
                            if not admitted(ref, endpoint) or not disjoint(endpoint, forbidden):
                                continue
                            options = {frozenset((ref,))}
                            for peer in occupants(endpoint, {ref}):
                                children = clearing_sets(peer, forbidden | endpoint, ancestors | {ref})
                                combined = set()
                                for first in sorted(options, key=lambda refs: tuple(sorted(refs))):
                                    for second in children:
                                        charge(1)
                                        combined.add(first | second)
                                options = combined
                                if not options:
                                    break
                            found.update(options)
                        return tuple(sorted(found, key=lambda refs: tuple(sorted(refs))))
                    for participants in clearing_sets(blocker, footprint, frozenset()):
                        charge(1)
                        participant_sets.add(tuple(sorted(base | set(participants))))
            complete = True
    except OverflowError:
        pass
    unique = next(iter(participant_sets)) if complete and len(participant_sets) == 1 else ()
    return RigidVacancyScopeC(measured=measured, unique_participant_refs=unique,
        facts=FrozenMap({'incidence_enumeration_complete': complete,
            'geometry_check_count': count, 'approach_origin_count': len(approaches),
            'approach_occupant_count': len(blockers), 'participant_set_count': len(participant_sets),
            'unique_participant_count': len(unique), 'current_body_count': len(bodies),
            'strict_participant_subset': bool(unique) and len(unique) < len(bodies),
            'approach_footprint_cells': tuple(sorted(footprint)),
            'no_route_or_global_impossibility_proof': True}))


def measure_rigid_rearrangement(value: RigidRearrangementInputC) -> RigidRearrangementPreparationC:
    template, identity = value.template, value.query_identity
    native, contract = template.profile.native_request, template.packet_contract
    bodies = {b.body_ref: b for b in native.bodies}
    missing = []
    profile_measurements = measure_d_native_profile(template.profile)
    missing.extend(profile_measurements.missing_refs)
    geometry_work = (sum(len(b.solid_offsets)+len(b.admitted_solid_cells)+len(b.hit_offsets) for b in native.bodies)
        + len(value.directions)*sum(len(b.solid_offsets) for b in native.bodies)
        + len(value.destination_origins)*sum(len(b.solid_offsets) for b in native.bodies if b.body_ref == value.beneficiary_ref))
    if geometry_work > value.maximum_geometry_checks or len(bodies)+len(value.directions) > 256:
        return RigidRearrangementPreparationC(request=value, driver=None,
            facts=FrozenMap({'exact_source_model_bound': False,
                'missing_refs': ('rigid_rearrangement.geometry_or_primitive_domain_bound',),
                'geometry_check_count_required': geometry_work}),
            missing_refs=('rigid_rearrangement.geometry_or_primitive_domain_bound',), displacement_incidences=())
    collision_missing, collision_rows = measure_collision_class_bindings(value.collision_gate, native, contract.model_ref)
    missing.extend(collision_missing)
    if (identity.kernel_ref != 'mechanics.bounded_route_search'
            or identity.operation_ref != 'mechanics.bounded_route_search'
            or identity.mode != 'ROUTE' or identity.expected_return_type != 'SearchResultC'):
        missing.append('rigid_rearrangement.exact_k09_route_signature')
    if not packet_context_equal(identity, template.profile.common_identity, contract.model_ref):
        missing.append('rigid_rearrangement.current_parent_and_model_provenance')
    bounds = identity.actual_bounds
    required_bounds = ('max_states', 'max_candidates', 'max_depth', 'max_events', 'max_primitives')
    if any(type(bounds.get(k)) is not int or bounds[k] < 1 for k in required_bounds):
        missing.append('rigid_rearrangement.complete_finite_work_bounds')
    elif bounds['max_depth'] > value.remaining_primitive_reserve or bounds['max_primitives'] > value.remaining_primitive_reserve:
        missing.append('rigid_rearrangement.path_bounds_exceed_remaining_reserve')
    if value.beneficiary_ref not in bodies:
        missing.append('rigid_rearrangement.beneficiary_in_current_body_domain')
    if len(set(value.destination_origins)) != len(value.destination_origins):
        missing.append('rigid_rearrangement.destination_domain_is_distinct')
    if set(value.selection_hit_offsets) != set(bodies):
        missing.append('rigid_rearrangement.complete_body_hit_binding')
    vectors = tuple(row.vector for row in value.directions)
    if len(set(vectors)) != len(vectors) or set(vectors) != set(native.unit_translation_vectors):
        missing.append('rigid_rearrangement.exact_unit_vector_domain')
    if len({row.action_ref for row in value.directions}) != len(vectors) or value.selection_action_ref in {r.action_ref for r in value.directions}:
        missing.append('rigid_rearrangement.distinct_input_channels')
    occupied = {}
    masks = {}
    for ref, body in sorted(bodies.items()):
        mask = frozenset((body.origin[0]+x, body.origin[1]+y) for x, y in body.solid_offsets)
        masks[ref] = mask
        if not mask or len(mask) != len(body.solid_offsets) or not mask <= set(body.admitted_solid_cells):
            missing.append('rigid_rearrangement.current_complete_admitted_mask.' + ref)
        if tuple(value.selection_hit_offsets.get(ref, ())) not in body.hit_offsets:
            missing.append('rigid_rearrangement.current_hit_offset.' + ref)
        for cell in mask:
            if cell in occupied:
                missing.append('rigid_rearrangement.current_body_overlap')
            occupied[cell] = ref
    if value.beneficiary_ref in bodies:
        beneficiary = bodies[value.beneficiary_ref]
        admitted = set(beneficiary.admitted_solid_cells)
        if any(not {(x+dx, y+dy) for dx, dy in beneficiary.solid_offsets} <= admitted
               for x, y in value.destination_origins):
            missing.append('rigid_rearrangement.destination_whole_mask_admission')
    incidences = []
    for ref, body in sorted(bodies.items()):
        admitted = set(body.admitted_solid_cells)
        for direction in value.directions:
            shifted = frozenset((x+direction.vector[0], y+direction.vector[1]) for x, y in masks[ref])
            peers = tuple(sorted({occupied[cell] for cell in shifted if cell in occupied and occupied[cell] != ref}))
            incidences.append(FrozenMap({'body_ref': ref, 'vector': direction.vector,
                'intersecting_body_refs': peers, 'outside_admission_count': len(shifted-admitted),
                'vacated_cells': tuple(sorted(masks[ref]-shifted)),
                'new_footprint_cells': tuple(sorted(shifted-masks[ref]))}))
    missing = tuple(dict.fromkeys(missing))
    driver = None
    if not missing:
        state = FrozenMap({contract.poses_field: FrozenMap({ref: body.origin for ref, body in sorted(bodies.items())}),
            contract.focus_field: native.native_focus_ref})
        primitives = tuple(SearchPrimitiveC(primitive_ref='mechanical.rigid_select.'+stable_digest(ref),
            action_ref=value.selection_action_ref, data=FrozenMap({'channel': 'CLICK', 'body_ref': ref,
                'hit_offset': value.selection_hit_offsets[ref]}), cost=1) for ref in sorted(bodies))
        primitives += tuple(SearchPrimitiveC(primitive_ref='mechanical.rigid_translate.'+stable_digest(row.vector),
            action_ref=row.action_ref, data=FrozenMap({'channel': 'TRANSLATE', 'translation': row.vector}), cost=1)
            for row in value.directions)
        contract_inputs = FrozenMap({'goal_contract_ref': value.goal_contract_ref,
            'beneficiary_ref': value.beneficiary_ref, 'destination_origins': value.destination_origins,
            'remaining_primitive_reserve': value.remaining_primitive_reserve,
            'evidence_refs': value.evidence_refs, 'cost_dominance_premise_refs': contract.cost_dominance_premise_refs})
        bound_identity = identity.model_copy(update={'immutable_inputs': FrozenMap.overlay(
            {'rigid_rearrangement_contract': contract_inputs}, identity.immutable_inputs)})
        goal = MechanicalPredicateC(predicate_ref=value.goal_predicate_ref,
            field_ref=contract.poses_field, field_path=(value.beneficiary_ref,), comparison='IN',
            expected=value.destination_origins)
        query = SearchDomainInputC(request=bound_identity,
            initial_states=(SearchStateC(state=state, model_ref=contract.model_ref),),
            retained_model_refs=(contract.model_ref,), action_refs=tuple(p.primitive_ref for p in primitives),
            closed_domain=False, predicates=value.preservation_predicates, acceptance_predicates=(goal,),
            deterministic_response_ref=value.deterministic_response_ref)
        driver = SearchDriverInputC(query=query, primitives=primitives,
            providers=(SearchProviderC(model_ref=contract.model_ref,
                kernel_ref=template.profile.common_identity.kernel_ref, template=template),))
    return RigidRearrangementPreparationC(request=value, driver=driver, missing_refs=missing,
        displacement_incidences=tuple(incidences), collision_rule_facts=collision_rows, facts=FrozenMap({
            'exact_source_model_bound': not missing, 'body_count': len(bodies),
            'displacement_incidence_count': len(incidences), 'missing_refs': missing,
            'parent_goal_ref': template.profile.parent_goal_ref,
            'beneficiary_ref': value.beneficiary_ref, 'goal_contract_ref': value.goal_contract_ref,
            'remaining_primitive_reserve': value.remaining_primitive_reserve,
            'collision_exclusion_count': len(native.collision_exclusion_pairs),
            'independent_body_model': not native.containment_supported and all(b.parent_ref is None for b in native.bodies),
            'no_action_authority': True}))


def bound_rigid_rearrangement_request(value: RigidRearrangementSearchBindingC) -> SearchDriverInputC:
    measured = value.measured
    if measured.driver is None or measured.missing_refs:
        raise ValueError('Source must qualify the exact rigid rearrangement model before K09')
    driver = measured.driver
    query = driver.query
    primitives = driver.primitives
    if value.operator_scope_ref == 'UNIQUE_APPROACH_CLEARANCE':
        scope = value.vacancy_scope
        if (scope is None or scope.measured != measured
                or not scope.facts.get('incidence_enumeration_complete')
                or not scope.facts.get('strict_participant_subset')
                or scope.facts.get('participant_set_count') != 1
                or not scope.unique_participant_refs):
            raise ValueError('Source focused domain requires complete current unique incidence scope')
        participants = frozenset(scope.unique_participant_refs)
        primitives = tuple(p for p in primitives
            if p.data.get('channel') != 'CLICK' or p.data.get('body_ref') in participants)
    identity = query.request.model_copy(update={'immutable_inputs':FrozenMap.overlay({
        'route_witness_policy_ref':value.route_witness_policy_ref,
        'pure_rigid_batch':value.pure_rigid_batch,
        'rigid_operator_scope_ref': value.operator_scope_ref,
        'rigid_operator_primitive_refs': tuple(p.primitive_ref for p in primitives),
        'rigid_vacancy_scope_digest': stable_digest(value.vacancy_scope) if value.vacancy_scope else None,
        'restricted_operator_domain': value.operator_scope_ref != 'FULL',
        'route_witness_evidence_digest':stable_digest(value.evidence_refs),
        'primitive_unit_cost_domain':all(p.cost == 1 for p in primitives)},query.request.immutable_inputs)})
    query = query.model_copy(update={'request':identity,'route_witness_policy_ref':value.route_witness_policy_ref,
        'action_refs': tuple(p.primitive_ref for p in primitives),
        'route_witness_evidence_refs':value.evidence_refs})
    return driver.model_copy(update={'query':query,'primitives':primitives,'pure_rigid_batch':value.pure_rigid_batch})


def unresolved_rigid_rearrangement(value: RigidRearrangementUnresolvedInputC) -> MechanicalResponseInput:
    measured = value.measured
    return MechanicalResponseInput(request=measured.request.query_identity,
        returned_identity=measured.request.query_identity, source_status=value.source_status,
        returned_type='SearchResultC', missing_cause=value.missing_cause,
        descriptive_values=FrozenMap({'missing_refs': measured.missing_refs,
            'parent_goal_ref': measured.request.template.profile.parent_goal_ref}),
        distinguishing_question_ref=value.unresolved_question_ref,
        retained_frontier=FrozenMap({'rigid_rearrangement': measured.facts,
            'collision_class_evidence': tuple(row.facts for row in measured.collision_rule_facts)}))
