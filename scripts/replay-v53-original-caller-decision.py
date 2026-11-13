#!/usr/bin/env python3
"""Observe unchanged original decisions at its public transport boundary only.

Unlike the historical trace/profile recorder, this observer copies an explicit
whitelist of reasoning locals only when the original caller requests a command.
Only a matching command receives its already witnessed full public packet. No
game host is loaded, no family function is patched, and no alternate proposal
is evaluated inside the original caller.
"""
from __future__ import annotations

import argparse
import contextlib
import gzip
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import traceback


ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
MANIFEST = SOURCE.parent / 'manifest.json'
BOUNDARY = ROOT / 'scripts/v6-caller-host-boundary.py'
EXPORTER = ROOT / 'scripts/export-v6-caller-reference.py'


def packed(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode() + b'\n'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def packet(value):
    return {'frame': value['frame_rows'], 'frames': value['frame_packet'],
            'availableActionIds': [int(action.removeprefix('ACTION')) for action in value['available_action_refs']],
            'state': value['state'], 'level': value['level'],
            'levelsCompleted': value['levels_completed'], 'stepIndex': value['step_index']}


class DiagnosticStopped(BaseException):
    pass


def child(config_path):
    config = json.loads(config_path.read_bytes())
    trace = json.loads(gzip.decompress(Path(config['trace']).read_bytes()))
    packets = trace['packets']
    bridge = load('v53_decision_host_boundary', BOUNDARY)
    exporter = load('v53_reasoning_plain_projection', EXPORTER)
    plain = exporter.plain
    manifest = json.loads(MANIFEST.read_bytes())
    hashes, _ = bridge.verify_source_manifest(SOURCE, manifest)
    clock = bridge.ActiveClock()
    bridge._install_clock(clock)
    snapshots = Path(config['work']) / 'decisions.jsonl'
    snapshots.touch(exist_ok=False)
    main_code = None

    class PublicReplay(bridge.PublicSession):
        def __init__(self):
            super().__init__(bridge.PublicObservation.from_browser(packet(packets[0]['packet'])))
            self.matched = 0
            self.stop = None

        def step(self, action_ref, *, data=None):
            clock.end()
            command = {'actionRef': action_ref, 'data': dict(data or {})}
            frame = sys._getframe().f_back
            while frame is not None and frame.f_code is not main_code:
                frame = frame.f_back
            if frame is None:
                raise RuntimeError('The public request has no unchanged common caller frame')
            local = frame.f_locals
            router = local['strategy_router']
            outline = router.outline_service
            observation = local['observation']
            snapshot = {
                'requestedActionOrdinal': self.matched + 1, 'matchedPublicReturnsBeforeRequest': self.matched,
                'command': command,
                'observation': {key: plain(observation[key]) for key in
                                ('observation_ref', 'revision', 'frame_hash', 'level_epoch', 'levels_completed', 'available_action_refs')
                                if key in observation},
                'proposal': plain(local.get('proposal')),
                'decisionReceipt': plain(local.get('receipt')),
                'outlineSourceState': plain({key: getattr(outline, key) for key in
                                             ('epoch', 'control', 'tracks', 'methods', 'attempts', 'last', 'last_event')}),
                'goalReason': plain(getattr(router, 'goal_reason', None)),
                'qualification': 'Only whitelisted reasoning locals from unchanged common_frontier_runtime.main and its OutlineService owner; no other stack locals or host state inspected.',
            }
            del frame, local
            expected = None
            if self.matched + 1 < len(packets):
                witnessed = packets[self.matched + 1]['command']
                expected = {'actionRef': witnessed['action_ref'], 'data': witnessed.get('data', {})}
            snapshot['recordedNextCommand'] = expected
            snapshot['commandMatchesWitnessedNextReturn'] = command == expected
            with snapshots.open('ab') as stream:
                stream.write(packed(snapshot))
            proposal = snapshot['proposal'] or {}
            selected = (proposal.get('strategy_receipt') or {}).get('selected')
            sys.__stdout__.write(packed({'requestedOrdinal': self.matched + 1, 'command': command,
                                        'selected': selected, 'matches': command == expected}).decode())
            sys.__stdout__.flush()
            if expected is None:
                self.stop = {'kind': 'recorded_trace_exhausted', 'proposedCommand': command, 'returnedOutcome': False}
                raise DiagnosticStopped()
            if command != expected:
                self.stop = {'kind': 'command_diverged', 'proposedCommand': command, 'recordedCommand': expected, 'returnedOutcome': False}
                raise DiagnosticStopped()
            public = bridge.PublicObservation.from_browser(packet(packets[self.matched + 1]['packet']))
            self.accept(public)
            self.matched += 1
            clock.begin()
            return public

    replay = PublicReplay()
    host_path = str(BOUNDARY.resolve())
    hashes[host_path] = sha(BOUNDARY.read_bytes())
    plan = {'scope': 'unchanged original V6; public transport-boundary reasoning observation only',
            'head': COMMIT, 'source': hashes, 'source_bundle_sha256': bridge._hash(hashes),
            'model_loaded': False, 'neural_dependencies_included': False,
            'browserClock': 'active compute; saved public packets report zero execution time'}
    module, original_main, boundaries = bridge.install_host_boundaries(SOURCE, hashes, 'public-replay', replay, plan)
    main_code = original_main.__code__
    sys.argv = ['common_frontier_runtime', '--game', 'browser-public', '--output', str(Path(config['work']) / 'run'),
                '--target-levels', '3', '--level-action-caps', '160,160,160', '--max-actions', '480',
                '--information-goal', 'accessible_view_frontier']
    clock.begin()
    try:
        with contextlib.redirect_stdout(sys.stderr):
            try:
                original_main()
            except DiagnosticStopped:
                pass
    finally:
        clock.end()
    bridge.verify_source_manifest(SOURCE, manifest)
    result = {'matchedActions': replay.matched,
              'stop': replay.stop or {'kind': 'original_main_returned', 'returnedOutcome': False},
              'sourceVerification': {'verifiedOriginalFiles': len(manifest['files']),
                                     'beforeOriginalMain': True, 'afterOriginalMain': True,
                                     'manifestSha256': sha(MANIFEST.read_bytes())},
              'boundaries': boundaries, 'hostActionsExecuted': 0,
              'traceObserverInstalled': False, 'profileObserverInstalled': False}
    (Path(config['work']) / 'result.json').write_bytes(packed(result))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--child', type=Path)
    parser.add_argument('--trace', type=Path)
    parser.add_argument('--output-directory', type=Path)
    parser.add_argument('--work-root', type=Path)
    parser.add_argument('--timeout', type=float, default=120)
    args = parser.parse_args()
    if args.child:
        child(args.child)
        return 0
    if not args.trace or not args.output_directory or not args.work_root or not 1 <= args.timeout <= 300:
        parser.error('trace, output-directory, work-root and wall bound 1..300 seconds are required')
    raw = args.trace.read_bytes()
    trace = json.loads(gzip.decompress(raw))
    if trace.get('schema') != 'logos-engine.native-public-game-trace.v1' or not 1 < len(trace['packets']) <= 65:
        raise ValueError('Expected a bounded witnessed public prefix')
    out, work = args.output_directory.resolve(), args.work_root.resolve()
    out.mkdir(parents=True, exist_ok=False)
    work.mkdir(parents=True, exist_ok=False)
    config = work / 'config.json'
    config.write_bytes(packed({'trace': str(args.trace.resolve()), 'work': str(work)}))
    environment = dict(os.environ, PYTHONHASHSEED='0', PYTHONDONTWRITEBYTECODE='1', PYTHONNOUSERSITE='1')
    environment.pop('PYTHONPATH', None)
    started = time.monotonic()
    timed_out = False
    with (work / 'output.log').open('xb') as stream:
        try:
            completed = subprocess.run([sys.executable, '-u', str(Path(__file__).resolve()), '--child', str(config)],
                                       cwd=ROOT, env=environment, stdout=stream, stderr=subprocess.STDOUT, timeout=args.timeout)
            exit_code = completed.returncode
        except subprocess.TimeoutExpired:
            timed_out = True
            exit_code = None
    retained = {}
    for name in ('decisions.jsonl', 'result.json', 'output.log'):
        path = work / name
        if not path.exists():
            continue
        data = path.read_bytes()
        compressed = gzip.compress(data, mtime=0)
        target = out / (name + '.gz')
        target.write_bytes(compressed)
        retained[name] = {'path': target.relative_to(ROOT).as_posix(), 'sha256': sha(compressed),
                          'bytes': len(compressed), 'uncompressedSha256': sha(data), 'uncompressedBytes': len(data)}
    result = json.loads((work / 'result.json').read_bytes()) if (work / 'result.json').exists() else None
    summary = {'schema': 'logos-engine.v53.original-caller-public-decision-replay.v1',
               'qualification': __doc__, 'generatorSha256': sha(Path(__file__).read_bytes()),
               'input': {'path': str(args.trace), 'sha256': sha(raw), 'publicPackets': len(trace['packets']),
                         'nativeSourceDigest': trace['sourceDigest']},
               'timeoutSeconds': args.timeout, 'wallSeconds': time.monotonic() - started,
               'timedOut': timed_out, 'exitCode': exit_code, 'result': result, 'evidence': retained,
               'nativeStateInjected': False, 'hostActionsExecuted': 0, 'liveSuccessClaim': False}
    (out / 'execution.json').write_bytes(packed(summary))
    print(json.dumps(summary, indent=2), flush=True)
    return 0 if result is not None and exit_code == 0 else 1


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception:
        traceback.print_exc()
        raise
