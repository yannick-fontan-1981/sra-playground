"""Measure novel control/occupancy exposure using only current-epoch public transitions."""
from collections import defaultdict
from terminal_composition import identity, registered
from agents.yf_arc3_v6.morphology_policy.geometry import footprint, pairs


def contextual_translation_exposures(history, current, commands):
    history=[(a,c,b) for a,c,b in history if a.epoch==b.epoch==current.epoch and registered(a,b)]
    if not history:
        return {}
    # A measured movement signature must participate in one coherent, contiguous
    # footprint. Divergent or detached moving groups cannot identify this test.
    shared=set(current.roles)
    for a,_,b in history:
        shared.intersection_update(a.roles,b.roles)
    tracks=defaultdict(list)
    for sig in sorted(shared):
        deltas=tuple((b.roles[sig][0]-a.roles[sig][0],b.roles[sig][1]-a.roles[sig][1]) for a,_,b in history)
        if any(d!=(0,0) for d in deltas):
            tracks[deltas].append(sig)
    if len(tracks)!=1:
        return {}
    signatures=next(iter(tracks.values()))
    boxes=[current.roles[k] for k in signatures]
    left=min(b[0] for b in boxes);top=min(b[1] for b in boxes)
    size=(max(b[2] for b in boxes)-left+1,max(b[3] for b in boxes)-top+1)
    pixels=set()
    for part in pairs(current.rows)[1]:
        sig=identity({"palette_value":part["color"],"area":part["area"],"scale":part["scale"],
                      "normalized_mask":sorted(part["normalized"])})
        if sig in signatures:
            x,y=part["bbox"][:2]
            pixels.update((x+i,y+j) for i,j in part["mask"])
    if len(pixels)!=size[0]*size[1]:
        return {}
    def position(scene):
        return min(scene.roles[s][0] for s in signatures),min(scene.roles[s][1] for s in signatures)
    origin=position(current)
    by_command={cmd:[] for cmd in commands}
    for before,cmd,after in history:
        if cmd not in by_command or not registered(after,current):continue
        p,q=position(before),position(after)
        by_command[cmd].append((before,after,p,(q[0]-p[0],q[1]-p[1])))
    eligible={}
    for cmd,trials in by_command.items():
        vectors={d for _,_,_,d in trials if d!=(0,0)}
        if len(vectors)!=1:continue
        delta,=vectors
        positives=[t for t in trials if t[3]==delta];blocked=[t for t in trials if t[3]==(0,0)]
        if not blocked or len({p for _,_,p,_ in positives})!=1:continue
        if any(p==origin for _,_,p,_ in trials):continue
        def projected(scene, p):
            return footprint(scene.rows,(p[0]+delta[0],p[1]+delta[1]),size)
        surface=projected(current,origin)
        if surface is None or any(projected(a,p)==surface for a,_,p,_ in blocked):continue
        witnesses=[(a,b) for a,b,p,_ in positives if projected(a,p)==surface]
        if not witnesses:continue
        source,outcome=witnesses[0]
        eligible[cmd]={"evidence":[source.ref,outcome.ref,current.ref],
            "observed_delta":list(delta),"predicted_origin":list(origin),
            "projected_destination":[origin[0]+delta[0],origin[1]+delta[1]],"surface_ref":identity(surface),
            "alternate_outcomes":["blocked_again","different_translation","nonlocal_effect"],
            "role_signatures":signatures,"distinct_prior_success_origins":1}
    return eligible
