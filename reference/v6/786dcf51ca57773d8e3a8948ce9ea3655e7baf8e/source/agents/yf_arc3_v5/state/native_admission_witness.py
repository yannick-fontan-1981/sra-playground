"""Canonical envelope shared by native request production and all evidence readers."""
from agents.yf_arc3_v5.logos.operational_experiment_admission import OperationalConsciousnessNativeAdmissionWitness
from agents.yf_arc3_v5.logos.types import immutable_json_data


def native_admission_witness(request):
    extra = {'recovery': request.native_recovery_evidence} if 'native_recovery_evidence' in request.model_fields_set else {}
    if 'native_goal_contribution_evidence' in request.model_fields_set:
        extra['goal_contribution'] = request.native_goal_contribution_evidence
    return immutable_json_data(OperationalConsciousnessNativeAdmissionWitness(
        preparation=request.native_preparation_evidence, command_budget=request.command_budget_interval,
        response_question=request.native_question_evidence, **extra))


def retained_witness_matches(record, request):
    if 'native_admission_witnesses' in record.model_fields_set:
        return record.native_admission_witnesses.get(request.experiment_ref) == native_admission_witness(request)
    return (request.native_question_evidence is None and request.native_recovery_evidence is None
        and request.native_goal_contribution_evidence is None
        and record.native_preparation_evidence_by_request.get(request.experiment_ref) == immutable_json_data(request.native_preparation_evidence)
        and record.native_command_budget_by_request.get(request.experiment_ref) == immutable_json_data(request.command_budget_interval))
