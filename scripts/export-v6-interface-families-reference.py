"""Real pinned Python oracle for slot/word/port/constellation native transfers.

These are controlled public-raster unit scenarios, not a claim of game scores.
Each proposal, guard, event, parser continuation and retained state is produced
by the unchanged reference source. Python is never an agent browser runtime.
"""
from __future__ import annotations
import argparse
from collections import defaultdict
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
from types import SimpleNamespace

COMMIT = "786dcf51ca57773d8e3a8948ce9ea3655e7baf8e"
SITE = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("point_set_oracle", Path(__file__).with_name("export-v6-point-set-reference.py"))
point_set_oracle = importlib.util.module_from_spec(spec); spec.loader.exec_module(point_set_oracle)


def plain(value):
    if hasattr(value, "tolist"): return plain(value.tolist())
    if value is None or isinstance(value, (str, bool, int, float)): return value
    if isinstance(value, dict) or hasattr(value, "items"): return {str(key): plain(item) for key, item in value.items()}
    if isinstance(value, (set, frozenset)): return [plain(item) for item in sorted(value)]
    if isinstance(value, (tuple, list)): return [plain(item) for item in value]
    if isinstance(value, SimpleNamespace): return plain(vars(value))
    raise TypeError(type(value))


def point_state(value): return point_set_oracle.set_state(value)
def port_model(value): return None if value is None else {**plain({k:v for k,v in value.items() if k != "bodies"}),
    "bodies": [{**plain({k:v for k,v in body.items() if k not in ("material", "ports")}), "material": point_state(body["material"]), "ports": point_state(body["ports"])} for body in value["bodies"]]}
def cover_model(value):
    if value is None: return None
    out = plain({k:v for k,v in value.items() if k not in ("targets", "marker_rows", "marker_raster", "excluded", "boundary_overlay", "focus_occlusion")})
    out.update(targets=[[k,point_state(v)] for k,v in value["targets"].items()], marker_rows=plain(list(value["marker_rows"].items())), marker_raster=plain(list(value["marker_raster"].items())))
    out.update({k:point_state(value[k]) for k in ("excluded", "boundary_overlay", "focus_occlusion")})
    return out


def state(family, memory):
    result = {"format": f"native.{dict(slot='slot_substitution',word='word_interface',port='port_assembly',cover='constellation_cover')[family]}.v1",
              "epoch": memory.epoch, "passed": plain(memory.passed), "events": plain(memory.events)}
    if family == "slot":
        if hasattr(memory,"scene"): result.update(scene=plain(memory.scene),tested=plain(memory.tested),retired=memory.retired,refs=plain(list(memory.refs.items())),first=memory.first)
    elif family == "word":
        result.update(edit_graph=[[key,plain(list(edges.items()))] for key,edges in memory.edit_graph.items()], focus_directions=plain(list(memory.focus_directions.items())),closed=plain(memory.closed))
        if hasattr(memory,"scene"): result.update(scene=plain(memory.scene),verified=plain(memory.verified),tried=plain(memory.tried),refs=plain(list(memory.refs.items())),first=memory.first,cycle_start=plain(memory.cycle_start))
    elif family == "port":
        result.update(motion=plain(list(memory.motion.items())),rotation_key=memory.rotation_key,rotation_sign=memory.rotation_sign)
        if hasattr(memory,"model"): result.update(model=port_model(memory.model),current=plain(memory.current),active=memory.active,verified=plain(memory.verified),seen=plain(memory.seen),refs=plain(list(memory.refs.items())),goal=plain(memory.goal),first=memory.first,overlay_observed=memory.overlay_observed,overlay_refuted=memory.overlay_refuted)
    else:
        if hasattr(memory,"model"):
            result.update(model=cover_model(memory.model),motion=plain(list(memory.motion.items())),tried=plain(memory.tried),selector=memory.selector,
                bodies=[{**plain({k:v for k,v in body.items() if k!='mask'}),"mask":point_state(body['mask'])} for body in memory.bodies],poses=plain(memory.poses),active=memory.active,
                samples=[{'focus':plain(sample['focus']),'material':[[color,point_state(points)]for color,points in sample['material'].items()]}for sample in memory.samples],
                complete=memory.complete,retired=memory.retired,refs=plain(list(memory.refs.items())),boundary_observed=plain(memory.boundary_observed),persisted_bodies=memory.persisted_bodies,first_observation=memory.first_observation,unowned_seen=plain(memory.unowned_seen))
    return result


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--source-root',type=Path,default=SITE/'reference/v6'/COMMIT/'source');parser.add_argument('--output',type=Path,default=SITE/'tests/fixtures/v6-interface-families-reference.json');args=parser.parse_args();root=args.source_root.resolve()
    names=['common_slot_substitution','common_word_interface','common_port_assembly','common_constellation_cover','neutral_observer','geometric_observer','observed_input_domain','common_multiscale_constraints']
    paths=[f'agents/yf_arc3_v6/laya_proto/{name}.py'for name in names]+['agents/yf_arc3_v5/capabilities/typed_word_transduction.py','agents/yf_arc3_v5/capabilities/rigid_marker_pose.py','agents/yf_arc3_v5/logos/types.py']
    manifest=json.loads((SITE/'reference/v6'/COMMIT/'manifest.json').read_text());hashes={}
    for path in paths:
        digest=hashlib.sha256((root/path).read_bytes()).hexdigest()
        if digest!=manifest['files'][path]['sha256']:raise ValueError('Reference changed: '+path)
        hashes[path]=digest
    sys.path[:0]=[str(root),str(root/'agents/yf_arc3_v6/laya_proto')]
    import numpy as np
    import common_slot_substitution as slot
    import common_word_interface as word
    import common_port_assembly as port
    import common_constellation_cover as cover
    from neutral_observer import measure
    from observed_input_domain import ObservedInputDomain
    from agents.yf_arc3_v5.capabilities.typed_word_transduction import parse_typed_word,_WordBudget
    from agents.yf_arc3_v5.capabilities.rigid_marker_pose import measure_rigid_marker_poses
    modules={'slot':slot,'word':word,'port':port,'cover':cover}
    source_names={str(root/f'agents/yf_arc3_v6/laya_proto/{module.__name__}.py'):family for family,module in modules.items()}
    source_names[str(root/'agents/yf_arc3_v5/capabilities/typed_word_transduction.py')]='parser';source_names[str(root/'agents/yf_arc3_v5/capabilities/rigid_marker_pose.py')]='rigid'
    covered={name:set()for name in source_names.values()}
    def profile(frame,event,_):
        if event=='call'and frame.f_code.co_filename in source_names:covered[source_names[frame.f_code.co_filename]].add(frame.f_code.co_name)
    sys.setprofile(profile)
    scenes={};raws={};cases=[];scenarios=[]
    def observe(name,rows,family='slot',level=1,score=0,status='NOT_FINISHED'):
        refs=('ACTION5','ACTION6')if family=='slot'else tuple(f'ACTION{i}'for i in range(1,7 if family=='port'else 6))
        raw=SimpleNamespace(frame_rows=rows,frame_packet=[rows],frame_hash=hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest()[:16],level=level,levels_completed=score,state=status,step_index=len(scenes),available_action_refs=refs)
        observation,_=measure(raw,len(scenes)+1,'interface-reference');domain=ObservedInputDomain(4096);inputs=domain.candidates(observation)
        scenes[name]={'rows':plain(rows),'observation':plain(observation),'public':plain(vars(raw)),'inputs':plain(inputs)};raws[name]=raw;return name
    def case(family,name,operation,arguments,callback,transform=plain):
        expected=transform(callback());cases.append({'family':family,'id':name,'operation':operation,'arguments':plain(arguments),'expected':expected});return expected
    constructors={'slot':slot.SlotSubstitution,'word':word.WordInterface,'port':port.PortAssembly,'cover':cover.ConstellationCover}
    class Driver:
        def __init__(self,family,name):self.family=family;self.name=name;self.memory=constructors[family]();self.steps=[];self.proposal=None;self.domain=None
        def execute(self,op):
            kind=op['kind']
            if kind=='propose':
                view=scenes[op['scene']];self.domain=ObservedInputDomain(4096);inputs=self.domain.candidates(view['observation']);self.proposal=self.memory.propose(view['observation'],view['rows'],op.get('inputs',inputs),op.get('remaining',100));result=self.proposal
            elif kind=='bind':self.memory.bind(self.proposal,self.domain);result=self.proposal
            elif kind=='before':result=self.memory.before(self.proposal,op.get('index',0),raws[op['scene']],scenes[op.get('observation',op['scene'])]['observation'])
            elif kind in('after','record'):
                b,a=scenes[op['before']],scenes[op['after']];index=op.get('index',0)
                if kind=='after':result=self.memory.after(self.proposal,index,b['observation'],a['observation'],b['rows'],a['rows'])
                else:result=self.memory.record(b['observation'],a['observation'],op.get('command',self.proposal['actions'][index]),b['rows'],a['rows'],self.proposal,index)
            elif kind=='seed':result=None
            elif kind=='proposal':self.proposal=copy.deepcopy(op['proposal']);result=self.proposal
            else:raise AssertionError(kind)
            self.steps.append({'operation':plain(op),'expected':{'result':plain(result),'state':state(self.family,self.memory)}});return result
        def seed(self):self.execute({'kind':'seed','state':state(self.family,self.memory),'proposal':plain(self.proposal)})
        def save(self):scenarios.append({'family':self.family,'id':self.name,'steps':self.steps})
    def rect(rows,box,value):
        l,t,r,b=box
        for y in range(t,b+1):
            for x in range(l,r+1):rows[y][x]=value
    def rim(rows,box,value):
        l,t,r,b=box
        for x in range(l-1,r+2):rows[t-1][x]=value;rows[b+1][x]=value
        for y in range(t,b+1):rows[y][l-1]=value;rows[y][r+1]=value

    # Slots: discovery uses real connected components, then learns both operations.
    def slot_rows(contents=(0,0),selected=None,available=(True,True)):
        rows=[[0]*34 for _ in range(44)]
        for x,hue in [(5,2),(14,3)]:
            rect(rows,(x,2,x+4,6),hue);rect(rows,(x+1,3,x+3,5),0)
        rect(rows,(3,15,24,23),7);rim(rows,(3,15,24,23),8)
        for x,value in zip((8,18),contents):rows[19][x]=value
        for index,(x,hue)in enumerate([(5,2),(14,3)]):
            rect(rows,(x,37,x+2,39),hue if available[index]else 0)
            if selected==index:rim(rows,(x,37,x+2,39),4)
        return rows
    for name,contents,selected,available in [('initial',(0,0),None,(1,1)),('select0',(0,0),0,(1,1)),('place0',(2,0),None,(0,1)),('select1',(2,0),1,(0,1)),('complete',(2,3),None,(0,0))]:observe('slot:'+name,slot_rows(contents,selected,available))
    observe('slot:score',slot_rows((2,3),None,(0,0)),score=1);observe('slot:epoch',slot_rows(),level=2,score=1)
    initial=scenes['slot:initial'];slot_scene=slot.layout(initial['observation'],initial['rows']);assert slot_scene and slot_scene['targets']==(2,3)
    case('slot','discovered_layout','layout',{'scene':'slot:initial'},lambda:slot_scene)
    case('slot','unframed_rejected','layout',{'scene':observe('slot:blank',[[0]*8 for _ in range(8)])},lambda:slot.layout(scenes['slot:blank']['observation'],scenes['slot:blank']['rows']))
    for name in ['initial','select0','place0','select1','complete']:
        view=scenes['slot:'+name];case('slot','state_'+name,'state',{'scene':'slot:'+name,'model':slot_scene},lambda view=view:slot.state(view['rows'],slot_scene))
    for box in [(5,37,7,39),(0,0,2,2)]:case('slot','boundary_'+str(box),'boundary',{'scene':'slot:initial','box':box},lambda box=box:slot.boundary(np.asarray(initial['rows']),box))
    case('slot','sampled_command','command_at',{'inputs':initial['inputs'],'box':slot_scene['inventory'][0]},lambda:slot.command_at(initial['inputs'],slot_scene['inventory'][0]))
    d=Driver('slot','select_place_prefix_submit_and_epoch')
    for before,after in [('initial','select0'),('select0','place0')]:
        assert d.execute({'kind':'propose','scene':'slot:'+before});d.execute({'kind':'bind'});d.execute({'kind':'before','scene':'slot:'+before});d.execute({'kind':'before','scene':'slot:'+after})
        d.execute({'kind':'after','before':'slot:'+before,'after':'slot:'+after});d.execute({'kind':'record','before':'slot:'+before,'after':'slot:'+after})
    proposal=d.execute({'kind':'propose','scene':'slot:place0'});assert len(proposal['steps'])==3;d.execute({'kind':'bind'})
    for index,(before,after)in enumerate([('place0','select1'),('select1','complete'),('complete','score')]):
        d.execute({'kind':'before','scene':'slot:'+before,'index':index});d.execute({'kind':'after','before':'slot:'+before,'after':'slot:'+after,'index':index});d.execute({'kind':'record','before':'slot:'+before,'after':'slot:'+after,'index':index})
    d.execute({'kind':'propose','scene':'slot:epoch'});d.save()
    d=Driver('slot','refuted_selection_retires_bound_interface');d.execute({'kind':'propose','scene':'slot:initial'});d.execute({'kind':'record','before':'slot:initial','after':'slot:initial'});assert d.execute({'kind':'propose','scene':'slot:initial'})is None;d.save()

    # Typed dictionary and visible cursor. Rotations preserve full inner-mask identity.
    glyphs={'A':[(1,1)],'B':[(0,1),(1,1)],'C':[(0,0),(0,1),(1,1)]}
    def word_rows(letters=('C','C'),at=0):
        rows=[[0]*32 for _ in range(48)]
        def group(left,top,letters,hue):
            for index,letter in enumerate(letters):
                x=left+5*index;rect(rows,(x,top,x+4,top+4),hue)
                for dx,dy in glyphs[letter]:rows[top+1+dy][x+1+dx]=0
        group(2,2,['A'],1);group(16,2,['B'],2);group(2,20,['A','A'],1);group(2,35,letters,2)
        rows[33][4+5*at]=9;rows[41][4+5*at]=9;return rows
    for name,letters,at in [('initial',('C','C'),0),('editA',('A','C'),0),('editB',('B','C'),0),('cycleC',('C','C'),0),('focus1',('B','C'),1),('complete',('B','B'),1)]:observe('word:'+name,word_rows(letters,at),'word')
    observe('word:score',word_rows(('B','B'),1),'word',score=1);observe('word:epoch',word_rows(),'word',level=2,score=1)
    view=scenes['word:initial'];word_scene=word.scene(view['observation'],view['rows']);assert word_scene and word_scene['target']==word.glyphs(scenes['word:complete']['rows'],word_scene['editable'],word_scene['ink'])
    case('word','dictionary_scene','scene',{'scene':'word:initial'},lambda:word_scene)
    case('word','inner_mask_quarter_turn_orbit','glyphs',{'scene':'word:initial','group':word_scene['editable'],'ink':0},lambda:word.glyphs(view['rows'],word_scene['editable'],0))
    for scene in ['word:initial','word:focus1']:case('word','cursor_'+scene,'focus',{'scene':scene,'group':word_scene['editable'],'cursor':word_scene['cursor']},lambda scene=scene:word.focus(scenes[scene]['rows'],word_scene['editable'],word_scene['cursor']))
    graph={'ACTION1':{'A':'B','B':'C','C':'A'},'ACTION2':{'A':'C','C':'B','B':'A'}}
    for start,goal in [('A','C'),('A','A'),('A','D')]:case('word','edit_'+start+goal,'edit_path',{'graph':graph,'start':start,'goal':goal},lambda start=start,goal=goal:word.edit_path(graph,start,goal))
    for directions in [{'R':1,'L':-1},{'R':2},{}]:case('word','cursor_path_'+str(directions),'cursor_path',{'directions':directions,'start':0,'target':3,'n':5},lambda directions=directions:word.cursor_path(directions,0,3,5))
    for target in [('B','A','C'),('A','A','A'),('D','A','A')]:case('word','visit_'+''.join(target),'visit_plan',{'word':['A']*3,'goal':target,'at':0,'edits':graph,'directions':{'R':1,'L':-1}},lambda target=target:word.visit_plan(('A',)*3,target,0,graph,{'R':1,'L':-1}))
    d=Driver('word','learn_closed_cycle_inverse_cursor_then_realize_dictionary')
    for before,after in [('initial','editA'),('editA','editB'),('editB','cycleC'),('cycleC','editB'),('editB','focus1')]:
        assert d.execute({'kind':'propose','scene':'word:'+before});d.execute({'kind':'bind'});d.execute({'kind':'before','scene':'word:'+before});d.execute({'kind':'after','before':'word:'+before,'after':'word:'+after});d.execute({'kind':'record','before':'word:'+before,'after':'word:'+after})
    proposal=d.execute({'kind':'propose','scene':'word:focus1'});assert proposal['steps'][0]['expected_after']is not None
    d.execute({'kind':'after','before':'word:focus1','after':'word:complete'});d.execute({'kind':'record','before':'word:focus1','after':'word:score'});d.execute({'kind':'propose','scene':'word:epoch'});d.save()
    d=Driver('word','contradiction_refutes_prior_edit_cycle');d.execute({'kind':'propose','scene':'word:initial'});d.execute({'kind':'record','before':'word:initial','after':'word:editA'});d.execute({'kind':'propose','scene':'word:initial'});event=d.execute({'kind':'record','before':'word:initial','after':'word:editB'});assert event['prior_cycle_refuted'];d.save()
    rules=[SimpleNamespace(input_type_ref='a',output_type_ref='b',left=tuple(left),right=tuple(right),rule_ref=f'r{i}',provenance_refs=('observed',))for i,(left,right)in enumerate([('A','x'),('AB','y'),('B','z'),('A','q')])]
    def parser_case(name,word_value='AB',maximum=5,parses=20,budgets=(1000,)):
        progress={};journals=[]
        for limit in budgets:
            budget=_WordBudget(limit);resume=copy.deepcopy(progress);progress={};result=parse_typed_word(tuple(word_value),rules,'a','b',maximum,parses,budget,progress=progress,resume=resume)
            journals.append({'result':plain(result),'progress':plain(progress),'examined':str(budget.examined),'reached':budget.reached})
        cases.append({'family':'parser','id':name,'operation':'parse','arguments':{'word':list(word_value),'rules':plain(rules),'inputType':'a','outputType':'b','maximumOutput':maximum,'maximumParses':parses,'budgets':list(budgets)},'expected':journals})
    parser_case('all_derivations');parser_case('resume_scan_and_pending',budgets=(1,4,8,12,1000));parser_case('output_bound',maximum=1);parser_case('parse_bound',parses=1);parser_case('missing_suffix',word_value='AC');parser_case('empty_input',word_value='')

    # Visible rigid cells with ports; controlled translations expose all operators.
    def port_rows(poses=((0,1,2),(0,6,2)),hidden=False,revealed=False):
        rows=[[0]*28 for _ in range(20)]
        bodies=[{'material':{(0,0),(1,0),(2,0)},'ports':{(2,0)},'known':True},{'material':{(0,0),(1,0),(2,0)},'ports':{(0,0)},'known':True}]
        if hidden:bodies[0]={'material':{(0,0),(1,0),(2,0),(0,1)},'ports':{(2,0),(0,1)},'known':True}
        m={'unit':2,'phase':(0,1),'bodies':bodies}
        for index,pose in enumerate(poses):
            full,ports=port.placed(m,index,pose)
            for x,y in full:rect(rows,(2*x,1+2*y,2*x+1,2*y+2),4+index)
            if not(hidden and index==1 and not revealed):
                for x,y in ports:rect(rows,(2*x,1+2*y,2*x+1,2*y+2),9)
        return rows
    current=((0,1,2),(0,6,2));port_scenes=[]
    for name,poses in [('initial',current),('right',((0,2,2),current[1])),('down',((0,1,3),current[1])),('rotate',((1,1,2),current[1]))]:observe('port:'+name,port_rows(poses),'port')
    view=scenes['port:initial'];model=port.layout(view['observation'],view['rows']);assert model and len(model['bodies'])==2
    case('port','layout','layout',{'scene':'port:initial'},lambda:model)
    for rotation in range(4):case('port',f'view_{rotation}','view',{'material':[(0,0),(1,0),(2,0)],'ports':[(2,0)],'rotation':rotation},lambda rotation=rotation:port.view({(0,0),(1,0),(2,0)},{(2,0)},rotation),lambda value:[plain(value[0]),plain(value[1]),plain(list(value[2].items()))])
    case('port','neighbors','neighbors',{'point':[2,3]},lambda:port.neighbors((2,3)))
    case('port','cells','cells',{'scene':'port:initial','model':model},lambda:port.cells(view['rows'],model),lambda value:plain(list(value.items())))
    for index in range(2):case('port','placed_'+str(index),'placed',{'model':model,'index':index,'pose':current[index]},lambda index=index:port.placed(model,index,current[index]))
    for points in [{(0,0)},{(-1,2)},{(2,2)}]:case('port','in_bounds_'+str(sorted(points)),'in_bounds',{'model':model,'points':points},lambda points=points:port.in_bounds(model,points))
    for scene in ['port:initial','port:right','port:rotate']:
        case('port','infer_'+scene,'infer_poses',{'scene':scene,'model':model,'previous':current,'active':None},lambda scene=scene:port.infer_poses(scenes[scene]['rows'],model,current))
        case('port','agree_'+scene,'agrees',{'scene':scene,'model':model,'poses':current},lambda scene=scene:port.agrees(scenes[scene]['rows'],model,current))
    for pose in [(0,4,2),(0,5,2),(-1,1,2)]:case('port','compatible_'+str(pose),'compatible',{'model':model,'index':0,'pose':pose,'already':[[1,current[1]]]},lambda pose=pose:port.compatible(model,0,pose,{1:current[1]}))
    for active in (0,1,None):case('port','equal_cost_matching_'+str(active),'assembly',{'model':model,'current':current,'active':active,'rotationSign':None},lambda active=active:port.assembly(model,current,active,None))
    motion={'ACTION1':(1,0),'ACTION2':(-1,0),'ACTION3':(0,1),'ACTION4':(0,-1)}
    for overlap in (False,True):case('port','access_'+str(overlap),'access_path',{'model':model,'current':current,'index':0,'target':(0,8,2),'motion':motion,'allowOverlap':overlap},lambda overlap=overlap:port.access_path(model,current,0,(0,8,2),motion,overlap))
    for connected,acyclic in [(False,False),(True,True)]:
        finite=copy.deepcopy(model);finite.update(pose_domains=[[(0,4,2),(2,4,2)],[(0,6,2),(2,6,2)]],require_connected=connected,require_acyclic=acyclic)
        case('port',f'finite_domains_{connected}_{acyclic}','constrained_assembly',{'model':finite,'current':current,'active':0,'rotationSign':1},lambda finite=finite:{'result':port.constrained_assembly(finite,current,0,1),'search_nodes':finite['search_nodes']})
    d=Driver('port','calibrate_axial_translations_then_joint_matching')
    for before,after in [('initial','right'),('right','initial'),('initial','down'),('down','initial')]:
        assert d.execute({'kind':'propose','scene':'port:'+before});d.execute({'kind':'bind'});d.execute({'kind':'before','scene':'port:'+before});d.execute({'kind':'record','before':'port:'+before,'after':'port:'+after})
    proposal=d.execute({'kind':'propose','scene':'port:initial'});assert len(proposal['steps'])==3
    previous='port:initial'
    for index,step in enumerate(proposal['steps']):
        scene=observe(f'port:matching:{index}',port_rows(step['expected_after']),'port',score=1 if index==2 else 0)
        d.execute({'kind':'before','scene':previous,'index':index});d.execute({'kind':'after','before':previous,'after':scene,'index':index});d.execute({'kind':'record','before':previous,'after':scene,'index':index});previous=scene
    d.save()
    d=Driver('port','rotation_response_and_ambiguous_occupancy');d.execute({'kind':'propose','scene':'port:initial'});d.execute({'kind':'record','before':'port:initial','after':'port:rotate'});d.execute({'kind':'propose','scene':'port:rotate'});blank=observe('port:blank',[[0]*28 for _ in range(20)],'port');d.execute({'kind':'record','before':'port:rotate','after':blank});d.save()
    hidden=observe('port:hidden',port_rows(hidden=True),'port');revealed=observe('port:revealed',port_rows(hidden=True,revealed=True),'port')
    d=Driver('port','bind_selection_reveal_ports_then_measure_overlay_hypothesis');d.execute({'kind':'propose','scene':hidden});d.memory.motion=motion.copy();d.memory.active=0;d.memory.verified=set(motion);d.seed()
    proposal=d.execute({'kind':'propose','scene':hidden});assert proposal['steps'][0]['mode']=='select';d.execute({'kind':'bind'});d.execute({'kind':'before','scene':hidden});d.execute({'kind':'after','before':hidden,'after':revealed});d.execute({'kind':'record','before':hidden,'after':revealed})
    event_model=copy.deepcopy(d.memory.model);old=d.memory.current;predicted=(old[0],(old[1][0],old[1][1]-1,old[1][2]));step={'action':{'action_ref':'ACTION2'},'mode':'move','poses':old,'expected_after':predicted,'active':1,'overlap_hypothesis':True}
    d.execute({'kind':'proposal','proposal':{'actions':[step['action']],'steps':[step]}});d.execute({'kind':'record','before':revealed,'after':revealed});d.save()

    # Registered supports, public selector and measured motions. The tiny host
    # changes only raster positions; the unchanged family chooses every action.
    cross={(-2,0),(-1,0),(0,0),(1,0),(2,0),(0,-1),(0,1)}
    def cover_rows(poses=((5,12),(16,14)),active=0,hollow=False,hidden=False):
        rows=[[0]*24 for _ in range(20)];rows[0]=[10]*24
        for index,(x,y)in enumerate(poses):
            for dx,dy in cross:
                X,Y=x+dx,y+dy
                if 0<=X<24 and 1<=Y<20 and not(hollow and index==0 and dx==dy==0):rows[Y][X]=4+index
        for color,y in [(4,4),(5,8)]:
            for x in (8,12):rect(rows,(x-1,y-1,x+1,y+1),8);rows[y][x]=color
        if active is not None:
            x,y=poses[active]
            if not hidden:rows[y][x]=9
        return rows
    observe('cover:initial',cover_rows(),'cover');view=scenes['cover:initial'];model=cover.layout(view['observation'],view['rows']);assert model
    case('cover','layout','layout',{'scene':'cover:initial'},lambda:model)
    for op,callback in [('focus_loci',lambda:cover.focus_loci(view['rows'],model)),('focus',lambda:cover.focus(view['rows'],model)),('material',lambda:cover.material(view['rows'],model))]:case('cover',op,op,{'scene':'cover:initial','model':model},callback,lambda value:plain(list(value.items()))if isinstance(value,dict)else plain(value))
    case('cover','components_eight_connected','components',{'points':[(0,0),(1,1),(8,8),(8,9)]},lambda:list(cover.components({(0,0),(1,1),(8,8),(8,9)})))
    samples=[]
    for position in [(5,12),(6,12),(6,13)]:
        raster=cover_rows((position,(16,14)));samples.append({'focus':position,'material':cover.material(raster,model)})
    learned=cover.acquire(samples,model);assert learned
    case('cover','acquire_independent_displacements','acquire',{'samples':samples,'model':model},lambda:learned)
    case('cover','acquire_reject_collinear','acquire',{'samples':samples[:2],'model':model},lambda:cover.acquire(samples[:2],model))
    bodies=[{'color':4,'mask':cross.copy(),'pose':(5,12)},{'color':5,'mask':cross.copy(),'pose':(16,14)}];poses=[(5,12),(16,14)]
    case('cover','body_pixels','body_pixels',{'body':bodies[0],'pose':poses[0]},lambda:cover.body_pixels(bodies[0],poses[0]))
    case('cover','censored_boundary','outside',{'points':[(-1,3),(2,0),(5,5),(30,4)],'model':model},lambda:cover.outside({(-1,3),(2,0),(5,5),(30,4)},model))
    for point in [(5,12),(7,13),(8,12)]:case('cover','envelope_'+str(point),'within_envelope',{'body':bodies[0],'pose':poses[0],'point':point},lambda point=point:cover.within_envelope(bodies[0],poses[0],point))
    case('cover','registered_agreement','agrees',{'scene':'cover:initial','model':model,'bodies':bodies,'poses':poses,'cursor':poses[0],'active':0},lambda:cover.agrees(view['rows'],model,bodies,poses,poses[0],0))
    options=cover.mechanical_pose_options(view['observation'],view['rows'],bodies,poses,model,1)
    case('cover','native_bounded_pose_measurement','mechanical_pose_options',{'scene':'cover:initial','model':model,'bodies':bodies,'poses':poses,'quantum':1},lambda:options,lambda value:None if value is None else plain(list(value.items())))
    for option in (None,options):case('cover','joint_goal_'+str(option is None),'joint_goal',{'model':model,'bodies':bodies,'poses':poses,'quantum':1,'options':None if option is None else list(option.items())},lambda option=option:cover.joint_goal(bodies,poses,model,1,option))
    select=observe('cover:select',cover_rows(active=1),'cover')
    case('cover','selection_occlusion','selection_effect',{'first':'cover:initial','second':select,'model':model,'old':poses[0],'new':poses[1]},lambda:cover.selection_effect(view['rows'],scenes[select]['rows'],model,*poses))
    for expected in [poses[0],poses[1]]:case('cover','cursor_'+str(expected),'cursor_at',{'scene':'cover:initial','model':model,'expected':expected,'bodies':bodies,'poses':poses,'active':0},lambda expected=expected:cover.cursor_at(view['rows'],model,expected,bodies,poses,0))
    d=Driver('cover','acquire_two_owners_learn_selector_joint_cover');positions=[(5,12),(16,14)];active=0;previous='cover:initial';actions=0;planning_checkpoint=None
    vectors={'ACTION1':(1,0),'ACTION2':(-1,0),'ACTION3':(0,1),'ACTION4':(0,-1)}
    while actions<80:
        proposal=d.execute({'kind':'propose','scene':previous});assert proposal,('cover stopped',actions,d.memory.retired,d.memory.complete)
        d.execute({'kind':'bind'})
        if d.memory.complete and planning_checkpoint is None:planning_checkpoint=(copy.deepcopy(d.memory),copy.deepcopy(proposal),previous)
        finished=False
        for index,step in enumerate(proposal['steps']):
            d.execute({'kind':'before','scene':previous,'index':index});command=step['action']['action_ref']
            if command=='ACTION5':active=1-active
            else:positions[active]=cover.plus(positions[active],vectors[command])
            actions+=1;finished=all(set(model['targets'][body['color']])<=cover.body_pixels(body,pose)for body,pose in zip(bodies,positions))
            following=observe(f'cover:run:{actions}',cover_rows(positions,active),'cover',score=1 if finished else 0)
            guard=d.execute({'kind':'after','before':previous,'after':following,'index':index});d.execute({'kind':'record','before':previous,'after':following,'index':index});previous=following
            if guard['seal_prefix'] or finished:break
        if finished:break
    assert finished and planning_checkpoint is not None;d.save()
    # Same retained evidence, failed public movement; no changed source or oracle result.
    d=Driver('cover','predicted_motion_refuted');d.memory,d.proposal,previous=copy.deepcopy(planning_checkpoint);d.seed();d.execute({'kind':'after','before':previous,'after':previous});event=d.execute({'kind':'record','before':previous,'after':previous});assert event['status']=='rigid_motion_refuted';d.execute({'kind':'propose','scene':previous});d.save()
    d=Driver('cover','focus_ambiguous_retires');d.execute({'kind':'propose','scene':'cover:initial'});missing=observe('cover:no_focus',cover_rows(active=None),'cover');event=d.execute({'kind':'record','before':'cover:initial','after':missing});assert event['status']=='focus_ambiguous';d.save()

    # Full V5 bounded measurement: validation, disconnected supports, retained
    # targets, scoped templates, association witnesses and budget exhaustion.
    def native_components(observation):
        out=[]
        for entity in observation['entities']:
            l,t,r,b=entity['bbox'];relative=tuple(sorted((y,x)for x,y in entity['mask']))
            out.append(SimpleNamespace(bbox=SimpleNamespace(left=l,top=t,width=r-l+1,height=b-t+1),area=entity['area'],pixels=tuple((t+y,l+x)for y,x in relative),relative_pixels=relative,value=entity['palette_value'],touches_frame_boundary=l==0 or t==0 or r==23 or b==19))
        return out
    contract={'maximum_pixels':480,'maximum_groups':2,'minimum_markers':2,'maximum_markers':4,'ring_widths':[3],'minimum_support_pixels':3,'maximum_support_pixels':480,'indicator_role_ref':'focus','neighbour_offsets':cover.NEIGHBORS,'minimum_internal_neighbours':2,'maximum_midpoint_twice_offset':1,'maximum_poses_per_group':480,'maximum_visible_support_partitions':8}
    association=[{'active':True,'role_ref':'focus','normalized_valued_pixels':((0,0,9),),'term_ref':'focus_visible','source_claim_refs':['public_frame']}]
    native=native_components(view['observation'])
    targets=[{'partition_value':color,'marker_centres':tuple((y,x)for x,y in points),'marker_ring_rows':tuple(model['marker_rows'][color])}for color,points in model['targets'].items()]
    templates=[{'partition_value':body['color'],'relative_support_pixels':tuple((y,x)for x,y in body['mask']),'indicator_position':(pose[1],pose[0])}for body,pose in zip(bodies,poses)]
    base={'frame':view['rows'],'components':native,'quantum':1,'contract':contract,'association_rows':association}
    for name,updates in [('visible',{}),('templates',{'prior_target_rows':targets,'prior_body_rows':templates}),('no_contract',{'contract':None}),('no_quantum',{'quantum':0}),('bad_frame',{'frame':[[0],[0,1]]}),('pixel_bound',{'contract':{**contract,'maximum_pixels':1}}),('pose_bound',{'contract':{**contract,'maximum_poses_per_group':0}}),('duplicate_targets',{'prior_target_rows':[targets[0],targets[0]]}),('invalid_template',{'prior_body_rows':[{**templates[0],'indicator_position':(-1,0)}]})]:
        arguments={**base,**updates};case('rigid',name,'measure',arguments,lambda arguments=arguments:measure_rigid_marker_poses(**arguments))
    sys.setprofile(None)
    data={'schema':'v6.interface-families-reference.v1','provenance':{'commit':COMMIT,'sourceHashes':hashes},'normalization':{'sets':'sorted values except explicitly retained coordinate-set table codecs','coordinateSetOrder':'CPython 3.12, 64-bit tuple hash and table slots; every browser state restore retains them','fixtures':'controlled public raster scenarios, not game benchmarks'},'coveredFunctions':{name:sorted(values)for name,values in covered.items()},'scenes':scenes,'cases':cases,'scenarios':scenarios}
    args.output.write_text(json.dumps(data,separators=(',',':'),ensure_ascii=True)+'\n',encoding='utf-8')
    print(json.dumps({'cases':len(cases),'scenarios':len(scenarios),'operations':sum(len(s['steps'])for s in scenarios),'coverActions':actions,'covered':data['coveredFunctions']}))

if __name__=='__main__':main()
