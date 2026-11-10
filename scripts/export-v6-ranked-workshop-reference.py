#!/usr/bin/env python3
"""Original RankedWorkshop oracle on public rasters and explicit component cases.

No game host is opened and no action is dispatched.  The retained initial LKEY
raster is public evidence; subsequent singleton, profile, and palette changes
are deliberately synthetic observations, never claimed as game transitions.
"""
from __future__ import annotations

from collections import Counter
import copy
import gzip
import hashlib
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
sys.dont_write_bytecode = True
CACHE = tempfile.TemporaryDirectory(prefix='ranked-workshop-original-')
sys.pycache_prefix = CACHE.name
MANIFEST = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']


def verify_sources():
    for name, record in MANIFEST.items():
        assert hashlib.sha256((SOURCE / name).read_bytes()).hexdigest() == record['sha256'], name


verify_sources()
sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
from neutral_observer import measure
from agents.yf_arc3_v6.morphology_policy.ranked_workshop.family import RankedWorkshop
from agents.yf_arc3_v6.morphology_policy.ranked_workshop import geometry, methods, preparation
from agents.yf_arc3_v5.capabilities import stem_reliefs, station_profile_scene
from agents.yf_arc3_v5.capabilities.contracts import ComponentDescription, BoundingBox


def plain(value):
    if hasattr(value, 'model_dump'): return plain(value.model_dump())
    if hasattr(value, 'items'): return {str(k): plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)): return [plain(v) for v in value]
    if isinstance(value, (set, frozenset)): return [plain(v) for v in sorted(value)]
    if isinstance(value, SimpleNamespace): return plain(vars(value))
    return value


EXECUTED = Counter()
SOURCE_PREFIX = str(SOURCE) + '/'


def source_profile(frame, event, arg):
    if event == 'call' and frame.f_code.co_filename.startswith(SOURCE_PREFIX):
        EXECUTED[(frame.f_code.co_filename[len(SOURCE_PREFIX):], frame.f_code.co_firstlineno, frame.f_code.co_qualname)] += 1


sys.setprofile(source_profile)
CONFIG = RankedWorkshop().config
INPUTS = [{'action_ref': 'ACTION' + str(n)} for n in (1, 2, 3, 4, 5, 7)]
GEOMETRY_CASES, METHOD_CASES, CASES, SELECTION_CASES = [], [], [], []


def observation(rows, revision=1, epoch=1, available=None):
    packet = SimpleNamespace(frame_rows=rows,
        frame_hash=hashlib.sha256(json.dumps(rows, separators=(',', ':')).encode()).hexdigest()[:16],
        level=epoch, levels_completed=epoch - 1, state='NOT_FINISHED',
        available_action_refs=tuple(available if available is not None else [x['action_ref'] for x in INPUTS]))
    return measure(packet, revision, 'workshop:synthetic')[0]


def source_parts(obs, rows):
    out = []
    height, width = len(rows), len(rows[0])
    for entity in obs['entities']:
        l, t, r, b = entity['bbox']
        relative = tuple((y, x) for x, y in entity['mask'])
        out.append(ComponentDescription(component_id=entity['id'], value=entity['palette_value'],
            pixels=tuple((t+y, l+x) for y, x in relative), relative_pixels=relative,
            bbox=BoundingBox(top=t, left=l, bottom=b, right=r), area=len(relative),
            touches_frame_boundary=l == 0 or t == 0 or r == width-1 or b == height-1))
    return out


def component(points, name='synthetic:relief', value=4):
    points = sorted(set(points)); top, left = map(min, zip(*points)); bottom, right = map(max, zip(*points))
    return ComponentDescription(component_id=name, value=value, pixels=tuple(points),
        relative_pixels=tuple((r-top, c-left) for r, c in points),
        bbox=BoundingBox(top=top, left=left, bottom=bottom, right=right), area=len(points), touches_frame_boundary=False)


def pure_case(destination, name, module, operation, arguments, call_arguments=None):
    row = {'id': name, 'module': module, 'operation': operation, 'arguments': plain(arguments)}
    target = {'geometry': geometry, 'methods': methods, 'preparation': preparation,
              'stem': stem_reliefs, 'scene': station_profile_scene}[module]
    try:
        if operation == 'measure_ranked_cuts': value = target.measure_ranked_cuts(arguments[0], **arguments[1])
        else: value = getattr(target, operation)(*(call_arguments if call_arguments is not None else arguments))
        row['value'] = plain(value)
    except (ValueError, TypeError, KeyError, IndexError, AttributeError) as error:
        row['error'] = {'name': type(error).__name__, 'message': str(error)}
    destination.append(row)
    return row


def family_case(name, operation, arguments, seed=None):
    family = RankedWorkshop()
    if seed is not None: family.restore(copy.deepcopy(seed))
    row = {'id': name, 'operation': operation, 'arguments': plain(arguments), 'seedState': plain(family.state())}
    args = copy.deepcopy(arguments)
    if operation == 'before': args[2] = SimpleNamespace(**args[2])
    method = {'proposeSource': 'propose', 'recordSource': 'record'}.get(operation, operation)
    try: row['value'] = plain(getattr(family, method)(*args))
    except (ValueError, TypeError, KeyError, IndexError, AttributeError) as error:
        row['error'] = {'name': type(error).__name__, 'message': str(error)}
    row['afterState'] = plain(family.state()); CASES.append(row)
    return row


CORPUS_PATH = ROOT / 'tests/fixtures/v6-linked-packet-initial-public.json.gz'
corpus = json.load(gzip.open(CORPUS_PATH, 'rt'))
initial = next(row for row in corpus['games'] if row['game'] == 'LKEY')
BASE = copy.deepcopy(initial['packet']['frame_rows'])
base_obs = observation(BASE)
scene, context = geometry.project(base_obs, BASE, CONFIG)
assert context['station_profile_unenclosed_profile_count'] == 2
assert context['station_profile_inner_singleton_count'] == 0


def toggle(rows, held=True):
    """Add/remove one isolated pixel of the measured marker palette."""
    result = copy.deepcopy(rows)
    obs = observation(rows)
    measured, _ = geometry.project(obs, rows, CONFIG)
    marker = measured['marker_quartets'][0]
    top, left, bottom, right = marker['bbox']; palette = marker['palette_value']
    background = Counter(x for row in rows for x in row).most_common(1)[0][0]
    if held:
        candidates = [(r, c) for r in range(top+1, bottom) for c in range(left+1, right)
            if rows[r][c] == background and all(rows[r+dr][c+dc] != palette for dr, dc in [(0,1),(0,-1),(1,0),(-1,0)])]
        assert candidates
        r, c = candidates[0]; result[r][c] = palette
    else:
        refs = set(marker['intrinsic_singleton_component_refs'])
        entities = [e for e in obs['entities'] if e['id'] in refs]
        assert len(entities) == 1
        l, t, _, _ = entities[0]['bbox']; result[t][l] = background
    return result


def profile_values(rows, values, index=0):
    result = copy.deepcopy(rows)
    measured, _ = geometry.project(observation(rows), rows, CONFIG)
    carrier = methods.profiles(measured)[index]
    p = carrier['profile']; background = Counter(x for row in rows for x in row).most_common(1)[0][0]
    assert p['stem_relief_axis_direction'] == 'up'
    for (r, c), old, new in zip(p['stem_relief_rank_origins'], p['stem_relief_rank_height_pixels'], values):
        for y in range(r-old, r):
            for x in range(c, c+p['stem_relief_rank_width_pixels']): result[y][x] = background
        for y in range(r-new, r):
            for x in range(c, c+p['stem_relief_rank_width_pixels']): result[y][x] = carrier['palette_value']
    return result


HELD = toggle(BASE)
held_obs = observation(HELD, 2)
held_scene, held_context = geometry.project(held_obs, HELD, CONFIG)
assert {k:v for k,v in geometry.stable_context(context).items() if k != 'station_profile_inner_singleton_count'} == {
    k:v for k,v in geometry.stable_context(held_context).items() if k != 'station_profile_inner_singleton_count'}

# Exact whole-scene measurements, with structural admission, public-pixel
# validation, palette bijection and translation independent of any game engine.
for label, rows in [
    ('retained_initial_public', BASE), ('synthetic_mode_held', HELD),
    ('palette_bijection', [[(x+7)%16 for x in row] for row in BASE]),
    ('translated_public_geometry', [[12]*68 for _ in range(2)] + [[12,12]+row+[12,12] for row in BASE] + [[12]*68 for _ in range(2)]),
    ('no_comb_domain', [[0]*9 for _ in range(9)]),
]:
    obs = observation(rows)
    pure_case(GEOMETRY_CASES, label + ':candidates', 'geometry', 'candidates', [obs])
    pure_case(GEOMETRY_CASES, label + ':project', 'geometry', 'project', [obs, rows, CONFIG])
    if label in ('retained_initial_public', 'synthetic_mode_held'):
        parts = source_parts(obs, rows)
        pure_case(GEOMETRY_CASES, label + ':stems', 'stem', 'measure_stem_reliefs', [parts, CONFIG['stem']])
        pure_case(GEOMETRY_CASES, label + ':corners', 'scene', 'measure_corner_quartets', [parts, 16, 8192])
        pure_case(GEOMETRY_CASES, label + ':scene', 'scene', 'measure_station_profile_scene', [rows, parts, CONFIG['stem'], CONFIG['scene']])
        raw = station_profile_scene.measure_station_profile_scene(rows, parts, CONFIG['stem'], CONFIG['scene'])
        pure_case(GEOMETRY_CASES, label + ':context', 'geometry', 'comparison_context', [copy.deepcopy(raw), CONFIG['scene']])
invalid_obs = copy.deepcopy(base_obs); invalid_obs['entities'][0]['palette_value'] = 31
pure_case(GEOMETRY_CASES, 'public_component_pixel_mismatch', 'geometry', 'project', [invalid_obs, BASE, CONFIG])
pure_case(GEOMETRY_CASES, 'stable_context_omits_only_ref_suffix', 'geometry', 'stable_context', [{'a_ref':'ignored', 'a_refs':['kept'], 'context_sha256':'kept', 'n':2}])
for key in ('frame_domain_truncated', 'component_domain_truncated', 'enclosure_domain_truncated', 'receiver_binding_domain_truncated', 'reference_packet_domain_truncated', 'marker_domain_truncated'):
    pure_case(GEOMETRY_CASES, key + ':context_refused', 'scene', 'station_profile_context', [{**scene, key:True}])

# Pure V5 contracts include all axes, retained decoration, ambiguity and the
# exact boundary at which a finite domain becomes incomplete.
points = {(10,c) for c in range(2,14)}
for col, height in [(5,1),(8,3),(11,2)]:
    points.update((r,c) for r in range(10-height,10) for c in range(col,col+2))
points.update((r,2) for r in (8,9))
for turn in range(4):
    transformed = points
    for _ in range(turn): transformed = {(c,30-r) for r,c in transformed}
    parts = [component(transformed)]
    pure_case(GEOMETRY_CASES, 'stem_axis_rotation_'+str(turn), 'stem', 'measure_stem_reliefs', [parts, CONFIG['stem']])
multi = component({(r,c) for r in range(5,12) for c in range(2,14)
                   if r in (5,11) or c in (2,5,8,11)}, 'synthetic:multiple')
for maximum in (1,2,16):
    pure_case(GEOMETRY_CASES, 'stem_alternative_limit_'+str(maximum), 'stem', 'measure_stem_reliefs',
              [[multi], {**CONFIG['stem'], 'maximum_alternatives_per_component':maximum}])
parts = source_parts(base_obs, BASE)
for limit, expansions in [(0,8192),(1,0),(1,1),(16,8192)]:
    pure_case(GEOMETRY_CASES, f'corner_bounds_{limit}_{expansions}', 'scene', 'measure_corner_quartets', [parts,limit,expansions])
cut = scene['receiver_bindings'][0]
cut_args = dict(rank_columns=cut['cut_measurements']['rank_columns'],rank_width=cut['cut_measurements']['rank_width_pixels'],
    reference_row=cut['reference_row'],reference_columns=cut['reference_columns'],reference_value=cut['reference_value'],
    band_top=cut['bbox'][0],band_bottom=cut['bbox'][2],upper_value=cut['upper_value'],lower_value=cut['lower_value'])
pure_case(GEOMETRY_CASES,'exact_visible_cuts','stem','measure_ranked_cuts',[BASE,cut_args])
absent = copy.deepcopy(BASE); absent[cut['reference_row']][cut['reference_columns'][0]] = 15
pure_case(GEOMETRY_CASES,'reference_not_visible_is_unknown','stem','measure_ranked_cuts',[absent,cut_args])
ambiguous = copy.deepcopy(BASE); col=cut_args['rank_columns'][0]; top=cut_args['band_top']+2
for x in range(col,col+cut_args['rank_width']):
    ambiguous[top-1][x]=cut_args['upper_value']; ambiguous[top][x]=15; ambiguous[top+1][x]=cut_args['lower_value']
pure_case(GEOMETRY_CASES,'multiple_visible_cuts_are_unknown','stem','measure_ranked_cuts',[ambiguous,cut_args])
pure_case(GEOMETRY_CASES,'invalid_cut_shape_refused','stem','measure_ranked_cuts',[BASE,{**cut_args,'rank_width':0}])

# Cold owner -> passive observation -> source SRC proposal -> active return.
family_case('cold_owner_abstains','proposeSource',[base_obs,BASE,INPUTS,32])
family_case('zero_budget_still_scopes','proposeSource',[base_obs,BASE,INPUTS,0])
acquisition = family_case('passive_exact_mode_contrast','recordSource',[base_obs,held_obs,{'action_ref':'ACTION5'},BASE,HELD])
ACQUIRED = acquisition['afterState']; assert len(ACQUIRED['mode_evidence']) == 1
proposal_row = family_case('acquired_mode_selects_actual_src_proposal','proposeSource',[held_obs,HELD,INPUTS,32],ACQUIRED)
PROPOSAL = proposal_row['value']; assert PROPOSAL['workshop_plan']['stage'] == 'adjacent_exchange_probe'
family_case('valid_single_conditional_binding','bind',[PROPOSAL,None],ACQUIRED)
wrong = copy.deepcopy(PROPOSAL); wrong['steps'][0]['action']={'action_ref':'ACTION1'}
family_case('binding_rejects_different_step_action','bind',[wrong,None],ACQUIRED)
wrong = copy.deepcopy(PROPOSAL); del wrong['steps'][0]['expected_after']
family_case('binding_requires_unknown_after_field','bind',[wrong,None],ACQUIRED)
PUBLIC = {'frame_rows':HELD,'frame_hash':held_obs['frame_hash'],'level':1,'available_action_refs':held_obs['available_action_refs']}
for label, obs, public, index in [
    ('current',held_obs,PUBLIC,0), ('wrong_index',held_obs,PUBLIC,1),
    ('new_observation',observation(HELD,9),PUBLIC,0), ('new_epoch',observation(HELD,2,2),PUBLIC,0),
    ('official_progress_changed',{**held_obs,'levels_completed':1},PUBLIC,0),
    ('public_frame_hash_changed',held_obs,{**PUBLIC,'frame_hash':'other'},0),
    ('public_epoch_changed',held_obs,{**PUBLIC,'level':2},0),
    ('action_unavailable',held_obs,{**PUBLIC,'available_action_refs':['ACTION5']},0),
    ('fresh_geometry_changed',held_obs,{**PUBLIC,'frame_rows':BASE},0),
]: family_case('before_'+label,'before',[PROPOSAL,index,public,obs],ACQUIRED)
family_case('after_never_claims_success','after',[PROPOSAL,0,held_obs,observation(BASE,3),HELD,BASE],ACQUIRED)
rejected = family_case('active_no_effect_rejects_rule_context','recordSource',
    [held_obs,observation(HELD,3),PROPOSAL['actions'][0],HELD,HELD,PROPOSAL,0],ACQUIRED)['afterState']
family_case('rejected_context_prevents_blind_repetition','proposeSource',[observation(HELD,3),HELD,INPUTS,32],rejected)
family_case('selected_action_mismatch_has_no_acquisition','recordSource',
    [held_obs,observation(BASE,3),{'action_ref':'ACTION1'},HELD,BASE,PROPOSAL,0],ACQUIRED)

# Two observed directions create a portable method, whose next-scope use is a
# new question. An unchanged return refutes that question in the new scope.
reverse = family_case('passive_reverse_toggle_retains_portable_method','recordSource',
    [held_obs,observation(BASE,3),{'action_ref':'ACTION5'},HELD,BASE],ACQUIRED)['afterState']
assert len(reverse['mode_methods'][0]['contrasts']) == 2
boundary = family_case('official_boundary_retains_methods_resets_authorization','recordSource',
    [observation(BASE,3),observation(BASE,4,2),{'action_ref':'ACTION5'},BASE,BASE],reverse)['afterState']
assert not boundary['mode_evidence'] and boundary['mode_methods']
revalidation = family_case('new_scope_portable_method_is_revalidation_question','proposeSource',
    [observation(BASE,4,2),BASE,INPUTS,32],boundary)['value']
assert revalidation['workshop_plan']['extension']['kind'] == 'revalidate_mode'
refuted = family_case('failed_revalidation_records_scoped_refutation','recordSource',
    [observation(BASE,4,2),observation(BASE,5,2),{'action_ref':'ACTION5'},BASE,BASE,revalidation,0],boundary)['afterState']
family_case('refuted_portable_method_abstains_in_scope','proposeSource',[observation(BASE,5,2),BASE,INPUTS,32],refuted)
confirmed = family_case('observed_revalidation_reacquires_current_mode','recordSource',
    [observation(BASE,4,2),observation(HELD,5,2),{'action_ref':'ACTION5'},BASE,HELD,revalidation,0],boundary)['afterState']
family_case('confirmed_revalidation_changes_next_decision','proposeSource',[observation(HELD,5,2),HELD,INPUTS,32],confirmed)
family_case('restored_portable_memory_revalidates_again','proposeSource',[observation(BASE,6,3),BASE,INPUTS,32],refuted)
family_case('old_state_without_new_fields_remains_compatible','restore',[{'epoch':2,'mode_evidence':[],'rejected':[],'events':[]}],reverse)
family_case('scope_changes_clear_local_rejection_only','scope',[observation(BASE,5,3)],rejected)

# A framed synthetic support opposite a receiver makes an actual current
# transform question possible, based only on consumer-linked vector relations.
SUPPORT = profile_values(BASE,[2,4,3])
for r in range(12,21):
    for c in range(4,11):
        if r in (12,20) or c in (4,10): SUPPORT[r][c]=7
support_held=toggle(SUPPORT); support_before=observation(SUPPORT); support_obs=observation(support_held,2)
support_acquired=family_case('synthetic_support_passive_mode_acquisition','recordSource',
    [support_before,support_obs,{'action_ref':'ACTION5'},SUPPORT,support_held])['afterState']
transform=family_case('consumer_linked_actual_transform_question','proposeSource',
    [support_obs,support_held,[{'action_ref':'ACTION7'}],32],support_acquired)['value']
assert transform and transform['workshop_plan']['extension']['kind']=='probe_transform'
transformed=profile_values(support_held,[1,3,2])
transformed_state=family_case('actual_profile_pair_records_conditional_operator','recordSource',
    [support_obs,observation(transformed,3),{'action_ref':'ACTION7'},support_held,transformed,transform,0],support_acquired)['afterState']
assert transformed_state['operator_observations'][0]['models']
assert transformed_state['operator_observations'][0]['global_domain_known'] is False
disturbed=profile_values(transformed,[2,1,4],1)
family_case('other_profile_change_does_not_acquire_operator_model','recordSource',
    [support_obs,observation(disturbed,3),{'action_ref':'ACTION7'},support_held,disturbed,transform,0],support_acquired)
family_case('unchanged_transform_records_no_identified_model','recordSource',
    [support_obs,observation(support_held,3),{'action_ref':'ACTION7'},support_held,support_held,transform,0],support_acquired)
family_case('post_transform_decision_consumes_new_profiles','proposeSource',
    [observation(transformed,3),transformed,INPUTS,32],transformed_state)

# Direct policy fixtures isolate exact priority, cost and equivalence contracts.
# Each expected selection is produced by original select, never by a TS model.
def selection_case(name, ctx, options, *, actions=None, rejected=None):
    family=RankedWorkshop(); family.observation={'available_action_refs':actions or [x['action_ref'] for x in INPUTS]}
    family.rejected=copy.deepcopy(rejected or [])
    measured={'context':copy.deepcopy(ctx),'extensions':copy.deepcopy(options)}
    value=family.select(measured)
    SELECTION_CASES.append({'id':name,'observation':plain(family.observation),'measured':plain(measured),
        'rejected':plain(family.rejected),'value':plain(value),'selected':plain(family.selected)})

standard={**held_context,'station_profile_marked_profile_equal_same_band_cut':False,
    'station_profile_neighbor_above_equal_marked_cut_count':0,'station_profile_neighbor_below_equal_marked_cut_count':0}
options=[]
for index,kind in enumerate(CONFIG['choice_order']):
    if kind=='legacy':continue
    option={'kind':kind,'action':{'action_ref':'ACTION7'},'support':{'ref':'support:'+kind},
        'objective_key':['carrier','receiver'],'estimated_actions_to_test':index+3,'facts':{
            'support_relation_admissible':True,'exact_receiver_match':True,'held_direction_evidence_present':True,
            'current_same_band_receiver_match':False,'conditional_preparation_bound':True,'remaining_action_cost_admissible':True}}
    options.append(option)
    selection_case('single_extension_'+kind,standard,[option])
for index in range(len(options)):
    selection_case('declared_extension_priority_'+str(index),standard,list(reversed(options[index:])))
probe=next(o for o in options if o['kind']=='probe_transform')
selection_case('equivalent_repeated_probe_collapses',standard,[probe,copy.deepcopy(probe)])
different=copy.deepcopy(probe);different['support']['ref']='another-support'
selection_case('distinct_supports_preserve_ambiguity',standard,[probe,different])
different=copy.deepcopy(probe);different['objective_key']=['other-carrier','receiver']
selection_case('distinct_objectives_preserve_ambiguity',standard,[probe,different])
unavailable=copy.deepcopy(probe);unavailable['action']['action_ref']='ACTION9'
selection_case('unavailable_extension_is_not_a_candidate',standard,[unavailable])
point=copy.deepcopy(probe);point['action']['data']={'x':1,'y':1}
selection_case('point_extension_is_not_a_workshop_input',standard,[point])
cheap=copy.deepcopy(next(o for o in options if o['kind']=='prepare_observed_receiver'))
expensive=copy.deepcopy(cheap);expensive['estimated_actions_to_test']+=2;expensive['objective_key']=['other','receiver']
selection_case('observed_preparation_uses_minimum_cost',standard,[expensive,cheap])
expensive['estimated_actions_to_test']=cheap['estimated_actions_to_test']
selection_case('equal_cost_distinct_preparations_abstain',standard,[expensive,cheap])
selection_case('legacy_proposal_is_lower_than_transform',held_context,[probe])
selection_case('legacy_exact_rejected_pair_is_excluded',held_context,[],rejected=rejected['rejected'])

# V5 operator semantics and portable/control/preparation helpers.
for label,profile,target,height in [
    ('reversal',[1,2,3],[3,2,1],64),('cyclic',[1,2,4],[2,4,1],64),
    ('uniform_shift',[1,2,3],[3,4,5],64),('identical_is_not_a_transform',[1,2,3],[1,2,3],64),
    ('arity_refusal',[1,2],[1,2,3],64),('nonuniform_refusal',[1,2,3],[1,2,5],64),
    ('visible_height_refusal',[1,2,3],[65,66,67],64),('negative_refusal',[1,2,3],[-1,0,1],64),
]:pure_case(METHOD_CASES,label,'methods','relations',[profile,target,height])
for label,s,c,o in [('unheld',scene,context,base_obs),('held',held_scene,held_context,held_obs)]:
    pure_case(METHOD_CASES,label+':signature','methods','mode_signature',[c])
    pure_case(METHOD_CASES,label+':profiles','methods','profiles',[s])
    pure_case(METHOD_CASES,label+':values','methods','values',[s])
    pure_case(METHOD_CASES,label+':supports','methods','supports',[o,s])
    for p in methods.profiles(s):pure_case(METHOD_CASES,label+':band:'+p['component_ref'],'preparation','band_index',[s,p])
pure_case(METHOD_CASES,'exact_toggle_changes','methods','changes',[scene,context,held_scene,held_context])
pure_case(METHOD_CASES,'unchanged_changes','methods','changes',[scene,context,scene,context])
support_scene,support_context=geometry.project(support_obs,support_held,CONFIG)
glyphs=methods.supports(support_obs,support_scene);assert len(glyphs)==1
pure_case(METHOD_CASES,'measured_opposite_support','methods','supports',[support_obs,support_scene])
pure_case(METHOD_CASES,'support_exact_appearance_digest','methods','support_appearance',[support_obs,glyphs[0]['bbox']])
for label,state,obs,rows in [('current_mode',ACQUIRED,held_obs,HELD),('portable_revalidation',boundary,observation(BASE,4,2),BASE),
    ('scoped_refutation',refuted,observation(BASE,5,2),BASE),('consumer_transform',support_acquired,support_obs,support_held)]:
    s,c=geometry.project(obs,rows,CONFIG);owner=SimpleNamespace(**copy.deepcopy(state))
    args=[state,obs,rows,s,c,INPUTS,32]
    pure_case(METHOD_CASES,label+':extension_options','methods','extension_options',args,[owner,*args[1:]])
    pure_case(METHOD_CASES,label+':grasp','preparation','grasp',[state,obs,c],[owner,obs,c])
    current=next(p for p in methods.profiles(s) if p['component_ref']==c['station_profile_unique_marked_profile_ref'])
    args=[state,obs,s,c,current]
    pure_case(METHOD_CASES,label+':prepared_receiver_access','methods','prepared_receiver_access',args,[owner,*args[1:]])

# Deliberately explicit source owner data checks the distinction between a
# measured one-band control and a general movement law, without live priming.
control_state=copy.deepcopy(ACQUIRED)
control_item={'action':{'action_ref':'ACTION2'},'changes':{'marker_moved':True,'mode_toggle':False,'receiver_changed':False,'profile_geometry_changed':True},'held_before':True,'held_after':True,
    'marked_profile_preserved':True,'vertical_sign':1,'same_profile_multiset':True,'slot_delta':1,'evidence':['control:a','control:b'],'source_epoch':1}
control_state['input_effects'].append(control_item)
for label,state in [('unique',control_state),('wrong_slot_delta',{**control_state,'input_effects':[{**control_item,'slot_delta':2}]}),
    ('distinct_actions',{**control_state,'input_effects':[control_item,{**control_item,'action':{'action_ref':'ACTION1'}}]})]:
    pure_case(METHOD_CASES,'held_control:'+label,'preparation','control',[state,held_obs,True,1],[SimpleNamespace(**state),held_obs,True,1])
pure_case(METHOD_CASES,'held_direction_access_to_remote_exact_receiver','methods','prepared_receiver_access',
    [control_state,held_obs,held_scene,held_context,methods.profiles(held_scene)[0]],
    [SimpleNamespace(**control_state),held_obs,held_scene,held_context,methods.profiles(held_scene)[0]])

# Positive preparation contracts use an explicit measured scene in which one
# receiver has a zero contour and a second remains a consumer.  This is a
# component fixture, not a claimed live-game receipt or occupancy fact.
partial_scene=copy.deepcopy(support_scene)
partial_scene['receiver_bindings'][0]['cut_measurements']['signed_cut_offsets']=(0,0,0)
partial_scene['receiver_bindings'][0]['cut_values']=(partial_scene['receiver_bindings'][0]['enclosure_value'],)*3
partial_context=geometry.comparison_context(partial_scene,CONFIG['scene'])
assert partial_context['station_profile_zero_cut_contour_agreement_count']==1
partial_current=next(p for p in methods.profiles(partial_scene) if p['component_ref']==partial_context['station_profile_unique_marked_profile_ref'])
unknown_owner=copy.deepcopy(support_acquired);unknown_owner['input_effects'].append(control_item)
observed_owner=copy.deepcopy(unknown_owner);observed_owner['operator_observations']=copy.deepcopy(transformed_state['operator_observations'])
for label,state,remaining in [
    ('unknown_support_current_consumer',unknown_owner,3),('observed_pair_preferred',observed_owner,3),
    ('complete_cost_does_not_fit',observed_owner,2),
    ('foreign_epoch_model_is_not_current',{**observed_owner,'operator_observations':[{**x,'source_epoch':0} for x in observed_owner['operator_observations']]},3),
    ('conflicting_pair_models_refuse',{**observed_owner,'operator_observations':observed_owner['operator_observations']+[{**observed_owner['operator_observations'][0],'models':[]}]},3),
    ('nonadjacent_control_does_not_compose',{**observed_owner,'input_effects':[{**x,'slot_delta':2} for x in observed_owner['input_effects']]},3),
]:
    args=[state,support_obs,support_held,partial_scene,partial_context,partial_current,[{'action_ref':'ACTION7'}],remaining]
    result=pure_case(METHOD_CASES,'preparation:'+label,'preparation','preparation_options',args,[SimpleNamespace(**state),*args[1:]])
    assert 'value' in result,(label,result.get('error'))
    if label=='unknown_support_current_consumer':
        assert len(result['value'])==1 and result['value'][0]['kind']=='prepare_unknown_receiver'
        assert result['value'][0]['estimated_actions_to_test']==3
    if label=='observed_pair_preferred':assert len(result['value'])==1 and result['value'][0]['kind']=='prepare_observed_receiver'
    if label in ('complete_cost_does_not_fit','conflicting_pair_models_refuse','nonadjacent_control_does_not_compose'):assert not result['value']
targets=[{'target_profile':[1,3,2]}]
for label,state,wanted in [('unknown',unknown_owner,targets),('observed_consumer',observed_owner,targets),
    ('wrong_consumer',observed_owner,[{'target_profile':[9,8,7]}]),
    ('empty_model_intersection',{**observed_owner,'operator_observations':[{**observed_owner['operator_observations'][0],'models':[]}]},targets)]:
    args=[state,support_obs,glyphs[0],[2,4,3],wanted]
    pure_case(METHOD_CASES,'support_relation:'+label,'preparation','support_relation_admissible',args,[SimpleNamespace(**state),*args[1:]])

# Source memory bounds are tested at the update that enforces each bound.
many=copy.deepcopy(ACQUIRED);many['input_effects']*=70;many['mode_methods'][0]['contrasts']*=20
bounded=family_case('feedback_enforces_effect_and_method_contrast_bounds','recordSource',
    [held_obs,observation(BASE,3),{'action_ref':'ACTION5'},HELD,BASE],many)['afterState']
assert len(bounded['input_effects'])==64 and len(bounded['mode_methods'][0]['contrasts'])==8
many=copy.deepcopy(transformed_state);many['operator_observations']*=40
bounded=family_case('feedback_enforces_operator_observation_bound','recordSource',
    [support_obs,observation(transformed,3),{'action_ref':'ACTION7'},support_held,transformed,transform,0],many)['afterState']
assert len(bounded['operator_observations'])==32
many=copy.deepcopy(rejected);many['events']*=40
bounded=family_case('saved_events_keep_only_source_last_thirty_two','recordSource',
    [held_obs,observation(HELD,3),PROPOSAL['actions'][0],HELD,HELD,PROPOSAL,0],many)['afterState']
assert len(bounded['events'])==32
access=methods.prepared_receiver_access(SimpleNamespace(**control_state),held_obs,held_scene,held_context,methods.profiles(held_scene)[0])[0]
access_proposal=copy.deepcopy(PROPOSAL);access_proposal['workshop_plan']['extension']=access
access_proposal['actions']=[copy.deepcopy(access['action'])];access_proposal['steps'][0]['action']=copy.deepcopy(access['action'])
family_case('failed_held_direction_records_scoped_refutation','recordSource',
    [held_obs,observation(HELD,3),access['action'],HELD,HELD,access_proposal,0],control_state)

# The cold production caller currently chooses ACTION1 in this scene. Record
# that same observation contrast through the original owner so the integration
# test can compare exact method hashes without priming or forged learned state.
production=RankedWorkshop()
production_passive=production.record(base_obs,held_obs,{'action_ref':'ACTION1'},BASE,HELD)
production_acquired=plain(production.state())
production_proposal=production.propose(held_obs,HELD,INPUTS,32)
assert production_proposal is not None
production_return=production.record(held_obs,observation(HELD,3),production_proposal['actions'][0],HELD,HELD,production_proposal,0)
production_state=plain(production.state())
production_after=production.propose(observation(HELD,3),HELD,INPUTS,32)
assert production_after is None
production_variant={'passiveAction':{'action_ref':'ACTION1'},'passiveReturn':plain(production_passive),
    'acquiredState':production_acquired,'proposal':plain(production_proposal),'noEffectReturn':plain(production_return),
    'noEffectState':production_state,'postRefutationProposal':plain(production_after)}

portable=RankedWorkshop();portable_sequence=[]
one=lambda rows,revision,epoch=1:observation(rows,revision,epoch,['ACTION5'])
for before,after,first,second in [(one(BASE,1),one(HELD,2),BASE,HELD),
    (one(HELD,2),one(BASE,3),HELD,BASE),(one(BASE,3),one(BASE,4,2),BASE,BASE)]:
    result=portable.record(before,after,{'action_ref':'ACTION5'},first,second)
    portable_sequence.append({'before':plain(before),'after':plain(after),'first':first,'second':second,
        'command':{'action_ref':'ACTION5'},'record':plain(result),'afterState':plain(portable.state())})
portable_proposal=portable.propose(one(BASE,4,2),BASE,[{'action_ref':'ACTION5'}],32)
assert portable_proposal and portable_proposal['workshop_plan']['extension']['kind']=='revalidate_mode'
portable_return=portable.record(one(BASE,4,2),one(BASE,5,2),{'action_ref':'ACTION5'},BASE,BASE,portable_proposal,0)
portable_state=plain(portable.state())
portable_after=portable.propose(one(BASE,5,2),BASE,[{'action_ref':'ACTION5'}],32)
assert portable_after is None
portable_variant={'availableActionRefs':['ACTION5'],'sequence':portable_sequence,'newScopeObservation':plain(one(BASE,4,2)),
    'failedObservation':plain(one(BASE,5,2)),'newScopeProposal':plain(portable_proposal),
    'noEffectReturn':plain(portable_return),'noEffectState':portable_state,'postRefutationProposal':plain(portable_after)}

sys.setprofile(None)
verify_sources()
paths={Path(module.__file__).resolve() for module in list(sys.modules.values()) if getattr(module,'__file__',None)
       and Path(module.__file__).resolve().is_relative_to(SOURCE)}
paths.update((SOURCE/'agents/yf_arc3_v6/morphology_policy/ranked_workshop').glob('*.drm'))
paths.update((SOURCE/'agents/yf_arc3_v6/morphology_policy/ranked_workshop').glob('*.src'))
payload={'schema':'logos-engine.v6.ranked-workshop-reference.v1','referenceCommit':COMMIT,
    'qualification':'Unchanged original Python on retained public initial raster and explicitly synthetic observations/component states. No game dispatch, live priming, or solved-level claim.',
    'sourceHashes':{p.relative_to(SOURCE).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(paths)},
    'sourceFilesVerifiedBeforeAndAfter':len(MANIFEST),'sourceModified':False,
    'executedSourceFunctions':[{'path':p,'line':line,'function':name,'calls':count} for (p,line,name),count in sorted(EXECUTED.items())],
    'publicInitialSource':{'path':CORPUS_PATH.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(CORPUS_PATH.read_bytes()).hexdigest(),'game':'LKEY','actionsDispatched':0},
    'geometryCases':GEOMETRY_CASES,'methodCases':METHOD_CASES,'selectionCases':SELECTION_CASES,'cases':CASES,
    'kernelControlled':{'qualification':'Synthetic public raster contrast; starts with cold owner and acquires via actual record invocation, no live game seed.',
        'rows':BASE,'heldRows':HELD,'observation':plain(base_obs),'heldObservation':plain(held_obs),
        'passiveAction':{'action_ref':'ACTION5'},'passiveReturn':acquisition['value'],'acquiredState':ACQUIRED,
        'proposal':PROPOSAL,'noEffectObservation':plain(observation(HELD,3)),'noEffectState':rejected,
        'expectedActionVariants':{'ACTION1':production_variant}},'kernelPortable':portable_variant}
out=ROOT/'tests/fixtures/v6-ranked-workshop-reference.json.gz'
out.write_bytes(gzip.compress((json.dumps(payload,separators=(',',':'),ensure_ascii=False)+'\n').encode(),mtime=0))
print(json.dumps({'path':out.relative_to(ROOT).as_posix(),'familyCases':len(CASES),'geometryCases':len(GEOMETRY_CASES),
    'methodCases':len(METHOD_CASES),'selectionCases':len(SELECTION_CASES),'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest()}))
