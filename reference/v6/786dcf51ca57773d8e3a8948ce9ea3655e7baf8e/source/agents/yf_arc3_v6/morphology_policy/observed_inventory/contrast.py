"""Measure an observed local disappearance and a matching peripheral appearance."""
from agents.yf_arc3_v5.capabilities.components import detect_components
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid,ComponentExtractionInput

def normalized(points):
 if not points:return ()
 x0=min(x for x,y in points);y0=min(y for x,y in points)
 return tuple(sorted((x-x0,y-y0) for x,y in points))

def transferred_shape(before,after,first,second,first_facts,second_facts,action):
 out={'status':'unbound','evidence':[before['observation_ref'],after['observation_ref']],'action':action,'release_authority':False}
 if before['level_epoch']!=after['level_epoch'] or first_facts.get('body')!=second_facts.get('body'):return out
 if first_facts.get('observation_ref')!=before['observation_ref'] or second_facts.get('observation_ref')!=after['observation_ref']:return out
 if first_facts.get('level_epoch')!=before['level_epoch'] or second_facts.get('level_epoch')!=after['level_epoch']:return out
 under=first_facts.get('underlay_evidence',{});patch=under.get('patch');box=under.get('cell_bbox')
 if not patch or not box or not first_facts.get('retained_underlay_value_count'):return out
 cl,ct,cr,cb=box;bl,bt,br,bb=first_facts['body'];removed={}
 for y in range(ct,cb+1):
  for x in range(cl,cr+1):
   if bl<=x<=br and bt<=y<=bb:continue
   if first[y][x]!=second[y][x]:removed.setdefault(first[y][x],[]).append((x,y))
 components=detect_components(ComponentExtractionInput(frame=FrameGrid(rows=tuple(map(tuple,second))),connectivity=8)).components
 hits=[]
 for value,pixels in removed.items():
  source={(x,y) for y,row in enumerate(patch) for x,v in enumerate(row) if v==value}
  if not source or any(first[ct+y][cl+x]!=value for x,y in source if not(bl<=cl+x<=br and bt<=ct+y<=bb)):continue
  if any(second[y][x]==value for x,y in pixels):continue
  for comp in components:
   if comp.value!=value or normalized([(x,y) for y,x in comp.relative_pixels])!=normalized(source):continue
   b=comp.bbox
   if not (b.right<cl or b.left>cr or b.bottom<ct or b.top>cb):continue
   coords=[(b.left+x,b.top+y) for y,x in comp.relative_pixels]
   if any(first[y][x]==value for x,y in coords):continue
   hits.append({'source_cell_bbox':box,'source_value':value,'source_mask':[list(q) for q in normalized(source)],'display_component_ref':comp.component_id,'display_bbox':[b.left,b.top,b.right,b.bottom],'visible_source_removed':len(pixels),'display_pixels_added':comp.area,'source_before_entry_evidence':under['evidence']})
 out.update(status='unique_corresponding_transfer' if len(hits)==1 else 'ambiguous' if hits else 'no_matching_transfer',matches=hits)
 return out

def world_complements(facts,rows):
 """Bounded world extension of the legacy display/cell exact-union measurement.
 It removes only the display-band filter, retaining oriented shape, palette,
 unique placement and full-cell union. Neither member is assigned a key role.
 """
 if len(facts.get('grids',()))!=1:return []
 grid=facts['grids'][0];h=grid['cell_height'];w=grid['cell_width']
 if h*w>1024:return []
 comps=detect_components(ComponentExtractionInput(frame=FrameGrid(rows=tuple(map(tuple,rows))),connectivity=8)).components
 full={(x,y) for y in range(h) for x in range(w)};out=[]
 for comp in comps:
  box=comp.bbox
  if comp.area<=1 or comp.area>=h*w or box.width>w or box.height>h:continue
  # A compact motif is measured separately from a whole-cell partition.
  if box.width==w and box.height==h:continue
  sources=[c for c in grid['cells'] if c['bbox']['left']<=box.left<=box.right<=c['bbox']['right'] and c['bbox']['top']<=box.top<=box.bottom<=c['bbox']['bottom']]
  if len(sources)!=1:continue
  rel={(x,y) for y,x in comp.relative_pixels}
  for cell in grid['cells']:
   if cell==sources[0]:continue
   b=cell['bbox'];l,t=b['left'],b['top']
   mask={(x,y) for y in range(h) for x in range(w) if rows[t+y][l+x]==comp.value}
   if not mask or len(mask)+len(rel)!=len(full):continue
   placements=[(dx,dy) for dy in range(h-box.height+1) for dx in range(w-box.width+1) if {(x+dx,y+dy) for x,y in rel}.isdisjoint(mask) and {(x+dx,y+dy) for x,y in rel}|mask==full]
   if len(placements)!=1:continue
   out.append({'source_cell':[sources[0]['row'],sources[0]['col']],'source_bbox':[box.left,box.top,box.right,box.bottom],'source_mask':sorted(rel),'source_value':comp.value,'target_cell':[cell['row'],cell['col']],'target_bbox':[b['left'],b['top'],b['right'],b['bottom']],'exact_disjoint_union_fills_cell':True,'offset':placements[0],'observation_ref':facts['observation_ref'],'level_epoch':facts['level_epoch']})
 return out[:8]

def display_matches(receipt,rows):
 l,t,r,b=receipt['display_bbox'];mask={tuple(p) for p in receipt['source_mask']};value=receipt['source_value']
 return all((rows[y][x]==value)==((x-l,y-t) in mask) for y in range(t,b+1) for x in range(l,r+1))

def reverse_transfer(receipt,before,after,first,second,facts):
 out={'status':'unbound','evidence':[before['observation_ref'],after['observation_ref']]}
 if before['level_epoch']!=after['level_epoch'] or not display_matches(receipt,first) or display_matches(receipt,second):return out
 grids=facts.get('grids',[]);body=facts.get('body')
 if len(grids)!=1 or not body:return out
 bl,bt,br,bb=body;cells=[c for c in grids[0]['cells'] if c['bbox']['left']<=bl<=br<=c['bbox']['right'] and c['bbox']['top']<=bt<=bb<=c['bbox']['bottom']]
 if len(cells)!=1:return out
 box=cells[0]['bbox'];l,t,r,b=[box[k] for k in ('left','top','right','bottom')];shape={tuple(p) for p in receipt['source_mask']};value=receipt['source_value'];hits=[]
 for dy in range(b-t+2-max(y for x,y in shape)-1):
  for dx in range(r-l+2-max(x for x,y in shape)-1):
   points={(l+dx+x,t+dy+y) for x,y in shape};visible={p for p in points if not(bl<=p[0]<=br and bt<=p[1]<=bb)}
   if not visible or any(second[y][x]!=value for x,y in visible):continue
   if not any(first[y][x]!=value for x,y in visible):continue
   other={(x,y) for y in range(t,b+1) for x in range(l,r+1) if second[y][x]==value and not(bl<=x<=br and bt<=y<=bb)}
   if other!=visible:continue
   hits.append({'cell_bbox':[l,t,r,b],'offset':[dx,dy],'visible_added':sum(first[y][x]!=value for x,y in visible),'hidden_points_unknown':len(points)-len(visible)})
 out.update(status='unique_reverse_correspondence' if len(hits)==1 else 'ambiguous' if hits else 'display_changed_without_local_reverse',alternatives=hits)
 return out
