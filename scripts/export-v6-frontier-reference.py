#!/usr/bin/env python3
"""Unchanged common_frontier + return_fork oracle, no game/private solver inputs."""
from pathlib import Path
from copy import deepcopy
import hashlib, json, sys

ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT/'reference/v6'/COMMIT/'source'
LAYA = SOURCE/'agents/yf_arc3_v6/laya_proto'
sys.path[:0] = [str(LAYA), str(SOURCE)]
import common_frontier as f
import return_fork as returns
from types import SimpleNamespace

cases = []; scenarios = []
def plain(value): return json.loads(json.dumps(value, ensure_ascii=False))
def obs(ref, frame=None, **change):
    return dict(observation_ref=ref, frame_hash=frame or ref, level_epoch=1, levels_completed=0,
                available_action_refs=['ACTION1', 'ACTION2', 'ACTION6'], state='NOT_FINISHED',
                entities=[dict(id='e1', signature='s1', position=[2, 2], mask=[[0, 0]], area=1)],
                coordinate_basis='screen', **change)
def act(name, data=None): return dict(action_ref=name, **({} if data is None else dict(data=data)))
A1, A2, A6 = act('ACTION1'), act('ACTION2'), act('ACTION6', {'x':2, 'y':2})
a, b, c, a2, b2 = obs('a', 'A'), obs('b', 'B'), obs('c', 'C'), obs('a2', 'A'), obs('b2', 'B')

def capture(name, operation, args):
    case = dict(id=name, operation=operation, args=deepcopy(args))
    try:
        function = {'action':f._action, 'protocol':f._protocol, 'index':f._index, 'ref':f._ref, 'rules':f._rules,
                    'action_key':f._action_key, 'closed_observed_return':returns.closed_observed_path_return}[operation]
        case['expected'] = plain(function(*args))
    except Exception as e: case['error'] = str(e)
    cases.append(case)

class Scenario:
    def __init__(self, name, target=3, maximum=16):
        self.data = dict(id=name, target=target, maximum=maximum, steps=[])
        self.graph = f.ObservedFrontier(target, maximum); self.saved={}
        scenarios.append(self.data)
    def step(self, operation, *args, save=None, **kwargs):
        row = dict(operation=operation, args=deepcopy(args), kwargs=deepcopy(kwargs))
        try:
            if operation == 'guard_saved': result = self.graph.guard(self.saved[args[0]], *args[1:])
            elif operation == 'outcome_saved': result = self.graph.check_outcome(self.saved[args[0]], *args[1:])
            elif operation == 'set_rules': self.graph.rules=deepcopy(args[0]); result=None
            elif operation == 'increment_revision': self.graph.knowledge_revision+=1; result=None
            elif operation == 'return_contrast':
                episode=[(SimpleNamespace(**x),k,SimpleNamespace(**y))for x,k,y in args[0]]
                result=returns.closed_return_contrast(self.graph,episode,*args[1:])
            elif operation == 'propose_return':
                episode=[(SimpleNamespace(**x),k,SimpleNamespace(**y))for x,k,y in args[2]]
                result=self.graph.propose(args[0],args[1],return_episode=episode)
            else: result = getattr(self.graph, operation)(*args, **kwargs)
            row['expected']=plain(result)
            if save: self.saved[save]=deepcopy(result); row['save']=save
        except Exception as e: row['error']=str(e)
        row['deltas']=self.graph.drain_deltas(); row['state']=self.graph.snapshot()
        self.data['steps'].append(row)
        return row.get('expected')

def export():
    for name, action in [('plain', A1),('empty_data',act('ACTION1',{})),('point',A6),('forbidden',dict(A1,game_id='X')),('missing',{})]: capture(name,'action',[action])
    for name, o in [('public',a),('order',dict(a,available_action_refs=['ACTION6','ACTION1','ACTION2'])),('forbidden',dict(a,oracle=True)),('incomplete',{'observation_ref':'x'})]: capture(name,'protocol',[o])
    capture('index','index',[a]); capture('ref','ref',[a]); capture('missing_ref','ref',[{}]); capture('action_key','action_key',[A6])
    capture('rules_empty','rules',[{}])
    capture('closed_path','closed_observed_return',[[{'before_key':'A','after_key':'B','after_ref':'b'},{'before_key':'B','after_key':'A','after_ref':'a2'}]])
    capture('broken_path','closed_observed_return',[[{'before_key':'A','after_key':'X','after_ref':'b'},{'before_key':'B','after_key':'A','after_ref':'a2'}]])
    capture('nested_path','closed_observed_return',[[{'before_key':'Z','after_key':'A','after_ref':'a'},{'before_key':'A','after_key':'B','after_ref':'b'},{'before_key':'B','after_key':'A','after_ref':'a2'}]])
    capture('short_path','closed_observed_return',[[{'before_key':'A','after_key':'A','after_ref':'a'}]])
    s=Scenario('observations_access_and_guards')
    s.step('observe',a,[A1,A2]);s.step('observe',a,[A1,A2]);s.step('observe',a,[A1,A2,A6]);s.step('observe',a,[A1,A2])
    s.step('observe',dict(a,frame_hash='changed'),[A1])
    s.step('propose',a,[A1,A2],save='first',prefix_evidence=[{'evidence_ref':'e1'},{}, {'evidence_ref':'e2'}])
    s.step('guard_saved','first',a,0);s.step('guard_saved','first',a2,0);s.step('guard_saved','first',a,8)
    s.step('record_transition',a,A1,b,after_action_candidates=[A1,A2]);s.step('outcome_saved','first',b,0)
    s.step('record_transition',a,A1,b,after_action_candidates=[A1,A2])
    s.step('record_transition',b,A1,a2,after_action_candidates=[A1,A2])
    s.step('record_transition',a2,A2,obs('a3','A'),after_action_candidates=[A1,A2])
    s.step('can_probe_here',a,A1);s.step('can_probe_here',b,A2)
    s.step('propose',a,[A1,A2],save='access')
    s.step('guard_saved','access',a,0);s.step('guard_saved','access',b,1)
    s.step('outcome_saved','access',b,0);s.step('outcome_saved','access',c,0)
    s.step('guard_saved','access',dict(a,frame_hash='X'),0)
    s.step('guard_saved','access',dict(a,state='WIN'),0)
    s.step('guard_saved','access',dict(a,level_epoch=2),0)
    s.step('increment_revision');s.step('guard_saved','access',a,0)
    s.step('record_transition',a,A1,c,after_action_candidates=[])
    s.step('propose',a,[A1,A2],save='uncertain')
    s.step('record_transition',b,A2,obs('b3','B'),after_action_candidates=[A1,A2])
    s.step('propose',a,[A1,A2]);s.step('propose',dict(a,observation_ref='win',state='WIN'),[A1,A2])
    s.step('propose',dict(a,observation_ref='done',levels_completed=3),[A1,A2])
    s.step('check_outcome',{'steps':[]},a,0)
    # Admission and source/epoch errors remain refusals; no implicit action substitution.
    errors=Scenario('domain_and_assessment_refusals')
    errors.step('observe',a,[A1,A1]);errors.step('observe',a,[act('ACTION99')]);errors.step('observe',a,[A1]*257)
    errors.step('record_transition',a,act('ACTION99'),b)
    errors.step('record_transition',a,A1,b,assessment={'evidence_refs':['wrong','pair']})
    errors.step('propose',a,[A1],curiosity={'observation_ref':'wrong','level_epoch':1})
    errors.step('propose',a,[A1],control_acquisition={'observation_ref':'wrong'})
    # Current candidate predictions, refutations, old scopes and weak acquired priors.
    transition=json.loads((ROOT/'tests/fixtures/v6-transition-reference.json').read_text())
    conditional=next(x for x in transition['cases']if x['name']=='conditional_prediction')
    rule, observation, command = deepcopy(conditional['args'])
    for name, status, epoch in [('candidate','candidate',1),('refuted','refuted',1),('old_scope','mechanism_acquired',9),('acquired','mechanism_acquired',1)]:
        q=Scenario('rule_'+name); q.step('observe',observation,[command,A2])
        summary=f._rules({'empirical_rules':[rule]})[0]; summary['status']=status;summary['scope_epochs']=[epoch]
        q.step('set_rules',{rule['rule_id']:summary});q.step('bind_current_candidate_context',observation,[rule])
        q.step('propose',observation,[command,A2]);q.step('bind_current_candidate_context',dict(observation,frame_hash='stale'),[rule]);q.step('propose',observation,[command,A2])
    capture('rules_evidence','rules',[{'empirical_rules':[rule]}])
    # Explicit curiosity, control acquisition and exact visible input binding.
    q=Scenario('information_and_experimental_questions')
    curiosity={'observation_ref':'a','level_epoch':1,'action':A2,'question':'Which relation changes?', 'evidence':['a'],
               'source':'visible_pair','relations':[['e1','contact']], 'predictions':{'no_change':False,'change':True}}
    q.step('propose',a,[A1,A2,A6],curiosity=curiosity)
    q.step('propose',a,[A1,A2,A6],control_acquisition={'observation_ref':'a','action_ref':'ACTION1','objective':'Acquire translation','evidence':['a']})
    probe={'binding':{'observation_ref':'a','frame_hash':'A','mode':[1,'NOT_FINISHED'],'action':A6,'entity_ref':'e1'},
           'frozen_predictions':{'h0':False,'h1':True},'new_contrast_pairs':[['h0','h1']],'falsifier':'unchanged output',
           'rivals':[{'source_ref':'older'},{'source_ref':'older'}],'question':'Does the visible support discriminate?'}
    q.step('propose',a,[A1,A2,A6],experimental_probes=[probe]);bad=deepcopy(probe);bad['binding']['action']['data']['x']=8
    q.step('propose',a,[A1,A2,A6],experimental_probes=[bad]);bad=deepcopy(probe);bad['frozen_predictions']['h1']=False
    q.step('propose',a,[A1,A2,A6],experimental_probes=[bad])
    control={'kind':'control_after_local_change','binding':{'observation_ref':'a','frame_hash':'A','mode':[1,'NOT_FINISHED'],'action':A1},
             'intervention':{'after':'a'},'expected_receivers':{'e1':{'signature':'s1','before':[2,2]}},'rule_ref':'r1','question':'Control after change','evidence_refs':['a']}
    q.step('propose',a,[A1,A2,A6],control_probe=control);bad=deepcopy(control);bad['expected_receivers']['e1']['before']=[9,9]
    q.step('propose',a,[A1,A2,A6],control_probe=bad)
    q.step('propose',a,[A1,A2,A6],experimental_probes=[probe],control_probe=bad)
    # Repeated return preserves the last fork and does not grant reset authority.
    q=Scenario('closed_return_contrast')
    q.step('observe',a,[A1,A2]);q.step('record_transition',a,A1,b,after_action_candidates=[A1,A2]);q.step('record_transition',b,A1,c,after_action_candidates=[A1,A2]);q.step('record_transition',c,A1,a2,after_action_candidates=[A1,A2])
    def snap(o):return {'ref':o['observation_ref'],'frame_hash':o['frame_hash'],'epoch':o['level_epoch'],'score':o['levels_completed']}
    episode=[(snap(x),'ACTION1',snap(y))for x,y in [(a,b),(b,c),(c,a2)]]
    q.step('return_contrast',episode,f._index(a2),16);q.step('return_contrast',episode,f._index(a2),2)
    q.step('propose_return',a2,[A1,A2],episode)
    hashes={str(p.relative_to(SOURCE)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [LAYA/'common_frontier.py',LAYA/'return_fork.py',LAYA/'common_frontier_policy.drm.json']}
    destination=ROOT/'tests/fixtures/v6-frontier-reference.json'
    destination.write_text(json.dumps({'commit':COMMIT,'sourceHashes':hashes,'cases':cases,'scenarios':scenarios},ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'cases':len(cases),'scenarios':len(scenarios),'operations':sum(len(s['steps'])for s in scenarios),'bytes':destination.stat().st_size}))

if __name__=='__main__':export()
