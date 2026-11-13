"""Compare grounded information goals before constructing their physical probes."""
from collections import Counter
from fractions import Fraction
import json


def comparable(value):
    return json.dumps(value,sort_keys=True,separators=(",",":"))


def point_goal(probe):
    binding=probe["binding"]
    predictions=probe["frozen_predictions"]
    refs={r["id"]:r for r in probe["rivals"]}
    # A measurable feature is one relation even when several models refer to it.
    features={refs[r]["feature"] for pair in probe["new_contrast_pairs"] for r in pair}
    features={min(group) for names in probe["feature_partitions"] if (group:=features.intersection(names))}
    return {"source":"point_contrast","action":binding["action"],"predictions":predictions,
            "relations":[[binding["entity_ref"],"tested_feature",field] for field in sorted(features)],
            "evidence":sorted({r["source_ref"] for r in refs.values()} | {binding["observation_ref"]}),
            "risks":["local_rewrite_may_persist"],"return_steps":None,"question":probe["question"],
            "observation_ref":binding["observation_ref"],"level_epoch":binding["mode"][0],
            "native_probe":probe}


def elect(offers,obs,remaining,meter,policy):
    candidates=[]
    declined=Counter()
    for offer in offers:
        if (offer["level_epoch"],offer["observation_ref"])!=(obs["level_epoch"],obs["observation_ref"]):
            declined["stale"]+=1;continue
        outcomes=Counter(comparable(value) for value in offer["predictions"].values())
        if len(outcomes)<2 or not offer["evidence"]:
            declined["no_grounded_contrast"]+=1;continue
        relations={comparable(r) for r in offer["relations"] if len(r)==3}
        if not relations or set(policy["excluded_risks"]) & set(offer["risks"]):
            declined["preservation_or_missing_relation"]+=1;continue
        spare=offer["return_steps"]
        bound=min(remaining,meter["steps_before_empty"]) if meter else remaining
        if bound<1+(spare or 0) or (meter and spare is None and bound<=1):
            declined["insufficient_action_or_resource_margin"]+=1;continue
        n=sum(outcomes.values());split=Fraction(n-max(outcomes.values()),n)
        candidates.append((offer,relations,split))
    while candidates:
        engaged=[row for row in candidates if row[0].get("engaged_parent")]
        pool=engaged if engaged and policy.get("continue_observed_parent") else candidates
        # Prefer an experiment with a witnessed return where the alternative
        # would expose a protected resource to an unmeasured recovery cost.
        safe=min((bool(o["risks"]),o["return_steps"] is None) for o,_,_ in pool)
        tier=[row for row in pool if (bool(row[0]["risks"]),row[0]["return_steps"] is None)==safe]
        maximal=[row for row in tier if not any(row[1]<other[1] and row[2]<=other[2] for other in tier)]
        def order(row):
            o,rels,split=row
            criteria={"worst_case_separation":-split,"distinct_relations":-len(rels),
                      "recovery_cost":o["return_steps"] or 0,"stable_binding":comparable(o["action"])}
            return tuple(criteria[k] for k in policy["order"])
        picked,rels,split=min(maximal,key=order)
        receipt={k:v for k,v in picked.items() if k!="native_probe"}
        receipt.update(tree_key="composition.priority.information_value",relation_count=len(rels),
                       distinct_outcomes=len(set(comparable(v) for v in picked["predictions"].values())),
                       worst_case_separation=[split.numerator,split.denominator],
                       admissible_offers=len(candidates),rejected=dict(declined),primitive_cost=1)
        yield picked,receipt
        candidates=[row for row in candidates if row[0] is not picked]


def reconcile(receipt,before,after,point_comparison,*,external_measurement=None):
    value=None
    if (before["level_epoch"]==after["level_epoch"] and before["levels_completed"]==after["levels_completed"]
            and after["state"] not in ("GAME_OVER","WIN")):
        if receipt["source"]=="point_contrast" and point_comparison:
            value=point_comparison["record"]["observed_local_change"]
        elif receipt["source"]=="coupled_displays":
            value=external_measurement
        elif receipt["source"]=="motion_contrast":
            ids=set(receipt["role_refs"])
            def poses(state):
                return {e["signature"]:e["bbox"] for e in state["entities"]
                        if e["signature"] in ids and not e["identity_ambiguous"]}
            old,hits=poses(before),poses(after)
            if ids and old.keys()==hits.keys()==ids:
                displacements={tuple(n-o for n,o in zip(hits[s],old[s],strict=True)) for s in ids}
                if len(displacements)==1:
                    dx,dy,right,bottom=displacements.pop()
                    if (dx,dy)==(right,bottom):
                        value=[min(b[0] for b in hits.values()),min(b[1] for b in hits.values())]
    return {"observation_ref":after["observation_ref"],"measured":value,
            "hypothesis_checks":{k:("unknown" if value is None else
                "matched" if v==value else "contradicted") for k,v in receipt["predictions"].items()}}
