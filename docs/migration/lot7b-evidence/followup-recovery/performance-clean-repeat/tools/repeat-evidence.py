#!/usr/bin/env python3
"""Prospective full-window repeat after disclosed isolation violations.

Modes: declare, ready, run-window, accept, recheck. Only run-window starts the
unchanged official driver, exactly once, followed by the unchanged strict work
verifier under the same exclusive lock. No mode runs a game proof, test, build,
functional capture or old cost acceptance. All new outputs stay in this repeat
directory; the entire original timing window remains immutable and ineligible.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import fcntl
import gzip
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import signal
import statistics
import subprocess
import sys

sys.dont_write_bytecode = True
SCRIPT = Path(__file__).resolve()
ROOT = SCRIPT.parents[6]
BASE = ROOT / 'docs/migration/lot7b-evidence/followup-recovery'
REPEAT = BASE / 'performance-clean-repeat'
OLD = BASE / 'performance'
FINAL = BASE / 'integrated-final'
VALIDATION = FINAL / 'verification-attempt-02/validation'
LOCK = Path('/workspace/shared/sra-coordination/performance.lock')
REQUEST = 'lot7-followup-clean-repeat-f8d5097-final'
FINAL_QUIET_ANNOUNCED_AT = '2026-11-11T15:07:59.348713+00:00'
LANES = ['lot6b', 'lot10b', 'lot5c']
STATUS_PATHS = {lane: Path('/workspace/shared/sra-coordination') / (lane + '-status.json') for lane in LANES}
STATUS_BYTE_LIMIT = 65536
ORDER = ['A1', 'B1', 'B2', 'A2']
POPULATION = {'measuredSessions': 32, 'measuredActions': 400,
              'excludedWarmupSessions': 8, 'excludedWarmupActions': 24}
ACK = BASE / 'coordination/quiet-deviation-acknowledgment.json'
TOOLS = {
    'delivery': ROOT / 'scripts/verify-native-delivery.py',
    'readiness': BASE / 'tools/finalize-cost-readiness.py',
    'publication': BASE / 'tools/record-publication-inputs.py',
    'global': ROOT / 'scripts/review-native-global-cost-window.py',
    'strict': BASE / 'tools/verify-strict-cost-forms.mjs',
    'driver': ROOT / 'scripts/run-native-cost-window.py',
    'renderer': ROOT / 'docs/migration/lot7b-evidence/write-cost-results.py',
    'prepare': ROOT / 'docs/migration/lot7b-evidence/prepare-cost-protocol.py',
    'static': ROOT / 'docs/migration/lot7b-evidence/check-cost-static-inputs.py',
    'capture': BASE / 'tools/capture-strict-cost-forms.mjs',
}


def require(value, message):
    if not value:
        raise ValueError(message)


def local(value):
    path = (ROOT / value).resolve()
    require(path != ROOT and path.is_relative_to(ROOT), 'Input escapes checkout')
    return path


def fp(path):
    path = local(path)
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': digest.hexdigest(), 'bytes': path.stat().st_size}


def read(path):
    return json.loads(local(path).read_bytes())


def instant(value):
    stamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(stamp.tzinfo is not None, 'Timestamp requires a timezone')
    return stamp


def now():
    return datetime.now(timezone.utc).isoformat()


def write(path, value):
    require(local(path).is_relative_to(REPEAT), 'Only repeat-directory outputs are permitted')
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('x') as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False, allow_nan=False)
        stream.write('\n')


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def git(*args, cwd=ROOT):
    return subprocess.check_output(['git', *args], cwd=cwd)


def protected_paths():
    # Bounded named evidence roots only. Never search unrelated lane journals.
    names = {p for folder in (OLD, BASE / 'tools', BASE / 'contract') for p in folder.rglob('*') if p.is_file()}
    names.add(FINAL / 'publication-inputs.json')
    return sorted(names)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['declare', 'ready', 'run-window', 'accept', 'recheck'])
    parser.add_argument('--quiet-receipt', type=Path, default=REPEAT / 'quiet-window.json')
    args = parser.parse_args()
    declaration_path, review_path = REPEAT / 'repeat-declaration.json', REPEAT / 'independent-review.json'
    readiness_path, output = REPEAT / 'readiness.json', REPEAT / 'isolation-revalidation.json'
    tracked, external = {}, {}

    def keep(path):
        record = fp(path)
        require(tracked.setdefault(record['path'], record) == record, 'Input changed during verification: ' + record['path'])
        return record

    def load(path):
        keep(path)
        return read(path)

    def checked(record):
        require(keep(record['path']) == record, 'Retained fingerprint differs: ' + record['path'])
        return record

    tool_records = {name: keep(path) for name, path in TOOLS.items()}
    require(not (REPEAT / 'window.json').exists() if args.mode in ('declare', 'ready') else True,
            'Prospective repeat outputs cannot be created after sampling starts')
    if args.mode == 'declare':
        require(not declaration_path.exists() and not readiness_path.exists(), 'Repeat declaration/readiness already exists')
        require(not list(REPEAT.glob('cohort*/*.json')), 'Repeat trial output already exists')
        protocol, old_protocol = load(REPEAT / 'declaration.json'), load(OLD / 'declaration.json')
        require('ownerCostQualification' not in protocol and protocol['nativeDigests'] == old_protocol['nativeDigests'],
                'Repeat must use the same exact source pair without exemptions')
        for key in ('baselineManifest', 'candidateManifest', 'candidateArchiveManifest'):
            require(protocol[key] == old_protocol[key], 'Repeat source freeze differs: ' + key)
        for name in ('cases.json', 'comparison-policy.json'):
            require((REPEAT / name).read_bytes() == (OLD / name).read_bytes(), 'Repeat work/budget bytes differ: ' + name)
        forms = load(OLD / 'strict-work-forms.json')
        require(forms['status'] == 'passed' and forms['nativeDigests'] == protocol['nativeDigests']
                and forms['comparison'] == 'exact_deep_equality_no_exemptions'
                and forms['functionalSessions'] == 8 and forms['functionalActions'] == 62
                and forms['measuredCostSessions'] == forms['timingMetricsRetained'] == 0, 'Retained functional forms differ')
        with (REPEAT / 'strict-work-forms.json').open('xb') as stream:
            stream.write((OLD / 'strict-work-forms.json').read_bytes())
        acknowledgment = load(ACK)
        first_window = load(OLD / 'window.json')
        incident_path = ACK.parent / acknowledgment['incidentReceipt']
        incident = load(incident_path)
        successor_path = ACK.parent / acknowledgment['additionalStartupException']['statusSnapshot']
        require(acknowledgment['status'] == 'first_window_ineligible_for_isolated_cost_acceptance'
                and acknowledgment['firstOfficialWindowSha256'] == keep(OLD / 'window.json')['sha256']
                and acknowledgment['incidentSha256'] == keep(incident_path)['sha256']
                and acknowledgment['additionalStartupException']['sha256'] == keep(successor_path)['sha256']
                and acknowledgment['repeatPolicy']['requiredActiveLaneAcknowledgments'] == LANES
                and instant(first_window['startedAt']) < instant(incident['conservativeIntervalEnd'])
                and instant(incident['conservativeIntervalStart']) < instant(first_window['finishedAt']),
                'The disclosed first-window isolation withdrawal is incomplete')
        value = {'schema': 'logos-engine.followup-clean-repeat-declaration.v1', 'status': 'declared_before_repeat',
            'recordedAt': now(), 'generator': keep(SCRIPT), 'tools': tool_records,
            'protocol': keep(REPEAT / 'declaration.json'), 'quietRequestId': REQUEST,
            'finalQuietAnnouncedAt': FINAL_QUIET_ANNOUNCED_AT,
            'laneStatusSources': {lane: str(path) for lane, path in STATUS_PATHS.items()},
            'statusPayloadChangesAllowed': ['updated_at'],
            'activeLanes': LANES, 'performanceLock': str(LOCK), 'nativeDigests': protocol['nativeDigests'],
            'population': POPULATION, 'firstWindowEligibility': 'withdrawn_entire_window_due_to_isolation_deviations',
            'incidentAcknowledgment': keep(ACK), 'primaryIncident': keep(incident_path), 'successorIncident': keep(successor_path),
            'originalWindow': keep(OLD / 'window.json'), 'originalReadiness': keep(OLD / 'readiness.json'),
            'originalPublicationInputs': keep(FINAL / 'publication-inputs.json'),
            'originalForms': keep(OLD / 'strict-work-forms.json'), 'reusedForms': keep(REPEAT / 'strict-work-forms.json'),
            'functionalCaptureRepeated': False, 'newFunctionalSessions': 0,
            'caseRelocation': {'original': keep(OLD / 'cases.json'), 'repeat': keep(REPEAT / 'cases.json'), 'byteIdentical': True},
            'protectedOriginalFiles': [keep(path) for path in protected_paths()],
            'selectionBetweenWindows': False, 'poolingBetweenWindows': False, 'automaticFurtherRepeat': False,
            'qualification': 'The complete first timing window is ineligible irrespective of its numerical result. '
                'All its original bytes remain retained. Only one complete fresh A1/B1/B2/A2 window may revalidate '
                'isolation acceptance; no old timing is pooled, selected or substituted. Existing exact functional '
                'forms are reused with their original timestamps and identities, not presented as newly executed.'}
        write(declaration_path, value)
        print(json.dumps({'status': value['status'], 'declaration': fp(declaration_path)}))
        return

    repeat = load(declaration_path)
    require(repeat['schema'] == 'logos-engine.followup-clean-repeat-declaration.v1'
            and repeat['status'] == 'declared_before_repeat' and repeat['generator'] == keep(SCRIPT)
            and repeat['tools'] == tool_records and repeat['quietRequestId'] == REQUEST
            and repeat['finalQuietAnnouncedAt'] == FINAL_QUIET_ANNOUNCED_AT
            and repeat['laneStatusSources'] == {lane: str(path) for lane, path in STATUS_PATHS.items()}
            and repeat['statusPayloadChangesAllowed'] == ['updated_at']
            and repeat['activeLanes'] == LANES and repeat['performanceLock'] == str(LOCK)
            and repeat['population'] == POPULATION and repeat['functionalCaptureRepeated'] is False
            and repeat['selectionBetweenWindows'] is repeat['poolingBetweenWindows'] is repeat['automaticFurtherRepeat'] is False,
            'Repeat protocol/tool identities changed')
    require({row['path'] for row in repeat['protectedOriginalFiles']}
            == {path.relative_to(ROOT).as_posix() for path in protected_paths()}, 'Protected first-attempt file membership changed')
    for record in repeat['protectedOriginalFiles']:
        checked(record)
    for key in ('incidentAcknowledgment', 'primaryIncident', 'successorIncident', 'originalWindow',
                'originalReadiness', 'originalPublicationInputs', 'originalForms', 'reusedForms', 'protocol'):
        checked(repeat[key])
    require((REPEAT / 'strict-work-forms.json').read_bytes() == (OLD / 'strict-work-forms.json').read_bytes()
            and (REPEAT / 'cases.json').read_bytes() == (OLD / 'cases.json').read_bytes(), 'Reused work forms/cases changed')
    review = load(review_path)
    require(review['status'] == 'passed_source_review_only' and review['generatorUnderReview'] == keep(SCRIPT)
            and review['declaration'] == keep(declaration_path)
            and instant(repeat['recordedAt']) <= instant(review['recordedAt']), 'Repeat independent review is missing or stale')
    global_review = module('repeat_original_global', TOOLS['global'])
    protocol, policy, cases, baseline, native, records = global_review.protocol(REPEAT / 'declaration.json')
    for record in records:
        checked(record)
    require(protocol['nativeDigests'] == repeat['nativeDigests'] and 'ownerCostQualification' not in protocol
            and policy['caseIds'] == ['STCK', 'SMLP'] and cases['rounds'] == 4
            and all(protocol[key] == policy[key] == count for key, count in POPULATION.items()), 'Repeat global/source rule differs')
    preparation = load(REPEAT / 'preparation.json')
    baseline_checkout = Path(preparation['baselineCheckout']).resolve(strict=True)

    def external_checked(record):
        path = Path(record['path']).resolve(strict=True)
        require(path.is_relative_to(baseline_checkout) and path != baseline_checkout, 'External input escapes baseline')
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        require(digest == record['sha256'] and path.stat().st_size == record['bytes'], 'External baseline input changed')
        require(external.setdefault(record['path'], record) == record, 'Conflicting baseline inputs')

    old_readiness = load(OLD / 'readiness.json')
    for record in old_readiness['inputs']:
        checked(record)
    for record in old_readiness['watchedExternalInputs']:
        external_checked(record)
    delivery = module('repeat_original_delivery', TOOLS['delivery'])
    previous_ready = module('repeat_original_readiness', TOOLS['readiness'])
    previous_publication = module('repeat_original_publication_functions', TOOLS['publication'])
    campaign = delivery.load_helper('repeat_campaign', delivery.CAMPAIGN_HELPER)
    original = delivery.load_helper('repeat_original_source', delivery.SOURCE_HELPER)
    tests, checks = load(VALIDATION / 'delta-tests-run.json'), load(VALIDATION / 'checks-run.json')
    require(delivery.verify_native(native, campaign) == native['fileCount'], 'Current native inventory differs')
    archive, archive_check = delivery.verify_source_archive(FINAL, native)
    _, counts = delivery.verify_tests(tests, native)
    _, worker = delivery.verify_build(checks, native)
    regression, _ = delivery.verify_regressions(FINAL / 'regressions/regression-summary.json', native, True)
    require(counts == old_readiness['formalTests'] and len(tests['testFiles']) == old_readiness['formalTestFiles'] == 133
            and counts['tests'] == counts['pass'] == 5042 and regression['passed'] == regression['total'] == 11
            and regression['comparisonChecksPassed'] == regression['comparisonChecksExpected'] == 187,
            'Previously validated functional scope changed')
    delivery.verify_pinned_source(original)
    baseline_publication = load(BASE / 'coordination/baseline-publication.json')
    require(all(baseline_publication[key] == policy['baseline'][key] for key in ('siteVersion', 'commit', 'nativeVersion', 'nativeDigest'))
            and baseline_publication['siteVersion'] == 97 and baseline_publication['deploymentStatus'] == 'succeeded'
            and previous_ready.inventory(baseline_checkout) == baseline
            and git('rev-parse', 'HEAD', cwd=baseline_checkout).decode().strip() == baseline_publication['commit'],
            'Repeat baseline differs from actual published Site97')
    audit_amendment = load(BASE / 'tools/migration-audit-closure-amendment.json')
    previous_ready.verify_migration_audit_closure(FINAL, VALIDATION, native, tests, checks, archive,
        baseline_publication, keep(BASE / 'coordination/baseline-publication.json'), audit_amendment, load, checked)
    forms = load(REPEAT / 'strict-work-forms.json')
    require(forms['nativeDigests'] == repeat['nativeDigests'] and forms['status'] == 'passed'
            and forms['cases'] == repeat['caseRelocation']['original']
            and forms['comparison'] == 'exact_deep_equality_no_exemptions', 'Retained forms identify another workload')
    for record in [forms['declaration'], forms['generator'], forms['workSignatureTool'], *forms['inputs']]:
        checked(record)
    for record in forms['watchedExternalInputs']:
        external_checked(record)
    static = load(REPEAT / 'static-preflight.json')
    require(static['status'] == 'static_inputs_checked' and static['unsatisfied'] == []
            and all(row['satisfied'] is True for row in static['checks'])
            and static['generator'] == tool_records['static']
            and static['declaration'] == keep(REPEAT / 'declaration.json'), 'Repeat static preflight is incomplete')
    quiet = load(args.quiet_receipt)
    first_window = load(OLD / 'window.json')
    require(quiet['status'] == 'acknowledged_quiet_before_window' and quiet['requestId'] == REQUEST
            and quiet['performanceDirectory'] == REPEAT.relative_to(ROOT).as_posix()
            and quiet['nativeDigests'] == repeat['nativeDigests']
            and quiet['allAgentsToolIdle'] is True and quiet['ownTrackedComputeEnded'] is True
            and quiet['noQueuedCommands'] is True and quiet['previewStopped'] is True
            and quiet['costNodeOptionsOverride'] is None
            and sorted(row['lane'] for row in quiet['acknowledgments']) == sorted(LANES), 'Fresh all-agent quiet acknowledgment is incomplete')
    for row in quiet['acknowledgments']:
        require(row['requestId'] == REQUEST and row['allAgentsToolIdle'] is True
                and row['noActiveCommands'] is True and row['noQueuedCommands'] is True
                and row['statusPath'] == str(STATUS_PATHS[row['lane']])
                and instant(first_window['finishedAt']) < instant(quiet['announcedAt'])
                and instant(FINAL_QUIET_ANNOUNCED_AT) <= instant(quiet['announcedAt'])
                    <= instant(row['acknowledgedAt']) <= instant(quiet['recordedAt']),
                'A successor lane has no fresh complete tool-idle acknowledgment')
        checked(row['evidence'])
    require(max(instant(review['recordedAt']), instant(static['recordedAt'])) <= instant(quiet['recordedAt'])
            <= datetime.now(timezone.utc), 'Quiet must follow completed repeat preparation/review')

    def validate_lane(lane, value):
        acknowledgment = next(row for row in quiet['acknowledgments'] if row['lane'] == lane)
        idle = [value[key] for key in ('all_own_subagents_compute_idle', 'all_own_subagents_idle') if key in value]
        require(value.get('lane', '').lower().removeprefix('lot') == lane.removeprefix('lot')
                and value.get('quiet_request_id') == REQUEST and value.get('quiet_acknowledged') is True
                and instant(value['quiet_acknowledged_at']) == instant(acknowledgment['acknowledgedAt'])
                and value.get('heavy_execution_active') is False and value.get('active_command') is None
                and idle and all(flag is True for flag in idle)
                and not value.get('active_commands') and not value.get('queued_commands') and not value.get('queued_work')
                and value.get('preview_stopped', True) is True and not value.get('preview_active'),
                'Live lane status lost the exact final all-agent quiet acknowledgment: ' + lane)
        known = {}
        if lane == 'lot5c':
            known = {'quiet_interval_contaminated': True,
                     'quiet_deviation': '/workspace/shared/sra-coordination/lot5c-quiet-deviation-20261111T1420.json'}
        if lane == 'lot6b':
            prior_status = read(repeat['successorIncident']['path'])
            require(value.get('startup_observation') == prior_status.get('startup_observation'),
                    'Successor lane disclosed a new or changed startup exception')
        for key, item in value.items():
            if re.search(r'exception|deviation|contaminat|violation', key, re.I) and item not in (None, False, '', [], {}):
                require(key in known and item == known[key], 'Unrecognized isolation exception in ' + lane + ': ' + key)

    def snapshot(phase):
        rows = []
        for lane, source in STATUS_PATHS.items():
            with source.open('rb') as stream:
                raw = stream.read(STATUS_BYTE_LIMIT + 1)
            require(len(raw) <= STATUS_BYTE_LIMIT, 'Lane-status metadata exceeds the bounded read limit: ' + lane)
            value = json.loads(raw)
            destination = REPEAT / ('lane-status-' + phase) / (lane + '-status.json')
            destination.parent.mkdir(parents=True, exist_ok=True)
            with destination.open('xb') as stream:
                stream.write(raw)
            rows.append({'lane': lane, 'sourcePath': str(source), 'snapshot': fp(destination)})
        manifest = {'schema': 'logos-engine.followup-repeat-lane-status-snapshot.v1', 'phase': phase,
                    'recordedAt': now(), 'requestId': REQUEST, 'byteLimitPerLane': STATUS_BYTE_LIMIT, 'statuses': rows}
        write(REPEAT / ('lane-status-' + phase + '.json'), manifest)
        for row in rows:
            validate_lane(row['lane'], read(row['snapshot']['path']))
        return manifest

    def validate_snapshot(value, phase):
        require(value['schema'] == 'logos-engine.followup-repeat-lane-status-snapshot.v1'
                and value['phase'] == phase and value['requestId'] == REQUEST
                and value['byteLimitPerLane'] == STATUS_BYTE_LIMIT
                and [row['lane'] for row in value['statuses']] == LANES, 'Retained lane-status snapshot differs')
        payloads = {}
        for row in value['statuses']:
            require(row['sourcePath'] == str(STATUS_PATHS[row['lane']]) and row['snapshot']['bytes'] <= STATUS_BYTE_LIMIT,
                    'Lane-status source or bounded size differs')
            checked(row['snapshot'])
            data = load(row['snapshot']['path']); validate_lane(row['lane'], data)
            payloads[row['lane']] = {key: item for key, item in data.items() if key != 'updated_at'}
        return payloads

    def stable():
        for record in list(tracked.values()):
            require(fp(record['path']) == record, 'Repeat input changed: ' + record['path'])
        for record in list(external.values()):
            external_checked(record)
        require(previous_ready.inventory() == native and previous_ready.inventory(baseline_checkout) == baseline,
                'Source pair changed during repeat verification')
        require(delivery.verify_tests(tests, native)[1] == counts and delivery.verify_build(checks, native)[1] == worker,
                'Functional source/test/build inventory changed')

    if args.mode == 'ready':
        require(not readiness_path.exists(), 'Repeat readiness already exists')
        stable()
        value = {**old_readiness, 'generator': keep(SCRIPT), 'finalizedAt': now(),
            'baseline': policy['baseline'], 'candidate': policy['candidate'], 'isolation': quiet,
            'strictWorkForms': keep(REPEAT / 'strict-work-forms.json'), 'strictPostWindowVerifier': tool_records['strict'],
            'repeatDeclaration': keep(declaration_path), 'repeatIndependentReview': keep(review_path),
            'readinessMode': 'fresh_isolation_readiness_reusing_unchanged_functional_evidence',
            'functionalCaptureRepeated': False, 'newFunctionalSessions': 0,
            'firstWindowEligibility': repeat['firstWindowEligibility'],
            'inputs': list(tracked.values()), 'watchedExternalInputs': list(external.values()),
            'qualification': repeat['qualification']}
        write(readiness_path, value)
        print(json.dumps({'status': 'ready', 'readiness': fp(readiness_path), 'newFunctionalSessions': 0}))
        return

    readiness = load(readiness_path)
    require(readiness['generator'] == keep(SCRIPT) and readiness['status'] == 'ready'
            and readiness['measurementAuthorized'] is True and readiness['pendingRequirements'] == []
            and readiness['repeatDeclaration'] == keep(declaration_path)
            and readiness['repeatIndependentReview'] == keep(review_path) and readiness['isolation'] == quiet
            and readiness['strictWorkForms'] == keep(REPEAT / 'strict-work-forms.json'), 'Repeat readiness differs')
    for record in readiness['inputs']:
        checked(record)
    required_commit_records = [keep(SCRIPT), keep(declaration_path), keep(review_path), keep(readiness_path),
        keep(REPEAT / 'declaration.json'), keep(REPEAT / 'strict-work-forms.json'), repeat['incidentAcknowledgment'],
        repeat['primaryIncident'], repeat['successorIncident'], *tool_records.values()]

    def committed(commit):
        require(re.fullmatch(r'[0-9a-f]{40}', commit), 'Invalid candidate commit')
        previous_publication.verify_git_native(commit, native)
        git('merge-base', '--is-ancestor', baseline_publication['commit'], commit)
        for record in required_commit_records:
            data = git('show', commit + ':' + record['path'])
            require(hashlib.sha256(data).hexdigest() == record['sha256'] and len(data) == record['bytes'],
                    'Prospective repeat input is not in the candidate commit: ' + record['path'])

    if args.mode == 'run-window':
        require(not (REPEAT / 'window.json').exists() and not (REPEAT / 'lock-window.json').exists(), 'This full repeat was already started')
        committed(git('rev-parse', 'HEAD').decode().strip())
        stable()
        with LOCK.open('r+b') as lock_stream:
            fcntl.flock(lock_stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            lock_receipt = {'schema': 'logos-engine.followup-repeat-exclusive-window.v1', 'status': 'running',
                'generator': keep(SCRIPT), 'requestId': REQUEST, 'lockPath': str(LOCK), 'mode': 'exclusive',
                'acquiredAt': now(), 'readiness': keep(readiness_path), 'declaration': keep(declaration_path)}
            write(REPEAT / 'lock-window.json', lock_receipt)

            def command(argv):
                process = subprocess.Popen(argv, cwd=ROOT, start_new_session=True, pass_fds=(lock_stream.fileno(),))
                try:
                    return process.wait()
                except BaseException:
                    os.killpg(process.pid, signal.SIGTERM)
                    try:
                        process.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        os.killpg(process.pid, signal.SIGKILL); process.wait()
                    raise

            try:
                start_status = snapshot('start')
                lock_receipt['laneStatusStart'] = fp(REPEAT / 'lane-status-start.json')
                argv = ['python', '-B', str(TOOLS['driver']), str(baseline_checkout), str(REPEAT),
                        str(local(protocol['baselineManifest']['path'])), str(local(protocol['candidateManifest']['path']))]
                lock_receipt['command'] = argv
                lock_receipt['windowExitCode'] = command(argv)
                require(lock_receipt['windowExitCode'] == 0, 'The complete repeat window failed; no automatic rerun is allowed')
                lock_receipt['strictExitCode'] = command(['node', str(TOOLS['strict']), str(REPEAT)])
                require(lock_receipt['strictExitCode'] == 0, 'Exact repeat work verification failed; no exemption is allowed')
                end_status = snapshot('end')
                require(validate_snapshot(start_status, 'start') == validate_snapshot(end_status, 'end'),
                        'A lane-status payload changed during the complete repeat; isolation acceptance is withdrawn')
                lock_receipt.update(status='passed', window=fp(REPEAT / 'window.json'),
                                    strictVerification=fp(REPEAT / 'strict-work-verification.json'), heldThroughStrictVerification=True,
                                    laneStatusEnd=fp(REPEAT / 'lane-status-end.json'), laneStatusPayloadsUnchanged=True)
            except BaseException as error:
                lock_receipt.update(status='failed', error=str(error)); raise
            finally:
                lock_receipt['finishedHoldingAt'] = now()
                with (REPEAT / 'lock-window.json').open('w') as stream:
                    json.dump(lock_receipt, stream, indent=2); stream.write('\n')
                fcntl.flock(lock_stream.fileno(), fcntl.LOCK_UN)
        print(json.dumps({'status': 'passed', 'lockWindow': fp(REPEAT / 'lock-window.json')}))
        return

    require(output.is_file() if args.mode == 'recheck' else not output.exists(), 'Acceptance receipt existence differs from selected mode')
    window, strict, lock_receipt = load(REPEAT / 'window.json'), load(REPEAT / 'strict-work-verification.json'), load(REPEAT / 'lock-window.json')
    start_status, end_status = load(REPEAT / 'lane-status-start.json'), load(REPEAT / 'lane-status-end.json')
    require(validate_snapshot(start_status, 'start') == validate_snapshot(end_status, 'end'),
            'Retained start/end lane statuses reveal changed activity or an exception')
    require(window['status'] == window['finalIntegrity'] == 'passed'
            and window['plannedOrder'] == [row['label'] for row in window['executions']] == ORDER
            and window['nativeDigests'] == {'baseline': baseline['digest'], 'correction': native['digest']}, 'Repeat window is incomplete')
    require(lock_receipt['status'] == 'passed' and lock_receipt['generator'] == keep(SCRIPT)
            and lock_receipt['requestId'] == REQUEST and lock_receipt['lockPath'] == str(LOCK) and lock_receipt['mode'] == 'exclusive'
            and lock_receipt['readiness'] == keep(readiness_path) and lock_receipt['window'] == keep(REPEAT / 'window.json')
            and lock_receipt['strictVerification'] == keep(REPEAT / 'strict-work-verification.json')
            and lock_receipt['laneStatusStart'] == keep(REPEAT / 'lane-status-start.json')
            and lock_receipt['laneStatusEnd'] == keep(REPEAT / 'lane-status-end.json')
            and lock_receipt['laneStatusPayloadsUnchanged'] is True
            and lock_receipt['windowExitCode'] == lock_receipt['strictExitCode'] == 0
            and lock_receipt['heldThroughStrictVerification'] is True
            and instant(readiness['finalizedAt']) <= instant(lock_receipt['acquiredAt']) <= instant(window['startedAt'])
            <= instant(window['finishedAt']) <= instant(strict['recordedAt']) <= instant(lock_receipt['finishedHoldingAt']),
            'Actual exclusive lock does not enclose the complete repeat and strict verification')
    require(instant(lock_receipt['acquiredAt']) <= instant(start_status['recordedAt']) <= instant(window['startedAt'])
            and instant(strict['recordedAt']) <= instant(end_status['recordedAt']) <= instant(lock_receipt['finishedHoldingAt']),
            'Bounded live status snapshots do not enclose the measured window')
    require(strict['status'] == 'passed' and strict['generator'] == tool_records['strict'] and strict['checkedTrials'] == 40
            and strict['forms'] == keep(REPEAT / 'strict-work-forms.json') and strict['nativeDigests'] == repeat['nativeDigests']
            and strict['structuralExemptions'] == [] and strict['excludedMeasuredSessions'] == strict['excludedOutliers'] == 0
            and all(strict[key] == count for key, count in POPULATION.items()), 'All forty fresh exact work trials are required')
    require(all(keep(REPEAT / name) in strict['inputs'] for name in
                ('window.json', 'declaration.json', 'readiness.json', 'strict-work-forms.json')),
            'Strict verification does not bind this exact repeat window and prospective inputs')
    for record in strict['inputs']:
        checked(record)
    for record in strict['watchedExternalInputs']:
        external_checked(record)
    aggregate = load(REPEAT / 'combined-comparison.json')
    arithmetic, arithmetic_record, arithmetic_inputs = global_review.verify_consolidation(
        aggregate, keep(REPEAT / 'combined-comparison.json'), keep(REPEAT / 'window.json'), protocol)
    decision = load(REPEAT / 'global-budget-decision.json')
    require(decision['schema'] == 'logos-engine.predeclared-global-cost-window-decision.v1'
            and decision['status'] == 'accepted_under_user_global_rule' and decision['accepted'] is True
            and decision['acceptedCases'] == decision['totalCases'] == 2 and decision['policy'] == policy
            and decision['generator'] == protocol['globalDecisionTool'] and decision['calculationHelper'] == protocol['globalCalculationTool']
            and all(decision[key] == count for key, count in POPULATION.items())
            and aggregate['method']['excludedMeasuredSessions'] == aggregate['method']['excludedOutliers'] == 0
            and aggregate['method']['selectedCohort'] is None and aggregate['method']['noiseAllowanceAdded'] is False,
            'Fresh repeat global rule did not pass without sample selection')
    require(aggregate['generator'] == next(record for record in protocol['officialTools']
                if record['path'] == 'scripts/compare-native-cost-cohorts.mjs')
            and aggregate['method']['workMetadataExactAcrossAllSessions'] is True,
            'The unchanged strict cohort consolidator must bind exact work throughout the repeat')
    pooled = {case: {'baseline': [], 'after': []} for case in policy['caseIds']}
    ledger, warmups, rows = [], [], []
    require(len(aggregate['inputs']['cohorts']) == 2, 'Both fresh cohorts are required')
    for index, cohort in enumerate(aggregate['inputs']['cohorts'], 1):
        for side, prefix, role, manifest in (('baseline', 'A', 'baseline', baseline), ('after', 'B', 'candidate', native)):
            path, label = REPEAT / f'cohort{index}/{side}.json', prefix + str(index)
            report, record = load(path), keep(path)
            execution = next(row for row in window['executions'] if row['label'] == label)
            require(cohort[side] == record and record in strict['inputs'] and record in decision['inputs']
                    and execution['status'] == 'passed' and execution['reportSha256'] == record['sha256']
                    and report['nativeSource'] == manifest and report['nativeSourceUnchanged'] is True
                    and report['manifest'] == cases, 'Only the exact newly measured reports may enter repeat acceptance')
            if side == 'after':
                committed(report['gitHead'])
                require(instant(git('show', '-s', '--format=%cI', report['gitHead']).decode().strip()) <= instant(window['startedAt']),
                        'Candidate repeat requirements were committed after sampling began')
            else:
                require(report['gitHead'] == baseline_publication['commit'], 'Baseline report names another publication')
            for item in report['cases']:
                require([(t['round'], t['warmup']) for t in item['trials']] == [(0, True), (1, False), (2, False), (3, False), (4, False)],
                        'Fresh trial multiplicity/order differs')
                for trial in item['trials']:
                    form = next(row for row in forms['forms'] if row['case'] == trial['case'] and row['warmup'] == trial['warmup'])
                    require(trial['actions'] == form['actions'], 'Fresh action population differs')
                    rows.append({'label': label, 'role': role, 'case': trial['case'], 'round': trial['round'], 'warmup': trial['warmup'],
                                 'actions': trial['actions'], 'signatureSha256': form['signatureSha256'], 'passed': True})
                    if trial['warmup']:
                        warmups.append(trial['actions'])
                    else:
                        elapsed = trial['replayElapsedMs']; require(type(elapsed) in (int, float) and math.isfinite(elapsed) and elapsed > 0, 'Invalid session time')
                        pooled[trial['case']][side].append(elapsed)
                        ledger.append({'cohort': cohort['id'], 'side': side, 'case': trial['case'], 'round': trial['round'],
                                       'startedAt': trial['startedAt'], 'actions': trial['actions'], 'elapsedMs': elapsed})
    canonical = global_review.canonical_ledger
    require(len(rows) == 40 and canonical(rows) == canonical(strict['checks']) and len(ledger) == 32
            and sum(row['actions'] for row in ledger) == 400 and len(warmups) == 8 and sum(warmups) == 24
            and canonical(ledger) == canonical(decision['sessionLedger']), 'Fresh session ledger is incomplete or mixes windows')
    require([row['case'] for row in decision['globalCases']] == ['STCK', 'SMLP'], 'Both independent global cases are required')
    for row in decision['globalCases']:
        before, after = [statistics.median(pooled[row['case']][side]) for side in ('baseline', 'after')]
        require(len(pooled[row['case']]['baseline']) == len(pooled[row['case']]['after']) == row['sessionsPerVersion'] == 8
                and before == row['beforeMedianMs'] and after == row['afterMedianMs'] and row['accepted'] is True
                and math.isclose((after-before)/before, row['medianRelativeIncrease'], rel_tol=1e-12, abs_tol=1e-12)
                and global_review.within(before, after), 'Fresh pooled global median is not strictly below +10%')
    render = load(REPEAT / 'results-render.json')
    require(render['status'] == 'rendered_retained_receipts' and render['generator'] == tool_records['renderer']
            and render['report'] == keep(REPEAT / 'results.md') and render['inputReceiptsUnchanged'] is True
            and instant(strict['recordedAt']) <= instant(render['recordedAt']), 'Rendering must follow repeat strict verification')
    for value in (arithmetic, decision, render):
        for record in value['inputs']:
            checked(record)
        for record in value.get('watchedExternalInputs', []):
            external_checked(record)
    require(decision['diagnosticPhaseRule'] == {key: aggregate[key] for key in ('status', 'budgetMetricCount', 'withinObservedBudget', 'unresolved')},
            'Phase diagnostics were changed or hidden')
    acceptance_status = load(REPEAT / 'lane-status-accept.json') if args.mode == 'recheck' else snapshot('accept')
    require(validate_snapshot(start_status, 'start') == validate_snapshot(acceptance_status, 'accept')
            and instant(end_status['recordedAt']) <= instant(acceptance_status['recordedAt']),
            'A newly disclosed deviation or loss of quiet must prevent acceptance')
    keep(REPEAT / 'lane-status-accept.json')
    stable()
    head = git('rev-parse', 'HEAD').decode().strip()
    previous_publication.verify_git_native(head, native)
    value = {'schema': 'logos-engine.followup-isolation-revalidation.v1', 'status': 'accepted_from_complete_clean_repeat',
        'recordedAt': now(), 'generator': keep(SCRIPT), 'repeatDeclaration': keep(declaration_path),
        'firstWindowEligibility': repeat['firstWindowEligibility'], 'previousPublicationInputs': repeat['originalPublicationInputs'],
        'incidentAcknowledgment': repeat['incidentAcknowledgment'], 'newWindow': keep(REPEAT / 'window.json'),
        'strictVerification': keep(REPEAT / 'strict-work-verification.json'), 'globalDecision': keep(REPEAT / 'global-budget-decision.json'),
        'lockWindow': keep(REPEAT / 'lock-window.json'), 'readiness': keep(readiness_path), 'render': keep(REPEAT / 'results-render.json'),
        'laneStatusStart': keep(REPEAT / 'lane-status-start.json'), 'laneStatusEnd': keep(REPEAT / 'lane-status-end.json'),
        'laneStatusAtAcceptance': keep(REPEAT / 'lane-status-accept.json'),
        'nativeDigests': repeat['nativeDigests'], 'sourceCommit': head, 'formalTests': counts, 'nativeAgentWorker': worker,
        'functionalCaptureRepeated': False, 'newFunctionalSessions': 0, 'checkedTrials': 40, **POPULATION,
        'globalCases': decision['globalCases'], 'diagnosticPhaseRule': decision['diagnosticPhaseRule'],
        'firstAttemptBytesUnchanged': True, 'selectedBetweenWindows': False, 'pooledBetweenWindows': False,
        'inputs': list(tracked.values()), 'watchedExternalInputs': list(external.values()),
        'qualification': 'Only the complete fresh repeat supplies eligible timing evidence. The entire first window remains '
            'withdrawn for isolation, with its values and published history preserved unchanged. Functional evidence is reused '
            'after current-byte verification. This receipt executes no publication and changes no game/runtime source.'}
    if args.mode == 'recheck':
        prior = load(output)
        require(prior['status'] == value['status'] and prior['generator'] == value['generator']
                and git('show', head + ':' + output.relative_to(ROOT).as_posix()) == output.read_bytes(), 'Accepted repeat receipt is not preserved in current HEAD')
        git('merge-base', '--is-ancestor', prior['sourceCommit'], head)
        for record in prior['inputs']:
            checked(record)
        for record in prior['watchedExternalInputs']:
            external_checked(record)
        for key in value.keys() - {'recordedAt', 'sourceCommit', 'inputs', 'watchedExternalInputs'}:
            require(prior[key] == value[key], 'Accepted repeat binding changed: ' + key)
        print(json.dumps({'status': 'passed', 'acceptedRepeat': fp(output), 'currentSourceCommit': head, 'inputsUnchanged': True}))
    else:
        write(output, value)
        print(json.dumps({'status': value['status'], 'receipt': fp(output), 'globalCases': decision['globalCases']}))


if __name__ == '__main__':
    main()
