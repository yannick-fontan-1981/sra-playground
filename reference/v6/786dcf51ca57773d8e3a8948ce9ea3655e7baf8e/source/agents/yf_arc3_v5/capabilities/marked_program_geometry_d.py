"""Exact measured diamond cells, carrier marks and related stacked collections."""
from collections import Counter,defaultdict
from types import SimpleNamespace
from agents.yf_arc3_v5.capabilities.affine_glyphs import measure_affine_glyph_carriers
from agents.yf_arc3_v5.capabilities.symbolic_diagrams import _components

def measure_marked_program_scene(value,prior=None,bootstrap_empty=True):
 f=value.current_observed_frame or value.frame
 if f.width*f.height>4096:return None
 cs=_components(f);background=Counter(p for row in f.rows for p in row).most_common(1)[0][0]
 c,_=measure_affine_glyph_carriers(f,value.components,value.sprites)
 families=[]
 for family in c['aligned_glyph_carrier_families']:
  ms=family['member_measurements'];directional=tuple(m for m in ms if m['singleton_common_mark_present']);uniform=tuple(m for m in ms if m['common_marks_have_uniform_value']and m['extra_mark_count']==0)
  if len(directional)==4 and len(uniform)==1 and len(ms)==5:
   vectors={tuple(m['singleton_common_mark_vector_twice'])for m in directional}
   hs={abs(r)for r,col in vectors};ws={abs(col)for r,col in vectors}
   if len(hs)!=1 or len(ws)!=1 or 0 in hs or 0 in ws:continue
   h=next(iter(hs));w=next(iter(ws))
   if vectors!={(a*h,b*w)for a in[-1,1]for b in[-1,1]}:continue
   carriers=[]
   for m in ms:
    sprite=next(s for s in value.sprites if s.sprite_id==m['sprite_ref']);b=sprite.bbox
    carriers.append({'paint':m['carrier_palette_value'],'vector':tuple(m['singleton_common_mark_vector_twice']),'singleton':m['singleton_common_mark_present'],'point':((b.top+b.bottom)//2,(b.left+b.right)//2),'bounds':(b.top,b.left,b.bottom,b.right)})
   families.append({'half_extent':(h,w),'carriers':carriers})
 if len(families)==1:
  layout=families[0];palette_visible=True
 elif not families and prior:
  layout={k:prior[k]for k in ['half_extent','carriers']};palette_visible=False
 else:return None
 h,w=layout['half_extent'];carriers=layout['carriers'];alphabet={c['paint']for c in carriers};palette_top=min(c['bounds'][0]for c in carriers)
 # One edge-attached vertical field is distinct from the footer controls.
 separators=[c for c in cs if c.bbox.left==c.bbox.right and c.bbox.top==0 and c.bbox.height>palette_top//2 and c.bbox.bottom<palette_top and c.bbox.left>=3]
 if len(separators)!=1:return None
 sep=separators[0];pb=SimpleNamespace(left=0,right=sep.bbox.left-1,top=0,bottom=sep.bbox.bottom)
 panel_paint=Counter(f.rows[y][x]for y in range(pb.bottom+1)for x in range(pb.right+1)).most_common(1)[0][0]
 markers=[(y,f.rows[y][pb.left])for y in range(1,pb.bottom)if f.rows[y][pb.left]!=panel_paint and f.rows[y-1][pb.left]==f.rows[y+1][pb.left]==panel_paint]
 if len(markers)<2 or len(markers)>16 or len({b[0]-a[0]for a,b in zip(markers,markers[1:])})!=1:return None
 capacity=len(markers)
 collection=[c for c in cs if c.value in alphabet and pb.left<c.bbox.left<=c.bbox.right<pb.right and c.area==c.bbox.width*c.bbox.height and c.bbox.width>c.bbox.height]
 collection.sort(key=lambda c:-c.bbox.bottom);word=tuple(c.value for c in collection)
 if len(word)>capacity:return None
 if len({(c.bbox.left+c.bbox.right,c.bbox.height)for c in collection})>1:return None
 edges=tuple(set((dy,side*(w-abs(dy)*w//h))for dy in range(-h,h+1)for side in[-1,1]))
 groups=defaultdict(list)
 for y in range(h,palette_top-h):
  for x in range(max(w,pb.right+1+w),f.width-w):
   paints={f.rows[y+dy][x+dx]for dy,dx in edges}
   if len(paints)==1 and f.rows[y][x]not in paints:groups[next(iter(paints))].append((y,x))
 groups={paint:tuple(pts)for paint,pts in sorted(groups.items())if len(pts)>=9}
 if len(groups)!=1:return None
 edge,centers=next(iter(groups.items()))
 if prior:
  oy,ox=prior['origin'];rows,cols=prior['shape']
 else:
  oy,ox=min(centers);coordinates=[]
  for y,x in centers:
   if (y-oy)%h or (x-ox)%w:return None
   a=(y-oy)//h;b=(x-ox)//w
   if (a+b)%2:return None
   coordinates.append(((a-b)//2,(a+b)//2))
  if min(r for r,c in coordinates)!=0 or min(c for r,c in coordinates)!=0:return None
  rows=max(r for r,c in coordinates)+1;cols=max(c for r,c in coordinates)+1
 if rows*cols>256 or min(rows,cols)<3:return None
 cells=[];bodies=[]
 for r in range(rows):
  for col in range(cols):
   y,x=oy+h*(r+col),ox+w*(col-r)
   if not(h<=y<palette_top-h and w<=x<f.width-w):return None
   tip=f.rows[y+1][x];body=None
   if tip not in alphabet and tip!=background and f.rows[y][x-1]==f.rows[y][x+1]==tip:
    if f.rows[y][x]==tip and f.rows[y-1][x]==tip:body={'ring':tip,'cards':()}
    elif f.rows[y][x]in alphabet:
     cards=[];offset=0
     while y-offset>=0 and f.rows[y-offset][x]in alphabet:
      cards.append(f.rows[y-offset][x]);offset+=1
     if len(cards)>=3 and cards[-1]==cards[-2]:body={'ring':tip,'cards':tuple(cards[:-2])}
   cell={'cell':(r,col),'center':(y,x),'complete_edge':(y,x)in centers}
   cells.append(cell)
   if body:bodies.append({**cell,**body})
 # Track the two previously measured border identities. A newly uncovered
 # empty cross remains a separate measurement, not an extra tracked stack.
 unmatched=()
 if prior:
  known={b['ring']for b in prior['bodies']}
  unmatched=tuple(b for b in bodies if b['ring']not in known)
  bodies=[b for b in bodies if b['ring']in known]
 if len(bodies)!=2 or len({b['ring']for b in bodies})!=2:return None
 matches=[b for b in bodies if b['cards']==word and (not prior or b['ring']==prior['collection_body_ring'])]
 if len(matches)!=1:return None
 unique_body=matches[0]
 origin_cell=unique_body['cell']
 if prior:
  old_linked=next(b for b in prior['bodies']if b['ring']==prior['collection_body_ring'])
  origin_cell=tuple(prior.get('collection_origin_cell',old_linked['cell']))
 # Bootstrap only the empty related collection, not a nonempty unexplained program.
 if not prior and word and bootstrap_empty:return None
 cover=set()
 for body in bodies:
  y,x=body['center'];n=len(body['cards'])
  cover.update((yy,xx)for yy in range(y-n-1,y+2)for xx in range(x-1,x+2))
 for cell in cells:
  y,x=cell['center'];paints=[]
  for dy in range(-h,h+1):
   span=w-abs(dy)*w//h
   for dx in range(-span+1,span):
    if abs(dy)<h and (y+dy,x+dx)not in cover:paints.append(f.rows[y+dy][x+dx])
  cell['uncovered_interior_paints']=tuple(sorted(set(paints)))
  if not paints:return None
 return {**layout,'origin':(oy,ox),'shape':(rows,cols),'edge_paint':edge,'background_paint':background,'capacity':capacity,'capacity_markers':tuple(markers),'collection_word':word,'collection_card_points':tuple(((c.bbox.top+c.bbox.bottom)//2,(c.bbox.left+c.bbox.right)//2)for c in collection),'collection_body_ring':unique_body['ring'],'collection_origin_cell':origin_cell,'unmatched_base_candidates':unmatched,'bodies':tuple(bodies),'cells':tuple(cells),'palette_visible':palette_visible}
