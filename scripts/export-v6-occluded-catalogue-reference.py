#!/usr/bin/env python3
"""Export unchanged catalogue contracts over public and controlled observations.

No game is executed by this exporter. The public path was produced by original
catalogue/view/frontier components in one cold session, with a declared subset
coordinator rather than the full original strategy/Kernel. Controlled cases are
separate finite contract tests, never game priming or a stored solution.
"""
from __future__ import annotations
import copy
import gzip
from importlib.util import module_from_spec, spec_from_file_location
import json
from pathlib import Path
import sys
import time
from types import SimpleNamespace

sys.dont_write_bytecode = True
spec = spec_from_file_location('catalogue_probe', Path(__file__).with_name('probe-v6-occluded-catalogue-frontier-original.py'))
helper = module_from_spec(spec); spec.loader.exec_module(helper)
from common_observed_compositions import ObservedCompositionConstraint
from common_frontier import ObservedFrontier
from observed_input_domain import ObservedInputDomain
from occluded_catalogue_observation import measure, fit, exposed_values
from occluded_catalogue_methods import certify
from catalogue_view_memory import CatalogueViewMemory, structure, field_pixels
from occluded_catalogue_access import OccludedCatalogueAccess
from framed_window_access import FramedWindowAccess
from agents.yf_arc3_v5.capabilities.occluded_catalogue_projection_d import OccludedCatalogueProjectionRequestD, measure_occluded_catalogue_projection_d, iter_integer_mask_projection_d

ROOT = helper.ROOT
PROBE_PATH = 'tests/fixtures/v6-occluded-catalogue-frontier-original-public.json.gz'
COLD_PATH = 'tests/fixtures/v6-occluded-catalogue-original-public.json.gz'
DISCOVERY_PATH = 'tests/fixtures/v6-linked-packet-initial-public.json.gz'
PROBE = json.loads(gzip.decompress((ROOT / PROBE_PATH).read_bytes()))
DISCOVERY = json.loads(gzip.decompress((ROOT / DISCOVERY_PATH).read_bytes()))
CASES = []


def plain(v): return helper.plain(copy.deepcopy(v))
def add(name, operation, arguments, result):
    CASES.append({'id': name, 'operation': operation, 'arguments': plain(arguments), 'expected': plain(result)})
def own_state(memory):
    return {**helper.state(memory), 'requestedStopReason': memory.requested_stop_reason}
def own_events(events):
    return [e for e in events if e['kind'] in {'catalogue_observation', 'catalogue_response', 'catalogue_field_input_observed'}]
def proof(path): return {'path': path, 'sha256': helper.hashed((ROOT/path).read_bytes())}


def projection_request():
    scope={'request_ref':'request:controlled-catalogue','caller_ref':'caller:controlled','parent_consumer_ref':'SRC',
           'parent_goal_ref':'goal:controlled','parent_contribution_ref':'contribution:controlled','caller_next_item_ref':'item:controlled',
           'epoch':2,'evidence_revision_ref':'evidence:controlled','model_revision_ref':'models:controlled','model_status_ref':'conditional',
           'event_owner_ref':'SRC','input_domain_complete':True,'assumption_refs':['finite mask domain','unknown remains unknown']}
    mask=lambda ref,points,value='p:2': {'candidate_ref':ref,'pixels':[{'point':p,'value_ref':value} for p in points],
                                      'supported_integer_scales':[1,2],'mask_provenance_ref':'mask:'+ref}
    pose=lambda ref: {'object_ref':'subject','candidate_ref':ref,'scale':1,'translation':[1,1],
                      'opaque':True,'pose_provenance_ref':'pose:'+ref}
    models=[{'model_ref':ref,'views':[{'view_ref':'view:A','poses':[pose(ref)],'top_to_bottom_object_refs':['subject'],
                                     'occluder_provenance_ref':'other values unknown'}]} for ref in ['M0','M1']]
    view={'view_ref':'view:A','evidence_revision_ref':'view-evidence:A','epoch':2,'sealed':True,
          'viewport_cells':[[x,y] for x in range(1,5) for y in range(1,5)],'queried_object_refs':['subject'],
          'visible_present':[{'point':[1,1],'value_ref':'p:2'}],'visible_absent':[[2,2]],'unobserved_cells':[]}
    return {'scope':scope,'operation_ref':'mechanics.transform_pose_candidates.occluded_catalogue_projection','mode_ref':'COMPARE',
            'phase_ref':'REGISTERED_LAYERED_VIEWS','requested_result_type':'DMechanicalResult','node_bound':100000,
            'depth_bound':4096,'domain_bound':4096,'time_bound_ms':300000,
            'masks':[mask('M0',[[0,0],[1,0],[0,1]]),mask('M1',[[0,0],[1,0],[0,1],[1,1]])],
            'models':models,'registered_views':[view],'requested_view_refs':['view:A']}


def controlled_cases():
    # Synthetic frames and masks exercise the mathematical contract only.
    scene={'field':[1,1,8,8],'palette':2,'cards':[
        {'bbox':[1,10,4,13],'point':[2,11],'mask':[[0,0],[0,1],[1,0]],'extent':[2,2]},
        {'bbox':[5,10,8,13],'point':[6,11],'mask':[[0,0],[0,1],[1,1]],'extent':[2,2]}],
        'controls':[{'palette':2,'bbox':[1,0,2,1],'point':[1,0]},{'palette':3,'bbox':[5,0,6,1],'point':[5,0]}],
        'geometry_ref':'controlled-geometry','scope':'controlled finite test, not a game'}
    rows=[[9]*10 for _ in range(10)]; rows[3][3]=2
    frames={}
    frames['positive_only']=copy.deepcopy(rows)
    frames['visible_absence']=copy.deepcopy(rows); frames['visible_absence'][3][4]=0
    frames['second_positive']=copy.deepcopy(frames['visible_absence']); frames['second_positive'][4][3]=2
    frames['no_positive']=[[9]*10 for _ in range(10)]
    frames['incompatible_gap']=copy.deepcopy(rows); frames['incompatible_gap'][7][7]=2
    for name,raster in frames.items():
        for background in [[],[0],[0,9]]:
            args={'rows':raster,'scene':scene,'backgrounds':background}
            add('fit:'+name+':'+str(background),'fit',args,fit(**args))
    a=copy.deepcopy(rows); b=copy.deepcopy(rows); b[3][3]=0; b[3][4]=2; a[3][4]=0
    for name,before,after in [('reciprocal_unique',a,b),('no_change',a,a),
                              ('departed_only',a,[[0 if (x,y)==(3,3) else v for x,v in enumerate(row)] for y,row in enumerate(a)]),
                              ('nonreciprocal',rows,b)]:
        add('exposed:'+name,'exposed',{'before':before,'after':after,'scene':scene},exposed_values(before,after,scene))
    a2=copy.deepcopy(a);b2=copy.deepcopy(b);a2[5][5]=2;b2[5][5]=7;a2[5][6]=7;b2[5][6]=2
    add('exposed:multiple_reciprocal_values','exposed',{'before':a2,'after':b2,'scene':scene},exposed_values(a2,b2,scene))
    add('structure:conditional_roles','structure',{'scene':scene},structure(scene))
    add('field_pixels:inclusive_frame','field_pixels',{'rows':rows,'scene':scene},field_pixels(rows,scene))
    for name,points,scale,translation in [('one',[[0,0]],1,[0,0]),('scaled',[[1,2],[0,0]],2,[-3,1]),
                                          ('outside_viewport',[[0,0],[4,4]],3,[-4,-2]),
                                          ('cancellation',[[4503599627370495,0]],3,[-9007199254740991,0])]:
        add('integer_projection:'+name,'integer_projection',{'points':points,'scale':scale,'translation':translation},
            list(iter_integer_mask_projection_d(points,scale,translation)))
    base=projection_request(); variants=[]
    def variant(name,change):
        request=copy.deepcopy(base); change(request); variants.append((name,request))
    variants.append(('visible_rejects_extra_pixel',base))
    variant('unknown_is_not_negative',lambda r:r['registered_views'][0].update(unobserved_cells=[[2,2]]))
    variant('absence_outside_viewport_is_not_negative',lambda r:r['registered_views'][0].update(visible_absent=[[9,9]]))
    variant('unsealed_view_requires_evidence',lambda r:r['registered_views'][0].update(sealed=False))
    variant('different_epoch_requires_evidence',lambda r:r['registered_views'][0].update(epoch=3))
    variant('missing_assignment_requires_evidence',lambda r:r['models'][1].update(views=[]))
    # Each model must have at least one view; use an unrelated assignment instead.
    variants[-1][1]['models'][1]['views']=[{**copy.deepcopy(base['models'][1]['views'][0]),'view_ref':'view:other'}]
    variant('unassigned_query_requires_evidence',lambda r:r['registered_views'][0].update(queried_object_refs=['absent-object']))
    variant('input_domain_incomplete',lambda r:r['scope'].update(input_domain_complete=False))
    variant('domain_mode_is_licensed',lambda r:r.update(mode_ref='DOMAIN'))
    # DOMAIN is itself licensed. Use an actual operation mismatch as a separate case.
    variant('unlicensed_operation',lambda r:r.update(operation_ref='mechanics.other'))
    variant('wrong_result_type',lambda r:r.update(requested_result_type='UnknownResult'))
    variant('node_bound',lambda r:r.update(node_bound=1))
    variant('domain_bound',lambda r:r.update(domain_bound=2))
    variant('resume_is_restart',lambda r:r.update(resume_frontier={'prior':'partial'}))
    variant('duplicate_model_identity',lambda r:r['models'][1].update(model_ref='M0'))
    variant('scope_evidence_missing',lambda r:r['scope'].update(evidence_revision_ref=''))
    variants.pop()  # Empty Ref is rejected by Pydantic; outside the valid typed input suite.
    for name,opaque in [('opaque_occluder_coverage_is_not_absence',True),('transparent_overlay_preserves_lower_render',False)]:
        r=copy.deepcopy(base)
        r['masks'].append({'candidate_ref':'cover','pixels':[{'point':[0,0],'value_ref':'p:9'}],
                           'supported_integer_scales':[1],'mask_provenance_ref':'cover-evidence'})
        for model in r['models']:
            layout=model['views'][0]
            layout['poses'].append({'object_ref':'covering-object','candidate_ref':'cover','scale':1,'translation':[2,2],
                                     'opaque':opaque,'pose_provenance_ref':'cover-pose'})
            layout['top_to_bottom_object_refs'].insert(0,'covering-object')
        variants.append((name,r))
    r=copy.deepcopy(base);v=copy.deepcopy(r['registered_views'][0]);v.update(view_ref='view:B',evidence_revision_ref='view-evidence:B',visible_absent=[],visible_present=[])
    r['registered_views'].append(v);r['requested_view_refs'].append('view:B')
    for model in r['models']:model['views'].append({**copy.deepcopy(model['views'][0]),'view_ref':'view:B'})
    variants.append(('earlier_view_contradiction_retained',r))
    for name,request in variants:
        typed=OccludedCatalogueProjectionRequestD(**request)
        add('projection:'+name,'projection',{'request':plain(typed.model_dump())},plain(measure_occluded_catalogue_projection_d(typed).model_dump()))
    fits=fit(frames['second_positive'],scene,[0])
    obs={'observation_ref':'controlled-current-view','level_epoch':2}
    add('certify:finite_poses','certify',{'scene':scene,'rows':frames['second_positive'],'obs':obs,'backgrounds':[0],'fits':fits},
        certify(scene,frames['second_positive'],obs,[0],fits,time.perf_counter()+300))
    add('certify:no_poses','certify',{'scene':scene,'rows':rows,'obs':obs,'backgrounds':[0],'fits':[]},
        certify(scene,rows,obs,[0],[],time.perf_counter()+300))
    too_many=[{'candidate':0,'scale':1,'translation':[i,i]} for i in range(65)]
    add('certify:bounded_assignments','certify',{'scene':scene,'rows':rows,'obs':obs,'backgrounds':[0],'fits':too_many},
        certify(scene,rows,obs,[0],too_many,time.perf_counter()+300))
    initial=PROBE['packets'][0]['packet']['frame_rows']
    for name,raster in [('palette_permutation',[[(value+7)%16 for value in row] for row in initial]),
                         ('horizontal_mirror',[list(reversed(row)) for row in initial]),
                         ('uniform',[[0]*64 for _ in range(64)])]:
        add('measure:'+name,'measure',{'rows':raster},measure(raster))


def public_contracts():
    family=ObservedCompositionConstraint(); domain=ObservedInputDomain(4096)
    frontier=ObservedFrontier(target_levels=PROBE['targetLevels'],max_prefix=1)
    measurements=[]; envelopes=[]; retained=[]; aliases=[]
    boundary=0
    for index,item in enumerate(PROBE['packets']):
        scene=measure(item['packet']['frame_rows'])
        measurements.append({'actionIndex':index,'scene':plain(scene)})
    for index,prefix in enumerate(PROBE['prefixes']):
        first=PROBE['packets'][index]; second=PROBE['packets'][index+1]
        obs,rows=first['observation'],first['packet']['frame_rows'];after,later=second['observation'],second['packet']['frame_rows']
        family.level_deadline=time.perf_counter()+300
        before_state=own_state(family.memory); inputs=domain.candidates(obs); remaining=PROBE['budget']['levelActions']-(index-boundary)
        point=family.catalogue_propose(obs,rows,inputs,remaining,PROBE['policy'])
        view=family.catalogue_view_propose(obs,rows,inputs,remaining,PROBE['policy']) if point is None else None
        p=point or view; using_catalogue=p is not None
        if p is None:p=frontier.propose(obs,inputs,prefix_evidence=[])
        unbound=plain(p)
        if using_catalogue:family.bind(p,domain)
        assert plain(p)==prefix['proposal'],('proposal changed',index)
        before_guard=family.before(p,0,SimpleNamespace(**first['packet']),obs) if using_catalogue else frontier.guard(p,obs,0)
        outcome=family.after(p,0,obs,after,rows,later) if using_catalogue else prefix['steps'][0]['outcome']
        acquired=family.record(obs,after,p['actions'][0],rows,later,p,0,frames=second['packet']['frame_packet'])
        fr=frontier.record_transition(obs,p['actions'][0],after,assessment=None,after_action_candidates=domain.candidates(after))
        own=own_events(acquired['events'])
        for event in own:retained.append((index,event,plain(event)))
        assert own_state(family.memory)['projection']==prefix['steps'][0]['afterState']['projection'],index
        assert plain(before_guard)==prefix['steps'][0]['beforeGuard'],index
        assert plain(acquired)==prefix['steps'][0]['acquired'],index
        envelopes.append({'actionIndex':index+1,'selectedProvider':prefix['selectedProvider'],'beforeState':before_state,
                          'catalogueProposal':plain(point),'catalogueViewProposal':plain(view),'unboundProposal':unbound,'proposal':plain(p),
                          'beforeGuard':plain(before_guard),'outcome':plain(outcome),'acquired':plain(acquired),'ownEvents':plain(own),
                          'ownState':own_state(family.memory),'frontierRecord':plain(fr)})
        if after['levels_completed']>obs['levels_completed']:boundary=index+1
    for index,event,snapshot in retained:
        if plain(event)!=snapshot:aliases.append({'actionIndex':index+1,'atEmission':snapshot,'afterLaterAcquisition':plain(event)})
    return measurements,envelopes,aliases


def main():
    controlled_cases(); measurements,envelopes,aliases=public_contracts()
    initial=[{'game':item['game'],'expected':plain(measure(item['packet']['frame_rows']))} for item in DISCOVERY['games']]
    assert helper.verify_source_manifest()==helper.VERIFIED_PINNED_SOURCE
    output={'schema':'logos-engine.v6.occluded-catalogue-reference.v1','sourceCommit':helper.COMMIT,
            'qualification':{'sourceModified':False,'gameHostRunByExporter':False,
                'commonEnvelope':'True ObservedCompositionConstraint catalogue methods, guards and acquisition over public returns. The explicit catalogue/view/frontier subset coordinator is not the original full common caller or original Kernel authorization.',
                'coldStart':'Isolated catalogue and view entries abstain. Each first scalar command is independently proposed by original ObservedFrontier, not supplied by the harness.',
                'numerics':'Exact bounded integer projection and point geometry; no numerical tolerance or coordinate normalization.',
                'digestScope':'The actual FramedWindowAccess ancestor digest is supplied separately; catalogue access and CatalogueViewMemory own layers are compared without asserting native ancestor hierarchy equality.',
                'controlledCases':'Synthetic finite masks, views and observations are reference contracts only. They are not inputs to an actual game or cold campaign.'},
            'pinnedSourceFilesVerifiedBeforeImport':len(helper.VERIFIED_PINNED_SOURCE),'sourceHashes':helper.source_hashes(),
            'sourceMro':[cls.__name__ for cls in type(ObservedCompositionConstraint().memory).__mro__],
            'isolatedColdProbe':proof(COLD_PATH),'originalPublicProbe':proof(PROBE_PATH),'initialDiscovery':proof(DISCOVERY_PATH),
            'policy':PROBE['policy'],'cases':CASES,'initialMeasurements':initial,'packetMeasurements':measurements,
            'commonEnvelopes':envelopes,'sourceAliasing':aliases,
            'generator':str(Path(__file__).relative_to(ROOT)),'generatorSha256':helper.hashed(Path(__file__).read_bytes())}
    destination=ROOT/'tests/fixtures/v6-occluded-catalogue-reference.json.gz'
    if destination.exists():raise FileExistsError(destination)
    destination.write_bytes(gzip.compress(json.dumps(output,sort_keys=True,separators=(',',':')).encode(),mtime=0))
    print(json.dumps({'output':str(destination.relative_to(ROOT)),'cases':len(CASES),'initials':len(initial),'packets':len(measurements),
                      'envelopes':len(envelopes),'ownEvents':sum(len(e['ownEvents']) for e in envelopes),'aliases':len(aliases),
                      'sourceFiles':len(output['sourceHashes'])}),flush=True)

if __name__=='__main__':main()
