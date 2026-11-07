"""Bounded state/operator question construction; K24 remains the only successor engine."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref,stable_digest
from .articulated_channel_kinematics import ArtiRequest,ArtiState,ArtiStep
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .contracts import ArticulatedLocalOperation
from .articulated_channel_kinematics import ArtiMask
from .mechanical_common_contracts_c import MechanicalPredicateC


class ArticulatedMaskExtentCaseC(FrozenModel):
    body_ref: Ref
    resulting_extent: tuple[int,int]
    mask: ArtiMask


class ArticulatedControlLawC(FrozenModel):
    primitive_ref: Ref
    input_ref: Ref
    channel_ref: Ref
    operations: tuple[ArticulatedLocalOperation,...] = Field(min_length=1,max_length=64)
    application_predicates: tuple[MechanicalPredicateC,...] = Field(default=(),max_length=32)
    mask_extent_cases: tuple[ArticulatedMaskExtentCaseC,...] = Field(default=(),max_length=4096)
    same_snapshot_simultaneous: bool
    support_claim_ref: Ref
    support_predicate_ref: Ref
    observation_record_ref: Ref
    cost: int = Field(ge=0)
    closure_domain_ref: Ref
    response_ref: Ref
    clock_ref: Ref
    temporal_scope_ref: Ref
    tick: int = Field(ge=0)


class ArticulatedOperatorTemplateC(FrozenModel):
    primitive_ref: Ref
    step: ArtiStep
    source_state: ArtiState
    complete_domain_support_claim_ref: Ref
    support_predicate_ref: Ref
    observation_record_ref: Ref
    cost: int = Field(ge=0)
    closure_domain_ref: Ref
    response_ref: Ref
    clock_ref: Ref
    temporal_scope_ref: Ref
    tick: int = Field(ge=0)


class ArticulatedTransitionDomainInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_transition_domain_input_c.v1"
    base_request: ArtiRequest
    states: tuple[ArtiState,...] = Field(min_length=1,max_length=4096)
    templates: tuple[ArticulatedOperatorTemplateC,...] = Field(max_length=4096)
    maximum_questions: int = Field(ge=0,le=4096)
    episode_ref: Ref
    level_scope_ref: Ref
    maximum_total_evaluations: int = Field(ge=1,le=65536)
    control_laws: tuple[ArticulatedControlLawC,...] = Field(default=(),max_length=256)


class ArticulatedTransitionQuestionC(FrozenModel):
    primitive_ref: Ref
    state_digest: Ref
    native_request: ArtiRequest


class ArticulatedTransitionDomainFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_transition_domain_facts_c.v1"
    questions: tuple[ArticulatedTransitionQuestionC,...] = Field(max_length=4096)
    missing_refs: tuple[Ref,...]
    calculation_bound: bool
    domain_complete: bool
    frontier: FrozenMap
    templates: tuple[ArticulatedOperatorTemplateC,...] = Field(default=(),max_length=4096)
    accounted_evaluations: int = Field(default=0,ge=0)


class ArticulatedTransitionSessionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_transition_session_c.v1"
    requested: ArticulatedTransitionDomainFactsC
    returns: tuple[FrozenMap,...] = Field(max_length=4096)
    accounted_evaluations: int = Field(ge=0)
    missing_refs: tuple[Ref,...]
    calculation_bound: bool
    source_request: ArticulatedTransitionDomainInputC


class ArticulatedTransitionStartInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_transition_start_input_c.v1"
    request: ArticulatedTransitionDomainInputC
    measured: ArticulatedTransitionDomainFactsC


class ArticulatedTransitionAppendInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_transition_append_input_c.v1"
    session: ArticulatedTransitionSessionC
    question: ArticulatedTransitionQuestionC
    returned: MechanicalNormalizedReturn


def construct_articulated_transition_questions(value):
    base=value.base_request
    missing,questions=[],[]
    states={stable_digest(state):state for state in value.states}
    if len(states)!=len(value.states):missing.append("articulated.transition_unique_full_state_domain")
    for index,template in enumerate(value.templates):
        if len(questions)>=value.maximum_questions:
            return ArticulatedTransitionDomainFactsC(questions=tuple(questions),missing_refs=tuple(sorted(set(missing))),calculation_bound=False,
                domain_complete=False,frontier=FrozenMap({"template_index":index,"remaining_count":len(value.templates)-index}))
        state_digest=stable_digest(template.source_state)
        state=states.get(state_digest)
        if (state is None or template.step.before_bodies!=state.bodies
                or not template.complete_domain_support_claim_ref):
            missing.append("articulated.transition_current_state_bound_operator_template");continue
        if base.model is None:
            missing.append("articulated.transition_current_model");continue
        # Preserve supplied masks, sweep and transaction premises. Copying the
        # same local mask into a changed extent is not a generated geometry law.
        request_ref="request.articulated.successor."+stable_digest((base.scope,state,template))
        scope=base.scope.model_copy(update={"request_ref":request_ref})
        request=base.model_copy(update={"scope":scope,"operation_ref":"mechanics.articulated_channel_kinematics.successor",
            "mode":"STEP","state":state,"step":template.step,"candidates":(),"resume":None})
        questions.append(ArticulatedTransitionQuestionC(primitive_ref=template.primitive_ref,
            state_digest=state_digest,native_request=request))
    pairs=tuple((q.state_digest,q.primitive_ref) for q in questions)
    if len(set(pairs))!=len(pairs):missing.append("articulated.transition_unique_state_primitive_questions")
    return ArticulatedTransitionDomainFactsC(questions=tuple(questions),templates=value.templates,missing_refs=tuple(sorted(set(missing))),calculation_bound=not bool(missing),
        domain_complete=False,frontier=FrozenMap({"required":"current_complete_state_operator_domain_support",
            "question_construction_complete":not bool(missing)}))
