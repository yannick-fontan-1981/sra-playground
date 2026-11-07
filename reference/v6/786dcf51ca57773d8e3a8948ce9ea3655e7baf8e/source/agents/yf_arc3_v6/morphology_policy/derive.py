"""Bounded conditional projection from typed facts and attested mechanisms.

The caller supplies an immutable snapshot and an observation ledger. This module
does not run actions, write memories, assign goals or treat predictions as new
observations. Scopes are exact partial matches; a prior-context observation can
support a rule only via an explicit current-context revalidation in the ledger.
"""
from collections import Counter,deque
from collections.abc import Mapping
from copy import deepcopy
from math import isfinite


def _values(raw):
    if not isinstance(raw,Mapping) or any(not isinstance(k,str) or not k for k in raw):
        raise ValueError("Expected a mapping of named scalar facts")
    values=dict(raw)
    for v in values.values():
        if type(v) not in (type(None),bool,int,float,str) or (type(v) is float and not isfinite(v)):
            raise ValueError("Facts must be finite typed scalars")
    return values


def _amounts(raw):
    values=_values(raw)
    if any(type(n) is not int for n in values.values()):raise ValueError("Resource quantities must be integers")
    return values


def _sig(values):
    return tuple(sorted((k,type(v).__name__,v) for k,v in values.items()))


def _match(actual,required):
    return all(k in actual and type(actual[k]) is type(v) and actual[k]==v for k,v in required.items())


def _guard(raw):
    if not isinstance(raw,Mapping):raise ValueError("Expected preservation mapping")
    if any(isinstance(v,Mapping) for v in raw.values()):
        if set(raw)-{"facts","persistent_effects","minimum_resources"}:raise ValueError("Unknown preservation namespace")
        return (_values(raw.get("facts",{})),_values(raw.get("persistent_effects",{})),
                _amounts(raw.get("minimum_resources",{})))
    return _values(raw),{},{}


def _preserved(state,guard):
    return (_match(state[0],guard[0]) and _match(state[2],guard[1]) and
            all(k in state[1] and state[1][k]>=v for k,v in guard[2].items()))


def _merge(a,b):
    for x,y in zip(a[:2],b[:2]):
        if not _match(x,{k:v for k,v in y.items() if k in x}):return None
    mins=dict(a[2])
    for k,v in b[2].items():mins[k]=max(v,mins.get(k,v))
    return {**a[0],**b[0]},{**a[1],**b[1]},mins


def _state_key(state):
    return tuple(_sig(x) for x in state)


def _describe(state):
    return dict(facts=dict(state[0]),resources=dict(state[1]),persistent_effects=dict(state[2]))


def _refs(value):
    if not isinstance(value,(list,tuple)) or not value or any(not isinstance(r,str) or not r for r in value):
        return ()
    return tuple(dict.fromkeys(value))


def _attestation(rule,scope,ledger):
    ident=rule["id"]
    required=_values(rule.get("scope",{}))
    if not required or not _match(scope,required):return None,"rule_scope_unbound"
    source=_refs(rule.get("evidence"))
    if not source:return None,"missing_observed_transition"
    revalidated=[]
    for ref in source:
        row=ledger.get(ref,{})
        if (ref==ident or row.get("kind")!="observed_transition" or row.get("mechanism_ref")!=ident
                or not _refs([row.get("before_ref"),row.get("after_ref")]) or row["before_ref"]==row["after_ref"]):
            return None,"unbound_observed_transition"
        if "scope" in row and not _match(scope,_values(row["scope"])):
            qualified=[]
            for q in _refs(rule.get("revalidation_refs")):
                now=ledger.get(q,{})
                if (now.get("kind")=="current_revalidation" and now.get("mechanism_ref")==ident
                        and now.get("scope") and _match(scope,_values(now["scope"]))
                        and ref in _refs(now.get("evidence"))):
                    qualified.append(q)
            if not qualified:return None,"foreign_observation_requires_revalidation"
            revalidated.extend(qualified)
    return tuple(dict.fromkeys((*source,*revalidated))),None


def derive(current,target,mechanisms,*,preserve,remaining_actions,max_depth=2,max_states=32):
    """Return conditional reach/extension options with distinct retained futures.

    Scalar preconditions/effects use exact type (e.g. True != 1). Resource deltas
    adjust existing integer inventories. Rule-local preserved facts stay active
    on subsequent projected steps. The root goal must have independent evidence.
    Input and output dictionaries are independent.
    """
    if (type(remaining_actions) is not int or remaining_actions<0 or
        type(max_depth) is not int or not 0<=max_depth<=2 or type(max_states) is not int or not 1<=max_states<=32):
        raise ValueError("Require a nonnegative budget, depth 0..2 and 1..32 projected states")
    initial=(_values(current["facts"]),_amounts(current.get("resources",{})),_values(current.get("persistent_effects",{})))
    if any(n<0 for n in initial[1].values()):raise ValueError("Negative initial resource")
    scope=_values(current["scope"]);ledger=current.get("observations",{})
    wanted=(_values(target.get("requires",{})),_amounts(target.get("resources",{})),_values(target.get("persistent_effects",{})))
    goal_refs=_refs(target.get("evidence")); guards=_guard(preserve)
    base=dict(offers=[],initial=_describe(initial),target=target.get("id"),target_evidence=list(goal_refs),
              states_explored=1,search_complete=True,depth_limit=max_depth,state_limit=max_states,
              release_authority=False,ignored_mechanisms={},pruned={},scope=scope)
    if (not target.get("id") or not any(wanted) or not goal_refs or
        not _match(scope,_values(target.get("scope",{}))) or any(
        r==target["id"] or r not in ledger or ledger[r].get("kind") not in
        ("observed_goal","observed_state","observed_transition","current_revalidation","recognized_target")
        or ("target_ref" in ledger[r] and ledger[r]["target_ref"]!=target["id"])
        for r in goal_refs)):
        return dict(base,status="unbound_target")
    if not _preserved(initial,guards):return dict(base,status="initial_preservation_unsatisfied")
    if not isinstance(mechanisms,(list,tuple)) or len(mechanisms)>128:
        return dict(base,status="mechanism_inventory_over_bound",search_complete=False)
    rules={};seen_ids=set()
    for r in mechanisms:
        ident=r.get("id")
        if not isinstance(ident,str) or not ident or ident in seen_ids:raise ValueError("Non-unique mechanism identity")
        seen_ids.add(ident)
        evidence,why=_attestation(r,scope,ledger)
        if why:base["ignored_mechanisms"][ident]=why;continue
        cost=r.get("cost");actions=r.get("actions");probe=r.get("probe")
        if type(cost) is not int or cost<1:raise ValueError("Action cost must be a positive integer")
        if bool(actions)==bool(probe):raise ValueError("Supply exactly one action set or a probe to bind")
        if actions and (not isinstance(actions,(list,tuple)) or len(actions)!=cost):
            raise ValueError("Primitive count differs from action cost")
        if probe and not isinstance(probe,Mapping):raise ValueError("Probe must describe its unresolved binding")
        falsifiers=_refs(r.get("falsifiers"))
        if not falsifiers:base["ignored_mechanisms"][ident]="no_falsifier";continue
        rules[ident]=dict(id=ident,pre=_values(r.get("preconditions",{})),set=_values(r.get("effects",{})),
            prior=_values(r.get("persistent_preconditions",{})),durable=_values(r.get("persistent_effects",{})),
            need=_amounts(r.get("requires_resources",{})),delta=_amounts(r.get("resource_delta",{})),
            guard=_guard(r.get("preserve",{})),cost=cost,evidence=evidence,falsifiers=falsifiers,
            binding={"actions":deepcopy(list(actions))} if actions else {"probe":deepcopy(dict(probe))})
    def holds(state):return all(_match(a,b) for a,b in zip(state,wanted))
    def guarded_key(guard):return tuple(_sig(g) for g in guard)
    head=_state_key(initial);root_key=(head,remaining_actions,guarded_key(guards))
    queue=deque([(initial,remaining_actions,guards,[],{head},holds(initial))])
    visited={root_key};cuts=Counter();offers=[];truncated=False
    while queue:
        state,budget,active,path,ancestors,met=queue.popleft()
        if len(path)>=max_depth:continue
        for ident,r in rules.items():
            if budget<r["cost"]:cuts["action_budget"]+=1;continue
            if not _match(state[0],r["pre"]) or not _match(state[2],r["prior"]):
                cuts["precondition"]+=1;continue
            if not all(k in state[1] and state[1][k]>=v for k,v in r["need"].items()):
                cuts["resource_precondition"]+=1;continue
            combined=_merge(active,r["guard"])
            if combined is None or not _preserved(state,combined):cuts["preservation"]+=1;continue
            if any(k not in state[1] or state[1][k]+v<0 for k,v in r["delta"].items()):
                cuts["resource_exhausted_or_unknown"]+=1;continue
            inventory=dict(state[1])
            for k,delta in r["delta"].items():inventory[k]+=delta
            projected=({**state[0],**r["set"]},inventory,{**state[2],**r["durable"]})
            if not _preserved(projected,combined) or (met and not holds(projected)):
                cuts["preservation"]+=1;continue
            key=_state_key(projected)
            if key in ancestors:cuts["cycle_or_no_observable_change"]+=1;continue
            remaining=budget-r["cost"]
            visit=(key,remaining,guarded_key(combined))
            if visit in visited:cuts["equivalent_future"]+=1;continue
            if len(visited)>=max_states:truncated=True;cuts["state_limit"]+=1;continue
            visited.add(visit)
            changes={label:{k:v for k,v in new.items() if not _match(old,{k:v})}
                     for label,old,new in zip(("facts","resources","persistent_effects"),state,projected)}
            step={"mechanism_ref":ident,"evidence":list(r["evidence"]),"falsifiers":list(r["falsifiers"]),
                  "cost":r["cost"],"changes":changes,"binding":deepcopy(r["binding"])}
            chain=path+[step];satisfied=holds(projected)
            # Spending quantities by itself is not an extension of a known goal.
            extra=bool(changes["facts"] or changes["persistent_effects"] or
                       any(inventory[k]>state[1][k] for k in changes["resources"]))
            if satisfied and (not met or extra):
                offers.append({"relation":"extends_target" if met else "reaches_target","target_ref":target["id"],
                    "chain_refs":[s["mechanism_ref"] for s in chain],"chain":deepcopy(chain),
                    "target_evidence":list(goal_refs),"observed_evidence":list(dict.fromkeys(x for s in chain for x in s["evidence"])),
                    "falsifiers":list(dict.fromkeys(x for s in chain for x in s["falsifiers"])),
                    "remaining_actions":remaining,"cost":remaining_actions-remaining,"projected":_describe(projected),
                    "preserved":{"facts":combined[0].copy(),"persistent_effects":combined[1].copy(),"minimum_resources":combined[2].copy()},
                    "first_obligation":deepcopy(chain[0]),"release_authority":False,"qualification":"conditional_projection"})
            queue.append((projected,remaining,combined,chain,ancestors|{key},satisfied))
    return dict(base,status="conditional_options" if offers else "search_incomplete" if truncated else "no_supported_projection",
                offers=offers,states_explored=len(visited),pruned=dict(cuts),search_complete=not truncated)
