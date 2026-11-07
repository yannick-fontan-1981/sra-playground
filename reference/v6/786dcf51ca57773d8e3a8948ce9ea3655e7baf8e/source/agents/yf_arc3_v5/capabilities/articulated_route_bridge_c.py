"""Exact native transition-to-K09 transport; no policy, route choice or action release."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from .mechanical_family_contracts_a import MechanicalFamilyResult
from .mechanical_return_a import mechanical_request_identity_a
from .mechanical_common_contracts_c import ExternalPrimitivePacketC,MechanicalEventC
from .mechanical_event_composition_c import packet_context_equal
from .articulated_channel_kinematics import ArtiState
from .articulated_route_contracts_c import ArticulatedRouteBridgeFactsC,ArticulatedRouteReturnC


def measure_articulated_route_bridge(value):
    query=value.query
    missing,packets=[],[]
    if query.packets:
        missing.append("articulated.route_preserves_only_native_qualified_input_edges")
    if len({(e.native_request.scope.request_ref,e.primitive_ref,e.response_ref) for e in value.edges})!=len(value.edges):
        missing.append("articulated.route_unique_native_transition_population")
    for edge in value.edges:
        native,returned=edge.native_request,edge.native_return
        identity=mechanical_request_identity_a(native,"mechanics.articulated_channel_kinematics",
            native.scope,native.operation_ref,native.mode)
        if (native.state is None or native.model is None or native.step is None
                or native.operation_ref!="mechanics.articulated_channel_kinematics.successor"
                or native.mode!="STEP" or returned.request!=identity
                or native.step.before_bodies!=native.state.bodies
                or edge.action_ref!=native.step.input_ref
                or not packet_context_equal(query.request,identity,native.model.model_ref)
                or native.model.model_ref not in query.retained_model_refs
                or edge.primitive_ref not in query.action_refs):
            missing.append("articulated.route_exact_current_successor_question");continue
        try:result=MechanicalFamilyResult.model_validate(returned.descriptive_values.get("calculation"))
        except (ValidationError,TypeError,ValueError):
            missing.append("articulated.route_actual_native_result_packet");continue
        if (result.scope!=native.scope or result.operation_ref!=native.operation_ref or result.mode!=native.mode
                or not result.domain_complete or result.prerequisite_refs or result.computation_bound_reached
                or not result.signature_supported or result.implementation_debt_refs):
            missing.append("articulated.route_complete_current_transition");continue
        after=result.values.get("after_state")
        if not isinstance(after,FrozenMap):
            missing.append("articulated.route_actual_full_after_state");continue
        try:after_state=ArtiState.model_validate(after)
        except (ValidationError,TypeError,ValueError):
            missing.append("articulated.route_typed_full_after_state");continue
        if tuple(b.body_ref for b in after_state.bodies)!=tuple(b.body_ref for b in native.state.bodies):
            missing.append("articulated.route_joint_body_identity_preserved");continue
        before=immutable_json_data(native.state)
        # This adapter packet has its own identity. The K24 receipt identity stays
        # immutable and is retained in the exact provenance payload.
        packet_identity=identity.model_copy(update={
            "request_ref":"request.articulated.route_packet."+stable_digest((identity,edge.primitive_ref)),
            "kernel_ref":"mechanics.articulated_route_packet_c",
            "operation_ref":"mechanics.articulated_route_packet_c.step",
            "immutable_inputs":FrozenMap({"state":before,"native_request":immutable_json_data(identity),
                "native_return":immutable_json_data(returned)})})
        snapshot_ref="snapshot.articulated.route."+stable_digest((identity,edge.primitive_ref))
        event=MechanicalEventC(occurrence_ref="event.articulated.joint."+stable_digest((identity,edge.response_ref)),
            producer_ref=native.scope.event_owner_ref,kind_ref="ARTICULATED_JOINT_MODEL_TRANSITION",
            clock_ref=edge.clock_ref,tick=edge.tick,temporal_scope_ref=edge.temporal_scope_ref,
            snapshot_ref=snapshot_ref,snapshot_kind="PRE_COMMAND",reads=before,
            writes=FrozenMap({key:after[key] for key in sorted(after) if before.get(key)!=after[key]}))
        packets.append(ExternalPrimitivePacketC(request=packet_identity,parent_request=query.request,
            model_ref=native.model.model_ref,action_ref=edge.action_ref,primitive_ref=edge.primitive_ref,
            before=before,after=after,events=(event,),snapshots=FrozenMap({snapshot_ref:before}),
            closure_domain_ref=edge.closure_domain_ref,closure_stop_ref="sealed_native_K24_successor",
            complete=True,missing_refs=(),cost=edge.cost,terminal=False,acceptance=False,
            response_ref=edge.response_ref))
    updated=query.model_copy(update={"packets":(*query.packets,*packets)})
    return ArticulatedRouteBridgeFactsC(query=updated,packets=tuple(packets),missing_refs=tuple(sorted(set(missing))),
        facts=FrozenMap({"bridge_current":not bool(missing),"complete_search_proved":False,
            "physical_action_release":False}))


def get_articulated_route_query(value):
    return value.measured.query


def return_articulated_route(value):
    missing=list(value.measured.missing_refs)
    if value.returned is not None and value.returned.request!=value.measured.query.request:
        missing.append("articulated.route_exact_K09_return_identity")
    return ArticulatedRouteReturnC(bridge=value.measured,returned=value.returned,missing_refs=tuple(sorted(set(missing))))
