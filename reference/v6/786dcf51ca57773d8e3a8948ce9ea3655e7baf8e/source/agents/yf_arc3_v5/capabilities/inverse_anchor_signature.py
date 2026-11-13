"""K25 source-supplied anchor geometry, spatial writes and stock-feasible domains."""
from typing import Literal
from pydantic import Field,model_validator
import hashlib,json
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref,immutable_json_data
from .contracts import (Position,RationalAnchorDependenceInput,InverseMeanAnchorDomainInput,
    InverseAnchorTypedClearanceInput,InverseAnchorSuccessorInput,InverseAnchorWaypointCandidatesInput)
from .inverse_anchor import measure_rational_anchor_dependence,enumerate_inverse_mean_anchor_domain
from .inverse_anchor_signature_extensions import (measure_inverse_anchor_typed_clearance,
    measure_inverse_anchor_successor,measure_inverse_anchor_waypoint_candidates)
from .mechanical_family_contracts_a import MechanicalFamilyScope,MechanicalFamilyResult,family_result,missing_supplied_fields


class AnchorEndpoint(FrozenModel):
    wire_ref: Ref
    endpoint_positions: tuple[tuple[Position,...],tuple[Position,...]]
    occluded_ends: tuple[bool,bool]
    owner_alternatives: tuple[tuple[Ref,...],tuple[Ref,...]]=((),())


class AnchorComponent(FrozenModel):
    component_ref: Ref
    system_ref: Ref
    footprint: tuple[Position,...]=Field(min_length=1,max_length=4096)


class AnchorWrite(FrozenModel):
    resource_ref: Ref
    region_writes: tuple[tuple[Position,Ref|None],...]=Field(max_length=4096)
    consumed_count: int=Field(ge=0)
    evidence_refs: tuple[Ref,...]=Field(min_length=1,max_length=64)
    @model_validator(mode='after')
    def validate_write(self):
        if len({p for p,_ in self.region_writes})!=len(self.region_writes):raise ValueError('each written region is distinct')
        return self


class AnchorInventory(FrozenModel):
    resource_ref: Ref
    available_count: int=Field(ge=0)


class AnchorConstructionCandidate(FrozenModel):
    candidate_ref: Ref
    target_signature: tuple[tuple[Position,Ref],...]=Field(max_length=4096)
    writes: tuple[AnchorWrite,...]=Field(max_length=256)
    @model_validator(mode='after')
    def validate_target(self):
        if len({p for p,_ in self.target_signature})!=len(self.target_signature):raise ValueError('target regions must be unique')
        return self


class AnchorContinuation(FrozenModel):
    phase: Literal['ENDPOINTS','INVERSE','CONSTRUCTION','UNSTARTED']
    input_digest: Ref
    item_index: int=0
    sub_index: int=Field(default=0,ge=0)
    completed_rows: tuple[FrozenMap,...]=()
    compatible_positions: tuple[Position,...]=()
    current_signature: tuple[tuple[Position,Ref],...]=()
    current_inventory: tuple[AnchorInventory,...]=()
    current_blockers: tuple[Ref,...]=()
    prerequisite_refs: tuple[Ref,...]=()
    accounted_evaluations: int=Field(default=0,ge=0)
    @model_validator(mode='after')
    def validate_cursor(self):
        if self.phase!='INVERSE' and self.item_index<0:raise ValueError('only an inverse world row may be negative')
        return self


class AnchorRequest(FrozenModel):
    schema_version: Ref='yf_arc3_v5.inverse_anchor_signature_request.v1'
    scope: MechanicalFamilyScope
    source_identity_ref: Ref
    operation_ref: Ref
    mode: Ref|None=None
    maximum_evaluations: int=Field(default=65536,ge=1,le=65536)
    maximum_states: int=Field(default=4096,ge=1,le=4096)
    endpoints: tuple[AnchorEndpoint,...]=Field(default=(),max_length=256)
    components: tuple[AnchorComponent,...]=Field(default=(),max_length=256)
    dependence: RationalAnchorDependenceInput|None=None
    dependence_evidence_refs: tuple[Ref,...]=Field(default=(),max_length=64)
    mean_domain: InverseMeanAnchorDomainInput|None=None
    mean_evidence_refs: tuple[Ref,...]=Field(default=(),max_length=64)
    clearance: InverseAnchorTypedClearanceInput|None=None
    anchor_mask_offsets: tuple[Position,...]=Field(default=(),max_length=4096)
    beacon_mask_offsets: tuple[Position,...]=Field(default=(),max_length=4096)
    signature: tuple[tuple[Position,Ref],...]=Field(default=(),max_length=4096)
    write: AnchorWrite|None=None
    inventory: tuple[AnchorInventory,...]=Field(default=(),max_length=256)
    construction_candidates: tuple[AnchorConstructionCandidate,...]=Field(default=(),max_length=256)
    successor: InverseAnchorSuccessorInput|None=None
    successor_signature_writes: tuple[AnchorWrite,...]=Field(default=(),max_length=256)
    waypoints: InverseAnchorWaypointCandidatesInput|None=None
    resume: AnchorContinuation|None=None
    @model_validator(mode='after')
    def validate_unique(self):
        for values,name in (([p for p,_ in self.signature],'signature regions'),([x.resource_ref for x in self.inventory],'inventory refs'),
            ([x.candidate_ref for x in self.construction_candidates],'candidate refs'),([x.component_ref for x in self.components],'component refs')):
            if len(values)!=len(set(values)):raise ValueError(name+' must be unique')
        if any(len(end)>4096 for wire in self.endpoints for end in wire.endpoint_positions):raise ValueError('endpoint mask bound exceeded')
        return self


ANCHOR_OPERATION_MODES={'endpoint_measurement':('MEASURE',),'forward_dependence':('STEP_INTERNAL',),
    'inverse_domains':('INVERSE_DOMAIN',),'typed_clearance':('PRECONDITION',),
    'signature_composition':('STEP_INTERNAL',),'constructibility':('INVERSE_DOMAIN',),
    'successor':('STEP_INTERNAL',),'waypoint_candidates':('INVERSE_DOMAIN',)}


def _anchor_digest(request):
    value=request.model_dump(mode='json',exclude={'resume','maximum_evaluations','maximum_states'})
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()


def _anchor_resume(request,phase,**fields):
    fields['completed_rows']=tuple(immutable_json_data(row) for row in fields.get('completed_rows',()))
    return AnchorContinuation(phase=phase,input_digest=_anchor_digest(request),**fields)


def _anchor_write(signature,inventory,write):
    stock={x.resource_ref:x.available_count for x in inventory}
    if write.resource_ref not in stock:return signature,inventory,('known_pickup_resource_identity',)
    if stock[write.resource_ref]<write.consumed_count:return signature,inventory,('resource_stock_conflict',)
    result=dict(signature)
    for position,colour in write.region_writes:
        if colour is not None:result[position]=colour
    stock[write.resource_ref]-=write.consumed_count
    return tuple(sorted(result.items())),tuple(x.model_copy(update={'available_count':stock[x.resource_ref]}) for x in inventory),()


def _anchor_endpoints(request):
    resume=request.resume if request.resume is not None and request.resume.phase=='ENDPOINTS' else None
    rows=list(resume.completed_rows) if resume is not None else [];debt=list(resume.prerequisite_refs) if resume is not None else []
    count=resume.accounted_evaluations if resume is not None else 0
    for index in range(resume.item_index if resume is not None else 0,len(request.endpoints)):
        wire=request.endpoints[index];work=1+sum(len(end) for end in wire.endpoint_positions)+sum(len(c.footprint) for c in request.components)*2
        if count+work>request.maximum_evaluations or len(rows)>=request.maximum_states:
            token=_anchor_resume(request,'ENDPOINTS',item_index=index,completed_rows=tuple(rows),prerequisite_refs=tuple(dict.fromkeys(debt)),accounted_evaluations=count)
            return family_result(request,values={'wire_endpoint_correspondences':tuple(rows)},prerequisite_refs=tuple(dict.fromkeys(debt)),examined_count=count,
                domain_complete=False,computation_bound_reached=True,frontier={'continuation':token})
        count+=work;ends=[]
        for side,positions in enumerate(wire.endpoint_positions):
            observed=tuple(c.component_ref for c in request.components if set(positions)&set(c.footprint))
            supplied=wire.owner_alternatives[side]
            alternatives=tuple(dict.fromkeys(observed+supplied)) if wire.occluded_ends[side] else observed
            systems=tuple(dict.fromkeys(c.system_ref for c in request.components if c.component_ref in alternatives))
            resolved=len(alternatives)==1 and not wire.occluded_ends[side]
            if not resolved:debt.append('resolved_wire_endpoint_ownership')
            ends.append({'owner_refs':alternatives,'system_refs':systems,'occluded':wire.occluded_ends[side],'unique_visible_owner':alternatives[0] if resolved else None})
        rows.append({'wire_ref':wire.wire_ref,'endpoints':tuple(ends),'interior_crossings_promoted_to_junctions':False})
    return family_result(request,values={'wire_endpoint_correspondences':tuple(rows)},prerequisite_refs=tuple(dict.fromkeys(debt)),examined_count=count,domain_complete=not debt)


def _anchor_inverse(request):
    if not request.mean_evidence_refs:return family_result(request,prerequisite_refs=('established_scoped_mean_relation_and_quantizer',),domain_complete=False)
    domain=request.mean_domain;top,left=domain.candidate_top_left;bottom,right=domain.candidate_bottom_right
    resume=request.resume if request.resume is not None and request.resume.phase=='INVERSE' else None
    compatible=list(resume.compatible_positions) if resume is not None else []
    count=resume.accounted_evaluations if resume is not None else 0
    width=right-left+1;work=width*(len(domain.fixed_anchor_positions)+2)
    for row in range(resume.item_index if resume is not None else top,bottom+1):
        if count+work>request.maximum_evaluations or len(compatible)+width>request.maximum_states:
            token=_anchor_resume(request,'INVERSE',item_index=row,compatible_positions=tuple(compatible),accounted_evaluations=count)
            return family_result(request,values={'compatible_anchor_positions':tuple(compatible)},examined_count=count,domain_complete=False,computation_bound_reached=True,frontier={'continuation':token})
        chunk=domain.model_copy(update={'candidate_top_left':(row,left),'candidate_bottom_right':(row,right)})
        result=enumerate_inverse_mean_anchor_domain(chunk);count+=work;compatible.extend(result.compatible_positions)
    return family_result(request,values={'compatible_anchor_positions':tuple(compatible),'domain_exhaustive':True,'unique_inverse_assumed':False},examined_count=count)


def _anchor_construction(request):
    resume=request.resume if request.resume is not None and request.resume.phase=='CONSTRUCTION' else None
    rows=list(resume.completed_rows) if resume is not None else [];count=resume.accounted_evaluations if resume is not None else 0
    for index in range(resume.item_index if resume is not None else 0,len(request.construction_candidates)):
        candidate=request.construction_candidates[index];continuing=resume is not None and index==resume.item_index
        signature=resume.current_signature if continuing else request.signature
        stock=resume.current_inventory if continuing else request.inventory;blockers=list(resume.current_blockers) if continuing else []
        start=resume.sub_index if continuing else 0
        for part in range(start,len(candidate.writes)+1):
            work=(1+len(signature)+len(stock)+len(candidate.target_signature)) if part==len(candidate.writes) else 1+len(signature)+len(stock)+len(candidate.writes[part].region_writes)
            if count+work>request.maximum_evaluations or len(rows)>=request.maximum_states:
                token=_anchor_resume(request,'CONSTRUCTION',item_index=index,sub_index=part,current_signature=signature,current_inventory=stock,
                    current_blockers=tuple(dict.fromkeys(blockers)),completed_rows=tuple(rows),accounted_evaluations=count)
                return family_result(request,values={'signature_assignment_candidates':tuple(rows),'input_candidate_domain_exhaustive':request.scope.input_domain_complete},
                    examined_count=count,domain_complete=False,computation_bound_reached=True,frontier={'continuation':token})
            count+=work
            if part<len(candidate.writes):
                signature,stock,debt=_anchor_write(signature,stock,candidate.writes[part]);blockers.extend(debt)
            else:
                current=dict(signature);missing=tuple((p,colour) for p,colour in candidate.target_signature if current.get(p)!=colour)
                rows.append({'candidate_ref':candidate.candidate_ref,'stock_feasible':not blockers,'target_compatible':not blockers and not missing,
                    'result_signature':signature,'remaining_inventory':stock,'missing_spatial_regions':missing,'blocker_refs':tuple(dict.fromkeys(blockers))})
    debt=('known_pickup_resource_identity',) if any('known_pickup_resource_identity' in row['blocker_refs'] for row in rows) else ()
    return family_result(request,values={'signature_assignment_candidates':tuple(rows),'input_candidate_domain_exhaustive':request.scope.input_domain_complete},
        prerequisite_refs=debt,examined_count=count,domain_complete=request.scope.input_domain_complete and not debt)


def _measure_inverse_anchor_signature(request):
    prefix='mechanics.inverse_anchor_signature.'
    operation=request.operation_ref[len(prefix):] if request.operation_ref.startswith(prefix) else ''
    if operation not in ANCHOR_OPERATION_MODES or request.mode not in ANCHOR_OPERATION_MODES[operation]:return family_result(request,signature_supported=False,domain_complete=False)
    fields={'endpoint_measurement':('endpoints','components'),'forward_dependence':('dependence','dependence_evidence_refs'),
        'inverse_domains':('mean_domain','mean_evidence_refs'),'typed_clearance':('clearance',),
        'signature_composition':('signature','write','inventory'),'constructibility':('signature','inventory','construction_candidates'),
        'successor':('successor',),'waypoint_candidates':('waypoints',)}[operation]
    missing=missing_supplied_fields(request,fields)
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    if operation=='endpoint_measurement':return _anchor_endpoints(request)
    if operation=='inverse_domains':return _anchor_inverse(request)
    if operation=='constructibility':return _anchor_construction(request)
    if operation=='forward_dependence':work=1+len(request.dependence.anchor_positions)
    elif operation=='typed_clearance':work=1+len(request.clearance.anchor_footprint)+len(request.clearance.dependent_footprint)+len(request.clearance.anchor_allowed_positions)+len(request.clearance.dependent_allowed_positions)+sum(len(f) for f in request.clearance.dependent_swept_footprints)
    elif operation=='signature_composition':work=1+len(request.signature)+len(request.inventory)+len(request.write.region_writes)
    elif operation=='waypoint_candidates':work=1+sum(len(c.required_corridor_constraint_refs)+len(c.satisfied_corridor_constraint_refs) for c in request.waypoints.candidates)
    else:work=1+sum(len(s.anchor_positions)+len(s.dependent_signature)+sum(len(w.raster_positions) for w in s.wires) for s in request.successor.systems)+sum(len(w.region_writes)+len(request.inventory) for w in request.successor_signature_writes)+(len(request.dependence.anchor_positions) if request.dependence is not None else 0)
    if operation=='successor' and request.clearance is not None:
        work+=len(request.clearance.anchor_footprint)+len(request.clearance.dependent_footprint)+len(request.clearance.anchor_allowed_positions)+len(request.clearance.dependent_allowed_positions)+sum(len(f) for f in request.clearance.dependent_swept_footprints)+len(request.anchor_mask_offsets)+len(request.beacon_mask_offsets)
    if work>request.maximum_evaluations:return family_result(request,examined_count=0,domain_complete=False,computation_bound_reached=True,frontier={'required_work':work})
    if operation=='forward_dependence':
        result=measure_rational_anchor_dependence(request.dependence)
        return family_result(request,values={'rational_dependence':result,'unrounded_coordinates_retained':True,'quantization_applications':1},examined_count=work)
    if operation=='typed_clearance':
        result=measure_inverse_anchor_typed_clearance(request.clearance);debt=('evidenced_beacon_transition_path_policy',) if result.transition_path_status=='unknown' else ()
        return family_result(request,values={'typed_clearance':result},prerequisite_refs=debt,domain_complete=not debt,examined_count=work)
    if operation=='signature_composition':
        signature,stock,debt=_anchor_write(request.signature,request.inventory,request.write)
        return family_result(request,values={'result_signature':signature,'remaining_inventory':stock,'neutral_locations_written':False},prerequisite_refs=debt,examined_count=work,domain_complete=not debt)
    if operation=='waypoint_candidates':
        result=measure_inverse_anchor_waypoint_candidates(request.waypoints);debt=('evidenced_corridor_transition',) if result.uncertain_candidate_refs else ()
        return family_result(request,values={'waypoint_candidates':result},prerequisite_refs=debt,examined_count=work,domain_complete=not debt)
    packet=request.successor
    if request.successor_signature_writes and 'inventory' not in request.model_fields_set:
        return family_result(request,prerequisite_refs=('supplied_pickup_inventory',),domain_complete=False,examined_count=work)
    if packet.operator_kind=='place_active_anchor':
        missing=missing_supplied_fields(request,('dependence','dependence_evidence_refs','clearance','anchor_mask_offsets','beacon_mask_offsets'))
        if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False,examined_count=work)
        affected=next(s for s in packet.systems if s.system_ref==packet.affected_system_ref)
        positions=tuple(packet.destination if ref==packet.requested_anchor_ref else pos for ref,pos in affected.anchor_positions)
        if positions!=request.dependence.anchor_positions:return family_result(request,prerequisite_refs=('dependence_bound_to_requested_anchor_configuration',),domain_complete=False,examined_count=work)
        derived=measure_rational_anchor_dependence(request.dependence)
        if derived.quantized_position!=packet.supplied_dependent_position:return family_result(request,prerequisite_refs=('consistent_supplied_beacon_destination',),domain_complete=False,examined_count=work)
        anchor_footprint={(packet.destination[0]+r,packet.destination[1]+c) for r,c in request.anchor_mask_offsets}
        beacon_footprint={(derived.quantized_position[0]+r,derived.quantized_position[1]+c) for r,c in request.beacon_mask_offsets}
        if anchor_footprint!=set(request.clearance.anchor_footprint) or beacon_footprint!=set(request.clearance.dependent_footprint):
            return family_result(request,prerequisite_refs=('typed_clearance_bound_to_complete_destination_masks',),domain_complete=False,examined_count=work)
        clearance=measure_inverse_anchor_typed_clearance(request.clearance)
        if clearance.transition_path_status=='unknown':return family_result(request,prerequisite_refs=('evidenced_beacon_transition_path_policy',),domain_complete=False,examined_count=work)
        if not clearance.anchor_destination_clear or not clearance.dependent_destination_clear or clearance.transition_path_status=='blocked':
            return family_result(request,values={'placement_clear':False,'unchanged_systems':packet.systems,'typed_clearance':clearance},examined_count=work)
    result=measure_inverse_anchor_successor(packet);stock=request.inventory;debt=()
    systems=[]
    for system in result.resulting_systems:
        if system.system_ref==packet.affected_system_ref and packet.operator_kind=='place_active_anchor':
            signature=system.dependent_signature
            for write in request.successor_signature_writes:
                signature,stock,missing=_anchor_write(signature,stock,write);debt+=missing
            system=system.model_copy(update={'dependent_signature':signature})
        systems.append(system)
    if debt:return family_result(request,values={'unchanged_systems':packet.systems},prerequisite_refs=tuple(dict.fromkeys(debt)),examined_count=work,domain_complete=False)
    return family_result(request,values={'resulting_systems':tuple(systems),'remaining_inventory':stock,'unaffected_system_refs':result.unaffected_system_refs},examined_count=work)


def measure_inverse_anchor_signature(request: AnchorRequest) -> MechanicalFamilyResult:
    if request.resume is not None and request.resume.input_digest!=_anchor_digest(request):return family_result(request,prerequisite_refs=('same_source_scope_revision_and_anchor_inputs',),domain_complete=False)
    offset=request.resume.accounted_evaluations if request.resume is not None and request.resume.phase=='UNSTARTED' else 0
    if offset>=request.maximum_evaluations:return family_result(request,examined_count=offset,domain_complete=False,computation_bound_reached=True,frontier={'continuation':request.resume})
    bounded=request.model_copy(update={'maximum_evaluations':request.maximum_evaluations-offset}) if offset else request
    result=_measure_inverse_anchor_signature(bounded)
    if offset:result=result.model_copy(update={'examined_count':result.examined_count+offset})
    if result.computation_bound_reached and 'continuation' not in result.frontier:
        result=result.model_copy(update={'frontier':immutable_json_data({**dict(result.frontier),'continuation':_anchor_resume(request,'UNSTARTED',accounted_evaluations=result.examined_count)})})
    return result
