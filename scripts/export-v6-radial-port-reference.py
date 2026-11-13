#!/usr/bin/env python3
"""Unchanged original radial component contracts and one opaque-host trajectory.

The host is loaded through its public bridge, never inspected. All live inputs
are proposed by the original radial component. This is component evidence,
not a claim that the original full common caller chose those inputs.
Controlled variants test refusals and invariance; they are not game wins.
"""
from __future__ import annotations
import copy
import gzip
import hashlib
import inspect
import json
from pathlib import Path
import shutil
import sys
import tempfile
from types import SimpleNamespace
import zipfile

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
LAYA = SOURCE / 'agents/yf_arc3_v6/laya_proto'
sys.path[:0] = [str(SOURCE), str(LAYA)]

from radial_ports_observation import measure as radial_measure, at_geometry, assembly_model, selected_occurrence, rotate
from radial_ports_access import RadialPortsAccess
from typed_pose_access import TypedPoseAccess
from common_radial_ports import RadialPortConstraint
from common_port_assembly import assembly
from neutral_observer import measure
from observed_input_domain import ObservedInputDomain
from terminal_composition import identity

CONFIG = json.loads((SOURCE / 'agents/yf_arc3_v6/morphology_policy/strategy.drm').read_text())['declarations'][0]['configuration']
POLICY = CONFIG['window_constraints']['radial_port_composition']
OWN_KINDS = {'radial_method_recall', 'radial_port_effect'}
OWN_FIELDS = ('port_events', 'port_prior', 'port_point_rule', 'port_rejected')
SCENES, CASES, PLANS, STATES = {}, [], {}, {}
OWN_NAMES = ('radial_ports_observation.py', 'radial_ports_access.py', 'common_radial_ports.py', 'common_port_assembly.py')
OWN_FILES = {str(LAYA / name) for name in OWN_NAMES}
COVERED = {}


def plain(value):
    if isinstance(value, dict): return {str(key): plain(child) for key, child in value.items()}
    if isinstance(value, (tuple, list)): return [plain(child) for child in value]
    if isinstance(value, (set, frozenset)): return [plain(child) for child in sorted(value)]
    return value


def traced(call, parent=None):
    returns = []
    def trace(frame, event, arg):
        own = frame.f_code.co_filename in OWN_FILES
        selected_parent = parent is not None and frame.f_code is parent.__code__
        if not own and not selected_parent: return None
        if event == 'line' and own:
            name = frame.f_code.co_filename.rsplit('/', 1)[-1]
            COVERED.setdefault(name + ':' + frame.f_code.co_name, set()).add(frame.f_lineno)
        if parent is not None and event == 'return' and frame.f_code is parent.__code__:
            returns.append(copy.deepcopy(arg))
        return trace
    sys.settrace(trace)
    try: return call(), returns
    finally: sys.settrace(None)


def own_state(memory): return plain({name: getattr(memory, name) for name in OWN_FIELDS})
def snapshot(memory):
    return {'projection': own_state(memory), 'parentDigest': TypedPoseAccess.retained_digest(memory),
            'digest': RadialPortsAccess.retained_digest(memory)}


def save_state(name, memory):
    STATES[name] = snapshot(memory)
    return name


def reconstructed(memory):
    out = RadialPortsAccess()
    for event in memory.port_events: out.apply_event(copy.deepcopy(event))
    assert own_state(out) == own_state(memory)
    return out


def scene(name, rows=None, *, packet=None, epoch=1, score=0, available=None, state='NOT_FINISHED'):
    if packet is None:
        packet = {'frame_rows': copy.deepcopy(rows), 'frame_packet': [copy.deepcopy(rows)], 'level': epoch,
                  'levels_completed': score, 'state': state, 'step_index': len(SCENES),
                  'available_action_refs': ['ACTION6'] if available is None else available,
                  'frame_hash': hashlib.sha256(json.dumps(rows, separators=(',', ':')).encode()).hexdigest()[:16]}
    observation, _ = measure(SimpleNamespace(**packet), len(SCENES) + 1, 'radial-port-reference')
    SCENES[name] = {'rows': copy.deepcopy(packet['frame_rows']), 'public': plain(packet), 'observation': plain(observation)}
    return name


def case(name, operation, arguments, result):
    CASES.append({'id': name, 'operation': operation, 'arguments': plain(arguments), 'expected': plain(result)})


def measure_case(name):
    rows = SCENES[name]['rows']
    found, _ = traced(lambda: radial_measure(rows))
    case(name + ':measure', 'measure', {'scene': name}, found)
    if found:
        result, _ = traced(lambda: at_geometry(rows, found))
        case(name + ':project', 'at_geometry', {'scene': name, 'geometry': found}, result)
        result, _ = traced(lambda: selected_occurrence(rows, found))
        case(name + ':selection', 'selected', {'scene': name, 'geometry': found}, result)
        model, current = assembly_model(found)
        case(name + ':assembly_model', 'assembly_model', {'geometry': found}, [model, current])
        for sign in (0, 1, 3):
            model, current = assembly_model(found)
            result, _ = traced(lambda: assembly(model, current, None, sign))
            case(name + ':assembly:' + str(sign), 'assembly', {'geometry': found, 'sign': sign},
                 {'target': result, 'nodes': model.get('search_nodes')})
    return found


def propose_case(name, memory, view, *, common=False, config=None, remaining=16):
    s = SCENES[view]
    before = own_state(memory)
    args = {'scene': view, 'ownEvents': copy.deepcopy(memory.port_events), 'remaining': remaining,
            'policy': copy.deepcopy(config if config is not None else POLICY)}
    domain = ObservedInputDomain(4096)
    inputs = domain.candidates(s['observation'])
    if common:
        family = RadialPortConstraint(); family.memory = memory
        result, parents = traced(lambda: family.radial_propose(s['observation'], s['rows'], inputs, remaining, args['policy']), TypedPoseAccess.propose)
    else:
        result, parents = traced(lambda: memory.propose([], s['observation'], s['rows'], inputs, remaining,
                                                       {'radial_port_composition': args['policy']}), TypedPoseAccess.propose)
    assert own_state(memory) == before, 'Proposing must not mutate acquired radial knowledge'
    assert len(parents) <= 1
    args['parentResult'] = parents[0] if parents else None
    case(name, 'common_propose' if common else 'propose', args, result)
    if result and result.get('radial_port_plan'):
        PLANS[name] = copy.deepcopy(result)
        if common:
            bound = copy.deepcopy(result)
            family.bind(bound, domain)
            case(name + ':bind', 'bind', {'scene': view, 'proposal': name, 'observed': True}, bound)
            try:
                family.bind(copy.deepcopy(result), ObservedInputDomain(4096))
            except AssertionError:
                case(name + ':bind_unobserved', 'bind', {'scene': view, 'proposal': name, 'observed': False}, {'rejected': True})
            else: raise AssertionError('Unobserved radial binding must refuse')
    return result


def before_case(name, proposal_name, view, index=0, changes=None):
    s = SCENES[view]
    meta = {'epoch': s['observation']['level_epoch'], 'score': s['observation']['levels_completed'],
            'observation_ref': s['observation']['observation_ref'], 'available': s['observation']['available_action_refs']}
    meta.update(changes or {})
    result, _ = traced(lambda: RadialPortsAccess().before(copy.deepcopy(PLANS[proposal_name]), index, s['rows'], **meta))
    case(name, 'before', {'scene': view, 'proposal': proposal_name, 'index': index, 'meta': meta}, result)
    return result


def after_case(name, proposal_name, before, after, index=0, changes=None):
    a, b = SCENES[before], SCENES[after]
    meta = {'epoch': b['observation']['level_epoch'], 'score': b['observation']['levels_completed'], 'state': b['observation']['state']}
    meta.update(changes or {})
    result, _ = traced(lambda: RadialPortsAccess().after(copy.deepcopy(PLANS[proposal_name]), index, a['rows'], b['rows'], **meta))
    case(name, 'after', {'before': before, 'after': after, 'proposal': proposal_name, 'index': index, 'meta': meta}, result)
    return result


def record_case(name, memory, proposal_name, before, after, index=0):
    a, b = SCENES[before], SCENES[after]
    proposal = PLANS[proposal_name]
    command = proposal['actions'][index]
    own_events = copy.deepcopy(memory.port_events)
    args = [a['observation'], command, b['observation'], a['rows'], b['rows'], proposal, index]
    untouched = copy.deepcopy(args)
    result, parents = traced(lambda: memory.record(*args), TypedPoseAccess.record)
    assert len(parents) == 1 and result[:len(parents[0])] == parents[0]
    own = result[len(parents[0]):]
    assert all(e['kind'] in OWN_KINDS for e in own)
    assert args == untouched
    case(name, 'record', {'before': before, 'after': after, 'proposal': proposal_name, 'index': index,
                         'command': command, 'ownEvents': own_events},
         {'events': own, 'state': snapshot(memory), 'sourceParentEvents': parents[0], 'inputsUnchanged': True})
    rebuilt = reconstructed(memory)
    assert own_state(rebuilt) == own_state(memory)
    return result


def public_packet(engine, step_index=0):
    return {'frame_rows': engine['frame'], 'frame_packet': engine['frames'], 'level': engine['level'],
            'levels_completed': engine['levelsCompleted'], 'state': engine['state'], 'step_index': step_index,
            'available_action_refs': [f'ACTION{x}' for x in engine['availableActionIds']],
            'frame_hash': hashlib.sha256(json.dumps(engine['frame'], separators=(',', ':')).encode()).hexdigest()[:16]}


def live_component():
    with tempfile.TemporaryDirectory(prefix='radial-public-host-') as temporary:
        directory = Path(temporary)
        for filename in ('custom-games.zip', 'official-games.zip'):
            with zipfile.ZipFile(ROOT / 'public/python' / filename) as archive: archive.extractall(directory)
        for filename in ('game_bridge.py', 'official_adapter.py', 'custom_level_navigation.py'):
            shutil.copy(ROOT / 'public/python' / filename, directory / filename)
        sys.path.insert(0, temporary)
        import game_bridge
        def send(kind, **kw):
            result = json.loads(game_bridge.dispatch(json.dumps({'type': kind, **kw})))
            if 'error' in result: raise RuntimeError(result['error'])
            return result
        engine = send('load', code='PIPE', level=1)
        packet = public_packet(engine)
        current = scene('public:0', packet=packet)
        memory = RadialPortsAccess(); save_state('initial', memory)
        trace = {'game': 'PIPE', 'targetLevels': 3, 'scope': 'Original isolated radial component, not full common caller selection',
                 'manualPrimingActions': 0, 'sessionCount': 1, 'packets': [{'command': None, 'packet': packet}],
                 'prefixes': [], 'boundaries': [], 'status': 'running'}
        total = 0
        for cycle in range(100):
            s = SCENES[current]
            name = f'public:prefix:{cycle}'
            proposal = propose_case(name, memory, current, common=True, remaining=600)
            print(json.dumps({'phase': 'original_component_proposal', 'cycle': cycle, 'actions': total,
                              'levelsCompleted': engine['levelsCompleted'], 'proposed': proposal is not None}), file=sys.stderr, flush=True)
            if not proposal:
                trace.update(status='stopped', reason='radial_component_abstained'); break
            prefix = {'proposal': name, 'before': current, 'steps': []}; trace['prefixes'].append(prefix)
            for index, command in enumerate(proposal['actions']):
                guard = before_case(f'{name}:before:{index}', name, current, index)
                if not guard['admitted']:
                    trace.update(status='stopped', reason='before_guard_refused'); break
                first = current
                engine = send('action', actionId=int(command['action_ref'][6:]), data=command.get('data'))
                total += 1; packet = public_packet(engine, total)
                current = scene('public:' + str(total), packet=packet)
                outcome = after_case(f'{name}:after:{index}', name, first, current, index)
                record_case(f'{name}:record:{index}', memory, name, first, current, index)
                # Preserve the original passive ancestor observations too; they
                # are never treated as radial acquisition without a radial event.
                a, b = SCENES[first], SCENES[current]
                memory.record_packet(a['observation'], command, b['observation'], a['rows'], b['public']['frame_packet'], [])
                trace['packets'].append({'command': plain(command), 'packet': plain(packet)})
                prefix['steps'].append({'before': first, 'after': current, 'index': index, 'command': plain(command), 'outcome': plain(outcome)})
                if b['observation']['levels_completed'] > a['observation']['levels_completed']:
                    trace['boundaries'].append({'levelsCompleted': b['observation']['levels_completed'], 'actions': total})
                if b['observation']['levels_completed'] >= 3:
                    trace.update(status='passed', reason='target_levels_completed'); break
                if outcome.get('seal_prefix'): break
            if trace['status'] != 'running': break
        trace.update(actions=total, levelsCompleted=engine['levelsCompleted'], state=engine['state'], finalState=snapshot(memory))
        return trace


def transformed_scenes(initial):
    rows = SCENES[initial]['rows']
    color_map = {i: (7 * i + 3) % 16 for i in range(16)}
    scene('controlled:recolored', [[color_map[v] for v in line] for line in rows])
    scene('controlled:reflected', [list(reversed(line)) for line in rows])
    scene('controlled:shifted', [[0] * (len(rows[0]) + 8) for _ in range(5)] + [[0] * 3 + line + [0] * 5 for line in rows] + [[0] * (len(rows[0]) + 8) for _ in range(3)])
    scene('controlled:blank', [[0] * 64 for _ in range(64)])
    scene('controlled:missing_action', rows, available=[])
    s = radial_measure(rows)
    assert s
    duplicate = [line + [0] * 4 + line for line in rows]
    scene('controlled:ambiguous', duplicate)
    changed = copy.deepcopy(rows)
    x, y = s['cells'][0]['point']; changed[y][x] = s['substrate']
    scene('controlled:missing_center', changed)
    changed = copy.deepcopy(rows)
    point = s['cells'][0]['point']; pitch = s['pitch']
    for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)):
        for k in range(max(1, pitch // 4), pitch // 2): changed[point[1] + dy*k][point[0] + dx*k] = s['border']
    scene('controlled:four_ports', changed)
    for name in list(SCENES):
        if name.startswith('controlled:'):
            measure_case(name)
            propose_case(name + ':proposal', RadialPortsAccess(), name, common=True)


def refusal_and_guard_cases(trace):
    first_name = trace['prefixes'][0]['proposal']
    first_view = trace['prefixes'][0]['before']
    for field, value in [('epoch', 99), ('score', 99), ('observation_ref', 'stale'), ('available', [])]:
        before_case('guard:first:' + field, first_name, first_view, changes={field: value})
    p = copy.deepcopy(PLANS[first_name]); p['actions'][0]['data']['x'] += 1
    PLANS['controlled:changed_command'] = p
    before_case('guard:changed_command', 'controlled:changed_command', first_view)
    before_case('guard:changed_image', first_name, 'controlled:recolored')
    cfg = {**POLICY, 'allow_initial_experiment': False}
    propose_case('proposal:initial_experiment_disabled', RadialPortsAccess(), first_view, config=cfg)
    propose_case('proposal:zero_remaining', RadialPortsAccess(), first_view, common=True, remaining=0)
    for ports in ([0], [0, 2], [0, 1], [0, 1, 3]):
        for turn in (-1, 0, 1, 2, 3, 4): case(f'rotate:{ports}:{turn}', 'rotate', {'ports': ports, 'turn': turn}, rotate(ports, turn))
    before, after = trace['prefixes'][0]['steps'][0]['before'], trace['prefixes'][0]['steps'][0]['after']
    record_case('record:unchanged_unknown_effect', RadialPortsAccess(), first_name, before, before)
    record_case('record:wrong_center', RadialPortsAccess(), first_name, before, 'controlled:missing_center')
    after_case('after:official_epoch', first_name, before, after, changes={'epoch': 2})
    after_case('after:official_score', first_name, before, after, changes={'score': 1})
    # Once a real witnessed rule exists, altered observations exercise the
    # source's conditional prediction, distant-change and refutation branches.
    known = next((p for p in trace['prefixes'] if PLANS[p['proposal']]['radial_port_plan']['point_method_revalidated']), None)
    if known:
        name = known['proposal']; first = known['steps'][0]['before']; last = known['steps'][0]['after']
        after_case('after:known_unchanged', name, first, first)
        s = PLANS[name]['radial_port_plan']['scene']; box = s['cells'][PLANS[name]['steps'][0]['cell']]['bbox']
        changed = copy.deepcopy(SCENES[last]['rows'])
        point = next((x,y) for y in range(len(changed)) for x in range(len(changed[0])) if not(box[0]<=x<=box[2] and box[1]<=y<=box[3]))
        changed[point[1]][point[0]] = (changed[point[1]][point[0]] + 1) % 16
        scene('controlled:distant_change', changed, epoch=SCENES[last]['public']['level'], score=SCENES[last]['public']['levels_completed'])
        after_case('after:known_distant_change', name, first, 'controlled:distant_change')
        m = RadialPortsAccess()
        for event in next(c for c in CASES if c['id']==name)['arguments']['ownEvents']: m.apply_event(copy.deepcopy(event))
        record_case('record:known_refutation', m, name, first, first)
        propose_case('proposal:refuted_same_context', m, first, common=True)


def source_hashes():
    manifest = json.loads((ROOT / 'reference/v6' / COMMIT / 'manifest.json').read_text())
    names = {Path(module.__file__).resolve() for module in list(sys.modules.values())
             if getattr(module, '__file__', None) and str(Path(module.__file__).resolve()).startswith(str(SOURCE.resolve()) + '/')}
    names.add(SOURCE / 'agents/yf_arc3_v6/morphology_policy/strategy.drm')
    hashes = {}
    for file in sorted(names):
        relative = str(file.relative_to(SOURCE))
        value = hashlib.sha256(file.read_bytes()).hexdigest()
        assert manifest['files'][relative]['sha256'] == value, relative
        hashes[relative] = value
    return hashes


def main():
    before_hashes = source_hashes()
    trace = live_component()
    print(json.dumps({'phase': 'original_component_complete', 'actions': trace['actions'], 'levelsCompleted': trace['levelsCompleted']}), file=sys.stderr, flush=True)
    for name in list(SCENES): measure_case(name)
    transformed_scenes('public:0')
    refusal_and_guard_cases(trace)
    after_hashes = source_hashes()
    assert all(after_hashes[k] == v for k, v in before_hashes.items())
    fixture = {'schema': 'logos-engine.v6.radial-port-reference.v1', 'sourceCommit': COMMIT,
               'sourceHashes': after_hashes, 'policy': POLICY,
               'qualification': {'sourceModified': False, 'realTrajectory': 'Original radial component only; no full-caller selection claim.',
                    'gameHost': 'Opaque public bridge load/action returns only; no engine source, level definitions or private state inspected.',
                    'controlledVariants': 'Public-raster contract cases, not live game victories.',
                    'ancestorScope': 'Own-layer projections are compared separately. Complete original ancestor results are retained as provenance.',
                    'importedMethodMode': 'Excluded by original common wrapper use_prior_method=false; no action method is loaded.'},
               'scenes': SCENES, 'plans': PLANS, 'states': STATES, 'cases': CASES, 'realComponent': trace,
               'sourceLineCoverage': {key: sorted(lines) for key, lines in sorted(COVERED.items())},
               'generator': str(Path(__file__).relative_to(ROOT)), 'generatorSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
               'gameAssetHashes': {name: hashlib.sha256((ROOT/'public/python'/name).read_bytes()).hexdigest()
                                  for name in ('custom-games.zip','official-games.zip','game_bridge.py','official_adapter.py','custom_level_navigation.py')}}
    target = ROOT / 'tests/fixtures/v6-radial-port-reference.json.gz'
    target.write_bytes(gzip.compress(json.dumps(fixture, sort_keys=True, separators=(',', ':')).encode(), mtime=0))
    print(json.dumps({'file': str(target), 'cases': len(CASES), 'scenes': len(SCENES), 'sourceFilesVerified': len(after_hashes),
                      'componentResult': {k:trace[k] for k in ('status','reason','actions','levelsCompleted','state','boundaries')}}))


if __name__ == '__main__': main()
