"""Exact family aliases and neutral STEP bridge declarations, owned by SRC."""
from .mechanical_step_contracts_c import (
    ExternalStepInputC, ExternalStepFactsC, ExternalStepMeasurementC, ExternalStepDecodeInputC,
    ExternalStepNativeInputC, ExternalStepFinishInputC, ExternalStepDispatchResultC,
    RigidEditStepDecodeInputC,
)
from .mechanical_contracts_b import MechanicalRequestB, MechanicalResultB
from .mechanical_request_contracts import MechanicalResponseInput
from .mechanical_step_c import (measure_external_step_signature, get_bound_external_step_request,
    empty_external_step, decode_external_step, assemble_external_step_native, finish_external_step)
from .guarded_transport import external_primitive as guarded_transport_external_primitive
from .queued_alignment_cascade import external_primitive as queued_alignment_cascade_external_primitive
from .mechanical_profile_d import DNativeProfileRequest
from .rigid_edit_search_transport_c import bound_rigid_profile, decode_rigid_search_step

STEP_C_ENTRIES = (
    ("capability.common_step_bound_d_profile_c", bound_rigid_profile, ExternalStepInputC,
        DNativeProfileRequest, "rigid_edit_search_transport_c.py"),
    ("capability.common_step_decode_d_rigid_c", decode_rigid_search_step, RigidEditStepDecodeInputC,
        ExternalStepMeasurementC, "rigid_edit_search_transport_c.py"),
    ("capability.common_step_signature_c", measure_external_step_signature, ExternalStepInputC,
        ExternalStepFactsC, "mechanical_step_c.py"),
    ("capability.common_step_bound_provider_c", get_bound_external_step_request, ExternalStepInputC,
        MechanicalRequestB, "mechanical_step_c.py"),
    ("capability.common_step_unsupported_c", empty_external_step, ExternalStepInputC,
        ExternalStepMeasurementC, "mechanical_step_c.py"),
    ("capability.common_step_decode_c", decode_external_step, ExternalStepDecodeInputC,
        ExternalStepMeasurementC, "mechanical_step_c.py"),
    ("capability.common_step_native_c", assemble_external_step_native, ExternalStepNativeInputC,
        MechanicalResponseInput, "mechanical_step_c.py"),
    ("capability.common_step_finish_c", finish_external_step, ExternalStepFinishInputC,
        ExternalStepDispatchResultC, "mechanical_step_c.py"),
    ("capability.guarded_transport_external_primitive", guarded_transport_external_primitive,
        MechanicalRequestB, MechanicalResultB, "guarded_transport.py"),
    ("capability.queued_alignment_cascade_external_primitive", queued_alignment_cascade_external_primitive,
        MechanicalRequestB, MechanicalResultB, "queued_alignment_cascade.py"),
)
STEP_C_TYPES = tuple(sorted({model.__name__ for _, _, before, after, _ in STEP_C_ENTRIES
    for model in (before, after)}))


def mechanical_step_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=implementation,
        input_model=before, output_model=after, source_file=source,
        applicability=("src_selected_exact_step_signature", "bound_current_model_identity"),
        invariants=("one_external_primitive", "no_action_release", "forward_event_ledger_only",
            "no_endpoint_reconstruction", "no_path_search_recursion"),
        falsifiers=("identity_mismatch", "incomplete_closure", "unsupported_signature"))
        for ref, implementation, before, after, source in STEP_C_ENTRIES)


def mechanical_step_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(kind, optional=optional))
    signatures = {ref: ((parameter("request", before.__name__),), after.__name__)
        for ref, _, before, after, _ in STEP_C_ENTRIES}
    signatures["capability.common_step_decode_c"] = ((parameter("request", "ExternalStepInputC"),
        parameter("native", "MechanicalResultB")), "ExternalStepMeasurementC")
    signatures["capability.common_step_decode_d_rigid_c"] = ((parameter("request", "ExternalStepInputC"),
        parameter("contribution", "DNativeProfileContribution")), "ExternalStepMeasurementC")
    signatures["capability.common_step_native_c"] = ((parameter("measured", "ExternalStepMeasurementC"),
        parameter("source_status", "String"), parameter("missing_cause", "String", True)), "MechanicalResponseInput")
    signatures["capability.common_step_finish_c"] = ((parameter("measured", "ExternalStepMeasurementC"),
        parameter("normalized", "MechanicalNormalizedReturn")), "ExternalStepDispatchResultC")
    return signatures
