"""Measured feature candidates fitted with the unchanged V5 finite value kernel."""
from collections import deque
from math import gcd
from functools import reduce
from agents.yf_arc3_v5.capabilities.visual_sequence import FeatureProgram,_value
from terminal_composition import identity

def cycle(values,index,maximum):
    known={i:v for i,v in enumerate(values) if v is not None};out=[]
    for period in range(1,min(maximum,len(values)//2)+1):
        residues={r:{v for i,v in known.items() if i%period==r} for r in range(period)}
        if any(len(v)!=1 for v in residues.values()):continue
        if len(known)-period<2:continue
        vals=tuple(next(iter(residues[r])) for r in range(period))
        p=FeatureProgram(program_ref='cycle:'+str(period),feature_ref='measured_feature',clock_ref='rank',law_ref='finite_cyclic_value',cycle_values=vals)
        if all(_value(p,i)==v for i,v in known.items()):out.append((_value(p,index),{'law':p.law_ref,'period':period,'support_ranks':list(known)}))
    return out

def numeric(values,index,config):
    known={i:v for i,v in enumerate(values) if v is not None};out=cycle(values,index,config['maximum_cycle'])
    if len(known)<3:return out
    first=min(known);last=max(known);delta=(known[last]-known[first])/(last-first)
    if delta.is_integer():
        p=FeatureProgram(program_ref='arithmetic',feature_ref='measured_feature',clock_ref='rank',law_ref='arithmetic_value',start=known[first]-first*int(delta),step=int(delta))
        if all(_value(p,i)==v for i,v in known.items()):out.append((_value(p,index),{'law':p.law_ref,'step':int(delta),'start':p.start}))
    differences={known[i+1]-v for i,v in known.items() if i+1 in known}
    if any(x>0 for x in differences) and any(x<0 for x in differences):
        lo,hi=min(known.values()),max(known.values())
        for step in sorted({abs(x) for x in differences if x}):
            for direction in (-step,step):
                for start in range(lo,hi+1):
                    p=FeatureProgram(program_ref='reflected',feature_ref='measured_feature',clock_ref='rank',law_ref='reflected_bounded_value',start=start,step=direction,lower=lo,upper=hi)
                    if all(_value(p,i)==v for i,v in known.items()):out.append((_value(p,index),{'law':p.law_ref,'lower':lo,'upper':hi,'step':direction,'start':start}))
    return [item for item in out if item[1]['law'] in config['numeric_families']]

def rotated(mask,turns):
    for _ in range(turns%4):mask=tuple(tuple(row) for row in zip(*mask[::-1]))
    return mask

def components(mask):
    cells={(x,y) for y,row in enumerate(mask) for x,v in enumerate(row) if v};groups=[]
    while cells:
        stack=[cells.pop()];part=set(stack)
        while stack:
            x,y=stack.pop()
            for q in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                if q in cells:cells.remove(q);part.add(q);stack.append(q)
        groups.append(part)
    return groups

def unit(part):
    x=min(x for x,y in part);y=min(y for x,y in part)
    return tuple(sorted((a-x,b-y) for a,b in part))

def fill_enclosed(mask):
    height=len(mask);width=len(mask[0]);outside=set();queue=deque()
    for y in range(height):
        for x in range(width):
            if (x in (0,width-1) or y in (0,height-1)) and not mask[y][x]:outside.add((x,y));queue.append((x,y))
    while queue:
        x,y=queue.popleft()
        for q in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
            a,b=q
            if 0<=a<width and 0<=b<height and not mask[b][a] and q not in outside:outside.add(q);queue.append(q)
    return tuple(tuple(bool(v) or (x,y) not in outside for x,v in enumerate(row)) for y,row in enumerate(mask))

def mask_predictions(masks,index,candidate,config,allow_fill=True):
    known={i:m for i,m in enumerate(masks) if m is not None};proof=[];refs=[None if m is None else identity(m) for m in masks]
    for predicted,why in cycle(refs,index,config['maximum_cycle']):
        if predicted==identity(candidate):proof.append({'model':'mask_cycle',**why})
    origin=min(known);base=known[origin]
    if len(base)==len(base[0]):
        for step in config['rotation_steps']:
            values=tuple(identity(rotated(base,(i-origin)*step)) for i in range(4))
            p=FeatureProgram(program_ref='rotation:'+str(step),feature_ref='mask',clock_ref='rank',law_ref='finite_cyclic_value',cycle_values=values)
            if all(_value(p,i)==identity(m) for i,m in known.items()) and _value(p,index)==identity(candidate):
                proof.append({'model':'rigid_card_rotation','quarter_turn_step':step,'support_ranks':list(known)})
    def solid(mask):
        pts={(x,y) for y,row in enumerate(mask) for x,v in enumerate(row) if v}
        if not pts:return None
        l=min(x for x,y in pts);r=max(x for x,y in pts);t=min(y for x,y in pts);b=max(y for x,y in pts)
        if len(pts)!=(r-l+1)*(b-t+1):return None
        return r-l+1,b-t+1,l+r,t+b
    bounds={i:solid(m) for i,m in known.items()};target=solid(candidate)
    if target and all(bounds.values()) and len({b[2:] for b in bounds.values()})==1 and target[2:]==next(iter(bounds.values()))[2:]:
        axes=[]
        for axis in (0,1):
            values=[None if m is None else bounds[i][axis] for i,m in enumerate(masks)]
            axes.append([why for value,why in numeric(values,index,config) if value==target[axis]])
        if all(axes):proof.append({'model':'center_preserving_solid_rectangle','width_laws':axes[0],'height_laws':axes[1]})
    groups={i:components(m) for i,m in known.items()};target_parts=components(candidate)
    pieces={unit(p) for parts in groups.values() for p in parts}
    if len(pieces)==1 and any(len(p)>1 for p in groups.values()) and target_parts and {unit(p) for p in target_parts}==pieces:
        counts=[None if m is None else len(groups[i]) for i,m in enumerate(masks)]
        forecasts=[why for value,why in numeric(counts,index,config) if value==len(target_parts)]
        # Keep the measured unit-lattice phase; newly needed locations remain
        # a counting-layout hypothesis, not uniquely reconstructed pixels.
        anchors=[(min(x for x,y in p),min(y for x,y in p)) for parts in groups.values() for p in parts]
        phases=[]
        for axis in (0,1):
            coords=sorted(set(a[axis] for a in anchors));pitch=reduce(gcd,(b-a for a,b in zip(coords,coords[1:])),0)
            phases.append((coords[0],pitch))
        candidate_anchors=[(min(x for x,y in p),min(y for x,y in p)) for p in target_parts]
        compatible=all((v[axis]==start if pitch==0 else (v[axis]-start)%pitch==0) for v in candidate_anchors for axis,(start,pitch) in enumerate(phases))
        if forecasts and compatible:proof.append({'model':'identical_unit_count_on_measured_lattice','count_laws':forecasts,'unit':list(next(iter(pieces))),'layout_scope':'lattice phase; no arbitrary unseen spatial arrangement claimed'})
    if allow_fill and 'shape_and_enclosed_fill' in config['geometry_families']:
        filled=[None if m is None else fill_enclosed(m) for m in masks];target_filled=fill_enclosed(candidate)
        fill_flags=[None if m is None else int(m==filled[i]) for i,m in enumerate(masks)]
        if len({v for v in fill_flags if v is not None})>1:
            fill_laws=[why for value,why in cycle(fill_flags,index,config['maximum_cycle']) if value==int(candidate==target_filled)]
            shape_laws=mask_predictions(filled,index,target_filled,config,allow_fill=False)
            if fill_laws and shape_laws:proof.append({'model':'shape_and_enclosed_fill','fill_laws':fill_laws,'outer_shape_laws':shape_laws,'scope':'four-connected exterior distinguishes enclosed empty regions; no named shape table'})
    return [p for p in proof if p['model'] in config['geometry_families']]

def explain(rasters,index,candidate,background,configuration):
    known=[r for r in rasters if r is not None]
    palettes=[{v for row in r for v in row if v!=background} for r in known]
    target_palette={v for row in candidate for v in row if v!=background}
    binary=lambda r,p:tuple(tuple(v in p for v in row) for row in r)
    if all(len(p)==1 for p in palettes) and len(target_palette)==1:
        colors=[None if r is None else next(iter({v for row in r for v in row if v!=background})) for r in rasters]
        predicted=[why for value,why in cycle(colors,index,configuration['maximum_cycle']) if value==next(iter(target_palette))]
        masks=[None if r is None else binary(r,{v for row in r for v in row if v!=background}) for r in rasters]
        forms=mask_predictions(masks,index,binary(candidate,target_palette),configuration)
        return {'decomposition':'independent_single_color_and_binary_geometry','color_laws':predicted,'geometry_laws':forms} if predicted and forms else None
    union=set().union(*palettes)
    if not union or len(union)>configuration['maximum_layers'] or not target_palette<=union:return None
    layers=[]
    for color in sorted(union):
        laws=mask_predictions([None if r is None else binary(r,{color}) for r in rasters],index,binary(candidate,{color}),configuration)
        if not laws:return None
        layers.append({'palette_value':color,'laws':laws})
    return {'decomposition':'independent_observed_palette_layers','layers':layers}
