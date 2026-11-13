"""Admission numbers only. Oracle evidence stays entirely on the creator side."""
def parse_level_action_caps(value,target_levels):
    pieces=value.split(',') if isinstance(value,str) else []
    if len(pieces)!=target_levels or any(not s.strip().isascii() or not s.strip().isdecimal() for s in pieces):
        raise ValueError('One explicit positive primitive cap per target level is required')
    caps=tuple(int(s.strip()) for s in pieces)
    if min(caps,default=0)<1:raise ValueError('Each target level needs a positive qualified cap')
    return caps


def remaining_level_actions(caps,emitted,level):
    if not isinstance(level,int) or isinstance(level,bool) or not 1<=level<=len(caps):
        raise ValueError('Current emission level is outside admitted scope')
    count=emitted.get(str(level),0)
    if not isinstance(count,int) or isinstance(count,bool) or not 0<=count<=caps[level-1]:
        raise ValueError('Invalid per-level emission counter')
    return caps[level-1]-count


def charge_level_action(caps,emitted,level):
    if remaining_level_actions(caps,emitted,level)<=0:
        raise ValueError('No primitive remains for this emission level')
    key=str(level);emitted[key]=emitted.get(key,0)+1
    return emitted[key]
