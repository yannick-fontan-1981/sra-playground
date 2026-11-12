#!/usr/bin/env python3
"""Prospective bounded Lot 9A official window. No peer-availability wait.

This controller runs only the unchanged historical ABBA runner. Analysis and
publication are separate operations after release. Read README.md for the
prospective plan/readiness contract and the limits of namespace observations.
"""
from __future__ import annotations

import argparse
import ctypes
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
import traceback

sys.dont_write_bytecode = True
import common as c

SELF = Path(__file__).resolve()
RUNNER = 'scripts/run-native-cost-window.py'
MEASUREMENT = 'scripts/measure-native-loop-costs.mjs'
PLAN_SCHEMA = 'logos-engine.lot9a.official-performance-plan.v1'
READINESS_SCHEMA = 'logos-engine.lot9a.official-performance-readiness.v1'
NATIVE_FOLDERS = ('src/logos-engine', 'src/runtime')
LIMITS = {'preflightSeconds': 180, 'measurementSeconds': 1800,
          'terminationGraceSeconds': 10, 'killGraceSeconds': 10,
          'retentionSeconds': 60, 'observationIntervalSeconds': 30}
CASE_SPEC = [('STCK', 10, '4610327ca5c6b67e3a42983cc55b40eab3d5aa858a185d8e81f753ba2bcb7e6b'),
             ('SMLP', 15, '325ff611d1f80d0c07ce2c4ee8af707297a918d505db607c35cf411db9753de9')]
HISTORICAL_TOOLS = ['scripts/run-native-cost-window.py', 'scripts/measure-native-loop-costs.mjs',
                    'scripts/compare-native-loop-costs.mjs', 'scripts/compare-native-cost-cohorts.mjs',
                    'scripts/review-native-cost-consolidation.py', 'scripts/review-native-global-cost-window.py',
                    'scripts/review-native-global-cost-budget.py']


def native_inventory(root, deadline):
    import hashlib
    files = {}
    for folder in NATIVE_FOLDERS:
        for path in (root / folder).rglob('*'):
            c.check_time(deadline)
            if path.is_file() and path.suffix in {'.ts', '.json', '.drm'}:
                c.canonical(path, root)
                files[path.relative_to(root).as_posix()] = c.fingerprint(path, deadline)['sha256']
    files = dict(sorted(files.items()))
    return {'fileCount': len(files), 'digest': hashlib.sha256(
        json.dumps(files, separators=(',', ':')).encode()).hexdigest(), 'files': files}


def group_exists(group):
    try:
        os.killpg(group, 0)
        return True
    except ProcessLookupError:
        return False


def reap_adopted(child):
    # Poll the direct child first so Popen retains its real exit code. Any later
    # waitpid result belongs to an adopted descendant of this subreaper.
    child.poll()
    if child.returncode is None:
        return []
    results = []
    while True:
        try:
            pid, status = os.waitpid(-1, os.WNOHANG)
        except ChildProcessError:
            break
        if pid == 0:
            break
        results.append({'pid': pid, 'exitCode': os.waitstatus_to_exitcode(status)})
    return results


def owned_descendants():
    """PPID closure, including descendants adopted by this Linux subreaper."""
    rows = {}
    for path in Path('/proc').iterdir():
        if not path.name.isdigit():
            continue
        try:
            text = (path / 'stat').read_text()
            tail = text[text.rfind(')') + 2:].split()
            rows[int(path.name)] = {'pid': int(path.name), 'parentPid': int(tail[1]),
                                    'processGroup': int(tail[2]), 'startTicks': int(tail[19])}
        except (OSError, ValueError, IndexError):
            pass
    family = {os.getpid()}
    while True:
        new = {pid for pid, item in rows.items() if item['parentPid'] in family} - family
        if not new:
            break
        family.update(new)
    return [rows[pid] for pid in sorted(family - {os.getpid()}) if pid in rows]


def signal_owned_outside_group(group, signum):
    signaled = []
    for item in owned_descendants():
        if item['processGroup'] == group:
            continue
        try:
            text = Path('/proc', str(item['pid']), 'stat').read_text()
            tail = text[text.rfind(')') + 2:].split()
            if int(tail[19]) != item['startTicks']:
                continue
            os.kill(item['pid'], signum)
            signaled.append(item)
        except (ProcessLookupError, FileNotFoundError):
            pass
    return signaled


def stop_group(child, limits):
    result = {'processGroup': child.pid, 'termSent': False, 'killSent': False,
              'adoptedChildrenReaped': [], 'escapedDescendantsSignaled': [], 'startedAt': c.utc()}
    for signum, name, seconds in [(signal.SIGTERM, 'termSent', limits['terminationGraceSeconds']),
                                  (signal.SIGKILL, 'killSent', limits['killGraceSeconds'])]:
        result['adoptedChildrenReaped'].extend(reap_adopted(child))
        if not group_exists(child.pid) and not owned_descendants():
            break
        try:
            if group_exists(child.pid):
                os.killpg(child.pid, signum)
                result[name] = True
        except ProcessLookupError:
            pass
        result['escapedDescendantsSignaled'].extend(signal_owned_outside_group(child.pid, signum))
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            result['adoptedChildrenReaped'].extend(reap_adopted(child))
            if not group_exists(child.pid) and not owned_descendants():
                break
            # A descendant may fork/escape after the first signal. Only the
            # controller's current PPID closure is signaled, with start-time
            # validation; no peer process is selected by a command name.
            result['escapedDescendantsSignaled'].extend(signal_owned_outside_group(child.pid, signum))
            time.sleep(0.05)
    result['adoptedChildrenReaped'].extend(reap_adopted(child))
    result.update(finishedAt=c.utc(), directChildReaped=child.returncode is not None,
                  processGroupStopped=not group_exists(child.pid), remainingOwnedDescendants=owned_descendants(),
                  exitCode=child.returncode)
    return result


def check_readiness(plan, baseline, known_inputs, deadline):
    path = c.verify_input(plan['readiness'], baseline, deadline)
    c.require(path in known_inputs and path.is_relative_to(c.EVIDENCE), 'Readiness must be a frozen 9A input')
    readiness = c.read_json(path)
    c.require(readiness.get('schema') == READINESS_SCHEMA, 'Unsupported readiness schema')
    c.require(readiness.get('measurementAuthorized') is True and readiness.get('pendingRequirements') == [],
              'Official measurement is not ready')
    c.require(readiness.get('candidateCommit') == plan['candidateCommit'] and
              readiness.get('baselineCommit') == plan['baselineCommit'], 'Readiness source identities differ')
    c.require(readiness.get('contract') == plan['contract'], 'Readiness does not bind the declared cost contract')
    closure = readiness.get('ownWorkClosed', {})
    c.require(closure.get('allPreparationCommandsTerminal') is True and
              closure.get('activeExecutionSessions') == [] and closure.get('activeCommands') == [] and
              closure.get('activeWorkers') == [], 'Own preparation closure is incomplete')
    isolation = readiness.get('isolation', {})
    c.require(isolation.get('established') is True, 'Actual measurement isolation is not established')
    c.require(isolation.get('flockAloneIsEvidence') is False, 'A mutex alone is not isolation evidence')
    c.require(isinstance(isolation.get('basis'), str) and isolation['basis'].strip() and
              isinstance(isolation.get('scope'), str) and isolation['scope'].strip(),
              'Explicit isolation basis and scope required')
    c.require(isinstance(isolation.get('limitations'), list), 'Isolation limitations must be explicit')
    evidence = isolation.get('evidence')
    c.require(isinstance(evidence, list) and evidence, 'Actual isolation evidence must be linked before launch')
    for item in evidence:
        path = c.verify_input(item, baseline, deadline)
        c.require(path in known_inputs, 'Isolation evidence is not in the frozen input set')
    return readiness


def verify_cost_contract(plan, baseline, known_inputs, manifests, deadline):
    contract_path = c.input_path(plan['contract'], baseline)
    contract = c.read_json(contract_path)
    c.require(contract.get('schema') == 'logos-engine.lot9a-final-cost-contract.v1' and
              contract.get('status') == 'declared_before_official_window', 'Unsupported prospective cost contract')
    c.require(contract.get('performanceDirectory') == plan['performanceDirectory'], 'Cost contract targets another window')
    c.require(type(plan.get('baselineSiteVersion')) is int and plan['baselineSiteVersion'] > 0,
              'Actual observed baseline Site version required')

    def check_contract_fingerprint(item):
        c.require(isinstance(item, dict) and set(item) == {'path', 'bytes', 'sha256'}, 'Invalid contract fingerprint')
        value = Path(item['path'])
        if value.is_absolute():
            value = c.canonical(value, baseline)
            normalized = {'role': 'baseline', 'path': value.relative_to(baseline).as_posix(),
                          'bytes': item['bytes'], 'sha256': item['sha256']}
        else:
            normalized = {'role': 'candidate', **item}
        path = c.verify_input(normalized, baseline, deadline)
        c.require(path in known_inputs, 'Contract input is missing from the controller freeze: ' + str(path))
        return path

    for role, root in [('baseline', baseline), ('candidate', c.ROOT)]:
        identity = contract.get(role, {})
        manifest = manifests[role]
        c.require(identity.get('checkout') == str(root) and
                  identity.get('nativeVersion') == plan[role + 'NativeVersion'] and
                  identity.get('nativeDigest') == manifest['digest'] and
                  identity.get('nativeFiles') == manifest['fileCount'], 'Cost contract source identity mismatch: ' + role)
        c.require(check_contract_fingerprint(identity['manifest']) == c.input_path(plan[role + 'Manifest'], baseline),
                  'Cost contract manifest differs: ' + role)
        _head, committed_names = c.source_commit(root, identity.get('sourceCommit'), deadline, exact_head=role == 'baseline')
        c.require(committed_names == set(manifest['files']), 'Cost contract source commit names another native tree')
        if role == 'baseline':
            c.require(identity.get('sourceCommit') == plan['baselineCommit'] and
                      identity.get('siteVersion') == plan['baselineSiteVersion'], 'Cost baseline publication differs')
        else:
            c.require(identity.get('siteVersion') is None, 'A candidate must not be presented as already published')
    c.require(contract.get('nativeDigests') == {role: item['digest'] for role, item in manifests.items()},
              'Cost contract native digest mapping differs')
    expected_command = ['python', '-B', RUNNER, str(baseline), plan['performanceDirectory'],
                        contract['baseline']['manifest']['path'], contract['candidate']['manifest']['path']]
    expected_measurement = {'order': ['A1', 'B1', 'B2', 'A2'], 'rounds': 4,
                            'measuredSessions': 32, 'measuredActions': 400, 'warmupSessions': 8,
                            'warmupActions': 24, 'sessionsPerCaseVersion': 8, 'excludedMeasuredSessions': 0,
                            'excludedOutliers': 0, 'command': expected_command,
                            'proposedMaximumActiveSeconds': LIMITS['measurementSeconds']}
    c.require(contract.get('measurement') == expected_measurement, 'Cost contract changes the fixed ABBA population or command')
    rule = contract.get('globalRule', {})
    c.require({key: rule.get(key) for key in ['stage', 'relativeIncreaseLimit', 'comparison', 'allCasesMustPass',
                                            'crossCaseCompensation', 'phaseOverrunsMayBeAccepted']} ==
              {'stage': 'session_elapsed', 'relativeIncreaseLimit': 0.1, 'comparison': 'strictly_less_than',
               'allCasesMustPass': True, 'crossCaseCompensation': False, 'phaseOverrunsMayBeAccepted': True},
              'Cost contract global rule differs from user authorization')
    c.require(contract.get('structuralRule') == {'owner': 'public_chart_navigation', 'addedPrograms': ['v6.chart_navigation.choose'],
              'allowedPaths': ['observations[*].nodeCount', 'inspection[*].graphNodes', 'final.nodeCount', 'final.graphRevision'],
              'mode': 'exact_predeclared_functional_values', 'unattributedDifferencesAllowed': 0},
              'Cost contract expands the admitted structural differences')
    c.require(contract.get('controls') == {'noNativeExecution': True, 'readinessEstablished': False,
              'isolationEstablished': False, 'publicationAuthorizedByThisContract': False,
              'historicalFunctionalProofsUnchanged': True}, 'Cost preparation scope changed')
    performance = c.local(plan['performanceDirectory'], evidence=True)
    for key, filename in [('cases', 'cases.json'), ('comparisonPolicy', 'comparison-policy.json'),
                          ('expectedForms', 'expected-forms.json'), ('protocol', 'protocol.md')]:
        c.require(check_contract_fingerprint(contract[key]) == performance / filename,
                  'Cost declaration binds a different performance file: ' + key)
    for key in ('functionalForms', 'graphReview', 'ownerInventory', 'functionalReview', 'reconciliation'):
        check_contract_fingerprint(contract[key])
    historical = contract.get('historicalTools')
    c.require(isinstance(historical, list) and [item.get('path') for item in historical] == HISTORICAL_TOOLS,
              'Cost contract changes the seven historical tools')
    for item in historical:
        check_contract_fingerprint(item)
        baseline_item = {'role': 'baseline', **item}
        c.require(c.verify_input(baseline_item, baseline, deadline) in known_inputs,
                  'Baseline historical tool missing from controller freeze')
    result = subprocess.run(['git', 'diff', '--quiet', plan['baselineCommit'], '--', *HISTORICAL_TOOLS],
                            cwd=baseline, capture_output=True,
                            timeout=max(0.1, min(10, deadline - time.monotonic())))
    c.require(result.returncode == 0, 'Baseline historical measurement tools differ from their published commit')
    supplementary = contract.get('supplementaryTools', {})
    c.require(set(supplementary) == {'analyzer', 'reviewer'}, 'Unexpected supplementary analysis tools')
    for item in supplementary.values():
        check_contract_fingerprint(item)
    inputs = contract.get('inputFingerprints')
    c.require(isinstance(inputs, list) and inputs, 'Cost contract lacks its immutable inputs')
    for item in inputs:
        check_contract_fingerprint(item)
    return {'schema': contract['schema'], 'sourceIdentitiesVerified': True,
            'populationCommandAndRulesVerified': True, 'allContractInputsFrozen': True}


def verify_preparation(plan, baseline, deadline, execution_head):
    known = c.verify_inputs(plan['immutableInputs'], baseline, deadline)
    required = {SELF, SELF.with_name('common.py'), c.ROOT / RUNNER, baseline / RUNNER,
                c.ROOT / MEASUREMENT, baseline / MEASUREMENT}
    c.require(required <= known, 'Controller, shared helper and both unchanged runner copies must be frozen')
    for key in ('baselineManifest', 'candidateManifest', 'contract', 'readiness'):
        path = c.verify_input(plan[key], baseline, deadline)
        c.require(path in known and path.is_relative_to(c.EVIDENCE), 'Required declaration is outside frozen 9A evidence: ' + key)
    manifests = {}
    for root, key in [(baseline, 'baseline'), (c.ROOT, 'candidate')]:
        head, committed_names = c.source_commit(root, plan[key + 'Commit'], deadline, exact_head=key == 'baseline')
        if key == 'candidate':
            c.require(head == execution_head, 'Candidate execution HEAD changed')
        c.require(c.native_version(root) == plan[key + 'NativeVersion'], 'Native version changed: ' + key)
        manifest = c.read_json(c.input_path(plan[key + 'Manifest'], baseline))
        manifests[key] = manifest
        c.require(committed_names == set(manifest['files']), 'Native manifest includes missing or uncommitted files: ' + key)
        c.require(native_inventory(root, deadline) == manifest, 'Frozen native inventory differs: ' + key)
        for name in manifest['files']:
            c.require(root / name in known, 'Native source missing from immutable input set: ' + name)
    c.require(c.fingerprint(c.ROOT / RUNNER, deadline) == c.fingerprint(baseline / RUNNER, deadline),
              'Historical ABBA runners differ')
    c.require(c.fingerprint(c.ROOT / MEASUREMENT, deadline) == c.fingerprint(baseline / MEASUREMENT, deadline),
              'Historical measurement runners differ')
    performance = c.local(plan['performanceDirectory'], evidence=True)
    c.require(performance.is_dir(), 'Prepared performance directory required')
    for name in ('cases.json', 'comparison-policy.json', 'protocol.md'):
        c.require(performance / name in known, 'Required performance input is not frozen: ' + name)
    cases = c.read_json(performance / 'cases.json')
    c.require(cases.get('rounds') == 4 and len(cases.get('cases', [])) == 2, 'Historical two-case/four-round scope required')
    for item, (game, actions, digest) in zip(cases['cases'], CASE_SPEC):
        c.require(item.get('id') == game and item.get('actions') == actions and
                  item.get('warmupActions') == 3 and item.get('targetLevels') == 3 and
                  item.get('traceSha256') == digest, 'Only the frozen STCK/SMLP forms are allowed')
        for root in (c.ROOT, baseline):
            trace = c.canonical(root / item['trace'], root)
            c.require(trace in known and c.fingerprint(trace, deadline)['sha256'] == digest,
                      'Frozen public trace unavailable')
    verify_cost_contract(plan, baseline, known, manifests, deadline)
    return performance, known, check_readiness(plan, baseline, known, deadline)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', required=True, help='Prospective repository-relative 9A plan')
    parser.add_argument('--output', required=True, help='New repository-relative 9A controller evidence directory')
    args = parser.parse_args()
    plan_path = c.local(args.plan, evidence=True)
    output = c.local(args.output, evidence=True, must_exist=False)
    c.require(output != c.EVIDENCE and not output.exists(), 'New dedicated output directory required')
    output.mkdir(parents=True, exist_ok=False)
    c.signals()
    started = time.monotonic()
    preflight_deadline = started + LIMITS['preflightSeconds']
    lease = 'lot9a-performance-' + str(os.getpid()) + '-' + os.urandom(6).hex()
    receipt_path = output / 'controller.json'
    lock = c.ExclusiveLock('performance')
    row = {'schema': 'logos-engine.lot9a.official-performance-controller.v1', 'status': 'preflight',
           'startedAt': c.utc(), 'plan': args.plan, 'limits': LIMITS, 'lease': lease,
           'automaticRetry': False, 'peerAvailabilityWait': False, 'peerAcknowledgmentsRequired': False,
           'measurementStarted': False, 'officialCostAcceptedByController': False,
           'globalQuietInferredFromLock': False, 'processArgumentsCollected': False,
           'processEnvironmentsCollected': False, 'lock': lock.record, 'cleanup': {}}
    c.atomic_json(output / 'controller.started.json', row, create=True)
    c.atomic_json(receipt_path, row, create=True)
    child = None
    libc = None
    previous_subreaper = None
    active_status_written = False
    log_handles = []
    exit_code = 1
    baseline = None
    plan = None
    expected_plan = None
    try:
        expected_plan = c.fingerprint(plan_path, preflight_deadline)
        row['planFingerprint'] = expected_plan
        plan = c.read_json(plan_path)
        c.require(plan.get('schema') == PLAN_SCHEMA and plan.get('owner') == 'lot9a', 'Unsupported official plan')
        c.require(plan.get('limits') == LIMITS, 'Declared bounded limits differ from this controller')
        c.require(c.COMMIT.fullmatch(plan['candidateCommit']) and c.COMMIT.fullmatch(plan['baselineCommit']), 'Full commit identities required')
        for key in ('candidateNativeVersion', 'baselineNativeVersion'):
            c.require(isinstance(plan.get(key), str) and c.VERSION.fullmatch(plan[key]), 'Invalid native version')
        baseline = c.baseline_path(plan['baselineCheckout'])
        execution_head = c.current_head(c.ROOT, preflight_deadline)
        row['executionHead'] = execution_head
        performance, known, readiness = verify_preparation(plan, baseline, preflight_deadline, execution_head)
        c.require(not (performance / 'window.json').exists(), 'An official attempt already exists; never retry in place')
        c.require(output != performance and not output.is_relative_to(performance), 'Controller output must be separate from measurement outputs')
        c.own_idle_status()
        before = c.process_snapshot((c.ROOT, baseline))
        row['ownWorkCheck'] = c.require_no_visible_own_work(before)
        c.atomic_json(output / 'environment-before.json', before, create=True)
        row['isolationDeclaration'] = readiness['isolation']
        row['preflightFinishedAt'] = c.utc()
        c.check_time(preflight_deadline)
        if not lock.acquire():
            row.update(status='unavailable', reason='performance_mutex_busy_no_wait')
            exit_code = 75
        else:
            acquired = time.monotonic()
            measurement_deadline = acquired + LIMITS['measurementSeconds']
            row['measurementDeadlineSecondsFromAcquisition'] = LIMITS['measurementSeconds']
            row['maximumExclusiveSecondsIncludingCleanupAndRetention'] = (
                LIMITS['measurementSeconds'] + LIMITS['terminationGraceSeconds'] +
                LIMITS['killGraceSeconds'] + LIMITS['retentionSeconds'])
            c.own_idle_status()
            c.update_own_status('performance', lease, True)
            active_status_written = True
            # The preparation itself ran unlocked. This final integrity check
            # binds the measured bytes immediately after acquiring exclusivity.
            c.require(c.fingerprint(plan_path, measurement_deadline) == expected_plan, 'Plan changed before launch')
            verify_preparation(plan, baseline, measurement_deadline, execution_head)
            lock.check_identity()
            c.require_no_visible_own_work(c.process_snapshot((c.ROOT, baseline)))
            c.check_time(measurement_deadline)
            libc, previous_subreaper = c.enable_subreaper()
            command = [sys.executable, '-B', RUNNER, str(baseline), plan['performanceDirectory'],
                       str(c.input_path(plan['baselineManifest'], baseline)),
                       str(c.input_path(plan['candidateManifest'], baseline))]
            stdout = (output / 'runner.stdout.log').open('xb', buffering=0)
            log_handles.append(stdout)
            stderr = (output / 'runner.stderr.log').open('xb', buffering=0)
            log_handles.append(stderr)
            environment = os.environ.copy()
            environment['PYTHONDONTWRITEBYTECODE'] = '1'
            expected_parent = os.getpid()
            def parent_death_signal():
                # Best-effort direct-child death protection. Complete cleanup
                # after catchable signals is performed by the owning controller.
                native = ctypes.CDLL(None, use_errno=True)
                if native.prctl(1, signal.SIGTERM, 0, 0, 0) != 0 or os.getppid() != expected_parent:
                    os._exit(125)
            child = subprocess.Popen(command, cwd=c.ROOT, env=environment, stdout=stdout,
                                     stderr=stderr, start_new_session=True, close_fds=True,
                                     preexec_fn=parent_death_signal)
            row.update(status='running', measurementStarted=True, command=command,
                       childPid=child.pid, processGroup=child.pid, executionStartedAt=c.utc())
            c.atomic_json(receipt_path, row)
            c.emit({'status': 'running', 'lease': lease, 'processGroup': child.pid,
                    'output': args.output, 'maximumMeasurementSeconds': LIMITS['measurementSeconds']})
            next_observation = time.monotonic()
            with (output / 'environment-during.jsonl').open('x') as observations:
                while child.poll() is None:
                    c.check_time(measurement_deadline)
                    lock.check_identity()
                    now = time.monotonic()
                    if now >= next_observation:
                        snapshot = c.process_snapshot((c.ROOT, baseline))
                        observations.write(json.dumps(snapshot) + '\n')
                        observations.flush()
                        unexpected = [item for item in snapshot['processes']
                                      if item['cwdScope'] in {'candidate_checkout', 'baseline_checkout'} and
                                      item['pid'] not in row['ownWorkCheck']['allowedControllerAncestors'] and
                                      item['processGroup'] != child.pid]
                        if unexpected:
                            row['unexpectedVisibleOwnProcesses'] = unexpected
                            raise RuntimeError('Unannounced visible own work started during measurement')
                        row.update(lastObservedAt=c.utc(), elapsedMeasurementSeconds=now - acquired,
                                   stdoutBytes=(output / 'runner.stdout.log').stat().st_size,
                                   stderrBytes=(output / 'runner.stderr.log').stat().st_size)
                        c.atomic_json(receipt_path, row)
                        c.emit({'status': 'running', 'elapsedSeconds': round(now - acquired, 2)})
                        next_observation = now + LIMITS['observationIntervalSeconds']
                    time.sleep(0.2)
                os.fsync(observations.fileno())
            row['exitCode'] = child.wait(timeout=LIMITS['killGraceSeconds'])
            row['adoptedChildrenReaped'] = reap_adopted(child)
            c.require(not group_exists(child.pid) and not owned_descendants(), 'Descendant outlived the historical runner')
            c.require(row['exitCode'] == 0, 'Historical ABBA runner failed')
            window = c.read_json(performance / 'window.json')
            c.require(window.get('status') == 'passed' and window.get('finalIntegrity') == 'passed', 'Window is incomplete or failed')
            c.require([item.get('label') for item in window.get('executions', [])] == ['A1', 'B1', 'B2', 'A2'] and
                      all(item.get('status') == 'passed' for item in window['executions']), 'ABBA population incomplete')
            retention_deadline = time.monotonic() + LIMITS['retentionSeconds']
            c.require(c.fingerprint(plan_path, retention_deadline) == expected_plan, 'Plan changed during window')
            verify_preparation(plan, baseline, retention_deadline, execution_head)
            row['finalInputIntegrity'] = 'passed'
            row['window'] = {'path': str(performance / 'window.json'), **c.fingerprint(performance / 'window.json', retention_deadline)}
            row['status'] = 'completed_pending_independent_analysis'
            exit_code = 0
    except BaseException as error:
        row.update(status='failed', error=type(error).__name__ + ': ' + str(error), traceback=traceback.format_exc())
        row['interrupted'] = c.STOP_SIGNAL is not None
        row['timedOut'] = isinstance(error, TimeoutError)
        exit_code = 130 if row['interrupted'] else (124 if row['timedOut'] else 1)
    finally:
        # Cleanup never depends on successful receipt/status writes.
        if child is not None:
            try:
                if child.poll() is None or group_exists(child.pid) or owned_descendants():
                    row['cleanup']['group'] = stop_group(child, LIMITS)
                else:
                    row['cleanup']['group'] = {'processGroup': child.pid,
                        'adoptedChildrenReaped': reap_adopted(child), 'directChildReaped': True,
                        'processGroupStopped': True, 'remainingOwnedDescendants': [], 'exitCode': child.returncode}
                if (not row['cleanup']['group']['directChildReaped'] or
                    not row['cleanup']['group']['processGroupStopped'] or
                    row['cleanup']['group']['remainingOwnedDescendants']):
                    row['status'] = 'failed_cleanup_incomplete'
                    exit_code = 1
            except BaseException as error:
                row['cleanup']['error'] = type(error).__name__ + ': ' + str(error)
                row['status'] = 'failed_cleanup_incomplete'
                exit_code = 1
        else:
            row['cleanup']['group'] = {'directChildReaped': True, 'processGroupStopped': True,
                                       'remainingOwnedDescendants': [], 'childNeverStarted': True}
        # The owned descriptor is released even when process cleanup or output
        # storage fails. Such a run cannot be accepted as an official result.
        row['lock'] = lock.release()
        if row['lock'].get('releaseErrors') or row['lock'].get('sameLockFile') is False:
            row['status'] = 'failed_lock_integrity'
            exit_code = 1
        if active_status_written:
            try:
                row['statusRelease'] = c.update_own_status('performance', lease, False)
                if not row['statusRelease']['updated']:
                    row['status'] = 'failed_status_release'
                    exit_code = 1
            except BaseException as error:
                row['statusReleaseError'] = type(error).__name__ + ': ' + str(error)
                row['status'] = 'failed_status_release'
                exit_code = 1
        for stream in log_handles:
            try:
                stream.flush()
                os.fsync(stream.fileno())
                stream.close()
            except BaseException as error:
                row.setdefault('retentionErrors', []).append(type(error).__name__ + ': ' + str(error))
        if libc is not None:
            row['subreaperRestored'] = libc.prctl(36, previous_subreaper, 0, 0, 0) == 0
            if not row['subreaperRestored']:
                row['status'] = 'failed_cleanup_incomplete'
                exit_code = 1
        retention_deadline = time.monotonic() + LIMITS['retentionSeconds']
        for name in ('runner.stdout.log', 'runner.stderr.log', 'environment-during.jsonl'):
            path = output / name
            if path.exists():
                try:
                    row.setdefault('retainedLogs', {})[name] = c.fingerprint(path, retention_deadline, honor_signal=False)
                except BaseException as error:
                    row.setdefault('retentionErrors', []).append(type(error).__name__ + ': ' + str(error))
        try:
            c.atomic_json(output / 'environment-after.json', c.process_snapshot((c.ROOT, baseline) if baseline else (c.ROOT,)), create=True)
        except BaseException as error:
            row.setdefault('retentionErrors', []).append(type(error).__name__ + ': ' + str(error))
        if row.get('retentionErrors'):
            row['status'] = 'failed_evidence_retention'
            exit_code = 1
        row.update(finishedAt=c.utc(), elapsedSeconds=time.monotonic() - started, controllerExitCode=exit_code)
        try:
            c.atomic_json(receipt_path, row)
        except BaseException as error:
            c.emit({'status': 'receipt_storage_failed_after_cleanup', 'error': type(error).__name__ + ': ' + str(error),
                    'lock': row['lock'], 'cleanup': row['cleanup']})
            exit_code = 1
        c.emit({'status': row['status'], 'exitCode': exit_code, 'output': args.output,
                'lockDescriptorClosed': row['lock']['descriptorClosed'], 'sameLockFile': row['lock'].get('sameLockFile'),
                'processGroupStopped': row['cleanup'].get('group', {}).get('processGroupStopped')})
    return exit_code


if __name__ == '__main__':
    sys.exit(main())
