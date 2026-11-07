"""Measure whether a learned public response persists after an observed intervention."""
import hashlib,json
from common_mechanisms import apply_empirical_rule


def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()


def projected(prediction):
    return {x['variable']:{'signature':x['entity']['signature'],
            'before':prediction['position_context'][x['variable']],'expected_after':x['entity']['position']}
            for x in prediction['predicted_entities']}


class ControlDependencies:
    def __init__(self):
        self.pending=None
        self.attempted=set()

    @staticmethod
    def question_key(epoch, relation, features, receivers):
        """Bound an experiment, without asserting hidden-state equivalence."""
        return digest([epoch, relation, features, receivers])

    def record_attempt(self, key):
        if key in self.attempted:
            raise ValueError('Repeated control experiment in the same declared context')
        self.attempted.add(key)

    def change(self,before,after,point_result):
        self.pending=None
        witness=(point_result or {}).get('record',{})
        if (witness.get('observed_local_change') and witness['observation_ref']==before['observation_ref']
            and witness['after_ref']==after['observation_ref'] and before['level_epoch']==after['level_epoch']
            and before['state']==after['state']):
            self.pending=(before,after,witness)

    def offer(self,obs,actions,rules):
        if self.pending is None:return None
        before,after,w=self.pending
        if obs['observation_ref']!=after['observation_ref'] or obs['frame_hash']!=after['frame_hash']:return None
        inputs={a['action_ref'] for a in actions if not a.get('data')}
        offers=[]
        for rule in rules:
            command=rule.get('conditions',{}).get('action',{})
            if (rule.get('status')!='mechanism_acquired' or command.get('action_ref') not in inputs
                    or command.get('data')):continue
            action={'action_ref':command['action_ref']}
            pre=apply_empirical_rule(rule,before,action);post=apply_empirical_rule(rule,obs,action)
            if pre.get('status')!='prediction' or post.get('status')!='prediction':continue
            receivers=projected(post)
            if not receivers or projected(pre)!=receivers:continue
            # This key limits repeated experiments. It grants no authority to
            # declare other hidden contexts or physical objects equivalent.
            key=digest([obs['level_epoch'],rule['rule_id'],w['features'],receivers])
            if key in self.attempted:continue
            offers.append({'kind':'control_after_local_change','question_key':key,'rule_ref':rule['rule_id'],
                'binding':{'observation_ref':obs['observation_ref'],'frame_hash':obs['frame_hash'],
                    'mode':[obs['level_epoch'],obs['state']],'action':action},
                'expected_receivers':receivers,'evidence_refs':list(dict.fromkeys([before['observation_ref'],after['observation_ref']]+rule['evidence_refs'])),
                'intervention':{'before':before['observation_ref'],'after':after['observation_ref'],'action':w['action'],'entity_ref':w['entity_ref']},
                'question':'Does the acquired receiver response persist after the observed local change?',
                'falsifier':'A uniquely reidentified receiver differs from its predicted screen position; a boundary or ambiguous correspondence yields unknown.',
                'qualification':'Persistence or divergence in this public context; exclusive causal role and terminal relevance remain unknown.'})
        return min(offers,key=lambda p:p['question_key']) if offers else None

    def evaluate(self,selected,before,action,after):
        b=selected['binding']
        if (before['observation_ref']!=b['observation_ref'] or before['frame_hash']!=b['frame_hash']
                or action!=b['action'] or selected['question_key'] in self.attempted):
            raise ValueError('Stale, repeated, or mismatched control experiment')
        receipts={}
        for name,r in selected['expected_receivers'].items():
            hits=[e['position'] for e in after['entities'] if e['signature']==r['signature']]
            receipts[name]={'expected':r['expected_after'],'observed':hits[0] if len(hits)==1 else None}
        boundary=after['level_epoch']!=before['level_epoch'] or after['state']!=before['state']
        verdict='unknown_boundary_or_identity' if boundary or any(v['observed'] is None for v in receipts.values()) else (
            'matched_projected_response' if all(v['expected']==v['observed'] for v in receipts.values()) else 'projected_response_differs')
        self.attempted.add(selected['question_key'])
        return {'question_key':selected['question_key'],'before':before['observation_ref'],'after':after['observation_ref'],
                'rule_ref':selected['rule_ref'],'verdict':verdict,'receivers':receipts,'attempted_once':True,'exclusive_cause_established':False}
