"""Thin custom-game transport with explicit public-observation filtering.

Custom engine payloads also contain internal puzzle state. This adapter drops
stacks, held pieces, target moves, level definitions and other solution-bearing
fields before exposing observations to any planner.
"""
from dataclasses import dataclass
import hashlib,json
from custom_games.registry import build_engine


@dataclass(frozen=True)
class CustomObservation:
    game_id:str
    level:int
    levels_completed:int
    state:str
    step_index:int
    available_action_refs:tuple
    frame_rows:tuple
    frame_packet:tuple
    frame_hash:str

    def to_dict(self):
        return {'backend':'custom_filtered_bridge','game_id':self.game_id,'level':self.level,
            'levels_completed':self.levels_completed,'state':self.state,'step_index':self.step_index,
            'available_action_refs':list(self.available_action_refs),'frame_hash':self.frame_hash}


def public_actions(payload):
    names=payload.get('available_actions')
    ids=payload.get('available_action_ids')
    if ids is not None:
        if not isinstance(ids,(list,tuple)) or any(type(i) is not int or i not in range(1,8) for i in ids):
            raise ValueError('Invalid public action identifiers')
        converted=['ACTION'+str(i) for i in ids]
        if names is not None and list(names)!=converted:
            raise ValueError('Contradictory public action domains')
        names=converted
    if not isinstance(names,(list,tuple)) or any(a not in {'ACTION'+str(i) for i in range(1,8)} for a in names) or len(set(names))!=len(names):
        raise ValueError('Missing or invalid public action domain')
    return tuple(names)


def public_level(payload):
    explicit=payload.get('level')
    index=payload.get('level_index')
    if 'level' in payload and (type(explicit) is not int or explicit<1):
        raise ValueError('Invalid one-based public level')
    if 'level_index' in payload and (type(index) is not int or index<0):
        raise ValueError('Invalid zero-based public level index')
    if 'level' in payload and 'level_index' in payload and explicit!=index+1:
        raise ValueError('Contradictory public level metadata')
    if 'level' in payload:return explicit
    if 'level_index' in payload:return index+1
    raise ValueError('Missing public level metadata')


class CustomSession:
    def __init__(self,game_id):
        self.game_id=game_id;self._engine=build_engine(game_id);self.steps=0

    def _observation(self,payload):
        self._available=public_actions(payload)
        rows=tuple(tuple(row) for row in payload['frame'])
        frames=tuple(tuple(tuple(row) for row in frame) for frame in payload.get('frames',[payload['frame']]))
        digest=hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest()[:16]
        return CustomObservation(self.game_id,public_level(payload),int(payload['levels_completed']),str(payload['state']),
            self.steps,self._available,rows,frames,digest)

    def reset(self):
        self.steps=0
        return self._observation(self._engine.reset())

    def step(self,action_ref,*,data=None):
        if action_ref not in getattr(self,'_available',()):
            raise ValueError('Action absent from the current public domain')
        payload=self._engine.action(int(action_ref.removeprefix('ACTION')),dict(data or {}));self.steps+=1
        return self._observation(payload)
