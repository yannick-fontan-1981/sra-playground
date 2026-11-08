#!/usr/bin/env python3
"""Development-only unchanged V6 oracle for four SupportNavigation procedures.

Real ONDE is autonomous. DICO/GLOB use explicitly recorded public priming
experiments where their standalone provider abstains; these are not full-caller
game-win claims. Synthetic frames exercise mechanism branches, never runtime
selection by game identity. No Python agent is packaged in the browser.
"""
from pathlib import Path
from types import SimpleNamespace
import copy,gzip,hashlib,json,runpy,shutil,sys,tempfile,zipfile

ROOT=Path(__file__).resolve().parents[1]
COMMIT='786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE=ROOT/'reference/v6'/COMMIT/'source';LAYA=SOURCE/'agents/yf_arc3_v6/laya_proto'
sys.path[:0]=[str(SOURCE),str(LAYA)]
from common_periodic_sums import PeriodicSums,measure as periodic_scene,offsets
from common_subset_diagnosis import SubsetDiagnosis,measured_scene as subset_scene,feedback
from common_subset_diagnosis import scope as subset_scope,HierarchyNodeD,HierarchyNavigationD,HierarchicalProbeRequestD,measure_hierarchical_probe_d
from common_fixed_origin import FixedOrigin,scene as fixed_scene,fill,bands,port_rule,fit_port_rules,program_samples,connected_ports,stroke_ports
from common_reflected_cover import ReflectedCover,lattice,initialize,encode,decode,focus,matches
from common_multiscale_constraints import digest
from neutral_observer import measure
from observed_input_domain import ObservedInputDomain
from src_bridge import plain
from agents.yf_arc3_v5.capabilities.fixed_program_origin import FixedProgramModel,FixedProgramRequest,ProgramPose,measure_fixed_program_origin
from agents.yf_arc3_v5.capabilities.mechanical_family_contracts_d import DMechanicalScope
from agents.yf_arc3_v5.capabilities.reflection_structure import measure_orthogonal_reflection_lattice_object_audit

POLICY=json.loads((LAYA/'common_frontier_policy.drm.json').read_text())
scenes={};cases=[];journals=[];games=[];guarded=set()
def normalize(v):return json.loads(json.dumps(plain(v)))
def observe(rows,index=0,level=1,score=0,frames=None,available=None,state='NOT_FINISHED'):
    rows=normalize(rows);raw=SimpleNamespace(frame_rows=rows,frame_packet=frames or [rows],level=level,levels_completed=score,state=state,step_index=index,available_action_refs=available or ['ACTION1','ACTION2','ACTION3','ACTION4','ACTION5','ACTION6'],frame_hash=hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest()[:16]);obs,_=measure(raw,index+1,'support-procedure-reference')
    return {'rows':rows,'public':normalize(vars(raw)),'observation':normalize(obs)}
def add(name,view):scenes[name]=view;return name
def from_engine(name,e,index):return add(name,observe(e['frame'],index,e['level'],e['levelsCompleted'],e['frames'],[f'ACTION{x}'for x in e['availableActionIds']],e['state']))
def case(name,op,args,result):cases.append({'id':name,'operation':op,'arguments':normalize(args),'expected':normalize(result)})
def reflection_scene(s):
    if s is None:return None
    return {**{k:normalize(v)for k,v in s.items()if k not in ('cells','marks','mark_values','families')},'cells':[[list(k),v]for k,v in s['cells'].items()],'marks':list(map(list,sorted(s['marks']))),'mark_values':[[list(k),v]for k,v in s['mark_values'].items()],'families':[[k,list(map(list,sorted(v)))]for k,v in s['families'].items()]}
def state_of(f):
    if not isinstance(f,ReflectedCover):return normalize(f.state())
    return normalize({'format':'native.reflected_cover.v1',**{k:getattr(f,k)for k in ('epoch','ready','axis_movable','prior_color','prior_marker','prior_image','refs','events','audit')},'world':encode(f.world)if f.world else None,'effects':[[list(k),list(v)]for k,v in f.effects.items()],'current_known':sorted(f.current_known),'axes_seen':sorted(f.axes_seen)})
FACTORIES={'periodic_sums':PeriodicSums,'subset_diagnosis':SubsetDiagnosis,'fixed_origin':FixedOrigin,'reflected_cover':ReflectedCover}
class Driver:
    def __init__(self,family,name):self.family=family;self.name=name;self.f=FACTORIES[family]();self.proposal=None;self.steps=[]
    def step(self,op):
        kind=op['kind'];result=None
        if kind=='propose':
            v=scenes[op['scene']];inputs=ObservedInputDomain(256).candidates(v['observation']);self.proposal=self.f.propose(v['observation'],v['rows'],inputs,op.get('remaining',400));result=self.proposal
            if result and self.family not in guarded:
                guarded.add(self.family);memory=state_of(self.f)
                for field,value in [('level',999),('levels_completed',999),('frame_hash','changed-frame'),('available_action_refs',[])]:
                    raw=copy.deepcopy(v['public']);raw[field]=value
                    expected=self.f.before(result,0,SimpleNamespace(**raw),v['observation'])
                    case(self.family+'_guard_'+field,'family_guard',{'family':self.family,'state':memory,'proposal':result,'scene':op['scene'],'public':raw},expected)
                if self.family in ('periodic_sums','subset_diagnosis'):
                    changed=copy.deepcopy(result);changed['actions'][0]={'action_ref':'ACTION7'}
                    case(self.family+'_guard_changed_input','family_guard',{'family':self.family,'state':memory,'proposal':changed,'scene':op['scene'],'public':v['public']},self.f.before(changed,0,SimpleNamespace(**v['public']),v['observation']))
        elif kind=='before':
            v=scenes[op['scene']];result=self.f.before(self.proposal,op.get('index',0),SimpleNamespace(**v['public']),v['observation'])
        elif kind in ('after','record'):
            a,b=scenes[op['before']],scenes[op['after']];index=op.get('index',0)
            if kind=='after':result=self.f.after(self.proposal,index,a['observation'],b['observation'],a['rows'],b['rows'])
            else:result=self.f.record(a['observation'],b['observation'],op.get('command',self.proposal['actions'][index]if self.proposal else None),a['rows'],b['rows'],self.proposal,index,frames=b['public']['frame_packet'])
        elif kind=='proposal':self.proposal=copy.deepcopy(op['proposal']);result=self.proposal
        else:raise ValueError(kind)
        state=state_of(self.f);self.steps.append({'operation':normalize(op),'expected':{'result':copy.deepcopy(normalize(result)),'stateDigest':digest(state)}});return result
    def done(self):journals.append({'id':self.name,'family':self.family,'steps':self.steps,'finalState':state_of(self.f)})

def rect(rows,x,y,w,h,color):
    for r in range(y,y+h):
        for c in range(x,x+w):rows[r][c]=color
def fixed_frame(actor=None,active=None):
    rows=[[0]*64 for _ in range(64)]
    for i in range(6):rect(rows,4+9*i,6,4,4,7 if actor==i else 4 if i==5 else 2)
    for i in range(3):
        x=8+14*i;y=42;color=6 if active==i else 5
        for yy in range(y,y+7):rows[yy][x]=rows[yy][x+6]=color
        for xx in range(x,x+7):rows[y][xx]=rows[y+6][xx]=color
        rows[y+2][x+2]=8;rows[y+3][x+2]=8;rows[y+3][x+3]=8
    return rows
def reflection_frame(body,axis=7,owner=0,targets=None):
    targets=targets or {(3,7),(3,8),(4,8),(11,7),(11,8),(10,8)}
    rows=[[0]*64 for _ in range(64)]
    for color,points in ((4,targets),(3,{(2*axis-x,y)for x,y in body}),(2,body)):
        for x,y in points:
            if 0<=x<16 and 0<=y<16:rect(rows,4*x,4*y,4,4,color)
    rect(rows,4*axis,0,4,64,1)
    if owner=='axis':rows[0][4*axis]=9
    elif owner==0:
        x,y=min(body);rows[4*y][4*x]=9
    return rows

def subset_navigation_cases(obs):
    scene={'boxes':[[]for _ in range(9)],'focus':list(range(6))};tested=[0,1,2];family=SubsetDiagnosis();family.candidates=set(tested);output=[]
    for remaining in (0,1,17):
        nodes=(HierarchyNodeD(node_ref='U',parent_ref=None,member_refs=tuple(map(str,range(9))),native_query_input_ref=None),HierarchyNodeD(node_ref='F',parent_ref='U',member_refs=tuple(map(str,range(6))),native_query_input_ref=None),HierarchyNodeD(node_ref='Q',parent_ref='F',member_refs=tuple(map(str,tested)),native_query_input_ref=None))
        request=HierarchicalProbeRequestD(scope=subset_scope(obs,obs['observation_ref']),operation_ref='mechanics.feedback_code_identification.hierarchical_probe',mode_ref='STEP',requested_result_type='DMechanicalResult',node_bound=100000,depth_bound=4096,domain_bound=4096,time_bound_ms=60000,phase_ref='EXTERNAL_INPUT_PREDICTION',nodes=nodes,navigation=(HierarchyNavigationD(source_ref='F',destination_ref='Q',native_input_ref='bound_navigation',debit=1),),root_ref='U',native_focus_ref='F',assignments=family.assignments(),laws=(family.law(obs['observation_ref']),),bound_native_input_ref='bound_navigation',remaining_resource=remaining,query_debit=1,submitted_debit=0,refusal_debit=0,positive_singleton_confirmation_required=True,transient_display_rule='RELEASE_AT_RESPONSE')
        result=measure_hierarchical_probe_d(request);assert result.status=='COMPLETE';output.append({'id':'subset_navigation_funding_'+str(remaining),'operation':'subset_navigation','arguments':{'scene':scene,'candidates':tested,'tested':tested,'remaining':remaining},'expected':normalize(result.values)})
    return output

def main():
    names=['laya_proto/common_periodic_sums.py','laya_proto/common_subset_diagnosis.py','laya_proto/common_fixed_origin.py','laya_proto/common_reflected_cover.py']
    files=[SOURCE/'agents/yf_arc3_v6'/p for p in names]+[SOURCE/'agents/yf_arc3_v5/capabilities'/n for n in ('periodic_profile_preimages_d.py','subset_observation_d.py','hierarchical_probe_d.py','fixed_program_origin.py','reflection_structure.py','program_instruction_shape_d.py')]
    manifest=json.loads((ROOT/'reference/v6'/COMMIT/'manifest.json').read_text());hashes={}
    for p in files:
        rel=str(p.relative_to(SOURCE));actual=hashlib.sha256(p.read_bytes()).hexdigest();assert actual==manifest['files'][rel]['sha256'];hashes[rel]=actual
    with tempfile.TemporaryDirectory(prefix='v6-support-procedures-')as temporary:
        directory=Path(temporary)
        for name in ('custom-games.zip','official-games.zip'):
            with zipfile.ZipFile(ROOT/'public/python'/name)as z:z.extractall(directory)
        for name in ('game_bridge.py','official_adapter.py','custom_level_navigation.py'):shutil.copy(ROOT/'public/python'/name,directory/name)
        sys.path.insert(0,temporary);import game_bridge
        def send(kind,**kw):
            value=json.loads(game_bridge.dispatch(json.dumps({'type':kind,**kw})))
            if 'error'in value:raise RuntimeError(value['error'])
            return value
        for code,family,primer in [('ONDE','periodic_sums',False),('DICO','subset_diagnosis',True),('GLOB','fixed_origin',True)]:
            d=Driver(family,'real_'+code+('_public_priming'if primer else '_autonomous'));engine=send('load',code=code,level=1);i=0;name=from_engine(code+':0',engine,0);boundaries=[];priming=[]
            for attempt in range(250):
                proposal=d.step({'kind':'propose','scene':name,'remaining':400-i})
                if not proposal:
                    command=None;s=scenes[name]
                    if code=='DICO'and len(priming)<8:
                        m=subset_scene(s['rows'])
                        if m:
                            controls=sorted(m['controls'],key=lambda c:(-c['area'],c['bbox']))
                            c=controls[len(priming)%len(controls)];l,t,r,b=c['bbox'];command={'action_ref':'ACTION6','data':{'x':(l+r)//2,'y':(t+b)//2}}
                    if code=='GLOB'and len(priming)<4:
                        m=fixed_scene(s['rows'])
                        if m:
                            if len(priming)%2==0:
                                action=next((a for a in s['observation']['available_action_refs']if a not in('ACTION6','ACTION7')),None)
                                if action:command={'action_ref':action}
                            else:
                                boxes=[b for b in m['nodes']if fill(s['rows'],b)==m['common_fill']]
                                if boxes:
                                    l,t,r,b=boxes[0];command={'action_ref':'ACTION6','data':{'x':(l+r)//2,'y':(t+b)//2}}
                    if command is None:break
                    priming.append({'index':i,'command':command});engine=send('action',actionId=int(command['action_ref'][6:]),data=command.get('data'));i+=1;later=from_engine(code+':'+str(i),engine,i);d.step({'kind':'record','before':name,'after':later,'command':command});name=later;continue
                for index,command in enumerate(proposal['actions']):
                    guard=d.step({'kind':'before','scene':name,'index':index})
                    if not guard['admitted']:break
                    engine=send('action',actionId=int(command['action_ref'][6:]),data=command.get('data'));i+=1;later=from_engine(code+':'+str(i),engine,i);post=d.step({'kind':'after','before':name,'after':later,'index':index});d.step({'kind':'record','before':name,'after':later,'index':index});name=later
                    if engine['levelsCompleted']>len(boundaries):boundaries.append({'levelsCompleted':engine['levelsCompleted'],'actions':i})
                    if post['seal_prefix']or engine['state']in('WIN','GAME_OVER'):break
                if engine['state']in('WIN','GAME_OVER')or i>=200:break
            d.done();g={'code':code,'standaloneFamily':family,'publicPrimingExperiments':priming,'actions':i,'boundaries':boundaries,'levelsCompleted':engine['levelsCompleted'],'state':engine['state']};games.append(g);print(json.dumps(g),flush=True)
            for scene_name in [n for n in scenes if n.startswith(code+':')][:4]:
                v=scenes[scene_name]
                for family_name,fn in [('periodic',periodic_scene),('subset',subset_scene),('fixed',fixed_scene)]:case(family_name+'_'+scene_name,'measure_'+family_name,{'scene':scene_name},fn(v['rows']))
        for code in ('HANO','SYME','DNOI','MEMO'):
            e=send('load',code=code,level=1);name=from_engine('refusal:'+code,e,0)
            for family in FACTORIES:
                d=Driver(family,'initial_refusal_'+family+'_'+code);d.step({'kind':'propose','scene':name});d.done()
    # Exact current placement, sampled program, fitted port and robust origin.
    names=[]
    for i,(actor,active_id)in enumerate([(None,None),(0,None),(3,None),(2,None),(5,None)]):names.append(add('fixed:synthetic:'+str(i),observe(fixed_frame(actor,active_id),100+i,available=['ACTION5','ACTION6'])))
    a,b,c,placed,ended=names
    scenes[c]['public']['frame_packet']=[fixed_frame(j+1,j)for j in range(3)]+[fixed_frame(3)]
    d=Driver('fixed_origin','controlled_fixed_program_to_origin_access');d.step({'kind':'record','before':a,'after':a,'command':{'action_ref':'ACTION5'}});d.step({'kind':'record','before':a,'after':b,'command':{'action_ref':'ACTION6','data':{'x':5,'y':7}}});p=d.step({'kind':'propose','scene':b});assert p and p['kind']=='fixed_origin_dependency';d.step({'kind':'before','scene':b});d.step({'kind':'after','before':b,'after':c});d.step({'kind':'record','before':b,'after':c});p=d.step({'kind':'propose','scene':c});assert p and p['kind']=='fixed_program_origin_access';d.step({'kind':'before','scene':c});d.step({'kind':'after','before':c,'after':placed});d.step({'kind':'record','before':c,'after':placed});d.step({'kind':'before','scene':placed,'index':1});d.step({'kind':'after','before':placed,'after':ended,'index':1});d.step({'kind':'record','before':placed,'after':ended,'index':1});d.done()
    m=fixed_scene(scenes[a]['rows']);case('fixed_synthetic_scene','measure_fixed',{'scene':a},m);case('fixed_bands','fixed_bands',{'nodes':m['nodes']},bands(m['nodes']))
    for direction in (-1,1):
        case('fixed_connected_'+str(direction),'fixed_connected',{'scene':a,'nodes':m['nodes'],'direction':direction},connected_ports(scenes[a]['rows'],m['nodes'],direction));case('fixed_strokes_'+str(direction),'fixed_strokes',{'scene':a,'nodes':m['nodes'],'direction':direction},stroke_ports(scenes[a]['rows'],m['nodes'],direction))
    # Public reflection covariance followed by complete coupled residual composition.
    body={(2,3),(2,4),(3,4)};d=Driver('reflected_cover','controlled_reflection_covariation_cover');names=[]
    for i,(dx,dy)in enumerate([(0,0),(1,0),(1,1)]):names.append(add('reflection:'+str(i),observe(reflection_frame({(x+dx,y+dy)for x,y in body}),200+i)))
    for i,action in enumerate(('ACTION4','ACTION2')):d.step({'kind':'record','before':names[i],'after':names[i+1],'command':{'action_ref':action}})
    assert d.f.ready,state_of(d.f);p=d.step({'kind':'propose','scene':names[-1]});assert p,p
    d.step({'kind':'before','scene':names[-1]});d.step({'kind':'after','before':names[-1],'after':names[-1]})
    # Public focus transfer must release a fresh, witnessed point action.
    axis_scene=add('reflection:axis_focus',observe(reflection_frame({(x+1,y+1)for x,y in body},owner='axis'),204))
    d.step({'kind':'record','before':names[-1],'after':axis_scene,'command':{'action_ref':'ACTION6','data':{'x':30,'y':2}}});p=d.step({'kind':'propose','scene':axis_scene});assert p and p['actions'][0]['action_ref']=='ACTION6';d.step({'kind':'before','scene':axis_scene});d.step({'kind':'after','before':axis_scene,'after':names[-1]});d.step({'kind':'record','before':axis_scene,'after':names[-1]});p=d.step({'kind':'propose','scene':names[-1]});assert p and p['steps'][0]['provisional_control'];d.done()
    for name in names:
        s=lattice(scenes[name]['rows']);case('lattice_'+name,'measure_reflection',{'scene':name},reflection_scene(s));case('world_'+name,'initialize_reflection',{'scene':name},encode(initialize(s)))
    # Strong audit case has two crossing carriers. The ordinary single-axis case
    # legitimately returns an empty audit; its field count is never fabricated.
    audit_rows=reflection_frame(body);rect(audit_rows,0,24,64,4,1);audit_name=add('reflection:audit',observe(audit_rows,250))
    args={'quantum':4,'row_phase':0,'col_phase':0,'support_component_ref':None,'support_palette_value':4,'completed_cells':((7,3),(8,3),(8,4),(7,11),(8,11),(8,10)),'carrier_palette_value':1,'carrier_row_axis_coordinate_twice':12,'carrier_col_axis_coordinate_twice':14,'direct_body_palette_values':(2,)}
    case('reflection_full_layer_audit','reflection_audit',{'scene':audit_name,'args':args},measure_orthogonal_reflection_lattice_object_audit(frame=tuple(map(tuple,audit_rows)),**args))
    # Every consumed finite-calculation branch, including cancellation and repeats.
    base={'model_ref':'fixture','nodes':('0','1','2'),'ports':(('0','a','1'),('1','a','2'),('2','a','0')),'word':('a','a'),'placement_nodes':('0','1','2'),'placement_hits':(('0','0'),('1','1'),('2','2')),'target_nodes':('0',),'arrival_updates_memory':True,'cancelled_updates_memory':False,'closure_after_cancelled':False,'closure_after_self_loop':False,'neighbor_updates_memory':False,'launch_memory_law':'clear_on_launch'}
    scope=DMechanicalScope(request_ref='fixture',caller_ref='common_fixed_origin',parent_consumer_ref='SupportNavigation',parent_goal_ref='G_official_completion',parent_contribution_ref='conditional_fixed_origin',caller_next_item_ref='current_placement',epoch=1,evidence_revision_ref='fixture:evidence',model_revision_ref='fixture:model',model_status_ref='observed_edges_fit_geometric_transfer_hypothesis',event_owner_ref='whole_program_control',input_domain_complete=True,assumption_refs=('conditional',))
    models=[('cycle',base),('cancelled',{**base,'ports':(('0','a',None),('1','a','2'),('2','a','0'))}),('repeat',{**base,'repeat_nodes':('1',),'effect_priority':('repeat','neighbor')}),('hazard',{**base,'hazard_nodes':('2',)}),('unknown',{**base,'ports':(('0','a','1'),)}),('self_loop',{**base,'ports':(('0','a','0'),('1','a','1'),('2','a','2'))})]
    for name,model in models:
        for operation,mode in [('robust_origin_domain','DOMAIN'),('program_image','EVALUATE')]:
            parsed=FixedProgramModel(**model);request=FixedProgramRequest(scope=scope,operation_ref='mechanics.fixed_program_origin.'+operation,mode_ref=mode,requested_result_type='DMechanicalResult',node_bound=100000,depth_bound=4096,domain_bound=4096,time_bound_ms=300000,models=(parsed,),observed_word=parsed.word,state=ProgramPose(node_ref='0',memory_ref=None)if operation=='program_image'else None);r=measure_fixed_program_origin(request)
            case('fixed_calculation_'+name+'_'+operation,'fixed_calculation',{'models':[model],'word':model['word'],'operation':operation,'origin':'0'if operation=='program_image'else None},{'status':r.status,'cause':r.cause,'values':plain(r.values)})
    p=PeriodicSums();p.refs=['fixture:evidence'];o=scenes['ONDE:0']['observation']
    for name,s in [('simple',{'tracks':[{'period':3,'profile':[1,2,3]},{'period':2,'profile':[1,3]}],'detectors':[{'x':1,'target':4}]}),('no_target',{'tracks':[{'period':2,'profile':[1,2]}],'detectors':[{'x':0,'target':None}]}),('domain_bound',{'tracks':[{'period':65,'profile':list(range(65))},{'period':65,'profile':list(range(65))}],'detectors':[{'x':0,'target':0}]}),('node_bound',{'tracks':[{'period':63,'profile':list(range(63))},{'period':64,'profile':list(range(64))}],'detectors':[{'x':i,'target':0}for i in range(128)]})]:
        p.last_result=None;target=p.targets(s,o);case('periodic_target_'+name,'periodic_target',{'scene':s},None if p.last_result is None else {'proof':p.last_result,'targets':sorted(target)if target is not None else []})
    cases.extend(subset_navigation_cases(scenes['DICO:0']['observation']))
    output={'provenance':{'commit':COMMIT,'sources':hashes,'scope':'Four exact SupportNavigation procedure closures; full-game proof requires separate native common-caller campaign','pythonAgentRuntime':False},'policy':POLICY,'scenes':scenes,'cases':cases,'journals':journals,'realGames':games}
    path=ROOT/'tests/fixtures/v6-support-procedures-reference.json.gz';raw=(json.dumps(normalize(output),separators=(',',':'))+'\n').encode();path.write_bytes(gzip.compress(raw,mtime=0));print(json.dumps({'path':str(path),'bytes':path.stat().st_size,'uncompressedBytes':len(raw),'cases':len(cases),'journals':len(journals),'operations':sum(len(j['steps'])for j in journals)}),flush=True)

if __name__=='__main__':main()
