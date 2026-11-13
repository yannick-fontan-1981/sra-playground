"""Instantiate depth-two rules from durable, personally observed feature contacts."""
from collections.abc import Mapping
from hashlib import sha256
import json
from math import ceil
from .derive import derive


def _id(value):
    return sha256(json.dumps(value,sort_keys=True,separators=(",",":")).encode()).hexdigest()


def _bound(facts,plan,key):
    route=facts.get("routes",{}).get(key)
    if not plan or not route or not route.get("actions") or plan.get("contact_in_prefix") is not True:
        return None
    for k in ("level_epoch","observation_ref"):
        if plan.get(k)!=facts[k] or route.get(k)!=facts[k]:return None
    steps=plan.get("steps",[])
    commands=[{"action_ref":s["action_ref"]} for s in steps]
    if (commands!=route["actions"] or not 1<=len(commands)<=16 or
        list(steps[0]["from"])!=list(facts.get("controlled_xy") or ()) or
        list(steps[-1]["to"])!=list(plan.get("goal_xy") or ()) or
        list(steps[-1]["to"])!=list(route.get("end_xy") or ())):
        return None
    return commands


def observed_derivations(facts,plans,contacts,feature_trials,station_method,remaining,limits=None):
    """Propose conditional feature subgoals. Only a current anchored first set is actionable.

    Cost of a subsequent, as-yet unbound approach is an explicit geometric
    lower bound. No forecast of crossing hazards, recharge or scoring is made.
    """
    limits=limits or {}
    envelope={k:facts.get(k) for k in ("observation_ref","level_epoch","pair_ref")}
    no=lambda reason,**extra:dict(status=reason,offers=[],rules_count=0,release_authority=False,**envelope,**extra)
    if type(remaining) is not int or remaining<1:return no("no_remaining_actions")
    epoch=facts.get("level_epoch");ref=facts.get("observation_ref");pair_ref=facts.get("pair_ref")
    if not ref or not pair_ref or not facts.get("control_attested"):return no("current_pair_or_control_unbound")
    visible=facts.get("feature_residuals") or {}
    pair=next((p["pair"] for p in plans.values() if p.get("pair") and p.get("observation_ref")==ref and
               _id([epoch,_id(sorted(p["pair"]["sites"]))])==pair_ref),None)
    if pair is None and visible.get("sites") and _id([epoch,_id(sorted(visible["sites"]))])==pair_ref:
        alternatives=visible.get("orientation_alternatives") or []
        pair={"sites":visible["sites"],"shape_class":visible.get("shape_class"),
              "palette_values":visible.get("palette_values") or visible.get("observed_colors"),
              "quarter_turns":alternatives[0] if len(alternatives)==1 else None}
    if not pair:return no("no_bound_current_pair_plan")
    shape=visible.get("shape_class") or pair.get("shape_class")
    peer=visible.get("possible_peer")
    local_contact=(contacts or {}).get((epoch,_id(sorted(pair["sites"]))),{})
    if local_contact.get("peer") is not None:
        if peer is not None and tuple(local_contact["peer"])!=tuple(peer):return no("competing_peer_bindings")
        peer=local_contact["peer"]
    if not shape or peer is None or tuple(peer) not in map(tuple,pair["sites"]):return no("shape_or_peer_not_revalidated")
    index=[tuple(s) for s in pair["sites"]].index(tuple(peer))
    colors=pair.get("palette_values") or visible.get("observed_colors") or []
    turns=pair.get("quarter_turns")
    if type(turns) is not int or len(colors)!=2:return no("pose_or_palette_unmeasured")
    pose=turns if index==0 else -turns%4
    mobile,reference=colors[1-index],colors[index]
    scope={"level_epoch":epoch,"observation_ref":ref,"pair":pair_ref}
    initial={"pair":pair_ref,"shape":shape,"orientation":pose,"mobile_color":mobile,
             "peer_color":reference,"projected_from":"current"}
    meter=facts.get("meter_forecast")
    quantified=(isinstance(meter,Mapping) and meter.get("observation_ref")==ref and
                meter.get("level_epoch")==epoch and type(meter.get("steps_before_empty")) is int)
    resources={"meter_steps":meter["steps_before_empty"]} if quantified else {}
    ledger={ref:{"kind":"observed_state","scope":scope}}
    current=dict(facts=initial,resources=resources,persistent_effects={},scope=scope,observations=ledger)
    preserve={"facts":{"pair":pair_ref,"shape":shape,"peer_color":reference},
              "minimum_resources":({"meter_steps":limits.get("minimum_meter_after",0)} if quantified else {})}
    if pose==0:preserve["facts"]["orientation"]=0
    if mobile==reference:preserve["facts"]["mobile_color"]=reference
    mechanisms=[];origin_by_id={};rejected=[];sources=[]
    # Current occurrences only. A previous-level template cannot authorize a
    # projected state change without a remeasured matching site and a transition
    # witness for that template in the observation memory.
    plan=plans.get("modifier",{});commands=_bound(facts,plan,"modifier")
    start_surface=plan.get("steps",[{}])[-1].get("surface_sha") if plan.get("steps") else None
    local_sites=list(local_contact.get("stations",{}).values())
    candidates=[(s,False) for s in local_sites]
    if (not local_sites and commands and station_method and station_method.get("after")==visible.get("prior_method_ref")
            and station_method.get("source_epoch")!=epoch and station_method.get("site_surface")==start_surface
            and set(station_method.get("role_refs",()))==set(plan.get("role_refs",()))
            and tuple(station_method.get("size",()))==tuple(plan.get("size") or ())):
        for (old_epoch,_),contact in (contacts or {}).items():
            if old_epoch!=station_method.get("source_epoch"):continue
            for old in contact.get("stations",{}).values():
                rows=[r for r in old.get("entries",[]) if r.get("after")==station_method["after"]]
                if rows and old.get("site_surface")==start_surface:
                    candidates.append(({**old,"site":plan["goal_xy"],"entries":rows,"departures":[]},True))
    for station,transferred in candidates:
        entries=station.get("entries",[]);key=station.get("site_surface");site=station.get("site")
        if not site or not key or not entries:continue
        if any(not e.get("before") or not e.get("after") or e["before"]==e["after"] or
               not e.get("peer_preserved") or type(e.get("delta")) is not int or not e["delta"] for e in entries):
            rejected.append("missing_or_conflicting_rotation_observation");continue
        increments={e["delta"]%4 for e in entries}
        if len(increments)!=1:rejected.append("conflicting_observed_rotations");continue
        distinct={e["after"]:e for e in entries}
        delta=next(iter(increments))
        if delta==0:continue
        bound=commands if site==plan.get("goal_xy") and key==start_surface else None
        # Two observed inputs support the conditional increment at a new pose.
        # With one input, project only from the actually witnessed source pose.
        permitted=set(range(4)) if len({e["before_pose"]["residual"] for e in distinct.values()})>=2 else {
            e["before_pose"]["residual"] for e in distinct.values()}
        colors_measured=all(all(k in e.get("before_pose",{}) and k in e.get("after_pose",{})
                               and e["before_pose"][k]==e["after_pose"][k] for k in ("mobile_color","peer_color"))
                            for e in distinct.values())
        # A witnessed departure and a separate entry from its endpoint are
        # needed to project a second activation of the same site.
        exit_proof=next((e for e in station.get("departures",[]) if e.get("preserved") and e.get("before") and e.get("after")
            and any(tuple(z.get("from",()))==tuple(e.get("to",())) for z in distinct.values())),None)
        for q in sorted(permitted):
            exact=[e for e in distinct.values() if e["before_pose"]["residual"]==q]
            support=(exact or list(distinct.values())[-2:])[-2:]
            updates={"orientation":(q+delta)%4}
            if not colors_measured:updates["mobile_color"]=None
            sources.append(dict(method="observed_rotation:"+key,route="modifier",site=tuple(site),bound=bound,
                requires={"orientation":q},effects=updates,proofs=support,
                status="revalidated_prior_site_and_input" if transferred else "observed_at_this_pose" if exact else "observed_increment_at_two_source_poses",
                proof_epoch=station_method["source_epoch"] if transferred else epoch,
                rearm=exit_proof,expected="pose changes by the observed increment; peer stays fixed",
                falsifiers=["different_orientation_after_entry","peer_changes","source_shape_or_scope_lost"]))
    # Color assignments only reuse the *same observed input color*: one color
    # change cannot imply a cycle for arbitrary palette values.
    raw_trials=(feature_trials or {}).values()
    color_groups={}
    for trial in raw_trials:
        delta=trial.get("outcome") or {}
        if (not trial.get("arrived") or not trial.get("before_ref") or not trial.get("after_ref") or
            trial["before_ref"]==trial["after_ref"] or delta.get("status")!="measured" or not trial.get("site")):continue
        observed_pair=_id([epoch,_id(sorted(r["bbox"] for r in delta.get("sites",[])))])
        if observed_pair!=pair_ref:continue
        explicit=trial.get("epoch",trial.get("level_epoch"))
        if explicit is not None:
            if explicit!=epoch or trial.get("pair_ref",pair_ref)!=pair_ref:continue
        elif local_contact.get("observed")!=trial["after_ref"]:continue
        mobile_row=next((r for r in delta["sites"] if tuple(r["bbox"])!=tuple(peer)),None)
        if not mobile_row or mobile_row["before"].get("shape")!=shape:continue
        key=(tuple(trial["site"]),mobile_row["before"]["color"])
        color_groups.setdefault(key,[]).append((trial,mobile_row,delta))
    for (site,color),group in color_groups.items():
        if not all(d.get("color_only_at_one_site") and d.get("orientation_preserved") and
                   d.get("shape_preserved") and m["changed"]==["color"] for _,m,d in group):
            rejected.append("mixed_or_unconfirmed_color_effect");continue
        yields={r["after"]["color"] for _,r,_ in group}
        if len(yields)!=1:rejected.append("competing_color_effects");continue
        plan=plans.get("feature_probe",{})
        bound=_bound(facts,plan,"feature_probe") if tuple(plan.get("goal_xy",()))==site else None
        signature=group[-1][0].get("site_surface")
        if signature and plan.get("steps") and plan["steps"][-1].get("surface_sha")!=signature:bound=None
        sources.append(dict(method="observed_selective_color:"+_id([site,shape]),route="feature_probe",site=site,bound=bound,
            requires={"mobile_color":color},effects={"mobile_color":next(iter(yields))},
            proofs=[{"before":e["before_ref"],"after":e["after_ref"]} for e,_,_ in group[-2:]],
            status="observed_at_this_input_color",rearm=None,
            expected="only the mobile palette changes after a physically verified entry",
            falsifiers=["different_palette_or_unchanged_color","mask_or_pose_changes","peer_changes"]))
    if not sources:return no("no_applicable_observed_effects",rejections=rejected)
    locations={_id(s["site"]):s["site"] for s in sources}
    speed=max((abs(v[0])+abs(v[1]) for v in facts.get("motion_examples",{}).values()),default=0)
    for s in sources:
        p=plans.get(s["route"])
        if p and (p.get("observation_ref"),p.get("level_epoch"))!=(ref,epoch):
            return no("stale_current_route",rejections=rejected)
    for s in sources:
        dest=_id(s["site"])
        possible=[("current",s["bound"])] if s["bound"] or (speed and facts.get("controlled_xy") is not None) else []
        if s.get("proof_epoch",epoch)==epoch:
            possible += [(origin,None) for origin in locations if origin!=dest or s["rearm"]]
        for origin,actions in possible:
            ident=s["method"]+":"+_id([s["requires"],origin])[:16]
            requirements={**s["requires"],"projected_from":origin}
            proofs=s["proofs"]
            if origin==dest:proofs=proofs+[s["rearm"]]
            evidence=[];revalidated=[]
            for e in proofs:
                rid=ident+"@"+e["after"]
                proof_epoch=s.get("proof_epoch",epoch)
                ledger[rid]={"kind":"observed_transition","mechanism_ref":ident,
                             "scope":scope if proof_epoch==epoch else {"level_epoch":proof_epoch},
                             "before_ref":e["before"],"after_ref":e["after"]}
                evidence.append(rid)
                if proof_epoch!=epoch:
                    key="rebind:"+ident+"@"+ref
                    ledger[key]={"kind":"current_revalidation","mechanism_ref":ident,"scope":scope,"evidence":[rid]}
                    revalidated.append(key)
            if actions:cost=len(actions);binding={"actions":actions}
            else:
                a=facts["controlled_xy"] if origin=="current" else locations[origin];b=s["site"]
                if origin!=dest and not speed:continue
                cost=2 if tuple(a)==tuple(b) else max(1,ceil((abs(a[0]-b[0])+abs(a[1]-b[1]))/speed))
                binding={"probe":{"route_key":s["route"],"site":list(s["site"]),
                                  "condition":"revalidate the occurrence and bind a route from the measured state",
                                  "cost_kind":"optimistic_lower_bound"}}
            rule=dict(id=ident,scope=scope,preconditions=requirements,effects={**s["effects"],"projected_from":dest},
                      evidence=evidence,revalidation_refs=revalidated,cost=cost,preserve={"pair":pair_ref,"shape":shape,"peer_color":reference},
                      resource_delta={"meter_steps":-cost} if quantified else {},falsifiers=s["falsifiers"],**binding)
            mechanisms.append(rule);origin_by_id[ident]=dict(source=s,proofs=proofs)
    goals=[("joint_feature_agreement",{"orientation":0,"mobile_color":reference})]
    if pose:goals.append(("orientation_component",{"orientation":0}))
    if mobile!=reference:goals.append(("palette_component",{"mobile_color":reference}))
    # A separate, actually satisfied base target gives forward consequences
    # a meaning independent of merely proving a predeclared end condition.
    # Its retained shape and any already-achieved feature must survive every step.
    base_goal="preserve_correspondence_extend_features"
    goals.append((base_goal,dict(preserve["facts"])))
    options=[];seen=set();complete=True
    for goal,requires in goals:
        if goal!=base_goal and all(initial.get(k)==v for k,v in requires.items()):continue
        result=derive(current,{"id":goal,"requires":requires,"evidence":[ref]},mechanisms,preserve=preserve,
            remaining_actions=remaining,max_depth=limits.get("max_depth",2),max_states=limits.get("max_states",32))
        complete &= result["search_complete"]
        for proposed in result["offers"]:
            chain=[origin_by_id[k] for k in proposed["chain_refs"]]
            projected=proposed["projected"]["facts"]
            advance=[]
            if pose and projected["orientation"]!=pose:
                # Residuals run on the physically observed four-turn cycle.
                # A new value only counts if fewer applications of an observed
                # increment suffice to reach alignment. A bookkeeping move or
                # a spuriously different orientation cannot earn this branch.
                increments={e.get("delta") for v in chain for e in v["proofs"] if type(e.get("delta")) is int and e["delta"]%4}
                def distance(q,d):
                    return next((i for i in range(4) if (q+i*d)%4==0),None)
                if any(distance(pose,d) is not None and distance(projected["orientation"],d) is not None and
                       distance(projected["orientation"],d)<distance(pose,d) for d in increments):
                    advance.append("orientation")
            if mobile!=reference and projected["mobile_color"]==reference:advance.append("color")
            if goal==base_goal and (proposed["relation"]!="extends_target" or not advance):continue
            methods=[v["source"]["method"] for v in chain]
            mark=(goal,tuple(proposed["chain_refs"]))
            if mark in seen:continue
            seen.add(mark)
            evidence=[{"method_ref":v["source"]["method"],"status":v["source"]["status"],
                       "transitions":[{"before":r["before"],"after":r["after"]} for r in v["proofs"]]} for v in chain]
            first=chain[0]["source"]
            bound_first="actions" in proposed["first_obligation"]["binding"]
            options.append(dict(**proposed,**envelope,first_route_key=first["route"] if bound_first else None,
                unresolved_route_key=None if bound_first else first["route"], method_ref=methods[0],method_chain=methods,
                first_actions=first["bound"],method_evidence=evidence,requires=requires,motif=shape,
                reason="observed_mechanisms_project_"+goal,source_observation=ref,
                improved_features=advance,base_target_currently_satisfied=goal==base_goal,
                cost_scope=("optimistic_lower_bound_pending_route" if not bound_first else
                            "bound_first_set_only; later cost is a lower bound" if len(chain)>1 else "current_bound_set")))
    return dict(status="conditional_options" if options else "no_goal_witness_under_current_constraints",offers=options,**envelope,
                rules_count=len(mechanisms),search_complete=complete,rejections=rejected,
                station_template_only=bool(station_method and not local_sites),release_authority=False)
