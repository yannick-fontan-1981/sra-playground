#!/usr/bin/env python3
"""Development oracle for the unchanged pinned V6 FacetExamples component.

Synthetic public images and independently specified responses are measured by
its original observer. Finite stencil inputs, state interventions and malformed
observations are identified separately. No game engine or native port is used.
"""
from __future__ import annotations

import argparse
from collections.abc import Mapping
from copy import deepcopy
from fractions import Fraction
import gzip
import hashlib
import json
from math import floor
from pathlib import Path
import sys
from types import SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
REF = ROOT / 'reference/v6' / COMMIT / 'source'
SCOPE = 'original-facet-examples-synthetic'
sys.path[:0] = [str(REF / 'agents/yf_arc3_v6/laya_proto'), str(REF)]
from neutral_observer import measure
from observed_input_domain import ObservedInputDomain
from terminal_composition import identity
from agents.yf_arc3_v6.morphology_policy.facet_examples.family import FacetExamples
from agents.yf_arc3_v6.morphology_policy.facet_examples.geometry import inside, box, shape, center, rectangles, project
from agents.yf_arc3_v6.morphology_policy.facet_examples.compound import example, acquire_seed, reference_group, plan
from agents.yf_arc3_v6.morphology_policy.facet_examples.stencils import render, bounds, compare, candidates


def plain(value):
    def transport(item):
        if isinstance(item, Mapping): return dict(item)
        raise TypeError(f'Unsupported fixture transport {type(item).__name__}')
    return json.loads(json.dumps(value, separators=(',', ':'), default=transport))


def state(family):
    return plain(family.state())


def packet(rows, revision=0, epoch=1, completed=0, controls=None):
    return SimpleNamespace(frame_rows=deepcopy(rows), frame_packet=[deepcopy(rows)],
        level=epoch, levels_completed=completed, state='NOT_FINISHED', step_index=revision,
        available_action_refs=['ACTION5', 'ACTION6'] if controls is None else list(controls),
        frame_hash=hashlib.sha256(json.dumps(rows, separators=(',', ':')).encode()).hexdigest()[:16])


def observe(public):
    return measure(public, public.step_index, SCOPE)[0]


def fill(rows, rectangle, value):
    l, t, r, b = rectangle
    for y in range(t, b + 1):
        rows[y][l:r + 1] = [value] * (r - l + 1)


def frame(rows, rectangle, value):
    l, t, r, b = rectangle
    for edge in ([l, t, r, t], [l, b, r, b], [l, t, l, b], [r, t, r, b]):
        fill(rows, edge, value)


class Interface:
    """Rendered neutral fixture; response geometry does not inspect a proposal."""
    def __init__(self):
        self.world = [1, 1, 39, 62]
        self.control = [43, 1, 62, 22]
        self.revision, self.epoch, self.completed = 0, 1, 0
        self.available = ['ACTION5', 'ACTION6']
        self.phase = 'empty'
        self.height = 0
        self.reference = None
        self.world_image = None
        self.changes = []
        self.omit_world = self.omit_control = self.omit_reference = False
        self.extra_seed = False
        self.value_mapping = {}

    def rows(self):
        rows = [[0] * 64 for _ in range(64)]
        if not self.omit_world:
            frame(rows, self.world, 8)
        if not self.omit_control:
            frame(rows, self.control, 9)
            fill(rows, [49, 5, 56, 6], 3)
            fill(rows, [47, 7, 50, 10], 4)
            fill(rows, [55, 7, 58, 10], 5)
        if not self.omit_reference:
            if self.reference is None:
                fill(rows, [49, 28, 52, 28], 3)
                fill(rows, [48, 29, 49, 40], 4)
                fill(rows, [52, 29, 53, 40], 5)
            else:
                for y, row in enumerate(self.reference):
                    for x, value in enumerate(row):
                        rows[27 + y][44 + x] = value
        if self.world_image is not None:
            for (x, y), value in self.world_image.items():
                rows[y][x] = value
        elif self.phase == 'empty':
            frame(rows, [15, 39, 24, 42], 7)
            if self.extra_seed:
                frame(rows, [5, 39, 14, 42], 7)
        else:
            top = 40 - self.height
            fill(rows, [16, top, 23, top + 1], 3)
            fill(rows, [14, top + 2, 17, 45], 4)
            fill(rows, [22, top + 2, 25, 45], 5)
        for x, y, value in self.changes:
            rows[y][x] = value
        if self.value_mapping:
            rows = [[self.value_mapping.get(v, v) for v in row] for row in rows]
        return rows

    def public(self):
        return packet(self.rows(), self.revision, self.epoch, self.completed, self.available)

    def respond(self, response):
        # These transitions are declared independently of the selected command.
        if response == 'seed':
            self.phase = 'filled'
        elif response == 'extend':
            self.height += 2
        elif response == 'extend-four':
            self.height += 4
        elif response == 'outside':
            self.height += 2
            self.changes.append([63, 63, 11])
        elif response == 'unexplained':
            self.phase = 'filled'
            self.changes.extend([[18, 40 - self.height, 11], [18, 41 - self.height, 11]])
        elif response == 'boundary':
            self.height += 2
            self.epoch += 1
            self.completed += 1
        elif response != 'unchanged':
            raise ValueError(response)
        self.revision += 1


def source_step(family, world, response=None, *, remaining=80):
    before = world.public(); obs = observe(before)
    inputs = ObservedInputDomain(250).candidates(obs)
    row = {'stateBefore': state(family), 'beforePublic': vars(before), 'beforeObservation': obs,
        'inputs': inputs, 'remaining': remaining}
    proposal = family.propose(obs, before.frame_rows, inputs, remaining)
    row.update(proposal=deepcopy(proposal), stateAfterPropose=state(family))
    if proposal is None or response is None:
        return plain(row)
    family.bind(proposal, ObservedInputDomain(250))
    row.update(boundProposal=deepcopy(proposal), beforeGuard=family.before(proposal, 0, before, obs))
    command = deepcopy(proposal['actions'][0])
    world.respond(response)
    after = world.public(); second = observe(after)
    row.update(command=command, afterPublic=vars(after), afterObservation=second,
        afterGuard=family.after(proposal, 0, obs, second, before.frame_rows, after.frame_rows),
        record=family.record(obs, second, command, before.frame_rows, after.frame_rows, proposal, 0),
        stateAfter=state(family))
    return plain(row)


def initial_cases():
    result = []
    def add(label, world=None, *, remaining=80, inputs_override=None, corrupt=None):
        world = world or Interface(); public = world.public(); observation = observe(public)
        if corrupt == 'duplicate-control-frame':
            control = next(e for e in rectangles(observation) if e['bbox'] == world.control)
            observation['entities'].append({**deepcopy(control), 'id': control['id'] + ':duplicate'})
        elif corrupt == 'cap-area-below-three':
            next(e for e in observation['entities'] if e['bbox'] == [49, 5, 56, 6])['area'] = 2
        family = FacetExamples()
        inputs = ObservedInputDomain(250).candidates(observation) if inputs_override is None else inputs_override
        projection = project(observation, public.frame_rows)
        result.append(plain({'id': label, 'observationMode': 'synthetic-observation-corruption' if corrupt else 'original-public-measurement',
            'public': vars(public), 'observation': observation, 'inputs': inputs, 'remaining': remaining,
            'rectangles': rectangles(observation), 'projection': projection, 'example': example(observation, public.frame_rows),
            'proposal': family.propose(observation, public.frame_rows, inputs, remaining), 'state': state(family)}))
    add('congruent-empty-face')
    filled = Interface(); filled.phase = 'filled'; add('current-cap-with-two-short-sides', filled)
    add('candidate-list-is-not-a-source-prerequisite', inputs_override=[])
    add('remaining-zero', remaining=0)
    no_click = Interface(); no_click.available = ['ACTION5']; add('action6-unavailable', no_click)
    empty_actions = Interface(); empty_actions.available = []; add('all-actions-unavailable', empty_actions)
    no_world = Interface(); no_world.omit_world = True; add('no-world-frame', no_world)
    no_control = Interface(); no_control.omit_control = True; add('no-filled-example', no_control)
    no_reference = Interface(); no_reference.omit_reference = True; add('no-separate-reference', no_reference)
    wrong_seed = Interface(); wrong_seed.changes = [[16, 40, 7]]; add('noncongruent-empty-face', wrong_seed)
    ambiguous = Interface(); add('duplicate-example-frame-ambiguity', ambiguous, corrupt='duplicate-control-frame')
    add('example-part-area-too-small', corrupt='cap-area-below-three')
    tied = Interface(); tied.extra_seed = True; add('multiple-seed-margins-retain-source-ranking', tied)
    contaminated = Interface(); contaminated.changes = [[3, 3, 3]]; add('world-palette-with-incomplete-face-set', contaminated)
    low = Interface(); low.phase = 'filled'; low.height = 22; add('visible-height-already-sufficient', low)
    renamed = Interface(); renamed.value_mapping = {3:12,4:10,5:2}; add('palette-values-are-descriptors-not-rules', renamed)
    return result


def simple_sessions():
    result = []
    for label, responses in [
        ('seed-extension-boundary', ['seed', 'extend', 'boundary']),
        ('failed-current-trial', ['unchanged']),
        ('discriminating-extension-two', ['seed', 'extend']),
        ('discriminating-extension-four', ['seed', 'extend-four']),
        ('outside-change-refutes-local-method', ['seed', 'extend', 'outside']),
        ('unexplained-cap-change', ['seed', 'extend', 'unexplained']),
    ]:
        family = FacetExamples(); world = Interface(); steps = []
        for response in responses:
            row = source_step(family, world, response)
            steps.append(row)
            if row['proposal'] is None:
                break
        steps.append(source_step(family, world))
        result.append({'id': label, 'origin': 'cold-original-owner', 'steps': steps})
    return result


def record_variants(sessions):
    seed = sessions[0]['steps'][0]
    cap = sessions[0]['steps'][2]
    result = []
    def add(label, base, after_rows, *, epoch=None, completed=None):
        before = SimpleNamespace(**deepcopy(base['beforePublic']))
        after = packet(after_rows, before.step_index + 1,
            before.level if epoch is None else epoch, before.levels_completed if completed is None else completed)
        second = observe(after)
        family = FacetExamples(); family.restore(deepcopy(base['stateAfterPropose']))
        proposal = deepcopy(base['proposal']); command = deepcopy(base['proposal']['actions'][0])
        event = family.record(base['beforeObservation'], second, command, before.frame_rows, after.frame_rows, proposal, 0)
        saved = state(family); inputs = ObservedInputDomain(250).candidates(second)
        next_proposal = family.propose(second, after.frame_rows, inputs, 60)
        result.append(plain({'id': label, 'origin': 'selected-source-proposal-with-declared-synthetic-return',
            'stateBefore': base['stateAfterPropose'], 'beforePublic': vars(before), 'beforeObservation': base['beforeObservation'],
            'afterPublic': vars(after), 'afterObservation': second, 'proposal': proposal, 'command': command,
            'record': event, 'stateAfter': saved, 'nextInputs': inputs, 'nextRemaining': 60,
            'nextProposal': next_proposal, 'stateAfterNext': state(family)}))
    add('seed-no-visible-effect-suppresses-next-trial', seed, seed['beforePublic']['frame_rows'])
    world = Interface(); world.phase = 'filled'; add('seed-matches-visible-stencil', seed, world.rows())
    world.changes = [[63, 63, 11]]; add('seed-outside-change-does-not-acquire-portable', seed, world.rows())
    world = Interface(); world.phase = 'filled'; world.height = 4; add('observed-upward-cap-and-side-extension', cap, world.rows())
    world.changes = [[63, 63, 11]]; add('outside-contribution-invalidates-current-method', cap, world.rows())
    same = deepcopy(cap['beforePublic']['frame_rows']); add('cap-no-effect-retains-method-and-fails-trial', cap, same)
    changed = deepcopy(same); fill(changed, [14, 46, 17, 47], 4); fill(changed, [22, 46, 25, 47], 5)
    add('changed-side-bottom-is-not-verified-upward-extension', cap, changed)
    changed = deepcopy(same); changed[0][0] = 11
    add('official-boundary-has-precedence-over-outside-change', cap, changed, epoch=2, completed=1)
    add('epoch-change-without-boundary-retains-portable-not-local-method', cap, same, epoch=2)
    changed = deepcopy(same); fill(changed, [14, 38, 25, 45], 0)
    add('unexplained-disappearance-invalidates-current-method', cap, changed)
    return result


def image_rows(image, stamp, placements, scale, ox, oy, background, palette):
    l, t = min(x for x, _ in placements), min(y for _, y in placements)
    r = max(x for x, _ in placements) + len(stamp[0]) - 1
    b = max(y for _, y in placements) + len(stamp) - 1
    width, height = floor((r - l + 1) * scale), floor((b - t + 1) * scale)
    rows = [[image.get((l + floor((x + .5) / float(scale) + ox),
                       t + floor((y + .5) / float(scale) + oy)), background)
             for x in range(width)] for y in range(height)]
    points = [(x, y) for y, row in enumerate(rows) for x, v in enumerate(row) if v in palette]
    if not points:
        return None
    l, t, r, b = bounds(points)
    return [row[l:r + 1] for row in rows[t:b + 1]]


def find_compound_scene(portable, configuration):
    """Bounded fixture synthesis from declared 2D stamps, not a game campaign.

    The original finite enumerator validates the resulting reference. Every
    attempted descriptor/status is retained; no timing or game result is chosen.
    """
    initial = Interface(); pub = initial.public(); model = example(observe(pub), pub.frame_rows)
    assert model is not None
    cap = next(f for f in model['faces'] if f['value'] == portable['cap_value'])
    width = len(model['stamp'][0]); cap_height = max(y for _, y in cap['pixels']) - min(y for _, y in cap['pixels']) + 1
    steps = {cap['value']: portable['up_shift']}
    for f in model['faces']:
        if f['value'] != cap['value']:
            steps[f['value']] = [(-1 if f['point'][0] < cap['point'][0] else 1) * (width - 1) // 2, (cap_height + 1) // 2]
    left, right = steps[4], steps[5]
    patterns = [
        [(0, 0), tuple(right), (2 * right[0], 2 * right[1])],
        [(0, 0), tuple(left), (2 * left[0], 2 * left[1])],
        [(0, 0), tuple(right), (right[0], right[1] - 2)],
        [(0, 0), tuple(left), (left[0], left[1] - 2)],
        [(0, 0), tuple(right)], [(0, 0), tuple(left)],
    ]
    attempted = []; seen = set(); found = None
    for placement_index, placements in enumerate(patterns):
        image = render(model['stamp'], placements, model['background'])
        for scale in (Fraction(1, 2), Fraction(3, 5), Fraction(2, 3), Fraction(3, 4), Fraction(4, 5), Fraction(1)):
            for ox in (0, -.5, .5):
                for oy in (0, -.5, .5):
                    reference = image_rows(image, model['stamp'], placements, scale, ox, oy, model['background'], model['palette'])
                    if not reference or len(reference[0]) > 19 or len(reference) > 35:
                        continue
                    key = json.dumps(reference)
                    if key in seen:
                        continue
                    seen.add(key)
                    result = candidates(reference, model['stamp'], model['faces'], steps, model['background'], model['palette'],
                        len(placements), configuration['maximum_states'], configuration['maximum_sample_denominator'], configuration['sample_offsets'])
                    trial = {'pattern': placement_index, 'placements': plain(placements), 'scale': [scale.numerator, scale.denominator],
                        'sample_offset': [ox, oy], 'reference': reference, 'status': result['status'], 'solutions': len(result['solutions']), 'examined': result['examined']}
                    attempted.append(trial)
                    if result['status'] != 'compatible_minimal_within_model' or len(result['solutions']) != 1 or len(result['solutions'][0]['placements']) < 2:
                        continue
                    world = Interface(); world.reference = reference; world.epoch = 2; world.completed = 1; world.revision = 3
                    public = world.public(); obs = observe(public)
                    current = plan(obs, public.frame_rows, deepcopy(portable), {}, configuration)
                    if current is None or project(obs, public.frame_rows) is not None:
                        trial['familyQualification'] = 'not-a-unique-compound-only-offer'
                        continue
                    trial['familyQualification'] = 'unique-compound-only-offer'
                    found = world
                    break
                if found is not None: break
            if found is not None: break
        if found is not None: break
    assert found is not None, 'Declared finite synthetic references must exercise the original compound family'
    return found, {'kind': 'bounded-synthetic-stencil-reference-search', 'maximumDescriptors': len(patterns) * 6 * 3 * 3,
        'attempts': attempted, 'selectedIndex': len(attempted) - 1, 'actualLateralSteps': plain(steps)}


def compound_step(family, world, response=None):
    before = world.public(); obs = observe(before); inputs = ObservedInputDomain(250).candidates(obs)
    row = {'stateBefore': state(family), 'beforePublic': vars(before), 'beforeObservation': obs, 'inputs': inputs, 'remaining': 60}
    proposal = family.propose(obs, before.frame_rows, inputs, 60)
    row.update(proposal=deepcopy(proposal), stateAfterPropose=state(family))
    if proposal is None or response is None:
        return plain(row)
    family.bind(proposal, ObservedInputDomain(250))
    row.update(boundProposal=deepcopy(proposal), beforeGuard=family.before(proposal, 0, before, obs))
    c = proposal['facet_plan']['projection']['compound']
    # The fixture applies the complete explicitly declared stencil rendering.
    # Its classification and the next decision still come from original Python.
    anchor = c['anchor']; placements = c['solution']['placements'][:c['prefix'] + 1]
    world.world_image = render(family.portable['stamp'], [(x + anchor[0], y + anchor[1]) for x, y in placements], family.portable['background'])
    if response == 'wrong-palette-pixel':
        x, y, value = c['expected_colored_pixels'][0]; world.world_image[x, y] = 11
    elif response == 'outside':
        world.changes.append([63, 63, 11])
    elif response == 'official':
        world.completed += 1; world.epoch += 1
    elif response == 'unchanged':
        world.world_image = {(x, y): v for y, row in enumerate(before.frame_rows) for x, v in enumerate(row) if inside([x, y, x, y], world.world)}
    elif response != 'predicted':
        raise ValueError(response)
    world.revision += 1
    after = world.public(); second = observe(after); command = deepcopy(proposal['actions'][0])
    row.update(command=command, afterPublic=vars(after), afterObservation=second,
        afterGuard=family.after(proposal, 0, obs, second, before.frame_rows, after.frame_rows),
        record=family.record(obs, second, command, before.frame_rows, after.frame_rows, proposal, 0), stateAfter=state(family))
    return plain(row)


def compound_cases(simple):
    learned = simple[0]['steps'][2]['stateAfter']
    assert learned['portable']['up_shift'] == [0, -2] and learned['portable'].get('boundary_ref')
    configuration = FacetExamples().config['compound']
    world, synthesis = find_compound_scene(learned['portable'], configuration)
    sessions = []; variants = []; planners = []
    # The official boundary returns the next scope in its actual public packet.
    # There is no unrecorded observation replacement between adjacent steps.
    cold_family = FacetExamples(); cold_world = Interface()
    cold_steps = [source_step(cold_family, cold_world, 'seed'), source_step(cold_family, cold_world, 'extend')]
    before = cold_world.public(); obs = observe(before); inputs = ObservedInputDomain(250).candidates(obs)
    boundary = {'stateBefore':state(cold_family),'beforePublic':vars(before),'beforeObservation':obs,'inputs':inputs,'remaining':80}
    proposal = cold_family.propose(obs,before.frame_rows,inputs,80)
    assert proposal is not None
    boundary.update(proposal=deepcopy(proposal),stateAfterPropose=state(cold_family))
    cold_family.bind(proposal,ObservedInputDomain(250))
    boundary.update(boundProposal=deepcopy(proposal),beforeGuard=cold_family.before(proposal,0,before,obs))
    after=world.public(); second=observe(after);command=deepcopy(proposal['actions'][0])
    boundary.update(command=command,afterPublic=vars(after),afterObservation=second,
        afterGuard=cold_family.after(proposal,0,obs,second,before.frame_rows,after.frame_rows),
        record=cold_family.record(obs,second,command,before.frame_rows,after.frame_rows,proposal,0),stateAfter=state(cold_family))
    cold_steps.append(plain(boundary));learned=state(cold_family)
    def start():
        family = FacetExamples(); family.restore(deepcopy(learned)); return family, deepcopy(world)
    family, current = start()
    # Preserve the true cold acquisition prefix, followed by the new public scope.
    steps = deepcopy(cold_steps)
    for _ in range(configuration['maximum_units'] + 1):
        row = compound_step(family, current, 'predicted'); steps.append(row)
        if row['proposal'] is None: break
    sessions.append({'id': 'cold-seed-extension-boundary-then-compound-nonacceptance', 'origin': 'cold-original-owner', 'steps': steps})
    for label, response in [('compound-wrong-local-effect', 'wrong-palette-pixel'), ('compound-outside-change', 'outside'),
                            ('compound-unchanged-is-a-refutation', 'unchanged'), ('compound-official-boundary-first', 'official')]:
        family, current = start()
        rows = [compound_step(family, current, response), compound_step(family, current)]
        sessions.append({'id': label, 'origin': 'restored-source-acquired-portable', 'initialState': learned, 'steps': rows})
    public = world.public(); obs = observe(public); inputs = ObservedInputDomain(250).candidates(obs)
    def variant(label, mutate):
        supplied = deepcopy(learned); mutate(supplied)
        family = FacetExamples(); family.restore(supplied)
        proposal = family.propose(obs, public.frame_rows, inputs, 60)
        variants.append(plain({'id': label, 'origin': 'explicit-source-state-ablation', 'stateBefore': supplied,
            'public': vars(public), 'observation': obs, 'inputs': inputs, 'remaining': 60, 'proposal': proposal, 'stateAfter': state(family)}))
    variant('portable-without-seed-is-not-recalled', lambda s: s.update(portable=None))
    variant('portable-without-observed-up-shift-is-not-recalled', lambda s: s['portable'].pop('up_shift'))
    variant('portable-without-official-boundary-is-not-recalled', lambda s: s['portable'].pop('boundary_ref'))
    variant('changed-stamp-invalidates-portable-example', lambda s: s['portable']['stamp'][0].__setitem__(0, 11))
    variant('changed-marker-invalidates-portable-example', lambda s: s['portable'].__setitem__('active_marker', 11))
    variant('unchanged-acquired-portable-is-revalidated', lambda s: None)
    final = next(r for r in steps if r.get('record', {}).get('status') == 'compound_visual_candidate_not_accepted')
    previous = next(r for r in steps if r.get('proposal', {}).get('facet_plan', {}).get('projection', {}).get('compound', {}).get('prefix') == 1)
    repeated_public = deepcopy(previous['beforePublic']); repeated_public['step_index'] += 20
    repeat = SimpleNamespace(**repeated_public); repeat_obs = observe(repeat); repeat_inputs = ObservedInputDomain(250).candidates(repeat_obs)
    for label, clear in [('complete-unaccepted-scope-remains-refuted-after-visible-prefix-return', False), ('removing-only-refutation-reenables-the-same-compound-scope', True)]:
        supplied = deepcopy(final['stateAfter'])
        if clear: supplied['refuted_compounds'] = []
        family = FacetExamples(); family.restore(supplied)
        proposal = family.propose(repeat_obs, repeat.frame_rows, repeat_inputs, 60)
        variants.append(plain({'id': label, 'origin': 'explicit-source-state-ablation' if clear else 'restored-source-refutation-with-public-prefix-reappearance',
            'stateBefore': supplied, 'public': vars(repeat), 'observation': repeat_obs, 'inputs': repeat_inputs, 'remaining': 60,
            'proposal': proposal, 'stateAfter': state(family)}))
    for label, portable in [('acquired-portable', learned['portable']), ('missing-seed', None),
                            ('missing-up-shift', {k:v for k,v in learned['portable'].items() if k != 'up_shift'}),
                            ('missing-boundary', {k:v for k,v in learned['portable'].items() if k != 'boundary_ref'})]:
        cache = {}; expected = plan(obs, public.frame_rows, deepcopy(portable), cache, configuration)
        planners.append(plain({'id': label, 'observation': obs, 'rows': public.frame_rows, 'portable': portable,
            'configuration': configuration, 'expected': expected, 'cache': cache}))
    mapping={3:12,4:10,5:2};mapped_world=deepcopy(world);mapped_world.value_mapping=mapping
    mapped_public=mapped_world.public();mapped_obs=observe(mapped_public);portable=deepcopy(learned['portable'])
    portable['stamp']=[[mapping.get(v,v) for v in row] for row in portable['stamp']]
    for face in portable['faces']:face['value']=mapping.get(face['value'],face['value'])
    portable['palette']=sorted(mapping.get(v,v) for v in portable['palette'])
    portable['cap_value']=mapping.get(portable['cap_value'],portable['cap_value'])
    cache={};expected=plan(mapped_obs,mapped_public.frame_rows,portable,cache,configuration)
    assert expected is not None,'Palette permutation preserves measured compound qualification'
    planners.append(plain({'id':'integer-key-hash-order-with-palette-values-over-nine','observation':mapped_obs,'rows':mapped_public.frame_rows,
        'portable':portable,'configuration':configuration,'expected':expected,'cache':cache}))
    return sessions, variants, planners, synthesis


def stencil_cases():
    render_cases = []
    for label, stamp, placements, background in [
        ('later-visible-stencil-overlays-earlier', [[1,2],[3,0]], [(0,0),(1,0)], 0),
        ('negative-origin-is-preserved', [[1,9],[2,3]], [(0,0),(-2,-1)], 0),
        ('background-does-not-erase-prior-contribution', [[1,0],[0,2]], [(0,0),(1,0)], 0),
    ]:
        image = render(stamp, placements, background)
        render_cases.append(plain({'id': label, 'stamp': stamp, 'placements': placements, 'background': background,
            'expected': [[x,y,v] for (x,y),v in sorted(image.items())], 'bounds': bounds(image)}))
    comparison_cases = []
    def comparison(label, stamp, placements, reference, palette, max_denominator=8, offsets=(-.5,0,.5)):
        image = render(stamp, placements, 0)
        expected = compare(reference, image, stamp, placements, 0, palette, max_denominator, offsets)
        comparison_cases.append(plain({'id': label, 'stamp': stamp, 'placements': placements, 'reference': reference,
            'palette': palette, 'background': 0, 'maxDenominator': max_denominator, 'sampleOffsets': offsets, 'expected': expected}))
    comparison('exact-visible-sample-keeps-offset-alternatives', [[1,2],[3,0]], [(0,0)], [[1,2],[3,0]], [1,2,3])
    comparison('contour-retains-neighbour-color-uncertainty', [[1,9],[2,3]], [(0,0)], [[1,1],[2,3]], [1,2,3])
    comparison('contour-cannot-explain-absent-color', [[1,9],[2,3]], [(0,0)], [[1,8],[2,3]], [1,2,3])
    comparison('fraction-scales-are-reduced-deduplicated-numerically-sorted', [[1]*5 for _ in range(5)], [(0,0)], [[1,1],[1,1]], [1])
    comparison('negative-placement-sampling', [[1,2],[3,0]], [(-2,-3)], [[1,2],[3,0]], [1,2,3])
    comparison('sample-denominator-bound', [[1]*5 for _ in range(5)], [(0,0)], [[1,1],[1,1]], [1], max_denominator=2)
    search_cases = []
    basic_faces = [{'value':1,'pixels':[[0,0]],'point':[0,0]}, {'value':2,'pixels':[[1,0]],'point':[1,0]}, {'value':3,'pixels':[[0,1]],'point':[0,1]}]
    def search(label, stamp, faces, steps, reference, palette, max_units=3, max_states=1024):
        args = {'reference':reference,'stamp':stamp,'faces':faces,'steps':{str(k):v for k,v in steps.items()},
            'background':0,'palette':palette,'maxUnits':max_units,'maxStates':max_states,'maxDenominator':8,'sampleOffsets':[-.5,0,.5]}
        expected = candidates(reference,stamp,faces,steps,0,palette,max_units,max_states,8,[-.5,0,.5])
        search_cases.append(plain({'id':label,'arguments':args,'expected':expected}))
    search('single-unit-stops-at-first-compatible-size', [[1,2],[3,0]], basic_faces, {1:[0,-1],2:[1,0],3:[-1,1]}, [[1,2],[3,0]], [1,2,3])
    search('two-unit-visible-continuation', [[1,2],[3,0]], basic_faces, {1:[0,-1],2:[1,0],3:[-1,1]}, [[1,1,2],[3,3,0]], [1,2,3])
    search('state-bound-is-incomplete-not-negative-proof', [[1,2],[3,0]], basic_faces, {1:[0,-1],2:[1,0],3:[-1,1]}, [[1,1,2],[3,3,0]], [1,2,3], max_states=1)
    search('no-compatible-bounded-composition', [[1,2],[3,0]], basic_faces, {2:[1,0]}, [[8]], [1,2,3], max_units=2)
    symmetric_faces = [{'value':2,'pixels':[[0,0]],'point':[0,0]}, {'value':3,'pixels':[[2,0]],'point':[2,0]}]
    search('ambiguous-translated-compositions-all-retained', [[2,1,3]], symmetric_faces, {2:[-3,0],3:[3,0]}, [[2,1,3,2,1,3]], [1,2,3], max_units=2)
    search('bound-with-an-already-found-candidate-remains-incomplete', [[2,1,3]], symmetric_faces, {2:[-3,0],3:[3,0]}, [[2,1,3,2,1,3]], [1,2,3], max_units=2, max_states=2)
    covered_faces = [{'value':1,'pixels':[[0,0],[1,0]],'point':[0,0]}]
    search('covered-port-pixels-cannot-authorize-extension', [[1,2]], covered_faces, {1:[1,0]}, [[1,1,2]], [1,2], max_units=2)
    search('zero-offset-cannot-repeat-an-origin', [[1]], [{'value':1,'pixels':[[0,0]],'point':[0,0]}], {1:[0,0]}, [[1,1]], [1], max_units=3)
    return {'render':render_cases,'compare':comparison_cases,'search':search_cases}


def guards_and_errors(session):
    row = session['steps'][1]; proposal = deepcopy(row['proposal']); public = deepcopy(row['beforePublic']); obs = deepcopy(row['beforeObservation'])
    family = FacetExamples(); family.restore(deepcopy(row['stateAfterPropose'])); result=[]; errors=[]
    def add(label,p=None,pub=None,observation=None):
        p=deepcopy(proposal if p is None else p); pub=deepcopy(public if pub is None else pub); observation=deepcopy(obs if observation is None else observation)
        result.append(plain({'id':label,'proposal':p,'public':pub,'observation':observation,'expected':family.before(p,0,SimpleNamespace(**pub),observation)}))
    add('current')
    for key,value in [('level',99),('levels_completed',99),('frame_hash','different-frame'),('available_action_refs',['ACTION5'])]:
        pub=deepcopy(public);pub[key]=value;add('changed-'+key,pub=pub)
    changed=deepcopy(obs);changed['observation_ref']='foreign';add('changed-observation',observation=changed)
    changed=deepcopy(public);x,y=proposal['facet_plan']['projection']['offer']['point'];changed['frame_rows'][y][x]=11;add('changed-point-value',pub=changed)
    changed=deepcopy(proposal);changed['steps'][0]['action']={'action_ref':'ACTION5'};add('changed-step-command',p=changed)
    changed=deepcopy(proposal);changed['facet_plan']['projection']['offer']['point'][0]+=1;add('changed-measured-offer-point',p=changed)
    changed=deepcopy(proposal);changed['steps'][0]['point_binding']['point'][0]+=1
    for label,operation,p,command,before in [
        ('bind-does-not-repair-a-different-point','bind',changed,row['command'],obs),
        ('selected-record-rejects-another-command','record',proposal,{'action_ref':'ACTION5'},obs),
        ('selected-record-rejects-another-observation','record',proposal,row['command'],{**obs,'observation_ref':'foreign'})]:
        try:
            if operation=='bind':family.bind(p,ObservedInputDomain(250))
            else:family.record(before,row['afterObservation'],command,public['frame_rows'],row['afterPublic']['frame_rows'],p,0)
        except Exception as error:
            errors.append(plain({'id':label,'operation':operation,'proposal':p,'command':command,'observation':before,'errorType':type(error).__name__,'message':str(error)}))
        else:raise AssertionError(label)
    return {'state':row['stateAfterPropose'],'cases':result,'errors':errors,'beforePublic':public,'afterPublic':row['afterPublic'],'afterObservation':row['afterObservation']}


def geometry_cases():
    centers=[]
    for label,bbox,mask in [('equal-distance-prefers-top-then-left',[10,20,11,21],[[1,1],[1,0],[0,1],[0,0]]),
                           ('center-is-an-observed-pixel-not-a-centroid',[4,5,8,9],[[0,0],[4,0],[0,4]]),
                           ('shape-sorts-numerically-by-x-then-y',[0,0,12,12],[[10,1],[2,10],[2,2],[1,12]])]:
        entity={'bbox':bbox,'mask':mask}
        centers.append(plain({'id':label,'entity':entity,'shape':shape(entity),'center':center(entity)}))
    side_values=[]
    for label,values,excluded in [('small-palette',[12,10,2],12),('integer-hash-collisions',[1,33,65],33),
                                  ('copy-delete-branch-over-seven-values',[15,14,13,12,11,10,9,8,7],12),
                                  ('missing-excluded-value',[1,33,65,97,129,161,193,225],2)]:
        side_values.append({'id':label,'values':values,'excluded':excluded,'expected':list(set(values)-{excluded})})
    return {'centers':centers,'sideValues':side_values,
        'sideValuesSource':'family.py: for value in {p[palette_value] for p in old[example_parts]} - {cap[palette_value]}'}


def assertions(fixture):
    initial={r['id']:r for r in fixture['initial']}
    for name in ['congruent-empty-face','current-cap-with-two-short-sides','candidate-list-is-not-a-source-prerequisite','multiple-seed-margins-retain-source-ranking','palette-values-are-descriptors-not-rules']:
        assert initial[name]['proposal'] is not None,name
    for name in ['remaining-zero','action6-unavailable','all-actions-unavailable','no-world-frame','no-filled-example','no-separate-reference','noncongruent-empty-face','duplicate-example-frame-ambiguity','example-part-area-too-small','world-palette-with-incomplete-face-set','visible-height-already-sufficient']:
        assert initial[name]['proposal'] is None,name
    sessions={s['id']:s for s in fixture['sessions']}
    acquired=sessions['seed-extension-boundary']['steps']
    assert acquired[0]['record']['status']=='filled_example_correspondence'
    assert acquired[0]['stateAfter']['portable'] is not None
    assert acquired[1]['record']['status']=='observed_visible_cap_and_side_change'
    assert acquired[1]['stateAfter']['method'] is not None and acquired[1]['stateAfter']['portable']['up_shift']==[0,-2]
    assert acquired[2]['record']['status']=='official_boundary'
    assert acquired[3]['stateAfterPropose']['method'] is None
    assert acquired[3]['stateAfterPropose']['portable']['boundary_ref']==acquired[2]['afterObservation']['observation_ref']
    failed=sessions['failed-current-trial']['steps']
    assert failed[0]['record']['status']=='no_visible_effect' and failed[1]['proposal'] is None
    left,right=[sessions['discriminating-extension-'+s]['steps'] for s in ['two','four']]
    assert left[1]['proposal']==right[1]['proposal']
    assert left[2]['proposal']['actions']!=right[2]['proposal']['actions']
    compound=sessions['cold-seed-extension-boundary-then-compound-nonacceptance']['steps']
    assert any(s.get('record',{}).get('status')=='compound_seed_effect_matched' for s in compound)
    assert any(s.get('record',{}).get('status')=='compound_visual_candidate_not_accepted' for s in compound)
    assert compound[-1]['proposal'] is None
    variants={r['id']:r for r in fixture['stateVariants']}
    assert variants['complete-unaccepted-scope-remains-refuted-after-visible-prefix-return']['proposal'] is None
    assert variants['removing-only-refutation-reenables-the-same-compound-scope']['proposal'] is not None
    assert variants['unchanged-acquired-portable-is-revalidated']['proposal']['facet_plan']['projection'].get('compound')
    searches={r['id']:r['expected'] for r in fixture['stencils']['search']}
    assert searches['state-bound-is-incomplete-not-negative-proof']['status']=='bounded_incomplete'
    assert len(searches['ambiguous-translated-compositions-all-retained']['solutions'])==2
    assert searches['bound-with-an-already-found-candidate-remains-incomplete']['status']=='bounded_incomplete'
    assert searches['bound-with-an-already-found-candidate-remains-incomplete']['solutions']


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out',type=Path,default=ROOT/'tests/fixtures/v6-facet-examples-reference.json.gz')
    args=parser.parse_args()
    family=FacetExamples(); initial=initial_cases(); sessions=simple_sessions(); records=record_variants(sessions)
    compound,variants,planners,synthesis=compound_cases(sessions)
    stencils=stencil_cases(); guards=guards_and_errors(sessions[0])
    paths={Path(m.__file__).resolve() for m in tuple(sys.modules.values()) if getattr(m,'__file__',None) and Path(m.__file__).resolve().is_relative_to(REF)}
    paths.update(REF/'agents/yf_arc3_v6/morphology_policy/facet_examples'/name for name in ['facet_examples.drm','facet_examples.src'])
    sources={str(p.relative_to(REF)):{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(paths)}
    fixture={'provenance':{'commit':COMMIT,'sources':sources,'observationScope':SCOPE,
        'scope':'Unmodified original Python component/SRC execution, synthetic public transitions and finite stencil cases, not router/game parity.',
        'normalization':'Only JSON tuple/list transport; no source proposal, event, candidate, comparison or SRC order is normalized.',
        'limitations':['Synthetic state ablations and malformed observations are individually marked.','Finite reference synthesis does not claim a real game campaign.','No hidden occupancy, exact renderer identification or full caller parity is asserted.']},
        'configuration':family.config,'initial':initial,'sessions':sessions+compound,'records':records,
        'stateVariants':variants,'compoundPlans':planners,'compoundSynthesis':synthesis,'stencils':stencils,'guards':guards,'geometry':geometry_cases()}
    assertions(fixture)
    payload=(json.dumps(plain(fixture),separators=(',',':'))+'\n').encode()
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_bytes(gzip.compress(payload,mtime=0) if args.out.suffix=='.gz' else payload)
    print(json.dumps({'file':str(args.out),'bytes':args.out.stat().st_size,'rawBytes':len(payload),'sources':len(sources),'initial':len(initial),
        'records':len(records),'stateVariants':len(variants),'compoundPlans':len(planners),'compoundSynthesisAttempts':len(synthesis['attempts']),
        'sessions':[{'id':s['id'],'steps':len(s['steps']),'events':[r.get('record',{}).get('status') for r in s['steps']]} for s in sessions+compound]},indent=2))

if __name__=='__main__':main()
