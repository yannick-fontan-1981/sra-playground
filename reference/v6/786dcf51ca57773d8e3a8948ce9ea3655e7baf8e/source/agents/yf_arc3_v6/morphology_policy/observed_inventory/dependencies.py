"""Current support graph and typed unmet access relations; never an action permit."""
from .routing import measured_paths

def measured_dependencies(scene,rows,world_pairs,display_pairs,interfaces,available):
 if len(display_pairs)!=1:return []
 target=[display_pairs[0]['target_row'],display_pairs[0]['target_col']]
 if measured_paths(scene,rows,[target],interfaces,available):return []
 grouped={}
 for pair in world_pairs:grouped.setdefault(tuple(pair['target_cell']),[]).append(pair)
 eligible={cell:items[0] for cell,items in grouped.items() if len(items)==1}
 routes=measured_paths(scene,rows,[target],interfaces,available,conditional_cells=eligible)
 if len(routes)!=1:return []
 route=routes[0];barriers=[step for step in route['path'] if step['surface_status']=='conditional_intermediate_partition']
 if not barriers:return []
 first=barriers[0];cell=tuple(first['to_cell']);pair=eligible[cell]
 # Necessity is only relative to this bounded graph of currently measured
 # support and typed partitions, not a hidden universal rule of the world.
 if measured_paths(scene,rows,[target],interfaces,available,conditional_cells=[c for c in eligible if c!=cell]):return []
 frontier=list(first['from_cell']);prefix=measured_paths(scene,rows,[frontier],interfaces,available)
 if len(prefix)!=1:return []
 supplier=measured_paths(scene,rows,[pair['source_cell']],interfaces,available)
 if len(supplier)!=1:return []
 return [{'observation_ref':scene['observation_ref'],'level_epoch':scene['level_epoch'],'consumer_cell':target,'unmet_partition':list(cell),'supplier':pair,'frontier_cell':frontier,'frontier_route':prefix[0],'supplier_route':supplier[0],'conditional_total_distance':route['length'],'model_scope':'current_repeated_support_plus_measured_complementary_partitions','qualifier':'unmet_intermediate_access_under_conditional_graph','unknown':['partition_access_law','allocation_capacity','reverse_transfer_applicability','unseen_alternative_route'],'release_authority':False}]


def recalled_gain_targets(scene,obs,collection,dependency):
 if collection is None or not dependency or len(scene.get('grids',[]))!=1:return []
 out=[]
 for entity in obs['entities']:
  if entity.get('identity_ambiguous'):continue
  method=collection.evidence_for(entity['signature'])
  if not method['confirmed'] or method['counterexamples']:continue
  l,t,r,b=entity['bbox'];cells=[c for c in scene['grids'][0]['cells'] if c['bbox']['left']<=l<=r<=c['bbox']['right'] and c['bbox']['top']<=t<=b<=c['bbox']['bottom']]
  if len(cells)!=1:continue
  c=cells[0];box=[c['bbox'][k] for k in ('left','top','right','bottom')]
  if box[0]<=scene['body'][0]<=scene['body'][2]<=box[2] and box[1]<=scene['body'][1]<=scene['body'][3]<=box[3]:continue
  out.append(([c['row'],c['col']],{'recalled_gain_occurrence_current':True,'unmet_access_dependency_current':True},{'target_cell':[c['row'],c['col']],'target_bbox':box,'mark_bbox':entity['bbox'],'observation_ref':obs['observation_ref'],'dependency':dependency,'method_recall':method,'evidence':method['confirmed']+[obs['observation_ref']],'appearance_relation_only':True}))
 return out

def frontier_target(scene,dependency,held):
 cell=next((c for c in scene['grids'][0]['cells'] if [c['row'],c['col']]==dependency['frontier_cell']),None)
 if cell is None:return None
 box=[cell['bbox'][k] for k in ('left','top','right','bottom')];body=scene['body'];at=box[0]<=body[0]<=body[2]<=box[2] and box[1]<=body[1]<=body[3]<=box[3]
 flags={'unmet_access_dependency_current':True,'frontier_not_current':not at,'frontier_current':at,'current_corresponding_signature':bool(held),'allocation_command_observed':bool(held and held.get('action'))}
 return (dependency['frontier_cell'],flags,{'dependency':dependency,'source_bbox':box,'method_action':held['action'],'method':held,'allocation_effect_unknown':True,'future_consumer':dependency['consumer_cell'],'evidence':held['evidence']+[scene['observation_ref']]})
