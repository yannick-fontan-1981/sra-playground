"""Join observed changes to the exact native causal query; DRM owns resulting Needs."""
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data
from .contracts import TypedInterpreterMeasurements,TypedEditSuccessorMeasurements


def measure_program_frontier_axes(measured,result):
    observed=measured.facts.get('observed_family_delta',FrozenMap())
    axes={'program_repair_required':False,'program_observation_incomplete':False,
        'program_repair_scope':FrozenMap(),'candidate_prefix_is_official_acceptance':False,
        'program_observation_rows':observed.get('ordered_observed_program_events',()),
        'program_edit_result_matches_observation':False,'program_edit_status':None,
        'program_edit_observation_incomplete':False}
    if isinstance(result,TypedEditSuccessorMeasurements):
        locations=observed.get('program_resource_locations_after')
        sockets=observed.get('program_socket_occupancy_after')
        matches=(observed.get('program_edit_control_bound') is True
            and locations==immutable_json_data(result.resulting_locations)
            and sockets==immutable_json_data(result.resulting_sockets)
            and observed.get('program_selection_after')==result.selection_token_ref)
        axes.update({'program_edit_result_matches_observation':matches,
            'program_edit_status':result.status,'program_edit_observation_incomplete':not matches,
            'program_edit_original_selection_ref':observed.get('program_selection_before'),
            'program_edit_displaced_token_ref':result.displaced_token_ref,
            'program_edit_source_locations':observed.get('program_resource_locations_before'),
            'program_edit_result_locations':locations,'program_edit_result_sockets':sockets,
            'program_edit_control_ref':observed.get('program_edit_ref'),
            'program_edit_control_kind':observed.get('program_edit_kind')})
        return FrozenMap(axes)
    if not isinstance(result,TypedInterpreterMeasurements):return FrozenMap(axes)
    actual=observed.get('actual_emitted_prefix')
    agreement=isinstance(actual,tuple) and actual[:len(result.emitted_values)]==result.emitted_values
    axes.update({'program_computed_prefix':result.emitted_values,'program_computed_pending_returns':result.pending_returns,
        'program_computed_normal_termination':result.normal_termination,'program_computed_prefix_match':result.prefix_match,
        'program_actual_prefix_agreement':agreement,
        'program_observation_incomplete':observed.get('observed_program_validation') is True and
            (bool(observed.get('unresolved_program_event_indices')) or not agreement)})
    axes.update({'program_validation_input_observed':observed.get('observed_program_validation') is True,
        'program_effect_acceptance_observed':observed.get('official_acceptance_observed') is True,
        'program_observed_caller_prefix_known':observed.get('observed_caller_prefix_after_known') is True,
        'program_observed_open_caller_count':len(observed.get('observed_caller_continuations_after',())),
        'program_actual_reference_equal':actual==measured.request.native_request.interpreter_request.reference_values,
        'program_reference_values':measured.request.native_request.interpreter_request.reference_values,
        'program_model_revision_ref':measured.request.native_request.scope.model_revision_ref})
    index=result.first_mismatch_index
    if agreement and index is not None and index<len(result.emissions) and index<len(actual):
        emission=result.emissions[index]
        if emission.output_index==index and actual[index]==emission.value_ref:
            axes.update({'program_repair_required':True,'program_repair_scope':FrozenMap({
                'output_index':index,'definition_ref':emission.definition_ref,'literal_token_ref':emission.literal_token_ref,
                'instruction_index':emission.instruction_index,'call_site_chain':emission.call_site_chain,
                'shared_definition_dependencies_preserved':True})})
    elif (agreement and index==len(result.emitted_values) and result.normal_termination
            and observed.get('normal_termination_observed') is True and result.retained_state is not None):
        axes.update({'program_repair_required':True,'program_repair_scope':FrozenMap({
            'output_index':index,'definition_ref':result.retained_state.definition_ref,
            'instruction_index':result.retained_state.instruction_index,'missing_output_after_actual_termination':True,
            'call_site_chain':result.retained_state.call_site_chain,'shared_definition_dependencies_preserved':True})})
    return FrozenMap(axes)


def measure_effect_frontier_axes(measured,result,values):
    request=measured.request;native=request.native_request;observed=measured.facts.get('observed_family_delta',FrozenMap())
    axes={'support_onward_route_absent':False,'articulated_parent_clearance_still_open':False,
        'articulated_remaining_limiting_component_refs':(),'shape_assignment_invalidated':False,
        'coupled_constraints_hold_without_acceptance':False,'program_observation_rows':()}
    if (result is None or not result.domain_complete or result.computation_bound_reached or result.prerequisite_refs
            or result.implementation_debt_refs or request.native_scene_side!='AFTER'):
        return FrozenMap(axes)
    operation=native.operation_ref.rsplit('.',1)[-1]
    if request.family=='support' and operation=='inverse_connection' and native.connection is not None:
        after=measured.facts['after_scene']['state']
        refs={config.configuration_ref for config in native.connection.configurations
            if immutable_json_data(config.active_layers)==after['platforms']}
        rows=tuple(row for row in values.get('configuration_rows',()) if row.get('configuration_ref') in refs)
        if native.connection.actor_positions==after['actor_positions'] and refs and len(rows)==len(refs):
            axes['current_configuration_connection_rows']=rows
            axes['support_onward_route_absent']=bool(observed.get('platform_changes') or observed.get('remote_tool_changes')) and all(
                row.get('connected') is False for row in rows)
    elif request.family=='articulated' and operation=='collision_policy' and native.step is not None and native.state is not None:
        controlled={body.body_ref for body in native.state.bodies if native.step.channel_ref in body.channel_refs}
        contacts=tuple(row for row in values.get('contacts',()) if row[0] in controlled or row[1] in controlled)
        limiting=tuple(sorted({ref for row in contacts for ref in row[:2]}))
        axes.update({'current_channel_contacts':contacts,'articulated_remaining_limiting_component_refs':limiting,
            'articulated_parent_clearance_still_open':bool(limiting),
            'partial_progress_preserved':any(row.get('local_extent_changed') or row.get('local_translation_changed')
                or row.get('local_rotation_changed') for row in observed.get('body_deltas',()))})
    elif request.family=='shape' and operation=='assignment_domain':
        rows=values.get('candidate_rows',())
        if rows and len(rows)==len(native.assignments):
            axes['current_shape_assignment_rows']=rows
            axes['shape_assignment_invalidated']=any(row.get('component_deformation_observed') for row in observed.get('shape_deltas',())) and all(
                row.get('compatible') is False for row in rows)
    elif request.family=='coupled':
        rows=values.get('rows',())
        by_ref={row.get('carrier_ref'):row for row in rows}
        if len(by_ref)==len(rows)==len(native.carriers) and rows and all('allowed_values' in row for row in rows):
            from .coupled_value_c import full_goal_compatible
            holds,debt=full_goal_compatible(native,native.current_values)
            holds=holds and not debt and all(not any(row.get(key) for key in
                ('empty_value_intersection','existence_conflict','existence_unknown','value_request_on_absent_carrier')) for row in rows)
            correlations_hold=all(relation.domain_complete and tuple(native.current_values.get(ref) for ref in relation.carrier_refs)
                in relation.allowed_rows for relation in native.correlations)
            protected_preserved=observed.get('protected_carrier_identity_and_existence_preserved') is True
            acceptance=measured.facts.get('acceptance')
            axes.update({'current_coupled_allowed_sets':rows,'coupled_constraints_hold':holds and correlations_hold and protected_preserved,
                'coupled_constraints_hold_without_acceptance':holds and correlations_hold and protected_preserved and isinstance(acceptance,FrozenMap)
                    and acceptance.get('accepted') is False})
    return FrozenMap(axes)
