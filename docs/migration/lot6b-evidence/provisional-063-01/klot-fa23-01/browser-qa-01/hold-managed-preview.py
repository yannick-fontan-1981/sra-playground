#!/usr/bin/env python3
"""Keep the caller's SH lock and case-clock interval alive across root CUA work.
This helper controls only the managed preview. It cannot close a browser tab or
terminate/verify a browser worker. Root must close CUA and stop preview first,
then create operator-close.json; no UI state is inferred from process exit.
"""
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlsplit
import argparse, json, os, re, signal, subprocess, time, traceback

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
    for name in ('operator-close.json', 'preview-ready.json', 'preview-session-result.json', 'status-before.json', 'preview-start.json', 'preview-stop-finally.json', 'status-after-finally.json', 'closure-required.json'):
        if (out / name).exists():
            raise FileExistsError('New execution outputs required: ' + name)
    started = now()
    timer = time.monotonic()
    attempted_start = False
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
        launch = run('preview-start', ['sites-preview', 'start', str(checkout)], 60)
        if launch['exitCode'] != 0 or launch['timedOut']:
            raise RuntimeError('Managed preview start did not complete successfully')
        urls = list(dict.fromkeys(re.findall(r'https?://[^\s\x1b<>"\x27]+', launch['stdout'] + '\n' + launch['stderr'])))
        if len(urls) != 1:
            raise RuntimeError('Start must return exactly one unambiguous HTTP(S) URL')
        exact_url = urls[0]
        parsed = urlsplit(exact_url)
        if parsed.scheme not in ('http', 'https') or not parsed.netloc or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise RuntimeError('Unsupported returned URL; no host, port, query or fragment is guessed')
        qa_url = exact_url + '?game=KLOT&level=1'
        ready = {'schema': 'logos-engine.lot6b-browser-preview-ready.v1', 'status': 'awaiting_root_cua',
                 'startedAt': started, 'readyAt': now(), 'exactReturnedUrl': exact_url, 'qaUrl': qa_url,
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
                run('preview-stop-finally', ['sites-preview', 'stop'], 30)
                after = run('status-after-finally', ['sites-preview', 'status'], 15)
                stop_confirmed = stopped(after)
                if not stop_confirmed and problem is None:
                    problem = {'type': 'RuntimeError', 'message': 'Managed preview stop is not confirmed'}
            except BaseException as error:
                if problem is None:
                    problem = {'type': type(error).__name__, 'message': str(error), 'traceback': traceback.format_exc()}
        passed = problem is None and accepted_close is not None and close_elapsed is not None and close_elapsed < 480 and stop_confirmed
        result = {'schema': 'logos-engine.lot6b-browser-preview-supervision.v1',
                  'status': 'operator_closed_preview_interval' if passed else 'preview_interval_failed',
                  'startedAt': started, 'finishedAt': now(), 'elapsedSeconds': time.monotonic() - timer,
                  'previewReady': ready, 'commands': calls, 'error': problem,
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
