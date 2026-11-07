"""Public-image measurements without actor, target, wall or mechanism roles.

Palette values and connected masks are descriptors, never semantic labels.
Repeated signatures explicitly retain identity ambiguity. No game identifier,
registry object, engine instance, oracle or level definition enters this module.
"""
from collections import Counter
import hashlib,json
from geometric_observer import components,transitions


def measure(public_observation,revision,observation_scope='neutral'):
    parts=components(public_observation.frame_rows);signatures=[]
    for part in parts:
        descriptor={'palette_value':part['color'],'area':part['area'],'scale':part['scale'],
            'normalized_mask':sorted(part['normalized'])}
        signatures.append(hashlib.sha256(json.dumps(descriptor,separators=(',',':'),sort_keys=True).encode()).hexdigest())
    counts=Counter(signatures);ordinal=Counter();entities=[]
    for part,signature in zip(parts,signatures):
        index=ordinal[signature];ordinal[signature]+=1
        left,top,right,bottom=part['bbox']
        entities.append({'id':f'component:{signature[:16]}:{index}','signature':signature,
            'position':[left,top],'bbox':part['bbox'],'area':part['area'],'scale':part['scale'],
            'mask':sorted(part['mask']),
            'palette_value':part['color'],'rectangular':part['rectangular'],
            'identity_ambiguous':counts[signature]>1,'identity_scope':'monochrome_component_not_physical_object'})
    value={'revision':revision,'level_epoch':public_observation.level,'frame_hash':public_observation.frame_hash,
        'observation_ref':f'{observation_scope}:epoch:{public_observation.level}:revision:{revision}:frame:{public_observation.frame_hash}',
        'coordinate_basis':'screen',
        'entities':entities,'available_action_refs':list(public_observation.available_action_refs),
        'state':public_observation.state,'levels_completed':public_observation.levels_completed,
        'unknowns':['physical_object_roles','terminal_objective','input_semantics','logical_lattice'],
        'provenance':'public_frame_connected_components_only'}
    return value,parts


def delta(before,after,before_parts,after_parts,action):
    return {'action':action,'before_hash':before['frame_hash'],'after_hash':after['frame_hash'],
        'before_revision':before['revision'],'after_revision':after['revision'],
        'pixel_hash_changed':before['frame_hash']!=after['frame_hash'],
        'component_count_before':len(before['entities']),'component_count_after':len(after['entities']),
        'geometric_correspondences':transitions(before_parts,after_parts),
        'official_level_delta':after['levels_completed']-before['levels_completed'],
        'interpretation':'observed differences; no causal control, contact, goal or reversibility established by pixels alone'}


def summary(observation):
    return {k:observation[k] for k in ('revision','level_epoch','frame_hash','state','levels_completed','unknowns')}|{
        'component_count':len(observation['entities']),
        'unambiguous_signature_components':sum(not e['identity_ambiguous'] for e in observation['entities'])}
