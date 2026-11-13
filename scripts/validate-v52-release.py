#!/usr/bin/env python3
"""Validate retained v52 evidence without a game, native agent or test execution.

Only validation.json can be written. --verify independently recomputes both
source component comparisons, checks every retained byte and writes nothing.
Failed attempts, instrumented diagnosis, recorded-public replays and the final
live campaign remain separate evidence classes.
"""
from __future__ import annotations
import argparse
import ast
from collections import Counter
import gzip
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import re
import subprocess
import sys
import tarfile
from urllib.parse import parse_qs,urlsplit

sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
HISTORY=ROOT/'docs/migration/native-campaigns-v52'
PREVIOUS_FINAL=HISTORY/'final'
PREVIOUS_UNIFORM=HISTORY/'verified'
PREVIOUS_TYPED_PRIORITY=HISTORY/'attempt7'
PREVIOUS_SETTLED_PREPARATION=HISTORY/'attempt8'
OUT=HISTORY/'attempt9'
BASE='9fb19f769f4920808ddaabf8ba73c07e5a125d0f'
REFERENCE_COMMIT='786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
REFERENCE=ROOT/'reference/v6'/REFERENCE_COMMIT
IMPLEMENTATION='logos-engine.typescript.v6.native-migration/0.22.0'
PROJECT='appgprj_6adbc388d79081918581b93b919d7258'
FAILED_SOURCE_DIGEST='c227cb63aa743ed5790acc7e0cb825e107a4a6ac87471754a3216084ff224bf2'
PACKET_ONLY_SOURCE_DIGEST='686159b35c366a6305f46ee1c06e4d0c2d54ae805c8c3c47cdb165b0b732dacc'
UNIFORM_SOURCE_DIGEST='a076b3a403036cb40922795d4103ce6fc94be5971672ac4cb20377cc27092748'
TYPED_PRIORITY_SOURCE_DIGEST='2d1295c937cb3b058e7fa210ab4f84bbfbcb533d15c24ca4c3ab25b13c28615b'
PRE_PHASED_SOURCE_DIGEST='0fb60234d0ffb2b191d9d8d107b9150b6853eb6432cca0b414ca1d5fa56bc25f'
# Filled only after the separately retained final source has actually been frozen.
EXPECTED_SOURCE_DIGEST='e32656de6ab64b0f6bdf8188e7bdeac06b4b3063c0bfb6d5531484cefb900f60'
NATIVE_FILES=181
GAMES=['STCK','CATL','SELE','COLM','ZIPP','GRIL','LIFE','VALV']
PUBLIC_FIELDS={'frame_rows','frame_packet','level','levels_completed','state','step_index','available_action_refs','frame_hash'}
CORE_TESTS=['tests/v6-framed-transfer-reference.test.ts','tests/v6-framed-transfer-kernel.test.ts',
 'tests/v6-native-runtime.test.ts','tests/v6-native-family-registration.test.ts','tests/v6-native-checkpoint-integration.test.ts',
 'tests/v6-native-caller.test.ts','tests/v6-caller-integration.test.ts','tests/v6-shared-series-native.test.ts',
 'tests/v6-field-service-kernel.test.ts','tests/v6-material-recovery-priority.test.ts','tests/v6-acquired-continuation-priority.test.ts',
 'tests/v6-learned-preparation-priority.test.ts','tests/v6-program-control-discovery-integration.test.ts',
 'tests/v6-occluded-catalogue-kernel.test.ts','tests/v6-queued-field-kernel.test.ts','tests/v6-trace-continuation.test.ts',
 'tests/v6-v45-kernel-integration.test.ts']

# Pure byte/TAP/image helpers are retained unchanged in the previous validator.
# Importing it does not execute its main function or validate the old release.
spec=importlib.util.spec_from_file_location('v51_readonly_helpers',ROOT/'scripts/validate-v51-release.py')
old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old)
require,sha,read,proof,check_file,check_map,file_inventory,packet_hash,tap_counts,image_properties,canonical_hash,check_safe_identity_value=(
 old.require,old.sha,old.read,old.proof,old.check_file,old.check_map,old.file_inventory,old.packet_hash,old.tap_counts,old.image_properties,old.canonical_hash,old.check_safe_identity_value)

def source_inventory():
    return {name:sha(ROOT/name) for name in sorted(file_inventory(['src/logos-engine','src/runtime'])) if Path(name).suffix in ['.ts','.json','.drm']}

def validate_source():
    require(EXPECTED_SOURCE_DIGEST is not None and NATIVE_FILES is not None,'The pending candidate source snapshot has not yet been frozen for validation')
    source=read(OUT/'source-manifest.json')
    require(source['files']==source_inventory(),'Frozen native source inventory or bytes changed')
    require(source['fileCount']==len(source['files'])==NATIVE_FILES,'Unexpected native file count')
    require(source['digest']==canonical_hash(source['files'])==EXPECTED_SOURCE_DIGEST,'Final native digest changed')
    return source

def archived_file(item,archive=None):
    if archive is not None and item['path'] in archive:
        data=archive[item['path']]
        require(hashlib.sha256(data).hexdigest()==item['sha256'],'Archived code differs: '+item['path'])
        if 'bytes' in item:require(len(data)==item['bytes'],'Archived code size differs: '+item['path'])
        return ROOT/item['path']
    return check_file(item)

def archived_map(items,archive=None):
    for name,value in items.items():archived_file({'path':name,'sha256':value},archive)

def validate_execution(execution,source,exit_code=0,archive=None):
    if archive is None:old.validate_execution(execution,source,exit_code)
    else:
        require(execution['exitCode']==exit_code and execution['nativeSourceUnchanged'] is True,'Historical execution failed or source changed')
        require(execution['nativeSource']==execution['nativeSourceAfter']==source,'Historical execution source differs from its retained freeze')
        for key in ['generator','output']:archived_file(execution[key],archive)
        if 'nativeSourceManifestDigest' in execution:require(execution['nativeSourceManifestDigest']==source['digest'],'Historical manifest digest changed')
        if 'harnessFileSha256' in execution:
            require(execution['harnessFilesUnchanged'] is True and execution['harnessFileSha256']==execution['harnessFileSha256After'],'Historical harness was changed during execution')
            archived_map(execution['harnessFileSha256'],archive)
        for item in execution.get('inputs',{}).values():archived_file(item,archive)
    if execution.get('schema')=='logos-engine.v52.actual-journaled-campaign-execution.v1':
        require(execution['executionCodeUnchanged'] is True and execution['runner']==execution['runnerAfter'] and execution['harness']==execution['harnessAfter'],'Journaled campaign execution code changed')
        for key in ['runner','harness']:archived_file(execution[key],archive)
        check_file(execution['publicJournal'])

def source_manifest_only(source):
    require(source['fileCount']==len(source['files']) and source['digest']==canonical_hash(source['files']),'Invalid retained source inventory')

def validate_report(report,source,status='passed'):
    require(report['status']==status and report['sourceUnchangedDuringRun'] is True,'Campaign status or immutability changed')
    require(report['source']==source and report['pythonAgentModules']==[],'Campaign source or Python-agent exclusion changed')
    final=report['final'];actions=report['actions'];prefixes=report['prefixes']
    require(final['sessions']==1 and final['nativeImplementation']==IMPLEMENTATION and final['fullV6Parity'] is False,'Session or parity claim changed')
    require(final['actions']==len(actions)==final['caller']['acquiredTransitions'],'Public action acquisition count changed')
    require(final['prefixes']==len(prefixes) and sum(p['acquiredActions'] for p in prefixes)==len(actions),'Prefix acquisition count changed')
    require(final['operationCounts']==dict(Counter(row['operation'] for row in report['requests'])),'Request counts changed')
    require(final['operationCounts']['init']==1 and final['operationCounts']['advance']==len(actions),'Repeated initialization or unacquired dispatch')
    require(set(final['operationCounts'])<={'init','advance','resume'},'Unexpected session operation')
    require([row['sequence'] for row in actions]==list(range(1,len(actions)+1)),'Noncontiguous physical action sequence')
    require(all(p['operations']==['OP29','OP30','OP31'] for p in prefixes),'A prefix bypassed ordinary Kernel acquisition')
    require(all(row['sessionRetained'] is True for row in report['boundaries']),'Boundary replaced the native session')
    require(report['initial']['level']==1 and report['initial']['levelsCompleted']==0 and report['initial']['state']=='NOT_FINISHED','Campaign did not begin cold')
    require(report['budget']=={'levelActionCaps':[600]*report['targetLevels'],'activeSecondsPerLevel':360,'clock':'real active compute and native execution'},'Production budget changed')
    for name,value in report['gameAssets'].items():check_file({'path':'public/python/'+name,'sha256':value})

def validate_trace(report,path,source_digest=None):
    trace=read(path);packets=trace['packets']
    require(trace['schema']=='logos-engine.native-public-game-trace.v1' and trace['status']==report['status'] and trace['game']==report['game'],'Trace scope or status changed')
    if source_digest is not None:require(trace['sourceDigest']==source_digest,'Trace source changed')
    require(len(packets)==len(report['actions'])+1 and packets[0]['command'] is None,'Incomplete public trace')
    require(packet_hash(packets[0]['packet'])==report['initial']['publicPacketSha256'],'Initial public packet changed')
    for index,item in enumerate(packets):
        p=item['packet'];require(set(p)==PUBLIC_FIELDS and p['step_index']==index and p['frame_hash']==packet_hash(p['frame_rows'])[:16],'Public field inventory or frame identity changed')
        if index:
            a=report['actions'][index-1];before=packets[index-1]['packet']
            require(item['command']==a['command'] and packet_hash(p)==a['publicPacketSha256'],'Physical command or complete return changed')
            require(len(p['frame_packet'])==a['animationFrames'],'Animation return was truncated')
            require((a['levelBefore'],a['completedBefore'])==(before['level'],before['levels_completed']),'Action predecessor changed')
            require((a['levelAfter'],a['completedAfter'],a['state'])==(p['level'],p['levels_completed'],p['state']),'Action outcome changed')
    return {'completePublicPackets':len(packets),'animationFramesIncludingInitial':sum(len(row['packet']['frame_packet']) for row in packets)}

def validate_campaign(source):
    report_path,trace_path,execution_path=[OUT/name for name in ['gare-three-levels.json','gare-public-trace.json.gz','execution-gare.json']]
    report,execution=read(report_path),read(execution_path)
    require(report['schema']=='logos-engine.v6.integrated-game-campaign.v1' and report['game']=='GARE' and report['targetLevels']==3 and report['referenceCommit']==REFERENCE_COMMIT,'Wrong live campaign identity')
    require(report['baseline'] is None and report['failure'] is None,'Final campaign is a replay or failure')
    validate_report(report,source);validate_execution(execution,source)
    require(execution['schema']=='logos-engine.v52.actual-journaled-campaign-execution.v1','Wrong live execution schema')
    journal_path=check_file(execution['publicJournal']);live_journal=ROOT.parent/f'v52-{OUT.name}-gare-actual-public-journal.jsonl'
    require(execution['command']==['node',str(ROOT/'scripts/run-v52-journaled-campaign.mjs'),'GARE','3',str(report_path),str(trace_path),str(live_journal)],'Live invocation changed')
    require(execution['report']==proof(report_path) and execution['trace']==proof(trace_path),'Live report and trace were relinked')
    last=json.loads(gzip.decompress(check_file(execution['output']).read_bytes()).decode().splitlines()[-1])
    require(last['status']=='passed' and last['sourceDigest']==source['digest'] and last['final']==report['final'] and last['boundaries']==report['boundaries'],'Actual log differs from final report')
    final=report['final'];packets=read(trace_path)['packets'];boundaries=report['boundaries'];packet_summary=validate_trace(report,trace_path,source['digest'])
    journal=[json.loads(line) for line in gzip.decompress(journal_path.read_bytes()).decode().splitlines()]
    require(journal==packets,'Passive streamed public journal differs from the complete actual trace')
    require(final['levelsCompleted']==3 and final['level']==4 and final['state']=='NOT_FINISHED' and final['reason']=='target_levels_completed','Three-level stop was reclassified or expanded to full WIN')
    completed=[i for i in range(1,len(packets)) if packets[i]['packet']['levels_completed']>packets[i-1]['packet']['levels_completed']]
    require(len(completed)==3 and [b['totalActions'] for b in boundaries]==completed,'Official boundaries differ from public returns')
    require([b['completedLevel'] for b in boundaries]==[1,2,3] and [b['nativeLevel'] for b in boundaries]==[2,3,4],'Official level progression changed')
    per_level=[b-a for a,b in zip([0,*completed[:-1]],completed)]
    require([b['levelActions'] for b in boundaries]==per_level and final['caller']['boundaryReplays']==2,'Boundary totals or retained replay count changed')
    family_counts=Counter(prefix['family'] for prefix in report['prefixes']);own_events=0;native_bindings=0;search_refusals=[]
    cursor=0
    for index,prefix in enumerate(report['prefixes']):
        require(prefix['callerAcquiredTransitions']==cursor+prefix['acquiredActions'],'Common acquisition count changed at prefix')
        framed=prefix['framedAcquisition'];require(framed['checkpointFormat']=='native.public_framed_transfer.v2' and framed['stateNode']=='family_state:public_framed_transfer','Shared FramedTransfer owner changed')
        own_events+=len(framed['acquired']);native_bindings+=len(prefix.get('nativeBindings',[]))
        for refusal in prefix.get('nativeProposalRefusals',[]):
            value=refusal['refusal'];require(value['status']=='unknown' and value['search_status']=='resource_bound' and value['release_authority'] is False,'Search bound was promoted into impossibility or authority')
            search_refusals.append({'prefixIndex':index,'evidence':refusal})
        cursor+=prefix['acquiredActions']
    require(cursor==final['actions'] and native_bindings>0,'Final session omits the separately declared current point binding')
    return {'report':proof(report_path),'trace':proof(trace_path),'actualExecution':proof(execution_path),
            'actualPublicJournal':proof(journal_path),'journalMatchesCompleteTrace':True,
            'actions':final['actions'],'prefixes':final['prefixes'],'levelsCompleted':3,'enteredLevel':4,'officialState':'NOT_FINISHED',
            'perLevelActions':per_level,'sessions':1,'commonCallerAcquiredTransitions':final['caller']['acquiredTransitions'],
            'boundaryReplays':2,'selectedFamilies':dict(family_counts),'framedOwnAcquiredEvents':own_events,'nativePointBindings':native_bindings,
            'boundedSearchRefusals':search_refusals,**packet_summary,
            'qualification':'One actual cold continuous native session. Native current-witness binding and resource-bounded abstention are explicit extensions; this is not complete original-caller parity or a full-game WIN.'}

def validate_pinned_source():
    manifest=read(REFERENCE/'manifest.json');require(manifest['commit']==REFERENCE_COMMIT and len(manifest['files'])==1786,'Pinned source inventory changed')
    for name,value in manifest['files'].items():check_file({'path':(REFERENCE/'source'/name).relative_to(ROOT).as_posix(),'sha256':value['sha256']})
    return manifest['files']

def identity_recipes(rows):
    require(rows,'Identity recipes missing')
    for row in rows:
        check_safe_identity_value(row['value'])
        encoded=json.dumps(row['value'],sort_keys=True,separators=(',',':'))
        require(encoded==row['sourceCanonical']==row['nativeCanonical'],'Qualified identity bytes differ')
        require(hashlib.sha256(encoded.encode()).hexdigest()==row['sourceHash']==row['nativeHash'],'Identity hash differs')
    return len(rows)

def validate_comparators(source,campaign):
    manifest=validate_pinned_source();path=OUT/'framed-transfer-original-comparison.json';value=read(path)
    require(value['schema']=='logos-engine.v52.final-framed-transfer-public-comparison.v1' and value['status']=='passed' and value['sourceModified'] is False,'Framed comparator failed')
    for key in ['fullOriginalCallerParity','fullOriginalCampaignMatched','identifierSubstitution','gameHostRunByComparator','nativeAgentRunByComparator','nativeOutputsUsedAsExpected']:
        require(value['qualification'][key] is False,'Framed component comparison overclaims '+key)
    require(value['nativeSourceDigest']==source['digest'] and value['nativeSourceFileCount']==source['fileCount'],'Framed comparator source differs')
    require(value['actualPublicJournal']['matchesCompleteTrace'] is True and value['actualPublicJournal']['completePublicPackets']==campaign['completePublicPackets'] and value['actualPublicJournal']['executionCodeUnchanged'] is True,'Framed comparator omitted the actual passive journal')
    for key in ['evidence','runner','harness']:check_file(value['actualPublicJournal'][key])
    require(value['pinnedSourceFilesVerifiedBeforeImport']==value['pinnedSourceFilesVerifiedAfterRun']==1786,'Framed comparator lacks full pinned verification')
    for item in value['inputs'].values():check_file(item)
    check_file(value['generator']);reference=read(check_file(value['referenceContracts']))
    for item in value['originalProbes']:check_file(item)
    for name,digest in value['sourceHashes'].items():require(manifest[name]['sha256']==digest,'Framed imported source changed')
    require(value['importedSourceModuleCount']==sum(name.endswith('.py') for name in value['sourceHashes']) and value['explicitLocalPolicyFileCount']==2,'Imported modules and policy files were conflated')
    require(value['nativeCampaign']['actions']==campaign['actions'] and value['nativeCampaign']['prefixes']==campaign['prefixes'] and value['nativeCampaign']['levelsCompleted']==3,'Framed comparator counts differ from live proof')
    require(len(value['transitionChecks'])==campaign['actions'] and len(value['completePackets'])==campaign['completePublicPackets'],'Framed comparison omitted a public transition')
    require(len(value['nativeGuardExtensions'])==campaign['nativePointBindings'],'Native point-binding differences were hidden')
    preserved=value['preservedOriginalPrefix']
    require(preserved['originalCompletedLevels']==1 and 0<=preserved['commands']<=12 and preserved['completePublicPackets']==preserved['commands']+1,'Original failure prefix was reclassified')
    require(value['qualification']['nativePacketExtensionIsOriginalSourceCapability'] is False and value['qualification']['nativeTargetReached'] is True and value['qualification']['nativeCampaignStatus']=='passed','Native receipt extension was mislabeled')
    check_file(value['nativeExtensionSpecification']['generator'])
    require(value['nativeExtensionSpecification']['sourceHelpersUnmodified'] is True and value['nativeExtensionSpecification']['nativeOutputsUsedAsExpected'] is False,'Native packet specification lacks independent expectations')
    check_file(value['nativeUniformQuestionSpecification']['generator'])
    require(value['nativeUniformQuestionSpecification']['sourceHelpersUnmodified'] is True and value['nativeUniformQuestionSpecification']['nativeOutputsUsedAsExpected'] is False,'Native question specification lacks independent expectations')
    for specification in ['nativePhasedReceptionSpecification','nativeDirectedCompositionSpecification']:
        check_file(value[specification]['generator'])
        require(value[specification]['sourceHelpersUnmodified'] is True and value[specification]['nativeOutputsUsedAsExpected'] is False,'Phased/directed specification lacks independent expectations')
    for key in ['nativeUniformQuestionsAreOriginalSourceCapability','nativeTypedCalibrationIsOriginalSourceProposal','nativeCalibrationPriorityIsOriginalSourceSelection',
                'nativePhasedReceptionIsOriginalSourceCapability','nativeDirectedCompositionIsOriginalSourceCapability',
                'phasedDirectedOnlyReceiptsEnterOriginalCandidates','preparedReceiverClaimedAsObservedReception']:
        require(value['qualification'][key] is False,'Native question coordination was promoted to source parity: '+key)
    allowed_annotations={'all_executed_statements','instruction_quantum','instructions','trace','execution_engine','reference_commit','reference_semantic_hash','native_execution_hash','source_definition_hash','edited'}
    require(set(value['qualification']['excludedNativeReceiptAnnotations'])==allowed_annotations and set(value['qualification']['sourceReceiptFields'])=={'workflow','src_hash','src_status','executed_statements'},'SRC comparison field boundary changed')
    require(all((row['path'].endswith('.workflow') or row['path'].endswith('.source_choice_workflow')) and set(row['fields'])<=allowed_annotations for row in value['srcReceiptAnnotations']),'SRC annotations were excluded outside explicit workflow receipt paths')
    require(value['completeNativeCheckpointsCompared']==campaign['prefixes'] and len(value['nativeProposalExtensions'])>0,'Complete native annex or proposal differences were omitted')
    own_recipes=read(check_file(value['identityEvidence']))
    own_identity_count=identity_recipes(own_recipes['recipes']);fixture_identity_count=identity_recipes(reference['identityRecipes'])
    require(value['identityRecipeCount']==own_identity_count,'Framed identity recipe count changed')
    require(reference['qualification']['sourceModified'] is False and reference['qualification']['nativeResultsUsedAsExpectations'] is False,'Source expectations were replaced')
    for fixture in [reference,*[read(ROOT/item['path']) for item in reference['originalPublicProbes']]]:
        check_file({'path':fixture['generator'],'sha256':fixture['generatorSha256']})
        for name,digest in fixture['sourceHashes'].items():require(manifest[name]['sha256']==digest,'Fixture imported source differs')
    service_path=OUT/'valv-service-original-component-comparison.json';service=read(service_path)
    require(service['schema']=='logos-engine.v52.service-recorded-public-component-comparison.v1' and service['status']=='passed','Service comparator failed')
    require(service['executionMode']=='recorded-public-replay' and service['newGameHostRun'] is False and service['newLiveCompletionClaimed'] is False,'Service replay was mislabeled as new live completion')
    require(service['nativeVerification']['sourceDigest']==source['digest'] and service['nativeVerification']['nativeSourceFiles']==source['fileCount'],'Service replay source differs')
    for item in service['inputs'].values():check_file(item)
    check_file(service['generator']);service_recipes=read(check_file(service['identityEvidence']))
    service_identity_count=identity_recipes(service_recipes['recipes'])
    require(service['summary']['identityRecipes']==service_identity_count and service['summary']['nativeRecordedReplayActions']==28 and service['summary']['ownAcquiredEventsCompared']==63,'Service comparison omitted the retained trajectory or own events')
    for script in ['scripts/compare-v52-final-framed-public-evidence.py','scripts/compare-v52-service-regression.py']:
        result=subprocess.run([sys.executable,script,'--verify'],cwd=ROOT,capture_output=True)
        require(result.returncode==0,'Independent read-only comparator failed: '+script+'\n'+result.stdout.decode()[-4000:]+result.stderr.decode()[-4000:])
    return {'framed':proof(path),'serviceReplay':proof(service_path),'readOnlySourceRecomputations':2,
            'framedOwnIdentityRecipes':own_identity_count,'framedFixtureIdentityRecipes':fixture_identity_count,'serviceReplayIdentityRecipes':service_identity_count,
            'framedContracts':{'geometry':len(reference['cases']),'policy':len(reference['policyCases']),'memoryAndGuards':len(reference['memoryCases']),'initialPublicViews':len(reference['initialMeasurements'])},
            'qualification':'Both Python comparators are recomputed unchanged without a game or native execution. Strict source proposals remain explicit counterfactuals; actual proposals and guards may use separately declared native questions. Original acquisitions, independent native annex acquisitions and qualified identities are checked in their stated domains without promoting a native extension to source parity.'}

def validate_extension_contracts(source):
    manifest=validate_pinned_source();results={}
    generator=ROOT/'scripts/compare-v52-native-extension-contracts.py';runner=ROOT/'scripts/measure-v52-native-extension-contracts.mjs'
    for kind,stem in [('phased','phased-reception-contract'),('directed','directed-composition-contract')]:
        path=OUT/(stem+'-comparison.json');value=read(path)
        require(value['schema']=='logos-engine.v52.native-extension-contract-comparison.v1' and value['status']=='passed' and value['kind']==kind,'Wrong independent extension comparison')
        require(value['nativeSourceDigest']==source['digest'] and value['nativeSourceFiles']==source['fileCount'] and value['sourceManifest']==proof(OUT/'source-manifest.json'),'Extension comparison uses another native freeze')
        require(value['sourceUnchangedBeforeAfter'] is True and value['pinnedSourceFilesVerifiedBeforeAfter']==1786,'Extension comparison lacks immutable source inventories')
        require(value['generator']==proof(generator) and value['nativeRunner']==proof(runner),'Extension comparison generator changed')
        check_map(value['specificationAndRunnerHashes'])
        for name,digest in value['effectiveSourceImports'].items():require(manifest[name]['sha256']==digest,'Extension original helper import changed')
        reference_path=check_file(value['reference']);native_path=check_file(value['retainedNativeOutput']);reference=read(reference_path)
        require(value['command']==['node',str(runner),kind,str(reference_path)],'Extension pure native measurement invocation changed')
        require(reference['schema']=='logos-engine.v52.native-extension-contract-reference.v1' and reference['kind']==kind and reference['referenceCommit']==REFERENCE_COMMIT,'Independent expectation identity changed')
        require(reference['expectedOutputsDerivedFromNativeResults'] is False and reference['originalSourceModified'] is False,'Extension expectations were copied from native results')
        for key in ['newHostRuns','newActionsDispatched','newCompletedLevels']:require(reference[key]==0,'Controlled contract query was promoted to a game result')
        for item in reference['actualInputEvidence'].values():check_file(item)
        qualification=value['qualification']
        require(qualification['nativeExpectedResultsUsed'] is False and qualification['unchangedOriginalAgentCapabilityClaimed'] is False
            and qualification['gameHostRun'] is False and qualification['verifyExecutesNativeCode'] is False,'Extension comparison overclaims its scope')
        require(qualification['newPhysicalActions']==qualification['newCompletedLevels']==0 and qualification['controlledRestoredMemoryNotColdCampaignInput'] is True,'Controlled restored memory was mislabeled as cold evaluation')
        allowed=set(qualification['onlyExplicitSrcWorkflowAnnotationsExcluded'])
        require(allowed=={'all_executed_statements','instruction_quantum','instructions','trace','execution_engine','reference_commit','reference_semantic_hash','native_execution_hash','source_definition_hash','edited'},'Extension SRC annotation boundary changed')
        require(all((row['path'].endswith('.workflow') or row['path'].endswith('.source_choice_workflow')) and set(row['fields'])<=allowed for row in value['srcReceiptAnnotations']),'Extension annotations excluded outside explicit SRC workflow receipts')
        if kind=='phased':
            require(value['summary']['stationaryReceipts']==3 and value['summary']['phasedDirectedOnlyReceipts']==1 and value['summary']['originalSrcRecordProjections']==4,'Actual public packet17 extension contracts changed')
            observed=reference['expected']['phased_directed_only']['rows'][0]
            require(observed['facts']['framed_replacement_tracking_lineage_agrees'] is False and observed['packet_witness']['original_directionless_candidate_eligible'] is False,'Contextual appearance was promoted to original identity or eligibility')
        else:
            require(value['summary']['controlledQueries']==4 and [row['afterActualAction'] for row in value['summary']['queries']]==[9,17,49,51],'Directed controlled checkpoint inventory changed')
        # Recompute source expectations only. The native outputs above are a
        # separately retained actual helper execution on this exact freeze.
        run=subprocess.run([sys.executable,str(generator),'--kind',kind,'--directory',str(OUT.relative_to(ROOT)),'--verify'],cwd=ROOT,capture_output=True)
        require(run.returncode==0,'Independent extension contract recomputation failed: '+kind+'\n'+run.stdout.decode()[-3000:]+run.stderr.decode()[-3000:])
        results[kind]={'comparison':proof(path),'reference':proof(reference_path),'retainedNativeOutput':proof(native_path),'summary':value['summary']}
    return {'comparisons':results,'sourceRecomputations':2,'newGameHostRuns':0,'newPhysicalActions':0,'newCompletedLevels':0,
        'qualification':'Separate frozen helper comparisons of actual retained public inputs. Their restored checkpoint queries validate component construction and guards, never a new cold campaign or a solved level.'}

def compare_diagnostic_component(checkpoint,journal):
    """Replay only the unchanged isolated component, never the failing caller search."""
    spec=importlib.util.spec_from_file_location('v52_diagnostic_component',ROOT/'scripts/compare-v52-framed-public-evidence.py')
    component=importlib.util.module_from_spec(spec);spec.loader.exec_module(component)
    first=next(prefix['framedTransfer'] for prefix in checkpoint['prefixes'] if prefix.get('framedTransfer'))
    match=component.OBSERVATION_REF.fullmatch(first['proposal']['binding']['observation_ref']);require(match is not None,'Diagnostic observation namespace is missing')
    observations=[component.observe(component.SimpleNamespace(**item['packet']),index+1,match.group(1))[0] for index,item in enumerate(journal)]
    family=component.FramedTransfer();cursor=boundary=events=bindings=selected=0;states=[];receipts=[]
    for prefix_index,prefix in enumerate(checkpoint['prefixes']):
        before=observations[cursor];packet=journal[cursor]['packet'];captured=prefix.get('framedTransfer');proposal=None
        if captured:
            remaining=checkpoint['budget']['levelActionCaps'][before['level_epoch']-1]-(cursor-boundary)
            if prefix['selectionGroup']=='window_constraints':
                require(prefix['fieldSubquestion']=='observed_framed_analogy','Diagnostic entry identity changed')
                proposal=family.analogy(before,packet['frame_rows'],[],remaining)
            else:
                require(prefix['selectionGroup']=='factored_material_return' and prefix['materialSubquestion']=='observed_framed_transfer','Diagnostic entry identity changed')
                proposal=family.propose(before,packet['frame_rows'],[],remaining)
            require(proposal is not None and prefix['family']=='public_framed_transfer','Original component did not reproduce the diagnostic proposal')
            family.bind(proposal,None);extra=set(captured['proposal'])-set(proposal)
            require(extra<=component.WRAPPER_KEYS and not(set(proposal)-set(captured['proposal'])),'Diagnostic provider field inventory changed')
            component.own_check({key:value for key,value in captured['proposal'].items() if key not in extra},proposal,f'diagnostic.provider.{prefix_index}');selected+=1
        retained=prefix['framedAcquisition'];acquired=retained['acquired'];offset=binding_offset=0
        require(retained['stateNode']=='family_state:public_framed_transfer' and retained['checkpointFormat']=='native.public_framed_transfer.v1','Diagnostic acquisition owner changed')
        for index in range(prefix['acquiredActions']):
            first,second=journal[cursor]['packet'],journal[cursor+1]['packet'];before,after=observations[cursor:cursor+2];command=journal[cursor+1]['command']
            if proposal:
                component.own_check(command,proposal['actions'][index],f'diagnostic.command.{cursor+1}')
                guard=family.before(proposal,index,component.SimpleNamespace(**first),before)
                if not guard['admitted']:
                    expected=component.current_binding_receipt(family,proposal,first,before,guard)
                    binding=prefix.get('nativeBindings',[])[binding_offset];binding_offset+=1;bindings+=1
                    require(binding['index']==index and binding['observation_ref']==before['observation_ref'] and binding['evidence_node']=='reasoning:binding:'+str(before['revision']),'Diagnostic binding evidence changed')
                    component.check(binding['command'],command,f'diagnostic.extension.command.{cursor+1}')
                    component.check(binding['native_binding_receipt'],expected,f'diagnostic.extension.receipt.{cursor+1}')
                    retained_guard=binding['retainedGuard']
                    for key in ['observation_ref','level_epoch','frame_hash']:require(retained_guard[key]==before[key],'Diagnostic retained binding is stale')
                    component.check(retained_guard['command'],command,f'diagnostic.extension.retained.command.{cursor+1}')
                    component.check(retained_guard['guard'],{'admitted':True,'reason':'native_current_framed_point_witness_bound','native_binding_receipt':expected},f'diagnostic.extension.retained.guard.{cursor+1}')
                    receipts.append({'actionIndex':cursor+1,'sourceGuard':guard,'nativeBindingReceipt':expected})
            observed=family.record(before,after,command,first['frame_rows'],second['frame_rows'],proposal,index)
            if observed is not None:
                fact=acquired[offset];offset+=1;events+=1
                require(fact['key']=='framed_transfer_event:'+str(prefix['decisionRevision']+index) and fact['evidence']==after['observation_ref'] and fact['revision']==after['revision'],'Diagnostic acquisition evidence changed')
                component.own_check(fact['result'],observed,f'diagnostic.acquisition.{cursor+1}')
            cursor+=1
            if after['levels_completed']>before['levels_completed']:boundary=cursor
        require(offset==len(acquired) and binding_offset==len(prefix.get('nativeBindings',[])),'Diagnostic acquisition or extension was omitted')
        states.append(component.own_check(retained['sourceState'],family.state(),f'diagnostic.state.{prefix_index}'))
    require(cursor==16 and component.helper.verify_source_manifest()==component.helper.VERIFIED_PINNED_SOURCE,'Diagnostic component replay omitted a transition or changed source')
    return {'sourceComponent':'FramedTransfer','publicTransitionsCompared':cursor,'selectedProposalsCompared':selected,'ownEventsCompared':events,
            'completeStatesCompared':len(states),'stateSha256':states,'nativeBindingExtensions':bindings,'explicitGuardDifferences':receipts,
            'pinnedSourceFilesVerifiedBeforeAndAfter':1786,'sourceModified':False,'originalCallerSearchRun':False,'gameHostRun':False,'nativeAgentRun':False}

def validate_failures_and_diagnostic():
    attempts=[]
    for n in [1,2,3]:
        execution_path=HISTORY/f'logs/execution-gare-attempt{n}.json';execution=read(execution_path);source=read(HISTORY/f'source-manifest-attempt{n}.json')
        source_manifest_only(source);validate_execution(execution,source,execution['exitCode'])
        require(execution['exitCode']!=0,'A failed attempt was reclassified as successful')
        row={'attempt':n,'execution':proof(execution_path),'sourceManifest':proof(HISTORY/f'source-manifest-attempt{n}.json'),'exitCode':execution['exitCode']}
        if n<3:
            report_path,trace_path=HISTORY/f'gare-three-levels-attempt{n}.json',HISTORY/f'gare-public-trace-attempt{n}.json.gz'
            report=read(report_path);require(execution['report']==proof(report_path) and execution['trace']==proof(trace_path),'Failed evidence was relinked')
            require(report['status']!='passed' and report['source']==source and report['sourceUnchangedDuringRun'] is True,'Failed attempt source or classification changed')
            summary=validate_trace(report,trace_path,source['digest'])
            row.update(report=proof(report_path),trace=proof(trace_path),actions=report['final']['actions'],levelsCompleted=report['final']['levelsCompleted'],**summary)
            if n==1:require(row['actions']==0 and row['levelsCompleted']==0 and summary['completePublicPackets']==1,'Initialization failure gained game progress')
            else:
                require(row['actions']==12 and row['levelsCompleted']==1 and report['final']['reason']=='no_admissible_prefix','Strict failed attempt changed')
                original=read(ROOT/'tests/fixtures/v6-framed-transfer-original-public.json.gz');packets=read(trace_path)['packets']
                require(len(packets)==len(original['packets'])==13,'Strict attempt omitted a packet')
                require(all(a['packet']==b['packet'] and a['command']==b['command'] for a,b in zip(packets,original['packets'])),'Strict source and native failure differ')
        else:
            require(execution.get('report') is None and execution.get('trace') is None,'OOM acquired a fabricated final report')
            text=gzip.decompress(check_file(execution['output']).read_bytes()).decode();require('heap out of memory' in text,'OOM failure log changed')
            entries=[]
            for line in text.splitlines():
                try:entries.append(json.loads(line))
                except json.JSONDecodeError:pass
            progressed=[item for item in entries if item.get('phase')=='sealed_prefix']
            require(progressed and progressed[-1]['levelsCompleted']==2 and progressed[-1]['totalActions']==16,'Retained OOM progress changed')
            row.update(actionsObservedInLog=16,levelsObservedInLog=2,finalCampaignReportAvailable=False)
        attempts.append(row)
    previous_source=read(HISTORY/'source-manifest.json');source_manifest_only(previous_source)
    require(previous_source['digest']==FAILED_SOURCE_DIGEST and previous_source['fileCount']==177,'Fourth failed source snapshot changed')
    execution_path=HISTORY/'logs/execution-gare.json';execution=read(execution_path);validate_execution(execution,previous_source,1)
    report_path,trace_path=HISTORY/'gare-three-levels.json',HISTORY/'gare-public-trace.json.gz';report=read(report_path)
    validate_report(report,previous_source,'failed');packet_summary=validate_trace(report,trace_path,previous_source['digest'])
    require(report['game']=='GARE' and report['targetLevels']==3 and report['final']['levelsCompleted']==2 and report['final']['actions']==77 and report['final']['reason']=='level_active_time_budget' and report['failure'],'The fourth failed target was reclassified')
    require(execution['report']==proof(report_path) and execution['trace']==proof(trace_path),'Fourth failed evidence was relinked')
    fourth_comparison_path=HISTORY/'gare-attempt4-original-component-comparison.json';fourth=read(fourth_comparison_path)
    require(fourth['status']=='passed' and fourth['qualification']['nativeCampaignStatus']=='failed' and fourth['qualification']['nativeTargetReached'] is False and fourth['nativeSourceDigest']==FAILED_SOURCE_DIGEST,'Fourth component comparison overclaims the failed campaign')
    for item in fourth['inputs'].values():check_file(item)
    check_file(fourth['generator']);fourth_recipes=read(check_file(fourth['identityEvidence']))
    require(identity_recipes(fourth_recipes['recipes'])==fourth['identityRecipeCount']==1675,'Fourth identity evidence changed')
    require(len(fourth['transitionChecks'])==77 and len(fourth['providerChecks'])==62 and len(fourth['nativeGuardExtensions'])==1,'Fourth component comparison scope changed')
    attempts.append({'attempt':4,'execution':proof(execution_path),'sourceManifest':proof(HISTORY/'source-manifest.json'),'exitCode':1,
                     'report':proof(report_path),'trace':proof(trace_path),'actions':77,'levelsCompleted':2,**packet_summary,
                     'originalComponentComparison':proof(fourth_comparison_path),'sourceProposalsCompared':62,'sourceTransitionsCompared':77,'identityRecipes':1675})
    comparison_path=HISTORY/'gare-strict-attempt-comparison.json';comparison=read(comparison_path)
    require(comparison['status']=='passed' and comparison['sameCommands']==12 and comparison['sameCompletePublicPackets']==13 and comparison['originalFullCallerParity'] is False,'Strict failure comparison changed')
    for item in comparison['inputs'].values():check_file(item)
    diagnostic_path=HISTORY/'diagnostic-memory/execution.json';diagnostic=read(diagnostic_path)
    require(diagnostic['schema']=='logos-engine.v52.instrumented-memory-diagnostic.v1' and diagnostic['exitCode']!=0 and diagnostic['nativeSourceUnchanged'] is True and diagnostic['nativeSource']==diagnostic['nativeSourceAfter'],'Instrumented diagnostic changed')
    check_file(diagnostic['generator']);check_file(diagnostic['harness'])
    for item in diagnostic['evidence'].values():check_file(item)
    journal=[json.loads(line) for line in gzip.decompress(check_file(diagnostic['evidence']['journal']).read_bytes()).decode().splitlines()]
    checkpoint=read(check_file(diagnostic['evidence']['checkpoint']))
    require(len(journal)==17 and len(checkpoint['actions'])==len(checkpoint['prefixes'])==16 and checkpoint['status']=='running' and 'final' not in checkpoint,'Partial diagnostic was expanded into a completed campaign')
    for index,item in enumerate(journal):
        require(set(item['packet'])==PUBLIC_FIELDS and item['packet']['step_index']==index,'Diagnostic journal contains nonpublic fields or skipped return')
        if index:
            action=checkpoint['actions'][index-1];require(item['command']==action['command'] and packet_hash(item['packet'])==action['publicPacketSha256'],'Diagnostic complete return differs from acquired action')
    require(journal[-1]['packet']['levels_completed']==2 and journal[-1]['packet']['level']==3 and checkpoint['prefixes'][-1]['callerAcquiredTransitions']==16,'Diagnostic lost its exact acquired progress')
    fourth_packets=read(trace_path)['packets']
    require(journal==fourth_packets[:len(journal)],'Fourth campaign no longer shares the independently retained diagnostic public prefix')
    source_replay=compare_diagnostic_component(checkpoint,journal)
    measured_path=HISTORY/'diagnostic-memory/reduction-scene-original.json';measured=read(measured_path)
    require(measured['sourceModified'] is False and measured['routeCalls']==measured['proposeCalls']==measured['hostRuns']==0 and measured['unchangedSourceCalls']=={'layout':1,'scan':1},'Read-only reduction measurement ran a search or game')
    check_file(measured['generator']);check_file(measured['input'])
    require(measured['sceneCounts']=={'floor':114,'pegs':109,'carriers':0,'rails':0,'edges':0},'Original reduction scene counts changed')
    require(measured['invariants']['componentInvariantExcludesOnePeg'] is False and measured['invariants']['parityInvariantExcludesOnePeg'] is False,'Unproved impossibility was introduced')
    require(measured['measurementCoherence']['uniformFloorCells']==measured['measurementCoherence']['uniformFloorCellsAlsoMarkedAsPegs']==105,'Original scanner alias evidence changed')
    return {'failedAttempts':attempts,'strictSourceFailureComparison':proof(comparison_path),'instrumentedDiagnostic':proof(diagnostic_path),
            'diagnosticCompletePublicPackets':17,'diagnosticAcquiredTransitions':16,'diagnosticLevelsCompleted':2,'diagnosticPrefixMatchesFourthAttemptPublicPackets':17,
            'diagnosticOriginalComponentReplay':source_replay,'sourceReductionMeasurement':proof(measured_path),
            'qualification':'Initialization failure, strict uniqueness refusal, OOM and the fourth active-time-budget failure are preserved separately. The instrumented journal ends after sixteen acquired public returns and two levels, with no final success report. Its reduction invariants do not prove a one-peg goal impossible. The fourth target-three campaign remains failed after seventy-seven acquired actions and two levels.'}

def validate_tests(source,base=OUT,archive=None):
    path=base/'validation/delta-tests-run.json';tests=read(path);validate_execution(tests,source,archive=archive)
    require(tests['schema']=='logos-engine.v52.actual-delta-tests.v1' and tests['status']=='passed' and tests['sourceAndTestInputsUnchanged'] is True,'Delta execution failed')
    generator='scripts/run-v52-final-delta-tests.py' if base==OUT else 'scripts/run-v52-delta-tests.py'
    tree=ast.parse(archive[generator].decode() if archive is not None else (ROOT/generator).read_text());declared=None
    for node in tree.body:
        if isinstance(node,ast.Assign) and any(isinstance(target,ast.Name) and target.id=='FILES' for target in node.targets):declared=ast.literal_eval(node.value)
    required_tests=set(CORE_TESTS)|{'tests/v6-reduction-transport-parity.test.ts','tests/v6-reduction-search-bound.test.ts'}
    if base==OUT:required_tests|={'tests/v6-framed-public-packet.test.ts','tests/v6-framed-uniform-questions.test.ts',
                               'tests/v6-framed-transfer-phased-receptions.test.ts','tests/v6-framed-directed-composition.test.ts'}
    require(declared==tests['testFiles'] and len(declared)==len(set(declared))==tests['testFileCount']==len(required_tests) and set(declared)==required_tests,'Delta test inventory changed or an affected gate is missing')
    require(tests['command']==['node','--test','--test-concurrency=1','--test-reporter=tap',*declared],'Delta invocation changed')
    if archive is None:require(set(tests['sourceAndTestInputs'])==file_inventory(['src','tests']),'Delta source/test/fixture inventory changed')
    else:
        code={name for name in archive if name.startswith('src/') or (name.startswith('tests/') and not name.startswith('tests/fixtures/'))}
        expected={name for name in tests['sourceAndTestInputs'] if not name.startswith('tests/fixtures/')}
        require(code<=expected and all(name.startswith('src/') and name.endswith('.css') for name in expected-code),'Historical source/test code inventory differs from checkpoint')
        require(len(declared)==19,'Historical targeted inventory changed')
    archived_map(tests['sourceAndTestInputs'],archive)
    counts,text=tap_counts(tests['output']);require(counts==tests['counts'],'TAP summary differs from actual output')
    names=[];ancestry=[]
    for match in re.finditer(r'^( *)# Subtest: (.+)$',text,re.M):
        indent,name=len(match.group(1)),match.group(2)
        while ancestry and ancestry[-1][0]>=indent:ancestry.pop()
        ancestry.append((indent,name));names.append(tuple(item[1] for item in ancestry))
    results=len(re.findall(r'^\s*ok \d+ - ',text,re.M));top=len(re.findall(r'^ok \d+ - ',text,re.M));plans=re.findall(r'^1\.\.(\d+)\s*$',text,re.M)
    require(len(names)==len(set(names))==results==counts['tests'] and len(plans)==1 and int(plans[0])==top,'TAP identities or root plan changed')
    return {'receipt':proof(path),'counts':counts,'testFiles':len(declared),'topLevelTests':top,'nestedTests':results-top,'sourceAndTestInputsUnchanged':True,
            'qualification':'One frozen targeted execution; counts and unique scoped identities are recomputed from the retained complete TAP log. This is not the historical full suite.'}

def validate_regressions(source,base=OUT,archive=None):
    paths=[base/name for name in ['regression-plan.json','regression-verification.json','regression-summary.json']]
    plan,verification,summary=map(read,paths)
    for value,name in zip([plan,verification,summary],['regression-plan','regression-verification','regression-summary']):require(value['schema']=='logos-engine.v52.'+name+'.v1','Regression schema changed')
    require(summary['passed'] is True and verification['passed'] is True and verification['nativeSourceUnchangedBeforeAfterAllRuns'] is True and verification['nativeSourceBeforeAllRuns']==verification['nativeSourceAfterAllRuns']==source,'Regression execution or freeze failed')
    require(plan['nativeSourceManifest']==proof(base/'source-manifest.json') and plan['nativeSourceManifestDigest']==summary['sourceDigest']==source['digest'] and plan['nativeSourceFiles']==summary['nativeSourceFiles']==source['fileCount'],'Regression source changed')
    require(summary['verification']==proof(paths[1]) and summary['plan']==verification['plan']==proof(paths[0]),'Regression summary inputs changed')
    archived_file(verification['generator'],archive);archived_map(plan['harnessFileSha256'],archive)
    require(len(plan['runs'])==len(verification['runs'])==len(summary['results'])==len(GAMES),'Eight replays are required')
    totals=Counter();rows=[]
    for game,planned,record,item in zip(GAMES,plan['runs'],verification['runs'],summary['results']):
        require(planned['game']==record['game']==item['game']==game and planned['mode']==record['mode']==item['mode']=='recorded-public-replay','Regression identity or scope changed')
        require(record['passed'] is True and item['passed'] is True and record['modeMatchesPlan'] is True and record['reportSourceMatchesFreeze'] is True and record['sourceUnchangedDuringRun'] is True and record['pythonAgentModules']==[],'Regression failed its execution contract')
        require(read(ROOT/planned['executionReceipt'])==record,'Replay receipt changed')
        baseline=read(check_file(planned['baseline']));current=read(check_file(record['report']));validate_report(current,source)
        require(current['schema']=='logos-engine.v6.recorded-public-regression.v1' and current['game']==game and current['initial']==baseline['initial'],'Recorded replay was labeled as live or changed its initial input')
        actions=lambda values:[{k:v for k,v in row.items() if k!='executionMs'} for row in values]
        require(actions(current['actions'])==actions(baseline['actions']),'Recorded commands, complete packets or primitive boundaries changed: '+game)
        commands,prefixes=len(current['actions']),len(current['prefixes']);expected={'commands':commands,'completePublicPackets':commands+1,'prefixes':prefixes}
        require(commands==planned['expectedCommands'] and prefixes==planned['expectedPrefixes'] and commands+1==planned['expectedCompletePublicPackets'],'Replay counts changed')
        require(current['final']==record['final'] and item['actions']==commands and item['prefixes']==prefixes and item['levelsCompleted']==current['targetLevels'] and item['state']==current['final']['state'],'Replay summary changed')
        require(item['report']==record['report']==proof(ROOT/planned['report']),'Replay output identity changed')
        replay=current['recordedPublicReplay'];require(replay['trace']=={k:planned['recordedTrace'][k] for k in ['path','sha256']} and replay['baseline']=={k:planned['baseline'][k] for k in ['path','sha256']},'Recorded replay inputs changed')
        validate_trace(current,check_file(planned['recordedTrace']));validate_execution(record['execution'],source,archive=archive)
        require(record['execution']['command']==planned['command'] and record['execution']['harnessFileSha256']==plan['harnessFileSha256'],'Replay harness changed')
        require(len(record['comparisonAttempts'])==1,'Additional comparison attempts require explicit review')
        attempt=record['comparisonAttempts'][0];require(read(check_file(attempt['receipt']))=={k:v for k,v in attempt.items() if k!='receipt'},'Comparison attempt receipt changed')
        validate_execution(attempt,source,archive=archive);checked=read(check_file(attempt['result']))
        require(checked['schema']=='logos-engine.v52.public-regression-comparison.v1' and checked['passed'] is True and all(row['passed'] is True for row in checked['checks']),'A public replay comparison failed')
        require(attempt['passed'] is True and attempt['failedChecks']==[] and attempt['checks']==len(checked['checks']) and attempt['command']==planned['comparisonCommand'],'Comparison execution disagrees with assertions')
        require(checked['compared']==attempt['compared']==expected and item['comparison']==attempt['result']==proof(ROOT/planned['comparison']),'Comparison scope or inputs changed')
        check_file(checked['before']);check_file(checked['after'])
        logged=json.loads(gzip.decompress(check_file(attempt['output']).read_bytes()).decode().splitlines()[-1]);require(logged=={'passed':True,'checks':len(checked['checks']),'compared':expected,'failed':[]},'Comparison log changed')
        if game=='LIFE':
            material=checked['typedMaterialComparison'];recipes=read(check_file(material['recipes']))
            require(material['recipes']['verified']==len(recipes['recipes'])==328 and material['before']==material['after']=={'proposals':44,'events':68,'explicitNegativeZeroPaths':14},'LIFE independent numeric recipe evidence changed')
        else:require('typedMaterialComparison' not in checked,'Unrelated replay acquired material proof claims')
        for key,value in expected.items():totals[key]+=value
        totals['comparisonChecks']+=len(checked['checks']);rows.append({'game':game,**expected,'comparisonChecks':len(checked['checks']),'levelsCompleted':current['final']['levelsCompleted'],'officialState':current['final']['state']})
    groups=[{'mode':'recorded-public-replay','runs':len(GAMES),'passed':True,**dict(totals),'games':GAMES},
            {'mode':'actual-game-campaign','runs':0,'passed':True,'commands':0,'completePublicPackets':0,'prefixes':0,'comparisonChecks':0,'games':[]}]
    require(summary['groups']==groups,'Replay aggregate differs from recomputed retained counts')
    return {'summary':proof(paths[2]),'groups':groups,'results':rows,'qualification':'Eight cold native recalculations consume previously retained complete public returns. They are regressions, not eight new live victories or speed comparisons.'}

def validate_archived_snapshot():
    path=HISTORY/'history/c227-source-test-code.json';snapshot=read(path)
    require(snapshot['schema']=='logos-engine.v52.before-reception-code-snapshot.v1' and snapshot['nativeSourceDigest']==FAILED_SOURCE_DIGEST,'Historical code snapshot identity changed')
    archive_path=check_file(snapshot['archive']);archive={}
    with tarfile.open(archive_path,'r:gz') as handle:
        for member in handle.getmembers():
            require(member.isfile() and not Path(member.name).is_absolute() and '..' not in Path(member.name).parts,'Historical archive contains a non-file or invalid path')
            require(member.name not in archive,'Historical archive contains duplicate paths')
            data=handle.extractfile(member).read();archive[member.name]=data
            require(snapshot['files'].get(member.name)=={'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)},'Historical archived bytes changed: '+member.name)
    require(set(archive)==set(snapshot['files']) and len(archive)==snapshot['fileCount']==504,'Historical archive inventory changed')
    source=read(HISTORY/'source-manifest.json');source_manifest_only(source)
    require(source['digest']==FAILED_SOURCE_DIGEST and source['fileCount']==177,'Historical freeze changed')
    archived_map(source['files'],archive)
    tests=validate_tests(source,HISTORY,archive);regressions=validate_regressions(source,HISTORY,archive)
    return {'checkpoint':proof(path),'archive':snapshot['archive'],'archivedCodeFiles':len(archive),'nativeSourceDigest':source['digest'],
            'deltaTests':tests,'regressions':regressions,'currentMutableNativeCodeUsedForHistoricalChecks':False,
            'qualification':'Historical c227 native source, test code and harness bytes are read from the exact retained archive. Their unchanged styles, previously generated fixtures and execution logs are byte-verified at their original paths. These 686 tests and eight recorded-public replays validate the failed-attempt snapshot only; they are not reused as validation of the later final source.'}

def validate_packet_only_snapshot():
    path=HISTORY/'history/686159-source-test-code.json';snapshot=read(path)
    require(snapshot['schema']=='logos-engine.v52.before-untyped-inquiry-code-snapshot.v1' and snapshot['nativeSourceDigest']==PACKET_ONLY_SOURCE_DIGEST,'Packet-only historical snapshot changed')
    archive_path=check_file(snapshot['archive']);archive={}
    with tarfile.open(archive_path,'r:gz') as handle:
        for member in handle.getmembers():
            require(member.isfile() and not Path(member.name).is_absolute() and '..' not in Path(member.name).parts and member.name not in archive,'Invalid packet-only archive member')
            data=handle.extractfile(member).read();archive[member.name]=data
            require(snapshot['files'].get(member.name)=={'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)},'Packet-only archived bytes changed: '+member.name)
    require(set(archive)==set(snapshot['files']) and len(archive)==snapshot['fileCount']==508,'Packet-only archive inventory changed')
    source=read(PREVIOUS_FINAL/'source-manifest.json');source_manifest_only(source)
    require(source['digest']==PACKET_ONLY_SOURCE_DIGEST and source['fileCount']==178,'Packet-only failed freeze changed')
    archived_map(source['files'],archive)
    report_path=PREVIOUS_FINAL/'gare-three-levels.json';trace_path=PREVIOUS_FINAL/'gare-public-trace.json.gz';execution_path=PREVIOUS_FINAL/'logs/execution-gare.json'
    report,execution=read(report_path),read(execution_path)
    validate_report(report,source,'failed');validate_execution(execution,source,1,archive)
    packets=validate_trace(report,trace_path,source['digest'])
    require(report['game']=='GARE' and report['targetLevels']==3 and report['final']['actions']==80 and report['final']['levelsCompleted']==2 and report['final']['reason']=='level_active_time_budget','Packet acquisition alone was mislabeled as a successful target')
    require(execution['report']==proof(report_path) and execution['trace']==proof(trace_path),'Packet-only failed evidence was relinked')
    checkpoints=[prefix['framedAcquisition']['nativeCheckpoint'] for prefix in report['prefixes']]
    require(all(row['format']=='native.public_framed_transfer.v2' and set(row['source_state'])=={'epoch','spans','receipts','attempts','portable','last'} for row in checkpoints),'Packet-only source/annex boundary changed')
    maximum=max(len(row['public_packet_receptions']['receipts']) for row in checkpoints)
    used=sum('native_public_packet_reception' in prefix.get('framedTransfer',{}).get('proposal',{}).get('framed_transfer_plan',{}) for prefix in report['prefixes'])
    lkey_execution_path=PREVIOUS_FINAL/'logs/execution-lkey.json';lkey_execution=read(lkey_execution_path)
    validate_execution(lkey_execution,source,1,archive)
    lkey_path,lkey_trace_path=check_file(lkey_execution['report']),check_file(lkey_execution['trace']);lkey=read(lkey_path)
    validate_report(lkey,source,'failed');lkey_packets=validate_trace(lkey,lkey_trace_path,source['digest'])
    require(lkey['game']=='LKEY' and lkey['targetLevels']==3 and lkey['final']['actions']==98 and lkey['final']['levelsCompleted']==0 and lkey['final']['reason']=='level_active_time_budget','LKEY alternative attempt was reclassified')
    original_lkey=read(ROOT/'tests/fixtures/v6-framed-transfer-original-lkey-public.json.gz');actual_lkey=read(lkey_trace_path)['packets'];matched=0
    for original,actual in zip(original_lkey['packets'],actual_lkey):
        if original['command']!=actual['command'] or original['packet']!=actual['packet']:break
        matched+=1
    return {'checkpoint':proof(path),'archive':snapshot['archive'],'archivedCodeFiles':len(archive),'nativeSourceDigest':source['digest'],
            'failedCampaign':{'report':proof(report_path),'trace':proof(trace_path),'execution':proof(execution_path),'actions':80,'levelsCompleted':2,**packets},
            'failedAlternativeCampaign':{'game':'LKEY','report':proof(lkey_path),'trace':proof(lkey_trace_path),'execution':proof(lkey_execution_path),
                'actions':98,'levelsCompleted':0,**lkey_packets,'commonOriginalFailurePublicPackets':matched},
            'maximumCurrentPacketReceipts':maximum,'selectedProposalsUsingPacketPremises':used,
            'qualification':'The separately preserved packet-acquisition implementation fails the GARE target at eighty actions and two levels, and its alternative cold LKEY attempt fails at ninety-eight actions with no completed level. Recorded observations do not imply useful plan selection or a completed level. No later targeted suite or successful campaign is attributed to this source snapshot.'}

def validate_uniform_question_snapshot():
    path=HISTORY/'history/a076-source-test-code.json';snapshot=read(path)
    require(snapshot['schema']=='logos-engine.v52.before-uniform-collision-code-snapshot.v1' and snapshot['nativeSourceDigest']==UNIFORM_SOURCE_DIGEST,'First uniform-question historical snapshot changed')
    archive_path=check_file(snapshot['archive']);archive={}
    with tarfile.open(archive_path,'r:gz') as handle:
        for member in handle.getmembers():
            require(member.isfile() and not Path(member.name).is_absolute() and '..' not in Path(member.name).parts and member.name not in archive,'Invalid first uniform-question archive member')
            data=handle.extractfile(member).read();archive[member.name]=data
            require(snapshot['files'].get(member.name)==hashlib.sha256(data).hexdigest(),'First uniform-question archived bytes changed: '+member.name)
    require(set(archive)==set(snapshot['files']) and len(archive)==snapshot['fileCount']==517,'First uniform-question archive inventory changed')
    source=read(PREVIOUS_UNIFORM/'source-manifest.json');source_manifest_only(source)
    require(source['digest']==UNIFORM_SOURCE_DIGEST and source['fileCount']==179,'First uniform-question failed freeze changed')
    archived_map(source['files'],archive)
    report_path=PREVIOUS_UNIFORM/'gare-three-levels.json';trace_path=PREVIOUS_UNIFORM/'gare-public-trace.json.gz';execution_path=PREVIOUS_UNIFORM/'execution-gare.json'
    report,execution=read(report_path),read(execution_path)
    validate_report(report,source,'failed');validate_execution(execution,source,1,archive)
    packets=validate_trace(report,trace_path,source['digest'])
    require(report['game']=='GARE' and report['targetLevels']==3 and report['final']['actions']==87 and report['final']['levelsCompleted']==2 and report['final']['reason']=='level_active_time_budget','First uniform-question attempt was mislabeled as a successful target')
    require(execution['report']==proof(report_path) and execution['trace']==proof(trace_path),'First uniform-question failed evidence was relinked')
    checkpoints=[prefix['framedAcquisition']['nativeCheckpoint'] for prefix in report['prefixes']]
    require(all(row['format']=='native.public_framed_transfer.v2' and set(row['source_state'])=={'epoch','spans','receipts','attempts','portable','last'} for row in checkpoints),'First uniform-question source/annex boundary changed')
    require(all(prefix['framedAcquisition']['sourceState']==prefix['framedAcquisition']['nativeCheckpoint']['source_state'] for prefix in report['prefixes']),'First uniform-question source checkpoint differs from its explicit source view')
    selection_counts=Counter()
    for prefix in report['prefixes']:
        coordination=prefix.get('framedTransfer',{}).get('proposal',{}).get('framed_transfer_plan',{}).get('native_uniform_reception_question')
        if coordination is not None:selection_counts[coordination['question']['kind']]+=1
    return {'checkpoint':proof(path),'archive':snapshot['archive'],'archivedCodeFiles':len(archive),'nativeSourceDigest':source['digest'],
            'failedCampaign':{'report':proof(report_path),'trace':proof(trace_path),'execution':proof(execution_path),
                'actions':len(report['actions']),'levelsCompleted':report['final']['levelsCompleted'],**packets},
            'selectedNativeQuestionKinds':dict(sorted(selection_counts.items())),
            'maximumCurrentPacketReceipts':max(len(row['public_packet_receptions']['receipts']) for row in checkpoints),
            'formalDeltaSuiteAttributed':False,'recordedPublicRegressionSuiteAttributed':False,
            'qualification':'The separately preserved first uniform-question implementation fails the GARE target at eighty-seven actions and two levels. Its subsequent physical-point ambiguity correction and later typed dependency work are not part of this archived source. No later test suite, recorded-public regression suite, complete component comparison or successful campaign is attributed to this snapshot.'}

def validate_typed_priority_snapshot():
    path=HISTORY/'history/2d1295-source-test-code.json';snapshot=read(path)
    require(snapshot['schema']=='logos-engine.v52.before-typed-priority-review-code-snapshot.v1' and snapshot['nativeSourceDigest']==TYPED_PRIORITY_SOURCE_DIGEST,'Typed-priority historical snapshot changed')
    archive_path=check_file(snapshot['archive']);archive={}
    with tarfile.open(archive_path,'r:gz') as handle:
        for member in handle.getmembers():
            require(member.isfile() and not Path(member.name).is_absolute() and '..' not in Path(member.name).parts and member.name not in archive,'Invalid typed-priority archive member')
            data=handle.extractfile(member).read();archive[member.name]=data
            require(snapshot['files'].get(member.name)==hashlib.sha256(data).hexdigest(),'Typed-priority archived bytes changed: '+member.name)
    require(set(archive)==set(snapshot['files']) and len(archive)==snapshot['fileCount']==519,'Typed-priority archive inventory changed')
    source=read(PREVIOUS_TYPED_PRIORITY/'source-manifest.json');source_manifest_only(source)
    require(source['digest']==TYPED_PRIORITY_SOURCE_DIGEST and source['fileCount']==179,'Typed-priority failed freeze changed')
    archived_map(source['files'],archive)
    report_path=PREVIOUS_TYPED_PRIORITY/'gare-three-levels.json';trace_path=PREVIOUS_TYPED_PRIORITY/'gare-public-trace.json.gz';execution_path=PREVIOUS_TYPED_PRIORITY/'execution-gare.json'
    report,execution=read(report_path),read(execution_path)
    validate_report(report,source,'failed');validate_execution(execution,source,1,archive)
    packets=validate_trace(report,trace_path,source['digest'])
    require(report['game']=='GARE' and report['targetLevels']==3 and report['final']['actions']==103 and report['final']['levelsCompleted']==1 and report['final']['reason']=='level_active_time_budget','Typed-priority regression was reclassified')
    require(execution['report']==proof(report_path) and execution['trace']==proof(trace_path),'Typed-priority failed evidence was relinked')
    actual=read(trace_path)['packets'];prior=read(PREVIOUS_UNIFORM/'gare-public-trace.json.gz')['packets'];matched=0
    for first,second in zip(prior,actual):
        if first!=second:break
        matched+=1
    require(matched==10 and prior[matched]['command']!=actual[matched]['command'],'First actual typed-priority trajectory difference changed')
    selection_counts=Counter();known_offset_overrides=0
    for prefix in report['prefixes']:
        retained=prefix['framedAcquisition'];checkpoint=retained['nativeCheckpoint']
        require(checkpoint['format']=='native.public_framed_transfer.v2' and set(checkpoint['source_state'])=={'epoch','spans','receipts','attempts','portable','last'} and retained['sourceState']==checkpoint['source_state'],'Typed-priority source/annex boundary changed')
        coordination=prefix.get('framedTransfer',{}).get('proposal',{}).get('framed_transfer_plan',{}).get('native_uniform_reception_question')
        if coordination is None:continue
        selection_counts[coordination['rule']]+=1
        known_offset_overrides+=coordination['rule']=='native.current_typed_reception_dependency' and coordination['source_choice'].get('projection_ref')=='projection.exploration.revalidated_point_motion_span_question'
    require(known_offset_overrides>0,'Retained typed-priority regression no longer contains its declared known-offset override')
    return {'checkpoint':proof(path),'archive':snapshot['archive'],'archivedCodeFiles':len(archive),'nativeSourceDigest':source['digest'],
            'failedCampaign':{'report':proof(report_path),'trace':proof(trace_path),'execution':proof(execution_path),
                'actions':len(report['actions']),'levelsCompleted':report['final']['levelsCompleted'],**packets},
            'firstDifferenceFromPreviousAttempt':{'commonCompletePublicPackets':matched,'commonCommands':matched-1,'actionIndex':matched,
                'previousCommand':prior[matched]['command'],'actualCommand':actual[matched]['command']},
            'selectedNativeRules':dict(sorted(selection_counts.items())),'typedQuestionsOverridingRevalidatedSourceControl':known_offset_overrides,
            'formalDeltaSuiteAttributed':False,'recordedPublicRegressionSuiteAttributed':False,'completeComponentComparisonAttributed':False,
            'qualification':'The retained first typed-prerequisite priority implementation regresses to one completed level and fails at103 actions. Its known-offset source question was replaced by an unknown-control typed calibration. This actual failed trajectory remains separate from the later generic precedence correction and any later validation.'}

def validate_pre_phased_snapshot():
    path=HISTORY/'history/0fb602-source-test-code.json';snapshot=read(path)
    require(snapshot['schema']=='logos-engine.v52.before-phased-reception-code-snapshot.v1' and snapshot['nativeSourceDigest']==PRE_PHASED_SOURCE_DIGEST,'Pre-phased historical snapshot changed')
    archive_path=check_file(snapshot['archive']);archive={}
    with tarfile.open(archive_path,'r:gz') as handle:
        for member in handle.getmembers():
            require(member.isfile() and not Path(member.name).is_absolute() and '..' not in Path(member.name).parts and member.name not in archive,'Invalid pre-phased archive member')
            data=handle.extractfile(member).read();archive[member.name]=data
            require(snapshot['files'].get(member.name)==hashlib.sha256(data).hexdigest(),'Pre-phased archived bytes changed: '+member.name)
    require(set(archive)==set(snapshot['files']) and len(archive)==snapshot['fileCount']==519,'Pre-phased archive inventory changed')
    source=read(PREVIOUS_SETTLED_PREPARATION/'source-manifest.json');source_manifest_only(source)
    require(source['digest']==PRE_PHASED_SOURCE_DIGEST and source['fileCount']==179,'Pre-phased failed freeze changed')
    archived_map(source['files'],archive)
    report_path=PREVIOUS_SETTLED_PREPARATION/'gare-three-levels.json';trace_path=PREVIOUS_SETTLED_PREPARATION/'gare-public-trace.json.gz';execution_path=PREVIOUS_SETTLED_PREPARATION/'execution-gare.json'
    report,execution=read(report_path),read(execution_path)
    validate_report(report,source,'failed');validate_execution(execution,source,1,archive)
    packet_summary=validate_trace(report,trace_path,source['digest'])
    require(report['game']=='GARE' and report['targetLevels']==3 and report['final']['actions']==86 and report['final']['levelsCompleted']==2 and report['final']['reason']=='level_active_time_budget','Pre-phased failed campaign was reclassified')
    require(execution['schema']=='logos-engine.v52.actual-journaled-campaign-execution.v1','Pre-phased campaign lost its streamed public journal')
    require(execution['report']==proof(report_path) and execution['trace']==proof(trace_path),'Pre-phased failed evidence was relinked')
    live_journal=ROOT.parent/'v52-attempt8-gare-actual-public-journal.jsonl'
    require(execution['command']==['node',str(ROOT/'scripts/run-v52-journaled-campaign.mjs'),'GARE','3',str(report_path),str(trace_path),str(live_journal)],'Pre-phased actual invocation changed')
    actual=read(trace_path)['packets'];journal_path=check_file(execution['publicJournal'])
    journal=[json.loads(line) for line in gzip.decompress(journal_path.read_bytes()).decode().splitlines()]
    require(journal==actual,'Pre-phased streamed journal differs from the complete actual public trace')
    final_log=json.loads(gzip.decompress(check_file(execution['output']).read_bytes()).decode().splitlines()[-1])
    require(final_log['status']=='failed' and final_log['sourceDigest']==source['digest'] and final_log['final']==report['final'] and final_log['boundaries']==report['boundaries'],'Pre-phased log differs from its failed report')
    selection_counts=Counter();typed_known_offset_overrides=0;maximum_annex_records=0
    for prefix in report['prefixes']:
        retained=prefix['framedAcquisition'];checkpoint=retained['nativeCheckpoint']
        require(checkpoint['format']=='native.public_framed_transfer.v2' and set(checkpoint['source_state'])=={'epoch','spans','receipts','attempts','portable','last'} and retained['sourceState']==checkpoint['source_state'],'Pre-phased source/annex boundary changed')
        annex=checkpoint['public_packet_receptions'];maximum_annex_records=max(maximum_annex_records,len(annex['receipts']))
        require(all(row.get('native_packet_witness',{}).get('schema')=='native.framed_public_packet_reception.v1' for row in annex['receipts']),'A later phased observation was inserted into the pre-phased campaign')
        coordination=prefix.get('framedTransfer',{}).get('proposal',{}).get('framed_transfer_plan',{}).get('native_uniform_reception_question')
        if coordination is None:continue
        selection_counts[coordination['rule']]+=1
        purely_typed=coordination['question'].get('basis_kind')=='current_typed_analogy_prerequisite'
        typed_known_offset_overrides+=purely_typed and coordination['source_choice'].get('projection_ref')=='projection.exploration.revalidated_point_motion_span_question'
    require(typed_known_offset_overrides==0,'The retained precedence correction overrides a known-offset source question with a purely typed calibration')
    return {'checkpoint':proof(path),'archive':snapshot['archive'],'archivedCodeFiles':len(archive),'nativeSourceDigest':source['digest'],
            'failedCampaign':{'report':proof(report_path),'trace':proof(trace_path),'execution':proof(execution_path),
                'actions':len(report['actions']),'levelsCompleted':report['final']['levelsCompleted'],**packet_summary},
            'passivePublicJournal':{'evidence':execution['publicJournal'],'completePublicPackets':len(journal),'equalsCompleteTrace':True,
                'runner':execution['runner'],'harness':execution['harness'],'executionCodeUnchanged':True},
            'selectedNativeRules':dict(sorted(selection_counts.items())),'maximumCurrentStationaryAnnexRecords':maximum_annex_records,
            'pureTypedQuestionsOverridingRevalidatedSourceControl':typed_known_offset_overrides,
            'formalDeltaSuiteAttributed':False,'recordedPublicRegressionSuiteAttributed':False,'completeComponentComparisonAttributed':False,
            'qualification':'The precedence correction restores two completed levels but the actual cold campaign still fails after eighty-six acquired actions. Its complete passive streamed public journal is preserved. Later phased reception observations, directed composition and their validation are not attributed to this archived source.'}

def validate_checks(source):
    path=OUT/'validation/checks-run.json';checks=read(path)
    require(checks['schema']=='logos-engine.v52.actual-release-checks.v1' and checks['status']=='passed' and checks['nativeSourceUnchanged'] is True and checks['nativeSource']==checks['nativeSourceAfter']==source and checks['nativeSourceManifestDigest']==source['digest'],'Build/check source changed')
    require([row['name'] for row in checks['checks']]==['typecheck','entry-audit','migration-audit','diff-check','build'],'Release check missing')
    check_file(checks['generator'])
    for row in checks['checks']:require(row['exitCode']==0,'Failed release check '+row['name']);check_file(row['output'])
    extras={'package.json','package-lock.json','vite.config.ts','tsconfig.json','index.html','.openai/hosting.json','scripts/prepare-python.mjs','scripts/python-runtime-assets.json','scripts/generate-content-pages.mjs','scripts/generate-game-gallery.mjs'}
    require(set(checks['buildInputs'])==file_inventory(['src','public','content'])|extras,'Build input inventory changed');check_map(checks['buildInputs'])
    worker=check_file(checks['nativeAgentWorker']);require(IMPLEMENTATION in worker.read_text(),'Built worker version differs')
    require(read(ROOT/'.openai/hosting.json')=={'project_id':PROJECT,'static':{'directory':'dist'}},'Hosting destination changed')
    return {'receipt':proof(path),'nativeAgentWorker':checks['nativeAgentWorker']}

def validate_progress():
    entry_path,coverage_path=ROOT/'docs/migration/v6-entry-point-progress.json',ROOT/'docs/migration/v6-coverage.json'
    progress,coverage=read(entry_path),read(coverage_path)
    require(progress['schema']=='logos-engine.v6.declared-entry-coverage.v1' and (progress['connected'],progress['declared'],progress['percent'],progress['implementation'])==(44,76,57.9,IMPLEMENTATION),'Entry progress changed')
    require(len(progress['groups'])==4 and progress['fullV6Parity'] is False,'Source denominator or parity claim changed')
    for group in progress['groups']:require(group['declared']==len(group['entries']) and group['connected']==sum(row['status']=='connected' for row in group['entries']),'Group counts disagree with entry statuses')
    require(sum(g['declared'] for g in progress['groups'])==76 and sum(g['connected'] for g in progress['groups'])==44,'Entry denominator changed')
    for name in ['observed_framed_transfer','observed_framed_analogy']:
        found=[row for group in progress['groups'] for row in group['entries'] if row['question']==name]
        require(found==[{'question':name,'family':'public_framed_transfer','status':'connected'}],'Two source entries do not share the connected owner')
    require(coverage['complete'] is False and len(coverage['completionGates'])==6 and all(value is False for value in coverage['completionGates'].values()),'Full migration was overclaimed')
    return {'connected':44,'declared':76,'percent':57.9,'metric':progress['metric'],'entryAudit':proof(entry_path),'migrationAudit':proof(coverage_path),
            'qualification':'Registered questions in four fixed source DRM lists. This percentage is not code-volume progress, a game success rate, full original caller parity or complete migration.'}

def validate_cold():
    path=HISTORY/'cold-start-v51.json';cold=read(path);previous=read(ROOT/'docs/migration/native-campaigns-v51/source-manifest.json')
    require(cold['schema']=='logos-engine.v52.cold-start-v51.v1' and cold['status']=='passed' and cold['sourceCommit']==BASE and cold['sourceUnchanged'] is True and cold['nativeBefore']==cold['nativeAfter'],'Published baseline changed')
    require(cold['nativeBefore']['digest']==previous['digest'] and cold['nativeBefore']['files']==previous['fileCount']==172,'Baseline is not published v51')
    check_file(cold['nativeBefore']['nativeSourceManifest']);check_file(cold['generator']);corpus=read(check_file(cold['publicCorpus']))
    initial=next(row['packet'] for row in corpus['games'] if row['game']=='GARE')
    require(cold['packet']==initial==read(OUT/'gare-public-trace.json.gz')['packets'][0]['packet'] and cold['packetSha256']==packet_hash(initial),'Cold initial view changed')
    require(cold['gameLabelVisibleToRuntime'] is False and cold['initializedSessions']==1 and cold['dispatchedActions']==cold['manualPrimingActions']==cold['levelJumps']==corpus['actions']==corpus['levelJumps']==0,'Cold diagnostic acquired game results')
    result=cold['nativeResult'];require(result['snapshot']['actions']==0 and result['snapshot']['implementation']=='logos-engine.typescript.v6.native-migration/0.21.0','Cold snapshot changed')
    return {'receipt':proof(path),'sourceCommit':BASE,'proposedCommand':result.get('command'),'selectedProvider':result['snapshot']['lastDecision'],'dispatchedActions':0,
            'qualification':'Read-only initial planning on the published v51 bytes. It proves neither an effect nor a completed level.'}

def validate_history():
    selected=['docs/migration/native-campaigns-v51','docs/migration/v51-field-service-composition.md',
              'tests/fixtures/v6-field-service-original-public.json.gz','tests/fixtures/v6-field-service-reference.json.gz',
              'tests/v6-field-service-reference.test.ts','scripts/probe-v6-field-service-original.py','scripts/export-v6-field-service-reference.py']
    tree=subprocess.run(['git','ls-tree','-r','-z',BASE],cwd=ROOT,capture_output=True);require(tree.returncode==0,'Cannot inspect published v51 tree')
    verified={}
    for row in tree.stdout.split(b'\0'):
        if not row:continue
        metadata,name=row.split(b'\t',1);relative=name.decode()
        preserve=relative in selected or relative.startswith(selected[0]+'/') or (relative.startswith('scripts/') and '-v51-' in relative)
        if not preserve:continue
        mode,kind,object_id=metadata.split(b' ');require(kind==b'blob','Protected proof is not a Git blob')
        data=(ROOT/relative).read_bytes();actual=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
        require(actual==object_id.decode(),'Historical v51 bytes changed: '+relative)
        verified[relative]={'gitObject':actual,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)}
    require(all(name in verified for name in selected[1:]),'A protected v51 reference is absent')
    require({name for name in verified if name.startswith(selected[0]+'/')}==file_inventory([selected[0]]),'Previous proof directory inventory changed')
    return {'commit':BASE,'filesVerified':len(verified),'unchanged':True,'files':verified,
            'scope':'Complete committed v51 evidence directory, its release note, independent service fixtures/reference test, probes/exporters and all v51-named scripts retain their original Git blob bytes.'}

def validate_browser(source,campaign):
    path=OUT/'gare-browser-verification.json';browser=read(path)
    require(browser['schema']=='logos-engine.v52.browser-verification.v1' and browser['status']=='passed' and browser['game']=='GARE' and browser['nativeSourceManifestDigest']==source['digest'],'Browser proof source changed')
    check_file(browser['generator']);ui={'src/main.ts','src/sra-agent.css','src/styles.css'}
    require(set(browser['uiFilesSha256'])==ui and browser['uiUnchangedFromCommit']==BASE,'Browser UI source scope changed');check_map(browser['uiFilesSha256'])
    for name in ui:
        old_bytes=subprocess.run(['git','show',BASE+':'+name],cwd=ROOT,capture_output=True)
        require(old_bytes.returncode==0 and hashlib.sha256(old_bytes.stdout).hexdigest()==browser['uiFilesSha256'][name],'UI differs from published v51: '+name)
    build=read(OUT/'validation/checks-run.json')['buildInputs'];require(browser['uiFilesSha256']=={name:build[name] for name in ui},'Observed UI differs from build')
    raw=read(check_file(browser['rawMeasurements']));require(raw==browser['measurements'] and browser['measurementCount']==len(raw)==7,'Seven retained browser samples changed')
    selectors=['.board-column','#canvas-stage','#game-canvas','#agent-message','#agent-run'];baseline=raw[0]['rects'];viewport=raw[0]['viewport']
    require(set(baseline)==set(selectors) and set(viewport)=={'width','height'},'Browser measurement inventory changed')
    for rect in baseline.values():require(set(rect)=={'x','y','width','height'} and all(type(v) in [int,float] and math.isfinite(v) for v in rect.values()) and rect['width']>0 and rect['height']>0,'Invalid measured rectangle')
    require([row['status'] for row in raw]==['Ready to run from level 1.','Preparing the agent…','Level completed.',
        'Reading the board and planning…','Level completed.','Reading the board and planning…','Level completed.'],'Observed browser status coverage changed')
    require([parse_qs(urlsplit(row['url']).query) for row in raw]==[{'game':['GARE'],'level':[str(level)]} for level in [1,1,2,2,3,3,4]],'Observed browser navigation changed')
    for row in raw:require(row['rects']==baseline and row['viewport']==viewport and row['inspectionOpen'] is False,'Game layout moved between retained active/idle samples')
    counters=[[row['actions'],row['levels'],row['prefixes']] for row in raw]
    require(counters[0]==[0,0,0] and all(all(x<=y for x,y in zip(a,b)) for a,b in zip(counters,counters[1:])),'Browser counters are not monotonic from cold state')
    report=read(OUT/'gare-three-levels.json')
    for sample,boundary in zip([raw[2],raw[4],raw[6]],report['boundaries']):
        require([sample['actions'],sample['levels'],sample['prefixes']]==[boundary['totalActions'],boundary['levelsCompleted'],boundary['prefixCount']] and sample['status']=='Level completed.','Browser completed sample differs from actual boundary')
    layout={'viewport':viewport,'boardColumnHeight':baseline['.board-column']['height'],'canvasHeight':baseline['#game-canvas']['height'],'canvasWidth':baseline['#game-canvas']['width'],'statusHeight':baseline['#agent-message']['height'],
            'maxDocumentPositionDeltaPx':0,'maxDimensionDeltaPx':0,'selectors':selectors,'inspectionClosedThroughout':True}
    require(browser['layout']==layout,'Browser layout summary differs from retained rectangles')
    observed=browser['observedResult'];require([observed['actions'],observed['completedLevels'],observed['prefixes']]==counters[-1]==[campaign['actions'],3,campaign['prefixes']] and observed['entryLevel']==4 and observed['normalStatus']=='Level completed.','Browser completion differs from native campaign')
    require(parse_qs(urlsplit(observed['url']).query)=={'game':['GARE'],'level':['4']},'Browser final URL changed')
    controls=browser['browserCampaign'];require(controls['sessions']==1 and controls['manualGameActions']==controls['resets']==controls['levelJumps']==0 and controls['runToNextLevelClicks']==3,'Browser session used manual actions or resets')
    require(controls['uiActions']==['reload GARE at level 1','select SRA Agent Native TS tab']+['Run to next level']*3,'Browser interaction record changed')
    require(browser['fullscreen']['status'] in ['not_measured','not_retested','unavailable_in_browser'] and browser['mobile']['status']=='not_measured','Unobserved display modes were claimed')
    screenshot=check_file(browser['screenshot']);properties=image_properties(screenshot.read_bytes());require(properties==browser['screenshotProperties'],'Retained screenshot dimensions changed')
    require((properties['format']=='JPEG' and screenshot.suffix in ['.jpg','.jpeg']) or (properties['format']=='PNG' and screenshot.suffix=='.png'),'Screenshot extension differs from unchanged image bytes')
    accessibility=check_file(browser['accessibility']).read_text()
    for text in [observed['url'],'game=GARE&level=4','Solve with SRA.','Level completed.','button (collapsed) Inspect reasoning']:require(text in accessibility,'Final accessibility evidence missing: '+text)
    for count,label in [(campaign['actions'],'actions'),(3,'levels solved'),(campaign['prefixes'],'completed plans')]:
        require(re.search(r'\btext '+str(count)+r'\s*\n\s*\d+ text '+re.escape(label)+r'\s*(?:\n|$)',accessibility),'Final AX counter-label binding missing: '+label)
    return {'receipt':proof(path),'measurements':7,'layout':layout,'sampledCounters':counters,'completedLevels':3,'actions':campaign['actions'],'prefixes':campaign['prefixes'],'captureProperties':properties,
            'qualification':'Seven observed desktop samples have identical document rectangles with inspection closed. This is not per-frame, fullscreen or mobile validation.'}

def validate_candidate():
    path=HISTORY/'candidate-selection.json';value=read(path);manifest=read(REFERENCE/'manifest.json')['files']
    require(value['schema']=='logos-engine.v52.readonly-outline-candidate-selection.v1' and value['sourceCommit']==REFERENCE_COMMIT and value['sourceUnchanged'] is True and value['sourceFilesVerifiedBeforeImport']==value['sourceFilesVerifiedAfterRun']==1786,'Outline screening source changed')
    check_file(value['generator']);corpus=read(check_file(value['corpus']))
    require(len(value['results'])==len(corpus['games'])==value['corpus']['views']==100 and corpus['actions']==corpus['levelJumps']==0,'Screening contains game execution or changed corpus')
    require(all(amount==0 for amount in value['executionScope'].values()),'Read-only screening gained execution or acquisition')
    for mapping in [value['sourceHashes'],value['explicitSourceFiles']]:
        for name,digest in mapping.items():require(manifest[name]['sha256']==digest,'Outline source differs from pinned file')
    for row,public in zip(value['results'],corpus['games']):
        require(row['game']==public['game'] and row['observation_ref']==public['observation']['observation_ref'] and row['frameDigest']==packet_hash(public['packet']['frame_rows']),'Screening detached from public view')
        require(row['visualOutlineCount']==len(row['outlines']) and row['coldEntryAdmissible'] is False and row['actionAuthorizedByThisEvidence'] is False,'A contour was promoted into current control authority')
    measured=sum(row['visualOutlineCount']>0 for row in value['results']);study=sum(row['eligibleForControlAcquisitionStudy'] for row in value['results'])
    require(value['summary']=={'views':100,'viewsWithMeasuredOutlines':measured,'viewsWithUniqueSignatureAndAvailableDeclaredDirection':study,'coldEntryAdmissibleViews':0,'newGamesAttempted':0,'newLevelsCompleted':0},'Screening summary changed')
    selected=value['selection'];require(selected['entry']=='observed_outline_service' and selected['evaluationGame'] is None and selected['successfulGame'] is None and selected['followOnImplementationWritten'] is False,'Candidate-only screening was labeled as a solved or transferred capability')
    require(selected['visualCandidateGames']==[row['game'] for row in value['results'] if row['visualOutlineCount']] and selected['controlAcquisitionStudyGames']==[row['game'] for row in value['results'] if row['eligibleForControlAcquisitionStudy']],'Candidate ordering changed')
    require(value['coldControlGuard']['initialControl'] is None and value['coldControlGuard']['coldProposalAdmissible'] is False,'Cold outline control was invented')
    return {'receipt':proof(path),'nextEntry':selected['entry'],'publicViews':100,'viewsWithOutlines':measured,'controlAcquisitionStudyViews':study,'coldEntryAdmissibleViews':0,'completedLevels':0,'dispatchedActions':0,
            'qualification':'Initial visual candidates alone do not identify controlled objects or a future successful game. The next transfer must acquire control from actual public returns.'}

def retained_inputs():
    folders=['src','tests','scripts','docs/migration/native-campaigns-v52','docs/migration/native-campaigns-v51',f'reference/v6/{REFERENCE_COMMIT}/source']
    return {name:sha(ROOT/name) for name in sorted(file_inventory(folders)) if name!=(OUT/'validation.json').relative_to(ROOT).as_posix()}

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--verify',action='store_true');args=parser.parse_args()
    required=['source-manifest.json','gare-three-levels.json','gare-public-trace.json.gz','gare-actual-public-journal.jsonl.gz','execution-gare.json','framed-transfer-original-comparison.json',
              'valv-service-original-component-comparison.json','valv-service-identity-recipes.json.gz','validation/delta-tests-run.json','validation/checks-run.json',
              'regression-plan.json','regression-verification.json','regression-summary.json','gare-browser-verification.json',
              'phased-reception-contract-comparison.json','directed-composition-contract-comparison.json']
    require(all((OUT/name).is_file() for name in required),'Missing retained release evidence: '+', '.join(name for name in required if not(OUT/name).is_file()))
    before=retained_inputs();source=validate_source();campaign=validate_campaign(source)
    failures=validate_failures_and_diagnostic();historical_snapshot=validate_archived_snapshot();packet_only_snapshot=validate_packet_only_snapshot();uniform_snapshot=validate_uniform_question_snapshot();typed_priority_snapshot=validate_typed_priority_snapshot();pre_phased_snapshot=validate_pre_phased_snapshot();cold=validate_cold();comparisons=validate_comparators(source,campaign)
    extension_contracts=validate_extension_contracts(source);tests=validate_tests(source);regressions=validate_regressions(source);checks=validate_checks(source);progress=validate_progress()
    history=validate_history();browser=validate_browser(source,campaign);candidate=validate_candidate()
    require(validate_source()==source and retained_inputs()==before,'Read-only validation changed a retained input')
    report={'schema':'logos-engine.v52.release-validation.v1','status':'passed','sourceDigest':source['digest'],'nativeSourceFiles':source['fileCount'],
            'nativeSourceManifest':proof(OUT/'source-manifest.json'),'newActualCampaign':campaign,'preservedFailuresAndDiagnostic':failures,
            'coldStartDiagnostic':cold,'componentComparisons':comparisons,'independentExtensionContracts':extension_contracts,'deltaTests':tests,'regressions':regressions,'checks':checks,'browser':browser,
            'progress':progress,'historicalV51Evidence':history,'preservedC227Snapshot':historical_snapshot,'preservedPacketOnlySnapshot':packet_only_snapshot,'preservedFirstUniformQuestionSnapshot':uniform_snapshot,'preservedTypedPrioritySnapshot':typed_priority_snapshot,'preservedPrePhasedSnapshot':pre_phased_snapshot,
            'nextCandidateScreening':candidate,'completeMigration':False,'originalFullCommonCallerParity':False,
            'retainedInputsUnchangedDuringValidation':True,'generator':proof(Path(__file__)),
            'scope':'Read-only validation of a real final campaign, explicit native guard/search extensions, unchanged original component recomputations, preserved failed attempts, targeted tests, eight recorded-public replays, exact historical bytes, build, browser observations and candidate-only screening. No game, native agent or test suite is executed by this validator.'}
    output=OUT/'validation.json'
    if args.verify:require(output.is_file() and read(output)==report,'Retained release validation differs from recomputation')
    else:require(not output.exists(),'validation.json exists; use --verify');output.write_text(json.dumps(report,indent=2,ensure_ascii=False,allow_nan=False)+'\n')
    print(json.dumps({'status':'passed','mode':'verify' if args.verify else 'create','newGame':'GARE','levelsCompleted':3,'enteredLevel':4,'officialState':'NOT_FINISHED',
                      'actions':campaign['actions'],'prefixes':campaign['prefixes'],'deltaTests':tests['counts'],'recordedPublicRegressions':8,'entryProgressPercent':57.9}),flush=True)

if __name__=='__main__':main()
