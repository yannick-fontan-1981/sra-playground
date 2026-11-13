"""Offer single-command experiments between positional movement hypotheses."""
from collections import defaultdict,deque
from functools import reduce
from math import gcd

from agents.yf_arc3_v6.morphology_policy.geometry import footprint,pairs,rigid_role
from terminal_composition import identity,registered


def _single_rigid_track(history,current,parts):
    """A uniquely translating rigid footprint can precede a two-axis control model."""
    history=[(b,c,a) for b,c,a in history if registered(b,a) and registered(a,current)]
    if not history:return None
    shared=set(current.roles)
    for b,_,a in history:shared.intersection_update(b.roles,a.roles)
    tracks=defaultdict(list)
    for sig in shared:
        ds=tuple((a.roles[sig][0]-b.roles[sig][0],a.roles[sig][1]-b.roles[sig][1]) for b,_,a in history)
        if any(d!=(0,0) for d in ds):tracks[ds].append(sig)
    if len(tracks)!=1:return None
    ds,sigs=next(iter(tracks.items()));sigs=sorted(sigs)
    grouped=defaultdict(set)
    for (_,c,_),d in zip(history,ds):
        if d!=(0,0):grouped[c].add(d)
    moves={c:next(iter(v)) for c,v in grouped.items() if len(v)==1}
    if not moves:return None
    boxes=[current.roles[k] for k in sigs]
    left=min(b[0] for b in boxes);top=min(b[1] for b in boxes)
    size=(max(b[2] for b in boxes)-left+1,max(b[3] for b in boxes)-top+1)
    pixels=set()
    for p in parts:
        k=identity({"palette_value":p["color"],"area":p["area"],"scale":p["scale"],"normalized_mask":sorted(p["normalized"])})
        if k in sigs:
            x,y=p["bbox"][:2];pixels.update((x+i,y+j) for i,j in p["mask"])
    if len(pixels)!=size[0]*size[1]:return None
    offsets={s:(current.roles[s][0]-left,current.roles[s][1]-top) for s in sigs}
    def position(scene):
        if any(s not in scene.roles for s in sigs):return None
        origins={(scene.roles[s][0]-dx,scene.roles[s][1]-dy) for s,(dx,dy) in offsets.items()}
        return next(iter(origins)) if len(origins)==1 else None
    return sigs,moves,position,size


def motion_offers(history,current,admitted,observation):
    """Use only earlier public transitions and one current observed position.

    Coordinate units are inferred from displacements of the bound participant.
    A predicted obstacle must match a surface in front of an actual stationary
    command. The edge of the image is never treated as an obstruction.
    """
    limits=admitted if isinstance(admitted,dict) else {"actions":admitted}
    allowed={a if isinstance(a,str) else a["action_ref"] for a in limits["actions"]
             if isinstance(a,str) or not a.get("data")}
    budget=limits.get("remaining_actions")
    meter=limits.get("remaining_meter_steps")
    if (not allowed or (budget is not None and budget<1) or (meter is not None and meter<1)
            or (current.epoch,current.ref)!=(observation.get("level_epoch"),observation.get("observation_ref"))):
        return []
    history=[(b,a,s) for b,a,s in history if b.epoch==s.epoch==current.epoch and b.score==s.score==current.score]
    if not history:return []
    parts=pairs(current.rows)[1]
    role=rigid_role(history,current,parts) or _single_rigid_track(history,current,parts)
    if not role:return []
    roles,moves,position,size=role;origin=position(current)
    if origin is None:return []
    measured=[]
    for before,action,after in history:
        p,q=position(before),position(after)
        if p is None or q is None or not registered(before,after) or not registered(after,current):continue
        measured.append((before,action,after,p,q))
    # Repeated stationarity at a wall does not vote against the direction
    # of a prior positive movement. The participant is already independently
    # bound. A unique observed nonzero displacement supplies a rival
    # hypothesis for this experiment, never an execution permit.
    candidates=dict(moves)
    by_command=defaultdict(set)
    for _,cmd,_,p,q in measured:
        if p!=q:by_command[cmd].add((q[0]-p[0],q[1]-p[1]))
    for cmd,vectors in by_command.items():
        if cmd not in candidates and len(vectors)==1:
            candidates[cmd]=next(iter(vectors))
    reached=defaultdict(list);return_graph=defaultdict(list)
    for b,cmd,s,p,q in measured:
        if cmd not in moves:continue
        expected=(p[0]+moves[cmd][0],p[1]+moves[cmd][1])
        if expected!=q:continue
        patch=footprint(b.rows,q,size)
        if patch is not None:
            reached[patch].append((p,q,b.ref,s.ref))
            if cmd in allowed:return_graph[p].append((q,b,s,cmd))
    passing={k for k,v in reached.items() if len({r[0] for r in v})>=2}
    if not passing:return []
    protected={tuple(v) for v in limits.get("preserve_cells",())}
    def route_home(start):
        # Only directed, actually observed local transitions count. A reverse
        # command's existence alone never establishes reversibility.
        nodes=deque([(start,[])]);seen={start}
        while nodes:
            p,refs=nodes.popleft()
            if p==origin:return refs
            for q,b,s,cmd in return_graph[p]:
                if q in seen:continue
                if q!=origin and footprint(current.rows,q,size)!=footprint(b.rows,q,size):continue
                if q==origin and tuple(position(s) or ())!=origin:continue
                seen.add(q);nodes.append((q,refs+[(cmd,b.ref,s.ref)]))
        return None
    offers=[]
    for cmd,(dx,dy) in sorted(candidates.items()):
        if cmd not in allowed or (dx==0)==(dy==0):continue
        axis=0 if dx else 1;fixed=abs((dx,dy)[axis])
        # Only measured translations, not teleports, determine the sampling
        # lattice. Distinct occupied positions still constrain its phase.
        strides=[abs(d[axis]) for d in candidates.values() if d[axis]]
        step=reduce(gcd,strides)
        if step<=0 or fixed%step:continue
        direction=(step*(1 if dx>0 else -1),0) if dx else (0,step*(1 if dy>0 else -1))
        failures=defaultdict(list);trials=[]
        for b,a,s,p,q in measured:
            if a!=cmd:continue
            trials.append((b,s,p,q))
            if p==q:
                ahead=p[0]+direction[0],p[1]+direction[1]
                surface=footprint(b.rows,ahead,size)
                if surface is not None:failures[surface].append((p,ahead,b.ref,s.ref))
        blocked=set(failures)-passing
        if not blocked:continue
        def ray(scene,p):
            swept=[];patches=set()
            while True:
                nxt=(p[0]+(len(swept)+1)*direction[0],p[1]+(len(swept)+1)*direction[1])
                patch=footprint(scene.rows,nxt,size)
                if patch is None:return None
                if patch in blocked:return swept,nxt,patch,patches
                if patch not in passing or patch in failures:return None
                swept.append(nxt);patches.add(patch)
        witnesses=[];already_decided=False
        for b,s,p,q in trials:
            path=ray(b,p)
            if path is None:continue
            positions=path[0]
            fixed_end=positions[min(len(positions),fixed//step)-1] if positions else p
            slide_end=positions[-1] if positions else p
            if q!=fixed_end or q!=slide_end:
                already_decided=True;break
            if q!=p and len(positions)==fixed//step:
                witnesses.append({"before":b.ref,"after":s.ref,"origin":list(p),"arrival":list(q),
                                  "obstacle":list(path[1]),"gap_lattice_steps":len(positions)})
        if not witnesses or already_decided:continue
        path=ray(current,origin)
        if path is None or len(path[0])<=fixed//step:continue
        swept,wall,patch,passage_patches=path
        fixed_end=swept[fixed//step-1];slide_end=swept[-1]
        if any((x+i,y+j) in protected for x,y in swept for i in range(size[0]) for j in range(size[1])):continue
        returns=[route_home(p) for p in (fixed_end,slide_end)]
        home=max(map(len,returns)) if all(x is not None for x in returns) else None
        proof=witnesses[-1]
        wall_record=next((r for r in failures[patch] if r[1]==wall),failures[patch][-1])
        refs=[current.ref,proof["before"],proof["after"],wall_record[2],wall_record[3]]
        for texture in sorted(passage_patches,key=identity):
            refs.extend(reached[texture][0][2:]);refs.extend(reached[texture][-1][2:])
        risks=["A matching surface may have a different passage condition at this occurrence.",
               "An intermediate site can change the participant, the meter or the board.",
               "A third position or a changed reference frame leaves both predictions unresolved."]
        if home is None:risks.append("A directed return to this origin is not witnessed for both predicted outcomes.")
        if meter is not None:risks.append(f"The experiment spends one of {meter} measured moves before depletion.")
        offers.append({"action":{"action_ref":cmd},
            "predictions":{"motion.fixed_displacement":list(fixed_end),"motion.stop_before_obstacle":list(slide_end)},
            "relations":[["controlled_participant","has_measured_footprint",list(size)],
                         ["shared_witness","ended_one_step_before",proof["obstacle"]],
                         ["current_ray","first_conditionally_blocked_site",list(wall)],
                         ["fixed_displacement","predicts_position",list(fixed_end)],
                         ["stop_before_obstacle","predicts_position",list(slide_end)]],
            "evidence":list(dict.fromkeys(refs)),"risks":risks,"return_steps":home,
            "question":"Le même contrôle parcourt-il la distance déjà observée, ou continue-t-il jusqu’au prochain obstacle ?",
            "role_refs":list(roles),"origin":list(origin),"observation_ref":current.ref,"level_epoch":current.epoch,
            "shared_witness":proof,"current_gap_lattice_steps":len(swept),"fixed_lattice_steps":fixed//step,
            "blocking_evidence_basis":"same_occurrence" if wall_record[1]==wall else "same_measured_surface",
            "return_evidence":returns,"remaining_actions_after_probe":budget-1 if budget is not None else None,
            "remaining_meter_after_probe":meter-1 if meter is not None else None,
            "cost_actions":1,"release_authority":False})
    return offers
