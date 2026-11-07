"""One scoped question and its observed return. Execution permits live in SRC."""
from hashlib import sha256
from memory import pack


class AttentionMemory:
    def __init__(self, memory=None, episode=None):
        self.memory=memory
        self.episode=episode
        self.item=None
        self.composition=None
        if memory is not None:
            try:self.item=memory.get(episode,"attention")["value"]
            except KeyError:pass
            try:self.composition=memory.get(episode,"attention_composition")["value"]
            except KeyError:pass

    def _save(self,item,obs):
        if self.memory is not None:
            self.memory.put(self.episode,"attention",item,evidence=obs["observation_ref"],revision=obs["revision"])
        self.item=item
        return item

    def open(self,question,obs):
        if question["observation_ref"]!=obs["observation_ref"] or not question.get("expected_motion"):
            return None
        if self.item and self.item["status"]=="pending":
            return self.item if self.matches(question,obs) else None
        scope=[obs["level_epoch"],obs["observation_ref"],question["pair_ref"],question["action_ref"],question["experiment"]]
        return self._save({"id":sha256(pack(scope).encode()).hexdigest()[:20],"status":"pending",
            "level_epoch":scope[0],"opened_at":scope[1],"parent":"alignment_of_homologous_patterns",
            "pair_ref":scope[2],"action_ref":scope[3],"experiment":scope[4],
            "question":question["objective"],"why_now":"independent_origin_with_unbound_return",
            "expected_motion":question["expected_motion"],"evidence":question["evidence"],
            "release_authority":False},obs)

    def matches(self,question,obs):
        item=self.item
        return bool(item and item["status"]=="pending" and item["level_epoch"]==obs["level_epoch"]
            and item["opened_at"]==obs["observation_ref"]==question["observation_ref"]
            and item["action_ref"]==question["action_ref"] and item["pair_ref"]==question["pair_ref"]
            and item["experiment"]==question["experiment"] and item["expected_motion"]==question.get("expected_motion"))

    def revalidate(self,obs):
        if self.item and self.item["status"]=="pending" and (
                self.item["level_epoch"]!=obs["level_epoch"] or self.item["opened_at"]!=obs["observation_ref"]):
            self._save(dict(self.item,status="expired",reason="scope_or_observation_changed"),obs)

    def observe(self,before,after,command,focus_id):
        item=self.item
        if not item or item["status"]!="pending":return None
        if (item["level_epoch"]!=after["level_epoch"] or before["levels_completed"]!=after["levels_completed"] or
                after["state"] in {"WIN","GAME_OVER"}):
            status="boundary"
        elif (item["opened_at"]!=before["observation_ref"] or command!={"action_ref":item["action_ref"]} or
                focus_id!=item["id"]):
            status="superseded"
        else:
            positions=lambda obs:{e["signature"]:e["bbox"] for e in obs["entities"] if not e["identity_ambiguous"]}
            old,new=positions(before),positions(after)
            anchors={tuple(box[:2]) for key,box in old.items() if new.get(key)==box}
            anchors=sorted(anchors)
            aligned=False
            if len(anchors)>=3:
                a,b=anchors[:2]
                aligned=any((b[0]-a[0])*(y-a[1])!=(b[1]-a[1])*(x-a[0]) for x,y in anchors[2:])
            status="matched"
            for signature,delta in item["expected_motion"].items():
                if not aligned or signature not in old or signature not in new:
                    status="unobserved";break
                if [v-u for u,v in zip(old[signature],new[signature],strict=True)]!=delta*2:
                    status="contradicted";break
        return self._save(dict(item,status=status,returned_at=after["observation_ref"]),after)

    def take_parent_return(self,obs):
        item=self.item
        if not item or item["status"] not in {"matched","contradicted","unobserved"}:return None
        current=(item["level_epoch"]==obs["level_epoch"] and item["returned_at"]==obs["observation_ref"])
        self._save(dict(item,status="returned" if current else "expired",result=item["status"]),obs)
        return item if current else None

    def close_pending(self,obs,reason):
        if self.item and self.item["status"]=="pending":
            return self._save(dict(self.item,status="interrupted",reason=reason),obs)


    def _save_composition(self,item,obs):
        if self.memory is not None:
            self.memory.put(self.episode,"attention_composition",item,evidence=obs["observation_ref"],revision=obs["revision"])
        self.composition=item
        return item

    def composition_for(self,owner,obs):
        item=self.composition
        if not item or item["status"]!="pending":return None
        if item["level_epoch"]!=obs["level_epoch"]:
            self._save_composition(dict(item,status="boundary",returned_at=obs["observation_ref"]),obs)
            return None
        return item if item["owner"]==owner else None

    def retain_composition(self,owner,target_ref,question,evidence,obs,binding=None):
        current=self.composition_for(owner,obs)
        if current:
            return current if current["target_ref"]==target_ref else None
        if self.composition and self.composition["status"]=="pending":return None
        if not target_ref or obs["observation_ref"] not in evidence:return None
        return self._save_composition({"id":"composition_attention:"+sha256(pack([owner,obs["level_epoch"],target_ref]).encode()).hexdigest()[:20],
            "owner":owner,"target_ref":target_ref,"question":question,"status":"pending","level_epoch":obs["level_epoch"],
            "opened_at":obs["observation_ref"],"evidence":list(dict.fromkeys(evidence)),"release_authority":False,
            "current_revalidation_required":True,"binding":binding},obs)

    def return_composition(self,owner,target_ref,status,evidence,obs):
        item=self.composition
        if not item or item["status"]!="pending" or item["owner"]!=owner or item["target_ref"]!=target_ref:return None
        if status not in ("achieved","refuted","boundary") or obs["observation_ref"] not in evidence:return None
        if status!="boundary" and item["level_epoch"]!=obs["level_epoch"]:return None
        return self._save_composition(dict(item,status=status,returned_at=obs["observation_ref"],return_evidence=list(dict.fromkeys(evidence))),obs)
