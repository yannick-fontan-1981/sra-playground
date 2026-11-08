#!/usr/bin/env python3
"""Recompute original catalogue proposals/acquisitions on the native public trace.

No game or native agent runs. The source provider-only campaign and native common
caller differ; their divergence is retained, not normalized away. This comparer
reexecutes pinned original catalogue methods on every actual native public return.
"""
from __future__ import annotations
import argparse
from collections import Counter
import copy
import gzip
import hashlib
from importlib.util import module_from_spec,spec_from_file_location
import json
from pathlib import Path
import re
import sys
import time
from types import SimpleNamespace

sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/migration/native-campaigns-v49'
SPEC=spec_from_file_location('catalogue_source',ROOT/'scripts/probe-v6-occluded-catalogue-frontier-original.py')
source_helper=module_from_spec(SPEC);SPEC.loader.exec_module(source_helper)
from common_observed_compositions import ObservedCompositionConstraint
from observed_input_domain import ObservedInputDomain
from neutral_observer import measure as observe
from occluded_catalogue_observation import measure
from catalogue_view_memory import CatalogueViewMemory
from occluded_catalogue_access import OccludedCatalogueAccess
from framed_window_access import FramedWindowAccess
from terminal_composition import identity

PUBLIC_FIELDS={'frame_rows','frame_packet','level','levels_completed','state','step_index','available_action_refs','frame_hash'}
OWN_KINDS={'catalogue_observation','catalogue_response','catalogue_field_input_observed'}
WRAPPER_KEYS={'composition_target_tree','field_subquestion','morphology','strategy_receipt'}
OBSERVATION_REF=re.compile(r'^(.*):epoch:(\d+):revision:(\d+):frame:([a-f0-9]+)$')

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def packed(v):return json.dumps(v,sort_keys=True,separators=(',',':')).encode()
def digest(v):return hashlib.sha256(packed(v)).hexdigest()
def exact(a,b):return packed(a)==packed(b)
def load(path):
    raw=path.read_bytes();return json.loads(gzip.decompress(raw) if path.suffix=='.gz' else raw)
def proof(path):return {'path':str(path.relative_to(ROOT)),'sha256':sha(path),'bytes':path.stat().st_size}
def packet_hash(packet):return hashlib.sha256(json.dumps(packet,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
def plain(v):return source_helper.plain(copy.deepcopy(v))
def raw_command(command):
    if command is None:return None
    if command['action_ref']!='ACTION6' and command.get('data')=={}:
        assert set(command)=={'action_ref','data'};return {'action_ref':command['action_ref']}
    return copy.deepcopy(command)
def check(a,b,path):
    if not exact(a,b):
        if isinstance(a,dict) and isinstance(b,dict) and set(a)==set(b):
            for k in a:check(a[k],b[k],path+'.'+k)
        elif isinstance(a,list) and isinstance(b,list) and len(a)==len(b):
            for i,(left,right) in enumerate(zip(a,b)):check(left,right,path+f'.{i}')
        raise AssertionError((path,a,b))


def verify_native():
    paths={name:OUT/relative for name,relative in {'campaign':'gril-three-levels.json','trace':'gril-public-trace.json.gz',
           'execution':'logs/execution-gril.json','source':'source-manifest.json'}.items()}
    c,t,e,s=[load(paths[name]) for name in ['campaign','trace','execution','source']]
    assert c['status']==t['status']=='passed' and c['game']==t['game']=='GRIL'
    check(c['source'],s,'native.source');assert c['sourceUnchangedDuringRun'] and t['sourceDigest']==s['digest']
    assert c['pythonAgentModules']==[] and c['final']['fullV6Parity'] is False and c['final']['sessions']==1
    assert c['final']['nativeImplementation']=='logos-engine.typescript.v6.native-migration/0.19.0'
    assert s['fileCount']==len(s['files'])==166 and s['digest']==digest(s['files'])
    files={p.relative_to(ROOT).as_posix():sha(p) for folder in ['src/logos-engine','src/runtime']
           for p in (ROOT/folder).rglob('*') if p.is_file() and p.suffix in ('.ts','.json','.drm')}
    check(files,s['files'],'native.frozen_inventory')
    assert e['exitCode']==0 and e['nativeSourceUnchanged'] is True
    check(e['nativeSource'],s,'execution.source');check(e['nativeSourceAfter'],s,'execution.after')
    assert e['nativeSourceManifestDigest']==s['digest']
    assert e['command']==['node','scripts/run-v44-campaign.mjs','GRIL','3',str(paths['campaign']),str(paths['trace'])]
    for key,name in [('report','campaign'),('trace','trace')]:check(e[key],proof(paths[name]),'execution.'+key)
    for key in ['generator','output']:check(e[key],proof(ROOT/e[key]['path']),'execution.'+key)
    last=json.loads(gzip.decompress((ROOT/e['output']['path']).read_bytes()).decode().splitlines()[-1])
    assert last['status']=='passed' and last['sourceDigest']==s['digest']
    check(last['final'],c['final'],'log.final');check(last['boundaries'],c['boundaries'],'log.boundaries')
    assert c['final']['actions']==len(c['actions'])==19 and len(t['packets'])==20
    assert c['final']['prefixes']==len(c['prefixes'])==19 and all(p['acquiredActions']==1 for p in c['prefixes'])
    assert c['final']['levelsCompleted']==c['targetLevels']==3 and c['final']['level']==4
    assert c['final']['state']=='NOT_FINISHED' and c['final']['reason']=='target_levels_completed'
    assert c['final']['caller']['acquiredTransitions']==19 and c['final']['caller']['boundaryReplays']==2
    assert [b['totalActions'] for b in c['boundaries']]==[5,10,19]
    assert [b['levelActions'] for b in c['boundaries']]==[5,5,9] and all(b['sessionRetained'] for b in c['boundaries'])
    assert packet_hash(t['packets'][0]['packet'])==c['initial']['publicPacketSha256']
    packets=[];transport=[]
    for i,item in enumerate(t['packets']):
        packet=item['packet'];assert set(packet)==PUBLIC_FIELDS
        assert packet['step_index']==i
        assert packet['frame_hash']==hashlib.sha256(json.dumps(packet['frame_rows'],separators=(',',':')).encode()).hexdigest()[:16]
        if i:
            a=c['actions'][i-1];check(item['command'],a['command'],f'public.command.{i}')
            assert a['sequence']==i and packet_hash(packet)==a['publicPacketSha256']
            assert a['animationFrames']==len(packet['frame_packet']) and a['frameHash']==packet['frame_hash']
            assert (a['levelAfter'],a['completedAfter'],a['state'])==(packet['level'],packet['levels_completed'],packet['state'])
            raw=raw_command(item['command'])
            if raw!=item['command']:transport.append({'actionIndex':i,'publicTransport':item['command'],'rawAcquiredCommand':raw})
        packets.append({'packetIndex':i,'allPublicFieldsRetained':True,'publicPacketSha256':packet_hash(packet),
                        'canonicalPublicPacketSha256':digest(packet),'frames':len(packet['frame_packet'])})
    for name,expected in c['gameAssets'].items():assert sha(ROOT/'public/python'/name)==expected
    return c,t,s,paths,packets,transport


def compare():
    campaign,trace,native,paths,packet_checks,transport=verify_native()
    reference_path=ROOT/'tests/fixtures/v6-occluded-catalogue-reference.json.gz'
    probe_path=ROOT/'tests/fixtures/v6-occluded-catalogue-frontier-original-public.json.gz'
    cold_path=ROOT/'tests/fixtures/v6-occluded-catalogue-original-public.json.gz'
    reference,probe,cold=map(load,[reference_path,probe_path,cold_path])
    manifest=load(source_helper.SOURCE.parent/'manifest.json')['files']
    assert len(manifest)==len(source_helper.VERIFIED_PINNED_SOURCE)==1786
    assert source_helper.verify_source_manifest()==source_helper.VERIFIED_PINNED_SOURCE
    for evidence in [reference,probe,cold]:
        assert evidence['sourceCommit']==campaign['referenceCommit']==source_helper.COMMIT
        assert evidence['pinnedSourceFilesVerifiedBeforeImport']==1786
        assert sha(ROOT/evidence['generator'])==evidence['generatorSha256']
        for path,value in evidence['sourceHashes'].items():assert manifest[path]['sha256']==value
    assert reference['originalPublicProbe']['sha256']==sha(probe_path) and reference['isolatedColdProbe']['sha256']==sha(cold_path)
    assert reference['sourceAliasing']==[] and cold['actions']==0 and cold['reason']=='occluded_catalogue_component_abstained'
    assert probe['status']=='passed' and probe['actions']==18 and probe['levelsCompleted']==3
    assert probe['fullOriginalCaller'] is False and probe['manualPrimingActions']==probe['resets']==probe['levelJumps']==0
    check(probe['gameAssetHashes'],campaign['gameAssets'],'assets.source_native')
    assert probe['providerOrder']==['catalogue_propose','catalogue_view_propose','ObservedFrontier.propose']
    common_prefix=0
    for left,right in zip(probe['packets'][1:],trace['packets'][1:]):
        if exact(left['command'],raw_command(right['command'])) and exact(left['packet'],right['packet']):common_prefix+=1
        else:break
    assert common_prefix==8
    check(probe['packets'][0]['packet'],trace['packets'][0]['packet'],'initial.full_public_packet')
    first_diff=common_prefix+1
    divergence={'actionIndex':first_diff,'sourceCommand':probe['packets'][first_diff]['command'],
                'nativeCommand':raw_command(trace['packets'][first_diff]['command']),
                'sourcePacketDigest':digest(probe['packets'][first_diff]['packet']),
                'nativePacketDigest':digest(trace['packets'][first_diff]['packet']),
                'sourceProvider':probe['prefixes'][first_diff-1]['selectedProvider'],
                'nativeFamily':campaign['prefixes'][first_diff-1]['family']}
    assert divergence['sourceCommand']!=divergence['nativeCommand']
    first_events=campaign['prefixes'][0]['sharedSeries']['catalogueAcquiredEvents']
    scope=OBSERVATION_REF.fullmatch(first_events[0]['evidence'][0])[1]
    observations=[observe(SimpleNamespace(**item['packet']),i+1,scope)[0] for i,item in enumerate(trace['packets'])]
    family=ObservedCompositionConstraint();domain=ObservedInputDomain(4096)
    native_memory=CatalogueViewMemory()  # Replay only native retained own events for an independent state derivation.
    all_events=[];comparisons=[];metadata=[];external=[];boundary=0;counts=Counter()
    for i,prefix in enumerate(campaign['prefixes']):
        first=trace['packets'][i]['packet'];later=trace['packets'][i+1]['packet'];before=observations[i];after=observations[i+1]
        command=raw_command(trace['packets'][i+1]['command']);events=prefix['sharedSeries']['catalogueAcquiredEvents']
        assert events and prefix['callerAcquiredTransitions']==i+1 and prefix['operations']==['OP29','OP30','OP31']
        for event in events:
            check(event['evidence'],[before['observation_ref'],after['observation_ref']],f'acquisition.binding.{i}')
            check(event['command'],command,f'acquisition.raw_command.{i}')
        family.level_deadline=time.perf_counter()+300
        inputs=domain.candidates(before);remaining=600-(i-boundary)
        point=family.catalogue_propose(before,first['frame_rows'],inputs,remaining,reference['policy'])
        view=family.catalogue_view_propose(before,first['frame_rows'],inputs,remaining,reference['policy']) if point is None else None
        offered=point or view
        own=prefix.get('occludedCatalogue')
        if own:
            assert offered is not None
            source_proposal=plain(offered);family.bind(source_proposal,domain)
            native_proposal=own['proposal'];extras=set(native_proposal)-set(source_proposal)
            assert extras<=WRAPPER_KEYS and not (set(source_proposal)-set(native_proposal)),extras
            check(source_proposal,{k:v for k,v in native_proposal.items() if k not in extras},f'proposal.complete.{i+1}')
            check(own['plan'],native_proposal['occluded_catalogue_plan'],f'proposal.retained_plan.{i+1}')
            check(source_proposal['actions'],[command],f'proposal.actual_command.{i+1}')
            assert prefix['family']=='public_occurrence_recall' and own['stateNode']=='family_state:public_occurrence_recall'
            if source_proposal['occluded_catalogue_plan']['mode']=='view':assert prefix['selectionGroup']=='view'
            else:assert prefix['selectionGroup']=='window_constraints' and prefix['fieldSubquestion']=='occluded_catalogue_composition'
            assert native_proposal['strategy_receipt']['selected']==prefix['selectionGroup']
            metadata.append({'actionIndex':i+1,'fields':sorted(extras),'nativeCallerMetadataSha256':digest({k:native_proposal[k] for k in extras}),
                             'qualification':'Only named native common-caller annotations are outside the provider envelope. All original provider fields are retained and exact.'})
            guard=family.before(source_proposal,0,SimpleNamespace(**first),before);assert guard['admitted'] is True
            outcome=family.after(source_proposal,0,before,after,first['frame_rows'],later['frame_rows'])
            counts[source_proposal['occluded_catalogue_plan']['mode']]+=1
            acquisition_proposal=source_proposal
        else:
            # A foreign provider's plan is not part of this component claim.
            # Its actual raw command and complete public before/after still enter
            # the unchanged source acquisition, with no catalogue plan present.
            acquisition_proposal={}
            guard=outcome=None
            external.append({'actionIndex':i+1,'nativeFamily':prefix['family'],'nativeKind':prefix['proposalKind'],
                             'actualCommand':command,'sourceCatalogueOfferKind':offered['kind'] if offered else None,
                             'sourceCatalogueOfferCommands':offered['actions'] if offered else [],
                             'scope':'Foreign provider selection and its own plan are outside catalogue component parity. Every actual public return remains acquired by the source catalogue layer.'})
        acquired=family.record(before,after,command,first['frame_rows'],later['frame_rows'],acquisition_proposal,0,frames=later['frame_packet'])
        original_events=[event for event in acquired['events'] if event['kind'] in OWN_KINDS]
        check(plain(original_events),events,f'acquisition.complete_own_events.{i+1}')
        for event in events:native_memory.apply_event(copy.deepcopy(event))
        state=source_helper.state(family.memory)['projection'];native_state=source_helper.state(native_memory)['projection']
        check(plain(state),plain(native_state),f'acquisition.reconstructed_own_state.{i+1}')
        all_events.extend(copy.deepcopy(events))
        assert prefix['sharedSeries']['catalogueEventCount']==len(all_events)
        check(prefix['sharedSeries']['catalogueLatestEvent'],all_events[-1],f'acquisition.latest.{i+1}')
        comparisons.append({'actionIndex':i+1,'sourceCatalogueProposalCompared':own is not None,
                            'completeSourceProposalSha256':digest(source_proposal) if own else None,
                            'sourceBeforeGuard':plain(guard),'sourceAfterOutcome':plain(outcome),
                            'completeAcquiredEventsExact':True,'acquiredOwnEvents':len(events),'eventsSha256':digest(events),
                            'ownStateExactAfterNativeEventReplay':True,'sourceOwnStateSha256':digest(plain(state)),
                            'retainedEventCount':len(all_events),'currentSceneSha256':digest(plain(measure(first['frame_rows'])))})
        if after['levels_completed']>before['levels_completed']:boundary=i+1
    assert sum(counts.values())==14 and counts=={'answer':7,'select':4,'view':3}
    assert len(all_events)==34 and len(external)==5
    counts_events=Counter(e['kind'] for e in all_events)
    assert counts_events=={'catalogue_observation':16,'catalogue_response':11,'catalogue_field_input_observed':7}
    assert source_helper.verify_source_manifest()==source_helper.VERIFIED_PINNED_SOURCE
    imported=source_helper.source_hashes()
    frames=sum(len(item['packet']['frame_packet']) for item in trace['packets'])
    return {'schema':'logos-engine.v49.catalogue-public-component-comparison.v1','status':'passed',
        'comparisonConclusion':'exact_catalogue_provider_and_acquisition_on_actual_native_public_returns_with_explicit_caller_trajectory_divergence',
        'recordedPublicTrajectoriesEquivalent':False,'originalFullCommonCallerParity':False,
        'inputs':{'sourceComponentCampaign':proof(probe_path),'isolatedColdProbe':proof(cold_path),'sourceContracts':proof(reference_path),
                  **{name:proof(path) for name,path in paths.items()}},'generator':proof(Path(__file__)),
        'summary':{'nativeActions':19,'sourceSubsetActions':18,'levelsCompleted':3,'officialState':'NOT_FINISHED','enteredLevel':4,
                   'nativePrefixes':19,'sourceSubsetPrefixes':18,'nativeCompletePublicPackets':20,'nativePublicFramesIncludingInitial':frames,
                   'exactCommonInitialCommands':common_prefix,'exactCommonInitialPackets':common_prefix+1,
                   'sameCurrentInputSourceProposalsCompared':sum(counts.values()),'proposalModes':dict(counts),
                   'allNativeOwnEventsCompared':len(all_events),'eventKinds':dict(counts_events),
                   'foreignProviderTransitionsAcquired':len(external),'stateReconstructions':len(comparisons),
                   'nativeCallerAcquiredTransitions':19,'nativeBoundaryReplays':2,'sourceAndNativeSessions':1,
                   'normalizedScalarTransportCommands':len(transport)},
        'sourceVerification':{'commit':source_helper.COMMIT,'allPinnedFilesVerified':len(manifest),'importedSourceFiles':len(imported),
                              'sourceHashes':imported,'sourceUnchanged':True,'sourceAndNativeGameAssetsExact':True,
                              'sourceIsolatedColdAbstentionRetained':True},
        'nativeVerification':{'nativeSourceFiles':native['fileCount'],'nativeSourceDigest':native['digest'],'currentInventoryExact':True,
                              'sourceUnchangedDuringRun':True,'executionExitCode':0,'reportTraceAndLogsVerified':True,'pythonAgentModules':[]},
        'publicEvidence':{'fields':sorted(PUBLIC_FIELDS),'packets':packet_checks,'scalarTransportNormalizations':transport,
                          'nativeBoundaryActions':[5,10,19],'nativePerLevelActions':[5,5,9],
                          'sourceSubsetBoundaryActions':[5,10,18],'sourceSubsetPerLevelActions':[5,5,8],
                          'firstTrajectoryDivergence':divergence},
        'componentReplay':{'observationNamespace':scope,'sourceObservationInputs':'Reconstructed by the unchanged neutral observer from each native complete public packet, with the actual native observation namespace and unchanged epoch/revision/frame suffix.',
                           'normalizations':[],'nativeCallerAnnotationsOutsideProvider':metadata,'prefixes':comparisons,
                           'foreignProviders':external,'absoluteNumericTolerance':0,
                           'stateScope':'Source own catalogue and view states are independently recomputed from public transitions and compared with the state obtained by replaying every retained native own event. The full inherited memory/graph digest is outside this scope.',
                           'notCompared':['original full common caller selection','foreign-provider plans or their source parity','complete inherited family and graph identity','equal elapsed budgets or performance','complete-game victory beyond three levels']},
        'qualification':'The source provider subset completes GRIL in 18 actions (5,5,8); the actual native common caller completes it in 19 (5,5,9). Eight initial commands and nine full packets match, then selection diverges. The unchanged original catalogue component is independently replayed on all 19 actual native transitions: all 14 selected catalogue/view proposals and all 34 acquired own events agree exactly on these same current public inputs. Five foreign-provider returns are also acquired; their selection/plan parity is not asserted. Source callbacks run only for comparison, never inside the native agent.'}


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--verify',action='store_true');args=parser.parse_args()
    result=compare();destination=OUT/'gril-original-component-comparison.json'
    if args.verify:check(load(destination),result,'retained_comparison')
    else:
        if destination.exists():raise FileExistsError(destination)
        destination.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'status':'passed','mode':'verify' if args.verify else 'create','output':str(destination.relative_to(ROOT)),'summary':result['summary']}),flush=True)

if __name__=='__main__':main()
