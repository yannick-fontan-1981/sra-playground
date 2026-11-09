#!/usr/bin/env python3
"""Replay unchanged FramedTransfer on every actual native public transition.

This compares the isolated component, its two source entry points, complete
source envelopes, observations and six-field memory. The full original caller
is not run. A separately retained native point-binding receipt is required for
every admitted action whose strict unchanged source guard refuses. No expected
result is taken from native outputs; source IDs are never substituted.
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

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/migration/native-campaigns-v52'
spec = importlib.util.spec_from_file_location('framed_contracts', ROOT/'scripts/export-v6-framed-transfer-reference.py')
contracts = importlib.util.module_from_spec(spec); spec.loader.exec_module(contracts)
helper, g = contracts.helper, contracts.g
from agents.yf_arc3_v6.morphology_policy.framed_transfer.family import FramedTransfer
from neutral_observer import measure as observe

PUBLIC_FIELDS = {'frame_rows','frame_packet','level','levels_completed','state','step_index','available_action_refs','frame_hash'}
WRAPPER_KEYS = {'material_access_subquestion','field_subquestion','composition_target_tree','morphology','strategy_receipt'}
SOURCE_RECEIPT_KEYS = {'workflow','src_hash','src_status','executed_statements'}
NATIVE_RECEIPT_KEYS = {'all_executed_statements','instruction_quantum','instructions','trace','execution_engine','reference_commit','reference_semantic_hash',
                       'native_execution_hash','source_definition_hash','edited'}
OBSERVATION_REF = re.compile(r'^(.*):epoch:(\d+):revision:(\d+):frame:([a-f0-9]+)$')
ANNOTATIONS = []

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def packed(value): return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()
def digest(value): return hashlib.sha256(packed(value)).hexdigest()
def exact(a, b): return packed(a) == packed(b)
def load(path):
    raw = path.read_bytes(); return json.loads(gzip.decompress(raw) if path.suffix == '.gz' else raw)
def proof(path): return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path), 'bytes': path.stat().st_size}
def plain(value): return contracts.plain(copy.deepcopy(value))
def packet_hash(packet): return hashlib.sha256(json.dumps(packet, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
def check(actual, expected, path):
    if exact(actual, expected): return
    if isinstance(actual, dict) and isinstance(expected, dict) and set(actual) == set(expected):
        for key in actual: check(actual[key], expected[key], path + '.' + key)
    elif isinstance(actual, list) and isinstance(expected, list) and len(actual) == len(expected):
        for index, (left, right) in enumerate(zip(actual, expected)): check(left, right, path + f'.{index}')
    raise AssertionError({'path': path, 'actual': actual, 'expected': expected})

def source_projection(value, path):
    if isinstance(value, list): return [source_projection(child, path + f'.{index}') for index, child in enumerate(value)]
    if not isinstance(value, dict): return value
    if SOURCE_RECEIPT_KEYS <= value.keys():
        extra = set(value) - SOURCE_RECEIPT_KEYS
        assert extra <= NATIVE_RECEIPT_KEYS, (path, extra)
        if extra:
            assert value['execution_engine'] == 'logos-engine.typescript' and value['reference_commit'] == helper.COMMIT
            assert value['instruction_quantum'] == 128 and isinstance(value['instructions'], int) and value['instructions'] > 0
            assert value['trace'] and len(value['all_executed_statements']) >= len(value['executed_statements'])
            assert re.fullmatch('[a-f0-9]{64}', value['reference_semantic_hash'])
            if 'native_execution_hash' in value:
                assert value['edited'] is False and value['source_definition_hash'] == value['src_hash']
                assert re.fullmatch('[a-f0-9]{64}', value['native_execution_hash'])
            ANNOTATIONS.append({'path': path, 'fields': sorted(extra), 'sha256': digest({key:value[key] for key in sorted(extra)})})
        return {key: source_projection(value[key], path+'.'+key) for key in SOURCE_RECEIPT_KEYS}
    return {key: source_projection(child, path+'.'+key) for key, child in value.items()}

def own_check(native, source, path):
    projected = source_projection(native, path)
    # Both operands are independently qualified, without float or ID conversion.
    left, right = contracts.finite_canonical(projected), contracts.finite_canonical(plain(source))
    if left != right: check(projected, plain(source), path)
    assert left == right
    return helper.hashed(left.encode())

def native_inventory():
    return {p.relative_to(ROOT).as_posix(): sha(p) for folder in ['src/logos-engine','src/runtime']
            for p in sorted((ROOT/folder).rglob('*')) if p.is_file() and p.suffix in ('.ts','.json','.drm')}

def verify_native(paths, allow_failed_campaign=False):
    campaign, trace, execution, source = [load(paths[name]) for name in ['campaign','trace','execution','source']]
    assert campaign['status'] == trace['status'] and campaign['game'] == trace['game'] == 'GARE'
    assert campaign['status'] == 'passed' or (allow_failed_campaign and campaign['status'] == 'failed')
    completed_target = campaign['status'] == 'passed'
    check(campaign['source'], source, 'campaign.source'); assert campaign['sourceUnchangedDuringRun'] and trace['sourceDigest'] == source['digest']
    assert campaign['referenceCommit'] == helper.COMMIT and campaign['pythonAgentModules'] == []
    assert campaign['final']['fullV6Parity'] is False and campaign['final']['sessions'] == 1
    assert source['fileCount'] == len(source['files']) and source['digest'] == digest(source['files'])
    check(native_inventory(), source['files'], 'current.native.files')
    assert execution['exitCode'] == (0 if completed_target else 1) and execution['nativeSourceUnchanged'] is True
    check(execution['nativeSource'], source, 'execution.before'); check(execution['nativeSourceAfter'], source, 'execution.after')
    assert execution['nativeSourceManifestDigest'] == source['digest']
    assert execution['command'][:4] == ['node','scripts/run-v44-campaign.mjs','GARE','3'] and len(execution['command']) == 6
    for value, name in zip(execution['command'][4:], ['campaign','trace']): assert value.endswith('/'+paths[name].relative_to(ROOT).as_posix())
    for key, name in [('report','campaign'),('trace','trace')]: check(execution[key], proof(paths[name]), 'execution.'+key)
    for key in ['generator','output']: check(execution[key], proof(ROOT/execution[key]['path']), 'execution.'+key)
    last = json.loads(gzip.decompress((ROOT/execution['output']['path']).read_bytes()).decode().splitlines()[-1])
    assert last['status'] == campaign['status'] and last['sourceDigest'] == source['digest']
    check(last['final'], campaign['final'], 'log.final'); check(last['boundaries'], campaign['boundaries'], 'log.boundaries')
    assert campaign['final']['actions'] == len(campaign['actions']) == len(trace['packets']) - 1
    assert campaign['final']['prefixes'] == len(campaign['prefixes']) and sum(p['acquiredActions'] for p in campaign['prefixes']) == len(campaign['actions'])
    assert campaign['targetLevels'] == 3
    if completed_target: assert campaign['final']['levelsCompleted'] >= campaign['targetLevels']
    else: assert campaign['final']['levelsCompleted'] < campaign['targetLevels'] and campaign['failure']
    assert campaign['final']['caller']['acquiredTransitions'] == len(campaign['actions'])
    assert all(boundary['sessionRetained'] for boundary in campaign['boundaries'])
    packet_checks = []
    for index, item in enumerate(trace['packets']):
        packet = item['packet']; assert set(packet) == PUBLIC_FIELDS and packet['step_index'] == index
        assert packet['frame_hash'] == hashlib.sha256(json.dumps(packet['frame_rows'], separators=(',', ':')).encode()).hexdigest()[:16]
        if index:
            action = campaign['actions'][index-1]; check(item['command'], action['command'], f'actual.command.{index}')
            assert action['sequence'] == index and action['publicPacketSha256'] == packet_hash(packet)
            assert action['animationFrames'] == len(packet['frame_packet']) and action['frameHash'] == packet['frame_hash']
            assert (action['levelAfter'], action['completedAfter'], action['state']) == (packet['level'], packet['levels_completed'], packet['state'])
        else: assert packet_hash(packet) == campaign['initial']['publicPacketSha256']
        packet_checks.append({'index': index, 'publicPacketSha256': packet_hash(packet), 'canonicalPublicPacketSha256': digest(packet), 'frames': len(packet['frame_packet'])})
    for name, value in campaign['gameAssets'].items(): assert sha(ROOT/'public/python'/name) == value
    return campaign, trace, source, packet_checks

def current_binding_receipt(family, proposal, packet, obs, source_guard):
    """Independent specification of the declared native extension, not source."""
    offer = proposal['framed_transfer_plan']['offer']
    current = g.candidates(packet['frame_rows'], obs, family.policy, family.spans, family.receipts, {})
    matches = [row for row in current if row['candidate_ref'] == offer['candidate_ref'] and row['patches'] == offer['patches']]
    assert len(matches) > 1 and source_guard == {'admitted': False, 'reason': 'current_parallel_support_and_payload'}
    fields = ['candidate_ref','patches','point','point_x','point_y','point_value','bbox','signature']
    physical = all(all(exact(row[key], offer[key]) for key in fields) for row in matches) and exact(offer['point'], [offer['point_y'],offer['point_x']])
    selected = [row for row in matches if row['component_ref'] == offer['component_ref']]
    binding = proposal['steps'][0]['point_binding']
    bound = binding['entity_ref'] == offer['component_ref'] and binding['signature'] == offer['signature'] and exact(binding['bbox'],offer['bbox'])
    bound = bound and exact(binding['point'],[offer['point_x'],offer['point_y']]) and binding['palette_value'] == offer['point_value']
    bound = bound and all(binding[key] == obs[key] for key in ['observation_ref','level_epoch','frame_hash'])
    assert physical and len(selected) == 1 and bound and proposal['actions'][0]['action_ref'] in obs['available_action_refs']
    return {'schema':'logos-engine.native.current-point-binding.v1','rule':'native.current_framed_point_witness','source_guard':source_guard,
            'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash'],
            'current_description_count':len(matches),'current_component_refs':[row['component_ref'] for row in matches],
            'selected_component_ref':offer['component_ref'],'selected_current_bindings':len(selected),'same_physical_point':physical,
            'point_binding_current':bound,'physical_command':proposal['actions'][0],'release_authority':False,'expected_effect_status':'unknown',
            'qualification':'current_public_binding_only_no_effect_claim'}

def compare(paths, allow_failed_campaign=False):
    campaign, trace, native, packet_checks = verify_native(paths, allow_failed_campaign)
    reference_path = ROOT/'tests/fixtures/v6-framed-transfer-reference.json.gz'
    reference = load(reference_path); probes = [load(ROOT/item['path']) for item in reference['originalPublicProbes']]
    manifest = load(helper.SOURCE.parent/'manifest.json')['files']
    assert len(manifest) == len(helper.VERIFIED_PINNED_SOURCE) == 1786
    for item in [reference,*probes]:
        assert item['sourceCommit'] == helper.COMMIT and item['pinnedSourceFilesVerifiedBeforeImport'] == 1786
        assert sha(ROOT/item['generator']) == item['generatorSha256']
        for path, value in item['sourceHashes'].items(): assert manifest[path]['sha256'] == value
    for item in reference['originalPublicProbes']: assert sha(ROOT/item['path']) == item['sha256']
    assert reference['pinnedSourceFilesVerifiedAfterRun'] == 1786
    first_probe = probes[0]
    assert first_probe['game'] == 'GARE' and first_probe['status'] == 'stopped' and first_probe['reason'] == 'before_guard_refused'
    assert first_probe['actions'] == 12 and first_probe['levelsCompleted'] == 1 and first_probe['frontierEnabled'] is False
    assert all(item['fullOriginalCaller'] is False and item['sessionCount'] == 1 and item['manualPrimingActions'] == item['resets'] == item['levelJumps'] == 0 for item in probes)
    check(first_probe['gameAssetHashes'],campaign['gameAssets'],'assets.source_native')
    matched_packets = 0
    for index, original in enumerate(first_probe['packets']):
        actual = trace['packets'][index]
        check(actual['packet'],original['packet'],f'preserved.original.prefix.packet.{index}')
        check(actual['command'],original['command'],f'preserved.original.prefix.command.{index}')
        matched_packets += 1
    first = next(prefix['framedTransfer'] for prefix in campaign['prefixes'] if prefix.get('framedTransfer'))
    match = OBSERVATION_REF.fullmatch(first['proposal']['binding']['observation_ref']); assert match
    scope = match.group(1)
    observations = [observe(SimpleNamespace(**item['packet']), index+1, scope)[0] for index,item in enumerate(trace['packets'])]
    family = FramedTransfer(); cursor = boundary = 0; checks = []; offers = []; wrappers = []; guard_differences = []; counts = Counter()
    sys.setprofile(contracts.profile)
    try:
        for prefix_index, prefix in enumerate(campaign['prefixes']):
            if prefix_index % 10 == 0:
                print(json.dumps({'phase':'unchanged_source_component_replay','prefix':prefix_index,'prefixes':len(campaign['prefixes']),'publicReturnsCompared':cursor}),file=sys.stderr,flush=True)
            obs = observations[cursor]; packet = trace['packets'][cursor]['packet']; captured = prefix.get('framedTransfer')
            proposal = None
            if captured:
                remaining = campaign['budget']['levelActionCaps'][min(obs['level_epoch']-1,len(campaign['budget']['levelActionCaps'])-1)] - (cursor-boundary)
                if prefix['selectionGroup'] == 'window_constraints':
                    assert prefix['fieldSubquestion'] == 'observed_framed_analogy'
                    proposal = family.analogy(obs,packet['frame_rows'],[],remaining); counts['analogyEntrypoints'] += 1
                else:
                    assert prefix['selectionGroup'] == 'factored_material_return' and prefix['materialSubquestion'] == 'observed_framed_transfer'
                    proposal = family.propose(obs,packet['frame_rows'],[],remaining); counts['proposeEntrypoints'] += 1
                assert proposal and prefix['family'] == 'public_framed_transfer' and captured['stateNode'] == 'family_state:public_framed_transfer'
                family.bind(proposal,None)
                actual = captured['proposal']; extra = set(actual)-set(proposal)
                assert extra <= WRAPPER_KEYS and not(set(proposal)-set(actual)),extra
                provider = {key:value for key,value in actual.items() if key not in extra}
                provider_digest = own_check(provider,proposal,f'provider.{prefix_index}')
                offers.append({'prefixIndex':prefix_index,'firstAction':cursor+1,'sourceProposalSha256':digest(plain(proposal)),
                               'nativeSourceProjectionSha256':provider_digest,'allSourceProviderFieldsCompared':True})
                wrappers.append({'prefixIndex':prefix_index,'fields':sorted(extra),'sha256':digest({key:actual[key] for key in sorted(extra)})})
                counts['selected:'+proposal['framed_transfer_plan']['choice']['projection_ref']] += 1
            else: counts['foreignPrefixes'] += 1
            retained = prefix['framedAcquisition']; assert retained['stateNode'] == 'family_state:public_framed_transfer' and retained['checkpointFormat'] == 'native.public_framed_transfer.v1'
            acquired = retained['acquired']; offset = 0; binding_offset = 0
            for index in range(prefix['acquiredActions']):
                first = trace['packets'][cursor]['packet']; second = trace['packets'][cursor+1]['packet']
                before,after = observations[cursor:cursor+2]; command = trace['packets'][cursor+1]['command']
                guard = None
                if proposal:
                    own_check(command,proposal['actions'][index],f'command.{cursor+1}')
                    guard = family.before(proposal,index,SimpleNamespace(**first),before)
                    if not guard['admitted']:
                        expected = current_binding_receipt(family,proposal,first,before,guard)
                        binding = prefix.get('nativeBindings',[])[binding_offset]; binding_offset += 1
                        assert binding['index'] == index and binding['observation_ref'] == before['observation_ref']
                        check(binding['command'],command,f'extension.command.{cursor+1}')
                        check(binding['native_binding_receipt'],expected,f'extension.receipt.{cursor+1}')
                        assert binding['evidence_node'] == 'reasoning:binding:'+str(before['revision'])
                        retained_guard = binding['retainedGuard']
                        for key in ['observation_ref','level_epoch','frame_hash']: assert retained_guard[key] == before[key]
                        check(retained_guard['command'],command,f'extension.retained.command.{cursor+1}')
                        check(retained_guard['guard'],{'admitted':True,'reason':'native_current_framed_point_witness_bound','native_binding_receipt':expected},f'extension.retained.guard.{cursor+1}')
                        assert 'before ordinary WHY/ACT release' in retained_guard['qualification']
                        guard_differences.append({'actionIndex':cursor+1,'prefixIndex':prefix_index,'sourceGuard':guard,'nativeGuard':retained_guard['guard'],
                                                  'evidenceNode':binding['evidence_node'],'sourceGuardIntentionallyUnchanged':True})
                    else: counts['strictSourceGuardsAdmitted'] += 1
                observed = family.record(before,after,command,first['frame_rows'],second['frame_rows'],proposal,index)
                if observed is not None:
                    fact = acquired[offset]; offset += 1
                    assert fact['key'] == 'framed_transfer_event:'+str(prefix['decisionRevision']+index)
                    assert fact['evidence'] == after['observation_ref'] and fact['revision'] == after['revision']
                    own_check(fact['result'],observed,f'acquisition.{cursor+1}'); counts['acquiredEvents'] += 1
                    counts['derivedRecords'] += len(observed.get('derived',[]))
                checks.append({'actionIndex':cursor+1,'prefixIndex':prefix_index,'selectedFramedProvider':proposal is not None,
                               'sourceGuard':plain(guard),'sourceAcquisitionSha256':digest(plain(observed)),
                               'sourceStateSha256':digest(plain(family.state()))})
                cursor += 1
                if after['levels_completed'] > before['levels_completed']: boundary = cursor
            assert offset == len(acquired) and binding_offset == len(prefix.get('nativeBindings',[]))
            own_check(retained['sourceState'],family.state(),f'own.state.{prefix_index}')
        assert cursor == campaign['final']['actions'] and guard_differences
    finally: sys.setprofile(None)
    assert not contracts.PENDING
    assert helper.verify_source_manifest() == helper.VERIFIED_PINNED_SOURCE
    imports = helper.source_hashes()
    for path,value in imports.items(): assert manifest[path]['sha256'] == value
    return {'schema':'logos-engine.v52.framed-transfer-public-comparison.v1','status':'passed','referenceCommit':helper.COMMIT,
            'sourceModified':False,'pinnedSourceFilesVerifiedBeforeImport':1786,'pinnedSourceFilesVerifiedAfterRun':1786,
            'sourceHashes':imports,'importedSourceModuleCount':sum(path.endswith('.py') for path in imports),
            'explicitLocalPolicyFileCount':sum(not path.endswith('.py') for path in imports),
            'qualification':{'gameHostRunByComparator':False,'nativeAgentRunByComparator':False,'nativeOutputsUsedAsExpected':False,
                'fullOriginalCallerParity':False,'fullOriginalCampaignMatched':False,'identifierSubstitution':False,
                'scope':'Unchanged isolated source component replay on every actual public transition, including passive foreign acquisitions. A separately retained native current-point binding extends the source uniqueness guard only. Other native search refusals and full-caller selection are not attributed to this source component.',
                'originalFailure':'The unchanged isolated source stops after twelve actions and one level; its refusal is preserved. Any later native progress is not attributed to that isolated source campaign.',
                'nativeTargetReached':campaign['status']=='passed','nativeCampaignStatus':campaign['status'],
                'numerics':'Exact safe-integer JSON bytes for observed component identity operands. No general Python float JSON identity equivalence is claimed.',
                'sourceReceiptFields':sorted(SOURCE_RECEIPT_KEYS),'excludedNativeReceiptAnnotations':sorted(NATIVE_RECEIPT_KEYS)},
            'inputs':{name:proof(path) for name,path in paths.items()},'referenceContracts':proof(reference_path),
            'originalProbes':[proof(ROOT/item['path']) for item in reference['originalPublicProbes']],
            'nativeSourceDigest':native['digest'],'nativeSourceFileCount':native['fileCount'],
            'nativeCampaign':{key:campaign['final'][key] for key in ['actions','prefixes','levelsCompleted','level','state','sessions','nativeImplementation','reason']},
            'preservedOriginalPrefix':{'commands':matched_packets-1,'completePublicPackets':matched_packets,'originalCompletedLevels':first_probe['levelsCompleted']},
            'counts':dict(counts),'completePackets':packet_checks,'providerChecks':offers,'transitionChecks':checks,
            'nativeGuardExtensions':guard_differences,'wrapperAnnotations':wrappers,'srcReceiptAnnotations':ANNOTATIONS,
            'identityRecipes':list(contracts.RECIPES.values()),'finalSourceState':plain(family.state())}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--campaign',default='docs/migration/native-campaigns-v52/gare-three-levels.json')
    parser.add_argument('--trace',default='docs/migration/native-campaigns-v52/gare-public-trace.json.gz')
    parser.add_argument('--execution',default='docs/migration/native-campaigns-v52/logs/execution-gare.json')
    parser.add_argument('--source',default='docs/migration/native-campaigns-v52/source-manifest.json')
    parser.add_argument('--output',default='docs/migration/native-campaigns-v52/framed-transfer-original-comparison.json')
    parser.add_argument('--identities',default='docs/migration/native-campaigns-v52/framed-transfer-identity-recipes.json.gz')
    parser.add_argument('--allow-failed-campaign',action='store_true',help='Compare retained public evidence of a failed target without classifying the campaign as successful')
    parser.add_argument('--verify',action='store_true',help='Recompute without changing retained comparison evidence')
    args = parser.parse_args(); paths = {name:ROOT/getattr(args,name) for name in ['campaign','trace','execution','source']}
    destination,identity_path = ROOT/args.output,ROOT/args.identities
    if destination.exists() and not args.verify: raise FileExistsError(destination)
    if identity_path.exists() and not args.verify: raise FileExistsError(identity_path)
    result = compare(paths,args.allow_failed_campaign); result.update(generator=proof(Path(__file__)))
    recipes=result.pop('identityRecipes')
    identities={'schema':'logos-engine.v52.framed-transfer-derived-identities.v1','referenceCommit':helper.COMMIT,
                'nativeSourceDigest':result['nativeSourceDigest'],'nativeCampaignStatus':result['qualification']['nativeCampaignStatus'],
                'sourceModified':False,'identifierSubstitution':False,'source':'Unchanged Python component digest calls on the retained public trajectory',
                'numericScope':'Exact safe-integer JSON operands only; no general Python float identity claim','recipes':recipes}
    identities_encoded=json.dumps(identities,sort_keys=True,separators=(',',':'))+'\n'
    if args.verify: assert load(identity_path)==identities,'Retained identity recipes differ from independent source recomputation'
    else: identity_path.write_bytes(gzip.compress(identities_encoded.encode(),mtime=0))
    result.update(identityEvidence=proof(identity_path),identityRecipeCount=len(recipes))
    encoded=json.dumps(result,sort_keys=True,indent=2)+'\n'
    if args.verify:
        assert destination.read_text()==encoded,'Retained comparison differs from independent recomputation'
    else:destination.write_text(encoded)
    print(json.dumps({'output':destination.relative_to(ROOT).as_posix(),'status':result['status'],'mode':'verify' if args.verify else 'create',
                      'nativeCampaign':result['nativeCampaign'],'counts':result['counts'],
                      'guardExtensions':len(result['nativeGuardExtensions']),'identityRecipes':len(recipes),
                      'receiptAnnotations':len(result['srcReceiptAnnotations'])}))

if __name__ == '__main__': main()
