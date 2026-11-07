"""Pure bounded geometry for declared rod, piercing, withdrawal and clearance questions."""

from typing import Literal
from pydantic import Field,model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel,Ref
from .mechanical_family_contracts_a import MechanicalFamilyScope,MechanicalFamilyResult,family_result,missing_supplied_fields

from agents.yf_arc3_v5.capabilities.contracts import (
    PiercingClearanceInput,
    PiercingClearanceMeasurements,
    PiercingIntersectionInput,
    PiercingIntersectionMeasurements,
    PiercingPierceSuccessorInput,
    PiercingPierceSuccessorMeasurements,
    PiercingPieceState,
    PiercingPushSuccessorInput,
    PiercingPushSuccessorMeasurements,
    PiercingRodIntersection,
    PiercingRodState,
    PiercingWithdrawSuccessorInput,
    PiercingWithdrawSuccessorMeasurements,
)


def _translated(positions: tuple[tuple[int, int], ...], delta: tuple[int, int]) -> tuple[tuple[int, int], ...]:
    return tuple((row + delta[0], column + delta[1]) for row, column in positions)


def _rod_material(rod):
    return rod.root_to_tip_positions if rod.rod_footprint_positions is None else rod.rod_footprint_positions


def _material_ordinal(rod, position):
    # The supplied spine already carries root-to-tip order. Off-spine material
    # keeps the nearest supplied axial station; no support is inferred here.
    return min(range(len(rod.root_to_tip_positions)), key=lambda index: (
        abs(position[0] - rod.root_to_tip_positions[index][0]) + abs(position[1] - rod.root_to_tip_positions[index][1]), index))


def measure_piercing_intersections(value: PiercingIntersectionInput) -> PiercingIntersectionMeasurements:
    intersections: list[PiercingRodIntersection] = []
    ordered_by_rod: list[tuple[str, tuple[str, ...]]] = []
    pieces_by_ref = {piece.piece_ref: piece for piece in value.pieces}
    for rod in value.rods:
        indexes = {position: _material_ordinal(rod, position) for position in _rod_material(rod)}
        intersected: list[tuple[int, str]] = []
        for piece in value.pieces:
            positions = tuple(position for position in _rod_material(rod) if position in set(piece.occupied_positions))
            if not positions:
                continue
            first_index = min(indexes[position] for position in positions)
            intersections.append(PiercingRodIntersection(rod_ref=rod.rod_ref, piece_ref=piece.piece_ref, intersection_positions=positions, first_root_index=first_index))
            intersected.append((first_index, piece.piece_ref))
        ordered_by_rod.append((rod.rod_ref, tuple(piece_ref for _, piece_ref in sorted(intersected))))
    requested_rod = next((rod for rod in value.rods if rod.root_ref == value.requested_root_ref), None)
    requested_refs = next((refs for rod_ref, refs in ordered_by_rod if requested_rod and rod_ref == requested_rod.rod_ref), ())
    requested_refs = tuple(ref for ref in requested_refs if requested_rod and requested_rod.rod_ref in pieces_by_ref[ref].support_refs)
    requested_types = tuple(pieces_by_ref[ref].type_ref for ref in requested_refs)
    constrained = set(requested_refs)
    return PiercingIntersectionMeasurements(
        intersections=tuple(intersections), ordered_piece_refs_by_rod=tuple(ordered_by_rod),
        requested_support_ref=requested_rod.rod_ref if requested_rod else None,
        requested_support_piece_refs=requested_refs, requested_support_type_order=requested_types,
        rooted_match=requested_rod is not None and requested_types == value.requested_type_order,
        remaining_unconstrained_piece_refs=tuple(piece.piece_ref for piece in value.pieces if piece.piece_ref not in constrained),
    )


def measure_piercing_push_successor(value: PiercingPushSuccessorInput) -> PiercingPushSuccessorMeasurements:
    contacted, movable = set(value.contacted_piece_refs), set(value.movable_piece_refs)
    translated_refs = tuple(piece.piece_ref for piece in value.pieces if piece.piece_ref in contacted & movable)
    blocked_refs = tuple(piece.piece_ref for piece in value.pieces if piece.piece_ref in contacted - movable)
    resulting = tuple(
        piece.model_copy(update={"occupied_positions": _translated(piece.occupied_positions, value.translation_delta)})
        if piece.piece_ref in set(translated_refs) else piece
        for piece in value.pieces
    )
    return PiercingPushSuccessorMeasurements(resulting_pieces=resulting, translated_piece_refs=translated_refs, blocked_piece_refs=blocked_refs)


def measure_piercing_pierce_successor(value: PiercingPierceSuccessorInput) -> PiercingPierceSuccessorMeasurements:
    candidate = next(piece for piece in value.pieces if piece.piece_ref == value.candidate_piece_ref)
    intersections = tuple(position for position in _rod_material(value.supplied_after_rod) if position in set(candidate.occupied_positions))
    pierced: bool | None
    if not intersections or value.observed_entry_face != value.permitted_entry_face:
        pierced = False
    elif value.supplied_axial_entry_complete is False or value.supplied_entry_attaches is False:
        pierced = False
    elif value.supplied_stop_required is True and candidate.piece_ref not in value.immobilized_piece_refs:
        pierced = False
    elif any(flag is None for flag in (value.supplied_stop_required, value.supplied_axial_entry_complete, value.supplied_entry_attaches)):
        pierced = None
    else:
        pierced = True
    supports = candidate.support_refs
    if pierced and value.supplied_after_rod.rod_ref not in supports:
        supports = (*supports, value.supplied_after_rod.rod_ref)
    resulting = tuple(piece.model_copy(update={"support_refs": supports}) if piece.piece_ref == candidate.piece_ref else piece for piece in value.pieces)
    return PiercingPierceSuccessorMeasurements(resulting_pieces=resulting, pierced=pierced, intersection_positions=intersections, resulting_support_refs=supports)


def measure_piercing_withdraw_successor(value: PiercingWithdrawSuccessorInput) -> PiercingWithdrawSuccessorMeasurements:
    before_rods = {rod.rod_ref: rod for rod in value.before_rods}
    after_rods = {rod.rod_ref: rod for rod in value.supplied_after_rods}
    changed = {ref for ref, rod in sorted(before_rods.items()) if rod != after_rods.get(ref)}
    translations = dict(value.supplied_carry_translation_by_rod)
    conflicting_translations = {
        ref for ref, delta in value.supplied_carry_translation_by_rod
        if any(other_ref == ref and other_delta != delta for other_ref, other_delta in value.supplied_carry_translation_by_rod)
    }
    retained: list[tuple[str, str]] = []
    released: list[tuple[str, str]] = []
    resulting: list[PiercingPieceState] = []
    unresolved: list[str] = []
    for piece in value.pieces:
        positions = piece.occupied_positions
        affected = tuple(ref for ref in piece.support_refs if ref in changed or ref not in before_rods)
        unresolved_piece = any(ref not in before_rods for ref in piece.support_refs) or (bool(affected) and value.supplied_stop_required is None)
        if affected and value.supplied_stop_required is True and piece.piece_ref not in value.immobilized_piece_refs:
            deltas = {translations[ref] for ref in affected if ref in translations}
            if len(deltas) != 1 or any(ref not in translations or ref in conflicting_translations for ref in affected):
                unresolved_piece = True
            else:
                positions = _translated(positions, sorted(deltas)[0])
        # A crossing does not create an attachment. Only input support relations
        # can be retained or released by this supplied conditional model.
        current = tuple(ref for ref in piece.support_refs if ref in after_rods and set(positions) & set(_rod_material(after_rods[ref])))
        carrying = affected and value.supplied_stop_required is True and piece.piece_ref not in value.immobilized_piece_refs
        if carrying and any(ref not in current for ref in piece.support_refs):
            unresolved_piece = True
        if unresolved_piece:
            unresolved.append(piece.piece_ref)
            positions, current = piece.occupied_positions, piece.support_refs
        retained.extend((piece.piece_ref, support) for support in current)
        released.extend((piece.piece_ref, support) for support in piece.support_refs if support not in current)
        resulting.append(piece.model_copy(update={"occupied_positions": positions, "support_refs": current}))
    return PiercingWithdrawSuccessorMeasurements(
        resulting_pieces=tuple(resulting), retained_relations=tuple(retained), released_relations=tuple(released),
        multi_support_piece_refs=tuple(piece.piece_ref for piece in resulting if len(piece.support_refs) > 1),
        world_positions_preserved=all(a.occupied_positions == b.occupied_positions for a, b in zip(value.pieces, resulting)),
        unresolved_piece_refs=tuple(unresolved),
    )


def measure_piercing_clearance(value: PiercingClearanceInput) -> PiercingClearanceMeasurements:
    translated = _translated(value.tool_and_load_positions, value.requested_delta)
    dr,dc=value.requested_delta
    complete=dr==0 or dc==0
    swept=set(translated)
    if complete:
        length=abs(dr)+abs(dc);step=(0 if dr==0 else 1 if dr>0 else -1,0 if dc==0 else 1 if dc>0 else -1)
        swept={point for index in range(length+1) for point in _translated(value.tool_and_load_positions,(index*step[0],index*step[1]))}
    obstacles = tuple(region.obstacle_ref for region in value.obstacles if swept & set(region.occupied_positions))
    pieces = tuple(piece.piece_ref for piece in value.free_pieces if swept & set(piece.occupied_positions))
    return PiercingClearanceMeasurements(translated_positions=translated, blocking_obstacle_refs=obstacles,
        blocking_free_piece_refs=pieces,clear=complete and not obstacles and not pieces,clearance_scope_complete=complete)

class PiercingSupportLaw(FrozenModel):
    piece_ref: Ref
    rod_ref: Ref
    motion_kind: Literal['AXIAL_SLIDE','ORTHOGONAL_TRANSPORT','EXIT_BEYOND_TIP','UNKNOWN']
    transport_delta: tuple[int,int]
    axial_slide_allowed: bool | None
    orthogonal_transport_allowed: bool | None
    exit_beyond_tip_allowed: bool | None
    evidence_ref: Ref | None = None


class PiercingJointInput(FrozenModel):
    before_rods: tuple[PiercingRodState,...] = Field(max_length=128)
    supplied_after_rods: tuple[PiercingRodState,...] = Field(max_length=128)
    pieces: tuple[PiercingPieceState,...] = Field(max_length=128)
    support_laws: tuple[PiercingSupportLaw,...] = Field(max_length=4096)
    control_ref: Ref
    control_evidence_ref: Ref | None
    rail_axis: tuple[int,int]
    control_delta: tuple[int,int]
    piece_overlap_allowed: bool | None = None
    overlap_evidence_ref: Ref | None = None
    @model_validator(mode='after')
    def distinct_bindings(self):
        for rods in (self.before_rods,self.supplied_after_rods):
            if len({r.rod_ref for r in rods})!=len(rods):raise ValueError('one geometry per actual rod')
        if len({p.piece_ref for p in self.pieces})!=len(self.pieces):raise ValueError('distinct current pieces')
        if len({(r.piece_ref,r.rod_ref) for r in self.support_laws})!=len(self.support_laws):raise ValueError('one supplied law per actual piece/rod relation')
        return self


class PiercingStageCandidate(FrozenModel):
    candidate_ref: Ref
    joint_input: PiercingJointInput
    requested_root_ref: Ref
    requested_type_prefix: tuple[Ref,...] = Field(min_length=1,max_length=128)
    storage_rows: tuple[int,...] = Field(max_length=128)
    stop_contact_refs: tuple[Ref,...] = Field(max_length=128)
    extents: tuple[tuple[Ref,int],...] = Field(max_length=128)
    contact_policy_evidence_ref: Ref | None
    clearance_input: PiercingClearanceInput


class PiercingFitCase(FrozenModel):
    model_ref: Ref
    operation_ref: Ref
    native_input: PiercingPushSuccessorInput | PiercingPierceSuccessorInput | PiercingWithdrawSuccessorInput | PiercingJointInput
    observed_pieces: tuple[PiercingPieceState,...] = Field(max_length=128)
    observation_ref: Ref
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    sealed: bool


class PiercingRequest(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.piercing_rooted_order_request.v1'
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    maximum_evaluations: int = Field(ge=1,le=65536)
    maximum_states: int = Field(ge=1,le=4096)
    intersection_input: PiercingIntersectionInput | None = None
    push_input: PiercingPushSuccessorInput | None = None
    pierce_input: PiercingPierceSuccessorInput | None = None
    withdraw_input: PiercingWithdrawSuccessorInput | None = None
    clearance_input: PiercingClearanceInput | None = None
    joint_input: PiercingJointInput | None = None
    staging_candidates: tuple[PiercingStageCandidate,...] = Field(default=(),max_length=4096)
    fit_cases: tuple[PiercingFitCase,...] = Field(default=(),max_length=4096)


PIERCING_OPERATION_MODES={
    'intersection':('MEASURE',),'push_successor':('STEP_INTERNAL',),
    'pierce_successor':('STEP_INTERNAL',),'withdraw_successor':('STEP_INTERNAL',),
    'multi_rod_successor':('STEP_INTERNAL',),'grasp_clearance':('PRECONDITION',),
    'rooted_match':('COMPARE',),'staging_domains':('INVERSE_DOMAIN',),'contact_fit':('FIT',),
}


def _rod_work(rods,pieces):
    # Charge the existing implementation's nested footprint/spine/mask visits.
    return sum(len(_rod_material(r))*(len(r.root_to_tip_positions)+sum(len(p.occupied_positions)+2 for p in pieces)) for r in rods)


def _piercing_work(value):
    if isinstance(value,PiercingIntersectionInput):return _rod_work(value.rods,value.pieces)
    if isinstance(value,PiercingJointInput):return _rod_work(value.before_rods+value.supplied_after_rods,value.pieces)+len(value.support_laws)*max(1,len(value.pieces))+len(value.pieces)*sum(len(p.occupied_positions) for p in value.pieces)
    if isinstance(value,PiercingWithdrawSuccessorInput):return _rod_work(value.before_rods+value.supplied_after_rods,value.pieces)+len(value.supplied_carry_translation_by_rod)**2
    if isinstance(value,PiercingPierceSuccessorInput):return _rod_work((value.supplied_after_rod,),value.pieces)
    if isinstance(value,PiercingPushSuccessorInput):return sum(len(p.occupied_positions)+1 for p in value.pieces)
    dr,dc=value.requested_delta
    sweep=1+abs(dr)+abs(dc) if dr==0 or dc==0 else 1
    return sweep*len(value.tool_and_load_positions)*(1+len(value.free_pieces)+len(value.obstacles))+sum(len(p.occupied_positions) for p in value.free_pieces)+sum(len(o.occupied_positions) for o in value.obstacles)


def _axis(rod):
    if len(rod.root_to_tip_positions)<2:return None
    first,last=rod.root_to_tip_positions[0],rod.root_to_tip_positions[-1]
    delta=(last[0]-first[0],last[1]-first[1])
    if delta==(0,0) or delta[0] and delta[1]:return None
    axis=(0 if delta[0]==0 else 1 if delta[0]>0 else -1,0 if delta[1]==0 else 1 if delta[1]>0 else -1)
    if any((p[0]-first[0])*axis[1]!=(p[1]-first[1])*axis[0] for p in rod.root_to_tip_positions):return None
    return axis


def _beyond_tip(rod,positions):
    axis=_axis(rod)
    if axis is None:return None
    tip=rod.root_to_tip_positions[-1]
    return all((p[0]-tip[0])*axis[0]+(p[1]-tip[1])*axis[1]>0 for p in positions)


def measure_piercing_multi_rod(value: PiercingJointInput):
    before={r.rod_ref:r for r in value.before_rods};after={r.rod_ref:r for r in value.supplied_after_rods}
    laws={(r.piece_ref,r.rod_ref):r for r in value.support_laws};result=[];retained=[];released=[];refused=[];unknown=[]
    if value.control_evidence_ref is None or value.rail_axis==(0,0) or value.control_delta[0]*value.rail_axis[1]!=value.control_delta[1]*value.rail_axis[0]:
        return {'resulting_pieces':value.pieces,'unresolved_piece_refs':tuple(p.piece_ref for p in value.pieces),'missing_refs':('current_handle_rail_degree_of_freedom',),'complete':False}
    for piece in value.pieces:
        bindings=tuple(laws.get((piece.piece_ref,ref)) for ref in piece.support_refs)
        if any(law is None or law.evidence_ref is None or law.motion_kind=='UNKNOWN' or law.rod_ref not in before or law.rod_ref not in after for law in bindings):
            unknown.append(piece.piece_ref);result.append(piece);continue
        deltas={law.transport_delta for law in bindings if law.motion_kind=='ORTHOGONAL_TRANSPORT'}
        if len(deltas)>1:refused.append((piece.piece_ref,'incompatible_simultaneous_transport_deltas'));result.append(piece);continue
        delta=next(iter(deltas)) if deltas else (0,0)
        positions=_translated(piece.occupied_positions,delta);current=[];failure=None;undecided=False
        for law in bindings:
            rod=after[law.rod_ref];axis=_axis(before[law.rod_ref]);intersection=bool(set(positions)&set(_rod_material(rod)))
            if axis is None:undecided=True;break
            if law.motion_kind=='ORTHOGONAL_TRANSPORT':
                if set(_rod_material(rod))!=set(_translated(_rod_material(before[law.rod_ref]),law.transport_delta)):undecided=True;break
                if law.orthogonal_transport_allowed is None:undecided=True;break
                if not law.orthogonal_transport_allowed or law.transport_delta!=delta or delta[0]*axis[0]+delta[1]*axis[1]!=0:failure='orthogonal_transport_constraint';break
            elif law.motion_kind=='AXIAL_SLIDE':
                if law.axial_slide_allowed is None:undecided=True;break
                if not law.axial_slide_allowed or delta[0]*axis[1]!=delta[1]*axis[0]:failure='axial_slide_constraint';break
            if intersection and law.motion_kind!='EXIT_BEYOND_TIP':current.append(law.rod_ref);continue
            if intersection:failure='requested_exit_still_intersects_rod';break
            beyond=_beyond_tip(rod,positions)
            if law.exit_beyond_tip_allowed is None or beyond is None:undecided=True;break
            if not law.exit_beyond_tip_allowed or not beyond:failure='unsupported_or_root_side_exit';break
        if undecided:unknown.append(piece.piece_ref);result.append(piece);continue
        if failure:refused.append((piece.piece_ref,failure));result.append(piece);continue
        resulting=piece.model_copy(update={'occupied_positions':positions,'support_refs':tuple(current)})
        result.append(resulting);retained.extend((piece.piece_ref,ref) for ref in current)
        released.extend((piece.piece_ref,ref) for ref in piece.support_refs if ref not in current)
    # Do not fill an unobserved contact/cascade rule with whole-system rejection.
    overlaps=tuple((a.piece_ref,b.piece_ref) for i,a in enumerate(result) for b in result[i+1:] if set(a.occupied_positions)&set(b.occupied_positions))
    if overlaps and (value.piece_overlap_allowed is not True or value.overlap_evidence_ref is None):
        unknown.extend(ref for pair in overlaps for ref in pair)
    return {'resulting_pieces':tuple(result),'retained_relations':tuple(retained),'released_relations':tuple(released),
        'joint_piece_overlap_pairs':overlaps,'missing_refs':('current_joint_contact_or_cascade_policy',) if overlaps and unknown else (),
        'refused_piece_reasons':tuple(refused),'unresolved_piece_refs':tuple(unknown),'complete':not unknown,
        'partial_projection_only':bool(unknown),'released_identity_preserved':True,'whole_system_rejection_used':False}


def _native_piercing(operation,value):
    if operation in ('intersection','rooted_match'):return measure_piercing_intersections(value)
    if operation=='push_successor':return measure_piercing_push_successor(value)
    if operation=='pierce_successor':return measure_piercing_pierce_successor(value)
    if operation=='withdraw_successor':return measure_piercing_withdraw_successor(value)
    if operation=='multi_rod_successor':return measure_piercing_multi_rod(value)
    return measure_piercing_clearance(value)


def _unresolved_native(operation,value):
    if operation=='grasp_clearance' and not value.clearance_scope_complete:return ('current_diagonal_or_noncardinal_whole_geometry_sweep_law',)
    if operation=='multi_rod_successor':return tuple(value.get('unresolved_piece_refs',()))
    if operation=='withdraw_successor':return value.unresolved_piece_refs
    if operation=='pierce_successor':return ('current_entry_and_immobilization_law',) if value.pierced is None else ()
    if operation in ('intersection','rooted_match'):
        stations={}
        for row in value.intersections:stations.setdefault((row.rod_ref,row.first_root_index),[]).append(row.piece_ref)
        return ('unique_root_to_tip_order_at_equal_station',) if any(len(refs)>1 for _,refs in sorted(stations.items())) else ()
    return ()


def measure_piercing_rooted_order(request: PiercingRequest) -> MechanicalFamilyResult:
    prefix='mechanics.piercing_rooted_order.'
    operation=request.operation_ref[len(prefix):] if request.operation_ref.startswith(prefix) else ''
    if operation not in PIERCING_OPERATION_MODES or request.mode not in PIERCING_OPERATION_MODES[operation]:return family_result(request,signature_supported=False,domain_complete=False)
    field={'intersection':'intersection_input','rooted_match':'intersection_input','push_successor':'push_input','pierce_successor':'pierce_input','withdraw_successor':'withdraw_input','multi_rod_successor':'joint_input','grasp_clearance':'clearance_input','staging_domains':'staging_candidates','contact_fit':'fit_cases'}[operation]
    missing=missing_supplied_fields(request,(field,))
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    if operation in ('staging_domains','contact_fit'):return _piercing_domain(request,operation)
    native_input=getattr(request,field);work=_piercing_work(native_input)
    if work>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':operation,'required_geometry_work':work})
    value=_native_piercing(operation,native_input);debt=_unresolved_native(operation,value)
    return family_result(request,values={'measurement':value,'supported_rooted_match':value.rooted_match if operation=='rooted_match' and not debt else None,
        'work_charge_is_conservative_geometry_visits':True,'source_owned_selection_required':True},
        prerequisite_refs=debt,examined_count=work,domain_complete=not debt)


def _piercing_domain(request,operation):
    rows=[];debt=[];count=0;cut={}
    candidates=request.staging_candidates if operation=='staging_domains' else request.fit_cases
    for index,candidate in enumerate(candidates):
        if len(rows)>=request.maximum_states:cut={'phase':operation,'next_candidate_index':index};break
        if operation=='staging_domains':
            value=candidate.joint_input;work=_piercing_work(value)+_piercing_work(candidate.clearance_input)
            # Account for the subsequent rooted sequence measurement too.
            work+=_rod_work(value.supplied_after_rods,value.pieces)
            if count+work>request.maximum_evaluations:cut={'phase':operation,'next_candidate_index':index};break
            joint=measure_piercing_multi_rod(value);clearance=measure_piercing_clearance(candidate.clearance_input)
            rooted=measure_piercing_intersections(PiercingIntersectionInput(rods=value.supplied_after_rods,pieces=joint['resulting_pieces'],
                requested_root_ref=candidate.requested_root_ref,requested_type_order=candidate.requested_type_prefix))
            unresolved=_unresolved_native('multi_rod_successor',joint)+_unresolved_native('rooted_match',rooted)
            unresolved+=_unresolved_native('grasp_clearance',clearance)
            changed={r.rod_ref for r in value.supplied_after_rods if next((old for old in value.before_rods if old.rod_ref==r.rod_ref),None)!=r}
            required_mask={point for r in value.supplied_after_rods if r.rod_ref in changed for point in _rod_material(r)}|{point for p in joint['resulting_pieces'] if any(ref in changed for ref in p.support_refs) for point in p.occupied_positions}
            if not required_mask.issubset(set(clearance.translated_positions)):unresolved+=('same_candidate_whole_tool_and_load_clearance',)
            if candidate.contact_policy_evidence_ref is None:unresolved+=('current_stop_contact_policy',)
            row={'candidate_ref':candidate.candidate_ref,'storage_rows':candidate.storage_rows,'stop_contact_refs':candidate.stop_contact_refs,'extents':candidate.extents,
                'joint_projection':joint,'clearance':clearance,'rooted_sequence':rooted,'could_enable_requested_prefix':None if unresolved else
                clearance.clear and rooted.requested_support_ref is not None and rooted.requested_support_type_order[:len(candidate.requested_type_prefix)]==candidate.requested_type_prefix,
                'missing_refs':unresolved,'route_proven':False}
        else:
            value=candidate.native_input;short=candidate.operation_ref[len('mechanics.piercing_rooted_order.'):] if candidate.operation_ref.startswith('mechanics.piercing_rooted_order.') else ''
            expected={'push_successor':PiercingPushSuccessorInput,'pierce_successor':PiercingPierceSuccessorInput,'withdraw_successor':PiercingWithdrawSuccessorInput,'multi_rod_successor':PiercingJointInput}
            if short not in expected or not isinstance(value,expected[short]):
                debt.append('exact_fitted_operation_and_native_input');continue
            if not candidate.sealed or candidate.event_owner_ref!=request.scope.event_owner_ref or candidate.epoch!=request.scope.epoch:
                debt.append('sealed_owned_fit_observation');continue
            work=_piercing_work(value)
            if count+work>request.maximum_evaluations:cut={'phase':operation,'next_candidate_index':index};break
            measurement=_native_piercing(short,value);unresolved=_unresolved_native(short,measurement)
            pieces=measurement['resulting_pieces'] if isinstance(measurement,dict) else measurement.resulting_pieces
            row={'model_ref':candidate.model_ref,'observation_ref':candidate.observation_ref,'matches':None if unresolved else pieces==candidate.observed_pieces,
                'missing_refs':unresolved,'unobserved_control_combinations_generalized':False}
        count+=work;rows.append(row);debt.extend(unresolved)
    return family_result(request,values={'candidate_results':tuple(rows),'minimum_cost_proven':False,'supported_witness_is_not_exhaustive_transfer':True},
        prerequisite_refs=tuple(dict.fromkeys(debt)),examined_count=count,domain_complete=not debt and not cut,
        computation_bound_reached=bool(cut),frontier=cut)
