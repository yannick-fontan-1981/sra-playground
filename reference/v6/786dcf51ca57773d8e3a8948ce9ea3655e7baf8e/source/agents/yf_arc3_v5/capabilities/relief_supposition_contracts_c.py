"""An occlusion order is a writing hypothesis, never an inferred physical depth."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .structural_supposition_contracts_c import StructuralScopeC
from .layered_relief import TruncatedReliefMeasurementInput, LayeredReliefMeasurement


class ReliefSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.relief_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    reference_region_ref: Ref
    mutable_surface_ref: Ref
    separated_reference_evidence_refs: tuple[Ref, ...]
    mutable_surface_evidence_refs: tuple[Ref, ...]
    homologous_surface_evidence_refs: tuple[Ref, ...]
    layer_completion_evidence_by_ref: FrozenMap
    measurement: TruncatedReliefMeasurementInput
    max_input_cells: int = Field(ge=0)


class ReliefSuppositionFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.relief_supposition_facts_c.v1"
    facts: FrozenMap
    measured: LayeredReliefMeasurement | None
    missing_refs: tuple[Ref, ...]
    actual_input_cell_visits: int = Field(ge=0)


class ReliefSuppositionDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.relief_supposition_decision_input_c.v1"
    request: ReliefSuppositionInputC
    measured: ReliefSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref


class ReliefSuppositionDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.relief_supposition_decision_c.v1"
    frozen_request: ReliefSuppositionInputC
    frozen_measurement: ReliefSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    physical_depth_or_action: None = None
