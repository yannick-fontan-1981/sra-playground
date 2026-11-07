"""Readonly V5 queue/line/compaction kernels; physical premises remain external."""
from itertools import combinations
from agents.yf_arc3_v5.capabilities import queued_alignment_cascade as kernel
from agents.yf_arc3_v5.capabilities.mechanical_contracts_b import MechanicalRequestB
from rooted_quota_methods import plain
from terminal_composition import identity


def typed(grid, prefix='board'):
    return tuple(tuple(None if v is None else {'value':v,'occurrence_ref':f'{prefix}:{x}:{y}'}for x,v in enumerate(row))for y,row in enumerate(grid))


def values(grid):
    return [[None if c is None else c['value']for c in row]for row in grid]


def models(shape, gravity):
    # The library supplies candidate straight-line relations, not a game law.
    directions=((0,1),(1,0),(1,1),(1,-1))
    return [{'directions':[list(v)for v in d],'minimum_line':n,'gravity':gravity}
            for count in range(1,len(directions)+1)for d in combinations(directions,count)
            for n in range(2,max(shape)+1)]


def placement(grid,bundle,column,gravity):
    members=tuple({'value':v,'occurrence_ref':f'incoming:{i}'}for i,v in enumerate(bundle))
    p=kernel._place(typed(grid),members,column,gravity)
    return None if p is None else values(p[0])


def closure(grid,model):
    b,trace,credited,closed=kernel._closure(typed(grid),model,len(grid)*len(grid[0]))
    return {'board':values(b),'removed':len(credited),'waves':len(trace),'closed':closed}


def receipt(obs,grid,model,evidence):
    request=MechanicalRequestB(request_ref='queue:'+identity([obs['observation_ref'],grid,model]),caller_ref='observed_queue_composition',
        parent_contribution_ref='conditional_equal_line_closure',epoch=obs['level_epoch'],input_revision_ref=obs['observation_ref'],
        event_owner_ref='SRC',operation_ref='mechanics.queued_alignment_cascade.cascade_closure',mode='CONDITIONAL_CLOSURE',
        expected_return_type='MechanicalResultB',model_ref=identity(model),state={'board':typed(grid)},model=model,
        evidence_refs=tuple(evidence[-256:]),bounds={'max_waves':len(grid)*len(grid[0])})
    return plain(kernel.cascade_closure(request).model_dump())
