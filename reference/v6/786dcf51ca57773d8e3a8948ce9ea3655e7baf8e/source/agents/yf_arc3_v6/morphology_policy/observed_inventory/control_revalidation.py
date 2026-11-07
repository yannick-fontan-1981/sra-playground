"""Current quantum evidence; a free-looking forward strip is not a collision law."""
def measurements(prior,epoch,delta,moved,underlays,rows):
 l,t,r,b=moved['bbox'];dx,dy=delta;old=prior['delta']
 matches=[z for z in underlays if tuple(z['bbox'])==(t,l,b,r) and tuple(z['translation_delta'])==(dy,dx)]
 values=set(matches[0]['underlay_values']) if len(matches)==1 else set()
 ux=0 if not dx else (1 if dx>0 else -1);uy=0 if not dy else (1 if dy>0 else -1)
 points=[(x,y) for y in range(t+uy,b+uy+1) for x in range(l+ux,r+ux+1) if not(l<=x<=r and t<=y<=b)]
 visible=bool(points) and all(0<=y<len(rows) and 0<=x<len(rows[y]) for x,y in points)
 forward=visible and len(values)==1 and all(rows[y][x] in values for x,y in points)
 same_direction=(dx==0)==(old[0]==0) and (dy==0)==(old[1]==0) and dx*old[0]+dy*old[1]>0
 return {'current_scope_and_observation':True,'prior_is_foreign_scope_hypothesis':bool(prior.get('recalled_hypothesis') and prior.get('recalled_from_epoch') is not None and prior['recalled_from_epoch']!=epoch and prior.get('observed_epoch')!=epoch),'current_unique_axial_body_translation':bool((dx==0)!=(dy==0)),'current_direction_concordant':same_direction,'current_entry_underlay_unique':len(matches)==1 and len(values)==1,'forward_boundary_unindicated':bool(forward),'current_quantum_differs':old!=delta,'current_quantum_candidate_supported':bool(same_direction and len(matches)==1 and len(values)==1 and forward),'measurement':{'current_delta':delta,'prior_delta':old,'body_bbox':list(moved['bbox']),'forward_strip_visible':visible,'forward_strip_same_as_measured_entry':bool(forward),'unknown':['collision_law','universality_of_new_quantum','unobserved_directions']}}
