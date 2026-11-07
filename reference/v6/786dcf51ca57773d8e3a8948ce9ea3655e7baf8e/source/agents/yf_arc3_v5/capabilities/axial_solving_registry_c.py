"""Source strategy ports; Root retains its existing K71/K03/K09 registry."""
from .axial_solving_contracts_c import AxialSolvingBindInputC, AxialSolvingFinishInputC, AxialSolvingReturnC
from .mechanical_profile_d import DNativeProfileRequest
from .axial_solving_c import bind_axial_solving, finish_axial_solving

AXIAL_SOLVING_C_TYPES = ("AxialArrivalContractC", "AxialServiceSupportC", "AxialSolvingInputC",
    "AxialSolvingFactsC", "AxialSolvingBindInputC", "AxialSolvingFinishInputC", "AxialSolvingReturnC")
AXIAL_SOLVING_C_ENTRIES = (
    ("capability.axial_solving_profile_c", bind_axial_solving, AxialSolvingBindInputC, DNativeProfileRequest),
    ("capability.axial_solving_return_c", finish_axial_solving, AxialSolvingFinishInputC, AxialSolvingReturnC))

def axial_solving_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="axial_solving_c.py", applicability=("goal_owned_stable_axial_arrival",),
        invariants=("current_parent", "normal_global_closure", "grounded_provider", "same_K71_K03_K09", "all_models", "no_act"),
        falsifiers=("stale_agenda", "transient_arrival", "selected_body_as_winner", "guard_cap_arrival"))
        for ref, method, inputs, outputs in AXIAL_SOLVING_C_ENTRIES)

def axial_solving_signatures_c(type_spec, parameter_spec):
    def p(name, model):
        return parameter_spec(name=name, type_spec=type_spec(model))
    return {"capability.axial_solving_profile_c": ((p("measured", "AxialSolvingFactsC"),), "DNativeProfileRequest"),
        "capability.axial_solving_return_c": ((p("measured", "AxialSolvingFactsC"),
            p("profile_return", "Any")), "AxialSolvingReturnC")}
