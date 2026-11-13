"""Source-declared target domains, process correspondences and utility links."""
from typing import Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref
from .effect_frontier_contracts_c import EffectFrontierInputC,EffectFrontierFactsC
from .mechanical_common_contracts_c import MechanicalPredicateC


class DesiredRelationD(FrozenModel):
    relation_ref: Ref
    domain_ref: Ref
    domain_kind: Literal['SELECTED_BODIES','TARGET_SUPPORT','MARKER_OCCURRENCES','EMITTED_POSITIONS','CONSERVED_QUANTITIES']
    quantified_refs: tuple[Ref,...] = Field(min_length=1,max_length=128)
    desired_relation: FrozenMap
    evidence_claim_ref: Ref
    current_predicate: MechanicalPredicateC


class ProcessResultCorrespondenceD(FrozenModel):
    correspondence_ref: Ref
    result_ref: Ref
    output_position_ref: Ref
    output_type_ref: Ref
    desired_output_value: object
    means_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    correspondence_claim_ref: Ref


class GoalUtilityLinkD(FrozenModel):
    link_ref: Ref
    intermediate_ref: Ref
    consumer_condition_ref: Ref
    basis_kind: Literal['OBSERVED_CORRESPONDENCE','SUPPORTED_CAUSAL_LAW']
    basis_claim_ref: Ref
    utility_claim_ref: Ref
    matters_claim_ref: Ref
    utility_epistemic_status: Literal['proposed','supported','established'] = 'proposed'
    matters_epistemic_status: Literal['proposed','supported','established'] = 'proposed'
    falsifier: MechanicalPredicateC


class MissingGoalRequirementD(FrozenModel):
    requirement_ref: Ref
    missing_kind: Literal['TYPE','LOCATION','CORRESPONDENCE','EVIDENCE']
    presence_predicate: MechanicalPredicateC
    question_ref: Ref
    question_kind: Literal['PRODUCTION','TRANSPORT','INTERPRETATION','DISCOVERY']
    question_payload: FrozenMap


class OpenGoalPreservationD(FrozenModel):
    requirement_ref: Ref
    consumer_ref: Ref
    preserved_predicate: MechanicalPredicateC


class GoalDerivationSpecD(FrozenModel):
    contract_ref: Ref
    final_condition_ref: Ref
    relations: tuple[DesiredRelationD,...] = Field(min_length=1,max_length=128)
    process_results: tuple[ProcessResultCorrespondenceD,...] = Field(default=(),max_length=128)
    # A prospective means question must be expressible before utility is proved.
    utility_links: tuple[GoalUtilityLinkD,...] = Field(default=(),max_length=128)
    requirements: tuple[MissingGoalRequirementD,...] = Field(default=(),max_length=128)
    open_preservations: tuple[OpenGoalPreservationD,...] = Field(default=(),max_length=128)
    projected_future_fields: FrozenMap = Field(default_factory=FrozenMap)


class GoalDerivationInputD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.goal_derivation_input_d.v1'
    frontier: EffectFrontierInputC
    contract: GoalDerivationSpecD
    goal_contract_attribute_path: tuple[str|int,...] = Field(min_length=1,max_length=16)
    goal_support_claim_ref: Ref
    maximum_evaluations: int = Field(ge=1,le=65536)


class GoalDerivationFactsD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.goal_derivation_facts_d.v1'
    request: GoalDerivationInputD
    acquired: EffectFrontierFactsC
    relation_rows: tuple[FrozenMap,...]
    process_rows: tuple[FrozenMap,...]
    explanation_rows: tuple[FrozenMap,...]
    question_rows: tuple[FrozenMap,...]
    preservation_rows: tuple[FrozenMap,...]
    facts: FrozenMap
    missing_refs: tuple[Ref,...]
    prospective_means_rows: tuple[FrozenMap,...] = Field(default=(),max_length=128)


class OperationalConsciousnessMeansEvaluation(FrozenModel):
    """A Source-selected disposition of a possible contribution, never a proved tool."""
    schema_version: Ref = 'operational_consciousness_means_evaluation.v1'
    question_ref: Ref
    principal_goal_ref: Ref
    means_refs: tuple[Ref, ...] = Field(min_length=1)
    intermediate_result_ref: Ref
    farther_condition_ref: Ref
    measured_input: FrozenMap
    source_disposition_ref: Ref
    requires_application_evidence: bool
    proposed_configuration_falsified: bool
    grants_action: Literal[False] = False
    utility_established: Literal[False] = False
    evaluation_record_ref: Ref | None = None

    @model_validator(mode='after')
    def preserve_question(self):
        for field in ('question_ref','principal_goal_ref','means_refs',
                      'intermediate_result_ref','farther_condition_ref'):
            if self.measured_input.get(field) != getattr(self,field):
                raise ValueError('conscious means evaluation changed its measured question')
        return self


class GoalDerivationReturnD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.goal_derivation_return_d.v1'
    measured: GoalDerivationFactsD
    source_disposition_ref: Ref
    prospective_means_evaluations: tuple[OperationalConsciousnessMeansEvaluation,...] = ()
    action_authority: None = None
