#!/usr/bin/env python3
"""Bind the real completed HPDL proofs to the cost-readiness budget contract.

This reads retained evidence only. It runs no game, native agent, original
Python component, browser, test, replay, build or performance measurement.
Established qualification requires a truly passed six-level cold campaign.
The distinct explicit partial qualification retains only a verified sealed
checkpoint and public journal; it never creates a final report or six-level
completion. The closed not_established qualification requires an actual
complete terminal failed report, its complete trace and exact source parity;
it never promotes that failure to passed or an incomplete PARTIAL checkpoint.
All terminal and non-live work debits remain charged.

  python -B docs/migration/lot10b-evidence/finalize-hpdl-case-budget-review.py \
    --source-manifest <final-freeze>/source-manifest.json \
    --campaign-execution <attempt>/execution-hpdl.json \
    --campaign <attempt>/hpdl-campaign.json.gz \
    --trace <attempt>/hpdl-public-trace.json.gz \
    --source-comparison <actual-window-source-parity.json.gz> \
    --browser-execution <browser-attempt>/execution-hpdl-browser.json \
    --browser-evidence <actual-browser-qa.json> \
    --qualification established --own-live-contribution observed \
    --output <final-directory>/hpdl-case-budget-review.json

Use --own-live-contribution not_established when the linked memory witness is
not established. A passed browser UI receipt, a positive active-record count,
or game success alone never establishes that witness. Browser blocked and
inconclusive outcomes retain their real qualification. Output is exclusive.
For a partial review, replace --campaign/--trace with --checkpoint/--public-journal,
pass --qualification partial and a nonempty --qualification-reason, and use the
distinct verified PARTIAL source comparison. No final artifact is synthesized.
For an actual complete terminal failed campaign, retain --campaign/--trace,
use --qualification not_established with a nonempty --qualification-reason,
and supply the distinct complete-report source comparison.
"""
from __future__ import annotations

import argparse
from contextlib import ExitStack
from decimal import Decimal
import fcntl
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
BASE = Path(__file__).resolve().parent
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
ORIGINAL = ROOT / 'reference/v6' / COMMIT / 'source'
OWNER = 'public_window_question'
PROGRAM = 'v6.window_question.choose'
IMPLEMENTATION_PREFIX = 'logos-engine.typescript.v6.native-migration/'
LEDGER_LOCK = Path('/workspace/shared/sra-coordination/hpdl-clock-ledger.lock')
CASE_WORK_SCHEMA = 'logos-engine.lot10b.hpdl-conservative-case-work.v1'
DIAGNOSTIC_SCHEMA = 'logos-engine.lot10b.hpdl-clocked-diagnostic.v1'


def load_reader(label, path):
    spec = importlib.util.spec_from_file_location(label, path)
    if spec is None or spec.loader is None:
        raise RuntimeError('Missing retained reader: ' + str(path))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


proof = load_reader('lot10b_hpdl_clock_reader', BASE / 'run-hpdl-clocked-proof.py')
readiness = load_reader('lot10b_readiness_contract', BASE / 'finalize-cost-readiness.py')
require = readiness.require
instant = readiness.instant


def integer(value, label, minimum=0):
    require(type(value) is int and value >= minimum, 'Invalid integer: ' + label)
    return value


def inspect_clock(evidence):
    clock = evidence.read(proof.CLOCK)
    total, remaining = proof.validate_clock(clock)
    require(total <= proof.MAXIMUM_SECONDS and remaining >= 0
            and clock.get('budgetExceededSeconds') == 0
            and clock.get('budgetAvailability') in ('available', 'exhausted'),
            'The closed HPDL cumulative clock must remain within 2400 seconds')
    history = clock['historicalDebit']
    require(history.get('intervalsRecovered') is False
            and isinstance(history.get('qualification'), str) and history['qualification'].strip(),
            'The unavailable historical intervals require their honest retained qualification')
    declaration_path = evidence.path(history['declarationPath'])
    declaration = evidence.read(declaration_path)
    historical = declaration.get('historicallyReportedHPDL', {})
    require(historical.get('chargedSeconds') == history['chargedSeconds']
            and historical.get('actions') == history['actions'] and historical.get('rawLedgerRecovered') is False,
            'The retained recovery declaration differs from the historical debit')
    executions, summaries = {}, []
    previous_end = None
    for entry in clock['attempts']:
        path = evidence.checked(entry['executionReceipt'])
        receipt = evidence.read(path)
        require(receipt.get('attemptId') == entry['attemptId'] and receipt.get('game') == 'HPDL'
                and receipt.get('priorCumulativeSeconds') == entry['priorCumulativeSeconds']
                and receipt.get('remainingBeforeSeconds') == entry['remainingBeforeSeconds'],
                'A terminal execution is not bound to its actual HPDL ledger interval')
        start, capture_end, end = (instant(receipt['startedAt']), instant(receipt['captureFinishedAt']),
                                   instant(entry['finishedAt']))
        require(start == instant(entry['startedAt']) and start <= capture_end <= end,
                'A recorded HPDL interval has inconsistent actual timestamps')
        require(previous_end is None or previous_end <= start, 'Fresh HPDL intervals overlap')
        previous_end = end
        require(proof.finite_seconds(entry['chargedSeconds']) >= proof.finite_seconds(receipt['elapsedSecondsThroughCapture']),
                'A debit omits measured capture time')
        schema = receipt.get('schema')
        require(schema in ('logos-engine.lot10b.hpdl-clocked-execution.v1',
                           'logos-engine.lot10b.hpdl-browser-execution.v1', CASE_WORK_SCHEMA, DIAGNOSTIC_SCHEMA),
                'Unsupported fresh HPDL execution, monotone diagnostic or explicit conservative work receipt')
        evidence.records(receipt)
        summary = {'attemptId': entry['attemptId'], 'kind': ('conservative_case_work' if schema == CASE_WORK_SCHEMA
                   else 'case_diagnostic' if schema == DIAGNOSTIC_SCHEMA
                   else 'browser_qa' if schema.endswith('browser-execution.v1') else 'native_campaign'),
                   'startedAt': receipt['startedAt'], 'finishedAt': entry['finishedAt'],
                   'chargedSeconds': entry['chargedSeconds'], 'executionReceipt': entry['executionReceipt'],
                   'attemptOutcome': entry.get('attemptOutcome'), 'campaignStatus': receipt.get('campaignStatus'),
                   'qualification': 'Every retained terminal interval remains charged, independently of the selected successful campaign.'}
        if schema == 'logos-engine.lot10b.hpdl-clocked-execution.v1':
            require(entry.get('kind') in (None, 'native_campaign'), 'Native receipt has a foreign ledger kind')
            summary['campaignStatus'] = receipt.get('capture', {}).get('campaignStatus')
            summary['observedActionReturns'] = receipt.get('capture', {}).get('publicJournal', {}).get('observedActionReturns')
            summary['completeActionCountEstablished'] = receipt.get('completeActionCountEstablished') is True
            summary['nativeSourceManifestDigest'] = receipt.get('nativeSourceManifestDigest')
        elif schema == 'logos-engine.lot10b.hpdl-browser-execution.v1':
            require(entry.get('kind') == receipt.get('kind') == 'browser_qa'
                    and receipt.get('clockClosureExecutedByOriginalHolder') is True,
                    'The browser debit must have been closed by its original holder')
            begin_path = evidence.checked(receipt['beginReceipt'])
            begin = evidence.read(begin_path)
            request_path = evidence.checked(receipt['endRequest'])
            request = evidence.read(request_path)
            require(begin.get('holder') == receipt.get('holder') and begin['holder']['bootId'] == receipt.get('bootId')
                    and begin.get('monotonicStartedNs') == receipt.get('monotonicStartedNs')
                    and request.get('beginReceipt') == receipt['beginReceipt']
                    and request.get('observation') == receipt.get('observation')
                    and request.get('artifacts') == receipt.get('artifacts'),
                    'Browser begin, immutable request and holder-local receipt differ')
            before, captured, charged = (int(begin['monotonicStartedNs']), int(receipt['monotonicCaptureStoppedNs']),
                                         int(entry['monotonicChargeStoppedNs']))
            require(before <= captured <= charged
                    and float(Decimal(captured - before) / Decimal(1_000_000_000)) == receipt['elapsedSecondsThroughCapture']
                    and float(Decimal(charged - before) / Decimal(1_000_000_000)) == entry['chargedSeconds'],
                    'The browser debit differs from the retained same-boot monotone interval')
            folder = begin_path.parent
            closed = evidence.read(folder / 'browser-closed.json')
            released = evidence.read(folder / 'browser-holder-release.json')
            require(closed.get('schema') == 'logos-engine.lot10b.hpdl-browser-closure.v1'
                    and closed.get('executionReceipt') == entry['executionReceipt']
                    and closed.get('endRequest') == receipt['endRequest']
                    and closed.get('chargedSeconds') == entry['chargedSeconds']
                    and closed.get('clockClosureExecutedByOriginalHolder') is True
                    and released.get('attemptId') == entry['attemptId']
                    and released.get('observedClosure') == evidence.keep(folder / 'browser-closed.json'),
                    'The browser holder did not retain a verified actual terminal closure')
            evidence.records(begin)
            evidence.records(request)
            evidence.records(closed)
            evidence.records(released)
            summary['reportedObservation'] = receipt['reportedObservation']
            summary['completeActionCountEstablished'] = False
            summary['qualification'] = 'Holder-measured browser interval; CUA counts retain their explicit observed/unknown scope and imply no game result.'
        elif schema == DIAGNOSTIC_SCHEMA:
            require(entry.get('kind') == receipt.get('kind') == 'case_diagnostic'
                    and receipt.get('clockBasis') == entry.get('clockBasis') == 'same_process_monotonic_elapsed'
                    and receipt.get('monotoneMeasurement') is True and entry.get('monotoneMeasurement') is True
                    and receipt.get('sameBootAtCapture') is True
                    and receipt.get('gameHostRun') is False and receipt.get('nativeAgentRun') is False
                    and receipt.get('gameplayDurationMeasured') is False and receipt.get('campaignPassedEstablished') is False
                    and entry.get('campaignPassedEstablished') is False
                    and receipt.get('observedActions') is None and receipt.get('observedLevelsCompleted') is None
                    and entry.get('observedActions') is None and entry.get('observedLevelsCompleted') is None
                    and receipt.get('completeActionCountEstablished') is False
                    and entry.get('completeActionCountEstablished') is False,
                    'A case diagnostic must retain its monotone debit without inventing gameplay or action counts')
            begin = evidence.read(evidence.checked(receipt['beginReceipt']))
            prior = evidence.read(evidence.checked(receipt['priorClock']))
            require(begin.get('schema') == 'logos-engine.lot10b.hpdl-diagnostic-begin.v1'
                    and begin.get('status') == 'running' and begin.get('kind') == 'case_diagnostic'
                    and begin.get('attemptId') == receipt['attemptId'] and begin.get('game') == 'HPDL'
                    and begin.get('startedAt') == receipt['startedAt']
                    and isinstance(receipt.get('bootId'), str) and bool(receipt['bootId'])
                    and begin.get('bootId') == receipt.get('bootId') == entry.get('bootId')
                    and begin.get('monotonicStartedNs') == receipt.get('monotonicStartedNs') == entry.get('monotonicStartedNs')
                    and begin.get('priorClock') == receipt.get('priorClock')
                    and begin.get('requiredConservativeDebit') == receipt.get('requiredConservativeDebit') == entry.get('requiredConservativeDebit')
                    and any(row['kind'] == 'conservative_case_work' and row['chargedSeconds'] == 451
                            and row['executionReceipt'] == receipt['requiredConservativeDebit'] for row in summaries)
                    and begin.get('priorCumulativeSeconds') == receipt['priorCumulativeSeconds']
                    and begin.get('remainingBeforeSeconds') == receipt['remainingBeforeSeconds']
                    and prior.get('attempts') == clock['attempts'][:len(summaries)]
                    and prior.get('cumulativeChargedSeconds') == receipt['priorCumulativeSeconds']
                    and prior.get('remainingSeconds') == receipt['remainingBeforeSeconds'],
                    'The diagnostic start and immutable prior ledger do not bind the actual append-only admission')
            before_ns, capture_ns, charge_ns = (int(receipt['monotonicStartedNs']), int(receipt['monotonicCaptureStoppedNs']),
                                               int(entry['monotonicChargeStoppedNs']))
            require(before_ns <= capture_ns <= charge_ns
                    and float(Decimal(capture_ns - before_ns) / Decimal(1_000_000_000)) == receipt['elapsedSecondsThroughCapture']
                    and float(Decimal(charge_ns - before_ns) / Decimal(1_000_000_000)) == entry['chargedSeconds'],
                    'The diagnostic debit differs from the retained same-process monotone bounds')
            ceiling = proof.finite_seconds(receipt['activityCeilingSeconds'])
            require(Decimal('30.5') < ceiling <= Decimal(300)
                    and begin.get('activityCeilingSeconds') == entry.get('activityCeilingSeconds') == float(ceiling)
                    and begin.get('captureReserveSeconds') == receipt.get('captureReserveSeconds') == entry.get('captureReserveSeconds') == 30
                    and begin.get('terminationMarginSeconds') == receipt.get('terminationMarginSeconds') == entry.get('terminationMarginSeconds') == 0.5
                    and begin.get('childActivityCeilingSeconds') == receipt.get('childActivityCeilingSeconds') == entry.get('childActivityCeilingSeconds')
                    == float(ceiling - Decimal('30.5')),
                    'The two diagnostic phases must share the declared ceiling and capture reserve')
            modes = {'writer-parity': ['writer', 'parity'], 'writer': ['writer'], 'parity': ['parity'],
                     'complete-parity': ['complete_parity']}
            mode, plans, phases = receipt.get('mode'), receipt.get('phasePlan'), receipt.get('phases')
            require(mode in modes and begin.get('mode') == entry.get('mode') == mode
                    and isinstance(plans, list) and plans == begin.get('phasePlan') == entry.get('phasePlan')
                    and [plan.get('name') for plan in plans] == modes[mode]
                    and isinstance(phases, list) and len(phases) == len(plans),
                    'Diagnostic phases differ from the closed, prospectively ordered modes')
            original_root = Path(receipt['checkoutRoot'])
            require(original_root.is_absolute() and str(original_root) == begin.get('checkoutRoot'),
                    'The diagnostic command root is not bound to its actual begin receipt')
            names = begin['inputPaths']
            required_names = {'generator', 'cumulativeClockReader', 'diagnosedExecution'}
            if mode == 'complete-parity':
                required_names.update(('campaign', 'publicTrace', 'completeComparator'))
            else:
                required_names.add('checkpoint')
            if 'writer' in modes[mode]:
                required_names.update(('writerChecker', 'streamWriter', 'campaignWriterCaller'))
            if 'parity' in modes[mode]:
                required_names.update(('partialComparator', 'sharedComparisonCore', 'publicJournal'))
            require(set(names) == required_names and names['generator'] == 'docs/migration/lot10b-evidence/run-hpdl-clocked-diagnostic.py'
                    and names['cumulativeClockReader'] == 'docs/migration/lot10b-evidence/run-hpdl-clocked-proof.py',
                    'The fixed diagnostic helper closure differs from its declared input paths')
            last_phase_ns, next_allowed = before_ns, True
            for plan, phase in zip(plans, phases):
                require(all(phase.get(key) == plan.get(key) for key in ('name', 'command', 'resultPath', 'logPath')),
                        'A diagnostic child differs from its prospectively declared command')
                expected_result = ('writer-check.json' if plan['name'] == 'writer' else 'window-source-parity.PARTIAL.json.gz'
                                   if plan['name'] == 'parity' else 'window-source-parity.complete.json.gz')
                require(plan.get('resultPath') == entry['attemptId'] + '/' + expected_result
                        and plan.get('logPath') == entry['attemptId'] + '/' + plan['name'] + '.log',
                        'A diagnostic output escapes its new exclusive attempt directory')
                command = plan['command']
                require(isinstance(command, list) and command and all(isinstance(part, str) for part in command),
                        'A diagnostic command must be an explicit argument vector')
                if plan['name'] == 'writer':
                    require(names['writerChecker'] == 'docs/migration/lot10b-evidence/check-stream-evidence-json.mjs'
                            and names['streamWriter'] == 'docs/migration/lot10b-evidence/stream-evidence-json.mjs'
                            and names['campaignWriterCaller'] == 'docs/migration/lot10b-evidence/run-hpdl-campaign.mjs',
                            'The writer diagnostic may only use its three retained application inputs')
                    expected = [command[0], '--max-old-space-size=1536', '--expose-gc', str(original_root / names['writerChecker']),
                                '--checkpoint', str(original_root / names['checkpoint']), '--execution-receipt',
                                str(original_root / names['diagnosedExecution']), '--output', str(original_root / plan['resultPath'])]
                elif plan['name'] == 'parity':
                    require(names['partialComparator'] == 'scripts/compare-window-question-checkpoint-parity.py'
                            and names['sharedComparisonCore'] == 'scripts/compare-window-question-public-parity.py',
                            'The partial diagnostic may only execute the retained canonical comparator')
                    expected = [command[0], '-B', str(original_root / names['partialComparator']), '--checkpoint',
                                str(original_root / names['checkpoint']), '--journal', str(original_root / names['publicJournal']),
                                '--execution-receipt', str(original_root / names['diagnosedExecution']), '--output',
                                str(original_root / plan['resultPath'])]
                else:
                    require(names['completeComparator'] == 'scripts/compare-window-question-public-parity.py',
                            'Complete parity may only execute the retained canonical complete-report comparator')
                    expected = [command[0], '-B', str(original_root / names['completeComparator']),
                                str(original_root / names['campaign']), '--trace', str(original_root / names['publicTrace']),
                                '--output', str(original_root / plan['resultPath'])]
                require(command == expected, 'The diagnostic command is outside its fixed evidence-tool interface')
                if phase.get('status') == 'not_started':
                    require(phase.get('exitCode') is None and 'monotonicStartedNs' not in phase
                            and phase.get('childSpawnEstablished') is False,
                            'An unstarted diagnostic phase must not have fabricated execution timing')
                    next_allowed = False
                    continue
                phase_start, phase_end = int(phase['monotonicStartedNs']), int(phase['monotonicFinishedNs'])
                require(next_allowed and phase.get('status') in ('returned', 'interrupted', 'activity_timeout', 'wrapper_error')
                        and last_phase_ns <= phase_start <= phase_end <= capture_ns
                        and start <= instant(phase['startedAt']) <= instant(phase['finishedAt']) <= capture_end,
                        'Diagnostic child intervals overlap, exceed admission, or continue after an unstarted/failed phase')
                if phase.get('childSpawnEstablished') is True:
                    require(type(phase.get('pid')) is int and phase['pid'] > 0 and phase.get('processGroupId') == phase['pid']
                            and type(phase.get('exitCode')) is int
                            and phase_start - before_ns < int((ceiling - Decimal('30.5')) * Decimal(1_000_000_000)),
                            'An actually spawned diagnostic child lacks its bounded admission or real process outcome')
                else:
                    require(phase.get('childSpawnEstablished') is False and phase.get('pid') is None
                            and phase.get('status') == 'wrapper_error' and phase.get('exitCode') is None,
                            'A refused pre-spawn phase must keep its measured preparation without inventing an executed child')
                last_phase_ns = phase_end
                next_allowed = phase['status'] == 'returned' and phase.get('exitCode') == 0
            sources_before, sources_after = receipt['sourceInputsBefore'], receipt['sourceInputsAfter']
            require(set(sources_before).issubset(names) and set(sources_after).issubset(names)
                    and set(receipt['inputs']).issubset(names), 'Unexpected diagnostic input snapshot')
            for label, record in receipt['inputs'].items():
                observed = sources_before[label]
                require(observed.get('sourcePath') == names[label]
                        and observed.get('sha256') == record['sha256'] and observed.get('bytes') == record['bytes'],
                        'A retained diagnostic helper or immutable input differs from its actual preflight bytes')
            unchanged = bool(len(sources_before) == len(names) and sources_before == sources_after)
            all_zero = bool(receipt.get('attemptOutcome') == 'children_returned'
                            and all(phase.get('status') == 'returned' and phase.get('exitCode') == 0
                                    and phase.get('childSpawnEstablished') is True for phase in phases))
            outputs_retained = all(plan['resultPath'].removeprefix(entry['attemptId'] + '/') in receipt['artifacts'] for plan in plans)
            complete = bool(all_zero and unchanged and outputs_retained and not receipt['errors']
                            and not receipt['artifactsWithIncompleteFingerprint'] and receipt['sameBootAtCapture'])
            require(receipt.get('sourceInputsUnchanged') is unchanged and receipt.get('allDeclaredPhasesReturnedZero') is all_zero
                    and receipt.get('allDeclaredOutputsRetained') is outputs_retained
                    and receipt.get('diagnosticEvidenceComplete') is complete,
                    'Diagnostic process/input summary does not match its actual retained evidence')
            binding_validated = receipt.get('diagnosedExecutionValidated')
            require(type(binding_validated) is bool and entry.get('diagnosedExecutionValidated') is binding_validated,
                    'The diagnosed historical execution needs an explicit actual validation decision')
            if binding_validated:
                require('diagnosedExecution' in receipt['inputs'], 'Validated diagnostic execution lacks its actual fingerprint')
                require(any(row['executionReceipt'] == receipt['inputs']['diagnosedExecution'] for row in summaries),
                        'A diagnostic was not linked to a real earlier HPDL execution in the same ledger')
            else:
                require(all(phase.get('status') == 'not_started' and phase.get('childSpawnEstablished') is False for phase in phases)
                        and receipt.get('diagnosedNativeSourceManifestDigest') is None and complete is False,
                        'A rejected or incomplete historical binding cannot release a diagnostic phase or establish its source identity')
            evidence.records(begin)
            summary.update(monotoneMeasurement=True, gameplayDurationMeasured=False, observedActions=None,
                           observedLevelsCompleted=None, completeActionCountEstablished=False,
                           diagnosedExecutionValidated=binding_validated,
                           mode=mode, phases=[{'name': phase['name'], 'status': phase['status'], 'exitCode': phase['exitCode'],
                                               'childSpawnEstablished': phase['childSpawnEstablished']}
                                              for phase in phases],
                           diagnosticEvidenceComplete=receipt.get('diagnosticEvidenceComplete') is True,
                           diagnosedNativeSourceManifestDigest=receipt.get('diagnosedNativeSourceManifestDigest'),
                           qualification='Measured evidence-only diagnostic, including every failed, interrupted or incomplete phase; no game result or additional physical action is inferred.')
        else:
            require(entry.get('kind') == receipt.get('kind') == 'conservative_case_work'
                    and receipt.get('elapsedBasis') == 'observed_utc_wall_interval_conservative_upper_scope'
                    and receipt.get('monotoneMeasurement') is False and entry.get('monotoneMeasurement') is False
                    and receipt.get('gameplayDurationMeasured') is False
                    and receipt.get('campaignPassedEstablished') is False
                    and receipt.get('observedActions') is None and receipt.get('observedLevelsCompleted') is None
                    and receipt.get('completeActionCountEstablished') is False,
                    'Non-live case work must not be presented as gameplay, a monotone measurement or invented action counts')
            delta = capture_end - start
            wall = Decimal(delta.days * 86400 + delta.seconds) + Decimal(delta.microseconds) / Decimal(1_000_000)
            require(receipt.get('elapsedSecondsThroughCapture') == float(wall) == 450.454527
                    and receipt.get('chargedSeconds') == entry['chargedSeconds'] == 451
                    and entry.get('clockBasis') == receipt['elapsedBasis'],
                    'The specific observed work interval must retain its complete conservative 451-second charge')
            inputs = receipt['inputs']
            require(summaries and inputs.get('priorExecution') == summaries[-1]['executionReceipt']
                    and instant(summaries[-1]['finishedAt']) == start,
                    'Conservative work must start at the actual preceding HPDL01 terminal boundary')
            ack = evidence.read(inputs['quietAcknowledgement']['path'])
            release = evidence.read(inputs['quietRelease']['path'])
            require(ack.get('schema') == 'sra.shared-lane-status.v1' and ack.get('lane') == '10B'
                    and ack.get('quiet_request_id') == receipt['quietBoundary']['requestId']
                    and ack.get('quiet_acknowledged') is True and ack.get('preview_stopped') is True
                    and ack.get('heavy_execution_active') is False
                    and instant(ack.get('quiet_acknowledged_at')) == capture_end
                    and receipt['quietBoundary'].get('quietIntervalAfterAcknowledgementExcluded') is True
                    and release.get('lot') == '6A PreviewPacking'
                    and release.get('quiet_request_id') == ack['quiet_request_id'] and release.get('quiet_requested') is False
                    and capture_end <= instant(receipt['quietBoundary']['actualReleaseTimestamp']) <= instant(receipt['recordedAt']),
                    'The observed diagnostic stop and real subsequent quiet release must remain explicit')
            release_value = release
            pointer = receipt['quietBoundary']['releaseTimestampPointer']
            require(isinstance(pointer, str) and pointer.startswith('/'), 'Missing exact release timestamp pointer')
            for token in pointer[1:].split('/'):
                key = token.replace('~1', '/').replace('~0', '~')
                release_value = release_value[int(key)] if isinstance(release_value, list) else release_value[key]
            require(release_value == receipt['quietBoundary']['actualReleaseTimestamp'],
                    'The release timestamp does not come from its retained actual field')
            summary.update(elapsedBasis=receipt['elapsedBasis'], observedWallSeconds=float(wall),
                           monotoneMeasurement=False, gameplayDurationMeasured=False,
                           observedActions=None, observedLevelsCompleted=None, completeActionCountEstablished=False,
                           qualification=receipt['qualification'])
        executions[evidence.keep(path)['path']] = (entry, receipt)
        summaries.append(summary)
    require(executions, 'No fresh completed HPDL interval exists')
    return clock, total, remaining, executions, summaries, evidence.keep(declaration_path)


def current_source(evidence, manifest_path):
    source = evidence.read(manifest_path)
    require(isinstance(source.get('files'), dict) and source['files']
            and source.get('fileCount') == len(source['files']), 'Invalid candidate native manifest')
    digest = hashlib.sha256(json.dumps(dict(sorted(source['files'].items())), separators=(',', ':')).encode()).hexdigest()
    require(source.get('digest') == digest, 'The candidate manifest digest is inconsistent')
    evidence.file_map(source['files'], 'candidate native source')
    actual_paths = {path.relative_to(ROOT).as_posix() for folder in ('src/logos-engine', 'src/runtime')
                    for path in (ROOT / folder).rglob('*') if path.is_file() and path.suffix in ('.ts', '.json', '.drm')}
    require(actual_paths == set(source['files']), 'The current native source membership differs from the frozen candidate')
    return source, readiness.native_version(evidence, ROOT)


def selected_campaign(evidence, path, campaign_path, trace_path, executions, source, version, expected_status='passed'):
    require(expected_status in ('passed', 'failed'), 'Only an actual complete terminal campaign may use this reader')
    successful = expected_status == 'passed'
    receipt_fingerprint = evidence.keep(path)
    require(receipt_fingerprint['path'] in executions, 'The selected campaign execution is absent from the cumulative ledger')
    entry, execution = executions[receipt_fingerprint['path']]
    require(execution.get('schema') == 'logos-engine.lot10b.hpdl-clocked-execution.v1'
            and execution.get('targetLevels') == 6 and execution.get('attemptOutcome') == 'child_returned'
            and type(execution.get('exitCode')) is int
            and execution.get('exitCode') == (0 if successful else 1) and execution.get('termination') is None
            and execution.get('sourceInputsUnchanged') is True and execution.get('errors') == []
            and execution.get('finalExecutionEvidenceComplete') is True
            and execution.get('campaignPassedEstablished') is successful
            and execution.get('completeActionCountEstablished') is True
            and execution.get('nativeSourceManifestDigest') == source['digest'],
            'The selected complete cold campaign differs from its declared actual terminal outcome or native source')
    artifacts = execution['artifacts']
    require(artifacts.get('hpdl-campaign.json.gz') == evidence.keep(campaign_path)
            and artifacts.get('hpdl-public-trace.json.gz') == evidence.keep(trace_path),
            'The actual execution did not retain these exact final campaign/trace bytes')
    campaign, trace = evidence.read(campaign_path), evidence.read(trace_path)
    final, capture = campaign.get('final', {}), execution.get('capture', {})
    actions, prefixes = campaign.get('actions'), campaign.get('prefixes')
    require(campaign.get('schema') == 'logos-engine.v6.integrated-game-campaign.v1'
            and campaign.get('game') == 'HPDL' and campaign.get('referenceCommit') == COMMIT
            and campaign.get('status') == expected_status
            and (campaign.get('failure') is None if successful else isinstance(campaign.get('failure'), str))
            and campaign.get('targetLevels') == 6 and campaign.get('source') == source
            and campaign.get('sourceUnchangedDuringRun') is True and campaign.get('pythonAgentModules') == []
            and 'recordedPublicReplay' not in campaign and campaign.get('windowCaptureErrors') == []
            and final.get('sessions') == 1 and final.get('nativeImplementation') == IMPLEMENTATION_PREFIX + version,
            'A genuine unchanged cold HPDL target-six campaign on the exact version is required')
    require(isinstance(actions, list) and isinstance(prefixes, list)
            and integer(final.get('actions'), 'final actions') == len(actions),
            'The complete actual campaign action inventory is missing or inconsistent')
    completed_levels = integer(final.get('levelsCompleted'), 'final completed levels')
    if successful:
        require(actions and prefixes and completed_levels >= 6, 'The actual declared six-level campaign was not completed')
    require(capture.get('campaignStatus') == expected_status and capture.get('actualFinal') == final
            and capture.get('actualFailure') == campaign.get('failure')
            and capture.get('finalCaptureComplete') is True and capture.get('reportCountsMatchJournal') is True
            and capture.get('errors') == [], 'The wrapper did not retain a complete matching final capture')
    packets = trace.get('packets')
    require(trace.get('schema') == 'logos-engine.native-public-game-trace.v1' and trace.get('game') == 'HPDL'
            and trace.get('status') == expected_status and trace.get('sourceDigest') == source['digest']
            and isinstance(packets, list) and len(packets) == len(actions) + 1
            and packets[0].get('command') is None and packets[0]['packet'].get('levels_completed') == 0,
            'The complete cold public trace is missing or belongs to another campaign')
    for index, action in enumerate(actions):
        require(action.get('sequence') == index + 1 and packets[index + 1].get('command') == action.get('command')
                and packets[index + 1]['packet'].get('step_index') == index + 1,
                'The trace does not cover every actual ordered command')
    for key in ('preflight.json', 'postflight.json'):
        check = evidence.read(evidence.checked(artifacts[key]))
        require(check.get('matchesDeclaredFreeze') is True and check.get('nativeSource') == source
                and check.get('errors') == [] and check.get('mismatchedPaths') == [],
                'The actual campaign freeze check did not pass on this exact native source')
        evidence.records(check)
    before = evidence.read(artifacts['preflight.json']['path'])
    after = evidence.read(artifacts['postflight.json']['path'])
    require(before['fileFingerprints'] == after['fileFingerprints'], 'Execution inputs changed across the actual campaign')
    return entry, execution, campaign, trace


def source_comparison(evidence, path, campaign_path, trace_path, campaign, source):
    comparison = evidence.read(path)
    require(comparison.get('schema') == 'logos-engine.window-question-public-source-parity.v1'
            and comparison.get('status') == 'passed' and comparison.get('sourceCommit') == COMMIT
            and comparison.get('game') == 'HPDL' and campaign.get('status') in ('passed', 'failed')
            and comparison.get('campaignStatus') == campaign['status']
            and comparison.get('campaignFailure') == campaign.get('failure')
            and comparison.get('campaignSchema') == campaign['schema']
            and comparison.get('campaignFinal') == campaign['final'] and comparison.get('nativeSource') == source
            and comparison.get('fullCallerParity') is False and comparison.get('originalCommonCallerRun') is False
            and comparison.get('gameHostRun') is False and comparison.get('nativeAgentRun') is False,
            'The retained comparator must cover this actual HPDL campaign with its exact component-only scope')
    for key in ('originalsUnchanged', 'inputsUnchanged', 'campaignNativeBindingUnchanged'):
        require(comparison.get(key) is True, 'Source comparison integrity failed: ' + key)
    require(comparison.get('error') is None and comparison.get('sourceVerificationError') is None
            and comparison.get('inputVerificationError') is None
            and comparison.get('bytecodeIsolation', {}).get('passed') is True,
            'The source comparison retains an error or failed isolation')
    require(comparison['inputs'] == comparison.get('inputsAfter')
            and comparison['inputs'].get('campaign') == evidence.keep(campaign_path)
            and comparison['inputs'].get('publicTrace') == evidence.keep(trace_path)
            and comparison['inputs'].get('generator') == evidence.keep(ROOT / 'scripts/compare-window-question-public-parity.py'),
            'The canonical comparator did not read these exact campaign/trace bytes')
    evidence.records(comparison['inputs'])
    require(comparison.get('sourceBefore') == comparison.get('sourceAfter')
            and comparison['sourceBefore'].get('commit') == COMMIT
            and comparison['sourceBefore'].get('filesVerified') == 1786,
            'The original 1786-file verification is incomplete')
    evidence.records(comparison['sourceBefore'])
    require(comparison.get('campaignNativeBinding') == comparison.get('campaignNativeBindingAfter')
            and comparison['campaignNativeBinding'].get('capturedDigest') == source['digest']
            and comparison['campaignNativeBinding'].get('filesVerified') == source['fileCount'],
            'The comparator native binding differs from the candidate')
    hashes = comparison.get('sourceHashes')
    require(isinstance(hashes, dict) and hashes, 'No actually imported original source hashes were retained')
    for relative, digest in hashes.items():
        require(evidence.keep(readiness.confined(relative, ORIGINAL))['sha256'] == digest,
                'An imported original component changed: ' + relative)
    functions = comparison.get('executedSourceFunctions')
    require(isinstance(functions, list) and functions and all(type(row.get('calls')) is int and row['calls'] > 0 for row in functions),
            'The comparator has no positively executed original functions')
    validate_replay(comparison, campaign)
    return comparison


def validate_replay(comparison, campaign):
    """Validate only the actual capture passed by its full/partial caller."""
    replay = comparison.get('replay', {})
    require(replay.get('coldStart') is True and replay.get('nativeStatesUsedToPrimeSource') is False
            and replay.get('nativePlansUsedToAcquireSource') is False and replay.get('componentComparisonPassed') is True
            and replay.get('exactOriginalReturnParityPassed') is True and replay.get('componentParityPassed') is True
            and replay.get('stop') is None and replay.get('differences') == []
            and replay.get('nativeAdaptations') == [],
            'Exact original component return parity is not established; a generic passed status alone is insufficient')
    calls, restores, prefixes, actions = (campaign[key] for key in ('windowSourceCalls', 'windowRestoreCalls', 'prefixes', 'actions'))
    counts = replay['counts']
    expected = {'sourceCallsExpected': len(calls), 'sourceCallsCompared': len(calls),
                'nativeRestoresExpected': len(restores), 'nativeRestoresCompared': len(restores),
                'records': len(actions), 'recordsCoveredBySealedPrefixes': len(actions),
                'physicalActionsCompared': len(actions), 'physicalActionsExpected': len(actions),
                'prefixesExpected': len(prefixes), 'prefixesCompared': len(prefixes),
                'nativeAdaptations': 0, 'differences': 0}
    require(all(counts.get(key) == value for key, value in expected.items()), 'The source comparison omits actual calls, returns, restores or prefixes')
    require([row.get('index') for row in replay['callChecks']] == list(range(len(calls)))
            and [row.get('prefixIndex') for row in replay['prefixChecks']] == list(range(len(prefixes)))
            and len(replay['nativeRestorationChecks']) == len(restores), 'Comparison inventories are not complete and ordered')
    for key in ('callChecks', 'prefixChecks', 'nativeRestorationChecks', 'restorationChecks'):
        require(all(row.get('passed') is True and row.get('differences') == 0 for row in replay[key]), 'An actual source check failed: ' + key)
    require(replay['publicTraceBinding'].get('completePackets') == len(actions) + 1
            and replay['publicTraceBinding'].get('nativeFramesUsedToInventTrace') is False
            and replay['eventFactCaptureScope'].get('episodeObservedInEventCapture') is True,
            'The complete public return or acquired fact scope is missing')
    ablations = replay['ablationCounts']
    require(ablations.get('total') == ablations.get('expected') == len(replay['ablations']) and ablations.get('errors') == 0,
            'The declared component interventions were not all actually executed')
    return replay


def selected_partial(evidence, execution_path, checkpoint_path, journal_path, comparison_path, executions, source):
    """Retain the actual running checkpoint; never manufacture final fields."""
    execution_record = evidence.keep(execution_path)
    require(execution_record['path'] in executions, 'The selected partial execution is absent from the cumulative clock')
    entry, execution = executions[execution_record['path']]
    require(execution.get('schema') == 'logos-engine.lot10b.hpdl-clocked-execution.v1'
            and execution.get('game') == 'HPDL' and execution.get('targetLevels') == 6
            and execution.get('sourceInputsUnchanged') is True
            and execution.get('finalExecutionEvidenceComplete') is False
            and execution.get('campaignPassedEstablished') is False
            and execution.get('nativeSourceManifestDigest') == source['digest']
            and execution.get('capture', {}).get('actualFinal') is None,
            'Partial mode requires the real terminal wrapper receipt of an incomplete unchanged-source attempt')
    artifacts = execution['artifacts']
    require(artifacts.get(checkpoint_path.name) == evidence.keep(checkpoint_path)
            and artifacts.get(journal_path.name) == evidence.keep(journal_path),
            'Partial inputs must be the exact checkpoint/public journal retained by the actual wrapper')
    envelope = evidence.read(checkpoint_path)
    require(envelope.get('schema') == 'logos-engine.lot10b.hpdl-campaign-checkpoint.v1'
            and envelope.get('game') == 'HPDL' and envelope.get('targetLevels') == 6
            and envelope.get('completeCampaign') is False, 'A genuine incomplete checkpoint envelope is required')
    campaign = envelope['report']
    require(campaign.get('schema') == 'logos-engine.v6.integrated-game-campaign.v1'
            and campaign.get('referenceCommit') == COMMIT and campaign.get('game') == 'HPDL'
            and campaign.get('targetLevels') == 6 and campaign.get('status') == 'running'
            and campaign.get('source') == source and campaign.get('windowCaptureErrors') == []
            and 'final' not in campaign and 'sourceUnchangedDuringRun' not in campaign
            and 'recordedPublicReplay' not in campaign,
            'The actual checkpoint must remain running, without an invented final report or source flag')
    comparison = evidence.read(comparison_path)
    require(comparison.get('schema') == 'logos-engine.window-question-checkpoint-source-parity.PARTIAL.v1'
            and comparison.get('status') == 'partial_validated' and comparison.get('sourceCommit') == COMMIT
            and comparison.get('game') == 'HPDL' and comparison.get('targetLevels') == 6
            and comparison.get('nativeDigest') == source['digest']
            and comparison.get('completeCampaign') is False and comparison.get('campaignSuccessEstablished') is False
            and comparison.get('campaignFailureCauseEstablished') is False
            and comparison.get('gameHostRun') is False and comparison.get('nativeAgentRun') is False
            and comparison.get('originalCommonCallerRun') is False and comparison.get('fullCallerParity') is False,
            'Only the distinct successfully validated PARTIAL reader can qualify a sealed incomplete capture')
    inputs = comparison['inputs']
    require(inputs == comparison.get('inputsAfter')
            and inputs.get('checkpoint') == evidence.keep(checkpoint_path)
            and inputs.get('publicJournal') == evidence.keep(journal_path)
            and inputs.get('executionReceipt') == execution_record
            and inputs.get('generator') == evidence.keep(ROOT / 'scripts/compare-window-question-checkpoint-parity.py')
            and inputs.get('sharedComparisonCore') == evidence.keep(ROOT / 'scripts/compare-window-question-public-parity.py'),
            'The PARTIAL reader did not validate these exact observed inputs with its retained canonical code')
    evidence.records(inputs)
    require(comparison.get('error') is None and comparison.get('verificationError') is None
            and comparison.get('originalsUnchanged') is True and comparison.get('inputsUnchanged') is True
            and comparison.get('currentNativeUnchanged') is True
            and comparison.get('bytecodeIsolation', {}).get('passed') is True,
            'The partial source comparison has an error or failed integrity check')
    require(comparison.get('sourceBefore') == comparison.get('sourceAfter')
            and comparison['sourceBefore'].get('commit') == COMMIT
            and comparison['sourceBefore'].get('filesVerified') == 1786,
            'Partial source proof did not verify all 1786 original files before and after')
    evidence.records(comparison['sourceBefore'])
    binding = comparison.get('currentNativeBinding', {})
    require(binding == comparison.get('currentNativeBindingAfter') and binding.get('capturedDigest') == source['digest']
            and binding.get('filesVerified') == source['fileCount'], 'Partial proof belongs to another native inventory')
    require(comparison.get('executedSourceFunctions')
            and all(type(row.get('calls')) is int and row['calls'] > 0 for row in comparison['executedSourceFunctions']),
            'The partial reader retained no actually executed original source functions')
    before = evidence.read(artifacts['preflight.json']['path'])
    after = evidence.read(artifacts['postflight.json']['path'])
    require(inputs.get('preflight') == artifacts['preflight.json'] and inputs.get('postflight') == artifacts['postflight.json']
            and before.get('matchesDeclaredFreeze') is True and after.get('matchesDeclaredFreeze') is True
            and before.get('nativeSource') == after.get('nativeSource') == source
            and before.get('fileFingerprints') == after.get('fileFingerprints')
            and before.get('errors') == after.get('errors') == []
            and before.get('mismatchedPaths') == after.get('mismatchedPaths') == [],
            'The actual historical partial execution did not preserve its frozen inputs')
    require(inputs.get('frozenNativeManifest') == before['sourceManifest']
            and inputs.get('historicalSourceArchive') == before['sourceArchive']
            and inputs.get('historicalArchiveArtifact') == before['archiveArtifact'],
            'The partial verifier omitted the true historical archive bindings')
    # These helpers only read files. They do not call the original Window,
    # compare_campaign or either executable main during this review.
    partial_reader = load_reader('lot10b_partial_file_checks', ROOT / 'scripts/compare-window-question-checkpoint-parity.py')
    archived = partial_reader.verify_archive(before, before, after)
    require(archived == comparison.get('historicalArchiveBinding'),
            'The archived old helper bytes differ from their actual partial comparison')
    records, journal_summary = partial_reader.read_journal(journal_path)
    scope = comparison['partialScope']
    sealed, prefix_count = len(campaign['actions']), len(campaign['prefixes'])
    require(sealed > 0 and prefix_count > 0 and len(records) >= sealed + 1
            and records[0].get('command') is None and records[0]['packet'].get('levels_completed') == 0,
            'The partial checkpoint has no genuine cold acquired public scope')
    require(scope.get('checkpointSequence') == envelope['sequence']
            and scope.get('checkpointRecordedAt') == envelope['recordedAt']
            and scope.get('capturedCampaignStatus') == 'running'
            and scope.get('sealedActions') == sealed and scope.get('sealedPrefixes') == prefix_count
            and scope.get('scopedSourceCalls') == len(campaign['windowSourceCalls'])
            and scope.get('scopedNativeRestores') == len(campaign['windowRestoreCalls'])
            and scope.get('journal') == journal_summary and not journal_summary['malformedCompleteRecords']
            and scope.get('journalObservedActionReturns') == len(records) - 1
            and scope.get('acquisitionAfterCheckpointNotReconstructed') is True and scope.get('finalFieldsAdded') is False,
            'Partial scope must separate the sealed checkpoint from every later observed return')
    actual_checkpoint = execution['capture']['lastCheckpoint']
    journal_capture = execution['capture']['publicJournal']
    require(actual_checkpoint.get('sequence') == envelope['sequence']
            and actual_checkpoint.get('recordedAt') == envelope['recordedAt']
            and actual_checkpoint.get('recordedActions') == sealed and actual_checkpoint.get('recordedPrefixes') == prefix_count
            and journal_capture.get('completeRecords') == len(records)
            and journal_capture.get('observedActionReturns') == len(records) - 1
            and journal_capture.get('trailingPartialBytes') == journal_summary['trailingPartialBytes'],
            'The retained raw checkpoint or journal differs from the actual wrapper capture inventory')
    for index, row in enumerate(records):
        require(row['packet'].get('step_index') == index and (row.get('command') is None) == (index == 0),
                'The actual raw public journal is unordered')
    levels = integer(campaign['actions'][-1].get('completedAfter'), 'sealed observed completed levels')
    require(scope.get('officialLevelsCompletedAtCheckpoint') == levels
            and scope.get('levelAtCheckpoint') == campaign['actions'][-1]['levelAfter']
            and scope.get('officialLevelsCompletedAtLastJournalReturn') == records[-1]['packet']['levels_completed']
            and scope.get('levelAtLastJournalReturn') == records[-1]['packet']['level'],
            'The qualified public progress must be copied from actual public observations')
    later = scope.get('laterPublicReturns')
    require(isinstance(later, list) and len(later) == len(records) - sealed - 1,
            'Every observed return beyond the sealed checkpoint must remain explicit')
    for index, retained in enumerate(later, sealed + 1):
        row = records[index]
        require(retained.get('journalIndex') == index and retained.get('command') == row['command']
                and retained.get('packetSha256') == partial_reader.parity.packet_hash(row['packet'])
                and retained.get('publicFields') == {key: row['packet'][key] for key in
                    ('level', 'levels_completed', 'state', 'step_index', 'frame_hash')}
                and retained.get('acquisitionWithinCheckpointEstablished') is False,
                'A later public return was omitted or promoted to an unobserved acquisition')
    historical = comparison.get('historicalExecution', {})
    require(historical.get('receipt') == execution_record and historical.get('actualFinal') is None
            and historical.get('finalExecutionEvidenceComplete') is False
            and historical.get('causeNotInferredFromExitSignal') is True
            and historical.get('exitCode') == execution.get('exitCode')
            and historical.get('termination') == execution.get('termination')
            and historical.get('elapsedSecondsThroughCapture') == execution['elapsedSecondsThroughCapture'],
            'The partial comparison must preserve the actual terminal process status without inferring a game result or cause')
    replay = validate_replay(comparison, campaign)
    replay_scope = replay.get('comparisonScope', {})
    require(replay_scope.get('kind') == 'sealed_checkpoint_prefix_only' and replay_scope.get('completeCampaign') is False
            and replay_scope.get('sealedActions') == sealed and replay_scope.get('completePublicPacketsCompared') == sealed + 1
            and replay_scope.get('unsealedPublicReturnsComparedAsAcquisitions') is False,
            'Source parity must stop at the actual sealed checkpoint, not the last unsealed public return')
    return entry, execution, campaign, comparison, scope


def contains_evidence(value, before, after):
    if isinstance(value, dict):
        return value.get('evidence') == [before, after] or any(contains_evidence(item, before, after) for item in value.values())
    return isinstance(value, list) and any(contains_evidence(item, before, after) for item in value)


def contribution_witnesses(campaign, comparison):
    replay, calls = comparison['replay'], campaign['windowSourceCalls']
    checks = {row['index']: row for row in replay['callChecks']}
    prefixes = replay['prefixChecks']
    witnesses = []
    for prefix in prefixes:
        if not prefix.get('selectedWindow') or not prefix.get('acquiredActions'):
            continue
        actual_prefix = campaign['prefixes'][prefix['prefixIndex']]
        selected = actual_prefix.get('windowQuestion', {}).get('selectedProposal', {})
        if (actual_prefix.get('family') != OWNER
                or selected.get('window_question_plan', {}).get('workflow', {}).get('workflow') != PROGRAM):
            continue
        proposal_index = prefix['sourceProposalCallIndex']
        for record_index in prefix['recordsCovered']:
            guards = [row for row in replay['guardCoverage'] if row.get('recordCallIndex') == record_index
                      and row.get('selected') is True and row.get('publicReturnAcquiredOnce') is True
                      and row.get('sourceProposalCallIndex') == proposal_index]
            if not guards:
                continue
            guard_index = guards[-1]['guardCallIndex']
            if any(checks.get(index, {}).get('method') != method or checks[index].get('nativeAdaptation') is not False
                   for index, method in [(proposal_index, 'propose'), (guard_index, 'before'), (record_index, 'recordSource')]):
                continue
            record = calls[record_index]
            args = record['arguments']
            if args[5] is None or calls[guard_index].get('result', {}).get('admitted') is not True:
                continue
            before_ref, after_ref = args[0]['observation_ref'], args[1]['observation_ref']
            publication = next((row for row in replay['sourcePublicationChecks']
                if row.get('recordCallIndex') == record_index and row.get('predicate') is True
                and row.get('publicationEvidence') == after_ref
                and row.get('publicationRevision') == args[1]['revision']), None)
            if publication is None:
                continue
            next_index = next((index for index in range(record_index + 1, len(calls)) if calls[index]['method'] == 'propose'), None)
            following = next((row for row in replay['nextChoiceChecks'] if row.get('recordCallIndex') == record_index
                and row.get('proposeCallIndex') == next_index and row.get('differences') == 0 and row.get('nativeAdaptation') is False), None)
            if following is None or calls[next_index]['arguments'][0].get('observation_ref') != after_ref:
                continue
            following_selected = next((row for row in prefixes if row.get('selectedWindow') is True
                and row.get('sourceProposalCallIndex') == next_index and row.get('acquiredActions', 0) > 0
                and row['prefixIndex'] > prefix['prefixIndex']), None)
            if following_selected is None:
                continue
            ablation = next((row for row in replay['ablations'] if row.get('callIndex') == next_index
                and row.get('executed') is True and row.get('interventionApplied') is True
                and row.get('allOtherOwnerFieldsPreserved') is True and row.get('actionOrRefusalChanged') is True
                and row.get('metadataOnlyChanged') is False and row.get('nativeStateSeed') is False
                and contains_evidence(row.get('removed'), before_ref, after_ref)), None)
            if ablation is None:
                continue
            witnesses.append({'selectedPrefixIndex': prefix['prefixIndex'], 'proposeCallIndex': proposal_index,
                              'guardCallIndex': guard_index, 'recordCallIndex': record_index,
                              'beforeObservationRef': before_ref, 'afterObservationRef': after_ref,
                              'followingProposeCallIndex': next_index, 'followingSelectedPrefixIndex': following_selected['prefixIndex'],
                              'intervention': ablation['intervention'], 'removedFields': ablation['fields'],
                              'actualDecision': ablation['actualDecision'], 'counterfactualDecision': ablation['counterfactualDecision'],
                              'qualification': 'Actual selected Window action and unique acquired return, followed by another actually selected Window choice. A source-memory group containing this return changes the same-input component action/refusal when removed. This does not isolate the individual return as necessary and proves no causal improvement in winning or full-caller parity.'})
    return witnesses


def browser_review(evidence, qa_path, execution_path, executions, source, version):
    qa = evidence.read(qa_path)
    execution_record = evidence.keep(execution_path)
    require(execution_record['path'] in executions, 'The browser QA interval is absent from the shared cumulative clock')
    entry, execution = executions[execution_record['path']]
    require(execution.get('schema') == 'logos-engine.lot10b.hpdl-browser-execution.v1'
            and execution.get('campaignPassedEstablished') is False, 'A browser clock must not fabricate a campaign result')
    require(qa.get('schema') == 'logos-engine.browser-qa.v1' and qa.get('game') == 'HPDL'
            and qa.get('nativeDigest') == source['digest'] and qa.get('nativeVersion') == version
            and qa.get('status') in ('passed', 'blocked', 'inconclusive')
            and isinstance(qa.get('qualification'), str) and qa['qualification'].strip()
            and isinstance(qa.get('artifacts'), list) and qa['artifacts'],
            'The actual browser QA must retain its real status and exact candidate binding')
    evidence.records(qa)
    require(execution_record in qa['artifacts'] and execution['observation'] in qa['artifacts'],
            'The browser QA must retain its clock execution and actual CUA observation as artifacts')
    readiness.interval(qa, instant(qa['recordedAt']), 'actual HPDL browser QA')
    require(instant(execution['startedAt']) <= instant(qa['startedAt'])
            <= instant(qa['finishedAt']) <= instant(execution['captureFinishedAt']),
            'The actual browser QA interval is not contained in its charged holder interval')
    if qa['status'] == 'passed':
        require(qa.get('learnedStateInjected') is False and qa.get('pause', {}).get('observed') == 'Paused.'
                and qa.get('oneAction', {}).get('observed') == 'One action completed.'
                and type(qa['pause'].get('actions')) is int and qa['pause']['actions'] >= 0
                and type(qa['oneAction'].get('actions')) is int
                and qa['oneAction']['actions'] == qa['pause']['actions'] + 1,
                'A passed browser QA lacks the actual Pause and single-action observations required by readiness')
    return qa, execution, entry


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for option in ('source-manifest', 'campaign-execution', 'source-comparison',
                   'browser-execution', 'browser-evidence', 'output'):
        parser.add_argument('--' + option, required=True)
    for option in ('campaign', 'trace', 'checkpoint', 'public-journal'):
        parser.add_argument('--' + option)
    parser.add_argument('--qualification', choices=('established', 'partial', 'not_established'), required=True)
    parser.add_argument('--qualification-reason', default='', help='Required explicit reason for partial or terminal-failed qualification')
    parser.add_argument('--own-live-contribution', choices=('observed', 'not_established'), required=True,
                        help='Explicit review decision; observed additionally requires an exact linked witness')
    parser.add_argument('--decision-note', default='', help='Optional reviewer qualification, retained verbatim')
    args = parser.parse_args()
    if args.qualification in ('established', 'not_established'):
        require(args.campaign and args.trace and not args.checkpoint and not args.public_journal,
                'Complete terminal qualification requires only an actual final campaign and complete public trace')
        if args.qualification == 'not_established':
            require(args.qualification_reason.strip(), 'A terminal failed campaign requires an explicit reason for success remaining unestablished')
    else:
        require(args.checkpoint and args.public_journal and not args.campaign and not args.trace
                and args.qualification_reason.strip(),
                'Partial mode requires the actual checkpoint/journal, a distinct PARTIAL comparison and an explicit reason; no final report/trace')
    output = readiness.confined(args.output)
    require(output.is_relative_to(BASE) and output.name == 'hpdl-case-budget-review.json' and not output.exists(),
            'Use a new exclusive hpdl-case-budget-review.json below lot10b-evidence')
    evidence = readiness.Evidence(ROOT)
    generator_inputs = [Path(__file__).resolve(), BASE / 'run-hpdl-clocked-proof.py',
                        BASE / 'finalize-cost-readiness.py', BASE / 'browser-hpdl-clock.py',
                        BASE / 'record-hpdl-conservative-case-work.py', BASE / 'run-hpdl-clocked-diagnostic.py']
    with ExitStack() as locks:
        for path, mode in [(proof.PERFORMANCE_LOCK, fcntl.LOCK_SH), (proof.HPDL_LOCK, fcntl.LOCK_EX), (LEDGER_LOCK, fcntl.LOCK_EX)]:
            stream = locks.enter_context(path.open('a+b'))
            fcntl.flock(stream.fileno(), mode | fcntl.LOCK_NB)
        for path in generator_inputs:
            evidence.keep(path)
        source, version = current_source(evidence, readiness.confined(args.source_manifest))
        clock, total, remaining, executions, intervals, historical_declaration = inspect_clock(evidence)
        partial_scope = None
        if args.qualification in ('established', 'not_established'):
            expected_status = 'passed' if args.qualification == 'established' else 'failed'
            entry, execution, campaign, trace = selected_campaign(evidence, readiness.confined(args.campaign_execution),
                readiness.confined(args.campaign), readiness.confined(args.trace), executions, source, version, expected_status)
            comparison = source_comparison(evidence, readiness.confined(args.source_comparison),
                readiness.confined(args.campaign), readiness.confined(args.trace), campaign, source)
            comparison_started = comparison['startedAt']
            comparison_scope = comparison['scope']
            selected_evidence = {'qualification': args.qualification, 'execution': evidence.keep(args.campaign_execution),
                                 'report': evidence.keep(args.campaign), 'publicTrace': evidence.keep(args.trace),
                                 'targetLevels': 6, 'actualFinal': campaign['final'], 'completeCampaign': True,
                                 'campaignSuccessEstablished': expected_status == 'passed',
                                 'campaignTerminalStatus': expected_status,
                                 'scope': ('Observed successful six-level cold Node campaign; its actual final host state is retained without extending the declared target.'
                                           if expected_status == 'passed' else
                                           'Actual complete terminal failed Node campaign and complete public trace. The final report remains failed; target-six success and the causal explanation of failure are not established. This is not an incomplete PARTIAL checkpoint.')}
            if expected_status == 'failed':
                selected_evidence.update(actualFailure=campaign['failure'], actualProcessExitCode=execution['exitCode'],
                                         actualTermination=execution['termination'], campaignFailureCauseEstablished=False,
                                         explicitQualificationReason=args.qualification_reason.strip())
        else:
            entry, execution, campaign, comparison, partial_scope = selected_partial(evidence,
                readiness.confined(args.campaign_execution), readiness.confined(args.checkpoint),
                readiness.confined(args.public_journal), readiness.confined(args.source_comparison), executions, source)
            comparison_started = comparison['recordedAt']
            comparison_scope = comparison['qualification']
            selected_evidence = {'qualification': 'partial', 'execution': evidence.keep(args.campaign_execution),
                                 'checkpoint': evidence.keep(args.checkpoint), 'publicJournal': evidence.keep(args.public_journal),
                                 'targetLevels': 6, 'actualFinal': None, 'completeCampaign': False,
                                 'campaignSuccessEstablished': False, 'campaignFailureCauseEstablished': False,
                                 'actualProcessExitCode': execution.get('exitCode'), 'actualTermination': execution.get('termination'),
                                 'partialScope': partial_scope,
                                 'nativeVersionBinding': 'Identical archived/current native members including the verified implementation-version literal; no terminal runtime snapshot is invented',
                                 'scope': 'Only the actual sealed checkpoint prefix has acquired-source parity. All later public journal returns remain visible and unacquired in this proof. Six-level completion and the cause of the interrupted process remain unestablished.'}
        qa, browser_execution, browser_entry = browser_review(evidence, readiness.confined(args.browser_evidence),
            readiness.confined(args.browser_execution), executions, source, version)
        require(instant(entry['finishedAt']) <= instant(comparison_started) <= instant(comparison['completedAt']),
                'The source comparison does not follow the completed actual campaign execution')
        witnesses = contribution_witnesses(campaign, comparison)
        if args.own_live_contribution == 'observed':
            require(witnesses, 'No exact selected action/acquisition/subsequent selected choice and source-memory witness establishes own live contribution')
        evidence.recheck()
        reviewed_at = proof.now()
        require(max(instant(row['finishedAt']) for row in intervals) <= instant(reviewed_at)
                and instant(comparison['completedAt']) <= instant(reviewed_at)
                and instant(qa['recordedAt']) <= instant(reviewed_at), 'Review timestamps precede retained evidence')
        if args.qualification == 'established':
            campaign_reason = (f"The actual cold Node HPDL campaign returned passed for its declared six-level target, with {campaign['final']['actions']} "
                               f"actions and {campaign['final']['levelsCompleted']} completed levels on native {version}. ")
        elif args.qualification == 'not_established':
            campaign_reason = (f"The actual cold Node HPDL campaign returned a complete terminal failed report on native {version}, "
                               f"with {campaign['final']['actions']} recorded actions and {campaign['final']['levelsCompleted']} publicly completed levels. "
                               "Its actual child returned exit 1 without wrapper termination; the full final report and public trace remain failed. "
                               "Target-six success is not established. The recorded failure text is retained without inferring its causal explanation, "
                               "and this complete failure is not reclassified as an incomplete checkpoint. Explicit qualification: "
                               + args.qualification_reason.strip() + ' ')
        else:
            campaign_reason = (f"The retained HPDL attempt remains partial on native {version}: {partial_scope['sealedActions']} actions in "
                               f"{partial_scope['sealedPrefixes']} sealed prefixes, separately from {partial_scope['journalObservedActionReturns']} "
                               f"actual complete public action returns. Public observations show {partial_scope['officialLevelsCompletedAtCheckpoint']} "
                               f"completed levels at the checkpoint and {partial_scope['officialLevelsCompletedAtLastJournalReturn']} at the last journal return. "
                               "No final campaign, six-level success, acquisition after the checkpoint, or game failure/cause is inferred. "
                               'Explicit partial qualification: ' + args.qualification_reason.strip() + ' ')
        reason = (campaign_reason + "The original Window component comparison has exact retained returns within this declared full/partial scope. "
                  f"Own live contribution is explicitly {args.own_live_contribution}; "
                  f"{len(witnesses)} linked selected-action/memory witnesses are retained. Browser QA remains {qa['status']}. "
                  "The prior 159.45478678199166 seconds and 40 actions remain charged with unavailable raw historical evidence. "
                  "The cumulative clock is closed without reset or refund. No full common caller parity or causal improvement in winning is claimed.")
        if args.decision_note:
            reason += ' Reviewer qualification: ' + args.decision_note
        retained = evidence.snapshot()
        review = {'schema': 'logos-engine.lot10b.case-budget-review.v1', 'reviewedAt': reviewed_at, 'case': 'HPDL',
                  'nativeDigest': source['digest'], 'nativeVersion': version,
                  'historicalAttempt': {**clock['historicalDebit'], 'declaration': historical_declaration},
                  'decision': {'officialSuccess': args.qualification, 'ownLiveContribution': args.own_live_contribution,
                               'priorBudgetAssumedFresh': False, 'clockReset': False, 'reason': reason},
                  'clockReview': {'status': 'closed', 'limitSeconds': 2400, 'cumulativeSeconds': float(total),
                                  'remainingSeconds': float(remaining), 'clockReset': False, 'ledger': evidence.keep(proof.CLOCK),
                                  'intervals': intervals,
                                  'qualification': 'All fresh intervals and every terminal outcome are included. The unrecovered historic debit remains explicit; no failure or retention cost is subtracted.'},
                  'selectedCampaign': selected_evidence,
                  'windowSourceComparison': {'receipt': evidence.keep(args.source_comparison), 'counts': comparison['replay']['counts'],
                                            'ablationCounts': comparison['replay']['ablationCounts'], 'exactOriginalReturnParityPassed': True,
                                            'fullCallerParity': False, 'scope': comparison_scope},
                  'ownLiveContribution': {'decision': args.own_live_contribution, 'witnesses': witnesses,
                                          'individualReturnNecessityEstablished': False, 'causalWinningImprovementEstablished': False},
                  'browser': {'receipt': evidence.keep(args.browser_evidence), 'clockExecution': evidence.keep(args.browser_execution),
                              'status': qa['status'], 'qualification': qa['qualification'],
                              'nativeBinding': 'observed_receipt' if qa['status'] == 'passed' else 'intended_target_only'},
                  'artifacts': retained,
                  'qualification': 'This generator reads and binds actual retained evidence only. It runs no game, agent, original component, browser, test or cost sample. '
                      'Established target completion, a complete terminal failure with success not established, or explicitly partial public progression, '
                      'selected Window memory influence, browser status, non-live conservative work and the historical-clock limitation remain separate claims.'}
        # Final reader's mandatory public schema fields are constructed above;
        # all referenced byte fingerprints have been checked without executing it.
        output.parent.mkdir(parents=True, exist_ok=True)
        proof.write_json(output, review)
        print(json.dumps({'review': proof.fingerprint(output), 'officialSuccess': review['decision']['officialSuccess'],
                          'ownLiveContribution': args.own_live_contribution, 'browserStatus': qa['status'],
                          'cumulativeSeconds': float(total), 'remainingSeconds': float(remaining)}), flush=True)


if __name__ == '__main__':
    main()
