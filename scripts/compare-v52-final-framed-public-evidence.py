#!/usr/bin/env python3
"""Compare the final trajectory, preserving source and native-extension scopes.

The strict original proposal and six-field acquisition are recomputed with
unchanged Python. Native packet receipts are independently measured from actual
public frames, never copied from native outputs. A separate original family
receives only those verified extra observations to recompute extended proposals.
Every difference from the strict source proposal and guard remains explicit.
No original full-caller or unchanged source-campaign success is inferred.
"""
from __future__ import annotations
import argparse
from collections import Counter
import copy
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
from types import SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/migration/native-campaigns-v52/attempt9'
spec = importlib.util.spec_from_file_location('framed_contracts', ROOT/'scripts/export-v6-framed-transfer-reference.py')
contracts = importlib.util.module_from_spec(spec); spec.loader.exec_module(contracts)
helper, g = contracts.helper, contracts.g
spec = importlib.util.spec_from_file_location('native_reception_specification', ROOT/'scripts/measure-v52-native-receptions.py')
reception_spec = importlib.util.module_from_spec(spec); spec.loader.exec_module(reception_spec)
spec = importlib.util.spec_from_file_location('native_uniform_question_specification', ROOT/'scripts/measure-v52-native-uniform-questions.py')
uniform_spec = importlib.util.module_from_spec(spec); spec.loader.exec_module(uniform_spec)
spec = importlib.util.spec_from_file_location('native_phased_reception_specification', ROOT/'scripts/measure-v52-native-phased-receptions.py')
phased_spec = importlib.util.module_from_spec(spec); spec.loader.exec_module(phased_spec)
spec = importlib.util.spec_from_file_location('native_directed_composition_specification', ROOT/'scripts/measure-v52-native-directed-composition.py')
directed_spec = importlib.util.module_from_spec(spec); spec.loader.exec_module(directed_spec)
from agents.yf_arc3_v6.morphology_policy.framed_transfer.family import FramedTransfer
from neutral_observer import measure as observe

PUBLIC_FIELDS = {'frame_rows','frame_packet','level','levels_completed','state','step_index','available_action_refs','frame_hash'}
WRAPPER_KEYS = {'material_access_subquestion','field_subquestion','composition_target_tree','morphology','strategy_receipt'}
SOURCE_RECEIPT_KEYS = {'workflow','src_hash','src_status','executed_statements'}
NATIVE_RECEIPT_KEYS = {'all_executed_statements','instruction_quantum','instructions','trace','execution_engine','reference_commit','reference_semantic_hash',
                       'native_execution_hash','source_definition_hash','edited'}
OBSERVATION_REF = re.compile(r'^(.*):epoch:(\d+):revision:(\d+):frame:([a-f0-9]+)$')
ANNOTATIONS = []

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def packed(value): return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()
def digest(value): return hashlib.sha256(packed(value)).hexdigest()
def exact(a, b): return packed(a) == packed(b)
def directed_only(record):
    return record.get('native_directed_composition_only') is True or record.get('native_packet_witness',{}).get('native_directed_composition_only') is True
def is_typed_question(question): return question.get('basis_kind') in ['current_typed_analogy_prerequisite','mixed_current_reception_prerequisites']
def calibration_evidence_strength(question):
    observed=sum(task.get('basis_kind')!='current_typed_analogy_prerequisite' and task.get('receiver',{}).get('inner_fills_bbox') is True for task in question['tasks'])
    typed=sum(task.get('basis_kind')=='current_typed_analogy_prerequisite' for task in question['tasks'])
    relation=('observed_uniform_prerequisite_and_typed_hypothesis' if typed else 'observed_uniform_prerequisite') if observed else 'typed_hypothesis_only'
    return {'observed_uniform_task_count':observed,'typed_hypothesis_task_count':typed,'relation_support':relation,'control_offset_status':'unknown_until_actual_return'}
def load(path):
    raw = path.read_bytes(); return json.loads(gzip.decompress(raw) if path.suffix == '.gz' else raw)
def proof(path): return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path), 'bytes': path.stat().st_size}
def plain(value): return contracts.plain(copy.deepcopy(value))
def packet_hash(packet): return hashlib.sha256(json.dumps(packet, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
def check(actual, expected, path):
    if exact(actual, expected): return
    if isinstance(actual, dict) and isinstance(expected, dict) and set(actual) == set(expected):
        for key in actual: check(actual[key], expected[key], path + '.' + key)
    elif isinstance(actual, list) and isinstance(expected, list) and len(actual) == len(expected):
        for index, (left, right) in enumerate(zip(actual, expected)): check(left, right, path + f'.{index}')
    raise AssertionError({'path': path, 'actual': actual, 'expected': expected})

def source_projection(value, path):
    if isinstance(value, list): return [source_projection(child, path + f'.{index}') for index, child in enumerate(value)]
    if not isinstance(value, dict): return value
    if SOURCE_RECEIPT_KEYS <= value.keys():
        extra = set(value) - SOURCE_RECEIPT_KEYS
        assert extra <= NATIVE_RECEIPT_KEYS, (path, extra)
        if extra:
            assert path.endswith('.workflow') or path.endswith('.source_choice_workflow'), ('Unexpected SRC annotation path',path)
            assert value['execution_engine'] == 'logos-engine.typescript' and value['reference_commit'] == helper.COMMIT
            assert value['instruction_quantum'] == 128 and isinstance(value['instructions'], int) and value['instructions'] > 0
            assert value['trace'] and len(value['all_executed_statements']) >= len(value['executed_statements'])
            assert re.fullmatch('[a-f0-9]{64}', value['reference_semantic_hash'])
            if 'native_execution_hash' in value:
                assert value['edited'] is False and value['source_definition_hash'] == value['src_hash']
                assert re.fullmatch('[a-f0-9]{64}', value['native_execution_hash'])
            ANNOTATIONS.append({'path': path, 'fields': sorted(extra), 'sha256': digest({key:value[key] for key in sorted(extra)})})
        return {key: source_projection(value[key], path+'.'+key) for key in SOURCE_RECEIPT_KEYS}
    return {key: source_projection(child, path+'.'+key) for key, child in value.items()}

def own_check(native, source, path):
    projected = source_projection(native, path)
    # Both operands are independently qualified, without float or ID conversion.
    left, right = contracts.finite_canonical(projected), contracts.finite_canonical(plain(source))
    if left != right: check(projected, plain(source), path)
    assert left == right
    return helper.hashed(left.encode())

def native_inventory():
    return {p.relative_to(ROOT).as_posix(): sha(p) for folder in ['src/logos-engine','src/runtime']
            for p in sorted((ROOT/folder).rglob('*')) if p.is_file() and p.suffix in ('.ts','.json','.drm')}

def verify_native(paths, allow_failed_campaign=False):
    campaign, trace, execution, source = [load(paths[name]) for name in ['campaign','trace','execution','source']]
    assert campaign['status'] == trace['status'] and campaign['game'] == trace['game'] == 'GARE'
    assert campaign['status'] == 'passed' or (allow_failed_campaign and campaign['status'] == 'failed')
    completed_target = campaign['status'] == 'passed'
    check(campaign['source'], source, 'campaign.source'); assert campaign['sourceUnchangedDuringRun'] and trace['sourceDigest'] == source['digest']
    assert campaign['referenceCommit'] == helper.COMMIT and campaign['pythonAgentModules'] == []
    assert campaign['final']['fullV6Parity'] is False and campaign['final']['sessions'] == 1
    assert source['fileCount'] == len(source['files']) and source['digest'] == digest(source['files'])
    check(native_inventory(), source['files'], 'current.native.files')
    assert execution['exitCode'] == (0 if completed_target else 1) and execution['nativeSourceUnchanged'] is True
    check(execution['nativeSource'], source, 'execution.before'); check(execution['nativeSourceAfter'], source, 'execution.after')
    assert execution['nativeSourceManifestDigest'] == source['digest']
    journal_verification=None
    if execution['schema']=='logos-engine.v52.actual-journaled-campaign-execution.v1':
        runner=ROOT/'scripts/run-v52-journaled-campaign.mjs';harness=ROOT/'tests/helpers/v6-live-game-campaign.ts'
        assert execution['command'][:4]==['node',str(runner),'GARE','3'] and len(execution['command'])==7
        assert execution['executionCodeUnchanged'] is True
        check(execution['runner'],execution['runnerAfter'],'journal.runner.unchanged');check(execution['runner'],proof(runner),'journal.runner.bytes')
        check(execution['harness'],execution['harnessAfter'],'journal.harness.unchanged');check(execution['harness'],proof(harness),'journal.harness.bytes')
        journal_path=ROOT/execution['publicJournal']['path'];check(execution['publicJournal'],proof(journal_path),'journal.retained.bytes')
        journal=[json.loads(line) for line in gzip.decompress(journal_path.read_bytes()).decode().splitlines()]
        check(journal,trace['packets'],'journal.complete_public_trace')
        expected_live=ROOT.parent/f'v52-{paths["campaign"].parent.name}-gare-actual-public-journal.jsonl'
        assert execution['command'][6]==str(expected_live)
        journal_verification={'evidence':proof(journal_path),'completePublicPackets':len(journal),'matchesCompleteTrace':True,
                              'runner':execution['runner'],'harness':execution['harness'],'executionCodeUnchanged':True,
                              'qualification':'The journal is a passive copy of complete actual public commands and returns, not agent input, proposals or a new game.'}
    else:
        assert execution['schema']=='logos-engine.v52.actual-campaign-execution.v1'
        assert execution['command'][:4] == ['node','scripts/run-v44-campaign.mjs','GARE','3'] and len(execution['command']) == 6
    for value, name in zip(execution['command'][4:6], ['campaign','trace']): assert value.endswith('/'+paths[name].relative_to(ROOT).as_posix())
    for key, name in [('report','campaign'),('trace','trace')]: check(execution[key], proof(paths[name]), 'execution.'+key)
    for key in ['generator','output']: check(execution[key], proof(ROOT/execution[key]['path']), 'execution.'+key)
    last = json.loads(gzip.decompress((ROOT/execution['output']['path']).read_bytes()).decode().splitlines()[-1])
    assert last['status'] == campaign['status'] and last['sourceDigest'] == source['digest']
    check(last['final'], campaign['final'], 'log.final'); check(last['boundaries'], campaign['boundaries'], 'log.boundaries')
    assert campaign['final']['actions'] == len(campaign['actions']) == len(trace['packets']) - 1
    assert campaign['final']['prefixes'] == len(campaign['prefixes']) and sum(p['acquiredActions'] for p in campaign['prefixes']) == len(campaign['actions'])
    assert campaign['targetLevels'] == 3
    if completed_target: assert campaign['final']['levelsCompleted'] >= campaign['targetLevels']
    else: assert campaign['final']['levelsCompleted'] < campaign['targetLevels'] and campaign['failure']
    assert campaign['final']['caller']['acquiredTransitions'] == len(campaign['actions'])
    assert all(boundary['sessionRetained'] for boundary in campaign['boundaries'])
    packet_checks = []
    for index, item in enumerate(trace['packets']):
        packet = item['packet']; assert set(packet) == PUBLIC_FIELDS and packet['step_index'] == index
        assert packet['frame_hash'] == hashlib.sha256(json.dumps(packet['frame_rows'], separators=(',', ':')).encode()).hexdigest()[:16]
        if index:
            action = campaign['actions'][index-1]; check(item['command'], action['command'], f'actual.command.{index}')
            assert action['sequence'] == index and action['publicPacketSha256'] == packet_hash(packet)
            assert action['animationFrames'] == len(packet['frame_packet']) and action['frameHash'] == packet['frame_hash']
            assert (action['levelAfter'], action['completedAfter'], action['state']) == (packet['level'], packet['levels_completed'], packet['state'])
        else: assert packet_hash(packet) == campaign['initial']['publicPacketSha256']
        packet_checks.append({'index': index, 'publicPacketSha256': packet_hash(packet), 'canonicalPublicPacketSha256': digest(packet), 'frames': len(packet['frame_packet'])})
    for name, value in campaign['gameAssets'].items(): assert sha(ROOT/'public/python'/name) == value
    return campaign, trace, source, packet_checks, journal_verification

def current_binding_receipt(family, proposal, packet, obs, source_guard):
    """Independent specification of the declared native extension, not source."""
    offer = proposal['framed_transfer_plan']['offer']
    current = g.candidates(packet['frame_rows'], obs, family.policy, family.spans, family.receipts, {})
    matches = [row for row in current if row['candidate_ref'] == offer['candidate_ref'] and row['patches'] == offer['patches']]
    assert len(matches) > 1 and source_guard == {'admitted': False, 'reason': 'current_parallel_support_and_payload'}
    fields = ['candidate_ref','patches','point','point_x','point_y','point_value','bbox','signature']
    physical = all(all(exact(row[key], offer[key]) for key in fields) for row in matches) and exact(offer['point'], [offer['point_y'],offer['point_x']])
    selected = [row for row in matches if row['component_ref'] == offer['component_ref']]
    binding = proposal['steps'][0]['point_binding']
    bound = binding['entity_ref'] == offer['component_ref'] and binding['signature'] == offer['signature'] and exact(binding['bbox'],offer['bbox'])
    bound = bound and exact(binding['point'],[offer['point_x'],offer['point_y']]) and binding['palette_value'] == offer['point_value']
    bound = bound and all(binding[key] == obs[key] for key in ['observation_ref','level_epoch','frame_hash'])
    assert physical and len(selected) == 1 and bound and proposal['actions'][0]['action_ref'] in obs['available_action_refs']
    return {'schema':'logos-engine.native.current-point-binding.v1','rule':'native.current_framed_point_witness','source_guard':source_guard,
            'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash'],
            'current_description_count':len(matches),'current_component_refs':[row['component_ref'] for row in matches],
            'selected_component_ref':offer['component_ref'],'selected_current_bindings':len(selected),'same_physical_point':physical,
            'point_binding_current':bound,'physical_command':proposal['actions'][0],'release_authority':False,'expected_effect_status':'unknown',
            'qualification':'current_public_binding_only_no_effect_claim'}

def empty_packet_state(epoch=None):
    return {'format':'native.framed.public_packet_receptions.v1','epoch':epoch,'receipts':[],'portable':[],'last':None}

def scope_packet_state(state,epoch):
    if state['epoch']==epoch:return state
    portable=list(state['portable'])
    if state['receipts']:
        portable.append({'source_epoch':state['epoch'],'receipts':state['receipts'],'authority':'historical_not_current_permit'})
    return {**empty_packet_state(epoch),'portable':portable}

def packet_premises(annex,obs,choice):
    if annex['epoch']!=obs['level_epoch']:return None
    premises=choice.get('projected',{}).get('premise_claim_refs')
    if not isinstance(premises,list):return None
    records=[record for record in annex['receipts'] if not directed_only(record) and record['source_claim_ref'] in premises]
    if not records:return None
    return {'rule':'native.current_public_packet_reception_premises','observation_ref':obs['observation_ref'],
            'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash'],
            'records':[{'source_claim_ref':record['source_claim_ref'],'record_ref':'native_packet_reception:'+g.digest(record),
                        'evidence':record['evidence'],'packet_witness':record['native_packet_witness']} for record in records],
            'release_authority':False,'expected_effect_status':'unknown',
            'qualification':'Observed public replacements support a current question; packet subframes establish no control law.'}

def packet_binding_receipt(family,annex,proposal,packet,obs,source_guard):
    """The native premise guard is verified separately from source.before."""
    offer=proposal['framed_transfer_plan']['offer'];choice=proposal['framed_transfer_plan']['choice'];action=proposal['actions'][0]
    binding=proposal['steps'][0]['point_binding']
    command_current=exact(action,{'action_ref':family.policy.config['point_action'],'data':{'x':offer['point_x'],'y':offer['point_y']}}) and action['action_ref'] in obs['available_action_refs']
    retained=packet_premises(annex,obs,choice)
    premises_current=retained is not None and exact(retained,proposal['framed_transfer_plan']['native_public_packet_reception'])
    current=g.candidates(packet['frame_rows'],obs,family.policy,family.spans,family.receipts,{})
    matches=[row for row in current if row['candidate_ref']==offer['candidate_ref'] and exact(row['patches'],offer['patches'])]
    selected=[row for row in matches if row['component_ref']==offer['component_ref']]
    fields=['candidate_ref','patches','point','point_x','point_y','point_value','bbox','signature']
    physical=bool(matches) and all(all(exact(row[key],offer[key]) for key in fields) for row in matches) and exact(offer['point'],[offer['point_y'],offer['point_x']])
    bound=binding['entity_ref']==offer['component_ref'] and binding['signature']==offer['signature'] and exact(binding['bbox'],offer['bbox'])
    bound=bound and exact(binding['point'],[offer['point_x'],offer['point_y']]) and binding['palette_value']==offer['point_value'] and all(binding[key]==obs[key] for key in ['observation_ref','level_epoch','frame_hash'])
    projection=family.policy.projections.get(choice['projection_ref']);projection_current=False
    if len(selected)==1 and projection:
        facts=selected[0]['facts']
        projection_current=exact(facts,offer['facts']) and family.policy.holds(projection['all_conditions'],facts) and family.policy.holds(family.policy.config['local_conditions'],facts)
        projection_current=projection_current and family.policy.holds(family.policy.config.get('projection_scope_conditions',{}).get(choice['projection_ref'],[]),facts) and exact(family.policy.projected(projection,facts),choice['projected'])
    assert command_current and premises_current and physical and len(selected)==1 and bound and projection_current
    return {'schema':'logos-engine.native.current-point-binding.v1','rule':'native.current_public_packet_reception_premises',
            'source_guard':source_guard,'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash'],
            'current_description_count':len(matches),'current_component_refs':[row['component_ref'] for row in matches],
            'selected_component_ref':offer['component_ref'],'selected_current_bindings':len(selected),'same_physical_point':physical,
            'point_binding_current':bound,'command_current':command_current,'reception_premises_current':premises_current,
            'projection_current':projection_current,'reception_premises':retained,'physical_command':action,
            'release_authority':False,'expected_effect_status':'unknown',
            'qualification':'Current raster, current point evidence and actual public packet receipts support only a question; no effect is authorized by an intermediate frame.'}

def acquire_packet_annex(annex,policy,before,after,command,first,second,frames):
    annex=scope_packet_state(annex,before['level_epoch'])
    if command['action_ref']!=policy.config['point_action'] or not command.get('data'):return annex,None,None
    evidence=[before['observation_ref'],after['observation_ref']]
    if before['level_epoch']!=after['level_epoch']:
        return scope_packet_state(annex,after['level_epoch']),{'status':'boundary','evidence':evidence,'historical_not_current_permit':True,'derived':[]},None
    measured=reception_spec.measure_current_public_packet_receptions(first,second,before,after,command,frames,policy)
    phased=phased_spec.measure_current_phased_public_packet_receptions(first,second,before,after,command,frames,policy)
    receipts=list(annex['receipts']);derived=[]
    for measurement in [measured,phased]:
        if not measurement['complete']:continue
        for row in measurement['rows']:
            result,workflow=policy.record('policy.record_observed_framed_replacement',row['facts'])
            if result['status']!='derived':continue
            record=plain({**result['record'],'evidence':evidence,
                          'derivation':{'policy':result['policy_ref'],'rule':result['rule_ref'],'event':result['event_ref'],'workflow':workflow},
                          'native_packet_witness':row['packet_witness']})
            if row['packet_witness'].get('native_directed_composition_only') is True:record['native_directed_composition_only']=True
            if not any(exact(record,old) for old in receipts):receipts.append(record)
            derived.append(record)
    complete=measured['complete'] and phased['complete']
    native={'status':'observed_public_packet_receptions' if derived else 'no_supported_public_packet_reception' if complete else 'public_packet_measurement_incomplete',
            'evidence':evidence,'complete':complete,'frame_count':measured['frame_count'],'work_count':measured['work_count']+phased['work_count'],
            'reason':measured.get('reason') or phased.get('reason'),'derived':derived,'intermediate_command_count':0,'causal_action_efficacy_established':False,
            'phased_measurement':{'complete':phased['complete'],'frame_count':phased['frame_count'],'work_count':phased['work_count'],
                'reason':phased.get('reason'),'directed_replacement_count':len(phased['rows']),'source_candidate_authority':False}}
    return {**annex,'receipts':receipts,'last':native},native,{'stationary':measured,'phased_directed_only':phased}

def select_uniform_question(family,obs,rows,source_offers=None,source_choice=None,source_workflow=None,measured=None):
    """Explicit native coordination; policy.choose itself remains original."""
    receipts=family.receipts
    if source_offers is None:source_offers=g.candidates(rows,obs,family.policy,family.spans,receipts,family.attempts)
    if source_choice is None:source_choice,source_workflow=family.policy.choose(source_offers)
    offers,choice,workflow=source_offers,source_choice,source_workflow;precedence=None
    if measured is None:measured=uniform_spec.measure_current_uniform_reception_questions(rows,obs,family.policy,family.spans,receipts,family.attempts,source_offers)
    if measured['complete']:
        if measured['receptionOffers']:
            offers=[*source_offers,*measured['receptionOffers']];choice,workflow=family.policy.choose(offers)
        revalidated=choice['status']=='selected' and choice['projection_ref']=='projection.exploration.revalidated_point_motion_span_question'
        unqualified=choice['status']=='selected' and choice['projection_ref']=='projection.exploration.parallel_solid_band_interface_question'
        calibration_offers=[candidate for candidate in measured['calibrationOffers'] if not revalidated or calibration_evidence_strength(candidate['native_uniform_reception_question'])['observed_uniform_task_count']>0]
        if calibration_offers and (choice['status']=='abstain' or unqualified or revalidated):
            incumbent=offers[choice['index']] if choice['status']=='selected' else None
            precedence={'rule':'native.pure_typed_calibration_preserves_revalidated_control',
                'incumbent_status':choice['status'],'incumbent_projection_ref':choice.get('projection_ref'),
                'incumbent_candidate_ref':incumbent['candidate_ref'] if incumbent else None,
                'incumbent_point':[incumbent['point_x'],incumbent['point_y']] if incumbent else None,
                'incumbent_revalidated_control':revalidated,'incumbent_current_support_exact':incumbent is not None and incumbent['facts'].get('point_span_current_support_exact') is True,
                'incumbent_control_premise_refs':incumbent['facts'].get('point_span_locus_support_claim_refs',[]) if incumbent else [],
                'pure_typed_permitted_only_before':['abstain','projection.exploration.parallel_solid_band_interface_question'],
                'observed_uniform_prerequisite_keeps_existing_precedence':True,
                'measured_calibration_offer_count':len(measured['calibrationOffers']),'eligible_calibration_offer_count':len(calibration_offers)}
            offers=calibration_offers;choice,workflow=family.policy.choose(offers)
    if choice['status']!='selected':return None,measured
    offer=offers[choice['index']];question=offer.get('native_uniform_reception_question');coordination=None
    if question is not None:
        assert measured['complete'] and question['kind'] in ['calibration_dependency','reception_question']
        source_selected=source_offers[source_choice['index']] if source_choice['status']=='selected' else None
        premises=[]
        for record in receipts:
            if record['source_claim_ref'] not in question['receipt_claim_refs']:continue
            premise={'source_claim_ref':record['source_claim_ref'],'record_ref':'framed_reception:'+g.digest(record),
                     'context_epoch':record['context_epoch'],'evidence':record['evidence']}
            if record.get('native_packet_witness'):premise['packet_witness']=record['native_packet_witness']
            premises.append(premise)
        calibration=question['kind']=='calibration_dependency';typed=is_typed_question(question)
        if typed:assert calibration,'A typed prerequisite is not a native reception offer'
        fields=['candidate_ref','component_ref','point','point_x','point_y','point_value','patches','bbox','signature','facts']
        original=any(all(exact(candidate[key],offer[key]) for key in fields) for candidate in source_offers) if calibration else False
        if calibration:assert original
        coordination={'schema':'logos-engine.native.uniform-reception-coordination.v1',
            'rule':('native.current_typed_reception_dependency' if typed else 'native.current_uniform_reception_dependency') if calibration else 'native.current_uniform_reception_question',
            'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash'],
            'question':question,'source_choice':source_choice,'source_choice_workflow':source_workflow,
            'source_choice_scope':'original_candidates_with_current_reception_receipts','reception_premises':premises,
            'source_selected_candidate_ref':source_selected['candidate_ref'] if source_selected else None,
            'source_selected_point':[source_selected['point_x'],source_selected['point_y']] if source_selected else None,
            'selected_candidate_ref':offer['candidate_ref'],'selected_point':[offer['point_x'],offer['point_y']],
            'selected_projection_ref':choice['projection_ref'],'source_offer_count':len(source_offers),
            'current_reception_offer_count':len(measured['receptionOffers']),'current_calibration_offer_count':len(measured['calibrationOffers']),
            **({'calibration_precedence':{**precedence,'selected_basis':calibration_evidence_strength(question),'admissible_against_incumbent':True}} if precedence else {}),
            'selection_scope':('current_source_calibrations_bound_to_a_current_typed_analogy_prerequisite' if typed else 'current_source_calibrations_bound_to_an_observed_reception_prerequisite') if calibration else 'current_source_and_exact_uniform_reception_questions',
            'original_physical_candidate':original,'control_offset_status':'unknown_until_actual_return' if calibration else 'bound_from_current_observed_span',
            'release_authority':False,'expected_effect_status':'unknown',
            'qualification':('A current source-generated point can test the missing operator side of a current typed analogy supported by an unchanged observed uniform-reception receipt; typed reception and control effect remain hypotheses.' if typed else 'A current source-generated point can test the missing operator side of an observed reception task; this action does not claim to perform that reception.') if calibration else 'Exact current geometry and an observed operator offset support a conditional reception question, not an established terminal or control law.'}
    return {'offer':offer,'choice':choice,'workflow':workflow,'coordination':coordination},measured

def select_native_question(family,annex,obs,rows):
    """Original source candidates receive stationary receipts only.

    Directed packet observations enter only this separately declared native
    composition. Keep the original source/annex order in its premise domain.
    """
    assert not any(directed_only(record) for record in family.receipts)
    source_offers=g.candidates(rows,obs,family.policy,family.spans,family.receipts,family.attempts)
    source_choice,source_workflow=family.policy.choose(source_offers)
    uniform=uniform_spec.measure_current_uniform_reception_questions(rows,obs,family.policy,family.spans,family.receipts,family.attempts,source_offers,True)
    directed=None
    if uniform['complete']:
        original_receipts=[record for record in family.receipts if 'native_packet_witness' not in record]
        receipts=[*original_receipts,*(annex['receipts'] if annex['epoch']==obs['level_epoch'] else [])]
        directed=directed_spec.measure_current_directed_receiver_questions(rows,obs,family.policy,family.spans,receipts,family.attempts,
            [*source_offers,*uniform['receptionOffers']],uniform.get('occupiedReceptionPoints',[]))
        if directed['complete'] and directed['offers']:
            ready=[offer for offer in directed['offers'] if offer['native_directed_receiver_question']['kind']=='test_directed_reception']
            stage=ready or directed['offers']
            revalidated=[offer for offer in stage if offer['native_directed_receiver_question']['source_locus_revalidated'] is True]
            domain=revalidated or stage
            choice,workflow=family.policy.choose(domain)
            if choice['status']=='selected':
                offer=domain[choice['index']];question=offer['native_directed_receiver_question']
                original=source_offers[source_choice['index']] if source_choice['status']=='selected' else None
                premises=[]
                for record in receipts:
                    if record['source_claim_ref'] not in question['receipt_claim_refs']:continue
                    premise={'source_claim_ref':record['source_claim_ref'],'record_ref':'framed_reception:'+g.digest(record),
                        'context_epoch':record['context_epoch'],'evidence':record['evidence'],
                        'native_directed_composition_only':record.get('native_directed_composition_only') is True}
                    if record.get('native_packet_witness'):premise['packet_witness']=record['native_packet_witness']
                    premises.append(premise)
                coordination={'schema':'logos-engine.native.directed-receiver-coordination.v1','rule':'native.current_directed_receiver_composition',
                    'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash'],
                    'question':question,'source_choice':source_choice,'source_choice_workflow':source_workflow,
                    'source_selected_point':[original['point_x'],original['point_y']] if original else None,
                    'source_offer_count':len(source_offers),'measured_composition_offer_count':len(directed['offers']),
                    'occupied_uniform_reception_points':uniform.get('occupiedReceptionPoints',[]),
                    'selected_stage':'current_directed_reception_question' if ready else 'current_receiver_anchor_preparation',
                    'selected_strength':'original_source_point_locus_revalidated' if revalidated else 'explicit_competing_offset_hypotheses',
                    'selected_domain_count':len(domain),
                    'selection_rule':'ready_reception_before_preparation_then_revalidated_source_locus_before_exploration_then_unchanged_src',
                    'early_entry_rule':'current_co_carried_pair_and_independent_receiver_with_directed_literal_gap',
                    'reception_premises':premises,'release_authority':False,'expected_effect_status':'unknown','stored_action_sequence':False,
                    'qualification':'One current point tests a directed receiver composition; all compatible offsets remain explicit and the following phase requires a new actual observation.'}
                return {'offer':offer,'choice':choice,'workflow':workflow,'coordination':None,'directed':coordination},{'uniform':uniform,'directed':directed}
    selection,_=select_uniform_question(family,obs,rows,source_offers,source_choice,source_workflow,uniform)
    return selection,{'uniform':uniform,'directed':directed}

def native_expected_proposal(family,annex,obs,rows,remaining,entry):
    if remaining<1 or family.policy.config['point_action'] not in obs['available_action_refs']:return None,None,None
    selection,measured=select_native_question(family,annex,obs,rows)
    if selection is None:return None,None,measured
    selected,choice,workflow,coordination=(selection[key] for key in ['offer','choice','workflow','coordination'])
    directed=selection.get('directed')
    if entry=='analogy' and directed is None:
        conditions=family.policy.config['early_continuation_by_projection'].get(choice['projection_ref'])
        if not conditions or not family.policy.holds(conditions,choice['projected']):return None,selection,measured
    action={'action_ref':family.policy.config['point_action'],'data':{'x':selected['point_x'],'y':selected['point_y']}}
    facts={'framed_interface_current':True}
    native_question=directed['question'] if directed else coordination['question'] if coordination else None
    question_evidence=[*native_question['receipt_claim_refs'],*native_question['span_claim_refs']] if native_question else []
    typed_hypotheses=list(dict.fromkeys(hypothesis['hypothesis_ref'] for task in coordination['question']['tasks'] for hypothesis in task.get('source_hypotheses',[]))) if coordination else []
    evidence=[obs['observation_ref'],*choice['projected'].get('premise_claim_refs',[]),*question_evidence]
    focus='composition:framed:'+selected['candidate_ref']
    purpose=('qualify_current_operator_side_for_current_typed_reception_hypothesis' if is_typed_question(coordination['question']) else 'qualify_current_operator_side_for_observed_uniform_reception') if coordination and coordination['question']['kind']=='calibration_dependency' else choice['projected'].get('subgoal_ref','test_current_framed_relation')
    if directed:purpose='test_current_receiver_translation_toward_a_directed_literal_gap_anchor' if directed['question']['kind']=='prepare_uniform_receiver' else 'test_one_current_directed_reception_through_an_independent_receiver'
    binding={'observation_ref':obs['observation_ref'],'entity_ref':selected['component_ref'],'signature':selected['signature'],'bbox':selected['bbox'],
             'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash'],'point':[selected['point_x'],selected['point_y']],
             'palette_value':selected['point_value'],'source':'measured_parallel_support_pair'}
    premise=packet_premises(annex,obs,choice);annotations={}
    if premise:annotations['native_public_packet_reception']=premise
    if coordination:annotations['native_uniform_reception_question']=coordination
    if directed:annotations['native_directed_receiver_composition']=directed
    proposal={'status':'proposed','kind':'public_framed_transfer','actions':[action],
        'steps':[{'action':action,'expected_after':None,'point_binding':binding}],'facts':facts,
        'binding':{key:obs[key] for key in ['observation_ref','level_epoch','frame_hash','levels_completed']},
        'framed_transfer_plan':{'offer':selected,'choice':choice,'workflow':workflow,'drm_hash':family.policy.loaded.source_hash,**annotations},
        'compositions':[{'id':focus,'role':'conditional_directed_receiver_composition' if directed else 'conditional_framed_relation','observed':False,
            'things':[selected['component_ref'],*([directed['question'][key]['component_ref'] for key in ['source','ghost','receiver']] if directed else [])],
            'properties':{'current_measurement':selected['facts'],'projected':choice['projected'],
                'unknown':['control_effect','interior_rigidity','cargo_role','terminal_role'],'portable_records_not_current':len(family.portable),**annotations},
            'relations':['contributes_to:'+family.policy.config['goal']],'open_question':purpose}],
        'question':{'reason':purpose,'hypothesis_refs':[choice['projection_ref'],*([native_question['question_ref']] if native_question else []),*typed_hypotheses,
            *([hypothesis['hypothesis_ref'] for hypothesis in directed['question']['receipt_hypotheses']] if directed else [])]},'route_refs':evidence,
        'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':family.policy.config['goal'],'purpose':purpose,
            'preconditions':facts,'evidence':evidence,'actions':[action],'preserve_refs':[],'preservation_evidence':{},'outcome_guard':{'path':['value'],'contains':focus}}}
    return proposal,selection,measured

def directed_binding_receipt(family,annex,proposal,packet,obs,source_guard,index):
    current,_=select_native_question(family,annex,obs,packet['frame_rows'])
    offer,choice,workflow=(proposal['framed_transfer_plan'][key] for key in ['offer','choice','workflow']);action=proposal['actions'][0]
    point=proposal['steps'][0]['point_binding'];retained=proposal['framed_transfer_plan']['native_directed_receiver_composition']
    scope=index==0 and all(obs[key]==proposal['binding'][key] for key in ['observation_ref','level_epoch','frame_hash'])
    command=exact(action,{'action_ref':family.policy.config['point_action'],'data':{'x':offer['point_x'],'y':offer['point_y']}}) and action['action_ref'] in obs['available_action_refs']
    offered=current is not None and exact(current['offer'],offer) and exact(offer['point'],[offer['point_y'],offer['point_x']])
    composed=current is not None and current.get('directed') is not None and exact(current['directed'],retained)
    projection=current is not None and exact(current['choice'],choice) and exact(current['workflow'],workflow) and proposal['framed_transfer_plan']['drm_hash']==family.policy.loaded.source_hash
    bound=point['entity_ref']==offer['component_ref'] and point['signature']==offer['signature'] and exact(point['bbox'],offer['bbox'])
    bound=bound and exact(point['point'],[offer['point_x'],offer['point_y']]) and point['palette_value']==offer['point_value'] and all(point[key]==obs[key] for key in ['observation_ref','level_epoch','frame_hash'])
    no_effect=proposal['steps'][0]['expected_after'] is None and current is not None and current.get('directed',{}).get('question',{}).get('physical_task_count')==1
    assert scope and command and offered and composed and projection and bound and no_effect
    return {'schema':'logos-engine.native.current-point-binding.v1','rule':'native.current_directed_receiver_composition','source_guard':source_guard,
        'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash'],
        'scope_current':scope,'command_current':command,'offer_current':offered,'point_binding_current':bound,
        'composition_current':composed,'projection_current':projection,'no_effect_claim':no_effect,
        'current_composition':current['directed'],'physical_command':action,'release_authority':False,'expected_effect_status':'unknown',
        'qualification':'The current composition, directed observation, literal anchor, point and all offset hypotheses are remeasured; one real return is required before any following question.'}

def uniform_binding_receipt(family,annex,proposal,packet,obs,source_guard,index):
    current,_=select_native_question(family,annex,obs,packet['frame_rows'])
    offer,choice,workflow=(proposal['framed_transfer_plan'][key] for key in ['offer','choice','workflow']);action=proposal['actions'][0]
    binding=proposal['steps'][0]['point_binding'];retained=proposal['framed_transfer_plan']['native_uniform_reception_question']
    scope=index==0 and all(obs[key]==proposal['binding'][key] for key in ['observation_ref','level_epoch','frame_hash'])
    command=exact(action,{'action_ref':family.policy.config['point_action'],'data':{'x':offer['point_x'],'y':offer['point_y']}}) and action['action_ref'] in obs['available_action_refs']
    offered=current is not None and exact(current['offer'],offer) and exact(offer['point'],[offer['point_y'],offer['point_x']])
    coordinated=current is not None and current['coordination'] is not None and exact(current['coordination'],retained)
    bound=binding['entity_ref']==offer['component_ref'] and binding['signature']==offer['signature'] and exact(binding['bbox'],offer['bbox']) and exact(binding['point'],[offer['point_x'],offer['point_y']])
    bound=bound and binding['palette_value']==offer['point_value'] and all(binding[key]==obs[key] for key in ['observation_ref','level_epoch','frame_hash'])
    projection=current is not None and exact(current['choice'],choice) and exact(current['workflow'],workflow) and proposal['framed_transfer_plan']['drm_hash']==family.policy.loaded.source_hash
    premise=packet_premises(annex,obs,choice)
    premises_current=('native_public_packet_reception' not in proposal['framed_transfer_plan']) if premise is None else exact(premise,proposal['framed_transfer_plan'].get('native_public_packet_reception'))
    assert scope and command and offered and coordinated and bound and projection and premises_current
    return {'schema':'logos-engine.native.current-point-binding.v1','rule':current['coordination']['rule'],'source_guard':source_guard,
        'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash'],
        'scope_current':scope,'command_current':command,'current_offer':offered,'coordination_current':coordinated,
        'point_binding_current':bound,'projection_current':projection,'packet_premises_current':premises_current,
        'current_coordination':current['coordination'],'current_reception_premises':premise,'selected_component_ref':offer['component_ref'],
        'physical_command':action,'release_authority':False,'expected_effect_status':'unknown',
        'qualification':'A remeasured current typed hypothesis coordinates a missing operator-side test; the original uniform-reception observation is unchanged and the control offset still requires an actual return.' if is_typed_question(current['coordination']['question']) else 'A remeasured current question coordinates an observed reception prerequisite; an unknown operator offset must still be learned from its actual return.'}

def compare(paths, allow_failed_campaign=False):
    campaign, trace, native, packet_checks, journal_verification = verify_native(paths, allow_failed_campaign)
    reference_path = ROOT/'tests/fixtures/v6-framed-transfer-reference.json.gz'
    reference = load(reference_path); probes = [load(ROOT/item['path']) for item in reference['originalPublicProbes']]
    manifest = load(helper.SOURCE.parent/'manifest.json')['files']
    assert len(manifest) == len(helper.VERIFIED_PINNED_SOURCE) == 1786
    for item in [reference,*probes]:
        assert item['sourceCommit'] == helper.COMMIT and item['pinnedSourceFilesVerifiedBeforeImport'] == 1786
        assert sha(ROOT/item['generator']) == item['generatorSha256']
        for path, value in item['sourceHashes'].items(): assert manifest[path]['sha256'] == value
    for item in reference['originalPublicProbes']: assert sha(ROOT/item['path']) == item['sha256']
    assert reference['pinnedSourceFilesVerifiedAfterRun'] == 1786
    first_probe = probes[0]
    assert first_probe['game'] == 'GARE' and first_probe['status'] == 'stopped' and first_probe['reason'] == 'before_guard_refused'
    assert first_probe['actions'] == 12 and first_probe['levelsCompleted'] == 1 and first_probe['frontierEnabled'] is False
    assert all(item['fullOriginalCaller'] is False and item['sessionCount'] == 1 and item['manualPrimingActions'] == item['resets'] == item['levelJumps'] == 0 for item in probes)
    check(first_probe['gameAssetHashes'],campaign['gameAssets'],'assets.source_native')
    matched_packets = 0; first_public_difference = None
    for index, original in enumerate(first_probe['packets']):
        if index>=len(trace['packets']):break
        actual = trace['packets'][index]
        original_public={'packet':original['packet'],'command':original['command']}
        if not exact(actual,original_public):
            first_public_difference={'packetIndex':index,'original':digest(original_public),'native':digest(actual)};break
        matched_packets += 1
    assert matched_packets>=1
    first = next(prefix['framedTransfer'] for prefix in campaign['prefixes'] if prefix.get('framedTransfer'))
    match = OBSERVATION_REF.fullmatch(first['proposal']['binding']['observation_ref']); assert match
    scope = match.group(1)
    observations = [observe(SimpleNamespace(**item['packet']), index+1, scope)[0] for index,item in enumerate(trace['packets'])]
    family,projected_family = FramedTransfer(),FramedTransfer(); annex=empty_packet_state()
    cursor = boundary = 0; checks = []; offers = []; wrappers = []; guard_differences = []; proposal_differences=[];packet_measurements=[];uniform_measurements=[];directed_measurements=[];counts = Counter()
    sys.setprofile(contracts.profile)
    try:
        for prefix_index, prefix in enumerate(campaign['prefixes']):
            if prefix_index % 10 == 0:
                print(json.dumps({'phase':'unchanged_source_component_replay','prefix':prefix_index,'prefixes':len(campaign['prefixes']),'publicReturnsCompared':cursor}),file=sys.stderr,flush=True)
            obs = observations[cursor]; packet = trace['packets'][cursor]['packet']; captured = prefix.get('framedTransfer')
            proposal = strict_proposal = None;annex=scope_packet_state(annex,obs['level_epoch'])
            if captured:
                remaining = campaign['budget']['levelActionCaps'][min(obs['level_epoch']-1,len(campaign['budget']['levelActionCaps'])-1)] - (cursor-boundary)
                if prefix['selectionGroup'] == 'window_constraints':
                    assert prefix['fieldSubquestion'] == 'observed_framed_analogy'
                    entry='analogy';counts['analogyEntrypoints'] += 1
                else:
                    assert prefix['selectionGroup'] == 'factored_material_return' and prefix['materialSubquestion'] == 'observed_framed_transfer'
                    entry='propose';counts['proposeEntrypoints'] += 1
                strict_proposal=getattr(family,entry)(obs,packet['frame_rows'],[],remaining)
                projected_state=family.state();projected_state['receipts']+=copy.deepcopy([record for record in annex['receipts'] if not directed_only(record)])
                projected_family.restore(projected_state)
                source_algorithm_proposal=getattr(projected_family,entry)(obs,packet['frame_rows'],[],remaining)
                proposal,selection,selection_measurements=native_expected_proposal(projected_family,annex,obs,packet['frame_rows'],remaining,entry)
                assert proposal and prefix['family'] == 'public_framed_transfer' and captured['stateNode'] == 'family_state:public_framed_transfer'
                family.bind(proposal,None)
                native_premises=proposal['framed_transfer_plan'].get('native_public_packet_reception')
                if native_premises:
                    counts['proposalsWithNativePacketPremises']+=1
                coordination=proposal['framed_transfer_plan'].get('native_uniform_reception_question')
                directed=proposal['framed_transfer_plan'].get('native_directed_receiver_composition')
                if coordination:
                    counts['nativeUniform:'+coordination['question']['kind']]+=1
                    if is_typed_question(coordination['question']):counts['nativeTypedCalibrationProposals']+=1
                if directed:
                    counts['nativeDirected:'+directed['question']['kind']]+=1
                    counts['nativeDirected:'+directed['selected_strength']]+=1
                uniform_measurements.append({'prefixIndex':prefix_index,'firstAction':cursor+1,'measurement':selection_measurements['uniform'],
                    'selectedCoordination':coordination,'qualification':'Separate native question domain and native calibration priority; unchanged source policy chooses within the explicitly declared current domain.'})
                directed_measurements.append({'prefixIndex':prefix_index,'firstAction':cursor+1,'measurement':selection_measurements['directed'],
                    'selectedCoordination':directed,'qualification':'Separate native one-step composition of current co-carried masks, an independent uniform receiver, a literal directed gap and all compatible offset hypotheses. Preparation is not an observed reception; following control requires a new actual return.'})
                actual = captured['proposal']; extra = set(actual)-set(proposal)
                assert extra <= WRAPPER_KEYS and not(set(proposal)-set(actual)),extra
                provider = {key:value for key,value in actual.items() if key not in extra}
                provider_digest = own_check(provider,proposal,f'provider.{prefix_index}')
                strict_equal=exact(plain(proposal),plain(strict_proposal))
                counts['strictSourceProposalsUnchanged' if strict_equal else 'nativeProposalsDifferFromStrictSource']+=1
                offers.append({'prefixIndex':prefix_index,'firstAction':cursor+1,'strictSourceProposalSha256':digest(plain(strict_proposal)),
                               'independentlyExpectedProposalSha256':digest(plain(proposal)),'nativeSourceProjectionSha256':provider_digest,
                               'allProviderFieldsCompared':True,'strictSourceProposalUnchanged':strict_equal,
                               'nativePacketPremisesUsed':native_premises is not None,'nativeUniformQuestionUsed':coordination is not None,
                               'nativeDirectedCompositionUsed':directed is not None})
                if not strict_equal:
                    proposal_differences.append({'prefixIndex':prefix_index,'firstAction':cursor+1,'strictSourceProposal':plain(strict_proposal),
                        'sourceAlgorithmWithStationaryNativeReceipts':plain(source_algorithm_proposal),'nativeExpectedProposal':plain(proposal),
                        'nativePremiseAnnotation':native_premises,'nativeUniformCoordination':plain(coordination),'nativeDirectedCoordination':plain(directed),
                        'phasedDirectedOnlyReceiptsExcludedFromOriginalCandidates':True,
                        'qualification':'Native packet observations, additional uniform questions, conditional calibration priority and directed one-step composition are independently verified extensions. Neither the extended offer domain nor its proposal is attributed to the unmodified original source capability.'})
                wrappers.append({'prefixIndex':prefix_index,'fields':sorted(extra),'sha256':digest({key:actual[key] for key in sorted(extra)})})
                counts['selected:'+proposal['framed_transfer_plan']['choice']['projection_ref']] += 1
            else: counts['foreignPrefixes'] += 1
            retained = prefix['framedAcquisition']; assert retained['stateNode'] == 'family_state:public_framed_transfer' and retained['checkpointFormat'] == 'native.public_framed_transfer.v2'
            acquired = retained['acquired']; offset = 0; binding_offset = 0
            for index in range(prefix['acquiredActions']):
                first = trace['packets'][cursor]['packet']; second = trace['packets'][cursor+1]['packet']
                before,after = observations[cursor:cursor+2]; command = trace['packets'][cursor+1]['command']
                guard = None
                if proposal:
                    own_check(command,proposal['actions'][index],f'command.{cursor+1}')
                    guard = family.before(proposal,index,SimpleNamespace(**first),before)
                    uses_packet_premises='native_public_packet_reception' in proposal['framed_transfer_plan']
                    uses_uniform_question='native_uniform_reception_question' in proposal['framed_transfer_plan']
                    uses_directed_composition='native_directed_receiver_composition' in proposal['framed_transfer_plan']
                    counts['strictSourceGuardsAdmitted' if guard['admitted'] else 'strictSourceGuardsRefused']+=1
                    if uses_directed_composition or uses_uniform_question or uses_packet_premises or not guard['admitted']:
                        if uses_directed_composition:
                            expected=directed_binding_receipt(projected_family,annex,proposal,first,before,guard,index)
                            reason='native_current_directed_receiver_composition_bound';counts['nativeDirectedCompositionGuards']+=1
                        elif uses_uniform_question:
                            expected=uniform_binding_receipt(projected_family,annex,proposal,first,before,guard,index)
                            reason='native_current_uniform_reception_question_bound';counts['nativeUniformQuestionGuards']+=1
                        elif uses_packet_premises:
                            expected=packet_binding_receipt(projected_family,annex,proposal,first,before,guard)
                            reason='native_current_packet_reception_question_bound';counts['nativePacketPremiseGuards']+=1
                        else:
                            expected = current_binding_receipt(family,proposal,first,before,guard)
                            reason='native_current_framed_point_witness_bound';counts['nativeDuplicateDescriptionGuards']+=1
                        binding = prefix.get('nativeBindings',[])[binding_offset]; binding_offset += 1
                        assert binding['index'] == index and binding['observation_ref'] == before['observation_ref']
                        check(binding['command'],command,f'extension.command.{cursor+1}')
                        own_check(binding['native_binding_receipt'],expected,f'extension.receipt.{cursor+1}')
                        assert binding['evidence_node'] == 'reasoning:binding:'+str(before['revision'])
                        retained_guard = binding['retainedGuard']
                        for key in ['observation_ref','level_epoch','frame_hash']: assert retained_guard[key] == before[key]
                        check(retained_guard['command'],command,f'extension.retained.command.{cursor+1}')
                        own_check(retained_guard['guard'],{'admitted':True,'reason':reason,'native_binding_receipt':expected},f'extension.retained.guard.{cursor+1}')
                        assert 'before ordinary WHY/ACT release' in retained_guard['qualification']
                        guard_differences.append({'actionIndex':cursor+1,'prefixIndex':prefix_index,'sourceGuard':guard,'nativeGuard':retained_guard['guard'],
                                                  'evidenceNode':binding['evidence_node'],'sourceGuardIntentionallyUnchanged':True,
                                                  'changesSourceAdmissibility':not guard['admitted']})
                    else: counts['ordinarySourceGuardsUsed'] += 1
                observed = family.record(before,after,command,first['frame_rows'],second['frame_rows'],proposal,index)
                annex,native_observed,measured=acquire_packet_annex(annex,family.policy,before,after,command,first['frame_rows'],second['frame_rows'],second['frame_packet'])
                expected_result={'status':'public_transition_acquired','source_result':observed,'native_result':native_observed} if native_observed is not None else observed
                if expected_result is not None:
                    fact = acquired[offset]; offset += 1
                    assert fact['key'] == 'framed_transfer_event:'+str(prefix['decisionRevision']+index)
                    assert fact['evidence'] == after['observation_ref'] and fact['revision'] == after['revision']
                    own_check(fact['result'],expected_result,f'acquisition.{cursor+1}'); counts['acquiredEvents'] += 1
                if observed is not None:
                    counts['strictSourceAcquiredEvents']+=1;counts['derivedSourceRecords'] += len(observed.get('derived',[]))
                if native_observed is not None:
                    counts['nativePacketAcquisitions']+=1;counts['nativePacketDerivedRecords']+=len(native_observed['derived'])
                    counts['nativePhasedDirectedOnlyDerivedRecords']+=sum(directed_only(record) for record in native_observed['derived'])
                    counts['nativeStationaryDerivedRecords']+=sum(not directed_only(record) for record in native_observed['derived'])
                if measured is not None:
                    packet_measurements.append({'actionIndex':cursor+1,'measurement':plain(measured),
                        'qualification':'Two separate independent native acquisition specifications over actual public frames: stationary receptions and phased directed-only observations. Original source acquisition is compared separately; directed-only receipts never enter its candidate domain.'})
                checks.append({'actionIndex':cursor+1,'prefixIndex':prefix_index,'selectedFramedProvider':proposal is not None,
                               'sourceGuard':plain(guard),'sourceAcquisitionSha256':digest(plain(observed)),
                               'sourceStateSha256':digest(plain(family.state())),'nativeAnnexAcquisitionSha256':digest(plain(native_observed)),
                               'nativeAnnexStateSha256':digest(annex)})
                cursor += 1
                if after['levels_completed'] > before['levels_completed']: boundary = cursor
            assert offset == len(acquired) and binding_offset == len(prefix.get('nativeBindings',[]))
            own_check(retained['sourceState'],family.state(),f'own.state.{prefix_index}')
            own_check(retained['nativeCheckpoint'],{'format':'native.public_framed_transfer.v2','source_state':family.state(),
                      'public_packet_receptions':annex},f'complete.native.checkpoint.{prefix_index}')
        assert cursor == campaign['final']['actions'] and guard_differences
    finally: sys.setprofile(None)
    assert not contracts.PENDING
    assert helper.verify_source_manifest() == helper.VERIFIED_PINNED_SOURCE
    check(native_inventory(),native['files'],'native.files.after.readonly.comparison')
    imports = helper.source_hashes()
    for path,value in imports.items(): assert manifest[path]['sha256'] == value
    return {'schema':'logos-engine.v52.final-framed-transfer-public-comparison.v1','status':'passed','referenceCommit':helper.COMMIT,
            'sourceModified':False,'pinnedSourceFilesVerifiedBeforeImport':1786,'pinnedSourceFilesVerifiedAfterRun':1786,
            'sourceHashes':imports,'importedSourceModuleCount':sum(path.endswith('.py') for path in imports),
            'explicitLocalPolicyFileCount':sum(not path.endswith('.py') for path in imports),
            'qualification':{'gameHostRunByComparator':False,'nativeAgentRunByComparator':False,'nativeOutputsUsedAsExpected':False,
                'fullOriginalCallerParity':False,'fullOriginalCampaignMatched':False,'identifierSubstitution':False,
                'scope':'The strict original proposal and original candidates with stationary additional receipts remain explicit counterfactuals. Phased directed-only observations never enter original candidates. New uniform questions, missing-side calibration for current typed hypotheses, native calibration priority and directed receiver preparation or discrimination are recomputed independently; unchanged source SRC policy selects within their declared offer domains. Preparation is not reception, a current-shape analogy is not an observed law, and every competing offset remains explicit at its physical point. Original six-field acquisition, both native annex measurements, complete checkpoints and every native guard are compared on each actual public return, including passive foreign acquisition. Full-caller selection and bounded reduction search remain outside original component parity.',
                'originalFailure':'The unchanged isolated source stops after twelve actions and one level; its refusal is preserved. Any later native progress is not attributed to that isolated source campaign.',
                'nativeTargetReached':campaign['status']=='passed','nativeCampaignStatus':campaign['status'],
                'nativePacketExtensionIsOriginalSourceCapability':False,'allNativeProposalsEqualStrictOriginalProposals':not proposal_differences,
                'nativeUniformQuestionsAreOriginalSourceCapability':False,'nativeTypedCalibrationIsOriginalSourceProposal':False,'nativeCalibrationPriorityIsOriginalSourceSelection':False,
                'nativePhasedReceptionIsOriginalSourceCapability':False,'nativeDirectedCompositionIsOriginalSourceCapability':False,
                'phasedDirectedOnlyReceiptsEnterOriginalCandidates':False,'preparedReceiverClaimedAsObservedReception':False,
                'numerics':'Exact safe-integer JSON bytes for observed component identity operands. No general Python float JSON identity equivalence is claimed.',
                'sourceReceiptFields':sorted(SOURCE_RECEIPT_KEYS),'excludedNativeReceiptAnnotations':sorted(NATIVE_RECEIPT_KEYS)},
            'inputs':{name:proof(path) for name,path in paths.items()},'referenceContracts':proof(reference_path),
            'nativeExtensionSpecification':{'generator':proof(ROOT/'scripts/measure-v52-native-receptions.py'),
                'contract':reception_spec.CONTRACT,'sourceHelpersUnmodified':True,'nativeOutputsUsedAsExpected':False,
                'qualification':'Independent verification implementation of a new native acquisition rule. This file is not part of the pinned Python capability.'},
            'nativeUniformQuestionSpecification':{'generator':proof(ROOT/'scripts/measure-v52-native-uniform-questions.py'),
                'contract':uniform_spec.CONTRACT,'sourceHelpersUnmodified':True,'nativeOutputsUsedAsExpected':False,
                'qualification':'Independent verification of a new current question domain. Original geometry and SRC policy are reused without replacing source candidates or editing original source code.'},
            'nativePhasedReceptionSpecification':{'generator':proof(ROOT/'scripts/measure-v52-native-phased-receptions.py'),
                'contract':phased_spec.CONTRACT,'sourceHelpersUnmodified':True,'nativeOutputsUsedAsExpected':False,
                'qualification':'Independent verification of a monotone contextual framed appearance after all relevant observed support endpoints have settled. A directed-only receipt asserts neither global component identity nor a control law.'},
            'nativeDirectedCompositionSpecification':{'generator':proof(ROOT/'scripts/measure-v52-native-directed-composition.py'),
                'contract':directed_spec.CONTRACT,'sourceHelpersUnmodified':True,'nativeOutputsUsedAsExpected':False,
                'qualification':'Independent current geometry and offset-hypothesis domain. The complete original point-span locus and unchanged SRC distinguish a revalidated question from an ambiguous interface question; no offset is selected by falsifying the source binding cardinality.'},
            'originalProbes':[proof(ROOT/item['path']) for item in reference['originalPublicProbes']],
            'nativeSourceDigest':native['digest'],'nativeSourceFileCount':native['fileCount'],
            'nativeCampaign':{key:campaign['final'][key] for key in ['actions','prefixes','levelsCompleted','level','state','sessions','nativeImplementation','reason']},
            'preservedOriginalPrefix':{'commands':matched_packets-1,'completePublicPackets':matched_packets,'originalCompletedLevels':first_probe['levelsCompleted']},
            'firstOriginalPublicTrajectoryDifference':first_public_difference,
            'counts':dict(counts),'completePackets':packet_checks,'actualPublicJournal':journal_verification,'providerChecks':offers,'transitionChecks':checks,
            'nativeGuardExtensions':guard_differences,'nativeProposalExtensions':proposal_differences,
            'nativePacketMeasurements':packet_measurements,'nativeUniformMeasurements':uniform_measurements,'nativeDirectedMeasurements':directed_measurements,'completeNativeCheckpointsCompared':len(campaign['prefixes']),
            'wrapperAnnotations':wrappers,'srcReceiptAnnotations':ANNOTATIONS,
            'identityRecipes':list(contracts.RECIPES.values()),'finalSourceState':plain(family.state()),'finalNativePacketState':annex}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--campaign',default=str((OUT/'gare-three-levels.json').relative_to(ROOT)))
    parser.add_argument('--trace',default=str((OUT/'gare-public-trace.json.gz').relative_to(ROOT)))
    parser.add_argument('--execution',default=str((OUT/'execution-gare.json').relative_to(ROOT)))
    parser.add_argument('--source',default=str((OUT/'source-manifest.json').relative_to(ROOT)))
    parser.add_argument('--output',default=str((OUT/'framed-transfer-original-comparison.json').relative_to(ROOT)))
    parser.add_argument('--identities',default=str((OUT/'framed-transfer-identity-recipes.json.gz').relative_to(ROOT)))
    parser.add_argument('--allow-failed-campaign',action='store_true',help='Compare retained public evidence of a failed target without classifying the campaign as successful')
    parser.add_argument('--verify',action='store_true',help='Recompute without changing retained comparison evidence')
    args = parser.parse_args(); paths = {name:ROOT/getattr(args,name) for name in ['campaign','trace','execution','source']}
    destination,identity_path = ROOT/args.output,ROOT/args.identities
    if destination.exists() and not args.verify: raise FileExistsError(destination)
    if identity_path.exists() and not args.verify: raise FileExistsError(identity_path)
    result = compare(paths,args.allow_failed_campaign); result.update(generator=proof(Path(__file__)))
    recipes=result.pop('identityRecipes')
    identities={'schema':'logos-engine.v52.framed-transfer-derived-identities.v1','referenceCommit':helper.COMMIT,
                'nativeSourceDigest':result['nativeSourceDigest'],'nativeCampaignStatus':result['qualification']['nativeCampaignStatus'],
                'sourceModified':False,'identifierSubstitution':False,'source':'Unchanged Python digest functions on actual public inputs and on separately declared independently recomputed native packet observations',
                'numericScope':'Exact safe-integer JSON operands only; no general Python float identity claim','recipes':recipes}
    identities_encoded=json.dumps(identities,sort_keys=True,separators=(',',':'))+'\n'
    if args.verify: assert load(identity_path)==identities,'Retained identity recipes differ from independent source recomputation'
    else: identity_path.write_bytes(gzip.compress(identities_encoded.encode(),mtime=0))
    result.update(identityEvidence=proof(identity_path),identityRecipeCount=len(recipes))
    encoded=json.dumps(result,sort_keys=True,indent=2)+'\n'
    if args.verify:
        assert destination.read_text()==encoded,'Retained comparison differs from independent recomputation'
    else:destination.write_text(encoded)
    print(json.dumps({'output':destination.relative_to(ROOT).as_posix(),'status':result['status'],'mode':'verify' if args.verify else 'create',
                      'nativeCampaign':result['nativeCampaign'],'counts':result['counts'],
                      'guardExtensions':len(result['nativeGuardExtensions']),'identityRecipes':len(recipes),
                      'receiptAnnotations':len(result['srcReceiptAnnotations'])}))

if __name__ == '__main__': main()
