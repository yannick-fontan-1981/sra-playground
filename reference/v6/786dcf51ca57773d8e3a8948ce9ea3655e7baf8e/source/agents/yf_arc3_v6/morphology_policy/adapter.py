"""Bind declarative composition probes to specific publicly measured movements."""
from terminal_composition import identity
from .geometry import footprint, measure_routes, observed_selective_change, pair_key
from .policy import MorphologyPolicy
from target_tree import CompositionTargetTree
from .observed_meter import ObservedMeter
from .collection_evidence import CollectionEvidence
from .rearm_evidence import entry, departure, orientation


class MorphologyAdapter:
    def __init__(self):
        self.policy=MorphologyPolicy()
        self.target_tree=CompositionTargetTree()
        self.feature_trials={}
        self.meter=ObservedMeter()
        self.collection=CollectionEvidence()
        self.station_method=None
        self.entry_method=None
        self.entry_access_return=None
        self.contacts={}
        self.tried=set()
        self.last=None

    def propose(self, goal_memory, observation, rows, inputs, remaining):
        current=goal_memory.snapshot(observation,rows)
        available={a["action_ref"] for a in inputs if not a.get("data")}
        self.meter.observe(current.epoch,current.ref,current.rows,primitive_index=observation.get("revision"))
        forecast=self.meter.forecast()
        facts, plans=measure_routes(goal_memory.episode,current,min(16,remaining),self.contacts,self.tried,available,
                                   action_budget=remaining,meter_forecast=forecast,station_method=self.station_method,
                                   collection_evidence=self.collection,observation=observation,feature_trials=self.feature_trials)
        from .continuation import resume
        resumed=resume(self.entry_access_return,current,observation,facts,remaining,available,forecast)
        if resumed:plans["entry_probe"]=resumed
        if not facts.get("control_attested") and self.entry_method:
            from .entry_rebind import approach
            approach_plan=approach(self.entry_method,goal_memory.episode,current,observation,facts,remaining,
                                   available,forecast,self.collection)
            if approach_plan:plans["entry_rebind"]=approach_plan
        for name in tuple(facts["routes"]):
            if any(step["action_ref"] not in available for step in plans[name]["steps"]):
                del facts["routes"][name]
        facts["meter_forecast"]=forecast
        extension=self.target_tree.extend_target(facts,plans,self.contacts,self.feature_trials,self.station_method,remaining)
        facts["extension_route"]=extension["first_route_key"] if extension and extension["currently_bound"] else None
        facts["extension_kind"]=extension["proposed"]["kind"] if extension else None
        decision=self.policy.evaluate(facts)
        decision["target_extension"]=extension
        decision["measured_facts"]=facts
        self.last=decision
        if not decision["route_key"]:
            return None
        plan=plans[decision["route_key"]]
        decision["access_phase"]=plan.get("access_phase","probe_access")
        decision["contact_in_prefix"]=plan.get("contact_in_prefix",False)
        plan["facts"]=facts
        actions=facts["routes"][plan["route_key"]]["actions"]
        steps=[dict(action=a, expected_after=None if i+1==len(actions) and plan.get("last_effect_unknown",True) else {"position":s["to"]})
               for i,(a,s) in enumerate(zip(actions,plan["steps"],strict=True))]
        prediction=plan.get("known_effectful_site",{}).get("hypothesis")
        if prediction and plan.get("contact_in_prefix"):
            steps[-1]["expected_after"]=prediction
        ref="composition:morphology:"+identity([facts["pair_ref"],decision["composition"]])
        evidence=[current.ref, *decision["projection_refs"], *decision["principle_refs"],*plan.get("evidence",())]
        premises={"correspondence_current":True,"bound_access_current":True}
        comp=dict(id=ref,role=decision["role"],observed=False,properties={"hypothesis":decision["composition"],
                  "feature_residuals":facts.get("feature_residuals"),"preserve_features":facts.get("preserve_features",[]),
                  "route_key":plan["route_key"],"falsifiers":decision["falsifiers"]},things=plan["role_refs"],
                  relations=["contributes_to:G_official_completion"],open_question=decision["reason"])
        return dict(status="proposed",kind="morphology_probe",proposal_id=plan["trial"],actions=actions,steps=steps,
                    facts=premises,compositions=[comp],morphology_plan=plan,morphology=decision,
                    question={"reason":decision["reason"],"hypothesis_refs":[ref],"falsifiers":decision["falsifiers"]},
                    route_refs=evidence,binding={"observation_ref":current.ref,"level_epoch":current.epoch,
                                                "levels_completed":current.score},
                    bundle_template=dict(operation_key=decision["operation"],composition_ref=ref,
                        objective_ref="G_official_completion",preserve_refs=[],purpose=decision["reason"],actions=actions,
                        preconditions=premises,evidence=evidence,outcome_guard={"path":["value"],"contains":ref}))

    def before(self,proposal,index,public,live):
        plan=proposal["morphology_plan"]
        step=plan["steps"][index]
        ok=(public.level==plan["level_epoch"] and public.levels_completed==plan["score"]
            and (index!=0 or live["observation_ref"]==plan["observation_ref"])
            and step["action_ref"] in public.available_action_refs
            and proposal["actions"][index]=={"action_ref":step["action_ref"]}
            and identity(footprint(public.frame_rows,step["from"],plan["size"]))==plan["footprint_sha"]
            and identity(footprint(public.frame_rows,step["to"],plan["size"]))==step["surface_sha"])
        if plan.get("partial_correspondence"):
            support=plan["partial_correspondence"]
            ok=ok and support["after"]==plan["observation_ref"] and support["epoch"]==public.level
            ok=ok and all(public.frame_rows[y][x]==value for x,y,value in support["visible_pixels"])
        if plan.get("route_key")=="entry_probe":
            from .continuation import contour
            retreat=plan["exit_candidate"]
            ok=ok and (contour(public.frame_rows,step["to"],plan["size"],step["from"])==plan["untested_contour"] and
                       identity(footprint(public.frame_rows,retreat["to"],plan["size"]))==retreat["surface_sha"] and
                       retreat["action_ref"] in public.available_action_refs)
        return {"admitted":ok,"reason":"current_geometry_bound" if ok else "geometric_premise_changed"}

    def after(self,proposal,index,public):
        plan=proposal["morphology_plan"]
        predicted=plan.get("known_effectful_site",{}).get("hypothesis")
        if (predicted and plan.get("contact_in_prefix") and index+1==len(plan["steps"])
                and public.level==plan["level_epoch"] and public.levels_completed==plan["score"]):
            contact=self.contacts.get((public.level,pair_key(plan["pair"])),{})
            pose=orientation(public.frame_rows,pair_key(plan["pair"]),contact["peer"]) if "peer" in contact else None
            matched=None if pose is None else (pose["peer_pose"]==predicted["expected_peer_pose"] and
                                                pose["residual"]==predicted["expected_residual"])
            return {"matched":matched,"seal_prefix":True,"reason":"compare_selective_entry_prediction",
                    "measured_pose":pose}
        if (public.level!=plan["level_epoch"] or public.levels_completed!=plan["score"] or
                public.state in ("GAME_OVER","WIN") or (index+1==len(plan["steps"]) and plan.get("last_effect_unknown",True))):
            return {"matched":None,"seal_prefix":True,"reason":"measure_terminal_contact_or_boundary"}
        matched=identity(footprint(public.frame_rows,plan["steps"][index]["to"],plan["size"]))==plan["footprint_sha"]
        return {"matched":matched,"seal_prefix":not matched,"reason":"compare_predicted_position"}

    def apply_event(self,event):
        if event.get("kind")=="entry_access_return":
            self.entry_access_return=event
            return
        if "feature_effect" in event:
            if not hasattr(self,"feature_trials"):self.feature_trials={}
            self.feature_trials[event["observation_ref"]]=event["feature_effect"]
        if event.get("kind")=="departure":
            station=self.contacts[(event["epoch"],event["pair_key"])]["stations"][event["station_key"]]
            if not any(x["after"]==event["after"] for x in station["departures"]):
                station["departures"].append(event)
            return
        self.tried.add(event["trial"])
        key=event["epoch"],event["pair_key"]
        if event["unchanged_peer"] is not None:
            self.contacts.setdefault(key,{}).update(peer=tuple(event["unchanged_peer"]),observed=event["observation_ref"])
        row=event.get("station_entry")
        if row and key in self.contacts:
            sites=self.contacts[key].setdefault("stations",{})
            identity_key=identity([row["site"],row["site_surface"],row["size"]])
            if row["delta"] or identity_key in sites:
                station=sites.setdefault(identity_key,{**{k:row[k] for k in
                    ("site","site_surface","size","footprint","role_refs")},"entries":[],"departures":[]})
                if not any(x["after"]==row["after"] for x in station["entries"]):
                    station["entries"].append(row)

    def observe_departures(self,before,after,first,second,command):
        events=departure(self.contacts,before,after,first,second,command)
        for row in events:self.apply_event(row)
        return events

    def record(self,proposal,index,before,after,observation_ref,before_ref=None):
        plan=proposal["morphology_plan"]
        if (index+1==len(plan["steps"]) and plan.get("route_key")=="entry_rebind" and plan.get("deferred_probe")
                and before.level==after.level==plan["level_epoch"] and before.levels_completed==after.levels_completed
                and identity(footprint(after.frame_rows,plan["steps"][-1]["to"],plan["size"]))==plan["footprint_sha"]):
            event={"kind":"entry_access_return","before":plan["observation_ref"],"after":observation_ref,
                   "return_ref":"return:"+plan["trial"]+":"+observation_ref,"plan":plan["deferred_probe"],
                   "observation_ref":observation_ref,"epoch":after.level,"trial":plan["trial"]}
            self.apply_event(event)
            return event
        if index+1!=len(plan["steps"]) or plan.get("access_phase")=="approach":
            return None
        unchanged=None
        if before.level==after.level and plan.get("physical_effect",plan["route_key"])=="modifier":
            unchanged=observed_selective_change(before.frame_rows,after.frame_rows,plan["pair"])
        event=dict(trial=plan["trial"],epoch=before.level,pair_key=pair_key(plan["pair"]),unchanged_peer=unchanged,
                   before=before.frame_hash,after=after.frame_hash,observation_ref=observation_ref,
                   contact_action=proposal["actions"][index])
        if before.level==after.level and plan.get("physical_effect",plan["route_key"])=="modifier":
            event["station_entry"]=entry(plan,before,after,observation_ref,unchanged,
                                        self.contacts.get((before.level,event["pair_key"])),before_ref)
        if plan.get("physical_effect",plan["route_key"])=="feature_probe" and plan.get("contact_in_prefix"):
            from .orthogonal_features import compare_features
            from .geometry import pairs
            old,_=pairs(tuple(bytes(r) for r in before.frame_rows));new,_=pairs(tuple(bytes(r) for r in after.frame_rows))
            site=plan["steps"][-1]["to"]
            arrived=(before.level==after.level and before.levels_completed==after.levels_completed and
                     identity(footprint(after.frame_rows,site,plan["size"]))==plan["footprint_sha"])
            delta=compare_features(old[0] if len(old)==1 else None,new[0] if len(new)==1 else None)
            event["feature_effect"]={"arrived":arrived,"site":site,"outcome":delta,"epoch":before.level,
                "pair_ref":plan["facts"]["pair_ref"],"site_surface":plan["steps"][-1]["surface_sha"],"before_ref":before_ref,
                                     "after_ref":observation_ref,"scope":"conditional_contact_witness"}
            if arrived and delta.get("color_only_at_one_site"):
                event["unchanged_peer"]=next(r["bbox"] for r in delta["sites"] if not r["changed"])
        self.apply_event(event)
        return event
