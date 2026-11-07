"""Pixel contrasts for a selected reception site; no hidden transport laws."""
from .geometry import contains,digest,center,enclosing_contours

def in_box(point,box):
 x,y=point;l,t,r,b=box;return l<=x<=r and t<=y<=b

def coloured(rows,box,value):
 l,t,r,b=box
 return {(x,y) for y in range(max(0,t),min(len(rows),b+1)) for x in range(max(0,l),min(len(rows[0]),r+1)) if rows[y][x]==value}

def arrival(held,first,second,body_before,body_after,regions,evidence):
 if held['status']!='joint_transport_observed' or body_before['bbox']!=body_after['bbox']:return None
 frame=held['frame'];value=held['palette_value'];inside=frame['interior_bbox'];outer=frame['bbox']
 old_site=coloured(first,inside,value);new_site=coloured(second,inside,value);gained=new_site-old_site
 outside={p for p in coloured(first,held['bbox'],value) if not in_box(p,outer)}
 if not gained or not outside or any(second[y][x]==value for x,y in outside):return None
 if any(first[y][x]!=second[y][x] for l,t,r,b in regions for y in range(t,b+1) for x in range(l,r+1)):return None
 return {'ref':'reception_transition:'+digest(evidence),'frame':frame,'palette_value':value,'site_pixels':[list(p) for p in sorted(new_site)],'gained_pixels':[list(p) for p in sorted(gained)],'vacated_carried_pixels':[list(p) for p in sorted(outside)],'object_ref':held['ref'],'evidence':evidence,'status':'arrival_at_selected_site_requires_separation','alternatives':['object_detached_at_selected_reception_site','object_still_bound_with_changed_relative_pose'],'preservation_regions':regions}

def separation(pending,rows,observation,body,delta,local_delta,evidence):
 if not any(delta) or delta!=local_delta:return {'status':'separation_unresolved','reason':'current_motion_not_local_revalidated','evidence':evidence}
 values=enclosing_contours(observation,body);value=pending['palette_value'];site={tuple(p) for p in pending['site_pixels']};shifted={(x+delta[0],y+delta[1]) for x,y in site};visible=lambda p:not in_box(p,body['bbox']) and 0<=p[0]<len(rows[0]) and 0<=p[1]<len(rows) and rows[int(p[1])][int(p[0])] not in values
 fixed={p for p in site if visible(p)};moved={p for p in shifted if visible(p)}
 fixed_yes={p for p in fixed if rows[int(p[1])][int(p[0])]==value};fixed_no=fixed-fixed_yes;moved_no={p for p in moved if rows[int(p[1])][int(p[0])]!=value}
 if fixed_yes and not fixed_no and moved_no:
  return {'status':'reception_confirmed_by_separation','frame_ref':pending['frame']['ref'],'object_ref':pending['object_ref'],'site_pixels_retained':[list(p) for p in sorted(fixed_yes)],'bound_translation_counterexamples':[list(p) for p in sorted(moved_no)],'evidence':list(dict.fromkeys(pending['evidence']+evidence)),'scope':'selected_object_and_site_only_not_universal_terminal_rule'}
 if fixed_no and moved and not moved_no:return {'status':'reception_refuted_object_moves_with_body','evidence':list(dict.fromkeys(pending['evidence']+evidence))}
 return {'status':'separation_unresolved','reason':'stationary_and_bound_explanations_not_distinguished','evidence':evidence}
