#!/usr/bin/env python3
"""One prospective functional qualification stage; never creates its plan/freeze.

CLI: python qualify-composition.py --plan PATH --stage NAME --directory NEW
Paths in the plan are checkout-relative (or absolute inside this checkout),
except fingerprinted executable/tool inputFiles, which may be absolute.

Plan schema: logos-engine.v6.functional-qualification-plan.v1, version:1,
status:declared_ready_for_explicit_root_go, qualification:functional_only,
parent:{commit:705d5c752500f88bd23fea3fa620edb6914579d2}, summary:FP, nativeManifest:FP,
runner:FP (this file), inventoryRunner:FP (unchanged validate-composition.py),
freeze:FP (JSON exactly equal to its inputs()), inputFiles:[FP,...],
stages:[{name,argv:[...],env:{...},timeoutSeconds:1..2400,
totalTimeoutSeconds:1..2400,expectedExitCode:0,outputPaths:[NEW repo paths],
assertions:[{file:<explicit repo path>,path:[key,index,...],op,value?}]}].
FP means {path,sha256,bytes}; no plan self-fingerprint is required. The native
manifest is either the nativeSource object or an object containing nativeSource.
A stage's deadline includes preflight, command and postflight. outputPaths are
new outputs, separate from NEW receipt directory; assertions stay within them.
Ops: value_equal (typed JSON equality), value_false, list_empty, length.
For length, value is a nonnegative integer. At least one assertion is required.

The frozen inventory profile is EXACTLY validate-composition.inputs(), including
opaque hashes of excluded modules and original files. Those modules may never
appear in executed argv. No fixture is decoded by inventory. Root supplies and
reviews every command, tool/fixture fingerprint and semantic assertion. Scripts
and fixtures passed as existing argv paths must be present in inputFiles or in
the frozen inventories; the resolved executable must be in inputFiles.
Allowed environment overrides: NODE_OPTIONS, LOGOS_LOT5C_COMMON_EVIDENCE_DIR,
PYTHONHASHSEED, PYTHONDONTWRITEBYTECODE. Receipts retain only these declared
nonsecret values. Each invocation creates NEW once, launches one process group,
and never advances to another stage. Logs, receipts and compressed copies are
exclusive-create. New quiet, deadline, SIGINT or SIGTERM stops/reaps the group. SIGINT/SIGTERM
are ignored during cleanup and the prior handlers are then restored.
No hashing or compression occurs after an observed quiet/coordination failure.
This wrapper does not establish final publication, game success or cost.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import fcntl
import gzip
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import threading
import time

ROOT = Path(__file__).resolve().parents[4]
LOCK = Path('/workspace/shared/sra-coordination/performance.lock')
LANES = ('lot5c', 'lot6b', 'lot10c')
INVENTORY = ROOT / 'docs/migration/lot8a-evidence/tools/validate-composition.py'
INVENTORY_SHA = '3d58f82af41a4c467077f2cb1210347989c8ffac9f008da094b3891272be3e3d'
NATIVE_SHA = '936fa2bf81965272b1ddbab4a5c01f98aeb6a48188c1f7a8c91de226598c5e43'
CLOSED = ('v6-ranked-workshop-reference.test.ts', 'v6-ranked-workshop-kernel.test.ts',
          'v6-symbol-transactions-kernel.test.ts', 'v6-framed-transfer-reference.test.ts')
ENV_KEYS = {'NODE_OPTIONS', 'LOGOS_LOT5C_COMMON_EVIDENCE_DIR', 'PYTHONHASHSEED', 'PYTHONDONTWRITEBYTECODE'}


def now():
    return datetime.now(timezone.utc).isoformat()


def require(value, message):
    if not value:
        raise ValueError(message)


def repo_path(value):
    require(isinstance(value, str) and value, 'Expected explicit path')
    p = Path(value)
    p = (p if p.is_absolute() else ROOT / p).resolve()
    require(p.is_relative_to(ROOT), 'Path escapes checkout')
    return p


def stop_group(process):
    if process is None:
        return
    # Kill remaining descendants even if the immediate command already exited.
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    try:
        process.wait(timeout=2)
    except subprocess.TimeoutExpired:
        pass
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    process.wait()


class TerminationRequested(KeyboardInterrupt):
    def __init__(self, signum):
        self.signum = signum
        super().__init__('Controlled interruption: ' + signal.Signals(signum).name)


def validate_summary(value):
    require(value.get('schema') == 'logos-engine.v6.motif-access-provisional-composition-summary.v1', 'Wrong validation summary schema')
    require(value.get('status') == 'provisional_composition_validated_final_qualification_pending', 'Wrong validation summary status')
    require(value.get('qualification') == 'provisional_063_064_composition_not_final_065_or_cost', 'Wrong summary qualification')
    require(value.get('nativeSource') == {'fileCount': 324, 'digest': NATIVE_SHA}, 'Summary native source differs')
    tests = value.get('tests', {})
    expected = {'files': 145, 'tests': 5606, 'pass': 5606, 'fail': 0, 'cancelled': 0, 'skipped': 0, 'todo': 0}
    require(all(type(tests.get(key)) is int and tests[key] == wanted for key, wanted in expected.items()), 'Summary test counts differ')
    require(tests.get('inputsUnchanged') is True and value.get('originalFilesVerifiedBeforeAndAfter') == 1786, 'Summary input continuity differs')
    checks = value.get('checks')
    names = {'typecheck', 'entry-audit', 'migration-audit', 'diff-check', 'build'}
    require(isinstance(checks, list) and len(checks) == 5 and all(isinstance(row, dict) for row in checks), 'Summary must contain five checks')
    require({row.get('name') for row in checks} == names, 'Summary check membership differs')
    require(all(row.get('status') == 'passed' and type(row.get('exitCode')) is int and row['exitCode'] == 0 and row.get('semanticPassed') is True and row.get('inputsUnchanged') is True for row in checks), 'Summary gates are not all passed and unchanged')


class Guard:
    def __init__(self, deadline):
        self.deadline = deadline
        self.reason = None
        self.quiet = False
        self.process = None
        self.finished = threading.Event()
        self.observations = {}
        self.thread = None

    def poll(self):
        if self.reason:
            return
        try:
            for lane in LANES:
                p = Path('/workspace/shared/sra-coordination') / (lane + '-status.json')
                with p.open('rb') as f:
                    raw = f.read(65537)
                require(len(raw) <= 65536, 'Coordination exceeds 64 KiB')
                value = json.loads(raw)
                self.observations[lane] = {'observedAt': now(), 'updated_at': value.get('updated_at'),
                    'quiet_requested': value.get('quiet_requested'), 'performance_started': value.get('performance_started')}
                if value.get('quiet_requested') is True or value.get('performance_started') is True:
                    self.quiet = True
                    self.reason = 'quiet_requested:' + lane
                    return
            if time.monotonic() >= self.deadline:
                self.reason = 'total_deadline'
        except Exception:
            self.quiet = True
            self.reason = 'coordination_unreadable'

    def check(self):
        if self.reason:
            raise RuntimeError(self.reason)
        if time.monotonic() >= self.deadline:
            self.reason = 'total_deadline'
            raise RuntimeError(self.reason)

    def watch(self):
        while not self.finished.wait(1):
            self.poll()
            if self.reason:
                if self.process is not None:
                    try:
                        os.killpg(self.process.pid, signal.SIGTERM)
                    except ProcessLookupError:
                        pass
                return

    def start(self):
        self.thread = threading.Thread(target=self.watch, daemon=True)
        self.thread.start()

    def close(self):
        self.finished.set()
        if self.thread:
            self.thread.join(timeout=2)


def digest(path, guard):
    h = hashlib.sha256()
    guard.check()
    with Path(path).open('rb') as f:
        while True:
            guard.check()
            block = f.read(1024 * 1024)
            if not block:
                break
            guard.check()
            h.update(block)
    return h.hexdigest()


def fingerprint(path, guard):
    p = Path(path).resolve()
    return {'path': p.relative_to(ROOT).as_posix() if p.is_relative_to(ROOT) else str(p),
            'sha256': digest(p, guard), 'bytes': p.stat().st_size}


def checked(record, guard, external=False):
    require(isinstance(record, dict) and set(record) == {'path', 'sha256', 'bytes'}, 'Invalid fingerprint')
    p = Path(record['path'])
    p = p.resolve() if p.is_absolute() else repo_path(record['path'])
    require(external or p.is_relative_to(ROOT), 'External proof path refused')
    actual = fingerprint(p, guard)
    require(actual['sha256'] == record['sha256'] and actual['bytes'] == record['bytes'], 'Fingerprint mismatch: ' + record['path'])
    return p


def load_json(path, guard):
    guard.check()
    with Path(path).open() as f:
        value = json.load(f, parse_constant=lambda _: (_ for _ in ()).throw(ValueError('Nonfinite JSON')))
    guard.check()
    return value


def semantic(assertion, guard):
    p = repo_path(assertion['file'])
    value = load_json(p, guard)
    path = assertion['path']
    require(isinstance(path, list), 'JSON path must be a list')
    for part in path:
        require(type(part) in (str, int), 'JSON path component')
        require(not isinstance(part, int) or part >= 0, 'Negative JSON index')
        value = value[part]
    op = assertion['op']
    expected = assertion.get('value')
    if op == 'value_equal':
        passed = json.dumps(value, sort_keys=True, allow_nan=False) == json.dumps(expected, sort_keys=True, allow_nan=False)
    elif op == 'value_false':
        passed = value is False
    elif op == 'list_empty':
        passed = isinstance(value, list) and len(value) == 0
    elif op == 'length':
        require(type(expected) is int and expected >= 0, 'Expected nonnegative length')
        passed = isinstance(value, (list, dict, str)) and len(value) == expected
    else:
        raise ValueError('Unknown semantic operator')
    return {'file': assertion['file'], 'path': path, 'op': op, 'expected': expected,
            'actual': len(value) if op == 'length' else value, 'passed': passed}


def compress_log(path, guard):
    destination = Path(str(path) + '.gz')
    with destination.open('xb') as raw:
        guard.check()
        zipped = gzip.GzipFile(filename='', mode='wb', fileobj=raw, mtime=0)
        try:
            with path.open('rb') as source:
                while True:
                    guard.check()
                    data = source.read(65536)
                    if not data:
                        break
                    guard.check()
                    zipped.write(data)
            guard.check()
            zipped.close()
        except BaseException:
            # Retain the partial archive without post-quiet compressor flush/footer.
            zipped.fileobj = None
            raise
    guard.check()
    return {'raw': fingerprint(path, guard), 'gzip': fingerprint(destination, guard),
            'compression': 'gzip mtime=0, empty filename; original bytes streamed without alteration'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', required=True)
    parser.add_argument('--stage', required=True)
    parser.add_argument('--directory', required=True)
    args = parser.parse_args()
    started = time.monotonic()
    guard = Guard(started + 2400)
    receipt = {'schema': 'logos-engine.v6.functional-qualification-stage.v1', 'startedAt': now(),
               'stage': args.stage, 'status': 'failed', 'before': None, 'after': None,
               'semantics': [], 'exitCode': None, 'logs': [], 'plan': None}
    directory = None
    directory_created = False
    process = None
    lock = None
    signals = (signal.SIGINT, signal.SIGTERM)
    previous_handlers = {sig: signal.getsignal(sig) for sig in signals}
    termination = {'launching': False, 'pending': None}

    def controlled_signal(signum, _frame):
        termination['pending'] = signum
        if not termination['launching']:
            raise TerminationRequested(signum)

    try:
        for sig in signals:
            signal.signal(sig, controlled_signal)
        guard.poll(); guard.check()
        lock = LOCK.open('rb')  # Existing mutex only; never creates or replaces it.
        fcntl.flock(lock, fcntl.LOCK_SH | fcntl.LOCK_NB)
        guard.poll(); guard.check(); guard.start()
        plan_path = repo_path(args.plan)
        plan = load_json(plan_path, guard)
        require(plan['schema'] == 'logos-engine.v6.functional-qualification-plan.v1' and plan['version'] == 1, 'Plan schema/version')
        require(plan['status'] == 'declared_ready_for_explicit_root_go' and plan['qualification'] == 'functional_only', 'Prospective functional declaration required')
        stages = plan['stages']
        require(len({s['name'] for s in stages}) == len(stages), 'Duplicate stage')
        selected = [s for s in stages if s['name'] == args.stage]
        require(len(selected) == 1, 'Unknown stage')
        stage = selected[0]
        total = stage['totalTimeoutSeconds']; timeout = stage['timeoutSeconds']
        require(type(total) in (int, float) and type(timeout) in (int, float) and 0 < timeout <= total <= 2400, 'Invalid prospective deadline')
        guard.deadline = started + total; guard.check()
        directory = repo_path(args.directory)
        require(directory.is_relative_to(ROOT / 'docs/migration'), 'Receipt directory must be under docs/migration')
        directory.mkdir(parents=False, exist_ok=False)
        directory_created = True
        receipt['plan'] = fingerprint(plan_path, guard)
        receipt['timeouts'] = {'commandSeconds': timeout, 'totalSeconds': total}
        require(plan['parent']['commit'] == '705d5c752500f88bd23fea3fa620edb6914579d2', 'Expected exact declared705d5c7 parent')
        receipt['parent'] = plan['parent']
        for key in ('runner', 'inventoryRunner', 'summary', 'nativeManifest', 'freeze'):
            checked(plan[key], guard)
        require(checked(plan['runner'], guard) == Path(__file__).resolve(), 'Wrong wrapper')
        require(checked(plan['inventoryRunner'], guard) == INVENTORY and plan['inventoryRunner']['sha256'] == INVENTORY_SHA, 'Wrong inventory runner')
        receipt['runner'] = plan['runner']; receipt['inventoryRunner'] = plan['inventoryRunner']
        receipt['summary'] = plan['summary']; receipt['nativeManifest'] = plan['nativeManifest']; receipt['freeze'] = plan['freeze']
        validate_summary(load_json(checked(plan['summary'], guard), guard))
        manifest = load_json(checked(plan['nativeManifest'], guard), guard)
        manifest = manifest.get('nativeSource', manifest)
        require(manifest['fileCount'] == 324 and manifest['digest'] == NATIVE_SHA, 'Wrong native manifest')
        frozen = load_json(checked(plan['freeze'], guard), guard)
        require(frozen['nativeSource'] == manifest, 'Frozen native manifest differs')
        sys.dont_write_bytecode = True
        spec = importlib.util.spec_from_file_location('_frozen_composition_inventory', INVENTORY)
        inventory = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(inventory)
        # Preserve inputs() and inventory() exactly; only add a stop check to opaque reads.
        inventory.sha = lambda p: digest(p, guard)
        declared = {str(checked(row, guard, external=True)): row for row in plan['inputFiles']}
        receipt['declaredInputs'] = plan['inputFiles']
        receipt['before'] = inventory.inputs(); guard.check()
        require(receipt['before'] == frozen, 'Inputs differ from prospective freeze')
        argv = stage['argv']; env = stage.get('env', {})
        require(isinstance(argv, list) and argv and all(isinstance(x, str) and x for x in argv), 'argv must be explicit strings')
        require(all(not any(closed in value for closed in CLOSED) for value in argv), 'Closed module in executable argv')
        require(Path(argv[0]).name not in ('sh', 'bash', 'zsh', 'fish', 'cmd', 'powershell'), 'Shell invocation refused')
        require(not any(x in ('-c', '-e', '--eval') for x in argv[1:]), 'Inline execution refused')
        require(isinstance(env, dict) and set(env) <= ENV_KEYS and all(isinstance(x, str) for x in env.values()), 'Environment not explicitly allowed')
        for value in [*argv, *env.values()]:
            require(not any(closed in value for closed in CLOSED), 'Closed module in command/environment')
            require(not re.search(r'(?i)(?:password|secret|access.token|authorization)\s*[:=]|https?://[^/\s]+@', value), 'Secret-like command/environment refused')
        executable = shutil.which(argv[0]); require(executable is not None, 'Executable unavailable')
        require(str(Path(executable).resolve()) in declared, 'Executable must be fingerprinted in inputFiles')
        frozen_paths = set(frozen['sourceAndTestInputs']) | set(frozen['auxiliaryScriptInputs']) | set(frozen['buildInputs']) | set(frozen['originalInputs']['files'])
        for arg in argv[1:]:
            p = Path(arg)
            p = p if p.is_absolute() else ROOT / p
            if p.is_file():
                p = p.resolve()
                require(str(p) in declared or (p.is_relative_to(ROOT) and p.relative_to(ROOT).as_posix() in frozen_paths), 'Unpinned argv input')
        outputs = [repo_path(x) for x in stage['outputPaths']]
        require(outputs and all(p.is_relative_to(ROOT / 'docs/migration') and not p.exists() for p in outputs), 'Output already exists or outside evidence area')
        require(all(p != directory and not directory.is_relative_to(p) and not p.is_relative_to(directory) for p in outputs), 'Command outputs must be separate from receipts')
        assertions = stage['assertions']; require(isinstance(assertions, list) and assertions, 'Explicit semantic assertions required')
        require(stage['expectedExitCode'] == 0, 'Qualification requires declared exit zero')
        for item in assertions:
            p = repo_path(item['file'])
            require(any(p == root or p.is_relative_to(root) for root in outputs), 'Semantic output not declared')
            require(item['op'] in ('value_equal', 'value_false', 'list_empty', 'length') and isinstance(item['path'], list), 'Invalid assertion')
        if 'LOGOS_LOT5C_COMMON_EVIDENCE_DIR' in env:
            require(repo_path(env['LOGOS_LOT5C_COMMON_EVIDENCE_DIR']) in outputs, 'Binding sink must be a declared new output')
        receipt['command'] = {'argv': argv, 'resolvedExecutable': str(Path(executable).resolve()), 'cwd': str(ROOT), 'env': env, 'shell': False}
        child_env = {key: os.environ[key] for key in ('PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'TZ') if key in os.environ}
        child_env.update(env)
        guard.poll(); guard.check()
        out = directory / 'stdout.log'; err = directory / 'stderr.log'
        receipt['rawLogPaths'] = [str(out), str(err)]
        with out.open('xb') as stdout, err.open('xb') as stderr:
            # Defer raising during Popen so the new group is known before cleanup.
            termination['launching'] = True
            try:
                process = subprocess.Popen(argv, executable=str(Path(executable).resolve()), cwd=ROOT,
                    env=child_env, stdout=stdout, stderr=stderr, shell=False, start_new_session=True)
                guard.process = process
            finally:
                termination['launching'] = False
            if termination['pending'] is not None:
                raise TerminationRequested(termination['pending'])
            command_deadline = min(guard.deadline, time.monotonic() + timeout)
            while process.poll() is None:
                guard.check()
                if time.monotonic() >= command_deadline:
                    raise TimeoutError('command_deadline')
                guard.finished.wait(0.2)
            receipt['exitCode'] = process.returncode
        stop_group(process); guard.process = None; process = None
        guard.poll(); guard.check()
        receipt['after'] = inventory.inputs(); guard.check()
        receipt['inputsUnchanged'] = receipt['after'] == frozen == receipt['before']
        for row in plan['inputFiles']:
            checked(row, guard, external=True)
        for key in ('runner', 'inventoryRunner', 'summary', 'nativeManifest', 'freeze'):
            checked(plan[key], guard)
        require(fingerprint(plan_path, guard) == receipt['plan'], 'Plan changed during execution')
        for assertion in assertions:
            try:
                receipt['semantics'].append(semantic(assertion, guard))
            except (KeyError, IndexError, TypeError, ValueError, OSError) as exc:
                guard.check()
                receipt['semantics'].append({'file': assertion['file'], 'path': assertion['path'], 'op': assertion['op'], 'passed': False, 'error': type(exc).__name__})
        receipt['outputs'] = [fingerprint(repo_path(p['file']), guard) for p in assertions if repo_path(p['file']).is_file()]
        for p in (out, err):
            guard.poll(); guard.check()
            receipt['logs'].append(compress_log(p, guard))
        require(receipt['exitCode'] == 0 and receipt['inputsUnchanged'] and all(x['passed'] for x in receipt['semantics']), 'Stage qualification failed')
        receipt['status'] = 'passed'
    except BaseException as exc:
        receipt['status'] = 'interrupted' if isinstance(exc, KeyboardInterrupt) else 'failed'
        receipt['error'] = {'type': type(exc).__name__, 'message': str(exc)}
    finally:
        for sig in signals:
            signal.signal(sig, signal.SIG_IGN)
        try:
            stop_group(process)
            if process is not None:
                receipt['exitCode'] = process.returncode
            guard.process = None
            if termination['pending'] is not None:
                receipt['status'] = 'interrupted'
                receipt['terminationSignal'] = signal.Signals(termination['pending']).name
            guard.poll()
            if guard.reason:
                receipt['status'] = 'stopped'
                receipt['stopReason'] = guard.reason
            receipt['quietObserved'] = guard.quiet
            receipt['finishedAt'] = now(); receipt['elapsedSeconds'] = time.monotonic() - started
            receipt['coordinationEnd'] = guard.observations
            guard.close()
            if directory_created:
                # Plain receipt retention only: no hashing/compression after quiet.
                with (directory / 'receipt.json').open('x') as f:
                    json.dump(receipt, f, indent=2, ensure_ascii=False); f.write('\n')
                print(json.dumps({'status': receipt['status'], 'receipt': str(directory / 'receipt.json')}))
            else:
                print(json.dumps({'status': receipt['status'], 'error': receipt.get('error'), 'stopReason': guard.reason}))
        finally:
            guard.close()
            if lock is not None:
                lock.close()
            for sig, handler in previous_handlers.items():
                signal.signal(sig, handler)
    return 0 if receipt['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
