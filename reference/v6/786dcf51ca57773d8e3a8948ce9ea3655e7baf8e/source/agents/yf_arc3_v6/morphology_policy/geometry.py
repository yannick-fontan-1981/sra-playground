"""Public measurements of framed patterns, motion and geometrical access."""
from collections import deque
from itertools import combinations
from functools import lru_cache

from agents.yf_arc3_v5.capabilities.complementary_contours import measure_centered_enclosure_identities
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid
from geometric_observer import components, framed_patterns, rotate
from terminal_composition import motion_models, registered, identity
from .orthogonal_features import matched_pairs,residuals


def gauge_related_marks(parts, meter_forecast, size, excluded_sites=()):
    """Existing measured gauge/appearance relation, never an asserted refill role."""
    marks=[]
    if meter_forecast:
        axis,line,pigment,_,_=meter_forecast["measured_strip"]
        for part in parts:
            l,t,r,b=part["bbox"]
            on_strip=t<=line<=b if axis=="x" else l<=line<=r
            if (part["color"]==pigment and not on_strip and r-l+1<=size[0] and b-t+1<=size[1]
                    and not any(intersects(part["bbox"],site) for site in excluded_sites)):
                marks.append(part["bbox"])
    return marks

@lru_cache(maxsize=32)
def pairs(rows):
    frame=FrameGrid(rows=tuple(map(tuple,rows)))
    boxes={(l,t,r,b) for t,l,b,r,_ in measure_centered_enclosure_identities(frame)}
    parts=components(rows)
    patterns=[p for p in framed_patterns(rows,parts) if tuple(p['bbox']) in boxes]
    return matched_pairs(patterns),parts


def intersects(a,b):
    return a[0]<=b[2] and b[0]<=a[2] and a[1]<=b[3] and b[1]<=a[3]


def enclosed(inner,outer):
    return outer[0]<=inner[0]<=inner[2]<=outer[2] and outer[1]<=inner[1]<=inner[3]<=outer[3]


def rigid_role(history,current,parts):
    candidates=list(motion_models(history,current))
    if not candidates:return None
    signatures=[sig for sig,_ in candidates]
    motions=candidates[0][1]
    if not (any(x for x,y in motions.values()) and any(y for x,y in motions.values())):return None
    if any(m!=motions for _,m in candidates):return None
    boxes=[current.roles[s] for s in signatures]
    left=min(x[0] for x in boxes);top=min(x[1] for x in boxes)
    right=max(x[2] for x in boxes);bottom=max(x[3] for x in boxes)
    offsets={s:(current.roles[s][0]-left,current.roles[s][1]-top) for s in signatures}
    def position(snapshot):
        if any(s not in snapshot.roles for s in signatures):return None
        poses={(snapshot.roles[s][0]-dx,snapshot.roles[s][1]-dy) for s,(dx,dy) in offsets.items()}
        return poses.pop() if len(poses)==1 else None
    if len({p for b,_,_ in history if (p:=position(b)) is not None})<2:return None
    # These rectangles must jointly fill the footprint. Detached peers and
    # sparsely occupied bounding boxes cannot define a traversed surface.
    cells=set()
    for part in parts:
        signature=identity({'palette_value':part['color'],'area':part['area'],'scale':part['scale'],
                            'normalized_mask':sorted(part['normalized'])})
        if signature in signatures:
            l,t,_,_=part['bbox']
            cells.update((l+x,t+y) for x,y in part['mask'])
    if len(cells)!=(right-left+1)*(bottom-top+1):return None
    return signatures,motions,position,(right-left+1,bottom-top+1)


def footprint(rows, at, size):
    x, y = at
    width, height = size
    if x < 0 or y < 0 or y+height > len(rows) or x+width > len(rows[0]):
        return None
    return tuple(v for row in rows[y:y+height] for v in row[x:x+width])


def pair_key(pair):
    return identity(sorted(pair["sites"]))


def measure_routes(history, current, limit, contacts, tried, available=(), *, action_budget=None, meter_forecast=None,
                   station_method=None, collection_evidence=None, observation=None,feature_trials=None,provisional_control=None):
    candidates, parts = pairs(current.rows)
    pair = candidates[0] if len(candidates)==1 else None
    partial=None
    if not pair and not candidates:
        from .partial_correspondence import retain
        recovered=retain(history,current,parts,contacts)
        if recovered:
            pair,provisional_control,partial=recovered
    facts = dict(observation_ref=current.ref, level_epoch=current.epoch, framed_pair=bool(pair),
                 homologous=bool(pair), asymmetric=bool(pair), orientation_relation="ambiguous",
                 control_attested=False, single_pattern_contact_change=False, alignment_refuted=False,
                 peer_discrimination_bound=False, routes={})
    if not pair:
        return facts, {}
    key = pair_key(pair)
    facts["pair_ref"] = identity([current.epoch,key])
    facets=residuals(pair,station_method)
    facts.update(feature_residuals=facets,color_relation=facets["color"],orientation_relation=facets["orientation"],
                 asymmetric=pair["quarter_turns"] is not None)
    preserve=("normalized_shape","current_oriented_masks","unchanged_peer_palette",
              "current_control_and_epoch","reserve_and_available_return")
    facts["preserve_features"]=list(preserve)
    contact = contacts.get((current.epoch, key))
    peer = contact["peer"] if contact else None
    if contact:
        facts["single_pattern_change_observation_ref"] = contact["observed"]
    facts["single_pattern_contact_change"] = peer is not None
    control = provisional_control or rigid_role(history,current,parts)
    if control is None:
        return facts, {}
    signatures, motions, position, size = control
    origin = position(current)
    if origin is None:
        return facts, {}
    facts.update(control_attested=True, controlled_xy=list(origin),controlled_role_refs=signatures,
                 motion_examples={cmd:list(vector) for cmd,vector in motions.items()})
    if partial:
        from .partial_correspondence import interior_probe
        facts.update(partial_correspondence=True,correspondence_visibility=partial)
        return facts,interior_probe(current,pair,control,partial,facts,available,action_budget,meter_forecast)
    positives, negatives, anchors = {}, set(), []
    unresolved_edges={}
    for before, action, after in history:
        start, end = position(before), position(after)
        if start is None or end is None or action not in motions:
            continue
        dx, dy = motions[action]
        dest = (start[0]+dx,start[1]+dy)
        patch = footprint(before.rows,dest,size)
        if patch is not None:
            if dest==end:
                positives.setdefault(patch,set()).add(start)
                unresolved_edges.pop((start,action,dest,patch),None)
            elif start==end:
                negatives.add(patch)
            else:
                unresolved_edges[start,action,dest,patch]={
                    "before":before.ref,"after":after.ref,"landing":list(end)}
        if start!=origin and registered(before,current):
            anchors.append(before)
    surfaces = {p for p, starts in positives.items() if len(starts)>=2 and p not in negatives}
    queue=deque([(origin,[])])
    visited={origin}
    targets={"peer":{}, "modifier":{}, "capacity_probe":{}, "feature_probe":{}}
    # Appearance shared with a measured gauge motivates a test. It does not
    # identify the object as a refill before its effect is seen.
    marks=gauge_related_marks(parts,meter_forecast,size,pair["sites"])
    stations={tuple(s["site"]):s for s in (contact or {}).get("stations",{}).values()}
    from .feature_occurrences import known_feature_sites
    feature_sites=known_feature_sites(current,pair,history,feature_trials,origin,size)
    facts["observed_color_sites"]=[dict(site=list(p),signature=s["site_surface"],evidence=s["evidence"])
                                  for p,s in feature_sites.items()]
    while queue:
        point, path=queue.popleft()
        # The finite board bounds search. A committed prefix has its own smaller
        # cap; a remote goal stays identifiable even when the whole path will not fit.
        if action_budget is not None and len(path)>=action_budget:
            continue
        for action,(dx,dy) in sorted(motions.items()):
            dest=(point[0]+dx,point[1]+dy)
            if dest in visited:
                continue
            surface=footprint(current.rows,dest,size)
            if surface is None:
                continue
            bounds=(*dest,dest[0]+size[0]-1,dest[1]+size[1]-1)
            step={"from":list(point),"to":list(dest),"action_ref":action,
                  "surface_sha":identity(surface)}
            adverse=unresolved_edges.get((point,action,dest,surface))
            if adverse:
                step["nonlocal_witness"]=adverse
            trail=path+[step]
            if dest in feature_sites:
                # Equally traversable geometry does not mean equivalently
                # preserved palette. Only the product may enter a known site.
                continue
            if any(enclosed(mark,bounds) for mark in marks):
                targets["capacity_probe"].setdefault(dest,trail)
                continue
            station=stations.get(dest)
            if station and station["size"]==list(size) and step["surface_sha"]==station["site_surface"]:
                # A surface can be both traversable and effectful. Entering a
                # known modulator cannot be used as plain alignment-preserving transit.
                targets["modifier"].setdefault(dest,trail)
                continue
            if peer is not None and intersects(bounds,peer):
                targets["peer"].setdefault(dest,trail)
                continue
            if surface in surfaces:
                visited.add(dest)
                queue.append((dest,trail))
                continue
            if any(intersects(bounds,s) for s in pair["sites"]):
                continue
            islands=[p for p in parts if enclosed(p["bbox"],bounds)]
            if len({p["color"] for p in islands})>=2 and any(footprint(a.rows,dest,size)==surface for a in anchors):
                targets["modifier"].setdefault(dest,trail)
                # A persistent multicolour motif containing both conflicting
                # values gives a public contrast. It does not establish what
                # contact changes. The current/recalled rotator is independent.
                pigments={p["color"] for p in islands}
                if (facets["color"]=="different" and set(pair["palette_values"])<=pigments and
                        identity(surface)!=facets["prior_surface"] and station is None):
                    targets["feature_probe"].setdefault(dest,trail)
    station=stations.get(origin)
    if station and station["footprint"]==identity(footprint(current.rows,origin,size)):
        cycles=[]
        for exit_event in station["departures"]:
            if not exit_event["preserved"]:continue
            neighbor=tuple(exit_event["to"]);out=exit_event["command"]
            if out not in motions or (origin[0]+motions[out][0],origin[1]+motions[out][1])!=neighbor:continue
            neighbor_patch=footprint(current.rows,neighbor,size)
            if neighbor_patch not in surfaces:continue
            for arrival in station["entries"]:
                back=arrival["command"]
                if (tuple(arrival["from"])!=neighbor or not arrival["delta"] or back not in motions or
                    (neighbor[0]+motions[back][0],neighbor[1]+motions[back][1])!=origin):continue
                cycles.append([{"from":list(origin),"to":list(neighbor),"action_ref":out,
                    "surface_sha":identity(neighbor_patch),"departure_ref":exit_event["after"]},
                    {"from":list(neighbor),"to":list(origin),"action_ref":back,
                     "surface_sha":station["site_surface"],"prior_entry":arrival["after"]}])
        if cycles and (action_budget is None or action_budget>=2):
            # Equivalent witnessed cycles restore the same pose; select a stable representative.
            targets["modifier"][origin]=min(cycles,key=lambda seq:tuple((s["action_ref"],s["to"]) for s in seq))
    plans={}
    for name, pool in targets.items():
        ranked=[]
        for dest, path in pool.items():
            trial=identity([current.epoch,key,name,dest,pair["orientations"],pair["palette_values"]])
            if trial not in tried:
                ranked.append((len(path),dest,path,trial))
        if not ranked:
            continue
        length=min(r[0] for r in ranked)
        choices=[r for r in ranked if r[0]==length]
        if len(choices)!=1:
            continue
        _,dest,full,trial=choices[0]
        first_unknown=next((i+1 for i,s in enumerate(full) if "nonlocal_witness" in s),len(full))
        steps=full[:min(limit,first_unknown)]
        if not steps:
            continue
        contact_in_prefix=len(steps)==len(full) and "nonlocal_witness" not in steps[-1]
        phase="contact" if contact_in_prefix else "approach"
        known_terminal=contact_in_prefix or "nonlocal_witness" in steps[-1]
        actions=[{"action_ref":step["action_ref"]} for step in steps]
        facts[name+"_xy"]=steps[-1]["to"]
        facts["routes"][name]=dict(start_xy=list(origin),end_xy=steps[-1]["to"],actions=actions,
                                   goal_xy=list(dest),full_access_length=len(full),contact_in_prefix=contact_in_prefix,
                                   observation_ref=current.ref,level_epoch=current.epoch)
        plans[name]=dict(route_key=name,steps=steps,size=list(size),footprint_sha=identity(footprint(current.rows,origin,size)),
                         role_refs=signatures,pair=pair,trial=trial,score=current.score,
                         level_epoch=current.epoch,observation_ref=current.ref,access_phase=phase,
                         contact_in_prefix=contact_in_prefix,full_access_length=len(full),goal_xy=list(dest),
                         last_effect_unknown=known_terminal)
        if name=="capacity_probe":
            facts["capacity_candidate_bound"]=True
        if name=="modifier" and dest in stations:
            from .rearm_evidence import orientation,prediction
            station=stations[dest]
            predicted=prediction(station,orientation(current.rows,key,peer))
            plans[name]["known_effectful_site"]=dict(site=list(dest),site_surface=station["site_surface"],
                independent_entry_refs=[r["after"] for r in station["entries"]],
                preserved_exit_refs=[r["after"] for r in station["departures"] if r["preserved"]],
                hypothesis=predicted)
            facts["routes"][name]["predicted_on_complete_entry"]=predicted
    probe_targets=[]
    if peer is not None and "peer" not in plans:
        probe_targets.append(("peer_access_probe",[peer]))
    if marks and "capacity_probe" not in plans:
        probe_targets.append(("capacity_access_probe",marks))
    for name,sites in probe_targets:
        witnesses=[]
        for site in sites:
            item=missing_axis_witness(current,history,position,motions,size,site,surfaces,available,limit)
            if item and (name=="peer_access_probe" or item[1]["conditional_distance"]<=meter_forecast["steps_before_empty"]):
                witnesses.append(item)
        if not witnesses:continue
        steps,contrast=min(witnesses,key=lambda item:(item[1]["conditional_distance"],len(item[0]),item[1]["peer_bbox"]))
        dest=steps[-1]["to"]
        trial=identity([current.epoch,key,name,steps[-1]["from"],steps[-1]["action_ref"],dest])
        if trial in tried:continue
        actions=[{"action_ref":step["action_ref"]} for step in steps]
        facts[name+"_xy"]=dest
        if name=="peer_access_probe":
            facts.update(peer_discrimination_bound=True,access_contrast=contrast)
        else:
            facts.update(capacity_candidate_bound=True,capacity_contrast=contrast)
        facts["routes"][name]=dict(start_xy=list(origin),end_xy=dest,actions=actions,
                                   observation_ref=current.ref,level_epoch=current.epoch)
        plans[name]=dict(route_key=name,steps=steps,size=list(size),
                    footprint_sha=identity(footprint(current.rows,origin,size)),role_refs=signatures,
                    pair=pair,trial=trial,score=current.score,level_epoch=current.epoch,
                    observation_ref=current.ref)
    if meter_forecast and ("capacity_probe" in plans or "capacity_access_probe" in plans):
        principal=plans.get("peer" if facts["orientation_relation"]=="aligned" else "modifier")
        minimum=None
        if principal is not None:
            minimum=principal["full_access_length"]
            if principal["route_key"]=="modifier":
                # Optimistic bound to either reference after changing a motif.
                # Unknown obstacles and repeated rotations can only add actions.
                x,y=principal["goal_xy"]
                speed=max(abs(dx)+abs(dy) for dx,dy in motions.values())
                gap=min(max(l-x-size[0]+1,x-r,0)+max(t-y-size[1]+1,y-b,0) for l,t,r,b in pair["sites"])
                minimum+=(gap+speed-1)//speed
        facts["capacity_needed"]=minimum is None or minimum>meter_forecast["steps_before_empty"]
        facts["direct_goal_cost_lower_bound"]=minimum
    if ((facets["color"]=="equal" or feature_sites) and pair["quarter_turns"] is not None and meter_forecast and observation is not None and action_budget and
            (marks or collection_evidence.pending or any(
             e.get("epoch")==current.epoch and e.get("kind")=="disappearance_confirmed"
             for e in collection_evidence.history.values()))):
        from .managed_projection import project_layout
        from .managed_capacity import search_managed_access
        layout,orientation=project_layout(current,pair,origin,size,motions,surfaces,unresolved_edges,marks,
            stations,station_method,signatures,available,collection_evidence,observation,feature_sites=feature_sites)
        if layout is not None and orientation is not None:
            search=search_managed_access(layout,meter_forecast,orientation,action_budget=action_budget,max_prefix=limit)
            options=search["options"]
            facts["managed_search"]={"status":search["status"],"options":len(options),
                "charge_orders":[{"order":o["charge_order"],"cost":o["primitive_count"],
                                  "remaining":o["remaining_at_goal"],"objective":o["objective"]} for o in options[:12]]}
            for option in options:
                prefix=option["prefix"]
                commands=[s.get("test_command") or s["command"] for s in prefix]
                if not commands or any(a not in available for a in commands):continue
                last=prefix[-1]
                if last.get("unidentified_control"):
                    move=last["unidentified_control"]
                    eligible=[]
                    for cmd in move["test_commands"]:
                        success=0;contrary=False
                        for before,act,after in history:
                            if act!=cmd:continue
                            a,b=position(before),position(after)
                            if a is None or b is None:continue
                            if list((b[0]-a[0],b[1]-a[1]))==move["predicted_delta"]:success+=1
                            elif list(a)==last["from"] and footprint(before.rows,last["to"],size)==footprint(current.rows,last["to"],size):
                                contrary=True
                        if not contrary:eligible.append((-success,cmd))
                    if not eligible:continue
                    commands[-1]=min(eligible)[1]
                trial=identity([current.epoch,key,option["first_obligation"],last["from"],last["to"],
                                commands[-1],orientation["residual"],meter_forecast["steps_before_empty"],
                                layout.get("color_state",{}).get("initial")])
                if trial in tried:continue
                steps=[{"from":s["from"],"to":s["to"],"action_ref":cmd,
                        "surface_sha":identity(footprint(current.rows,s["to"],size))}
                       for s,cmd in zip(prefix,commands)]
                name="managed_access"
                terminal_effect={"test_or_rearm_orientation":"modifier","test_aligned_peer":"peer",
                                 "test_or_collect_capacity":"capacity_probe","test_observed_palette_entry":"feature_probe"}.get(option["first_obligation"])
                facts.update(managed_capacity_bound=True,managed_access_xy=last["to"])
                if facets["color"]=="different":
                    facts["feature_reaccess_bound"]=bool(layout.get("color_state") and
                        any(s.get("feature") for s in option["conditional_path"]) and
                        option["objective"] in ("aligned_peer","feature_then_recovery"))
                    if facts["feature_reaccess_bound"]:
                        path=option["conditional_path"]
                        ix,repair=next((i,s) for i,s in enumerate(path) if s.get("feature"))
                        station=next(v for v in layout["color_state"]["features"] if v["id"]==repair["feature"])
                        witnessed=[r for r in station["effects"] if r["from_color"]==repair["color_before"]
                                   and r["to_color"]==repair["color_after"] and r["mobile_site"]==layout["color_state"]["mobile_site"]]
                        j,recovery=next((j,s) for j,s in enumerate(path) if j>ix and (s.get("charge") or s.get("peer")))
                        facts["feature_reaccess"]={"route_key":"managed_access","effect_site":repair["to"],
                            "effect_before":witnessed[-1]["before"],"effect_after":witnessed[-1]["after"],
                            "steps_to_effect":ix+1,"recovery_site":recovery["to"],"steps_to_recovery":j+1,
                            "total_cost":len(path),"observation_ref":current.ref,"level_epoch":current.epoch,
                            "pair_ref":facts["pair_ref"],"objective":option["objective"],"release_authority":False}
                facts["routes"][name]=dict(start_xy=list(origin),end_xy=last["to"],
                    actions=[{"action_ref":cmd} for cmd in commands],observation_ref=current.ref,level_epoch=current.epoch)
                plans[name]=dict(route_key=name,steps=steps,size=list(size),footprint_sha=identity(footprint(current.rows,origin,size)),
                    role_refs=signatures,pair=pair,trial=trial,score=current.score,level_epoch=current.epoch,
                    observation_ref=current.ref,contact_in_prefix=bool(terminal_effect),goal_xy=last["to"],
                    access_phase="contact" if terminal_effect else "intermediate",physical_effect=terminal_effect,
                    obligation=option["first_obligation"],charge_order=option["charge_order"],total_cost=option["primitive_count"],
                    assumptions=option["hypotheses"],falsifiers=option["falsifiers"],entry_model=orientation,
                    composition_objective=option["objective"],first_obligation=option["next_composition"],
                    feature_witnesses=[s for s in option["conditional_path"] if s.get("feature")],
                    recovery_witnesses=[s for s in option["conditional_path"] if s.get("charge") or s.get("peer")],
                    predicted_last=last)
                break
    return facts,plans


def missing_axis_witness(current, history, position, motions, size, peer, surfaces, available, limit):
    """Measure a route conditional on one absent reverse displacement. Seal at its first unqualified input."""
    origin=position(current)
    vectors=set(motions.values())
    missing={(-dx,-dy) for dx,dy in vectors}-vectors
    rivals=[]
    for vector in sorted(missing):
        moves=[(a,v) for a,v in sorted(motions.items())]+[(None,vector)]
        queue=deque([(origin,[])])
        visited={origin}
        found=[]
        while queue:
            point,path=queue.popleft()
            if found and len(path)>=len(found[0]):break
            for action,(dx,dy) in moves:
                dest=(point[0]+dx,point[1]+dy)
                if dest in visited:continue
                patch=footprint(current.rows,dest,size)
                if patch is None:continue
                bounds=(*dest,dest[0]+size[0]-1,dest[1]+size[1]-1)
                step={"from":list(point),"to":list(dest),"action_ref":action,"surface_sha":identity(patch)}
                trail=path+[step]
                if intersects(bounds,peer):
                    found.append(trail)
                elif patch in surfaces:
                    visited.add(dest)
                    queue.append((dest,trail))
        for route in found:
            probe_idx=next((i for i,s in enumerate(route) if s["action_ref"] is None),None)
            if probe_idx is None or probe_idx>=limit:continue
            rivals.append((len(route),probe_idx,vector,route))
    if not rivals:return None
    shortest=min(r[0] for r in rivals)
    minimum=[r for r in rivals if r[0]==shortest]
    # Distinct incompatible geometric effects require independent attention.
    if len({r[2] for r in minimum})!=1:return None
    _,idx,vector,route=min(minimum,key=lambda r:r[1])
    probe=route[idx]
    exposure=tuple(probe["from"])
    candidates=[]
    for name in sorted(set(available)-set(motions)):
        positives=set()
        contradicted=False
        for before,action,after in history:
            if action!=name:continue
            p,q=position(before),position(after)
            if p is None or q is None:
                contradicted=True;break
            delta=(q[0]-p[0],q[1]-p[1])
            if delta==vector:
                positives.add(p)
            elif delta!=(0,0) or (p==exposure and footprint(before.rows,probe["to"],size)
                                  ==footprint(current.rows,probe["to"],size)):
                contradicted=True;break
        if not contradicted and exposure not in positives:
            candidates.append((len(positives),name))
    if not candidates:return None
    support=max(row[0] for row in candidates)
    equivalent=sorted(name for count,name in candidates if count==support)
    # Among observationally indistinguishable interventions choose a canonical representative.
    # No command identity supplies a direction: the alternate outcomes remain in the receipt.
    selected=equivalent[0]
    probe["action_ref"]=selected
    contrast=dict(predicted_delta=list(vector),other_outcomes=["no_translation","other_displacement","nonlocal_change"],
                  equivalent_unidentified_inputs=equivalent, prior_distinct_success_positions=support,
                  conditional_distance=shortest,remaining_budget=limit,probe_index=idx,
                  expected_if_positive=probe["to"],source_position=probe["from"],peer_bbox=list(peer))
    return route[:idx+1],contrast


def observed_selective_change(before_rows, after_rows, expected):
    def sites(rows):
        seen,_=pairs(tuple(bytes(r) for r in rows))
        match=[p for p in seen if pair_key(p)==pair_key(expected)]
        if len(match)!=1:
            return {}
        return {tuple(b):o for b,o in zip(match[0]["sites"],match[0]["orientations"])}
    before,after=sites(before_rows),sites(after_rows)
    if len(before)!=2 or after.keys()!=before.keys():
        return None
    unchanged=[box for box in before if before[box]==after[box]]
    return unchanged[0] if len(unchanged)==1 else None


