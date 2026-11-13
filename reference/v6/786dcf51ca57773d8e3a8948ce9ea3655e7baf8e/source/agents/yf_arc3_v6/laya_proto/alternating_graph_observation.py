"""Adapt public rasters to the existing alternating-material measurement."""
from collections import Counter
from functools import lru_cache
from types import SimpleNamespace
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid,ComponentExtractionInput,VisualSceneInput,BoundingBox
from agents.yf_arc3_v5.capabilities.components import detect_components
from agents.yf_arc3_v5.capabilities.sprites import describe_visual_scene
from agents.yf_arc3_v5.capabilities.interaction import _alternating_material_graph_measurement

@lru_cache(maxsize=8)
def description(rows):
    frame=FrameGrid(rows=rows)
    return frame,detect_components(ComponentExtractionInput(frame=frame)),describe_visual_scene(VisualSceneInput(frame=frame,action_conditioned_grid_evidence=False))

def histogram(rows,box):
    t,l,b,r=box
    return sorted([v,n]for v,n in Counter(rows[y][x]for y in range(t,b+1)for x in range(l,r+1)).items())

def overlays(rows):
    _,_,scene=description(tuple(tuple(row)for row in rows));result=[]
    for s in scene.sprites:
        q=s.bbox.width
        if q==s.bbox.height and 2<=q<=16 and not s.touches_frame_boundary and len(s.color_histogram)>1:
            b=[s.bbox.top,s.bbox.left,s.bbox.bottom,s.bbox.right]
            result.append({'bbox':b,'histogram':histogram(rows,b),'size':q})
    return result

def measure(rows,obs,actor,controls,evidence,last_action,*,marker_precaution=False):
    frame,components,scene=description(tuple(tuple(row)for row in rows))
    policy={'max_expanded_states':512,'max_plan_actions':40}
    if marker_precaution:policy['alternating_graph_noncontrolled_marker_constraint']='counterfactual_exclude_one_forward_node'
    b=actor['bbox'];v=SimpleNamespace(frame=frame,components=components,sprites=scene.sprites,structural_sprites=scene.sprites,
        route_generation_policy=policy,interface_action_translation_deltas=(),known_action_translation_deltas=tuple((a,*d)for a,d in sorted(controls.items())),
        available_action_refs=tuple(obs['available_action_refs']),input_aligned_entity_bboxes=(BoundingBox(top=b[0],left=b[1],bottom=b[2],right=b[3]),),
        action_conditioned_grid_evidence=bool(evidence),observed_controlled_translation_count=len(evidence),
        last_action_ref=last_action,known_effectful_action_refs=tuple(controls),current_observation_frame_ref=obs['observation_ref'])
    return _alternating_material_graph_measurement(v)
