"""Conditional product search over measured motion, orientation and consumable sites."""
from collections import Counter, deque
from itertools import permutations


def point(value):
    if not isinstance(value,(tuple,list)) or len(value)!=2 or any(type(n) is not int for n in value):
        raise ValueError("Expected an integer position or displacement")
    return tuple(value)


def search_managed_access(layout,meter,orientation,*,action_budget,max_prefix=16,max_states=100000):
    """One shortest conditional witness per reachable goal and charge-use order.

    A state carries the observed position, orientation, remaining meter and exact
    consumed occurrences. The first uncertain control or effect seals the prefix.
    This function has no environment or dispatch facility.
    """
    bound=(layout["level_epoch"],layout["observation_ref"])
    empty={"status":"abstained","options":[],"release_authority":False,"observation_ref":bound[1],"level_epoch":bound[0]}
    if (not bound[1] or not meter or not orientation or
        (orientation.get("level_epoch"),orientation.get("observation_ref"))!=bound or
        (meter.get("level_epoch",bound[0]),meter.get("observation_ref"))!=bound):
        return dict(empty,reason="unbound_or_stale_measurements")
    if not (orientation.get("evidence") and orientation.get("status") in
            ("current_repeat","current_witness","revalidated_transfer_hypothesis")):
        return dict(empty,reason="no_current_orientation_effect_hypothesis")
    modulus=orientation["modulus"];residual=orientation["residual"];turn=orientation["entry_delta"]
    fuel=meter["steps_before_empty"];capacity=meter["capacity_steps"]
    if (any(type(v) is not int for v in (fuel,capacity,modulus,residual,turn,action_budget,max_prefix,max_states)) or
        not 0<=fuel<=capacity or not 0<=residual<modulus or modulus<2 or turn%modulus==0 or
        action_budget<1 or not 1<=max_prefix<=16 or max_states<1):
        return dict(empty,reason="invalid_finite_domain")
    start=point(layout["start"]);cells={point(p) for p in layout["cells"]}
    if start not in cells:return dict(empty,reason="participant_not_bound")
    def occurrences(group):
        records=layout.get(group,[])
        if any(not r.get("evidence") or not r.get("sites") for r in records):
            raise ValueError("Occurrence requires a current site and evidence")
        result={r["id"]:r for r in records}
        if len(records)!=len(result):raise ValueError("Duplicate occurrence identities")
        return result
    mods=occurrences("modifiers");peers=occurrences("peers");charges=occurrences("charges")
    if any(c.get("status") not in ("hypothesis","observed","consumed") for c in charges.values()):
        raise ValueError("Unqualified charge status")
    if not mods or not peers:return dict(empty,reason="missing_current_goal_or_modifier")
    def membership(records):
        result={}
        for ident,row in records.items():
            for value in row["sites"]:
                p=point(value)
                if p not in cells:raise ValueError("Effect site outside the projected motion graph")
                result.setdefault(p,set()).add(ident)
        return result
    rot=membership(mods);targets=membership(peers)
    usable={k:r for k,r in charges.items() if r["status"]!="consumed"}
    supply=membership(usable)
    palette=layout.get("color_state")
    initial_color=palette["initial"] if palette else None
    wanted_color=palette["wanted"] if palette else None
    color_sites={}
    for site in palette["features"] if palette else ():
        for xy in site["sites"]:
            p=point(xy)
            if p not in cells or p in rot or p in supply or p in targets or p in color_sites:
                return dict(empty,reason="ambiguous_palette_site")
            color_sites[p]=site
    if any(len(ids)>1 for ids in (*rot.values(),*supply.values())) or rot.keys()&supply.keys():
        return dict(empty,reason="ambiguous_effect_site")
    if len(usable)>12:return dict(empty,reason="charge_occurrence_inventory_too_large")
    excluded={(point(e["from"]),point(e["to"])) for e in layout.get("edge_exclusions",[])}
    uncertain={(point(e["from"]),point(e["to"])):e for e in layout.get("uncertain_edges",[])}
    known=[(cmd,point(delta),None) for cmd,delta in sorted(layout["moves"].items())]
    if not known or any(v==(0,0) for _,v,_ in known):return dict(empty,reason="no_bound_translation")
    predictions=[]
    for h in layout.get("speculative_moves",[]):
        v=point(h["delta"])
        rivals=sorted(set(h["test_commands"])-set(layout["moves"]))
        if not h.get("evidence") or not rivals or v in {d for _,d,_ in known}:continue
        if (-v[0],-v[1]) not in {d for _,d,_ in known}:continue
        predictions.append((None,v,dict(h,test_commands=rivals)))
    modes=[known]+[known+[h] for h in predictions]
    counters=Counter();options={};examined=0;truncated=False
    for mode in modes:
        edges={p:[] for p in cells}
        for p in sorted(cells):
            for cmd,v,h in mode:
                dest=p[0]+v[0],p[1]+v[1]
                if dest in cells and (p,dest) not in excluded:
                    edges[p].append((cmd,dest,h,uncertain.get((p,dest))))
        initial=(start,residual,fuel,(),initial_color)
        parents={initial:None};best={(start,residual,(),initial_color):fuel};queue=deque([(initial,0)])
        matches={}
        while queue:
            state,depth=queue.popleft()
            if examined>=max_states:truncated=True;break
            examined+=1
            pos,before_turn,remaining,used,current_color=state
            if remaining<=0:counters["meter_empty"]+=1;continue
            if depth>=action_budget:counters["action_budget"]+=1;continue
            for cmd,dest,h,adverse in edges[pos]:
                after_turn=before_turn;balance=remaining-1;consumed=used;next_color=current_color
                modifier=next(iter(rot.get(dest,())-rot.get(pos,set())),None) if dest in rot else None
                charge=next(iter(supply.get(dest,())-supply.get(pos,set())),None) if dest in supply else None
                if modifier:after_turn=(before_turn+turn)%modulus
                if charge in used:charge=None
                if charge:
                    if len(used)==2:
                        counters["more_than_two_independent_charges"]+=1;continue
                    consumed=used+(charge,);balance=capacity
                feature=color_sites.get(dest)
                if feature and color_sites.get(pos) is not feature:
                    outcomes={r["to_color"] for r in feature["effects"] if r["from_color"]==current_color
                              and r["mobile_site"]==palette["mobile_site"]}
                    if current_color in feature["uncertain_sources"] or len(outcomes)!=1:
                        counters["unmeasured_palette_entry"]+=1;continue
                    next_color=next(iter(outcomes))
                    if current_color==wanted_color and next_color!=wanted_color:
                        counters["would_undo_acquired_color"]+=1;continue
                else:feature=None
                peer_hits=targets.get(dest,set())-targets.get(pos,set())
                if peer_hits and (after_turn or next_color!=wanted_color):
                    # The physical outcome of entering an unaligned candidate
                    # exit is unknown and may destroy the continuation.
                    counters["unaligned_peer_contact"]+=1;continue
                next_state=(dest,after_turn,balance,consumed,next_color)
                cause={"command":cmd,"from":list(pos),"to":list(dest),"remaining_before":remaining,
                       "remaining_after":balance,"orientation_before":before_turn,"orientation_after":after_turn}
                if modifier:cause["modifier"]=modifier
                if charge:cause["charge"]=charge
                if palette:
                    cause.update(color_before=current_color,color_after=next_color)
                if feature:cause["feature"]=feature["id"]
                if h:cause["unidentified_control"]={"predicted_delta":h["delta"],"test_commands":h["test_commands"],"evidence":h["evidence"]}
                if adverse:cause["conditional_crossing"]=adverse
                if charge and palette and initial_color!=wanted_color and current_color==wanted_color:
                    # A partial composition requires actually reaching an as-yet
                    # unspent charge AFTER the predicted palette repair. A single
                    # spare step, or merely reaching the color site, is insufficient.
                    key=("recovery/"+charge,consumed)
                    if key not in matches:matches[key]=(depth+1,balance,state,cause)
                if peer_hits and after_turn==0 and next_color==wanted_color:
                    for peer in sorted(peer_hits):
                        key=(peer,consumed)
                        if key not in matches or (depth+1==matches[key][0] and balance>matches[key][1]):
                            matches[key]=(depth+1,balance,state,dict(cause,peer=peer))
                    # A successful scoring boundary interrupts physical control.
                    continue
                domain_key=(dest,after_turn,consumed,next_color)
                if best.get(domain_key,-1)>=balance:continue
                best[domain_key]=balance
                parents[next_state]=(state,cause)
                queue.append((next_state,depth+1))
        for (peer,order),(_,balance,state,final) in matches.items():
            rev=[final]
            while parents[state]:
                state,s=parents[state];rev.append(s)
            path=rev[::-1]
            speculative=any("unidentified_control" in s for s in path)
            key=(peer,order,tuple(mode[-1][1]) if speculative else None)
            if key in options:continue
            prefix=[]
            for step in path[:max_prefix]:
                prefix.append(dict(step))
                if any(k in step for k in ("unidentified_control","conditional_crossing","charge","modifier","feature","peer")):break
            end=prefix[-1]
            if "unidentified_control" in end:
                first="discriminate_opposite_control";end["test_command"]=end["unidentified_control"]["test_commands"][0]
            elif "conditional_crossing" in end:first="revalidate_conditional_crossing"
            elif "charge" in end:first="test_or_collect_capacity"
            elif "modifier" in end:first="test_or_rearm_orientation"
            elif "feature" in end:first="test_observed_palette_entry"
            elif "peer" in end:first="test_aligned_peer"
            else:first="advance_to_intermediate_access"
            goal_step=next((i for i,s in enumerate(path) if {"modifier","charge","peer","feature"}&s.keys()),len(path)-1)
            next_goal=path[goal_step]
            obligation={k:next_goal[k] for k in ("modifier","charge","peer","feature","to") if k in next_goal}
            obligation["steps_to_obligation"]=goal_step+1
            recovery=peer.startswith("recovery/")
            options[key]={"peer":None if recovery else peer,"recovery":peer[9:] if recovery else None,
                "objective":"feature_then_recovery" if recovery else "aligned_peer","charge_order":list(order),
                "primitive_count":len(path),"remaining_at_peer":None if recovery else balance,"remaining_at_goal":balance,
                "next_composition":obligation,
                "first_obligation":first,"prefix":prefix,"conditional_path":path,"speculative_control_required":speculative,
                "hypotheses":{"charge_roles":{k:usable[k]["status"] for k in order},"entry_effect":orientation["status"],
                    "capacity":meter.get("capacity_status","conditional"),
                    "peer":None if recovery else peers[peer].get("status","hypothesis")},
                "falsifiers":["wrong_translation","gain_or_consumption_absent","rotation_or_preserved_peer_differs",
                              "capacity_projection_diverges","unaligned_or_unconfirmed_boundary"],
                "release_authority":False}
        if truncated:break
    orders=[()]+[(x,) for x in sorted(usable)]+list(permutations(sorted(usable),2))
    variants={order for _,order,_ in options}
    return {**empty,"status":"conditional_options" if options else "search_incomplete" if truncated else "no_complete_conditional_route",
            "search_complete":not truncated,"states":examined,"pruning":dict(counters),
            "orders_without_witness":[list(o) for o in orders if o not in variants],
            "options":sorted(options.values(),key=lambda v:(v["objective"]!="aligned_peer",v["primitive_count"],
                v["speculative_control_required"],v["peer"] or "",v["charge_order"]))}
