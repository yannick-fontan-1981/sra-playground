"""Exact real sealed transaction measurements, independent of family DTOs."""
from collections.abc import Mapping
from agents.yf_arc3_v5.logos.operations import ActionIntent,EnvironmentActionDispatchedRecord,ObservationAcquiredRecord
from agents.yf_arc3_v5.logos.types import FrozenMap,Ref,TermKind,stable_digest


def measure_canonical_sealed_interval(store, *, packet_term_ref:Ref, packet_projection_contract_ref:Ref,
        state_projection_contract_ref:Ref, expected_packet_fields:FrozenMap,
        transactions:tuple[FrozenMap,...], epoch:int, current_frame_ref:Ref):
    snapshot=store.snapshot;missing=[];term=snapshot.term(packet_term_ref)
    if term is None or term.kind is not TermKind.VALUE or term.attributes.get('projection_contract_ref')!=packet_projection_contract_ref:
        missing.append('canonical.sealed_mechanical_packet');packet=FrozenMap()
    else:packet=term.attributes.get('packet',FrozenMap())
    return _measure_interval_payload(store,packet=packet,initial_missing=missing,
        state_projection_contract_ref=state_projection_contract_ref,expected_packet_fields=expected_packet_fields,
        transactions=transactions,epoch=epoch,current_frame_ref=current_frame_ref)


def measure_sealed_interval_candidate(store, *, packet:FrozenMap, state_projection_contract_ref:Ref,
        expected_packet_fields:FrozenMap, transactions:tuple[FrozenMap,...], epoch:int, current_frame_ref:Ref):
    measured=_measure_interval_payload(store,packet=packet,initial_missing=[],
        state_projection_contract_ref=state_projection_contract_ref,expected_packet_fields=expected_packet_fields,
        transactions=transactions,epoch=epoch,current_frame_ref=current_frame_ref)
    return FrozenMap({**{key:value for key,value in sorted(measured.items()) if key!='canonical_bindings_current'},
        'candidate_bindings_current':measured['canonical_bindings_current'],
        'canonical_packet_published':False})


def _measure_interval_payload(store, *, packet, initial_missing, state_projection_contract_ref,
        expected_packet_fields,transactions,epoch,current_frame_ref):
    snapshot=store.snapshot;missing=list(initial_missing)
    required=('sealed','parent_goal_ref','scope_ref','epoch','input_revision_ref','current_frame_ref',
        'episode_ref','level_scope_ref','model_alternatives','transactions')
    for field in required:
        if field not in expected_packet_fields:missing.append('scope.required_packet_binding.'+field)
    for field,value in (('sealed',True),('epoch',epoch),('current_frame_ref',current_frame_ref),('transactions',transactions)):
        if expected_packet_fields.get(field)!=value:missing.append('scope.exact_packet_binding.'+field)
    if not isinstance(packet,Mapping):missing.append('canonical.sealed_packet_mapping');packet=FrozenMap()
    if snapshot.term(expected_packet_fields.get('parent_goal_ref')) is None:missing.append('canonical.current_parent_goal')
    for field in ('interval_ref','timeline_ref','pre_state_ref','expected_action_ref'):
        if not isinstance(packet.get(field),str) or not packet[field]:missing.append('packet.'+field)
    expected=expected_packet_fields
    for field,actual in sorted(expected.items()):
        if field not in packet or packet[field]!=actual:missing.append('packet.exact_'+field)
    if not transactions:missing.append('packet.primitive_transactions')
    elif packet.get('pre_state_ref')!=transactions[0].get('pre_state_ref') or packet.get('expected_action_ref')!=transactions[0].get('action_ref'):
        missing.append('packet.expected_action_and_pre_state')
    dispatch_refs=tuple(row.get('dispatch_record_ref') for row in transactions)
    if len(set(dispatch_refs))!=len(dispatch_refs):missing.append('packet.repeated_dispatch_is_not_another_primitive')
    final_acquisition_frames=[]
    # A repeated animation frame is acquisition evidence of the same dispatch;
    # only ordered primitive transaction rows are sent to the mechanical kernel.
    for index,observation in enumerate(transactions):
        prefix='packet.transaction.'+str(index)+'.'
        for field in ('before','after','action_ref','action_payload','pre_state_ref','post_state_ref','before_frame_ref','after_frame_ref','dispatch_record_ref'):
            if field not in observation:missing.append(prefix+'required_'+field)
        dispatch=store.artifact(observation.get('dispatch_record_ref'))
        if not isinstance(dispatch,EnvironmentActionDispatchedRecord):
            missing.append(prefix+'actual_dispatch')
        elif dispatch.action_ref!=observation.get('action_ref') or dispatch.timeline_id!=packet.get('timeline_ref') or dispatch.frame_id!=observation.get('before_frame_ref'):
            missing.append(prefix+'exact_action_and_timeline')
        if isinstance(dispatch,EnvironmentActionDispatchedRecord):
            intent=store.artifact(dispatch.action_intent_id)
            if not isinstance(intent,ActionIntent):missing.append(prefix+'actual_action_intent')
            elif intent.action_ref!=observation.get('action_ref') or intent.action_data!=observation.get('action_payload'):
                missing.append(prefix+'exact_released_action_payload')
        records=observation.get('observation_record_refs',())
        if not isinstance(records,(tuple,list)) or not records or len(records)>256:
            missing.append(prefix+'bounded_response_observations');records=()
        acquisition_frames=[]
        for ref in records:
            acquired=store.artifact(ref)
            if not isinstance(acquired,ObservationAcquiredRecord) or acquired.timeline_id!=packet.get('timeline_ref'):
                missing.append(prefix+'actual_response_observation.'+str(ref))
            elif isinstance(dispatch,EnvironmentActionDispatchedRecord) and acquired.raw_input_ref!=dispatch.raw_input_ref and dispatch.id not in acquired.provenance:
                missing.append(prefix+'response_dispatch_link.'+str(ref))
            if index==len(transactions)-1 and isinstance(acquired,ObservationAcquiredRecord):
                final_acquisition_frames.append(acquired.frame_id)
            if isinstance(acquired,ObservationAcquiredRecord):acquisition_frames.append(acquired.frame_id)
        if observation.get('after_frame_ref') not in acquisition_frames:
            missing.append(prefix+'post_state_actual_acquisition_frame')
        for state_field,ref_field in (('before','pre_state_ref'),('after','post_state_ref')):
            state_term=snapshot.term(observation.get(ref_field))
            if state_term is None or state_term.kind is not TermKind.VALUE or state_term.attributes.get('projection_contract_ref')!=state_projection_contract_ref or state_term.attributes.get('state')!=observation.get(state_field) or state_term.attributes.get('epoch')!=epoch:
                missing.append(prefix+'canonical_'+state_field)
            elif state_term.attributes.get('timeline_ref')!=packet.get('timeline_ref') or state_term.attributes.get('frame_ref')!=observation.get(state_field+'_frame_ref'):
                missing.append(prefix+'canonical_'+state_field+'_frame_scope')
        if index and transactions[index-1].get('after')!=observation.get('before'):
            missing.append(prefix+'adjacent_state_link')
    if current_frame_ref not in final_acquisition_frames:missing.append('packet.current_terminal_acquisition')
    return FrozenMap({'canonical_bindings_current':not missing,'missing_refs':tuple(missing),
        'packet':packet,'packet_digest':stable_digest(packet),
        'final_acquisition_frames':tuple(final_acquisition_frames),
        'no_dispatch_or_action_authority':True})
