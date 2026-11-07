from collections import Counter
from agents.yf_arc3_v5.capabilities.framed_reception_loci import _contains,_center
from agents.yf_arc3_v5.logos.types import FrozenMap
from types import SimpleNamespace
import hashlib,json
from agents.yf_arc3_v5.capabilities import FrameGrid,ComponentExtractionInput,detect_components
from agents.yf_arc3_v5.capabilities.parallel_bands import measure_parallel_solid_bands
from agents.yf_arc3_v5.capabilities.point_motion_spans import measure_point_motion_spans,measure_current_point_span_bindings,measure_point_span_locus
from agents.yf_arc3_v5.capabilities.framed_masks import measure_framed_mask_correspondences
from agents.yf_arc3_v5.capabilities.framed_replacements import measure_framed_replacements
from agents.yf_arc3_v5.capabilities.framed_reception_loci import measure_framed_reception_loci
from agents.yf_arc3_v6.morphology_policy.src_runtime import plain

def digest(v):return hashlib.sha256(json.dumps(v,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def extract(rows,ref):
 frame=FrameGrid(rows=tuple(map(tuple,rows)));components=detect_components(ComponentExtractionInput(frame=frame,connectivity=4)).components
 signatures=[digest([c.value,c.bbox.height,c.bbox.width,c.relative_pixels])for c in components];counts=Counter(signatures)
 entities=[SimpleNamespace(entity_id='shape:'+key if counts[key]==1 else 'occurrence:'+digest([key,c.bbox.model_dump()]),component=c)for c,key in zip(components,signatures)]
 return frame,components,SimpleNamespace(entities=entities,frame_ref=ref)
def point_regions(frame,components,bands):
 byref={c.component_id:c for c in components};regions=[];seen=set()
 for c in components:
  f=bands.get(c.component_id,{})
  if f.get('parallel_solid_band_peer_count')!=1:continue
  peer=byref[f['parallel_solid_band_peer_refs'][0]];pf=bands.get(peer.component_id,{})
  if pf.get('parallel_solid_band_peer_count')!=1 or tuple(pf.get('parallel_solid_band_peer_refs',()))!=(c.component_id,):continue
  key=tuple(sorted((c.component_id,peer.component_id)))
  if key in seen:continue
  seen.add(key)
  if c.bbox.left==peer.bbox.left and c.bbox.right==peer.bbox.right:
   top=min(c.bbox.bottom,peer.bbox.bottom)+1;bottom=max(c.bbox.top,peer.bbox.top)-1;left=c.bbox.left;right=c.bbox.right
  elif c.bbox.top==peer.bbox.top and c.bbox.bottom==peer.bbox.bottom:
   left=min(c.bbox.right,peer.bbox.right)+1;right=max(c.bbox.left,peer.bbox.left)-1;top=c.bbox.top;bottom=c.bbox.bottom
  else:continue
  if top>bottom or left>right:continue
  values={frame.rows[y][x]for y in range(top,bottom+1)for x in range(left,right+1)}
  for value in sorted(values):
   regions.append(SimpleNamespace(component_id='point_region:'+digest([key,value]),value=value,bbox=SimpleNamespace(top=top,left=left,bottom=bottom,right=right),pixels=frozenset((y,x)for y in range(top,bottom+1)for x in range(left,right+1)if frame.rows[y][x]==value),supported_by_mutual_parallel_pair=True,support_refs=key))
 return regions

def candidates(rows,obs,policy,spans,receipts,attempts):
 frame,components,scene=extract(rows,obs['observation_ref']);bands=measure_parallel_solid_bands(components,policy.route['parallel_band_measurement_contract']);byref={c.component_id:c for c in components};offers={}
 bindings,complete=measure_current_point_span_bindings(frame,spans,obs['level_epoch'],policy.route['point_motion_span_recall_contract'])
 def add(ref,point,facts,group):
  patches=[{'bbox':[c.bbox.left,c.bbox.top,c.bbox.right,c.bbox.bottom],'value':c.value}for c in group]
  key=digest([obs['level_epoch'],point,patches,rows]);facts={'framed_reception_analogy':False,**facts,'interaction_measurement_kind':'point','candidate_execution_count':int(key in attempts),'attempted_without_effect_in_current_context':bool(attempts.get(key,{}).get('unchanged')),'candidate_ref':key}
  box=[min(c.bbox.left for c in group),min(c.bbox.top for c in group),max(c.bbox.right for c in group),max(c.bbox.bottom for c in group)]
  offers[(tuple(point),ref)]={'candidate_ref':key,'point_x':point[1],'point_y':point[0],'point':list(point),'facts':facts,'component_ref':ref,'patches':patches,'bbox':box,'signature':digest(patches),'point_value':rows[point[0]][point[1]]}
 seen=set()
 for c in components:
  facts=plain(bands.get(c.component_id,{}))
  if not facts.get('parallel_solid_band_domain_complete')or facts.get('parallel_solid_band_peer_count')!=1:continue
  peer=byref[facts['parallel_solid_band_peer_refs'][0]]
  peerfacts=bands.get(peer.component_id,{})
  facts['parallel_solid_band_mutually_unique']=peerfacts.get('parallel_solid_band_peer_count')==1 and tuple(peerfacts.get('parallel_solid_band_peer_refs',()))==(c.component_id,)
  pair=tuple(sorted((c.component_id,peer.component_id)))
  if pair in seen:continue
  seen.add(pair);point=((min(c.bbox.top,peer.bbox.top)+max(c.bbox.bottom,peer.bbox.bottom))//2,(min(c.bbox.left,peer.bbox.left)+max(c.bbox.right,peer.bbox.right))//2)
  # A paired support is one current question, not two duplicate bar clicks.
  facts.update(plain(measure_point_span_locus(frame,point,bindings,complete)));add(c.component_id,point,facts,[c,peer])
 regions=point_regions(frame,components,bands);regionmap={v.component_id:v for v in regions}
 loci,loci_complete=measure_framed_reception_loci(frame=frame,components=components,records=[{**r,'mask_extent':tuple(r['mask_extent'])}for r in receipts],span_records=spans,context_epoch=obs['level_epoch'],mask_contract=policy.route['framed_reception_mask_contract'],span_contract=policy.route['point_motion_span_recall_contract'],band_facts=bands,contract=policy.route['framed_reception_locus_contract'])
 observed_regions,observed_complete=measure_regional_reception_loci(frame=frame,components=components,records=[{**r,'mask_extent':tuple(r['mask_extent'])}for r in receipts],span_records=spans,context_epoch=obs['level_epoch'],mask_contract=policy.mask,span_contract=policy.route['point_motion_span_recall_contract'],operator_regions=regions,contract=policy.route['framed_reception_locus_contract'])
 loci=tuple(loci)+tuple(observed_regions);loci_complete=loci_complete and observed_complete
 for ref,point,facts in loci:
  component=byref[regionmap[ref].support_refs[0]]if ref in regionmap else byref[ref];bf=plain(bands[component.component_id]);peer=byref[bf['parallel_solid_band_peer_refs'][0]]
  bf['parallel_solid_band_mutually_unique']=bands.get(peer.component_id,{}).get('parallel_solid_band_peer_count')==1 and tuple(bands.get(peer.component_id,{}).get('parallel_solid_band_peer_refs',()))==(component.component_id,)
  add(ref,point,{**bf,**plain(facts),'framed_reception_locus_binding_count':sum(tuple(p)==tuple(point)for _,p,_ in loci),'framed_reception_locus_complete':loci_complete},[component,peer])
 # Construct only explicitly hypothetical class analogues; never persist them as receipts.
 measured=measure_framed_mask_correspondences(frame,components,policy.mask);hypotheses=[];hypothesis_support={};source_markers={}
 for witness in receipts:
  if witness.get('context_epoch')!=obs['level_epoch'] or not witness.get('source_claim_ref') or not witness.get('marker_uniform') or witness.get('border_preserved')is not True:continue
  for pair in measured.get('framed_mask_pairs',()):
   for first,second in(('first','second'),('second','first')):
    if pair[first+'_inner_value']!=witness['source_inner_value'] or pair[first+'_border_value']!=witness['source_border_value'] or tuple(pair['mask_extent'])!=tuple(witness['mask_extent']):continue
    source_markers.setdefault(pair[first+'_component_ref'],set()).add(pair[second+'_component_ref'])
    ref='hypothesis:frame_analogy:'+digest([witness['source_claim_ref'],pair[second+'_inner_value'],pair[second+'_border_value'],pair['mask_extent']])
    hypotheses.append({**witness,'mask_extent':tuple(witness['mask_extent']),'marker_uniform':False,'marker_inner_value':pair[second+'_inner_value'],'marker_border_value':pair[second+'_border_value'],'source_claim_ref':ref})
    hypothesis_support[ref]={'observed_claim':witness['source_claim_ref'],'source_ref':pair[first+'_component_ref'],'marker_ref':pair[second+'_component_ref'],'mask_digest':pair['mask_digest'],'epistemic_status':'hypothesis_not_observed_reception'}
 hypotheses=list({h['source_claim_ref']:h for h in hypotheses}.values())
 regions=point_regions(frame,components,bands);regionmap={v.component_id:v for v in regions}
 analogues,complete=measure_regional_reception_loci(frame=frame,components=components,records=hypotheses,span_records=spans,context_epoch=obs['level_epoch'],mask_contract=policy.mask,span_contract=policy.route['point_motion_span_recall_contract'],operator_regions=regions,contract=policy.route['framed_reception_locus_contract'],require_operator_value_match=False)
 for ref,point,facts in analogues:
  facts=plain(facts)
  if len(source_markers.get(facts['framed_reception_locus_source_ref'],()))!=1:continue
  hyprefs=[r for r in facts['framed_reception_locus_premise_refs']if r in hypothesis_support]
  if not hyprefs:continue
  region=regionmap[ref];a,b=(byref[r]for r in region.support_refs);bf=plain(bands[a.component_id]);bf['parallel_solid_band_mutually_unique']=True
  actualrefs=[hypothesis_support[r]['observed_claim']if r in hypothesis_support else r for r in facts['framed_reception_locus_premise_refs']]
  facts.update({'framed_reception_analogy':True,'framed_reception_locus_binding_count':sum(tuple(p)==tuple(point)for _,p,_ in analogues),'framed_reception_locus_complete':complete,'analogy_support_refs':sorted(set(actualrefs)),'analogy_hypotheses':[{**hypothesis_support[r],'source_ref':facts['framed_reception_locus_source_ref'],'marker_ref':facts['framed_reception_locus_marker_ref'],'mask_digest':facts['framed_reception_locus_mask_digest']}for r in hyprefs]})
  add(ref,point,{**bf,**facts},[a,b])
 return list(offers.values())
def temporal_components(first,second,before,after,records=()):
 # Local exact correspondence: cancel stationary copies, then only unique residues.
 a,ac,old=extract(first,before['observation_ref']);b,bc,current=extract(second,after['observation_ref'])
 signature=lambda c:digest([c.value,c.bbox.height,c.bbox.width,c.relative_pixels])
 box=lambda c:(c.bbox.top,c.bbox.left,c.bbox.bottom,c.bbox.right)
 groups={}
 for side,components in ((0,ac),(1,bc)):
  for c in components:groups.setdefault(signature(c),[[],[]])[side].append(c)
 prior={}
 for row in records:
  if row.get('context_epoch')!=before['level_epoch'] or not row.get('source_claim_ref'):continue
  patches=row.get('endpoint_patches',());refs=row.get('endpoint_refs',())
  if len(patches)!=2 or len(refs)!=2:continue
  if not all(tuple(tuple(first[y][q[1]:q[3]+1])for y in range(q[0],q[2]+1))==tuple(map(tuple,patch))for q,patch in patches):continue
  for ref,(q,patch) in zip(refs,patches):prior.setdefault(tuple(q),set()).add(ref)
 pairs=[];ambiguous=[]
 for sig,(left,right) in groups.items():
  right_by_box={box(c):c for c in right};stationary={box(c)for c in left if box(c)in right_by_box}
  pairs.extend((c,right_by_box[box(c)],'stationary_exact')for c in left if box(c)in stationary)
  x=[c for c in left if box(c)not in stationary];y=[c for c in right if box(c)not in stationary]
  if len(x)==len(y)==1:pairs.append((x[0],y[0],'unique_residual_exact_translation'))
  elif x and y:ambiguous.append({'signature':sig,'before':len(x),'after':len(y)})
 old_ids={};new_ids={};translations=[];evidence=[]
 for x,y,kind in pairs:
  refs=prior.get(box(x),set());ref=next(iter(refs))if len(refs)==1 else 'observed_endpoint:'+digest([before['level_epoch'],signature(x),box(x)])
  if len(refs)>1:continue
  old_ids[x.component_id]=ref;new_ids[y.component_id]=ref
  delta=(y.bbox.top-x.bbox.top,y.bbox.left-x.bbox.left)
  if delta!=(0,0):translations.append(SimpleNamespace(entity_ref=ref,delta_row=delta[0],delta_col=delta[1]))
  evidence.append({'entity_ref':ref,'kind':kind,'before':box(x),'after':box(y),'delta':delta})
 old.entities=[SimpleNamespace(entity_id=old_ids.get(c.component_id,'unbound_before:'+c.component_id),component=c)for c in ac]
 current.entities=[SimpleNamespace(entity_id=new_ids.get(c.component_id,'unbound_after:'+c.component_id),component=c)for c in bc]
 # Competing historical identities do not silently collapse two current components.
 if len({e.entity_id for e in old.entities})!=len(old.entities) or len({e.entity_id for e in current.entities})!=len(current.entities):
  old=extract(first,before['observation_ref'])[2];current=extract(second,after['observation_ref'])[2]
  return a,b,old,current,[],{'status':'ambiguous_historical_identity','pairs':[],'ambiguous':ambiguous}
 return a,b,old,current,translations,{'status':'exact_partial_correspondence','pairs':evidence,'ambiguous':ambiguous}
def transition(first,second,before,after,command,policy,records=()):
 a,b,old,current,translations,correspondence=temporal_components(first,second,before,after,records)
 point=(command['data']['y'],command['data']['x']);ref='transition:'+digest([before['observation_ref'],after['observation_ref'],command])
 span=measure_point_motion_spans(before=old,after=current,before_frame=a,after_frame=b,translations=translations,point=point,action_ref=command['action_ref'],transition_ref=ref,candidate_ref=digest(command),context_epoch=before['level_epoch'],contract=policy.policies['policy.record_observed_point_motion_span']['configuration']['measurement_contract'])
 masks_before=measure_framed_mask_correspondences(a,old.entities,policy.mask);masks_after=measure_framed_mask_correspondences(b,current.entities,policy.mask)
 replacement=measure_framed_replacements(pairs=masks_before.get('framed_mask_pairs',()),before=old,after=current,after_frame=b,complete=masks_before['framed_mask_domain_complete']and masks_after['framed_mask_domain_complete'],action_ref=command['action_ref'],transition_ref=ref,context_epoch=before['level_epoch'],contract=policy.policies['policy.record_observed_framed_replacement']['configuration']['measurement_contract'],before_occurrences=masks_before.get('framed_mask_occurrences',()),after_occurrences=masks_after.get('framed_mask_occurrences',()),motion_spans=span['point_motion_span_rows'])
 return {**plain(span),'temporal_correspondence':correspondence},plain(replacement)


# Mechanical extension of the V5 locus arithmetic: current uniform point regions
# are distinct from solid bands; their support witnesses remain separate.
def measure_regional_reception_loci(*, frame, components, records, span_records,
                                context_epoch, mask_contract, span_contract,
                                operator_regions, contract, require_operator_value_match=True):
    if not contract or len(records) > contract['maximum_records']:
        return (), False
    measured = measure_framed_mask_correspondences(frame, components, mask_contract)
    bindings, span_complete = measure_current_point_span_bindings(frame, span_records, context_epoch, span_contract)
    if not measured['framed_mask_domain_complete'] or not span_complete:
        return (), False
    classes = tuple(r for r in records if r.get('context_epoch') == context_epoch
                    and r.get('border_preserved') is True and r.get('source_claim_ref'))
    occurrences = measured.get('framed_mask_occurrences', ())
    typed_relations = {}
    for witness in classes:
        if witness['marker_uniform']:
            continue
        for pair in measured['framed_mask_pairs']:
            for first, second in (('first', 'second'), ('second', 'first')):
                if not (pair['mask_extent'] == witness['mask_extent']
                        and pair[first+'_inner_value'] == witness['source_inner_value']
                        and pair[first+'_border_value'] == witness['source_border_value']
                        and pair[second+'_inner_value'] == witness['marker_inner_value']
                        and pair[second+'_border_value'] == witness['marker_border_value']):
                    continue
                key = (pair[first+'_component_ref'], pair[second+'_component_ref'])
                typed_relations.setdefault(key, []).append((pair['mask_digest'], pair[first+'_frame_bbox'], pair[second+'_frame_bbox'], witness))
    if sum(len(rows) for key, rows in sorted(typed_relations.items())) > contract['maximum_relations']:
        return (), False
    tasks = []
    for (source_ref, marker_ref), (mask, source_box, marker_box, witness) in tuple(
            (key, row) for key, rows in sorted(typed_relations.items()) for row in rows):
        for span, history in bindings:
            if _contains(span, source_box) and not _contains(span, marker_box):
                tasks.append((mask, source_ref, marker_ref, source_box, marker_box, witness, span, history, True, 'first'))
            if _contains(span, marker_box) and not _contains(span, source_box):
                tasks.append((mask, source_ref, marker_ref, source_box, marker_box, witness, span, history, True, 'second'))
        for pocket_witness in classes:
            if not pocket_witness['marker_uniform']:
                continue
            if (pocket_witness['source_inner_value'], pocket_witness['source_border_value'], pocket_witness['mask_extent']) != (witness['source_inner_value'], witness['source_border_value'], witness['mask_extent']):
                continue
            for pocket in occurrences:
                if not (pocket['inner_fills_bbox'] and pocket['mask_extent'] == pocket_witness['mask_extent']
                        and pocket['inner_value'] == pocket_witness['marker_inner_value']
                        and pocket['border_value'] == pocket_witness['marker_border_value']):
                    continue
                for span, history in bindings:
                    if _contains(span, pocket['frame_bbox']) and not _contains(span, source_box):
                        tasks.append((mask, source_ref, pocket['component_ref'], source_box, pocket['frame_bbox'], pocket_witness, span, history, False, 'second'))
    if len(tasks) > contract['maximum_tasks']:
        return (), False
    output = {}
    for mask, source_ref, marker_ref, source_box, marker_box, witness, span, history, typed, moving in tasks:
        axis = span['axis']
        source_axis, marker_axis = _center(source_box, axis), _center(marker_box, axis)
        delta = marker_axis - source_axis if moving == 'first' else source_axis - marker_axis
        if delta == 0:
            continue
        shifted_source = tuple(v + (delta if (index in (1,3) if axis=='column' else index in (0,2)) and moving=='first' else 0) for index,v in enumerate(source_box))
        shifted_marker = tuple(v + (delta if (index in (1,3) if axis=='column' else index in (0,2)) and moving=='second' else 0) for index,v in enumerate(marker_box))
        # Reproduce an observed intervening raster, without assigning it a role.
        bridge_matches = []
        for bridge_axis, old_bridge_box, patch in witness.get('gap_patches', ()):
            if bridge_axis != axis:
                continue
            st, sl, sb, sr = shifted_source
            mt, ml, mb, mr = shifted_marker
            if axis == 'column':
                box = (sb+1, ml, mt-1, mr) if sb < mt else (mb+1, ml, st-1, mr) if mb < st else None
            else:
                box = (mt, sr+1, mb, ml-1) if sr < ml else (mt, mr+1, mb, sl-1) if mr < sl else None
            if box is None or not (0 <= box[0] <= box[2] < frame.height and 0 <= box[1] <= box[3] < frame.width):
                continue
            if (box[2]-box[0], box[3]-box[1]) != (old_bridge_box[2]-old_bridge_box[0], old_bridge_box[3]-old_bridge_box[1]):
                continue
            actual = tuple(tuple(frame.rows[y][box[1]:box[3]+1]) for y in range(box[0], box[2]+1))
            if actual == tuple(tuple(row) for row in patch):
                bridge_matches.append(box)
        if not bridge_matches:
            continue
        side = 'lower' if delta < 0 else 'upper'
        low, high = span['after_interval']
        # Enumerate local and analogous observations separately; no rank choice.
        patch_signature = tuple(tuple(tuple(line) for line in patch) for box, patch in span.get('endpoint_patches', ()))
        for prototype in span_records:
            if prototype.get('context_epoch') != context_epoch or prototype.get('axis') != axis or prototype.get('point_before_side') != side or not prototype.get('source_claim_ref'):
                continue
            other_signature = tuple(tuple(tuple(line) for line in patch) for box, patch in prototype.get('endpoint_patches', ()))
            if other_signature != patch_signature or prototype['after_interval'][1]-prototype['after_interval'][0] != high-low:
                continue
            offset = prototype['point_to_lower_edge'] if side == 'lower' else prototype['point_to_upper_edge']
            coordinate = low + delta + offset if side == 'lower' else high + delta - offset
            if low <= coordinate <= high or low+delta < 0 or high+delta >= (frame.width if axis=='column' else frame.height):
                continue
            for component in operator_regions:
                if not component.supported_by_mutual_parallel_pair or (require_operator_value_match and component.value!=prototype['operator_value']):
                    continue
                point = ((component.bbox.top+component.bbox.bottom)//2, coordinate) if axis=='column' else (coordinate, (component.bbox.left+component.bbox.right)//2)
                orthogonal = point[0] if axis=='column' else point[1]
                if not span['orthogonal_interval'][0] <= orthogonal <= span['orthogonal_interval'][1] or point not in component.pixels:
                    continue
                key = (component.component_id, point, mask, typed, source_ref, marker_ref, delta)
                fields = {
                    'framed_reception_locus_complete': True, 'framed_reception_locus_mask_digest': mask,
                    'operator_value_current':component.value,'operator_value_observed':prototype['operator_value'],
                    'operator_value_matches_observation':component.value==prototype['operator_value'],
                    'framed_reception_locus_same_mask_marker': typed, 'framed_reception_locus_expected_delta': delta,
                    'framed_reception_locus_axis': axis, 'framed_reception_locus_source_ref': source_ref,
                    'framed_reception_locus_marker_ref': marker_ref,
                    'framed_reception_locus_local_operator': tuple(prototype['endpoint_refs']) == tuple(span['endpoint_refs']),
                    'framed_reception_locus_premise_refs': (witness['source_claim_ref'], prototype['source_claim_ref']),
                }
                prior = output.get(key)
                if prior is not None:
                    fields['framed_reception_locus_premise_refs'] = tuple(sorted(set(prior['framed_reception_locus_premise_refs']) | set(fields['framed_reception_locus_premise_refs'])))
                    fields['framed_reception_locus_local_operator'] = prior['framed_reception_locus_local_operator'] or fields['framed_reception_locus_local_operator']
                output[key] = FrozenMap(fields)
                if len(output) > contract['maximum_loci']:
                    return (), False
    return tuple((key[0], key[1], facts) for key, facts in sorted(output.items())), True
