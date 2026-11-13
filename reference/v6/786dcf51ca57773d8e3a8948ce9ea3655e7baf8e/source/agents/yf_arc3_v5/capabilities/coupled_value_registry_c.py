"""K23 exact pure calculation ports; SRC/DRM owns operation selection."""
from .coupled_value_contracts_c import CoupledValueRequestC, CoupledValueResultC, CoupledValueSourceReturnInputC, CoupledValueSourceReturnC
from .coupled_value_c import (calculate_coupled_projection, calculate_coupled_intersection, calculate_coupled_effect_columns, calculate_coupled_successor, calculate_coupled_affine_certificate, calculate_coupled_binary_solver, calculate_coupled_directional_solver, calculate_coupled_nonbinary_dp, calculate_coupled_nonbinary_csp, calculate_coupled_word_certificate, calculate_coupled_measure, calculate_coupled_precondition, calculate_coupled_fit, calculate_coupled_inverse, unsupported_coupled_operation, finish_coupled_source_return)
from .mechanical_family_contracts_a import MechanicalSignatureFacts, project_requested_signature

COUPLED_VALUE_C_TYPES = ["CoupledCarrierC","CoupledCorrespondenceC","CoupledDemandC","CoupledCorrelationC","CoupledActionC","CoupledAffineCertificateC","CoupledValueCheckpointC","CoupledValueObservationC","CoupledValueRequestC","CoupledValueResultC","CoupledValueSourceReturnInputC","CoupledValueSourceReturnC","MechanicalSignatureFacts"]
COUPLED_VALUE_C_ENTRIES = (
    ("capability.coupled_value_signature_c", project_requested_signature, CoupledValueRequestC, MechanicalSignatureFacts),
    ("capability.coupled_value_projection_c", calculate_coupled_projection, CoupledValueRequestC, CoupledValueResultC),
    ("capability.coupled_value_intersection_c", calculate_coupled_intersection, CoupledValueRequestC, CoupledValueResultC),
    ("capability.coupled_value_effect_columns_c", calculate_coupled_effect_columns, CoupledValueRequestC, CoupledValueResultC),
    ("capability.coupled_value_successor_c", calculate_coupled_successor, CoupledValueRequestC, CoupledValueResultC),
    ("capability.coupled_value_affine_certificate_c", calculate_coupled_affine_certificate, CoupledValueRequestC, CoupledValueResultC),
    ("capability.coupled_value_binary_solver_c", calculate_coupled_binary_solver, CoupledValueRequestC, CoupledValueResultC),
    ("capability.coupled_value_directional_solver_c", calculate_coupled_directional_solver, CoupledValueRequestC, CoupledValueResultC),
    ("capability.coupled_value_nonbinary_dp_c", calculate_coupled_nonbinary_dp, CoupledValueRequestC, CoupledValueResultC),
    ("capability.coupled_value_nonbinary_csp_c", calculate_coupled_nonbinary_csp, CoupledValueRequestC, CoupledValueResultC),
    ("capability.coupled_value_certificate_c", calculate_coupled_word_certificate, CoupledValueRequestC, CoupledValueResultC),
    ("capability.coupled_value_measure_c", calculate_coupled_measure, CoupledValueRequestC, CoupledValueResultC),
    ("capability.coupled_value_precondition_c", calculate_coupled_precondition, CoupledValueRequestC, CoupledValueResultC),
    ("capability.coupled_value_fit_c", calculate_coupled_fit, CoupledValueRequestC, CoupledValueResultC),
    ("capability.coupled_value_inverse_domain_c", calculate_coupled_inverse, CoupledValueRequestC, CoupledValueResultC),
    ("capability.coupled_value_unsupported_c", unsupported_coupled_operation, CoupledValueRequestC, CoupledValueResultC),
    ("capability.coupled_value_source_return_c", finish_coupled_source_return, CoupledValueSourceReturnInputC, CoupledValueSourceReturnC))


def coupled_value_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file=method.__module__.rsplit(".", 1)[-1] + ".py",
        applicability=("current_coupled_carrier_value_domain",),
        invariants=("all_constraint_supports_and_correlations", "one_pre_state_successor", "scoped_affine_certificate",
            "operational_resume", "source_purpose_and_no_act"),
        falsifiers=("conflicting_demand", "stale_certificate_or_checkpoint", "derived_output_nonaffine", "protected_value_changed"))
        for ref, method, inputs, outputs in COUPLED_VALUE_C_ENTRIES)


def coupled_value_signatures_c(type_spec, parameter_spec):
    def parameter(name, model):
        return parameter_spec(name=name, type_spec=type_spec(model))
    signatures = {ref: ((parameter("request", inputs.__name__),), outputs.__name__)
        for ref, _, inputs, outputs in COUPLED_VALUE_C_ENTRIES}
    signatures["capability.coupled_value_source_return_c"] = ((parameter("request", "CoupledValueRequestC"),
        parameter("calculation", "CoupledValueResultC"), parameter("source_policy_ref", "String"),
        parameter("source_disposition_ref", "String"), parameter("source_reason_ref", "String")), "CoupledValueSourceReturnC")
    return signatures
