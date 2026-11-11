#!/usr/bin/env python3
"""Keep the caller's SH lock and case-clock interval alive across root CUA work.
This helper controls only the managed preview. It cannot close a browser tab or
terminate/verify a browser worker. Root must close CUA and stop preview first,
then create operator-close.json; no UI state is inferred from process exit.
"""
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlsplit
import argparse, hashlib, json, os, re, signal, subprocess, time, traceback

def now():
    return datetime.now(timezone.utc).isoformat()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--checkout', required=True)
    parser.add_argument('--output-directory', required=True)
    args = parser.parse_args()
    checkout = Path(args.checkout).resolve(strict=True)
    out = Path(args.output_directory).resolve(strict=True)
    if not Path(args.checkout).is_absolute() or not checkout.is_relative_to('/workspace') or not out.is_relative_to(checkout):
        raise ValueError('Use the absolute workspace checkout and its prepared output directory')
    if os.environ.get('SITES_MANAGED_LINUX_CONTAINER') != '1':
        raise ValueError('Managed Sites preview environment is required')
    marker = out / 'operator-close.json'
    for name in ('operator-close.json', 'preview-ready.json', 'preview-session-result.json', 'status-before.json', 'preview-start.json', 'preview-stop-finally.json', 'status-after-finally.json', 'closure-required.json', 'preview-start.stdout.log', 'preview-start.stderr.log', 'preview-lease-terminal.json'):
        if (out / name).exists():
            raise FileExistsError('New execution outputs required: ' + name)
    started = now()
    timer = time.monotonic()
    attempted_start = False
    lease = None
    lease_started_at = None
    lease_terminal = None
    accepted_close = None
    close_elapsed = None
    ready = None
    problem = None
    stop_confirmed = False
    calls = []
    def save(name, value):
        with (out / name).open('x') as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2, allow_nan=False)
            stream.write('\n')
    def run(label, argv, seconds):
        began = now()
        tick = time.monotonic()
        try:
            child = subprocess.run(argv, cwd=checkout, capture_output=True, text=True, timeout=seconds)
            row = {'argv': argv, 'exitCode': child.returncode, 'stdout': child.stdout, 'stderr': child.stderr, 'timedOut': False}
        except subprocess.TimeoutExpired as error:
            decode = lambda value: value.decode(errors='replace') if isinstance(value, bytes) else (value or '')
            row = {'argv': argv, 'exitCode': None, 'stdout': decode(error.stdout), 'stderr': decode(error.stderr), 'timedOut': True}
        row.update({'startedAt': began, 'finishedAt': now(), 'elapsedSeconds': time.monotonic() - tick, 'limitSeconds': seconds})
        save(label + '.json', row)
        calls.append({'file': label + '.json', 'exitCode': row['exitCode'], 'timedOut': row['timedOut']})
        return row
    def start_lease():
        nonlocal lease, lease_started_at
        argv = ['sites-preview', 'start', str(checkout)]
        stdout_path, stderr_path = out / 'preview-start.stdout.log', out / 'preview-start.stderr.log'
        lease_started_at = now()
        tick = time.monotonic()
        with stdout_path.open('xb') as stdout, stderr_path.open('xb') as stderr:
            lease = subprocess.Popen(argv, cwd=checkout, stdout=stdout, stderr=stderr)
        row = None
        observed_urls = []
        while time.monotonic() - tick < 60:
            stdout = stdout_path.read_text(errors='replace')
            stderr = stderr_path.read_text(errors='replace')
            complete_stdout = stdout[:stdout.rfind('\n') + 1]
            complete_stderr = stderr[:stderr.rfind('\n') + 1]
            observed_urls = list(dict.fromkeys(re.findall(r'https?://[^\s\x1b<>"\x27]+', complete_stdout + '\n' + complete_stderr)))
            code = lease.poll()
            if observed_urls or code is not None:
                row = {'argv': argv, 'pid': lease.pid, 'pidKind': 'our sites-preview CLI lease process only',
                       'exitCode': code, 'liveAtUrlObservation': code is None and len(observed_urls) == 1,
                       'stdout': stdout, 'stderr': stderr, 'observedUrls': observed_urls, 'timedOut': False}
                break
            time.sleep(0.1)
        if row is None:
            row = {'argv': argv, 'pid': lease.pid, 'pidKind': 'our sites-preview CLI lease process only',
                   'exitCode': lease.poll(), 'liveAtUrlObservation': False,
                   'stdout': stdout_path.read_text(errors='replace'), 'stderr': stderr_path.read_text(errors='replace'),
                   'observedUrls': observed_urls, 'timedOut': True}
        row.update({'startedAt': lease_started_at, 'urlObservationAt': now(), 'elapsedSeconds': time.monotonic() - tick,
                    'urlWaitLimitSeconds': 60, 'stdoutFile': stdout_path.name, 'stderrFile': stderr_path.name,
                    'exitZeroRequiredAtReady': False})
        save('preview-start.json', row)
        calls.append({'file': 'preview-start.json', 'pid': lease.pid, 'exitCode': row['exitCode'], 'timedOut': row['timedOut']})
        return row
    def reap_lease():
        nonlocal lease_terminal
        if lease is None:
            return
        began = now()
        actions = []
        reap_error = None
        try:
            try:
                code = lease.wait(timeout=10)
            except subprocess.TimeoutExpired:
                actions.append({'signal': 'SIGTERM', 'at': now(), 'pid': lease.pid, 'scope': 'own CLI process only'})
                lease.terminate()
                try:
                    code = lease.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    actions.append({'signal': 'SIGKILL', 'at': now(), 'pid': lease.pid, 'scope': 'own CLI process only'})
                    lease.kill()
                    code = lease.wait(timeout=5)
        except BaseException as error:
            code = lease.poll()
            reap_error = {'type': type(error).__name__, 'message': str(error)}
        log_records = {}
        for name in ('preview-start.stdout.log', 'preview-start.stderr.log'):
            data = (out / name).read_bytes()
            log_records[name] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
        lease_terminal = {'schema': 'logos-engine.lot6b-managed-preview-lease-terminal.v1',
                          'pid': lease.pid, 'pidKind': 'our sites-preview CLI lease process only',
                          'startedAt': lease_started_at, 'reapStartedAt': began, 'terminalObservationAt': now(),
                          'exitCode': code, 'exitSignal': -code if code is not None and code < 0 else None,
                          'signalsSentToOwnProcess': actions, 'reaped': lease.poll() is not None,
                          'error': reap_error, 'logs': log_records, 'browserWorkerClosedClaimed': False,
                          'qualification': 'Controlled CLI lease cleanup is not proof of UI closure or functional QA success.'}
        save('preview-lease-terminal.json', lease_terminal)
    def stopped(row):
        # Exact output observed by root before this declaration. Unknown forms fail closed.
        return row['exitCode'] == 0 and not row['timedOut'] and row['stdout'] == 'Sites preview stopped\n'
    def interrupted(signum, frame):
        raise InterruptedError('Supervisor signal ' + str(signum))
    signal.signal(signal.SIGTERM, interrupted)
    try:
        before = run('status-before', ['sites-preview', 'status'], 15)
        if not stopped(before):
            raise RuntimeError('Managed preview is not confirmed stopped; refusing to replace any existing preview')
        attempted_start = True
        launch = start_lease()
        if not launch['liveAtUrlObservation'] or launch['timedOut']:
            raise RuntimeError('Managed preview lease did not expose one URL while still alive within60s')
        urls = list(dict.fromkeys(re.findall(r'https?://[^\s\x1b<>"\x27]+', launch['stdout'] + '\n' + launch['stderr'])))
        if len(urls) != 1:
            raise RuntimeError('Start must return exactly one unambiguous HTTP(S) URL')
        exact_url = urls[0]
        parsed = urlsplit(exact_url)
        if parsed.scheme not in ('http', 'https') or not parsed.netloc or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise RuntimeError('Unsupported returned URL; no host, port, query or fragment is guessed')
        qa_url = exact_url + '?game=KLOT&level=1'
        if lease.poll() is not None:
            raise RuntimeError('CLI lease ended before ready could be recorded')
        ready = {'schema': 'logos-engine.lot6b-browser-preview-ready.v1', 'status': 'awaiting_root_cua',
                 'startedAt': started, 'readyAt': now(), 'exactReturnedUrl': exact_url, 'qaUrl': qa_url,
                 'leasePid': lease.pid, 'leaseAliveAtReady': lease.poll() is None, 'leaseEvidence': 'preview-start.json',
                 'selection': 'Only the explicitly authorized UI query game=KLOT&level=1 is appended; host/port/path remain exactly returned.',
                 'qaTargetSeconds': 360, 'operatorClosureDeadlineSeconds': 480, 'helperWaitLimitSeconds': 525,
                 'outerSupervisorLimitSeconds': 600, 'browserWorkerControllableByHelper': False}
        save('preview-ready.json', ready)
        print(json.dumps(ready), flush=True)
        notified = False
        while time.monotonic() - timer < 525:
            elapsed = time.monotonic() - timer
            if marker.exists():
                close = json.loads(marker.read_text())
                if not isinstance(close, dict) or close.get('schema') != 'logos-engine.lot6b-browser-qa-operator-close.v1' or close.get('tabClosedObserved') is not True or close.get('previewStoppedObserved') is not True or close.get('qaUrl') != qa_url or not isinstance(close.get('tabId'), str) or not close['tabId'] or not isinstance(close.get('recordedAt'), str):
                    raise ValueError('Invalid operator closure attestation; it is never inferred from a timeout')
                accepted_close = close
                close_elapsed = elapsed
                if elapsed >= 480:
                    raise TimeoutError('Operator closure arrived after the declared 480-second deadline')
                break
            if elapsed >= 360 and not notified:
                notice = {'recordedAt': now(), 'elapsedSeconds': elapsed, 'action': 'Root must finish QA, actually close CUA tab, stop preview, then write operator-close.json before480s.'}
                save('closure-required.json', notice)
                print(json.dumps(notice), flush=True)
                notified = True
            time.sleep(0.5)
        else:
            raise TimeoutError('No operator closure attestation by525s; UI/worker closure remains unconfirmed')
    except BaseException as error:
        problem = {'type': type(error).__name__, 'message': str(error), 'traceback': traceback.format_exc()}
    finally:
        if attempted_start:
            try:
                # Root reserves this one daemon preview throughout the interval.
                # Root may already have stopped it; stop is still bounded and recorded.
                try:
                    run('preview-stop-finally', ['sites-preview', 'stop'], 30)
                finally:
                    try:
                        reap_lease()
                    finally:
                        after = run('status-after-finally', ['sites-preview', 'status'], 15)
                        stop_confirmed = stopped(after)
                if not stop_confirmed and problem is None:
                    problem = {'type': 'RuntimeError', 'message': 'Managed preview stop is not confirmed'}
            except BaseException as error:
                if problem is None:
                    problem = {'type': type(error).__name__, 'message': str(error), 'traceback': traceback.format_exc()}
        passed = problem is None and accepted_close is not None and close_elapsed is not None and close_elapsed < 480 and stop_confirmed and lease_terminal is not None and lease_terminal['reaped']
        result = {'schema': 'logos-engine.lot6b-browser-preview-supervision.v1',
                  'status': 'operator_closed_preview_interval' if passed else 'preview_interval_failed',
                  'startedAt': started, 'finishedAt': now(), 'elapsedSeconds': time.monotonic() - timer,
                  'previewReady': ready, 'commands': calls, 'error': problem, 'leaseTerminal': lease_terminal,
                  'operatorClosureAttestation': accepted_close, 'operatorClosureReceivedSeconds': close_elapsed,
                  'previewStoppedObservedByHelper': stop_confirmed,
                  'browserTabClosedByHelper': False, 'browserWorkerTerminationVerifiedByHelper': False,
                  'uiClosureProof': 'Only root CUA observations plus its post-closure attestation; daemon stop or outer600s is never UI closure proof.',
                  'functionalQaPassedClaimed': False}
        save('preview-session-result.json', result)
        print(json.dumps(result), flush=True)
    raise SystemExit(0 if passed else 1)

if __name__ == '__main__':
    main()
