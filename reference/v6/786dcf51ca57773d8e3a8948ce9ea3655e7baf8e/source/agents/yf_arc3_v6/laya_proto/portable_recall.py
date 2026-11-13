"""Experimental cross-epoch questions from measured local translation roles.

An acquired parent remains bound to its original epoch and all its variables.
The projected hypothesis has its own identifier, measured local context and
falsifier. It can authorize only an information question through physical SRC.
"""
import hashlib
import json
from collections import defaultdict

from common_frontier import ObservedFrontier
from common_mechanisms import _shape, _support


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def normalized_action(action):
    if set(action) - {'action_ref', 'data'} or not isinstance(action.get('action_ref'),str) or not isinstance(action.get('data',{}),dict):
        raise ValueError('Unrecognized physical action schema')
    return {'action_ref': action['action_ref'], **({'data': action['data']} if action.get('data') else {})}


def guard_portable_release(probe, observation, operation, commands, committed_digest):
    if not probe or operation!='OP18' or len(commands)!=1:
        return False
    fingerprint=digest({k:v for k,v in probe.items() if k!='prediction_digest'})
    return (fingerprint==probe['prediction_digest']==committed_digest and probe['observation_ref']==observation['observation_ref'] and
        probe['target_epoch']==observation['level_epoch']!=probe['acquisition_epoch'] and
        probe['predictive_use_allowed'] is False and probe['action']==normalized_action(commands[0]))


class Scene:
    def __init__(self, observation):
        self.observation = observation
        self.shapes = defaultdict(list)
        self.pixels = {}
        self.conflicts = set()
        for entity in observation['entities']:
            self.shapes[entity['signature']].append(entity)
            for point in _support(entity) or ():
                value = entity.get('palette_value')
                if point in self.pixels and self.pixels[point] != value:
                    self.conflicts.add(point)
                self.pixels[point] = value

    def bind(self, shape):
        matches = [e for e in self.shapes[shape['signature']] if _shape(e)==shape]
        return matches[0] if len(matches)==1 else None

    def corridor(self, entity, displacement, margin):
        support = _support(entity)
        if not support:
            return None
        dx, dy = displacement
        xs, ys = zip(*support)
        left, top = min(xs)+min(dx,0)-margin, min(ys)+min(dy,0)-margin
        right, bottom = max(xs)+max(dx,0)+margin, max(ys)+max(dy,0)+margin
        pattern = []
        for y in range(top,bottom+1):
            row = []
            for x in range(left,right+1):
                point = x,y
                if point not in self.pixels or point in self.conflicts or self.pixels[point] is None:
                    return None
                row.append([self.pixels[point], point in support])
            pattern.append(row)
        return digest(pattern)


def projected_role(rule):
    if rule.get('rule_family')!='translation_relation' or not rule.get('scope',{}).get('exact_support_measured'):
        return None
    offsets = rule['effect']['variable_translations']
    moving = [v for v in rule['conditions']['variables'] if offsets[v['name']]!=[0,0]]
    if len(moving)!=1:
        return None
    variable = moving[0]
    return variable['measured_shape'], offsets[variable['name']], variable['name']


class PortableRecall:
    def __init__(self, *, minimum_source_positions=2, corridor_margin_pixels=1, experimental_priority=-1):
        if minimum_source_positions<2 or corridor_margin_pixels<1:
            raise ValueError('Portable calibration must preserve multiple positions and a measured surrounding neighborhood')
        self.minimum_source_positions=minimum_source_positions
        self.corridor_margin_pixels=corridor_margin_pixels
        self.experimental_priority=experimental_priority
        self.cases = defaultdict(list)
        self.attempted = set()

    def apply(self, event):
        if event['kind']=='portable_role_observed':
            self.cases[event['condition_digest']].append(event['witness'])
        elif event['kind']=='portable_role_trial':
            self.attempted.add(event['trial_key'])
        else:
            raise ValueError('Unexpected portable evidence kind')

    def calibrate(self, before, action, after, rules):
        if before['level_epoch']!=after['level_epoch'] or before['state']!=after['state']:
            return []
        action = normalized_action(action)
        usable = [r for r in rules if r.get('conditions',{}).get('action')==action and
            r['conditions'].get('observable_mode',{}).get('level_epoch')==before['level_epoch'] and
            all(before.get(k)==v for k,v in r['conditions']['observable_mode'].items()) and projected_role(r)]
        if not usable:
            return []
        source, result = Scene(before), Scene(after)
        events = []
        for rule in usable:
            shape, displacement, role = projected_role(rule)
            entity = source.bind(shape)
            if entity is None:
                continue
            corridor = source.corridor(entity,displacement,self.corridor_margin_pixels)
            if corridor is None:
                continue
            key = digest([rule['rule_id'],role,corridor])
            observed = result.bind(shape)
            position = entity['position']
            expected = [a+b for a,b in zip(position,displacement)]
            witness = {'before_ref':before['observation_ref'],'after_ref':after['observation_ref'],
                'position':position,'matched':observed is not None and observed['position']==expected,
                'source_rule_status':rule['status']}
            event = {'kind':'portable_role_observed','condition_digest':key,'witness':witness}
            self.apply(event); events.append(event)
        return events

    def candidates(self, observation, actions, rules):
        epoch = observation['level_epoch']
        available = [normalized_action(a) for a in actions]
        parents = [r for r in rules if r.get('status')=='mechanism_acquired' and r.get('predictive_use_allowed') and
            projected_role(r) and r['conditions']['observable_mode'].get('level_epoch')!=epoch]
        if not parents:
            return []
        scene = Scene(observation)
        proposals = []
        for parent in parents:
            conditions = parent['conditions']; action = conditions['action']; mode = conditions['observable_mode']
            if action not in available or conditions['coordinate_basis']!=observation.get('coordinate_basis'):
                continue
            if any(observation.get(k)!=val for k,val in mode.items() if k!='level_epoch'):
                continue
            shape, displacement, role = projected_role(parent)
            entity = scene.bind(shape)
            if entity is None:
                continue
            corridor = scene.corridor(entity,displacement,self.corridor_margin_pixels)
            if corridor is None:
                continue
            key = digest([parent['rule_id'],role,corridor]); witnesses = self.cases.get(key,[])
            if any(not w['matched'] for w in witnesses) or len({tuple(w['position']) for w in witnesses})<self.minimum_source_positions:
                continue
            trial_key = digest([epoch,action,shape,displacement,corridor])
            if trial_key in self.attempted:
                continue
            position = entity['position']
            expected = [a+b for a,b in zip(position,displacement)]
            prediction = {'shape':shape,'position':expected,'unique':True}
            probe = {'schema':'portable_translation_probe_v1','hypothesis_ref':'portable:'+key,
                'observation_ref':observation['observation_ref'],'target_epoch':epoch,'action':action,
                'parent_rule_id':parent['rule_id'],'parent_rule_digest':digest(parent),'parent_status':parent['status'],
                'acquisition_epoch':mode['level_epoch'],'source_role':role,'source_witness_refs':[w['before_ref'] for w in witnesses],
                'distinct_source_positions':len({tuple(w['position']) for w in witnesses}),
                'omitted_parent_variables':[v['name'] for v in conditions['variables'] if v['name']!=role],
                'omitted_parent_relation_count':len(conditions['relations']),'source_mode_except_epoch':{k:v for k,v in mode.items() if k!='level_epoch'},
                'corridor_digest':corridor,'current_position':position,'prediction':prediction,'trial_key':trial_key,
                'falsifier':'same-epoch public observation lacks exactly one matching measured shape at predicted position',
                'use':'one OP18 experiment','experimental_priority':self.experimental_priority,
                'corridor_margin_pixels':self.corridor_margin_pixels,'predictive_use_allowed':False,'original_epoch_guard_preserved':True}
            probe['prediction_digest']=digest(probe);proposals.append(probe)
        # Contradictory forecasts for the same observable role do not select a probe.
        effects = defaultdict(set)
        for probe in proposals:
            group = digest([probe['action'],probe['prediction']['shape']]);effects[group].add(tuple(probe['prediction']['position']))
        unique = {}
        for probe in sorted(proposals,key=lambda p:(-p['distinct_source_positions'],p['hypothesis_ref'])):
            if len(effects[digest([probe['action'],probe['prediction']['shape']])])==1:
                unique.setdefault(probe['trial_key'],probe)
        return list(unique.values())

    def observe_trial(self, probe, after):
        if digest({k:v for k,v in probe.items() if k!='prediction_digest'})!=probe['prediction_digest']:
            raise ValueError('Pre-dispatch portable prediction no longer matches its digest')
        if after['observation_ref']==probe['observation_ref']:
            raise ValueError('Portable trial requires an independently received next observation')
        status='unknown_boundary_or_mode_change'
        if after['level_epoch']==probe['target_epoch'] and after['state'] not in {'WIN','GAME_OVER'} and all(
                after.get(k)==v for k,v in probe['source_mode_except_epoch'].items()):
            hit=Scene(after).bind(probe['prediction']['shape'])
            status='confirmed_here' if hit is not None and hit['position']==probe['prediction']['position'] else 'refuted_here'
        event={'kind':'portable_role_trial','trial_key':probe['trial_key'],'hypothesis_ref':probe['hypothesis_ref'],
            'prediction_digest':probe['prediction_digest'],'before_ref':probe['observation_ref'],'after_ref':after['observation_ref'],
            'status':status,'predictive_use_allowed':False}
        self.apply(event);return event


class RecallFrontier(ObservedFrontier):
    """An optional, current-node experiment question. Ordinary ranking stays in the base frontier."""
    def propose_with_recall(self, observation, actions, probes, temporal_probes=(),max_prefix=None,return_episode=()):
        current=self.observe(observation,actions)
        self._portable_index=current['observation_index'];self._portable_probes=probes;self._temporal_probes=temporal_probes
        try:
            proposal=self.propose(observation,actions,max_prefix=max_prefix,return_episode=return_episode)
            chosen=proposal.get('question',{}).get('temporal_prediction_digest')
            if chosen:
                probe=next(p for p in temporal_probes if p['prediction_digest']==chosen)
                template=proposal['bundle_template'];template['purpose']=probe['question']
                for composition in proposal['compositions']:
                    if composition['id']==template['composition_ref']:
                        composition['properties']={**composition.get('properties',{}),'tracked_public_shape':probe['signature'],
                            'observed_origin':probe['origin'],'shared_successor':probe['position_successor'],
                            'rival_command_endpoint':probe['command_endpoint'],'falsifier':probe['falsifier']}
            return proposal
        finally:
            self._portable_probes=[];self._temporal_probes=[]

    def _question(self,index,key):
        question=super()._question(index,key)
        scope=self.nodes[index]['protocol']['level_epoch']
        refs=question['hypothesis_refs']
        prior_only=bool(refs) and all(self.rules[ref]['scope_epochs'] and scope not in self.rules[ref]['scope_epochs'] for ref in refs)
        if prior_only:
            question={**question,'reason':'unobserved_input_effect_or_unexplained_transition','priority':3,
                'reported_inapplicable_prior_refs':refs,'hypothesis_refs':[]}
        if index!=getattr(self,'_portable_index',None):
            return question
        for probe in getattr(self,'_temporal_probes',[]):
            if normalized_action(question['action'])==probe['action']:
                return {**question,'reason':probe['kind'],'priority':probe['priority'],'hypothesis_refs':[probe['hypothesis_ref']],
                    'temporal_prediction_digest':probe['prediction_digest'],'falsifier':probe['falsifier'],'authority_transferred':False}
        for probe in getattr(self,'_portable_probes',[]):
            if normalized_action(question['action'])==probe['action']:
                return {**question,'reason':'test_portable_local_translation_condition','priority':probe['experimental_priority'],
                    'hypothesis_refs':[probe['hypothesis_ref']],'portable_prediction_digest':probe['prediction_digest'],
                    'falsifier':probe['falsifier'],'authority_transferred':False}
        return question
