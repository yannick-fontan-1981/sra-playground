"""Exact caller-goal measurements over existing navigation and control kernels.
Source owns the current question and its goal predicate; native mechanics own
simulation. These adapters return contributions and uncertainties, never actions.
"""
from typing import ClassVar
from agents.yf_arc3_v5.logos.types import Ref
from .native_goal_domain_audit_d import NativeGoalDomainBaseD,measure_bound_native_goal_domain_d
from .shared_symbol_automata import SharedSymbolRequest,measure_shared_symbol_automata
from .identity_contact_authentication import IdentityContactRequest,measure_identity_contact_authentication
from .push_only_logistics import PushRequest,measure_push_only_logistics
from .editable_actor_programs import ProgramRequest,measure_editable_actor_programs
from .visibility_capacity_navigation import CapacityRoomRequest,measure_visibility_capacity_navigation
from .finite_flow_network import FlowRequest,measure_finite_flow_network
from .wrap_slide import WrapRequest,measure_wrap_slide
from .patrol_body import PatrolTickRequest,advance_patrol_tick
from .rewritable_endpoint_transport import OrientedPassageRequest,measure_endpoint_transport
from .station_gated_cargo import StationCargoRequest,measure_station_gated_cargo
from .inventory_gated_navigation import ChartedNavigationRequest,measure_inventory_navigation

class SharedAutomataGoalRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.shared_automata_goal_d_request_d.v1'
    native_request: SharedSymbolRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.shared_symbol_automata','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('prefix_product','DOMAIN'),)


def measure_shared_automata_goal_d(request: SharedAutomataGoalRequestD):
    return measure_bound_native_goal_domain_d(request,measure_shared_symbol_automata)


class AuthenticationCalibrationRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.authentication_calibration_d_request_d.v1'
    native_request: IdentityContactRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.identity_contact_authentication.calibration_service','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('sensor_contract','FIT'),('preparation_lifetime','FIT'),)


def measure_authentication_calibration_d(request: AuthenticationCalibrationRequestD):
    return measure_bound_native_goal_domain_d(request,measure_identity_contact_authentication)


class AuthenticationModeAccessRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.authentication_mode_access_d_request_d.v1'
    native_request: IdentityContactRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.identity_contact_authentication.mode_access','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('access_authentication_domain','DOMAIN'),)


def measure_authentication_mode_access_d(request: AuthenticationModeAccessRequestD):
    return measure_bound_native_goal_domain_d(request,measure_identity_contact_authentication)


class PushGoalRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.push_goal_d_request_d.v1'
    native_request: PushRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.push_only_logistics','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('push_route_domain','DOMAIN'),)


def measure_push_goal_d(request: PushGoalRequestD):
    return measure_bound_native_goal_domain_d(request,measure_push_only_logistics)


class PushAssignmentRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.push_assignment_d_request_d.v1'
    native_request: PushRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.push_only_logistics.assignment_first','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('assignment_bound','PROPAGATE'),)


def measure_push_assignment_d(request: PushAssignmentRequestD):
    return measure_bound_native_goal_domain_d(request,measure_push_only_logistics)


class ActorProgramGoalRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.actor_program_goal_d_request_d.v1'
    native_request: ProgramRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.editable_actor_programs','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('program_composition_domain','DOMAIN'),)


def measure_actor_program_goal_d(request: ActorProgramGoalRequestD):
    return measure_bound_native_goal_domain_d(request,measure_editable_actor_programs)


class ActorResultPreimagesRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.actor_result_preimages_d_request_d.v1'
    native_request: ProgramRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.editable_actor_programs.result_before_code','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('combat_preimages','INVERSE_DOMAIN'),)


def measure_actor_result_preimages_d(request: ActorResultPreimagesRequestD):
    return measure_bound_native_goal_domain_d(request,measure_editable_actor_programs)


class VisibilityNavigationGoalRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.visibility_navigation_goal_d_request_d.v1'
    native_request: CapacityRoomRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.visibility_capacity_navigation','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('capacity_route_domain','DOMAIN'),)


def measure_visibility_navigation_goal_d(request: VisibilityNavigationGoalRequestD):
    return measure_bound_native_goal_domain_d(request,measure_visibility_capacity_navigation)


class VisibilityServiceWhyRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.visibility_service_why_d_request_d.v1'
    native_request: CapacityRoomRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.visibility_capacity_navigation.why','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('reveal_release_service','INVERSE_DOMAIN'),)


def measure_visibility_service_why_d(request: VisibilityServiceWhyRequestD):
    return measure_bound_native_goal_domain_d(request,measure_visibility_capacity_navigation)


class VisibilityCapacityReleaseRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.visibility_capacity_release_d_request_d.v1'
    native_request: CapacityRoomRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.visibility_capacity_navigation.capacity_release','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('reveal_release_service','INVERSE_DOMAIN'),)


def measure_visibility_capacity_release_d(request: VisibilityCapacityReleaseRequestD):
    return measure_bound_native_goal_domain_d(request,measure_visibility_capacity_navigation)


class RememberedDarkExplorationRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.remembered_dark_exploration_d_request_d.v1'
    native_request: CapacityRoomRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.visibility_capacity_navigation.dark_exploration','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('remembered_dark_map','UPDATE'),('capacity_route_domain','DOMAIN'),)


def measure_remembered_dark_exploration_d(request: RememberedDarkExplorationRequestD):
    return measure_bound_native_goal_domain_d(request,measure_visibility_capacity_navigation)


class RefillContinuationRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.refill_continuation_d_request_d.v1'
    native_request: CapacityRoomRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.visibility_capacity_navigation.refill_consumer','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('reserve_intervals','PROPAGATE'),)


def measure_refill_continuation_d(request: RefillContinuationRequestD):
    return measure_bound_native_goal_domain_d(request,measure_visibility_capacity_navigation)


class FlowNetworkGoalRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.flow_network_goal_d_request_d.v1'
    native_request: FlowRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.finite_flow_network','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('flow_composition_domain','DOMAIN'),)


def measure_flow_network_goal_d(request: FlowNetworkGoalRequestD):
    return measure_bound_native_goal_domain_d(request,measure_finite_flow_network)


class FlowOrderAlternativesRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.flow_order_alternatives_d_request_d.v1'
    native_request: FlowRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.finite_flow_network.order_uncertainty','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('allocation_preimages','INVERSE_DOMAIN'),)


def measure_flow_order_alternatives_d(request: FlowOrderAlternativesRequestD):
    return measure_bound_native_goal_domain_d(request,measure_finite_flow_network)


class FlowProfileRevalidationRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.flow_profile_revalidation_d_request_d.v1'
    native_request: FlowRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.finite_flow_network.revalidate_profile','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('flow_graph_measurement','MEASURE'),('flow_compare','COMPARE'),)


def measure_flow_profile_revalidation_d(request: FlowProfileRevalidationRequestD):
    return measure_bound_native_goal_domain_d(request,measure_finite_flow_network)


class WrapSeatingGoalRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.wrap_seating_goal_d_request_d.v1'
    native_request: WrapRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.wrap_slide','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.wrap_slide.joint_route_domain','DOMAIN'),)


def measure_wrap_seating_goal_d(request: WrapSeatingGoalRequestD):
    return measure_bound_native_goal_domain_d(request,measure_wrap_slide)


class WrapSeatingWhyRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.wrap_seating_why_d_request_d.v1'
    native_request: WrapRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.wrap_slide.why','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.wrap_slide.seat_approach_preimages','INVERSE_DOMAIN'),)


def measure_wrap_seating_why_d(request: WrapSeatingWhyRequestD):
    return measure_bound_native_goal_domain_d(request,measure_wrap_slide)


class PatrolRequestScopeD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.patrol_request_d_request_d.v1'
    native_request: PatrolTickRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.wrap_slide.request.patrol','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.patrol_body.pre_input_tick','STEP_INTERNAL'),)


def measure_patrol_request_d(request: PatrolRequestScopeD):
    return measure_bound_native_goal_domain_d(request,advance_patrol_tick)


class PatrolCallScopeD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.patrol_call_d_request_d.v1'
    native_request: PatrolTickRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.wrap_slide.request.patrol.call','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.patrol_body.pre_input_tick','STEP_INTERNAL'),)


def measure_patrol_call_d(request: PatrolCallScopeD):
    return measure_bound_native_goal_domain_d(request,advance_patrol_tick)


class PassageGoalRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.passage_goal_d_request_d.v1'
    native_request: OrientedPassageRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.oriented_passage','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.oriented_passage.costed_passage_domain','DOMAIN'),)


def measure_passage_goal_d(request: PassageGoalRequestD):
    return measure_bound_native_goal_domain_d(request,measure_endpoint_transport)


class PassageEntryWhyRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.passage_entry_why_d_request_d.v1'
    native_request: OrientedPassageRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.oriented_passage.why','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.oriented_passage.continuation_domain','INVERSE_DOMAIN'),('mechanics.oriented_passage.costed_passage_domain','DOMAIN'),)


def measure_passage_entry_why_d(request: PassageEntryWhyRequestD):
    return measure_bound_native_goal_domain_d(request,measure_endpoint_transport)


class StationCargoGoalRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.station_cargo_goal_d_request_d.v1'
    native_request: StationCargoRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.station_gated_cargo','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.station_gated_cargo.delivery_domain','DOMAIN'),)


def measure_station_cargo_goal_d(request: StationCargoGoalRequestD):
    return measure_bound_native_goal_domain_d(request,measure_station_gated_cargo)


class StationCargoWhyRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.station_cargo_why_d_request_d.v1'
    native_request: StationCargoRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.station_gated_cargo.why','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.station_gated_cargo.grip_domains','INVERSE_DOMAIN'),('mechanics.station_gated_cargo.delivery_access','DOMAIN'),)


def measure_station_cargo_why_d(request: StationCargoWhyRequestD):
    return measure_bound_native_goal_domain_d(request,measure_station_gated_cargo)


class ChartedRouteGoalRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.charted_route_goal_d_request_d.v1'
    native_request: ChartedNavigationRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.charted_room_navigation','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.charted_room_navigation.bounded_route_domain','DOMAIN'),)


def measure_charted_route_goal_d(request: ChartedRouteGoalRequestD):
    return measure_bound_native_goal_domain_d(request,measure_inventory_navigation)


class ChartedPermissionWhyRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.charted_permission_why_d_request_d.v1'
    native_request: ChartedNavigationRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.charted_room_navigation.why','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.charted_room_navigation.entry_permission_preimages','INVERSE_DOMAIN'),)


def measure_charted_permission_why_d(request: ChartedPermissionWhyRequestD):
    return measure_bound_native_goal_domain_d(request,measure_inventory_navigation)



