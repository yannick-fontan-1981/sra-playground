#!/usr/bin/env python3
"""Compare unchanged original material layers on actual native public returns.

No game or native agent is run. Integer/float JSON identities, signed-zero
rotation and sorted reference sets are explicit checked projections. Full
caller ordering and lexical-hash decision equivalence are not claimed.
"""
from __future__ import annotations
import argparse
from collections import Counter
import copy
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
from types import SimpleNamespace

sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/migration/native-campaigns-v50'
spec=importlib.util.spec_from_file_location('material_contracts',ROOT/'scripts/export-v6-typed-material-reference.py')
contracts=importlib.util.module_from_spec(spec);spec.loader.exec_module(contracts)
helper=contracts.helper
from common_typed_material_flow import TypedMaterialConstraint
from typed_pose_access import TypedPoseAccess
from observed_input_domain import ObservedInputDomain
from neutral_observer import measure as observe

PUBLIC_FIELDS={'frame_rows','frame_packet','level','levels_completed','state','step_index','available_action_refs','frame_hash'}
FLAGS=['typed_carrier_plan','material_flow_plan','material_pose_plan']
WRAPPER_KEYS={'composition_target_tree','field_subquestion','morphology','strategy_receipt'}
OBSERVATION_REF=re.compile(r'^(.*):epoch:(\d+):revision:(\d+):frame:([a-f0-9]+)$')

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def packed(value):return json.dumps(value,sort_keys=True,separators=(',',':')).encode()
def digest(value):return hashlib.sha256(packed(value)).hexdigest()
def exact(a,b):return packed(a)==packed(b)
def load(path):
    raw=path.read_bytes();return json.loads(gzip.decompress(raw)if path.suffix=='.gz'else raw)
def proof(path):return {'path':path.relative_to(ROOT).as_posix(),'sha256':sha(path),'bytes':path.stat().st_size}
def plain(value):return helper.plain(copy.deepcopy(value))
def packet_hash(packet):return hashlib.sha256(json.dumps(packet,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
def check(a,b,path):
    if contracts.native_canonical(a)==contracts.native_canonical(b):return
    if isinstance(a,dict)and isinstance(b,dict)and set(a)==set(b):
        for key in a:check(a[key],b[key],path+'.'+key)
    elif isinstance(a,list)and isinstance(b,list)and len(a)==len(b):
        for index,(left,right)in enumerate(zip(a,b)):check(left,right,path+f'.{index}')
    raise AssertionError((path,a,b))
def restore_negative_zero(value,paths):
    result=copy.deepcopy(value);seen=set()
    for path in paths:
        assert isinstance(path,list)and path
        key=tuple(path);assert key not in seen;seen.add(key);node=result
        for piece in path[:-1]:node=node[piece]
        last=path[-1];assert not isinstance(node[last],bool)and isinstance(node[last],(int,float))and node[last]==0
        node[last]=-0.0
    return result
def json_transport(value):
    if isinstance(value,float)and value==0:return 0
    if isinstance(value,list):return [json_transport(v)for v in value]
    if isinstance(value,dict):return {k:json_transport(v)for k,v in value.items()}
    return value
def native_inventory():
    return {p.relative_to(ROOT).as_posix():sha(p)for folder in ['src/logos-engine','src/runtime']
            for p in sorted((ROOT/folder).rglob('*'))if p.is_file()and p.suffix in ('.ts','.json','.drm')}

def verify_native():
    paths={name:OUT/relative for name,relative in {'campaign':'life-three-levels-final.json','trace':'life-public-trace-final.json.gz',
           'execution':'logs/execution-life-final.json','source':'source-manifest-final.json'}.items()}
    c,t,e,s=[load(paths[name])for name in ['campaign','trace','execution','source']]
    assert c['status']==t['status']=='passed'and c['game']==t['game']=='LIFE'
    check(c['source'],s,'native.source');assert c['sourceUnchangedDuringRun']and t['sourceDigest']==s['digest']
    assert c['pythonAgentModules']==[]and c['final']['fullV6Parity']is False and c['final']['sessions']==1
    assert c['final']['nativeImplementation']=='logos-engine.typescript.v6.native-migration/0.20.0'
    assert s['fileCount']==len(s['files'])and s['digest']==digest(s['files']);check(native_inventory(),s['files'],'current.native.files')
    assert e['exitCode']==0 and e['nativeSourceUnchanged']is True
    check(e['nativeSource'],s,'execution.before');check(e['nativeSourceAfter'],s,'execution.after')
    assert e['nativeSourceManifestDigest']==s['digest']
    assert e['command']==['node','scripts/run-v44-campaign.mjs','LIFE','3',str(paths['campaign']),str(paths['trace'])]
    for key,name in [('report','campaign'),('trace','trace')]:check(e[key],proof(paths[name]),'execution.'+key)
    for key in ['generator','output']:check(e[key],proof(ROOT/e[key]['path']),'execution.'+key)
    last=json.loads(gzip.decompress((ROOT/e['output']['path']).read_bytes()).decode().splitlines()[-1])
    assert last['status']=='passed'and last['sourceDigest']==s['digest'];check(last['final'],c['final'],'log.final')
    check(last['boundaries'],c['boundaries'],'log.boundaries')
    assert c['final']['actions']==len(c['actions'])==len(t['packets'])-1
    assert c['final']['prefixes']==len(c['prefixes'])and sum(p['acquiredActions']for p in c['prefixes'])==len(c['actions'])
    assert c['final']['levelsCompleted']==c['targetLevels']==3 and c['final']['level']==4
    assert c['final']['state']=='NOT_FINISHED'and c['final']['reason']=='target_levels_completed'
    assert c['final']['caller']['acquiredTransitions']==len(c['actions'])and c['final']['caller']['boundaryReplays']==2
    assert [b['levelsCompleted']for b in c['boundaries']]==[1,2,3]and all(b['sessionRetained']for b in c['boundaries'])
    packet_checks=[]
    for i,item in enumerate(t['packets']):
        packet=item['packet'];assert set(packet)==PUBLIC_FIELDS and packet['step_index']==i
        assert packet['frame_hash']==hashlib.sha256(json.dumps(packet['frame_rows'],separators=(',',':')).encode()).hexdigest()[:16]
        if i:
            action=c['actions'][i-1];check(item['command'],action['command'],f'command.{i}')
            assert action['sequence']==i and packet_hash(packet)==action['publicPacketSha256']
            assert action['animationFrames']==len(packet['frame_packet'])and action['frameHash']==packet['frame_hash']
            assert (action['levelAfter'],action['completedAfter'],action['state'])==(packet['level'],packet['levels_completed'],packet['state'])
        else:assert packet_hash(packet)==c['initial']['publicPacketSha256']
        packet_checks.append({'index':i,'publicPacketSha256':packet_hash(packet),'canonicalPublicPacketSha256':digest(packet),'frames':len(packet['frame_packet'])})
    for name,value in c['gameAssets'].items():assert sha(ROOT/'public/python'/name)==value
    return c,t,s,paths,packet_checks

def compare():
    campaign,trace,native,paths,packets=verify_native()
    reference_path=ROOT/'tests/fixtures/v6-typed-material-reference.json.gz';probe_path=ROOT/'tests/fixtures/v6-typed-material-original-public.json.gz'
    reference,probe=load(reference_path),load(probe_path)
    manifest=load(helper.SOURCE.parent/'manifest.json')['files']
    assert len(manifest)==len(helper.VERIFIED_PINNED_SOURCE)==1786
    assert helper.verify_source_manifest()==helper.VERIFIED_PINNED_SOURCE
    for evidence in [reference,probe]:
        assert evidence['sourceCommit']==campaign['referenceCommit']==helper.COMMIT
        assert evidence['pinnedSourceFilesVerifiedBeforeImport']==1786
        assert sha(ROOT/evidence['generator'])==evidence['generatorSha256']
        for path,value in evidence['sourceHashes'].items():assert manifest[path]['sha256']==value
    assert reference['originalPublicProbe']['sha256']==sha(probe_path)
    assert probe['status']=='passed'and probe['actions']==46 and probe['levelsCompleted']==3 and len(probe['prefixes'])==44
    assert probe['fullOriginalCaller']is False and probe['manualPrimingActions']==probe['resets']==probe['levelJumps']==0
    assert probe['frontierEnabled']is False and probe['providerOrder']==['material_propose']
    check(probe['gameAssetHashes'],campaign['gameAssets'],'assets.source_native')
    check(probe['packets'][0]['packet'],trace['packets'][0]['packet'],'initial.complete_packet')
    common_commands=0
    for left,right in zip(probe['packets'][1:],trace['packets'][1:]):
        if exact(left['command'],right['command'])and exact(left['packet'],right['packet']):common_commands+=1
        else:break
    first_own=next(p['typedMaterial']for p in campaign['prefixes']if p.get('typedMaterial'))
    first_plan=next(first_own['proposal'][flag]for flag in FLAGS if flag in first_own['proposal'])
    match=OBSERVATION_REF.fullmatch(first_plan['observation_ref']);assert match
    scope=match.group(1);observations=[observe(SimpleNamespace(**item['packet']),i+1,scope)[0]for i,item in enumerate(trace['packets'])]
    family=TypedMaterialConstraint();domain=ObservedInputDomain(4096);native_memory=TypedPoseAccess()
    checks=[];source_events=[];native_events=[];offers=[];foreign=[];annotations=[];cursor=boundary=0
    counts=Counter();decision_ties={'carrier':0,'pose':0};negative_paths=0
    sys.setprofile(contracts.profile)
    try:
        for prefix_index,prefix in enumerate(campaign['prefixes']):
            start=cursor;before=observations[cursor];frame=trace['packets'][cursor]['packet'];inputs=domain.candidates(before)
            offered=family.material_propose(before,frame['frame_rows'],inputs,600-(cursor-boundary),reference['policy'])
            own=prefix.get('typedMaterial')
            returned_events=restore_negative_zero(prefix['sharedSeries']['typedMaterialAcquiredEvents'],prefix['sharedSeries']['typedMaterialAcquiredNegativeZeroPaths'])
            negative_paths+=len(prefix['sharedSeries']['typedMaterialAcquiredNegativeZeroPaths'])
            if own:
                assert offered is not None
                family.bind(offered,domain)
                native_proposal=restore_negative_zero(own['proposal'],own['negativeZeroPaths']);negative_paths+=len(own['negativeZeroPaths'])
                extras=set(native_proposal)-set(offered);assert extras<=WRAPPER_KEYS and not(set(offered)-set(native_proposal)),extras
                flags=[flag for flag in FLAGS if flag in offered];assert len(flags)==1;flag=flags[0]
                check(json_transport(native_proposal),own['proposal'],f'prefix.{prefix_index}.retained-proposal-transport')
                assert prefix['family']=='public_occurrence_recall'and own['stateNode']=='family_state:public_occurrence_recall'
                assert prefix['selectionGroup']=='window_constraints'and prefix['fieldSubquestion']=='typed_material_flow'
                plan=offered[flag]
                if flag=='typed_carrier_plan'and not plan['contact_context']:
                    decision_ties['carrier']+=int(sum(c['center']==plan['selected']['center']for c in plan['scene']['carriers'])>1)
                if flag=='material_pose_plan':
                    options=family.memory.matching_pose_targets(plan['child'],frame['frame_rows'],before);best=min(o['turns']for o in options)
                    decision_ties['pose']+=int(len({o['model_ref']for o in options if o['turns']==best})>1)
                counts[offered['kind']+':'+plan.get('mode',plan.get('reason'))]+=1
                offers.append({'prefixIndex':prefix_index,'firstAction':cursor+1,'source':plain(offered),'nativeTemplate':contracts.shadow(offered),
                               'native':{k:v for k,v in native_proposal.items()if k not in extras}})
                annotations.append({'prefixIndex':prefix_index,'fields':sorted(extras),'sha256':digest({k:native_proposal[k]for k in extras})})
                acquisition_proposal=offered
            else:
                acquisition_proposal={}
                foreign.append({'prefixIndex':prefix_index,'firstAction':cursor+1,'nativeFamily':prefix['family'],'kind':prefix['proposalKind'],
                                'actions':prefix['acquiredActions'],'sourceMaterialOfferKind':offered['kind']if offered else None,
                                'sourceMaterialOfferActions':plain(offered['actions'])if offered else []})
            offset=0;prefix_source=[]
            for index in range(prefix['acquiredActions']):
                earlier=trace['packets'][cursor]['packet'];later=trace['packets'][cursor+1]['packet'];b=observations[cursor];a=observations[cursor+1]
                command=trace['packets'][cursor+1]['command']
                if own:
                    check(offered['actions'][index],command,f'actual.material.command.{cursor+1}')
                    guard=family.before(offered,index,SimpleNamespace(**earlier),b);assert guard['admitted']is True
                    outcome=family.after(offered,index,b,a,earlier['frame_rows'],later['frame_rows'])
                else:guard=outcome=None
                acquired=family.record(b,a,command,earlier['frame_rows'],later['frame_rows'],acquisition_proposal,index,frames=later['frame_packet'])
                original_events=contracts.own(acquired['events']);prefix_source.extend(original_events);source_events.extend(original_events)
                chunk=returned_events[offset:offset+len(original_events)];assert len(chunk)==len(original_events)
                for event in chunk:native_memory.apply_event(copy.deepcopy(event))
                native_events.extend(chunk);offset+=len(chunk)
                source_state=plain({key:getattr(family.memory,key)for key in helper.OWN_FIELDS})
                replay_state=plain({key:getattr(native_memory,key)for key in helper.OWN_FIELDS})
                checks.append({'actionIndex':cursor+1,'prefixIndex':prefix_index,'sourceGuard':plain(guard),'sourceAfter':plain(outcome),
                               'sourceEvents':original_events,'nativeEvents':chunk,'sourceOwnState':source_state,'nativeReconstructedOwnState':replay_state})
                cursor+=1
                if a['levels_completed']>b['levels_completed']:boundary=cursor
            assert offset==len(returned_events)
            assert prefix['sharedSeries']['typedMaterialEventCount']==len(native_events)
            check(json_transport(native_events[-1])if native_events else None,prefix['sharedSeries']['typedMaterialLatestEvent'],f'latest-event.{prefix_index}')
            assert prefix['callerAcquiredTransitions']==cursor and prefix['operations']==['OP29','OP30','OP31']
            assert cursor-start==prefix['acquiredActions']
    finally:sys.setprofile(None)
    translate=contracts.identity_projection()
    proposal_checks=[];event_checks=[]
    for offer in offers:
        expected=translate(offer['nativeTemplate']);check(expected,offer['native'],f'provider-envelope.{offer["prefixIndex"]}')
        proposal_checks.append({'prefixIndex':offer['prefixIndex'],'firstAction':offer['firstAction'],
                               'sourceProposalSha256':digest(offer['source']),'nativeCanonicalSha256':contracts.native_hash(expected),
                               'allProviderFieldsCompared':True,'matchedUnderDeclaredIdentityProjection':True})
    for item in checks:
        expected_events=translate(item['sourceEvents']);check(expected_events,item['nativeEvents'],f'acquired-events.{item["actionIndex"]}')
        expected_state=translate(item['sourceOwnState']);check(expected_state,item['nativeReconstructedOwnState'],f'own-state.{item["actionIndex"]}')
        event_checks.append({'actionIndex':item['actionIndex'],'prefixIndex':item['prefixIndex'],'sourceBeforeGuard':item['sourceGuard'],'sourceAfterOutcome':item['sourceAfter'],
                             'ownEvents':len(expected_events),'eventsCanonicalSha256':contracts.native_hash(expected_events),
                             'stateCanonicalSha256':contracts.native_hash(expected_state),'eventsAndReconstructedOwnStateMatch':True})
    assert cursor==campaign['final']['actions']and len(native_events)==len(source_events)
    assert helper.verify_source_manifest()==helper.VERIFIED_PINNED_SOURCE
    identity_bundle={'schema':'logos-engine.v50.material-derived-identities.v1','sourceCommit':helper.COMMIT,
                     'qualification':reference['qualification'],'recipes':list(contracts.RECIPES.values()),
                     'numericInputScope':'Finite safe-integer or exact dyadic raster values, with explicit source integer/float spelling and IEEE-754 signed-zero rotation templates.',
                     'sourceInputHashesVerified':True,'nativeInputHashesIndependentlyRecomputed':True,'recipeCount':len(contracts.RECIPES)}
    identity_bytes=gzip.compress(packed(identity_bundle),mtime=0)
    identity_path=OUT/'life-material-identity-recipes.json.gz'
    identity_proof={'path':identity_path.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(identity_bytes).hexdigest(),'bytes':len(identity_bytes)}
    divergence=None
    if common_commands<min(len(probe['packets']),len(trace['packets']))-1:
        i=common_commands+1;divergence={'actionIndex':i,'sourceCommand':probe['packets'][i]['command'],'nativeCommand':trace['packets'][i]['command'],
                                      'sourcePublicPacketSha256':packet_hash(probe['packets'][i]['packet']),'nativePublicPacketSha256':packet_hash(trace['packets'][i]['packet'])}
    report={'schema':'logos-engine.v50.material-public-component-comparison.v1','status':'passed',
            'comparisonConclusion':'complete_own_provider_fields_and_actual_acquisitions_match_under_independently_verified_native_identity_and_signed_zero_projection',
            'originalFullCommonCallerParity':False,'rawPythonNativeIdentityParity':False,'universalLexicalHashDecisionParity':False,
            'recordedPublicTrajectoriesEquivalent':common_commands==probe['actions']==campaign['final']['actions'],
            'inputs':{'sourceComponentCampaign':proof(probe_path),'sourceContracts':proof(reference_path),**{name:proof(path)for name,path in paths.items()}},
            'generator':proof(Path(__file__)),'identityEvidence':identity_proof,
            'summary':{'nativeActions':cursor,'sourceSubsetActions':46,'levelsCompleted':3,'officialState':campaign['final']['state'],
                       'enteredLevel':campaign['final']['level'],'nativePrefixes':len(campaign['prefixes']),'sourceSubsetPrefixes':44,
                       'nativeCompletePublicPackets':len(packets),'nativePublicFramesIncludingInitial':sum(p['frames']for p in packets),
                       'exactCommonInitialCommands':common_commands,'exactCommonInitialPackets':common_commands+1,
                       'sourceProviderProposalsCompared':len(offers),'ownAcquiredEventsCompared':len(native_events),'ownEventKinds':dict(Counter(e['kind']for e in native_events)),
                       'foreignPrefixes':len(foreign),'foreignActions':sum(p['actions']for p in foreign),'stateReconstructions':len(checks),
                       'identityRecipes':len(contracts.RECIPES),'explicitNegativeZeroPathsRestored':negative_paths,
                       'observedSourceHashDecisionTies':decision_ties,'nativePerLevelActions':[b['levelActions']for b in campaign['boundaries']],
                       'sourcePerLevelActions':[14,14,18]},
            'sourceVerification':{'commit':helper.COMMIT,'allPinnedFilesVerified':1786,'sourceHashes':helper.source_hashes(),'sourceUnchanged':True},
            'nativeVerification':{'nativeSourceFiles':native['fileCount'],'sourceDigest':native['digest'],'sourceUnchangedDuringRun':True,'executionExitCode':0,
                                  'reportTraceLogsAndInventoryVerified':True,'pythonAgentModules':[]},
            'publicEvidence':{'fields':sorted(PUBLIC_FIELDS),'packets':packets,'firstTrajectoryDivergence':divergence},
            'componentReplay':{'observationNamespace':scope,'proposalKindsAndModes':dict(counts),'proposals':proposal_checks,'transitions':event_checks,'foreignProviders':foreign,
                               'nativeCallerAnnotationsOutsideProvider':annotations,'absoluteNumericTolerance':0,
                               'identityProjection':reference['qualification']['numerics'],'derivedSetOrdering':reference['qualification']['derivedSetOrdering'],
                               'signedZero':reference['qualification']['signedZero'],
                               'stateScope':'Original own states are recomputed from actual public transitions and compared with independent Python reconstruction from the retained native own events after every acquired action. Native full graph/ancestor digest and original full caller ordering remain outside this claim.',
                               'selectionScope':'All selected material offers on this actual trace are compared. Controlled contracts separately demonstrate different carrier/pose choices when only lexical hash order breaks a tie; such equivalence is never inferred from an identity mapping.'}}
    return report,identity_path,identity_bytes

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--verify',action='store_true');args=parser.parse_args()
    output=OUT/'life-original-component-comparison.json'
    report,identity_path,identity_bytes=compare();encoded=(json.dumps(report,ensure_ascii=False,indent=2)+'\n').encode()
    if args.verify:
        assert output.read_bytes()==encoded,'Retained comparison differs from recomputation'
        assert identity_path.read_bytes()==identity_bytes,'Retained identity proof differs from recomputation'
    else:
        assert not output.exists()and not identity_path.exists(),'Do not overwrite retained comparison evidence'
        identity_path.write_bytes(identity_bytes);output.write_bytes(encoded)
    print(json.dumps({'status':'passed','mode':'verify'if args.verify else'create','output':output.relative_to(ROOT).as_posix(),'summary':report['summary']}),flush=True)

if __name__=='__main__':main()
