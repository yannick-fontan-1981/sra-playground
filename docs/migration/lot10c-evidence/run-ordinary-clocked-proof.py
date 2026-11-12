#!/usr/bin/env python3
"""Run one ordinary admitted cold OrderedRecruitment campaign with only its case-clock lock.

This wrapper never supplies decisions or acquired state. The single cumulative
clock is not reset by a failure, timeout, missing report, or environment recovery.
No global coordination lock or publication/peer admission gate is used. This
functional campaign is not an official performance measurement.
"""
from __future__ import annotations

import time

PROCESS_STARTED_NS = time.monotonic_ns()
PROCESS_STARTED_WALL_NS = time.time_ns()

import argparse
from contextlib import ExitStack
import ctypes
from datetime import datetime, timezone
from decimal import Decimal
import fcntl
import gzip
import hashlib
import json
import math
import os
from pathlib import Path
import re
import resource
import shutil
import signal
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / 'docs/migration/lot10c-evidence'
CLOCK = EVIDENCE / 'case-clock.json'
CASE_CONTRACT = EVIDENCE / 'case-contract.json'
GAME = None
TARGET_LEVELS = None
CASE_LOCK = None
SCHEMA = 'logos-engine.lot10c.recruitment-cumulative-clock.v1'
INITIAL_SECONDS = Decimal(0)
MAXIMUM_SECONDS = Decimal('2400')
MAXIMUM_ATTEMPT_SECONDS = 600.0
CHILD_OLD_SPACE_MIB = 1536
RETENTION_RESERVE_SECONDS = 30.0
STOP_MARGIN_SECONDS = 0.5
RUNNER = EVIDENCE / 'run-ordered-recruitment-campaign.mjs'
REFERENCE = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/'
REQUIRED_ARCHIVED_FILES = {
    'docs/migration/lot10c-evidence/run-clocked-proof.py',
    'docs/migration/lot10c-evidence/run-ordinary-clocked-proof.py',
    'docs/migration/lot10c-evidence/run-ordered-recruitment-campaign.mjs',
    'docs/migration/lot10c-evidence/stream-evidence-json.mjs',
    'tests/helpers/v6-live-game-campaign.ts',
    'tests/helpers/v6-ordered-recruitment-capture.ts',
    'tests/helpers/v6-window-question-capture.ts',
    'tests/helpers/capture-preview-packing.ts',
    'docs/migration/lot10c-evidence/case-contract.json',
    'docs/migration/lot10c-evidence/case-activity.py',
    'docs/migration/lot10c-evidence/admit-case.py',
    'package.json', 'package-lock.json', 'tsconfig.json', '.openai/hosting.json',
    REFERENCE + 'laya_proto/common_frontier_policy.drm.json',
    REFERENCE + 'morphology_policy/strategy.drm',
}


class AdmissionStopped(RuntimeError):
    """Preparation cannot authorize any child after its clock or signal stop."""


def now():
    return datetime.now(timezone.utc).isoformat()


def elapsed():
    return (time.monotonic_ns() - PROCESS_STARTED_NS) / 1_000_000_000


def reject_constant(value):
    raise ValueError('Non-finite JSON number: ' + value)


def unique_object(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise ValueError('Duplicate JSON key: ' + key)
        value[key] = item
    return value


def decode_json(data):
    return json.loads(data, object_pairs_hook=unique_object, parse_constant=reject_constant)


def read_json(path):
    return decode_json(path.read_text(encoding='utf-8'))


def inside(value, must_exist=True):
    raw = str(value)
    if '\\' in raw or any(ord(char) < 32 for char in raw):
        raise ValueError('Invalid repository path')
    path = Path(raw)
    if not path.is_absolute():
        if not path.parts or any(part in ('.', '..') for part in path.parts):
            raise ValueError('Repository paths must be normalized')
        path = ROOT / path
    relative = path.relative_to(ROOT)
    if not relative.parts or '..' in relative.parts:
        raise ValueError('A repository child path is required')
    cursor = ROOT
    for part in relative.parts:
        cursor = cursor / part
        if cursor.is_symlink():
            raise ValueError('Symlink execution/evidence paths are not accepted: ' + str(relative))
    if must_exist and not path.is_file():
        raise FileNotFoundError(path)
    return path


def name(path):
    return path.relative_to(ROOT).as_posix()


def sha(path, guard=None):
    digest = hashlib.sha256()
    if guard:
        guard()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            if guard:
                guard()
            digest.update(chunk)
    return digest.hexdigest()


def fingerprint(path, guard=None):
    return {'path': name(path), 'sha256': sha(path, guard), 'bytes': path.stat().st_size}


def fsync_directory(path):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def atomic_bytes(path, data, replace=False):
    temporary = path.with_name(path.name + f'.pending-{os.getpid()}-{time.monotonic_ns()}')
    with temporary.open('xb') as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    if replace:
        os.replace(temporary, path)
    else:
        os.link(temporary, path)  # Atomic exclusive install, never overwrite evidence.
        temporary.unlink()
    fsync_directory(path.parent)


def write_json(path, value, replace=False):
    atomic_bytes(path, (json.dumps(value, indent=2, allow_nan=False) + '\n').encode(), replace)


def finite_seconds(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
        raise ValueError('Clock charges must be finite nonnegative seconds')
    return Decimal(str(value))


def validate_clock(clock):
    if clock.get('schema') != SCHEMA or clock.get('game') != GAME:
        raise ValueError('Wrong cumulative OrderedRecruitment case ledger')
    if clock.get('maximumCumulativeSeconds') != 2400 or clock.get('clockReset') is not False:
        raise ValueError('The strict 2400-second clock cannot be reset or expanded')
    initial = clock.get('initialAccounting', {})
    if (finite_seconds(initial.get('chargedSeconds')) != INITIAL_SECONDS
            or initial.get('newCase') is not True or initial.get('caseContract') != fingerprint(inside(CASE_CONTRACT))):
        raise ValueError('Initial case admission or its immutable contract changed')
    attempts = clock.get('attempts')
    if not isinstance(attempts, list):
        raise ValueError('Missing append-only attempt ledger')
    total, seen = INITIAL_SECONDS, set()
    for attempt in attempts:
        if attempt.get('status') != 'terminal':
            raise ValueError('An unresolved running attempt blocks a new campaign; no debit is refunded')
        attempt_id = attempt.get('attemptId')
        if not isinstance(attempt_id, str) or attempt_id in seen:
            raise ValueError('Repeated or invalid attempt identity')
        seen.add(attempt_id)
        if attempt.get('priorCumulativeSeconds') != float(total):
            raise ValueError('Broken cumulative debit sequence')
        charge = finite_seconds(attempt.get('chargedSeconds'))
        receipt = attempt.get('executionReceipt', {})
        receipt_path = inside(receipt.get('path', ''))
        if fingerprint(receipt_path) != receipt:
            raise ValueError('A prior terminal execution receipt changed or disappeared')
        recorded = read_json(receipt_path)
        if recorded.get('attemptId') != attempt_id or charge < finite_seconds(recorded.get('elapsedSecondsThroughCapture')):
            raise ValueError('A terminal debit cannot omit measured attempt time')
        if recorded.get('executionHelpersUnchanged', True) is not True:
            raise ValueError('An activity changed its accounting helpers; the debit remains charged and further admission is blocked')
        total += charge
    remaining = MAXIMUM_SECONDS - total
    if clock.get('cumulativeChargedSeconds') != float(total) or clock.get('remainingSeconds') != float(max(Decimal(0), remaining)):
        raise ValueError('The cumulative totals do not match every retained debit')
    return total, remaining


def load_frozen(manifest_path, guard=None):
    if guard:
        guard()
    archive_path = manifest_path.with_name('source-archive.json')
    inside(archive_path)
    manifest, archive = read_json(manifest_path), read_json(archive_path)
    native = manifest.get('files')
    files = archive.get('files')
    if not isinstance(native, dict) or not native or manifest.get('fileCount') != len(native):
        raise ValueError('Invalid frozen native inventory')
    native_digest = hashlib.sha256(json.dumps(dict(sorted(native.items())), separators=(',', ':')).encode()).hexdigest()
    if manifest.get('digest') != native_digest:
        raise ValueError('The native inventory digest is inconsistent')
    if (archive.get('schema') != 'logos-engine.v53.frozen-source-archive.v1'
            or archive.get('nativeSourceManifestDigest') != native_digest or not isinstance(files, dict) or not files):
        raise ValueError('The adjacent source archive is not bound to this native freeze')
    if not REQUIRED_ARCHIVED_FILES.issubset(files):
        raise ValueError('The source archive omits execution helpers or declarations: ' +
                         ', '.join(sorted(REQUIRED_ARCHIVED_FILES - set(files))))
    for path_name, digest in files.items():
        if guard:
            guard()
        if not isinstance(path_name, str) or not isinstance(digest, str) or re.fullmatch(r'[0-9a-f]{64}', digest) is None:
            raise ValueError('Invalid archive file fingerprint')
        if name(inside(path_name)) != path_name:
            raise ValueError('Archive paths must be exact normalized repository paths')
    for path_name, digest in native.items():
        if files.get(path_name) != digest:
            raise ValueError('The archive omits or changes a native source: ' + path_name)
    artifact = archive.get('archive', {})
    artifact_path = inside(artifact.get('path', ''))
    expected = dict(files)
    bindings = [manifest_path, archive_path, artifact_path]
    if any(name(path) in expected for path in bindings):
        raise ValueError('The source inventory must not contain its own manifest/archive')
    if fingerprint(artifact_path, guard) != artifact:
        raise ValueError('The archived source bytes do not match their existing receipt')
    for path in bindings:
        expected[name(path)] = sha(path, guard)
    return {'manifest': manifest, 'expected': expected,
            'manifestReceipt': fingerprint(manifest_path, guard), 'archiveReceipt': fingerprint(archive_path, guard),
            'archiveArtifact': artifact, 'archivedFileCount': len(files)}


def source_snapshot(frozen, guard=None):
    paths = set(frozen['expected'])
    native_names = set()
    errors = []
    for folder in ['src/logos-engine', 'src/runtime']:
        for path in sorted((ROOT / folder).rglob('*')):
            if guard:
                guard()
            if path.is_file() and path.suffix in ('.ts', '.json', '.drm'):
                native_names.add(name(path))
    paths.update(native_names)
    observed = {}
    for path_name in sorted(paths):
        try:
            observed[path_name] = fingerprint(inside(path_name), guard)
        except AdmissionStopped:
            raise
        except Exception as error:
            errors.append({'path': path_name, 'type': type(error).__name__, 'message': str(error)})
    native_files = {key: observed[key]['sha256'] for key in sorted(native_names) if key in observed}
    native = {'fileCount': len(native_files),
              'digest': hashlib.sha256(json.dumps(native_files, separators=(',', ':')).encode()).hexdigest(),
              'files': native_files}
    mismatches = [key for key, digest in frozen['expected'].items()
                  if observed.get(key, {}).get('sha256') != digest]
    return {'recordedAt': now(), 'fileFingerprints': observed, 'nativeSource': native,
            'errors': errors, 'mismatchedPaths': sorted(mismatches),
            'matchesDeclaredFreeze': not errors and not mismatches and native == frozen['manifest']}


def archive_raw(source):
    original = fingerprint(source)
    destination = source.with_name(source.name + '.gz')
    temporary = destination.with_name(destination.name + '.inprogress')
    with source.open('rb') as incoming, temporary.open('xb') as output:
        with gzip.GzipFile(filename='', mode='wb', fileobj=output, mtime=0) as compressed:
            shutil.copyfileobj(incoming, compressed, 1024 * 1024)
        output.flush()
        os.fsync(output.fileno())
    os.link(temporary, destination)
    temporary.unlink()
    fsync_directory(destination.parent)
    restored_hash, restored_bytes = hashlib.sha256(), 0
    with gzip.open(destination, 'rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            restored_hash.update(chunk)
            restored_bytes += len(chunk)
    if (restored_hash.hexdigest() != original['sha256'] or restored_bytes != original['bytes']
            or fingerprint(source) != original):
        raise ValueError('Lossless gzip round trip or retained original changed: ' + name(source))
    return {'original': original, 'compressed': fingerprint(destination),
            'roundtripVerified': True, 'restoredSha256': restored_hash.hexdigest(), 'restoredBytes': restored_bytes}


def read_checkpoint_index(path):
    result = {'present': path.exists(), 'completeRecords': 0, 'lastCompleteRecord': None,
              'trailingPartialBytes': 0, 'malformedCompleteRecords': []}
    if not path.exists():
        return result
    with path.open('rb') as stream:
        for line_number, line in enumerate(stream, 1):
            if not line.endswith(b'\n'):
                result['trailingPartialBytes'] = len(line)
                break
            try:
                record = decode_json(line)
                if (not isinstance(record, dict) or record.get('completeCampaign') is not False
                        or record.get('sequence') != result['completeRecords'] + 1):
                    raise ValueError('Invalid completed checkpoint index entry')
                result['completeRecords'] += 1
                result['lastCompleteRecord'] = record
            except Exception as error:
                result['malformedCompleteRecords'].append({'line': line_number, 'type': type(error).__name__, 'message': str(error)})
    return result


def read_public_journal(path, trace_packets=None):
    value = {'present': path.exists(), 'completeRecords': 0, 'initialReturns': 0,
             'observedActionReturns': 0, 'malformedCompleteRecords': [], 'trailingPartialBytes': 0,
             'traceMatchesCompleteRecords': None if trace_packets is None else True,
             'lastObservedPublicFields': None,
             'qualification': 'Counts only complete observed public returns. An interrupted or in-flight action is not invented.'}
    if not path.exists():
        return value
    with path.open('rb') as stream:
        for line_number, line in enumerate(stream, 1):
            if not line.endswith(b'\n'):
                value['trailingPartialBytes'] = len(line)
                break
            try:
                item = decode_json(line)
                if not isinstance(item, dict) or not isinstance(item.get('packet'), dict) or 'command' not in item:
                    raise ValueError('Missing actual packet/command')
                command = item['command']
                if command is not None and (not isinstance(command, dict) or
                        not isinstance(command.get('action_ref'), str) or ('data' in command and not isinstance(command['data'], dict))):
                    raise ValueError('Malformed observed command')
                index = value['completeRecords']
                if trace_packets is not None and (index >= len(trace_packets) or trace_packets[index] != item):
                    value['traceMatchesCompleteRecords'] = False
                value['completeRecords'] += 1
                value['initialReturns' if command is None else 'observedActionReturns'] += 1
                value['lastObservedPublicFields'] = {key: item['packet'][key] for key in
                    ['level', 'levels_completed', 'state', 'step_index', 'frame_hash'] if key in item['packet']}
            except Exception as error:
                value['malformedCompleteRecords'].append({'line': line_number, 'type': type(error).__name__, 'message': str(error)})
    if trace_packets is not None and len(trace_packets) != value['completeRecords']:
        value['traceMatchesCompleteRecords'] = False
    return value


def inspect_capture(out, expected_digest):
    errors, report, trace, checkpoint = [], None, None, None
    for key, filename in [('report', 'recruitment-campaign.json.gz'), ('trace', 'recruitment-public-trace.json.gz'),
                          ('checkpoint', 'recruitment-checkpoint.json')]:
        path = out / filename
        if not path.exists():
            continue
        try:
            if path.suffix == '.gz':
                with gzip.open(path, 'rt', encoding='utf-8') as stream:
                    document = decode_json(stream.read())
            else:
                document = read_json(path)
            if not isinstance(document, dict):
                raise ValueError('An object is required')
            if key == 'report':
                if (document.get('schema') != 'logos-engine.v6.integrated-game-campaign.v1'
                        or document.get('game') != GAME or document.get('targetLevels') != TARGET_LEVELS
                        or document.get('status') not in ('passed', 'failed')
                        or document.get('source', {}).get('digest') != expected_digest
                        or not isinstance(document.get('actions'), list) or not isinstance(document.get('final'), dict)):
                    raise ValueError('Invalid actual final campaign report')
                report = document
            elif key == 'trace':
                if (document.get('schema') != 'logos-engine.native-public-game-trace.v1'
                        or document.get('game') != GAME or document.get('sourceDigest') != expected_digest
                        or document.get('status') not in ('passed', 'failed') or not isinstance(document.get('packets'), list)):
                    raise ValueError('Invalid actual public trace')
                trace = document
            else:
                if (document.get('schema') != 'logos-engine.lot10c.recruitment-campaign-checkpoint.v1'
                        or document.get('game') != GAME or document.get('targetLevels') != TARGET_LEVELS
                        or document.get('completeCampaign') is not False
                        or not isinstance(document.get('report'), dict)):
                    raise ValueError('Invalid partial checkpoint envelope')
                if (document['report'].get('game') != GAME or document['report'].get('targetLevels') != TARGET_LEVELS
                        or document['report'].get('source', {}).get('digest') != expected_digest):
                    raise ValueError('The partial checkpoint is not bound to the admitted campaign')
                checkpoint = document
        except Exception as error:
            errors.append({'path': name(path), 'type': type(error).__name__, 'message': str(error)})
    journal = read_public_journal(out / 'recruitment-actual-public-journal.jsonl', trace.get('packets') if trace else None)
    checkpoint_index = read_checkpoint_index(out / 'recruitment-checkpoints.jsonl')
    final_public = journal.get('lastObservedPublicFields') or {}
    final_matches_public = bool(report and report['final'].get('levelsCompleted') == final_public.get('levels_completed')
                                and report['final'].get('state') == final_public.get('state')
                                and report['final'].get('level') == final_public.get('level'))
    counts_match = bool(report and report['final'].get('actions') == len(report['actions']) == journal['observedActionReturns']
                        and journal['initialReturns'] == 1 and not journal['malformedCompleteRecords'] and not journal['trailingPartialBytes'])
    complete = bool(report and trace and trace['status'] == report['status'] and counts_match
                    and journal['traceMatchesCompleteRecords'] is True and final_matches_public and not errors)
    partial = None
    if checkpoint:
        original = checkpoint['report']
        partial = {'sequence': checkpoint.get('sequence'), 'recordedAt': checkpoint.get('recordedAt'),
                   'completeCampaign': False, 'reportStatus': original.get('status'),
                   'recordedActions': len(original['actions']) if isinstance(original.get('actions'), list) else None,
                   'recordedPrefixes': len(original['prefixes']) if isinstance(original.get('prefixes'), list) else None}
    return {'errors': errors, 'publicJournal': journal, 'lastCheckpoint': partial, 'checkpointIndex': checkpoint_index,
            'campaignStatus': report['status'] if report else None,
            'actualFinal': report['final'] if report else None,
            'actualFailure': report.get('failure') if report else None,
            'finalCaptureComplete': complete, 'reportCountsMatchJournal': counts_match,
            'finalPublicFieldsMatch': final_matches_public,
            'qualification': 'A missing/partial capture is an evidence limitation, never an inferred game failure or campaign success.'}


def retain_worker(out, frozen):
    after = None
    errors, lossless_archives = [], []
    if frozen is not None:
        try:
            after = source_snapshot(frozen)
            write_json(out / 'postflight.json', {'schema': 'logos-engine.lot10c.recruitment-source-check.v1',
                       'stage': 'after', **after})
        except BaseException as error:
            errors.append({'stage': 'postflight', 'type': type(error).__name__, 'message': str(error)})
    for filename in ['recruitment-live.log', 'recruitment-actual-public-journal.jsonl', 'recruitment-checkpoints.jsonl', 'recruitment-checkpoint.json']:
        path = out / filename
        if path.exists():
            try:
                lossless_archives.append(archive_raw(path))
            except BaseException as error:
                errors.append({'stage': 'retention', 'path': name(path), 'type': type(error).__name__, 'message': str(error)})
    try:
        capture = inspect_capture(out, frozen['manifest']['digest'] if frozen else None)
    except BaseException as error:
        errors.append({'stage': 'capture_inspection', 'type': type(error).__name__, 'message': str(error)})
        capture = {'campaignStatus': None, 'actualFinal': None, 'finalCaptureComplete': False,
                   'qualification': 'Capture inspection did not complete; no game result is inferred.'}
    artifacts = {}
    for path in sorted(out.iterdir()):
        if path.is_file():
            try:
                artifacts[path.name] = fingerprint(inside(path))
            except BaseException as error:
                errors.append({'stage': 'artifact_fingerprint', 'path': name(path), 'type': type(error).__name__, 'message': str(error)})
    return {'after': after, 'capture': capture, 'losslessArchives': lossless_archives,
            'artifacts': artifacts, 'errors': errors}


def retain_with_deadline(out, frozen, before, remaining, parent_death_guard, received_signals):
    allowance = min(RETENTION_RESERVE_SECONDS, max(0.0, remaining - elapsed() - 5.0))
    result_path = out / 'retention-result.json'
    metadata = {'schema': 'logos-engine.lot10c.bounded-retention.v1', 'startedAt': now(),
                'allowanceSeconds': allowance, 'maximumAddressSpaceBytes': 2 * 1024**3,
                'rawEvidencePreserved': True, 'termination': None}
    empty = {'after': None, 'capture': {'campaignStatus': None, 'actualFinal': None, 'finalCaptureComplete': False,
             'qualification': 'Bounded retention did not complete; raw observations remain, with no inferred success.'},
             'losslessArchives': [], 'artifacts': {}, 'errors': []}
    if allowance <= 0 or received_signals:
        empty['errors'].append({'stage': 'retention', 'type': 'NotAdmitted', 'message': 'No bounded retention allowance remains'})
        return empty
    started = time.monotonic()
    pid = os.fork()
    if pid == 0:
        try:
            os.setsid()
            parent_death_guard()
            resource.setrlimit(resource.RLIMIT_AS, (metadata['maximumAddressSpaceBytes'], metadata['maximumAddressSpaceBytes']))
            retained = retain_worker(out, frozen)
            write_json(result_path, retained)
            os._exit(0)
        except BaseException as error:
            try:
                write_json(out / 'retention-failure.json', {'type': type(error).__name__, 'message': str(error), 'at': now()})
            finally:
                os._exit(1)
    metadata['pid'] = pid
    status = None
    while status is None:
        ended, child_status = os.waitpid(pid, os.WNOHANG)
        if ended:
            status = child_status
            break
        if received_signals or time.monotonic() - started >= allowance:
            metadata['termination'] = 'wrapper_signal' if received_signals else 'retention_deadline'
            try:
                os.kill(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            _, status = os.waitpid(pid, 0)
            break
        time.sleep(min(0.05, max(0.001, allowance - (time.monotonic() - started))))
    metadata.update(finishedAt=now(), elapsedSeconds=time.monotonic()-started, exitCode=os.waitstatus_to_exitcode(status))
    if metadata['exitCode'] == 0 and metadata['termination'] is None and result_path.is_file():
        result = read_json(result_path)
        result['artifacts'][result_path.name] = fingerprint(result_path)
    else:
        result = empty
        result['errors'].append({'stage': 'retention', 'type': 'IncompleteBoundedRetention',
                                 'message': 'Retention worker stopped or failed; original public evidence is retained'})
        if (out / 'retention-failure.json').exists():
            result['artifacts']['retention-failure.json'] = fingerprint(out / 'retention-failure.json')
    write_json(out / 'retention-execution.json', metadata)
    result['artifacts']['retention-execution.json'] = fingerprint(out / 'retention-execution.json')
    result['retention'] = metadata
    return result


def acquire_case_clock_lock(stack, case_lock):
    """Serialize this cumulative case ledger only; never take a global lock."""
    stream = stack.enter_context(case_lock.open('a+b'))
    fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)


def main():
    global GAME, TARGET_LEVELS, CASE_LOCK
    contract = read_json(inside(CASE_CONTRACT))
    GAME, TARGET_LEVELS = contract.get('game'), contract.get('targetLevels')
    if (contract.get('schema') != 'logos-engine.lot10c.case-contract.v1' or not isinstance(GAME, str)
            or not re.fullmatch(r'[A-Z0-9]{4}', GAME) or TARGET_LEVELS != 3):
        raise ValueError('Invalid immutable case contract')
    CASE_LOCK = Path('/workspace/shared/sra-coordination') / (GAME.lower() + '.lock')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', required=True, help='New exclusive repository-relative attempt directory')
    parser.add_argument('--source-manifest', required=True, help='Preexisting native freeze with adjacent source-archive.json')
    parser.add_argument('--timeout-seconds', type=float, default=600.0, help='Preparation plus child activity, at most 600 seconds')
    args = parser.parse_args()
    if not math.isfinite(args.timeout_seconds) or not 0 < args.timeout_seconds <= MAXIMUM_ATTEMPT_SECONDS:
        parser.error('The activity ceiling must be finite, positive and at most 600 seconds')
    if sys.platform != 'linux':
        raise RuntimeError('This retained runner requires the Linux parent-death guard')
    out = inside(args.directory, must_exist=False)
    if not out.is_relative_to(EVIDENCE) or out == EVIDENCE or out.exists():
        raise ValueError('Use a new exclusive directory below lot10c-evidence')
    manifest_path = inside(args.source_manifest)
    if manifest_path.name != 'source-manifest.json':
        raise ValueError('Use the preexisting standard source-manifest.json')
    clock_path = inside(CLOCK)
    node = shutil.which('node')
    if node is None:
        raise FileNotFoundError('node')
    # Load libc before forking. The child cannot outlive a forcibly killed wrapper.
    libc = ctypes.CDLL(None, use_errno=True)
    parent_pid = os.getpid()

    def parent_death_guard():
        if libc.prctl(1, signal.SIGKILL, 0, 0, 0) != 0:  # PR_SET_PDEATHSIG
            os._exit(125)
        if os.getppid() != parent_pid:
            os.kill(os.getpid(), signal.SIGKILL)

    received_signals = []

    def receive_signal(number, _frame):
        received_signals.append({'signal': number, 'receivedAt': now(), 'elapsedSeconds': elapsed()})

    for number in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
        signal.signal(number, receive_signal)

    with ExitStack() as stack:
        acquire_case_clock_lock(stack, CASE_LOCK)
        clock_bytes = clock_path.read_bytes()
        clock = decode_json(clock_bytes)
        prior_total, remaining = validate_clock(clock)
        if Decimal(str(args.timeout_seconds + RETENTION_RESERVE_SECONDS)) > remaining:
            raise ValueError('The requested ceiling plus retention reserve exceeds the remaining OrderedRecruitment case budget')
        out.mkdir(parents=True, exist_ok=False)
        fsync_directory(out.parent)
        attempt_id = name(out)
        atomic_bytes(out / 'clock-before.json', clock_bytes)
        started_at = datetime.fromtimestamp(PROCESS_STARTED_WALL_NS / 1_000_000_000, timezone.utc).isoformat()
        entry = {'attemptId': attempt_id, 'status': 'running', 'game': GAME, 'targetLevels': TARGET_LEVELS,
                 'startedAt': started_at, 'admittedAt': now(), 'priorCumulativeSeconds': float(prior_total),
                 'remainingBeforeSeconds': float(remaining), 'activityCeilingSeconds': args.timeout_seconds,
                 'terminationMarginSeconds': STOP_MARGIN_SECONDS, 'retentionReserveSeconds': RETENTION_RESERVE_SECONDS,
                 'coordination': {'mode': 'ordinary_unlocked', 'globalLockAcquired': False,
                                  'caseLockMode': 'exclusive_nonblocking', 'timingClaim': False},
                 'sourceManifestPath': name(manifest_path), 'chargedSeconds': None,
                 'qualification': 'Running was persisted before spawn. An unresolved entry blocks every subsequent attempt; no implicit refund.'}
        write_json(out / 'attempt-start.json', {'schema': 'logos-engine.lot10c.recruitment-attempt-start.v1',
                   **entry, 'wrapperPid': parent_pid, 'priorClock': fingerprint(out / 'clock-before.json'),
                   'caseLock': str(CASE_LOCK)})
        clock['attempts'].append(entry)
        clock['budgetAvailability'] = 'blocked_by_running_attempt'
        clock['lastUpdatedAt'] = now()
        write_json(clock_path, clock, replace=True)

        frozen = before = after = process = None
        errors, termination, child, lossless_archives = [], None, None, []
        command = [node, f'--max-old-space-size={CHILD_OLD_SPACE_MIB}', str(RUNNER), str(out)]
        outcome = 'preflight_failed'
        log_path = out / 'recruitment-live.log'

        def guard_admission():
            if received_signals:
                raise AdmissionStopped('A wrapper signal stopped preparation before spawn')
            if elapsed() >= args.timeout_seconds - STOP_MARGIN_SECONDS:
                raise AdmissionStopped('The activity ceiling stopped preparation before spawn')

        def stop_child(reason):
            nonlocal termination
            if process is not None and process.poll() is None:
                termination = {'reason': reason, 'requestedAt': now(), 'elapsedSeconds': elapsed(), 'signal': 'SIGKILL'}
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                    termination['signalSent'] = True
                except ProcessLookupError:
                    termination['signalSent'] = False
                process.wait()
                termination['reapedAt'] = now()
                termination['reapedElapsedSeconds'] = elapsed()
                termination['exitCode'] = process.returncode

        try:
            frozen = load_frozen(manifest_path, guard_admission)
            before = source_snapshot(frozen, guard_admission)
            write_json(out / 'preflight.json', {'schema': 'logos-engine.lot10c.recruitment-source-check.v1',
                       'stage': 'before', 'sourceManifest': frozen['manifestReceipt'],
                       'sourceArchive': frozen['archiveReceipt'], 'archiveArtifact': frozen['archiveArtifact'],
                       'archivedFileCount': frozen['archivedFileCount'], **before})
            if not before['matchesDeclaredFreeze']:
                raise ValueError('Current execution inputs differ from the declared preexisting source freeze')
            if received_signals:
                outcome = 'interrupted_before_spawn'
            else:
                stop_at = PROCESS_STARTED_NS / 1_000_000_000 + args.timeout_seconds - STOP_MARGIN_SECONDS
                allowance = stop_at - time.monotonic()
                if allowance <= 0:
                    outcome = 'activity_limit_before_spawn'
                else:
                    with log_path.open('xb') as output:
                        child_started = now()
                        child_start_elapsed = elapsed()
                        process = subprocess.Popen(command, cwd=ROOT, stdout=output, stderr=subprocess.STDOUT,
                                                   start_new_session=True, preexec_fn=parent_death_guard)
                        child = {'pid': process.pid, 'startedAt': child_started, 'startedElapsedSeconds': child_start_elapsed,
                                 'allowanceAfterPreflightSeconds': allowance, 'command': command,
                                 'nodeOldSpaceMiB': CHILD_OLD_SPACE_MIB,
                                 'parentDeathSignal': 'SIGKILL', 'separateProcessGroup': True}
                        write_json(out / 'child-process.json', {'schema': 'logos-engine.lot10c.recruitment-child-process.v1', **child})
                        outcome = 'child_returned'
                        while process.poll() is None:
                            if received_signals:
                                outcome = 'interrupted'
                                stop_child('received_wrapper_signal')
                                break
                            left = stop_at - time.monotonic()
                            if left <= 0:
                                outcome = 'activity_timeout'
                                stop_child('preparation_plus_child_activity_ceiling')
                                break
                            try:
                                process.wait(timeout=min(left, 0.1))
                            except subprocess.TimeoutExpired:
                                pass
                        output.flush()
                        os.fsync(output.fileno())
                    child['finishedAt'] = now()
                    child['finishedElapsedSeconds'] = elapsed()
                    child['exitCode'] = process.returncode
        except BaseException as error:
            errors.append({'stage': 'preflight_or_execution', 'type': type(error).__name__, 'message': str(error)})
            if isinstance(error, AdmissionStopped):
                outcome = 'interrupted_before_spawn' if received_signals else 'activity_limit_before_spawn'
            elif process is not None:
                outcome = 'wrapper_error'
            stop_child('wrapper_error')
        finally:
            stop_child('wrapper_finalization')

        # The stopped child's raw files stay in place. A separate, memory-bounded
        # worker retains and verifies them under a hard parent deadline.
        retention = retain_with_deadline(out, frozen, before, float(remaining), parent_death_guard, received_signals)
        after = retention.get('after')
        capture = retention['capture']
        lossless_archives = retention.get('losslessArchives', [])
        artifacts = retention.get('artifacts', {})
        errors.extend(retention.get('errors', []))
        unchanged = bool(before and after and before['matchesDeclaredFreeze'] and after['matchesDeclaredFreeze']
                         and before['fileFingerprints'] == after['fileFingerprints'] and before['nativeSource'] == after['nativeSource'])
        natural_return = process is not None and process.poll() is not None and termination is None and outcome == 'child_returned'
        complete = bool(natural_return and capture.get('finalCaptureComplete') and unchanged and not errors)
        passed = bool(complete and process.returncode == 0 and capture.get('campaignStatus') == 'passed'
                      and capture.get('actualFinal', {}).get('levelsCompleted', 0) >= TARGET_LEVELS)
        if errors:
            passed = complete = False
        capture_elapsed = elapsed()
        budget_within_limit = Decimal(str(capture_elapsed)) < remaining
        passed = passed and budget_within_limit
        receipt = {'schema': 'logos-engine.lot10c.recruitment-clocked-execution.v1', 'attemptId': attempt_id,
                   'game': GAME, 'targetLevels': TARGET_LEVELS, 'startedAt': started_at, 'captureFinishedAt': now(),
                   'elapsedSecondsThroughCapture': capture_elapsed, 'coordination': entry['coordination'],
                   'activityCeilingSeconds': args.timeout_seconds, 'terminationMarginSeconds': STOP_MARGIN_SECONDS,
                   'retentionReserveSeconds': RETENTION_RESERVE_SECONDS,
                   'priorCumulativeSeconds': float(prior_total), 'remainingBeforeSeconds': float(remaining),
                   'child': child, 'exitCode': process.returncode if process is not None else None,
                   'attemptOutcome': outcome, 'termination': termination, 'receivedSignals': received_signals,
                   'nativeSourceManifestDigest': frozen['manifest']['digest'] if frozen else None,
                   'sourceInputsUnchanged': unchanged, 'capture': capture,
                   'boundedRetention': retention.get('retention'), 'cumulativeBudgetWithinLimitThroughCapture': budget_within_limit,
                   'finalExecutionEvidenceComplete': complete, 'campaignPassedEstablished': passed,
                   'completeActionCountEstablished': bool(natural_return and capture.get('reportCountsMatchJournal')),
                   'errors': errors, 'artifacts': artifacts, 'losslessArchives': lossless_archives,
                   'qualification': 'One admitted cold production campaign, target three, without any additional action cap. '
                       'The monotone charge includes wrapper preparation, full child lifetime and post-stop retention. '
                       'Retention is supervised in a separate process with a hard deadline and address-space bound. '
                       'The final ledger additionally charges receipt writing/hashing before its atomic terminal update and must also pass its budget gate. '
                       'Every prior diagnostic, browser and campaign debit remains in the same case ledger. Partial checkpoints and clock/capture failures '
                       'do not establish campaign success or game failure. No source/function/full-caller parity is inferred.'}
        receipt_path = out / 'execution-recruitment.json'
        write_json(receipt_path, receipt)
        receipt_evidence = fingerprint(receipt_path)
        charge = finite_seconds(elapsed())
        total = prior_total + charge
        final_budget_within_limit = total <= MAXIMUM_SECONDS
        passed = passed and final_budget_within_limit
        entry.update({'status': 'terminal', 'finishedAt': now(), 'chargedSeconds': float(charge),
                      'attemptOutcome': outcome, 'childExitCode': process.returncode if process is not None else None,
                      'campaignStatus': capture.get('campaignStatus'), 'campaignPassedEstablished': passed,
                      'cumulativeBudgetWithinLimit': final_budget_within_limit,
                      'observedActionReturns': capture.get('publicJournal', {}).get('observedActionReturns'),
                      'completeActionCountEstablished': receipt['completeActionCountEstablished'],
                      'executionReceipt': receipt_evidence,
                      'retentionSecondsAfterChild': max(0.0, float(charge) - child['finishedElapsedSeconds'])
                          if child and 'finishedElapsedSeconds' in child else None,
                      'qualification': 'Every measured second is charged, including failure, timeout and retention; no refund or truncation.'})
        clock['cumulativeChargedSeconds'] = float(total)
        clock['remainingSeconds'] = float(max(Decimal(0), MAXIMUM_SECONDS - total))
        clock['budgetExceededSeconds'] = float(max(Decimal(0), total - MAXIMUM_SECONDS))
        clock['budgetAvailability'] = 'exhausted' if total >= MAXIMUM_SECONDS else 'available'
        clock['lastUpdatedAt'] = now()
        write_json(clock_path, clock, replace=True)
        print(json.dumps({'attempt': attempt_id, 'outcome': outcome, 'childExitCode': entry['childExitCode'],
                          'campaignStatus': capture.get('campaignStatus'), 'campaignPassedEstablished': passed,
                      'cumulativeBudgetWithinLimit': final_budget_within_limit,
                          'observedActionReturns': entry['observedActionReturns'], 'chargedSeconds': float(charge),
                          'remainingSeconds': clock['remainingSeconds'], 'receipt': name(receipt_path)}, allow_nan=False), flush=True)
        return 0 if passed else (130 if received_signals else 1)


if __name__ == '__main__':
    raise SystemExit(main())
