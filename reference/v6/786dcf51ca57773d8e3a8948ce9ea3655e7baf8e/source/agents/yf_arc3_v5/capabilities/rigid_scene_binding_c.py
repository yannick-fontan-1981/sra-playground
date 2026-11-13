"""Exact assembly of the model explicitly admitted by the Source caller.

No palette, board size, destination, body order or game identifier is supplied
by a creator. Every pose/domain comes from the current geometric measurement;
every mechanical supposition and semantic reference comes from Source facts.
"""
from typing import Literal
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, stable_digest
from .rigid_scene_geometry_c import RigidSceneGeometryC
from .rigid_edit_primitive_d import RigidBodyD, RigidEditPrimitiveRequestD
from .rigid_edit_search_contracts_c import RigidEditSearchTemplateC, RigidEditPacketContractC
from .rigid_rearrangement_c import RigidRearrangementInputC, RigidDirectionBindingC
from .rigid_collision_classes_c import RigidBlockingContactEvidenceC, RigidCollisionClassGateC, RigidCollisionClassRuleC
from .mechanical_family_contracts_d import DMechanicalScope, d_map, d_input_digest
from .mechanical_profile_d import DNativeProfileRequest, DProfileBinding
from .mechanical_request_contracts import MechanicalRequestIdentity
from .mechanical_common_contracts_c import MechanicalEventC


class RigidSceneBindingInputC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.rigid_scene_binding_input_c.v1'
    measured: RigidSceneGeometryC
    source_disposition_ref: Ref
    source_alternative_facts: FrozenMap


class RigidSceneQueryC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.rigid_scene_query_c.v1'
    request: RigidRearrangementInputC
    geometry: RigidSceneGeometryC
    frame_by_body: FrozenMap
    canonical_acquisition_attested: Literal[False] = False


def bind_rigid_scene_query(value: RigidSceneBindingInputC) -> RigidSceneQueryC:
    geometry = value.measured
    facts = value.source_alternative_facts.get(value.source_disposition_ref,FrozenMap())
    spec = facts.get('rigid_scene_model_contract')
    if (not facts.get('applicable') or not spec or not geometry.frame_ref or not geometry.parent_goal_ref
            or not geometry.facts.get('geometry_enumeration_complete')
            or geometry.quantum is None or geometry.lattice_phase is None
            or len(geometry.equal_extent_palette_peer_refs) != 1 or len(geometry.edge_patch_measurements) != 1):
        raise ValueError('Source must admit the current complete rigid scene model before assembly')
    support_kind = spec['collision_support_kind']
    recalled = tuple(geometry.facts.get('source_recalled_collision_evidence_refs', ()))
    if support_kind == 'current_contact':
        if len(geometry.prior_contact_measurements) != 1:
            raise ValueError('Current-contact model lacks its unique measured contact')
    elif support_kind == 'retained_morphology_hypothesis':
        if not recalled or not geometry.source_revalidated_control_frame_ref:
            raise ValueError('Recalled model lacks its Source-bound current revalidation')
    else:
        raise ValueError('Unknown Source collision support kind')
    groups = {g['frame_ref']:g for g in geometry.aligned_groups}
    peer_ref = geometry.equal_extent_palette_peer_refs[0]
    carrier_ref = getattr(geometry, spec['carrier_field'])
    if carrier_ref not in groups or peer_ref not in groups:
        raise ValueError('current motion/peer identity is outside the measured frame domain')
    quantum = geometry.quantum
    phase_row,phase_col = geometry.lattice_phase
    body_refs = {ref:'measurement.rigid_body.'+stable_digest((geometry.frame_ref,ref)) for ref in sorted(groups) if ref != peer_ref}
    beneficiary = body_refs[carrier_ref]
    peer = groups[peer_ref]['frame_bbox']
    destination = ((peer[1]-phase_col)//quantum,(peer[0]-phase_row)//quantum)
    frame_by_body = {}
    bodies = []
    for ref,body_ref in sorted(body_refs.items()):
        group = groups[ref]
        top,left,bottom,right = group['frame_bbox']
        offsets = tuple(group[spec['body_cell_offsets_field']])
        if not group['modal_interior_cell_enumeration_complete'] or not offsets:
            raise ValueError('Source must admit a complete nonempty measured body cell mask')
        bodies.append(RigidBodyD(body_ref=body_ref,origin=((left-phase_col)//quantum,(top-phase_row)//quantum),
            parent_ref=None,solid_offsets=offsets,hit_offsets=offsets,marker_offsets=(),
            admitted_solid_cells=geometry.common_cell_domain+(geometry.palette_peer_cells if body_ref == beneficiary else ())))
        frame_by_body[body_ref] = group
    evidence = (geometry.frame_ref, *recalled)
    revision = stable_digest((geometry,spec))
    token = 'measurement.rigid_query.'+stable_digest((geometry.frame_ref,value.source_disposition_ref,revision))
    scope = DMechanicalScope(request_ref=token,caller_ref=spec['caller_ref'],
        parent_consumer_ref=spec['consumer_ref'],parent_goal_ref=geometry.parent_goal_ref,
        # Source-private calculation identity, never the prior ACT intent or
        # an assertion that a canonical acquisition/contribution was opened.
        parent_contribution_ref=token,
        caller_next_item_ref=spec['next_item_ref'],epoch=geometry.epoch,
        evidence_revision_ref=geometry.frame_ref,model_revision_ref=revision,
        model_status_ref=spec['model_status_ref'],event_owner_ref=spec['event_owner_ref'],
        input_domain_complete=True,assumption_refs=tuple(spec['assumption_refs']))
    vectors = tuple(RigidDirectionBindingC(action_ref=ref,vector=(dc,dr)) for ref,dr,dc in geometry.interface_vectors)
    native = RigidEditPrimitiveRequestD.model_validate(FrozenMap.overlay({
        'scope':scope,'bodies':tuple(bodies),'native_focus_ref':beneficiary,
        'overlap_priority':tuple(b.body_ref for b in bodies),'translation':vectors[0].vector,
        'unit_translation_vectors':tuple(row.vector for row in vectors)},spec['native_parameters']))
    model_ref = spec['model_ref']
    common = MechanicalRequestIdentity.model_validate(FrozenMap.overlay({
        'request_ref':token,'caller_ref':scope.caller_ref,'parent_contribution_ref':scope.parent_contribution_ref,
        'epoch':geometry.epoch,'input_revision_ref':geometry.frame_ref,
        'model_assignments':FrozenMap({'model_ref':model_ref}),
        'immutable_inputs':FrozenMap({'d_native_scope':d_map(scope),'d_input_digest':d_input_digest(native)}),
        'actual_bounds':FrozenMap({k:getattr(native,k) for k in ('node_bound','depth_bound','domain_bound','time_bound_ms')})},
        spec['common_identity_parameters']))
    transport_fields = frozenset(('schema_version','scope','operation_ref','mode_ref','requested_result_type',
        'node_bound','depth_bound','domain_bound','time_bound_ms','resume_frontier'))
    bindings = tuple(DProfileBinding(binding_ref='measurement.rigid_binding.'+stable_digest((token,name)),
        native_path=(name,),value=d_map({'value':getattr(native,name)}),status=spec['binding_status'],
        epoch=geometry.epoch,evidence_revision_ref=geometry.frame_ref,model_revision_ref=revision,
        evidence_refs=evidence,model_ref=model_ref,falsifier_ref=spec['falsifier_ref'])
        for name in sorted(native.model_fields_set-transport_fields))
    profile = DNativeProfileRequest.model_validate(FrozenMap.overlay({
        'native_request':native,'common_identity':common,'parent_goal_ref':scope.parent_goal_ref,
        'parent_contribution_ref':scope.parent_contribution_ref,'caller_ref':scope.caller_ref,
        'question_ref':scope.parent_consumer_ref,'episode_ref':token,'level_scope_ref':token,'scope_ref':token,
        'next_item_ref':scope.caller_next_item_ref,'desired_future':FrozenMap({'body_ref':beneficiary,'origin':destination}),
        'goal_evidence_refs':evidence,'goal_epoch':geometry.epoch,'goal_evidence_revision_ref':geometry.frame_ref,
        'bindings':bindings,'required_binding_refs':tuple(b.binding_ref for b in bindings),
        'required_native_fields':tuple(sorted(native.model_fields_set-transport_fields))},spec['profile_parameters']))
    event = MechanicalEventC.model_validate(FrozenMap.overlay({'occurrence_ref':token,'producer_ref':scope.event_owner_ref,
        'temporal_scope_ref':profile.temporal_scope_ref,'snapshot_ref':geometry.frame_ref},spec['event_parameters']))
    template = RigidEditSearchTemplateC(profile=profile,packet_contract=RigidEditPacketContractC.model_validate(
        FrozenMap.overlay({'model_ref':model_ref,'event_template':event,
            'cost_dominance_premise_refs':scope.assumption_refs},spec['packet_parameters'])))
    remaining = geometry.edge_patch_measurements[0]['after_from_value_count']
    bounds = FrozenMap.overlay({'max_depth':min(remaining,spec['maximum_word_length']),
        'max_primitives':min(remaining,spec['maximum_word_length'])},spec['search_bounds'])
    query = common.model_copy(update={'kernel_ref':spec['search_kernel_ref'],'operation_ref':spec['search_kernel_ref'],
        'mode':'ROUTE','expected_return_type':spec['search_return_type'],'immutable_inputs':FrozenMap(),'actual_bounds':bounds})
    blocking_contact = None
    if support_kind == 'current_contact':
        contact = geometry.prior_contact_measurements[0]
        contact_refs = (geometry.frame_ref,contact['measurement_ref'])
        blocking_contact = RigidBlockingContactEvidenceC(
            mover_ref=body_refs[contact['mover_frame_ref']],peer_ref=body_refs[contact['peer_frame_ref']],
            command_ref=contact['command_ref'],free_translation_evidence_refs=contact_refs,
            blocked_translation_evidence_refs=contact_refs,control_evidence_refs=contact_refs,
            contact_prediction_evidence_refs=contact_refs,
            excluded_competing_cause_refs=tuple(spec['contact_excluded_cause_refs']),
            mover_translation_zero=contact['prior_direction_no_scene_translation'],
            peer_translation_zero=contact['peer_unchanged_during_free_translation'],
            command_context_comparable=contact['same_control_epoch'])
    collision = RigidCollisionClassGateC(membership_kind=spec['membership_kind'],epoch=scope.epoch,
        evidence_revision_ref=scope.evidence_revision_ref,model_revision_ref=scope.model_revision_ref,model_ref=model_ref,
        class_by_body=FrozenMap({b.body_ref:spec['morphology_class_ref'] for b in bodies}),
        membership_evidence_by_body=FrozenMap({b.body_ref:evidence for b in bodies}),
        rules=(RigidCollisionClassRuleC(first_class_ref=spec['morphology_class_ref'],second_class_ref=spec['morphology_class_ref'],
            blocking_contact=blocking_contact,
            outlined_solid_morphology_premise_refs=tuple(spec.get('recalled_morphology_premise_refs', ())),
            selection_decoration_separated_from_body=spec['selection_decoration_separated_from_body'],
            evidence_refs=evidence,falsifier_ref=spec['collision_falsifier_ref']),))
    request = RigidRearrangementInputC(query_identity=query,template=template,beneficiary_ref=beneficiary,
        destination_origins=(destination,),goal_predicate_ref=spec['goal_predicate_ref'],goal_contract_ref=spec['goal_contract_ref'],
        selection_action_ref=spec['selection_action_ref'],selection_hit_offsets=FrozenMap({b.body_ref:(0,0) for b in bodies}),
        directions=vectors,remaining_primitive_reserve=remaining,deterministic_response_ref=spec['response_ref'],
        evidence_refs=evidence,maximum_geometry_checks=spec['maximum_geometry_checks'],collision_gate=collision)
    return RigidSceneQueryC(request=request,geometry=geometry,frame_by_body=FrozenMap(frame_by_body))
