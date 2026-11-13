"""Finite relation join of passive-child means and acquired command domains."""
from agents.yf_arc3_v5.logos.types import FrozenMap


def derive_articulated_indirect_domains(request,reasons):
    domain=request.route_control_domain
    rows,missing=[],[]
    blockers=tuple(row for row in reasons if "ancestor_intervention_options" in row)
    if blockers and domain is None:
        return (), ("articulated.indirect_complete_command_domain_required",)
    for blocker in blockers:
        interventions=[]
        for option in blocker["ancestor_intervention_options"]:
            ancestor=option["ancestor_body_ref"]
            for control in domain.controls:
                controls_ancestor=(control.channel_ref in option["channel_refs"]
                    and (control.kind=="SHARED_CHANNEL" or control.root_body_ref==ancestor))
                if not controls_ancestor:continue
                actual_support=set(option["control_support_claim_refs"])&set(control.support_claim_refs)
                if not actual_support:continue
                interventions.append(FrozenMap({"primitive_ref":control.primitive_ref,
                    "input_ref":control.input_ref,"channel_ref":control.channel_ref,
                    "ancestor_body_ref":ancestor,"directed_chain":option["directed_chain"],
                    "support_claim_refs":tuple(sorted(actual_support))}))
        if not interventions:
            missing.append("articulated.indirect_no_available_ancestor_command."+blocker["passive_blocker_ref"])
        rows.append(FrozenMap({"parent_goal_ref":request.why.parent_goal_ref,
            "dependency_ref":blocker["dependency_ref"],"passive_blocker_ref":blocker["passive_blocker_ref"],
            "admissible_intervention_domain":tuple(interventions),
            "blocked_input_ref":blocker["blocked_input_ref"],
            "restoration_target_refs":blocker["restoration_target_refs"],
            "selection_required":len(interventions)>1,"world_clearance_proved":False}))
    return tuple(rows),tuple(sorted(set(missing)))
