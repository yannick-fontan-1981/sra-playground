"""Exact supported cycle maps and inverse images, never inverse commands."""
from agents.yf_arc3_v5.logos.types import FrozenMap


def permutation_work_d(action,request=None):
    if not action.permutation_cycles:return 0
    work=8*sum(len(row.carrier_refs)+len(row.phase_evidence_refs)+1 for row in action.permutation_cycles)
    if request is not None:
        work+=4*sum(len(row.allowed_domain)+8 for row in request.carriers)
        work+=4*len(action.transition_rows)*(len(request.carriers)+1)
    return work


def measure_permutation_map_d(request,action,column):
    cycles=action.permutation_cycles
    if not cycles:return None,(),('permutation.explicit_supported_cycles',)
    if len({row.cycle_ref for row in cycles})!=len(cycles):
        return None,(),('permutation.distinct_cycle_identity',)
    current={row.carrier_ref:row for row in request.carriers}
    forward={};rows=[]
    for cycle in cycles:
        refs=cycle.carrier_refs
        if len(set(refs))!=len(refs) or any(ref not in current or ref in forward for ref in refs):
            return None,(),('permutation.disjoint_cycle_decomposition_of_one_control',)
        phase=cycle.measured_phase%len(refs)
        for index,ref in enumerate(refs):forward[ref]=refs[(index+phase)%len(refs)]
        rows.append(FrozenMap({'cycle_ref':cycle.cycle_ref,'ordered_support_refs':refs,
            'cycle_length':len(refs),'measured_signed_phase':cycle.measured_phase,
            'phase_residue':phase,'phase_evidence_refs':cycle.phase_evidence_refs}))
    if set(forward)!=set(column['carrier_refs']):
        return None,(),('permutation.complete_current_control_support_and_no_protected_effect',)
    return FrozenMap(forward),tuple(rows),()


def permutation_image_d(request,action,column,before,inverse=False):
    forward,rows,missing=measure_permutation_map_d(request,action,column)
    if missing:return before,rows,missing
    if set(before)!={row.carrier_ref for row in request.carriers}:
        return before,rows,('permutation.complete_pre_state_including_untouched_carriers',)
    if not action.domain_complete:return before,rows,('permutation.closed_supported_control_model',)
    after=dict(before.items())
    for origin,destination in sorted(forward.items()):
        if inverse:after[origin]=before[destination]
        else:after[destination]=before[origin]
    domains={row.carrier_ref:row.allowed_domain for row in request.carriers}
    if any(after[ref] not in domains[ref] for ref in sorted(forward)):
        return before,rows,('permutation.image_outside_declared_carrier_domain',)
    return FrozenMap(after),rows,()
