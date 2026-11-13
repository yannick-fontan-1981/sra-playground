#!/usr/bin/env python3
"""Development oracle for the native ordered-support port, never a site agent.

The pinned, unchanged V6 family receives public packets from the same bundled
game engine as the site. The engine is used only to execute the proposed public
actions. No internal stack, solution, target-move or level-definition fields are
forwarded. The resulting fixture is imported by tests, not the product bundle.
"""
from pathlib import Path
from types import SimpleNamespace
import hashlib
import json
import shutil
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
REFERENCE = ROOT / 'reference' / 'v6' / COMMIT / 'source'
LAYA = REFERENCE / 'agents/yf_arc3_v6/laya_proto'
sys.path[:0] = [str(LAYA), str(REFERENCE)]

from common_ordered_support import OrderedSupportTransfer, measure as measure_scene, material_bands, selection_matches
from common_sliding_cavity import components
from neutral_observer import measure as measure_observation
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid, InteractionProbeCandidate, OrderedSupportConfiguration, OrderedSupportTransferRequest
from agents.yf_arc3_v5.logos.types import FrozenMap
from src_bridge import plain
from agents.yf_arc3_v5.capabilities.ordered_supports import (
    declared_support_orders, materialize_ordered_support_transfer_witnesses,
    measure_ordered_support_geometry, measure_ordered_support_non_layer_spans,
    materialize_ordered_support_click_counterfactual,
)


def public(value, step):
    rows = value['frame']
    return SimpleNamespace(frame_rows=rows, frame_packet=value['frames'], level=value['level'],
        levels_completed=value['levelsCompleted'], state=value['state'], step_index=step,
        available_action_refs=[f'ACTION{n}' for n in value['availableActionIds']],
        frame_hash=hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest()[:16])


def geometry(rows):
    frame=FrameGrid(rows=rows); parts=components(rows)
    value=measure_ordered_support_geometry(frame,parts)
    non_layer=measure_ordered_support_non_layer_spans(frame,parts,value) if value.supports else None
    return {'geometry':value.model_dump(mode='json'),'nonLayer':non_layer,'scene':measure_scene(rows)}


def search_cases():
    cases=[]
    requests=[
        ([[11,7],[],[]],2,['canonical'],65536,128),
        ([[11,7],[],[]],2,['canonical','reverse_canonical','endpoint_outward'],65536,128),
        ([[11,7],[],[]],2,['canonical'],1,128),
        ([[11,7],[],[]],2,['canonical'],65536,1),
        ([[],[],[11,7]],2,['canonical'],65536,128),
        ([[9,7,5,3],[],[],[]],3,['canonical','reverse_canonical','endpoint_outward'],65536,128),
        ([[11,5],[9],[7],[]],1,['endpoint_outward','canonical','reverse_canonical'],65536,128),
        ([[5],[4],[3],[2],[1]],0,['reverse_canonical','canonical','endpoint_outward'],65536,128),
        ([[9,7,5,3],[],[],[]],3,['canonical','reverse_canonical','endpoint_outward'],31,128),
    ]
    for stacks,target,refs,bound,depth in requests:
        orders=declared_support_orders(len(stacks),target,tuple(refs))
        request=OrderedSupportTransferRequest(configuration=OrderedSupportConfiguration(support_extents=stacks),
            endpoint_support_index=target,traversal_orders=orders,maximum_state_expansions=bound,maximum_transfer_depth=depth)
        cases.append({'configuration':stacks,'target':target,'variants':refs,'orders':orders,
            'request':request.model_dump(mode='json'),'result':materialize_ordered_support_transfer_witnesses(request).model_dump(mode='json')})
    return cases


def counterfactual_cases(rows, label='initial'):
    frame=FrameGrid(rows=rows);parts=components(rows);measured=measure_ordered_support_geometry(frame,parts)
    candidates=tuple(InteractionProbeCandidate(candidate_ref=f'public_probe_{index}',action_ref='ACTION6',
        action_data=FrozenMap({'x':support.point[1],'y':support.point[0]}),component_ref=support.support_ref,point=support.point)
        for index,support in enumerate(measured.supports))
    base={'ordered_support_traversal_orders':['canonical','reverse_canonical','endpoint_outward'],
        'ordered_support_committed_traversal_ordinal':0,'ordered_support_max_expanded_states':65536,
        'ordered_support_max_transfer_depth':128}
    cases=[]
    for name,configuration,probes in [('first_declared',base,candidates),
        ('missing_public_support',base,candidates[:-1]),
        ('depth_bound',dict(base,ordered_support_max_transfer_depth=1),candidates),
        ('unavailable_ordinal',dict(base,ordered_support_committed_traversal_ordinal=2),candidates),
        ('no_declared_endpoint',dict(base,ordered_support_endpoint_measurements=['unknown']),candidates),
        ('occupied_tie_endpoint',dict(base,ordered_support_endpoint_measurements=['unique_non_layer_span_under_occupied_tie']),candidates)]:
        result=materialize_ordered_support_click_counterfactual(frame=frame,components=parts,
            point_candidates=probes,point_action_ref='ACTION6',configuration=FrozenMap(configuration))
        cases.append({'name':label+'_'+name,'rows':rows,'configuration':configuration,
            'pointCandidates':plain([c.model_dump(mode='python')for c in probes]),'result':plain(result)})
    return cases


def make_fixtures():
    policy=OrderedSupportTransfer().policy
    with tempfile.TemporaryDirectory(prefix='v6-ordered-support-oracle-') as directory:
        temp=Path(directory); assets=ROOT/'public/python'
        for bundle in ('custom-games.zip','official-games.zip'):
            with zipfile.ZipFile(assets/bundle) as archive:archive.extractall(temp)
        for name in ('game_bridge.py','official_adapter.py','custom_level_navigation.py'):shutil.copy(assets/name,temp/name)
        sys.path.insert(0,str(temp))
        import game_bridge
        def send(kind,**payload):
            result=json.loads(game_bridge.dispatch(json.dumps({'type':kind,**payload})))
            if 'error' in result:raise RuntimeError(result['error'])
            return result
        engine=send('load',code='HANO',level=1)
        family=OrderedSupportTransfer(); transitions=[]; revision=0; current=public(engine,revision)
        obs,_=measure_observation(current,revision,'native-ordered-support-oracle')
        initial={'public':vars(current),'observation':obs,'measurements':geometry(current.frame_rows)}
        maximum_actions=160; target_levels=3
        while revision<maximum_actions and current.levels_completed<target_levels and current.state not in ('WIN','GAME_OVER','GAMEOVER','LEVEL_COMPLETE'):
            proposal=family.propose(obs,current.frame_rows,[],maximum_actions-revision)
            if proposal is None:break
            event={'remaining':maximum_actions-revision,'proposal':proposal,'steps':[]}
            for index,command in enumerate(proposal['actions']):
                before_guard=family.before(proposal,index,current,obs)
                if not before_guard['admitted']:
                    event['steps'].append({'beforeGuard':before_guard});break
                engine=send('action',actionId=int(command['action_ref'][6:]),data=command.get('data'))
                revision+=1; after_public=public(engine,revision)
                after_obs,_=measure_observation(after_public,revision,'native-ordered-support-oracle')
                after_guard=family.after(proposal,index,obs,after_obs,current.frame_rows,after_public.frame_rows)
                recorded=family.record(obs,after_obs,command,current.frame_rows,after_public.frame_rows,proposal,index,after_public.frame_packet)
                event['steps'].append({'beforeGuard':before_guard,'afterPublic':vars(after_public),'afterObservation':after_obs,
                    'afterGuard':after_guard,'record':recorded,'familyState':family.state()})
                current,obs=after_public,after_obs
                if after_guard['seal_prefix']:break
            transitions.append(event)
            if not event['steps'] or 'afterPublic' not in event['steps'][-1]:break
        session={'game':'HANO','initial':initial,'transitions':transitions,'actions':revision,
            'levelsCompleted':current.levels_completed,'state':current.state,'finalFamilyState':family.state(),
            'finalProposal':family.propose(obs,current.frame_rows,[],maximum_actions-revision)}
        base=initial['public']['frame_rows']; background=max(set(v for row in base for v in row),key=lambda v:sum(row.count(v) for row in base))
        translated=[[background]*len(base[0]) for _ in base]
        for y,row in enumerate(base):
            for x,value in enumerate(row):
                if y+1<len(base) and x+2<len(row):translated[y+1][x+2]=value
        cases=[]
        for name,rows in [('palette_permutation',[[15-v for v in row]for row in base]),('translated_public_pixels',translated),('empty_image',[[5]*64 for _ in range(64)])]:
            packet=SimpleNamespace(**{**initial['public'],'frame_rows':rows,'frame_packet':[rows],
                'frame_hash':hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest()[:16]})
            measured,_=measure_observation(packet,0,'native-ordered-support-raster')
            cases.append({'name':name,'public':vars(packet),'observation':measured,'measurements':geometry(rows),
                'proposal':OrderedSupportTransfer().propose(measured,rows,[],160)})
        first_proposal=transitions[0]['proposal']; second_public=transitions[0]['steps'][0]['afterPublic']; selection=second_public['frame_rows']
        no_change=base
        unrelated=[list(row)for row in selection];unrelated[2][2]=(unrelated[2][2]+1)%16
        asymmetric=[list(row)for row in base]
        member=first_proposal['support_plan']['member'];l,t,r,b=member['bbox']
        for y in range(t,b+1):asymmetric[y][l-1]=member['value']
        invalid_measurements={'asymmetric_material':{'rows':asymmetric,**geometry(asymmetric)}}
        guards=[]
        for name,rows in [('unchanged_image',no_change),('actual_selection',selection),('unrelated_change',unrelated)]:
            guards.append({'name':name,'rows':rows,'matches':selection_matches(base,rows,first_proposal['support_plan'])})
        band_cases=[]
        for name,rows,box,reference in [
            ('frame_edge',[[0]*8 for _ in range(8)],[0,2,1,5],set()),
            ('two_row_ambiguous',[[0]*10 for _ in range(8)],[4,2,5,5],set()),
        ]:
            if name=='two_row_ambiguous':
                for y in (3,4):rows[y][3]=7
            band_cases.append({'name':name,'rows':rows,'box':box,'referencePixels':sorted(reference),
                'bands':material_bands(rows,box,reference)})
        paths=[LAYA/'common_ordered_support.py',LAYA/'common_frontier_policy.drm.json',LAYA/'common_multiscale_constraints.py',
            LAYA/'common_sliding_cavity.py',LAYA/'neutral_observer.py',LAYA/'geometric_observer.py',
            REFERENCE/'agents/yf_arc3_v5/capabilities/ordered_supports.py',REFERENCE/'agents/yf_arc3_v5/capabilities/contracts.py',
            REFERENCE/'agents/yf_arc3_v5/capabilities/components.py']
        sources={str(path.relative_to(REFERENCE)):{'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size}for path in paths}
        result={'provenance':{'commit':COMMIT,'sources':sources,
            'scope':'Individual original ordered-support family with its real guards and observations; not complete V6 router parity',
            'engineBundleSha256':hashlib.sha256((assets/'custom-games.zip').read_bytes()).hexdigest(),
            'policyInputs':'Public pixels, action vocabulary and protocol counters only; no solution or engine state'},
            'policy':policy,'session':session,'searchCases':search_cases(),
            'counterfactualCases':counterfactual_cases(base)+counterfactual_cases(next(t['proposal']['support_plan']['before_rows']
                for t in transitions if t['proposal']['binding']['level_epoch']==2),'occupied_maximum_tie'),
            'rasterCases':cases,'selectionCases':guards,
            'invalidMeasurements':invalid_measurements,'materialBandCases':band_cases}
        destination=ROOT/'tests/fixtures/v6-ordered-support-reference.json'
        destination.write_text(json.dumps(result,separators=(',',':'))+'\n')
        print(json.dumps({'output':str(destination),'actions':revision,'levelsCompleted':current.levels_completed,
            'cycles':len(transitions),'searchCases':len(result['searchCases']),'rasterCases':len(cases)},indent=2))


if __name__=='__main__':make_fixtures()
