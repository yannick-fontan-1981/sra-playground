"""Measure a Source-bound physical interval, without fabricating observations."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref,TermKind,stable_digest,immutable_json_data
from agents.yf_arc3_v5.logos.operations import ActionIntent,EnvironmentActionDispatchedRecord
from .sealed_interval_measurement import measure_sealed_interval_candidate


class SealedTransactionBinding(FrozenModel):
    dispatch_record_ref: Ref
    pre_state_ref: Ref
    post_state_ref: Ref
    observation_record_refs: tuple[Ref,...] = Field(min_length=1,max_length=256)


class SealedIntervalProductionRequest(FrozenModel):
    packet_term_ref: Ref
    packet_projection_contract_ref: Ref
    state_projection_contract_ref: Ref
    interval_ref: Ref
    timeline_ref: Ref
    expected_packet_fields: FrozenMap
    transaction_bindings: tuple[SealedTransactionBinding,...] = Field(min_length=1,max_length=256)
    evidence_refs: tuple[Ref,...] = Field(default=(),max_length=256)
    unresolved_bindings: tuple[Ref,...] = Field(default=(),max_length=256)


def coerce_request(value):
    return value if isinstance(value,SealedIntervalProductionRequest) else SealedIntervalProductionRequest.model_validate(value)


def measure_production(store,value,current_frame_ref):
    request=coerce_request(value); snapshot=store.snapshot; rows=[];missing=list(request.unresolved_bindings);basis=list(request.evidence_refs)
    expected=request.expected_packet_fields
    for index,binding in enumerate(request.transaction_bindings):
        prefix='interval.transaction.'+str(index)+'.'
        dispatch=store.artifact(binding.dispatch_record_ref)
        if not isinstance(dispatch,EnvironmentActionDispatchedRecord):
            missing.append(prefix+'actual_dispatch');continue
        intent=store.artifact(dispatch.action_intent_id)
        before=snapshot.term(binding.pre_state_ref);after=snapshot.term(binding.post_state_ref)
        if not isinstance(intent,ActionIntent):missing.append(prefix+'actual_intent');continue
        if before is None or after is None or before.kind is not TermKind.VALUE or after.kind is not TermKind.VALUE:
            missing.append(prefix+'canonical_state_pair');continue
        if 'state' not in before.attributes or 'state' not in after.attributes:
            missing.append(prefix+'full_state_projection');continue
        rows.append(FrozenMap({'before':before.attributes['state'],'after':after.attributes['state'],
            'action_ref':dispatch.action_ref,'action_payload':intent.action_data,
            'pre_state_ref':binding.pre_state_ref,'post_state_ref':binding.post_state_ref,
            'before_frame_ref':before.attributes.get('frame_ref'),'after_frame_ref':after.attributes.get('frame_ref'),
            'dispatch_record_ref':binding.dispatch_record_ref,'observation_record_refs':binding.observation_record_refs}))
        basis.extend((binding.dispatch_record_ref,dispatch.action_intent_id,binding.pre_state_ref,
            binding.post_state_ref,*binding.observation_record_refs))
    if len(rows)!=len(request.transaction_bindings):missing.append('interval.complete_transaction_population')
    transactions=tuple(rows)
    packet=FrozenMap({**expected,'interval_ref':request.interval_ref,'timeline_ref':request.timeline_ref,
        'transactions':transactions,'pre_state_ref':transactions[0]['pre_state_ref'] if transactions else None,
        'expected_action_ref':transactions[0]['action_ref'] if transactions else None})
    epoch=expected.get('epoch')
    if type(epoch) is not int or epoch<0:missing.append('interval.explicit_epoch')
    measured=measure_sealed_interval_candidate(store,packet=packet,state_projection_contract_ref=request.state_projection_contract_ref,
        expected_packet_fields=FrozenMap({**expected,'transactions':transactions}),transactions=transactions,
        epoch=epoch,current_frame_ref=current_frame_ref)
    missing.extend(measured['missing_refs'])
    term=snapshot.term(request.packet_term_ref)
    compatible=term is None or (term.kind is TermKind.VALUE and
        term.attributes.get('projection_contract_ref')==request.packet_projection_contract_ref)
    equal=term is not None and compatible and term.attributes.get('packet')==packet
    if not compatible or (term is not None and not equal):missing.append('canonical.packet_reference_collision')
    basis=tuple(dict.fromkeys(basis))
    if len(basis)>256:missing.append('interval.bounded_evidence_basis');basis=()
    for ref in basis:
        if snapshot.term(ref) is None and store.artifact(ref) is None and snapshot.claim(ref) is None:
            missing.append('interval.available_evidence.'+ref)
    return FrozenMap({**expected,'packet_term_ref':request.packet_term_ref,
        'packet_projection_contract_ref':request.packet_projection_contract_ref,'packet':packet,
        'packet_digest':stable_digest(packet),'production_bindings_current':not missing,
        'canonical_packet_equal':equal,'missing_refs':tuple(dict.fromkeys(missing)),
        'evidence_refs':basis,'existing_term_refs':tuple(ref for ref in (expected.get('parent_goal_ref'),request.packet_term_ref)
            if ref is not None and snapshot.term(ref) is not None),
        'affected_dependency_refs':(),'sibling_item_refs':(), 'no_dispatch_or_action_authority':True})


def production_result(store,value,measured,source_disposition_ref):
    request=coerce_request(value);term=store.snapshot.term(request.packet_term_ref)
    equal=term is not None and term.kind is TermKind.VALUE and term.attributes.get('projection_contract_ref')==request.packet_projection_contract_ref and term.attributes.get('packet')==measured['packet']
    return FrozenMap({'packet_term_ref':request.packet_term_ref,'packet_digest':measured['packet_digest'],
        'source_disposition_ref':source_disposition_ref,'canonical_packet_equal':equal,
        'state_revision':store.snapshot.revision,'missing_refs':measured['missing_refs'],
        'no_interpretation_qualification':True,'no_dispatch_or_action_authority':True})


def read_b_production(value):
    from agents.yf_arc3_v5.capabilities.mechanical_profile_b import coerce_profile
    profile=coerce_profile(value); raw=profile.sealed_interval_production_request
    if raw is None:return FrozenMap({'phase':profile.phase,'has_request':False,'request':None})
    request=coerce_request(raw);missing=list(request.unresolved_bindings);native=profile.kernel_request
    expected={'parent_goal_ref':profile.parent_goal_ref,'scope_ref':profile.scope_ref,'epoch':native.epoch,
        'input_revision_ref':native.input_revision_ref,'event_owner_ref':native.event_owner_ref,
        'episode_ref':profile.current_episode_ref,'level_scope_ref':profile.current_level_scope_ref,
        'model_alternatives':native.model_alternatives}
    for field,current in sorted(expected.items()):
        if current is None or request.expected_packet_fields.get(field)!=current:
            missing.append('profile.exact_packet_binding.'+field)
    if request.packet_term_ref!=profile.sealed_packet_term_ref:missing.append('profile.exact_packet_term_ref')
    request=request.model_copy(update={'unresolved_bindings':tuple(dict.fromkeys(missing))})
    return FrozenMap({'phase':profile.phase,'has_request':True,'request':immutable_json_data(request)})


def bind_b_produced_packet(store,value,receipt):
    from agents.yf_arc3_v5.capabilities.mechanical_profile_b import coerce_profile
    profile=coerce_profile(value);request=coerce_request(profile.sealed_interval_production_request)
    term=store.snapshot.term(profile.sealed_packet_term_ref)
    if receipt['packet_term_ref']!=profile.sealed_packet_term_ref or term is None or term.kind is not TermKind.VALUE:
        raise ValueError('Source-selected produced packet is not this exact profile packet')
    packet=term.attributes.get('packet',FrozenMap())
    if term.attributes.get('projection_contract_ref')!=request.packet_projection_contract_ref or stable_digest(packet)!=receipt['packet_digest']:
        raise ValueError('produced canonical packet changed before profile binding')
    return profile.model_copy(update={'kernel_request':profile.kernel_request.model_copy(update={'observations':packet['transactions']})})
