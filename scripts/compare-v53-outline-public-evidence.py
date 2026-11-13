#!/usr/bin/env python3
"""Recompute original OutlineService on a complete actual public trajectory.

No host, native agent or test suite is executed. The selected original proposal
is reconstructed before each owned prefix, and its actual selected/foreign
acquisition is recomputed once for every return. Failed campaigns retain their
failure status. All large comparison output is gzip from its first write.
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
import tarfile
from types import SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('outline_original_contracts', ROOT / 'scripts/export-v6-outline-service-reference.py')
contracts = importlib.util.module_from_spec(spec); spec.loader.exec_module(contracts)
helper = contracts.helper
sys.path.insert(0, str(helper.SOURCE / 'agents/yf_arc3_v6/laya_proto'))
from neutral_observer import measure as observe

PUBLIC_FIELDS = {'frame_rows', 'frame_packet', 'level', 'levels_completed', 'state', 'step_index', 'available_action_refs', 'frame_hash'}
WRAPPER_KEYS = {'material_access_subquestion', 'field_subquestion', 'composition_target_tree', 'morphology', 'strategy_receipt'}
SOURCE_RECEIPT_KEYS = {'workflow', 'src_hash', 'src_status', 'executed_statements'}
NATIVE_RECEIPT_KEYS = {'all_executed_statements', 'instruction_quantum', 'instructions', 'trace', 'execution_engine',
                       'reference_commit', 'reference_semantic_hash', 'native_execution_hash', 'source_definition_hash', 'edited'}
BARE_DISCRETE_FOREIGN_PROVIDERS = {'observed_frontier', 'pre_score_contact', 'view'}
OBSERVATION_REF = re.compile(r'^(.*):epoch:(\d+):revision:(\d+):frame:([a-f0-9]+)$')
ANNOTATIONS = []
DIFFERENCES = []
RETAIN_DIFFERENCES = False
ARCHIVED_PROOFS = {}


def sha(path):
    value = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''): value.update(chunk)
    return value.hexdigest()


def proof(path):
    path = Path(path)
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path), 'bytes': path.stat().st_size}


def load(path):
    path = Path(path)
    if path.suffix == '.gz':
        with gzip.open(path, 'rt', encoding='utf-8') as stream: return json.load(stream)
    return json.loads(path.read_text())


def packed(value): return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()
def digest(value): return hashlib.sha256(packed(value)).hexdigest()
def plain(value): return contracts.plain(value)
def packet_hash(value): return hashlib.sha256(json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()


def check(actual, expected, path):
    if packed(actual) == packed(expected): return
    if isinstance(actual, dict) and isinstance(expected, dict) and set(actual) == set(expected):
        for key in actual: check(actual[key], expected[key], path + '.' + key)
    elif isinstance(actual, list) and isinstance(expected, list) and len(actual) == len(expected):
        for index, (a, b) in enumerate(zip(actual, expected)): check(a, b, path + f'.{index}')
    raise AssertionError({'path': path, 'actual': actual, 'expected': expected})


def differences(actual, expected, path):
    if packed(actual) == packed(expected): return
    if isinstance(actual, dict) and isinstance(expected, dict) and set(actual) == set(expected):
        for key in sorted(actual): differences(actual[key], expected[key], path + '.' + key)
    elif isinstance(actual, list) and isinstance(expected, list) and len(actual) == len(expected):
        for index, (a, b) in enumerate(zip(actual, expected)): differences(a, b, path + f'.{index}')
    else:
        DIFFERENCES.append({'path': path, 'native': actual, 'original': expected})


def source_projection(value, path):
    if isinstance(value, list): return [source_projection(child, path + f'.{index}') for index, child in enumerate(value)]
    if not isinstance(value, dict): return value
    if SOURCE_RECEIPT_KEYS <= value.keys():
        extras = set(value) - SOURCE_RECEIPT_KEYS
        assert extras <= NATIVE_RECEIPT_KEYS, (path, sorted(extras))
        if extras:
            assert path.endswith('.workflow') or path.endswith('.control_workflow'), ('Unqualified SRC metadata path', path)
            assert value['execution_engine'] == 'logos-engine.typescript' and value['reference_commit'] == helper.COMMIT
            assert value['instruction_quantum'] == 128 and isinstance(value['instructions'], int) and value['instructions'] > 0
            assert value['trace'] and len(value['all_executed_statements']) >= len(value['executed_statements'])
            assert re.fullmatch('[a-f0-9]{64}', value['reference_semantic_hash'])
            if 'native_execution_hash' in value:
                assert value['edited'] is False and value['source_definition_hash'] == value['src_hash']
                assert re.fullmatch('[a-f0-9]{64}', value['native_execution_hash'])
            ANNOTATIONS.append({'path': path, 'fields': sorted(extras), 'sha256': digest({key: value[key] for key in sorted(extras)})})
        return {key: source_projection(value[key], path + '.' + key) for key in SOURCE_RECEIPT_KEYS}
    return {key: source_projection(child, path + '.' + key) for key, child in value.items()}


def own_check(native, source, path):
    projected, expected = source_projection(native, path), plain(source)
    left, right = contracts.finite_canonical(projected), contracts.finite_canonical(expected)
    if left != right:
        if not RETAIN_DIFFERENCES: check(projected, expected, path)
        differences(projected, expected, path)
        return None
    return hashlib.sha256(left.encode()).hexdigest()


def native_inventory():
    return dict(sorted((path.relative_to(ROOT).as_posix(), sha(path))
                       for folder in ['src/logos-engine', 'src/runtime'] for path in (ROOT / folder).rglob('*')
                       if path.is_file() and path.suffix in ['.ts', '.json', '.drm']))


def verify_input(paths, game, allow_failed):
    campaign, trace, execution, source = [load(paths[key]) for key in ['campaign', 'trace', 'execution', 'source']]
    assert campaign['status'] == trace['status'] and campaign['game'] == trace['game'] == game
    assert campaign['status'] == 'passed' or (allow_failed and campaign['status'] == 'failed')
    assert campaign['referenceCommit'] == helper.COMMIT and campaign['pythonAgentModules'] == []
    assert campaign['sourceUnchangedDuringRun'] is True and trace['sourceDigest'] == source['digest']
    assert source['fileCount'] == len(source['files']) and source['digest'] == digest(source['files'])
    check(campaign['source'], source, 'campaign.source')
    archive_manifest = load(paths['archiveManifest'])
    assert archive_manifest['schema'] == 'logos-engine.v53.frozen-source-archive.v1'
    assert archive_manifest['nativeSourceManifestDigest'] == source['digest']
    check(proof(paths['archive']), archive_manifest['archive'], 'frozen.archive.bytes')
    archived_hashes = {}
    with tarfile.open(paths['archive'], 'r:gz') as archive:
        for member in archive:
            assert member.isfile() and member.name not in archived_hashes
            stream = archive.extractfile(member)
            value = hashlib.sha256()
            for chunk in iter(lambda: stream.read(1024 * 1024), b''): value.update(chunk)
            archived_hashes[member.name] = value.hexdigest()
            ARCHIVED_PROOFS[member.name] = {'path': member.name, 'sha256': value.hexdigest(), 'bytes': member.size}
    check(archived_hashes, archive_manifest['files'], 'frozen.archive.all.members')
    check({name: archived_hashes[name] for name in source['files']}, source['files'], 'frozen.native.source')
    assert execution['schema'] == 'logos-engine.v53.actual-journaled-campaign-execution.v1'
    assert execution['exitCode'] == (0 if campaign['status'] == 'passed' else 1)
    assert execution['nativeSourceUnchanged'] is True and execution['executionCodeUnchanged'] is True
    check(execution['nativeSource'], source, 'execution.source.before')
    check(execution['nativeSourceAfter'], source, 'execution.source.after')
    assert execution['nativeSourceManifestDigest'] == source['digest']
    check(execution['executionInputs'], execution['executionInputsAfter'], 'execution.inputs.unchanged')
    for name, item in execution['executionInputs'].items(): check(ARCHIVED_PROOFS[item['path']], item, 'execution.input.' + name)
    for key in ['campaign', 'trace']:
        receipt_name = 'report' if key == 'campaign' else key
        check(execution[receipt_name], proof(paths[key]), 'execution.' + receipt_name)
    for key in ['output', 'publicJournal']: check(execution[key], proof(ROOT / execution[key]['path']), 'execution.' + key)
    command = execution['command']
    assert command[:4] == ['node', str(ROOT / 'scripts/run-v53-journaled-campaign.mjs'), game, str(campaign['targetLevels'])]
    assert command[4:6] == [str(paths['campaign']), str(paths['trace'])] and len(command) == 7
    with gzip.open(ROOT / execution['publicJournal']['path'], 'rt') as stream:
        journal = [json.loads(line) for line in stream]
    check(journal, trace['packets'], 'complete.public.journal')
    with gzip.open(ROOT / execution['output']['path'], 'rt') as stream: lines = stream.read().splitlines()
    last = json.loads(lines[-1])
    assert last['status'] == campaign['status'] and last['sourceDigest'] == source['digest']
    check(last['final'], campaign['final'], 'output.final')
    check(last['boundaries'], campaign['boundaries'], 'output.boundaries')
    assert campaign['final']['sessions'] == 1 and campaign['final']['fullV6Parity'] is False
    assert campaign['final']['actions'] == len(campaign['actions']) == len(trace['packets']) - 1
    assert campaign['final']['prefixes'] == len(campaign['prefixes'])
    assert sum(prefix['acquiredActions'] for prefix in campaign['prefixes']) == len(campaign['actions'])
    assert campaign['final']['caller']['acquiredTransitions'] == len(campaign['actions'])
    if campaign['status'] == 'passed': assert campaign['final']['levelsCompleted'] >= campaign['targetLevels']
    else: assert campaign['failure'] and campaign['final']['levelsCompleted'] < campaign['targetLevels']
    packets = []
    for index, item in enumerate(trace['packets']):
        packet = item['packet']
        assert set(packet) == PUBLIC_FIELDS and packet['step_index'] == index
        assert packet['frame_hash'] == hashlib.sha256(json.dumps(packet['frame_rows'], separators=(',', ':')).encode()).hexdigest()[:16]
        if index:
            action = campaign['actions'][index - 1]
            check(item['command'], action['command'], f'physical.command.{index}')
            assert action['sequence'] == index and action['publicPacketSha256'] == packet_hash(packet)
            assert action['animationFrames'] == len(packet['frame_packet']) and action['frameHash'] == packet['frame_hash']
            assert (action['levelAfter'], action['completedAfter'], action['state']) == (packet['level'], packet['levels_completed'], packet['state'])
        else:
            assert item['command'] is None and packet_hash(packet) == campaign['initial']['publicPacketSha256']
        packets.append({'packetIndex': index, 'publicPacketSha256': packet_hash(packet), 'canonicalPacketSha256': digest(packet), 'frames': len(packet['frame_packet'])})
    for name, expected in campaign['gameAssets'].items(): assert sha(ROOT / 'public/python' / name) == expected
    return campaign, trace, execution, source, packets


def retained_scope(campaign):
    scopes = set()
    def scan(value):
        if isinstance(value, str):
            match = OBSERVATION_REF.fullmatch(value)
            if match: scopes.add(match.group(1))
        elif isinstance(value, dict):
            for child in value.values(): scan(child)
        elif isinstance(value, list):
            for child in value: scan(child)
    for prefix in campaign['prefixes']:
        scan(prefix['outlineAcquisition'])
        scan(prefix.get('outlineService'))
        scan(prefix.get('sharedSeries', {}).get('epochAnchors', []))
    assert len(scopes) == 1, ('Expected one actual cold observation scope', sorted(scopes))
    return next(iter(scopes))


def compare(paths, game, allow_failed):
    campaign, trace, execution, native, packet_checks = verify_input(paths, game, allow_failed)
    reference_path = ROOT / 'tests/fixtures/v6-outline-service-reference.json.gz'
    reference = load(reference_path)
    assert reference['sourceCommit'] == helper.COMMIT and reference['sourceUnchanged'] is True
    assert reference['sourceFilesVerifiedBeforeImport'] == reference['sourceFilesVerifiedAfterExport'] == 1786
    for key in ['generator', 'probe', 'initialPublicCorpus']:
        check(proof(ROOT / reference[key]['path']), reference[key], 'reference.' + key)
    scope = retained_scope(campaign)
    observations = [observe(SimpleNamespace(**item['packet']), index + 1, scope)[0] for index, item in enumerate(trace['packets'])]
    family = helper.OutlineService()
    initial_state = plain(family.state())
    check(initial_state, reference['initialState'], 'cold.source.state')
    cursor = boundary = 0
    counts, prefix_checks, acquisition_checks, proposals, wrappers = Counter(), [], [], [], []
    first_control, selected_local_events = None, []
    sys.setprofile(contracts.profile)
    try:
        for prefix_index, prefix in enumerate(campaign['prefixes']):
            if prefix_index % 10 == 0:
                print(json.dumps({'phase': 'original_outline_public_replay', 'prefix': prefix_index, 'prefixes': len(campaign['prefixes']), 'returns': cursor}), file=sys.stderr, flush=True)
            first_action = cursor + 1
            observation = observations[cursor]
            packet = trace['packets'][cursor]['packet']
            owned = prefix.get('outlineService')
            selected = None
            if owned:
                assert prefix['family'] == 'public_outline_service' and prefix['selectionGroup'] == 'factored_material_return'
                assert prefix['materialSubquestion'] == 'observed_outline_service' and owned['stateNode'] == 'family_state:public_outline_service'
                remaining = campaign['budget']['levelActionCaps'][min(observation['level_epoch'] - 1, len(campaign['budget']['levelActionCaps']) - 1)] - (cursor - boundary)
                selected = family.propose(observation, packet['frame_rows'], [], remaining)
                assert selected is not None, ('Original abstains on selected Outline prefix', prefix_index)
                family.bind(selected, None)
                actual = owned['proposal']; extras = set(actual) - set(selected)
                assert extras <= WRAPPER_KEYS and not (set(selected) - set(actual)), (prefix_index, extras)
                provider = {key: value for key, value in actual.items() if key not in extras}
                proposal_hash = own_check(provider, selected, f'proposal.{prefix_index}')
                wrappers.append({'prefixIndex': prefix_index, 'fields': sorted(extras), 'sha256': digest({key: actual[key] for key in sorted(extras)})})
                proposals.append({'prefixIndex': prefix_index, 'firstAction': first_action, 'proposal': plain(selected),
                                  'sourceAndNativeProjectionSha256': proposal_hash, 'allProviderFieldsCompared': True})
                counts['selectedOutlinePrefixes'] += 1
                counts['selected:' + selected['outline_plan']['meaning']['kind']] += 1
            else:
                assert prefix['family'] != 'public_outline_service'
                counts['foreignPrefixes'] += 1
            retained = prefix['outlineAcquisition']
            assert retained['stateNode'] == 'family_state:public_outline_service' and retained['checkpointFormat'] == 'native.public_outline_service.v1'
            assert prefix['decisionRevision'] == observation['revision']
            offset = 0
            for index in range(prefix['acquiredActions']):
                first, second = trace['packets'][cursor]['packet'], trace['packets'][cursor + 1]['packet']
                before, after = observations[cursor:cursor + 2]
                physical = trace['packets'][cursor + 1]['command']
                if selected:
                    command = copy.deepcopy(selected['actions'][index])
                elif physical['action_ref'] != 'ACTION6':
                    # These actual providers construct bare discrete commands.
                    # The host adapter adds data:{} only to its public journal.
                    # Keep this finite audited transport rule separate from
                    # the independently recomputed seven-field source state.
                    assert prefix['family'] in BARE_DISCRETE_FOREIGN_PROVIDERS, ('Unaudited discrete command provider', prefix['family'])
                    assert set(physical) == {'action_ref', 'data'} and physical['data'] == {}
                    command = {'action_ref': physical['action_ref']}
                else:
                    command = copy.deepcopy(physical)
                # The public host envelope always carries empty data for a
                # discrete action; the source-selected plan need not carry it.
                expected_physical = {'action_ref': command['action_ref'], 'data': command.get('data', {})}
                check(physical, expected_physical, f'host.command.envelope.{cursor + 1}')
                guard = outcome = None
                if selected:
                    guard = family.before(selected, index, SimpleNamespace(**first), before)
                    assert guard['admitted'], ('Source guard refuses actual selected action', cursor + 1, guard)
                    outcome = family.after(selected, index, before, after, first['frame_rows'], second['frame_rows'])
                    if outcome.get('seal_prefix'):
                        assert index + 1 == prefix['acquiredActions'], ('Actual prefix continues beyond original seal', cursor + 1)
                    counts['recomputedAdmittedSourceGuards'] += 1
                    counts['recomputedSourceOutcomes'] += 1
                observed = family.record(before, after, command, first['frame_rows'], second['frame_rows'], selected, index)
                if selected or observed is not None:
                    fact = retained['acquired'][offset]; offset += 1
                    assert fact['key'] == 'outline_service_event:' + str(before['revision'])
                    assert fact['evidence'] == after['observation_ref'] and fact['revision'] == after['revision']
                    own_check(fact['result'], observed, f'acquisition.{cursor + 1}')
                    counts['retainedAcquisitionFacts'] += 1
                if observed is not None:
                    counts['sourceNonNullEvents'] += 1
                    counts['event:' + observed['status']] += 1
                    if selected and selected['outline_plan']['operator']:
                        selected_local_events.append({'actionIndex': cursor + 1, 'prefixIndex': prefix_index, 'event': plain(observed)})
                if first_control is None and family.control is not None:
                    first_control = {'actionIndex': cursor + 1, 'observation_ref': after['observation_ref'], 'control': plain(family.control)}
                acquisition_checks.append({'actionIndex': cursor + 1, 'prefixIndex': prefix_index, 'owned': selected is not None,
                                           'actualComponentCommand': command, 'physicalTransportCommand': physical,
                                           'sourceGuard': plain(guard), 'sourceOutcome': plain(outcome),
                                           'sourceAcquisition': plain(observed), 'sourceStateSha256': digest(plain(family.state()))})
                counts['sourceAcquisitionCalls'] += 1
                cursor += 1
                if after['levels_completed'] > before['levels_completed']: boundary = cursor
            assert offset == len(retained['acquired']), ('Unexpected additional Outline facts', prefix_index, offset, len(retained['acquired']))
            state_digest = own_check(retained['sourceState'], family.state(), f'source.state.{prefix_index}')
            own_check(retained['nativeCheckpoint'], {'format': 'native.public_outline_service.v1', 'source_state': family.state()}, f'checkpoint.{prefix_index}')
            prefix_checks.append({'prefixIndex': prefix_index, 'firstAction': first_action, 'lastAction': cursor,
                                  'owned': selected is not None, 'sourceAndNativeStateSha256': state_digest,
                                  'sourceStateFields': sorted(family.state()), 'retainedAcquisitionFacts': offset,
                                  'completeNativeCheckpointCompared': True})
        assert cursor == campaign['final']['actions']
        final_state = plain(family.state())
        final_measurement = contracts.capture(lambda: family.measure(observations[-1], trace['packets'][-1]['packet']['frame_rows']))
        check(plain(family.state()), final_state, 'final.measurement.readonly')
    finally:
        sys.setprofile(None)
    helper.AUDIT_ACTIVE = False
    assert not contracts.PENDING and helper.verify_source_manifest() == helper.VERIFIED_SOURCE
    check(proof(paths['archive']), load(paths['archiveManifest'])['archive'], 'frozen.archive.after')
    footprint = helper.source_footprint()
    recipes = [contracts.RECIPES[key] for key in sorted(contracts.RECIPES)]
    comparison = {'schema': 'logos-engine.v53.outline-original-public-comparison.v1', 'status': 'failed' if DIFFERENCES else 'passed',
                  'game': game, 'nativeCampaignStatus': campaign['status'], 'nativeCompletedLevels': campaign['final']['levelsCompleted'],
                  'nativeFinalState': campaign['final'].get('state'), 'nativeSourceDigest': native['digest'], 'nativeSourceFiles': native['fileCount'],
                  'referenceCommit': helper.COMMIT, 'sourceFilesVerifiedBeforeImport': 1786, 'sourceFilesVerifiedAfterComparison': 1786,
                  'sourceUnchanged': True, 'nativeSourceUnchangedDuringCampaign': True, 'frozenNativeSourceArchiveVerified': True,
                  'inputs': {key: proof(path) for key, path in paths.items()}, 'originalReference': proof(reference_path),
                  'generator': proof(Path(__file__)), 'observationScope': scope, 'counts': dict(sorted(counts.items())),
                  'publicPacketsCompared': len(packet_checks), 'animationFramesIncludingInitial': sum(row['frames'] for row in packet_checks),
                  'packetChecks': packet_checks, 'completePublicJournalMatched': True,
                  'coldInitialState': initial_state, 'prefixChecks': prefix_checks, 'proposals': proposals,
                  'callerWrapperAnnotations': wrappers, 'acquisitionChecks': acquisition_checks,
                  'firstAcquiredControl': first_control, 'selectedLocalOperatorEvents': selected_local_events,
                  'finalSourceState': plain(family.state()), 'nativeSrcAnnotations': ANNOTATIONS,
                  'finalSourceMeasurement': plain(final_measurement),
                  'differences': DIFFERENCES, 'differenceCount': len(DIFFERENCES),
                  'sourceReceiptFieldsCompared': sorted(SOURCE_RECEIPT_KEYS), 'allowedNativeSrcAnnotationFields': sorted(NATIVE_RECEIPT_KEYS),
                  'physicalCommandTransport': {'discreteHostEnvelopeAddsEmptyData': True,
                                               'auditedBareDiscreteForeignProviders': sorted(BARE_DISCRETE_FOREIGN_PROVIDERS),
                                               'providerConstructionFiles': [ARCHIVED_PROOFS[name] for name in [
                                                   'src/logos-engine/v6-observed-frontier.ts', 'src/logos-engine/v6-effect-access.ts',
                                                   'src/logos-engine/v6-view-frontier.ts']],
                                               'hostEnvelopeFile': ARCHIVED_PROOFS['tests/helpers/v6-live-game-campaign.ts']},
                  'qualifiedIdentityRecipeCount': len(recipes), 'footprint': footprint,
                  'qualification': {'gameHostRunByComparator': False, 'nativeAgentRunByComparator': False, 'testSuiteRunByComparator': False,
                                    'nativeOutputsUsedAsExpected': False, 'fullOriginalCallerParity': False,
                                    'fullOriginalCampaignReplayed': False, 'identifierSubstitution': False,
                                    'sourceGuardsAndOutcomesRecomputed': True, 'sourceGuardsAndOutcomesComparedToAbsentRawEvidence': False,
                                    'scope': 'All selected provider fields, every original acquisition and each seven-field checkpoint are compared using actual retained public packets and the actual selected Outline plan. Original guards/outcomes are recomputed and checked for compatibility with dispatch/sealing; the harness does not retain their ordinary raw native values. Caller wrapper fields and qualified SRC execution annotations are inventoried separately. Empty data in the physical discrete-action host envelope is explicit. No cold memory, new action, game success or original full caller parity is created by this read-only comparison.'}}
    return comparison, recipes


def main():
    global RETAIN_DIFFERENCES
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory')
    parser.add_argument('game')
    parser.add_argument('--allow-failed-campaign', action='store_true')
    parser.add_argument('--verify', action='store_true')
    parser.add_argument('--retain-differences', action='store_true', help='Write an explicitly failed full comparison instead of stopping at the first mismatch.')
    args = parser.parse_args()
    RETAIN_DIFFERENCES = args.retain_differences
    out = ROOT / args.directory; stem = args.game.lower()
    paths = {'campaign': out / (stem + '-campaign.json.gz'), 'trace': out / (stem + '-public-trace.json.gz'),
             'execution': out / ('execution-' + stem + '.json'), 'source': out / 'source-manifest.json',
             'archiveManifest': out / 'source-archive.json', 'archive': out / 'source-archive.tar.gz'}
    output, identity_path = out / 'outline-service-original-comparison.json.gz', out / 'outline-service-identity-recipes.json.gz'
    if not args.verify: assert not output.exists() and not identity_path.exists(), 'Refusing to replace retained comparison evidence'
    comparison, recipes = compare(paths, args.game, args.allow_failed_campaign)
    identity_result = {'schema': 'logos-engine.v53.outline-public-identity-recipes.v1', 'sourceCommit': helper.COMMIT,
                       'nativeSourceDigest': comparison['nativeSourceDigest'], 'generator': proof(Path(__file__)),
                       'recipes': recipes, 'scope': 'Observed calls to unchanged original Outline digest and V5 component stable_digest on actual public inputs; independently spelled safe-integer JSON only.'}
    if args.verify:
        check(load(identity_path), identity_result, 'retained.identity.recipes')
        comparison['identityRecipes'] = proof(identity_path)
        check(load(output), comparison, 'retained.original.comparison')
    else:
        helper.write_gzip_absent(identity_path.relative_to(ROOT).as_posix(), identity_result)
        comparison['identityRecipes'] = proof(identity_path)
        helper.write_gzip_absent(output.relative_to(ROOT).as_posix(), comparison)
    print(json.dumps({'status': comparison['status'], 'mode': 'verify' if args.verify else 'create', 'game': args.game,
                      'nativeCampaignStatus': comparison['nativeCampaignStatus'], 'nativeCompletedLevels': comparison['nativeCompletedLevels'],
                      'publicPackets': comparison['publicPacketsCompared'], 'prefixes': len(comparison['prefixChecks']),
                      'qualifiedIdentityRecipes': len(recipes), 'differenceCount': comparison['differenceCount'],
                      **comparison['counts'], 'output': output.relative_to(ROOT).as_posix()}), flush=True)
    if DIFFERENCES: raise SystemExit(1)


if __name__ == '__main__':
    main()
