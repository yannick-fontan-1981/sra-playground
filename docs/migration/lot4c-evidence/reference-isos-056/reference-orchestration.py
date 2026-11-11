from __future__ import annotations

from datetime import datetime, timezone
import gzip
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import time
import traceback

REF = Path('/workspace/sites/sra-lot4c-reference-056')
CANDIDATE = Path('/workspace/sites/sra-lot4a-20261110/.sites-checkout')
REL = Path('docs/migration/lot4c-evidence/reference-isos-056')
OUT = REF / REL
DEST = CANDIDATE / REL
INTERVAL = CANDIDATE / 'docs/migration/lot4c-evidence/development/isos-active-interval-02.json'
COMMIT = '617d1f607d37a6bba1f7ae8ffe1826806e6749a0'
DIGEST = 'be11e761de3c0f3c7d50d10da47be9e0d7b4fc9c5b7d5002cc9272ffce85645a'
PUB_REL = Path('docs/migration/lot10a-evidence/integrated-final/publication-inputs.json')
interval = json.loads(INTERVAL.read_text())
started = datetime.fromisoformat(interval['startedAt'])
phases = []
outcome = {'status': 'preparing', 'campaignAttempted': False, 'campaignCount': 0}


def now():
    return datetime.now(timezone.utc)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def evidence(path, root=REF):
    data = path.read_bytes()
    return {'path': path.relative_to(root).as_posix(), 'sha256': sha(data), 'bytes': len(data)}


def write_new(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('xb') as stream:
        stream.write(data)


def json_new(path, data):
    write_new(path, (json.dumps(data, indent=2) + '\n').encode())


def gzip_exact(path, data):
    write_new(path, gzip.compress(data, mtime=0))
    assert gzip.decompress(path.read_bytes()) == data
    return {'compressed': evidence(path), 'uncompressedBytes': len(data), 'uncompressedSha256': sha(data), 'exactRoundTrip': True}


def remaining():
    return interval['maximumCumulativeSeconds'] - interval['priorChargedSeconds'] - (now() - started).total_seconds()


def run_phase(name, command):
    if remaining() <= 45:
        raise RuntimeError('Shared ISOS case budget requires stopping before another phase')
    began = now()
    clock = time.monotonic()
    log = OUT / (name + '.stdout.log')
    timed_out = False
    with log.open('xb') as stream:
        process = subprocess.Popen(command, cwd=REF, stdout=stream, stderr=subprocess.STDOUT, start_new_session=True)
        try:
            code = process.wait(timeout=remaining() - 35)
        except subprocess.TimeoutExpired:
            timed_out = True
            os.killpg(process.pid, signal.SIGTERM)
            try:
                code = process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                code = process.wait(timeout=5)
    record = {'phase': name, 'command': command, 'cwd': str(REF), 'startedAt': began.isoformat(),
              'finishedAt': now().isoformat(), 'elapsedSeconds': time.monotonic() - clock,
              'exitCode': code, 'timedOut': timed_out, 'stdout': evidence(log),
              'stdoutArchive': gzip_exact(OUT / (name + '.stdout.log.gz'), log.read_bytes())}
    json_new(OUT / (name + '.execution.json'), record)
    phases.append(record)
    print(json.dumps({'phase': name, 'exitCode': code, 'timedOut': timed_out, 'elapsedSeconds': record['elapsedSeconds']}), flush=True)
    return code


def checked_git(*args):
    return subprocess.check_output(['git', *args], cwd=REF)


try:
    assert interval['status'] == 'active'
    assert remaining() > 60
    OUT.mkdir(parents=True, exist_ok=True)
    assert not (OUT / 'source-manifest.json').exists(), 'No second source freeze or campaign is allowed'
    assert not (OUT / 'execution-isos.json').exists()
    # Exact output previously returned by the failed precheck. Neither helper nor game ran.
    previous_output = b'Traceback (most recent call last):\n  File "<stdin>", line 16, in <module>\nAssertionError\n'
    prep = {'schema': 'logos-engine.lot4c.reference-precheck-failure.v1', 'observedAt': now().isoformat(),
            'actualFailureTime': None, 'exitCode': 1, 'failure': 'Generated public/vendor/pyodide/pyodide.mjs absent in the reference checkout',
            'originalOutputCapture': 'Exact returned exec output retained after the observation; failure timestamp was not separately captured',
            'helpersExecuted': 0, 'gamesExecuted': 0, 'intervalStartUnchanged': interval['startedAt'],
            'output': gzip_exact(OUT / 'precheck-attempt01.stdout.log.gz', previous_output)}
    json_new(OUT / 'precheck-attempt01.json', prep)
    write_new(OUT / 'reference-orchestration.py', Path(__file__).read_bytes())
    assert checked_git('rev-parse', 'HEAD').decode().strip() == COMMIT
    assert checked_git('diff', '--name-only') == b''
    assert checked_git('diff', '--cached', '--name-only') == b''
    assert (REF / 'node_modules').resolve() == (CANDIDATE / 'node_modules').resolve()
    assert (REF / 'package-lock.json').read_bytes() == (CANDIDATE / 'package-lock.json').read_bytes()
    published_bytes = checked_git('show', COMMIT + ':' + PUB_REL.as_posix())
    assert published_bytes == (REF / PUB_REL).read_bytes()
    published = json.loads(published_bytes)
    assert published['nativeSourceDigest'] == DIGEST
    runtime_records = [v for v in published['inputs'] if v['path'].startswith('public/vendor/pyodide/')]
    assert len(runtime_records) == 12
    asset_checks = []
    for record in runtime_records:
        actual = evidence(CANDIDATE / record['path'], CANDIDATE)
        assert actual == record, (actual, record)
        asset_checks.append({'published': record, 'candidate': actual, 'identical': True})
    actual_runtime_names = {p.relative_to(CANDIDATE).as_posix() for p in (CANDIDATE / 'public/vendor/pyodide').rglob('*') if p.is_file()}
    expected_runtime_names = {v['path'] for v in runtime_records}
    assert actual_runtime_names == expected_runtime_names
    runtime_target = CANDIDATE / 'public/vendor/pyodide'
    runtime_link = REF / 'public/vendor/pyodide'
    runtime_link.parent.mkdir(parents=True, exist_ok=True)
    assert not runtime_link.exists() and not runtime_link.is_symlink()
    runtime_link.symlink_to(runtime_target, target_is_directory=True)
    for record in runtime_records:
        assert evidence(REF / record['path']) == record
    helpers = ['scripts/freeze-v53-native-source.py', 'scripts/run-bounded-native-campaign-proof.py',
               'scripts/run-bounded-native-campaign.mjs', 'tests/helpers/v6-live-game-campaign.ts',
               'scripts/run-v53-campaign-proof.py']
    helper_checks = []
    for name in helpers:
        data = (REF / name).read_bytes()
        assert data == checked_git('show', COMMIT + ':' + name)
        helper_checks.append(evidence(REF / name))
    repair = {'schema': 'logos-engine.lot4c.published-runtime-asset-restoration.v1', 'recordedAt': now().isoformat(),
              'referenceCommit': COMMIT, 'publishedInputReceipt': evidence(REF / PUB_REL),
              'publishedReceiptMatchesCommit': True, 'publishedNativeSourceDigest': DIGEST,
              'publishedAssetCollection': 'inputs entries with public/vendor/pyodide/ prefix',
              'assets': asset_checks, 'assetCount': len(asset_checks), 'completeRuntimeFileSetIdentical': True,
              'repair': {'operation': 'directory_symlink', 'path': str(runtime_link), 'target': str(runtime_target)},
              'nodeModulesSameResolvedDirectory': True, 'packageLockIdentical': True,
              'unchangedPublishedHelpers': helper_checks,
              'qualification': 'Restores generated runtime assets omitted from this checkout. No tracked reference code, agent state, command or rule is changed.'}
    json_new(OUT / 'runtime-asset-restoration.json', repair)
    print(json.dumps({'runtimeAssetsVerified': len(asset_checks), 'referenceCommit': COMMIT, 'remainingBudgetSeconds': remaining()}), flush=True)
    freeze_code = run_phase('freeze', ['python', '-B', 'scripts/freeze-v53-native-source.py', 'freeze', REL.as_posix()])
    assert freeze_code == 0
    manifest = json.loads((OUT / 'source-manifest.json').read_text())
    assert manifest['digest'] == DIGEST
    outcome['campaignAttempted'] = True
    outcome['campaignCount'] = 1
    campaign_code = run_phase('campaign', ['python', '-B', 'scripts/run-bounded-native-campaign-proof.py', 'ISOS', '3', '8', REL.as_posix()])
    outcome['campaignExitCode'] = campaign_code
    for name in ['isos-campaign.json.gz', 'isos-public-trace.json.gz']:
        p = OUT / name
        if p.exists():
            value = json.loads(gzip.decompress(p.read_bytes()))
            if name == 'isos-campaign.json.gz':
                outcome.update({'status': value.get('status'), 'final': value.get('final'),
                                'outerReferenceLimit': value.get('outerReferenceLimit')})
    if (OUT / 'execution-isos.json').exists():
        execution = json.loads((OUT / 'execution-isos.json').read_text())
        assert execution['nativeSourceUnchanged'] and execution['executionCodeUnchanged']
    if 'campaignExitCode' in outcome and outcome['status'] == 'preparing':
        outcome['status'] = 'campaign_without_report'
    assert checked_git('diff', '--name-only') == b''
    assert checked_git('diff', '--cached', '--name-only') == b''
    for record in runtime_records:
        assert evidence(REF / record['path']) == record
    outcome['trackedReferenceSourceUnchanged'] = True
    outcome['publishedRuntimeAssetsUnchanged'] = True
except BaseException as exc:
    outcome['status'] = 'orchestration_failure'
    outcome['error'] = repr(exc)
    output = traceback.format_exc().encode()
    outcome['failureTrace'] = gzip_exact(OUT / 'orchestration-failure.stdout.log.gz', output)
    print(output.decode(), flush=True)
finally:
    # If interrupted before the helper could archive the actual outputs, preserve their exact bytes here.
    for raw_name, archive_name in [('v53-reference-isos-056-isos-live.log', 'recovered-isos-live.log.gz'),
                                   ('v53-reference-isos-056-isos-actual-public-journal.jsonl', 'recovered-isos-actual-public-journal.jsonl.gz')]:
        raw = REF.parent / raw_name
        if raw.exists() and not (OUT / 'execution-isos.json').exists():
            outcome.setdefault('recoveredRawEvidence', []).append(gzip_exact(OUT / archive_name, raw.read_bytes()))
    receipt = {'schema': 'logos-engine.lot4c.bounded-published-reference-execution.v1',
               'referenceCommit': COMMIT, 'referenceNativeVersion': '0.56', 'referenceNativeSourceDigest': DIGEST,
               'recordedAt': now().isoformat(), 'lock': {'mode': 'shared', 'nonblocking': True,
                    'path': '/workspace/shared/sra-coordination/performance.lock'},
               'intervalStartedAt': interval['startedAt'], 'phases': phases, 'outcome': outcome,
               'qualification': 'One cold reference with target 3 levels and cap 8 acquired actions. A cap or failed outcome is a bounded observation, not a global inability. No action or state injection, alternative case or rerun.'}
    json_new(OUT / 'reference-case-execution.json', receipt)
    copied = []
    copy_error = None
    try:
        for source in sorted(p for p in OUT.rglob('*') if p.is_file()):
            relative = source.relative_to(OUT)
            target = DEST / relative
            data = source.read_bytes()
            if target.exists():
                assert target.read_bytes() == data, 'Refusing to overwrite distinct evidence: ' + str(target)
                action = 'verified_existing'
            else:
                write_new(target, data)
                action = 'copied_absent'
            assert target.read_bytes() == data
            copied.append({'source': evidence(source), 'destination': evidence(target, CANDIDATE), 'action': action, 'identical': True})
        copy_receipt = CANDIDATE / 'docs/migration/lot4c-evidence/development/isos-reference-056-copy.json'
        json_new(copy_receipt, {'schema': 'logos-engine.lot4c.exact-reference-evidence-copy.v1',
                               'recordedAt': now().isoformat(), 'sourceCheckout': str(REF), 'destinationCheckout': str(CANDIDATE),
                               'fileCount': len(copied), 'files': copied, 'allBytesIdentical': True})
    except BaseException as exc:
        copy_error = repr(exc)
    ended = now()
    charged = (ended - started).total_seconds()
    interval.update({'status': 'completed' if copy_error is None else 'copy_failure', 'finishedAt': ended.isoformat(),
                     'chargedSeconds': charged, 'chargedCumulativeSeconds': interval['priorChargedSeconds'] + charged,
                     'withinBudget': interval['priorChargedSeconds'] + charged <= interval['maximumCumulativeSeconds'],
                     'outcome': outcome, 'preparationFailureIncluded': True, 'caseClockModified': False,
                     'referenceReceipt': evidence(OUT / 'reference-case-execution.json')})
    if copy_error is None:
        interval['copyReceipt'] = evidence(copy_receipt, CANDIDATE)
        interval['copiedReceiptFingerprints'] = [evidence(p, CANDIDATE) for p in [DEST / 'precheck-attempt01.json', DEST / 'runtime-asset-restoration.json', DEST / 'execution-isos.json', DEST / 'source-manifest.json', DEST / 'source-archive.json'] if p.exists()]
    else:
        interval['copyError'] = copy_error
    temporary = INTERVAL.with_suffix('.tmp')
    temporary.write_text(json.dumps(interval, indent=2) + '\n')
    os.replace(temporary, INTERVAL)
    print(json.dumps({'outcome': outcome, 'copiedFiles': len(copied), 'copyError': copy_error,
                      'finishedAt': ended.isoformat(), 'chargedSeconds': charged,
                      'chargedCumulativeSeconds': interval['chargedCumulativeSeconds'], 'withinBudget': interval['withinBudget']}), flush=True)
