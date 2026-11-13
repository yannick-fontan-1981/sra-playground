"""Execute pinned surface/code/band Python families against public raster cases.

Python is a creator-side oracle only. State codecs make arbitrary bit masks and
code words explicit without dropping their precision. Expected proposals/events
are never handwritten.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import sys
from types import SimpleNamespace

COMMIT = "786dcf51ca57773d8e3a8948ce9ea3655e7baf8e"
SITE = Path(__file__).resolve().parents[1]


def plain(value):
    if hasattr(value, "tolist"): return plain(value.tolist())
    if isinstance(value, bool) or value is None: return value
    if isinstance(value, int): return value if abs(value) <= 2**53-1 else {"$v6_integer": str(value)}
    if isinstance(value, dict): return {str(key): plain(item) for key, item in value.items()}
    if isinstance(value, (set, frozenset)):
        try: return [plain(item) for item in sorted(value)]
        except TypeError: return sorted([plain(item) for item in value], key=lambda item: json.dumps(item, separators=(",", ":")))
    if isinstance(value, (tuple, list)): return [plain(item) for item in value]
    return value


def set_json(value): return sorted([plain(item) for item in value], key=lambda item: json.dumps(item, separators=(",", ":"), sort_keys=True))
def models_json(value): return sorted([plain(item) for item in value], key=lambda item: json.dumps(item, separators=(",", ":")))


def state(family, memory):
    if family == "surface":
        prior = None if memory.prior is None else {"keys": plain(memory.prior["keys"]), "models": models_json(memory.prior["models"])}
        value = {"format": "native.surface_program.v1/decimal-masks", "epoch": memory.epoch, "prior": prior, "passed": plain(memory.passed), "events": plain(memory.events), "evidence": list(memory.evidence.items())}
        if hasattr(memory, "scene"): value.update(scene=plain(memory.scene), verified=plain(memory.verified), discarded=memory.discarded)
        if hasattr(memory, "keys"): value["keys"] = plain(memory.keys)
        if hasattr(memory, "models"): value["models"] = models_json(memory.models)
        if hasattr(memory, "masks"): value["masks"] = [[str(mask) for mask in masks] for masks in memory.masks]
        if hasattr(memory, "target"): value.update(target=plain(memory.target), first=memory.first)
        return value
    if family == "code":
        value = {"format": "native.code_program.v1/exact-integers", "epoch": memory.epoch, "prior": plain(list(memory.prior.items())) if isinstance(memory.prior, dict) else None,
                 "passed": plain(memory.passed), "events": plain(memory.events)}
        if hasattr(memory, "board"):
            value.update(board=plain(memory.board), effects=plain(list(memory.effects.items())), executed=plain(memory.executed), demo_tried=plain(memory.demo_tried),
                         counterexamples=plain(memory.counterexamples), evidence=plain(memory.evidence), toggle_known=memory.toggle_known, initial_ref=memory.initial_ref, last_start=plain(memory.last_start))
        return value
    value = {"format": "native.band_transfer.v1", "epoch": memory.epoch, "prior": memory.prior, "passed": plain(memory.passed), "events": plain(memory.events)}
    if hasattr(memory, "model"):
        value.update(model=plain(memory.model), sense=memory.sense, blocked=set_json(memory.blocked), supported=plain(memory.supported), refs=plain(list(memory.refs.items())), tried=set_json(memory.tried), refuted=memory.refuted)
    if hasattr(memory, "initial"): value.update(initial=plain(memory.initial), first=memory.first)
    return value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", type=Path, default=SITE / "reference/v6" / COMMIT / "source")
    parser.add_argument("--output", type=Path, default=SITE / "tests/fixtures/v6-program-families-reference.json")
    args = parser.parse_args(); root = args.source_root.resolve()
    modules = {"surface": "common_surface_program", "code": "common_code_program", "band": "common_band_transfer"}
    names = list(modules.values()) + ["neutral_observer", "geometric_observer", "observed_input_domain", "common_multiscale_constraints"]
    manifest = json.loads((SITE / "reference/v6" / COMMIT / "manifest.json").read_text()); hashes = {}
    for name in names:
        path = f"agents/yf_arc3_v6/laya_proto/{name}.py"; value = hashlib.sha256((root / path).read_bytes()).hexdigest()
        if value != manifest["files"][path]["sha256"]: raise ValueError("Reference changed: " + path)
        hashes[path] = value
    sys.path[:0] = [str(root), str(root / "agents/yf_arc3_v6/laya_proto")]
    import common_surface_program as surface
    import common_code_program as code
    import common_band_transfer as band
    from neutral_observer import measure
    from observed_input_domain import ObservedInputDomain
    from common_multiscale_constraints import projection
    source_names = {str(root / f"agents/yf_arc3_v6/laya_proto/{name}.py"): family for family, name in modules.items()}
    covered = {family: set() for family in modules}
    def profile(frame, event, _arg):
        if event == "call" and frame.f_code.co_filename in source_names: covered[source_names[frame.f_code.co_filename]].add(frame.f_code.co_name)
    sys.setprofile(profile)
    scenes, raws, cases, scenarios = {}, {}, [], []
    def observe(name, rows, *, family="surface", level=1, score=0, status="NOT_FINISHED"):
        raw = SimpleNamespace(frame_rows=rows, frame_packet=[rows], frame_hash=hashlib.sha256(json.dumps(rows, separators=(",", ":")).encode()).hexdigest()[:16],
                              level=level, levels_completed=score, state=status, step_index=len(scenes), available_action_refs=("ACTION1", "ACTION2", "ACTION3", "ACTION4", "ACTION5", "ACTION6") if family == "surface" else ("ACTION6",))
        observation, _ = measure(raw, len(scenes) + 1, "program-reference"); domain = ObservedInputDomain(4096); inputs = domain.candidates(observation)
        scenes[name] = {"rows": plain(rows), "observation": plain(observation), "public": plain(vars(raw)), "inputs": plain(inputs)}; raws[name] = raw
        return name
    def add_case(family, name, operation, arguments, callback, transform=plain):
        entry = {"family": family, "id": name, "operation": operation, "arguments": plain(arguments)}
        try: entry["expected"] = transform(callback())
        except Exception as error: entry["error"] = str(error)
        cases.append(entry); return entry.get("expected")
    constructors = {"surface": surface.SurfaceProgram, "code": code.CodeProgram, "band": band.BandTransfer}
    class Driver:
        def __init__(self, family, name): self.family=family; self.name=name; self.memory=constructors[family](); self.steps=[]; self.proposal=None; self.domain=None
        def execute(self, op):
            try:
                kind=op["kind"]
                if kind == "propose":
                    view=scenes[op["scene"]]; self.domain=ObservedInputDomain(4096); inputs=self.domain.candidates(view["observation"])
                    self.proposal=self.memory.propose(view["observation"],view["rows"],op.get("inputs",inputs),op.get("remaining",100)); result=self.proposal
                elif kind == "bind": self.memory.bind(self.proposal,self.domain); result=self.proposal
                elif kind == "before": result=self.memory.before(self.proposal,op.get("index",0),raws[op["scene"]],scenes[op.get("observation",op["scene"])]["observation"])
                elif kind in ("after","record"):
                    b,a=scenes[op["before"]],scenes[op["after"]]; i=op.get("index",0)
                    if kind == "after": result=self.memory.after(self.proposal,i,b["observation"],a["observation"],b["rows"],a["rows"])
                    else:
                        extra={"frames":[scenes[name]["rows"] for name in op.get("frames",[])]} if self.family=="code" else {}
                        result=self.memory.record(b["observation"],a["observation"],self.proposal["actions"][i],b["rows"],a["rows"],self.proposal,i,**extra)
                else: raise AssertionError(kind)
                expected={"result":plain(result),"state":state(self.family,self.memory)}
            except Exception as error: expected={"error":str(error),"state":state(self.family,self.memory)}
            self.steps.append({"operation":plain(op),"expected":expected}); return result if "result" in expected else None
        def save(self): scenarios.append({"family":self.family,"id":self.name,"steps":self.steps})

    # Two extent bands, compact reference inside a separator, actual sampled buttons.
    def band_rows(q=(8,12), reverse=False, transpose=False):
        rows=[[0]*32 for _ in range(18)]
        for y in range(0,8):
            for x in range(2,2+q[0]): rows[y][x]=4
        for y in range(10,18):
            for x in range(2,2+q[1]): rows[y][x]=4
        for y in (6,7,10,11):
            for x in (2,3):rows[y][x]=9
        for y in range(7,10): rows[y][14]=6;rows[y][13]=7;rows[y][15]=7
        for y in range(1,6):rows[y][q[0]+2]=6
        if reverse:rows=[row[::-1] for row in rows]
        if transpose:rows=[list(row) for row in zip(*rows)]
        return rows
    for name,q in [("band:initial",(8,12)),("band:learned",(10,10)),("band:solved",(12,8)),("band:opposite",(8,12)),("band:invalid",(11,9))]:observe(name,band_rows(q),family="band")
    observe("band:score",band_rows((12,8)),family="band",score=1)
    observe("band:epoch",band_rows(),family="band",level=2,score=1)
    for name,reverse,transpose in [("axis_x",False,False),("axis_y",False,True),("reverse_x",True,False)]:
        ref=observe("band:"+name,band_rows(reverse=reverse,transpose=transpose),family="band"); view=scenes[ref]
        model=band.geometry(view["observation"],view["rows"],view["inputs"]); assert model is not None
        add_case("band",name+"_geometry","geometry",{"scene":ref},lambda model=model:model)
        add_case("band",name+"_quantities","quantities",{"scene":ref,"model":model},lambda model=model,view=view:band.quantities(view["rows"],model))
    for sense in ("into_clicked","away_from_clicked"):
        for control in range(4):add_case("band",f"effect_{sense}_{control}","effect",dict(q=(2,6,4),control=control,sense=sense,unit=2),lambda sense=sense,control=control:band.effect((2,6,4),control,sense,2))
    add_case("band","empty_donor","effect",dict(q=(2,0),control=0,sense="into_clicked",unit=2),lambda:band.effect((2,0),0,"into_clicked",2))
    for name,q,targets,blocked,remaining in [("astar_two_edges",(0,2,6),{0:4},set(),6),("astar_blocked",(0,2,6),{0:4},{((0,2,6),0)},6),("astar_budget",(0,2,6),{0:4},set(),1),("already_aligned",(4,4),{0:4},set(),1)]:
        add_case("band",name,"find_path",dict(q=q,targets=targets,sense="into_clicked",unit=2,blocked=blocked,remaining=remaining),lambda q=q,targets=targets,blocked=blocked,remaining=remaining:band.find_path(q,targets,"into_clicked",2,blocked,remaining))
    d=Driver("band","learn_extent_relation_then_plan_score_transfer")
    assert d.execute({"kind":"propose","scene":"band:initial"})
    d.execute({"kind":"bind"});d.execute({"kind":"before","scene":"band:initial"});d.execute({"kind":"before","scene":"band:initial","observation":"band:learned"})
    d.execute({"kind":"after","before":"band:initial","after":"band:learned"});d.execute({"kind":"record","before":"band:initial","after":"band:learned"})
    p=d.execute({"kind":"propose","scene":"band:learned"});assert p["steps"][0]["expected_after"]==(12,8)
    d.execute({"kind":"bind"});d.execute({"kind":"before","scene":"band:learned"});d.execute({"kind":"after","before":"band:learned","after":"band:solved"});d.execute({"kind":"after","before":"band:learned","after":"band:opposite"})
    d.execute({"kind":"record","before":"band:learned","after":"band:score"});d.execute({"kind":"propose","scene":"band:epoch"});d.save()
    d=Driver("band","stationary_control_and_opposite_response_refutation")
    d.execute({"kind":"propose","scene":"band:initial"});d.execute({"kind":"record","before":"band:initial","after":"band:initial"})
    d.execute({"kind":"propose","scene":"band:initial"});d.execute({"kind":"record","before":"band:initial","after":"band:learned"})
    d.execute({"kind":"propose","scene":"band:learned"});d.execute({"kind":"record","before":"band:learned","after":"band:solved"})
    d.execute({"kind":"propose","scene":"band:learned"});d.save()

    # Homologous raster template, framed palette and a separate measured carrier.
    target=[1,1,2,2]*4
    def surface_rows(grid=None,pose=0,hue=2,tip=False,reference=None):
        rows=[[0]*36 for _ in range(34)]
        for left,value in [(2,1),(7,2)]:
            for y in range(2,5):
                for x in range(left,left+3):rows[y][x]=9 if y in (2,4) or x in (left,left+2) else value
        reference=target if reference is None else reference;grid=[1]*16 if grid is None else grid
        for j in range(4):
            for i in range(4):rows[2+j][14+i]=reference[4*j+i];rows[15+j][14+i]=grid[4*j+i]
        dx,dy=surface.RAYS[pose];x,y=15+8*dx,16+8*dy
        for yy in range(y,y+2):
            for xx in range(x,x+2):rows[yy][xx]=hue
        if tip:rows[16][27]=hue
        return rows
    for name,hue in [("surface:initial",1),("surface:swatch",2)]:observe(name,surface_rows(hue=hue))
    observe("surface:written",surface_rows(grid=target));observe("surface:score",surface_rows(grid=target),score=1);observe("surface:epoch",surface_rows(hue=1),level=2,score=1)
    tip_target=[1]*16;tip_target[7]=2
    observe("surface:attached",surface_rows(tip=True,reference=tip_target));observe("surface:attached_written",surface_rows(tip=True,reference=tip_target,grid=tip_target))
    for name in ("surface:initial","surface:attached"):
        view=scenes[name];scene=surface.layout(view["observation"],view["rows"],view["inputs"]);assert scene is not None
        add_case("surface",name+"_layout","layout",{"scene":name},lambda scene=scene:scene)
        observed=surface.observe(view["rows"],scene)
        add_case("surface",name+"_observe","observe",{"scene":name,"layout":scene},lambda observed=observed:observed)
        add_case("surface",name+"_attachment","attachment",{"scene":name,"layout":scene,"state":observed},lambda view=view,scene=scene,observed=observed:surface.attachment(scene,view["observation"],view["inputs"],observed),lambda value:None if value is None else [[str(mask) for mask in value[0]],plain(value[1]),plain(value[2])])
    for width,height in [(3,3),(4,3),(8,8)]:
        for inclusive in (False,True):add_case("surface",f"masks_{width}_{height}_{inclusive}","make_masks",dict(width=width,height=height,inclusive=inclusive),lambda width=width,height=height,inclusive=inclusive:surface.make_masks(width,height,inclusive),lambda value:[str(mask) for mask in value])
    add_case("surface","paint_bit63_exact","paint",dict(grid=[1]*64,mask=str(1<<63),hue=2),lambda:surface.paint([1]*64,1<<63,2))
    add_case("surface","program_bit63_exact","program",dict(current=[1]*64,target=[1]*63+[2],pose=0,hue=2,masks=[str(1<<63)]),lambda:surface.program([1]*64,[1]*63+[2],0,2,[1<<63]))
    for motion in ("bounded_axis","angular_attraction"):
        add_case("surface",motion+"_all_transitions","advance_all",{"motion":motion},lambda motion=motion:[[surface.advance(p,a,motion) for a in range(8)] for p in range(8)])
    add_case("surface","crop_template","crop",{"scene":"surface:initial","box":[14,2,17,5]},lambda:surface.crop(scenes["surface:initial"]["rows"],[14,2,17,5]))
    add_case("surface","inside_closed_box","inside",{"point":[17,5],"box":[14,2,17,5]},lambda:surface.inside((17,5),(14,2,17,5)))
    d=Driver("surface","palette_binding_then_label_inference_and_score")
    p=d.execute({"kind":"propose","scene":"surface:initial"});assert p and p["steps"][0]["mode"]=="swatch"
    d.execute({"kind":"bind"});d.execute({"kind":"before","scene":"surface:initial"});d.execute({"kind":"after","before":"surface:initial","after":"surface:swatch"});d.execute({"kind":"record","before":"surface:initial","after":"surface:swatch"})
    p=d.execute({"kind":"propose","scene":"surface:swatch"});assert p["actions"][0]["action_ref"]=="ACTION1"
    d.execute({"kind":"after","before":"surface:swatch","after":"surface:written"});d.execute({"kind":"record","before":"surface:swatch","after":"surface:score"});d.execute({"kind":"propose","scene":"surface:epoch"});d.save()
    d=Driver("surface","attached_footprint_is_a_measured_probe")
    p=d.execute({"kind":"propose","scene":"surface:attached"});assert p and p["steps"][0]["mode"]=="test_attached_footprint"
    d.execute({"kind":"bind"});d.execute({"kind":"before","scene":"surface:attached"});d.execute({"kind":"after","before":"surface:attached","after":"surface:attached_written"});d.execute({"kind":"record","before":"surface:attached","after":"surface:attached_written"});d.save()
    d=Driver("surface","addressed_prediction_refuted")
    d.execute({"kind":"propose","scene":"surface:initial"});d.execute({"kind":"record","before":"surface:initial","after":"surface:initial"});d.execute({"kind":"propose","scene":"surface:initial"});d.save()
    # Real source options/predict branches with changing pose, not a prescribed route.
    north=[2]*8+[1]*8;pose=0;grid=[1]*16;current=observe("surface:north:0",surface_rows(pose=pose,reference=north))
    d=Driver("surface","angular_control_learning_and_backward_program")
    meanings={"ACTION1":6,"ACTION2":0,"ACTION3":2,"ACTION4":4,"ACTION5":"write"}
    for turn in range(16):
        p=d.execute({"kind":"propose","scene":current})
        if p is None:break
        command=p["actions"][0];meaning=meanings.get(command["action_ref"])
        if meaning=="write":grid=list(surface.paint(grid,surface.make_masks(4,4,False)[pose],2))
        elif meaning is not None:pose=surface.advance(pose,meaning,"angular_attraction")
        else:raise AssertionError("Unexpected palette in monochrome-angle case")
        after=observe(f"surface:north:{turn+1}",surface_rows(grid=grid,pose=pose,reference=north))
        d.execute({"kind":"after","before":current,"after":after});d.execute({"kind":"record","before":current,"after":after});current=after
        if grid==north:break
    assert grid==north;d.save()

    # Checkerboard world, a shape-compatible cavity and sampled binary columns.
    actor_mask={(x,y) for x in range(3) for y in range(3)}-{(1,1)}
    def code_rows(position=(0,0),words=(0,1),highlight=None,demo=False,demo_pos=(22,5),demo_highlight=None,demo_words=(0,1)):
        rows=[[0]*38 for _ in range(35)]
        for cy in range(5):
            for cx in range(5):
                for j in range(3):
                    for i in range(3):rows[2+cy*3+j][2+cx*3+i]=1+(cx+cy)%2
        rows[3][9]=3
        for x in range(8,11):rows[1][x]=3
        for x,y in actor_mask:rows[2+position[1]*3+y][2+position[0]*3+x]=3
        def glyphs(xs,words):
            for x,word in zip(xs,words):
                for xx in range(x,x+3):rows[20][xx]=4+(word>>1&1)
                for yy in range(22,25):rows[yy][x+1]=4+(word&1)
        glyphs([5,10],words)
        for y in range(27,31):
            for x in range(7,11):rows[y][x]=6
        if highlight is not None:rows[19][[4,9][highlight]]=6
        if demo:
            glyphs([23,28],demo_words);rows[27][25]=3
            for x,y in actor_mask:rows[demo_pos[1]+y][demo_pos[0]+x]=3
            if demo_highlight is not None:rows[19][[22,27][demo_highlight]]=6
        return rows
    for name,position,words,highlight in [("code:initial",(0,0),(0,1),None),("code:frame0",(1,0),(0,1),0),("code:frame1",(0,0),(0,1),1),
                                           ("code:edited",(0,0),(0,0),None),("code:goal_frame0",(1,0),(0,0),0),("code:goal_frame1",(2,0),(0,0),1),
                                           ("code:conflict0",(0,1),(0,1),0),("code:conflict1",(0,0),(0,1),1)]:observe(name,code_rows(position,words,highlight),family="code")
    observe("code:score",code_rows((2,0),(0,0)),family="code",score=1)
    observe("code:epoch",code_rows(),family="code",level=2,score=1)
    initial=scenes["code:initial"];board=code.scene(initial["observation"],initial["rows"],initial["inputs"]);assert board is not None
    add_case("code","measured_board_and_columns","scene",{"scene":"code:initial"},lambda:board)
    add_case("code","sampled_input","input_at",{"scene":"code:initial","box":board["columns"][0][0]},lambda:code.input_at(initial["inputs"],board["columns"][0][0]))
    for name in ("code:initial","code:edited","code:goal_frame1"):
        add_case("code",name+"_position","position",{"scene":name,"board":board},lambda name=name:code.position(scenes[name]["rows"],board))
        add_case("code",name+"_bits","bits",{"scene":name,"board":board},lambda name=name:code.bits(scenes[name]["rows"],board))
    wide_rows=[[5] for _ in range(70)];wide_board={"values":(4,5),"columns":[[(0,y,0,y) for y in range(70)]]}
    add_case("code","seventy_bit_word_exact","bits_rows",{"rows":wide_rows,"board":wide_board},lambda:code.bits(wide_rows,wide_board))
    for name,position,delta in [("legal_move",(0,0),(1,0)),("blocked_move",(0,0),(-1,0))]:add_case("code",name,"move",{"board":board,"position":position,"delta":delta},lambda position=position,delta=delta:code.move(position,delta,board))
    effects={0:(1,0),1:(-1,0),2:(0,1),3:(0,-1)}
    add_case("code","physical_paths_exact_length","physical_paths",{"board":board,"start":(0,0),"length":2,"effects":list(effects.items())},lambda:code.physical_paths(board,(0,0),2,effects))
    d=Driver("code","learn_animation_labels_edit_then_execute")
    p=d.execute({"kind":"propose","scene":"code:initial"});assert p and p["steps"][0]["mode"]=="execute"
    d.execute({"kind":"bind"});d.execute({"kind":"before","scene":"code:initial"});d.execute({"kind":"after","before":"code:initial","after":"code:initial"})
    e=d.execute({"kind":"record","before":"code:initial","after":"code:initial","frames":["code:initial","code:frame0","code:frame1","code:initial"]});assert e["highlighted_transitions"]==2
    p=d.execute({"kind":"propose","scene":"code:initial"});assert p["steps"][0]["mode"]=="edit"
    d.execute({"kind":"bind"});d.execute({"kind":"before","scene":"code:initial"});d.execute({"kind":"after","before":"code:initial","after":"code:edited"});d.execute({"kind":"record","before":"code:initial","after":"code:edited"})
    p=d.execute({"kind":"propose","scene":"code:edited"});assert p["steps"][0]["mode"]=="execute"
    d.execute({"kind":"record","before":"code:edited","after":"code:score","frames":["code:edited","code:goal_frame0","code:goal_frame1"]});d.execute({"kind":"propose","scene":"code:epoch"});d.save()
    d=Driver("code","counterexamples_remove_labels_and_edit_refutation")
    d.execute({"kind":"propose","scene":"code:initial"});d.execute({"kind":"record","before":"code:initial","after":"code:initial","frames":["code:initial","code:frame0","code:frame1"]})
    d.execute({"kind":"record","before":"code:initial","after":"code:initial","frames":["code:initial","code:conflict0","code:conflict1"]})
    p=d.execute({"kind":"propose","scene":"code:initial"});assert p["steps"][0]["mode"]=="edit"
    d.execute({"kind":"record","before":"code:initial","after":"code:initial"});d.execute({"kind":"propose","scene":"code:initial"});d.save()
    for name,pos,highlight in [("code:demo",(22,5),None),("code:demo0",(25,5),0),("code:demo1",(22,5),1)]:observe(name,code_rows(demo=True,demo_pos=pos,demo_highlight=highlight),family="code")
    demo=scenes["code:demo"];demo_board=code.scene(demo["observation"],demo["rows"],demo["inputs"]);assert demo_board and demo_board["examples"]
    add_case("code","separate_demonstration_measured","scene",{"scene":"code:demo"},lambda:demo_board)
    d=Driver("code","highlighted_local_example_preserves_actual_world")
    p=d.execute({"kind":"propose","scene":"code:demo"});assert p["steps"][0]["mode"]=="demonstrate"
    d.execute({"kind":"bind"});d.execute({"kind":"before","scene":"code:demo"})
    e=d.execute({"kind":"record","before":"code:demo","after":"code:demo","frames":["code:demo","code:demo0","code:demo1","code:demo"]});assert e["preserved_actual_world"] and e["highlighted_transitions"]==2
    d.execute({"kind":"propose","scene":"code:demo"});d.save()
    sys.setprofile(None)
    fixture={"schema":"sra.v6.program-families-reference.v1","commit":COMMIT,"sourceHashes":hashes,
             "normalization":["NumPy matrices and tuple fields become JSON arrays","structural sets sorted without dropping values","dictionary entries preserve insertion order where numeric keys carry execution order",
                              "surface arbitrary-integer masks encoded as exact decimal strings","code words beyond safe integers encoded as {$v6_integer:decimal}","initial empty code prior encoded null; learned prior is exact entries","native state format tags added"],
             "coveredSourceFunctions":{family:sorted(name for name in names if not name.startswith("<")) for family,names in covered.items()},"scenes":scenes,"cases":cases,"scenarios":scenarios}
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(fixture,ensure_ascii=False,separators=(",",":"))+"\n")
    print(json.dumps({"cases":len(cases),"scenarios":len(scenarios),"steps":sum(len(s["steps"]) for s in scenarios),"covered":fixture["coveredSourceFunctions"],"output":str(args.output)}))


if __name__ == "__main__": main()
