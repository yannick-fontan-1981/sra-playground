"""Transport of current measured means and a separately Source-derived receipt.

Goal counts remain an inventory. This adapter never admits a goal or assigns
exclusivity; the selected DRM disposition supplies both values explicitly.
"""
from ..logos.types import FrozenMap, stable_digest
from .agenda_measurement_transport import append_candidate_measurements
from .homologous_interface import InterfaceObservation, InterfaceProposal, InterfaceAdmission


def measure_reference_goal_admission(value: InterfaceObservation) -> InterfaceProposal:
    v, agenda = value.request, value.agenda
    frame_ref = v.current_observation_ref
    current = agenda.context_facts
    question_claim = current.get('interface_current_question_claim_ref')
    candidates = tuple(c for c in agenda.candidates
        if c.action_ref == current.get('interface_current_question_action_ref')
        and c.point == current.get('interface_current_question_point'))
    question_current = bool(question_claim
        and current.get('interface_current_question_frame_ref') == frame_ref
        and len(candidates) == 1
        and current.get('interface_current_question_expected_relation_ref')
        and current.get('interface_current_question_falsifier_refs'))
    write_refs = tuple(current.get('reference_write_premise_refs', ()))
    bound_goal = current.get('reference_write_unique_goal_ref')
    committed_goal_matches = bool(bound_goal and current.get('committed_plan_present')
        and current.get('active_goal_ref') == bound_goal)
    facts = FrozenMap.overlay(FrozenMap({
        'frame_ref': frame_ref, 'frame_token': stable_digest(frame_ref),
        'reference_write_premise_count': len(write_refs),
        'reference_indirect_question_current': question_current,
        'reference_committed_goal_matches_current_binding': committed_goal_matches,
    }), current)
    evidence = tuple(dict.fromkeys((frame_ref, *write_refs,
        *((question_claim,) if question_current else ()))))
    return InterfaceProposal(request=v, agenda=agenda, facts=facts, evidence_refs=evidence)


def append_reference_goal_admission(value: InterfaceAdmission):
    p = value.proposal
    declared = value.source_alternative_facts[value.source_description_ref]
    if (declared.get('reference_admission_disposition_declared') is not True
            or declared.get('frame_ref') != p.request.current_observation_ref):
        raise ValueError('reference-goal admission lacks its current Source disposition')
    keys = ('reference_guided_goal_admitted', 'reference_guided_goal_exclusive',
        'reference_guided_goal_admission_kind', 'reference_goal_admission_claim_ref',
        'reference_goal_admission_frame_ref', 'reference_goal_continuation_route_ref')
    contribution = {key: declared[key] for key in keys}
    # The legacy name is retained as the Source-declared exclusivity value.
    # No count, prefix, geometry or Python inference is used for this export.
    contribution['reference_guided_goal_open'] = declared['reference_guided_goal_exclusive']
    contribution['reference_goal_admission_claim_refs'] = (declared['reference_goal_admission_claim_ref'],)
    return append_candidate_measurements(p.agenda,
        FrozenMap({ref: FrozenMap(contribution) for ref in p.agenda.alternative_refs}),
        FrozenMap(contribution))
