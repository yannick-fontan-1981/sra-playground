#!/usr/bin/env python3
"""Compare the original Recruitment only on a verified sealed incomplete checkpoint.

Unlike the completed-campaign comparator, this reader requires a wrapper
execution receipt, its unchanged pre/post inputs and their original archive.
It leaves every later observed public return separate and never adds final or
sourceUnchangedDuringRun to the actual running checkpoint report.
"""
from __future__ import annotations
import argparse
from collections import Counter
from datetime import datetime, timezone
import fcntl
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import tarfile
import tempfile
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('recruitment_public_parity', ROOT / 'scripts/compare-ordered-recruitment-public-parity.py')
parity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parity)


def retained(record):
    parity.require(isinstance(record, dict) and set(record) == {'path', 'bytes', 'sha256'}, 'Malformed evidence fingerprint')
    path = (ROOT / record['path']).resolve()
    parity.require(path.is_relative_to(ROOT), 'Evidence fingerprint escapes the repository')
    parity.require(parity.fingerprint(path) == record, 'Retained evidence changed: ' + record['path'])
    return path


def current_native(expected):
    names = set()
    for folder in ('src/logos-engine', 'src/runtime'):
        names.update(path.relative_to(ROOT).as_posix() for path in (ROOT / folder).rglob('*')
                     if path.is_file() and path.suffix in ('.ts', '.json', '.drm'))
    parity.require(names == set(expected['files']) and expected['fileCount'] == len(names),
                   'Current native inventory differs from the historical checkpoint')
    for name in sorted(names):
        parity.require(parity.fingerprint(ROOT / name)['sha256'] == expected['files'][name],
                       'Current native member differs from the checkpoint: ' + name)
    return {'filesVerified': len(names), 'capturedDigest': expected['digest'],
            'membersDigest': parity.digest(expected['files'])}


def verify_archive(preflight, before, after):
    archive_path = retained(preflight['sourceArchive'])
    archive = parity.read_json(archive_path)
    parity.require(archive.get('schema') == 'logos-engine.v53.frozen-source-archive.v1'
        and archive.get('nativeSourceManifestDigest') == before['nativeSource']['digest'],
        'Historical archive is not bound to the native preflight')
    parity.require(archive.get('archive') == preflight.get('archiveArtifact'), 'Preflight archive artifact differs')
    artifact = retained(archive['archive'])
    expected = archive['files']
    parity.require(isinstance(expected, dict) and expected, 'Missing historical archived inputs')
    found = {}
    with tarfile.open(artifact, 'r:*') as source:
        for member in source:
            if member.isdir():
                continue
            parity.require(member.isfile(), 'Historical source archive contains a non-file member')
            name = member.name.removeprefix('./')
            parity.require(name in expected and name not in found, 'Unexpected or duplicate archived member: ' + name)
            checksum = hashlib.sha256()
            stream = source.extractfile(member)
            parity.require(stream is not None, 'An archived file could not be read')
            with stream:
                for block in iter(lambda: stream.read(1024 * 1024), b''):
                    checksum.update(block)
            checksum = checksum.hexdigest()
            parity.require(checksum == expected[name], 'Historical archived bytes changed: ' + name)
            for snapshot in (before, after):
                parity.require(snapshot['fileFingerprints'].get(name, {}).get('sha256') == checksum,
                               'Historical pre/post snapshot differs from its archived member: ' + name)
            found[name] = checksum
    parity.require(set(found) == set(expected), 'Historical source archive is incomplete')
    return {'sourceArchive': preflight['sourceArchive'], 'archiveArtifact': archive['archive'],
        'archivedMembersVerified': len(found), 'membersDigest': parity.digest(found),
        'currentHistoricalHelpersRequiredToMatch': False,
        'qualification': 'Historical runner/wrapper/helper bytes are checked inside the original retained archive against both actual preflight and postflight. Later edits to those helpers are not mistaken for edits during the completed attempt.'}


def read_journal(path):
    records, malformed, trailing = [], [], 0
    opener = gzip.open if path.suffix == '.gz' else open
    with opener(path, 'rb') as stream:
        for number, line in enumerate(stream, 1):
            if not line.endswith(b'\n'):
                trailing = len(line)
                break
            try:
                row = json.loads(line, object_pairs_hook=parity.unique_object, parse_constant=parity.invalid_number)
                parity.require(isinstance(row, dict) and set(row) == {'command', 'packet'}, 'Malformed public journal record')
                parity.require(isinstance(row['packet'], dict) and set(row['packet']) == set(parity.PACKET_FIELDS), 'Incomplete public packet')
                records.append(row)
            except Exception as error:
                malformed.append({'line': number, 'error': parity.error_value(error)})
    return records, {'completeRecords': len(records), 'malformedCompleteRecords': malformed,
                     'trailingPartialBytes': trailing}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkpoint', required=True, type=Path)
    parser.add_argument('--journal', required=True, type=Path)
    parser.add_argument('--execution-receipt', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--case-contract', type=Path, default=ROOT / 'docs/migration/lot10c-evidence/case-contract.json')
    args = parser.parse_args()
    checkpoint_path, journal_path, execution_path, output = (value.resolve() for value in
        (args.checkpoint, args.journal, args.execution_receipt, args.output))
    parity.require(not output.exists() and output.is_relative_to(ROOT)
        and not output.is_relative_to(parity.SOURCE.parent) and output.name.endswith('.json.gz'), 'A new repository .json.gz output is required')
    report = {'schema': 'logos-engine.ordered-recruitment-checkpoint-source-parity.PARTIAL.v1',
        'recordedAt': datetime.now(timezone.utc).isoformat(), 'sourceCommit': parity.COMMIT,
        'completeCampaign': False, 'campaignSuccessEstablished': False, 'campaignFailureCauseEstablished': False,
        'gameHostRun': False, 'nativeAgentRun': False, 'originalCommonCallerRun': False, 'fullCallerParity': False,
        'qualification': 'Source parity is limited to the actual sealed incomplete checkpoint. Later complete public returns remain explicitly unacquired in this proof. No terminal campaign status, final result, sourceUnchangedDuringRun flag, completed target or SIGKILL cause is invented.',
        'clockQualification': 'Original per-projection monotonic is fixed externally at zero for finite-work comparison; native elapsed time is not reconstructed.'}
    paths = {'checkpoint': checkpoint_path, 'publicJournal': journal_path, 'executionReceipt': execution_path,
        'generator': Path(__file__).resolve(), 'caseContract': args.case_contract.resolve(), 'sharedComparisonCore': ROOT / 'scripts/compare-ordered-recruitment-public-parity.py'}
    executed = Counter()
    with Path('/workspace/shared/sra-coordination/performance.lock').open('a') as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_SH | fcntl.LOCK_NB)
        with tempfile.TemporaryDirectory(prefix='recruitment-partial-source-parity-') as cache:
            sys.pycache_prefix = cache
            report['bytecodeIsolation'] = {'dontWriteBytecode': True,
                'freshPrefixEmptyBefore': not any(Path(cache).rglob('*')), 'existingSourceBytecodeBefore': parity.existing_bytecode()}
            try:
                parity.diagnostic_progress('partial_input_fingerprints_started')
                report['inputs'] = {name: parity.fingerprint(path) for name, path in paths.items()}
                case_contract = parity.read_json(paths['caseContract'])
                parity.require(isinstance(case_contract, dict) and parity.re.fullmatch(r'[A-Z0-9]{4}', case_contract.get('game', ''))
                    and type(case_contract.get('targetLevels')) is int and case_contract['targetLevels'] > 0,
                    'The immutable actual case contract is required')
                game, target_levels = case_contract['game'], case_contract['targetLevels']
                report.update(game=game, targetLevels=target_levels,
                    caseContract={'fingerprint': report['inputs']['caseContract'], 'game': game, 'targetLevels': target_levels})
                execution = parity.read_json(execution_path)
                parity.require(execution.get('schema') == 'logos-engine.lot10c.recruitment-clocked-execution.v1'
                    and execution.get('game') == game and execution.get('targetLevels') == target_levels,
                    'The actual contract-bound Recruitment wrapper execution receipt is required')
                parity.require(execution.get('sourceInputsUnchanged') is True
                    and execution.get('finalExecutionEvidenceComplete') is False
                    and execution.get('campaignPassedEstablished') is False,
                    'This reader is limited to an actually incomplete unchanged-input execution')
                for path in (checkpoint_path, journal_path):
                    row = execution['artifacts'].get(path.name)
                    parity.require(row == parity.fingerprint(path), 'Partial input is not the exact wrapper-retained artifact: ' + path.name)
                before_path = retained(execution['artifacts']['preflight.json'])
                after_path = retained(execution['artifacts']['postflight.json'])
                before, after = parity.read_json(before_path), parity.read_json(after_path)
                for value, stage in ((before, 'before'), (after, 'after')):
                    parity.require(value.get('schema') == 'logos-engine.lot10c.recruitment-source-check.v1'
                        and value.get('stage') == stage and value.get('matchesDeclaredFreeze') is True
                        and value.get('errors') == [] and value.get('mismatchedPaths') == [], 'Actual historical source check did not pass')
                parity.require(before['fileFingerprints'] == after['fileFingerprints']
                    and before['nativeSource'] == after['nativeSource'], 'Actual pre/post execution inputs differ')
                contract_name = parity.path_label(paths['caseContract'])
                contract_capture = before['fileFingerprints'].get(contract_name)
                parity.require(contract_capture is not None
                    and contract_capture.get('sha256') == report['inputs']['caseContract']['sha256']
                    and contract_capture.get('bytes') == report['inputs']['caseContract']['bytes'],
                    'Actual case contract is not bound to the unchanged historical execution inputs')
                manifest_path = retained(before['sourceManifest'])
                parity.require(parity.read_json(manifest_path) == before['nativeSource'], 'Frozen source manifest differs from the actual preflight')
                report['historicalExecution'] = {'receipt': report['inputs']['executionReceipt'],
                    'startedAt': execution.get('startedAt'), 'captureFinishedAt': execution.get('captureFinishedAt'),
                    'attemptOutcome': execution.get('attemptOutcome'), 'exitCode': execution.get('exitCode'),
                    'termination': execution.get('termination'), 'elapsedSecondsThroughCapture': execution.get('elapsedSecondsThroughCapture'),
                    'preflight': execution['artifacts']['preflight.json'], 'postflight': execution['artifacts']['postflight.json'],
                    'frozenNativeManifest': before['sourceManifest'], 'actualFinal': execution.get('capture', {}).get('actualFinal'),
                    'finalExecutionEvidenceComplete': False, 'causeNotInferredFromExitSignal': True}
                parity.diagnostic_progress('historical_archive_verification_started')
                report['historicalArchiveBinding'] = verify_archive(before, before, after)
                historical_archive = parity.read_json(retained(before['sourceArchive']))
                parity.require(historical_archive['files'].get(contract_name) == report['inputs']['caseContract']['sha256'],
                    'Actual case contract is absent from the historical frozen archive')
                parity.diagnostic_progress('historical_archive_verification_completed')
                for name, path in (('preflight', before_path), ('postflight', after_path), ('frozenNativeManifest', manifest_path),
                    ('historicalSourceArchive', retained(before['sourceArchive'])), ('historicalArchiveArtifact', retained(before['archiveArtifact']))):
                    paths[name] = path
                report['inputs'] = {name: parity.fingerprint(path) for name, path in paths.items()}
                parity.diagnostic_progress('checkpoint_read_started')
                envelope = parity.read_json(checkpoint_path)
                parity.diagnostic_progress('checkpoint_read_completed')
                parity.require(envelope.get('schema') == 'logos-engine.lot10c.recruitment-campaign-checkpoint.v1'
                    and envelope.get('game') == game and envelope.get('targetLevels') == target_levels
                    and envelope.get('completeCampaign') is False, 'The actual incomplete checkpoint envelope is required')
                campaign = envelope['report']
                parity.require(campaign.get('schema') == 'logos-engine.v6.integrated-game-campaign.v1'
                    and campaign.get('game') == game and campaign.get('targetLevels') == target_levels and campaign.get('status') == 'running'
                    and 'final' not in campaign and 'sourceUnchangedDuringRun' not in campaign,
                    'The checkpoint was promoted or modified into a fictional final campaign')
                parity.require(campaign['source'] == before['nativeSource']
                    and execution['nativeSourceManifestDigest'] == campaign['source']['digest'], 'Checkpoint/native execution binding differs')
                parity.diagnostic_progress('historical_native_inventory_started')
                report['currentNativeBinding'] = current_native(campaign['source'])
                report['nativeDigest'] = campaign['source']['digest']
                parity.diagnostic_progress('public_journal_read_started')
                records, journal_summary = read_journal(journal_path)
                parity.diagnostic_progress('public_journal_read_completed', completeRecords=len(records))
                parity.require(not journal_summary['malformedCompleteRecords'], 'Malformed complete public journal records')
                parity.require(records and records[0]['command'] is None, 'Missing actual initial public return')
                for index, row in enumerate(records):
                    parity.require(row['packet']['step_index'] == index and (row['command'] is None) == (index == 0),
                                   'Public journal order or initial-command convention differs')
                sealed = len(campaign['actions'])
                parity.require(sealed > 0 and sum(row['acquiredActions'] for row in campaign['prefixes']) == sealed
                    and len(records) >= sealed + 1, 'Incomplete sealed-action/public-journal scope')
                last = campaign['prefixes'][-1]['orderedRecruitment']
                parity.require(last['sourceCallsThrough'] == len(campaign['recruitmentSourceCalls'])
                    and last['restoreCallsThrough'] == len(campaign['recruitmentRestoreCalls'])
                    and last['sourceDepthAtSnapshot'] == 0, 'Checkpoint capture extends beyond its last sealed prefix')
                captured = execution['capture']['lastCheckpoint']
                parity.require(captured['sequence'] == envelope['sequence'] and captured['recordedAt'] == envelope['recordedAt']
                    and captured['recordedActions'] == sealed and captured['recordedPrefixes'] == len(campaign['prefixes']),
                    'Wrapper checkpoint inventory differs from the actual envelope')
                parity.require(execution['capture']['publicJournal']['completeRecords'] == len(records)
                    and execution['capture']['publicJournal']['observedActionReturns'] == len(records) - 1
                    and execution['capture']['publicJournal']['trailingPartialBytes'] == journal_summary['trailingPartialBytes'],
                    'Wrapper public-journal inventory differs from the retained journal')
                report['partialScope'] = {'checkpointSequence': envelope['sequence'], 'checkpointRecordedAt': envelope['recordedAt'],
                    'capturedCampaignStatus': campaign['status'], 'sealedActions': sealed,
                    'sealedPrefixes': len(campaign['prefixes']), 'scopedSourceCalls': len(campaign['recruitmentSourceCalls']),
                    'scopedNativeRestores': len(campaign['recruitmentRestoreCalls']),
                    'officialLevelsCompletedAtCheckpoint': campaign['actions'][-1]['completedAfter'],
                    'levelAtCheckpoint': campaign['actions'][-1]['levelAfter'],
                    'officialLevelsCompletedAtLastJournalReturn': records[-1]['packet']['levels_completed'],
                    'levelAtLastJournalReturn': records[-1]['packet']['level'],
                    'observedLevelCountsQualification': 'Copied from actual public action/packet metadata. They are not a final campaign result or an inferred target completion.',
                    'journalObservedActionReturns': len(records) - 1, 'journal': journal_summary,
                    'laterPublicReturns': [{'journalIndex': index, 'command': row['command'],
                        'packetSha256': parity.packet_hash(row['packet']), 'publicFields': {key: row['packet'][key]
                            for key in ('level', 'levels_completed', 'state', 'step_index', 'frame_hash')},
                        'acquisitionWithinCheckpointEstablished': False}
                        for index, row in enumerate(records) if index > sealed],
                    'acquisitionAfterCheckpointNotReconstructed': True, 'finalFieldsAdded': False,
                    'nativeSourceUnchangedEstablishedBy': 'actual wrapper preflight/postflight plus archived historical inputs'}
                parity.diagnostic_progress('original_inventory_before_started')
                report['sourceBefore'] = parity.verify_originals()
                parity.diagnostic_progress('original_imports_started')
                sys.path[:0] = [str(parity.SOURCE), str(parity.SOURCE / 'agents/yf_arc3_v6/laya_proto')]
                from agents.yf_arc3_v6.morphology_policy.ordered_recruitment.family import OrderedRecruitment
                from agents.yf_arc3_v6.morphology_policy.ordered_recruitment import geometry, projection
                from agents.yf_arc3_v5.capabilities import mechanical_family_contracts_d as mechanical
                from neutral_observer import measure
                parity.diagnostic_progress('original_imports_completed')
                prefix = str(parity.SOURCE) + '/'
                def profile(frame, event, arg):
                    if event == 'call' and frame.f_code.co_filename.startswith(prefix):
                        executed[(frame.f_code.co_filename[len(prefix):], frame.f_code.co_firstlineno, frame.f_code.co_qualname)] += 1
                previous_profile = sys.getprofile()
                sys.setprofile(profile)
                try:
                    with patch.object(mechanical, 'monotonic', lambda: 0):
                        report['replay'] = parity.compare_campaign(campaign, None, OrderedRecruitment, measure, geometry, projection,
                            _checkpoint_scope={'schema': 'logos-engine.ordered-recruitment-verified-checkpoint-scope.v1',
                                'completeCampaign': False, 'historicalExecutionVerified': True,
                                'sealedActions': sealed, 'publicJournalPrefix': records[:sealed + 1]})
                finally:
                    sys.setprofile(previous_profile)
            except Exception as error:
                report['error'] = parity.error_value(error)
                parity.diagnostic_progress('partial_comparison_error', errorType=type(error).__name__)
            try:
                parity.diagnostic_progress('original_inventory_after_started')
                report['sourceAfter'] = parity.verify_originals()
                report['originalsUnchanged'] = report.get('sourceBefore') == report['sourceAfter']
                parity.diagnostic_progress('partial_input_fingerprints_after_started')
                report['inputsAfter'] = {name: parity.fingerprint(path) for name, path in paths.items()}
                report['inputsUnchanged'] = report.get('inputs') == report['inputsAfter']
                if report.get('currentNativeBinding'):
                    report['currentNativeBindingAfter'] = current_native(campaign['source'])
                    report['currentNativeUnchanged'] = report['currentNativeBinding'] == report['currentNativeBindingAfter']
            except Exception as error:
                report['verificationError'] = parity.error_value(error)
            isolation = report['bytecodeIsolation']
            isolation['freshPrefixEmptyAfter'] = not any(Path(cache).rglob('*'))
            isolation['existingSourceBytecodeAfter'] = parity.existing_bytecode()
            isolation['existingSourceBytecodeUnchanged'] = isolation['existingSourceBytecodeBefore'] == isolation['existingSourceBytecodeAfter']
            isolation['passed'] = all(isolation[name] is True for name in
                ('dontWriteBytecode', 'freshPrefixEmptyBefore', 'freshPrefixEmptyAfter', 'existingSourceBytecodeUnchanged'))
        report['executedSourceFunctions'] = [{'path': path, 'line': line, 'function': name, 'calls': count}
            for (path, line, name), count in sorted(executed.items())]
        replay = report.get('replay', {})
        okay = not report.get('error') and not report.get('verificationError') and report.get('originalsUnchanged') \
            and report.get('inputsUnchanged') and report.get('currentNativeUnchanged') \
            and report['bytecodeIsolation']['passed'] and replay.get('componentComparisonPassed') and bool(executed)
        report['status'] = 'partial_validated' if okay else 'partial_not_validated'
        report['completedAt'] = datetime.now(timezone.utc).isoformat()
        parity.diagnostic_progress('partial_receipt_write_started', status=report['status'])
        receipt = parity.write_evidence(output, report)
        parity.diagnostic_progress('partial_receipt_write_completed', status=report['status'])
    print(json.dumps({'status': report['status'], 'output': receipt, 'partialScope': report.get('partialScope'),
        'counts': replay.get('counts'), 'ablations': replay.get('ablationCounts'),
        'error': report.get('error'), 'verificationError': report.get('verificationError'),
        'stop': replay.get('stop'), 'firstDifferences': replay.get('differences', [])[:5]}))
    return 0 if okay else 1


if __name__ == '__main__':
    parity.start_diagnostics()
    try:
        raise SystemExit(main())
    finally:
        parity.stop_diagnostics()
