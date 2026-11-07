"""Typed ports for shared frontier acquisition and native return transport."""
from .effect_frontier_contracts_c import EffectFrontierCalculationC,EffectFrontierReturnC,EffectFrontierInterpretationC,CoupledMechanicalReturnBindingC,EffectFrontierPublicationJoinC,EffectFrontierAgendaInputC,EffectFrontierAgendaRequestC
from .effect_frontier_c import bind_effect_frontier_native,finish_effect_frontier_calculation,seal_effect_frontier_interpretation,bind_effect_frontier_coupled_measurement,bind_coupled_mechanical_response,join_effect_frontier_publication,bind_effect_frontier_agenda,finish_effect_frontier_agenda
from .mechanical_request_contracts import MechanicalResponseInput
from .mechanical_request_contracts import MechanicalRequestIdentity
from .mechanical_family_contracts_a import MechanicalFamilyResult
from .reconfigurable_support import SupportRequest
from .articulated_channel_kinematics import ArtiRequest
from .contact_shape_repair import ShapeRequest
from .coupled_value_contracts_c import CoupledValueRequestC
from .editable_actor_programs import ProgramRequest
from .shared_symbol_automata import SharedSymbolRequest
from .finite_relation_network import FiniteRelationRequest
from .finite_flow_network import FlowRequest
from .push_only_logistics import PushRequest
from .mutable_kit_survival import MutableKitRequest
from .hidden_motion_reception import HiddenReceptionRequest
from .ballistic_targeting import BallisticRequest
from .feedback_code_identification import FeedbackCodeRequest
from .identity_contact_authentication import IdentityContactRequest
from .ordered_support_transfer import OrderedRequest
from .autonomous_route_intervention import RouteInterventionRequest
from .inventory_gated_navigation import InventoryNavigationRequest,ChartedNavigationRequest
from .visibility_capacity_navigation import CapacityRoomRequest
from .temporal_reference_matching import RecallRequest
from .adversarial_drop_alignment import AdversarialDropRequest
from .chromatic_window_composition import ChromaticWindowRequest
from .rewritable_endpoint_transport import EndpointTransportRequest,OrientedPassageRequest
from .recurring_quantity_control import QuantityRequest
from .oriented_cargo_handoffs import HandoffRequest
from .station_gated_cargo import StationCargoRequest
from .piercing_rooted_order import PiercingRequest
from .local_field_type_production import LocalRequest
from .directed_accretive_flow import DirectedRequest
from .wrap_slide import WrapRequest
from .latent_reference_restoration import RestorationRequest
from .finite_instruction_device import DeviceRequest
from .typed_material_workbench import MaterialRequest
from .cyclic_configuration_coverage import CyclicCoverageRequest
from .fixed_program_origin import FixedProgramRequest
from .temporal_fragment_match import TemporalFragmentRequest
from .visual_sequence import VisualSequenceRequest
from .topological_region_recolor import TopologicalRecolorRequest
from .reactive_capture import ReactiveCaptureRequest
from .neighborhood_pattern_construction import NeighborhoodPatternRequest
from .layered_prefix_construction import LayeredPrefixRequest
from .preview_piece_packing import PreviewPackingRequest
from .station_profile_workbench import StationWorkbenchRequest
from .supported_construction import SupportedConstructionRequest
from .visible_voxel_construction import VisibleVoxelRequest
from .cadenced_rail_transfer import CadencedRailRequest
from .discrete_relay_optics import DiscreteOpticsRequest
from .finite_alignment_game import FiniteAlignmentRequest
from .coupled_member_control import CoupledMemberRequest
from .metric_frontier_contracts_d import MetricFrontierRequestD
from .reactive_graph_contracts_c import ReactiveGraphRequestC
from .effect_frontier_d_transport import D_FRONTIER_MODELS,D_FRONTIER_KERNELS,EffectFrontierDIdentityInputD,bind_effect_frontier_d_identity,parse_d_frontier_native
from .effect_frontier_d_transport import EffectFrontierDIdentityFactsD
from .program_effect_contracts_c import ProgramEffectRequestC,ProgramEffectPacketC,ProgramEffectMeasurementInputC,ProgramEffectResultFactsC
from .program_effect_c import measure_program_effect_result,bind_program_effect_response
from .program_joint_fit_contracts_d import ProgramJointFitInputD, ProgramJointFitMeasurementsD
from .program_joint_fit_d import measure_program_joint_fit_d
from .program_edit_compilation_contracts_d import ProgramEditCompilationInputD, ProgramEditCompilationMeasurementsD
from .program_edit_compilation_d import measure_program_edit_compilation_d
from .program_validation_contracts_d import ProgramValidationInputD, ProgramValidationMeasurementsD
from .program_validation_d import measure_program_validation_d
from .support_solving_contracts_d import SupportSolvingInputD,SupportSolvingFactsD,SupportSolvingAnswerInputD,SupportSolvingAnswerD
from .support_solving_d import measure_support_solving_question_d,finish_support_solving_answer_d
from .support_solving_contracts_d import SupportSolvingReturnMeasureInputD,SupportSolvingReturnFactsD,SupportSolvingReturnSealInputD
from .support_solving_return_d import measure_support_solving_return_d,seal_support_solving_return_d
from .frontier_composition_contracts_d import FrontierCompositionInputD,FrontierCompositionMeasureInputD,FrontierCompositionFactsD,FrontierCompositionFinishInputD,FrontierCompositionReturnD
from .frontier_composition_d import finish_frontier_composition_d
from .frontier_prefix_contracts_d import FrontierPrefixInputD,FrontierPrefixFactsD,FrontierPrefixCompileInputD,FrontierPrefixReturnD
from .solving_question_contracts_d import SolvingQuestionInputD,SolvingQuestionFactsD,SolvingQuestionReturnD
from .solving_state_contracts_d import SolvingStateInputD,SolvingStateFactsD,SolvingStateReturnD
from .family_return_collector_contracts_d import FamilyCollectionPlanD,FamilyCollectorInputD,FamilyCollectorFactsD,FamilyCollectorReturnD
from .terminal_scope_contracts_d import TerminalScopeInputD,TerminalScopeFactsD,TerminalScopeReturnD
from .restoration_ledger_contracts_d import RestorationLedgerInputD,RestorationLedgerFactsD,RestorationLedgerReturnD
from .goal_derivation_contracts_d import GoalDerivationInputD,GoalDerivationFactsD,GoalDerivationReturnD
from .prerequisite_agenda_contracts_d import PrerequisiteAgendaInputD,PrerequisiteAgendaFactsD,PrerequisiteAgendaReturnD

EFFECT_FRONTIER_C_TYPES=('PrerequisiteAgendaInputD','PrerequisiteAgendaFactsD','PrerequisiteAgendaReturnD','TerminalScopeInputD','TerminalScopeFactsD','TerminalScopeReturnD','FamilyCollectionPlanD','FamilyCollectorInputD','FamilyCollectorFactsD','FamilyCollectorReturnD','SolvingStateInputD','SolvingStateFactsD','SolvingStateReturnD','SolvingQuestionInputD','SolvingQuestionFactsD','SolvingQuestionReturnD','FrontierPrefixInputD','FrontierPrefixFactsD','FrontierPrefixCompileInputD','FrontierPrefixReturnD','FrontierCompositionInputD','FrontierCompositionMeasureInputD','FrontierCompositionFactsD','FrontierCompositionFinishInputD','FrontierCompositionReturnD','SupportSolvingReturnMeasureInputD','SupportSolvingReturnFactsD','SupportSolvingReturnSealInputD','SupportSolvingInputD','SupportSolvingFactsD','SupportSolvingAnswerInputD','SupportSolvingAnswerD','MetricFrontierRequestD','EffectFrontierDIdentityInputD','EffectFrontierDIdentityFactsD','EffectFrontierFacetC','EffectFrontierFieldC','EffectFrontierInputC',
    'EffectFrontierFactsC','EffectFrontierCalculationC','EffectFrontierReturnC','EffectFrontierInterpretationC',
    'CoupledMechanicalReturnBindingC','EffectFrontierPublicationC','EffectFrontierPublicationJoinC','EffectFrontierAgendaInputC','EffectFrontierAgendaRequestC',
    'ProgramEffectRequestC','ProgramEffectPacketC','ProgramEffectMeasurementInputC','ProgramEffectResultFactsC',
    'ProgramJointFitInputD','ProgramJointFitMeasurementsD','ProgramEditCompilationInputD','ProgramEditCompilationMeasurementsD',
    'ProgramValidationInputD','ProgramValidationMeasurementsD')
EFFECT_FRONTIER_C_TYPES+=('RestorationLedgerInputD','RestorationLedgerFactsD','RestorationLedgerReturnD')
EFFECT_FRONTIER_C_TYPES+=('GoalDerivationInputD','GoalDerivationFactsD','GoalDerivationReturnD')


def effect_frontier_entries_c(factory):
    rows=[('capability.effect_frontier_'+name+'_native_c',bind_effect_frontier_native,EffectFrontierCalculationC,kind)
        for name,kind in (('support',SupportRequest),('coupled',CoupledValueRequestC),('articulated',ArtiRequest),('shape',ShapeRequest),('program',ProgramEffectRequestC),
            ('actor_program',ProgramRequest),('symbol_automata',SharedSymbolRequest),('relation_network',FiniteRelationRequest),('flow_network',FlowRequest),
            ('push_logistics',PushRequest),('mutable_kit',MutableKitRequest),('hidden_reception',HiddenReceptionRequest),('ballistic',BallisticRequest),
            ('feedback_code',FeedbackCodeRequest),('identity_contact',IdentityContactRequest),
            ('ordered_transfer',OrderedRequest),('route_intervention',RouteInterventionRequest),
            ('inventory_navigation',InventoryNavigationRequest),('visibility_capacity',CapacityRoomRequest),
            ('charted_navigation',ChartedNavigationRequest),('temporal_recall',RecallRequest),
            ('adversarial_drop',AdversarialDropRequest),('chromatic_pane',ChromaticWindowRequest),
            ('endpoint_transport',EndpointTransportRequest),('oriented_passage',OrientedPassageRequest),
            ('recurring_quantity',QuantityRequest),('oriented_handoff',HandoffRequest),
            ('station_cargo',StationCargoRequest),('rooted_piercing',PiercingRequest),
            ('local_field',LocalRequest),('directed_flow',DirectedRequest),
            ('wrap_slide',WrapRequest),('reference_restore',RestorationRequest),('instruction_device',DeviceRequest),('material_workbench',MaterialRequest),
            ('cyclic_coverage',CyclicCoverageRequest),('fixed_origin',FixedProgramRequest),('temporal_fragment',TemporalFragmentRequest),('visual_sequence',VisualSequenceRequest),('topological_recolor',TopologicalRecolorRequest),('reactive_capture',ReactiveCaptureRequest),('neighborhood_pattern',NeighborhoodPatternRequest),('layered_prefix',LayeredPrefixRequest),('preview_packing',PreviewPackingRequest),('station_profile',StationWorkbenchRequest),('supported_construction',SupportedConstructionRequest),('visible_voxel',VisibleVoxelRequest),
            ('cadenced_rail',CadencedRailRequest),('discrete_optics',DiscreteOpticsRequest),('finite_alignment',FiniteAlignmentRequest),
            ('reactive_graph',ReactiveGraphRequestC),
            ('gravity_adhesion',CoupledMemberRequest),
            ('metric_stack',MetricFrontierRequestD))]
    rows.append(('capability.effect_frontier_calculation_c',finish_effect_frontier_calculation,EffectFrontierCalculationC,EffectFrontierReturnC))
    rows.append(('capability.effect_frontier_seal_c',seal_effect_frontier_interpretation,EffectFrontierInterpretationC,EffectFrontierReturnC))
    rows.extend((('capability.effect_frontier_coupled_measurement_c',bind_effect_frontier_coupled_measurement,EffectFrontierCalculationC,MechanicalFamilyResult),
        ('capability.coupled_mechanical_response_c',bind_coupled_mechanical_response,CoupledMechanicalReturnBindingC,MechanicalResponseInput),
        ('capability.effect_frontier_publication_join_c',join_effect_frontier_publication,EffectFrontierPublicationJoinC,EffectFrontierReturnC),
        ('capability.effect_frontier_agenda_input_c',bind_effect_frontier_agenda,EffectFrontierAgendaInputC,EffectFrontierAgendaRequestC),
        ('capability.effect_frontier_agenda_finish_c',finish_effect_frontier_agenda,EffectFrontierAgendaInputC,EffectFrontierReturnC)))
    rows.extend((('capability.program_effect_result_facts_c',measure_program_effect_result,ProgramEffectMeasurementInputC,ProgramEffectResultFactsC),
        ('capability.program_effect_response_c',bind_program_effect_response,ProgramEffectPacketC,MechanicalResponseInput)))
    rows_return=tuple(factory(capability_id=ref,implementation=method,input_model=inputs,output_model=outputs,
        source_file='effect_frontier_c.py',applicability=('actual_current_sealed_effect',),
        invariants=('same_native_kernel','exact_owner_and_input_closure','no_act'),
        falsifiers=('stale_observation','wrong_native_return','incomplete_projection')) for ref,method,inputs,outputs in rows) + (
        factory(capability_id='capability.effect_frontier_d_identity',implementation=bind_effect_frontier_d_identity,
            input_model=EffectFrontierDIdentityInputD,output_model=EffectFrontierDIdentityFactsD,
            source_file='effect_frontier_d_transport.py',applicability=('source_declared_native_d_question',),
            invariants=('complete_native_identity','no_bound_clamping','no_act'),falsifiers=('wrong_family_schema','identity_mismatch')),
        factory(capability_id='capability.program_joint_fit_d', implementation=measure_program_joint_fit_d,
            input_model=ProgramJointFitInputD, output_model=ProgramJointFitMeasurementsD,
            source_file='program_joint_fit_d.py', applicability=('source_requested_joint_program_fit',),
            invariants=('shared_definition_identity','injective_physical_inventory','bounded_search','no_act'),
            falsifiers=('inconsistent_model','unqualified_prefix_acceptance','work_bound')),
        factory(capability_id='capability.program_edit_compilation_d', implementation=measure_program_edit_compilation_d,
            input_model=ProgramEditCompilationInputD, output_model=ProgramEditCompilationMeasurementsD,
            source_file='program_edit_compilation_d.py', applicability=('source_ordered_explicit_assignment',),
            invariants=('preserved_fragment_occupants','injective_physical_inventory','no_act'),
            falsifiers=('wrong_actual_source','incompatible_target','preservation_change','operation_bound')),
        factory(capability_id='capability.program_validation_precondition_d', implementation=measure_program_validation_d,
            input_model=ProgramValidationInputD, output_model=ProgramValidationMeasurementsD,
            source_file='program_validation_d.py', applicability=('source_bound_current_validation_control',),
            invariants=('one_validation_input','internal_emissions_are_not_inputs','no_act'),
            falsifiers=('configuration_difference','missing_current_control','stale_model')),
    )
    return rows_return + (
        factory(capability_id='capability.frontier_composition_finish_d',implementation=finish_frontier_composition_d,
            input_model=FrontierCompositionFinishInputD,output_model=FrontierCompositionReturnD,source_file='frontier_composition_d.py',
            applicability=('source_requested_cross_family_return',),invariants=('same_parent_why','three_root_witnesses','no_act'),
            falsifiers=('wrong_collector_return','changed_parent','missing_evidence')),
        factory(capability_id='capability.support_solving_return_measure_d',implementation=measure_support_solving_return_d,
            input_model=SupportSolvingReturnMeasureInputD,output_model=SupportSolvingReturnFactsD,source_file='support_solving_return_d.py',
            applicability=('exact_current_support_answer',),invariants=('full_actor_footprint','explicit_support_layers','separate_controls','no_act'),
            falsifiers=('wrong_return','incomplete_domain','missing_native_state')),
        factory(capability_id='capability.support_solving_return_seal_d',implementation=seal_support_solving_return_d,
            input_model=SupportSolvingReturnSealInputD,output_model=SupportSolvingAnswerD,source_file='support_solving_return_d.py',
            applicability=('source_interpreted_support_return',),invariants=('same_parent_why','no_act'),
            falsifiers=('changed_parent','missing_evidence')),
        factory(capability_id='capability.support_solving_question_d',implementation=measure_support_solving_question_d,
            input_model=SupportSolvingInputD,output_model=SupportSolvingFactsD,source_file='support_solving_d.py',
            applicability=('source_declared_support_parent_question',),invariants=('full_parent_why','same_k22','no_act'),
            falsifiers=('missing_destination_binding','missing_dependency','wrong_family')),
        factory(capability_id='capability.support_solving_answer_d',implementation=finish_support_solving_answer_d,
            input_model=SupportSolvingAnswerInputD,output_model=SupportSolvingAnswerD,source_file='support_solving_d.py',
            applicability=('source_returned_support_question',),invariants=('exact_parent_return','no_act'),
            falsifiers=('changed_parent_question','missing_return')),
    )


def effect_frontier_signatures_c(type_spec,parameter_spec):
    def p(name,kind):return parameter_spec(name=name,type_spec=type_spec(kind))
    rows={'capability.effect_frontier_'+name+'_native_c':((p('measured','EffectFrontierFactsC'),),kind)
        for name,kind in (('support','SupportRequest'),('coupled','CoupledValueRequestC'),('articulated','ArtiRequest'),('shape','ShapeRequest'),('program','ProgramEffectRequestC'),
            ('actor_program','ProgramRequest'),('symbol_automata','SharedSymbolRequest'),('relation_network','FiniteRelationRequest'),('flow_network','FlowRequest'),
            ('push_logistics','PushRequest'),('mutable_kit','MutableKitRequest'),('hidden_reception','HiddenReceptionRequest'),('ballistic','BallisticRequest'),
            ('feedback_code','FeedbackCodeRequest'),('identity_contact','IdentityContactRequest'),
            ('ordered_transfer','OrderedRequest'),('route_intervention','RouteInterventionRequest'),
            ('inventory_navigation','InventoryNavigationRequest'),('visibility_capacity','CapacityRoomRequest'),
            ('charted_navigation','ChartedNavigationRequest'),('temporal_recall','RecallRequest'),
            ('adversarial_drop','AdversarialDropRequest'),('chromatic_pane','ChromaticWindowRequest'),
            ('endpoint_transport','EndpointTransportRequest'),('oriented_passage','OrientedPassageRequest'),
            ('recurring_quantity','QuantityRequest'),('oriented_handoff','HandoffRequest'),
            ('station_cargo','StationCargoRequest'),('rooted_piercing','PiercingRequest'),
            ('local_field','LocalRequest'),('directed_flow','DirectedRequest'),
            ('wrap_slide','WrapRequest'),('reference_restore','RestorationRequest'),('instruction_device','DeviceRequest'),('material_workbench','MaterialRequest'),
            ('cyclic_coverage','CyclicCoverageRequest'),('fixed_origin','FixedProgramRequest'),('temporal_fragment','TemporalFragmentRequest'),('visual_sequence','VisualSequenceRequest'),('topological_recolor','TopologicalRecolorRequest'),('reactive_capture','ReactiveCaptureRequest'),('neighborhood_pattern','NeighborhoodPatternRequest'),('layered_prefix','LayeredPrefixRequest'),('preview_packing','PreviewPackingRequest'),('station_profile','StationWorkbenchRequest'),('supported_construction','SupportedConstructionRequest'),('visible_voxel','VisibleVoxelRequest'),
            ('cadenced_rail','CadencedRailRequest'),('discrete_optics','DiscreteOpticsRequest'),('finite_alignment','FiniteAlignmentRequest'),
            ('reactive_graph','ReactiveGraphRequestC'),
            ('gravity_adhesion','CoupledMemberRequest'),
            ('metric_stack','MetricFrontierRequestD'))}
    rows['capability.effect_frontier_calculation_c']=((p('measured','EffectFrontierFactsC'),p('returned','Any')),'EffectFrontierReturnC')
    rows['capability.effect_frontier_d_identity']=((p('family','String'),p('native_request','Any'),p('expected_identity','MechanicalRequestIdentity')),'EffectFrontierDIdentityFactsD')
    rows['capability.effect_frontier_seal_c']=((p('calculated','EffectFrontierReturnC'),p('meaning','DeclaredMeaningInstantiation')),'EffectFrontierReturnC')
    rows['capability.effect_frontier_coupled_measurement_c']=((p('measured','EffectFrontierFactsC'),p('returned','Any')),'MechanicalFamilyResult')
    rows['capability.coupled_mechanical_response_c']=((p('request','CoupledValueRequestC'),p('measurement','MechanicalFamilyResult'),p('kernel_ref','String'),
        p('source_status','String'),p('missing_cause','String'),p('question_ref','String')),'MechanicalResponseInput')
    rows['capability.effect_frontier_publication_join_c']=((p('publication','EffectFrontierPublicationC'),p('published','Any')),'EffectFrontierReturnC')
    rows['capability.effect_frontier_agenda_input_c']=((p('returned','EffectFrontierReturnC'),),'EffectFrontierAgendaRequestC')
    rows['capability.effect_frontier_agenda_finish_c']=((p('returned','EffectFrontierReturnC'),p('published','Any')),'EffectFrontierReturnC')
    rows['capability.program_effect_result_facts_c']=((p('request','ProgramEffectRequestC'),p('measurement','Any')),'ProgramEffectResultFactsC')
    rows['capability.program_effect_response_c']=((p('request','ProgramEffectRequestC'),p('measurement','Any'),p('source_status','String'),p('missing_cause','String'),p('question_ref','String')),'MechanicalResponseInput')
    rows['capability.program_joint_fit_d']=((p('request','ProgramJointFitInputD'),),'ProgramJointFitMeasurementsD')
    rows['capability.program_edit_compilation_d']=((p('request','ProgramEditCompilationInputD'),),'ProgramEditCompilationMeasurementsD')
    rows['capability.program_validation_precondition_d']=((p('request','ProgramValidationInputD'),),'ProgramValidationMeasurementsD')
    rows['capability.support_solving_question_d']=((p('request','SupportSolvingInputD'),),'SupportSolvingFactsD')
    rows['capability.support_solving_answer_d']=((p('measured','SupportSolvingFactsD'),p('returned','Any')),'SupportSolvingAnswerD')
    rows['capability.support_solving_return_measure_d']=((p('answer','SupportSolvingAnswerD'),),'SupportSolvingReturnFactsD')
    rows['capability.support_solving_return_seal_d']=((p('measured','SupportSolvingReturnFactsD'),p('source_disposition_ref','String')),'SupportSolvingAnswerD')
    rows['capability.frontier_composition_finish_d']=((p('measured','FrontierCompositionFactsD'),p('joined','Any'),p('source_disposition_ref','String')),'FrontierCompositionReturnD')
    return rows
