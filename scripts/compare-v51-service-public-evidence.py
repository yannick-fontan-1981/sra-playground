#!/usr/bin/env python3
"""Replay unchanged source field-service layers on actual native public returns.

No game or native agent is run by this comparator. Source expectations are
computed from the pinned Python. Native outputs are only compared. Every own
identity operand is checked independently; no identifier substitution or
float/string normalization is used. Full common caller parity is not claimed.
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
OUT = ROOT / 'docs/migration/native-campaigns-v51'
spec = importlib.util.spec_from_file_location('service_contracts', ROOT / 'scripts/export-v6-field-service-reference.py')
contracts = importlib.util.module_from_spec(spec); spec.loader.exec_module(contracts)
helper = contracts.helper
from common_field_service import FieldServiceConstraint
from service_transfer_access import ServiceTransferAccess
from observed_input_domain import ObservedInputDomain
from neutral_observer import measure as observe

PUBLIC_FIELDS = {'frame_rows', 'frame_packet', 'level', 'levels_completed', 'state', 'step_index', 'available_action_refs', 'frame_hash'}
WRAPPER_KEYS = {'composition_target_tree', 'field_subquestion', 'morphology', 'strategy_receipt'}
OBSERVATION_REF = re.compile(r'^(.*):epoch:(\d+):revision:(\d+):frame:([a-f0-9]+)$')

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def packed(value): return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()
def digest(value): return hashlib.sha256(packed(value)).hexdigest()
def exact(a, b): return packed(a) == packed(b)
def load(path):
    raw = path.read_bytes(); return json.loads(gzip.decompress(raw) if path.suffix == '.gz' else raw)
def proof(path): return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path), 'bytes': path.stat().st_size}
def plain(value): return helper.plain(copy.deepcopy(value))
def packet_hash(packet): return hashlib.sha256(json.dumps(packet, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
def check(a, b, path):
    if exact(a, b): return
    if isinstance(a, dict) and isinstance(b, dict) and set(a) == set(b):
        for key in a: check(a[key], b[key], path + '.' + key)
    elif isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
        for index, (left, right) in enumerate(zip(a, b)): check(left, right, path + f'.{index}')
    raise AssertionError((path, a, b))
def own_check(a, b, path):
    # Both operands must independently satisfy the qualified integer-only domain.
    source = contracts.finite_canonical(a); native = contracts.finite_canonical(b)
    if source != native: check(a, b, path)
    assert source == native
def native_inventory():
    return {p.relative_to(ROOT).as_posix(): sha(p) for folder in ['src/logos-engine', 'src/runtime']
            for p in sorted((ROOT / folder).rglob('*')) if p.is_file() and p.suffix in ('.ts', '.json', '.drm')}

def verify_native():
    paths = {name: OUT / relative for name, relative in {'campaign': 'valv-three-levels.json', 'trace': 'valv-public-trace.json.gz',
             'execution': 'logs/execution-valv.json', 'source': 'source-manifest.json'}.items()}
    c, t, e, s = [load(paths[name]) for name in ['campaign', 'trace', 'execution', 'source']]
    assert c['status'] == t['status'] == 'passed' and c['game'] == t['game'] == 'VALV'
    check(c['source'], s, 'native.source'); assert c['sourceUnchangedDuringRun'] and t['sourceDigest'] == s['digest']
    assert c['pythonAgentModules'] == [] and c['final']['fullV6Parity'] is False and c['final']['sessions'] == 1
    assert c['final']['nativeImplementation'] == 'logos-engine.typescript.v6.native-migration/0.21.0'
    assert s['fileCount'] == len(s['files']) == 172 and s['digest'] == digest(s['files'])
    check(native_inventory(), s['files'], 'current.native.files')
    assert e['exitCode'] == 0 and e['nativeSourceUnchanged'] is True
    check(e['nativeSource'], s, 'execution.before'); check(e['nativeSourceAfter'], s, 'execution.after')
    assert e['nativeSourceManifestDigest'] == s['digest']
    assert e['command'][:4] == ['node', 'scripts/run-v44-campaign.mjs', 'VALV', '3'] and len(e['command']) == 6
    for value, name in zip(e['command'][4:], ['campaign', 'trace']):
        assert value.endswith('/' + paths[name].relative_to(ROOT).as_posix())
    for key, name in [('report', 'campaign'), ('trace', 'trace')]: check(e[key], proof(paths[name]), 'execution.' + key)
    for key in ['generator', 'output']: check(e[key], proof(ROOT / e[key]['path']), 'execution.' + key)
    last = json.loads(gzip.decompress((ROOT / e['output']['path']).read_bytes()).decode().splitlines()[-1])
    assert last['status'] == 'passed' and last['sourceDigest'] == s['digest']
    check(last['final'], c['final'], 'log.final'); check(last['boundaries'], c['boundaries'], 'log.boundaries')
    assert c['final']['actions'] == len(c['actions']) == len(t['packets']) - 1 == 28
    assert c['final']['prefixes'] == len(c['prefixes']) == 28 and sum(p['acquiredActions'] for p in c['prefixes']) == 28
    assert c['final']['levelsCompleted'] == c['targetLevels'] == 3 and c['final']['level'] == 4
    assert c['final']['state'] == 'NOT_FINISHED' and c['final']['reason'] == 'target_levels_completed'
    assert c['final']['caller']['acquiredTransitions'] == 28 and c['final']['caller']['boundaryReplays'] == 2
    assert [b['levelsCompleted'] for b in c['boundaries']] == [1, 2, 3] and all(b['sessionRetained'] for b in c['boundaries'])
    assert [b['levelActions'] for b in c['boundaries']] == [10, 10, 8]
    packet_checks = []
    for i, item in enumerate(t['packets']):
        packet = item['packet']; assert set(packet) == PUBLIC_FIELDS and packet['step_index'] == i
        assert packet['frame_hash'] == hashlib.sha256(json.dumps(packet['frame_rows'], separators=(',', ':')).encode()).hexdigest()[:16]
        if i:
            action = c['actions'][i - 1]; check(item['command'], action['command'], f'command.{i}')
            assert action['sequence'] == i and packet_hash(packet) == action['publicPacketSha256']
            assert action['animationFrames'] == len(packet['frame_packet']) and action['frameHash'] == packet['frame_hash']
            assert (action['levelAfter'], action['completedAfter'], action['state']) == (packet['level'], packet['levels_completed'], packet['state'])
        else: assert packet_hash(packet) == c['initial']['publicPacketSha256']
        packet_checks.append({'index': i, 'publicPacketSha256': packet_hash(packet), 'canonicalPublicPacketSha256': digest(packet), 'frames': len(packet['frame_packet'])})
    for name, value in c['gameAssets'].items(): assert sha(ROOT / 'public/python' / name) == value
    return c, t, s, paths, packet_checks

def compare():
    campaign, trace, native, paths, packets = verify_native()
    reference_path = ROOT / 'tests/fixtures/v6-field-service-reference.json.gz'
    probe_path = ROOT / 'tests/fixtures/v6-field-service-original-public.json.gz'
    reference, probe = load(reference_path), load(probe_path)
    manifest = load(helper.SOURCE.parent / 'manifest.json')['files']
    assert len(manifest) == len(helper.VERIFIED_PINNED_SOURCE) == 1786
    assert helper.verify_source_manifest() == helper.VERIFIED_PINNED_SOURCE
    for evidence in [reference, probe]:
        assert evidence['sourceCommit'] == campaign['referenceCommit'] == helper.COMMIT
        assert evidence['pinnedSourceFilesVerifiedBeforeImport'] == 1786
        assert sha(ROOT / evidence['generator']) == evidence['generatorSha256']
        for path, value in evidence['sourceHashes'].items(): assert manifest[path]['sha256'] == value
    assert reference['pinnedSourceFilesVerifiedAfterRun'] == 1786
    assert reference['originalPublicProbe']['sha256'] == sha(probe_path)
    assert probe['status'] == 'passed' and probe['actions'] == 28 and probe['levelsCompleted'] == 3 and len(probe['prefixes']) == 28
    assert probe['fullOriginalCaller'] is False and probe['manualPrimingActions'] == probe['resets'] == probe['levelJumps'] == 0
    assert probe['frontierEnabled'] is False and probe['providerOrder'] == ['service_propose'] and probe['sessionCount'] == 1
    check(probe['gameAssetHashes'], campaign['gameAssets'], 'assets.source_native')
    assert len(probe['packets']) == len(trace['packets']) == 29
    for index, (left, right) in enumerate(zip(probe['packets'], trace['packets'])):
        check(left['packet'], right['packet'], f'independent.campaign.complete_public_packet.{index}')
        check(left['command'], right['command'], f'independent.campaign.command.{index}')
    first = next(p['fieldService'] for p in campaign['prefixes'] if p.get('fieldService'))
    match = OBSERVATION_REF.fullmatch(first['proposal']['nested_control_plan']['observation_ref']); assert match
    scope = match.group(1)
    observations = [observe(SimpleNamespace(**item['packet']), i + 1, scope)[0] for i, item in enumerate(trace['packets'])]
    family = FieldServiceConstraint(); domain = ObservedInputDomain(4096)
    reconstructed = ServiceTransferAccess(); source_events = []; native_events = []; offers = []; checks = []; annotations = []; counts = Counter()
    cursor = boundary = 0
    sys.setprofile(contracts.profile)
    try:
        for prefix_index, prefix in enumerate(campaign['prefixes']):
            before = observations[cursor]; frame = trace['packets'][cursor]['packet']; inputs = domain.candidates(before)
            proposed = family.service_propose(before, frame['frame_rows'], inputs, 600 - (cursor - boundary), reference['policy'])
            captured = prefix.get('fieldService'); assert captured and proposed
            family.bind(proposed, domain)
            assert captured['negativeZeroPaths'] == [] and prefix['sharedSeries']['fieldServiceAcquiredNegativeZeroPaths'] == []
            actual = captured['proposal']; extras = set(actual) - set(proposed)
            assert extras <= WRAPPER_KEYS and not (set(proposed) - set(actual)), extras
            provider = {key: value for key, value in actual.items() if key not in extras}
            own_check(plain(proposed), provider, f'provider.complete_envelope.{prefix_index}')
            assert prefix['family'] == 'public_occurrence_recall' and captured['stateNode'] == 'family_state:public_occurrence_recall'
            assert prefix['selectionGroup'] == 'window_constraints' and prefix['fieldSubquestion'] == 'field_service_composition'
            assert prefix['proposalKind'] == proposed['kind'] and prefix['operations'] == ['OP29', 'OP30', 'OP31']
            plan = proposed['nested_control_plan']; counts[proposed['kind'] + ':' + plan.get('phase', 'initial')] += 1
            offers.append({'prefixIndex': prefix_index, 'firstAction': cursor + 1, 'sourceProposalSha256': digest(proposed),
                           'nativeCanonicalSha256': helper.hashed(contracts.finite_canonical(provider).encode()),
                           'allProviderFieldsCompared': True, 'exactNumericAndIdentityMatch': True})
            annotations.append({'prefixIndex': prefix_index, 'fields': sorted(extras), 'sha256': digest({key: actual[key] for key in extras})})
            returned_events = prefix['sharedSeries']['fieldServiceAcquiredEvents']; offset = 0
            for index in range(prefix['acquiredActions']):
                earlier = trace['packets'][cursor]['packet']; later = trace['packets'][cursor + 1]['packet']
                b, a = observations[cursor], observations[cursor + 1]; command = trace['packets'][cursor + 1]['command']
                own_check(proposed['actions'][index], command, f'actual.command.{cursor + 1}')
                guard = family.before(proposed, index, SimpleNamespace(**earlier), b); assert guard['admitted'] is True
                outcome = family.after(proposed, index, b, a, earlier['frame_rows'], later['frame_rows'])
                acquired = family.record(b, a, command, earlier['frame_rows'], later['frame_rows'], proposed, index, frames=later['frame_packet'])
                original_events = contracts.own(acquired['events']); source_events.extend(original_events)
                chunk = returned_events[offset:offset + len(original_events)]; assert len(chunk) == len(original_events)
                own_check(original_events, chunk, f'own.acquisition.{cursor + 1}')
                for event in chunk: reconstructed.apply_event(copy.deepcopy(event))
                native_events.extend(chunk); offset += len(chunk)
                source_state = helper.state(family.memory); replay_state = helper.state(reconstructed)
                own_check(source_state['projection'], replay_state['projection'], f'own.state.{cursor + 1}')
                assert source_state['requestedStopReason'] == replay_state['requestedStopReason']
                projection = replay_state['projection']; parent = source_state['parentDigest']
                # Independently reconstructed own digest chain uses the supplied source ancestor digest.
                nested = helper.hashed(contracts.finite_canonical([parent, projection['nested_events']]).encode())
                fill = helper.hashed(contracts.finite_canonical([nested, projection['fill_events'], projection['fill_context']]).encode())
                service = helper.hashed(contracts.finite_canonical([fill, projection['service_events'], projection['service_context']]).encode())
                transfer = helper.hashed(contracts.finite_canonical([service, projection['transfer_events'], projection['transfer_model'], projection['transfer_context']]).encode())
                assert [nested, fill, service, transfer] == [source_state[key] for key in ['nestedDigest', 'fillDigest', 'serviceDigest', 'digest']]
                checks.append({'actionIndex': cursor + 1, 'prefixIndex': prefix_index, 'sourceBeforeGuard': plain(guard), 'sourceAfterOutcome': plain(outcome),
                               'ownEvents': len(original_events), 'eventsCanonicalSha256': digest(original_events),
                               'stateCanonicalSha256': digest(source_state['projection']), 'requestedStopReason': source_state['requestedStopReason'],
                               'sourceParentDigest': parent, 'ownDigestsFromNativeAcquisitions': {'nested': nested, 'fill': fill, 'service': service, 'transfer': transfer},
                               'eventsAndReconstructedOwnStateMatch': True})
                cursor += 1
                if a['levels_completed'] > b['levels_completed']: boundary = cursor
            assert offset == len(returned_events) and prefix['sharedSeries']['fieldServiceEventCount'] == len(native_events)
            own_check(native_events[-1] if native_events else None, prefix['sharedSeries']['fieldServiceLatestEvent'], f'latest.event.{prefix_index}')
            assert prefix['callerAcquiredTransitions'] == cursor
    finally: sys.setprofile(None)
    assert not contracts.PENDING and cursor == 28 and len(source_events) == len(native_events) == 63
    assert helper.verify_source_manifest() == helper.VERIFIED_PINNED_SOURCE
    for recipe in contracts.RECIPES.values():
        assert recipe['sourceCanonical'] == contracts.finite_canonical(recipe['value']) == recipe['nativeCanonical']
        assert helper.hashed(recipe['sourceCanonical'].encode()) == recipe['sourceHash'] == recipe['nativeHash']
    identity_bundle = {'schema': 'logos-engine.v51.service-derived-identities.v1', 'sourceCommit': helper.COMMIT,
                       'qualification': reference['qualification'], 'recipes': list(contracts.RECIPES.values()),
                       'numericInputScope': 'Own identity operands actually traced on this public campaign: exactly representable safe integers, text, booleans, null and collections. No float operand or signed zero occurred.',
                       'sourceInputHashesVerified': True, 'nativeInputHashesIndependentlyRecomputed': True,
                       'allCheckedOwnIdentityBytesEqual': True, 'identifierSubstitution': False, 'recipeCount': len(contracts.RECIPES)}
    identity_bytes = gzip.compress(packed(identity_bundle), mtime=0)
    identity_path = OUT / 'valv-service-identity-recipes.json.gz'
    identity_proof = {'path': identity_path.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(identity_bytes).hexdigest(), 'bytes': len(identity_bytes)}
    report = {'schema': 'logos-engine.v51.service-public-component-comparison.v1', 'status': 'passed',
              'comparisonConclusion': 'complete_own_provider_fields_and_actual_acquisitions_match_exactly_on_checked_integer_identity_domain',
              'originalFullCommonCallerParity': False, 'rawPythonNativeIdentityParity': True,
              'rawIdentityParityScope': 'Only the checked own source identity recipes on this trace; no general Python float or ancestor identity claim.',
              'generalPythonFloatIdentityParity': False, 'nativeFullGraphDigestParity': False, 'universalDecisionParity': False,
              'recordedPublicTrajectoriesEquivalent': True,
              'inputs': {'sourceComponentCampaign': proof(probe_path), 'sourceContracts': proof(reference_path), **{name: proof(path) for name, path in paths.items()}},
              'generator': proof(Path(__file__)), 'identityEvidence': identity_proof,
              'summary': {'nativeActions': cursor, 'sourceSubsetActions': 28, 'levelsCompleted': 3, 'officialState': campaign['final']['state'],
                          'enteredLevel': campaign['final']['level'], 'nativePrefixes': 28, 'sourceSubsetPrefixes': 28,
                          'nativeCompletePublicPackets': len(packets), 'nativePublicFramesIncludingInitial': sum(p['frames'] for p in packets),
                          'exactCommonInitialCommands': 28, 'exactCommonInitialPackets': 29, 'sourceProviderProposalsCompared': len(offers),
                          'ownAcquiredEventsCompared': len(native_events), 'ownEventKinds': dict(Counter(e['kind'] for e in native_events)),
                          'foreignPrefixes': 0, 'foreignActions': 0, 'stateReconstructions': len(checks), 'ownDigestLayersPerState': 4,
                          'identityRecipes': len(contracts.RECIPES), 'explicitNegativeZeroPathsRestored': 0,
                          'nativePerLevelActions': [10, 10, 8], 'sourcePerLevelActions': [10, 10, 8]},
              'sourceVerification': {'commit': helper.COMMIT, 'allPinnedFilesVerifiedBefore': 1786, 'allPinnedFilesVerifiedAfter': 1786,
                                     'sourceHashes': helper.source_hashes(), 'sourceUnchanged': True},
              'nativeVerification': {'nativeSourceFiles': native['fileCount'], 'sourceDigest': native['digest'], 'sourceUnchangedDuringRun': True,
                                     'executionExitCode': 0, 'reportTraceLogsAndInventoryVerified': True, 'pythonAgentModules': []},
              'publicEvidence': {'fields': sorted(PUBLIC_FIELDS), 'packets': packets, 'firstTrajectoryDivergence': None},
              'componentReplay': {'observationNamespace': scope, 'proposalKindsAndPhases': dict(counts), 'proposals': offers, 'transitions': checks,
                                  'foreignProviders': [], 'nativeCallerAnnotationsOutsideProvider': annotations, 'absoluteNumericTolerance': 0,
                                  'identityProjection': 'None. Every source and native own identity input is independently checked in the qualified safe integer domain; exact canonical bytes and hashes agree.',
                                  'stateScope': 'Original own states are recomputed from actual public transitions and compared with independent Python reconstruction from native own events after every acquired action. Four own digest layers are independently recomputed using the source ancestor digest. Native full graph/ancestor state and original full caller ordering remain outside this claim.',
                                  'selectionScope': 'All 28 selected own offers on this actual trace are compared. The complete native and isolated original public trajectories also match. This does not prove full original strategy selection for other games or observations.',
                                  'quantityScope': reference['qualification']['quantities']}}
    return report, identity_path, identity_bytes

def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--verify', action='store_true'); args = parser.parse_args()
    output = OUT / 'valv-original-component-comparison.json'
    report, identity_path, identity_bytes = compare(); encoded = (json.dumps(report, ensure_ascii=False, indent=2) + '\n').encode()
    if args.verify:
        assert output.read_bytes() == encoded, 'Retained comparison differs from recomputation'
        assert identity_path.read_bytes() == identity_bytes, 'Retained identity proof differs from recomputation'
    else:
        assert not output.exists() and not identity_path.exists(), 'Do not overwrite retained comparison evidence'
        identity_path.write_bytes(identity_bytes); output.write_bytes(encoded)
    print(json.dumps({'status': 'passed', 'mode': 'verify' if args.verify else 'create', 'output': output.relative_to(ROOT).as_posix(), 'summary': report['summary']}), flush=True)

if __name__ == '__main__': main()
