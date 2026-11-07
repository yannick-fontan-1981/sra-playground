"""Autonomous K03/K09 declarations for one coordinator-owned registration."""
from .mechanical_common_contracts_c import (
    EventCompositionInputC, EventCompositionResultC, SimulationPathInputC,
    CounterfactualPathInputC, CounterfactualPathResultC, SearchDomainInputC,
    SearchResultC, CommonSignatureFactsC, CommonNativeResponseInputC,
)
from .mechanical_event_composition_c import compose_mechanical_events
from .mechanical_simulation_c import fold_mechanical_path, compare_counterfactual_paths
from .mechanical_search_c import search_complete_step_domain
from .mechanical_common_projection_c import (project_common_signature, assemble_common_native_response,
    empty_composition_result, empty_search_result)
from .mechanical_request_contracts import MechanicalResponseInput
from .search_objective_contracts_d import SearchObjectiveFactsD
from .search_objective_d import measure_search_objective_d,retain_search_objective_need_d
from .resource_interval_contracts_d import ResourceIntervalInputD,ResourceIntervalResultD
from .resource_integer_intervals_d import measure_resource_integer_intervals_d
from .resource_transaction_contracts_d import ResourceTransactionInputD,ResourceTransactionResultD
from .resource_transactions_d import measure_resource_transaction_d
from .answer_equivalence_contracts_d import AnswerEquivalenceInputD,AnswerEquivalenceResultD
from .answer_equivalence_d import measure_answer_equivalence_d
from .feedback_trial_contracts_d import (FeedbackTrialChoiceInputD,FeedbackTrialBindInputD,
    FeedbackTrialFactsD,FeedbackTrialFinishInputD,FeedbackTrialChoiceReturnD)
from .feedback_trial_choice_d import bind_feedback_trial_measure_d,measure_feedback_trial_choices_d,finish_feedback_trial_choice_d
from .kit_survival_choice_contracts_d import (KitSurvivalChoiceInputD,KitSurvivalBindInputD,
    KitSurvivalFactsD,KitSurvivalFinishInputD,KitSurvivalChoiceReturnD)
from .kit_survival_choice_d import bind_kit_survival_choice_d,measure_kit_survival_choices_d,finish_kit_survival_choice_d

COMMON_C_ENTRIES = (
    ('capability.bind_kit_survival_choice_d',bind_kit_survival_choice_d,
        KitSurvivalBindInputD,KitSurvivalBindInputD,'kit_survival_choice_d.py'),
    ('capability.measure_kit_survival_choices_d',measure_kit_survival_choices_d,
        KitSurvivalBindInputD,KitSurvivalFactsD,'kit_survival_choice_d.py'),
    ('capability.finish_kit_survival_choice_d',finish_kit_survival_choice_d,
        KitSurvivalFinishInputD,KitSurvivalChoiceReturnD,'kit_survival_choice_d.py'),
    ('capability.bind_feedback_trial_measure_d',bind_feedback_trial_measure_d,
        FeedbackTrialBindInputD,FeedbackTrialBindInputD,'feedback_trial_choice_d.py'),
    ('capability.measure_feedback_trial_choices_d',measure_feedback_trial_choices_d,
        FeedbackTrialBindInputD,FeedbackTrialFactsD,'feedback_trial_choice_d.py'),
    ('capability.finish_feedback_trial_choice_d',finish_feedback_trial_choice_d,
        FeedbackTrialFinishInputD,FeedbackTrialChoiceReturnD,'feedback_trial_choice_d.py'),
    ("capability.measure_answer_equivalence_d",measure_answer_equivalence_d,
        AnswerEquivalenceInputD,AnswerEquivalenceResultD,"answer_equivalence_d.py"),
    ("capability.measure_resource_transaction_d",measure_resource_transaction_d,
        ResourceTransactionInputD,ResourceTransactionResultD,"resource_transactions_d.py"),
    ("capability.measure_resource_integer_intervals_d",measure_resource_integer_intervals_d,
        ResourceIntervalInputD,ResourceIntervalResultD,"resource_integer_intervals_d.py"),
    ("capability.measure_search_objective_d", measure_search_objective_d,
        SearchDomainInputC, SearchObjectiveFactsD, "search_objective_d.py"),
    ("capability.retain_search_objective_need_d", retain_search_objective_need_d,
        SearchDomainInputC, SearchResultC, "search_objective_d.py"),
    ("capability.common_event_composition", compose_mechanical_events,
        EventCompositionInputC, EventCompositionResultC, "mechanical_event_composition_c.py"),
    ("capability.common_path_fold", fold_mechanical_path,
        SimulationPathInputC, EventCompositionResultC, "mechanical_simulation_c.py"),
    ("capability.common_counterfactual_paths", compare_counterfactual_paths,
        CounterfactualPathInputC, CounterfactualPathResultC, "mechanical_simulation_c.py"),
    ("capability.common_step_domain_search", search_complete_step_domain,
        SearchDomainInputC, SearchResultC, "mechanical_search_c.py"),
    ("capability.common_event_signature", project_common_signature,
        EventCompositionInputC, CommonSignatureFactsC, "mechanical_common_projection_c.py"),
    ("capability.common_path_signature", project_common_signature,
        SimulationPathInputC, CommonSignatureFactsC, "mechanical_common_projection_c.py"),
    ("capability.common_search_signature", project_common_signature,
        SearchDomainInputC, CommonSignatureFactsC, "mechanical_common_projection_c.py"),
    ("capability.common_native_response", assemble_common_native_response,
        CommonNativeResponseInputC, MechanicalResponseInput, "mechanical_common_projection_c.py"),
    ("capability.common_event_unsupported", empty_composition_result,
        EventCompositionInputC, EventCompositionResultC, "mechanical_common_projection_c.py"),
    ("capability.common_path_unsupported", empty_composition_result,
        SimulationPathInputC, EventCompositionResultC, "mechanical_common_projection_c.py"),
    ("capability.common_search_unsupported", empty_search_result,
        SearchDomainInputC, SearchResultC, "mechanical_common_projection_c.py"),
)
COMMON_C_TYPES = tuple(sorted({model.__name__ for _, _, input_model, output_model, _ in COMMON_C_ENTRIES
    for model in (input_model, output_model)})) + ("MechanicalNormalizedReturn","FeedbackTrialChoiceInputD","KitSurvivalChoiceInputD")


def mechanical_common_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=implementation,
        input_model=input_model, output_model=output_model, source_file=source,
        applicability=("exact_caller_bound_request", "finite_complete_step_packets"),
        invariants=("no_act", "no_role_or_goal_assignment", "immutable_full_state",
            "declared_bounds_and_unknown_boundaries", "external_primitive_counted_once"),
        falsifiers=("input_identity_mismatch", "event_owner_conflict", "incomplete_domain"))
        for ref, implementation, input_model, output_model, source in COMMON_C_ENTRIES)


def mechanical_common_signatures_c(type_spec, parameter_spec):
    signatures = {ref: ((parameter_spec(name="request", type_spec=type_spec(input_model.__name__)),),
        output_model.__name__) for ref, _, input_model, output_model, _ in COMMON_C_ENTRIES}
    signatures['capability.bind_kit_survival_choice_d']=((
        parameter_spec(name='choice',type_spec=type_spec('KitSurvivalChoiceInputD')),
        parameter_spec(name='reply',type_spec=type_spec('MechanicalNormalizedReturn'))),'KitSurvivalBindInputD')
    signatures['capability.finish_kit_survival_choice_d']=((
        parameter_spec(name='measured',type_spec=type_spec('KitSurvivalFactsD')),
        parameter_spec(name='source_alternative_ref',type_spec=type_spec('String'))),'KitSurvivalChoiceReturnD')
    signatures['capability.bind_feedback_trial_measure_d']=((
        parameter_spec(name='choice',type_spec=type_spec('FeedbackTrialChoiceInputD')),
        parameter_spec(name='reply',type_spec=type_spec('MechanicalNormalizedReturn'))),'FeedbackTrialBindInputD')
    signatures['capability.finish_feedback_trial_choice_d']=((
        parameter_spec(name='measured',type_spec=type_spec('FeedbackTrialFactsD')),
        parameter_spec(name='source_alternative_ref',type_spec=type_spec('String'))),'FeedbackTrialChoiceReturnD')
    signatures["capability.common_native_response"] = ((
        parameter_spec(name="result", type_spec=type_spec("Any")),
        parameter_spec(name="source_status", type_spec=type_spec("String")),
        parameter_spec(name="returned_type", type_spec=type_spec("String")),
        parameter_spec(name="missing_cause", type_spec=type_spec("String", optional=True)),
    ), "MechanicalResponseInput")
    return signatures
