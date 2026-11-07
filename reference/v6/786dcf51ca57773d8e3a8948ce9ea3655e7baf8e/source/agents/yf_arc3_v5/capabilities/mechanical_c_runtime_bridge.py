from .portable_local_relation_registry import PORTABLE_LOCAL_TYPES, portable_local_entries, portable_local_signatures
from .observation_packet_boundary_registry import PACKET_BOUNDARY_TYPES, packet_boundary_entries, packet_boundary_signatures
from .parameterized_control_registry import parameterized_control_entries, parameterized_control_signatures
from .homologous_interface_registry import HOMOLOGOUS_INTERFACE_TYPES, homologous_interface_entries, homologous_interface_signatures
from .contextual_compartment_registry import CONTEXTUAL_COMPARTMENT_TYPES, contextual_compartment_entries, contextual_compartment_signatures
"""Exact registration bridge for the published C001-C006 common services.

The two B STEP providers already exist and are not registered twice. This is
library wiring, not a selector, search engine or new execution authority.
"""
from .mechanical_common_registry_c import COMMON_C_TYPES,mechanical_common_entries_c,mechanical_common_signatures_c
from .banded_program_registry import BANDED_PROGRAM_TYPES,banded_program_entries,banded_program_signatures
from .observed_neighbor_pattern_registry import OBSERVED_NEIGHBOR_TYPES,observed_neighbor_entries,observed_neighbor_signatures
from .observed_topological_field_registry import OBSERVED_TOPOLOGY_TYPES, observed_topology_entries, observed_topology_signatures
from .component_network_registry import COMPONENT_NETWORK_TYPES, component_network_entries, component_network_signatures
from .cell_coverage_relations_registry import CELL_COVERAGE_TYPES, cell_coverage_entries, cell_coverage_signatures
from .mechanical_step_registry_c import STEP_C_TYPES,mechanical_step_entries_c,mechanical_step_signatures_c
from .rigid_rearrangement_registry_c import (RIGID_REARRANGEMENT_TYPES_C,
    rigid_rearrangement_entries_c,rigid_rearrangement_signatures_c)
from .rigid_search_batch_registry_c import (RIGID_SEARCH_BATCH_TYPES_C,
    rigid_search_batch_entries_c,rigid_search_batch_signatures_c)
from .mechanical_path_driver_registry_c import PATH_DRIVER_C_TYPES,mechanical_path_driver_entries_c,mechanical_path_driver_signatures_c
from .mechanical_search_driver_registry_c import SEARCH_DRIVER_C_TYPES,mechanical_search_driver_entries_c,mechanical_search_driver_signatures_c
from .relevance_registry_c import RELEVANCE_C_TYPES,relevance_entries_c,relevance_signatures_c
from .neighborhood_step_registry_c import NEIGHBORHOOD_STEP_C_TYPES,neighborhood_step_entries_c,neighborhood_step_signatures_c
from .neighborhood_search_registry_c import NEIGHBORHOOD_SEARCH_C_TYPES,neighborhood_search_entries_c,neighborhood_search_signatures_c
from .typed_mask_registry_c import TYPED_MASK_C_TYPES,typed_mask_entries_c,typed_mask_signatures_c
from .terrain_frontier_registry_c import TERRAIN_FRONTIER_C_TYPES,terrain_frontier_entries_c,terrain_frontier_signatures_c
from .supposition_axes_registry_c import SUPPOSITION_AXES_C_TYPES,supposition_axes_entries_c,supposition_axes_signatures_c
from .metric_step_registry_c import METRIC_STEP_C_TYPES,metric_step_entries_c,metric_step_signatures_c
from .metric_search_registry_c import METRIC_SEARCH_C_TYPES,metric_search_entries_c,metric_search_signatures_c
from .structural_supposition_registry_c import STRUCTURAL_SUPPOSITION_C_TYPES,structural_supposition_entries_c,structural_supposition_signatures_c
from .measurement_extension_registry_c import MEASUREMENT_EXTENSION_C_TYPES,measurement_extension_entries_c,measurement_extension_signatures_c
from .measurement_need_registry_c import MEASUREMENT_NEED_C_TYPES,measurement_need_entries_c,measurement_need_signatures_c
from .metric_schedule_registry_c import METRIC_SCHEDULE_C_TYPES,metric_schedule_entries_c,metric_schedule_signatures_c
from .relief_supposition_registry_c import RELIEF_SUPPOSITION_C_TYPES,relief_supposition_entries_c,relief_supposition_signatures_c
from .support_value_supposition_registry_c import SUPPORT_VALUE_SUPPOSITION_C_TYPES,support_value_supposition_entries_c,support_value_supposition_signatures_c
from .endpoint_supposition_registry_c import ENDPOINT_SUPPOSITION_C_TYPES,endpoint_supposition_entries_c,endpoint_supposition_signatures_c
from .program_supposition_registry_c import PROGRAM_SUPPOSITION_C_TYPES,program_supposition_entries_c,program_supposition_signatures_c

from .material_supposition_registry_c import MATERIAL_SUPPOSITION_C_TYPES,material_supposition_entries_c,material_supposition_signatures_c
from .transport_supposition_registry_c import TRANSPORT_SUPPOSITION_C_TYPES,transport_supposition_entries_c,transport_supposition_signatures_c
from .production_supposition_registry_c import PRODUCTION_SUPPOSITION_C_TYPES,production_supposition_entries_c,production_supposition_signatures_c
from .motion_supposition_registry_c import MOTION_SUPPOSITION_C_TYPES,motion_supposition_entries_c,motion_supposition_signatures_c
from .indexed_sequence_registry_c import INDEXED_SEQUENCE_C_TYPES,indexed_sequence_entries_c,indexed_sequence_signatures_c
from .recognition_boundary_registry_c import RECOGNITION_BOUNDARY_C_TYPES,recognition_boundary_entries_c,recognition_boundary_signatures_c

from .knowledge_supposition_registry_c import KNOWLEDGE_SUPPOSITION_C_TYPES,knowledge_supposition_entries_c,knowledge_supposition_signatures_c

from .interaction_supposition_registry_c import INTERACTION_SUPPOSITION_C_TYPES,interaction_supposition_entries_c,interaction_supposition_signatures_c

from .capacity_supposition_registry_c import CAPACITY_SUPPOSITION_C_TYPES,capacity_supposition_entries_c,capacity_supposition_signatures_c

from .goal_supposition_registry_c import GOAL_SUPPOSITION_C_TYPES,goal_supposition_entries_c,goal_supposition_signatures_c

from .checkpoint_supposition_registry_c import CHECKPOINT_SUPPOSITION_C_TYPES,checkpoint_supposition_entries_c,checkpoint_supposition_signatures_c

from .view_supposition_registry_c import VIEW_SUPPOSITION_C_TYPES,view_supposition_entries_c,view_supposition_signatures_c

from .completion_supposition_registry_c import COMPLETION_SUPPOSITION_C_TYPES,completion_supposition_entries_c,completion_supposition_signatures_c

from .entry_memory_registry_c import ENTRY_MEMORY_C_TYPES,entry_memory_entries_c,entry_memory_signatures_c
from .region_frontier_registry_c import REGION_C_TYPES,region_frontier_entries_c,region_frontier_signatures_c
from .lattice_calibration_registry_c import LATTICE_CALIBRATION_C_TYPES,lattice_calibration_entries_c,lattice_calibration_signatures_c
from .guidance_relation_registry_c import GUIDANCE_C_TYPES,guidance_relation_entries_c,guidance_relation_signatures_c
from .experiment_frontier_registry_c import EXPERIMENT_C_TYPES,experiment_frontier_entries_c,experiment_frontier_signatures_c

from .counterfactual_audit_registry_c import COUNTERFACTUAL_AUDIT_C_TYPES,counterfactual_audit_entries_c,counterfactual_audit_signatures_c
from .search_witness_scope_registry_c import SEARCH_WITNESS_SCOPE_C_TYPES,search_witness_scope_entries_c,search_witness_scope_signatures_c
from .optical_step_registry_c import OPTICAL_STEP_C_TYPES,optical_step_entries_c,optical_step_signatures_c
from .rail_step_registry_c import RAIL_STEP_C_TYPES,rail_step_entries_c,rail_step_signatures_c
from .workshop_step_registry_c import WORKSHOP_STEP_C_TYPES,workshop_step_entries_c,workshop_step_signatures_c
from .packing_step_registry_c import PACKING_STEP_C_TYPES,packing_step_entries_c,packing_step_signatures_c
from .voxel_step_registry_c import VOXEL_STEP_C_TYPES,voxel_step_entries_c,voxel_step_signatures_c
from .fragment_step_registry_c import FRAGMENT_STEP_C_TYPES,fragment_step_entries_c,fragment_step_signatures_c
from .program_step_registry_c import PROGRAM_STEP_C_TYPES,program_step_entries_c,program_step_signatures_c
from .recolor_step_registry_c import RECOLOR_STEP_C_TYPES,recolor_step_entries_c,recolor_step_signatures_c

from .construction_step_registry_c import CONSTRUCTION_STEP_C_TYPES,construction_step_entries_c,construction_step_signatures_c
from .sequence_step_registry_c import SEQUENCE_STEP_C_TYPES,sequence_step_entries_c,sequence_step_signatures_c
from .alignment_step_registry_c import ALIGNMENT_STEP_C_TYPES,alignment_step_entries_c,alignment_step_signatures_c

from .joystick_step_registry_c import JOYSTICK_STEP_C_TYPES,joystick_step_entries_c,joystick_step_signatures_c
from .prefix_step_registry_c import PREFIX_STEP_C_TYPES,prefix_step_entries_c,prefix_step_signatures_c
from .capture_step_registry_c import CAPTURE_STEP_C_TYPES,capture_step_entries_c,capture_step_signatures_c

from .axial_step_registry_c import AXIAL_STEP_C_TYPES,axial_step_entries_c,axial_step_signatures_c

from .cycle_step_registry_c import CYCLE_STEP_C_TYPES,cycle_step_entries_c,cycle_step_signatures_c
from .b_extension_supposition_registry_c import B_EXTENSION_SUPPOSITION_C_TYPES,b_extension_supposition_entries_c,b_extension_supposition_signatures_c

from .complete_owner_registry_c import COMPLETE_OWNER_C_TYPES,complete_owner_entries_c,complete_owner_signatures_c

from .a_packet_step_registry_c import A_PACKET_STEP_C_TYPES,a_packet_step_entries_c,a_packet_step_signatures_c

from .macro_expansion_registry_c import MACRO_EXPANSION_C_TYPES,macro_expansion_entries_c,macro_expansion_signatures_c

from .finite_search_registry_c import FINITE_SEARCH_C_TYPES,finite_search_entries_c,finite_search_signatures_c
from .guarded_search_registry_c import GUARDED_SEARCH_C_TYPES,guarded_search_entries_c,guarded_search_signatures_c

from .gravity_step_registry_c import GRAVITY_STEP_C_TYPES,gravity_step_entries_c,gravity_step_signatures_c

from .registered_adapter_registry_c import REGISTERED_ADAPTER_C_TYPES,registered_adapter_entries_c,registered_adapter_signatures_c

from .reactive_graph_registry_c import REACTIVE_GRAPH_C_TYPES,reactive_graph_entries_c,reactive_graph_signatures_c

from .coupled_value_registry_c import COUPLED_VALUE_C_TYPES,coupled_value_entries_c,coupled_value_signatures_c

from .prefix_query_registry_c import PREFIX_QUERY_C_TYPES,prefix_query_entries_c,prefix_query_signatures_c

from .coupled_solving_registry_c import COUPLED_SOLVING_C_TYPES, coupled_solving_entries_c, coupled_solving_signatures_c
from .prefix_solving_registry_c import PREFIX_SOLVING_C_TYPES, prefix_solving_entries_c, prefix_solving_signatures_c

from .reactive_solving_registry_c import REACTIVE_SOLVING_C_TYPES, reactive_solving_entries_c, reactive_solving_signatures_c

from .optical_solving_registry_c import OPTICAL_SOLVING_C_TYPES, optical_solving_entries_c, optical_solving_signatures_c

from .relief_solving_registry_c import RELIEF_SOLVING_C_TYPES, relief_solving_entries_c, relief_solving_signatures_c

from .axial_solving_registry_c import AXIAL_SOLVING_C_TYPES, axial_solving_entries_c, axial_solving_signatures_c

from .word_solving_registry_c import WORD_SOLVING_C_TYPES, word_solving_entries_c, word_solving_signatures_c

from .anchor_solving_registry_c import ANCHOR_SOLVING_C_TYPES, anchor_solving_entries_c, anchor_solving_signatures_c

from .shape_solving_registry_c import SHAPE_SOLVING_C_TYPES, shape_solving_entries_c, shape_solving_signatures_c

B_EXISTING_PROVIDERS=frozenset(('capability.guarded_transport_external_primitive',
    'capability.queued_alignment_cascade_external_primitive'))
NEIGHBORHOOD_EXISTING_PROVIDER_C = 'capability.neighborhood_pattern_construction_calculation'
NEIGHBORHOOD_NEW_TYPES_C = tuple(name for name in NEIGHBORHOOD_STEP_C_TYPES
    if name not in ('NeighborhoodPatternRequest', 'DMechanicalResult', 'MechanicalResponseInput'))
METRIC_EXISTING_PROVIDER_C = 'capability.metric_stack_external_primitive'
METRIC_NEW_TYPES_C = tuple(name for name in METRIC_STEP_C_TYPES
    if name not in ('MetricStackRequest', 'MetricStackCalculation', 'MechanicalResponseInput'))
EFFECT_FRONTIER_C_TYPES=('PrerequisiteAgendaCycleD','PrerequisiteAgendaInputD','PrerequisiteAgendaFactsD','PrerequisiteAgendaReturnD','TerminalScopeInputD','TerminalScopeFactsD','TerminalScopeReturnD','FamilyCollectionPlanD','FamilyCollectorInputD','FamilyCollectorFactsD','FamilyCollectorReturnD','SolvingStateInputD','SolvingStateFactsD','SolvingStateReturnD','SolvingQuestionInputD','SolvingQuestionFactsD','SolvingQuestionReturnD','FrontierPrefixInputD','FrontierPrefixFactsD','FrontierPrefixCompileInputD','FrontierPrefixReturnD','FrontierCompositionInputD','FrontierCompositionMeasureInputD','FrontierCompositionFactsD','FrontierCompositionFinishInputD','FrontierCompositionReturnD','SupportSolvingReturnMeasureInputD','SupportSolvingReturnFactsD','SupportSolvingReturnSealInputD','SupportSolvingInputD','SupportSolvingFactsD','SupportSolvingAnswerInputD','SupportSolvingAnswerD','MetricFrontierRequestD','EffectFrontierDIdentityInputD','EffectFrontierDIdentityFactsD','EffectFrontierFacetC','EffectFrontierFieldC','EffectFrontierInputC',
    'EffectFrontierFactsC','EffectFrontierCalculationC','EffectFrontierReturnC','EffectFrontierInterpretationC',
    'CoupledMechanicalReturnBindingC','EffectFrontierPublicationC','EffectFrontierPublicationJoinC','EffectFrontierAgendaInputC','EffectFrontierAgendaRequestC',
    'ProgramEffectRequestC','ProgramEffectPacketC','ProgramEffectMeasurementInputC','ProgramEffectResultFactsC')
EFFECT_FRONTIER_C_TYPES+=('RestorationLedgerInputD','RestorationLedgerFactsD','RestorationLedgerReturnD')
EFFECT_FRONTIER_C_TYPES+=('GoalDerivationInputD','GoalDerivationFactsD','GoalDerivationReturnD')
EFFECT_FRONTIER_C_TYPES+=('PublishedSolvingQuestionBindingD','DeclaredPrerequisiteAgendaBindingD')
EFFECT_FRONTIER_C_TYPES+=('ParentMeasurementPublicationInputsB','ParentMeasurementPublicationBatchB')
EFFECT_FRONTIER_C_TYPES+=('OperationalConsciousnessPropagationBudget',)
EFFECT_FRONTIER_C_TYPES+=('OperationalConsciousnessQuestionAcquisition',
    'OperationalConsciousnessQuestionAcquisitionBinding', 'OperationalConsciousnessQuestionAcquisitionReturn')
COMMON_RUNTIME_TYPES_C=tuple(dict.fromkeys((*EFFECT_FRONTIER_C_TYPES,*COMMON_C_TYPES,*STEP_C_TYPES,*RIGID_REARRANGEMENT_TYPES_C,*RIGID_SEARCH_BATCH_TYPES_C,*PATH_DRIVER_C_TYPES,*SEARCH_DRIVER_C_TYPES,*RELEVANCE_C_TYPES,*NEIGHBORHOOD_NEW_TYPES_C,*NEIGHBORHOOD_SEARCH_C_TYPES,
    *TYPED_MASK_C_TYPES,*TERRAIN_FRONTIER_C_TYPES,*SUPPOSITION_AXES_C_TYPES,*METRIC_NEW_TYPES_C,*METRIC_SEARCH_C_TYPES,*STRUCTURAL_SUPPOSITION_C_TYPES,
    *MEASUREMENT_EXTENSION_C_TYPES,*MEASUREMENT_NEED_C_TYPES,*METRIC_SCHEDULE_C_TYPES,*RELIEF_SUPPOSITION_C_TYPES,*SUPPORT_VALUE_SUPPOSITION_C_TYPES,
    *ENDPOINT_SUPPOSITION_C_TYPES,*PROGRAM_SUPPOSITION_C_TYPES,*MATERIAL_SUPPOSITION_C_TYPES,*TRANSPORT_SUPPOSITION_C_TYPES,*PRODUCTION_SUPPOSITION_C_TYPES,*MOTION_SUPPOSITION_C_TYPES,*INDEXED_SEQUENCE_C_TYPES,*RECOGNITION_BOUNDARY_C_TYPES,*KNOWLEDGE_SUPPOSITION_C_TYPES,*INTERACTION_SUPPOSITION_C_TYPES,*CAPACITY_SUPPOSITION_C_TYPES,*GOAL_SUPPOSITION_C_TYPES,*CHECKPOINT_SUPPOSITION_C_TYPES,*VIEW_SUPPOSITION_C_TYPES,*COMPLETION_SUPPOSITION_C_TYPES,*ENTRY_MEMORY_C_TYPES,*REGION_C_TYPES,*LATTICE_CALIBRATION_C_TYPES,*GUIDANCE_C_TYPES,*EXPERIMENT_C_TYPES,*COUNTERFACTUAL_AUDIT_C_TYPES,*SEARCH_WITNESS_SCOPE_C_TYPES,*OPTICAL_STEP_C_TYPES,*RAIL_STEP_C_TYPES,*WORKSHOP_STEP_C_TYPES,*PACKING_STEP_C_TYPES,*VOXEL_STEP_C_TYPES,*FRAGMENT_STEP_C_TYPES,*PROGRAM_STEP_C_TYPES,*RECOLOR_STEP_C_TYPES,*CONSTRUCTION_STEP_C_TYPES,*SEQUENCE_STEP_C_TYPES,*ALIGNMENT_STEP_C_TYPES,*JOYSTICK_STEP_C_TYPES,*PREFIX_STEP_C_TYPES,*CAPTURE_STEP_C_TYPES,*AXIAL_STEP_C_TYPES,*CYCLE_STEP_C_TYPES,*B_EXTENSION_SUPPOSITION_C_TYPES,*COMPLETE_OWNER_C_TYPES,*A_PACKET_STEP_C_TYPES,*MACRO_EXPANSION_C_TYPES,*FINITE_SEARCH_C_TYPES,*GUARDED_SEARCH_C_TYPES,*GRAVITY_STEP_C_TYPES,*REGISTERED_ADAPTER_C_TYPES,*REACTIVE_GRAPH_C_TYPES,*COUPLED_VALUE_C_TYPES,*PREFIX_QUERY_C_TYPES,*COUPLED_SOLVING_C_TYPES,*PREFIX_SOLVING_C_TYPES,*REACTIVE_SOLVING_C_TYPES,*OPTICAL_SOLVING_C_TYPES,*RELIEF_SOLVING_C_TYPES,*AXIAL_SOLVING_C_TYPES,*WORD_SOLVING_C_TYPES,*ANCHOR_SOLVING_C_TYPES,*SHAPE_SOLVING_C_TYPES)))
COMMON_RUNTIME_TYPES_C += PORTABLE_LOCAL_TYPES + PACKET_BOUNDARY_TYPES + BANDED_PROGRAM_TYPES + OBSERVED_TOPOLOGY_TYPES + CELL_COVERAGE_TYPES + OBSERVED_NEIGHBOR_TYPES + COMPONENT_NETWORK_TYPES + CONTEXTUAL_COMPARTMENT_TYPES + HOMOLOGOUS_INTERFACE_TYPES
COMMON_WORKFLOWS_C=(
    ('workflow.qualify_reference_goal_means','InterfaceProposal','InteractionProbeAgenda','qualify_reference_goal_means.src'),
    ('workflow.append_parameterized_control','InterfaceProposal','InteractionProbeAgenda','append_parameterized_control.src'),
    ('workflow.append_parameterized_inverse','InterfaceProposal','InteractionProbeAgenda','append_parameterized_inverse.src'),
    ('workflow.append_homologous_interface','InterfaceProposal','InteractionProbeAgenda','append_homologous_interface.src'),
    ('workflow.append_contextual_compartment','CompartmentProposal','InteractionProbeAgenda','append_contextual_compartment.src'),
    ('workflow.append_component_network','ComponentNetworkProposal','InteractionProbeAgenda','append_component_network.src'),
    ('workflow.append_cell_coverage_relations','CellCoverageProposal','InteractionProbeAgenda','append_cell_coverage_relations.src'),
    ('workflow.append_observed_topological_field','ObservedTopologyProposal','InteractionProbeAgenda','append_observed_topological_field.src'),
    ('workflow.choose_kit_survival_d','KitSurvivalChoiceInputD','KitSurvivalChoiceReturnD','choose_kit_survival_d.src'),
    ('workflow.choose_feedback_trial_d','FeedbackTrialChoiceInputD','FeedbackTrialChoiceReturnD','choose_feedback_trial_d.src'),
    ('workflow.review_goal_derivation_d','GoalDerivationInputD','GoalDerivationReturnD','review_goal_derivation_d.src'),
    ('workflow.review_restoration_ledger_d','RestorationLedgerInputD','RestorationLedgerReturnD','review_restoration_ledger_d.src'),
    ('workflow.measure_answer_equivalence_d','AnswerEquivalenceInputD','AnswerEquivalenceResultD','measure_answer_equivalence_d.src'),
    ('workflow.measure_resource_transaction_d','ResourceTransactionInputD','ResourceTransactionResultD','measure_resource_transaction_d.src'),
    ('workflow.measure_resource_integer_intervals_d','ResourceIntervalInputD','ResourceIntervalResultD','measure_resource_integer_intervals_d.src'),
    ('workflow.answer_prerequisite_agenda_d','PrerequisiteAgendaInputD','PrerequisiteAgendaReturnD','answer_prerequisite_agenda_d.src'),
    ('workflow.qualify_terminal_scope_d','TerminalScopeInputD','TerminalScopeReturnD','qualify_terminal_scope_d.src'),
    ('workflow.collect_current_computational_returns_d','FamilyCollectorInputD','FamilyCollectorReturnD','collect_current_family_returns_d.src'),
    ('workflow.bind_solving_state_d','SolvingStateInputD','SolvingStateReturnD','bind_solving_state_d.src'),
    ('workflow.answer_solving_question_d','SolvingQuestionInputD','SolvingQuestionReturnD','answer_solving_question_d.src'),
    ('workflow.answer_solving_question_value_d','SolvingQuestionInputD','SolvingQuestionReturnD','answer_solving_question_d.src'),
    ('workflow.produce_solving_question_contribution_d','Any','Any','answer_solving_question_d.src'),
    ('workflow.compile_frontier_prefix_d','FrontierPrefixInputD','FrontierPrefixReturnD','compile_frontier_prefix_d.src'),
    ('workflow.compose_acquired_frontiers_d','FrontierCompositionInputD','FrontierCompositionReturnD','compose_acquired_frontiers_d.src'),
    ('workflow.answer_support_solving_d','SupportSolvingInputD','SupportSolvingAnswerD','answer_support_solving_d.src'),
    ('workflow.calculate_coupled_member_control','CoupledMemberRequest','DMechanicalResult','calculate_coupled_member_control.src'),
    ('workflow.calculate_cadenced_rail_transfer','CadencedRailRequest','DMechanicalResult','calculate_cadenced_rail_transfer.src'),
    ('workflow.calculate_discrete_relay_optics','DiscreteOpticsRequest','DMechanicalResult','calculate_discrete_relay_optics.src'),
    ('workflow.calculate_finite_alignment','FiniteAlignmentRequest','DMechanicalResult','calculate_finite_alignment.src'),
    ('workflow.calculate_cyclic_configuration_coverage','CyclicCoverageRequest','DMechanicalResult','calculate_cyclic_configuration_coverage.src'),
    ('workflow.calculate_fixed_program_origin','FixedProgramRequest','DMechanicalResult','calculate_fixed_program_origin.src'),
    ('workflow.calculate_temporal_fragment_match','TemporalFragmentRequest','DMechanicalResult','calculate_temporal_fragment_match.src'),
    ('workflow.calculate_visual_sequence','VisualSequenceRequest','DMechanicalResult','calculate_visual_sequence.src'),
    ('workflow.calculate_topological_region_recolor','TopologicalRecolorRequest','DMechanicalResult','calculate_topological_region_recolor.src'),
    ('workflow.calculate_reactive_capture','ReactiveCaptureRequest','DMechanicalResult','calculate_reactive_capture.src'),
    ('workflow.calculate_neighborhood_pattern_construction','NeighborhoodPatternRequest','DMechanicalResult','calculate_neighborhood_pattern_construction.src'),
    ('workflow.calculate_layered_prefix_construction','LayeredPrefixRequest','DMechanicalResult','calculate_layered_prefix_construction.src'),
    ('workflow.calculate_preview_piece_packing','PreviewPackingRequest','DMechanicalResult','calculate_preview_piece_packing.src'),
    ('workflow.calculate_station_profile_workbench','StationWorkbenchRequest','DMechanicalResult','calculate_station_profile_workbench.src'),
    ('workflow.calculate_supported_construction','SupportedConstructionRequest','DMechanicalResult','calculate_supported_construction.src'),
    ('workflow.calculate_visible_voxel_construction','VisibleVoxelRequest','DMechanicalResult','calculate_visible_voxel_construction.src'),
    ('workflow.calculate_wrap_slide','WrapRequest','MechanicalNormalizedReturn','calculate_wrap_slide.src'),
    ('workflow.calculate_latent_reference_restoration','RestorationRequest','MechanicalNormalizedReturn','calculate_latent_reference_restoration.src'),
    ('workflow.calculate_finite_instruction_device','DeviceRequest','MechanicalNormalizedReturn','calculate_finite_instruction_device.src'),
    ('workflow.calculate_typed_material_workbench','MaterialRequest','MechanicalNormalizedReturn','calculate_typed_material_workbench.src'),
    ('workflow.calculate_local_field_type_production','LocalRequest','MechanicalNormalizedReturn','calculate_local_field_type_production.src'),
    ('workflow.calculate_directed_accretive_flow','DirectedRequest','MechanicalNormalizedReturn','calculate_directed_accretive_flow.src'),
    ('workflow.calculate_station_gated_cargo','StationCargoRequest','MechanicalNormalizedReturn','calculate_station_gated_cargo.src'),
    ('workflow.calculate_piercing_rooted_order','PiercingRequest','MechanicalNormalizedReturn','calculate_piercing_rooted_order.src'),
    ('workflow.calculate_recurring_quantity_control','QuantityRequest','MechanicalNormalizedReturn','calculate_recurring_quantity_control.src'),
    ('workflow.calculate_oriented_cargo_handoffs','HandoffRequest','MechanicalNormalizedReturn','calculate_oriented_cargo_handoffs.src'),
    ('workflow.calculate_rewritable_endpoint_transport','EndpointTransportRequest','MechanicalNormalizedReturn','calculate_rewritable_endpoint_transport.src'),
    ('workflow.calculate_oriented_passage','OrientedPassageRequest','MechanicalNormalizedReturn','calculate_oriented_passage.src'),
    ('workflow.calculate_adversarial_drop_alignment','AdversarialDropRequest','MechanicalNormalizedReturn','calculate_adversarial_drop_alignment.src'),
    ('workflow.calculate_chromatic_window_composition','ChromaticWindowRequest','MechanicalNormalizedReturn','calculate_chromatic_window_composition.src'),
    ('workflow.calculate_charted_room_navigation','ChartedNavigationRequest','MechanicalNormalizedReturn','calculate_charted_room_navigation.src'),
    ('workflow.calculate_inventory_gated_navigation','InventoryNavigationRequest','MechanicalNormalizedReturn','calculate_inventory_gated_navigation.src'),
    ('workflow.calculate_visibility_capacity_navigation','CapacityRoomRequest','MechanicalNormalizedReturn','calculate_visibility_capacity_navigation.src'),
    ('workflow.calculate_ordered_support_transfer','OrderedRequest','MechanicalNormalizedReturn','calculate_ordered_support_transfer.src'),
    ('workflow.calculate_autonomous_route_intervention','RouteInterventionRequest','MechanicalNormalizedReturn','calculate_autonomous_route_intervention.src'),
    ('workflow.calculate_feedback_code_identification','FeedbackCodeRequest','MechanicalNormalizedReturn','calculate_feedback_code_identification.src'),
    ('workflow.calculate_identity_contact_authentication','IdentityContactRequest','MechanicalNormalizedReturn','calculate_identity_contact_authentication.src'),
    ('workflow.calculate_hidden_motion_reception','HiddenReceptionRequest','MechanicalNormalizedReturn','calculate_hidden_motion_reception.src'),
    ('workflow.calculate_ballistic_targeting','BallisticRequest','MechanicalNormalizedReturn','calculate_ballistic_targeting.src'),
    ('workflow.calculate_push_only_logistics','PushRequest','MechanicalNormalizedReturn','calculate_push_only_logistics.src'),
    ('workflow.calculate_mutable_kit_survival','MutableKitRequest','MechanicalNormalizedReturn','calculate_mutable_kit_survival.src'),
    ('workflow.calculate_finite_relation_network','FiniteRelationRequest','MechanicalNormalizedReturn','calculate_finite_relation_network.src'),
    ('workflow.calculate_finite_flow_network','FlowRequest','MechanicalNormalizedReturn','calculate_finite_flow_network.src'),
    ('workflow.calculate_editable_actor_programs','ProgramRequest','MechanicalNormalizedReturn','calculate_editable_actor_programs.src'),
    ('workflow.calculate_shared_symbol_automata','SharedSymbolRequest','MechanicalNormalizedReturn','calculate_shared_symbol_automata.src'),
    ('workflow.calculate_common_events','EventCompositionInputC','MechanicalNormalizedReturn','calculate_common_events.src'),
    ('workflow.calculate_common_path','SimulationPathInputC','MechanicalNormalizedReturn','calculate_common_path.src'),
    ('workflow.calculate_common_search','SearchDomainInputC','MechanicalNormalizedReturn','calculate_common_search.src'),
    ('workflow.calculate_common_external_step_c','ExternalStepInputC','ExternalStepDispatchResultC','calculate_common_external_step_c.src'),
    ('workflow.calculate_common_path_driver_c','PathDriverInputC','MechanicalNormalizedReturn','calculate_common_path_driver_c.src'),
    ('workflow.calculate_common_search_driver_c','SearchDriverInputC','MechanicalNormalizedReturn','calculate_common_search_driver_c.src'),
    ('workflow.solve_rigid_rearrangement_c','RigidRearrangementInputC','MechanicalNormalizedReturn','solve_rigid_rearrangement_c.src'),
    ('workflow.append_observed_rigid_rearrangement_c','RigidSceneProposalC','InteractionProbeAgenda','append_observed_rigid_rearrangement_c.src'),
    ('workflow.calculate_rigid_search_batch_c','SearchDriverSessionC','RigidSearchBatchDispatchC','calculate_rigid_search_batch_c.src'),
    ('workflow.reconcile_relevance_c','RelevanceInputC','RelevanceDeltaC','reconcile_relevance_c.src'),
    ('workflow.calculate_neighborhood_external_step_c','NeighborhoodStepInputC','NeighborhoodStepDispatchC','calculate_neighborhood_external_step_c.src'),
    ('workflow.calculate_neighborhood_route_search_c','NeighborhoodSearchInputC','MechanicalNormalizedReturn','calculate_neighborhood_route_search_c.src'),
    ('workflow.assess_typed_mask_relation_c','TypedMaskRelationInputC','TypedMaskDecisionC','assess_typed_mask_relation_c.src'),
    ('workflow.assess_terrain_frontier_c','TerrainFrontierInputC','TerrainFrontierDecisionC','assess_terrain_frontier_c.src'),
    ('workflow.assess_supposition_axes_c','SuppositionAxesInputC','SuppositionAxesDecisionC','assess_supposition_axes_c.src'),
    ('workflow.calculate_metric_external_step_c','MetricStepInputC','MetricStepDispatchC','calculate_metric_external_step_c.src'),
    ('workflow.calculate_metric_route_search_c','MetricSearchInputC','MechanicalNormalizedReturn','calculate_metric_route_search_c.src'),
    ('workflow.assess_transit_shape_c','TransitShapeInputC','StructuralSuppositionDecisionC','assess_transit_shape_c.src'),
    ('workflow.assess_layer_contact_c','LayerContactInputC','StructuralSuppositionDecisionC','assess_layer_contact_c.src'),
    ('workflow.assess_visible_graph_c','VisibleGraphInputC','StructuralSuppositionDecisionC','assess_visible_graph_c.src'),
    ('workflow.route_measurement_extension_c','MeasurementExtensionInputC','MeasurementExtensionDecisionC','route_measurement_extension_c.src'),
    ('workflow.assess_morphological_bottleneck_c','MorphologicalBottleneckInputC','MorphologicalBottleneckDecisionC','assess_morphological_bottleneck_c.src'),
    ('workflow.route_consumer_measurement_need_c','ConsumerMeasurementNeedInputC','ConsumerMeasurementNeedDecisionC','route_consumer_measurement_need_c.src'),
    ('workflow.assess_relief_supposition_c','ReliefSuppositionInputC','ReliefSuppositionDecisionC','assess_relief_supposition_c.src'),
    ('workflow.assess_support_supposition_c','ReconfigurableSupportSuppositionInputC','SupportValueSuppositionDecisionC','assess_support_supposition_c.src'),
    ('workflow.assess_coupled_value_supposition_c','CoupledValueSuppositionInputC','SupportValueSuppositionDecisionC','assess_coupled_value_supposition_c.src'),
    ('workflow.assess_articulated_channel_supposition_c','ArticulatedChannelSuppositionInputC','EndpointSuppositionDecisionC','assess_articulated_channel_supposition_c.src'),
    ('workflow.assess_inverse_anchor_supposition_c','InverseAnchorSuppositionInputC','EndpointSuppositionDecisionC','assess_inverse_anchor_supposition_c.src'),
    ('workflow.assess_contact_shape_supposition_c','ContactShapeSuppositionInputC','EndpointSuppositionDecisionC','assess_contact_shape_supposition_c.src'),
    ('workflow.assess_typed_program_supposition_c','TypedProgramSuppositionInputC','ProgramSuppositionDecisionC','assess_typed_program_supposition_c.src'),
    ('workflow.assess_instruction_device_supposition_c','InstructionDeviceSuppositionInputC','ProgramSuppositionDecisionC','assess_instruction_device_supposition_c.src'),
    ('workflow.assess_recipe_operator_supposition_c','RecipeOperatorSuppositionInputC','ProgramSuppositionDecisionC','assess_recipe_operator_supposition_c.src'),
    ('workflow.assess_adversarial_supposition_c', 'AdversarialSuppositionInputC', 'ProductionSuppositionDecisionC', 'assess_adversarial_supposition_c.src'),
    ('workflow.assess_autonomous_intervention_supposition_c', 'AutonomousInterventionInputC', 'MotionSuppositionDecisionC', 'assess_autonomous_intervention_supposition_c.src'),
    ('workflow.assess_ballistic_supposition_c', 'BallisticSuppositionInputC', 'MotionSuppositionDecisionC', 'assess_ballistic_supposition_c.src'),
    ('workflow.assess_chromatic_supposition_c', 'ChromaticSuppositionInputC', 'ProductionSuppositionDecisionC', 'assess_chromatic_supposition_c.src'),
    ('workflow.assess_directed_flow_supposition_c', 'DirectedFlowSuppositionInputC', 'MaterialSuppositionDecisionC', 'assess_directed_flow_supposition_c.src'),
    ('workflow.assess_hidden_reception_supposition_c', 'HiddenReceptionInputC', 'MotionSuppositionDecisionC', 'assess_hidden_reception_supposition_c.src'),
    ('workflow.assess_kit_survival_supposition_c', 'KitSurvivalInputC', 'MotionSuppositionDecisionC', 'assess_kit_survival_supposition_c.src'),
    ('workflow.assess_latent_restoration_supposition_c', 'LatentRestorationSuppositionInputC', 'ProductionSuppositionDecisionC', 'assess_latent_restoration_supposition_c.src'),
    ('workflow.assess_local_field_supposition_c', 'LocalFieldSuppositionInputC', 'MaterialSuppositionDecisionC', 'assess_local_field_supposition_c.src'),
    ('workflow.assess_ordered_transfer_supposition_c', 'OrderedTransferSuppositionInputC', 'MotionSuppositionDecisionC', 'assess_ordered_transfer_supposition_c.src'),
    ('workflow.assess_oriented_cargo_supposition_c', 'OrientedCargoSuppositionInputC', 'TransportSuppositionDecisionC', 'assess_oriented_cargo_supposition_c.src'),
    ('workflow.assess_piercing_order_supposition_c', 'PiercingOrderSuppositionInputC', 'TransportSuppositionDecisionC', 'assess_piercing_order_supposition_c.src'),
    ('workflow.assess_quantity_identity_supposition_c', 'QuantityIdentitySuppositionInputC', 'TransportSuppositionDecisionC', 'assess_quantity_identity_supposition_c.src'),
    ('workflow.assess_reaction_supposition_c', 'ReactionSuppositionInputC', 'ProductionSuppositionDecisionC', 'assess_reaction_supposition_c.src'),
    ('workflow.assess_reactive_graph_supposition_c', 'ReactiveGraphSuppositionInputC', 'TransportSuppositionDecisionC', 'assess_reactive_graph_supposition_c.src'),
    ('workflow.assess_recognition_boundary_c', 'RecognitionBoundaryInputC', 'RecognitionBoundaryDecisionC', 'assess_recognition_boundary_c.src'),
    ('workflow.assess_word_transduction_supposition_c', 'WordTransductionSuppositionInputC', 'MaterialSuppositionDecisionC', 'assess_word_transduction_supposition_c.src'),
    ('workflow.assess_workbench_supposition_c', 'WorkbenchSuppositionInputC', 'ProductionSuppositionDecisionC', 'assess_workbench_supposition_c.src'),
    ('workflow.retain_indexed_sequence_c', 'IndexedSequenceInputC', 'IndexedSequenceDecisionC', 'retain_indexed_sequence_c.src'),
    ('workflow.assess_feedback_identification_supposition_c', 'FeedbackIdentificationSuppositionInputC', 'KnowledgeSuppositionDecisionC', 'assess_feedback_identification_supposition_c.src'),
    ('workflow.assess_finite_network_supposition_c', 'FiniteNetworkSuppositionInputC', 'KnowledgeSuppositionDecisionC', 'assess_finite_network_supposition_c.src'),
    ('workflow.assess_inventory_navigation_supposition_c', 'InventoryNavigationSuppositionInputC', 'KnowledgeSuppositionDecisionC', 'assess_inventory_navigation_supposition_c.src'),
    ('workflow.assess_lineage_supposition_c', 'LineageSuppositionInputC', 'KnowledgeSuppositionDecisionC', 'assess_lineage_supposition_c.src'),
    ('workflow.assess_temporal_reference_supposition_c', 'TemporalReferenceSuppositionInputC', 'KnowledgeSuppositionDecisionC', 'assess_temporal_reference_supposition_c.src'),
    ('workflow.assess_authentication_supposition_c', 'AuthenticationSuppositionInputC', 'InteractionSuppositionDecisionC', 'assess_authentication_supposition_c.src'),
    ('workflow.assess_endpoint_rewrite_supposition_c', 'EndpointRewriteSuppositionInputC', 'InteractionSuppositionDecisionC', 'assess_endpoint_rewrite_supposition_c.src'),
    ('workflow.assess_push_logistics_supposition_c', 'PushLogisticsSuppositionInputC', 'InteractionSuppositionDecisionC', 'assess_push_logistics_supposition_c.src'),
    ('workflow.assess_recurring_quantity_supposition_c', 'RecurringQuantitySuppositionInputC', 'InteractionSuppositionDecisionC', 'assess_recurring_quantity_supposition_c.src'),
    ('workflow.assess_shared_symbol_supposition_c', 'SharedSymbolSuppositionInputC', 'InteractionSuppositionDecisionC', 'assess_shared_symbol_supposition_c.src'),
    ('workflow.assess_actor_program_supposition_c', 'ActorProgramSuppositionInputC', 'CapacitySuppositionDecisionC', 'assess_actor_program_supposition_c.src'),
    ('workflow.assess_finite_flow_supposition_c', 'FiniteFlowSuppositionInputC', 'CapacitySuppositionDecisionC', 'assess_finite_flow_supposition_c.src'),
    ('workflow.assess_visibility_capacity_supposition_c', 'VisibilityCapacitySuppositionInputC', 'CapacitySuppositionDecisionC', 'assess_visibility_capacity_supposition_c.src'),
    ('workflow.assess_wrap_slide_supposition_c', 'WrapSlideSuppositionInputC', 'CapacitySuppositionDecisionC', 'assess_wrap_slide_supposition_c.src'),
    ('workflow.assess_cyclic_coverage_supposition_c', 'CyclicCoverageSuppositionInputC', 'GoalSuppositionDecisionC', 'assess_cyclic_coverage_supposition_c.src'),
    ('workflow.assess_metric_image_supposition_c', 'MetricImageSuppositionInputC', 'GoalSuppositionDecisionC', 'assess_metric_image_supposition_c.src'),
    ('workflow.assess_oriented_passage_supposition_c', 'OrientedPassageSuppositionInputC', 'GoalSuppositionDecisionC', 'assess_oriented_passage_supposition_c.src'),
    ('workflow.assess_reactive_capture_supposition_c', 'ReactiveCaptureSuppositionInputC', 'GoalSuppositionDecisionC', 'assess_reactive_capture_supposition_c.src'),
    ('workflow.assess_station_cargo_supposition_c', 'StationCargoSuppositionInputC', 'GoalSuppositionDecisionC', 'assess_station_cargo_supposition_c.src'),
    ('workflow.assess_cadenced_rail_supposition_c', 'CadencedRailSuppositionInputC', 'CheckpointSuppositionDecisionC', 'assess_cadenced_rail_supposition_c.src'),
    ('workflow.assess_charted_room_supposition_c', 'ChartedRoomSuppositionInputC', 'CheckpointSuppositionDecisionC', 'assess_charted_room_supposition_c.src'),
    ('workflow.assess_fixed_origin_supposition_c', 'FixedOriginSuppositionInputC', 'CheckpointSuppositionDecisionC', 'assess_fixed_origin_supposition_c.src'),
    ('workflow.assess_gravity_adhesion_supposition_c', 'GravityAdhesionSuppositionInputC', 'CheckpointSuppositionDecisionC', 'assess_gravity_adhesion_supposition_c.src'),
    ('workflow.assess_topological_recolor_supposition_c', 'TopologicalRecolorSuppositionInputC', 'CheckpointSuppositionDecisionC', 'assess_topological_recolor_supposition_c.src'),
    ('workflow.assess_axial_field_supposition_c', 'AxialFieldSuppositionInputC', 'ViewSuppositionDecisionC', 'assess_axial_field_supposition_c.src'),
    ('workflow.assess_preview_packing_supposition_c', 'PreviewPackingSuppositionInputC', 'ViewSuppositionDecisionC', 'assess_preview_packing_supposition_c.src'),
    ('workflow.assess_profile_workbench_supposition_c', 'ProfileWorkbenchSuppositionInputC', 'ViewSuppositionDecisionC', 'assess_profile_workbench_supposition_c.src'),
    ('workflow.assess_temporal_fragment_supposition_c', 'TemporalFragmentSuppositionInputC', 'ViewSuppositionDecisionC', 'assess_temporal_fragment_supposition_c.src'),
    ('workflow.assess_voxel_view_supposition_c', 'VoxelViewSuppositionInputC', 'ViewSuppositionDecisionC', 'assess_voxel_view_supposition_c.src'),
    ('workflow.assess_alignment_game_supposition_c', 'AlignmentGameSuppositionInputC', 'CompletionSuppositionDecisionC', 'assess_alignment_game_supposition_c.src'),
    ('workflow.assess_bounded_joystick_supposition_c', 'BoundedJoystickSuppositionInputC', 'CompletionSuppositionDecisionC', 'assess_bounded_joystick_supposition_c.src'),
    ('workflow.assess_layered_prefix_supposition_c', 'LayeredPrefixSuppositionInputC', 'CompletionSuppositionDecisionC', 'assess_layered_prefix_supposition_c.src'),
    ('workflow.assess_neighborhood_supposition_c', 'NeighborhoodSuppositionInputC', 'CompletionSuppositionDecisionC', 'assess_neighborhood_supposition_c.src'),
    ('workflow.assess_relay_optics_supposition_c', 'RelayOpticsSuppositionInputC', 'CompletionSuppositionDecisionC', 'assess_relay_optics_supposition_c.src'),
    ('workflow.assess_supported_construction_supposition_c', 'SupportedConstructionSuppositionInputC', 'CompletionSuppositionDecisionC', 'assess_supported_construction_supposition_c.src'),
    ('workflow.assess_visual_sequence_supposition_c', 'VisualSequenceSuppositionInputC', 'CompletionSuppositionDecisionC', 'assess_visual_sequence_supposition_c.src'),
    ('workflow.rebind_entry_memory_c', 'EntryMemoryInputC', 'EntryMemorySessionC', 'rebind_entry_memory_c.src'),
    ('workflow.assess_region_frontier_c', 'RegionFrontierInputC', 'RegionDecisionC', 'assess_region_frontier_c.src'),
    ('workflow.assess_lattice_calibration_c', 'LatticeCalibrationInputC', 'LatticeCalibrationDecisionC', 'assess_lattice_calibration_c.src'),
    ('workflow.assess_guidance_relation_c', 'GuidanceRelationInputC', 'GuidanceDecisionC', 'assess_guidance_relation_c.src'),
    ('workflow.assess_experiment_frontier_c', 'ExperimentFrontierInputC', 'ExperimentDecisionC', 'assess_experiment_frontier_c.src'),
    ('workflow.reconcile_understanding_observation', 'UnderstandingObservationInput', 'UnderstandingObservationReturn', 'reconcile_understanding_observation.src'),
    ('workflow.assess_counterfactual_audit_c', 'CounterfactualPathInputC', 'CounterfactualAuditDecisionC', 'assess_counterfactual_audit_c.src'),
    ('workflow.assess_search_witness_scope_c', 'SearchWitnessScopeInputC', 'SearchWitnessScopeDecisionC', 'assess_search_witness_scope_c.src'),
    ('workflow.calculate_optical_external_step_c', 'OpticalStepInputC', 'OpticalStepDispatchC', 'calculate_optical_external_step_c.src'),
    ('workflow.calculate_rail_external_step_c', 'RailStepInputC', 'RailStepDispatchC', 'calculate_rail_external_step_c.src'),
    ('workflow.calculate_workshop_external_step_c', 'WorkshopStepInputC', 'WorkshopStepDispatchC', 'calculate_workshop_external_step_c.src'),
    ('workflow.calculate_packing_external_step_c', 'PackingStepInputC', 'PackingStepDispatchC', 'calculate_packing_external_step_c.src'),
    ('workflow.calculate_voxel_external_step_c', 'VoxelStepInputC', 'VoxelStepDispatchC', 'calculate_voxel_external_step_c.src'),
    ('workflow.calculate_fragment_external_step_c', 'FragmentStepInputC', 'FragmentStepDispatchC', 'calculate_fragment_external_step_c.src'),
    ('workflow.calculate_program_external_step_c', 'ProgramStepInputC', 'ProgramStepDispatchC', 'calculate_program_external_step_c.src'),
    ('workflow.calculate_recolor_external_step_c', 'RecolorStepInputC', 'RecolorStepDispatchC', 'calculate_recolor_external_step_c.src'),
    ('workflow.calculate_construction_external_step_c', 'ConstructionStepInputC', 'ConstructionStepDispatchC', 'calculate_construction_external_step_c.src'),
    ('workflow.calculate_sequence_external_step_c', 'SequenceStepInputC', 'SequenceStepDispatchC', 'calculate_sequence_external_step_c.src'),
    ('workflow.calculate_alignment_external_step_c', 'AlignmentStepInputC', 'AlignmentStepDispatchC', 'calculate_alignment_external_step_c.src'),
    ('workflow.calculate_joystick_external_step_c', 'JoystickStepInputC', 'JoystickStepDispatchC', 'calculate_joystick_external_step_c.src'),
    ('workflow.calculate_prefix_external_step_c', 'PrefixStepInputC', 'PrefixStepDispatchC', 'calculate_prefix_external_step_c.src'),
    ('workflow.calculate_capture_external_step_c', 'CaptureStepInputC', 'CaptureStepDispatchC', 'calculate_capture_external_step_c.src'),
    ('workflow.calculate_axial_external_step_c', 'AxialStepInputC', 'AxialStepDispatchC', 'calculate_axial_external_step_c.src'),
    ('workflow.calculate_cycle_external_step_c', 'CycleStepInputC', 'CycleStepDispatchC', 'calculate_cycle_external_step_c.src'),
    ('workflow.assess_guarded_transport_supposition_c', 'GuardedTransportSuppositionInputC', 'BExtensionSuppositionDecisionC', 'assess_guarded_transport_supposition_c.src'),
    ('workflow.assess_queued_cascade_supposition_c', 'QueuedCascadeSuppositionInputC', 'BExtensionSuppositionDecisionC', 'assess_queued_cascade_supposition_c.src'),
    ('workflow.prebind_complete_owner_c', 'CompleteOwnerInputC', 'CompleteOwnerBindingC', 'prebind_complete_owner_c.src'),
    ('workflow.reconcile_complete_owner_c', 'CompleteOwnerReconciliationInputC', 'CompleteOwnerReturnC', 'reconcile_complete_owner_c.src'),
    ('workflow.calculate_oriented_passage_external_step_c', 'OrientedPacketStepInputC', 'APacketStepDispatchC', 'calculate_oriented_passage_external_step_c.src'),
    ('workflow.calculate_charted_room_navigation_external_step_c', 'ChartedPacketStepInputC', 'APacketStepDispatchC', 'calculate_charted_room_navigation_external_step_c.src'),
    ('workflow.calculate_station_gated_cargo_external_step_c', 'StationPacketStepInputC', 'APacketStepDispatchC', 'calculate_station_gated_cargo_external_step_c.src'),
    ('workflow.calculate_wrap_slide_external_step_c', 'WrapPacketStepInputC', 'APacketStepDispatchC', 'calculate_wrap_slide_external_step_c.src'),
    ('workflow.certify_macro_expansion_c', 'MacroExpansionInputC', 'MacroExpansionReturnC', 'certify_macro_expansion_c.src'),
    ('workflow.calculate_finite_csp_c', 'FiniteSearchInputC', 'FiniteSearchFactsC', 'calculate_finite_csp_c.src'),
    ('workflow.calculate_finite_dp_c', 'FiniteSearchInputC', 'FiniteSearchFactsC', 'calculate_finite_dp_c.src'),
    ('workflow.calculate_device_edit_chain_c', 'FiniteSearchInputC', 'FiniteSearchFactsC', 'calculate_device_edit_chain_c.src'),
    ('workflow.calculate_guarded_search_c', 'GuardedSearchInputC', 'GuardedSearchReturnC', 'calculate_guarded_search_c.src'),
    ('workflow.calculate_gravity_external_step_c', 'GravityStepInputC', 'GravityStepDispatchC', 'calculate_gravity_external_step_c.src'),
    ('workflow.calculate_registered_external_adapter_c', 'RegisteredAdapterInputC', 'RegisteredAdapterDispatchC', 'calculate_registered_external_adapter_c.src'),
    ('workflow.calculate_reactive_graph_c', 'ReactiveGraphRequestC', 'ReactiveGraphSourceReturnC', 'calculate_reactive_graph_c.src'),
    ('workflow.calculate_coupled_value_c', 'CoupledValueRequestC', 'CoupledValueSourceReturnC', 'calculate_coupled_value_c.src'),
    ('workflow.calculate_prefix_query_c', 'PrefixQuerySourceInputC', 'PrefixQuerySourceReturnC', 'calculate_prefix_query_c.src'),
    ('workflow.prepare_coupled_solving_c', 'CoupledSolvingInputC', 'CoupledSolvingQuestionC', 'prepare_coupled_solving_c.src'),
    ('workflow.answer_coupled_solving_c', 'CoupledSolvingExecutionInputC', 'CoupledSolvingAnswerC', 'answer_coupled_solving_c.src'),
    ('workflow.consume_coupled_solving_c', 'CoupledSolvingReceiptInputC', 'CoupledSolvingConsumedC', 'consume_coupled_solving_c.src'),
    ('workflow.compose_coupled_solving_c', 'CoupledSolvingJoinInputC', 'CoupledSolvingJoinedC', 'compose_coupled_solving_c.src'),
    ('workflow.answer_prefix_solving_c', 'PrefixSolvingInputC', 'PrefixSolvingReturnC', 'answer_prefix_solving_c.src'),
    ('workflow.answer_reactive_solving_c', 'ReactiveSolvingInputC', 'ReactiveSolvingReturnC', 'answer_reactive_solving_c.src'),
    ('workflow.answer_optical_solving_c', 'OpticalSolvingInputC', 'OpticalSolvingReturnC', 'answer_optical_solving_c.src'),
    ('workflow.answer_relief_solving_c', 'ReliefSolvingInputC', 'ReliefSolvingReturnC', 'answer_relief_solving_c.src'),
    ('workflow.answer_relief_frontier_c', 'ReliefFrontierInputC', 'ReliefFrontierReturnC', 'answer_relief_frontier_c.src'),
    ('workflow.answer_axial_solving_c', 'AxialSolvingInputC', 'AxialSolvingReturnC', 'answer_axial_solving_c.src'),
    ('workflow.answer_word_solving_c', 'WordSolvingInputC', 'WordSolvingReturnC', 'answer_word_solving_c.src'),
    ('workflow.answer_word_frontier_c', 'WordFrontierInputC', 'WordFrontierReturnC', 'answer_word_frontier_c.src'),
    ('workflow.measure_effect_frontier_c','EffectFrontierInputC','EffectFrontierReturnC','measure_effect_frontier_c.src'),
    ('workflow.normalize_coupled_native_c','EffectFrontierFactsC','MechanicalNormalizedReturn','normalize_coupled_native_c.src'),
    ('workflow.calculate_program_effect_c','EffectFrontierFactsC','MechanicalNormalizedReturn','calculate_program_effect_c.src'),
    ('workflow.calculate_owned_program_request_c','ProgramEffectRequestC','MechanicalNormalizedReturn','calculate_program_effect_c.src'),
    ('workflow.reconcile_word_dependencies_c', 'WordSolvingFactsC', 'WordDependencyReturnC', 'reconcile_word_dependencies_c.src'),
    ('workflow.answer_anchor_solving_c', 'AnchorSolvingInputC', 'AnchorSolvingReturnC', 'answer_anchor_solving_c.src'),
    ('workflow.answer_anchor_frontier_c', 'AnchorFrontierInputC', 'AnchorFrontierReturnC', 'answer_anchor_frontier_c.src'),
    ('workflow.publish_anchor_bindings_c', 'AnchorSolvingInputC', 'AnchorBindingReturnC', 'publish_anchor_bindings_c.src'),
    ('workflow.answer_shape_solving_c', 'ShapeSolvingInputC', 'ShapeSolvingReturnC', 'answer_shape_solving_c.src'),
    ('workflow.publish_shape_bindings_c', 'ShapeSolvingInputC', 'ShapeBindingReturnC', 'publish_shape_bindings_c.src'),
    ('workflow.publish_shape_associations_c', 'ShapeSolvingInputC', 'ShapeBindingReturnC', 'publish_shape_associations_c.src'),
    ('workflow.publish_shape_observation_plan_c', 'ShapeSolvingInputC', 'ShapeBindingReturnC', 'publish_shape_observation_plan_c.src'),
    ('workflow.publish_shape_observed_geometry_c', 'ShapeSolvingInputC', 'ShapeBindingReturnC', 'publish_shape_observed_geometry_c.src'),
    ('workflow.retain_shape_geometry_hypothesis_c', 'ShapeRetainedGeometryInputC', 'ShapeRetainedGeometryFactsC', 'retain_shape_geometry_hypothesis_c.src'),
    ('workflow.publish_shape_hypotheses_c', 'ShapeConditionalInputC', 'ShapeBindingReturnC', 'publish_shape_hypotheses_c.src'),
    ('workflow.answer_shape_conditional_c', 'ShapeConditionalInputC', 'ShapeConditionalReturnC', 'answer_shape_conditional_c.src'),
)


def common_runtime_entries_c(factory):
    from .effect_frontier_registry_c import effect_frontier_entries_c
    return (portable_local_entries(factory)+packet_boundary_entries(factory)+parameterized_control_entries(factory)+homologous_interface_entries(factory)+contextual_compartment_entries(factory)+component_network_entries(factory)+observed_neighbor_entries(factory)+cell_coverage_entries(factory)+observed_topology_entries(factory)+banded_program_entries(factory)+effect_frontier_entries_c(factory)+mechanical_common_entries_c(factory)
        +rigid_rearrangement_entries_c(factory)
        +rigid_search_batch_entries_c(factory)
        +tuple(entry for entry in mechanical_step_entries_c(factory) if entry.definition.id not in B_EXISTING_PROVIDERS)
        +mechanical_path_driver_entries_c(factory)+mechanical_search_driver_entries_c(factory)+relevance_entries_c(factory)
        +tuple(entry for entry in neighborhood_step_entries_c(factory)
            if entry.definition.id != NEIGHBORHOOD_EXISTING_PROVIDER_C)
        +neighborhood_search_entries_c(factory)
        +typed_mask_entries_c(factory)+terrain_frontier_entries_c(factory)+supposition_axes_entries_c(factory)
        +tuple(entry for entry in metric_step_entries_c(factory) if entry.definition.id != METRIC_EXISTING_PROVIDER_C)
        +metric_search_entries_c(factory)+structural_supposition_entries_c(factory)
        +measurement_extension_entries_c(factory)+measurement_need_entries_c(factory)+metric_schedule_entries_c(factory)
        +relief_supposition_entries_c(factory)+support_value_supposition_entries_c(factory)
        +endpoint_supposition_entries_c(factory)+program_supposition_entries_c(factory)+material_supposition_entries_c(factory)+transport_supposition_entries_c(factory)+production_supposition_entries_c(factory)+motion_supposition_entries_c(factory)+indexed_sequence_entries_c(factory)+recognition_boundary_entries_c(factory)+knowledge_supposition_entries_c(factory)+interaction_supposition_entries_c(factory)+capacity_supposition_entries_c(factory)+goal_supposition_entries_c(factory)+checkpoint_supposition_entries_c(factory)+view_supposition_entries_c(factory)+completion_supposition_entries_c(factory)+entry_memory_entries_c(factory)+region_frontier_entries_c(factory)+lattice_calibration_entries_c(factory)+guidance_relation_entries_c(factory)+experiment_frontier_entries_c(factory)+counterfactual_audit_entries_c(factory)+search_witness_scope_entries_c(factory)+optical_step_entries_c(factory)+rail_step_entries_c(factory)+workshop_step_entries_c(factory)+packing_step_entries_c(factory)+voxel_step_entries_c(factory)+fragment_step_entries_c(factory)+program_step_entries_c(factory)+recolor_step_entries_c(factory)+construction_step_entries_c(factory)+sequence_step_entries_c(factory)+alignment_step_entries_c(factory)+joystick_step_entries_c(factory)+prefix_step_entries_c(factory)+capture_step_entries_c(factory)+axial_step_entries_c(factory)+cycle_step_entries_c(factory)+b_extension_supposition_entries_c(factory)+complete_owner_entries_c(factory)+a_packet_step_entries_c(factory)+macro_expansion_entries_c(factory)+finite_search_entries_c(factory)+guarded_search_entries_c(factory)+gravity_step_entries_c(factory)+registered_adapter_entries_c(factory)+reactive_graph_entries_c(factory)+coupled_value_entries_c(factory)+prefix_query_entries_c(factory)+coupled_solving_entries_c(factory)+prefix_solving_entries_c(factory)+reactive_solving_entries_c(factory)+optical_solving_entries_c(factory)+relief_solving_entries_c(factory)+axial_solving_entries_c(factory)+word_solving_entries_c(factory)+anchor_solving_entries_c(factory)+shape_solving_entries_c(factory))


def common_runtime_signatures_c(type_spec,parameter_spec):
    from .effect_frontier_registry_c import effect_frontier_signatures_c
    signatures=mechanical_common_signatures_c(type_spec,parameter_spec)
    signatures.update(effect_frontier_signatures_c(type_spec,parameter_spec))
    signatures.update(mechanical_step_signatures_c(type_spec,parameter_spec))
    signatures.update(rigid_rearrangement_signatures_c(type_spec,parameter_spec))
    signatures.update(rigid_search_batch_signatures_c(type_spec,parameter_spec))
    signatures.update(mechanical_path_driver_signatures_c(type_spec,parameter_spec))
    signatures.update(mechanical_search_driver_signatures_c(type_spec,parameter_spec))
    signatures.update(relevance_signatures_c(type_spec,parameter_spec))
    neighborhood = neighborhood_step_signatures_c(type_spec,parameter_spec)
    neighborhood.pop(NEIGHBORHOOD_EXISTING_PROVIDER_C)
    signatures.update(neighborhood)
    signatures.update(neighborhood_search_signatures_c(type_spec,parameter_spec))
    signatures.update(typed_mask_signatures_c(type_spec,parameter_spec))
    signatures.update(terrain_frontier_signatures_c(type_spec,parameter_spec))
    signatures.update(supposition_axes_signatures_c(type_spec,parameter_spec))
    metric = metric_step_signatures_c(type_spec,parameter_spec)
    metric.pop(METRIC_EXISTING_PROVIDER_C)
    signatures.update(metric)
    signatures.update(metric_search_signatures_c(type_spec,parameter_spec))
    signatures.update(structural_supposition_signatures_c(type_spec,parameter_spec))
    signatures.update(measurement_extension_signatures_c(type_spec,parameter_spec))
    signatures.update(measurement_need_signatures_c(type_spec,parameter_spec))
    signatures.update(metric_schedule_signatures_c(type_spec,parameter_spec))
    signatures.update(relief_supposition_signatures_c(type_spec,parameter_spec))
    signatures.update(support_value_supposition_signatures_c(type_spec,parameter_spec))
    signatures.update(endpoint_supposition_signatures_c(type_spec,parameter_spec))
    signatures.update(program_supposition_signatures_c(type_spec,parameter_spec))
    signatures.update(material_supposition_signatures_c(type_spec,parameter_spec))
    signatures.update(transport_supposition_signatures_c(type_spec,parameter_spec))
    signatures.update(production_supposition_signatures_c(type_spec,parameter_spec))
    signatures.update(motion_supposition_signatures_c(type_spec,parameter_spec))
    signatures.update(indexed_sequence_signatures_c(type_spec,parameter_spec))
    signatures.update(recognition_boundary_signatures_c(type_spec,parameter_spec))
    signatures.update(knowledge_supposition_signatures_c(type_spec,parameter_spec))
    signatures.update(interaction_supposition_signatures_c(type_spec,parameter_spec))
    signatures.update(capacity_supposition_signatures_c(type_spec,parameter_spec))
    signatures.update(goal_supposition_signatures_c(type_spec,parameter_spec))
    signatures.update(checkpoint_supposition_signatures_c(type_spec,parameter_spec))
    signatures.update(view_supposition_signatures_c(type_spec,parameter_spec))
    signatures.update(completion_supposition_signatures_c(type_spec,parameter_spec))
    signatures.update(entry_memory_signatures_c(type_spec,parameter_spec))
    signatures.update(region_frontier_signatures_c(type_spec,parameter_spec))
    signatures.update(lattice_calibration_signatures_c(type_spec,parameter_spec))
    signatures.update(guidance_relation_signatures_c(type_spec,parameter_spec))
    signatures.update(experiment_frontier_signatures_c(type_spec,parameter_spec))
    signatures.update(counterfactual_audit_signatures_c(type_spec,parameter_spec))
    signatures.update(search_witness_scope_signatures_c(type_spec,parameter_spec))
    signatures.update(optical_step_signatures_c(type_spec,parameter_spec))
    signatures.update(rail_step_signatures_c(type_spec,parameter_spec))
    signatures.update(workshop_step_signatures_c(type_spec,parameter_spec))
    signatures.update(packing_step_signatures_c(type_spec,parameter_spec))
    signatures.update(voxel_step_signatures_c(type_spec,parameter_spec))
    signatures.update(fragment_step_signatures_c(type_spec,parameter_spec))
    signatures.update(program_step_signatures_c(type_spec,parameter_spec))
    signatures.update(recolor_step_signatures_c(type_spec,parameter_spec))
    signatures.update(construction_step_signatures_c(type_spec,parameter_spec))
    signatures.update(sequence_step_signatures_c(type_spec,parameter_spec))
    signatures.update(alignment_step_signatures_c(type_spec,parameter_spec))
    signatures.update(joystick_step_signatures_c(type_spec,parameter_spec))
    signatures.update(prefix_step_signatures_c(type_spec,parameter_spec))
    signatures.update(capture_step_signatures_c(type_spec,parameter_spec))
    signatures.update(axial_step_signatures_c(type_spec,parameter_spec))
    signatures.update(cycle_step_signatures_c(type_spec,parameter_spec))
    signatures.update(b_extension_supposition_signatures_c(type_spec,parameter_spec))
    signatures.update(complete_owner_signatures_c(type_spec,parameter_spec))
    signatures.update(a_packet_step_signatures_c(type_spec,parameter_spec))
    signatures.update(macro_expansion_signatures_c(type_spec,parameter_spec))
    signatures.update(finite_search_signatures_c(type_spec,parameter_spec))
    signatures.update(guarded_search_signatures_c(type_spec,parameter_spec))
    signatures.update(gravity_step_signatures_c(type_spec,parameter_spec))
    signatures.update(registered_adapter_signatures_c(type_spec,parameter_spec))
    signatures.update(reactive_graph_signatures_c(type_spec,parameter_spec))
    signatures.update(coupled_value_signatures_c(type_spec,parameter_spec))
    signatures.update(prefix_query_signatures_c(type_spec,parameter_spec))
    signatures.update(coupled_solving_signatures_c(type_spec,parameter_spec))
    signatures.update(prefix_solving_signatures_c(type_spec,parameter_spec))
    signatures.update(reactive_solving_signatures_c(type_spec,parameter_spec))
    signatures.update(optical_solving_signatures_c(type_spec,parameter_spec))
    signatures.update(relief_solving_signatures_c(type_spec,parameter_spec))
    signatures.update(axial_solving_signatures_c(type_spec,parameter_spec))
    signatures.update(word_solving_signatures_c(type_spec,parameter_spec))
    signatures.update(anchor_solving_signatures_c(type_spec,parameter_spec))
    signatures.update(shape_solving_signatures_c(type_spec,parameter_spec))
    for ref in sorted(B_EXISTING_PROVIDERS):signatures.pop(ref)
    signatures.update(portable_local_signatures(type_spec,parameter_spec))
    signatures.update(packet_boundary_signatures(type_spec,parameter_spec))
    signatures.update(banded_program_signatures(type_spec,parameter_spec))
    signatures.update(observed_neighbor_signatures(type_spec,parameter_spec))
    signatures.update(observed_topology_signatures(type_spec,parameter_spec))
    signatures.update(component_network_signatures(type_spec,parameter_spec))
    signatures.update(parameterized_control_signatures(type_spec,parameter_spec))
    signatures.update(homologous_interface_signatures(type_spec,parameter_spec))
    signatures.update(contextual_compartment_signatures(type_spec,parameter_spec))
    signatures.update(cell_coverage_signatures(type_spec,parameter_spec))
    return signatures
