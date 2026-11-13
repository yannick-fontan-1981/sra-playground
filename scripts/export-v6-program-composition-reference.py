#!/usr/bin/env python3
"""Unchanged V6 program-composition contracts on controlled public rasters.

The examples are observer contracts, not game solutions. A measured edit and
public phase packet are used to fit the original model. Full ancestor returns
are retained, and source hashes are checked against the immutable manifest.
"""
from __future__ import annotations

import copy
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
LAYA = SOURCE / 'agents/yf_arc3_v6/laya_proto'
sys.path[:0] = [str(SOURCE), str(LAYA)]

from marked_collection_access import collection_scene, measured_controls, rectangular_members, input_candidates
from observed_program_effects import patch, align_program_packet, translation_candidates
from program_geometry import render_layers, fit_layer_offset, fit_glyph_vectors, decode_stacks
from program_compositions import fit_composition_model, coordinates, surface, simulate_word, search_program
from program_respondent_search import simulate as simulate_respondents, search as search_respondents, search_replacement
from program_respondent_observations import support_match, full_match, observe_respondent_packet
from program_input_access import learn_input_support, candidate_sites
from program_composition_access import editor, projected_members, world, word_at
from program_respondent_access import ProgramRespondentAccess
from occurrence_recall_access import OccurrenceRecallAccess
from common_program_composition import ProgramCompositionConstraint
from common_observed_compositions import ObservedCompositionConstraint
from common_crossed_prefix import CrossedPrefixAccess
from neutral_observer import measure
from terminal_composition import identity

CONFIG = json.loads((SOURCE / 'agents/yf_arc3_v6/morphology_policy/strategy.drm').read_text())['declarations'][0]['configuration']
SCENES, STATES, PLANS, RAW_EVENTS = {}, {}, {}, {}
CASES, PROPOSALS, GUARDS, BINDS, JOURNALS, COMMON, IDENTITIES, FLOATS = [], [], [], [], [], [], [], []
PUBLIC_INPUTS = []
COVERED = {}
OWN_FILES = {str(LAYA / name) for name in (
    'marked_collection_access.py', 'observed_program_effects.py', 'program_geometry.py',
    'program_compositions.py', 'program_respondent_search.py', 'program_respondent_observations.py',
    'program_input_access.py', 'program_composition_access.py', 'program_respondent_access.py',
    'common_program_composition.py')}
LABELS = [1, 2, 6, 7, 8]
SHAPE = [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]]
LAYER = {'shape': SHAPE, 'step': [0, 1]}
DEADLINE = 10 ** 30


def plain(value):
    if isinstance(value, dict): return {str(key): plain(child) for key, child in value.items()}
    if isinstance(value, (tuple, list)): return [plain(child) for child in value]
    if isinstance(value, (set, frozenset)): return [plain(child) for child in sorted(value)]
    return value


def traced(call, parent_method=None):
    parents = []
    def trace(frame, event, arg):
        if event == 'line' and frame.f_code.co_filename in OWN_FILES:
            COVERED.setdefault(Path(frame.f_code.co_filename).name + ':' + frame.f_code.co_name, set()).add(frame.f_lineno)
        if parent_method is not None and event == 'return' and frame.f_code is parent_method.__code__:
            parents.append(copy.deepcopy(arg))
        return trace
    sys.settrace(trace)
    try: return call(), parents
    finally: sys.settrace(None)


def rect(rows, box, color):
    x, y, r, b = box
    for v in range(y, b + 1):
        for u in range(x, r + 1):
            if 0 <= v < len(rows) and 0 <= u < len(rows[0]): rows[v][u] = color


def paint_word(rows, base, word, layer=LAYER):
    anchor = [base[i] - len(word) * layer['step'][i] for i in (0, 1)]
    for (x, y), color in render_layers(word, layer['shape'], layer['step']).items():
        x += anchor[0]; y += anchor[1]
        if 0 <= y < len(rows) and 0 <= x < len(rows[0]): rows[y][x] = color


def raster(word=(1, 8, 6, 2), base=(18, 12), targets=(((14, 20), (8,)),), *, marked_member=None,
           marked_control=None, active=None, controls=True, floor=5):
    rows = [[0] * 48 for _ in range(48)]
    rect(rows, [10, 3, 37, 29], floor)
    for i, label in enumerate(word):
        box = [2, 3 + 5 * i, 3, 5 + 5 * i]
        rect(rows, box, 9 if i == active else label)
        if i != marked_member: rows[box[1] + 1][box[0] - 1] = 4
    if controls:
        holes = [(2, 0), (4, 2), (2, 4), (0, 2)]
        marks = {1: (4, 2), 2: (2, 4), 6: (0, 2), 7: (2, 0)}
        for i, label in enumerate(LABELS):
            box = [1 + i * 7, 33, 5 + i * 7, 37]
            rect(rows, box, label)
            for x, y in holes: rows[box[1] + y][box[0] + x] = 0 if label == 8 or (x, y) == marks[label] else 3
            if label != marked_control: rows[box[1] + 1][box[0] - 1] = 4
    paint_word(rows, base, word)
    for at, labels in targets: paint_word(rows, at, labels)
    return rows


def scene(name, rows, *, frames=None, epoch=1, score=0, state='NOT_FINISHED', available=None):
    revision = len(SCENES) + 1
    public = SimpleNamespace(frame_rows=copy.deepcopy(rows), frame_packet=copy.deepcopy(frames if frames is not None else [rows]),
        level=epoch, levels_completed=score, state=state, step_index=revision - 1,
        available_action_refs=['ACTION5', 'ACTION6'] if available is None else list(available), frame_hash=identity(rows)[:16])
    observation, _ = measure(public, revision, 'program-composition-reference')
    SCENES[name] = {'rows': copy.deepcopy(rows), 'public': plain(vars(public)), 'observation': plain(observation)}
    return name


def snapshot(memory):
    return {'projection': plain(vars(memory)), 'sourceDigest': memory.retained_digest(),
        'programParentDigest': CrossedPrefixAccess.retained_digest(memory),
        'programDigest': ProgramRespondentAccess.retained_digest(memory)}


def remember(name, memory):
    STATES[name] = {'events': plain(RAW_EVENTS.get(memory, [])), **snapshot(memory)}
    return name


def restored(name):
    memory = OccurrenceRecallAccess()
    RAW_EVENTS[memory] = copy.deepcopy(STATES[name]['events'])
    for event in RAW_EVENTS[memory]: memory.apply_event(copy.deepcopy(event))
    assert snapshot(memory) == {key: STATES[name][key] for key in ('projection', 'sourceDigest', 'programParentDigest', 'programDigest')}
    return memory


def journal(name, initial=None):
    memory = restored(initial) if initial else OccurrenceRecallAccess(); RAW_EVENTS.setdefault(memory, [])
    entry = {'id': name, 'initialState': initial, 'steps': []}; JOURNALS.append(entry)
    return memory, entry


def acquire(memory, entry, operation, before, after, command, proposal=None, *, frames=None, index=0):
    first, second = SCENES[before], SCENES[after]
    packet = second['public']['frame_packet'] if frames is None else frames
    if operation == 'record':
        args = [copy.deepcopy(first['observation']), copy.deepcopy(command), copy.deepcopy(second['observation']),
            copy.deepcopy(first['rows']), copy.deepcopy(second['rows']), copy.deepcopy(proposal or {}), index]
        call, parent = lambda: memory.record(*args), CrossedPrefixAccess.record
    else:
        args = [copy.deepcopy(first['observation']), copy.deepcopy(command), copy.deepcopy(second['observation']),
            copy.deepcopy(first['rows']), copy.deepcopy(packet), []]
        call, parent = lambda: memory.record_packet(*args), CrossedPrefixAccess.record_packet
    untouched = copy.deepcopy(args)
    step = {'operation': operation, 'before': before, 'after': after, 'command': plain(command),
        'proposal': plain(proposal or {}), 'index': index, 'frames': plain(packet)}
    result, parents = traced(call, parent)
    assert len(parents) == 1 and result[:len(parents[0])] == parents[0]
    RAW_EVENTS[memory].extend(copy.deepcopy(result))
    assert args == untouched
    step.update(sourceEvents=plain(result), parentEvents=plain(parents[0]), expectedOwnEvents=plain(result[len(parents[0]):]),
        state=snapshot(memory), sourceInputsUnchanged=True)
    entry['steps'].append(step); entry['finalState'] = snapshot(memory)
    return step


def math_case(name, operation, args, kwargs=None):
    helpers = {'render_layers': render_layers, 'fit_layer_offset': fit_layer_offset, 'fit_glyph_vectors': fit_glyph_vectors,
        'decode_stacks': decode_stacks, 'fit_composition_model': fit_composition_model, 'coordinates': coordinates,
        'surface': surface, 'simulate_word': simulate_word, 'search_program': search_program,
        'simulate_respondents': simulate_respondents, 'search_respondents': search_respondents, 'search_replacement': search_replacement,
        'support_match': support_match, 'full_match': full_match, 'observe_respondent_packet': observe_respondent_packet,
        'learn_input_support': learn_input_support, 'candidate_sites': candidate_sites,
        'editor': editor, 'projected_members': projected_members, 'world': world, 'word_at': word_at,
        'collection_scene': collection_scene, 'measured_controls': measured_controls, 'rectangular_members': rectangular_members,
        'translation_candidates': translation_candidates}
    kwargs = kwargs or {}; old = copy.deepcopy([args, kwargs])
    value, _ = traced(lambda: helpers[operation](*args, **kwargs))
    if operation == 'render_layers': value = [[x, y, color] for (x, y), color in sorted(value.items())]
    assert [args, kwargs] == old
    entry = {'id': name, 'operation': operation, 'args': plain(args), 'kwargs': plain(kwargs), 'expected': plain(value)}
    CASES.append(entry); return value


def propose(name, *, state='empty', view='toy:marked', operation='program', maximum=16, remaining=6,
            deadline=DEADLINE, observation_patch=None, inputs=None):
    memory = restored(state); current = SCENES[view]
    observation = {**copy.deepcopy(current['observation']), **(observation_patch or {})}; inputs = inputs or []
    entry = {'id': name, 'operation': operation, 'state': state, 'scene': view, 'observation': observation,
        'maxPrefix': maximum, 'remaining': remaining, 'deadline': deadline, 'inputs': plain(inputs)}
    old = snapshot(memory)
    try:
        if operation == 'common':
            family = ProgramCompositionConstraint(); family.level_deadline = deadline
            for event in STATES[state]['events']: family.memory.apply_event(copy.deepcopy(event)); family.events.append(copy.deepcopy(event))
            before = copy.deepcopy(family.state())
            result, _ = traced(lambda: family.program_propose(observation, current['rows'], inputs, remaining))
            assert family.state() == before
        elif operation == 'marked': result, _ = traced(lambda: memory.marked_question(observation, current['rows'], inputs))
        else: result, _ = traced(lambda: memory.program_question(observation, current['rows'], maximum,
                {'remaining_level_actions': remaining, 'level_deadline': deadline}))
        entry['expected'] = plain(result)
    except (ValueError, TypeError, KeyError, IndexError) as error:
        entry['error'] = {'type': type(error).__name__, 'message': str(error)}
    assert snapshot(memory) == old
    entry['sourceStateUnchanged'] = True; PROPOSALS.append(entry)
    return entry.get('expected')


def guard(name, operation, plan, before, after=None, *, state='empty', index=0, edit=lambda p: None, meta_patch=None):
    memory = restored(state); proposal = copy.deepcopy(PLANS[plan]); edit(proposal)
    obs = SCENES[before if operation == 'before' else after]['observation']
    meta = {'epoch': obs['level_epoch'], 'score': obs['levels_completed'], 'state': obs['state'],
        'observation_ref': obs['observation_ref'], 'available': obs['available_action_refs'], **(meta_patch or {})}
    entry = {'id': name, 'operation': operation, 'state': state, 'proposal': plain(proposal),
        'before': before, 'after': after, 'index': index, 'meta': meta}
    old = snapshot(memory); untouched = copy.deepcopy(proposal)
    call = (lambda: memory.before(proposal, index, SCENES[before]['rows'], **meta)) if operation == 'before' else (
        lambda: memory.after(proposal, index, SCENES[before]['rows'], SCENES[after]['rows'], **meta))
    try: value, _ = traced(call); entry['expected'] = plain(value)
    except (ValueError, TypeError, KeyError, IndexError) as error: entry['error'] = {'type': type(error).__name__, 'message': str(error)}
    assert snapshot(memory) == old and proposal == untouched
    GUARDS.append(entry)


def bind_case(name, plan, scene_id, edit=lambda p: None, *, observed=True):
    proposal = copy.deepcopy(PLANS[plan]); edit(proposal)
    obs = SCENES[scene_id]['observation']; domain = SimpleNamespace(bindings={(obs['level_epoch'], obs['frame_hash']): True} if observed else {})
    item = {'id': name, 'proposal': plain(proposal), 'scene': scene_id, 'observed': observed}
    try:
        ProgramCompositionConstraint().bind(proposal, domain); item['expected'] = plain(proposal)
    except (ValueError, TypeError, KeyError, IndexError) as error: item['error'] = {'type': type(error).__name__, 'message': str(error)}
    BINDS.append(item)


def common_journal(name, transitions, initial=None):
    family = ObservedCompositionConstraint(); family.level_deadline = DEADLINE
    if initial:
        for event in STATES[initial]['events']:
            family.memory.apply_event(copy.deepcopy(event)); family.events.append(copy.deepcopy(event))
    entry = {'id': name, 'initialState': initial, 'steps': []}; COMMON.append(entry)
    for before, after, proposal, index, command in transitions:
        first, second = SCENES[before], SCENES[after]
        result, _ = traced(lambda: family.record(first['observation'], second['observation'], copy.deepcopy(command),
            first['rows'], second['rows'], copy.deepcopy(proposal), index, frames=second['public']['frame_packet']))
        state = copy.deepcopy(family.state()); rebuilt = ObservedCompositionConstraint(); rebuilt.restore(state)
        assert rebuilt.state() == state
        # Explicit source method selects the already ported ancestor digest;
        # the enclosing original inheritance remains a larger declared scope.
        program_state = {'projection': plain({key: getattr(family.memory, key) for key in STATES['empty']['projection']}),
            'sourceDigest': OccurrenceRecallAccess.retained_digest(family.memory)}
        family = rebuilt; family.level_deadline = DEADLINE
        entry['steps'].append({'before': before, 'after': after, 'command': plain(command), 'proposal': plain(proposal),
            'index': index, 'expected': plain(result), 'programState': program_state, 'fullSourceState': plain(state)})


def actual_public_trace():
    path = ROOT / 'docs/migration/native-campaigns-v39/diagnostics/stck-first-pass-public.json.gz'
    raw = path.read_bytes(); trace = json.loads(gzip.decompress(raw))
    assert trace['schema'] == 'logos-engine.native-public-game-trace.v1'
    PUBLIC_INPUTS.append({'path': str(path.relative_to(ROOT)), 'sha256': hashlib.sha256(raw).hexdigest(),
        'game': trace['game'], 'sourceDigest': trace['sourceDigest'], 'sourceStatus': trace['status'],
        'usedExternalActions': 3, 'qualification': 'Only the first three actual public commands and packets are replayed. This diagnostic trace completed one level, not three levels or a game.'})
    for i, item in enumerate(trace['packets'][:4]):
        public = copy.deepcopy(item['packet']); observation, _ = measure(SimpleNamespace(**public), len(SCENES) + 1, 'program-composition-reference')
        SCENES['real:stck:' + str(i)] = {'rows': copy.deepcopy(public['frame_rows']), 'public': public, 'observation': plain(observation)}
    memory, entry = journal('actual_public_stck_first_level')
    remember('real_stck_0', memory); transitions = []
    for i in range(1, 4):
        before, after = 'real:stck:' + str(i - 1), 'real:stck:' + str(i)
        proposal = propose('actual_stck_full_common_' + str(i), operation='common', state='real_stck_' + str(i - 1), view=before, remaining=600 - i + 1)
        assert proposal and len(proposal['actions']) == 1
        command = trace['packets'][i]['command']; expected = proposal['actions'][0]
        assert command['action_ref'] == expected['action_ref'] and command.get('data', {}) == expected.get('data', {})
        PLANS['actual_stck_' + str(i)] = proposal
        acquire(memory, entry, 'record', before, after, command, proposal)
        acquire(memory, entry, 'packet', before, after, command)
        remember('real_stck_' + str(i), memory)
        transitions.append((before, after, proposal, 0, command))
    assert len(memory.composition_models) == 1
    assert SCENES['real:stck:3']['observation']['levels_completed'] == 1
    propose('actual_stck_next_epoch_program_question', operation='common', state='real_stck_3', view='real:stck:3', remaining=600)
    alignment = memory.program_events[-1]['alignment']; sample = memory.program_edit_samples[0]
    math_case('actual_public_stck_full_fitted_model', 'fit_composition_model', [alignment, sample['before_rows'], sample['after_rows'],
        sample['before_members'], sample['after_members'], SCENES['real:stck:2']['rows'], SCENES['real:stck:3']['public']['frame_packet']], {'official_progress': True})
    common_journal('actual_stck_unfiltered_common_first_level', transitions)


def seed_scenes():
    before = raster((1, 8, 6, 2, 7), marked_member=4, marked_control=8)
    after = raster()
    assert collection_scene(before)['marked_members'][0]['color'] == 7
    assert not collection_scene(after)['marked_controls']
    scene('toy:marked', before); scene('toy:edited', after)
    packet = []
    for active, base, targets in [
        (3, [18, 12], [([14, 20], [8])]), (3, [18, 16], [([14, 20], [8])]),
        (2, [18, 16], [([14, 20], [8])]), (2, [14, 16], [([14, 20], [8])]),
        (1, [14, 16], [([14, 20], [8])]), (1, [14, 16], []),
        (0, [14, 16], []), (0, [18, 16], []), (None, [18, 16], []),
    ]: packet.append(raster(base=base, targets=targets, active=active))
    next_rows = raster([1], [14, 12], [([26, 12], [6, 8])])
    packet.append(next_rows)
    scene('toy:epoch2', next_rows, frames=packet, epoch=2, score=1)
    scene('toy:probe_edit', raster([6, 1], [14, 12], [([26, 12], [6, 8])]), epoch=2, score=1)
    probe_packet = [raster([6, 1], [18, 12], [([26, 12], [6, 8])], controls=False),
        raster([6, 1], [14, 12], [([22, 12], [6, 8])]), raster([6, 1], [14, 12], [([22, 12], [6, 8])])]
    scene('toy:probe_return', probe_packet[-1], frames=probe_packet, epoch=2, score=1)
    scene('toy:stationary', probe_packet[-1], epoch=2, score=1)
    scene('toy:repeat_before', raster([1, 8, 6], [18, 12], [([10, 12], [8, 8])]), epoch=3, score=2)
    scene('toy:repeat_middle', raster([1, 8, 6], [18, 12], [([10, 12], [8])]), epoch=3, score=2)
    scene('toy:repeat_boundary', raster([1, 8, 6], [14, 12], []), epoch=4, score=3)
    fixture = json.loads((ROOT / 'tests/fixtures/v6-occurrence-reference.json').read_text())
    scene('public:stck_initial', fixture['scenes']['stck:initial']['rows'])
    scene('toy:blank', [[0] * 40 for _ in range(40)])


def main():
    seed_scenes()
    memory, entry = journal('measured_edit_and_public_phase_packet')
    remember('empty', memory)
    PLANS['marked'] = propose('marked_removal', operation='marked')
    assert PLANS['marked']['marked_collection_plan']['mode'] == 'remove'
    PLANS['common_marked'] = propose('common_marked_current_support', operation='common')
    acquire(memory, entry, 'record', 'toy:marked', 'toy:edited', PLANS['marked']['actions'][0], PLANS['marked'])
    remember('edited', memory)
    PLANS['execute'] = propose('confirmed_edit_authorizes_unique_execution', operation='marked', state='edited', view='toy:edited')
    assert PLANS['execute']['marked_collection_plan']['mode'] == 'execute'
    acquire(memory, entry, 'record', 'toy:edited', 'toy:epoch2', PLANS['execute']['actions'][0], PLANS['execute'])
    acquire(memory, entry, 'packet', 'toy:edited', 'toy:epoch2', PLANS['execute']['actions'][0])
    assert len(memory.composition_models) == 1, 'The controlled edit and actual source observer must fit the model'
    remember('fitted', memory)
    model = memory.composition_models[-1]
    print('fitted synthetic model', model['model_id'], file=sys.stderr)

    # The source now sees a new epoch with heterogeneous respondents. A two-step
    # public probe preserves its own input bearer and observes the other order.
    PLANS['probe'] = propose('other_bearer_probe', state='fitted', view='toy:epoch2')
    assert PLANS['probe'] and PLANS['probe']['kind'] == 'public_program_respondent_probe'
    PLANS['common_probe'] = propose('common_other_bearer_probe', operation='common', state='fitted', view='toy:epoch2')
    memory, entry = journal('probe_reconciles_input_support_and_respondent_order', 'fitted')
    acquire(memory, entry, 'record', 'toy:epoch2', 'toy:probe_edit', PLANS['probe']['actions'][0], PLANS['probe'])
    acquire(memory, entry, 'record', 'toy:probe_edit', 'toy:probe_return', PLANS['probe']['actions'][1], PLANS['probe'], index=1)
    remember('pending_probe', memory)
    acquire(memory, entry, 'packet', 'toy:probe_edit', 'toy:probe_return', PLANS['probe']['actions'][1])
    assert len(memory.respondent_models) == 1 and len(memory.input_supports) == 1
    remember('respondents', memory)

    PLANS['respondents'] = propose('robust_four_model_composition', state='respondents', view='toy:probe_return', remaining=5)
    assert PLANS['respondents'] and PLANS['respondents']['program_composition_plan'].get('respondent_predictions')
    PLANS['common_respondents'] = propose('common_four_model_composition', operation='common', state='respondents', view='toy:probe_return', remaining=5)
    memory, entry = journal('stationary_extension_is_an_exact_context_refusal', 'respondents')
    acquire(memory, entry, 'record', 'toy:probe_return', 'toy:stationary', PLANS['respondents']['actions'][0], PLANS['respondents'])
    assert len(memory.extension_refusals) == 1 and 2 not in memory.composition_refuted_epochs
    remember('extension_refused', memory)
    PLANS['access'] = propose('replacement_targets_measured_input_appearance', state='extension_refused', view='toy:stationary', remaining=5)
    assert PLANS['access'], 'The observed support should permit an experimental short replacement'
    PLANS['common_access'] = propose('common_replacement_support', operation='common', state='extension_refused', view='toy:stationary', remaining=5)

    PLANS['repeat'] = propose('repeated_conditional_reduction', state='fitted', view='toy:repeat_before', remaining=5)
    assert PLANS['repeat'] and len(PLANS['repeat']['program_composition_plan']['turns']) == 2
    memory, entry = journal('entire_return_projection_preserves_continuation', 'fitted')
    acquire(memory, entry, 'record', 'toy:repeat_before', 'toy:repeat_middle', PLANS['repeat']['actions'][0], PLANS['repeat'])
    remember('continuation', memory)
    PLANS['continuation'] = propose('exact_matched_return_continues_without_search', state='continuation', view='toy:repeat_middle')
    assert PLANS['continuation']['program_composition_plan']['mode'] == 'execute'
    acquire(memory, entry, 'record', 'toy:repeat_middle', 'toy:repeat_boundary', PLANS['continuation']['actions'][0], PLANS['continuation'])
    remember('boundary', memory)

    additional_contracts(model)
    actual_public_trace()
    finish(model)


def additional_contracts(model):
    first = SCENES['toy:marked']['rows']; edited = SCENES['toy:edited']['rows']
    alignment = STATES['fitted']['projection']['program_events'][-1]['alignment']
    members = collection_scene(edited)['members']; previous = collection_scene(first)['members']
    geometry = model['editor_geometry']; exclusions = [geometry['member_column'], geometry['footer']]
    packet = SCENES['toy:epoch2']['public']['frame_packet']
    layout = editor(edited, model)

    # Geometry, fitted grammar and exact hypothesis identity, including the
    # Python float-bearing record embedded in every model, plan and event.
    for name, word, shape, step in [
        ('empty_word', [], SHAPE, [0, 1]), ('extruded_word', [1, 8, 6, 2], SHAPE, [0, 1]),
        ('opposite_extrusion', [2, 7, 1], SHAPE, [-1, 0]),
        ('overlap_top_word_wins', [1, 2, 6], [[0, 0], [1, 0]], [0, 0]),
    ]: math_case(name, 'render_layers', [word, shape, step])
    layer_args = [first, edited, previous, members, SHAPE, exclusions]
    math_case('edit_fits_layer_offset', 'fit_layer_offset', layer_args)
    math_case('stationary_edit_has_no_layer_offset', 'fit_layer_offset', [edited, edited, members, members, SHAPE, exclusions])
    math_case('top_palette_change_is_not_bound', 'fit_layer_offset', [first, edited, previous, [{**members[0], 'color': 2}, *members[1:]], SHAPE, exclusions])
    extra = copy.deepcopy(edited); paint_word(extra, [31, 12], [1])
    math_case('two_matching_tops_do_not_fit_one_bearer', 'fit_layer_offset', [first, extra, previous, members, SHAPE, exclusions])
    math_case('observed_operators', 'translation_candidates', [alignment])
    glyph = math_case('glyph_grammar_fitted_from_phases', 'fit_glyph_vectors', [alignment])
    few = copy.deepcopy(alignment); few['phases'] = few['phases'][:1]
    math_case('one_translation_cannot_fit_a_plane', 'fit_glyph_vectors', [few])
    fractional = copy.deepcopy(alignment)
    for phase in fractional['phases']:
        for motion in phase['effect'].get('translations', []): motion['vector'] = [v // 4 for v in motion['vector']]
    half = math_case('fractional_matrix_is_retained', 'fit_glyph_vectors', [fractional])
    assert half and half['matrix'] == [[0.5, 0.0], [0.0, 0.5]]
    fractional_center = copy.deepcopy(alignment)
    holes = [(0, 0), (3, 0), (0, 3), (2, 2)]; marks = {1: (3, 0), 2: (0, 3), 6: (0, 0), 7: (2, 2)}
    for control in fractional_center['editor_geometry']['controls']:
        label = control['color']; control['patch'] = [[label] * 5 for _ in range(5)]
        for x, y in holes: control['patch'][y][x] = 0 if label == 8 or (x, y) == marks[label] else 3
    for phase in fractional_center['phases']:
        for motion in phase['effect'].get('translations', []): motion['vector'] = [int(4 * (v - 1.25)) for v in marks[phase['label']]]
    centered = math_case('fractional_glyph_center_is_retained', 'fit_glyph_vectors', [fractional_center])
    assert centered and centered['center'] == [1.25, 1.25]
    for name, value in [('fitted_glyph', glyph), ('fractional_matrix', half), ('fractional_center', centered),
                        ('nested_grammar_in_event', {'kind': 'fitted_program_composition', 'model': model}),
                        ('nested_fractional_grammar', {'model': {'glyphs': centered}, 'evidence': ['public:\u00e9']})]:
        IDENTITIES.append({'id': name, 'value': plain(value), 'canonical': json.dumps(value, sort_keys=True, separators=(',', ':')), 'digest': identity(value)})
    for i, value in enumerate([0.0, -0.0, 1.0, -2.0, 0.5, -0.125, 1e-4, 1e-5, 1e-7, 1e15, 1e16,
                               1e20, 1e21, -3.141592653589793, 5e-324, 1.7976931348623157e308]):
        FLOATS.append({'id': str(i), 'value': value, 'expected': json.dumps(value)})

    fit_args = [alignment, first, edited, previous, members, edited, packet]
    assert math_case('public_edit_and_scoring_packet_fit_full_model', 'fit_composition_model', fit_args, {'official_progress': True}) == model
    math_case('score_evidence_required_for_composition_model', 'fit_composition_model', fit_args, {'official_progress': False})
    no_role = copy.deepcopy(alignment); no_role['candidate_roles'] = []
    math_case('no_operand_role_no_program_model', 'fit_composition_model', [no_role, *fit_args[1:]], {'official_progress': True})
    for name, rows in [('current_word_bodies', edited), ('empty_visible_inventory', SCENES['toy:blank']['rows']),
                       ('same_palette_layers', SCENES['toy:repeat_before']['rows'])]:
        math_case(name, 'decode_stacks', [rows, model['layer'], set(LABELS), exclusions])
    math_case('excluded_body_is_not_a_candidate', 'decode_stacks', [edited, model['layer'], set(LABELS), [*exclusions, [10, 0, 37, 30]]])
    for name, point, origin, basis in [('basis_positive', [18, 16], [14, 12], [[4, 0], [0, 4]]),
        ('basis_negative_determinant', [6, 4], [14, 12], [[0, 4], [4, 0]]),
        ('basis_outside_lattice', [15, 12], [14, 12], [[4, 0], [0, 4]]),
        ('oblique_basis', [-3, 8], [0, 0], [[2, 1], [1, 2]])]:
        math_case(name, 'coordinates', [point, origin, basis])
    objects = world(edited, model)
    math_case('conservative_observed_surface', 'surface', [edited, model, objects, [18, 12]])
    math_case('no_appearance_and_no_bodies_no_surface', 'surface', [edited, {**model, 'surface_templates': []}, [], [18, 12]])
    changed_surface = copy.deepcopy(edited); rect(changed_surface, [22, 20, 24, 22], 4)
    math_case('unknown_interior_is_excluded', 'surface', [changed_surface, model, world(changed_surface, model), [18, 12]])

    # The direct helpers never infer an unseen operator or a missing support.
    repeated = PLANS['repeat']['program_composition_plan']; field = repeated['field']; target = repeated['targets']
    simulation = [[6, 8, 1], repeated['own_base'], target, model, field, 5]
    math_case('two_conditional_reduction_turns', 'simulate_word', simulation)
    math_case('insufficient_turn_budget', 'simulate_word', [*simulation[:5], 1])
    math_case('unvalidated_respondent_cancels_static_prediction', 'simulate_word', [simulation[0], simulation[1], [{**target[0], 'word': [6, 8]}], *simulation[3:]])
    math_case('unknown_operator_does_not_execute', 'simulate_word', [[99], *simulation[1:]])
    math_case('no_progress_cycle_is_rejected', 'simulate_word', [[6, 1], *simulation[1:]])
    missing = copy.deepcopy(field); missing['points'] = [p for p in missing['points'] if p != [14, 12]]
    math_case('unmatched_interior_never_walkable', 'simulate_word', [*simulation[:4], missing, 5])
    math_case('occupied_destination_is_rejected', 'simulate_word', [[6], repeated['own_base'], [{**target[0], 'base': [14, 12]}], model, field, 5])
    search_args = [[1, 8, 6], repeated['own_base'], target, model, field]
    for name, options in [('prefix_preserving_word_search', {'max_new_actions': 5, 'deadline': DEADLINE}),
        ('program_search_zero_budget', {'max_new_actions': 0, 'deadline': DEADLINE}),
        ('program_search_expired_deadline', {'max_new_actions': 5, 'deadline': 0})]:
        math_case(name, 'search_program', search_args, options)
    math_case('program_search_preserves_unvalidated_respondent_refusal', 'search_program', [search_args[0], search_args[1], [{**target[0], 'word': [6]}], *search_args[3:]], {'max_new_actions': 5, 'deadline': DEADLINE})
    respondents = PLANS['respondents']['program_composition_plan']; respondent_field = respondents['field']
    respondent_args = [[6, 1], respondents['own_base'], respondents['targets'], model, respondent_field]
    for end in ('top', 'bottom'):
        for scope in ('own_bearer_only', 'all_other_bearers'):
            math_case('respondent_turn_' + end + '_' + scope, 'simulate_respondents', [[1, 6, 1, 8, 8], *respondent_args[1:], 5],
                {'removed_end': end, 'interaction_scope': scope})
    for name, options in [('four_hypothesis_first_feasible', {'max_new_actions': 5}),
        ('four_hypothesis_minimum_external_cost', {'max_new_actions': 5, 'first_feasible': False}),
        ('respondent_member_bound_precedes_enumeration', {'max_new_actions': 5, 'max_members': 1}),
        ('respondent_deadline_is_not_unknown', {'max_new_actions': 5, 'deadline': 0}),
        ('respondent_access_is_experimental', {'max_new_actions': 5, 'access_sites': [[18, 16]], 'max_members': 3})]:
        math_case(name, 'search_respondents', respondent_args, {'deadline': DEADLINE, **options})
    for name, options in [('replacement_under_count_hypothesis', {'max_new_actions': 5, 'max_members': 2}),
        ('replacement_can_seek_input_support', {'max_new_actions': 5, 'max_members': 2, 'access_sites': PLANS['access']['program_composition_plan']['input_access']['sites']}),
        ('replacement_deadline_propagates', {'max_new_actions': 5, 'max_members': 2, 'deadline': 0}),
        ('replacement_zero_budget', {'max_new_actions': 0, 'max_members': 2})]:
        math_case(name, 'search_replacement', respondent_args, {'deadline': DEADLINE, **options})

    # Local respondent visibility and input restoration are separate evidence.
    probe = PLANS['probe']['respondent_probe_plan']; probe_before = SCENES['toy:probe_edit']['rows']; probe_frames = SCENES['toy:probe_return']['public']['frame_packet']
    math_case('prospective_own_and_other_translation', 'observe_respondent_packet', [probe, probe_before, probe_frames], {'same_epoch': True})
    math_case('epoch_boundary_excludes_operator_attribution', 'observe_respondent_packet', [probe, probe_before, probe_frames], {'same_epoch': False})
    math_case('stationary_projections_remain_stationary', 'observe_respondent_packet', [probe, probe_before, [probe_before]], {'same_epoch': True})
    partial = raster([], [14, 12], [([47, 12], [6, 8])]); revealed = raster([], [14, 12], [([43, 12], [6, 8])])
    math_case('partly_hidden_word_support', 'support_match', [partial, model, [47, 12], [6, 8]])
    math_case('partial_support_is_not_full_support', 'full_match', [partial, model, [47, 12], [6, 8]])
    math_case('fully_revealed_support', 'full_match', [revealed, model, [43, 12], [6, 8]])
    math_case('unexplained_hidden_translation_is_retrospective', 'observe_respondent_packet', [{'model': model, 'candidates': []}, partial, [revealed]], {'same_epoch': True})
    math_case('empty_word_has_no_support', 'support_match', [edited, model, [18, 12], []])
    math_case('observed_departure_and_return_input_support', 'learn_input_support', [probe, probe_before, probe_frames])
    math_case('input_support_requires_a_packet', 'learn_input_support', [probe, probe_before, []])
    math_case('input_support_requires_own_prediction', 'learn_input_support', [{**probe, 'own_prediction': None}, probe_before, probe_frames])
    math_case('input_support_requires_returned_controls', 'learn_input_support', [probe, probe_before, probe_frames[:1]])
    math_case('input_support_requires_observed_departure', 'learn_input_support', [probe, probe_before, [probe_before]])
    support = STATES['respondents']['projection']['input_supports'][0]['support']
    math_case('candidate_input_supports_revalidate_appearance', 'candidate_sites', [SCENES['toy:probe_return']['rows'], respondent_field, support, [14, 12]])

    math_case('current_editor_geometry', 'editor', [edited, model])
    translated = [[0] * 48 for _ in range(48)]
    for y, row in enumerate(edited):
        for x, color in enumerate(row):
            if x + 2 < 48 and y + 1 < 48: translated[y + 1][x + 2] = color
    math_case('translated_editor_remeasured', 'editor', [translated, model])
    altered = copy.deepcopy(edited); altered[33][1] = 4
    math_case('changed_control_glyph_is_not_rebound', 'editor', [altered, model])
    math_case('current_projected_members', 'projected_members', [edited, layout, set(LABELS)])
    math_case('current_world_decoding', 'world', [edited, model])
    math_case('current_whole_word_matches', 'word_at', [edited, model, [18, 12], [1, 8, 6, 2]])
    math_case('word_mismatch_does_not_bind', 'word_at', [edited, model, [18, 12], [2, 8, 6, 1]])

    # Exact selection, prefix guards and complete common point support.
    scene('toy:insert_mark', raster(marked_control=8))
    scene('toy:inserted', raster([8, 1, 8, 6, 2]))
    scene('toy:empty_collection', raster([], [14, 12], [([26, 12], [8])]), epoch=2, score=1)
    scene('toy:one_inserted', raster([2], [14, 12], [([26, 12], [8])]), epoch=2, score=1)
    PLANS['insert'] = propose('emphasized_control_insertion', operation='marked', view='toy:insert_mark')
    PLANS['empty_bind'] = propose('empty_collection_binds_observed_phase_order', state='fitted', view='toy:empty_collection')
    assert PLANS['empty_bind']['program_composition_plan']['word'] == [2]
    for name, kwargs in [
        ('public_stck_initial_exact_question', {'operation': 'common', 'view': 'public:stck_initial'}),
        ('blank_has_no_marked_collection', {'operation': 'marked', 'view': 'toy:blank'}),
        ('marked_point_requires_available_action', {'operation': 'marked', 'observation_patch': {'available_action_refs': ['ACTION5']}}),
        ('execution_requires_one_discrete_input', {'operation': 'marked', 'state': 'edited', 'view': 'toy:edited', 'observation_patch': {'available_action_refs': ['ACTION1', 'ACTION5', 'ACTION6']}}),
        ('no_discrete_input_no_execution', {'operation': 'marked', 'state': 'edited', 'view': 'toy:edited', 'observation_patch': {'available_action_refs': ['ACTION6']}}),
        ('unfitted_program_declines', {'view': 'toy:edited'}),
        ('common_empty_budget_precedes_model_deadline', {'operation': 'common', 'state': 'fitted', 'remaining': 0, 'deadline': None}),
        ('common_missing_model_deadline_rejected', {'operation': 'common', 'state': 'fitted', 'deadline': None}),
        ('cold_marked_question_needs_no_model_deadline', {'operation': 'common', 'deadline': None}),
        ('probe_requires_two_prefix_slots', {'state': 'fitted', 'view': 'toy:epoch2', 'maximum': 1}),
        ('whole_constructed_prefix_must_fit', {'state': 'respondents', 'view': 'toy:probe_return', 'remaining': 5, 'maximum': 3}),
        ('empty_binding_raw_source_ignores_zero_prefix', {'state': 'fitted', 'view': 'toy:empty_collection', 'maximum': 0}),
        ('empty_binding_requires_point_action', {'state': 'fitted', 'view': 'toy:empty_collection', 'observation_patch': {'available_action_refs': ['ACTION5']}}),
        ('expired_program_search_declines', {'state': 'fitted', 'view': 'toy:repeat_before', 'deadline': 0}),
        ('expired_respondent_search_declines', {'state': 'respondents', 'view': 'toy:probe_return', 'deadline': 0}),
    ]: propose(name, **kwargs)

    for plan, name, state_id in [('marked', 'marked', 'empty'), ('probe', 'probe', 'fitted'), ('repeat', 'program', 'fitted')]:
        before = {'marked': 'toy:marked', 'probe': 'toy:epoch2', 'repeat': 'toy:repeat_before'}[plan]
        guard(name + '_current_context', 'before', plan, before, state=state_id)
        for suffix, patch_meta in [('epoch_changed', {'epoch': 99}), ('score_changed', {'score': 99}),
            ('reference_changed', {'observation_ref': 'outside'}), ('action_unavailable', {'available': []})]:
            guard(name + '_' + suffix, 'before', plan, before, state=state_id, meta_patch=patch_meta)
    guard('marked_step_index_is_zero_only', 'before', 'marked', 'toy:marked', index=1)
    guard('marked_raster_changed', 'before', 'marked', 'toy:edited', meta_patch={'observation_ref': SCENES['toy:marked']['observation']['observation_ref']})
    guard('marked_removal_confirmed', 'after', 'marked', 'toy:marked', 'toy:edited')
    guard('marked_removal_stationary_refuted', 'after', 'marked', 'toy:marked', 'toy:marked')
    guard('marked_insert_confirmed', 'after', 'insert', 'toy:insert_mark', 'toy:inserted')
    guard('marked_execution_is_unmodelled', 'after', 'execute', 'toy:edited', 'toy:edited', state='edited')
    guard('marked_official_boundary_seals', 'after', 'execute', 'toy:edited', 'toy:epoch2', state='edited')
    guard('probe_edit_bound_after_insertion', 'before', 'probe', 'toy:probe_edit', state='fitted', index=1)
    guard('probe_edit_matches', 'after', 'probe', 'toy:epoch2', 'toy:probe_edit', state='fitted')
    guard('probe_edit_stationary_refuted', 'after', 'probe', 'toy:epoch2', 'toy:epoch2', state='fitted')
    guard('probe_execution_requires_reconciliation', 'after', 'probe', 'toy:probe_edit', 'toy:probe_return', state='fitted', index=1)
    guard('program_complete_return_matches', 'after', 'repeat', 'toy:repeat_before', 'toy:repeat_middle', state='fitted')
    guard('program_stationary_return_refutes', 'after', 'repeat', 'toy:repeat_before', 'toy:repeat_before', state='fitted')
    guard('program_empty_binding_edit_matches', 'after', 'empty_bind', 'toy:empty_collection', 'toy:one_inserted', state='fitted')
    guard('exact_refusal_blocks_only_same_context', 'before', 'respondents', 'toy:probe_return', state='extension_refused')
    for label, meta_patch in [('WIN', {'state': 'WIN'}), ('GAME_OVER', {'state': 'GAME_OVER'}), ('epoch', {'epoch': 99}), ('score', {'score': 99})]:
        guard('program_official_boundary_' + label, 'after', 'repeat', 'toy:repeat_before', 'toy:repeat_middle', state='fitted', meta_patch=meta_patch)

    for plan, view in [('common_marked', 'toy:marked'), ('common_probe', 'toy:epoch2'),
                       ('common_respondents', 'toy:probe_return'), ('common_access', 'toy:stationary')]:
        bind_case(plan + '_current_support', plan, view)
        bind_case(plan + '_unobserved_domain', plan, view, observed=False)
        bind_case(plan + '_changed_point', plan, view, lambda p: p['steps'][0]['point_support'].update(point=[0, 0]))

    memory, entry = journal('marked_refutation_blocks_only_its_epoch')
    acquire(memory, entry, 'record', 'toy:marked', 'toy:marked', PLANS['marked']['actions'][0], PLANS['marked'])
    remember('marked_refuted', memory)
    propose('refuted_marked_edit_declines', operation='marked', state='marked_refuted')
    propose('old_epoch_refutation_is_not_new_epoch_authority', operation='marked', state='marked_refuted', observation_patch={'level_epoch': 2})
    memory, entry = journal('program_mismatch_refutes_current_epoch', 'fitted')
    acquire(memory, entry, 'record', 'toy:repeat_before', 'toy:repeat_before', PLANS['repeat']['actions'][0], PLANS['repeat'])
    remember('program_refuted', memory)
    propose('refuted_program_declines', state='program_refuted', view='toy:repeat_before')

    for plan_name, state_id, initial_scene in [('respondents', 'respondents', 'toy:probe_return'), ('access', 'extension_refused', 'toy:stationary')]:
        plan = PLANS[plan_name]['program_composition_plan']; memory, entry = journal(plan_name + '_entire_prefix_reconciliation', state_id)
        before = initial_scene
        for index, step in enumerate(plan['steps']):
            if step['mode'] == 'execute':
                turn = plan['respondent_predictions'][0]['turns'][0]
                later = raster(plan['word'], turn['base'], [(t['base'], t['word']) for t in turn['targets'] if t['word']])
            else: later = raster(step['after_word'], plan['own_base'], [(t['base'], t['word']) for t in plan['targets']])
            after = scene(plan_name + ':step:' + str(index), later, epoch=2, score=1)
            guard(plan_name + '_prefix_' + str(index) + '_before', 'before', plan_name, before, state=state_id, index=index)
            guard(plan_name + '_prefix_' + str(index) + '_after', 'after', plan_name, before, after, state=state_id, index=index)
            acquire(memory, entry, 'record', before, after, step['action'], PLANS[plan_name], index=index)
            before = after
        remember(plan_name + '_complete', memory)
        assert memory.respondent_events[-1]['kind'] == 'respondent_composition_reconciled'

    for journal_entry in list(JOURNALS):
        transitions = [(step['before'], step['after'], step['proposal'], step['index'], step['command'])
            for step in journal_entry['steps'] if step['operation'] == 'record']
        common_journal('unfiltered_common_' + journal_entry['id'], transitions, journal_entry['initialState'])


def finish(model):
    manifest = json.loads((ROOT / 'reference/v6' / COMMIT / 'manifest.json').read_text()); hashes = {}
    for module in list(sys.modules.values()):
        filename = getattr(module, '__file__', None)
        if not filename: continue
        filename = Path(filename).resolve()
        if filename.suffix != '.py' or not filename.is_relative_to(SOURCE): continue
        relative = str(filename.relative_to(SOURCE)); digest = hashlib.sha256(filename.read_bytes()).hexdigest()
        assert manifest['files'][relative]['sha256'] == digest, relative
        hashes[relative] = digest
    result = {'schema': 'logos-engine.v6.program-composition-oracle.v1', 'sourceCommit': COMMIT, 'sourceModified': False,
        'qualification': 'Unchanged original functions with full raw ancestor returns retained. Controlled public rasters and source-fitted models are contract evidence, not successful-game evidence. No game module, private state or level definition is imported.',
        'sourceHashes': dict(sorted(hashes.items())), 'policy': {'recall': CONFIG['window_constraints']},
        'scenes': SCENES, 'states': STATES, 'plans': PLANS, 'mathCases': CASES, 'model': model,
        'journals': JOURNALS, 'proposalCases': PROPOSALS, 'guardCases': GUARDS, 'bindCases': BINDS, 'commonJournals': COMMON,
        'identityCases': IDENTITIES, 'floatCases': FLOATS,
        'publicInputs': PUBLIC_INPUTS,
        'sourceLineCoverage': {name: sorted(value) for name, value in sorted(COVERED.items())},
        'generator': str(Path(__file__).relative_to(ROOT)), 'generatorSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    output = ROOT / 'tests/fixtures/v6-program-composition-reference.json.gz'
    with output.open('wb') as raw:
        with gzip.GzipFile(fileobj=raw, mode='wb', filename='', mtime=0) as stream:
            stream.write(json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode())
    print(json.dumps({'path': str(output.relative_to(ROOT)), 'scenes': len(SCENES), 'states': len(STATES),
        'mathCases': len(CASES), 'journals': len(JOURNALS), 'acquisitions': sum(len(row['steps']) for row in JOURNALS),
        'proposals': len(PROPOSALS), 'guards': len(GUARDS), 'binds': len(BINDS), 'sourceFiles': len(hashes),
        'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest()}))


if __name__ == '__main__': main()
