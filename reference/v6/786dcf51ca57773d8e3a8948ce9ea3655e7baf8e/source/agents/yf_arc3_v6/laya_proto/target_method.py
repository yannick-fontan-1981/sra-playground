"""Project a bounded, falsifiable method from an observed scoring episode."""

def at_boundary(tree, witness):
    target = tree.get("retained_target") or {}
    approach = tree.get("preceding_peer_access") or {}
    effect = target.get("verified_child_effect")
    if not effect or not approach.get("complete") or approach["pair_ref"] != target["pair_ref"]:
        return None
    if (witness["levels_completed_after"] != witness["levels_completed_before"] + 1 or
        witness["source_level"] != approach["level_epoch"] or
        approach["after"] != tree["observation_ref"] or
        witness["before_observation_ref"] != tree["observation_ref"]):
        return None
    return {"composition":target["composition"], "source_scope":approach["level_epoch"],
            "role_refs":approach["role_refs"], "motion_examples":approach["motion_examples"],
            "verified_selective_change":effect, "peer_approach_return":approach["after"],
            "scoring_observation":witness["after_observation_ref"],
            "qualification":"observed_sequence_possible_goal; necessity_and_sufficiency_open"}


def recalled_directions(method, decision, current):
    if not method or method["source_scope"] == current.epoch or method["composition"] != decision.get("composition"):
        return {}
    facts = decision["measured_facts"]
    if not (facts["framed_pair"] and facts["homologous"] and facts["asymmetric"] and not facts["alignment_refuted"]):
        return {}
    if not method["role_refs"] or not all(sig in current.roles for sig in method["role_refs"]):
        return {}
    return method["motion_examples"]
