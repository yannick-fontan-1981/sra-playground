"""Finite Source-supplied parking/preimage checks, no storage or action choice."""
from agents.yf_arc3_v5.logos.types import FrozenMap
from .coupled_permutation_d import permutation_work_d,measure_permutation_map_d


class ParkingBoundD(Exception):
    pass


class ParkingNeedD(Exception):
    pass


def calculate_coupled_parking_d(request):
    from .coupled_value_c import coupled_return,coupled_checkpoint,effect_column,apply_coupled_action
    query=request.parking_query
    work=0;rows=[]
    def charge(count):
        nonlocal work
        if work+count>request.maximum_evaluations:raise ParkingBoundD()
        work+=count
    def advance(values,location,ref):
        if ref not in actions:raise ParkingNeedD('parking.current_available_forward_control')
        action=actions[ref]
        charge(len(action.transition_rows)*(len(values)+1)+len(action.supported_offsets)*len(request.correspondences)
            +2*permutation_work_d(action,request)+3*len(request.carriers))
        column,debt=effect_column(request,action)
        if debt:raise ParkingNeedD(debt[0])
        forward,_,debt=measure_permutation_map_d(request,action,column)
        if debt:raise ParkingNeedD(debt[0])
        after,debt=apply_coupled_action(request,action,values)
        if debt:raise ParkingNeedD(debt[0])
        for ref,value in sorted(query.preservation_values.items()):
            charge(1)
            if after.get(ref)!=value:raise ParkingNeedD('parking.declared_preservation_falsified')
        return after,forward.get(location,location)
    try:
        if query is None:raise ParkingNeedD('parking.explicit_source_query')
        charge(len(request.actions)+len(request.carriers)+len(request.target_values)+len(request.current_values)
            +2*len(query.restore_required_values)+2*len(query.preservation_values))
        if (not set(query.restore_required_values)<=set(request.target_values)
                or not set(query.preservation_values)<=set(request.current_values)):
            raise ParkingNeedD('parking.complete_named_restore_and_preservation_loci')
        actions={action.action_ref:action for action in request.actions}
        if query.origin_carrier_ref not in request.current_values or query.next_action_ref not in actions:
            raise ParkingNeedD('parking.current_origin_and_named_consumer_control')
        if (query.restore_required_values.get(query.origin_carrier_ref)!=request.current_values[query.origin_carrier_ref]
                or not query.restore_required_values
                or any(request.target_values.get(ref)!=value for ref,value in sorted(query.restore_required_values.items()))):
            raise ParkingNeedD('parking.correctly_placed_origin_and_original_goal_restoration')
        if any(request.current_values.get(ref)!=value for ref,value in sorted(query.preservation_values.items())):
            raise ParkingNeedD('parking.current_declared_preservation_values')
        if len({w.witness_ref for w in query.witnesses})!=len(query.witnesses):
            raise ParkingNeedD('parking.distinct_source_witness_identity')
        next_action=actions[query.next_action_ref]
        charge(len(next_action.supported_offsets)*len(request.correspondences)+2*permutation_work_d(next_action,request))
        column,debt=effect_column(request,next_action)
        if debt:raise ParkingNeedD(debt[0])
        forward,_,debt=measure_permutation_map_d(request,next_action,column)
        if debt:raise ParkingNeedD(debt[0])
        origin_moves=forward.get(query.origin_carrier_ref,query.origin_carrier_ref)!=query.origin_carrier_ref
        for witness in query.witnesses:
            if len(witness.transfer_action_refs)+1+len(witness.restoration_action_refs)>request.maximum_depth:
                raise ParkingNeedD('parking.complete_supplied_word_primitive_bound')
            values=request.current_values;location=query.origin_carrier_ref
            for ref in witness.transfer_action_refs:values,location=advance(values,location,ref)
            parking_matches=location==witness.parking_carrier_ref
            outside=location not in column['carrier_refs']
            parked_value=values.get(location)
            after_next,next_location=advance(values,location,query.next_action_ref)
            consumer_preserves=(next_location==location and after_next.get(location)==parked_value)
            restored=after_next;restored_location=next_location
            for ref in witness.restoration_action_refs:
                restored,restored_location=advance(restored,restored_location,ref)
            charge(len(query.restore_required_values)+1)
            restoration_matches=(restored_location==query.origin_carrier_ref and all(
                restored.get(ref)==value for ref,value in sorted(query.restore_required_values.items())))
            rows.append(FrozenMap({'witness_ref':witness.witness_ref,'initial_origin_carrier_ref':query.origin_carrier_ref,
                'parking_carrier_ref':witness.parking_carrier_ref,'next_action_ref':query.next_action_ref,
                'origin_moves_under_next_control':origin_moves,'tracked_origin_reaches_parking':parking_matches,
                'parking_outside_next_support':outside,'next_control_preserves_parked_origin':consumer_preserves,
                'restoration_predicted_matches':restoration_matches,'remaining_restoration_request_ref':query.restoration_request_ref,
                'restore_required_values':query.restore_required_values,'restoration_actually_completed':False,
                'primitive_count':len(witness.transfer_action_refs)+1+len(witness.restoration_action_refs),
                'conditional_current_witness_valid':origin_moves and parking_matches and outside and consumer_preserves and restoration_matches,
                'new_executable_route_or_actor_input_generated':False}))
        return coupled_return(request,rows=rows,examined=work,
            details={'next_control_effect_column':column,'no_storage_child_needed_from_this_effect':not origin_moves,
                'original_goal_changed':False,'storage_or_restoration_selected':False})
    except ParkingBoundD:
        return coupled_return(request,bounded=True,checkpoint=coupled_checkpoint(request,0,(),0),examined=work)
    except ParkingNeedD as error:
        return coupled_return(request,missing=(str(error),),examined=work)
