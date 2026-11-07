"""Probe repeated framed controls and measure responses in a separate repeated row."""
from collections import Counter, defaultdict
from fractions import Fraction
from math import ceil, floor


def value(rows,box):
    l,t,r,b=box
    values={rows[y][x] for y in range(t,b+1) for x in range(l,r+1)}
    return next(iter(values)) if len(values)==1 else None


def framed_rows(obs,rows):
    groups=defaultdict(list)
    height,width=len(rows),len(rows[0])
    for e in obs["entities"]:
        l,t,r,b=e["bbox"];w,h=r-l+1,b-t+1
        if min(w,h)<2 or e["area"]!=w*h or l<1 or t<1 or r+1>=width or b+1>=height:continue
        border={rows[y][x] for y in (t-1,b+1) for x in range(l-1,r+2)}
        border.update(rows[y][x] for x in (l-1,r+1) for y in range(t,b+1))
        if len(border)!=1 or e["palette_value"] in border:continue
        groups[t,w,h].append((l,t,r,b))
    complete=[]
    for boxes in groups.values():
        boxes.sort()
        if not 2<=len(boxes)<=8:continue
        pitch=Fraction(boxes[-1][0]-boxes[0][0],len(boxes)-1)
        if pitch<boxes[0][2]-boxes[0][0]+1:continue
        if all(box[0] in (floor(boxes[0][0]+i*pitch),ceil(boxes[0][0]+i*pitch)) for i,box in enumerate(boxes)):
            complete.append(boxes)
    return complete


class CoupledDisplays:
    def __init__(self):
        self.epoch=None
        self.controls=[];self.receivers=[]
        self.initial_value=None
        self.history=[]
        self.scored_schema=None

    def offers(self,obs,rows,inputs,policy):
        points=[a for a in inputs if a.get("data") and a["action_ref"]=="ACTION6"]
        if not points:return []
        if self.epoch!=obs["level_epoch"]:
            inherited=self.scored_schema
            self.__init__();self.epoch=obs["level_epoch"];self.scored_schema=inherited
        if not self.controls:
            groups=framed_rows(obs,rows)
            candidates=[(controls,outputs) for controls in groups for outputs in groups
                if controls is not outputs and len(controls)>=3 and len(outputs)>=2
                and (controls[0][2]-controls[0][0],controls[0][3]-controls[0][1]) !=
                    (outputs[0][2]-outputs[0][0],outputs[0][3]-outputs[0][1])
                and len({value(rows,b) for b in controls})==1 and len({value(rows,b) for b in outputs})>=2]
            if not candidates and self.scored_schema:
                def shape(box):return (box[2]-box[0]+1,box[3]-box[1]+1)
                def same_ratio(a,b):return a[0]*b[1]==a[1]*b[0]
                candidates=[(c,r) for c in groups for r in groups if c is not r and
                    same_ratio(shape(c[0]),self.scored_schema["source_shape"]) and
                    same_ratio(shape(r[0]),self.scored_schema["receiver_shape"]) and
                    len({value(rows,b) for b in c})==1]
            if len(candidates)!=1:return []
            self.controls,self.receivers=candidates[0]
            self.initial_value=value(rows,self.controls[0])
        state=tuple(value(rows,b) for b in self.controls)
        lamps=tuple(value(rows,b) for b in self.receivers)
        if None in (*state,*lamps):return []
        changed={e["control"] for e in self.history if e["result"] in ("local_only","coupled")}
        inert={e["control"] for e in self.history if e["result"]=="unchanged"}
        visited={e["state"] for e in self.history}
        visited.add(state)
        alternate={v for v in state if v!=self.initial_value}
        if len(alternate)>1:return []
        on=next(iter(alternate)) if alternate else None
        # The differing member of a repeated receiver row is a candidate
        # obligation. Distance is only a tie-break between untested exposures.
        frequencies=Counter(lamps)
        least=min(frequencies.values())
        targets=[b for b,v in zip(self.receivers,lamps) if frequencies[v]==least]
        options=[]
        for i,(l,t,r,b) in enumerate(self.controls):
            if i in inert:continue
            addressed=[a for a in points if l<=a["data"]["x"]<=r and t<=a["data"]["y"]<=b]
            if len(addressed)!=1:continue
            projected=state[:i]+(self.initial_value if state[i]==on else on,)+state[i+1:]
            exact=next((e for e in self.history if e["control"]==i and e["state"]==state),None)
            if exact:continue
            distance=min(abs((l+r)-(x+z)) for x,_,z,_ in targets)
            key=(projected in visited,i in changed,distance,l)
            options.append((key,i,addressed[0],projected))
        if not options:return []
        _,i,action,projected=min(options,key=lambda item:item[0])
        return [{"source":"coupled_displays","action":action,"level_epoch":self.epoch,
            "engaged_parent":bool(changed),"parent_ref":"conjoint_state_of_observed_receiver_row",
            "observation_ref":obs["observation_ref"],"control_index":i,"starting_values":list(state),
            "source_score":obs["levels_completed"],
            "receiver_values":list(lamps),"controls":self.controls,"receivers":self.receivers,
            "relations":[["addressed_interior","part_of","repeated_control_row"],
                         ["control_row","may_change","distinct_receiver_row"],
                         ["simultaneous_receiver_values","may_satisfy","common_output_condition"]],
            "predictions":{"inert_decoration":"unchanged","local_switch":"local_only","coupled_switch":"coupled"},
            "evidence":[obs["observation_ref"]],"return_steps":None,
            "risks":["A latched control or a dependent receiver may change irreversibly."],
            "question":policy["question"]}]

    def observe(self,probe,after,rows):
        if after["levels_completed"]>probe["source_score"]:
            def size(box):return [box[2]-box[0]+1,box[3]-box[1]+1]
            self.scored_schema={"source_shape":size(probe["controls"][0]),"receiver_shape":size(probe["receivers"][0]),
                                "evidence":after["observation_ref"]}
            return "boundary"
        if after["level_epoch"]!=probe["level_epoch"]:return None
        state=tuple(value(rows,b) for b in probe["controls"])
        lamps=tuple(value(rows,b) for b in probe["receivers"])
        if None in (*state,*lamps):return None
        before=tuple(probe["starting_values"]);index=probe["control_index"]
        local={i for i,(a,b) in enumerate(zip(before,state)) if a!=b}
        remote=tuple(probe["receiver_values"])!=lamps
        effect=("coupled" if remote else "local_only") if local=={index} else "unchanged" if not local and not remote else "other"
        self.history.append({"control":index,"state":before,"new_state":state,"result":effect,"evidence":after["observation_ref"]})
        return effect
