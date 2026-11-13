#!/usr/bin/env python3
"""Source oracle for the remaining public geometry, matching and target methods."""
from pathlib import Path
from copy import deepcopy
from types import SimpleNamespace
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
COMMIT='786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE=ROOT/'reference/v6'/COMMIT/'source';LAYA=SOURCE/'agents/yf_arc3_v6/laya_proto'
sys.path[:0]=[str(LAYA),str(SOURCE)]
import geometric_observer as geo
import target_method
from agents.yf_arc3_v5.capabilities.components import detect_components,enumerate_component_matches
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid,ComponentExtractionInput,ComponentMatchInput

def plain(value):
    if hasattr(value,'model_dump'):return plain(value.model_dump(mode='json'))
    if isinstance(value,dict):return {k:plain(v)for k,v in value.items()}
    if isinstance(value,(set,frozenset)):return [plain(v)for v in sorted(value)]
    if isinstance(value,(list,tuple)):return [plain(v)for v in value]
    return value
cases=[]
def capture(operation,name,args,call):
    item=dict(operation=operation,id=name,args=plain(deepcopy(args)))
    try:item['expected']=plain(call())
    except Exception as e:item['error']=str(e)
    cases.append(item)
def blank(w=48,h=48):return [[0]*w for _ in range(h)]
def rect(rows,x,y,w,h,color):
    for yy in range(y,y+h):
        for xx in range(x,x+w):rows[yy][xx]=color
def pattern(rows,x,y,mask,scale,color):
    for xx,yy in mask:rect(rows,x+xx*scale,y+yy*scale,scale,scale,color)
mask={(0,0),(0,1),(0,2),(1,2),(2,2)}
rows=blank();rect(rows,1,1,46,46,9);rect(rows,6,6,12,12,2);rect(rows,30,9,7,7,4)
pattern(rows,9,9,mask,2,3);pattern(rows,32,11,mask,1,3)
policy={'role_rules':[
    dict(id='display',when=dict(paired_shape=True,larger_scale=True),status='hypothesis',falsifier='different-pair'),
    dict(id='target',when=dict(paired_shape=True,smaller_scale=True),status='hypothesis',falsifier='different-pair'),
    dict(id='substrate',when=dict(largest_interior_component=True,rectangular=False),status='hypothesis',falsifier='unregistered-support')
]}
parts=geo.components(rows)
capture('compact','all-measured-components',[parts],lambda:geo.compact(parts))
for name,occlusion in [('visible',None),('partly-occluded',[9,9,10,10]),('target-occluded',[30,9,36,15]),('fully-occluded',[0,0,47,47])]:
    capture('patterns',name,[rows,parts,occlusion],lambda o=occlusion:geo.framed_patterns(rows,parts,o))
for colors in [(0,8),(8,0),(31,255),(255,31)]:
    fake=[[colors[x%2]for x in range(6)]for y in range(6)];part=dict(id='given',bbox=[0,0,5,5],rectangular=False,color=7)
    capture('patterns','two-color-order-'+str(colors),[fake,[part],None],lambda f=fake,p=part:geo.framed_patterns(f,[p]))
capture('alignment','paired-scaled-islands',[rows,policy,None],lambda:geo.alignment_scene(rows,policy))
rotated=deepcopy(rows);rect(rotated,30,9,7,7,4);pattern(rotated,32,11,geo.rotate(mask),1,3)
capture('alignment','orientation-residual',[rotated,policy,None],lambda:geo.alignment_scene(rotated,policy))
recolored=deepcopy(rows);pattern(recolored,32,11,mask,1,5)
capture('alignment','color-residual',[recolored,policy,None],lambda:geo.alignment_scene(recolored,policy))
capture('alignment','no-pair',[blank(),policy,None],lambda:geo.alignment_scene(blank(),policy))
ambiguous={'role_rules':policy['role_rules']+[dict(id='unbound',when={'absent':None},status='hypothesis',falsifier='changed')]}
capture('alignment','ambiguous-substrate',[rows,ambiguous,None],lambda:geo.alignment_scene(rows,ambiguous))
for facts in [{},{'value':True},{'value':1},{'value':False},{'value':None},{'value':[1,2]}]:
    rules=[dict(id=str(i),when={'value':v})for i,v in enumerate([None,True,1,False,[1,2]])]
    capture('rules','facts-'+str(facts),[rules,facts],lambda f=facts,r=rules:geo.matching_rules(r,f))

before=blank(24,20);pattern(before,3,4,mask,1,2);pattern(before,11,5,{(0,0),(1,0),(1,1)},1,3)
after=blank(24,20);pattern(after,6,5,mask,1,2);pattern(after,14,6,{(0,0),(1,0),(1,1)},1,3)
other=deepcopy(after);rect(other,14,6,2,2,0);pattern(other,14,9,{(0,0),(1,0),(1,1)},1,3)
for name,a,b,box in [('joint-translation',before,after,None),('bounded-body',before,after,[2,3,6,7]),('incompatible-vectors',before,other,None),('unobserved',before,before,None)]:
    aa,bb=geo.components(a),geo.components(b)
    capture('moved',name,[aa,bb,box],lambda a=aa,b=bb,x=box:geo.moved_body(a,b,x))
for step in [1,2,3,4,-2]:
    board=blank(12,10);rect(board,1,1,10,8,9);rect(board,5,1,1,5,0)
    scene={'substrate':{'bbox':[1,1,10,8],'color':9},'target':{'center':[9,7]}};body={'center':[3,3]}
    def paths(s=step):
        cells,paths=geo.grid_paths(board,scene,body,s)
        return {'cells':[[list(k),v]for k,v in cells.items()],'paths':[[list(k),v]for k,v in paths.items()]}
    capture('paths','lattice-'+str(step),[board,scene,body,step],paths)

def extraction(board,connectivity=4):
    return detect_components(ComponentExtractionInput(frame=FrameGrid(rows=tuple(tuple(row)for row in board)),connectivity=connectivity))
duplicate=deepcopy(after);pattern(duplicate,18,14,mask,1,2)
missing=deepcopy(after);rect(missing,6,5,3,3,0)
for name,a,b,connectivity in [('unique',before,after,4),('ambiguous-after',before,duplicate,4),('ambiguous-before',duplicate,before,4),('unmatched',before,missing,4),('diagonal',before,after,8)]:
    value=ComponentMatchInput(before=extraction(a,connectivity),after=extraction(b,connectivity),action_ref='control.current')
    capture('matches',name,[a,b,connectivity,'control.current'],lambda v=value:enumerate_component_matches(v))

tree=dict(observation_ref='before',retained_target=dict(pair_ref='pair',composition='turn-and-access',verified_child_effect={'orientation_changed':True}),
    preceding_peer_access=dict(complete=True,pair_ref='pair',level_epoch=2,after='before',role_refs=['a','b'],motion_examples={'ACTION4':[2,0]}))
witness=dict(levels_completed_before=1,levels_completed_after=2,source_level=2,before_observation_ref='before',after_observation_ref='scored')
capture('boundary','qualified-boundary',[tree,witness],lambda:target_method.at_boundary(tree,witness))
for field,value in [('levels_completed_after',1),('levels_completed_after',3),('source_level',4),('before_observation_ref','stale')]:
    altered={**witness,field:value}
    capture('boundary',field,[tree,altered],lambda w=altered:target_method.at_boundary(tree,w))
for name,change in [('no-target',lambda t:t.pop('retained_target')),('no-effect',lambda t:t['retained_target'].update(verified_child_effect={})),
                    ('incomplete',lambda t:t['preceding_peer_access'].update(complete=False)),('different-pair',lambda t:t['preceding_peer_access'].update(pair_ref='other')),
                    ('stale-access',lambda t:t['preceding_peer_access'].update(after='stale'))]:
    altered=deepcopy(tree);change(altered)
    capture('boundary',name,[altered,witness],lambda t=altered:target_method.at_boundary(t,witness))
method=target_method.at_boundary(tree,witness)
decision=dict(composition='turn-and-access',measured_facts=dict(framed_pair=True,homologous=True,asymmetric=True,alignment_refuted=False))
current=dict(epoch=3,roles=dict(a={},b={}))
def recall(name,m,d,c):capture('recall',name,[m,d,c],lambda:target_method.recalled_directions(m,d,SimpleNamespace(**c)))
recall('new-epoch',method,decision,current);recall('no-method',None,decision,current)
recall('same-epoch',method,decision,{**current,'epoch':2});recall('missing-role',method,decision,{**current,'roles':{'a':{}}})
recall('different-composition',method,{**decision,'composition':'another'},current)
for field,value in [('framed_pair',False),('homologous',False),('asymmetric',False),('alignment_refuted',True)]:
    changed=deepcopy(decision);changed['measured_facts'][field]=value;recall(field,method,changed,current)
files=[LAYA/'geometric_observer.py',LAYA/'target_method.py',SOURCE/'agents/yf_arc3_v5/capabilities/components.py']
result=dict(commit=COMMIT,sourceHashes={str(p.relative_to(SOURCE)):hashlib.sha256(p.read_bytes()).hexdigest()for p in files},cases=cases)
(ROOT/'tests/fixtures/v6-geometry-reference.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'cases':len(cases),'positiveAlignment':sum(c['operation']=='alignment'and'expected'in c for c in cases)}))
