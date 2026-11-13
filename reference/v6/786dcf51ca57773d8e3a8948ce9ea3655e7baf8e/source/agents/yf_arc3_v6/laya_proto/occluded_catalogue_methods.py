"""Readonly existing layered projection kernel; unobserved values stay unknown."""
import time
from agents.yf_arc3_v5.capabilities.occluded_catalogue_projection_d import OccludedCatalogueProjectionRequestD,measure_occluded_catalogue_projection_d
from rooted_quota_methods import plain
from terminal_composition import identity

def certify(scene,rows,obs,backgrounds,fits,deadline):
    color=scene['palette'];poses=sorted({(f['scale'],*f['translation'])for f in fits});revision=obs['observation_ref'];obj='O_catalogue_subject';view='V_current';value=f'palette:{color}'
    masks=[{'candidate_ref':f'M{i}','pixels':[{'point':p,'value_ref':value}for p in card['mask']],'supported_integer_scales':sorted({s for s,x,y in poses}),'mask_provenance_ref':revision}for i,card in enumerate(scene['cards'])]
    models=[];viewport=set()
    for i,card in enumerate(scene['cards']):
        for scale,x,y in poses:
            viewport.update((x+a*scale+dx,y+c*scale+dy)for a,c in card['mask']for dx in range(scale)for dy in range(scale))
            models.append({'model_ref':f'A{i}_{scale}_{x}_{y}','views':[{'view_ref':view,'poses':[{'object_ref':obj,'candidate_ref':f'M{i}','scale':scale,'translation':[x,y],'opaque':True,'pose_provenance_ref':revision}],'top_to_bottom_object_refs':[obj],'occluder_provenance_ref':'other_values_unobserved_no_layer_order_claim'}]})
    if not models or len(models)>128:return None
    l,t,r,b=scene['field'];present={(x,y)for y in range(t+1,b)for x in range(l+1,r)if rows[y][x]==color};viewport|=present;absent={p for p in viewport if rows[p[1]][p[0]]in backgrounds};unknown=viewport-present-absent
    scope={'request_ref':'projection:'+identity([revision,scene['geometry_ref'],fits]),'caller_ref':'public_catalogue_question','parent_consumer_ref':'SRC_composition','parent_goal_ref':'G_official_completion','parent_contribution_ref':'compare_current_partial_projection','caller_next_item_ref':revision,'epoch':obs['level_epoch'],'evidence_revision_ref':revision,'model_revision_ref':identity([masks,poses]),'model_status_ref':'conditional_observed_catalogue_and_reciprocal_substrate_hypothesis','event_owner_ref':'SRC','input_domain_complete':True,'assumption_refs':['largest_frame_as_subject_field','aligned_same_palette_catalogue_as_shape_alternatives','integer_scale_orientation_preserved','reciprocal_exposed_value_as_open_substrate','other_values_remain_unobserved']}
    request=OccludedCatalogueProjectionRequestD(scope=scope,operation_ref='mechanics.transform_pose_candidates.occluded_catalogue_projection',mode_ref='COMPARE',phase_ref='REGISTERED_LAYERED_VIEWS',requested_result_type='DMechanicalResult',node_bound=100000,depth_bound=4096,domain_bound=4096,time_bound_ms=max(1,min(300000,int((deadline-time.perf_counter())*1000))),masks=masks,models=models,registered_views=[{'view_ref':view,'evidence_revision_ref':revision,'epoch':obs['level_epoch'],'sealed':True,'viewport_cells':sorted(viewport),'queried_object_refs':[obj],'visible_present':[{'point':p,'value_ref':value}for p in sorted(present)],'visible_absent':sorted(absent),'unobserved_cells':sorted(unknown)}],requested_view_refs=[view])
    return plain(measure_occluded_catalogue_projection_d(request).model_dump())
