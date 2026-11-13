"""Recover legal prefix states from actual K24 joint packets and join effects."""
from fractions import Fraction
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from .contracts import ArticulatedSuccessorMeasurements
from .articulated_channel_kinematics import ArtiState
from .articulated_solving_contracts_c import ArticulatedDependencyRowsC
from .articulated_dependency_receipt_c import read_articulated_dependency_receipts
from .articulated_dependency_measurement_c import _nodes


def measure_articulated_useful_prefixes(value):
    returned=value.returned
    from .articulated_dynamic_prefix_c import measure_articulated_dynamic_prefixes
    dynamic=measure_articulated_dynamic_prefixes(returned)
    if dynamic is not None:return dynamic
    request=returned.frozen_measurement.frozen_input
    native,result=request.native_request,returned.native_result
    if result is None or native.state is None or not native.candidates:
        return ArticulatedDependencyRowsC()
    if (returned.returned is None or returned.returned.request!=request.demand.request
            or result.scope!=native.scope or result.operation_ref!=native.operation_ref or result.mode!=native.mode
            or native.model is None or not result.signature_supported or result.implementation_debt_refs):
        return ArticulatedDependencyRowsC(missing_refs=("articulated.prefix_exact_current_native_domain",),projection_complete=False)
    effects,receipt_missing,work=read_articulated_dependency_receipts(request,returned.conditional_dependency_receipts)
    missing=list(receipt_missing)
    remaining=request.parent_maximum_evaluations-returned.accounted_evaluations
    domain=result.values.get("articulated_candidate_domain",())
    if len(domain)+len(native.candidates)+work>remaining:
        return ArticulatedDependencyRowsC(missing_refs=("articulated.prefix_parent_projection_budget",),projection_complete=False)
    work+=len(domain)+len(native.candidates)
    candidates={candidate.candidate_ref:candidate for candidate in native.candidates}
    if len(candidates)!=len(native.candidates):
        return ArticulatedDependencyRowsC(missing_refs=("articulated.prefix_unique_candidate_domain",),accounted_evaluations=work,projection_complete=False)
    initial_encoded=immutable_json_data(native.state)
    initial_nodes=_nodes(initial_encoded,max(0,remaining-work))
    if initial_nodes is None or work+2*initial_nodes>remaining:
        return ArticulatedDependencyRowsC(missing_refs=("articulated.prefix_parent_projection_budget",),accounted_evaluations=work,projection_complete=False)
    work+=2*initial_nodes
    initial_digest=stable_digest(initial_encoded)
    initial={body.body_ref:body for body in native.state.bodies}
    rows=[]
    cursor=FrozenMap()
    for row in domain:
        candidate=candidates.get(row.get("candidate_ref"))
        if candidate is None:
            missing.append("articulated.prefix_actual_candidate_word");continue
        current=native.state
        for index,event in enumerate(row.get("joint_word_trace",())):
            cursor=FrozenMap({"candidate_ref":candidate.candidate_ref,"prefix_packet_index":index,
                "retained_prefix_count":len(rows)})
            if len(rows)>=128:
                missing.append("articulated.prefix_projection_bound_preserves_frontier");break
            if work+1>remaining:
                missing.append("articulated.prefix_parent_projection_budget");break
            work+=1
            if (not isinstance(event,FrozenMap) or event.get("kind")!="JOINT_ARTICULATED_EDIT"
                    or event.get("committed") is not True):break
            if index>=len(candidate.operator_word):
                missing.append("articulated.prefix_actual_word_packet_position");break
            step=candidate.operator_word[index]
            if step.input_ref!=event.get("input_ref") or step.before_bodies!=current.bodies:
                missing.append("articulated.prefix_preserves_actual_joint_before_state");break
            try:
                packet=ArticulatedSuccessorMeasurements.model_validate(event.get("joint_delta"))
                after=ArtiState(bodies=packet.resulting_bodies,masks=step.after_masks)
            except (ValidationError,TypeError,ValueError):
                missing.append("articulated.prefix_typed_joint_after_state");break
            if (packet.transaction_outcome!="committed" or packet.atomic_model!=native.model.atomic_rejection
                    or tuple(body.body_ref for body in after.bodies)!=tuple(body.body_ref for body in current.bodies)):
                missing.append("articulated.prefix_whole_joint_packet_identity");break
            encoded=immutable_json_data(after)
            nodes=_nodes(encoded,max(0,remaining-work))
            if nodes is None or work+2*nodes+len(effects)+3*len(after.bodies)+4*len(request.restorations)>remaining:
                missing.append("articulated.prefix_parent_projection_budget");break
            work+=2*nodes+len(effects)+3*len(after.bodies)+4*len(request.restorations)
            digest=stable_digest(encoded)
            matched=tuple(effect for effect in effects if effect["before_state_digest"]==digest
                and effect["dependency_ref"] in request.prerequisite_clearance_refs)
            amplitudes=[]
            for body in after.bodies:
                a,b=body.local_extent,initial[body.body_ref].local_extent
                delta=Fraction(a[0],a[1])-Fraction(b[0],b[1])
                if delta:
                    amplitudes.append(FrozenMap({"body_ref":body.body_ref,"extent_delta":(delta.numerator,delta.denominator)}))
            rows.append(FrozenMap({"projection_ref":stable_digest((native.scope,candidate.candidate_ref,index,digest)),
                "parent_goal_ref":request.why.parent_goal_ref,"candidate_ref":candidate.candidate_ref,
                "prefix_primitive_count":index+1,"prefix_after_state":encoded,"prefix_state_digest":digest,
                "state_changed_from_initial":digest!=initial_digest,
                "amplitudes_by_body":tuple(amplitudes),"last_input_ref":step.input_ref,
                "complete_word_blocked":row.get("first_blocked_step") is not None,
                "matched_dependency_effects":matched,"matched_effect_count":len(matched),
                "restoration_targets":tuple(FrozenMap({"body_ref":target.body_ref,
                    "restoration_target_ref":target.restoration_target_ref,
                    "enabling_dependency_ref":target.enabling_dependency_ref}) for target in request.restorations),
                "frozen_why":immutable_json_data(request.why),
                "evidence_refs":tuple(sorted({effect["support_claim_ref"] for effect in matched})),
                "existing_term_refs":(request.why.parent_goal_ref,),"full_amplitude_domain_proved":False}))
            current=after
    return ArticulatedDependencyRowsC(rows=tuple(rows),projection_complete=not bool(missing),
        frontier=cursor if missing else FrozenMap(),
        missing_refs=tuple(sorted(set(missing))),accounted_evaluations=work)


def append_articulated_prefix_meaning(value):
    meaning=value.meaning
    fields=("projection_ref","parent_goal_ref","candidate_ref","prefix_state_digest","prefix_primitive_count")
    if (not meaning.template_iteration_complete or any(meaning.facts.get(key)!=value.row.get(key) for key in fields)
            or len(value.prior.rows)>=128):
        return value.prior.model_copy(update={"missing_refs":tuple(sorted(set((*value.prior.missing_refs,
            "articulated.prefix_exact_declared_meaning_payload"))))})
    return value.prior.model_copy(update={"rows":(*value.prior.rows,
        FrozenMap({"measurement":value.row,"declared_meaning":immutable_json_data(meaning)}))})


def seal_articulated_useful_prefixes(value):
    returned=value.returned
    missing=tuple(sorted(set((*returned.missing_refs,*value.measured.missing_refs,*value.interpreted.missing_refs))))
    return returned.model_copy(update={"useful_prefix_receipts":value.interpreted.rows if not missing else (),
        "missing_refs":missing,"accounted_evaluations":returned.accounted_evaluations+value.measured.accounted_evaluations,
        "reasons":(*returned.reasons,*value.measured.rows,*value.interpreted.rows,
            FrozenMap({"prefix_projection_complete":value.measured.projection_complete,
                "prefix_frontier":value.measured.frontier}))})
