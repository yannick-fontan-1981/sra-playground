#!/usr/bin/env python3
"""Execute pinned V6 method acquisition and morphology return contracts.

The boundary method sequence is inline in the historical common runtime. Its
two AST statements are compiled unchanged, with explicit memory/router boundary
doubles. This is a component contract, not a whole-runtime or Kernel capture.
No game engine, specification, solution or native expected result is read.
"""
from __future__ import annotations

import ast
from collections import Counter
from copy import deepcopy
import gzip
import hashlib
import json
from pathlib import Path
import sys
from types import SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
MANIFEST = SOURCE.parent / 'manifest.json'
RUNTIME = 'agents/yf_arc3_v6/laya_proto/common_frontier_runtime.py'
EXECUTED = Counter()


def hashed(data):
    return hashlib.sha256(data).hexdigest()


def verify_source():
    result = {}
    for path, item in json.loads(MANIFEST.read_text())['files'].items():
        digest = hashed((SOURCE / path).read_bytes())
        assert digest == item['sha256'], path
        result[path] = digest
    assert len(result) == 1786
    return result


VERIFIED = verify_source()
sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
from terminal_composition import GoalAccessMemory, Snapshot
from neutral_observer import measure
from target_method import at_boundary, recalled_directions
from agents.yf_arc3_v6.morphology_policy.adapter import MorphologyAdapter


def plain(value):
    if isinstance(value, dict):
        return {key: plain(child) for key, child in value.items()}
    if isinstance(value, (list, tuple, bytes)):
        return [plain(child) for child in value]
    if isinstance(value, (set, frozenset)):
        return [plain(child) for child in sorted(value)]
    return value


def profile(frame, event, _arg):
    if event == 'call' and frame.f_code.co_filename.startswith(str(SOURCE) + '/'):
        code = frame.f_code
        EXECUTED[(Path(code.co_filename).relative_to(SOURCE).as_posix(), code.co_firstlineno, code.co_qualname)] += 1


class BoundaryMemory:
    """Explicit component dependency, not the historical SQLite implementation."""
    def __init__(self):
        self.writes = []
        self.values = {}

    def put(self, episode, key, value, *, evidence, revision):
        row = deepcopy(dict(episode=episode, key=key, value=value, evidence=evidence, revision=revision))
        self.writes.append(row)
        self.values[(episode, key)] = row

    def get(self, episode, key):
        return deepcopy(self.values[(episode, key)])


def extract_boundary():
    text = (SOURCE / RUNTIME).read_text()
    tree = ast.parse(text, filename=str(SOURCE / RUNTIME))
    found = []
    for owner in ast.walk(tree):
        for _, value in ast.iter_fields(owner):
            if not isinstance(value, list):
                continue
            for index, statement in enumerate(value[:-1]):
                if (isinstance(statement, ast.Assign) and len(statement.targets) == 1
                    and isinstance(statement.targets[0], ast.Name) and statement.targets[0].id == 'method'
                    and isinstance(statement.value, ast.Call)
                    and isinstance(statement.value.func, ast.Name) and statement.value.func.id == 'at_boundary'):
                    following = value[index + 1]
                    assert isinstance(following, ast.If) and isinstance(following.test, ast.Name) and following.test.id == 'method'
                    found.append([statement, following])
    assert len(found) == 1
    statements = found[0]
    original_dump = ast.dump(ast.Module(body=statements, type_ignores=[]), include_attributes=True)
    module = ast.Module(body=statements, type_ignores=[])
    code = compile(module, str(SOURCE / RUNTIME), 'exec')
    assert ast.dump(module, include_attributes=True) == original_dump
    first, last = statements[0].lineno, statements[-1].end_lineno
    segment = '\n'.join(text.splitlines()[first - 1:last]) + '\n'
    return code, dict(path=RUNTIME, firstLine=first, lastLine=last,
                      sourceSha256=VERIFIED[RUNTIME], segmentSha256=hashed(segment.encode()),
                      astSha256=hashed(original_dump.encode()), statementCount=2,
                      originalStatementsModified=False, wholeRuntimeExecuted=False)


def adapter_state(adapter):
    return dict(contacts=[[list(key), plain(value)] for key, value in adapter.contacts.items()],
                tried=sorted(adapter.tried), feature_trials=plain(adapter.feature_trials),
                entry_access_return=plain(adapter.entry_access_return))


def entry_contract():
    """Full original adapter sequence, with a declared prior-method premise.

    The existing entry fixture supplies public geometry/history only. We
    remeasure all observations, add a publicly decreasing strip and regenerate
    the full proposal, return and continuation in the unchanged source adapter.
    """
    entry_path = ROOT / 'tests/fixtures/v6-morphology-entry-reference.json.gz'
    prior = json.loads(gzip.decompress(entry_path.read_bytes()))
    args = next(row for row in prior['casesApproach'] if row['id'] == 'positive-deferred-contour')['args']
    scenes = {}
    snapshots = {}

    def scene(name, rows, *, epoch=2, score=1, available=None):
        previous_profile = sys.getprofile()
        sys.setprofile(None)
        packet = SimpleNamespace(frame_rows=deepcopy(rows), level=epoch, levels_completed=score,
                                 frame_hash=hashed(json.dumps(rows).encode())[:16], state='NOT_FINISHED',
                                 available_action_refs=available or ['ACTION1', 'ACTION2'])
        observation, _ = measure(packet, len(scenes) + 1, observation_scope='synthetic-method-continuation')
        scenes[name] = dict(rows=deepcopy(rows), observation=observation)
        snapshots[name] = Snapshot.from_public(observation, rows)
        sys.setprofile(previous_profile)
        return name

    def meter_rows(rows, length):
        result = deepcopy(rows)
        for y in (-2, -1):
            result[y] = [13 if x < length else 0 for x in range(len(result[y]))]
        return result

    def public(name):
        row = scenes[name]
        obs = row['observation']
        return SimpleNamespace(frame_rows=row['rows'], frame_hash=obs['frame_hash'], level=obs['level_epoch'],
                               levels_completed=obs['levels_completed'], state=obs['state'],
                               available_action_refs=obs['available_action_refs'])

    history = []
    for first, command, second in args['history']:
        for name in (first, second):
            if name not in scenes:
                scene(name, meter_rows(prior['scenes'][name]['rows'], 28))
        history.append([first, command, second])
    base_rows = prior['scenes'][args['current']]['rows']
    meters = [scene('meter:' + str(index), meter_rows(base_rows, length))
              for index, length in enumerate((26, 24, 22, 20))]
    current = scene('current', meter_rows(base_rows, 18))
    memory = GoalAccessMemory()
    memory.episode = [(snapshots[a], command, snapshots[b]) for a, command, b in history]
    adapter = MorphologyAdapter()
    method = deepcopy(args['method'])
    adapter.entry_method = method
    adapter.station_method = method['station_hypothesis']
    for name in meters:
        row = scenes[name]
        adapter.meter.observe(row['observation']['level_epoch'], row['observation']['observation_ref'], row['rows'],
                              primitive_index=row['observation']['revision'])
    inputs = [dict(action_ref=action) for action in args['available']]
    proposal = adapter.propose(memory, scenes[current]['observation'], scenes[current]['rows'], inputs, 100)
    assert proposal and proposal['morphology_plan']['route_key'] == 'entry_rebind'
    plan = proposal['morphology_plan']
    assert plan['deferred_probe'] and len(plan['steps']) == 3
    first_forecast = plain(adapter.meter.forecast())
    assert first_forecast['steps_before_empty'] == 9
    sequence = [current]
    source_rows = deepcopy(base_rows)
    origin = plan['steps'][0]['from']
    size = plan['size']
    pigment = [[source_rows[origin[1] + dy][origin[0] + dx] for dx in range(size[0])] for dy in range(size[1])]
    for dy in range(size[1]):
        for dx in range(size[0]):
            source_rows[origin[1] + dy][origin[0] + dx] = 0
    steps = []
    for index, step in enumerate(plan['steps']):
        rows = deepcopy(source_rows)
        for dy in range(size[1]):
            for dx in range(size[0]):
                rows[step['to'][1] + dy][step['to'][0] + dx] = pigment[dy][dx]
        after = scene('entry:step:' + str(index + 1), meter_rows(rows, 16 - index * 2))
        before = sequence[-1]
        guard = adapter.before(proposal, index, public(before), scenes[before]['observation'])
        response = adapter.after(proposal, index, public(after))
        event = adapter.record(proposal, index, public(before), public(after), snapshots[after].ref, snapshots[before].ref)
        assert guard['admitted']
        row = scenes[after]
        adapter.meter.observe(row['observation']['level_epoch'], row['observation']['observation_ref'], row['rows'],
                              primitive_index=row['observation']['revision'])
        memory.episode.append((snapshots[before], step['action_ref'], snapshots[after]))
        steps.append(dict(before=before, after=after, guard=plain(guard), response=plain(response), event=plain(event)))
        sequence.append(after)
    assert steps[-1]['event']['kind'] == 'entry_access_return'
    retained = adapter_state(adapter)
    resumed = adapter.propose(memory, scenes[sequence[-1]]['observation'], scenes[sequence[-1]]['rows'], inputs, 97)
    assert resumed and resumed['morphology_plan']['route_key'] == 'entry_probe'
    assert adapter_state(adapter) == retained, 'Planning cannot consume or erase the acquired return'
    probe_guard = adapter.before(resumed, 0, public(sequence[-1]), scenes[sequence[-1]]['observation'])
    assert probe_guard['admitted']
    guard_cases = []
    for name, mutation in [
        ('original-probe-current-contour-and-retreat', lambda p, packet, live: None),
        ('different-contour-refuses-before-probe', lambda p, packet, live: p['morphology_plan']['untested_contour'][0].__setitem__(2, 15)),
        ('different-retreat-surface-refuses-before-probe', lambda p, packet, live: p['morphology_plan']['exit_candidate'].update(surface_sha='contract:changed-retreat')),
        ('retreat-command-unavailable-refuses-before-probe', lambda p, packet, live: setattr(packet, 'available_action_refs', ['ACTION1'])),
        ('probe-command-unavailable-refuses-before-probe', lambda p, packet, live: setattr(packet, 'available_action_refs', ['ACTION2'])),
        ('changed-epoch-refuses-before-probe', lambda p, packet, live: setattr(packet, 'level', 3)),
        ('stale-observation-refuses-before-probe', lambda p, packet, live: live.update(observation_ref='contract:stale-public-observation')),
    ]:
        p, packet, live = deepcopy(resumed), public(sequence[-1]), deepcopy(scenes[sequence[-1]]['observation'])
        mutation(p, packet, live)
        expected = adapter.before(p, 0, packet, live)
        guard_cases.append(dict(id=name, proposal=plain(p), current=sequence[-1],
                                publicOverrides=dict(level=packet.level, available_action_refs=packet.available_action_refs),
                                live=plain(live), expected=plain(expected)))
    assert all(not row['expected']['admitted'] for row in guard_cases[1:])
    return_cases = []
    for name, mutation in [
        ('final-approach-return-acquired-before-generic-approach-stop', lambda p, b, a, sample: None),
        ('unfinished-approach-does-not-acquire', lambda p, b, a, sample: sample.update(index=0)),
        ('approach-without-deferred-probe-does-not-acquire', lambda p, b, a, sample: p['morphology_plan'].update(deferred_probe=None)),
        ('changed-epoch-does-not-acquire-return', lambda p, b, a, sample: a.update(level_epoch=3)),
        ('changed-score-does-not-acquire-return', lambda p, b, a, sample: a.update(levels_completed=a['levels_completed'] + 1)),
        ('changed-arrival-footprint-does-not-acquire-return', lambda p, b, a, sample: p['morphology_plan'].update(footprint_sha='contract:changed-footprint')),
    ]:
        p = deepcopy(proposal)
        b = deepcopy(scenes[sequence[-2]]['observation'])
        a = deepcopy(scenes[sequence[-1]]['observation'])
        sample = dict(index=len(plan['steps']) - 1)
        mutation(p, b, a, sample)
        b_packet, a_packet = public(sequence[-2]), public(sequence[-1])
        for packet, obs in ((b_packet, b), (a_packet, a)):
            packet.level, packet.levels_completed = obs['level_epoch'], obs['levels_completed']
        target = MorphologyAdapter()
        expected = target.record(p, sample['index'], b_packet, a_packet, a['observation_ref'], b['observation_ref'])
        return_cases.append(dict(id=name, proposal=plain(p), before=sequence[-2], after=sequence[-1],
                                 beforeObservation=plain(b), afterObservation=plain(a), index=sample['index'],
                                 expected=plain(expected), projection=adapter_state(target)))
    assert all(row['expected'] is None for row in return_cases[1:])
    return dict(scenes=scenes, history=history, meterScenes=meters, current=current, inputs=inputs, remaining=100,
                priorMethod=plain(method), proposal=plain(proposal), firstForecast=first_forecast,
                steps=steps, acquiredProjection=retained, resumedProposal=plain(resumed), resumeRemaining=97,
                resumedForecast=plain(adapter.meter.forecast()), guardCases=guard_cases, returnCases=return_cases,
                inputArtifact=dict(path=entry_path.relative_to(ROOT).as_posix(), sha256=hashed(entry_path.read_bytes()),
                                   use='public geometry and motion history; declared prior-method premise, no native decision'),
                premises=dict(priorMethod='explicit historical scored-method consumer premise; not acquired by this scenario',
                              geometry='all current observations remeasured from synthetic public rasters',
                              acquiredReturn='acquired by original full adapter.record after its own full proposal',
                              meter='real original ObservedMeter observes each synthetic public decreasing-strip sample',
                              authority='no action release or game execution; component public returns are supplied'))


def main():
    code, fragment = extract_boundary()
    input_path = ROOT / 'tests/fixtures/v6-morphology-measurements-reference.json.gz'
    historical = json.loads(gzip.decompress(input_path.read_bytes()))
    family = historical['family']
    names = {family['current']}
    for first, _, second in family['history']:
        names.update((first, second))
    for step in family['steps']:
        names.update((step['before'], step['after']))
    scenes = {name: deepcopy(historical['scenes'][name]) for name in sorted(names)}
    snapshots = {name: Snapshot.from_public(row['observation'], row['rows']) for name, row in scenes.items()}

    def public(name):
        row = scenes[name]
        obs = row['observation']
        return SimpleNamespace(frame_rows=row['rows'], frame_hash=obs['frame_hash'], level=obs['level_epoch'],
                               levels_completed=obs['levels_completed'], state=obs['state'],
                               available_action_refs=obs['available_action_refs'])

    sys.setprofile(profile)
    goal = GoalAccessMemory()
    goal.episode = [(snapshots[a], command, snapshots[b]) for a, command, b in family['history']]
    adapter = MorphologyAdapter()
    proposal = adapter.propose(goal, scenes[family['current']]['observation'], scenes[family['current']]['rows'],
                               family['inputs'], family['remaining'])
    assert proposal and plain(proposal) == family['proposal']
    events = []
    for index, step in enumerate(family['steps']):
        before, after = step['before'], step['after']
        event = adapter.record(proposal, index, public(before), public(after), snapshots[after].ref, snapshots[before].ref)
        if event is not None:
            events.append(event)
    assert len(events) == 1 and events[0]['station_entry']['peer_preserved']
    source_event = events[0]
    facts = proposal['morphology']['measured_facts']
    last = family['steps'][-1]['after']
    source_epoch = scenes[last]['observation']['level_epoch']
    final_ref = snapshots[last].ref
    tree = dict(observation_ref=final_ref,
                retained_target=dict(composition=proposal['morphology']['composition'], pair_ref=facts['pair_ref'],
                                     verified_child_effect=dict(after=source_event['station_entry']['after'],
                                                                before=source_event['station_entry']['before'],
                                                                kind='observed_selective_contact')),
                preceding_peer_access=dict(complete=True, pair_ref=facts['pair_ref'], level_epoch=source_epoch,
                                           after=final_ref, role_refs=proposal['morphology_plan']['role_refs'],
                                           motion_examples=facts['motion_examples']))
    before = deepcopy(scenes[last]['observation'])
    after = deepcopy(before)
    after.update(observation_ref='contract:scoring-observation', level_epoch=source_epoch + 1,
                 levels_completed=before['levels_completed'] + 1, revision=before['revision'] + 1)
    command = {'action_ref': 'ACTION1'}
    native_proposal = dict(status='proposed', actions=[command],
                           bundle_template=dict(composition_ref='contract:released-composition'),
                           composition_target_tree=tree)
    prior = dict(composition='prior-contract-method', source_scope=0,
                 station_hypothesis=dict(source_epoch=0, after='prior-station-witness'))
    cases = []

    def capture(name, setup=None, mutate=None, *, acquired=False):
        args = deepcopy(dict(tree=tree, before=before, after=after, command=command, proposal=native_proposal,
                             decisionRevision=before['revision'], index=0, priorMethod=prior,
                             events=[source_event] if setup is None else setup))
        if mutate:
            mutate(args)
        args['proposal']['composition_target_tree'] = args['tree']
        current = MorphologyAdapter()
        for event in deepcopy(args['events']):
            current.apply_event(event)
        witness = dict(source_level=args['before']['level_epoch'],
                       before_observation_ref=args['before']['observation_ref'],
                       after_observation_ref=args['after']['observation_ref'], last_action=args['command'],
                       released_composition=args['proposal']['bundle_template']['composition_ref'],
                       committed_decision_revision=args['decisionRevision'], executed_prefix_actions=args['index'] + 1,
                       cancelled_suffix_actions=len(args['proposal']['actions']) - args['index'] - 1,
                       levels_completed_before=args['before']['levels_completed'],
                       levels_completed_after=args['after']['levels_completed'], official_state=args['after']['state'],
                       causal_terminal_role='unknown',
                       qualification='observed official boundary/terminal witness, not a generalized winning recipe')
        memory = BoundaryMemory()
        router = SimpleNamespace(target_method=deepcopy(args['priorMethod']), morph=current)
        current.entry_method = deepcopy(args['priorMethod'])
        current.station_method = deepcopy(args['priorMethod'].get('station_hypothesis'))
        scope = dict(at_boundary=at_boundary, target_receipt=args['tree'], witness=witness,
                     strategy_router=router, memory=memory, episode='common-observation-frontier',
                     after=args['after'], revision=args['after']['revision'] - 1)
        exec(code, scope)
        expected = dict(method=plain(scope['method']), targetMethod=plain(router.target_method),
                        entryMethod=plain(current.entry_method), stationMethod=plain(current.station_method),
                        writes=plain(memory.writes), witness=plain(witness), projection=adapter_state(current))
        cases.append(dict(id=name, args=plain(args), expected=expected,
                          premises=dict(contactEvents='recorded from actual original adapter public returns' if acquired else
                                        'explicit component event-history variants replayed by original apply_event',
                                        targetReceipt='explicit scored-target component premise; no preceding peer access is acquired by this fragment',
                                        boundary='explicit public boundary contract input; not a real Kernel release')))

    capture('unique-acquired-station-entry-enriches-single-method-write', acquired=True)
    capture('valid-target-with-no-station-keeps-method-without-station', [])
    duplicate = deepcopy(source_event)
    duplicate['pair_key'] = 'contract:another-pair-key'
    capture('two-matching-source-epoch-entries-remain-ambiguous', [source_event, duplicate])
    foreign = deepcopy(source_event)
    foreign['epoch'] = source_epoch + 1
    capture('foreign-epoch-entry-does-not-enrich', [foreign])
    not_preserved = deepcopy(source_event)
    not_preserved['station_entry']['peer_preserved'] = False
    capture('unpreserved-peer-does-not-enrich', [not_preserved])
    stale = deepcopy(source_event)
    stale['station_entry']['after'] = 'contract:unrelated-entry-return'
    capture('different-effect-return-does-not-enrich', [stale])
    foreign_pair = deepcopy(source_event)
    foreign_pair['pair_key'] = 'contract:other-pair-identity'
    capture('unique-entry-matches-return-without-extra-pair-filter', [foreign_pair])
    capture('missing-selective-effect-retains-prior-method', mutate=lambda a: a['tree']['retained_target'].update(verified_child_effect=None))
    capture('incomplete-peer-access-retains-prior-method', mutate=lambda a: a['tree']['preceding_peer_access'].update(complete=False))
    capture('mismatched-target-pair-retains-prior-method', mutate=lambda a: a['tree']['preceding_peer_access'].update(pair_ref='contract:wrong-pair'))
    capture('unchanged-score-retains-prior-method', mutate=lambda a: a['after'].update(levels_completed=a['before']['levels_completed']))
    capture('two-score-increments-do-not-qualify', mutate=lambda a: a['after'].update(levels_completed=a['before']['levels_completed'] + 2))
    capture('peer-access-from-another-epoch-does-not-qualify', mutate=lambda a: a['tree']['preceding_peer_access'].update(level_epoch=99))
    capture('stale-peer-access-does-not-qualify', mutate=lambda a: a['tree']['preceding_peer_access'].update(after='contract:stale-peer-return'))
    capture('stale-boundary-before-does-not-qualify', mutate=lambda a: a['before'].update(observation_ref='contract:stale-before'))
    assert len(cases[0]['expected']['writes']) == 1
    assert cases[0]['expected']['stationMethod']
    assert all(not row['expected']['writes'] for row in cases[7:])
    assert cases[1]['expected']['stationMethod'] is None

    recalled = []
    acquired_method = cases[0]['expected']['targetMethod']
    next_observation = deepcopy(scenes[family['current']]['observation'])
    next_observation['level_epoch'] = source_epoch + 1
    next_observation['observation_ref'] = 'contract:next-epoch-public-observation'
    current = Snapshot.from_public(next_observation, scenes[family['current']]['rows'])
    decision = deepcopy(proposal['morphology'])
    for name, method, picked, snapshot in [
        ('next-epoch-current-role-recalls-measured-motions', acquired_method, decision, current),
        ('same-epoch-does-not-recall', acquired_method, decision, snapshots[family['current']]),
        ('different-composition-does-not-recall', acquired_method, {**decision, 'composition': 'contract:other-composition'}, current),
        ('absent-method-does-not-recall', None, decision, current),
        ('refuted-alignment-does-not-recall', acquired_method, {**decision, 'measured_facts': {**facts, 'alignment_refuted': True}}, current),
        ('unframed-pair-does-not-recall', acquired_method, {**decision, 'measured_facts': {**facts, 'framed_pair': False}}, current),
        ('missing-current-role-does-not-recall', {**acquired_method, 'role_refs': ['contract:missing-role']}, decision, current),
    ]:
        recalled.append(dict(id=name, method=plain(method), decision=plain(picked),
                             current=dict(observation=next_observation if snapshot is current else scenes[family['current']]['observation'],
                                          rows=scenes[family['current']]['rows']),
                             expected=plain(recalled_directions(method, picked, snapshot))))
    assert recalled[0]['expected'] == facts['motion_examples']
    assert all(not row['expected'] for row in recalled[1:])
    entry_family = entry_contract()
    sys.setprofile(None)
    after_verified = verify_source()
    assert after_verified == VERIFIED
    used = {path for path, _, _ in EXECUTED}
    used.update((RUNTIME, 'agents/yf_arc3_v6/morphology_policy/morphology_policy.drm', 'agents/yf_arc3_v5/drm/morphology.drm'))
    result = dict(schema='logos-engine.v6.morphology-methods-reference.v1', commit=COMMIT,
                  generator=dict(path=Path(__file__).relative_to(ROOT).as_posix(), sha256=hashed(Path(__file__).read_bytes())),
                  sourceVerification=dict(verifiedOriginalFilesBefore=len(VERIFIED), verifiedOriginalFilesAfter=len(after_verified),
                                          manifestSha256=hashed(MANIFEST.read_bytes())),
                  method=dict(sourceModified=False, originalStatementsModified=False, monkeyPatched=False,
                              nativeExecution=False, wholeRuntimeExecuted=False, sourceFragmentExtracted=True,
                              boundaryDoubles=['memory.put/get storage boundary', 'strategy_router ownership container'],
                              inputs='Public synthetic rasters/history plus declared component boundary premises. No game engine, specification, solution or native expectation.'),
                  sourceFragment=fragment,
                  inputArtifacts=[dict(path=input_path.relative_to(ROOT).as_posix(), sha256=hashed(input_path.read_bytes()),
                                       use='public observations and primitive history; original adapter proposal and events are recomputed'),
                                  entry_family.pop('inputArtifact')],
                  sourceHashes={path: VERIFIED[path] for path in sorted(used)},
                  executedSourceFunctions=[dict(path=path, line=line, function=name, calls=count)
                                           for (path, line, name), count in sorted(EXECUTED.items())],
                  scope='Scored-method boundary acquisition and mirror ownership, original local contact acquisition, rejection and recalled directions; full original adapter proposal, approach return and continuation from declared method history. No whole-runtime, general checkpoint parity or solved-game claim.',
                  scenes=scenes, acquisition=dict(history=family['history'], current=family['current'], inputs=family['inputs'],
                                                  remaining=family['remaining'], proposal=plain(proposal), steps=family['steps'],
                                                  events=plain(events), projection=adapter_state(adapter)),
                  boundaryCases=cases, recalledCases=recalled, entryFamily=entry_family)
    destination = ROOT / 'tests/fixtures/v6-morphology-methods-reference.json.gz'
    destination.write_bytes(gzip.compress((json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n').encode(), mtime=0))
    print(json.dumps(dict(boundaryCases=len(cases), recalledCases=len(recalled), entryGuardCases=len(entry_family['guardCases']),
                          entryReturnCases=len(entry_family['returnCases']), verifiedOriginalFiles=len(VERIFIED),
                          fragment=fragment, bytes=destination.stat().st_size)))


if __name__ == '__main__':
    main()
