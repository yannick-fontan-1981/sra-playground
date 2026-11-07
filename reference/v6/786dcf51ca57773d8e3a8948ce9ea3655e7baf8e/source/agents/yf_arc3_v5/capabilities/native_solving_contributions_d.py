"""Source-bound goal contribution calculations using existing native kernels.

Each exact request admits only the documented operation/mode pair. Goal
conditions are scoped DRM inputs, measured on the kernel answer, never inferred
from a lucky trace or hidden game data. Unknown dependencies remain explicit.
"""
from typing import ClassVar
from time import monotonic
from pydantic import Field
from agents.yf_arc3_v5.logos.types import Ref
from .native_goal_domain_audit_d import NativeGoalDomainBaseD,measure_bound_native_goal_domain_d,annotate_native_goal_result_d
from .local_field_type_production import LocalRequest,measure_local_field_type_production
from .oriented_cargo_handoffs import HandoffRequest,measure_oriented_cargo_handoffs
from .piercing_rooted_order import PiercingRequest,measure_piercing_rooted_order
from .adversarial_drop_alignment import AdversarialDropRequest,measure_adversarial_drop_alignment
from .typed_material_workbench import MaterialRequest,measure_typed_material_workbench
from .latent_reference_restoration import RestorationRequest,measure_latent_reference_restoration
from .autonomous_route_intervention import RouteInterventionRequest,measure_autonomous_route_intervention
from .mutable_kit_survival import MutableKitRequest,measure_mutable_kit_survival
from .hidden_motion_reception import HiddenReceptionRequest,measure_hidden_motion_reception
from .ballistic_targeting import BallisticRequest,measure_ballistic_targeting
from .ordered_support_transfer import OrderedRequest,measure_ordered_support_transfer
from .inventory_gated_navigation import InventoryNavigationRequest,measure_inventory_navigation
from .temporal_reference_matching import RecallRequest,measure_temporal_reference_matching
from .rewritable_endpoint_transport import EndpointTransportRequest,measure_endpoint_transport
from .recurring_quantity_control import QuantityRequest,measure_recurring_quantity_control

class LocalFieldGoalRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.local_field_goal_d_request_d.v1'
    native_request: LocalRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.local_field_type_production','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.local_field_type_production.production_balance','INVERSE_DOMAIN'),)


def measure_local_field_goal_d(request: LocalFieldGoalRequestD):
    return measure_bound_native_goal_domain_d(request,measure_local_field_type_production)


class LocalFieldWhyRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.local_field_why_d_request_d.v1'
    native_request: LocalRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.local_field_type_production.why','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.local_field_type_production.production_balance','INVERSE_DOMAIN'),)


def measure_local_field_why_d(request: LocalFieldWhyRequestD):
    return measure_bound_native_goal_domain_d(request,measure_local_field_type_production)


class LocalFieldWindowRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.local_field_window_d_request_d.v1'
    native_request: LocalRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.local_field_type_production.future_window','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.local_field_type_production.acceptance_windows','MEASURE'),)


def measure_local_field_window_d(request: LocalFieldWindowRequestD):
    return measure_bound_native_goal_domain_d(request,measure_local_field_type_production)


class LocalFieldInterferenceRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.local_field_interference_d_request_d.v1'
    native_request: LocalRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.local_field_type_production.interference','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.local_field_type_production.selective_domains','INVERSE_DOMAIN'),)


def measure_local_field_interference_d(request: LocalFieldInterferenceRequestD):
    return measure_bound_native_goal_domain_d(request,measure_local_field_type_production)


class LocalFieldClockRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.local_field_clock_d_request_d.v1'
    native_request: LocalRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.local_field_type_production.auto_time','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.local_field_type_production.autonomous_successor','STEP_INTERNAL'),)
    clock_required: ClassVar[bool]=True


def measure_local_field_clock_d(request: LocalFieldClockRequestD):
    return measure_bound_native_goal_domain_d(request,measure_local_field_type_production)


class CargoGoalRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.cargo_goal_d_request_d.v1'
    native_request: HandoffRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.oriented_cargo_handoffs','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.oriented_cargo_handoffs.handoff_domains','INVERSE_DOMAIN'),('mechanics.oriented_cargo_handoffs.predicate_domains','INVERSE_DOMAIN'),('mechanics.oriented_cargo_handoffs.grasp_domains','INVERSE_DOMAIN'),('mechanics.oriented_cargo_handoffs.regrasp_domains','INVERSE_DOMAIN'),)


def measure_cargo_goal_d(request: CargoGoalRequestD):
    return measure_bound_native_goal_domain_d(request,measure_oriented_cargo_handoffs)


class CargoParallelRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.cargo_parallel_d_request_d.v1'
    native_request: HandoffRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.oriented_cargo_handoffs.parallel','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.oriented_cargo_handoffs.assignment_cost','EVALUATE'),)


def measure_cargo_parallel_d(request: CargoParallelRequestD):
    return measure_bound_native_goal_domain_d(request,measure_oriented_cargo_handoffs)


class PiercingGoalRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.piercing_goal_d_request_d.v1'
    native_request: PiercingRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.piercing_rooted_order','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.piercing_rooted_order.rooted_match','COMPARE'),('mechanics.piercing_rooted_order.staging_domains','INVERSE_DOMAIN'),)


def measure_piercing_goal_d(request: PiercingGoalRequestD):
    return measure_bound_native_goal_domain_d(request,measure_piercing_rooted_order)


class PiercingStockRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.piercing_stock_d_request_d.v1'
    native_request: PiercingRequest
    reference_type_word: tuple[Ref,...]=Field(min_length=1,max_length=128)
    current_rooted_type_word: tuple[Ref,...]=Field(max_length=128)
    remaining_stock_occurrences: tuple[tuple[Ref,Ref],...]=Field(max_length=256)
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.piercing_rooted_order.ordered_stock','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.piercing_rooted_order.staging_domains','INVERSE_DOMAIN'),)


def measure_piercing_stock_d(request: PiercingStockRequestD):
    started_at=monotonic()
    prefix=request.current_rooted_type_word
    prefix_matches=prefix==request.reference_type_word[:len(prefix)]
    next_type=request.reference_type_word[len(prefix)] if prefix_matches and len(prefix)<len(request.reference_type_word) else None
    stock=tuple(ref for ref,typ in request.remaining_stock_occurrences if typ==next_type)
    native=measure_bound_native_goal_domain_d(request,measure_piercing_rooted_order)
    return annotate_native_goal_result_d(request,native,{'rooted_prefix_matches_reference':prefix_matches,
        'next_reference_rank':len(prefix),'next_reference_type_ref':next_type,'matching_stock_occurrence_refs':stock,
        'nearest_stock_selection_used':False},{'has_next_rank_stock_and_current_domain':native.domain_complete and bool(stock)},
        len(prefix)+len(request.remaining_stock_occurrences),started_at)


class DropWinFirstRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.drop_win_first_d_request_d.v1'
    native_request: AdversarialDropRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.adversarial_drop_alignment.win_before_defense','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('immediate_tactics','PRECONDITION'),)


def measure_drop_win_first_d(request: DropWinFirstRequestD):
    started_at=monotonic()
    native=measure_bound_native_goal_domain_d(request,measure_adversarial_drop_alignment)
    rows=native.values.get('native_values',{}).get('candidate_tactics',())
    wins=tuple(row['player_column'] for row in rows if row.get('player_accepted_in_every_declared_response') is True)
    safe=tuple(row['player_column'] for row in rows if row.get('safe_against_declared_immediate_reply') is True)
    return annotate_native_goal_result_d(request,native,{'current_legal_terminal_columns':wins,
        'current_safe_tactical_columns':safe,'slower_preparation_preferred_to_current_win':False},
        {'has_current_legal_immediate_win':native.domain_complete and bool(wins),'has_current_safe_tactical_column':native.domain_complete and bool(safe)},len(rows),started_at)


class DropPolicyPrefixRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.drop_policy_prefix_d_request_d.v1'
    native_request: AdversarialDropRequest
    source_bound_player_column: int=Field(ge=0)
    source_prefix_selection_ref: Ref
    current_player_input_ref: Ref
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.adversarial_drop_alignment.policy_prefix','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('bounded_adversarial_domain','DOMAIN'),)


def measure_drop_policy_prefix_d(request: DropPolicyPrefixRequestD):
    started_at=monotonic()
    native=measure_bound_native_goal_domain_d(request,measure_adversarial_drop_alignment)
    nodes=native.values.get('native_values',{}).get('nodes',())
    edges=tuple(edge for node in nodes if node.get('depth')==0 for edge in node.get('edges',())
        if edge.get('player_column')==request.source_bound_player_column)
    # The Source-bound current player command is the entire executable prefix.
    # Reply histories stay conditional domain data and are never executable.
    prefix=(request.current_player_input_ref,) if len(edges)==1 and native.domain_complete else ()
    return annotate_native_goal_result_d(request,native,{'currently_bound_player_prefix':prefix,
        'source_prefix_selection_ref':request.source_prefix_selection_ref,'observation_required_after_player_prefix':True,
        'opponent_reply_commands_executable':False}, {'has_bound_current_player_prefix':bool(prefix)},len(nodes)+sum(len(n.get('edges',())) for n in nodes if n.get('depth')==0),started_at)


class MaterialGoalRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.material_goal_d_request_d.v1'
    native_request: MaterialRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.typed_material_workbench','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('production_domain','DOMAIN'),)


def measure_material_goal_d(request: MaterialGoalRequestD):
    return measure_bound_native_goal_domain_d(request,measure_typed_material_workbench)


class MaterialWhyRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.material_why_d_request_d.v1'
    native_request: MaterialRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.typed_material_workbench.why','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('reservation_composition','PRECONDITION'),('material_preimages','INVERSE_DOMAIN'),)


def measure_material_why_d(request: MaterialWhyRequestD):
    return measure_bound_native_goal_domain_d(request,measure_typed_material_workbench)


class MaterialRecycleRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.material_recycle_d_request_d.v1'
    native_request: MaterialRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.typed_material_workbench.recycle_when_needed','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('production_domain','DOMAIN'),('material_preimages','INVERSE_DOMAIN'),)


def measure_material_recycle_d(request: MaterialRecycleRequestD):
    return measure_bound_native_goal_domain_d(request,measure_typed_material_workbench)


class MaterialDeliveryOrderRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.material_delivery_order_d_request_d.v1'
    native_request: MaterialRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.typed_material_workbench.delivery_order','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('reservation_composition','PRECONDITION'),)


def measure_material_delivery_order_d(request: MaterialDeliveryOrderRequestD):
    return measure_bound_native_goal_domain_d(request,measure_typed_material_workbench)


class ReferenceGoalRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.reference_goal_d_request_d.v1'
    native_request: RestorationRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.latent_reference_restoration','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('repair_composition','DOMAIN'),)


def measure_reference_goal_d(request: ReferenceGoalRequestD):
    return measure_bound_native_goal_domain_d(request,measure_latent_reference_restoration)


class ReferenceRestoreDamageRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.reference_restore_damage_d_request_d.v1'
    native_request: RestorationRequest
    previously_supported_cells: tuple[tuple[tuple[int,int],Ref],...]=Field(min_length=1,max_length=128)
    damage_event_evidence_ref: Ref
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.latent_reference_restoration.restore_damage','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('fixed_reference_step','STEP'),('repair_composition','DOMAIN'),)


def measure_reference_restore_damage_d(request: ReferenceRestoreDamageRequestD):
    started_at=monotonic()
    native=measure_bound_native_goal_domain_d(request,measure_latent_reference_restoration)
    before={cell.point:cell.value_ref for cell in request.native_request.state.cells} if request.native_request.state is not None else {}
    values=native.values.get('native_values',{})
    after=values.get('after_state',values.get('after_prefix_state',{})) or {}
    cells={tuple(cell['point']):cell['value_ref'] for cell in after.get('cells',())}
    restored=tuple(point for point,value in request.previously_supported_cells if point in before and before[point]!=value and cells.get(point)==value)
    retained=all(cells.get(point)==value for point,value in request.previously_supported_cells)
    return annotate_native_goal_result_d(request,native,{'restored_supported_cell_positions':restored,
        'previous_support_retained':retained,'damage_event_evidence_ref':request.damage_event_evidence_ref,
        'new_damage_normalized_as_reference':False}, {'has_current_damage_restore_without_new_damage':native.domain_complete and bool(restored) and retained},len(before)+len(cells)+len(request.previously_supported_cells),started_at)


class AutonomousArrivalGoalRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.autonomous_arrival_goal_d_request_d.v1'
    native_request: RouteInterventionRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.autonomous_route_intervention','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('joint_intervention_domain','DOMAIN'),)


def measure_autonomous_arrival_goal_d(request: AutonomousArrivalGoalRequestD):
    return measure_bound_native_goal_domain_d(request,measure_autonomous_route_intervention)


class FiniteSurvivalGoalRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.finite_survival_goal_d_request_d.v1'
    native_request: MutableKitRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.mutable_kit_survival','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('survival_viability','DOMAIN'),)


def measure_finite_survival_goal_d(request: FiniteSurvivalGoalRequestD):
    return measure_bound_native_goal_domain_d(request,measure_mutable_kit_survival)


class HiddenReceptionGoalRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.hidden_reception_goal_d_request_d.v1'
    native_request: HiddenReceptionRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.hidden_motion_reception','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('approach_hold_domain','DOMAIN'),)


def measure_hidden_reception_goal_d(request: HiddenReceptionGoalRequestD):
    return measure_bound_native_goal_domain_d(request,measure_hidden_motion_reception)


class BallisticContactGoalRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.ballistic_contact_goal_d_request_d.v1'
    native_request: BallisticRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.ballistic_targeting','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('costed_aim_domain','DOMAIN'),)


def measure_ballistic_contact_goal_d(request: BallisticContactGoalRequestD):
    return measure_bound_native_goal_domain_d(request,measure_ballistic_targeting)


class OrderedTransferGoalRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.ordered_transfer_goal_d_request_d.v1'
    native_request: OrderedRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.ordered_support_transfer','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('transfer_graph','DOMAIN'),('subtower_decomposition','DOMAIN'),)


def measure_ordered_transfer_goal_d(request: OrderedTransferGoalRequestD):
    return measure_bound_native_goal_domain_d(request,measure_ordered_support_transfer)


class InventoryNavigationGoalRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.inventory_navigation_goal_d_request_d.v1'
    native_request: InventoryNavigationRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.inventory_gated_navigation','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('inventory_route_domain','DOMAIN'),)


def measure_inventory_navigation_goal_d(request: InventoryNavigationGoalRequestD):
    return measure_bound_native_goal_domain_d(request,measure_inventory_navigation)


class TemporalMatchGoalRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.temporal_match_goal_d_request_d.v1'
    native_request: RecallRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.temporal_reference_matching','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('recurrence_candidates','PROPAGATE'),)


def measure_temporal_match_goal_d(request: TemporalMatchGoalRequestD):
    return measure_bound_native_goal_domain_d(request,measure_temporal_reference_matching)


class EndpointTransportGoalRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.endpoint_transport_goal_d_request_d.v1'
    native_request: EndpointTransportRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.rewritable_endpoint_transport','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('rewritable_route_domain','DOMAIN'),)


def measure_endpoint_transport_goal_d(request: EndpointTransportGoalRequestD):
    return measure_bound_native_goal_domain_d(request,measure_endpoint_transport)


class QuantityHorizonGoalRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.quantity_horizon_goal_d_request_d.v1'
    native_request: QuantityRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.recurring_quantity_control','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('horizon_viability_domain','DOMAIN'),)


def measure_quantity_horizon_goal_d(request: QuantityHorizonGoalRequestD):
    return measure_bound_native_goal_domain_d(request,measure_recurring_quantity_control)
