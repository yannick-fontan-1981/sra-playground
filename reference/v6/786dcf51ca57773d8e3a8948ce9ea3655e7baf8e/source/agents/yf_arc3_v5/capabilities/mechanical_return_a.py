"""Immutable transport of a SRC-selected native receipt to the common K return.

This module does not select statuses, infer world-domain exhaustion, interpret
empty values, rank model alternatives or manufacture an optimality proof.
"""
from typing import Literal
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, immutable_json_data
from .adversarial_drop_alignment import AdversarialDropRequest
from .chromatic_window_composition import ChromaticWindowRequest
from .consumable_reaction_network import ConsumableReactionRequest
from .feedback_code_identification import FeedbackCodeRequest
from .finite_relation_network import FiniteRelationRequest
from .identity_contact_authentication import IdentityContactRequest
from .finite_flow_network import FlowRequest
from .shared_symbol_automata import SharedSymbolRequest
from .push_only_logistics import PushRequest
from .ordered_support_transfer import OrderedRequest
from .autonomous_route_intervention import RouteInterventionRequest
from .mutable_kit_survival import MutableKitRequest
from .hidden_motion_reception import HiddenReceptionRequest
from .ballistic_targeting import BallisticRequest
from .typed_material_workbench import MaterialRequest
from .latent_reference_restoration import RestorationRequest
from .lineage_production_delivery import LineageRequest
from .temporal_reference_matching import RecallRequest
from .recurring_quantity_control import QuantityRequest
from .editable_actor_programs import ProgramRequest
from .visibility_capacity_navigation import CapacityRoomRequest
from .oriented_cargo_handoffs import HandoffRequest
from .piercing_rooted_order import PiercingRequest
from .typed_word_transduction import TypedWordRequest
from .local_field_type_production import LocalRequest
from .articulated_channel_kinematics import ArtiRequest
from .directed_accretive_flow import DirectedRequest
from .conservative_quantity_identity import QuantityIdentityRequest
from .finite_instruction_device import DeviceRequest
from .inverse_anchor_signature import AnchorRequest
from .recipe_operator_service_a import RecipeOperatorRequest
from .contact_shape_repair import ShapeRequest
from .reconfigurable_support import SupportRequest
from .ordered_relief_writing import ReliefRequest
from .symbolic_navigation_extensions_a import SymbolNavigationRequestA
from .station_gated_cargo import StationCargoRequest
from .patrol_body import PatrolTickRequest
from .wrap_slide import WrapRequest
from .rewritable_endpoint_transport import EndpointTransportRequest, OrientedPassageRequest
from .inventory_gated_navigation import InventoryNavigationRequest, ChartedNavigationRequest
from .mechanical_family_contracts_a import MechanicalFamilyResult
from .mechanical_request_contracts import MechanicalRequestIdentity, MechanicalResponseInput


class MechanicalReturnBindingA(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.mechanical_return_binding_a.v1"
    request: SymbolNavigationRequestA | ReliefRequest | SupportRequest | ShapeRequest | DeviceRequest | AnchorRequest | ArtiRequest | QuantityIdentityRequest | LocalRequest | TypedWordRequest | DirectedRequest | PiercingRequest | HandoffRequest | AdversarialDropRequest | ChromaticWindowRequest | ConsumableReactionRequest | FeedbackCodeRequest | FiniteRelationRequest | IdentityContactRequest | FlowRequest | SharedSymbolRequest | PushRequest | OrderedRequest | RouteInterventionRequest | MutableKitRequest | HiddenReceptionRequest | BallisticRequest | MaterialRequest | RestorationRequest | InventoryNavigationRequest | ChartedNavigationRequest | LineageRequest | RecallRequest | EndpointTransportRequest | OrientedPassageRequest | QuantityRequest | ProgramRequest | CapacityRoomRequest | StationCargoRequest | PatrolTickRequest | WrapRequest
    measurement: MechanicalFamilyResult
    kernel_ref: Ref
    source_status: Ref
    missing_cause: Literal["NONE","MISSING_OBSERVATION","UNSUPPORTED_MODEL","SIGNATURE_MISMATCH",
                           "MISSING_IMPLEMENTATION","DOMAIN_EXHAUSTED","COMPUTATION_BOUND"]
    question_ref: Ref


def mechanical_request_identity_a(request, kernel_ref, scope, operation, mode, bounds=None):
    """Exact immutable A identity projection, shared by return and its consumer."""
    if bounds is None:
        bounds=FrozenMap({name:getattr(request,name) for name in type(request).model_fields
                         if name.startswith("maximum_")})
    return MechanicalRequestIdentity(
            request_ref=scope.request_ref,kernel_ref=kernel_ref,operation_ref=operation,mode=mode,
            caller_ref=scope.caller_ref,parent_contribution_ref=scope.parent_contribution_ref,
            epoch=scope.epoch,input_revision_ref=scope.evidence_revision_ref,
            model_assignments=FrozenMap({"model_revision_ref":scope.model_revision_ref,
                "model_status_ref":scope.model_status_ref,"event_owner_ref":scope.event_owner_ref,
                "input_domain_complete":scope.input_domain_complete,
                "assumption_refs":scope.assumption_refs}),
            # Use the existing immutable projection; no thaw, deepcopy or JSON encoding.
            immutable_inputs=immutable_json_data({"calculation_input":request,"parent_goal_ref":scope.parent_goal_ref}),
            actual_bounds=bounds,expected_return_type="yf_arc3_v5.mechanical_family_result.v1")


def assemble_mechanical_response_a(value: MechanicalReturnBindingA) -> MechanicalResponseInput:
    request=value.request;measurement=value.measurement
    bounds=FrozenMap({name:getattr(request,name) for name in type(request).model_fields
                      if name.startswith("maximum_")})
    return MechanicalResponseInput(
        request=mechanical_request_identity_a(request,value.kernel_ref,request.scope,request.operation_ref,request.mode,bounds),
        returned_identity=mechanical_request_identity_a(request,value.kernel_ref,measurement.scope,measurement.operation_ref,measurement.mode,bounds),
        source_status=value.source_status,returned_type=measurement.schema_version,
        descriptive_values=immutable_json_data({"calculation":measurement}),
        retained_alternative_refs=request.scope.retained_alternative_refs,
        eligible_sibling_refs=request.scope.eligible_sibling_refs,
        distinguishing_question_ref=None if value.question_ref=="NONE" else value.question_ref,
        missing_cause=None if value.missing_cause=="NONE" else value.missing_cause,
        consumed_request_refs=request.scope.consumed_request_refs,
        retained_frontier=measurement.frontier)
