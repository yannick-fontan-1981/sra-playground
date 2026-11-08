#!/usr/bin/env python3
"""Export unchanged typed-material contracts and independently checked identities.

No game is run here. Public packets came from the separately retained original
component campaign. Source calls are observed with Python's profiling API; no
function, import binding, or original file is replaced. The native identity
projection is explicit and does not claim that a hash renaming preserves the
source's lexical hash tie breakers.
"""
from __future__ import annotations
import copy
import gzip
import importlib.util
import itertools
import json
import math
from pathlib import Path
import sys

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('material_probe', Path(__file__).with_name('probe-v6-typed-material-original.py'))
helper = importlib.util.module_from_spec(spec); spec.loader.exec_module(helper)
from common_typed_material_flow import TypedMaterialConstraint
from observed_input_domain import ObservedInputDomain
from terminal_composition import identity
from typed_carrier_scene import measure, replacement_candidate
from typed_material_observations import descendants, requests, child_present, local_child_mark
from typed_pose_observations import small_parts, novel_controls, rotated, current_marks, outside_digest, control_matches

ROOT = helper.ROOT
PROBE_PATH = 'tests/fixtures/v6-typed-material-original-public.json.gz'
DISCOVERY_PATH = 'tests/fixtures/v6-linked-packet-initial-public.json.gz'
PROBE = json.loads(gzip.decompress((ROOT / PROBE_PATH).read_bytes()))
DISCOVERY = json.loads(gzip.decompress((ROOT / DISCOVERY_PATH).read_bytes()))
POLICY = PROBE['policy']
SOURCE_FILES = {'typed_carrier_scene.py', 'typed_carrier_access.py', 'typed_material_observations.py',
                'typed_material_flow.py', 'typed_pose_observations.py', 'typed_pose_access.py', 'common_typed_material_flow.py'}
RECIPES = {}; PENDING = {}; CASES = []; STATES = {}; GUARDS = []; TIES = []; SHADOWS = {}; ROTATING = {}

def plain(value): return helper.plain(copy.deepcopy(value))
def proof(path): return {'path': path, 'sha256': helper.hashed((ROOT / path).read_bytes())}
def source_canonical(value): return json.dumps(value, sort_keys=True, separators=(',', ':'))
def shadow(value):
    found=SHADOWS.get(id(value))
    if found and found[0] is value:return copy.deepcopy(found[1])
    if isinstance(value,dict):return {k:shadow(v)for k,v in value.items()}
    if isinstance(value,(list,tuple)):return [shadow(v)for v in value]
    return value

def native_rotation(marks,turns):
    result=copy.deepcopy(marks)
    for _ in range(turns%4):
        result=[[v,-float(dy) if dy==0 else -dy,dx]for v,dx,dy in result]
    return sorted(result)

def register_identity(value, result, caller, native_template=None):
    canonical = source_canonical(value)
    assert helper.hashed(canonical.encode()) == result
    native_template=plain(value)if native_template is None else native_template
    old = RECIPES.setdefault(result, {'sourceHash': result, 'sourceCanonical': canonical, 'value': plain(value), 'nativeValueTemplate':plain(native_template), 'callers': []})
    assert old['sourceCanonical'] == canonical
    assert native_canonical(old['nativeValueTemplate'])==native_canonical(native_template),('ambiguous numeric identity projection',caller)
    if caller not in old['callers']: old['callers'].append(caller)

def profile(frame, event, arg):
    if frame.f_code is rotated.__code__:
        if event=='call':ROTATING[id(frame)]=(shadow(frame.f_locals['marks']),frame.f_locals['turns'])
        elif event=='return':
            marks,turns=ROTATING.pop(id(frame));SHADOWS[id(arg)]=(arg,native_rotation(marks,turns))
        return
    if frame.f_code is not identity.__code__: return
    caller = frame.f_back
    if caller is None or Path(caller.f_code.co_filename).name not in SOURCE_FILES: return
    if event == 'call':
        PENDING[id(frame)] = (copy.deepcopy(frame.f_locals['value']), Path(caller.f_code.co_filename).name + ':' + str(caller.f_lineno),shadow(frame.f_locals['value']))
    elif event == 'return':
        value, origin, native_template = PENDING.pop(id(frame)); register_identity(value, arg, origin,native_template)

def native_canonical(value):
    """Independent finite dyadic JSON spelling used by these exact raster contracts."""
    if value is None: return 'null'
    if value is True: return 'true'
    if value is False: return 'false'
    if isinstance(value, str): return json.dumps(value, ensure_ascii=True)
    if isinstance(value, int):
        assert abs(value) <= 9007199254740991
        return str(value)
    if isinstance(value, float):
        assert math.isfinite(value)
        if value == 0 and math.copysign(1, value) < 0: return '-0.0'
        if value.is_integer():
            assert abs(value) <= 9007199254740991
            return str(int(value))
        # Current contracts use raster centres and exact dyadic policy values.
        # Do not silently extend this comparator to Python/JS exponent spelling.
        rendered = repr(value)
        assert 'e' not in rendered.lower(), rendered
        return rendered
    if isinstance(value, list): return '[' + ','.join(native_canonical(v) for v in value) + ']'
    if isinstance(value, dict):
        return '{' + ','.join(json.dumps(k, ensure_ascii=True) + ':' + native_canonical(v) for k, v in sorted(value.items())) + '}'
    raise TypeError(type(value))

def native_hash(value): return helper.hashed(native_canonical(value).encode())
def add(name, operation, arguments, expected):
    CASES.append({'id': name, 'operation': operation, 'arguments': plain(arguments), 'expected': plain(expected),'nativeValueTemplate':plain(shadow(expected))})
def state(memory): return helper.state(memory)
def own(events): return [plain(event) for event in events if event['kind'] in helper.OWN_KINDS]

def replay():
    family = TypedMaterialConstraint(); domain = ObservedInputDomain(4096)
    envelopes = []; packet_measurements = []; aliases = []; accepted_snapshots = []
    cursor = 0; boundary = 0; tie_counts = {'carrier': 0, 'pose': 0}
    for prefix_index, original in enumerate(PROBE['prefixes']):
        first = PROBE['packets'][cursor]
        before = state(family.memory); assert before == original['beforeState']
        STATES[prefix_index] = copy.deepcopy(family.memory)
        inputs = domain.candidates(first['observation'])
        p = family.material_propose(first['observation'], first['packet']['frame_rows'], inputs,
                                   PROBE['budget']['levelActions'] - (cursor - boundary), POLICY)
        assert plain(p) == original['unboundProposal'], prefix_index
        assert state(family.memory) == original['afterPlanningState']
        if p.get('typed_carrier_plan') and not p['typed_carrier_plan']['contact_context']:
            scene = p['typed_carrier_plan']['scene']; chosen = p['typed_carrier_plan']['selected']
            tie_counts['carrier'] += int(sum(c['center'] == chosen['center'] for c in scene['carriers']) > 1)
        if p.get('material_pose_plan'):
            plan = p['material_pose_plan']; options = family.memory.matching_pose_targets(plan['child'], first['packet']['frame_rows'], first['observation'])
            best = min(o['turns'] for o in options)
            tie_counts['pose'] += int(len({o['model_ref'] for o in options if o['turns'] == best}) > 1)
        unbound = plain(p);native_unbound=shadow(p);family.bind(p, domain); assert plain(p) == original['proposal']
        envelope = {'prefixIndex': prefix_index, 'actionIndex': cursor + 1, 'beforeState': before,
                    'afterPlanningState': state(family.memory), 'unboundProposal': unbound, 'proposal': plain(p),
                    'nativeUnboundTemplate':native_unbound,'nativeProposalTemplate':shadow(p),'steps': []}
        for step_index, command in enumerate(p['actions']):
            step = original['steps'][step_index]; earlier = PROBE['packets'][cursor]; later = PROBE['packets'][cursor + 1]
            assert plain(command) == later['command']
            before_guard = family.before(p, step_index, helper.SimpleNamespace(**earlier['packet']), earlier['observation'])
            outcome = family.after(p, step_index, earlier['observation'], later['observation'], earlier['packet']['frame_rows'], later['packet']['frame_rows'])
            assert plain(before_guard) == step['beforeGuard']; assert plain(outcome) == step['outcome']
            acquired = family.record(earlier['observation'], later['observation'], command, earlier['packet']['frame_rows'], later['packet']['frame_rows'], p, step_index, frames=later['packet']['frame_packet'])
            assert plain(acquired) == step['acquired']; after_state = state(family.memory); assert after_state == step['afterState']
            own_events = own(acquired['events']); envelope['steps'].append({'actionIndex': cursor + 1, 'index': step_index, 'beforeGuard': plain(before_guard), 'outcome': plain(outcome), 'ownEvents': own_events, 'afterState': after_state})
            accepted_snapshots.extend((event, plain(event)) for event in acquired['events'] if event['kind'] in helper.OWN_KINDS)
            cursor += 1
            if later['observation']['levels_completed'] > earlier['observation']['levels_completed']: boundary = cursor
        envelopes.append(envelope)
    for index, (event, snapshot) in enumerate(accepted_snapshots):
        if plain(event) != snapshot: aliases.append({'ownEventIndex': index, 'emission': snapshot, 'final': plain(event)})
    for index, item in enumerate(PROBE['packets']):
        obs, rows = item['observation'], item['packet']['frame_rows']
        packet_measurements.append({'actionIndex': index, 'scene': plain(measure(rows, obs, POLICY)), 'requests': plain(requests(rows, obs)), 'smallParts': plain(small_parts(rows))})
    assert cursor == PROBE['actions'] and state(family.memory) == PROBE['finalState']
    return envelopes, packet_measurements, aliases, tie_counts

def controlled():
    obs = {'level_epoch': 7, 'levels_completed': 6, 'state': 'NOT_FINISHED', 'observation_ref': 'controlled:typed', 'frame_hash': 'controlled-frame', 'available_action_refs': ['ACTION6']}
    def raster(even=False, shared=True, second=True):
        rows = [[0] * 32 for _ in range(32)]; size = 4 if even else 5
        for n, (x,y) in enumerate([(3,4),(20,4)] if second else [(3,4)]):
            for v in range(y,y+size):
                for u in range(x,x+size): rows[v][u] = 6 + n
            rows[y+1][x+1] = 2 if n == 0 or shared else 4
            rows[y+2][x+2] = 3 if n == 0 or shared else 5
        return rows
    for name, rows, cfg in [('uniform', [[0]*32 for _ in range(32)], POLICY), ('one_support', raster(second=False), POLICY),
                           ('two_typed_supports', raster(), POLICY), ('even_extents_half_centres', raster(even=True), POLICY),
                           ('no_shared_mark_palette', raster(shared=False), POLICY),
                           ('insufficient_internal_marks', raster(), {**POLICY,'minimum_distinct_internal_marks':3})]:
        add('measure:'+name,'measure',{'rows':rows,'obs':obs,'config':cfg},measure(rows,obs,cfg))
    carrier_prefix = next(p for p in PROBE['prefixes'] if (p['proposal'].get('typed_carrier_plan',{}).get('contact_context')or{}).get('kind') == 'local_marking')
    index = carrier_prefix['steps'][0]['actionIndex']; plan = carrier_prefix['proposal']['typed_carrier_plan']; later = PROBE['packets'][index]
    for name, frame in [('observed_replacement',later['packet']['frame_rows']),('unchanged',PROBE['packets'][index-1]['packet']['frame_rows'])]:
        args = {'before_scene':plan['scene'],'later':frame,'after':later['observation'],'config':plan['configuration']}
        add('replacement:'+name,'replacement',args,replacement_candidate(**args))
    activation = next(p for p in PROBE['prefixes'] if (p['proposal'].get('typed_carrier_plan',{}).get('contact_context')or{}).get('kind') == 'produced_support')
    index = activation['steps'][0]['actionIndex']; context=activation['proposal']['typed_carrier_plan']['contact_context']; first=PROBE['packets'][index-1]; last=PROBE['packets'][index]
    for name, ctx, after in [('actual_substructures',context,last['packet']['frame_rows']),('no_new_pixels',context,first['packet']['frame_rows']),('no_prior_sources',{},last['packet']['frame_rows'])]:
        args={'context':ctx,'before':first['packet']['frame_rows'],'later':after,'obs':last['observation']}
        add('descendants:'+name,'descendants',args,descendants(**args))
    original = context['removed'][0]; duplicate = {**original,'id':'second-source-occurrence','signature':'other-observed-core-extent'}
    ctx={**context,'removed':[original,duplicate]};args={'context':ctx,'before':first['packet']['frame_rows'],'later':last['packet']['frame_rows'],'obs':last['observation']}
    add('descendants:ambiguous_lineage_preserved','descendants',args,descendants(**args))
    select = next(p for p in PROBE['prefixes'] if p['proposal'].get('material_flow_plan',{}).get('mode') == 'select')
    index=select['steps'][0]['actionIndex'];child=select['proposal']['material_flow_plan']['child'];a=PROBE['packets'][index-1]['packet']['frame_rows'];b=PROBE['packets'][index]['packet']['frame_rows']
    for name, rows in [('present',a),('after_local_mark',b),('missing',[[0]*64 for _ in range(64)])]:
        add('child_present:'+name,'child_present',{'child':child,'rows':rows},child_present(child,rows))
    remote=copy.deepcopy(b);remote[0][0]=15 if remote[0][0]!=15 else 14
    for name, frame in [('actual_local_change',b),('unchanged',a),('remote_change',remote)]:
        add('local_child_mark:'+name,'local_child_mark',{'child':child,'first':a,'later':frame},local_child_mark(child,a,frame))
    for turns in [-3,-1,0,1,2,3,4,9]:
        marks=[[2,0.0,-1.0],[3,-0.0,1.0]]
        add('rotated:float_signed_zero:'+str(turns),'rotated',{'marks':marks,'turns':turns},rotated(marks,turns))
    for name, frame in [('actual',a),('no_marks',[[0]*64 for _ in range(64)])]:
        add('current_marks:'+name,'current_marks',{'child':child,'rows':frame},current_marks(child,frame))
    for name, boxes in [('none',[]),('child_scope',[child['bbox']]),('all',[[0,0,63,63]])]:
        add('outside_digest:'+name,'outside_digest',{'rows':a,'boxes':boxes},outside_digest(a,*boxes))
    pose = next(p for p in PROBE['prefixes'] if p['proposal'].get('material_pose_plan',{}).get('mode') == 'control')
    index=pose['steps'][0]['actionIndex'];plan=pose['proposal']['material_pose_plan'];control=plan['control'];frame=PROBE['packets'][index-1]['packet']['frame_rows']
    altered=copy.deepcopy(frame);x,y=control['point'];altered[y][x]=15 if altered[y][x]!=15 else 14
    for name, rows, epoch in [('current',frame,plan['epoch']),('different_epoch',frame,plan['epoch']+1),('changed_projection',altered,plan['epoch'])]:
        add('control_matches:'+name,'control_matches',{'control':control,'rows':rows,'epoch':epoch},control_matches(control,rows,epoch))
    boundary=next(s for p in PROBE['prefixes'] for s in p['steps'] if s['afterState']['projection']['pose_controls'])
    index=boundary['actionIndex'];previous=PROBE['packets'][index-1];following=PROBE['packets'][index]
    old=boundary['afterState']['projection']['pose_initial_parts']
    for name, initial in [('already_seen',old),('empty_prior',[])]:
        args={'old':initial,'rows':following['packet']['frame_rows'],'obs':following['observation'],'cfg':POLICY}
        add('novel_controls:'+name,'novel_controls',args,novel_controls(**args))
    initial=PROBE['packets'][0]
    add('requests:initial_public','requests',{'rows':initial['packet']['frame_rows'],'obs':initial['observation'],'known_shapes':[]},requests(initial['packet']['frame_rows'],initial['observation']))
    # Guards cover a real multi-step conditional path plus changed public scopes.
    for prefix_index in [0,3,33,34,42]:
        original=PROBE['prefixes'][prefix_index];p=original['proposal']
        for step in original['steps']:
            i=step['actionIndex'];first=PROBE['packets'][i-1];later=PROBE['packets'][i]
            meta={'epoch':first['observation']['level_epoch'],'score':first['observation']['levels_completed'],'observation_ref':first['observation']['observation_ref'],'available':first['observation']['available_action_refs']}
            for name, changed in [('current',{}),('epoch',{'epoch':meta['epoch']+1}),('score',{'score':meta['score']+1}),('unavailable',{'available':[]})]+([('stale_observation',{'observation_ref':'stale'})] if step['index']==0 else []):
                args={'proposal':p,'index':step['index'],'rows':first['packet']['frame_rows'],'meta':{**meta,**changed}}
                expected=STATES[prefix_index].before(p,step['index'],args['rows'],**args['meta'])
                GUARDS.append({'id':f'before:{prefix_index}:{step["index"]}:{name}','operation':'before','arguments':plain(args),'expected':plain(expected)})
            for name, rows, epoch, score in [('actual',later['packet']['frame_rows'],later['observation']['level_epoch'],later['observation']['levels_completed']),('scope_changed',later['packet']['frame_rows'],first['observation']['level_epoch']+1,first['observation']['levels_completed']),('unchanged',first['packet']['frame_rows'],first['observation']['level_epoch'],first['observation']['levels_completed'])]:
                args={'proposal':p,'index':step['index'],'rows':first['packet']['frame_rows'],'later':rows,'meta':{'epoch':epoch,'score':score,'state':'NOT_FINISHED'}}
                expected=STATES[prefix_index].after(p,step['index'],args['rows'],rows,**args['meta'])
                GUARDS.append({'id':f'after:{prefix_index}:{step["index"]}:{name}','operation':'after','arguments':plain(args),'expected':plain(expected)})

def controlled_hash_ties():
    obs={'level_epoch':7,'levels_completed':6,'state':'NOT_FINISHED','observation_ref':'controlled:hash-tie','frame_hash':'controlled-frame','available_action_refs':['ACTION6']}
    first_event=next(e for e in PROBE['prefixes'][0]['steps'][0]['acquired']['events']if e['kind']=='typed_carrier_response')
    clear={'kind':'typed_material_flow','epoch':7,'boundary':True,'context':None,'effect':'controlled_boundary','evidence':['controlled:earlier','controlled:now']}
    history=[first_event,clear]
    sites=[(x,y)for y in [-1,0,1]for x in [-1,0,1]]
    for a,b in itertools.combinations(sites,2):
        rows=[[0]*32 for _ in range(32)]
        for cx,cy,color in [(6,6,6),(24,6,7)]:
            for y in range(cy-3,cy+4):
                for x in range(cx-3,cx+4):rows[y][x]=color
            rows[cy+a[1]][cx+a[0]]=2;rows[cy+b[1]][cx+b[0]]=3
        family=TypedMaterialConstraint()
        for event in history:family.memory.apply_event(copy.deepcopy(event))
        p=family.material_propose(obs,rows,[],10,POLICY)
        assert p
        group=[c for c in p['typed_carrier_plan']['scene']['carriers']if c['center']==[6.0,6.0]]
        if len(group)!=2:continue
        refs={c['signature']:native_hash([c['bbox'][2]-c['bbox'][0]+1,c['bbox'][3]-c['bbox'][1]+1,c['marks']])for c in group}
        source_choice=min(refs);native_choice=min(refs,key=lambda key:refs[key])
        if source_choice==native_choice:continue
        assert p['typed_carrier_plan']['selected']['signature']==source_choice
        TIES.append({'id':'carrier_concentric_extents','operation':'common_carrier','events':plain(history),'obs':obs,'rows':rows,'configuration':POLICY,'remaining':10,
                     'sourceProposal':plain(p),'candidates':plain(group),'sourceChosenKey':source_choice,'nativeChosenSourceKey':native_choice,
                     'nativeChosenKey':refs[native_choice],'comparisonCriteria':['center.y','center.x','signature'],
                     'qualification':'The two measured extents have equal centres. Python float JSON and native finite JSON reverse their signature order. Both choices and all candidates are retained; equality of this selection is not claimed.'})
        break
    else:raise AssertionError('No controlled carrier hash-order inversion found')
    p=PROBE['prefixes'][33]['proposal']['material_pose_plan'];packet=PROBE['packets'][33];child=p['child'];marks=rotated(child['marks'],1)
    targets=requests(packet['packet']['frame_rows'],packet['observation']);assert len(targets)>=2
    values=[]
    for w in range(3,17):
        for h in range(3,17):
            value=[w,h,marks];values.append((value,identity(value),native_hash(shadow(value))))
    pair=next((a,b)for a,b in itertools.combinations(values,2)if (a[1]<b[1])!=(a[2]<b[2]))
    events=[{'kind':'typed_pose_scope','epoch':packet['observation']['level_epoch'],'initial_parts':[],'controls':[p['control']],'evidence':['controlled:pose-scope']}]
    for index,(value,source_ref,_)in enumerate(pair):
        register_identity(value,source_ref,'controlled:source-core-extent',shadow(value))
        events.append({'kind':'typed_pose_model','core_signature':source_ref,'descriptor':targets[index]['descriptor'],
                       'acquired_epoch':1,'validated_epoch':1,'evidence':['controlled:association'],
                       'source_ref':'controlled:model:'+str(index),'last_validation_ref':'controlled:model:'+str(index),
                       'status':'conditional_material_to_request_association','marks':marks})
    family=TypedMaterialConstraint()
    for event in events:family.memory.apply_event(copy.deepcopy(event))
    proposed=family.memory.pose_question(packet['observation'],packet['packet']['frame_rows'],POLICY,child,'select')
    options=family.memory.matching_pose_targets(child,packet['packet']['frame_rows'],packet['observation'])
    source_choice=min(pair,key=lambda v:v[1])[1];native_choice=min(pair,key=lambda v:v[2])
    assert proposed['material_pose_plan']['option']['model_ref']==source_choice
    assert source_choice!=native_choice[1]
    TIES.append({'id':'pose_equal_turns_distinct_associations','operation':'pose_question','events':plain(events),
                 'obs':packet['observation'],'rows':packet['packet']['frame_rows'],'configuration':POLICY,'child':child,'mode':'select',
                 'sourceProposal':plain(proposed),'candidates':plain(options),'sourceChosenKey':source_choice,
                 'nativeChosenSourceKey':native_choice[1],'nativeChosenKey':native_choice[2],
                 'comparisonCriteria':['turns','model_ref'],
                 'qualification':'Two distinct retained associations agree at the same quarter-turn count. Each caller uses its own lexical identity order; the selected request can differ. No blanket behavioral equivalence under hash renaming is asserted.'})

def identity_projection():
    aliases={}
    for key in RECIPES:
        for prefix in ['C_typed_carrier_','C_material_flow_','C_typed_pose_']:
            short=prefix+key[:20];assert short not in aliases or aliases[short][0]==key;aliases[short]=(key,prefix,True)
        aliases['measured-material-support:'+key]=(key,'measured-material-support:',False)
    visiting=set();done={}
    def replace_string(value):
        if value in RECIPES:return resolve(value)
        if value in aliases:
            key,prefix,short=aliases[value];result=resolve(key);return prefix+(result[:20] if short else result)
        return value
    def translate(value):
        if isinstance(value,str):return replace_string(value)
        if isinstance(value,list):
            result=[translate(v)for v in value]
            if len(result)==2 and result[0]=='ambiguous_source_core_extents':result[1]=sorted(result[1])
            return result
        if isinstance(value,dict):
            result={replace_string(k):translate(v)for k,v in value.items()}
            if 'compatible_source_occurrences'in result:result['compatible_source_occurrences']=sorted(result['compatible_source_occurrences'])
            return result
        return value
    def resolve(key):
        if key in done:return done[key]
        assert key not in visiting,'identity cycle';visiting.add(key)
        recipe=RECIPES[key];value=translate(recipe['nativeValueTemplate']);canonical=native_canonical(value);result=helper.hashed(canonical.encode())
        recipe.update(nativeCanonical=canonical,nativeHash=result);done[key]=result;visiting.remove(key);return result
    for key in RECIPES:resolve(key)
    return translate

def main():
    sys.setprofile(profile)
    try:
        envelopes,packets,aliases,tie_counts=replay();controlled();controlled_hash_ties()
        initials=[{'game':item['game'],'arguments':{'rows':item['packet']['frame_rows'],'obs':item['observation'],'config':POLICY},'expected':plain(measure(item['packet']['frame_rows'],item['observation'],POLICY))}for item in DISCOVERY['games']]
    finally:sys.setprofile(None)
    translate=identity_projection()
    output={'schema':'logos-engine.v6.typed-material-reference.v1','sourceCommit':helper.COMMIT,
            'qualification':{'sourceModified':False,'gameHostRunByExporter':False,
                'commonEnvelope':'Actual unchanged TypedMaterialConstraint, its common bind/guards/acquisition over retained public returns; not full original common caller or Kernel authorization.',
                'coldStart':'The original material provider proposes from the initial public scene without priming or an exploration fallback.',
                'numerics':'Exact finite dyadic raster values, signed zero retained. Python float-vs-int JSON identities and native finite JSON identities are independently recomputed, not asserted equal. Lexical hash tie selection is a separate native semantic boundary.',
                'digestScope':'The actual OccurrenceRecallAccess ancestor digest is supplied separately. Three own material layers are compared; no equality of the complete native/Python ancestor hierarchy is asserted.',
                'identityTracing':'Python profiling observes actual identity arguments/returns in seven unchanged typed-material modules, plus explicitly labelled controlled core-extent identity calls. It replaces no source function or binding.',
                'signedZero':'Rotation outputs have a separately computed IEEE-754 template: JavaScript negation can create negative zero even from a Python integer zero. Source values and signed native templates are both retained.',
                'derivedSetOrdering':'The explicitly sorted compatible_source_occurrences set and ambiguous_source_core_extents identity input are sorted again under native identities; membership is unchanged. This representation order is separate from the two decision tie contracts.',
                'controlledCases':'Synthetic contract observations are separate from actual campaigns and never supplied as game priming.'},
            'pinnedSourceFilesVerifiedBeforeImport':len(helper.VERIFIED_PINNED_SOURCE),'sourceHashes':helper.source_hashes(),
            'sourceMro':[cls.__name__ for cls in type(TypedMaterialConstraint().memory).__mro__],
            'originalPublicProbe':proof(PROBE_PATH),'initialDiscovery':proof(DISCOVERY_PATH),'policy':POLICY,
            'identityRecipes':list(RECIPES.values()),'cases':CASES,'guards':GUARDS,'initialMeasurements':initials,
            'packetMeasurements':packets,'commonEnvelopes':envelopes,'sourceAliasing':aliases,'publicHashTieCounts':tie_counts,
            'hashTieContracts':TIES,'generator':str(Path(__file__).relative_to(ROOT)),'generatorSha256':helper.hashed(Path(__file__).read_bytes())}
    assert helper.verify_source_manifest()==helper.VERIFIED_PINNED_SOURCE
    destination=ROOT/'tests/fixtures/v6-typed-material-reference.json.gz'
    if destination.exists():raise FileExistsError(destination)
    destination.write_bytes(gzip.compress(json.dumps(output,sort_keys=True,separators=(',',':')).encode(),mtime=0))
    print(json.dumps({'output':str(destination.relative_to(ROOT)),'cases':len(CASES),'guards':len(GUARDS),'initials':len(initials),'packets':len(packets),'envelopes':len(envelopes),'ownEvents':sum(len(s['ownEvents'])for e in envelopes for s in e['steps']),'identityRecipes':len(RECIPES),'aliases':len(aliases),'publicHashTieCounts':tie_counts}),flush=True)

if __name__=='__main__':main()
