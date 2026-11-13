"""Exact read of Source/DRM conditional effects; no physical satisfaction."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap
from ..drm.meaning import DeclaredMeaningInstantiation


def read_articulated_dependency_receipts(request,receipts):
    effects,missing=[],[]
    work=0
    for receipt in receipts:
        work+=1
        try:
            measurement=receipt["measurement"]
            meaning=DeclaredMeaningInstantiation.model_validate(receipt["declared_meaning"])
        except (ValidationError,TypeError,ValueError,KeyError):
            missing.append("articulated.exact_conditional_dependency_receipt");continue
        fields=("dependency_ref","input_ref","before_state_digest","after_state_digest","parent_goal_ref","request_ref","projection_ref")
        if (not isinstance(measurement,FrozenMap) or not meaning.template_iteration_complete
                or meaning.rule_ref!="rule.articulated_conditional_dependency_effect_c"
                or measurement.get("parent_goal_ref")!=request.why.parent_goal_ref
                or measurement.get("dependency_ref") not in request.why.and_dependency_refs
                or any(meaning.facts.get(key)!=measurement.get(key) for key in fields)):
            missing.append("articulated.current_parent_conditional_interpretation");continue
        conclusions=tuple(claim for claim in meaning.conclusions
            if claim.predicate=="conditionally_supports_articulated_parent_dependency"
            and claim.arguments==(request.why.parent_goal_ref,measurement["dependency_ref"],measurement["input_ref"])
            and claim.attributes.get("conditional_effect_supported") is True
            and claim.attributes.get("physical_dependency_satisfied") is False
            and all(claim.attributes.get(key)==measurement.get(key)
                for key in ("before_state_digest","after_state_digest","request_ref","support_claim_ref")))
        work+=len(meaning.conclusions)
        if len(conclusions)!=1:
            missing.append("articulated.exact_DRM_conditional_effect_conclusion");continue
        effects.append(measurement)
    return tuple(effects),tuple(sorted(set(missing))),work
