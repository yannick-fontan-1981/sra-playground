"""Bounded predicate measurements and transport of DRM conditional receipts."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from .mechanical_common_contracts_c import MechanicalPredicateC
from .mechanical_event_composition_c import predicate_value
from .mechanical_family_contracts_a import MechanicalFamilyResult
from .articulated_channel_kinematics import ArtiRequest
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .mechanical_return_a import mechanical_request_identity_a
from .articulated_solving_contracts_c import ArticulatedDependencyInputC,ArticulatedDependencyRowsC


def bind_articulated_dependency_input(value):
    return ArticulatedDependencyInputC(returned=value.returned)


def _ordered_values(mapping):
    for key in sorted(mapping):yield mapping[key]


def _nodes(value,limit):
    pending=[iter((value,))]
    count=0
    while pending:
        item=next(pending[-1],pending)
        if item is pending:
            pending.pop();continue
        count+=1
        if count>limit:return None
        if isinstance(item,FrozenMap):
            if len(item)>limit-count:return None
            pending.append(iter(_ordered_values(item)))
        elif isinstance(item,(tuple,list)):
            pending.append(iter(item))
    return count


def _comparison_bound(predicate,state,remaining):
    if len(predicate.field_path)>remaining:return None
    actual=state.get(predicate.field_ref)
    for part in predicate.field_path:
        if isinstance(actual,FrozenMap) and isinstance(part,str):actual=actual.get(part)
        elif isinstance(actual,tuple) and type(part) is int and 0<=part<len(actual):actual=actual[part]
        else:actual=None;break
    a,b=_nodes(actual,remaining),_nodes(predicate.expected,remaining)
    if a is None or b is None:return None
    # Includes nested equality and SET_EQ pair comparisons, not just the call.
    bound=2*len(predicate.field_path)+a+b+(a+b)**2
    return bound if bound<=remaining else None


def measure_articulated_dependency_effects(value):
    returned=value.returned
    request=returned.frozen_measurement.frozen_input
    session=returned.transition_session
    if not request.dependency_questions:return ArticulatedDependencyRowsC()
    if session is None or session.missing_refs or not session.calculation_bound:
        return ArticulatedDependencyRowsC(missing_refs=("articulated.dependency_current_qualified_transition_session",))
    if (session.source_request!=request.transition_domain
            or session.source_request.base_request!=request.native_request):
        return ArticulatedDependencyRowsC(missing_refs=("articulated.dependency_exact_parent_transition_domain",))
    rows,missing=[],[]
    work=0
    remaining=request.parent_maximum_evaluations-returned.accounted_evaluations
    if len(session.requested.questions)>remaining:
        return ArticulatedDependencyRowsC(missing_refs=("articulated.dependency_measurement_parent_work_bound",))
    questions={question.native_request.scope.request_ref:question.native_request for question in session.requested.questions}
    work+=len(session.requested.questions)
    for receipt in session.returns:
        if work+1>remaining:
            missing.append("articulated.dependency_measurement_parent_work_bound");break
        work+=1
        try:
            native=ArtiRequest.model_validate(receipt["native_request"])
            response=MechanicalNormalizedReturn.model_validate(receipt["native_return"])
            result=MechanicalFamilyResult.model_validate(response.descriptive_values["calculation"])
        except (ValidationError,TypeError,ValueError,KeyError):
            missing.append("articulated.dependency_actual_session_transition");continue
        identity=mechanical_request_identity_a(native,"mechanics.articulated_channel_kinematics",
            native.scope,native.operation_ref,native.mode)
        if (response.request!=identity or receipt.get("request_ref")!=identity.request_ref
                or result.operation_ref!=native.operation_ref or result.mode!=native.mode
                or native.operation_ref!="mechanics.articulated_channel_kinematics.successor" or native.mode!="STEP"
                or result.scope!=native.scope or questions.get(native.scope.request_ref)!=native):
            missing.append("articulated.dependency_exact_successor_receipt");continue
        if native.step is None or native.state is None:continue
        before=immutable_json_data(native.state)
        after=result.values.get("after_state")
        events=result.values.get("joint_events",())
        if work+len(events)>remaining:
            missing.append("articulated.dependency_measurement_parent_work_bound");break
        work+=len(events)
        committed=any(isinstance(event,FrozenMap) and event.get("kind")=="JOINT_ARTICULATED_EDIT"
            and event.get("committed") is True for event in events)
        if (not isinstance(after,FrozenMap) or not committed or result.scope!=native.scope
                or not result.domain_complete or result.prerequisite_refs or result.computation_bound_reached
                or not result.signature_supported or result.implementation_debt_refs):continue
        before_nodes,after_nodes=_nodes(before,max(0,remaining-work)),_nodes(after,max(0,remaining-work))
        if before_nodes is None or after_nodes is None or work+before_nodes+after_nodes>remaining:
            missing.append("articulated.dependency_measurement_parent_work_bound");break
        work+=before_nodes+after_nodes
        before_digest,after_digest=stable_digest(before),stable_digest(after)
        for question in request.dependency_questions:
            if work+1>remaining:
                missing.append("articulated.dependency_measurement_parent_work_bound");break
            work+=1
            if question.input_ref!=native.step.input_ref:continue
            if len(rows)>=128:
                missing.append("articulated.dependency_receipt_projection_bound");break
            try:
                before_predicate=MechanicalPredicateC.model_validate(question.before_predicate)
                after_predicate=MechanicalPredicateC.model_validate(question.after_predicate)
            except (ValidationError,TypeError,ValueError):
                missing.append("articulated.dependency_exact_declared_predicates");continue
            before_bound=_comparison_bound(before_predicate,before,max(0,remaining-work))
            after_bound=_comparison_bound(after_predicate,after,max(0,remaining-work))
            if before_bound is None or after_bound is None or work+before_bound+after_bound>remaining:
                missing.append("articulated.dependency_measurement_parent_work_bound");break
            work+=before_bound+after_bound
            rows.append(FrozenMap({"dependency_ref":question.dependency_ref,"input_ref":question.input_ref,
                "before_state_digest":before_digest,"after_state_digest":after_digest,
                "before_predicate_satisfied":predicate_value(before_predicate,before),
                "after_predicate_satisfied":predicate_value(after_predicate,after),
                "state_changed":before_digest!=after_digest,"support_claim_ref":question.support_claim_ref,
                "parent_goal_ref":request.why.parent_goal_ref,"request_ref":identity.request_ref,
                "projection_ref":stable_digest((identity.request_ref,question)),
                "frozen_why":immutable_json_data(request.why),
                "evidence_refs":(question.support_claim_ref,),"existing_term_refs":(request.why.parent_goal_ref,)}))
    # A truncated/invalid measurement frontier cannot authorize interpretation.
    return ArticulatedDependencyRowsC(rows=tuple(rows) if not missing else (),
        missing_refs=tuple(sorted(set(missing))),accounted_evaluations=work)


def initialize_articulated_dependency_meanings(value):
    return ArticulatedDependencyRowsC()


def append_articulated_dependency_meaning(value):
    meaning=value.meaning
    facts=meaning.facts
    fields=("dependency_ref","input_ref","before_state_digest","after_state_digest","parent_goal_ref","request_ref","projection_ref")
    if (not meaning.template_iteration_complete or any(facts.get(key)!=value.row.get(key) for key in fields)
            or len(value.prior.rows)>=128):
        return value.prior.model_copy(update={"missing_refs":tuple(sorted(set((*value.prior.missing_refs,
            "articulated.dependency_exact_declared_meaning_payload"))))})
    # Semantic support stays in the exact DRM-produced conclusion payload.
    row=FrozenMap({"measurement":value.row,"declared_meaning":immutable_json_data(meaning)})
    return value.prior.model_copy(update={"rows":(*value.prior.rows,row)})


def seal_articulated_dependency_meanings(value):
    returned=value.returned
    measured,interpreted=value.measured,value.interpreted
    missing=tuple(sorted(set((*returned.missing_refs,*measured.missing_refs,*interpreted.missing_refs))))
    return returned.model_copy(update={"conditional_dependency_receipts":interpreted.rows if not missing else (),
        "missing_refs":missing,"accounted_evaluations":returned.accounted_evaluations+measured.accounted_evaluations,
        "reasons":(*returned.reasons,*measured.rows,*interpreted.rows)})
