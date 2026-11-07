"""Build a guarded approach on a locally reproduced axis of a relocated participant."""
from terminal_composition import identity,registered
from target_method import recalled_directions
from .geometry import footprint,pairs,measure_routes


def perimeter_values(rows,point,size):
    x,y=point;w,h=size
    perimeter=[(i,j) for i in (x-1,x+w) for j in range(y,y+h)]
    perimeter.extend((i,j) for j in (y-1,y+h) for i in range(x,x+w))
    return {rows[j][i] for i,j in perimeter if 0<=j<len(rows) and 0<=i<len(rows[0])}


def approach(method,history,current,observation,facts,remaining,available,forecast,collection):
    if (not method or not history or remaining<2 or facts.get("control_attested") or
            not facts.get("framed_pair") or not facts.get("homologous") or not facts.get("asymmetric") or
            facts.get("alignment_refuted") or (current.epoch,current.ref)!=(observation["level_epoch"],observation["observation_ref"])):
        return None
    decision={"composition":"alignment_of_homologous_patterns","measured_facts":facts}
    motions=recalled_directions(method,decision,current)
    motions={a:tuple(v) for a,v in motions.items() if a in available}
    witness=method.get("station_hypothesis") or {}
    sigs=list(method.get("role_refs",()))
    if not motions or not sigs or set(witness.get("role_refs",()))!=set(sigs):return None
    if not all(s in current.roles for s in sigs) or not method.get("scoring_observation"):return None
    boxes=[current.roles[s] for s in sigs];x=min(b[0] for b in boxes);y=min(b[1] for b in boxes)
    size=(max(b[2] for b in boxes)-x+1,max(b[3] for b in boxes)-y+1)
    if size!=tuple(witness.get("size",())):return None
    offsets={s:(current.roles[s][0]-x,current.roles[s][1]-y) for s in sigs}
    def position(scene):
        if not all(s in scene.roles for s in sigs):return None
        origins={(scene.roles[s][0]-dx,scene.roles[s][1]-dy) for s,(dx,dy) in offsets.items()}
        return next(iter(origins)) if len(origins)==1 else None
    pixels=set()
    for p in pairs(current.rows)[1]:
        sig=identity(dict(palette_value=p["color"],area=p["area"],scale=p["scale"],normalized_mask=sorted(p["normalized"])))
        if sig in offsets:
            l,t=p["bbox"][:2];pixels.update((l+i,t+j) for i,j in p["mask"])
    if len(pixels)!=size[0]*size[1]:return None
    confirmed={};blocked={};unresolved={};surround={}
    for b,cmd,a in history:
        if b.epoch!=current.epoch or a.epoch!=current.epoch or b.score!=a.score or cmd not in motions:continue
        pb=position(b);pa=position(a)
        if pb is None or pa is None or not registered(b,a) or not registered(a,current):continue
        dx,dy=motions[cmd];dest=pb[0]+dx,pb[1]+dy;surface=footprint(b.rows,dest,size)
        if surface is None:continue
        if pa==dest and footprint(a.rows,pa,size)==footprint(b.rows,pb,size):
            confirmed.setdefault(cmd,{}).setdefault(surface,{})[pb]=(b.ref,a.ref)
            surround.setdefault((cmd,identity(surface)),set()).update(perimeter_values(b.rows,dest,size))
        elif pa==pb:
            blocked.setdefault(cmd,set()).add((pb,identity(surface)))
        else:
            unresolved[cmd]=True
    attest={cmd:{identity(s):w for s,w in data.items() if len(w)>=2}
            for cmd,data in confirmed.items() if cmd not in unresolved}
    if not any(attest.values()):return None
    # Only the leading part of this hypothetical route can become a probe:
    # every released step needs a twice-observed, phase-matched local translation.
    candidate_control=sigs,motions,position,size
    projected,plans=measure_routes(history,current,min(16,remaining),{},set(),available,action_budget=remaining,
            observation=observation,meter_forecast=forecast,station_method=witness,collection_evidence=collection,
            provisional_control=candidate_control)
    # An unknown local effect is not an execution objective here. A measured
    # mismatch opens a candidate probe; a resource mark is another visible
    # alternative only when its gauge has already been measured.
    goals={k:p for k,p in plans.items() if k in ("feature_probe","capacity_probe") and p.get("steps")}
    if not goals:return None
    ordered=[(k,p) for k,p in sorted(goals.items())]
    prefix=[];proof=[];chosen_axis=None;deferred=None
    for group in zip(*(p["steps"] for _,p in ordered)):
        first=group[0];cmd=first["action_ref"]
        if any((s["from"],s["to"],s["action_ref"])!=(first["from"],first["to"],cmd) for s in group):break
        if any(s.get("nonlocal_witness") for s in group):break
        if any(s["to"]==p["goal_xy"] for s,(_,p) in zip(group,ordered)):break
        anchors=attest.get(cmd,{}).get(first["surface_sha"])
        if not anchors or (tuple(first["from"]),first["surface_sha"]) in blocked.get(cmd,set()):break
        if not perimeter_values(current.rows,first["to"],size)<=surround[cmd,first["surface_sha"]]:
            if len(prefix)>=2:
                inverse=[a for a,v in motions.items() if tuple(v)==tuple(-z for z in motions[cmd])]
                if len(inverse)==1:
                    from .continuation import contour
                    retreat=prefix[-1]["from"]
                    deferred={"steps":[first],"untested_contour":contour(current.rows,first["to"],size,first["from"]),
                              "exit_candidate":{"action_ref":inverse[0],"to":retreat,
                                "surface_sha":identity(footprint(current.rows,retreat,size))}}
            break
        if chosen_axis and cmd!=chosen_axis:break
        chosen_axis=cmd
        proof=list(anchors.values())[:2]
        prefix.append(first)
        if len(prefix)>=16 or len(prefix)>=remaining:break
        if forecast and len(prefix)>=forecast["steps_before_empty"]-1:break
    if len(prefix)<2 or (forecast and len(prefix)>=forecast["steps_before_empty"]):return None
    k,p=ordered[0];actions=[{"action_ref":s["action_ref"]} for s in prefix]
    evidence=[method["scoring_observation"],*(r for w in proof for r in w),current.ref]
    key="entry_rebind"
    facts.update(entry_rebind_bound=True,revalidated_axis=chosen_axis,controlled_xy=[x,y],
        entry_rebind_xy=prefix[-1]["to"],entry_rebind_evidence=evidence,
        entry_rebind_goals=[dict(family=k,site=p["goal_xy"],full_distance=p["full_access_length"]) for k,p in ordered],
        entry_rebind_uncertainty="only the confirmed direction and measured entrance surface are locally bound")
    facts["routes"][key]=dict(start_xy=[x,y],end_xy=prefix[-1]["to"],actions=actions,observation_ref=current.ref,
                              level_epoch=current.epoch,contact_in_prefix=False,full_access_length=len(prefix))
    pending=None
    if deferred:
        pending={**{name:p[name] for name in ("size","role_refs","footprint_sha","pair","level_epoch","score")},
                 **deferred,"facts_pair":facts["pair_ref"],"evidence":evidence}
    return {**p,"deferred_probe":pending,"route_key":key,"steps":prefix,"goal_xy":prefix[-1]["to"],"contact_in_prefix":False,
            "access_phase":"approach","last_effect_unknown":False,"full_access_length":len(prefix),
            "trial":identity([current.ref,key,actions]),"source_role_refs":sigs,"evidence":evidence}
