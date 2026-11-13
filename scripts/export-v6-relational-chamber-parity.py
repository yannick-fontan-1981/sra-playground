#!/usr/bin/env python3
"""Export unchanged V6 chamber contracts from archived public pixels.

No game source, game host, oracle or solution is read or executed. Altered
rasters and memories are controlled component contracts, never game evidence.
"""
from __future__ import annotations
import copy
import gzip
import hashlib
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
CORPUS_PATH = 'tests/fixtures/v6-linked-packet-initial-public.json.gz'
OUTPUT_PATH = 'tests/fixtures/v6-relational-chamber-parity.json.gz'
MANIFEST = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
def sha(value): return hashlib.sha256(value).hexdigest()
def verify():
    for relative, entry in MANIFEST.items(): assert sha((SOURCE / relative).read_bytes()) == entry['sha256'], relative
    return len(MANIFEST)
VERIFIED_BEFORE = verify()
sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
from relational_chamber_access import RelationalChamberAccess, fresh, learn, predict, inverse, input_candidates
from relational_chamber_projection import scene, projection
from exposed_reception_access import ExposedReceptionAccess, input_candidates as inherited_inputs
from common_observed_compositions import ObservedCompositionConstraint
from observed_input_domain import ObservedInputDomain
from terminal_composition import identity
def plain(value): return json.loads(json.dumps(value, separators=(',', ':')))
def find_key(value, key):
    if isinstance(value, dict):
        if key in value: return value[key]
        for item in value.values():
            found = find_key(item, key)
            if found is not None: return found
    elif isinstance(value, list):
        for item in value:
            found = find_key(item, key)
            if found is not None: return found
    return None
CORPUS_RAW = (ROOT / CORPUS_PATH).read_bytes()
CORPUS = json.loads(gzip.decompress(CORPUS_RAW))
assert CORPUS['actions'] == CORPUS['levelJumps'] == 0
PUBLIC = next(view for view in CORPUS['games'] if view['game'] == 'CATR')
ROWS = PUBLIC['packet']['frame_rows']
POLICY_PATH = 'agents/yf_arc3_v6/morphology_policy/strategy.drm'
POLICY = find_key(json.loads((SOURCE / POLICY_PATH).read_text()), 'observed_composition_services')
CASES, GUARDS, COMMONS = [], [], []
def observation(rows, name='current', **changes):
    return {**copy.deepcopy(PUBLIC['observation']), 'observation_ref': 'controlled:chamber:' + name,
            'frame_hash': identity(rows)[:16], **changes}
def state(memory):
    return {'projection': plain({'relation_memory': memory.relation_memory, 'relation_events': memory.relation_events}),
            'parentDigest': ExposedReceptionAccess.retained_digest(memory), 'digest': memory.retained_digest()}
def instance(seed=()):
    memory = RelationalChamberAccess()
    for event in copy.deepcopy(list(seed)): memory.apply_event(event)
    return memory
def add(name, operation, arguments, expected):
    CASES.append({'id': name, 'operation': operation, 'arguments': plain(arguments), 'expected': plain(expected)})
    return expected
def memory_case(name, operation, arguments, callback, seed=()):
    memory = instance(seed); before = state(memory); expected = callback(memory)
    CASES.append({'id': name, 'operation': operation, 'seedEvents': plain(list(seed)), 'arguments': plain(arguments),
                  'expected': plain(expected), 'beforeState': before, 'afterState': state(memory)})
    return expected
def propose(name, rows, seed=(), limit=16, available=None, policy=None):
    obs = observation(rows, name)
    if available is not None: obs['available_action_refs'] = available
    args = {'obs': obs, 'rows': rows, 'inputs': [], 'limit': limit, 'config': policy or POLICY}
    return memory_case('propose:' + name, 'propose', args,
                       lambda memory: memory.propose_graph(obs, rows, [], limit, args['config']), seed)
def own(events): return [plain(event) for event in events if event['kind'] == 'observed_chamber_relations']
def record(name, proposal, rows, later, seed=(), index=0, **changes):
    before = observation(rows, name + ':before'); after = observation(later, name + ':after', **changes)
    args = {'before': before, 'command': proposal['actions'][index], 'after': after,
            'rows': rows, 'later': later, 'proposal': proposal, 'index': index}
    return memory_case('record:' + name, 'record', args, lambda memory: own(memory.record(**args)), seed)
def guard(name, operation, proposal, rows, later=None, index=0, **meta):
    plan = proposal['chamber_relation_plan']
    current = {'epoch': plan['epoch'], 'score': plan['score'], 'observation_ref': plan['observation_ref'],
               'available': PUBLIC['observation']['available_action_refs'], **meta}
    args = {'proposal': proposal, 'index': index, 'rows': rows, 'meta': current}
    memory = instance()
    if operation == 'before': result = memory.before(proposal, index, rows, **current)
    else: args['later'] = later; result = memory.after(proposal, index, rows, later, **current)
    GUARDS.append({'id': name, 'operation': operation, 'arguments': plain(args), 'expected': plain(result)})
def event(memory): return {'kind': 'observed_chamber_relations', 'memory': copy.deepcopy(memory), 'detail': {'controlled': True}}
def controlled_prediction(rows, plan, index):
    """Draw the already proposed measurement, not an inferred game transition."""
    measured = scene(rows); expected = plan['predicted'][index]; assert measured and expected
    later = copy.deepcopy(rows); background = max(set(v for row in rows for v in row), key=lambda value: sum(row.count(value) for row in rows))
    values = dict(expected['settings']); axes = dict(expected['axes']); half = measured['unit'] // 2
    for control in measured['controls']:
        for x, y in control['support']: later[y][x] = int(values[control['id']])
    for room in measured['rooms']:
        assert not room['overlap_hypothesis']
        bx, by = map(int, room['body'])
        for y in range(by-half, by+half+1):
            for x in range(bx-half, bx+half+1): later[y][x] = background
    for room in measured['rooms']:
        position = list(room['center'])
        for axis in measured['axes']:
            if axis['room'] == room['id']: position[axis['axis']] += int(axes[axis['id']]) * measured['quantum'] / axis['direction']
        bx, by = map(int, position)
        for y in range(by-half, by+half+1):
            for x in range(bx-half, bx+half+1): later[y][x] = room['color']
    assert scene(later) and projection(scene(later)) == expected
    return later
def common(name, rows, seed=(), remaining=16, deadline=1000000000):
    family = ObservedCompositionConstraint(); family.level_deadline = deadline
    for item in copy.deepcopy(list(seed)): family.memory.apply_event(item)
    obs = observation(rows, 'common:' + name)
    item = {'id': name, 'seedEvents': plain(list(seed)), 'arguments': {'obs': obs, 'rows': rows, 'inputs': [],
       'remaining': remaining, 'config': POLICY, 'levelDeadline': family.level_deadline}}
    try:
        proposal = family.observed_composition_propose(obs, rows, [], remaining, POLICY)
        item['unboundProposal'] = plain(proposal)
        if proposal and proposal.get('status') == 'proposed': family.bind(proposal, ObservedInputDomain(4096))
        item['proposal'] = plain(proposal)
    except Exception as error: item['error'] = {'name':type(error).__name__, 'message':str(error)}
    COMMONS.append(item)

def main():
    initial = scene(ROWS); assert initial
    measurements = [{'game': view['game'], 'frameHash': view['observation']['frame_hash'], 'scene': scene(view['packet']['frame_rows'])} for view in CORPUS['games']]
    add('public_initial', 'scene', {'rows': ROWS}, initial)
    add('projection_initial', 'projection', {'scene': initial}, projection(initial))
    recolored = [[(value * 7 + 3) % 16 for value in row] for row in ROWS]
    translated = [[ROWS[0][0]] * (len(ROWS[0]) + 4) for _ in range(3)] + [[ROWS[0][0]]*2+row+[ROWS[0][0]]*2 for row in ROWS]
    duplicated = [row + [ROWS[0][0]]*4 + row for row in ROWS]
    for name, rows in [('palette_permutation', recolored), ('translated_padding', translated),
                       ('ambiguous_two_grids', duplicated), ('scene_missing', [[5]*64 for _ in range(64)])]:
        add('scene:' + name, 'scene', {'rows': rows}, scene(rows))
    assert scene(recolored) and scene(translated)
    for available in [PUBLIC['observation']['available_action_refs'], ['ACTION5']]:
        inherited = inherited_inputs(ROWS, available)
        add('inputs:' + str(available), 'input_candidates', {'rows': ROWS, 'available': available, 'inherited': inherited}, input_candidates(ROWS, available))
    memory = add('learn_initial', 'learn', {'scene': initial, 'memory': fresh(), 'ref': 'controlled:initial'}, learn(initial, fresh(), 'controlled:initial'))
    add('learn_same_evidence', 'learn', {'scene': initial, 'memory': memory, 'ref': 'controlled:initial'}, learn(initial, copy.deepcopy(memory), 'controlled:initial'))
    add('learn_new_evidence', 'learn', {'scene': initial, 'memory': memory, 'ref': 'controlled:again'}, learn(initial, copy.deepcopy(memory), 'controlled:again'))
    conflicting = copy.deepcopy(initial); conflicting['axes'][0]['value'] = '0'
    conflict = add('learn_contradiction', 'learn', {'scene': conflicting, 'memory': memory, 'ref': 'controlled:conflict'}, learn(conflicting, copy.deepcopy(memory), 'controlled:conflict'))
    settings = {c['id']:c['value'] for c in initial['controls']}
    add('predict_known', 'predict', {'scene': initial, 'memory': memory, 'settings': settings}, predict(initial, memory, settings))
    unknown = copy.deepcopy(settings); unknown[initial['controls'][0]['id']] = 'unobserved'
    add('predict_unknown', 'predict', {'scene': initial, 'memory': memory, 'settings': unknown}, predict(initial, memory, unknown))
    for name, cfg in [('complete', POLICY['relational_chamber_question']), ('max_states', {**POLICY['relational_chamber_question'], 'max_states':1}),
                      ('max_checks', {**POLICY['relational_chamber_question'], 'max_checks':1}), ('variable_refusal', {**POLICY['relational_chamber_question'], 'max_variables':1})]:
        add('inverse:' + name, 'inverse', {'scene': initial, 'memory': memory, 'config': cfg}, inverse(initial, memory, cfg))
    first = propose('public_initial', ROWS); assert first['kind'] == 'chamber_relations' and len(first['actions']) == 1
    propose('palette_permutation', recolored); propose('translated_padding', translated)
    propose('pointing_unavailable', ROWS, available=['ACTION5'])
    propose('retained_contradiction', ROWS, [event(conflict)])
    exhausted = copy.deepcopy(first['chamber_relation_plan']['memory']); exhausted['failed'] = [identity([initial['layout'], projection(initial), ref, first['chamber_relation_plan']['candidate']['settings'][ref]]) for ref in first['chamber_relation_plan']['candidate']['changes']]
    propose('trials_exhausted', ROWS, [event(exhausted)])
    known = copy.deepcopy(memory)
    for control in initial['controls']:
        for old in sorted({c['value'] for c in initial['controls']}):
            for new in sorted({c['value'] for c in initial['controls']}):
                if old != new: known['edges'][json.dumps([len(control['support']),old,new],separators=(',',':'))] = {'evidence':['controlled:edge'], 'status':'observed_edit_under_current_binding'}
    seed = [event(known)]
    batch = propose('known_edges_batch', ROWS, seed); assert len(batch['actions']) > 1
    propose('limit_one', ROWS, seed, limit=1); propose('limit_two', ROWS, seed, limit=2)
    propose('remaining_one', ROWS, seed, policy={**POLICY,'remaining_level_actions':1})
    later = controlled_prediction(ROWS, first['chamber_relation_plan'], 0)
    positive = record('observed_edit_and_rows', first, ROWS, later)
    propose('after_observed_edit', ROWS, positive)
    record('unchanged_control', first, ROWS, ROWS)
    control_only = copy.deepcopy(ROWS)
    for x,y in initial['controls'][0]['support']: control_only[y][x] = int(first['chamber_relation_plan']['edits'][0]['new'])
    contradiction = record('changed_control_contradicts_rows', first, ROWS, control_only)
    propose('learned_contradiction_blocks', ROWS, contradiction)
    record('layout_unknown', first, ROWS, [[5]*64 for _ in range(64)])
    record('boundary_seals_scope', first, ROWS, recolored, level_epoch=first['chamber_relation_plan']['epoch']+1,levels_completed=1)
    guard('before_current','before',first,ROWS)
    guard('before_stale_observation','before',first,ROWS,observation_ref='stale')
    guard('before_stale_epoch','before',first,ROWS,epoch=first['chamber_relation_plan']['epoch']+1)
    guard('before_score_changed','before',first,ROWS,score=1)
    guard('before_unavailable','before',first,ROWS,available=['ACTION5'])
    guard('before_changed_pixels','before',first,control_only)
    tampered = copy.deepcopy(first);tampered['actions'][0]['data']['x'] += 1
    guard('before_tampered_command','before',tampered,ROWS)
    # Present but empty plan: source identity mismatch short-circuits field reads.
    empty = copy.deepcopy(first); empty['chamber_relation_plan'] = {}
    memory_instance = instance()
    empty_meta = {'epoch':first['chamber_relation_plan']['epoch'],'score':first['chamber_relation_plan']['score'],
                  'observation_ref':first['chamber_relation_plan']['observation_ref'],'available':PUBLIC['observation']['available_action_refs']}
    GUARDS.append({'id':'before_present_empty_plan','operation':'before','arguments':plain({'proposal':empty,'index':0,'rows':ROWS,'meta':empty_meta}),
                   'expected':plain(memory_instance.before(empty,0,ROWS,**empty_meta))})
    guard('after_exact_prediction','after',first,ROWS,later=later)
    guard('after_wrong_prediction','after',first,ROWS,later=control_only)
    guard('after_unknown_scene','after',first,ROWS,later=[[5]*64 for _ in range(64)])
    guard('after_boundary','after',first,ROWS,later=later,epoch=first['chamber_relation_plan']['epoch']+1)
    guard('before_second_current','before',batch,later,index=1)
    guard('before_second_stale','before',batch,ROWS,index=1)
    unknown = copy.deepcopy(batch); unknown['chamber_relation_plan']['predicted'][0] = None
    altered = copy.deepcopy(batch); altered['chamber_relation_plan']['predicted'][0]['axes'][0][1] = '0'
    for name, proposal in [('unknown',unknown),('altered',altered)]:
        ref = 'chamber-relations:' + identity(proposal['chamber_relation_plan'])
        proposal['proposal_id'] = ref; proposal['compositions'][0]['id'] = ref
        proposal['bundle_template']['composition_ref'] = ref; proposal['bundle_template']['outcome_guard']['contains'] = ref
        guard('before_second_prediction_' + name,'before',proposal,later,index=1)
    guard('after_prediction_unknown','after',unknown,ROWS,later=later)
    next_rows = controlled_prediction(later,batch['chamber_relation_plan'],1)
    guard('after_second_current','after',batch,later,later=next_rows,index=1)
    for name, remaining in [('initial',16),('remaining_one',1),('remaining_zero',0),('remaining_negative',-1)]: common(name,ROWS,remaining=remaining)
    common('known_edges',ROWS,seed)
    common('deadline_missing',ROWS,deadline=None)
    hashes={}
    for module in list(sys.modules.values()):
        filename=getattr(module,'__file__',None)
        if filename:
            path=Path(filename).resolve()
            if path.is_relative_to(SOURCE) and path.is_file():
                relative=str(path.relative_to(SOURCE));hashes[relative]=sha(path.read_bytes());assert hashes[relative]==MANIFEST[relative]['sha256']
    result={'schema':'logos-engine.v6.relational-chamber-parity.v1','sourceCommit':COMMIT,
      'generator':str(Path(__file__).relative_to(ROOT)),'generatorSha256':sha(Path(__file__).read_bytes()),
      'pinnedSourceFilesVerifiedBeforeImport':VERIFIED_BEFORE,'pinnedSourceFilesVerifiedAfterRun':verify(),
      'sourceHashes':dict(sorted(hashes.items())), 'policySource':'reference/v6/'+COMMIT+'/source/'+POLICY_PATH,
      'policySourceSha256':sha((SOURCE/POLICY_PATH).read_bytes()),
      'initialPublicCorpus':{'path':CORPUS_PATH,'sha256':sha(CORPUS_RAW),'views':len(CORPUS['games']),'recordedActions':0,'recordedLevelJumps':0},
      'initialMeasurements':measurements,'cases':CASES,'guards':GUARDS,'commons':COMMONS,
      'qualification':{'sourceModified':False,'sourceMonkeyPatched':False,'gameHostRunByExporter':False,'gameSourceRead':False,
        'oracleOrSolutionRead':False,'physicalActions':0,'controlledReturns':'Synthetic measurements and memories are component contracts, never game-success evidence.',
        'digestScope':'Own layer anchored to the original parent digest; shared native owner is a separate integration gate.'}}
    output=ROOT/OUTPUT_PATH
    output.write_bytes(gzip.compress((json.dumps(result,indent=2,ensure_ascii=False)+'\n').encode(),mtime=0))
    print(json.dumps({'output':OUTPUT_PATH,'bytes':output.stat().st_size,'cases':len(CASES),'guards':len(GUARDS),'commons':len(COMMONS)}))
if __name__=='__main__':main()
