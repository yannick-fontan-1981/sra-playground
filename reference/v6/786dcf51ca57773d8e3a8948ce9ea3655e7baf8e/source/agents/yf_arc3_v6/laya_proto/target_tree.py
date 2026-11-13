"""Bind a selected composition to its current parent before SRC release."""
import json
from pathlib import Path


TREE_PATH = Path(__file__).with_name("composition_target_tree.json")


class CompositionTargetTree:
    def __init__(self):
        self.contract = json.loads(TREE_PATH.read_text(encoding="utf-8"))

    def information_goals(self,offers,observation,remaining,meter,policy):
        from composition_curiosity import elect
        return elect(offers,observation,remaining,meter,policy)

    def extend_target(self,facts,plans,contacts,feature_trials,method,remaining):
        """Open one bounded child of an evidenced parent before route selection."""
        from agents.yf_arc3_v6.morphology_policy.observed_derivations import observed_derivations
        from hashlib import sha256
        spec=self.contract["extensions"];limits=spec["limits"]
        facets=facts.get("feature_residuals",{})
        if not facts.get("homologous") or facts.get("alignment_refuted") or remaining<=0:return None
        parent_ref=facets.get("prior_method_ref") or facts.get("single_pattern_change_observation_ref")
        if not parent_ref or not facts.get("pair_ref"):return None
        residuals=[]
        for rule in spec["residuals"]:
            feature=rule["feature"]
            if facets.get(feature)!=rule["open"]:continue
            residuals.append({"kind":"remaining_alignment","facet":feature,"wanted":rule["desired"],
                "first_route_key":rule["route_key"],"preserve":rule["preserve"],
                "evidence":[parent_ref,facts["observation_ref"]],"falsifiers":[rule["falsifier"]]})
        derived=observed_derivations(facts,plans,contacts,feature_trials,method,remaining,limits)
        options=derived.get("offers",[])[:limits["max_candidates"]]
        eligible={r for r,route in facts.get("routes",{}).items() if route.get("actions")}
        access=facts.get("feature_reaccess")
        if access and "managed_access" in eligible:
            rebound=[]
            for option in options:
                witnesses={(t["before"],t["after"]) for m in option.get("method_evidence",[])
                           for t in m.get("transitions",[])}
                if (option.get("unresolved_route_key")=="feature_probe" and
                    (access["effect_before"],access["effect_after"]) in witnesses and
                    all(access[k]==facts[k] for k in ("level_epoch","pair_ref","observation_ref"))):
                    option=dict(option,first_route_key="managed_access",bound_contribution=access)
                rebound.append(option)
            options=rebound
        facets_open={x["first_route_key"] for x in residuals}
        candidates=[dict(o,kind="observed_derivation") for o in options if
                    o.get("first_route_key") in facets_open or o.get("relation")=="extends_target"]
        candidates.extend(residuals)
        if not candidates:return None
        bound=[o for o in candidates if o.get("first_route_key") in eligible]
        qualified_joint=next((o for o in bound if o.get("target_ref")=="joint_feature_agreement"),None)
        residual=next((o for o in residuals if o["first_route_key"] in eligible),None)
        # A known effect suggesting a partial repair cannot displace the probe
        # for a second still-unexplained dimension at the same accessible site.
        protected_access=next((o for o in bound if o.get("bound_contribution")),None)
        selected=protected_access or qualified_joint or (residual if len(facets_open)>1 else None) or next(iter(bound),candidates[0])
        route=selected.get("first_route_key")
        scope=[facts["level_epoch"],facts["pair_ref"],selected["kind"],selected.get("facet"),
               selected.get("wanted"),selected.get("chain_refs",[]),route]
        alternatives=[{"kind":o["kind"],"target":o.get("target_ref",o.get("facet")),
                       "route":o.get("first_route_key") or o.get("unresolved_route_key"),
                       "bound":o.get("first_route_key") in eligible,"method":o.get("method_ref")}
                      for o in candidates if o is not selected][:max(0,limits["max_candidates"]-1)]
        return {"id":"C_extension_"+sha256(json.dumps(scope,sort_keys=True).encode()).hexdigest()[:20],
                "parent":spec["parent_family"],"parent_evidence":parent_ref,"pair_ref":facts["pair_ref"],
                "observation_ref":facts["observation_ref"],"level_epoch":facts["level_epoch"],
                "proposed":selected,"open_facets":[r["facet"] for r in residuals],
                "first_route_key":route,"currently_bound":route in eligible,
                "derived_candidates":len(options),"alternatives":alternatives,"limits":limits,"release_authority":False}

    def bind(self, proposal, observation, objective, previous=None):
        root = self.contract["root"]
        epoch, ref = observation["level_epoch"], observation["observation_ref"]
        template = proposal["bundle_template"]
        focus, parent = template["composition_ref"], template["objective_ref"]
        current = {"root": root, "level_epoch": epoch, "observation_ref": ref,
                   "version": self.contract["version"], "retained_target": None}

        def reject(reason):
            return dict(current, admitted=False, reason=reason)

        if objective["id"] != root or parent not in [root, *self.contract["objective_aliases"]]:
            return reject("principal_goal_unbound")
        binding = proposal.get("binding", {})
        if (binding.get("level_epoch"), binding.get("observation_ref")) != (epoch, ref):
            return reject("stale_proposal")
        matches = [c for c in proposal["compositions"] if c["id"] == focus]
        if len(matches) != 1 or "contributes_to:" + parent not in (matches[0].get("relations") or ()):
            return reject("missing_child_parent_relation")
        if template["actions"] != proposal["actions"] or ref not in template.get("evidence", ()):
            return reject("unbound_action_set")
        if any(p not in template.get("preservation_evidence", {}) for p in template.get("preserve_refs", ())):
            return reject("missing_preservation_evidence")

        previous_target = (previous or {}).get("retained_target")
        if previous and previous["level_epoch"] == epoch and previous_target:
            current["retained_target"] = dict(previous_target, revalidated=False)
        morph = proposal.get("morphology", {})
        plan = proposal.get("morphology_plan")
        status = morph.get("status")
        sealed = (previous or {}).get("sealed_child", {})
        if (sealed.get("route_key")=="peer" and sealed.get("after")==ref and
                sealed.get("level_epoch")==epoch and sealed.get("complete") and previous_target and
                sealed["pair_ref"]==previous_target["pair_ref"]):
            current["preceding_peer_access"]=sealed
        if status in {"proposed", "retained", "refuted"}:
            if (morph.get("level_epoch"), morph.get("observation_ref")) != (epoch, ref):
                return reject("stale_role_or_target")
            facts = morph.get("measured_facts", {})
            pair = facts.get("pair_ref")
            if status == "refuted" and pair and current["retained_target"] and pair == current["retained_target"]["pair_ref"]:
                current["retained_target"] = None
            goal = morph.get("composition")
            if goal in self.contract["goals"] and pair and status in {"retained", "proposed"}:
                current["retained_target"] = {"composition": goal, "pair_ref": pair, "evidence": ref,
                                              "open_condition": morph["reason"], "revalidated": True}
                opened=morph.get("target_extension")
                if opened and (opened["level_epoch"],opened["observation_ref"],opened["pair_ref"])==(epoch,ref,pair):
                    # The proposal owns the complete proof. Memory only needs the
                    # bound identity, open siblings and reference to recover it.
                    current["retained_target"]["pending_extension"]={k:opened[k] for k in
                        ("id","pair_ref","observation_ref","open_facets","first_route_key","currently_bound","alternatives")}
                same_target = previous_target and previous_target["pair_ref"] == pair and previous_target["composition"] == goal
                if same_target and previous["level_epoch"] == epoch and previous_target.get("verified_child_effect"):
                    current["retained_target"]["verified_child_effect"] = previous_target["verified_child_effect"]
                if (sealed.get("route_key") == "modifier" and sealed.get("pair_ref") == pair and
                    sealed.get("level_epoch") == epoch and sealed.get("complete") is True and
                    sealed.get("after") == facts.get("single_pattern_change_observation_ref") == ref and
                    facts.get("single_pattern_contact_change") is True and facts.get("orientation_relation") == "aligned"):
                    current["retained_target"]["verified_child_effect"] = {
                        "child": sealed["composition"], "before": sealed["before"], "after": ref,
                        "effect": "one_pattern_changed_and_orientation_aligned"}

        if plan is None:
            curiosity=proposal.get("question",{}).get("curiosity")
            intervention=proposal.get("question",{}).get("context_intervention")
            if intervention is not None:
                offer=proposal.get("inventory_plan",{}).get("offer",{})
                bound=offer.get("target",{}).get("context_question",{})
                if (curiosity is not None or offer.get("kind")!="context_reconfiguration_candidate" or
                    intervention.get("reconciliation_owner")!="observed_inventory.context_intervention.record" or
                    not bound.get("association_ref") or not bound.get("context_key") or
                    intervention.get("association_ref")!=bound["association_ref"] or
                    intervention.get("context_key")!=bound["context_key"] or
                    intervention.get("relations")!=bound.get("relations") or
                    len(proposal.get("steps",[]))!=1 or
                    proposal["steps"][0].get("expected_after") is not None or
                    proposal["steps"][0].get("seal_after") is not True):
                    return reject("unbound_context_intervention_consumer")
                # Reuse the information-goal guard without claiming the generic
                # curiosity protocol; inventory owns its measured reconciliation.
                curiosity=intervention
            if curiosity:
                if (curiosity["observation_ref"]!=ref or curiosity["level_epoch"]!=epoch or
                    proposal["actions"]!=[curiosity["action"]] or curiosity["distinct_outcomes"]<2 or
                    template["operation_key"]!="OP18"):
                    return reject("unbound_information_target")
                target=proposal["question"].get("information_target")
                goals=[c for c in proposal["compositions"] if c["id"]==target and c.get("role")=="information_objective"]
                if (len(goals)!=1 or not target or "investigates:"+target not in matches[0].get("relations",[]) or
                    goals[0]["properties"]["tested_relations"]!=curiosity["relations"]):
                    return reject("information_target_not_linked_to_experiment")
                return dict(current,admitted=True,path=[root,curiosity["tree_key"],target,focus],
                            reason="test_selected_composition_relations",information_goal=curiosity)
            acquisition=proposal.get("question", {}).get("control_acquisition")
            if acquisition is not None:
                target=current["retained_target"]
                if (not target or not target["revalidated"] or target["pair_ref"]!=acquisition["pair_ref"] or
                    ref!=acquisition["observation_ref"] or proposal["actions"]!=[{"action_ref":acquisition["action_ref"]}] or
                    template["operation_key"]!="OP18"):
                    return reject("control_experiment_not_bound_to_target")
                family=self.contract["goals"][target["composition"]]["family"]
                return dict(current,admitted=True,path=[root,family,"composition.priority.information_value",focus],
                            reason="acquire_missing_control",effect_to_check=acquisition["experiment"])
            return dict(current, admitted=True, path=[root, focus], reason="independent_current_contribution")
        if status != "proposed" or not current["retained_target"] or not current["retained_target"]["revalidated"]:
            return reject("target_or_role_unconfirmed")
        branch = morph.get("route_key")
        goal = self.contract["goals"][current["retained_target"]["composition"]]
        child = goal["children"].get(branch)
        if child is None or plan.get("route_key") != branch or morph.get("operation") != template["operation_key"]:
            return reject("child_not_selected")
        facts = plan.get("facts", {})
        if ("color_relation" in facts and (branch=="peer" or plan.get("physical_effect")=="peer")
                and facts["color_relation"]!="equal"):
            return reject("open_palette_condition_before_peer_contact")
        if facts.get("pair_ref") != current["retained_target"]["pair_ref"]:
            return reject("different_pair")
        extension=morph.get("target_extension")
        if extension is not None and extension["first_route_key"]==branch:
            if (not extension["currently_bound"] or extension["pair_ref"]!=facts["pair_ref"] or
                extension["observation_ref"]!=ref or extension["level_epoch"]!=epoch):
                return reject("stale_target_extension")
            current["retained_target"]["extension"]=extension["id"]
        for field, expected in child["requires"].items():
            if facts.get(field) != expected or morph["measured_facts"].get(field) != expected:
                return reject("unmet_child_condition:" + field)
        route = facts.get("routes", {}).get(branch, {})
        if (route.get("level_epoch"), route.get("observation_ref"), route.get("actions")) != (epoch, ref, proposal["actions"]):
            return reject("child_route_changed")
        access_return=(branch=="entry_probe" and facts.get("entry_access_return") and
                       sealed.get("route_key")=="entry_rebind" and sealed.get("complete") is True and
                       sealed.get("after")==ref and sealed.get("pair_ref")==facts["pair_ref"] and sealed.get("level_epoch")==epoch)
        if branch=="entry_probe" and not access_return:return reject("missing_current_access_child_return")
        parent_return = access_return or (branch == "peer" and sealed.get("route_key") == "modifier" and
                         sealed.get("pair_ref") == facts["pair_ref"] and sealed.get("level_epoch") == epoch and
                         sealed.get("after") == facts.get("single_pattern_change_observation_ref") == ref and
                         sealed.get("complete") is True)
        path=[root,goal["family"]]
        if current["retained_target"].get("extension"):path.append(extension["id"])
        return dict(current, admitted=True, path=path+[child["key"],focus],
                    role_refs=plan.get("role_refs",[]),motion_examples=facts.get("motion_examples",{}),
                    contact_in_prefix=plan.get("contact_in_prefix",False),goal_xy=plan.get("goal_xy"),
                    route_key=plan.get("physical_effect") or branch, previous_child_return=sealed if parent_return else None,
                    effect_to_check=child["effect_to_check"], reason="current_child_conditions_met",
                    requires=child["requires"])

    @staticmethod
    def seal(receipt, record):
        if not receipt.get("route_key"):
            return receipt
        return dict(receipt, sealed_child={
            "route_key": receipt["route_key"], "pair_ref": receipt["retained_target"]["pair_ref"],
            "role_refs": receipt["role_refs"],"motion_examples":receipt["motion_examples"],
            "level_epoch": receipt["level_epoch"], "before": receipt["observation_ref"],
            "after": record["final_observation_ref"], "composition": record["released_composition_ref"],
            "complete": (receipt["contact_in_prefix"] or receipt["route_key"]=="entry_rebind") and record["executed_prefix_count"] == record["released_actions_count"] and
                        record["interruption"] is None and record["released_composition_ref"] == receipt["path"][-1]})
