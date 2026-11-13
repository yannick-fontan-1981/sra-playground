"""Shared exact Source codebook measurement extracted from gravity acquisition.

The caller supplies a world already read from actual acquisition. This reader
does not publish a field, choose among meanings, assign roles or release actions.
"""
from dataclasses import dataclass
from typing import Literal
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref, stable_digest
from agents.yf_arc3_v5.capabilities.mechanical_family_contracts_d import DComputationInterrupted
from .observed_scene_reader import current_positive_claim


class ScalarPixelQuestionB(FrozenModel):
    field_ref: Ref
    bounds: tuple[int,int,int,int]
    method_claim_ref: Ref


class ScalarPixelMethodScopeB(FrozenModel):
    epoch: int
    parent_goal_ref: Ref
    evidence_revision_ref: Ref
    model_revision_ref: Ref


@dataclass(frozen=True)
class ScalarPixelMeasurementB:
    status: Literal['UNIQUE','AMBIGUOUS','NO_MATCH','MISSING_EVIDENCE','PARTIAL']
    matching_values: tuple
    matching_case_indices: tuple[int,...]
    examined_case_count: int
    domain_complete: bool
    raster_digest: Ref | None
    method_claim_ref: Ref
    method_claim_digest: Ref | None
    missing_refs: tuple[Ref,...]
    interruption: DComputationInterrupted | None = None


def measure_scalar_pixel_alternatives(store, question, world, scope, budget):
    """Preserve every match; a partial prefix can never yield a unique value.

    Compatible with A's question/scope duck types. Frame acquisition remains
    owned by the caller, which must bind its publication to that observation.
    """
    question = ScalarPixelQuestionB.model_validate({key:question[key] if isinstance(question,(dict,FrozenMap)) else getattr(question,key)
        for key in ('field_ref','bounds','method_claim_ref')})
    scope = ScalarPixelMethodScopeB.model_validate({key:scope[key] if isinstance(scope,(dict,FrozenMap)) else getattr(scope,key)
        for key in ('epoch','parent_goal_ref','evidence_revision_ref','model_revision_ref')})
    claim = store.snapshot.claim(question.method_claim_ref)
    missing, matches, indices, examined, raster_digest = [], [], [], 0, None
    method_digest = stable_digest(claim) if claim is not None else None

    def receipt(status,complete=False,interruption=None):
        return ScalarPixelMeasurementB(status,tuple(matches),tuple(indices),examined,complete,
            raster_digest,question.method_claim_ref,method_digest,tuple(dict.fromkeys(missing)),interruption)

    if not current_positive_claim(claim,store.snapshot.revision):
        missing.append('scalar_pixels.current_source_method_claim')
    else:
        for key,value in sorted(scope.model_dump().items()):
            if (key not in claim.scope and key not in claim.attributes
                    or key in claim.scope and claim.scope[key] != value
                    or key in claim.attributes and claim.attributes[key] != value):
                missing.append('scalar_pixels.exact_current_method_scope.'+key)
        if claim.attributes.get('field_ref') != question.field_ref or claim.attributes.get('sensor_bounds') != question.bounds:
            missing.append('scalar_pixels.exact_source_field_and_window')
    if missing:
        return receipt('MISSING_EVIDENCE')
    top,left,bottom,right = question.bounds
    frame = world.frame
    if not frame or not frame[0] or not (0 <= top <= bottom < len(frame) and 0 <= left <= right < len(frame[0])):
        missing.append('scalar_pixels.complete_sensor_window')
        return receipt('MISSING_EVIDENCE')
    cases = claim.attributes.get('pixel_semantic_cases',())
    if not isinstance(cases,tuple) or not cases or len(cases) > budget.request.domain_bound:
        missing.append('scalar_pixels.finite_source_case_domain_within_bound')
        return receipt('MISSING_EVIDENCE')
    try:
        pixels = []
        for row in range(top,bottom+1):
            line = []
            for column in range(left,right+1):
                budget.visit({'scalar_field':question.field_ref,'pixel':(row,column)})
                line.append(frame[row][column])
            pixels.append(tuple(line))
        pixels = tuple(pixels)
        raster_digest = stable_digest(pixels)
        digests = set()
        for index,case in enumerate(cases):
            budget.visit({'scalar_field':question.field_ref,'semantic_case':index})
            if not isinstance(case,(dict,FrozenMap)) or 'pixels' not in case or 'value' not in case:
                missing.append('scalar_pixels.exact_source_semantic_case')
                return receipt('MISSING_EVIDENCE')
            examined += 1
            if case['pixels'] == pixels:
                indices.append(index)
                digest = stable_digest(case['value'])
                if digest not in digests:
                    digests.add(digest)
                    matches.append(case['value'])
        budget.finish()
    except DComputationInterrupted as error:
        missing.append('scalar_pixels.budget_interrupted')
        return receipt('PARTIAL',interruption=error)
    status = 'UNIQUE' if len(matches) == 1 else 'AMBIGUOUS' if matches else 'NO_MATCH'
    return receipt(status,complete=True)
