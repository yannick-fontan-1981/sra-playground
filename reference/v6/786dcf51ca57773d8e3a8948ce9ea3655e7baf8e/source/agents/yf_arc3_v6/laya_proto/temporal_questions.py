"""Experimentally distinguish a command-associated displacement from a shared local phase.

Only uniquely identified measured shapes contribute observations. Successive
positions define a possible phase; no clock, actor or game semantics are given.
"""
from collections import defaultdict
from portable_recall import digest, normalized_action


def unique_shapes(observation):
    grouped=defaultdict(list)
    for entity in observation['entities']:
        grouped[entity['signature']].append(entity)
    return {sig:items[0] for sig,items in grouped.items() if len(items)==1 and not items[0].get('identity_ambiguous')}


class TemporalQuestions:
    def __init__(self):
        self.samples={}
        self.tried=set()

    def apply_event(self,event):
        if event['kind']=='temporal_probe_result':
            self.tried.add(event['trial_key']);return
        if event['kind']!='public_motion_sample':raise ValueError('Unknown temporal evidence')
        identifier=event['epoch'],event['signature']
        locations=self.samples.setdefault(identifier,{})
        commands=locations.setdefault(tuple(event['origin']),{})
        transitions=commands.setdefault(event['action_ref'],{})
        destination=None if event['destination'] is None else tuple(event['destination'])
        transitions.setdefault(destination,[]).append(event['before_ref'])

    def record(self,before,action,after):
        if action.get('data') or before['level_epoch']!=after['level_epoch'] or before['state']!=after['state']:
            return []
        old=unique_shapes(before);new=unique_shapes(after);epoch=before['level_epoch'];events=[]
        for sig,entity in old.items():
            origin=entity['position'];target=new.get(sig);destination=target['position'] if target else None
            if (epoch,sig) not in self.samples and (destination is None or destination==origin):continue
            event={'kind':'public_motion_sample','epoch':epoch,'signature':sig,'origin':origin,'destination':destination,
                'action_ref':action['action_ref'],'before_ref':before['observation_ref'],'after_ref':after['observation_ref']}
            self.apply_event(event);events.append(event)
        return events

    def candidates(self,obs,inputs,config):
        epoch=obs['level_epoch'];shapes=unique_shapes(obs);offers=[]
        for (scope,sig),locations in self.samples.items():
            entity=shapes.get(sig)
            if scope!=epoch or entity is None:continue
            origin=tuple(entity['position']);same=locations.get(origin,{})
            # An ambiguous successor or a disappearance under this public phase
            # blocks the forecast; another discriminating condition is required.
            possible={dest for outcomes in same.values() for dest in outcomes}
            if len(possible)!=1 or None in possible or len(same)<config['minimum_distinct_source_inputs']:continue
            successor=next(iter(possible))
            if successor==origin:continue
            phase_refs=[refs[0] for outcomes in same.values() for refs in outcomes.values()]
            for raw in inputs:
                action=normalized_action(raw);ref=action['action_ref']
                if action.get('data') or ref in same:continue
                deltas=defaultdict(list);missing=False
                for position,commands in locations.items():
                    if position==origin:continue
                    for dest,refs in commands.get(ref,{}).items():
                        if dest is None:missing=True;continue
                        delta=tuple(y-x for x,y in zip(position,dest));deltas[delta].append((position,refs[0]))
                rival=None;action_refs=[]
                if not missing and len(deltas)==1:
                    move,examples=next(iter(deltas.items()))
                    if len({position for position,_ in examples})>=config['minimum_command_positions']:
                        endpoint=tuple(x+y for x,y in zip(origin,move))
                        if endpoint!=successor:
                            rival=list(endpoint);action_refs=[ref0 for _,ref0 in examples[:4]]
                kind='discriminate_command_and_position_successor' if rival is not None else 'test_shared_successor_under_untried_input'
                trial_key=digest([epoch,sig,origin,ref,successor,rival]);
                if trial_key in self.tried:continue
                proposal={'kind':kind,'hypothesis_ref':'temporal:'+trial_key,'trial_key':trial_key,'target_epoch':epoch,'public_mode':obs['state'],
                    'signature':sig,'origin':list(origin),'action':action,'observation_ref':obs['observation_ref'],
                    'position_successor':list(successor),'position_evidence':phase_refs,'distinct_source_inputs':sorted(same),
                    'command_endpoint':rival,'command_evidence':action_refs,
                    'priority':config['rival_priority'] if rival is not None else config['untested_successor_priority'],
                    'question':'Does the unique shape reach its previously observed successor under a different input at this same position?',
                    'falsifier':'A visible unique shape at a different endpoint contradicts the shared-successor forecast; lost correspondence remains unknown.',
                    'predictive_use_allowed':False,'scope':'one information probe, current epoch; hidden phase, joint motion and input influence remain hypotheses'}
                proposal['prediction_digest']=digest(proposal);offers.append(proposal)
        return sorted(offers,key=lambda p:(p['priority'],-len(p['distinct_source_inputs']),p['hypothesis_ref']))

    def guard(self,probe,obs,operation,actions,commitment):
        if not probe or operation!='OP18' or len(actions)!=1:return False
        current=unique_shapes(obs).get(probe['signature'])
        return (probe['prediction_digest']==commitment==digest({k:v for k,v in probe.items() if k!='prediction_digest'}) and
            normalized_action(actions[0])==probe['action'] and probe['observation_ref']==obs['observation_ref'] and
            obs['level_epoch']==probe['target_epoch'] and current is not None and current['position']==probe['origin'] and probe['trial_key'] not in self.tried)

    def observe_trial(self,probe,after):
        if probe['prediction_digest']!=digest({k:v for k,v in probe.items() if k!='prediction_digest'}):raise ValueError('Temporal prediction digest mismatch')
        if probe['observation_ref']==after['observation_ref']:raise ValueError('Independent response missing')
        target=unique_shapes(after).get(probe['signature']) if after['level_epoch']==probe['target_epoch'] and after['state']==probe['public_mode'] else None
        actual=target['position'] if target else None
        if actual is None:outcome='unknown_correspondence_or_boundary'
        elif actual==probe['position_successor']:outcome='matched_shared_position_successor'
        elif probe['command_endpoint'] is not None and actual==probe['command_endpoint']:outcome='matched_rival_command_displacement'
        else:outcome='observed_other_endpoint'
        event={'kind':'temporal_probe_result','trial_key':probe['trial_key'],'before_ref':probe['observation_ref'],'after_ref':after['observation_ref'],
            'prediction_digest':probe['prediction_digest'],'actual_position':actual,'result':outcome,'predictive_use_allowed':False}
        self.apply_event(event);return event
