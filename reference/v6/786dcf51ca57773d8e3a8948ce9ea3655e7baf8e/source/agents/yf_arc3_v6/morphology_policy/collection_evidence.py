"""Associate a measured meter increase with a local, subsequently uncovered occurrence."""
from copy import deepcopy

from agents.yf_arc3_v6.morphology_policy.observed_meter import strips, single_line_supports


def intersects(a,b):
    return a[0]<=b[2] and b[0]<=a[2] and a[1]<=b[3] and b[1]<=a[3]


def encloses(outer,inner):
    return outer[0]<=inner[0]<=inner[2]<=outer[2] and outer[1]<=inner[1]<=inner[3]<=outer[3]


def participant(obs, refs):
    visible={r["signature"]:r for r in obs["entities"] if not r["identity_ambiguous"]}
    if not refs or not all(r in visible for r in refs):
        return None
    boxes=[visible[r]["bbox"] for r in refs]
    return min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes)


def anchored(before,after):
    exact=lambda o:{(r["signature"],*r["bbox"]) for r in o["entities"] if not r["identity_ambiguous"]}
    stable=sorted({(r[1],r[2]) for r in exact(before)&exact(after)})
    if len(stable)<3:return False
    a,b,*rest=stable
    return any((b[0]-a[0])*(y-a[1])!=(b[1]-a[1])*(x-a[0]) for x,y in rest)


class CollectionEvidence:
    def __init__(self):
        self.pending={}
        self.history={}

    def apply_event(self,event):
        uid=event["id"]
        if uid in self.history:return
        self.history[uid]=deepcopy(event)
        if event["kind"]=="gain_on_entry":
            self.pending[uid]=deepcopy(event)
        if "entry_id" in event:
            self.pending.pop(event["entry_id"],None)

    def retained_state(self):
        return {"events":[deepcopy(v) for v in self.history.values()]}

    def evidence_for(self,signature):
        confirmed=[e for e in self.history.values() if e["kind"]=="disappearance_confirmed" and e["signature"]==signature]
        rivals=[e for e in self.history.values() if e["kind"]=="occurrence_persisted" and e["signature"]==signature]
        sites={(e["epoch"],tuple(e["bbox"])) for e in confirmed}
        return {"signature":signature,"role":"observed_candidate_refill" if sites else "unconfirmed",
                "independent_sites":len(sites),"confirmed":[e["id"] for e in confirmed],
                "counterexamples":[e["id"] for e in rivals],
                "pending":[e["id"] for e in self.pending.values() if e["signature"]==signature],
                "scope":"current location/state must be revalidated; compatible appearance alone does not prove a gain"}

    def observe(self,before,after,first,second,command,*,meter_before,mover):
        events=[]
        epoch=before["level_epoch"]
        ref=after["observation_ref"]
        compatible=epoch==after["level_epoch"] and before["levels_completed"]==after["levels_completed"]
        if not compatible:
            for key,p in list(self.pending.items()):
                events.append(dict(kind="scope_ended",id=ref+"/scope/"+key,entry_id=key,epoch=p["epoch"]))
        else:
            control=mover or {}
            refs=control.get("role_refs",[])
            old=participant(before,refs);new=participant(after,refs)
            cmd=command["action_ref"] if isinstance(command,dict) else command
            directions=control.get("moves",{})
            declared=directions.get(cmd)
            delta=(new[0]-old[0],new[1]-old[1]) if old and new else None
            measured={tuple(v) for v in directions.values()}
            lattice=measured|{(-x,-y) for x,y in measured}
            # A retrospectively observed adjacent arrival need not have had
            # a command prediction. Require the known participant to translate
            # rigidly by exactly one measured lattice step. Never promote this
            # to authorization to repeat an unidentified command.
            motion_ok=delta is not None and (tuple(declared)==delta if declared is not None else delta in lattice)
            local=bool(old and new and delta!=(0,0) and motion_ok and
                (new[2]-old[2],new[3]-old[3])==delta and anchored(before,after))
            for key,p in list(self.pending.items()):
                if p["epoch"]!=epoch:continue
                # Use the same registered participant that entered, even if
                # the current command is unrelated to the original selected probe.
                old_pending=participant(before,p["role_refs"]);new_pending=participant(after,p["role_refs"])
                if not new_pending or intersects(new_pending,p["bbox"]):continue
                if not local or not old_pending or not intersects(old_pending,p["bbox"]) or set(refs)!=set(p["role_refs"]):
                    kind="ambiguous_departure"
                else:
                    pixels=[second[y][x] for x,y in p["occupied_pixels"]]
                    kind="disappearance_confirmed" if all(v!=p["palette_value"] for v in pixels) else "occurrence_persisted"
                events.append(dict(kind=kind,id=ref+"/"+kind+"/"+key,entry_id=key,epoch=epoch,
                    bbox=p["bbox"],signature=p["signature"],uncovered_observation=ref,meter_change=p["meter_after"]-p["meter_before"]))
            if meter_before and meter_before.get("observation_ref")==before["observation_ref"] and meter_before.get("level_epoch")==epoch:
                strip=tuple(meter_before["measured_strip"]);axis,line,color,edge,anchor=strip
                adjacent=(axis,line+1,color,edge,anchor)
                # The paired meter is measured before and after this action.
                pre=strips(first);post=strips(second)
                units=meter_before["current_units"];gain=post.get(strip,0)
                paired=pre.get(strip,0)==pre.get(adjacent,0)==units and post.get(adjacent,0)==gain
                single=(pre.get(strip,0)==units and strip in single_line_supports(first,pre)
                        and strip in single_line_supports(second,post))
                if (paired or single) and gain>units:
                    contact=control.get("contact_cell_bbox")
                    if not (contact and control.get("observation_ref")==before["observation_ref"] and control.get("level_epoch")==epoch
                            and new and encloses(contact,new) and old and not encloses(contact,old)):
                        contact=None
                    sites=[] if not local else [e for e in before["entities"] if e["palette_value"]==color
                        and (encloses(new,e["bbox"]) or contact and encloses(contact,e["bbox"])) and not intersects(old,e["bbox"])]
                    # A local gain association requires unchanged world pixels outside
                    # the mover, candidate occurrence and the measured meter strip.
                    if len(sites)==1:
                        regions=[old,new,sites[0]["bbox"]];meter_lines={line,line+1} if paired else {line}
                        changed_elsewhere=any(first[y][x]!=second[y][x]
                            and (y if axis=="x" else x) not in meter_lines
                            and not any(l<=x<=r and t<=y<=b for l,t,r,b in regions)
                            for y in range(len(first)) for x in range(len(first[0])))
                        if changed_elsewhere:sites=[]
                    ambiguous=not local or len(sites)!=1 or units<=meter_before["loss_per_step"]
                    if ambiguous:
                        events.append(dict(kind="gain_unassigned",id=ref+"/gain_unassigned",epoch=epoch,
                            reason="unattested_or_nonlocal_arrival" if not local else
                                   "meter_depletion_competes" if units<=meter_before["loss_per_step"] else "candidate_count_not_one",
                            candidates=len(sites),meter_before=units,meter_after=gain))
                    else:
                        site=sites[0];l,t,r,b=site["bbox"]
                        pixels=[[x,y] for y in range(t,b+1) for x in range(l,r+1)
                                if first[y][x]==color]
                        events.append(dict(kind="gain_on_entry",id=ref+"/gain_on_entry",epoch=epoch,
                            bbox=list(site["bbox"]),signature=site["signature"],palette_value=color,
                            occupied_pixels=pixels,meter_before=units,meter_after=gain,measured_strip=list(strip),
                            role_refs=list(refs),before=before["observation_ref"],after=ref,delta=list(delta),
                            motion_basis="bound_command_prediction" if declared is not None else "observed_single_lattice_step",
                            from_xy=list(old[:2]),to_xy=list(new[:2]),other_explanations=["occlusion","coincident_reward"]))
        for event in events:self.apply_event(event)
        return events
