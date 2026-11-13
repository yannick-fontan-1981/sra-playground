"""Propose an addressed experiment separating scoped empirical alternatives.

The binary response being tested is a visible change on the addressed prior
support. It does not identify a physical cause, useful action, or terminal role.
No game adapter, dispatch, goal assignment, or prior positive coordinate lives here.
"""
from collections import Counter
from hashlib import sha256
import json


def _digest(value):
    encoded = json.dumps(value, separators=(',', ':'), sort_keys=True).encode()
    return sha256(encoded).hexdigest()


def support(entity):
    left, top = entity['position']
    return {(left+x, top+y) for x, y in entity['mask']}


class SceneRelations:
    def __init__(self, observation, *, previous_moving_signatures=()):
        self.observation = observation
        self.entities = {e['id']: e for e in observation['entities']}
        self.regions = {key: support(e) for key, e in self.entities.items()}
        self.at = {p: key for key, points in self.regions.items() for p in points}
        if len(self.at) != sum(map(len, self.regions.values())):
            raise ValueError('Overlapping supports cannot bind a unique occurrence')
        counts = Counter(e['signature'] for e in self.entities.values())
        self.anchors = [e for e in self.entities.values()
                        if e['signature'] in previous_moving_signatures and counts[e['signature']]==1]

    def features(self, command):
        if command['action_ref'] != 'ACTION6' or 'ACTION6' not in self.observation['available_action_refs']:
            return None
        x, y = command['data']['x'], command['data']['y']
        if (x,y) not in self.at:
            return None
        key = self.at[x,y]
        entity = self.entities[key]
        ring = {(nx,ny) for px,py in self.regions[key]
                for nx,ny in ((px-1,py),(px+1,py),(px,py-1),(px,py+1))
                if (nx,ny) in self.at and self.at[nx,ny] != key}
        ring_signatures = Counter(self.entities[self.at[p]]['signature'] for p in ring)
        pattern = [self.entities[self.at[x+dx,y+dy]]['signature'] if (x+dx,y+dy) in self.at else None
                   for dy in (-1,0,1) for dx in (-1,0,1)]
        left,top,right,bottom = entity['bbox']
        values = {'signature':entity['signature'], 'ring':_digest(sorted(ring_signatures.items())),
                  'pattern':_digest(pattern)}
        if self.anchors:
            values.update(horizontal_overlap=False,vertical_overlap=False,contact=False)
            distances = []
            for anchor in self.anchors:
                l,t,r,b=anchor['bbox']
                values['horizontal_overlap'] |= max(left,l) <= min(right,r)
                values['vertical_overlap'] |= max(top,t) <= min(bottom,b)
                values['contact'] |= bool(ring & self.regions[anchor['id']])
                distances.append(min(abs(x-ax)+abs(y-ay) for ax,ay in self.regions[anchor['id']]))
            values['tracked_distance'] = min(distances)
        return {'action':command,'observation_ref':self.observation['observation_ref'],
                'mode':[self.observation['level_epoch'],self.observation['state']],
                'entity_ref':key,'features':values,'frame_hash':self.observation['frame_hash']}


def tested_occurrence(binding, changed_original_support, after_ref):
    return {**binding, 'observed_local_change':bool(changed_original_support),'after_ref':after_ref}


def contrast_models(records):
    """Induce literal feature alternatives, then try to falsify each on prior trials."""
    result = {}
    for observation in records:
        if not observation['observed_local_change']:
            continue
        for feature,value in observation['features'].items():
            mode = observation['mode']
            model_id = _digest([mode,feature,value])
            if model_id in result:
                continue
            same_mode = [r for r in records if r['mode']==mode and feature in r['features']]
            negatives = [r['after_ref'] for r in same_mode if
                         (r['features'][feature] == value) != r['observed_local_change']]
            result[model_id] = {'id':model_id, 'feature':feature,'equals':value,'mode':mode,
                'construction_ref':observation['after_ref'],'counterexamples':negatives,
                'status':'refuted' if negatives else 'unrefuted_local_candidate',
                'supporting_observation_count':len(same_mode)-len(negatives)}
    return list(result.values())


def forecast(models, binding):
    return {m['id']:binding['features'][m['feature']]==m['equals'] for m in models
            if m['status']=='unrefuted_local_candidate' and binding['mode']==m['mode']
            and m['feature'] in binding['features']}


def contrast_offers(records, candidates, *, compared_pairs=()):
    """One prebound input can test opposing predictions. Agreement gives abstention."""
    models = contrast_models(records)
    tested = {(tuple(r['mode']),r['frame_hash'],_digest(r['action'])) for r in records}
    ranked=[]
    for candidate in candidates:
        if candidate is None or (tuple(candidate['mode']),candidate['frame_hash'],_digest(candidate['action'])) in tested:
            continue
        predictions=forecast(models,candidate)
        positives=sum(predictions.values())
        negatives=len(predictions)-positives
        pairs=sorted({tuple(sorted((p,n))) for p in predictions if predictions[p]
                     for n in predictions if not predictions[n]}-set(compared_pairs))
        if pairs:
            ranked.append((min(positives,negatives),candidate,predictions,pairs))
    offers=[]
    contexts=[*records,*[c for c in candidates if c is not None]]
    for _,binding,predictions,pairs in sorted(ranked,key=lambda item:-item[0]):
        rivals=[{'id':m['id'],'feature':m['feature'],'equals':m['equals'],'source_ref':m['construction_ref']}
                for m in models if m['id'] in predictions]
        classes={}
        for rival in rivals:
            f=rival['feature'];values=tuple(r['features'].get(f)==rival['equals'] for r in contexts if r['mode']==binding['mode'])
            partition=min(values,tuple(not v for v in values))
            classes.setdefault(partition,set()).add(f)
        offers.append({'status':'bound_experiment_candidate','binding':binding,'frozen_predictions':predictions,
            'feature_partitions':[sorted(names) for names in classes.values()],
            'rivals':rivals,'new_contrast_pairs':[list(p) for p in pairs],
            'question':'Which scoped feature models predict a visible change on the exact addressed support?',
            'falsifier':'compare changed support after this one input; retain failed predictions and unknown causes',
            'release_authority':False,'terminal_relevance':'unknown'})
    return offers

def propose_contrast(records,candidates,*,compared_pairs=()):
    offers=contrast_offers(records,candidates,compared_pairs=compared_pairs)
    return offers[0] if offers else {'status':'unknown_no_bound_discriminating_input','release_authority':False}


class PointExperimentMemory:
    def __init__(self):
        self.records=[]
        self.moving_signatures=[]
        self.compared_pairs=set()
        self.has_positive=False

    def offer(self, observation, actions):
        offers=self.offers(observation,actions)
        return offers[0] if offers else None

    def offers(self, observation, actions):
        if not self.has_positive or not any(a['action_ref']=='ACTION6' for a in actions):
            return []
        active=[m for m in contrast_models(self.records) if m['status']=='unrefuted_local_candidate'
                and m['mode']==[observation['level_epoch'],observation['state']]]
        if len(active)<2 or all(tuple(sorted((a['id'],b['id']))) in self.compared_pairs
            for i,a in enumerate(active) for b in active[i+1:]):
            return []
        scene=SceneRelations(observation,previous_moving_signatures=self.moving_signatures)
        bindings=[scene.features(a) for a in actions if a['action_ref']=='ACTION6']
        return contrast_offers(self.records,bindings,compared_pairs=self.compared_pairs)

    def observe(self,before,command,after,before_rows,after_rows,selected=None):
        if before['level_epoch']!=after['level_epoch'] or after['state'] in ('WIN','GAME_OVER'):
            self.moving_signatures=[]
            return None
        if command['action_ref']!='ACTION6':
            unique=lambda o:{e['signature']:e for e in o['entities'] if not e['identity_ambiguous']}
            pre,post=unique(before),unique(after)
            moved=sorted(s for s in pre.keys() & post.keys() if pre[s]['position']!=post[s]['position'])
            if moved:self.moving_signatures=moved
            return None
        scene=SceneRelations(before,previous_moving_signatures=self.moving_signatures)
        binding=scene.features(command)
        if binding is None:raise ValueError('Executed point lacks an exact occurrence')
        changed=any(before_rows[y][x]!=after_rows[y][x] for x,y in scene.regions[binding['entity_ref']])
        record=tested_occurrence(binding,changed,after['observation_ref'])
        self.records.append(record);self.has_positive|=changed
        comparison=None
        if selected is not None:
            if binding!=selected['binding']:raise ValueError('Frozen contrast point differs from executed witness')
            comparison={k:v==changed for k,v in selected['frozen_predictions'].items()}
            self.compared_pairs.update(tuple(p) for p in selected['new_contrast_pairs'])
        return {'record':record,'matches_frozen_predictions':comparison,
                'compared_pairs':selected['new_contrast_pairs'] if selected else []}
