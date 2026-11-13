"""Program and recipe questions preserve the world goal and exact interface binding."""
from .program_supposition_contracts_c import (TypedProgramSuppositionInputC, InstructionDeviceSuppositionInputC,
    RecipeOperatorSuppositionInputC, ProgramSuppositionFactsC, ProgramSuppositionDecisionInputC, ProgramSuppositionDecisionC)
from .program_supposition_c import (measure_typed_program_supposition, measure_instruction_device_supposition,
    measure_recipe_operator_supposition, assemble_program_supposition)

PROGRAM_SUPPOSITION_C_TYPES = ("TypedProgramSuppositionInputC", "InstructionDemonstrationC",
    "InstructionDeviceSuppositionInputC", "RecipeWorldEffectExampleC", "RecipeOperatorSuppositionInputC",
    "ProgramSuppositionFactsC", "ProgramSuppositionDecisionInputC", "ProgramSuppositionDecisionC")


def program_supposition_entries_c(entry_factory):
    rows = (("capability.typed_program_supposition_facts_c", measure_typed_program_supposition,
        TypedProgramSuppositionInputC, ProgramSuppositionFactsC),
        ("capability.instruction_device_supposition_facts_c", measure_instruction_device_supposition,
            InstructionDeviceSuppositionInputC, ProgramSuppositionFactsC),
        ("capability.recipe_operator_supposition_facts_c", measure_recipe_operator_supposition,
            RecipeOperatorSuppositionInputC, ProgramSuppositionFactsC),
        ("capability.program_supposition_assembly_c", assemble_program_supposition,
            ProgramSuppositionDecisionInputC, ProgramSuppositionDecisionC))
    return tuple(entry_factory(capability_id=ref, implementation=implementation, input_model=before,
        output_model=after, source_file="program_supposition_c.py", applicability=("current_consumer_and_supported_program_interface",),
        invariants=("existing_resource_assignment_and_recipe_measurements", "fragment_cap_not_exhaustive_compression",
            "execute_actuator_and_demonstration_distinct", "recipe_effect_bound_to_complete_pattern_and_interface",
            "interface_not_world_terminal_by_appearance", "no_act_or_canonical_law"),
        falsifiers=("foreign_or_stale_scope", "unsupported_reference_or_resource", "incomplete_recipe_transaction", "work_bound"))
        for ref, implementation, before, after in rows)


def program_supposition_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    result = {ref: ((parameter("request", name),), "ProgramSuppositionFactsC") for ref, name in (
        ("capability.typed_program_supposition_facts_c", "TypedProgramSuppositionInputC"),
        ("capability.instruction_device_supposition_facts_c", "InstructionDeviceSuppositionInputC"),
        ("capability.recipe_operator_supposition_facts_c", "RecipeOperatorSuppositionInputC"))}
    result["capability.program_supposition_assembly_c"] = ((parameter("request", "Any"),
        parameter("measured", "ProgramSuppositionFactsC"), parameter("source_disposition_ref", "Any"),
        parameter("source_policy_ref", "String")), "ProgramSuppositionDecisionC")
    return result
