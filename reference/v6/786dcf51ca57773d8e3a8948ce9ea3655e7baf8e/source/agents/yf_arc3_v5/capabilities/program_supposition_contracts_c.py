"""A visible program/recipe is an interface hypothesis, not the world's terminal goal."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .structural_supposition_contracts_c import StructuralScopeC
from .contracts import TypedAssignmentDomainsInput, TypedAssignmentDomainsMeasurements, RecipePatternDifferenceInput, RecipePatternDifferenceMeasurements


class TypedProgramSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.typed_program_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    reference_word: tuple[Ref, ...] = Field(max_length=1024)
    reference_word_complete: bool
    reference_sequence_evidence_refs: tuple[Ref, ...]
    empty_socket_evidence_refs: tuple[Ref, ...]
    solid_hollow_token_evidence_refs: tuple[Ref, ...]
    resources: TypedAssignmentDomainsInput
    resource_scope_evidence_refs: tuple[Ref, ...]
    max_fragment_checks: int = Field(ge=0)


class InstructionDemonstrationC(FrozenModel):
    example_ref: Ref
    epoch: int = Field(ge=0)
    revision_ref: Ref
    scope_ref: Ref
    module_ref: Ref
    observed_code_ref: Ref | None
    demonstration_before: FrozenMap
    demonstration_after: FrozenMap
    world_before: FrozenMap
    world_after: FrozenMap
    world_observation_complete: bool
    sealed_observation: bool
    evidence_refs: tuple[Ref, ...]


class InstructionDeviceSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.instruction_device_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    ordered_module_refs: tuple[Ref, ...] = Field(max_length=256)
    editable_module_evidence_refs: tuple[Ref, ...]
    execute_actuator_ref: Ref
    execute_actuator_evidence_refs: tuple[Ref, ...]
    separate_demonstration_evidence_refs: tuple[Ref, ...]
    demonstrations: tuple[InstructionDemonstrationC, ...] = Field(max_length=256)


class RecipeWorldEffectExampleC(FrozenModel):
    example_ref: Ref
    epoch: int = Field(ge=0)
    revision_ref: Ref
    scope_ref: Ref
    interface_ref: Ref
    recipe_ref: Ref
    complete_recipe_active_refs: tuple[Ref, ...] = Field(max_length=256)
    submitted_active_refs: tuple[Ref, ...] = Field(max_length=256)
    recipe_transaction_sealed: bool
    world_before: FrozenMap
    world_after: FrozenMap
    effect_descriptor: FrozenMap
    evidence_refs: tuple[Ref, ...]


class RecipeOperatorSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.recipe_operator_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    interface_ref: Ref
    recipe_ref: Ref
    small_pattern_example_evidence_refs: tuple[Ref, ...]
    editable_lattice_evidence_refs: tuple[Ref, ...]
    pattern_difference: RecipePatternDifferenceInput
    effect_examples: tuple[RecipeWorldEffectExampleC, ...] = Field(max_length=256)
    independent_interface_terminal_evidence_refs: tuple[Ref, ...]
    independent_interface_terminal_relation: bool | None = None


class ProgramSuppositionFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.program_supposition_facts_c.v1"
    facts: FrozenMap
    measurements: tuple[FrozenMap, ...]
    assignment_domains: TypedAssignmentDomainsMeasurements | None = None
    recipe_difference: RecipePatternDifferenceMeasurements | None = None
    actual_fragment_checks: int = Field(default=0, ge=0)


class ProgramSuppositionDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.program_supposition_decision_input_c.v1"
    request: TypedProgramSuppositionInputC | InstructionDeviceSuppositionInputC | RecipeOperatorSuppositionInputC
    measured: ProgramSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref


class ProgramSuppositionDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.program_supposition_decision_c.v1"
    frozen_request: TypedProgramSuppositionInputC | InstructionDeviceSuppositionInputC | RecipeOperatorSuppositionInputC
    frozen_measurement: ProgramSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    confirmed_program_law_terminal_or_action: None = None
