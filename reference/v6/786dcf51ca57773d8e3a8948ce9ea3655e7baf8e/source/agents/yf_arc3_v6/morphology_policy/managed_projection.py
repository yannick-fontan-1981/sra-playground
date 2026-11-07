"""Project the finite positions of an already measured moving footprint.

No full game state, level definition or game name is an input. Contact roles
remain conditional on public evidence even when their textures are identical.
"""
from collections import deque
from terminal_composition import identity


def footprint(rows,p,size):
    x,y=p;w,h=size
    if x<0 or y<0 or y+h>len(rows) or x+w>len(rows[0]):return None
    return tuple(v for row in rows[y:y+h] for v in row[x:x+w])


def project_layout(current,pair,origin,size,motions,surfaces,unresolved_edges,marks,stations,
                   station_method,role_refs,available,collection_evidence,observation,*,weak_moves=None,feature_sites=None):
    if (not pair or not motions or not origin or not station_method or observation["level_epoch"]!=current.epoch or
            observation["observation_ref"]!=current.ref):
        return None,None
    origin=tuple(origin);size=tuple(size)
    sites=pair.get("sites",[]);scales=pair.get("scales",[])
    station_list=list(stations.values()) if isinstance(stations,dict) else list(stations)
    ref=station_method.get("after")
    if not ref or not station_method.get("site_surface") or tuple(station_method.get("size",()))!=size:
        return None,None
    if set(station_method.get("role_refs",()))!=set(role_refs):
        return None,None
    peer_indices=[i for i,s in enumerate(scales) if s==station_method.get("peer_scale")]
    if len(sites)!=2 or len(scales)!=2 or len(peer_indices)!=1:return None,None
    peer_idx=peer_indices[0]
    if sorted(scales)!=sorted(station_method.get("observed_scales",())):return None,None
    peer=tuple(sites[peer_idx]);pair_id=identity(sorted(sites))
    residual=pair["quarter_turns"] if peer_idx==0 else -pair["quarter_turns"]%4
    entries=[e for s in station_list for e in s.get("entries",[]) if s.get("site_surface")==station_method["site_surface"]]
    if any(not e.get("peer_preserved") for e in entries):return None,None
    deltas={e.get("delta") for e in entries}
    if len(deltas)>1 or 0 in deltas or None in deltas:return None,None
    if entries:
        witnessed=sorted({e["after"] for e in entries})
        turn=next(iter(deltas));status="current_repeat" if len(witnessed)>=2 else "current_witness"
    else:
        turn=station_method.get("delta");status="revalidated_transfer_hypothesis";witnessed=[ref]
    if type(turn) is not int or turn%4==0:return None,None
    orientation={"level_epoch":current.epoch,"observation_ref":current.ref,"modulus":4,"entry_delta":turn,
                 "residual":residual,"status":status,"evidence":[current.ref,*witnessed],
                 "basis":"peer_to_mobile_measured_quarter_turns","pair_ref":pair_id}
    commands={item if isinstance(item,str) else item["action_ref"] for item in available
              if isinstance(item,str) or not item.get("data")}
    moves={cmd:tuple(d) for cmd,d in motions.items() if cmd in commands and tuple(d)!=(0,0)}
    if not moves:return None,None
    vectors=set(moves.values())
    opposite={(-x,-y) for x,y in vectors}-vectors
    guesses=[]
    for vector in sorted(opposite):
        rivals=sorted(commands-set(moves))
        if weak_moves is not None:
            rivals=[c for c in rivals if not weak_moves.get(c) or tuple(weak_moves[c])==vector]
        if rivals:guesses.append({"delta":list(vector),"test_commands":rivals,"evidence":[current.ref]})
    # Flood the finite displacement lattice geometrically. Occupancy is tested
    # per position below, so this cannot fabricate passable paths through walls.
    possible_vectors=vectors|{tuple(h["delta"]) for h in guesses}
    queue=deque([origin]);lattice={origin}
    while queue:
        x,y=queue.popleft()
        for dx,dy in possible_vectors:
            p=x+dx,y+dy
            if p not in lattice and footprint(current.rows,p,size) is not None:
                lattice.add(p);queue.append(p)
    signatures={tuple(e["bbox"]):e["signature"] for e in observation["entities"]}
    charge_shapes={}
    for item in marks:
        box=tuple(item["bbox"] if isinstance(item,dict) else item)
        sig=(item.get("signature") if isinstance(item,dict) else None) or signatures.get(box)
        if sig:charge_shapes[box]=sig
    cells={origin};modifiers={};charges={};peer_cells=[];conditional_rim=set();features={}
    for p in sorted(lattice):
        patch=footprint(current.rows,p,size)
        x,y=p;w,h=size;center=(2*x+w-1,2*y+h-1)
        at_mod=identity(patch)==station_method["site_surface"]
        remembered=[s for s in station_list if tuple(s.get("site",()))==p and tuple(s.get("size",()))==size
                    and s["site_surface"]==station_method["site_surface"]]
        if p==origin and any(s["footprint"]==identity(patch) for s in remembered):at_mod=True
        at_peer=center==(peer[0]+peer[2],peer[1]+peer[3])
        # The actionable candidate is the geometric center of a unique local
        # mark. Merely touching the frame from a neighbouring footprint does
        # not count as reaching the hypothesized composition.
        in_marks=[(box,sig) for box,sig in charge_shapes.items() if center==(box[0]+box[2],box[1]+box[3])
                  and x<=box[0]<=box[2]<x+w and y<=box[1]<=box[3]<y+h]
        color_site=(feature_sites or {}).get(p)
        if color_site:
            if at_mod or at_peer or in_marks:return None,None
            features[color_site["id"]]=color_site
        if len(in_marks)>1 or (at_mod and (at_peer or in_marks)) or (at_peer and in_marks):return None,None
        # A framed contact can alter only the few leading pixels of an
        # otherwise measured access surface. Keep that crossing provisional:
        # all footprint pixels outside this exact frame must match an observed
        # walk surface. An unrelated wall beside the frame fails this test.
        outside=[(j*w+i) for j in range(h) for i in range(w)
                 if not(peer[0]<=x+i<=peer[2] and peer[1]<=y+j<=peer[3])]
        rim=(not at_peer and 0<len(outside)<w*h and patch not in surfaces and
             any(all(patch[i]==surf[i] for i in outside) for surf in surfaces))
        if rim:conditional_rim.add(p)
        if patch in surfaces or at_peer or at_mod or in_marks or rim or color_site:cells.add(p)
        if at_peer:peer_cells.append(list(p))
        if at_mod:
            ident="modifier:"+identity([current.epoch,p,station_method["site_surface"]])
            modifiers[ident]={"id":ident,"sites":[list(p)],"evidence":[current.ref,*witnessed],
                             "status":status,"signature":station_method["site_surface"]}
        for box,sig in in_marks:
            saved=collection_evidence.evidence_for(sig) if collection_evidence is not None else {}
            confirmed=list(saved.get("confirmed",[]));counter=list(saved.get("counterexamples",[]))
            ident="charge:"+identity([current.epoch,box,sig])
            charges[ident]={"id":ident,"sites":[list(p)],"bbox":list(box),"signature":sig,
                "status":"observed" if confirmed and not counter else "hypothesis",
                "evidence":[current.ref,*confirmed],"counterexamples":counter}
    if not peer_cells or not modifiers:return None,None
    peer_id="peer:"+identity([current.epoch,peer,pair_id])
    bad=[]
    for (p,cmd,q,patch),witness in unresolved_edges.items():
        if p in cells and q in cells and footprint(current.rows,q,size)==patch:
            bad.append({"from":list(p),"to":list(q),"evidence":[witness["before"],witness["after"]]})
    existing={(tuple(x["from"]),tuple(x["to"])) for x in bad}
    for q in sorted(conditional_rim):
        for dx,dy in possible_vectors:
            p=q[0]-dx,q[1]-dy
            if p in cells and (p,q) not in existing:
                bad.append({"from":list(p),"to":list(q),"kind":"partially_occluded_peer_approach",
                            "evidence":[current.ref,ref]})
    layout={"level_epoch":current.epoch,"observation_ref":current.ref,"start":list(origin),"cells":[list(p) for p in sorted(cells)],
        "moves":{k:list(v) for k,v in moves.items()},"speculative_moves":guesses,
        "modifiers":list(modifiers.values()),"charges":list(charges.values()),"edge_exclusions":[],"uncertain_edges":bad,
        "peers":[{"id":peer_id,"sites":peer_cells,"status":"revalidated_shape_correspondence","evidence":[current.ref,ref]}],
        "geometry":{"size":list(size),"role_refs":list(role_refs),"pair_ref":pair_id,"peer_bbox":list(peer),
                    "positions_examined":len(lattice),"eligible_positions":len(cells)}}
    pigments=pair.get("palette_values",())
    if len(pigments)==2 and features:
        layout["color_state"]={"initial":pigments[1-peer_idx],"wanted":pigments[peer_idx],
            "mobile_site":pair["sites"][1-peer_idx],"features":list(features.values())}
    return layout,orientation
