"""Mechanical admission of one Source-requested current action/point.

Exact identity reuse preserves the current candidate and its assembled facts.
Capacity/ambiguity are observations returned to Source, never an exception,
permission to truncate candidates or a choice among competing descriptions.
"""
from collections import ChainMap

from ..logos.types import FrozenMap


def append_one_current_point(request, agenda, *, action_ref, point, maximum_candidates=64):
    point=tuple(point)
    exact=tuple(c for c in agenda.candidates if c.action_ref==action_ref and c.point==point)
    measured={'requested_action_ref':action_ref,'requested_point':point,
        'before_candidate_count':len(agenda.candidates),'existing_exact_match_count':len(exact),
        'producer_count':0,'producer_exact_match_count':0,'new_ref_count':0,
        'point_available':False,'capacity_sufficient':len(agenda.candidates)<maximum_candidates,
        'reused_existing_candidate':False,'ambiguous_reference_binding':len(exact)>1}
    if len(exact)==1:
        return agenda,FrozenMap({**measured,'point_available':True,'capacity_sufficient':True,
            'reused_existing_candidate':True,'candidate_ref':exact[0].candidate_ref})
    if exact or len(agenda.candidates)>=maximum_candidates:
        return agenda,FrozenMap(measured)
    from .interaction import _point_candidates
    produced=tuple(_point_candidates(request,frozenset(request.current_context_no_effect_candidate_refs),
        frozenset(request.tested_candidate_refs_without_resolution_plan),
        ChainMap({},agenda.context_facts),{}, {}, {},requested_points=(point,)))
    matching=tuple((c,facts)for c,facts in produced if c.action_ref==action_ref and c.point==point)
    measured.update(producer_count=len(produced),producer_exact_match_count=len(matching))
    if len(matching)!=1:
        return agenda,FrozenMap({**measured,'ambiguous_reference_binding':len(matching)>1})
    candidate,facts=matching[0]
    if candidate.candidate_ref in agenda.alternative_facts:
        return agenda,FrozenMap({**measured,'ambiguous_reference_binding':True})
    candidates=tuple(sorted((*agenda.candidates,candidate),key=lambda c:c.candidate_ref))
    following=agenda.model_copy(update={'candidates':candidates,
        'alternative_refs':tuple(c.candidate_ref for c in candidates),
        'alternative_facts':FrozenMap.overlay(
            {candidate.candidate_ref:FrozenMap.overlay(facts,agenda.context_facts)},agenda.alternative_facts),
        'descriptive_delta_facts':FrozenMap.overlay(
            {candidate.candidate_ref:facts},agenda.descriptive_delta_facts),'has_candidates':True})
    return following,FrozenMap({**measured,'point_available':True,'capacity_sufficient':True,
        'new_ref_count':1,'candidate_ref':candidate.candidate_ref})
