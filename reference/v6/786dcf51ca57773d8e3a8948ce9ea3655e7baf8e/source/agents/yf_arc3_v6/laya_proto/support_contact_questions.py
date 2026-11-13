"""Exact addressed compositions from reciprocal public field rewrites.

No transport effect is supplied: the composition is an experimental endpoint
for the existing support calculation, followed by a context contrast.
"""
from types import SimpleNamespace


def current_reciprocal_fields(effects, rows, epoch, height, width):
    candidates={}
    for effect in effects:
        if f':epoch:{epoch}:' not in effect['before']:continue
        changes=effect['typed_transition_measurements']['cell_transition_rows']
        swaps={tuple(r['before_pattern']):tuple(r['after_pattern']) for r in changes
               if r['cell_height']==height and r['cell_width']==width
               and len(set(r['before_pattern']))>1
               and sorted(r['before_pattern'])==sorted(r['after_pattern'])
               and r['before_pattern']!=r['after_pattern']}
        for change in changes:
            first,second=tuple(change['before_pattern']),tuple(change['after_pattern'])
            if swaps.get(first)!=second or swaps.get(second)!=first:continue
            for top,left in change['cell_positions']:
                pattern=tuple(rows[top+r][left+c] for r in range(height) for c in range(width))
                if pattern not in (first,second):continue
                key=(effect['control_association_ref'],top,left)
                candidates[key]={'control_ref':key[0],'bbox':[left,top,left+width-1,top+height-1],
                    'pattern':pattern,'alternatives':[first,second],
                    'evidence':[effect['before'],effect['after']]}
    return list(candidates.values())


def addressed_component(field):
    left,top,right,bottom=field['bbox'];width=right-left+1;height=bottom-top+1
    points=tuple((top+r,left+c) for r in range(height) for c in range(width))
    return SimpleNamespace(component_id='addressed_observed_field',
        bbox=SimpleNamespace(top=top,left=left,right=right,bottom=bottom,height=height,width=width),
        pixels=points,valued_pixels=tuple((r,c,value) for (r,c),value in zip(points,field['pattern'])),
        value=None,area=len(points))


def field_association(field):
    left,top,right,bottom=field['bbox'];width=right-left+1
    return {'term_ref':'association.addressed_field',
            'normalized_valued_pixels':tuple((i//width,i%width,value) for i,value in enumerate(field['pattern']))}
