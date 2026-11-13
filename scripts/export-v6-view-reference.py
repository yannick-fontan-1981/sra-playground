#!/usr/bin/env python3
"""Exact original view-frontier references over synthetic public measurements."""
from pathlib import Path
from copy import deepcopy
from types import SimpleNamespace
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1];COMMIT='786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE=ROOT/'reference/v6'/COMMIT/'source';LAYA=SOURCE/'agents/yf_arc3_v6/laya_proto'
sys.path[:0]=[str(LAYA),str(SOURCE)]
import common_view_frontier as v
from common_mechanisms import construct_empirical_rule,validate_empirical_rule
def plain(x):return json.loads(json.dumps(x))
def packed(x):return json.dumps(x,sort_keys=True,separators=(',',':'))
def entity(sig,x,y,color=2):return {'id':sig,'signature':sig,'position':[x,y],'mask':[[0,0]],'palette_value':color,'area':1,'scale':1}
def scene(name,x,wall=True,epoch=1):
    rows=[[0]*20 for _ in range(16)];es=[entity('actor',x,5,9),entity('anchor:a',1,1,2),entity('anchor:b',17,1,3),entity('anchor:c',1,13,4)]
    if wall:es.append(entity('wall',8,5,7))
    for e in es:xx,yy=e['position'];rows[yy][xx]=e['palette_value']
    obs={'observation_ref':name,'frame_hash':name,'level_epoch':epoch,'levels_completed':epoch-1,'state':'NOT_FINISHED','revision':1,
         'coordinate_basis':'screen','entities':es,'available_action_refs':['ACTION1','ACTION6']}
    return {'observation':obs,'rows':rows}
def snapshot(obj):
    def entries(mapping,convert=lambda x:x):return [[plain(k),convert(value)]for k,value in sorted(mapping.items(),key=lambda row:packed(row[0]))]
    return {'epoch':obj.epoch,'origin':list(obj.origin),'segment':obj.segment,'coverage':sorted(obj.coverage),
            'offsets':{k:sorted(value)for k,value in sorted(obj.offsets.items())},'offset_source':entries(obj.offset_source),
            'footprints':entries(obj.footprints,lambda value:sorted(value,key=packed)), 'pass_refs':entries(obj.pass_refs),
            'block':obj.block,'followup':obj.followup,'tested':sorted(obj.tested),'access_trials':entries(obj.access_trials),
            'known_signatures':sorted(obj.known_signatures),'reveals':obj.reveals,'engaged':obj.engaged,'visible_hypotheses':obj.visible_hypotheses}
def export():
    scenes={f'x{x}':scene(f'x{x}',x)for x in range(2,9)}
    scenes['clear']=scene('clear',7,False);scenes['reopened']=scene('reopened',8,False);scenes['boundary']=scene('boundary',2,epoch=2)
    first=[[((x*11+y*7+x*y)%5)+1 for x in range(24)]for y in range(16)]
    second=[[first[y][x-3]if x>=3 else 8+(x%2)for x in range(24)]for y in range(16)]
    one={'observation_ref':'bulk:before','frame_hash':'bulk:before','level_epoch':1,'levels_completed':0,'state':'NOT_FINISHED','available_action_refs':['ACTION1','ACTION6'],
         'entities':[entity('left',3,3),entity('right',15,9),entity('up',5,12)]}
    two=deepcopy(one);two.update(observation_ref='bulk:after',frame_hash='bulk:after')
    for e in two['entities']:e['position'][0]+=3
    two['entities'].append(entity('new',1,4,8))
    scenes['bulk_before']={'observation':one,'rows':first};scenes['bulk_after']={'observation':two,'rows':second}
    scenes['unregistered']={'observation':dict(two,observation_ref='unknown',frame_hash='unknown'),'rows':[[15]*24 for _ in range(16)]}
    cases=[];scenarios=[]
    def case(name,operation,args,fn):
        row={'id':name,'operation':operation,'args':args}
        try:row['expected']=plain(fn())
        except Exception as e:row['error']=str(e)
        cases.append(row)
    for a,b in [('x2','x3'),('bulk_before','bulk_after'),('bulk_after','unregistered'),('x2','bulk_after')]:
        aa,bb=scenes[a],scenes[b]
        case(f'registration:{a}:{b}','registration',[a,b],lambda:v.global_registration(aa['observation'],bb['observation'],aa['rows'],bb['rows']))
    case('unique','unique',['x2'],lambda:v.unique(scenes['x2']['observation']))
    duplicated=deepcopy(scenes['x2']);duplicated['observation']['entities'].append(deepcopy(duplicated['observation']['entities'][0]));scenes['duplicated']=duplicated
    case('duplicate_signature','unique',['duplicated'],lambda:v.unique(duplicated['observation']))
    case('rectangle','rectangle',[[3,-2],4,3],lambda:sorted(v.rectangle((3,-2),4,3)))
    case('shifted','shifted',[[[1,2],[3,4]],[-2,1]],lambda:sorted(v.shifted({(1,2),(3,4)},(-2,1))))
    case('motion_key','motion_key',['ACTION1',['z','a'],[1,0],[[3,2],[4,2]]],lambda:v.motion_key('ACTION1',['z','a'],(1,0),{(3,2),(4,2)}))
    command={'action_ref':'ACTION1'}
    rule=construct_empirical_rule(scenes['x2']['observation'],scenes['x3']['observation'],command)
    rule=validate_empirical_rule(rule,scenes['x4']['observation'],scenes['x5']['observation'],command)
    case('movement','movement',[rule,'x3'],lambda:[*v.ViewFrontier._movement(rule,scenes['x3']['observation'])[:3],sorted(v.ViewFrontier._movement(rule,scenes['x3']['observation'])[3])])
    for name,r in [('candidate',dict(rule,status='candidate')),('pointed',dict(rule,conditions=dict(rule['conditions'],action={'action_ref':'ACTION6','data':{'x':3,'y':5}})))]:
        case('movement_'+name,'movement',[r,'x3'],lambda:v.ViewFrontier._movement(r,scenes['x3']['observation']))
    class Scenario:
        def __init__(self,name):
            self.view=v.ViewFrontier();self.saved={};self.rows=[];scenarios.append({'id':name,'steps':self.rows})
        def step(self,operation,*args,save=None):
            row={'operation':operation,'args':deepcopy(args)}
            try:
                if operation=='initialize':s=scenes[args[0]];result=self.view.initialize(s['observation'],s['rows'])
                elif operation=='propose':s=scenes[args[0]];result=self.view.propose(s['observation'],s['rows'],args[1],args[2],args[3])
                elif operation=='before':p=self.saved[args[0]];s=scenes[args[2]];o=s['observation'];result=self.view.before(p,args[1],SimpleNamespace(level=o['level_epoch'],levels_completed=o['levels_completed'],available_action_refs=o['available_action_refs']),o)
                elif operation=='after':p=self.saved[args[0]];a,b=scenes[args[2]],scenes[args[3]];result=self.view.after(p,args[1],a['observation'],b['observation'],a['rows'],b['rows'])
                elif operation=='record':
                    a,b=scenes[args[0]],scenes[args[1]];p=self.saved.get(args[3],{})
                    result=self.view.record(a['observation'],b['observation'],args[2],a['rows'],b['rows'],p,args[4])
                elif operation=='has_question':result=self.view.has_observed_view_question()
                else:raise AssertionError(operation)
                row['expected']=plain(result)
                if save:self.saved[save]=result;row['save']=save
            except Exception as e:row['error']=str(e)
            row['state']=plain(snapshot(self.view));self.rows.append(row)
            return row.get('expected')
    q=Scenario('known_entry_and_obstruction_cycle');q.step('initialize','x2');q.step('has_question')
    q.step('record','x2','x3',command,None,0)
    p=q.step('propose','x3',[command,{'action_ref':'ACTION6','data':{'x':8,'y':5}}],[rule],16,save='approach')
    q.step('before','approach',0,'x3');q.step('before','approach',0,'x4')
    for index,x in enumerate(range(3,8)):
        after=f'x{x+1}'if x<7 else 'x7'
        q.step('after','approach',index,f'x{x}',after);q.step('record',f'x{x}',after,command,'approach',index)
    q.step('has_question');q.step('propose','x7',[command,{'action_ref':'ACTION6','data':{'x':8,'y':5}}],[rule],16,save='confirm')
    q.step('record','x7','x7',command,'confirm',0)
    q.step('propose','x7',[command,{'action_ref':'ACTION6','data':{'x':8,'y':5}}],[rule],16,save='intervention')
    q.step('record','x7','clear',{'action_ref':'ACTION6','data':{'x':8,'y':5}},'intervention',0)
    q.step('propose','clear',[command],[rule],16,save='followup');q.step('after','followup',0,'clear','reopened')
    q.step('record','clear','reopened',command,'followup',0);q.step('record','reopened','boundary',command,None,0)
    q=Scenario('bulk_registration_coverage_and_loss');q.step('record','bulk_before','bulk_after',command,None,0);q.step('has_question')
    q.step('record','bulk_after','unregistered',command,None,0);q.step('initialize','boundary');q.step('has_question')
    q=Scenario('new_unmeasured_entry');q.step('propose','x3',[command],[rule],16,save='single');q.step('propose','x3',[command],[rule],0)
    q.step('record','x3','x3',command,'single',0);q.step('propose','x3',[command],[rule],16,save='retry');q.step('record','x3','x3',command,'retry',0);q.step('propose','x3',[command],[rule],16)
    hashes={str(p.relative_to(SOURCE)):hashlib.sha256(p.read_bytes()).hexdigest()for p in [LAYA/'common_view_frontier.py']}
    destination=ROOT/'tests/fixtures/v6-view-reference.json';destination.write_text(json.dumps(dict(commit=COMMIT,sourceHashes=hashes,scenes=scenes,cases=cases,scenarios=scenarios),indent=2)+'\n')
    errors=[(s['id'],i,x['operation'],x['error'])for s in scenarios for i,x in enumerate(s['steps'])if 'error'in x]
    print(json.dumps({'cases':len(cases),'scenarioOperations':sum(len(s['steps'])for s in scenarios),'errors':errors}))
if __name__=='__main__':export()
