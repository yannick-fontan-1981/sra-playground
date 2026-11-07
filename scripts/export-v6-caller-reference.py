#!/usr/bin/env python3
"""Observe the unchanged V6 main at common-caller acquisition boundaries.

Development oracle only. The solver subprocess has no game implementation;
only public pixels/protocol packets cross its pipe. A Python trace observer
copies existing caller locals and SQLite rows, without rewriting its code or
changing its decisions. The external diagnostic stop occurs after a sealed
prefix and its three original WHY/ACT analysis operations.
"""
from __future__ import annotations

import argparse
from collections import deque
import contextlib
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import selectors
import subprocess
import sys
import tempfile
import time
import traceback
import zipfile

SITE = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = SITE / 'reference/v6' / COMMIT / 'source'
HOST_BOUNDARY = Path(__file__).with_name('v6-caller-host-boundary.py')
SOURCE_MANIFEST = SITE / 'reference/v6' / COMMIT / 'manifest.json'
EPISODE = 'common-observation-frontier'


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None: raise ImportError(path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def plain(value):
    if hasattr(value, '__dataclass_fields__'):
        return {key: plain(getattr(value, key)) for key in value.__dataclass_fields__}
    if isinstance(value, dict):
        if all(isinstance(key, (str, int)) for key in value):
            return {str(key): plain(item) for key, item in value.items()}
        return {'__mapping__': [[plain(key), plain(item)] for key, item in value.items()]}
    if isinstance(value, (set, frozenset)):
        try: return [plain(item) for item in sorted(value)]
        except TypeError: return sorted([plain(item) for item in value], key=packed)
    if isinstance(value, (list, tuple, bytes)): return [plain(item) for item in value]
    if isinstance(value, deque): return {'__deque__': [plain(item) for item in value], 'maxlen': value.maxlen}
    if value is None or isinstance(value, (str, int, float, bool)): return value
    if hasattr(value, 'tolist'): return plain(value.tolist())
    if hasattr(value, 'item'): return plain(value.item())
    raise TypeError('Unprojected oracle value ' + type(value).__name__)


def packed(value): return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
def digest(value): return hashlib.sha256(packed(value).encode()).hexdigest()
def emit(value):
    sys.__stdout__.write(packed(value) + '\n'); sys.__stdout__.flush()


def public_packet(observation):
    return {'frame': plain(observation.frame_rows), 'frames': plain(observation.frame_packet),
            'availableActionIds': [int(action.removeprefix('ACTION')) for action in observation.available_action_refs],
            'state': observation.state, 'level': observation.level, 'levelsCompleted': observation.levels_completed,
            'stepIndex': observation.step_index}


def view_state(obj):
    if obj is None: return None
    def entries(mapping, convert=lambda item: item):
        return [[plain(key), plain(convert(value))] for key, value in sorted(mapping.items(), key=lambda row: packed(row[0]))]
    return plain({'epoch': obj.epoch, 'origin': obj.origin, 'segment': obj.segment, 'coverage': sorted(obj.coverage),
                  'offsets': {key: sorted(value) for key, value in sorted(obj.offsets.items())},
                  'offset_source': entries(obj.offset_source), 'footprints': entries(obj.footprints, lambda value: sorted(value, key=packed)),
                  'pass_refs': entries(obj.pass_refs), 'block': obj.block, 'followup': obj.followup, 'tested': sorted(obj.tested),
                  'access_trials': entries(obj.access_trials), 'known_signatures': sorted(obj.known_signatures),
                  'reveals': obj.reveals, 'engaged': obj.engaged, 'visible_hypotheses': obj.visible_hypotheses})


def goal_state(adapter):
    memory = adapter.memory
    pre = dict(vars(memory.pre_score))
    pre['_changes'] = [[list(pair), {key: sorted([sorted(region) for region in regions]) for key, regions in groups.items()}]
                       for pair, groups in memory.pre_score._changes.items()]
    return plain({**memory.retained_state(), 'episode': memory.episode, 'last': memory.last, 'pre_score': pre})


def memory_state(memory):
    facts = [{'episode': episode, 'key': key, 'value': json.loads(value), 'evidence': evidence, 'revision': revision}
             for episode, key, value, evidence, revision in memory.db.execute('SELECT episode,k,v,evidence,revision FROM facts ORDER BY episode,k')]
    traces = [{'id': identity, 'episode': episode, 'kind': kind, 'body': json.loads(body), 'created': created}
              for identity, episode, kind, body, created in memory.db.execute('SELECT id,episode,kind,body,created FROM traces ORDER BY id')]
    return {'facts': facts, 'traces': traces, 'catalog': {'meta': dict(memory.db.execute('SELECT k,v FROM meta')),
            'nodes': memory.db.execute('SELECT COUNT(*) FROM nodes').fetchone()[0],
            'edges': memory.db.execute('SELECT COUNT(*) FROM edges').fetchone()[0],
            'operations': memory.db.execute('SELECT COUNT(*) FROM operations').fetchone()[0]}}


class DiagnosticPrefixComplete(BaseException): pass


class Recorder:
    """Trace-only acquisition observer; all captures precede diagnostic stop."""
    def __init__(self, module, source, destination, stop_prefixes):
        self.module = module; self.source = source; self.path = Path(module.__file__).resolve()
        self.destination = destination; self.stop_prefixes = stop_prefixes; self.prefixes = 0
        self.events = []; self.objects = {}; self.snapshots = []; self.pending = None; self.busy = False
        self.last_returned_attention = None
        lines = self.path.read_text().splitlines()
        def line_containing(text, count=1):
            matches = [i + 1 for i, line in enumerate(lines) if text in line]
            if len(matches) != count: raise ValueError((text, matches))
            return matches[0]
        self.after = {
            line_containing("frontier.observe(observation,graph_inputs(observation));usage['ObservedFrontier.observe']+=1;persist_deltas()", 2): 'initialized',
            line_containing("durable(out/f'decision-{revision}.json',receipt);decision_revision=revision"): 'released',
            line_containing("memory.put(episode,'empirical_registry',registry,evidence=observation['observation_ref'],revision=revision);registry_revision=revision"): 'transition_acquired',
            line_containing("memory.put(episode,f'boundary_witness:{revision}',witness,evidence=observation['observation_ref'],revision=revision)"): 'boundary_acquired',
            line_containing("analysis=post_analysis(memory,bridge,episode,observation,revision,objective,set_record,boundary=boundary)"): 'prefix_analyzed',
        }
        self.before = {line_containing("if boundary:", 2): 'before_assessment'}
        self.hooks = {'after': self.after, 'before': self.before}
        self.profile_names = {
            ('attention_memory.py', 'AttentionMemory.observe'),
            ('attention_memory.py', 'AttentionMemory.take_parent_return'),
            ('common_view_frontier.py', 'ViewFrontier.record'),
            ('goal_access_adapter.py', 'GoalAccessAdapter.record'),
            ('common_point_contrasts.py', 'PointExperimentMemory.observe'),
            ('coupled_displays.py', 'CoupledDisplays.observe'),
            ('common_control_dependencies.py', 'ControlDependencies.evaluate'),
            ('common_control_dependencies.py', 'ControlDependencies.change'),
            ('common_mechanisms.py', 'assess_transition'),
            ('common_property_rewrites.py', 'assess_property_transition'),
            ('common_frontier.py', 'ObservedFrontier.record_transition'),
            ('common_frontier.py', 'ObservedFrontier.drain_deltas'),
        }
        self.profile_codes = {}
        for filename, qualname in self.profile_names | {('memory.py', 'Memory.put'), ('memory.py', 'Memory.trace')}:
            owner = sys.modules[filename.removesuffix('.py')]
            value = owner
            for part in qualname.split('.'): value = getattr(value, part)
            self.profile_codes[value.__code__] = (filename, qualname)

    def intern(self, value):
        value = plain(value); key = digest(value); self.objects.setdefault(key, value); return {'$object': key}

    def profile(self, frame, event, result):
        if self.busy or event != 'return': return
        target = self.profile_codes.get(frame.f_code)
        if target is None: return
        filename, name = target; local = frame.f_locals
        self.busy = True
        try:
            if filename == 'memory.py' and name == 'Memory.put':
                record = {'kind': 'memory_put', 'episode': local['episode'], 'key': local['key'],
                          'value': self.intern(local['value']), 'evidence': local['evidence'], 'revision': local['revision']}
            elif filename == 'memory.py' and name == 'Memory.trace':
                record = {'kind': 'memory_trace', 'episode': local['episode'], 'trace_kind': local['kind'], 'value': self.intern(local['value'])}
            elif (filename, name) in self.profile_names:
                if name == 'AttentionMemory.take_parent_return': self.last_returned_attention = plain(result)
                record = {'kind': 'component_return', 'module': filename, 'function': name, 'value': self.intern(result)}
                for key in ('before', 'after', 'observation', 'obs'):
                    if isinstance(local.get(key), dict) and 'observation_ref' in local[key]: record[key] = local[key]['observation_ref']
                if isinstance(local.get('command'), dict): record['command'] = plain(local['command'])
            else: return
            record['sequence'] = len(self.events) + 1; self.events.append(record)
        finally: self.busy = False

    def component_state(self, local):
        router = local['strategy_router']; point = local['point_experiments']; control = local['control_dependencies']
        return {
            'goal': goal_state(local['goal_access']), 'frontier': local['frontier'].snapshot(), 'view': view_state(local.get('view')),
            'attention': {'item': router.attention.item, 'composition': router.attention.composition},
            'points': {'records': point.records, 'moving_signatures': point.moving_signatures,
                       'compared_pairs': sorted(point.compared_pairs), 'has_positive': point.has_positive},
            'displays': vars(router.displays), 'controls': {'pending': control.pending, 'attempted': sorted(control.attempted)},
            'counters': {'goalEventCount': local['goal_event_count'], 'deltaSequence': local['delta_sequence'],
                         'goalReason': getattr(router, 'goal_reason', None), 'returnedAttention': self.last_returned_attention,
                         'targetMethod': getattr(router, 'target_method', None)},
        }

    def capture(self, stage, local):
        self.busy = True
        try:
            current = local['observation']; before = current
            if stage in ('transition_acquired', 'boundary_acquired'):
                index = local['index']; packet = local['packet'][index]
                before_ref = f"run:{current['revision'] - 1}"
            else: before_ref = current['observation_ref']
            values = {'stage': stage, 'eventsThrough': len(self.events), 'revision': local['revision'],
                      'decisionRevision': local.get('decision_revision'), 'transitionIndex': local.get('index'),
                      'actionsDispatched': local['actions'], 'observation': self.intern(current),
                      'state': self.intern(self.component_state(local)), 'memory': self.intern(memory_state(local['memory']))}
            for name in ('proposal', 'frozen', 'receipt', 'set_record', 'analysis', 'assessment', 'properties', 'record', 'witness', 'after', 'command',
                         'attention_result', 'sight', 'goal_events', 'comparison', 'control_result', 'curiosity_result', 'collections', 'departures',
                         'prior_meter', 'result', 'support_event', 'target_receipt'):
                if name in local: values[name] = self.intern(local[name])
            if stage == 'before_assessment':
                values['beforePublic'] = self.intern(public_packet(local['packet'][local['index']]))
                values['afterPublic'] = self.intern(public_packet(local['public']))
            values['unportedAcquisition'] = self.intern({'morph_meter': vars(local['strategy_router'].morph.meter),
                                                        'morph_collection': vars(local['strategy_router'].morph.collection)})
            self.snapshots.append(values)
            self.flush()
        finally: self.busy = False

    def flush(self):
        self.destination.write_text(packed({'schema': 'v6-original-common-caller-oracle.v1', 'commit': COMMIT,
          'scope': 'run', 'sourceHashes': {str(self.path.relative_to(self.source)): hashlib.sha256(self.path.read_bytes()).hexdigest()},
          'method': {'sourceModified': False, 'astTransformed': False, 'decisionInterception': False,
                     'capture': 'Python trace/profile observers copy existing caller locals and returned values',
                     'eventsStart': 'after the initial frontier observation is persisted; its complete state is captured separately',
                     'snapshotLocals': 'raw caller locals at the named phase; earlier-loop locals can remain present and are not fresh events',
                     'stop': 'external diagnostic exception only after completed original post_analysis',
                     'normalization': [], 'objects': 'content-addressed JSON copies; resolve $object to the objects map',
                     'catalog': 'facts/traces included; immutable catalogue identified by hashes and row counts'},
          'hooks': self.hooks, 'events': self.events, 'snapshots': self.snapshots, 'objects': self.objects}) + '\n')

    def trace(self, frame, event, _argument):
        if frame.f_code is not self.module.main.__code__: return None
        if event != 'line': return self.trace
        if self.pending:
            stage = self.pending; self.pending = None; self.capture(stage, frame.f_locals)
            if stage == 'initialized': sys.setprofile(self.profile)
            if stage == 'prefix_analyzed':
                self.prefixes += 1
                if self.prefixes >= self.stop_prefixes:
                    sys.settrace(None); sys.setprofile(None)
                    raise DiagnosticPrefixComplete(self.prefixes)
        if frame.f_lineno in self.before: self.capture(self.before[frame.f_lineno], frame.f_locals)
        if frame.f_lineno in self.after: self.pending = self.after[frame.f_lineno]
        return self.trace


def child(config_path):
    config = json.loads(Path(config_path).read_text()); source = Path(config['sourceRoot'])
    bridge = load_module('v6_oracle_host_boundary', config['hostBoundary'])
    initial = bridge.PublicObservation.from_browser(config['observation']); clock = bridge.ActiveClock(); bridge._install_clock(clock)
    class PublicTransport(bridge.PublicSession):
        def step(self, action_ref, *, data=None):
            clock.end(); emit({'kind': 'action', 'command': {'actionRef': action_ref, 'data': dict(data or {})}})
            line = sys.__stdin__.readline()
            if not line: raise RuntimeError('Public host closed unexpectedly')
            message = json.loads(line); outcome = bridge.PublicObservation.from_browser(message['observation'])
            clock.elapsed += clock.execution_seconds(message['executionMs']); self.accept(outcome); clock.begin(); return outcome
    transport = PublicTransport(initial); hashes, _ = bridge.verify_source_manifest(source, config['sourceManifest'])
    host_path = str(Path(config['hostBoundary']).resolve()); hashes[host_path] = hashlib.sha256(Path(host_path).read_bytes()).hexdigest()
    plan = {'scope': 'unchanged original V6 common caller; trace-only development observation', 'head': COMMIT,
            'source': hashes, 'source_bundle_sha256': bridge._hash(hashes), 'model_loaded': False,
            'neural_dependencies_included': False, 'versions': {'python': sys.version},
            'browserBudgetOrigin': 'explicit diagnostic limits; same allowance before external prefix stop',
            'browserClock': 'active compute plus reported game execution; public-host waiting excluded'}
    run_dir = Path(config['runRoot']) / config['sessionId'] / 'run'; recorder = None
    clock.begin()
    try:
        with contextlib.redirect_stdout(sys.stderr):
            module, original_main, _ = bridge.install_host_boundaries(source, hashes, config['sessionId'], transport, plan)
            module.resolve_transport = lambda _: (lambda _identifier: transport, {host_path: hashes[host_path]})
            budgets = config['budgets']; sys.argv = ['common_frontier_runtime', '--game', 'browser-public', '--output', str(run_dir),
                '--target-levels', str(budgets['targetLevels']), '--level-action-caps', ','.join(map(str, budgets['levelActionCaps'])),
                '--max-actions', str(sum(budgets['levelActionCaps'])), '--information-goal', 'accessible_view_frontier']
            recorder = Recorder(module, source, Path(config['oracle']), config['stopAfterPrefixes'])
            sys.settrace(recorder.trace)
            try: original_main()
            except DiagnosticPrefixComplete: pass
            finally:
                sys.settrace(None); sys.setprofile(None)
                recorder.flush()
    finally: clock.end()
    bridge.verify_source_manifest(source, config['sourceManifest'])
    if recorder is None: raise RuntimeError('Oracle recorder was not initialized')
    recorder.flush()
    emit({'kind': 'stopped', 'runDir': str(run_dir), 'oracle': config['oracle'], 'prefixes': recorder.prefixes,
          'snapshots': len(recorder.snapshots), 'events': len(recorder.events), 'reason': 'diagnostic_sealed_prefix_boundary'})


class PublicViewportProtocol:
    """Public synthetic contract test; no claim of game completion or ARC score."""
    def __init__(self): self.step_index = 0
    def observe(self):
        rows = [[0] * 64 for _ in range(64)]; dx = self.step_index * 3
        shapes = [(12, 12, 2, [(0,0),(1,0),(2,0),(0,1)]), (42, 12, 3, [(0,0),(1,0),(0,1),(0,2),(1,2)]),
                  (12, 42, 4, [(0,0),(1,0),(2,0),(1,1),(1,2)]), (42, 42, 5, [(0,0),(0,1),(0,2),(1,2),(2,2),(2,1)]),
                  (27, 26, 6, [(0,0),(1,0),(2,0),(2,1),(3,1),(3,2),(3,3)]),
                  (-5, 28, 7, [(0,0),(0,1),(0,2),(1,0),(2,0),(2,1),(2,2)])]
        for x, y, color, mask in shapes:
            for u, v in mask:
                xx, yy = x + u + dx, y + v
                if 0 <= xx < 64 and 0 <= yy < 64: rows[yy][xx] = color
        return {'frame': rows, 'frames': [rows], 'availableActionIds': [5], 'state': 'NOT_FINISHED',
                'level': 1, 'levelsCompleted': 0, 'stepIndex': self.step_index}
    def reset(self): self.step_index = 0; return self.observe()
    def step(self, command):
        if command != {'actionRef': 'ACTION5', 'data': {}}: raise ValueError('Synthetic public contract exposes only ACTION5')
        self.step_index += 1; return self.observe()


def enrich_oracle(output, config, public_trace, provenance):
    path = output / 'oracle.json'; oracle = json.loads(path.read_text())
    run = output / config['sessionId'] / 'run'
    oracle['publicProtocol'] = {'provenance': provenance, 'events': public_trace}
    oracle['execution'] = [json.loads(line) for line in (run / 'execution.jsonl').read_text().splitlines() if line]
    oracle['sourceVerification'] = {'normalizedManifestSha256': digest(config['sourceManifest']),
        'verifiedOriginalFiles': len(config['sourceManifest']['files']), 'beforeOriginalMain': True, 'afterOriginalMain': True,
        'verification': 'verify_source_manifest rejects byte/hash changes to every pinned manifest entry'}
    oracle['budgets'] = config['budgets']
    path.write_text(packed(oracle) + '\n')


def host_case(options):
    output = options.output.resolve(); output.mkdir(parents=True, exist_ok=False)
    with tempfile.TemporaryDirectory(prefix='v6-caller-oracle-host-') as directory:
        if options.case == 'viewport':
            env = PublicViewportProtocol(); initial = env.reset(); step = env.step
            provenance = {'kind': 'synthetic_public_protocol', 'available': [5], 'completionClaim': False,
                          'purpose': 'Original caller exploration, bulk registration, coverage and frontier acquisition'}
        else:
            host_root = Path(directory)
            for bundle in ('custom-games.zip', 'official-games.zip'):
                with zipfile.ZipFile(SITE / 'public/python' / bundle) as archive: archive.extractall(host_root)
            sys.path.insert(0, str(host_root))
            transport = load_module('oracle_custom_host', SOURCE / 'agents/yf_arc3_v6/laya_proto/custom_bridge.py')
            game = next(item for item in json.loads((SITE / 'public/python/custom-manifest.json').read_text())['games'] if item['code'] == options.case)
            env = transport.CustomSession(game['game_id']); initial = public_packet(env.reset())
            step = lambda command: public_packet(env.step(command['actionRef'], data=command['data']))
            provenance = {'kind': 'real_original_custom_game', 'game': options.case, 'gameId': game['game_id'],
                          'engineArchiveSha256': hashlib.sha256((SITE / 'public/python/custom-games.zip').read_bytes()).hexdigest()}
        config = {'sourceRoot': str(SOURCE), 'hostBoundary': str(HOST_BOUNDARY),
                  'sourceManifest': json.loads(SOURCE_MANIFEST.read_text()),
                  'runRoot': str(output), 'sessionId': 'caller-oracle', 'observation': initial,
                  'budgets': {'targetLevels': 3, 'levelActionCaps': [160, 160, 160]},
                  'stopAfterPrefixes': options.prefixes, 'oracle': str(output / 'oracle.json')}
        config_path = output / 'public-config.json'; config_path.write_text(packed(config))
        trace = [{'event': 'reset', 'observation': initial}]; started = time.monotonic()
        env_vars = dict(os.environ, PYTHONHASHSEED='0', PYTHONDONTWRITEBYTECODE='1', PYTHONNOUSERSITE='1'); env_vars.pop('PYTHONPATH', None)
        with (output / 'solver.stderr.log').open('w') as errors:
            process = subprocess.Popen([sys.executable, '-u', str(Path(__file__).resolve()), '--child', str(config_path)],
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=errors, text=True, bufsize=1, cwd=SITE, env=env_vars)
            assert process.stdin is not None and process.stdout is not None
            selector = selectors.DefaultSelector(); selector.register(process.stdout, selectors.EVENT_READ); result = None
            try:
                while True:
                    allowance = options.timeout - (time.monotonic() - started)
                    if allowance <= 0 or not selector.select(allowance): raise TimeoutError('Oracle diagnostic wall bound')
                    line = process.stdout.readline()
                    if not line: raise RuntimeError('Oracle child closed; see solver.stderr.log')
                    message = json.loads(line)
                    if message['kind'] == 'error': raise RuntimeError(message['error'])
                    if message['kind'] == 'stopped': result = message; break
                    if message['kind'] != 'action': raise RuntimeError(message)
                    instant = time.perf_counter(); observation = step(message['command']); elapsed = (time.perf_counter() - instant) * 1000
                    trace.append({'event': 'step', 'ordinal': len(trace), 'command': message['command'], 'observation': observation})
                    process.stdin.write(packed({'observation': observation, 'executionMs': elapsed}) + '\n'); process.stdin.flush()
                process.stdin.close()
                if process.wait(timeout=10) != 0: raise RuntimeError('Oracle child failed after terminal receipt')
            finally:
                selector.close()
                if process.poll() is None: process.kill(); process.wait(timeout=10)
                process.stdout.close()
                if not process.stdin.closed: process.stdin.close()
                (output / 'public-trace.json').write_text(packed({'provenance': provenance, 'events': trace}) + '\n')
        summary = {'provenance': provenance, 'sourceCommit': COMMIT, 'publicActions': len(trace) - 1,
                   'levelsCompleted': trace[-1]['observation']['levelsCompleted'], 'wallSeconds': time.monotonic() - started,
                   'budgets': config['budgets'], 'stopAfterPrefixes': options.prefixes, 'result': result}
        enrich_oracle(output, config, trace, provenance)
        (output / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n'); print(json.dumps(summary))


def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--child', type=Path)
    parser.add_argument('--case', default='HANO'); parser.add_argument('--prefixes', type=int, default=1)
    parser.add_argument('--output', type=Path); parser.add_argument('--timeout', type=float, default=360)
    options = parser.parse_args()
    if options.child:
        try: child(options.child)
        except BaseException as error:
            traceback.print_exc(file=sys.stderr); emit({'kind': 'error', 'error': type(error).__name__ + ': ' + str(error)}); return 1
    else:
        if options.output is None: parser.error('--output required')
        host_case(options)
    return 0


if __name__ == '__main__': sys.exit(main())
